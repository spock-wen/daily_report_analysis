# AI 趋势报告系统

## 项目简介

本项目是一个**完整的 AI 趋势报告系统**，包含两个独立的子系统：

1. **GitHub Trending 报告** - 自动抓取 GitHub 热门项目，通过 AI 进行深度分析，生成美观的日报、周报和月报
2. **HuggingFace Papers 日报** - 每日抓取最新 AI 论文，生成 HTML 报告并推送到飞书/WeLink

## 核心功能

### GitHub Trending 报告
- ✅ **数据抓取**：自动抓取 GitHub Trending 日榜/周榜/月榜
- ✅ **GitHub API 增强**：获取项目详细信息（星数、fork、语言等）
- ✅ **AI 深度分析**：使用 LLM 对趋势项目进行智能分析
- ✅ **项目分析**：自动翻译项目描述，生成核心功能、适用场景、热度趋势
- ✅ **HTML 报告生成**：生成美观的日报/周报/月报

### HuggingFace Papers 日报
- ✅ **论文抓取**：每日自动抓取 HuggingFace 最新 AI 论文
- ✅ **论文分类**：自动识别综述/工具/研究/数据集等类型
- ✅ **摘要翻译**：中英对照，完整翻译无截断
- ✅ **BibTeX 引用**：自动生成标准引用格式
- ✅ **多端推送**：支持飞书/WeLink 推送热门论文

### 通用功能
- ✅ **可选推送通知**：支持飞书、WeLink 等渠道推送
- ✅ **LLM Wiki 知识库**：基于 Karpathy 理念构建的项目/论文 Wiki 系统

## 目录结构

