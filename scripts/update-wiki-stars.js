#!/usr/bin/env node
/**
 * Wiki Stars 更新脚本
 * 从 GitHub API 获取所有项目 Wiki 的最新 Stars 并更新
 */

const fs = require('fs');
const path = require('path');
const WikiManager = require('../src/wiki/wiki-manager');
const { fetchRepoDetails } = require('../src/scraper/github-api');
const logger = require('../src/utils/logger');

// 加载 .env 文件（优先从主目录加载）
// 注意：在 worktree 中，需要 4 级 .. 才能到达主目录
const mainEnvPath = path.join(__dirname, '..', '..', '..', '..', '.env');
const localEnvPath = path.join(__dirname, '..', '.env');
const envPath = fs.existsSync(mainEnvPath) ? mainEnvPath : localEnvPath;
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
}

const wikiManager = new WikiManager();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

async function updateAllStars() {
  console.log('🚀 开始更新所有项目 Wiki 的 Stars...\n');

  const projectsDir = wikiManager.projectsDir;
  if (!fs.existsSync(projectsDir)) {
    logger.error('项目 Wiki 目录不存在');
    return;
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  console.log(`📂 找到 ${files.length} 个项目 Wiki\n`);

  let updated = 0;
  let failed = 0;
  let rateLimited = false;

  for (const file of files) {
    if (rateLimited) {
      logger.warn('已达到 GitHub API 速率限制，停止更新');
      break;
    }

    const match = file.match(/^(.+)_(.+)\.md$/);
    if (!match) continue;

    const owner = match[1];
    const repo = match[2];
    const fullName = `${owner}/${repo}`;

    try {
      logger.info(`[${updated + 1}/${files.length}] 获取 ${fullName} 的 Stars...`);

      const details = await fetchRepoDetails(fullName, GITHUB_TOKEN);

      if (!details || details.stars === undefined) {
        logger.warn(`  ⚠️  获取失败，跳过`);
        failed++;
        continue;
      }

      // 更新 Wiki 中的 Stars
      await wikiManager.updateBasicInfo(owner, repo, {
        stars: String(details.stars),
        starsDate: new Date().toISOString().split('T')[0]
      });

      updated++;
      logger.success(`  ✅ ${fullName}: ${details.stars} ⭐`);

      // 避免触发速率限制
      if (!GITHUB_TOKEN) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // 无 token 时延迟 1.5 秒
      } else {
        await new Promise(resolve => setTimeout(resolve, 100)); // 有 token 时延迟 100ms
      }
    } catch (error) {
      if (error.message.includes('403')) {
        logger.error('  🚫 GitHub API 速率限制已达');
        rateLimited = true;
      } else {
        logger.error(`  ❌ ${fullName}: ${error.message}`);
        failed++;
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 更新完成！');
  console.log(`   成功：${updated} 个`);
  console.log(`   失败：${failed} 个`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!GITHUB_TOKEN) {
    console.log('\n💡 提示：设置 GITHUB_TOKEN 环境变量可以加快速度并避免速率限制');
    console.log('   export GITHUB_TOKEN=your_token_here');
  }
}

updateAllStars().catch(console.error);
