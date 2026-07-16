/* ==========================================================================
   Blue Oak Express Bank — site behaviour
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ *
   * Guilloché — engine-turned line work, the pattern engraved on
   * banknotes and share certificates. Built from a hypotrochoid:
   *
   *   x(t) = (R-r)·cos t + d·cos(((R-r)/r)·t)
   *   y(t) = (R-r)·sin t − d·sin(((R-r)/r)·t)
   *
   * Drawing the same curve at several values of d nests the rosettes
   * and produces the moiré that makes the pattern hard to counterfeit.
   * ------------------------------------------------------------------ */
  /* The curve only closes after r/gcd(R,r) revolutions, so R and r are chosen
   * to share a factor. R=240,r=70 (gcd 10) closes in 7 turns; picking coprime
   * values instead would need 70 turns and megabytes of path data. */
  function hypotrochoid(R, r, d, steps, cx, cy) {
    var pts = [];
    var k = (R - r) / r;
    var turns = r / gcd(R, r);
    var total = steps * turns;
    for (var i = 0; i <= total; i++) {
      var t = (i / steps) * Math.PI * 2;
      var x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
      var y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
      pts.push((cx + x).toFixed(1) + "," + (cy + y).toFixed(1));
    }
    return "M" + pts.join("L");
  }

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  function buildGuilloche(opts) {
    var size = opts.size || 600;
    var cx = size / 2, cy = size / 2;
    var svgns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    var g = document.createElementNS(svgns, "g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", opts.stroke || "#C9A227");
    g.setAttribute("stroke-width", opts.width || 0.6);

    // Nest rosettes by walking d — this is what creates the moiré.
    var rings = opts.rings || 14;
    var steps = opts.steps || 90;
    for (var i = 0; i < rings; i++) {
      var d = opts.dStart + i * opts.dStep;
      var path = document.createElementNS(svgns, "path");
      path.setAttribute("d", hypotrochoid(opts.R, opts.r, d, steps, cx, cy));
      path.setAttribute("opacity", (0.28 + (i / rings) * 0.5).toFixed(2));
      g.appendChild(path);
    }
    svg.appendChild(g);
    return svg;
  }

  function paintGuilloche() {
    document.querySelectorAll("[data-guilloche]").forEach(function (el) {
      if (el.dataset.painted) return;
      var preset = el.dataset.guilloche || "certificate";
      var svg;
      if (preset === "card") {
        // 3 turns — reads cleaner at small size and low opacity
        svg = buildGuilloche({
          size: 560, R: 250, r: 75, dStart: 46, dStep: 4.4, rings: 10,
          steps: 90, stroke: "#FFFFFF", width: 0.5
        });
      } else if (preset === "watermark") {
        // Page-scale security watermark. Fewer rings and coarser steps than
        // the certificate: it renders huge, so the line count is what costs.
        svg = buildGuilloche({
          size: 560, R: 240, r: 70, dStart: 44, dStep: 7.5, rings: 9,
          steps: 70, stroke: "#2A5378", width: 0.7
        });
      } else {
        // 7 turns — the dense banknote weave
        svg = buildGuilloche({
          size: 560, R: 240, r: 70, dStart: 50, dStep: 4.6, rings: 14,
          steps: 90, stroke: "#C9A227", width: 0.55
        });
      }
      el.appendChild(svg);
      el.dataset.painted = "1";
    });
  }

  /* ------------------------------------------------------------------ *
   * Balance count-up
   * ------------------------------------------------------------------ */
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  function countUp(el) {
    var target = parseFloat(el.dataset.value || "0");
    if (isNaN(target)) return;

    var fmt = new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD",
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });

    if (reduced) { el.textContent = fmt.format(target); return; }

    var duration = 1400;
    var start = null;

    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      el.textContent = fmt.format(target * easeOutExpo(p));
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = fmt.format(target);
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ *
   * Staggered reveal
   * ------------------------------------------------------------------ */
  function revealAll() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

    items.forEach(function (el, i) {
      if (!el.style.getPropertyValue("--d")) {
        el.style.setProperty("--d", Math.min(i * 70, 500) + "ms");
      }
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------ *
   * Navbar
   * ------------------------------------------------------------------ */
  function initNav() {
    var toggle = document.getElementById("menu-toggle");
    var drawer = document.getElementById("drawer");
    var backdrop = document.getElementById("drawer-backdrop");
    var closeBtn = document.getElementById("drawer-close");
    var navbar = document.getElementById("navbar");

    if (toggle && drawer && backdrop) {
      var lastFocused = null;

      var focusables = function () {
        return drawer.querySelectorAll("a[href], button:not([disabled])");
      };

      var openDrawer = function () {
        lastFocused = document.activeElement;
        backdrop.hidden = false;
        // next frame so the transition actually runs
        requestAnimationFrame(function () { backdrop.classList.add("show"); });
        drawer.classList.add("open");
        drawer.removeAttribute("inert");
        drawer.setAttribute("aria-hidden", "false");
        toggle.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close menu");
        document.body.style.overflow = "hidden";      // stop the page scrolling behind
        var f = focusables();
        if (f.length) f[0].focus();
      };

      var closeDrawer = function () {
        backdrop.classList.remove("show");
        drawer.classList.remove("open");
        drawer.setAttribute("inert", "");
        drawer.setAttribute("aria-hidden", "true");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        document.body.style.overflow = "";
        setTimeout(function () {
          if (!drawer.classList.contains("open")) backdrop.hidden = true;
        }, 340);
        if (lastFocused) lastFocused.focus();
      };

      var isOpen = function () { return drawer.classList.contains("open"); };

      toggle.addEventListener("click", function () {
        isOpen() ? closeDrawer() : openDrawer();
      });
      backdrop.addEventListener("click", closeDrawer);
      if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

      document.addEventListener("keydown", function (e) {
        if (!isOpen()) return;

        if (e.key === "Escape") { closeDrawer(); return; }

        // keep tabbing inside the drawer while it's open
        if (e.key === "Tab") {
          var f = focusables();
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
          }
        }
      });

      // close if the viewport grows past the breakpoint while it's open
      window.matchMedia("(min-width: 861px)").addEventListener("change", function (m) {
        if (m.matches && isOpen()) closeDrawer();
      });
    }

    if (navbar) {
      var ticking = false;
      window.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          navbar.classList.toggle("shrink", window.scrollY > 24);
          ticking = false;
        });
      }, { passive: true });
    }

    // mark the current page across every nav surface
    var here = window.location.pathname.replace(/\/$/, "");
    document.querySelectorAll(".nav-desktop a, .drawer-nav a").forEach(function (a) {
      var href = a.getAttribute("href").replace(/\/$/, "");
      if (href && href === here) a.setAttribute("aria-current", "page");
    });
  }

  /* ------------------------------------------------------------------ *
   * Auth page — segmented control + password reveal
   * ------------------------------------------------------------------ */
  function initAuth() {
    var seg = document.querySelector(".segmented");

    if (seg) {
      var tabs = {
        signin: document.getElementById("tab-signin"),
        signup: document.getElementById("tab-signup")
      };
      var panes = {
        signin: document.getElementById("panel-signin"),
        signup: document.getElementById("panel-signup")
      };

      var select = function (key, focus) {
        Object.keys(tabs).forEach(function (k) {
          var on = k === key;
          tabs[k].setAttribute("aria-selected", String(on));
          tabs[k].setAttribute("tabindex", on ? "0" : "-1");
          panes[k].hidden = !on;
        });
        seg.dataset.active = key;
        if (focus) tabs[key].focus();
        history.replaceState(null, "", key === "signup" ? "#signup" : " ");
      };

      Object.keys(tabs).forEach(function (k) {
        tabs[k].addEventListener("click", function () { select(k); });
      });

      // left/right arrows move between tabs, per the tablist pattern
      seg.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        select(seg.dataset.active === "signup" ? "signin" : "signup", true);
      });

      // deep link: /login#signup opens the request pane, and the
      // request-invite redirect comes back to that anchor
      select(window.location.hash === "#signup" ? "signup" : "signin");
    }

    var pw = document.getElementById("pwToggle");
    if (pw) {
      var input = document.getElementById("password");
      pw.addEventListener("click", function () {
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        pw.setAttribute("aria-pressed", String(show));
        pw.setAttribute("aria-label", show ? "Hide password" : "Show password");
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Flash messages — dismiss + auto-expire
   * ------------------------------------------------------------------ */
  function initFlashes() {
    document.querySelectorAll(".alert").forEach(function (el, i) {
      var btn = el.querySelector(".dismiss");
      function close() {
        el.classList.add("leaving");
        setTimeout(function () { el.remove(); }, 320);
      }
      if (btn) btn.addEventListener("click", close);
      if (el.classList.contains("success") || el.classList.contains("info")) {
        setTimeout(close, 5200 + i * 400);
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Payment card widget
   * ------------------------------------------------------------------ */
  function groups(num) {
    var n = String(num || "").replace(/\s+/g, "");
    // Amex is 4-6-5; everything else groups in 4s
    if (n.length === 15) return n.slice(0, 4) + " " + n.slice(4, 10) + " " + n.slice(10);
    return (n.match(/.{1,4}/g) || [n]).join(" ");
  }

  function mask(num) {
    var n = String(num || "").replace(/\s+/g, "");
    if (n.length < 8) return n;
    return n.slice(0, 4) + " •••• •••• " + n.slice(-4);
  }

  function initCard() {
    var flip = document.getElementById("cardFlip");
    if (!flip) return;

    var numEl = document.getElementById("cardNumberDisplay");
    var cvvEl = document.getElementById("cvvDisplay");
    var flipBtn = document.getElementById("flipBtn");
    var revealBtn = document.getElementById("revealCvvBtn");
    var copyBtn = document.getElementById("copyCardBtn");

    var rawNumber = flip.dataset.number || "";
    var rawCvv = flip.dataset.cvv || "";

    if (numEl) numEl.textContent = mask(rawNumber);
    if (cvvEl) cvvEl.textContent = "•••";

    /* ---- Flip ---- */
    var flipped = false;
    function setFlip(next) {
      flipped = next;
      flip.classList.toggle("flipped", flipped);
      if (flipBtn) {
        flipBtn.setAttribute("aria-pressed", String(flipped));
        flipBtn.textContent = flipped ? "Show front" : "Flip card";
      }
      // CVV only exists on the back, so only reveal it there
      if (cvvEl) cvvEl.textContent = flipped ? rawCvv : "•••";
    }
    if (flipBtn) flipBtn.addEventListener("click", function () { setFlip(!flipped); });

    /* ---- Reveal number ---- */
    var shown = false;
    if (revealBtn) {
      revealBtn.addEventListener("click", function () {
        shown = !shown;
        if (numEl) numEl.textContent = shown ? groups(rawNumber) : mask(rawNumber);
        revealBtn.setAttribute("aria-pressed", String(shown));
        revealBtn.textContent = shown ? "Hide number" : "Reveal number";
        if (shown && flipped) setFlip(false);
      });
    }

    /* ---- Copy ---- */
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = groups(rawNumber);
        var done = function () {
          copyBtn.textContent = "Copied";
          setTimeout(function () { copyBtn.textContent = "Copy number"; }, 1300);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, done);
        } else {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); } catch (e) { /* no-op */ }
          document.body.removeChild(ta);
          done();
        }
      });
    }

    /* ---- Parallax tilt (pointer only, composed with the flip rotation) ---- */
    if (!reduced && window.matchMedia("(hover: hover)").matches) {
      var stage = flip.parentElement;
      stage.addEventListener("mousemove", function (e) {
        var b = flip.getBoundingClientRect();
        var px = (e.clientX - b.left) / b.width - 0.5;
        var py = (e.clientY - b.top) / b.height - 0.5;
        // the flip is 180deg of rotateY; add the tilt on top of it
        var base = flipped ? 180 : 0;
        flip.style.transform =
          "rotateY(" + (base + px * 8).toFixed(2) + "deg) " +
          "rotateX(" + (-py * 8).toFixed(2) + "deg)";
      });
      stage.addEventListener("mouseleave", function () {
        flip.style.transform = "";
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Balance visibility toggle
   * ------------------------------------------------------------------ */
  function initBalanceToggle() {
    var btn = document.getElementById("balanceToggle");
    var fig = document.getElementById("balanceFigure");
    if (!btn || !fig) return;

    btn.addEventListener("click", function () {
      var hidden = fig.classList.toggle("hidden");
      btn.setAttribute("aria-pressed", String(hidden));
      btn.setAttribute("aria-label", hidden ? "Show balance" : "Hide balance");
    });
  }

  /* ------------------------------------------------------------------ *
   * Monthly activity chart
   * ------------------------------------------------------------------ */
  function initChart() {
    var el = document.getElementById("activityChart");
    if (!el) return;

    var series;
    try { series = JSON.parse(el.dataset.series || "[]"); }
    catch (e) { series = []; }

    if (!series.length) {
      el.innerHTML = '<p class="chart-empty">No activity to chart yet.</p>';
      return;
    }

    var peak = 0;
    series.forEach(function (m) { peak = Math.max(peak, m["in"], m.out); });
    if (peak <= 0) {
      el.innerHTML = '<p class="chart-empty">No activity to chart yet.</p>';
      return;
    }

    var money = new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", maximumFractionDigits: 0
    });

    series.forEach(function (m) {
      var col = document.createElement("div");
      col.className = "chart-col";

      var bars = document.createElement("div");
      bars.className = "chart-bars";

      [["in", m["in"]], ["out", m.out]].forEach(function (pair) {
        var bar = document.createElement("div");
        bar.className = "bar " + pair[0];
        bar.dataset.kind = pair[0];
        bar.dataset.label = (pair[0] === "in" ? "In " : "Out ") + money.format(pair[1]);
        // floor at 2% so an empty month still shows a baseline tick
        var pct = pair[1] > 0 ? Math.max((pair[1] / peak) * 100, 2) : 0;
        bar.style.setProperty("--h", pct + "%");
        bars.appendChild(bar);
      });

      var label = document.createElement("div");
      label.className = "chart-label";
      label.textContent = m.label;

      col.appendChild(bars);
      col.appendChild(label);
      el.appendChild(col);
    });

    // grow the bars once the chart scrolls into view
    var grow = function () {
      el.querySelectorAll(".bar").forEach(function (b, i) {
        setTimeout(function () { b.style.height = b.style.getPropertyValue("--h"); },
                   reduced ? 0 : i * 45);
      });
    };

    if ("IntersectionObserver" in window && !reduced) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          grow();
          io.disconnect();
        });
      }, { threshold: 0.25 });
      io.observe(el);
    } else {
      grow();
    }

    // stat cards filter the chart
    document.querySelectorAll(".stat[data-stat]").forEach(function (card) {
      card.addEventListener("click", function () {
        var on = card.getAttribute("aria-pressed") !== "true";
        card.setAttribute("aria-pressed", String(on));
        el.querySelectorAll('.bar[data-kind="' + card.dataset.stat + '"]')
          .forEach(function (b) { b.classList.toggle("muted", !on); });
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Reveal footer
   * The footer is fixed behind the page sheet. The sheet needs exactly as
   * much bottom margin as the footer is tall, otherwise you either can't
   * scroll far enough to see all of it, or you overshoot into dead space.
   * Its height changes with the breakpoint, so measure rather than hardcode.
   * ------------------------------------------------------------------ */
  function initFooterReveal() {
    var footer = document.getElementById("site-footer");
    var page = document.getElementById("page");
    if (!footer || !page) return;

    var apply = function () {
      // never ask for more scroll room than a screenful
      var h = Math.min(footer.offsetHeight, window.innerHeight);
      document.documentElement.style.setProperty("--footer-h", h + "px");
    };

    apply();

    // A fixed footer is always in the DOM, so keyboard users can Tab into it
    // while it's still covered by the sheet — focus would land on links they
    // can't see. Reveal it instead of trapping focus somewhere invisible.
    footer.addEventListener("focusin", function () {
      var atBottom = window.innerHeight + window.scrollY >=
                     document.documentElement.scrollHeight - 4;
      if (atBottom) return;
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: reduced ? "auto" : "smooth"
      });
    });

    if ("ResizeObserver" in window) {
      new ResizeObserver(apply).observe(footer);
    }
    // The RO only watches the footer. Rotating a phone flips innerHeight —
    // which apply() clamps against — so listen for that too.
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", function () {
      // iOS reports stale metrics if you measure immediately
      setTimeout(apply, 120);
    });
    // fonts landing late changes the footer's height
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(apply);
    }
  }

  /* ------------------------------------------------------------------ *
   * Background watermark parallax
   * ------------------------------------------------------------------ */
  function initParallax() {
    var wm = document.querySelector(".paper-watermark");
    if (!wm || reduced) return;

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        // Clamped: the watermark now lives inside the clipped sheet, so an
        // unbounded drift would pull it out of view on a long page.
        var shift = Math.max(window.scrollY * -0.12, -130);
        wm.style.setProperty("--shift", shift.toFixed(1) + "px");
        ticking = false;
      });
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ *
   * Send form — disable + spinner on submit
   * ------------------------------------------------------------------ */
  function initSendForm() {
    var form = document.getElementById("sendForm");
    if (!form) return;
    form.addEventListener("submit", function () {
      var btn = document.getElementById("sendBtn");
      var spinner = document.getElementById("spinner");
      var label = document.getElementById("btnText");
      if (btn) btn.disabled = true;
      if (spinner) spinner.hidden = false;
      if (label) label.textContent = "Sending";
    });
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  function init() {
    paintGuilloche();
    initFooterReveal();
    initNav();
    initAuth();
    initFlashes();
    initCard();
    initBalanceToggle();
    initChart();
    initParallax();
    initSendForm();
    document.querySelectorAll("[data-countup]").forEach(countUp);
    revealAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
