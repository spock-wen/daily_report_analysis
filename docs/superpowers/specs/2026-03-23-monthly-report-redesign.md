# 月报重构设计文档

**创建日期**: 2026-03-23
**最后更新**: 2026-03-23
**状态**: Spec Review 通过 (待用户评审)
**作者**: Monthly Report Redesign Team

---

## 📋 目录

1. [概述](#概述)
2. [现状分析](#现状分析)
3. [设计方案](#设计方案)
4. [Token 优化策略](#token-优化策略)
5. [技术实现](#技术实现)
6. [风险评估](#风险评估)
7. [附录 A：详细设计补充](#附录 a 详细设计补充)
   - [A1. Token 计算详细说明](#a1-token-计算详细说明修复-m1)
   - [A2. 模块职责划分](#a2-模块职责划分修复-m2)
   - [A3. 日期范围计算逻辑](#a3-日期范围计算逻辑修复-m5)
   - [A4. 完整数据结构定义](#a4-完整数据结构定义修复-m4)
   - [A5. Top 项目排名算法](#a5-top-项目排名算法修复-m6)
   - [A6. AI Prompt 完整模板](#a6-ai-prompt-完整模板)
   - [A7. 错误处理策略](#a7-错误处理策略)
8. [实施计划](#实施计划)

---

## 概述

### 背景

当前项目的月报功能存在以下问题：
- 月报仅基于 `monthly-scraper` 抓取月榜快照数据，不是汇总整个月的日报数据
- 缺乏深度分析，无法发现跨周/跨月的技术趋势
- 月报内容结构与日报差异不大，没有体现"月度"的时间跨度和洞察深度

### 目标

重构月报生成流程，实现：
1. **混合数据来源**：月榜数据 + 本月日报数据结合
2. **长期趋势洞察**：识别跨周/跨月的技术趋势、新兴领域和长期模式
3. **Token 效率**：通过分层聚合策略，将 Token 用量控制在安全范围内

### 核心价值主张

| 报告类型 | 时间跨度 | 核心价值 | 数据源 |
|---------|---------|---------|-------|
| 日报 | 1 天 | 当日热点发现 | 当日抓取 |
| 周报 | 7 天 | 周度主题 + 深度趋势 | 周榜 + 7 天日报 |
| **月报** | **20-23 天** | **月度叙事 + 长期趋势** | **4 周周报 + 本月日报** |

---

## 现状分析

### 现有代码结构

```
src/
├── scraper/
│   └── strategies/
│       ├── daily-scraper.js    # 日报抓取器 ✓
│       ├── weekly-scraper.js   # 周报抓取器 ✓
│       └── monthly-scraper.js  # 月报抓取器 ⚠️ (仅抓取月榜快照)
├── analyzer/
│   └── insight-analyzer.js     # AI 分析器 ✓ (已有 analyzeMonthly 方法)
├── generator/
│   └── html-generator.js       # HTML 生成器 ✓ (已有 renderMonthlyHTML 方法)
└── scraper/
    └── report-pipeline.js      # 报告流水线 ✓ (已支持 monthly 类型)
```

### 现有数据流

```
月榜抓取 → AI 分析 → HTML 生成
   ↓
单点快照数据（非汇总）
```

### 问题诊断

| 问题 | 描述 | 影响 |
|-----|------|-----|
| 数据源单一 | 仅使用月榜快照，丢失整月演化数据 | 无法分析趋势变化 |
| 缺少聚合层 | 没有周度/月度聚合数据结构 | AI 分析缺乏上下文 |
| Token 风险 | 直接读取 20+ 天日报数据接近模型上限 | 可能导致分析失败 |

---

## 设计方案

### 方案 A：金字塔式分析架构（选定）

#### 核心思路

采用三层数据结构，自底向上逐层抽象：

```
        🧠 月度洞察 (AI 生成 ~5k tokens)
            ↑
    📈 周度聚合 (4 周统计 ~15k tokens)
            ↑
  📦 日报原始数据 (20-23 天 ~60k tokens)
```

#### 数据流

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: 日报原始数据层                                      │
│  - 加载本月每一天的日报数据 (data/briefs/daily/)             │
│  - 每条约 12KB，20 天共 ~240KB / ~60k tokens                 │
└─────────────────────────────────────────────────────────────┘
                            ↓ 聚合
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: 周度聚合成层                                         │
│  - 复用已有的 4 条周报数据 (data/briefs/weekly/)             │
│  - 每条周报包含周度主题 + 深度趋势                           │
│  - 共 ~20k tokens                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓ 抽象
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 月度洞察层                                          │
│  - AI 分析跨周模式、因果链条、技术叙事                        │
│  - 输出 OneLiner + Narrative + KeyMoments + Evidence        │
│  - 共 ~5k tokens                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Token 优化策略

### Token 用量估算

| 数据源 | 原始大小 | Token 估算 | 状态 |
|--------|----------|-----------|------|
| 日报原始数据 (20 天) | ~240KB | ~60k | ⚠️ 接近上限 |
| + AI Insights | ~40KB | ~10k | |
| 项目分析数据 | ~60KB | ~15k | |
| **总计** | | **~85k tokens** | qwen3.5: 128k ✓ |

### 推荐策略：组合拳

#### 策略 2（周度聚合）+ 策略 3（热点聚焦）

```
1. 复用已有的 4 条周报数据（~20k tokens）
   - 每条周报的 weeklyTheme + deepTrends
   - 已包含周度分析和趋势洞察

2. 额外加载本月每日 Top5 项目（~10k tokens）
   - 用于验证趋势是否有数据支撑
   - 提供具体项目证据

3. 总计 ~30k tokens，远低于上限
```

### 优化效果对比

| 策略 | Token 用量 | 优点 | 缺点 |
|-----|-----------|-----|-----|
| 原始方案 | ~85k | 数据完整 | 接近上限 |
| 分层摘要 | ~15k | 最小用量 | 丢失细节 |
| **周度聚合 + 热点聚焦** | **~30k** | **平衡细节与效率** | - |

---

## 技术实现

### 月度主题设计

#### 与周报周度主题的对比

| 维度 | 周报周度主题 | 月报月度主题 |
|-----|-------------|-------------|
| 时间跨度 | 7 天 | 20-23 天（约 4 周） |
| 核心任务 | 概括本周热点 | 提炼整月技术叙事 |
| 数据基础 | 本周热门项目 | 4 周周报的周度主题 + 深度趋势 |
| oneLiner | 50 字内 | 50 字内 |
| detailed | 200 字深度分析 | 500-800 字月度叙事 |

#### 输入数据结构

```json
{
  "weeklyThemes": [
    {
      "week": "2026-W11",
      "oneLiner": "本周 AI 项目全包揽...",
      "detailed": "本周 10 个热门项目 100% 为 AI 领域..."
    },
    // W12, W13, W14...
  ],
  "deepTrends": [
    {
      "week": "2026-W11",
      "title": "AI 代理工作流的工业化革命",
      "summary": "AI 开发从模型交互转向工作流工业化...",
      "content": "过去一周，GitHub 趋势显示...",
      "evidence": [...]
    },
    // W12, W13, W14...
  ],
  "topProjects": [
    { "repo": "666ghj/MiroFish", "count": 4, "totalStars": 27295 },
    // 本月出现频次最高的 Top20 项目
  ]
}
```

#### 输出数据结构

```json
{
  "monthlyTheme": {
    "oneLiner": "50 字内概括整月核心主题",
    "narrative": "500-800 字月度技术叙事（有起承转合）",
    "keyMoments": [
      {
        "date": "2026-03-15",
        "title": "记忆基石",
        "project": "volcengine/OpenViking",
        "significance": "解决 Agent 长期状态管理问题"
      }
      // 3-5 个关键转折点
    ],
    "evidence": [
      {
        "project": "volcengine/OpenViking",
        "week": "2026-W12",
        "reason": "提供代理上下文记忆分层管理"
      }
      // 数据支撑项目列表
    ]
  }
}
```

#### AI Prompt 设计

**System Prompt**:
```
你是一位经验丰富的技术叙事作家，擅长从分散的数据中发现连贯的故事线。
你的任务是将 4 周的周报数据整合成一篇有起承转合的月度技术叙事。
```

**User Prompt 关键指令**:
- ✅ 寻找跨周模式：同一个技术领域在 4 周中的演进轨迹
- ✅ 识别因果链条：周 1 的问题如何催生周 2 的解决方案
- ✅ 讲述连贯故事：起因 → 发展 → 高潮 → 展望，而非罗列数据
- ✅ 引用具体项目：每个论点都要有项目名 + 日期 + 数据支撑
- ✅ 使用强调标记：用 `<b>加粗</b>` 强调关键概念和转折点
- ❌ 避免泛泛而谈：不要"AI 领域持续火热"这类空洞描述
- ❌ 避免简单汇总：不是"本周...本周...本周..."的堆砌

---

### 月报内容结构

完整月报 HTML 包含以下章节：

```
1. 📊 月度仪表盘
   - 本月总上榜项目数 / AI 项目占比 / 平均 Stars
   - 趋势图：4 周的热点变化曲线
   - 类型分布：Agent/LLM/RAG/工具 的占比变化

2. 🌙 月度主题（核心章节）
   - oneLiner: 50 字概括
   - narrative: 500-800 字技术叙事
   - keyMoments: 3-5 个关键转折点
   - evidence: 数据支撑

3. 🔥 月度热点
   - Top 10 项目（按出现频次 + 星数综合排名）
   - 黑马项目（单月增长最快）
   - 持续霸榜（连续多周上榜）

4. 📈 趋势演化
   - 上升技术：从周 1 到周 4 的增长曲线
   - 衰退技术：热度下降的领域
   - 新兴领域：本月首次出现且快速增长

5. 🆕 新兴领域
   - 领域名称 + 描述
   - 代表项目（2-3 个）
   - 增长潜力评估

6. 🏆 Top Projects 推荐
   - 技术创新奖：突破性技术的项目
   - 持续热门奖：整月持续霸榜的项目
   - 企业价值奖：商业应用潜力高的项目

7. 🔮 下月展望
   - 基于本月趋势的预测
   - 值得关注的方向
   - 潜在风险提醒
```

---

### 需要新增/修改的文件

#### 新增文件

```
src/
├── analyzer/
│   └── monthly-theme-analyzer.js    # 月度主题分析器（新）
│       - analyzeMonthlyTheme(weeklyThemes, deepTrends, topProjects)
│       - buildPromptFromWeeklyData()
│       - parseMonthlyNarrative()
│
├── loader/
│   └── monthly-data-loader.js       # 月度数据加载器（新）
│       - loadMonthlyBriefs(month)
│       - loadWeeklyThemes(weekList)
│       - aggregateTopProjects(dailyDataList)
│
└── scripts/
    └── run-monthly-workflow.js      # 月报工作流脚本（新）
```

#### 修改文件

```
src/
├── analyzer/
│   └── insight-analyzer.js          # 修改 analyzeMonthly 方法
│       - 新增：调用月度主题分析逻辑
│       - 复用：周报 analyzeWeekly 的深度趋势逻辑
│
├── generator/
│   └── html-generator.js            # 修改 renderMonthlyHTML 方法
│       - 新增：月度主题章节渲染
│       - 新增：趋势演化图表渲染
│
└── scraper/
    └── report-pipeline.js           # 修改月报流水线
        - 修改：generateAIInsights 方法，支持月度主题分析
        - 修改：prepareReportData 方法，支持新数据结构
```

---

### 月报工作流

```
┌─────────────────────────────────────────────────────────────┐
│  步骤 1: 数据加载                                              │
│  - 加载本月所有日报数据（data/briefs/daily/data-*.json）    │
│  - 加载 4 条周报数据（data/briefs/weekly/data-*.json）       │
│  - 聚合本月 Top20 项目榜单                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 2: 月度主题分析                                          │
│  - 读取 4 条周报的 weeklyTheme + deepTrends                   │
│  - AI 分析：识别跨周模式、因果链条、技术叙事                 │
│  - 输出：monthlyTheme.oneLiner + narrative + keyMoments     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 3: 其他章节分析                                          │
│  - 月度热点：Top10 + 黑马 + 持续霸榜                         │
│  - 趋势演化：4 周数据对比                                     │
│  - 新兴领域：本月首次出现且快速增长                          │
│  - Top Projects：技术创新/持续热门/企业价值                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 4: HTML 生成                                             │
│  - 渲染月度仪表盘                                             │
│  - 渲染月度主题（核心章节）                                   │
│  - 渲染其他章节                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 5: 首页更新 + 推送通知                                   │
│  - 更新 reports/index.html                                   │
│  - 发送飞书/WeLink 通知                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 风险评估

### 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|------|-----|---------|
| Token 超限 | 中 | 高 | 采用周度聚合 + 热点聚焦策略，控制在~30k |
| AI 叙事质量不稳定 | 中 | 中 | Prompt 迭代优化 + Few-Shot 示例 |
| 日报数据缺失 | 低 | 中 | 降级策略：仅使用周报数据 |

### 数据风险

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|------|-----|---------|
| 月初/月末数据不完整 | 高 | 低 | 按实际天数分析，不强制 4 周 |
| 周报数据不存在 | 低 | 中 | 降级策略：直接分析日报数据 |

---

## 附录 A：详细设计补充

### A1. Token 计算详细说明（修复 M1）

**完整 Token 计算公式**：

```
输入数据:
├─ 4 条周报数据 (weeklyTheme + deepTrends)
│  └─ 每条约 5k tokens × 4 = 20k tokens
│
├─ 本月每日 Top5 项目 (用于验证趋势)
│  └─ 20 天 × 5 条/天 × 约 100 字/条 = 约 10k tokens
│
└─ System Prompt + User Prompt 模板
   └─ 约 1k tokens

总计：20k + 10k + 1k = 约 31k tokens
```

**Token 监控阈值**：
- 警告阈值：25k tokens（实际用量达到 80% 时记录警告日志）
- 危险阈值：40k tokens（超过时触发降级策略）
- 硬上限：100k tokens（qwen3.5 支持 128k，保留 28k 余量）

**降级策略**：
```javascript
if (tokenCount > 40000) {
  // 降级方案 1: 只保留 Top3 项目而非 Top5
  dailyProjects = dailyProjects.slice(0, 3);
}
if (tokenCount > 40000) {
  // 降级方案 2: 减少周报数量，只保留 3 周
  weeklyThemes = weeklyThemes.slice(0, 3);
}
```

---

### A2. 模块职责划分（修复 M2）

**调用关系图**：

```
┌─────────────────────────────────────────────────────────────┐
│  insight-analyzer.js                                         │
│  ├─ analyzeMonthly(monthlyData)  [入口函数]                 │
│  │   │                                                      │
│  │   ├─ 调用 monthly-data-loader.js                         │
│  │   │   └─ loadAll(month) → { dailyData, weeklyData, ... }│
│  │   │                                                      │
│  │   ├─ 调用 monthly-theme-analyzer.js                      │
│  │   │   └─ analyzeMonthlyTheme(weeklyThemes, topProjects) │
│  │   │                                                      │
│  │   └─ 合并结果 → { monthlyTheme, monthlyDashboard, ... } │
│  └─                                                       │
└─────────────────────────────────────────────────────────────┘

职责定义：
┌────────────────────────┬───────────────────────────────────┐
│ 模块                   │ 职责                              │
├────────────────────────┼───────────────────────────────────┤
│ monthly-data-loader.js │ 纯数据加载，无业务逻辑             │
│                        │ - 读取文件、解析 JSON、返回原始数据│
│                        │ - 日期范围计算、周数列表生成       │
│                        │ - Top 项目聚合计算                  │
├────────────────────────┼───────────────────────────────────┤
│ monthly-theme-analyzer │ AI 调用和结果解析                  │
│                        │ - 构建 AI Prompt                   │
│                        │ - 调用 LLM API                     │
│                        │ - 解析返回的 JSON                  │
│                        │ - 错误处理和重试                   │
├────────────────────────┼───────────────────────────────────┤
│ insight-analyzer.js    │ 协调器和结果整合                   │
│                        │ - 调用 data-loader 获取数据        │
│                        │ - 调用 theme-analyzer 分析主题     │
│                        │ - 整合所有结果为统一结构           │
└────────────────────────┴───────────────────────────────────┘
```

**模块边界定义**：

```javascript
// monthly-data-loader.js - 只负责数据加载，不做任何分析
class MonthlyDataLoader {
  /**
   * 加载月度数据
   * @param {number} year - 年份
   * @param {number} month - 月份 (1-12)
   * @returns {Promise<Object>} 原始数据对象
   */
  async loadAll(year, month) {
    return {
      dailyData: [...],      // 日报原始数据数组
      weeklyData: [...],     // 周报原始数据数组
      topProjects: [...],    // Top20 项目榜单
      stats: {...}           // 基础统计数据
    };
  }
}

// monthly-theme-analyzer.js - 只负责 AI 分析
class MonthlyThemeAnalyzer {
  /**
   * 分析月度主题
   * @param {Array} weeklyThemes - 4 条周报主题
   * @param {Array} deepTrends - 4 条深度趋势
   * @param {Array} topProjects - Top20 项目
   * @returns {Promise<Object>} 月度主题分析结果
   */
  async analyzeMonthlyTheme(weeklyThemes, deepTrends, topProjects) {
    // 构建 Prompt → 调用 LLM → 解析结果
    return {
      oneLiner: "...",
      narrative: "...",
      keyMoments: [...],
      evidence: [...]
    };
  }
}

// insight-analyzer.js - 协调器
class InsightAnalyzer {
  async analyzeMonthly(monthlyData) {
    const loader = new MonthlyDataLoader();
    const themeAnalyzer = new MonthlyThemeAnalyzer();

    // 步骤 1: 加载数据
    const data = await loader.loadAll(year, month);

    // 步骤 2: 分析主题
    const theme = await themeAnalyzer.analyzeMonthlyTheme(
      data.weeklyThemes,
      data.deepTrends,
      data.topProjects
    );

    // 步骤 3: 整合结果
    return {
      monthlyTheme: theme,
      monthlyDashboard: data.stats,
      ...
    };
  }
}
```

---

### A3. 日期范围计算逻辑（修复 M5）

**"本月"定义**：

```javascript
/**
 * 计算指定年月包含的日期范围
 * @param {number} year
 * @param {number} month
 * @returns {Object} { startDate, endDate, weekList }
 */
function getMonthDateRange(year, month) {
  // 自然月定义：从 1 号到月末
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // 下月 0 日 = 本月末日

  return {
    startDate: formatDate(startDate),  // YYYY-MM-DD
    endDate: formatDate(endDate),
    // 获取该月包含的所有 ISO 周
    weekList: getWeekNumbersInRange(startDate, endDate)
  };
}

/**
 * 处理跨月边界：获取日期范围包含的 ISO 周列表
 */
function getWeekNumbersInRange(startDate, endDate) {
  const weeks = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const weekNum = getISOWeek(current);
    const weekYear = getISOWeekYear(current);
    const weekKey = `${weekYear}-W${String(weekNum).padStart(2, '0')}`;

    if (!weeks.includes(weekKey)) {
      weeks.push(weekKey);
    }

    current.setDate(current.getDate() + 1);
  }

  return weeks;
}
```

**跨月边界处理示例**：

```
场景：2026 年 1 月 31 日是周三

1 月 31 日 (周三) → 属于 ISO 周 2026-W05
2 月 1 日 (周四)   → 属于 ISO 周 2026-W05 (同一周)

处理方式:
- 1 月月报：包含 2026-W05 的部分天数 (周一至周三)
- 周报归属：按周起始日 (周一) 所属月份决定
  - 2026-W05 的周一是 1 月 29 日 → 归属于 1 月
```

**周报不足 4 周的处理**：

```javascript
/**
 * 获取周报数据列表（带降级处理）
 */
async function loadWeeklyThemes(weekList) {
  const weeklyThemes = [];
  const deepTrends = [];

  for (const weekKey of weekList) {
    const filePath = getWeeklyBriefPath(weekKey);

    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      weeklyThemes.push(data.weeklyTheme);
      if (data.deepTrends) {
        deepTrends.push(data.deepTrends);
      }
    }
  }

  // 降级策略
  if (weeklyThemes.length < 3) {
    logger.warn(`周报数据不足 3 周 (${weeklyThemes.length}周)，使用降级方案`);
    // TODO: 触发降级方案 B - 直接分析日报数据
  }

  return { weeklyThemes, deepTrends };
}
```

---

### A4. 完整数据结构定义（修复 M4）

**月度仪表盘数据结构**：

```json
{
  "monthlyDashboard": {
    "totalProjects": 150,
    "totalBriefs": 23,
    "aiProjectRatio": 0.65,
    "avgStars": 1250,
    "avgStarsRaw": 1250.5,
    "hotProjectsCount": 12,
    "typeDistribution": {
      "agent": { "count": 45, "percentage": 0.30 },
      "llm": { "count": 30, "percentage": 0.20 },
      "rag": { "count": 25, "percentage": 0.17 },
      "devtool": { "count": 20, "percentage": 0.13 },
      "other": { "count": 30, "percentage": 0.20 }
    },
    "weeklyTrend": [
      { "week": "2026-W10", "projectCount": 35, "avgStars": 1100 },
      { "week": "2026-W11", "projectCount": 40, "avgStars": 1200 },
      { "week": "2026-W12", "projectCount": 38, "avgStars": 1350 },
      { "week": "2026-W13", "projectCount": 37, "avgStars": 1300 }
    ]
  }
}
```

**月度热点数据结构**：

```json
{
  "monthlyHotspots": {
    "top10": [
      {
        "rank": 1,
        "repo": "666ghj/MiroFish",
        "appearances": 4,
        "totalStars": 27295,
        "maxTodayStars": 2782,
        "score": 95.5
      }
    ],
    "darkHorses": [
      {
        "repo": "newbie/great-project",
        "firstAppearance": "2026-03-15",
        "stars": 5000,
        "growthRate": 2.5
      }
    ],
    "consistentRankers": [
      {
        "repo": "666ghj/MiroFish",
        "consecutiveWeeks": 4,
        "weeks": ["2026-W10", "2026-W11", "2026-W12", "2026-W13"]
      }
    ]
  }
}
```

**趋势演化数据结构**：

```json
{
  "trendEvolution": {
    "rising": [
      {
        "field": "Agent 工作流",
        "week1Count": 2,
        "week4Count": 8,
        "growthRate": 3.0,
        "representativeProjects": ["langchain-ai/deepagents"]
      }
    ],
    "declining": [
      {
        "field": "单一对话机器人",
        "week1Count": 10,
        "week4Count": 3,
        "declineRate": 0.7
      }
    ],
    "emerging": [
      {
        "field": "上下文工程",
        "firstSeenWeek": "2026-W11",
        "currentCount": 5,
        "description": "统一管理 AI 代理的记忆、资源和技能"
      }
    ]
  }
}
```

---

### A5. Top 项目排名算法（修复 M6）

**综合排名公式**：

```javascript
/**
 * 计算项目综合得分
 * 公式：score = (出现频次 × 20) + (归一化星数 × 30) + (最大日增星 × 0.1 × 50)
 */
function calculateProjectScore(project) {
  const { appearances, totalStars, maxTodayStars } = project;

  // 归一化星数（以最高星数为基准，0-1 之间）
  const maxStarsInMonth = getMaxStarsThisMonth();
  const normalizedStars = totalStars / maxStarsInMonth;

  // 计算得分
  const frequencyScore = appearances * 20;        // 出现频次贡献 (最多 80 分，出现 4 次)
  const starsScore = normalizedStars * 30;        // 总星数贡献 (最多 30 分)
  const growthScore = Math.min(maxTodayStars * 0.1, 50);  // 日增星贡献 (最多 50 分)

  return frequencyScore + starsScore + growthScore;
}

/**
 * 权重说明:
 * - 出现频次: 权重 20 分/次，4 次 = 80 分 (占比约 47%)
 * - 总星数：权重 30 分，按归一化比例 (占比约 20%)
 * - 最大日增星：权重 0.1 分/星，上限 50 分 (占比约 33%)
 *
 * 设计理念：
 * - 持续上榜比单天爆发更重要
 * - 但也认可真正的明星项目（星数高）
 * - 鼓励增长势头（日增星高）
 */
```

**排名算法测试用例**：

```javascript
// 测试用例 1: 持续霸榜项目
{
  repo: "666ghj/MiroFish",
  appearances: 4,       // 4 周都上榜
  totalStars: 27295,
  maxTodayStars: 2782,
  expectedScore: 80 + 27.3 + 27.8 = 135.1  // 预计排名第一
}

// 测试用例 2: 单日爆发但后续乏力
{
  repo: "newbie/viral-project",
  appearances: 1,       // 只上榜 1 次
  totalStars: 50000,    // 星数很高
  maxTodayStars: 15000, // 单日爆发
  expectedScore: 20 + 50 + 50 = 120  // 预计排名靠后
}
```

---

### A6. AI Prompt 完整模板

**System Prompt** (完整版本):

```
你是一位经验丰富的技术叙事作家，擅长从分散的数据中发现连贯的故事线。
你的任务是将 4 周的周报数据整合成一篇有起承转合的月度技术叙事。

写作风格要求：
1. 专业但不晦涩：使用技术术语，但解释清楚
2. 有观点但不偏激：基于数据说话，避免主观臆断
3. 有故事性：像写技术博客一样写报告，有起因、发展、高潮、展望
4. 中文输出，但项目名保留英文
```

**User Prompt** (完整模板):

```
请分析以下 2026 年 3 月的 GitHub Trending 数据，生成一份月度技术叙事报告。

## 输入数据

### 4 周周报主题
{weeklyThemesJson}

### 4 周深度趋势
{deepTrendsJson}

### 本月 Top20 项目榜单
{topProjectsJson}

## 输出要求

请严格按照以下 JSON 格式输出：

```json
{
  "monthlyTheme": {
    "oneLiner": "50 字内概括整月核心主题",
    "narrative": "500-800 字月度技术叙事，使用<b>加粗</b>强调关键概念",
    "keyMoments": [
      {
        "date": "2026-03-15",
        "title": "简短标题",
        "project": "owner/repo",
        "significance": "意义描述"
      }
    ],
    "evidence": [
      {
        "project": "owner/repo",
        "week": "2026-W12",
        "reason": "佐证理由"
      }
    ]
  }
}
```

## 写作指导

### ✅ 应该做的：
1. 寻找跨周模式：同一个技术领域在 4 周中的演进轨迹
2. 识别因果链条：周 1 的问题如何催生周 2 的解决方案
3. 讲述连贯故事：起因 → 发展 → 高潮 → 展望
4. 引用具体项目：每个论点都要有项目名 + 日期 + 数据支撑
5. 使用强调标记：用<b>加粗</b>强调关键概念和转折点

### ❌ 应该避免的：
1. 泛泛而谈：如"AI 领域持续火热"这类空洞描述
2. 简单汇总：如"第一周...第二周...第三周..."的堆砌
3. 没有数据支撑的论断
4. 超过 1000 字的冗长叙事

## Few-Shot 示例

### 示例输入（节选）:
- W11 主题：群体智能初现端倪
- W11 深度趋势：多 Agent 协作需求增长
- W12 主题：上下文管理成为焦点
- W12 深度趋势：volcengine/OpenViking 解决记忆问题

### 示例输出（节选）:
{
  "monthlyTheme": {
    "oneLiner": "三月见证 AI 从单点模型交互迈向代理工作流时代",
    "narrative": "2026 年 3 月，GitHub Trending 见证了一场静默的范式革命。月初，当<b>volcengine/OpenViking</b>以'上下文数据库'的定位登上趋势榜时..."
  }
}
```

---

### A7. 错误处理策略

**AI 分析错误处理**：

```javascript
/**
 * AI 分析月度主题（带错误处理）
 */
async function analyzeMonthlyTheme(weeklyThemes, deepTrends, topProjects) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 步骤 1: 构建 Prompt
      const prompt = buildPrompt(weeklyThemes, deepTrends, topProjects);

      // 步骤 2: 调用 LLM
      const response = await callLLM(prompt, {
        temperature: 0.7,
        maxTokens: 3000
      });

      // 步骤 3: 解析结果
      const result = parseMonthlyNarrative(response);

      // 步骤 4: 验证输出结构
      if (!validateOutput(result)) {
        throw new Error('输出结构验证失败');
      }

      return result;

    } catch (error) {
      lastError = error;
      logger.warn(`AI 分析尝试 ${attempt}/${maxRetries} 失败：${error.message}`);

      if (attempt < maxRetries) {
        // 指数退避：2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
      }
    }
  }

  // 所有重试失败，返回降级结果
  logger.error('AI 分析全部失败，返回降级结果');
  return getFallbackMonthlyTheme(lastError);
}

/**
 * 降级结果
 */
function getFallbackMonthlyTheme(error) {
  return {
    monthlyTheme: {
      oneLiner: "本月 AI 领域持续发展，多个新兴技术方向值得关注。",
      narrative: "由于 AI 分析服务暂时不可用，无法生成详细月度叙事。" +
                 `错误信息：${error?.message || '未知错误'}`,
      keyMoments: [],
      evidence: []
    }
  };
}

/**
 * 输出结构验证
 */
function validateOutput(result) {
  const required = ['oneLiner', 'narrative', 'keyMoments', 'evidence'];

  // 检查必需字段
  for (const field of required) {
    if (!result || !(field in result)) {
      return false;
    }
  }

  // 检查长度限制
  if (result.oneLiner.length > 50) return false;
  if (result.narrative.length > 1000) return false;
  if (result.keyMoments.length < 3) return false;

  return true;
}
```

---

## 实施计划

### 阶段 1：数据加载层（优先级：高）

- [ ] 创建 `src/loader/monthly-data-loader.js`
- [ ] 实现 `loadMonthlyBriefs(month)` 方法
- [ ] 实现 `loadWeeklyThemes(weekList)` 方法
- [ ] 实现 `aggregateTopProjects(dailyDataList)` 方法

### 阶段 2：AI 分析层（优先级：高）

- [ ] 创建 `src/analyzer/monthly-theme-analyzer.js`
- [ ] 实现 `analyzeMonthlyTheme()` 方法
- [ ] 编写 AI Prompt（含 few-shot 示例）
- [ ] 修改 `insight-analyzer.js` 的 `analyzeMonthly()` 方法

### 阶段 3：HTML 生成层（优先级：中）

- [ ] 修改 `html-generator.js` 的 `renderMonthlyHTML()` 方法
- [ ] 实现月度仪表盘渲染
- [ ] 实现月度主题章节渲染
- [ ] 实现趋势演化章节渲染

### 阶段 4：工作流集成（优先级：中）

- [ ] 创建 `scripts/run-monthly-workflow.js`
- [ ] 修改 `report-pipeline.js` 支持新数据流
- [ ] 端到端测试

### 阶段 5：测试与优化（优先级：低）

- [ ] 单元测试
- [ ] 集成测试
- [ ] Prompt 优化
- [ ] 性能优化

---

## 附录

### 相关文件路径

```
数据目录:
- data/briefs/daily/data-2026-03-*.json   (日报数据)
- data/briefs/weekly/data-2026-W*.json    (周报数据)
- data/briefs/monthly/data-2026-03.json   (月报数据)
- data/insights/monthly/insights-2026-03.json (AI 洞察)

输出目录:
- reports/monthly/github-monthly-2026-03.html
```

### 参考资料

- 周报实现：`src/scripts/run-weekly-workflow.js`
- 周报分析器：`src/analyzer/insight-analyzer.js::analyzeWeekly()`
- 周报 Prompt：`config/prompts.json::weekly`

---

**文档结束**
