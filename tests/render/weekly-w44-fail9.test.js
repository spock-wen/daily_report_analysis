'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { renderInsights } = require('../../src/render/placeholder-renderer');
const { extractRefs } = require('../../src/checker/rules/b5');
const { check: checkB5 } = require('../../src/checker/rules/b5');
const { check: checkB10 } = require('../../src/checker/rules/b10');
const { loadConfig } = require('../../src/checker/config');

// 线上闸证 check-weekly-2026-W44，generatedAt 2026-11-01T06:48:54.326Z，count=9。
const NOTES = [
  '本周日报上榜 {{f27:top3_days}} 天，日报合计新增 {{f28:top3_stars}} 星，全周霸榜。',
  '本周日报上榜 {{f29:top3_days}} 天，日报合计新增 {{f30:top3_stars}} 星，JetBrains 新作持续吸引关注。',
  '本周日报上榜 {{f31:top3_days}} 天，日报合计新增 {{f32:top3_stars}} 星，本周进入周榜保持热度。',
];
const NEXT = '观察 {{p:HKUDS/DeepTutor}} 日报上榜天数能否领先本周的 {{f31:top3_days}} 天，判断其热度走向。';
const GEO = '适用于 Claude Code 的通用 SEO 技能，覆盖技术 SEO、GEO/AEO 等子域，本周新增 4814 星，累计 25093 星，Fork 数 3320。';

const FACTS = [
  { id: 'f27', value: 7, role: 'top3_days', project: 'pbakaus/impeccable' },
  { id: 'f28', value: 12112, role: 'top3_stars', project: 'pbakaus/impeccable' },
  { id: 'f29', value: 6, role: 'top3_days', project: 'JetBrains/koog' },
  { id: 'f30', value: 5327, role: 'top3_stars', project: 'JetBrains/koog' },
  { id: 'f31', value: 5, role: 'top3_days', project: 'HKUDS/DeepTutor' },
  { id: 'f32', value: 9206, role: 'top3_stars', project: 'HKUDS/DeepTutor' },
];

const PROJECTS = ['pbakaus/impeccable', 'JetBrains/koog', 'HKUDS/DeepTutor'];

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

function gate(insights, facts = FACTS, projects = PROJECTS) {
  const rendered = renderInsights({
    insights,
    facts,
    projects,
    level: 'weekly',
    period: '2026-W44',
  });
  const strings = [];
  flatten(rendered.insights, '', strings);
  const ctx = {
    r3: true,
    level: 'weekly',
    facts,
    renderMap: { entries: rendered.entries },
  };
  const doc = { kind: 'json', role: 'insights', strings, path: 'insights-2026-W44.json' };
  return {
    rendered,
    b5: checkB5(ctx, doc, loadConfig()),
    b10: checkB10(ctx, doc),
  };
}

test('W44 FAIL9：dailyTop3Notes 与 nextWeekPoints 的 top3 槽过 PH1/B10', () => {
  const found = gate({
    dailyTop3Notes: NOTES.map(note => ({ repo: '{{p:HKUDS/DeepTutor}}', note })),
    nextWeekPoints: [NEXT],
  });
  assert.deepEqual(found.rendered.errors, [], JSON.stringify(found.rendered.errors));
  assert.deepEqual(found.b10, [], JSON.stringify(found.b10));
  assert.deepEqual(found.b5, [], JSON.stringify(found.b5));
  assert.match(found.rendered.insights.dailyTop3Notes[0].note, /日报上榜 7 天，日报合计新增 12112 星/);
  assert.match(found.rendered.insights.dailyTop3Notes[1].note, /日报合计新增 5327 星/);
  assert.match(found.rendered.insights.dailyTop3Notes[2].note, /日报合计新增 9206 星/);
  assert.match(found.rendered.insights.nextWeekPoints[0], /领先本周的 5 天/);
});

test('日报新增（无「合计」）同样只接受 top3_stars', () => {
  const found = gate({
    dailyTop3Notes: [{
      repo: '{{p:HKUDS/DeepTutor}}',
      note: '本周日报上榜 {{f31:top3_days}} 天，日报新增 {{f32:top3_stars}} 星。',
    }],
  });
  assert.deepEqual(found.rendered.errors, []);
  assert.deepEqual(found.b10, []);
});

