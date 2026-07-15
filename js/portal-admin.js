/* Admin tab: approval queue for announcements and events. Only admins see the
   tab (portal-auth.js reveals the nav button), and only admins' listeners run.
   Approving flips approved -> true and emails the brotherhood; rejecting
   deletes the request after a confirm. */
(function () {
  "use strict";

  var pendingAnnouncementsEl = document.getElementById("adminPendingAnnouncements");
  var pendingEventsEl = document.getElementById("adminPendingEvents");
  if (!pendingAnnouncementsEl || !pendingEventsEl) return;

  var pendingAnnouncements = [];
  var pendingEvents = [];
  var started = false;

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return "";
    return timestamp.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function sortKey(item) {
    return item.createdAt && item.createdAt.toMillis ? item.createdAt.toMillis() : 0;
  }

  function requestCardHtml(kind, id, title, authorUid, authorName, createdAt, detailHtml) {
    return (
      '<article class="news-card">' +
      '<div class="news-card__meta">' +
      window.napAuthorBadgeHtml(authorUid, authorName) +
      '<span class="news-card__date">' + formatDate(createdAt) + "</span>" +
      "</div>" +
      '<div class="news-card__header">' +
      '<h3 class="news-card__title">' + escapeHtml(title) + "</h3>" +
      '<div class="news-card__actions">' +
      '<button class="news-card__action-btn" type="button" data-approve-' + kind + '="' + id + '">Approve</button>' +
      '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-reject-' + kind + '="' + id + '">Reject</button>' +
      "</div>" +
      "</div>" +
      detailHtml +
      "</article>"
    );
  }

  function renderPending() {
    if (!pendingAnnouncements.length) {
      pendingAnnouncementsEl.innerHTML = '<p class="news-card__empty">No announcements waiting for approval.</p>';
    } else {
      pendingAnnouncementsEl.innerHTML = pendingAnnouncements
        .slice()
        .sort(function (a, b) {
          return sortKey(b) - sortKey(a);
        })
        .map(function (a) {
          return requestCardHtml(
            "announcement",
            a.id,
            a.title,
            a.authorUid,
            a.authorName,
            a.createdAt,
            '<p class="news-card__text">' + escapeHtml(a.body) + "</p>"
          );
        })
        .join("");
    }

    if (!pendingEvents.length) {
      pendingEventsEl.innerHTML = '<p class="news-card__empty">No events waiting for approval.</p>';
    } else {
      pendingEventsEl.innerHTML = pendingEvents
        .slice()
        .sort(function (a, b) {
          return sortKey(b) - sortKey(a);
        })
        .map(function (ev) {
          var when = ev.startAt && ev.startAt.toDate ? ev.startAt.toDate().toLocaleString() : "";
          var detail =
            '<p class="rsvp-event-card__meta">' + escapeHtml(ev.location) + (when ? " · " + escapeHtml(when) : "") + "</p>" +
            (ev.description ? '<p class="news-card__text">' + escapeHtml(ev.description) + "</p>" : "");
          return requestCardHtml("event", ev.id, ev.name, ev.createdByUid, ev.createdByName, ev.createdAt, detail);
        })
        .join("");
    }
  }

  function approveAnnouncement(id) {
    var a = pendingAnnouncements.find(function (item) {
      return item.id === id;
    });
    db.collection("announcements")
      .doc(id)
      .update({ approved: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
      .then(function () {
        if (a && window.napQueueBrotherhoodEmail) {
          window.napQueueBrotherhoodEmail(
            "New announcement: " + a.title,
            (a.authorName || "A brother") + " posted a new announcement:\n\n" + a.title + "\n\n" + a.body +
              "\n\nRead it in the portal: https://nualphaphi.com/portal-home"
          );
        }
      })
      .catch(function () {
        window.alert("Couldn't approve this announcement. Please try again.");
      });
  }

  function approveEvent(id) {
    var ev = pendingEvents.find(function (item) {
      return item.id === id;
    });
    db.collection("events")
      .doc(id)
      .update({ approved: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
      .then(function () {
        if (ev && window.napQueueBrotherhoodEmail) {
          var when = ev.startAt && ev.startAt.toDate ? ev.startAt.toDate().toLocaleString() : "";
          window.napQueueBrotherhoodEmail(
            "New event: " + ev.name,
            (ev.createdByName || "A brother") + " posted a new event:\n\n" + ev.name + "\n" + ev.location + (when ? " · " + when : "") +
              (ev.description ? "\n\n" + ev.description : "") +
              "\n\nRSVP in the portal: https://nualphaphi.com/portal-home"
          );
        }
      })
      .catch(function () {
        window.alert("Couldn't approve this event. Please try again.");
      });
  }

  document.getElementById("panel-admin").addEventListener("click", function (e) {
    var approveAnnouncementBtn = e.target.closest("[data-approve-announcement]");
    var rejectAnnouncementBtn = e.target.closest("[data-reject-announcement]");
    var approveEventBtn = e.target.closest("[data-approve-event]");
    var rejectEventBtn = e.target.closest("[data-reject-event]");

    if (approveAnnouncementBtn) {
      approveAnnouncement(approveAnnouncementBtn.getAttribute("data-approve-announcement"));
      return;
    }
    if (rejectAnnouncementBtn) {
      var announcementId = rejectAnnouncementBtn.getAttribute("data-reject-announcement");
      window.napConfirm("The request will be deleted and the author will not be notified.", { title: "Reject this announcement?", confirmLabel: "Reject" }).then(function (confirmed) {
        if (confirmed) db.collection("announcements").doc(announcementId).delete();
      });
      return;
    }
    if (approveEventBtn) {
      approveEvent(approveEventBtn.getAttribute("data-approve-event"));
      return;
    }
    if (rejectEventBtn) {
      var eventId = rejectEventBtn.getAttribute("data-reject-event");
      window.napConfirm("The request will be deleted and the author will not be notified.", { title: "Reject this event?", confirmLabel: "Reject" }).then(function (confirmed) {
        if (confirmed) db.collection("events").doc(eventId).delete();
      });
    }
  });

  /* Also called by the Settings admin-code form, so the queue starts working
     the moment someone activates admin without needing a page refresh. */
  window.napStartAdminListeners = function () {
    if (started || !window.napIsAdmin()) return;
    started = true;

    db.collection("announcements")
      .where("approved", "==", false)
      .onSnapshot(function (snap) {
        pendingAnnouncements = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderPending();
      });

    db.collection("events")
      .where("approved", "==", false)
      .onSnapshot(function (snap) {
        pendingEvents = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderPending();
      });
  };

  window.napOnAuthReady(function () {
    window.napStartAdminListeners();
  });
})();
