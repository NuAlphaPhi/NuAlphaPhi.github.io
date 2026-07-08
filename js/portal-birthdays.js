/* Upcoming birthdays across the brotherhood */
(function () {
  "use strict";

  var listEl = document.getElementById("birthdayList");
  if (!listEl) return;

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

    if (!withBirthdays.length) {
      listEl.innerHTML = '<p class="directory-empty">No birthdays on file yet.</p>';
      return;
    }

    listEl.innerHTML = withBirthdays
      .map(function (entry) {
        var isToday = entry.days === 0;
        var dateLabel = entry.nextDate.toLocaleDateString(undefined, { month: "long", day: "numeric" });
        var whenLabel = isToday
          ? "Today"
          : entry.days === 1
          ? "Tomorrow"
          : dateLabel + " · in " + entry.days + " days";

        return (
          '<div class="birthday-item' + (isToday ? " is-today" : "") + '">' +
          window.napAvatarHtml(entry.brother, "md") +
          '<div class="birthday-item__info">' +
          '<p class="birthday-item__name">' + escapeHtml(window.napDisplayName(entry.brother, "Brother")) + "</p>" +
          '<p class="birthday-item__date">' + whenLabel + " — turning " + entry.age + "</p>" +
          "</div>" +
          (isToday ? '<span class="birthday-item__badge">Today</span>' : "") +
          "</div>"
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
