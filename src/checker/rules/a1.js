'use strict';

const {
  splitClauses,
  splitSentenceUnits,
  hasStarContext,
  parseStarNumbers,
  matchesStarValue,
  findProjectMentions,
} = require('../text');
const { makeFinding } = require('./util');

const TRIGGER_RE = /单日|今日|当天|新增|日增/;
const SKIP_RE = /合计|门槛|阈值|上周|全周|环比|换血率|跌破|超过|高于|低于|≥|≤/;
const CUMULATIVE_RE = /累计/;

function resolveProject(ctx, sentence, clause) {
  const inClause = findProjectMentions(clause, ctx.projects);
  if (inClause.length === 1) return { project: inClause[0], ambiguous: false };
  if (inClause.length > 1) return { project: null, ambiguous: true };

  const inSentence = findProjectMentions(sentence, ctx.projects);
  if (inSentence.length === 1) return { project: inSentence[0], ambiguous: false };
  return { project: null, ambiguous: true };
}

function check(ctx, doc) {
  const findings = [];

  for (const item of doc.strings) {
    for (const sentence of splitSentenceUnits(item.value)) {
      const hasStar = hasStarContext(sentence);
      const sentenceTriggered = TRIGGER_RE.test(sentence);
      for (const clause of splitClauses(sentence)) {
        const numbers = parseStarNumbers(clause, { hasStarContext: hasStar });
        if (numbers.length === 0) continue;
        if (!sentenceTriggered && !CUMULATIVE_RE.test(clause)) continue;
        if (SKIP_RE.test(clause)) continue;

        const { project, ambiguous } = resolveProject(ctx, sentence, clause);
        if (!project) {
          findings.push(makeFinding('A1', doc, {
            field: item.path,
            line: item.line,
            quote: clause,
            message: `带「新增/今日/单日/当天」的数字${ambiguous ? '无法唯一' : '没有'}归属到项目（J25）`,
          }));
          continue;
        }

        const cumulative = CUMULATIVE_RE.test(clause);
        const expected = cumulative ? project.stars : project.todayStars;
        for (const number of numbers) {
          if (matchesStarValue(number, expected)) continue;
          findings.push(makeFinding('A1', doc, {
            field: item.path,
            line: item.line,
            quote: clause,
            message: cumulative
              ? `「${number.raw}」不等于 ${project.fullName} 的累计 stars ${project.stars}`
              : `「${number.raw}」不等于 ${project.fullName} 的 todayStars ${project.todayStars}`,
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
