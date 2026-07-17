/* Brother directory: search, filter, profile view modal */
(function () {
  "use strict";

  var grid = document.getElementById("directoryGrid");
  if (!grid) return;

  var searchInput = document.getElementById("directorySearch");
  var chapterFilter = document.getElementById("directoryChapterFilter");
  var classFilter = document.getElementById("directoryClassFilter");
  var modal = document.getElementById("modal-profile-view");
  var modalAvatar = document.getElementById("profileModalAvatar");
  var modalName = document.getElementById("profile-modal-name");
  var modalPledge = document.getElementById("profile-modal-pledge");
  var modalBio = document.getElementById("profile-modal-bio");
  var modalGrid = document.getElementById("profile-modal-grid");
  var modalAdminActions = document.getElementById("profileModalAdminActions");

  var editForm = document.getElementById("profileModalEditForm");
  var editFieldsEl = document.getElementById("profileModalEditFields");
  var editPhotoPreview = document.getElementById("profileModalEditPhotoPreview");
  var editPhotoInput = document.getElementById("profile-modal-edit-photo-input");
  var editFeedback = document.getElementById("profileModalEditFeedback");
  var editCancelBtn = document.getElementById("profileModalEditCancelBtn");

  var allBrothers = [];
  var currentViewUid = null;
  var pendingEditPhotoDataUrl = null;

  /* Same field set as the My Information form (portal-settings.js) — an
     admin editing a brother's info in-place gets the same fields, just
     rendered dynamically here instead of duplicated in the HTML. */
  var EDIT_FIELD_SPECS = [
    { name: "firstName", label: "First Name", type: "text" },
    { name: "lastName", label: "Last Name", type: "text" },
    { name: "pledgeName", label: "Pledge Name", type: "text" },
    { name: "pledgeNumber", label: "Pledge Number", type: "text" },
    { name: "chapter", label: "Chapter", type: "select", options: window.NAP_CHAPTERS, placeholder: "Select a chapter" },
    { name: "pledgeClass", label: "Class", type: "text", placeholder: "e.g. Alpha Class" },
    { name: "semesterCrossed", label: "Semester Crossed", type: "select", options: ["Fall", "Spring", "Summer"], placeholder: "Select a semester" },
    { name: "yearCrossed", label: "Year Crossed", type: "number" },
    { name: "birthday", label: "Birthday", type: "date" },
    { name: "hometown", label: "Hometown", type: "text" },
    { name: "currentLocation", label: "Current Location", type: "text" },
    { name: "phone", label: "Phone Number", type: "tel" },
    { name: "occupation", label: "Occupation", type: "text" },
    { name: "school", label: "School", type: "text" },
    { name: "major", label: "Major", type: "text" },
    { name: "graduationYear", label: "Graduation Year", type: "number" },
    { name: "instagram", label: "Instagram", type: "text", placeholder: "@handle" },
    { name: "facebook", label: "Facebook", type: "text" },
    { name: "linkedin", label: "LinkedIn", type: "text" },
    { name: "bigName", label: "Big's Name", type: "text" },
    { name: "bigPledgeName", label: "Big's Pledge Name", type: "text", full: true },
    { name: "bio", label: "Bio", type: "textarea", full: true, placeholder: "Tell other brothers a bit about yourself" },
  ];
  var EDIT_NUMBER_FIELDS = ["yearCrossed", "graduationYear"];

  window.NAP_CHAPTERS.forEach(function (chapter) {
    var opt = document.createElement("option");
    opt.value = chapter;
    opt.textContent = chapter;
    chapterFilter.appendChild(opt);
  });

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function formatBirthday(birthday) {
    if (!birthday) return "";
    var d = new Date(birthday + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }

  function populateClassFilter() {
    var classes = {};
    allBrothers.forEach(function (b) {
      if (b.pledgeClass) classes[b.pledgeClass] = true;
    });
    classFilter.innerHTML = '<option value="">All Classes</option>';
    Object.keys(classes)
      .sort()
      .forEach(function (cls) {
        var opt = document.createElement("option");
        opt.value = cls;
        opt.textContent = cls;
        classFilter.appendChild(opt);
      });
  }

  function matchesFilters(b) {
    var search = searchInput.value.trim().toLowerCase();
    var chapter = chapterFilter.value;
    var cls = classFilter.value;

    if (chapter && b.chapter !== chapter) return false;
    if (cls && b.pledgeClass !== cls) return false;

    if (search) {
      var fullName = (window.napFullName(b) || "").toLowerCase();
      var pledgeName = (b.pledgeName || "").toLowerCase();
      if (fullName.indexOf(search) === -1 && pledgeName.indexOf(search) === -1) return false;
    }

    return true;
  }

  function render() {
    var filtered = allBrothers.filter(matchesFilters);

    if (!filtered.length) {
      grid.innerHTML = '<p class="directory-empty">No brothers match your search.</p>';
      return;
    }

    grid.innerHTML = filtered
      .map(function (b) {
        return (
          '<button class="bro-card" type="button" data-uid="' + b.uid + '">' +
          window.napAvatarHtml(b, "md") +
          '<span>' +
          '<p class="bro-card__name">' + escapeHtml(window.napDisplayName(b, "Brother")) + "</p>" +
          '<p class="bro-card__meta">' + [escapeHtml(b.chapter), escapeHtml(b.pledgeClass)].filter(Boolean).join(" · ") + "</p>" +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderProfileView(b) {
    modalAvatar.innerHTML = window.napAvatarHtml(b, "xl");
    modalName.textContent = window.napFullName(b) || window.napDisplayName(b, "Brother");
    modalPledge.textContent = b.pledgeName ? '"' + b.pledgeName + '"' : "";

    if (b.bio) {
      modalBio.textContent = b.bio;
      modalBio.hidden = false;
    } else {
      modalBio.hidden = true;
    }

    var fields = [
      ["Pledge Number", b.pledgeNumber],
      ["Chapter", b.chapter],
      ["Class", b.pledgeClass],
      ["Crossed", window.napSemesterCrossed(b)],
      ["Birthday", formatBirthday(b.birthday)],
      ["Big", [b.bigName, b.bigPledgeName ? '"' + b.bigPledgeName + '"' : ""].filter(Boolean).join(" ")],
      ["Occupation", b.occupation],
      ["School", b.school],
      ["Major", b.major],
      ["Graduation Year", b.graduationYear],
      ["Hometown", b.hometown],
      ["Current Location", b.currentLocation],
      ["Phone", b.phone],
      ["Email", b.email],
      ["Instagram", b.instagram],
      ["Facebook", b.facebook],
      ["LinkedIn", b.linkedin],
    ];

    modalGrid.innerHTML = fields
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

    /* Admin-only controls on other brothers' profiles: edit their info, or
       remove their account (disables portal access — see portal-auth.js). */
    if (modalAdminActions) {
      var showAdminActions = window.napIsAdmin && window.napIsAdmin() && b.uid !== window.NAP_CURRENT_UID;
      modalAdminActions.innerHTML = showAdminActions
        ? '<button class="news-card__action-btn" type="button" data-admin-edit-profile="' + escapeHtml(b.uid) + '">Edit Info</button>' +
          '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-admin-remove-account="' + escapeHtml(b.uid) + '">Remove Account</button>'
        : "";
    }
  }

  function showViewMode() {
    if (editForm) editForm.hidden = true;
    modalGrid.hidden = false;
    if (modalAdminActions) modalAdminActions.hidden = false;
  }

  function openProfile(b) {
    currentViewUid = b.uid;
    showViewMode();
    renderProfileView(b);
    modal.showModal();
  }

  /* --- In-place edit mode: admin editing another brother's info directly
     in this same popup, instead of being sent to the My Information tab. --- */
  function editFieldHtml(spec, rawValue) {
    var id = "profile-edit-" + spec.name;
    var value = rawValue === null || rawValue === undefined ? "" : rawValue;
    var groupClass = "form-group" + (spec.full ? " form-group--full" : "");
    var html = '<div class="' + groupClass + '">';
    html += '<label class="form-label" for="' + id + '">' + spec.label + "</label>";

    if (spec.type === "select") {
      html += '<select class="form-select" id="' + id + '" name="' + spec.name + '">';
      html += '<option value="">' + escapeHtml(spec.placeholder || "") + "</option>";
      html += (spec.options || [])
        .map(function (opt) {
          return '<option value="' + escapeHtml(opt) + '"' + (opt === value ? " selected" : "") + ">" + escapeHtml(opt) + "</option>";
        })
        .join("");
      html += "</select>";
    } else if (spec.type === "textarea") {
      html +=
        '<textarea class="form-textarea" id="' + id + '" name="' + spec.name + '"' +
        (spec.placeholder ? ' placeholder="' + escapeHtml(spec.placeholder) + '"' : "") +
        ">" + escapeHtml(value) + "</textarea>";
    } else {
      html +=
        '<input class="form-input" id="' + id + '" name="' + spec.name + '" type="' + spec.type + '"' +
        (spec.placeholder ? ' placeholder="' + escapeHtml(spec.placeholder) + '"' : "") +
        (spec.type === "number" ? ' min="1900" max="2100"' : "") +
        ' value="' + escapeHtml(value) + '">';
    }

    html += "</div>";
    return html;
  }

  function enterEditMode(b) {
    pendingEditPhotoDataUrl = null;
    if (editFeedback) editFeedback.hidden = true;
    if (editPhotoPreview) editPhotoPreview.innerHTML = window.napAvatarHtml(b, "lg");
    if (editFieldsEl) {
      editFieldsEl.innerHTML = EDIT_FIELD_SPECS.map(function (spec) {
        return editFieldHtml(spec, b[spec.name]);
      }).join("");
    }

    modalGrid.hidden = true;
    if (modalAdminActions) modalAdminActions.hidden = true;
    if (editForm) editForm.hidden = false;
  }

  function exitEditMode(b) {
    showViewMode();
    renderProfileView(b);
  }

  if (editPhotoInput) {
    editPhotoInput.addEventListener("change", function () {
      var file = editPhotoInput.files && editPhotoInput.files[0];
      if (!file) return;
      window.napResizeImageToDataUrl(file, 300, function (dataUrl) {
        pendingEditPhotoDataUrl = dataUrl;
        if (editPhotoPreview) editPhotoPreview.innerHTML = window.napAvatarHtml({ photoDataUrl: dataUrl }, "lg");
      });
    });
  }

  if (editCancelBtn) {
    editCancelBtn.addEventListener("click", function () {
      var brother = window.napGetBrotherByUid(currentViewUid);
      if (brother) exitEditMode(brother);
    });
  }

  if (editForm) {
    editForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!currentViewUid) return;

      var update = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      EDIT_FIELD_SPECS.forEach(function (spec) {
        var el = editForm.querySelector('[name="' + spec.name + '"]');
        if (!el) return;
        if (EDIT_NUMBER_FIELDS.indexOf(spec.name) !== -1) {
          update[spec.name] = el.value ? Number(el.value) : null;
        } else {
          update[spec.name] = el.value;
        }
      });
      if (pendingEditPhotoDataUrl !== null) {
        update.photoDataUrl = pendingEditPhotoDataUrl;
      }

      var submitBtn = editForm.querySelector('button[type="submit"]');
      window.napSaveButtonStart(submitBtn, "Saving…");
      if (editFeedback) editFeedback.hidden = true;

      var targetUid = currentViewUid;
      db.collection("users")
        .doc(targetUid)
        .set(update, { merge: true })
        .then(function () {
          pendingEditPhotoDataUrl = null;
          window.napSaveButtonDone(submitBtn, { savedLabel: "Saved" });
          /* The live users listener (portal-auth.js) will catch up to this
             write in a moment, but merge it into a local copy right away so
             the read-only view reflects the edit instantly instead of
             waiting on that round trip. */
          var brother = window.napGetBrotherByUid(targetUid);
          exitEditMode(Object.assign({}, brother, update));
        })
        .catch(function () {
          window.napSaveButtonDone(submitBtn, { error: true });
          if (editFeedback) {
            editFeedback.textContent = "Something went wrong. Please try again.";
            editFeedback.className = "form-feedback form-feedback--error";
            editFeedback.hidden = false;
          }
        });
    });
  }

  if (modalAdminActions) {
    modalAdminActions.addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-admin-edit-profile]");
      var removeBtn = e.target.closest("[data-admin-remove-account]");

      if (editBtn) {
        var brother = window.napGetBrotherByUid(editBtn.getAttribute("data-admin-edit-profile"));
        if (brother) enterEditMode(brother);
        return;
      }

      if (removeBtn) {
        var removeUid = removeBtn.getAttribute("data-admin-remove-account");
        var toRemove = window.napGetBrotherByUid(removeUid);
        var name = (toRemove && window.napDisplayName(toRemove, "this brother")) || "this brother";
        window.napConfirm(
          "They'll be signed out and locked out of the portal, and hidden from the directory. An admin can restore access later from Firebase if needed.",
          { title: "Remove " + name + "'s account?", confirmLabel: "Remove" }
        ).then(function (confirmed) {
          if (!confirmed) return;
          db.collection("users")
            .doc(removeUid)
            .update({ disabled: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
            .then(function () {
              modal.close();
            })
            .catch(function () {
              window.alert("Couldn't remove this account. Please try again.");
            });
        });
      }
    });
  }

  /* Leaving the popup mid-edit (closing it, or clicking a different
     brother's card) should never silently keep the form pointed at whoever
     was being edited. */
  modal.addEventListener("close", function () {
    currentViewUid = null;
    pendingEditPhotoDataUrl = null;
    showViewMode();
  });

  grid.addEventListener("click", function (e) {
    var card = e.target.closest("[data-uid]");
    if (!card) return;
    var uid = card.getAttribute("data-uid");
    var brother = allBrothers.find(function (b) {
      return b.uid === uid;
    });
    if (brother) openProfile(brother);
  });

  searchInput.addEventListener("input", render);
  chapterFilter.addEventListener("change", render);
  classFilter.addEventListener("change", render);

  /* Shared with every other portal module: click anything with
     data-open-profile="<uid>" and it lands here. */
  window.napOpenProfileModal = function (uid) {
    var brother = window.napGetBrotherByUid(uid);
    if (brother) openProfile(brother);
  };

  function refreshFromCache() {
    allBrothers = window.NAP_ALL_BROTHERS;
    populateClassFilter();
    render();
  }

  window.napOnBrothersUpdated(refreshFromCache);
})();
