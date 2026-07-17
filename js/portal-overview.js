/* Overview tab: recent announcements, upcoming events, birthdays, profile nudge */
(function () {
  "use strict";

  var grid = document.getElementById("overviewGrid");
  if (!grid) return;

  var nudgeEl = document.getElementById("overviewNudge");
  var statsEl = document.getElementById("overviewStats");

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

  var chaptersCard = document.createElement("div");
  chaptersCard.className = "overview-card";
  chaptersCard.innerHTML = '<h2 class="overview-card__title">Chapters</h2><div class="chapter-bars" id="overviewChapters"></div>';

  grid.appendChild(announcementsCard);
  grid.appendChild(eventsCard);
  grid.appendChild(birthdaysCard);
  grid.appendChild(chaptersCard);

  var announcementsListEl = document.getElementById("overviewAnnouncements");
  var eventsListEl = document.getElementById("overviewEvents");
  var birthdaysListEl = document.getElementById("overviewBirthdays");
  var chaptersListEl = document.getElementById("overviewChapters");

  /* Stats tiles pull from whichever of the three listeners below last
     reported in — each updates its own slice and re-renders the row. */
  var stats = { brothers: null, chapters: null, upcomingEvents: null, birthdaysThisMonth: null };

  function renderStats() {
    if (!statsEl) return;
    var tiles = [
      ["Active Brothers", stats.brothers],
      ["Chapters Active", stats.chapters],
      ["Upcoming Events", stats.upcomingEvents],
      ["Birthdays This Month", stats.birthdaysThisMonth],
    ];
    statsEl.innerHTML = tiles
      .map(function (t) {
        return (
          '<div class="stat-tile">' +
          '<p class="stat-tile__value">' + (t[1] === null ? "—" : t[1]) + "</p>" +
          '<p class="stat-tile__label">' + t[0] + "</p>" +
          "</div>"
        );
      })
      .join("");
  }
  renderStats();

  function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return "";
    return timestamp.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* Fetch a few extra beyond the 3 shown so that filtering out pending
     (unapproved) posts still leaves a full list. */
  db.collection("announcements")
    .orderBy("createdAt", "desc")
    .limit(10)
    .onSnapshot(function (snap) {
      var recent = snap.docs
        .map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        })
        .filter(function (a) {
          return a.approved !== false;
        })
        .slice(0, 3);

      if (!recent.length) {
        announcementsListEl.innerHTML = '<p class="overview-card__empty">No announcements yet.</p>';
        return;
      }
      announcementsListEl.innerHTML = recent
        .map(function (a) {
          return (
            '<button class="overview-card__item overview-card__item--clickable" type="button" data-open-announcement="' + a.id + '">' +
            '<p class="overview-card__item-title">' + escapeHtml(a.title) + "</p>" +
            '<p class="overview-card__item-meta">' + escapeHtml(a.authorName) + " · " + formatDate(a.createdAt) + "</p>" +
            "</button>"
          );
        })
        .join("");
    });

  announcementsListEl.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-open-announcement]");
    if (!trigger || !window.napOpenAnnouncement) return;
    window.napOpenAnnouncement(trigger.getAttribute("data-open-announcement"));
  });

  db.collection("events")
    .orderBy("startAt", "asc")
    .limit(15)
    .onSnapshot(function (snap) {
      var now = new Date();
      var upcomingAll = snap.docs
        .map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        })
        .filter(function (ev) {
          return ev.endAt.toDate() >= now && ev.approved !== false;
        });

      stats.upcomingEvents = upcomingAll.length;
      renderStats();

      var upcoming = upcomingAll.slice(0, 3);

      if (!upcoming.length) {
        eventsListEl.innerHTML = '<p class="overview-card__empty">Nothing on the calendar yet.</p>';
        return;
      }

      eventsListEl.innerHTML = upcoming
        .map(function (ev) {
          var start = ev.startAt.toDate();
          return (
            '<button class="overview-card__item overview-card__item--clickable" type="button" data-open-event="' + ev.id + '">' +
            '<p class="overview-card__item-title">' + escapeHtml(ev.name) + "</p>" +
            '<p class="overview-card__item-meta">' + escapeHtml(ev.location) + " · " + start.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + "</p>" +
            "</button>"
          );
        })
        .join("");
    });

  eventsListEl.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-open-event]");
    if (!trigger || !window.napOpenEvent) return;
    window.napOpenEvent(trigger.getAttribute("data-open-event"));
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
    var allBrothers = snap.docs
      .map(function (doc) {
        return Object.assign({ uid: doc.id }, doc.data());
      })
      .filter(function (b) {
        return b.disabled !== true;
      });

    stats.brothers = allBrothers.length;
    stats.birthdaysThisMonth = allBrothers.filter(function (b) {
      return !!b.birthday && Number(b.birthday.split("-")[1]) - 1 === today.getMonth();
    }).length;

    var chapterCounts = window.NAP_CHAPTERS.map(function (chapter) {
      return {
        chapter: chapter,
        count: allBrothers.filter(function (b) {
          return b.chapter === chapter;
        }).length,
      };
    }).filter(function (c) {
      return c.count > 0;
    });
    stats.chapters = chapterCounts.length;
    renderStats();

    if (chaptersListEl) {
      if (!chapterCounts.length) {
        chaptersListEl.innerHTML = '<p class="overview-card__empty">No chapter data yet.</p>';
      } else {
        var maxCount = Math.max.apply(null, chapterCounts.map(function (c) { return c.count; }));
        chaptersListEl.innerHTML = chapterCounts
          .map(function (c) {
            var pct = Math.round((c.count / maxCount) * 100);
            return (
              '<div>' +
              '<div class="chapter-bar__row">' +
              '<span class="chapter-bar__name">' + escapeHtml(c.chapter) + "</span>" +
              '<span class="chapter-bar__count">' + c.count + "</span>" +
              "</div>" +
              '<div class="chapter-bar__track"><div class="chapter-bar__fill" style="width:' + pct + '%"></div></div>' +
              "</div>"
            );
          })
          .join("");
      }
    }

    var upcoming = allBrothers
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
        var metaParts = [when];
        if (entry.brother.chapter) metaParts.push(entry.brother.chapter);
        var crossed = window.napSemesterCrossed(entry.brother);
        if (crossed) metaParts.push(crossed);
        return (
          '<button class="overview-card__item overview-card__item--clickable overview-card__item--birthday" type="button" data-open-profile="' + escapeHtml(entry.brother.uid) + '">' +
          window.napAvatarHtml(entry.brother, "sm") +
          '<span>' +
          '<p class="overview-card__item-title">' + escapeHtml(window.napDisplayName(entry.brother, "Brother")) + "</p>" +
          '<p class="overview-card__item-meta">' + escapeHtml(metaParts.join(" · ")) + "</p>" +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  });

  window.napOnAuthReady(function (detail) {
    var profile = detail.profile || {};
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
