'use strict';

const {
  splitClauses,
  parseStarNumbers,
  matchesStarValue,
  findProjectMentions,
  stripHtml,
} = require('../text');
const { makeFinding } = require('./util');

const STAR_UNIT = { 亿: 1e8, 万: 1e4, 千: 1e3, k: 1e3, K: 1e3, w: 1e4, W: 1e4 };

function checkInsights(ctx, doc) {
  const findings = [];
  const weekNewStars = ctx.metrics ? ctx.metrics.weekNewStars : null;

  for (const item of doc.strings) {
    for (const clause of splitClauses(item.value)) {
      const numbers = parseStarNumbers(clause);
      if (numbers.length === 0) continue;

      const names = findProjectMentions(clause, ctx.projects);
      const single = names.length === 1 ? names[0] : null;
      const expected = single ? single.todayStars : weekNewStars;
      if (!Number.isFinite(expected)) continue;

      for (const number of numbers) {
        if (matchesStarValue(number, expected)) continue;
        const cumulative = ctx.projects.find(project => matchesStarValue(number, project.stars));
        if (cumulative) {
          findings.push(makeFinding('A2', doc, {
            field: item.path,
            line: item.line,
            quote: clause,
            message: `「${number.raw}」是 ${cumulative.fullName} 的累计总星 ${cumulative.stars}，本周新增应为 ${cumulative.todayStars}`,
          }));
          continue;
        }
        if (number.value < 10000) continue;
        const message = single
          ? `「${number.raw}」与 ${single.fullName} 的本周新增 ${single.todayStars} 不符`
          : `「${number.raw}」与本周新增合计 ${weekNewStars} 不符`;
        findings.push(makeFinding('A2', doc, {
          field: item.path,
          line: item.line,
          quote: clause,
          message,
        }));
      }
    }
  }

  return findings;
}

function checkHtml(ctx, doc) {
  const findings = [];
  const badgeRe = /<span class="stat-badge hot" title="今日星数">([\s\S]*?)<\/span>/g;
  let match;
  while ((match = badgeRe.exec(doc.raw)) !== null) {
    const inner = match[1];
    const text = stripHtml(inner).replace(/\s+/g, '');
    const numberMatch = /([+\-]?[0-9][0-9,]*(?:\.[0-9]+)?)(亿|万|千|[kKwW])?/.exec(text);
    if (!numberMatch) continue;
    const value = Number(numberMatch[1].replace(/,/g, '')) * (STAR_UNIT[numberMatch[2]] || 1);
    const isKnown = ctx.projects.some(project => Math.abs(project.todayStars - value) <= 0.5);
    if (isKnown) continue;
    const offset = match[0].indexOf(numberMatch[0]);
    findings.push(makeFinding('A2', doc, {
      field: 'weekly list stars this week',
      line: doc.lineAtOffset(match.index + Math.max(offset, 0)),
      quote: numberMatch[0],
      message: `周榜「今日星数」${value} 不等于任何项目的 todayStars（周新增口径）`,
    }));
  }
  return findings;
}

function check(ctx, doc) {
  if (doc.kind === 'html') return checkHtml(ctx, doc);
  return checkInsights(ctx, doc);
}

module.exports = {
  id: 'A2',
  applies: (ctx, doc) => ctx.level === 'weekly' && (doc.role === 'insights' || doc.role === 'html'),
  check,
};
