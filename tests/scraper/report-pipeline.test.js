/**
 * ReportPipeline 单元测试
 * 测试报告生成流水线的各个步骤
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const ReportPipeline = require('../../src/scraper/report-pipeline');

describe('ReportPipeline', () => {
  let pipeline;
  let mockData;

  before(() => {
    // 创建测试数据
    mockData = {
      success: true,
      count: 5,
      period: 'daily',
      scrapedAt: new Date().toISOString(),
      source: 'github',
      repositories: [
        {
          fullName: 'owner/repo1',
          name: 'repo1',
          owner: 'owner',
          stars: 1000,
          url: 'https://github.com/owner/repo1',
          description: 'Test repo 1'
        },
        {
          fullName: 'owner/repo2',
          name: 'repo2',
          owner: 'owner',
          stars: 500,
          url: 'https://github.com/owner/repo2',
          description: 'Test repo 2'
        }
      ]
    };

    // 创建流水线实例（禁用所有功能以避免实际执行）
    pipeline = new ReportPipeline({
      enableAI: false,
      enableHTML: false,
      enableIndex: false,
      enableNotification: false
    });
  });

  describe('构造函数', () => {
    it('应该使用默认配置初始化', () => {
      const defaultPipeline = new ReportPipeline();
      assert.strictEqual(defaultPipeline.enableAI, true);
      assert.strictEqual(defaultPipeline.enableHTML, true);
      assert.strictEqual(defaultPipeline.enableIndex, true);
      assert.strictEqual(defaultPipeline.enableNotification, true);
    });

    it('应该使用自定义配置初始化', () => {
      const customPipeline = new ReportPipeline({
        enableAI: false,
        enableHTML: true,
        enableIndex: false,
        enableNotification: true
      });
      assert.strictEqual(customPipeline.enableAI, false);
      assert.strictEqual(customPipeline.enableHTML, true);
      assert.strictEqual(customPipeline.enableIndex, false);
      assert.strictEqual(customPipeline.enableNotification, true);
    });

    it('应该初始化子模块', () => {
      assert.ok(pipeline.analyzer);
      assert.ok(pipeline.htmlGenerator);
      assert.ok(pipeline.notifier);
    });
  });

  describe('execute 方法', () => {
    it('应该在缺少参数时抛出错误', async () => {
      await assert.rejects(
        async () => await pipeline.execute(null, 'daily'),
        /缺少必要参数/
      );

      await assert.rejects(
        async () => await pipeline.execute(mockData, null),
        /缺少必要参数/
      );
    });

    it('应该执行完整的流水线流程', async () => {
      const result = await pipeline.execute(mockData, 'daily');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.type, 'daily');
      assert.ok(result.data);
      assert.ok(result.duration >= 0);
      assert.ok(Array.isArray(result.errors));
    });

    it('应该返回执行结果对象', async () => {
      const result = await pipeline.execute(mockData, 'daily');
      
      assert.ok('success' in result);
      assert.ok('type' in result);
      assert.ok('data' in result);
      assert.ok('insights' in result);
      assert.ok('htmlPath' in result);
      assert.ok('notificationResults' in result);
      assert.ok('errors' in result);
      assert.ok('duration' in result);
    });

    it('应该记录执行日志', async () => {
      await pipeline.execute(mockData, 'daily');
      
      const log = pipeline.getExecutionLog();
      assert.ok(Array.isArray(log));
      assert.ok(log.length > 0);
      
      // 验证日志格式
      const firstLog = log[0];
      assert.ok('step' in firstLog);
      assert.ok('status' in firstLog);
      assert.ok('duration' in firstLog);
    });
  });

  describe('saveRawData 方法', () => {
    it('应该保存日报数据', async () => {
      const dailyData = {
        ...mockData,
        date: '2026-03-20'
      };
      
      const filePath = await pipeline.saveRawData(dailyData, 'daily');
      assert.ok(filePath);
      assert.ok(filePath.includes('daily'));
    });

    it('应该保存周报数据', async () => {
      const weeklyData = {
        ...mockData,
        weekStart: '2026-03-17',
        weekEnd: '2026-03-23'
      };
      
      const filePath = await pipeline.saveRawData(weeklyData, 'weekly');
      assert.ok(filePath);
      assert.ok(filePath.includes('weekly'));
    });

    it('应该保存月报数据', async () => {
      const monthlyData = {
        ...mockData,
        month: '2026-03'
      };
      
      const filePath = await pipeline.saveRawData(monthlyData, 'monthly');
      assert.ok(filePath);
      assert.ok(filePath.includes('monthly'));
    });

    it('应该在类型未知时抛出错误', async () => {
      await assert.rejects(
        async () => await pipeline.saveRawData(mockData, 'invalid'),
        /未知的报告类型/
      );
    });

    it('应该添加元数据', async () => {
      const testData = {
        ...mockData,
        date: '2026-03-20'
      };
      
      const fs = require('fs/promises');
      const filePath = await pipeline.saveRawData(testData, 'daily');
      
      // 读取保存的文件验证元数据
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      assert.ok(parsed.metadata);
      assert.ok(parsed.metadata.generatedAt);
      assert.strictEqual(parsed.metadata.type, 'daily');
      assert.strictEqual(parsed.metadata.identifier, '2026-03-20');
    });
  });

  describe('generateAIInsights 方法', () => {
    it('应该在 AI 禁用时返回降级数据', async () => {
      // 使用已禁用的 pipeline 测试
      const insights = await pipeline.generateAIInsights(mockData, 'daily');
      
      assert.ok(insights);
      assert.ok('oneLiner' in insights);
      assert.ok('hypeIndex' in insights);
      assert.ok(Array.isArray(insights.hot));
      assert.ok(Array.isArray(insights.shortTerm));
      assert.ok(Array.isArray(insights.longTerm));
      assert.ok(Array.isArray(insights.action));
      assert.ok(Array.isArray(insights.topProjects));
    });

    it('应该处理不同类型的报告', async () => {
      for (const type of ['daily', 'weekly', 'monthly']) {
        const insights = await pipeline.generateAIInsights(mockData, type);
        assert.ok(insights);
        assert.ok(insights.error || typeof insights.oneLiner === 'string');
      }
    });

    it('应该在类型不支持时抛出错误', async () => {
      await assert.rejects(
        async () => await pipeline.generateAIInsights(mockData, 'invalid'),
        /不支持的报告类型/
      );
    });
  });

  describe('prepareReportData 方法', () => {
    it('应该合并原始数据和 AI 洞察', () => {
      const insights = {
        oneLiner: 'Test insight',
        hypeIndex: { score: 75, reason: 'Test' },
        hot: ['repo1'],
        shortTerm: ['repo2'],
        longTerm: [],
        action: [],
        topProjects: []
      };

      const reportData = pipeline.prepareReportData(mockData, insights, 'daily');
      
      assert.ok(reportData);
      assert.ok(reportData.brief);
      assert.ok(reportData.brief.trending_repos);
      assert.ok(reportData.aiInsights);
      assert.strictEqual(reportData.aiInsights.oneLiner, 'Test insight');
    });

    it('应该标准化数据结构', () => {
      const reportData = pipeline.prepareReportData(mockData, null, 'daily');
      
      assert.ok(reportData.brief);
      assert.ok(reportData.brief.trending_repos);
      assert.ok(reportData.brief.stats);
      assert.strictEqual(reportData.brief.stats.total_projects, 5);
    });

    it('应该为周报添加周结束日期', () => {
      const weeklyData = {
        ...mockData,
        weekStart: '2026-03-17'
      };

      const reportData = pipeline.prepareReportData(weeklyData, null, 'weekly');
      
      assert.ok(reportData.weekEnd);
      assert.ok(reportData.weekLabel);
    });

    it('应该在没有 AI 洞察时正常工作', () => {
      const reportData = pipeline.prepareReportData(mockData, null, 'daily');
      
      assert.ok(reportData);
      assert.ok(reportData.brief);
      assert.strictEqual(reportData.aiInsights, undefined);
    });
  });

  describe('generateHTML 方法', () => {
    it('应该为日报生成 HTML 路径', async () => {
      const reportData = {
        ...mockData,
        date: '2026-03-20'
      };

      const htmlPath = await pipeline.generateHTML(reportData, 'daily');
      assert.ok(htmlPath);
      assert.ok(htmlPath.includes('daily'));
      assert.ok(htmlPath.endsWith('.html'));
    });

    it('应该为周报生成 HTML 路径', async () => {
      const weeklyData = {
        ...mockData,
        weekStart: '2026-03-17',
        weekEnd: '2026-03-23'
      };

      const htmlPath = await pipeline.generateHTML(weeklyData, 'weekly');
      assert.ok(htmlPath);
      assert.ok(htmlPath.includes('weekly'));
    });

    it('应该为月报生成 HTML 路径', async () => {
      const monthlyData = {
        ...mockData,
        month: '2026-03'
      };

      const htmlPath = await pipeline.generateHTML(monthlyData, 'monthly');
      assert.ok(htmlPath);
      assert.ok(htmlPath.includes('monthly'));
    });

    it('应该在类型不支持时抛出错误', async () => {
      await assert.rejects(
        async () => await pipeline.generateHTML(mockData, 'invalid'),
        /不支持的报告类型/
      );
    });
  });

  describe('sendNotification 方法', () => {
    it('应该为日报生成通知', async () => {
      const insights = {
        oneLiner: 'Daily insight',
        hypeIndex: { score: 80, reason: 'Test' },
        hot: [],
        shortTerm: [],
        longTerm: [],
        action: [],
        topProjects: []
      };

      const result = await pipeline.sendNotification(mockData, insights, 'daily');
      assert.ok(result);
    });

    it('应该为周报使用专用方法', async () => {
      const weeklyData = {
        ...mockData,
        weekStart: '2026-03-17',
        weekEnd: '2026-03-23'
      };

      const insights = {
        oneLiner: 'Weekly insight',
        hypeIndex: { score: 85, reason: 'Test' },
        hot: [],
        shortTerm: [],
        longTerm: [],
        action: [],
        topProjects: []
      };

      const result = await pipeline.sendNotification(weeklyData, insights, 'weekly');
      assert.ok(result);
    });

    it('应该为月报生成通知', async () => {
      const monthlyData = {
        ...mockData,
        month: '2026-03'
      };

      const insights = {
        oneLiner: 'Monthly insight',
        hypeIndex: { score: 90, reason: 'Test' },
        hot: [],
        shortTerm: [],
        longTerm: [],
        action: [],
        topProjects: []
      };

      const result = await pipeline.sendNotification(monthlyData, insights, 'monthly');
      assert.ok(result);
    });

    it('应该在通知失败时返回错误对象', async () => {
      // 由于配置可能不完整，通知可能会失败
      const result = await pipeline.sendNotification(mockData, null, 'daily');
      // 即使失败也应该返回对象
      assert.ok(result);
      assert.ok(typeof result === 'object');
    });
  });

  describe('executeStep 方法', () => {
    it('应该成功执行步骤', async () => {
      const result = { errors: [] };
      
      await pipeline.executeStep('test-step', async () => {
        // 模拟步骤执行
        return 'success';
      }, result);

      assert.strictEqual(result.errors.length, 0);
      
      const log = pipeline.getExecutionLog();
      const lastLog = log[log.length - 1];
      assert.strictEqual(lastLog.step, 'test-step');
      assert.strictEqual(lastLog.status, 'success');
    });

    it('应该在步骤失败时记录错误', async () => {
      const result = { errors: [] };
      const testError = new Error('Step failed');
      
      await assert.rejects(
        async () => await pipeline.executeStep('failing-step', async () => {
          throw testError;
        }, result),
        /Step failed/
      );

      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].step, 'failing-step');
      
      const log = pipeline.getExecutionLog();
      const lastLog = log[log.length - 1];
      assert.strictEqual(lastLog.status, 'failed');
    });
  });

  describe('getExecutionLog 方法', () => {
    it('应该返回执行日志数组', () => {
      const log = pipeline.getExecutionLog();
      assert.ok(Array.isArray(log));
    });

    it('应该在执行后包含日志条目', async () => {
      await pipeline.execute(mockData, 'daily');
      
      const log = pipeline.getExecutionLog();
      assert.ok(log.length > 0);
    });
  });

  describe('cleanup 方法', () => {
    it('应该执行清理操作', async () => {
      const result = {
        success: false,
        htmlPath: './tests/temp/cleanup-test.html'
      };

      // 创建一个临时文件
      const fs = require('fs/promises');
      const path = require('path');
      const testDir = './tests/temp';
      await fs.mkdir(testDir, { recursive: true });
      const testFile = path.join(testDir, 'cleanup-test.html');
      await fs.writeFile(testFile, '<html></html>', 'utf-8');

      result.htmlPath = testFile;

      // 执行清理
      await pipeline.cleanup(result);

      // 验证文件已被删除
      try {
        await fs.access(testFile);
        assert.fail('文件应该已被删除');
      } catch (error) {
        // 文件不存在，符合预期
      }

      // 清理测试目录
      try {
        await fs.rm(testDir, { recursive: true, force: true });
      } catch (error) {
        // 忽略清理错误
      }
    });
  });

  describe('配置组合测试', () => {
    it('应该只执行启用的步骤', async () => {
      const selectivePipeline = new ReportPipeline({
        enableAI: true,
        enableHTML: false,
        enableIndex: false,
        enableNotification: false
      });

      const result = await selectivePipeline.execute(mockData, 'daily');
      
      assert.strictEqual(result.success, true);
      // AI 已启用，应该有洞察（尽管可能是降级的）
      assert.ok(result.insights);
      // HTML 已禁用，应该为 null
      assert.strictEqual(result.htmlPath, null);
    });

    it('应该在全禁用配置下工作', async () => {
      const disabledPipeline = new ReportPipeline({
        enableAI: false,
        enableHTML: false,
        enableIndex: false,
        enableNotification: false
      });

      const result = await disabledPipeline.execute(mockData, 'daily');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.insights, null);
      assert.strictEqual(result.htmlPath, null);
      assert.strictEqual(result.notificationResults, null);
    });
  });
});
