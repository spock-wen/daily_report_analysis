'use strict';

const { makeFinding } = require('./util');

// B17：只查渲染后的项目卡文本（HTML 中显示的一句话与简介），不扫 brief 的英文源字段。
const CHINESE_RE = /[\u4e00-\u9fa5]/;
const CARD_INTRO_CLASSES = new Set(['project-description', 'project-one-sentence', 'one', 'desc']);
const TAG_RE = /<(\/?)([a-z0-9]+)\b([^>]*)>/gi;
const CLASS_RE = /class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

function hasChinese(text) {
  return CHINESE_RE.test(String(text || ''));
}

function cardIntroText(project) {
  if (!project || typeof project !== 'object') return '';
  const analysis = project.analysis && typeof project.analysis === 'object' ? project.analysis : {};
  return String(
    project.descZh
    || analysis.descZh
    || project.oneSentence
    || analysis.oneSentence
    || project.description
    || ''
  ).trim();
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function classNameOf(attrs) {
  const match = CLASS_RE.exec(attrs || '');
  return match ? (match[1] || match[2] || match[3] || '') : '';
}

function cardBlocks(html) {
  const blocks = [];
  TAG_RE.lastIndex = 0;
  let open = null;
  let match;
  while ((match = TAG_RE.exec(String(html || ''))) !== null) {
    const closing = match[1] === '/';
    const tag = String(match[2] || '').toLowerCase();
    if (open) {
      if (tag === open.tag) open.depth += closing ? -1 : 1;
      if (open.depth === 0) {
        blocks.push(String(html).slice(open.start, match.index));
        open = null;
      }
      continue;
    }
    if (closing) continue;
    const classes = classNameOf(match[3]).split(/\s+/).filter(Boolean);
    if (!classes.some(name => CARD_INTRO_CLASSES.has(name))) continue;
    open = { tag, depth: 1, start: TAG_RE.lastIndex };
  }
  return blocks;
}

function checkHtml(ctx, doc, findings) {
  for (const block of cardBlocks(doc.raw)) {
    const intro = stripTags(block);
    if (!intro || hasChinese(intro)) continue;
    findings.push(makeFinding('B17', doc, {
      field: 'document',
      line: typeof doc.findLine === 'function' ? doc.findLine(intro) : null,
      quote: intro,
      message: '日报 HTML 项目卡简介不含中文字符（B17）',
    }));
  }
}

function check(ctx, doc) {
  if (ctx.level !== 'daily') return [];
  const findings = [];
  if (doc.role === 'html') checkHtml(ctx, doc, findings);
  return findings;
}

module.exports = {
  id: 'B17',
  applies: (ctx, doc) => ctx.level === 'daily' && doc.role === 'html',
  check,
  hasChinese,
  cardIntroText,
};
