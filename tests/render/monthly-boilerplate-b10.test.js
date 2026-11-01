'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { renderInsights } = require('../../src/render/placeholder-renderer');
const { stripBoilerplateText, stripAnalysis } = require('../../src/render/strip-boilerplate');
const { computeMonthlyMetrics } = require('../../src/metrics/monthly-metrics');
const { check: checkB10 } = require('../../src/checker/rules/b10');
const { loadConfig } = require('../../src/checker/config');
const MonthlyAggregator = require('../../src/scraper/aggregators/monthly-aggregator');
const ReportPipeline = require('../../src/scraper/report-pipeline');
const { checkDocument } = require('../../src/checker');
const prompts = require('../../config/prompts.json');

const PHRASES = [
  '明星项目，在开发者社区具有重要影响力',
  '提供智能代理/自动化助手功能',
  '今日热度极高，受到社区广泛关注',
  '今日增长迅速，值得关注',
  '全面爆发',
];

test('固定句从分析列表删除，周主题里的全面爆发被改写', () => {
  const analysis = stripAnalysis({
    type: 'agent',
    coreFunctions: [
      '提供智能代理/自动化助手功能',
      '支持多步骤任务规划和执行',
      '根据 README 做上下文压缩',
    ],
    trends: [
      '🔥 今日热度极高，受到社区广泛关注',
      '⭐ 明星项目，在开发者社区具有重要影响力',
    ],
  });
  assert.deepEqual(analysis.coreFunctions, ['根据 README 做上下文压缩']);
  assert.deepEqual(analysis.trends, []);

  const theme = stripBoilerplateText('AI Agent 基础设施全面爆发：记忆持久化、技能生态、多智能体编排成为三大主线');
  assert.equal(theme.includes('全面爆发'), false);
  assert.equal(theme.includes('记忆持久化'), true);
  assert.equal(theme.includes('集中出现'), true);
});

test('月报提示词写明合计 role 与禁词改写', () => {
  const prompt = prompts.monthly.userPrompt;
  assert.equal(prompt.includes('total_month_stars'), true);
  assert.equal(prompt.includes('不要写成 total_month_stars'), true);
  assert.equal(prompt.includes('role 是 total_month'), true);
  assert.equal(prompt.includes('全面爆发'), true);
});

test('B10：total_month_stars 改写为事实 role，month_stars 按语义槽改绑', () => {
  const facts = [
    { id: 'f4', value: 297628, role: 'total_month', label: '本月新增星合计' },
    { id: 'f26', value: 1200, role: 'month_stars', project: 'Foo/bar', label: 'Foo/bar 本月新增星' },
    { id: 'f28', value: 90000, role: 'stars', project: 'Foo/bar', label: 'Foo/bar 累计 Stars' },
  ];
  const rendered = renderInsights({
    insights: {
      darkHorse: { reason: '本月合计新增 {{f4:total_month_stars}} 星' },
      monthlyTheme: {
        detailed: '本月新增 {{f28:month_stars}} 星。累计 {{f28:month_stars}} 星。',
      },
    },
    facts,
    projects: ['Foo/bar'],
    level: 'monthly',
    period: '2026-10',
  });

  assert.equal(rendered.insights.darkHorse.reason, '本月合计新增 297628 星');
  assert.equal(rendered.insights.monthlyTheme.detailed, '本月新增 1200 星。累计 90000 星。');
  assert.equal(rendered.errors.length, 0);

  const byPath = rendered.entries.reduce((map, entry) => {
    const list = map.get(entry.path) || [];
    list.push(entry);
    map.set(entry.path, list);
    return map;
  }, new Map());
  assert.equal(byPath.get('darkHorse.reason')[0].placeholder, '{{f4:total_month}}');
  assert.equal(byPath.get('darkHorse.reason')[0].role, 'total_month');
  assert.equal(byPath.get('darkHorse.reason')[0].factId, 'f4');

  const detailed = byPath.get('monthlyTheme.detailed');
  assert.equal(detailed[0].placeholder, '{{f26:month_stars}}');
  assert.equal(detailed[0].role, 'month_stars');
  assert.equal(detailed[0].factId, 'f26');
  assert.equal(detailed[1].placeholder, '{{f28:stars}}');
  assert.equal(detailed[1].role, 'stars');
  assert.equal(detailed[1].factId, 'f28');

  const findings = checkB10(
    { r3: true, facts, renderMap: { entries: rendered.entries } },
    {
      role: 'insights',
      strings: [
        { path: 'darkHorse.reason', value: rendered.insights.darkHorse.reason, line: 1 },
        { path: 'monthlyTheme.detailed', value: rendered.insights.monthlyTheme.detailed, line: 2 },
      ],
    },
  );
  assert.deepEqual(findings, []);
});

test('2026-10 月报 brief 不再含 C1/C3 套话', async () => {
  const aggregator = new MonthlyAggregator();
  const monthly = await aggregator.aggregate('2026-10');
  const pipeline = new ReportPipeline({
    enableAI: false,
    enableHTML: false,
    enableIndex: false,
    enableNotification: false,
    enableWikiPostProcessing: false,
    contentCheck: false,
  });
  const formatted = pipeline.formatDataForLegacy(monthly, 'monthly', '2026-10');
  const blob = JSON.stringify(formatted);
  for (const phrase of PHRASES) {
    assert.equal(blob.includes(phrase), false, phrase);
  }
  for (const item of formatted.weekThemes || []) {
    assert.equal(String(item.theme || '').includes('全面爆发'), false);
  }

  const filePath = path.join(os.tmpdir(), 'data-month-2026-10.json');
  fs.writeFileSync(filePath, `${JSON.stringify(formatted, null, 2)}\n`);
  const result = checkDocument({
    filePath,
    dataDir: path.join(__dirname, '../../data'),
  });
  const counts = {};
  for (const finding of result.findings) {
    counts[finding.rule_id] = (counts[finding.rule_id] || 0) + 1;
  }
  assert.equal(counts.C1 || 0, 0, JSON.stringify(counts));
  assert.equal(counts.C3 || 0, 0, JSON.stringify(counts));

  const config = loadConfig();
  const metrics = computeMonthlyMetrics('2026-10');
  for (const item of metrics.weekThemes || []) {
    for (const word of config.bannedWords) {
      assert.equal(String(item.theme || '').includes(word), false, `${item.week} ${word}`);
    }
  }
});
