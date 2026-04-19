# HuggingFace AI Papers 日报系统 - 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建独立的 HuggingFace AI Papers 日报系统，每日抓取最新论文数据，生成 HTML 报告并推送到飞书和 WeLink

**Architecture:** 采用模块化设计，包含下载器、抓取器、分析器、HTML生成器和通知器五个核心模块，所有模块独立运行，不修改现有 GitHub Trending 系统

**Tech Stack:** Node.js (ES Modules), fetch API, Existing LLM/Translation APIs

---

## 文件结构

```
src/
├── scraper/
│   ├── paper-downloader.js            # 新建：下载 latest.json
│   └── strategies/
│       └── papers-scraper.js          # 新建：清洗和过滤数据
├── analyzer/
│   └── paper-analyzer.js              # 新建：AI 分析论文
├── generator/
│   └── paper-html-generator.js        # 新建：生成 HTML 报告
└── notifier/
    └── paper-notification.js          # 新建：推送通知

scripts/
└── run-papers-workflow.js             # 新建：工作流脚本

data/papers/                           # 新建目录：存储数据
reports/papers/daily/                  # 新建目录：存储报告

config/config.json                     # 修改：添加 paperReport 配置
```

---

### Task 1: 创建目录结构

**Files:**
- Create: `data/papers/daily/`
- Create: `data/papers/insights/`
- Create: `reports/papers/daily/`

- [ ] **Step 1: 创建数据和报告目录**

```bash
mkdir -p data/papers/daily
mkdir -p data/papers/insights
mkdir -p reports/papers/daily
```

- [ ] **Step 2: 创建 .gitkeep 文件保留目录**

```bash
# data/papers/daily/.gitkeep
# data/papers/insights/.gitkeep
# reports/papers/daily/.gitkeep
```

内容均为空文件即可：
```bash
touch data/papers/daily/.gitkeep
touch data/papers/insights/.gitkeep
touch reports/papers/daily/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add data/papers/ reports/papers/
git commit -m "chore: add papers report directories"
```

---

### Task 2: 更新配置文件

**Files:**
- Modify: `config/config.json`

- [ ] **Step 1: 添加 paperReport 配置**

在 `config/config.json` 中添加 `paperReport` 配置节：

```json
{
  "name": "github-trending-reports",
  "version": "2.0.0",
  "description": "GitHub Trending 报告生成系统",
  "report": {
    "baseUrl": "${REPORT_BASE_URL}",
    "daily": { ... },
    "weekly": { ... },
    "monthly": { ... },
    "index": { ... }
  },
  "paperReport": {
    "enabled": "${PAPER_REPORT_ENABLED}",
    "outputDir": "reports/papers/daily",
    "dataDir": "data/papers",
    "feishu": {
      "enabled": "${FEISHU_ENABLED}",
      "appId": "${FEISHU_APP_ID}",
      "appSecret": "${FEISHU_APP_SECRET}",
      "receiveId": "${FEISHU_RECEIVE_ID}",
      "receiveIdType": "${FEISHU_RECEIVE_ID_TYPE}",
      "minStars": 10
    },
    "welink": {
      "enabled": "${WELINK_ENABLED}",
      "webhookUrls": "${WELINK_WEBHOOK_URLS}",
      "maxChars": 500,
      "minStars": 10
    }
  },
  "analyzer": { ... },
  "notifier": { ... },
  "logging": { ... }
}
```

**注意**：`paperReport` 应与 `report`, `analyzer`, `notifier` 同级

- [ ] **Step 2: Commit**

```bash
git add config/config.json
git commit -m "feat: add paperReport configuration"
```

---

### Task 3: 创建 paper-downloader.js

**Files:**
- Create: `src/scraper/paper-downloader.js`

- [ ] **Step 1: 下载 latest.json 的实现**

```javascript
const logger = require('../utils/logger');

const LATEST_PAPERS_URL = 'https://raw.githubusercontent.com/spock-wen/Daily-HuggingFace-AI-Papers/main/data/latest.json';

/**
 * 下载 Latest.json
 * @returns {Promise<Object>} 包含原始数据和清洗后的数据
 */
async function downloadLatestPapers() {
  logger.info('[paper-downloader] 开始下载 HuggingFace 最新论文数据...');

  try {
    const response = await fetch(LATEST_PAPERS_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
      throw new Error('latest.json 格式错误：期望数组类型');
    }

    const downloadedAt = new Date().toISOString();
    const downloadedDate = new Date().toISOString().split('T')[0];

    const papers = rawData.map(item => ({
      title: item.title,
      paper_url: item.paper_url,
      authors: item.authors || [],
      stars: parseInt(item.stars, 10) || 0,
      details: item.details || {},
      scraped_date: item.scraped_date || downloadedDate
    }));

    const result = {
      raw: rawData,
      papers,
      downloadedAt,
      downloadedDate
    };

    logger.success('[paper-downloader] 成功下载 ' + papers.length + ' 篇论文');
    return result;

  } catch (error) {
    logger.error('[paper-downloader] 下载失败', { error: error.message });
    throw error;
  }
}

/**
 * 保存原始数据到文件
 * @param {Object} data - 下载的数据
 * @param {string} filePath - 文件路径
 */
async function saveRawData(data, filePath) {
  const { writeJson } = require('./fs');
  await writeJson(filePath, data.raw);
  logger.info('[paper-downloader] 原始数据已保存到 ' + filePath);
}

module.exports = {
  downloadLatestPapers,
  saveRawData
};
```

- [ ] **Step 2: Commit**

