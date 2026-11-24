'use strict';

// 用例运行器（evaluateCase）不得隐式读取仓库 data/ 下的渲染记录与事实表。
// 背景：c5d14d5 自动同步把 render_map-weekly-2026-W42.json、facts-weekly-2026-W42.json
// 放进 data/ 后，没声明 render_map/facts 的 W42 用例被悄悄切到 r3，A2/D2 不再执行。
// 生产路径（checkReport / checkDocument / runContentGate）仍按原样读取仓库 data/。

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateCase, checkReport, checkDocument } = require('../../src/checker');

const REPO = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(REPO, 'data');
const W42_RENDER = path.join(DATA_DIR, 'render', 'render_map-weekly-2026-W42.json');
const W42_FACTS = path.join(DATA_DIR, 'facts', 'facts-weekly-2026-W42.json');
const RENDER_RE = /渲染记录/;

// 前提：仓库 data/ 里确实有同周 r3 文件，否则本测试证明不了「不隐式读取」。
test('前提：仓库 data/ 有 W42 渲染记录与事实表', () => {
  assert.ok(fs.existsSync(W42_RENDER), `缺少 ${W42_RENDER}`);
  assert.ok(fs.existsSync(W42_FACTS), `缺少 ${W42_FACTS}`);
});

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eval-case-implicit-'));
}

function writeInsights(root, dir, detailed) {
  const full = path.join(root, dir);
  fs.mkdirSync(full, { recursive: true });
  const file = path.join(full, 'insights-2026-W42.json');
  fs.writeFileSync(file, `${JSON.stringify({ weeklyTheme: { detailed } }, null, 2)}\n`, 'utf8');
  return path.relative(root, file);
}

function a2Case(root, extra = {}) {
  return {
    id: 'T-A2',
    rule_id: 'A2',
    expect: 'FAIL',
    file: writeInsights(root, 'a2', 'morluto/rea 本周新增 321942 星。'),
    line: null,
    expected_hit_fields: ['weeklyTheme.detailed'],
    ...extra,
  };
}

function run(caseItem, root) {
  return evaluateCase(caseItem, { casesRoot: root, dataDir: DATA_DIR });
}

function rules(result) {
  return new Set(result.findings.map(finding => finding.rule_id));
}

// 1. 不声明 render_map/facts：即使 data/ 有同周文件，也不进 r3
test('不声明 render_map/facts：A2 用例仍按旧版规则命中', () => {
  const root = makeRoot();
  const result = run(a2Case(root), root);
  assert.equal(result.error, undefined);
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.ok(result.matched.some(f => f.rule_id === 'A2' && f.field === 'weeklyTheme.detailed'));
  assert.ok(!result.findings.some(f => RENDER_RE.test(f.message)), '不应出现 r3 渲染记录类 finding');
});

test('不声明 render_map/facts：D2 用例仍按旧版规则命中', () => {
  const root = makeRoot();
  const result = run({
    id: 'T-D2',
    rule_id: 'D2',
    expect: 'FAIL',
    file: writeInsights(root, 'd2', 'storytelling/artcraft 本周值得关注。'),
    line: null,
    expected_hit_fields: ['weeklyTheme.detailed'],
  }, root);
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.ok(result.matched.some(f => f.rule_id === 'D2'));
  assert.ok(!rules(result).has('B5'), '不应出现 r3 B5 p: 渲染记录 finding');
});

// 2. 明确声明：仍进 r3
test('声明 render_map + facts：进 r3，A2 不跑、r3 版 B4 跑', () => {
  const root = makeRoot();
  const result = run(a2Case(root, { render_map: W42_RENDER, facts: W42_FACTS }), root);
  assert.equal(result.error, undefined);
  assert.ok(!rules(result).has('A2'));
  assert.ok(result.findings.some(f => f.rule_id === 'B4' && /321942/.test(f.message) && RENDER_RE.test(f.message)));
});

