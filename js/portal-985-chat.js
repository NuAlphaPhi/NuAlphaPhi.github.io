(function () {
  "use strict";
  const P = P985;
  let conversations = [],
    active = null,
    off = null,
    log,
    composer,
    head,
    reply = "",
    roomRows = {},
    mutes = new Set(),
    reads = {},
    items = [];
  const panes = {};
  const previews = {}, previewListeners = new Map();
  let conversationSearch = "";
  function roomAvatar(r) {
    const ids = (r.memberIds || []).filter(id => id !== P.uid);
    if (r.kind !== "group") return P.avatar(P.person(ids[0]));
    const stack = P.el("span", "p-chat-avatars");
    ids.slice(0, 2).forEach(id => stack.append(P.avatar(P.person(id))));
    if (!ids.length) stack.append(P.avatar({pledgeName:r.title}));
    return stack;
  }
  function channels() {
    return P985Policy.channels(P.grant);
  }
  function roomTitle(r) {
    if (r.channel || r.kind === "group") return r.title;
    return P.name(P.person(r.memberIds.find((x) => x !== P.uid)));
  }
  function unread(r) {
    const key = (r.channel ? "channel-" : "chat-") + r.id;
    const latest = previews[r.id];
    if(!r.channel && latest?.lastSenderUid !== P.uid && !P.blocks.has(latest?.lastSenderUid) && latest?.lastMessageAt && P.date(latest.lastMessageAt)>P.date(reads[key]?.readAt))return true;
    return items.some(
      (i) =>
        i.roomID === r.id &&
        !P.blocks.has(i.actor) &&
        i.read !== true &&
        P.date(i.createdAt) > P.date(reads[key]?.readAt),
    );
  }
  function lists() {
    const count=conversations.filter(r=>(r.kind!=="direct" || !r.memberIds.some(id=>P.blocks.has(id))) && unread(r)).length;
    const nav=document.querySelector('[data-tab="messages"]');
    if(nav){let badge=nav.querySelector('.p-messages-badge');if(!badge){badge=P.el('span','p-messages-badge');nav.append(badge);}badge.hidden=!count;badge.dataset.count=count>99?'99+':String(count);badge.textContent='';nav.setAttribute('aria-label',count?`Messages, ${count} unread conversations`:'Messages');}

    for (const [tab, rooms] of [
      ["channels", channels()],
      [
        "messages",
        conversations.filter(
          (r) =>
            r.kind !== "direct" || !r.memberIds.some((id) => P.blocks.has(id)),
        ),
      ],
    ]) {
      const el = panes[tab]?.list;
      if (!el) continue;
      el.replaceChildren();
      const roomButton = (r) => {
        const b = P.button((unread(r) ? "● " : "") + roomTitle(r), () => open(r));
        if (active?.id === r.id) b.classList.add("selected");
        return b;
      };
      if (tab === "channels") {
        el.classList.add("p-channel-groups");
        const general = new Set(["general", "shitposting", "gaming", "sports", "finance"]);
        for (const [title, isGeneral] of [["Brotherhood", true], ["Your Circle", false]]) {
          const group = P.el("section", "p-channel-group");
          group.setAttribute("aria-label", title);
          group.append(P.el("h2", "p-channel-group-title", title));
          const roomList = P.el("div", "p-channel-group-rooms");
          rooms.filter(r => general.has(r.id) === isGeneral).forEach(r => roomList.append(roomButton(r)));
          if (roomList.childElementCount) {group.append(roomList); el.append(group);}
        }
      } else {
        rooms.map(r => ({...r,...previews[r.id]})).sort((a,b) => P.date(b.lastMessageAt || b.updatedAt || b.createdAt) - P.date(a.lastMessageAt || a.updatedAt || a.createdAt)).filter(r => (roomTitle(r) + " " + (r.memberIds || []).map(id => {const b=P.person(id);return [b?.firstName,b?.lastName,b?.pledgeName].join(" ");}).join(" ")).toLowerCase().includes(conversationSearch.toLowerCase())).forEach(r => {
          const b=P.button("",()=>open(r),"p-btn p-conversation");
          b.classList.toggle("selected",active?.id===r.id && !active?.channel);
          b.setAttribute("aria-pressed",String(active?.id===r.id && !active?.channel));
          b.classList.toggle("is-unread",unread(r));
          const text=P.el("span","p-conversation-text"), top=P.el("span","p-conversation-top");
          top.append(P.el("strong","",roomTitle(r)));
          if(r.lastMessageAt) top.append(P.el("time","",P.date(r.lastMessageAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})));
          text.append(top,P.el("span","p-conversation-preview",r.lastMessage || (r.kind==="group" ? `${r.memberIds.length} brothers · Group conversation` : "Direct message")));
          b.append(roomAvatar(r),text);
          if(unread(r)){const dot=P.el("span","p-unread-dot");dot.setAttribute("aria-label","Unread messages");b.append(dot);}
          el.append(b);
        });
        if(rooms.length && !el.childElementCount)el.append(P.empty("No conversations found."));
      }
      if (!rooms.length) el.append(P.empty("Start a conversation."));
    }
    if (active?.channel && !channels().some((r) => r.id === active.id)) {
      off?.();
      active = null;
      panes.channels.chat.replaceChildren(
        P.empty("Your channel access changed."),
      );
    }
  }
  async function read() {
    if (!active || document.hidden || location.hash !== (active.channel ? "#channels" : "#messages")) return;
    const room = active;
    const key = (room.channel ? "channel-" : "chat-") + room.id;
    await db
      .doc("roomReads/" + P.uid + "/rooms/" + key)
      .set({ readAt: P.stamp() });
    const pending = items.filter((i) => i.roomID === room.id && !i.read);
    for (let start = 0; start < pending.length; start += 400) {
      const batch = db.batch();
      pending.slice(start, start + 400).forEach((i) =>
        batch.update(db.doc("activity/" + P.uid + "/items/" + i.id), {
          read: true,
        }),
      );
      await batch.commit();
    }
  }
  function open(r) {
    off?.();
    active = r;
    reply = "";
    const tab = r.channel ? "channels" : "messages";
    P.go(tab);
    const chat = panes[tab].chat;
    chat.replaceChildren();
    head = P.el("div", "p-chat-head");
    if (!r.channel) {
      const identity=P.button("",()=> {if(r.kind!=="group")P.profile(r.memberIds.find(id=>id!==P.uid));},"p-chat-identity");
      const labels=P.el("span");labels.append(P.el("strong","",roomTitle(r)),P.el("small","p-muted",r.kind==="group"?`${r.memberIds.length} brothers`:"View profile"));
      identity.append(roomAvatar(r),labels);head.append(identity);
    } else head.append(P.el("h2", "", "# " + roomTitle(r)));
    chat.classList.toggle("p-channel-chat", !!r.channel);
    if (r.channel)
      head.append(
        P.button(mutes.has(r.id) ? "Unmute" : "Mute", () =>
          P.run(head, async () => {
            const ref = db.doc("channelMutes/" + P.uid + "/rooms/" + r.id);
            if (mutes.has(r.id)) await ref.delete();
            else await ref.set({ createdAt: P.stamp() });
            open(r);
          }),
        ),
        P.button("Poll", () => P.newPoll(r.id)),
      );
    log = P.el("div", "p-chat-log");
    log.setAttribute("role", "log");
    composer = P.el("form", "p-chat-compose");
    const input = P.field("Message", "textarea"),
      file = P.field("Photo", "file"),
      status = P.el("p", "p-muted"),
      hint = P.el("div");
    input.input.maxLength = 2000;
    file.input.accept = "image/*";
    const key = "985.draft." + P.uid + "." + tab + "." + r.id;
    input.input.value = localStorage.getItem(key) || "";
    input.input.oninput = () => localStorage.setItem(key, input.input.value);
    P.mentionPicker(input.input);
    input.wrap.className = "p-chat-input";
    input.wrap.firstChild.className = "p-sr-only";
    input.input.rows = 1;
    input.input.placeholder =
      "Message " + (r.channel ? "#" : "") + roomTitle(r).toLowerCase();
    input.input.setAttribute("aria-label", "Message");
    file.wrap.hidden = true;
    const send = P.button(
      "",
      () => composer.requestSubmit(),
      "p-compose-icon p-send",
    );
    send.setAttribute("aria-label", "Send message");
    send.title = "Send message";
    send.append(P.icon("send"));
    const attach = P.button("", () => file.input.click(), "p-compose-icon");
    attach.setAttribute("aria-label", "Attach photo");
    attach.title = "Attach photo";
    attach.append(P.icon("plus"));
    const emoji = P.button(
      "",
      () => P.emojiPicker(input.input),
      "p-compose-icon",
    );
    emoji.setAttribute("aria-label", "Add emoji");
    emoji.title = "Add emoji";
    emoji.append(P.icon("smile"));
    const attachment = P.el("div", "p-attachment");
    file.input.onchange = () => {
      attachment.replaceChildren();
      if (file.input.files[0])
        attachment.append(
          P.el("span", "", file.input.files[0].name),
          P.button("Remove", () => {
            file.input.value = "";
            attachment.replaceChildren();
          }),
        );
    };
    const bar = P.el("div", "p-compose-bar");
    bar.append(attach, input.wrap, emoji, send);
    composer.append(hint, attachment, bar, file.wrap, status);
    input.input.addEventListener("input", () => {
      input.input.style.height = "auto";
      input.input.style.height = Math.min(140, input.input.scrollHeight) + "px";
    });
    input.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        composer.requestSubmit();
      }
    });
    chat.append(head, log, composer);
    const path =
      (r.channel ? "socialChannels/" : "conversations/") + r.id + "/messages";
    let first = true;
    off = db
      .collection(path)
      .orderBy("createdAt", "desc")
      .limit(100)
      .onSnapshot(
        (s) => {
          const nearBottom =
            log.scrollHeight - log.scrollTop - log.clientHeight < 150;
          const rows = s.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
          roomRows = Object.fromEntries(rows.map((m) => [m.id, m]));
          log.replaceChildren();
          rows.forEach((m) => {
            if (P.blocks.has(m.senderUid) && (r.channel || r.kind === "direct"))
              return;
            let hidden = [];
            try {
              hidden = JSON.parse(
                localStorage.getItem("985.hidden." + P.uid + "." + path) ||
                  "[]",
              );
            } catch {}
            if (hidden.includes(m.id)) return;
            const c = P.el(
              "div",
              "p-message" +
                (r.channel
                  ? " p-channel-message"
                  : m.senderUid === P.uid
                    ? " mine"
                    : ""),
            );
            c.append(
              P.author(m.senderUid, m.senderName),
              P.el("small", "", P.when(m.createdAt)),
            );
            if (m.replyToID)
              c.append(
                P.el(
                  "div",
                  "p-reply",
                  roomRows[m.replyToID]
                    ? roomRows[m.replyToID].senderName +
                        ": " +
                        roomRows[m.replyToID].body
                    : "Reply to an earlier message",
                ),
              );
            c.append(P.text(m.body, m));
            if (m.photoPath) {
              const img = P.image(m.photoPath);
              img.onclick = () => P.expand(m.photoPath);
              c.append(img);
            }
            if (m.sharedPostID)
              c.append(
                P.button("View shared post", () => P.openPost(m.sharedPostID)),
              );
            if (m.pollID) P.poll(m.pollID, c);
            const actions = P.el("div", "p-actions");
            const counts = {};
            Object.values(m.reactions || {})
              .filter(Boolean)
              .forEach((e) => (counts[e] = (counts[e] || 0) + 1));
            Object.entries(counts).forEach(([emoji, n]) =>
              actions.append(P.button(emoji + " " + n, () => react(m, emoji))),
            );
            actions.append(P.button("•••", (e) => menu(m, e)));
            c.append(actions);
            c.ondblclick = (e) => {
              if (!e.target.closest("button,img")) react(m, "❤️");
            };
            c.oncontextmenu = (e) => {
              e.preventDefault();
              menu(m, e);
            };
            log.append(c);
          });
          if (!rows.length) log.append(P.empty("Start the conversation."));
          if (first || nearBottom) log.scrollTop = log.scrollHeight;
          first = false;
          read().catch((e) => P.error(head, e));
        },
        (e) => P.error(chat, e),
      );
    function react(m, emoji) {
      P.run(chat, () =>
        db
          .doc(path + "/" + m.id)
          .update(
            new firebase.firestore.FieldPath("reactions", P.uid),
            m.reactions?.[P.uid] === emoji
              ? firebase.firestore.FieldValue.delete()
              : emoji,
          ),
      );
    }
    function menu(m, event) {
      const box = P.el("div"),
        emojis = P.row();
      ["❤️", "😂", "🔥", "👍", "🤝", "😮", "😢", "😡"].forEach((e) =>
        emojis.append(
          P.button(e, () => {
            react(m, e);
            d.close();
          }),
        ),
      );
      emojis.classList.add("p-message-reaction-strip");
      box.append(emojis);
      const actions = P.el("div", "p-suggestions");
      actions.append(
        P.button("Reply", () => {
          reply = m.id;
          hint.replaceChildren(
            P.row(
              P.el("span", "p-reply", "Replying to " + m.senderName),
              P.button("Cancel", () => {
                reply = "";
                hint.replaceChildren();
              }),
            ),
          );
          d.close();
          input.input.focus();
        }),
        P.button("Copy", () =>
          P.run(box, async () => {
            await navigator.clipboard.writeText(m.body);
            d.close();
          }),
        ),
      );
      actions.append(P.button("Report message", () => { d.close(); P.reportContent(path + "/" + m.id); }));
      if (m.senderUid === P.uid || P.me.isAdmin)
        actions.append(
          P.button(
            m.senderUid === P.uid ? "Delete" : "Delete for everyone",
            () =>
              P.run(box, async () => {
                if (await P.confirm("Delete this message for everyone?")) {
                  await db.doc(path + "/" + m.id).delete();
                  d.close();
                }
              }),
            "p-btn danger",
          ),
        );
      if (m.senderUid !== P.uid)
        actions.append(
          P.button("Delete for you on this browser", () => {
            const k = "985.hidden." + P.uid + "." + path;
            let v = [];
            try {
              v = JSON.parse(localStorage.getItem(k) || "[]");
            } catch {}
            localStorage.setItem(k, JSON.stringify([...v, m.id]));
            if(previews[r.id]?.messageID===m.id)previews[r.id]={};
            d.close();
            open(r);
          }),
        );
      box.append(actions);
      const anchor=event?.currentTarget?.getBoundingClientRect();
      const d = P.dialog("Message actions", box);
      d.classList.add("p-message-menu");
      d.setAttribute("aria-label","Message actions");
      d.firstElementChild.remove();
      const x=event?.clientX || anchor?.left || 20, y=event?.clientY || anchor?.bottom || 20;
      const place=()=>{d.style.left=Math.max(8,Math.min(x,innerWidth-d.offsetWidth-8))+"px";d.style.top=Math.max(8,Math.min(y,innerHeight-d.offsetHeight-8))+"px";};
      place();d.querySelector("button")?.focus();
      window.addEventListener("resize",place);
      d.cleanup=()=>window.removeEventListener("resize",place);
      navigator.vibrate?.(10);
    }
    let requestID;
    composer.onsubmit = (e) => {
      e.preventDefault();
      P.run(composer, async () => {
        const body = input.input.value.trim();
        if (!body && !file.input.files[0])
          throw Error("Type a message or choose a photo.");
        send.disabled = true;
        requestID = requestID || crypto.randomUUID();
        try {
          const ref = db.doc(path + "/" + requestID);
          if (!(await ref.get()).exists) {
            let photoPath = "";
            if (file.input.files[0])
              photoPath = await P.upload(
                file.input.files[0],
                (r.channel ? "channelPhotos/" : "chatPhotos/") +
                  r.id +
                  "/" +
                  requestID +
                  "/" +
                  P.uid +
                  ".jpg",
                status,
              );
            await ref.set({
              senderUid: P.uid,
              senderName: P.name(P.me),
              body,
              photoPath,
              createdAt: P.stamp(),
              reactions: {},
              replyToID: reply,
              ...P.mentions(input.input),
            });
          }
          requestID = null;
          input.input.value = "";
          file.input.value = "";
          attachment.replaceChildren();
          input.input.style.height = "auto";
          reply = "";
          hint.replaceChildren();
          localStorage.removeItem(key);
          status.textContent = "";
        } finally {
          send.disabled = false;
        }
      });
    };
    lists();
  }
  P.newConversation = (preselected = [], sharedPost) => {
    const box = P.el("div"),
      search = P.field("Search brothers"),
      name = P.field("Group name (for 3 or more members)"),
      matches = P.el("div", "p-suggestions"),
      selected = new Set(preselected),
      summary = P.el("p");
    box.append(search.wrap, matches, summary, name.wrap);
    function draw() {
      summary.textContent =
        [...selected].map((id) => P.name(P.person(id))).join(", ") ||
        "Choose one brother for a DM, or several for a group.";
      matches.replaceChildren();
      P.brothers
        .filter(
          (b) =>
            b.uid !== P.uid &&
            !P.blocks.has(b.uid) &&
            (P.name(b) + " " + b.firstName + " " + b.lastName)
              .toLowerCase()
              .includes(search.input.value.toLowerCase()),
        )
        .slice(0, 40)
        .forEach((b) =>
          matches.append(
            P.button(
              (selected.has(b.uid) ? "✓ " : "") + P.name(b) + " · " + b.chapter,
              () => {
                selected.has(b.uid)
                  ? selected.delete(b.uid)
                  : selected.add(b.uid);
                draw();
              },
              "p-choice",
            ),
          ),
        );
    }
    search.input.oninput = draw;
    draw();
    box.append(
      P.button(
        sharedPost ? "Send post" : "Start conversation",
        () =>
          P.run(box, async () => {
            const members = [...new Set([P.uid, ...selected])].sort();
            if (members.length < 2 || members.length > 30)
              throw Error("Choose 1–29 brothers.");
            const direct = members.length === 2,
              title = direct ? "Direct message" : name.input.value.trim();
            if (!title || title.length > 80)
              throw Error("Enter a group name, up to 80 characters.");
            const id = direct
              ? Array.from(
                  new Uint8Array(
                    await crypto.subtle.digest(
                      "SHA-256",
                      new TextEncoder().encode(members.join("|")),
                    ),
                  ),
                )
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("")
              : crypto.randomUUID();
            const ref = db.doc("conversations/" + id);
            await db.runTransaction(async (tx) => {
              const snap = await tx.get(ref);
              if (!snap.exists)
                tx.set(ref, {
                  memberIds: members,
                  title,
                  kind: direct ? "direct" : "group",
                  createdBy: P.uid,
                  createdAt: P.stamp(),
                });
            });
            if (sharedPost) await sendShared(id, sharedPost);
            d.close();
            open({
              id,
              title,
              memberIds: members,
              kind: direct ? "direct" : "group",
            });
          }),
        "p-btn primary",
      ),
    );
    const d = P.dialog(
      sharedPost ? "Share to a new conversation" : "New message",
      box,
    );
  };
  async function sendShared(id, post) {
    await db.collection("conversations/" + id + "/messages").add({
      senderUid: P.uid,
      senderName: P.name(P.me),
      body: "",
      photoPath: "",
      createdAt: P.stamp(),
      reactions: {},
      mentionIds: [],
      mentionChapters: [],
      sharedPostID: post.id,
    });
  }
  P.sharePost = (post) => {
    const box = P.el("div");
    box.append(
      P.button("New conversation", () => {
        d.close();
        P.newConversation([], post);
      }),
    );
    conversations
      .filter(
        (r) =>
          r.kind !== "direct" || !r.memberIds.some((id) => P.blocks.has(id)),
      )
      .forEach((r) =>
        box.append(
          P.button(
            roomTitle(r),
            () =>
              P.run(box, async () => {
                await sendShared(r.id, post);
                d.close();
                open(r);
              }),
            "p-choice",
          ),
        ),
      );
    const d = P.dialog("Send post", box);
  };
  P.ready(() => {
    for (const tab of ["channels", "messages"]) {
      const root = P.root(tab);
      root.replaceChildren(
        P.header(
          tab === "channels" ? "Channels" : "Messages",
          tab === "channels"
            ? "Your circles and the whole brotherhood."
            : "Keep the conversation going.",
        ),
      );
      const layout = P.el("div", "p-chat-layout"),
        list = P.el("div", "p-room-list"),
        chat = P.el("div", "p-chat");
      chat.append(P.empty("Choose a conversation."));
      if(tab === "messages") {
        root.classList.add("p-messages-page");
        root.querySelector(".p-header p")?.remove();
        const sidebar=P.el("aside","p-inbox"), tools=P.el("div","p-inbox-tools");
        const search=P.field("Search conversations","search");search.input.placeholder="Search messages";search.input.oninput=()=>{conversationSearch=search.input.value;lists();};
        tools.append(P.button("New message",()=>P.newConversation(),"p-btn primary"),search.wrap);
        sidebar.append(tools,list);layout.append(sidebar,chat);
        const empty=P.el("div","p-chat-welcome");empty.append(P.icon("send"),P.el("h2","","Your conversations, together."),P.el("p","p-muted","Catch up with a brother or bring the group together."),P.button("Start a conversation",()=>P.newConversation(),"p-btn primary"));chat.replaceChildren(empty);
      } else layout.append(list, chat);
      root.append(layout);
      panes[tab] = { list, chat };
    }
    P.watch(
      db
        .collection("conversations")
        .where("memberIds", "array-contains", P.uid),
      (rows) => {
        conversations = rows;
        for(const [id,unsubscribe] of previewListeners)if(!rows.some(r=>r.id===id)){unsubscribe();previewListeners.delete(id);delete previews[id];}
        rows.forEach(r=>{
          if(previewListeners.has(r.id))return;
          const unsubscribe=db.collection("conversations/"+r.id+"/messages").orderBy("createdAt","desc").limit(1).onSnapshot(snapshot=>{
            const doc=snapshot.docs[0], m=doc?.data();
            let hidden=[];try{hidden=JSON.parse(localStorage.getItem("985.hidden."+P.uid+".conversations/"+r.id+"/messages")||"[]");}catch{}
            previews[r.id]=m && !hidden.includes(doc.id) ? {messageID:doc.id,lastSenderUid:m.senderUid,lastMessage:(m.senderUid===P.uid?"You: ":"")+(m.body || (m.photoPath?"Sent a photo":m.sharedPostID?"Shared a post":"New message")),lastMessageAt:m.createdAt} : {};
            lists();
          },()=>{});
          previewListeners.set(r.id,unsubscribe);P.listeners.push(unsubscribe);
        });
        lists();
      },
    );
    P.watch(db.collection("channelMutes/" + P.uid + "/rooms"), (rows) => {
      mutes = new Set(rows.map((r) => r.id));
      lists();
    });
    P.watch(db.collection("roomReads/" + P.uid + "/rooms"), (rows) => {
      reads = Object.fromEntries(rows.map((r) => [r.id, r]));
      lists();
    });
    P.watch(
      db
        .collection("activity/" + P.uid + "/items")
        .orderBy("createdAt", "desc")
        .limit(150),
      (rows) => {
        items = rows;
        lists();
        notifications();
      },
    );
    lists();
  });
  function notifications() {
    const list = document.getElementById("notificationList"),
      bell = document.getElementById("notificationBellDot");
    const visible = items.filter(
      (i) =>
        !P.blocks.has(i.actor) &&
        !mutes.has(i.roomID) &&
        (["mentions", "replies", "applications"].includes(i.kind) || i.eventID || i.announcementRequestID),
    );
    bell.hidden = !visible.some((i) => !i.read);
    list.replaceChildren();
    visible.forEach((i) => {
      const b = P.button(
        (i.read ? "" : "● ") + (i.title || "985") + " — " + (i.body || ""),
        () =>
          P.run(list, async () => {
            await db
              .doc("activity/" + P.uid + "/items/" + i.id)
              .update({ read: true });
            if (i.reportID) P.reviewReports();
            else if (i.eventID) P.openEvent(i.eventID);
            else if (i.postID) P.openPost(i.postID);
            else if (i.announcementRequestID) {
              if (P.me.isAdmin) P.reviewAnnouncements(); else P.go("announcements");
            }
            else if (i.roomID) {
              const r =
                channels().find((r) => r.id === i.roomID) ||
                conversations.find((r) => r.id === i.roomID);
              if (r) open(r);
            } else if (i.kind === "applications") P.go("admin");
            document.getElementById("notificationDropdown").hidden = true;
          }),
        "p-choice",
      );
      list.append(b);
    });
    if (!visible.length) list.append(P.empty("You’re all caught up."));
  }
  document.getElementById("notificationBellBtn").onclick = () => {
    const d = document.getElementById("notificationDropdown");
    d.hidden = !d.hidden;
    document
      .getElementById("notificationBellBtn")
      .setAttribute("aria-expanded", String(!d.hidden));
  };
  document.addEventListener("p985:access", lists);
  document.addEventListener("p985:blocks", () => {
    lists();
    if (active) open(active);
  });
  document.addEventListener("p985:people", lists);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) read().catch(() => {});
  });
  document.addEventListener("nap:tab-changed", (e) => {
    if (active && e.detail.tab !== (active.channel ? "channels" : "messages")) {
      off?.();
      off = null;
      active = null;
    }
  });
})();
