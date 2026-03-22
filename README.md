# GitHub Trending 报告系统

## 项目状态

**当前分支**: `main` - 稳定版本

本项目是一个**完整的 GitHub Trending 报告系统**，包含数据抓取、AI 分析、报告生成全流程。

## 项目定位

本系统是一个**一站式报告生成系统**，无需依赖其他项目：

- ✅ **数据抓取**：直接抓取 GitHub Trending 日榜/周榜/月榜
- ✅ **AI 深度分析**：使用 LLM 对趋势项目进行智能分析
- ✅ **HTML 报告生成**：生成美观的日报/周报/月报
- ✅ **统一主页管理**：一个页面管理所有报告
- ✅ **可选推送通知**：支持飞书、WeLink 等渠道推送

## 核心功能

✨ **已实现的功能**：

- ✅ **完整爬虫**：内置 GitHub Trending 数据抓取，支持缓存、重试机制
- ✅ **统一架构**：日报、周报、月报使用相同的生成流程
- ✅ **统一 AI 分析**：所有报告类型共享 AI 分析模块
- ✅ **统一主页**：一个页面管理所有报告
- ✅ **模块化设计**：数据加载、AI 分析、HTML 生成、推送通知完全解耦
- ✅ **统一 CLI**：简单的命令行接口
- ✅ **灵活配置**：环境变量管理敏感信息，支持服务启用/禁用控制
- ✅ **完善测试**：核心模块全覆盖的测试体系
- ✅ **Ollama 云端集成**：支持 Ollama 云端 API，无需本地 GPU 即可运行 AI 分析

## 目录结构

```
项目根目录/
├── src/                      # 源代码
│   ├── crawler/              # 数据抓取模块
│   │   ├── crawl.js          # 爬虫主入口
│   │   ├── fetcher.js        # 页面获取
│   │   ├── parser.js         # HTML 解析
│   │   ├── github_api.js     # GitHub API 增强
│   │   ├── generator.js      # JSON 数据生成
│   │   ├── retry.js          # 重试机制
│   │   └── utils.js          # 工具函数
│   ├── analyzer/             # AI 分析
│   ├── generator/            # HTML 生成
│   ├── notifier/             # 推送通知
│   ├── utils/                # 工具函数
│   └── index.js              # 主入口文件
├── scripts/                  # 可执行脚本
│   ├── generate-daily.js     # 生成日报（从已有数据）
│   ├── generate-weekly.js    # 生成周报（从已有数据）
│   ├── generate-monthly.js   # 生成月报（从已有数据）
│   ├── generate-all.js       # 生成所有报告
│   └── generate-index.js     # 生成首页
├── tests/                    # 测试文件
├── data/                     # 数据目录
│   ├── briefs/               # 输入数据
│   │   ├── daily/
│   │   ├── weekly/
│   │   └── monthly/
│   └── insights/             # AI 分析结果
│       ├── daily/
│       └── weekly/
├── cache/                    # 爬虫缓存
├── reports/                  # HTML 输出
│   ├── daily/
│   ├── weekly/
│   ├── monthly/
│   └── index.html            # 统一主页
├── public/                   # 静态资源
│   └── css/                  # 样式文件
├── config/                   # 配置文件
│   ├── config.json           # 项目配置（可安全提交）
│   └── prompts.json          # AI 提示词
├── docs/                     # 文档
│   ├── API.md                # API 文档
│   ├── GUIDE.md              # 部署与开发指南
│   └── CONFIG.md             # 配置说明
└── .env.example              # 环境变量示例
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入必要配置
```

**必要配置项**：

- `LLM_API_KEY` - LLM API 密钥（必需）
- `LLM_BASE_URL` - LLM API 基础 URL（默认：<https://ollama.com）>
- `LLM_MODEL` - 模型名称（默认：qwen3.5）
- `GITHUB_TOKEN` - GitHub Token（可选，用于获取项目详细信息）
- `FEISHU_*` - 飞书通知配置（可选）
- `WELINK_*` - WeLink 通知配置（可选）

> 📖 详细配置说明请参考 **[配置文档](docs/CONFIG.md)**

> 💡 **提示**：本项目已集成 **Ollama 云端 API**，无需本地 GPU 即可使用 AI 分析功能。配置说明请参考 **[Ollama 集成指南](docs/OLLAMA_INTEGRATION.md)**

### 3. 抓取并生成报告

#### 方式一：一站式抓取+生成（推荐）

```bash
# 抓取并生成今天的日报（不推送通知）
npm run crawl -- daily --no-push

# 抓取并生成周报
npm run crawl -- weekly --no-push

# 抓取并生成月报
npm run crawl -- monthly --no-push

# 抓取并生成日报 + 推送通知
npm run crawl -- daily
```

#### 方式二：从已有数据生成报告

```bash
# 从已有数据生成日报
npm run generate:daily -- 2026-03-22

# 生成周报
npm run generate:weekly -- 2026-W11

# 生成月报
npm run generate:monthly -- 2026-03

# 生成所有报告
npm run generate:all

# 生成首页
npm run generate:index
```

### 4. 查看报告

