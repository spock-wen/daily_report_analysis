#!/usr/bin/env node

/**
 * JSON 到 Wiki 迁移脚本
 *
 * 功能：
 * 1. 扫描 data/insights/daily/*.json 文件
 * 2. 按项目聚合历史数据（首次上榜、上榜次数、历史分析）
 * 3. 使用 WikiManager 批量生成初始 Wiki Markdown 文件
 *
 * 依赖：Phase 1 Task 2 实现的 WikiManager
 */

const fs = require('fs');
const path = require('path');
const WikiManager = require('../src/wiki/wiki-manager');

const INSIGHTS_DIR = path.join(__dirname, '..', 'data', 'insights', 'daily');
const wikiManager = new WikiManager();

/**
 * 从 hot 数组中提取项目名
 * 格式："666ghj/MiroFish - 群体智能引擎..." -> "666ghj/MiroFish"
 */
function extractRepoName(hotItem) {
  const match = hotItem.match(/^([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * 从 action 数组中提取项目名
 */
function extractReposFromAction(actionItem) {
  const repos = [];
  const matches = actionItem.matchAll(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/g);
  for (const match of matches) {
    repos.push(match[1]);
  }
  return repos;
}

/**
 * 检测项目领域
 */
function detectDomain(name, hotText = '') {
  const text = (name + ' ' + hotText).toLowerCase();

  // Agent 相关
  if (text.includes('agent') || text.includes('multi') || text.includes('swarm')) return 'agent';

  // RAG 相关
  if (text.includes('rag') || text.includes('retrieval') || text.includes('augment')) return 'rag';

  // LLM/基础模型相关
  if (text.includes('llm') || text.includes('language model') || text.includes('minimind')) return 'llm';

  // 语音/音频相关
  if (text.includes('speech') || text.includes('audio') || text.includes('voice')) return 'speech';

  // 计算机视觉/多模态
  if (text.includes('vision') || text.includes('image') || text.includes('face') || text.includes('live-cam')) return 'vision';

  // 浏览器/自动化
  if (text.includes('browser') || text.includes('automate') || text.includes('playwright')) return 'browser';

  // 开发工具
  if (text.includes('code') || text.includes('dev') || text.includes('mcp') || text.includes('tool') || text.includes('sdk')) return 'dev-tool';

  // 平台/低代码/可视化
  if (text.includes('flow') || text.includes('platform') || text.includes('studio') || text.includes('ui')) return 'platform';

  // 基础设施/边缘计算/运行时
  if (text.includes('infrastructure') || text.includes('edge') || text.includes('runtime') || text.includes('worker') || text.includes('cloud')) return 'infrastructure';

  // 教育/学习资源
  if (text.includes('learn') || text.includes('tutorial') || text.includes('beginner') || text.includes('course') || text.includes('teaching')) return 'education';

  // 游戏相关
  if (text.includes('game') || text.includes('minecraft')) return 'game';

  // 物理/机器人
  if (text.includes('physics') || text.includes('robot')) return 'physics';

  // 金融/交易
  if (text.includes('finance') || text.includes('trading')) return 'finance';

  // 安全/隐私
  if (text.includes('security') || text.includes('privacy') || text.includes('scan') || text.includes('protect')) return 'security';

  // 数据/数据库
  if (text.includes('data') || text.includes('database') || text.includes('vector') || text.includes('index')) return 'data';

  return 'other';
}

/**
 * 从热点文本中提取核心功能
 */
function extractCoreFunction(hotText) {
  // 热点文本格式："666ghj/MiroFish - 群体智能引擎..."
  const parts = hotText.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ') : '详见版本历史';
}

/**
 * 主函数
 */
async function migrate() {
  console.log('🚀 开始 JSON 到 Wiki 迁移...\n');

  // 项目历史聚合 Map: repo -> { dates, hotTexts, analyses, coreFunctions }
  const projectHistory = new Map();

  // 扫描所有日报 JSON 文件
  const files = fs.readdirSync(INSIGHTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`📂 找到 ${files.length} 个日报文件\n`);

  // 阶段 1: 聚合所有日报数据
  console.log('📊 阶段 1: 聚合日报数据...\n');

  for (const file of files) {
    const filePath = path.join(INSIGHTS_DIR, file);
    const date = file.replace('insights-', '').replace('.json', '');

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // 提取 hot 中的项目
      if (data.hot && Array.isArray(data.hot)) {
        for (const hotItem of data.hot) {
          const repo = extractRepoName(hotItem);
          if (!repo) continue;

          if (!projectHistory.has(repo)) {
            projectHistory.set(repo, {
              dates: [],
              hotTexts: [],
              analyses: [],
              coreFunctions: new Set()
            });
          }

          const history = projectHistory.get(repo);
          history.dates.push(date);
          history.hotTexts.push(hotItem);
          history.analyses.push(data.action?.[0] || '暂无分析');

          // 提取核心功能
          const coreFunc = extractCoreFunction(hotItem);
          if (coreFunc !== '详见版本历史') {
            history.coreFunctions.add(coreFunc);
          }
        }
      }

      // 从 action 中提取提到的项目
      if (data.action && Array.isArray(data.action)) {
        for (const actionItem of data.action) {
          const repos = extractReposFromAction(actionItem);
          for (const repo of repos) {
            if (!projectHistory.has(repo)) {
              projectHistory.set(repo, {
                dates: [],
                hotTexts: [],
                analyses: [],
                coreFunctions: new Set()
              });
            }
            const history = projectHistory.get(repo);
            if (!history.dates.includes(date)) {
              history.dates.push(date);
              history.analyses.push(actionItem);
            }
          }
        }
      }
    } catch (error) {
      console.error(`⚠️  读取 ${file} 失败：${error.message}`);
    }
  }

  console.log(`📊 聚合到 ${projectHistory.size} 个项目\n`);

  // 阶段 2: 使用 WikiManager 创建 Wiki
  console.log('📝 阶段 2: 创建 Wiki 文件...\n');

  let created = 0;
  let failed = 0;

  for (const [key, history] of projectHistory.entries()) {
    const [owner, repo] = key.split('/');
    if (!owner || !repo) {
      console.log(`⚠️  跳过无效项目名：${key}`);
      continue;
    }

    try {
      // 第一次创建 Wiki
      await wikiManager.createProjectWiki(owner, repo, {
        firstSeen: history.dates[0],
        lastSeen: history.dates[history.dates.length - 1],
        appearances: history.dates.length.toString(),
        domain: detectDomain(key, history.hotTexts[0] || ''),
        language: 'Unknown',
        stars: '0',
        coreFunctions: Array.from(history.coreFunctions).slice(0, 4),
        versionHistory: '',
        crossReferences: '（待分析）'
      });

      // 追加每个版本的历史记录
      for (let i = 0; i < history.dates.length; i++) {
        const date = history.dates[i];
        const hotText = history.hotTexts[i] || '未记录';
        const analysis = history.analyses[i] || '暂无分析';

        await wikiManager.appendVersion(owner, repo, {
          date,
          eventType: '日报收录',
          source: `[日报 ${date}](../../reports/daily/github-ai-trending-${date}.html)`,
          analysis: `${hotText} - ${analysis}`
        });
      }

      created++;
      if (created % 50 === 0) {
        console.log(`  已生成 ${created}/${projectHistory.size} 个 Wiki`);
      }
    } catch (error) {
      failed++;
      console.error(`⚠️  创建 ${key} Wiki 失败：${error.message}`);
    }
  }

  console.log('\n✅ 迁移完成！');
  console.log(`📊 成功创建：${created} 个 Wiki`);
  console.log(`⚠️  失败：${failed} 个`);

  // 显示 Top 10 霸榜项目
  const sorted = Array.from(projectHistory.entries())
    .sort((a, b) => b[1].dates.length - a[1].dates.length)
    .slice(0, 10);

  console.log('\n🔥 Top 10 霸榜项目：');
  for (const [repo, history] of sorted) {
    console.log(`  - ${repo}: ${history.dates.length} 次上榜`);
  }
}

// 执行迁移
migrate().catch(console.error);
