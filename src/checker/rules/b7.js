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
  const cards = [];
  const re = /<div class="stat-value">([\s\S]*?)<\/div>\s*<div class="stat-label">([^<]+)<\/div>/g;
  let match;
  while ((match = re.exec(doc.raw)) !== null) {
    cards.push({
      value: stripHtml(match[1]).replace(/\s+/g, ' ').trim(),
      label: match[2].trim(),
      line: doc.lineAtOffset(match.index),
    });
  }
  // r11b：ml/mv 顺序（label 在前）且可与 stat-* 并存
  const re2 = /<div class="ml[^"]*stat-label[^"]*">([^<]+)<\/div>\s*<div class="mv[^"]*stat-value[^"]*">([\s\S]*?)<\/div>/g;
  while ((match = re2.exec(doc.raw)) !== null) {
    const label = match[1].trim();
    const value = stripHtml(match[2]).replace(/\s+/g, ' ').trim();
    if (cards.some(c => c.label === label && c.value === value)) continue;
    cards.push({ value, label, line: doc.lineAtOffset(match.index) });
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
    const metrics = ctx.metrics || {};
    return {
      totalProjects: total,
      totalProjectsLegacy: total,
      avgStars: briefStats.avgStars || briefStats.avg_stars || null,
      aiPercent: total > 0 ? Math.round((ai / total) * 100) : null,
      darkHorse: maxTodayStars,
      weekNewStars: metrics.weekNewStars ?? null,
      churnRate: metrics.churnRate != null ? `${metrics.churnRate}%` : null,
      exHeadRate: null,
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

  if (ctx.level === 'monthly') {
    checkMonthlyCombinations(ctx, doc, { value: doc.text, path: 'body', line: null }, findings);
  }

  return findings;
}

function checkMonthlyCombinations(ctx, doc, item, findings) {
  const metrics = ctx.metrics;
  if (ctx.level !== 'monthly' || !metrics) return;

  const text = String(item.value || '');
  const total = metrics.stats?.totalProjects ?? ctx.brief?.stats?.totalProjects;
  const rookies = metrics.rookiesCount ?? ctx.brief?.stats?.newProjects;
  const prior = Number.isFinite(total) && Number.isFinite(rookies) ? total - rookies : null;
  const prev = metrics.prevMonthStats || ctx.brief?.prevMonthStats || {};
  const seen = new Set();
  const push = (quote, message) => {
    const key = `${quote}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(makeFinding('B7', doc, {
      field: item.path,
      line: item.line,
      quote,
      message,
    }));
  };

  const collect = (patterns) => {
    const values = [];
    let match;
    for (const re of patterns) {
      while ((match = re.exec(text)) !== null) {
        const value = Number(match[1]);
        if (Number.isFinite(value)) values.push({ value, quote: match[0] });
      }
    }
    return values;
  };

  if (Number.isFinite(total)) {
    const comboRe = /(\d+)\s*个(?:新项目|新秀)[^。；\n]{0,16}(?:之外|以外)[^。；\n]{0,8}(?:还有|另有)\s*(\d+)\s*个[^。；\n]{0,12}(?:之前已上榜|非新秀)/g;
    let comboMatched = false;
    let match;
    while ((match = comboRe.exec(text)) !== null) {
      comboMatched = true;
      const newCount = Number(match[1]);
      const priorCount = Number(match[2]);
      if (newCount + priorCount !== total) {
        push(match[0], `新秀 ${newCount} + 非新秀 ${priorCount} = ${newCount + priorCount}，不等于总项目 ${total}`);
      }
    }

    if (!comboMatched) {
      const newCounts = collect([
        /(\d+)\s*个\s*(?:新项目|新秀)/g,
        /(?:新项目|新秀)\s*(\d+)\s*个/g,
      ]);
      const priorCounts = collect([
        /(?<![\d,.])(\d+)\s*个(?:项目)?\s*(?:本月|当月)?\s*(?:之前已上榜|非新秀)/g,
        /(?:之前已上榜|非新秀)[^。；\n]{0,12}(?<![\d,.])(\d+)\s*个/g,
      ]);
      if (newCounts.length > 0 && priorCounts.length > 0) {
        const newCount = newCounts[0].value;
        const priorCount = priorCounts[0].value;
        if (newCount + priorCount !== total) {
          push(`${newCount} 个新秀，${priorCount} 个非新秀`, `新秀 ${newCount} + 非新秀 ${priorCount} = ${newCount + priorCount}，不等于总项目 ${total}`);
        }
      }
    }

    const tooLargeRe = /(\d+)\s*个(?:本月|当月)?\s*(?:新项目|新秀|之前已上榜|非新秀)/g;
    while ((match = tooLargeRe.exec(text)) !== null) {
      const value = Number(match[1]);
      if (value > total) push(match[0], `部分 ${value} 大于总项目 ${total}`);
    }

    const tooLargeReverseRe = /(?:新项目|新秀|之前已上榜|非新秀)\s*(\d+)\s*个/g;
    while ((match = tooLargeReverseRe.exec(text)) !== null) {
      const value = Number(match[1]);
      if (value > total) push(match[0], `部分 ${value} 大于总项目 ${total}`);
    }
  }

  if (Number.isFinite(prior)) {
    const priorRe = /(?<![\d,.])(\d+)\s*个(?:项目)?\s*(?:本月|当月)?\s*之前已上榜/g;
    const priorReverseRe = /(?:本月|当月)之前已上榜[^。；\n]{0,12}(?<![\d,.])(\d+)\s*个/g;
    let match;
    while ((match = priorRe.exec(text)) !== null) {
      const value = Number(match[1]);
      if (value !== prior) {
        push(match[0], `「本月之前已上榜」应为总项目 ${total} − 新秀 ${rookies} = ${prior}，实为 ${value}`);
      }
    }
    while ((match = priorReverseRe.exec(text)) !== null) {
      const value = Number(match[1]);
      if (value !== prior) {
        push(match[0], `「本月之前已上榜」应为总项目 ${total} − 新秀 ${rookies} = ${prior}，实为 ${value}`);
      }
    }
  }

  if (Number.isFinite(prev.projects) && Number.isFinite(prev.rookies)) {
    const prevAllRe = /上(?:个)?月(?:的)?\s*(\d+)\s*个(?:项目)?(?:全部|都)(?:为|是)新秀/g;
    let match;
    while ((match = prevAllRe.exec(text)) !== null) {
      const claimed = Number(match[1]);
      if (claimed === prev.projects && prev.rookies !== prev.projects) {
        push(match[0], `上月 ${claimed} 个项目并非全部为新秀：上月新秀为 ${prev.rookies}`);
      }
    }
  }
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
      checkMonthlyCombinations(ctx, doc, item, findings);
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
