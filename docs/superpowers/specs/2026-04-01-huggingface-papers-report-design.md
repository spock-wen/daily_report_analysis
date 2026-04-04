# HuggingFace AI Papers 日报系统 - 设计文档

**创建日期**: 2026-04-01  
**最后更新**: 2026-04-04  
**作者**: Claude Opus  
**状态**: 已实现

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
      "社区价值点 1",
      "社区价值点 2"
    ],
    "applicationOutlook": [
      "应用前景 1",
      "应用前景 2"
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
  "oneLiner": "一句话总结今日论文观察（30 字以内）",
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
    "社区价值点 1",
    "社区价值点 2"
  ],
  "applicationOutlook": [
    "应用前景 1",
    "应用前景 2"
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
    { "tag": "div", "text": "📊 今日概览\nHuggingFace 最新论文共 {totalCount} 篇，热门论文 (Stars>10) {count} 篇" },
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

#### 4.5.2 WeLink 消息（精简版，<500 字）

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

## 5. HTML 报告优化设计

### 5.1 优化目标

优化 HuggingFace AI Papers 日报 HTML 报告的信息结构和内容呈现，移除无用模块，增强详情面板的信息密度。

### 5.2 问题背景

当前 HTML 报告存在以下问题：
1. **语言分布无意义** - 论文关注的是研究领域，不是编程语言
2. **详情面板重复** - 展开后内容与列表完全一致，无增量信息
3. **摘要翻译截断** - 450 字符限制导致长摘要显示不完整
4. **缺少论文类型标签** - 无法快速识别综述/工具/研究
5. **排序逻辑单一** - 0 Star 论文无法区分优先级

### 5.3 信息架构调整

```
移除前:
┌─────────────────────────────────────┐
│ [统计卡片区]                         │
├─────────────────────────────────────┤
│ [语言分布] ← 移除                    │
├─────────────────────────────────────┤
│ [AI 深度洞察]                         │
├─────────────────────────────────────┤
│ [论文列表]                           │
└─────────────────────────────────────┘

移除后:
┌─────────────────────────────────────┐
│ [统计卡片区]                         │
├─────────────────────────────────────┤
│ [AI 深度洞察]                         │
├─────────────────────────────────────┤
│ [论文列表] + [类型标签] + [快速操作] │
└─────────────────────────────────────┘
```

### 5.4 详情面板内容设计

**当前问题**: 详情面板只是列表内容的重复

**优化后详情面板包含**:

| 信息类型 | 列表卡片 | 详情面板 |
|---------|---------|---------|
| 标题 | ✅ 显示 | ✅ 显示 |
| Stars | ✅ 显示 | ✅ 显示 |
| 论文类型标签 | ✅ 显示 | ✅ 显示 |
| 作者 | ✅ 显示 | ✅ 显示 |
| 链接 | ✅ 快速链接 | ✅ 完整链接集合 |
| 摘要 | 一句话 (~100 字) | **完整翻译 + 英文原文** |
| 快速操作 | ❌ | ✅ `[arXiv] [PDF] [GitHub] [引用]` |
| BibTeX 引用 | ❌ | ✅ 完整引用格式 |

### 5.5 论文类型判断（规则引擎）

**判断逻辑**:

```javascript
function classifyPaper(paper) {
  const abstract = paper.details.abstract.toLowerCase();
  const title = paper.title.toLowerCase();
  const hasGithub = paper.details.github_links?.length > 0;
  
  // 1. 综述类
  const surveyKeywords = [
    'survey', 'review', 'overview', 'comprehensive', 
    'taxonomy', 'state-of-the-art', 'advances', 'progress',
    'systematic', 'retrospective'
  ];
  
  if (surveyKeywords.some(kw => abstract.includes(kw) || title.includes(kw))) {
    return '综述';
  }
  
  // 2. 工具/系统类
  if (hasGithub && (abstract.includes('implement') || abstract.includes('system') || 
                    abstract.includes('framework') || abstract.includes('tool') ||
                    abstract.includes('library') || abstract.includes('package'))) {
    return '工具';
  }
  
  // 3. 数据集类
  if (abstract.includes('dataset') || abstract.includes('benchmark')) {
    return '数据';
  }
  
  // 4. 默认：研究论文
  return '研究';
}
```

**标签样式**:
```css
.paper-type { 
  background: var(--accent-orange); 
  color: var(--bg-primary); 
  padding: 2px 8px; 
  border-radius: 4px; 
  font-size: 0.6875rem; 
  font-weight: 600;
}
```

### 5.6 摘要处理

**列表卡片** - 一句话摘要:
- 截取前 100-120 字符
- 末尾加 `...`

**详情面板** - 完整摘要:
- 完整中文翻译（分段翻译，无字符限制）
- 英文原文摘要（方便专业读者查证）

### 5.7 BibTeX 引用生成

**格式**:
```bibtex
@article{author_lastname_year,
  title = {论文标题},
  author = {作者 1 and 作者 2 and ...},
  journal = {arXiv preprint},
  volume = {arXiv:xxxx.xxxxx},
  year = {2026}
}
```

**生成逻辑**:
```javascript
function generateBibTeX(paper) {
  const arxivId = paper.paper_url.split('/').pop();
  const year = arxivId.startsWith('26') ? '2026' : '20' + arxivId.substring(0, 2);
  const firstAuthor = paper.authors?.[0]?.split(' ').pop() || 'unknown';
  
  return `@article{${firstAuthor.toLowerCase()}${year.replace('20', '')},
  title = {${paper.title}},
  author = {${paper.authors?.join(' and ') || 'Unknown'}},
  journal = {arXiv preprint},
  volume = {arXiv:${arxivId}},
  year = {${year}}
}`;
}
```

### 5.8 快速操作按钮组

**HTML 结构**:
```html
<div class="quick-actions">
  <a href="${arxivUrl}" target="_blank" class="action-btn">arXiv</a>
  <a href="${pdfUrl}" target="_blank" class="action-btn">PDF</a>
  ${githubLinks.length > 0 ? `<a href="${githubLinks[0]}" target="_blank" class="action-btn">GitHub</a>` : ''}
  <button onclick="copyBibtex()" class="action-btn">引用</button>
</div>
```

**样式**:
```css
.quick-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.action-btn {
  background: var(--accent);
  color: var(--bg-primary);
  padding: 4px 12px;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
}

.action-btn:hover {
  opacity: 0.9;
}
```

### 5.9 排序逻辑优化

**当前逻辑**:
```javascript
// 仅按 Stars 降序，0 Star 在后
papers.sort((a, b) => {
  if (a.stars === 0 && b.stars === 0) return 0;
  if (a.stars === 0) return 1;
  if (b.stars === 0) return -1;
  return b.stars - a.stars;
});
```

**优化后逻辑**:
```javascript
// Stars 优先，同 Star 数时有 GitHub 仓库的在前
papers.sort((a, b) => {
  const starsA = a.stars || 0;
  const starsB = b.stars || 0;
  const hasGithubA = a.details?.github_links?.length > 0;
  const hasGithubB = b.details?.github_links?.length > 0;
  
  // 优先按 Stars 排序
  if (starsA !== starsB) {
    return starsB - starsA;
  }
  
  // Stars 相同，有 GitHub 仓库的优先
  if (hasGithubA && !hasGithubB) return -1;
  if (!hasGithubA && hasGithubB) return 1;
  
  return 0;
});
```

### 5.10 响应式优化

**新增断点**:
```css
@media (max-width: 640px) {
  .stats-grid { 
    grid-template-columns: 1fr; /* 统计卡片单列 */
  }
  
  .paper-details.active { 
    grid-template-columns: 1fr; /* 详情面板单列 */
  }
  
  .paper-header { 
    flex-direction: column; /* 标题和 Stars 堆叠 */
  }
  
  .quick-actions { 
    flex-wrap: wrap; /* 按钮换行 */
  }
}
```

### 5.11 变更文件清单

| 文件 | 变更内容 |
|------|---------|
| `src/generator/paper-html-generator.js` | 1. 移除 `renderLanguageDistribution` 方法 2. 新增 `classifyPaper` 方法 3. 新增 `generateBibTeX` 方法 4. 修改 `renderPaperCard` 增加类型标签和快速操作 5. 修改 `renderHTML` 详情面板内容 6. 优化排序逻辑 |
| `reports/papers/daily/*.html` | 输出格式变更 |

### 5.12 成功标准

- [x] 无"语言分布"模块
- [x] 每篇论文有类型标签（综述/工具/研究/数据）
- [x] 列表卡片显示一句话摘要（~100 字）
- [x] 详情面板包含完整翻译（无截断）
- [x] 详情面板包含英文原文摘要
- [x] 详情面板包含 BibTeX 引用格式
- [x] 详情面板顶部有快速操作按钮组
- [x] 移动端（<640px）布局正常
- [x] 排序逻辑：Stars 降序，同 Star 数有 GitHub 优先

---

## 6. 配置文件

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

## 7. 路径规划

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

## 8. 错误处理

### 8.1 网络错误

- 下载 latest.json 失败 → 重试 3 次，间隔 5 分钟
- LLM API 调用失败 → 使用降级数据（不阻断流程）

### 8.2 数据错误

- JSON 格式错误 → 记录日志，使用缓存数据
- 字段缺失 → 提供默认值

---

## 9. 测试策略

### 9.1 单元测试

- `tests/scraper/paper-downloader.test.js`
- `tests/scraper/papers-scraper.test.js`
- `tests/analyzer/paper-analyzer.test.js`

### 9.2 集成测试

- `tests/integration/papers-workflow.test.js`

---

## 10. 部署

### 10.1 手动运行

```bash
node scripts/run-papers-workflow.js
node scripts/run-papers-workflow.js --no-push  # 不发送通知
```

**注意**: 定时任务需要用户自行在服务器上配置 cron，脚本本身不包含定时功能。

---

## 11. 与现有系统的隔离

| 维度   | GitHub Trending       | HuggingFace Papers     |
| ---- | --------------------- | ---------------------- |
| 数据源  | GitHub Trending API   | latest.json 文件         |
| 存储路径 | data/daily/           | data/papers/daily/     |
| 报告路径 | reports/daily/        | reports/papers/daily/  |
| 脚本   | run-daily-workflow.js | run-papers-workflow.js |
| 配置   | report.{}             | paperReport:{}         |
| 影响范围 | 独立                    | 独立                     |

---

## 12. 后续扩展

### 12.1 可能的增强

- 生成周报/月报聚合
- 邮件推送（除飞书/WeLink 外）
- 微信推送
- Twitter 自动发布

### 12.2 性能优化

- 翻译缓存（避免重复翻译）
- AI 洞察缓存（同一天不重复分析）
- 并行翻译多个 abstract

---

## 13. 参考资料

- 现有日报系统：`src/scraper/strategies/daily-scraper.js`
- 通知模板：`src/notifier/notification-templates.js`
- LLM 工具：`src/utils/llm.js`
- 现有翻译 API: `src/scraper/project-analyzer.js` (translateDescription)

---

## 14. 设计检查清单

- [x] 数据源明确（latest.json）
- [x] 输出层级清晰（HTML > 飞书 > WeLink）
- [x] 过滤阈值定义（Stars > 10）
- [x] 翻译需求明确（abstract → 中文）
- [x] AI 洞察范围明确（仅 HTML）
- [x] 独立性确认（不影响现有系统）
- [x] 错误处理设计
- [x] 测试策略
- [x] 部署说明
- [x] HTML 优化设计完成
- [x] 用户审阅通过

---

**状态**: 设计已完成，实现完毕
