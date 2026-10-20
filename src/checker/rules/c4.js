'use strict';

const { normalize, longestCommonSubstring } = require('../text');
const { makeFinding } = require('./util');

function stripWhitelist(text, whitelist) {
  let result = normalize(text);
  const phrases = whitelist.map(item => normalize(item)).filter(Boolean);
  for (const phrase of phrases) {
    if (!phrase) continue;
    result = result.split(phrase).join('');
  }
  return result;
}

function check(ctx, doc, config) {
  const findings = [];
  const current = doc.json?.oneLiner;
  if (!current) return findings;

  const node = doc.getNode ? doc.getNode('oneLiner') : null;
  const line = node ? node.line : null;
  const currentText = stripWhitelist(current, config.c4Whitelist || []);

  for (const previous of ctx.getPreviousDailyInsights(ctx.period, 2)) {
    if (!previous.insights?.oneLiner) continue;
    const previousText = stripWhitelist(previous.insights.oneLiner, config.c4Whitelist || []);
    const common = longestCommonSubstring(currentText, previousText);
    if (common.length < 4) continue;
    findings.push(makeFinding('C4', doc, {
      field: 'oneLiner',
      line,
      quote: current,
      message: `与 ${previous.date} oneLiner 共用 ${common.length} 字短语「${common}」`,
    }));
  }

  return findings;
}

module.exports = {
  id: 'C4',
  applies: (ctx, doc) => ctx.level === 'daily' && doc.role === 'insights',
  check,
};
