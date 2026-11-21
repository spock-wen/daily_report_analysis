#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { test } = require('node:test');
const { checkWeekWindow } = require('../../src/metrics/week-window');

const PIPELINE = path.resolve(__dirname, '../../src/scraper/report-pipeline.js');
const LOADER = path.resolve(__dirname, '../../src/loader/data-loader.js');

function writeDailyBriefs(dir, dates) {
  const daily = path.join(dir, 'briefs', 'daily');
  fs.mkdirSync(daily, { recursive: true });
  for (const date of dates) {
    fs.writeFileSync(
      path.join(daily, `data-${date}.json`),
      JSON.stringify({ date, projects: [{ fullName: `acme/${date}`, todayStars: 1 }] }),
    );
  }
}

function runInTz(tz, script, env = {}) {
  return execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, TZ: tz, ...env },
    encoding: 'utf8',
  });
}

test('loadPastWeekDailyData：Asia/Singapore / UTC / America/Los_Angeles 都读 W46 的 11-09..11-15，不混入 11-08', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'week-loader-'));
  try {
    const all = [];
    for (let day = 8; day <= 16; day += 1) {
      all.push(`2026-11-${String(day).padStart(2, '0')}`);
    }
    writeDailyBriefs(dir, all);
    const script = `
      const DataLoader = require(${JSON.stringify(LOADER)});
      new DataLoader().loadPastWeekDailyData('2026-W46')
        .then(days => process.stdout.write('DATES=' + days.map(d => d.date).join(',')));
    `;
    for (const tz of ['Asia/Singapore', 'UTC', 'America/Los_Angeles']) {
      const out = runInTz(tz, script, { REPORT_DATA_DIR: dir });
      const dates = /DATES=(\S*)/.exec(out)[1];
      assert.equal(
        dates,
        '2026-11-09,2026-11-10,2026-11-11,2026-11-12,2026-11-13,2026-11-14,2026-11-15',
        `TZ=${tz}`,
      );
      assert.equal(checkWeekWindow('2026-W46', dates.split(',')).ok, true);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('calculateWeekEnd：YYYY-Www 与 YYYY-MM-DD 在 UTC+8 都回到该周周日', () => {
  const script = `
    const RP = require(${JSON.stringify(PIPELINE)});
    const p = Object.create(RP.prototype);
    process.stdout.write([
      p.calculateWeekEnd('2026-W46'),
      p.calculateWeekEnd('2026-11-09'),
      p.calculateWeekEnd('2026-W44'),
      p.calculateWeekEnd('2026-W45'),
    ].join(','));
  `;
  for (const tz of ['Asia/Singapore', 'UTC', 'America/Los_Angeles']) {
    const out = runInTz(tz, script);
    assert.equal(out, '2026-11-15,2026-11-15,2026-11-01,2026-11-08', `TZ=${tz}`);
  }
});

test('负例：旧算法（本地 Date + toISOString）在 Asia/Singapore 把 W46 读成 11-08..11-14，检查必拦', () => {
  const script = `
    function oldDates(weekStart) {
      const parts = weekStart.split('-W');
      const year = parseInt(parts[0], 10);
      const week = parseInt(parts[1], 10);
      const jan4 = new Date(year, 0, 4);
      const dayOfWeek = jan4.getDay() || 7;
      const firstMonday = new Date(jan4);
      firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
      const startDate = new Date(firstMonday);
      startDate.setDate(firstMonday.getDate() + (week - 1) * 7);
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        dates.push(currentDate.toISOString().split('T')[0]);
      }
      return dates.join(',');
    }
    process.stdout.write(oldDates('2026-W46'));
  `;
  const dates = runInTz('Asia/Singapore', script).trim();
  assert.equal(dates, '2026-11-08,2026-11-09,2026-11-10,2026-11-11,2026-11-12,2026-11-13,2026-11-14');
  const result = checkWeekWindow('2026-W46', dates.split(','));
  assert.equal(result.ok, false, '错窗口必须被拦');
});

test('regenerate.loadWeeklyData 日期函数：getISOWeekDates 在 UTC+8 不前移', () => {
  const script = `
    const history = require(${JSON.stringify(path.resolve(__dirname, '../../src/metrics/history.js'))});
    const today = history.getScrapedDate(new Date('2026-11-16T00:00:00+08:00'));
    const dates = history.getISOWeekDates('2026-W46').filter(d => !today || d <= today);
    process.stdout.write(dates.join(','));
  `;
  for (const tz of ['Asia/Singapore', 'UTC', 'America/Los_Angeles']) {
    const out = runInTz(tz, script);
    assert.equal(
      out,
      '2026-11-09,2026-11-10,2026-11-11,2026-11-12,2026-11-13,2026-11-14,2026-11-15',
      `TZ=${tz}`,
    );
  }
});
