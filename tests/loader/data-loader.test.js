#!/usr/bin/env node
/**
 * DataLoader 模块测试
 */

const path = require('path');
const DataLoader = require('../../src/loader/data-loader');

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
  console.log('  DataLoader 模块测试');
  console.log('='.repeat(60) + '\n');

  try {
    const loader = new DataLoader();

    // ==================== 实例化测试 ====================
    console.log('📦 实例化测试：\n');
    assert(loader instanceof DataLoader, 'DataLoader 可实例化');
    assert(typeof loader.loadDailyData === 'function', 'loadDailyData 方法存在');
    assert(typeof loader.loadWeeklyData === 'function', 'loadWeeklyData 方法存在');
    assert(typeof loader.loadMonthlyData === 'function', 'loadMonthlyData 方法存在');
    assert(typeof loader.normalizeDataFormat === 'function', 'normalizeDataFormat 方法存在');
    assert(typeof loader.validateData === 'function', 'validateData 方法存在');

    // ==================== 数据格式标准化测试 ====================
    console.log('\n📦 数据格式标准化测试：\n');
    
    // 测试 1: 新格式数据（包含 trending_repos）
    const newDataFormat = {
      trending_repos: [
        {
          name: 'owner/repo',
          description: '测试项目',
          url: 'https://github.com/owner/repo',
          stars: 1000,
          forks: 100,
          language: 'JavaScript',
          isAI: true,
          todayStars: 500
        }
      ],
      stats: {
        total_projects: 1,
        ai_projects: 1
      }
    };

    const normalizedNew = loader.normalizeDataFormat(newDataFormat);
    assert(normalizedNew.trending_repos, '新格式标准化后包含 trending_repos');
    assert(normalizedNew.trending_repos.length === 1, '新格式项目数量正确');
    assert(normalizedNew.trending_repos[0].name === 'owner/repo', '新格式项目名称正确');
    assert(normalizedNew.stats, '新格式包含统计数据');

    // 测试 2: 旧格式数据（包含 projects）
    const oldDataFormat = {
      projects: [
        {
          fullName: 'owner/old-repo',
          descZh: '旧格式测试项目',
          url: 'https://github.com/owner/old-repo',
          stars: 2000,
          forks: 200,
          language: 'Python',
          isAI: true,
          todayStars: 800,
          analysis: {
            coreFunctions: ['功能 1', '功能 2'],
            useCases: ['场景 1'],
            trends: ['趋势 1']
          }
        }
      ]
    };

    const normalizedOld = loader.normalizeDataFormat(oldDataFormat);
    assert(normalizedOld.trending_repos, '旧格式标准化后包含 trending_repos');
    assert(normalizedOld.trending_repos.length === 1, '旧格式项目数量正确');
    assert(normalizedOld.trending_repos[0].name === 'owner/old-repo', '旧格式项目名称正确');
    assert(normalizedOld.trending_repos[0].description === '旧格式测试项目', '旧格式描述正确');
    assert(normalizedOld.trending_repos[0].core_features, '旧格式转换后包含 core_features');
    assert(normalizedOld.trending_repos[0].core_features.length === 2, '旧格式 core_features 数量正确');
    assert(normalizedOld.trending_repos[0].use_cases, '旧格式转换后包含 use_cases');
    assert(normalizedOld.trending_repos[0].trend_data, '旧格式转换后包含 trend_data');
    assert(normalizedOld.stats, '旧格式包含统计数据');
    assert(normalizedOld.stats.total_projects === 1, '旧格式统计正确');

    // 测试 3: 空数据
    const emptyData = {};
    const normalizedEmpty = loader.normalizeDataFormat(emptyData);
    assert(normalizedEmpty.trending_repos, '空数据标准化后包含 trending_repos');
    assert(normalizedEmpty.trending_repos.length === 0, '空数据项目数量为 0');
    assert(normalizedEmpty.stats, '空数据包含统计数据');

    // 测试 4: 统计数据默认值
    const noStatsData = {
      projects: [
        { fullName: 'test/repo1', stars: 1000, isAI: true, todayStars: 1500 },
        { fullName: 'test/repo2', stars: 2000, isAI: false, todayStars: 200 }
      ]
    };
    const normalizedNoStats = loader.normalizeDataFormat(noStatsData);
    assert(normalizedNoStats.stats.total_projects === 2, '自动计算总项目数');
    assert(normalizedNoStats.stats.ai_projects === 1, '自动计算 AI 项目数');
    assert(normalizedNoStats.stats.avg_stars === 1500, '自动计算平均 Stars');
    assert(normalizedNoStats.stats.hot_projects === 1, '自动计算高热项目数（todayStars > 1000）');

    // ==================== 数据验证测试 ====================
    console.log('\n📦 数据验证测试：\n');
    
    // 测试 1: 完整有效数据
    const validData = {
      brief: {
        trending_repos: [],
        stats: {}
      },
      aiInsights: {
        summary: '测试总结',
        project_insights: []
      }
    };

    const validation = loader.validateData(validData);
    assert(validation.valid === true, '完整有效数据验证通过');
    assert(validation.errors.length === 0, '完整有效数据无错误');

    // 测试 2: 缺少 brief
    const noBriefData = {};
    const noBriefValidation = loader.validateData(noBriefData);
    assert(noBriefValidation.valid === false, '缺少 brief 验证失败');
    assert(noBriefValidation.errors.length > 0, '缺少 brief 有错误提示');

    // 测试 3: 缺少 trending_repos（警告）
    const noTrendingData = {
      brief: { stats: {} }
    };
    const noTrendingValidation = loader.validateData(noTrendingData);
    assert(noTrendingValidation.valid === true, '缺少 trending_repos 验证通过（仅警告）');
    assert(noTrendingValidation.warnings.some(w => w.includes('trending_repos')), '缺少 trending_repos 有警告');

    // 测试 4: 缺少 stats（警告）
    const noStatsValidationData = {
      brief: { trending_repos: [] }
    };
    const noStatsValidation = loader.validateData(noStatsValidationData);
    assert(noStatsValidation.valid === true, '缺少 stats 验证通过（仅警告）');
    assert(noStatsValidation.warnings.some(w => w.includes('stats')), '缺少 stats 有警告');

    // 测试 5: AI 洞察缺少 summary（警告）
    const noSummaryData = {
      brief: { trending_repos: [], stats: {} },
      aiInsights: { project_insights: [] }
    };
    const noSummaryValidation = loader.validateData(noSummaryData);
    assert(noSummaryValidation.valid === true, 'AI 洞察缺少 summary 验证通过（仅警告）');
    assert(noSummaryValidation.warnings.some(w => w.includes('summary')), 'AI 洞察缺少 summary 有警告');

    // 测试 6: AI 洞察缺少 project_insights（警告）
    const noProjectInsightsData = {
      brief: { trending_repos: [], stats: {} },
      aiInsights: { summary: '测试' }
    };
    const noProjectInsightsValidation = loader.validateData(noProjectInsightsData);
    assert(noProjectInsightsValidation.valid === true, 'AI 洞察缺少 project_insights 验证通过（仅警告）');
    assert(noProjectInsightsValidation.warnings.some(w => w.includes('project_insights')), 'AI 洞察缺少 project_insights 有警告');

    // ==================== 边界条件测试 ====================
    console.log('\n📦 边界条件测试：\n');
    
    // 测试 1: 项目数据字段缺失
    const incompleteProjectData = {
      projects: [
        { fullName: 'test/repo' } // 缺少其他字段
      ]
    };
    const normalizedIncomplete = loader.normalizeDataFormat(incompleteProjectData);
    assert(normalizedIncomplete.trending_repos[0].stars === 0, '缺失 stars 字段默认为 0');
    assert(normalizedIncomplete.trending_repos[0].forks === 0, '缺失 forks 字段默认为 0');
    assert(normalizedIncomplete.trending_repos[0].language === '', '缺失 language 字段默认为空字符串');
    assert(normalizedIncomplete.trending_repos[0].isAI === false, '缺失 isAI 字段默认为 false');
    assert(normalizedIncomplete.trending_repos[0].todayStars === 0, '缺失 todayStars 字段默认为 0');

    // 测试 2: 项目名称字段兼容性（trending_repos 格式）
    const nameVariationData = {
      trending_repos: [
        { name: 'test/repo1' },
        { name: 'test/repo2' }
      ]
    };
    const normalizedNameVar = loader.normalizeDataFormat(nameVariationData);
    assert(normalizedNameVar.trending_repos[0].name === 'test/repo1', 'name 字段正确');
    assert(normalizedNameVar.trending_repos[1].name === 'test/repo2', 'name 字段正确 2');

    // 测试 3: 描述字段兼容性
    const descVariationData = {
      projects: [
        { fullName: 'test/repo1', descZh: '中文描述' },
        { fullName: 'test/repo2', desc: '英文描述' }
      ]
    };
    const normalizedDescVar = loader.normalizeDataFormat(descVariationData);
    assert(normalizedDescVar.trending_repos[0].description === '中文描述', 'descZh 字段转换为 description');
    assert(normalizedDescVar.trending_repos[1].description === '英文描述', 'desc 字段转换为 description');

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
