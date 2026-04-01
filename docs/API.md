# GitHub Trending 报告系统 - API 文档

## 核心模块

### 1. DataLoader（数据加载器）

**位置**: `src/loader/data-loader.js`

**功能**: 负责加载和验证报告数据

**API**:

```javascript
const DataLoader = require('./src/loader/data-loader');
const loader = new DataLoader();

// 加载日报数据
const dailyData = await loader.loadDailyData(date); // date: 'YYYY-MM-DD'

// 加载周报数据
const weeklyData = await loader.loadWeeklyData(weekStart); // weekStart: 'YYYY-Www' 或 'YYYY-MM-DD'

// 加载月报数据
const monthlyData = await loader.loadMonthlyData(month); // month: 'YYYY-MM'

// 验证数据
const validation = loader.validateData(data);
// 返回：{ valid: boolean, errors: string[], warnings: string[] }
```

**数据结构**:

```javascript
{
  date: '2026-03-08',
  type: 'daily',
  brief: {
    trending_repos: [...],
    stats: {
      total_projects: 20,
      ai_projects: 15,
      avg_stars: 5000,
      hot_projects: 5
    }
  },
  aiInsights: {...},
  loadedAt: '2026-03-08T10:00:00.000Z'
}
```

---

### 2. InsightAnalyzer（AI 分析器）

**位置**: `src/analyzer/insight-analyzer.js`

**功能**: 使用 AI 分析数据并生成洞察报告

**API**:

```javascript
const InsightAnalyzer = require('./src/analyzer/insight-analyzer');
const analyzer = new InsightAnalyzer();

// 分析日报
const dailyInsights = await analyzer.analyzeDaily(dailyData);

// 分析周报
const weeklyInsights = await analyzer.analyzeWeekly(weeklyData);

// 分析月报
const monthlyInsights = await analyzer.analyzeMonthly(monthlyData);
```

**返回数据结构**:

```javascript
{
  summary: "一句话总结",
  hypeIndex: { score: 4, reason: "评分理由" },
  hot: ["热点 1", "热点 2"],
  project_insights: [
    {
      project_name: "owner/repo",
      analysis: "项目分析",
      github_url: "https://...",
      stars: 1000
    }
  ],
  trends: ["趋势 1", "趋势 2"],
  recommendations: ["建议 1", "建议 2"]
}
```

---

### 3. HTMLGenerator（HTML 生成器）

**位置**: `src/generator/html-generator.js`

**功能**: 生成报告 HTML 文件

**API**:

```javascript
const HTMLGenerator = require('./src/generator/html-generator');
const generator = new HTMLGenerator();

// 生成日报 HTML
const dailyPath = await generator.generateDaily(dailyData);

// 生成周报 HTML
const weeklyPath = await generator.generateWeekly(weeklyData);

// 生成月报 HTML
const monthlyPath = await generator.generateMonthly(monthlyData);
```

**返回**: HTML 文件路径字符串

---

### 4. MessageSender（消息发送器）

**位置**: `src/notifier/message-sender.js`

**功能**: 发送通知消息（支持飞书、WeLink）

**API**:

```javascript
const MessageSender = require('./src/notifier/message-sender');
const sender = new MessageSender();

// 生成通知内容
const notification = sender.generateNotificationContent(type, data);
// type: 'daily' | 'weekly' | 'monthly'
// 返回：{ title: string, content: string, reportUrl: string }

// 发送通知
const results = await sender.sendAll(options);
// options: { type, title, content, reportUrl }
// 返回：[{ channel: 'feishu', success: true, error: null }, ...]
```

---

## 工具模块

### 5. 路径工具 (path)

```javascript
const pathUtils = require('./src/utils/path');

// 获取数据文件路径
const briefPath = pathUtils.getDailyBriefPath('2026-03-08');
const weeklyBriefPath = pathUtils.getWeeklyBriefPath('2026-W11');
const monthlyBriefPath = pathUtils.getMonthlyBriefPath('2026-03');

// 获取报告文件路径
const reportPath = pathUtils.getDailyReportPath('2026-03-08');
const weeklyReportPath = pathUtils.getWeeklyReportPath('2026-W11');
const monthlyReportPath = pathUtils.getMonthlyReportPath('2026-03');

// 获取 AI 洞察路径
const insightsPath = pathUtils.getAIInsightsPath('daily', '2026-03-08');
```

---

### 6. 日志工具 (logger)

```javascript
const logger = require('./src/utils/logger');

logger.title('标题');
logger.debug('调试信息', { key: 'value' });
logger.info('普通信息');
logger.success('成功信息');
logger.warn('警告信息');
logger.error('错误信息', { error: 'details' });
logger.divider();
```

---

### 7. 文件系统工具 (fs)

```javascript
const fsUtils = require('./src/utils/fs');

// 确保目录存在
await fsUtils.ensureDir('./path/to/dir');

// 读取 JSON
const data = await fsUtils.readJson('./data.json');

// 写入 JSON
await fsUtils.writeJson('./data.json', { key: 'value' });

// 检查文件存在
const exists = await fsUtils.fileExists('./file.txt');

// 读取文件
const content = await fsUtils.readFile('./file.txt', 'utf8');

// 写入文件
await fsUtils.writeFile('./file.txt', 'content');

// 删除文件
await fsUtils.deleteFile('./file.txt');
```

---

### 8. LLM 工具 (llm)

```javascript
const llmUtils = require('./src/utils/llm');

// 调用 LLM
const response = await llmUtils.callLLM(prompt, {
  temperature: 0.7,
  max_tokens: 2000
});

// 解析 AI 响应
const parsed = llmUtils.parseAIResponse(jsonString);
```

**配置**:

