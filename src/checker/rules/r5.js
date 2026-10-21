'use strict';

const { makeFinding } = require('./util');
const { extractNumbers, missingNumbers, normalizeNumberText } = require('./r4-binding');
const {
  SLOT_TYPES,
  slotTypeOf,
  textLength,
  wordRegex,
  stripMetricNames,
} = require('../../generator/daily-v3-text');
const { cardIntroText, hasChinese } = require('./b17');

function isR5Insights(value) {
  return Boolean(value && typeof value === 'object'
    && (value.version === 'r5'
      || (value.slots && typeof value.slots === 'object' && !Array.isArray(value.slots))));
}

function fieldText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value.text === 'string') return value.text;
  return '';
}

function textFields(json) {
  const fields = [];
  for (const [index, item] of (Array.isArray(json.trends) ? json.trends : []).entries()) {
    fields.push({ path: `trends[${index}].text`, text: fieldText(item) });
  }
  const analysis = fieldText(json.analysis);
  if (analysis) fields.push({ path: 'analysis', text: analysis });
  for (const [index, item] of (Array.isArray(json.advice) ? json.advice : []).entries()) {
    fields.push({ path: `advice[${index}].text`, text: fieldText(item) });
  }
  if (typeof json.churnNewText === 'string') fields.push({ path: 'churnNewText', text: json.churnNewText });
  if (typeof json.churnDropText === 'string') fields.push({ path: 'churnDropText', text: json.churnDropText });
  return fields;
}

function factList(ctx) {
  if (Array.isArray(ctx.facts)) return ctx.facts;
  if (Array.isArray(ctx.facts?.facts)) return ctx.facts.facts;
  return [];
}

function checkHero(json, doc, findings) {
  if (!Object.prototype.hasOwnProperty.call(json, 'hero')) return;
  const hero = json.hero && typeof json.hero === 'object' ? json.hero : {};
  const lead = fieldText(
    hero.lead !== undefined ? hero.lead
      : (hero.oneLiner !== undefined ? hero.oneLiner
        : (typeof json.hero === 'string' ? json.hero : ''))
  ).trim();
  if (lead) return;
  findings.push(makeFinding('R5', doc, {
    field: 'hero.lead',
    quote: '',
    message: 'hero 结论句为空（FIELD_MAP 结论块必填）',
  }));
}

function checkCardIntro(json, doc, findings) {
  const projects = Array.isArray(json.projects) ? json.projects : [];
  for (const [index, project] of projects.entries()) {
    const intro = cardIntroText(project);
    if (!intro || hasChinese(intro)) continue;
    findings.push(makeFinding('R5', doc, {
      field: `projects[${index}].descZh`,
      quote: intro,
      message: '日报项目卡简介不含中文字符（B17）',
    }));
  }
}

function textOf(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value.text === 'string') return value.text.trim();
  return '';
}

