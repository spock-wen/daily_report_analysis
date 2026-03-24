# 月报重构设计文档

**日期：** 2026-03-24
**状态：** 已批准
**实现优先级：** 高

---

## 1. 背景与目标

### 1.1 当前问题

现有月报功能存在以下问题：

1. **数据源单一**：仅抓取 GitHub Trending Monthly 榜单（约 10 个项目），不是真正的月度汇总
2. **未利用积累数据**：没有利用已有的日报（~20 天）和周报数据
3. **分析维度浅**：AI 提示词简单，没有月度特有的深度分析
4. **内容架构雷同**：与日报/周报差异不大，没有体现"月度"的深度

### 1.2 重构目标

将月报重构为**深度分析型行业报告**，特点包括：

- **数据聚合**：整合整月日报（30 天）+ 周报（4-5 周）+ GitHub 月榜
- **趋势洞察**：识别上/中/下旬的技术主题演变
- **专业品质**：适合公开发布到公众号/博客等平台
- **可视化增强**：使用 Chart.js 实现专业图表

---

## 2. 需求规格

### 2.1 数据需求

| 数据源 | 用途 | 优先级 |
|--------|------|--------|
| 日报数据（30 天） | 趋势演变分析、重复上榜统计 | P0 |
| 周报数据（4-5 周） | 周度主题对比、深度趋势补充 | P0 |
| GitHub 月榜 | 补充参考、交叉验证 | P1 |

### 2.2 功能需求

| 功能模块 | 描述 | 优先级 |
|----------|------|--------|
| 数据聚合 | 加载并去重整月项目数据 | P0 |
| 统计计算 | 重复上榜项目、月度新星、领域分布等 | P0 |
| AI 分析 | 月度主题、趋势演变、TOP 项目评测 | P0 |
| HTML 生成 | 专业报告风格模板 | P0 |
| 图表渲染 | 饼图、柱状图、趋势图（Chart.js） | P1 |
| 推送通知 | 月度报告摘要推送 | P2 |

### 2.3 非功能需求

- **报告长度**：2000-3000 字深度分析
- **可视化**：至少包含 3 种图表（领域分布、语言 TOP5、趋势演变）
- **性能**：月报生成时间 < 5 分钟
- **可维护性**：代码结构清晰，有完整注释

---

## 3. 系统设计

### 3.1 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    MonthlyWorkflow                       │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ MonthlyAggregator │  │  GitHubScraper   │            │
│  │  (数据聚合模块)   │  │   (月榜抓取)      │            │
│  └────────┬─────────┘  └────────┬─────────┘            │
│           │                     │                       │
│           └──────────┬──────────┘                       │
│                      │                                  │
│           ┌──────────▼──────────┐                       │
│           │  MonthlyAnalyzer    │                       │
│           │   (AI 分析模块)      │                       │
│           └──────────┬──────────┘                       │
│                      │                                  │
│           ┌──────────▼──────────┐                       │
│           │ MonthlyGenerator    │                       │
│           │  (HTML 生成模块)     │                       │
│           └──────────┬──────────┘                       │
│                      │                                  │
│           ┌──────────▼──────────┐                       │
│           │  ChartRenderer      │                       │
│           │   (图表渲染)        │                       │
│           └─────────────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

### 3.2 数据结构

#### 3.2.1 月报聚合数据

```javascript
{
  month: "2026-03",                    // 月份标识
  generatedAt: "2026-03-31T10:00:00Z", // 生成时间

  // 原始数据
  dailyDataList: [                     // 30 天日报数据
    { date: "2026-03-01", projects: [...] },
    ...
  ],
  weeklyDataList: [                    // 4-5 周周报数据
    { weekStart: "2026-W09", projects: [...] },
    ...
  ],
  monthlyTrending: [...],              // GitHub 月榜数据

  // 聚合统计
  aggregation: {
    totalProjects: 300,                // 去重后项目总数
    recurringProjects: [               // 重复上榜项目（>=2 次）
      { repo: "owner/repo", count: 5, dates: [...] },
      ...
    ],
    newProjects: [                     // 本月新星（首次出现且增长快）
      { repo: "owner/repo", firstSeen: "...", starsGained: 1000 },
      ...
    ],
    typeDistribution: {                // 领域分布
      agent: 45, llm: 25, vision: 15, speech: 10, other: 5
    },
    languageDistribution: {            // 语言分布
      Python: 35, TypeScript: 25, Go: 15, Rust: 10, Other: 15
    },
    topGainers: [...],                 // 星数增长最快 TOP10
    topConsistent: [...]               // 持续霸榜项目 TOP10
  }
}
```

