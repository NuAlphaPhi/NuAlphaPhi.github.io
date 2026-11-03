(function () {
  "use strict";
  const P = P985;
  let current;
  let profileTab = "posts";
  const slogans = [
    "ALMIGHTY ALPHAS",
    "BROLIC BETAS",
    "GRIMACING GAMMAS",
    "DIESEL DELTAS",
    "ELECTRIFYING EPSILONS",
    "ZEALOUS ZETAS",
    "ETERNAL ETAS",
    "THUNDEROUS THETAS",
    "INVINCIBLE IOTAS",
    "KARNAGE KAPPAS",
  ];
  const schools = [
      "SUNY Albany",
      "CITY",
      "SUNY Stony Brook",
      "SUNY Buffalo",
      "New York University",
      "SUNY Binghamton",
      "Syracuse University",
      "Stevens Institute of Technology",
      "Rutgers University",
      "Boston University",
    ],
    founded = [
      "March 18, 1994",
      "1996",
      "1997",
      "1998",
      "2000",
      "2002",
      "2007",
      "2008",
      "2011",
      "June 6, 2026",
    ];
  P.chapter = (c) => {
    const i = P.chapters.indexOf(c),
      box = P.el("div");
    box.append(
      P.el("div", "p-banner", slogans[i] || c),
      P.el("p", "", schools[i] || ""),
      P.el("p", "", "Founded " + (founded[i] || "")),
      P.el(
        "p",
        "",
        P.brothers.filter(
          (b) => b.chapter === c && b.membershipStanding === "active",
        ).length + " active brothers on the portal",
      ),
    );
    P.dialog(c + " Chapter", box);
    P.run(box, async () => {
      const classes = await db
        .collection("masterRosterClasses")
        .where("chapter", "==", c)
        .get();
      const cls = classes.docs.find(
        (d) => (d.data().pledgeClass || "").toLowerCase() === "alpha",
      );
      if (cls) {
        const rows = await db
          .collection("masterRoster")
          .where("classID", "==", cls.id)
          .get();
        box.append(P.el("h3", "", "Founding class"));
        rows.docs.forEach((d) => {
          const r = d.data();
          box.append(P.el("p", "", r.fullName + " · " + r.pledgeName));
        });
      }
    });
  };
  function age(value) {
    if (!value) return "";
    const d = new Date(value + "T12:00:00"),
      now = new Date();
    if (!Number.isFinite(d.getTime())) return "";
    return (
      now.getFullYear() -
      d.getFullYear() -
      (now.getMonth() < d.getMonth() ||
      (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
        ? 1
        : 0)
    );
  }
  function titles(b) {
    const a = [];
    if (b.uid === "vfC9YS7AqvY3Hyr0pfGYg38GVzs1") a.push("App Developer");
    if ((b.pledgeClass || "").toLowerCase() === "alpha")
      a.push(b.chapter === "Alpha" ? "Founding Father" : "Founder");
    const leadership = Array.isArray(b.leadershipTitles)
      ? b.leadershipTitles
      : [];
    a.push(...leadership.filter((x) => x !== "Admin" && x !== "App Developer"));
    const latest = {
      Alpha: "alpha nu",
      Beta: "beta iota",
      Gamma: "alpha upsilon",
      Delta: "alpha phi",
      Epsilon: "alpha omicron",
      Zeta: "alpha sigma",
      Eta: "alpha beta",
      Theta: "chi",
      Iota: "alpha beta",
      Kappa: "alpha",
    };
    const alphabet =
      "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega".split(
        " ",
      );
    const rank = (v) =>
      String(v || "")
        .toLowerCase()
        .replace(/ class$/, "")
        .split(" ")
        .reduce((n, w) => n * 24 + alphabet.indexOf(w) + 1, 0);
    const diff = rank(latest[b.chapter]) - rank(b.pledgeClass);
    if (diff === 0) a.push("NEO");
    else if (diff === 1) a.push("GEO");
    a.push(b.membershipStanding === "active" ? "Active" : "Alumni");
    const priority = (t) => t === "App Developer" ? 0 : t === "Founding Father" ? 1 : t === "Founder" ? 2 : /National/.test(t) ? (/Intern/.test(t) ? 4 : 3) : t === "NEO" ? 7 : t === "GEO" ? 8 : /^(Active|Alumni)$/.test(t) ? 9 : 5;
    return [...new Set(a)].sort((a, b) => priority(a) - priority(b));
  }
  P.profile = (uid) => {
    document
      .querySelectorAll("dialog.p-dialog[open]")
      .forEach((d) => d.close());
    current = uid;
    profileTab = "posts";
    P.go(uid === P.uid ? "myprofile" : "profile");
    render();
  };
  window.napOpenProfileModal = (uid) => P.profile(uid);
  function render() {
    if (!current) return;
    const b =
        P.person(current) ||
        (current === P.uid ? { uid: P.uid, ...P.me } : null),
      root = P.root(current === P.uid ? "myprofile" : "profile");
    root.replaceChildren();
    if (!b) {
      root.append(P.empty("This profile is unavailable."));
      return;
    }
    root.classList.add("p-feed", "p-profile-page");
    const top = P.el("header", "p-profile-heading");
    const back = P.button("←", () => P.go("directory"), "p-profile-back");
    back.setAttribute("aria-label", "Back to directory");
    const heading = P.el("div");
    heading.append(P.el("h1", "", P.name(b)), P.el("small", "", (b.chapter || "Nu Alpha Phi") + " Chapter"));
    top.append(back, heading);
    const cover = P.el("div", "p-profile-cover");
    cover.append(P.el("span", "p-profile-cover-label", "NU ALPHA PHI · " + (b.chapter || "Brotherhood").toUpperCase()), P.el("strong", "", slogans[P.chapters.indexOf(b.chapter)] || "THE BROTHERHOOD"));
    const intro = P.el("section", "p-profile-intro");
    const actions = P.el("div", "p-profile-actions");
    const avatar = P.button("", () => {
      if (b.avatarPath || b.photoDataUrl) P.expand(b.avatarPath || b.photoDataUrl);
    }, "p-avatar-button p-profile-avatar");
    avatar.setAttribute("aria-label", "View profile photo");
    avatar.append(P.avatar(b));
    actions.append(avatar);
    const controls = P.el("div", "p-row");
    actions.append(controls);
    const realName = [b.firstName, b.middleName, b.lastName].filter(Boolean).join(" ") || b.fullName || P.name(b);
    const identity = P.row(P.el("h2", "p-profile-realname", realName));
    const handle = P.row(P.el("span", "p-profile-handle", "@" + (b.pledgeName || P.name(b))));
    if (b.isAdmin) {
      const shield = P.button("", () => P.dialog("Administrator", P.el("p", "", "This brother is an administrator of 985.")), "p-profile-shield");
      shield.append(P.icon("shield"));
      shield.setAttribute("aria-label", "Administrator information");
      handle.append(shield);
    }
    intro.append(actions, identity, handle);
    root.append(top, cover, intro);
    const chips = P.el("div", "p-profile-titles");
    titles(b).forEach((t) =>
      chips.append(
        P.button(
          t,
          () =>
            P.dialog(
              t,
              P.el(
                "p",
                "",
                t === "App Developer"
                  ? "Only the great VIRO holds this title. He designed and built 985 for the brotherhood."
                  : t === "Founder"
                    ? "A member of the chapter’s founding Alpha class."
                    : t === "Founding Father"
                      ? "A founding member of Nu Alpha Phi: Alpha Chapter, Alpha Class."
                      : t === "NEO"
                        ? "A member of the most recent class to cross in this chapter."
                        : t === "GEO"
                          ? "A member of the second-most-recent class to cross in this chapter."
                          : t === "Active"
                            ? "Designated active by chapter leadership."
                            : t === "Alumni"
                              ? "A brother who is not currently on the active roster."
                              : "Appointed through the organization’s leadership roster.",
              ),
            ),
          "p-profile-title " + (/Founder|Founding Father|Developer/.test(t) ? "p-title-distinguished" : /National/.test(t) ? "p-title-leadership" : ""),
        ),
      ),
    );
    intro.append(chips);
    if (b.bio) intro.append(P.text(b.bio));
    const summary = P.el("div", "p-profile-summary");
    if (b.chapter) summary.append(P.button(b.chapter + " Chapter", () => P.chapter(b.chapter), "p-profile-chapter"));
    if (b.school) summary.append(P.el("span", "", b.school));
    const crossed = [b.crossingTerm || b.semesterCrossed, b.crossingYear || b.yearCrossed].filter(Boolean).join(" ");
    if (crossed) summary.append(P.el("span", "", "Crossed " + crossed));
    intro.append(summary);
    const dl = P.el("dl", "p-info");
    const fields = [
      ["Chapter", b.chapter],
      ["Class", b.pledgeClass],
      ["Pledge number", b.pledgeNumber],
      [
        "Crossed",
        [b.crossingTerm || b.semesterCrossed, b.crossingYear || b.yearCrossed]
          .filter(Boolean)
          .join(" "),
      ],
      ["Birthday", b.birthday],
      ["Age", age(b.birthday)],
      ["Phone", b.phone],
      ["Big", b.big || b.bigPledgeName || b.bigName],
      [
        "Littles",
        Array.isArray(b.littles)
          ? b.littles.join(", ")
          : b.littles || b.littlePledgeNames,
      ],
      ["School", b.school],
      ["Major", b.major],
      ["Education", b.educationStatus],
      ["Graduation", b.graduationYear],
      ["Job", b.job || b.occupation],
      ["Hometown", b.hometown],
    ];
    fields.forEach(([label, value]) => {
      if (value) {
        const v = P.el("div");
        v.append(P.el("dt", "", label), P.el("dd", "", String(value)));
        dl.append(v);
      }
    });
    const links = P.el("div", "p-profile-socials");
    for (const [key, host, prefix] of [
      ["instagram", "instagram.com", ""],
      ["facebook", "facebook.com", ""],
      ["linkedin", "linkedin.com", "in/"],
      ["twitter", "x.com", ""],
    ]) {
      const raw =
        b[key + "ProfileURL"] || b[key] || b[key === "twitter" ? "x" : ""];
      if (!raw) continue;
      try {
        const u = new URL(
          raw.startsWith("http")
            ? raw
            : "https://" + host + "/" + prefix + raw.replace(/^@/, ""),
        );
        if (
          u.protocol !== "https:" ||
          ![
            host,
            "www." + host, "m." + host, "mobile." + host,
            ...(key === "twitter" ? ["twitter.com", "www.twitter.com", "m.twitter.com", "mobile.twitter.com"] : []),
          ].includes(u.hostname)
        )
          continue;
        const labels = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", twitter: "X / Twitter" };
        const a = P.el("a", "p-profile-social");
        const mark = P.el("span", "p-social-mark", {instagram: "◎", facebook: "f", linkedin: "in", twitter: "𝕏"}[key]);
        mark.setAttribute("aria-hidden", "true");
        a.append(mark, P.el("span", "", labels[key]));
        a.setAttribute("aria-label", "Open " + labels[key] + " profile (new tab)");
        a.href = u.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        links.append(a);
      } catch {}
    }
    if (links.childElementCount) intro.append(links);
    if (b.uid === P.uid || P.me.isAdmin)
      controls.append(P.button("Edit profile", () => edit(b)));
    if (b.uid !== P.uid)
      controls.append(
        P.row(
          P.button("Message", () => P.newConversation([b.uid])),
          P.button(P.blocks.has(b.uid) ? "Unblock" : "Block", () =>
            P.run(root, async () => {
              const ref = db.doc("blocks/" + P.uid + "/members/" + b.uid);
              if (P.blocks.has(b.uid)) await ref.delete();
              else if (
                await window.napConfirm(
                  "Hide this brother’s posts and direct messages? Group messages remain visible, without notifications.",
                  { title: "Block brother", confirmLabel: "Block" },
                )
              )
                await ref.set({ createdAt: P.stamp() });
              render();
            }),
          ),
        ),
      );
    const tabs = P.el("div", "p-profile-tabs");
    tabs.setAttribute("role", "tablist");
    ["posts", "about"].forEach((tab) => {
      const button = P.button(tab === "posts" ? "Posts" : "About", () => { profileTab = tab; render(); }, "p-profile-tab" + (profileTab === tab ? " is-selected" : ""));
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(profileTab === tab));
      tabs.append(button);
    });
    root.append(tabs);
    if (profileTab === "about") root.append(dl);
    else {
      const posts = P.posts.filter((p) => p.authorUid === b.uid && !P.blocks.has(b.uid));
      root.append(...posts.map((p) => P.postCard(p)));
      if (!posts.length) root.append(P.empty("No recent posts."));
    }
  }

  function edit(b) {
    const form = P.el("form"),
      fields = {};
    const keys = [
      "bio",
      "birthday",
      "school",
      "major",
      "educationStatus",
      "graduationYear",
      "job",
      "instagram",
      "facebook",
      "linkedin",
      "twitter",
    ];
    if (P.me.isAdmin)
      keys.unshift(
        "firstName",
        "middleName",
        "lastName",
        "pledgeName",
        "pledgeNumber",
        "chapter",
        "pledgeClass",
        "semesterCrossed",
        "yearCrossed",
      );
    keys.forEach((k) => {
      const f =
        k === "chapter"
          ? P.select("Chapter", P.chapters, b[k])
          : k === "semesterCrossed"
            ? P.select("Crossing term", ["Fall", "Spring", "Summer"], b[k])
            : P.field(
                k.replace(/([A-Z])/g, " $1"),
                k === "birthday" ? "date" : k === "bio" ? "textarea" : "text",
                b[k + "ProfileURL"] || b[k],
              );
      fields[k] = f.input;
      form.append(f.wrap);
    });
    const photo = P.field("Profile photo", "file"),
      status = P.el("p");
    photo.input.accept = "image/*";
    photo.wrap.hidden = b.uid !== P.uid;
    form.append(photo.wrap, status);
    const save = P.button(
      "Save profile",
      () =>
        P.run(form, async () => {
          save.disabled = true;
          try {
            const data = Object.fromEntries(
              Object.entries(fields).map(([k, v]) => [k, v.value.trim()]),
            );
            if (data.pledgeNumber && !/^\d{1,2}$/.test(data.pledgeNumber))
              throw Error("Pledge number must have one or two digits.");
            for (const [key, hosts] of [
              ["instagram", ["instagram.com"]],
              ["facebook", ["facebook.com"]],
              ["linkedin", ["linkedin.com"]],
              ["twitter", ["x.com", "twitter.com"]],
            ]) {
              if (!data[key]) continue;
              if (data[key].includes("://")) {
                const u = new URL(data[key]);
                if (
                  u.protocol !== "https:" ||
                  !hosts.includes(u.hostname.replace(/^www\./, ""))
                )
                  throw Error("Use a valid " + key + " profile link.");
              } else if (!/^[\w.@-]+$/.test(data[key]))
                throw Error("Enter a username or a full " + key + " link.");
            }
            for (const key of [
              "instagram",
              "facebook",
              "linkedin",
              "twitter",
            ]) {
              const raw = data[key];
              data[key + "ProfileURL"] = raw
                ? raw.startsWith("http")
                  ? raw
                  : "https://" +
                    (key === "twitter" ? "x.com" : key + ".com") +
                    "/" +
                    (key === "linkedin" ? "in/" : "") +
                    raw.replace(/^@/, "")
                : "";
              delete data[key];
            }
            if (photo.input.files[0])
              data.avatarPath = await P.upload(
                photo.input.files[0],
                "profilePhotos/" + b.uid + "/" + crypto.randomUUID() + ".jpg",
                status,
              );
            await db.doc("users/" + b.uid).update(data);
            dialog.close();
          } finally {
            save.disabled = false;
          }
        }),
      "p-btn primary",
    );
    form.append(save);
    const dialog = P.dialog("Edit profile", form);
  }
  document.addEventListener("nap:tab-changed", (e) => {
    if (e.detail.tab === "myprofile") {
      current = P.uid;
      render();
    }
  });
  document.addEventListener("p985:people", render);
  document.addEventListener("p985:posts", render);
  P.ready(() => {
    if (location.hash === "#myprofile") {
      current = P.uid;
      render();
    }
  });
})();
