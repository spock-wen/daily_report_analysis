# HuggingFace AI Papers 日报系统 - 设计文档

**创建日期**: 2026-04-01  
**作者**: Claude Opus  
**状态**:待审阅

---

## 1. 概述

### 1.1 目标

创建一个独立的 HuggingFace AI Papers 日报系统，每日抓取最新论文数据，生成 HTML 报告并推送到飞书和 WeLink。

### 1.2 核心原则

- **不修改现有系统**：完全独立，不影响现有的 GitHub Trending 日报
- **独立脚本**：通过 `scripts/run-papers-workflow.js` 触发
- **可配置**：通过 `config/config.json` 控制启用状态

### 1.3 数据源

- **URL**: `https://github.com/spock-wen/Daily-HuggingFace-AI-Papers/blob/main/data/latest.json`
- **更新频率**: 每日 00:00 UTC
- **数据格式**: JSON 包含论文列表
- **原始数据保留**: 所有论文（Stars > 0）原始数据必须完整保留

---

## 2. 数据结构

### 2.1 原始数据结构（from latest.json）

```json
{
  "title": "Paper Title",
  "paper_url": "https://huggingface.co/papers/2603.19835",
  "authors": ["Author1", "Author2"],
  "stars": 42,
  "details": {
    "title": "...",
    "abstract": "...",
    "arxiv_page_url": "https://arxiv.org/abs/...",
    "pdf_url": "https://arxiv.org/pdf/...",
    "github_links": ["https://github.com/owner/repo"],
    "scraped_at": "2026-04-01T06:28:36.434970"
  },
  "scraped_date": "2026-04-01"
}
```

### 2.2 存储数据结构

```
data/papers/daily/papers-YYYY-MM-DD.json  # 日报数据
data/papers/daily/papers-latest.json      # 最新数据（软链接或复制）
```

### 2.3 分析数据结构（带 AI 洞察）

```json
{
  "scrapedAt": "...",
  "date": "2026-04-01",
  "papers": [...],
  "aiInsights": {
    "oneLiner": "今日核心观察（一句话）",
    "languageDistribution": {
      "Python": 15,
      "PyTorch": 8,
      "TensorFlow": 3
    },
    "technicalInsights": [
      {
        "paper": "owner/repo",
        "innovation": "技术创新点",
        "method": "核心方法",
        "results": "实验结果"
      }
    ],
    "communityValue": [
      "社区价值点1",
      "社区价值点2"
    ],
    "applicationOutlook": [
      "应用前景1",
      "应用前景2"
    ]
  }
}
```

---

## 3. 系统架构

### 3.1 模块结构

```
src/
├── scraper/
│   ├── strategies/
│   │   └── papers-scraper.js          # 抓取器：下载 latest.json 并清洗
│   └── paper-downloader.js            # 工具：下载 latest.json
├── analyzer/
│   └── paper-analyzer.js              # AI 分析：生成综合洞察
├── generator/
│   └── paper-html-generator.js        # HTML 生成器
└── notifier/
    └── paper-notification.js          # 推送通知器

scripts/
└── run-papers-workflow.js             # 工作流脚本
```

### 3.2 数据流程

```
1. paper-downloader.js
   └─> 下载 latest.json
   └─> 保存到 data/papers/daily/papers-latest.json (原始完整数据)

2. papers-scraper.js
   └─> 加载 papers-latest.json
   └─> 保存到 data/papers/daily/papers-YYYY-MM-DD.json (全量数据，Stars > 0)
   └─> (过滤逻辑仅在推送时应用，不修改存储数据)

3. paper-analyzer.js
   └─> 调用 LLM 生成 AI 洞察
   └─> 保存到 data/papers/insights/papers-YYYY-MM-DD.json

4. paper-html-generator.js
   └─> 生成 HTML 报告
   └─> 保存到 reports/papers/daily/papers-YYYY-MM-DD.html

5. paper-notification.js
   └─> 从 papers-YYYY-MM-DD.json 读取数据
   └─> 过滤 Stars > 10 用于推送
   └─> 生成飞书消息
   └─> 生成 WeLink 消息 (<500 字)
   └─> 发送到对应平台
```

