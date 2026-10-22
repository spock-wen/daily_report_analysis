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
const history = require('../../metrics/history');
const { parseMetricNumber } = require('../../facts/build-facts');

function isR5Insights(value) {
  return Boolean(value && typeof value === 'object'
    && (value.version === 'r5' || value.version === 'r9'
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

const TREND_COMPARISON_RE = /(?:较昨日|较上期(?:[（(][\d-]+[）)])?|较上一有数据日|较\s*7\s*日均|较近\s*\d+\s*日均)\s*[+\-−]?\d|与上期持平/;

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
    if (!slotId.startsWith('project.') || !/(?:descZh|descShortZh|oneSentence)$/.test(slotId)) continue;
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

function maskDateTimes(text) {
  if (!text || typeof text !== 'string') return '';
  const patterns = [
    /(?:较?上期|上期快照)[（(]?\s*\d{1,2}[-/.月]\d{1,2}日?[）)]?/g,
    /(?:较|比|相对|距)\s*\d{1,2}[-/.月]\d{1,2}日?/g,
    /[（(]\s*\d{1,2}[-/.月]\d{1,2}日?\s*[）)]/g,
    /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/g,
    /\d{4}-W\d{2}/gi,
    /\d{4}-\d{2}/g,
    /\d{1,2}月\d{1,2}日?/g,
    /(?<!\d)\d{2}-\d{2}(?!\d)/g,
    /(?<!\d)\d{1,2}:\d{2}(?::\d{2})?(?!\d)/g,
    /UTC[+-]\d{1,2}(?::\d{2})?/gi,
  ];
  let res = text;
  for (const pattern of patterns) {
    res = res.replace(pattern, m => ' '.repeat(m.length));
  }
  return res;
}

function isAiSlotPath(path) {
  if (!path || typeof path !== 'string') return false;
  return path.startsWith('slots.') || path.endsWith('.reason') || path.includes('.reason');
}

function addCanonicalKeys(set, value) {
  if (value === null || value === undefined || value === '') return;
  const rawStr = String(value).trim();
  if (!rawStr) return;

  set.add(rawStr);

  const cleaned = rawStr.replace(/[,\s]/g, '');
  if (cleaned) set.add(cleaned);

  const norm = normalizeNumberText(rawStr);
  if (norm) set.add(norm);

  const noPercent = cleaned.replace(/%/g, '');
  if (noPercent) set.add(noPercent);

  const noSign = noPercent.replace(/^[+\-−]/, '');
  if (noSign) {
    set.add(noSign);
    const trimmedDec = noSign.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    if (trimmedDec) set.add(trimmedDec);
  }

  const parsed = toNumber(rawStr) ?? parseMetricNumber(rawStr) ?? toNumber(noPercent) ?? parseMetricNumber(noPercent);
  if (parsed !== null && Number.isFinite(parsed)) {
    const abs = Math.abs(parsed);
    set.add(`num:${parsed}`);
    set.add(`num:${abs}`);
    set.add(String(parsed));
    set.add(String(abs));
    const parsedNorm = normalizeNumberText(String(parsed));
    if (parsedNorm) set.add(parsedNorm);

    if (abs > 0 && abs < 1) {
      const p100 = Math.round(abs * 10000) / 100;
      set.add(`num:${p100}`);
      set.add(String(p100));
      set.add(`${p100}%`);
    } else if (abs >= 1 && abs <= 100) {
      const div100 = abs / 100;
      set.add(`num:${div100}`);
    }

    if (abs >= 1000 && abs < 10000000) {
      const kVal = abs / 1000;
      set.add(`${kVal}k`);
      set.add(`${kVal.toFixed(1)}k`);
      set.add(`${Math.round(kVal)}k`);
    }
  }
}

function isKnownNumber(set, numStr) {
  if (numStr === null || numStr === undefined || numStr === '') return false;
  const rawStr = String(numStr).trim();
  if (!rawStr) return false;

  if (set.has(rawStr)) return true;

  const cleaned = rawStr.replace(/[,\s]/g, '');
  if (set.has(cleaned)) return true;

  const norm = normalizeNumberText(rawStr);
  if (norm && set.has(norm)) return true;

  const noPercent = cleaned.replace(/%/g, '');
  if (set.has(noPercent)) return true;

  const noSign = noPercent.replace(/^[+\-−]/, '');
  if (noSign) {
    if (set.has(noSign)) return true;
    const trimmedDec = noSign.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    if (trimmedDec && set.has(trimmedDec)) return true;
  }

  const parsed = toNumber(rawStr) ?? parseMetricNumber(rawStr) ?? toNumber(noPercent) ?? parseMetricNumber(noPercent);
  if (parsed !== null && Number.isFinite(parsed)) {
    const abs = Math.abs(parsed);
    if (set.has(`num:${parsed}`) || set.has(`num:${abs}`)) return true;
    if (set.has(String(parsed)) || set.has(String(abs))) return true;
    const parsedNorm = normalizeNumberText(String(parsed));
    if (parsedNorm && set.has(parsedNorm)) return true;

    if (abs > 0 && abs < 1) {
      const p100 = Math.round(abs * 10000) / 100;
      if (set.has(`num:${p100}`) || set.has(String(p100)) || set.has(`${p100}%`)) return true;
    } else if (abs >= 1 && abs <= 100) {
      const div100 = abs / 100;
      if (set.has(`num:${div100}`)) return true;
    }
  }

  return false;
}

function buildKnownSourceNumberSet(ctx, json) {
  const set = new Set();

  for (const fact of factList(ctx)) {
    if (!fact) continue;
    for (const v of [
      fact.value,
      fact.current,
      fact.reference,
      fact.target,
      fact.diff,
      fact.delta,
      fact.previous,
      fact.count,
    ]) {
      if (v !== undefined && v !== null) {
        addCanonicalKeys(set, v);
      }
    }
  }

  const entries = renderEntries(json);
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.text !== undefined && entry.text !== null) {
      addCanonicalKeys(set, entry.text);
      for (const num of extractNumbers(maskDateTimes(String(entry.text)))) {
        addCanonicalKeys(set, num);
      }
    }
    if (entry.value !== undefined && entry.value !== null) {
      addCanonicalKeys(set, entry.value);
    }
  }

  if (Array.isArray(ctx?.renderEntries)) {
    for (const entry of ctx.renderEntries) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.text !== undefined && entry.text !== null) {
        addCanonicalKeys(set, entry.text);
        for (const num of extractNumbers(maskDateTimes(String(entry.text)))) {
          addCanonicalKeys(set, num);
        }
      }
      if (entry.value !== undefined && entry.value !== null) {
        addCanonicalKeys(set, entry.value);
      }
    }
  }
  if (Array.isArray(ctx?.renderMap?.entries)) {
    for (const entry of ctx.renderMap.entries) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.text !== undefined && entry.text !== null) {
        addCanonicalKeys(set, entry.text);
        for (const num of extractNumbers(maskDateTimes(String(entry.text)))) {
          addCanonicalKeys(set, num);
        }
      }
      if (entry.value !== undefined && entry.value !== null) {
        addCanonicalKeys(set, entry.value);
      }
    }
  }

  return set;
}

