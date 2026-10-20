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

## 内容重构 r2

本节记录 `feat/report-content-r2` 分支的口径、字段和核查方式。规则依据 `BEHAVIOR_RULES_report_content.md`（含 PM 裁定 J1–J24）；日报/周报/月报的数字区各写一行口径说明（A4），文案不写「最佳名次」（J9）。

### 页头数值字段清单（J12）

生成器页头只允许出现下列数值字段。核查脚本按标签逐个比对；清单之外的页头数字一律 FAIL；任一卡片值为 `0`、`null`、空串或空数组时按「无信息卡」FAIL，所有卡片都查。

| 层级 | 页头标签 | 字段 | 口径 |
|---|---|---|---|
| 日报 | 上榜项目 | `totalProjects` | 当期日报项目数 |
| 日报 | AI 项目 | `aiProjects` | `isAI=true` 的项目数 |
| 日报 | 平均 Stars | `avgStars` | 当期 brief `stats.avgStars` |
| 日报 | 高热项目 | `hotProjects` | `todayStars > 100` 的项目数 |
| 周报 | 上榜项目 | `totalProjects` | 周榜项目数 |
| 周报 | 平均 Stars | `avgStars` | 周榜 brief `stats.avgStars` |
| 周报 | AI 项目 | `aiPercent` | `round(AI 项目数 / 上榜项目数 × 100)`，页面带 `%` |
| 周报 | 最大黑马 | `darkHorse` | 周榜中最大的 `todayStars` |
| 月报 | 总项目数 | `totalProjects` | 当月日榜去重项目数（J17，2026-09 为 208），不使用 `aggregation.totalProjects`（214 不上页面） |
| 月报 | 重复上榜 | `recurringProjects` | `daysOnList >= 2` 的项目数 |
| 月报 | 月度新星 | `newProjects` | 当月首次进入日榜、且此前 30 天日榜未出现的项目数（J24） |
| 月报 | AI 项目 | `aiProjects` | 当月日榜去重项目中的 AI 项目数 |

### 新数字定义

- `todayStars`：日报/周报 brief 的「期内新增星」。日报的排序、热度判断和所有「新增/今日/单日/当天」数字只用它；累计总星必须写成「累计 X 星」。周新增合计 = 周榜所有项目 `todayStars` 之和。
- 环比：`(本期周新增合计 − 上周周新增合计) / 上周周新增合计 × 100`，保留 1 位小数。
- 换血率：本周榜单中上周未出现的项目数 ÷ 本周榜单项目数 × 100，保留 1 位小数（J19：分母为本周项目数）。
- `monthStars`：月新增星，一律由日榜回算（J15）：当月最后一次出现的 `stars` − 首次出现前一有数据日的 `stars`；前一日不在榜时用首次出现日的 `stars` − 当日 `todayStars`。A4 口径行注明「由日榜回算」。
- `daysOnList`：上榜天数，只统计当月日榜日期，不与周榜期数混算（A5）。
- `streakDays`：截至当天的连续上榜天数，最多回看 30 天；缺数据的日子跳过、不视为断开（J2/J16）。
- 回归：此前 30 天日榜出现过、但前一天不在榜的项目（J10）。跨数据缺口时与前一个有数据的日子比较，文案写「较上期」而不是「较昨日」（J16）。
- 新秀：当月首次进入日榜、且此前 30 天日榜未出现的项目（J24）。
- `top5Share`：当月新增星 Top5 项目之和 ÷ 当月日榜回算的新增星合计 × 100，保留 1 位小数（J18）。
- `prevWeekStats` / `prevMonthStats`：分别取上周 weekly brief / 上月 monthly brief；上月 stats 为 0 时用上月日榜现算（J4）。
- `weekThemes[]`：当月各 ISO 周的周报主题，一周一条。
- 周日期：ISO 周一至周日；W42 = 2026-10-12～2026-10-18，`weekEnd` 生成日不上页面（J1/J20）。
- B3「前 3」：按本周日报出现天数降序；并列时按期内新增星降序，仍并列按 `fullName` 字母升序，只取前 3（J22）。以「出现在周报正文」为准，W42 的 ruflo 已在正文出现，不因不在 `topProjects` 而判漏（J21）。

### AI 调用计数（J14）

生成流程每期在日志固定打印一行：

```
AI_CALLS period=<期号> count=<n>
```

`n` 为当期洞察主分析的 LLM 调用次数：正常 1 次；核查 FAIL 时最多重写洞察 1 次，因此 `n ≤ 2`（周报深度趋势等附属分析不计入该行）。

### 内容核查脚本（D1/D4）