```bash
git add src/scraper/paper-downloader.js
git commit -m "feat: add paper-downloader module"
```

---

### Task 4: 更新路径工具

**Files:**
- Modify: `src/utils/path.js`

- [ ] **Step 1: 添加 Papers 报告的路径函数**

在 `src/utils/path.js` 中添加以下函数：

```javascript
/**
 * 获取论文原始数据路径
 * @param {string} date - 日期 'YYYY-MM-DD'
 * @returns {string} 文件路径
 */
function getPaperDataPath(date) {
  return path.join(__dirname, '../../data/papers/daily/papers-' + date + '.json');
}

/**
 * 获取最新论文数据路径
 * @returns {string} 文件路径
 */
function getPaperLatestPath() {
  return path.join(__dirname, '../../data/papers/daily/papers-latest.json');
}

/**
 * 获取论文洞察数据路径
 * @param {string} date - 日期 'YYYY-MM-DD'
 * @returns {string} 文件路径
 */
function getPaperInsightsPath(date) {
  return path.join(__dirname, '../../data/papers/insights/papers-' + date + '.json');
}

/**
 * 获取论文 HTML 报告路径
 * @param {string} date - 日期 'YYYY-MM-DD'
 * @returns {string} 文件路径
 */
function getPaperReportPath(date) {
  return path.join(__dirname, '../../reports/papers/daily/papers-' + date + '.html');
}

module.exports = {
  // ... existing exports ...
  getPaperDataPath,
  getPaperLatestPath,
  getPaperInsightsPath,
  getPaperReportPath
};
```

**注意**：保持原有导出不变，只添加新函数

- [ ] **Step 2: Commit**

```bash
git add src/utils/path.js
git commit -m "feat: add paper report path utilities"
```

---

### Task 5: 创建 papers-scraper.js

**Files:**
- Create: `src/scraper/strategies/papers-scraper.js`

- [ ] **Step 1: 创建 PapersScraper 类**

```javascript
const BaseScraper = require('../base-scraper');
const { downloadLatestPapers, saveRawData } = require('../paper-downloader');
const { getPaperDataPath, getPaperLatestPath } = require('../../utils/path');
const { writeJson } = require('../../utils/fs');
const logger = require('../../utils/logger');

/**
 * PapersScraper - HuggingFace 论文抓取器
 * 继承 BaseScraper，专门用于抓取 HuggingFace 最新论文数据
 */
class PapersScraper extends BaseScraper {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} options.minStars - 最小 Stars 数阈值（默认 10）
   */
  constructor(options = {}) {
    super({
      type: 'paper',
      name: 'PapersScraper',
      timeout: options.timeout
    });
    this.minStars = options.minStars || 10;
  }

  /**
   * 获取抓取器类型
   * @returns {string} 类型标识
   */
  getType() {
    return 'paper';
  }

  /**
   * 获取调度 cron 表达式
   * 默认每天早上 8 点执行
   * @returns {string} Cron 表达式
   */
  getSchedule() {
    return process.env.PAPER_SCHEDULE || '0 0 8 * * *';
  }

  /**
   * 获取输出文件名
   * @param {Date} date - 日期对象
   * @returns {string} 文件名
   */
  getFileName(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `papers-${year}-${month}-${day}.json`;
  }

  /**
   * 获取输出目录
   * @returns {string} 输出目录路径
   */
  getOutputDir() {
    return 'data/papers/daily';
  }

  /**
   * 获取完整输出路径
   * @param {string} baseDir - 基础目录
   * @param {Date} date - 日期对象
   * @returns {string} 完整路径
   */
  getOutputPath(baseDir = process.cwd(), date = new Date()) {
    const path = require('path');
    return path.join(baseDir, this.getOutputDir(), this.getFileName(date));
  }

  /**
   * 执行抓取
   * @param {Object} options - 选项
   * @param {boolean} options.saveToFile - 是否保存到文件
   * @returns {Promise<Object>} 抓取结果
   */
  async execute(options = {}) {
    logger.title('[PapersScraper] 开始抓取 HuggingFace 论文数据');

    // 步骤 1: 下载 latest.json
    const downloaded = await downloadLatestPapers();

    // 步骤 2: 过滤 Stars >= minStars 的论文
    const filteredPapers = downloaded.papers.filter(p => p.stars >= this.minStars);

    // 步骤 3: 保存完整数据（所有论文）
    const fullPath = this.getOutputPath(process.cwd(), new Date(downloaded.downloadedDate));
    await writeJson(fullPath, {
      scrapedAt: downloaded.downloadedAt,
      date: downloaded.downloadedDate,
      papers: downloaded.papers,
      stats: {
        totalCount: downloaded.papers.length,
        filteredCount: filteredPapers.length,
        minStars: this.minStars
      }
    });

    // 步骤 4: 保存 latest.json（原始数据）
    await saveRawData(downloaded, getPaperLatestPath());

    logger.success('[PapersScraper] 抓取完成', {
      total: downloaded.papers.length,
      filtered: filteredPapers.length,
      path: fullPath
    });

    return {
      success: true,
      data: downloaded,
      filteredPapers,
      path: fullPath
    };
  }

  /**
   * 获取抓取器描述
   * @returns {Object} 描述信息
   */
  getDescription() {
    return {
      name: this.name,
      type: this.getType(),
      description: 'HuggingFace 论文抓取器',
      schedule: this.getSchedule(),
      minStars: this.minStars
    };
  }
}

module.exports = PapersScraper;
```

- [ ] **Step 2: Commit**

```bash
git add src/scraper/strategies/papers-scraper.js
git commit -m "feat: add papers-scraper strategy"
```