function checkFieldMapBlocks(json, doc, findings) {
  const trends = Array.isArray(json.trends) ? json.trends : [];
  if (trends.length < 3) {
    findings.push(makeFinding('R5', doc, {
      field: 'trends',
      quote: '',
      message: `核心趋势为空或不足 3 条（FIELD_MAP 要求 3–5 条），当前 ${trends.length} 条`,
    }));
  }
  if (trends.length > 5) {
    findings.push(makeFinding('R5', doc, {
      field: 'trends',
      quote: '',
      message: `核心趋势超过 5 条（FIELD_MAP 要求 3–5 条），当前 ${trends.length} 条`,
    }));
  }
  for (const [index, item] of trends.entries()) {
    if (!textOf(item)) {
      findings.push(makeFinding('R5', doc, {
        field: `trends[${index}].text`,
        quote: '',
        message: '核心趋势条目为空（FIELD_MAP 核心趋势必填）',
      }));
    }
  }

  const analysis = textOf(json.analysis);
  if (!analysis) {
    findings.push(makeFinding('R5', doc, {
      field: 'analysis',
      quote: '',
      message: '深度分析为空（FIELD_MAP 深度分析 2–4 句必填）',
    }));
  } else {
    const sentences = analysis.split(/[。！？]/).filter(item => item.trim()).length;
    if (sentences < 2 || sentences > 4) {
      findings.push(makeFinding('R5', doc, {
        field: 'analysis',
        quote: analysis,
        message: `深度分析须 2–4 句（FIELD_MAP），当前 ${sentences} 句`,
      }));
    }
  }

  const advice = Array.isArray(json.advice) ? json.advice : [];
  if (advice.length === 0) {
    findings.push(makeFinding('R5', doc, {
      field: 'advice',
      quote: '',
      message: '建议为空（FIELD_MAP 建议 ≤3 且必填）',
    }));
  }
  for (const [index, item] of advice.entries()) {
    if (!textOf(item)) {
      findings.push(makeFinding('R5', doc, {
        field: `advice[${index}].text`,
        quote: '',
        message: '建议条目为空（FIELD_MAP 建议必填）',
      }));
    }
  }

  if (!textOf(json.churnNewText)) {
    findings.push(makeFinding('R5', doc, {
      field: 'churnNewText',
      quote: '',
      message: '新上榜解释为空（FIELD_MAP 上榜句必填）',
    }));
  }
  if (!textOf(json.churnDropText)) {
    findings.push(makeFinding('R5', doc, {
      field: 'churnDropText',
      quote: '',
      message: '掉榜解释为空（FIELD_MAP 掉榜句必填）',
    }));
  }

  const projects = Array.isArray(json.projects) ? json.projects : [];
  for (const [index, project] of projects.slice(0, 8).entries()) {
    const descShort = textOf(project?.descShortZh);
    if (!descShort) {
      findings.push(makeFinding('R5', doc, {
        field: `projects[${index}].descShortZh`,
        quote: '',
        message: 'Top8 中文短描述为空（FIELD_MAP Top8 描述必填）',
      }));
    }
  }

  const slots = json.slots && typeof json.slots === 'object' && !Array.isArray(json.slots)
    ? json.slots
    : {};
  const heroText = Object.prototype.hasOwnProperty.call(json, 'hero')
    ? textOf(json.hero?.lead ?? json.hero)
    : textOf(slots['hero.reason']);
  if (!heroText) {
    findings.push(makeFinding('R5', doc, {
      field: 'hero.lead',
      quote: '',
      message: '结论块为空（FIELD_MAP 结论必填）',
    }));
  }

  const hype = json.hypeIndex;
  if (!hype || typeof hype !== 'object') {
    findings.push(makeFinding('R5', doc, {
      field: 'hypeIndex',
      quote: '',
      message: '热度块为空（FIELD_MAP 热度必填）',
    }));
  } else {
    const score = Number(hype.score);
    if (!Number.isFinite(score)) {
      findings.push(makeFinding('R5', doc, {
        field: 'hypeIndex.score',
        quote: String(hype.score ?? ''),
        message: '热度分数不是数值（FIELD_MAP 热度必填 0–5 整数）',
      }));
    } else if (score <= 0) {
      findings.push(makeFinding('R5', doc, {
        field: 'hypeIndex.score',
        quote: String(hype.score),
        message: '热度显示 0/5（页面不得出现 0/5）',
      }));
    } else if (score > 5) {
      findings.push(makeFinding('R5', doc, {
        field: 'hypeIndex.score',
        quote: String(hype.score),
        message: '热度分数超出 5 分上限',
      }));
    }
  }
}

function checkNoPlaceholder(json, doc, findings) {
  const candidates = [];
  const push = (field, value) => {
    const text = textOf(value);
    if (text) candidates.push({ field, text });
  };

  for (const [index, item] of (Array.isArray(json.trends) ? json.trends : []).entries()) {
    push(`trends[${index}].text`, item);
  }
  push('analysis', json.analysis);
  for (const [index, item] of (Array.isArray(json.advice) ? json.advice : []).entries()) {
    push(`advice[${index}].text`, item);
  }
  push('churnNewText', json.churnNewText);
  push('churnDropText', json.churnDropText);
  push('hero.lead', json.hero?.lead);
  push('hypeIndex.reason', json.hypeIndex?.reason);
  for (const [index, project] of (Array.isArray(json.projects) ? json.projects : []).entries()) {
    push(`projects[${index}].descShortZh`, project?.descShortZh);
    push(`projects[${index}].descZh`, project?.descZh);
  }
  if (json.slots && typeof json.slots === 'object' && !Array.isArray(json.slots)) {
    for (const [slotId, value] of Object.entries(json.slots)) push(`slots.${slotId}`, value);
  }

  for (const candidate of candidates) {
    if (!candidate.text.includes('待补充')) continue;
    findings.push(makeFinding('R5', doc, {
      field: candidate.field,
      quote: candidate.text,
      message: '页面显示「待补充」（不得作为可见文案）',
    }));
  }
}

