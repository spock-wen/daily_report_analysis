'use strict';

/**
 * r11c：渲染期静态 SVG（不引 chart.js）。
 * 色值对齐 SPEC / report-v3。
 */

const { formatCount, escapeHtml } = require('./wmh-v3-shared');

/** 图上读数：千级保留 1 位小数（对齐设计可读性；表仍用 formatCount） */
function formatChartCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const trim = (s) => s.replace(/\.0([kM])$/, '$1');
  if (abs >= 1000000) return trim(`${(n / 1000000).toFixed(1)}M`);
  if (abs >= 1000) return trim(`${(n / 1000).toFixed(1)}k`);
  return String(Math.round(n));
}

function shortWeek(week) {
  const s = String(week || '');
  const m = s.match(/W\d{1,2}/i);
  return m ? m[0].toUpperCase() : s;
}

const C = {
  primary: '#C2410C',
  priDeep: '#9A3412',
  accent: '#0F766E',
  chart2: '#E9A23B',
  meanLabel: '#8B5E3C',
  chart4: '#7C9A92',
  hero: '#F3E9D8',
  ink: '#2B2118',
  sub: '#6B5B4B',
  line: '#E8DDCB',
  card: '#FFFDF8',
};

function esc(s) {
  return escapeHtml(s);
}

function niceMax(max) {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const pad = max * 1.1;
  const mag = 10 ** Math.floor(Math.log10(pad));
  const n = pad / mag;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * mag;
}

/**
 * 月报 · 日度新增折线
 * @param {{ date: string, stars: number }[]} series
 * @param {{ month?: string }} [opts]
 */
function renderDailyLineSvg(series, opts = {}) {
  const points = (series || []).filter(p => p && Number.isFinite(Number(p.stars)));
  if (points.length === 0) {
    return `<svg class="svg-chart svg-daily" viewBox="0 0 640 200" role="img" aria-label="日度新增暂无数据"><text x="24" y="100" fill="${C.sub}" font-size="14">日度新增暂无数据</text></svg>`;
  }

  const values = points.map(p => Number(p.stars) || 0);
  const total = values.reduce((a, b) => a + b, 0);
  const mean = total / values.length;
  let peakIdx = 0;
  let valleyIdx = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[peakIdx]) peakIdx = i;
    if (values[i] < values[valleyIdx]) valleyIdx = i;
  }

  const W = 640;
  const H = 240;
  const padL = 44;
  const padR = 16;
  const padT = 36;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const yMax = niceMax(Math.max(...values, mean));
  const n = points.length;
  const xAt = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v) => padT + plotH - (v / yMax) * plotH;

  const poly = points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(values[i]).toFixed(1)}`).join(' ');
  const meanY = yAt(mean);

  // X 轴刻度：首、峰、谷、若干整点、末（去重）
  const xTicks = new Set([0, n - 1, peakIdx, valleyIdx]);
  for (let d = 5; d < n; d += 5) xTicks.add(Math.min(n - 1, d - 1));
  // 也标 day 1-based 的 1,5,10...
  for (let i = 0; i < n; i += 1) {
    const day = Number(String(points[i].date).slice(8));
    if ([1, 5, 10, 15, 20, 25, 30].includes(day)) xTicks.add(i);
  }
  const xTickList = Array.from(xTicks).sort((a, b) => a - b);

  const yTicks = [0, yMax / 2, yMax];
  const peak = points[peakIdx];
  const valley = points[valleyIdx];
  const peakLabel = `峰值 ${formatChartCount(values[peakIdx])} · ${String(peak.date).slice(5)}`;
  const valleyLabel = `谷值 ${formatChartCount(values[valleyIdx])} · ${String(valley.date).slice(5)}`;
  const meanLabel = `均值 ${formatChartCount(mean)}/天`;

  // 峰标注放上方；谷放下方；避开边缘
  const peakX = xAt(peakIdx);
  const peakY = yAt(values[peakIdx]);
  const valleyX = xAt(valleyIdx);
  const valleyY = yAt(values[valleyIdx]);
  const peakTextX = Math.min(W - 8, Math.max(padL, peakX));
  const valleyTextX = Math.min(W - 8, Math.max(padL, valleyX));

  const month = opts.month || String(points[0].date).slice(0, 7);

  return `<svg class="svg-chart svg-daily" viewBox="0 0 ${W} ${H}" role="img" aria-label="日度新增 Star ${esc(month)}">
