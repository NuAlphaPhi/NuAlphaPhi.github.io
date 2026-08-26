/* Chapter Links tab: a Linktree-style public page per chapter
   (nualphaphi.com/alpha, /beta, ... /kappa — see alpha.html etc. + js/
   linktree.js for the public side). Visible to admins (all 10 chapters)
   and to any brother listed as an editor on at least one chapter (just
   theirs) — everyone else never sees this tab. Only admins can create a
   chapter's page for the first time or manage who's an editor; an editor
   can otherwise edit everything on their chapter's page. */
(function () {
  "use strict";

  var chapterGridEl = document.getElementById("linktreeChapterGrid");
  if (!chapterGridEl) return;

  var CHAPTER_COLORS = {
    Alpha: "#4C78A8",
    Beta: "#F58518",
    Gamma: "#54A24B",
    Delta: "#E45756",
    Epsilon: "#79706E",
    Zeta: "#B279A2",
    Eta: "#9D755D",
    Theta: "#5B7F95",
    Iota: "#2E7D5B",
    Kappa: "#C1440E",
  };

  function colorFor(chapter) {
    return CHAPTER_COLORS[chapter] || "#8A8A8A";
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function isAdmin() {
    return !!(window.napIsAdmin && window.napIsAdmin());
  }

  var currentUid = null;
  var allChapterDocs = {}; // chapter name -> doc data (no id needed, id === chapter)
  var allBrothers = [];

  function canEditChapter(chapter) {
    if (isAdmin()) return true;
    var doc = allChapterDocs[chapter];
    return !!(doc && (doc.editorUids || []).indexOf(currentUid) !== -1);
  }

  function accessibleChapters() {
    return window.NAP_CHAPTERS.filter(canEditChapter);
  }

  var linktreeNavBtn = document.getElementById("linktreeNavBtn");

  function updateNavVisibility() {
    if (linktreeNavBtn) linktreeNavBtn.hidden = accessibleChapters().length === 0;
  }

  /* Exposed so Settings' admin-code activation/removal can refresh this
     immediately, same pattern as napStartBlogListener. Chapter Links is a
     bit different: losing admin doesn't necessarily hide the tab (you might
     still be a per-chapter editor), so this also bounces out of a chapter
     editor page you've just lost access to instead of just toggling hidden. */
  window.napRefreshLinktreeNav = function () {
    updateNavVisibility();
    if (currentChapter && !canEditChapter(currentChapter)) {
      closeChapterEditor();
      window.napSetTab("settings");
    }
  };

  window.napOnAuthReady(function (detail) {
    currentUid = detail.uid;
    startChaptersListener();
    startBrothersListener();
  });

  function startChaptersListener() {
    /* Public read (allow read: if true) — safe to start unconditionally,
       no admin gating needed the way Blog's listener requires. */
    db.collection("chapterLinktrees").onSnapshot(
      function (snap) {
        allChapterDocs = {};
        snap.forEach(function (doc) {
          allChapterDocs[doc.id] = doc.data();
        });
        updateNavVisibility();
        renderChapterGrid();
        if (currentChapter) {
          renderEditorsList();
          if (isAdmin()) syncEditorPickerVisibility();
        }
      },
      function () {
        chapterGridEl.innerHTML = '<p class="news-card__empty">Couldn’t load Chapter Links — the site’s database permissions may need to be republished.</p>';
      }
    );
  }

  function startBrothersListener() {
    db.collection("users").onSnapshot(function (snap) {
      allBrothers = snap.docs.map(function (doc) {
        return Object.assign({ uid: doc.id }, doc.data());
      });
      if (currentChapter && isAdmin()) renderEditorsList();
    });
  }

  if (linktreeNavBtn) {
    linktreeNavBtn.addEventListener("click", function () {
      updateNavVisibility();
      renderChapterGrid();
    });
  }

  /* ---------- Chapter grid ---------- */
  function renderChapterGrid() {
    var accessible = accessibleChapters();
    if (!accessible.length) {
      chapterGridEl.innerHTML = '<p class="news-card__empty">You don’t have edit access to any chapter’s page yet.</p>';
      return;
    }

    chapterGridEl.innerHTML = accessible
      .map(function (chapter) {
        var doc = allChapterDocs[chapter] || {};
        var linkCount = (doc.links || []).length;
        return (
          '<button class="linktree-admin-card" type="button" data-chapter-open="' + chapter + '">' +
          '<span class="linktree-admin-card__dot" style="background:' + colorFor(chapter) + '"></span>' +
          '<span class="linktree-admin-card__body">' +
          '<p class="linktree-admin-card__title">' + escapeHtml(chapter) + "</p>" +
          '<p class="linktree-admin-card__meta">' + linkCount + (linkCount === 1 ? " link" : " links") + " · nualphaphi.com/" + chapter.toLowerCase() + "</p>" +
          "</span></button>"
        );
      })
      .join("");
  }

  chapterGridEl.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-chapter-open]");
    if (!trigger) return;
    openChapterEditor(trigger.getAttribute("data-chapter-open"));
  });

  /* ---------- Chapter editor page ---------- */
  var pageLabelEl = document.getElementById("linktreeChapterPageLabel");
  var pageTitleEl = document.getElementById("linktreeChapterPageTitle");
  var pageUrlEl = document.getElementById("linktreeChapterPageUrl");
  var backBtn = document.getElementById("linktreeChapterBackBtn");
  var form = document.getElementById("linktreeChapterForm");
  var displayNameInput = document.getElementById("linktree-display-name");
  var subtitleInput = document.getElementById("linktree-subtitle");
  var avatarPreviewEl = document.getElementById("linktreeAvatarPreview");
  var avatarInputEl = document.getElementById("linktree-avatar-input");
  var linkRowsEl = document.getElementById("linktreeLinkRows");
  var addLinkBtn = document.getElementById("addLinktreeLinkBtn");
  var feedbackEl = document.getElementById("linktreeChapterFeedback");
  var errorEl = document.getElementById("linktree-chapter-form-error");
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  var editorsSectionEl = document.getElementById("linktreeEditorsSection");
  var editorsListEl = document.getElementById("linktreeEditorsList");
  var editorPickerEl = document.getElementById("linktreeEditorPicker");
  var editorSearchInput = document.getElementById("linktree-editor-search");
  var editorResultsEl = document.getElementById("linktreeEditorResults");

  var currentChapter = null;
  var currentLinks = [];
  var avatarState = { url: null, storagePath: null, pendingFile: null, pendingPreviewUrl: null };

  function genLinkId() {
    return "link" + Date.now() + Math.random().toString(36).slice(2);
  }

  function renderAvatarPreview() {
    var src = avatarState.pendingPreviewUrl || avatarState.url;
    avatarPreviewEl.innerHTML = src
      ? '<img class="nap-avatar nap-avatar--lg" src="' + escapeHtml(src) + '" alt="">'
      : '<div class="nap-avatar nap-avatar--fallback nap-avatar--lg" style="background:' +
        colorFor(currentChapter) +
        ';color:#fff;">' +
        escapeHtml((currentChapter || "?").charAt(0)) +
        "</div>";
  }

  function renderLinkRows() {
    if (!currentLinks.length) {
      linkRowsEl.innerHTML = '<p class="news-card__empty">No links yet — add the first one.</p>';
      return;
    }
    linkRowsEl.innerHTML = currentLinks
      .map(function (link, i) {
        return (
          '<div class="linktree-link-row" data-link-index="' + i + '">' +
          '<div class="linktree-link-row__reorder">' +
          '<button type="button" data-move-up="' + i + '" aria-label="Move up"' + (i === 0 ? " disabled" : "") + ">&uarr;</button>" +
          '<button type="button" data-move-down="' + i + '" aria-label="Move down"' + (i === currentLinks.length - 1 ? " disabled" : "") + ">&darr;</button>" +
          "</div>" +
          '<input class="form-input" data-link-title placeholder="Link Title (e.g. Instagram)" value="' + escapeHtml(link.title) + '">' +
          '<input class="form-input" data-link-url placeholder="https://…" value="' + escapeHtml(link.url) + '">' +
          '<button class="form-builder__option-remove" type="button" data-remove-link="' + i + '" aria-label="Remove link">&times;</button>' +
          "</div>"
        );
      })
      .join("");
  }

  linkRowsEl.addEventListener("input", function (e) {
    var row = e.target.closest("[data-link-index]");
    if (!row) return;
    var idx = Number(row.getAttribute("data-link-index"));
    if (!currentLinks[idx]) return;
    if (e.target.hasAttribute("data-link-title")) currentLinks[idx].title = e.target.value;
    if (e.target.hasAttribute("data-link-url")) currentLinks[idx].url = e.target.value;
  });

  linkRowsEl.addEventListener("click", function (e) {
    var upBtn = e.target.closest("[data-move-up]");
    var downBtn = e.target.closest("[data-move-down]");
    var removeBtn = e.target.closest("[data-remove-link]");

    if (upBtn) {
      var upIdx = Number(upBtn.getAttribute("data-move-up"));
      if (upIdx > 0) {
        var tmp = currentLinks[upIdx - 1];
        currentLinks[upIdx - 1] = currentLinks[upIdx];
        currentLinks[upIdx] = tmp;
        renderLinkRows();
      }
      return;
    }
    if (downBtn) {
      var downIdx = Number(downBtn.getAttribute("data-move-down"));
      if (downIdx < currentLinks.length - 1) {
        var tmp2 = currentLinks[downIdx + 1];
        currentLinks[downIdx + 1] = currentLinks[downIdx];
        currentLinks[downIdx] = tmp2;
        renderLinkRows();
      }
      return;
    }
    if (removeBtn) {
      var removeIdx = Number(removeBtn.getAttribute("data-remove-link"));
      currentLinks.splice(removeIdx, 1);
      renderLinkRows();
    }
  });

  if (addLinkBtn) {
    addLinkBtn.addEventListener("click", function () {
      currentLinks.push({ id: genLinkId(), title: "", url: "" });
      renderLinkRows();
    });
  }

  if (avatarInputEl) {
    avatarInputEl.addEventListener("change", function () {
      var file = avatarInputEl.files && avatarInputEl.files[0];
      if (!file) return;
      if (avatarState.pendingPreviewUrl) URL.revokeObjectURL(avatarState.pendingPreviewUrl);
      avatarState.pendingFile = file;
      avatarState.pendingPreviewUrl = URL.createObjectURL(file);
      renderAvatarPreview();
    });
  }

  function syncEditorPickerVisibility() {
    var docExists = !!allChapterDocs[currentChapter];
    if (editorPickerEl) editorPickerEl.hidden = !docExists;
  }

  function renderEditorsList() {
    if (!editorsListEl) return;
    var doc = allChapterDocs[currentChapter];
    if (!doc) {
      editorsListEl.innerHTML = '<p class="linktree-editors-empty">Save this page once before adding editors.</p>';
      return;
    }
    var uids = doc.editorUids || [];
    if (!uids.length) {
      editorsListEl.innerHTML = '<p class="linktree-editors-empty">No editors yet — only admins can edit this page.</p>';
      return;
    }
    editorsListEl.innerHTML = uids
      .map(function (uid) {
        var brother = allBrothers.find(function (b) {
          return b.uid === uid;
        });
        var name = brother ? window.napDisplayName(brother, "A brother") : "A brother";
        return (
          '<div class="linktree-editor-row">' +
          "<span>" + escapeHtml(name) + "</span>" +
          '<button class="linktree-editor-row__remove" type="button" data-remove-editor="' + escapeHtml(uid) + '">Remove</button>' +
          "</div>"
        );
      })
      .join("");
  }

  function addEditor(uid) {
    var chapter = currentChapter;
    var doc = allChapterDocs[chapter];
    if (!doc) return;
    var uids = (doc.editorUids || []).slice();
    if (uids.indexOf(uid) !== -1) return;
    uids.push(uid);
    db.collection("chapterLinktrees")
      .doc(chapter)
      .update({ editorUids: uids })
      .catch(function () {
        window.alert("Couldn't add that editor. Please try again.");
      });
  }

  function removeEditor(uid) {
    var chapter = currentChapter;
    var doc = allChapterDocs[chapter];
    if (!doc) return;
    var uids = (doc.editorUids || []).filter(function (x) {
      return x !== uid;
    });
    db.collection("chapterLinktrees")
      .doc(chapter)
      .update({ editorUids: uids })
      .catch(function () {
        window.alert("Couldn't remove that editor. Please try again.");
      });
  }

  if (editorsListEl) {
    editorsListEl.addEventListener("click", function (e) {
      var removeBtn = e.target.closest("[data-remove-editor]");
      if (!removeBtn) return;
      removeEditor(removeBtn.getAttribute("data-remove-editor"));
    });
  }

  function renderEditorResults(query) {
    var q = query.trim().toLowerCase();
    var doc = allChapterDocs[currentChapter] || {};
    var excludeUids = doc.editorUids || [];
    var candidates = allBrothers.filter(function (b) {
      return excludeUids.indexOf(b.uid) === -1;
    });
    var matches = !q
      ? candidates.slice(0, 8)
      : candidates
          .filter(function (b) {
            return (b.name || "").toLowerCase().indexOf(q) !== -1 || (b.pledgeName || "").toLowerCase().indexOf(q) !== -1;
          })
          .slice(0, 8);

    if (!matches.length) {
      editorResultsEl.innerHTML = '<p class="familytree-big-picker__empty">No matches.</p>';
      return;
    }
    editorResultsEl.innerHTML = matches
      .map(function (b) {
        return (
          '<button type="button" class="familytree-big-picker__option" data-editor-add="' +
          escapeHtml(b.uid) +
          '">' +
          escapeHtml(window.napDisplayName(b, "Brother")) +
          (b.chapter ? ' <span class="familytree-big-picker__chapter">(' + escapeHtml(b.chapter) + ")</span>" : "") +
          "</button>"
        );
      })
      .join("");
  }

  if (editorSearchInput) {
    editorSearchInput.addEventListener("focus", function () {
      editorSearchInput.select();
      renderEditorResults("");
      editorResultsEl.hidden = false;
    });
    editorSearchInput.addEventListener("input", function () {
      renderEditorResults(editorSearchInput.value);
      editorResultsEl.hidden = false;
    });
  }

  if (editorResultsEl) {
    editorResultsEl.addEventListener("click", function (e) {
      var opt = e.target.closest("[data-editor-add]");
      if (!opt) return;
      addEditor(opt.getAttribute("data-editor-add"));
      editorSearchInput.value = "";
      editorResultsEl.hidden = true;
    });
  }

  document.addEventListener("click", function (e) {
    if (editorResultsEl && !editorResultsEl.hidden && !e.target.closest("#linktreeEditorPicker")) {
      editorResultsEl.hidden = true;
    }
  });

  function openChapterEditor(chapter) {
    if (!canEditChapter(chapter)) return;
    currentChapter = chapter;
    var doc = allChapterDocs[chapter] || {};

    pageLabelEl.textContent = "Chapter Link Page";
    pageTitleEl.textContent = chapter;
    var url = "https://nualphaphi.com/" + chapter.toLowerCase();
    pageUrlEl.textContent = url;
    pageUrlEl.href = url;

    displayNameInput.value = doc.displayName || "Nu Alpha Phi — " + chapter + " Chapter";
    subtitleInput.value = doc.subtitle || "";

    if (avatarState.pendingPreviewUrl) URL.revokeObjectURL(avatarState.pendingPreviewUrl);
    avatarState = { url: doc.avatarUrl || null, storagePath: doc.avatarStoragePath || null, pendingFile: null, pendingPreviewUrl: null };
    renderAvatarPreview();

    currentLinks = (doc.links || []).map(function (l) {
      return { id: l.id || genLinkId(), title: l.title || "", url: l.url || "" };
    });
    renderLinkRows();

    if (editorsSectionEl) {
      editorsSectionEl.hidden = !isAdmin();
      if (isAdmin()) {
        syncEditorPickerVisibility();
        renderEditorsList();
      }
    }

    feedbackEl.hidden = true;
    errorEl.hidden = true;
    window.napSetTab("linktree-chapter", "linktree");
  }

  function closeChapterEditor() {
    currentChapter = null;
    if (avatarState.pendingPreviewUrl) URL.revokeObjectURL(avatarState.pendingPreviewUrl);
    avatarState = { url: null, storagePath: null, pendingFile: null, pendingPreviewUrl: null };
    currentLinks = [];
  }

  if (backBtn) {
    backBtn.addEventListener("click", function () {
      closeChapterEditor();
      window.napSetTab("linktree");
    });
  }

  document.querySelectorAll(".portal-shell__nav-btn").forEach(function (btn) {
    btn.addEventListener("click", closeChapterEditor);
  });

  function normalizeUrl(url) {
    if (!url) return url;
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : "https://" + url;
  }

  function uploadAvatar(file, chapter) {
    var safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    var storagePath = "linktreeAvatars/" + chapter + "/" + Date.now() + "_" + Math.random().toString(36).slice(2) + "_" + safeName;
    return new Promise(function (resolve) {
      window.napResizeImageToBlob(file, 400, 0.85, function (blob) {
        storage
          .ref(storagePath)
          .put(blob || file)
          .then(function (snapshot) {
            return snapshot.ref.getDownloadURL();
          })
          .then(function (url) {
            resolve({ url: url, storagePath: storagePath });
          })
          .catch(function () {
            resolve(null);
          });
      });
    });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var displayName = displayNameInput.value.trim();
      var subtitle = subtitleInput.value.trim();
      var cleanedLinks = currentLinks
        .map(function (l) {
          return { id: l.id, title: (l.title || "").trim(), url: normalizeUrl((l.url || "").trim()) };
        })
        .filter(function (l) {
          return l.title && l.url;
        });

      errorEl.hidden = true;
      var chapter = currentChapter;
      var oldAvatarStoragePath = avatarState.storagePath;
      var replacingAvatar = !!avatarState.pendingFile;

      window.napSaveButtonStart(submitBtn, "Saving…");
      feedbackEl.hidden = true;

      var avatarPromise = replacingAvatar
        ? uploadAvatar(avatarState.pendingFile, chapter)
        : Promise.resolve({ url: avatarState.url, storagePath: avatarState.storagePath });

      avatarPromise
        .then(function (avatarResult) {
          var payload = {
            displayName: displayName,
            subtitle: subtitle,
            links: cleanedLinks,
            avatarUrl: avatarResult ? avatarResult.url : avatarState.url,
            avatarStoragePath: avatarResult ? avatarResult.storagePath : avatarState.storagePath,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedByUid: currentUid,
          };

          var docRef = db.collection("chapterLinktrees").doc(chapter);
          var exists = !!allChapterDocs[chapter];
          var writePromise = exists
            ? docRef.set(payload, { merge: true })
            : (function () {
                payload.editorUids = [];
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                return docRef.set(payload);
              })();

          return writePromise.then(function () {
            return payload;
          });
        })
        .then(function (savedPayload) {
          if (replacingAvatar && oldAvatarStoragePath) {
            storage.ref(oldAvatarStoragePath).delete().catch(function () {});
          }
          /* Without this, a second save (e.g. tweaking a link right after
             saving a new avatar) would re-upload the same avatar file
             again — pendingFile is only ever cleared here or by reopening
             the editor, so it silently survived a successful save before. */
          if (avatarState.pendingPreviewUrl) URL.revokeObjectURL(avatarState.pendingPreviewUrl);
          avatarState.url = savedPayload.avatarUrl;
          avatarState.storagePath = savedPayload.avatarStoragePath;
          avatarState.pendingFile = null;
          avatarState.pendingPreviewUrl = null;

          window.napSaveButtonDone(submitBtn, { savedLabel: "Saved" });
          feedbackEl.className = "form-feedback form-feedback--success";
          feedbackEl.textContent = "Live at nualphaphi.com/" + chapter.toLowerCase() + ".";
          feedbackEl.hidden = false;
        })
        .catch(function () {
          window.napSaveButtonDone(submitBtn, { error: true });
          errorEl.textContent = "Something went wrong. Please try again.";
          errorEl.hidden = false;
        });
    });
  }
})();
