/**
 * Phase 2 端到端集成测试
 * 测试完整的报告生成流程：数据加载 -> AI 分析 -> HTML 生成
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs').promises;

// 加载环境变量
require('dotenv').config();

const ROOT_DIR = path.join(__dirname, '..');
const DataLoader = require(path.join(ROOT_DIR, 'src/loader/data-loader'));
const InsightAnalyzer = require(path.join(ROOT_DIR, 'src/analyzer/insight-analyzer'));
const HTMLGenerator = require(path.join(ROOT_DIR, 'src/generator/html-generator'));

console.log('\n=== Phase 2 端到端集成测试 ===\n');

// 创建测试数据
const testData = {
  date: '2026-03-08',
  type: 'daily',
  brief: {
    generated_at: '2026-03-08T00:00:00Z',
    stats: {
      total_projects: 10,
      ai_projects: 8,
      avg_stars: 1250,
      hot_projects: 5
    },
    trending_repos: [
      {
        name: 'alibaba/page-agent',
        description: '阿里开源的智能体开发框架，支持多模态交互',
        url: 'https://github.com/alibaba/page-agent',
        stars: 2300,
        forks: 320,
        language: 'TypeScript',
        topics: ['ai', 'agent', 'automation']
      },
      {
        name: 'virattt/ai-hedge-fund',
        description: 'AI 驱动的对冲基金交易系统',
        url: 'https://github.com/virattt/ai-hedge-fund',
        stars: 1850,
        forks: 280,
        language: 'Python',
        topics: ['ai', 'finance', 'trading']
      },
      {
        name: 'MiroFish/ai-toolkit',
        description: '一站式 AI 工具集合，包含多种实用工具',
        url: 'https://github.com/MiroFish/ai-toolkit',
        stars: 1420,
        forks: 195,
        language: 'JavaScript',
        topics: ['ai', 'tools', 'productivity']
      },
      {
        name: 'Qwen-Agent/official',
        description: '通义千问官方智能体框架',
        url: 'https://github.com/Qwen-Agent/official',
        stars: 1680,
        forks: 240,
        language: 'Python',
        topics: ['ai', 'llm', 'agent']
      },
      {
        name: 'Calling/MCP-server',
        description: 'MCP 协议服务器实现',
        url: 'https://github.com/Calling/MCP-server',
        stars: 980,
        forks: 150,
        language: 'Go',
        topics: ['mcp', 'protocol', 'server']
      }
    ]
  }
};

test('端到端测试 - 完整报告生成流程', async () => {
  console.log('\n📋 开始端到端测试...\n');
  
  // 步骤 1: 数据加载
  console.log('1️⃣ 数据加载模块测试');
  const loader = new DataLoader();
  const validationResult = loader.validateData(testData);
  assert.equal(validationResult.valid, true, '数据验证通过');
  console.log('   ✅ 数据验证通过\n');
  
  // 步骤 2: AI 分析（真实调用 LLM API）
  console.log('2️⃣ AI 分析模块测试（真实 API 调用）');
  const analyzer = new InsightAnalyzer();
  
  // 准备上下文数据
  const contextData = analyzer.prepareContextData(testData.brief);
  assert.equal(contextData.projects.length, 5, '项目数量正确');
  console.log('   ✅ 上下文数据准备完成');
  
  // 构建提示词
  const promptTemplate = `请分析以下 GitHub Trending 项目（共{{projects_count}}个）：

{{projects_json}}

请提供：
1. 整体趋势总结（summary）
2. 重点项目分析（project_insights，包含 project_name 和 analysis）
3. 技术趋势观察（trends，数组）
4. 开发者建议（recommendations，数组）

请以 JSON 格式返回。`;
  
  const prompt = analyzer.buildPrompt(promptTemplate, contextData);
  assert.ok(prompt.includes('5'), '提示词包含项目数量');
  assert.ok(prompt.includes('alibaba/page-agent'), '提示词包含项目名称');
  console.log('   ✅ 提示词构建完成');
  
  // 调用 LLM API（真实调用）
  console.log('   🔄 正在调用 LLM API...');
  const insights = await analyzer.analyzeDaily(testData);
  
  console.log('   📊 AI 返回结果:', JSON.stringify(insights, null, 2).substring(0, 500));
  
  assert.ok(insights, 'AI 洞察已生成');
  assert.ok(
    insights.summary || insights.oneLiner || (insights.project_insights && insights.project_insights.length > 0),
    '包含摘要或项目分析'
  );
  console.log('   ✅ AI 分析完成');
  console.log('   📊 生成结果:', {
    summary_length: insights.summary?.length || 0,
    oneLiner: insights.oneLiner ? '✓' : '✗',
    project_insights_count: insights.project_insights?.length || 0,
    trends_count: insights.trends?.length || 0,
    recommendations_count: insights.action?.length || insights.recommendations?.length || 0
  });
  console.log('');
  
  // 步骤 3: HTML 生成
  console.log('3️⃣ HTML 生成模块测试');
  const generator = new HTMLGenerator();
  
  const reportData = {
    ...testData,
    aiInsights: insights
  };
  
  const html = generator.renderDailyHTML(reportData);
  
  assert.ok(html.length > 0, 'HTML 已生成');
  assert.ok(html.includes('GitHub AI Trending 日报'), '包含标题');
  assert.ok(html.includes('alibaba/page-agent'), '包含项目名称');
  assert.ok(html.includes('AI 深度洞察'), '包含 AI 洞察部分');
  assert.ok(html.includes(insights.summary?.substring(0, 50) || ''), '包含 AI 摘要');
  
  console.log('   ✅ HTML 生成完成');
  console.log('   📄 HTML 大小:', html.length, '字节');
  console.log('');
  
  console.log('🎉 端到端测试全部通过！\n');
});

test('AI 分析质量验证', async () => {
  console.log('\n🔍 AI 分析质量验证...\n');
  
  const analyzer = new InsightAnalyzer();
  const insights = await analyzer.analyzeDaily(testData);
  
  // 验证 AI 生成的内容质量
  if (insights.summary) {
    assert.ok(insights.summary.length > 50, '摘要内容足够详细');
    console.log('   ✅ 摘要质量合格');
  }
  
  if (insights.project_insights && insights.project_insights.length > 0) {
    const firstInsight = insights.project_insights[0];
    assert.ok(firstInsight.project_name, '包含项目名称');
    assert.ok(firstInsight.analysis, '包含分析内容');
    assert.ok(firstInsight.github_url, '包含 GitHub 链接');
    console.log('   ✅ 项目分析质量合格');
  }
  
  console.log('');
});

test('HTML 渲染完整性验证', async () => {
  console.log('\n🎨 HTML 渲染完整性验证...\n');
  
  const analyzer = new InsightAnalyzer();
  const generator = new HTMLGenerator();
  
  const insights = await analyzer.analyzeDaily(testData);
  const reportData = { ...testData, aiInsights: insights };
  const html = generator.renderDailyHTML(reportData);
  
  // 验证 HTML 结构完整性
  const requiredElements = [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<body>',
    'class="container"',
    'class="stats-grid"',
    'class="project-list"',
    'class="ai-insights"',
    '</body>',
    '</html>'
  ];
  
  requiredElements.forEach(element => {
    assert.ok(html.includes(element), `包含 ${element}`);
  });
  
  console.log('   ✅ HTML 结构完整');
  
  // 验证响应式设计
  assert.ok(html.includes('@media'), '包含媒体查询');
  assert.ok(html.includes('max-width: 768px'), '包含移动端适配');
  console.log('   ✅ 响应式设计支持');
  
  // 验证交互功能
  assert.ok(html.includes('toggleDetails'), '包含展开/收起功能');
  assert.ok(html.includes('project-details'), '包含详情元素');
  console.log('   ✅ 交互功能完整');
  
  console.log('');
});

console.log('\n=== 端到端测试准备完成 ===\n');
