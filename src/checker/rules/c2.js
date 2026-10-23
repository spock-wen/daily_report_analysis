'use strict';

const { normalize, splitSentences } = require('../text');
const { makeFinding } = require('./util');

const ANALYSIS_KEYS = ['useCases', 'trends', 'coreFunctions'];

function collectByProject(brief) {
  const groups = new Map();
  const projects = brief?.projects || [];

  projects.forEach((project, index) => {
    const analysis = project.analysis || {};
    for (const key of ANALYSIS_KEYS) {
      const values = Array.isArray(analysis[key]) ? analysis[key] : [];
      for (const value of values) {
        for (const sentence of splitSentences(value, () => null)) {
          const normalized = normalize(sentence.text);
          if (normalized.length < 12) continue;
          if (!groups.has(normalized)) {
            groups.set(normalized, { text: normalized, projects: new Set(), field: `projects[${index}].analysis.${key}` });
          }
          groups.get(normalized).projects.add(index);
        }
      }
    }
  });

  return groups;
}

function check(ctx, doc) {
  const findings = [];
  const brief = doc.role === 'brief' ? doc.json : ctx.brief;
  const groups = collectByProject(brief);

  for (const group of groups.values()) {
    if (group.projects.size < 2) continue;
    findings.push(makeFinding('C2', doc, {
      field: group.field,
      line: null,
      quote: group.text,
      message: `同一期内 ${group.projects.size} 个不同项目共用 12 字以上相同句子`,
    }));
  }

  return findings;
}

module.exports = {
  id: 'C2',
  applies: (ctx, doc) => doc.role === 'brief',
  check,
};
