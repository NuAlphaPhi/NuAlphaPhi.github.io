/* Load + save the brother profile form (Settings tab of portal-home.html) */
(function () {
  "use strict";

  var form = document.getElementById("portalSettingsForm");
  var feedback = document.getElementById("settings-feedback");
  if (!form) return;

  var photoInput = document.getElementById("settings-photo-input");
  var photoPreview = document.getElementById("settingsPhotoPreview");
  var pendingPhotoDataUrl = null;

  var FIELDS = [
    "firstName",
    "lastName",
    "pledgeName",
    "pledgeNumber",
    "chapter",
    "pledgeClass",
    "semesterCrossed",
    "yearCrossed",
    "birthday",
    "instagram",
    "facebook",
    "linkedin",
    "bigName",
    "bigPledgeName",
    "occupation",
    "major",
    "graduationYear",
    "hometown",
    "currentLocation",
    "phone",
    "bio",
  ];

  var NUMBER_FIELDS = ["yearCrossed", "graduationYear"];

  function fieldEl(name) {
    return form.querySelector('[name="' + name + '"]');
  }

  function fillForm(profile) {
    FIELDS.forEach(function (name) {
      var el = fieldEl(name);
      if (!el) return;
      var value = profile[name];
      el.value = value === null || value === undefined ? "" : value;
    });
    if (photoPreview) photoPreview.innerHTML = window.napAvatarHtml(profile, "lg");
  }

  window.napOnAuthReady(function (detail) {
    fillForm(detail.profile || {});
  });

  if (photoInput) {
    photoInput.addEventListener("change", function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file) return;
      window.napResizeImageToDataUrl(file, 300, function (dataUrl) {
        pendingPhotoDataUrl = dataUrl;
        if (photoPreview) {
          photoPreview.innerHTML = window.napAvatarHtml({ photoDataUrl: dataUrl }, "lg");
        }
      });
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var update = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    FIELDS.forEach(function (name) {
      var el = fieldEl(name);
      if (!el) return;
      if (NUMBER_FIELDS.indexOf(name) !== -1) {
        update[name] = el.value ? Number(el.value) : null;
      } else {
        update[name] = el.value;
      }
    });

    var submitBtn = form.querySelector(".form-submit");
    window.napSaveButtonStart(submitBtn, "Saving…");
    if (feedback) feedback.hidden = true;

    update.uid = window.NAP_CURRENT_UID;
    update.email = auth.currentUser.email;
    if (pendingPhotoDataUrl !== null) {
      update.photoDataUrl = pendingPhotoDataUrl;
    }

    db.collection("users")
      .doc(window.NAP_CURRENT_UID)
      .set(update, { merge: true })
      .then(function () {
        pendingPhotoDataUrl = null;
        window.NAP_CURRENT_PROFILE = Object.assign({}, window.NAP_CURRENT_PROFILE, update);
        var pledgeNameLabel = document.getElementById("portalPledgeName");
        if (pledgeNameLabel) {
          pledgeNameLabel.textContent = window.napDisplayName(window.NAP_CURRENT_PROFILE, "");
        }
        var avatarEl = document.getElementById("portalUserAvatar");
        if (avatarEl) avatarEl.innerHTML = window.napAvatarHtml(window.NAP_CURRENT_PROFILE, "sm");
        if (window.napRefreshSettingsAccountSummary) window.napRefreshSettingsAccountSummary();
        if (feedback) {
          feedback.textContent = "Saved.";
          feedback.className = "form-feedback form-feedback--success";
          feedback.hidden = false;
        }
        window.napSaveButtonDone(submitBtn, { savedLabel: "Saved" });
      })
      .catch(function (err) {
        if (feedback) {
          feedback.textContent = err.message || "Something went wrong. Please try again.";
          feedback.className = "form-feedback form-feedback--error";
          feedback.hidden = false;
        }
        window.napSaveButtonDone(submitBtn, { error: true });
      });
  });
})();
