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

  document.addEventListener("nap:auth-ready", function () {
    window.napRefreshSettingsAccountSummary();
  });

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
    var originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Updating…";

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
      })
      .catch(function (err) {
        if (errorEl) {
          errorEl.textContent = PASSWORD_ERROR_MESSAGES[err.code] || err.message || "Something went wrong. Please try again.";
          errorEl.hidden = false;
        }
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      });
  });
})();
