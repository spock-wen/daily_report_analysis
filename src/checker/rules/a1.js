'use strict';

const {
  splitClauses,
  parseStarNumbers,
  matchesStarValue,
  findProjectMentions,
} = require('../text');
const { makeFinding } = require('./util');

const TRIGGER_RE = /单日|今日|当天|新增|日增/;

function resolveProject(ctx, doc, item, clause) {
  const inClause = findProjectMentions(clause, ctx.projects);
  if (inClause.length === 1) return { project: inClause[0], source: 'clause' };

  const inString = findProjectMentions(item.value, ctx.projects);
  if (inString.length === 1) return { project: inString[0], source: 'string' };

  const containerText = doc.containerText ? doc.containerText(item.container) : '';
  const inContainer = findProjectMentions(containerText, ctx.projects);
  if (inContainer.length === 1) return { project: inContainer[0], source: 'container' };

  return { project: null, source: 'ambiguous' };
}

function check(ctx, doc) {
  const findings = [];

  for (const item of doc.strings) {
    const clauses = splitClauses(item.value);
    for (const clause of clauses) {
      if (!TRIGGER_RE.test(clause)) continue;
      const numbers = parseStarNumbers(clause);
      if (numbers.length === 0) continue;

      const { project } = resolveProject(ctx, doc, item, clause);
      if (!project) {
        findings.push(makeFinding('A1', doc, {
          field: item.path,
          line: item.line,
          quote: clause,
          message: '带「新增/今日/单日/当天」的数字无法唯一归属到项目（J8）',
        }));
        continue;
      }

      for (const number of numbers) {
        if (matchesStarValue(number, project.todayStars)) continue;
        findings.push(makeFinding('A1', doc, {
          field: item.path,
          line: item.line,
          quote: clause,
          message: `「${number.raw}」不等于 ${project.fullName} 的 todayStars ${project.todayStars}`,
        }));
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
