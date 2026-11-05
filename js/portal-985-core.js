/* Shared 985 portal primitives. All authorization remains enforced by Firebase. */
(function () {
  "use strict";
  const P = (window.P985 = {
    uid: "",
    me: {},
    grant: {},
    brothers: [],
    blocks: new Set(),
    posts: [],
    listeners: [],
    chapters: [
      "Alpha",
      "Beta",
      "Gamma",
      "Delta",
      "Epsilon",
      "Zeta",
      "Eta",
      "Theta",
      "Iota",
      "Kappa",
    ],
  });
  P.el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  P.button = (text, fn, cls = "p-btn") => {
    const b = P.el("button", cls, text);
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  P.icon = (name) => {
    const paths = {
      shield: "M12 2 21 6v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6",
      plus: "M12 4v16M4 12h16",
      send: "M22 2 9 15M22 2l-7 20-6-7-7-6z",
      photo: "M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M8 7h.01",
      smile:
        "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M8 9h.01M16 9h.01M7 14c2 5 8 5 10 0",
      poll: "M9 5h12M9 12h8M9 19h5M3 5h1M3 12h1M3 19h1",
    };
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(s.namespaceURI, "path");
    p.setAttribute("d", paths[name] || paths.plus);
    s.append(p);
    return s;
  };
  P.emojiPicker = (input) => {
    const box = P.el("div", "p-emoji-grid");
    const d = P.dialog("Add emoji", box);
    [
      "😀",
      "😂",
      "🥹",
      "😎",
      "🤝",
      "❤️",
      "🔥",
      "🎉",
      "👍",
      "🙏",
      "💪",
      "👀",
      "💯",
      "🎂",
      "🫡",
      "😭",
      "😮",
      "😡",
      "🙌",
      "✅",
      "🐐",
      "📣",
      "🏆",
      "🎮",
    ].forEach((e) =>
      box.append(
        P.button(
          e,
          () => {
            const start = input.selectionStart || input.value.length,
              end = input.selectionEnd || start;
            input.value =
              input.value.slice(0, start) + e + input.value.slice(end);
            input.dispatchEvent(new Event("input"));
            d.close();
            input.focus();
            input.setSelectionRange(start + e.length, start + e.length);
          },
          "p-emoji",
        ),
      ),
    );
  };
  P.row = (...els) => {
    const e = P.el("div", "p-row");
    e.append(...els.filter(Boolean));
    return e;
  };
  P.field = (label, type = "text", value = "") => {
    const wrap = P.el("label", "p-field"),
      i = P.el(type === "textarea" ? "textarea" : "input");
    if (type !== "textarea") i.type = type;
    i.value = value ?? "";
    i.setAttribute("aria-label", label);
    wrap.append(P.el("span", "", label), i);
    return { wrap, input: i };
  };
  P.select = (label, choices, value = "") => {
    const f = P.field(label);
    const s = P.el("select");
    choices.forEach((v) => {
      const o = P.el("option", "", Array.isArray(v) ? v[1] : v);
      o.value = Array.isArray(v) ? v[0] : v;
      s.append(o);
    });
    s.value = value;
    s.setAttribute("aria-label", label);
    f.input.replaceWith(s);
    f.input = s;
    return f;
  };
  P.name = (b) =>
    b?.pledgeName ||
    [b?.firstName, b?.lastName].filter(Boolean).join(" ") ||
    "Brother";
  P.person = (uid) => P.brothers.find((b) => b.uid === uid);
  P.stamp = () => firebase.firestore.FieldValue.serverTimestamp();
  P.date = (value) => (value?.toDate ? value.toDate() : new Date(value || 0));
  P.when = (value) =>
    value
      ? P.date(value).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Sending…";
  P.error = (root, error) => {
    let e = root.querySelector(".p-error");
    if (!e) {
      e = P.el("p", "p-error");
      e.setAttribute("role", "alert");
      root.prepend(e);
    }
    e.textContent =
      error?.message || "Couldn’t complete that request. Please try again.";
  };
  P.run = async (root, fn) => {
    try {
      root.querySelector(".p-error")?.remove();
      await fn();
    } catch (e) {
      P.error(root, e);
    }
  };
  P.empty = (text) => P.el("p", "p-empty", text);
  P.header = (title, subtitle) => {
    const h = P.el("header", "p-header");
    h.append(P.el("h1", "", title));
    if (subtitle) h.append(P.el("p", "p-muted", subtitle));
    return h;
  };
  P.reportContent = (path) => {
    const form = P.el("div"), reason = P.select("Reason", ["Harassment or bullying","Hate or discrimination","Sexual or graphic content","Threats or dangerous content","Spam or scam","Privacy violation","Other"], "Harassment or bullying"), details = P.field("Additional details (optional)", "textarea");
    details.input.maxLength = 2000;
    form.append(reason.wrap,details.wrap,P.el("p","p-muted","A copy of this content will be shared with administrators for review."));
    const button = P.button("Submit report", () => P.run(form, async () => {
      button.disabled = true;
      try { await P.call("reportContent", {path,reason:reason.input.value,details:details.input.value}); form.replaceChildren(P.el("h3","","Report submitted"),P.el("p","","Administrators will review it. For urgent concerns, email national@nualphaphi.com.")); }
      finally {button.disabled = false;}
    }), "p-btn primary");
    form.append(button);P.dialog("Report content",form);
  };
  P.root = (tab) => document.getElementById("p985-" + tab);
  P.go = (tab) => window.napSetTab(tab);
  P.watch = (query, fn, root) => {
    const off = query.onSnapshot(
      (s) =>
        fn(
          s.docs
            ? s.docs.map((d) => ({ ...d.data(), id: d.id }))
            : s.exists
              ? { ...s.data(), id: s.id }
              : null,
        ),
      (e) => P.error(root || P.root("home"), e),
    );
    P.listeners.push(off);
    return off;
  };
  P.call = async (name, data) => {
    const user = auth.currentUser;
    if (!user) throw Error("Sign in again to continue.");
    const r = await fetch(
      "https://us-central1-nualphaphi-6b330.cloudfunctions.net/" + name,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (await user.getIdToken()),
        },
        body: JSON.stringify({ data }),
      },
    );
    const j = await r.json();
    if (j.error) throw Error(j.error.message);
    if (!r.ok) throw Error("The server could not complete this request.");
    return j.result;
  };
  P.event = (action, eventID, payload = {}) =>
    P.call("eventAction", {
      action,
      eventID,
      requestID: crypto.randomUUID(),
      ...payload,
    });
  const urls = new Map();
  P.url = (path) => {
    if (!path) return Promise.resolve("");
    if (
      /^https:\/\//.test(path) ||
      /^data:image\/(png|jpeg|webp);base64,/.test(path)
    )
      return Promise.resolve(path);
    if (!urls.has(path))
      urls.set(
        path,
        storage
          .ref(path)
          .getDownloadURL()
          .catch((e) => {
            urls.delete(path);
            throw e;
          }),
      );
    return urls.get(path);
  };
  P.image = (path, cls = "p-photo", alt = "Photo") => {
    const img = P.el("img", cls);
    img.alt = alt;
    img.loading = "lazy";
    P.url(path)
      .then((u) => (img.src = u))
      .catch(() => {
        img.alt = "Photo unavailable";
      });
    return img;
  };
  P.avatar = (b) => {
    const a = P.el("span", "p-avatar", P.name(b).slice(0, 2).toUpperCase());
    if (b?.avatarPath || b?.photoDataUrl) {
      a.textContent = "";
      a.append(P.image(b.avatarPath || b.photoDataUrl, "", "Profile picture"));
    }
    return a;
  };
  P.author = (uid, fallback) => {
    const b = P.person(uid) || { pledgeName: fallback },
      r = P.row(
        P.button("", () => P.profile(uid), "p-avatar-button"),
        P.button(P.name(b), () => P.profile(uid), "p-name"),
      );
    r.firstChild.append(P.avatar(b));
    if (b.isAdmin) {
      const shield = P.button(
        "",
        () =>
          P.dialog(
            "Administrator",
            P.el("p", "", "This brother is an administrator of 985."),
          ),
        "p-shield",
      );
      shield.setAttribute("aria-label", "Administrator");
      shield.append(P.icon("shield"));
      r.append(shield);
    }
    return r;
  };
  P.dialog = (title, content) => {
    const d = P.el("dialog", "p985 p-dialog");
    const h = P.row(
      P.el("h2", "", title),
      P.button("Close", () => d.close()),
    );
    d.append(h, content);
    document.body.append(d);
    d.addEventListener("close", () => {
      d.cleanup?.();
      d.remove();
    });
    d.addEventListener("click", (e) => {
      if (e.target === d) d.close();
    });
    d.showModal();
    return d;
  };
  P.confirm = async (message) =>
    window.napConfirm
      ? window.napConfirm(message, { title: "Confirm", confirmLabel: "Delete" })
      : window.confirm(message);
  P.expand = (path) => {
    const box = P.el("div", "p-lightbox");
    box.append(
      P.image(path),
      P.button("Download photo", () =>
        P.run(box, async () => {
          const blob = await (await fetch(await P.url(path))).blob();
          const u = URL.createObjectURL(blob),
            a = P.el("a");
          a.href = u;
          a.download = "985-photo.jpg";
          a.click();
          setTimeout(() => URL.revokeObjectURL(u), 1000);
        }),
      ),
    );
    P.dialog("Photo", box);
  };
  P.upload = async (file, path, progress, square = false) => {
    if (!file?.type.startsWith("image/")) throw Error("Choose an image file.");
    if (file.size > 20 * 1024 * 1024)
      throw Error("Choose an image under 20 MB.");
    const bitmap = await createImageBitmap(file),
      canvas = document.createElement("canvas");
    const side = Math.min(bitmap.width, bitmap.height),
      scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    canvas.width = square ? 1200 : Math.round(bitmap.width * scale);
    canvas.height = square ? 1200 : Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (square)
      ctx.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        1200,
        1200,
      );
    else ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    await new Promise((resolve, reject) =>
      storage
        .ref(path)
        .put(blob, { contentType: "image/jpeg" })
        .on(
          "state_changed",
          (s) => {
            if (progress)
              progress.textContent =
                "Uploading " +
                Math.round((s.bytesTransferred / s.totalBytes) * 100) +
                "%";
          },
          reject,
          resolve,
        ),
    );
    return path;
  };
  P.mentions = (input) => {
    const text = typeof input === "string" ? input : input.value;
    const selections = input._mentions || {};
    return {
      mentionIds: Object.entries(selections)
        .filter(
          ([uid, label]) => !uid.startsWith("chapter:") && text.includes(label),
        )
        .map(([uid]) => uid)
        .slice(0, 30),
      mentionChapters: Object.entries(selections)
        .filter(
          ([uid, label]) => uid.startsWith("chapter:") && text.includes(label),
        )
        .map(([uid]) => uid.slice(8)),
    };
  };
  P.text = (text, data = {}) => {
    const out = P.el("div", "p-text");
    const tokens = [];
    (data.mentionIds || []).forEach((uid) => {
      const b = P.person(uid);
      if (b)
        [P.name(b), [b.firstName, b.lastName].filter(Boolean).join(" ")]
          .filter(Boolean)
          .forEach((n) => tokens.push({ name: n, uid }));
    });
    (data.mentionChapters || []).forEach((c) =>
      tokens.push({ name: c, chapter: c }),
    );
    tokens.sort((a, b) => b.name.length - a.name.length);
    let rest = String(text || "");
    while (rest) {
      let first = null;
      tokens.forEach((t) => {
        const i = rest.toLowerCase().indexOf("@" + t.name.toLowerCase());
        if (i >= 0 && (!first || i < first.i)) first = { ...t, i };
      });
      if (!first) {
        out.append(document.createTextNode(rest));
        break;
      }
      out.append(document.createTextNode(rest.slice(0, first.i)));
      out.append(
        P.button(
          rest.slice(first.i, first.i + first.name.length + 1),
          () => (first.uid ? P.profile(first.uid) : P.chapter(first.chapter)),
          first.chapter ? "p-mention p-chapter" : "p-mention",
        ),
      );
      rest = rest.slice(first.i + first.name.length + 1);
    }
    return out;
  };
  P.mentionPicker = (input) => {
    const list = P.el("div", "p-suggestions");
    input.after(list);
    input.addEventListener("input", () => {
      list.replaceChildren();
      const m = input.value
        .slice(0, input.selectionStart)
        .match(/@([^@\n]{0,35})$/);
      if (!m) return;
      const matches = P.brothers
        .filter((b) =>
          (P.name(b) + " " + b.firstName + " " + b.lastName)
            .toLowerCase()
            .includes(m[1].toLowerCase()),
        )
        .slice(0, 6)
        .map((b) => ({
          text: P.name(b),
          uid: b.uid,
          label:
            P.name(b) +
            " · " +
            [b.firstName, b.lastName].filter(Boolean).join(" ") +
            " · " +
            b.chapter,
        }));
      P.chapters
        .filter((c) => c.toLowerCase().startsWith(m[1].toLowerCase()))
        .forEach((c) =>
          matches.push({
            text: c.toLowerCase(),
            uid: "chapter:" + c,
            label: c + " Chapter",
          }),
        );
      matches.forEach((t) =>
        list.append(
          P.button(
            t.label,
            () => {
              const end = input.selectionStart;
              input._mentions = input._mentions || {};
              input._mentions[t.uid] = "@" + t.text;
              input.value =
                input.value.slice(0, end - m[0].length) +
                "@" +
                t.text +
                " " +
                input.value.slice(end);
              list.replaceChildren();
              input.dispatchEvent(new Event("input"));
              input.focus();
            },
            "p-choice",
          ),
        ),
      );
    });
  };
  P.onReady = [];
  P.ready = (fn) => (P.uid ? fn() : P.onReady.push(fn));
  napOnBrothersUpdated(() => {
    P.brothers = NAP_ALL_BROTHERS;
    document.dispatchEvent(new Event("p985:people"));
  });
  napOnAuthReady(({ uid, profile }) => {
    if (P.uid) return;
    P.uid = uid;
    P.me = profile;
    P.watch(db.doc("socialAccess/" + uid), (d) => {
      P.grant = d || {};
      P.accessReady = true;
      document.dispatchEvent(new Event("p985:access"));
    });
    P.watch(db.collection("blocks").doc(uid).collection("members"), (rows) => {
      P.blocks = new Set(rows.map((r) => r.id));
      document.dispatchEvent(new Event("p985:blocks"));
    });
    P.watch(db.doc("users/" + uid), (d) => {
      if (
        !d ||
        d.disabled ||
        (d.membershipStatus && d.membershipStatus !== "approved")
      ) {
        auth.signOut();
        return;
      }
      const changed = P.me.isAdmin !== d.isAdmin;
      P.me = d;
      NAP_CURRENT_PROFILE = d;
      document.getElementById("adminNavBtn").hidden = !d.isAdmin;
      if (changed) document.dispatchEvent(new Event("p985:access"));
    });
    P.onReady.forEach((fn) => fn());
  });
  auth.onAuthStateChanged((u) => {
    if (!u) {
      P.listeners.forEach((fn) => fn());
      P.listeners = [];
      P.posts = [];
      P.brothers = [];
      document
        .querySelectorAll('[id^="p985-"]')
        .forEach((e) => e.replaceChildren());
    }
  });
})();
