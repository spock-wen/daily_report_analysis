'use strict';

const { makeFinding } = require('./util');

function check(ctx, doc, config) {
  const findings = [];
  const words = (config.bannedWords || []).filter(Boolean);

  if (doc.kind === 'json') {
    for (const item of doc.strings) {
      for (const word of words) {
        if (!item.value.includes(word)) continue;
        findings.push(makeFinding('C3', doc, {
          field: item.path,
          line: item.line,
          quote: item.value,
          message: `命中禁词「${word}」`,
        }));
      }
    }
    return findings;
  }

  for (const word of words) {
    let index = 0;
    while (index < doc.raw.length) {
      const found = doc.raw.indexOf(word, index);
      if (found < 0) break;
      findings.push(makeFinding('C3', doc, {
        field: 'document',
        line: doc.lineAtOffset(found),
        quote: word,
        message: `命中禁词「${word}」`,
      }));
      index = found + word.length;
    }
  }

  return findings;
}

module.exports = {
  id: 'C3',
  applies: () => true,
  check,
};
