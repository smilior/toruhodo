/* design-doc enhance.js — 閲覧強化（未記入可視化・ページ内目次・(例)行淡色化・
   記入ガイド折りたたみ・サイドバー検索/追従）。
   依存なし / defer 読込 / file:// でも動作。fetch 失敗時は該当機能のみ無効化する。 */
(function () {
  "use strict";
  var main = document.querySelector("main");

  function each(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }
  /* 個別機能の例外を他機能へ波及させない */
  function run(fn) {
    try { fn(); } catch (e) {}
  }

  /* ---------- favicon(データURI。favicon.ico の 404 回避) ---------- */
  run(function () {
    if (document.querySelector('link[rel="icon"]')) return;
    var l = document.createElement("link");
    l.rel = "icon";
    l.href = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#00a984"/><rect x="9" y="10" width="14" height="2.6" rx="1.3" fill="#fff"/><rect x="9" y="15" width="14" height="2.6" rx="1.3" fill="#fff" opacity=".85"/><rect x="9" y="20" width="9" height="2.6" rx="1.3" fill="#fff" opacity=".7"/></svg>'
    );
    document.head.appendChild(l);
  });

  /* ---------- a. 未記入プレースホルダの可視化 ---------- */
  run(function () {
    if (!main) return;
    var RE = /\{\{[^{}]+\}\}/g;
    var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, MARK: 1 };
    var walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.indexOf("{{") === -1) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        while (p && p !== main) {
          if (SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);

    var count = 0;
    each(nodes, function (node) {
      var text = node.nodeValue;
      RE.lastIndex = 0;
      if (!RE.test(text)) return;
      RE.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      while ((m = RE.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var mark = document.createElement("mark");
        mark.className = "ph";
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
        count++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });

    if (count > 0) {
      var hero = main.querySelector(".hero") || main;
      var chips = hero.querySelector(".chips");
      if (!chips) {
        chips = document.createElement("div");
        chips.className = "chips";
        hero.appendChild(chips);
      }
      var chip = document.createElement("span");
      chip.className = "chip chip-todo";
      chip.innerHTML = "<b>未記入</b> " + count + "箇所";
      chips.appendChild(chip);
    }
  });

  /* ---------- b. ページ内目次 ---------- */
  run(function () {
    var prose = main && main.querySelector(".prose");
    if (!prose) return;
    var hs;
    try {
      hs = prose.querySelectorAll(":scope > h2");
    } catch (e) {
      /* :scope 非対応環境向けフォールバック（直下 h2 のみ抽出） */
      hs = Array.prototype.filter.call(prose.querySelectorAll("h2"), function (h2) {
        return h2.parentNode === prose;
      });
    }
    if (hs.length < 3) return;

    var toc = document.createElement("nav");
    toc.className = "page-toc";
    toc.setAttribute("aria-label", "このページの内容");
    var head = document.createElement("p");
    head.className = "page-toc-h";
    head.textContent = "このページの内容";
    toc.appendChild(head);
    var ul = document.createElement("ul");
    each(hs, function (h2, i) {
      if (!h2.id) h2.id = "sec-" + (i + 1);
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h2.id;
      a.textContent = (h2.textContent || "").trim();
      li.appendChild(a);
      ul.appendChild(li);
    });
    toc.appendChild(ul);

    var hero = main.querySelector(".hero");
    if (hero && hero.parentNode) hero.parentNode.insertBefore(toc, hero.nextSibling);
    else prose.parentNode.insertBefore(toc, prose);
  });

  /* ---------- c. （例）行の淡色化 ---------- */
  run(function () {
    if (!main) return;
    each(main.querySelectorAll("table tr"), function (tr) {
      var cell = tr.querySelector("td, th");
      if (!cell) return;
      var t = (cell.textContent || "").replace(/^\s+/, "");
      if (t.indexOf("(例)") === 0 || t.indexOf("（例）") === 0) tr.classList.add("ex-row");
    });
  });

  /* ---------- d. 記入ガイドの折りたたみ ---------- */
  run(function () {
    if (!main) return;
    var KEY = "design-doc-guide-open";
    var openPref = true;
    try { if (localStorage.getItem(KEY) === "closed") openPref = false; } catch (e) {}

    each(main.querySelectorAll(".callout"), function (callout) {
      var title = callout.querySelector(".callout-title");
      if (!title || (title.textContent || "").trim() !== "記入ガイド") return;

      var details = document.createElement("details");
      details.className = callout.className + " callout-details";
      if (openPref) details.setAttribute("open", "");
      var summary = document.createElement("summary");
      summary.textContent = "記入ガイド";
      details.appendChild(summary);

      /* callout-title 以外の子ノードを details 本体へ移す（プレースホルダ mark も保持） */
      var kids = Array.prototype.slice.call(callout.childNodes);
      each(kids, function (k) {
        if (k === title) return;
        details.appendChild(k);
      });

      callout.parentNode.replaceChild(details, callout);
      details.addEventListener("toggle", function () {
        try { localStorage.setItem(KEY, details.open ? "open" : "closed"); } catch (e) {}
      });
    });
  });

  /* ---------- e. サイドバー（検索 ＋ アクティブ追従） ---------- */
  run(function () {
    var aside = document.getElementById("sidePanel");
    var sideNav = document.querySelector("nav.side-nav");

    /* アクティブ項目に aria-current を付与し、サイドバーを自動スクロール */
    if (aside) {
      var active = aside.querySelector(".side-nav a.active");
      if (active) {
        active.setAttribute("aria-current", "page");
        if (!document.body.classList.contains("sidebar-collapsed")) {
          try {
            var ar = aside.getBoundingClientRect();
            var lr = active.getBoundingClientRect();
            if (lr.top < ar.top || lr.bottom > ar.bottom) {
              aside.scrollTop += (lr.top - ar.top) - aside.clientHeight / 2 + lr.height / 2;
            }
          } catch (e) {}
        }
      }
    }

    if (!sideNav) return;

    /* 検索ボックスを side-nav 先頭に挿入 */
    var box = document.createElement("div");
    box.className = "side-search";
    var input = document.createElement("input");
    input.type = "search";
    input.placeholder = "ページを検索…";
    input.setAttribute("aria-label", "ページを検索");
    box.appendChild(input);
    sideNav.insertBefore(box, sideNav.firstChild);

    var lis = Array.prototype.slice.call(sideNav.querySelectorAll("li"));
    var phases = Array.prototype.slice.call(sideNav.querySelectorAll(".phase"));

    function titleOf(li) {
      var a = li.querySelector("a");
      if (!a) return "";
      var t = "";
      each(a.childNodes, function (nd) {
        if (nd.nodeType === 1 && nd.classList && nd.classList.contains("n")) return;
        t += nd.textContent || "";
      });
      return t.trim();
    }
    function normPath(href) {
      href = (href || "").split("#")[0].split("?")[0];
      try { href = decodeURIComponent(href); } catch (e) {}
      return href.replace(/^(?:\.\.?\/)+/, "");
    }

    each(lis, function (li) {
      li._title = titleOf(li).toLowerCase();
      var a = li.querySelector("a");
      li._path = a ? normPath(a.getAttribute("href")) : "";
      li._base = li._path.split("/").pop();
    });

    var headingMap = null; /* path/basename -> "title + headings"(小文字) */

    function filter() {
      var q = input.value.trim().toLowerCase();
      each(lis, function (li) {
        var hit = !q || li._title.indexOf(q) !== -1;
        if (!hit && q && headingMap) {
          var hv = headingMap[li._path] || headingMap[li._base];
          if (hv && hv.indexOf(q) !== -1) hit = true;
        }
        li.style.display = hit ? "" : "none";
      });
      each(phases, function (ph) {
        var visible = false;
        each(ph.querySelectorAll("li"), function (li) {
          if (li.style.display !== "none") visible = true;
        });
        ph.style.display = visible ? "" : "none";
      });
    }
    input.addEventListener("input", filter);

    /* 見出しインデックスを取得（失敗時はタイトル部分一致のみで動作） */
    try {
      var self = document.querySelector('script[src*="assets/enhance.js"]');
      var url = self ? self.src.replace(/enhance\.js(?:[?#].*)?$/, "search-index.json") : null;
      if (url) {
        fetch(url)
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (!data) return;
            headingMap = {};
            each(data, function (e) {
              var val = ((e.title || "") + " " + (e.headings || []).join(" ")).toLowerCase();
              var p = normPath(e.path);
              headingMap[p] = val;
              var base = p.split("/").pop();
              if (base) headingMap[base] = val;
            });
            if (input.value) filter();
          })
          .catch(function () {});
      }
    } catch (e) {}
  });
})();
