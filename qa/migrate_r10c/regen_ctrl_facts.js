'use strict';
// 一次性夹具脚本（不进仓库）：重算 ctrl_pass 的 facts.json，并同步 P8/P9/degraded_fail，
// 同时派生 facts_missing_fail（去掉 role=prev_new_face_rate 的那条）。
// 运行方式：node /home/box/shared/report-redesign/refactor/sample_r10/regen_ctrl_facts.js

process.env.REPORT_DATA_DIR = '/home/box/shared/report-redesign/refactor/sample_r9/data';

const fs = require('fs');
const path = require('path');

const REPO = '/workspace/report-refactor/daily_report_analysis';
const FIXTURES = '/home/box/shared/report-redesign/refactor/cases/fixtures_r10';
const CTRL = path.join(FIXTURES, 'ctrl_pass');
const MISSING = path.join(FIXTURES, 'facts_missing_fail');
const PERIOD = '2026-10-21';
const BRIEF_PATH = path.join(CTRL, `data-${PERIOD}.json`);
const INSIGHTS_NAME = `insights-${PERIOD}.json`;

const metrics = require(path.join(REPO, 'src/metrics'));
const { buildFacts } = require(path.join(REPO, 'src/facts/build-facts'));

const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
};

const factArray = (facts) => {
  if (Array.isArray(facts)) return facts;
  if (Array.isArray(facts && facts.items)) return facts.items;
  return [];
};

const brief = JSON.parse(fs.readFileSync(BRIEF_PATH, 'utf8'));
brief.date = PERIOD;
// 日报榜单按 todayStars 降序（对齐 scripts/generate-sample.js）。
brief.projects = (brief.projects || []).slice().sort((left, right) => {
  return (Number(right.todayStars) || 0) - (Number(left.todayStars) || 0);
});

const computed = metrics.enrichDailyBrief(brief, { date: PERIOD });
if (!computed) {
  console.error('无法计算期内指标（缺少 brief 或历史数据）');
  process.exit(1);
}

const facts = buildFacts({ level: 'daily', period: PERIOD, brief, metrics: computed });
if (!facts) {
  console.error('无法生成事实表');
  process.exit(1);
}

// 同步四个目录的 facts.json。
for (const dir of ['ctrl_pass', 'P8', 'P9', 'degraded_fail']) {
  writeJson(path.join(FIXTURES, dir, 'facts.json'), facts);
}

// 派生 facts_missing_fail：insights 复制自 ctrl_pass，facts 去掉 prev_new_face_rate。
writeJson(path.join(MISSING, INSIGHTS_NAME),
  JSON.parse(fs.readFileSync(path.join(CTRL, INSIGHTS_NAME), 'utf8')));

const missingFacts = Array.isArray(facts)
  ? factArray(facts).filter(item => !item || item.role !== 'prev_new_face_rate')
  : Object.assign({}, facts, {
    items: factArray(facts).filter(item => !item || item.role !== 'prev_new_face_rate'),
  });
writeJson(path.join(MISSING, 'facts.json'), missingFacts);

console.log('facts 重算完成');
