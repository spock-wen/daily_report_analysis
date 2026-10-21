'use strict';

const { makeFinding } = require('./util');

const FACT_PLACEHOLDER_RE = /\{\{f[^{}]*\}\}/g;
const PROJECT_PLACEHOLDER_RE = /\{\{p:[^{}]*\}\}/g;
const NUMBER_RE = /\d[\d,]*(?:\.\d+)?(?:亿|万|千|[kKwW])?/g;

const WHITELIST_PATTERNS = [
  /\d{4}-\d{2}-\d{2}/g,
  /\d{4}年\d{1,2}月\d{1,2}日/g,
  /\d{1,2}月\d{1,2}日/g,
  /\d{4}-W\d{2}/g,
  /\d{4}-\d{2}/g,
  /第\s*\d+/g,
  /Top\s*\d+/gi,
  /#\s*\d+/g,
  /(?:^|[\s（(【：:，,；;。])\d{1,3}\.(?=\s|$|[^\d])/gm,
];

function normalizeNumberText(text) {
  return String(text === undefined || text === null ? '' : text)
    .replace(/[,\s]/g, '')
    .replace(/^\+/, '');
}

function maskWhitelist(text) {
  let masked = String(text || '');
  for (const pattern of WHITELIST_PATTERNS) {
    masked = masked.replace(pattern, match => ' '.repeat(match.length));
  }
  return masked;
}

function extractNumbers(text) {
  const results = [];
  let match;
  NUMBER_RE.lastIndex = 0;
  while ((match = NUMBER_RE.exec(maskWhitelist(text))) !== null) {
    results.push(match[0]);
  }
  return results;
}

function entriesForPath(ctx, fieldPath) {
  const entries = ctx.renderMap?.entries || [];
  return entries.filter(entry => String(entry?.path || '') === String(fieldPath || ''));
}

function missingNumbers(numbers, entries) {
  const counts = new Map();
  for (const entry of entries) {
    const text = normalizeNumberText(entry?.text);
    if (!text || !/[0-9]/.test(text)) continue;
    counts.set(text, (counts.get(text) || 0) + 1);
  }

  const missing = [];
  for (const number of numbers) {
    const text = normalizeNumberText(number);
    const count = counts.get(text) || 0;
    if (count > 0) {
      counts.set(text, count - 1);
    } else {
      missing.push(number);
    }
  }
  return missing;
}

function collectPlaceholders(value, pattern) {
  const found = String(value || '').match(pattern) || [];
  return Array.from(new Set(found));
}

function checkInsights(ctx, doc) {
  const findings = [];

  for (const item of doc.strings) {
    const placeholders = collectPlaceholders(item.value, FACT_PLACEHOLDER_RE);
    for (const placeholder of placeholders) {
      findings.push(makeFinding('B4', doc, {
        field: item.path,
        line: item.line,
        quote: item.value,
        message: `事实占位 ${placeholder} 未渲染（占位 id 不存在）`,
      }));
    }

    const withoutPlaceholders = String(item.value)
      .replace(FACT_PLACEHOLDER_RE, match => ' '.repeat(match.length))
      .replace(PROJECT_PLACEHOLDER_RE, match => ' '.repeat(match.length));
    const numbers = extractNumbers(withoutPlaceholders);
    if (numbers.length === 0) continue;
    const missing = missingNumbers(numbers, entriesForPath(ctx, item.path));
    for (const number of missing) {
      findings.push(makeFinding('B4', doc, {
        field: item.path,
        line: item.line,
        quote: item.value,
        message: `数字「${number}」没有对应的渲染记录（同字段路径、同文本）`,
      }));
    }
  }

  return findings;
}

function checkHtml(ctx, doc) {
  const findings = [];
  const text = doc.text || '';

  for (const placeholder of collectPlaceholders(text, FACT_PLACEHOLDER_RE)) {
    findings.push(makeFinding('B4', doc, {
      field: 'document',
      line: doc.findLine ? doc.findLine(placeholder) : null,
      quote: placeholder,
      message: `事实占位 ${placeholder} 未渲染（占位 id 不存在）`,
    }));
  }

  const withoutPlaceholders = text
    .replace(FACT_PLACEHOLDER_RE, match => ' '.repeat(match.length))
    .replace(PROJECT_PLACEHOLDER_RE, match => ' '.repeat(match.length));
  const numbers = extractNumbers(withoutPlaceholders);
  const missing = missingNumbers(numbers, ctx.renderMap?.entries || []);
  for (const number of new Set(missing)) {
    findings.push(makeFinding('B4', doc, {
      field: 'document',
      line: null,
      quote: number,
      message: `数字「${number}」没有对应的渲染记录`,
    }));
  }

  return findings;
}

function check(ctx, doc) {
  if (doc.kind === 'html') return checkHtml(ctx, doc);
  return checkInsights(ctx, doc);
}

module.exports = {
  id: 'B4',
  applies: (ctx, doc) => ctx.r3 && (doc.role === 'insights' || doc.role === 'html'),
  check,
  maskWhitelist,
  extractNumbers,
  missingNumbers,
  normalizeNumberText,
};
