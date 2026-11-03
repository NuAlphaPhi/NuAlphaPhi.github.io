(function () {
  "use strict";
  const P = P985;
  let all = new Map(),
    queries = [],
    filter = "upcoming";
  P.events = [];
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
    const tabs = P.el("div", "p-tabs");
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
          "p-btn" + (filter === t ? " selected" : ""),
        ),
      ),
    );
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
    rows.forEach((e) => {
      const card = P.el("article", "p-card p-event-card");
      card.append(
        P.image(e.coverPath, "p-event-cover", e.title),
        P.el("span", "p-chip", e.status),
        P.el("h2", "", e.title),
        P.el("p", "p-muted", P.when(e.start)),
        P.el("p", "", e.locationTBD ? "Location to be announced" : e.location),
        P.button("View event", () => P.openEvent(e.id), "p-btn primary"),
      );
      grid.append(card);
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
    form.append(file.wrap);
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
    const d = P.dialog(event ? "Edit event" : "New event", form);
    form.onsubmit = (e) => {
      e.preventDefault();
      P.run(form, async () => {
        send.disabled = true;
        try {
          let coverPath = event?.coverPath || "";
          if (file.input.files[0])
            coverPath = await P.upload(
              file.input.files[0],
              "eventCovers/" + P.uid + "/" + crypto.randomUUID() + ".jpg",
              status,
              true,
            );
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
        }
      });
    };
  };
  P.openEvent = (id) => {
    const box = P.el("div");
    const dialog = P.dialog("Event", box);
    P.run(box, async () => {
      const snap = await db.doc("appEvents/" + id).get();
      if (!snap.exists || snap.data().status === "deleted")
        throw Error("This event is unavailable.");
      const e = { id, ...snap.data() },
        organizer = e.hostUid === P.uid || e.collaboratorIds?.includes(P.uid);
      box.append(
        P.image(e.coverPath, "p-event-cover", e.title),
        P.el("h2", "", e.title),
        P.author(e.hostUid, e.hostName),
        P.el(
          "p",
          "p-muted",
          P.when(e.start) + (e.end ? " — " + P.when(e.end) : ""),
        ),
        P.el("p", "", e.locationTBD ? "Location to be announced" : e.location),
        P.text(e.description),
        P.el(
          "p",
          "p-muted",
          "RSVP by " +
            P.when(e.deadline) +
            " · " +
            (e.capacity
              ? e.reservedSeats + "/" + e.capacity + " places reserved"
              : "No capacity limit") +
            " · " +
            (e.plusOnes
              ? "Plus-ones welcome" +
                (e.plusOneLimit ? " (up to " + e.plusOneLimit + ")" : "")
              : "No plus-ones"),
        ),
      );
      const actions = P.row();
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
      if (e.status === "published") {
        actions.append(
          P.button("Copy event link", () =>
            P.run(box, async () => {
              await navigator.clipboard.writeText(
                "https://nualphaphi.com/event/" + id,
              );
              actions.append(P.el("small", "", "Link copied"));
            }),
          ),
        );
        const a = P.el("a", "p-btn", "Public event page");
        a.href = "/event/" + encodeURIComponent(id);
        a.target = "_blank";
        a.rel = "noopener";
        actions.append(a);
      }
      box.append(actions);
      if (e.status !== "published") {
        box.append(P.empty("Status: " + e.status));
        return;
      }
      const rsvp = P.el("div", "p-card"),
        community = P.el("div"),
        guests = P.el("div");
      const own = await P.event("attendance", id);
      rsvp.append(
        P.el("h3", "", "Your RSVP"),
        P.el("p", "", own.status || "Not responded"),
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
      box.append(rsvp, community);
      await loadCommunity();
      async function loadCommunity() {
        community.replaceChildren(P.el("h3", "", "Conversation"));
        const c = await P.event("conversation", id);
        if (c.attendeesUnlocked) {
          const attendance = P.el("div", "p-card");
          attendance.append(P.el("h3", "", "Guest list"));
          community.append(attendance);
          await attendees(attendance);
        } else
          community.append(
            P.empty("RSVP to see who is going, maybe, busy, or waitlisted."),
          );
        const rows = P.el("div");
        community.append(rows);
        function drawRows(data) {
          data.rows.forEach((r) => {
            const item = P.el("div", "p-card");
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
          root.append(P.el("h3", "", status));
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
