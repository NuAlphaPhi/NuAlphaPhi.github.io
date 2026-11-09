(function () {
  "use strict";
  const P = P985;
  let stats = {},
    limit = 50,
    off,
    sort = "latest", feedMode = "all";
  const feedSeen = {}, feedReadPending = {}, moreControls = {};
  let feedLoading = true, feedHasMore = true;
  function updateMore() {
    Object.values(moreControls).forEach(button => {
      button.disabled = feedLoading || !feedHasMore;
      button.textContent = feedLoading ? "Loading posts…" : feedHasMore ? "Load more" : "You’ve reached the beginning — no older posts.";
      button.classList.toggle("is-complete", !feedLoading && !feedHasMore);
    });
  }
  let latestPosts=[],pinnedPosts=[];
  function mergePosts(){P.posts=[...new Map([...latestPosts,...pinnedPosts].map(p=>[p.id,p])).values()];render();}
  function feedBadges() {
    if(!P.uid)return;
    for(const tab of ["home","announcements"]){
      const posts=P.posts.filter(p=>!P.blocks.has(p.authorUid) && p.authorUid!==P.uid && (tab==="home" || p.kind==="announcement"));
      const newest=Math.max(0,...posts.map(p=>P.date(p.createdAt).getTime()));
      let hasNew=newest>(feedSeen[tab]||0);
      if(hasNew && !document.hidden && P.root(tab)?.closest("[data-panel]")?.hidden === false && !feedReadPending[tab]){
        const previous=feedSeen[tab]||0;
        feedSeen[tab]=Math.max(Date.now(),newest);hasNew=false;feedReadPending[tab]=true;
        db.doc("roomReads/"+P.uid+"/rooms/feed-"+tab).set({readAt:P.stamp()}).catch(()=>{feedSeen[tab]=previous;}).finally(()=>{feedReadPending[tab]=false;});
      }
      const nav=document.querySelector('[data-tab="'+tab+'"]');
      if(nav){let badge=nav.querySelector('.p-feed-badge');if(!badge){badge=P.el('span','p-feed-badge');badge.dataset.count='New';nav.append(badge);}badge.hidden=!hasNew;nav.setAttribute('aria-label',(tab==='home'?'Home':'Announcements')+(hasNew?', new posts':''));}
    }
  }
  document.addEventListener("nap:tab-changed",feedBadges);
  document.addEventListener("visibilitychange",feedBadges);
  document.addEventListener("p985:posts",feedBadges);
  const icons = {
    like: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
    reply: "M21 15a3 3 0 0 1-3 3H8l-5 4V5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z",
    save: "M5 3h14v19l-7-5-7 5z",
    share: "M22 2 9 15M22 2l-7 20-6-7-7-6z",
  };
  function action(type, label, fn) {
    const b = P.button("", fn, "p-action");
    b.dataset.action = type;
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
      const vote = await db.doc("polls/"+id+"/votes/"+P.uid).get();
      const box = P.el("div", "p-card");
      box.append(P.el("h3", "", d.question));
      d.options.forEach((t, i) => {
        const b = P.button((vote.data()?.option===i?"✓ ":"")+t + " · " + Math.round((d.counts[i] || 0)/Math.max(1,d.total)*100)+"% · " + (d.counts[i] || 0), () =>
          P.run(box, async () => {
            await P.call("pollAction", { action: "vote", id, option: i });
            box.remove();
            P.poll(id, root);
          }),
        );
        b.disabled =
          d.closed || (d.closesAt && P.date(d.closesAt) <= new Date());
        b.classList.add("p-poll-option"); b.style.setProperty("--percent",Math.round((d.counts[i]||0)/Math.max(1,d.total)*100)+"%");
        box.append(b);
      });
      box.append(
        P.el("small", "", d.total + " votes" + (d.closed ? " · Closed" : "")),
      );
      if(d.closesAt)box.append(P.el('small','p-muted','Closes '+P.when(d.closesAt)));
      if(!d.closed && (d.creator===P.uid || P.me.isAdmin))box.append(P.button('Close voting',()=>P.run(box,async()=>{await P.call('pollAction',{action:'close',id});box.remove();P.poll(id,root);})));
      root.append(box);
    } catch (e) {
      P.error(root, e);
    }
  };
  P.newPoll = (scope) => {
    const form = P.el("form", "p-poll-editor"), q = P.field("Question"), rows = P.el("div", "p-poll-options");
    q.input.placeholder = "What would you like to ask?";
    q.input.required = true; q.input.maxLength = 300;
    const answers = [];
    const add = P.button("+ Add option", () => addOption(), "p-btn p-poll-add");
    function refresh() {
      answers.forEach((item, i) => {
        item.input.placeholder = "Option " + (i + 1);
        item.input.setAttribute("aria-label", "Option " + (i + 1));
        item.number.textContent = String(i + 1);
        item.remove.disabled = answers.length <= 2;
        item.remove.setAttribute("aria-label", "Remove option " + (i + 1));
      });
      add.disabled = answers.length >= 6;
    }
    function addOption() {
      if (answers.length >= 6) return;
      const row = P.el("div", "p-poll-option"), input = P.el("input"), number = P.el("span", "p-poll-number");
      input.required = true; input.maxLength = 100;
      const item = { row, input, number };
      item.remove = P.button("×", () => { if (answers.length <= 2) return; answers.splice(answers.indexOf(item), 1); row.remove(); refresh(); }, "p-btn p-poll-remove");
      row.append(number, input, item.remove); answers.push(item); rows.append(row); refresh();
    }
    addOption(); addOption();
    const settings = P.el("details", "p-poll-settings"), closes = P.field("Closing time (your local time)", "datetime-local");
    settings.append(P.el("summary", "", "Set a closing time"), closes.wrap);
    const id = crypto.randomUUID();
    const submit = P.button("Publish poll", () => {}, "p-btn primary"); submit.type = "submit";
    const footer = P.el("div", "p-poll-footer");
    footer.append(P.button("Cancel", () => d.close()), submit);
    form.append(q.wrap, P.el("label", "p-poll-label", "Answer options"), rows, add, settings, footer);
    form.onsubmit = e => {
      e.preventDefault(); if (submit.disabled) return;
      P.run(form, async () => {
        const options = answers.map(a => a.input.value.trim());
        if (!q.input.value.trim() || options.some(o => !o)) throw Error("Add a question and fill in every option.");
        if (new Set(options.map(o => o.toLowerCase())).size !== options.length) throw Error("Each option needs to be different.");
        const closesAt = closes.input.value ? new Date(closes.input.value).getTime() : null;
        if (closesAt !== null && (!Number.isFinite(closesAt) || closesAt <= Date.now())) throw Error("Choose a closing time in the future.");
        submit.disabled = true;
        try {
          await P.call("pollAction", {action:"create",id,scope:scope?"channel":"post",roomID:scope||"",question:q.input.value.trim(),options,closesAt});
          d.close();
        } finally { submit.disabled = false; }
      });
    };
    const d = P.dialog("Create a poll", form); d.classList.add("p-poll-dialog");
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
  function showPostLikes(post) {
    const box = P.el("div", "p-suggestions");
    box.style.maxHeight = "min(60vh, 420px)";
    box.style.overflowY = "auto";
    box.append(P.empty("Loading likes…"));
    const dialog = P.dialog("Liked by", box);
    dialog.cleanup = db.collection("forumPosts/" + post.id + "/likes").onSnapshot(snapshot => {
      box.replaceChildren();
      if (snapshot.empty) box.append(P.empty("No likes yet."));
      snapshot.forEach(doc => {
        const person = P.person(doc.id);
        const row = P.button("", () => { dialog.close(); P.profile(doc.id); }, "p-group-member");
        if (person) row.append(P.avatar(person), P.el("span", "", P.name(person)));
        else { row.disabled = true; row.append(P.el("span", "", "Former or unavailable brother")); }
        box.append(row);
      });
    }, () => box.replaceChildren(P.empty("Likes are unavailable. Please try again.")));
  }
  P.postCard = (post, detail = false) => {
    const c = P.el("article", "p-card p-feed-post");
    const author = P.author(post.authorUid, post.authorName);
    const meta = P.el("small", "p-post-meta");
    const date = P.date(post.createdAt);
    const shortDate = Number.isFinite(date.getTime())
      ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) })
      : "";
    meta.append(P.el("span", "", [post.chapter, shortDate].filter(Boolean).join(" · ")));
    const timestamps = "Posted " + P.when(post.createdAt) + (post.editedAt ? " · Edited " + P.when(post.editedAt) : "");
    meta.title = timestamps;
    meta.tabIndex = 0;
    meta.setAttribute("aria-label", timestamps);
    if (post.editedAt) meta.append(P.el("span", "p-post-edited", " · edited"));
    if (post.pinned) meta.append(P.el("span", "p-post-pinned", "Pinned"));
    c.append(author, meta);
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
    const count = P.button(String(stats[post.id]?.likeCount || 0), () => showPostLikes(post), "p-action");
    count.title = "See who liked this post";
    count.setAttribute("aria-label", "See who liked this post");
    const likeGroup = P.el("div", "p-post-like-group");
    likeGroup.style.display = "inline-flex";
    likeGroup.style.alignItems = "center";
    likeGroup.append(like, count);
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
    const replyCount = Math.max(0, Number(stats[post.id]?.replyCount) || 0);
    reply.dataset.commentPost = post.id;
    reply.append(P.el("span", "p-comment-count", String(replyCount)));
    reply.setAttribute("aria-label", `View comments (${replyCount})`);
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
                "/portal/home/" +
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
    actions.append(likeGroup, reply, share);
      c.append(
        P.button(
          "•••",
          () => {
            const menu = P.el("div", "p-action-sheet");
    if(post.authorUid===P.uid && !post.eventID && !post.pollID)menu.append(P.button('Edit post',()=>{
      d.close();
      const f=P.field('Post','textarea',post.body),box=P.el('div');f.input.maxLength=2000;
      box.append(f.wrap,P.button('Save changes',()=>P.run(box,async()=>{await P.call('portalAction',{action:'editPost',id:post.id,body:f.input.value});editDialog.close();P.toast('Post updated');})));const editDialog=P.dialog('Edit post',box);
    }));
    if(P.me.isAdmin && post.kind==='announcement')menu.append(P.button(post.pinned?'Unpin announcement':'Pin announcement',()=>P.run(menu,async()=>{await P.call('portalAction',{action:'pinPost',id:post.id,pinned:!post.pinned});d.close();P.toast(post.pinned?'Announcement unpinned':'Announcement pinned',()=>P.call('portalAction',{action:'pinPost',id:post.id,pinned:!!post.pinned}));})));

            menu.append(P.button("View likes", () => { d.close(); showPostLikes(post); }));
            menu.append(P.button("Report post", () => { d.close(); P.reportContent("forumPosts/" + post.id); }));
            if (!post.eventID && (post.authorUid === P.uid || P.me.isAdmin)) menu.append(
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
    c.querySelector(".p-post-menu")?.setAttribute("aria-label","Post options");
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
    window.napSetTab("post", "home", window.NAP_ROUTES.options("home", id));
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
          ? "Announcement"
          : "What’s happening, brother?",
        "textarea",
      ),
      file = P.field("Add a photo", "file"),
      status = P.el("p", "p-muted");
    file.input.accept = "image/*";
    text.input.maxLength = 2000;
    const key = "985.draft." + P.uid + "." + kind;
    text.input.value = localStorage.getItem(key) || "";
    try { text.input._mentions=JSON.parse(localStorage.getItem(key+".mentions")||"{}"); } catch (_) {}
    text.input.oninput = () => {localStorage.setItem(key, text.input.value);localStorage.setItem(key+".mentions",JSON.stringify(text.input._mentions||{}));};
    P.mentionPicker(text.input);
    const send = P.button(
      kind === "announcement" ? (P.me.isAdmin ? "Publish announcement" : "Submit for approval") : "Post",
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
      () => P.emojiPicker(text.input, emoji),
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
    const photoAttachment = P.photoAttachment(form, file.input, attachment, () => send.disabled);
    body.append(text.wrap, attachment, toolbar, status);
    form.append(avatar, body, file.wrap);
    let pendingID = null;
    form.onsubmit = (e) => {
      e.preventDefault();
      P.run(form, async () => {
        const body = text.input.value.trim();
        if (!body && !photoAttachment.file)
          throw Error("Write something or add a photo.");
        send.disabled = true;
        pendingID = pendingID || crypto.randomUUID();
        try {
          let result;
          const ref = db.doc("forumPosts/" + pendingID);
          if (!(await ref.get()).exists) {
            let photoPath = "";
            if (photoAttachment.file)
              photoPath = await P.upload(
                photoAttachment.file,
                "postPhotos/" + pendingID + "/" + P.uid + ".jpg",
                status,
              );
            const data = {
              authorUid: P.uid,
              authorName: P.name(P.me),
              chapter: P.me.chapter || "",
              body,
              photoPath,
              kind,
              createdAt: P.stamp(),
              ...P.mentions(text.input),
            };
            if (kind === "announcement") result = await P.call("announcementAction", {action:"submit", id:pendingID, body, photoPath, ...P.mentions(text.input)});
            else await ref.set(data);
          }
          pendingID = null;
          text.input.value = "";
          photoAttachment.clear();
          count.textContent = "";
          localStorage.removeItem(key);localStorage.removeItem(key+".mentions");
          status.textContent = result?.status === "pending" ? "Submitted. An admin will review your announcement before it appears in the feed." : "Posted.";
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
      if(kind==='home' && feedMode==='you')posts=posts.filter(p=>p.pinned||p.authorUid===P.uid||p.chapter===P.me.chapter||p.mentionIds?.includes(P.uid)||p.mentionChapters?.includes(P.me.chapter));
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
      posts.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned));
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
    P.watch(db.collection('forumPosts').where('pinned','==',true),rows=>{pinnedPosts=rows;mergePosts();});
    for(const tab of ["home","announcements"])P.watch(db.doc("roomReads/"+P.uid+"/rooms/feed-"+tab),value=>{feedSeen[tab]=Math.max(feedSeen[tab]||0,P.date(value?.readAt).getTime());feedBadges();});

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
        window.napHomeScroll(layout, center, rail);
        r = center;
      }
      r.classList.add("p-feed");
      r.replaceChildren(
        P.header(
          kind === "home" ? "Home" : "Announcements",
          kind === "home"
            ? "The brotherhood, in one place."
            : "Announcements from the brotherhood. Admins publish directly; other submissions are reviewed.",
        ),
      );
      const top = P.row();
      if (kind === "home") {
        const sortMenu=P.el('details','p-sort-picker'),sortLabel=P.el('summary','',({'latest':'Latest','activity':'Recent activity','top':'Most likes'})[sort]),sortOptions=P.el('div','p-sort-options');
        sortLabel.setAttribute('aria-label','Sort posts');sortMenu.append(sortLabel,sortOptions);
        [['latest','Latest'],['activity','Recent activity'],['top','Most likes']].forEach(([value,label])=>{const option=P.button(label,()=>{sort=value;sortLabel.textContent=label;sortMenu.open=false;for(const b of sortOptions.children)b.setAttribute('aria-pressed',String(b.dataset.sort===value));render();sortLabel.focus();},'p-sort-option');option.dataset.sort=value;option.setAttribute('aria-pressed',String(sort===value));sortOptions.append(option);});
        r.querySelector('.p-header').append(sortMenu);
        const modes=P.el('div','p-feed-switch');modes.setAttribute('role','group');modes.setAttribute('aria-label','Feed');
        [['all','All brothers'],['you','For you']].forEach(([value,label])=>{const b=P.button(label,()=>{feedMode=value;for(const tab of modes.children)tab.setAttribute('aria-pressed',String(tab.dataset.mode===value));render();},'p-feed-switch__tab');b.dataset.mode=value;b.setAttribute('aria-pressed',String(feedMode===value));modes.append(b);});r.append(modes);
        const strip=P.el('div','p-home-status');strip.id='p985-personal-status';strip.hidden=true;r.append(strip);
        r.append(composer("post"));
      } else {
        const holder = P.el("div");
        r.append(holder);
        holder.append(composer("announcement"));
        const requests = P.el("div", "p-announcement-requests");
        r.append(requests);
        P.watch(db.collection("announcementRequests").where("authorUid", "==", P.uid), rows => {
          requests.replaceChildren();
          const pending = rows.filter(x => x.status !== "published");
          if (pending.length) requests.append(P.el("h3", "", "Your submissions"));
          pending.sort((a,b) => P.date(b.createdAt)-P.date(a.createdAt)).forEach(x => {
            const row = P.el("div", "p-card");
            row.append(P.el("strong", "", x.status === "pending" ? "Awaiting approval" : "Not approved"), P.el("p", "p-muted", x.body.slice(0,160)));
            requests.append(row);
          });
        }, requests);
      }
      lists[kind] = P.el("div");
      moreControls[kind] = P.button("Loading posts…", () => {
        if(feedLoading || !feedHasMore) return;
        limit += 50;
        subscribe();
      }, "p-feed-more");
      r.append(lists[kind], moreControls[kind]);
      updateMore();
    }
    P.watch(db.collection("postStatistics"), (rows) => {
      stats = Object.fromEntries(rows.map((r) => [r.id, r]));
      render();
      document.querySelectorAll("[data-comment-post]").forEach(button => {
        const total = Math.max(0, Number(stats[button.dataset.commentPost]?.replyCount) || 0);
        button.querySelector(".p-comment-count").textContent = String(total);
        button.setAttribute("aria-label", `View comments (${total})`);
      });
    });
    subscribe();
    const id = new URLSearchParams(location.search).get("post");
    if (id) P.openPost(id);
  });
  let statusGeneration=0;
  function personalStatus(){
    const strip=document.getElementById('p985-personal-status');if(!strip)return;
    const run=++statusGeneration,unread=(P.activity||[]).filter(i=>!i.read&&!P.blocks.has(i.actor)).length;
    strip.replaceChildren();strip.hidden=false;
    if(unread)strip.append(P.button(unread+' new update'+(unread===1?'':'s'),()=>document.getElementById('notificationBellBtn').click(),'p-home-status__link'));
    else strip.append(P.el('span','p-home-status__caught-up','You’re all caught up'));
    const next=(P.events||[]).filter(e=>e.status==='published'&&P.date(e.start)>new Date()).sort((a,b)=>P.date(a.start)-P.date(b.start))[0];
    if(next){const b=P.button(next.title,()=>P.openEvent(next.id),'p-home-status__event');b.title=next.title;strip.append(b);P.event('attendance',next.id).then(own=>{if(run===statusGeneration){b.replaceChildren(P.el('span','p-home-status__event-name',next.title),P.el('span','p-home-status__rsvp',({going:'Going',maybe:'Maybe',busy:'Not going',waitlist:'Waitlisted'})[own.status]||'RSVP'));}}).catch(()=>{});}

  }
  document.addEventListener('p985:activity',personalStatus);
  document.addEventListener('p985:events',personalStatus);
  function updates() {
    const rail = document.getElementById("p985-updates");
    if (!rail) return;
    rail.replaceChildren();
    rail.append(P.searchButton());
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
    feedLoading = true; updateMore();
    off?.();
    off = P.watch(
      db.collection("forumPosts").orderBy("createdAt", "desc").limit(limit),
      (rows) => {
        feedLoading = false; feedHasMore = rows.length >= limit; updateMore();
        latestPosts = rows;
        mergePosts();
      },
    );
  }
  document.addEventListener('click',e=>{document.querySelectorAll('.p-sort-picker[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;});});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.p-sort-picker[open]').forEach(d=>{d.open=false;d.querySelector('summary').focus();});});
  document.addEventListener("p985:blocks", render);
  P.ready(() => window.NAP_ROUTES.register("home", id => { if(id) P.openPost(id); }));
})();
