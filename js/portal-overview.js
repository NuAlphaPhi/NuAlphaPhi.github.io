/* Overview tab: recent announcements, upcoming events, birthdays, profile nudge */
(function () {
  "use strict";

  var grid = document.getElementById("overviewGrid");
  if (!grid) return;

  var nudgeEl = document.getElementById("overviewNudge");

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  var announcementsCard = document.createElement("div");
  announcementsCard.className = "overview-card";
  announcementsCard.innerHTML = '<h2 class="overview-card__title">Recent Announcements</h2><div class="overview-card__list" id="overviewAnnouncements"></div>';

  var eventsCard = document.createElement("div");
  eventsCard.className = "overview-card";
  eventsCard.innerHTML = '<h2 class="overview-card__title">Upcoming Events</h2><div class="overview-card__list" id="overviewEvents"></div>';

  var birthdaysCard = document.createElement("div");
  birthdaysCard.className = "overview-card";
  birthdaysCard.innerHTML = '<h2 class="overview-card__title">Birthdays</h2><div class="overview-card__list" id="overviewBirthdays"></div>';

  grid.appendChild(announcementsCard);
  grid.appendChild(eventsCard);
  grid.appendChild(birthdaysCard);

  var announcementsListEl = document.getElementById("overviewAnnouncements");
  var eventsListEl = document.getElementById("overviewEvents");
  var birthdaysListEl = document.getElementById("overviewBirthdays");

  function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return "";
    return timestamp.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  db.collection("announcements")
    .orderBy("createdAt", "desc")
    .limit(3)
    .onSnapshot(function (snap) {
      if (snap.empty) {
        announcementsListEl.innerHTML = '<p class="overview-card__empty">No announcements yet.</p>';
        return;
      }
      announcementsListEl.innerHTML = snap.docs
        .map(function (doc) {
          var a = doc.data();
          return (
            '<div class="overview-card__item">' +
            '<p class="overview-card__item-title">' + escapeHtml(a.title) + "</p>" +
            '<p class="overview-card__item-meta">' + escapeHtml(a.authorName) + " · " + formatDate(a.createdAt) + "</p>" +
            "</div>"
          );
        })
        .join("");
    });

  db.collection("events")
    .orderBy("startAt", "asc")
    .limit(15)
    .onSnapshot(function (snap) {
      var now = new Date();
      var upcoming = snap.docs
        .map(function (doc) {
          return doc.data();
        })
        .filter(function (ev) {
          return ev.endAt.toDate() >= now;
        })
        .slice(0, 3);

      if (!upcoming.length) {
        eventsListEl.innerHTML = '<p class="overview-card__empty">Nothing on the calendar yet.</p>';
        return;
      }

      eventsListEl.innerHTML = upcoming
        .map(function (ev) {
          var start = ev.startAt.toDate();
          return (
            '<div class="overview-card__item">' +
            '<p class="overview-card__item-title">' + escapeHtml(ev.name) + "</p>" +
            '<p class="overview-card__item-meta">' + escapeHtml(ev.location) + " · " + start.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + "</p>" +
            "</div>"
          );
        })
        .join("");
    });

  function daysUntilNextBirthday(birthday, today) {
    var parts = birthday.split("-");
    var month = Number(parts[1]) - 1;
    var day = Number(parts[2]);
    var todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var next = new Date(today.getFullYear(), month, day);
    if (next < todayMidnight) next = new Date(today.getFullYear() + 1, month, day);
    return Math.round((next.getTime() - todayMidnight.getTime()) / 86400000);
  }

  db.collection("users").onSnapshot(function (snap) {
    var today = new Date();
    var upcoming = snap.docs
      .map(function (doc) {
        return Object.assign({ uid: doc.id }, doc.data());
      })
      .filter(function (b) {
        return !!b.birthday;
      })
      .map(function (b) {
        return { brother: b, days: daysUntilNextBirthday(b.birthday, today) };
      })
      .sort(function (a, b) {
        return a.days - b.days;
      })
      .slice(0, 3);

    if (!upcoming.length) {
      birthdaysListEl.innerHTML = '<p class="overview-card__empty">No birthdays on file yet.</p>';
      return;
    }

    birthdaysListEl.innerHTML = upcoming
      .map(function (entry) {
        var when = entry.days === 0 ? "Today" : entry.days === 1 ? "Tomorrow" : "In " + entry.days + " days";
        return (
          '<div class="overview-card__item">' +
          '<p class="overview-card__item-title">' + escapeHtml(window.napDisplayName(entry.brother, "Brother")) + "</p>" +
          '<p class="overview-card__item-meta">' + when + "</p>" +
          "</div>"
        );
      })
      .join("");
  });

  document.addEventListener("nap:auth-ready", function (e) {
    var profile = e.detail.profile || {};
    if (window.napIsProfileComplete(profile)) {
      nudgeEl.innerHTML = "";
      return;
    }
    nudgeEl.innerHTML =
      '<div class="overview-nudge">' +
      '<p class="overview-nudge__text">Your profile is missing some information — other bros won\'t be able to find you as easily.</p>' +
      '<button class="form-submit form-submit--small" id="overviewNudgeBtn" type="button">Complete My Profile</button>' +
      "</div>";
    document.getElementById("overviewNudgeBtn").addEventListener("click", function () {
      window.napSetTab("myinfo");
    });
  });
})();
