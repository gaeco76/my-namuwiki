/* 나만의 위키 — 차트 블록 렌더러 (ECharts 5, assets/vendor/echarts.min.js)
   <figure class="wiki-chart" data-chart="hbar|bar|count|spark" data-src="../data/x.json" data-path="a.b" ...> 를 찾아 그린다.
   추정치(status=estimate|forecast 또는 estimate=true)는 해칭 + 점선 테두리 + 반투명으로 보고치와 구분 (kpop-dashboard 와 같은 규칙). */
(function () {
  'use strict';
  if (!window.echarts) { document.querySelectorAll('.wiki-chart .chart-canvas').forEach(function (el) { el.innerHTML = '<div class="chart-error">차트 라이브러리를 불러오지 못했습니다. 아래 표를 참고하세요.</div>'; }); return; }
  var CACHE = {};
  function load(url) { if (!CACHE[url]) CACHE[url] = fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); }); return CACHE[url]; }
  function loadAny(urls) { var i = 0; function next(err) { if (i >= urls.length) return Promise.reject(err); return load(urls[i++]).catch(next); } return next(); }
  function get(o, path) { return (path || '').split('.').filter(Boolean).reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  var isDark = function () { return document.documentElement.getAttribute('data-theme') === 'dark'; };

  var ACC = { verified: ['검증', '#1f9d63'], partial: ['부분 확인', '#c9a227'], conflict: ['충돌', '#d64545'], claude: ['Claude 리서치 기준', '#8a5cc9'],
    grok: ['Grok 대화 기준', '#3c78c8'], unverified: ['미확인', '#9a9a9a'], forecast: ['전망', '#d68a3a'], estimate: ['추정', '#d68a3a'] };
  var BCLS = { verified: 'v', partial: 'p', conflict: 'c', claude: 'cl', grok: 'g', unverified: 'u', forecast: 'f', estimate: 'e' };
  var GROUP = { girl: ['걸그룹', '#e2537d'], boy: ['보이그룹', '#3c78c8'], coed: ['혼성', '#8a5cc9'], solo: ['솔로', '#d68a3a'] };
  var DECAL = { symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [3, 4], rotation: -Math.PI / 4, color: 'rgba(255,255,255,0.55)' };
  var nf = new Intl.NumberFormat('ko-KR');
  function fmt(v, f) {
    if (v == null || isNaN(v)) return '미확인';
    if (f === 'usd') return '$' + nf.format(Math.round(v));
    if (f === 'usdm') return v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : '$' + (v / 1e6).toFixed(1) + 'M';
    if (f === 'ko') return v >= 1e8 ? +(v / 1e8).toFixed(2) + '억' : v >= 1e4 ? +(v / 1e4).toFixed(1) + '만' : nf.format(v);
    return nf.format(v);
  }
  function badge(st) { return st && ACC[st] ? '<span class="badge b-' + BCLS[st] + '">' + ACC[st][0] + '</span>' : ''; }

  function render(fig) {
    var d = fig.dataset, el = fig.querySelector('.chart-canvas');
    var urls = [d.src].concat(d.srcAlt ? d.srcAlt.split(' ') : []);
    var srcDbUrl = d.sourcesDb;
    Promise.all([loadAny(urls), srcDbUrl ? load(srcDbUrl).catch(function () { return {}; }) : Promise.resolve({})]).then(function (res) {
      var json = res[0], SRC = res[1];
      var rows = get(json, d.path);
      if (!Array.isArray(rows)) throw new Error('data-path "' + d.path + '" 가 배열이 아님');
      (d.filter || '').split(';').filter(Boolean).forEach(function (f) { var p = f.split('='); rows = rows.filter(function (r) { return String(r[p[0]]) === p[1]; }); });
      var stF = d.status || 'status', estF = d.estimate || 'estimate', srcF = d.sources || 'sources';
      var hl = d.highlight ? d.highlight.split('|') : null;
      var items;
      if (d.chart === 'count') {
        var m = {}; rows.forEach(function (r) { var k = r[d.groupBy]; m[k] = (m[k] || 0) + 1; });
        items = Object.keys(m).sort().map(function (k) { return { label: (d.labelPrefix || '') + k + (d.labelSuffix || ''), value: m[k], st: d.statusDefault, est: false, row: {} }; });
      } else {
        items = rows.map(function (r) {
          var st = r[stF] || d.statusDefault || null;
          return { label: r[d.label] + (d.label2 && r[d.label2] ? ' · ' + r[d.label2] : ''), value: r[d.value] == null ? null : +r[d.value], text: d.text ? r[d.text] : null,
            st: st, est: !!r[estF] || st === 'estimate' || st === 'forecast', grp: d.group ? r[d.group] : null,
            hl: hl ? hl.indexOf(String(r[d.highlightField || d.label])) >= 0 : false, note: d.note ? r[d.note] : null, srcs: r[srcF] || [], row: r };
        });
      }
      var nulls = items.filter(function (x) { return x.value == null; });
      items = items.filter(function (x) { return x.value != null; });
      if (d.sort !== 'none') items.sort(function (a, b) { return d.sort === 'asc' ? a.value - b.value : b.value - a.value; });
      var all = items.slice();
      fig._draw = function (limit) {
        var it = limit ? all.slice(0, limit) : all;
        draw(fig, el, it, SRC);
      };
      fig._nulls = nulls;
      var lim = +d.limit || 0;
      var tools = fig.querySelector('.chart-tools');
      if (tools && !tools.dataset.bound) {
        tools.dataset.bound = 1;
        tools.addEventListener('click', function (e) {
          var b = e.target.closest('button[data-limit]'); if (!b) return;
          tools.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
          fig._lim = +b.dataset.limit; fig._draw(fig._lim);
        });
      }
      fig._lim = fig._lim != null ? fig._lim : lim;
      fig._draw(fig._lim);
      if (nulls.length && d.nullNote !== 'off') {
        var nn = fig.querySelector('.chart-nulls');
        if (nn) nn.innerHTML = '<span class="badge b-u">미확인</span> 값이 보고되지 않아 차트에서 뺀 항목 ' + nulls.length + '건: ' + nulls.map(function (x) { return esc(x.label); }).join(', ');
      }
    }).catch(function (err) {
      el.innerHTML = '<div class="chart-error">차트 데이터를 불러오지 못했습니다 (' + esc(err.message) + '). 본문 표를 참고하세요.</div>';
      if (window.console) console.warn('[wiki-charts]', err);
    });
  }

  function colorOf(fig, x) {
    var mode = fig.dataset.color || 'brand';
    if (mode === 'status') return (ACC[x.est ? 'estimate' : x.st] || ACC.unverified)[1];
    if (mode === 'group') return (GROUP[x.grp] || ['', '#888'])[1];
    if (mode === 'highlight') return x.hl ? css('--brand') : (isDark() ? '#5b636d' : '#b9c0c7');
    return css('--brand');
  }

  function draw(fig, el, items, SRC) {
    var d = fig.dataset, horiz = d.chart === 'hbar' || d.chart === 'spark', mini = d.chart === 'spark';
    var text = css('--text'), muted = css('--muted'), line = css('--line'), card = css('--card'), border = css('--border');
    if (horiz && !mini) el.style.height = Math.max(220, items.length * (+d.rowH || 24) + 60) + 'px';
    var data = items.map(function (x) {
      var c = colorOf(fig, x);
      var style = x.est ? { color: c, opacity: 0.5, decal: DECAL, borderColor: c, borderType: 'dashed', borderWidth: 1.5 }
                        : { color: c, opacity: (x.st === 'claude' || x.st === 'grok' || x.st === 'partial') && fig.dataset.color !== 'status' ? 0.75 : 1 };
      if (horiz) style.borderRadius = [0, 3, 3, 0]; else style.borderRadius = [3, 3, 0, 0];
      return { value: x.value, itemStyle: style, _x: x };
    });
    var cats = items.map(function (x) { return x.label; });
    var narrow = el.clientWidth < 520;
    var valAxis = { type: 'value', splitNumber: narrow ? 3 : 5, axisLabel: { color: muted, fontSize: 11, hideOverlap: true, formatter: function (v) { return fmt(v, d.format === 'usd' ? 'usdm' : (d.axisFormat || 'ko')); } },
      splitLine: { lineStyle: { color: line, type: 'dashed' } }, axisLine: { show: false } };
    var catAxis = { type: 'category', data: cats, inverse: horiz, axisTick: { show: false }, axisLine: { lineStyle: { color: border } },
      axisLabel: { color: text, fontSize: 11.5, interval: 0, width: horiz ? Math.min(200, Math.round(el.clientWidth * 0.3)) : 80, overflow: 'truncate', rotate: !horiz && cats.length > 8 ? 30 : 0 } };
    var opt = {
      backgroundColor: 'transparent', animationDuration: 400,
      textStyle: { fontFamily: getComputedStyle(document.body).fontFamily },
      grid: mini ? { left: 0, right: 0, top: 0, bottom: 0 } : { left: 8, right: narrow ? 56 : 70, top: 14, bottom: 8, containLabel: true },
      tooltip: mini ? { show: false } : {
        trigger: 'item', confine: true, backgroundColor: card, borderColor: border, textStyle: { color: text, fontSize: 12 }, extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,.2);border-radius:6px;',
        formatter: function (p) {
          var x = p.data._x;
          var srcs = (x.srcs || []).map(function (k) { return SRC[k] ? esc(SRC[k].title) : esc(k); });
          return '<div class="chart-tip"><div class="tt-title">' + esc(x.label) + '</div>' +
            '<div class="tt-row"><span>' + esc(d.valueLabel || '값') + '</span><b>' + (x.text ? esc(x.text) : fmt(x.value, d.format)) + (d.unit ? esc(d.unit) : '') + '</b></div>' +
            (x.est ? '<div class="tt-row"><span>정렬·막대 기준값</span><span>' + fmt(x.value, d.format) + '</span></div>' : '') +
            '<div style="margin-top:4px">' + badge(x.st) + (x.est && x.st !== 'estimate' && x.st !== 'forecast' ? badge('estimate') : '') + '</div>' +
            (x.note ? '<div class="tt-note">' + esc(x.note) + '</div>' : '') +
            (srcs.length ? '<div class="tt-note">출처: ' + srcs.join(' · ') + '</div>' : '') + '</div>';
        }
      },
      xAxis: horiz ? valAxis : catAxis, yAxis: horiz ? catAxis : valAxis,
      series: [{ type: 'bar', data: data, barMaxWidth: horiz ? 18 : 42, barCategoryGap: '28%',
        label: mini ? { show: false } : { show: true, position: horiz ? 'right' : 'top', color: muted, fontSize: 11,
          formatter: function (p) { var x = p.data._x; return (x.text && x.est ? x.text : fmt(x.value, d.labelFormat || d.format)) + (x.est ? ' (추정)' : ''); } } }]
    };
    if (mini) { opt.xAxis = { type: 'value', show: false }; opt.yAxis = { type: 'category', data: cats, show: false, inverse: true }; }
    var inst = echarts.getInstanceByDom(el); if (inst) inst.dispose();
    inst = echarts.init(el, null, { renderer: 'canvas' });
    inst.setOption(opt);
    fig.dataset.rendered = String(items.length);
  }

  var figs = Array.prototype.slice.call(document.querySelectorAll('.wiki-chart[data-chart]'));
  // 화면에 들어올 때 그리기 (접힌 문단에 있으면 펼칠 때)
  function visible(f) { return f.offsetParent !== null; }
  function tick() { figs.forEach(function (f) { if (!f.dataset.started && visible(f)) { f.dataset.started = 1; render(f); } }); }
  tick();
  document.addEventListener('click', function () { setTimeout(tick, 30); });
  document.addEventListener('toggle', function () { setTimeout(tick, 30); }, true);
  document.addEventListener('wiki:theme', function () { figs.forEach(function (f) { if (f._draw) f._draw(f._lim); }); });
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { figs.forEach(function (f) { var el = f.querySelector('.chart-canvas'); var i = el && echarts.getInstanceByDom(el); if (i) i.resize(); }); }, 150); });
})();
