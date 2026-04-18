#!/usr/bin/env node
/**
 * ComparisonGenerator 模块测试
 */

const path = require('path');
const fs = require('fs');
const ComparisonGenerator = require('../../src/generator/comparison-generator');

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
  console.log('\n============================================================');
  console.log('  ComparisonGenerator 模块测试');
  console.log('============================================================\n');

  const testWikiDir = path.join(__dirname, '../fixtures/wiki-test');
  const testOutputDir = path.join(__dirname, '../fixtures/comparison-output');

  // 清理并创建测试目录
  if (fs.existsSync(testWikiDir)) {
    fs.rmSync(testWikiDir, { recursive: true });
  }
  fs.mkdirSync(testWikiDir, { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'projects'), { recursive: true });

  if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true });
  }
  fs.mkdirSync(testOutputDir, { recursive: true });

  // 创建测试 Wiki 文件
  fs.writeFileSync(path.join(testWikiDir, 'projects', 'owner_repo1.md'), `# owner/repo1

## 基本信息
- 首次上榜：2026-04-01
- 最近上榜：2026-04-15
- 上榜次数：15
- 领域分类：agent
- 语言：Python
- GitHub Stars: 5,200

## 版本历史
### 2026-04-15 (日报收录)
**来源**: [日报 2026-04-15](...)
**分析**: 群体智能引擎

### 2026-04-10 (周报收录)
**来源**: [周报 2026-04-10](...)
**分析**: 多智能体协作框架

## 跨项目关联
（待分析）
`);

  fs.writeFileSync(path.join(testWikiDir, 'projects', 'owner_repo2.md'), `# owner/repo2

## 基本信息
- 首次上榜：2026-04-05
- 最近上榜：2026-04-14
- 上榜次数：8
- 领域分类：rag
- 语言：JavaScript
- GitHub Stars: 3,000

## 版本历史
### 2026-04-14 (日报收录)
**来源**: [日报 2026-04-14](...)
**分析**: RAG 检索增强生成

## 跨项目关联
（待分析）
`);

  const generator = new ComparisonGenerator({
    baseDir: testWikiDir,
    outputDir: testOutputDir
  });

  try {
    // ==================== 实例化测试 ====================
    console.log('📦 实例化测试：\n');

    assert(generator instanceof ComparisonGenerator, 'ComparisonGenerator 可实例化');
    assert(typeof generator.generate === 'function', 'generate 方法存在');
    assert(generator.wikiManager !== undefined, 'wikiManager 已初始化');
    assert(generator.analyzer !== undefined, 'analyzer 已初始化');

    // ==================== 生成对比页测试 ====================
    console.log('\n📦 generate 方法测试：\n');

    const outputPath = await generator.generate([
      { owner: 'owner', repo: 'repo1' },
      { owner: 'owner', repo: 'repo2' }
    ]);

    assert(fs.existsSync(outputPath), '对比页文件创建成功');
    assert(outputPath.includes('comparison-'), '输出文件名格式正确');

    const htmlContent = fs.readFileSync(outputPath, 'utf-8');

    // 验证 HTML 结构
    assert(htmlContent.includes('<!DOCTYPE html>'), '包含 DOCTYPE 声明');
    assert(htmlContent.includes('项目对比'), '包含标题');
    assert(htmlContent.includes('owner/repo1'), '包含项目 1');
    assert(htmlContent.includes('owner/repo2'), '包含项目 2');
    assert(htmlContent.includes('上榜次数'), '包含上榜次数维度');
    assert(htmlContent.includes('GitHub Stars'), '包含 Stars 维度');
    assert(htmlContent.includes('领域分类'), '包含领域维度');
    assert(htmlContent.includes('bar-fill'), '包含进度条样式');

    // 验证 Stars 解析
    const parsedStars1 = generator._parseStars('5,200');
    const parsedStars2 = generator._parseStars('3.5k');
    const parsedStars3 = generator._parseStars('1w');

    assert(parsedStars1 === 5200, 'Stars 解析正确 (5,200)');
    assert(parsedStars2 === 3500, 'Stars 解析正确 (3.5k)');
    assert(parsedStars3 === 10000, 'Stars 解析正确 (1w)');

    // ==================== Wiki 解析测试 ====================
    console.log('\n📦 Wiki 解析测试：\n');

    const wikiContent = fs.readFileSync(path.join(testWikiDir, 'projects', 'owner_repo1.md'), 'utf-8');
    const parsedData = generator._parseWikiContent(wikiContent);

    assert(parsedData.firstSeen === '2026-04-01', '首次上榜解析正确');
    assert(parsedData.appearances === 15, '上榜次数解析正确');
    assert(parsedData.domain === 'agent', '领域分类解析正确');
    assert(parsedData.language === 'Python', '语言解析正确');
    assert(parsedData.stars === '5,200', 'Stars 解析正确');

  } catch (error) {
    console.error(`\n❌ 测试执行失败：${error.message}`);
    console.error(error.stack);
  } finally {
    // 清理测试目录
    if (fs.existsSync(testWikiDir)) {
      fs.rmSync(testWikiDir, { recursive: true });
    }
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  }

  console.log('\n============================================================');
  console.log(`  测试结果：${passedTests}/${totalTests} 通过`);
  console.log('============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
