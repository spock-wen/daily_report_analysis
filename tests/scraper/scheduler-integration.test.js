/**
 * ScraperScheduler 集成测试
 * 测试定时任务调度器的完整功能
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { 
  ScraperScheduler, 
  RetryHandler,
  DailyScraper, 
  WeeklyScraper, 
  MonthlyScraper 
} = require('../../src/scraper');

describe('ScraperScheduler 集成测试', () => {
  let scheduler;
  let retryHandler;
  let scrapers;

  before(() => {
    // 创建重试处理器
    retryHandler = new RetryHandler({
      maxRetries: 3,
      retryInterval: 1000,
      name: 'TestRetryHandler'
    });

    // 创建抓取器实例（使用 mock 数据，不实际请求）
    scrapers = {
      daily: new DailyScraper(),
      weekly: new WeeklyScraper(),
      monthly: new MonthlyScraper()
    };

    // Mock execute 方法以避免实际网络请求
    Object.values(scrapers).forEach(scraper => {
      scraper.execute = async (options) => {
        return {
          success: true,
          type: scraper.getType(),
          count: 5,
          repositories: [
            { name: 'test-repo', stars: 100, url: 'https://github.com/test/repo' }
          ],
          scrapedAt: new Date().toISOString()
        };
      };
    });

    // 创建调度器（禁用自动启动）
    scheduler = new ScraperScheduler({
      scrapers,
      retryHandler,
      enabled: true
    });
  });

  after(() => {
    // 清理资源
    if (scheduler) {
      scheduler.destroy();
    }
  });

  describe('调度器初始化', () => {
    it('应该正确初始化调度器', () => {
      assert.ok(scheduler);
      assert.ok(scheduler.scrapers);
      assert.ok(scheduler.retryHandler);
      assert.strictEqual(scheduler.enabled, true);
      assert.strictEqual(scheduler.isRunning, false);
    });

    it('应该包含所有类型的抓取器', () => {
      assert.ok(scheduler.scrapers.daily);
      assert.ok(scheduler.scrapers.weekly);
      assert.ok(scheduler.scrapers.monthly);
    });
  });

  describe('回调函数注册', () => {
    it('应该注册抓取成功回调', () => {
      let callbackCalled = false;
      let callbackData = null;
      let callbackType = null;

      scheduler.onScraperSuccess((data, type) => {
        callbackCalled = true;
        callbackData = data;
        callbackType = type;
      });

      assert.ok(scheduler.onScraperSuccessCallback);
      
      // 手动触发回调测试
      scheduler.onScraperSuccessCallback({ test: 'data' }, 'daily');
      assert.strictEqual(callbackCalled, true);
      assert.strictEqual(callbackType, 'daily');
    });

    it('应该注册抓取失败回调', () => {
      let callbackCalled = false;
      let callbackError = null;
      let callbackType = null;

      scheduler.onScraperFailure((error, type) => {
        callbackCalled = true;
        callbackError = error;
        callbackType = type;
      });

      assert.ok(scheduler.onScraperFailureCallback);
      
      // 手动触发回调测试
      const testError = new Error('Test error');
      scheduler.onScraperFailureCallback(testError, 'weekly');
      assert.strictEqual(callbackCalled, true);
      assert.strictEqual(callbackType, 'weekly');
      assert.strictEqual(callbackError.message, 'Test error');
    });

    it('应该注册报告生成触发器', () => {
      let callbackCalled = false;
      let callbackType = null;
      let callbackData = null;

      scheduler.triggerReportGeneration((type, data) => {
        callbackCalled = true;
        callbackType = type;
        callbackData = data;
      });

      assert.ok(scheduler.triggerReportGenerationCallback);
      
      // 手动触发回调测试
      scheduler.triggerReportGenerationCallback('monthly', { data: 'test' });
      assert.strictEqual(callbackCalled, true);
      assert.strictEqual(callbackType, 'monthly');
    });
  });

  describe('调度器启动和停止', () => {
    it('应该成功启动调度器', () => {
      const result = scheduler.start();
      assert.strictEqual(result, true);
      assert.strictEqual(scheduler.isRunning, true);
    });

    it('应该在已运行时拒绝重复启动', () => {
      const result = scheduler.start();
      assert.strictEqual(result, false);
    });

    it('应该返回正确的状态信息', () => {
      const status = scheduler.getStatus();
      assert.strictEqual(status.enabled, true);
      assert.strictEqual(status.isRunning, true);
      assert.strictEqual(status.totalTasks, 3);
      assert.ok(status.tasks.daily);
      assert.ok(status.tasks.weekly);
      assert.ok(status.tasks.monthly);
    });

    it('应该成功停止调度器', () => {
      const result = scheduler.stop();
      assert.strictEqual(scheduler.isRunning, false);
    });

    it('应该在禁用状态下拒绝启动', () => {
      const disabledScheduler = new ScraperScheduler({
        scrapers,
        enabled: false
      });

      const result = disabledScheduler.start();
      assert.strictEqual(result, false);
      
      disabledScheduler.destroy();
    });
  });

  describe('手动触发任务', () => {
    before(() => {
      // 确保调度器处于停止状态
      if (scheduler.isRunning) {
        scheduler.stop();
      }
    });

    it('应该手动触发日报任务', async () => {
      const result = await scheduler.triggerManual('daily');
      assert.ok(result);
      assert.strictEqual(result.type, 'daily');
      assert.strictEqual(result.success, true);
    });

    it('应该手动触发周报任务', async () => {
      const result = await scheduler.triggerManual('weekly');
      assert.ok(result);
      assert.strictEqual(result.type, 'weekly');
      assert.strictEqual(result.success, true);
    });

    it('应该手动触发月报任务', async () => {
      const result = await scheduler.triggerManual('monthly');
      assert.ok(result);
      assert.strictEqual(result.type, 'monthly');
      assert.strictEqual(result.success, true);
    });

    it('应该在类型不存在时返回 null', async () => {
      const result = await scheduler.triggerManual('invalid');
      assert.strictEqual(result, null);
    });
  });

  describe('executeAll 方法', () => {
    it('应该执行所有抓取任务', async () => {
      const results = await scheduler.executeAll();
      
      assert.ok(results);
      assert.ok(results.daily);
      assert.ok(results.weekly);
      assert.ok(results.monthly);
      
      assert.strictEqual(results.daily.success, true);
      assert.strictEqual(results.weekly.success, true);
      assert.strictEqual(results.monthly.success, true);
    });

    it('应该返回每个任务的执行结果', async () => {
      const results = await scheduler.executeAll();
      
      for (const [type, result] of Object.entries(results)) {
        assert.ok(result);
        assert.strictEqual(typeof result, 'object');
        assert.ok('success' in result);
      }
    });
  });

  describe('executeScraper 方法', () => {
    it('应该执行单个抓取器并返回数据', async () => {
      const result = await scheduler.executeScraper('daily', scrapers.daily);
      
      assert.ok(result);
      assert.strictEqual(result.type, 'daily');
      assert.ok(result.repositories);
      assert.ok(result.scrapedAt);
    });

    it('应该在抓取失败时返回 null', async () => {
      // 创建一个会失败的抓取器（不设置重试，避免长时间运行）
      const failingScraper = {
        name: 'FailingScraper',
        url: 'https://example.com',
        execute: async () => {
          throw new Error('Simulated failure');
        }
      };

      // 创建一个没有重试处理器的调度器
      const noRetryScheduler = new ScraperScheduler({
        scrapers: { failing: failingScraper },
        enabled: true
      });

      const result = await noRetryScheduler.executeScraper('failing', failingScraper);
      assert.strictEqual(result, null);
      
      noRetryScheduler.destroy();
    });

    it('应该在抓取返回空数据时返回 null', async () => {
      const emptyScraper = {
        name: 'EmptyScraper',
        url: 'https://example.com',
        execute: async () => null
      };

      const result = await scheduler.executeScraper('empty', emptyScraper);
      assert.strictEqual(result, null);
    });
  });

  describe('错误处理', () => {
    it('应该在缺少抓取器时优雅处理', async () => {
      const emptyScheduler = new ScraperScheduler({
        scrapers: {},
        enabled: true
      });

      const result = await emptyScheduler.triggerManual('daily');
      assert.strictEqual(result, null);
      
      emptyScheduler.destroy();
    });

    it('应该在没有重试处理器时继续执行', async () => {
      const noRetryScheduler = new ScraperScheduler({
        scrapers,
        enabled: true
      });

      // 创建一个会失败的抓取器
      const failingScraper = {
        name: 'FailingScraper',
        url: 'https://example.com',
        execute: async () => {
          throw new Error('No retry handler test');
        }
      };

      const result = await noRetryScheduler.executeScraper('failing', failingScraper);
      assert.strictEqual(result, null);
      
      noRetryScheduler.destroy();
    });
  });

  describe('调度器销毁', () => {
    it('应该正确销毁调度器并释放资源', () => {
      const testScheduler = new ScraperScheduler({
        scrapers,
        enabled: true
      });

      testScheduler.start();
      testScheduler.onScraperSuccess(() => {});
      testScheduler.onScraperFailure(() => {});
      testScheduler.triggerReportGeneration(() => {});

      testScheduler.destroy();

      assert.strictEqual(testScheduler.isRunning, false);
      assert.strictEqual(Object.keys(testScheduler.scrapers).length, 0);
      assert.strictEqual(testScheduler.retryHandler, null);
      assert.strictEqual(testScheduler.onScraperSuccessCallback, null);
      assert.strictEqual(testScheduler.onScraperFailureCallback, null);
      assert.strictEqual(testScheduler.triggerReportGenerationCallback, null);
    });
  });
});