用浏览器打开 `reports/index.html` 查看首页，或直接打开 `reports/daily/github-ai-trending-2026-03-22.html` 等具体报告。

## 爬虫使用说明

### 命令格式

```bash
npm run crawl -- <类型> [选项]
```

### 参数说明

- **类型**：`daily` | `weekly` | `monthly`
- **选项**：
  - `--no-push`：禁用推送通知（调试模式）

### 工作流程

爬虫执行以下 6 个步骤：

1. **获取 GitHub Trending 数据**：从 <https://github.com/trending> 抓取页面
2. **解析项目信息**：提取项目名称、描述、Stars 等信息
3. **获取 GitHub API 详细数据**（可选）：使用 GITHUB\_TOKEN 获取更详细信息
4. **生成 JSON 数据**：保存到 `data/briefs/{type}/` 目录
5. **AI 分析**：使用 LLM 分析趋势并生成洞察
6. **生成 HTML 报告**：保存到 `reports/{type}/` 目录
7. **推送通知**（可选）：发送到飞书、WeLink 等渠道

## 文档

- **[部署与开发指南](docs/GUIDE.md)** - 快速开始、Git 配置、自动化部署
- **[API 文档](docs/API.md)** - 详细的 API 使用说明
- **[配置说明](docs/CONFIG.md)** - 环境变量和配置文件说明
- **[Ollama 集成指南](docs/OLLAMA_INTEGRATION.md)** - Ollama 云端 API 配置与使用说明
- **[Ollama 快速开始](docs/OLLAMA_QUICKSTART.md)** - 5 分钟快速上手 Ollama 云端 API

> 📖 **建议**：首次使用请先阅读 [配置文档](docs/CONFIG.md) 了解环境变量配置。使用 Ollama 云端 API 请参考 [Ollama 快速开始](docs/OLLAMA_QUICKSTART.md)。

## 首页更新

首页 (`reports/index.html`) 是报告系统的导航中心，支持多种更新方式：

```bash
# 方式 1：生成所有报告时自动更新首页
npm run generate:all

# 方式 2：单独更新首页
npm run generate:index
```

**定时任务示例**（Linux cron）：

```bash
# 每日 7:00 抓取并生成日报
0 7 * * * cd /path/to/daily_report_analysis && npm run crawl -- daily

# 每周一 6:00 抓取并生成周报
0 6 * * 1 cd /path/to/daily_report_analysis && npm run crawl -- weekly

# 每月 1 日 6:00 抓取并生成月报
0 6 1 * * cd /path/to/daily_report_analysis && npm run crawl -- monthly

# 每 6 小时更新首页
0 */6 * * * cd /path/to/daily_report_analysis && npm run generate:index
```

首页直接从 `data/briefs/` 目录读取 JSON 数据生成，不依赖已生成的 HTML 文件。

## 开发与测试

### 运行测试

```bash
# 运行所有测试
npm test
```

### 代码检查

```bash
# 检查代码格式
npm run lint

# 格式化代码
npm run format
```

## 环境变量

详细的环境变量配置说明请参考 **[配置文档](docs/CONFIG.md)**。

**核心配置**：

```bash
# LLM 配置（必需）- 已集成 Ollama 云端 API
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://ollama.com
LLM_MODEL=qwen3.5
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=3000
LLM_TIMEOUT=60000

# GitHub Token（可选）- 用于获取项目详细信息
GITHUB_TOKEN=your-github-token

# 飞书通知（可选）
FEISHU_APP_ID=your-app-id
FEISHU_APP_SECRET=your-app-secret
FEISHU_RECEIVE_ID=your-open-id
FEISHU_ENABLED=true

# WeLink 通知（可选）
WELINK_WEBHOOK_URLS=https://your-webhook-url
WELINK_ENABLED=false

# 报告配置（可选）
REPORT_BASE_URL=https://report.wenspock.site
```

> 💡 **提示**：
>
> - `.env` 文件包含敏感信息，已添加到 `.gitignore`，不会被提交到 Git
> - 使用 Ollama 云端 API 请参考 [Ollama 集成指南](docs/OLLAMA_INTEGRATION.md)
> - 获取 Ollama API Key: <https://ollama.com/settings/keys>

## 项目状态

✅ **已完成**：

1. ✅ 完整爬虫系统（数据抓取、解析、缓存、重试）
2. ✅ 基础架构搭建（Phase 1）
3. ✅ 核心模块实现（Phase 2）
4. ✅ 脚本工具实现（Phase 3）
5. ✅ 测试体系建立（Phase 4）
6. ✅ 文档与优化（Phase 5）
7. ✅ 配置优化与代码清理（Phase 6）

📋 **当前状态**：

- ✅ 完整爬虫功能已集成
- ✅ 主入口文件已创建
- ✅ 测试体系完善（核心模块全覆盖）
- ✅ 数据目录结构完善
- ✅ 文档体系完善（API、部署指南、配置说明）
- ✅ 配置管理优化（环境变量、敏感信息保护）
- ✅ 代码清理完成（删除临时文件、精简文档）
- ✅ **Ollama 云端 API 集成完成**（支持云端 AI 分析，无需本地 GPU）

## License

MIT License
