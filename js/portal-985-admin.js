(function () {
  "use strict";
  const P = P985;
  document.addEventListener("p985:roster",()=>{ if(section === "Roster discrepancies" && P.me.isAdmin) render(); });
  let accounts = [];
  let reports = [];
  let announcementRequests = [];
  let apps = [],
    audit = [],
    slots = {},
    owner = "",
    section = "Applications",
    offs = [];
  let selectedChapter = "Alpha", rosterSearch = "";
  const seats = [
    ["national-president", "National President"],
    ["national-vicePresident", "National Vice President"],
    ["national-secretary", "National Secretary"],
    ["national-treasurer", "National Treasurer"],
    ["national-brandDirector", "National Brand Director"],
    ["national-eventCoordinator", "National Event Coordinator"],
    ["national-brotherhood", "National Brotherhood"],
  ];
  function group(content, title, description) {
    const area = P.el("section", "p-admin-group");
    const header = P.el("div", "p-admin-section-heading");
    header.append(P.el("h2", "", title), P.el("p", "p-muted", description));
    const grid = P.el("div", "p-admin-grid");
    area.append(header, grid); content.append(area); return grid;
  }
  function seatCard(slot, label, chapter) {
    const c = P.el("div", "p-admin-seat");
    c.append(P.el("h3", "", label));
    const incumbent = slots[slot];
    c.append(incumbent ? P.author(incumbent) : P.el("p", "p-admin-vacant", "Not assigned"));
    const can = !slot.startsWith("national-") || P.uid === owner;
    if (can) {
      const actions = P.row(P.button(incumbent ? "Change" : "Assign brother", () =>
        choose(label, uid => P.call("manageLeadership", {action:"assign", slot, uid, expectedUid:incumbent || ""}), b => !chapter || b.chapter === chapter), "p-btn"));
      if (incumbent) actions.append(P.button("Remove", () => P.run(c, () => P.call("manageLeadership", {action:"assign", slot, uid:"", expectedUid:incumbent})), "p-btn p-admin-remove"));
      c.append(actions);
    } else c.append(P.el("small", "p-muted", "Only the account owner can change this position because it grants admin access."));
    return c;
  }
  function render() {
    const root = P.root("admin");
    root.classList.add("p-admin-page");
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
    const tabs = P.el("nav", "p-admin-nav"),
      options = P.me.isAdmin
        ? [
            "Applications",
            "Accounts",
            "Content reports",
            "Events",
            "Announcements",
            "Leadership",
            "Pledging",
            "Actives & alumni",
            "Alumni advisors",
            "Admins",
            "Activity",
            "Roster discrepancies",
          ]
        : ["Actives & alumni"];
    if (!options.includes(section)) section = options[0];
    const pendingCounts={'Applications':apps.filter(a=>['pending','hold'].includes(a.status)).length,'Content reports':reports.filter(r=>r.status==='open').length,'Events':(P.events||[]).filter(e=>e.status==='pending').length,'Announcements':announcementRequests.filter(r=>r.status==='pending').length};
    tabs.setAttribute('aria-label','Administration sections');
    for(const [label,sections] of [['Review',['Applications','Content reports','Events','Announcements']],['People',['Accounts','Leadership','Pledging','Actives & alumni','Alumni advisors','Admins']],['Records',['Roster discrepancies','Activity']]]){
      const available=sections.filter(t=>options.includes(t));if(!available.length)continue;
      const group=P.el('div','p-admin-nav-group');group.append(P.el('h2','',label));
      available.forEach(t=>{const button=P.button('',()=>{section=t;render();},'p-admin-nav-item');button.append(P.el('span','',t));if(pendingCounts[t])button.append(P.el('span','p-admin-nav-count',pendingCounts[t]));if(section===t)button.setAttribute('aria-current','page');group.append(button);});tabs.append(group);
    }
    const header=root.firstElementChild,headingText=P.el('div');headingText.append(...Array.from(header.childNodes));header.append(headingText);
    const layout=P.el('div','p-admin-layout');layout.append(tabs);root.append(layout);
    if(P.me.isAdmin)header.append(P.button('Permission preview',()=>choose('Choose a brother to inspect',async uid=>{
      const snap=await db.doc('socialAccess/'+uid).get(),grant=snap.data()||{},box=P.el('div'),person=P.person(uid);
      box.append(P.el('h3','',P.name(person)),P.el('p','p-muted','Current circle access is based on the server membership record. Administrator access does not automatically include every private circle.'));
      const roles=P.select('Preview role',['','president','pledgeMaster','pledgeWarden','nationalBoard','nationalIntern','alumniAdvisor'],grant.role||''),list=P.el('div');
      const draw=()=>{list.replaceChildren(...P985Policy.channels({...grant,role:roles.input.value,roles:roles.input.value===grant.role?grant.roles:[]}).map(r=>P.el('p','',r.title)));};
      roles.input.onchange=draw;box.append(roles.wrap,list,P.el('small','p-muted','Preview only. To change access, use the leadership or membership controls.'));draw();P.dialog('Permission preview',box);
    }),'p-admin-header-action'));

    const content = P.el("section", "p-admin-content");content.setAttribute('aria-label',section);layout.append(content);
    const title=P.el('header','p-admin-content-heading');title.append(P.el('h2','',section));
    if(pendingCounts[section])title.append(P.el('span','p-admin-nav-count',pendingCounts[section]+' to review'));
    content.append(title);
    if (section === "Roster discrepancies") {
      if(P.renderRosterDiscrepancies) P.renderRosterDiscrepancies(content);
      else content.append(P.empty("Loading roster records…"));
    }
    if (section === "Accounts") {
      const search = P.field("Search accounts", "search"), list = P.el("div", "p-admin-account-list");
      content.append(P.el("p", "p-muted", "Deactivation immediately blocks portal access. Reactivation restores sign-in. Deletion permanently removes the account and its associated personal data."), search.wrap, list);
      function draw() {
        list.replaceChildren();
        const query=search.input.value.trim().toLowerCase();
        const rows=accounts.filter(b=>[b.firstName,b.lastName,b.pledgeName,b.email,b.chapter].join(" ").toLowerCase().includes(query));
        rows.sort((a,b)=>(a.pledgeName||a.firstName||"").localeCompare(b.pledgeName||b.firstName||""));
        rows.forEach(b=>{
          const uid=b.id, card=P.el("div", "p-card"), name=[b.firstName,b.lastName].filter(Boolean).join(" ")||b.pledgeName||"Brother";
          card.append(P.el("h3", "", name+(b.pledgeName?" · "+b.pledgeName:"")),P.el("p", "p-muted", [b.email,b.chapter].filter(Boolean).join(" · ")),P.el("strong", "", b.deletionRequestedAt?"Deleting…":b.disabled?"Deactivated":"Active"));
          if(uid===owner||uid===P.uid||b.isAdmin&&P.uid!==owner)card.append(P.el("p", "p-muted", uid===owner?"Protected owner account":uid===P.uid?"Your account":"Only the owner can manage this administrator."));
          else if(!b.deletionRequestedAt){
            const actions=P.row();
            actions.append(P.button(b.disabled?"Reactivate":"Deactivate",()=>accountAction(b,b.disabled?"reactivate":"deactivate"),"p-btn"),P.button("Delete account",()=>accountAction(b,"delete"),"p-btn p-admin-remove"));card.append(actions);
          }
          list.append(card);
        });
        if(!rows.length)list.append(P.empty("No matching accounts."));
      }
      search.input.oninput=draw;draw();
    }
    if (section === "Applications") {
      const pending = apps.filter((a) =>
        ["pending", "hold"].includes(a.status),
      );
      if(pending.length)content.append(P.el("p","p-muted","Review membership requests and welcome new brothers."));
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
        {const empty=P.el('div','p-admin-empty');empty.append(P.el('span','p-admin-empty-icon','✓'),P.el('h3','','You’re all caught up'),P.el('p','','New membership applications will appear here for review.'));content.append(empty);}
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
    if (section === "Content reports") {
      content.append(P.el("h2","","Content reports"),P.el("p","p-muted","Review reported content promptly. Remove content that violates community standards or dismiss the report."));
      const pending = reports.filter(r => r.status === "open");
      if (!pending.length) content.append(P.empty("No reports awaiting review."));
      pending.forEach(r => {
        const card = P.el("article","p-card");
        card.append(P.el("h3","",r.reason),P.el("p","",r.body),P.el("p","p-muted",r.details));
        if (r.photoPath) card.append(P.image(r.photoPath));
        for (const [action,label] of [["remove","Remove content"],["dismiss","Dismiss report"]]) card.append(P.button(label, () => P.run(card, () => P.call("reviewContentReport",{id:r.id,action})),action === "remove" ? "p-btn danger":"p-btn"));
        content.append(card);
      });
    }
    if (section === "Announcements") {
      content.append(P.el("h2", "", "Announcement requests"), P.el("p", "p-muted", "Approved announcements appear in Home and Announcements, with the original brother as the author."));
      const pending = announcementRequests.filter(r => r.status === "pending");
      if (!pending.length) content.append(P.empty("No announcements waiting for approval."));
      pending.forEach(item => {
        const card = P.el("article", "p-card");
        card.append(P.author(item.authorUid, item.authorName), P.el("small", "p-muted", item.chapter + " · " + P.when(item.createdAt)), P.text(item.body,item));
        if (item.photoPath) card.append(P.image(item.photoPath));
        const actions = P.row();
        [["approve", "Approve & publish"], ["decline", "Decline"]].forEach(([action,label]) => {
          const button = P.button(label, () => P.run(card, async () => {
            [...actions.querySelectorAll("button")].forEach(b => b.disabled = true);
            try { await P.call("announcementAction", {action,id:item.id}); }
            finally { [...actions.querySelectorAll("button")].forEach(b => b.disabled = false); }
          }), action === "approve" ? "p-btn primary" : "p-btn");
          actions.append(button);
        });
        card.append(actions); content.append(card);
      });
    }
    if (section === "Leadership") {
      const national = group(content, "National board", "Assign national officers and interns.");
      seats.forEach(([slot,label]) => national.append(seatCard(slot,label)));
      const presidents = group(content, "Chapter presidents", "One president for each chapter, Alpha through Kappa.");
      P.chapters.forEach(chapter => presidents.append(seatCard("president-" + chapter, chapter + " Chapter President", chapter)));
    }
    if (section === "Pledging") {
      group(content, "National pledge warden", "One warden oversees pledging across the organization.").append(seatCard("warden", "National Pledge Warden"));
      P.chapters.forEach(chapter => {
        const grid = group(content, chapter + " Chapter", "Two pledge master positions.");
        [1,2].forEach(n => grid.append(seatCard("master-" + chapter + "-" + n, "Pledge Master " + n, chapter)));
      });
    }
    if (section === "Leadership" || section === "Alumni advisors") {
      for (const [prefix, label] of [
        ...(section === "Leadership" ? [["intern-", "National Interns"]] : [["advisor-", "Alumni Advisors"]]),
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
      const chapters = P.chapters.filter(c => P.me.isAdmin || slots["president-" + c] === P.uid);
      if (!chapters.includes(selectedChapter)) selectedChapter = chapters[0];
      content.append(P.el("h2", "", "Chapter active roster"), P.el("p", "p-muted", "Select the active brothers in each chapter. Everyone not selected is alumni. Changes save immediately."));
      const chapterTabs = P.el("div", "p-admin-chapters");
      chapters.forEach(c => {
        const button = P.button(c, () => {selectedChapter = c; rosterSearch = ""; render();}, "p-btn" + (selectedChapter === c ? " selected" : ""));
        button.setAttribute("aria-pressed", String(selectedChapter === c)); chapterTabs.append(button);
      });
      const search = P.field("Search this chapter", "search", rosterSearch), list = P.el("div", "p-admin-roster"), summary = P.el("p", "p-admin-roster-count");
      content.append(chapterTabs, search.wrap, summary, list);
      function draw() {
        const members = P.brothers.filter(b => b.chapter === selectedChapter).sort((a,b) => P.name(a).localeCompare(P.name(b)));
        const activeCount = members.filter(b => b.membershipStanding === "active").length;
        summary.textContent = selectedChapter + " Chapter · " + activeCount + " active · " + (members.length - activeCount) + " alumni";
        list.replaceChildren();
        members.filter(b => (P.name(b) + " " + b.firstName + " " + b.lastName + " " + b.pledgeClass).toLowerCase().includes(rosterSearch.toLowerCase())).forEach(b => {
          const row = P.el("div", "p-admin-roster-row"), info = P.el("div");
          info.append(P.author(b.uid), P.el("small", "p-muted", [b.firstName,b.lastName].filter(Boolean).join(" ") + (b.pledgeClass ? " · " + b.pledgeClass + " Class" : "")));
          const label = P.el("label", "p-admin-standing"), check = P.el("input");
          check.type = "checkbox"; check.checked = b.membershipStanding === "active";
          check.setAttribute("aria-label", "Active status for " + P.name(b));
          const status = P.el("span", "", check.checked ? "Active" : "Alumni");
          check.onchange = () => {
            const next = check.checked; check.disabled = true; status.textContent = "Saving…";
            P.run(row, async () => {
              try {
                await P.call("manageLeadership", {action:"standing", uid:b.uid, active:next});
                b.membershipStanding = next ? "active" : "alumni"; draw();
              } catch (error) {
                check.checked = !next; status.textContent = check.checked ? "Active" : "Alumni"; throw error;
              } finally {check.disabled = false;}
            });
          };
          label.append(check,status); row.append(info,label); list.append(row);
        });
        if (!list.childElementCount) list.append(P.empty(members.length ? "No brothers match your search." : "No accounts in this chapter yet."));
      }
      search.input.oninput = () => {rosterSearch = search.input.value; draw();}; draw();
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
      const filter=P.field('Search audit history','search');content.append(filter.wrap);filter.input.oninput=()=>content.querySelectorAll('.p-card').forEach(r=>{r.hidden=!r.textContent.toLowerCase().includes(filter.input.value.toLowerCase());});
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
        if(a.before||a.after){const detail=P.el('details'),summary=P.el('summary','','Before / after');detail.append(summary,P.el('pre','p-text',JSON.stringify({before:a.before||{},after:a.after||{}},null,2)));row.append(detail);}
        content.append(row);
      });
      if (!audit.length) content.append(P.empty("No recent admin activity."));
    }
  }
  function accountAction(b, action) {
    const name=[b.firstName,b.lastName].filter(Boolean).join(" ")||b.pledgeName||"this brother";
    const box=P.el("div"), destructive=action==="delete";
    box.append(P.el("p", "", destructive?"Permanently delete "+name+"? Their account and associated personal data will be removed. This cannot be undone.":action==="deactivate"?"Deactivate "+name+"? Their access will be blocked and their connected portal session will sign out.":"Restore sign-in for "+name+"? They will need to log in again."));
    let confirmation;
    if(destructive){confirmation=P.field("Type DELETE to confirm", "text");box.append(confirmation.wrap);}
    const button=P.button(destructive?"Permanently delete":action==="deactivate"?"Deactivate account":"Reactivate account",()=>P.run(box,async()=>{
      if(destructive&&confirmation.input.value!=="DELETE")throw new Error("Type DELETE to confirm.");
      button.disabled=true;
      try{await P.call("adminAccountAction",{uid:b.id,action,confirmation:confirmation?.input.value||""});dialog.close();}finally{button.disabled=false;}
    }),"p-btn"+(destructive?" p-admin-remove":""));
    box.append(button);
    const dialog=P.dialog(destructive?"Delete account":action==="deactivate"?"Deactivate account":"Reactivate account",box);
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
  P.reviewReports = () => {section = "Content reports"; render(); P.go("admin");};
  P.reviewAnnouncements = () => {section = "Announcements"; render(); P.go("admin");};
  function setup() {
    offs.forEach((f) => f());
    offs = [];
    if (P.me.isAdmin) {
      offs.push(
        P.watch(db.collection("users"), rows => {accounts = rows; render();}, P.root("admin")),
        P.watch(db.collection("contentReports"), rows => {reports = rows; render();}, P.root("admin")),
        P.watch(db.collection("announcementRequests"), rows => {announcementRequests = rows; render();}, P.root("admin")),
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
      accounts = [];
      reports = [];
      announcementRequests = [];
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
