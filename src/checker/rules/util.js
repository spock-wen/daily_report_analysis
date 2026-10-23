'use strict';

const { truncate } = require('../text');

function makeFinding(ruleId, doc, details = {}) {
  return {
    rule_id: ruleId,
    file: doc && doc.path ? doc.path : null,
    field: details.field || null,
    line: details.line === undefined ? null : details.line,
    quote: details.quote ? truncate(details.quote, 200) : '',
    message: details.message || '',
  };
}

function dedupeFindings(findings) {
  const seen = new Set();
  const results = [];
  for (const finding of findings) {
    const key = [finding.rule_id, finding.file, finding.field, finding.line, finding.quote].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(finding);
  }
  return results;
}

module.exports = {
  makeFinding,
  dedupeFindings,
};
