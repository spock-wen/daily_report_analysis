#!/usr/bin/env node
'use strict';

/**
 * buildArchive：最新周/月文件与上期同 href 时只保留一条。
 * 月报读者链接与首页同一口径：正式名缺失、仅 *.FAIL.html、或正文 FAIL 红条时不写 href。
 * 夹具对齐现网：date=2026-10-22 / weekLabel=2026-W43 时，
 * 上期周=W42；2026-09 只有 *.FAIL.html，上一可用正式月报是 2026-08。
 * 更早 weekLabel=W40 时，上期周=W39，与目录最新周报不是同一条。
 */

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

console.log('\n' + '='.repeat(60));
console.log('  daily-v3 buildArchive href 去重');
console.log('='.repeat(60) + '\n');

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

// 不同上期必须留下：当 weekLabel=W43 时 W41 若不在「最新」里仍可因其它路径留下；
// 这里断言「最新≠上期」场景下两条都在（用更早的 weekLabel 让 prev 与 latest 不同）。
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

console.log(`\n结果：${passed}/${total} 通过\n`);
process.exit(passed === total ? 0 : 1);
