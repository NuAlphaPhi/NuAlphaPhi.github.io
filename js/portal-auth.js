/* Shared auth guard for portal-home.html */
(function () {
  "use strict";

  var portalApp = document.getElementById("portal-app");
  var portalPledgeName = document.getElementById("portalPledgeName");
  var portalUserAvatar = document.getElementById("portalUserAvatar");
  var portalSignOut = document.getElementById("portalSignOut");

  window.NAP_CHAPTERS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa"];

  window.napDisplayName = function (profile, fallback) {
    if (!profile) return fallback || "";
    return profile.pledgeName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || fallback || "";
  };

  window.napFullName = function (profile) {
    if (!profile) return "";
    return [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  };

  window.napSemesterCrossed = function (profile) {
    if (!profile || !profile.semesterCrossed) return "";
    return [profile.semesterCrossed, profile.yearCrossed].filter(Boolean).join(" ");
  };

  window.napAvatarHtml = function (profile, size) {
    profile = profile || {};
    var sizeClass = "nap-avatar--" + (size || "md");
    if (profile.photoDataUrl) {
      return '<img class="nap-avatar ' + sizeClass + '" src="' + profile.photoDataUrl + '" alt="">';
    }
    var initials = ((profile.firstName || "").charAt(0) + (profile.lastName || "").charAt(0)).toUpperCase();
    if (!initials && profile.pledgeName) initials = profile.pledgeName.charAt(0).toUpperCase();
    return '<div class="nap-avatar nap-avatar--fallback ' + sizeClass + '">' + (initials || "?") + "</div>";
  };

  window.napResizeImageToDataUrl = function (file, maxSize, callback) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var size = Math.min(img.width, img.height);
        var sx = (img.width - size) / 2;
        var sy = (img.height - size) / 2;
        var canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);
        callback(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  /* Fit (no crop) resize — for event flyer/photo uploads where full aspect ratio should be kept */
  window.napResizeImageToDataUrlFit = function (file, maxWidth, maxHeight, callback) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        var w = Math.round(img.width * ratio);
        var h = Math.round(img.height * ratio);
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  window.napIsProfileComplete = function (profile) {
    if (!profile) return false;
    var required = ["firstName", "lastName", "pledgeName", "chapter", "semesterCrossed", "yearCrossed", "major", "birthday"];
    return required.every(function (key) {
      return profile[key] !== undefined && profile[key] !== null && profile[key] !== "";
    });
  };

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = "portal";
      return;
    }

    window.NAP_CURRENT_UID = user.uid;

    db.collection("users").doc(user.uid).get().then(function (snap) {
      var profile = snap.exists ? snap.data() : {};
      window.NAP_CURRENT_PROFILE = profile;

      if (portalPledgeName) {
        portalPledgeName.textContent = window.napDisplayName(profile, user.email);
      }
      if (portalUserAvatar) {
        portalUserAvatar.innerHTML = window.napAvatarHtml(profile, "sm");
      }
      if (portalApp) portalApp.hidden = false;

      document.dispatchEvent(
        new CustomEvent("nap:auth-ready", { detail: { uid: user.uid, profile: profile } })
      );
    });
  });

  if (portalSignOut) {
    portalSignOut.addEventListener("click", function () {
      auth.signOut().then(function () {
        window.location.href = "portal";
      });
    });
  }
})();
