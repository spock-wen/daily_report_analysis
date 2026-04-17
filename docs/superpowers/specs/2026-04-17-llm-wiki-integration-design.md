# LLM Wiki 集成设计

**日期**: 2026-04-17  
**状态**: 已批准  
**触发**: 基于 Karpathy LLM Wiki 理念的集成设计

---

## 1. 概述

### 1.1 目标

将 Karpathy 的 LLM Wiki 理念集成到当前 AI 趋势报告系统中，实现：

- **A1: 更结构化的分析输入** - 为每个 GitHub 项目/HF 论文建立 Wiki 页面，LLM 分析时参考历史 Wiki 内容，产生更连贯的洞察
- **B3: 对内 + 对外知识库** - 对内作为报告系统的"记忆"，对外作为独立可访问的项目知识库网站

### 1.2 核心设计原则

1. **简单优先** - 纯 Markdown 文件，可版本控制，易于迭代
2. **版本追加** - Wiki 内容只追加不修改，保留历史演变轨迹
3. **双向增强** - Wiki 为分析提供上下文，报告为 Wiki 提供来源

---

## 2. 目录结构

```
项目根目录/
├── wiki/                          # 新增：Wiki 知识库
│   ├── projects/                  # GitHub 项目 Wiki
│   │   ├── 666ghj_MiroFish.md
│   │   ├── QwenLM_Qwen-Agent.md
│   │   └── ...
│   ├── papers/                    # 论文 Wiki
│   │   ├── 2601.12345.md
│   │   ├── 2602.00123.md
│   │   └── ...
│   └── domains/                   # 领域 Wiki（跨项目聚合）
│       ├── agent.md
│       ├── rag.md
│       ├── llm-tool.md
│       └── speech.md
├── src/
│   ├── wiki/                      # 新增：Wiki 模块
│   │   ├── wiki-manager.js        # Wiki 读写管理
│   │   ├── wiki-templates.js      # Wiki 模板定义
│   │   └── cross-reference.js     # 跨项目关联分析
│   ├── generator/
│   │   ├── html-generator.js      # 修改：使用 Wiki 数据
│   │   ├── wiki-index-generator.js    # 新增：Wiki 索引页
│   │   └── comparison-generator.js    # 新增：项目对比页
│   └── analyzer/
│       └── project-analyzer.js    # 修改：分析时读取 Wiki
└── reports/
    ├── wiki-index.html            # 新增：Wiki 索引页
    ├── comparison.html            # 新增：项目对比页
    └── ...
```

---

## 3. Wiki 文件格式

### 3.1 GitHub 项目 Wiki

```markdown
# {owner}/{repo}

## 基本信息
- 首次上榜：YYYY-MM-DD
- 最近上榜：YYYY-MM-DD
- 上榜次数：N
- 领域分类：Agent/RAG/LLM/...
- 语言：Python/TypeScript/...
- GitHub Stars: N,NNN（最后更新：YYYY-MM-DD）

## 核心功能
（LLM 生成，随时间更新）
- 功能点 1
- 功能点 2
- ...

## 版本历史

### YYYY-MM-DD（事件类型）
**来源**: [报告名称](../../reports/.../xxx.html)
**分析**: LLM 生成的分析内容，描述该项目本次上榜的特点、变化或意义...

## 跨项目关联
- 相似项目：[owner/repo](link.md)、[owner/repo](link.md)
- 技术栈：基于 XXX + YYY
- 被用于：[owner/repo](link.md)
```

### 3.2 论文 Wiki

```markdown
# [论文标题]

## 基本信息
- arXiv ID: 2XXX.XXXXX
- 发布日期：YYYY-MM-DD
- 首次收录：YYYY-MM-DD
- 论文类型：Survey/Tool/Research/Dataset
- 领域分类：LLM/RAG/Agent/...

## 作者与机构
- 第一作者：XXX (University/Company)
- 共同作者：...

## 核心贡献
（LLM 生成）
- 贡献点 1
- 贡献点 2
- ...

## GitHub 实现
- 官方代码：https://github.com/xxx/xxx
- 社区实现：...

## 收录分析
**来源**: [Papers 日报 YYYY-MM-DD](../../reports/papers/daily/papers-YYYY-MM-DD.html)
**AI 分析**: ...

## 跨论文关联
- 引用论文：[arXiv:XXXX.XXXXX](link.md)
- 被引用：[arXiv:XXXX.XXXXX](link.md)（后续论文引用时更新）
- 相关工作：...

## BibTeX
```bibtex
@article{xxx2023title,
  title={...},
  author={...},
  journal={arXiv preprint arXiv:XXXX.XXXXX},
  year={2023}
}
```
```

