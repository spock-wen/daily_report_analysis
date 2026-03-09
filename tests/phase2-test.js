const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

// 加载环境变量
require('dotenv').config();

const ROOT_DIR = path.join(__dirname, '..');

console.log('\n=== Phase 2 核心模块测试 ===\n');

// 测试数据加载模块
test('DataLoader - 模块加载', async () => {
  const DataLoader = require(path.join(ROOT_DIR, 'src/loader/data-loader'));
  const loader = new DataLoader();
  
  assert.ok(loader, 'DataLoader 实例已创建');
  assert.equal(typeof loader.loadDailyData, 'function', 'loadDailyData 方法存在');
  assert.equal(typeof loader.loadWeeklyData, 'function', 'loadWeeklyData 方法存在');
  assert.equal(typeof loader.loadMonthlyData, 'function', 'loadMonthlyData 方法存在');
  assert.equal(typeof loader.validateData, 'function', 'validateData 方法存在');
});

test('DataLoader - 数据验证', async () => {
  const DataLoader = require(path.join(ROOT_DIR, 'src/loader/data-loader'));
  const loader = new DataLoader();
  
  // 测试有效数据
  const validData = {
    brief: {
      trending_repos: [{ name: 'test/repo' }],
      stats: { total: 10 }
    },
    aiInsights: {
      summary: 'Test summary',
      project_insights: []
    }
  };
  
  const validResult = loader.validateData(validData);
  assert.equal(validResult.valid, true, '有效数据验证通过');
  assert.equal(validResult.errors.length, 0, '无错误');
  
  // 测试无效数据
  const invalidData = {};
  const invalidResult = loader.validateData(invalidData);
  assert.equal(invalidResult.valid, false, '无效数据验证失败');
  assert.ok(invalidResult.errors.length > 0, '有错误信息');
});

// 测试 AI 分析模块
test('InsightAnalyzer - 模块加载', async () => {
  const InsightAnalyzer = require(path.join(ROOT_DIR, 'src/analyzer/insight-analyzer'));
  const analyzer = new InsightAnalyzer();
  
  assert.ok(analyzer, 'InsightAnalyzer 实例已创建');
  assert.equal(typeof analyzer.analyzeDaily, 'function', 'analyzeDaily 方法存在');
  assert.equal(typeof analyzer.analyzeWeekly, 'function', 'analyzeWeekly 方法存在');
  assert.equal(typeof analyzer.analyzeMonthly, 'function', 'analyzeMonthly 方法存在');
  assert.equal(typeof analyzer.prepareContextData, 'function', 'prepareContextData 方法存在');
  assert.equal(typeof analyzer.buildPrompt, 'function', 'buildPrompt 方法存在');
  assert.equal(typeof analyzer.parseInsights, 'function', 'parseInsights 方法存在');
});

test('InsightAnalyzer - 准备上下文数据', async () => {
  const InsightAnalyzer = require(path.join(ROOT_DIR, 'src/analyzer/insight-analyzer'));
  const analyzer = new InsightAnalyzer();
  
  const briefData = {
    trending_repos: [
      {
        name: 'test/repo1',
        description: 'Test repo 1',
        stars: 100,
        forks: 20,
        language: 'JavaScript',
        topics: ['ai', 'ml']
      },
      {
        name: 'test/repo2',
        stars: 200,
        forks: 30
      }
    ],
    stats: { total: 2, avg_stars: 150 }
  };
  
  const contextData = analyzer.prepareContextData(briefData);
  
  assert.equal(contextData.projects.length, 2, '项目数量为 2');
  assert.equal(contextData.projects[0].name, 'test/repo1', '项目名称正确');
  assert.equal(contextData.projects[0].stars, 100, 'stars 正确');
  assert.equal(contextData.projects[1].language, '', '缺失的 language 默认为空字符串');
  assert.deepEqual(contextData.stats, { total: 2, avg_stars: 150 }, '统计数据正确');
});

test('InsightAnalyzer - 构建提示词', async () => {
  const InsightAnalyzer = require(path.join(ROOT_DIR, 'src/analyzer/insight-analyzer'));
  const analyzer = new InsightAnalyzer();
  
  const template = '请分析{{projects_count}}个项目：{{projects_json}}，统计：{{stats_json}}';
  const contextData = {
    projects: [{ name: 'test/repo' }],
    stats: { total: 1 }
  };
  
  const prompt = analyzer.buildPrompt(template, contextData);
  
  assert.ok(prompt.includes('1'), '项目数量已替换');
  assert.ok(prompt.includes('test/repo'), '项目数据已替换');
  assert.ok(prompt.includes('total'), '统计数据已替换');
});

