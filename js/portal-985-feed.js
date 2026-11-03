(function () {
  "use strict";
  const P = P985;
  let stats = {},
    limit = 50,
    off,
    sort = "latest";
  const icons = {
    like: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
    reply: "M21 15a3 3 0 0 1-3 3H8l-5 4V5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z",
    save: "M5 3h14v19l-7-5-7 5z",
    share: "M22 2 9 15M22 2l-7 20-6-7-7-6z",
  };
  function action(type, label, fn) {
    const b = P.button("", fn, "p-action");
    b.setAttribute("aria-label", label);
    b.title = label;
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    const p = document.createElementNS(s.namespaceURI, "path");
    p.setAttribute("d", icons[type]);
    s.append(p);
    b.append(s);
    return b;
  }
  P.poll = async (id, root) => {
    try {
      const snap = await db.doc("polls/" + id).get();
      if (!snap.exists) return;
      const d = snap.data();
      const box = P.el("div", "p-card");
      box.append(P.el("h3", "", d.question));
      d.options.forEach((t, i) => {
        const b = P.button(t + " · " + (d.counts[i] || 0), () =>
          P.run(box, async () => {
            await P.call("pollAction", { action: "vote", id, option: i });
            box.remove();
            P.poll(id, root);
          }),
        );
        b.disabled =
          d.closed || (d.closesAt && P.date(d.closesAt) <= new Date());
        box.append(b);
      });
      box.append(
        P.el("small", "", d.total + " votes" + (d.closed ? " · Closed" : "")),
      );
      root.append(box);
    } catch (e) {
      P.error(root, e);
    }
  };
  P.newPoll = (scope) => {
    const form = P.el("form"),
      q = P.field("Question"),
      options = P.field("Options — one per line", "textarea");
    form.append(q.wrap, options.wrap);
    const submit = P.button(
      "Publish poll",
      () =>
        P.run(form, async () => {
          await P.call("pollAction", {
            action: "create",
            id: crypto.randomUUID(),
            scope: scope ? "channel" : "post",
            roomID: scope || "",
            question: q.input.value,
            options: options.input.value.split("\n").filter((x) => x.trim()),
            closesAt: null,
          });
          d.close();
        }),
      "p-btn primary",
    );
    form.append(submit);
    const d = P.dialog("New poll", form);
  };
  let previewFrame;
  function measurePreviews() {
    cancelAnimationFrame(previewFrame);
    previewFrame = requestAnimationFrame(() => {
      document.querySelectorAll(".p-post-preview").forEach(body => {
        const more = body.nextElementSibling;
        if (more?.classList.contains("p-post-more"))
          more.hidden = !body.clientHeight || body.scrollHeight <= body.clientHeight + 1;
      });
    });
  }
  window.addEventListener("resize", measurePreviews);
  document.addEventListener("nap:tab-changed", measurePreviews);
  document.fonts?.ready.then(measurePreviews);
  P.postCard = (post, detail = false) => {
    const c = P.el("article", "p-card p-feed-post");
    c.append(
      P.author(post.authorUid, post.authorName),
      P.el(
        "small",
        "",
        post.chapter +
          " · " +
          P.when(post.createdAt) +
          (post.kind !== "post" ? " · " + (post.kind || "Post") : ""),
      ),
    );
    const body = P.text(post.body, post);
    c.append(body);
    if (!detail) {
      body.classList.add("p-post-preview");
      const more = P.button("Show more", () => P.openPost(post.id), "p-post-more");
      more.hidden = true;
      more.setAttribute("aria-label", "Show full post");
      c.append(more);
      measurePreviews();
    }
    if (post.photoPath) {
      const img = P.image(post.photoPath);
      img.onclick = () => P.expand(post.photoPath);
      c.append(img);
    }
    if (post.pollID) P.poll(post.pollID, c);
    if (post.eventID)
      c.append(
        P.button(
          "View event",
          () => P.openEvent(post.eventID),
          "p-btn primary",
        ),
      );
    const actions = P.el("div", "p-actions");
    const like = action("like", "Like post", () =>
      P.run(c, async () => {
        const ref = db.doc("forumPosts/" + post.id + "/likes/" + P.uid);
        await db.runTransaction(async (tx) => {
          const d = await tx.get(ref);
          if (d.exists) tx.delete(ref);
          else tx.set(ref, { createdAt: P.stamp() });
        });
        await refreshLike();
      }),
    );
    const count = P.el("span", "", stats[post.id]?.likeCount || "");
    like.append(count);
    async function refreshLike() {
      const d = await db.doc("forumPosts/" + post.id + "/likes/" + P.uid).get();
      like.classList.toggle("selected", d.exists);
      like.setAttribute("aria-pressed", String(d.exists));
    }
    refreshLike().catch(() => {});
    const reply = action("reply", "View comments", () => {
      if (post.eventID) P.openEvent(post.eventID);
      else if (detail)
        document.querySelector(".p-thread-input textarea")?.focus();
      else P.openPost(post.id);
    });
    reply.append(P.el("span", "", stats[post.id]?.replyCount || ""));
    const share = action("share", "Share post", () => {
      const box = P.el("div");
      box.append(
        P.button("Send to a brother or group", () => {
          d.close();
          P.sharePost(post);
        }),
        P.button("Copy link", () =>
          P.run(box, async () => {
            await navigator.clipboard.writeText(
              location.origin +
                "/portal-home?post=" +
                encodeURIComponent(post.id),
            );
            box.append(
              P.el("p", "", "Link copied. Brothers must sign in to view it."),
            );
          }),
        ),
      );
      const d = P.dialog("Share post", box);
    });
    actions.append(like, reply, share);
    if (!post.eventID && (post.authorUid === P.uid || P.me.isAdmin))
      c.append(
        P.button(
          "•••",
          () => {
            const menu = P.el("div");
            menu.append(
              P.button(
                "Delete post",
                () =>
                  P.run(menu, async () => {
                    if (await P.confirm("Delete this post for everyone?")) {
                      await db.doc("forumPosts/" + post.id).delete();
                      d.close();
                    }
                  }),
                "p-btn danger",
              ),
            );
            const d = P.dialog("Post options", menu);
          },
          "p-post-menu",
        ),
      );
    c.append(actions);
    if (!detail)
      c.addEventListener("click", (e) => {
        if (!e.target.closest("button,a,img,input")) P.openPost(post.id);
      });
    return c;
  };
  let postOff = null,
    postGeneration = 0;
  document.addEventListener("nap:tab-changed", (e) => {
    if (e.detail.tab !== "post") {
      postGeneration++;
      postOff?.();
      postOff = null;
    }
  });
  P.openPost = async (id) => {
    postOff?.();
    const generation = ++postGeneration;
    document
      .querySelectorAll("dialog.p-dialog[open]")
      .forEach((d) => d.close());
    window.napSetTab("post", "home");
    const root = P.root("post");
    root.replaceChildren();
    root.classList.add("p-thread-page");
    const back = P.button("←", () => P.go("home"), "p-thread-back");
    back.setAttribute("aria-label", "Back to feed");
    const header = P.row(back, P.el("h1", "", "Post"));
    header.classList.add("p-thread-header");
    const box = P.el("div");
    root.append(header, box);
    P.run(box, async () => {
      const snap = await db.doc("forumPosts/" + id).get();
      if (generation !== postGeneration) return;
      if (!snap.exists) throw Error("This post is no longer available.");
      const post = { id, ...snap.data() };
      if (post.eventID) {
        P.go("events");
        P.openEvent(post.eventID);
        return;
      }
      if (P.blocks.has(post.authorUid))
        throw Error("You have blocked this brother.");
      const card = P.postCard(post, true);
      card.classList.add("p-expanded-post");
      box.append(card);
      const metadata = card.querySelector(":scope > small");
      if (metadata) {
        metadata.remove();
        card.insertBefore(metadata, card.querySelector(".p-actions"));
      }
      const replies = P.el("div", "p-thread-replies"),
        form = P.el("form", "p-thread-compose"),
        field = P.field("Your reply", "textarea"),
        hint = P.el("div", "p-thread-hint");
      field.input.maxLength = 1000;
      field.input.placeholder = "Post your reply";
      field.input.rows = 1;
      field.wrap.className = "p-thread-input";
      field.wrap.firstChild.className = "p-sr-only";
      let replyToID = "";
      P.mentionPicker(field.input);
      const avatar = P.avatar(P.me),
        send = P.button("Reply", () => form.requestSubmit(), "p-btn primary");
      const composeRow = P.row(avatar, field.wrap, send);
      form.append(hint, composeRow);
      box.append(form, replies);
      postOff = db
        .collection("forumPosts/" + id + "/replies")
        .orderBy("createdAt")
        .onSnapshot(
          (s) => {
            if (generation !== postGeneration) return;
            replies.replaceChildren();
            const rows = s.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((r) => !P.blocks.has(r.senderUid)),
              byID = new Map(rows.map((r) => [r.id, r])),
              seen = new Set();
            function draw(r, depth = 0) {
              if (seen.has(r.id)) return;
              seen.add(r.id);
              const c = P.el(
                "article",
                "p-thread-reply" + (depth ? " p-thread-child" : ""),
              );
              c.style.setProperty("--thread-depth", Math.min(depth, 2));
              c.append(
                P.author(r.senderUid, r.senderName),
                P.el("small", "p-reply-date", P.when(r.createdAt)),
              );
              const parent = byID.get(r.replyToID);
              if (r.replyToID)
                c.append(
                  P.el(
                    "div",
                    "p-reply-context",
                    parent
                      ? "Replying to " + parent.senderName
                      : "Replying to an earlier comment",
                  ),
                );
              c.append(P.text(r.body, r));
              const controls = P.row();
              controls.classList.add("p-thread-controls");
              controls.append(
                action("reply", "Reply to " + r.senderName, () => {
                  replyToID = r.id;
                  hint.replaceChildren(
                    P.row(
                      P.el("span", "", "Replying to " + r.senderName),
                      P.button("Cancel", () => {
                        replyToID = "";
                        hint.replaceChildren();
                      }),
                    ),
                  );
                  field.input.focus();
                  form.scrollIntoView({ behavior: "smooth", block: "center" });
                }),
              );
              if (r.senderUid === P.uid || P.me.isAdmin) {
                const more = P.button(
                  "•••",
                  () => {
                    const menu = P.el("div");
                    menu.append(
                      P.button(
                        "Delete reply",
                        () =>
                          P.run(menu, async () => {
                            if (await P.confirm("Delete this reply?")) {
                              await db
                                .doc("forumPosts/" + id + "/replies/" + r.id)
                                .delete();
                              d.close();
                            }
                          }),
                        "p-btn danger",
                      ),
                    );
                    const d = P.dialog("Reply options", menu);
                  },
                  "p-post-menu",
                );
                more.setAttribute("aria-label", "Reply options");
                c.append(more);
              }
              c.append(controls);
              replies.append(c);
              rows
                .filter((child) => child.replyToID === r.id)
                .forEach((child) => draw(child, depth + 1));
            }
            rows
              .filter((r) => !r.replyToID || !byID.has(r.replyToID))
              .forEach((r) => draw(r));
            rows.forEach((r) => draw(r));
            if (!rows.length)
              replies.append(P.empty("Start the conversation."));
          },
          (e) => P.error(box, e),
        );
      form.onsubmit = (e) => {
        e.preventDefault();
        P.run(form, async () => {
          const body = field.input.value.trim();
          if (!body) throw Error("Write a reply.");
          send.disabled = true;
          try {
            await db.collection("forumPosts/" + id + "/replies").add({
              senderUid: P.uid,
              senderName: P.name(P.me),
              body,
              createdAt: P.stamp(),
              replyToID,
              ...P.mentions(field.input),
            });
            field.input.value = "";
            field.input._mentions = {};
            replyToID = "";
            hint.replaceChildren();
          } finally {
            send.disabled = false;
          }
        });
      };
    });
  };
  function composer(kind) {
    const form = P.el("form", "p-post-composer"),
      text = P.field(
        kind === "announcement"
          ? "National announcement"
          : "What’s happening, brother?",
        "textarea",
      ),
      file = P.field("Add a photo", "file"),
      status = P.el("p", "p-muted");
    file.input.accept = "image/*";
    text.input.maxLength = 2000;
    const key = "985.draft." + P.uid + "." + kind;
    text.input.value = localStorage.getItem(key) || "";
    text.input.oninput = () => localStorage.setItem(key, text.input.value);
    P.mentionPicker(text.input);
    const send = P.button(
      kind === "announcement" ? "Publish announcement" : "Post",
      () => form.requestSubmit(),
      "p-btn primary",
    );
    text.wrap.className = "p-post-input";
    text.wrap.firstChild.className = "p-sr-only";
    text.input.placeholder =
      kind === "announcement"
        ? "Share an update with the brotherhood…"
        : "What’s happening?";
    text.input.rows = 2;
    file.wrap.hidden = true;
    const body = P.el("div", "p-post-compose-body"),
      avatar = P.button("", () => P.profile(P.uid), "p-avatar-button");
    avatar.append(P.avatar(P.me));
    const toolbar = P.el("div", "p-post-toolbar"),
      tools = P.row();
    const photo = P.button("", () => file.input.click(), "p-compose-icon");
    photo.title = "Add photo";
    photo.setAttribute("aria-label", "Add photo");
    photo.append(P.icon("photo"));
    tools.append(photo);
    if (kind === "post") {
      const poll = P.button("", () => P.newPoll(), "p-compose-icon");
      poll.title = "Create poll";
      poll.setAttribute("aria-label", "Create poll");
      poll.append(P.icon("poll"));
      tools.append(poll);
    }
    const emoji = P.button(
      "",
      () => P.emojiPicker(text.input),
      "p-compose-icon",
    );
    emoji.setAttribute("aria-label", "Add emoji");
    emoji.title = "Add emoji";
    emoji.append(P.icon("smile"));
    tools.append(emoji);
    const count = P.el("small", "p-compose-count", "");
    text.input.addEventListener("input", () => {
      count.textContent =
        text.input.value.length > 1600 ? text.input.value.length + "/2000" : "";
    });
    toolbar.append(tools, P.row(count, send));
    const attachment = P.el("div", "p-attachment");
    file.input.onchange = () => {
      attachment.replaceChildren();
      if (file.input.files[0])
        attachment.append(
          P.el("span", "", file.input.files[0].name),
          P.button("Remove photo", () => {
            file.input.value = "";
            attachment.replaceChildren();
          }),
        );
    };
    body.append(text.wrap, attachment, toolbar, status);
    form.append(avatar, body, file.wrap);
    let pendingID = null;
    form.onsubmit = (e) => {
      e.preventDefault();
      P.run(form, async () => {
        const body = text.input.value.trim();
        if (!body && !file.input.files.length)
          throw Error("Write something or add a photo.");
        send.disabled = true;
        pendingID = pendingID || crypto.randomUUID();
        try {
          const ref = db.doc("forumPosts/" + pendingID);
          if (!(await ref.get()).exists) {
            let photoPath = "";
            if (file.input.files[0])
              photoPath = await P.upload(
                file.input.files[0],
                "postPhotos/" + pendingID + "/" + P.uid + ".jpg",
                status,
              );
            await ref.set({
              authorUid: P.uid,
              authorName: P.name(P.me),
              chapter: P.me.chapter || "",
              body,
              photoPath,
              kind,
              createdAt: P.stamp(),
              ...P.mentions(text.input),
            });
          }
          pendingID = null;
          text.input.value = "";
          file.input.value = "";
          attachment.replaceChildren();
          count.textContent = "";
          localStorage.removeItem(key);
          status.textContent = "Posted.";
        } finally {
          send.disabled = false;
        }
      });
    };
    return form;
  }
  const lists = {};
  function render() {
    for (const kind of ["home", "announcements"]) {
      const list = lists[kind];
      if (!list) continue;
      let posts = P.posts.filter(
        (p) =>
          !P.blocks.has(p.authorUid) &&
          (kind === "home" || p.kind === "announcement"),
      );
      posts.sort((a, b) =>
        sort === "top"
          ? (stats[b.id]?.likeCount || 0) - (stats[a.id]?.likeCount || 0)
          : P.date(
              sort === "activity"
                ? stats[b.id]?.lastActivityAt || b.createdAt
                : b.createdAt,
            ) -
            P.date(
              sort === "activity"
                ? stats[a.id]?.lastActivityAt || a.createdAt
                : a.createdAt,
            ),
      );
      list.replaceChildren(...posts.map((p) => P.postCard(p)));
      if (!posts.length)
        list.append(
          P.empty(
            kind === "home" ? "Be the first to post." : "No announcements yet.",
          ),
        );
    }
    updates();
    document.dispatchEvent(new Event("p985:posts"));
  }
  P.ready(() => {
    for (const kind of ["home", "announcements"]) {
      let r = P.root(kind);
      if (kind === "home") {
        r.replaceChildren();
        const layout = P.el("div", "p-home-layout"),
          center = P.el("div", "p-home-center"),
          rail = P.el("aside", "p-updates");
        rail.id = "p985-updates";
        rail.setAttribute("aria-label", "Brotherhood updates");
        layout.append(center, rail);
        r.append(layout);
        r = center;
      }
      r.classList.add("p-feed");
      r.replaceChildren(
        P.header(
          kind === "home" ? "Home" : "Announcements",
          kind === "home"
            ? "The brotherhood, in one place."
            : "Updates from National Board.",
        ),
      );
      const top = P.row();
      if (kind === "home") {
        const sortField = P.select(
          "Sort posts",
          [
            ["latest", "Latest"],
            ["activity", "Recent activity"],
            ["top", "Most likes"],
          ],
          sort,
        );
        sortField.input.onchange = () => {
          sort = sortField.input.value;
          render();
        };
        r.querySelector(".p-header").append(sortField.wrap);
        r.append(composer("post"));
      } else {
        const holder = P.el("div");
        r.append(holder);
        document.addEventListener("p985:access", () => {
          holder.replaceChildren();
          if (P.grant.role === "nationalBoard")
            holder.append(composer("announcement"));
        });
      }
      lists[kind] = P.el("div");
      r.append(
        lists[kind],
        P.button("Load more", () => {
          limit += 50;
          subscribe();
        }),
      );
    }
    P.watch(db.collection("postStatistics"), (rows) => {
      stats = Object.fromEntries(rows.map((r) => [r.id, r]));
      render();
    });
    subscribe();
    const id = new URLSearchParams(location.search).get("post");
    if (id) P.openPost(id);
  });
  function updates() {
    const rail = document.getElementById("p985-updates");
    if (!rail) return;
    rail.replaceChildren();
    const search = P.field("Search brothers", "search");
    search.input.placeholder = "Search brothers";
    const matches = P.el("div", "p-suggestions");
    search.input.oninput = () => {
      matches.replaceChildren();
      if (!search.input.value.trim()) return;
      P.brothers
        .filter((b) =>
          (P.name(b) + " " + b.firstName + " " + b.lastName)
            .toLowerCase()
            .includes(search.input.value.toLowerCase()),
        )
        .slice(0, 5)
        .forEach((b) =>
          matches.append(
            P.button(
              P.name(b) + " · " + b.chapter,
              () => P.profile(b.uid),
              "p-choice",
            ),
          ),
        );
    };
    rail.append(search.wrap, matches);
    function card(title, tab) {
      const c = P.el("section", "p-updates-card");
      c.append(
        P.row(
          P.el("h2", "", title),
          P.button("View all", () => P.go(tab), "p-update-link"),
        ),
      );
      rail.append(c);
      return c;
    }
    const events = card("Coming up", "events");
    const next = (P.events || [])
      .filter(
        (e) =>
          e.status === "published" && P.date(e.end || e.start) >= new Date(),
      )
      .sort((a, b) => P.date(a.start) - P.date(b.start))
      .slice(0, 3);
    next.forEach((e) => {
      const item = P.button("", () => P.openEvent(e.id), "p-update-item");
      const date = P.el("div", "p-date-tile");
      date.append(
        P.el(
          "small",
          "",
          P.date(e.start).toLocaleDateString(undefined, { month: "short" }),
        ),
        P.el("strong", "", P.date(e.start).getDate()),
      );
      const info = P.el("div");
      info.append(
        P.el("strong", "", e.title),
        P.el(
          "small",
          "",
          e.locationTBD ? "Location to be announced" : e.location,
        ),
      );
      item.append(date, info);
      events.append(item);
    });
    if (!next.length)
      events.append(P.el("p", "p-muted", "No upcoming events yet."));
    const announcements = card("Announcements", "announcements");
    const latest = P.posts
      .filter((p) => p.kind === "announcement" && !P.blocks.has(p.authorUid))
      .slice(0, 3);
    latest.forEach((p) => {
      const item = P.button("", () => P.openPost(p.id), "p-update-item");
      const info = P.el("div");
      info.append(
        P.el(
          "small",
          "",
          P.name(P.person(p.authorUid)) +
            " · " +
            P.date(p.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
        ),
        P.el(
          "strong",
          "",
          p.body.slice(0, 130) + (p.body.length > 130 ? "…" : ""),
        ),
      );
      item.append(info);
      announcements.append(item);
    });
    if (!latest.length)
      announcements.append(
        P.el("p", "p-muted", "National updates will appear here."),
      );
    const birthdays = card("Birthdays", "birthdays"),
      today = new Date();
    today.setHours(0, 0, 0, 0);
    const coming = P.brothers
      .filter((b) => b.birthday && !P.blocks.has(b.uid))
      .map((b) => {
        const parts = b.birthday.split("-").map(Number);
        if (parts.length !== 3) return null;
        let date = new Date(today.getFullYear(), parts[1] - 1, parts[2]);
        if (date < today)
          date = new Date(today.getFullYear() + 1, parts[1] - 1, parts[2]);
        return { b, date, days: Math.round((date - today) / 86400000) };
      })
      .filter((x) => x && x.days <= 30)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
    coming.forEach(({ b, date, days }) => {
      const item = P.button("", () => P.profile(b.uid), "p-update-item"),
        info = P.el("div");
      info.append(
        P.el("strong", "", P.name(b)),
        P.el(
          "small",
          "",
          days === 0
            ? "Today 🎂"
            : date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              }) +
                " · " +
                b.chapter,
        ),
      );
      item.append(P.avatar(b), info);
      birthdays.append(item);
    });
    if (!coming.length)
      birthdays.append(
        P.el("p", "p-muted", "No shared birthdays in the next 30 days."),
      );
    rail.append(
      P.el("p", "p-rail-footer", "985 · Nu Alpha Phi · Brothers for life"),
    );
  }
  document.addEventListener("p985:events", updates);
  document.addEventListener("p985:people", updates);
  function subscribe() {
    off?.();
    off = P.watch(
      db.collection("forumPosts").orderBy("createdAt", "desc").limit(limit),
      (rows) => {
        P.posts = rows;
        render();
      },
    );
  }
  document.addEventListener("p985:blocks", render);
})();
