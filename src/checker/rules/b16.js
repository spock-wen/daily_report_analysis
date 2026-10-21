'use strict';

const { splitSentenceUnits } = require('../text');
const { makeFinding } = require('./util');

// B16：禁用「不是……而是……」句式。
const NOT_BUT_RE = /不是[^。！？!?\n]{0,80}?而是/;

// B16：成品中的方向词必须来自 render_map 的 {{f<id>:direction}} 渲染条目。
const DIRECTION_WORD_RE = /高于|低于|升温|上升|走高|上涨|增长|增加|提升|提速|放大|增强|降温|下降|走低|下滑|减少|回落|收缩|减弱|缩小|放缓|减速|持平|不变|企稳/g;
const UP_WORDS = new Set(['升温', '上升', '走高', '上涨', '增长', '增加', '提升', '提速', '放大', '增强']);
const DOWN_WORDS = new Set(['降温', '下降', '走低', '下滑', '减少', '回落', '收缩', '减弱', '缩小', '放缓', '减速']);
const FLAT_WORDS = new Set(['持平', '不变', '企稳']);
const RELATIONAL_WORDS = new Set(['高于', '低于']);

function wordDirection(word) {
  if (UP_WORDS.has(word)) return 'up';
  if (DOWN_WORDS.has(word)) return 'down';
  if (FLAT_WORDS.has(word)) return 'flat';
  return null;
}

function isDirectionWord(word) {
  return Boolean(wordDirection(word)) || RELATIONAL_WORDS.has(word);
}

function factsList(ctx) {
  if (Array.isArray(ctx.facts)) return ctx.facts;
  if (Array.isArray(ctx.facts?.facts)) return ctx.facts.facts;
  return [];
}

function directionFacts(ctx) {
  return factsList(ctx).filter(fact => fact && fact.role === 'direction');
}

function renderEntries(ctx) {
  return Array.isArray(ctx.renderMap?.entries) ? ctx.renderMap.entries : [];
}

function factMap(ctx) {
  const map = new Map();
  for (const fact of factsList(ctx)) {
    if (fact && fact.id !== undefined && fact.id !== null) map.set(String(fact.id), fact);
  }
  return map;
}

// 只配对 role=direction 的渲染条目，或指向 direction 事实的条目（后者会被判 role 不一致）。
function directionEntries(ctx) {
  const facts = factMap(ctx);
  const entries = [];
  for (const entry of renderEntries(ctx)) {
    if (!entry || typeof entry !== 'object') continue;
    const fact = entry.factId !== undefined && entry.factId !== null
      ? facts.get(String(entry.factId))
      : null;
    if (entry.role !== 'direction' && fact?.role !== 'direction') continue;
    entries.push({ entry, fact });
  }
  return entries;
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

function validateDirectionEntry(entry, fact, field, line, doc, findings) {
  if (!fact) {
    findings.push(makeFinding('B16', doc, {
      field,
      line,
      quote: entry.placeholder || entry.text || '',
      message: `方向渲染条目 ${entry.placeholder || ''} 找不到对应事实（${entry.factId || '无 id'}）`,
    }));
    return;
  }
  if (entry.role !== 'direction') {
    findings.push(makeFinding('B16', doc, {
      field,
      line,
      quote: entry.placeholder || entry.text || '',
      message: `方向事实 ${fact.id} 必须用 {{f${fact.id}:direction}} 渲染，当前 role 为「${entry.role || ''}」`,
    }));
    return;
  }

  const current = Number(fact.current);
  const reference = Number(fact.reference);
  if (!Number.isFinite(current) || !Number.isFinite(reference)) {
    findings.push(makeFinding('B16', doc, {
      field,
      line,
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
    findings.push(makeFinding('B16', doc, {
      field,
      line,
      quote: entry.placeholder || entry.text || '',
      message: `方向事实 ${fact.id} 的值「${factWord}」与数值比较不一致（今日 ${current} vs 参照 ${reference}，应为 ${directionLabel(expected)}）`,
    }));
    return;
  }

  if (String(entry.text ?? '').trim() !== factWord) {
    findings.push(makeFinding('B16', doc, {
      field,
      line,
      quote: entry.placeholder || entry.text || '',
      message: `方向渲染文本「${entry.text || ''}」与事实 ${fact.id} 的值「${factWord}」不一致`,
    }));
  }
}

function checkDirectionInText(doc, text, field, line, entries, seen, findings) {
  for (const item of entries) {
    if (seen.has(item.entry)) continue;
    seen.add(item.entry);
    validateDirectionEntry(item.entry, item.fact, item.entry.path || field, line, doc, findings);
  }

  const remaining = new Map();
  for (const item of entries) {
    const word = String(item.entry.text ?? '').trim();
    if (!word) continue;
    remaining.set(word, (remaining.get(word) || 0) + 1);
  }

  for (const unit of splitSentenceUnits(text)) {
    DIRECTION_WORD_RE.lastIndex = 0;
    let match;
    while ((match = DIRECTION_WORD_RE.exec(unit)) !== null) {
      const word = match[0];
      if (!isDirectionWord(word)) continue;
      const count = remaining.get(word) || 0;
      if (count > 0) {
        remaining.set(word, count - 1);
        continue;
      }
      findings.push(makeFinding('B16', doc, {
        field,
        line,
        quote: unit,
        message: `方向词「${word}」不是 render_map 中 {{f<id>:direction}} 的渲染结果（AI 自写方向词）`,
      }));
    }
  }
}

function checkDirection(ctx, doc) {
  const entries = directionEntries(ctx);
  // 日报按 B16：有 render_map 时，任何不在 render_map 的方向词都视为 AI 自写；
  // 其他层级仅在存在 direction 事实/条目时校验，避免把普通趋势词当方向断言。
  const hasDirectionBasis = entries.length > 0 || directionFacts(ctx).length > 0;
  if (!hasDirectionBasis && !(ctx.level === 'daily' && ctx.renderMap)) return [];

  const findings = [];
  const seen = new Set();

  if (doc.kind === 'json') {
    for (const item of doc.strings) {
      const fieldEntries = entries.filter(itemEntry => itemEntry.entry.path === item.path);
      checkDirectionInText(doc, item.value, item.path, item.line, fieldEntries, seen, findings);
    }
  } else {
    checkDirectionInText(doc, doc.text, 'document', null, entries, seen, findings);
  }

  return findings;
}

function inspect(text, field, line, doc, findings) {
  const match = NOT_BUT_RE.exec(String(text || ''));
  if (!match) return;
  findings.push(makeFinding('B16', doc, {
    field,
    line,
    quote: match[0],
    message: '禁用「不是……而是……」句式（B16）',
  }));
}

function check(ctx, doc) {
  const findings = [];
  if (doc.kind === 'json') {
    for (const item of doc.strings) {
      inspect(item.value, item.path, item.line, doc, findings);
    }
  } else {
    inspect(doc.text, 'document', null, doc, findings);
  }
  findings.push(...checkDirection(ctx, doc));
  return findings;
}

module.exports = {
  id: 'B16',
  applies: (ctx, doc) => ['insights', 'html', 'md'].includes(doc.role),
  check,
  NOT_BUT_RE,
  expectedDirection,
  isDirectionWord,
};
