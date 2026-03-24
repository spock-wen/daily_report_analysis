# 月报重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将月报重构为深度分析型行业报告，聚合整月日报 + 周报 + 月榜数据，生成包含趋势演变、TOP 项目评测、数据可视化的专业报告。

**Architecture:**
- MonthlyAggregator：加载并聚合整月数据（日报 30 天 + 周报 4-5 周 + GitHub 月榜）
- MonthlyAnalyzer：AI 深度分析（月度主题、趋势演变、TOP 项目）
- MonthlyGenerator：HTML 报告生成（专业报告风格）
- ChartRenderer：Chart.js 图表渲染（饼图、柱状图、趋势图）

**Tech Stack:** Node.js, Cheerio, Chart.js (CDN), 现有 LLM 基础设施

---

## Phase 1: 数据聚合模块 (MonthlyAggregator)

### Task 1.1: 创建 aggregators 目录结构和工具函数

**Files:**
- Create: `src/scraper/aggregators/index.js`
- Create: `src/scraper/aggregators/monthly-aggregator.js`
- Test: `tests/scraper/monthly-aggregator.test.js`

- [ ] **Step 1: 创建 aggregators 目录和 index.js 导出文件**

```javascript
// src/scraper/aggregators/index.js
const MonthlyAggregator = require('./monthly-aggregator');

module.exports = {
  MonthlyAggregator
};
```

- [ ] **Step 2: 运行测试验证模块加载**

```bash
node -e "const { MonthlyAggregator } = require('./src/scraper/aggregators'); console.log('Module loaded successfully');"
```
Expected: "Module loaded successfully"

- [ ] **Step 3: 提交**

```bash
git add src/scraper/aggregators/
git commit -m "feat: 添加 aggregators 模块导出"
```

---

### Task 1.2: 实现 MonthlyAggregator 基础类和加载方法

**Files:**
- Modify: `src/scraper/aggregators/monthly-aggregator.js`
- Test: `tests/scraper/monthly-aggregator.test.js`

- [ ] **Step 1: 编写测试 - 验证能加载日报数据**

```javascript
// tests/scraper/monthly-aggregator.test.js
const { MonthlyAggregator } = require('../../src/scraper/aggregators');
const fs = require('fs');
const path = require('path');

describe('MonthlyAggregator', () => {
  describe('loadDailyData', () => {
    it('应该加载指定月份的所有日报数据', async () => {
      const aggregator = new MonthlyAggregator();
      const dailyData = await aggregator.loadDailyData('2026-03');

      expect(Array.isArray(dailyData)).toBe(true);
      expect(dailyData.length).toBeGreaterThan(0);
      expect(dailyData[0]).toHaveProperty('date');
      expect(dailyData[0]).toHaveProperty('projects');
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- tests/scraper/monthly-aggregator.test.js
```
Expected: FAIL with "MonthlyAggregator is not a constructor" or similar

- [ ] **Step 3: 实现 MonthlyAggregator 基础类**

```javascript
// src/scraper/aggregators/monthly-aggregator.js
const fs = require('fs');
const path = require('path');
const { getDailyBriefPath, getWeeklyBriefPath } = require('../../utils/path');
const logger = require('../../utils/logger');

/**
 * MonthlyAggregator - 月度数据聚合器
 * 负责加载并聚合整月的日报、周报和 GitHub 月榜数据
 */
class MonthlyAggregator {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.options = {
      dataDir: options.dataDir || path.join(process.cwd(), 'data'),
      ...options
    };
  }

  /**
   * 加载指定月份的所有日报数据
   * @param {string} month - 月份标识 (格式：YYYY-MM，如 "2026-03")
   * @returns {Promise<Array>} 日报数据列表
   */
  async loadDailyData(month) {
    logger.info('[MonthlyAggregator] 开始加载日报数据', { month });

    const [year, monthNum] = month.split('-');
    const dailyData = [];

    // 获取该月的天数
    const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      try {
        const filePath = getDailyBriefPath(dateStr);
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          dailyData.push({
            date: dateStr,
            dayIndex: day - 1,
            projects: data.projects || data.repositories || data.trending_repos || [],
            rawData: data
          });
        }
      } catch (err) {
        logger.warn(`[MonthlyAggregator] 加载 ${dateStr} 日报数据失败：${err.message}`);
      }
    }

    logger.info(`[MonthlyAggregator] 成功加载 ${dailyData.length} 天的日报数据`);
    return dailyData;
  }

  /**
   * 聚合指定月份的完整数据
   * @param {string} month - 月份标识
   * @returns {Promise<Object>} 聚合后的数据
   */
  async aggregate(month) {
    logger.info('[MonthlyAggregator] 开始聚合月度数据', { month });

    // 1. 加载日报数据
    const dailyDataList = await this.loadDailyData(month);

    // 2. 加载周报数据
    const weeklyDataList = await this.loadWeeklyData(month);

    // 3. 计算聚合统计
    const allProjects = this.collectAllProjects(dailyDataList, weeklyDataList);
    const aggregation = this.computeAggregation(allProjects, dailyDataList);

    const result = {
      month,
      generatedAt: new Date().toISOString(),
      dailyDataList,
      weeklyDataList,
      aggregation
    };

    logger.success('[MonthlyAggregator] 月度数据聚合完成', {
      totalProjects: aggregation.totalProjects,
      dailyCount: dailyDataList.length,
      weeklyCount: weeklyDataList.length
    });

    return result;
  }

  /**
   * 收集所有项目（去重前）
   */
  collectAllProjects(dailyData, weeklyData) {
    const projects = [];

    dailyData.forEach(day => {
      day.projects.forEach(project => {
        projects.push({
          ...project,
          firstSeen: day.date,
          lastSeen: day.date,
          appearances: 1,
          source: 'daily'
        });
      });
    });

    weeklyData.forEach(week => {
      week.projects.forEach(project => {
        projects.push({
          ...project,
          firstSeen: week.weekStart,
          lastSeen: week.weekStart,
          appearances: 1,
          source: 'weekly'
        });
      });
    });

    return projects;
  }

  /**
   * 计算聚合统计
   */
  computeAggregation(allProjects, dailyData) {
    // 项目去重
    const projectMap = new Map();
    allProjects.forEach(project => {
      const key = project.repo || project.fullName || project.name;
      if (projectMap.has(key)) {
        const existing = projectMap.get(key);
        existing.appearances++;
        existing.lastSeen = project.firstSeen;
      } else {
        projectMap.set(key, { ...project });
      }
    });

    const deduplicatedProjects = Array.from(projectMap.values());

    // 重复上榜项目（出现 >=2 次）
    const recurringProjects = deduplicatedProjects.filter(p => p.appearances >= 2);

    // 领域分布
    const typeDistribution = this.computeTypeDistribution(deduplicatedProjects);

    // 语言分布
    const languageDistribution = this.computeLanguageDistribution(deduplicatedProjects);

    return {
      totalProjects: deduplicatedProjects.length,
      recurringProjects: recurringProjects.map(p => ({
        repo: p.repo || p.fullName,
        count: p.appearances,
        firstSeen: p.firstSeen,
        lastSeen: p.lastSeen
      })),
      typeDistribution,
      languageDistribution,
      projects: deduplicatedProjects
    };
  }

  /**
   * 计算领域分布
   */
  computeTypeDistribution(projects) {
    const distribution = {};
    projects.forEach(project => {
      const type = project.analysis?.type || project.type || 'other';
      distribution[type] = (distribution[type] || 0) + 1;
    });
    return distribution;
  }

  /**
   * 计算语言分布
   */
  computeLanguageDistribution(projects) {
    const distribution = {};
    projects.forEach(project => {
      const lang = project.language || 'Unknown';
      distribution[lang] = (distribution[lang] || 0) + 1;
    });
    return distribution;
  }
}

module.exports = MonthlyAggregator;
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- tests/scraper/monthly-aggregator.test.js -t "应该加载指定月份的所有日报数据"
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/scraper/aggregators/monthly-aggregator.js tests/scraper/monthly-aggregator.test.js
git commit -m "feat: 实现 MonthlyAggregator 基础类和 loadDailyData 方法"
```

