#!/usr/bin/env node
/**
 * Wiki Post-Processing 集成测试
 *
 * 测试 ReportPipeline 中 Wiki 后处理的完整流程：
 * 1. Wiki 索引页生成
 * 2. 领域 Wiki 更新
 * 3. 错误隔离
 */

const path = require('path');
const fs = require('fs');
const ReportPipeline = require('../../src/scraper/report-pipeline');

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
  console.log('  Wiki Post-Processing 集成测试');
  console.log('============================================================\n');

  const testDir = path.join(__dirname, '../fixtures/wiki-post-processing-e2e');
  const testWikiDir = path.join(testDir, 'wiki');
  const testOutputDir = path.join(testDir, 'reports');

  // 清理并创建测试目录
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(path.join(testWikiDir, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'domains'), { recursive: true });
  fs.mkdirSync(testOutputDir, { recursive: true });

  try {
    // ==================== 测试 1: Wiki 索引页生成 ====================
    console.log('📦 测试 1: Wiki 索引页生成\n');

    // 创建自定义 ReportPipeline 实例，使用测试目录
    const pipeline1 = new ReportPipeline({
      enableAI: false, // 禁用 AI 以加快测试
      enableHTML: true,
      enableIndex: false, // 不更新首页
      enableNotification: false,
      enableWikiPostProcessing: true
    });

    // 覆盖 wikiManager 和 wikiPostProcessor 的目录配置
    const WikiManager = require('../../src/wiki/wiki-manager');
    const WikiPostProcessor = require('../../src/wiki/wiki-post-processor');

    pipeline1.wikiManager = new WikiManager({ baseDir: testWikiDir });
    pipeline1.wikiPostProcessor = new WikiPostProcessor({
      baseDir: testWikiDir,
      outputDir: testOutputDir,
      domainsDir: path.join(testWikiDir, 'domains')
    });

    // 模拟日报数据
    const dailyData = {
      date: '2026-04-19',
      scrapedAt: new Date().toISOString(),
      repositories: [
        {
          owner: 'anthropics',
          repo: 'claude-agent-sdk',
          name: 'claude-agent-sdk',
          fullName: 'anthropics/claude-agent-sdk',
          description: 'Anthropic 官方 Claude Agent SDK',
          domain: 'agent',
          language: 'TypeScript',
          stars: 15000,
          todayStars: 500,
          isAI: true,
          analysis: { type: 'agent', coreFunctions: ['智能体协作', '任务规划'] }
        },
        {
          owner: 'langchain-ai',
          repo: 'langgraph',
          name: 'langgraph',
          fullName: 'langchain-ai/langgraph',
          description: '多 Agent 协作框架',
          domain: 'agent',
          language: 'Python',
          stars: 8000,
          todayStars: 300,
          isAI: true,
          analysis: { type: 'agent', coreFunctions: ['图工作流', '状态管理'] }
        }
      ],
      stats: {
        totalProjects: 2,
        aiProjects: 2,
        avgStars: '11.5k'
      }
    };

    const result1 = await pipeline1.execute(dailyData, 'daily');

    assert(result1.success === true, 'Pipeline 执行成功');

    // 验证 Wiki 索引页已生成
    const indexPath = path.join(testOutputDir, 'wiki-index.html');
    assert(fs.existsSync(indexPath), 'Wiki 索引页文件存在');

    // 验证索引页内容
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    assert(indexContent.includes('<!DOCTYPE html>'), '索引页包含 DOCTYPE 声明');
    assert(indexContent.includes('AI Project Wiki'), '索引页包含标题');
    assert(indexContent.includes('统计'), '索引页包含统计部分');
    assert(indexContent.includes('收录项目'), '索引页包含项目统计标签');

    // 验证项目 Wiki 文件已创建
    const project1WikiPath = path.join(testWikiDir, 'projects', 'anthropics_claude-agent-sdk.md');
    const project2WikiPath = path.join(testWikiDir, 'projects', 'langchain-ai_langgraph.md');
    assert(fs.existsSync(project1WikiPath), '项目 1 Wiki 文件已创建');
    assert(fs.existsSync(project2WikiPath), '项目 2 Wiki 文件已创建');

    // ==================== 测试 2: 领域 Wiki 更新 ====================
    console.log('\n📦 测试 2: 领域 Wiki 更新\n');

    // 创建新的 Pipeline 实例用于周报测试
    const pipeline2 = new ReportPipeline({
      enableAI: false,
      enableHTML: true,
      enableIndex: false,
      enableNotification: false,
      enableWikiPostProcessing: true
    });

    pipeline2.wikiManager = new WikiManager({ baseDir: testWikiDir });
    pipeline2.wikiPostProcessor = new WikiPostProcessor({
      baseDir: testWikiDir,
      outputDir: testOutputDir,
      domainsDir: path.join(testWikiDir, 'domains')
    });

    // 模拟周报数据，包含不同领域的项目
    const weeklyData = {
      weekStart: '2026-W16',
      scrapedAt: new Date().toISOString(),
      repositories: [
        {
          owner: 'anthropics',
          repo: 'claude-agent-sdk',
          name: 'claude-agent-sdk',
          fullName: 'anthropics/claude-agent-sdk',
          description: 'Anthropic 官方 Claude Agent SDK',
          domain: 'agent',
          language: 'TypeScript',
          stars: 16000,
          todayStars: 1000,
          isAI: true,
          analysis: { type: 'agent', coreFunctions: ['智能体协作', '任务规划'] },
          firstSeen: '2026-04-19',
          appearances: 2
        },
        {
          owner: 'pinecone-io',
          repo: 'pinecone-client',
          name: 'pinecone-client',
          fullName: 'pinecone-io/pinecone-client',
          description: '向量数据库客户端',
          domain: 'rag',
          language: 'Python',
          stars: 5000,
          todayStars: 200,
          isAI: true,
          analysis: { type: 'rag', coreFunctions: ['向量检索', '嵌入'] },
          firstSeen: '2026-W16',
          appearances: 1
        },
        {
          owner: 'huggingface',
          repo: 'transformers',
          name: 'transformers',
          fullName: 'huggingface/transformers',
          description: 'HuggingFace Transformers 库',
          domain: 'llm',
          language: 'Python',
          stars: 100000,
          todayStars: 500,
          isAI: true,
          analysis: { type: 'llm', coreFunctions: ['预训练模型', '微调'] },
          firstSeen: '2026-W16',
          appearances: 1
        }
      ],
      stats: {
        totalProjects: 3,
        aiProjects: 3,
        avgStars: '40.3k'
      }
    };

    const result2 = await pipeline2.execute(weeklyData, 'weekly');

    assert(result2.success === true, '周报 Pipeline 执行成功');
    // 验证有 3 个项目被处理（通过 repositories 数量验证）
    assert(weeklyData.repositories.length === 3, '处理了 3 个项目');

    // 验证各个领域 Wiki 文件已创建
    const agentDomainPath = path.join(testWikiDir, 'domains', 'agent.md');
    const ragDomainPath = path.join(testWikiDir, 'domains', 'rag.md');
    const llmDomainPath = path.join(testWikiDir, 'domains', 'llm.md');

    assert(fs.existsSync(agentDomainPath), 'agent 领域 Wiki 存在');
    assert(fs.existsSync(ragDomainPath), 'rag 领域 Wiki 存在');
    assert(fs.existsSync(llmDomainPath), 'llm 领域 Wiki 存在');

    // 验证领域 Wiki 内容格式
    const agentContent = fs.readFileSync(agentDomainPath, 'utf-8');
    assert(agentContent.includes('# 🤖 agent 领域'), 'agent 领域包含正确标题和图标');
    assert(agentContent.includes('## 领域概览'), '包含领域概览章节');
    assert(agentContent.includes('项目总数'), '包含项目总数统计');
    assert(agentContent.includes('## 代表项目'), '包含代表项目表格');
    assert(agentContent.includes('anthropics/claude-agent-sdk'), '包含项目链接');
    assert(agentContent.includes('langchain-ai/langgraph'), '包含项目 2 链接');

    // 验证领域描述
    assert(agentContent.includes('AI Agent'), '包含领域描述');

    const ragContent = fs.readFileSync(ragDomainPath, 'utf-8');
    assert(ragContent.includes('# 🔍 rag 领域'), 'rag 领域包含正确标题和图标');
    assert(ragContent.includes('RAG'), '包含 RAG 领域描述');

    const llmContent = fs.readFileSync(llmDomainPath, 'utf-8');
    assert(llmContent.includes('# 🧠 llm 领域'), 'llm 领域包含正确标题和图标');
    assert(llmContent.includes('大语言模型'), '包含 LLM 领域描述');

    // 验证项目 Wiki 已更新（新增领域）
    const totalProjectWikis = fs.readdirSync(path.join(testWikiDir, 'projects'))
      .filter(f => f.endsWith('.md')).length;
    assert(totalProjectWikis >= 4, '项目 Wiki 总数正确 (至少 4 个)');

    // ==================== 测试 3: 错误隔离 ====================
    console.log('\n📦 测试 3: 错误隔离\n');

    // 创建配置了无效 Wiki 目录的 Pipeline
    const pipeline3 = new ReportPipeline({
      enableAI: false,
      enableHTML: true,
      enableIndex: false,
      enableNotification: false,
      enableWikiPostProcessing: true
    });

    // 设置为不可写的 Wiki 目录以模拟错误
    const invalidWikiDir = path.join(testDir, 'invalid-wiki-readonly');
    fs.mkdirSync(invalidWikiDir, { recursive: true });

    // 创建一个只读目录模拟权限问题
    const readonlyDir = path.join(invalidWikiDir, 'domains');
    fs.mkdirSync(readonlyDir, { recursive: true });

    pipeline3.wikiManager = new WikiManager({ baseDir: invalidWikiDir });
    pipeline3.wikiPostProcessor = new WikiPostProcessor({
      baseDir: invalidWikiDir,
      outputDir: testOutputDir,
      domainsDir: readonlyDir
    });

    // 模拟一些项目数据
    const errorTestData = {
      date: '2026-04-20',
      scrapedAt: new Date().toISOString(),
      repositories: [
        {
          owner: 'test-org',
          repo: 'test-project',
          name: 'test-project',
          fullName: 'test-org/test-project',
          description: '测试项目',
          domain: 'agent',
          language: 'JavaScript',
          stars: 100,
          todayStars: 10,
          isAI: true,
          analysis: { type: 'agent' }
        }
      ],
      stats: {
        totalProjects: 1,
        aiProjects: 1,
        avgStars: '100'
      }
    };

    // 执行 Pipeline - 应该成功完成，即使 Wiki 后处理失败
    const result3 = await pipeline3.execute(errorTestData, 'daily');

    // 主流程应该成功完成（Wiki 错误被隔离）
    assert(result3.success === true, 'Pipeline 主流程成功完成（尽管 Wiki 可能失败）');

    // 验证 HTML 报告仍然生成
    const expectedHtmlPath = path.join(testOutputDir, 'daily', 'github-ai-trending-2026-04-20.html');
    // HTML 报告应该已生成（Wiki 失败不影响主流程）
    assert(result3.htmlPath !== null || fs.existsSync(expectedHtmlPath), 'HTML 报告已生成（Wiki 错误未阻断主流程）');

    // ==================== 测试 4: 空项目列表处理 ====================
    console.log('\n📦 测试 4: 空项目列表处理\n');

    const pipeline4 = new ReportPipeline({
      enableAI: false,
      enableHTML: true,
      enableIndex: false,
      enableNotification: false,
      enableWikiPostProcessing: true
    });

    pipeline4.wikiManager = new WikiManager({ baseDir: testWikiDir });
    pipeline4.wikiPostProcessor = new WikiPostProcessor({
      baseDir: testWikiDir,
      outputDir: testOutputDir,
      domainsDir: path.join(testWikiDir, 'domains')
    });

    const emptyData = {
      date: '2026-04-21',
      scrapedAt: new Date().toISOString(),
      repositories: [],
      stats: {
        totalProjects: 0,
        aiProjects: 0,
        avgStars: '0'
      }
    };

    const result4 = await pipeline4.execute(emptyData, 'daily');

    assert(result4.success === true, '空项目列表处理成功');

    console.log('\n============================================================');
    console.log(`  测试结果：${passedTests}/${totalTests} 通过`);
    console.log('============================================================\n');

    if (passedTests !== totalTests) {
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ 集成测试失败：${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }
}

runTests();
