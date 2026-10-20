'use strict';

const {
  splitClauses,
  splitSentenceUnits,
  hasStarContext,
  parseStarNumbers,
  analyzeStarClause,
  matchesStarValue,
  findProjectMentions,
} = require('../text');
const { makeFinding } = require('./util');

const TRIGGER_RE = /单日|今日|当天|新增|日增|当期|期内/;
const CARD_NAME_KEYS = ['project_name', 'projectName', 'fullName', 'repo', 'name'];

function matchProject(ctx, value) {
  if (!value) return null;
  const project = ctx.projectMap.get(value);
  if (project) return project;
  const byName = ctx.projects.filter(item => item.name === value || item.fullName === value);
  return byName.length === 1 ? byName[0] : null;
}

/**
 * J26：卡片/列表项内句子无项目名时，继承所属卡片的项目。
 * 容器为对象数组项（如 project_insights[0]、topProjects[0]），
 * 从 project_name/fullName/repo/name 等字段取项目。
 */
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

function check(ctx, doc, config) {
  const findings = [];

  for (const item of doc.strings) {
    for (const sentence of splitSentenceUnits(item.value)) {
      if (!TRIGGER_RE.test(sentence)) continue;
      const hasStar = hasStarContext(sentence);
      for (const clause of splitClauses(sentence)) {
        const numbers = parseStarNumbers(clause, { hasStarContext: hasStar });
        if (numbers.length === 0) continue;

        const analysis = analyzeStarClause(clause, numbers, config);
        if (analysis.aggregate || analysis.cumulativeOnly) continue;

        const { project, ambiguous } = resolveProject(ctx, doc, item, sentence, clause);
        const active = analysis.items.filter(entry =>
          !entry.threshold && !(entry.comparator && !project && !ambiguous));

        if (!project) {
          if (active.length === 0) continue;
          findings.push(makeFinding('A1', doc, {
            field: item.path,
            line: item.line,
            quote: clause,
            message: `带「新增/今日/单日/当天」的数字${ambiguous ? '无法唯一' : '没有'}归属到项目（J25/J26）`,
          }));
          continue;
        }

        for (const entry of active) {
          const expected = entry.cumulative ? project.stars : project.todayStars;
          if (!Number.isFinite(expected)) continue;
          if (matchesStarValue(entry.number, expected)) continue;
          findings.push(makeFinding('A1', doc, {
            field: item.path,
            line: item.line,
            quote: clause,
            message: `「${entry.number.raw}」不等于 ${project.fullName} 的 ${entry.cumulative ? 'stars' : 'todayStars'} ${expected}`,
          }));
        }
      }
    }
  }

  return findings;
}

module.exports = {
  id: 'A1',
  applies: (ctx, doc) => ctx.level === 'daily' && doc.role === 'insights',
  check,
};
