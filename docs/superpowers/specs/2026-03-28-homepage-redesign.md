# 首页重构设计文档

**日期：** 2026-03-28
**状态：** 待批准
**优先级：** 中高

---

## 1. 背景与目标

### 1.1 当前问题

现有 `index.html` 存在以下问题：

1. **统计数字硬编码**：显示"累计日报25篇"等数据，实际只有8天数据
2. **Top 10 项目混合来源**：将日报/周报/月报项目混合排序，导致最新报告项目被淹没
3. **AI 洞察位置混乱**：首页有"AI 洞察"模块，但各报告内部也有，功能重复
4. **月报主题显示异常**：显示 `[object Object]` 而非实际文本
5. **月报链接错误**：链接到旧版本文件 `github-monthly-202603-09.html`
6. **趋势图表未实现**：只有占位符，无实际功能

### 1.2 重构目标

设计一个**对外展示的门户页面**，特点包括：

- ✅ 数据动态计算（从 `data/briefs/` 目录读取）
- ✅ Top 5 项目来自所有项目的综合排名（非最新报告专属）
- ✅ Chart.js 可交互图表（可切换指标）
- ✅ 报告存档默认折叠
- ✅ 清晰的导航入口 + 适量的数据摘要

---

## 2. 需求规格

### 2.1 功能需求

| 功能模块 | 描述 | 优先级 |
|----------|------|--------|
| 动态统计卡片 | 从实际数据文件计算统计数字 | P0 |
| 最新报告卡片 | 3个卡片（日报/周报/月报）带摘要 | P0 |
| 可交互图表 | Chart.js 默认显示"新增项目数"折线图 | P0 |
| Top 5 热榜 | 所有项目按 Stars 排名 Top 5 | P0 |
| 报告存档 | 折叠面板，默认隐藏 | P0 |
| 搜索功能 | 保留原有搜索功能（Top 5 内搜索） | P1 |

### 2.2 非功能需求

- **响应式**：支持 1024px/768px/480px 断点
- **性能**：首次加载 < 2 秒
- **可维护性**：代码结构清晰，逻辑与视图分离

---

## 3. 系统设计

### 3.1 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                  generated-index.html                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  DataCollector   │  │  ChartDataBuilder│               │
│  │  (收集所有数据)   │  │  (构建图表数据)   │               │
│  └────────┬─────────┘  └────────┬─────────┘               │
│           │                     │                          │
│           └──────────┬──────────┘                          │
│                      │                                     │
│           ┌──────────▼──────────┐                          │
│           │   HTMLRenderer      │                          │
│           │  (生成 HTML 结构)    │                          │
│           └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 数据结构

#### 3.2.1 报告数据结构

```javascript
{
  type: 'daily' | 'weekly' | 'monthly',
  identifier: '2026-03-28' | '2026-W13' | '2026-03',
  title: 'GitHub AI Trending 日报 - 2026-03-28',
  stats: {
    totalProjects: 12,
    aiProjects: 9,
    avgStars: '32.2k'
  },
  projects: [...],  // 项目数组
  date: '2026-03-28' | '2026-03-01'  // 用于排序
}
```

#### 3.2.2 Chart.js 数据结构

```javascript
{
  labels: ['03-21', '03-22', '03-23', '03-24', '03-25', '03-26', '03-27', '03-28'],
  datasets: [
    {
      label: '新增项目',
      data: [12, 8, 8, 10, 10, 15, 13, 12],
      borderColor: '#3fb950',
      tension: 0.4
    }
  ],
  switchers: [
    { id: 'projects', label: '新增项目数' },
    { id: 'stars', label: '星数增长' },
    { id: 'ai-ratio', label: 'AI 占比' }
  ]
}
```

---

## 4. 页面结构设计

