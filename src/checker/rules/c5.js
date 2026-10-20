'use strict';

const { findProjectMentions } = require('../text');
const { makeFinding } = require('./util');

const ACTION_PATH_RE = /^action\[[0-9]+\]$/;

function actionItems(insights) {
  const items = [];
  if (!insights || !Array.isArray(insights.action)) return items;
  insights.action.forEach((text, index) => {
    if (typeof text === 'string') items.push({ text, path: `action[${index}]` });
  });
  return items;
}

function itemsForProject(items, project, projects) {
  return items.filter(item => findProjectMentions(item.text, [project]).length > 0 || findProjectMentions(item.text, projects).some(p => p.fullName === project.fullName));
}

function digitsOf(text) {
  return new Set(String(text || '').match(/[0-9]+/g) || []);
}

function consecutiveCount(ctx, date, project) {
  let count = 0;
  let cursor = date;
  for (let i = 0; i < 30; i += 1) {
    const insights = ctx.readDailyInsights(cursor);
    if (!insights) {
      cursor = ctx.getPreviousDailyInsights(cursor, 1)[0]?.date || null;
      if (!cursor) break;
      continue;
    }
    const items = actionItems(insights);
    const mentions = items.some(item => findProjectMentions(item.text, [project]).length > 0);
    if (!mentions) break;
    count += 1;
    const previous = ctx.getPreviousDailyInsights(cursor, 1)[0];
    cursor = previous ? previous.date : null;
    if (!cursor) break;
  }
  return count;
}

function check(ctx, doc) {
  const findings = [];
  const items = actionItems(doc.json);
  if (items.length === 0) return findings;

  const seen = new Set();
  for (const item of items) {
    const mentions = findProjectMentions(item.text, ctx.projects);
    for (const project of mentions) {
      if (seen.has(project.fullName)) continue;
      seen.add(project.fullName);

      const count = consecutiveCount(ctx, ctx.period, project);
      if (count < 3) continue;

      const previous = ctx.getPreviousDailyInsights(ctx.period, 1)[0];
      if (!previous || !previous.insights) continue;
      const previousItems = itemsForProject(actionItems(previous.insights), project, ctx.projects);
      const previousDigits = new Set();
      for (const previousItem of previousItems) {
        for (const digit of digitsOf(previousItem.text)) previousDigits.add(digit);
      }

      const currentItems = itemsForProject(items, project, ctx.projects);
      const currentDigits = new Set();
      for (const currentItem of currentItems) {
        for (const digit of digitsOf(currentItem.text)) currentDigits.add(digit);
      }

      const newDigits = Array.from(currentDigits).filter(digit => !previousDigits.has(digit));
      if (newDigits.length > 0) continue;

      const node = doc.getNode ? doc.getNode(item.path) : null;
      findings.push(makeFinding('C5', doc, {
        field: item.path,
        line: node ? node.line : null,
        quote: item.text,
        message: `连续第 ${count} 次推荐，未给出一期未出现的新数字（J14）`,
      }));
    }
  }

  return findings;
}

module.exports = {
  id: 'C5',
  applies: (ctx, doc) => ctx.level === 'daily' && doc.role === 'insights',
  check,
};
