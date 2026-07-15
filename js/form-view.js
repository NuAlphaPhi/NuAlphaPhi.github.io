/* Public "fill out this form" page — form-view.html?id=<formId>. By default
   anyone with the link can view a published form and submit a response; if
   the owner turned on requireSignIn, only a signed-in brother (portal
   account) can see the questions, and everyone else hits a sign-in gate.
   This is the public counterpart to js/portal-forms.js, which owners/
   collaborators use to build forms and read responses. */
(function () {
  "use strict";

  var card = document.getElementById("formViewCard");
  var CHOICE_TYPES = ["multiple_choice", "checkboxes", "dropdown"];

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function brandHtml() {
    return '<a href="index" class="public-form-card__brand"><img src="img/letters.png" alt="Nu Alpha Phi"></a>';
  }

  var AUTH_ERROR_MESSAGES = {
    "auth/invalid-email": "Enter a valid email address.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/user-not-found": "Incorrect email or password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  };

  function renderSignInGate(formId, form) {
    var html = "";
    if (form.bannerImage) {
      html += '<div class="public-form-card__banner"><img src="' + form.bannerImage + '" alt=""></div>';
    }
    html += '<div class="public-form-card__body">';
    html += brandHtml();
    html += '<h1 class="public-form-card__title">' + escapeHtml(form.title || "Untitled form") + "</h1>";
    if (form.description) {
      html += '<p class="public-form-card__desc">' + escapeHtml(form.description) + "</p>";
    }
    html += '<div class="public-form-gate">';
    html += '<p class="public-form-gate__notice">This form is limited to brothers. Sign in with your portal account to continue.</p>';
    html += '<form id="publicFormSignIn" novalidate>';
    html += '<div class="form-group"><label class="form-label" for="pf-signin-email">Email</label><input class="form-input" id="pf-signin-email" name="email" type="email" autocomplete="email" required></div>';
    html += '<div class="form-group"><label class="form-label" for="pf-signin-password">Password</label><input class="form-input" id="pf-signin-password" name="password" type="password" autocomplete="current-password" required></div>';
    html += '<p class="form-error" id="publicFormSignInError" role="alert" hidden></p>';
    html += '<button class="form-submit" type="submit">Sign In</button>';
    html += "</form>";
    html += "</div>";
    html += "</div>";

    card.innerHTML = html;

    var signInForm = document.getElementById("publicFormSignIn");
    var errorEl = document.getElementById("publicFormSignInError");
    var submitBtn = signInForm.querySelector(".form-submit");

    signInForm.addEventListener("submit", function (e) {
      e.preventDefault();
      errorEl.hidden = true;
      var email = document.getElementById("pf-signin-email").value.trim();
      var password = document.getElementById("pf-signin-password").value;

      submitBtn.disabled = true;
      submitBtn.textContent = "Signing in…";

      auth.signInWithEmailAndPassword(email, password).catch(function (err) {
        errorEl.textContent = AUTH_ERROR_MESSAGES[err.code] || err.message || "Something went wrong. Please try again.";
        errorEl.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      });
      /* On success the onAuthStateChanged listener registered at the bottom
         of this file fires again with the signed-in user and swaps this
         gate out for the real form — no manual re-render needed here. */
    });
  }

  function renderState(title, body) {
    card.innerHTML =
      '<div class="public-form-card__body">' +
      brandHtml() +
      '<div class="public-form-state">' +
      '<p class="public-form-state__title">' + escapeHtml(title) + "</p>" +
      "<p>" + body + "</p>" +
      "</div>" +
      "</div>";
  }

  function questionFieldHtml(q) {
    var name = "q_" + q.id;
    var requiredAttr = q.required ? " required" : "";
    var requiredMark = q.required ? '<span class="public-form-question__required">*</span>' : "";

    var html = '<div class="public-form-question">';
    html += '<label class="public-form-question__label">' + escapeHtml(q.label) + requiredMark + "</label>";

    if (q.type === "paragraph") {
      html += '<textarea class="form-textarea" name="' + name + '"' + requiredAttr + "></textarea>";
    } else if (q.type === "multiple_choice") {
      html += (q.options || [])
        .map(function (opt, i) {
          var id = name + "_" + i;
          return (
            '<label class="public-form-choice-row" for="' + id + '">' +
            '<input type="radio" id="' + id + '" name="' + name + '" value="' + escapeHtml(opt) + '"' + requiredAttr + ">" +
            '<span class="public-form-choice-row__indicator" aria-hidden="true"></span>' +
            '<span class="public-form-choice-row__text">' + escapeHtml(opt) + "</span>" +
            "</label>"
          );
        })
        .join("");
    } else if (q.type === "checkboxes") {
      html += (q.options || [])
        .map(function (opt, i) {
          var id = name + "_" + i;
          return (
            '<label class="public-form-choice-row public-form-choice-row--checkbox" for="' + id + '">' +
            '<input type="checkbox" id="' + id + '" name="' + name + '" value="' + escapeHtml(opt) + '">' +
            '<span class="public-form-choice-row__indicator" aria-hidden="true"></span>' +
            '<span class="public-form-choice-row__text">' + escapeHtml(opt) + "</span>" +
            "</label>"
          );
        })
        .join("");
    } else if (q.type === "dropdown") {
      html += '<select class="form-select" name="' + name + '"' + requiredAttr + ">";
      html += '<option value="">Choose…</option>';
      html += (q.options || [])
        .map(function (opt) {
          return '<option value="' + escapeHtml(opt) + '">' + escapeHtml(opt) + "</option>";
        })
        .join("");
      html += "</select>";
    } else {
      html += '<input class="form-input" type="text" name="' + name + '"' + requiredAttr + ">";
    }

    html += "</div>";
    return html;
  }

  function collectAnswers(form, formEl) {
    var answers = {};
    var formData = new FormData(formEl);
    form.questions.forEach(function (q) {
      var name = "q_" + q.id;
      if (q.type === "checkboxes") {
        answers[q.id] = formData.getAll(name);
      } else {
        answers[q.id] = (formData.get(name) || "").toString().trim();
      }
    });
    return answers;
  }

  function renderForm(formId, form) {
    var html = "";
    if (form.bannerImage) {
      html += '<div class="public-form-card__banner"><img src="' + form.bannerImage + '" alt=""></div>';
    }
    html += '<div class="public-form-card__body">';
    html += brandHtml();
    html += '<h1 class="public-form-card__title">' + escapeHtml(form.title || "Untitled form") + "</h1>";
    if (form.description) {
      html += '<p class="public-form-card__desc">' + escapeHtml(form.description) + "</p>";
    }
    html += '<form id="publicForm" novalidate>';
    html += (form.questions || []).map(questionFieldHtml).join("");
    html += '<p class="form-error" id="publicFormError" role="alert" hidden></p>';
    html += '<button class="form-submit" type="submit">Submit</button>';
    html += "</form>";
    html += "</div>";

    card.innerHTML = html;

    var formEl = document.getElementById("publicForm");
    var errorEl = document.getElementById("publicFormError");
    var submitBtn = formEl.querySelector(".form-submit");

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      errorEl.hidden = true;

      var missing = (form.questions || []).some(function (q) {
        if (!q.required) return false;
        var answer = collectAnswers(form, formEl)[q.id];
        return Array.isArray(answer) ? answer.length === 0 : !answer;
      });
      if (missing) {
        errorEl.textContent = "Please fill out all required questions.";
        errorEl.hidden = false;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";

      db.collection("forms")
        .doc(formId)
        .collection("responses")
        .add({
          answers: collectAnswers(form, formEl),
          submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .then(function () {
          renderState("Thanks!", "Your response has been recorded.");
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit";
          errorEl.textContent = "Something went wrong submitting your response. Please try again.";
          errorEl.hidden = false;
        });
    });
  }

  var params = new URLSearchParams(window.location.search);
  var formId = params.get("id");

  if (!formId) {
    renderState("Form not found", "This link is missing a form id.");
    return;
  }

  db.collection("forms")
    .doc(formId)
    .get()
    .then(function (snap) {
      if (!snap.exists) {
        renderState("Form not found", "This form may have been deleted.");
        return;
      }
      var form = snap.data();
      if (!form.published) {
        renderState("Not accepting responses", "This form is currently closed by its owner.");
        return;
      }
      if (form.requireSignIn) {
        var unsubscribe = auth.onAuthStateChanged(function (user) {
          if (user) {
            if (unsubscribe) unsubscribe();
            renderForm(formId, form);
          } else {
            renderSignInGate(formId, form);
          }
        });
        return;
      }
      renderForm(formId, form);
    })
    .catch(function () {
      renderState("Something went wrong", "Please try again in a moment.");
    });
})();
