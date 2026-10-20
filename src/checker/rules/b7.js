'use strict';

const { stripHtml, normalize } = require('../text');
const HEADER_FIELDS = require('../header-fields');
const { makeFinding } = require('./util');

const EMPTY_VALUES = new Set(['', '0', '0%', 'null', '[]', 'undefined']);

function parseNumber(value) {
  const match = /(-?[0-9][0-9,]*(?:\.[0-9]+)?)/.exec(String(value || ''));
  if (!match) return null;
  return Number(match[1].replace(/,/g, ''));
}

function parseCards(doc) {
  const re = /<div class="stat-value">([\s\S]*?)<\/div>\s*<div class="stat-label">([^<]+)<\/div>/g;
  const cards = [];
  let match;
  while ((match = re.exec(doc.raw)) !== null) {
    cards.push({
      value: stripHtml(match[1]).replace(/\s+/g, ' ').trim(),
      label: match[2].trim(),
      line: doc.lineAtOffset(match.index),
    });
  }
  return cards;
}

function expectedHeaderValues(ctx) {
  const briefStats = ctx.brief?.stats || {};
  const projects = ctx.projects;

  if (ctx.level === 'daily') {
    return {
      totalProjects: projects.length,
      aiProjects: projects.filter(project => project.isAI).length,
      avgStars: briefStats.avgStars || briefStats.avg_stars || null,
      hotProjects: projects.filter(project => project.todayStars > 100).length,
    };
  }

  if (ctx.level === 'weekly') {
    const total = projects.length;
    const ai = projects.filter(project => project.isAI).length;
    const maxTodayStars = projects.reduce((max, project) => Math.max(max, project.todayStars), 0);
    return {
      totalProjects: total,
      avgStars: briefStats.avgStars || briefStats.avg_stars || null,
      aiPercent: total > 0 ? Math.round((ai / total) * 100) : null,
      darkHorse: maxTodayStars,
    };
  }

  if (ctx.level === 'monthly') {
    const metrics = ctx.metrics;
    if (!metrics) return {};
    const items = metrics.top || [];
    return {
      totalProjects: metrics.stats.totalProjects,
      recurringProjects: items.filter(item => item.daysOnList >= 2).length,
      newProjects: metrics.rookiesCount,
      aiProjects: metrics.stats.aiProjects,
    };
  }

  return {};
}

function collectClaims(ctx) {
  const claims = { ai: [], percent: [], totalProjects: [] };
  const visit = (text, line) => {
    const aiMatch = /([0-9]+)\s*个(?:上榜)?项目中\s*([0-9]+)\s*个(?:为|与)?\s*AI/.exec(text);
    if (aiMatch) {
      claims.ai.push({
        total: Number(aiMatch[1]),
        ai: Number(aiMatch[2]),
        line,
        text: aiMatch[0],
      });
    }
    const percentRe = /占比\s*([0-9]+(?:\.[0-9]+)?)\s*%/g;
    let percentMatch;
    while ((percentMatch = percentRe.exec(text)) !== null) {
      claims.percent.push({ percent: Number(percentMatch[1]), line, text: percentMatch[0] });
    }
    const totalRe = /去重\s*([0-9]+)\s*个项目/g;
    let totalMatch;
    while ((totalMatch = totalRe.exec(text)) !== null) {
      claims.totalProjects.push({ total: Number(totalMatch[1]), line, text: totalMatch[0] });
    }
  };

  if (ctx.insights) visit(JSON.stringify(ctx.insights), null);
  return claims;
}