---

### Task 6: 创建 paper-analyzer.js

**Files:**
- Create: `src/analyzer/paper-analyzer.js`

- [ ] **Step 1: AI 分析论文的实现**

```javascript
const { callLLM } = require('../utils/llm');
const { writeJson } = require('../utils/fs');
const { getPaperInsightsPath } = require('../utils/path');
const logger = require('../utils/logger');

const AI_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 60000
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callLLMWithRetry(prompt, options = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= AI_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      console.log(`🤖 AI 分析中 (${attempt}/${AI_RETRY_CONFIG.maxRetries})...`);
      const result = await callLLM(prompt, options);
      if (result && result.trim().length > 0) {
        return result;
      }
      throw new Error('LLM 返回空响应');
    } catch (error) {
      lastError = error;
      console.error(`❌ AI 分析尝试 ${attempt}/${AI_RETRY_CONFIG.maxRetries} 失败：${error.message}`);

      if (attempt < AI_RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          AI_RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
          AI_RETRY_CONFIG.maxDelay
        );
        const jitter = Math.random() * 1000;
        const totalDelay = delay + jitter;
        console.log(`⏳ 等待 ${(totalDelay / 1000).toFixed(1)}s 后重试...`);
        await sleep(totalDelay);
      }
    }
  }

  throw lastError || new Error('AI 分析失败');
}

class PaperAnalyzer {
  constructor() {
    this.name = 'PaperAnalyzer';
  }

  /**
   * 分析论文数据
   * @param {Object} paperData - 论文数据
   * @returns {Promise<Object>} AI 洞察
   */
  async analyze(paperData) {
    const { date, papers } = paperData;

    logger.info('[PaperAnalyzer] 开始分析论文数据...', { date, count: papers.length });

    try {
      const contextData = this.prepareContextData(papers);
      const prompt = this.buildPrompt(contextData);

      const result = await callLLMWithRetry(prompt, {
        temperature: 0.7,
        max_tokens: 2000
      });

      const insights = this.parseInsights(result);
      await this.saveInsights(date, insights);

      logger.success('[PaperAnalyzer] 分析完成', { date });
      return insights;

    } catch (error) {
      logger.error('[PaperAnalyzer] 分析失败', { error: error.message });
      return this.getFallbackInsights();
    }
  }

  /**
   * 准备上下文数据
   * @param {Array} papers - 论文列表
   * @returns {Object} 格式化的上下文
   */
  prepareContextData(papers) {
    // 选择前 50 篇论文（避免 prompt 过长）
    const samplePapers = papers.slice(0, 50).map(p => ({
      title: p.title,
      stars: p.stars,
      arxiv_url: p.details?.arxiv_page_url || p.paper_url,
      github_links: p.details?.github_links || []
    }));

    return {
      papers: samplePapers,
      totalCount: papers.length,
     sampleCount: samplePapers.length
    };
  }

  /**
   * 构建 Prompt
   * @param {Object} context - 上下文数据
   * @returns {string} Prompt 字符串
   */
  buildPrompt(context) {
    const papersJson = JSON.stringify(context.papers, null, 2);

    return `你是一位专业的 AI 研究员，分析今日的 HuggingFace 热门论文。

今日论文（共 {totalCount} 篇，分析 {sampleCount} 篇）：
{papersJson}

请按以下格式输出 JSON：
{{
  "oneLiner": "一句话总结今日论文观察（30字以内）",
  "languageDistribution": {{
    "编程语言/框架名": 论文数量
  }},
  "technicalInsights": [
    {{
      "paper": "github.com/owner/repo",
      "innovation": "技术创新点（1-2 句）",
      "method": "核心方法（简要）",
      "results": "实验结果或效果"
    }}
  ],
  "communityValue": [
    "开源价值点1",
    "开源价值点2"
  ],
  "applicationOutlook": [
    "应用前景1",
    "应用前景2"
  ]
}}

要求：
1. oneLiner 精炼概括今日论文特点（30字以内）
2. languageDistribution 统计出现的编程语言或框架
3. technicalInsights 分析 3-5 篇技术亮点突出的论文
4. communityValue 强调开源价值
5. applicationOutlook 展望应用前景

注意：
- 所有论文链接使用 github.com/owner/repo 格式
- 输出纯 JSON，不要 markdown 包裹
- 使用中文输出`;

    // 替换占位符
    let prompt = this.BuildPrompt;
    prompt = prompt.replace('{totalCount}', context.totalCount);
    prompt = prompt.replace('{sampleCount}', context.sampleCount);
    prompt = prompt.replace('{papersJson}', papersJson);

    return prompt;
  }

  /**
   * 解析 AI 响应
   * @param {string} response - AI 响应文本
   * @returns {Object} 解析后的洞察
   */
  parseInsights(response) {
    try {
      // 移除可能的 markdown 代码块
      let clean = response.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();

      // 提取 JSON 对象
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('未找到 JSON 对象');
      }

      const jsonStr = clean.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr);
    } catch (error) {
      logger.error('[PaperAnalyzer] 解析失败', { error: error.message });
      return this.getFallbackInsights();
    }
  }

  /**
   * 降级洞察
   * @returns {Object} 降级数据
   */
  getFallbackInsights() {
    return {
      oneLiner: 'AI 分析服务 temporarily 不可用',
      languageDistribution: {},
      technicalInsights: [],
      communityValue: [],
      applicationOutlook: []
    };
  }

  /**
   * 保存洞察
   * @param {string} date - 日期
   * @param {Object} insights - 洞察数据
   */
  async saveInsights(date, insights) {
    const filePath = getPaperInsightsPath(date);
    await writeJson(filePath, insights);
    logger.debug('[PaperAnalyzer] 洞察已保存：' + filePath);
  }
}

module.exports = PaperAnalyzer;
```