const TREND_COMPARISON_RE = /(?:较昨日|较上一有数据日|较\s*7\s*日均|较近\s*\d+\s*日均)\s*[+\-−]?\d/;

function checkTrendNumbers(json, doc, findings) {
  const trends = Array.isArray(json.trends) ? json.trends : [];
  for (const [index, item] of trends.entries()) {
    const text = textOf(item);
    if (!text) continue;
    if (TREND_COMPARISON_RE.test(text)) continue;
    findings.push(makeFinding('R5', doc, {
      field: `trends[${index}].text`,
      quote: text,
      message: '核心趋势条目缺少「较昨日/较上一有数据日/较 7 日均/较近 N 日均」比较表达及其数字',
    }));
  }
}

function checkCardRepoName(json, doc, findings) {
  for (const [index, project] of (Array.isArray(json.projects) ? json.projects : []).entries()) {
    const fullName = project?.fullName || project?.repo || null;
    if (!fullName) continue;
    const intro = cardIntroText(project);
    if (!intro || !intro.includes(fullName)) continue;
    findings.push(makeFinding('R5', doc, {
      field: `projects[${index}].descZh`,
      quote: intro,
      message: `卡片一句话包含本项目仓库全名「${fullName}」（须为 AI 自然中文）`,
    }));
  }

  const slots = json.slots && typeof json.slots === 'object' && !Array.isArray(json.slots)
    ? json.slots
    : {};
  for (const [slotId, value] of Object.entries(slots)) {
    if (!slotId.startsWith('project.') || !/(?:descZh|descShortZh)$/.test(slotId)) continue;
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (!text) continue;
    const name = slotId.slice('project.'.length).replace(/\.desc(?:Short)?Zh$/, '');
    if (!name || !text.includes(name)) continue;
    findings.push(makeFinding('R5', doc, {
      field: `slots.${slotId}`,
      quote: text,
      message: `卡片一句话包含本项目仓库全名「${name}」（须为 AI 自然中文）`,
    }));
  }
}

function isKFormat(value) {
  return /^\d+(?:\.\d)?k$/.test(String(value === undefined || value === null ? '' : value).trim());
}

function isAvgStarsMetric(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.key === 'avgStars') return true;
  const label = String(item.label || '');
  return label.includes('平均') && /(Stars|星)/.test(label);
}

function checkAvgStars(json, doc, findings) {
  const metrics = Array.isArray(json.metrics) ? json.metrics : [];
  for (const [index, item] of metrics.entries()) {
    if (!isAvgStarsMetric(item)) continue;
    if (item.value === undefined || item.value === null || String(item.value).trim() === '') continue;
    if (isKFormat(item.value)) continue;
    findings.push(makeFinding('R5', doc, {
      field: `metrics[${index}].value`,
      quote: String(item.value),
      message: '平均 Stars 显示值须为 k 格式（如 103k、103.4k）',
    }));
  }
}

function renderEntries(json) {
  return Array.isArray(json.render_entries) ? json.render_entries
    : (Array.isArray(json.renderEntries) ? json.renderEntries : []);
}

