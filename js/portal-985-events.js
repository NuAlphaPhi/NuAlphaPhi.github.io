(function () {
  "use strict";
  const P = P985;
  let all = new Map(),
    queries = [],
    filter = "upcoming";
  P.events = [];
  let view = "list", calendarMonth = new Date();
  function render() {
    const root = P.root("events");
    root.replaceChildren(
      P.row(
        P.header("Events", "Make plans. Bring the brotherhood together."),
        P.button(
          P.me.isAdmin ? "Create event" : "Submit event",
          () => P.editEvent(),
          "p-btn primary",
        ),
      ),
    );
    root.firstElementChild.classList.add("p-events-heading");
    const tabs = P.el("div", "p-event-filters");
    [
      "upcoming",
      "completed",
      "mine",
      ...(P.me.isAdmin ? ["pending"] : []),
    ].forEach((t) =>
      tabs.append(
        P.button(
          t[0].toUpperCase() + t.slice(1),
          () => {
            filter = t;
            render();
          },
          "p-event-filter" + (filter === t ? " selected" : ""),
        ),
      ),
    );
    tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('selected'))));
    tabs.append(P.button(view === 'list' ? 'Calendar' : 'List',()=>{view=view==='list'?'calendar':'list';render();},'p-event-view-toggle'));
    root.append(tabs);
    const grid = P.el("div", "p-grid");
    P.events = [...all.values()].filter((e) => e.status !== "deleted");
    let rows = P.events.filter((e) =>
      filter === "pending"
        ? e.status === "pending"
        : filter === "mine"
          ? e.hostUid === P.uid ||
            e.collaboratorIds?.includes(P.uid) ||
            e.invitedIds?.includes(P.uid)
          : e.status === "published" &&
            (filter === "upcoming"
              ? P.date(e.end || e.start) >= new Date()
              : P.date(e.end || e.start) < new Date()),
    );
    rows.sort((a, b) =>
      filter === "completed"
        ? P.date(b.start) - P.date(a.start)
        : P.date(a.start) - P.date(b.start),
    );
    if(view==='calendar') { P.renderCalendar(root,rows,calendarMonth,d=>{calendarMonth=d;render();});document.dispatchEvent(new Event('p985:events'));return; }
    rows.forEach((e) => {
      const card = P.el("article", "p-card p-event-card");
      card.append(
        P.image(e.coverPath, "p-event-cover", e.title),
        P.el("span", "p-event-status", e.status.charAt(0).toUpperCase()+e.status.slice(1)),
        P.el("h2", "", e.title),
        P.el("p", "p-muted", P.when(e.start)),
        P.el("p", "", e.locationTBD ? "Location to be announced" : e.location),

      );
      const footer=P.el('div','p-event-card__footer');
      footer.append(P.el('span','p-event-card__capacity',(e.reservedSeats||0)+(e.capacity?' of '+e.capacity:'')+' reserved'+(e.waitlistCount?' · '+e.waitlistCount+' waitlisted':'')),P.button('View event →',()=>P.openEvent(e.id),'p-event-card__open'));
      card.append(footer);grid.append(card);
    });
    root.append(grid);
    if (!rows.length) root.append(P.empty("No events here yet."));
    document.dispatchEvent(new Event("p985:events"));
  }
  function subscribe() {
    queries.forEach((fn) => fn());
    queries = [];
    all = new Map();
    const groups = new Map();
    function listen(key, q) {
      queries.push(
        P.watch(
          q,
          (rows) => {
            groups.set(key, rows);
            all = new Map([...groups.values()].flat().map((e) => [e.id, e]));
            render();
          },
          P.root("events"),
        ),
      );
    }
    listen(
      "public",
      db.collection("appEvents").where("status", "==", "published"),
    );
    listen("own", db.collection("appEvents").where("hostUid", "==", P.uid));
    listen(
      "cohost",
      db
        .collection("appEvents")
        .where("collaboratorIds", "array-contains", P.uid),
    );
    listen(
      "invite",
      db.collection("appEvents").where("invitedIds", "array-contains", P.uid),
    );
    if (P.me.isAdmin)
      listen(
        "pending",
        db.collection("appEvents").where("status", "==", "pending"),
      );
  }
  P.editEvent = (event) => {
    const form = P.el("form"),
      f = {};
    const local = (t) => {
      if (!t) return "";
      const d = P.date(t);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    for (const [k, label, type, value] of [
      ["title", "Event title", "text", event?.title],
      ["description", "About the event", "textarea", event?.description],
      [
        "start",
        "Starts (your local time)",
        "datetime-local",
        local(event?.start),
      ],
      [
        "end",
        "Ends (optional, your local time)",
        "datetime-local",
        local(event?.end),
      ],
      [
        "deadline",
        "RSVP deadline (your local time)",
        "datetime-local",
        local(event?.deadline),
      ],
      ["location", "Location", "text", event?.location],
      [
        "capacity",
        "Total capacity, including plus-ones (blank = unlimited)",
        "number",
        event?.capacity,
      ],
      [
        "plusOneLimit",
        "Plus-ones per brother (blank = unlimited)",
        "number",
        event?.plusOneLimit,
      ],
    ]) {
      f[k] = P.field(label, type, value);
      if (["start","end","capacity","plusOneLimit"].includes(k)) f[k].wrap.classList.add("p-event-half");
      form.append(f[k].wrap);
    }
    f.title.input.maxLength = 120;
    f.description.input.maxLength = 3000;
    for (const [k, label] of [
      ["locationTBD", "Location to be announced"],
      ["plusOnes", "Allow plus-ones"],
    ]) {
      const l = P.el("label", "p-check"),
        i = P.el("input");
      i.type = "checkbox";
      i.checked = !!event?.[k];
      f[k] = { input: i };
      l.append(i, document.createTextNode(label));
      form.append(l);
    }
    const file = P.field(
      event ? "Replace square cover (optional)" : "Square cover photo",
      "file",
    );
    file.input.accept = "image/*";
    const crop = P.el("div", "p-event-crop");
    crop.hidden = true;
    const canvas = P.el("canvas");
    canvas.width = canvas.height = 1200;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Event cover crop. Drag or use arrow keys to reposition.");
    const zoom = P.el("input");
    zoom.type = "range"; zoom.min = 1; zoom.max = 4; zoom.step = .01; zoom.value = 1;
    zoom.setAttribute("aria-label", "Zoom event cover");
    let coverBitmap = null, rotation = 0, offsetX = 0, offsetY = 0, drag = null, loadingCover = false, coverRevision = 0, closed = false;
    function drawCover() {
      if (!coverBitmap) return;
      const swapped = rotation % 180 !== 0;
      const width = swapped ? coverBitmap.height : coverBitmap.width;
      const height = swapped ? coverBitmap.width : coverBitmap.height;
      const scale = Math.max(1200 / width, 1200 / height) * Number(zoom.value);
      offsetX = Math.max(-(width * scale - 1200) / 2, Math.min((width * scale - 1200) / 2, offsetX));
      offsetY = Math.max(-(height * scale - 1200) / 2, Math.min((height * scale - 1200) / 2, offsetY));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1200, 1200); ctx.save();
      ctx.translate(600 + offsetX, 600 + offsetY); ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(coverBitmap, -coverBitmap.width * scale / 2, -coverBitmap.height * scale / 2, coverBitmap.width * scale, coverBitmap.height * scale);
      ctx.restore();
    }
    function resetCover() { rotation = offsetX = offsetY = 0; zoom.value = 1; drawCover(); }
    zoom.oninput = drawCover;
    canvas.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY }; canvas.setPointerCapture(e.pointerId); };
    canvas.onpointermove = e => { if (!drag) return; const scale = 1200 / canvas.getBoundingClientRect().width; offsetX = drag.ox + (e.clientX - drag.x) * scale; offsetY = drag.oy + (e.clientY - drag.y) * scale; drawCover(); };
    canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
    canvas.onkeydown = e => { const move = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[e.key]; if (move) { e.preventDefault(); offsetX += move[0]; offsetY += move[1]; drawCover(); } };
    crop.append(canvas, P.el("small", "p-muted", "Drag to reposition · Zoom to frame your cover"), zoom,
      P.row(P.button("Rotate", () => { rotation = (rotation + 90) % 360; offsetX = offsetY = 0; drawCover(); }), P.button("Reset crop", resetCover)));
    file.input.onchange = () => P.run(form, async () => {
      const chosen = file.input.files?.[0]; if (!chosen) return;
      const revision = ++coverRevision; loadingCover = true; send.disabled = true;
      try {
        if (!chosen.type.startsWith("image/") || chosen.size > 20 * 1024 * 1024) throw Error("Choose an image under 20 MB.");
        const bitmap = await createImageBitmap(chosen);
        if (closed || revision !== coverRevision) { bitmap.close(); return; }
        coverBitmap?.close(); coverBitmap = bitmap; resetCover(); crop.hidden = false;
      } catch (error) { file.input.value = ""; throw error; }
      finally { if (revision === coverRevision) { loadingCover = false; send.disabled = false; } }
    });
    form.append(file.wrap, crop);
    const selected = new Set([
        ...(event?.collaboratorIds || []),
        ...(event?.invitedIds || []),
      ]),
      search = P.field("Invite collaborators — search brothers"),
      matches = P.el("div", "p-suggestions"),
      names = P.el("p", "p-muted");
    form.append(search.wrap, matches, names);
    function pick() {
      names.textContent = [...selected]
        .map((id) => P.name(P.person(id)))
        .join(", ");
      matches.replaceChildren();
      if (!search.input.value) return;
      P.brothers
        .filter(
          (b) =>
            b.uid !== (event?.hostUid || P.uid) &&
            (P.name(b) + " " + b.firstName + " " + b.lastName)
              .toLowerCase()
              .includes(search.input.value.toLowerCase()),
        )
        .slice(0, 8)
        .forEach((b) =>
          matches.append(
            P.button(
              (selected.has(b.uid) ? "✓ " : "") + P.name(b),
              () => {
                selected.has(b.uid)
                  ? selected.delete(b.uid)
                  : selected.add(b.uid);
                pick();
              },
              "p-choice",
            ),
          ),
        );
    }
    search.input.oninput = pick;
    pick();
    const status = P.el("p", "p-muted"),
      id = event?.id || crypto.randomUUID();
    let requestID = crypto.randomUUID();
    const send = P.button(
      event
        ? "Save changes"
        : P.me.isAdmin
          ? "Publish event"
          : "Submit for approval",
      () => form.requestSubmit(),
      "p-btn primary",
    );
    form.append(status, send);
    form.classList.add("p-event-editor");
    const d = P.dialog(event ? "Edit event" : "New event", form);
    d.classList.add("p-event-editor-dialog");
    d.cleanup = () => { closed = true; coverRevision++; coverBitmap?.close(); };
    form.onsubmit = (e) => {
      e.preventDefault();
      P.run(form, async () => {
        send.disabled = true;
        file.input.disabled = true;
        crop.inert = true;
        try {
          let coverPath = event?.coverPath || "";
          if (loadingCover) throw Error("Wait for the photo to finish loading.");
          if (coverBitmap) {
            const cropped = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .92));
            if (!cropped) throw Error("Could not prepare this photo. Please choose it again.");
            coverPath = await P.upload(
              cropped,
              "eventCovers/" + P.uid + "/" + crypto.randomUUID() + ".jpg",
              status,
            );
          }
          if (!coverPath) throw Error("Add a cover photo.");
          const payload = Object.fromEntries(
            ["title", "description", "location"].map((k) => [
              k,
              f[k].input.value.trim(),
            ]),
          );
          for (const k of ["start", "deadline"]) {
            payload[k] =
              event?.[k] && f[k].input.value === local(event[k])
                ? P.date(event[k]).getTime()
                : new Date(f[k].input.value).getTime();
            if (!Number.isFinite(payload[k]))
              throw Error("Choose the start and RSVP deadline.");
          }
          payload.end = f.end.input.value
            ? new Date(f.end.input.value).getTime()
            : null;
          for (const k of ["capacity", "plusOneLimit"])
            payload[k] = f[k].input.value ? Number(f[k].input.value) : null;
          for (const k of ["locationTBD", "plusOnes"])
            payload[k] = f[k].input.checked;
          await P.call("eventAction", {
            action: event ? "edit" : "create",
            eventID: id,
            requestID,
            ...payload,
            coverPath,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            invitedIds: [...selected],
          });
          d.close();
          P.openEvent(id);
        } finally {
          send.disabled = false;
          file.input.disabled = false;
          crop.inert = false;
        }
      });
    };
  };
  P.openEvent = (id) => {
    const box = P.el("div", "p-event-detail");
    const page=P.root('event-detail');
    page.replaceChildren(P.button('← All events',()=>P.go('events')),box);
    window.napSetTab('event-detail','events');
    const dialog={close:()=>P.go('events')};
    P.run(box, async () => {
      const snap = await db.doc("appEvents/" + id).get();
      if (!snap.exists || snap.data().status === "deleted")
        throw Error("This event is unavailable.");
      const e = { id, ...snap.data() },
        organizer = e.hostUid === P.uid || e.collaboratorIds?.includes(P.uid);
      const hero=P.el('div','p-event-hero'),intro=P.el('div','p-event-intro');
      intro.append(P.el('span','p-event-eyebrow','BROTHERHOOD EVENT'),P.el('h1','',e.title),P.author(e.hostUid,e.hostName));
      const facts=P.el('div','p-event-facts');
      facts.append(P.el('p','',P.when(e.start)+(e.end?' — '+P.when(e.end):'')),P.el('p','',e.locationTBD?'Location to be announced':e.location));
      intro.append(facts);hero.append(P.image(e.coverPath,'p-event-cover',e.title),intro);box.append(hero);
      const about=P.el('section','p-event-about');about.append(P.el('h2','','About the event'),P.text(e.description));box.append(about);
      const limits=P.el('p','p-event-limits','RSVP by '+P.when(e.deadline)+' · '+(e.capacity?(e.reservedSeats||0)+'/'+e.capacity+' places reserved':'No capacity limit')+' · '+(e.plusOnes?'Plus-ones welcome'+(e.plusOneLimit?' (up to '+e.plusOneLimit+')':''):'No plus-ones'));
      box.append(limits);
      const actions = P.row();actions.classList.add("p-event-actions");
      if (organizer || P.me.isAdmin)
        actions.append(
          P.button("Edit", () => {
            dialog.close();
            P.editEvent(e);
          }),
          P.button(
            "Delete event",
            () =>
              P.run(box, async () => {
                if (
                  await P.confirm(
                    "Delete this event and remove it from the feed?",
                  )
                ) {
                  await P.event("delete", id);
                  dialog.close();
                }
              }),
            "p-btn danger",
          ),
        );
      if (e.status === "pending" && P.me.isAdmin)
        actions.append(
          P.button("Approve", () => review("approve"), "p-btn primary"),
          P.button("Decline", () => review("decline")),
        );
      async function review(decision) {
        P.run(box, async () => {
          const note =
            decision === "decline"
              ? window.prompt("Reason or changes needed (optional)") || ""
              : "";
          await P.event("review", id, { decision, note });
          dialog.close();
          P.openEvent(id);
        });
      }
      if (e.invitedIds?.includes(P.uid))
        actions.append(
          P.button("Accept cohost invitation", () =>
            P.run(box, async () => {
              await P.event("collaborate", id, { accept: true });
              dialog.close();
              P.openEvent(id);
            }),
          ),
        );
      const management=P.el('details','p-event-management'),managementMenu=P.el('div','p-event-management-menu');
      const manageLabel=P.el('summary','','');manageLabel.title='Manage event';manageLabel.setAttribute('aria-label','Manage event');manageLabel.append(P.icon('settings'),P.el('span','','Manage'));management.append(manageLabel,managementMenu);
      while(actions.firstChild)managementMenu.append(actions.firstChild);
      if(managementMenu.childElementCount)actions.append(management);
      if (e.status === "published") {
        actions.append(
          P.eventAction("Copy link", "link", () =>
            P.run(box, async () => {
              await navigator.clipboard.writeText(
                "https://nualphaphi.com/event/" + id,
              );
              P.toast("Link copied");
            }),
          ),
        );
        const a = P.el("a", "p-btn p-event-icon-action");a.title="Public event page";a.setAttribute("aria-label","Public event page");a.append(P.icon("external"),P.el("span","","Public page"));
        a.href = "/event/" + encodeURIComponent(id);
        a.target = "_blank";
        a.rel = "noopener";
        actions.append(a);
      }
      if(organizer && e.hostUid!==P.uid && !P.me.isAdmin) managementMenu.querySelector('.danger')?.remove();
      box.append(actions);
      if(e.status==='published'){
        const tools=P.el('div','p-event-tools');box.append(tools);P.eventTools(e,tools);const quick=tools.querySelector('.p-event-quick-actions');if(quick)actions.prepend(quick);
        if(organizer||P.me.isAdmin)managementMenu.append(P.button('Send attendee announcement',()=>{
          const content=P.el('div'),field=P.field('Announcement','textarea');field.input.maxLength=1500;
          content.append(field.wrap,P.button('Send to attendees',()=>P.run(content,async()=>{await P.event('announce',id,{body:field.input.value});d.close();P.toast('Announcement sent');})));const d=P.dialog('Event announcement',content);
        }));
      }
      if (e.status !== "published") {
        box.append(P.empty("Status: " + e.status));
        return;
      }
      const rsvp = P.el("div", "p-card p-event-rsvp"),
        community = P.el("div", "p-event-community"),
        guests = P.el("div");
      const own = await P.event("attendance", id);
      rsvp.append(
        P.el("h3", "", "Your RSVP"),
        P.el("p", "", (own.status || "Not responded")+(own.waitlistPosition?' · Waitlist position '+own.waitlistPosition:'')+' · Party of '+(own.partySize||1)),
      );
      const status = P.select(
        "Response",
        [
          ["going", "Going"],
          ["maybe", "Maybe"],
          ["busy", "Busy"],
        ],
        ["going", "maybe", "busy"].includes(own.status) ? own.status : "going",
      );
      rsvp.append(status.wrap);
      const guestRows = [];
      function addGuest(g = {}) {
        const row = P.el("div", "p-card"),
          name = P.field("Guest full name", "text", g.name),
          phone = P.field("Guest phone", "tel", g.phone);
        const item = { row, name, phone };
        guestRows.push(item);
        row.append(
          name.wrap,
          phone.wrap,
          P.button("Remove", () => {
            guestRows.splice(guestRows.indexOf(item), 1);
            row.remove();
          }),
        );
        guests.append(row);
      }
      if (e.plusOnes) {
        rsvp.append(
          guests,
          P.button("Add plus-one", () => addGuest()),
        );
        (own.guests || []).forEach(addGuest);
      }
      rsvp.append(
        P.button(
          "Save RSVP",
          () =>
            P.run(rsvp, async () => {
              await P.event("rsvp", id, {
                status: status.input.value,
                guests:
                  status.input.value === "going"
                    ? guestRows.map((g) => ({
                        name: g.name.input.value,
                        phone: g.phone.input.value,
                      }))
                    : [],
              });
              dialog.close();
              P.openEvent(id);
            }),
          "p-btn primary",
        ),
      );
      const body=P.el('div','p-event-body');body.append(community,rsvp);box.append(body);
      await loadCommunity();
      async function loadCommunity() {
        community.replaceChildren();
        const c = await P.event("conversation", id);
        if (c.attendeesUnlocked) {
          const attendance = P.el("div", "p-card p-event-attendees");
          attendance.append(P.el("h3", "", "Guest list"));
          community.append(attendance);
          await attendees(attendance);
        } else
          community.append(
            P.empty("RSVP to see who is going, maybe, busy, or waitlisted."),
          );
        const rows = P.el("div", "p-event-activity");
        community.append(P.el("h3", "", "Conversation"),rows);
        function drawRows(data) {
          data.rows.forEach((r) => {
            const item = P.el("div", r.kind === "comment" ? "p-event-comment" : "p-event-system-note");
            item.append(
              P.el("strong", "", r.name),
              P.el("small", "", " · " + P.when(r.createdAt)),
              P.text(
                r.kind === "comment"
                  ? r.body
                  : r.name +
                      " RSVP’d " +
                      r.status +
                      (r.plusOneCount
                        ? " · " + r.plusOneCount + " guests"
                        : ""),
              ),
            );
            if (r.kind === "comment")
              item.append(
                P.button("❤️ " + (r.reactions?.["❤️"] || ""), () =>
                  P.run(item, async () => {
                    await P.event("react", id, {
                      commentID: r.id,
                      emoji: r.myReaction === "❤️" ? "" : "❤️",
                    });
                    await loadCommunity();
                  }),
                ),
              );
            rows.append(item);
          });
          if (data.next) {
            const more = P.button("More conversation", () =>
              P.run(rows, async () => {
                more.remove();
                drawRows(
                  await P.event("conversation", id, { cursor: data.next }),
                );
              }),
            );
            rows.append(more);
          }
        }
        drawRows(c);
        const comment = P.field("Leave a comment", "textarea");
        comment.input.maxLength = 1500;
        community.append(
          comment.wrap,
          P.button(
            "Comment",
            () =>
              P.run(community, async () => {
                await P.event("comment", id, { body: comment.input.value });
                await loadCommunity();
              }),
            "p-btn primary",
          ),
        );
      }
      async function attendees(root, cursor) {
        const data = await P.event("attendees", id, { cursor });
        for (const status of ["going", "maybe", "busy", "waitlist"]) {
          const people = data.rows.filter((p) => p.status === status);
          if (!people.length) continue;
          root.append(P.el("h4", "", ({going:"Going",maybe:"Maybe",busy:"Not going",waitlist:"Waitlisted"})[status]));
          people.forEach((p) =>
            root.append(
              P.row(
                P.button(p.name, () => P.profile(p.id), "p-name"),
                P.el(
                  "small",
                  "",
                  p.chapter + (p.plusOneCount ? " · +" + p.plusOneCount : ""),
                ),
              ),
            ),
          );
        }
        if (data.next) {
          const more = P.button("More guests", () =>
            P.run(root, async () => {
              more.remove();
              await attendees(root, data.next);
            }),
          );
          root.append(more);
        }
      }
    });
  };
  P.ready(subscribe);
  document.addEventListener("p985:access", () => {
    if (P.uid) subscribe();
  });
})();
