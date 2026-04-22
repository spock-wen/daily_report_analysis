# 首页 Wiki 知识图谱三层展示架构设计

**创建日期**: 2026-04-22  
**状态**: 待实现  

---

## 1. 概述

### 1.1 背景

项目已完成 72 个 GitHub AI 项目的 Wiki 建设和跨项目关联分析。现在需要基于 Wiki 数据构建首页/周报/月报三层展示架构，支持用户快速浏览、增量追踪和深度分析。

### 1.2 目标

构建一个分层的知识图谱展示系统：
- **首页**：轻量级导航，快速浏览热点项目
- **周报**：增量更新，追踪本周新增项目和关联
- **月报**：全量分析，支持多维度筛选和趋势洞察

### 1.3 非目标

- 不重构现有 Wiki 系统
- 不引入外部图数据库（基于内存计算）
- 不支持实时关联计算（采用缓存策略）

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        展示层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   首页      │  │   周报      │  │      月报           │ │
│  │ (轻量级)    │  │ (增量级)    │  │    (全量级)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│                        筛选引擎                              │
│  - 领域筛选（超级领域 → 子领域）                             │
│  - 时间筛选（本月新增/上榜 N 次）                             │
│  - 搜索定位（高亮子图）                                      │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│                      知识图谱引擎                            │
│  - WikiExtractor: Markdown 解析                               │
│  - KnowledgeGraph: 图谱构建与缓存                            │
│  - SimilarityCalculator: 关联分数计算                        │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│                        数据源                                │
│  wiki/projects/*.md (72 个项目) + wiki/domains/*.md (34 个)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 数据流设计

### 3.1 每日流程（日报生成时）

1. 解析新增/更新的 Wiki 文件
2. 更新 `data/wiki-data.json` 中的项目列表
3. 更新 Top 20 项目的关联缓存（`data/cache/hot-projects.json`）
4. 首页自动使用新缓存

### 3.2 每周流程（周报生成时）

1. 提取本周新增项目（首次上榜日期或新版本追加在本周内）
2. 计算新增项目与历史项目的关联
3. 生成周报数据 `data/cache/weekly-graph-YYYY-Www.json`
4. 周报页面加载该文件

### 3.3 每月流程（月报生成时）

1. 全量解析所有 Wiki 文件
2. 全量计算项目关联关系
3. 生成月度数据 `data/cache/monthly-graph-YYYY-MM.json`
4. 生成月度演化分析（对比上月）
5. 月报页面加载完整数据 + 筛选器

---

## 4. 核心模块设计

### 4.1 WikiExtractor

**文件**: `src/wiki/extractors/wiki-extractor.js`

**职责**: 从 Wiki Markdown 文件中提取结构化数据

**输入**: Markdown 文件路径或内容  
**输出**: 结构化项目对象

```javascript
{
  owner: string,           // 项目所有者
  repo: string,            // 项目名
  fullName: string,        // "owner/repo"
  firstSeen: string,       // ISO 日期 "2026-03-08"
  lastSeen: string,        // ISO 日期
  appearances: number,     // 上榜次数
  stars: number,           // Star 数量
  language: string,        // 编程语言
  domains: string[],       // 领域数组 ["agent", "llm"]
  superDomains: string[],  // 超级领域数组 ["ai-application"]
  coreFunctions: string[], // 核心功能描述数组
  relations: {             // 跨项目关联（从表格解析）
    target: string,        // "owner/repo"
    type: string,          // "同领域" | "同技术栈" | "关键词匹配" | "引用关系"
    description: string    // 关联说明
  }[]
}
```

**关键方法**:
- `parseMarkdown(content)`: 解析 Markdown 提取字段
- `parseRelationsTable(content)`: 解析跨项目关联表格
- `mapToSuperDomains(domains)`: 映射到超级领域

---

### 4.2 DomainMapper

**文件**: `src/wiki/config/domain-mapper.js`

**职责**: 从 `wiki/domains/*.md` 读取领域定义，构建领域→超级领域的映射

**实现方式**:
1. 读取 `wiki/domains/` 目录下所有 `.md` 文件
2. 从文件名提取子领域名称（如 `agent.md` → `agent`）
3. 从文件内容提取父级分类（如果有）或基于关键词自动归类
4. 生成 `domainToSuperDomain` 映射表

**超级领域定义**（6 个）:

| 超级领域 | Icon | 包含子领域 |
|---------|------|-----------|
| AI 应用 | 🤖 | agent, ai-agent, multi-agent, rag, memory, finance, browser, android, coding-agent, llm-applications, speech, vision, scientific, trading, chatbot, orchestration |
| AI 基础设施 | ☁️ | llm, ml-framework, inference, performance, cloud, containerization, vertex-ai, generative-ai, machine-learning, education, tutorial, framework, applications, model |
| 多模态 | 🎨 | vision, speech, audio, multimodal, image, video, tts, stt, ocr |
| 开发者工具 | 🛠️ | devtool, dev-tool, developer-tools, cli, plugins, mcp, general, other, security, privacy, sandbox, testing, code-analysis, debugging |
| 数据工程 | 📊 | data-pipeline, etl, data-processing, context-database, knowledge-base, retrieval, data-extraction, pdf, document |
| 安全与隐私 | 🔒 | security, privacy, sandbox, osint, reconnaissance, penetration-testing, cybersecurity, vulnerability |

**注意**: 部分子领域可能属于多个超级领域（如 `vision` 同时属于 AI 应用和多模态），映射时返回第一个匹配的超级领域。

---

### 4.3 KnowledgeGraph

**文件**: `src/wiki/graph/knowledge-graph.js`

**职责**: 构建和维护知识图谱（内存中的图结构）

**数据结构**:
```javascript
class KnowledgeGraph {
  constructor() {
    this.nodes = Map<string, ProjectNode>;  // key: "owner/repo"
    this.edges = Map<string, Edge[]>;       // key: sourceNode, value: target edges
    this.domainIndex = Map<string, Set<string>>;     // domain → project keys
    this.superDomainIndex = Map<string, Set<string>>; // superDomain → project keys
  }
}
```

**关键方法**:
- `build(projects)`: 从项目数组构建完整图谱
- `incrementalUpdate(newProjects, existingProjects)`: 增量更新（只计算新增项目的关联）
- `getNeighbors(projectKey, options)`: 获取指定项目的邻居节点
- `getTopHotProjects(n=20)`: 返回 Top N 热点项目（按 Stars 排序）
- `getProjectsByDomain(domain)`: 按领域筛选项目
- `getProjectsByTimeRange(startDate, endDate)`: 按时间范围筛选
- `searchProject(query)`: 搜索项目（支持模糊匹配）

---

### 4.4 SimilarityCalculator

**文件**: `src/wiki/graph/similarity-calculator.js`

**职责**: 计算两个项目之间的关联分数

**评分规则**:

| 关联类型 | 分数 | 说明 |
|---------|------|------|
| 同领域 | +3 | 领域分类字段重叠（排除 other/general） |
| 同属超级领域 | +1 | 映射后的超级领域相同 |
| 同技术栈 | +2 | 编程语言字段相同 |
| 关键词匹配 | +1~3 | 核心功能文本中的技术关键词重合度 |
| 引用关系 | +2 | 版本历史中提及对方项目 |

**阈值**: 只显示综合分数 ≥ 3 的关联关系

---

### 4.5 FilterEngine

**文件**: `src/wiki/filters/filter-engine.js`

**职责**: 支持多维度项目筛选

**支持的筛选器**（第一期）:

```javascript
{
  // 领域筛选
  superDomain?: string,  // 超级领域
  subDomain?: string,    // 子领域
  
  // 时间筛选
  timeRange?: {
    type: 'thisWeek' | 'thisMonth' | 'custom',
    startDate?: string,
    endDate?: string
  },
  minAppearances?: number,  // 上榜次数 ≥ N
  
  // 搜索定位
  searchQuery?: string,  // 项目名称/所有者模糊搜索
}
```

**返回**: 筛选后的项目数组 + 元数据（总数、各领域分布等）

---

### 4.6 IndexPageGenerator

**文件**: `src/generator/index-page-generator.js`

**职责**: 生成首页 HTML（三栏布局）

**页面结构**:
```
┌────────────────────────────────────────────────────────────┐
│  Header: GitHub AI Trending                                │
├──────────────┬───────────────────────────┬─────────────────┤
│  左栏        │  中栏                     │  右栏           │
│  超级领域    │  面包屑导航               │  关联面板       │
│  导航        │  Top 20 项目卡片网格        │  (点击项目后   │
│  (6 个)      │  (4x5 布局)                │   显示 3 个     │
│              │                           │  相似项目)      │
└──────────────┴───────────────────────────┴─────────────────┘
```

**交互逻辑**:
1. 点击超级领域 → 展开子领域 → 选择子领域 → 显示对应项目
2. 点击项目卡片 → 右栏显示关联项目列表
3. 点击关联项目 → 切换选中状态并更新右栏

---

### 4.7 WeeklyGraphGenerator

**文件**: `src/generator/weekly-graph-generator.js`

**职责**: 生成周报 HTML（增量展示）

**页面板块**:
1. 本周统计概览（新增项目数、AI 占比、新关联数）
2. 本周新增项目列表（按热度排序）
3. 本周新发现的关联关系（表格展示）
4. 局部图谱（Cytoscape.js 渲染本周相关子图）

---

### 4.8 MonthlyGraphGenerator

**文件**: `src/generator/monthly-graph-generator.js`

**职责**: 生成月报 HTML（全量分析）

**页面板块**:
1. 月度统计概览（本月新增、新增关联、平均 Stars 增长）
2. 交互式知识图谱（Cytoscape.js 全量渲染）
3. 筛选器工具栏（领域 + 时间 + 搜索）
4. 月度演化分析（对比上月的变化）
5. 本月 Top 项目（Stars 增长排名）

---

## 5. 缓存策略

### 5.1 缓存文件结构

```
data/
├── wiki-data.json              # 全量 Wiki 数据（增量更新）
└── cache/
    ├── hot-projects.json       # Top 20 热点 + 关联缓存
    ├── weekly-graph-YYYY-Www.json  # 周报数据
    ├── monthly-graph-YYYY-MM.json  # 月报数据
    └── domain-index.json       # 领域索引缓存
```

### 5.2 缓存更新策略

| 缓存文件 | 更新频率 | 触发条件 |
|---------|---------|---------|
| hot-projects.json | 每日 | 日报生成后 |
| weekly-graph-*.json | 每周 | 周报生成时 |
| monthly-graph-*.json | 每月 | 月报生成时 |
| domain-index.json | 每周 | 领域变化时 |

---

## 6. 集成点

### 6.1 与现有代码的集成

| 现有模块 | 集成方式 | 说明 |
|---------|---------|------|
| `src/scraper/report-pipeline.js` | 调用 WikiExtractor | 报告生成后触发 Wiki 解析 |
| `src/wiki/wiki-manager.js` | 复用读取逻辑 | 获取项目 Wiki 内容 |
| `src/wiki/cross-reference.js` | 合并到 SimilarityCalculator | 相似度计算逻辑 |
| `scripts/generate-index.js` | 替换为 IndexPageGenerator | 首页生成 |
| `src/scraper/aggregators/monthly-aggregator.js` | 调用 MonthlyGraphGenerator | 月报汇总 |

### 6.2 新增文件列表

```
src/
├── wiki/
│   ├── config/
│   │   └── domain-mapper.js         # 领域映射
│   ├── extractors/
│   │   └── wiki-extractor.js        # Wiki 解析器
│   ├── graph/
│   │   ├── knowledge-graph.js       # 知识图谱
│   │   └── similarity-calculator.js # 相似度计算
│   └── filters/
│       └── filter-engine.js         # 筛选引擎
└── generator/
    ├── index-page-generator.js      # 首页生成
    ├── weekly-graph-generator.js    # 周报生成
    └── monthly-graph-generator.js   # 月报生成
```

---

## 7. 测试策略

### 7.1 单元测试

- `WikiExtractor.parseMarkdown()`: 验证字段提取正确性
- `DomainMapper.mapToSuperDomain()`: 验证领域映射准确性
- `SimilarityCalculator.calculate()`: 验证评分规则
- `FilterEngine.filter()`: 验证筛选逻辑

### 7.2 集成测试

- 运行完整日报流程，验证首页生成正确
- 模拟周报生成，验证增量更新逻辑
- 模拟月报生成，验证全量图谱构建

### 7.3 性能基准

- 首页加载时间 < 1 秒
- 周报加载时间 < 3 秒
- 月报加载时间 < 10 秒（可接受）

---

## 8. 验证清单

实现完成后，逐项验证：

- [ ] 首页能正确显示 6 个超级领域导航
- [ ] Top 20 项目按 Stars 排序
- [ ] 点击项目显示 3 个关联项目（表格中的关联）
- [ ] 领域筛选能正确过滤项目
- [ ] 时间筛选能筛选本周/本月新增
- [ ] 搜索能定位到指定项目
- [ ] 周报显示本周新增项目
- [ ] 周报显示新发现的关联关系
- [ ] 月报显示完整知识图谱
- [ ] 缓存文件正确生成和更新

---

## 9. 实施路线图

### Phase 1: 基础设施（Week 1）
- [ ] 实现 `DomainMapper`
- [ ] 实现 `WikiExtractor`
- [ ] 实现 `KnowledgeGraph`
- [ ] 单元测试

### Phase 2: 首页功能（Week 2）
- [ ] 实现 `IndexPageGenerator`
- [ ] 集成到日报流程
- [ ] 手动验证首页效果

### Phase 3: 周报功能（Week 3）
- [ ] 实现 `WeeklyGraphGenerator`
- [ ] 增量更新逻辑
- [ ] 周报页面验证

### Phase 4: 月报功能（Week 4）
- [ ] 实现 `MonthlyGraphGenerator`
- [ ] 筛选引擎集成
- [ ] 月报页面验证

### Phase 5: 性能优化（Week 5）
- [ ] 缓存策略优化
- [ ] 加载时间 benchmark
- [ ] 按需计算优化

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 领域映射不准确 | 中 | 允许手动调整映射配置 |
| 关联计算耗时过长 | 高 | 增量计算 + 缓存策略 |
| 月报图谱过于复杂 | 中 | 分层展开 + 聚合节点 |
| CDN 资源加载失败 | 低 | 本地 fallback 或纯 CSS 版本 |

---

## 11. 附录：Wiki 字段解析规则

### 基本信息提取

```markdown
# owner/repo

## 基本信息
- 首次上榜：2026-03-08
- 最近上榜：2026-03-16
- 上榜次数：5
- 领域分类：llm, agent
- 语言：Python
- GitHub Stars: 55951（最后更新：2026-04-18）
```

**提取规则**:
- `owner/repo`: 从标题行提取
- `firstSeen`: "首次上榜"字段
- `lastSeen`: "最近上榜"字段
- `appearances`: "上榜次数"字段
- `domains`: "领域分类"字段，逗号分隔
- `language`: "语言"字段
- `stars`: "GitHub Stars"字段的数字部分

### 跨项目关联表格提取

```markdown
## 跨项目关联

| 项目 | 关联类型 | 说明 |
|------|----------|------|
| QwenLM/Qwen-Agent | 同领域 | LLM · Agent 框架 |
| volcengine/OpenViking | 引用关系 | 被引用 |
```

**提取规则**:
- 定位 `## 跨项目关联` 章节
- 解析 Markdown 表格
- 每行生成一个关联对象
