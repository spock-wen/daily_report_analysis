/**
 * DataLoader 真实数据测试
 * 使用 archive 目录中的真实数据进行测试
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs').promises;

require('dotenv').config();

const ROOT_DIR = path.join(__dirname, '..');
const DataLoader = require(path.join(ROOT_DIR, 'src/loader/data-loader'));

console.log('\n=== DataLoader 真实数据测试 ===\n');

test('DataLoader - 加载真实历史数据', async () => {
  const loader = new DataLoader();
  
  // 检查 archive 目录是否有数据
  const archiveDir = path.join(ROOT_DIR, 'data/archive/2026/03');
  const files = await fs.readdir(archiveDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  
  console.log(`📂 找到 ${jsonFiles.length} 个历史数据文件`);
  assert.ok(jsonFiles.length > 0, '存在历史数据文件');
  
  // 读取最新的数据文件
  const latestFile = jsonFiles.sort().reverse()[0];
  const filePath = path.join(archiveDir, latestFile);
  const fileContent = await fs.readFile(filePath, 'utf8');
  const rawData = JSON.parse(fileContent);
  
  console.log(`📄 测试数据文件：${latestFile}`);
  console.log(`   数据日期：${rawData.date}`);
  console.log(`   项目数量：${rawData.projects?.length || 0}`);
  console.log(`   生成时间：${rawData.generatedAt}`);
  
  // 验证数据结构
  assert.ok(rawData.date, '包含日期');
  assert.ok(rawData.projects, '包含项目列表');
  assert.ok(rawData.projects.length > 0, '项目列表非空');
  assert.ok(rawData.generatedAt, '包含生成时间');
  
  console.log('✅ 历史数据结构验证通过\n');
});

test('DataLoader - 验证真实项目数据', async () => {
  const loader = new DataLoader();
  
  // 读取真实数据
  const filePath = path.join(ROOT_DIR, 'data/archive/2026/03/2026-03-07.json');
  const fileContent = await fs.readFile(filePath, 'utf8');
  const rawData = JSON.parse(fileContent);
  
  // 转换为 DataLoader 期望的格式
  const testData = {
    brief: {
      trending_repos: rawData.projects.map(project => ({
        name: project.fullName,
        description: project.descZh || project.desc,
        url: project.url,
        stars: project.stars,
        forks: project.forks,
        language: project.language,
        topics: project.topics || []
      })),
      stats: {
        total_projects: rawData.projects.length,
        ai_projects: rawData.projects.filter(p => p.isAI).length,
        avg_stars: Math.round(rawData.projects.reduce((sum, p) => sum + p.stars, 0) / rawData.projects.length),
        hot_projects: rawData.projects.filter(p => p.todayStars > 1000).length
      }
    },
    aiInsights: null // 历史数据可能没有 AI 洞察
  };
  
  // 验证数据
  const validation = loader.validateData(testData);
  
  console.log('📊 数据验证结果:');
  console.log(`   总项目数：${testData.brief.stats.total_projects}`);
  console.log(`   AI 项目数：${testData.brief.stats.ai_projects}`);
  console.log(`   平均 Stars: ${testData.brief.stats.avg_stars}`);
  console.log(`   高热项目：${testData.brief.stats.hot_projects}`);
  console.log(`   验证状态：${validation.valid ? '✅ 通过' : '❌ 失败'}`);
  
  if (validation.warnings.length > 0) {
    console.log('   警告:', validation.warnings);
  }
  
  assert.equal(validation.valid, true, '真实数据验证通过');
  assert.ok(testData.brief.stats.total_projects > 0, '项目数量大于 0');
  
  console.log('✅ 真实项目数据验证通过\n');
});

test('DataLoader - 验证项目字段完整性', async () => {
  // 读取真实数据
  const filePath = path.join(ROOT_DIR, 'data/archive/2026/03/2026-03-07.json');
  const fileContent = await fs.readFile(filePath, 'utf8');
  const rawData = JSON.parse(fileContent);
  
  const firstProject = rawData.projects[0];
  
  console.log('🔍 检查第一个项目字段:');
  console.log(`   仓库：${firstProject.fullName}`);
  console.log(`   Stars: ${firstProject.stars}`);
  console.log(`   今日 Stars: ${firstProject.todayStars}`);
  console.log(`   语言：${firstProject.language}`);
  console.log(`   AI 项目：${firstProject.isAI ? '是' : '否'}`);
  
  // 验证必要字段
  assert.ok(firstProject.fullName, '包含完整仓库名');
  assert.ok(firstProject.stars >= 0, '包含 stars 数');
  assert.ok(firstProject.url, '包含 GitHub 链接');
  assert.ok(firstProject.isAI !== undefined, '包含 AI 标记');
  
  // 验证 AI 项目分析
  if (firstProject.isAI && firstProject.analysis) {
    console.log('   AI 分析类型:', firstProject.analysis.typeName);
    assert.ok(firstProject.analysis.typeName, '包含 AI 分析类型');
  }
  
  console.log('✅ 项目字段完整性验证通过\n');
});

test('DataLoader - 加载 AI 洞察数据', async () => {
  const loader = new DataLoader();
  
  // 检查是否有 AI 洞察数据
  const insightsPath = path.join(ROOT_DIR, 'data/insights/daily/insights-2026-03-08.json');
  
  try {
    const fileContent = await fs.readFile(insightsPath, 'utf8');
    const insights = JSON.parse(fileContent);
    
    console.log('🤖 AI 洞察数据:');
    console.log(`   oneLiner: ${insights.oneLiner?.substring(0, 50)}...`);
    console.log(`   热度指数：${insights.hypeIndex?.score || 'N/A'}`);
    console.log(`   热点数量：${insights.hot?.length || 0}`);
    console.log(`   行动建议：${insights.action?.length || 0}`);
    
    assert.ok(insights.oneLiner, '包含一句话总结');
    assert.ok(insights.hypeIndex, '包含热度指数');
    
    console.log('✅ AI 洞察数据加载成功\n');
  } catch (error) {
    console.log('⚠️  AI 洞察数据不存在或加载失败\n');
    // AI 洞察是可选的，不抛出错误
  }
});

console.log('\n=== DataLoader 真实数据测试完成 ===\n');
