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

const fs = require('fs');
const os = require('os');
const path = require('path');
const { runContentGate } = require('../../src/checker/gate');
const { checkReport } = require('../../src/checker');

function silentLogger() {
  return { info() {}, error() {}, warn() {} };
}

function withTempWeeklyReport({ stats, facts }) {
  const previous = process.env.REPORT_DATA_DIR;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'b20-gate-'));
  const dataDir = path.join(root, 'data');
  const briefDir = path.join(dataDir, 'briefs', 'weekly');
  const insightsDir = path.join(dataDir, 'insights', 'weekly');
  const factsDir = path.join(dataDir, 'facts');
  fs.mkdirSync(briefDir, { recursive: true });
  fs.mkdirSync(insightsDir, { recursive: true });
  fs.mkdirSync(factsDir, { recursive: true });

  const brief = {
    period: '2026-W47',
    stats,
    projects: Array.from({ length: stats.totalProjects || 0 }, (_, i) => ({
      fullName: `org/proj-${i + 1}`,
      isAI: i < (stats.aiProjects || 0),
    })),
  };
  const insights = {
    weeklyTheme: { detailed: '本周主题概述，不含禁词。' },
    highlights: ['本周项目分布平稳。'],
  };
  fs.writeFileSync(path.join(briefDir, 'data-weekly-2026-W47.json'), `${JSON.stringify(brief, null, 2)}\n`);
  fs.writeFileSync(path.join(insightsDir, 'insights-2026-W47.json'), `${JSON.stringify(insights, null, 2)}\n`);
  fs.writeFileSync(path.join(factsDir, 'facts-weekly-2026-W47.json'), `${JSON.stringify(facts, null, 2)}\n`);

  return {
    dataDir,
    restore() {
      if (previous === undefined) delete process.env.REPORT_DATA_DIR;
      else process.env.REPORT_DATA_DIR = previous;
    },
  };
}

test('runContentGate 反例：旧 facts ai_ratio=0 且 brief 10/13 被闸拦住（含 B20）', async () => {
  const fixture = withTempWeeklyReport({
    stats: { totalProjects: 13, aiProjects: 10 },
    facts: { period: '2026-W47', facts: [{ id: 'f1', role: 'ai_ratio', value: 0, source: 'stats.aiProjects' }] },
  });
  try {
    const result = await runContentGate({
      level: 'weekly',
      period: '2026-W47',
      dataDir: fixture.dataDir,
      logger: silentLogger(),
    });
    assert.equal(result.pass, false);
    const b20 = result.findings.filter(f => f.rule_id === 'B20');
    assert.equal(b20.length, 1);
    assert.equal(b20[0].field, 'ai_ratio');
    assert.match(b20[0].message, /应为 77%/);
  } finally {
    fixture.restore();
  }
});

test('runContentGate 正例：facts 与 brief 10/13、ai_ratio=77 一致则 B20 不报', async () => {
  const fixture = withTempWeeklyReport({
    stats: { totalProjects: 13, aiProjects: 10 },
    facts: {
      period: '2026-W47',
      facts: [
        { id: 'f1', role: 'total_projects', value: 13 },
        { id: 'f2', role: 'ai_projects', value: 10 },
        { id: 'f3', role: 'ai_ratio', value: 77 },
      ],
    },
  });
  try {
    const result = await runContentGate({
      level: 'weekly',
      period: '2026-W47',
      dataDir: fixture.dataDir,
      logger: silentLogger(),
    });
    assert.equal(result.findings.filter(f => f.rule_id === 'B20').length, 0);
  } finally {
    fixture.restore();
  }
});

test('checkReport 从磁盘接入 facts 文档后会执行 B20', () => {
  const fixture = withTempWeeklyReport({
    stats: { totalProjects: 13, aiProjects: 10 },
    facts: { period: '2026-W47', facts: [{ id: 'f1', role: 'ai_ratio', value: 0 }] },
  });
  try {
    const result = checkReport({
      level: 'weekly',
      period: '2026-W47',
      dataDir: fixture.dataDir,
    });
    assert.ok(result.findings.some(f => f.rule_id === 'B20' && /应为 77%/.test(f.message)));
  } finally {
    fixture.restore();
  }
});
