#!/usr/bin/env node
'use strict';

/**
 * buildArchive：最新周/月文件与上期同 href 时只保留一条。
 * 月报/周报读者链接同一口径：正式名缺失、仅 *.FAIL.html、或正文 FAIL 红条时不写 href。
 * 当周正式周报未发布时，回退到最近一篇已发布周报。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildArchive } = require('../../src/generator/daily-v3-view-model');

let total = 0;
let passed = 0;

function assert(condition, name) {
  total += 1;
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}`);
  }
}

function hrefCounts(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item.href, (map.get(item.href) || 0) + 1);
  }
  return map;
}

function writeHtml(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `<!doctype html><html><body>${body}</body></html>`);
}

function withOutDir(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-archive-'));
  const reports = path.join(root, 'reports');
  const prev = process.env.REPORT_OUT_DIR;
  process.env.REPORT_OUT_DIR = reports;
  try {
    return fn(reports);
  } finally {
    if (prev === undefined) delete process.env.REPORT_OUT_DIR;
    else process.env.REPORT_OUT_DIR = prev;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

console.log('\n' + '='.repeat(60));
console.log('  daily-v3 buildArchive href 去重');
console.log('='.repeat(60) + '\n');

withOutDir(reports => {
  writeHtml(path.join(reports, 'weekly/github-weekly-2026-W43.html'), 'W43 ok');
  writeHtml(path.join(reports, 'weekly/github-weekly-2026-W42.html'), 'W42 ok');
  writeHtml(path.join(reports, 'monthly/github-monthly-2026-09.FAIL.html'), '<div class="fail-banner">内容核查未通过（FAIL）</div>');
  writeHtml(path.join(reports, 'monthly/github-monthly-2026-08.html'), '2026-08 ok');
  writeHtml(path.join(reports, 'daily/github-ai-trending-2026-10-22.html'), 'daily ok');
  writeHtml(path.join(reports, 'daily/github-ai-trending-2026-10-21.html'), 'daily ok');

  const items = buildArchive({
    date: '2026-10-22',
    weekLabel: '2026-W43',
    priorDates: ['2026-10-21', '2026-10-20'],
  });
  const counts = hrefCounts(items);
  const week42 = '../weekly/github-weekly-2026-W42.html';
  const month09 = '../monthly/github-monthly-2026-09.html';
  const month08 = '../monthly/github-monthly-2026-08.html';

  assert(Array.isArray(items) && items.length > 0, '返回非空数组');
  assert((counts.get(week42) || 0) === 1, '2026-W42 周报 href 至多 1');
  assert((counts.get(month09) || 0) === 0, '2026-09 正式名不作为读者 href');
  assert((counts.get(month08) || 0) === 1, '上一可用正式月报 2026-08 仍可链');
  assert(items.some(item => item.label === '2026-09（下架）' && !item.href), '2026-09 降级为无 href 的下架项');
  assert([...counts.values()].every(n => n === 1), '全部 href 唯一');
});

withOutDir(reports => {
  writeHtml(path.join(reports, 'weekly/github-weekly-2026-W43.html'), 'W43 ok');
  writeHtml(path.join(reports, 'weekly/github-weekly-2026-W39.html'), 'W39 ok');
  writeHtml(path.join(reports, 'weekly/github-weekly-2026-W40.html'), 'W40 ok');
  writeHtml(path.join(reports, 'monthly/github-monthly-2026-08.html'), '2026-08 ok');
  writeHtml(path.join(reports, 'daily/github-ai-trending-2026-10-01.html'), 'daily ok');

  const distinct = buildArchive({
    date: '2026-10-01',
    weekLabel: '2026-W40',
    priorDates: [],
  });
  const dCounts = hrefCounts(distinct);
  const w43 = '../weekly/github-weekly-2026-W43.html';
  const w39 = '../weekly/github-weekly-2026-W39.html';
  assert((dCounts.get(w43) || 0) === 1, 'latest≠prev 时保留最新周 W43');
  assert((dCounts.get(w39) || 0) === 1, 'latest≠prev 时保留上期周 W39');
  assert((dCounts.get('../weekly/github-weekly-2026-W40.html') || 0) === 1, '当期已发布 W40 保留');
});

withOutDir(reports => {
  writeHtml(path.join(reports, 'weekly/github-weekly-2026-W46.html'), 'W46 ok');
  writeHtml(path.join(reports, 'weekly/github-weekly-2026-W42.FAIL.html'), '<div class="fail-banner">内容核查未通过（FAIL）</div>');
  writeHtml(path.join(reports, 'monthly/github-monthly-2026-10.html'), '2026-10 ok');
  writeHtml(path.join(reports, 'daily/github-ai-trending-2026-11-20.html'), 'daily ok');

  const unpublished = buildArchive({
    date: '2026-11-20',
    weekLabel: '2026-W47',
    priorDates: ['2026-11-19'],
  });
  const hrefs = unpublished.map(item => item.href);
  assert(hrefs.some(href => href === '../weekly/github-weekly-2026-W46.html'), '当周未发布时回退到最近已发布 W46');
  assert(!hrefs.some(href => href && href.includes('2026-W47')), '不链未发布的 W47');
  assert(!hrefs.some(href => href && href.includes('.FAIL')), '不链 FAIL 周报');
});

console.log(`\n结果：${passed}/${total} 通过\n`);
process.exit(passed === total ? 0 : 1);
