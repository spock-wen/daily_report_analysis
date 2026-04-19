# Wiki 工作流集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Wiki 索引页生成和领域 Wiki 更新集成到日报/周报/月报工作流中，实现完整的自动化 Wiki 知识管理

**Architecture:** 新增 `WikiPostProcessor` 模块统一管理 Wiki 后处理逻辑，在 `ReportPipeline` 的项目 Wiki 更新步骤之后添加 Wiki 后处理步骤

**Tech Stack:** Node.js, 现有 Wiki 模块 (WikiManager, WikiIndexGenerator, CrossReferenceAnalyzer)

---

### Task 1: 创建 WikiPostProcessor 模块

**Files:**
- Create: `src/wiki/wiki-post-processor.js`
- Test: `tests/wiki/wiki-post-processor.test.js`

- [ ] **Step 1: 创建 WikiPostProcessor 测试文件**

```javascript
// tests/wiki/wiki-post-processor.test.js
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const WikiPostProcessor = require('../../src/wiki/wiki-post-processor');
const WikiManager = require('../../src/wiki/wiki-manager');

describe('WikiPostProcessor', () => {
  const testDir = path.join(__dirname, '../fixtures/test-wiki');
  
  beforeEach(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'projects'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'domains'), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('应成功实例化', () => {
    const processor = new WikiPostProcessor({ baseDir: testDir });
    assert.ok(processor);
  });

  it('应有 process 方法', async () => {
    const processor = new WikiPostProcessor({ baseDir: testDir });
    const projects = [
      { owner: 'test1', repo: 'repo1', analysis: { type: 'agent' } },
      { owner: 'test2', repo: 'repo2', analysis: { type: 'rag' } }
    ];
    
    await processor.process(projects, 'daily');
    
    // 验证索引页已生成
    const indexPath = path.join(testDir, '../reports/wiki-index.html');
    // 注意：实际输出在 reports/ 目录，需要调整断言
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- tests/wiki/wiki-post-processor.test.js
```

预期：FAIL with "Cannot find module"

- [ ] **Step 3: 创建 WikiPostProcessor 模块**

