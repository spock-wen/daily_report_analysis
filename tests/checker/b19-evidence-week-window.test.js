#!/usr/bin/env node
'use strict';

// B19 周报周窗口门禁：页头范围（checkWeekWindow）+ insights 里所有 evidence[].day（checkEvidenceDays）。
// 夹具全部写到临时目录；仓库里已发布的 insights/HTML 只读，不改、不重生。

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');

const REPO = path.resolve(__dirname, '../..');
const REPO_DATA = path.join(REPO, 'data');
const { checkReport, checkDocument } = require('../../src/checker');
const { runContentGate } = require('../../src/checker/gate');
const { checkEvidenceDays, collectEvidenceDays } = require('../../src/metrics/week-window');

// 补证目录 w45-out-of-window-evidence.json 的原样拷贝（W45 deepTrends.evidence[0]、[3] 原始对象）
const W45_EVIDENCE_OUT = path.join(__dirname, 'fixtures', 'w45-out-of-window-evidence.json');

function readPublishedInsights(weekId) {
  return JSON.parse(fs.readFileSync(path.join(REPO_DATA, 'insights', 'weekly', `insights-${weekId}.json`), 'utf8'));
}

// 临时 data 目录：除 insights 外都软链到仓库 data（只读），insights 用夹具；FAIL 清单落在临时目录的 check/
function makeDataDir(weekId, insights) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'b19-'));
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir);
  for (const entry of fs.readdirSync(REPO_DATA)) {
    if (entry === 'insights') continue;
    fs.symlinkSync(path.join(REPO_DATA, entry), path.join(dataDir, entry));
  }
  const dir = path.join(dataDir, 'insights', 'weekly');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `insights-${weekId}.json`), `${JSON.stringify(insights, null, 2)}\n`);
  return { root, dataDir };
}

function b19(findings) {
  return findings.filter(finding => finding.rule_id === 'B19');
}

const silentLogger = { info() {}, error() {} };

// ---------- 帮助函数语义 ----------