```
项目根目录/
├── src/                      # 源代码
│   ├── scraper/              # 数据抓取模块
│   │   ├── index.js          # 抓取器入口
│   │   ├── complete-workflow.js  # 完整工作流
│   │   ├── report-pipeline.js    # 报告生成流水线
│   │   ├── github-api.js     # GitHub API 集成
│   │   ├── project-analyzer.js   # 项目分析器（翻译 + 分析）
│   │   ├── strategies/       # 抓取策略
│   │   │   ├── daily-scraper.js
│   │   │   ├── weekly-scraper.js
│   │   │   ├── monthly-scraper.js
│   │   │   └── papers-scraper.js   # Papers 抓取器
│   │   └── parsers/          # HTML 解析器
│   ├── analyzer/             # AI 分析
│   │   ├── insight-analyzer.js
│   │   └── monthly-analyzer.js
│   ├── generator/            # HTML 生成
│   │   ├── html-generator.js
│   │   ├── monthly-generator.js
│   │   ├── wiki-index-generator.js  # Wiki 索引生成器
│   │   ├── comparison-generator.js  # 项目对比生成器
│   │   └── paper-html-generator.js  # Papers HTML 生成器
│   ├── wiki/                 # Wiki 模块
│   │   ├── wiki-manager.js   # Wiki 核心管理类
│   │   ├── wiki-templates.js # Wiki 模板
│   │   └── cross-reference.js # 跨项目关联分析
│   ├── notifier/             # 推送通知
│   │   ├── message-sender.js
│   │   ├── monthly-templates.js
│   │   └── paper-notification.js  # Papers 通知推送
│   └── utils/                # 工具函数
│       ├── logger.js
│       ├── path.js
│       └── index.js
├── scripts/                  # 可执行脚本
│   ├── run-daily-workflow.js     # 日报完整工作流
│   ├── run-weekly-workflow.js    # 周报完整工作流
│   ├── run-monthly-workflow.js   # 月报完整工作流
│   ├── run-papers-workflow.js    # Papers 日报工作流
│   ├── generate-index.js         # 生成首页
│   ├── migrate-json-to-wiki.js   # JSON 到 Wiki 迁移
│   └── generate-wiki-index.js    # 生成 Wiki 索引页
├── data/                     # 数据目录
│   ├── briefs/               # 输入数据
│   │   ├── daily/
│   │   ├── weekly/
│   │   └── monthly/
│   ├── insights/             # AI 分析结果
│   │   ├── daily/
│   │   ├── weekly/
│   │   ├── monthly/
│   │   └── papers/
│   └── papers/               # Papers 数据
│       ├── daily/
│       └── insights/
├── wiki/                     # Wiki 知识库
│   ├── projects/             # 项目 Wiki
│   ├── papers/               # 论文 Wiki
│   └── domains/              # 领域 Wiki
├── reports/                  # HTML 输出
│   ├── daily/
│   ├── weekly/
│   ├── monthly/
│   ├── papers/daily/         # Papers 日报
│   ├── wiki-index.html       # Wiki 索引页
│   ├── comparison/           # 项目对比页
│   └── index.html            # 统一门户首页
├── public/                   # 静态资源
│   └── css/
├── config/                   # 配置文件
│   └── prompts.json          # AI 提示词
├── tests/                    # 测试
│   ├── wiki/                 # Wiki 模块测试
│   ├── generator/            # 生成器测试
│   └── e2e/                  # 端到端测试
├── docs/                     # 文档
│   ├── WIKI.md               # Wiki 系统文档
│   └── superpowers/specs/    # 设计文档
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

#### GitHub Trending 日报工作流

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
7. 自动更新首页

#### GitHub Trending 周报工作流

```bash
# 抓取并生成本周的周报
node scripts/run-weekly-workflow.js
```

周报工作流程：
1. 抓取 GitHub Trending Weekly
2. 解析项目信息
3. 调用 GitHub API 获取详细信息
4. 项目分析（翻译描述 + 生成详细分析）
5. 加载上周 7 天的日报数据
6. AI 分析（周度主题 + 深度趋势分析）
7. 生成 HTML 报告
8. 自动更新首页

**注意**：周一运行时会生成上周（W12）的周报，汇总上周一到周日的数据。

#### GitHub Trending 月报工作流

```bash
# 生成指定月份的月报
node scripts/run-monthly-workflow.js 2026-03
```

月报工作流程：
1. 加载指定月份的所有日报数据（约 30 天）
2. 加载指定月份的所有周报数据（4-5 周）
3. 数据聚合与去重
4. 计算聚合统计（重复上榜项目、月度新星、领域分布、语言分布等）
5. 计算趋势演变（上/中/下旬三段式分析）
6. AI 深度分析（月度主题、TOP 项目评测、新兴领域、下月预测）
7. 生成 HTML 报告（包含 Chart.js 数据可视化）
8. 自动更新首页

**注意**：月报是深度分析型报告，适合公开发布到公众号/博客等平台。

#### HuggingFace Papers 日报工作流

```bash
# 抓取并生成今天的论文日报
node scripts/run-papers-workflow.js
```

Papers 工作流程：
1. 从 HuggingFace 下载最新论文数据
2. 解析论文信息（标题、作者、摘要、GitHub 链接等）
3. 论文分类（综述/工具/研究/数据集）
4. 摘要翻译（中英对照）
5. 生成 BibTeX 引用
6. **自动创建/更新论文 Wiki**
7. AI 分析生成洞察
8. 生成 HTML 报告
9. 推送到飞书/WeLink（可选）

### LLM Wiki 知识库

LLM Wiki 是基于 Karpathy LLM Wiki 理念构建的知识库系统。

**相关脚本**：

```bash
# 历史数据迁移（仅首次运行）
node scripts/migrate-json-to-wiki.js

