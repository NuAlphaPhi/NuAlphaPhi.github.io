(function () {
  "use strict";
  const P = P985;
  let apps = [],
    audit = [],
    slots = {},
    owner = "",
    section = "Applications",
    offs = [];
  const seats = [
    ["national-president", "National President"],
    ["national-vicePresident", "National Vice President"],
    ["national-secretary", "National Secretary"],
    ["national-treasurer", "National Treasurer"],
    ["national-brandDirector", "National Brand Director"],
    ["national-eventCoordinator", "National Event Coordinator"],
    ["national-brotherhood", "National Brotherhood"],
    ["warden", "Pledge Warden"],
    ...P.chapters.flatMap((c) => [
      ["president-" + c, c + " Chapter President"],
      ["master-" + c + "-1", c + " Pledge Master 1"],
      ["master-" + c + "-2", c + " Pledge Master 2"],
    ]),
  ];
  function render() {
    const root = P.root("admin");
    root.replaceChildren(
      P.header(
        "Administration",
        "Membership, leadership, and the brotherhood’s shared spaces.",
      ),
    );
    const president = Object.keys(slots).some(
      (k) => k.startsWith("president-") && slots[k] === P.uid,
    );
    document.getElementById("adminNavBtn").hidden = !P.me.isAdmin && !president;
    if (!P.me.isAdmin && !president) {
      root.append(P.empty("Administrator access is required."));
      return;
    }
    const tabs = P.el("div", "p-tabs"),
      options = P.me.isAdmin
        ? [
            "Applications",
            "Events",
            "Leadership",
            "Actives & alumni",
            "Admins",
            "Activity",
          ]
        : ["Actives & alumni"];
    if (!options.includes(section)) section = options[0];
    options.forEach((t) =>
      tabs.append(
        P.button(
          t,
          () => {
            section = t;
            render();
          },
          "p-btn" + (section === t ? " selected" : ""),
        ),
      ),
    );
    root.append(tabs);
    const content = P.el("div");
    root.append(content);
    if (section === "Applications") {
      const pending = apps.filter((a) =>
        ["pending", "hold"].includes(a.status),
      );
      content.append(
        P.el("p", "p-muted", pending.length + " applications awaiting review"),
      );
      pending.forEach((a) => {
        const c = P.el("div", "p-card");
        c.append(
          P.el("h2", "", [a.firstName, a.lastName].filter(Boolean).join(" ")),
          P.el(
            "p",
            "",
            a.pledgeName +
              " · " +
              a.chapter +
              " · " +
              a.pledgeClass +
              " · #" +
              a.pledgeNumber,
          ),
          P.el(
            "p",
            "p-muted",
            [a.email, a.phone, a.status].filter(Boolean).join(" · "),
          ),
        );
        const note = P.field(
          "Review note / information needed",
          "textarea",
          a.reviewNote,
        );
        c.append(note.wrap);
        const buttons = P.row();
        for (const [decision, label] of [
          ["approved", "Approve"],
          ["declined", "Deny"],
          ["hold", "Hold"],
        ])
          buttons.append(
            P.button(
              label,
              () =>
                P.run(c, async () => {
                  await P.call("reviewMembership", {
                    uid: a.id,
                    decision,
                    note: note.input.value,
                  });
                }),
              decision === "approved" ? "p-btn primary" : "p-btn",
            ),
          );
        c.append(buttons);
        content.append(c);
      });
      if (!pending.length)
        content.append(P.empty("All applications have been reviewed."));
    }
    if (section === "Events") {
      content.append(
        P.button("Create event", () => P.editEvent(), "p-btn primary"),
      );
      const rows = P.events.filter((e) => e.status === "pending");
      content.append(P.el("h2", "", "Pending review"));
      rows.forEach((e) =>
        content.append(P.button(e.title, () => P.openEvent(e.id))),
      );
      if (!rows.length)
        content.append(P.empty("No events waiting for approval."));
      content.append(P.button("Manage all events", () => P.go("events")));
    }
    if (section === "Leadership") {
      for (const [slot, label] of seats) {
        const c = P.el("div", "p-card");
        c.append(P.el("h3", "", label));
        const incumbent = slots[slot];
        c.append(
          incumbent ? P.author(incumbent) : P.el("p", "p-muted", "Vacant"),
        );
        const can = !slot.startsWith("national-") || P.uid === owner;
        if (can)
          c.append(
            P.button("Assign / change", () =>
              choose(label, async (uid) =>
                P.call("manageLeadership", {
                  action: "assign",
                  slot,
                  uid,
                  expectedUid: incumbent || "",
                }),
              ),
            ),
            incumbent
              ? P.button("Clear position", () =>
                  P.run(c, () =>
                    P.call("manageLeadership", {
                      action: "assign",
                      slot,
                      uid: "",
                      expectedUid: incumbent,
                    }),
                  ),
                )
              : P.el("span"),
          );
        else
          c.append(
            P.el(
              "small",
              "",
              "Only the account owner can assign roles that grant admin access.",
            ),
          );
        content.append(c);
      }
      for (const [prefix, label] of [
        ["intern-", "National Interns"],
        ["advisor-", "Alumni Advisors"],
      ]) {
        const c = P.el("div", "p-card");
        c.append(
          P.el("h3", "", label),
          P.button("Add", () =>
            choose(
              label,
              async (uid) =>
                P.call("manageLeadership", {
                  action: "assign",
                  slot: prefix + uid,
                  uid,
                  expectedUid: slots[prefix + uid] || "",
                }),
              prefix === "advisor-"
                ? (b) => b.membershipStanding !== "active"
                : () => true,
            ),
          ),
        );
        Object.entries(slots)
          .filter(([s]) => s.startsWith(prefix))
          .forEach(([s, uid]) =>
            c.append(
              P.row(
                P.author(uid),
                P.button("Remove", () =>
                  P.run(c, () =>
                    P.call("manageLeadership", {
                      action: "assign",
                      slot: s,
                      uid: "",
                      expectedUid: uid,
                    }),
                  ),
                ),
              ),
            ),
          );
        content.append(c);
      }
    }
    if (section === "Actives & alumni") {
      const search = P.field("Search brother", "search"),
        list = P.el("div");
      content.append(search.wrap, list);
      function draw() {
        list.replaceChildren();
        P.brothers
          .filter(
            (b) =>
              (P.me.isAdmin || slots["president-" + b.chapter] === P.uid) &&
              (
                P.name(b) +
                " " +
                b.firstName +
                " " +
                b.lastName +
                " " +
                b.chapter
              )
                .toLowerCase()
                .includes(search.input.value.toLowerCase()),
          )
          .forEach((b) => {
            const r = P.row(
              P.author(b.uid),
              P.el(
                "small",
                "",
                b.chapter +
                  " · " +
                  (b.membershipStanding === "active" ? "Active" : "Alumni"),
              ),
              P.button(
                b.membershipStanding === "active"
                  ? "Mark alumni"
                  : "Mark active",
                () =>
                  P.run(content, () =>
                    P.call("manageLeadership", {
                      action: "standing",
                      uid: b.uid,
                      active: b.membershipStanding !== "active",
                    }),
                  ),
              ),
            );
            r.classList.add("p-card");
            list.append(r);
          });
      }
      search.input.oninput = draw;
      draw();
    }
    if (section === "Admins") {
      content.append(
        P.el(
          "p",
          "p-muted",
          P.uid === owner
            ? "Only you can grant or remove administrator access."
            : "Only the account owner can grant or remove administrator access.",
        ),
      );
      P.brothers
        .filter((b) => b.isAdmin)
        .forEach((b) => {
          const row = P.row(P.author(b.uid), P.el("small", "", b.chapter));
          row.classList.add("p-card");
          if (P.uid === owner && b.uid !== owner)
            row.append(
              P.button("Remove access", () =>
                P.run(content, async () => {
                  if (
                    await window.napConfirm(
                      "Remove administrator access from " + P.name(b) + "?",
                      { title: "Remove admin access", confirmLabel: "Remove" },
                    )
                  )
                    await P.call("manageLeadership", {
                      action: "admin",
                      uid: b.uid,
                      enabled: false,
                    });
                }),
              ),
            );
          content.append(row);
        });
      if (P.uid === owner)
        content.append(
          P.button(
            "Add admin",
            () =>
              choose("Give admin access", (uid) =>
                P.call("manageLeadership", {
                  action: "admin",
                  uid,
                  enabled: true,
                }),
              ),
            "p-btn primary",
          ),
        );
    }
    if (section === "Activity") {
      audit.forEach((a) => {
        const row = P.el("div", "p-card");
        row.append(
          P.el("strong", "", P.name(P.person(a.actor)) + " · " + a.action),
          P.el("p", "p-muted", P.when(a.createdAt)),
          P.el(
            "p",
            "",
            [a.slot, a.uid ? P.name(P.person(a.uid)) : "", a.resource]
              .filter(Boolean)
              .join(" · "),
          ),
        );
        content.append(row);
      });
      if (!audit.length) content.append(P.empty("No recent admin activity."));
    }
  }
  function choose(title, save, filter = () => true) {
    const box = P.el("div"),
      search = P.field("Search brothers", "search"),
      list = P.el("div", "p-suggestions");
    box.append(search.wrap, list);
    function draw() {
      list.replaceChildren();
      P.brothers
        .filter(
          (b) =>
            filter(b) &&
            (P.name(b) + " " + b.firstName + " " + b.lastName + " " + b.chapter)
              .toLowerCase()
              .includes(search.input.value.toLowerCase()),
        )
        .slice(0, 50)
        .forEach((b) =>
          list.append(
            P.button(
              P.name(b) + " · " + b.chapter,
              () =>
                P.run(box, async () => {
                  await save(b.uid);
                  d.close();
                }),
              "p-choice",
            ),
          ),
        );
    }
    search.input.oninput = draw;
    draw();
    const d = P.dialog(title, box);
  }
  function setup() {
    offs.forEach((f) => f());
    offs = [];
    if (P.me.isAdmin) {
      offs.push(
        P.watch(
          db.collection("membershipApplications"),
          (r) => {
            apps = r;
            render();
          },
          P.root("admin"),
        ),
        P.watch(
          db
            .collection("leadershipAudit")
            .orderBy("createdAt", "desc")
            .limit(100),
          (r) => {
            audit = r;
            render();
          },
          P.root("admin"),
        ),
      );
    } else {
      apps = [];
      audit = [];
    }
    render();
  }
  P.ready(() => {
    P.watch(
      db.doc("organization/leadership"),
      (d) => {
        slots = d?.slots || {};
        render();
      },
      P.root("admin"),
    );
    P.watch(
      db.doc("organization/adminAuthority"),
      (d) => {
        owner = d?.ownerUid || "";
        render();
      },
      P.root("admin"),
    );
    setup();
  });
  document.addEventListener("p985:access", () => {
    if (P.uid) setup();
  });
  document.addEventListener("p985:people", () => {
    if (P.uid) render();
  });
  document.addEventListener("p985:events", () => {
    if (P.uid) render();
  });
})();
