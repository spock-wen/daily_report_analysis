#!/usr/bin/env node
/**
 * Wiki 分析质量修复脚本
 *
 * 修复版本历史中低质量的"分析"字段：
 * 1. 识别分析内容为空或模板化的 Wiki
 * 2. 调用 LLM 生成有信息量的项目分析
 * 3. 写回版本历史
 *
 * 使用方法:
 *   node scripts/fix-wiki-analysis.js              # 修复所有
 *   node scripts/fix-wiki-analysis.js --limit 10  # 只修复 10 个
 *   node scripts/fix-wiki-analysis.js --dry-run   # 预览不写入
 */

const fs = require('fs');
const path = require('path');
const { createLlmClient } = require('../src/utils/llm-client');

const WIKI_DIR = path.join(process.cwd(), 'wiki', 'projects');
const BATCH_SIZE = 10;

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
Wiki 分析质量修复脚本 - 修复版本历史中的低质量分析

使用方法:
  node scripts/fix-wiki-analysis.js [选项]

选项:
  -h, --help          显示帮助信息
  --limit <N>         只修复 N 个项目
  --dry-run           预览模式，不写入文件

示例:
  node scripts/fix-wiki-analysis.js
  node scripts/fix-wiki-analysis.js --limit 10
`);
}

/**
 * 检测分析是否低质量
 */
function isAnalysisLowQuality(content) {
  if (!content) return true;

  // 提取最近的版本分析
  const recentAnalysisMatch = content.match(/### (\d{4}-\d{2}-\d{2})（([^)]+)）[\s\S]*?\*\*分析\*\*:(.+?)(?=\n###|\n##|$)/);

  if (!recentAnalysisMatch) return true;

  const analysis = recentAnalysisMatch[3].trim();

  // 分析为空
  if (!analysis || analysis.length < 10) return true;

  // 分析是模板内容
  if (analysis.includes('待补充')) return true;
  if (analysis.includes('模板')) return true;

  // 分析过于简单（少于 20 字）
  if (analysis.length < 20) return true;

  return false;
}

/**
 * 提取项目信息
 */
function extractProjectInfo(content) {
  if (!content) return null;

  const extract = (regex) => {
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  };

  // 提取最近版本信息
  const recentVersionMatch = content.match(/### (\d{4}-\d{2}-\d{2})（([^)]+)）[\s\S]*?\*\*来源\*\*:([\s\S]*?)\*\*分析\*\*:(.+?)(?=\n###|\n##|$)/);

  return {
    owner: extract(/# ([^/]+)\//),
    repo: extract(/# [^/]+\/([^ ]+)/),
    stars: extract(/- GitHub Stars: ([^\n（]+)/),
    language: extract(/- 语言：([^\n]+)/),
    domain: extract(/- 领域分类：([^\n]+)/),
    coreFunctions: extract(/## 核心功能\n([\s\S]*?)(?=\n## )/),
    recentVersion: recentVersionMatch ? {
      date: recentVersionMatch[1],
      eventType: recentVersionMatch[2].trim(),
      source: recentVersionMatch[3].trim(),
      analysis: recentVersionMatch[4].trim()
    } : null
  };
}

/**
 * 生成 LLM Prompt
 */
function buildPrompt(projectInfo) {
  return `你是一个技术项目分析师。请根据以下项目信息，生成一段有深度、有信息量的项目分析。

项目信息:
- 项目：${projectInfo.owner}/${projectInfo.repo}
- Stars: ${projectInfo.stars}
- 语言：${projectInfo.language || 'Unknown'}
- 领域：${projectInfo.domain || 'Unknown'}

核心功能:
${projectInfo.coreFunctions || '(空)'}

当前分析（如有）:
${projectInfo.recentVersion?.analysis || '(空)'}

要求:
1. 生成 80-150 字的分析内容
2. 内容要有信息量，避免"受到社区广泛关注"这种模板化表述
3. 基于项目名称、领域、Stars 数推断其技术价值和市场地位
4. 可以包含对技术趋势、应用场景、竞争格局的见解
5. 如果有多个版本历史，分析应该与已有版本形成递进或补充

直接返回分析文本，不需要 JSON 格式。`;
}

/**
 * 修复分析内容 - 更新最近的版本
 */
function fixAnalysisContent(content, newAnalysis) {
  if (!content) return content;

  // 找到所有版本条目
  const versionRegex = /(### \d{4}-\d{2}-\d{2}（[^)]+）[\s\S]*?\*\*分析\*\*:)(.+?)(?=\n###|\n##|$)/gs;
  const matches = [...content.matchAll(versionRegex)];

  if (matches.length === 0) {
    return content;
  }

  // 获取最后一个（最近的）版本的匹配位置
  const lastMatch = matches[matches.length - 1];
  const lastVersionStart = lastMatch.index;
  const lastVersionEnd = lastMatch.index + lastMatch[0].length;

  // 只替换最近版本的分析部分
  const before = content.slice(0, lastMatch.index);
  const after = content.slice(lastVersionEnd);
  const lastVersionHeader = lastMatch[0].match(/(### \d{4}-\d{2}-\d{2}（[^)]+）[\s\S]*?\*\*分析\*\*:)/s)[1];

  const fixedContent = before + lastVersionHeader + '\n' + newAnalysis + '\n' + after;

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

  if (!fs.existsSync(WIKI_DIR)) {
    console.error(`错误：Wiki 目录不存在：${WIKI_DIR}`);
    process.exit(1);
  }

  // 获取所有 Wiki 文件
  const files = fs.readdirSync(WIKI_DIR).filter(f => f.endsWith('.md'));
  console.log(`发现 ${files.length} 个 Wiki 文件`);

  // 识别低质量分析
  const lowQualityFiles = [];
  for (const file of files) {
    const filePath = path.join(WIKI_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    if (isAnalysisLowQuality(content)) {
      lowQualityFiles.push(file);
    }
  }

  console.log(`识别出 ${lowQualityFiles.length} 个低质量分析`);

  if (lowQualityFiles.length === 0) {
    console.log('✅ 所有 Wiki 分析质量良好，无需修复');
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
      // 调用 LLM 生成分析
      const prompt = buildPrompt(projectInfo);
      const response = await llmClient.generate(prompt, {
        temperature: 0.5,  // 稍高温度，增加创造性
        maxTokens: 200
      });

      // 清理响应（去除可能的 JSON 标记）
      let cleanedAnalysis = response.replace(/^```json\s*|\s*```$/g, '').trim();
      cleanedAnalysis = cleanedAnalysis.replace(/^["']|["']$/g, '').trim();

      console.log(`  ✅ 生成分析 (${cleanedAnalysis.length} 字)`);
      console.log(`     摘要：${cleanedAnalysis.slice(0, 50)}...`);

      if (!options.dryRun) {
        // 写回文件
        const fixedContent = fixAnalysisContent(content, cleanedAnalysis);
        fs.writeFileSync(filePath, fixedContent, 'utf-8');
        console.log('  ✅ 已写入文件');
      } else {
        console.log('  ℹ️  [dry-run] 跳过写入');
      }

      successCount++;

      // 限速
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
