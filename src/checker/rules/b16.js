'use strict';

const { splitSentenceUnits } = require('../text');
const { makeFinding } = require('./util');

// B16：禁用「不是……而是……」句式。
const NOT_BUT_RE = /不是[^。！？!?\n]{0,80}?而是/;

// B16：方向词必须与对应数值比较一致。
const DIRECTION_WORD_RE = /高于|低于|升温|上升|走高|上涨|增长|增加|提升|提速|放大|增强|降温|下降|走低|下滑|减少|回落|收缩|减弱|缩小|放缓|减速|持平|不变|企稳/g;
const UP_WORDS = new Set(['升温', '上升', '走高', '上涨', '增长', '增加', '提升', '提速', '放大', '增强']);
const DOWN_WORDS = new Set(['降温', '下降', '走低', '下滑', '减少', '回落', '收缩', '减弱', '缩小', '放缓', '减速']);
const FLAT_WORDS = new Set(['持平', '不变', '企稳']);
const RELATIONAL_WORDS = new Set(['高于', '低于']);
const NUMBER_RE = /(\d[\d,]*(?:\.\d+)?)/g;

function wordDirection(word) {
  if (UP_WORDS.has(word)) return 'up';
  if (DOWN_WORDS.has(word)) return 'down';
  if (FLAT_WORDS.has(word)) return 'flat';
  return null;
}

function factsList(ctx) {
  if (Array.isArray(ctx.facts)) return ctx.facts;
  if (Array.isArray(ctx.facts?.facts)) return ctx.facts.facts;
  return [];
}

function directionComparisons(ctx) {
  return factsList(ctx)
    .filter(fact => fact && fact.role === 'direction')
    .filter(fact => fact.current !== null && fact.current !== undefined
      && fact.reference !== null && fact.reference !== undefined)
    .map(fact => ({
      current: Number(fact.current),
      reference: Number(fact.reference),
      kind: fact.comparison?.kind || null,
      metric: fact.comparison?.metric || null,
    }))
    .filter(item => Number.isFinite(item.current) && Number.isFinite(item.reference));
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

function collectNumbers(text) {
  const values = [];
  let match;
  NUMBER_RE.lastIndex = 0;
  while ((match = NUMBER_RE.exec(String(text || ''))) !== null) {
    const value = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(value)) values.push({ value, index: match.index });
  }
  return values;
}

function hasValue(numbers, expected) {
  return numbers.some(item => Math.abs(item.value - expected) <= 0.01);
}

function matchesComparison(numbers, comparison) {
  return hasValue(numbers, comparison.current) && hasValue(numbers, comparison.reference);
}

function nearestBefore(numbers, index) {
  let found = null;
  for (const item of numbers) {
    if (item.index < index) found = item.value;
    else break;
  }
  return found;
}

function nearestAfter(numbers, index) {
  for (const item of numbers) {
    if (item.index > index) return item.value;
  }
  return null;
}

function nearestComparison(numbers, comparisons, index) {
  let best = null;
  let bestDistance = Infinity;
  for (const comparison of comparisons) {
    for (const item of numbers) {
      if (!hasValue([item], comparison.current) && !hasValue([item], comparison.reference)) continue;
      const distance = Math.abs(item.index - index);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = comparison;
      }
    }
  }
  return best;
}

function inspectDirectionUnit(unit, comparisons, onMismatch) {
  const numbers = collectNumbers(unit);
  const matchedComparisons = comparisons.filter(comparison => matchesComparison(numbers, comparison));

  DIRECTION_WORD_RE.lastIndex = 0;
  let match;
  while ((match = DIRECTION_WORD_RE.exec(unit)) !== null) {
    const word = match[0];
    if (RELATIONAL_WORDS.has(word)) {
      const before = nearestBefore(numbers, match.index);
      const after = nearestAfter(numbers, match.index);
      if (before === null || after === null) continue;
      const ok = word === '高于' ? before > after : before < after;
      if (!ok) onMismatch(word, null, unit);
      continue;
    }

    const actual = wordDirection(word);
    if (!actual) continue;
    // 方向词归属其最近的方向占位/对应比较；无法归属时判 FAIL。
    const comparison = nearestComparison(numbers, matchedComparisons, match.index);
    if (!comparison) {
      onMismatch(word, null, unit);
      continue;
    }
    const expected = expectedDirection(comparison);
    if (actual !== expected) {
      onMismatch(word, expected, unit, comparison);
    }
  }
}

function checkDirection(ctx, doc) {
  const comparisons = directionComparisons(ctx);
  if (comparisons.length === 0) return [];

  const findings = [];
  const inspect = (text, field, line) => {
    for (const unit of splitSentenceUnits(text)) {
      inspectDirectionUnit(unit, comparisons, (word, expected, quote, comparison) => {
        const detail = comparison
          ? `（今日 ${comparison.current} vs 参照 ${comparison.reference}，应为 ${directionLabel(expected)}）`
          : '';
        findings.push(makeFinding('B16', doc, {
          field,
          line,
          quote,
          message: `方向词「${word}」与数值比较不一致${detail}`,
        }));
      });
    }
  };

  if (doc.kind === 'json') {
    for (const item of doc.strings) inspect(item.value, item.path, item.line);
  } else {
    inspect(doc.text, 'document', null);
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
  directionComparisons,
  expectedDirection,
};
