const assert = require('assert');
const DataAggregator = require('../../src/aggregator/data-aggregator');

describe('DataAggregator', () => {
  let aggregator;

  before(() => {
    aggregator = new DataAggregator();
  });

  describe('loadDailyData', () => {
    it('应加载指定日期的 Daily 数据', async () => {
      const data = await aggregator.loadDailyData('2026-03-14');

      assert.ok(data, '数据不应为空');
      assert.ok(Array.isArray(data.trending_repos), '应有 trending_repos 数组');
      assert.equal(data.date, '2026-03-14', '日期应匹配');
    });

    it('应返回 null 当文件不存在时', async () => {
      const data = await aggregator.loadDailyData('2000-01-01');

      assert.equal(data, null, '文件不存在应返回 null');
    });
  });

  describe('loadWeeklyData', () => {
    it('应加载指定周的周榜数据', async () => {
      const data = await aggregator.loadWeeklyData('2026-W11');

      assert.ok(data, '数据不应为空');
      assert.ok(Array.isArray(data.trending_repos), '应有 trending_repos 数组');
      assert.equal(data.week, '2026-W11', '周 ID 应匹配');
    });

    it('应返回 null 当文件不存在时', async () => {
      const data = await aggregator.loadWeeklyData('2000-W01');

      assert.equal(data, null, '文件不存在应返回 null');
    });
  });

  describe('getWeekRange', () => {
    it('应正确计算周范围', () => {
      const range = aggregator.getWeekRange('2026-W11');

      assert.ok(range.start, '应有开始日期');
      assert.ok(range.end, '应有结束日期');
      assert.equal(range.start, '2026-03-09', '周开始日期应为周一');
      assert.equal(range.end, '2026-03-15', '周结束日期应为周日');
    });
  });

  describe('parseTodayStars', () => {
    it('应解析数字格式', () => {
      assert.equal(aggregator.parseTodayStars(1234), 1234);
    });

    it('应解析字符串格式 +17,623', () => {
      assert.equal(aggregator.parseTodayStars('+17,623'), 17623);
    });

    it('应解析不带 + 号的字符串', () => {
      assert.equal(aggregator.parseTodayStars('1234'), 1234);
    });

    it('应处理无效输入', () => {
      assert.equal(aggregator.parseTodayStars(''), 0);
      assert.equal(aggregator.parseTodayStars(null), 0);
    });
  });
});
