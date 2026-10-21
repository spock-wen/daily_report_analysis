'use strict';

const { makeFinding } = require('./util');

// B17：日报项目卡简介必须含中文（卡片显示优先 oneSentence → descZh → description）。
const CHINESE_RE = /[\u4e00-\u9fa5]/;
const CARD_INTRO_CLASSES = new Set(['project-description', 'project-one-sentence']);
const DIV_RE = /<div\b([^>]*)>([\s\S]*?)<\/div>/g;
const CLASS_RE = /class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

function hasChinese(text) {
  return CHINESE_RE.test(String(text || ''));
}

function cardIntroText(project) {
  if (!project || typeof project !== 'object') return '';
  const analysis = project.analysis && typeof project.analysis === 'object' ? project.analysis : {};
  return String(
    analysis.oneSentence
    || project.oneSentence
    || project.descZh
    || project.desc
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

function checkBrief(ctx, doc, findings) {
  const projects = Array.isArray(doc.json?.projects) ? doc.json.projects : [];
  projects.forEach((project, index) => {
    const intro = cardIntroText(project);
    if (!intro || hasChinese(intro)) return;
    findings.push(makeFinding('B17', doc, {
      field: `projects[${index}].analysis.oneSentence`,
      line: typeof doc.findLine === 'function' ? doc.findLine(intro) : null,
      quote: intro,
      message: '日报项目卡简介不含中文字符，须先翻译英文描述（B17）',
    }));
  });
}

function checkHtml(ctx, doc, findings) {
  DIV_RE.lastIndex = 0;
  let match;
  while ((match = DIV_RE.exec(String(doc.raw || ''))) !== null) {
    const classMatch = CLASS_RE.exec(match[1] || '');
    const className = classMatch ? (classMatch[1] || classMatch[2] || classMatch[3] || '') : '';
    const classes = className.split(/\s+/).filter(Boolean);
    if (!classes.some(name => CARD_INTRO_CLASSES.has(name))) continue;

    const intro = stripTags(match[2]);
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
  if (doc.role === 'brief') checkBrief(ctx, doc, findings);
  else if (doc.role === 'html') checkHtml(ctx, doc, findings);
  return findings;
}

module.exports = {
  id: 'B17',
  applies: (ctx, doc) => ctx.level === 'daily' && (doc.role === 'brief' || doc.role === 'html'),
  check,
  hasChinese,
  cardIntroText,
};