**注意**：上面的 prompt 构建有问题，修正：

```javascript
  buildPrompt(context) {
    const papersJson = JSON.stringify(context.papers, null, 2);

    const template = `你是一位专业的 AI 研究员，分析今日的 HuggingFace 热门论文。

今日论文（共 {totalCount} 篇，分析 {sampleCount} 篇）：
{papersJson}

请按以下格式输出 JSON：
{{
  "oneLiner": "一句话总结今日论文观察（30字以内）",
  "languageDistribution": {{
    "编程语言/框架名": 论文数量
  }},
  "technicalInsights": [
    {{
      "paper": "github.com/owner/repo",
      "innovation": "技术创新点（1-2 句）",
      "method": "核心方法（简要）",
      "results": "实验结果或效果"
    }}
  ],
  "communityValue": [
    "开源价值点1",
    "开源价值点2"
  ],
  "applicationOutlook": [
    "应用前景1",
    "应用前景2"
  ]
}}

要求：
1. oneLiner 精炼概括今日论文特点（30字以内）
2. languageDistribution 统计出现的编程语言或框架
3. technicalInsights 分析 3-5 篇技术亮点突出的论文
4. communityValue 强调开源价值
5. applicationOutlook 展望应用前景

注意：
- 所有论文链接使用 github.com/owner/repo 格式
- 输出纯 JSON，不要 markdown 包裹
- 使用中文输出`;

    return template
      .replace('{totalCount}', context.totalCount)
      .replace('{sampleCount}', context.sampleCount)
      .replace('{papersJson}', papersJson);
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/analyzer/paper-analyzer.js
git commit -m "feat: add paper-analyzer module"
```

---

### Task 7: 创建 paper-notification.js

**Files:**
- Create: `src/notifier/paper-notification.js`

- [ ] **Step 1: 推送通知实现**

