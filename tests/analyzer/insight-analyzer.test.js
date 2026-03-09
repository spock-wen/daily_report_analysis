#!/usr/bin/env node
/**
 * InsightAnalyzer 模块测试
 */

const InsightAnalyzer = require('../../src/analyzer/insight-analyzer');

// 测试计数器
let totalTests = 0;
let passedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${testName}`);
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  InsightAnalyzer 模块测试');
  console.log('='.repeat(60) + '\n');

  try {
    const analyzer = new InsightAnalyzer();

    // ==================== 实例化测试 ====================
    console.log('📦 实例化测试：\n');
    assert(analyzer instanceof InsightAnalyzer, 'InsightAnalyzer 可实例化');
    assert(typeof analyzer.analyzeDaily === 'function', 'analyzeDaily 方法存在');
    assert(typeof analyzer.analyzeWeekly === 'function', 'analyzeWeekly 方法存在');
    assert(typeof analyzer.analyzeMonthly === 'function', 'analyzeMonthly 方法存在');
    assert(typeof analyzer.prepareContextData === 'function', 'prepareContextData 方法存在');
    assert(typeof analyzer.buildPrompt === 'function', 'buildPrompt 方法存在');
    assert(typeof analyzer.parseInsights === 'function', 'parseInsights 方法存在');
    assert(typeof analyzer.saveInsights === 'function', 'saveInsights 方法存在');

    // ==================== prepareContextData 测试 ====================
    console.log('\n📦 prepareContextData 方法测试：\n');
    
    const mockBriefData = {
      trending_repos: [
        {
          name: 'test/repo1',
          description: '测试项目 1',
          stars: 1000,
          forks: 100,
          language: 'JavaScript',
          topics: ['ai', 'machine-learning']
        },
        {
          name: 'test/repo2',
          description: '测试项目 2',
          stars: 2000,
          forks: 200,
          language: 'Python',
          topics: ['deep-learning']
        }
      ],
      stats: {
        total_projects: 2,
        ai_projects: 2
      },
      generated_at: '2026-03-09T00:00:00Z'
    };

    const contextData = analyzer.prepareContextData(mockBriefData);
    assert(contextData.projects, '包含 projects 数组');
    assert(contextData.projects.length === 2, '项目数量正确');
    assert(contextData.projects[0].name === 'test/repo1', '项目名称正确');
    assert(contextData.projects[0].description === '测试项目 1', '项目描述正确');
    assert(contextData.projects[0].stars === 1000, '项目 stars 正确');
    assert(contextData.projects[0].language === 'JavaScript', '项目语言正确');
    assert(Array.isArray(contextData.projects[0].topics), '项目 topics 是数组');
    assert(contextData.stats, '包含 stats 统计');
    assert(contextData.generatedAt, '包含 generatedAt 时间戳');

    // 测试空数据
    const emptyContextData = analyzer.prepareContextData({});
    assert(Array.isArray(emptyContextData.projects), '空数据 projects 是数组');
    assert(emptyContextData.projects.length === 0, '空数据 projects 为空');
    assert(emptyContextData.stats, '空数据包含 stats');

    // ==================== buildPrompt 测试 ====================
    console.log('\n📦 buildPrompt 方法测试：\n');
    
    const promptTemplate = '分析以下项目：{projects}\n项目数量：{projectCount}\n日期：{date}';
    const contextDataForPrompt = {
      projects: [
        { name: 'test/repo1', stars: 1000 },
        { name: 'test/repo2', stars: 2000 }
      ],
      generatedAt: '2026-03-09',
      stats: {
        total_projects: 2,
        ai_projects: 1
      }
    };

    const prompt = analyzer.buildPrompt(promptTemplate, contextDataForPrompt);
    assert(prompt.includes('test/repo1'), '提示词包含项目 1');
    assert(prompt.includes('test/repo2'), '提示词包含项目 2');
    assert(prompt.includes('2'), '提示词包含项目数量');
    assert(prompt.includes('2026-03-09'), '提示词包含日期');

    // 测试统计变量替换
    const statsTemplate = '总项目：{totalProjects}, AI 项目：{aiProjects}, AI 占比：{aiPercentage}%';
    const promptWithStats = analyzer.buildPrompt(statsTemplate, contextDataForPrompt);
    assert(promptWithStats.includes('2'), '包含总项目数');
    assert(promptWithStats.includes('1'), '包含 AI 项目数');
    assert(promptWithStats.includes('50'), '包含 AI 占比（50%）');

    // 测试双大括号格式兼容
    const doubleBraceTemplate = '项目：{{projects_count}}, 详情：{{projects_json}}';
    const promptDoubleBrace = analyzer.buildPrompt(doubleBraceTemplate, contextDataForPrompt);
    assert(promptDoubleBrace.includes('2'), '双大括号 projects_count 替换成功');
    assert(promptDoubleBrace.includes('test/repo1'), '双大括号 projects_json 替换成功');

    // ==================== parseInsights 测试 ====================
    console.log('\n📦 parseInsights 方法测试：\n');
    
    // 测试 1: 标准 JSON 响应
    const standardResponse = JSON.stringify({
      oneLiner: '今日 AI 趋势总结',
      hypeIndex: { score: 4, reason: '多个项目爆发式增长' },
      hot: ['项目 1', '项目 2'],
      action: ['建议 1', '建议 2']
    });

    const briefDataForParse = {
      trending_repos: [
        { name: '项目 1', url: 'https://github.com/test/repo1', stars: 1000, language: 'JavaScript' },
        { name: '项目 2', url: 'https://github.com/test/repo2', stars: 2000, language: 'Python' }
      ]
    };

    const insights1 = analyzer.parseInsights(standardResponse, briefDataForParse);
    assert(insights1.oneLiner === '今日 AI 趋势总结', '标准 JSON 解析正确');
    assert(insights1.hypeIndex.score === 4, 'hypeIndex 解析正确');
    assert(insights1.hot.length === 2, 'hot 数组解析正确');
    assert(insights1.action.length === 2, 'action 数组解析正确');

    // 测试 2: Markdown 代码块包裹的 JSON
    const markdownResponse = '```json\n' + JSON.stringify({
      oneLiner: 'Markdown 格式响应',
      hypeIndex: { score: 3, reason: '测试' },
      hot: [],
      action: []
    }) + '\n```';

    const insights2 = analyzer.parseInsights(markdownResponse, briefDataForParse);
    assert(insights2.oneLiner === 'Markdown 格式响应', 'Markdown 代码块 JSON 解析正确');

    // 测试 3: 无代码块标记的 JSON
    const plainJsonResponse = '{ "oneLiner": "纯 JSON 响应", "hypeIndex": { "score": 2 }, "hot": [], "action": [] }';
    const insights3 = analyzer.parseInsights(plainJsonResponse, briefDataForParse);
    assert(insights3.oneLiner === '纯 JSON 响应', '纯 JSON 解析正确');

    // 测试 4: 项目 URL 补充
    const responseWithProjects = JSON.stringify({
      oneLiner: '测试',
      hypeIndex: { score: 3, reason: '测试' },
      hot: [],
      project_insights: [
        { project_name: '项目 1', analysis: '项目 1 分析' },
        { project_name: '项目 2', analysis: '项目 2 分析' }
      ],
      action: []
    });

    const insights4 = analyzer.parseInsights(responseWithProjects, briefDataForParse);
    assert(insights4.project_insights[0].github_url === 'https://github.com/test/repo1', '项目 1 URL 补充正确');
    assert(insights4.project_insights[0].stars === 1000, '项目 1 stars 补充正确');
    assert(insights4.project_insights[0].language === 'JavaScript', '项目 1 language 补充正确');
    assert(insights4.project_insights[1].github_url === 'https://github.com/test/repo2', '项目 2 URL 补充正确');

    // 测试 5: 解析失败时的降级处理
    const invalidResponse = '这是一个无效的响应，不是 JSON 格式';
    const insights5 = analyzer.parseInsights(invalidResponse, briefDataForParse);
    assert(insights5.oneLiner, '解析失败时有降级处理');
    assert(insights5.hypeIndex, '解析失败时 hypeIndex 有默认值');
    assert(Array.isArray(insights5.hot), '解析失败时 hot 是数组');
    assert(Array.isArray(insights5.action), '解析失败时 action 是数组');

    // 测试 6: 包含额外文本的 JSON
    const mixedResponse = '好的，这是我的分析：\n\n```json\n' + JSON.stringify({
      oneLiner: '混合响应',
      hypeIndex: { score: 4, reason: '测试' },
      hot: [],
      action: []
    }) + '\n```\n\n希望这对你有帮助！';

    const insights6 = analyzer.parseInsights(mixedResponse, briefDataForParse);
    assert(insights6.oneLiner === '混合响应', '混合响应解析正确');

    // ==================== 新旧格式兼容测试 ====================
    console.log('\n📦 新旧格式兼容测试：\n');
    
    // 新格式响应
    const newFormatResponse = JSON.stringify({
      summary: '新格式总结',
      project_insights: [
        { project_name: '项目 1', analysis: '分析 1' }
      ],
      trends: {
        shortTerm: ['短期趋势 1'],
        longTerm: ['长期趋势 1']
      },
      recommendations: {
        developers: ['开发者建议 1']
      }
    });

    const insightsNew = analyzer.parseInsights(newFormatResponse, briefDataForParse);
    assert(insightsNew.summary === '新格式总结', '新格式 summary 解析正确');
    assert(insightsNew.project_insights, '新格式 project_insights 解析正确');

    // 旧格式响应
    const oldFormatResponse = JSON.stringify({
      oneLiner: '旧格式总结',
      hot: ['热点 1'],
      shortTerm: ['短期趋势 1'],
      longTerm: ['长期趋势 1'],
      action: ['建议 1']
    });

    const insightsOld = analyzer.parseInsights(oldFormatResponse, briefDataForParse);
    assert(insightsOld.oneLiner === '旧格式总结', '旧格式 oneLiner 解析正确');
    assert(insightsOld.hot[0] === '热点 1', '旧格式 hot 解析正确');
    assert(insightsOld.shortTerm[0] === '短期趋势 1', '旧格式 shortTerm 解析正确');
    assert(insightsOld.action[0] === '建议 1', '旧格式 action 解析正确');

  } catch (error) {
    console.log(`  ❌ 测试执行失败：${error.message}`);
    console.log(error.stack);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  测试结果：${passedTests}/${totalTests} 通过`);
  console.log('='.repeat(60) + '\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests();
