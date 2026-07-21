/* design-doc nav.js — sidebar + diagram zoom (no CDN / works on file://) */
(function () {
  /* ---------- sidebar hamburger ---------- */
  var KEY = "design-doc-sidebar";
  var btn = document.getElementById("sideToggle");

  function isMobile() {
    return window.matchMedia("(max-width:900px)").matches;
  }

  function applySidebar(open) {
    if (!btn) return;
    document.body.classList.toggle("sidebar-collapsed", !open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    btn.setAttribute("title", open ? "メニューを閉じる" : "メニューを開く");
    try {
      localStorage.setItem(KEY, open ? "open" : "closed");
    } catch (e) {}
  }

  if (btn) {
    var open = true;
    try {
      var v = localStorage.getItem(KEY);
      if (v === "closed") open = false;
      if (v === "open") open = true;
      if (v == null && isMobile()) open = false;
    } catch (e) {
      if (isMobile()) open = false;
    }
    applySidebar(open);

    btn.addEventListener("click", function () {
      var currentlyOpen = !document.body.classList.contains("sidebar-collapsed");
      applySidebar(!currentlyOpen);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isMobile() && !document.body.classList.contains("sidebar-collapsed")) {
        applySidebar(false);
      }
    });
  }

  /* ---------- diagram lightbox (SVG + img) ---------- */
  var dlg = document.getElementById("zoomDlg");
  var stage = document.getElementById("zoomStage");
  if (!dlg || !stage) return;

  var titleEl = dlg.querySelector(".title");
  var cur = null;
  var kind = "svg"; // "svg" | "img"
  var scale = 1;
  var base = 1;
  var tx = 0;
  var ty = 0;
  var vw = 0;
  var vh = 0;
  var savedScrollY = 0;
  var scrollLocked = false;

  function clamp(s) {
    return Math.min(Math.max(s, base * 0.5), base * 8);
  }

  function applyTransform() {
    if (!cur) return;
    cur.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
  }

  /** dialog 開閉でページ先頭へ飛ばないようスクロール位置を固定 */
  function lockPageScroll() {
    if (scrollLocked) return;
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    scrollLocked = true;
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.position = "fixed";
    document.body.style.top = "-" + savedScrollY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
  }

  function unlockPageScroll() {
    if (!scrollLocked) return;
    scrollLocked = false;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
    document.documentElement.style.scrollBehavior = "";
    window.scrollTo(0, savedScrollY);
  }

  function measure(cb) {
    if (kind === "img") {
      if (cur.complete && cur.naturalWidth) {
        vw = cur.naturalWidth;
        vh = cur.naturalHeight;
        cb();
      } else {
        cur.addEventListener(
          "load",
          function () {
            vw = cur.naturalWidth || cur.width || 1200;
            vh = cur.naturalHeight || cur.height || 800;
            cb();
          },
          { once: true }
        );
      }
      return;
    }
    try {
      var box = cur.viewBox && cur.viewBox.baseVal;
      if (box && box.width) {
        vw = box.width;
        vh = box.height;
      } else {
        var bb = cur.getBBox();
        vw = bb.width || 960;
        vh = bb.height || 600;
      }
    } catch (e) {
      vw = 960;
      vh = 600;
    }
    cb();
  }

  function fit() {
    if (!cur) return;
    measure(function () {
      cur.style.width = vw + "px";
      cur.style.height = vh + "px";
      cur.style.maxWidth = "none";
      var sw = stage.clientWidth;
      var sh = stage.clientHeight;
      base = Math.min(sw / vw, sh / vh) * 0.96;
      if (!isFinite(base) || base <= 0) base = 1;
      scale = base;
      tx = (sw - vw * scale) / 2;
      ty = (sh - vh * scale) / 2;
      applyTransform();
    });
  }

  function zoomAt(cx, cy, factor) {
    var ns = clamp(scale * factor);
    tx = cx - (cx - tx) * (ns / scale);
    ty = cy - (cy - ty) * (ns / scale);
    scale = ns;
    applyTransform();
  }

  function openZoom(fig, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    var svg = fig.querySelector("svg");
    var img = fig.querySelector("img");
    stage.innerHTML = "";
    cur = null;

    if (svg) {
      kind = "svg";
      cur = svg.cloneNode(true);
      cur.removeAttribute("width");
      cur.removeAttribute("height");
    } else if (img) {
      kind = "img";
      cur = document.createElement("img");
      cur.src = img.currentSrc || img.src;
      cur.alt = img.alt || "";
      cur.draggable = false;
    } else {
      return;
    }

    cur.style.position = "absolute";
    cur.style.top = "0";
    cur.style.left = "0";
    cur.style.transformOrigin = "0 0";
    cur.style.maxWidth = "none";
    cur.style.userSelect = "none";
    cur.style.pointerEvents = "none";
    stage.appendChild(cur);

    var cap = fig.querySelector("figcaption");
    titleEl.textContent = cap
      ? cap.textContent.trim()
      : img && img.alt
        ? img.alt
        : "図解";

    lockPageScroll();
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");

    // showModal 後のフォーカス移動でスクロールが跳ぶ場合に備え復元
    requestAnimationFrame(function () {
      window.scrollTo(0, 0); // body fixed 時は 0 のまま
      // フォーカスはスクロールさせない
      var closeBtn = dlg.querySelector('button[data-z="close"]');
      if (closeBtn && closeBtn.focus) {
        try {
          closeBtn.focus({ preventScroll: true });
        } catch (e) {
          closeBtn.focus();
        }
      }
      fit();
    });
  }

  function bindFig(fig) {
    if (fig.dataset.zoomBound === "1") return;
    fig.dataset.zoomBound = "1";
    fig.setAttribute("role", "button");
    fig.setAttribute("tabindex", "0");
    fig.setAttribute("title", "クリックで拡大");
    fig.addEventListener("click", function (e) {
      openZoom(fig, e);
    });
    fig.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openZoom(fig, e);
      }
    });
  }

  function targets() {
    return document.querySelectorAll("figure.diagram, .mermaid, .prose figure.diagram");
  }

  targets().forEach(bindFig);

  // Also: bare prose img that is a diagram asset (svg/png under assets/)
  document.querySelectorAll(".prose img").forEach(function (img) {
    if (img.closest("figure.diagram")) return;
    var src = img.getAttribute("src") || "";
    if (!/assets\/.*\.(svg|png|jpe?g|webp)(\?|$)/i.test(src) && !/状態遷移|diagram/i.test(src + (img.alt || ""))) {
      return;
    }
    var fig = document.createElement("figure");
    fig.className = "diagram";
    img.parentNode.insertBefore(fig, img);
    fig.appendChild(img);
    var hint = document.createElement("p");
    hint.className = "zoom-hint";
    hint.textContent = "クリックで拡大";
    fig.appendChild(hint);
    bindFig(fig);
  });

  var bar = dlg.querySelector(".zoom-bar");
  if (bar) {
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var z = b.getAttribute("data-z");
      var cx = stage.clientWidth / 2;
      var cy = stage.clientHeight / 2;
      if (z === "in") zoomAt(cx, cy, 1.25);
      else if (z === "out") zoomAt(cx, cy, 0.8);
      else if (z === "reset") fit();
      else if (z === "close") dlg.close();
    });
  }

  stage.addEventListener(
    "wheel",
    function (e) {
      if (!dlg.open) return;
      e.preventDefault();
      var r = stage.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 0.89);
    },
    { passive: false }
  );

  var drag = false;
  var px = 0;
  var py = 0;
  stage.addEventListener("pointerdown", function (e) {
    if (!dlg.open) return;
    drag = true;
    px = e.clientX;
    py = e.clientY;
    stage.classList.add("dragging");
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", function (e) {
    if (!drag) return;
    tx += e.clientX - px;
    ty += e.clientY - py;
    px = e.clientX;
    py = e.clientY;
    applyTransform();
  });
  function endDrag() {
    drag = false;
    stage.classList.remove("dragging");
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  dlg.addEventListener("click", function (e) {
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener("close", function () {
    unlockPageScroll();
    stage.innerHTML = "";
    cur = null;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && dlg.open) dlg.close();
  });
  window.addEventListener("resize", function () {
    if (dlg.open && cur) fit();
  });
})();
