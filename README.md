# GitHub Trending 报告系统

## 项目简介

本项目是一个**完整的 GitHub Trending 报告系统**，自动抓取 GitHub 热门项目，通过 AI 进行深度分析，生成美观的日报、周报和月报。

## 核心功能

- ✅ **数据抓取**：自动抓取 GitHub Trending 日榜/周榜/月榜
- ✅ **GitHub API 增强**：获取项目详细信息（星数、fork、语言等）
- ✅ **AI 深度分析**：使用 LLM 对趋势项目进行智能分析
- ✅ **项目分析**：自动翻译项目描述，生成核心功能、适用场景、热度趋势
- ✅ **HTML 报告生成**：生成美观的日报/周报/月报
- ✅ **统一主页管理**：一个页面管理所有报告
- ✅ **可选推送通知**：支持飞书、WeLink 等渠道推送

## 目录结构

```
项目根目录/
├── src/                      # 源代码
│   ├── scraper/              # 数据抓取模块（新版）
│   │   ├── index.js          # 抓取器入口
│   │   ├── complete-workflow.js  # 完整工作流
│   │   ├── report-pipeline.js    # 报告生成流水线
│   │   ├── github-api.js     # GitHub API 集成
│   │   ├── project-analyzer.js   # 项目分析器（翻译+分析）
│   │   ├── strategies/       # 抓取策略
│   │   │   ├── daily-scraper.js
│   │   │   ├── weekly-scraper.js
│   │   │   └── monthly-scraper.js
│   │   └── parsers/          # HTML 解析器
│   │       └── github-trending-parser.js
│   ├── analyzer/             # AI 分析
│   │   └── insight-analyzer.js
│   ├── generator/            # HTML 生成
│   │   └── html-generator.js
│   ├── notifier/             # 推送通知
│   └── utils/                # 工具函数
├── scripts/                  # 可执行脚本
│   ├── run-daily-workflow.js     # 日报完整工作流
│   ├── run-weekly-workflow.js    # 周报完整工作流
│   └── generate-index.js     # 生成首页
├── data/                     # 数据目录
│   ├── briefs/               # 输入数据
│   │   ├── daily/
│   │   ├── weekly/
│   │   └── monthly/
│   └── insights/             # AI 分析结果
├── reports/                  # HTML 输出
│   ├── daily/
│   ├── weekly/
│   ├── monthly/
│   └── index.html
├── public/                   # 静态资源
│   └── css/
├── config/                   # 配置文件
│   └── prompts.json          # AI 提示词
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
- `LLM_BASE_URL` - LLM API 基础 URL（默认：https://ollama.com）
- `LLM_MODEL` - 模型名称（默认：qwen3.5）
- `GITHUB_TOKEN` - GitHub Token（可选，用于获取项目详细信息）

### 3. 运行工作流

#### 日报工作流

```bash
# 抓取并生成今天的日报
node scripts/run-daily-workflow.js
```

日报工作流程：
1. 抓取 GitHub Trending Daily
2. 解析项目信息（名称、描述、星数等）
3. 调用 GitHub API 获取详细信息
4. 项目分析（翻译描述 + 生成详细分析）
5. AI 分析生成洞察
6. 生成 HTML 报告
7. 更新首页

#### 周报工作流

```bash
# 抓取并生成本周的周报
node scripts/run-weekly-workflow.js
```

周报工作流程：
1. 抓取 GitHub Trending Weekly
2. 解析项目信息
3. 调用 GitHub API 获取详细信息
4. 项目分析（翻译描述 + 生成详细分析）
5. AI 分析生成洞察（包含深度趋势分析）
6. 生成 HTML 报告
7. 更新首页

**注意**：周一运行时会生成上周（W12）的周报，汇总上周一到周日的数据。

### 4. 查看报告

用浏览器打开 `reports/index.html` 查看首页，或打开具体报告：
- 日报：`reports/daily/github-ai-trending-YYYY-MM-DD.html`
- 周报：`reports/weekly/github-weekly-YYYY-WXX.html`

## 工作流程详解

### 日报流程

```
抓取 GitHub Trending Daily
    ↓
解析 HTML 提取项目信息
    ↓
GitHub API 增强（获取详细星数、fork、语言等）
    ↓
项目分析（MyMemory API 翻译 + 生成核心功能/适用场景/趋势）
    ↓
AI 分析（生成热点、趋势、推荐建议）
    ↓
生成 HTML 报告
    ↓
更新首页
```

### 周报流程

```
抓取 GitHub Trending Weekly
    ↓
解析 HTML 提取项目信息
    ↓
GitHub API 增强
    ↓
项目分析（翻译 + 详细分析）
    ↓
加载上周 7 天的日报数据
    ↓
AI 分析（周度主题 + 深度趋势分析）
    ↓
生成 HTML 报告（包含深度趋势章节）
    ↓
更新首页
```

## 项目分析功能

系统会自动对每个项目进行分析：

1. **描述翻译**：使用 MyMemory API 将英文描述翻译为中文
2. **项目类型检测**：自动识别 Agent、RAG、LLM、语音处理等项目类型
3. **核心功能生成**：根据项目类型和描述生成 4 条核心功能
4. **适用场景生成**：生成 4 条适用场景
5. **热度趋势分析**：基于星数、今日星数等数据分析趋势
6. **社区活跃度评估**：评估项目社区活跃程度

## 定时任务配置

### Linux/Mac (crontab)

```bash
# 编辑 crontab
crontab -e

# 每日 7:00 生成日报
0 7 * * * cd /path/to/daily_report_analysis && node scripts/run-daily-workflow.js

# 每周一 6:00 生成周报（生成上周的周报）
0 6 * * 1 cd /path/to/daily_report_analysis && node scripts/run-weekly-workflow.js
```

### Windows (任务计划程序)

1. 打开任务计划程序
2. 创建基本任务
3. 设置触发器（每日/每周）
4. 设置操作：启动程序 `node.exe`，参数 `scripts/run-daily-workflow.js`

## 环境变量

```bash
# LLM 配置（必需）
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

## 技术栈

- **Node.js** - 运行时环境
- **Cheerio** - HTML 解析
- **node-fetch** - HTTP 请求
- **Ollama API** - AI 分析
- **MyMemory API** - 翻译服务
- **GitHub API** - 项目信息增强

## 开发说明

### 运行测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
npm run format
```

## 许可证

MIT License
