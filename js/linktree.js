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

  function safeLink(value) {
    try { return ["https:", "http:", "mailto:", "tel:"].includes(new URL(String(value)).protocol); }
    catch (_) { return false; }
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function render(doc) {
    titleEl.textContent = (doc && doc.displayName) || "Nu Alpha Phi — " + chapter + " Chapter";
    subtitleEl.textContent = (doc && doc.subtitle) || "";

    if (doc && /^#[0-9a-f]{6}$/i.test(doc.backgroundColor)) {
      document.body.style.setProperty("--chapter-color", doc.backgroundColor);
    }

    var color = document.body.style.getPropertyValue('--chapter-color') || '#7e183a';
    var rgb=[1,3,5].map(function(i){var n=parseInt(color.slice(i,i+2),16)/255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4);});
    document.body.style.setProperty('--linktree-ink',rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#17171d':'#ffffff');
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
      .filter(function (link) { return safeLink(link.url); })
      .map(function (link) {
        return (
          '<a class="linktree-link" href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(link.title) +
          "</a>"
        );
      })
      .join("");
  }

  // The editor embeds this exact public document; only its data source changes.
  if (new URLSearchParams(location.search).get('preview') === '1' && window.parent !== window) {
    window.addEventListener('message',function(event){
      if(event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'nap:chapter-preview' || event.data.chapter !== chapter) return;
      render(event.data.doc);
    });
    return;
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