---

## 4. 模块设计

### 4.1 paper-downloader.js

**功能**：下载 latest.json

**API**:

```javascript
const downloader = require('../scraper/paper-downloader');
const data = await downloader.download();
// 返回：{ papers: [], scrapedAt: ..., raw: {...} }
```

**输出**：

```json
{
  "raw": { "title": "...", "papers": [...] },
  "papers": [...],
  "scrapedAt": "2026-04-01T06:28:36.434970",
  "scrapedDate": "2026-04-01"
}
```

---

### 4.2 papers-scraper.js

**继承**: base-scraper.js（类似 daily-scraper.js）

**功能**：

- 加载 latest.json
- 清洗数据
- **保存全量数据**（Stars > 0）到 papers-YYYY-MM-DD.json
- 过滤逻辑仅在推送时应用

**配置**：

```javascript
{
  type: 'paper',
  minStars: 10,  // 推送阈值（仅用于通知，不影响存储）
  name: 'PapersScraper',
  outputDir: 'data/papers/daily'
}
```

---

### 4.3 paper-analyzer.js

**功能**：AI 分析论文

**Prompt 设计**：

```
你是一位专业的 AI 研究员，分析今日的 HuggingFace 热门论文。

今日论文：
{papers}

请按以下格式输出 JSON：
{
  "oneLiner": "一句话总结今日论文观察（30字以内）",
  "languageDistribution": {
    "编程语言/框架名": 论文数量
  },
  "technicalInsights": [
    {
      "paper": "owner/repo",
      "innovation": "技术创新点",
      "method": "核心方法",
      "results": "实验结果"
    }
  ],
  "communityValue": [
    "社区价值点1",
    "社区价值点2"
  ],
  "applicationOutlook": [
    "应用前景1",
    "应用前景2"
  ]
}
```

**说明**：

- AI 洞察**仅在 HTML 中展示**
- 飞书/WeLink 不显示详细 AI 洞察
- 不使用"趋势"等概念，专注于具体论文的分析

---

### 4.4 paper-html-generator.js

**功能**：生成完整 HTML 报告

**内容结构**：

```html
1. 报告头部
   - 标题：HuggingFace AI Papers 日报 (YYYY-MM-DD)
   - 统计信息（总数、Stars 总和、平均 Stars）

2. AI 洞察区
   - 一句话趋势
   - 研究趋势
   - 技术亮点
   - 社区价值
   - 应用前景

3. 论文列表（全量，Stars > 0）
   - 标题 + 作者
   - HuggingFace + arXiv + PDF + GitHub 链接
   - 原文 abstract
   - 中文翻译摘要
   - Stars 数
```

---

### 4.5 paper-notification.js

**功能**：发送飞书和 WeLink 通知

#### 4.5.1 飞书消息（详细版）

- **数据来源**: 从 papers-YYYY-MM-DD.json 读取，过滤 Stars > 10

```json
{
  "header": {
    "title": "✅ HuggingFace AI Papers 日报已生成",
    "subtitle": "2026-04-01 · {count} 篇热门论文"
  },
  "elements": [
    { "tag": "div", "text": "📊 今日概览\nHuggingFace 最新论文共 {totalCount} 篇，热门论文(Stars>10) {count} 篇" },
    { "tag": "hr" },
    { "tag": "div", "text": "🔥 热门论文 TOP 5\n1. Paper Title 🌟42\n2. ..." },
    { "tag": "hr" },
    { 
      "tag": "action", 
      "actions": [{ "tag": "button", "text": "🔗 查看报告", "url": "..." }] 
    }
  ]
}
```

#### 4.5.2 WeLink 消息（精简版，<500字）

