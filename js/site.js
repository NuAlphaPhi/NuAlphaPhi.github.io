(function () {
  "use strict";

  var header = document.getElementById("site-header");
  var nav = document.getElementById("site-nav");
  var toggle = document.querySelector(".nav-toggle");

  function setHeaderState() {
    if (!header) return;
    var hero = document.querySelector(".hero");
    var scrolled = window.scrollY > 40;
    header.classList.toggle("is-scrolled", scrolled);
    if (!hero) {
      header.classList.add("is-solid");
    } else {
      header.classList.remove("is-solid");
    }
  }

  function closeMobileNav() {
    if (!nav || !toggle) return;
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    nav.querySelectorAll(".nav-item.is-open").forEach(function (item) {
      item.classList.remove("is-open");
      var chevron = item.querySelector(".nav-chevron-btn");
      if (chevron) chevron.setAttribute("aria-expanded", "false");
    });
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
  }

  document.querySelectorAll(".nav-chevron-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      if (window.innerWidth > 900) return;
      e.preventDefault();
      e.stopPropagation();
      var item = btn.closest(".nav-item");
      var isOpen = item.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  });

  document.querySelectorAll(".nav-trigger .nav-btn, .nav-link:not(.nav-cta)").forEach(function (link) {
    link.addEventListener("click", function () {
      if (window.innerWidth <= 900) closeMobileNav();
      if (link.blur) link.blur();
    });
  });

  document.querySelectorAll(".nav-dropdown a, .page-subnav a").forEach(function (link) {
    link.addEventListener("click", closeMobileNav);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeMobileNav();
      document.querySelectorAll("dialog.modal-overlay[open]").forEach(function (d) {
        d.close();
      });
    }
  });

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  window.addEventListener("scroll", setHeaderState, { passive: true });
  setHeaderState();

  function setLayoutMetrics() {
    var subnav = document.querySelector(".page-subnav");
    document.documentElement.style.setProperty("--subnav-h", subnav ? subnav.offsetHeight + "px" : "0px");
  }

  setLayoutMetrics();
  window.addEventListener("resize", setLayoutMetrics);

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function getStickyOffset() {
    var header = document.getElementById("site-header");
    var subnav = document.querySelector(".page-subnav");
    var offset = header ? header.offsetHeight : 76;
    if (subnav) offset += subnav.offsetHeight;
    var gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--scroll-gap")) || 12;
    return offset + gap;
  }

  function prepareSectionForScroll(section) {
    if (!section) return;
    section.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-visible", "is-scroll-target");
    });
    void section.offsetHeight;
  }

  function clearScrollTargets() {
    document.querySelectorAll(".reveal.is-scroll-target").forEach(function (el) {
      el.classList.remove("is-scroll-target");
    });
  }

  function getSectionContentTarget(section) {
    if (section.id === "index") {
      return section.querySelector(".cta-panel") || section;
    }
    return (
      section.querySelector(".section-label") ||
      section.querySelector(".section-header") ||
      section.querySelector(".split__content") ||
      section.querySelector(".container")
    ) || section;
  }

  function scrollToAnchor(target) {
    if (!target) return;
    var section = target.matches && target.matches("section[id]") ? target : target.closest("section[id]");
    if (section) prepareSectionForScroll(section);
    var scrollTarget = section && target === section ? getSectionContentTarget(section) : target;
    var extraGap = section && section.id === "index" ? 48 : 0;
    var top = scrollTarget.getBoundingClientRect().top + window.scrollY - getStickyOffset() - extraGap;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: reducedMotion ? "auto" : "smooth",
    });
    window.setTimeout(clearScrollTargets, reducedMotion ? 0 : 700);
  }

  /* Scroll progress bar */
  if (!reducedMotion) {
    var progressBar = document.createElement("div");
    progressBar.className = "scroll-progress";
    progressBar.setAttribute("aria-hidden", "true");
    document.body.appendChild(progressBar);

    function updateProgress() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
      progressBar.style.width = pct + "%";
    }

    window.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();
  }

  /* Chapter card tilt */
  if (!reducedMotion) {
    document.querySelectorAll(".chapter-card:not(.chapter-card--static)").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
          "perspective(500px) rotateY(" + (x * 10).toFixed(1) + "deg) rotateX(" + (-y * 10).toFixed(1) + "deg) translateY(-4px)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transform = "";
      });
    });
  }

  /* Smooth scroll for same-page anchors */
  var updateSubnav = null;

  document.querySelectorAll('a[href*="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      var hashIndex = href.indexOf("#");
      if (hashIndex === -1) return;

      var path = href.slice(0, hashIndex) || window.location.pathname.replace(/^\//, "").replace(/\.html$/, "") || "index";
      var hash = href.slice(hashIndex);
      var current = window.location.pathname.replace(/^\//, "").replace(/\.html$/, "") || "index";

      if (path !== current && path !== "" && path !== "index" && !href.startsWith("#")) return;

      var target = document.querySelector(hash);
      if (!target) return;

      e.preventDefault();
      scrollToAnchor(target);
      history.pushState(null, "", window.location.pathname + window.location.search + hash);
      if (updateSubnav) updateSubnav();
    });
  });

  /* Active subnav highlight */
  var subnavLinks = document.querySelectorAll(".page-subnav a");
  if (subnavLinks.length) {
    var sections = [];
    subnavLinks.forEach(function (link) {
      var id = link.getAttribute("href");
      if (id && id.startsWith("#")) {
        var el = document.querySelector(id);
        if (el) {
          sections.push({
            link: link,
            el: el,
            content: getSectionContentTarget(el),
          });
        }
      }
    });

    function setActiveSubnav(link) {
      subnavLinks.forEach(function (l) {
        l.classList.remove("is-active");
      });
      if (link) link.classList.add("is-active");
    }

    updateSubnav = function () {
      var hash = window.location.hash;
      if (hash) {
        var hashEntry = sections.find(function (s) {
          return s.link.getAttribute("href") === hash;
        });
        if (hashEntry) {
          setActiveSubnav(hashEntry.link);
          return;
        }
      }

      var scrollPos = window.scrollY + getStickyOffset() + 8;
      var current = sections[0];
      sections.forEach(function (s) {
        var top = s.content.getBoundingClientRect().top + window.scrollY;
        if (top <= scrollPos) current = s;
      });
      setActiveSubnav(current ? current.link : null);
    };

    function scrollToHashTarget() {
      var hash = window.location.hash;
      if (!hash) return;
      var hashTarget = document.querySelector(hash);
      if (!hashTarget) return;
      scrollToAnchor(hashTarget);
      updateSubnav();
    }

    function scheduleHashScroll() {
      scrollToHashTarget();
      window.setTimeout(scrollToHashTarget, 100);
      window.setTimeout(scrollToHashTarget, 400);
    }

    window.addEventListener("scroll", updateSubnav, { passive: true });
    window.addEventListener("hashchange", function () {
      scrollToHashTarget();
      updateSubnav();
    });
    setLayoutMetrics();
    updateSubnav();

    if (window.location.hash) {
      requestAnimationFrame(scheduleHashScroll);
      window.addEventListener("load", scheduleHashScroll);
    }
  }

  /* Scroll reveal */
  if (!reducedMotion) {
    var revealEls = document.querySelectorAll(".reveal");
    if (revealEls.length && "IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      revealEls.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* Event modals (blog) */
  document.querySelectorAll("[data-modal]").forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      var id = trigger.getAttribute("data-modal");
      var dialog = document.getElementById(id);
      if (dialog && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    });
  });

  document.querySelectorAll("dialog.modal-overlay").forEach(function (dialog) {
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
    var closeBtn = dialog.querySelector("[data-close-modal]");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        dialog.close();
      });
    }
  });

  /* Contact form */
  var contactForm = document.getElementById("contactForm");
  var formFeedback = document.getElementById("form-feedback");
  if (contactForm && formFeedback) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var submitBtn = contactForm.querySelector(".form-submit");
      var emailField = contactForm.querySelector('[name="email"]');
      var replyToField = contactForm.querySelector('[name="_replyto"]');
      var subjectField = contactForm.querySelector('[name="_subject"]');
      var topicField = contactForm.querySelector('[name="topic"]');
      var firstName = contactForm.querySelector('[name="first_name"]');
      var lastName = contactForm.querySelector('[name="last_name"]');

      if (emailField && replyToField) {
        replyToField.value = emailField.value;
      }

      if (subjectField) {
        var topic = topicField && topicField.value ? topicField.value : "General Inquiry";
        var name = [firstName && firstName.value, lastName && lastName.value].filter(Boolean).join(" ");
        subjectField.value = "NAΦ Website — " + topic + (name ? " (" + name + ")" : "");
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      fetch(contactForm.action, {
        method: "POST",
        body: new FormData(contactForm),
        headers: { Accept: "application/json" },
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (res.ok) {
              formFeedback.textContent = "Message sent — we'll be in touch soon.";
              formFeedback.className = "form-feedback form-feedback--success";
              formFeedback.hidden = false;
              contactForm.reset();
              return;
            }

            var code = data.errors && data.errors[0] && data.errors[0].code;
            var message = data.error || (data.errors && data.errors[0] && data.errors[0].message);

            if (code === "FORM_NOT_FOUND") {
              throw new Error(
                "This form isn't connected to Formspree yet. Create a form at formspree.io and use its form ID in the action URL."
              );
            }

            throw new Error(message || "Something went wrong. Please try again.");
          });
        })
        .catch(function (err) {
          formFeedback.textContent = err.message || "Something went wrong. Please try again.";
          formFeedback.className = "form-feedback form-feedback--error";
          formFeedback.hidden = false;
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send Message";
        });
    });
  }

  /* Portal gate (placeholder auth — replace with real brother login later) */
  var portalGate = document.getElementById("portal-gate");
  var portalContent = document.getElementById("portal-content");
  var portalForm = document.getElementById("portalLoginForm");
  var portalError = document.getElementById("portal-error");
  var portalSignOut = document.getElementById("portalSignOut");
  var portalSession = document.getElementById("portalSession");
  var portalPledgeName = document.getElementById("portalPledgeName");
  var PORTAL_KEY = "nap_portal_auth";
  var PORTAL_USER_KEY = "nap_portal_user";
  var PORTAL_USERNAME = "kaiser";
  var PORTAL_PASSWORD = "Wongian242";

  /* Preview brother profiles — replace with API/database lookup later */
  var PORTAL_USERS = {
    kaiser: {
      firstName: "Kaiser",
      lastName: "Brother",
      pledgeName: "Kaiser",
      pledgeNumber: "TBD",
      semesterCrossed: "TBD",
      chapter: "TBD",
      class: "TBD",
      idNumber: "TBD",
    },
  };

  function getPortalUser(username) {
    if (!username) return null;
    return PORTAL_USERS[username.toLowerCase()] || null;
  }

  function updatePortalSessionLabel(username) {
    var user = getPortalUser(username);
    if (portalPledgeName && user) {
      portalPledgeName.textContent = user.pledgeName;
    }
  }

  function portalEmailMatches(emailValue) {
    var normalized = emailValue.trim();
    if (!normalized) return false;
    var at = normalized.indexOf("@");
    var localPart = at >= 0 ? normalized.slice(0, at) : normalized;
    return localPart.toLowerCase() === PORTAL_USERNAME;
  }

  function showPortal(authenticated, username) {
    if (!portalGate || !portalContent) return;
    portalGate.hidden = authenticated;
    portalContent.hidden = !authenticated;
    if (portalSession) portalSession.hidden = !authenticated;
    if (authenticated) updatePortalSessionLabel(username);
  }

  if (portalGate && portalContent) {
    try {
      showPortal(
        sessionStorage.getItem(PORTAL_KEY) === "1",
        sessionStorage.getItem(PORTAL_USER_KEY)
      );
    } catch (err) {
      showPortal(false);
    }
  }

  if (portalForm) {
    portalForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("portal-email");
      var password = document.getElementById("portal-password");
      if (!email.value || !password.value) {
        if (portalError) {
          portalError.textContent = "Enter your email and password.";
          portalError.hidden = false;
        }
        return;
      }
      if (!portalEmailMatches(email.value) || password.value !== PORTAL_PASSWORD) {
        if (portalError) {
          portalError.textContent = "Invalid email or password. Please try again.";
          portalError.hidden = false;
        }
        return;
      }
      try {
        sessionStorage.setItem(PORTAL_KEY, "1");
        sessionStorage.setItem(PORTAL_USER_KEY, PORTAL_USERNAME);
      } catch (err) {
        /* ignore */
      }
      if (portalError) portalError.hidden = true;
      showPortal(true, PORTAL_USERNAME);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (portalSignOut) {
    portalSignOut.addEventListener("click", function () {
      try {
        sessionStorage.removeItem(PORTAL_KEY);
        sessionStorage.removeItem(PORTAL_USER_KEY);
      } catch (err) {
        /* ignore */
      }
      showPortal(false);
      if (portalForm) portalForm.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

})();
