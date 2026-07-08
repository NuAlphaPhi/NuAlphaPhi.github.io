/* Events + RSVPs + comments + hand-rolled calendar, all live via Firestore onSnapshot */
(function () {
  "use strict";

  var calendarEl = document.querySelector(".event-calendar");
  if (!calendarEl) return;

  var monthLabelEl = document.getElementById("eventCalendarMonthLabel");
  var weekdaysEl = document.getElementById("eventCalendarWeekdays");
  var gridEl = document.getElementById("eventCalendarGrid");
  var prevBtn = document.getElementById("eventCalendarPrevBtn");
  var nextBtn = document.getElementById("eventCalendarNextBtn");
  var listsContainer = document.getElementById("eventsListsContainer");
  var listEl = document.getElementById("eventsUpcomingList");
  var completedListEl = document.getElementById("eventsCompletedList");
  var completedHeadingEl = document.getElementById("completedEventsHeading");
  var listHeadingEl = document.getElementById("eventListHeading");
  var clearFilterBtn = document.getElementById("clearDayFilterBtn");
  var newEventBtn = document.getElementById("newEventBtn");
  var modal = document.getElementById("modal-event-form");
  var form = document.getElementById("eventForm");
  var modalTitle = document.getElementById("modal-event-title");
  var submitBtn = form ? form.querySelector(".form-submit") : null;
  var photoInput = document.getElementById("event-photo-input");
  var photoPreview = document.getElementById("eventPhotoPreview");

  var currentUid = null;
  var currentMonthDate = new Date();
  currentMonthDate.setDate(1);
  var selectedDayKey = null;
  var allEvents = [];
  var currentEditEventId = null;
  var pendingEventPhotoDataUrl = null;
  var rsvpMap = {};
  var rsvpUnsubscribers = {};
  var expandedEventIds = {};
  var commentUnsubscribers = {};
  var editingEventCommentId = null;

  document.addEventListener("nap:auth-ready", function (e) {
    currentUid = e.detail.uid;
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

  function dateKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
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

  /* Calendar */
  function renderCalendar() {
    monthLabelEl.textContent = currentMonthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    weekdaysEl.innerHTML = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .map(function (d) {
        return '<span class="event-calendar__weekday">' + d + "</span>";
      })
      .join("");

    var eventsByDate = {};
    allEvents.forEach(function (ev) {
      var key = dateKey(ev.startAt.toDate());
      if (!eventsByDate[key]) eventsByDate[key] = 0;
      eventsByDate[key]++;
    });

    var year = currentMonthDate.getFullYear();
    var month = currentMonthDate.getMonth();
    var firstOfMonth = new Date(year, month, 1);
    var startOffset = firstOfMonth.getDay();
    var gridStart = new Date(year, month, 1 - startOffset);
    var today = new Date();
    var todayKey = dateKey(today);

    var html = "";
    for (var i = 0; i < 42; i++) {
      var cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      var key = dateKey(cellDate);
      var classes = ["event-calendar__day"];
      if (cellDate.getMonth() !== month) classes.push("is-other-month");
      if (key === todayKey) classes.push("is-today");
      if (key === selectedDayKey) classes.push("is-selected");
      if (eventsByDate[key]) classes.push("has-events");

      html +=
        '<button type="button" class="' + classes.join(" ") + '" data-date-key="' + key + '">' +
        '<span class="event-calendar__day-num">' + cellDate.getDate() + "</span>" +
        (eventsByDate[key] ? '<span class="event-calendar__dot"></span>' : "") +
        "</button>";
    }
    gridEl.innerHTML = html;
  }

  gridEl.addEventListener("click", function (e) {
    var cell = e.target.closest("[data-date-key]");
    if (!cell) return;
    var key = cell.getAttribute("data-date-key");
    selectedDayKey = selectedDayKey === key ? null : key;
    renderCalendar();
    renderEventList();
  });

  prevBtn.addEventListener("click", function () {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    renderCalendar();
  });

  nextBtn.addEventListener("click", function () {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    renderCalendar();
  });

  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", function () {
      selectedDayKey = null;
      renderCalendar();
      renderEventList();
    });
  }

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

  /* Comments */
  function detachCommentListener(eventId) {
    if (commentUnsubscribers[eventId]) {
      commentUnsubscribers[eventId]();
      delete commentUnsubscribers[eventId];
    }
  }

  function renderEventComments(eventId, container) {
    if (!container) return;
    var commentsRef = db.collection("events").doc(eventId).collection("comments").orderBy("createdAt", "asc");

    commentUnsubscribers[eventId] = commentsRef.onSnapshot(function (snap) {
      var html = '<div class="comment-list">';
      snap.forEach(function (doc) {
        var c = doc.data();
        var isOwner = c.authorUid === currentUid;

        if (editingEventCommentId === doc.id) {
          html +=
            '<div class="comment-item">' +
            '<form class="event-comment-edit-form" data-comment-id="' + doc.id + '" data-event-id="' + eventId + '" style="display:flex;gap:0.5rem;">' +
            '<input class="form-input" name="body" value="' + escapeHtml(c.body) + '" required>' +
            '<button class="form-submit form-submit--small" type="submit">Save</button>' +
            '<button class="news-card__action-btn" type="button" data-cancel-event-comment-edit>Cancel</button>' +
            "</form></div>";
        } else {
          html +=
            '<div class="comment-item">' +
            '<div class="comment-item__meta">' +
            '<span class="comment-item__author">' + escapeHtml(c.authorName) + "</span>" +
            (isOwner
              ? '<span class="comment-item__actions">' +
                '<button class="news-card__action-btn" type="button" data-edit-event-comment="' + doc.id + '" data-event-id="' + eventId + '">Edit</button>' +
                '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-event-comment="' + doc.id + '" data-event-id="' + eventId + '">Delete</button>' +
                "</span>"
              : "") +
            "</div>" +
            '<p class="comment-item__text">' + escapeHtml(c.body) + "</p>" +
            "</div>";
        }
      });
      html += "</div>";
      html +=
        '<form class="event-comment-form" data-event-id="' + eventId + '">' +
        '<input class="form-input" name="body" placeholder="Ask a question or add a comment…" required>' +
        '<button class="form-submit form-submit--small" type="submit">Comment</button>' +
        "</form>";

      container.innerHTML = html;
    });
  }

  /* Event list rendering */
  function renderEventCard(ev) {
    var isOwner = ev.createdByUid === currentUid;
    var rsvp = rsvpMap[ev.id] || { names: { going: [], maybe: [], not_going: [] }, mine: null };
    var expanded = !!expandedEventIds[ev.id];

    var html = '<article class="rsvp-event-card' + (expanded ? " is-expanded" : "") + '">';

    if (ev.photoDataUrl) {
      html += '<img class="rsvp-event-card__photo" src="' + ev.photoDataUrl + '" alt="">';
    }

    html +=
      '<div class="rsvp-event-card__header">' +
      '<button class="rsvp-event-card__title-btn" type="button" data-toggle-expand="' + ev.id + '">' +
      '<h3 class="rsvp-event-card__title">' + escapeHtml(ev.name) + "</h3>" +
      "</button>" +
      (isOwner
        ? '<div class="news-card__actions">' +
          '<button class="news-card__action-btn" type="button" data-edit-event="' + ev.id + '">Edit</button>' +
          '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-event="' + ev.id + '">Delete</button>' +
          "</div>"
        : "") +
      "</div>";

    html += '<p class="rsvp-event-card__meta">' + escapeHtml(ev.location) + " · " + formatEventTime(ev) + "</p>";

    if (expanded) {
      html += '<p class="rsvp-event-card__desc">' + escapeHtml(ev.description) + "</p>";
    }

    html +=
      '<div class="rsvp-toggle">' +
      ["going", "maybe", "not_going"]
        .map(function (status) {
          var label = status === "going" ? "Going" : status === "maybe" ? "Maybe" : "Not Going";
          var active = rsvp.mine === status ? " is-active" : "";
          return (
            '<button class="rsvp-toggle__btn' + active + '" type="button" data-rsvp="' + status + '" data-event-id="' + ev.id + '">' +
            label +
            "</button>"
          );
        })
        .join("") +
      "</div>";

    if (expanded) {
      html +=
        '<div class="rsvp-attendees">' +
        [
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
          .join("") +
        "</div>" +
        '<div id="comments-event-' + ev.id + '"></div>';
    } else {
      var goingCount = rsvp.names.going.length;
      var maybeCount = rsvp.names.maybe.length;
      html += '<p class="rsvp-event-card__summary">' + goingCount + " going · " + maybeCount + " maybe — click the title for details &amp; comments</p>";
    }

    html += "</article>";
    return html;
  }

  function renderEventGroup(events, container) {
    if (!events.length) {
      container.innerHTML = '<p class="event-list__empty">No events to show.</p>';
      return;
    }
    container.innerHTML = events.map(renderEventCard).join("");
    events.forEach(function (ev) {
      if (expandedEventIds[ev.id]) {
        renderEventComments(ev.id, document.getElementById("comments-event-" + ev.id));
      } else {
        detachCommentListener(ev.id);
      }
    });
  }

  function renderEventList() {
    if (selectedDayKey) {
      var dayEvents = allEvents.filter(function (ev) {
        return dateKey(ev.startAt.toDate()) === selectedDayKey;
      });
      listHeadingEl.querySelector(".portal-view-title").textContent =
        "Events on " + new Date(selectedDayKey + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric" });
      clearFilterBtn.hidden = false;
      completedHeadingEl.hidden = true;
      completedListEl.hidden = true;
      renderEventGroup(dayEvents, listEl);
      return;
    }

    clearFilterBtn.hidden = true;
    completedHeadingEl.hidden = false;
    completedListEl.hidden = false;
    listHeadingEl.querySelector(".portal-view-title").textContent = "Events Soon";

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
    var expandBtn = e.target.closest("[data-toggle-expand]");
    var rsvpBtn = e.target.closest("[data-rsvp]");
    var editBtn = e.target.closest("[data-edit-event]");
    var deleteBtn = e.target.closest("[data-delete-event]");
    var editCommentBtn = e.target.closest("[data-edit-event-comment]");
    var deleteCommentBtn = e.target.closest("[data-delete-event-comment]");
    var cancelCommentEdit = e.target.closest("[data-cancel-event-comment-edit]");

    if (expandBtn) {
      var id = expandBtn.getAttribute("data-toggle-expand");
      expandedEventIds[id] = !expandedEventIds[id];
      renderEventList();
    }

    if (rsvpBtn) {
      setRsvp(rsvpBtn.getAttribute("data-event-id"), rsvpBtn.getAttribute("data-rsvp"));
    }

    if (editBtn) {
      var ev = allEvents.find(function (item) {
        return item.id === editBtn.getAttribute("data-edit-event");
      });
      if (ev) openModal(ev);
    }

    if (deleteBtn) {
      if (window.confirm("Delete this event? This also removes its RSVPs and comments.")) {
        deleteEventCascade(deleteBtn.getAttribute("data-delete-event"));
      }
    }

    if (editCommentBtn) {
      editingEventCommentId = editCommentBtn.getAttribute("data-edit-event-comment");
      var eventId = editCommentBtn.getAttribute("data-event-id");
      renderEventComments(eventId, document.getElementById("comments-event-" + eventId));
    }

    if (deleteCommentBtn) {
      if (window.confirm("Delete this comment?")) {
        db.collection("events")
          .doc(deleteCommentBtn.getAttribute("data-event-id"))
          .collection("comments")
          .doc(deleteCommentBtn.getAttribute("data-delete-event-comment"))
          .delete();
      }
    }

    if (cancelCommentEdit) {
      editingEventCommentId = null;
      var formEl = cancelCommentEdit.closest("form");
      var eventId2 = formEl.getAttribute("data-event-id");
      renderEventComments(eventId2, document.getElementById("comments-event-" + eventId2));
    }
  });

  listsContainer.addEventListener("submit", function (e) {
    if (e.target.classList.contains("event-comment-form")) {
      e.preventDefault();
      var eventId = e.target.getAttribute("data-event-id");
      var input = e.target.querySelector('[name="body"]');
      var body = input.value.trim();
      if (!body) return;

      db.collection("events").doc(eventId).collection("comments").add({
        authorUid: currentUid,
        authorName: window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother"),
        body: body,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (e.target.classList.contains("event-comment-edit-form")) {
      e.preventDefault();
      var cid = e.target.getAttribute("data-comment-id");
      var eid = e.target.getAttribute("data-event-id");
      var newBody = e.target.querySelector('[name="body"]').value.trim();
      if (!newBody) return;

      db.collection("events").doc(eid).collection("comments").doc(cid).update({
        body: newBody,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      editingEventCommentId = null;
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
    detachCommentListener(eventId);
  }

  /* Create / edit event modal */
  function openModal(ev) {
    currentEditEventId = ev ? ev.id : null;
    pendingEventPhotoDataUrl = null;
    modalTitle.textContent = ev ? "Edit Event" : "New Event";
    submitBtn.textContent = ev ? "Save Changes" : "Create Event";
    form.querySelector('[name="name"]').value = ev ? ev.name : "";
    form.querySelector('[name="description"]').value = ev ? ev.description : "";
    form.querySelector('[name="location"]').value = ev ? ev.location : "";
    form.querySelector('[name="startAt"]').value = ev ? toDatetimeLocalValue(ev.startAt.toDate()) : "";
    form.querySelector('[name="endAt"]').value = ev ? toDatetimeLocalValue(ev.endAt.toDate()) : "";
    renderPhotoPreview(photoPreview, ev ? ev.photoDataUrl : null);
    modal.showModal();
  }

  if (newEventBtn) {
    newEventBtn.addEventListener("click", function () {
      openModal(null);
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

      if (currentEditEventId) {
        db.collection("events").doc(currentEditEventId).update(payload);
      } else {
        payload.photoDataUrl = pendingEventPhotoDataUrl || "";
        payload.createdByUid = currentUid;
        payload.createdByName = window.napDisplayName(window.NAP_CURRENT_PROFILE, "A brother");
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        db.collection("events").add(payload);
      }

      modal.close();
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

      renderCalendar();
      renderEventList();
    });
  }

  renderCalendar();
})();
