'use strict';

const { makeFinding } = require('./util');

// B16：禁用「不是……而是……」句式。
const NOT_BUT_RE = /不是[^。！？!?\n]{0,80}?而是/;

function inspect(text, field, line, doc, findings) {
  const match = NOT_BUT_RE.exec(String(text || ''));
  if (!match) return;
  findings.push(makeFinding('B16', doc, {
    field,
    line,
    quote: match[0],
    message: '禁用「不是……而是……」句式（B16）',
  }));
}

function check(ctx, doc) {
  const findings = [];
  if (doc.kind === 'json') {
    for (const item of doc.strings) {
      inspect(item.value, item.path, item.line, doc, findings);
    }
  } else {
    inspect(doc.text, 'document', null, doc, findings);
  }
  return findings;
}

module.exports = {
  id: 'B16',
  applies: (ctx, doc) => ['insights', 'html', 'md'].includes(doc.role),
  check,
  NOT_BUT_RE,
};
