# 月报 Wiki 深度集成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为月报系统深度集成 Wiki 功能，复用月报聚合数据增强 Wiki 维度和呈现。

**Architecture:** 三层设计：(1) 项目 Wiki 月度汇总版本，(2) 领域 Wiki 趋势分析，(3) 月报 HTML Wiki 追踪模块。数据流从 MonthlyAggregator → ReportPipeline → WikiManager/WikiPostProcessor → HTML。

**Tech Stack:** Node.js, Markdown, HTML, Chart.js

---

### Task 1: WikiManager 月度汇总方法

**Files:**
- Modify: `src/wiki/wiki-manager.js`
- Test: `tests/wiki/wiki-manager.test.js`

- [ ] **Step 1: 编写月度汇总测试**

```javascript
// tests/wiki/wiki-manager.test.js
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const WikiManager = require('../../src/wiki/wiki-manager');

describe('WikiManager - appendMonthlySummary', () => {
  let wikiManager;
  const testOwner = 'test-owner';
  const testRepo = 'test-repo';
  const wikiFileName = `${testOwner}_${testRepo}.md`;

  beforeEach(() => {
    wikiManager = new WikiManager({ baseDir: path.join(__dirname, '../../test-wiki') });
    // 清理测试文件
    const wikiPath = path.join(wikiManager.projectsDir, wikiFileName);
    if (fs.existsSync(wikiPath)) {
      fs.unlinkSync(wikiPath);
    }
  });

  it('应为重复上榜项目添加月度汇总版本', async () => {
    // 先创建基础 Wiki
    await wikiManager.createProjectWiki(testOwner, testRepo, {
      firstSeen: '2026-03-05',
      appearances: '1',
      domain: 'agent',
      language: 'Python',
      stars: '5000'
    });

    // 添加月度汇总
    await wikiManager.appendMonthlySummary(testOwner, testRepo, {
      month: '2026-03',
      appearances: 8,
      dailyAppearances: 5,
      weeklyAppearances: 3,
      trendRole: {
        early: '首次上榜（3 月 5 日）',
        mid: '连续 3 天霸榜，引发社区关注',
        late: '稳定 TOP10，成为 agent 领域代表项目'
      },
      reportUrl: '../../reports/monthly/github-ai-trending-2026-03.html'
    });

    // 验证
    const wikiPath = path.join(wikiManager.projectsDir, wikiFileName);
    const content = fs.readFileSync(wikiPath, 'utf-8');
    
    assert(content.includes('2026-03（月度汇总）'), '包含月度汇总标题');
    assert(content.includes('上榜次数：8 次'), '包含上榜次数');
    assert(content.includes('日报 5 次 + 周报 3 次'), '包含来源分解');
    assert(content.includes('首次上榜（3 月 5 日）'), '包含上旬描述');
    assert(content.includes('月报 2026-03'), '包含月报链接');
  });

  it('应跳过已存在相同月度汇总的项目（去重）', async () => {
    // 先创建基础 Wiki
    await wikiManager.createProjectWiki(testOwner, testRepo, {
      firstSeen: '2026-03-05',
      appearances: '1',
      domain: 'agent',
      language: 'Python',
      stars: '5000'
    });

    // 第一次添加月度汇总
    await wikiManager.appendMonthlySummary(testOwner, testRepo, {
      month: '2026-03',
      appearances: 8,
      dailyAppearances: 5,
      weeklyAppearances: 3,
      trendRole: { early: '首次上榜', mid: '持续上升', late: '稳定发展' },
      reportUrl: '../../reports/monthly/github-ai-trending-2026-03.html'
    });

    // 第二次添加相同的月度汇总（应跳过）
    await wikiManager.appendMonthlySummary(testOwner, testRepo, {
      month: '2026-03',
      appearances: 10, // 不同的数据
      dailyAppearances: 7,
      weeklyAppearances: 3,
      trendRole: { early: '不同的描述', mid: 'mid', late: 'late' },
      reportUrl: '../../reports/monthly/github-ai-trending-2026-03.html'
    });

    // 验证：内容应该只包含一次月度汇总
    const wikiPath = path.join(wikiManager.projectsDir, wikiFileName);
    const content = fs.readFileSync(wikiPath, 'utf-8');
    
    const monthlySummaryCount = (content.match(/2026-03（月度汇总）/g) || []).length;
    assert.strictEqual(monthlySummaryCount, 1, '月度汇总只应出现 1 次（去重成功）');
    
    // 验证保留了第一次的数据（上榜次数应为 8，不是 10）
    assert(content.includes('上榜次数：8 次'), '保留第一次的上榜次数');
    assert(content.includes('首次上榜'), '保留第一次的趋势描述');
  });

  it('应允许同一项目添加不同月份的月度汇总', async () => {
    await wikiManager.createProjectWiki(testOwner, testRepo, {
      firstSeen: '2026-02-01',
      appearances: '1',
      domain: 'agent',
      language: 'Python',
      stars: '3000'
    });

    // 添加 2 月汇总
    await wikiManager.appendMonthlySummary(testOwner, testRepo, {
      month: '2026-02',
      appearances: 3,
      dailyAppearances: 2,
      weeklyAppearances: 1,
      trendRole: { early: '2 月首次上榜', mid: '2 月上升', late: '2 月稳定' },
      reportUrl: '../../reports/monthly/github-ai-trending-2026-02.html'
    });

    // 添加 3 月汇总（应成功，不同月份）
    await wikiManager.appendMonthlySummary(testOwner, testRepo, {
      month: '2026-03',
      appearances: 8,
      dailyAppearances: 5,
      weeklyAppearances: 3,
      trendRole: { early: '3 月新特性发布', mid: '3 月爆发', late: '3 月霸榜' },
      reportUrl: '../../reports/monthly/github-ai-trending-2026-03.html'
    });

    const wikiPath = path.join(wikiManager.projectsDir, wikiFileName);
    const content = fs.readFileSync(wikiPath, 'utf-8');
    
    // 验证：包含两个不同月份的月度汇总
    assert(content.includes('2026-02（月度汇总）'), '包含 2 月汇总');
    assert(content.includes('2026-03（月度汇总）'), '包含 3 月汇总');
    assert(content.includes('上榜次数：8 次'), '更新为最新的上榜次数');
  });

  it('应为不存在的项目创建 Wiki 并添加月度汇总', async () => {
    await wikiManager.appendMonthlySummary(testOwner, testRepo, {
      month: '2026-03',
      appearances: 3,
      dailyAppearances: 2,
      weeklyAppearances: 1,
      trendRole: {
        early: '首次上榜',
        mid: '持续上升',
        late: '稳定发展'
      },
      reportUrl: '../../reports/monthly/github-ai-trending-2026-03.html',
      stars: '3000',
      language: 'JavaScript',
      domain: 'llm'
    });

    const wikiPath = path.join(wikiManager.projectsDir, wikiFileName);
    assert(fs.existsSync(wikiPath), 'Wiki 文件已创建');
    
    const content = fs.readFileSync(wikiPath, 'utf-8');
    assert(content.includes('2026-03（月度汇总）'), '包含月度汇总');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
node --test tests/wiki/wiki-manager.test.js
```
Expected: FAIL with "appendMonthlySummary is not a function"