---

### Task 1.3: 实现 loadWeeklyData 方法

**Files:**
- Modify: `src/scraper/aggregators/monthly-aggregator.js`
- Test: `tests/scraper/monthly-aggregator.test.js`

- [ ] **Step 1: 编写测试 - 验证能加载周报数据**

```javascript
// 添加到 tests/scraper/monthly-aggregator.test.js

describe('loadWeeklyData', () => {
  it('应该加载指定月份的所有周报数据', async () => {
    const aggregator = new MonthlyAggregator();
    const weeklyData = await aggregator.loadWeeklyData('2026-03');

    expect(Array.isArray(weeklyData)).toBe(true);
    expect(weeklyData.length).toBeGreaterThan(0);
    expect(weeklyData[0]).toHaveProperty('weekStart');
    expect(weeklyData[0]).toHaveProperty('projects');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- tests/scraper/monthly-aggregator.test.js -t "应该加载指定月份的所有周报数据"
```
Expected: FAIL (方法不存在或返回空数组)

- [ ] **Step 3: 实现 loadWeeklyData 方法**

```javascript
// 添加到 src/scraper/aggregators/monthly-aggregator.js 类中

/**
 * 加载指定月份的所有周报数据
 * @param {string} month - 月份标识 (格式：YYYY-MM)
 * @returns {Promise<Array>} 周报数据列表
 */
async loadWeeklyData(month) {
  logger.info('[MonthlyAggregator] 开始加载周报数据', { month });

  const [year, monthNum] = month.split('-');
  const weeklyData = [];

  // 计算该月包含哪些周
  const firstDayOfMonth = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  const lastDayOfMonth = new Date(parseInt(year), parseInt(monthNum), 0);

  // 获取该月第一天的 ISO 周数
  const firstWeek = this.getISOWeek(firstDayOfMonth);
  const lastWeek = this.getISOWeek(lastDayOfMonth);

  // 加载该月涉及的所有周数据
  for (let week = firstWeek; week <= lastWeek; week++) {
    const weekStr = `${year}-W${String(week).padStart(2, '0')}`;

    try {
      const filePath = getWeeklyBriefPath(weekStr);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        weeklyData.push({
          weekStart: weekStr,
          projects: data.projects || data.repositories || data.trending_repos || [],
          rawData: data
        });
      }
    } catch (err) {
      logger.warn(`[MonthlyAggregator] 加载 ${weekStr} 周报数据失败：${err.message}`);
    }
  }

  logger.info(`[MonthlyAggregator] 成功加载 ${weeklyData.length} 周的周报数据`);
  return weeklyData;
}

/**
 * 计算 ISO 周数
 */
getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- tests/scraper/monthly-aggregator.test.js -t "应该加载指定月份的所有周报数据"
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/scraper/aggregators/monthly-aggregator.js tests/scraper/monthly-aggregator.test.js
git commit -m "feat: 实现 loadWeeklyData 方法"
```

---

### Task 1.4: 实现趋势演变分析（上/中/下旬）

**Files:**
- Modify: `src/scraper/aggregators/monthly-aggregator.js`
- Test: `tests/scraper/monthly-aggregator.test.js`

- [ ] **Step 1: 编写测试 - 验证趋势演变分析**

```javascript
// 添加到 tests/scraper/monthly-aggregator.test.js

describe('computeTrendEvolution', () => {
  it('应该将月度数据分为上/中/下旬并分析趋势', async () => {
    const aggregator = new MonthlyAggregator();

    // 模拟数据
    const dailyData = [
      { date: '2026-03-01', dayIndex: 0, projects: [{ type: 'agent' }] },
      { date: '2026-03-05', dayIndex: 4, projects: [{ type: 'agent' }] },
      { date: '2026-03-10', dayIndex: 9, projects: [{ type: 'llm' }] },
      { date: '2026-03-15', dayIndex: 14, projects: [{ type: 'vision' }] },
      { date: '2026-03-20', dayIndex: 19, projects: [{ type: 'agent' }] },
      { date: '2026-03-25', dayIndex: 24, projects: [{ type: 'speech' }] }
    ];

    const evolution = aggregator.computeTrendEvolution(dailyData);

    expect(evolution).toHaveLength(3);
    expect(evolution[0].period).toBe('上旬');
    expect(evolution[1].period).toBe('中旬');
    expect(evolution[2].period).toBe('下旬');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- tests/scraper/monthly-aggregator.test.js -t "应该将月度数据分为上/中/下旬"
```
Expected: FAIL

- [ ] **Step 3: 实现 computeTrendEvolution 方法**

