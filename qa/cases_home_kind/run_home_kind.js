'use strict';

/**
 * r11d：首页卡 kind 相对日历（本周/上周、本月/上月）。
 * PASS：正确标签；FAIL：旧硬编码「本周/本月」对过期期次不得相等（回归哨）。
 */
const assert = require('assert');
const { homePeriodKind } = require('../../src/generator/report-nav');

const NOW = new Date('2026-10-23T12:00:00+08:00'); // Asia/Singapore → ISO W43 / 2026-10

const cases = [
  {
    id: 'HOME-KIND-W-P01',
    expect: 'PASS',
    run() {
      assert.strictEqual(homePeriodKind('weekly', '2026-W43', NOW), '本周 · 周报');
      assert.strictEqual(homePeriodKind('weekly', '2026-W42', NOW), '上周 · 周报');
    },
  },
  {
    id: 'HOME-KIND-M-P01',
    expect: 'PASS',
    run() {
      assert.strictEqual(homePeriodKind('monthly', '2026-10', NOW), '本月 · 月报');
      assert.strictEqual(homePeriodKind('monthly', '2026-09', NOW), '上月 · 月报');
    },
  },
  {
    id: 'HOME-KIND-W-F01',
    expect: 'FAIL',
    run() {
      // 旧逻辑写死「本周 · 周报」；对 W42 在 W43 日历下必须与正确值不等
      const hardcoded = '本周 · 周报';
      const correct = homePeriodKind('weekly', '2026-W42', NOW);
      assert.notStrictEqual(hardcoded, correct, '过期周不得仍标本周');
      assert.strictEqual(correct, '上周 · 周报');
    },
  },
  {
    id: 'HOME-KIND-M-F01',
    expect: 'FAIL',
    run() {
      const hardcoded = '本月 · 月报';
      const correct = homePeriodKind('monthly', '2026-09', NOW);
      assert.notStrictEqual(hardcoded, correct, '过期月不得仍标本月');
      assert.strictEqual(correct, '上月 · 月报');
    },
  },
];

let failed = 0;
for (const c of cases) {
  let ok = false;
  let err = null;
  try {
    c.run();
    ok = true;
  } catch (e) {
    err = e;
  }
  console.log(`${ok ? 'OK' : 'BAD'} ${c.id} expect=${c.expect}`);
  if (!ok) {
    failed += 1;
    if (err) console.log('  -', err.message);
  }
}
process.exit(failed ? 1 : 0);
