# AI 趋势报告系统

## 项目简介

本项目是一个**完整的 AI 趋势报告系统**，包含两个独立的子系统：

1. **GitHub Trending 报告** - 自动抓取 GitHub 热门项目，通过 AI 进行深度分析，生成美观的日报、周报和月报
2. **HuggingFace Papers 日报** - 每日抓取最新 AI 论文，生成 HTML 报告并推送到飞书/WeLink

## 核心功能

### GitHub Trending 报告
- ✅ **数据抓取**：自动抓取 GitHub Trending 日榜/周榜/月榜
- ✅ **GitHub API 增强**：获取项目详细信息（星数、fork、语言等）
- ✅ **项目分析**：自动翻译项目描述，生成核心功能、适用场景、热度趋势
- ✅ **AI 深度分析**：使用 LLM 对趋势项目进行智能分析，生成热点/趋势/行动建议
- ✅ **Wiki 知识库**：基于 Karpathy 理念构建持久化 Wiki，记录项目历史演变
- ✅ **HTML 报告生成**：生成美观的日报/周报/月报，带 Wiki 徽章和上榜次数
- ✅ **自动重试机制**：失败自动重试（最多 3 次，间隔 5 分钟）

### HuggingFace Papers 日报
- ✅ **论文抓取**：每日自动抓取 HuggingFace 最新 AI 论文
- ✅ **论文分类**：自动识别综述/工具/研究/数据集等类型
- ✅ **摘要翻译**：中英对照，完整翻译无截断
- ✅ **BibTeX 引用**：自动生成标准引用格式
- ✅ **论文 Wiki**：自动创建/更新论文 Wiki，记录收录历史
- ✅ **多端推送**：支持飞书/WeLink 推送热门论文

### 通用功能
- ✅ **可选推送通知**：支持飞书、WeLink 等渠道推送
- ✅ **首页门户**：统一展示最新报告、趋势图表、Top 热榜
- ✅ **项目对比**：生成多维度项目对比页面

---

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

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_API_KEY` | LLM API 密钥 | 必需 |
| `LLM_BASE_URL` | LLM API 基础 URL | https://ollama.com |
| `LLM_MODEL` | 模型名称 | qwen3.5 |
| `GITHUB_TOKEN` | GitHub Token | 可选，用于获取项目详细信息 |
| `FEISHU_APP_ID` | 飞书 App ID | 可选 |
| `WELINK_WEBHOOK_URLS` | WeLink Webhook | 可选 |

### 3. 运行工作流

#### GitHub Trending 日报

```bash
# 抓取今日数据并生成日报（含推送）
node scripts/run-daily-workflow.js

# 不发送推送通知
node scripts/run-daily-workflow.js --no-push
```

**日报工作流程**：
1. 抓取 GitHub Trending Daily
2. 调用 GitHub API 增强项目数据
3. 项目分析（翻译 + 核心功能/适用场景生成）
4. AI 分析生成洞察（热点/趋势/行动建议）
5. **自动更新项目 Wiki 版本历史**
6. 生成 HTML 报告
7. 更新首页
8. 推送通知（可选）

#### GitHub Trending 周报

```bash
# 生成本周周报
node scripts/run-weekly-workflow.js

# 不发送推送通知
node scripts/run-weekly-workflow.js --no-push
```

**周报工作流程**：
1. 抓取 GitHub Trending Weekly
2. 调用 GitHub API 增强项目数据
3. 项目分析（翻译 + 详细分析）
4. **自动加载上周 7 天的日报数据**
5. AI 分析（周度主题 + 深度趋势分析）
6. **自动更新项目 Wiki 版本历史**
7. 生成 HTML 报告（包含深度趋势章节）
8. 更新首页
9. 推送通知（可选）

> **注意**：周一运行时会自动生成上周（W12）的周报，汇总上周一到周日的数据。

#### GitHub Trending 月报

```bash
# 生成本月月报
node scripts/run-monthly-workflow.js

# 指定月份
node scripts/run-monthly-workflow.js 2026-03

