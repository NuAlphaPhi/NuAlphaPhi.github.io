/* Sign in / sign up handlers for portal.html */
(function () {
  "use strict";

  /* Shared invite code required to create a portal account — a light deterrent
     against randoms finding the page, not real security (visible via View Source,
     same tradeoff as any client-side check). Change this string any time. */
  var PORTAL_INVITE_CODE = "NAPHI-BROTHERS";

  var toggleBtns = document.querySelectorAll(".portal-auth__toggle-btn");
  var panels = {
    signin: document.getElementById("authPanelSignin"),
    signup: document.getElementById("authPanelSignup"),
  };

  function setAuthView(view) {
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].hidden = key !== view;
    });
    toggleBtns.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-auth-view") === view);
    });
  }

  toggleBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setAuthView(btn.getAttribute("data-auth-view"));
    });
  });

  var AUTH_ERROR_MESSAGES = {
    "auth/email-already-in-use": "An account with that email already exists.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/user-not-found": "Incorrect email or password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  };

  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function hideError(el) {
    if (!el) return;
    el.hidden = true;
  }

  function authErrorMessage(err) {
    return AUTH_ERROR_MESSAGES[err.code] || err.message || "Something went wrong. Please try again.";
  }

  /* Sign in */
  var signinForm = document.getElementById("portalSigninForm");
  var signinError = document.getElementById("signin-error");

  if (signinForm) {
    signinForm.addEventListener("submit", function (e) {
      e.preventDefault();
      hideError(signinError);

      var email = document.getElementById("portal-signin-email").value.trim();
      var password = document.getElementById("portal-signin-password").value;
      var submitBtn = signinForm.querySelector(".form-submit");
      var originalText = submitBtn.textContent;

      submitBtn.disabled = true;
      submitBtn.textContent = "Signing in…";

      auth
        .signInWithEmailAndPassword(email, password)
        .then(function () {
          window.location.href = "portal-home";
        })
        .catch(function (err) {
          showError(signinError, authErrorMessage(err));
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        });
    });
  }

  /* Sign up */
  var signupForm = document.getElementById("portalSignupForm");
  var signupError = document.getElementById("signup-error");

  if (signupForm) {
    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      hideError(signupError);

      var firstName = document.getElementById("portal-signup-firstname").value.trim();
      var lastName = document.getElementById("portal-signup-lastname").value.trim();
      var email = document.getElementById("portal-signup-email").value.trim();
      var password = document.getElementById("portal-signup-password").value;
      var confirmPassword = document.getElementById("portal-signup-confirm").value;
      var inviteCode = document.getElementById("portal-signup-invite").value.trim();

      if (inviteCode !== PORTAL_INVITE_CODE) {
        showError(signupError, "That invite code isn't right. Check with your chapter for the code.");
        return;
      }

      if (password !== confirmPassword) {
        showError(signupError, "Passwords don't match.");
        return;
      }

      var submitBtn = signupForm.querySelector(".form-submit");
      var originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account…";

      auth
        .createUserWithEmailAndPassword(email, password)
        .then(function (cred) {
          return db
            .collection("users")
            .doc(cred.user.uid)
            .set({
              uid: cred.user.uid,
              email: email,
              firstName: firstName,
              lastName: lastName,
              pledgeName: "",
              pledgeNumber: "",
              chapter: "",
              pledgeClass: "",
              semesterCrossed: "",
              yearCrossed: null,
              birthday: "",
              instagram: "",
              facebook: "",
              linkedin: "",
              bigName: "",
              bigPledgeName: "",
              occupation: "",
              major: "",
              graduationYear: null,
              hometown: "",
              currentLocation: "",
              phone: "",
              bio: "",
              photoDataUrl: "",
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        })
        .then(function () {
          window.location.href = "portal-home";
        })
        .catch(function (err) {
          showError(signupError, authErrorMessage(err));
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        });
    });
  }
})();
