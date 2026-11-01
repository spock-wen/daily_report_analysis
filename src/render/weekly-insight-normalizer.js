'use strict';

const { findSlotAssignments } = require('../facts/roles');
const { maskWhitelist, normalizeNumberText } = require('../checker/rules/r4-binding');

const NUMBER_RE = /\d[\d,]*(?:\.\d+)?(?:亿|万|千|[kKwW])?/g;
const PLACEHOLDER_RE = /\{\{[^{}]+\}\}/g;
const CLAUSE_SEP_RE = /[，,、；;。\n\r]/;
const REPO_EDGE_RE = /[A-Za-z0-9_./-]/;
// 与 B16 同一句式。这里改写文案，规则本身不放宽。
const NOT_BUT_RE = /不是([^。！？!?\n]{0,80}?)而是/g;
const SHORT_DATE_RE = /(?<!\d-)(?<!\d)(\d{1,2})-(\d{1,2})(?!\d)/g;
const WAN_RE = /(?<![\d.])\d+(?:\.\d+)?\s*万(\s*星以上)?/g;

function clauseRange(text, position) {
  const source = String(text || '');
  let start = 0;
  for (let index = position - 1; index >= 0; index -= 1) {
    if (CLAUSE_SEP_RE.test(source[index])) {
      start = index + 1;
      break;
    }
  }
  let end = source.length;
  for (let index = position; index < source.length; index += 1) {
    if (CLAUSE_SEP_RE.test(source[index])) {
      end = index;
      break;
    }
  }
  return { start, end };
}

function maskPlaceholders(text) {
  return String(text || '').replace(PLACEHOLDER_RE, match => ' '.repeat(match.length));
}

function unboundNumberSpans(text) {
  const masked = maskWhitelist(maskPlaceholders(text));
  const spans = [];
  NUMBER_RE.lastIndex = 0;
  let match;
  while ((match = NUMBER_RE.exec(masked)) !== null) {
    spans.push({ index: match.index, raw: match[0] });
  }
  return spans;
}

function rewriteBannedContrast(text) {
  return String(text || '').replace(NOT_BUT_RE, (_full, inner) => {
    const body = String(inner || '').replace(/[，,、]\s*$/, '');
    return `并非${body}，实际是`;
  });
}

function rewriteShortDates(text) {
  return String(text || '').replace(SHORT_DATE_RE, (full, month, day) => {
    const monthNumber = Number(month);
    const dayNumber = Number(day);
    if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) return full;
    return `${monthNumber}月${dayNumber}日`;
  });
}

function rewriteWanApproximation(text) {
  return String(text || '').replace(WAN_RE, (_full, suffix) => (suffix ? '万星以上' : '万'));
}

function bareProjectName(value) {
  const text = String(value || '').trim();
  const wrapped = /^\{\{p:([^{}]+)\}\}$/.exec(text);
  return wrapped ? wrapped[1].trim() : text;
}

function wrapProjectNames(text, projects) {
  const names = Array.from(new Set((projects || []).filter(name => typeof name === 'string' && name.includes('/'))))
    .sort((left, right) => right.length - left.length);
  const source = String(text || '');
  if (!source || names.length === 0) return source;

  const spans = [];
  PLACEHOLDER_RE.lastIndex = 0;
  let placeholder;
  while ((placeholder = PLACEHOLDER_RE.exec(source)) !== null) {
    spans.push([placeholder.index, placeholder.index + placeholder[0].length]);
  }
  const spanAt = index => spans.find(([start, end]) => index >= start && index < end);

  let out = '';
  let index = 0;
  while (index < source.length) {
    const span = spanAt(index);
    if (span) {
      out += source.slice(span[0], span[1]);
      index = span[1];
      continue;
    }
    let matched = null;
    for (const name of names) {
      if (!source.startsWith(name, index)) continue;
      const before = index > 0 ? source[index - 1] : '';
      const after = source[index + name.length] || '';
      if ((before && REPO_EDGE_RE.test(before)) || (after && REPO_EDGE_RE.test(after))) continue;
      matched = name;
      break;
    }
    if (matched) {
      out += `{{p:${matched}}}`;
      index += matched.length;
    } else {
      out += source[index];
      index += 1;
    }
  }
  return out;
}