test('checkEvidenceDays：窗内但不齐 7 天也放行（不是整窗相等比较）', () => {
  const result = checkEvidenceDays('2026-W46', [
    { path: 'deepTrends.evidence[0].day', day: '2026-11-09' },
    { path: 'deepTrends.evidence[1].day', day: '2026-11-15' },
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('checkEvidenceDays：越窗、缺 day、非日期、非法日历日都记为违规', () => {
  const result = checkEvidenceDays('2026-W45', [
    { path: 'a', day: '2026-11-01' },
    { path: 'b', day: undefined },
    { path: 'c', day: '11-03' },
    { path: 'd', day: '2026-02-30' },
    { path: 'e', day: '2026-11-08' },
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.violations.map(v => v.path), ['a', 'b', 'c', 'd']);
});

test('collectEvidenceDays：遍历任意层级的 evidence 数组（不只 deepTrends）', () => {
  const entries = collectEvidenceDays({
    deepTrends: { evidence: [{ name: 'x/y', day: '2026-11-09' }] },
    trends: [{ evidence: [{ name: 'a/b', day: '2026-11-10' }, 'plain string'] }],
  });
  assert.deepEqual(entries.map(e => [e.path, e.day]), [
    ['deepTrends.evidence[0].day', '2026-11-09'],
    ['trends[0].evidence[0].day', '2026-11-10'],
    ['trends[0].evidence[1]', undefined],
  ]);
});

// ---------- 接入既有内容门禁（checkReport / runContentGate） ----------

test('负例 W45：已发布 W45 insights 原样（两条 day=2026-11-01）经门禁 FAIL，恰好命中 evidence[0]、[3]', () => {
  const published = readPublishedInsights('2026-W45');
  const original = JSON.parse(fs.readFileSync(W45_EVIDENCE_OUT, 'utf8'));
  const { dataDir } = makeDataDir('2026-W45', published);
  const result = checkReport({ level: 'weekly', period: '2026-W45', dataDir });
  assert.equal(result.pass, false);
  const hits = b19(result.findings);
  assert.deepEqual(hits.map(h => h.field), original.map(o => `deepTrends.evidence[${o.index}].day`));
  for (const hit of hits) {
    assert.equal(hit.quote, '2026-11-01');
    assert.match(hit.message, /2026-11-02\.\.2026-11-08/);
    assert.ok(hit.line > 0, '要定位到行号');
  }
  // 除 B19 外没有别的 FAIL（门禁里新增的只有这两条）
  assert.equal(result.findings.length, hits.length);
});

test('负例 W45 经 runContentGate：FAIL 不放行，写 FAIL 清单到临时目录', async () => {
  const { root, dataDir } = makeDataDir('2026-W45', readPublishedInsights('2026-W45'));
  const gate = await runContentGate({ level: 'weekly', period: '2026-W45', dataDir, logger: silentLogger });
  assert.equal(gate.pass, false);
  assert.equal(b19(gate.findings).length, 2);
  assert.ok(gate.paths.jsonPath.startsWith(root), gate.paths.jsonPath);
});

test('正例 W45：同一份 insights 只把两条 11-01 改成窗内日期，门禁整体 PASS', async () => {
  const fixed = readPublishedInsights('2026-W45');
  fixed.deepTrends.evidence[0].day = '2026-11-02';
  fixed.deepTrends.evidence[3].day = '2026-11-02';
  const { dataDir } = makeDataDir('2026-W45', fixed);
  const gate = await runContentGate({ level: 'weekly', period: '2026-W45', dataDir, logger: silentLogger });
  assert.equal(gate.pass, true, JSON.stringify(gate.findings));
});

test('正例 W46：已发布 W46 insights（12 条 evidence 全在 11-09..11-15）门禁 PASS', async () => {
  const { dataDir } = makeDataDir('2026-W46', readPublishedInsights('2026-W46'));
  const gate = await runContentGate({ level: 'weekly', period: '2026-W46', dataDir, logger: silentLogger });
  assert.equal(gate.pass, true, JSON.stringify(gate.findings));
});

test('负例 W46 错窗：evidence 按 11-08..11-14 错窗取日（含 11-08）门禁 FAIL', () => {
  const wrong = readPublishedInsights('2026-W46');
  wrong.deepTrends.evidence[0].day = '2026-11-08';
  const { dataDir } = makeDataDir('2026-W46', wrong);
  const result = checkReport({ level: 'weekly', period: '2026-W46', dataDir });
  assert.equal(result.pass, false);
  const hits = b19(result.findings);
  assert.deepEqual(hits.map(h => [h.field, h.quote]), [['deepTrends.evidence[0].day', '2026-11-08']]);
  assert.match(hits[0].message, /2026-11-09\.\.2026-11-15/);
});

test('负例：evidence 缺 day / 非 YYYY-MM-DD 门禁 FAIL', () => {
  const bad = readPublishedInsights('2026-W46');
  delete bad.deepTrends.evidence[1].day;
  bad.deepTrends.evidence[2].day = '11-13';
  const { dataDir } = makeDataDir('2026-W46', bad);
  const hits = b19(checkReport({ level: 'weekly', period: '2026-W46', dataDir }).findings);
  assert.deepEqual(hits.map(h => h.field).sort(), ['deepTrends.evidence[1]', 'deepTrends.evidence[2].day']);
});

test('正例 W46：门禁也放行仅两天的 evidence 子集，不要求完整七天', async () => {
  const sparse = readPublishedInsights('2026-W46');
  sparse.deepTrends.evidence = [sparse.deepTrends.evidence[0], sparse.deepTrends.evidence[8]];
  const { dataDir } = makeDataDir('2026-W46', sparse);
  const gate = await runContentGate({ level: 'weekly', period: '2026-W46', dataDir, logger: silentLogger });
  assert.equal(gate.pass, true, JSON.stringify(gate.findings));
});

test('负例 嵌套 evidence：deepTrends 以外的数组也经注册规则拦截，无对象条目不可漏检', () => {
  const nested = readPublishedInsights('2026-W46');
  nested.extra = [{ nested: { evidence: [{ day: '2026-11-08' }, 'no-day'] } }];
  const { dataDir } = makeDataDir('2026-W46', nested);
  const result = checkReport({ level: 'weekly', period: '2026-W46', dataDir });
  assert.equal(result.pass, false);
  assert.deepEqual(b19(result.findings).map(h => h.field), [
    'extra[0].nested.evidence[0].day', 'extra[0].nested.evidence[1]',
  ]);
});

test('正例 W44：无 deepTrends/evidence 时 B19 不报（W44 已发布原样）', () => {
  const { dataDir } = makeDataDir('2026-W44', readPublishedInsights('2026-W44'));
  const result = checkReport({ level: 'weekly', period: '2026-W44', dataDir });
  assert.equal(result.pass, true, JSON.stringify(result.findings));
});

test('只管周报：日报/月报 insights 里的 evidence 不由 B19 判', () => {
  const rule = require('../../src/checker/rules/b19');
  assert.equal(rule.id, 'B19');
  assert.equal(rule.applies({ level: 'daily' }, { role: 'insights', kind: 'json' }), false);
  assert.equal(rule.applies({ level: 'monthly' }, { role: 'insights', kind: 'json' }), false);
  assert.equal(rule.applies({ level: 'weekly' }, { role: 'insights', kind: 'json' }), true);
  assert.equal(rule.applies({ level: 'weekly' }, { role: 'brief', kind: 'json' }), false);
});

// ---------- 页头窗口（HTML，经 checkDocument） ----------

function tmpWeeklyHtml(weekId, source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b19-html-'));
  const file = path.join(dir, `github-weekly-${weekId}.html`);
  fs.writeFileSync(file, source);
  return file;
}

test('正例 页头：已发布 W46 页头 2026-11-09 — 2026-11-15 的副本 B19 不报', () => {
  const html = fs.readFileSync(path.join(REPO, 'reports', 'weekly', 'github-weekly-2026-W46.html'), 'utf8');
  const result = checkDocument({ filePath: tmpWeeklyHtml('2026-W46', html), dataDir: REPO_DATA });
  assert.deepEqual(b19(result.findings), []);
});

test('负例 页头：W46 副本页头改成 11-08 — 11-14 错窗，B19 FAIL', () => {
  const html = fs.readFileSync(path.join(REPO, 'reports', 'weekly', 'github-weekly-2026-W46.html'), 'utf8')
    .replace('2026-11-09 — 2026-11-15', '2026-11-08 — 2026-11-14');
  const result = checkDocument({ filePath: tmpWeeklyHtml('2026-W46', html), dataDir: REPO_DATA });
  const hits = b19(result.findings);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].field, 'header');
  assert.match(hits[0].message, /期望 2026-11-09\.\.2026-11-15，实际 2026-11-08\.\.2026-11-14/);
  assert.equal(hits[0].line, 257);
});
