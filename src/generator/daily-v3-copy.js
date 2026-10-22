'use strict';

/**
 * 日报文案通用件（r10）
 *
 * 1. normalizeCjkSpacing：中英文/数字之间补空格（不覆盖原文里已有的空格）。
 * 2. loadProjectBlurbs / pickProjectBlurb：长期项目简介表 config/project-blurbs.json，
 *    按仓库全名命中，原样输出、不经 AI，优先于 AI 槽与缺省句。
 * 3. ratioPhrase：按比例区间选择口语化说法（约占四分之三 / 过半 / 约三分之二 …）。
 */

const fs = require('fs');
const nodePath = require('path');

const BLURBS_PATH = nodePath.join(__dirname, '..', '..', 'config', 'project-blurbs.json');

const CJK = '一-龥';
const CJK_PUNCT = '　-〿＀-￯';

// 中文（含中文标点）与英文/数字之间补一个空格；已有空格不重复添加。
function normalizeCjkSpacing(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  // 中文/中文标点 后接 英文或数字
  out = out.replace(new RegExp(`([${CJK}${CJK_PUNCT}])([A-Za-z0-9])`, 'g'), '$1 $2');
  // 英文或数字 后接 中文（不含中文标点，避免破坏「100%。」这类写法）
  out = out.replace(new RegExp(`([A-Za-z0-9])([${CJK}])`, 'g'), '$1 $2');
  return out;
}

let cachedBlurbs = null;

function loadProjectBlurbs() {
  if (cachedBlurbs) return cachedBlurbs;
  if (!fs.existsSync(BLURBS_PATH)) {
    cachedBlurbs = {};
    return cachedBlurbs;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(BLURBS_PATH, 'utf8'));
    cachedBlurbs = parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    cachedBlurbs = {};
  }
  return cachedBlurbs;
}

// 键为仓库全名（owner/repo），值与日期、星数无关，任何日期上榜都优先使用。
function pickProjectBlurb(fullName) {
  if (!fullName) return null;
  const table = loadProjectBlurbs();
  const entry = table[String(fullName)] || table[String(fullName).toLowerCase()];
  if (!entry || typeof entry !== 'object') return null;
  return entry;
}

// 比例 → 口语化区间说法。ratio 为 0..1。
function ratioPhrase(ratio) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '占比待定';
  if (ratio >= 0.95) return '几乎全部';
  if (ratio >= 0.85) return '占九成以上';
  if (ratio >= 0.7) return '约占四分之三';
  if (ratio >= 0.6) return '约三分之二';
  if (ratio > 0.5) return '过半';
  if (ratio >= 0.4) return '约占四成';
  return '不足一半';
}

module.exports = {
  normalizeCjkSpacing,
  loadProjectBlurbs,
  pickProjectBlurb,
  ratioPhrase,
};
