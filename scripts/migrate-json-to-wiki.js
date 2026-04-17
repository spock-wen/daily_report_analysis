#!/usr/bin/env node

/**
 * JSON 到 Wiki 迁移脚本
 *
 * 功能：
 * 1. 扫描 data/insights/daily/*.json 文件
 * 2. 按项目聚合历史数据（首次上榜、上榜次数、历史分析）
 * 3. 批量生成初始 Wiki Markdown 文件
 */

const fs = require('fs');
const path = require('path');

const INSIGHTS_DIR = path.join(__dirname, '..', 'data', 'insights', 'daily');
const WIKI_DIR = path.join(__dirname, '..', 'wiki', 'projects');

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
  if (text.includes('agent') || text.includes('multi') || text.includes('swarm')) return 'agent';
  if (text.includes('rag') || text.includes('retrieval')) return 'rag';
  if (text.includes('llm') || text.includes('language model')) return 'llm';
  if (text.includes('speech') || text.includes('audio') || text.includes('voice')) return 'speech';
  if (text.includes('code') || text.includes('dev') || text.includes('auto')) return 'dev-tool';
  if (text.includes('game') || text.includes('minecraft')) return 'game';
  if (text.includes('physics') || text.includes('robot')) return 'physics';
  if (text.includes('finance') || text.includes('trading')) return 'finance';
  return 'other';
}

/**
 * 生成项目 Wiki 内容
 */
function generateProjectWiki(repo, history) {
  const firstSeen = history.dates[0];
  const lastSeen = history.dates[history.dates.length - 1];
  const domain = detectDomain(repo, history.hotTexts[0] || '');

  let content = `# ${repo}

## 基本信息
- 首次上榜：${firstSeen}
- 最近上榜：${lastSeen}
- 上榜次数：${history.dates.length}
- 领域分类：${domain}

## 核心功能
${history.coreFunctions.join('\n')}

## 版本历史

`;

  // 追加每个版本的历史记录
  for (let i = 0; i < history.dates.length; i++) {
    const date = history.dates[i];
    const hotText = history.hotTexts[i] || '未记录';
    const analysis = history.analyses[i] || '暂无分析';

    content += `### ${date}
**来源**: [日报 ${date}](../../reports/daily/github-ai-trending-${date}.html)
**热点**: ${hotText}
**分析**: ${analysis}

`;
  }

  content += `## 跨项目关联
（待分析）
`;

  return content;
}

/**
 * 主函数
 */
async function migrate() {
  console.log('🚀 开始 JSON 到 Wiki 迁移...\n');

  // 确保输出目录存在
  if (!fs.existsSync(WIKI_DIR)) {
    fs.mkdirSync(WIKI_DIR, { recursive: true });
  }

  // 项目历史聚合 Map: repo -> { dates, hotTexts, analyses, coreFunctions }
  const projectHistory = new Map();

  // 扫描所有日报 JSON 文件
  const files = fs.readdirSync(INSIGHTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`📂 找到 ${files.length} 个日报文件\n`);

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
              coreFunctions: []
            });
          }

          const history = projectHistory.get(repo);
          history.dates.push(date);
          history.hotTexts.push(hotItem);
          history.analyses.push(data.action?.[0] || '暂无分析');
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
                coreFunctions: []
              });
            }
            // 如果是 action 中提到的，也记录下来
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

  // 生成 Wiki 文件
  console.log(`📊 聚合到 ${projectHistory.size} 个项目\n`);
  console.log('📝 开始生成 Wiki 文件...\n');

  let created = 0;
  for (const [repo, history] of projectHistory.entries()) {
    const wikiPath = path.join(WIKI_DIR, `${repo.replace('/', '_')}.md`);
    const content = generateProjectWiki(repo, history);

    fs.writeFileSync(wikiPath, content, 'utf-8');
    created++;

    if (created % 50 === 0) {
      console.log(`  已生成 ${created}/${projectHistory.size} 个 Wiki`);
    }
  }

  console.log('\n✅ 迁移完成！');
  console.log(`📁 输出目录：${WIKI_DIR}`);
  console.log(`📊 生成项目 Wiki 数量：${created}`);

  // 显示 Top 10 项目
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
