'use strict';

const { extractRepoRefs } = require('../text');
const { makeFinding } = require('./util');

function check(ctx, doc, config) {
  const findings = [];
  const known = new Set();
  for (const name of ctx.allowedFullNames || ctx.fullNames || []) {
    known.add(String(name));
  }
  const commonWords = new Set((config.commonSlashWords || []).map(word => String(word).toLowerCase()));

  for (const item of doc.strings) {
    for (const ref of extractRepoRefs(item.value, { knownFullNames: known, commonWords })) {
      if (ref.known) continue;
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
  applies: (ctx, doc) => !ctx.r3 && doc.role === 'insights',
  check,
};