### 3.3 领域 Wiki

```markdown
# {领域名称} 领域

## 领域概览
{LLM 生成的领域概述，描述该领域的热度和发展趋势}

## 代表项目（按 Stars 排序）
| 项目 | 首次上榜 | 上榜次数 | Stars |
|------|----------|----------|-------|
| owner/repo | YYYY-MM-DD | N | N,NNN |
| ... | ... | ... | ... |

## 趋势演变
- YYYY-MM：阶段描述
- YYYY-MM：阶段描述
- ...

## 相关项目
[project1.md](../projects/project1.md)
[project2.md](../projects/project2.md)
...
```

---

## 4. 核心模块设计

### 4.1 Wiki Manager (`src/wiki/wiki-manager.js`)

```javascript
class WikiManager {
  /**
   * 读取项目 Wiki（如果不存在则创建）
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @returns {Promise<Object>} Wiki 内容和元数据
   */
  async getOrCreateWiki(owner, repo);

  /**
   * 读取论文 Wiki（如果不存在则返回 null）
   * @param {string} arxivId - arXiv ID
   * @returns {Promise<Object|null>}
   */
  async getPaperWiki(arxivId);

  /**
   * 追加版本记录（GitHub 项目）
   * @param {string} wikiPath - Wiki 文件路径
   * @param {Object} versionData - 版本数据
   */
  async appendVersion(wikiPath, versionData);

  /**
   * 创建论文 Wiki（一次性）
   * @param {string} wikiPath - Wiki 文件路径
   * @param {Object} paperData - 论文数据
   */
  async createPaperWiki(wikiPath, paperData);

  /**
   * 更新基本信息（上榜次数、最近日期等）
   * @param {string} wikiPath - Wiki 文件路径
   * @param {Object} newData - 新数据
   */
  async updateBasicInfo(wikiPath, newData);

  /**
   * 扫描所有 Wiki 获取跨项目关联
   * @param {Object} project - 当前项目
   * @returns {Promise<Array>} 关联项目列表
   */
  async findRelatedProjects(project);

  /**
   * 更新跨论文关联（被引用时）
   * @param {string} citedArxivId - 被引用的论文 ID
   * @param {string} citingArxivId - 引用方的论文 ID
   */
  async addCitationLink(citedArxivId, citingArxivId);
}
```

### 4.2 Wiki Templates (`src/wiki/wiki-templates.js`)

```javascript
const WIKI_TEMPLATES = {
  // GitHub 项目 Wiki 模板
  project: `# {owner}/{repo}

## 基本信息
- 首次上榜：{firstSeen}
- 最近上榜：{lastSeen}
- 上榜次数：{appearances}
- 领域分类：{domain}
- 语言：{language}
- GitHub Stars: {stars}

## 核心功能
{coreFunctions}

## 版本历史
{versionHistory}

## 跨项目关联
{crossReferences}
`,

  // 论文 Wiki 模板
  paper: `# {title}

## 基本信息
- arXiv ID: {arxivId}
- 发布日期：{publishDate}
- 首次收录：{firstRecorded}
- 论文类型：{paperType}
- 领域分类：{domain}

## 作者与机构
{authors}

## 核心贡献
{contributions}

## GitHub 实现
{githubLinks}

## 收录分析
{analysis}

## 跨论文关联
{crossReferences}

## BibTeX
\`\`\`bibtex
{bibtex}
\`\`\`
`,

  // 领域 Wiki 模板
  domain: `# {domainName} 领域

## 领域概览
{overview}

## 代表项目（按 Stars 排序）
{projectTable}

## 趋势演变
{trendEvolution}

## 相关项目
{relatedProjects}
`
};
```

### 4.3 Cross Reference (`src/wiki/cross-reference.js`)

```javascript
class CrossReferenceAnalyzer {
  /**
   * 基于 Wiki 内容检测相似项目
   * @param {string} currentProject - 当前项目
   * @param {Array} allWikis - 所有 Wiki 内容
   * @returns {Array} 相似项目列表
   */
  findSimilarProjects(currentProject, allWikis);

  /**
   * 从论文 BibTeX 中提取引用关系
   * @param {string} bibtex - BibTeX 内容
   * @returns {Array} arXiv ID 列表
   */
  extractCitationsFromBibTeX(bibtex);

