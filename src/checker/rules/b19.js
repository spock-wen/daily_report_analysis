'use strict';

const { makeFinding } = require('./util');
const {
  parseRangeText,
  checkWeekWindow,
  collectEvidenceDays,
  checkEvidenceDays,
} = require('../../metrics/week-window');

// B19：周报周窗口。
// - insights：遍历所有 evidence[].day，逐条须落在 ISO 周（周一至周日）内；窗内不齐 7 天也放行。
//   缺 day、非 YYYY-MM-DD、越窗一律 FAIL（提示词约定 day 是本期每日榜单中的出现日期）。
// - html：页头第一处「YYYY-MM-DD — YYYY-MM-DD」须与 ISO 七天逐项相等（checkWeekWindow）；页面没有范围句时不报（不在本规则范围）。
const RANGE_SEARCH_RE = /20\d{2}-\d{2}-\d{2}\s*[—–-]\s*20\d{2}-\d{2}-\d{2}/;

function lineFor(doc, nodePath) {
  const node = doc.getNode ? doc.getNode(nodePath) : null;
  return node && node.line ? node.line : null;
}

function checkInsights(ctx, doc) {
  const entries = collectEvidenceDays(doc.json);
  if (entries.length === 0) return [];
  const result = checkEvidenceDays(ctx.period, entries);
  return result.violations.map(violation => makeFinding('B19', doc, {
    field: violation.path,
    line: lineFor(doc, violation.path),
    quote: violation.day === undefined ? '' : String(violation.day),
    message: violation.reason,
  }));
}

function checkHtml(ctx, doc) {
  const raw = doc.raw || '';
  const match = RANGE_SEARCH_RE.exec(raw);
  if (!match) return [];
  const result = checkWeekWindow(ctx.period, parseRangeText(match[0]));
  if (result.ok) return [];
  return [makeFinding('B19', doc, {
    field: 'header',
    line: doc.lineAtOffset ? doc.lineAtOffset(match.index) : null,
    quote: match[0],
    message: `页头周窗口与 ISO 周不符：${result.reason}`,
  })];
}

function check(ctx, doc) {
  if (doc.role === 'insights' && doc.kind === 'json') return checkInsights(ctx, doc);
  if (doc.kind === 'html') return checkHtml(ctx, doc);
  return [];
}

module.exports = {
  id: 'B19',
  applies: (ctx, doc) => ctx.level === 'weekly'
    && ((doc.role === 'insights' && doc.kind === 'json') || doc.kind === 'html'),
  check,
};
