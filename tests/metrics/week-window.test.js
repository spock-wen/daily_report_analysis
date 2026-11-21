#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const history = require('../../src/metrics/history');
const { checkWeekWindow, parseRangeText } = require('../../src/metrics/week-window');

const REPO = path.resolve(__dirname, '../..');

test('W46 正确窗口 11-09..11-15 放行', () => {
  const expected = history.getISOWeekDates('2026-W46');
  assert.deepEqual(expected, [
    '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12',
    '2026-11-13', '2026-11-14', '2026-11-15',
  ]);
  const result = checkWeekWindow('2026-W46', expected);
  assert.equal(result.ok, true, result.reason);
});

test('负例：W46 读成 11-08..11-14（W46 事故同类错数）必被拦', () => {
  const wrong = [
    '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11',
    '2026-11-12', '2026-11-13', '2026-11-14',
  ];
  const result = checkWeekWindow('2026-W46', wrong);
  assert.equal(result.ok, false);
  assert.match(result.reason, /11-09.*11-15/);
  assert.match(result.reason, /11-08.*11-14/);
});

test('W44/W45 已推送页写出的范围与期望周窗口一致（只读，不重生）', () => {
  const cases = [
    ['2026-W44', 'github-weekly-2026-W44.html', '2026-10-26', '2026-11-01'],
    ['2026-W45', 'github-weekly-2026-W45.html', '2026-11-02', '2026-11-08'],
  ];
  for (const [weekId, file, start, end] of cases) {
    const html = fs.readFileSync(path.join(REPO, 'reports', 'weekly', file), 'utf8');
    const range = parseRangeText(html);
    assert.ok(range, `${weekId} 页应写出日期范围`);
    assert.equal(range.start, start);
    assert.equal(range.end, end);
    const result = checkWeekWindow(weekId, html);
    assert.equal(result.ok, true, result.reason);
  }
});

test('负例：把 W45 页范围改成 11-01..11-07 必被拦', () => {
  const planted = '周报 2026-W45 2026-11-01 — 2026-11-07 ｜ 上榜 18 项目';
  const result = checkWeekWindow('2026-W45', planted);
  assert.equal(result.ok, false);
  assert.match(result.reason, /11-02.*11-08/);
});
