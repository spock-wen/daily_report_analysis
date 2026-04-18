#!/usr/bin/env node
/**
 * 论文历史数据迁移脚本
 *
 * 功能：
 * 1. 从 HuggingFace API 获取历史论文数据
 * 2. 使用 WikiManager 批量创建论文 Wiki
 * 3. 支持增量更新（已存在的 Wiki 跳过）
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const WikiManager = require('../src/wiki/wiki-manager');
const logger = require('../src/utils/logger');

const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'papers', 'daily');
const BATCH_SIZE = 20;

/**
 * 从 GitHub 仓库获取 latest.json
 */
async function fetchPapersFromGitHub() {
  return new Promise((resolve, reject) => {
    const url = 'https://raw.githubusercontent.com/spock-wen/Daily-HuggingFace-AI-Papers/main/data/latest.json';
    logger.info(`正在获取论文数据：${url}`);

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const papers = JSON.parse(data);
          logger.success(`获取到 ${papers.length} 篇论文`);
          resolve(papers);
        } catch (error) {
          reject(new Error(`JSON 解析失败：${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 从 arXiv URL 提取 arXiv ID
 */
function extractArxivId(url) {
  if (!url) return null;

  // huggingface.co/papers/2604.14268
  const hfMatch = url.match(/huggingface\.co\/papers\/(\d{4}\.\d{4,5})/i);
  if (hfMatch) return hfMatch[1];

  // arxiv.org/abs/2604.14268
  const absMatch = url.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i);
  if (absMatch) return absMatch[1];

  // ar5iv.org/html/2604.14268
  const htmlMatch = url.match(/ar5iv\.org\/html\/(\d{4}\.\d{4,5})/i);
  if (htmlMatch) return htmlMatch[1];

  return null;
}

/**
 * 检测论文领域
 */
function detectPaperDomain(paper) {
  const text = ((paper.title || '') + ' ' + JSON.stringify(paper.details || {})).toLowerCase();

  if (text.includes('agent') || text.includes('multi') || text.includes('swarm')) return 'agent';
  if (text.includes('rag') || text.includes('retrieval') || text.includes('retriever')) return 'rag';
  if (text.includes('llm') || text.includes('language model') || text.includes('transformer')) return 'llm';
  if (text.includes('speech') || text.includes('audio') || text.includes('voice') || text.includes('tts')) return 'speech';
  if (text.includes('vision') || text.includes('image') || text.includes('diffusion')) return 'vision';
  if (text.includes('code') || text.includes('programming') || text.includes('dev')) return 'dev-tool';
  if (text.includes('robot') || text.includes('control')) return 'robotics';

  return 'other';
}

/**
 * 检测论文类型
 */
function detectPaperType(paper) {
  const text = ((paper.title || '') + ' ' + JSON.stringify(paper.details || {})).toLowerCase();

  if (text.includes('survey') || text.includes('review') || text.includes('综述')) return 'Survey';
  if (text.includes('benchmark') || text.includes('evaluation')) return 'Benchmark';
  if (text.includes('dataset')) return 'Dataset';
  if (text.includes('framework') || text.includes('tool')) return 'Tool';

  return 'Research';
}

/**
 * 提取代码链接
 */
function extractCodeLinks(paper) {
  const links = [];
  const details = paper.details || {};

  if (details.code_url) links.push(details.code_url);
  if (details.github_url) links.push(details.github_url);
  if (details.demo_url) links.push(details.demo_url);

  return links;
}

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 主函数
 */
async function migrate() {
  console.log('============================================================');
  console.log('  论文历史数据迁移');
  console.log('============================================================\n');

  const wikiManager = new WikiManager();
  const today = new Date().toISOString().split('T')[0];

  // 确保输出目录存在
  ensureDir(OUTPUT_DIR);

  // 步骤 1: 获取论文数据
  console.log('📥 步骤 1: 获取 HuggingFace 论文数据...\n');
  let papers;
  try {
    papers = await fetchPapersFromGitHub();
  } catch (error) {
    console.error(`❌ 获取论文数据失败：${error.message}`);
    process.exit(1);
  }

  // 保存原始 JSON 数据
  const jsonPath = path.join(OUTPUT_DIR, `papers-${today}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(papers, null, 2), 'utf-8');
  console.log(`📄 原始数据已保存：${jsonPath}\n`);

  // 步骤 2: 创建论文 Wiki
  console.log('📝 步骤 2: 创建论文 Wiki...\n');

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const paper of papers) {
    const arxivId = extractArxivId(paper.paper_url);
    if (!arxivId) {
      skipped++;
      continue;
    }

    try {
      const wikiPath = path.join(wikiManager.papersDir, `${arxivId}.md`);
      const wikiExists = fs.existsSync(wikiPath);

      if (!wikiExists) {
        // 创建新 Wiki
        const authors = Array.isArray(paper.authors) ? paper.authors.join(', ') : (paper.authors || 'Unknown');
        await wikiManager.createPaperWiki(arxivId, {
          title: paper.title || 'Untitled',
          arxivId,
          authors: authors || 'Unknown',
          publishedDate: paper.details?.publishedDate || today,
          firstRecorded: today,
          paperType: detectPaperType(paper),
          domain: detectPaperDomain(paper),
          stars: String(paper.stars || 0),
          codeLinks: extractCodeLinks(paper),
          summary: '（待分析）',
          versionHistory: '',
          relatedPapers: '（待分析）'
        });
        created++;
        logger.debug(`创建论文 Wiki: ${arxivId}`);
      } else {
        // 更新已有 Wiki
        await wikiManager.updateBasicInfo(arxivId, null, {
          stars: String(paper.stars || 0),
          lastUpdated: today
        });
        updated++;
        logger.debug(`更新论文 Wiki: ${arxivId}`);
      }

      // 批量处理，避免过快
      if ((created + updated) % BATCH_SIZE === 0) {
        console.log(`  已处理 ${created + updated}/${papers.length} 篇论文...`);
      }
    } catch (error) {
      failed++;
      console.error(`❌ 处理 ${arxivId} 失败：${error.message}`);
    }
  }

  // 显示统计
  console.log('\n============================================================');
  console.log('  迁移完成！');
  console.log('============================================================\n');
  console.log(`📊 统计:`);
  console.log(`   ✅ 新建 Wiki: ${created} 篇`);
  console.log(`   🔄 更新 Wiki: ${updated} 篇`);
  console.log(`   ⏭️  跳过：${skipped} 篇（无法提取 arXiv ID）`);
  console.log(`   ❌ 失败：${failed} 篇`);
  console.log(`   📝 总计：${papers.length} 篇\n`);

  // 显示 Top 论文
  const topPapers = papers
    .filter(p => extractArxivId(p.paper_url))
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, 10);

  console.log('🔥 Top 10 高星论文：\n');
  for (const paper of topPapers) {
    const arxivId = extractArxivId(paper.paper_url);
    console.log(`   - [${paper.stars}⭐] ${paper.title.substring(0, 60)}... (${arxivId})`);
  }
  console.log('');
}

// 执行迁移
migrate().catch(console.error);
