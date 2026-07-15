/* Events + RSVPs + comments + detail popup, all live via Firestore onSnapshot */
(function () {
  "use strict";

  var listsContainer = document.getElementById("eventsListsContainer");
  if (!listsContainer) return;

  var subTabBtns = document.querySelectorAll("#eventsSubTabs [data-event-tab]");
  var listEl = document.getElementById("eventsUpcomingList");
  var completedListEl = document.getElementById("eventsCompletedList");
  var newEventBtn = document.getElementById("newEventBtn");
  var formModal = document.getElementById("modal-event-form");
  var form = document.getElementById("eventForm");
  var formModalTitle = document.getElementById("modal-event-title");
  var submitBtn = form ? form.querySelector(".form-submit") : null;
  var photoInput = document.getElementById("event-photo-input");
  var photoPreview = document.getElementById("eventPhotoPreview");

  var eventModal = document.getElementById("modal-event-view");
  var eventModalTitleEl = document.getElementById("event-modal-title");
  var eventModalBodyEl = document.getElementById("eventModalBody");

  var currentUid = null;
  var currentEventTab = "soon";
  var allEvents = [];
  var currentEditEventId = null;
  var pendingEventPhotoDataUrl = null;
  var rsvpMap = {};
  var rsvpUnsubscribers = {};

  var openEventId = null;
  var eventModalCommentsExpanded = false;
  var eventModalAddCommentOpen = false;
  var eventModalEditingCommentId = null;
  var eventModalCommentUnsub = null;
  var eventModalComments = [];
  var pendingHighlightCommentId = null;

  window.napOnAuthReady(function (detail) {
    currentUid = detail.uid;
    renderEventList();
    if (!started) {
      started = true;
      startEventsListener();
    }
  });

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function formatEventTime(ev) {
    var start = ev.startAt.toDate();
    var end = ev.endAt.toDate();
    var dateStr = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    var startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    var endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return dateStr + " · " + startTime + " – " + endTime;
  }

  function toDatetimeLocalValue(date) {
    return (
      date.getFullYear() +
      "-" + pad(date.getMonth() + 1) +
      "-" + pad(date.getDate()) +
      "T" + pad(date.getHours()) +
      ":" + pad(date.getMinutes())
    );
  }

  function renderPhotoPreview(el, url) {
    if (url) {
      el.innerHTML = '<div class="event-photo-preview"><img src="' + url + '" alt=""></div>';
    } else {
      el.innerHTML = '<div class="event-photo-preview">No photo</div>';
    }
  }

  if (photoInput) {
    photoInput.addEventListener("change", function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file) return;
      window.napResizeImageToDataUrlFit(file, 640, 400, function (dataUrl) {
        pendingEventPhotoDataUrl = dataUrl;
        renderPhotoPreview(photoPreview, dataUrl);
      });
    });
  }

  /* Sub-tabs: Events Soon / Completed Events */
  function setEventTab(tab) {
    currentEventTab = tab;
    subTabBtns.forEach(function (btn) {
      var active = btn.getAttribute("data-event-tab") === tab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    listEl.hidden = tab !== "soon";
    completedListEl.hidden = tab !== "completed";
  }

  subTabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setEventTab(btn.getAttribute("data-event-tab"));
    });
  });

  window.napSetEventTab = setEventTab;

  /* RSVP live lists */
  function attachRsvpListener(eventId) {
    if (rsvpUnsubscribers[eventId]) return;
    rsvpUnsubscribers[eventId] = db
      .collection("events")
      .doc(eventId)
      .collection("rsvps")
      .onSnapshot(function (snap) {
        var names = { going: [], maybe: [], not_going: [] };
        var mine = null;
        snap.forEach(function (doc) {
          var r = doc.data();
          if (names[r.status] !== undefined) names[r.status].push(r.name || "A brother");
          if (doc.id === currentUid) mine = r.status;
        });
        rsvpMap[eventId] = { names: names, mine: mine };
        renderEventList();
        if (openEventId === eventId) renderEventModal();
      });
  }

  function detachRsvpListener(eventId) {
    if (rsvpUnsubscribers[eventId]) {
      rsvpUnsubscribers[eventId]();
      delete rsvpUnsubscribers[eventId];
    }
    delete rsvpMap[eventId];
  }

  function setRsvp(eventId, status) {
    db.collection("events").doc(eventId).collection("rsvps").doc(currentUid).set(
      {
        uid: currentUid,
        name: window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother"),
        status: status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  function rsvpButtonsHtml(eventId, mine) {
    return ["going", "maybe", "not_going"]
      .map(function (status) {
        var label = status === "going" ? "Going" : status === "maybe" ? "Maybe" : "Not Going";
        var active = mine === status ? " is-active" : "";
        return (
          '<button class="rsvp-toggle__btn' + active + '" type="button" data-rsvp="' + status + '" data-event-id="' + eventId + '">' +
          label +
          "</button>"
        );
      })
      .join("");
  }

  function attendeesHtml(rsvp) {
    return [
      ["going", "Going"],
      ["maybe", "Maybe"],
      ["not_going", "Not Going"],
    ]
      .map(function (pair) {
        var names = rsvp.names[pair[0]];
        return (
          '<div class="rsvp-attendees__group">' +
          '<span class="rsvp-attendees__label">' + pair[1] + " (" + names.length + ")</span>" +
          '<span class="rsvp-attendees__names">' + (names.length ? escapeHtml(names.join(", ")) : "No one yet") + "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  /* Compact list cards — clicking anywhere on the card opens the detail popup */
  function renderEventCardCompact(ev) {
    var isOwner = ev.createdByUid === currentUid;
    var rsvp = rsvpMap[ev.id] || { names: { going: [], maybe: [], not_going: [] }, mine: null };
    var description = ev.description || "";
    var descPreview = description.length > 140 ? description.slice(0, 140).trim() + "…" : description;

    var html = '<article class="rsvp-event-card" data-open-event="' + ev.id + '">';

    if (ev.photoDataUrl) {
      html += '<img class="rsvp-event-card__photo" src="' + ev.photoDataUrl + '" alt="">';
    }

    html +=
      '<div class="rsvp-event-card__header">' +
      '<h3 class="rsvp-event-card__title">' + escapeHtml(ev.name) + "</h3>" +
      (isOwner
        ? '<div class="news-card__actions">' +
          '<button class="news-card__action-btn" type="button" data-edit-event="' + ev.id + '">Edit</button>' +
          '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-event="' + ev.id + '">Delete</button>' +
          "</div>"
        : "") +
      "</div>";

    html += '<p class="rsvp-event-card__meta">' + escapeHtml(ev.location) + " · " + formatEventTime(ev) + "</p>";

    if (descPreview) {
      html += '<p class="rsvp-event-card__desc-preview">' + escapeHtml(descPreview) + "</p>";
    }

    html +=
      '<div class="rsvp-event-card__footer">' +
      window.napAuthorBadgeHtml(ev.createdByUid, ev.createdByName) +
      '<div class="rsvp-toggle">' + rsvpButtonsHtml(ev.id, rsvp.mine) + "</div>" +
      "</div>";

    html +=
      '<p class="rsvp-event-card__summary">' +
      rsvp.names.going.length + " going · " + rsvp.names.maybe.length + " maybe — click for details &amp; comments" +
      "</p>";

    html += "</article>";
    return html;
  }

  function renderEventGroup(events, container) {
    if (!events.length) {
      container.innerHTML = '<p class="event-list__empty">No events to show.</p>';
      return;
    }
    container.innerHTML = events.map(renderEventCardCompact).join("");
  }

  function renderEventList() {
    var now = new Date();
    var soon = allEvents
      .filter(function (ev) {
        return ev.endAt.toDate() >= now;
      })
      .sort(function (a, b) {
        return a.startAt.toDate() - b.startAt.toDate();
      });
    var completed = allEvents
      .filter(function (ev) {
        return ev.endAt.toDate() < now;
      })
      .sort(function (a, b) {
        return b.startAt.toDate() - a.startAt.toDate();
      });

    renderEventGroup(soon, listEl);
    renderEventGroup(completed, completedListEl);
  }

  listsContainer.addEventListener("click", function (e) {
    var rsvpBtn = e.target.closest("[data-rsvp]");
    var editBtn = e.target.closest("[data-edit-event]");
    var deleteBtn = e.target.closest("[data-delete-event]");
    var profileBtn = e.target.closest("[data-open-profile]");
    var openBtn = e.target.closest("[data-open-event]");

    if (rsvpBtn) {
      setRsvp(rsvpBtn.getAttribute("data-event-id"), rsvpBtn.getAttribute("data-rsvp"));
      return;
    }

    if (editBtn) {
      var ev = allEvents.find(function (item) {
        return item.id === editBtn.getAttribute("data-edit-event");
      });
      if (ev) openEditModal(ev);
      return;
    }

    if (deleteBtn) {
      if (window.confirm("Delete this event? This also removes its RSVPs and comments.")) {
        deleteEventCascade(deleteBtn.getAttribute("data-delete-event"));
      }
      return;
    }

    if (profileBtn) return;

    if (openBtn) {
      openEventDetail(openBtn.getAttribute("data-open-event"));
    }
  });

  /* Detail popup */
  function attachEventModalCommentListener(eventId) {
    if (eventModalCommentUnsub) {
      eventModalCommentUnsub();
      eventModalCommentUnsub = null;
    }
    eventModalCommentUnsub = db
      .collection("events")
      .doc(eventId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .onSnapshot(function (snap) {
        eventModalComments = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderEventModal();
        if (pendingHighlightCommentId) {
          scrollToComment(pendingHighlightCommentId);
          pendingHighlightCommentId = null;
        }
      });
  }

  function scrollToComment(commentId) {
    window.requestAnimationFrame(function () {
      var el = document.getElementById("comment-" + commentId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("is-highlighted");
      window.setTimeout(function () {
        el.classList.remove("is-highlighted");
      }, 2500);
    });
  }

  function openEventDetail(eventId, opts) {
    opts = opts || {};
    openEventId = eventId;
    eventModalCommentsExpanded = !!opts.expandComments || !!opts.commentId;
    eventModalAddCommentOpen = false;
    eventModalEditingCommentId = null;
    pendingHighlightCommentId = opts.commentId || null;
    attachEventModalCommentListener(eventId);
    renderEventModal();
    eventModal.showModal();
  }

  window.napOpenEvent = function (eventId, opts) {
    opts = opts || {};
    if (opts.switchTab) {
      window.napSetTab("events");
      var ev = allEvents.find(function (item) {
        return item.id === eventId;
      });
      if (ev) {
        setEventTab(ev.endAt.toDate() < new Date() ? "completed" : "soon");
      }
    }
    openEventDetail(eventId, opts);
  };

  eventModal.addEventListener("close", function () {
    if (eventModalCommentUnsub) {
      eventModalCommentUnsub();
      eventModalCommentUnsub = null;
    }
    openEventId = null;
    eventModalComments = [];
  });

  function renderEventModal() {
    var ev = allEvents.find(function (item) {
      return item.id === openEventId;
    });
    if (!ev) {
      eventModal.close();
      return;
    }

    var isOwner = ev.createdByUid === currentUid;
    var rsvp = rsvpMap[ev.id] || { names: { going: [], maybe: [], not_going: [] }, mine: null };

    eventModalTitleEl.textContent = ev.name;

    var html = "";
    if (ev.photoDataUrl) {
      html += '<img class="event-modal__photo" src="' + ev.photoDataUrl + '" alt="">';
    }

    html += '<p class="event-modal__meta">' + escapeHtml(ev.location) + " · " + formatEventTime(ev) + "</p>";
    html += '<div class="event-modal__author">Created by ' + window.napAuthorBadgeHtml(ev.createdByUid, ev.createdByName) + "</div>";

    if (ev.description) {
      html += '<p class="event-modal__desc">' + escapeHtml(ev.description) + "</p>";
    }

    if (isOwner) {
      html +=
        '<div class="news-card__actions event-modal__owner-actions">' +
        '<button class="news-card__action-btn" type="button" data-edit-event="' + ev.id + '">Edit</button>' +
        '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-event="' + ev.id + '">Delete</button>' +
        "</div>";
    }

    html += '<div class="rsvp-toggle">' + rsvpButtonsHtml(ev.id, rsvp.mine) + "</div>";
    html += '<div class="rsvp-attendees">' + attendeesHtml(rsvp) + "</div>";

    html += window.napCommentsSectionHtml({
      comments: eventModalComments,
      currentUid: currentUid,
      expanded: eventModalCommentsExpanded,
      showAddForm: eventModalAddCommentOpen,
      editingCommentId: eventModalEditingCommentId,
    });

    eventModalBodyEl.innerHTML = html;
  }

  eventModalBodyEl.addEventListener("click", function (e) {
    var rsvpBtn = e.target.closest("[data-rsvp]");
    var editBtn = e.target.closest("[data-edit-event]");
    var deleteBtn = e.target.closest("[data-delete-event]");
    var profileBtn = e.target.closest("[data-open-profile]");
    var toggleShow = e.target.closest("[data-comments-toggle-show]");
    var toggleAdd = e.target.closest("[data-comments-toggle-add]");
    var editCommentBtn = e.target.closest("[data-comment-edit]");
    var deleteCommentBtn = e.target.closest("[data-comment-delete]");
    var cancelCommentEdit = e.target.closest("[data-cancel-comment-edit]");

    if (profileBtn) return;

    if (rsvpBtn) {
      setRsvp(rsvpBtn.getAttribute("data-event-id"), rsvpBtn.getAttribute("data-rsvp"));
      return;
    }

    if (editBtn) {
      var ev = allEvents.find(function (item) {
        return item.id === editBtn.getAttribute("data-edit-event");
      });
      if (ev) {
        eventModal.close();
        openEditModal(ev);
      }
      return;
    }

    if (deleteBtn) {
      if (window.confirm("Delete this event? This also removes its RSVPs and comments.")) {
        deleteEventCascade(deleteBtn.getAttribute("data-delete-event"));
        eventModal.close();
      }
      return;
    }

    if (toggleShow) {
      eventModalCommentsExpanded = !eventModalCommentsExpanded;
      renderEventModal();
      return;
    }

    if (toggleAdd) {
      eventModalAddCommentOpen = !eventModalAddCommentOpen;
      renderEventModal();
      return;
    }

    if (editCommentBtn) {
      eventModalEditingCommentId = editCommentBtn.getAttribute("data-comment-edit");
      renderEventModal();
      return;
    }

    if (deleteCommentBtn) {
      if (window.confirm("Delete this comment?")) {
        db.collection("events").doc(openEventId).collection("comments").doc(deleteCommentBtn.getAttribute("data-comment-delete")).delete();
      }
      return;
    }

    if (cancelCommentEdit) {
      eventModalEditingCommentId = null;
      renderEventModal();
    }
  });

  eventModalBodyEl.addEventListener("submit", function (e) {
    if (e.target.classList.contains("comment-add-form")) {
      e.preventDefault();
      var input = e.target.querySelector('[name="body"]');
      var body = input.value.trim();
      if (!body) return;

      var ev = allEvents.find(function (item) {
        return item.id === openEventId;
      });

      db.collection("events")
        .doc(openEventId)
        .collection("comments")
        .add({
          authorUid: currentUid,
          authorName: window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother"),
          body: body,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .then(function (docRef) {
          if (ev && window.napNotifyComment) {
            window.napNotifyComment({
              recipientUid: ev.createdByUid,
              type: "event",
              postId: openEventId,
              postTitle: ev.name,
              commentId: docRef.id,
              snippet: body,
            });
          }
        });

      eventModalAddCommentOpen = false;
    }

    if (e.target.classList.contains("comment-edit-form")) {
      e.preventDefault();
      var cid = e.target.getAttribute("data-comment-id");
      var newBody = e.target.querySelector('[name="body"]').value.trim();
      if (!newBody) return;

      db.collection("events").doc(openEventId).collection("comments").doc(cid).update({
        body: newBody,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      eventModalEditingCommentId = null;
    }
  });

  function deleteEventCascade(eventId) {
    var eventRef = db.collection("events").doc(eventId);
    Promise.all([eventRef.collection("rsvps").get(), eventRef.collection("comments").get()]).then(function (results) {
      var batch = db.batch();
      results[0].forEach(function (doc) {
        batch.delete(doc.ref);
      });
      results[1].forEach(function (doc) {
        batch.delete(doc.ref);
      });
      batch.delete(eventRef);
      return batch.commit();
    });
    detachRsvpListener(eventId);
  }

  /* Create / edit event modal */
  function openEditModal(ev) {
    currentEditEventId = ev ? ev.id : null;
    pendingEventPhotoDataUrl = null;
    formModalTitle.textContent = ev ? "Edit Event" : "New Event";
    submitBtn.textContent = ev ? "Save Changes" : "Create Event";
    form.querySelector('[name="name"]').value = ev ? ev.name : "";
    form.querySelector('[name="description"]').value = ev ? ev.description : "";
    form.querySelector('[name="location"]').value = ev ? ev.location : "";
    form.querySelector('[name="startAt"]').value = ev ? toDatetimeLocalValue(ev.startAt.toDate()) : "";
    form.querySelector('[name="endAt"]').value = ev ? toDatetimeLocalValue(ev.endAt.toDate()) : "";
    renderPhotoPreview(photoPreview, ev ? ev.photoDataUrl : null);
    formModal.showModal();
  }

  if (newEventBtn) {
    newEventBtn.addEventListener("click", function () {
      openEditModal(null);
    });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.querySelector('[name="name"]').value.trim();
      var description = form.querySelector('[name="description"]').value.trim();
      var location = form.querySelector('[name="location"]').value.trim();
      var startVal = form.querySelector('[name="startAt"]').value;
      var endVal = form.querySelector('[name="endAt"]').value;
      var errorEl = document.getElementById("event-form-error");

      if (!name || !location || !startVal || !endVal) return;

      var startDate = new Date(startVal);
      var endDate = new Date(endVal);

      if (endDate <= startDate) {
        if (errorEl) {
          errorEl.textContent = "End time must be after the start time.";
          errorEl.hidden = false;
        }
        return;
      }
      if (errorEl) errorEl.hidden = true;

      var payload = {
        name: name,
        description: description,
        location: location,
        startAt: firebase.firestore.Timestamp.fromDate(startDate),
        endAt: firebase.firestore.Timestamp.fromDate(endDate),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (pendingEventPhotoDataUrl !== null) {
        payload.photoDataUrl = pendingEventPhotoDataUrl;
      }

      var isEdit = !!currentEditEventId;
      var writePromise;
      window.napSaveButtonStart(submitBtn, isEdit ? "Saving…" : "Creating…");

      if (isEdit) {
        writePromise = db.collection("events").doc(currentEditEventId).update(payload);
      } else {
        payload.photoDataUrl = pendingEventPhotoDataUrl || "";
        payload.createdByUid = currentUid;
        payload.createdByName = window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother");
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        writePromise = db.collection("events").add(payload);
      }

      writePromise
        .then(function () {
          window.napSaveButtonDone(submitBtn, { savedLabel: "Saved" });
          window.setTimeout(function () {
            formModal.close();
          }, 550);
        })
        .catch(function () {
          window.napSaveButtonDone(submitBtn, { error: true });
          if (errorEl) {
            errorEl.textContent = "Something went wrong. Please try again.";
            errorEl.hidden = false;
          }
        });
    });
  }

  /* Live event feed */
  var started = false;
  function startEventsListener() {
    db.collection("events").onSnapshot(function (snap) {
      allEvents = snap.docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data());
      });

      var currentIds = allEvents.map(function (ev) {
        return ev.id;
      });
      Object.keys(rsvpUnsubscribers).forEach(function (id) {
        if (currentIds.indexOf(id) === -1) detachRsvpListener(id);
      });
      allEvents.forEach(function (ev) {
        attachRsvpListener(ev.id);
      });

      renderEventList();
      if (openEventId) renderEventModal();
    });
  }
})();
