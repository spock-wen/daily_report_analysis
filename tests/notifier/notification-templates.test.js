/**
 * 通知模板测试
 * 测试成功/失败通知模板的生成
 */

const assert = require('assert');
const { test, describe } = require('node:test');
const {
  generateSuccessFeishu,
  generateSuccessWeLink,
  generateFailureFeishu,
  generateFailureWeLink,
  calculateLanguageDistribution,
  formatLanguageDistribution,
  formatTopProjects,
  generateFailureSuggestions,
  REPORT_TYPES
} = require('../../src/notifier/notification-templates');

describe('Notification Templates', () => {
  
  describe('REPORT_TYPES', () => {
    test('应该包含所有报告类型配置', () => {
      assert.ok(REPORT_TYPES.daily);
      assert.ok(REPORT_TYPES.weekly);
      assert.ok(REPORT_TYPES.monthly);
      assert.strictEqual(REPORT_TYPES.daily.name, '日报');
      assert.strictEqual(REPORT_TYPES.weekly.name, '周报');
      assert.strictEqual(REPORT_TYPES.monthly.name, '月报');
    });
  });

  describe('calculateLanguageDistribution', () => {
    test('应该正确计算语言分布', () => {
      const repos = [
        { language: 'JavaScript' },
        { language: 'JavaScript' },
        { language: 'Python' },
        { language: 'TypeScript' },
        { language: 'Python' },
        { language: 'Python' }
      ];

      const distribution = calculateLanguageDistribution(repos);
      
      assert.strictEqual(distribution.Python, 3);
      assert.strictEqual(distribution.JavaScript, 2);
      assert.strictEqual(distribution.TypeScript, 1);
    });

    test('应该处理空数组', () => {
      const distribution = calculateLanguageDistribution([]);
      assert.deepStrictEqual(distribution, {});
    });

    test('应该处理缺失 language 字段的项目', () => {
      const repos = [
        { language: null },
        { language: undefined },
        {}
      ];

      const distribution = calculateLanguageDistribution(repos);
      assert.strictEqual(distribution.Unknown, 3);
    });
  });

  describe('formatLanguageDistribution', () => {
    test('应该格式化语言分布', () => {
      const distribution = {
        JavaScript: 5,
        Python: 3,
        TypeScript: 2
      };

      const result = formatLanguageDistribution(distribution);
      assert.ok(result.includes('JavaScript(5)'));
      assert.ok(result.includes('Python(3)'));
      assert.ok(result.includes('TypeScript(2)'));
    });

    test('应该处理空分布', () => {
      const result = formatLanguageDistribution({});
      assert.strictEqual(result, '暂无数据');
    });

    test('应该只显示前 5 个语言，其余合并为"其他"', () => {
      const distribution = {
        JavaScript: 10,
        Python: 8,
        TypeScript: 6,
        Java: 4,
        Go: 2,
        Rust: 1,
        Ruby: 1
      };

      const result = formatLanguageDistribution(distribution);
      assert.ok(result.includes('JavaScript(10)'));
      assert.ok(result.includes('其他 (2)'));
    });
  });

  describe('formatTopProjects', () => {
    test('应该格式化热门项目', () => {
      const repos = [
        { name: 'owner/repo1', todayStars: 100, language: 'JavaScript' },
        { name: 'owner/repo2', todayStars: 80, language: 'Python' },
        { name: 'owner/repo3', todayStars: 60, language: 'TypeScript' }
      ];

      const result = formatTopProjects(repos);
      
      assert.ok(result.includes('🥇'));
      assert.ok(result.includes('owner/repo1'));
      assert.ok(result.includes('+100⭐'));
      assert.ok(result.includes('JavaScript'));
    });

    test('应该处理缺失字段的项目', () => {
      const repos = [
        { name: 'owner/repo1' },
        { repo: 'owner/repo2' },
        { fullName: 'owner/repo3' }
      ];

      const result = formatTopProjects(repos);
      assert.ok(result.includes('owner/repo1'));
      assert.ok(result.includes('owner/repo2'));
      assert.ok(result.includes('owner/repo3'));
    });
  });

  describe('generateFailureSuggestions', () => {
    test('应该为网络错误提供建议', () => {
      const error = new Error('Network timeout');
      const suggestions = generateFailureSuggestions(error, 'daily');
      
      assert.ok(suggestions.includes('检查服务器网络连接'));
      assert.ok(suggestions.includes('检查 GitHub 访问状态'));
      assert.ok(suggestions.includes('稍后手动触发重试'));
    });

    test('应该为 API 错误提供建议', () => {
      const error = new Error('Invalid API token');
      const suggestions = generateFailureSuggestions(error, 'daily');
      
      assert.ok(suggestions.includes('检查 API Token 是否有效'));
      assert.ok(suggestions.includes('验证 API 密钥配置'));
    });

    test('应该为解析错误提供建议', () => {
      const error = new Error('JSON parse error');
      const suggestions = generateFailureSuggestions(error, 'daily');
      
      assert.ok(suggestions.includes('检查数据格式是否正确'));
      assert.ok(suggestions.includes('验证 API 响应内容'));
    });

    test('应该为一般错误提供默认建议', () => {
      const error = new Error('Unknown error');
      const suggestions = generateFailureSuggestions(error, 'daily');
      
      assert.ok(suggestions.includes('检查服务器网络连接'));
      assert.ok(suggestions.includes('查看完整日志定位问题'));
    });
  });

  describe('generateSuccessFeishu', () => {
    test('应该生成飞书成功通知模板', () => {
      const data = {
        date: '2026-03-20',
        trending_repos: [
          { name: 'owner/repo1', todayStars: 100, language: 'JavaScript' },
          { name: 'owner/repo2', todayStars: 80, language: 'Python' }
        ],
        aiInsights: {
          oneLiner: '这是一个测试洞察'
        }
      };
      const reportUrl = 'https://report.wenspock.site/daily/2026-03-20';

      const message = generateSuccessFeishu('daily', data, reportUrl);

      // 验证消息结构
      assert.ok(message.config);
      assert.ok(message.header);
      assert.ok(message.elements);
      assert.ok(Array.isArray(message.elements));
      
      // 验证头部
      assert.strictEqual(message.header.template, 'green');
      assert.ok(message.header.title.content.includes('✅'));
      assert.ok(message.header.title.content.includes('日报'));
      
      // 验证元素数量
      assert.ok(message.elements.length >= 5);
    });

    test('应该处理缺失的数据', () => {
      const data = {};
      const reportUrl = 'https://report.wenspock.site/daily/2026-03-20';

      const message = generateSuccessFeishu('daily', data, reportUrl);
      
      assert.ok(message);
      assert.ok(message.header);
    });

    test('应该支持周报类型', () => {
      const data = {
        weekStart: '2026-W11',
        trending_repos: []
      };
      const reportUrl = 'https://report.wenspock.site/weekly/2026-W11';

      const message = generateSuccessFeishu('weekly', data, reportUrl);
      
      assert.ok(message.header.title.content.includes('周报'));
    });

    test('应该支持月报类型', () => {
      const data = {
        month: '2026-03',
        trending_repos: []
      };
      const reportUrl = 'https://report.wenspock.site/monthly/2026-03';

      const message = generateSuccessFeishu('monthly', data, reportUrl);
      
      assert.ok(message.header.title.content.includes('月报'));
    });
  });

  describe('generateSuccessWeLink', () => {
    test('应该生成 WeLink 成功通知模板', () => {
      const data = {
        date: '2026-03-20',
        trending_repos: [
          { name: 'owner/repo1', todayStars: 100, language: 'JavaScript' },
          { name: 'owner/repo2', todayStars: 80, language: 'Python' },
          { name: 'owner/repo3', todayStars: 60, language: 'TypeScript' }
        ],
        aiInsights: {
          oneLiner: '这是一个测试洞察'
        }
      };
      const reportUrl = 'https://report.wenspock.site/daily/2026-03-20';

      const message = generateSuccessWeLink('daily', data, reportUrl);

      // 验证消息内容
      assert.ok(typeof message === 'string');
      assert.ok(message.includes('✅'));
      assert.ok(message.includes('日报'));
      assert.ok(message.includes('📊 报告时间'));
      assert.ok(message.includes('🔥 热门项目'));
      assert.ok(message.includes('🏆 热门项目 TOP3'));
      assert.ok(message.includes(reportUrl));
    });

    test('应该限制消息长度不超过 500 字', () => {
      const data = {
        date: '2026-03-20',
        trending_repos: Array(20).fill(null).map((_, i) => ({
          name: `owner/repo${i}`,
          todayStars: 100 - i * 5,
          language: 'JavaScript'
        })),
        aiInsights: {}
      };
      const reportUrl = 'https://report.wenspock.site/daily/2026-03-20';

      const message = generateSuccessWeLink('daily', data, reportUrl);
      
      assert.ok(message.length <= 500);
    });

    test('应该处理空项目列表', () => {
      const data = {
        date: '2026-03-20',
        trending_repos: [],
        aiInsights: {}
      };
      const reportUrl = 'https://report.wenspock.site/daily/2026-03-20';

      const message = generateSuccessWeLink('daily', data, reportUrl);
      
      assert.ok(message);
      assert.ok(!message.includes('🏆 热门项目 TOP3'));
    });
  });

  describe('generateFailureFeishu', () => {
    test('应该生成飞书失败通知模板', () => {
      const error = new Error('无法访问 GitHub');
      const message = generateFailureFeishu('daily', error, 5, 12);

      // 验证消息结构
      assert.ok(message.config);
      assert.ok(message.header);
      assert.ok(message.elements);
      
      // 验证头部
      assert.strictEqual(message.header.template, 'red');
      assert.ok(message.header.title.content.includes('❌'));
      assert.ok(message.header.title.content.includes('失败'));
      
      // 验证重试次数显示
      const retryElement = message.elements.find(e => 
        e.text && e.text.content && e.text.content.includes('重试次数')
      );
      assert.ok(retryElement);
      assert.ok(retryElement.text.content.includes('5/12'));
    });

    test('应该包含错误信息', () => {
      const error = new Error('网络超时错误');
      const message = generateFailureFeishu('daily', error, 1, 12);

      const errorElement = message.elements.find(e => 
        e.text && e.text.content && e.text.content.includes('错误信息')
      );
      assert.ok(errorElement);
      assert.ok(errorElement.text.content.includes('网络超时错误'));
    });

    test('应该包含建议操作', () => {
      const error = new Error('Network timeout');
      const message = generateFailureFeishu('daily', error, 1, 12);

      const suggestionElement = message.elements.find(e => 
        e.text && e.text.content && e.text.content.includes('建议操作')
      );
      assert.ok(suggestionElement);
      assert.ok(suggestionElement.text.content.includes('检查服务器网络连接'));
    });

    test('应该包含手动触发按钮', () => {
      const error = new Error('Test error');
      const message = generateFailureFeishu('daily', error, 1, 12);

      const actionElement = message.elements.find(e => e.tag === 'action');
      assert.ok(actionElement);
      assert.ok(actionElement.actions);
      assert.strictEqual(actionElement.actions[0].text.content, '🔗 手动触发');
    });
  });

  describe('generateFailureWeLink', () => {
    test('应该生成 WeLink 失败通知模板', () => {
      const error = new Error('无法访问 GitHub');
      const message = generateFailureWeLink('daily', error, 5, 12);

      // 验证消息内容
      assert.ok(typeof message === 'string');
      assert.ok(message.includes('❌'));
      assert.ok(message.includes('日报'));
      assert.ok(message.includes('⏰ 失败时间'));
      assert.ok(message.includes('🔄 重试次数'));
      assert.ok(message.includes('5/12'));
      assert.ok(message.includes('⚠️ 错误信息'));
      assert.ok(message.includes('💡 建议操作'));
      assert.ok(message.includes('🔗 手动触发'));
    });

    test('应该限制消息长度不超过 500 字', () => {
      const error = new Error('这是一个非常长的错误信息，用于测试 WeLink 消息长度限制...' .repeat(10));
      const message = generateFailureWeLink('daily', error, 12, 12);
      
      assert.ok(message.length <= 500);
    });

    test('应该包含具体的建议操作', () => {
      const error = new Error('Network timeout');
      const message = generateFailureWeLink('daily', error, 1, 12);

      assert.ok(message.includes('1. 检查服务器网络连接'));
      assert.ok(message.includes('2. 检查 GitHub 访问状态'));
      assert.ok(message.includes('3. 稍后手动触发重试'));
    });

    test('应该包含手动触发命令', () => {
      const error = new Error('Test error');
      const message = generateFailureWeLink('daily', error, 1, 12);

      assert.ok(message.includes('node scripts/run-once.js daily'));
    });
  });

  describe('集成测试', () => {
    test('应该为所有报告类型生成成功通知', () => {
      const types = ['daily', 'weekly', 'monthly'];
      const data = {
        date: '2026-03-20',
        trending_repos: [
          { name: 'owner/repo1', todayStars: 100, language: 'JavaScript' }
        ],
        aiInsights: { oneLiner: '测试' }
      };
      const reportUrl = 'https://report.wenspock.site';

      types.forEach(type => {
        const feishu = generateSuccessFeishu(type, data, reportUrl);
        const welink = generateSuccessWeLink(type, data, reportUrl);
        
        assert.ok(feishu, `${type} 飞书通知应该生成`);
        assert.ok(welink, `${type} WeLink 通知应该生成`);
      });
    });

    test('应该为所有报告类型生成失败通知', () => {
      const types = ['daily', 'weekly', 'monthly'];
      const error = new Error('Test error');

      types.forEach(type => {
        const feishu = generateFailureFeishu(type, error, 1, 12);
        const welink = generateFailureWeLink(type, error, 1, 12);
        
        assert.ok(feishu, `${type} 飞书失败通知应该生成`);
        assert.ok(welink, `${type} WeLink 失败通知应该生成`);
      });
    });
  });
});
