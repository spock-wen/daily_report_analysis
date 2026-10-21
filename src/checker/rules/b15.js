'use strict';

const { makeFinding } = require('./util');

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsTerm(text, term) {
  if (!term) return false;
  const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, 'i');
  return pattern.test(String(text || ''));
}

function check(ctx, doc, config) {
  const findings = [];
  const words = config.spellingWords || [];

  const inspect = (text, field, line) => {
    for (const item of words) {
      if (!containsTerm(text, item.wrong)) continue;
      findings.push(makeFinding('B15', doc, {
        field,
        line,
        quote: item.wrong,
        message: `拼写错误「${item.wrong}」应为「${item.right}」`,
      }));
    }
  };

  if (doc.kind === 'json') {
    for (const item of doc.strings) inspect(item.value, item.path, item.line);
  } else {
    inspect(doc.text, 'document', null);
  }

  return findings;
}

module.exports = {
  id: 'B15',
  applies: (ctx, doc) => ['insights', 'html', 'md'].includes(doc.role),
  check,
  containsTerm,
};