# 不发送推送通知
node scripts/run-monthly-workflow.js --no-push
```

**月报工作流程**：
1. 加载整月日报数据（约 30 天）
2. 加载整月周报数据（4-5 周）
3. 数据聚合与去重
4. 计算聚合统计（重复上榜项目、月度新星、领域分布、语言分布）
5. 计算趋势演变（上/中/下旬三段式分析）
6. AI 深度分析（月度主题、TOP 项目评测、新兴领域、下月预测）
7. 生成 HTML 报告（包含 Chart.js 数据可视化）
8. 更新首页
9. 推送通知（可选）

> **注意**：月报是深度分析型报告，适合公开发布到公众号/博客等平台。

#### HuggingFace Papers 日报

```bash
# 抓取并生成今日论文日报
node scripts/run-papers-workflow.js

# 不发送推送通知
node scripts/run-papers-workflow.js --no-push
```

**Papers 工作流程**：
1. 从 HuggingFace 下载 latest.json
2. 解析论文信息（标题、作者、摘要、GitHub 链接等）
3. 论文分类（综述/工具/研究/数据集）
4. 摘要翻译（中英对照）
5. 生成 BibTeX 引用
6. **自动创建/更新论文 Wiki**
7. AI 分析生成洞察
8. 生成 HTML 报告
9. 推送到飞书/WeLink（可选）

---

## LLM Wiki 知识库

LLM Wiki 是基于 Karpathy LLM Wiki 理念构建的知识库系统。

### 相关脚本

```bash
# 历史数据迁移（仅首次运行）
node scripts/migrate-json-to-wiki.js

# 生成 Wiki 索引页
node scripts/generate-wiki-index.js
```

### Wiki 功能
- **项目 Wiki** (`wiki/projects/`): 自动记录项目上榜历史、版本演变
- **论文 Wiki** (`wiki/papers/`): 自动收录论文信息、代码链接
- **领域 Wiki** (`wiki/domains/`): 按领域分类聚合相关项目
- **HTML 徽章**: 报告卡片显示 📚 Wiki 徽章和上榜次数
- **项目对比**: 生成多维度对比页面

### Wiki 自动更新

系统会在每次生成日报/周报/月报后自动更新 Wiki：

1. **Wiki 索引页** - 自动更新项目统计、领域导航、热门项目排行榜
2. **领域 Wiki** - 自动按领域（agent/rag/llm 等）聚合项目列表

输出位置：
- `reports/wiki-index.html` - Wiki 索引页
- `wiki/domains/{domain}.md` - 领域 Wiki 页面

### Wiki 核心理念
- **Pure Markdown**: 所有 Wiki 以纯 Markdown 格式存储，便于版本控制
- **版本追加**: 不覆盖原有内容，每次更新追加新版本历史记录
- **版本控制**: Wiki 文件存储在 git 中，可追溯历史变更

**详细文档**：参见 [docs/WIKI.md](docs/WIKI.md)

---

## 查看报告

用浏览器打开 `reports/index.html` 查看首页，或打开具体报告：

| 报告类型 | 路径 |
|---------|------|
| 首页 | `reports/index.html` |
| GitHub 日报 | `reports/daily/github-ai-trending-YYYY-MM-DD.html` |
| GitHub 周报 | `reports/weekly/github-weekly-YYYY-WXX.html` |
| GitHub 月报 | `reports/monthly/github-monthly-YYYY-MM.html` |
| Papers 日报 | `reports/papers/daily/papers-YYYY-MM-DD.html` |
| Wiki 索引 | `reports/wiki-index.html` |
| 项目对比 | `reports/comparison/` |

### 首页功能

首页是一个**对外展示的门户页面**，包含以下模块：

| 模块 | 描述 |
|------|------|
| 📊 系统状态 | 6 个统计卡片（日报/周报/月报数量、项目数、AI 占比、平均 Stars） |
| 🆕 最新报告 | 3 个卡片展示最新日报/周报/月报摘要和主题 |
| 📈 实时趋势 | Chart.js 可交互趋势图表（可切换新增项目数/星数总量/AI 占比） |
| 🔥 Top 5 热榜 | 所有项目的综合排名（按 Stars 排序） |
| 📁 报告存档 | 折叠面板，展示历史报告链接 |

---

## 定时任务配置

### Linux/Mac (crontab)

```bash
# 编辑 crontab
crontab -e

