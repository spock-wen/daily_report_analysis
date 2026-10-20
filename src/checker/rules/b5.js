'use strict';

const { makeFinding } = require('./util');

const WATCH_PATH_RE = /^(?:recommendations\.[A-Za-z_]+\[[0-9]+\]|trends\.shortTerm\[[0-9]+\]|nextWeek\[[0-9]+\]|nextWeekPoints\[[0-9]+\])$/;

function check(ctx, doc, config) {
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

module.exports = {
  id: 'B5',
  applies: (ctx, doc) => ctx.level === 'weekly' && doc.role === 'insights',
  check,
};