  /**
   * 基于关键词检测领域内项目
   * @param {string} domain - 领域名称
   * @param {Array} allWikis - 所有 Wiki 内容
   * @returns {Array} 领域内项目列表
   */
  getProjectsByDomain(domain, allWikis);
}
```

---

## 5. 工作流程集成

### 5.1 日报流程（增强版）

```
1. 抓取 GitHub Trending Daily
    ↓
2. 解析 HTML 提取项目信息
    ↓
3. GitHub API 增强（获取详细星数、fork、语言等）
    ↓
4. 【新增】读取/创建 Wiki → 获取历史上下文
    ├── 如果 Wiki 存在：读取历史数据，提供分析上下文
    └── 如果 Wiki 不存在：创建新 Wiki（基本信息 + 首次版本）
    ↓
5. 项目分析（参考 Wiki 历史内容）
    ├── 对比历史功能，识别新变化
    ├── 更新跨项目关联
    └── 生成更连贯的分析
    ↓
6. AI 分析生成洞察
    ↓
7. 【新增】更新 Wiki（版本追加）
    ├── 更新基本信息（上榜次数 +1，更新最近上榜日期）
    ├── 追加版本历史记录
    └── 更新跨项目关联
    ↓
8. 生成 HTML 报告（使用 Wiki 数据增强）
    ├── 显示累计星数、上榜次数
    ├── 显示"历史洞察"模块
    └── 链接到完整 Wiki 页面
    ↓
9. 自动更新首页
```

### 5.2 周报流程（增强版）

```
1. 抓取 GitHub Trending Weekly
    ↓
2. 解析 HTML 提取项目信息
    ↓
3. GitHub API 增强
    ↓
4. 项目分析（参考 Wiki）
    ↓
5. 加载上周 7 天的日报数据
    ↓
6. 【新增】从 Wiki 加载历史趋势数据
    ↓
7. AI 分析（周度主题 + 深度趋势分析）
    ↓
8. 【新增】更新相关项目的 Wiki
    ↓
9. 生成 HTML 报告（使用 Wiki 数据）
    ├── 新增「Wiki 深度分析」模块
    ├── 显示「持续霸榜项目」列表
    └── 领域趋势图表（基于领域 Wiki）
    ↓
10. 自动更新首页
```

### 5.3 月报流程（增强版）

```
1. 加载整月日报数据（约 30 天）
    ↓
2. 加载整月周报数据（4-5 周）
    ↓
3. 【新增】扫描所有项目 Wiki 获取聚合数据
    ↓
4. 数据聚合与去重
    ↓
5. 计算聚合统计
    ↓
6. 计算趋势演变（上/中/下旬三段式）
    ↓
7. AI 深度分析
    ↓
8. 【新增】更新 TOP 项目的 Wiki（月报评测版本）
    ↓
9. 生成 HTML 报告（使用 Wiki 数据）
    ├── 领域分布图表
    ├── 项目对比功能入口
    └── 链接到 Wiki 索引页
    ↓
10. 自动更新首页
```

### 5.4 Papers 日报流程（增强版）

```
1. 下载 HuggingFace latest.json
    ↓
2. 解析论文信息（标题、作者、摘要、GitHub 链接等）
    ↓
3. 【新增】检查 Wiki 是否存在
    ├── 已存在：跳过（论文不重复收录）
    └── 不存在：创建新 Wiki
    ↓
4. 论文分类（综述/工具/研究/数据集）
    ↓
5. 摘要翻译（中英对照）
    ↓
6. 生成 BibTeX 引用
    ↓
7. 【新增】从 BibTeX 提取引用关系
    ├── 检测引用的已收录论文
    └── 更新被引用论文的 Wiki（添加"被引用"关联）
    ↓
8. AI 分析生成洞察
    ↓
9. 【新增】创建论文 Wiki（一次性）
    ↓
10. 生成 HTML 报告（使用 Wiki 数据）
    ├── 显示"收录状态"
    ├── 显示"引用关联"模块
    └── 链接到论文 Wiki
    ↓
11. 推送到飞书/WeLink（可选）
```

---

## 6. HTML 报告增强设计

### 6.1 日报 HTML 增强

**新增字段展示：**
```html
<div class="project-card">
  <h3>666ghj/MiroFish</h3>
  <div class="stats">
    <span>今日星数：+1,234</span>
    <span>累计星数：15,234（总增长 +12,000）</span>
    <span>上榜次数：第 8 次上榜 ⭐</span>
    <span>趋势：↗ 持续上升（首次上榜：2026-04-01）</span>
  </div>
  <div class="insight">
    <strong>💡 历史洞察：</strong>
    该项目已从单一预测工具演进为多智能体协作平台...
  </div>
  <a href="../../wiki/projects/666ghj_MiroFish.md" class="wiki-link">
    查看完整 Wiki →
  </a>
