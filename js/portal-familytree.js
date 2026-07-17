/* Family Tree: an interactive, pannable/zoomable lineage graph (who picked up
   whom) across every chapter, hand-built with plain SVG — no charting
   library. Every brother can view; only admins can add/edit/delete nodes
   (enforced in firestore.rules, not just here). */
(function () {
  "use strict";

  var stageEl = document.getElementById("familytreeStage");
  if (!stageEl) return;

  var svgEl = document.getElementById("familytreeSvg");
  var emptyEl = document.getElementById("familytreeEmpty");
  var legendEl = document.getElementById("familytreeLegend");
  var newLineageBtn = document.getElementById("newLineageBtn");
  var zoomInBtn = document.getElementById("familytreeZoomInBtn");
  var zoomOutBtn = document.getElementById("familytreeZoomOutBtn");
  var resetBtn = document.getElementById("familytreeResetBtn");

  var currentUid = null;
  var allMembers = [];
  var started = false;
  var hasFitOnce = false;
  var lastPositions = {};

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function isAdmin() {
    return !!(window.napIsAdmin && window.napIsAdmin());
  }

  var CHAPTER_COLORS = {
    Alpha: "#4C78A8",
    Beta: "#F58518",
    Gamma: "#54A24B",
    Delta: "#E45756",
    Epsilon: "#79706E",
    Zeta: "#B279A2",
    Eta: "#9D755D",
    Theta: "#5B7F95",
    Iota: "#2E7D5B",
    Kappa: "#C1440E",
  };

  function colorFor(chapter) {
    return CHAPTER_COLORS[chapter] || "#8A8A8A";
  }

  function initialsFor(name) {
    var parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    var initials = parts[0].charAt(0);
    if (parts.length > 1) initials += parts[parts.length - 1].charAt(0);
    return initials.toUpperCase();
  }

  /* Pledge name is how brothers actually go by within the lineage, so it's
     the primary display identity everywhere in this tab; real name is
     secondary, shown only when it adds information. */
  function displayNameFor(member) {
    return (member && (member.pledgeName || member.name)) || "Unnamed";
  }

  legendEl.innerHTML = window.NAP_CHAPTERS.map(function (chapter) {
    return (
      '<span class="familytree-legend__chip">' +
      '<span class="familytree-legend__dot" style="background:' + colorFor(chapter) + '"></span>' +
      escapeHtml(chapter) +
      "</span>"
    );
  }).join("");

  function findMember(id) {
    return allMembers.find(function (m) {
      return m.id === id;
    });
  }

  function childrenOf(id) {
    return allMembers.filter(function (m) {
      return m.bigId === id;
    });
  }

  /* Every descendant id, including the root itself. Computed in-memory
     against the already-loaded live data rather than re-querying Firestore —
     there's no pagination here, so the full tree is always already local. */
  function subtreeIds(rootId) {
    var ids = [rootId];
    var queue = [rootId];
    while (queue.length) {
      var current = queue.shift();
      childrenOf(current).forEach(function (child) {
        ids.push(child.id);
        queue.push(child.id);
      });
    }
    return ids;
  }

  /* Static SVG shell (defs + the pan/zoom viewport group) — must exist
     before napOnAuthReady's handler can possibly run render(), which it can
     do synchronously if auth is already resolved by the time this script
     runs (a warm cached session), not just on the usual async path. */
  svgEl.innerHTML =
    '<g id="familytreeViewport">' +
    '<g id="familytreeEdges"></g>' +
    '<g id="familytreeNodes"></g>' +
    "</g>";

  window.napOnAuthReady(function (detail) {
    currentUid = detail.uid;
    if (!started) {
      started = true;
      startListener();
    }
  });

  function startListener() {
    db.collection("familyTree").onSnapshot(
      function (snap) {
        allMembers = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        render();
      },
      function () {
        emptyEl.hidden = false;
        emptyEl.textContent = "Couldn’t load the family tree — the site’s database permissions may need to be republished.";
      }
    );
  }

  /* ---------- Layout: simple non-overlapping tree layout, forest-aware ----------
     Generations flow left-to-right (depth -> x); leaves get the next free
     row top-to-bottom (y), and each parent centers vertically over its own
     children once they're placed. Multiple root lineages just keep
     consuming rows, so they naturally stack one under another. */
  var CARD_W = 196;
  var CARD_H = 64;
  var COL_W = CARD_W + 80;
  var ROW_H = CARD_H + 24;

  function layoutForest() {
    var roots = allMembers.filter(function (m) {
      return !m.bigId || !findMember(m.bigId);
    });
    var nextRow = 0;
    var positions = {};

    function place(member, depth) {
      var kids = childrenOf(member.id);
      var y;
      if (!kids.length) {
        y = nextRow * ROW_H;
        nextRow++;
      } else {
        kids.forEach(function (k) {
          place(k, depth + 1);
        });
        var ys = kids.map(function (k) {
          return positions[k.id].y;
        });
        y = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
      }
      positions[member.id] = { x: depth * COL_W, y: y };
    }

    roots.forEach(function (r) {
      place(r, 0);
    });

    return positions;
  }

  /* ---------- Pan / zoom state ---------- */
  var panX = 0;
  var panY = 0;
  var zoom = 1;
  var MIN_ZOOM = 0.25;
  var MAX_ZOOM = 2.5;

  function applyTransform() {
    var g = document.getElementById("familytreeViewport");
    if (g) g.setAttribute("transform", "translate(" + panX + "," + panY + ") scale(" + zoom + ")");
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function fitToView(positions) {
    var ids = Object.keys(positions);
    if (!ids.length) return;
    var xs = ids.map(function (id) {
      return positions[id].x;
    });
    var ys = ids.map(function (id) {
      return positions[id].y;
    });
    var minX = Math.min.apply(null, xs) - CARD_W / 2;
    var maxX = Math.max.apply(null, xs) + CARD_W / 2;
    var minY = Math.min.apply(null, ys) - CARD_H / 2;
    var maxY = Math.max.apply(null, ys) + CARD_H / 2;
    var treeW = Math.max(1, maxX - minX);
    var treeH = Math.max(1, maxY - minY);

    var stageW = stageEl.clientWidth || 800;
    var stageH = stageEl.clientHeight || 500;

    zoom = clamp(Math.min(stageW / (treeW + 80), stageH / (treeH + 80), 1), MIN_ZOOM, MAX_ZOOM);
    panX = (stageW - treeW * zoom) / 2 - minX * zoom;
    panY = 40 - minY * zoom;
    applyTransform();
  }

  /* ---------- Rendering ---------- */
  /* Each node is a bordered card (chapter-colored outline) containing a
     small avatar circle plus the pledge name / real name stacked beside it —
     one grouped, clickable unit instead of a bare circle with floating text. */
  function nodeSvg(member, pos) {
    var color = colorFor(member.chapter);
    var mainLabel = displayNameFor(member);
    var subLabel = member.pledgeName && member.name ? member.name : "";
    var halfW = CARD_W / 2;
    var halfH = CARD_H / 2;
    var avatarR = 17;
    var avatarCx = -halfW + 14 + avatarR;
    var textX = avatarCx + avatarR + 12;

    var html =
      '<g class="familytree-node" data-node-id="' + escapeHtml(member.id) + '" style="--tx:' + pos.x + 'px;--ty:' + pos.y + 'px;--chapter-color:' + color + ';">' +
      '<rect class="familytree-node__card" x="' + -halfW + '" y="' + -halfH + '" width="' + CARD_W + '" height="' + CARD_H + '" rx="12"></rect>' +
      '<circle class="familytree-node__circle" cx="' + avatarCx + '" cy="0" r="' + avatarR + '" fill="' + color + '"></circle>' +
      '<text class="familytree-node__initials" x="' + avatarCx + '" dy="1">' + escapeHtml(initialsFor(mainLabel)) + "</text>" +
      '<text class="familytree-node__label" x="' + textX + '" y="' + (subLabel ? -4 : 5) + '">' + escapeHtml(mainLabel) + "</text>";
    if (subLabel) {
      html += '<text class="familytree-node__sublabel" x="' + textX + '" y="13">' + escapeHtml(subLabel) + "</text>";
    }
    html += "</g>";
    return html;
  }

  function edgeSvg(fromPos, toPos) {
    var halfW = CARD_W / 2;
    var x1 = fromPos.x + halfW;
    var y1 = fromPos.y;
    var x2 = toPos.x - halfW;
    var y2 = toPos.y;
    var midX = (x1 + x2) / 2;
    var d = "M" + x1 + "," + y1 + " C" + midX + "," + y1 + " " + midX + "," + y2 + " " + x2 + "," + y2;
    return '<path class="familytree-edge" d="' + d + '"></path>';
  }

  function render() {
    emptyEl.hidden = !!allMembers.length;
    if (!allMembers.length) {
      document.getElementById("familytreeNodes").innerHTML = "";
      document.getElementById("familytreeEdges").innerHTML = "";
      if (newLineageBtn) newLineageBtn.hidden = !isAdmin();
      return;
    }

    var positions = layoutForest();
    lastPositions = positions;

    document.getElementById("familytreeNodes").innerHTML = allMembers
      .map(function (m) {
        return nodeSvg(m, positions[m.id]);
      })
      .join("");

    document.getElementById("familytreeEdges").innerHTML = allMembers
      .filter(function (m) {
        return m.bigId && findMember(m.bigId);
      })
      .map(function (m) {
        return edgeSvg(positions[m.bigId], positions[m.id]);
      })
      .join("");

    if (newLineageBtn) newLineageBtn.hidden = !isAdmin();

    if (!hasFitOnce) {
      hasFitOnce = true;
      fitToView(positions);
    }

    if (openPersonId) renderPersonModal(findMember(openPersonId));
  }

  /* ---------- Pan (drag) + zoom (wheel) ---------- */
  var isPointerDown = false;
  var dragMoved = false;
  var activePointerId = null;
  var pointerStartX, pointerStartY, panStartX, panStartY;

  stageEl.addEventListener("pointerdown", function (e) {
    isPointerDown = true;
    dragMoved = false;
    activePointerId = e.pointerId;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
    /* Pointer capture is deferred until movement actually crosses the drag
       threshold below (not grabbed unconditionally on every press) — once
       captured, the browser can resolve the eventual "click" event's target
       to the capturing element instead of whatever's visually under the
       cursor, which silently ate every node click. A plain click never
       triggers capture at all now, so it can't interfere. */
  });

  stageEl.addEventListener("pointermove", function (e) {
    if (!isPointerDown) return;
    var dx = e.clientX - pointerStartX;
    var dy = e.clientY - pointerStartY;
    if (!dragMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      dragMoved = true;
      stageEl.classList.add("is-panning");
      try {
        stageEl.setPointerCapture(activePointerId);
      } catch (err) {}
    }
    if (!dragMoved) return;
    panX = panStartX + dx;
    panY = panStartY + dy;
    applyTransform();
  });

  /* Node clicks are resolved here, via our own hit-test at the release
     point, rather than by listening for a native "click" event — that
     sidesteps any ambiguity around how pointer capture affects click target
     resolution entirely, instead of depending on it working out. */
  function endPointer(e) {
    var wasDrag = dragMoved;
    isPointerDown = false;
    dragMoved = false;
    stageEl.classList.remove("is-panning");

    if (!wasDrag && e && typeof e.clientX === "number") {
      var elAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      var nodeEl = elAtPoint && elAtPoint.closest && elAtPoint.closest("[data-node-id]");
      if (nodeEl) {
        var member = findMember(nodeEl.getAttribute("data-node-id"));
        if (member) openPersonModal(member);
      }
    }
  }
  stageEl.addEventListener("pointerup", endPointer);
  stageEl.addEventListener("pointercancel", endPointer);

  stageEl.addEventListener(
    "wheel",
    function (e) {
      e.preventDefault();
      var rect = stageEl.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;
      var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      var newZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
      panX = mouseX - (mouseX - panX) * (newZoom / zoom);
      panY = mouseY - (mouseY - panY) * (newZoom / zoom);
      zoom = newZoom;
      applyTransform();
    },
    { passive: false }
  );

  function zoomByFactor(factor) {
    var stageW = stageEl.clientWidth || 800;
    var stageH = stageEl.clientHeight || 500;
    var newZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
    panX = stageW / 2 - (stageW / 2 - panX) * (newZoom / zoom);
    panY = stageH / 2 - (stageH / 2 - panY) * (newZoom / zoom);
    zoom = newZoom;
    applyTransform();
  }

  if (zoomInBtn) zoomInBtn.addEventListener("click", function () { zoomByFactor(1.25); });
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", function () { zoomByFactor(1 / 1.25); });
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      fitToView(layoutForest());
    });
  }

  /* ---------- Search: type-to-find, then smoothly pan/zoom to them ---------- */
  var searchInput = document.getElementById("familytreeSearchInput");
  var searchResultsEl = document.getElementById("familytreeSearchResults");

  function renderSearchResults(query) {
    var q = query.trim().toLowerCase();
    if (!q) {
      searchResultsEl.innerHTML = "";
      searchResultsEl.hidden = true;
      return;
    }

    var matches = allMembers
      .filter(function (m) {
        return (m.name || "").toLowerCase().indexOf(q) !== -1 || (m.pledgeName || "").toLowerCase().indexOf(q) !== -1;
      })
      .slice(0, 8);

    if (!matches.length) {
      searchResultsEl.innerHTML = '<p class="familytree-big-picker__empty">No matches.</p>';
      searchResultsEl.hidden = false;
      return;
    }

    searchResultsEl.innerHTML = matches
      .map(function (m) {
        return (
          '<button type="button" class="familytree-big-picker__option" data-search-result="' + escapeHtml(m.id) + '">' +
          '<span class="familytree-chip__dot" style="background:' + colorFor(m.chapter) + '"></span>' +
          escapeHtml(displayNameFor(m)) +
          (m.chapter ? ' <span class="familytree-big-picker__chapter">(' + escapeHtml(m.chapter) + ")</span>" : "") +
          "</button>"
        );
      })
      .join("");
    searchResultsEl.hidden = false;
  }

  /* Smoothly pans/zooms to a fixed, comfortable zoom level centered on the
     person, then pulses their card a few times so they're easy to spot the
     instant the view settles — regardless of where they were before. */
  function focusOnMember(member) {
    var pos = lastPositions[member.id];
    if (!pos) return;

    var stageW = stageEl.clientWidth || 800;
    var stageH = stageEl.clientHeight || 500;
    var targetZoom = 1;

    var viewportEl = document.getElementById("familytreeViewport");
    if (viewportEl) viewportEl.classList.add("familytree-viewport--animated");

    zoom = targetZoom;
    panX = stageW / 2 - pos.x * zoom;
    panY = stageH / 2 - pos.y * zoom;
    applyTransform();

    window.setTimeout(function () {
      if (viewportEl) viewportEl.classList.remove("familytree-viewport--animated");
    }, 550);

    var nodeEl = document.querySelector('[data-node-id="' + member.id + '"]');
    if (nodeEl) {
      nodeEl.classList.add("familytree-node--highlight");
      window.setTimeout(function () {
        nodeEl.classList.remove("familytree-node--highlight");
      }, 1700);
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      renderSearchResults(searchInput.value);
    });

    searchInput.addEventListener("focus", function () {
      if (searchInput.value.trim()) renderSearchResults(searchInput.value);
    });

    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var first = searchResultsEl.querySelector("[data-search-result]");
        if (first) first.click();
      } else if (e.key === "Escape") {
        searchResultsEl.hidden = true;
        searchInput.blur();
      }
    });
  }

  if (searchResultsEl) {
    searchResultsEl.addEventListener("click", function (e) {
      var opt = e.target.closest("[data-search-result]");
      if (!opt) return;
      var member = findMember(opt.getAttribute("data-search-result"));
      searchResultsEl.hidden = true;
      searchInput.value = "";
      if (member) focusOnMember(member);
    });
  }

  document.addEventListener("click", function (e) {
    if (searchResultsEl && !searchResultsEl.hidden && !e.target.closest(".familytree-search")) {
      searchResultsEl.hidden = true;
    }
  });

  /* ---------- Person detail modal ---------- */
  var personModal = document.getElementById("modal-familytree-person");
  var personAvatarEl = document.getElementById("familytreePersonAvatar");
  var personNameEl = document.getElementById("familytree-person-name");
  var personPledgeNameEl = document.getElementById("familytree-person-pledgename");
  var personGridEl = document.getElementById("familytreePersonGrid");
  var personLittlesEl = document.getElementById("familytreePersonLittles");
  var personAdminActionsEl = document.getElementById("familytreePersonAdminActions");

  var openPersonId = null;

  function avatarCircleHtml(member, size) {
    return (
      '<span class="nap-avatar nap-avatar--fallback nap-avatar--' + size + '" style="background:' + colorFor(member.chapter) + ';color:#fff;">' +
      escapeHtml(initialsFor(displayNameFor(member))) +
      "</span>"
    );
  }

  function renderPersonModal(member) {
    if (!member) {
      personModal.close();
      return;
    }

    personAvatarEl.innerHTML = avatarCircleHtml(member, "xl");
    personNameEl.textContent = displayNameFor(member);
    personPledgeNameEl.textContent = member.pledgeName && member.name ? member.name : "";

    var big = member.bigId ? findMember(member.bigId) : null;

    var fields = [
      ["Chapter", member.chapter],
      ["Class", member.pledgeClass],
      ["Crossed", [member.term, member.year].filter(Boolean).join(" ")],
    ];

    var gridHtml = fields
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

    if (big) {
      gridHtml +=
        '<div class="profile-modal__field">' +
        '<p class="profile-modal__field-label">Big</p>' +
        '<p class="profile-modal__field-value"><button class="familytree-big-link" type="button" data-jump-to="' + escapeHtml(big.id) + '">' +
        escapeHtml(displayNameFor(big)) +
        "</button></p>" +
        "</div>";
    }
    personGridEl.innerHTML = gridHtml;

    var littles = childrenOf(member.id);
    var littlesHtml = '<p class="familytree-person-littles__title">Picked Up (' + littles.length + ")</p>";
    if (littles.length) {
      littlesHtml +=
        '<div class="familytree-person-littles__list">' +
        littles
          .map(function (l) {
            return (
              '<button class="familytree-chip" type="button" data-jump-to="' + escapeHtml(l.id) + '">' +
              '<span class="familytree-chip__dot" style="background:' + colorFor(l.chapter) + '"></span>' +
              escapeHtml(displayNameFor(l)) +
              "</button>"
            );
          })
          .join("") +
        "</div>";
    }
    personLittlesEl.innerHTML = littlesHtml;

    personAdminActionsEl.innerHTML = isAdmin()
      ? '<button class="news-card__action-btn" type="button" data-add-little>Add Little</button>' +
        '<button class="news-card__action-btn" type="button" data-edit-person>Edit</button>' +
        '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-delete-person>Delete</button>'
      : "";
  }

  function openPersonModal(member) {
    openPersonId = member.id;
    renderPersonModal(member);
    personModal.showModal();
  }

  personModal.addEventListener("close", function () {
    openPersonId = null;
  });

  personGridEl.addEventListener("click", function (e) {
    var jumpBtn = e.target.closest("[data-jump-to]");
    if (!jumpBtn) return;
    var target = findMember(jumpBtn.getAttribute("data-jump-to"));
    if (target) openPersonModal(target);
  });

  personLittlesEl.addEventListener("click", function (e) {
    var jumpBtn = e.target.closest("[data-jump-to]");
    if (!jumpBtn) return;
    var target = findMember(jumpBtn.getAttribute("data-jump-to"));
    if (target) openPersonModal(target);
  });

  personAdminActionsEl.addEventListener("click", function (e) {
    if (e.target.closest("[data-add-little]")) {
      openPersonForm(null, openPersonId);
      return;
    }
    if (e.target.closest("[data-edit-person]")) {
      openPersonForm(findMember(openPersonId), undefined);
      return;
    }
    if (e.target.closest("[data-delete-person]")) {
      var member = findMember(openPersonId);
      if (!member) return;
      var descendantCount = subtreeIds(member.id).length - 1;
      var warning = descendantCount
        ? "This also removes " + descendantCount + " descendant" + (descendantCount === 1 ? "" : "s") + " under them. This can't be undone."
        : "This can't be undone.";
      window.napConfirm(warning, { title: "Delete " + displayNameFor(member) + "?", confirmLabel: "Delete" }).then(function (confirmed) {
        if (confirmed) deletePersonCascade(member.id);
      });
    }
  });

  function deletePersonCascade(memberId) {
    var ids = subtreeIds(memberId);
    var chunks = [];
    for (var i = 0; i < ids.length; i += 450) chunks.push(ids.slice(i, i + 450));

    var promise = Promise.resolve();
    chunks.forEach(function (chunk) {
      promise = promise.then(function () {
        var batch = db.batch();
        chunk.forEach(function (id) {
          batch.delete(db.collection("familyTree").doc(id));
        });
        return batch.commit();
      });
    });

    promise
      .then(function () {
        personModal.close();
      })
      .catch(function () {
        window.alert("Couldn't delete this person. Please try again.");
      });
  }

  /* ---------- Add / edit person form ---------- */
  var formModal = document.getElementById("modal-familytree-form");
  var formModalTitleEl = document.getElementById("modal-familytree-form-title");
  var form = document.getElementById("familytreeForm");
  var formSubmitBtn = form.querySelector('button[type="submit"]');
  var formErrorEl = document.getElementById("familytree-form-error");
  var chapterSelect = document.getElementById("familytree-form-chapter");
  var bigIdInput = document.getElementById("familytree-form-big");
  var bigSearchInput = document.getElementById("familytree-form-big-search");
  var quickfillTextEl = document.getElementById("familytree-form-quickfill-text");
  var quickfillBtn = document.getElementById("familytreeQuickfillBtn");
  var quickfillErrorEl = document.getElementById("familytree-quickfill-error");
  var bigResultsEl = document.getElementById("familytreeBigResults");

  window.NAP_CHAPTERS.forEach(function (chapter) {
    var opt = document.createElement("option");
    opt.value = chapter;
    opt.textContent = chapter;
    chapterSelect.appendChild(opt);
  });

  var currentEditId = null;
  var bigCandidates = [];

  /* Searchable Big picker: types into a text box, matching on either pledge
     name or real name, instead of scrolling one giant native <select> —
     the difference matters once this list has hundreds of people in it. */
  function setupBigPicker(excludeIds, currentBigId) {
    bigCandidates = allMembers
      .filter(function (m) {
        return excludeIds.indexOf(m.id) === -1;
      })
      .slice()
      .sort(function (a, b) {
        return displayNameFor(a).localeCompare(displayNameFor(b));
      });

    bigIdInput.value = currentBigId || "";
    var current = currentBigId ? findMember(currentBigId) : null;
    bigSearchInput.value = current ? displayNameFor(current) + (current.chapter ? " (" + current.chapter + ")" : "") : "";
  }

  function renderBigResults(query) {
    var q = query.trim().toLowerCase();
    var matches = !q
      ? bigCandidates.slice(0, 8)
      : bigCandidates
          .filter(function (m) {
            return (m.name || "").toLowerCase().indexOf(q) !== -1 || (m.pledgeName || "").toLowerCase().indexOf(q) !== -1;
          })
          .slice(0, 8);

    var html = '<button type="button" class="familytree-big-picker__option familytree-big-picker__option--none" data-big-id="">— No Big (starts a new lineage) —</button>';
    html += matches
      .map(function (m) {
        return (
          '<button type="button" class="familytree-big-picker__option" data-big-id="' + escapeHtml(m.id) + '">' +
          '<span class="familytree-chip__dot" style="background:' + colorFor(m.chapter) + '"></span>' +
          escapeHtml(displayNameFor(m)) +
          (m.chapter ? ' <span class="familytree-big-picker__chapter">(' + escapeHtml(m.chapter) + ")</span>" : "") +
          "</button>"
        );
      })
      .join("");
    if (q && !matches.length) {
      html += '<p class="familytree-big-picker__empty">No matches.</p>';
    }
    bigResultsEl.innerHTML = html;
  }

  bigSearchInput.addEventListener("input", function () {
    renderBigResults(bigSearchInput.value);
    bigResultsEl.hidden = false;
  });

  bigSearchInput.addEventListener("focus", function () {
    /* Always show the default (unfiltered) list on focus rather than
       filtering by whatever's already displayed — the box may be showing a
       pre-filled "Name (Chapter)" label, which won't match anyone's raw
       name/pledgeName as a substring and would wrongly show "No matches."
       Select-all so typing immediately replaces the current selection. */
    bigSearchInput.select();
    renderBigResults("");
    bigResultsEl.hidden = false;
  });

  bigResultsEl.addEventListener("click", function (e) {
    var opt = e.target.closest("[data-big-id]");
    if (!opt) return;
    var id = opt.getAttribute("data-big-id");
    bigIdInput.value = id;
    if (!id) {
      bigSearchInput.value = "";
    } else {
      var m = findMember(id);
      bigSearchInput.value = displayNameFor(m) + (m.chapter ? " (" + m.chapter + ")" : "");
    }
    bigResultsEl.hidden = true;
  });

  document.addEventListener("click", function (e) {
    if (!bigResultsEl.hidden && !e.target.closest(".familytree-big-picker")) {
      bigResultsEl.hidden = true;
    }
  });

  /* Quick Fill: paste 5 lines — Pledge Name, Name, Chapter, Class, Term
     Year — and populate the fields below instead of typing each one in.
     The Big still has to be picked by hand (see the picker above). */
  function parseQuickfillText(text) {
    var lines = text
      .split(/\r?\n/)
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l !== ""; });
    if (lines.length < 5) return null;

    var termYearMatch = lines[4].match(/^(Fall|Spring|Summer)\s+(\d{4})$/i);
    var term = "";
    var year = "";
    if (termYearMatch) {
      term = termYearMatch[1].charAt(0).toUpperCase() + termYearMatch[1].slice(1).toLowerCase();
      year = termYearMatch[2];
    } else {
      var termWordMatch = lines[4].match(/Fall|Spring|Summer/i);
      if (termWordMatch) term = termWordMatch[0].charAt(0).toUpperCase() + termWordMatch[0].slice(1).toLowerCase();
      var yearMatch = lines[4].match(/\d{4}/);
      if (yearMatch) year = yearMatch[0];
    }

    return {
      pledgeName: lines[0],
      name: lines[1],
      chapter: lines[2].replace(/\s*chapter\s*$/i, "").trim(),
      pledgeClass: lines[3].replace(/\s*class\s*$/i, "").trim(),
      term: term,
      year: year,
    };
  }

  if (quickfillBtn) {
    quickfillBtn.addEventListener("click", function () {
      var parsed = parseQuickfillText(quickfillTextEl.value);
      quickfillErrorEl.hidden = true;

      if (!parsed) {
        quickfillErrorEl.textContent = "Paste all 5 lines: Pledge Name, Name, Chapter, Class, Term Year.";
        quickfillErrorEl.hidden = false;
        return;
      }

      form.querySelector('[name="pledgeName"]').value = parsed.pledgeName;
      form.querySelector('[name="name"]').value = parsed.name;
      form.querySelector('[name="pledgeClass"]').value = parsed.pledgeClass;
      form.querySelector('[name="year"]').value = parsed.year;

      var matchedChapter = window.NAP_CHAPTERS.find(function (c) { return c.toLowerCase() === parsed.chapter.toLowerCase(); });
      chapterSelect.value = matchedChapter || "";

      var termSelect = form.querySelector('[name="term"]');
      var matchedTerm = ["Fall", "Spring", "Summer"].find(function (t) { return t.toLowerCase() === parsed.term.toLowerCase(); });
      termSelect.value = matchedTerm || "";

      if (!matchedChapter || !matchedTerm) {
        var problems = [];
        if (!matchedChapter) problems.push('chapter "' + parsed.chapter + '"');
        if (!matchedTerm) problems.push('term "' + parsed.term + '"');
        quickfillErrorEl.textContent = "Couldn't match " + problems.join(" or ") + " — the rest filled in, set that one manually.";
        quickfillErrorEl.hidden = false;
      }
    });
  }

  /* opts.editMember: person being edited (null = creating new).
     opts.presetBigId: pre-select this Big (used by "Add Little"). */
  function openPersonForm(editMember, presetBigId) {
    if (!isAdmin()) return;
    currentEditId = editMember ? editMember.id : null;
    formModalTitleEl.textContent = editMember ? "Edit Person" : "Add Person";
    formSubmitBtn.textContent = editMember ? "Save Changes" : "Save Person";

    if (quickfillTextEl) quickfillTextEl.value = "";
    if (quickfillErrorEl) quickfillErrorEl.hidden = true;

    /* Editing: a person can't become their own big, and can't become the
       big of one of their own descendants (that would create a cycle). */
    var exclude = editMember ? subtreeIds(editMember.id) : [];
    setupBigPicker(exclude, editMember ? editMember.bigId : presetBigId || "");
    bigResultsEl.hidden = true;

    form.querySelector('[name="name"]').value = editMember ? editMember.name || "" : "";
    form.querySelector('[name="pledgeName"]').value = editMember ? editMember.pledgeName || "" : "";
    chapterSelect.value = editMember ? editMember.chapter || "" : "";
    form.querySelector('[name="pledgeClass"]').value = editMember ? editMember.pledgeClass || "" : "";
    form.querySelector('[name="term"]').value = editMember ? editMember.term || "" : "";
    form.querySelector('[name="year"]').value = editMember ? editMember.year || "" : "";

    formErrorEl.hidden = true;
    formModal.showModal();
  }

  if (newLineageBtn) {
    newLineageBtn.addEventListener("click", function () {
      openPersonForm(null, "");
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var name = form.querySelector('[name="name"]').value.trim();
    var chapter = chapterSelect.value;

    if (!name || !chapter) {
      formErrorEl.textContent = "Enter a name and pick a chapter.";
      formErrorEl.hidden = false;
      return;
    }

    formErrorEl.hidden = true;

    var payload = {
      name: name,
      pledgeName: form.querySelector('[name="pledgeName"]').value.trim(),
      chapter: chapter,
      pledgeClass: form.querySelector('[name="pledgeClass"]').value.trim(),
      term: form.querySelector('[name="term"]').value,
      year: form.querySelector('[name="year"]').value ? Number(form.querySelector('[name="year"]').value) : null,
      bigId: bigIdInput.value || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    var isEdit = !!currentEditId;
    window.napSaveButtonStart(formSubmitBtn, isEdit ? "Saving…" : "Creating…");

    var writePromise;
    if (isEdit) {
      writePromise = db.collection("familyTree").doc(currentEditId).update(payload);
    } else {
      payload.createdByUid = currentUid;
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      writePromise = db.collection("familyTree").add(payload);
    }

    writePromise
      .then(function () {
        window.napSaveButtonDone(formSubmitBtn, { savedLabel: "Saved" });
        window.setTimeout(function () {
          formModal.close();
        }, 550);
      })
      .catch(function () {
        window.napSaveButtonDone(formSubmitBtn, { error: true });
        formErrorEl.textContent = "Something went wrong. Please try again.";
        formErrorEl.hidden = false;
      });
  });

  /* Re-check admin status every time this tab is actually opened, rather
     than trusting whatever "New Lineage" button state rendering last left
     behind — render() only re-runs on Firestore data changes, so without
     this, revoking your own admin access elsewhere and coming back here
     would leave a stale, unusable "New Lineage" button visible. */
  var familyTreeNavBtn = document.querySelector('.portal-shell__nav-btn[data-tab="family-tree"]');
  if (familyTreeNavBtn) {
    familyTreeNavBtn.addEventListener("click", function () {
      if (newLineageBtn) newLineageBtn.hidden = !isAdmin();
    });
  }
})();
