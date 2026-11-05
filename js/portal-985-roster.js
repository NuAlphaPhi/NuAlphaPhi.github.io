(function () {
  "use strict";
  const P = P985;
  let classes = [],
    people = [],
    tree = [],
    links = {}, accountLinks = {},
    chapter = "",
    search = "",
    issuesOnly = false;
  const expandedClasses = new Set();
  P.rosterClassRoles = members => {
    const roles = new Map();
    if (members.length) roles.set(members[0].id, 'Captain');
    if (members.length > 1) roles.set(members[members.length - 1].id, 'Co-Captain');
    return roles;
  };
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const greek = [
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "zeta",
    "eta",
    "theta",
    "iota",
    "kappa",
    "lambda",
    "mu",
    "nu",
    "xi",
    "omicron",
    "pi",
    "rho",
    "sigma",
    "tau",
    "upsilon",
    "phi",
    "chi",
    "psi",
    "omega",
  ];
  const order = (s) =>
    String(s || "")
      .toLowerCase()
      .split(" ")
      .reduce((a, w) => a * 24 + greek.indexOf(w) + 1, 0);
  function candidates(r) {
    return tree.filter(
      (t) =>
        (norm(r.fullName) && norm(t.name) === norm(r.fullName)) ||
        (norm(r.pledgeName) && norm(t.pledgeName) === norm(r.pledgeName)),
    );
  }
  function issue(r, c) {
    const linked = links[r.id]?.treeID;
    const m = linked ? tree.filter(t => t.id === linked) : candidates(r);
    if (linked && !m.length) return "Linked family-tree record is missing";
    if (!m.length) return "Not in the family tree";
    if (m.length > 1) return "Multiple possible matches";
    const t = m[0];
    return norm(t.chapter) !== norm(c.chapter) ||
      norm(t.pledgeClass) !== norm(c.pledgeClass) ||
      norm(t.name) !== norm(r.fullName) ||
      norm(t.pledgeName) !== norm(r.pledgeName)
      ? "Details differ from family tree"
      : "";
  }
  function render() {
    P.rosterData={classes,people,tree,links,accountLinks};
    document.dispatchEvent(new Event('p985:roster'));
    const root = P.root("roster");
    root.replaceChildren(
      P.header(
        "Master Roster",
        people.length + " brothers · All chapters, with or without an account",
      ),
    );
    const q = P.field("Search name or pledge name", "search", search),
      ch = P.select("Chapter", [["", "All chapters"], ...P.chapters], chapter);
    q.input.oninput = () => {
      search = q.input.value;
      draw();
    };
    ch.input.onchange = () => {
      chapter = ch.input.value;
      draw();
    };
    const filters=P.row(q.wrap,ch.wrap);filters.classList.add("p-roster-filters");root.append(filters);
    if (P.me.isAdmin)
      root.append(
        P.row(
          P.button("Add brother", () => edit()),
          P.button("Add class", () => editClass()),
          P.button('Review roster issues',()=>{
            const box=P.el('div'),duplicates=new Map();
            people.forEach(r=>{const key=r.classID+':'+norm(r.fullName);duplicates.set(key,[...(duplicates.get(key)||[]),r]);});
            const rows=people.filter(r=>{const c=classes.find(c=>c.id===r.classID);return !c||issue(r,c)||(duplicates.get(r.classID+':'+norm(r.fullName))||[]).length>1;});
            box.append(P.el('p','p-muted',rows.length+' entries need review. Review links individually; identities are never merged automatically.'));
            rows.forEach(r=>{const c=classes.find(c=>c.id===r.classID);const row=P.el('div','p-card');row.append(P.el('strong','',r.fullName+' · '+r.pledgeName),P.el('p','p-muted',!c?'Missing class':issue(r,c)||'Possible duplicate roster entry'));if(c)row.append(P.button('Compare records',()=>compare(r,c)));row.append(P.button('Edit entry',()=>edit(r)));box.append(row);});
            box.append(P.button('Export review list',()=>P.download('roster-review.csv',P.csv([['Full name','Pledge name','Class','Issue'],...rows.map(r=>{const c=classes.find(c=>c.id===r.classID);return [r.fullName,r.pledgeName,c?.pledgeClass||'',c?issue(r,c)||'Possible duplicate':'Missing class'];})]),'text/csv')));P.dialog('Roster review queue',box);
          }),
          P.button(
            issuesOnly ? "Show everyone" : "Review tree differences",
            () => {
              issuesOnly = !issuesOnly;
              render();
            },
          ),
        ),
      );
    const list = P.el("div", "p-roster-classes");
    root.append(list);
    function draw() {
      list.replaceChildren();
      const sorted = [...classes].sort(
        (a, b) =>
          P.chapters.indexOf(a.chapter) - P.chapters.indexOf(b.chapter) ||
          order(a.pledgeClass) - order(b.pledgeClass),
      );
      sorted
        .filter((c) => !chapter || c.chapter === chapter)
        .forEach((c) => {
          const roles = P.rosterClassRoles(people.filter(r => r.classID === c.id));
          const members = people.filter(
            (r) =>
              r.classID === c.id &&
              (!search ||
                (r.fullName + " " + r.pledgeName)
                  .toLowerCase()
                  .includes(search.toLowerCase())) &&
              (!issuesOnly || issue(r, c)),
          );
          if (!members.length && !P.me.isAdmin) return;
          if (!members.length && (search || issuesOnly)) return;
          const group = P.el("details", "p-roster-group"), h=P.el("summary","p-roster-summary");
          group.open=!!search || expandedClasses.has(c.id);
          group.addEventListener("toggle",()=>{if(search)return;if(group.open)expandedClasses.add(c.id);else expandedClasses.delete(c.id);});
          const label=P.el("span","p-roster-class-label");label.append(P.el("small","",c.chapter+" Chapter"),P.el("strong","",c.pledgeClass+" Class"));
          h.append(label,P.el("span","p-roster-count",members.length+(members.length===1?" brother":" brothers")),P.el("span","p-roster-chevron","⌄"));
          if (P.me.isAdmin)
            group.append(P.button("Edit class", () => editClass(c), "p-btn p-roster-edit-class"));
          group.prepend(h);
          members.forEach((r) => {
            const row = P.el("div", "p-roster-person"),
              info = P.el("div");
            const account = P.brothers.filter(
              (b) =>
                norm(b.chapter) === norm(c.chapter) &&
                (norm(P.name(b)) === norm(r.pledgeName) ||
                  norm([b.firstName, b.lastName].join(" ")) ===
                    norm(r.fullName)),
            );
            const num =
              r.pledgeNumber ||
              (account.length === 1 ? account[0].pledgeNumber : "");
            info.append(
              P.button(
                r.pledgeName +
                  (num !== undefined && num !== "" ? " #" + num : ""),
                () =>
                  account.length === 1
                    ? P.profile(account[0].uid)
                    : P.dialog(
                        r.pledgeName,
                        P.el(
                          "p",
                          "",
                          r.fullName +
                            " · " +
                            c.chapter +
                            " · " +
                            c.pledgeClass +
                            " Class" +
                            (r.fallen
                              ? " · Fallen Brother. May he rest in peace."
                              : "") +
                            (r.disaffiliated
                              ? " · Disaffiliated · Delettered"
                              : ""),
                        ),
                      ),
                "p-name",
              ),
              P.el("p", "p-muted", r.fullName),
            );
            if (roles.has(r.id)) {
              const badge=P.el('span','p-roster-role',roles.get(r.id));
              badge.title=roles.get(r.id)+' of the pledge class';
              info.insertBefore(badge,info.querySelector('p'));
            }
            if (r.fallen)
              info.append(
                P.el("p", "", "Fallen Brother · May he rest in peace."),
              );
            if (r.disaffiliated)
              info.append(P.el("p", "", "Disaffiliated · Delettered"));
            if (P.me.isAdmin && links[r.id]?.treeID) info.append(P.el("small", "p-muted", "Family-tree match selected"));
            if (P.me.isAdmin && issue(r, c))
              info.append(P.el("small", "", issue(r, c)));
            row.append(info);
            if (P.me.isAdmin)
              row.append(
                P.row(
                  P.button("Edit", () => edit(r)),
                  P.button("Compare tree", () => compare(r, c)),
                ),
              );
            group.append(row);
          });
          list.append(group);
        });
      if (!list.children.length)
        list.append(P.empty("No brothers match your search."));
    }
    draw();
  }
  function editClass(c) {
    const form = P.el("div"),
      chapter = P.select("Chapter", P.chapters, c?.chapter || "Alpha"),
      name = P.field("Class", "text", c?.pledgeClass);
    form.append(
      chapter.wrap,
      name.wrap,
      P.button(
        "Save class",
        () =>
          P.run(form, async () => {
            if (!name.input.value.trim()) throw Error("Enter a class name.");
            await db
              .collection("masterRosterClasses")
              .doc(c?.id || crypto.randomUUID())
              .set({
                chapter: chapter.input.value,
                pledgeClass: name.input.value.trim(),
              });
            d.close();
          }),
        "p-btn primary",
      ),
    );
    if (c)
      form.append(
        P.button(
          "Delete empty class",
          () =>
            P.run(form, async () => {
              if (people.some((r) => r.classID === c.id))
                throw Error(
                  "Move or remove all brothers before deleting this class.",
                );
              if (await P.confirm("Delete this empty class?")) {
                await db.doc("masterRosterClasses/" + c.id).delete();
                d.close();
              }
            }),
          "p-btn danger",
        ),
      );
    const d = P.dialog(c ? "Edit class" : "Add class", form);
  }
  function edit(r) {
    const form = P.el("div"),
      full = P.field("Full real name", "text", r?.fullName),
      pledge = P.field("Pledge name", "text", r?.pledgeName),
      num = P.field("Pledge number (optional)", "text", r?.pledgeNumber),
      cls = P.select(
        "Chapter and class",
        classes.map((c) => [c.id, c.chapter + " · " + c.pledgeClass]),
        r?.classID || classes[0]?.id,
      );
    num.input.pattern = "[0-9]{0,2}";
    num.input.maxLength = 2;
    form.append(full.wrap, pledge.wrap, num.wrap, cls.wrap);
    const flags = {};
    for (const [key, label] of [
      ["fallen", "Fallen Brother"],
      ["disaffiliated", "Disaffiliated / Delettered"],
    ]) {
      const f = P.field(label, "checkbox");
      f.input.checked = !!r?.[key];
      flags[key] = f.input;
      form.append(f.wrap);
    }
    form.append(
      P.button(
        "Save brother",
        () =>
          P.run(form, async () => {
            if (!full.input.value.trim() || !pledge.input.value.trim())
              throw Error("Enter both names.");
            if (!/^\d{0,2}$/.test(num.input.value))
              throw Error("Use up to two digits for the pledge number.");
            await db
              .collection("masterRoster")
              .doc(r?.id || crypto.randomUUID())
              .set({
                fullName: full.input.value.trim(),
                pledgeName: pledge.input.value.trim(),
                pledgeNumber: num.input.value,
                classID: cls.input.value,
                fallen: flags.fallen.checked,
                disaffiliated: flags.disaffiliated.checked,
                sourcePage: r?.sourcePage || 0,
              });
            d.close();
          }),
        "p-btn primary",
      ),
    );
    if (r)
      form.append(
        P.button(
          "Remove from roster",
          () =>
            P.run(form, async () => {
              if (
                await P.confirm(
                  "Remove this roster entry? The account and family tree will remain.",
                )
              ) {
                await db.doc("masterRoster/" + r.id).delete();
                d.close();
              }
            }),
          "p-btn danger",
        ),
      );
    const d = P.dialog(r ? "Edit roster entry" : "Add brother", form);
  }
  function compare(r, c) {
    const box = P.el("div");
    box.append(
      P.el("h3", "", "Roster"),
      P.el(
        "p",
        "",
        r.fullName +
          " · " +
          r.pledgeName +
          " · " +
          c.chapter +
          " · " +
          c.pledgeClass,
      ),
      P.button("Edit roster entry", () => {
        d.close();
        edit(r);
      }),
    );
    const linkedID = links[r.id]?.treeID;
    const possible = candidates(r);
    const linked = tree.find(t => t.id === linkedID);
    if (linked && !possible.some(t => t.id === linked.id)) possible.unshift(linked);
    box.append(P.el("p", "p-muted", "Choose the family-tree record that belongs to this brother. Your selection is saved; no names or family connections are changed."));
    async function saveLink(treeID) {
      await db.runTransaction(async tx => {
        const ref = db.doc("rosterTreeLinks/" + r.id);
        const latest = await tx.get(ref);
        if ((latest.data()?.treeID || "") !== (linkedID || "")) throw Error("Another admin changed this match. Close and reopen Compare tree to review it.");
        if (treeID) tx.set(ref,{treeID,updatedBy:P.uid,updatedAt:P.stamp()});
        else tx.delete(ref);
      });
      if (treeID) links[r.id] = {treeID}; else delete links[r.id];
      d.close(); render(); compare(r,c);
    }
    if (linkedID) box.append(P.button("Clear selected match", () => P.run(box, () => saveLink(""))));
    box.append(P.el("h3", "", "Family tree"));
    if (!possible.length)
      box.append(
        P.empty(
          "No matching name or pledge name. Add a record in Family Tree.",
        ),
      );
    possible.forEach((t) => {
      const card = P.el("div", "p-card");
      card.append(
        P.el(
          "p",
          "",
          t.name +
            " · " +
            t.pledgeName +
            " · " +
            t.chapter +
            " · " +
            t.pledgeClass,
        ),
        P.button("Edit tree entry", () => {
          const form = P.el("div"),
            fields = {};
          for (const key of ["name", "pledgeName", "chapter", "pledgeClass"]) {
            const f =
              key === "chapter"
                ? P.select("Chapter", P.chapters, t[key])
                : P.field(key, "text", t[key]);
            fields[key] = f.input;
            form.append(f.wrap);
          }
          form.append(
            P.button(
              "Save tree identity",
              () =>
                P.run(form, async () => {
                  const data = Object.fromEntries(
                    Object.entries(fields).map(([k, v]) => [k, v.value.trim()]),
                  );
                  if (Object.values(data).some((v) => !v))
                    throw Error("Complete all fields.");
                  await db.doc("familyTree/" + t.id).update(data);
                  editor.close();
                  d.close();
                }),
              "p-btn primary",
            ),
          );
          const editor = P.dialog("Edit family tree entry", form);
        }),
      );
      const select = P.button(t.id === linkedID ? "Linked to this record" : "Link this record", () => P.run(card, async () => {
        select.disabled = true;
        try {await saveLink(t.id);} finally {select.disabled = false;}
      }), t.id === linkedID ? "p-btn" : "p-btn primary");
      select.disabled = t.id === linkedID;
      card.append(select);
      if (t.id === linkedID) card.classList.add("p-roster-linked");
      box.append(card);
    });
    const d = P.dialog("Compare records", box);
  }
  P.ready(() => {
    P.watch(db.collection('rosterAccountLinks'),rows=>{accountLinks=Object.fromEntries(rows.map(r=>[r.id,r]));render();},P.root('roster'));
    P.watch(db.collection("rosterTreeLinks"), rows => { links = Object.fromEntries(rows.map(r => [r.id,r])); render(); }, P.root("roster"));
    P.watch(
      db.collection("masterRosterClasses"),
      (r) => {
        classes = r;
        render();
      },
      P.root("roster"),
    );
    P.watch(
      db.collection("masterRoster"),
      (r) => {
        people = r;
        render();
      },
      P.root("roster"),
    );
    P.watch(
      db.collection("familyTree"),
      (r) => {
        tree = r;
        render();
      },
      P.root("roster"),
    );
  });
  document.addEventListener("p985:people", () => {
    if (P.uid) render();
  });
})();
