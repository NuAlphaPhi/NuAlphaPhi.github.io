/* Sidebar tab switching for portal-home.html */
(function () {
  "use strict";

  var navBtns = document.querySelectorAll(".portal-shell__nav-btn");
  var panels = document.querySelectorAll(".portal-tab-panel");
  if (!navBtns.length) return;

  /* navTab lets a sub-page with no nav button of its own (e.g. the form
     builder/responses pages, reached only from within the Forms tab) keep
     that tab highlighted instead of leaving the sidebar with nothing active. */
  function setTab(tab, navTab) {
    var activeNavTab = navTab || tab;
    navBtns.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === activeNavTab);
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
