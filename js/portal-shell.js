/* Sidebar tab switching for portal-home.html */
(function () {
  "use strict";

  var navBtns = document.querySelectorAll(".portal-shell__nav-btn");
  var panels = document.querySelectorAll(".portal-tab-panel");
  if (!navBtns.length) return;

  function setTab(tab) {
    navBtns.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === tab);
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== tab;
    });
  }

  window.napSetTab = setTab;

  navBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTab(btn.getAttribute("data-tab"));
    });
  });
})();