```javascript
// 添加到 src/scraper/aggregators/monthly-aggregator.js 类中

/**
 * 计算趋势演变（上/中/下旬）
 * @param {Array} dailyData - 日报数据列表
 * @returns {Array} 趋势演变数据
 */
computeTrendEvolution(dailyData) {
  const periods = [
    { name: '上旬', start: 1, end: 10 },
    { name: '中旬', start: 11, end: 20 },
    { name: '下旬', start: 21, end: 31 }
  ];

  return periods.map(period => {
    const periodData = dailyData.filter(d => {
      const day = parseInt(d.date.split('-')[2]);
      return day >= period.start && day <= period.end;
    });

    // 统计该时期的项目类型分布
    const typeCount = {};
    const projects = [];

    periodData.forEach(day => {
      day.projects.forEach(project => {
        const type = project.analysis?.type || project.type || 'other';
        typeCount[type] = (typeCount[type] || 0) + 1;
        projects.push(project);
      });
    });

    // 找出主导类型
    const dominantType = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])[0];

    // 生成日期范围
    const firstDate = periodData[0]?.date || '';
    const lastDate = periodData[periodData.length - 1]?.date || '';

    return {
      period: period.name,
      dates: firstDate && lastDate ? `${firstDate} ~ ${lastDate}` : '',
      projectCount: projects.length,
      dominantType: dominantType ? dominantType[0] : '',
      typeDistribution: typeCount,
      keyProjects: projects.slice(0, 5).map(p => p.repo || p.fullName || p.name)
    };
  });
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- tests/scraper/monthly-aggregator.test.js -t "应该将月度数据分为上/中/下旬"
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/scraper/aggregators/monthly-aggregator.js tests/scraper/monthly-aggregator.test.js
git commit -m "feat: 实现 computeTrendEvolution 趋势演变分析"
```

---

### Task 1.5: 完善聚合方法并导出最终数据结构

**Files:**
- Modify: `src/scraper/aggregators/monthly-aggregator.js`
- Test: `tests/scraper/monthly-aggregator.test.js`

- [ ] **Step 1: 编写端到端测试**

```javascript
// 添加到 tests/scraper/monthly-aggregator.test.js

describe('aggregate - 端到端测试', () => {
  it('应该返回完整的月度聚合数据结构', async () => {
    const aggregator = new MonthlyAggregator();
    const result = await aggregator.aggregate('2026-03');

    // 验证基本结构
    expect(result).toHaveProperty('month', '2026-03');
    expect(result).toHaveProperty('generatedAt');
    expect(result).toHaveProperty('dailyDataList');
    expect(result).toHaveProperty('weeklyDataList');
    expect(result).toHaveProperty('aggregation');

    // 验证聚合统计
    expect(result.aggregation).toHaveProperty('totalProjects');
    expect(result.aggregation).toHaveProperty('recurringProjects');
    expect(result.aggregation).toHaveProperty('typeDistribution');
    expect(result.aggregation).toHaveProperty('languageDistribution');

    // 验证趋势演变
    expect(result.aggregation.trendEvolution).toBeUndefined(); // 后续添加
  });
});
```

- [ ] **Step 2: 更新 aggregate 方法**

```javascript
// 更新 src/scraper/aggregators/monthly-aggregator.js 中的 aggregate 方法

async aggregate(month) {
  logger.info('[MonthlyAggregator] 开始聚合月度数据', { month });

  // 1. 加载日报数据
  const dailyDataList = await this.loadDailyData(month);

  // 2. 加载周报数据
  const weeklyDataList = await this.loadWeeklyData(month);

  // 3. 收集所有项目
  const allProjects = this.collectAllProjects(dailyDataList, weeklyDataList);

  // 4. 计算聚合统计
  const aggregation = this.computeAggregation(allProjects, dailyDataList);

  // 5. 添加趋势演变
  aggregation.trendEvolution = this.computeTrendEvolution(dailyDataList);

  const result = {
    month,
    generatedAt: new Date().toISOString(),
    dailyDataList,
    weeklyDataList,
    aggregation
  };

  logger.success('[MonthlyAggregator] 月度数据聚合完成', {
    totalProjects: aggregation.totalProjects,
    dailyCount: dailyDataList.length,
    weeklyCount: weeklyDataList.length
  });

  return result;
}
```

- [ ] **Step 3: 运行测试验证通过**

```bash
npm test -- tests/scraper/monthly-aggregator.test.js -t "端到端测试"
```
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/scraper/aggregators/monthly-aggregator.js tests/scraper/monthly-aggregator.test.js
git commit -m "feat: 完善 aggregate 方法，添加趋势演变数据"
```

---

## Phase 2: AI 分析模块 (MonthlyAnalyzer)

### Task 2.1: 创建 MonthlyAnalyzer 类

**Files:**
- Create: `src/analyzer/monthly-analyzer.js`
- Test: `tests/analyzer/monthly-analyzer.test.js`

- [ ] **Step 1: 编写测试 - 验证基础分析功能**

```javascript
// tests/analyzer/monthly-analyzer.test.js
const MonthlyAnalyzer = require('../../src/analyzer/monthly-analyzer');