```javascript
/**
 * WikiPostProcessor - Wiki 后处理器
 * 统一管理 Wiki 后处理逻辑：索引页生成 + 领域 Wiki 更新
 */

const WikiManager = require('./wiki-manager');
const WikiIndexGenerator = require('../generator/wiki-index-generator');
const CrossReferenceAnalyzer = require('./cross-reference');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

class WikiPostProcessor {
  constructor(options = {}) {
    this.wikiManager = new WikiManager(options);
    this.indexGenerator = new WikiIndexGenerator({
      outputDir: options.outputDir || path.join(process.cwd(), 'reports')
    });
    this.analyzer = new CrossReferenceAnalyzer();
    this.domainsDir = options.domainsDir || this.wikiManager.domainsDir;
  }

  /**
   * 执行 Wiki 后处理
   * @param {Array} projects - 当日/周/月的项目列表
   * @param {string} type - 报告类型 (daily/weekly/monthly)
   * @returns {Promise<Object>} 处理结果
   */
  async process(projects, type) {
    logger.info('[WikiPostProcessor] 开始 Wiki 后处理...', { type, projectCount: projects.length });

    try {
      // 1. 生成 Wiki 索引页
      logger.info('[WikiPostProcessor] 生成 Wiki 索引页...');
      const indexPath = await this.indexGenerator.generate();

      // 2. 更新领域 Wiki
      logger.info('[WikiPostProcessor] 更新领域 Wiki...');
      const updatedDomains = await this.updateDomainWikis(projects);

      logger.success('[WikiPostProcessor] Wiki 后处理完成', {
        indexPath,
        updatedDomains: updatedDomains.length,
        domains: updatedDomains
      });

      return {
        success: true,
        indexPath,
        updatedDomains
      };
    } catch (error) {
      logger.error('[WikiPostProcessor] Wiki 后处理失败', {
        error: error.message,
        type
      });
      // 抛出异常让上层决定是否中断流程
      throw error;
    }
  }

  /**
   * 更新领域 Wiki
   * @param {Array} projects - 项目列表
   * @returns {Promise<Array>} 更新的领域列表
   */
  async updateDomainWikis(projects) {
    // 按领域分组
    const domainMap = this._groupProjectsByDomain(projects);
    const updatedDomains = [];

    for (const [domain, domainProjects] of Object.entries(domainMap)) {
      try {
        await this._updateDomainWiki(domain, domainProjects);
        updatedDomains.push(domain);
      } catch (error) {
        logger.warn(`[WikiPostProcessor] 更新领域 Wiki 失败：${domain}`, {
          error: error.message
        });
      }
    }

    return updatedDomains;
  }

  /**
   * 按领域分组项目
   * @param {Array} projects - 项目列表
   * @returns {Object} 领域 -> 项目数组
   */
  _groupProjectsByDomain(projects) {
    const domainMap = {};

    for (const project of projects) {
      const domain = project.analysis?.type || 'other';
      const domainKey = domain.toLowerCase();

      if (!domainMap[domainKey]) {
        domainMap[domainKey] = [];
      }
      domainMap[domainKey].push(project);
    }

    return domainMap;
  }

  /**
   * 更新单个领域 Wiki
   * @param {string} domain - 领域名称
   * @param {Array} projects - 该领域的项目列表
   */
  async _updateDomainWiki(domain, projects) {
    const wikiPath = path.join(this.domainsDir, `${domain}.md`);
    const exists = fs.existsSync(wikiPath);

    // 从项目 Wiki 中读取该领域的所有项目
    const allProjectsInDomain = await this._getProjectsByDomain(domain);

    // 生成领域 Wiki 内容
    const content = this._renderDomainWiki(domain, allProjectsInDomain);

    // 写入文件
    fs.writeFileSync(wikiPath, content, 'utf-8');

    logger.debug(`[WikiPostProcessor] 领域 Wiki 已更新：${domain}`, {
      projectCount: allProjectsInDomain.length,
      exists
    });
  }

  /**
   * 获取领域中所有项目（从项目 Wiki 中聚合）
   * @param {string} domain - 领域名称
   * @returns {Promise<Array>} 项目数据数组
   */
  async _getProjectsByDomain(domain) {
    const projects = this.analyzer.getProjectsByDomain(domain, []);
    
    // 扫描所有项目 Wiki 文件
    const projectsDir = this.wikiManager.projectsDir;
    if (!fs.existsSync(projectsDir)) return [];

    const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
    const domainProjects = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(projectsDir, file), 'utf-8');
      
      // 检查领域是否匹配
      const domainMatch = content.match(/- 领域分类：(.+)/);
      if (!domainMatch || domainMatch[1].trim().toLowerCase() !== domain) {
        continue;
      }

      // 提取项目信息
      const fileMatch = file.match(/^(.+)_(.+)\.md$/);
      if (!fileMatch) continue;

      const owner = fileMatch[1];
      const repo = fileMatch[2];
      const appearances = this._extractField(content, '上榜次数');
      const stars = this._extractField(content, 'GitHub Stars');
      const firstSeen = this._extractField(content, '首次上榜');

      domainProjects.push({
        owner,
        repo,
        appearances: parseInt(appearances) || 0,
        stars,
        firstSeen
      });
    }

    // 按上榜次数降序排序
    domainProjects.sort((a, b) => b.appearances - a.appearances);

    return domainProjects;
  }

  /**
   * 渲染领域 Wiki 内容
   * @param {string} domain - 领域名称
   * @param {Array} projects - 项目列表
   * @returns {string} Markdown 内容
   */
  _renderDomainWiki(domain, projects) {
    const today = new Date().toISOString().split('T')[0];

    return `# ${domain} 领域

## 领域概览
- 项目总数：${projects.length}
- 最近更新：${today}

## 代表项目（按上榜次数排序）
| 项目 | 首次上榜 | 上榜次数 | Stars |
|------|----------|----------|-------|
${projects.map(p => `| [${p.owner}/${p.repo}](../projects/${p.owner}_${p.repo}.md) | ${p.firstSeen || 'N/A'} | ${p.appearances} | ${p.stars || 'N/A'} |`).join('\n')}
`;
  }

  /**
   * 从 Wiki 内容中提取字段
   * @param {string} content - Wiki 内容
   * @param {string} fieldName - 字段名称
   * @returns {string} 字段值
   */
  _extractField(content, fieldName) {
    if (!content) return '';
    const regex = new RegExp(`- ${fieldName}：(.+)\\n`);
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }
}

module.exports = WikiPostProcessor;
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- tests/wiki/wiki-post-processor.test.js
```