# 每日 7:00 生成 GitHub 日报
0 7 * * * cd /path/to/daily_report_analysis && node scripts/run-daily-workflow.js

# 每周一 6:00 生成 GitHub 周报（生成上周的周报）
0 6 * * 1 cd /path/to/daily_report_analysis && node scripts/run-weekly-workflow.js

# 每月 1 日 6:00 生成上月月报
0 6 1 * * cd /path/to/daily_report_analysis && node scripts/run-monthly-workflow.js

# 每日 8:00 生成 Papers 日报
0 8 * * * cd /path/to/daily_report_analysis && node scripts/run-papers-workflow.js
```

### Windows (任务计划程序)

1. 打开任务计划程序
2. 创建基本任务
3. 设置触发器（每日/每周）
4. 设置操作：启动程序 `node.exe`，参数 `scripts/run-daily-workflow.js`

---

## 项目分析功能

系统会自动对每个项目进行分析：

1. **描述翻译**：使用 MyMemory API 将英文描述翻译为中文
2. **项目类型检测**：自动识别 Agent、RAG、LLM、语音处理等项目类型
3. **核心功能生成**：根据项目类型和描述生成 4 条核心功能
4. **适用场景生成**：生成 4 条适用场景
5. **热度趋势分析**：基于星数、今日星数等数据分析趋势
6. **社区活跃度评估**：评估项目社区活跃程度

---

## Papers 分类功能

系统会自动对每篇论文进行分类：

1. **类型识别**：通过关键词检测自动识别论文类型
   - 综述（Survey/Review）
   - 工具（有 GitHub 实现）
   - 数据集（Dataset/Benchmark）
   - 研究论文（默认）
2. **标签展示**：在 HTML 报告中显示类型标签
3. **快速操作**：提供 arXiv、PDF、GitHub、引用等快捷链接

---

## 技术栈

- **Node.js** - 运行时环境 (>=18.0.0)
- **Cheerio** - HTML 解析
- **node-fetch** - HTTP 请求
- **Ollama API** - AI 分析
- **MyMemory API** - 翻译服务
- **GitHub API** - 项目信息增强
- **Chart.js** - 数据可视化

---

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

### 目录结构

```
项目根目录/
├── src/
│   ├── scraper/              # 数据抓取模块
│   │   ├── report-pipeline.js    # 报告生成流水线
│   │   ├── github-api.js     # GitHub API 集成
│   │   ├── project-analyzer.js   # 项目分析器
│   │   ├── strategies/       # 抓取策略
│   │   └── papers-scraper.js     # Papers 抓取器
│   ├── analyzer/             # AI 分析
│   ├── generator/            # HTML 生成
│   ├── wiki/                 # Wiki 模块
│   ├── notifier/             # 推送通知
│   └── utils/                # 工具函数
├── scripts/                  # 可执行脚本
│   ├── run-daily-workflow.js     # 日报完整工作流
│   ├── run-weekly-workflow.js    # 周报完整工作流
│   ├── run-monthly-workflow.js   # 月报完整工作流
│   ├── run-papers-workflow.js    # Papers 日报工作流
│   ├── generate-index.js         # 生成首页
│   └── migrate-json-to-wiki.js   # JSON 到 Wiki 迁移
├── data/                     # 数据目录
├── wiki/                     # Wiki 知识库
├── reports/                  # HTML 输出
├── config/                   # 配置文件 (prompts.json)
└── docs/                     # 技术文档
```

---

## 相关文档

- [docs/GUIDE.md](docs/GUIDE.md) - 部署与开发指南
- [docs/CONFIG.md](docs/CONFIG.md) - 配置说明
- [docs/WIKI.md](docs/WIKI.md) - Wiki 系统详解

---

## 许可证

MIT License