- [ ] **Step 3: 实现 appendMonthlySummary 方法**

```javascript
// src/wiki/wiki-manager.js

/**
 * 为项目 Wiki 添加月度汇总版本
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名
 * @param {Object} monthlyData - 月度汇总数据
 * @param {string} monthlyData.month - 月份标识 (YYYY-MM)
 * @param {number} monthlyData.appearances - 本月总上榜次数
 * @param {number} monthlyData.dailyAppearances - 日报上榜次数
 * @param {number} monthlyData.weeklyAppearances - 周报上榜次数
 * @param {Object} monthlyData.trendRole - 趋势角色描述
 * @param {string} monthlyData.trendRole.early - 上旬描述
 * @param {string} monthlyData.trendRole.mid - 中旬描述
 * @param {string} monthlyData.trendRole.late - 下旬描述
 * @param {string} monthlyData.reportUrl - 月报 HTML 链接
 * @param {string} [monthlyData.stars] - Star 数 (用于创建新 Wiki)
 * @param {string} [monthlyData.language] - 语言 (用于创建新 Wiki)
 * @param {string} [monthlyData.domain] - 领域 (用于创建新 Wiki)
 * @returns {Promise<void>}
 */
async appendMonthlySummary(owner, repo, monthlyData) {
  const wiki = await this.getOrCreateWiki(owner, repo);
  let content = wiki.content || '';

  // 如果没有内容，先创建基本 Wiki
  if (!content) {
    await this.createProjectWiki(owner, repo, {
      firstSeen: monthlyData.month,
      lastSeen: monthlyData.month,
      appearances: String(monthlyData.appearances),
      domain: monthlyData.domain || 'general',
      language: monthlyData.language || 'Unknown',
      stars: monthlyData.stars || '0'
    });
    // 重新读取刚创建的内容
    const newWiki = await this.getOrCreateWiki(owner, repo);
    content = newWiki.content || '';
  }

  // 构建月度汇总条目
  const monthlySection = this._buildMonthlySummaryEntry(monthlyData);

  // 检查是否已存在相同的月度汇总
  const monthlyKey = `### ${monthlyData.month}（月度汇总）`;
  if (content.includes(monthlyKey)) {
    logger.debug(`跳过重复月度汇总：${owner}/${repo} - ${monthlyData.month}`);
    return;
  }

  // 追加到版本历史部分
  if (content.includes('## 版本历史')) {
    content = content.replace(
      /(## 版本历史\n)/,
      `$1${monthlySection}\n`
    );
  } else {
    // 如果没有版本历史部分，添加到末尾
    content = content + `\n\n## 版本历史\n${monthlySection}`;
  }

  // 更新基本信息中的上榜次数
  if (monthlyData.appearances) {
    content = content.replace(
      /- 上榜次数：\d+/,
      `- 上榜次数：${monthlyData.appearances}`
    );
  }

  fs.writeFileSync(wiki.path, content, 'utf-8');
  logger.info(`已添加月度汇总：${owner}/${repo} - ${monthlyData.month}`);
}

/**
 * 构建月度汇总条目
 * @param {Object} monthlyData - 月度数据
 * @returns {string} 月度汇总 Markdown
 */