# 生成 Wiki 索引页
node scripts/generate-wiki-index.js
```

**Wiki 功能**：
- **项目 Wiki**：自动记录项目上榜历史、版本演变
- **论文 Wiki**：自动收录论文信息、代码链接
- **领域 Wiki**：按领域分类聚合相关项目
- **HTML 徽章**：报告卡片显示 📚 Wiki 徽章和上榜次数
- **项目对比**：生成多维度对比页面

**详细文档**：参见 [docs/WIKI.md](docs/WIKI.md)

### 4. 查看报告

用浏览器打开 `reports/index.html` 查看首页，或打开具体报告：

- **首页**：`reports/index.html` - 统一门户页面，展示最新报告、统计数据、趋势图表、Top 5 热榜
- **GitHub 日报**：`reports/daily/github-ai-trending-YYYY-MM-DD.html`
- **GitHub 周报**：`reports/weekly/github-weekly-YYYY-WXX.html`
- **GitHub 月报**：`reports/monthly/github-monthly-YYYY-MM.html`
- **Papers 日报**：`reports/papers/daily/papers-YYYY-MM-DD.html`

## 首页功能

首页是一个**对外展示的门户页面**，包含以下模块：

| 模块 | 描述 |
|------|------|
| 📊 系统状态 | 6 个统计卡片（日报/周报/月报数量、项目数、AI 占比、平均 Stars） |
| 🆕 最新报告 | 3 个卡片展示最新日报/周报/月报摘要和主题 |
| 📈 实时趋势 | Chart.js 可交互趋势图表（可切换新增项目数/星数总量/AI 占比） |
| 🔥 Top 5 热榜 | 所有项目的综合排名（按 Stars 排序） |
| 📁 报告存档 | 折叠面板，展示历史报告链接 |

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
自动更新首页
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
自动更新首页
```

### 月报流程

```
加载整月日报数据（约 30 天）
    ↓
加载整月周报数据（4-5 周）
    ↓
数据聚合与去重
    ↓
计算聚合统计
    ├── 总项目数（去重）
    ├── 重复上榜项目（≥2 次）
    ├── 月度新星（首次出现）
    ├── 领域分布
    └── 语言分布
    ↓
计算趋势演变（上/中/下旬三段式）
    ↓
AI 深度分析
    ├── 月度主题
    ├── 趋势演变分析
    ├── TOP 项目评测（综合评分）
    ├── 新兴领域
    ├── 月度黑马
    └── 下月预测
    ↓
生成 HTML 报告（Chart.js 可视化）
    ├── 领域分布饼图
    ├── 语言 TOP5 柱状图
    └── 趋势演变图
    ↓
自动更新首页
```

### Papers 日报流程

```
下载 HuggingFace latest.json
    ↓
解析论文信息
    ↓
论文分类（综述/工具/研究/数据集）
    ↓
摘要翻译（中英对照，完整无截断）
    ↓
生成 BibTeX 引用
    ↓
AI 分析生成洞察
    ↓
生成 HTML 报告
    ↓
推送到飞书/WeLink（可选）
```

## 项目分析功能

系统会自动对每个项目进行分析：

1. **描述翻译**：使用 MyMemory API 将英文描述翻译为中文
2. **项目类型检测**：自动识别 Agent、RAG、LLM、语音处理等项目类型
3. **核心功能生成**：根据项目类型和描述生成 4 条核心功能
4. **适用场景生成**：生成 4 条适用场景
5. **热度趋势分析**：基于星数、今日星数等数据分析趋势
6. **社区活跃度评估**：评估项目社区活跃程度

## Papers 分类功能

系统会自动对每篇论文进行分类：

1. **类型识别**：通过关键词检测自动识别论文类型
   - 综述（Survey/Review）
   - 工具（有 GitHub 实现）
   - 数据集（Dataset/Benchmark）
   - 研究论文（默认）
2. **标签展示**：在 HTML 报告中显示类型标签
3. **快速操作**：提供 arXiv、PDF、GitHub、引用等快捷链接

## 定时任务配置

### Linux/Mac (crontab)

```bash
# 编辑 crontab
crontab -e

# 每日 7:00 生成 GitHub 日报
0 7 * * * cd /path/to/daily_report_analysis && node scripts/run-daily-workflow.js

# 每周一 6:00 生成 GitHub 周报（生成上周的周报）
0 6 * * 1 cd /path/to/daily_report_analysis && node scripts/run-weekly-workflow.js

# 每日 8:00 生成 Papers 日报
0 8 * * * cd /path/to/daily_report_analysis && node scripts/run-papers-workflow.js
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
- **Chart.js** - 数据可视化

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