#### 3.2.2 AI 洞察数据

```javascript
{
  monthlyTheme: {
    oneLiner: "一句话总结本月核心趋势（50 字以内）",
    detailed: "详细解读（500-800 字，有数据支撑）"
  },

  trendEvolution: [
    {
      period: "上旬",
      dates: "2026-03-01 ~ 2026-03-10",
      theme: "阶段主题",
      keyProjects: ["owner/repo1", "owner/repo2"],
      analysis: "阶段分析（200-300 字）"
    },
    { period: "中旬", ... },
    { period: "下旬", ... }
  ],

  longTermValue: [                     // 月度 TOP 项目（综合评分 3-5 个）
    {
      repo: "owner/repo",
      category: "技术创新 | 持续热门 | 企业价值",
      score: 95,                       // 综合评分
      reasons: ["入选理由 1", "入选理由 2"],
      value: "核心价值描述",
      sustainability: "高 | 中 | 低"
    }
  ],

  emergingFields: [                    // 新兴领域
    {
      field: "领域名称",
      description: "领域描述（50 字以内）",
      projects: ["owner/repo1", "owner/repo2"],
      trend: "上升 | 稳定 | 下降"
    }
  ],

  darkHorse: {                         // 月度黑马
    repo: "owner/repo",
    reason: "入选理由"
  },

  nextMonthForecast: "下月趋势预测（200-300 字）"
}
```

### 3.3 模块设计

#### 3.3.1 MonthlyAggregator

**文件：** `src/scraper/aggregators/monthly-aggregator.js`

**职责：** 加载并聚合整月数据

**核心方法：**
```javascript
class MonthlyAggregator {
  async aggregate(month)           // 主入口：聚合指定月份数据
  async loadDailyData(month)       // 加载日报数据
  async loadWeeklyData(month)      // 加载周报数据
  computeAggregation(allProjects)  // 计算聚合统计
  deduplicateProjects(projects)    // 项目去重
  findRecurringProjects(projects)  // 查找重复上榜项目
  findNewProjects(projects)        // 查找月度新星
  computeTypeDistribution(projects)// 计算领域分布
  computeLanguageDistribution(projects) // 计算语言分布
}
```

#### 3.3.2 MonthlyAnalyzer

**文件：** `src/analyzer/monthly-analyzer.js`

**职责：** AI 深度分析

**核心方法：**
```javascript
class MonthlyAnalyzer {
  async analyze(monthlyData)       // 主入口：执行分析
  buildPrompt(data)                // 构建 AI 提示词
  parseInsights(response)          // 解析 AI 响应
  computeCompositeScore(project)   // 计算综合评分
}
```

**AI 提示词模板：**
```
请分析以下月度 GitHub Trending 数据，生成一份深度分析报告。

月份：{month}
数据周期：{dailyCount}天日报 + {weeklyCount}周周报
总项目数（去重）：{totalProjects}

【聚合统计数据】
- 重复上榜项目：{recurringCount}个
- 本月新星项目：{newProjectsCount}个
- 领域分布：{typeDistribution}
- 语言分布：{languageDistribution}

【趋势演变数据】
- 上旬项目：{firstHalfProjects}
- 中旬项目：{midHalfProjects}
- 下旬项目：{lastHalfProjects}

【TOP 项目候选】
{topProjectCandidates}

请按以下 JSON 格式输出：
{
  "monthlyTheme": { "oneLiner": "...", "detailed": "..." },
  "trendEvolution": [
    { "period": "上旬", "theme": "...", "keyProjects": [...], "analysis": "..." },
    { "period": "中旬", ... },
    { "period": "下旬", ... }
  ],
  "longTermValue": [
    { "repo": "...", "category": "...", "score": 95, "reasons": [...], "value": "...", "sustainability": "..." }
  ],
  "emergingFields": [...],
  "darkHorse": { "repo": "...", "reason": "..." },
  "nextMonthForecast": "..."
}
```

