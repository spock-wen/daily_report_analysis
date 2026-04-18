#!/usr/bin/env node
/**
 * LLM Wiki 集成端到端测试
 *
 * 测试场景：
 * 1. 从每日 JSON 数据创建项目 Wiki
 * 2. 更新 Wiki 版本历史
 * 3. 生成 Wiki 索引页
 * 4. 生成项目对比页
 * 5. 验证 HTML 报告中 Wiki 徽章显示
 */

const path = require('path');
const fs = require('fs');
const WikiManager = require('../../src/wiki/wiki-manager');
const WikiIndexGenerator = require('../../src/generator/wiki-index-generator');
const ComparisonGenerator = require('../../src/generator/comparison-generator');
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

async function runE2ETests() {
  console.log('\n============================================================');
  console.log('  LLM Wiki 集成端到端测试');
  console.log('============================================================\n');

  const testDir = path.join(__dirname, '../fixtures/e2e-wiki-test');
  const testDataDir = path.join(testDir, 'data', 'insights', 'daily');
  const testWikiDir = path.join(testDir, 'wiki');
  const testOutputDir = path.join(testDir, 'output');

  // 清理并创建测试目录
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDataDir, { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'papers'), { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'domains'), { recursive: true });
  fs.mkdirSync(testOutputDir, { recursive: true });

  try {
    // ==================== 阶段 1: 准备测试数据 ====================
    console.log('📦 阶段 1: 准备测试数据\n');

    // 创建模拟的每日洞察 JSON 数据
    const day1Data = {
      date: '2026-04-01',
      repositories: [
        {
          owner: 'test-user',
          name: 'ai-agent-framework',
          fullName: 'test-user/ai-agent-framework',
          stars: 1500,
          todayStars: 150,
          language: 'Python',
          desc: 'A lightweight multi-agent framework',
          analysis: { type: 'agent', coreFunctions: ['多智能体协作', '任务规划'] }
        },
        {
          owner: 'ml-lab',
          name: 'rag-toolkit',
          fullName: 'ml-lab/rag-toolkit',
          stars: 2800,
          todayStars: 280,
          language: 'JavaScript',
          desc: 'RAG implementation toolkit',
          analysis: { type: 'rag', coreFunctions: ['检索增强', '向量搜索'] }
        }
      ]
    };

    const day2Data = {
      date: '2026-04-02',
      repositories: [
        {
          owner: 'test-user',
          name: 'ai-agent-framework',
          fullName: 'test-user/ai-agent-framework',
          stars: 1650,
          todayStars: 150,
          language: 'Python',
          desc: 'A lightweight multi-agent framework',
          analysis: { type: 'agent', coreFunctions: ['多智能体协作', '任务规划'] }
        },
        {
          owner: 'data-corp',
          name: 'llm-finetune',
          fullName: 'data-corp/llm-finetune',
          stars: 5200,
          todayStars: 520,
          language: 'Python',
          desc: 'LLM fine-tuning framework',
          analysis: { type: 'llm', coreFunctions: ['模型微调', '分布式训练'] }
        }
      ]
    };

    fs.writeFileSync(
      path.join(testDataDir, 'insights-2026-04-01.json'),
      JSON.stringify(day1Data, null, 2)
    );
    fs.writeFileSync(
      path.join(testDataDir, 'insights-2026-04-02.json'),
      JSON.stringify(day2Data, null, 2)
    );

    assert(fs.existsSync(path.join(testDataDir, 'insights-2026-04-01.json')), 'Day 1 JSON 创建成功');
    assert(fs.existsSync(path.join(testDataDir, 'insights-2026-04-02.json')), 'Day 2 JSON 创建成功');

    // ==================== 阶段 2: 执行 Wiki 迁移 ====================
    console.log('\n📦 阶段 2: 执行 Wiki 迁移\n');

    const wikiManager = new WikiManager({ baseDir: testWikiDir });

    // 模拟迁移脚本逻辑
    const projectHistory = new Map();

    for (const file of ['insights-2026-04-01.json', 'insights-2026-04-02.json']) {
      const data = JSON.parse(fs.readFileSync(path.join(testDataDir, file), 'utf-8'));
      const date = data.date;

      for (const repo of data.repositories) {
        const key = `${repo.owner}/${repo.name}`;
        if (!projectHistory.has(key)) {
          projectHistory.set(key, { dates: [], repo });
        }
        projectHistory.get(key).dates.push(date);
      }
    }

    // 创建 Wiki
    for (const [key, history] of projectHistory.entries()) {
      const [owner, repo] = key.split('/');
      await wikiManager.createProjectWiki(owner, repo, {
        firstSeen: history.dates[0],
        lastSeen: history.dates[history.dates.length - 1],
        appearances: history.dates.length.toString(),
        domain: history.repo.analysis?.type || 'other',
        language: history.repo.language || 'Unknown',
        stars: String(history.repo.stars),
        coreFunctions: history.repo.analysis?.coreFunctions || [],
        versionHistory: '',
        crossReferences: '（待分析）'
      });

      // 添加版本历史
      for (const date of history.dates) {
        await wikiManager.appendVersion(owner, repo, {
          date,
          eventType: '日报收录',
          source: `[日报 ${date}](../../daily/github-ai-trending-${date}.html)`,
          analysis: history.repo.desc || '暂无分析'
        });
      }
    }

    assert(fs.existsSync(path.join(testWikiDir, 'projects', 'test-user_ai-agent-framework.md')), 'Wiki 1 创建成功');
    assert(fs.existsSync(path.join(testWikiDir, 'projects', 'ml-lab_rag-toolkit.md')), 'Wiki 2 创建成功');
    assert(fs.existsSync(path.join(testWikiDir, 'projects', 'data-corp_llm-finetune.md')), 'Wiki 3 创建成功');

    // 验证版本历史
    const wiki1Content = fs.readFileSync(
      path.join(testWikiDir, 'projects', 'test-user_ai-agent-framework.md'),
      'utf-8'
    );
    assert(wiki1Content.includes('2026-04-01'), '版本历史包含 Day 1');
    assert(wiki1Content.includes('2026-04-02'), '版本历史包含 Day 2');
    assert(wiki1Content.includes('上榜次数：2'), '上榜次数正确');

    // ==================== 阶段 3: 生成 Wiki 索引页 ====================
    console.log('\n📦 阶段 3: 生成 Wiki 索引页\n');

    const indexGenerator = new WikiIndexGenerator({
      baseDir: testWikiDir,
      outputDir: testOutputDir
    });

    const indexPath = await indexGenerator.generate();
    assert(fs.existsSync(indexPath), 'Wiki 索引页生成成功');

    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    assert(indexContent.includes('AI Project Wiki'), '索引页标题正确');
    assert(indexContent.includes('收录项目'), '包含统计信息');
    assert(indexContent.includes('test-user/ai-agent-framework'), '包含项目 1 链接');
    assert(indexContent.includes('ml-lab/rag-toolkit'), '包含项目 2 链接');

    // ==================== 阶段 4: 生成项目对比页 ====================
    console.log('\n📦 阶段 4: 生成项目对比页\n');

    const comparisonGenerator = new ComparisonGenerator({
      baseDir: testWikiDir,
      outputDir: testOutputDir
    });

    const comparisonPath = await comparisonGenerator.generate([
      { owner: 'test-user', repo: 'ai-agent-framework' },
      { owner: 'ml-lab', repo: 'rag-toolkit' }
    ]);

    assert(fs.existsSync(comparisonPath), '项目对比页生成成功');

    const comparisonContent = fs.readFileSync(comparisonPath, 'utf-8');
    assert(comparisonContent.includes('项目对比'), '对比页标题正确');
    assert(comparisonContent.includes('test-user/ai-agent-framework'), '包含对比项目 1');
    assert(comparisonContent.includes('ml-lab/rag-toolkit'), '包含对比项目 2');
    assert(comparisonContent.includes('bar-fill'), '包含进度条可视化');

    // ==================== 阶段 5: 验证 HTML 生成器 Wiki 集成 ====================
    console.log('\n📦 阶段 5: 验证 HTML 生成器 Wiki 集成\n');

    const htmlGenerator = new HTMLGenerator();
    // 覆盖 wikiManager 的 projectsDir 以使用测试目录
    htmlGenerator.wikiManager.projectsDir = path.join(testWikiDir, 'projects');

    const wikiInfo = htmlGenerator._getProjectWikiInfo('test-user', 'ai-agent-framework');
    assert(wikiInfo !== null, 'Wiki 信息读取成功');
    assert(wikiInfo.appearances === 2, '上榜次数正确');
    assert(wikiInfo.firstSeen === '2026-04-01', '首次上榜日期正确');
    assert(wikiInfo.domain === 'agent', '领域分类正确');

    // 测试项目卡片渲染
    const testProject = {
      fullName: 'test-user/ai-agent-framework',
      stars: 1650,
      todayStars: 150,
      forks: 45,
      language: 'Python',
      descZh: '轻量级多智能体框架'
    };

    const cardHTML = htmlGenerator.renderProjectCard(testProject, 0);
    assert(cardHTML.includes('wiki-badge'), '项目卡片包含 Wiki 徽章');
    assert(cardHTML.includes('📚 Wiki'), '徽章包含 Wiki 图标');
    assert(cardHTML.includes('(2)'), '徽章显示上榜次数');

    // ==================== 阶段 6: 跨项目关联分析测试 ====================
    console.log('\n📦 阶段 6: 跨项目关联分析测试\n');

    const CrossReferenceAnalyzer = require('../../src/wiki/cross-reference');
    const analyzer = new CrossReferenceAnalyzer();

    // 测试 BibTeX 引用提取
    const testBibTeX = `
@misc{chen2024agent,
  title={Multi-Agent Systems},
  author={Chen, et al.},
  year={2024},
  note={arXiv:2401.12345}
}
@misc{wang2024rag,
  title={RAG Methods},
  author={Wang, et al.},
  year={2024},
  note={arXiv:2402.67890}
}
`;

    const citations = analyzer.extractCitationsFromBibTeX(testBibTeX);
    assert(citations.includes('2401.12345'), '提取 arXiv ID 正确 (1)');
    assert(citations.includes('2402.67890'), '提取 arXiv ID 正确 (2)');

    // 测试相似项目检测
    const allWikis = [
      { owner: 'test-user', repo: 'ai-agent-framework', content: wiki1Content },
      { owner: 'ml-lab', repo: 'rag-toolkit', content: fs.readFileSync(
        path.join(testWikiDir, 'projects', 'ml-lab_rag-toolkit.md'), 'utf-8'
      )}
    ];

    const similar = analyzer.findSimilarProjects(
      { repo: 'ai-agent-framework', domain: 'agent', language: 'Python', description: 'multi-agent' },
      allWikis
    );
    // 应该找到同领域的相似项目（如果有）
    assert(Array.isArray(similar), '返回相似项目数组');

    console.log('\n============================================================');
    console.log(`  测试结果：${passedTests}/${totalTests} 通过`);
    console.log('============================================================\n');

    if (passedTests !== totalTests) {
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ 端到端测试失败：${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }
}

runE2ETests();