function checkNumbers(json, ctx, doc, findings) {
  const entries = renderEntries(json);
  const known = buildKnownSourceNumberSet(ctx, json);

  for (const field of textFields(json)) {
    if (!field.text) continue;
    const cleanText = maskDateTimes(field.text);
    const numbers = extractNumbers(cleanText);
    if (numbers.length === 0) continue;
    for (const number of numbers) {
      if (!isAiSlotPath(field.path) && isKnownNumber(known, number)) continue;
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

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = /^([+-]?[\d.]+)\s*(亿|万|千|[kKwW])?$/.exec(String(value).replace(/,/g, '').trim());
  if (!match) {
    const number = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(number) ? number : null;
  }
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'k' || unit === '千') return number * 1000;
  if (unit === 'w' || unit === '万') return number * 10000;
  if (unit === '亿') return number * 100000000;
  return number;
}

function findConsecutiveDuplicate(text) {
  if (!text || typeof text !== 'string') return null;
  const chineseMatch = /([\u4e00-\u9fa5]{2,})\1/.exec(text);
  if (chineseMatch) {
    const word = chineseMatch[1];
    if (word !== '一步' && word !== '一点') {
      return chineseMatch[0];
    }
  }
  const engMatch = /\b([a-zA-Z]{2,})\s+\1\b/i.exec(text);
  if (engMatch) return engMatch[0];
  return null;
}

function cleanRepoName(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  const matched = /^\{\{p:(.+)\}\}$/.exec(trimmed);
  return matched ? matched[1].trim() : trimmed;
}

function buildAllowedRepoSet(ctx, json) {
  const allowed = new Set();
  if (Array.isArray(ctx?.allowedFullNames)) {
    for (const name of ctx.allowedFullNames) allowed.add(name);
  } else if (ctx?.allowedFullNames instanceof Set) {
    for (const name of ctx.allowedFullNames) allowed.add(name);
  }
  if (Array.isArray(ctx?.fullNames)) {
    for (const name of ctx.fullNames) allowed.add(name);
  } else if (ctx?.fullNames instanceof Set) {
    for (const name of ctx.fullNames) allowed.add(name);
  }

  const factRepos = new Set();
  for (const fact of factList(ctx)) {
    if (!fact) continue;
    const name = cleanRepoName(fact.fullName || fact.repo || fact.project);
    if (name) factRepos.add(name);
  }
  if (Array.isArray(ctx?.facts?.projects)) {
    for (const p of ctx.facts.projects) {
      const raw = typeof p === 'string' ? p : (p?.fullName || p?.repo || p?.project);
      const name = cleanRepoName(raw);
      if (name) factRepos.add(name);
    }
  }

  if (factRepos.size > 0) {
    for (const r of factRepos) allowed.add(r);
  } else if (Array.isArray(ctx?.brief?.projects)) {
    for (const p of ctx.brief.projects) {
      const name = cleanRepoName(p?.fullName || p?.repo);
      if (name) allowed.add(name);
    }
  }

  if (Array.isArray(ctx?.brief?.dailyDiff?.dropped)) {
    for (const d of ctx.brief.dailyDiff.dropped) {
      if (typeof d === 'string') allowed.add(d);
      else if (d?.fullName) allowed.add(d.fullName);
    }
  }
  if (Array.isArray(json?.projects)) {
    for (const p of json.projects) {
      if (p?.fullName) allowed.add(p.fullName);
    }
  }
  return allowed;
}

function findRepoFullNames(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = [];
  const re = /(?:^|[\s，。、；：,.;:("'`（「『])([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?=[\s，。、；：,.;:)"'`）」』]|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const owner = m[1];
    const repo = m[2];
    if (/^\d+$/.test(owner) && /^\d+$/.test(repo)) continue;
    if (owner === 'http' || owner === 'https') continue;
    if (/^(?:src|data|reports|templates|fixtures|fixtures_r5|fixtures_r9|cases|briefs|daily|docs|lib|node_modules|brain)$/.test(owner)) continue;
    if (/\.(?:json|js|html|md|png|css|txt)$/.test(repo)) continue;
    if (!/[A-Za-z]/.test(owner) && !/[A-Za-z]/.test(repo)) continue;
    matches.push(`${owner}/${repo}`);
  }
  return matches;
}

function checkRepoWhitelist(json, ctx, doc, findings) {
  const allowed = buildAllowedRepoSet(ctx, json);

  for (const field of textFields(json)) {
    const repos = findRepoFullNames(field.text);
    for (const repo of repos) {
      if (!allowed.has(repo)) {
        findings.push(makeFinding('R5', doc, {
          field: field.path,
          quote: field.text,
          message: `项目名「${repo}」不在当期允许的仓库白名单中`,
        }));
      }
    }
  }

  if (json.hero?.lead) {
    const repos = findRepoFullNames(json.hero.lead);
    for (const repo of repos) {
      if (!allowed.has(repo)) {
        findings.push(makeFinding('R5', doc, {
          field: 'hero.lead',
          quote: json.hero.lead,
          message: `项目名「${repo}」不在当期允许的仓库白名单中`,
        }));
      }
    }
  }

  if (json.sparkNote) {
    const repos = findRepoFullNames(json.sparkNote);
    for (const repo of repos) {
      if (!allowed.has(repo)) {
        findings.push(makeFinding('R5', doc, {
          field: 'sparkNote',
          quote: json.sparkNote,
          message: `项目名「${repo}」不在当期允许的仓库白名单中`,
        }));
      }
    }
  }

  const projects = Array.isArray(json.projects) ? json.projects : [];
  for (const [index, project] of projects.entries()) {
    if (project.fullName && !allowed.has(project.fullName)) {
      findings.push(makeFinding('R5', doc, {
        field: `projects[${index}].fullName`,
        quote: project.fullName,
        message: `项目名「${project.fullName}」不在当期允许的仓库白名单中`,
      }));
    }
  }

  if (json.slots && typeof json.slots === 'object' && !Array.isArray(json.slots)) {
    for (const [slotId, value] of Object.entries(json.slots)) {
      if (slotId.startsWith('project.')) {
        const name = slotId.slice('project.'.length).replace(/\.(?:descZh|descShortZh|oneSentence)$/, '');
        if (name.includes('/') && !allowed.has(name)) {
          findings.push(makeFinding('R5', doc, {
            field: `slots.${slotId}`,
            quote: name,
            message: `项目名「${name}」不在当期允许的仓库白名单中`,
          }));
        }
      }
      if (typeof value === 'string') {
        const repos = findRepoFullNames(value);
        for (const repo of repos) {
          if (!allowed.has(repo)) {
            findings.push(makeFinding('R5', doc, {
              field: `slots.${slotId}`,
              quote: value,
              message: `项目名「${repo}」不在当期允许的仓库白名单中`,
            }));
          }
        }
      }
    }
  }
}

function findLongestCommonSubstring(str1, str2) {
  if (!str1 || !str2) return '';
  const s1 = String(str1);
  const s2 = String(str2);
  let longest = '';
  for (let i = 0; i < s1.length; i++) {
    for (let len = 12; i + len <= s1.length; len++) {
      const sub = s1.slice(i, i + len);
      if (s2.includes(sub)) {
        if (sub.length > longest.length) longest = sub;
      } else {
        break;
      }
    }
  }
  return longest;
}

function checkCardDuplicate(json, doc, findings) {
  const projects = Array.isArray(json.projects) ? json.projects : [];
  const seenOneSentences = new Map();
  const seenDescZh = new Map();
  const seenDescShortZh = new Map();

  for (const [index, project] of projects.entries()) {
    const fullName = project?.fullName || project?.repo || null;
    const oneSentence = String(
      project?.oneSentence
      || (fullName ? json.slots?.[`project.${fullName}.oneSentence`] : '')
      || ''
    ).trim();
    const descZh = String(
      project?.descZh
      || (fullName ? json.slots?.[`project.${fullName}.descZh`] : '')
      || ''
    ).trim();
    const descShortZh = String(
      project?.descShortZh
      || (fullName ? json.slots?.[`project.${fullName}.descShortZh`] : '')
      || ''
    ).trim();

    if (descZh && oneSentence && oneSentence === descZh) {
      findings.push(makeFinding('R5', doc, {
        field: `projects[${index}].oneSentence`,
        quote: oneSentence,
        message: '项目卡一句话与本卡简介相同（FIELD_MAP 一句话须为项目描述）',
      }));
    }

    if (oneSentence) {
      if (seenOneSentences.has(oneSentence)) {
        const prevIndex = seenOneSentences.get(oneSentence);
        findings.push(makeFinding('R5', doc, {
          field: `projects[${index}].oneSentence`,
          quote: oneSentence,
          message: `项目卡一句话跨卡重复（与第 ${prevIndex + 1} 张卡重复）`,
        }));
      } else {
        for (const [prevIndex, prevProject] of projects.slice(0, index).entries()) {
          const prevFullName = prevProject?.fullName || prevProject?.repo || null;
          const prevOneSentence = String(
            prevProject?.oneSentence
            || (prevFullName ? json.slots?.[`project.${prevFullName}.oneSentence`] : '')
            || ''
          ).trim();
          const overlap = findLongestCommonSubstring(oneSentence, prevOneSentence);
          if (overlap && overlap.length >= 12) {
            findings.push(makeFinding('R5', doc, {
              field: `projects[${index}].oneSentence`,
              quote: overlap,
              message: `项目卡一句话与第 ${prevIndex + 1} 张卡存在 ≥12 字重复片段「${overlap}」`,
            }));
            break;
          }
        }
        seenOneSentences.set(oneSentence, index);
      }
    }

    if (descZh) {
      if (seenDescZh.has(descZh)) {
        const prevIndex = seenDescZh.get(descZh);
        findings.push(makeFinding('R5', doc, {
          field: `projects[${index}].descZh`,
          quote: descZh,
          message: `项目卡简介跨卡重复（与第 ${prevIndex + 1} 张卡重复）`,
        }));
      } else {
        for (const [prevIndex, prevProject] of projects.slice(0, index).entries()) {
          const prevFullName = prevProject?.fullName || prevProject?.repo || null;
          const prevDescZh = String(
            prevProject?.descZh
            || (prevFullName ? json.slots?.[`project.${prevFullName}.descZh`] : '')
            || ''
          ).trim();
          const overlap = findLongestCommonSubstring(descZh, prevDescZh);
          if (overlap && overlap.length >= 12) {
            findings.push(makeFinding('R5', doc, {
              field: `projects[${index}].descZh`,
              quote: overlap,
              message: `项目卡简介与第 ${prevIndex + 1} 张卡存在 ≥12 字重复片段「${overlap}」`,
            }));
            break;
          }
        }
        seenDescZh.set(descZh, index);
      }
    }

    if (descShortZh) {
      if (seenDescShortZh.has(descShortZh)) {
        const prevIndex = seenDescShortZh.get(descShortZh);
        findings.push(makeFinding('R5', doc, {
          field: `projects[${index}].descShortZh`,
          quote: descShortZh,
          message: `项目卡 Top8 描述跨卡重复（与第 ${prevIndex + 1} 张卡重复）`,
        }));
      } else {
        for (const [prevIndex, prevProject] of projects.slice(0, index).entries()) {
          const prevFullName = prevProject?.fullName || prevProject?.repo || null;
          const prevDescShortZh = String(
            prevProject?.descShortZh
            || (prevFullName ? json.slots?.[`project.${prevFullName}.descShortZh`] : '')
            || ''
          ).trim();
          const overlap = findLongestCommonSubstring(descShortZh, prevDescShortZh);
          if (overlap && overlap.length >= 12) {
            findings.push(makeFinding('R5', doc, {
              field: `projects[${index}].descShortZh`,
              quote: overlap,
              message: `项目卡 Top8 描述与第 ${prevIndex + 1} 张卡存在 ≥12 字重复片段「${overlap}」`,
            }));
            break;
          }
        }
        seenDescShortZh.set(descShortZh, index);
      }
    }
  }
}

function getPrevDate(ctx, json) {
  if (json?.prevDate) return json.prevDate;
  if (ctx?.brief?.dailyDiff?.prevDate) return ctx.brief.dailyDiff.prevDate;
  if (ctx?.brief?.stats?.prevDate) return ctx.brief.stats.prevDate;
  for (const fact of factList(ctx)) {
    const match = /briefs\/daily\/data-(\d{4}-\d{2}-\d{2})\.json/.exec(String(fact?.source || ''));
    if (match) return match[1];
  }
  const date = json?.date || ctx?.period || ctx?.brief?.date;
  const scrapedAt = ctx?.brief?.scrapedAt || ctx?.brief?.generatedAt;
  if (scrapedAt && typeof history.getBaselineSnapshot === 'function') {
    const baseline = history.getBaselineSnapshot(scrapedAt);
    if (baseline?.date) return baseline.date;
  }
  if (date && typeof history.getPreviousDailyDate === 'function') {
    return history.getPreviousDailyDate(date);
  }
  return null;
}

function parseYMD(str) {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str).trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function toYMD(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function checkPeriodLabels(json, ctx, doc, findings) {
  const date = json?.date || ctx?.period || ctx?.brief?.date || '2026-10-21';
  const prevDate = getPrevDate(ctx, json);
  if (!prevDate) return;

  const prevMMDD = prevDate.slice(5);
  const baseDate = parseYMD(date);

  const checkItem = (path, text) => {
    if (!text || typeof text !== 'string') return;

    // 1. 上期（MM-DD） or 较上期（MM-DD） or 上期 MM-DD
    const shangqiDateRe = /(?:较?上期|上期快照)[（(]?\s*(\d{1,2})[-/.月](\d{1,2})日?[）)]?/g;
    let match;
    while ((match = shangqiDateRe.exec(text)) !== null) {
      const m = String(match[1]).padStart(2, '0');
      const d = String(match[2]).padStart(2, '0');
      const mmdd = `${m}-${d}`;
      if (mmdd !== prevMMDD) {
        findings.push(makeFinding('R5', doc, {
          field: path,
          quote: text,
          message: `时间指代「${match[0]}」日期（${mmdd}）与上一份快照日期（${prevDate}）不一致`,
        }));
      }
    }

    // 2. Explicit MM-DD used in comparison: 较 10-20, 比 10-18, etc.
    const explicitCmpRe = /(?:较|比|相对|距)\s*(\d{1,2})[-/.月](\d{1,2})日?/g;
    while ((match = explicitCmpRe.exec(text)) !== null) {
      const m = String(match[1]).padStart(2, '0');
      const d = String(match[2]).padStart(2, '0');
      const mmdd = `${m}-${d}`;
      if (mmdd !== prevMMDD) {
        findings.push(makeFinding('R5', doc, {
          field: path,
          quote: text,
          message: `时间指代「${match[0]}」日期（${mmdd}）与上一份快照日期（${prevDate}）不一致`,
        }));
      }
    }

    // 3. 昨 / 昨儿 / 昨天 / 昨日 / 昨 (when followed by space or punctuation)
    const yesterdayRe = /(?:较昨日|与昨儿相比|昨儿|昨日|昨天|昨[\s\u00a0，,])/g;
    while ((match = yesterdayRe.exec(text)) !== null) {
      const target = baseDate ? toYMD(new Date(baseDate.getTime() - 24 * 3600 * 1000)) : null;
      if (target && target !== prevDate) {
        findings.push(makeFinding('R5', doc, {
          field: path,
          quote: text,
          message: `时间指代「${match[0].trim()}」（换算为 ${target}）与上一份快照日期（${prevDate}）不一致`,
        }));
      }
    }

    // 4. 前日 / 前一天 / 比前一天 / 较前日
    const qianRe = /(?:较前日|前日|前一天|比前一天)/g;
    while ((match = qianRe.exec(text)) !== null) {
      const target = baseDate ? toYMD(new Date(baseDate.getTime() - 24 * 3600 * 1000)) : null;
      if (target && target !== prevDate) {
        findings.push(makeFinding('R5', doc, {
          field: path,
          quote: text,
          message: `时间指代「${match[0]}」（换算为 ${target}）与上一份快照日期（${prevDate}）不一致`,
        }));
      }
    }

    // 5. 上周 / 上周同期
    const shangzhouRe = /(?:较上周|上周同期|上周)/g;
    while ((match = shangzhouRe.exec(text)) !== null) {
      const target = baseDate ? toYMD(new Date(baseDate.getTime() - 7 * 24 * 3600 * 1000)) : null;
      if (target && target !== prevDate) {
        findings.push(makeFinding('R5', doc, {
          field: path,
          quote: text,
          message: `时间指代「${match[0]}」（换算为 ${target}）与上一份快照日期（${prevDate}）不一致`,
        }));
      }
    }

    // 6. 上月 / 上月同期
    const shangyueRe = /(?:较上月|上月同期|上月)/g;
    while ((match = shangyueRe.exec(text)) !== null) {
      const target = baseDate ? toYMD(new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() - 1, baseDate.getUTCDate()))) : null;
      if (target && target !== prevDate) {
        findings.push(makeFinding('R5', doc, {
          field: path,
          quote: text,
          message: `时间指代「${match[0]}」（换算为 ${target}）与上一份快照日期（${prevDate}）不一致`,
        }));
      }
    }

    // 7. N 天前
    const nDaysRe = /(\d+)\s*天前/g;
    while ((match = nDaysRe.exec(text)) !== null) {
      const n = Number(match[1]);
      const target = baseDate ? toYMD(new Date(baseDate.getTime() - n * 24 * 3600 * 1000)) : null;
      if (target && target !== prevDate) {
        findings.push(makeFinding('R5', doc, {
          field: path,
          quote: text,
          message: `时间指代「${match[0]}」（换算为 ${target}）与上一份快照日期（${prevDate}）不一致`,
        }));
      }
    }
  };

  for (const field of textFields(json)) {
    checkItem(field.path, field.text);
  }

  // 区块标题与目录文字
  checkItem('cmpTitle', json.cmpTitle);
  checkItem('cmpNav', json.cmpNav);
  checkItem('cmpNavText', json.cmpNavText);
  checkItem('cmpNavLabel', json.cmpNavLabel);

  if (json.nav && typeof json.nav === 'object') {
    checkItem('nav.cmp', json.nav.cmp);
    checkItem('nav.cmpTitle', json.nav.cmpTitle);
    checkItem('nav.cmpText', json.nav.cmpText);
    checkItem('nav.cmpNav', json.nav.cmpNav);
  }

  if (json.toc && typeof json.toc === 'object') {
    checkItem('toc.cmp', json.toc.cmp);
    checkItem('toc.cmpTitle', json.toc.cmpTitle);
    checkItem('toc.cmpText', json.toc.cmpText);
  }

  if (Array.isArray(json.metrics)) {
    for (const [index, m] of json.metrics.entries()) {
      checkItem(`metrics[${index}].prevLabel`, m.prevLabel);
      checkItem(`metrics[${index}].label`, m.label);
      checkItem(`metrics[${index}].dYText`, m.dYText);
    }
  }
  checkItem('sparkNote', json.sparkNote);

  if (json.cmp) {
    checkItem('cmp.title', json.cmp.title);
    checkItem('cmp.navText', json.cmp.navText);
    checkItem('cmp.navLabel', json.cmp.navLabel);
    checkItem('cmp.prevDateLabel', json.cmp.prevDateLabel);
    checkItem('cmp.caption', json.cmp.caption);
    if (Array.isArray(json.cmp.rows)) {
      for (const [rIndex, row] of json.cmp.rows.entries()) {
        checkItem(`cmp.rows[${rIndex}].label`, row.label);
        if (Array.isArray(row.refs)) {
          for (const [cIndex, ref] of row.refs.entries()) {
            checkItem(`cmp.rows[${rIndex}].refs[${cIndex}].lab`, ref.lab);
          }
        }
      }
    }
  }

  if (Array.isArray(json.langRows)) {
    for (const [index, row] of json.langRows.entries()) {
      checkItem(`langRows[${index}].label`, row.label);
    }
  }
  if (Array.isArray(json.typeRows)) {
    for (const [index, row] of json.typeRows.entries()) {
      checkItem(`typeRows[${index}].label`, row.label);
    }
  }
  checkItem('langNote', json.langNote);

  if (json.slope) {
    checkItem('slope.colPrev', json.slope.colPrev);
  }
  if (Array.isArray(json.rankRows)) {
    for (const [index, row] of json.rankRows.entries()) {
      checkItem(`rankRows[${index}].prev`, row.prev);
    }
  }
  checkItem('rankNote', json.rankNote);
}

function findMatchingCmpRow(rows, metricLabel) {
  if (!Array.isArray(rows)) return null;
  const norm = String(metricLabel || '').replace(/\s+/g, '').replace(/数$/, '');
  return rows.find(row => {
    const rowNorm = String(row.label || '').replace(/\s+/g, '').replace(/数$/, '');
    if (norm === rowNorm) return true;
    if (norm.includes('上榜') && rowNorm.includes('上榜')) return true;
    if (norm.includes('AI') && rowNorm.includes('AI')) return true;
    if ((norm.includes('今日新增') || norm.includes('当日新增')) && (rowNorm.includes('今日新增') || rowNorm.includes('当日新增'))) return true;
    if ((norm.includes('平均总星') || norm.includes('平均Stars')) && (rowNorm.includes('平均总星') || rowNorm.includes('平均Stars'))) return true;
    return false;
  }) || null;
}

function checkMetricDy(json, ctx, doc, findings) {
  const metrics = Array.isArray(json.metrics) ? json.metrics : [];
  if (!metrics.length) return;
  const cmpRows = json.cmp?.rows || ctx?.cmp?.rows || null;
  if (!cmpRows) return;

  for (const [index, metric] of metrics.entries()) {
    if (metric.dYText === undefined || metric.dYText === null || metric.dYText === '') continue;
    const cmpRow = findMatchingCmpRow(cmpRows, metric.label);
    if (!cmpRow || !Array.isArray(cmpRow.refs) || !cmpRow.refs.length) continue;
    const prevRef = cmpRow.refs.find(ref => ref && ref.lab && (ref.lab.includes('上期') || ref.lab.includes('昨日'))) || cmpRow.refs[0];
    if (!prevRef || prevRef.value === undefined || prevRef.value === null || cmpRow.now === undefined || cmpRow.now === null) continue;

    const nowVal = toNumber(cmpRow.now);
    const prevVal = toNumber(prevRef.value);
    const dyCardVal = toNumber(metric.dYText);
    if (nowVal === null || prevVal === null || dyCardVal === null) continue;

    const expectedDiff = Math.abs(nowVal - prevVal);
    const threshold = expectedDiff >= 1000 ? 100 : 0.05;
    if (Math.abs(dyCardVal - expectedDiff) > threshold) {
      findings.push(makeFinding('R5', doc, {
        field: `metrics[${index}].dYText`,
        quote: String(metric.dYText),
        message: `指标卡「${metric.label}」dy 数值（${metric.dYText}）与参照表上期差值（${nowVal - prevVal}）不一致`,
      }));
    }
  }
}

function checkConsecutiveDuplicates(json, doc, findings) {
  const checkText = (path, text) => {
    if (!text || typeof text !== 'string') return;
    const dup = findConsecutiveDuplicate(text);
    if (dup) {
      findings.push(makeFinding('R5', doc, {
        field: path,
        quote: text,
        message: `文本出现连续重复词「${dup}」`,
      }));
    }
  };

  for (const field of textFields(json)) {
    checkText(field.path, field.text);
  }

  if (json.hero?.lead) checkText('hero.lead', json.hero.lead);
  if (json.sparkNote) checkText('sparkNote', json.sparkNote);
  if (json.langNote) checkText('langNote', json.langNote);
  if (json.rankNote) checkText('rankNote', json.rankNote);

  const projects = Array.isArray(json.projects) ? json.projects : [];
  for (const [index, p] of projects.entries()) {
    if (p.descZh) checkText(`projects[${index}].descZh`, p.descZh);
    if (p.descShortZh) checkText(`projects[${index}].descShortZh`, p.descShortZh);
    if (p.oneSentence) checkText(`projects[${index}].oneSentence`, p.oneSentence);
  }

  if (json.slots && typeof json.slots === 'object' && !Array.isArray(json.slots)) {
    for (const [key, val] of Object.entries(json.slots)) {
      if (typeof val === 'string') checkText(`slots.${key}`, val);
    }
  }
}

function collectAllDocumentTexts(json) {
  const fields = [];
  if (!json || typeof json !== 'object') return fields;
  if (json.hero && typeof json.hero === 'object') {
    if (typeof json.hero.lead === 'string') fields.push({ path: 'hero.lead', text: json.hero.lead });
    if (typeof json.hero.sub === 'string') fields.push({ path: 'hero.sub', text: json.hero.sub });
    if (typeof json.hero.oneLiner === 'string') fields.push({ path: 'hero.oneLiner', text: json.hero.oneLiner });
    if (typeof json.hero.reason === 'string') fields.push({ path: 'hero.reason', text: json.hero.reason });
  }
  for (const [idx, item] of (Array.isArray(json.trends) ? json.trends : []).entries()) {
    fields.push({ path: `trends[${idx}].text`, text: fieldText(item) });
  }
  if (json.analysis) fields.push({ path: 'analysis', text: fieldText(json.analysis) });
  for (const [idx, item] of (Array.isArray(json.advice) ? json.advice : []).entries()) {
    fields.push({ path: `advice[${idx}].text`, text: fieldText(item) });
  }
  if (typeof json.churnNewText === 'string') fields.push({ path: 'churnNewText', text: json.churnNewText });
  if (typeof json.churnDropText === 'string') fields.push({ path: 'churnDropText', text: json.churnDropText });
  for (const [idx, p] of (Array.isArray(json.projects) ? json.projects : []).entries()) {
    if (p && typeof p === 'object') {
      if (typeof p.descZh === 'string') fields.push({ path: `projects[${idx}].descZh`, text: p.descZh });
      if (typeof p.descShortZh === 'string') fields.push({ path: `projects[${idx}].descShortZh`, text: p.descShortZh });
      if (typeof p.oneSentence === 'string') fields.push({ path: `projects[${idx}].oneSentence`, text: p.oneSentence });
    }
  }
  if (json.slots && typeof json.slots === 'object' && !Array.isArray(json.slots)) {
    for (const [k, v] of Object.entries(json.slots)) {
      if (typeof v === 'string') fields.push({ path: `slots.${k}`, text: v });
    }
  }
  return fields;
}

function buildFactNumberSet(ctx, json) {
  return buildKnownSourceNumberSet(ctx, json);
}

function checkThreeDigitNumbersInFacts(json, ctx, doc, findings) {
  const known = buildKnownSourceNumberSet(ctx, json);
  const fields = collectAllDocumentTexts(json);

  for (const field of fields) {
    if (!field.text) continue;
    const cleanText = maskDateTimes(field.text);
    const numbers = extractNumbers(cleanText);
    for (const num of numbers) {
      const norm = normalizeNumberText(num);
      const parsed = toNumber(num) ?? parseMetricNumber(num);
      const digitsOnly = norm.replace(/\D/g, '');
      const isThreeDigits = digitsOnly.length >= 3 || (parsed !== null && Math.abs(parsed) >= 100);
      if (!isThreeDigits) continue;

      const isKnown = !isAiSlotPath(field.path) && isKnownNumber(known, num);
      if (!isKnown) {
        findings.push(makeFinding('R5', doc, {
          field: field.path,
          quote: field.text,
          message: `页面文本含 3 位以上数字「${num}」，但在 facts 中找不到对应条目`,
        }));
      }
    }
  }
}

function check(ctx, doc, config) {
  if (!isR5Insights(doc.json)) return [];
  const findings = [];
  checkSlots(doc.json, doc, config || {}, findings);
  checkNumbers(doc.json, ctx, doc, findings);
  checkThreeDigitNumbersInFacts(doc.json, ctx, doc, findings);
  checkHero(doc.json, doc, findings);
  checkCardIntro(doc.json, doc, findings);
  checkAvgStars(doc.json, doc, findings);
  checkFieldMapBlocks(doc.json, doc, findings);
  checkNoPlaceholder(doc.json, doc, findings);
  checkTrendNumbers(doc.json, doc, findings);
  checkCardRepoName(doc.json, doc, findings);
  checkRepoWhitelist(doc.json, ctx, doc, findings);
  checkCardDuplicate(doc.json, doc, findings);
  checkPeriodLabels(doc.json, ctx, doc, findings);
  checkMetricDy(doc.json, ctx, doc, findings);
  checkConsecutiveDuplicates(doc.json, doc, findings);

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
