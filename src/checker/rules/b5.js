'use strict';

const { makeFinding } = require('./util');

const WATCH_PATH_RE = /^(?:trends\.shortTerm\[[0-9]+\]|nextWeek\[[0-9]+\]|nextWeekPoints\[[0-9]+\])$/;
const PROJECT_PLACEHOLDER_RE = /\{\{p:[^{}]*\}\}/g;
const REPO_REF_RE = /(?:^|[^A-Za-z0-9_./-])([A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*)/g;

function checkLegacy(ctx, doc, config) {
  const findings = [];
  const compareWords = (config.compareWords || []).filter(Boolean);

  for (const item of doc.strings) {
    if (!WATCH_PATH_RE.test(item.path || '')) continue;
    const text = item.value || '';
    const hasNumber = /[0-9]/.test(text);
    const hasCompareWord = compareWords.some(word => text.includes(word));

    if (hasNumber && hasCompareWord) continue;
    const missing = [];
    if (!hasNumber) missing.push('数字');
    if (!hasCompareWord) missing.push('比较词');
    findings.push(makeFinding('B5', doc, {
      field: item.path,
      line: item.line,
      quote: text,
      message: `看点缺少${missing.join('与')}（J11 比较词表）`,
    }));
  }

  return findings;
}

function projectEntries(ctx, fieldPath) {
  const entries = ctx.renderMap?.entries || [];
  return entries.filter(entry => {
    if (fieldPath !== null && String(entry?.path || '') !== String(fieldPath || '')) return false;
    return /^\{\{p:[^{}]+\}\}$/.test(String(entry?.placeholder || '').trim());
  });
}

function missingRefs(refs, entries) {
  const counts = new Map();
  for (const entry of entries) {
    const text = String(entry?.text || '').trim();
    if (!text) continue;
    counts.set(text, (counts.get(text) || 0) + 1);
  }

  const missing = [];
  for (const ref of refs) {
    const count = counts.get(ref) || 0;
    if (count > 0) {
      counts.set(ref, count - 1);
    } else {
      missing.push(ref);
    }
  }
  return missing;
}

function extractRefs(text) {
  const refs = [];
  const source = String(text || '').replace(PROJECT_PLACEHOLDER_RE, match => ' '.repeat(match.length));
  let match;
  REPO_REF_RE.lastIndex = 0;
  while ((match = REPO_REF_RE.exec(source)) !== null) {
    const raw = match[1].replace(/[.,;:!?)]+$/, '');
    if (!/[A-Za-z]/.test(raw)) continue;
    const owner = raw.split('/')[0];
    if (owner.includes('.')) continue;
    refs.push(raw);
  }
  return refs;
}

function collectPlaceholders(value) {
  return Array.from(new Set(String(value || '').match(PROJECT_PLACEHOLDER_RE) || []));
}

function checkInsights(ctx, doc) {
  const findings = [];

  for (const item of doc.strings) {
    for (const placeholder of collectPlaceholders(item.value)) {
      findings.push(makeFinding('B5', doc, {
        field: item.path,
        line: item.line,
        quote: item.value,
        message: `仓库占位 ${placeholder} 未渲染（p: 不在当期项目清单）`,
      }));
    }

    const refs = extractRefs(item.value);
    if (refs.length === 0) continue;
    const missing = missingRefs(refs, projectEntries(ctx, item.path));
    for (const ref of missing) {
      findings.push(makeFinding('B5', doc, {
        field: item.path,
        line: item.line,
        quote: item.value,
        message: `仓库名 ${ref} 没有对应的 p: 渲染记录`,
      }));
    }
  }

  return findings;
}

function checkHtml(ctx, doc) {
  const findings = [];
  const text = doc.text || '';

  for (const placeholder of collectPlaceholders(text)) {
    findings.push(makeFinding('B5', doc, {
      field: 'document',
      line: doc.findLine ? doc.findLine(placeholder) : null,
      quote: placeholder,
      message: `仓库占位 ${placeholder} 未渲染（p: 不在当期项目清单）`,
    }));
  }

  const refs = extractRefs(text);
  const missing = missingRefs(refs, projectEntries(ctx, null));
  for (const ref of new Set(missing)) {
    findings.push(makeFinding('B5', doc, {
      field: 'document',
      line: null,
      quote: ref,
      message: `仓库名 ${ref} 没有对应的 p: 渲染记录`,
    }));
  }

  return findings;
}

function check(ctx, doc, config) {
  if (!ctx.r3) return checkLegacy(ctx, doc, config);

  const findings = [];
  if (doc.kind === 'json' && ctx.level === 'weekly' && doc.role === 'insights') {
    findings.push(...checkLegacy(ctx, doc, config));
  }
  if (doc.kind === 'html') {
    findings.push(...checkHtml(ctx, doc));
  } else {
    findings.push(...checkInsights(ctx, doc));
  }
  return findings;
}

module.exports = {
  id: 'B5',
  applies: (ctx, doc) => (ctx.r3
    ? (doc.role === 'insights' || doc.role === 'html')
    : (ctx.level === 'weekly' && doc.role === 'insights')),
  check,
  extractRefs,
};