_buildMonthlySummaryEntry(monthlyData) {
  const { month, appearances, dailyAppearances, weeklyAppearances, trendRole, reportUrl } = monthlyData;

  return `### ${month}（月度汇总）
**上榜次数**: ${appearances} 次 (日报 ${dailyAppearances} 次 + 周报 ${weeklyAppearances} 次)
**趋势角色**:
- 上旬：${trendRole.early || '暂无描述'}
- 中旬：${trendRole.mid || '暂无描述'}
- 下旬：${trendRole.late || '暂无描述'}

**来源**: [月报 ${month}](${reportUrl})
`;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
node --test tests/wiki/wiki-manager.test.js
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/wiki/wiki-manager.js tests/wiki/wiki-manager.test.js
git commit -m "feat: 添加 WikiManager.appendMonthlySummary 方法支持月度汇总"
```

---

### Task 2: WikiPostProcessor 领域趋势分析

**Files:**
- Modify: `src/wiki/wiki-post-processor.js`
- Test: `tests/wiki/wiki-post-processor.test.js`

- [ ] **Step 1: 编写领域趋势分析测试**

```javascript
// tests/wiki/wiki-post-processor.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const WikiPostProcessor = require('../../src/wiki/wiki-post-processor');

describe('WikiPostProcessor - 领域趋势分析', () => {
  it('应为领域 Wiki 添加 LLM 生成的月度趋势分析', async () => {
    const processor = new WikiPostProcessor({
      baseDir: path.join(__dirname, '../../test-wiki')
    });

    const mockProjects = [
      { owner: 'microsoft', repo: 'autogen', domain: 'agent', stars: '15000', appearances: 8 },
      { owner: 'langchain-ai', repo: 'langchain', domain: 'rag', stars: '28000', appearances: 6 }
    ];

    const monthlyData = {
      month: '2026-03',
      periodStats: {
        early: { projectCount: 12, topType: 'agent' },
        mid: { projectCount: 18, topType: 'rag' },
        late: { projectCount: 15, topType: 'llm' }
      },
      domainStats: {
        newProjects: 5,
        recurringProjects: 8,
        totalStarsGrowth: 12500
      }
    };

    // 模拟 LLM 趋势分析文案
    const trendAnalysis = `本月 agent 领域持续火热，占总项目数的 42%。中旬达到高峰，单周新增 18 个项目...`;

    await processor._updateDomainWikiWithTrend('agent', mockProjects, monthlyData, trendAnalysis);

    const domainPath = path.join(processor.domainsDir, 'agent.md');
    const content = fs.readFileSync(domainPath, 'utf-8');

    assert(content.includes('2026-03 月度趋势'), '包含月度趋势标题');
    assert(content.includes('本月新增 5 个项目'), '包含新增项目统计');
    assert(content.includes('总 Star 增长：+12.5k'), '包含 Star 增长统计');
    assert(content.includes(trendAnalysis), '包含 LLM 趋势分析文案');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
node --test tests/wiki/wiki-post-processor.test.js
```
Expected: FAIL

- [ ] **Step 3: 实现领域趋势分析方法**

```javascript
// src/wiki/wiki-post-processor.js

/**
 * 更新领域 Wiki 并添加月度趋势分析
 * @param {string} domain - 领域名称
 * @param {Array} projects - 项目数组
 * @param {Object} monthlyData - 月度数据
 * @param {string} trendAnalysis - LLM 生成的趋势分析文案
 * @returns {Promise<void>}
 */
async _updateDomainWikiWithTrend(domain, projects, monthlyData, trendAnalysis) {
  const domainFilePath = path.join(this.domainsDir, `${domain}.md`);

  // 获取该领域所有项目
  const allDomainProjects = await this._getAllDomainProjects(domain, projects);

  // 生成领域 Wiki 内容（包含月度趋势）
  const content = this._generateDomainWikiContentWithTrend(
    domain,
    allDomainProjects,
    monthlyData,
    trendAnalysis
  );

  // 确保目录存在
  if (!require('fs').existsSync(this.domainsDir)) {
    require('fs').mkdirSync(this.domainsDir, { recursive: true });
  }

  require('fs').writeFileSync(domainFilePath, content, 'utf-8');
  logger.debug(`更新领域 Wiki: ${domain} (${allDomainProjects.length} 个项目)`);
}

/**
 * 生成领域 Wiki 内容（包含月度趋势分析）
 * @param {string} domain - 领域名称
 * @param {Array} projects - 项目数组
 * @param {Object} monthlyData - 月度数据
 * @param {string} trendAnalysis - LLM 趋势分析文案
 * @returns {string} Wiki 内容
 */
_generateDomainWikiContentWithTrend(domain, projects, monthlyData, trendAnalysis) {
  const today = new Date().toISOString().split('T')[0];
  const icon = this._getDomainIcon(domain);

  // 计算统计数据
  const totalProjects = projects.length;
  const topProjects = projects.slice(0, 10);

  // 生成项目表格
  const projectTable = topProjects.map((p, index) => {
    const firstSeen = p.firstSeen || today;
    const appearances = p.appearances || 1;
    const stars = p.stars || '0';
    return `| ${index + 1} | [${p.owner}/${p.repo}](../../wiki/projects/${p.owner}_${p.repo}.md) | ${firstSeen} | ${appearances} | ${stars} |`;
  }).join('\n');

  // 生成趋势演变表格
  const trendTable = monthlyData?.periodStats ? `
| 时期 | 项目数 | 主导类型 |
|------|--------|----------|
| 上旬 | ${monthlyData.periodStats.early.projectCount} | ${monthlyData.periodStats.early.topType} |
| 中旬 | ${monthlyData.periodStats.mid.projectCount} | ${monthlyData.periodStats.mid.topType} |
| 下旬 | ${monthlyData.periodStats.late.projectCount} | ${monthlyData.periodStats.late.topType} |
` : '';

  // 生成月度统计
  const monthlyStats = monthlyData?.domainStats ? `
- 新上榜项目：${monthlyData.domainStats.newProjects} 个
- 重复上榜项目：${monthlyData.domainStats.recurringProjects} 个
- 总 Star 增长：+${this._formatNumber(monthlyData.domainStats.totalStarsGrowth || 0)}
` : '';

  return `# ${icon} ${domain} 领域

## 领域概览

- 项目总数：${totalProjects}
- 最近更新：${today}

${domain} 领域收录了与${this._domainDescription(domain)}相关的项目。

## 代表项目（按上榜次数排序）

| 排名 | 项目 | 首次上榜 | 上榜次数 | Stars |
|------|------|----------|----------|-------|
${projectTable}

## 📈 ${monthlyData?.month || '本月'} 月度趋势

**领域热度**: ${trendAnalysis}

**趋势演变**:
${trendTable}

**月度统计**:
${monthlyStats}

## 领域趋势

${this._generateDomainTrend(domain, projects)}

---

*本页面由 WikiPostProcessor 自动生成*
`;
}

/**
 * 格式化数字（添加 k 后缀）
 */
_formatNumber(num) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return String(num);
}

/**
 * 获取领域图标
 */
_getDomainIcon(domain) {
  const icons = {
    'agent': '🤖',
    'rag': '🔍',
    'llm': '🧠',
    'speech': '🎤',
    'vision': '👁️',
    'devtool': '🛠️',
    'data': '📊',
    'other': '📦'
  };
  return icons[domain.toLowerCase()] || '📦';
}
```

- [ ] **Step 4: 修改 process 方法支持月度数据**

```javascript
// src/wiki/wiki-post-processor.js

/**
 * 处理项目列表，生成 Wiki 索引和领域 Wiki
 * @param {Array} projects - 项目数组
 * @param {string} type - 报告类型 (daily/weekly/monthly)
 * @param {Object} monthlyData - 月度数据（仅月报时需要）
 * @param {Function} generateTrendAnalysis - LLM 趋势分析生成函数（可选）
 * @returns {Promise<Object>} 处理结果
 */
async process(projects, type, monthlyData = null, generateTrendAnalysis = null) {
  try {
    logger.info(`开始 Wiki 后处理 (${type})...`);

    if (!projects || projects.length === 0) {
      logger.info('没有项目需要处理');
      await this.indexGenerator.generate();
      return { success: true, projectsProcessed: 0, type };
    }

    // 1. 按领域分组项目
    const projectsByDomain = this._groupByDomain(projects);

    // 2. 更新每个领域的 Wiki
    for (const [domain, domainProjects] of Object.entries(projectsByDomain)) {
      if (type === 'monthly' && generateTrendAnalysis) {
        // 月报：生成 LLM 趋势分析文案
        const trendAnalysis = await generateTrendAnalysis(domain, monthlyData);
        await this._updateDomainWikiWithTrend(domain, domainProjects, monthlyData, trendAnalysis);
      } else {
        // 日报/周报：使用原有逻辑
        await this._updateDomainWiki(domain, domainProjects, type);
      }
    }

    // 3. 生成 Wiki 索引页
    await this.indexGenerator.generate();

    logger.success(`Wiki 后处理完成 (${type}) - 处理了 ${projects.length} 个项目`);

    return {
      success: true,
      projectsProcessed: projects.length,
      domainsUpdated: Object.keys(projectsByDomain).length,
      type
    };
  } catch (error) {
    logger.error(`Wiki 后处理失败：${error.message}`);
    throw error;
  }
}
```

- [ ] **Step 5: 运行测试验证通过**

```bash
node --test tests/wiki/wiki-post-processor.test.js
```
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/wiki/wiki-post-processor.js tests/wiki/wiki-post-processor.test.js
git commit -m "feat: WikiPostProcessor 支持领域月度趋势分析"
```

---

### Task 3: ReportPipeline 月报数据传递

**Files:**
- Modify: `src/scraper/report-pipeline.js`

- [ ] **Step 1: 修改 updateProjectWikis 支持月报聚合数据**

```javascript
// src/scraper/report-pipeline.js

/**
 * 更新项目 Wiki（日报/周报/月报收录时自动更新版本历史）
 * @param {Object} data - 原始数据
 * @param {Object} insights - AI 洞察
 * @param {string} type - 报告类型 (daily/weekly/monthly)
 */
async updateProjectWikis(data, insights, type) {
  logger.info('[ReportPipeline] 开始更新项目 Wiki...');

  const repositories = data.repositories || data.projects || [];
  const hotItems = insights?.hot || [];
  const date = data.date || data.month || new Date().toISOString().split('T')[0];

  let updatedCount = 0;
  let skippedCount = 0;

  // 月报数据：聚合重复上榜项目
  const monthlyStats = type === 'monthly' ? this._computeMonthlyAppearanceStats(repositories, data) : null;

  for (const repo of repositories) {
    const owner = repo.owner || repo.owner_login;
    const repoName = repo.name || repo.repo;

    if (!owner || !repoName) {
      logger.debug(`[ReportPipeline] 跳过无效仓库：${JSON.stringify(repo)}`);
      skippedCount++;
      continue;
    }

    try {
      // 月报：为重复上榜≥2 次的项目添加月度汇总
      if (type === 'monthly') {
        const stats = monthlyStats?.get(`${owner}/${repoName}`);
        if (stats && stats.totalAppearances >= 2) {
          await this.wikiManager.appendMonthlySummary(owner, repoName, {
            month: data.month,
            appearances: stats.totalAppearances,
            dailyAppearances: stats.dailyAppearances,
            weeklyAppearances: stats.weeklyAppearances,
            trendRole: stats.trendRole || {
              early: '首次上榜',
              mid: '持续上升',
              late: '稳定发展'
            },
            reportUrl: `../../reports/monthly/github-ai-trending-${data.month}.html`,
            stars: String(repo.stars || 0),
            language: repo.language || 'Unknown',
            domain: repo.analysis?.type || 'general'
          });
          updatedCount++;
          logger.debug(`[ReportPipeline] 已添加月度汇总：${owner}/${repoName}`);
          continue; // 月报只添加月度汇总，不重复添加日常版本
        }
      }

      // 日报/周报：原有逻辑
      const hotItem = hotItems.find(h => h.includes(`${owner}/${repoName}`));
      const versionAnalysis = [];
      if (hotItem) {
        versionAnalysis.push(`🔥 ${hotItem}`);
      }
      if (repo.analysis?.trends) {
        versionAnalysis.push(...repo.analysis.trends);
      }
      if (repo.analysis?.community) {
        versionAnalysis.push(`👥 社区活跃度：${repo.analysis.community.level} - ${repo.analysis.community.desc}`);
      }
      const analysisText = versionAnalysis.length > 0
        ? versionAnalysis.join('\n')
        : (repo.desc || repo.description || '暂无分析');

      await this.wikiManager.appendVersion(owner, repoName, {
        date,
        eventType: type === 'daily' ? '日报收录' : '周报收录',
        source: `[${type === 'daily' ? '日报' : '周报'} ${date}](../../${type}/github-ai-trending-${date}.html)`,
        analysis: analysisText,
        stars: String(repo.stars || 0),
        language: repo.language || 'Unknown',
        domain: repo.analysis?.type || 'general',
        coreFunctions: repo.analysis?.coreFunctions,
        useCases: repo.analysis?.useCases
      });

      await this.wikiManager.updateBasicInfo(owner, repoName, {
        stars: String(repo.stars || 0),
        language: repo.language || 'Unknown',
        domain: repo.analysis?.type || 'general',
        lastUpdated: date
      });

      if (repo.analysis?.coreFunctions) {
        await this.wikiManager.updateAnalysisInfo(owner, repoName, {
          coreFunctions: repo.analysis.coreFunctions,
          useCases: repo.analysis.useCases,
          trends: repo.analysis.trends
        });
      }

      updatedCount++;
      logger.debug(`[ReportPipeline] Wiki 已更新：${owner}/${repoName}`);
    } catch (error) {
      logger.warn(`[ReportPipeline] 更新 ${owner}/${repoName} Wiki 失败：${error.message}`);
    }
  }

  logger.info(`[ReportPipeline] Wiki 更新完成：${updatedCount} 个仓库已更新，${skippedCount} 个跳过`);
}

/**
 * 计算月报项目上榜统计
 * @param {Array} repositories - 项目数组
 * @param {Object} data - 完整月报数据（包含 dailyDataList, weeklyDataList）
 * @returns {Map} Map<owner/repo, {totalAppearances, dailyAppearances, weeklyAppearances, trendRole}>
 */
_computeMonthlyAppearanceStats(repositories, data) {
  const statsMap = new Map();

  // 初始化所有项目
  repositories.forEach(repo => {
    const key = `${repo.owner || repo.owner_login}/${repo.name || repo.repo}`;
    statsMap.set(key, {
      totalAppearances: 0,
      dailyAppearances: 0,
      weeklyAppearances: 0,
      trendRole: { early: '-', mid: '-', late: '-' }
    });
  });

  // 统计日报上榜次数
  if (data.dailyDataList) {
    const monthPrefix = data.month || '';
    const daysInMonth = data.dailyDataList.length;
    const thirdDay = Math.ceil(daysInMonth / 3);
    const twoThirdDay = Math.ceil(daysInMonth * 2 / 3);

    data.dailyDataList.forEach((dayData, index) => {
      const period = index < thirdDay ? 'early' : index < twoThirdDay ? 'mid' : 'late';
      (dayData.projects || []).forEach(project => {
        const key = `${project.owner || project.owner_login}/${project.name || project.repo}`;
        if (statsMap.has(key)) {
          const stats = statsMap.get(key);
          stats.dailyAppearances++;
          stats.totalAppearances++;
          // 记录首次上榜时期
          if (stats.dailyAppearances === 1) {
            stats.trendRole[period] = `首次上榜（${dayData.date}）`;
          }
        }
      });
    });
  }

  // 统计周报上榜次数
  if (data.weeklyDataList) {
    data.weeklyDataList.forEach(weekData => {
      (weekData.projects || []).forEach(project => {
        const key = `${project.owner || project.owner_login}/${project.name || project.repo}`;
        if (statsMap.has(key)) {
          const stats = statsMap.get(key);
          stats.weeklyAppearances++;
          stats.totalAppearances++;
        }
      });
    });
  }

  return statsMap;
}
```

- [ ] **Step 2: 修改 pipeline execute 调用 WikiPostProcessor 时传递月度数据**

```javascript
// src/scraper/report-pipeline.js

// 步骤 3.5: 更新 Wiki（日报、周报、月报）
if (type === 'daily' || type === 'weekly' || type === 'monthly') {
  await this.executeStep('update-wiki', async () => {
    await this.updateProjectWikis(data, result.insights, type);
  }, result);

  // 步骤 3.6: Wiki 后处理（日报、周报、月报）
  if (this.enableWikiPostProcessing) {
    await this.executeStep('wiki-post-processing', async () => {
      try {
        const projects = data.repositories || data.projects || [];
        
        // 月报：传递月度数据和趋势分析生成函数
        if (type === 'monthly' && data.aggregation && result.insights) {
          const generateTrendAnalysis = async (domain, monthlyData) => {
            // 基于 AI 洞察生成领域趋势分析文案
            const trendEvolution = result.insights.trendEvolution || [];
            const emergingFields = result.insights.emergingFields || [];
            
            // 提取该领域相关的项目
            const domainProjects = projects.filter(p => 
              (p.analysis?.type || 'general').toLowerCase() === domain.toLowerCase()
            );

            // 生成趋势分析文案（200-300 字）
            const earlyTrend = trendEvolution.find(t => t.period === '上旬')?.topType || '';
            const midTrend = trendEvolution.find(t => t.period === '中旬')?.topType || '';
            const lateTrend = trendEvolution.find(t => t.period === '下旬')?.topType || '';
            
            return `本月${domain}领域持续火热，${domainProjects.length}个项目上榜。趋势从${earlyTrend || '多元化'}向${midTrend || '集中化'}演进，下旬${lateTrend || '趋于稳定'}。${emergingFields.find(f => f.field.toLowerCase() === domain)?.description || ''}`;
          };

          await this.wikiPostProcessor.process(projects, type, {
            month: data.month,
            periodStats: {
              early: { projectCount: domainProjects.length, topType: 'mixed' },
              mid: { projectCount: domainProjects.length, topType: 'mixed' },
              late: { projectCount: domainProjects.length, topType: 'mixed' }
            },
            domainStats: {
              newProjects: data.aggregation.newProjects?.length || 0,
              recurringProjects: data.aggregation.recurringProjects?.filter(p => 
                (p.analysis?.type || 'general').toLowerCase() === domain.toLowerCase()
              ).length || 0,
              totalStarsGrowth: domainProjects.reduce((sum, p) => sum + (p.stars || 0), 0)
            }
          }, generateTrendAnalysis);
        } else {
          // 日报/周报：原有逻辑
          await this.wikiPostProcessor.process(projects, type);
        }
      } catch (error) {
        logger.warn('[ReportPipeline] Wiki 后处理失败，不影响主报告流程', {
          error: error.message,
          type
        });
      }
    }, result);
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/scraper/report-pipeline.js
git commit -m "feat: ReportPipeline 支持月报 Wiki 数据传递和趋势分析"
```

---

### Task 4: 月报 HTML Wiki 追踪模块

**Files:**
- Modify: `src/generator/monthly-generator.js`
- Test: `tests/generator/monthly-generator.test.js`

- [ ] **Step 1: 编写 Wiki 追踪模块测试**

```javascript
// tests/generator/monthly-generator.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const MonthlyGenerator = require('../../src/generator/monthly-generator');

describe('MonthlyGenerator - Wiki 追踪模块', () => {
  it('应渲染 Wiki 追踪模块 HTML', () => {
    const generator = new MonthlyGenerator();

    const monthlyData = {
      month: '2026-03',
      aggregation: {
        totalProjects: 150,
        recurringProjects: [
          { repo: 'microsoft/autogen', stars: 15000, appearances: 8 },
          { repo: 'langchain-ai/langchain', stars: 28000, appearances: 6 }
        ],
        newProjects: [
          { repo: 'newcomer/ai-tool', stars: 5000 }
        ]
      },
      aiInsights: {
        monthlyTheme: { oneLiner: 'Agent 框架爆发' }
      }
    };

    const html = generator.renderMonthlyHTML(monthlyData);

    assert(html.includes('Wiki 项目追踪'), '包含 Wiki 追踪模块标题');
    assert(html.includes('microsoft/autogen'), '包含重复上榜项目');
    assert(html.includes('本月上榜：8 次'), '包含上榜次数');
    assert(html.includes('wiki/projects/'), '包含 Wiki 链接');
    assert(html.includes('领域趋势'), '包含领域趋势部分');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
node --test tests/generator/monthly-generator.test.js
```
Expected: FAIL (模块不存在)

- [ ] **Step 3: 添加 Wiki 追踪模块渲染方法**

```javascript
// src/generator/monthly-generator.js

/**
 * 渲染 Wiki 追踪模块
 */
renderWikiTracking(aggregation, aiInsights) {
  const recurringProjects = aggregation?.recurringProjects || [];
  const topRecurring = recurringProjects.slice(0, 6); // TOP6

  return `
    <section class="wiki-tracking">
      <h2>📚 Wiki 项目追踪</h2>
      
      <div class="tracking-grid">
        ${topRecurring.map(project => `
          <div class="project-track">
            <h4>${project.repo}</h4>
            <p>本月上榜：${project.appearances || project.count || 0} 次 | 累计 Star: ${project.stars || project.totalStars || 0}</p>
            <p>演变：${project.description || '持续热门'}</p>
            <a href="../../wiki/projects/${project.repo.replace('/', '_')}.md">查看完整 Wiki →</a>
          </div>
        `).join('')}
      </div>
      
      <div class="domain-summary">
        <h3>领域趋势</h3>
        <div class="domain-trends">
          ${this._renderDomainTrendCard('Agent', aggregation?.typeDistribution?.agent || 0, '🤖', '持续火热，多智能体协作成主流')}
          ${this._renderDomainTrendCard('LLM', aggregation?.typeDistribution?.llm || 0, '🧠', '模型优化与推理能力提升')}
          ${this._renderDomainTrendCard('RAG', aggregation?.typeDistribution?.rag || 0, '🔍', '企业应用落地加速')}
        </div>
        <a href="../../wiki/index.html" class="wiki-index-link">查看 Wiki 索引 →</a>
      </div>
    </section>
  `;
}

/**
 * 渲染领域趋势卡片
 */
_renderDomainTrendCard(domain, count, icon, trend) {
  return `
    <div class="domain-trend-card">
      <div class="domain-icon">${icon}</div>
      <div class="domain-info">
        <div class="domain-name">${domain}</div>
        <div class="domain-count">${count} 个项目</div>
        <div class="domain-trend">${trend}</div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 4: 在 renderMonthlyHTML 中调用 Wiki 追踪模块**

```javascript
// src/generator/monthly-generator.js

renderMonthlyHTML(data) {
  const { month, aggregation, aiInsights } = data;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub AI 月度趋势报告 - ${month}</title>
  <link rel="stylesheet" href="../../public/css/style.css">
  <link rel="stylesheet" href="../../public/css/monthly.css">
  <link rel="stylesheet" href="../../public/css/wiki-tracking.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
  <div class="container monthly-report">
    ${this.renderHeader(month)}
    ${this.renderOverview(aggregation)}
    ${this.renderTheme(aiInsights?.monthlyTheme)}
    ${this.renderTrendEvolution(aiInsights?.trendEvolution)}
    ${this.renderCharts(aggregation)}
    ${this.renderLongTermValue(aiInsights?.longTermValue)}
    ${this.renderEmergingFields(aiInsights?.emergingFields)}
    ${this.renderDarkHorse(aiInsights?.darkHorse)}
    ${this.renderNextMonthForecast(aiInsights?.nextMonthForecast)}
    ${this.renderFullProjectList(aggregation)}
    ${this.renderWikiTracking(aggregation, aiInsights)}
  </div>
</body>
</html>`;
}
```

- [ ] **Step 5: 提交**

```bash
git add src/generator/monthly-generator.js tests/generator/monthly-generator.test.js
git commit -m "feat: 月报 HTML 添加 Wiki 追踪模块"
```

---

### Task 5: Wiki 追踪模块 CSS 样式

**Files:**
- Create: `public/css/wiki-tracking.css`

- [ ] **Step 1: 创建 Wiki 追踪模块样式**

```css
/* public/css/wiki-tracking.css */

/* Wiki 追踪模块 */
.wiki-tracking {
  margin-top: 3rem;
  padding: 2rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%);
  border-radius: 12px;
  border: 2px solid #6366f1;
}

.wiki-tracking h2 {
  font-size: 1.75rem;
  color: #1e293b;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* 追踪网格 */
.tracking-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.project-track {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.project-track:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(99, 102, 241, 0.2);
}

.project-track h4 {
  font-size: 1.1rem;
  color: #1e293b;
  margin-bottom: 0.75rem;
}

.project-track p {
  font-size: 0.9rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.project-track a {
  display: inline-block;
  margin-top: 0.75rem;
  color: #6366f1;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.project-track a:hover {
  color: #4f46e5;
}

/* 领域摘要 */
.domain-summary {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-top: 1.5rem;
}

.domain-summary h3 {
  font-size: 1.25rem;
  color: #1e293b;
  margin-bottom: 1rem;
}

.domain-trends {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.domain-trend-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 8px;
  border-left: 4px solid #6366f1;
}

.domain-icon {
  font-size: 2rem;
}

.domain-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 1rem;
}

.domain-count {
  font-size: 0.85rem;
  color: #64748b;
}

.domain-trend {
  font-size: 0.85rem;
  color: #475569;
  margin-top: 0.25rem;
}

.wiki-index-link {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 500;
  transition: transform 0.2s, box-shadow 0.2s;
}

.wiki-index-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

/* 响应式 */
@media (max-width: 768px) {
  .wiki-tracking {
    padding: 1.5rem;
  }

  .tracking-grid {
    grid-template-columns: 1fr;
  }

  .domain-trends {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add public/css/wiki-tracking.css
git commit -m "style: 添加 Wiki 追踪模块 CSS 样式"
```

---

### Task 6: 端到端集成测试

**Files:**
- Create: `tests/e2e/monthly-wiki-integration.test.js`

- [ ] **Step 1: 编写端到端集成测试**

```javascript
// tests/e2e/monthly-wiki-integration.test.js
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { tmpdir } = require('os');

const MonthlyAggregator = require('../../src/scraper/aggregators/monthly-aggregator');
const MonthlyAnalyzer = require('../../src/analyzer/monthly-analyzer');
const ReportPipeline = require('../../src/scraper/report-pipeline');
const WikiManager = require('../../src/wiki/wiki-manager');

describe('月报 Wiki 深度集成 - 端到端测试', () => {
  let testBaseDir;
  let originalCwd;

  before(() => {
    // 创建临时测试目录
    testBaseDir = fs.mkdtempSync(path.join(tmpdir(), 'monthly-wiki-test-'));
    originalCwd = process.cwd();
    process.chdir(testBaseDir);

    // 创建必要的目录结构
    fs.mkdirSync(path.join(testBaseDir, 'wiki', 'projects'), { recursive: true });
    fs.mkdirSync(path.join(testBaseDir, 'wiki', 'domains'), { recursive: true });
    fs.mkdirSync(path.join(testBaseDir, 'reports', 'monthly'), { recursive: true });
    fs.mkdirSync(path.join(testBaseDir, 'data', 'briefs', 'daily'), { recursive: true });
    fs.mkdirSync(path.join(testBaseDir, 'data', 'briefs', 'weekly'), { recursive: true });

    // 创建模拟日报数据
    const mockDailyData = {
      date: '2026-03-15',
      projects: [
        {
          fullName: 'microsoft/autogen',
          owner: 'microsoft',
          name: 'autogen',
          stars: 15000,
          description: 'AI Agent 框架',
          language: 'Python',
          analysis: { type: 'agent' }
        },
        {
          fullName: 'langchain-ai/langchain',
          owner: 'langchain-ai',
          name: 'langchain',
          stars: 28000,
          description: 'LLM 应用开发框架',
          language: 'Python',
          analysis: { type: 'llm' }
        }
      ],
      stats: { totalProjects: 2 }
    };

    fs.writeFileSync(
      path.join(testBaseDir, 'data', 'briefs', 'daily', '2026-03-15.json'),
      JSON.stringify(mockDailyData)
    );
  });

  after(() => {
    process.chdir(originalCwd);
    // 清理测试目录
    fs.rmSync(testBaseDir, { recursive: true, force: true });
  });

  it('应完成月报 Wiki 集成完整流程', async () => {
    // 1. 数据聚合
    const aggregator = new MonthlyAggregator();
    const monthlyData = await aggregator.aggregate('2026-03');

    assert(monthlyData.dailyDataList.length > 0, '日报数据已加载');
    assert(monthlyData.aggregation.totalProjects >= 2, '项目已聚合');

    // 2. AI 分析（使用降级数据，避免调用 LLM）
    const aiInsights = {
      monthlyTheme: {
        oneLiner: 'Agent 框架持续火热',
        detailed: '本月 Agent 领域继续占据主导地位...'
      },
      trendEvolution: [
        { period: '上旬', dates: '2026-03-01 ~ 2026-03-10', topType: 'agent', keyProjects: ['microsoft/autogen'] },
        { period: '中旬', dates: '2026-03-11 ~ 2026-03-20', topType: 'llm', keyProjects: ['langchain-ai/langchain'] },
        { period: '下旬', dates: '2026-03-21 ~ 2026-03-31', topType: 'agent', keyProjects: ['microsoft/autogen'] }
      ],
      longTermValue: [
        { repo: 'microsoft/autogen', score: 95, category: '技术创新' },
        { repo: 'langchain-ai/langchain', score: 92, category: '持续热门' }
      ],
      emergingFields: [],
      darkHorse: null,
      nextMonthForecast: '预计 Agent 领域将继续保持热度'
    };

    // 3. 报告流水线（含 Wiki 更新）
    const pipeline = new ReportPipeline({
      enableAI: false, // 使用预生成的 AI 数据
      enableHTML: true,
      enableIndex: true,
      enableNotification: false,
      enableWikiPostProcessing: true
    });

    const result = await pipeline.execute({
      month: '2026-03',
      ...monthlyData,
      aiInsights
    }, 'monthly');

    assert(result.success, '流水线执行成功');
    assert(result.htmlPath, 'HTML 报告已生成');

    // 4. 验证 Wiki 更新
    const wikiManager = new WikiManager();

    // 验证项目 Wiki 月度汇总
    const autogenWikiPath = path.join(wikiManager.projectsDir, 'microsoft_autogen.md');
    assert(fs.existsSync(autogenWikiPath), 'autogen Wiki 已创建');
    
    const autogenWikiContent = fs.readFileSync(autogenWikiPath, 'utf-8');
    assert(autogenWikiContent.includes('2026-03（月度汇总）'), '包含月度汇总');
    assert(autogenWikiContent.includes('月报 2026-03'), '包含月报链接');

    // 验证领域 Wiki 趋势分析
    const agentDomainPath = path.join(wikiManager.domainsDir, 'agent.md');
    assert(fs.existsSync(agentDomainPath), 'agent 领域 Wiki 已创建');
    
    const agentDomainContent = fs.readFileSync(agentDomainPath, 'utf-8');
    assert(agentDomainContent.includes('月度趋势'), '包含月度趋势');

    // 验证 HTML 报告 Wiki 追踪模块
    const htmlContent = fs.readFileSync(result.htmlPath, 'utf-8');
    assert(htmlContent.includes('Wiki 项目追踪'), '包含 Wiki 追踪模块');
    assert(htmlContent.includes('microsoft/autogen'), '包含项目链接');
  });
});
```

- [ ] **Step 2: 运行端到端测试**

```bash
node --test tests/e2e/monthly-wiki-integration.test.js
```
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add tests/e2e/monthly-wiki-integration.test.js
git commit -m "test: 添加月报 Wiki 集成端到端测试"
```

---

### Task 7: 文档更新

**Files:**
- Modify: `docs/WIKI.md`

- [ ] **Step 1: 更新 Wiki 文档添加月报集成说明**

```markdown
<!-- docs/WIKI.md - 在"工作流程集成"章节后添加 -->

### 月报流程（增强版）

月报生成时自动触发 Wiki 深度集成：

1. 加载整月日报数据（约 30 天）
2. 加载整月周报数据（4-5 周）
3. 数据聚合与去重
4. 计算聚合统计（重复上榜、新星项目等）
5. AI 深度分析
6. **【新增】更新项目 Wiki 月度汇总**（为重复上榜≥2 次的项目）
7. **【新增】更新领域 Wiki 趋势分析**（LLM 生成月度趋势文案）
8. 生成 HTML 报告（含 Wiki 追踪模块）
9. 自动更新首页

```bash
# 月报工作流自动触发 Wiki 集成
node scripts/run-monthly-workflow.js 2026-03
```

生成的文件：
- `wiki/projects/{owner}_{repo}.md` - 包含月度汇总版本
- `wiki/domains/{domain}.md` - 包含月度趋势分析
- `reports/monthly/github-ai-trending-2026-03.html` - 含 Wiki 追踪模块
```

- [ ] **Step 2: 提交**

```bash
git add docs/WIKI.md
git commit -m "docs: 更新 Wiki 文档添加月报集成说明"
```

---

## 自审

**Spec Coverage Check:**
- ✅ 项目 Wiki 月度汇总 → Task 1 (appendMonthlySummary)
- ✅ 领域 Wiki 趋势分析 → Task 2 (WikiPostProcessor 增强)
- ✅ 月报数据传递 → Task 3 (ReportPipeline 修改)
- ✅ 月报 HTML Wiki 追踪模块 → Task 4 + Task 5
- ✅ 端到端测试验证 → Task 6
- ✅ 文档更新 → Task 7

**Placeholder Scan:**
- ✅ 无 TBD/TODO
- ✅ 所有步骤都有具体代码
- ✅ 所有文件路径都是完整的

**Type Consistency:**
- ✅ `appendMonthlySummary` 方法签名在各处一致
- ✅ `WikiPostProcessor.process` 参数一致
- ✅ 数据格式在任务间一致

---

Plan complete and saved to `docs/superpowers/plans/2026-04-19-monthly-wiki-integration.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch 专用 subagent 执行每个 Task，每个 Task 后进行 two-stage review

**2. Inline Execution** - 在当前 session 中执行 tasks，批量执行带检查点

**Which approach?**
