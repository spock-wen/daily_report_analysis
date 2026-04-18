#!/usr/bin/env node
/**
 * WikiIndexGenerator 模块测试
 */

const path = require('path');
const fs = require('fs');
const WikiIndexGenerator = require('../../src/generator/wiki-index-generator');

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
  console.log('  WikiIndexGenerator 模块测试');
  console.log('============================================================\n');

  const testWikiDir = path.join(__dirname, '../fixtures/wiki-test');
  const testOutputDir = path.join(__dirname, '../fixtures/wiki-output');

  // 清理并创建测试目录
  if (fs.existsSync(testWikiDir)) {
    fs.rmSync(testWikiDir, { recursive: true });
  }
  fs.mkdirSync(testWikiDir, { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'papers'), { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'domains'), { recursive: true });

  if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true });
  }
  fs.mkdirSync(testOutputDir, { recursive: true });

  // 创建测试 Wiki 文件
  fs.writeFileSync(path.join(testWikiDir, 'projects', 'owner_repo1.md'), `# owner/repo1

## 基本信息
- 首次上榜：2026-04-01
- 最近上榜：2026-04-15
- 上榜次数：5
- 领域分类：agent
- 语言：Python
- GitHub Stars: 5,000
`);

  fs.writeFileSync(path.join(testWikiDir, 'projects', 'owner_repo2.md'), `# owner/repo2

## 基本信息
- 首次上榜：2026-04-05
- 最近上榜：2026-04-14
- 上榜次数：3
- 领域分类：rag
- 语言：JavaScript
- GitHub Stars: 3,000
`);

  fs.writeFileSync(path.join(testWikiDir, 'papers', '2401.12345.md'), `# Test Paper Title

## 基本信息
- arXiv ID: 2401.12345
- 发布日期：2024-01-15
- 首次收录：2026-04-10
- 论文类型：Research
- 领域分类：LLM
`);

  fs.writeFileSync(path.join(testWikiDir, 'domains', 'agent.md'), `# agent 领域

## 领域概览
Agent 领域是当前最热门的领域之一。

## 相关项目
- owner/repo1
`);

  const generator = new WikiIndexGenerator({
    baseDir: testWikiDir,
    outputDir: testOutputDir
  });

  try {
    // ==================== 实例化测试 ====================
    console.log('📦 实例化测试：\n');

    assert(generator instanceof WikiIndexGenerator, 'WikiIndexGenerator 可实例化');
    assert(typeof generator.generate === 'function', 'generate 方法存在');

    // ==================== 生成索引页测试 ====================
    console.log('\n📦 generate 方法测试：\n');

    const outputPath = await generator.generate();
    assert(fs.existsSync(outputPath), '索引页文件创建成功');
    assert(outputPath.includes('wiki-index.html'), '输出文件名正确');

    const htmlContent = fs.readFileSync(outputPath, 'utf-8');

    // 验证 HTML 结构
    assert(htmlContent.includes('<!DOCTYPE html>'), '包含 DOCTYPE 声明');
    assert(htmlContent.includes('AI Project Wiki'), '包含 Wiki 标题');
    assert(htmlContent.includes('收录项目'), '包含统计标签');
    assert(htmlContent.includes('owner/repo1'), '包含项目 1');
    assert(htmlContent.includes('owner/repo2'), '包含项目 2');
    assert(htmlContent.includes('2401.12345'), '包含论文 arXiv ID');
    assert(htmlContent.includes('agent'), '包含领域');

    // 验证统计数据
    assert(htmlContent.includes('2'), '项目数量正确');
    assert(htmlContent.includes('1'), '论文数量正确');

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
