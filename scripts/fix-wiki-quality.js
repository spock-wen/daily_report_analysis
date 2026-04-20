#!/usr/bin/env node
/**
 * Wiki 质量修复脚本
 *
 * 使用 LLM 批量修复低质量的 Wiki 项目：
 * 1. 读取现有 Wiki 内容
 * 2. 识别低质量项目（核心功能为空、分析内容为模板）
 * 3. 调用 LLM 生成有信息量的内容
 * 4. 写回 Wiki 文件
 *
 * 使用方法:
 *   node scripts/fix-wiki-quality.js              # 修复所有低质 Wiki
 *   node scripts/fix-wiki-quality.js --limit 10  # 只修复 10 个
 *   node scripts/fix-wiki-quality.js --dry-run   # 预览不写入
 */

const fs = require('fs');
const path = require('path');
const { createLlmClient } = require('../src/utils/llm-client');
const logger = require('../src/utils/logger');

// 配置
const WIKI_DIR = path.join(process.cwd(), 'wiki', 'projects');
const BATCH_SIZE = 10;  // 每批处理数量，避免 API 速率限制

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: null,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Wiki 质量修复脚本 - 使用 LLM 批量修复低质量 Wiki

使用方法:
  node scripts/fix-wiki-quality.js [选项]

选项:
  -h, --help          显示帮助信息
  --limit <N>         只修复 N 个项目
  --dry-run           预览模式，不写入文件

示例:
  # 修复所有低质 Wiki
  node scripts/fix-wiki-quality.js

  # 只修复 10 个
  node scripts/fix-wiki-quality.js --limit 10

  # 预览不写入
  node scripts/fix-wiki-quality.js --dry-run
`);
}

/**
 * 检测 Wiki 是否低质量
 */
function isLowQuality(content) {
  if (!content) return true;

  // 检测核心功能是否为空或模板
  const coreFuncMatch = content.match(/## 核心功能\n([\s\S]*?)(?=\n## )/);
  if (!coreFuncMatch) return true;

  const coreFunc = coreFuncMatch[1].trim();
  if (!coreFunc || coreFunc === '') return true;
  if (coreFunc.includes('待补充')) return true;
  if (coreFunc.includes('查看 README')) return true;
  if (coreFunc.includes('（待')) return true;

  // 检测分析是否过于简单
  const lines = coreFunc.split('\n').filter(l => l.startsWith('- '));
  if (lines.length < 2) return true;  // 少于 2 条核心功能

  return false;
}

/**
 * 从 Wiki 内容提取项目信息
 */
function extractProjectInfo(content) {
  if (!content) return null;

  const extract = (regex) => {
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    owner: extract(/# ([^/]+)\//),
    repo: extract(/# [^/]+\/([^ ]+)/),
    stars: extract(/- GitHub Stars: ([^\n（]+)/),
    language: extract(/- 语言：([^\n]+)/),
    domain: extract(/- 领域分类：([^\n]+)/),
    firstSeen: extract(/- 首次上榜：([^\n]+)/),
    versionHistory: extract(/## 版本历史\n([\s\S]*?)(?=\n## |$)/)
  };
}

/**
 * 生成 LLM Prompt
 */
function buildPrompt(projectInfo) {
  return `你是一个技术项目分析师。请根据以下项目信息，生成 4 条有信息量的核心功能描述。

项目信息:
- 项目：${projectInfo.owner}/${projectInfo.repo}
- Stars: ${projectInfo.stars}
- 语言：${projectInfo.language || 'Unknown'}
- 领域：${projectInfo.domain || 'Unknown'}
- 首次上榜：${projectInfo.firstSeen}

版本历史摘要:
${projectInfo.versionHistory ? projectInfo.versionHistory.slice(0, 500) : '暂无'}

要求:
1. 生成 4 条核心功能，每条 20-50 字
2. 内容要有信息量，避免"提供 XX 能力"这种模板化表述
3. 基于项目名称和领域推断其可能的功能
4. 如果信息不足，可以基于领域常识生成合理推测

