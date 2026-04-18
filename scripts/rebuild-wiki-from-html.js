#!/usr/bin/env node

/**
 * 从 HTML 报告重新生成 Wiki
 *
 * 问题：insights JSON 数据不完整，导致 Wiki 记录缺失
 * 解决：直接从完整的 HTML 报告提取历史数据
 *
 * 用法：node scripts/rebuild-wiki-from-html.js
 */

const fs = require('fs');
const path = require('path');
const WikiManager = require('../src/wiki/wiki-manager');

const REPORTS_DIR = path.join(__dirname, '..', '..', '..', '..', 'reports', 'daily');
const wikiManager = new WikiManager();

/**
 * 从 HTML 内容中提取项目信息
 */
function extractProjectsFromHtml(htmlContent, date) {
  const projects = [];

  // 匹配项目卡片
  const projectCardRegex = /<div class="project-card">([\s\S]*?)<\/div>\s*<\/div>\s*$/gm;
  const projectLinkRegex = /<a href="https:\/\/github\.com\/([^"]+)" class="project-name"[^>]*>\s*\d+\.\s*([^<]+)\s*<\/a>/;
  const starsRegex = /<span class="stat-badge" title="总星数"[^>]*>([\s\S]*?)<\/span>/;
  // 改进的 Stars 提取：匹配 SVG 后面的文本节点
  const starValueRegex = /<svg[^>]*>([\s\S]*?)<\/svg>\s*([0-9.]+[wk]?)\s*/i;

  let cardMatch;
  while ((cardMatch = projectCardRegex.exec(htmlContent)) !== null) {
    const cardContent = cardMatch[1];
    const linkMatch = projectLinkRegex.exec(cardContent);

    if (linkMatch) {
      const fullName = linkMatch[1].trim();
      const displayName = linkMatch[2].trim();

      // 提取 Stars
      const starsMatch = starsRegex.exec(cardContent);
      let stars = 0;
      if (starsMatch) {
        const starsContent = starsMatch[1];
        const starValueMatch = starValueRegex.exec(starsContent);
        if (starValueMatch) {
          const starStr = starValueMatch[2].trim();
          stars = parseStars(starStr);
        } else {
          // 备选方案：尝试匹配 vertical-align span
          const altMatch = starsContent.match(/<span style="vertical-align: middle;">([^<]+)<\/span>/);
          if (altMatch) {
            stars = parseStars(altMatch[1].trim());
          }
        }
      }

      // 提取描述
      const descMatch = /<div class="project-description">([^<]*)<\/div>/.exec(cardContent);
      const description = descMatch ? descMatch[1].trim() : '';

      // 提取核心功能
      const coreFunctions = [];
      const coreFuncRegex = /<div class="detail-column">\s*<h4>核心功能<\/h4>\s*<ul>([\s\S]*?)<\/ul>/;
      const coreFuncMatch = coreFuncRegex.exec(cardContent);
      if (coreFuncMatch) {
        const liRegex = /<li>([^<]+)<\/li>/g;
        let liMatch;
        while ((liMatch = liRegex.exec(coreFuncMatch[1])) !== null) {
          coreFunctions.push(liMatch[1].trim());
        }
      }

      projects.push({
        fullName,
        displayName,
        stars,
        description,
        coreFunctions,
        date
      });
    }
  }

  // 也从热点项目部分提取
  const hotSectionRegex = /<h3>热点项目<\/h3>\s*<ul>([\s\S]*?)<\/ul>/;
  const hotMatch = hotSectionRegex.exec(htmlContent);
  if (hotMatch) {
    const hotList = hotMatch[1];
    const hotLinkRegex = /<a href="https:\/\/github\.com\/([^"]+)"[^>]*>([^<]+)<\/a>([^<]*)/g;
    let hotLinkMatch;
    while ((hotLinkMatch = hotLinkRegex.exec(hotList)) !== null) {
      const fullName = hotLinkMatch[1].trim();
      const hotText = hotLinkMatch[3] ? hotLinkMatch[3].trim() : '';

      // 检查是否已存在
      if (!projects.find(p => p.fullName === fullName)) {
        projects.push({
          fullName,
          displayName: fullName.split('/')[1],
          stars: 0,
          description: hotText,
          coreFunctions: [],
          date,
          isHot: true
        });
      }
    }
  }

  return projects;
}