test('InsightAnalyzer - 解析 AI 洞察', async () => {
  const InsightAnalyzer = require(path.join(ROOT_DIR, 'src/analyzer/insight-analyzer'));
  const analyzer = new InsightAnalyzer();
  
  const llmResponse = `
    这是一些分析内容
    \`\`\`json
    {
      "summary": "测试摘要",
      "project_insights": [
        {
          "project_name": "test/repo",
          "analysis": "测试分析"
        }
      ]
    }
    \`\`\`
  `;
  
  const briefData = {
    trending_repos: [
      { name: 'test/repo', url: 'https://github.com/test/repo', stars: 100, language: 'JS' }
    ]
  };
  
  const insights = analyzer.parseInsights(llmResponse, briefData);
  
  assert.equal(insights.summary, '测试摘要', '摘要解析正确');
  assert.equal(insights.project_insights.length, 1, '项目洞察数量正确');
  assert.equal(insights.project_insights[0].github_url, 'https://github.com/test/repo', 'GitHub 链接已补充');
  assert.equal(insights.project_insights[0].stars, 100, 'stars 已补充');
});

// 测试 HTML 生成模块
test('HTMLGenerator - 模块加载', async () => {
  const HTMLGenerator = require(path.join(ROOT_DIR, 'src/generator/html-generator'));
  const generator = new HTMLGenerator();
  
  assert.ok(generator, 'HTMLGenerator 实例已创建');
  assert.equal(typeof generator.generateDaily, 'function', 'generateDaily 方法存在');
  assert.equal(typeof generator.generateWeekly, 'function', 'generateWeekly 方法存在');
  assert.equal(typeof generator.generateMonthly, 'function', 'generateMonthly 方法存在');
  assert.equal(typeof generator.renderDailyHTML, 'function', 'renderDailyHTML 方法存在');
  assert.equal(typeof generator.renderStatsSection, 'function', 'renderStatsSection 方法存在');
  assert.equal(typeof generator.renderProjectListSection, 'function', 'renderProjectListSection 方法存在');
  assert.equal(typeof generator.renderAIInsightsSection, 'function', 'renderAIInsightsSection 方法存在');
});

test('HTMLGenerator - 渲染统计部分', async () => {
  const HTMLGenerator = require(path.join(ROOT_DIR, 'src/generator/html-generator'));
  const generator = new HTMLGenerator();
  
  const stats = {
    total_projects: 10,
    ai_projects: 5,
    avg_stars: 150,
    hot_projects: 3
  };
  
  const html = generator.renderStatsSection(stats);
  
  assert.ok(html.includes('stat-card'), '包含统计卡片');
  assert.ok(html.includes('上榜项目'), '包含上榜项目标签');
  assert.ok(html.includes('10'), '包含数值 10');
  assert.ok(html.includes('AI 项目'), '包含 AI 项目标签');
});

test('HTMLGenerator - 渲染项目列表', async () => {
  const HTMLGenerator = require(path.join(ROOT_DIR, 'src/generator/html-generator'));
  const generator = new HTMLGenerator();
  
  const projects = [
    {
      name: 'test/repo1',
      url: 'https://github.com/test/repo1',
      stars: 100,
      forks: 20,
      language: 'JavaScript',
      description: 'Test repo 1'
    },
    {
      name: 'test/repo2',
      url: 'https://github.com/test/repo2',
      stars: 200,
      forks: 30,
      language: 'Python'
    }
  ];
  
  const html = generator.renderProjectListSection(projects);
  
  assert.ok(html.includes('project-card'), '包含项目卡片');
  assert.ok(html.includes('test/repo1'), '包含项目名称 1');
  assert.ok(html.includes('test/repo2'), '包含项目名称 2');
  assert.ok(html.includes('查看详情'), '包含查看详情按钮');
  assert.ok(html.includes('toggleDetails'), '包含切换函数');
});

test('HTMLGenerator - 渲染空项目列表', async () => {
  const HTMLGenerator = require(path.join(ROOT_DIR, 'src/generator/html-generator'));
  const generator = new HTMLGenerator();
  
  const html1 = generator.renderProjectListSection([]);
  const html2 = generator.renderProjectListSection(null);
  
  assert.ok(html1.includes('暂无数据'), '空数组显示暂无数据');
  assert.ok(html2.includes('暂无数据'), 'null 显示暂无数据');
});

test('HTMLGenerator - 渲染 AI 洞察部分', async () => {
  const HTMLGenerator = require(path.join(ROOT_DIR, 'src/generator/html-generator'));
  const generator = new HTMLGenerator();
  
  const aiInsights = {
    summary: '这是 AI 分析摘要',
    project_insights: [
      {
        project_name: 'test/repo',
        github_url: 'https://github.com/test/repo',
        analysis: '详细分析内容'
      }
    ],
    trends: ['趋势 1', '趋势 2'],
    recommendations: ['建议 1', '建议 2']
  };
  
  const html = generator.renderAIInsightsSection(aiInsights);
  
  assert.ok(html.includes('AI 深度洞察'), '包含标题');
  assert.ok(html.includes('这是 AI 分析摘要'), '包含摘要');
  assert.ok(html.includes('重点项目分析'), '包含重点项目分析');
  assert.ok(html.includes('test/repo'), '包含项目名称');
  assert.ok(html.includes('趋势观察'), '包含趋势观察');
  assert.ok(html.includes('推荐建议'), '包含推荐建议');
});

