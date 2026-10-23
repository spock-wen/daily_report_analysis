'use strict';

/**
 * r11c：周/月趋势图结构门（三块静态 SVG）。
 * 月报另守：四周主题非空且四柱合计为 0 → FAIL。
 * 同类点各需 pass/fail；Checker 0 不算过。
 */

const { makeFinding } = require('./util');

const WEEKLY_REQUIRED = [
  { id: 'week-top-chart', re: /id="week-top-chart"|本周 Top≤10|本周 Top&lt;=10/ },
  { id: 'week-top-svg', re: /class="svg-chart svg-weektop"|svg-weektop/ },
  { id: 'no-chartjs', re: /./ }, // handled in forbidden
];

const WEEKLY_FORBIDDEN = [
  { id: 'chartjs', re: /cdn\.jsdelivr\.net\/npm\/chart|new Chart\(/i },
];

const MONTHLY_REQUIRED = [
  { id: 'daily-chart', re: /id="daily-chart"|日度新增 Star/ },
  { id: 'daily-svg', re: /class="svg-chart svg-daily"|svg-daily/ },
  { id: 'mean-label-color', re: /#8B5E3C/ },
  { id: 'peak-valley', re: /峰值|谷值|均值/ },
  { id: 'week-bars', re: /id="week-bars-chart"|四周新增 Star|svg-weekbars/ },
  { id: 'week-bars-svg', re: /class="svg-chart svg-weekbars"|svg-weekbars/ },
];

const MONTHLY_FORBIDDEN = [
  { id: 'chartjs', re: /cdn\.jsdelivr\.net\/npm\/chart|new Chart\(/i },
  { id: 'empty-bars-shell', re: /class="bars-row"/ },
];

function checkBlocks(doc, required, forbidden, prefix) {
  const findings = [];
  const raw = doc.raw || '';
  for (const item of required) {
    if (item.id === 'no-chartjs') continue;
    if (item.re.test(raw)) continue;
    findings.push(makeFinding('R11C', doc, {
      field: `${prefix}.missing.${item.id}`,
      line: null,
      quote: item.id,
      message: `r11c 缺图块：${item.id}`,
    }));
  }
  for (const item of forbidden) {
    if (!item.re.test(raw)) continue;
    findings.push(makeFinding('R11C', doc, {
      field: `${prefix}.forbidden.${item.id}`,
      line: null,
      quote: item.id,
      message: `r11c 违规：${item.id}`,
    }));
  }
  return findings;
}

function hasNonEmptyWeekThemes(raw) {
  // 四周主题条：weekbar 内至少一条周报链且周次后有非空主题文案
  const block = /class="weekbar"[^>]*>([\s\S]*?)<\/div>/.exec(raw);
  if (!block) return false;
  return /<b>\d{4}-W\d{2}<\/b>\S/.test(block[1]) || /github-weekly-\d{4}-W\d{2}\.html[^>]*>[^<]*\S/.test(block[1]);
}

function weekBarsTotalZero(raw) {
  // 脚注四柱皆 0，或合计约 0（有数时为 102.3k 等）
  if (/W\d+\s+0\s*·\s*W\d+\s+0\s*·\s*W\d+\s+0\s*·\s*W\d+\s+0/.test(raw)) return true;
  if (/合计约\s*0(?:\.0)?k?(?:[。.]|<|\s|$)/.test(raw)) return true;
  return false;
}

function checkMonthlyWeekBarsValues(doc) {
  const raw = doc.raw || '';
  if (!hasNonEmptyWeekThemes(raw)) return [];
  if (!weekBarsTotalZero(raw)) return [];
  return [makeFinding('R11C', doc, {
    field: 'monthly.weekBars.zeroWithThemes',
    line: null,
    quote: 'weekBars=0',
    message: 'r11c：四周主题非空但四柱合计为 0（疑未拷 weekly brief）',
  })];
}

function check(ctx, doc) {
  if (doc.role !== 'html' || doc.kind !== 'html') return [];
  if (ctx.level === 'weekly') return checkBlocks(doc, WEEKLY_REQUIRED, WEEKLY_FORBIDDEN, 'weekly');
  if (ctx.level === 'monthly') {
    return [
      ...checkBlocks(doc, MONTHLY_REQUIRED, MONTHLY_FORBIDDEN, 'monthly'),
      ...checkMonthlyWeekBarsValues(doc),
    ];
  }
  return [];
}

function applies(ctx, doc) {
  if (doc.role !== 'html') return false;
  if (ctx.level === 'weekly' || ctx.level === 'monthly') return true;
  return false;
}

module.exports = {
  id: 'R11C',
  applies,
  check,
};