```
✅ HuggingFace AI Papers 日报 (2026-04-01)

🔥 热门论文 TOP 5 (Stars>10)：
1. Paper Title 🌟42
   GitHub: github.com/owner/repo

2. Paper Title 🌟38
   arXiv: arxiv.org/abs/...

3. Paper Title 🌟25
   ...

💡 语言分布：Python(15), PyTorch(8), ...

📋 完整报告：report.url
```

---

## 5. 配置文件

### config/config.json

```json
{
  "paperReport": {
    "enabled": true,
    "outputDir": "reports/papers/daily",
    "dataDir": "data/papers",
    "feishu": {
      "enabled": "${FEISHU_ENABLED}",
      "minStars": 10
    },
    "welink": {
      "enabled": "${WELINK_ENABLED}",
      "maxChars": 500,
      "minStars": 10
    }
  }
}
```

---

## 6. 路径规划

### 数据文件

```
data/papers/
├── daily/
│   ├── papers-2026-04-01.json     # 日报数据
│   ├── papers-2026-04-02.json
│   └── papers-latest.json          # 最新数据（软链接或复制）
├── insights/
│   ├── papers-2026-04-01.json      # AI 洞察
│   └── papers-2026-04-02.json
└── .gitkeep
```

### 报告文件

```
reports/papers/daily/
├── papers-2026-04-01.html
├── papers-2026-04-02.html
└── .gitkeep
```

---

## 7. 错误处理

### 7.1 网络错误

- 下载 latest.json 失败 → 重试 3 次，间隔 5 分钟
- LLM API 调用失败 → 使用降级数据（不阻断流程）

### 7.2 数据错误

- JSON 格式错误 → 记录日志，使用缓存数据
- 字段缺失 → 提供默认值

---

## 8. 测试策略

### 8.1 单元测试

- `tests/scraper/paper-downloader.test.js`
- `tests/scraper/papers-scraper.test.js`
- `tests/analyzer/paper-analyzer.test.js`

### 8.2 集成测试

- `tests/integration/papers-workflow.test.js`

---

## 9. 部署

### 9.1 手动运行

```bash
node scripts/run-papers-workflow.js
node scripts/run-papers-workflow.js --no-push  # 不发送通知
```

**注意**: 定时任务需要用户自行在服务器上配置 cron，脚本本身不包含定时功能。

---

## 10. 与现有系统的隔离


| 维度   | GitHub Trending       | HuggingFace Papers     |
| ---- | --------------------- | ---------------------- |
| 数据源  | GitHub Trending API   | latest.json 文件         |
| 存储路径 | data/daily/           | data/papers/daily/     |
| 报告路径 | reports/daily/        | reports/papers/daily/  |
| 脚本   | run-daily-workflow.js | run-papers-workflow.js |
| 配置   | report.{}             | paperReport:{}         |
| 影响范围 | 独立                    | 独立                     |


---

## 11. 后续扩展

### 11.1 可能的增强

- 生成周报/月报聚合
- 邮件推送（除飞书/WeLink 外）
- 微信推送
- Twitter 自动发布

### 11.2 性能优化

- 翻译缓存（避免重复翻译）
- AI 洞察缓存（同一天不重复分析）
- 并行翻译多个 abstract

---

## 12. 参考资料

- 现有日报系统: `src/scraper/strategies/daily-scraper.js`
- 通知模板: `src/notifier/notification-templates.js`
- LLM 工具: `src/utils/llm.js`
- 现有翻译 API: `src/scraper/project-analyzer.js` (translateDescription)

---

## 13. 设计检查清单

- 数据源明确（latest.json）
- 输出层级清晰（HTML > 飞书 > WeLink）
- 过滤阈值定义（Stars > 10）
- 翻译需求明确（abstract → 中文）
- AI 洞察范围明确（仅 HTML）
- 独立性确认（不影响现有系统）
- 错误处理设计
- 测试策略
- 部署说明
- 用户审阅通过

---

**下一步**: 等待用户 review 设计文档，确认后进入 implementation plan 阶段。