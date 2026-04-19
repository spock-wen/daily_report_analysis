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

    // ==================== 月报趋势分析测试 ====================
    console.log('\n📦 月报趋势分析测试：\n');

    // 清理之前的测试数据，重新开始月报测试
    if (fs.existsSync(testWikiDir)) {
      fs.rmSync(testWikiDir, { recursive: true });
    }
    fs.mkdirSync(testWikiDir, { recursive: true });
    fs.mkdirSync(path.join(testWikiDir, 'projects'), { recursive: true });
    fs.mkdirSync(path.join(testWikiDir, 'domains'), { recursive: true });

    const freshProcessor = new WikiPostProcessor({
      baseDir: testWikiDir,
      outputDir: testOutputDir,
      domainsDir: path.join(testWikiDir, 'domains')
    });

    // 模拟月报项目数据
    const monthlyTestProjects = [
      {
        owner: 'microsoft',
        repo: 'autogen',
        description: '多 Agent 对话框架',
        domain: 'agent',
        language: 'Python',
        stars: '30000',
        firstSeen: '2026-04-01',
        appearances: 5
      },
      {
        owner: 'langchain-ai',
        repo: 'langgraph',
        description: '多 Agent 协作框架',
        domain: 'agent',
        language: 'Python',
        stars: '8500',
        firstSeen: '2026-04-05',
        appearances: 3
      },
      {
        owner: 'huggingface',
        repo: 'transformers',
        description: 'HuggingFace Transformers',
        domain: 'llm',
        language: 'Python',
        stars: '100000',
        firstSeen: '2026-04-01',
        appearances: 4
      }
    ];

    // 模拟月度聚合数据
    const mockMonthlyData = {
      month: '2026-04',
      periodStats: {
        early: { projectCount: 15, topType: 'agent' },
        mid: { projectCount: 22, topType: 'agent' },
        late: { projectCount: 18, topType: 'llm' }
      },
      domainStats: {
        newProjects: 5,
        recurringProjects: 12,
        totalStarsGrowth: 125000
      }
    };

    // 模拟 LLM 趋势分析生成函数
    const mockGenerateTrendAnalysis = async (domain) => {
      const analyses = {
        agent: 'Agent 领域持续高温，多 Agent 协作成为主流方向，微软 AutoGen 和 LangChain LangGraph 引领技术趋势',
        llm: 'LLM 领域稳定发展，Transformer 架构持续优化，推理效率和模型压缩成为研究热点'
      };
      return analyses[domain] || '该领域保持稳定发展态势';
    };

    // 执行月报处理（带趋势分析）
    const monthlyTrendResult = await freshProcessor.process(
      monthlyTestProjects,
      'monthly',
      mockMonthlyData,
      mockGenerateTrendAnalysis
    );

    assert(monthlyTrendResult.success === true, '月报趋势分析处理成功');
    assert(monthlyTrendResult.projectsProcessed === 3, '处理了 3 个项目');
    assert(monthlyTrendResult.domainsUpdated === 2, '更新了 2 个领域');

    // 验证 agent 领域 Wiki 包含趋势分析
    const agentTrendPath = path.join(testWikiDir, 'domains', 'agent.md');
    const agentTrendContent = fs.readFileSync(agentTrendPath, 'utf-8');

    assert(agentTrendContent.includes('## 📈 2026-04 月度趋势'), '包含月度趋势章节');
    assert(agentTrendContent.includes('**领域热度**:'), '包含领域热度分析');
    assert(agentTrendContent.includes('多 Agent 协作'), '包含 LLM 生成的趋势文案');
    assert(agentTrendContent.includes('**趋势演变**:'), '包含趋势演列表格');
    assert(agentTrendContent.includes('| 上旬 |'), '包含上旬数据');
    assert(agentTrendContent.includes('| 中旬 |'), '包含中旬数据');
    assert(agentTrendContent.includes('| 下旬 |'), '包含下旬数据');
    assert(agentTrendContent.includes('15'), '上旬项目数正确 (15)');
    assert(agentTrendContent.includes('22'), '中旬项目数正确 (22)');
    assert(agentTrendContent.includes('18'), '下旬项目数正确 (18)');

    // 验证月度统计
    assert(agentTrendContent.includes('新上榜项目：5 个'), '包含新上榜项目统计');
    assert(agentTrendContent.includes('重复上榜项目：12 个'), '包含重复上榜项目统计');
    assert(agentTrendContent.includes('总 Star 增长：+125.0k'), 'Star 增长格式化正确 (带 k 后缀)');

    // 验证 llm 领域 Wiki
    const llmTrendPath = path.join(testWikiDir, 'domains', 'llm.md');
    const llmTrendContent = fs.readFileSync(llmTrendPath, 'utf-8');
    assert(llmTrendContent.includes('Transformer 架构'), 'llm 领域包含正确的趋势文案');

    // ==================== 趋势分析方法单元测试 ====================
    console.log('\n📦 趋势分析方法单元测试：\n');

    // 测试 _formatNumber 方法
    assert(freshProcessor._formatNumber(500) === '500', '小数不变');
    assert(freshProcessor._formatNumber(1000) === '1.0k', '1000 格式化为 1.0k');
    assert(freshProcessor._formatNumber(12500) === '12.5k', '12500 格式化为 12.5k');
    assert(freshProcessor._formatNumber(100000) === '100.0k', '100000 格式化为 100.0k');

    // 测试 _getDomainIcon 方法
    assert(freshProcessor._getDomainIcon('agent') === '🤖', 'agent 图标正确');
    assert(freshProcessor._getDomainIcon('rag') === '🔍', 'rag 图标正确');
    assert(freshProcessor._getDomainIcon('llm') === '🧠', 'llm 图标正确');
    assert(freshProcessor._getDomainIcon('unknown') === '📦', '未知领域使用默认图标');

    // 测试 _domainDescription 方法
    const agentDesc = freshProcessor._domainDescription('agent');
    assert(agentDesc.includes('AI Agent'), 'agent 描述包含 AI Agent');
    assert(agentDesc.includes('智能体'), 'agent 描述包含智能体');

    const llmDesc = freshProcessor._domainDescription('llm');
    assert(llmDesc.includes('大语言模型'), 'llm 描述包含大语言模型');

    // 测试 _groupByDomain 方法
    const grouped = freshProcessor._groupByDomain(monthlyTestProjects);
    assert(Object.keys(grouped).length === 2, '分为 2 个领域');
    assert(grouped.agent.length === 2, 'agent 领域有 2 个项目');
    assert(grouped.llm.length === 1, 'llm 领域有 1 个项目');

    // 测试领域趋势生成
    const trendText = freshProcessor._generateDomainTrend('agent', grouped.agent);
    assert(trendText.includes('平均上榜次数'), '包含平均上榜次数统计');
    assert(trendText.includes('总 Stars 数'), '包含总 Stars 统计');
    assert(trendText.includes('最热项目'), '包含最热项目');

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
