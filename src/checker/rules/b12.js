'use strict';

const { makeFinding } = require('./util');

// B12：一次生成只用一份抓取快照（记录 scrapedAt），成品日报页显示抓取时刻（UTC+8）。
const SCRAPED_AT_RE = /抓取(?:时刻|时间)\s*[：:]\s*\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?[\s\S]{0,20}?UTC\+0?8/;

function check(ctx, doc) {
  if (SCRAPED_AT_RE.test(doc.raw || '')) return [];
  return [makeFinding('B12', doc, {
    field: 'document',
    line: null,
    quote: '抓取时刻',
    message: '日报页面缺少快照抓取时刻（scrapedAt，UTC+8）',
  })];
}

module.exports = {
  id: 'B12',
  applies: (ctx, doc) => doc.kind === 'html' && ctx.level === 'daily',
  check,
  SCRAPED_AT_RE,
};
