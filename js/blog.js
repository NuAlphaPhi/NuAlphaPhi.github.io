/* Public Blog page (blog.html): reads published posts from Firestore and
   renders the grid + detail modal. No sign-in required — this is fully
   public content, matching firestore.rules' status == "published" read
   rule. Sorts client-side instead of combining where() + orderBy() on a
   different field, which would need a Firestore composite index the user
   would otherwise have to create by hand in the console. */
(function () {
  "use strict";

  var gridEl = document.getElementById("blogGrid");
  if (!gridEl) return;

  var modal = document.getElementById("modal-blog-post");
  var modalTitleEl = document.getElementById("blog-post-modal-title");
  var modalBylineEl = document.getElementById("blogPostModalByline");
  var modalPhotosEl = document.getElementById("blogPostModalPhotos");
  var modalBodyEl = document.getElementById("blogPostModalBody");

  var allPosts = [];

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return "";
    return timestamp.toDate().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }

  function bylineFor(post) {
    var names = [post.author].concat(post.coAuthors || []).filter(Boolean);
    return names.length ? "By " + names.join(", ") : "";
  }

  function findPost(id) {
    return allPosts.find(function (p) {
      return p.id === id;
    });
  }

  function postCardHtml(post) {
    var cover = (post.photoThumbUrls && post.photoThumbUrls[0]) || (post.photoUrls && post.photoUrls[0]);
    return (
      '<button class="blog-card" type="button" data-post-open="' + post.id + '">' +
      (cover ? '<div class="blog-card__cover"><img src="' + escapeHtml(cover) + '" alt="" loading="lazy" decoding="async"></div>' : "") +
      '<div class="blog-card__body">' +
      '<p class="blog-card__date">' + escapeHtml(formatDate(post.publishedAt)) + "</p>" +
      '<h3 class="blog-card__title">' + escapeHtml(post.title || "Untitled") + "</h3>" +
      '<p class="blog-card__byline">' + escapeHtml(bylineFor(post)) + "</p>" +
      '<p class="blog-card__excerpt">' + escapeHtml(post.body || "") + "</p>" +
      "</div></button>"
    );
  }

  function renderGrid() {
    if (!allPosts.length) {
      gridEl.innerHTML = '<p class="blog-grid__empty">No posts yet — check back soon.</p>';
      return;
    }
    gridEl.innerHTML = allPosts.map(postCardHtml).join("");
  }

  function updatePostQueryParam(id) {
    if (!window.history || !history.replaceState) return;
    var url = new URL(location.href);
    if (id) {
      url.searchParams.set("post", id);
    } else {
      url.searchParams.delete("post");
    }
    history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
  }

  function openPost(post) {
    modalTitleEl.textContent = post.title || "Untitled";
    modalBylineEl.textContent = [bylineFor(post), formatDate(post.publishedAt)].filter(Boolean).join(" · ");
    modalBodyEl.textContent = post.body || "";

    var photos = post.photoUrls || [];
    modalPhotosEl.innerHTML = photos
      .map(function (url, i) {
        var thumb = (post.photoThumbUrls && post.photoThumbUrls[i]) || url;
        return '<img src="' + escapeHtml(thumb) + '" data-full="' + escapeHtml(url) + '" alt="" loading="lazy">';
      })
      .join("");

    modal.showModal();
    updatePostQueryParam(post.id);
  }

  gridEl.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-post-open]");
    if (!trigger) return;
    var post = findPost(trigger.getAttribute("data-post-open"));
    if (post) openPost(post);
  });

  if (modalPhotosEl) {
    modalPhotosEl.addEventListener("click", function (e) {
      var img = e.target.closest("img[data-full]");
      if (!img) return;
      window.open(img.getAttribute("data-full"), "_blank", "noopener");
    });
  }

  if (modal) {
    modal.addEventListener("close", function () {
      updatePostQueryParam(null);
    });
  }

  db.collection("blogPosts")
    .where("status", "==", "published")
    .onSnapshot(
      function (snap) {
        allPosts = snap.docs
          .map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
          })
          .sort(function (a, b) {
            var aTime = a.publishedAt && a.publishedAt.toMillis ? a.publishedAt.toMillis() : 0;
            var bTime = b.publishedAt && b.publishedAt.toMillis ? b.publishedAt.toMillis() : 0;
            return bTime - aTime;
          });
        renderGrid();

        /* A shared ?post=ID link opens straight to that post. */
        var wantedId = new URLSearchParams(location.search).get("post");
        if (wantedId) {
          var wanted = findPost(wantedId);
          if (wanted) openPost(wanted);
        }
      },
      function () {
        gridEl.innerHTML = '<p class="blog-grid__empty">Couldn’t load posts right now — please try again later.</p>';
      }
    );
})();