<title>日度新增 Star · ${esc(month)}</title>
<rect x="0" y="0" width="${W}" height="${H}" fill="${C.card}" rx="4"/>
${yTicks.map(v => {
    const y = yAt(v);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${C.line}" stroke-width="1"/>
<text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${C.sub}" font-size="11">${esc(formatChartCount(v))}</text>`;
  }).join('\n')}
<line x1="${padL}" y1="${meanY.toFixed(1)}" x2="${W - padR}" y2="${meanY.toFixed(1)}" stroke="${C.chart2}" stroke-width="1.5" stroke-dasharray="6 4"/>
<text x="${padL + 4}" y="${(meanY - 6).toFixed(1)}" fill="${C.meanLabel}" font-size="12" font-weight="700">${esc(meanLabel)}</text>
<polyline fill="none" stroke="${C.primary}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${poly}"/>
${points.map((p, i) => {
    // 关键点加粗；其余稀疏描点
    const day = Number(String(p.date).slice(8));
    const key = i === peakIdx || i === valleyIdx || [1, 5, 10, 15, 20, 25, 30].includes(day) || i === 0 || i === n - 1;
    if (!key) return '';
    const r = (i === peakIdx || i === valleyIdx) ? 5 : 3;
    const fill = i === peakIdx ? C.primary : i === valleyIdx ? C.accent : C.ink;
    return `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(values[i]).toFixed(1)}" r="${r}" fill="${fill}"/>`;
  }).join('\n')}
<text x="${peakTextX.toFixed(1)}" y="${Math.max(14, peakY - 12).toFixed(1)}" text-anchor="middle" fill="${C.primary}" font-size="12" font-weight="700">${esc(peakLabel)}</text>
<text x="${valleyTextX.toFixed(1)}" y="${Math.min(H - 8, valleyY + 22).toFixed(1)}" text-anchor="middle" fill="${C.accent}" font-size="12" font-weight="700">${esc(valleyLabel)}</text>
${xTickList.map(i => {
    const day = Number(String(points[i].date).slice(8));
    return `<text x="${xAt(i).toFixed(1)}" y="${H - 12}" text-anchor="middle" fill="${C.sub}" font-size="11">${day}</text>`;
  }).join('\n')}
</svg>`;
}

function dailyLineFootnote(series) {
  const points = (series || []).filter(p => p && Number.isFinite(Number(p.stars)));
  if (!points.length) return '脚注：日度新增暂无数据。';
  const values = points.map(p => Number(p.stars) || 0);
  const total = values.reduce((a, b) => a + b, 0);
  const mean = total / values.length;
  let peakIdx = 0;
  let valleyIdx = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[peakIdx]) peakIdx = i;
    if (values[i] < values[valleyIdx]) valleyIdx = i;
  }
  return `脚注：全月合计 ${formatChartCount(total)} · 峰值 ${formatChartCount(values[peakIdx])}（${String(points[peakIdx].date).slice(5)}）· 谷值 ${formatChartCount(values[valleyIdx])}（${String(points[valleyIdx].date).slice(5)}）· 均值 ${formatChartCount(mean)}/天。手机保留峰/谷/均值标注。静态 SVG。`;
}

/**
 * 月报 · 四周新增柱
 * @param {{ week: string, stars: number }[]} bars
 */
function renderWeekBarsSvg(bars) {
  const items = (bars || []).slice(0, 4);
  while (items.length < 4) items.push({ week: `W${items.length + 1}`, stars: 0 });
  const values = items.map(b => Number(b.stars) || 0);
  const max = Math.max(1, ...values);
  const colors = [C.primary, C.chart2, C.accent, C.chart4];

  const W = 640;
  const H = 220;
  const padL = 24;
  const padR = 24;
  const padT = 36;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const gap = 28;
  const barW = (plotW - gap * (items.length - 1)) / items.length;

  const barEls = items.map((b, i) => {
    const v = values[i];
    const h = Math.max(4, (v / max) * plotH);
    const x = padL + i * (barW + gap);
    const y = padT + plotH - h;
    const label = formatChartCount(v);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="${colors[i]}"/>
<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="middle" fill="${C.priDeep}" font-size="14" font-weight="700">${esc(label)}</text>
<text x="${(x + barW / 2).toFixed(1)}" y="${H - 14}" text-anchor="middle" fill="${C.sub}" font-size="13">${esc(shortWeek(b.week))}</text>`;
  }).join('\n');

  return `<svg class="svg-chart svg-weekbars" viewBox="0 0 ${W} ${H}" role="img" aria-label="四周新增 Star 柱状">
<title>四周新增 Star · 柱状</title>
<rect x="0" y="0" width="${W}" height="${H}" fill="${C.card}" rx="4"/>
${barEls}
</svg>`;
}

