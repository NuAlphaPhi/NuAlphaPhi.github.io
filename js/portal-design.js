/* Presentation helpers only; account and data actions remain in their existing modules. */
(function () {
  "use strict";
  var today = document.getElementById("portalToday");
  if (today) {
    var now = new Date();
    today.dateTime = now.toISOString().slice(0, 10);
    today.textContent = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  document.addEventListener("click", function (event) {
    var shortcut = event.target.closest("[data-portal-go]");
    if (shortcut && window.napSetTab) window.napSetTab(shortcut.getAttribute("data-portal-go"));
  });
  if (window.napOnAuthReady) window.napOnAuthReady(function (detail) {
    var greeting = document.getElementById("portalGreeting");
    var name = window.napDisplayName(detail.profile, "");
    if (greeting) greeting.textContent = name ? "Welcome back, " + name + "." : "Welcome back.";
  });
  var quickTheme = document.getElementById("portalQuickTheme");
  var existingTheme = document.getElementById("themeToggleBtn");
  if (quickTheme && existingTheme) {
    function syncThemeLabel() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      quickTheme.setAttribute("aria-label", "Switch to " + (dark ? "light" : "dark") + " mode");
      quickTheme.title = quickTheme.getAttribute("aria-label");
    }
    quickTheme.addEventListener("click", function () { existingTheme.click(); });
    new MutationObserver(syncThemeLabel).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    syncThemeLabel();
  }
})();

/* Settings stays in a dialog so opening it preserves the current workspace. */
(function () {
  const panel = document.getElementById('panel-settings');
  const trigger = document.getElementById('portalSettingsOpen');
  if (!panel || !trigger) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'portal-settings-dialog';
  dialog.setAttribute('aria-label', 'Settings');
  const close = document.createElement('button');
  close.className = 'portal-settings-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Close settings');
  close.textContent = '×';
  const navigation = panel.querySelector('#settingsSubTabs');
  const body = document.createElement('div');
  body.className = 'portal-settings-body';
  Array.from(panel.children).forEach(child => { if (child !== navigation) body.append(child); });
  panel.append(navigation, body);
  dialog.append(close, panel);
  document.body.append(dialog);
  function open() {
    panel.hidden = false;
    if (!dialog.open) dialog.showModal();
  }
  trigger.onclick = open;
  close.onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  }});
  dialog.addEventListener('close', () => trigger.focus());
  window.napOpenSettings = open;
})();