```javascript
const fetch = require('node-fetch');
const logger = require('../utils/logger');
const { getConfig, getEnvBool } = require('../utils/config');

// 加载配置
const config = getConfig();

// 推送启用状态
const FEISHU_ENABLED = getEnvBool('FEISHU_ENABLED', true);
const WELINK_ENABLED = getEnvBool('WELINK_ENABLED', false);

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

// Token 缓存
let cachedToken = null;
let tokenExpireTime = 0;

class PaperNotification {
  constructor() {
    this.name = 'PaperNotification';
  }

  /**
   * 发送飞书通知
   * @param {Object} options - 通知选项
   * @returns {Promise<Object>} 发送结果
   */
  async sendFeishu(options) {
    if (!FEISHU_ENABLED) {
      logger.warn('飞书通知已禁用，跳过发送');
      return { success: false, platform: 'feishu', error: '飞书通知已禁用' };
    }

    try {
      logger.info('[PaperNotification] 发送飞书通知...', { date: options.date });

      const message = this.buildFeishuMessage(options);
      const accessToken = await this.getFeishuAccessToken();
      const receiveId = config.notifier.feishu.receiveId;
      const receiveIdType = config.notifier.feishu.receiveIdType || 'open_id';

      const result = await this.sendFeishuMessage(accessToken, receiveId, receiveIdType, message);

      logger.success('[PaperNotification] 飞书通知发送成功');
      return { success: true, platform: 'feishu', result };
    } catch (error) {
      logger.error('[PaperNotification] 飞书通知发送失败', { error: error.message });
      return { success: false, platform: 'feishu', error: error.message };
    }
  }

  /**
   * 获取飞书 access token
   * @returns {Promise<string>} access token
   */
  async getFeishuAccessToken() {
    if (cachedToken && Date.now() < tokenExpireTime) {
      return cachedToken;
    }

    const { appId, appSecret } = config.notifier.feishu;

    try {
      const response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        timeout: 15000
      });

      if (!response.ok) {
        throw new Error(`获取飞书 token 失败：HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(`获取飞书 token 失败：${result.msg}`);
      }

      cachedToken = result.tenant_access_token;
      tokenExpireTime = result.expire - 300;

      return cachedToken;
    } catch (error) {
      throw new Error(`飞书 token 请求失败：${error.message}`);
    }
  }

  /**
   * 发送飞书消息
   */
  async sendFeishuMessage(accessToken, receiveId, receiveIdType, message) {
    const payload = {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: JSON.stringify(message)
    };

    const response = await fetch(`${FEISHU_API_BASE}/im/v1/messages?receive_id_type=${receiveIdType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload),
      timeout: 15000
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`飞书消息发送失败：HTTP ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(`飞书推送失败：${result.msg}`);
    }

    return result;
  }

  /**
   * 发送 WeLink 通知
   * @param {Object} options - 通知选项
   * @returns {Promise<Array>} 发送结果数组
   */
  async sendWeLink(options) {
    if (!WELINK_ENABLED) {
      logger.warn('WeLink 通知已禁用，跳过发送');
      return { success: false, platform: 'welink', error: 'WeLink 通知已禁用' };
    }

    try {
      logger.info('[PaperNotification] 发送 WeLink 通知...', { date: options.date });

      const message = this.buildWeLinkMessage(options);
      const webhookUrls = config.notifier.welink.webhookUrls.split(',').map(url => url.trim());

      const results = await Promise.all(
        webhookUrls.map(url => this.sendWebhookRequest(url, message))
      );

      const successCount = results.filter(r => r.success).length;

      if (successCount > 0) {
        logger.success('[PaperNotification] WeLink 通知发送成功');
      } else {
        logger.error('[PaperNotification] WeLink 通知全部失败');
      }

      return results.map((r, i) => ({
        success: r.success,
        platform: 'welink',
        webhookIndex: i,
        result: r
      }));
    } catch (error) {
      logger.error('[PaperNotification] WeLink 通知发送失败', { error: error.message });
      return [{ success: false, platform: 'welink', error: error.message }];
    }
  }

  /**
   * 构建飞书消息
   * @param {Object} options - 通知选项
   * @returns {Object} 飞书消息对象
   */
  buildFeishuMessage(options) {
    const { date, papers, filteredPapers, aiInsights } = options;
    const totalCount = papers.length;
    const filteredCount = filteredPapers.length;

    // TOP5 论文（按 Stars 排序）
    const top5 = [...filteredPapers].sort((a, b) => b.stars - a.stars).slice(0, 5);

    // 格式化 TOP5
    const top5Text = top5.map((p, i) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
      const repo = p.details?.github_links?.[0]?.split('github.com/')?.[1] || 'N/A';
      return `${medal} ${p.title} 🌟${p.stars}\n   GitHub: ${repo}`;
    }).join('\n\n');

    return {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: `✅ HuggingFace AI Papers 日报已生成` },
        subtitle: { tag: 'plain_text', content: `${date} · ${filteredCount} 篇热门论文` },
        template: 'green'
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content: `📊 今日概览\nHuggingFace 最新论文共 ${totalCount} 篇，热门论文(Stars>10) ${filteredCount} 篇` }
        },
        { tag: 'hr' },
        {
          tag: 'div',
          text: { tag: 'lark_md', content: `🔥 热门论文 TOP 5\n\n${top5Text}` }
        },
        { tag: 'hr' },
        { tag: 'div', text: { tag: 'lark_md', content: `💡 AI 洞察\n${aiInsights?.oneLiner || '暫无'}` } },
        { tag: 'hr' },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '🔗 查看报告' },
              type: 'primary',
              url: options.reportUrl
            }
          ]
        },
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: `⏰ 生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` }]
        }
      ]
    };
  }

  /**
   * 构建 WeLink 消息（精简版）
   * @param {Object} options - 通知选项
   * @returns {Object} WeLink 消息对象
   */
  buildWeLinkMessage(options) {
    const { date, filteredPapers, aiInsights } = options;
    const minStars = options.minStars || 10;

    // TOP5 论文
    const top5 = [...filteredPapers].sort((a, b) => b.stars - a.stars).slice(0, 5);

    // 语言分布
    const langDist = aiInsights?.languageDistribution || {};
    const langText = Object.entries(langDist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k}(${v})`)
      .join(', ');

    // 构建消息
    let msg = `✅ HuggingFace AI Papers 日报 (${date})\n\n`;
    msg += `🔥 热门论文 TOP 5 (Stars>${minStars})：\n`;
    top5.forEach((p, i) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
      const repo = p.details?.github_links?.[0]?.split('github.com/')?.[1] || 'N/A';
      msg += `\n${medal} ${p.title} 🌟${p.stars}\n   GitHub: github.com/${repo}\n`;
    });

    if (langText) {
      msg += `\n💡 语言分布：${langText}`;
    }

    msg += `\n\n📋 完整报告：${options.reportUrl}`;

    // 截断到 500 字
    if (msg.length > 500) {
      msg = msg.substring(0, 500) + '...';
    }

    return {
      messageType: 'text',
      content: { text: msg },
      timeStamp: Date.now(),
      uuid: this.generateUUID()
    };
  }

  /**
   * 生成 UUID
   * @returns {string} UUID 字符串
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 发送 Webhook 请求
   */
  async sendWebhookRequest(url, data) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        timeout: 15000
      });

      const result = await response.json();
      return { success: result.code === '0' || result.code === 0, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送全部通知
   * @param {Object} options - 通知选项
   * @returns {Promise<Array>} 所有发送结果
   */
  async sendAll(options) {
    const [feishuResult, welinkResults] = await Promise.all([
      this.sendFeishu(options),
      this.sendWeLink(options)
    ]);

    return [feishuResult].concat(Array.isArray(welinkResults) ? welinkResults : [welinkResults]);
  }
}

module.exports = PaperNotification;
```

- [ ] **Step 2: Commit**

```bash
git add src/notifier/paper-notification.js
git commit -m "feat: add paper-notification module"
```

---

### Task 8: 创建 paper-html-generator.js

**Files:**
- Create: `src/generator/paper-html-generator.js`

- [ ] **Step 1: HTML 生成器实现**

```javascript
const { writeHtml } = require('../utils/fs');
const { getPaperReportPath } = require('../utils/path');
const logger = require('../utils/logger');

class PaperHtmlGenerator {
  constructor() {
    this.name = 'PaperHtmlGenerator';
  }

  /**
   * 生成日报 HTML
   * @param {Object} data - 论文数据
   * @returns {Promise<string>} HTML 文件路径
   */
  async generate(data) {
    const { date, papers, aiInsights } = data;

    logger.info('[PaperHtmlGenerator] 开始生成 HTML 报告...', { date });

    const html = this.renderHTML(data);
    const filePath = getPaperReportPath(date);

    await writeHtml(filePath, html);

    logger.success('[PaperHtmlGenerator] HTML 报告已生成', { path: filePath });
    return filePath;
  }

  /**
   * 渲染 HTML
   * @param {Object} data - 论文数据
   * @returns {string} HTML 字符串
   */
  renderHTML(data) {
    const { date, papers, aiInsights } = data;

    // 统计信息
    const totalCount = papers.length;
    const totalStars = papers.reduce((sum, p) => sum + (p.stars || 0), 0);
    const avgStars = totalCount > 0 ? Math.round(totalStars / totalCount) : 0;

    // 语言分布
    const langDist = aiInsights?.languageDistribution || {};
    const langDistHtml = this.renderLanguageDistribution(langDist);

    // AI 洞察
    const aiInsightsHtml = this.renderAiInsights(aiInsights);

    // 论文列表（全量）
    const papersHtml = papers.map(p => this.renderPaperCard(p)).join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HuggingFace AI Papers 日报 - ${date}</title>
  <link rel="stylesheet" href="../../../public/css/style.css">
  <style>
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; }
    .stat-card { background: white; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .stat-value { font-size: 36px; font-weight: bold; color: #667eea; }
    .stat-label { color: #666; margin-top: 5px; }
    .paper-card { background: white; border-radius: 12px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .paper-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
    .paper-meta { color: #666; font-size: 14px; margin-bottom: 10px; }
    .paper-abstract { color: #333; line-height: 1.6; margin: 10px 0; }
    .paper-links { margin-top: 10px; }
    .paper-links a { color: #667eea; margin-right: 15px; }
    .ai-section { background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 30px 0; }
    .lang-dist { display: flex; flex-wrap: wrap; gap: 10px; }
    .lang-item { background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px; }
   hr { border: none; border-top: 1px solid #eee; margin: 30px 0; }
    .lang-item { background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px; }
    .lang-item { background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px; }
    .lang-item { background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px; }
    .lang-item { background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px; }
    .lang-item { background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px; }
    .lang-item { background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px; }
    .lang-item { background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HuggingFace AI Papers 日报</h1>
      <p style="font-size: 20px; margin-top: 10px;">${date}</p>
    </div>

    ${this.renderStatsSection(totalCount, totalStars, avgStars)}

    ${langDistHtml}

    ${aiInsightsHtml}

    <h2>论文列表（共 ${totalCount} 篇）</h2>
    ${papersHtml}
  </div>
</body>
</html>`;
  }

  /**
   * 渲染统计信息
   */
  renderStatsSection(totalCount, totalStars, avgStars) {
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalCount}</div>
          <div class="stat-label">论文总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalStars.toLocaleString()}</div>
          <div class="stat-label">总 Stars</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgStars}</div>
          <div class="stat-label">平均 Stars</div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染语言分布
   */
  renderLanguageDistribution(dist) {
    const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return '';

    const items = entries.slice(0, 10).map(([lang, count]) => 
      `<span class="lang-item">${lang}(${count})</span>`
    ).join('');

    return `
      <section class="ai-section">
        <h3>语言分布</h3>
        <div class="lang-dist">${items}</div>
      </section>
    `;
  }

  /**
   * 渲染 AI 洞察
   */
  renderAiInsights((aiInsights) {
    if (!aiInsights) return '';

    return `
      <section class="ai-section">
        <h2>AI 洞察</h2>
        
        ${aiInsights.oneLiner ? `
          <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <strong>今日观察</strong>
            <p style="margin: 5px 0 0 0;">${aiInsights.oneLiner}</p>
          </div>
        ` : ''}

        ${aiInsights.technicalInsights && aiInsights.technicalInsights.length > 0 ? `
          <h3>技术亮点</h3>
          <ul>
            ${aiInsights.technicalInsights.map(insight => `
              <li>
                <strong>${insight.paper}</strong>:
                <p style="margin: 5px 0 0 0;">${insight.innovation}</p>
              </li>
            `).join('')}
          </ul>
        ` : ''}

        ${aiInsights.communityValue && aiInsights.communityValue.length > 0 ? `
          <h3>社区价值</h3>
          <ul>
            ${aiInsights.communityValue.map(v => `<li>${v}</li>`).join('')}
          </ul>
        ` : ''}

        ${aiInsights.applicationOutlook && aiInsights.applicationOutlook.length > 0 ? `
          <h3>应用前景</h3>
          <ul>
            ${aiInsights.applicationOutlook.map(v => `<li>${v}</li>`).join('')}
          </ul>
        ` : ''}
      </section>
    `;
  }

  /**
   * 渲染论文卡片
   */
  renderPaperCard(paper) {
    const githubLinks = paper.details?.github_links || [];
    const arxivUrl = paper.details?.arxiv_page_url || paper.paper_url;
    const pdfUrl = paper.details?.pdf_url || '';

    // 翻译摘要（如果有）
    const abstract = paper.details?.abstract || '';
    const abstractZh = paper.details?.abstract_zh || this.translateAbstract(abstract);

    return `
      <div class="paper-card">
        <div class="paper-title">🌟 ${paper.stars} ${paper.title}</div>
        <div class="paper-meta">
          ${paper.authors?.length ? `作者：${paper.authors.join(', ')} | ` : ''}
          HuggingFace: <a href="${paper.paper_url}" target="_blank">链接</a> |
          arXiv: <a href="${arxivUrl}" target="_blank">链接</a> ${
            pdfUrl ? `| PDF: <a href="${pdfUrl}" target="_blank">下载</a>` : ''
          }
        </div>
        ${githubLinks.length > 0 ? `
          <div class="paper-meta">
            GitHub: ${githubLinks.map(url => `<a href="${url}" target="_blank">${url.split('github.com/')[1] || 'code'}</a>`).join(', ')}
          </div>
        ` : ''}
        <div class="paper-abstract"><strong>摘要：</strong>${abstractZh}</div>
      </div>
    `;
  }

  /**
   * 翻译摘要（简单占位，实际使用翻译 API）
   */
  translateAbstract(text) {
    if (!text) return '暂无摘要';
    
    // TODO: 使用现有的翻译 API
    // const { translateDescription } = require('../scraper/project-analyzer');
    // return await translateDescription(text);
    
    // 暂时返回原文
    return text;
  }
}

