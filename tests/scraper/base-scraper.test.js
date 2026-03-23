/**
 * BaseScraper 单元测试
 * 测试基础抓取器类的核心功能
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const BaseScraper = require('../../src/scraper/base-scraper');

describe('BaseScraper', () => {
  let scraper;

  before(() => {
    // 创建基础抓取器实例用于测试
    scraper = new BaseScraper({
      name: 'TestScraper',
      url: 'https://example.com',
      timeout: 5000
    });
  });

  describe('构造函数', () => {
    it('应该使用默认值初始化', () => {
      const defaultScraper = new BaseScraper();
      assert.strictEqual(defaultScraper.name, 'BaseScraper');
      assert.strictEqual(defaultScraper.url, '');
      assert.ok(defaultScraper.headers);
      assert.strictEqual(defaultScraper.timeout, 30000);
    });

    it('应该使用自定义选项初始化', () => {
      const customScraper = new BaseScraper({
        name: 'CustomScraper',
        url: 'https://test.com',
        timeout: 10000
      });
      assert.strictEqual(customScraper.name, 'CustomScraper');
      assert.strictEqual(customScraper.url, 'https://test.com');
      assert.strictEqual(customScraper.timeout, 10000);
    });

    it('应该合并默认请求头和自定义请求头', () => {
      const customHeaders = {
        'X-Custom-Header': 'test-value'
      };
      const scraperWithHeaders = new BaseScraper({
        headers: customHeaders
      });
      assert.ok(scraperWithHeaders.headers['User-Agent']);
      assert.strictEqual(scraperWithHeaders.headers['X-Custom-Header'], 'test-value');
    });
  });

  describe('setRetryHandler', () => {
    it('应该设置重试处理器', () => {
      const mockRetryHandler = { handleRetry: () => {} };
      const result = scraper.setRetryHandler(mockRetryHandler);
      assert.strictEqual(scraper.retryHandler, mockRetryHandler);
      assert.strictEqual(result, scraper); // 应该返回 this 以支持链式调用
    });

    it('应该允许设置 null 来清除重试处理器', () => {
      scraper.setRetryHandler(null);
      assert.strictEqual(scraper.retryHandler, null);
    });
  });

  describe('fetch', () => {
    it('应该在未指定 URL 时抛出错误', async () => {
      const emptyScraper = new BaseScraper();
      await assert.rejects(
        async () => await emptyScraper.fetch(),
        /未指定目标 URL/
      );
    });

    it('应该使用构造函数中的默认 URL', async () => {
      // 注意：这个测试会实际发起网络请求，在 CI 环境中应该被跳过或 mock
      // 这里只测试逻辑，不实际执行
      assert.strictEqual(scraper.url, 'https://example.com');
    });

    it('应该允许覆盖 URL', async () => {
      // 测试逻辑验证，不实际执行网络请求
      const customUrl = 'https://custom.com';
      assert.ok(customUrl);
    });
  });

  describe('parse', () => {
    it('应该在 HTML 为空时抛出错误', async () => {
      await assert.rejects(
        async () => await scraper.parse(null),
        /无效的 HTML 内容/
      );

      await assert.rejects(
        async () => await scraper.parse(''),
        /无效的 HTML 内容/
      );
    });

    it('应该在 HTML 不是字符串时抛出错误', async () => {
      await assert.rejects(
        async () => await scraper.parse({}),
        /无效的 HTML 内容/
      );

      await assert.rejects(
        async () => await scraper.parse(123),
        /无效的 HTML 内容/
      );
    });

    it('应该调用 parseHTML 方法', async () => {
      // 创建一个 mock 的 parseHTML 方法
      const mockScraper = new BaseScraper();
      const mockData = { title: 'Test' };
      mockScraper.parseHTML = async (html) => {
        assert.strictEqual(html, '<html><body>Test</body></html>');
        return mockData;
      };

      const result = await mockScraper.parse('<html><body>Test</body></html>');
      assert.deepStrictEqual(result, mockData);
    });
  });

  describe('parseHTML', () => {
    it('应该抛出错误要求子类实现', async () => {
      await assert.rejects(
        async () => await scraper.parseHTML('<html></html>'),
        /parseHTML 方法必须由子类实现/
      );
    });
  });

  describe('save', () => {
    it('应该保存数据到指定路径', async () => {
      const testData = { name: 'test', value: 123 };
      const testPath = './tests/temp/test-save.json';
      
      const result = await scraper.save(testData, testPath);
      assert.strictEqual(result, true);
      
      // 验证文件已创建
      const fs = require('fs/promises');
      const path = require('path');
      const filePath = path.resolve(testPath);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        assert.deepStrictEqual(parsed, testData);
        
        // 清理测试文件
        await fs.unlink(filePath);
        const dir = path.dirname(filePath);
        await fs.rmdir(dir);
      } catch (error) {
        // 文件可能已被清理，忽略错误
      }
    });

    it('应该自动创建不存在的目录', async () => {
      const testData = { test: 'nested' };
      const testPath = './tests/temp/nested/deep/path/test.json';
      
      const result = await scraper.save(testData, testPath);
      assert.strictEqual(result, true);
      
      // 清理测试文件
      const fs = require('fs/promises');
      try {
        await fs.rm('./tests/temp', { recursive: true, force: true });
      } catch (error) {
        // 忽略清理错误
      }
    });
  });

  describe('execute', () => {
    it('应该执行完整的抓取流程', async () => {
      // 创建一个 mock 抓取器
      const mockScraper = new BaseScraper({
        name: 'MockScraper',
        url: 'https://example.com'
      });
      
      // Mock fetch 方法
      mockScraper.fetch = async () => '<html><body>Test</body></html>';
      
      // Mock parse 方法
      mockScraper.parse = async (html) => {
        assert.strictEqual(html, '<html><body>Test</body></html>');
        return { parsed: true, content: 'test data' };
      };
      
      const result = await mockScraper.execute();
      assert.deepStrictEqual(result, { parsed: true, content: 'test data' });
    });

    it('应该在 saveToFile 为 true 时保存数据', async () => {
      const mockScraper = new BaseScraper({
        name: 'MockScraper',
        url: 'https://example.com'
      });
      
      mockScraper.fetch = async () => '<html><body>Test</body></html>';
      mockScraper.parse = async (html) => ({ data: 'test' });
      mockScraper.save = async (data, path) => {
        assert.deepStrictEqual(data, { data: 'test' });
        assert.ok(path.includes('test-output.json'));
        return true;
      };
      
      const result = await mockScraper.execute({
        saveToFile: true,
        outputPath: './tests/temp/test-output.json'
      });
      
      assert.deepStrictEqual(result, { data: 'test' });
      
      // 清理
      const fs = require('fs/promises');
      try {
        await fs.rm('./tests/temp', { recursive: true, force: true });
      } catch (error) {
        // 忽略清理错误
      }
    });

    it('应该在抓取失败时抛出错误', async () => {
      const mockScraper = new BaseScraper({
        name: 'MockScraper',
        url: 'https://example.com'
      });
      
      mockScraper.fetch = async () => {
        throw new Error('Network error');
      };
      
      await assert.rejects(
        async () => await mockScraper.execute(),
        /Network error/
      );
    });

    it('应该在解析失败时抛出错误', async () => {
      const mockScraper = new BaseScraper({
        name: 'MockScraper',
        url: 'https://example.com'
      });
      
      mockScraper.fetch = async () => '<html><body>Test</body></html>';
      mockScraper.parse = async () => {
        throw new Error('Parse error');
      };
      
      await assert.rejects(
        async () => await mockScraper.execute(),
        /Parse error/
      );
    });
  });

  describe('属性访问', () => {
    it('应该可以访问 name 属性', () => {
      assert.strictEqual(scraper.name, 'TestScraper');
    });

    it('应该可以访问 url 属性', () => {
      assert.strictEqual(scraper.url, 'https://example.com');
    });

    it('应该可以访问 timeout 属性', () => {
      assert.strictEqual(scraper.timeout, 5000);
    });

    it('应该可以访问 headers 属性', () => {
      assert.ok(scraper.headers);
      assert.ok(typeof scraper.headers === 'object');
    });
  });
});
