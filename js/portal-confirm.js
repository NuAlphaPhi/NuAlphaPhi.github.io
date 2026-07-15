/* Shared delete/destructive-action confirm dialog — replaces window.confirm()
   with the site's own modal. window.napConfirm(message, opts) returns a
   Promise<boolean> instead of blocking, so callers use .then() instead of
   wrapping window.confirm() in an if statement. */
(function () {
  "use strict";

  var dialog = document.getElementById("modal-confirm");
  if (!dialog) return;

  var titleEl = document.getElementById("modalConfirmTitle");
  var bodyEl = document.getElementById("modalConfirmBody");
  var cancelBtn = document.getElementById("modalConfirmCancelBtn");
  var okBtn = document.getElementById("modalConfirmOkBtn");

  var pendingResolve = null;

  function settle(result) {
    if (!pendingResolve) return;
    var resolve = pendingResolve;
    pendingResolve = null;
    resolve(result);
  }

  okBtn.addEventListener("click", function () {
    settle(true);
    dialog.close();
  });

  cancelBtn.addEventListener("click", function () {
    settle(false);
    dialog.close();
  });

  /* Safety net for every other way the dialog can end up closed — Escape,
     clicking the backdrop (site.js's generic dialog handler), or anything
     else — watched via the `open` attribute itself rather than the
     dialog's native "close"/"cancel" events, which don't fire reliably
     enough across every browser/automation context to depend on. A
     confirmation whose promise can silently never resolve is worse than
     the window.confirm() it's replacing. */
  new MutationObserver(function () {
    if (!dialog.open) settle(false);
  }).observe(dialog, { attributes: true, attributeFilter: ["open"] });

  window.napConfirm = function (message, opts) {
    opts = opts || {};
    titleEl.textContent = opts.title || "Are you sure?";
    bodyEl.textContent = message || "";
    okBtn.textContent = opts.confirmLabel || "Delete";
    return new Promise(function (resolve) {
      pendingResolve = resolve;
      dialog.showModal();
    });
  };
})();