</div>
```

### 6.2 周报/月报 HTML 增强

**新增「Wiki 深度分析」模块：**
```html
<section class="wiki-deep-analysis">
  <h2>📊 Wiki 项目追踪</h2>
  <div class="tracking-grid">
    <div class="project-track">
      <h4>666ghj/MiroFish</h4>
      <p>上榜次数：8 | 累计星数：15,234</p>
      <p>演变：预测工具 → 多智能体平台</p>
      <a href="...">查看完整 Wiki</a>
    </div>
    <!-- 更多项目... -->
  </div>
</section>
```

### 6.3 领域趋势图表

```html
<section class="domain-trends">
  <h2>📈 领域分布趋势</h2>
  <div class="trend-bar" data-domain="agent">
    <span>Agent</span>
    <div class="bar" style="width: 42%"></div>
    <span>35% → 42% ↗</span>
  </div>
  <!-- 更多领域... -->
  <p class="source">数据来源：wiki/domains/ 领域聚合</p>
</section>
```

---

## 7. 新增页面

### 7.1 Wiki 索引页 (`reports/wiki-index.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <title>AI Project Wiki - 索引</title>
  <link rel="stylesheet" href="../public/css/wiki-index.css">
</head>
<body>
  <header>
    <h1>📚 AI Project Wiki</h1>
    <p>由 LLM 驱动的项目知识库</p>
  </header>

  <section class="search-section">
    <input type="text" id="search" placeholder="🔍 搜索项目或论文...">
  </section>

  <section class="domain-nav">
    <h2>领域导航</h2>
    <div class="domain-grid">
      <a href="domains/agent.html" class="domain-card">
        <h3>🤖 Agent</h3>
        <p>245 个项目</p>
      </a>
      <a href="domains/rag.html" class="domain-card">
        <h3>🔍 RAG</h3>
        <p>89 个项目</p>
      </a>
      <!-- 更多领域... -->
    </div>
  </section>

  <section class="trending">
    <h2>📈 Trending 项目（24h）</h2>
    <ol>
      <li>666ghj/MiroFish <span>+1,234 ⭐</span></li>
      <li>XXX/NewAgent <span>+987 ⭐</span></li>
    </ol>
  </section>

  <section class="latest-papers">
    <h2>📄 最新收录论文</h2>
    <ul>
      <li>[2604.12345] LLM 推理优化方法</li>
      <li>[2604.01234] RAG 检索新 SOTA</li>
    </ul>
  </section>

  <section class="stats">
    <h2>📊 统计</h2>
    <div class="stats-grid">
      <div class="stat">收录项目：287 个</div>
      <div class="stat">收录论文：312 篇</div>
      <div class="stat">Wiki 条目：599 个</div>
      <div class="stat">领域：8 个</div>
    </div>
  </section>
</body>
</html>
```

### 7.2 项目对比页 (`reports/comparison.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <title>项目对比</title>
  <link rel="stylesheet" href="../public/css/comparison.css">
</head>
<body>
  <header>
    <h1>🆚 项目对比</h1>
  </header>

  <section class="selector">
    <label>项目 A:
      <select id="project-a">
        <option value="666ghj_MiroFish">666ghj/MiroFish</option>
        <!-- 更多选项... -->
      </select>
    </label>
    <label>项目 B:
      <select id="project-b">
        <option value="QwenLM_Qwen-Agent">QwenLM/Qwen-Agent</option>
        <!-- 更多选项... -->
      </select>
    </label>
    <button onclick="compare()">对比</button>
  </section>

  <section class="comparison-result" id="result">
    <table class="metrics-table">
      <thead>
        <tr>
          <th>指标</th>
          <th>MiroFish</th>
          <th>Qwen-Agent</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>首次上榜</td>
          <td>2026-04-01</td>
          <td>2026-03-15</td>
        </tr>
        <tr>
          <td>上榜次数</td>
          <td>8</td>
          <td>12</td>
        </tr>
        <tr>
          <td>累计星数</td>
          <td>15,234</td>
          <td>28,456</td>
        </tr>
        <tr>
          <td>月增星数</td>
          <td>+12,000</td>
          <td>+8,500</td>
        </tr>
        <tr>
          <td>社区活跃</td>
          <td>极高</td>
          <td>高</td>
        </tr>
      </tbody>
    </table>

    <div class="tech-comparison">
      <h3>技术对比</h3>
      <div class="comparison-text">
        <div class="project-a-text">
          <strong>MiroFish:</strong> 零依赖，轻量级，快速迭代
        </div>
        <div class="project-b-text">
          <strong>Qwen-Agent:</strong> 大厂支持，功能全面，文档完善
        </div>
      </div>
    </div>
  </section>
