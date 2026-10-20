'use strict';

const {
  splitClauses,
  splitSentenceUnits,
  hasStarContext,
  parseStarNumbers,
  matchesStarValue,
  findProjectMentions,
  stripHtml,
} = require('../text');
const { makeFinding } = require('./util');

const STAR_UNIT = { 亿: 1e8, 万: 1e4, 千: 1e3, k: 1e3, K: 1e3, w: 1e4, W: 1e4 };
const SKIP_RE = /合计|门槛|阈值|上周|全周|环比|换血率/;
const THRESHOLD_RE = /跌破|超过|高于|低于|≥|≤/;
const CUMULATIVE_RE = /累计/;

function resolveProject(ctx, sentence, clause) {
  const inClause = findProjectMentions(clause, ctx.projects);
  if (inClause.length === 1) return { project: inClause[0], ambiguous: false };
  if (inClause.length > 1) return { project: null, ambiguous: true };

  const inSentence = findProjectMentions(sentence, ctx.projects);
  if (inSentence.length === 1) return { project: inSentence[0], ambiguous: false };
  return { project: null, ambiguous: true };
}

function checkInsights(ctx, doc) {
  const findings = [];

  for (const item of doc.strings) {
    for (const sentence of splitSentenceUnits(item.value)) {
      const hasStar = hasStarContext(sentence);
      for (const clause of splitClauses(sentence)) {
        const numbers = parseStarNumbers(clause, { hasStarContext: hasStar });
        if (numbers.length === 0) continue;
        if (SKIP_RE.test(clause)) continue;
        if (THRESHOLD_RE.test(clause)) continue;

        const { project, ambiguous } = resolveProject(ctx, sentence, clause);
        const cumulative = CUMULATIVE_RE.test(clause);

        if (!project) {
          findings.push(makeFinding('A2', doc, {
            field: item.path,
            line: item.line,
            quote: clause,
            message: `数字${ambiguous ? '无法唯一' : '没有'}归属到项目（J25）`,
          }));
          continue;
        }

        const expected = cumulative ? project.stars : project.todayStars;
        if (!Number.isFinite(expected)) continue;

        for (const number of numbers) {
          if (matchesStarValue(number, expected)) continue;
          if (!cumulative && number.value < 10000) continue;
          const message = cumulative
            ? `「${number.raw}」不等于 ${project.fullName} 的累计 stars ${project.stars}`
            : `「${number.raw}」与 ${project.fullName} 的本周新增 ${project.todayStars} 不符`;
          findings.push(makeFinding('A2', doc, {
            field: item.path,
            line: item.line,
            quote: clause,
            message,
          }));
        }
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
