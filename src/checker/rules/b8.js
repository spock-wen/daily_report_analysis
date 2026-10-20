'use strict';

const { makeFinding } = require('./util');

function check(ctx, doc) {
  const findings = [];
  const stats = (doc.role === 'brief' ? doc.json?.stats : ctx.brief?.stats) || {};
  const statsNode = doc.getNode ? doc.getNode('stats') : null;
  const line = statsNode ? statsNode.line : null;
  const metrics = ctx.metrics;

  const totalProjects = Number(stats.totalProjects) || 0;
  const aiProjects = Number(stats.aiProjects) || 0;
  const avgStars = stats.avgStars === undefined ? '' : String(stats.avgStars);

  if (totalProjects === 0 || aiProjects === 0 || avgStars === '' || avgStars === '0') {
    findings.push(makeFinding('B8', doc, {
      field: 'stats',
      line,
      quote: JSON.stringify(stats),
      message: '月报 brief stats 不得全 0（B8）',
    }));
  }

  if (metrics) {
    if (totalProjects !== metrics.stats.totalProjects) {
      findings.push(makeFinding('B8', doc, {
        field: 'stats.totalProjects',
        line,
        quote: String(stats.totalProjects),
        message: `stats.totalProjects=${totalProjects}，日榜去重应为 ${metrics.stats.totalProjects}（J17）`,
      }));
    }
    if (aiProjects !== metrics.stats.aiProjects) {
      findings.push(makeFinding('B8', doc, {
        field: 'stats.aiProjects',
        line,
        quote: String(stats.aiProjects),
        message: `stats.aiProjects=${aiProjects}，日榜应为 ${metrics.stats.aiProjects}`,
      }));
    }
  }

  return findings;
}

module.exports = {
  id: 'B8',
  applies: (ctx, doc) => ctx.level === 'monthly' && doc.role === 'brief',
  check,
};