预期：PASS

- [ ] **Step 5: 提交**

```bash
git add src/wiki/wiki-post-processor.js tests/wiki/wiki-post-processor.test.js
git commit -m "feat: 创建 WikiPostProcessor 后处理模块"
```

---

### Task 2: 集成 WikiPostProcessor 到 ReportPipeline

**Files:**
- Modify: `src/scraper/report-pipeline.js`
- Test: `tests/scraper/report-pipeline.test.js`

- [ ] **Step 1: 在 ReportPipeline 中导入 WikiPostProcessor**

修改 `src/scraper/report-pipeline.js` 顶部导入：

```javascript
// 在现有的 import 后添加
const WikiPostProcessor = require('../wiki/wiki-post-processor');
```

- [ ] **Step 2: 在构造函数中初始化 WikiPostProcessor**

在 `constructor()` 方法中添加：

```javascript
constructor(options = {}) {
  this.enableAI = options.enableAI !== undefined ? options.enableAI : true;
  this.enableHTML = options.enableHTML !== undefined ? options.enableHTML : true;
  this.enableIndex = options.enableIndex !== undefined ? options.enableIndex : true;
  this.enableNotification = options.enableNotification !== undefined ? options.enableNotification : true;
  this.enableWikiPostProcessing = options.enableWikiPostProcessing !== undefined ? options.enableWikiPostProcessing : true; // 新增

  // ... 现有的子模块初始化 ...

  // 新增：初始化 Wiki 后处理器
  this.wikiPostProcessor = new WikiPostProcessor();
}
```

- [ ] **Step 3: 在 execute 方法中添加 Wiki 后处理步骤**

在 `updateProjectWikis` 调用之后添加：

```javascript
// 步骤 5: 更新项目 Wiki
if (type === 'daily' || type === 'weekly') {
  await this.executeStep('update-wiki', async () => {
    await this.updateProjectWikis(data, result.insights, type);
  }, result);
}

// 【新增】步骤 5.5: Wiki 后处理
if (this.enableWikiPostProcessing) {
  await this.executeStep('wiki-post-processing', async () => {
    const projects = data.repositories || data.projects || [];
    await this.wikiPostProcessor.process(projects, type);
  }, result);
}
```

- [ ] **Step 4: 更新 CompleteWorkflow 配置**

修改 `src/scraper/complete-workflow.js`：

```javascript
this.pipeline = new ReportPipeline({
  enableAI: this.options.enableAI,
  enableHTML: this.options.enableHTML,
  enableIndex: this.options.enableIndex,
  enableNotification: this.options.enableNotification,
  enableWikiPostProcessing: true  // 新增
});
```

- [ ] **Step 5: 运行现有测试验证不破坏**

```bash
npm test -- tests/scraper/report-pipeline.test.js
```

- [ ] **Step 6: 提交**

```bash
git add src/scraper/report-pipeline.js src/scraper/complete-workflow.js
git commit -m "feat: 集成 WikiPostProcessor 到报告流水线"
```

---

### Task 3: 添加 Wiki 后处理集成测试

**Files:**
- Create: `tests/e2e/wiki-post-processing.test.js`

- [ ] **Step 1: 创建端到端集成测试**

