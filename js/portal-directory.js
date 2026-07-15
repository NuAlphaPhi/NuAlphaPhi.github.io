/* Brother directory: search, filter, profile view modal */
(function () {
  "use strict";

  var grid = document.getElementById("directoryGrid");
  if (!grid) return;

  var searchInput = document.getElementById("directorySearch");
  var chapterFilter = document.getElementById("directoryChapterFilter");
  var classFilter = document.getElementById("directoryClassFilter");
  var modal = document.getElementById("modal-profile-view");
  var modalAvatar = document.getElementById("profileModalAvatar");
  var modalName = document.getElementById("profile-modal-name");
  var modalPledge = document.getElementById("profile-modal-pledge");
  var modalBio = document.getElementById("profile-modal-bio");
  var modalGrid = document.getElementById("profile-modal-grid");

  var allBrothers = [];

  window.NAP_CHAPTERS.forEach(function (chapter) {
    var opt = document.createElement("option");
    opt.value = chapter;
    opt.textContent = chapter;
    chapterFilter.appendChild(opt);
  });

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function formatBirthday(birthday) {
    if (!birthday) return "";
    var d = new Date(birthday + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }

  function populateClassFilter() {
    var classes = {};
    allBrothers.forEach(function (b) {
      if (b.pledgeClass) classes[b.pledgeClass] = true;
    });
    classFilter.innerHTML = '<option value="">All Classes</option>';
    Object.keys(classes)
      .sort()
      .forEach(function (cls) {
        var opt = document.createElement("option");
        opt.value = cls;
        opt.textContent = cls;
        classFilter.appendChild(opt);
      });
  }

  function matchesFilters(b) {
    var search = searchInput.value.trim().toLowerCase();
    var chapter = chapterFilter.value;
    var cls = classFilter.value;

    if (chapter && b.chapter !== chapter) return false;
    if (cls && b.pledgeClass !== cls) return false;

    if (search) {
      var fullName = (window.napFullName(b) || "").toLowerCase();
      var pledgeName = (b.pledgeName || "").toLowerCase();
      if (fullName.indexOf(search) === -1 && pledgeName.indexOf(search) === -1) return false;
    }

    return true;
  }

  function render() {
    var filtered = allBrothers.filter(matchesFilters);

    if (!filtered.length) {
      grid.innerHTML = '<p class="directory-empty">No brothers match your search.</p>';
      return;
    }

    grid.innerHTML = filtered
      .map(function (b) {
        return (
          '<button class="bro-card" type="button" data-uid="' + b.uid + '">' +
          window.napAvatarHtml(b, "md") +
          '<span>' +
          '<p class="bro-card__name">' + escapeHtml(window.napDisplayName(b, "Brother")) + "</p>" +
          '<p class="bro-card__meta">' + [escapeHtml(b.chapter), escapeHtml(b.pledgeClass)].filter(Boolean).join(" · ") + "</p>" +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function openProfile(b) {
    modalAvatar.innerHTML = window.napAvatarHtml(b, "xl");
    modalName.textContent = window.napFullName(b) || window.napDisplayName(b, "Brother");
    modalPledge.textContent = b.pledgeName ? '"' + b.pledgeName + '"' : "";

    if (b.bio) {
      modalBio.textContent = b.bio;
      modalBio.hidden = false;
    } else {
      modalBio.hidden = true;
    }

    var fields = [
      ["Pledge Number", b.pledgeNumber],
      ["Chapter", b.chapter],
      ["Class", b.pledgeClass],
      ["Crossed", window.napSemesterCrossed(b)],
      ["Birthday", formatBirthday(b.birthday)],
      ["Big", [b.bigName, b.bigPledgeName ? '"' + b.bigPledgeName + '"' : ""].filter(Boolean).join(" ")],
      ["Occupation", b.occupation],
      ["Major", b.major],
      ["Graduation Year", b.graduationYear],
      ["Hometown", b.hometown],
      ["Current Location", b.currentLocation],
      ["Phone", b.phone],
      ["Email", b.email],
      ["Instagram", b.instagram],
      ["Facebook", b.facebook],
      ["LinkedIn", b.linkedin],
    ];

    modalGrid.innerHTML = fields
      .filter(function (f) {
        return f[1];
      })
      .map(function (f) {
        return (
          '<div class="profile-modal__field">' +
          '<p class="profile-modal__field-label">' + f[0] + "</p>" +
          '<p class="profile-modal__field-value">' + escapeHtml(f[1]) + "</p>" +
          "</div>"
        );
      })
      .join("");

    modal.showModal();
  }

  grid.addEventListener("click", function (e) {
    var card = e.target.closest("[data-uid]");
    if (!card) return;
    var uid = card.getAttribute("data-uid");
    var brother = allBrothers.find(function (b) {
      return b.uid === uid;
    });
    if (brother) openProfile(brother);
  });

  searchInput.addEventListener("input", render);
  chapterFilter.addEventListener("change", render);
  classFilter.addEventListener("change", render);

  /* Shared with every other portal module: click anything with
     data-open-profile="<uid>" and it lands here. */
  window.napOpenProfileModal = function (uid) {
    var brother = window.napGetBrotherByUid(uid);
    if (brother) openProfile(brother);
  };

  function refreshFromCache() {
    allBrothers = window.NAP_ALL_BROTHERS;
    populateClassFilter();
    render();
  }

  window.napOnBrothersUpdated(refreshFromCache);
})();
