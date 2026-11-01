'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { renderInsights } = require('../../src/render/placeholder-renderer');
const { check: checkB10 } = require('../../src/checker/rules/b10');

// 线上闸证 https://report.wenspock.site/check/check-monthly-2026-10.json
// generatedAt 2026-11-01T01:30:57.318Z，唯一 PH1 的 quote。
const QUOTE = '月上旬，agent 主导了榜单的叙事。{{p:mattpocock/skills}} 以 {{f18:days_on_list}} 天的上榜时长贡献 {{f17:month_stars}} 星的新增，累计已达 {{f19:stars}} 星，为整月的技能生态热身。{{p:DietrichGebert/ponytail}} 同步走强，上榜 {{f24:days_on_list}} 天，本月新增 {{f23:month_stars}} 星，累计 {{f25:stars}} 星。硬件巨头也开始进场：{{p:NVIDIA/OpenShell}} 上榜 {{f69:days_on_list}} 天，本月新增 {{f68:month_stars}} 星，累计 {{f70:stars}} 星。这一阶段的特征是个人开发者与厂商账号同时试探技能化工具的边界，为后续中旬的集中爆发蓄力。';

test('PH1：天的上榜与星的新增同句时，month_stars 不再落入 days_on_list', () => {
  const facts = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../../data/facts/facts-monthly-2026-10.json'),
    'utf8',
  )).facts;
  const rendered = renderInsights({
    insights: { trendEvolution: [{ analysis: QUOTE }] },
    facts,
    projects: ['mattpocock/skills', 'DietrichGebert/ponytail', 'NVIDIA/OpenShell'],
    level: 'monthly',
    period: '2026-10',
  });
  assert.equal(rendered.errors.length, 0, JSON.stringify(rendered.errors));
  assert.match(rendered.insights.trendEvolution[0].analysis, /贡献 28730 星的新增/);

  const findings = checkB10(
    { r3: true, facts, renderMap: { entries: rendered.entries } },
    {
      role: 'insights',
      strings: [{
        path: 'trendEvolution[0].analysis',
        value: rendered.insights.trendEvolution[0].analysis,
        line: 1,
      }],
    },
  );
  assert.deepEqual(findings, []);

  const mismatched = renderInsights({
    insights: {
      trendEvolution: [{
        analysis: '以 {{f1:days_on_list}} 天的上榜时长贡献 {{f2:stars}} 星的新增',
      }],
    },
    facts: [
      { id: 'f1', value: 8, role: 'days_on_list', project: 'Foo/bar' },
      { id: 'f2', value: 100, role: 'stars', project: 'Foo/bar' },
    ],
    projects: ['Foo/bar'],
    level: 'monthly',
    period: '2026-10',
  });
  assert.equal(mismatched.errors.length, 1);
  assert.equal(mismatched.errors[0].placeholder, '{{f2:stars}}');
  assert.match(mismatched.errors[0].message, /role「stars」不一致/);
});