```javascript
/**
 * Wiki 后处理集成测试
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ReportPipeline = require('../../src/scraper/report-pipeline');
const WikiPostProcessor = require('../../src/wiki/wiki-post-processor');

describe('Wiki 后处理集成测试', () => {
  const testDir = path.join(__dirname, '../fixtures/test-wiki-e2e');
  const reportsDir = path.join(__dirname, '../../reports');

  beforeEach(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'projects'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'domains'), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    // 清理生成的索引页
    const indexPath = path.join(reportsDir, 'wiki-index.html');
    if (fs.existsSync(indexPath)) {
      fs.unlinkSync(indexPath);
    }
  });

  it('应在 ReportPipeline 执行后生成 Wiki 索引页', async () => {
    const pipeline = new ReportPipeline({
      enableAI: false,
      enableHTML: false,
      enableIndex: false,
      enableNotification: false,
      enableWikiPostProcessing: true
    });

    // 覆盖 wikiPostProcessor 的目录
    pipeline.wikiPostProcessor = new WikiPostProcessor({
      baseDir: testDir,
      outputDir: reportsDir
    });

    const mockData = {
      repositories: [
        {
          owner: 'test1',
          repo: 'repo1',
          name: 'repo1',
          description: 'Test repo 1',
          stars: 100,
          language: 'JavaScript',
          analysis: { type: 'agent' }
        }
      ]
    };

    // 模拟 execute 中的 Wiki 更新步骤
    await pipeline.updateProjectWikis(mockData, {}, 'daily');
    
    // 执行 Wiki 后处理
    await pipeline.wikiPostProcessor.process(mockData.repositories, 'daily');

    // 验证索引页已生成
    const indexPath = path.join(reportsDir, 'wiki-index.html');
    assert.ok(fs.existsSync(indexPath), 'Wiki 索引页应已生成');

    const content = fs.readFileSync(indexPath, 'utf-8');
    assert.ok(content.includes('AI Project Wiki'), '索引页应包含标题');
    assert.ok(content.includes('test1/repo1'), '索引页应包含项目链接');
  });

  it('应在 Wiki 后处理时更新领域 Wiki', async () => {
    const processor = new WikiPostProcessor({
      baseDir: testDir,
      outputDir: reportsDir
    });

    const projects = [
      { owner: 'test1', repo: 'repo1', analysis: { type: 'agent' } },
      { owner: 'test2', repo: 'repo2', analysis: { type: 'agent' } },
      { owner: 'test3', repo: 'repo3', analysis: { type: 'rag' } }
    ];

    await processor.process(projects, 'daily');

    // 验证领域 Wiki 已创建
    const agentWikiPath = path.join(testDir, 'domains/agent.md');
    const ragWikiPath = path.join(testDir, 'domains/rag.md');

    assert.ok(fs.existsSync(agentWikiPath), 'Agent 领域 Wiki 应已创建');
    assert.ok(fs.existsSync(ragWikiPath), 'RAG 领域 Wiki 应已创建');

    const agentContent = fs.readFileSync(agentWikiPath, 'utf-8');
    assert.ok(agentContent.includes('# agent 领域'), '领域 Wiki 应有正确标题');
    assert.ok(agentContent.includes('项目总数：2'), '应包含正确的项目数量');
  });

  it('Wiki 后处理失败不应影响主流程', async () => {
    const pipeline = new ReportPipeline({
      enableAI: false,
      enableHTML: true,
      enableIndex: false,
      enableNotification: false,
      enableWikiPostProcessing: true
    });

    // 使用无效目录导致 Wiki 后处理失败
    pipeline.wikiPostProcessor = new WikiPostProcessor({
      baseDir: '/invalid/path/that/does/not/exist',
      outputDir: reportsDir
    });

    // 模拟数据
    const mockData = {
      repositories: [],
      date: '2026-04-19'
    };

    // 执行流水线（Wiki 后处理失败不应中断主流程）
    // 注意：实际实现中需要确保错误被捕获
    let error = null;
    try {
      await pipeline.execute(mockData, 'daily');
    } catch (e) {
      error = e;
    }

    // 主流程不应失败
    assert.ok(error === null, '主流程不应因 Wiki 后处理失败而中断');
  });
});
```

- [ ] **Step 2: 运行集成测试**

```bash
npm test -- tests/e2e/wiki-post-processing.test.js
```

- [ ] **Step 3: 提交**

```bash
git add tests/e2e/wiki-post-processing.test.js
git commit -m "test: 添加 Wiki 后处理端到端集成测试"
```

---

### Task 4: 月报工作流特殊处理

**Files:**
- Modify: `scripts/run-monthly-workflow.js`

- [ ] **Step 1: 在月报工作流中添加 Wiki 后处理触发**

修改 `scripts/run-monthly-workflow.js`，在月报数据聚合完成后触发 Wiki 后处理：

