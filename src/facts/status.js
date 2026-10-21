'use strict';

function statusWordFromTag(tag) {
  const text = String(tag === undefined || tag === null ? '' : tag).trim();
  if (!text) return null;
  if (text === '新' || text === '新上榜' || text === '首日') return '新上榜';
  if (text === '回归') return '回归';
  const match = /^连续\s*(\d+)\s*天$/.exec(text);
  if (match) return `连续 ${match[1]} 天`;
  return null;
}

module.exports = {
  statusWordFromTag,
};
