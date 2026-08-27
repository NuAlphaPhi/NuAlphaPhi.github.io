/* Public Chapter Link page (alpha.html, beta.html, ... kappa.html): reads
   nualphaphi.com/{chapter}'s Linktree-style page from Firestore. No
   sign-in required — window.NAP_LINKTREE_CHAPTER (set inline by each of
   the 10 HTML files) says which chapter this is. */
(function () {
  "use strict";

  var chapter = window.NAP_LINKTREE_CHAPTER;
  var avatarEl = document.getElementById("linktreeAvatar");
  var titleEl = document.getElementById("linktreeTitle");
  var subtitleEl = document.getElementById("linktreeSubtitle");
  var linksEl = document.getElementById("linktreeLinks");
  if (!chapter || !linksEl) return;

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function render(doc) {
    titleEl.textContent = (doc && doc.displayName) || "Nu Alpha Phi — " + chapter + " Chapter";
    subtitleEl.textContent = (doc && doc.subtitle) || "";

    if (doc && doc.backgroundColor) {
      document.body.style.setProperty("--chapter-color", doc.backgroundColor);
    }

    if (doc && doc.avatarUrl) {
      avatarEl.innerHTML = '<img src="' + escapeHtml(doc.avatarUrl) + '" alt="">';
    } else {
      avatarEl.textContent = chapter.charAt(0);
    }

    var links = (doc && doc.links) || [];
    if (!links.length) {
      linksEl.innerHTML = '<p class="linktree-empty">Links coming soon.</p>';
      return;
    }

    linksEl.innerHTML = links
      .map(function (link) {
        return (
          '<a class="linktree-link" href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(link.title) +
          "</a>"
        );
      })
      .join("");
  }

  db.collection("chapterLinktrees")
    .doc(chapter)
    .onSnapshot(
      function (snap) {
        render(snap.exists ? snap.data() : null);
      },
      function () {
        linksEl.innerHTML = '<p class="linktree-empty">Couldn’t load this page right now.</p>';
      }
    );
})();
