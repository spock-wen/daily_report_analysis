'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { renderInsights } = require('../../src/render/placeholder-renderer');
const { check: checkB10 } = require('../../src/checker/rules/b10');

// 闸证 check-weekly-2026-W44.json，generatedAt 2026-11-01T07:10:44.175Z。
// 唯一 PH1：nextWeekPoints[2]，{{f79:threshold}} 被同一分句的「周榜合计新增 / 合计」抢走。
const QUOTE = '关注周榜合计新增能否突破 {{f79:threshold}} 星看点阈值，判断环比 {{f9:wow_rate}}% 之后是否回暖。';
const QUOTE_WITHOUT_THRESHOLD_CUE = '关注周榜合计新增能否突破 {{f79:threshold}} 星，判断环比 {{f9:wow_rate}}% 之后是否回暖。';
const QUOTE_WEEK_STARS_IN_THRESHOLD = '关注周榜合计新增能否突破 {{f79:week_stars}} 星看点阈值，判断环比 {{f9:wow_rate}}% 之后是否回暖。';

const FACTS = [
  { id: 'f79', value: 200000, role: 'threshold', project: null },
  { id: 'f9', value: -39.2, role: 'wow_rate', project: null },
];

function flatten(value, fieldPath, out) {
  if (typeof value === 'string') {
    out.push({ path: fieldPath, value, line: out.length + 1 });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${fieldPath}[${index}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      flatten(item, fieldPath ? `${fieldPath}.${key}` : key, out);
    }
  }
}

function gate(quote, facts = FACTS) {
  const rendered = renderInsights({
    insights: {
      nextWeekPoints: [
        '观察技能封装能否持续领先。',
        '对照安全类项目是否反超。',
        quote,
      ],
    },
    facts,
    projects: [],
    level: 'weekly',
    period: '2026-W44',
  });
  const strings = [];
  flatten(rendered.insights, '', strings);
  const b10 = checkB10(
    { r3: true, level: 'weekly', facts, renderMap: { entries: rendered.entries } },
    { kind: 'json', role: 'insights', strings, path: 'insights-2026-W44.json' },
  );
  return { rendered, b10 };
}

test('W44 PH1：周榜合计新增同一分句里，紧挨着的星看点阈值仍归 threshold', () => {
  const found = gate(QUOTE);
  assert.deepEqual(found.rendered.errors, [], JSON.stringify(found.rendered.errors));
  assert.deepEqual(found.b10, [], JSON.stringify(found.b10));
  const point = found.rendered.insights.nextWeekPoints[2];
  assert.match(point, /突破 200000 星看点阈值/);
  assert.match(point, /环比 -39\.2%/);
  const entry = found.rendered.entries.find(item => item.factId === 'f79');
  assert.equal(entry.path, 'nextWeekPoints[2]');
  assert.equal(entry.role, 'threshold');
});

test('W44 PH1：没有星看点阈值时，threshold 仍不能落进周榜合计新增槽', () => {
  const found = gate(QUOTE_WITHOUT_THRESHOLD_CUE);
  const hits = found.rendered.errors.filter(error => error.placeholder === '{{f79:threshold}}');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].path, 'nextWeekPoints[2]');
  assert.match(hits[0].message, /语义槽与 role「threshold」不一致/);
  assert.equal(found.rendered.errors.some(error => error.placeholder === '{{f9:wow_rate}}'), false);
  const b10Hits = found.b10.filter(item => item.field === 'nextWeekPoints[2]' && /threshold/.test(item.message));
  assert.equal(b10Hits.length, 1);
});

test('W44 PH1：星看点阈值槽不接受 week_stars', () => {
  const facts = [
    { id: 'f79', value: 200000, role: 'week_stars', project: null },
    { id: 'f9', value: -39.2, role: 'wow_rate', project: null },
  ];
  const found = gate(QUOTE_WEEK_STARS_IN_THRESHOLD, facts);
  const hits = found.rendered.errors.filter(error => /week_stars/.test(error.placeholder) || /week_stars/.test(error.message));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].path, 'nextWeekPoints[2]');
  assert.match(hits[0].message, /语义槽与 role「week_stars」不一致/);
  assert.equal(found.rendered.errors.some(error => error.placeholder === '{{f9:wow_rate}}'), false);
});
