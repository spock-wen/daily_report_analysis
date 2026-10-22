'use strict';

const { splitSentenceUnits, escapeRegExp } = require('../text');
const { makeFinding } = require('./util');
const { statusWordFromTag } = require('../../facts/status');

const UP_WORDS = new Set(['升温', '上升', '走高', '上涨', '增长', '增加', '提升', '提速', '放大', '增强']);
const DOWN_WORDS = new Set(['降温', '下降', '走低', '下滑', '减少', '回落', '收缩', '减弱', '缩小', '放缓', '减速']);
const FLAT_WORDS = new Set(['持平', '不变', '企稳']);
const STREAK_PATTERN = '连续(?:\\s*\\d+\\s*[天日]|上榜)?';

function wordDirection(word) {
  if (UP_WORDS.has(word)) return 'up';
  if (DOWN_WORDS.has(word)) return 'down';
  if (FLAT_WORDS.has(word)) return 'flat';
  return null;
}

function wordSections(config) {
  const direction = [];
  const status = [];
  for (const item of config?.directionStatusWords || []) {
    if (!item || !item.word) continue;
    if (item.kind === 'status') status.push(item.word);
    else direction.push(item.word);
  }
  return { direction, status };
}

function wordRegex(sections) {
  const words = [...sections.direction, ...sections.status].sort((left, right) => right.length - left.length);
  const parts = [];
  const seen = new Set();
  for (const word of words) {
    if (!word || seen.has(word)) continue;
    seen.add(word);
    parts.push(word === '连续' ? STREAK_PATTERN : escapeRegExp(word));
  }
  return parts.length ? new RegExp(parts.join('|'), 'g') : null;
}

function classifyWord(word, sections) {
  if (sections.status.some(item => item === word || (item === '连续' && word.startsWith('连续')))) {
    return 'status';
  }
  return 'direction';
}

function stripExempt(text, exemptWords) {
  let result = String(text || '');
  for (const word of [...exemptWords].sort((left, right) => right.length - left.length)) {
    if (!word) continue;
    result = result.split(word).join('');
  }
  return result;
}

const COUNT_UNIT_AFTER_RE = /^\s*(?:\d+|\{\{f\d+(?::[a-z0-9_]+)?\}\})\s*个/;
const COUNT_ENUM_BEFORE_RE = /(?:\d+\s*个)\s*[、,，/和及与]\s*$/;

// B18 豁免类目计数：「回归 4 个」「新进 6 个」「掉榜 5 个」。
function isCountEnumeration(text, index, word) {
  const source = String(text || '');
  const after = source.slice(index + String(word || '').length);
  if (COUNT_UNIT_AFTER_RE.test(after)) return true;
  const before = source.slice(0, index);
  if (COUNT_ENUM_BEFORE_RE.test(before)) return true;
  return false;
}

function factsList(ctx) {
  if (Array.isArray(ctx.facts)) return ctx.facts;
  if (Array.isArray(ctx.facts?.facts)) return ctx.facts.facts;
  return [];
}

function factMap(ctx) {
  const map = new Map();
  for (const fact of factsList(ctx)) {
    if (fact && fact.id !== undefined && fact.id !== null) map.set(String(fact.id), fact);
  }
  return map;
}

function renderEntries(ctx) {
  return Array.isArray(ctx.renderMap?.entries) ? ctx.renderMap.entries : [];
}

function directionEntries(ctx) {
  const facts = factMap(ctx);
  const entries = [];
  for (const entry of renderEntries(ctx)) {
    if (!entry || typeof entry !== 'object') continue;
    const fact = entry.factId !== undefined && entry.factId !== null ? facts.get(String(entry.factId)) : null;
    if (entry.role !== 'direction' && fact?.role !== 'direction') continue;
    entries.push({ entry, fact });
  }
  return entries;
}

function statusEntries(ctx) {
  return renderEntries(ctx).filter(entry => entry && entry.role === 'status');
}

function expectedDirection(comparison) {
  const delta = comparison.current - comparison.reference;
  if (comparison.kind === 'acceleration') {
    const ratio = comparison.reference > 0 ? Math.abs(delta) / comparison.reference : null;
    if (ratio !== null && ratio < 0.05) return 'flat';
    if (delta > 0) return 'up';
    if (delta < 0) return 'down';
    return 'flat';
  }
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

function directionLabel(direction) {
  if (direction === 'up') return '上升/提速';
  if (direction === 'down') return '下降/放缓';
  return '持平';
}

function validateDirectionEntry(entry, fact, doc, findings) {
  const field = entry.path || 'render_map';
  if (!fact) {
    findings.push(makeFinding('B18', doc, {
      field,
      quote: entry.placeholder || entry.text || '',
      message: `方向渲染条目 ${entry.placeholder || ''} 找不到对应事实（${entry.factId || '无 id'}）`,
    }));
    return;
  }
  if (entry.role !== 'direction') {
    findings.push(makeFinding('B18', doc, {
      field,
      quote: entry.placeholder || entry.text || '',
      message: `方向事实 ${fact.id} 必须用 {{d:${fact.id}}} 渲染，当前 role 为「${entry.role || ''}」`,
    }));
    return;
  }

  const current = Number(fact.current);
  const reference = Number(fact.reference);
  if (!Number.isFinite(current) || !Number.isFinite(reference)) {
    findings.push(makeFinding('B18', doc, {
      field,
      quote: entry.placeholder || entry.text || '',
      message: `方向事实 ${fact.id} 缺少可校验的 current/reference`,
    }));
    return;
  }

  const expected = expectedDirection({
    current,
    reference,
    kind: fact.comparison?.kind || null,
  });
  const factWord = String(fact.value ?? '').trim();
  const actual = wordDirection(factWord);
  if (!actual || actual !== expected) {
    findings.push(makeFinding('B18', doc, {
      field,
      quote: entry.placeholder || entry.text || '',
      message: `方向事实 ${fact.id} 的值「${factWord}」与数值比较不一致（今日 ${current} vs 参照 ${reference}，应为 ${directionLabel(expected)}）`,
    }));
    return;
  }

  if (String(entry.text ?? '').trim() !== factWord) {
    findings.push(makeFinding('B18', doc, {
      field,
      quote: entry.placeholder || entry.text || '',
      message: `方向渲染文本「${entry.text || ''}」与事实 ${fact.id} 的值「${factWord}」不一致`,
    }));
  }
}

function normalizeProjectName(value) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  const placeholder = /^\{\{s:([^{}]+)\}\}$/.exec(text);
  return placeholder ? placeholder[1].trim() : text;
}

