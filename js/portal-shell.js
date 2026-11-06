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

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && navEl && navEl.classList.contains("is-open")) {
      closeMobileNav();
      if (navToggleBtn) navToggleBtn.focus();
    }
  });

  var validNavTabs = Array.prototype.map.call(navBtns, function (btn) {
    return btn.getAttribute("data-tab");
  });

  /* navTab lets a sub-page with no nav button of its own (e.g. the form
     builder/responses pages, reached only from within the Forms tab) keep
     that tab highlighted instead of leaving the sidebar with nothing active.

     opts.fromHistory: this call came from a popstate (Back/Forward) event —
     don't touch history again, that would fight the browser.
     opts.replace: update the URL hash without adding a new history entry
     (used only for the one-time restore-on-load below). Everything else
     (an actual nav click, or any other setTab call — all of those represent
     a real navigation the user took) pushes a new entry, so the URL hash
     tracks the active tab and Back/Forward move between tabs instead of
     leaving the app after a single press. */
  var scrollPositions = {}, previousTab;
  function showTab(tab, navTab, opts) {
    opts = opts || {};
    if (!Array.prototype.some.call(panels, function (panel) { return panel.getAttribute("data-panel") === tab; })) return;

    var scrollMain = document.querySelector('.portal-shell__main');
    if(previousTab && scrollMain)scrollPositions[previousTab]=scrollMain.scrollTop;
    previousTab=tab;
    window.napCurrentTab=tab;
    var activeNavTab = navTab || tab;
    navBtns.forEach(function (btn) {
      var isActive = btn.getAttribute("data-tab") === activeNavTab;
      btn.classList.toggle("is-active", isActive);
      if (isActive) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
      if (isActive && navToggleLabelEl) navToggleLabelEl.textContent = btn.textContent;
      var breadcrumb = document.getElementById("portalCurrentSection");
      if (isActive && breadcrumb) breadcrumb.textContent = btn.textContent;
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== tab;
    });
    document.dispatchEvent(new CustomEvent("nap:tab-changed", {detail: {tab: tab}}));
    closeMobileNav();
    var activePanel = document.querySelector('.portal-tab-panel:not([hidden])');
    var heading = activePanel && activePanel.querySelector("h1");
    if (heading && !opts.replace) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    var main = document.querySelector(".portal-shell__main");
    if (main) main.scrollTop = scrollPositions[tab] || 0;

    if (!opts.fromHistory && validNavTabs.indexOf(activeNavTab) !== -1) {
      var nextUrl = "/portal-home/" + activeNavTab + location.search;
      if (location.pathname !== "/portal-home/" + activeNavTab || location.hash) {
        if (opts.replace) {
          history.replaceState(null, "", nextUrl);
        } else {
          history.pushState(null, "", nextUrl);
        }
      }
    }
  }

  var navigationId = 0;
  var loader = document.getElementById("portalRouteLoading");
  function loading(message, failed) {
    loader.hidden = false;
    loader.classList.toggle("is-error", !!failed);
    loader.querySelector("p").textContent = message;
    loader.querySelector("button").hidden = !failed;
  }
  async function setTab(tab, navTab, opts) {
    if (!Array.prototype.some.call(panels, p => p.getAttribute("data-panel") === tab)) return;
    if(window.napBeforeTabChange && window.napBeforeTabChange(tab)===false)return;
    var ticket = ++navigationId;
    loading("Verifying your account…");
    try {
      if (!window.NAP_AUTH_READY_DETAIL) await new Promise((resolve, reject) => {
        var timer = setTimeout(() => { document.removeEventListener("nap:auth-ready", ready); reject(Error("Your account is taking longer to load.")); }, 15000);
        function ready() { clearTimeout(timer); resolve(); }
        document.addEventListener("nap:auth-ready", ready, {once:true});
      });
      var user = auth.currentUser;
      if (!user) { location.assign("/portal?next=" + encodeURIComponent("/portal-home/" + (navTab || tab))); return; }
      var timeout;
      var snap;
      try {
        snap = await Promise.race([
          db.collection("users").doc(user.uid).get({source:"server"}),
          new Promise((resolve, reject) => { timeout = setTimeout(() => reject(Error("Verification timed out")), 12000); })
        ]);
      } finally { clearTimeout(timeout); }
      if(ticket !== navigationId) return;
      var profile = snap.exists ? snap.data() : null;
      if (!profile || profile.disabled || (profile.membershipStatus && profile.membershipStatus !== "approved")) {
        await auth.signOut(); location.assign("/portal"); return;
      }
      if(auth.currentUser?.uid !== user.uid) return;
      if ((tab === "blog") && profile.isAdmin !== true) tab = navTab = "home";
      loading("Opening your workspace…");
      showTab(tab, navTab, opts);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if(ticket === navigationId) loader.hidden = true;
    } catch(error) {
      if(ticket !== navigationId) return;
      loading("We couldn’t verify your account. Check your connection and try again.", true);
      loader.querySelector("button").onclick = () => setTab(tab, navTab, opts);
    }
  }
  window.napSetTab = setTab;

  var brandLink = document.querySelector(".portal-shell__brand");
  if (brandLink) brandLink.addEventListener("click", function (event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setTab("home");
  });

  navBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTab(btn.getAttribute("data-tab"));
    });
  });

  window.addEventListener("popstate", function () {
    var tabFromHash = routeTab();
    if (validNavTabs.indexOf(tabFromHash) !== -1) {
      setTab(tabFromHash, undefined, { fromHistory: true });
    }
  });

  /* Restore whichever tab the hash points to on a fresh load (a refresh, or
     landing on a link with a #hash) instead of always defaulting to
     Overview. Uses replaceState so this doesn't itself add a history entry. */
  function routeTab() { return location.hash ? location.hash.slice(1) : location.pathname.split("/")[2] || "home"; }
  var initialTab = routeTab();
  if (validNavTabs.indexOf(initialTab) !== -1) {
    setTab(initialTab, undefined, { replace: true });
  } else { setTab("home", undefined, {replace:true}); }
})();
