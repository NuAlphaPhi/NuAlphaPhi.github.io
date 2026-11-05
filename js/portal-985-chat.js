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
    if(r.avatarPath)return P.avatar({avatarPath:r.avatarPath,pledgeName:r.title});
    const stack = P.el("span", "p-chat-avatars");
    ids.slice(0, 2).forEach(id => stack.append(P.avatar(P.person(id))));
    if (!ids.length) stack.append(P.avatar({pledgeName:r.title}));
    return stack;
  }
  function channels() {
    return P985Policy.channels(P.grant);
  }
  function restoreChannel(){
    if(!P.uid||!P.accessReady||!panes.channels||active?.channel||document.querySelector('[data-panel="channels"]')?.hidden!==false)return;
    let previous='';try{previous=localStorage.getItem('985.lastChannel.'+P.uid)||'';}catch(_){}
    const room=P985Policy.resumeChannel(P.grant,previous);if(room)open(room);
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
        const b = P.button((unread(r) ? "● " : "# ") + roomTitle(r), () => open(r));
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
          if(r.kind==="group")b.oncontextmenu=e=>{e.preventDefault();groupDetails(r);};
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
  function groupDetails(room) {
    let r=conversations.find(c=>c.id===room.id)||room;
    const box=P.el("div","p-group-details"), identity=P.el("div","p-group-summary"), form=P.el("form","p-group-edit");
    const name=P.field("Group name","text",r.title), photo=P.field("Group icon","file"), status=P.el("p","p-muted");
    name.input.maxLength=80;photo.input.accept="image/*";
    identity.append(roomAvatar(r),P.el("h3","",r.title),P.el("p","p-muted",`${r.memberIds.length} members`));
    form.append(name.wrap,photo.wrap,P.el("small","p-muted","Group members can update the name and icon."));
    const save=P.button("Save changes",()=>form.requestSubmit(),"p-btn primary");form.append(save,status);
    form.onsubmit=e=>{e.preventDefault();P.run(form,async()=>{
      const title=name.input.value.trim();if(!title||title.length>80)throw Error("Enter a group name, up to 80 characters.");
      save.disabled=true;let uploaded="";
      try {
        const patch={title,updatedAt:P.stamp()};
        if(photo.input.files[0]){uploaded=await P.upload(photo.input.files[0],`groupPhotos/${r.id}/${P.uid}/${crypto.randomUUID()}.jpg`,status,true);patch.avatarPath=uploaded;}
        await db.doc("conversations/"+r.id).update(patch);
        r={...r,...patch};conversations=conversations.map(c=>c.id===r.id?{...c,...patch}:c);lists();
        identity.replaceChildren(roomAvatar(r),P.el("h3","",r.title),P.el("p","p-muted",`${r.memberIds.length} members`));
        if(active?.id===r.id&&!active.channel){active={...active,...patch};const titleEl=head?.querySelector(".p-chat-identity strong");if(titleEl)titleEl.textContent=r.title;const avatar=head?.querySelector(".p-chat-identity > span:first-child");if(avatar)avatar.replaceWith(roomAvatar(r));}
        photo.input.value="";status.textContent="Group updated.";
      } catch(error){if(uploaded)storage.ref(uploaded).delete().catch(()=>{});throw error;}finally{save.disabled=false;}
    });};
    const tabs=P.el("div","p-group-tabs"), content=P.el("div","p-group-content");
    let selected="Members", messages=[], cursor=null, exhausted=false, loading=false;
    function draw(){
      content.replaceChildren();
      for(const button of tabs.children){button.classList.toggle("selected",button.textContent===selected);button.setAttribute("aria-pressed",String(button.textContent===selected));}
      if(selected==="Members"){
        r.memberIds.forEach(uid=>{const person=P.person(uid),b=P.button("",()=>{d.close();P.profile(uid);},"p-group-member");b.append(P.avatar(person),P.el("span","",P.name(person)),P.el("small","p-muted",uid===P.uid?"You":person?.chapter||""));content.append(b);});return;
      }
      let hidden=[];try{hidden=JSON.parse(localStorage.getItem(`985.hidden.${P.uid}.conversations/${r.id}/messages`)||"[]");}catch{}
      const rows=messages.filter(m=>!hidden.includes(m.id));
      if(selected==="Media"){
        const grid=P.el("div","p-group-media");rows.filter(m=>m.photoPath).forEach(m=>{const b=P.button("",()=>P.expand(m.photoPath),"p-group-photo");b.append(P.image(m.photoPath,"","Photo from "+(m.senderName||"a brother")));grid.append(b);});content.append(grid);
        if(!grid.childElementCount)content.append(P.empty(loading?"Loading media…":"No photos in the messages loaded so far."));
      }else{
        const seen=new Set();rows.forEach(m=>{
          const urls=String(m.body||"").match(/https?:\/\/[^\s<>]+/gi)||[];
          urls.forEach(raw=>{let url;try{url=new URL(raw.replace(/[).,!?;]+$/, ""));}catch{return;}if(!["https:","http:"].includes(url.protocol)||seen.has(url.href))return;seen.add(url.href);const a=P.el("a","p-group-link");a.href=url.href;a.target="_blank";a.rel="noopener noreferrer";a.append(P.el("strong","",url.hostname),P.el("span","",url.href));content.append(a);});
          if(m.sharedPostID){const b=P.button("Shared brotherhood post",()=>{d.close();P.openPost(m.sharedPostID);},"p-group-link");content.append(b);}
        });
        if(!content.childElementCount)content.append(P.empty(loading?"Loading links…":"No links in the messages loaded so far."));
      }
      if(!exhausted){const more=P.button(loading?"Loading…":"Load older messages",load,"p-btn");more.disabled=loading;content.append(more);}
      content.append(P.el("small","p-muted",exhausted?"All shared history loaded.":"Shared items from the most recent messages. Load older messages for more."));
    }
    async function load(){if(loading||exhausted)return;loading=true;draw();try{let query=db.collection(`conversations/${r.id}/messages`).orderBy("createdAt","desc").limit(100);if(cursor)query=query.startAfter(cursor);const page=await query.get();messages.push(...page.docs.map(doc=>({id:doc.id,...doc.data()})));cursor=page.docs.at(-1)||cursor;exhausted=page.size<100;}catch(error){loading=false;draw();P.error(content,error);return;}loading=false;draw();}
    ["Members","Media","Links"].forEach(label=>tabs.append(P.button(label,()=>{selected=label;draw();if(label!=="Members"&&!messages.length&&!exhausted)load();},"p-btn")));
    const membership=P.el('div','p-card');membership.append(P.el('p','p-muted','New members can read the full group history. Removing a member ends their access.'));
    const manage=(operation,memberUid)=>P.run(membership,async()=>{await P.call('portalAction',{action:'group',roomID:r.id,operation,memberUid});d.close();P.toast('Group updated');if(operation==='leave'){off?.();active=null;P.go('messages');}});
    if(r.createdBy===P.uid||P.me.isAdmin){
      const member=P.select('Current member',r.memberIds.map(id=>[id,P.name(P.person(id))]),r.memberIds[0]);
      const add=P.select('Add brother',P.brothers.filter(b=>!r.memberIds.includes(b.uid)).map(b=>[b.uid,P.name(b)+' · '+b.chapter]));
      membership.append(member.wrap,P.button('Remove member',()=>manage('remove',member.input.value)),P.button('Transfer ownership',()=>manage('transfer',member.input.value)),add.wrap,P.button('Add member',()=>manage('add',add.input.value)));
    }
    membership.append(P.button('Leave group',()=>manage('leave')));
    box.append(identity,form,membership,tabs,content);const d=P.dialog("Group details",box);d.classList.add("p-group-dialog");draw();
  }
  async function read() {
    if (!active || document.hidden || location.hash !== (active.channel ? "#channels" : "#messages")) return;
    const room = active;
    if(!room.channel && roomPrefs.shareReceipts)await db.doc('conversations/'+room.id+'/readReceipts/'+P.uid).set({readAt:P.stamp()});
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
  let receiptOff, roomPrefsOff, roomPrefs={};
  function open(r, messageLimit = 100, olderHeight = 0) {
    off?.();receiptOff?.();roomPrefsOff?.();roomPrefs={};
    active = r;
    if(r.channel){try{localStorage.setItem('985.lastChannel.'+P.uid,r.id);}catch(_){}}
    reply = "";
    const tab = r.channel ? "channels" : "messages";
    P.go(tab);
    const chat = panes[tab].chat;
    chat.replaceChildren();
    head = P.el("div", "p-chat-head");
    if (!r.channel) {
      const identity=P.button("",()=> {if(r.kind==="group")groupDetails(r);else P.profile(r.memberIds.find(id=>id!==P.uid));},"p-chat-identity");
      const labels=P.el("span");labels.append(P.el("strong","",roomTitle(r)),P.el("small","p-muted",r.kind==="group"?`${r.memberIds.length} brothers`:"View profile"));
      identity.append(roomAvatar(r),labels);if(r.kind==="group")identity.oncontextmenu=e=>{e.preventDefault();groupDetails(r);};head.append(identity);
    } else head.append(P.el("h2", "", "# " + roomTitle(r)));
    chat.classList.toggle("p-channel-chat", !!r.channel);
    if(!r.channel){
      const settings=P.row(),receipt=P.el('small','p-muted');head.append(settings,receipt);
      const ref=db.doc('chatSettings/'+P.uid+'/rooms/'+r.id);
      roomPrefsOff=ref.onSnapshot(s=>{roomPrefs=s.data()||{};settings.replaceChildren(P.button(roomPrefs.muted?'Unmute':'Mute',()=>P.run(head,()=>ref.set({muted:!roomPrefs.muted},{merge:true}))),P.button(roomPrefs.shareReceipts?'Read receipts on':'Read receipts off',()=>P.run(head,async()=>{const enabled=!roomPrefs.shareReceipts;await ref.set({shareReceipts:enabled},{merge:true});if(!enabled)await db.doc('conversations/'+r.id+'/readReceipts/'+P.uid).delete();else await db.doc('conversations/'+r.id+'/readReceipts/'+P.uid).set({readAt:P.stamp()});})));},e=>P.error(head,e));
      receiptOff=db.collection('conversations/'+r.id+'/readReceipts').onSnapshot(s=>{receipt.textContent=s.docs.filter(d=>d.id!==P.uid&&r.memberIds.includes(d.id)).map(d=>P.name(P.person(d.id))+' read '+P.when(d.data().readAt)).join(' · ');},e=>P.error(head,e));
    }
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
    try { input.input._mentions=JSON.parse(localStorage.getItem(key+".mentions")||"{}"); } catch (_) {}
    input.input.oninput = () => {localStorage.setItem(key, input.input.value);localStorage.setItem(key+".mentions",JSON.stringify(input.input._mentions||{}));};
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
    const photoAttachment = P.photoAttachment(composer, file.input, attachment, () => send.disabled);
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
    const roomSearch=P.field('Search loaded messages','search');
    roomSearch.input.oninput=()=>log.querySelectorAll('.p-message').forEach(el=>{el.hidden=!el.textContent.toLowerCase().includes(roomSearch.input.value.toLowerCase());});
    head.append(P.button('Search',()=>{roomSearch.wrap.hidden=!roomSearch.wrap.hidden;roomSearch.input.focus();}),P.button('Jump to latest',()=>{log.scrollTop=log.scrollHeight;}));
    roomSearch.wrap.hidden=true;
    chat.append(head,roomSearch.wrap,log,composer);
    let loadingOlder=false;
    log.addEventListener('scroll',()=>{if(log.scrollTop<20&&!loadingOlder&&Object.keys(roomRows).length>=messageLimit){loadingOlder=true;open(r,messageLimit+100,log.scrollHeight);}});
    const path =
      (r.channel ? "socialChannels/" : "conversations/") + r.id + "/messages";
    head.append(P.button('Pinned',()=>{
      const box=P.el('div');P.dialog('Pinned messages',box);P.run(box,async()=>{const snap=await db.collection(path).where('pinned','==',true).get();snap.docs.forEach(doc=>{const m=doc.data();if(P.blocks.has(m.senderUid)&&(r.channel||r.kind==='direct'))return;box.append(P.el('strong','',m.senderName),P.text(m.body,m));if(m.photoPath)box.append(P.image(m.photoPath));});if(!box.childElementCount)box.append(P.empty('No pinned messages.'));});
    }),P.button('Find in history',()=>{
      const box=P.el('div'),field=P.field('Search conversation','search'),results=P.el('div'),status=P.el('p','p-muted');let rows=[],closed=false;
      const d=P.dialog('Search message history',box);d.cleanup=()=>{closed=true;};
      const draw=()=>{results.replaceChildren();const q=field.input.value.trim().toLowerCase();if(!q)return;rows.filter(m=>String(m.body||'').toLowerCase().includes(q)&&!(P.blocks.has(m.senderUid)&&(r.channel||r.kind==='direct'))).slice(0,100).forEach(m=>{const card=P.el('div','p-card');card.append(P.el('strong','',m.senderName),P.el('small','p-muted',P.when(m.createdAt)),P.text(m.body,m));results.append(card);});};
      field.input.oninput=draw;box.append(field.wrap,status,results);P.run(box,async()=>{let cursor;do{let q=db.collection(path).orderBy('createdAt','desc').limit(200);if(cursor)q=q.startAfter(cursor);const page=await q.get();if(closed)return;rows.push(...page.docs.map(doc=>({id:doc.id,...doc.data()})));status.textContent='Searching '+rows.length+' messages…';draw();cursor=page.size===200?page.docs.at(-1):null;}while(cursor);status.textContent='All '+rows.length+' messages searched. Up to 100 matching results are shown.';});
    }));
    let first = true;
    off = db
      .collection(path)
      .orderBy("createdAt", "desc")
      .limit(messageLimit)
      .onSnapshot(
        (s) => {
          const nearBottom =
            log.scrollHeight - log.scrollTop - log.clientHeight < 150;
          const rows = s.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
          roomRows = Object.fromEntries(rows.map((m) => [m.id, m]));
          log.replaceChildren();
          let divider=false;
          const seen=P.date(reads[(r.channel?'channel-':'chat-')+r.id]?.readAt).getTime();
          if(rows.length>=messageLimit)log.append(P.button('Load older messages',()=>open(r,messageLimit+100,log.scrollHeight)));
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
            if(!divider&&m.senderUid!==P.uid&&P.date(m.createdAt).getTime()>seen){log.append(P.el('p','p-unread-divider','New messages'));divider=true;}
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
              P.el("small", "", P.when(m.createdAt)+(m.editedAt?" · edited":"")+(m.pinned?" · pinned":"")),
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
          if(first&&olderHeight)log.scrollTop=Math.max(1,log.scrollHeight-olderHeight);
          else if (first || nearBottom) log.scrollTop = log.scrollHeight;
          roomSearch.input.oninput();
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
      if(m.senderUid===P.uid && !m.pollID)actions.append(P.button('Edit message',()=>{
        d.close();const box=P.el('div'),f=P.field('Message','textarea',m.body);f.input.maxLength=2000;
        box.append(f.wrap,P.button('Save',()=>P.run(box,async()=>{await P.call('portalAction',{action:'editMessage',scope:r.channel?'channel':'chat',roomID:r.id,id:m.id,body:f.input.value});edit.close();})));const edit=P.dialog('Edit message',box);
      }));
      if(P.me.isAdmin||(!r.channel&&r.createdBy===P.uid))actions.append(P.button(m.pinned?'Unpin message':'Pin message',()=>P.run(box,async()=>{await P.call('portalAction',{action:'pinMessage',scope:r.channel?'channel':'chat',roomID:r.id,id:m.id,pinned:!m.pinned});d.close();})));
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
        if (!body && !photoAttachment.file)
          throw Error("Type a message or choose a photo.");
        send.disabled = true;
        requestID = requestID || crypto.randomUUID();
        try {
          const ref = db.doc(path + "/" + requestID);
          if (!(await ref.get()).exists) {
            let photoPath = "";
            if (photoAttachment.file)
              photoPath = await P.upload(
                photoAttachment.file,
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
          photoAttachment.clear();
          input.input.style.height = "auto";
          reply = "";
          hint.replaceChildren();
          localStorage.removeItem(key);localStorage.removeItem(key+".mentions");
          status.textContent = "";
        } finally {
          send.disabled = false;
        }
      });
    };
    lists();
  }
  P.newConversation = (preselected = [], sharedPost) => {
    const box = P.el("div", "p-new-message"),
      search = P.field("Search brothers", "search"),
      name = P.field("Group name"),
      matches = P.el("div", "p-recipient-list"),
      selected = new Set(preselected),
      summary = P.el("div", "p-recipient-chips");
    search.input.placeholder='Search by name or pledge name';search.wrap.classList.add('p-recipient-search');name.input.placeholder='Give your group a name';name.input.maxLength=80;
    box.append(P.el('p','p-new-message-hint','Choose a brother, or select several to start a group.'),search.wrap,summary,matches,name.wrap);
    function draw() {
      summary.replaceChildren();name.wrap.hidden=selected.size<2;
      selected.forEach(id=>{const chip=P.button(P.name(P.person(id))+' ×',()=>{selected.delete(id);draw();},'p-recipient-chip');chip.setAttribute('aria-label','Remove '+P.name(P.person(id)));summary.append(chip);});
      summary.hidden=!selected.size;
      const start=box.querySelector('.p-message-start');if(start){start.disabled=!selected.size;start.textContent=sharedPost?'Send post':selected.size>1?'Create group':'Start conversation';}
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
        .forEach(b=>{
          const button=P.button('',()=>{selected.has(b.uid)?selected.delete(b.uid):selected.add(b.uid);draw();},'p-recipient-row');button.setAttribute('aria-pressed',String(selected.has(b.uid)));
          const identity=P.el('span','p-recipient-identity');identity.append(P.el('strong','',P.name(b)),P.el('small','',[b.firstName,b.lastName].filter(Boolean).join(' ')+' · '+(b.chapter||'Brother')));
          button.append(P.avatar(b),identity,P.el('span','p-recipient-check',selected.has(b.uid)?'✓':''));matches.append(button);
        });
      if(!matches.childElementCount)matches.append(P.empty('No brothers found. Try another name.'));
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
        "p-btn primary p-message-start",
      ),
    );
    const d = P.dialog(
      sharedPost ? "Share to a new conversation" : "New message",
      box,
    );
    d.classList.add('p-new-message-dialog');const close=d.querySelector('.p-row > button');if(close){close.textContent='×';close.setAttribute('aria-label','Close new message');}draw();search.input.focus();
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
      } else {root.classList.add("p-channels-page");layout.append(list, chat);}
      root.append(layout);
      panes[tab] = { list, chat };
    }
    P.watch(
      db
        .collection("conversations")
        .where("memberIds", "array-contains", P.uid),
      (rows) => {
        conversations = rows;
        if(active&&!active.channel&&!rows.some(r=>r.id===active.id)){off?.();receiptOff?.();roomPrefsOff?.();active=null;panes.messages.chat.replaceChildren(P.empty("You are no longer a member of this conversation."));}
        if(active&&!active.channel){const current=rows.find(r=>r.id===active.id);if(current){active={...active,...current};const label=head?.querySelector(".p-chat-identity strong");if(label)label.textContent=roomTitle(current);const avatar=head?.querySelector(".p-chat-identity > span:first-child");if(avatar)avatar.replaceWith(roomAvatar(current));}}

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
        P.activity=rows;document.dispatchEvent(new Event("p985:activity"));
        lists();
        notifications();
      },
    );
    lists();restoreChannel();
  });
  let notificationFilter="all";
  function notifications() {
    const list = document.getElementById("notificationList"),
      bell = document.getElementById("notificationBellDot");
    const visible = items.filter(
      (i) =>
        !P.blocks.has(i.actor) &&
        !mutes.has(i.roomID) &&
        (notificationFilter==='all'||notificationFilter==='unread'&&!i.read||notificationFilter==='mentions'&&i.kind==='mentions'||notificationFilter==='events'&&i.eventID),
    );
    bell.hidden = !visible.some((i) => !i.read);
    list.replaceChildren();
    const filter=P.select('Notifications',[['all','All'],['unread','Unread'],['mentions','Mentions'],['events','Events']],notificationFilter);filter.input.onchange=()=>{notificationFilter=filter.input.value;notifications();};
    list.append(filter.wrap,P.button('Mark all read',()=>P.run(list,async()=>{const pending=items.filter(i=>!i.read);for(let n=0;n<pending.length;n+=400){const batch=db.batch();pending.slice(n,n+400).forEach(i=>batch.update(db.doc('activity/'+P.uid+'/items/'+i.id),{read:true}));await batch.commit();}})));
    visible.forEach((i) => {
      const b = P.button(
        (i.read ? "" : "● ") + (i.title || "985") + " — " + (i.body || ""),
        () =>
          P.run(list, async () => {
            await db
              .doc("activity/" + P.uid + "/items/" + i.id)
              .update({ read: true });
            if(i.formID)P.go("forms");
            else if (i.reportID) P.reviewReports();
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
  document.addEventListener("p985:access", ()=>{lists();restoreChannel();});
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
      off?.();receiptOff?.();roomPrefsOff?.();
      off = null;
      active = null;
    }
    if(e.detail.tab==="channels")restoreChannel();
  });
})();