module.exports = PaperHtmlGenerator;
```

- [ ] **Step 2: Commit**

```bash
git add src/generator/paper-html-generator.js
git commit -m "feat: add paper-html-generator module"
```

---

### Task 9: 创建 run-papers-workflow.js

**Files:**
- Create: `scripts/run-papers-workflow.js`

- [ ] **Step 1: 工作流脚本实现**

```javascript
/**
 * HuggingFace Papers 报告完整工作流脚本
 * 执行：下载 → 清洗 → AI分析 → 生成HTML → 发送通知
 * 
 * 用法：
 *   node scripts/run-papers-workflow.js            # 正常执行（含推送）
 *   node scripts/run-papers-workflow.js --no-push  # 不发送推送通知
 */

const { downloadLatestPapers } = require('../src/scraper/paper-downloader');
const PapersScraper = require('../src/scraper/strategies/papers-scraper');
const PaperAnalyzer = require('../src/analyzer/paper-analyzer');
const PaperHtmlGenerator = require('../src/generator/paper-html-generator');
const PaperNotification = require('../src/notifier/paper-notification');
const { writeJson } = require('../src/utils/fs');
const logger = require('../src/utils/logger');

// 解析命令行参数
const args = process.argv.slice(2);
const noPush = args.includes('--no-push');

