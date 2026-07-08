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

  var currentUid = null;
  var currentEditId = null;
  var editingCommentId = null;
  var commentUnsubscribers = {};

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

  function renderComments(announcementId, container) {
    var commentsRef = db.collection("announcements").doc(announcementId).collection("comments").orderBy("createdAt", "asc");

    var unsubscribe = commentsRef.onSnapshot(function (snap) {
      var html = '<div class="comment-list">';
      snap.forEach(function (doc) {
        var c = doc.data();
        var isOwner = c.authorUid === currentUid;

        if (editingCommentId === doc.id) {
          html +=
            '<div class="comment-item">' +
            '<form class="comment-edit-form" data-comment-id="' + doc.id + '" data-announcement-id="' + announcementId + '" style="display:flex;gap:0.5rem;">' +
            '<input class="form-input" name="body" value="' + escapeHtml(c.body) + '" required>' +
            '<button class="form-submit form-submit--small" type="submit">Save</button>' +
            '<button class="news-card__action-btn" type="button" data-cancel-comment-edit>Cancel</button>' +
            "</form></div>";
        } else {
          html +=
            '<div class="comment-item">' +
            '<div class="comment-item__meta">' +
            '<span class="comment-item__author">' + escapeHtml(c.authorName) + "</span>" +
            (isOwner
              ? '<span class="comment-item__actions">' +
                '<button class="news-card__action-btn" type="button" data-edit-comment="' + doc.id + '" data-announcement-id="' + announcementId + '">Edit</button>' +
                '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-comment="' + doc.id + '" data-announcement-id="' + announcementId + '">Delete</button>' +
                "</span>"
              : "") +
            "</div>" +
            '<p class="comment-item__text">' + escapeHtml(c.body) + "</p>" +
            "</div>";
        }
      });
      html += "</div>";
      html +=
        '<form class="comment-form" data-announcement-id="' + announcementId + '">' +
        '<input class="form-input" name="body" placeholder="Ask a question or add a comment…" required>' +
        '<button class="form-submit form-submit--small" type="submit">Comment</button>' +
        "</form>";

      container.innerHTML = html;
    });

    commentUnsubscribers[announcementId] = unsubscribe;
  }

  listEl.addEventListener("submit", function (e) {
    if (e.target.classList.contains("comment-form")) {
      e.preventDefault();
      var announcementId = e.target.getAttribute("data-announcement-id");
      var input = e.target.querySelector('[name="body"]');
      var body = input.value.trim();
      if (!body) return;

      db.collection("announcements").doc(announcementId).collection("comments").add({
        authorUid: currentUid,
        authorName: window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother"),
        body: body,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (e.target.classList.contains("comment-edit-form")) {
      e.preventDefault();
      var cid = e.target.getAttribute("data-comment-id");
      var aid = e.target.getAttribute("data-announcement-id");
      var newBody = e.target.querySelector('[name="body"]').value.trim();
      if (!newBody) return;

      db.collection("announcements").doc(aid).collection("comments").doc(cid).update({
        body: newBody,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      editingCommentId = null;
    }
  });

  listEl.addEventListener("click", function (e) {
    var editBtn = e.target.closest("[data-edit-announcement]");
    var deleteBtn = e.target.closest("[data-delete-announcement]");
    var editCommentBtn = e.target.closest("[data-edit-comment]");
    var deleteCommentBtn = e.target.closest("[data-delete-comment]");
    var cancelCommentEdit = e.target.closest("[data-cancel-comment-edit]");

    if (editBtn) {
      openModal(
        editBtn.getAttribute("data-edit-announcement"),
        editBtn.getAttribute("data-title"),
        editBtn.getAttribute("data-body")
      );
    }

    if (deleteBtn) {
      if (window.confirm("Delete this announcement? This also removes its comments.")) {
        deleteAnnouncementCascade(deleteBtn.getAttribute("data-delete-announcement"));
      }
    }

    if (editCommentBtn) {
      editingCommentId = editCommentBtn.getAttribute("data-edit-comment");
      var announcementId = editCommentBtn.getAttribute("data-announcement-id");
      var container = document.getElementById("comments-" + announcementId);
      if (commentUnsubscribers[announcementId]) commentUnsubscribers[announcementId]();
      renderComments(announcementId, container);
    }

    if (deleteCommentBtn) {
      if (window.confirm("Delete this comment?")) {
        db.collection("announcements")
          .doc(deleteCommentBtn.getAttribute("data-announcement-id"))
          .collection("comments")
          .doc(deleteCommentBtn.getAttribute("data-delete-comment"))
          .delete();
      }
    }

    if (cancelCommentEdit) {
      editingCommentId = null;
      var formEl = cancelCommentEdit.closest("form");
      var announcementId2 = formEl.getAttribute("data-announcement-id");
      var container2 = document.getElementById("comments-" + announcementId2);
      if (commentUnsubscribers[announcementId2]) commentUnsubscribers[announcementId2]();
      renderComments(announcementId2, container2);
    }
  });

  function detachAllCommentListeners() {
    Object.keys(commentUnsubscribers).forEach(function (id) {
      commentUnsubscribers[id]();
    });
    commentUnsubscribers = {};
  }

  function startAnnouncementsListener() {
    db.collection("announcements")
      .orderBy("createdAt", "desc")
      .onSnapshot(function (snap) {
        detachAllCommentListeners();

        if (snap.empty) {
          listEl.innerHTML = '<p class="news-card__empty">No announcements yet — be the first to post one.</p>';
          return;
        }

        var html = "";
        snap.forEach(function (doc) {
          var a = doc.data();
          var isOwner = a.authorUid === currentUid;

          html +=
            '<article class="news-card">' +
            '<div class="news-card__meta">' +
            '<span class="news-card__author">' + escapeHtml(a.authorName) + "</span>" +
            '<span class="news-card__date">' + formatDate(a.createdAt) + "</span>" +
            "</div>" +
            '<div class="news-card__header">' +
            '<h3 class="news-card__title">' + escapeHtml(a.title) + "</h3>" +
            (isOwner
              ? '<div class="news-card__actions">' +
                '<button class="news-card__action-btn" type="button" data-edit-announcement="' + doc.id + '" data-title="' + escapeHtml(a.title) + '" data-body="' + escapeHtml(a.body) + '">Edit</button>' +
                '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-announcement="' + doc.id + '">Delete</button>' +
                "</div>"
              : "") +
            "</div>" +
            '<p class="news-card__text">' + escapeHtml(a.body) + "</p>" +
            '<div id="comments-' + doc.id + '"></div>' +
            "</article>";
        });

        listEl.innerHTML = html;

        snap.forEach(function (doc) {
          renderComments(doc.id, document.getElementById("comments-" + doc.id));
        });
      });
  }
})();