function weekBarsFootnote(bars) {
  const items = (bars || []).slice(0, 4);
  if (!items.length) return '脚注：四周新增暂无数据。';
  const parts = items.map(b => `${shortWeek(b.week)} ${formatChartCount(b.stars)}`);
  const total = items.reduce((s, b) => s + (Number(b.stars) || 0), 0);
  if (total <= 0) {
    return `脚注：${parts.join(' · ')} · 合计约 ${formatChartCount(total)}。四周 brief 缺失或柱值为 0。`;
  }
  return `脚注：${parts.join(' · ')} · 合计约 ${formatChartCount(total)}。柱端数值可见。`;
}

/**
 * 周报 · Top≤10 横向柱
 * @param {{ fullName: string, stars: number }[]} rows
 * @param {{ total?: number, top1Share?: number, restTotal?: number, exHeadRate?: number|null }} [meta]
 */
function renderWeekTopSvg(rows, meta = {}) {
  const items = (rows || []).slice(0, 10);
  if (!items.length) {
    return `<svg class="svg-chart svg-weektop" viewBox="0 0 520 120" role="img" aria-label="本周 Top 暂无数据"><text x="16" y="64" fill="${C.sub}" font-size="14">本周 Top 暂无数据</text></svg>`;
  }
  const values = items.map(r => Number(r.stars) || 0);
  const max = Math.max(1, ...values);

  const rowH = 36;
  const padT = 8;
  const padB = 8;
  const W = 520;
  const H = padT + padB + items.length * rowH;
  const labelW = 168;
  const valueW = 64;
  const trackX = labelW + 8;
  const trackW = W - trackX - valueW - 8;

  const rowsSvg = items.map((r, i) => {
    const v = values[i];
    const y = padT + i * rowH;
    const bw = Math.max(2, (v / max) * trackW);
    const barColor = i === 0 ? C.primary : C.accent;
    const name = String(r.fullName || '').length > 22
      ? `${String(r.fullName).slice(0, 20)}…`
      : String(r.fullName || '');
    return `<text x="4" y="${y + 22}" fill="${C.ink}" font-size="12">${i + 1}. ${esc(name)}</text>
<rect x="${trackX}" y="${y + 10}" width="${trackW}" height="16" rx="4" fill="${C.hero}"/>
<rect x="${trackX}" y="${y + 10}" width="${bw.toFixed(1)}" height="16" rx="4" fill="${barColor}"/>
<text x="${W - 4}" y="${y + 22}" text-anchor="end" fill="${C.priDeep}" font-size="12" font-weight="700">${esc(formatChartCount(v))}</text>`;
  }).join('\n');

  return `<svg class="svg-chart svg-weektop" viewBox="0 0 ${W} ${H}" role="img" aria-label="本周 Top≤10 按新增星">
<title>本周 Top≤10 · 按本周新增星</title>
${rowsSvg}
</svg>`;
}

function weekTopFootnote(rows, meta = {}) {
  const items = (rows || []).slice(0, 10);
  if (!items.length) return '脚注：本周 Top 暂无数据。';
  const total = meta.total != null ? meta.total : items.reduce((s, r) => s + (Number(r.stars) || 0), 0);
  const top1 = Number(items[0]?.stars) || 0;
  const top1Share = meta.top1Share != null
    ? meta.top1Share
    : (total > 0 ? Math.round((top1 / total) * 1000) / 10 : 0);
  const rest = meta.restTotal != null
    ? meta.restTotal
    : Math.max(0, total - top1);
  const ex = meta.exHeadRate;
  const exText = ex != null && Number.isFinite(ex)
    ? `（环比剔头部 ${ex > 0 ? '+' : ''}${ex}%）`
    : '';
  return `脚注：总量 ${formatChartCount(total)} · Top1 占 ${top1Share}% · 其余 ${Math.max(0, items.length - 1)} 项合计 ${formatChartCount(rest)}${exText}。静态标注可读。`;
}

module.exports = {
  COLORS: C,
  renderDailyLineSvg,
  dailyLineFootnote,
  renderWeekBarsSvg,
  weekBarsFootnote,
  renderWeekTopSvg,
  weekTopFootnote,
};
