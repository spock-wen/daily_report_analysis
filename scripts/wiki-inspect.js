#!/usr/bin/env node
/**
 * Wiki Inspector CLI
 *
 * Wiki 健康检查工具
 *
 * 使用方法:
 *   node scripts/wiki-inspect.js              # 完整检查
 *   node scripts/wiki-inspect.js --json       # JSON 输出
 *   node scripts/wiki-inspect.js --brief      # 简要输出
 *   node scripts/wiki-inspect.js --category quality  # 只检查特定类别
 *   node scripts/wiki-inspect.js --check no-duplicate-versions  # 只检查特定项
 */

const path = require('path');
const fs = require('fs');
const WikiInspector = require('../src/wiki/inspector/wiki-inspector');

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    wikiDir: path.join(process.cwd(), 'wiki'),
    format: 'cli',
    category: null,
    check: null,
    runLlmChecks: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.format = 'json';
    } else if (arg === '--brief') {
      options.format = 'brief';
    } else if (arg === '--ci') {
      options.format = 'cicd';
    } else if (arg === '--llm') {
      options.runLlmChecks = true;
    } else if (arg === '--wiki-dir' && args[i + 1]) {
      options.wikiDir = args[++i];
    } else if (arg === '--category' && args[i + 1]) {
      options.category = args[++i];
    } else if (arg === '--check' && args[i + 1]) {
      options.check = args[++i];
    }
  }

  return options;
}

// 显示帮助信息
function showHelp() {
  console.log(`
Wiki Inspector - Wiki 健康检查工具

使用方法:
  node scripts/wiki-inspect.js [选项]

选项:
  -h, --help          显示帮助信息
  --json              输出 JSON 格式报告
  --brief             输出简要报告
  --ci                输出 CI/CD 格式 JSON（包含 success 字段）
  --llm               运行 LLM 深度检查（语义重复、分析质量）
  --wiki-dir <dir>    指定 Wiki 目录（默认：./wiki）
  --category <name>   只检查指定类别（structure/quality/relation）
  --check <name>      只检查指定检查项

示例:
  # 完整检查（规则检查）
  node scripts/wiki-inspect.js

  # JSON 格式输出
  node scripts/wiki-inspect.js --json > wiki-health.json

  # 只检查数据质量
  node scripts/wiki-inspect.js --category quality

  # 只检查重复记录
  node scripts/wiki-inspect.js --check no-duplicate-versions

  # LLM 深度检查（周报/月报使用）
  node scripts/wiki-inspect.js --llm

  # CI/CD 集成
  node scripts/wiki-inspect.js --ci | jq '.success'
`);
}

// 主函数
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // 验证 Wiki 目录
  if (!fs.existsSync(options.wikiDir)) {
    console.error(`错误：Wiki 目录不存在：${options.wikiDir}`);
    process.exit(1);
  }

  // 如果需要运行 LLM 检查，创建 LLM 客户端
  let llmClient = null;
  if (options.runLlmChecks) {
    try {
      const { createLlmClient } = require('../src/utils/llm-client');
      llmClient = createLlmClient();
      console.log('已启用 LLM 深度检查模式...\n');
    } catch (error) {
      console.error('警告：无法创建 LLM 客户端，LLM 检查将跳过');
      console.error(`错误信息：${error.message}`);
      options.runLlmChecks = false;
    }
  }

  // 创建检查器实例
  const inspector = new WikiInspector({
    baseDir: options.wikiDir,
    llmClient: llmClient
  });

  // 执行检查
  let result;

  try {
    if (options.check) {
      result = await inspector.inspectCheck(options.check);
      // 单个检查时，包装成完整结果格式
      result = {
        timestamp: new Date().toLocaleString('zh-CN'),
        summary: {
          totalProjects: 0,
          healthScore: result.status === 'pass' ? 100 : 0,
          passedChecks: result.status === 'pass' ? 1 : 0,
          warningChecks: result.status === 'warning' ? 1 : 0,
          failedChecks: result.status === 'fail' ? 1 : 0
        },
        results: [result],
        categoryResults: { [result.category || 'unknown']: [result] }
      };
    } else if (options.category) {
      result = await inspector.inspectCategory(options.category);
    } else {
      result = await inspector.inspect({
        runLlmChecks: options.runLlmChecks
      });
    }
  } catch (error) {
    console.error(`检查执行失败：${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }

  // 输出报告
  let output;

  switch (options.format) {
    case 'json':
      output = WikiInspector.toJSON(result);
      break;
    case 'cicd':
      output = WikiInspector.toCiCdJSON(result);
      break;
    case 'brief':
      output = WikiInspector.toBriefCLI(result);
      break;
    default:
      output = WikiInspector.toCLI(result);
  }

  console.log(output);

  // 根据检查结果设置退出码
  if (result.summary.failedChecks > 0) {
    process.exit(2); // 有失败项
  } else if (result.summary.warningChecks > 0) {
    process.exit(0); // 有警告项，但仍算成功
  } else {
    process.exit(0); // 全部通过
  }
}

main();
