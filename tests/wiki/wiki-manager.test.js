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
    // 所以再次读取仍然不存在
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

    // ==================== getPaperWiki 测试 ====================
    console.log('\n📦 getPaperWiki 测试：\n');

    const nullWiki = await wikiManager.getPaperWiki('2401.12345');
    assert(nullWiki === null, '不存在的论文 Wiki 返回 null');

    // ==================== createPaperWiki 测试 ====================
    console.log('\n📦 createPaperWiki 测试：\n');

    const paperPath = await wikiManager.createPaperWiki('2401.12345', {
      title: 'Test Paper Title',
      publishDate: '2024-01-15',
      paperType: 'Research',
      domain: 'LLM',
      authors: ['Author One', 'Author Two'],
      bibtex: '@article{test2024,\n  title={Test},\n  year={2024}\n}'
    });

    assert(fs.existsSync(paperPath), '论文 Wiki 文件创建成功');
    const paperContent = fs.readFileSync(paperPath, 'utf-8');
    assert(paperContent.includes('# Test Paper Title'), '包含论文标题');
    assert(paperContent.includes('arXiv ID: 2401.12345'), '包含 arXiv ID');
    assert(paperContent.includes('论文类型：Research'), '包含论文类型');

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
    assert(typeof stats.papers === 'number', 'papers 是数字');
    assert(typeof stats.total === 'number', 'total 是数字');
    assert(stats.projects >= 1, '至少有一个项目 Wiki');
    assert(stats.papers >= 1, '至少有一个论文 Wiki');

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