test('HTMLGenerator - 渲染空 AI 洞察', async () => {
  const HTMLGenerator = require(path.join(ROOT_DIR, 'src/generator/html-generator'));
  const generator = new HTMLGenerator();
  
  const html = generator.renderAIInsightsSection(null);
  
  assert.ok(html.includes('AI 分析尚未完成'), '显示 AI 分析尚未完成');
});

test('HTMLGenerator - 渲染详情项', async () => {
  const HTMLGenerator = require(path.join(ROOT_DIR, 'src/generator/html-generator'));
  const generator = new HTMLGenerator();
  
  const items1 = ['功能 1', '功能 2', '功能 3'];
  const html1 = generator.renderDetailItems(items1);
  
  assert.ok(html1.includes('<li>功能 1</li>'), '包含列表项 1');
  assert.ok(html1.includes('<li>功能 2</li>'), '包含列表项 2');
  assert.ok(html1.includes('<li>功能 3</li>'), '包含列表项 3');
  
  const html2 = generator.renderDetailItems([]);
  assert.ok(html2.includes('暂无数据'), '空数组显示暂无数据');
  
  const html3 = generator.renderDetailItems(null);
  assert.ok(html3.includes('暂无数据'), 'null 显示暂无数据');
});

// 测试推送通知模块
test('MessageSender - 模块加载', async () => {
  const MessageSender = require(path.join(ROOT_DIR, 'src/notifier/message-sender'));
  const sender = new MessageSender();
  
  assert.ok(sender, 'MessageSender 实例已创建');
  assert.equal(typeof sender.sendFeishu, 'function', 'sendFeishu 方法存在');
  assert.equal(typeof sender.sendWeLink, 'function', 'sendWeLink 方法存在');
  assert.equal(typeof sender.sendAll, 'function', 'sendAll 方法存在');
  assert.equal(typeof sender.buildFeishuMessage, 'function', 'buildFeishuMessage 方法存在');
  assert.equal(typeof sender.buildWeLinkMessage, 'function', 'buildWeLinkMessage 方法存在');
  assert.equal(typeof sender.generateNotificationContent, 'function', 'generateNotificationContent 方法存在');
});

test('MessageSender - 构建飞书消息', async () => {
  const MessageSender = require(path.join(ROOT_DIR, 'src/notifier/message-sender'));
  const sender = new MessageSender();
  
  const options = {
    type: 'daily',
    title: '测试日报',
    content: '这是测试内容',
    reportUrl: 'http://localhost:8080/reports/daily/test.html'
  };
  
  const message = sender.buildFeishuMessage(options);
  
  assert.equal(message.msg_type, 'interactive', '消息类型正确');
  assert.equal(message.card.header.title.content, '测试日报', '标题正确');
  assert.ok(message.card.elements.length > 0, '包含元素');
});

test('MessageSender - 构建 WeLink 消息', async () => {
  const MessageSender = require(path.join(ROOT_DIR, 'src/notifier/message-sender'));
  const sender = new MessageSender();
  
  const options = {
    type: 'daily',
    title: '测试日报',
    content: '这是测试内容',
    reportUrl: 'http://localhost:8080/reports/daily/test.html'
  };
  
  const message = sender.buildWeLinkMessage(options);
  
  assert.equal(message.msgtype, 'markdown', '消息类型正确');
  assert.ok(message.markdown.content.includes('# 测试日报'), '包含标题');
  assert.ok(message.markdown.content.includes('查看报告'), '包含查看报告链接');
});

test('MessageSender - 生成通知内容', async () => {
  const MessageSender = require(path.join(ROOT_DIR, 'src/notifier/message-sender'));
  const sender = new MessageSender();
  
  const data = {
    date: '2026-03-09',
    brief: {
      stats: {
        total_projects: 10,
        ai_projects: 5,
        avg_stars: 150,
        hot_projects: 3
      }
    },
    aiInsights: {
      summary: '这是 AI 分析摘要，内容比较长一点'
    }
  };
  
  const content = sender.generateNotificationContent('daily', data);
  
  assert.ok(content.title.includes('日报'), '标题包含日报');
  assert.ok(content.title.includes('2026-03-09'), '标题包含日期');
  assert.ok(content.content.includes('上榜项目：10'), '包含统计数据');
  assert.ok(content.content.includes('AI 项目：5'), '包含 AI 项目数');
  assert.ok(content.reportUrl.includes('/reports/daily/'), '报告 URL 正确');
});

test('MessageSender - 构建报告 URL', async () => {
  const MessageSender = require(path.join(ROOT_DIR, 'src/notifier/message-sender'));
  const sender = new MessageSender();
  
  const dailyUrl = sender.buildReportUrl('daily', '2026-03-09');
  assert.ok(dailyUrl.includes('github-ai-trending-2026-03-09.html'), '日报 URL 正确');
  
  const weeklyUrl = sender.buildReportUrl('weekly', '2026-W10');
  assert.ok(weeklyUrl.includes('weekly-2026-W10.html'), '周报 URL 正确');
  
  const monthlyUrl = sender.buildReportUrl('monthly', '2026-03');
  assert.ok(monthlyUrl.includes('monthly-2026-03.html'), '月报 URL 正确');
});

console.log('\n=== Phase 2 测试完成 ===\n');
