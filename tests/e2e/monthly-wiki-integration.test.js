#!/usr/bin/env node
/**
 * 月报 Wiki 深度集成端到端测试
 * 测试月度报告生成时 Wiki 系统的深度集成
 */

const path = require('path');
const fs = require('fs');
const ReportPipeline = require('../../src/scraper/report-pipeline');
const WikiManager = require('../../src/wiki/wiki-manager');
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
  console.log('  月报 Wiki 深度集成端到端测试');
  console.log('============================================================\n');

  const testWikiDir = path.join(__dirname, '../fixtures/monthly-wiki-e2e-test');

  // 清理并创建测试目录
  if (fs.existsSync(testWikiDir)) {
    fs.rmSync(testWikiDir, { recursive: true });
  }
  fs.mkdirSync(testWikiDir, { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'domains'), { recursive: true });

  // 创建模拟月报数据
  const mockMonthlyData = {
    month: '2026-03',
    projects: [
      {
        owner: 'microsoft',
        repo: 'autogen',
        description: 'Multi-agent conversation framework',
        domain: 'agent',
        language: 'Python',
        stars: '30000',
        firstSeen: '2026-03-05',
        appearances: 8,
        type: 'agent'
      },
      {
        owner: 'langchain-ai',
        repo: 'langgraph',
        description: 'Multi-agent orchestration framework',
        domain: 'agent',
        language: 'Python',
        stars: '8500',
        firstSeen: '2026-03-10',
        appearances: 5,
        type: 'agent'
      },
      {
        owner: 'huggingface',
        repo: 'transformers',
        description: 'HuggingFace Transformers library',
        domain: 'llm',
        language: 'Python',
        stars: '100000',
        firstSeen: '2026-03-01',
        appearances: 6,
        type: 'llm'
      },
      {
        owner: 'openai',
        repo: 'codex',
        description: 'OpenAI Codex API client',
        domain: 'llm',
        language: 'Python',
        stars: '20000',
        firstSeen: '2026-03-15',
        appearances: 3,
        type: 'llm'
      }
    ],
    aggregation: {
      totalProjects: 4,
      typeDistribution: {
        agent: 2,
        llm: 2
      },
      languageDistribution: {
        Python: 4
      },
      topGainers: [
        { repo: 'microsoft/autogen', appearances: 8, type: 'agent' },
        { repo: 'langchain-ai/langgraph', appearances: 5, type: 'agent' }
      ],
      recurringProjects: [
        { repo: 'huggingface/transformers', appearances: 6, type: 'llm' },
        { repo: 'openai/codex', appearances: 3, type: 'llm' }
      ]
    },
    aiInsights: {
      monthlyTheme: {
        oneLiner: 'Agent 框架成为本月最大热点，多智能体协作技术持续升温',
        detailed: '本月 Agent 领域呈现爆发式增长...'
      },
      trendEvolution: [
        { period: '上旬', dates: '3/1-3/10', topType: 'llm', analysis: 'LLM 领域主导' },
        { period: '中旬', dates: '3/11-3/20', topType: 'agent', analysis: 'Agent 框架崛起' },
        { period: '下旬', dates: '3/21-3/31', topType: 'agent', analysis: 'Agent 持续霸榜' }
      ]
    }
  };

  try {
    // ==================== 测试 1: ReportPipeline 月报处理 ====================
    console.log('📦 测试 1: ReportPipeline 月报处理\n');

    const pipeline = new ReportPipeline({
      enableAI: false,
      enableHTML: true,
      enableIndex: false,
      enableNotification: false,
      enableWikiPostProcessing: true
    });

    // 修改 Wiki 目录到测试路径
    pipeline.wikiManager = new WikiManager({ baseDir: testWikiDir });
    pipeline.wikiPostProcessor = new WikiPostProcessor({
      baseDir: testWikiDir,
      domainsDir: path.join(testWikiDir, 'domains')
    });

    // 执行月报处理
    const result = await pipeline.execute(mockMonthlyData, 'monthly');

    assert(result.success === true, 'Pipeline 执行成功');
    assert(result.type === 'monthly', '报告类型正确');

    // 验证月报 HTML 已生成
    const monthlyHtmlPath = path.join(__dirname, '../../reports/monthly/github-monthly-2026-03.html');
    assert(fs.existsSync(monthlyHtmlPath), '月报 HTML 文件已生成');

    // 验证 HTML 包含 Wiki 追踪模块
    const htmlContent = fs.readFileSync(monthlyHtmlPath, 'utf-8');
    assert(htmlContent.includes('Wiki 知识追踪'), 'HTML 包含 Wiki 追踪模块标题');
    assert(htmlContent.includes('microsoft/autogen'), 'HTML 包含项目链接');
    assert(htmlContent.includes('wiki/projects/'), 'HTML 包含 Wiki 项目链接');
    assert(htmlContent.includes('wiki/domains/'), 'HTML 包含 Wiki 领域链接');

    // ==================== 测试 2: 领域 Wiki 更新 ====================
    console.log('\n📦 测试 2: 领域 Wiki 更新\n');

    const agentDomainPath = path.join(testWikiDir, 'domains', 'agent.md');
    const llmDomainPath = path.join(testWikiDir, 'domains', 'llm.md');

    assert(fs.existsSync(agentDomainPath), 'agent 领域 Wiki 已创建');
    assert(fs.existsSync(llmDomainPath), 'llm 领域 Wiki 已创建');

    const agentContent = fs.readFileSync(agentDomainPath, 'utf-8');
    assert(agentContent.includes('# 🤖 agent 领域'), '领域 Wiki 标题正确');
    assert(agentContent.includes('## 📈 2026-03 月度趋势'), '包含月度趋势章节');
    assert(agentContent.includes('**领域热度**:'), '包含领域热度分析');
    assert(agentContent.includes('**趋势演变**:'), '包含趋势演变');
    assert(agentContent.includes('| 上旬 |'), '包含上旬数据');
    assert(agentContent.includes('**月度统计**:'), '包含月度统计标题');

    // ==================== 测试 3: 项目 Wiki 月度汇总 ====================
    console.log('\n📦 测试 3: 项目 Wiki 月度汇总\n');

    const autogenWikiPath = path.join(testWikiDir, 'projects', 'microsoft_autogen.md');
    assert(fs.existsSync(autogenWikiPath), 'autogen 项目 Wiki 已创建');

    const autogenContent = fs.readFileSync(autogenWikiPath, 'utf-8');
    assert(autogenContent.includes('# microsoft/autogen'), '项目 Wiki 标题正确');
    assert(autogenContent.includes('上榜次数：8'), '上榜次数正确');
    assert(autogenContent.includes('## 版本历史'), '包含版本历史章节');

    // ==================== 测试 4: Wiki 索引页生成 ====================
    console.log('\n📦 测试 4: Wiki 索引页生成\n');

    const wikiIndexPath = path.join(__dirname, '../../reports/wiki-index.html');
    assert(fs.existsSync(wikiIndexPath), 'Wiki 索引页已生成');

    const wikiIndexContent = fs.readFileSync(wikiIndexPath, 'utf-8');
    assert(wikiIndexContent.includes('AI Project Wiki'), '索引页标题正确');
    assert(wikiIndexContent.includes('统计'), '包含统计部分');

    // ==================== 测试 5: 数据去重验证 ====================
    console.log('\n📦 测试 5: 数据去重验证\n');

    // 再次执行相同月报，验证不会重复添加月度汇总
    const result2 = await pipeline.execute(mockMonthlyData, 'monthly');
    assert(result2.success === true, '第二次 Pipeline 执行成功');

    // 读取更新后的领域 Wiki，验证月度汇总只出现一次
    const agentContent2 = fs.readFileSync(agentDomainPath, 'utf-8');
    const monthlySummaryCount = (agentContent2.match(/2026-03（月度汇总）/g) || []).length;
    assert(monthlySummaryCount <= 1, '月度汇总没有重复添加');

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