/**
 * 解析 Stars 字符串（支持 k、万、千、w 等单位）
 */
function parseStars(str) {
  if (!str) return 0;
  const clean = str.toLowerCase().replace(/,/g, '').trim();

  // 中文单位：万、千
  if (clean.includes('万')) {
    return Math.round(parseFloat(clean.replace('万', '')) * 10000);
  }
  if (clean.includes('千')) {
    return Math.round(parseFloat(clean.replace('千', '')) * 1000);
  }

  // 英文简写：w=万，k、m
  if (clean.endsWith('w')) {
    return Math.round(parseFloat(clean.slice(0, -1)) * 10000);
  }
  if (clean.endsWith('k')) {
    return Math.round(parseFloat(clean.slice(0, -1)) * 1000);
  }
  if (clean.endsWith('m')) {
    return Math.round(parseFloat(clean.slice(0, -1)) * 1000000);
  }

  return parseInt(clean) || 0;
}

/**
 * 检测领域
 */
function detectDomain(name, description = '') {
  const text = (name + ' ' + description).toLowerCase();

  // Agent/框架相关（最高优先级）
  if (text.includes('superpower') || text.includes('agent-framework') || text.includes('agent-lightning')) return 'agent';
  if (text.includes('agent') || text.includes('multi') || text.includes('swarm') || text.includes('skill')) return 'agent';
  if (text.includes('mcp') || text.includes('model-context')) return 'dev-tool';
  if (text.includes('rag') || text.includes('retrieval') || text.includes('augment')) return 'rag';
  if (text.includes('llm') || text.includes('language model') || text.includes('minimind')) return 'llm';
  if (text.includes('speech') || text.includes('audio') || text.includes('voice') || text.includes('whisper') || text.includes('tts')) return 'speech';
  if (text.includes('vision') || text.includes('image') || text.includes('face') || text.includes('cam')) return 'vision';
  if (text.includes('browser') || text.includes('automate') || text.includes('playwright')) return 'browser';
  if (text.includes('code') || text.includes('dev') || text.includes('tool')) return 'dev-tool';
  if (text.includes('flow') || text.includes('platform') || text.includes('studio')) return 'platform';
  if (text.includes('edge') || text.includes('runtime') || text.includes('worker')) return 'infrastructure';
  if (text.includes('learn') || text.includes('tutorial') || text.includes('beginner')) return 'education';
  if (text.includes('game') || text.includes('minecraft')) return 'game';
  if (text.includes('physics') || text.includes('robot')) return 'physics';
  if (text.includes('finance') || text.includes('trading') || text.includes('hedge')) return 'finance';
  if (text.includes('security') || text.includes('scan') || text.includes('trivy')) return 'security';
  if (text.includes('data') || text.includes('database') || text.includes('vector')) return 'data';

  return 'general';
}

/**
 * 主函数
 */
