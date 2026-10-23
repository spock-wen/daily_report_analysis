'use strict';

const {
  splitClauses,
  splitSentenceUnits,
  hasStarContext,
  parseStarNumbers,
  analyzeStarClause,
  matchesStarValue,
  findProjectMentions,
  stripHtml,
} = require('../text');
const { makeFinding } = require('./util');

const STAR_UNIT = { 亿: 1e8, 万: 1e4, 千: 1e3, k: 1e3, K: 1e3, w: 1e4, W: 1e4 };
const CARD_NAME_KEYS = ['project_name', 'projectName', 'fullName', 'repo', 'name'];

function matchProject(ctx, value) {
  if (!value) return null;
  const project = ctx.projectMap.get(value);
  if (project) return project;
  const byName = ctx.projects.filter(item => item.name === value || item.fullName === value);
  return byName.length === 1 ? byName[0] : null;
}

function projectFromCard(ctx, doc, item) {
  if (!doc || !doc.getNode || !item.container) return null;
  const node = doc.getNode(item.container);
  if (!node || node.type !== 'object') return null;
  const found = new Set();
  for (const key of CARD_NAME_KEYS) {
    const child = node.children && node.children[key];
    if (!child || child.type !== 'string') continue;
    const project = matchProject(ctx, child.value);
    if (project) found.add(project.fullName);
  }
  if (found.size === 1) return ctx.projectMap.get(Array.from(found)[0]) || null;
  return null;
}

function resolveProject(ctx, doc, item, sentence, clause) {
  const inClause = findProjectMentions(clause, ctx.projects);
  if (inClause.length === 1) return { project: inClause[0], ambiguous: false };
  if (inClause.length > 1) return { project: null, ambiguous: true };

  const inSentence = findProjectMentions(sentence, ctx.projects);
  if (inSentence.length === 1) return { project: inSentence[0], ambiguous: false };
  if (inSentence.length > 1) return { project: null, ambiguous: true };

  const inCard = projectFromCard(ctx, doc, item);
  if (inCard) return { project: inCard, ambiguous: false };
  return { project: null, ambiguous: true };
}

function checkInsights(ctx, doc, config) {
  const findings = [];

  for (const item of doc.strings) {
    for (const sentence of splitSentenceUnits(item.value)) {
      const hasStar = hasStarContext(sentence);
      for (const clause of splitClauses(sentence)) {
        const numbers = parseStarNumbers(clause, { hasStarContext: hasStar });
        if (numbers.length === 0) continue;

        const analysis = analyzeStarClause(clause, numbers, config);
        if (analysis.aggregate || analysis.cumulativeOnly) continue;

        const { project, ambiguous } = resolveProject(ctx, doc, item, sentence, clause);
        const active = analysis.items.filter(entry => !entry.threshold);

        if (!project) {
          if (active.length === 0) continue;
          findings.push(makeFinding('A2', doc, {
            field: item.path,
            line: item.line,
            quote: clause,
            message: `数字${ambiguous ? '无法唯一' : '没有'}归属到项目（J25/J26）`,
          }));
          continue;
        }

        for (const entry of active) {
          if (entry.number.value < 10000) continue;
          const expected = entry.cumulative ? project.stars : project.todayStars;
          if (!Number.isFinite(expected)) continue;
          if (matchesStarValue(entry.number, expected)) continue;
          findings.push(makeFinding('A2', doc, {
            field: item.path,
            line: item.line,
            quote: clause,
            message: `「${entry.number.raw}」与 ${project.fullName} 的${entry.cumulative ? '累计' : '本周新增'} ${expected} 不符`,
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

function check(ctx, doc, config) {
  if (doc.kind === 'html') return checkHtml(ctx, doc);
  return checkInsights(ctx, doc, config);
}

module.exports = {
  id: 'A2',
  applies: (ctx, doc) => !ctx.r3 && ctx.level === 'weekly' && (doc.role === 'insights' || doc.role === 'html'),
  check,
};
