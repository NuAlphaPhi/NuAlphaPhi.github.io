/* Account settings: sub-tabs, account summary, password change + dark mode toggle (Settings tab of portal-home.html) */
(function () {
  "use strict";

  /* Account Security / Appearance sub-tabs */
  var settingsSubTabBtns = document.querySelectorAll("#settingsSubTabs [data-settings-tab]");
  var settingsPanels = document.querySelectorAll("[data-settings-panel]");

  function setSettingsTab(tab) {
    settingsSubTabBtns.forEach(function (btn) {
      var active = btn.getAttribute("data-settings-tab") === tab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    settingsPanels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-settings-panel") !== tab;
    });
    /* Re-check current admin/notification status right as each sub-tab opens,
       rather than trusting whatever rendered once back on initial page load —
       cheap, and guarantees this can never show stale state no matter how
       long ago auth actually resolved. */
    if (tab === "admin") refreshAdminPanel();
    if (tab === "notifications") refreshEmailToggle();
  }

  settingsSubTabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setSettingsTab(btn.getAttribute("data-settings-tab"));
    });
  });

  /* Account summary — name + email shown at the top of Account Security */
  var accountAvatarEl = document.getElementById("settingsAccountAvatar");
  var accountNameEl = document.getElementById("settingsAccountName");
  var accountEmailEl = document.getElementById("settingsAccountEmail");

  window.napRefreshSettingsAccountSummary = function () {
    if (!accountNameEl) return;
    var profile = window.NAP_CURRENT_PROFILE || {};
    if (accountAvatarEl) accountAvatarEl.innerHTML = window.napAvatarHtml(profile, "lg");
    accountNameEl.textContent = window.napFullName(profile) || window.napDisplayName(profile, "Brother");
    accountEmailEl.textContent = (auth.currentUser && auth.currentUser.email) || profile.email || "";
  };

  window.napOnAuthReady(function () {
    window.napRefreshSettingsAccountSummary();
    refreshAdminPanel();
    refreshEmailToggle();
  });

  /* Admin sub-tab: redeem the admin code. The code itself is validated by the
     Firestore security rules (not here), so a wrong code comes back as a
     permission error — the code never appears in this file. */
  var adminCodeForm = document.getElementById("adminCodeForm");
  var adminCodeError = document.getElementById("admin-code-error");
  var adminNotAdminEl = document.getElementById("settingsAdminNotAdmin");
  var adminIsAdminEl = document.getElementById("settingsAdminIsAdmin");

  function refreshAdminPanel() {
    var isAdmin = window.napIsAdmin && window.napIsAdmin();
    if (adminNotAdminEl) adminNotAdminEl.hidden = isAdmin;
    if (adminIsAdminEl) adminIsAdminEl.hidden = !isAdmin;
  }

  if (adminCodeForm) {
    adminCodeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (adminCodeError) adminCodeError.hidden = true;

      var code = document.getElementById("settings-admin-code").value.trim();
      if (!code) return;

      var submitBtn = adminCodeForm.querySelector(".form-submit");
      window.napSaveButtonStart(submitBtn, "Checking…");

      var userRef = db.collection("users").doc(window.NAP_CURRENT_UID);
      userRef
        .update({ isAdmin: true, adminCode: code })
        .then(function () {
          /* The rules require adminCode in the granting write; scrub it back
             off the profile right away so it isn't left visible to others. */
          return userRef.update({ adminCode: firebase.firestore.FieldValue.delete() });
        })
        .then(function () {
          window.NAP_CURRENT_PROFILE = Object.assign({}, window.NAP_CURRENT_PROFILE, { isAdmin: true });
          var adminNavBtn = document.getElementById("adminNavBtn");
          if (adminNavBtn) adminNavBtn.hidden = false;
          if (window.napStartAdminListeners) window.napStartAdminListeners();
          window.napSaveButtonDone(submitBtn, { savedLabel: "Activated" });
          adminCodeForm.reset();
          window.setTimeout(refreshAdminPanel, 700);
        })
        .catch(function () {
          window.napSaveButtonDone(submitBtn, { error: true });
          if (adminCodeError) {
            adminCodeError.textContent = "That code isn't right.";
            adminCodeError.hidden = false;
          }
        });
    });
  }

  var removeAdminBtn = document.getElementById("removeAdminBtn");
  if (removeAdminBtn) {
    removeAdminBtn.addEventListener("click", function () {
      window.napConfirm(
        "You'll lose access to the Admin tab, post approval, and editing other brothers' accounts. You can always redeem the code again later.",
        { title: "Remove your admin access?", confirmLabel: "Remove Access" }
      ).then(function (confirmed) {
        if (!confirmed) return;

        window.napSaveButtonStart(removeAdminBtn, "Removing…");

        db.collection("users")
          .doc(window.NAP_CURRENT_UID)
          .update({ isAdmin: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
          .then(function () {
            window.NAP_CURRENT_PROFILE = Object.assign({}, window.NAP_CURRENT_PROFILE, { isAdmin: false });
            var adminNavBtn = document.getElementById("adminNavBtn");
            if (adminNavBtn) adminNavBtn.hidden = true;
            /* Bounce out of the Admin tab if it's open — the nav button that
               would lead there is now hidden, so staying on it would strand
               them on a dead-end panel. */
            var adminPanel = document.getElementById("panel-admin");
            if (adminPanel && !adminPanel.hidden) window.napSetTab("settings");
            window.napSaveButtonDone(removeAdminBtn, { savedLabel: "Removed" });
            window.setTimeout(refreshAdminPanel, 700);
          })
          .catch(function () {
            window.napSaveButtonDone(removeAdminBtn, { error: true });
            window.alert("Couldn't remove admin access. Please try again.");
          });
      });
    });
  }

  /* Notifications sub-tab: email on/off, stored on the user doc so the
     poster's email blast can skip brothers who opted out. Missing field
     counts as ON (opt-out model). */
  var emailToggleBtn = document.getElementById("emailNotifToggleBtn");
  var emailFeedback = document.getElementById("email-notif-feedback");

  function refreshEmailToggle() {
    if (!emailToggleBtn) return;
    var on = !window.NAP_CURRENT_PROFILE || window.NAP_CURRENT_PROFILE.emailNotifications !== false;
    emailToggleBtn.classList.toggle("is-active", on);
    emailToggleBtn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  if (emailToggleBtn) {
    emailToggleBtn.addEventListener("click", function () {
      var turningOn = emailToggleBtn.getAttribute("aria-pressed") !== "true";
      db.collection("users")
        .doc(window.NAP_CURRENT_UID)
        .update({ emailNotifications: turningOn })
        .then(function () {
          window.NAP_CURRENT_PROFILE = Object.assign({}, window.NAP_CURRENT_PROFILE, { emailNotifications: turningOn });
          refreshEmailToggle();
          if (emailFeedback) {
            emailFeedback.textContent = turningOn ? "Email notifications turned on." : "Email notifications turned off.";
            emailFeedback.className = "form-feedback form-feedback--success";
            emailFeedback.hidden = false;
          }
        });
    });
  }

  var THEME_KEY = "nap_portal_theme";

  var themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    themeBtn.classList.toggle("is-active", isDark);
    themeBtn.setAttribute("aria-pressed", isDark ? "true" : "false");

    themeBtn.addEventListener("click", function () {
      var nowDark = document.documentElement.getAttribute("data-theme") !== "dark";
      document.documentElement.setAttribute("data-theme", nowDark ? "dark" : "light");
      themeBtn.classList.toggle("is-active", nowDark);
      themeBtn.setAttribute("aria-pressed", nowDark ? "true" : "false");
      try {
        localStorage.setItem(THEME_KEY, nowDark ? "dark" : "light");
      } catch (e) {}
    });
  }

  var form = document.getElementById("passwordChangeForm");
  var errorEl = document.getElementById("password-change-error");
  var feedbackEl = document.getElementById("password-change-feedback");
  if (!form) return;

  var PASSWORD_ERROR_MESSAGES = {
    "auth/wrong-password": "Your current password is incorrect.",
    "auth/invalid-credential": "Your current password is incorrect.",
    "auth/weak-password": "New password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (errorEl) errorEl.hidden = true;
    if (feedbackEl) feedbackEl.hidden = true;

    var currentPassword = document.getElementById("settings-current-password").value;
    var newPassword = document.getElementById("settings-new-password").value;
    var confirmNewPassword = document.getElementById("settings-confirm-new-password").value;

    if (newPassword !== confirmNewPassword) {
      if (errorEl) {
        errorEl.textContent = "New passwords don't match.";
        errorEl.hidden = false;
      }
      return;
    }

    var submitBtn = form.querySelector(".form-submit");
    window.napSaveButtonStart(submitBtn, "Updating…");

    var user = auth.currentUser;
    var credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

    user
      .reauthenticateWithCredential(credential)
      .then(function () {
        return user.updatePassword(newPassword);
      })
      .then(function () {
        form.reset();
        if (feedbackEl) {
          feedbackEl.textContent = "Password updated.";
          feedbackEl.className = "form-feedback form-feedback--success";
          feedbackEl.hidden = false;
        }
        window.napSaveButtonDone(submitBtn, { savedLabel: "Saved" });
      })
      .catch(function (err) {
        if (errorEl) {
          errorEl.textContent = PASSWORD_ERROR_MESSAGES[err.code] || err.message || "Something went wrong. Please try again.";
          errorEl.hidden = false;
        }
        window.napSaveButtonDone(submitBtn, { error: true });
      });
  });
})();