```bash
# 常规核查：输出 FAIL 清单（JSON + Markdown），退出码 0=PASS / 1=FAIL
node scripts/check-report.js <daily|weekly|monthly> <期次> [--data-dir D] [--insights FILE] [--brief FILE] [--out-dir D]

# 研究员用例：期望 FAIL 被拦、期望 PASS 放行，任一不通过退出码 1
node scripts/check-report.js --cases /home/box/shared/report-redesign/refactor/cases/cases.jsonl [--cases-root DIR] [--data-dir D]
```

- 退出码：`0` PASS；`1` FAIL（或有用例未通过）；`2` 参数错误。
- 常规模式把 FAIL 清单写到 `<data-dir>/../check/check-<level>-<period>.{json,md}`，每条含文件、行号、字段、原句、规则 ID 和说明。
- `--cases` 读取 jsonl（每行 `id, rule_id, expect, file, line, quote, expected_hit_fields, source`），用例文件路径相对 `--cases-root`（默认 `/home/box/shared/report-redesign`）；`line: null` 表示整份文档级检查。
- 覆盖规则：A1、A2、A5、B3、B4、B5、B7、B8、C1、C2、C3、C4、C5、D2（NAME）。
- 生成流程在写 HTML 前调用同一套核查；FAIL 时自动重写洞察 1 次，仍 FAIL 则不写 HTML、不推送，写出 FAIL 清单并以非 0 退出（D1/D3）。

### 配置文件与开关

| 路径/变量 | 说明 |
|---|---|
| `config/checker/banned_words.txt` | C3 禁词表，一行一个，`#` 注释 |
| `config/checker/compare_words.txt` | B5 比较词表（J11 初始：`≥ ≤ 超过 跌破 高于 低于 领先 落后 反超 翻倍 增长 下滑`） |
| `config/checker/fixed_phrases.txt` | C1 固定句（含 useCases/trends 模板句） |
| `config/checker/c4_whitelist.txt` | C4 白名单（J23） |
| `REPORT_CHECKER_CONFIG_DIR` | 覆盖上述配置目录 |
| `REPORT_DATA_DIR` | 覆盖 data 目录（默认 `./data`） |
| `REPORT_OUT_DIR` | 覆盖报告输出目录（默认 `./reports`） |
| `REPORT_NO_PUSH=1` | 生成流程不调用飞书/WeLink 推送 |
| `REPORT_NO_WIKI=1` | 生成流程不更新 Wiki |

**C4 白名单「AI Agent」的理由**：C4 比较同一期与前 2 天 `oneLiner` 中 4 字以上的公共短语；「AI Agent」是报告的领域通用词，不是模板套话，若计入会把正常提及该领域的日报误判为复用。白名单只在比较前剔除，不改变 C3 禁词和 C1 固定句的判定；新增白名单条目必须在本节写明理由（J23）。

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
3. **项目 Wiki** - 追加版本历史记录上榜次数和 Star 变化

输出位置：
- `reports/wiki-index.html` - Wiki 索引页
- `wiki/domains/{domain}.md` - 领域 Wiki 页面
- `wiki/projects/{owner}_{repo}.md` - 项目 Wiki 页面

### 月报 Wiki 深度集成

月报生成时自动增强 Wiki 维度，包含三个层面：

1. **项目 Wiki 月度汇总** - 为重复上榜≥2 次的项目添加月度版本记录
2. **领域 Wiki 趋势分析** - LLM 生成月度趋势分析文案 + 演变表格
3. **月报 HTML Wiki 追踪模块** - 新增展示板块，链接到项目和领域 Wiki

**领域 Wiki 月度趋势示例**：
- 领域热度分析（LLM 生成）
- 趋势演变表格（上旬/中旬/下旬）
- 月度统计（新上榜项目、重复上榜项目、Star 增长）

**月报 HTML Wiki 追踪模块**：
- 按领域分组展示上榜项目
- 显示每个项目的上榜次数
- 链接到项目 Wiki 和领域 Wiki

输出位置：
- `reports/monthly/github-monthly-YYYY-MM.html` - 月报 HTML（含 Wiki 追踪模块）
- `wiki/domains/{domain}.md` - 领域 Wiki（含月度趋势）
- `wiki/projects/{owner}_{repo}.md` - 项目 Wiki（含月度汇总）

**测试验证**：
```bash
# 运行月报 Wiki 深度集成端到端测试
node tests/e2e/monthly-wiki-integration.test.js
```

**详细文档**：参见 [docs/WIKI.md](docs/WIKI.md)

### Wiki 核心理念
- **Pure Markdown**: 所有 Wiki 以纯 Markdown 格式存储，便于版本控制
- **版本追加**: 不覆盖原有内容，每次更新追加新版本历史记录
- **版本控制**: Wiki 文件存储在 git 中，可追溯历史变更

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
