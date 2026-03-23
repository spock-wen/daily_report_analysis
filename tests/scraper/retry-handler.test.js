/**
 * RetryHandler 单元测试
 * 测试重试处理器的核心功能
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const RetryHandler = require('../../src/scraper/retry-handler');

describe('RetryHandler', () => {
  let retryHandler;
  let mockScraper;

  before(() => {
    // 创建重试处理器实例（使用较短的间隔以便测试）
    retryHandler = new RetryHandler({
      maxRetries: 3,
      retryInterval: 1000, // 1 秒用于测试
      name: 'TestRetryHandler'
    });

    // 创建 mock 抓取器
    mockScraper = {
      name: 'MockScraper',
      url: 'https://example.com',
      execute: async (options) => {
        return { success: true, data: 'test' };
      }
    };
  });

  describe('构造函数', () => {
    it('应该使用默认值初始化', () => {
      const defaultHandler = new RetryHandler();
      assert.strictEqual(defaultHandler.maxRetries, 12);
      assert.strictEqual(defaultHandler.retryInterval, 5 * 60 * 1000);
      assert.strictEqual(defaultHandler.name, 'RetryHandler');
    });

    it('应该使用自定义选项初始化', () => {
      const customHandler = new RetryHandler({
        maxRetries: 5,
        retryInterval: 30000,
        name: 'CustomHandler'
      });
      assert.strictEqual(customHandler.maxRetries, 5);
      assert.strictEqual(customHandler.retryInterval, 30000);
      assert.strictEqual(customHandler.name, 'CustomHandler');
    });

    it('应该从环境变量读取配置', () => {
      // 保存原始值
      const originalMaxRetries = process.env.MAX_RETRIES;
      const originalInterval = process.env.RETRY_INTERVAL_MS;

      // 设置环境变量
      process.env.MAX_RETRIES = '10';
      process.env.RETRY_INTERVAL_MS = '60000';

      const envHandler = new RetryHandler();
      assert.strictEqual(envHandler.maxRetries, 10);
      assert.strictEqual(envHandler.retryInterval, 60000);

      // 恢复原始值
      process.env.MAX_RETRIES = originalMaxRetries;
      process.env.RETRY_INTERVAL_MS = originalInterval;
    });

    it('应该优先使用选项而不是环境变量', () => {
      const originalMaxRetries = process.env.MAX_RETRIES;
      process.env.MAX_RETRIES = '10';

      const optionHandler = new RetryHandler({ maxRetries: 20 });
      assert.strictEqual(optionHandler.maxRetries, 20);

      process.env.MAX_RETRIES = originalMaxRetries;
    });
  });

  describe('generateKey', () => {
    it('应该生成唯一的键', () => {
      const key1 = retryHandler.generateKey('https://url1.com', 'Scraper1');
      const key2 = retryHandler.generateKey('https://url2.com', 'Scraper2');
      const key3 = retryHandler.generateKey('https://url1.com', 'Scraper1');

      assert.strictEqual(key1, 'Scraper1:https://url1.com');
      assert.strictEqual(key2, 'Scraper2:https://url2.com');
      assert.strictEqual(key1, key3);
    });

    it('应该处理特殊字符', () => {
      const key = retryHandler.generateKey('https://url.com/path?query=1', 'Scraper:Test');
      assert.strictEqual(key, 'Scraper:Test:https://url.com/path?query=1');
    });
  });

  describe('getRetryRecord', () => {
    it('应该为新的 URL 创建记录', () => {
      const record = retryHandler.getRetryRecord('https://new.com', 'TestScraper');
      assert.strictEqual(record.url, 'https://new.com');
      assert.strictEqual(record.scraperName, 'TestScraper');
      assert.strictEqual(record.attempts, 0);
      assert.strictEqual(record.lastAttempt, null);
      assert.strictEqual(record.lastError, null);
      assert.strictEqual(record.nextRetry, null);
      assert.strictEqual(record.success, false);
    });

    it('应该返回已存在的记录', () => {
      const url = 'https://existing.com';
      const name = 'ExistingScraper';
      
      // 第一次获取（创建记录）
      const record1 = retryHandler.getRetryRecord(url, name);
      
      // 修改记录
      record1.attempts = 5;
      
      // 第二次获取（应该返回同一记录）
      const record2 = retryHandler.getRetryRecord(url, name);
      
      assert.strictEqual(record2.attempts, 5);
    });
  });

  describe('handleRetry', () => {
    it('应该记录失败并安排重试', async () => {
      const testError = new Error('Test network error');
      
      const result = await retryHandler.handleRetry({
        scraper: mockScraper,
        url: 'https://retry-test.com',
        error: testError,
        options: { saveToFile: false }
      });

      assert.strictEqual(result, true); // 应该继续重试
      
      const record = retryHandler.getRetryStatus('https://retry-test.com', 'MockScraper');
      assert.strictEqual(record.attempts, 1);
      assert.strictEqual(record.lastError, 'Test network error');
      assert.ok(record.nextRetry);
    });

    it('应该在超过最大重试次数后返回 false', async () => {
      // 创建一个只有 1 次重试机会的处理器
      const limitedHandler = new RetryHandler({
        maxRetries: 1,
        retryInterval: 1000,
        name: 'LimitedHandler'
      });

      const error = new Error('Persistent error');
      
      // 第一次重试
      await limitedHandler.handleRetry({
        scraper: mockScraper,
        url: 'https://limited.com',
        error,
        options: {}
      });

      // 手动增加尝试次数到最大值
      const record = limitedHandler.getRetryStatus('https://limited.com', 'MockScraper');
      record.attempts = 1;

      // 第二次重试（应该失败）
      const result = await limitedHandler.handleRetry({
        scraper: mockScraper,
        url: 'https://limited.com',
        error,
        options: {}
      });

      assert.strictEqual(result, false); // 不应该继续重试
    });
  });

  describe('getAllRecords', () => {
    it('应该返回所有重试记录', () => {
      const records = retryHandler.getAllRecords();
      assert.ok(Array.isArray(records));
      assert.ok(records.length > 0);
    });
  });

  describe('getRetryStatus', () => {
    it('应该返回指定 URL 的状态', () => {
      const status = retryHandler.getRetryStatus('https://retry-test.com', 'MockScraper');
      assert.ok(status);
      assert.strictEqual(status.url, 'https://retry-test.com');
    });

    it('应该为不存在的记录返回 null', () => {
      const status = retryHandler.getRetryStatus('https://nonexistent.com', 'NonExistentScraper');
      assert.strictEqual(status, null);
    });
  });

  describe('clearRecords', () => {
    it('应该清除所有记录', () => {
      // 先添加一些记录
      retryHandler.getRetryRecord('https://clear1.com', 'ClearScraper');
      retryHandler.getRetryRecord('https://clear2.com', 'ClearScraper');
      
      const beforeCount = retryHandler.getAllRecords().length;
      assert.ok(beforeCount > 0);

      // 清除所有记录
      retryHandler.clearRecords();

      const afterCount = retryHandler.getAllRecords().length;
      assert.strictEqual(afterCount, 0);
    });
  });

  describe('clearRecord', () => {
    it('应该清除指定记录', () => {
      const url = 'https://single-clear.com';
      const name = 'SingleClearScraper';
      
      // 创建记录
      retryHandler.getRetryRecord(url, name);
      
      // 验证记录存在
      assert.ok(retryHandler.getRetryStatus(url, name));
      
      // 清除该记录
      const result = retryHandler.clearRecord(url, name);
      assert.strictEqual(result, true);
      
      // 验证记录已删除
      assert.strictEqual(retryHandler.getRetryStatus(url, name), null);
    });

    it('应该为不存在的记录返回 false', () => {
      const result = retryHandler.clearRecord('https://not-exist.com', 'NotExists');
      assert.strictEqual(result, false);
    });
  });

  describe('triggerRetry', () => {
    it('应该在没有记录时返回 false', async () => {
      const result = await retryHandler.triggerRetry(
        mockScraper,
        'https://no-record.com',
        {}
      );
      assert.strictEqual(result, false);
    });

    it('应该在记录已成功时返回 false', async () => {
      const url = 'https://already-success.com';
      const name = 'SuccessScraper';
      
      // 创建记录并标记为成功
      const record = retryHandler.getRetryRecord(url, name);
      record.success = true;
      
      const result = await retryHandler.triggerRetry(mockScraper, url, {});
      assert.strictEqual(result, false);
    });

    it('应该重置重试次数并触发重试', async () => {
      const url = 'https://manual-retry.com';
      const name = 'ManualRetryScraper';
      
      // 创建失败的记录
      const record = retryHandler.getRetryRecord(url, name);
      record.attempts = 3;
      record.success = false;
      record.lastError = 'Previous error';
      
      const result = await retryHandler.triggerRetry(mockScraper, url, {});
      assert.strictEqual(result, true);
      
      // 验证重试次数已重置
      const updatedRecord = retryHandler.getRetryStatus(url, name);
      assert.strictEqual(updatedRecord.attempts, 0);
    });
  });

  describe('重试记录管理', () => {
    it('应该正确跟踪多次重试', async () => {
      const testHandler = new RetryHandler({
        maxRetries: 5,
        retryInterval: 10, // 非常短的间隔用于测试
        name: 'TrackTestHandler'
      });

      const url = 'https://track.com';
      const error = new Error('Tracking error');

      // Mock scrape 方法以避免实际重试
      const mockScraperNoRetry = {
        name: 'MockScraperNoRetry',
        url,
        execute: async () => {
          throw error;
        }
      };

      // 模拟多次重试（不实际执行，只检查记录）
      for (let i = 1; i <= 3; i++) {
        await testHandler.handleRetry({
          scraper: mockScraperNoRetry,
          url,
          error,
          options: {}
        });

        const record = testHandler.getRetryStatus(url, 'MockScraperNoRetry');
        assert.strictEqual(record.attempts, i);
      }
    });
  });
});
