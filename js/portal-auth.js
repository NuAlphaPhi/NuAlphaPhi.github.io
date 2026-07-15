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

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  /* Shared brother directory cache — every portal module can look up a brother
     by uid without running its own Firestore listener. */
  window.NAP_ALL_BROTHERS = [];
  window.napGetBrotherByUid = function (uid) {
    if (!uid) return null;
    return (
      window.NAP_ALL_BROTHERS.find(function (b) {
        return b.uid === uid;
      }) || null
    );
  };

  /* "nap:auth-ready" and "nap:brothers-updated" each fire once, as soon as
     data is available — which can happen before a later <script> tag has even
     finished loading and registered its listener (each module is its own
     network request, and a warm/cached auth session can resolve faster than
     they all download). These napOn* helpers replay the last known state to
     late subscribers instead of silently dropping them, while still behaving
     exactly like document.addEventListener for anyone who was ready in time. */
  window.NAP_BROTHERS_READY = false;
  window.napOnBrothersUpdated = function (handler) {
    if (window.NAP_BROTHERS_READY) handler();
    document.addEventListener("nap:brothers-updated", handler);
  };

  /* Disabled brothers (admin-removed accounts) are filtered out here, which
     hides them from the directory, birthdays, author pickers, and email
     blasts everywhere at once. */
  db.collection("users").onSnapshot(function (snap) {
    window.NAP_ALL_BROTHERS = snap.docs
      .map(function (doc) {
        return Object.assign({ uid: doc.id }, doc.data());
      })
      .filter(function (b) {
        return b.disabled !== true;
      });
    window.NAP_BROTHERS_READY = true;
    document.dispatchEvent(new CustomEvent("nap:brothers-updated"));
  });

  window.napIsAdmin = function () {
    return !!(window.NAP_CURRENT_PROFILE && window.NAP_CURRENT_PROFILE.isAdmin === true);
  };

  /* Queue one email per brother into the /mail collection, which the Firebase
     "Trigger Email" extension picks up and sends. One doc per recipient keeps
     addresses out of each other's To: lines. Brothers who turned off email
     notifications in Settings (emailNotifications == false) are skipped.
     If the extension isn't installed yet, the docs just sit there harmlessly. */
  window.napQueueBrotherhoodEmail = function (subject, text) {
    var recipients = (window.NAP_ALL_BROTHERS || []).filter(function (b) {
      return b.email && b.emailNotifications !== false;
    });
    if (!recipients.length) return Promise.resolve();
    var batch = db.batch();
    recipients.forEach(function (b) {
      batch.set(db.collection("mail").doc(), {
        to: [b.email],
        message: { subject: subject, text: text },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    return batch.commit().catch(function () {
      /* Email is best-effort — never block the post itself on it. */
    });
  };

  /* Renders a clickable "Name · Chapter · Semester Year" author badge, used on
     announcements, events, and comments. Falls back to the stored author name
     if the brother's profile isn't in the cache yet. */
  window.napAuthorBadgeHtml = function (uid, fallbackName, extraClass) {
    var brother = window.napGetBrotherByUid(uid);
    var name = (brother && window.napDisplayName(brother, "")) || fallbackName || "A brother";
    var metaParts = [];
    if (brother && brother.chapter) metaParts.push(brother.chapter);
    var crossed = brother ? window.napSemesterCrossed(brother) : "";
    if (crossed) metaParts.push(crossed);

    var metaHtml = metaParts.length
      ? '<span class="author-badge__meta">' + metaParts.map(escapeHtml).join(" &middot; ") + "</span>"
      : "";

    return (
      '<button class="author-badge' + (extraClass ? " " + extraClass : "") + '" type="button" data-open-profile="' + escapeHtml(uid || "") + '">' +
      '<span class="author-badge__name">' + escapeHtml(name) + "</span>" +
      metaHtml +
      "</button>"
    );
  };

  /* Global click delegate: any element carrying data-open-profile="<uid>"
     opens that brother's profile modal, no matter which module rendered it. */
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-open-profile]");
    if (!trigger) return;
    var uid = trigger.getAttribute("data-open-profile");
    if (uid && window.napOpenProfileModal) {
      window.napOpenProfileModal(uid);
    }
  });

  /* Shared comments UI (announcements + events): comments are collapsed by
     default behind a "Show Comments" toggle, with a separate "Add Comment"
     toggle for the reply form. Callers own the Firestore reads/writes and
     local expand/collapse state — this just renders the markup consistently
     so both modules (and the event-detail modal) look and behave the same. */
  window.napCommentsSectionHtml = function (opts) {
    opts = opts || {};
    var comments = opts.comments || [];
    var currentUid = opts.currentUid;
    var expanded = !!opts.expanded;
    var showAddForm = !!opts.showAddForm;
    var editingCommentId = opts.editingCommentId || null;
    var count = comments.length;

    var html = '<div class="comments-block">';
    html +=
      '<div class="comments-block__toolbar">' +
      '<button class="news-card__action-btn" type="button" data-comments-toggle-show>' +
      (expanded ? "Hide Comments" : "Show Comments (" + count + ")") +
      "</button>" +
      '<button class="news-card__action-btn" type="button" data-comments-toggle-add>' +
      (showAddForm ? "Cancel" : "Add Comment") +
      "</button>" +
      "</div>";

    if (expanded) {
      if (!comments.length) {
        html += '<p class="comments-block__empty">No comments yet.</p>';
      } else {
        html += '<div class="comment-list">';
        comments.forEach(function (c) {
          if (editingCommentId === c.id) {
            html +=
              '<div class="comment-item" id="comment-' + c.id + '">' +
              '<form class="comment-edit-form" data-comment-id="' + c.id + '" style="display:flex;gap:0.5rem;">' +
              '<input class="form-input" name="body" value="' + escapeHtml(c.body) + '" required>' +
              '<button class="form-submit form-submit--small" type="submit">Save</button>' +
              '<button class="news-card__action-btn" type="button" data-cancel-comment-edit>Cancel</button>' +
              "</form></div>";
          } else {
            var isOwner = c.authorUid === currentUid;
            html +=
              '<div class="comment-item" id="comment-' + c.id + '">' +
              '<div class="comment-item__meta">' +
              window.napAuthorBadgeHtml(c.authorUid, c.authorName, "comment-item__author") +
              (isOwner
                ? '<span class="comment-item__actions">' +
                  '<button class="news-card__action-btn" type="button" data-comment-edit="' + c.id + '">Edit</button>' +
                  '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-comment-delete="' + c.id + '">Delete</button>' +
                  "</span>"
                : "") +
              "</div>" +
              '<p class="comment-item__text">' + escapeHtml(c.body) + "</p>" +
              "</div>";
          }
        });
        html += "</div>";
      }
    }

    if (showAddForm) {
      html +=
        '<form class="comment-form comment-add-form">' +
        '<input class="form-input" name="body" placeholder="Ask a question or add a comment…" required>' +
        '<button class="form-submit form-submit--small" type="submit">Comment</button>' +
        "</form>";
    }

    html += "</div>";
    return html;
  };

  window.napTimeAgo = function (date) {
    if (!date) return "";
    var seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Just now";
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + "h ago";
    var days = Math.round(hours / 24);
    if (days < 7) return days + "d ago";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  window.NAP_AUTH_READY_DETAIL = null;
  window.napOnAuthReady = function (handler) {
    if (window.NAP_AUTH_READY_DETAIL) handler(window.NAP_AUTH_READY_DETAIL);
    document.addEventListener("nap:auth-ready", function (e) {
      handler(e.detail);
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

      /* Admin-removed account: sign them straight back out. Their Firebase
         Auth login still exists (deleting that needs a server), but the
         portal itself is a locked door. */
      if (profile.disabled === true) {
        auth.signOut().then(function () {
          window.location.href = "portal";
        });
        return;
      }

      window.NAP_CURRENT_PROFILE = profile;

      if (portalPledgeName) {
        portalPledgeName.textContent = window.napDisplayName(profile, user.email);
      }
      if (portalUserAvatar) {
        portalUserAvatar.innerHTML = window.napAvatarHtml(profile, "sm");
      }
      if (portalApp) portalApp.hidden = false;

      var adminNavBtn = document.getElementById("adminNavBtn");
      if (adminNavBtn) adminNavBtn.hidden = profile.isAdmin !== true;

      window.NAP_AUTH_READY_DETAIL = { uid: user.uid, profile: profile };
      document.dispatchEvent(
        new CustomEvent("nap:auth-ready", { detail: window.NAP_AUTH_READY_DETAIL })
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