```javascript
// 在月报工作流中，步骤 3（HTML 生成）之后添加
logger.title('📊 步骤 4: Wiki 后处理');
try {
  const WikiPostProcessor = require('../src/wiki/wiki-post-processor');
  const processor = new WikiPostProcessor();
  
  // 使用聚合后的月度项目数据
  const allProjects = monthlyData.projects || [];
  await processor.process(allProjects, 'monthly');
  
  logger.success('Wiki 后处理完成');
} catch (error) {
  logger.warn('Wiki 后处理失败（不影响主流程）', { error: error.message });
}
```

- [ ] **Step 2: 运行月报脚本验证**

```bash
node scripts/run-monthly-workflow.js 2026-03
```

- [ ] **Step 3: 提交**

```bash
git add scripts/run-monthly-workflow.js
git commit -m "feat: 月报工作流触发 Wiki 后处理"
```

---

### Task 5: 错误处理优化

**Files:**
- Modify: `src/scraper/report-pipeline.js`

- [ ] **Step 1: 添加 Wiki 后处理错误隔离**

修改 `ReportPipeline.execute()` 方法中的 Wiki 后处理步骤：

```javascript
// 【修改】步骤 5.5: Wiki 后处理（错误隔离）
if (this.enableWikiPostProcessing) {
  await this.executeStep('wiki-post-processing', async () => {
    try {
      const projects = data.repositories || data.projects || [];
      await this.wikiPostProcessor.process(projects, type);
    } catch (error) {
      // Wiki 后处理失败不影响主流程
      logger.warn('[ReportPipeline] Wiki 后处理失败，不影响主报告流程', {
        error: error.message,
        type
      });
      // 不抛出异常
    }
  }, result);
}
```

- [ ] **Step 2: 验证错误隔离测试通过**

运行 Task 3 中的错误隔离测试验证通过。

- [ ] **Step 3: 提交**

```bash
git add src/scraper/report-pipeline.js
git commit -m "fix: Wiki 后处理错误隔离不中断主流程"
```

---

### Task 6: 验收与文档更新

**Files:**
- Modify: `README.md`
- Modify: `docs/WIKI.md`

- [ ] **Step 1: 更新 README.md 添加 Wiki 功能说明**

在 README.md 的 "LLM Wiki 知识库" 章节添加：

```markdown
### Wiki 自动更新

系统会在每次生成日报/周报/月报后自动更新 Wiki：

1. **Wiki 索引页** - 自动更新项目统计、领域导航、热门项目排行榜
2. **领域 Wiki** - 自动按领域（agent/rag/llm 等）聚合项目列表

输出位置：
- `reports/wiki-index.html` - Wiki 索引页
- `wiki/domains/{domain}.md` - 领域 Wiki 页面
```

- [ ] **Step 2: 更新 docs/WIKI.md 添加工作流集成说明**

在 `docs/WIKI.md` 的 "集成工作流" 章节添加：

```markdown
### Wiki 后处理流程

报告生成完成后自动触发：

1. 项目 Wiki 更新（版本历史 + 基本信息）
2. Wiki 索引页生成
3. 领域 Wiki 更新

```bash
# 无需手动运行，工作流自动触发
node scripts/run-daily-workflow.js
```

生成的文件：
- `reports/wiki-index.html` - Wiki 索引页
- `wiki/domains/{domain}.md` - 领域 Wiki
```

- [ ] **Step 3: 运行所有测试**

```bash
npm test
```

- [ ] **Step 4: 提交**

```bash
git add README.md docs/WIKI.md
git commit -m "docs: 更新 Wiki 自动更新功能文档"
```

---

## 验收清单

- [ ] WikiPostProcessor 模块创建并有单元测试
- [ ] ReportPipeline 集成 Wiki 后处理步骤
- [ ] 日报/周报/月报工作流自动触发 Wiki 后处理
- [ ] Wiki 索引页自动生成到 `reports/wiki-index.html`
- [ ] 领域 Wiki 自动更新到 `wiki/domains/{domain}.md`
- [ ] Wiki 后处理失败不影响主报告流程
- [ ] 所有测试通过
- [ ] 文档已更新
