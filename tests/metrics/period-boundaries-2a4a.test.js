#!/usr/bin/env node
'use strict';

// 2A+4A 验收补证：只测日历边界/真实加载器，不调用生成、LLM、通知或网络。
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { test } = require('node:test');

const REPO = path.resolve(__dirname, '../..');
const TIMEZONES = ['Asia/Singapore', 'UTC', 'America/Los_Angeles'];
const WEEKS = [
  { id: '2015-W53', dates: ['2015-12-28','2015-12-29','2015-12-30','2015-12-31','2016-01-01','2016-01-02','2016-01-03'] },
  { id: '2016-W01', dates: ['2016-01-04','2016-01-05','2016-01-06','2016-01-07','2016-01-08','2016-01-09','2016-01-10'] },
  { id: '2020-W53', dates: ['2020-12-28','2020-12-29','2020-12-30','2020-12-31','2021-01-01','2021-01-02','2021-01-03'] },
  { id: '2021-W01', dates: ['2021-01-04','2021-01-05','2021-01-06','2021-01-07','2021-01-08','2021-01-09','2021-01-10'] },
  { id: '2026-W53', dates: ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03'] },
  { id: '2027-W01', dates: ['2027-01-04','2027-01-05','2027-01-06','2027-01-07','2027-01-08','2027-01-09','2027-01-10'] },
];
const MONTHS = [
  { id: '2026-01', count: 31, end: '2026-01-31', next: '2026-02-01' },
  { id: '2026-02', count: 28, end: '2026-02-28', next: '2026-03-01' },
  { id: '2024-02', count: 29, end: '2024-02-29', next: '2024-03-01' },
  { id: '2000-02', count: 29, end: '2000-02-29', next: '2000-03-01' },
  { id: '2100-02', count: 28, end: '2100-02-28', next: '2100-03-01' },
  { id: '2026-04', count: 30, end: '2026-04-30', next: '2026-05-01' },
  { id: '2026-12', count: 31, end: '2026-12-31', next: '2027-01-01' },
];

function child(tz, script, extraEnv = {}) {
  const stdout = execFileSync(process.execPath, ['-e', script], {
    cwd: REPO,
    env: { ...process.env, TZ: tz, REPORT_NO_PUSH: '1', REPORT_NO_WIKI: '1', ...extraEnv },
    encoding: 'utf8',
  });
  const marker = stdout.lastIndexOf('RESULT=');
  assert.ok(marker >= 0, `child result marker: ${stdout}`);
  return JSON.parse(stdout.slice(marker + 7));
}

for (const tz of TIMEZONES) {
  test(`ISO 跨年 W53/W01：日历、真实 DataLoader、pipeline 周末一致 (${tz})`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'period-boundaries-'));
    try {
      const daily = path.join(root, 'briefs/daily');
      fs.mkdirSync(daily, { recursive: true });
      // 包括窗口两侧日，错读前/后一天时不能靠「文件不存在」侥幸通过。
      const history = require('../../src/metrics/history');
      const fixtureDates = new Set(WEEKS.flatMap(w => [
        history.addDays(w.dates[0], -1), ...w.dates,
        history.addDays(w.dates[6], 1),
      ]));
      for (const date of fixtureDates) {
        fs.writeFileSync(path.join(daily, `data-${date}.json`), JSON.stringify({
          date, projects: [{ fullName: `fixture/${date}`, todayStars: 1 }],
        }));
      }
      const rows = child(tz, `
        const history = require('./src/metrics/history');
        const { checkWeekWindow } = require('./src/metrics/week-window');
        const Loader = require('./src/loader/data-loader');
        const Pipeline = require('./src/scraper/report-pipeline');
        const pipeline = Object.create(Pipeline.prototype);
        (async () => {
          const rows = [];
          for (const w of ${JSON.stringify(WEEKS)}) {
            const isoLoaded = await new Loader().loadPastWeekDailyData(w.id);
            const dateLoaded = await new Loader().loadPastWeekDailyData(w.dates[0]);
            rows.push({
              id: w.id, dates: history.getISOWeekDates(w.id),
              dayWeekIds: w.dates.map(d => history.getISOWeekId(d)),
              isoLoaded: isoLoaded.map(d => d.date), indices: isoLoaded.map(d => d.dayIndex),
              dateLoaded: dateLoaded.map(d => d.date),
              endById: pipeline.calculateWeekEnd(w.id),
              endByDate: pipeline.calculateWeekEnd(w.dates[0]),
              checked: checkWeekWindow(w.id, isoLoaded.map(d => d.date)).ok,
              next: history.shiftISOWeek(w.id, 1),
            });
          }
          process.stdout.write('RESULT=' + JSON.stringify(rows));
        })().catch(e => { console.error(e); process.exitCode = 1; });
      `, { REPORT_DATA_DIR: root });
      for (const [i, w] of WEEKS.entries()) {
        const row = rows[i];
        assert.deepEqual(row.dates, w.dates, w.id);
        assert.deepEqual(row.dayWeekIds, Array(7).fill(w.id), `${w.id} ISO 年份不能等同公历年`);
        assert.deepEqual(row.isoLoaded, w.dates, `${w.id} ISO 参数加载`);
        assert.deepEqual(row.dateLoaded, w.dates, `${w.id} 日历日参数加载`);
        assert.deepEqual(row.indices, [0,1,2,3,4,5,6], w.id);
        assert.equal(row.endById, w.dates[6], w.id);
        assert.equal(row.endByDate, w.dates[6], w.id);
        assert.equal(row.checked, true, w.id);
        if (w.id.endsWith('W53')) assert.equal(row.next, WEEKS[i + 1].id, w.id);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test(`getMonthDates：平/闰年、世纪年、大小月、12→1 边界 (${tz})`, () => {
    const rows = child(tz, `
      const h = require('./src/metrics/history');
      process.stdout.write('RESULT=' + JSON.stringify(${JSON.stringify(MONTHS)}.map(m => {
        const dates = h.getMonthDates(m.id);
        return { id: m.id, dates, next: h.addDays(dates[dates.length - 1], 1) };
      })));
    `);
    for (const [i, m] of MONTHS.entries()) {
      const row = rows[i];
      assert.equal(row.dates.length, m.count, m.id);
      assert.equal(row.dates[0], `${m.id}-01`, `${m.id} 首日不能退到上月`);
      assert.equal(row.dates.at(-1), m.end, `${m.id} 末日不能漏掉`);
      assert.equal(new Set(row.dates).size, m.count, `${m.id} 无重复日`);
      assert.deepEqual(row.dates, Array.from({ length: m.count }, (_, j) => `${m.id}-${String(j + 1).padStart(2, '0')}`), `${m.id} 连续且无越月日`);
      assert.equal(row.next, m.next, `${m.id} 下月边界`);
    }
  });
}