function checkHtml(ctx, doc) {
  const findings = [];
  const fields = HEADER_FIELDS[ctx.level] || [];
  const byLabel = new Map(fields.map(field => [field.label, field]));
  const expected = expectedHeaderValues(ctx);
  const claims = collectClaims(ctx);
  const cards = parseCards(doc);

  for (const card of cards) {
    const field = byLabel.get(card.label);
    if (!field) {
      findings.push(makeFinding('B7', doc, {
        field: `header.${card.label}`,
        line: card.line,
        quote: `${card.value}（stat-label: ${card.label}）`,
        message: '页头出现字段清单之外的数值字段（J12）',
      }));
      continue;
    }

    if (EMPTY_VALUES.has(normalize(card.value))) {
      findings.push(makeFinding('B7', doc, {
        field: `header.${field.key}`,
        line: card.line,
        quote: `${card.value}（stat-label: ${card.label}）`,
        message: '无信息卡：值为 0/null/空串/空数组（J12）',
      }));
      continue;
    }

    const expectedValue = expected[field.key];
    if (expectedValue === null || expectedValue === undefined) continue;

    if (field.kind === 'text') {
      if (normalize(card.value).toLowerCase() !== normalize(String(expectedValue)).toLowerCase()) {
        findings.push(makeFinding('B7', doc, {
          field: `header.${field.key}`,
          line: card.line,
          quote: `${card.value}（stat-label: ${card.label}）`,
          message: `页头 ${field.key}=${card.value} 与 stats ${expectedValue} 不一致`,
        }));
      }
      continue;
    }

    if (field.key === 'aiPercent') {
      const bodyPercent = claims.percent.find(claim => claim.percent !== expectedValue);
      if (bodyPercent) {
        findings.push(makeFinding('B7', doc, {
          field: `header.${field.key}`,
          line: card.line,
          quote: `${card.value}（stat-label: ${card.label}）`,
          message: `页头 ${card.value} 与正文「${bodyPercent.text}」不一致（stats 口径应为 ${expectedValue}%）`,
        }));
        continue;
      }
    }

    const actual = parseNumber(card.value);
    if (actual === null) continue;
    if (Math.abs(actual - Number(expectedValue)) > 0.001) {
      findings.push(makeFinding('B7', doc, {
        field: `header.${field.key}`,
        line: card.line,
        quote: `${card.value}（stat-label: ${card.label}）`,
        message: `页头 ${field.key}=${actual} 与数据 ${expectedValue} 不一致`,
      }));
    }
  }

  return findings;
}

function checkInsights(ctx, doc) {
  const findings = [];
  const stats = ctx.brief?.stats || {};
  const metrics = ctx.metrics;

  for (const item of doc.strings) {
    const text = item.value;

    const aiMatch = /([0-9]+)\s*个(?:上榜)?项目中\s*([0-9]+)\s*个(?:为|与)?\s*AI/.exec(text);
    if (aiMatch && Number.isFinite(Number(stats.aiProjects))) {
      const claimed = Number(aiMatch[2]);
      if (claimed !== Number(stats.aiProjects)) {
        findings.push(makeFinding('B7', doc, {
          field: item.path,
          line: item.line,
          quote: aiMatch[0],
          message: `正文称 ${claimed} 个 AI 项目，stats.aiProjects=${stats.aiProjects}`,
        }));
      }
    }

    if (ctx.level === 'monthly' && metrics) {
      const totalRe = /去重\s*([0-9]+)\s*个项目/g;
      let totalMatch;
      while ((totalMatch = totalRe.exec(text)) !== null) {
        const claimed = Number(totalMatch[1]);
        if (claimed !== metrics.stats.totalProjects) {
          findings.push(makeFinding('B7', doc, {
            field: item.path,
            line: item.line,
            quote: totalMatch[0],
            message: `正文称去重 ${claimed} 个项目，日榜去重应为 ${metrics.stats.totalProjects}（J17）`,
          }));
        }
      }
    }
  }

  return findings;
}

function check(ctx, doc) {
  if (doc.kind === 'html') return checkHtml(ctx, doc);
  return checkInsights(ctx, doc);
}

module.exports = {
  id: 'B7',
  applies: (ctx, doc) => doc.role === 'html' || doc.role === 'insights',
  check,
};
