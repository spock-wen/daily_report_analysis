#!/usr/bin/env node
/**
 * WikiManager 模块测试
 */

const path = require('path');
const fs = require('fs');
const WikiManager = require('../../src/wiki/wiki-manager');

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
  console.log('  WikiManager 模块测试');
  console.log('============================================================\n');

  const testWikiDir = path.join(__dirname, '../fixtures/wiki');

  // 清理并创建测试目录
  if (fs.existsSync(testWikiDir)) {
    fs.rmSync(testWikiDir, { recursive: true });
  }
  fs.mkdirSync(testWikiDir, { recursive: true });

  const wikiManager = new WikiManager({ baseDir: testWikiDir });

  try {
    // ==================== getOrCreateWiki 测试 ====================
    console.log('📦 getOrCreateWiki 测试：\n');

    const newWiki = await wikiManager.getOrCreateWiki('owner', 'repo');
    assert(newWiki.exists === false, '新项目 Wiki exists 为 false');
    assert(newWiki.path.includes('owner_repo.md'), 'Wiki 文件路径正确');
    assert(newWiki.owner === 'owner', 'owner 正确');
    assert(newWiki.repo === 'repo', 'repo 正确');

    // getOrCreateWiki 不创建文件，只有 createProjectWiki 才创建
    const stillNotExists = await wikiManager.getOrCreateWiki('owner', 'repo');
    assert(stillNotExists.exists === false, '未创建前 exists 仍为 false');

    // 创建 Wiki 后读取应该存在
    await wikiManager.createProjectWiki('exist', 'test', {
      firstSeen: '2026-04-17',
      domain: 'test'
    });
    const existingWiki = await wikiManager.getOrCreateWiki('exist', 'test');
    assert(existingWiki.exists === true, '已存在的 Wiki exists 为 true');
    assert(existingWiki.content !== null, 'content 不为 null');
    assert(existingWiki.content.includes('# exist/test'), 'content 包含标题');

    // ==================== createProjectWiki 测试 ====================
    console.log('\n📦 createProjectWiki 测试：\n');

    const wikiPath = await wikiManager.createProjectWiki('test', 'project', {
      firstSeen: '2026-04-17',
      lastSeen: '2026-04-17',
      appearances: '1',
      domain: 'agent',
      language: 'Python',
      stars: '1,234'
    });

    assert(fs.existsSync(wikiPath), 'Wiki 文件创建成功');
    const content = fs.readFileSync(wikiPath, 'utf-8');
    assert(content.includes('# test/project'), '包含项目标题');
    assert(content.includes('首次上榜：2026-04-17'), '包含首次上榜日期');
    assert(content.includes('领域分类：agent'), '包含领域分类');
    assert(content.includes('语言：Python'), '包含语言');
    assert(content.includes('GitHub Stars: 1,234'), '包含 Stars');

    // ==================== appendVersion 测试 ====================
    console.log('\n📦 appendVersion 测试：\n');

    await wikiManager.appendVersion('test', 'project', {
      date: '2026-04-18',
      eventType: '再次上榜',
      source: '[日报 2026-04-18](../../reports/daily/github-ai-trending-2026-04-18.html)',
      analysis: '项目持续增长，新增多 Agent 协作功能'
    });

    const updatedContent = fs.readFileSync(wikiPath, 'utf-8');
    assert(updatedContent.includes('### 2026-04-18（再次上榜）'), '包含版本日期');
    assert(updatedContent.includes('项目持续增长，新增多 Agent 协作功能'), '包含版本分析');
    assert(updatedContent.includes('## 版本历史'), '包含版本历史章节');

    // ==================== updateBasicInfo 测试 ====================
    console.log('\n📦 updateBasicInfo 测试：\n');

    await wikiManager.updateBasicInfo('test', 'project', {
      appearances: '5',
      lastSeen: '2026-04-20',
      stars: '5,678',
      starsDate: '2026-04-20'
    });

    const updatedBasicContent = fs.readFileSync(wikiPath, 'utf-8');
    assert(updatedBasicContent.includes('上榜次数：5'), '上榜次数更新成功');
    assert(updatedBasicContent.includes('最近上榜：2026-04-20'), '最近上榜日期更新成功');
    assert(updatedBasicContent.includes('GitHub Stars: 5,678'), 'Stars 更新成功');

    // ==================== getStats 测试 ====================
    console.log('\n📦 getStats 测试：\n');

    const stats = await wikiManager.getStats();
    assert(typeof stats.projects === 'number', 'projects 是数字');
    assert(typeof stats.total === 'number', 'total 是数字');
    assert(stats.projects >= 1, '至少有一个项目 Wiki');

    // ==================== getRecentHistory 测试 ====================
    console.log('\n📦 getRecentHistory 测试：\n');

    // 创建包含多条版本历史的测试 Wiki
    const testWikiContent = `# Test/HistoryProject

## 基本信息
- 首次上榜：2026-04-01
- 最近上榜：2026-04-15
- 上榜次数：10

## 版本历史

### 2026-04-15（周报收录）
**来源**: [周报](../../reports/weekly/github-weekly-2026-04-15.html)
**分析**: 第三次分析内容

### 2026-04-10（日报收录）
**来源**: [日报](../../reports/daily/github-ai-trending-2026-04-10.html)
**分析**: 第二次分析内容

### 2026-04-05（日报收录）
**来源**: [日报](../../reports/daily/github-ai-trending-2026-04-05.html)
**分析**: 第一次分析内容

### 2026-04-05（日报收录）
**来源**: [日报](../../reports/daily/github-ai-trending-2026-04-05.html)
**分析**: 重复记录应该被过滤

## 跨项目关联
（待分析）
`;
    const testWikiPath = path.join(testWikiDir, 'projects', 'Test_HistoryProject.md');
    fs.writeFileSync(testWikiPath, testWikiContent);

    // 测试 1: 返回最近 N 条历史
    const history = await wikiManager.getRecentHistory('Test', 'HistoryProject', 3);
    assert(Array.isArray(history), '返回数组');
    assert(history.length <= 3, '最多返回 3 条');
    assert(history[0].date === '2026-04-15', '第一条是最新的 (2026-04-15)');
    assert(history[0].eventType === '周报收录', '事件类型正确');
    assert(history[0].analysis.includes('第三次分析'), '分析内容正确');

    // 测试 2: 去重逻辑
    const fullHistory = await wikiManager.getRecentHistory('Test', 'HistoryProject', 10);
    const dateEventSet = new Set(fullHistory.map(h => `${h.date}-${h.eventType}`));
    assert(dateEventSet.size === fullHistory.length, '同一天同一事件去重');
    // 2026-04-05 的日报收录应该有且仅有一条
    const april5Records = fullHistory.filter(h => h.date === '2026-04-05' && h.eventType === '日报收录');
    assert(april5Records.length === 1, '重复记录被过滤');

    // 测试 3: Wiki 不存在时返回空数组
    const nullHistory = await wikiManager.getRecentHistory('NonExistent', 'Repo', 3);
    assert(Array.isArray(nullHistory), '返回数组');
    assert(nullHistory.length === 0, '不存在的 Wiki 返回空数组');

    // 测试 4: 无版本历史时返回空数组
    const emptyWikiPath = path.join(testWikiDir, 'projects', 'Empty_NoHistory.md');
    fs.writeFileSync(emptyWikiPath, `# Empty/NoHistory

## 基本信息
- 首次上榜：2026-04-01

## 核心功能
无内容
`);
    const emptyHistory = await wikiManager.getRecentHistory('Empty', 'NoHistory', 3);
    assert(Array.isArray(emptyHistory), '返回数组');
    assert(emptyHistory.length === 0, '无版本历史返回空数组');

    // ==================== appendMonthlySummary 测试 ====================
    console.log('\n📦 appendMonthlySummary 测试：\n');

    // 测试 1: 为重复上榜项目添加月度汇总版本
    await wikiManager.createProjectWiki('monthly', 'test-project', {
      firstSeen: '2026-03-05',
      appearances: '1',
      domain: 'agent',
      language: 'Python',
      stars: '5000'
    });

    await wikiManager.appendMonthlySummary('monthly', 'test-project', {
      month: '2026-03',
      appearances: 8,
      dailyAppearances: 5,
      weeklyAppearances: 3,
      trendRole: {
        early: '首次上榜（3 月 5 日）',
        mid: '连续 3 天霸榜，引发社区关注',
        late: '稳定 TOP10，成为 agent 领域代表项目'
      },
      reportUrl: '../../reports/monthly/github-ai-trending-2026-03.html'
    });

    const monthlyWikiPath = path.join(testWikiDir, 'projects', 'monthly_test-project.md');
    const monthlyContent = fs.readFileSync(monthlyWikiPath, 'utf-8');
    assert(monthlyContent.includes('2026-03（月度汇总）'), '包含月度汇总标题');
    assert(monthlyContent.includes('上榜次数：8'), '包含上榜次数');
    assert(monthlyContent.includes('日报 5 次 + 周报 3 次'), '包含来源分解');
    assert(monthlyContent.includes('首次上榜（3 月 5 日）'), '包含上旬描述');
    assert(monthlyContent.includes('月报 2026-03'), '包含月报链接');

    // 测试 2: 去重 - 跳过已存在相同月度汇总
    await wikiManager.appendMonthlySummary('monthly', 'test-project', {
      month: '2026-03',
      appearances: 10, // 不同的数据
      dailyAppearances: 7,
      weeklyAppearances: 3,
      trendRole: { early: '不同的描述', mid: 'mid', late: 'late' },
      reportUrl: '../../reports/monthly/github-ai-trending-2026-03.html'
    });

    const dedupContent = fs.readFileSync(monthlyWikiPath, 'utf-8');
    const monthlySummaryCount = (dedupContent.match(/2026-03（月度汇总）/g) || []).length;
    assert(monthlySummaryCount === 1, '月度汇总只出现 1 次（去重成功）');
    assert(dedupContent.includes('上榜次数：8'), '保留第一次的上榜次数');

    // 测试 3: 允许不同月份的月度汇总
    await wikiManager.appendMonthlySummary('monthly', 'test-project', {
      month: '2026-02',
      appearances: 3,
      dailyAppearances: 2,
      weeklyAppearances: 1,
      trendRole: { early: '2 月首次上榜', mid: '2 月上升', late: '2 月稳定' },
      reportUrl: '../../reports/monthly/github-ai-trending-2026-02.html'
    });

    const multiMonthContent = fs.readFileSync(monthlyWikiPath, 'utf-8');
    assert(multiMonthContent.includes('2026-02（月度汇总）'), '包含 2 月汇总');
    assert(multiMonthContent.includes('2026-03（月度汇总）'), '包含 3 月汇总');

    // 测试 4: 为不存在的项目创建 Wiki 并添加月度汇总
    await wikiManager.appendMonthlySummary('new', 'project', {
      month: '2026-03',
      appearances: 3,
      dailyAppearances: 2,
      weeklyAppearances: 1,
      trendRole: { early: '首次上榜', mid: '持续上升', late: '稳定发展' },
      reportUrl: '../../reports/monthly/github-ai-trending-2026-03.html',
      stars: '3000',
      language: 'JavaScript',
      domain: 'llm'
    });

    const newWikiPath = path.join(testWikiDir, 'projects', 'new_project.md');
    assert(fs.existsSync(newWikiPath), 'Wiki 文件已创建');
    const newContent = fs.readFileSync(newWikiPath, 'utf-8');
    assert(newContent.includes('2026-03（月度汇总）'), '包含月度汇总');
    assert(newContent.includes('GitHub Stars: 3000'), '包含 Star 数');
    assert(newContent.includes('语言：JavaScript'), '包含语言');

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
