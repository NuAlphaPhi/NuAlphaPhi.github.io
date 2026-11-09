/* Shared portal deep links. Detail handlers run only after account verification. */
(function () {
  "use strict";
  const sections = ["Applications", "Class leadership requests", "Accounts", "Content reports", "Events", "Announcements", "Leadership", "Pledging", "Actives & alumni", "Alumni advisors", "Admins", "Activity", "Statistics", "Roster discrepancies", "Newly Crossed", "Discord Links"];
  const slug = value => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const handlers = {};
  let enabled = false, handled = null, running = false;
  function read(path = location.pathname) {
    const match = path.match(/^\/(admin|linktree|gallery|events|messages|channels|home)(?:\/([^/]+))?\/?$/);
    if (!match || (match[1] === "events" && !match[2])) return null;
    let id; try { id = decodeURIComponent(match[2] || ""); } catch (_) { return null; }
    if (id.includes("/") || id.includes("\\") || id === "." || id === "..") return null;
    return { kind: match[1], id, tab: match[1] };
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
    path: (kind, id) => "/" + kind + (id ? "/" + encodeURIComponent(id) : ""),
    adminSection: "applications",
    base: tab => tab === "admin" ? "/admin/" + window.NAP_ROUTES.adminSection : ["admin", "linktree", "gallery", "messages", "channels", "home"].includes(tab) ? "/" + tab : "/portal-home/" + tab,
    register(kind, fn) { handlers[kind] = fn; restore(); },
    restore,
    navigated() { enabled = true; handled = location.pathname; },
    activate() { enabled = true; restore(true); },
    options(kind, id) { return { profilePath: this.path(kind, id) }; }
  };
})();
