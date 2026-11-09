/* Shared portal deep links. Detail handlers run only after account verification. */
(function () {
  "use strict";
  // Keep existing bookmarks working while making /portal canonical.
  if (/^\/portal-home(?:\.html)?(?:\/|$)/.test(location.pathname)) {
    const canonical = location.pathname.replace(/^\/portal-home(?:\.html)?/, "/portal");
    history.replaceState(null, "", canonical + location.search + location.hash);
  }
  const sections = ["Applications", "Class leadership requests", "Accounts", "Content reports", "Events", "Announcements", "Leadership", "Pledging", "Actives & alumni", "Alumni advisors", "Admins", "Activity", "Statistics", "Roster discrepancies", "Newly Crossed", "Discord Links"];
  const slug = value => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const handlers = {};
  let enabled = false, handled = null, running = false;
  function read(path = location.pathname) {
    if (/^\/portal\/?$/.test(path)) return {kind:"home", id:"", tab:"home"};
    const match = path.match(/^\/portal\/(admin|linktree|gallery|events|messages|channels|channel|home)(?:\/([^/]+))?\/?$/);
    if (!match) return null;
    let id; try { id = decodeURIComponent(match[2] || ""); } catch (_) { return null; }
    if (id.includes("/") || id.includes("\\") || id === "." || id === "..") return null;
    const kind = match[1] === "channel" ? "channels" : match[1];
    return { kind, id, tab: kind };
  }
  function restore(reset = false) {
    if (reset) handled = null;
    const route = read(), key = location.pathname;
    if (!enabled || running || !route || handled === key || !handlers[route.kind]) return;
    running = true;
    try { if (handlers[route.kind](route.id) !== false) handled = key; }
    finally { running = false; }
  }
  window.NAP_ROUTES = {
    read, slug, sections,
    path: (kind, id) => "/portal/" + (kind === "channels" ? "channel" : kind) + (id ? "/" + encodeURIComponent(id) : ""),
    adminSection: "applications",
    base: tab => tab === "home" ? "/portal" : tab === "admin" ? "/portal/admin/" + window.NAP_ROUTES.adminSection : "/portal/" + tab,
    register(kind, fn) { handlers[kind] = fn; restore(); },
    restore,
    navigated() { enabled = true; handled = location.pathname; },
    activate() { enabled = true; restore(true); },
    options(kind, id) { return { profilePath: this.path(kind, id) }; }
  };
})();
