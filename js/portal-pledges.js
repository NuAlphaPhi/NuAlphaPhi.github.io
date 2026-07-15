/* Pledges tab: pledge classes (chapter/term/year/pledge masters/warden) and
   the pledge profiles within each one. Every brother can read all of this;
   only admins can create or edit anything (enforced in firestore.rules, not
   just here). Pledge editing reuses the same in-place view/edit-in-modal
   pattern as the Directory's brother profiles. */
(function () {
  "use strict";

  var classGridEl = document.getElementById("pledgeClassGrid");
  if (!classGridEl) return;

  var newClassBtn = document.getElementById("newPledgeClassBtn");

  var currentUid = null;
  var allClasses = [];
  var started = false;

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function isAdmin() {
    return !!(window.napIsAdmin && window.napIsAdmin());
  }

  function findClass(id) {
    return allClasses.find(function (c) {
      return c.id === id;
    });
  }

  window.napOnAuthReady(function (detail) {
    currentUid = detail.uid;
    if (!started) {
      started = true;
      startPledgeClassesListener();
    }
  });

  function startPledgeClassesListener() {
    db.collection("pledgeClasses").onSnapshot(
      function (snap) {
        allClasses = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderClassGrid();
        if (currentClassId) renderClassDetail();
      },
      function () {
        /* Most likely cause: firestore.rules was updated locally to add the
           pledgeClasses collection but hasn't been published in the Firebase
           console yet, so every read here is denied — including the button
           visibility, which only ever gets set inside the callback above. */
        classGridEl.innerHTML = '<p class="news-card__empty">Couldn’t load pledge classes — the site’s database permissions may need to be republished.</p>';
      }
    );
  }

  /* ---------- Pledge class grid (main Pledges tab) ---------- */
  function classCardHtml(cls, admin) {
    var html = '<article class="forms-card" data-class-id="' + cls.id + '">';
    html +=
      '<div class="forms-card__header">' +
      '<h3 class="forms-card__title">' + escapeHtml(cls.className) + "</h3>" +
      '<span class="forms-card__badge is-published">' + escapeHtml(cls.chapter) + "</span>" +
      "</div>";
    html += '<p class="forms-card__meta">' + escapeHtml(cls.term) + " " + escapeHtml(cls.year) + "</p>";
    html += '<div class="forms-card__actions">';
    html += '<button class="news-card__action-btn" type="button" data-class-open="' + cls.id + '">View Pledges</button>';
    if (admin) {
      html +=
        '<button class="news-card__action-btn" type="button" data-class-edit="' + cls.id + '">Edit</button>' +
        '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-class-delete="' + cls.id + '">Delete</button>';
    }
    html += "</div></article>";
    return html;
  }

  function renderClassGrid() {
    var admin = isAdmin();
    if (newClassBtn) newClassBtn.hidden = !admin;

    if (!allClasses.length) {
      classGridEl.innerHTML = '<p class="news-card__empty">No pledge classes yet.</p>';
      return;
    }

    var sorted = allClasses.slice().sort(function (a, b) {
      return (b.year || 0) - (a.year || 0) || (a.className || "").localeCompare(b.className || "");
    });
    classGridEl.innerHTML = sorted
      .map(function (cls) {
        return classCardHtml(cls, admin);
      })
      .join("");
  }

  classGridEl.addEventListener("click", function (e) {
    var openBtn = e.target.closest("[data-class-open]");
    var editBtn = e.target.closest("[data-class-edit]");
    var deleteBtn = e.target.closest("[data-class-delete]");

    if (openBtn) {
      openClassDetail(openBtn.getAttribute("data-class-open"));
      return;
    }
    if (editBtn) {
      var cls = findClass(editBtn.getAttribute("data-class-edit"));
      if (cls) openClassModal(cls);
      return;
    }
    if (deleteBtn) {
      var classId = deleteBtn.getAttribute("data-class-delete");
      window.napConfirm("This also removes every pledge profile in this class. This can't be undone.", { title: "Delete this pledge class?" }).then(function (confirmed) {
        if (confirmed) deleteClassCascade(classId);
      });
    }
  });

  function deleteClassCascade(classId) {
    var classRef = db.collection("pledgeClasses").doc(classId);
    classRef
      .collection("pledges")
      .get()
      .then(function (snap) {
        var batch = db.batch();
        snap.forEach(function (doc) {
          batch.delete(doc.ref);
        });
        batch.delete(classRef);
        return batch.commit();
      })
      .then(function () {
        if (currentClassId === classId) {
          closeClassDetail();
          window.napSetTab("pledges");
        }
      })
      .catch(function () {
        window.alert("Couldn't delete this pledge class. Please try again.");
      });
  }

  /* ---------- Pledge class create/edit modal ---------- */
  var classModal = document.getElementById("modal-pledge-class-form");
  var classModalTitleEl = document.getElementById("modal-pledge-class-title");
  var classForm = document.getElementById("pledgeClassForm");
  var classSubmitBtn = classForm.querySelector('button[type="submit"]');
  var classFormErrorEl = document.getElementById("pledge-class-form-error");
  var classChapterSelect = document.getElementById("pledge-class-chapter");
  var pledgeMastersRowsEl = document.getElementById("pledgeMastersRows");
  var addPledgeMasterBtn = document.getElementById("addPledgeMasterBtn");

  window.NAP_CHAPTERS.forEach(function (chapter) {
    var opt = document.createElement("option");
    opt.value = chapter;
    opt.textContent = chapter;
    classChapterSelect.appendChild(opt);
  });

  var currentEditClassId = null;
  var pledgeMasterRows = [];

  function renderPledgeMasterRows() {
    pledgeMastersRowsEl.innerHTML = pledgeMasterRows
      .map(function (row, i) {
        return (
          '<div class="form-builder__option-row" data-master-index="' + i + '">' +
          '<input class="form-input" data-master-name placeholder="Pledge Master Name" value="' + escapeHtml(row.name) + '">' +
          '<input class="form-input" data-master-pledgename placeholder="Pledge Master Pledge Name" value="' + escapeHtml(row.pledgeName) + '">' +
          (pledgeMasterRows.length > 1
            ? '<button class="form-builder__option-remove" type="button" data-remove-master aria-label="Remove pledge master">&times;</button>'
            : "") +
          "</div>"
        );
      })
      .join("");
  }

  pledgeMastersRowsEl.addEventListener("input", function (e) {
    var row = e.target.closest("[data-master-index]");
    if (!row) return;
    var idx = Number(row.getAttribute("data-master-index"));
    if (!pledgeMasterRows[idx]) return;
    if (e.target.hasAttribute("data-master-name")) pledgeMasterRows[idx].name = e.target.value;
    if (e.target.hasAttribute("data-master-pledgename")) pledgeMasterRows[idx].pledgeName = e.target.value;
  });

  pledgeMastersRowsEl.addEventListener("click", function (e) {
    var removeBtn = e.target.closest("[data-remove-master]");
    if (!removeBtn) return;
    var row = removeBtn.closest("[data-master-index]");
    var idx = Number(row.getAttribute("data-master-index"));
    pledgeMasterRows.splice(idx, 1);
    renderPledgeMasterRows();
  });

  addPledgeMasterBtn.addEventListener("click", function () {
    pledgeMasterRows.push({ name: "", pledgeName: "" });
    renderPledgeMasterRows();
  });

  function openClassModal(cls) {
    currentEditClassId = cls ? cls.id : null;
    classModalTitleEl.textContent = cls ? "Edit Pledge Class" : "New Pledge Class";
    classSubmitBtn.textContent = cls ? "Save Changes" : "Save Pledge Class";
    classForm.querySelector('[name="chapter"]').value = cls ? cls.chapter : "";
    classForm.querySelector('[name="className"]').value = cls ? cls.className : "";
    classForm.querySelector('[name="term"]').value = cls ? cls.term : "";
    classForm.querySelector('[name="year"]').value = cls ? cls.year : "";
    classForm.querySelector('[name="pledgeWardenName"]').value = (cls && cls.pledgeWarden && cls.pledgeWarden.name) || "";
    classForm.querySelector('[name="pledgeWardenPledgeName"]').value = (cls && cls.pledgeWarden && cls.pledgeWarden.pledgeName) || "";

    pledgeMasterRows =
      cls && cls.pledgeMasters && cls.pledgeMasters.length
        ? cls.pledgeMasters.map(function (m) {
            return { name: m.name || "", pledgeName: m.pledgeName || "" };
          })
        : [
            { name: "", pledgeName: "" },
            { name: "", pledgeName: "" },
          ];
    renderPledgeMasterRows();

    classFormErrorEl.hidden = true;
    classModal.showModal();
  }

  if (newClassBtn) {
    newClassBtn.addEventListener("click", function () {
      openClassModal(null);
    });
  }

  classForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var chapter = classForm.querySelector('[name="chapter"]').value;
    var className = classForm.querySelector('[name="className"]').value.trim();
    var term = classForm.querySelector('[name="term"]').value;
    var year = classForm.querySelector('[name="year"]').value;
    var wardenName = classForm.querySelector('[name="pledgeWardenName"]').value.trim();
    var wardenPledgeName = classForm.querySelector('[name="pledgeWardenPledgeName"]').value.trim();

    if (!chapter || !className || !term || !year) {
      classFormErrorEl.textContent = "Fill out chapter, class name, term, and year.";
      classFormErrorEl.hidden = false;
      return;
    }

    var cleanedMasters = pledgeMasterRows
      .map(function (m) {
        return { name: m.name.trim(), pledgeName: m.pledgeName.trim() };
      })
      .filter(function (m) {
        return m.name;
      });

    if (!cleanedMasters.length) {
      classFormErrorEl.textContent = "Add at least one pledge master.";
      classFormErrorEl.hidden = false;
      return;
    }

    if (!wardenName) {
      classFormErrorEl.textContent = "Enter the pledge warden's name.";
      classFormErrorEl.hidden = false;
      return;
    }

    classFormErrorEl.hidden = true;

    var payload = {
      chapter: chapter,
      className: className,
      term: term,
      year: Number(year),
      pledgeMasters: cleanedMasters,
      pledgeWarden: { name: wardenName, pledgeName: wardenPledgeName },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    var isEdit = !!currentEditClassId;
    window.napSaveButtonStart(classSubmitBtn, isEdit ? "Saving…" : "Creating…");

    var writePromise;
    if (isEdit) {
      writePromise = db.collection("pledgeClasses").doc(currentEditClassId).update(payload);
    } else {
      payload.createdByUid = currentUid;
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      writePromise = db.collection("pledgeClasses").add(payload);
    }

    writePromise
      .then(function () {
        window.napSaveButtonDone(classSubmitBtn, { savedLabel: "Saved" });
        window.setTimeout(function () {
          classModal.close();
        }, 550);
      })
      .catch(function () {
        window.napSaveButtonDone(classSubmitBtn, { error: true });
        classFormErrorEl.textContent = "Something went wrong. Please try again.";
        classFormErrorEl.hidden = false;
      });
  });

  /* ---------- Pledge class detail page ---------- */
  var pledgeClassPageTitleEl = document.getElementById("pledgeClassPageTitle");
  var pledgeClassPageMetaEl = document.getElementById("pledgeClassPageMeta");
  var pledgeClassPageActionsEl = document.getElementById("pledgeClassPageActions");
  var pledgeClassInfoGridEl = document.getElementById("pledgeClassInfoGrid");
  var pledgeClassBackBtn = document.getElementById("pledgeClassBackBtn");
  var newPledgeBtn = document.getElementById("newPledgeBtn");
  var pledgeGridEl = document.getElementById("pledgeGrid");

  var currentClassId = null;
  var currentClassPledges = [];
  var pledgesUnsub = null;

  function openClassDetail(classId) {
    currentClassId = classId;
    currentClassPledges = [];
    renderClassDetail();
    window.napSetTab("pledge-class", "pledges");

    if (pledgesUnsub) {
      pledgesUnsub();
      pledgesUnsub = null;
    }
    pledgesUnsub = db
      .collection("pledgeClasses")
      .doc(classId)
      .collection("pledges")
      .onSnapshot(function (snap) {
        currentClassPledges = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderPledgeGrid();
      });
  }

  function closeClassDetail() {
    if (pledgesUnsub) {
      pledgesUnsub();
      pledgesUnsub = null;
    }
    currentClassId = null;
    currentClassPledges = [];
  }

  function renderClassDetail() {
    var cls = findClass(currentClassId);
    if (!cls) {
      window.napSetTab("pledges");
      return;
    }

    pledgeClassPageTitleEl.textContent = cls.className;
    pledgeClassPageMetaEl.textContent = cls.chapter + " · " + cls.term + " " + cls.year;

    var masters = (cls.pledgeMasters || [])
      .map(function (m) {
        return m.name + (m.pledgeName ? ' "' + m.pledgeName + '"' : "");
      })
      .join(", ");
    var warden = cls.pledgeWarden ? cls.pledgeWarden.name + (cls.pledgeWarden.pledgeName ? ' "' + cls.pledgeWarden.pledgeName + '"' : "") : "";

    var infoFields = [
      ["Chapter", cls.chapter],
      ["Term", cls.term + " " + cls.year],
      ["Pledge Master" + ((cls.pledgeMasters || []).length > 1 ? "s" : ""), masters],
      ["Pledge Warden", warden],
    ];

    pledgeClassInfoGridEl.innerHTML = infoFields
      .filter(function (f) {
        return f[1];
      })
      .map(function (f) {
        return (
          '<div class="profile-modal__field">' +
          '<p class="profile-modal__field-label">' + f[0] + "</p>" +
          '<p class="profile-modal__field-value">' + escapeHtml(f[1]) + "</p>" +
          "</div>"
        );
      })
      .join("");

    var admin = isAdmin();
    pledgeClassPageActionsEl.innerHTML = admin
      ? '<button class="news-card__action-btn" type="button" data-edit-class>Edit Class</button>' +
        '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-class>Delete Class</button>'
      : "";

    renderPledgeGrid();
  }

  pledgeClassPageActionsEl.addEventListener("click", function (e) {
    if (e.target.closest("[data-edit-class]")) {
      var cls = findClass(currentClassId);
      if (cls) openClassModal(cls);
      return;
    }
    if (e.target.closest("[data-delete-class]")) {
      var classId = currentClassId;
      window.napConfirm("This also removes every pledge profile in this class. This can't be undone.", { title: "Delete this pledge class?" }).then(function (confirmed) {
        if (confirmed) deleteClassCascade(classId);
      });
    }
  });

  if (pledgeClassBackBtn) {
    pledgeClassBackBtn.addEventListener("click", function () {
      closeClassDetail();
      window.napSetTab("pledges");
    });
  }

  /* Leaving the class detail page for any other tab detaches its live
     pledges listener, matching the Forms Responses page pattern. */
  document.querySelectorAll(".portal-shell__nav-btn").forEach(function (btn) {
    btn.addEventListener("click", closeClassDetail);
  });

  function renderPledgeGrid() {
    var admin = isAdmin();
    if (newPledgeBtn) newPledgeBtn.hidden = !admin;

    if (!currentClassPledges.length) {
      pledgeGridEl.innerHTML = '<p class="directory-empty">No pledges added yet.</p>';
      return;
    }

    var sorted = currentClassPledges.slice().sort(function (a, b) {
      return (a.name || "").localeCompare(b.name || "");
    });
    pledgeGridEl.innerHTML = sorted
      .map(function (p) {
        return (
          '<button class="bro-card" type="button" data-pledge-id="' + p.id + '">' +
          window.napAvatarHtml({ photoDataUrl: p.photoDataUrl, firstName: p.name }, "md") +
          "<span>" +
          '<p class="bro-card__name">' + escapeHtml(p.name || "Unnamed") + "</p>" +
          '<p class="bro-card__meta">' + [escapeHtml(p.pledgeName), escapeHtml(p.school)].filter(Boolean).join(" · ") + "</p>" +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  pledgeGridEl.addEventListener("click", function (e) {
    var card = e.target.closest("[data-pledge-id]");
    if (!card) return;
    var pledge = currentClassPledges.find(function (p) {
      return p.id === card.getAttribute("data-pledge-id");
    });
    if (pledge) openPledgeProfile(pledge);
  });

  if (newPledgeBtn) {
    newPledgeBtn.addEventListener("click", function () {
      openPledgeProfile(null);
    });
  }

  /* ---------- Pledge profile modal: view + in-place edit ---------- */
  var pledgeModal = document.getElementById("modal-pledge-view");
  var pledgeModalAvatarEl = document.getElementById("pledgeModalAvatar");
  var pledgeModalNameEl = document.getElementById("pledge-modal-name");
  var pledgeModalPledgeNameEl = document.getElementById("pledge-modal-pledgename");
  var pledgeModalBioEl = document.getElementById("pledge-modal-bio");
  var pledgeModalGridEl = document.getElementById("pledge-modal-grid");
  var pledgeModalAdminActionsEl = document.getElementById("pledgeModalAdminActions");

  var pledgeEditForm = document.getElementById("pledgeModalEditForm");
  var pledgeEditFieldsEl = document.getElementById("pledgeModalEditFields");
  var pledgeEditPhotoPreviewEl = document.getElementById("pledgeModalEditPhotoPreview");
  var pledgeEditPhotoInputEl = document.getElementById("pledge-modal-edit-photo-input");
  var pledgeEditFeedbackEl = document.getElementById("pledgeModalEditFeedback");
  var pledgeEditCancelBtn = document.getElementById("pledgeModalEditCancelBtn");

  var currentViewPledgeId = null;
  var pendingPledgePhotoDataUrl = null;

  var PLEDGE_FIELD_SPECS = [
    { name: "name", label: "Name", type: "text" },
    { name: "age", label: "Age", type: "number" },
    { name: "school", label: "School", type: "text" },
    { name: "instagram", label: "Instagram", type: "text", placeholder: "@handle" },
    { name: "pledgeName", label: "Pledge Name", type: "text" },
    { name: "bigName", label: "Big Name", type: "text" },
    { name: "bigPledgeName", label: "Big Pledge Name", type: "text" },
    { name: "bio", label: "Bio", type: "textarea", full: true },
  ];
  var PLEDGE_NUMBER_FIELDS = ["age"];

  function pledgeFieldHtml(spec, rawValue) {
    var id = "pledge-edit-" + spec.name;
    var value = rawValue === null || rawValue === undefined ? "" : rawValue;
    var groupClass = "form-group" + (spec.full ? " form-group--full" : "");
    var html = '<div class="' + groupClass + '">';
    html += '<label class="form-label" for="' + id + '">' + spec.label + "</label>";
    if (spec.type === "textarea") {
      html +=
        '<textarea class="form-textarea" id="' + id + '" name="' + spec.name + '"' +
        (spec.placeholder ? ' placeholder="' + escapeHtml(spec.placeholder) + '"' : "") +
        ">" + escapeHtml(value) + "</textarea>";
    } else {
      html +=
        '<input class="form-input" id="' + id + '" name="' + spec.name + '" type="' + spec.type + '"' +
        (spec.placeholder ? ' placeholder="' + escapeHtml(spec.placeholder) + '"' : "") +
        ' value="' + escapeHtml(value) + '">';
    }
    html += "</div>";
    return html;
  }

  function showPledgeViewMode() {
    if (pledgeEditForm) pledgeEditForm.hidden = true;
    pledgeModalGridEl.hidden = false;
    if (pledgeModalAdminActionsEl) pledgeModalAdminActionsEl.hidden = false;
  }

  function renderPledgeView(p) {
    pledgeModalAvatarEl.innerHTML = window.napAvatarHtml({ photoDataUrl: p.photoDataUrl, firstName: p.name }, "xl");
    pledgeModalNameEl.textContent = p.name || "Unnamed Pledge";
    pledgeModalPledgeNameEl.textContent = p.pledgeName ? '"' + p.pledgeName + '"' : "";

    if (p.bio) {
      pledgeModalBioEl.textContent = p.bio;
      pledgeModalBioEl.hidden = false;
    } else {
      pledgeModalBioEl.hidden = true;
    }

    var fields = [
      ["Age", p.age],
      ["School", p.school],
      ["Instagram", p.instagram],
      ["Big", [p.bigName, p.bigPledgeName ? '"' + p.bigPledgeName + '"' : ""].filter(Boolean).join(" ")],
    ];

    pledgeModalGridEl.innerHTML = fields
      .filter(function (f) {
        return f[1];
      })
      .map(function (f) {
        return (
          '<div class="profile-modal__field">' +
          '<p class="profile-modal__field-label">' + f[0] + "</p>" +
          '<p class="profile-modal__field-value">' + escapeHtml(f[1]) + "</p>" +
          "</div>"
        );
      })
      .join("");

    pledgeModalAdminActionsEl.innerHTML = isAdmin()
      ? '<button class="news-card__action-btn" type="button" data-pledge-edit>Edit Info</button>' +
        '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-pledge-delete>Delete Pledge</button>'
      : "";
  }

  function openPledgeProfile(pledge) {
    if (pledge) {
      currentViewPledgeId = pledge.id;
      showPledgeViewMode();
      renderPledgeView(pledge);
      pledgeModal.showModal();
    } else {
      currentViewPledgeId = null;
      enterPledgeEditMode(null);
      pledgeModal.showModal();
    }
  }

  function enterPledgeEditMode(p) {
    p = p || {};
    pendingPledgePhotoDataUrl = null;
    if (pledgeEditFeedbackEl) pledgeEditFeedbackEl.hidden = true;
    if (pledgeEditPhotoPreviewEl) pledgeEditPhotoPreviewEl.innerHTML = window.napAvatarHtml({ photoDataUrl: p.photoDataUrl, firstName: p.name }, "lg");
    if (pledgeEditFieldsEl) {
      pledgeEditFieldsEl.innerHTML = PLEDGE_FIELD_SPECS.map(function (spec) {
        return pledgeFieldHtml(spec, p[spec.name]);
      }).join("");
    }

    pledgeModalGridEl.hidden = true;
    if (pledgeModalAdminActionsEl) pledgeModalAdminActionsEl.hidden = true;
    if (pledgeEditForm) pledgeEditForm.hidden = false;
  }

  function exitPledgeEditMode(p) {
    showPledgeViewMode();
    renderPledgeView(p);
  }

  if (pledgeEditPhotoInputEl) {
    pledgeEditPhotoInputEl.addEventListener("change", function () {
      var file = pledgeEditPhotoInputEl.files && pledgeEditPhotoInputEl.files[0];
      if (!file) return;
      window.napResizeImageToDataUrl(file, 300, function (dataUrl) {
        pendingPledgePhotoDataUrl = dataUrl;
        if (pledgeEditPhotoPreviewEl) pledgeEditPhotoPreviewEl.innerHTML = window.napAvatarHtml({ photoDataUrl: dataUrl }, "lg");
      });
    });
  }

  if (pledgeEditCancelBtn) {
    pledgeEditCancelBtn.addEventListener("click", function () {
      if (currentViewPledgeId) {
        var pledge = currentClassPledges.find(function (p) {
          return p.id === currentViewPledgeId;
        });
        if (pledge) exitPledgeEditMode(pledge);
      } else {
        pledgeModal.close();
      }
    });
  }

  if (pledgeEditForm) {
    pledgeEditForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!currentClassId) return;

      var update = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      PLEDGE_FIELD_SPECS.forEach(function (spec) {
        var el = pledgeEditForm.querySelector('[name="' + spec.name + '"]');
        if (!el) return;
        if (PLEDGE_NUMBER_FIELDS.indexOf(spec.name) !== -1) {
          update[spec.name] = el.value ? Number(el.value) : null;
        } else {
          update[spec.name] = el.value.trim();
        }
      });
      if (pendingPledgePhotoDataUrl !== null) {
        update.photoDataUrl = pendingPledgePhotoDataUrl;
      }

      if (!update.name) {
        if (pledgeEditFeedbackEl) {
          pledgeEditFeedbackEl.textContent = "Enter the pledge's name.";
          pledgeEditFeedbackEl.className = "form-feedback form-feedback--error";
          pledgeEditFeedbackEl.hidden = false;
        }
        return;
      }

      var submitBtn = pledgeEditForm.querySelector('button[type="submit"]');
      window.napSaveButtonStart(submitBtn, "Saving…");
      if (pledgeEditFeedbackEl) pledgeEditFeedbackEl.hidden = true;

      var isNew = !currentViewPledgeId;
      var pledgesRef = db.collection("pledgeClasses").doc(currentClassId).collection("pledges");
      var writePromise;
      if (isNew) {
        update.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        writePromise = pledgesRef.add(update);
      } else {
        writePromise = pledgesRef.doc(currentViewPledgeId).set(update, { merge: true });
      }

      writePromise
        .then(function (docRef) {
          pendingPledgePhotoDataUrl = null;
          window.napSaveButtonDone(submitBtn, { savedLabel: "Saved" });
          if (isNew) currentViewPledgeId = docRef.id;
          var existing = currentClassPledges.find(function (p) {
            return p.id === currentViewPledgeId;
          });
          exitPledgeEditMode(Object.assign({ id: currentViewPledgeId }, existing, update));
        })
        .catch(function () {
          window.napSaveButtonDone(submitBtn, { error: true });
          if (pledgeEditFeedbackEl) {
            pledgeEditFeedbackEl.textContent = "Something went wrong. Please try again.";
            pledgeEditFeedbackEl.className = "form-feedback form-feedback--error";
            pledgeEditFeedbackEl.hidden = false;
          }
        });
    });
  }

  if (pledgeModalAdminActionsEl) {
    pledgeModalAdminActionsEl.addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-pledge-edit]");
      var deleteBtn = e.target.closest("[data-pledge-delete]");

      if (editBtn) {
        var pledge = currentClassPledges.find(function (p) {
          return p.id === currentViewPledgeId;
        });
        if (pledge) enterPledgeEditMode(pledge);
        return;
      }

      if (deleteBtn) {
        var pledgeId = currentViewPledgeId;
        var toDelete = currentClassPledges.find(function (p) {
          return p.id === pledgeId;
        });
        var name = (toDelete && toDelete.name) || "this pledge";
        window.napConfirm("This can't be undone.", { title: "Delete " + name + "'s profile?", confirmLabel: "Delete" }).then(function (confirmed) {
          if (!confirmed) return;
          db.collection("pledgeClasses")
            .doc(currentClassId)
            .collection("pledges")
            .doc(pledgeId)
            .delete()
            .then(function () {
              pledgeModal.close();
            })
            .catch(function () {
              window.alert("Couldn't delete this pledge. Please try again.");
            });
        });
      }
    });
  }

  pledgeModal.addEventListener("close", function () {
    currentViewPledgeId = null;
    pendingPledgePhotoDataUrl = null;
    showPledgeViewMode();
  });
})();
