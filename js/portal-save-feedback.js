/* Shared save-button feedback: spinner while saving, checkmark burst when saved */
(function () {
  "use strict";

  var CHECK_SVG =
    '<svg class="btn-check__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M3 8.5L6.2 11.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  window.napSaveButtonStart = function (btn, savingLabel) {
    if (!btn || btn.dataset.napSaving === "1") return;
    btn.dataset.napSaving = "1";
    btn.dataset.napOriginalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.remove("is-saved");
    btn.classList.add("is-saving");
    btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span>' + (savingLabel || "Saving…") + "</span>";
  };

  window.napSaveButtonDone = function (btn, opts) {
    opts = opts || {};
    if (!btn || btn.dataset.napSaving !== "1") return;
    btn.classList.remove("is-saving");

    if (opts.error) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.napOriginalHtml || btn.innerHTML;
      delete btn.dataset.napOriginalHtml;
      delete btn.dataset.napSaving;
      return;
    }

    btn.classList.add("is-saved");
    btn.innerHTML = '<span class="btn-check">' + CHECK_SVG + "</span><span>" + (opts.savedLabel || "Saved") + "</span>";

    window.setTimeout(function () {
      btn.classList.remove("is-saved");
      btn.disabled = false;
      btn.innerHTML = btn.dataset.napOriginalHtml || btn.innerHTML;
      delete btn.dataset.napOriginalHtml;
      delete btn.dataset.napSaving;
    }, opts.holdMs === undefined ? 1300 : opts.holdMs);
  };
})();
