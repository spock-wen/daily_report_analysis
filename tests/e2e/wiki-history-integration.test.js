#!/usr/bin/env node
/**
 * Wiki 历史集成端到端测试
 * 验证 InsightAnalyzer 能够正确读取 Wiki 历史并生成增强的 Prompt
 */

const path = require('path');
const fs = require('fs');
const InsightAnalyzer = require('../../src/analyzer/insight-analyzer');

console.log('\n============================================================');
console.log('  Wiki 历史集成端到端测试');
console.log('============================================================\n');

async function runTests() {
  const testWikiDir = path.join(__dirname, '../fixtures/wiki-e2e-test');

  // 清理并创建测试目录
  if (fs.existsSync(testWikiDir)) {
    fs.rmSync(testWikiDir, { recursive: true });
  }
  fs.mkdirSync(testWikiDir, { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(testWikiDir, 'domains'), { recursive: true });

  // 创建测试 Wiki 文件
  const wikiContent1 = `# Test/ProjectA

## 基本信息
- 首次上榜：2026-04-01
- 最近上榜：2026-04-15
- 上榜次数：5
- 领域分类：agent

## 版本历史

### 2026-04-15（周报收录）
**来源**: [周报](../../reports/weekly/github-weekly-2026-04-15.html)
**分析**: 多 Agent 协作功能获得广泛关注

### 2026-04-10（日报收录）
**来源**: [日报](../../reports/daily/github-ai-trending-2026-04-10.html)
**分析**: 新增多模态支持

### 2026-04-05（日报收录）
**来源**: [日报](../../reports/daily/github-ai-trending-2026-04-05.html)
**分析**: 首次上榜，轻量级 Agent 框架

## 跨项目关联
（待分析）
`;

  const wikiContent2 = `# Test/ProjectB

## 基本信息
- 首次上榜：2026-04-18
- 最近上榜：2026-04-18
- 上榜次数：1

## 核心功能
新项目，暂无历史

## 跨项目关联
（待分析）
`;

  fs.writeFileSync(path.join(testWikiDir, 'projects', 'Test_ProjectA.md'), wikiContent1);
  fs.writeFileSync(path.join(testWikiDir, 'projects', 'Test_ProjectB.md'), wikiContent2);

  const analyzer = new InsightAnalyzer({ baseDir: testWikiDir });

  const briefData = {
    projects: [
      {
        fullName: 'Test/ProjectA',
        description: '轻量级 Agent 框架',
        stars: 5000,
        language: 'JavaScript',
        isAI: true
      },
      {
        fullName: 'Test/ProjectB',
        description: '新项目',
        stars: 100,
        language: 'Python',
        isAI: true
      },
      {
        fullName: 'NoWiki/Project',
        description: '没有 Wiki 的项目',
        stars: 200,
        language: 'TypeScript',
        isAI: false
      }
    ],
    stats: {
      total_projects: 3,
      ai_projects: 2
    }
  };

  console.log('📦 测试 prepareContextData()：\n');

  const contextData = await analyzer.prepareContextData(briefData);

  // 验证项目 A 的历史
  const projectA = contextData.projects.find(p => p.fullName === 'Test/ProjectA');
  if (projectA && projectA.wikiHistory && projectA.wikiHistory.length === 3) {
    console.log('  ✅ ProjectA 返回 3 条历史记录');
    console.log(`     最新：${projectA.wikiHistory[0].date} - ${projectA.wikiHistory[0].analysis.substring(0, 20)}...`);
  } else {
    console.log('  ❌ ProjectA 历史记录数量错误');
  }

  // 验证项目 B（新 Wiki，无版本历史）
  const projectB = contextData.projects.find(p => p.fullName === 'Test/ProjectB');
  if (projectB && projectB.wikiHistory && projectB.wikiHistory.length === 0) {
    console.log('  ✅ ProjectB 返回空历史（新版 Wiki）');
  } else {
    console.log('  ❌ ProjectB 历史记录错误');
  }

  // 验证不存在 Wiki 的项目
  const projectC = contextData.projects.find(p => p.fullName === 'NoWiki/Project');
  if (projectC && projectC.wikiHistory && projectC.wikiHistory.length === 0) {
    console.log('  ✅ NoWiki/Project 返回空历史（Wiki 不存在）');
  } else {
    console.log('  ❌ NoWiki/Project 历史记录错误');
  }

  console.log('\n📦 测试 buildWikiHistoryContext()：\n');

  const wikiContext = analyzer.buildWikiHistoryContext(contextData.projects);
  console.log('生成的 Wiki 历史上下文:\n');
  console.log(wikiContext);
  console.log();

  if (wikiContext.includes('Test/ProjectA') && wikiContext.includes('多 Agent 协作')) {
    console.log('  ✅ Wiki 历史上下文包含 ProjectA 的信息');
  } else {
    console.log('  ❌ Wiki 历史上下文缺少 ProjectA 的信息');
  }

  console.log('\n📦 测试 buildPrompt() 完整集成：\n');

  // 读取 weekly prompt 模板
  const prompts = require('../../config/prompts.json');
  const prompt = analyzer.buildPrompt(prompts.weekly.userPrompt, contextData);

  if (prompt.includes('{wikiHistoryContext}')) {
    console.log('  ❌ Prompt 中仍有未替换的 {wikiHistoryContext}');
  } else if (prompt.includes('ProjectA') || prompt.includes('多 Agent')) {
    console.log('  ✅ Prompt 中已注入 Wiki 历史上下文');
  } else {
    console.log('  ⚠️  无法确认 Prompt 中是否包含 Wiki 历史');
  }

  console.log(`\n  Prompt 长度：${prompt.length} 字符`);

  // 清理测试目录
  if (fs.existsSync(testWikiDir)) {
    fs.rmSync(testWikiDir, { recursive: true });
  }

  console.log('\n============================================================');
  console.log('  测试完成');
  console.log('============================================================\n');
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
