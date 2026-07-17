/* Upcoming birthdays across the brotherhood */
(function () {
  "use strict";

  var listEl = document.getElementById("birthdayList");
  if (!listEl) return;

  var statsEl = document.getElementById("birthdayStats");

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function daysUntilNextBirthday(birthday, today) {
    var parts = birthday.split("-");
    var month = Number(parts[1]) - 1;
    var day = Number(parts[2]);
    var todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var next = new Date(today.getFullYear(), month, day);
    if (next < todayMidnight) next = new Date(today.getFullYear() + 1, month, day);
    var diffMs = next.getTime() - todayMidnight.getTime();
    return { days: Math.round(diffMs / 86400000), nextDate: next };
  }

  function turningAge(birthday, nextDate) {
    var birthYear = Number(birthday.split("-")[0]);
    return nextDate.getFullYear() - birthYear;
  }

  function render(brothers) {
    var today = new Date();

    var withBirthdays = brothers
      .filter(function (b) {
        return !!b.birthday;
      })
      .map(function (b) {
        var info = daysUntilNextBirthday(b.birthday, today);
        return {
          brother: b,
          days: info.days,
          nextDate: info.nextDate,
          age: turningAge(b.birthday, info.nextDate),
        };
      })
      .sort(function (a, b) {
        return a.days - b.days;
      });

    if (statsEl) {
      var thisWeek = withBirthdays.filter(function (e) { return e.days <= 6; }).length;
      var thisMonth = withBirthdays.filter(function (e) { return e.nextDate.getMonth() === today.getMonth(); }).length;
      var tiles = [
        ["This Week", thisWeek],
        ["This Month", thisMonth],
        ["Total on File", withBirthdays.length],
      ];
      statsEl.innerHTML = tiles
        .map(function (t) {
          return (
            '<div class="stat-tile">' +
            '<p class="stat-tile__value">' + t[1] + "</p>" +
            '<p class="stat-tile__label">' + t[0] + "</p>" +
            "</div>"
          );
        })
        .join("");
    }

    if (!withBirthdays.length) {
      listEl.innerHTML = '<p class="directory-empty">No birthdays on file yet.</p>';
      return;
    }

    var lastMonth = null;
    listEl.innerHTML = withBirthdays
      .map(function (entry) {
        var isToday = entry.days === 0;
        var dateLabel = entry.nextDate.toLocaleDateString(undefined, { month: "long", day: "numeric" });
        var whenLabel = isToday
          ? "Today"
          : entry.days === 1
          ? "Tomorrow"
          : dateLabel + " · in " + entry.days + " days";

        var metaParts = [];
        if (entry.brother.chapter) metaParts.push(entry.brother.chapter);
        var crossed = window.napSemesterCrossed(entry.brother);
        if (crossed) metaParts.push(crossed);

        var monthLabel = entry.nextDate.toLocaleDateString(undefined, { month: "long" });
        var heading = "";
        if (monthLabel !== lastMonth) {
          heading = '<h3 class="birthday-month-heading">' + escapeHtml(monthLabel) + "</h3>";
          lastMonth = monthLabel;
        }

        return (
          heading +
          '<button class="birthday-item' + (isToday ? " is-today" : "") + '" type="button" data-open-profile="' + escapeHtml(entry.brother.uid) + '">' +
          window.napAvatarHtml(entry.brother, "md") +
          '<div class="birthday-item__info">' +
          '<p class="birthday-item__name">' + escapeHtml(window.napDisplayName(entry.brother, "Brother")) + "</p>" +
          '<p class="birthday-item__date">' + whenLabel + " — turning " + entry.age + "</p>" +
          (metaParts.length ? '<p class="birthday-item__meta">' + escapeHtml(metaParts.join(" · ")) + "</p>" : "") +
          "</div>" +
          (isToday ? '<span class="birthday-item__badge">Today</span>' : "") +
          "</button>"
        );
      })
      .join("");
  }

  db.collection("users").onSnapshot(function (snap) {
    var brothers = snap.docs.map(function (doc) {
      return Object.assign({ uid: doc.id }, doc.data());
    });
    render(brothers);
  });
})();
