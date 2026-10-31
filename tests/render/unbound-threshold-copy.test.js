'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildFacts } = require('../../src/facts/build-facts');
const { renderInsights, rewriteUnboundRecurringThreshold } = require('../../src/render/placeholder-renderer');
const { check } = require('../../src/checker/rules/r4-binding');
const prompts = require('../../config/prompts.json');

test('月报重复上榜事实标签不再带阿拉伯数字门槛', () => {
  const facts = buildFacts({
    level: 'monthly',
    period: '2026-09',
    brief: { stats: { recurringProjects: 112 }, monthTop: [] },
    metrics: null,
  });
  const recurring = facts.facts.find(fact => fact.role === 'recurring');
  assert.ok(recurring);
  assert.equal(recurring.value, 112);
  assert.equal(recurring.label, '重复上榜项目数（两天及以上）');
  assert.equal(/\d/.test(recurring.label), false);
});

test('月报提示词不再教模型抄写 ≥2', () => {
  const prompt = `${prompts.monthly.systemPrompt}\n${prompts.monthly.userPrompt}`;
  assert.equal(prompt.includes('≥2'), false);
  assert.equal(prompt.includes('>=2'), false);
  assert.equal(prompt.includes('上榜≥'), false);
  assert.equal(prompt.includes('两天及以上'), true);
});

test('渲染后「上榜 ≥2 天」不再留下未绑定的 2', () => {
  const source = '上榜 ≥2 天的重复上榜项目数为 {{f5:recurring}}';
  const rendered = renderInsights({
    insights: { monthlyTheme: { detailed: source } },
    facts: [{ id: 'f5', value: 112, role: 'recurring', label: '重复上榜项目数（两天及以上）' }],
    projects: [],
    level: 'monthly',
    period: '2026-09',
  });
  const text = rendered.insights.monthlyTheme.detailed;
  assert.equal(text, '上榜两天及以上的重复上榜项目数为 112');
  assert.equal(rendered.errors.length, 0);

  const findings = check(
    { renderMap: { entries: rendered.entries } },
    {
      kind: 'json',
      role: 'insights',
      strings: [{ path: 'monthlyTheme.detailed', value: text, line: 4 }],
    },
  );
  assert.deepEqual(findings, []);
});

test('只改写门槛 2，不改 ≥20 或占位符', () => {
  assert.equal(rewriteUnboundRecurringThreshold('上榜 ≥20 天'), '上榜 ≥20 天');
  assert.equal(rewriteUnboundRecurringThreshold('上榜 ≥2.5 天'), '上榜 ≥2.5 天');
  assert.equal(rewriteUnboundRecurringThreshold('上榜 >=2天'), '上榜两天及以上');
  assert.equal(rewriteUnboundRecurringThreshold('大于等于 2 日'), '两天及以上');
  assert.equal(
    rewriteUnboundRecurringThreshold('项目数为 {{f5:recurring}}'),
    '项目数为 {{f5:recurring}}',
  );
});