test('只声明 facts：同样进 r3', () => {
  const root = makeRoot();
  const result = run(a2Case(root, { facts: W42_FACTS }), root);
  assert.equal(result.error, undefined);
  assert.ok(!rules(result).has('A2'));
});

test('声明 r3:true：同样进 r3', () => {
  const root = makeRoot();
  const result = run(a2Case(root, { r3: true }), root);
  assert.equal(result.error, undefined);
  assert.ok(!rules(result).has('A2'));
});

test('声明的渲染记录确实被使用（而不是仓库那份）', () => {
  const root = makeRoot();
  const own = path.join(root, 'own-render.json');
  fs.writeFileSync(own, JSON.stringify({ entries: [{ path: 'weeklyTheme.detailed', placeholder: '{{f1}}', text: '321942' }] }));
  const withOwn = run(a2Case(root, { render_map: own }), root);
  assert.equal(withOwn.error, undefined);
  assert.ok(!withOwn.findings.some(f => f.rule_id === 'B4' && /321942/.test(f.message)), '自带记录含 321942，不应再报');

  const empty = path.join(root, 'empty-render.json');
  fs.writeFileSync(empty, JSON.stringify({ entries: [] }));
  const withEmpty = run(a2Case(root, { render_map: empty }), root);
  assert.ok(withEmpty.findings.some(f => f.rule_id === 'B4' && /321942/.test(f.message)));
});

// 3. 放错位置负例：不得悄悄回落到仓库 data/
test('render_map 指向不存在的文件：用例报错，不回落', () => {
  const root = makeRoot();
  const result = run(a2Case(root, { render_map: path.join(root, 'no-such-render.json') }), root);
  assert.equal(result.ok, false);
  assert.match(result.error, /用例引用文件不存在/);
  assert.deepEqual(result.findings, []);
});

test('facts 指向不存在的文件：用例报错，不回落', () => {
  const root = makeRoot();
  const result = run(a2Case(root, { facts: path.join(root, 'no-such-facts.json') }), root);
  assert.equal(result.ok, false);
  assert.match(result.error, /用例引用文件不存在/);
});

test('render_map 指向格式不对的文件（例如事实表）：用例报错，不回落到仓库渲染记录', () => {
  const root = makeRoot();
  const result = run(a2Case(root, { render_map: W42_FACTS }), root);
  assert.equal(result.ok, false);
  assert.match(String(result.error), /渲染记录格式不对/);
  assert.deepEqual(result.findings, []);
});

// 4. 生产路径不变：仍隐式读仓库 data/
function signature(result) {
  return result.findings.map(f => [f.rule_id, f.file, f.field, f.line, f.quote, f.message]);
}

test('checkReport（runContentGate 内部同一调用）仍隐式读仓库 data/：结果等同显式传入仓库文件', () => {
  const implicit = checkReport({ level: 'weekly', period: '2026-W42', dataDir: DATA_DIR });
  const explicit = checkReport({
    level: 'weekly',
    period: '2026-W42',
    dataDir: DATA_DIR,
    renderMap: JSON.parse(fs.readFileSync(W42_RENDER, 'utf8')),
    facts: JSON.parse(fs.readFileSync(W42_FACTS, 'utf8')),
  });
  assert.deepEqual(signature(implicit), signature(explicit));
  assert.ok(!implicit.findings.some(f => f.rule_id === 'A2' || f.rule_id === 'D2'), '生产 W42 应走 r3');
});

test('checkDocument 默认仍隐式读仓库 data/（与用例运行器不同）', () => {
  const root = makeRoot();
  const file = path.join(root, writeInsights(root, 'doc', 'morluto/rea 本周新增 321942 星。'));
  const result = checkDocument({ filePath: file, dataDir: DATA_DIR });
  assert.ok(!result.findings.some(f => f.rule_id === 'A2'));
  assert.ok(result.findings.some(f => f.rule_id === 'B4' && /321942/.test(f.message) && RENDER_RE.test(f.message)));
});