function checkSlots(json, doc, config, findings) {
  const slots = json.slots && typeof json.slots === 'object' && !Array.isArray(json.slots)
    ? json.slots
    : {};
  const regex = wordRegex(config);

  for (const [slotId, raw] of Object.entries(slots)) {
    const text = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!text) continue;

    const type = slotTypeOf(slotId);
    if (type) {
      const maxLength = SLOT_TYPES[type].maxLength;
      if (textLength(text) > maxLength) {
        findings.push(makeFinding('R5', doc, {
          field: `slots.${slotId}`,
          quote: text,
          message: `槽位超长（${textLength(text)}>${maxLength}）`,
        }));
      }
    }

    if (/\d/.test(text)) {
      findings.push(makeFinding('R5', doc, {
        field: `slots.${slotId}`,
        quote: text,
        message: '槽位文本含数字（数字只能由程序从事实表填入）',
      }));
    }

    if (regex) {
      regex.lastIndex = 0;
      const match = regex.exec(stripMetricNames(text, config));
      if (match) {
        findings.push(makeFinding('R5', doc, {
          field: `slots.${slotId}`,
          quote: text,
          message: `槽位文本含禁用方向/状态词「${match[0]}」`,
        }));
      }
    }
  }
}

function checkNumbers(json, ctx, doc, findings) {
  const entries = renderEntries(json);
  const byPath = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const path = nullSafePath(entry.path);
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push(entry);
  }

  for (const field of textFields(json)) {
    if (!field.text) continue;
    const numbers = extractNumbers(field.text);
    if (numbers.length === 0) continue;
    const missing = missingNumbers(numbers, byPath.get(field.path) || []);
    for (const number of missing) {
      findings.push(makeFinding('R5', doc, {
        field: field.path,
        quote: field.text,
        message: `数字「${number}」在模板渲染记录中没有对应事实`,
      }));
    }
  }

  const facts = new Map();
  for (const fact of factList(ctx)) {
    if (fact && fact.id !== undefined && fact.id !== null) facts.set(String(fact.id), fact);
  }

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const fact = entry.factId === undefined || entry.factId === null
      ? null
      : facts.get(String(entry.factId));
    if (!fact) {
      findings.push(makeFinding('R5', doc, {
        field: nullSafePath(entry.path),
        quote: String(entry.text || ''),
        message: `模板渲染记录找不到事实 ${entry.factId === undefined ? '(空)' : entry.factId}`,
      }));
      continue;
    }
    const recorded = extractNumbers(String(entry.text === undefined || entry.text === null ? '' : entry.text));
    const expected = normalizeNumberText(fact.value);
    if (recorded.length === 0) {
      findings.push(makeFinding('R5', doc, {
        field: nullSafePath(entry.path),
        quote: String(entry.text || ''),
        message: `模板渲染记录没有可核对数字（事实 ${fact.id} 的值 ${fact.value}）`,
      }));
      continue;
    }
    for (const number of recorded) {
      if (normalizeNumberText(number) !== expected) {
        findings.push(makeFinding('R5', doc, {
          field: nullSafePath(entry.path),
          quote: String(entry.text || ''),
          message: `模板数字「${number}」与事实 ${fact.id} 的值「${fact.value}」不一致`,
        }));
      }
    }
  }
}

function nullSafePath(value) {
  return value === undefined || value === null ? '' : String(value);
}

function check(ctx, doc, config) {
  if (!isR5Insights(doc.json)) return [];
  const findings = [];
  checkSlots(doc.json, doc, config || {}, findings);
  checkNumbers(doc.json, ctx, doc, findings);
  checkHero(doc.json, doc, findings);
  checkCardIntro(doc.json, doc, findings);
  checkAvgStars(doc.json, doc, findings);
  checkFieldMapBlocks(doc.json, doc, findings);
  checkNoPlaceholder(doc.json, doc, findings);
  checkTrendNumbers(doc.json, doc, findings);
  checkCardRepoName(doc.json, doc, findings);

  if (Array.isArray(doc.json.advice) && doc.json.advice.length > 3) {
    findings.push(makeFinding('R5', doc, {
      field: 'advice',
      quote: '',
      message: `advice 最多 3 条，当前 ${doc.json.advice.length} 条`,
    }));
  }

  return findings;
}

module.exports = {
  id: 'R5',
  applies: (ctx, doc) => ctx.level === 'daily' && doc.role === 'insights' && isR5Insights(doc.json),
  check,
  isR5Insights,
  textFields,
};
