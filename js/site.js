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
    }
  }

  function closeMobileNav() {
    if (!nav || !toggle) return;
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    nav.querySelectorAll(".nav-item.is-open").forEach(function (item) {
      item.classList.remove("is-open");
      var btn = item.querySelector(".nav-btn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
  }

  document.querySelectorAll(".nav-item--dropdown .nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      if (window.innerWidth > 900) return;
      e.preventDefault();
      var item = btn.closest(".nav-item");
      var isOpen = item.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
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

  window.addEventListener("scroll", setHeaderState, { passive: true });
  setHeaderState();

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", hash);
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
        if (el) sections.push({ link: link, el: el });
      }
    });

    function updateSubnav() {
      var scrollPos = window.scrollY + 120;
      var current = sections[0];
      sections.forEach(function (s) {
        if (s.el.offsetTop <= scrollPos) current = s;
      });
      subnavLinks.forEach(function (l) {
        l.classList.remove("is-active");
      });
      if (current) current.link.classList.add("is-active");
    }

    window.addEventListener("scroll", updateSubnav, { passive: true });
    updateSubnav();
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
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      fetch(contactForm.action, {
        method: "POST",
        body: new FormData(contactForm),
        headers: { Accept: "application/json" },
      })
        .then(function (res) {
          if (res.ok) {
            formFeedback.textContent = "Message sent — we'll be in touch soon.";
            formFeedback.className = "form-feedback form-feedback--success";
            formFeedback.hidden = false;
            contactForm.reset();
          } else {
            throw new Error("send failed");
          }
        })
        .catch(function () {
          formFeedback.textContent = "Something went wrong. Please try again.";
          formFeedback.className = "form-feedback form-feedback--error";
          formFeedback.hidden = false;
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send Message";
        });
    });
  }
})();
