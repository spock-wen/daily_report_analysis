'use strict';

const { extractRepoRefs } = require('../text');
const { makeFinding } = require('./util');

function check(ctx, doc) {
  const findings = [];
  const known = ctx.fullNames;

  for (const item of doc.strings) {
    for (const ref of extractRepoRefs(item.value)) {
      if (known.has(ref.raw)) continue;
      findings.push(makeFinding('D2', doc, {
        field: item.path,
        line: item.line,
        quote: ref.raw,
        message: `洞察中的项目名 ${ref.raw} 不在当期 data 的 fullName 中`,
      }));
    }
  }

  return findings;
}

module.exports = {
  id: 'D2',
  alias: 'NAME',
  applies: (ctx, doc) => doc.role === 'insights',
  check,
};
