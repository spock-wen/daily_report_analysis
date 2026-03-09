#!/usr/bin/env node
/**
 * HTMLGenerator 模块测试
 */

const HTMLGenerator = require('../../src/generator/html-generator');

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
  console.log('  HTMLGenerator 模块测试');
  console.log('='.repeat(60) + '\n');

  try {
    const generator = new HTMLGenerator();

    // ==================== 实例化测试 ====================
    console.log('📦 实例化测试：\n');
    assert(generator instanceof HTMLGenerator, 'HTMLGenerator 可实例化');
    assert(typeof generator.generateDaily === 'function', 'generateDaily 方法存在');
    assert(typeof generator.generateWeekly === 'function', 'generateWeekly 方法存在');
    assert(typeof generator.generateMonthly === 'function', 'generateMonthly 方法存在');
    assert(typeof generator.renderDailyHTML === 'function', 'renderDailyHTML 方法存在');
    assert(typeof generator.renderWeeklyHTML === 'function', 'renderWeeklyHTML 方法存在');
    assert(typeof generator.renderMonthlyHTML === 'function', 'renderMonthlyHTML 方法存在');
    assert(typeof generator.renderStatsSection === 'function', 'renderStatsSection 方法存在');
    assert(typeof generator.renderProjectListSection === 'function', 'renderProjectListSection 方法存在');
    assert(typeof generator.renderAIInsightsSection === 'function', 'renderAIInsightsSection 方法存在');
    assert(typeof generator.formatNumber === 'function', 'formatNumber 方法存在');
    assert(typeof generator.renderDetailItems === 'function', 'renderDetailItems 方法存在');

    // ==================== formatNumber 测试 ====================
    console.log('\n📦 formatNumber 方法测试：\n');
    assert(generator.formatNumber(1000) === '1,000', '千位分隔符正确');
    assert(generator.formatNumber(1000000) === '1,000,000', '百万位分隔符正确');
    assert(generator.formatNumber(500) === '500', '小于 1000 的数字正确');
    assert(generator.formatNumber(1234567) === '1,234,567', '多位数字分隔符正确');

    // ==================== renderDetailItems 测试 ====================
    console.log('\n📦 renderDetailItems 方法测试：\n');
    
    const items = ['功能 1', '功能 2', '功能 3'];
    const renderedItems = generator.renderDetailItems(items);
    assert(renderedItems.includes('<li>功能 1</li>'), '渲染列表项 1');
    assert(renderedItems.includes('<li>功能 2</li>'), '渲染列表项 2');
    assert(renderedItems.includes('<li>功能 3</li>'), '渲染列表项 3');

    // 测试空数组
    const emptyItems = generator.renderDetailItems([]);
    assert(emptyItems.includes('暂无数据'), '空数组显示暂无数据');

    // 测试 null
    const nullItems = generator.renderDetailItems(null);
    assert(nullItems.includes('暂无数据'), 'null 显示暂无数据');

    // 测试 undefined
    const undefinedItems = generator.renderDetailItems(undefined);
    assert(undefinedItems.includes('暂无数据'), 'undefined 显示暂无数据');

    // ==================== renderDailyHTML 测试 ====================
    console.log('\n📦 renderDailyHTML 方法测试：\n');
    
    const mockDailyData = {
      date: '2026-03-09',
      brief: {
        trending_repos: [
          {
            name: 'test/repo1',
            description: '测试项目 1',
            url: 'https://github.com/test/repo1',
            stars: 1000,
            forks: 100,
            language: 'JavaScript',
            isAI: true,
            todayStars: 500,
            core_features: ['功能 1', '功能 2'],
            use_cases: ['场景 1'],
            trend_data: ['趋势 1']
          }
        ],
        stats: {
          total_projects: 1,
          ai_projects: 1,
          avg_stars: 1000,
          hot_projects: 1
        }
      },
      aiInsights: {
        summary: 'AI 分析总结',
        project_insights: [
          { project_name: 'test/repo1', analysis: '项目分析' }
        ],
        hot: ['热点 1'],
        action: ['建议 1']
      }
    };

    const dailyHTML = generator.renderDailyHTML(mockDailyData);
    assert(typeof dailyHTML === 'string', '返回字符串');
    assert(dailyHTML.includes('<!DOCTYPE html>'), '包含 DOCTYPE 声明');
    assert(dailyHTML.includes('lang="zh-CN"'), '包含中文语言设置');
    assert(dailyHTML.includes('GitHub AI Trending 日报'), '包含标题');
    assert(dailyHTML.includes('2026-03-09'), '包含日期');
    assert(dailyHTML.includes('test/repo1'), '包含项目名称');
    assert(dailyHTML.includes('测试项目 1'), '包含项目描述');
    assert(dailyHTML.includes('1,000'), '包含格式化后的 stars');
    assert(dailyHTML.includes('+500'), '包含今日 stars');
    assert(dailyHTML.includes('JavaScript'), '包含编程语言');
    assert(dailyHTML.includes('功能 1'), '包含核心功能');
    assert(dailyHTML.includes('场景 1'), '包含使用场景');
    assert(dailyHTML.includes('AI 深度洞察'), '包含 AI 洞察部分');
    assert(dailyHTML.includes('AI 分析总结'), '包含 AI 总结');
    assert(dailyHTML.includes('toggleDetails'), '包含展开详情函数');

    // 测试空数据
    const emptyDailyData = {
      date: '2026-03-09',
      brief: { trending_repos: [], stats: {} },
      aiInsights: null
    };
    const emptyDailyHTML = generator.renderDailyHTML(emptyDailyData);
    assert(emptyDailyHTML.includes('暂无数据'), '空数据有提示');
    assert(emptyDailyHTML.includes('AI 分析尚未完成'), '无 AI 洞察有提示');

    // ==================== renderStatsSection 测试 ====================
    console.log('\n📦 renderStatsSection 方法测试：\n');
    
    const stats = {
      total_projects: 10,
      ai_projects: 8,
      avg_stars: 1500,
      hot_projects: 3
    };
    const statsHTML = generator.renderStatsSection(stats);
    assert(statsHTML.includes('上榜项目'), '包含上榜项目标签');
    assert(statsHTML.includes('10'), '包含总项目数');
    assert(statsHTML.includes('AI 项目'), '包含 AI 项目标签');
    assert(statsHTML.includes('8'), '包含 AI 项目数');
    assert(statsHTML.includes('平均 Stars'), '包含平均 Stars 标签');
    assert(statsHTML.includes('1,500'), '包含格式化后的平均 stars');
    assert(statsHTML.includes('高热项目'), '包含高热项目标签');
    assert(statsHTML.includes('3'), '包含高热项目数');

    // 测试缺失字段
    const partialStats = { total_projects: 5 };
    const partialStatsHTML = generator.renderStatsSection(partialStats);
    assert(partialStatsHTML.includes('5'), '部分统计数据正常渲染');
    assert(partialStatsHTML.includes('0'), '缺失字段显示 0');

    // ==================== renderProjectListSection 测试 ====================
    console.log('\n📦 renderProjectListSection 方法测试：\n');
    
    const projects = [
      {
        name: 'test/repo1',
        description: '项目 1 描述',
        url: 'https://github.com/test/repo1',
        stars: 2000,
        forks: 200,
        language: 'Python',
        todayStars: 800,
        core_features: ['功能 A', '功能 B'],
        use_cases: ['场景 A'],
        trend_data: []
      },
      {
        name: 'test/repo2',
        description: '项目 2 描述',
        url: 'https://github.com/test/repo2',
        stars: 1500,
        forks: 150,
        language: '', // 无语言
        todayStars: 300,
        core_features: [],
        use_cases: [],
        trend_data: []
      }
    ];

    const projectsHTML = generator.renderProjectListSection(projects);
    assert(projectsHTML.includes('test/repo1'), '包含项目 1 名称');
    assert(projectsHTML.includes('test/repo2'), '包含项目 2 名称');
    assert(projectsHTML.includes('项目 1 描述'), '包含项目 1 描述');
    assert(projectsHTML.includes('项目 2 描述'), '包含项目 2 描述');
    assert(projectsHTML.includes('2,000'), '包含项目 1 stars');
    assert(projectsHTML.includes('+800'), '包含项目 1 今日 stars');
    assert(projectsHTML.includes('Python'), '包含项目 1 语言');
    assert(projectsHTML.includes('功能 A'), '包含核心功能');
    assert(projectsHTML.includes('场景 A'), '包含使用场景');
    assert(!projectsHTML.includes('undefined'), '不包含 undefined');

    // 测试空项目列表
    const emptyProjectsHTML = generator.renderProjectListSection([]);
    assert(emptyProjectsHTML.includes('暂无数据'), '空列表有提示');

    // ==================== renderAIInsightsSection 测试 ====================
    console.log('\n📦 renderAIInsightsSection 方法测试：\n');
    
    const aiInsights = {
      summary: '今日 AI 趋势总结',
      hypeIndex: {
        score: 4,
        reason: '多个项目表现突出'
      },
      hot: ['test/repo1 引领趋势', 'test/repo2 快速增长'],
      project_insights: [
        { project_name: 'test/repo1', analysis: '深入分析 1', github_url: 'https://github.com/test/repo1' },
        { project_name: 'test/repo2', analysis: '深入分析 2', github_url: 'https://github.com/test/repo2' }
      ],
      trends: ['趋势 1', '趋势 2'],
      recommendations: ['建议 1', '建议 2']
    };

    const trendingRepos = [
      { name: 'test/repo1', url: 'https://github.com/test/repo1' },
      { name: 'test/repo2', url: 'https://github.com/test/repo2' }
    ];

    const insightsHTML = generator.renderAIInsightsSection(aiInsights, trendingRepos);
    assert(insightsHTML.includes('AI 深度洞察'), '包含 AI 洞察标题');
    assert(insightsHTML.includes('今日 AI 趋势总结'), '包含总结');
    assert(insightsHTML.includes('热度指数'), '包含热度指数');
    assert(insightsHTML.includes('4/5'), '包含热度分数');
    assert(insightsHTML.includes('热点项目'), '包含热点部分');
    assert(insightsHTML.includes('重点项目分析'), '包含重点项目分析');
    assert(insightsHTML.includes('趋势观察'), '包含趋势部分');
    assert(insightsHTML.includes('推荐建议'), '包含建议部分');
    assert(insightsHTML.includes('href="https://github.com/test/repo1"'), '包含项目链接');

    // 测试无 AI 洞察
    const noInsightsHTML = generator.renderAIInsightsSection(null, []);
    assert(noInsightsHTML.includes('AI 分析尚未完成'), '无 AI 洞察有提示');

    // 测试旧格式兼容
    const oldFormatInsights = {
      oneLiner: '旧格式总结',
      hot: ['热点 1'],
      shortTerm: ['短期趋势 1'],
      action: ['建议 1']
    };
    const oldFormatHTML = generator.renderAIInsightsSection(oldFormatInsights, []);
    assert(oldFormatHTML.includes('旧格式总结'), '旧格式 oneLiner 兼容');
    assert(oldFormatHTML.includes('热点 1'), '旧格式 hot 兼容');
    assert(oldFormatHTML.includes('建议 1'), '旧格式 action 兼容');

    // ==================== renderWeeklyHTML 测试 ====================
    console.log('\n📦 renderWeeklyHTML 方法测试：\n');
    
    const mockWeeklyData = {
      weekStart: '2026-03-03',
      weekEnd: '2026-03-09',
      weekLabel: '第 11 周',
      brief: {
        trending_repos: [
          {
            name: 'test/weekly-repo',
            description: '周报测试项目',
            stars: 3000,
            forks: 300,
            language: 'TypeScript',
            todayStars: 1200,
            isAI: true,
            analysis: {
              coreFunctions: ['周功能 1'],
              useCases: ['周场景 1'],
              trends: ['周趋势 1'],
              typeName: 'AI 工具'
            }
          }
        ],
        stats: {
          total_projects: 1,
          ai_projects: 1,
          avg_stars: 3000
        }
      },
      aiInsights: {
        weeklyTheme: {
          oneLiner: '本周主题：AI 工具爆发',
          detailed: '详细描述'
        },
        highlights: ['亮点 1'],
        trends: {
          shortTerm: ['短期趋势 1']
        },
        emergingFields: [{ field: '新兴领域', description: '领域描述' }],
        recommendations: {
          developers: ['开发者建议 1']
        },
        topProjects: [
          {
            repo: 'test/weekly-repo',
            category: '技术创新',
            reason: '入选理由',
            value: '核心价值'
          }
        ]
      }
    };

    const weeklyHTML = generator.renderWeeklyHTML(mockWeeklyData);
    assert(weeklyHTML.includes('GitHub AI Trending 周报'), '包含周报标题');
    assert(weeklyHTML.includes('第 11 周'), '包含周标签');
    // 注意：当 weekLabel 存在时，优先显示 weekLabel 而不是日期范围
    assert(weeklyHTML.includes('周度主题'), '包含周度主题部分');
    assert(weeklyHTML.includes('AI 工具爆发'), '包含主题内容');
    assert(weeklyHTML.includes('本周热点'), '包含热点部分');
    assert(weeklyHTML.includes('重点项目推荐'), '包含重点项目推荐');
    assert(weeklyHTML.includes('完整项目列表'), '包含完整项目列表');
    assert(weeklyHTML.includes('AI 工具'), '包含项目分组');
    
    // 测试无 weekLabel 时显示日期范围
    const noLabelWeeklyData = { ...mockWeeklyData, weekLabel: undefined };
    const noLabelHTML = generator.renderWeeklyHTML(noLabelWeeklyData);
    assert(noLabelHTML.includes('2026-03-03'), '无标签时包含周起始日期');
    assert(noLabelHTML.includes('2026-03-09'), '无标签时包含周结束日期');

    // ==================== renderMonthlyHTML 测试 ====================
    console.log('\n📦 renderMonthlyHTML 方法测试：\n');
    
    const mockMonthlyData = {
      month: '2026-03',
      brief: {
        trending_repos: [
          {
            name: 'test/monthly-repo',
            description: '月报测试项目',
            stars: 5000,
            forks: 500,
            language: 'Rust',
            todayStars: 2000
          }
        ],
        stats: {
          total_projects: 1,
          ai_projects: 1,
          avg_stars: 5000
        }
      },
      aiInsights: {
        summary: '月度总结'
      }
    };

    const monthlyHTML = generator.renderMonthlyHTML(mockMonthlyData);
    assert(monthlyHTML.includes('GitHub AI Trending 日报'), '月报使用日报模板');
    assert(monthlyHTML.includes('2026-03'), '包含月份');
    assert(monthlyHTML.includes('月度总结'), '包含月度总结');

    // ==================== 项目链接映射测试 ====================
    console.log('\n📦 项目链接映射测试：\n');
    
    const insightsWithLinks = {
      summary: '分析 test/repo1 和 test/repo2 两个项目',
      hot: ['test/repo1 表现突出', 'test/repo2 快速增长'],
      project_insights: [],
      trends: [],
      recommendations: []
    };

    const linkedHTML = generator.renderAIInsightsSection(insightsWithLinks, trendingRepos);
    assert(linkedHTML.includes('href="https://github.com/test/repo1"'), '项目名自动添加链接 1');
    assert(linkedHTML.includes('href="https://github.com/test/repo2"'), '项目名自动添加链接 2');

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