async function rebuild() {
  console.log('🚀 开始从 HTML 重建 Wiki...\n');

  // 扫描所有 HTML 文件
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.html') && f.includes('github-ai-trending'))
    .sort();

  console.log(`📂 找到 ${files.length} 个日报 HTML 文件\n`);

  // 项目历史聚合
  const projectHistory = new Map();

  // 阶段 1: 解析所有 HTML 文件
  console.log('📊 阶段 1: 解析 HTML 文件...\n');

  for (const file of files) {
    const date = file.replace('github-ai-trending-', '').replace('.html', '');
    const filePath = path.join(REPORTS_DIR, file);

    try {
      const htmlContent = fs.readFileSync(filePath, 'utf-8');
      const projects = extractProjectsFromHtml(htmlContent, date);

      for (const project of projects) {
        if (!projectHistory.has(project.fullName)) {
          projectHistory.set(project.fullName, {
            dates: [],
            descriptions: [],
            coreFunctions: new Set(),
            maxStars: 0,
            domain: 'general'
          });
        }

        const history = projectHistory.get(project.fullName);
        if (!history.dates.includes(date)) {
          history.dates.push(date);
          if (project.description) {
            history.descriptions.push(project.description);
          }
          project.coreFunctions.forEach(f => history.coreFunctions.add(f));
          if (project.stars > history.maxStars) {
            history.maxStars = project.stars;
          }
          // 每次都更新领域（更准确）
          const detectedDomain = detectDomain(project.fullName, project.description);
          if (detectedDomain !== 'general') {
            history.domain = detectedDomain;
          }
        }
      }

      if (files.indexOf(file) % 10 === 9) {
        console.log(`  已解析 ${files.indexOf(file) + 1}/${files.length} 个文件`);
      }
    } catch (error) {
      console.error(`⚠️  解析 ${file} 失败：${error.message}`);
    }
  }

  console.log(`📊 聚合到 ${projectHistory.size} 个项目\n`);

  // 阶段 2: 重建 Wiki
  console.log('📝 阶段 2: 重建 Wiki 文件...\n');

  let created = 0;
  let failed = 0;

  // 按上榜次数排序
  const sorted = Array.from(projectHistory.entries())
    .sort((a, b) => b[1].dates.length - a[1].dates.length);

  for (const [fullName, history] of sorted) {
    const [owner, repo] = fullName.split('/');
    if (!owner || !repo) {
      console.log(`⚠️  跳过无效项目名：${fullName}`);
      continue;
    }

    try {
      const wikiPath = path.join(wikiManager.projectsDir, `${owner}_${repo}.md`);

      // 如果 Wiki 已存在，跳过（或者可以选择删除重建）
      if (fs.existsSync(wikiPath)) {
        console.log(`⚠️  Wiki 已存在，跳过：${fullName}`);
        continue;
      }

      // 创建 Wiki（appearances 设为 0，让 appendVersion 从 1 开始累加）
      await wikiManager.createProjectWiki(owner, repo, {
        firstSeen: history.dates[0],
        lastSeen: history.dates[history.dates.length - 1],
        appearances: '0',
        domain: history.domain,
        language: 'Unknown',
        stars: history.maxStars.toString(),
        coreFunctions: Array.from(history.coreFunctions).slice(0, 4),
        versionHistory: '',
        crossReferences: '（待分析）'
      });

      // 追加每个版本的历史记录
      for (const date of history.dates) {
        await wikiManager.appendVersion(owner, repo, {
          date,
          eventType: '日报收录',
          source: `[日报 ${date}](../../reports/daily/github-ai-trending-${date}.html)`,
          analysis: '详见热点项目列表'
        });
      }

      created++;
      if (created % 20 === 0) {
        console.log(`  已生成 ${created}/${sorted.length} 个 Wiki`);
      }
    } catch (error) {
      failed++;
      console.error(`⚠️  创建 ${fullName} Wiki 失败：${error.message}`);
    }
  }

  console.log('\n✅ Wiki 重建完成！');
  console.log(`📊 成功创建：${created} 个 Wiki`);
  console.log(`⚠️  失败/跳过：${failed} 个`);

  // 显示 Top 10 霸榜项目
  const top10 = sorted.slice(0, 10);
  console.log('\n🔥 Top 10 霸榜项目：');
  for (const [repo, history] of top10) {
    console.log(`  - ${repo}: ${history.dates.length} 次上榜`);
  }
}

// 执行重建
rebuild().catch(console.error);