#### 3.3.3 MonthlyGenerator

**文件：** `src/generator/monthly-generator.js`

**职责：** 生成 HTML 报告

**核心方法：**
```javascript
class MonthlyGenerator {
  async generate(monthlyData)      // 主入口：生成 HTML
  renderOverview(aggregation)      // 渲染月度概览
  renderTheme(monthlyTheme)        // 渲染月度主题
  renderTrendEvolution(trendEvolution) // 渲染趋势演变
  renderLongTermValue(topProjects) // 渲染 TOP 项目
  renderEmergingFields(fields)     // 渲染新兴领域
  renderCharts(aggregation)        // 渲染图表容器
}
```

#### 3.3.4 ChartRenderer

**文件：** `src/generator/chart-renderer.js`

**职责：** 渲染 Chart.js 图表

**依赖：** Chart.js (CDN 引入)

**核心方法：**
```javascript
class ChartRenderer {
  renderPieChart(ctx, data, options)     // 饼图
  renderBarChart(ctx, data, options)     // 柱状图
  renderTrendLineChart(ctx, data, options) // 趋势线图
}
```

---

## 4. 报告结构设计

### 4.1 HTML 结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <title>GitHub AI 月度趋势报告 - 2026-03</title>
  <link rel="stylesheet" href="../../public/css/style.css">
  <link rel="stylesheet" href="../../public/css/monthly.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="container monthly-report">
    <!-- 1. 报告头部 -->
    <header class="monthly-header">
      <h1>GitHub AI 月度趋势报告</h1>
      <div class="month">2026-03</div>
      <div class="subtitle">深度分析 · 趋势洞察 · 生态全景</div>
    </header>

    <!-- 2. 月度概览 -->
    <section class="monthly-overview">
      <!-- 核心指标卡片 -->
    </section>

    <!-- 3. 月度主题 -->
    <section class="monthly-theme">
      <!-- AI 生成的月度主题 -->
    </section>

    <!-- 4. 趋势演变 -->
    <section class="trend-evolution">
      <!-- 上/中/下旬时间线 -->
    </section>

    <!-- 5. 数据可视化 -->
    <section class="data-visualization">
      <!-- 领域分布饼图 -->
      <!-- 语言 TOP5 柱状图 -->
      <!-- 趋势演变图 -->
    </section>

    <!-- 6. 月度 TOP 项目 -->
    <section class="top-projects">
      <!-- 综合评分 TOP 3-5 深度评测 -->
    </section>

    <!-- 7. 新兴领域 -->
    <section class="emerging-fields">
      <!-- 新兴领域雷达图 + 列表 -->
    </section>

    <!-- 8. 下月预测 -->
    <section class="next-month-forecast">
      <!-- AI 预测内容 -->
    </section>

    <!-- 9. 完整项目列表 -->
    <section class="full-project-list">
      <!-- 按类型分组的完整列表 -->
    </section>
  </div>
</body>
</html>
```

### 4.2 CSS 样式要点

**文件：** `public/css/monthly.css`

```css
/* 报告头部 */
.monthly-header {
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 40px;
}

/* 核心指标卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin: 30px 0;
}

/* 趋势演变时间线 */
.timeline {
  position: relative;
  padding: 40px 0;
}

.timeline-item {
  display: flex;
  gap: 20px;
  margin: 30px 0;
}

/* 图表容器 */
.chart-container {
  position: relative;
  height: 300px;
  margin: 20px 0;
}

