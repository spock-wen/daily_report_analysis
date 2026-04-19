#!/usr/bin/env node
/**
 * WikiPostProcessor 模块测试
 */

const path = require('path');
const fs = require('fs');
const WikiPostProcessor = require('../../src/wiki/wiki-post-processor');

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
  console.log('  WikiPostProcessor 模块测试');
  console.log('============================================================\n');

  const testWikiDir = path.join(__dirname, '../fixtures/wiki-processor-test');
  const testOutputDir = path.join(__dirname, '../fixtures/processor-output');

  // 清理并创建测试目录
  if (fs.existsSync(testWikiDir)) {
    fs.rmSync(testWikiDir, { recursive: true });
  }
  fs.mkdirSync(testWikiDir, { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'domains'), { recursive: true });

  if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true });
  }
  fs.mkdirSync(testOutputDir, { recursive: true });

  const processor = new WikiPostProcessor({
    baseDir: testWikiDir,
    outputDir: testOutputDir,
    domainsDir: path.join(testWikiDir, 'domains')
  });

  try {
    // ==================== 实例化测试 ====================
    console.log('📦 实例化测试：\n');

    assert(processor instanceof WikiPostProcessor, 'WikiPostProcessor 可实例化');
    assert(typeof processor.process === 'function', 'process 方法存在');
    assert(processor.wikiManager !== undefined, 'wikiManager 已初始化');
    assert(processor.indexGenerator !== undefined, 'indexGenerator 已初始化');
    assert(processor.analyzer !== undefined, 'analyzer 已初始化');

    // ==================== process 方法测试 ====================
    console.log('\n📦 process 方法测试：\n');

    // 测试数据：模拟日报项目列表
    const dailyProjects = [
      {
        owner: 'anthropics',
        repo: 'claude-agent-sdk',
        description: 'Anthropic 官方 Claude Agent SDK',
        domain: 'agent',
        language: 'TypeScript',
        stars: '15000',
        firstSeen: '2026-04-18',
        appearances: 1
      },
      {
        owner: 'langchain-ai',
        repo: 'langgraph',
        description: '多 Agent 协作框架',
        domain: 'agent',
        language: 'Python',
        stars: '8000',
        firstSeen: '2026-04-18',
        appearances: 1
      },
      {
        owner: 'pinecone-io',
        repo: 'pinecone-client',
        description: '向量数据库客户端',
        domain: 'rag',
        language: 'Python',
        stars: '5000',
        firstSeen: '2026-04-18',
        appearances: 1
      }
    ];

    // 测试日报处理
    const dailyResult = await processor.process(dailyProjects, 'daily');
    assert(dailyResult.success === true, '日报处理成功');
    assert(dailyResult.projectsProcessed === 3, '处理了 3 个项目');

    // 验证领域 Wiki 文件已创建
    const agentDomainPath = path.join(testWikiDir, 'domains', 'agent.md');
    const ragDomainPath = path.join(testWikiDir, 'domains', 'rag.md');
    assert(fs.existsSync(agentDomainPath), 'agent 领域 Wiki 已创建');
    assert(fs.existsSync(ragDomainPath), 'rag 领域 Wiki 已创建');

    // 验证领域 Wiki 内容格式
    const agentContent = fs.readFileSync(agentDomainPath, 'utf-8');
    assert(agentContent.includes('# 🤖 agent 领域'), '领域 Wiki 包含标题');
    assert(agentContent.includes('## 领域概览'), '包含领域概览章节');
    assert(agentContent.includes('项目总数'), '包含项目总数统计');
    assert(agentContent.includes('## 代表项目'), '包含代表项目表格');
    assert(agentContent.includes('anthropics/claude-agent-sdk'), '包含项目链接');
    assert(agentContent.includes('langchain-ai/langgraph'), '包含项目链接');

    // 验证 Wiki 索引页已生成
    const indexPath = path.join(testOutputDir, 'wiki-index.html');
    assert(fs.existsSync(indexPath), 'Wiki 索引页已生成');

    // ==================== 周报处理测试 ====================
    console.log('\n📦 周报处理测试：\n');

    const weeklyProjects = [
      {
        owner: 'openai',
        repo: 'codex',
        description: 'OpenAI Codex 代码模型',
        domain: 'llm',
        language: 'Python',
        stars: '20000',
        firstSeen: '2026-04-12',
        lastSeen: '2026-04-19',
        appearances: 2
      },
      {
        owner: 'anthropics',
        repo: 'claude-agent-sdk',
        description: 'Anthropic 官方 Claude Agent SDK',
        domain: 'agent',
        language: 'TypeScript',
        stars: '16000',
        firstSeen: '2026-04-18',
        lastSeen: '2026-04-19',
        appearances: 2
      }
    ];

    const weeklyResult = await processor.process(weeklyProjects, 'weekly');
    assert(weeklyResult.success === true, '周报处理成功');
    assert(weeklyResult.projectsProcessed === 2, '处理了 2 个项目');

    // 验证 llm 领域 Wiki 已创建
    const llmDomainPath = path.join(testWikiDir, 'domains', 'llm.md');
    assert(fs.existsSync(llmDomainPath), 'llm 领域 Wiki 已创建');

    // 验证 agent 领域 Wiki 已更新（追加新项目）
    const updatedAgentContent = fs.readFileSync(agentDomainPath, 'utf-8');
    assert(updatedAgentContent.includes('openai/codex') === false, 'agent 领域不包含 llm 项目');

    // ==================== 月报处理测试 ====================
    console.log('\n📦 月报处理测试：\n');

    const monthlyProjects = [
      {
        owner: 'microsoft',
        repo: 'autogen',
        description: '多 Agent 对话框架',
        domain: 'agent',
        language: 'Python',
        stars: '30000',
        firstSeen: '2026-04-01',
        lastSeen: '2026-04-19',
        appearances: 5
      },
      {
        owner: 'huggingface',
        repo: 'transformers',
        description: 'HuggingFace Transformers',
        domain: 'llm',
        language: 'Python',
        stars: '100000',
        firstSeen: '2026-04-01',
        lastSeen: '2026-04-19',
        appearances: 4
      }
    ];

    const monthlyResult = await processor.process(monthlyProjects, 'monthly');
    assert(monthlyResult.success === true, '月报处理成功');
    assert(monthlyResult.projectsProcessed === 2, '处理了 2 个项目');

    // ==================== 领域分组测试 ====================
    console.log('\n📦 领域分组测试：\n');

    // 验证所有领域 Wiki 都存在
    const expectedDomains = ['agent', 'rag', 'llm'];
    for (const domain of expectedDomains) {
      const domainPath = path.join(testWikiDir, 'domains', `${domain}.md`);
      assert(fs.existsSync(domainPath), `${domain} 领域 Wiki 存在`);
    }

    // ==================== 空项目列表测试 ====================
    console.log('\n📦 空项目列表测试：\n');

    const emptyResult = await processor.process([], 'daily');
    assert(emptyResult.success === true, '空列表处理成功');
    assert(emptyResult.projectsProcessed === 0, '处理了 0 个项目');

    // ==================== 索引页内容验证 ====================
    console.log('\n📦 索引页内容验证：\n');

    const finalIndexContent = fs.readFileSync(indexPath, 'utf-8');
    assert(finalIndexContent.includes('<!DOCTYPE html>'), '索引页包含 DOCTYPE');
    assert(finalIndexContent.includes('AI Project Wiki'), '索引页包含标题');
    // 索引页从项目 Wiki 文件读取，检查基本结构
    assert(finalIndexContent.includes('统计'), '索引页包含统计部分');

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
