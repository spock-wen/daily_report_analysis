'use strict';

const { makeFinding } = require('./util');

function check(ctx, doc, config) {
  const findings = [];
  const phrases = (config.fixedPhrases || []).filter(Boolean);

  if (doc.kind === 'json') {
    for (const item of doc.strings) {
      for (const phrase of phrases) {
        if (!item.value.includes(phrase)) continue;
        findings.push(makeFinding('C1', doc, {
          field: item.path,
          line: item.line,
          quote: item.value,
          message: `命中 C1 固定句「${phrase}」`,
        }));
      }
    }
    return findings;
  }

  for (const phrase of phrases) {
    let index = 0;
    while (index < doc.raw.length) {
      const found = doc.raw.indexOf(phrase, index);
      if (found < 0) break;
      findings.push(makeFinding('C1', doc, {
        field: 'document',
        line: doc.lineAtOffset(found),
        quote: phrase,
        message: `命中 C1 固定句「${phrase}」`,
      }));
      index = found + phrase.length;
    }
  }

  return findings;
}

module.exports = {
  id: 'C1',
  applies: () => true,
  check,
};