```javascript
llmUtils.config = {
  apiKey: process.env.LLM_API_KEY,
  baseUrl: process.env.LLM_BASE_URL,
  model: process.env.LLM_MODEL
};
```

---

### 9. 模板工具 (template)

```javascript
const templateUtils = require('./src/utils/template');

// 渲染模板
const html = templateUtils.renderTemplate('Hello, ${name}!', { name: 'World' });

// 渲染 HTML 页面
const page = templateUtils.renderHtmlPage('页面标题', '<h1>内容</h1>');

// HTML 转义
const safe = templateUtils.escapeHtml('<script>alert("XSS")</script>');

// Markdown 转 HTML
const html = templateUtils.markdownToHtml('# 标题\n**粗体**');
```

---

## 统一入口

```javascript
const App = require('./src');

// 访问所有模块
App.DataLoader
App.InsightAnalyzer
App.HTMLGenerator
App.MessageSender
App.utils
App.path
App.logger
App.fs
App.llm
App.template
App.config
App.prompts
App.version
```

---

## 配置文件

### config.json

```javascript
const config = require('./config/config.json');
```

**结构**:

```json
{
  "report": {
    "baseUrl": "https://report.wenspock.site",
    "daily": { "enabled": true, "outputDir": "reports/daily" },
    "weekly": { "enabled": true, "outputDir": "reports/weekly" },
    "monthly": { "enabled": true, "outputDir": "reports/monthly" },
    "index": { "enabled": true, "outputFile": "reports/index.html" }
  },
  "analyzer": {
    "enabled": true,
    "model": "qwen-plus",
    "temperature": 0.7,
    "maxTokens": 3000
  },
  "notifier": {
    "feishu": { "enabled": false },
    "welink": { "enabled": false }
  }
}
```

### prompts.json

```javascript
const prompts = require('./config/prompts.json');
```

包含日报、周报、月报的 AI 提示词模板。

---

## 命令行脚本

```bash
# 生成日报
node scripts/generate-daily.js 2026-03-08

# 生成周报
node scripts/generate-weekly.js 2026-W11

# 生成月报
node scripts/generate-monthly.js 2026-03

# 生成所有报告
node scripts/generate-all.js

# 生成首页
node scripts/generate-index.js

# 更新首页
node scripts/update-index.js

# 查看帮助
node scripts/help.js
```

---

## 环境变量

创建 `.env` 文件：

```bash
# LLM 配置（必需）
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.example.com/v1
LLM_MODEL=qwen-plus

# 飞书通知（可选）
FEISHU_APP_ID=your-app-id
FEISHU_APP_SECRET=your-app-secret
FEISHU_RECEIVE_ID=your-open-id

# WeLink 通知（可选）
WELINK_WEBHOOK_URLS=https://your-webhook-url

# HuggingFace Papers Report（可选）
PAPER_REPORT_ENABLED=true
```

---

## HuggingFace Papers 模块 API

### 1. PaperDownloader

**位置**: `src/scraper/paper-downloader.js`

**功能**: 下载 latest.json

```javascript
const downloader = require('../src/scraper/paper-downloader');
const data = await downloader.downloadLatestPapers();

// 返回：
// {
//   raw: {...},
//   papers: [{title, paper_url, authors, stars, details, scraped_date}],
//   downloadedAt: "...",
//   downloadedDate: "2026-04-01"
// }
```

---

### 2. PapersScraper

**位置**: `src/scraper/strategies/papers-scraper.js`

**功能**: 清洗和过滤数据

```javascript
const PapersScraper = require('../src/scraper/strategies/papers-scraper');
const scraper = new PapersScraper({ minStars: 10 });

const result = await scraper.execute({ saveToFile: true });
// 返回：
// {
//   success: true,
//   data: {...},
//   filteredPapers: [...],
//   path: "..."
// }
```

---

### 3. PaperAnalyzer

**位置**: `src/analyzer/paper-analyzer.js`

**功能**: AI 分析论文

```javascript
const analyzer = require('../src/analyzer/paper-analyzer');
const insights = await analyzer.analyze({
  date: '2026-04-01',
  papers: [...]
});

// 返回：
// {
//   oneLiner: "...",
//   languageDistribution: {...},
//   technicalInsights: [...],
//   communityValue: [...],
//   applicationOutlook: [...]
// }
```

---

### 4. PaperHtmlGenerator

**位置**: `src/generator/paper-html-generator.js`

**功能**: 生成 HTML 报告

```javascript
const generator = require('../src/generator/paper-html-generator');
const path = await generator.generate({
  date: '2026-04-01',
  papers: [...],
  aiInsights: {...}
});
// 返回：HTML 文件路径
```

---

### 5. PaperNotification

**位置**: `src/notifier/paper-notification.js`

**功能**: 发送通知

```javascript
const notifier = require('../src/notifier/paper-notification');

// 飞书
await notifier.sendFeishu({
  date: '2026-04-01',
  papers: [...],
  filteredPapers: [...],
  aiInsights: {...},
  reportUrl: '...'
});

// WeLink
await notifier.sendWeLink({
  date: '2026-04-01',
  filteredPapers: [...],
  aiInsights: {...},
  reportUrl: '...'
});
```

---

### 6. 路径工具 (papers)

```javascript
const pathUtils = require('./src/utils/path');

// 获取论文数据路径
pathUtils.getPaperDataPath('2026-04-01');
pathUtils.getPaperLatestPath();
pathUtils.getPaperInsightsPath('2026-04-01');
pathUtils.getPaperReportPath('2026-04-01');
```

---

## 运行

```bash
# 生成报告并推送
node scripts/run-papers-workflow.js

# 仅生成报告，不推送
node scripts/run-papers-workflow.js --no-push
```
