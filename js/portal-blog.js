/* Blog tab (portal, admin-only): create/edit/publish/hide/delete posts.
   Published posts show up on the public Blog section of the main website
   (see js/blog.js) — firestore.rules makes a post readable by anyone once
   status == "published"; drafts and hidden posts are admin-only reads. */
(function () {
  "use strict";

  var gridEl = document.getElementById("blogPostGrid");
  if (!gridEl) return;

  var newPostBtn = document.getElementById("newBlogPostBtn");

  var currentUid = null;
  var allPosts = [];
  var started = false;

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function isAdmin() {
    return !!(window.napIsAdmin && window.napIsAdmin());
  }

  function findPost(id) {
    return allPosts.find(function (p) {
      return p.id === id;
    });
  }

  function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return "";
    return timestamp.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function bylineFor(post) {
    var names = [post.author].concat(post.coAuthors || []).filter(Boolean);
    return names.length ? "By " + names.join(", ") : "";
  }

  /* Exposed the same way portal-admin.js's admin listeners are, so the
     Settings tab's admin-code activation can start this immediately without
     needing a page refresh, matching that established pattern. */
  window.napStartBlogListener = function () {
    if (started || !isAdmin()) return;
    started = true;

    db.collection("blogPosts")
      .orderBy("createdAt", "desc")
      .onSnapshot(
        function (snap) {
          allPosts = snap.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
          });
          renderPostGrid();
        },
        function () {
          gridEl.innerHTML = '<p class="news-card__empty">Couldn’t load the Blog — the site’s database permissions may need to be republished.</p>';
        }
      );
  };

  window.napOnAuthReady(function (detail) {
    currentUid = detail.uid;
    window.napStartBlogListener();
  });

  /* Re-check admin status every time the tab is actually opened — same
     class of stale-button fix used elsewhere in this app (Family Tree's
     "New Lineage", Gallery's manage buttons): render() only re-runs on
     Firestore changes, so without this, granting/revoking admin elsewhere
     wouldn't refresh this tab's controls until the next snapshot. */
  var blogNavBtn = document.getElementById("blogNavBtn");
  if (blogNavBtn) {
    blogNavBtn.addEventListener("click", function () {
      window.napStartBlogListener();
      renderPostGrid();
    });
  }

  var STATUS_LABELS = { draft: "Draft", published: "Published", hidden: "Hidden" };

  var IMAGE_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' +
    '<circle cx="8.5" cy="8.5" r="1.5"></circle>' +
    '<path d="M21 15l-5-5L5 21"></path>' +
    "</svg>";

  function postCardHtml(post) {
    var cover =
      post.photoUrls && post.photoUrls[0]
        ? '<div class="blog-admin-card__cover"><img src="' +
          escapeHtml((post.photoThumbUrls && post.photoThumbUrls[0]) || post.photoUrls[0]) +
          '" alt="" loading="lazy" decoding="async"></div>'
        : '<div class="blog-admin-card__cover blog-admin-card__cover--empty">' + IMAGE_ICON_SVG + "</div>";

    var status = post.status || "draft";
    var when = status === "published" ? formatDate(post.publishedAt) : formatDate(post.createdAt);

    var actions = ['<button class="news-card__action-btn" type="button" data-post-edit="' + post.id + '">Edit</button>'];
    if (status === "published") {
      actions.push('<button class="news-card__action-btn" type="button" data-post-hide="' + post.id + '">Hide</button>');
    } else {
      actions.push('<button class="news-card__action-btn" type="button" data-post-publish="' + post.id + '">Publish</button>');
    }
    actions.push('<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-post-delete="' + post.id + '">Delete</button>');

    return (
      '<article class="blog-admin-card">' +
      cover +
      '<div class="blog-admin-card__body">' +
      '<span class="blog-admin-card__status blog-admin-card__status--' + status + '">' + STATUS_LABELS[status] + "</span>" +
      '<h3 class="blog-admin-card__title">' + escapeHtml(post.title || "Untitled") + "</h3>" +
      '<p class="blog-admin-card__meta">' + escapeHtml(bylineFor(post)) + (when ? " · " + when : "") + "</p>" +
      '<div class="blog-admin-card__actions">' + actions.join("") + "</div>" +
      "</div></article>"
    );
  }

  function renderPostGrid() {
    if (!gridEl) return;
    if (!allPosts.length) {
      gridEl.innerHTML = '<p class="news-card__empty">No posts yet — write the first one.</p>';
      return;
    }
    gridEl.innerHTML = allPosts.map(postCardHtml).join("");
  }

  function setPostStatus(postId, status) {
    if (status === "published") {
      var post = findPost(postId);
      if (post && (!post.author || !post.body)) {
        window.alert("This post needs an author and content before it can be published — open Edit to add them.");
        return;
      }
    }
    var update = { status: status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (status === "published") update.publishedAt = firebase.firestore.FieldValue.serverTimestamp();
    db.collection("blogPosts")
      .doc(postId)
      .update(update)
      .catch(function () {
        window.alert("Couldn't update this post. Please try again.");
      });
  }

  function deletePostCascade(postId) {
    var post = findPost(postId);
    var storageDeletes = [];
    if (post) {
      (post.photoStoragePaths || []).forEach(function (path) {
        if (path) storageDeletes.push(storage.ref(path).delete().catch(function () {}));
      });
      (post.photoThumbStoragePaths || []).forEach(function (path) {
        if (path) storageDeletes.push(storage.ref(path).delete().catch(function () {}));
      });
    }
    Promise.all(storageDeletes)
      .then(function () {
        return db.collection("blogPosts").doc(postId).delete();
      })
      .catch(function () {
        window.alert("Couldn't delete this post. Please try again.");
      });
  }

  gridEl.addEventListener("click", function (e) {
    var editBtn = e.target.closest("[data-post-edit]");
    var publishBtn = e.target.closest("[data-post-publish]");
    var hideBtn = e.target.closest("[data-post-hide]");
    var deleteBtn = e.target.closest("[data-post-delete]");

    if (editBtn) {
      var post = findPost(editBtn.getAttribute("data-post-edit"));
      if (post) openPostEditor(post);
      return;
    }
    if (publishBtn) {
      setPostStatus(publishBtn.getAttribute("data-post-publish"), "published");
      return;
    }
    if (hideBtn) {
      setPostStatus(hideBtn.getAttribute("data-post-hide"), "hidden");
      return;
    }
    if (deleteBtn) {
      var postId = deleteBtn.getAttribute("data-post-delete");
      var toDelete = findPost(postId);
      var title = (toDelete && toDelete.title) || "this post";
      window.napConfirm("This can't be undone.", { title: 'Delete "' + title + '"?', confirmLabel: "Delete" }).then(function (confirmed) {
        if (confirmed) deletePostCascade(postId);
      });
    }
  });

  if (newPostBtn) {
    newPostBtn.addEventListener("click", function () {
      openPostEditor(null);
    });
  }

  /* ---------- Editor modal ---------- */
  var postModal = document.getElementById("modal-blog-post-form");
  var postModalTitleEl = document.getElementById("modal-blog-post-form-title");
  var titleInput = document.getElementById("blog-post-title");
  var authorInput = document.getElementById("blog-post-author");
  var bodyInput = document.getElementById("blog-post-body");
  var coAuthorRowsEl = document.getElementById("blogCoAuthorRows");
  var addCoAuthorBtn = document.getElementById("addBlogCoAuthorBtn");
  var photoSlotsEl = document.getElementById("blogPhotoSlots");
  var photoInputEl = document.getElementById("blogPhotoInput");
  var addPhotosBtn = document.getElementById("blogAddPhotosBtn");
  var feedbackEl = document.getElementById("blogPostFeedback");
  var errorEl = document.getElementById("blog-post-form-error");
  var saveDraftBtn = document.getElementById("blogSaveDraftBtn");
  var publishSubmitBtn = document.getElementById("blogPublishBtn");

  var currentEditId = null;
  var coAuthorRows = [];
  var photoSlots = []; // { key, kind: 'existing'|'new', url, thumbUrl, storagePath, thumbStoragePath, file, previewUrl }
  var removedExistingPhotos = [];
  var MAX_PHOTOS = 4;

  function renderCoAuthorRows() {
    coAuthorRowsEl.innerHTML = coAuthorRows
      .map(function (name, i) {
        return (
          '<div class="form-builder__option-row" data-coauthor-index="' + i + '">' +
          '<input class="form-input" data-coauthor-name placeholder="Co-Author Name" value="' + escapeHtml(name) + '">' +
          '<button class="form-builder__option-remove" type="button" data-remove-coauthor aria-label="Remove co-author">&times;</button>' +
          "</div>"
        );
      })
      .join("");
  }

  coAuthorRowsEl.addEventListener("input", function (e) {
    var row = e.target.closest("[data-coauthor-index]");
    if (!row) return;
    var idx = Number(row.getAttribute("data-coauthor-index"));
    if (e.target.hasAttribute("data-coauthor-name")) coAuthorRows[idx] = e.target.value;
  });

  coAuthorRowsEl.addEventListener("click", function (e) {
    var removeBtn = e.target.closest("[data-remove-coauthor]");
    if (!removeBtn) return;
    var row = removeBtn.closest("[data-coauthor-index]");
    var idx = Number(row.getAttribute("data-coauthor-index"));
    coAuthorRows.splice(idx, 1);
    renderCoAuthorRows();
  });

  addCoAuthorBtn.addEventListener("click", function () {
    coAuthorRows.push("");
    renderCoAuthorRows();
  });

  function renderPhotoSlots() {
    photoSlotsEl.innerHTML = photoSlots
      .map(function (slot) {
        var src = slot.kind === "new" ? slot.previewUrl : slot.thumbUrl || slot.url;
        return (
          '<div class="blog-photo-slot">' +
          '<img src="' + escapeHtml(src) + '" alt="">' +
          '<button class="blog-photo-slot__remove" type="button" data-photo-remove="' + slot.key + '" aria-label="Remove photo">&times;</button>' +
          "</div>"
        );
      })
      .join("");
    if (addPhotosBtn) addPhotosBtn.hidden = photoSlots.length >= MAX_PHOTOS;
  }

  photoSlotsEl.addEventListener("click", function (e) {
    var removeBtn = e.target.closest("[data-photo-remove]");
    if (!removeBtn) return;
    var key = removeBtn.getAttribute("data-photo-remove");
    var slot = photoSlots.find(function (s) {
      return s.key === key;
    });
    if (slot && slot.kind === "existing") removedExistingPhotos.push(slot);
    if (slot && slot.kind === "new" && slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
    photoSlots = photoSlots.filter(function (s) {
      return s.key !== key;
    });
    renderPhotoSlots();
  });

  if (addPhotosBtn) {
    addPhotosBtn.addEventListener("click", function () {
      photoInputEl.click();
    });
  }

  if (photoInputEl) {
    photoInputEl.addEventListener("change", function () {
      var files = Array.prototype.slice.call(photoInputEl.files || []);
      photoInputEl.value = "";
      var room = MAX_PHOTOS - photoSlots.length;
      files.slice(0, room).forEach(function (file) {
        if (file.type.indexOf("image/") !== 0) return;
        photoSlots.push({
          key: "new" + Date.now() + Math.random().toString(36).slice(2),
          kind: "new",
          file: file,
          previewUrl: URL.createObjectURL(file),
        });
      });
      if (files.length > room) window.alert("Only up to " + MAX_PHOTOS + " photos per post — the rest were skipped.");
      renderPhotoSlots();
    });
  }

  function openPostEditor(post) {
    currentEditId = post ? post.id : null;
    postModalTitleEl.textContent = post ? "Edit Post" : "New Post";
    titleInput.value = post ? post.title || "" : "";
    authorInput.value = post ? post.author || "" : "";
    bodyInput.value = post ? post.body || "" : "";

    coAuthorRows = post && post.coAuthors && post.coAuthors.length ? post.coAuthors.slice() : [];
    renderCoAuthorRows();

    removedExistingPhotos = [];
    photoSlots =
      post && post.photoUrls
        ? post.photoUrls.map(function (url, i) {
            return {
              key: "existing" + i,
              kind: "existing",
              url: url,
              thumbUrl: post.photoThumbUrls && post.photoThumbUrls[i],
              storagePath: post.photoStoragePaths && post.photoStoragePaths[i],
              thumbStoragePath: post.photoThumbStoragePaths && post.photoThumbStoragePaths[i],
            };
          })
        : [];
    renderPhotoSlots();

    errorEl.hidden = true;
    feedbackEl.hidden = true;
    postModal.showModal();
  }

  function setSaving(isSaving) {
    saveDraftBtn.disabled = isSaving;
    publishSubmitBtn.disabled = isSaving;
  }

  function uploadBlogPhoto(file, postId) {
    var safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    var base = Date.now() + "_" + Math.random().toString(36).slice(2) + "_" + safeName;
    var storagePath = "blogPhotos/" + postId + "/" + base;
    var thumbStoragePath = "blogPhotos/" + postId + "/" + base + "_thumb.jpg";

    function uploadBlobOrFile(blob, path, fallbackFile) {
      var toUpload = blob || fallbackFile;
      if (!toUpload) return Promise.resolve(null);
      return storage
        .ref(path)
        .put(toUpload)
        .then(function (snapshot) {
          return snapshot.ref.getDownloadURL();
        })
        .catch(function () {
          return null;
        });
    }

    /* The full-size upload is still resized (not the raw camera file) — a
       website doesn't need literal full-resolution photos, and skipping
       this was exactly what made the Gallery/pledge-media grids laggy
       before that got fixed; no reason to reintroduce it here. */
    var mainPromise = new Promise(function (resolve) {
      window.napResizeImageToBlob(file, 1600, 0.85, function (blob) {
        uploadBlobOrFile(blob, storagePath, file).then(resolve);
      });
    });

    var thumbPromise = new Promise(function (resolve) {
      window.napResizeImageToBlob(file, 640, 0.8, function (blob) {
        if (!blob) {
          resolve(null);
          return;
        }
        uploadBlobOrFile(blob, thumbStoragePath, null).then(resolve);
      });
    });

    return Promise.all([mainPromise, thumbPromise]).then(function (results) {
      return {
        url: results[0],
        thumbUrl: results[1],
        storagePath: storagePath,
        thumbStoragePath: results[1] ? thumbStoragePath : null,
      };
    });
  }

  function savePost(status) {
    var title = titleInput.value.trim();
    var author = authorInput.value.trim();
    var body = bodyInput.value.trim();
    var cleanedCoAuthors = coAuthorRows.map(function (n) { return n.trim(); }).filter(Boolean);

    if (!title) {
      errorEl.textContent = "Enter a title.";
      errorEl.hidden = false;
      return;
    }
    if (status === "published" && (!author || !body)) {
      errorEl.textContent = "Add an author and post content before publishing.";
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;

    var isEdit = !!currentEditId;
    var postRef = isEdit ? db.collection("blogPosts").doc(currentEditId) : db.collection("blogPosts").doc();
    var postId = postRef.id;

    setSaving(true);
    feedbackEl.hidden = false;
    feedbackEl.className = "form-feedback";
    feedbackEl.textContent = "Saving…";

    var newSlots = photoSlots.filter(function (s) {
      return s.kind === "new";
    });

    Promise.all(
      newSlots.map(function (slot) {
        return uploadBlogPhoto(slot.file, postId);
      })
    )
      .then(function (uploaded) {
        var uploadedIdx = 0;
        var photoUrls = [];
        var photoThumbUrls = [];
        var photoStoragePaths = [];
        var photoThumbStoragePaths = [];

        photoSlots.forEach(function (slot) {
          if (slot.kind === "existing") {
            photoUrls.push(slot.url);
            photoThumbUrls.push(slot.thumbUrl || slot.url);
            photoStoragePaths.push(slot.storagePath || null);
            photoThumbStoragePaths.push(slot.thumbStoragePath || null);
          } else {
            var u = uploaded[uploadedIdx++];
            photoUrls.push(u.url);
            photoThumbUrls.push(u.thumbUrl || u.url);
            photoStoragePaths.push(u.storagePath);
            photoThumbStoragePaths.push(u.thumbStoragePath);
          }
        });

        var payload = {
          title: title,
          author: author,
          coAuthors: cleanedCoAuthors,
          body: body,
          photoUrls: photoUrls,
          photoThumbUrls: photoThumbUrls,
          photoStoragePaths: photoStoragePaths,
          photoThumbStoragePaths: photoThumbStoragePaths,
          status: status,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        if (status === "published") payload.publishedAt = firebase.firestore.FieldValue.serverTimestamp();
        if (!isEdit) {
          payload.createdByUid = currentUid;
          payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        return postRef.set(payload, { merge: true });
      })
      .then(function () {
        removedExistingPhotos.forEach(function (slot) {
          if (slot.storagePath) storage.ref(slot.storagePath).delete().catch(function () {});
          if (slot.thumbStoragePath) storage.ref(slot.thumbStoragePath).delete().catch(function () {});
        });
        feedbackEl.className = "form-feedback form-feedback--success";
        feedbackEl.textContent = status === "published" ? "Published." : "Saved as draft.";
        setSaving(false);
        window.setTimeout(function () {
          postModal.close();
        }, 550);
      })
      .catch(function () {
        setSaving(false);
        feedbackEl.hidden = true;
        errorEl.textContent = "Something went wrong. Please try again.";
        errorEl.hidden = false;
      });
  }

  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", function () {
      savePost("draft");
    });
  }
  if (publishSubmitBtn) {
    publishSubmitBtn.addEventListener("click", function () {
      savePost("published");
    });
  }

  postModal.addEventListener("close", function () {
    currentEditId = null;
    photoSlots.forEach(function (s) {
      if (s.kind === "new" && s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    });
    photoSlots = [];
    removedExistingPhotos = [];
    coAuthorRows = [];
  });
})();
