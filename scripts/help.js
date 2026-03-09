#!/usr/bin/env node

/**
 * 帮助脚本 - 显示所有可用命令
 * 用法：node scripts/help.js
 *      npm run help
 */

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        GitHub Trending 报告生成系统 - 命令行工具          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📖 用法
═══════════════════════════════════════════════════════════

  # 生成日报
  node scripts/generate-daily.js <date>
  示例：node scripts/generate-daily.js 2026-03-08

  # 生成周报
  node scripts/generate-weekly.js <week>
  示例：node scripts/generate-weekly.js 2026-W10
        node scripts/generate-weekly.js 2026-03-02 (周起始日期)

  # 生成月报
  node scripts/generate-monthly.js <month>
  示例：node scripts/generate-monthly.js 2026-03

  # 一键生成所有报告
  node scripts/generate-all.js [date]
  示例：node scripts/generate-all.js
        node scripts/generate-all.js 2026-03-08

  # 显示帮助
  node scripts/help.js

═══════════════════════════════════════════════════════════

📦 NPM 命令
═══════════════════════════════════════════════════════════

  npm run generate:daily -- <date>     生成日报
  npm run generate:weekly -- <week>    生成周报
  npm run generate:monthly -- <month>  生成月报
  npm run generate:all [date]          生成所有报告
  npm run help                         显示帮助

═══════════════════════════════════════════════════════════

🔧 配置说明
═══════════════════════════════════════════════════════════

  1. 环境变量配置 (.env 文件)
     - LLM_API_KEY: 阿里云百炼 API Key (必需)
     - LLM_BASE_URL: API 基础 URL (默认：阿里云百炼)
     - LLM_MODEL: 使用的模型 (默认：qwen-plus)
     - FEISHU_APP_ID: 飞书应用 ID (可选)
     - WELINK_WEBHOOK_URLS: WeLink webhook (可选)

  2. 数据目录结构
     data/
     ├── briefs/        # 基础数据
     │   ├── daily/     # 日报数据
     │   ├── weekly/    # 周报数据
     │   └── monthly/   # 月报数据
     ├── insights/      # AI 洞察数据
     │   ├── daily/
     │   ├── weekly/
     │   └── monthly/
     └── archive/       # 历史数据归档

  3. 报告输出目录
     reports/
     ├── daily/         # 日报 HTML
     ├── weekly/        # 周报 HTML
     ├── monthly/       # 月报 HTML
     └── index.html     # 主页（待实现）

═══════════════════════════════════════════════════════════

📝 工作流程
═══════════════════════════════════════════════════════════

  1. 数据加载
     从 data/briefs/ 目录加载 JSON 数据

  2. AI 分析（可选）
     如果数据没有 AI 洞察，调用 LLM API 生成分析

  3. HTML 生成
     使用模板引擎生成美观的 HTML 报告

  4. 通知推送（可选）
     发送飞书/WeLink 通知（如果配置了 webhook）

═══════════════════════════════════════════════════════════

🧪 测试命令
═══════════════════════════════════════════════════════════

  npm test                           运行所有测试
  node tests/phase1-test.js          Phase 1 测试
  node tests/phase2-test.js          Phase 2 测试
  node tests/phase2-integration-test.js  端到端测试
  node tests/data-loader-real-test.js    真实数据测试
  node test-llm-connection.js        LLM API 连接测试

═══════════════════════════════════════════════════════════

💡 示例场景
═══════════════════════════════════════════════════════════

  场景 1: 生成今日日报
  $ node scripts/generate-all.js

  场景 2: 补生成历史日报
  $ node scripts/generate-daily.js 2026-03-07

  场景 3: 生成上周周报
  $ node scripts/generate-weekly.js 2026-W09

  场景 4: 生成上月月报
  $ node scripts/generate-monthly.js 2026-02

═══════════════════════════════════════════════════════════

🔗 相关链接
═══════════════════════════════════════════════════════════

  - 项目仓库：https://github.com/spock-wen/daily_report_analysis
  - 前置项目：https://github.com/spock-wen/daily_report
  - 阿里云百炼：https://bailian.console.aliyun.com/

═══════════════════════════════════════════════════════════
`);
