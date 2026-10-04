/* 나만의 위키 — 디자인 v2 클라이언트 스크립트 (의존성 없음)
   기능: 제목 검색 · 다크 모드 · 모바일 메뉴 · 목차 접기/현재 위치 · 문단 접기 · 각주 미리보기 · 표 정렬/필터 · 맨 위로 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 테마 ---------- */
  var root = document.documentElement;
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('wiki-theme', t); } catch (e) {}
    document.dispatchEvent(new CustomEvent('wiki:theme', { detail: t }));
  }
  var tb = $('#themeBtn');
  if (tb) tb.addEventListener('click', function () { setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); });

  /* ---------- 모바일 메뉴 ---------- */
  var mb = $('#menuBtn');
  if (mb) mb.addEventListener('click', function () {
    var bar = $('.topbar'); var open = bar.classList.toggle('menu-open'); mb.setAttribute('aria-expanded', open);
  });

  /* ---------- 검색 (window.WIKI_DOCS = [{t,u,d,c}]) ---------- */
  (function () {
    var D = window.WIKI_DOCS || [], q = $('#q'), box = $('#qres'), btn = $('#qbtn'), sel = -1;
    function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, ''); }
    function match(v) {
      v = norm(v); if (!v) return [];
      var a = D.filter(function (d) { return norm(d.t).indexOf(v) >= 0; });
      var b = D.filter(function (d) { return norm(d.t).indexOf(v) < 0 && (norm(d.d).indexOf(v) >= 0 || norm((d.c || []).join(' ')).indexOf(v) >= 0 || (d.a || []).some(function (x) { return norm(x).indexOf(v) >= 0; })); });
      return a.concat(b);
    }
    function hl(t, v) { var i = t.toLowerCase().indexOf(v.toLowerCase()); return i < 0 || !v ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + v.length)) + '</mark>' + esc(t.slice(i + v.length)); }
    function show() {
      var r = match(q.value); sel = -1;
      if (!r.length) { box.style.display = q.value ? 'block' : 'none'; box.innerHTML = q.value ? '<a>일치하는 문서가 없습니다</a>' : ''; return; }
      box.innerHTML = r.slice(0, 12).map(function (d) { return '<a href="' + d.u + '">' + hl(d.t, q.value.trim()) + '<span class="d">' + esc(d.d) + '</span></a>'; }).join('');
      box.style.display = 'block';
    }
    function go() { var r = match(q.value); if (r.length === 1 || (r.length && norm(r[0].t) === norm(q.value))) location.href = r[0].u; else if (q.value) location.href = 'search.html?q=' + encodeURIComponent(q.value); }
    if (!q) return;
    q.addEventListener('input', show); q.addEventListener('focus', function () { if (q.value) show(); });
    q.addEventListener('keydown', function (e) {
      var a = $$('a[href]', box);
      if (e.key === 'ArrowDown') sel = Math.min(sel + 1, a.length - 1);
      else if (e.key === 'ArrowUp') sel = Math.max(sel - 1, 0);
      else if (e.key === 'Enter') { if (sel >= 0 && a[sel]) location.href = a[sel].getAttribute('href'); else go(); return; }
      else if (e.key === 'Escape') { box.style.display = 'none'; return; }
      else return;
      e.preventDefault(); a.forEach(function (x, i) { x.classList.toggle('sel', i === sel); });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.search')) box.style.display = 'none'; });
    document.addEventListener('keydown', function (e) { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); q.focus(); } });
    btn.addEventListener('click', go);
  })();

  /* ---------- 목차 ---------- */
  $$('.wiki-toc').forEach(function (toc) {
    var b = $('.toc-toggle', toc); if (!b) return;
    if (window.matchMedia('(max-width:760px)').matches && toc.hasAttribute('data-collapse-mobile')) { toc.classList.add('collapsed'); b.textContent = '[펼치기]'; b.setAttribute('aria-expanded', 'false'); }
    b.addEventListener('click', function () { var c = toc.classList.toggle('collapsed'); b.textContent = c ? '[펼치기]' : '[접기]'; b.setAttribute('aria-expanded', String(!c)); });
  });

  /* ---------- 문단 접기 (h2~h4.wiki-heading 다음 형제를 다음 같은/상위 제목까지 숨김) ---------- */
  var body = $('.wiki-body');
  function levelOf(el) { return el && el.classList && el.classList.contains('wiki-heading') && !el.classList.contains('fn-head') ? +el.tagName.charAt(1) : 0; }
  function applyFolds() {
    if (!body) return;
    var kids = Array.prototype.slice.call(body.children), hideBelow = 99; // hideBelow: 접힌 제목의 수준
    kids.forEach(function (el) {
      var lv = levelOf(el);
      if (el.classList.contains('footnotes')) { hideBelow = 99; el.classList.remove('fold-hidden'); return; }
      if (lv && lv <= hideBelow) { hideBelow = 99; }
      el.classList.toggle('fold-hidden', hideBelow !== 99);
      if (lv && hideBelow === 99 && el.classList.contains('folded')) hideBelow = lv;
    });
  }
  $$('.wiki-heading .h-fold').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault(); var h = b.closest('.wiki-heading'); var f = h.classList.toggle('folded');
      b.setAttribute('aria-expanded', String(!f)); b.title = f ? '문단 펼치기' : '문단 접기'; applyFolds();
    });
  });
  // 해시로 접힌 문단 안을 가리키면 펼친다
  function unfoldTo(id) {
    var t = id && document.getElementById(id); if (!t) return;
    var changed = false;
    $$('.wiki-heading.folded').forEach(function (h) { if (t.closest('.fold-hidden') || t === h) { h.classList.remove('folded'); changed = true; } });
    if (changed) applyFolds();
    var d = t.closest('details'); if (d) d.open = true;
  }
  window.addEventListener('hashchange', function () { unfoldTo(location.hash.slice(1)); });
  document.addEventListener('click', function (e) { var a = e.target.closest('a[href^="#"]'); if (a) unfoldTo(a.getAttribute('href').slice(1)); }, true);

  /* 목차 현재 위치 강조 */
  var heads = $$('.wiki-body .wiki-heading[id]');
  if ('IntersectionObserver' in window && heads.length) {
    var tocMap = {}; $$('.toc-item').forEach(function (it) { var a = $('a', it); if (a) tocMap[a.getAttribute('href').slice(1)] = it; });
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { $$('.toc-item.active').forEach(function (x) { x.classList.remove('active'); }); var it = tocMap[en.target.id]; if (it) it.classList.add('active'); } });
    }, { rootMargin: '-60px 0px -70% 0px' });
    heads.forEach(function (h) { io.observe(h); });
  }

  /* ---------- 각주 미리보기 ---------- */
  var pop = null, popFor = null, hideT = null;
  function fnContent(a) {
    var id = (a.getAttribute('href') || '').slice(1), li = document.getElementById(id); if (!li) return null;
    var bodyEl = $('.fn-body', li); return { n: a.textContent.replace(/[\[\]]/g, ''), html: bodyEl ? bodyEl.innerHTML : li.innerHTML, id: id };
  }
  function showPop(a) {
    var c = fnContent(a); if (!c) return;
    clearTimeout(hideT);
    if (!pop) {
      pop = document.createElement('div'); pop.className = 'fn-pop'; pop.setAttribute('role', 'tooltip'); document.body.appendChild(pop);
      pop.addEventListener('mouseenter', function () { clearTimeout(hideT); });
      pop.addEventListener('mouseleave', function () { hideT = setTimeout(hidePop, 200); });
    }
    pop.innerHTML = '<span class="fn-pop-n">[' + esc(c.n) + ']</span>' + c.html + '<span class="fn-pop-meta"><a href="#' + c.id + '">각주 목록으로 이동 ↓</a></span>';
    pop.style.display = 'block'; popFor = a;
    var r = a.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.max(8, Math.min(window.scrollX + r.left - 20, window.scrollX + document.documentElement.clientWidth - pw - 8));
    var top = window.scrollY + r.bottom + 6;
    if (r.bottom + ph + 12 > window.innerHeight && r.top > ph + 70) top = window.scrollY + r.top - ph - 6;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function hidePop() { if (pop) pop.style.display = 'none'; popFor = null; }
  var touch = window.matchMedia('(hover: none)').matches;
  $$('sup.fn a').forEach(function (a) {
    a.removeAttribute('title');
    if (!touch) {
      a.addEventListener('mouseenter', function () { showPop(a); });
      a.addEventListener('mouseleave', function () { hideT = setTimeout(hidePop, 250); });
      a.addEventListener('focus', function () { showPop(a); });
      a.addEventListener('blur', function () { hideT = setTimeout(hidePop, 250); });
    } else {
      a.addEventListener('click', function (e) { if (popFor !== a) { e.preventDefault(); showPop(a); } });
    }
  });
  document.addEventListener('click', function (e) { if (pop && !e.target.closest('.fn-pop') && !e.target.closest('sup.fn')) hidePop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hidePop(); });
  // 각주 백링크: 돌아간 위치를 잠깐 강조
  $$('.fn-backs a').forEach(function (a) { a.addEventListener('click', function () { var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) { t.classList.add('flash'); setTimeout(function () { t.classList.remove('flash'); }, 1600); } }); });

  /* ---------- 표 정렬 ---------- */
  function cellVal(td) {
    if (!td) return null;
    if (td.hasAttribute('data-sort')) { var ds = td.getAttribute('data-sort'); return ds === '' ? null : (isNaN(+ds) ? ds : +ds); }
    var t = td.textContent.replace(/\[\d+\]/g, '').trim();
    if (!t || /^(미확인|—|-|작성 필요|날짜 미정.*)$/.test(t)) return null;
    var m = t.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); if (m) return +(m[1] + m[2] + (m[3] || '00'));
    var s = t.replace(/[,\s$₩~약+]/g, '');
    m = s.match(/^(-?[\d.]+)(조|억|만|천|[kKmMbB])?/);
    if (m && /^-?[\d.]+(조|억|만|천|[kKmMbB]|명|회|건|팀|위|세대|%|원|장)?/.test(s)) {
      var mul = { '조': 1e12, '억': 1e8, '만': 1e4, '천': 1e3, k: 1e3, K: 1e3, m: 1e6, M: 1e6, b: 1e9, B: 1e9 }[m[2]] || 1;
      return parseFloat(m[1]) * mul;
    }
    return t;
  }
  var coll = new Intl.Collator('ko', { numeric: true });
  function makeSortable(tbl) {
    var thead = tbl.tHead, tb = tbl.tBodies[0]; if (!thead || !tb || tb.rows.length < 3) return;
    var ths = Array.prototype.slice.call(thead.rows[0].cells);
    tbl.setAttribute('data-sortable-on', '');
    Array.prototype.slice.call(tb.rows).forEach(function (r, i) { r.dataset.idx = i; });
    ths.forEach(function (th, ci) {
      if (th.hasAttribute('data-nosort')) return;
      th.classList.add('sortable'); th.tabIndex = 0; th.title = '클릭하여 정렬';
      function sort() {
        var dir = th.getAttribute('aria-sort') === 'descending' ? 'ascending' : (th.getAttribute('aria-sort') === 'ascending' ? 'none' : null);
        var rows = Array.prototype.slice.call(tb.rows);
        var vals = rows.map(function (r) { return cellVal(r.cells[ci]); });
        var numeric = vals.filter(function (v) { return v !== null; }).every(function (v) { return typeof v === 'number'; });
        if (dir === null) dir = numeric ? 'descending' : 'ascending';
        ths.forEach(function (x) { x.removeAttribute('aria-sort'); });
        var order = rows.map(function (r, i) { return { r: r, v: vals[i] }; });
        if (dir === 'none') order.sort(function (a, b) { return a.r.dataset.idx - b.r.dataset.idx; });
        else {
          th.setAttribute('aria-sort', dir);
          order.sort(function (a, b) {
            if (a.v === null && b.v === null) return a.r.dataset.idx - b.r.dataset.idx;
            if (a.v === null) return 1; if (b.v === null) return -1; // 미확인은 항상 아래
            var c = (typeof a.v === 'number' && typeof b.v === 'number') ? a.v - b.v : coll.compare(String(a.v), String(b.v));
            return dir === 'ascending' ? c : -c;
          });
        }
        order.forEach(function (o) { tb.appendChild(o.r); });
      }
      th.addEventListener('click', sort);
      th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); } });
    });
  }
  $$('table.wikitable').forEach(function (t) { if (!t.hasAttribute('data-nosort')) makeSortable(t); });

  /* 표 필터 (data-filter 가 붙은 표에 검색창) */
  $$('table.wikitable[data-filter]').forEach(function (t) {
    var wrap = t.closest('.table-wrap'); var bar = document.createElement('div'); bar.className = 'table-tools';
    var n = t.tBodies[0].rows.length;
    bar.innerHTML = '<input type="search" placeholder="표 안에서 찾기…" aria-label="표 필터"><span class="count">' + n + '행</span>';
    wrap.parentNode.insertBefore(bar, wrap);
    var inp = $('input', bar), cnt = $('.count', bar);
    inp.addEventListener('input', function () {
      var v = inp.value.trim().toLowerCase(), k = 0;
      Array.prototype.slice.call(t.tBodies[0].rows).forEach(function (r) { var ok = !v || r.textContent.toLowerCase().indexOf(v) >= 0; r.style.display = ok ? '' : 'none'; if (ok) k++; });
      cnt.textContent = v ? k + '행 / ' + n + '행' : n + '행';
    });
  });

  /* ---------- 검색 결과 페이지 ---------- */
  var R = $('#searchResults');
  if (R) {
    var v = new URLSearchParams(location.search).get('q') || '', D = window.WIKI_DOCS || [];
    var nv = v.toLowerCase().replace(/\s+/g, '');
    var r = D.filter(function (d) { return (d.t + d.d + (d.c || []).join('') + (d.a || []).join(' ')).toLowerCase().replace(/\s+/g, '').indexOf(nv) >= 0; });
    if ($('#q')) $('#q').value = v;
    R.innerHTML = r.length ? r.map(function (d) { return '<li><a class="wiki-link" href="' + d.u + '">' + esc(d.t) + '</a> <span class="muted">— ' + esc(d.d) + '</span></li>'; }).join('') : '<li>"' + esc(v) + '"와(과) 일치하는 문서가 없습니다.</li>';
  }

  /* ---------- 맨 위로 ---------- */
  var tt = $('#toTop');
  if (tt) { window.addEventListener('scroll', function () { tt.classList.toggle('show', window.scrollY > 600); }, { passive: true }); tt.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }); }
})();
/* 각주 백링크 '+N' 펼치기 */
document.querySelectorAll('.fn-more-btn').forEach(function (b) {
  b.addEventListener('click', function () { var m = b.previousElementSibling; m.hidden = !m.hidden; b.textContent = m.hidden ? '+' + m.children.length : '접기'; });
});