// 重试配置
const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

async function runPapersWorkflow() {
  logger.info('============================================');
  logger.info('🚀 开始执行 HuggingFace Papers 报告工作流');
  if (noPush) {
    logger.info('📢 已禁用推送通知 (--no-push)');
  }
  logger.info('============================================');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      logger.info(`\n⏳ 第 ${attempt}/${MAX_RETRIES} 次重试...`);
    }

    try {
      const result = await executeWorkflow(noPush);

      if (result.success) {
        logger.success('============================================');
        logger.success('✅ HuggingFace Papers 工作流执行完成！');
        logger.success(`📄 HTML 路径: ${result.htmlPath || 'N/A'}`);
        logger.success(`⏱️ 耗时: ${result.duration || 'N/A'}`);
        if (attempt > 1) {
          logger.success(`🔄 重试次数: ${attempt - 1}`);
        }
        logger.success('============================================');
        return result;
      } else {
        logger.error(`❌ 第 ${attempt} 次尝试失败: ${result.error}`);

        if (attempt < MAX_RETRIES) {
          logger.info(`⏳ 等待 ${RETRY_INTERVAL_MS / 60000} 分钟后重试...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
        }
      }
    } catch (error) {
      logger.error(`❌ 第 ${attempt} 次尝试异常: ${error.message}`);

      if (attempt < MAX_RETRIES) {
        logger.info(`⏳ 等待 ${RETRY_INTERVAL_MS / 60000} 分钟后重试...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
      } else {
        throw error;
      }
    }
  }

  logger.error('============================================');
  logger.error(`❌ HuggingFace Papers 工作流执行失败，已重试 ${MAX_RETRIES} 次`);
  logger.error('============================================');
  return { success: false, error: `重试 ${MAX_RETRIES} 次后仍失败` };
}

async function executeWorkflow(disablePush) {
  const startTime = Date.now();

  // 步骤 1: 下载 latest.json
  logger.info('[Workflow] 步骤 1/5: 下载 latest.json...');
  const downloaded = await downloadLatestPapers();

  logger.success('[Workflow] 下载完成', {
    total: downloaded.papers.length,
    date: downloaded.downloadedDate
  });

  // 步骤 2: 保存完整数据（所有论文）
  logger.info('[Workflow] 步骤 2/5: 保存完整数据...');
  const scraper = new PapersScraper({ minStars: 10 });
  const filteredPapers = downloaded.papers.filter(p => p.stars >= scraper.minStars);

  const dataPath = scraper.getOutputPath(process.cwd(), new Date(downloaded.downloadedDate));
  await writeJson(dataPath, {
    scrapedAt: downloaded.downloadedAt,
    date: downloaded.downloadedDate,
    papers: downloaded.papers,
    filteredPapers,
    stats: {
      totalCount: downloaded.papers.length,
      filteredCount: filteredPapers.length,
      minStars: scraper.minStars
    }
  });

  logger.success('[Workflow] 数据已保存', { path: dataPath });

  // 步骤 3: AI 分析
  logger.info('[Workflow] 步骤 3/5: AI 分析...');
  const analyzer = new PaperAnalyzer();
  const aiInsights = await analyzer.analyze({
    date: downloaded.downloadedDate,
    papers: downloaded.papers
  });

  logger.success('[Workflow] AI 分析完成', {
    oneLiner: aiInsights.oneLiner || 'N/A'
  });

  // 步骤 4: 生成 HTML
  logger.info('[Workflow] 步骤 4/5: 生成 HTML 报告...');
  const generator = new PaperHtmlGenerator();
  const htmlPath = await generator.generate({
    date: downloaded.downloadedDate,
    papers: downloaded.papers,
    filteredPapers,
    aiInsights
  });

  logger.success('[Workflow] HTML 已生成', { path: htmlPath });

  // 步骤 5: 发送通知
  const notificationResults = [];
  if (!disablePush) {
    logger.info('[Workflow] 步骤 5/5: 发送通知...');
    const notifier = new PaperNotification();
    const baseUrl = require('../config/config.json').report?.baseUrl || 'https://report.wenspock.site';
    const reportUrl = `${baseUrl}/papers/daily/${scraper.getFileName(new Date(downloaded.downloadedDate))}`;

    notificationResults.push({
      type: 'feishu',
      result: await notifier.sendFeishu({
        date: downloaded.downloadedDate,
        papers: downloaded.papers,
        filteredPapers,
        aiInsights,
        reportUrl
      })
    });

    notificationResults.push({
      type: 'welink',
      result: await notifier.sendWeLink({
        date: downloaded.downloadedDate,
        filteredPapers,
        aiInsights,
        reportUrl,
        minStars: 10
      })
    });

    logger.success('[Workflow] 通知已发送');
  } else {
    logger.info('[Workflow] 步骤 5/5: 跳过通知 (--no-push)');
  }

  return {
    success: true,
    date: downloaded.downloadedDate,
    htmlPath,
    duration: Date.now() - startTime,
    notificationResults,
    papersCount: downloaded.papers.length,
    filteredCount: filteredPapers.length
  };
}

