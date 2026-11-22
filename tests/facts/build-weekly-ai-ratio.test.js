'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFacts } = require('../../src/facts/build-facts');

function projects(total, aiCount) {
  return Array.from({ length: total }, (_, i) => ({
    fullName: `org/proj-${i + 1}`,
    isAI: i < aiCount,
    todayStars: 100 + i,
    stars: 1000 * (i + 1),
  }));
}

function roles(facts) {
  const map = {};
  for (const item of facts.facts) {
    if (item && item.role) map[item.role] = item.value;
  }
  return map;
}

test('周报 stats 缺失时按项目 isAI 计数，ai_ratio=10/13→77', () => {
  const facts = buildFacts({
    level: 'weekly',
    period: '2026-W47',
    brief: { projects: projects(13, 10), stats: {} },
  });
  const values = roles(facts);
  assert.equal(values.total_projects, 13);
  assert.equal(values.ai_projects, 10);
  assert.equal(values.ai_ratio, 77);
});

test('周报 stats 已齐全时口径跟 brief，不改用项目计数', () => {
  const facts = buildFacts({
    level: 'weekly',
    period: '2026-W46',
    brief: {
      projects: projects(11, 8),
      stats: { totalProjects: 11, aiProjects: 9, avgStars: '61k' },
    },
  });
  const values = roles(facts);
  assert.equal(values.total_projects, 11);
  assert.equal(values.ai_projects, 9);
  assert.equal(values.ai_ratio, 82);
});

test('周报无 AI 项目时占比为 0（不是缺 stats 的误算）', () => {
  const facts = buildFacts({
    level: 'weekly',
    period: '2026-W00',
    brief: { projects: projects(5, 0), stats: {} },
  });
  const values = roles(facts);
  assert.equal(values.ai_projects, 0);
  assert.equal(values.ai_ratio, 0);
});
