#!/usr/bin/env node
/**
 * 批量更新 Wiki 领域分类
 * 使用最新的 detectDomain 函数重新分类所有项目
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '..', 'wiki', 'projects');

/**
 * 检测项目领域（与 migrate-json-to-wiki.js 保持一致）
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

async function updateDomains() {
  console.log('开始更新 Wiki 领域分类...\n');

  const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.md'));
  let updated = 0;

  for (const file of files) {
    const filePath = path.join(PROJECTS_DIR, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // 提取项目名
    const match = file.match(/^(.+)_(.+)\.md$/);
    if (!match) continue;

    const repoName = `${match[1]}/${match[2]}`;

    // 从版本历史中提取描述文本用于领域检测
    const versionMatch = content.match(/\*\*分析\*\*: (.+?) -/);
    const hotText = versionMatch ? versionMatch[1] : '';

    // 检测新领域
    const newDomain = detectDomain(repoName, hotText);

    // 提取旧领域
    const oldDomainMatch = content.match(/- 领域分类：(.+?)\n/);
    const oldDomain = oldDomainMatch ? oldDomainMatch[1].trim() : '';

    // 如果领域不同则更新
    if (oldDomain !== newDomain) {
      content = content.replace(
        /- 领域分类：[\w-]+/,
        `- 领域分类：${newDomain}`
      );
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`  ${repoName}: ${oldDomain || 'N/A'} -> ${newDomain}`);
      updated++;
    }
  }

  console.log(`\n✅ 更新完成！共更新 ${updated}/${files.length} 个项目\n`);

  // 显示新的领域分布
  const domainCount = {};
  for (const file of fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.md'))) {
    const content = fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf-8');
    const match = content.match(/- 领域分类：(.+?)\n/);
    if (match) {
      const domain = match[1].trim();
      domainCount[domain] = (domainCount[domain] || 0) + 1;
    }
  }

  console.log('📊 领域分布统计：');
  Object.entries(domainCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([domain, count]) => {
      console.log(`  - ${domain}: ${count} 个项目`);
    });
}

updateDomains().catch(console.error);