### 4.1 HTML 结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>GitHub AI Trending 洞察系统</title>
  <link rel="stylesheet" href="../public/css/index.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
  <div class="container">
    <!-- 1. 头部区域 -->
    <header>
      <h1>🚀 GitHub AI Trending 洞察系统</h1>
      <p class="subtitle">每日/每周/每月 AI 项目趋势追踪</p>
      <p class="last-update">最后更新：{{generatedAt}}</p>
    </header>

    <!-- 2. 系统状态卡片 -->
    <section class="system-status">
      <h2 class="sr-only">系统状态</h2>
      <div class="status-grid">
        {{#each stats}}
        <div class="stat-card">
          <div class="stat-value">{{value}}</div>
          <div class="stat-label">{{label}}</div>
          {{#if detail}}
          <div class="stat-detail">{{detail}}</div>
          {{/if}}
        </div>
        {{/each}}
      </div>
    </section>

    <!-- 3. 最新报告卡片 -->
    <section class="latest-reports">
      <h2>🆕 最新报告</h2>
      <div class="report-cards">
        {{#each reports}}
        <div class="report-card {{type}}">
          <div class="report-card-header">
            <h3><span class="icon">{{icon}}</span>{{title}}</h3>
            <span class="report-date">{{date}}</span>
          </div>
          <div class="report-card-stats">
            <span class="stat">{{stats.total}} 个项目</span>
            {{#if stats.ai}}
            <span class="stat">{{stats.ai}} AI 项目</span>
            {{/if}}
            <span class="stat">⭐ {{stats.avgStars}}</span>
          </div>
          {{#if theme}}
          <div class="report-card-theme">{{theme}}</div>
          {{/if}}
          <a href="{{url}}" class="report-card-btn">查看详情</a>
        </div>
        {{/each}}
      </div>
    </section>

    <!-- 4. 可交互图表 -->
    <section class="trends-chart">
      <div class="chart-header">
        <h2>📈 实时趋势</h2>
        <div class="chart-tabs" role="tablist">
          {{#each chart.switchers}}
          <button class="chart-tab {{#if @first}}active{{/if}}" data-chart="{{id}}">
            {{label}}
          </button>
          {{/each}}
        </div>
      </div>
      <div class="chart-container">
        <canvas id="trendChart"></canvas>
      </div>
    </section>

    <!-- 5. Top 5 热榜项目 -->
    <section class="top-projects">
      <h2>🔥 Top 5 热榜项目</h2>
      <div class="top-projects-grid">
        {{#each topProjects}}
        <div class="top-project-card">
          <div class="top-project-rank">#{{rank}}</div>
          <a href="{{url}}" class="top-project-name">{{fullName}}</a>
          <div class="top-project-stars">⭐ {{starsDisplay}}</div>
          <div class="top-project-desc">{{descZh || desc}}</div>
          <div class="top-project-tags">
            <span class="tag">{{analysis.typeName || '其他'}}</span>
            <span class="tag">{{language}}</span>
          </div>
        </div>
        {{/each}}
      </div>
      <a href="{{latestDailyUrl}}" class="view-all-btn">查看完整榜单 →</a>
    </section>

    <!-- 6. 报告存档（折叠面板） -->
    <section class="archive-section">
      <h2>
        📁 报告存档
        <button class="toggle-btn" aria-expanded="false">
          展开全部 →
        </button>
      </h2>
      <div class="archive-content" hidden>
        {{#each archives}}
        <div class="archive-tab">
          <span class="archive-type">{{title}}</span>
          <ul>
            {{#each items}}
            <li>
              <a href="{{url}}">{{date}}</a>
              <span class="archive-count">{{count}} 个项目</span>
            </li>
            {{/each}}
          </ul>
        </div>
        {{/each}}
      </div>
    </section>

    <!-- 7. 底部 -->
    <footer>
      <p>由 AI 自动生成 · 数据来源 GitHub Trending API</p>
      <p>最后更新：{{generatedAt}}</p>
    </footer>
  </div>

  <script>
    // Chart.js 初始化代码
    // 折叠面板交互
    // 搜索功能（保留原有）
  </script>
</body>
</html>
```

### 4.2 CSS 样式要点

**文件：** `public/css/index.css`

```css
/* ========== 系统状态卡片 ========== */
.system-status {
  margin-bottom: 40px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}

.stat-card {
  background: var(--bg-card);
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid var(--border);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent-green);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.stat-detail {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* ========== 最新报告卡片 ========== */
.latest-reports {
  margin-bottom: 40px;
}

.report-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.report-card {
  background: var(--bg-card);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.report-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.report-card-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.report-card-theme {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.5;
}

/* ========== 可交互图表 ========== */
.trends-chart {
  margin-bottom: 40px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-tabs {
  display: flex;
  gap: 8px;
}

.chart-tab {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.chart-tab.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.chart-container {
  height: 350px;
  position: relative;
}

/* ========== Top 5 热榜 ========== */
.top-projects {
  margin-bottom: 40px;
}

.top-projects-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.top-project-card {
  background: var(--bg-card);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.top-project-rank {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent-orange);
}

.top-project-stars {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--accent);
  margin: 8px 0;
}

.top-project-desc {
  color: var(--text-secondary);
  font-size: 0.875rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.view-all-btn {
  display: block;
  text-align: center;
  margin-top: 20px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

/* ========== 报告存档 ========== */
.archive-section {
  margin-bottom: 40px;
}

.archive-section h2 {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.875rem;
}

.archive-content {
  margin-top: 20px;
}

.archive-tab {
  margin-bottom: 24px;
}

.archive-type {
  font-weight: 600;
  color: var(--accent);
  display: block;
  margin-bottom: 12px;
}

.archive-tab ul {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.archive-tab li {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.archive-count {
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

/* ========== 响应式 ========== */
@media (max-width: 1024px) {
  .status-grid { grid-template-columns: repeat(3, 1fr); }
  .report-cards { grid-template-columns: 1fr; }
  .chart-tabs { flex-wrap: wrap; }
}

@media (max-width: 768px) {
  .top-projects-grid { grid-template-columns: 1fr; }
  .status-grid { grid-template-columns: repeat(2, 1fr); }
}
```

---

## 5. 交互设计

### 5.1 Chart.js 交互

```javascript
const chartData = {
  projects: {
    labels: ['03-21', '03-22', ..., '03-28'],
    datasets: [{
      label: '新增项目',
      data: [12, 8, 8, 10, 10, 15, 13, 12],
      borderColor: '#3fb950',
      tension: 0.4,
      fill: true
    }]
  },
  stars: {
    // 星数数据
  },
  'ai-ratio': {
    // AI 占比数据
  }
};

// 切换图表数据
document.querySelectorAll('.chart-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // 更新 active 状态
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // 切换数据
    const chartId = tab.dataset.chart;
   Chart”的’d_update(chartData[chartId]);
  });
});
```

### 5.2 折叠面板交互

```javascript
const toggleBtn = document.querySelector('.toggle-btn');
const archiveContent = document.querySelector('.archive-content');

toggleBtn.addEventListener('click', () => {
  const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
  toggleBtn.setAttribute('aria-expanded', !expanded);
  toggleBtn.textContent = expanded ? '展开全部 →' : '收起 ←';
  archiveContent.hidden = expanded;
});
```

---

## 6. 生成逻辑

### 6.1 数据收集

```javascript
function collectData() {
  // 1. 收集日报数据
  const dailyData = readDailyFiles();

  // 2. 收集周报数据
  const weeklyData = readWeeklyFiles();

  // 3. 收集月报数据
  const monthlyData = readMonthlyFiles();

  // 4. 合并所有项目
  const allProjects = [...dailyProjects, ...weeklyProjects, ...monthlyProjects];

  // 5. Top 5 项目（按 Stars 排序）
  const topProjects = allProjects
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, 5);

  // 6. Chart.js 数据
  const chartData = buildChartData(dailyData);

  // 7. 存档数据
  const archives = buildArchives(dailyData, weeklyData, monthlyData);

  // 8. 统计数据
  const stats = buildStats(dailyData, weeklyData, monthlyData, allProjects);

  return { dailyData, weeklyData, monthlyData, topProjects, chartData, archives, stats };
}
```

### 6.2 统计数据计算

```javascript
function buildStats(dailyData, weeklyData, monthlyData, allProjects) {
  return [
    { label: '📅 累计日报', value: dailyData.length },
    { label: '📊 累计周报', value: weeklyData.length },
    { label: '📈 累计月报', value: monthlyData.length },
    { label: '🔍 追踪项目', value: allProjects.length },
    {
      label: '🤖 AI 占比',
      value: `${Math.round(allProjects.filter(p => p.isAI).length / allProjects.length * 100)}%`
    },
    {
      label: '⭐ 平均 Stars',
      value: computeAvgStars(allProjects)
    }
  ];
}
```

---

## 7. 实现计划

| 阶段 | 任务 | 文件 | 估计时间 |
|------|------|------|----------|
| Phase 1 | 更新 HTML 结构 | `scripts/generate-index.js` | 30 min |
| Phase 2 | 更新 CSS 样式 | `public/css/index.css` | 45 min |
| Phase 3 | Chart.js 集成 | `scripts/generate-index.js` + HTML | 30 min |
| Phase 4 | 折叠面板交互 | HTML + JS | 15 min |
| Phase 5 | 测试验证 | 手动测试 | 15 min |

---

## 8. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Chart.js 加载失败 | 中 | 低 | CDN + 本地 fallback |
| 数据文件缺失 | 低 | 中 | 添加错误处理和降级方案 |
| 图表数据格式错误 | 中 | 中 | 数据验证 + 日志记录 |

---

## 9. 验收标准

### 功能验收

- [ ] 统计数字从实际数据文件动态计算
- [ ] Top 5 显示所有项目的综合排名
- [ ] Chart.js 图表可切换 3 个指标
- [ ] 报告存档默认折叠，点击展开
- [ ] 响应式布局在 768px 断点正常

### 视觉验收

- [ ] 与现有报告风格一致（深色主题）
- [ ] 卡片间距和排版一致
- [ ] 按钮和链接可点击状态清晰

---

**文档结束**
