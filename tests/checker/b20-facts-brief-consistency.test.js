'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const b20 = require('../../src/checker/rules/b20');

function doc(facts) {
  return { role: 'facts', path: 'facts-weekly-2026-W47.json', json: { period: '2026-W47', facts } };
}

function ctx(stats, facts) {
  return { level: 'weekly', brief: { stats }, facts: { facts } };
}

test('B20 正例：ai_ratio 与 10/13 一致则放行', () => {
  const facts = [
    { id: 'f1', role: 'total_projects', value: 13 },
    { id: 'f2', role: 'ai_projects', value: 10 },
    { id: 'f3', role: 'ai_ratio', value: 77 },
  ];
  const findings = b20.check(ctx({ totalProjects: 13, aiProjects: 10 }, facts), doc(facts));
  assert.deepEqual(findings, []);
});

test('B20 反例：ai_ratio=0 但 aiProjects=10 则 FAIL', () => {
  const facts = [
    { id: 'f1', role: 'ai_ratio', value: 0 },
  ];
  const findings = b20.check(ctx({ totalProjects: 13, aiProjects: 10 }, facts), doc(facts));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule_id, 'B20');
  assert.equal(findings[0].field, 'ai_ratio');
  assert.match(findings[0].message, /应为 77%/);
});

test('B20 在日报上不适用', () => {
  assert.equal(b20.applies({ level: 'daily' }, { role: 'facts' }), false);
  assert.equal(b20.applies({ level: 'weekly' }, { role: 'brief' }), false);
  assert.equal(b20.applies({ level: 'weekly' }, { role: 'facts' }), true);
});

test('B20 在 brief.stats 缺失时不误报', () => {
  const facts = [{ id: 'f1', role: 'ai_ratio', value: 0 }];
  const findings = b20.check(ctx({}, facts), doc(facts));
  assert.deepEqual(findings, []);
});
