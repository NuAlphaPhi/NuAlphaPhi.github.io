/* Sign in / sign up handlers for portal.html */
(function () {
  "use strict";

  async function callable(name,data,authenticated) {
    const headers={'Content-Type':'application/json'};
    if(authenticated)headers.Authorization='Bearer '+await auth.currentUser.getIdToken();
    const response=await fetch('https://us-central1-nualphaphi-6b330.cloudfunctions.net/'+name,{method:'POST',headers,body:JSON.stringify({data})});
    const result=await response.json();if(result.error)throw Error(result.error.message);return result.result;
  }
  function destination(){const next=new URLSearchParams(location.search).get('next');return next&&/^\/portal-home(?:\.html)?(?:[?#]|$)/.test(next)?next:'portal-home';}
  var toggleBtns = document.querySelectorAll(".portal-auth__toggle-btn");
  var panels = {
    signin: document.getElementById("authPanelSignin"),
    reset: document.getElementById("authPanelReset"),
    signup: document.getElementById("authPanelSignup"),
  };

  function setAuthView(view) {
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].hidden = key !== view;
    });
    toggleBtns.forEach(function (btn) {
      var active = btn.getAttribute("data-auth-view") === view;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
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

  document.getElementById('forgotPasswordButton').addEventListener('click', function () {
    document.getElementById('reset-email').value = document.getElementById('portal-signin-email').value.trim();
    setAuthView('reset');
    document.getElementById('reset-email').focus();
  });
  document.getElementById('backToSignin').addEventListener('click', function () {
    setAuthView('signin');
    document.getElementById('portal-signin-email').focus();
  });
  document.getElementById('passwordResetForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!this.reportValidity()) return;
    var button = this.querySelector('[type="submit"]');
    if (button.disabled) return;
    var feedback = document.getElementById('reset-feedback');
    button.disabled = true; button.textContent = 'Sending…'; feedback.hidden = true;
    try {
      try { await auth.sendPasswordResetEmail(document.getElementById('reset-email').value.trim()); }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      feedback.textContent = 'If an account uses this email, a reset link is on its way. Check your inbox and spam folder.';
      feedback.className = 'form-feedback form-feedback--success';
    } catch (error) {
      feedback.textContent = error.code === 'auth/network-request-failed' ? 'Could not connect. Check your connection and try again.' : (AUTH_ERROR_MESSAGES[error.code] || 'Could not send a reset link. Please try again.');
      feedback.className = 'form-error';
    } finally {
      feedback.hidden = false; button.disabled = false; button.textContent = 'Send reset link';
    }
  });

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
        .then(async function (credential) {
          const profile=await db.doc('users/'+credential.user.uid).get();
          const value=profile.data();
          if(!value||value.disabled||(value.membershipStatus&&value.membershipStatus!=='approved')){
            const application=await db.doc('membershipApplications/'+credential.user.uid).get();
            throw Error(application.exists?'Your application is '+application.data().status+'. You will be notified when a decision is made.':'Your account does not yet have an approved brother profile. Contact an administrator.');
          }
          window.location.href = destination();
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
      if (password !== confirmPassword) {
        showError(signupError, "Passwords don't match.");
        return;
      }

      var submitBtn = signupForm.querySelector(".form-submit");
      var originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account…";

      Promise.resolve().then(async function () {
          await callable('membershipReadiness',{},false);
          let credential;
          try { credential=await auth.createUserWithEmailAndPassword(email,password); }
          catch(error){if(error.code!=='auth/email-already-in-use')throw error;credential=await auth.signInWithEmailAndPassword(email,password);}
          const fields={firstName,lastName,middleName:'',notifications:true};
          for(const key of ['phone','pledgeName','pledgeClass','pledgeNumber','chapter'])fields[key]=document.getElementById('portal-signup-'+key).value.trim();
          await callable('submitMembership',fields,true);
          signupForm.reset();showError(signupError,'Your application is in review. You will receive an email when administrators make a decision.');
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