// 执行工作流
runPapersWorkflow()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

module.exports = { runPapersWorkflow, executeWorkflow };
```

- [ ] **Step 2: Commit**

```bash
git add scripts/run-papers-workflow.js
git commit -m "feat: add run-papers-workflow script"
```

---

### Task 10: 更新 config.json 添加 paperReport

**Files:**
- Modify: `config/config.json`

- [ ] **Step 1: 添加 paperReport 配置节**

在 `config/config.json` 中的 `report` 节点后添加：

```json
{
  "name": "github-trending-reports",
  "version": "2.0.0",
  "description": "GitHub Trending 报告生成系统",
  "report": {
    "baseUrl": "${REPORT_BASE_URL}",
    "daily": { ... },
    "weekly": { ... },
    "monthly": { ... },
    "index": { ... }
  },
  "paperReport": {
    "enabled": "${PAPER_REPORT_ENABLED}",
    "outputDir": "reports/papers/daily",
    "dataDir": "data/papers",
    "feishu": {
      "enabled": "${FEISHU_ENABLED}",
      "appId": "${FEISHU_APP_ID}",
      "appSecret": "${FEISHU_APP_SECRET}",
      "receiveId": "${FEISHU_RECEIVE_ID}",
      "receiveIdType": "${FEISHU_RECEIVE_ID_TYPE}",
      "minStars": 10
    },
    "welink": {
      "enabled": "${WELINK_ENABLED}",
      "webhookUrls": "${WELINK_WEBHOOK_URLS}",
      "maxChars": 500,
      "minStars": 10
    }
  },
  "analyzer": { ... },
  "notifier": { ... },
  "logging": { ... }
}
```

**注意**：
1. `paperReport` 与 `report`, `analyzer`, `notifier` 同级
2. 引用现有的环境变量（FEISHU_ENABLED, WELINK_ENABLED 等）

- [ ] **Step 2: Commit**

```bash
git add config/config.json
git commit -m "feat: add paperReport configuration to config.json"
```

---

### Task 11: 创建 .env.example 条目

**Files:**
- Create: `.env.example`（或更新现有文件）

- [ ] **Step 1: 添加 PAPER_REPORT_ENABLED 变量**

在 `.env.example` 中添加：

```bash
# HuggingFace Papers Report (可选)
PAPER_REPORT_ENABLED=true

# HuggingFace Papers 不需要额外配置，复用现有 LLM 和通知配置
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add PAPER_REPORT_ENABLED to .env.example"
```

---

### Task 12: 更新 docs/API.md

**Files:**
- Modify: `docs/API.md`

- [ ] **Step 1: 添加 Paper 模块 API 文档**

在 `docs/API.md` 末尾添加：

```markdown
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

---
```

- [ ] **Step 2: Commit**

```bash
git add docs/API.md
git commit -m "docs: add HuggingFace Papers API documentation"
```

---

### Task 13: 创建 README 注释

**Files:**
- Create: `data/papers/README.md`

- [ ] **Step 1: 创建数据目录说明**

```markdown
# HuggingFace Papers 数据目录

存储 HuggingFace AI Papers 报告的原始数据和洞察。

## 目录结构

```
data/papers/
├── daily/          # 每日数据
│   ├── papers-YYYY-MM-DD.json
│   └── papers-latest.json
├── insights/       # AI 洞察
│   └── papers-YYYY-MM-DD.json
└── README.md
```

## 文件说明

### daily/papers-YYYY-MM-DD.json

每日完整数据，包含所有论文（Stars > 0）

```json
{
  "scrapedAt": "...",
  "date": "2026-04-01",
  "papers": [...],
  "filteredPapers": [...],
  "stats": {
    "totalCount": 100,
    "filteredCount": 30,
    "minStars": 10
  }
}
```

### daily/papers-latest.json

原始 latest.json 数据（原始格式）

### insights/papers-YYYY-MM-DD.json

AI 分析生成的洞察

```json
{
  "oneLiner": "...",
  "languageDistribution": {...},
  "technicalInsights": [...],
  "communityValue": [...],
  "applicationOutlook": [...]
}
```
```

- [ ] **Step 2: Commit**

```bash
git add data/papers/README.md
git commit -m "docs: add papers data directory README"
```

---

## 执行总结

**Plan complete and saved to `docs/superpowers/plans/2026-04-01-huggingface-papers-report.md`**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
