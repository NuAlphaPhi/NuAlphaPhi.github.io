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
