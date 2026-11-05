/* Shared, pure portal presentation policy; Firebase remains authoritative. */
(function (root) {
  function channels(g = {}) {
    const roles = [g.role, ...(g.roles || [])],
      has = (...r) => r.some((x) => roles.includes(x));
    const a = [
      ["general", "General"],
      ["shitposting", "Shitposting"],
      ["gaming", "Gaming"],
      ["sports", "Sports"],
      ["finance", "Finance"],
    ];
    if (g.chapter) {
      a.unshift(["chapter-" + g.chapter, g.chapter + " · All brothers"]);
      a.unshift([
        g.status === "active"
          ? "chapter-actives-" + g.chapter
          : "chapter-alumni-" + g.chapter,
        g.chapter + (g.status === "active" ? " · Actives" : " · Alumni"),
      ]);
    }
    if (["fall", "spring", "summer"].includes(g.term) && g.year)
      a.push([
        "pbs-" + g.term + "-" + g.year,
        "PBs · " + g.term + " " + g.year,
      ]);
    a.push(
      g.status === "active"
        ? ["actives", "All actives"]
        : ["alumni", "All alumni"],
    );
    if (has("president", "nationalBoard", "nationalIntern"))
      a.push(["leadership", "Leadership"]);
    if (has("nationalBoard")) a.push(["nationals", "Nationals"]);
    if (has("nationalBoard", "nationalIntern"))
      a.push(["nationals-interns", "Nationals + interns"]);
    if (has("pledgeMaster", "pledgeWarden"))
      a.push(["pledge-leadership", "Pledging"]);
    if (has("alumniAdvisor", "nationalBoard", "nationalIntern"))
      a.push(["alumni-advisors", "Alumni advisors"]);
    return a.map(([id, title]) => ({ id, title, channel: true }));
  }

  function freshArea(row, now = Date.now()) {
    const updated =
      row.updatedAt?.toDate?.().getTime() ??
      new Date(row.updatedAt || 0).getTime();
    return (
      Number.isInteger(row.latitudeCell) &&
      Math.abs(row.latitudeCell) <= 4500 &&
      Number.isInteger(row.longitudeCell) &&
      Math.abs(row.longitudeCell) <= 9000 &&
      updated > now - 7 * 86400000 &&
      updated <= now + 60000
    );
  }
  const resumeChannel = (grant, previous) => channels(grant).find(r => r.id === previous) || channels(grant).find(r => r.id === 'general');
  const api = { channels, freshArea, resumeChannel };
  if (typeof module !== "undefined") module.exports = api;
  else root.P985Policy = api;
})(typeof window === "undefined" ? globalThis : window);
