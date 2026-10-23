'use strict';

const { normalize, longestCommonSubstring, escapeRegExp } = require('../text');
const { makeFinding } = require('./util');

const NAME_KEY_RE = /^(fullName|project_name|projectName|repo|name)$/;
const CJK_ONLY_RE = /[^\u3400-\u9fff]+/g;
const SEPARATOR = '\u0000';

function addName(set, value) {
  if (typeof value !== 'string') return;
  const name = value.trim();
  if (!name) return;
  set.add(name);
  if (name.includes('/')) {
    const short = name.split('/').filter(Boolean).pop();
    if (short) set.add(short);
  }
}

function collectNames(value, out) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectNames(item, out);
    return;
  }
  if (typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && NAME_KEY_RE.test(key)) addName(out, child);
    else collectNames(child, out);
  }
}

function buildExclusions(ctx, config) {
  const names = new Set();
  for (const word of config.c4Whitelist || []) addName(names, word);
  for (const project of ctx.projects || []) {
    addName(names, project.fullName);
    addName(names, project.name);
  }
  for (const previous of ctx.getPreviousDailyInsights(ctx.period, 2)) {
    collectNames(previous.insights, names);
    const brief = ctx.readDailyBrief ? ctx.readDailyBrief(previous.date) : null;
    collectNames(brief?.projects, names);
  }
  return Array.from(names).filter(Boolean);
}

function prepareText(text, exclusions) {
  let result = normalize(text);
  const phrases = exclusions
    .map(item => normalize(item))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  for (const phrase of phrases) {
    result = result.replace(new RegExp(escapeRegExp(phrase), 'gi'), SEPARATOR);
  }
  return result.replace(CJK_ONLY_RE, SEPARATOR);
}

function visibleLength(text) {
  return text.split(SEPARATOR).join('').length;
}

function check(ctx, doc, config) {
  const findings = [];
  const current = doc.json?.oneLiner;
  if (!current) return findings;

  const node = doc.getNode ? doc.getNode('oneLiner') : null;
  const line = node ? node.line : null;
  const exclusions = buildExclusions(ctx, config);
  const currentText = prepareText(current, exclusions);

  for (const previous of ctx.getPreviousDailyInsights(ctx.period, 2)) {
    if (!previous.insights?.oneLiner) continue;
    const previousText = prepareText(previous.insights.oneLiner, exclusions);
    const common = longestCommonSubstring(currentText, previousText);
    const length = visibleLength(common);
    if (length < 4) continue;
    findings.push(makeFinding('C4', doc, {
      field: 'oneLiner',
      line,
      quote: current,
      message: `与 ${previous.date} oneLiner 共用 ${length} 字短语「${common.split(SEPARATOR).join('')}」`,
    }));
  }

  return findings;
}

module.exports = {
  id: 'C4',
  applies: (ctx, doc) => ctx.level === 'daily' && doc.role === 'insights',
  check,
};
