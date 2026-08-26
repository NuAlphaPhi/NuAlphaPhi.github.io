/* Gallery: photo albums any brother can start and add pics to. Every album
   is visible to every signed-in brother (no per-album privacy) — files live
   in Cloud Storage, Firestore just holds the album/photo metadata. */
(function () {
  "use strict";

  var albumGridEl = document.getElementById("galleryAlbumGrid");
  if (!albumGridEl) return;

  var newAlbumBtn = document.getElementById("newAlbumBtn");

  var currentUid = null;
  var allAlbums = [];
  var started = false;

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function isAdmin() {
    return !!(window.napIsAdmin && window.napIsAdmin());
  }

  function findAlbum(id) {
    return allAlbums.find(function (a) {
      return a.id === id;
    });
  }

  function canManageAlbum(album) {
    return !!album && (album.createdByUid === currentUid || isAdmin());
  }

  window.napOnAuthReady(function (detail) {
    currentUid = detail.uid;
    if (!started) {
      started = true;
      startAlbumsListener();
    }
  });

  function startAlbumsListener() {
    db.collection("galleryAlbums")
      .orderBy("createdAt", "desc")
      .onSnapshot(
        function (snap) {
          allAlbums = snap.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
          });
          renderAlbumGrid();
          if (currentAlbumId) renderAlbumDetail();
        },
        function () {
          albumGridEl.innerHTML = '<p class="news-card__empty">Couldn’t load the Gallery — the site’s database permissions may need to be republished.</p>';
        }
      );
  }

  var IMAGE_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' +
    '<circle cx="8.5" cy="8.5" r="1.5"></circle>' +
    '<path d="M21 15l-5-5L5 21"></path>' +
    "</svg>";

  function albumCardHtml(album) {
    var cover = album.coverUrl
      ? '<div class="gallery-album-card__cover"><img src="' + escapeHtml(album.coverThumbUrl || album.coverUrl) + '" alt="" loading="lazy" decoding="async"></div>'
      : '<div class="gallery-album-card__cover gallery-album-card__cover--empty">' + IMAGE_ICON_SVG + "</div>";

    var count = album.photoCount || 0;
    var manage = canManageAlbum(album);

    return (
      '<article class="gallery-album-card" data-album-id="' + album.id + '">' +
      cover +
      '<div class="gallery-album-card__body">' +
      '<h3 class="gallery-album-card__title">' + escapeHtml(album.title) + "</h3>" +
      '<p class="gallery-album-card__meta">' + count + (count === 1 ? " photo" : " photos") + " · Started by " + escapeHtml(album.createdByName || "A brother") + "</p>" +
      '<div class="gallery-album-card__actions">' +
      '<button class="news-card__action-btn" type="button" data-album-open="' + album.id + '">View Album</button>' +
      (manage
        ? '<button class="news-card__action-btn" type="button" data-album-rename="' + album.id + '">Rename</button>' +
          '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-album-delete="' + album.id + '">Delete</button>'
        : "") +
      "</div></div></article>"
    );
  }

  function renderAlbumGrid() {
    if (!allAlbums.length) {
      albumGridEl.innerHTML = '<p class="news-card__empty">No albums yet — be the first to start one.</p>';
      return;
    }
    albumGridEl.innerHTML = allAlbums.map(albumCardHtml).join("");
  }

  albumGridEl.addEventListener("click", function (e) {
    var openBtn = e.target.closest("[data-album-open]");
    var renameBtn = e.target.closest("[data-album-rename]");
    var deleteBtn = e.target.closest("[data-album-delete]");

    if (openBtn) {
      openAlbumDetail(openBtn.getAttribute("data-album-open"));
      return;
    }
    if (renameBtn) {
      var album = findAlbum(renameBtn.getAttribute("data-album-rename"));
      if (album) openAlbumModal(album);
      return;
    }
    if (deleteBtn) {
      var albumId = deleteBtn.getAttribute("data-album-delete");
      var toDelete = findAlbum(albumId);
      var title = (toDelete && toDelete.title) || "this album";
      window.napConfirm("This also removes every photo in it. This can't be undone.", { title: 'Delete "' + title + '"?', confirmLabel: "Delete" }).then(function (confirmed) {
        if (confirmed) deleteAlbumCascade(albumId);
      });
    }
  });

  function deleteAlbumCascade(albumId) {
    var albumRef = db.collection("galleryAlbums").doc(albumId);
    albumRef
      .collection("photos")
      .get()
      .then(function (snap) {
        var storageDeletes = [];
        snap.docs.forEach(function (doc) {
          var data = doc.data();
          if (data.storagePath) storageDeletes.push(storage.ref(data.storagePath).delete().catch(function () {}));
          if (data.thumbStoragePath) storageDeletes.push(storage.ref(data.thumbStoragePath).delete().catch(function () {}));
        });
        return Promise.all(storageDeletes).then(function () {
          var batch = db.batch();
          snap.forEach(function (doc) {
            batch.delete(doc.ref);
          });
          batch.delete(albumRef);
          return batch.commit();
        });
      })
      .then(function () {
        if (currentAlbumId === albumId) {
          closeAlbumDetail();
          window.napSetTab("gallery");
        }
      })
      .catch(function () {
        window.alert("Couldn't delete this album. Please try again.");
      });
  }

  /* ---------- Create / rename album modal ---------- */
  var albumModal = document.getElementById("modal-gallery-album-form");
  var albumModalTitleEl = document.getElementById("modal-gallery-album-form-title");
  var albumForm = document.getElementById("galleryAlbumForm");
  var albumSubmitBtn = albumForm.querySelector('button[type="submit"]');
  var albumFormErrorEl = document.getElementById("gallery-album-form-error");

  var currentEditAlbumId = null;

  function openAlbumModal(album) {
    currentEditAlbumId = album ? album.id : null;
    albumModalTitleEl.textContent = album ? "Rename Album" : "New Album";
    albumSubmitBtn.textContent = album ? "Save Changes" : "Save Album";
    albumForm.querySelector('[name="title"]').value = album ? album.title || "" : "";
    albumFormErrorEl.hidden = true;
    albumModal.showModal();
  }

  if (newAlbumBtn) {
    newAlbumBtn.addEventListener("click", function () {
      openAlbumModal(null);
    });
  }

  albumForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var title = albumForm.querySelector('[name="title"]').value.trim();
    if (!title) {
      albumFormErrorEl.textContent = "Give the album a title.";
      albumFormErrorEl.hidden = false;
      return;
    }
    albumFormErrorEl.hidden = true;

    var isEdit = !!currentEditAlbumId;
    window.napSaveButtonStart(albumSubmitBtn, isEdit ? "Saving…" : "Creating…");

    var writePromise;
    if (isEdit) {
      writePromise = db.collection("galleryAlbums").doc(currentEditAlbumId).update({
        title: title,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      writePromise = db.collection("galleryAlbums").add({
        title: title,
        createdByUid: currentUid,
        createdByName: window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother"),
        photoCount: 0,
        coverUrl: null,
        coverThumbUrl: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    writePromise
      .then(function (docRef) {
        window.napSaveButtonDone(albumSubmitBtn, { savedLabel: "Saved" });
        window.setTimeout(function () {
          albumModal.close();
          if (!isEdit && docRef) openAlbumDetail(docRef.id);
        }, 550);
      })
      .catch(function () {
        window.napSaveButtonDone(albumSubmitBtn, { error: true });
        albumFormErrorEl.textContent = "Something went wrong. Please try again.";
        albumFormErrorEl.hidden = false;
      });
  });

  /* ---------- Album detail page ---------- */
  var albumPageTitleEl = document.getElementById("galleryAlbumPageTitle");
  var albumPageMetaEl = document.getElementById("galleryAlbumPageMeta");
  var albumPageActionsEl = document.getElementById("galleryAlbumPageActions");
  var albumBackBtn = document.getElementById("galleryAlbumBackBtn");
  var photoGridEl = document.getElementById("galleryPhotoGrid");
  var photoFeedbackEl = document.getElementById("galleryPhotoFeedback");
  var photoUploadInputEl = document.getElementById("galleryPhotoUploadInput");

  var currentAlbumId = null;
  var currentAlbumPhotos = [];
  var photosUnsub = null;

  function openAlbumDetail(albumId) {
    currentAlbumId = albumId;
    currentAlbumPhotos = [];
    renderAlbumDetail();
    window.napSetTab("gallery-album", "gallery");

    if (photosUnsub) {
      photosUnsub();
      photosUnsub = null;
    }
    photosUnsub = db
      .collection("galleryAlbums")
      .doc(albumId)
      .collection("photos")
      .orderBy("createdAt", "desc")
      .onSnapshot(
        function (snap) {
          currentAlbumPhotos = snap.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
          });
          renderPhotoGrid();
        },
        function () {
          photoGridEl.innerHTML = '<p class="media-empty">Couldn’t load photos — the site’s database permissions may need to be republished.</p>';
        }
      );
  }

  function closeAlbumDetail() {
    if (photosUnsub) {
      photosUnsub();
      photosUnsub = null;
    }
    currentAlbumId = null;
    currentAlbumPhotos = [];
    /* The lightbox <dialog> lives at the top level of the page, not nested
       inside this panel, so hiding the panel alone wouldn't close it. */
    if (lightboxModal && lightboxModal.open) lightboxModal.close();
  }

  document.querySelectorAll(".portal-shell__nav-btn").forEach(function (btn) {
    btn.addEventListener("click", closeAlbumDetail);
  });

  if (albumBackBtn) {
    albumBackBtn.addEventListener("click", function () {
      closeAlbumDetail();
      window.napSetTab("gallery");
    });
  }

  function renderAlbumDetail() {
    var album = findAlbum(currentAlbumId);
    if (!album) {
      window.napSetTab("gallery");
      return;
    }

    albumPageTitleEl.textContent = album.title;
    var count = album.photoCount || 0;
    albumPageMetaEl.textContent = count + (count === 1 ? " photo" : " photos") + " · Started by " + (album.createdByName || "A brother");

    albumPageActionsEl.innerHTML = canManageAlbum(album)
      ? '<button class="news-card__action-btn" type="button" data-rename-album>Rename Album</button>' +
        '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-album>Delete Album</button>'
      : "";
  }

  albumPageActionsEl.addEventListener("click", function (e) {
    if (e.target.closest("[data-rename-album]")) {
      var album = findAlbum(currentAlbumId);
      if (album) openAlbumModal(album);
      return;
    }
    if (e.target.closest("[data-delete-album]")) {
      var albumId = currentAlbumId;
      var toDelete = findAlbum(albumId);
      var title = (toDelete && toDelete.title) || "this album";
      window.napConfirm("This also removes every photo in it. This can't be undone.", { title: 'Delete "' + title + '"?', confirmLabel: "Delete" }).then(function (confirmed) {
        if (confirmed) deleteAlbumCascade(albumId);
      });
    }
  });

  /* ---------- Photo grid ---------- */
  function formatPhotoDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return "";
    return timestamp.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function renderPhotoGrid() {
    if (!photoGridEl) return;

    if (!currentAlbumPhotos.length) {
      photoGridEl.innerHTML = '<p class="media-empty">No photos yet — be the first to add one.</p>';
      syncLightboxWithPhotos();
      return;
    }

    photoGridEl.innerHTML = currentAlbumPhotos
      .map(function (p) {
        var canDelete = p.uploadedByUid === currentUid || isAdmin();
        var when = formatPhotoDate(p.createdAt);
        return (
          '<div class="media-card">' +
          '<div class="media-card__preview media-card__preview--clickable" data-photo-open="' + p.id + '">' +
          '<img src="' + escapeHtml(p.thumbUrl || p.url) + '" alt="" loading="lazy" decoding="async"></div>' +
          '<div class="media-card__footer">' +
          '<p class="media-card__meta">' + escapeHtml(p.uploadedByName || "A brother") + (when ? " · " + when : "") + "</p>" +
          '<div class="media-card__actions">' +
          '<button class="media-card__btn" type="button" data-photo-download="' + p.id + '">Download</button>' +
          (canDelete ? '<button class="media-card__btn media-card__btn--danger" type="button" data-photo-delete="' + p.id + '">Delete</button>' : "") +
          "</div></div></div>"
        );
      })
      .join("");

    syncLightboxWithPhotos();
  }

  function downloadPhoto(photo) {
    /* fetch()+blob() used to build this, but Firebase Storage's download
       URLs don't reliably send back CORS headers, so the fetch itself was
       failing before it ever got to the blob step — every download just
       said "failed". Uploads now set Content-Disposition: attachment (see
       uploadPhotoFile), which makes the browser download the file on a
       plain navigation regardless of CORS; target=_blank is the fallback
       for anything uploaded before that existed, so it opens in a new tab
       instead of erroring. */
    var a = document.createElement("a");
    a.href = photo.url;
    a.download = photo.fileName || "download";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function deletePhoto(photoId) {
    var photo = currentAlbumPhotos.find(function (p) {
      return p.id === photoId;
    });
    var albumId = currentAlbumId;
    var album = findAlbum(albumId);
    var storageDeletes = [
      photo && photo.storagePath ? storage.ref(photo.storagePath).delete().catch(function () {}) : Promise.resolve(),
      photo && photo.thumbStoragePath ? storage.ref(photo.thumbStoragePath).delete().catch(function () {}) : Promise.resolve(),
    ];

    Promise.all(storageDeletes)
      .then(function () {
        return db.collection("galleryAlbums").doc(albumId).collection("photos").doc(photoId).delete();
      })
      .then(function () {
        var update = { photoCount: firebase.firestore.FieldValue.increment(-1), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (album && photo && album.coverUrl === photo.url) {
          var nextCover = currentAlbumPhotos.find(function (p) {
            return p.id !== photoId;
          });
          update.coverUrl = nextCover ? nextCover.url : null;
          update.coverThumbUrl = nextCover ? nextCover.thumbUrl || nextCover.url : null;
        }
        return db.collection("galleryAlbums").doc(albumId).update(update);
      })
      .catch(function () {
        window.alert("Couldn't delete this photo. Please try again.");
      });
  }

  if (photoGridEl) {
    photoGridEl.addEventListener("click", function (e) {
      var downloadBtn = e.target.closest("[data-photo-download]");
      var deleteBtn = e.target.closest("[data-photo-delete]");
      var openTrigger = e.target.closest("[data-photo-open]");

      if (downloadBtn) {
        var photo = currentAlbumPhotos.find(function (p) {
          return p.id === downloadBtn.getAttribute("data-photo-download");
        });
        if (photo) downloadPhoto(photo);
        return;
      }

      if (deleteBtn) {
        var photoId = deleteBtn.getAttribute("data-photo-delete");
        window.napConfirm("This can't be undone.", { title: "Delete this photo?", confirmLabel: "Delete" }).then(function (confirmed) {
          if (confirmed) deletePhoto(photoId);
        });
        return;
      }

      if (openTrigger) {
        openLightbox(openTrigger.getAttribute("data-photo-open"));
      }
    });
  }

  /* ---------- Lightbox: click a photo to expand it, arrows/keys to step
     through the rest of the album ---------- */
  var lightboxModal = document.getElementById("modal-gallery-lightbox");
  var lightboxImg = document.getElementById("galleryLightboxImg");
  var lightboxMeta = document.getElementById("galleryLightboxMeta");
  var lightboxPrevBtn = document.getElementById("galleryLightboxPrevBtn");
  var lightboxNextBtn = document.getElementById("galleryLightboxNextBtn");
  var lightboxDownloadBtn = document.getElementById("galleryLightboxDownloadBtn");
  var lightboxIndex = -1;
  var lightboxPhotoId = null; // tracks identity, not just position — see syncLightboxWithPhotos

  function renderLightbox() {
    var photo = currentAlbumPhotos[lightboxIndex];
    if (!photo) return;

    lightboxPhotoId = photo.id;
    lightboxImg.src = photo.url;
    lightboxImg.alt = "";

    var when = formatPhotoDate(photo.createdAt);
    var whoWhen = [photo.uploadedByName || "A brother", when].filter(Boolean).join(" · ");
    lightboxMeta.textContent = whoWhen + " — " + (lightboxIndex + 1) + " of " + currentAlbumPhotos.length;

    var multiple = currentAlbumPhotos.length > 1;
    lightboxPrevBtn.hidden = !multiple;
    lightboxNextBtn.hidden = !multiple;
  }

  function openLightbox(photoId) {
    var idx = currentAlbumPhotos.findIndex(function (p) {
      return p.id === photoId;
    });
    if (idx === -1) return;
    lightboxIndex = idx;
    renderLightbox();
    lightboxModal.showModal();
  }

  function stepLightbox(delta) {
    if (!currentAlbumPhotos.length) return;
    lightboxIndex = (lightboxIndex + delta + currentAlbumPhotos.length) % currentAlbumPhotos.length;
    renderLightbox();
  }

  if (lightboxPrevBtn) lightboxPrevBtn.addEventListener("click", function () { stepLightbox(-1); });
  if (lightboxNextBtn) lightboxNextBtn.addEventListener("click", function () { stepLightbox(1); });

  if (lightboxDownloadBtn) {
    lightboxDownloadBtn.addEventListener("click", function () {
      var photo = currentAlbumPhotos[lightboxIndex];
      if (photo) downloadPhoto(photo);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!lightboxModal || !lightboxModal.open) return;
    if (e.key === "ArrowLeft") stepLightbox(-1);
    else if (e.key === "ArrowRight") stepLightbox(1);
  });

  /* The album's photo list can change (uploads/deletes) while the lightbox
     is open — called from renderPhotoGrid so the lightbox never shows a
     stale photo, and closes itself if the one being viewed was just
     deleted. Looks the photo up by id (lightboxPhotoId), not by re-using
     lightboxIndex against the already-mutated array — indexing with the
     old position into the new array would silently land on whichever
     photo now happens to occupy that slot instead of detecting the photo
     is gone. */
  function syncLightboxWithPhotos() {
    if (!lightboxModal || !lightboxModal.open) return;

    var stillThereIdx = lightboxPhotoId
      ? currentAlbumPhotos.findIndex(function (p) {
          return p.id === lightboxPhotoId;
        })
      : -1;

    if (!currentAlbumPhotos.length || stillThereIdx === -1) {
      lightboxModal.close();
      return;
    }

    lightboxIndex = stillThereIdx;
    renderLightbox();
  }

  var PHOTO_MAX_BYTES = 100 * 1024 * 1024;

  function uploadPhotoFile(file, albumId) {
    var safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    var base = Date.now() + "_" + Math.random().toString(36).slice(2) + "_" + safeName;
    var storagePath = "galleryAlbums/" + albumId + "/" + base;
    var thumbStoragePath = "galleryAlbums/" + albumId + "/" + base + "_thumb.jpg";

    var uploadTask = storage.ref(storagePath).put(file, {
      customMetadata: { uploaderUid: currentUid },
      contentDisposition: 'attachment; filename="' + file.name.replace(/"/g, "") + '"',
    });

    if (photoFeedbackEl) {
      photoFeedbackEl.hidden = false;
      photoFeedbackEl.className = "form-feedback";
      photoFeedbackEl.textContent = 'Uploading "' + file.name + '"… 0%';
    }

    uploadTask.on("state_changed", function (snapshot) {
      var pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      if (photoFeedbackEl) photoFeedbackEl.textContent = 'Uploading "' + file.name + '"… ' + pct + "%";
    });

    /* A small thumbnail uploads alongside the full-res original — the grid
       renders this instead, so scrolling a big album doesn't mean decoding
       dozens of multi-MB photos at once. No separate progress UI for it;
       it's tiny and fast. Falls back to the full photo (thumbUrl null) if
       the browser can't produce a blob for some reason. */
    var thumbUploadPromise = new Promise(function (resolve) {
      window.napResizeImageToBlob(file, 480, 0.75, function (blob) {
        if (!blob) {
          resolve(null);
          return;
        }
        storage
          .ref(thumbStoragePath)
          .put(blob, { customMetadata: { uploaderUid: currentUid } })
          .then(function (snapshot) {
            return snapshot.ref.getDownloadURL();
          })
          .then(resolve)
          .catch(function () {
            resolve(null);
          });
      });
    });

    Promise.all([
      uploadTask.then(function (snapshot) {
        return snapshot.ref.getDownloadURL();
      }),
      thumbUploadPromise,
    ])
      .then(function (results) {
        var url = results[0];
        var thumbUrl = results[1];
        return db
          .collection("galleryAlbums")
          .doc(albumId)
          .collection("photos")
          .add({
            url: url,
            storagePath: storagePath,
            thumbUrl: thumbUrl || null,
            thumbStoragePath: thumbUrl ? thumbStoragePath : null,
            fileName: file.name,
            uploadedByUid: currentUid,
            uploadedByName: window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother"),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          })
          .then(function () {
            var album = findAlbum(albumId);
            var update = { photoCount: firebase.firestore.FieldValue.increment(1), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
            if (album && !album.coverUrl) {
              update.coverUrl = url;
              update.coverThumbUrl = thumbUrl || url;
            }
            return db.collection("galleryAlbums").doc(albumId).update(update);
          });
      })
      .then(function () {
        if (photoFeedbackEl) {
          photoFeedbackEl.className = "form-feedback form-feedback--success";
          photoFeedbackEl.textContent = '"' + file.name + '" uploaded.';
        }
        window.setTimeout(function () {
          if (photoFeedbackEl) photoFeedbackEl.hidden = true;
        }, 2000);
      })
      .catch(function () {
        if (photoFeedbackEl) {
          photoFeedbackEl.className = "form-feedback form-feedback--error";
          photoFeedbackEl.textContent = 'Couldn\'t upload "' + file.name + '". Please try again.';
        }
      });
  }

  if (photoUploadInputEl) {
    photoUploadInputEl.addEventListener("change", function () {
      var files = Array.prototype.slice.call(photoUploadInputEl.files || []);
      photoUploadInputEl.value = "";
      if (!files.length || !currentAlbumId) return;

      var albumId = currentAlbumId;
      files.forEach(function (file) {
        if (file.type.indexOf("image/") !== 0) {
          window.alert('"' + file.name + '" isn\'t a photo — skipped.');
          return;
        }
        if (file.size > PHOTO_MAX_BYTES) {
          window.alert('"' + file.name + '" is over the 100MB limit — skipped.');
          return;
        }
        uploadPhotoFile(file, albumId);
      });
    });
  }

  /* Re-check admin status (affects Rename/Delete visibility) every time this
     tab is actually opened, same class of stale-button fix used elsewhere
     in this app (Family Tree's "New Lineage", Pledges' own buttons). */
  var galleryNavBtn = document.querySelector('.portal-shell__nav-btn[data-tab="gallery"]');
  if (galleryNavBtn) {
    galleryNavBtn.addEventListener("click", function () {
      renderAlbumGrid();
    });
  }
})();