function projectsInClause(clause, projects, siblingProject) {
  const found = [];
  const names = Array.from(new Set(projects || [])).sort((left, right) => right.length - left.length);
  for (const name of names) {
    if (name && clause.includes(name)) found.push(name);
  }
  const wrapped = /\{\{p:([^{}]+)\}\}/g;
  let match;
  while ((match = wrapped.exec(clause)) !== null) found.push(match[1].trim());
  if (siblingProject && !found.includes(siblingProject)) found.push(siblingProject);
  return Array.from(new Set(found));
}

function placeholderFor(fact) {
  const id = String(fact.id).replace(/^f/, '');
  return fact.role ? `{{f${id}:${fact.role}}}` : `{{f${id}}}`;
}

function pickFact(text, span, allowed, facts, projects, siblingProject) {
  const range = clauseRange(text, span.index);
  const clause = text.slice(range.start, range.end);
  const mentioned = projectsInClause(clause, projects, siblingProject);
  const key = normalizeNumberText(span.raw);
  const pool = (facts || []).filter(fact => {
    if (!fact || normalizeNumberText(fact.value) !== key) return false;
    if (fact.project && !mentioned.includes(fact.project)) return false;
    return true;
  });
  if (allowed && allowed.length > 0) {
    const slotted = pool.filter(fact => fact.role && allowed.includes(fact.role));
    return slotted.length === 1 ? slotted[0] : null;
  }
  // 渲染后的正文会丢掉占位。没有语义槽时，只有事实值唯一才绑回去。
  return pool.length === 1 ? pool[0] : null;
}

function bindBareNumbers(text, facts, projects, siblingProject) {
  const spans = unboundNumberSpans(text);
  if (spans.length === 0) return text;
  const assignments = findSlotAssignments(text, spans.map(span => span.index));
  let out = text;
  for (const span of spans.slice().reverse()) {
    const allowed = assignments.get(span.index) || null;
    const fact = pickFact(out, span, allowed, facts, projects, siblingProject);
    if (!fact) continue;
    let start = span.index;
    const previous = start > 0 ? out[start - 1] : '';
    if ((previous === '-' || previous === '−' || previous === '+') && /^[+\-−]/.test(String(fact.value))) {
      start -= 1;
    }
    out = `${out.slice(0, start)}${placeholderFor(fact)}${out.slice(span.index + span.raw.length)}`;
  }
  return out;
}

function stripUnboundDigits(text) {
  const masked = maskWhitelist(maskPlaceholders(text));
  let out = '';
  for (let index = 0; index < text.length; index += 1) {
    if (/\d/.test(masked[index])) continue;
    out += text[index];
  }
  return out
    .replace(/连续\s*天/g, '连续多日')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([，。；、）)])/g, '$1')
    .replace(/（\s*）/g, '');
}

function normalizeString(text, options) {
  const facts = options.facts || [];
  const projects = options.projects || [];
  let out = rewriteBannedContrast(text);
  out = rewriteShortDates(out);
  out = rewriteWanApproximation(out);
  out = wrapProjectNames(out, projects);
  out = bindBareNumbers(out, facts, projects, options.siblingProject || null);
  if (options.stripDigits) out = stripUnboundDigits(out);
  return out;
}

function normalizeWeeklyInsights(insights, options = {}) {
  const facts = Array.isArray(options.facts) ? options.facts : [];
  const projects = options.projects || [];

  const walk = (value, path) => {
    if (typeof value === 'string') {
      return normalizeString(value, {
        facts,
        projects,
        stripDigits: path.startsWith('deepTrends'),
      });
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => walk(item, `${path}[${index}]`));
    }
    if (value && typeof value === 'object') {
      if (/^deepTrends\.evidence\[\d+\]$/.test(path)) {
        const sibling = projectsInClause(String(value.name || ''), projects)[0] || bareProjectName(value.name);
        const result = {};
        for (const [key, item] of Object.entries(value)) {
          if (typeof item !== 'string') {
            result[key] = walk(item, `${path}.${key}`);
            continue;
          }
          result[key] = normalizeString(item, {
            facts,
            projects,
            siblingProject: key === 'reason' ? sibling : null,
            stripDigits: key !== 'name',
          });
        }
        return result;
      }
      const result = {};
      for (const [key, item] of Object.entries(value)) {
        result[key] = walk(item, path ? `${path}.${key}` : key);
      }
      return result;
    }
    return value;
  };

  return walk(insights, '');
}

module.exports = {
  normalizeWeeklyInsights,
  rewriteBannedContrast,
  rewriteShortDates,
  rewriteWanApproximation,
  wrapProjectNames,
};