test('合计槽仍不接受 top3_stars，日报合计槽仍不接受 week_stars', () => {
  const totalWeek = renderInsights({
    insights: { weeklyTheme: { oneLiner: '合计新增 {{f1:top3_stars}} 星。' } },
    facts: [{ id: 'f1', value: 100, role: 'top3_stars', project: null }],
    projects: [],
    level: 'weekly',
    period: '2026-W44',
  });
  assert.equal(totalWeek.errors.length, 1);
  assert.match(totalWeek.errors[0].message, /top3_stars/);

  const dailySum = renderInsights({
    insights: { dailyTop3Notes: [{ note: '日报合计新增 {{f2:week_stars}} 星。' }] },
    facts: [{ id: 'f2', value: 100, role: 'week_stars', project: 'HKUDS/DeepTutor' }],
    projects: ['HKUDS/DeepTutor'],
    level: 'weekly',
    period: '2026-W44',
  });
  assert.equal(dailySum.errors.length, 1);
  assert.match(dailySum.errors[0].message, /week_stars/);

  const days = renderInsights({
    insights: { nextWeekPoints: ['日报上榜天数能否领先本周的 {{f3:week_stars}} 天。'] },
    facts: [{ id: 'f3', value: 5, role: 'week_stars', project: null }],
    projects: [],
    level: 'weekly',
    period: '2026-W44',
  });
  assert.equal(days.errors.length, 1);
  assert.match(days.errors[0].message, /week_stars/);
});

test('W44 FAIL9：GEO/AEO 不是仓库，裸 owner/repo 仍被 B5 拦住', () => {
  const config = loadConfig();
  assert.deepEqual(extractRefs(GEO, new Set(config.commonSlashWords.map(word => word.toLowerCase()))), []);
  assert.deepEqual(extractRefs('覆盖 geo/aeo 与 Geo/Aeo。', new Set(['geo', 'aeo'])), []);

  const bare = '对照 HKUDS/DeepTutor 与 Foo/Bar，不要写成 GEO/AEO。';
  assert.deepEqual(
    extractRefs(bare, new Set(config.commonSlashWords.map(word => word.toLowerCase()))),
    ['HKUDS/DeepTutor', 'Foo/Bar'],
  );

  const found = gate({
    topProjects: [{ repo: '{{p:HKUDS/DeepTutor}}', oneSentence: GEO }],
  });
  assert.deepEqual(found.b5, [], JSON.stringify(found.b5));

  const missed = gate({
    topProjects: [{ oneSentence: '对照 Foo/Bar 的写法。' }],
  });
  assert.equal(missed.b5.length, 1);
  assert.match(missed.b5[0].message, /Foo\/Bar/);
});

test('回退笔记用日报合计新增，渲染后过 PH1/B10', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/analyzer/insight-analyzer.js'), 'utf8');
  assert.match(source, /日报合计新增 \$\{factPlaceholder\(starsFact\)\} 星/);
  assert.equal(source.includes('期内新增'), false);
  const found = gate({
    dailyTop3Notes: [{
      repo: '{{p:acme/widget}}',
      note: '本周日报上榜 {{f27:top3_days}} 天，日报合计新增 {{f28:top3_stars}} 星，但未进入周榜，原因未知。',
    }],
  }, [
    { id: 'f27', value: 4, role: 'top3_days', project: 'acme/widget' },
    { id: 'f28', value: 80, role: 'top3_stars', project: 'acme/widget' },
  ], ['acme/widget']);
  assert.deepEqual(found.rendered.errors, [], JSON.stringify(found.rendered.errors));
  assert.deepEqual(found.b10, []);
});

test('周报提示写明 top3 槽和缩写斜杠', () => {
  const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/prompts.json'), 'utf8'));
  const weekly = `${prompts.weekly.systemPrompt}\n${prompts.weekly.userPrompt}`;
  assert.match(weekly, /top3_days/);
  assert.match(weekly, /top3_stars/);
  assert.match(weekly, /日报合计新增/);
  assert.match(weekly, /日报上榜天数/);
  assert.match(weekly, /GEO\/AEO/);
});