请以 JSON 格式返回:
{
  "coreFunctions": [
    "功能 1 描述",
    "功能 2 描述",
    "功能 3 描述",
    "功能 4 描述"
  ],
  "reason": "生成思路说明（一句话）"
}`;
}

/**
 * 修复 Wiki 内容
 */
function fixWikiContent(content, coreFunctions) {
  if (!content) return content;

  // 替换核心功能部分
  const newCoreFunc = coreFunctions.map(f => `- ${f}`).join('\n');

  // 尝试两种正则模式
  // 模式 1: 核心功能后面有其他章节
  let fixedContent = content.replace(
    /## 核心功能\n([\s\S]*?)(?=\n## )/,
    `## 核心功能\n${newCoreFunc}\n\n`
  );

  // 模式 2: 核心功能是最后一个章节
  if (fixedContent === content) {
    fixedContent = content.replace(
      /## 核心功能\n([\s\S]*?)$/,
      `## 核心功能\n${newCoreFunc}\n\n`
    );
  }

  return fixedContent;
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // 检查 Wiki 目录
  if (!fs.existsSync(WIKI_DIR)) {
    console.error(`错误：Wiki 目录不存在：${WIKI_DIR}`);
    process.exit(1);
  }

  // 获取所有 Wiki 文件
  const files = fs.readdirSync(WIKI_DIR).filter(f => f.endsWith('.md'));
  console.log(`发现 ${files.length} 个 Wiki 文件`);

  // 识别低质量 Wiki
  const lowQualityFiles = [];
  for (const file of files) {
    const filePath = path.join(WIKI_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    if (isLowQuality(content)) {
      lowQualityFiles.push(file);
    }
  }

  console.log(`识别出 ${lowQualityFiles.length} 个低质量 Wiki`);

  if (lowQualityFiles.length === 0) {
    console.log('✅ 所有 Wiki 质量良好，无需修复');
    process.exit(0);
  }

  // 限制处理数量
  let filesToProcess = lowQualityFiles;
  if (options.limit) {
    filesToProcess = lowQualityFiles.slice(0, options.limit);
    console.log(`限制处理 ${options.limit} 个`);
  }

  // 创建 LLM 客户端
  const llmClient = createLlmClient();

  let successCount = 0;
  let failCount = 0;

  // 批量处理
  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    const filePath = path.join(WIKI_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const projectInfo = extractProjectInfo(content);

    console.log(`\n[${i + 1}/${filesToProcess.length}] 处理：${file}`);

    if (!projectInfo) {
      console.log('  ⚠️ 无法解析项目信息，跳过');
      failCount++;
      continue;
    }

    try {
      // 调用 LLM 生成核心功能
      const prompt = buildPrompt(projectInfo);
      const response = await llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 500
      });

      // 解析 JSON 响应
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('  ⚠️ LLM 返回格式错误，跳过');
        failCount++;
        continue;
      }

      const result = JSON.parse(jsonMatch[0]);
      if (!result.coreFunctions || result.coreFunctions.length === 0) {
        console.log('  ⚠️ LLM 未生成有效内容，跳过');
        failCount++;
        continue;
      }

      console.log(`  ✅ 生成 ${result.coreFunctions.length} 条核心功能`);
      console.log(`     说明：${result.reason}`);

      if (!options.dryRun) {
        // 写回文件
        const fixedContent = fixWikiContent(content, result.coreFunctions);
        fs.writeFileSync(filePath, fixedContent, 'utf-8');
        console.log('  ✅ 已写入文件');
      } else {
        console.log('  ℹ️  [dry-run] 跳过写入');
      }

      successCount++;

      // 限速：每 5 个请求暂停一下
      if ((i + 1) % 5 === 0) {
        console.log('  ⏱️  暂停 2 秒...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.log(`  ❌ 处理失败：${error.message}`);
      failCount++;
    }
  }

  // 输出结果
  console.log('\n' + '='.repeat(50));
  console.log('修复完成！');
  console.log(`  成功：${successCount} 个`);
  console.log(`  失败：${failCount} 个`);
  console.log(`  模式：${options.dryRun ? '预览 (未写入)' : '写入'}`);
  console.log('='.repeat(50));
}

main().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
