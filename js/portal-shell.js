/* Sidebar tab switching for portal-home.html */
(function () {
  "use strict";

  var navBtns = document.querySelectorAll(".portal-shell__nav-btn");
  var panels = document.querySelectorAll(".portal-tab-panel");
  if (!navBtns.length) return;

  var navEl = document.getElementById("portalNav");
  var navToggleBtn = document.getElementById("portalNavToggle");
  var navToggleLabelEl = document.getElementById("portalNavToggleLabel");

  function closeMobileNav() {
    if (navEl) navEl.classList.remove("is-open");
    if (navToggleBtn) navToggleBtn.setAttribute("aria-expanded", "false");
  }

  if (navToggleBtn && navEl) {
    navToggleBtn.addEventListener("click", function () {
      var isOpen = navEl.classList.toggle("is-open");
      navToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    /* Below 860px the nav is an absolutely-positioned dropdown (see nap.css);
       clicking anywhere outside it should close it like a normal menu. */
    document.addEventListener("click", function (e) {
      if (!navEl.classList.contains("is-open")) return;
      if (navEl.contains(e.target) || navToggleBtn.contains(e.target)) return;
      closeMobileNav();
    });
  }

  /* navTab lets a sub-page with no nav button of its own (e.g. the form
     builder/responses pages, reached only from within the Forms tab) keep
     that tab highlighted instead of leaving the sidebar with nothing active. */
  function setTab(tab, navTab) {
    var activeNavTab = navTab || tab;
    navBtns.forEach(function (btn) {
      var isActive = btn.getAttribute("data-tab") === activeNavTab;
      btn.classList.toggle("is-active", isActive);
      if (isActive && navToggleLabelEl) navToggleLabelEl.textContent = btn.textContent;
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== tab;
    });
    closeMobileNav();
  }

  window.napSetTab = setTab;

  navBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTab(btn.getAttribute("data-tab"));
    });
  });
})();