describe('MonthlyAnalyzer', () => {
  describe('analyze', () => {
    it('应该生成月度主题和趋势演变分析', async () => {
      const analyzer = new MonthlyAnalyzer();
      const monthlyData = {
        month: '2026-03',
        aggregation: {
          totalProjects: 50,
          typeDistribution: { agent: 25, llm: 15, vision: 10 },
          trendEvolution: [
            { period: '上旬', dominantType: 'agent' },
            { period: '中旬', dominantType: 'llm' },
            { period: '下旬', dominantType: 'agent' }
          ]
        }
      };

      const insights = await analyzer.analyze(monthlyData);

      expect(insights).toHaveProperty('monthlyTheme');
      expect(insights.monthlyTheme).toHaveProperty('oneLiner');
      expect(insights.monthlyTheme).toHaveProperty('detailed');
      expect(insights).toHaveProperty('trendEvolution');
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- tests/analyzer/monthly-analyzer.test.js
```
Expected: FAIL (文件不存在)

- [ ] **Step 3: 实现 MonthlyAnalyzer 类**

```javascript
// src/analyzer/monthly-analyzer.js
const { callLLM } = require('../utils/llm');
const { writeJson } = require('../utils/fs');
const { getAIInsightsPath } = require('../utils/path');
const logger = require('../utils/logger');
const prompts = require('../../config/prompts.json');

/**
 * MonthlyAnalyzer - 月度 AI 分析器
 * 负责对月度聚合数据进行深度分析，生成月度主题、趋势演变、TOP 项目等洞察
 */
class MonthlyAnalyzer {
  constructor(options = {}) {
    this.options = {
      maxRetries: 3,
      baseDelay: 2000,
      ...options
    };
  }

  /**
   * 分析月度数据
   * @param {Object} monthlyData - 月度聚合数据
   * @returns {Promise<Object>} AI 洞察结果
   */
  async analyze(monthlyData) {
    try {
      logger.info('[MonthlyAnalyzer] 开始分析月度数据', { month: monthlyData.month });

      // 构建提示词
      const prompt = this.buildPrompt(monthlyData);

      // 调用 LLM
      const result = await this.callLLMWithRetry(prompt, {
        temperature: 0.7,
        max_tokens: 4000
      });

      // 解析洞察
      const insights = this.parseInsights(result, monthlyData);

      // 保存洞察
      await this.saveInsights(monthlyData.month, insights);

      logger.success('[MonthlyAnalyzer] 月度 AI 分析完成', {
        month: monthlyData.month,
        hasTheme: !!insights.monthlyTheme,
        hasTopProjects: insights.longTermValue?.length > 0
      });

      return insights;
    } catch (error) {
      logger.error('[MonthlyAnalyzer] 月度 AI 分析失败', { error: error.message });
      return this.getFallbackInsights(error.message);
    }
  }

  /**
   * 构建 AI 提示词
   */
  buildPrompt(data) {
    const systemPrompt = prompts.monthly?.systemPrompt || '你是一位经验丰富的技术趋势观察家...';

    const contextData = {
      month: data.month,
      dailyCount: data.dailyDataList?.length || 0,
      weeklyCount: data.weeklyDataList?.length || 0,
      totalProjects: data.aggregation?.totalProjects || 0,
      recurringCount: data.aggregation?.recurringProjects?.length || 0,
      typeDistribution: data.aggregation?.typeDistribution || {},
      languageDistribution: data.aggregation?.languageDistribution || {},
      trendEvolution: data.aggregation?.trendEvolution || [],
      topProjectCandidates: this.selectTopCandidates(data.aggregation?.projects || [])
    };

    let userPrompt = prompts.monthly?.userPrompt || this.getDefaultUserPrompt();

    // 替换模板变量
    userPrompt = userPrompt
      .replace('{month}', contextData.month)
      .replace('{dailyCount}', contextData.dailyCount)
      .replace('{weeklyCount}', contextData.weeklyCount)
      .replace('{totalProjects}', contextData.totalProjects)
      .replace('{recurringCount}', contextData.recurringCount)
      .replace('{typeDistribution}', JSON.stringify(contextData.typeDistribution, null, 2))
      .replace('{languageDistribution}', JSON.stringify(contextData.languageDistribution, null, 2))
      .replace('{topProjectCandidates}', JSON.stringify(contextData.topProjectCandidates, null, 2));

    return userPrompt;
  }

  /**
   * 获取默认用户提示词
   */
  getDefaultUserPrompt() {
    return `请分析以下月度 GitHub Trending 数据，生成一份深度分析报告。

月份：{month}
数据周期：{dailyCount}天日报 + {weeklyCount}周周报
总项目数（去重）：{totalProjects}

【聚合统计数据】
- 重复上榜项目：{recurringCount}个
- 领域分布：{typeDistribution}
- 语言分布：{languageDistribution}

【趋势演变数据】
{trendEvolution}

【TOP 项目候选】
{topProjectCandidates}

请按照以下格式输出 JSON：
{
  "monthlyTheme": {
    "oneLiner": "一句话总结本月核心趋势（50 字以内）",
    "detailed": "详细解读（500-800 字，有数据支撑）"
  },
  "trendEvolution": [
    {
      "period": "上旬",
      "theme": "阶段主题",
      "keyProjects": ["owner/repo1", "owner/repo2"],
      "analysis": "阶段分析（200-300 字）"
    },
    { "period": "中旬", ... },
    { "period": "下旬", ... }
  ],
  "longTermValue": [
    {
      "repo": "owner/repo",
      "category": "技术创新 | 持续热门 | 企业价值",
      "score": 95,
      "reasons": ["入选理由 1", "入选理由 2"],
      "value": "核心价值描述",
      "sustainability": "高 | 中 | 低"
    }
  ],
  "emergingFields": [
    {
      "field": "领域名称",
      "description": "领域描述（50 字以内）",
      "projects": ["owner/repo1", "owner/repo2"],
      "trend": "上升 | 稳定 | 下降"
    }
  ],
  "darkHorse": {
    "repo": "owner/repo",
    "reason": "入选理由"
  },
  "nextMonthForecast": "下月趋势预测（200-300 字）"
}

要求：
1. monthlyTheme 的 oneLiner 要精炼概括本月核心趋势
2. trendEvolution 要体现上/中/下旬的技术主题变化
3. longTermValue 选择 3-5 个综合评分最高的项目
4. emergingFields 要识别本月涌现的新兴技术领域
5. 所有项目名必须使用完整的 'owner/repo' 格式`;
  }

  /**
   * 选择 TOP 项目候选
   */
  selectTopCandidates(projects) {
    // 按出现次数和 stars 综合排序
    return projects
      .sort((a, b) => {
        const scoreA = (b.appearances || 1) * 10 + (b.stars || 0) / 1000;
        const scoreB = (a.appearances || 1) * 10 + (a.stars || 0) / 1000;
        return scoreB - scoreA;
      })
      .slice(0, 10)
      .map(p => ({
        repo: p.repo || p.fullName,
        appearances: p.appearances || 1,
        stars: p.stars || 0,
        type: p.analysis?.type || p.type || 'other'
      }));
  }

  /**
   * 调用 LLM（带重试）
   */
  async callLLMWithRetry(prompt, options) {
    let lastError;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        logger.info(`[MonthlyAnalyzer] AI 分析中 (${attempt}/${this.options.maxRetries})...`);
        const result = await callLLM(prompt, options);

        if (result && result.trim().length > 0) {
          return result;
        }
        throw new Error('LLM 返回空响应');
      } catch (error) {
        lastError = error;
        logger.warn(`[MonthlyAnalyzer] AI 分析尝试 ${attempt} 失败：${error.message}`);

        if (attempt < this.options.maxRetries) {
          const delay = this.options.baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('AI 分析失败');
  }

  /**
   * 解析 AI 洞察
   */
  parseInsights(llmResponse, monthlyData) {
    try {
      // 清理响应（移除 think 标签）
      let cleanResponse = llmResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      // 提取 JSON
      const markdownMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (markdownMatch) {
        cleanResponse = markdownMatch[1];
      }

      const firstBrace = cleanResponse.indexOf('{');
      const lastBrace = cleanResponse.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('无法从响应中提取 JSON');
      }

      const jsonContent = cleanResponse.substring(firstBrace, lastBrace + 1);
      const insights = JSON.parse(jsonContent);

      // 验证必要字段
      if (!insights.monthlyTheme || !insights.monthlyTheme.oneLiner) {
        throw new Error('AI 响应缺少 monthlyTheme 字段');
      }

      return insights;
    } catch (error) {
      logger.error('[MonthlyAnalyzer] 解析 AI 洞察失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 保存洞察
   */
  async saveInsights(month, insights) {
    try {
      const filePath = getAIInsightsPath('monthly', month);
      await writeJson(filePath, insights);
      logger.info(`[MonthlyAnalyzer] 月度洞察已保存：${filePath}`);
    } catch (error) {
      logger.warn('[MonthlyAnalyzer] 保存洞察失败', { error: error.message });
    }
  }

  /**
   * 降级洞察
   */
  getFallbackInsights(errorMsg) {
    return {
      monthlyTheme: {
        oneLiner: 'AI 分析服务暂时不可用',
        detailed: `无法生成 AI 洞察：${errorMsg}`
      },
      trendEvolution: [],
      longTermValue: [],
      emergingFields: [],
      darkHorse: null,
      nextMonthForecast: '无法生成 AI 预测',
      error: errorMsg
    };
  }
}

module.exports = MonthlyAnalyzer;
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- tests/analyzer/monthly-analyzer.test.js -t "应该生成月度主题"
```
Expected: 取决于实际 LLM 调用结果，可能需要 mock

- [ ] **Step 5: 提交**

```bash
git add src/analyzer/monthly-analyzer.js tests/analyzer/monthly-analyzer.test.js
git commit -m "feat: 实现 MonthlyAnalyzer AI 分析器"
```

---

### Task 2.2: 更新 prompts.json 添加完整的月度提示词

**Files:**
- Modify: `config/prompts.json`

- [ ] **Step 1: 更新 monthly 提示词**

```javascript
// 修改 config/prompts.json 中的 monthly 部分
{
  "monthly": {
    "systemPrompt": "你是一位经验丰富的技术趋势观察家，专注于从 GitHub Trending 数据中发现长期趋势和新兴领域。你的任务是生成月度深度分析报告，识别技术演进模式和具有长期价值的项目。",
    "userPrompt": "请分析以下月度 GitHub Trending 数据，生成一份深度分析报告。\n\n月份：{month}\n数据周期：{dailyCount}天日报 + {weeklyCount}周周报\n总项目数（去重）：{totalProjects}\n\n【聚合统计数据】\n- 重复上榜项目：{recurringCount}个\n- 领域分布：{typeDistribution}\n- 语言分布：{languageDistribution}\n\n【趋势演变数据】\n{trendEvolution}\n\n【TOP 项目候选】\n{topProjectCandidates}\n\n请按照以下 JSON 格式输出：\n{\n  \"monthlyTheme\": {\n    \"oneLiner\": \"一句话总结本月核心趋势（50 字以内）\",\n    \"detailed\": \"详细解读（500-800 字，有数据支撑）\"\n  },\n  \"trendEvolution\": [\n    {\n      \"period\": \"上旬\",\n      \"theme\": \"阶段主题\",\n      \"keyProjects\": [\"owner/repo1\"],\n      \"analysis\": \"阶段分析\"\n    },\n    { \"period\": \"中旬\", ... },\n    { \"period\": \"下旬\", ... }\n  ],\n  \"longTermValue\": [\n    {\n      \"repo\": \"owner/repo\",\n      \"category\": \"技术创新 | 持续热门 | 企业价值\",\n      \"score\": 95,\n      \"reasons\": [\"理由 1\", \"理由 2\"],\n      \"value\": \"核心价值\",\n      \"sustainability\": \"高 | 中 | 低\"\n    }\n  ],\n  \"emergingFields\": [...],\n  \"darkHorse\": { \"repo\": \"...\", \"reason\": \"...\" },\n  \"nextMonthForecast\": \"预测内容\"\n}\n\n要求：\n1. monthlyTheme.oneLiner 精炼概括本月核心趋势\n2. trendEvolution 体现上/中/下旬技术主题变化\n3. longTermValue 选择 3-5 个综合评分最高项目\n4. emergingFields 识别新兴技术领域\n5. 所有项目名使用 'owner/repo' 格式"
  }
}
```

- [ ] **Step 2: 验证 JSON 格式有效**

```bash
node -e "const prompts = require('./config/prompts.json'); console.log('Prompts loaded successfully:', Object.keys(prompts));"
```
Expected: "Prompts loaded successfully: ['daily', 'weekly', 'deepTrends', 'monthly']"

- [ ] **Step 3: 提交**

```bash
git add config/prompts.json
git commit -m "feat: 更新 monthly AI 提示词模板"
```

---

## Phase 3: HTML 生成与图表 (MonthlyGenerator + ChartRenderer)

### Task 3.1: 创建 ChartRenderer 类

**Files:**
- Create: `src/generator/chart-renderer.js`

- [ ] **Step 1: 实现 ChartRenderer**

```javascript
// src/generator/chart-renderer.js
const logger = require('../utils/logger');

/**
 * ChartRenderer - 图表渲染器
 * 负责生成 Chart.js 图表配置和 HTML 容器
 */
class ChartRenderer {
  /**
   * 渲染饼图配置
   * @param {string} chartId - 图表容器 ID
   * @param {Object} data - 数据对象 {labels: [], values: []}
   * @param {Object} options - 配置选项
   * @returns {string} Chart.js 初始化脚本
   */
  renderPieChart(chartId, data, options = {}) {
    const colors = options.colors || this.getDefaultColors(data.labels.length);

    return `
<script>
(function() {
  const ctx = document.getElementById('${chartId}');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ${JSON.stringify(data.labels)},
      datasets: [{
        data: ${JSON.stringify(data.values)},
        backgroundColor: ${JSON.stringify(colors)},
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1) + '%';
              return label + ': ' + value + ' (' + percentage + ')';
            }
          }
        }
      }
    }
  });
})();
</script>`;
  }

  /**
   * 渲染柱状图配置
   */
  renderBarChart(chartId, data, options = {}) {
    const colors = options.colors || this.getDefaultColors(data.labels.length);

    return `
<script>
(function() {
  const ctx = document.getElementById('${chartId}');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(data.labels)},
      datasets: [{
        label: '${options.label || '数量'}',
        data: ${JSON.stringify(data.values)},
        backgroundColor: ${JSON.stringify(colors)},
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
})();
</script>`;
  }

  /**
   * 渲染趋势线图配置
   */
  renderTrendLineChart(chartId, data, options = {}) {
    const colors = options.colors || ['#667eea', '#764ba2', '#f093fb'];

    return `
<script>
(function() {
  const ctx = document.getElementById('${chartId}');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ${JSON.stringify(data.labels)},
      datasets: ${JSON.stringify(data.datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '20',
        tension: 0.4,
        fill: false
      })))}
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
})();
</script>`;
  }

  /**
   * 获取默认颜色方案
   */
  getDefaultColors(count) {
    const colorPalettes = {
      modern: [
        '#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe',
        '#43e97b', '#38f9d7', '#fa709a', '#fee140', '#a8edea'
      ]
    };

    const palette = colorPalettes.modern;
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(palette[i % palette.length]);
    }
    return colors;
  }
}

module.exports = ChartRenderer;
```

- [ ] **Step 2: 提交**

```bash
git add src/generator/chart-renderer.js
git commit -m "feat: 实现 ChartRenderer 图表渲染器"
```

---

### Task 3.2: 创建 monthly.css 样式文件

**Files:**
- Create: `public/css/monthly.css`

- [ ] **Step 1: 创建月报专用样式**

```css
/* public/css/monthly.css - 月报专用样式 */

/* 报告头部 */
.monthly-header {
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 40px;
}

.monthly-header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.monthly-header .month {
  font-size: 1.5rem;
  opacity: 0.9;
  margin-bottom: 10px;
}

.monthly-header .subtitle {
  font-size: 1rem;
  opacity: 0.8;
}

/* 月度概览 */
.monthly-overview {
  margin-bottom: 40px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin: 30px 0;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
}

/* 月度主题 */
.monthly-theme {
  background: white;
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 40px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.monthly-theme h2 {
  color: #667eea;
  margin-bottom: 20px;
}

.theme-content {
  line-height: 1.8;
}

.theme-title {
  font-size: 1.3rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 15px;
}

.theme-description {
  color: #555;
  line-height: 1.8;
}

/* 趋势演变时间线 */
.trend-evolution {
  margin-bottom: 40px;
}

.timeline {
  position: relative;
  padding: 20px 0;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(to bottom, #667eea, #764ba2);
}

.timeline-item {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  position: relative;
}

.timeline-marker {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
  z-index: 1;
}

.timeline-content {
  flex: 1;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.timeline-content h4 {
  color: #667eea;
  margin-bottom: 10px;
}

.timeline-content .dates {
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 10px;
}

/* 数据可视化 */
.data-visualization {
  margin-bottom: 40px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.chart-card h4 {
  text-align: center;
  color: #667eea;
  margin-bottom: 20px;
}

.chart-container {
  position: relative;
  height: 250px;
}

/* TOP 项目 */
.top-projects {
  margin-bottom: 40px;
}

.top-projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.top-project-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.top-project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.top-project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.top-project-name {
  font-size: 1.1rem;
  font-weight: bold;
  color: #667eea;
  text-decoration: none;
}

.top-project-name:hover {
  text-decoration: underline;
}

.category-badge {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
}

.top-project-desc {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 15px;
  line-height: 1.6;
}

.top-project-reason {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
}

.reason-label {
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 5px;
}

.reason-text {
  color: #555;
  font-size: 0.9rem;
  line-height: 1.6;
}

/* 新兴领域 */
.emerging-fields {
  margin-bottom: 40px;
}

.field-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 20px;
}

.field-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.field-name {
  font-size: 1rem;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 10px;
}

.field-description {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 10px;
}

.field-projects {
  font-size: 0.85rem;
  color: #888;
}

.field-projects a {
  color: #667eea;
  text-decoration: none;
}

/* 下月预测 */
.next-month-forecast {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-radius: 12px;
  padding: 30px;
  color: white;
  margin-bottom: 40px;
}

.next-month-forecast h2 {
  margin-bottom: 15px;
}

.forecast-content {
  line-height: 1.8;
}

/* 完整项目列表 */
.full-project-list {
  margin-bottom: 40px;
}

.project-group {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.project-group h3 {
  color: #667eea;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f0f0f0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .monthly-header h1 {
    font-size: 1.8rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .top-projects-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add public/css/monthly.css
git commit -m "feat: 添加月报专用 CSS 样式"
```

---

### Task 3.3: 实现 MonthlyGenerator

**Files:**
- Modify: `src/generator/html-generator.js`

- [ ] **Step 1: 在 HTMLGenerator 中添加 renderMonthlyHTML 方法**

（由于 html-generator.js 已有 `async generateMonthly(monthlyData)` 方法框架，需要实现 `renderMonthlyHTML` 方法）

- [ ] **Step 2: 实现 renderMonthlyHTML**

```javascript
// 添加到 src/generator/html-generator.js 类中

renderMonthlyHTML(data) {
  const { aggregation, aiInsights, month } = data;
  const projects = aggregation?.projects || [];

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub AI 月度趋势报告 - ${month}</title>
  <link rel="stylesheet" href="../../public/css/style.css">
  <link rel="stylesheet" href="../../public/css/monthly.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="container monthly-report">
    <!-- 报告头部 -->
    <header class="monthly-header">
      <h1>GitHub AI 月度趋势报告</h1>
      <div class="month">${month}</div>
      <div class="subtitle">深度分析 · 趋势洞察 · 生态全景</div>
    </header>

    <!-- 月度概览 -->
    ${this.renderMonthlyOverview(aggregation)}

    <!-- 月度主题 -->
    ${this.renderMonthlyTheme(aiInsights?.monthlyTheme, projects)}

    <!-- 趋势演变 -->
    ${this.renderTrendEvolution(aggregation?.trendEvolution, projects)}

    <!-- 数据可视化 -->
    ${this.renderDataVisualization(aggregation)}

    <!-- 月度 TOP 项目 -->
    ${this.renderTopProjects(aiInsights?.longTermValue, projects)}

    <!-- 新兴领域 -->
    ${this.renderEmergingFields(aiInsights?.emergingFields, projects)}

    <!-- 下月预测 -->
    ${this.renderNextMonthForecast(aiInsights?.nextMonthForecast, projects)}

    <!-- 完整项目列表 -->
    ${this.renderFullProjectList(projects)}
  </div>
</body>
</html>`;
}

renderMonthlyOverview(aggregation) {
  const stats = [
    { label: '上榜项目', value: aggregation?.totalProjects || 0 },
    { label: '重复上榜', value: aggregation?.recurringProjects?.length || 0 },
    { label: 'AI 项目占比', value: this.calculateAIPercentage(aggregation) + '%' },
    { label: '数据天数', value: aggregation?.dailyCount || 0 }
  ];

  return `
    <section class="monthly-overview">
      <h2>月度概览</h2>
      <div class="stats-grid">
        ${stats.map(stat => `
          <div class="stat-card">
            <div class="stat-value">${stat.value}</div>
            <div class="stat-label">${stat.label}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

renderMonthlyTheme(theme, projects = []) {
  if (!theme) return '';

  return `
    <section class="monthly-theme">
      <h2>月度主题</h2>
      <div class="theme-content">
        <div class="theme-title">${this.escapeAndLinkify(theme.oneLiner, projects)}</div>
        <div class="theme-description">${this.escapeAndLinkify(theme.detailed, projects)}</div>
      </div>
    </section>
  `;
}

renderTrendEvolution(trendEvolution, projects = []) {
  if (!trendEvolution || trendEvolution.length === 0) return '';

  return `
    <section class="trend-evolution">
      <h2>趋势演变</h2>
      <div class="timeline">
        ${trendEvolution.map(period => `
          <div class="timeline-item">
            <div class="timeline-marker">${period.period}</div>
            <div class="timeline-content">
              <h4>${this.escapeAndLinkify(period.theme || period.dominantType || '', projects)}</h4>
              <div class="dates">${period.dates || ''}</div>
              <p>${this.escapeAndLinkify(period.analysis || '', projects)}</p>
              ${period.keyProjects?.length > 0 ? `
                <div class="key-projects">
                  <strong>关键项目:</strong>
                  ${period.keyProjects.map(p => `<a href="https://github.com/${p}" target="_blank">${p}</a>`).join(', ')}
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

renderDataVisualization(aggregation) {
  const typeData = this.prepareChartData(aggregation?.typeDistribution);
  const langData = this.prepareChartData(aggregation?.languageDistribution);

  return `
    <section class="data-visualization">
      <h2>数据可视化</h2>
      <div class="charts-grid">
        <div class="chart-card">
          <h4>领域分布</h4>
          <div class="chart-container">
            <canvas id="typePieChart"></canvas>
          </div>
          ${this.renderPieChartScript('typePieChart', typeData)}
        </div>
        <div class="chart-card">
          <h4>语言 TOP5</h4>
          <div class="chart-container">
            <canvas id="langBarChart"></canvas>
          </div>
          ${this.renderBarChartScript('langBarChart', langData, 5)}
        </div>
      </div>
    </section>
  `;
}

prepareChartData(distribution) {
  if (!distribution) return { labels: [], values: [] };

  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  return {
    labels: entries.map(e => e[0]),
    values: entries.map(e => e[1])
  };
}

renderPieChartScript(chartId, data) {
  const colors = this.getDefaultColors(data.labels.length);
  return `
    <script>
    (function() {
      const ctx = document.getElementById('${chartId}');
      if (!ctx) return;

      new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ${JSON.stringify(data.labels)},
          datasets: [{
            data: ${JSON.stringify(data.values)},
            backgroundColor: ${JSON.stringify(colors)},
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1) + '%';
                  return label + ': ' + value + ' (' + percentage + ')';
                }
              }
            }
          }
        }
      });
    })();
    </script>
  `;
}

renderBarChartScript(chartId, data, limit = 5) {
  const limitedData = {
    labels: data.labels.slice(0, limit),
    values: data.values.slice(0, limit)
  };
  const colors = this.getDefaultColors(limitedData.labels.length);

  return `
    <script>
    (function() {
      const ctx = document.getElementById('${chartId}');
      if (!ctx) return;

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(limitedData.labels)},
          datasets: [{
            label: '项目数',
            data: ${JSON.stringify(limitedData.values)},
            backgroundColor: ${JSON.stringify(colors)},
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      });
    })();
    </script>
  `;
}

getDefaultColors(count) {
  const palette = [
    '#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe',
    '#43e97b', '#38f9d7', '#fa709a', '#fee140', '#a8edea'
  ];
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(palette[i % palette.length]);
  }
  return colors;
}

calculateAIPercentage(aggregation) {
  const projects = aggregation?.projects || [];
  if (projects.length === 0) return 0;
  const aiCount = projects.filter(p => p.isAI).length;
  return Math.round((aiCount / projects.length) * 100);
}

renderTopProjects(topProjects, allProjects = []) {
  if (!topProjects || topProjects.length === 0) return '';

  const displayProjects = topProjects.slice(0, 5);

  return `
    <section class="top-projects">
      <h2>月度 TOP 项目</h2>
      <div class="top-projects-grid">
        ${displayProjects.map((project, index) => {
          const fullProject = allProjects.find(p => (p.repo || p.fullName) === project.repo);
          const desc = fullProject?.descZh || fullProject?.desc || '';

          return `
            <div class="top-project-card">
              <div class="top-project-header">
                <a href="https://github.com/${project.repo}" target="_blank" class="top-project-name">
                  ${index + 1}. ${project.repo}
                </a>
                ${project.category ? `<span class="category-badge">${project.category}</span>` : ''}
              </div>
              <div class="top-project-desc">${desc || project.value || ''}</div>
              ${project.reasons?.length > 0 ? `
                <div class="top-project-reason">
                  <div class="reason-label">入选理由</div>
                  <div class="reason-text">${project.reasons.join('; ')}</div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

renderEmergingFields(fields, projects = []) {
  if (!fields || fields.length === 0) return '';

  return `
    <section class="emerging-fields">
      <h2>新兴领域</h2>
      <div class="field-list">
        ${fields.map(field => `
          <div class="field-card">
            <div class="field-name">${this.escapeAndLinkify(field.field, projects)}</div>
            <div class="field-description">${this.escapeAndLinkify(field.description, projects)}</div>
            ${field.projects?.length > 0 ? `
              <div class="field-projects">
                代表项目:
                ${field.projects.map(p => `<a href="https://github.com/${p}" target="_blank">${p}</a>`).join(', ')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

renderNextMonthForecast(forecast, projects = []) {
  if (!forecast) return '';

  return `
    <section class="next-month-forecast">
      <h2>下月趋势预测</h2>
      <div class="forecast-content">
        ${this.escapeAndLinkify(forecast, projects)}
      </div>
    </section>
  `;
}

renderFullProjectList(projects) {
  if (!projects || projects.length === 0) return '';

  // 按类型分组
  const grouped = {};
  projects.forEach(project => {
    const type = project.analysis?.type || project.type || 'other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(project);
  });

  return `
    <section class="full-project-list">
      <h2>完整项目列表</h2>
      ${Object.entries(grouped).map(([typeName, typeProjects]) => `
        <div class="project-group">
          <h3>${this.getTypeName(typeName)} (${typeProjects.length}个)</h3>
          <div class="project-list">
            ${typeProjects.map((project, index) => this.renderProjectCard(project, index)).join('')}
          </div>
        </div>
      `).join('')}
    </section>
  `;
}

getTypeName(type) {
  const typeMap = {
    'agent': 'Agent 系统',
    'llm': 'LLM 工具/框架',
    'speech': '语音处理',
    'vision': '视觉处理',
    'code': '代码工具',
    'data': '数据处理',
    'devtool': '开发工具',
    'other': '其他'
  };
  return typeMap[type] || type;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/generator/html-generator.js
git commit -m "feat: 实现月报 HTML 生成方法"
```

---

## Phase 4: 集成与测试

### Task 4.1: 创建月报工作流脚本

**Files:**
- Create: `scripts/run-monthly-workflow.js`

- [ ] **Step 1: 创建月报工作流脚本**

```javascript
/**
 * 月报完整工作流脚本
 * 执行数据聚合 → AI 分析 → HTML 生成 → 更新首页
 */

const { MonthlyAggregator } = require('../src/scraper/aggregators');
const MonthlyAnalyzer = require('../src/analyzer/monthly-analyzer');
const HTMLGenerator = require('../src/generator/html-generator');
const logger = require('../src/utils/logger');

async function runMonthlyWorkflow(month) {
  logger.info('============================================');
  logger.info('🚀 开始执行月报工作流');
  logger.info(`📅 目标月份：${month}`);
  logger.info('============================================');

  const startTime = Date.now();

  try {
    // 步骤 1: 数据聚合
    logger.info('[1/4] 开始聚合月度数据...');
    const aggregator = new MonthlyAggregator();
    const monthlyData = await aggregator.aggregate(month);
    logger.success(`数据聚合完成：${monthlyData.aggregation.totalProjects} 个项目`);

    // 步骤 2: AI 分析
    logger.info('[2/4] 开始 AI 深度分析...');
    const analyzer = new MonthlyAnalyzer();
    const insights = await analyzer.analyze(monthlyData);
    monthlyData.aiInsights = insights;
    logger.success('AI 分析完成');

    // 步骤 3: HTML 生成
    logger.info('[3/4] 开始生成 HTML 报告...');
    const generator = new HTMLGenerator();
    const htmlPath = await generator.generateMonthly(monthlyData);
    logger.success(`HTML 报告已生成：${htmlPath}`);

    // 步骤 4: 更新首页
    logger.info('[4/4] 开始更新首页...');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync('node scripts/generate-index.js', { cwd: process.cwd() });
    logger.success('首页更新完成');

    const duration = Date.now() - startTime;

    logger.success('============================================');
    logger.success('✅ 月报工作流执行完成！');
    logger.success(`📄 报告路径：${htmlPath}`);
    logger.success(`⏱️ 耗时：${duration}ms`);
    logger.success('============================================');

    return {
      success: true,
      month,
      htmlPath,
      duration,
      data: monthlyData
    };
  } catch (error) {
    logger.error('============================================');
    logger.error('❌ 月报工作流执行失败');
    logger.error(`错误：${error.message}`);
    logger.error('============================================');

    return {
      success: false,
      error: error.message,
      month
    };
  }
}

// 执行工作流
const targetMonth = process.argv[2] || new Date().toISOString().slice(0, 7);

runMonthlyWorkflow(targetMonth)
  .then((result) => {
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

module.exports = { runMonthlyWorkflow };
```

- [ ] **Step 2: 测试月报工作流**

```bash
node scripts/run-monthly-workflow.js 2026-03
```

- [ ] **Step 3: 提交**

```bash
git add scripts/run-monthly-workflow.js
git commit -m "feat: 添加月报工作流脚本"
```

---

### Task 4.2: 集成到 complete-workflow 和 report-pipeline

**Files:**
- Modify: `src/scraper/complete-workflow.js`
- Modify: `src/scraper/report-pipeline.js`

- [ ] **Step 1: 更新 report-pipeline.js 添加月度支持**

在 `generateAIInsights` 方法中添加 monthly 分支：

```javascript
// 在 src/scraper/report-pipeline.js 的 generateAIInsights 方法中
async generateAIInsights(data, type) {
  // ... 现有代码 ...

  if (type === 'daily') {
    insights = await this.analyzer.analyzeDaily(analysisData);
  } else if (type === 'weekly') {
    // ... 现有周报代码 ...
  } else if (type === 'monthly') {
    const MonthlyAnalyzer = require('../analyzer/monthly-analyzer');
    const analyzer = new MonthlyAnalyzer();
    insights = await analyzer.analyze(analysisData);
  } else {
    throw new Error(`不支持的报告类型：${type}`);
  }

  // ...
}
```

在 `generateHTML` 方法中，`generateMonthly` 方法已经在 html-generator.js 中实现，只需确保调用正确。

- [ ] **Step 2: 提交**

```bash
git add src/scraper/report-pipeline.js
git commit -m "feat: 在 report-pipeline 中添加月报支持"
```

---

## Phase 5: 文档与最终测试

### Task 5.1: 更新 README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加月报使用说明**

在 README.md 的"快速开始"部分添加：

```markdown
#### 月报工作流

```bash
# 抓取并生成指定月份的月报
node scripts/run-monthly-workflow.js 2026-03
```

月报工作流程：
1. 聚合该月所有日报数据（30 天）
2. 聚合该月所有周报数据（4-5 周）
3. 抓取 GitHub 月榜数据作为补充
4. 计算聚合统计（去重项目、重复上榜、领域分布等）
5. AI 分析生成月度主题、趋势演变、TOP 项目等洞察
6. 生成 HTML 报告（包含数据可视化图表）
7. 更新首页

**报告特点：**
- 深度分析型报告（2000-3000 字）
- 趋势演变分析（上/中/下旬）
- 数据可视化（饼图、柱状图）
- 月度 TOP 项目深度评测（3-5 个）
- 适合公开发布
```

- [ ] **Step 2: 提交**

```bash
git add README.md
git commit -m "docs: 添加月报使用说明"
```

---

### Task 5.2: 端到端测试与 bug 修复

- [ ] **Step 1: 运行完整测试**

```bash
# 运行所有单元测试
npm test

# 测试月报工作流
node scripts/run-monthly-workflow.js 2026-03
```

- [ ] **Step 2: 验证生成的报告**

用浏览器打开生成的月报 HTML 文件，检查：
- [ ] 报告头部正确显示月份
- [ ] 月度概览统计数据正确
- [ ] 月度主题有内容
- [ ] 趋势演变显示上/中/下旬
- [ ] 图表正确渲染（饼图、柱状图）
- [ ] TOP 项目卡片显示
- [ ] 新兴领域有内容
- [ ] 下月预测有内容
- [ ] 完整项目列表按类型分组

- [ ] **Step 3: 修复发现的问题**

根据测试结果修复任何 bug。

- [ ] **Step 4: 提交最终修复**

```bash
git add .
git commit -m "fix: 修复月报生成问题"
```

---

## 完成标准

- [ ] 所有单元测试通过
- [ ] 月报工作流能端到端运行
- [ ] 生成的 HTML 报告包含所有设计章节
- [ ] 图表能正确渲染
- [ ] README 文档已更新
- [ ] 代码已提交到 git

---

**计划文档结束**
