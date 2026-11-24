'use strict';

const { makeFinding } = require('./util');

function factItems(ctx, doc) {
  if (doc && doc.role === 'facts') {
    if (Array.isArray(doc.json && doc.json.facts)) return doc.json.facts;
    if (Array.isArray(doc.json)) return doc.json;
  }
  if (Array.isArray(ctx.facts)) return ctx.facts;
  if (Array.isArray(ctx.facts && ctx.facts.facts)) return ctx.facts.facts;
  return [];
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function findRole(facts, role) {
  return facts.find(item => item && item.role === role) || null;
}

function check(ctx, doc) {
  const findings = [];
  const stats = (ctx.brief && ctx.brief.stats) || {};
  const total = toNumber(stats.totalProjects);
  const ai = toNumber(stats.aiProjects);
  if (total === null || ai === null) return findings;

  const facts = factItems(ctx, doc);
  if (facts.length === 0) return findings;

  const expectedRatio = total > 0 ? Math.round((ai / total) * 100) : 0;
  const ratio = findRole(facts, 'ai_ratio');
  if (ratio && toNumber(ratio.value) !== expectedRatio) {
    findings.push(makeFinding('B20', doc, {
      field: 'ai_ratio',
      quote: String(ratio.value),
      message: `facts.ai_ratio=${ratio.value}，与 brief.stats ${ai}/${total}（应为 ${expectedRatio}%）自相矛盾`,
    }));
  }

  const aiFact = findRole(facts, 'ai_projects');
  if (aiFact && toNumber(aiFact.value) !== ai) {
    findings.push(makeFinding('B20', doc, {
      field: 'ai_projects',
      quote: String(aiFact.value),
      message: `facts.ai_projects=${aiFact.value}，与 brief.stats.aiProjects=${ai} 自相矛盾`,
    }));
  }

  const totalFact = findRole(facts, 'total_projects');
  if (totalFact && toNumber(totalFact.value) !== total) {
    findings.push(makeFinding('B20', doc, {
      field: 'total_projects',
      quote: String(totalFact.value),
      message: `facts.total_projects=${totalFact.value}，与 brief.stats.totalProjects=${total} 自相矛盾`,
    }));
  }

  return findings;
}

module.exports = {
  id: 'B20',
  applies: (ctx, doc) => ctx.level === 'weekly' && doc.role === 'facts',
  check,
};
