'use strict';

const { makeFinding } = require('./util');

const STATUS_PATTERNS = [
  { pattern: /新上榜|首次上榜|首日/, tag: '新', label: '新上榜/首日' },
  { pattern: /回归/, tag: '回归', label: '回归' },
  { pattern: /连续(?:\s*\d+\s*[天日]|上榜)/, tag: '连续', label: '连续 N 天' },
];

function tagMatches(tag, expected) {
  if (!tag) return true;
  if (expected === '连续') return tag.startsWith('连续');
  return tag === expected;
}

function buildTagMap(ctx) {
  const map = new Map();
  for (const project of ctx.brief?.projects || []) {
    const name = project.fullName || project.repo || project.name;
    if (name && project.tag) map.set(String(name), String(project.tag));
  }
  return map;
}

function normalizeName(value) {
  const text = String(value || '').trim();
  const placeholder = /^\{\{p:([^{}]+)\}\}$/.exec(text);
  return placeholder ? placeholder[1].trim() : text;
}

function subjectFor(item, doc, tags) {
  const indexed = /^project_insights\[(\d+)\]/.exec(item.path || '');
  if (indexed) {
    const list = doc.json?.project_insights;
    const project = Array.isArray(list) ? list[Number(indexed[1])] : null;
    if (project && project.project_name) return normalizeName(project.project_name);
  }

  const matches = Array.from(tags.keys()).filter(name => String(item.value).includes(name));
  return matches.length === 1 ? matches[0] : null;
}

function check(ctx, doc) {
  const findings = [];
  const tags = buildTagMap(ctx);
  if (tags.size === 0) return findings;

  for (const item of doc.strings) {
    const subject = subjectFor(item, doc, tags);
    if (!subject || !tags.has(subject)) continue;
    const tag = tags.get(subject);
    for (const status of STATUS_PATTERNS) {
      if (!status.pattern.test(item.value)) continue;
      if (tagMatches(tag, status.tag)) continue;
      findings.push(makeFinding('B11', doc, {
        field: item.path,
        line: item.line,
        quote: item.value,
        message: `文字写「${status.label}」，但该项目卡片标签为「${tag}」`,
      }));
    }
  }

  return findings;
}

module.exports = {
  id: 'B11',
  applies: (ctx, doc) => ctx.level === 'daily' && doc.role === 'insights',
  check,
};
