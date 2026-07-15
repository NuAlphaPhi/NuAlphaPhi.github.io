/* Forms (Google-Forms-style): build a form with a question set, publish it to
   get a public link anyone can fill out with no login, then view responses.
   Owner manages the form + collaborators; collaborators can only view
   responses. Public submissions are handled by form-view.html / form-view.js,
   which is a separate unauthenticated page — this file is portal-only. */
(function () {
  "use strict";

  var listsContainer = document.getElementById("formsListsContainer");
  if (!listsContainer) return;

  var subTabBtns = document.querySelectorAll("#formsSubTabs [data-forms-tab]");
  var myListEl = document.getElementById("formsMyList");
  var sharedListEl = document.getElementById("formsSharedList");
  var newFormBtn = document.getElementById("newFormBtn");

  var QUESTION_TYPES = [
    ["short_answer", "Short answer"],
    ["paragraph", "Paragraph"],
    ["multiple_choice", "Multiple choice"],
    ["checkboxes", "Checkboxes"],
    ["dropdown", "Dropdown"],
  ];
  var CHOICE_TYPES = ["multiple_choice", "checkboxes", "dropdown"];

  var currentUid = null;
  var currentFormsTab = "mine";
  var myForms = [];
  var sharedForms = [];

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function makeId(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Always points at the real production domain, even when the portal
     itself is being viewed from localhost during testing — a share link
     that says "localhost" is useless to any other brother it's sent to. */
  function publicLinkFor(formId) {
    return "https://nualphaphi.com/form-view?id=" + formId;
  }

  window.napOnAuthReady(function (detail) {
    currentUid = detail.uid;
    if (!started) {
      started = true;
      startFormsListeners();
    }
  });

  /* ---------- Sub-tabs: My Forms / Shared with Me ---------- */
  function setFormsTab(tab) {
    currentFormsTab = tab;
    subTabBtns.forEach(function (btn) {
      var active = btn.getAttribute("data-forms-tab") === tab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    myListEl.hidden = tab !== "mine";
    sharedListEl.hidden = tab !== "shared";
  }

  subTabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setFormsTab(btn.getAttribute("data-forms-tab"));
    });
  });

  /* ---------- List rendering ---------- */
  function formCardHtml(form, isOwner) {
    var descPreview = (form.description || "").length > 120 ? form.description.slice(0, 120).trim() + "…" : form.description || "";
    var questionCount = (form.questions || []).length;

    var html = '<article class="forms-card" data-form-id="' + form.id + '">';
    html +=
      '<div class="forms-card__header">' +
      '<h3 class="forms-card__title">' + escapeHtml(form.title || "Untitled form") + "</h3>" +
      '<span class="forms-card__badge ' + (form.published ? "is-published" : "is-draft") + '">' +
      (form.published ? "Accepting Responses" : "Draft") +
      "</span>" +
      "</div>";

    if (descPreview) {
      html += '<p class="forms-card__desc">' + escapeHtml(descPreview) + "</p>";
    }

    html += '<p class="forms-card__meta">' + questionCount + " question" + (questionCount === 1 ? "" : "s") + "</p>";

    html += '<div class="forms-card__actions">';
    if (isOwner) {
      html +=
        '<button class="news-card__action-btn" type="button" data-form-edit="' + form.id + '">Edit</button>' +
        '<button class="news-card__action-btn" type="button" data-form-share="' + form.id + '">Share</button>';
    }
    html += '<button class="news-card__action-btn" type="button" data-form-responses="' + form.id + '">Responses</button>';
    if (isOwner) {
      html += '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-form-delete="' + form.id + '">Delete</button>';
    }
    html += "</div></article>";

    return html;
  }

  function renderFormsList(forms, container, isOwner, emptyText) {
    if (!forms.length) {
      container.innerHTML = '<p class="news-card__empty">' + emptyText + "</p>";
      return;
    }
    container.innerHTML = forms
      .map(function (f) {
        return formCardHtml(f, isOwner);
      })
      .join("");
  }

  function renderFormsLists() {
    var sortedMine = myForms.slice().sort(function (a, b) {
      return sortKey(b) - sortKey(a);
    });
    var sortedShared = sharedForms.slice().sort(function (a, b) {
      return sortKey(b) - sortKey(a);
    });
    renderFormsList(sortedMine, myListEl, true, "No forms yet — create one to get started.");
    renderFormsList(sortedShared, sharedListEl, false, "No forms have been shared with you yet.");

    if (shareModalFormId) renderShareModal();
    if (responsesPageFormId) renderResponsesPage();
  }

  function sortKey(f) {
    return f.updatedAt && f.updatedAt.toMillis ? f.updatedAt.toMillis() : f.createdAt && f.createdAt.toMillis ? f.createdAt.toMillis() : 0;
  }

  function findForm(formId) {
    return (
      myForms.find(function (f) {
        return f.id === formId;
      }) ||
      sharedForms.find(function (f) {
        return f.id === formId;
      })
    );
  }

  listsContainer.addEventListener("click", function (e) {
    var editBtn = e.target.closest("[data-form-edit]");
    var shareBtn = e.target.closest("[data-form-share]");
    var responsesBtn = e.target.closest("[data-form-responses]");
    var deleteBtn = e.target.closest("[data-form-delete]");

    if (editBtn) {
      var form = findForm(editBtn.getAttribute("data-form-edit"));
      if (form) openBuilderPage(form);
      return;
    }
    if (shareBtn) {
      openShareModal(shareBtn.getAttribute("data-form-share"));
      return;
    }
    if (responsesBtn) {
      openResponsesPage(responsesBtn.getAttribute("data-form-responses"));
      return;
    }
    if (deleteBtn) {
      var formIdToDelete = deleteBtn.getAttribute("data-form-delete");
      window.napConfirm("This also removes all of its responses. This can't be undone.", { title: "Delete this form?" }).then(function (confirmed) {
        if (confirmed) deleteFormCascade(formIdToDelete);
      });
    }
  });

  function deleteFormCascade(formId) {
    var formRef = db.collection("forms").doc(formId);
    formRef
      .collection("responses")
      .get()
      .then(function (snap) {
        var batch = db.batch();
        snap.forEach(function (doc) {
          batch.delete(doc.ref);
        });
        batch.delete(formRef);
        return batch.commit();
      })
      .catch(function () {
        window.alert("Couldn't delete this form. Please try again.");
      });
  }

  /* ---------- Builder page (create / edit) ---------- */
  var builderPageTitle = document.getElementById("formBuilderPageTitle");
  var builderBackBtn = document.getElementById("formBuilderBackBtn");
  var builderForm = document.getElementById("formBuilderForm");
  var builderSubmitBtn = builderForm.querySelector('button[type="submit"]');
  var builderErrorEl = document.getElementById("form-builder-error");
  var builderQuestionsEl = document.getElementById("formBuilderQuestions");
  var builderAddQuestionBtn = document.getElementById("formBuilderAddQuestionBtn");
  var builderPublishBtn = document.getElementById("formBuilderPublishBtn");

  var currentEditFormId = null;
  var builderQuestions = [];
  var builderPublished = false;
  var builderRequireSignIn = false;
  var builderBannerImage = null;

  /* ---------- Banner upload + crop ---------- */
  var CROP_OUTPUT_W = 1400;
  var CROP_OUTPUT_H = 400;

  var bannerInput = document.getElementById("form-builder-banner-input");
  var bannerPreviewEl = document.getElementById("formBuilderBannerPreview");
  var bannerRemoveBtn = document.getElementById("formBuilderBannerRemoveBtn");

  var cropDialog = document.getElementById("modal-banner-crop");
  var cropCanvas = document.getElementById("bannerCropCanvas");
  var cropCtx = cropCanvas.getContext("2d");
  var cropZoomInput = document.getElementById("bannerCropZoom");
  var cropApplyBtn = document.getElementById("bannerCropApplyBtn");

  cropCanvas.width = CROP_OUTPUT_W;
  cropCanvas.height = CROP_OUTPUT_H;

  var cropImg = null;
  var cropBaseScale = 1;
  var cropZoom = 1;
  var cropOffsetX = 0;
  var cropOffsetY = 0;
  var cropDragging = false;
  var cropDragStart = null;

  function renderBannerPreview() {
    if (builderBannerImage) {
      bannerPreviewEl.innerHTML = '<img src="' + builderBannerImage + '" alt="">';
      bannerRemoveBtn.hidden = false;
    } else {
      bannerPreviewEl.innerHTML = '<p class="news-card__empty">No banner yet.</p>';
      bannerRemoveBtn.hidden = true;
    }
  }

  function cropClampOffset() {
    var scale = cropBaseScale * cropZoom;
    var scaledW = cropImg.width * scale;
    var scaledH = cropImg.height * scale;
    var maxOffsetX = Math.max(0, (scaledW - CROP_OUTPUT_W) / 2);
    var maxOffsetY = Math.max(0, (scaledH - CROP_OUTPUT_H) / 2);
    cropOffsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, cropOffsetX));
    cropOffsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, cropOffsetY));
  }

  function cropDraw() {
    if (!cropImg) return;
    var scale = cropBaseScale * cropZoom;
    var scaledW = cropImg.width * scale;
    var scaledH = cropImg.height * scale;
    var dx = CROP_OUTPUT_W / 2 - scaledW / 2 + cropOffsetX;
    var dy = CROP_OUTPUT_H / 2 - scaledH / 2 + cropOffsetY;
    cropCtx.clearRect(0, 0, CROP_OUTPUT_W, CROP_OUTPUT_H);
    cropCtx.drawImage(cropImg, dx, dy, scaledW, scaledH);
  }

  function openBannerCropModal(img) {
    cropImg = img;
    cropBaseScale = Math.max(CROP_OUTPUT_W / img.width, CROP_OUTPUT_H / img.height);
    cropZoom = 1;
    cropZoomInput.value = "1";
    cropOffsetX = 0;
    cropOffsetY = 0;
    cropDraw();
    cropDialog.showModal();
  }

  if (bannerInput) {
    bannerInput.addEventListener("change", function () {
      var file = bannerInput.files && bannerInput.files[0];
      bannerInput.value = "";
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          openBannerCropModal(img);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (bannerRemoveBtn) {
    bannerRemoveBtn.addEventListener("click", function () {
      builderBannerImage = null;
      renderBannerPreview();
    });
  }

  cropCanvas.addEventListener("pointerdown", function (e) {
    cropDragging = true;
    cropCanvas.classList.add("is-dragging");
    cropCanvas.setPointerCapture(e.pointerId);
    cropDragStart = { x: e.clientX, y: e.clientY, offsetX: cropOffsetX, offsetY: cropOffsetY };
  });

  cropCanvas.addEventListener("pointermove", function (e) {
    if (!cropDragging) return;
    var rect = cropCanvas.getBoundingClientRect();
    var scaleFactor = CROP_OUTPUT_W / rect.width;
    cropOffsetX = cropDragStart.offsetX + (e.clientX - cropDragStart.x) * scaleFactor;
    cropOffsetY = cropDragStart.offsetY + (e.clientY - cropDragStart.y) * scaleFactor;
    cropClampOffset();
    cropDraw();
  });

  function endCropDrag(e) {
    cropDragging = false;
    cropCanvas.classList.remove("is-dragging");
    try {
      cropCanvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }
  cropCanvas.addEventListener("pointerup", endCropDrag);
  cropCanvas.addEventListener("pointercancel", endCropDrag);

  cropZoomInput.addEventListener("input", function () {
    cropZoom = Number(cropZoomInput.value);
    cropClampOffset();
    cropDraw();
  });

  cropApplyBtn.addEventListener("click", function () {
    builderBannerImage = cropCanvas.toDataURL("image/jpeg", 0.82);
    renderBannerPreview();
    cropDialog.close();
  });

  function blankQuestion() {
    return { id: makeId("q"), type: "short_answer", label: "", required: false, options: [] };
  }

  function questionRowHtml(q, idx) {
    var isChoice = CHOICE_TYPES.indexOf(q.type) !== -1;

    var html = '<div class="form-builder__question" data-q-index="' + idx + '">';
    html += '<div class="form-builder__question-head">';
    html += '<input class="form-input" type="text" data-q-label placeholder="Question ' + (idx + 1) + '" value="' + escapeHtml(q.label) + '">';
    html += '<select class="form-select form-builder__type-select" data-q-type>';
    html += QUESTION_TYPES.map(function (t) {
      return '<option value="' + t[0] + '"' + (t[0] === q.type ? " selected" : "") + ">" + t[1] + "</option>";
    }).join("");
    html += "</select>";
    html += '<button class="form-builder__move-btn" type="button" data-q-move-up title="Move up"' + (idx === 0 ? " disabled" : "") + ">&uarr;</button>";
    html += "</div>";

    if (isChoice) {
      html += '<div class="form-builder__options">';
      (q.options.length ? q.options : [""]).forEach(function (opt, oi) {
        html +=
          '<div class="form-builder__option-row">' +
          '<input class="form-input" type="text" data-q-option data-opt-index="' + oi + '" placeholder="Option ' + (oi + 1) + '" value="' + escapeHtml(opt) + '">' +
          '<button class="form-builder__option-remove" type="button" data-q-remove-option data-opt-index="' + oi + '" aria-label="Remove option">&times;</button>' +
          "</div>";
      });
      html += '<button class="news-card__action-btn" type="button" data-q-add-option>Add Option</button>';
      html += "</div>";
    }

    html +=
      '<div class="form-builder__question-foot">' +
      '<label class="form-builder__required">' +
      '<input type="checkbox" data-q-required' + (q.required ? " checked" : "") + "> Required" +
      "</label>" +
      '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-q-remove>Remove Question</button>' +
      "</div>";

    html += "</div>";
    return html;
  }

  function renderBuilderQuestions() {
    if (!builderQuestions.length) {
      builderQuestionsEl.innerHTML = '<p class="news-card__empty">No questions yet — add one below.</p>';
      return;
    }
    builderQuestionsEl.innerHTML = builderQuestions.map(questionRowHtml).join("");
  }

  function setPublishBtn(on) {
    builderPublished = !!on;
    builderPublishBtn.classList.toggle("is-active", builderPublished);
    builderPublishBtn.setAttribute("aria-pressed", builderPublished ? "true" : "false");
  }

  builderPublishBtn.addEventListener("click", function () {
    setPublishBtn(!builderPublished);
  });

  var builderRequireSignInBtn = document.getElementById("formBuilderRequireSignInBtn");

  function setRequireSignInBtn(on) {
    builderRequireSignIn = !!on;
    builderRequireSignInBtn.classList.toggle("is-active", builderRequireSignIn);
    builderRequireSignInBtn.setAttribute("aria-pressed", builderRequireSignIn ? "true" : "false");
  }

  builderRequireSignInBtn.addEventListener("click", function () {
    setRequireSignInBtn(!builderRequireSignIn);
  });

  function openBuilderPage(form) {
    currentEditFormId = form ? form.id : null;
    builderPageTitle.textContent = form ? "Edit Form" : "New Form";
    builderSubmitBtn.textContent = form ? "Save Changes" : "Create Form";
    builderForm.querySelector('[name="title"]').value = form ? form.title : "";
    builderForm.querySelector('[name="description"]').value = form ? form.description : "";
    setPublishBtn(form ? !!form.published : false);
    setRequireSignInBtn(form ? !!form.requireSignIn : false);
    builderBannerImage = (form && form.bannerImage) || null;
    renderBannerPreview();
    builderQuestions = form && form.questions && form.questions.length
      ? form.questions.map(function (q) {
          return Object.assign({}, q, { options: (q.options || []).slice() });
        })
      : [blankQuestion()];
    builderErrorEl.hidden = true;
    renderBuilderQuestions();
    window.napSetTab("form-builder", "forms");
  }

  if (newFormBtn) {
    newFormBtn.addEventListener("click", function () {
      openBuilderPage(null);
    });
  }

  if (builderBackBtn) {
    builderBackBtn.addEventListener("click", function () {
      window.napSetTab("forms");
    });
  }

  builderAddQuestionBtn.addEventListener("click", function () {
    builderQuestions.push(blankQuestion());
    renderBuilderQuestions();
  });

  builderQuestionsEl.addEventListener("input", function (e) {
    var row = e.target.closest("[data-q-index]");
    if (!row) return;
    var idx = Number(row.getAttribute("data-q-index"));
    var q = builderQuestions[idx];
    if (!q) return;

    if (e.target.hasAttribute("data-q-label")) {
      q.label = e.target.value;
      return;
    }
    if (e.target.hasAttribute("data-q-option")) {
      var oi = Number(e.target.getAttribute("data-opt-index"));
      q.options[oi] = e.target.value;
    }
  });

  builderQuestionsEl.addEventListener("change", function (e) {
    var row = e.target.closest("[data-q-index]");
    if (!row) return;
    var idx = Number(row.getAttribute("data-q-index"));
    var q = builderQuestions[idx];
    if (!q) return;

    if (e.target.hasAttribute("data-q-required")) {
      q.required = e.target.checked;
      return;
    }
    if (e.target.hasAttribute("data-q-type")) {
      q.type = e.target.value;
      if (CHOICE_TYPES.indexOf(q.type) !== -1 && !q.options.length) {
        q.options = ["", ""];
      }
      renderBuilderQuestions();
    }
  });

  builderQuestionsEl.addEventListener("click", function (e) {
    var row = e.target.closest("[data-q-index]");
    if (!row) return;
    var idx = Number(row.getAttribute("data-q-index"));

    if (e.target.closest("[data-q-remove]")) {
      builderQuestions.splice(idx, 1);
      renderBuilderQuestions();
      return;
    }
    if (e.target.closest("[data-q-add-option]")) {
      builderQuestions[idx].options.push("");
      renderBuilderQuestions();
      return;
    }
    var removeOptBtn = e.target.closest("[data-q-remove-option]");
    if (removeOptBtn) {
      var oi = Number(removeOptBtn.getAttribute("data-opt-index"));
      builderQuestions[idx].options.splice(oi, 1);
      renderBuilderQuestions();
      return;
    }
    if (e.target.closest("[data-q-move-up]")) {
      if (idx > 0) {
        var tmp = builderQuestions[idx - 1];
        builderQuestions[idx - 1] = builderQuestions[idx];
        builderQuestions[idx] = tmp;
        renderBuilderQuestions();
      }
    }
  });

  builderForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var title = builderForm.querySelector('[name="title"]').value.trim();
    var description = builderForm.querySelector('[name="description"]').value.trim();

    if (!title) {
      builderErrorEl.textContent = "Give your form a title.";
      builderErrorEl.hidden = false;
      return;
    }

    var cleanedQuestions = builderQuestions
      .map(function (q) {
        return {
          id: q.id,
          type: q.type,
          label: q.label.trim(),
          required: !!q.required,
          options: CHOICE_TYPES.indexOf(q.type) !== -1 ? q.options.map(function (o) { return o.trim(); }).filter(Boolean) : [],
        };
      })
      .filter(function (q) {
        return q.label;
      });

    if (!cleanedQuestions.length) {
      builderErrorEl.textContent = "Add at least one question with a label.";
      builderErrorEl.hidden = false;
      return;
    }

    var invalidChoice = cleanedQuestions.find(function (q) {
      return CHOICE_TYPES.indexOf(q.type) !== -1 && q.options.length < 2;
    });
    if (invalidChoice) {
      builderErrorEl.textContent = 'Question "' + invalidChoice.label + '" needs at least 2 options.';
      builderErrorEl.hidden = false;
      return;
    }

    builderErrorEl.hidden = true;

    var payload = {
      title: title,
      description: description,
      bannerImage: builderBannerImage,
      questions: cleanedQuestions,
      published: builderPublished,
      requireSignIn: builderRequireSignIn,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    var isEdit = !!currentEditFormId;
    var writePromise;
    window.napSaveButtonStart(builderSubmitBtn, isEdit ? "Saving…" : "Creating…");

    if (isEdit) {
      writePromise = db.collection("forms").doc(currentEditFormId).update(payload);
    } else {
      payload.createdByUid = currentUid;
      payload.createdByName = window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother");
      payload.collaboratorUids = [];
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      writePromise = db.collection("forms").add(payload);
    }

    writePromise
      .then(function () {
        window.napSaveButtonDone(builderSubmitBtn, { savedLabel: "Saved" });
        window.setTimeout(function () {
          window.napSetTab("forms");
        }, 550);
      })
      .catch(function () {
        window.napSaveButtonDone(builderSubmitBtn, { error: true });
        builderErrorEl.textContent = "Something went wrong. Please try again.";
        builderErrorEl.hidden = false;
      });
  });

  /* ---------- Share modal (public link + collaborators) ---------- */
  var shareModal = document.getElementById("modal-form-share");
  var shareLinkInput = document.getElementById("formSharePublicLink");
  var shareCopyBtn = document.getElementById("formShareCopyBtn");
  var shareCollabListEl = document.getElementById("formShareCollabList");
  var shareCollabSelect = document.getElementById("formShareCollabSelect");
  var shareAddCollabBtn = document.getElementById("formShareAddCollabBtn");

  var shareModalFormId = null;

  function openShareModal(formId) {
    shareModalFormId = formId;
    renderShareModal();
    shareModal.showModal();
  }

  function renderShareModal() {
    var form = findForm(shareModalFormId);
    if (!form) {
      shareModal.close();
      return;
    }

    shareLinkInput.value = publicLinkFor(form.id);

    var collaboratorUids = form.collaboratorUids || [];
    if (!collaboratorUids.length) {
      shareCollabListEl.innerHTML = '<p class="news-card__empty">No collaborators yet.</p>';
    } else {
      shareCollabListEl.innerHTML = collaboratorUids
        .map(function (uid) {
          var brother = window.napGetBrotherByUid(uid);
          var name = (brother && window.napDisplayName(brother, "")) || "A brother";
          return (
            '<div class="form-share__collab-row">' +
            '<span>' + escapeHtml(name) + "</span>" +
            '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-collab-remove="' + escapeHtml(uid) + '">Remove</button>' +
            "</div>"
          );
        })
        .join("");
    }

    var available = (window.NAP_ALL_BROTHERS || []).filter(function (b) {
      return b.uid !== form.createdByUid && collaboratorUids.indexOf(b.uid) === -1;
    });
    if (!available.length) {
      shareCollabSelect.innerHTML = '<option value="">No more brothers to add</option>';
      shareCollabSelect.disabled = true;
      shareAddCollabBtn.disabled = true;
    } else {
      shareCollabSelect.disabled = false;
      shareAddCollabBtn.disabled = false;
      /* Explicit empty placeholder, always first and selected by default —
         without this the <select> auto-selects whichever brother happens to
         be first in the list, so clicking "Add" without deliberately
         choosing someone would silently share with the wrong person. */
      shareCollabSelect.innerHTML =
        '<option value="">Choose a brother…</option>' +
        available
          .map(function (b) {
            return '<option value="' + escapeHtml(b.uid) + '">' + escapeHtml(window.napDisplayName(b, "Brother")) + "</option>";
          })
          .join("");
    }
  }

  shareCopyBtn.addEventListener("click", function () {
    shareLinkInput.select();
    navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(shareLinkInput.value).then(showCopied, showCopied)
      : (document.execCommand("copy"), showCopied());

    function showCopied() {
      var original = shareCopyBtn.textContent;
      shareCopyBtn.textContent = "Copied!";
      window.setTimeout(function () {
        shareCopyBtn.textContent = original;
      }, 1300);
    }
  });

  shareAddCollabBtn.addEventListener("click", function () {
    var uid = shareCollabSelect.value;
    if (!uid || !shareModalFormId) return;
    var form = findForm(shareModalFormId);
    db.collection("forms")
      .doc(shareModalFormId)
      .update({
        collaboratorUids: firebase.firestore.FieldValue.arrayUnion(uid),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .then(function () {
        if (window.napNotifyFormShared) {
          window.napNotifyFormShared({ recipientUid: uid, formId: shareModalFormId, formTitle: form ? form.title : "" });
        }
      })
      .catch(function () {
        window.alert("Couldn't add that collaborator. Please try again.");
      });
  });

  shareCollabListEl.addEventListener("click", function (e) {
    var removeBtn = e.target.closest("[data-collab-remove]");
    if (!removeBtn || !shareModalFormId) return;
    db.collection("forms")
      .doc(shareModalFormId)
      .update({
        collaboratorUids: firebase.firestore.FieldValue.arrayRemove(removeBtn.getAttribute("data-collab-remove")),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
  });

  shareModal.addEventListener("close", function () {
    shareModalFormId = null;
  });

  /* ---------- Responses page: sidebar list + single-response detail ---------- */
  var responsesPageTitleEl = document.getElementById("formResponsesPageTitle");
  var responsesPageCountEl = document.getElementById("formResponsesPageCount");
  var responsesBackBtn = document.getElementById("formResponsesBackBtn");
  var responsesSidebarEl = document.getElementById("formResponsesSidebar");
  var responsesDetailEl = document.getElementById("formResponsesDetail");

  var responsesPageFormId = null;
  var responsesUnsub = null;
  var currentResponses = [];
  var selectedResponseId = null;

  var exportCsvBtn = document.getElementById("formResponsesExportCsvBtn");
  var exportPdfBtn = document.getElementById("formResponsesExportPdfBtn");

  function safeFileName(title) {
    return (title || "form-responses").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "form-responses";
  }

  function answerPlainText(answer) {
    if (answer === undefined || answer === null || answer === "") return "";
    return Array.isArray(answer) ? answer.join(", ") : String(answer);
  }

  /* CSV: one row per response, one column per question, built and downloaded
     entirely client-side — no server, no external library. */
  function csvCell(value) {
    var str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) str = '"' + str.replace(/"/g, '""') + '"';
    return str;
  }

  function exportResponsesCsv() {
    var form = findForm(responsesPageFormId);
    if (!form || !currentResponses.length) return;

    var questions = form.questions || [];
    var lines = [["Submitted At"].concat(questions.map(function (q) { return q.label; })).map(csvCell).join(",")];

    currentResponses.forEach(function (r) {
      var cells = [formatResponseTime(r.submittedAt)];
      questions.forEach(function (q) {
        cells.push(answerPlainText(r.answers ? r.answers[q.id] : undefined));
      });
      lines.push(cells.map(csvCell).join(","));
    });

    /* Leading BOM so Excel opens the UTF-8 file without mangling non-ASCII names. */
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = safeFileName(form.title) + "-responses.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* PDF: rendered as a plain HTML page in a new tab, then handed to the
     browser's own print dialog ("Save as PDF") — no PDF library to load,
     and pagination across many responses/questions is the browser's problem,
     not hand-rolled layout math. */
  function exportResponsesPdf() {
    var form = findForm(responsesPageFormId);
    if (!form || !currentResponses.length) return;

    var questions = form.questions || [];
    var win = window.open("", "_blank");
    if (!win) {
      window.alert("Please allow pop-ups for this site to export as PDF.");
      return;
    }

    var html =
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + escapeHtml(form.title || "Form Responses") + "</title><style>" +
      "body{font-family:Arial,Helvetica,sans-serif;color:#222;max-width:800px;margin:0 auto;padding:2rem;}" +
      "h1{font-size:1.4rem;margin:0 0 0.25rem;}" +
      ".meta{color:#666;font-size:0.85rem;margin:0 0 2rem;}" +
      ".response{border-bottom:1px solid #ddd;padding-bottom:1rem;margin-bottom:1.5rem;page-break-inside:avoid;}" +
      ".response h2{font-size:0.95rem;color:#4c1e29;margin:0 0 0.75rem;}" +
      ".qa{margin-bottom:0.6rem;}" +
      ".qa .q{font-weight:600;font-size:0.85rem;margin:0 0 0.15rem;}" +
      ".qa .a{margin:0;font-size:0.9rem;white-space:pre-wrap;}" +
      "@media print{body{padding:0;}}" +
      "</style></head><body>";
    html += "<h1>" + escapeHtml(form.title || "Untitled form") + "</h1>";
    html += '<p class="meta">' + currentResponses.length + " response" + (currentResponses.length === 1 ? "" : "s") + " &middot; exported " + escapeHtml(new Date().toLocaleString()) + "</p>";

    currentResponses.forEach(function (r, i) {
      html += '<div class="response"><h2>Response ' + (i + 1) + " &middot; " + escapeHtml(formatResponseTime(r.submittedAt)) + "</h2>";
      questions.forEach(function (q) {
        var text = answerPlainText(r.answers ? r.answers[q.id] : undefined);
        html += '<div class="qa"><p class="q">' + escapeHtml(q.label) + '</p><p class="a">' + escapeHtml(text || "—") + "</p></div>";
      });
      html += "</div>";
    });

    html += "</body></html>";

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    /* Give the new tab a beat to actually paint before the print dialog steals focus. */
    win.setTimeout(function () {
      win.print();
    }, 300);
  }

  if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportResponsesCsv);
  if (exportPdfBtn) exportPdfBtn.addEventListener("click", exportResponsesPdf);

  function answerText(answer) {
    if (answer === undefined || answer === null || answer === "") return "—";
    if (Array.isArray(answer)) return answer.length ? escapeHtml(answer.join(", ")) : "—";
    return escapeHtml(String(answer));
  }

  function formatResponseTime(timestamp) {
    if (!timestamp || !timestamp.toDate) return "";
    return timestamp.toDate().toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function selectedResponseIndex() {
    return currentResponses.findIndex(function (r) {
      return r.id === selectedResponseId;
    });
  }

  function renderResponsesSidebar() {
    if (!currentResponses.length) {
      responsesSidebarEl.innerHTML = "";
      return;
    }
    responsesSidebarEl.innerHTML = currentResponses
      .map(function (r, i) {
        return (
          '<button class="form-responses-sidebar__item' + (r.id === selectedResponseId ? " is-active" : "") + '" type="button" data-response-id="' + r.id + '">' +
          '<span class="form-responses-sidebar__item-index">Response ' + (i + 1) + "</span>" +
          '<span class="form-responses-sidebar__item-time">' + formatResponseTime(r.submittedAt) + "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderResponsesDetail() {
    var form = findForm(responsesPageFormId);
    if (!form) return;

    if (!currentResponses.length) {
      responsesDetailEl.innerHTML = '<p class="news-card__empty">No responses yet.</p>';
      return;
    }

    var idx = selectedResponseIndex();
    if (idx === -1) idx = 0;
    var r = currentResponses[idx];

    var qaHtml = (form.questions || [])
      .map(function (q) {
        return (
          '<div class="form-response-detail__qa">' +
          '<p class="form-response-detail__q">' + escapeHtml(q.label) + "</p>" +
          '<p class="form-response-detail__a">' + answerText(r.answers ? r.answers[q.id] : undefined) + "</p>" +
          "</div>"
        );
      })
      .join("");

    responsesDetailEl.innerHTML =
      '<div class="form-responses-detail__nav">' +
      '<span class="form-responses-detail__position">Response ' + (idx + 1) + " of " + currentResponses.length + " · " + formatResponseTime(r.submittedAt) + "</span>" +
      '<div class="form-responses-detail__nav-btns">' +
      '<button class="news-card__action-btn" type="button" id="formResponsesPrevBtn"' + (idx === 0 ? " disabled" : "") + ">&larr; Previous</button>" +
      '<button class="news-card__action-btn" type="button" id="formResponsesNextBtn"' + (idx === currentResponses.length - 1 ? " disabled" : "") + ">Next &rarr;</button>" +
      "</div>" +
      "</div>" +
      qaHtml;
  }

  function renderResponsesPage() {
    var form = findForm(responsesPageFormId);
    if (!form) {
      window.napSetTab("forms");
      return;
    }

    responsesPageTitleEl.textContent = form.title || "Responses";
    responsesPageCountEl.textContent = currentResponses.length + " response" + (currentResponses.length === 1 ? "" : "s");
    if (exportCsvBtn) exportCsvBtn.disabled = !currentResponses.length;
    if (exportPdfBtn) exportPdfBtn.disabled = !currentResponses.length;

    if (currentResponses.length && selectedResponseIndex() === -1) {
      selectedResponseId = currentResponses[0].id;
    }

    renderResponsesSidebar();
    renderResponsesDetail();
  }

  function openResponsesPage(formId) {
    if (responsesUnsub) {
      responsesUnsub();
      responsesUnsub = null;
    }
    responsesPageFormId = formId;
    currentResponses = [];
    selectedResponseId = null;
    renderResponsesPage();
    window.napSetTab("form-responses", "forms");

    responsesUnsub = db
      .collection("forms")
      .doc(formId)
      .collection("responses")
      .orderBy("submittedAt", "desc")
      .onSnapshot(function (snap) {
        currentResponses = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderResponsesPage();
      });
  }

  function closeResponsesPage() {
    if (responsesUnsub) {
      responsesUnsub();
      responsesUnsub = null;
    }
    responsesPageFormId = null;
    currentResponses = [];
    selectedResponseId = null;
  }

  /* Redirect target for the "a form was shared with you" notification. */
  window.napOpenFormResponses = function (formId) {
    openResponsesPage(formId);
  };

  if (responsesBackBtn) {
    responsesBackBtn.addEventListener("click", function () {
      closeResponsesPage();
      window.napSetTab("forms");
    });
  }

  /* Unlike the old modal, this page doesn't block the sidebar — a brother can
     click straight to another tab without hitting "Back to Forms" first, so
     detach the live responses listener on any sidebar nav click too. */
  document.querySelectorAll(".portal-shell__nav-btn").forEach(function (btn) {
    btn.addEventListener("click", closeResponsesPage);
  });

  responsesSidebarEl.addEventListener("click", function (e) {
    var item = e.target.closest("[data-response-id]");
    if (!item) return;
    selectedResponseId = item.getAttribute("data-response-id");
    renderResponsesSidebar();
    renderResponsesDetail();
  });

  responsesDetailEl.addEventListener("click", function (e) {
    var idx = selectedResponseIndex();
    if (idx === -1) idx = 0;

    if (e.target.closest("#formResponsesPrevBtn") && idx > 0) {
      selectedResponseId = currentResponses[idx - 1].id;
      renderResponsesSidebar();
      renderResponsesDetail();
      return;
    }
    if (e.target.closest("#formResponsesNextBtn") && idx < currentResponses.length - 1) {
      selectedResponseId = currentResponses[idx + 1].id;
      renderResponsesSidebar();
      renderResponsesDetail();
    }
  });

  /* ---------- Live form lists ---------- */
  var started = false;
  function startFormsListeners() {
    db.collection("forms")
      .where("createdByUid", "==", currentUid)
      .onSnapshot(
        function (snap) {
          myForms = snap.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
          });
          renderFormsLists();
        },
        function () {
          myListEl.innerHTML = '<p class="news-card__empty">Couldn’t load your forms — the site’s database permissions may need to be republished.</p>';
        }
      );

    db.collection("forms")
      .where("collaboratorUids", "array-contains", currentUid)
      .onSnapshot(
        function (snap) {
          sharedForms = snap.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
          });
          renderFormsLists();
        },
        function () {
          sharedListEl.innerHTML = '<p class="news-card__empty">Couldn’t load forms shared with you — the site’s database permissions may need to be republished.</p>';
        }
      );
  }
})();
