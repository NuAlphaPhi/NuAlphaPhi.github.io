/* Announcements + comments: create/read/update/delete, live via Firestore onSnapshot */
(function () {
  "use strict";

  var listEl = document.getElementById("announcementsList");
  if (!listEl) return;

  var newBtn = document.getElementById("newAnnouncementBtn");
  var modal = document.getElementById("modal-announcement-form");
  var form = document.getElementById("announcementForm");
  var modalTitle = document.getElementById("modal-announcement-title");
  var submitBtn = form ? form.querySelector(".form-submit") : null;

  var detailModal = document.getElementById("modal-announcement-view");
  var detailModalTitleEl = document.getElementById("announcement-modal-title");
  var detailModalBodyEl = document.getElementById("announcementModalBody");

  var currentUid = null;
  var currentEditId = null;
  var allAnnouncements = [];

  var commentsExpanded = {};
  var addCommentOpen = {};
  var editingCommentId = {};
  var commentsById = {};
  var commentUnsubscribers = {};

  var openAnnouncementId = null;
  var detailCommentsExpanded = false;
  var detailAddCommentOpen = false;
  var detailEditingCommentId = null;
  var detailCommentUnsub = null;
  var detailComments = [];
  var pendingHighlightCommentId = null;

  var started = false;
  document.addEventListener("nap:auth-ready", function (e) {
    currentUid = e.detail.uid;
    if (!started) {
      started = true;
      startAnnouncementsListener();
    }
  });

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return "";
    return timestamp.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function openModal(editId, title, body) {
    currentEditId = editId;
    modalTitle.textContent = editId ? "Edit Announcement" : "New Announcement";
    submitBtn.textContent = editId ? "Save Changes" : "Post Announcement";
    form.querySelector('[name="title"]').value = title || "";
    form.querySelector('[name="body"]').value = body || "";
    modal.showModal();
  }

  if (newBtn) {
    newBtn.addEventListener("click", function () {
      openModal(null, "", "");
    });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var title = form.querySelector('[name="title"]').value.trim();
      var body = form.querySelector('[name="body"]').value.trim();
      if (!title || !body) return;

      var authorName = window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother");

      if (currentEditId) {
        db.collection("announcements").doc(currentEditId).update({
          title: title,
          body: body,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        db.collection("announcements").add({
          authorUid: currentUid,
          authorName: authorName,
          title: title,
          body: body,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }

      modal.close();
    });
  }

  function deleteAnnouncementCascade(id) {
    var commentsRef = db.collection("announcements").doc(id).collection("comments");
    commentsRef.get().then(function (snap) {
      var batch = db.batch();
      snap.forEach(function (doc) {
        batch.delete(doc.ref);
      });
      batch.delete(db.collection("announcements").doc(id));
      return batch.commit();
    });
  }

  /* Inline comments (Announcements tab list) */
  function attachCommentListener(announcementId) {
    if (commentUnsubscribers[announcementId]) return;
    commentUnsubscribers[announcementId] = db
      .collection("announcements")
      .doc(announcementId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .onSnapshot(function (snap) {
        commentsById[announcementId] = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderAnnouncementCard(announcementId);
      });
  }

  function detachCommentListener(announcementId) {
    if (commentUnsubscribers[announcementId]) {
      commentUnsubscribers[announcementId]();
      delete commentUnsubscribers[announcementId];
    }
    delete commentsById[announcementId];
  }

  function renderAnnouncementCard(id) {
    var container = document.getElementById("announcement-" + id);
    if (!container) return;
    var a = allAnnouncements.find(function (item) {
      return item.id === id;
    });
    if (!a) return;

    var isOwner = a.authorUid === currentUid;
    var comments = commentsById[id] || [];

    var html =
      '<div class="news-card__meta">' +
      window.napAuthorBadgeHtml(a.authorUid, a.authorName) +
      '<span class="news-card__date">' + formatDate(a.createdAt) + "</span>" +
      "</div>" +
      '<div class="news-card__header">' +
      '<h3 class="news-card__title">' + escapeHtml(a.title) + "</h3>" +
      (isOwner
        ? '<div class="news-card__actions">' +
          '<button class="news-card__action-btn" type="button" data-edit-announcement="' + a.id + '" data-title="' + escapeHtml(a.title) + '" data-body="' + escapeHtml(a.body) + '">Edit</button>' +
          '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-announcement="' + a.id + '">Delete</button>' +
          "</div>"
        : "") +
      "</div>" +
      '<p class="news-card__text">' + escapeHtml(a.body) + "</p>" +
      window.napCommentsSectionHtml({
        comments: comments,
        currentUid: currentUid,
        expanded: !!commentsExpanded[id],
        showAddForm: !!addCommentOpen[id],
        editingCommentId: editingCommentId[id] || null,
      });

    container.innerHTML = html;

    if (pendingHighlightCommentId && pendingHighlightCommentId.announcementId === id) {
      var target = pendingHighlightCommentId.commentId;
      pendingHighlightCommentId = null;
      window.requestAnimationFrame(function () {
        var el = document.getElementById("comment-" + target);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("is-highlighted");
        window.setTimeout(function () {
          el.classList.remove("is-highlighted");
        }, 2500);
      });
    }
  }

  listEl.addEventListener("submit", function (e) {
    if (e.target.classList.contains("comment-add-form")) {
      e.preventDefault();
      var container = e.target.closest("[data-announcement-id]");
      var announcementId = container.getAttribute("data-announcement-id");
      var input = e.target.querySelector('[name="body"]');
      var body = input.value.trim();
      if (!body) return;

      var a = allAnnouncements.find(function (item) {
        return item.id === announcementId;
      });

      db.collection("announcements")
        .doc(announcementId)
        .collection("comments")
        .add({
          authorUid: currentUid,
          authorName: window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother"),
          body: body,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .then(function (docRef) {
          if (a && window.napNotifyComment) {
            window.napNotifyComment({
              recipientUid: a.authorUid,
              type: "announcement",
              postId: announcementId,
              postTitle: a.title,
              commentId: docRef.id,
              snippet: body,
            });
          }
        });

      addCommentOpen[announcementId] = false;
    }

    if (e.target.classList.contains("comment-edit-form")) {
      e.preventDefault();
      var cid = e.target.getAttribute("data-comment-id");
      var container2 = e.target.closest("[data-announcement-id]");
      var aid = container2.getAttribute("data-announcement-id");
      var newBody = e.target.querySelector('[name="body"]').value.trim();
      if (!newBody) return;

      db.collection("announcements").doc(aid).collection("comments").doc(cid).update({
        body: newBody,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      editingCommentId[aid] = null;
    }
  });

  listEl.addEventListener("click", function (e) {
    var editBtn = e.target.closest("[data-edit-announcement]");
    var deleteBtn = e.target.closest("[data-delete-announcement]");
    var profileBtn = e.target.closest("[data-open-profile]");
    var toggleShow = e.target.closest("[data-comments-toggle-show]");
    var toggleAdd = e.target.closest("[data-comments-toggle-add]");
    var editCommentBtn = e.target.closest("[data-comment-edit]");
    var deleteCommentBtn = e.target.closest("[data-comment-delete]");
    var cancelCommentEdit = e.target.closest("[data-cancel-comment-edit]");
    var container = e.target.closest("[data-announcement-id]");
    var announcementId = container ? container.getAttribute("data-announcement-id") : null;

    if (profileBtn) return;

    if (editBtn) {
      openModal(
        editBtn.getAttribute("data-edit-announcement"),
        editBtn.getAttribute("data-title"),
        editBtn.getAttribute("data-body")
      );
      return;
    }

    if (deleteBtn) {
      if (window.confirm("Delete this announcement? This also removes its comments.")) {
        deleteAnnouncementCascade(deleteBtn.getAttribute("data-delete-announcement"));
      }
      return;
    }

    if (!announcementId) return;

    if (toggleShow) {
      commentsExpanded[announcementId] = !commentsExpanded[announcementId];
      renderAnnouncementCard(announcementId);
      return;
    }

    if (toggleAdd) {
      addCommentOpen[announcementId] = !addCommentOpen[announcementId];
      renderAnnouncementCard(announcementId);
      return;
    }

    if (editCommentBtn) {
      editingCommentId[announcementId] = editCommentBtn.getAttribute("data-comment-edit");
      renderAnnouncementCard(announcementId);
      return;
    }

    if (deleteCommentBtn) {
      if (window.confirm("Delete this comment?")) {
        db.collection("announcements").doc(announcementId).collection("comments").doc(deleteCommentBtn.getAttribute("data-comment-delete")).delete();
      }
      return;
    }

    if (cancelCommentEdit) {
      editingCommentId[announcementId] = null;
      renderAnnouncementCard(announcementId);
    }
  });

  /* Redirect target for notifications: scroll to the card, expand comments,
     highlight the specific comment. */
  window.napGoToAnnouncementComment = function (announcementId, commentId) {
    window.napSetTab("announcements");
    commentsExpanded[announcementId] = true;
    pendingHighlightCommentId = commentId ? { announcementId: announcementId, commentId: commentId } : null;
    renderAnnouncementCard(announcementId);
    window.requestAnimationFrame(function () {
      var card = document.getElementById("announcement-" + announcementId);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /* Detail popup — used by Overview's "Recent Announcements" list */
  function attachDetailCommentListener(announcementId) {
    if (detailCommentUnsub) {
      detailCommentUnsub();
      detailCommentUnsub = null;
    }
    detailCommentUnsub = db
      .collection("announcements")
      .doc(announcementId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .onSnapshot(function (snap) {
        detailComments = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderDetailModal();
      });
  }

  function renderDetailModal() {
    var a = allAnnouncements.find(function (item) {
      return item.id === openAnnouncementId;
    });
    if (!a) {
      detailModal.close();
      return;
    }

    detailModalTitleEl.textContent = a.title;

    var html =
      '<div class="news-card__meta">' +
      window.napAuthorBadgeHtml(a.authorUid, a.authorName) +
      '<span class="news-card__date">' + formatDate(a.createdAt) + "</span>" +
      "</div>" +
      '<p class="event-modal__desc">' + escapeHtml(a.body) + "</p>" +
      window.napCommentsSectionHtml({
        comments: detailComments,
        currentUid: currentUid,
        expanded: detailCommentsExpanded,
        showAddForm: detailAddCommentOpen,
        editingCommentId: detailEditingCommentId,
      });

    detailModalBodyEl.innerHTML = html;
  }

  window.napOpenAnnouncement = function (announcementId) {
    openAnnouncementId = announcementId;
    detailCommentsExpanded = false;
    detailAddCommentOpen = false;
    detailEditingCommentId = null;
    attachDetailCommentListener(announcementId);
    renderDetailModal();
    detailModal.showModal();
  };

  detailModal.addEventListener("close", function () {
    if (detailCommentUnsub) {
      detailCommentUnsub();
      detailCommentUnsub = null;
    }
    openAnnouncementId = null;
    detailComments = [];
  });

  detailModalBodyEl.addEventListener("click", function (e) {
    var profileBtn = e.target.closest("[data-open-profile]");
    var toggleShow = e.target.closest("[data-comments-toggle-show]");
    var toggleAdd = e.target.closest("[data-comments-toggle-add]");
    var editCommentBtn = e.target.closest("[data-comment-edit]");
    var deleteCommentBtn = e.target.closest("[data-comment-delete]");
    var cancelCommentEdit = e.target.closest("[data-cancel-comment-edit]");

    if (profileBtn) return;

    if (toggleShow) {
      detailCommentsExpanded = !detailCommentsExpanded;
      renderDetailModal();
      return;
    }

    if (toggleAdd) {
      detailAddCommentOpen = !detailAddCommentOpen;
      renderDetailModal();
      return;
    }

    if (editCommentBtn) {
      detailEditingCommentId = editCommentBtn.getAttribute("data-comment-edit");
      renderDetailModal();
      return;
    }

    if (deleteCommentBtn) {
      if (window.confirm("Delete this comment?")) {
        db.collection("announcements").doc(openAnnouncementId).collection("comments").doc(deleteCommentBtn.getAttribute("data-comment-delete")).delete();
      }
      return;
    }

    if (cancelCommentEdit) {
      detailEditingCommentId = null;
      renderDetailModal();
    }
  });

  detailModalBodyEl.addEventListener("submit", function (e) {
    if (e.target.classList.contains("comment-add-form")) {
      e.preventDefault();
      var input = e.target.querySelector('[name="body"]');
      var body = input.value.trim();
      if (!body) return;

      var a = allAnnouncements.find(function (item) {
        return item.id === openAnnouncementId;
      });

      db.collection("announcements")
        .doc(openAnnouncementId)
        .collection("comments")
        .add({
          authorUid: currentUid,
          authorName: window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother"),
          body: body,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .then(function (docRef) {
          if (a && window.napNotifyComment) {
            window.napNotifyComment({
              recipientUid: a.authorUid,
              type: "announcement",
              postId: openAnnouncementId,
              postTitle: a.title,
              commentId: docRef.id,
              snippet: body,
            });
          }
        });

      detailAddCommentOpen = false;
    }

    if (e.target.classList.contains("comment-edit-form")) {
      e.preventDefault();
      var cid = e.target.getAttribute("data-comment-id");
      var newBody = e.target.querySelector('[name="body"]').value.trim();
      if (!newBody) return;

      db.collection("announcements").doc(openAnnouncementId).collection("comments").doc(cid).update({
        body: newBody,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      detailEditingCommentId = null;
    }
  });

  function startAnnouncementsListener() {
    db.collection("announcements")
      .orderBy("createdAt", "desc")
      .onSnapshot(function (snap) {
        allAnnouncements = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });

        var currentIds = allAnnouncements.map(function (a) {
          return a.id;
        });
        Object.keys(commentUnsubscribers).forEach(function (id) {
          if (currentIds.indexOf(id) === -1) detachCommentListener(id);
        });

        if (!allAnnouncements.length) {
          listEl.innerHTML = '<p class="news-card__empty">No announcements yet — be the first to post one.</p>';
          return;
        }

        listEl.innerHTML = allAnnouncements
          .map(function (a) {
            return '<article class="news-card" id="announcement-' + a.id + '" data-announcement-id="' + a.id + '"></article>';
          })
          .join("");

        allAnnouncements.forEach(function (a) {
          attachCommentListener(a.id);
          renderAnnouncementCard(a.id);
        });

        if (openAnnouncementId) renderDetailModal();
      });
  }
})();