/* TOP 项目卡片 */
.top-project-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  margin: 20px 0;
}
```

---

## 5. 实现计划

### Phase 1：基础数据聚合（2-3 天）

| 任务 | 文件 | 复杂度 |
|------|------|--------|
| 实现 MonthlyAggregator | `src/scraper/aggregators/monthly-aggregator.js` | 中 |
| 实现数据加载方法 | 同上 | 低 |
| 实现统计计算方法 | 同上 | 中 |
| 单元测试 | `tests/scraper/monthly-aggregator.test.js` | 低 |

### Phase 2：AI 分析模块（2-3 天）

| 任务 | 文件 | 复杂度 |
|------|------|--------|
| 实现 MonthlyAnalyzer | `src/analyzer/monthly-analyzer.js` | 中 |
| 编写 AI 提示词模板 | `config/prompts.json` (添加 monthly 完整模板) | 中 |
| 实现综合评分算法 | 同上 | 低 |
| 单元测试 | `tests/analyzer/monthly-analyzer.test.js` | 低 |

### Phase 3：HTML 生成与图表（2-3 天）

| 任务 | 文件 | 复杂度 |
|------|------|--------|
| 实现 MonthlyGenerator | `src/generator/monthly-generator.js` | 中 |
| 实现 ChartRenderer | `src/generator/chart-renderer.js` | 中 |
| 编写 monthly.css | `public/css/monthly.css` | 中 |
| 创建 HTML 模板 | 同上 | 低 |

### Phase 4：集成与测试（1-2 天）

| 任务 | 文件 | 复杂度 |
|------|------|--------|
| 创建月报工作流脚本 | `scripts/run-monthly-workflow.js` | 低 |
| 更新 complete-workflow.js | 添加 monthly 支持 | 低 |
| 更新 report-pipeline.js | 添加 monthly 支持 | 低 |
| 端到端测试 | 手动运行测试 | 中 |

### Phase 5：文档与优化（1 天）

| 任务 | 文件 | 复杂度 |
|------|------|--------|
| 更新 README.md | 添加月报使用说明 | 低 |
| 性能优化 | 根据需要 | 低 |
| 问题修复 | 根据测试反馈 | 低 |

---

## 6. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 历史数据不足 | 中 | 低 | 已有~20 天日报数据，可生成部分月报 |
| AI 分析质量不稳定 | 中 | 中 | 设计降级方案，提供 fallback 洞察 |
| Chart.js 加载失败 | 低 | 低 | 使用 CDN + 本地备份，提供静态 fallback |
| 生成时间过长 | 低 | 中 | 优化数据加载，添加进度日志 |

---

## 7. 验收标准

### 功能验收

- [ ] 能正确加载并聚合指定月份的所有日报、周报数据
- [ ] 能正确计算去重项目数、重复上榜项目、领域分布等统计
- [ ] AI 分析能生成完整的月度主题、趋势演变、TOP 项目等洞察
- [ ] HTML 报告包含所有设计章节
- [ ] 图表能正确渲染（饼图、柱状图、趋势图）
- [ ] 月报工作流能端到端运行

### 质量验收

- [ ] 报告长度达到 2000-3000 字
- [ ] 至少包含 3 种图表
- [ ] 生成时间 < 5 分钟
- [ ] 代码有完整注释
- [ ] 通过所有单元测试

### 文档验收

- [ ] README.md 包含月报使用说明
- [ ] 设计文档完整存档
- [ ] 代码注释清晰

---

## 8. 附录

### 8.1 相关文件清单

**新增文件：**
- `src/scraper/aggregators/monthly-aggregator.js`
- `src/analyzer/monthly-analyzer.js`
- `src/generator/monthly-generator.js`
- `src/generator/chart-renderer.js`
- `public/css/monthly.css`
- `scripts/run-monthly-workflow.js`
- `tests/scraper/monthly-aggregator.test.js`
- `tests/analyzer/monthly-analyzer.test.js`

**修改文件：**
- `src/scraper/complete-workflow.js` (添加 monthly 支持)
- `src/scraper/report-pipeline.js` (添加 monthly 支持)
- `config/prompts.json` (完善 monthly 提示词)
- `README.md` (添加月报说明)

### 8.2 依赖项

- Chart.js 4.x (CDN 引入)
- 现有项目依赖（无新增 npm 依赖）

---

**文档结束**
