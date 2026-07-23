/* Member Education: a sub-tab of Pledges listing what a pledge needs in
   their notebook to cross, broken into admin-editable sections (e.g.
   "Rules"). Every brother can read; only admins can add/edit/delete
   sections (enforced in firestore.rules, not just here). */
(function () {
  "use strict";

  var listEl = document.getElementById("educationSectionsList");
  if (!listEl) return;

  var newSectionBtn = document.getElementById("newEducationSectionBtn");

  var CHEVRON_SVG =
    '<svg class="education-item__chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 9l6 6 6-6"></path>' +
    "</svg>";

  var allSections = [];
  var expandedIds = {};

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  }

  function isAdmin() {
    return !!(window.napIsAdmin && window.napIsAdmin());
  }

  /* ---------- Sub-tabs: Pledge Classes / Member Education ---------- */
  var subTabBtns = document.querySelectorAll("#pledgesSubTabs [data-pledges-tab]");
  var subPanels = document.querySelectorAll("[data-pledges-panel]");

  function setPledgesTab(tab) {
    subTabBtns.forEach(function (btn) {
      var active = btn.getAttribute("data-pledges-tab") === tab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    subPanels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-pledges-panel") !== tab;
    });

    /* Re-check admin status on every switch to this tab, rather than only
       whenever the Firestore listener happens to re-fire — same class of
       stale-button bug fixed elsewhere in this app (Family Tree's "New
       Lineage", Pledges' own "New Pledge Class"). */
    if (tab === "education") renderSections();
  }

  subTabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setPledgesTab(btn.getAttribute("data-pledges-tab"));
    });
  });

  /* Leaving the Pledges tab for any other resets back to Pledge Classes,
     so returning later doesn't strand admins on an empty-looking toolbar. */
  document.querySelectorAll(".portal-shell__nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setPledgesTab("classes");
    });
  });

  /* ---------- Sections list ---------- */
  function findSection(id) {
    return allSections.find(function (s) {
      return s.id === id;
    });
  }

  function renderSections() {
    var admin = isAdmin();
    if (newSectionBtn) newSectionBtn.hidden = !admin;

    if (!allSections.length) {
      listEl.innerHTML = '<p class="education-empty">No sections yet' + (admin ? " — add the first one." : ".") + "</p>";
      return;
    }

    listEl.innerHTML = allSections
      .map(function (s) {
        var isOpen = !!expandedIds[s.id];
        return (
          '<div class="education-item' + (isOpen ? " is-open" : "") + '" data-section-id="' + s.id + '">' +
          '<button class="education-item__header" type="button" data-section-toggle="' + s.id + '" aria-expanded="' + isOpen + '">' +
          '<p class="education-item__title">' + escapeHtml(s.title) + "</p>" +
          CHEVRON_SVG +
          "</button>" +
          '<div class="education-item__body"' + (isOpen ? "" : " hidden") + ">" +
          '<p class="education-item__desc">' + escapeHtml(s.description) + "</p>" +
          (admin
            ? '<div class="education-item__admin-actions">' +
              '<button class="news-card__action-btn" type="button" data-section-edit="' + s.id + '">Edit</button>' +
              '<button class="news-card__action-btn news-card__action-btn--danger" type="button" data-section-delete="' + s.id + '">Delete</button>' +
              "</div>"
            : "") +
          "</div></div>"
        );
      })
      .join("");
  }

  listEl.addEventListener("click", function (e) {
    var toggleBtn = e.target.closest("[data-section-toggle]");
    var editBtn = e.target.closest("[data-section-edit]");
    var deleteBtn = e.target.closest("[data-section-delete]");

    if (editBtn) {
      var section = findSection(editBtn.getAttribute("data-section-edit"));
      if (section) openSectionModal(section);
      return;
    }

    if (deleteBtn) {
      var sectionId = deleteBtn.getAttribute("data-section-delete");
      var toDelete = findSection(sectionId);
      var title = (toDelete && toDelete.title) || "this section";
      window.napConfirm("This can't be undone.", { title: 'Delete "' + title + '"?', confirmLabel: "Delete" }).then(function (confirmed) {
        if (!confirmed) return;
        db.collection("memberEducation")
          .doc(sectionId)
          .delete()
          .catch(function () {
            window.alert("Couldn't delete this section. Please try again.");
          });
      });
      return;
    }

    if (toggleBtn) {
      var id = toggleBtn.getAttribute("data-section-toggle");
      expandedIds[id] = !expandedIds[id];
      renderSections();
    }
  });

  db.collection("memberEducation")
    .orderBy("createdAt", "asc")
    .onSnapshot(
      function (snap) {
        allSections = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderSections();
      },
      function () {
        listEl.innerHTML = '<p class="education-empty">Couldn’t load Member Education — the site’s database permissions may need to be republished.</p>';
      }
    );

  /* ---------- Add/edit section modal ---------- */
  var sectionModal = document.getElementById("modal-education-section");
  var sectionModalTitleEl = document.getElementById("modal-education-section-title");
  var sectionForm = document.getElementById("educationSectionForm");
  var sectionSubmitBtn = sectionForm.querySelector('button[type="submit"]');
  var sectionErrorEl = document.getElementById("education-section-form-error");

  var currentEditId = null;

  function openSectionModal(section) {
    currentEditId = section ? section.id : null;
    sectionModalTitleEl.textContent = section ? "Edit Section" : "Add Section";
    sectionSubmitBtn.textContent = section ? "Save Changes" : "Save Section";
    sectionForm.querySelector('[name="title"]').value = section ? section.title || "" : "";
    sectionForm.querySelector('[name="description"]').value = section ? section.description || "" : "";
    sectionErrorEl.hidden = true;
    sectionModal.showModal();
  }

  if (newSectionBtn) {
    newSectionBtn.addEventListener("click", function () {
      openSectionModal(null);
    });
  }

  sectionForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var title = sectionForm.querySelector('[name="title"]').value.trim();
    var description = sectionForm.querySelector('[name="description"]').value.trim();

    if (!title || !description) {
      sectionErrorEl.textContent = "Enter a section title and what pledges need to write or do.";
      sectionErrorEl.hidden = false;
      return;
    }

    sectionErrorEl.hidden = true;

    var payload = {
      title: title,
      description: description,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    var isEdit = !!currentEditId;
    window.napSaveButtonStart(sectionSubmitBtn, isEdit ? "Saving…" : "Adding…");

    var writePromise;
    if (isEdit) {
      writePromise = db.collection("memberEducation").doc(currentEditId).update(payload);
    } else {
      payload.createdByUid = window.NAP_CURRENT_UID;
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      writePromise = db.collection("memberEducation").add(payload);
    }

    writePromise
      .then(function () {
        window.napSaveButtonDone(sectionSubmitBtn, { savedLabel: "Saved" });
        window.setTimeout(function () {
          sectionModal.close();
        }, 550);
      })
      .catch(function () {
        window.napSaveButtonDone(sectionSubmitBtn, { error: true });
        sectionErrorEl.textContent = "Something went wrong. Please try again.";
        sectionErrorEl.hidden = false;
      });
  });
})();
