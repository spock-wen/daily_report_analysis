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