function validateStatusEntry(entry, ctx, doc, findings) {
  const field = entry.path || 'render_map';
  const name = entry.project || normalizeProjectName(entry.placeholder);
  if (!name) {
    findings.push(makeFinding('B18', doc, {
      field,
      quote: entry.placeholder || entry.text || '',
      message: `状态渲染条目 ${entry.placeholder || ''} 缺少项目名`,
    }));
    return;
  }
  const project = (ctx.projects || []).find(item => String(item.fullName) === String(name));
  const tag = project?.project?.tag;
  if (!tag) return;
  const expected = statusWordFromTag(tag);
  if (!expected) return;
  if (String(entry.text ?? '').trim() !== expected) {
    findings.push(makeFinding('B18', doc, {
      field,
      quote: entry.placeholder || entry.text || '',
      message: `状态渲染文本「${entry.text || ''}」与项目 ${name} 的卡片标签「${tag}」对应状态「${expected}」不一致`,
    }));
  }
}

function remainingTexts(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const text = String(entry?.text === undefined || entry?.text === null ? '' : entry.text).trim();
    if (!text) continue;
    counts.set(text, (counts.get(text) || 0) + 1);
  }
  return counts;
}

function scanText(doc, text, field, line, allowed, sections, regex, config, findings) {
  if (!regex) return;
  for (const unit of splitSentenceUnits(text)) {
    const cleaned = stripExempt(unit, config.metricNameExempt || []);
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(cleaned)) !== null) {
      const word = match[0];
      const kind = classifyWord(word, sections);
      if (kind === 'direction' && !allowed.checkDirection) continue;
      if (kind === 'status' && !allowed.checkStatus) continue;
      const counts = kind === 'status' ? allowed.status : allowed.direction;
      if (isCountEnumeration(cleaned, match.index, word)) continue;
      const count = counts.get(word) || 0;
      if (count > 0) {
        counts.set(word, count - 1);
        continue;
      }
      findings.push(makeFinding('B18', doc, {
        field,
        line,
        quote: unit,
        message: kind === 'status'
          ? `状态词「${word}」不是 render_map 中 {{s:owner/repo}} 的渲染结果（AI 自写状态词）`
          : `方向词「${word}」不是 render_map 中 {{d:<fid>}} 的渲染结果（AI 自写方向词）`,
      }));
    }
  }
}

function check(ctx, doc, config) {
  const findings = [];
  const sections = wordSections(config);
  const regex = wordRegex(sections);
  const directionList = directionEntries(ctx);
  const statusList = statusEntries(ctx);

  for (const { entry, fact } of directionList) {
    validateDirectionEntry(entry, fact, doc, findings);
  }

  const hasDirectionBasis = directionList.length > 0 || factsList(ctx).some(fact => fact && fact.role === 'direction');
  const checkDirection = hasDirectionBasis || (ctx.level === 'daily' && Boolean(ctx.renderMap));
  const checkStatus = ctx.level === 'daily' && doc.role === 'insights' && (Boolean(ctx.renderMap) || statusList.length > 0);

  if (checkStatus) {
    for (const entry of statusList) {
      validateStatusEntry(entry, ctx, doc, findings);
    }
  }

  if (!checkDirection && !checkStatus) return findings;

  if (doc.kind === 'json') {
    for (const item of doc.strings) {
      const pathEntries = directionList.filter(itemEntry => String(itemEntry.entry.path || '') === String(item.path || ''));
      const pathStatus = statusList.filter(entry => String(entry.path || '') === String(item.path || ''));
      scanText(doc, item.value, item.path, item.line, {
        checkDirection,
        checkStatus,
        direction: remainingTexts(pathEntries.map(itemEntry => itemEntry.entry)),
        status: remainingTexts(pathStatus),
      }, sections, regex, config, findings);
    }
  } else {
    scanText(doc, doc.text, 'document', null, {
      checkDirection,
      checkStatus,
      direction: remainingTexts(directionList.map(itemEntry => itemEntry.entry)),
      status: remainingTexts(statusList),
    }, sections, regex, config, findings);
  }

  return findings;
}

function isR5Daily(ctx) {
  return ctx.level === 'daily' && Boolean(ctx.insights)
    && (ctx.insights.version === 'r5'
      || ctx.insights.version === 'r9'
      || (ctx.insights.slots && typeof ctx.insights.slots === 'object' && !Array.isArray(ctx.insights.slots)));
}

module.exports = {
  id: 'B18',
  applies: (ctx, doc) => !isR5Daily(ctx) && ['insights', 'html', 'md'].includes(doc.role),
  check,
  expectedDirection,
  wordDirection,
  wordSections,
  wordRegex,
  classifyWord,
  stripExempt,
  isCountEnumeration,
};
