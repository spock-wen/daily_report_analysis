'use strict';

const { splitClauses, findProjectMentions } = require('../text');
const { makeFinding } = require('./util');

const APPEARANCE_RE = /上榜\s*([0-9]+)\s*次/;

function resolveMonthlyProject(ctx, doc, item, clause) {
  const names = findProjectMentions(clause, ctx.projects);
  if (names.length === 1) return names[0];

  const node = doc.getNode ? doc.getNode(item.container) : null;
  if (node && node.type === 'object') {
    const repoNode = node.children.repo || node.children.fullName;
    if (repoNode && repoNode.value) {
      const project = ctx.projectMap.get(repoNode.value);
      if (project) return project;
    }
  }
  return null;
}

function checkInsights(ctx, doc) {
  const findings = [];
  for (const item of doc.strings) {
    for (const clause of splitClauses(item.value)) {
      const match = APPEARANCE_RE.exec(clause);
      if (!match) continue;
      const project = resolveMonthlyProject(ctx, doc, item, clause);
      if (!project) continue;
      const expected = ctx.daysOnList.get(project.fullName);
      if (!Number.isFinite(expected)) continue;
      const actual = Number(match[1]);
      if (actual === expected) continue;
      findings.push(makeFinding('A5', doc, {
        field: item.path,
        line: item.line,
        quote: clause,
        message: `${project.fullName} 上榜 ${actual} 次，只算日榜应为 ${expected} 次`,
      }));
    }
  }
  return findings;
}

function checkHtml(ctx, doc) {
  const findings = [];
  const re = /<a[^>]*class="wiki-project-link"[^>]*>\s*([^<]+?)\s*<\/a>[\s\S]{0,600}?<span class="wiki-appearances">\s*上榜\s*([0-9]+)\s*次\s*<\/span>/g;
  let match;
  while ((match = re.exec(doc.raw)) !== null) {
    const fullName = match[1].trim();
    const expected = ctx.daysOnList.get(fullName);
    if (!Number.isFinite(expected)) continue;
    const actual = Number(match[2]);
    if (actual === expected) continue;
    const spanOffset = match[0].indexOf('<span class="wiki-appearances"');
    findings.push(makeFinding('A5', doc, {
      field: 'wiki-appearances',
      line: doc.lineAtOffset(match.index + Math.max(spanOffset, 0)),
      quote: `上榜 ${actual} 次`,
      message: `${fullName} 上榜 ${actual} 次，只算日榜应为 ${expected} 次`,
    }));
  }
  return findings;
}

function check(ctx, doc) {
  if (doc.kind === 'html') return checkHtml(ctx, doc);
  return checkInsights(ctx, doc);
}

module.exports = {
  id: 'A5',
  applies: (ctx, doc) => ctx.level === 'monthly' && (doc.role === 'insights' || doc.role === 'html'),
  check,
};
