/* Notification bell: fires when someone comments on your announcement/event,
   lives in the sidebar next to the brother's name. */
(function () {
  "use strict";

  var bellBtn = document.getElementById("notificationBellBtn");
  var bellDot = document.getElementById("notificationBellDot");
  var dropdown = document.getElementById("notificationDropdown");
  var listEl = document.getElementById("notificationList");
  var clearAllBtn = document.getElementById("notificationClearAllBtn");
  if (!bellBtn) return;

  var currentUid = null;
  var allNotifications = [];
  var started = false;

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  window.napOnAuthReady(function (detail) {
    currentUid = detail.uid;
    if (!started) {
      started = true;
      startNotificationsListener();
    }
  });

  /* Called by portal-announcements.js / portal-events.js after a comment is
     posted on someone else's announcement or event. */
  window.napNotifyComment = function (opts) {
    opts = opts || {};
    if (!opts.recipientUid || opts.recipientUid === currentUid) return;

    db.collection("notifications").add({
      recipientUid: opts.recipientUid,
      actorUid: currentUid,
      actorName: window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother"),
      type: opts.type === "event" ? "event_comment" : "announcement_comment",
      postId: opts.postId,
      postTitle: opts.postTitle || "",
      commentId: opts.commentId,
      snippet: (opts.snippet || "").slice(0, 140),
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  };

  function renderBellDot() {
    var unreadCount = allNotifications.filter(function (n) {
      return !n.read;
    }).length;
    bellDot.hidden = unreadCount === 0;
  }

  function renderDropdown() {
    clearAllBtn.hidden = !allNotifications.length;

    if (!allNotifications.length) {
      listEl.innerHTML = '<p class="notification-dropdown__empty">No notifications yet.</p>';
      return;
    }

    listEl.innerHTML = allNotifications
      .map(function (n) {
        var isEvent = n.type === "event_comment";
        var when = n.createdAt && n.createdAt.toDate ? window.napTimeAgo(n.createdAt.toDate()) : "";
        return (
          '<div class="notification-item' + (n.read ? "" : " is-unread") + '" data-notification-id="' + n.id + '">' +
          '<button class="notification-item__body" type="button" ' +
          'data-post-type="' + (isEvent ? "event" : "announcement") + '" ' +
          'data-post-id="' + escapeHtml(n.postId) + '" data-comment-id="' + escapeHtml(n.commentId) + '">' +
          '<p class="notification-item__text"><strong>' + escapeHtml(n.actorName) + "</strong> commented on " +
          (isEvent ? "your event " : "your announcement ") +
          '“' + escapeHtml(n.postTitle) + '”: “' + escapeHtml(n.snippet) + '”</p>' +
          '<p class="notification-item__time">' + when + "</p>" +
          "</button>" +
          '<button class="notification-item__delete" type="button" data-delete-notification="' + n.id + '" aria-label="Delete notification">×</button>' +
          "</div>"
        );
      })
      .join("");
  }

  function markAllRead() {
    var unread = allNotifications.filter(function (n) {
      return !n.read;
    });
    if (!unread.length) return;
    var batch = db.batch();
    unread.forEach(function (n) {
      batch.update(db.collection("notifications").doc(n.id), { read: true });
    });
    batch.commit();
  }

  function positionDropdown() {
    var rect = bellBtn.getBoundingClientRect();
    var width = 320;
    var left = Math.min(rect.left, window.innerWidth - width - 16);
    left = Math.max(left, 16);
    dropdown.style.top = rect.bottom + 8 + "px";
    dropdown.style.left = left + "px";
  }

  function setDropdownOpen(open) {
    dropdown.hidden = !open;
    bellBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      positionDropdown();
      markAllRead();
    }
  }

  bellBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    setDropdownOpen(dropdown.hidden);
  });

  window.addEventListener("resize", function () {
    if (!dropdown.hidden) positionDropdown();
  });

  document.addEventListener("click", function (e) {
    if (dropdown.hidden) return;
    if (e.target.closest(".notification-bell") || e.target.closest(".notification-dropdown")) return;
    setDropdownOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !dropdown.hidden) setDropdownOpen(false);
  });

  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", function () {
      if (!allNotifications.length) return;
      if (!window.confirm("Clear all notifications?")) return;
      var batch = db.batch();
      allNotifications.forEach(function (n) {
        batch.delete(db.collection("notifications").doc(n.id));
      });
      batch.commit();
      setDropdownOpen(false);
    });
  }

  listEl.addEventListener("click", function (e) {
    var deleteBtn = e.target.closest("[data-delete-notification]");
    if (deleteBtn) {
      db.collection("notifications").doc(deleteBtn.getAttribute("data-delete-notification")).delete();
      return;
    }

    var body = e.target.closest(".notification-item__body");
    if (!body) return;
    var item = body.closest("[data-notification-id]");

    setDropdownOpen(false);

    var postType = body.getAttribute("data-post-type");
    var postId = body.getAttribute("data-post-id");
    var commentId = body.getAttribute("data-comment-id");

    if (postType === "event" && window.napOpenEvent) {
      window.napOpenEvent(postId, { switchTab: true, expandComments: true, commentId: commentId });
    } else if (postType === "announcement" && window.napGoToAnnouncementComment) {
      window.napGoToAnnouncementComment(postId, commentId);
    }

    db.collection("notifications").doc(item.getAttribute("data-notification-id")).delete();
  });

  function startNotificationsListener() {
    db.collection("notifications")
      .where("recipientUid", "==", currentUid)
      .orderBy("createdAt", "desc")
      .limit(30)
      .onSnapshot(function (snap) {
        allNotifications = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderBellDot();
        renderDropdown();
      });
  }
})();
