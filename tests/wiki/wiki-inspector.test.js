#!/usr/bin/env node
/**
 * Wiki Inspector 模块测试
 */

const path = require('path');
const fs = require('fs');
const WikiInspector = require('../../src/wiki/inspector/wiki-inspector');

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
  console.log('  WikiInspector 模块测试');
  console.log('============================================================\n');

  // 创建测试 Wiki 目录
  const testWikiDir = path.join(__dirname, '../fixtures/wiki-inspector-test');
  const testProjectsDir = path.join(testWikiDir, 'projects');
  const testDomainsDir = path.join(testWikiDir, 'domains');

  // 清理并创建测试目录
  if (fs.existsSync(testWikiDir)) {
    fs.rmSync(testWikiDir, { recursive: true });
  }
  fs.mkdirSync(testProjectsDir, { recursive: true });
  fs.mkdirSync(testDomainsDir, { recursive: true });

  // 创建测试 Wiki 文件
  const validWikiContent = `# test-owner/test-repo

## 基本信息
- 首次上榜：2026-04-19
- 最近上榜：2026-04-19
- 上榜次数：1
- 领域分类：agent
- 语言：TypeScript
- GitHub Stars: 1000（最后更新：2026-04-19）

## 核心功能
- 功能 1
- 功能 2

## 版本历史

### 2026-04-19（日报收录）
**来源**: [日报 2026-04-19](../../daily/github-ai-trending-2026-04-19.html)
**分析**: 测试分析

## 跨项目关联
`;

  const invalidWikiContent = `# bad-owner/bad-repo

## 基本信息
- 首次上榜：invalid-date
- 领域分类：invalid-domain
- GitHub Stars: not-a-number

## 核心功能

## 版本历史
`;

  const duplicateWikiContent = `# dup-owner/dup-repo

## 基本信息
- 首次上榜：2026-04-19
- 最近上榜：2026-04-19
- 上榜次数：2
- 领域分类：agent
- 语言：Python
- GitHub Stars: 500（最后更新：2026-04-19）

## 核心功能
- 功能 1

## 版本历史

### 2026-04-19（日报收录）
**来源**: [日报 2026-04-19](../../daily/github-ai-trending-2026-04-19.html)
**分析**: 分析 1

### 2026-04-19（日报收录）
**来源**: [日报 2026-04-19](../../daily/github-ai-trending-2026-04-19.html)
**分析**: 分析 2（重复）

## 跨项目关联
`;

  // 写入测试文件
  fs.writeFileSync(path.join(testProjectsDir, 'test-owner_test-repo.md'), validWikiContent);
  fs.writeFileSync(path.join(testProjectsDir, 'bad-owner_bad-repo.md'), invalidWikiContent);
  fs.writeFileSync(path.join(testProjectsDir, 'dup-owner_dup-repo.md'), duplicateWikiContent);

  // 创建领域 Wiki 文件
  const domainWikiContent = `# agent 领域

## 领域概览
测试领域
`;
  fs.writeFileSync(path.join(testDomainsDir, 'agent.md'), domainWikiContent);

  const inspector = new WikiInspector({
    baseDir: testWikiDir
  });

  try {
    // ==================== 实例化测试 ====================
    console.log('📦 实例化测试：\n');

    assert(inspector instanceof WikiInspector, 'WikiInspector 可实例化');
    assert(typeof inspector.inspect === 'function', 'inspect 方法存在');
    assert(typeof inspector.inspectCategory === 'function', 'inspectCategory 方法存在');
    assert(typeof inspector.inspectCheck === 'function', 'inspectCheck 方法存在');
    assert(inspector.checks.length > 0, '默认检查项已注册');

    // ==================== 完整检查测试 ====================
    console.log('\n📦 完整检查测试：\n');

    const result = await inspector.inspect();

    assert(result.timestamp !== undefined, '包含时间戳');
    assert(result.summary !== undefined, '包含摘要');
    assert(result.results !== undefined, '包含检查结果');
    assert(result.categoryResults !== undefined, '包含分类结果');
    assert(typeof result.summary.healthScore === 'number', '健康度为数字');
    assert(result.summary.healthScore >= 0 && result.summary.healthScore <= 100, '健康度在 0-100 之间');

    // ==================== 结构检查测试 ====================
    console.log('\n📦 结构检查测试：\n');

    const structureResult = await inspector.inspectCategory('structure');
    assert(structureResult.results.length > 0, '结构检查有结果');
    assert(structureResult.categoryResults.structure !== undefined, '包含结构分类结果');

    // ==================== 质量检查测试 ====================
    console.log('\n📦 质量检查测试：\n');

    const qualityResult = await inspector.inspectCategory('quality');
    assert(qualityResult.results.length > 0, '质量检查有结果');

    // 检查是否能发现重复记录
    const duplicateCheck = qualityResult.results.find(r => r.name === 'no-duplicate-versions');
    assert(duplicateCheck !== undefined, '包含重复检查项');
    assert(duplicateCheck.status === 'warning', '检测到重复记录');

    // 检查是否能发现无效 domain
    const domainCheck = qualityResult.results.find(r => r.name === 'domain-valid');
    assert(domainCheck !== undefined, '包含 domain 检查项');

    // ==================== 关联检查测试 ====================
    console.log('\n📦 关联检查测试：\n');

    const relationResult = await inspector.inspectCategory('relation');
    assert(relationResult.results.length > 0, '关联检查有结果');

    // ==================== 单个检查项测试 ====================
    console.log('\n📦 单个检查项测试：\n');

    const fileExistsResult = await inspector.inspectCheck('file-exists');
    assert(fileExistsResult.name === 'file-exists', '返回正确的检查项名称');
    assert(fileExistsResult.status === 'pass', '文件存在检查通过');

    const unknownCheckResult = await inspector.inspectCheck('unknown-check');
    assert(unknownCheckResult.status === 'fail', '未知检查项返回失败');

    // ==================== Reporter 测试 ====================
    console.log('\n📦 Reporter 测试：\n');

    const cliOutput = WikiInspector.toCLI(result);
    assert(cliOutput.includes('Wiki 健康检查报告'), 'CLI 报告包含标题');
    assert(cliOutput.includes('总体健康度'), 'CLI 报告包含健康度');

    const jsonOutput = WikiInspector.toJSON(result);
    const parsedJson = JSON.parse(jsonOutput);
    assert(parsedJson.summary !== undefined, 'JSON 报告可解析且包含摘要');

    const cicdOutput = WikiInspector.toCiCdJSON(result);
    const parsedCiCd = JSON.parse(cicdOutput);
    assert(typeof parsedCiCd.success === 'boolean', 'CI/CD 报告包含 success 字段');

    // ==================== 健康度评级测试 ====================
    console.log('\n📦 健康度评级测试：\n');

    assert(WikiInspector.getHealthRating(95) === '优秀', '95 分 = 优秀');
    assert(WikiInspector.getHealthRating(85) === '良好', '85 分 = 良好');
    assert(WikiInspector.getHealthRating(65) === '及格', '65 分 = 及格');
    assert(WikiInspector.getHealthRating(50) === '需改进', '50 分 = 需改进');

  } catch (error) {
    console.error(`\n❌ 测试执行失败：${error.message}`);
    console.error(error.stack);
  } finally {
    // 清理测试目录
    if (fs.existsSync(testWikiDir)) {
      fs.rmSync(testWikiDir, { recursive: true });
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