</body>
</html>
```

---

## 8. 对外发布设计

### 8.1 静态网站生成

Wiki 目录可以独立作为一个静态网站发布：

```
wiki/ (Markdown 源文件)
  ↓ (Markdown → HTML)
dist/wiki/ (静态 HTML)
  ├── projects/
  ├── papers/
  ├── domains/
  ├── index.html
  ├── comparison.html
  └── search.html
```

### 8.2 技术选型建议

- **简单方案**: 使用现有 HTML generator 转换 Markdown
- **增强方案**: 使用 VitePress 或 Docusaurus 提供搜索、导航功能

### 8.3 URL 结构

```
https://wiki.wenspock.site/
├── projects/666ghj_MiroFish
├── papers/2604.01234
├── domains/agent
└── comparison?a=666ghj_MiroFish&b=QwenLM_Qwen-Agent
```

---

## 9. 数据规模估算

| 类型 | 每日增量 | 月增量 | 年增量 |
|------|----------|--------|--------|
| 项目 Wiki | ~10 个 | ~250-300 个 | ~3,000 个 |
| 论文 Wiki | ~10-20 篇 | ~300-500 篇 | ~5,000 篇 |
| 领域 Wiki | - | 8-10 个 | 8-10 个 |
| 总 Wiki 条目 | ~20-30 | ~560-810 | ~8,000+ |

---

## 10. 历史数据迁移（新增）

### 10.1 背景

系统已积累约 27 天的日报数据（`data/insights/daily/*.json`），包含：
- 每日热点项目分析（hot 数组）
- AI 行动建议（action 数组）
- 热度指数（hypeIndex）

为充分利用历史数据，需批量生成初始 Wiki，而非从零开始。

### 10.2 迁移策略

**Phase 0: 历史数据迁移**

1. **扫描** - 读取 `data/insights/daily/*.json` 所有文件
2. **聚合** - 按项目名（owner/repo）聚合历史数据：
   - 首次上榜日期
   - 上榜次数
   - 每次上榜的热点描述
   - 相关分析内容
3. **生成** - 为每个项目创建初始 Wiki Markdown 文件
4. **输出** - `wiki/projects/{owner}_{repo}.md`

### 10.3 迁移脚本

```javascript
// scripts/migrate-json-to-wiki.js
const projectHistory = new Map();

// 聚合所有日报数据
for (const dailyFile of dailyFiles) {
  const data = JSON.parse(readFile(dailyFile));
  for (const hotItem of data.hot) {
    const repo = extractRepoName(hotItem); // "666ghj/MiroFish"
    projectHistory.get(repo).dates.push(dailyFile.date);
    projectHistory.get(repo).hotTexts.push(hotItem);
  }
}

// 生成 Wiki
for (const [repo, history] of projectHistory) {
  const wikiContent = generateProjectWiki(repo, history);
  writeFile(`wiki/projects/${repo.replace('/', '_')}.md`, wikiContent);
}
```

### 10.4 预期结果

- 生成约 200-300 个项目 Wiki
- 每个 Wiki 包含完整历史版本记录
- 霸榜项目（如 666ghj/MiroFish）将有 20+ 条版本历史

---

## 11. 实施计划

实施计划将通过 writing-plans skill 另行制定。

---

## 12. 验收标准

---

## 11. 验收标准

1. **Wiki 创建** - GitHub 项目和 HF 论文均能自动创建 Wiki 文件
2. **版本追加** - 项目 Wiki 正确追加版本历史，不覆盖旧内容
3. **关联更新** - 论文被引用时，被引用方 Wiki 正确更新
4. **报告增强** - HTML 报告显示 Wiki 数据（累计星数、上榜次数等）
5. **索引页面** - Wiki 索引页和项目对比页可正常访问
6. **分析改进** - AI 分析内容体现出对 Wiki 历史的使用
