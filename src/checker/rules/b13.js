'use strict';

const fs = require('fs');
const path = require('path');
const { makeFinding } = require('./util');

// B13：HTML 中所有相对引用（href/src）的静态资源必须存在于输出目录。
const RESOURCE_TAGS = new Set(['link', 'script', 'img', 'source', 'video', 'audio', 'iframe', 'embed', 'object']);
const REF_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?\s(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
const EXTERNAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i;

function collectRefs(raw) {
  const refs = [];
  REF_RE.lastIndex = 0;
  let match;
  while ((match = REF_RE.exec(String(raw || ''))) !== null) {
    if (!RESOURCE_TAGS.has(String(match[1] || '').toLowerCase())) continue;
    const ref = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4];
    if (ref) refs.push(ref.trim());
  }
  return refs;
}

function resolveRef(doc, ref) {
  if (!ref || EXTERNAL_RE.test(ref)) return null;
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return null;
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch (error) {
    decoded = clean;
  }
  return path.resolve(path.dirname(doc.path), decoded);
}

function check(ctx, doc) {
  const findings = [];
  const seen = new Set();
  for (const ref of collectRefs(doc.raw)) {
    const target = resolveRef(doc, ref);
    if (!target || seen.has(target)) continue;
    seen.add(target);
    if (fs.existsSync(target)) continue;
    findings.push(makeFinding('B13', doc, {
      field: 'document',
      line: doc.findLine ? doc.findLine(ref) : null,
      quote: ref,
      message: `相对引用资源不存在：${ref}`,
    }));
  }
  return findings;
}

module.exports = {
  id: 'B13',
  applies: (ctx, doc) => doc.kind === 'html',
  check,
  collectRefs,
  resolveRef,
};
