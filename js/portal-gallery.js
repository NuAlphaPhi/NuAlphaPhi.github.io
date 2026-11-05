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
  var autoCovers = new Map();

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
            return Object.assign({}, doc.data(), { id: doc.id });
          });
          syncAutoCovers();
          renderAlbumGrid();
          if (currentAlbumId) renderAlbumDetail();
        },
        function () {
          albumGridEl.innerHTML = '<p class="news-card__empty">Couldn’t load the Gallery — the site’s database permissions may need to be republished.</p>';
        }
      );
  }

  // Legacy/imported albums may have photos without saved cover metadata.
  // Listen to just one photo so uploads/deletions update the fallback too,
  // without downloading an entire album or requiring a database write.
  function syncAutoCovers() {
    autoCovers.forEach(function (entry, id) {
      var album = findAlbum(id);
      if (!album || album.coverThumbUrl || album.coverUrl) {
        entry.unsubscribe();
        autoCovers.delete(id);
      }
    });
    allAlbums.forEach(function (album) {
      if (album.coverThumbUrl || album.coverUrl) return;
      var existing = autoCovers.get(album.id);
      if (existing) {
        album.autoCoverUrl = existing.url;
        return;
      }
      var entry = { url: null, unsubscribe: function () {} };
      autoCovers.set(album.id, entry);
      entry.unsubscribe = db.collection("galleryAlbums").doc(album.id)
        .collection("photos").limit(1).onSnapshot(function (snap) {
          if (autoCovers.get(album.id) !== entry) return;
          var photo = snap.docs.length ? snap.docs[0].data() : null;
          entry.url = photo ? photo.thumbUrl || photo.url || null : null;
          var current = findAlbum(album.id);
          if (current) current.autoCoverUrl = entry.url;
          renderAlbumGrid();
        }, function () {
          // Allow a later album refresh to retry a failed listener.
          if (autoCovers.get(album.id) === entry) autoCovers.delete(album.id);
        });
    });
  }

  var IMAGE_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' +
    '<circle cx="8.5" cy="8.5" r="1.5"></circle>' +
    '<path d="M21 15l-5-5L5 21"></path>' +
    "</svg>";

  function albumCardHtml(album) {
    var coverUrl = album.coverThumbUrl || album.coverUrl || album.autoCoverUrl;
    var cover = coverUrl
      ? '<div class="gallery-album-card__cover"><img src="' + escapeHtml(coverUrl) + '" style="object-position:50% ' + (Number.isFinite(album.coverPosition)?Math.max(0,Math.min(100,album.coverPosition)):50) + '%" alt="" loading="lazy" decoding="async"></div>'
      : '<div class="gallery-album-card__cover gallery-album-card__cover--empty">' + IMAGE_ICON_SVG + "</div>";

    var count = Number.isSafeInteger(album.photoCount) && album.photoCount >= 0 ? album.photoCount : 0;
    var manage = canManageAlbum(album);

    return (
      '<article tabindex="0" aria-label="Open album" class="gallery-album-card" data-album-id="' + escapeHtml(album.id) + '">' +
      cover +
      '<div class="gallery-album-card__body">' +
      '<h3 class="gallery-album-card__title">' + escapeHtml(album.title) + "</h3>" +
      '<p class="gallery-album-card__meta">' + count + (count === 1 ? " photo" : " photos") + " · Started by " + escapeHtml(album.createdByName || "A brother") + "</p>" +
      '<div class="gallery-album-card__actions">' +
      '<button class="news-card__action-btn" type="button" data-album-open="' + escapeHtml(album.id) + '">View Album</button>' +
      (manage
        ? '<details class="p-album-menu"><summary aria-label="Manage album">⋯</summary><button class="news-card__action-btn" type="button" data-album-rename="' + escapeHtml(album.id) + '">Edit details</button>' +
          '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-album-delete="' + escapeHtml(album.id) + '">Delete</button></details>'
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
    if (!e.target.closest('button,summary,details')) {
      var card = e.target.closest('[data-album-id]');
      if(card) { openAlbumDetail(card.dataset.albumId); return; }
    }
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

  albumGridEl.addEventListener('keydown', function(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-album-id]')) {
      e.preventDefault(); openAlbumDetail(e.target.dataset.albumId);
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
        return Promise.all(storageDeletes).then(async function () {
          for(var i=0;i<snap.docs.length;i+=400){var batch=db.batch();snap.docs.slice(i,i+400).forEach(function(doc){batch.delete(doc.ref);});await batch.commit();}
          await albumRef.delete();
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

  ['description', 'eventDate', 'eventId'].forEach(function(name) {
    var label = document.createElement('label'); label.className = 'form-field';
    label.textContent = {description:'Description',eventDate:'Event date',eventId:'Linked event (optional)'}[name];
    var input = document.createElement(name === 'description' ? 'textarea' : name === 'eventId' ? 'select' : 'input');
    input.name = name; if(input.tagName==='INPUT')input.type = name === 'eventDate' ? 'date' : 'text'; input.maxLength = name === 'description' ? 2000 : 128;
    label.append(input); albumSubmitBtn.before(label);
  });
  function openAlbumModal(album) {
    var events=albumForm.elements.eventId; events.replaceChildren(new Option('No linked event','')); ((window.P985 && P985.events)||[]).forEach(function(e){events.add(new Option(e.title,e.id));});
    ['description','eventDate','eventId'].forEach(function(name) { albumForm.elements[name].value = album && album[name] || ''; });
    currentEditAlbumId = album ? album.id : null;
    albumModalTitleEl.textContent = album ? "Edit Album" : "New Album";
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
        description: albumForm.elements.description.value.trim(),
        eventDate: albumForm.elements.eventDate.value,
        eventId: albumForm.elements.eventId.value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      writePromise = db.collection("galleryAlbums").add({
        title: title,
        description: albumForm.elements.description.value.trim(),
        eventDate: albumForm.elements.eventDate.value,
        eventId: albumForm.elements.eventId.value.trim(),
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
    visiblePhotos = 48; selectedPhotos.clear();
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
            return Object.assign({}, doc.data(), { id: doc.id });
          });
          renderPhotoGrid();
        },
        function () {
          photoGridEl.innerHTML = '<p class="media-empty">Couldn’t load photos — the site’s database permissions may need to be republished.</p>';
        }
      );
  }

  window.napOpenAlbum = openAlbumDetail;

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
    var count = Number.isSafeInteger(album.photoCount) && album.photoCount >= 0 ? album.photoCount : 0;
    albumPageMetaEl.textContent = count + (count === 1 ? " photo" : " photos") + " · Started by " + (album.createdByName || "A brother");

    if(album.description)albumPageMetaEl.textContent += ' · '+album.description;
    if(album.eventDate)albumPageMetaEl.textContent += ' · '+album.eventDate;
    albumPageActionsEl.innerHTML = canManageAlbum(album)
      ? '<button class="news-card__action-btn" type="button" data-rename-album>Edit Album</button>' +
        '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-album>Delete Album</button>'
      : "";
    if(album.eventId && window.P985)albumPageActionsEl.append(P985.button('View linked event',function(){P985.openEvent(album.eventId);}));
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

  var visiblePhotos = 48, selectedPhotos = new Set();
  var tools = document.createElement('div'); tools.className = 'p-gallery-tools p985';
  photoGridEl.before(tools);
  function renderPhotoGrid() {
    tools.replaceChildren();
    if (window.P985) {
      var P = P985;
      tools.append(P.button('Select all', function(){ currentAlbumPhotos.forEach(function(p){selectedPhotos.add(p.id);}); renderPhotoGrid(); }),
        P.button('Clear selection', function(){selectedPhotos.clear();renderPhotoGrid();}),
        P.button('Download selected (' + selectedPhotos.size + ')',function(){currentAlbumPhotos.filter(function(p){return selectedPhotos.has(p.id);}).forEach(downloadPhoto);}),
        P.button('Delete selected',function(){P.run(tools,async function(){var eligible=currentAlbumPhotos.filter(function(p){return selectedPhotos.has(p.id)&&(p.uploadedByUid===currentUid||canManageAlbum(findAlbum(currentAlbumId)));});if(!eligible.length)throw Error('Select photos you uploaded, or ask an administrator.');if(await P.confirm('Delete '+eligible.length+' selected photos?')){for(var p of eligible)await deletePhoto(p.id);selectedPhotos.clear();renderPhotoGrid();}});})
      );
    }
    if (!photoGridEl) return;

    if (!currentAlbumPhotos.length) {
      photoGridEl.innerHTML = '<p class="media-empty">No photos yet — be the first to add one.</p>';
      syncLightboxWithPhotos();
      return;
    }

    photoGridEl.innerHTML = currentAlbumPhotos.slice(0, visiblePhotos)
      .map(function (p) {
        var canDelete = p.uploadedByUid === currentUid || canManageAlbum(findAlbum(currentAlbumId));
        var when = formatPhotoDate(p.createdAt);
        return (
          '<div class="media-card">' +
          '<label><input type="checkbox" data-photo-select="' + escapeHtml(p.id) + '" ' + (selectedPhotos.has(p.id)?'checked':'') + '> Select photo</label>' +
          '<div role="button" tabindex="0" aria-label="Open photo" class="media-card__preview media-card__preview--clickable" data-photo-open="' + escapeHtml(p.id) + '">' +
          '<img src="' + escapeHtml(p.thumbUrl || p.url) + '" alt="" loading="lazy" decoding="async"></div>' +
          '<div class="media-card__footer">' +
          '<p>' + escapeHtml(p.caption || '') + '</p><p class="media-card__meta">' + escapeHtml(p.uploadedByName || "A brother") + (when ? " · " + when : "") + "</p>" +
          '<div class="media-card__actions">' +
          '<button class="media-card__btn" type="button" data-photo-download="' + escapeHtml(p.id) + '">Download</button>' +
          (canManageAlbum(findAlbum(currentAlbumId)) ? '<button class="media-card__btn" type="button" data-photo-cover="' + escapeHtml(p.id) + '">Set cover</button>' : '') +
          (canDelete ? '<button class="media-card__btn" type="button" data-photo-caption="' + escapeHtml(p.id) + '">Caption / tags</button>' : '') +
          (canDelete ? '<button class="media-card__btn media-card__btn--danger" type="button" data-photo-delete="' + escapeHtml(p.id) + '">Delete</button>' : "") +
          "</div></div></div>"
        );
      })
      .join("");

    if (currentAlbumPhotos.length > visiblePhotos && window.P985) photoGridEl.append(P985.button('Load more photos',function(){visiblePhotos+=48;renderPhotoGrid();}));
    syncLightboxWithPhotos();
  }
  photoGridEl.addEventListener('change',function(e){if(e.target.dataset.photoSelect){var id=e.target.dataset.photoSelect;e.target.checked?selectedPhotos.add(id):selectedPhotos.delete(id);renderPhotoGrid();}});
  photoGridEl.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.dataset.photoOpen){e.preventDefault();openLightbox(e.target.dataset.photoOpen);}});
  photoGridEl.addEventListener('click',function(e){
    var button=e.target.closest('[data-photo-cover],[data-photo-caption]');if(!button)return;
    var P=P985,photo=currentAlbumPhotos.find(function(p){return p.id===(button.dataset.photoCover||button.dataset.photoCaption);});
    if(!photo)return;
    var box=P.el('div');
    if(button.dataset.photoCover){
      var img=P.image(photo.url,'p-event-cover'), crop=P.field('Vertical crop position','range',50);crop.input.min=0;crop.input.max=100;
      img.style.aspectRatio='4/3';img.style.objectFit='cover';crop.input.oninput=function(){img.style.objectPosition='50% '+crop.input.value+'%';};
      box.append(img,crop.wrap,P.button('Use as album cover',function(){P.run(box,async function(){await db.doc('galleryAlbums/'+currentAlbumId).update({coverUrl:photo.url,coverThumbUrl:photo.thumbUrl||photo.url,coverPosition:Number(crop.input.value),updatedAt:P.stamp()});d.close();});}));
    }else{
      var caption=P.field('Caption','textarea',photo.caption||''),tags=P.field('Tag brothers (comma-separated pledge names)','text',(photo.taggedUids||[]).map(function(id){return P.name(P.person(id));}).join(', '));caption.input.maxLength=1000;
      box.append(caption.wrap,tags.wrap,P.button('Save',function(){P.run(box,async function(){var names=tags.input.value.split(',').map(function(x){return x.trim();}).filter(Boolean);var ids=names.map(function(name){var matches=P.brothers.filter(function(b){return P.name(b).toLowerCase()===name.toLowerCase();});if(matches.length!==1)throw Error('The name '+name+' does not identify exactly one brother.');return matches[0].uid;});if(ids.length>30)throw Error('Tag up to 30 brothers.');await db.doc('galleryAlbums/'+currentAlbumId+'/photos/'+photo.id).update({caption:caption.input.value.trim(),taggedUids:ids,updatedAt:P.stamp()});d.close();});}));
    }
    var d=P.dialog(button.dataset.photoCover?'Album cover':'Photo details',box);
  });

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
    if (!/^https?:\/\//i.test(String(photo.url || ""))) return;
    a.href = photo.url;
    a.download = photo.fileName || "download";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function deletePhoto(photoId) {
    var albumId=currentAlbumId,albumRef=db.doc('galleryAlbums/'+albumId),photoRef=albumRef.collection('photos').doc(photoId);
    var photo=currentAlbumPhotos.find(function(p){return p.id===photoId;}),next=currentAlbumPhotos.find(function(p){return p.id!==photoId;});
    await db.runTransaction(async function(tx){
      var snapshots=await Promise.all([tx.get(albumRef),tx.get(photoRef),next?tx.get(albumRef.collection('photos').doc(next.id)):Promise.resolve(null)]);
      if(!snapshots[0].exists||!snapshots[1].exists)return;
      var album=snapshots[0].data(),data=snapshots[1].data(),update={photoCount:Math.max(0,(album.photoCount||1)-1),updatedAt:P985.stamp()};
      if(album.coverUrl===data.url || album.coverThumbUrl===data.thumbUrl){var replacement=snapshots[2]?.exists?snapshots[2].data():null;update.coverUrl=replacement?replacement.url:null;update.coverThumbUrl=replacement?(replacement.thumbUrl||replacement.url):null;}
      tx.delete(photoRef);tx.update(albumRef,update);
    });
    await Promise.all([photo?.storagePath,photo?.thumbStoragePath].filter(Boolean).map(function(path){return storage.ref(path).delete().catch(function(){});}));
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
          if (confirmed) P985.run(photoGridEl,function(){return deletePhoto(photoId);});
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

  var uploadQueue=document.createElement('div');uploadQueue.setAttribute('aria-live','polite');photoGridEl.before(uploadQueue);
  function uploadPhotoFile(file, albumId, job) {
    var P=P985;
    job=job||{id:crypto.randomUUID(),base:crypto.randomUUID()+'_'+file.name.replace(/[^a-zA-Z0-9_.-]/g,'_')};
    var row=P.el('div','p-upload-item'),progress=P.el('progress'),status=P.el('span','','Uploading');progress.max=100;progress.value=0;progress.setAttribute('aria-label','Upload '+file.name);row.append(P.el('span','',file.name),progress,status);uploadQueue.append(row);
    var path='galleryAlbums/'+albumId+'/'+job.base,thumbPath=path+'_thumb.jpg';
    async function upload(blob,path,onProgress){
      var ref=storage.ref(path);
      try{return await ref.getDownloadURL();}catch(error){if(error.code!=='storage/object-not-found')throw error;}
      var task=ref.put(blob,{customMetadata:{uploaderUid:currentUid}});
      task.on('state_changed',function(s){if(onProgress)onProgress(s);});await task;return ref.getDownloadURL();
    }
    return (async function(){
      var url=await upload(file,path,function(s){progress.value=Math.round(s.bytesTransferred/s.totalBytes*100);});
      var blob=await new Promise(function(resolve){window.napResizeImageToBlob(file,480,.75,resolve);});
      var thumbUrl=blob?await upload(blob,thumbPath):null;
      var albumRef=db.doc('galleryAlbums/'+albumId),photoRef=albumRef.collection('photos').doc(job.id);
      await db.runTransaction(async function(tx){
        var snapshots=await Promise.all([tx.get(albumRef),tx.get(photoRef)]),album=snapshots[0];if(!album.exists)throw Error('This album was deleted.');if(snapshots[1].exists)return;
        tx.set(photoRef,{url:url,storagePath:path,thumbUrl:thumbUrl,thumbStoragePath:thumbUrl?thumbPath:null,fileName:file.name,uploadedByUid:currentUid,uploadedByName:window.napDisplayName(window.NAP_CURRENT_PROFILE,'A brother'),createdAt:P.stamp()});
        var patch={photoCount:firebase.firestore.FieldValue.increment(1),updatedAt:P.stamp()};if(!album.data().coverUrl&&!album.data().coverThumbUrl){patch.coverUrl=url;patch.coverThumbUrl=thumbUrl||url;}tx.update(albumRef,patch);
      });
      progress.value=100;status.textContent='Uploaded';
    })().catch(function(error){status.textContent=error.message||'Upload failed';row.append(P.button('Retry',function(){row.remove();uploadPhotoFile(file,albumId,job);}));});
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
