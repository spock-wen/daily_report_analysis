'use strict';

const { makeFinding } = require('./util');

function check(ctx, doc) {
  const findings = [];
  const top3 = ctx.metrics?.dailyTop3 || [];
  const text = doc.text || '';

  for (const fullName of top3) {
    if (text.includes(fullName)) continue;
    findings.push(makeFinding('B3', doc, {
      field: `missing_fullNames: ${fullName}`,
      line: null,
      quote: `missing_fullName: ${fullName}`,
      message: `日报出现天数前 3 的 ${fullName} 未在周报正文出现，也未写明原因`,
    }));
  }

  return findings;
}

module.exports = {
  id: 'B3',
  applies: (ctx, doc) => ctx.level === 'weekly' && ['insights', 'html', 'md'].includes(doc.role),
  check,
};
