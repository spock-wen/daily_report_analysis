# LLM Wiki 集成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 Karpathy LLM Wiki 理念，为当前 AI 趋势报告系统集成项目知识库功能

**Architecture:** 
- 新增 `wiki/` 目录存储 Markdown Wiki 文件（projects/papers/domains）
- 新增 `src/wiki/` 模块负责 Wiki 读写和关联分析
- 修改现有工作流程在分析时读取 Wiki、分析后更新 Wiki
- 修改 HTML 生成器使用 Wiki 数据增强报告展示

**Tech Stack:** Node.js, Markdown, Cheerio (解析), 现有 LLM/Ollama 集成

---

## Phase 1: Wiki 模块核心功能开发

> **说明**: Phase 1 必须先于历史数据迁移执行，因为迁移脚本依赖 WikiManager 和 WikiTemplates。

### Task 1: Wiki 目录结构和模板

**Files:**
- Create: `wiki/projects/.gitkeep`
- Create: `wiki/papers/.gitkeep`
- Create: `wiki/domains/.gitkeep`
- Create: `src/wiki/wiki-templates.js`

- [ ] **Step 1: 创建 Wiki 目录占位文件**

```bash
mkdir -p wiki/projects wiki/papers wiki/domains
echo "// Wiki files" > wiki/projects/.gitkeep
echo "// Wiki files" > wiki/papers/.gitkeep
echo "// Wiki files" > wiki/domains/.gitkeep
```

- [ ] **Step 2: 提交目录结构**

```bash
git add wiki/
git commit -m "chore: 添加 Wiki 目录结构"
```

- [ ] **Step 3: 创建 Wiki 模板模块**

```javascript
/**
 * Wiki 模板定义
 * 提供 GitHub 项目、论文、领域 Wiki 的模板字符串
 */

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

/**
 * 渲染模板
 * @param {string} template - 模板名称
 * @param {Object} data - 数据对象
 * @returns {string} 渲染后的 Markdown
 */
function renderTemplate(template, data) {
  const templateStr = WIKI_TEMPLATES[template];
  if (!templateStr) {
    throw new Error(\`Unknown template: \${template}\`);
  }
  
  let result = templateStr;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(\`{\\\${key}}\`, 'g');
    result = result.replace(placeholder, value || '');
  }
  return result;
}

module.exports = {
  WIKI_TEMPLATES,
  renderTemplate
};
```

- [ ] **Step 4: 提交模板模块**

```bash
git add src/wiki/wiki-templates.js
git commit -m "feat: 添加 Wiki 模板模块"
```

---

### Task 2: Wiki Manager 核心类

**Files:**
- Create: `src/wiki/wiki-manager.js`
- Test: `tests/wiki/wiki-manager.test.js`

- [ ] **Step 1: 编写 WikiManager 测试**

```javascript
const path = require('path');
const fs = require('fs');
const WikiManager = require('../../src/wiki/wiki-manager');

describe('WikiManager', () => {
  let wikiManager;
  const testWikiDir = path.join(__dirname, '../fixtures/wiki');

  beforeEach(() => {
    // 清理测试目录
    if (fs.existsSync(testWikiDir)) {
      fs.rmSync(testWikiDir, { recursive: true });
    }
    fs.mkdirSync(testWikiDir, { recursive: true });
    
    wikiManager = new WikiManager({ baseDir: testWikiDir });
  });

  afterEach(() => {
    if (fs.existsSync(testWikiDir)) {
      fs.rmSync(testWikiDir, { recursive: true });
    }
  });

  describe('getOrCreateWiki', () => {
    it('应该为新项目创建 Wiki', async () => {
      const wiki = await wikiManager.getOrCreateWiki('owner', 'repo');
      expect(wiki.exists).toBe(false);
      expect(wiki.path).toContain('owner_repo.md');
    });

    it('应该读取已存在的 Wiki', async () => {
      await wikiManager.getOrCreateWiki('owner', 'repo');
      const wiki = await wikiManager.getOrCreateWiki('owner', 'repo');
      expect(wiki.exists).toBe(true);
      expect(wiki.content).toContain('# owner/repo');
    });
  });

  describe('appendVersion', () => {
    it('应该追加版本记录到项目 Wiki', async () => {
      await wikiManager.getOrCreateWiki('owner', 'repo');
      
      await wikiManager.appendVersion('owner', 'repo', {
        date: '2026-04-17',
        eventType: '首次上榜',
        source: '[日报 2026-04-17](...)',
        analysis: '首次上榜分析内容'
      });

      const wiki = await wikiManager.getOrCreateWiki('owner', 'repo');
      expect(wiki.content).toContain('### 2026-04-17（首次上榜）');
      expect(wiki.content).toContain('首次上榜分析内容');
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- tests/wiki/wiki-manager.test.js
```
Expected: FAIL with "Cannot find module '../../src/wiki/wiki-manager'"

- [ ] **Step 3: 实现 WikiManager 核心类**

```javascript
/**
 * Wiki Manager - Wiki 读写管理
 * 负责 GitHub 项目和论文 Wiki 的创建、读取、更新
 */

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('./wiki-templates');
const logger = require('../utils/logger');

class WikiManager {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), 'wiki');
    this.projectsDir = path.join(this.baseDir, 'projects');
    this.papersDir = path.join(this.baseDir, 'papers');
    this.domainsDir = path.join(this.baseDir, 'domains');
    
    // 确保目录存在
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.projectsDir, this.papersDir, this.domainsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 读取项目 Wiki（如果不存在则创建）
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @returns {Promise<Object>} Wiki 内容和元数据
   */
  async getOrCreateWiki(owner, repo) {
    const fileName = `${owner}_${repo}.md`;
    const wikiPath = path.join(this.projectsDir, fileName);
    
    if (fs.existsSync(wikiPath)) {
      const content = fs.readFileSync(wikiPath, 'utf-8');
      logger.debug(`读取项目 Wiki: ${owner}/${repo}`);
      return {
        exists: true,
        path: wikiPath,
        fileName,
        content,
        owner,
        repo
      };
    } else {
      logger.debug(`创建新项目 Wiki: ${owner}/${repo}`);
      return {
        exists: false,
        path: wikiPath,
        fileName,
        content: null,
        owner,
        repo
      };
    }
  }

  /**
   * 读取论文 Wiki（如果不存在则返回 null）
   * @param {string} arxivId - arXiv ID
   * @returns {Promise<Object|null>}
   */
  async getPaperWiki(arxivId) {
    const fileName = `${arxivId}.md`;
    const wikiPath = path.join(this.papersDir, fileName);
    
    if (fs.existsSync(wikiPath)) {
      const content = fs.readFileSync(wikiPath, 'utf-8');
      return {
        exists: true,
        path: wikiPath,
        fileName,
        content,
        arxivId
      };
    }
    
    return null;
  }

  /**
   * 创建项目 Wiki
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {Object} data - Wiki 数据
   * @returns {Promise<string>} Wiki 文件路径
   */
  async createProjectWiki(owner, repo, data) {
    const { exists, path: wikiPath } = await this.getOrCreateWiki(owner, repo);
    if (exists) {
      logger.warn(`Wiki 已存在：${owner}/${repo}`);
      return wikiPath;
    }

    const content = renderTemplate('project', {
      owner,
      repo,
      firstSeen: data.firstSeen || new Date().toISOString().split('T')[0],
      lastSeen: data.lastSeen || data.firstSeen,
      appearances: data.appearances || '1',
      domain: data.domain || 'General',
      language: data.language || 'Unknown',
      stars: data.stars || '0',
      coreFunctions: data.coreFunctions ? data.coreFunctions.map(f => `- ${f}`).join('\n') : '',
      versionHistory: data.versionHistory || '',
      crossReferences: data.crossReferences || ''
    });

    fs.writeFileSync(wikiPath, content, 'utf-8');
    logger.success(`创建项目 Wiki: ${owner}/${repo}`);
    return wikiPath;
  }

  /**
   * 创建论文 Wiki
   * @param {string} arxivId - arXiv ID
   * @param {Object} data - 论文数据
   * @returns {Promise<string>} Wiki 文件路径
   */
  async createPaperWiki(arxivId, data) {
    const existing = await this.getPaperWiki(arxivId);
    if (existing) {
      logger.warn(`论文 Wiki 已存在：${arxivId}`);
      return existing.path;
    }

    const fileName = `${arxivId}.md`;
    const wikiPath = path.join(this.papersDir, fileName);

    const content = renderTemplate('paper', {
      title: data.title || 'Untitled',
      arxivId,
      publishDate: data.publishDate || '',
      firstRecorded: data.firstRecorded || new Date().toISOString().split('T')[0],
      paperType: data.paperType || 'Research',
      domain: data.domain || 'General',
      authors: data.authors ? data.authors.join(', ') : '',
      contributions: data.contributions ? data.contributions.map(c => `- ${c}`).join('\n') : '',
      githubLinks: data.githubLinks || '',
      analysis: data.analysis || '',
      crossReferences: data.crossReferences || '',
      bibtex: data.bibtex || ''
    });

    fs.writeFileSync(wikiPath, content, 'utf-8');
    logger.success(`创建论文 Wiki: ${arxivId}`);
    return wikiPath;
  }

  /**
   * 追加版本记录到项目 Wiki
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {Object} versionData - 版本数据
   * @returns {Promise<void>}
   */
  async appendVersion(owner, repo, versionData) {
    const wiki = await this.getOrCreateWiki(owner, repo);
    let content = wiki.content || '';

    // 如果没有内容，先创建基本结构
    if (!content) {
      await this.createProjectWiki(owner, repo, {
        firstSeen: versionData.date,
        lastSeen: versionData.date,
        appearances: '1',
        ...versionData
      });
      return;
    }

    // 追加版本历史
    const versionSection = `
### ${versionData.date}（${versionData.eventType}）
**来源**: ${versionData.source}
**分析**: ${versionData.analysis}
`;

    // 检查是否已存在版本历史部分
    if (content.includes('## 版本历史')) {
      // 追加到版本历史后面
      content = content.replace(
        /(## 跨项目关联)/s,
        `${versionSection}\n$1`
      );
    } else {
      // 添加版本历史部分
      content = content.replace(
        /(## 核心功能[\s\S]*?)(\n##|$)/s,
        `$1\n\n## 版本历史\n${versionSection}$2`
      );
    }

    fs.writeFileSync(wiki.path, content, 'utf-8');
    logger.debug(`追加版本记录：${owner}/${repo} - ${versionData.date}`);
  }

  /**
   * 更新基本信息（上榜次数、最近日期等）
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {Object} newData - 新数据
   * @returns {Promise<void>}
   */
  async updateBasicInfo(owner, repo, newData) {
    const wiki = await this.getOrCreateWiki(owner, repo);
    if (!wiki.exists || !wiki.content) return;

    let content = wiki.content;

    // 更新上榜次数
    if (newData.appearances) {
      content = content.replace(
        /- 上榜次数：\d+/,
        `- 上榜次数：${newData.appearances}`
      );
    }

    // 更新最近上榜日期
    if (newData.lastSeen) {
      content = content.replace(
        /- 最近上榜：[\d-]+/,
        `- 最近上榜：${newData.lastSeen}`
      );
    }

    // 更新 Stars
    if (newData.stars) {
      content = content.replace(
        /- GitHub Stars: [\d,]+.*$/,
        `- GitHub Stars: ${newData.stars}（最后更新：${newData.starsDate || new Date().toISOString().split('T')[0]}）`,
        'm'
      );
    }

    fs.writeFileSync(wiki.path, content, 'utf-8');
    logger.debug(\`更新基本信息：\${owner}/\${repo}\`);
  }

  /**
   * 扫描所有 Wiki 获取跨项目关联
   * @param {Object} project - 当前项目
   * @returns {Promise<Array>} 关联项目列表
   */
  async findRelatedProjects(project) {
    const files = fs.readdirSync(this.projectsDir);
    const related = [];
    
    // 基于领域分类查找
    if (project.domain) {
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const content = fs.readFileSync(path.join(this.projectsDir, file), 'utf-8');
        if (content.includes(\`领域分类：\${project.domain}\`)) {
          const match = file.match(/^(.+)_(.+)\.md$/);
          if (match) {
            related.push({
              owner: match[1],
              repo: match[2],
              reason: '同领域'
            });
          }
        }
      }
    }

    // 基于技术栈查找（简单关键词匹配）
    if (project.language) {
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const content = fs.readFileSync(path.join(this.projectsDir, file), 'utf-8');
        if (content.includes(\`语言：\${project.language}\`)) {
          const match = file.match(/^(.+)_(.+)\.md$/);
          if (match) {
            const name = `${match[1]}/${match[2]}`;
            if (!related.find(r => r.owner === match[1] && r.repo === match[2])) {
              related.push({
                owner: match[1],
                repo: match[2],
                reason: '同技术栈'
              });
            }
          }
        }
      }
    }

    return related.slice(0, 5); // 最多返回 5 个关联项目
  }

  /**
   * 更新跨论文关联（被引用时）
   * @param {string} citedArxivId - 被引用的论文 ID
   * @param {string} citingArxivId - 引用方的论文 ID
   * @returns {Promise<void>}
   */
  async addCitationLink(citedArxivId, citingArxivId) {
    const wiki = await this.getPaperWiki(citedArxivId);
    if (!wiki) {
      logger.warn(\`被引用论文 Wiki 不存在：\${citedArxivId}\`);
      return;
    }

    let content = wiki.content;
    const citationLink = \`[\${citingArxivId}](\${citingArxivId}.md)\`;

    // 检查是否已存在关联
    if (content.includes(citationLink)) {
      return;
    }

    // 添加被引用关联
    if (content.includes('## 跨论文关联')) {
      content = content.replace(
        /(## 跨论文关联\n)/,
        \`$1- 被引用：\${citationLink}（\${new Date().toISOString().split('T')[0]}）\\n\`
      );
    }

    fs.writeFileSync(wiki.path, content, 'utf-8');
    logger.debug(\`添加引用关联：\${citedArxivId} <- \${citingArxivId}\`);
  }

  /**
   * 获取 Wiki 统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStats() {
    const countFiles = (dir) => {
      if (!fs.existsSync(dir)) return 0;
      return fs.readdirSync(dir).filter(f => f.endsWith('.md')).length;
    };

    return {
      projects: countFiles(this.projectsDir),
      papers: countFiles(this.papersDir),
      domains: countFiles(this.domainsDir),
      total: countFiles(this.projectsDir) + countFiles(this.papersDir) + countFiles(this.domainsDir)
    };
  }
}

module.exports = WikiManager;
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- tests/wiki/wiki-manager.test.js
```
Expected: PASS

- [ ] **Step 5: 提交 Wiki Manager**

```bash
git add src/wiki/ tests/wiki/
git commit -m "feat: 实现 Wiki Manager 核心类"
```

---

### Task 3: 跨项目关联分析器

**Files:**
- Create: `src/wiki/cross-reference.js`
- Test: `tests/wiki/cross-reference.test.js`

- [ ] **Step 1: 编写 CrossReferenceAnalyzer 测试**

```javascript
const CrossReferenceAnalyzer = require('../../src/wiki/cross-reference');

describe('CrossReferenceAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new CrossReferenceAnalyzer();
  });

  describe('extractCitationsFromBibTeX', () => {
    it('应该从 BibTeX 中提取 arXiv ID', () => {
      const bibtex = \`@article{smith2024llm,
  title={LLM Optimization},
  author={Smith, John},
  journal={arXiv preprint arXiv:2401.12345},
  year={2024}
}\`;
      
      const citations = analyzer.extractCitationsFromBibTeX(bibtex);
      expect(citations).toContain('2401.12345');
    });

    it('应该提取多个 arXiv ID', () => {
      const bibtex = \`@article{smith2024llm,
  title={LLM Optimization},
  author={Smith, John},
  journal={arXiv preprint arXiv:2401.12345},
  year={2024},
  note={See also arXiv:2402.05678}
}\`;
      
      const citations = analyzer.extractCitationsFromBibTeX(bibtex);
      expect(citations).toHaveLength(2);
      expect(citations).toContain('2401.12345');
      expect(citations).toContain('2402.05678');
    });
  });

  describe('findSimilarProjects', () => {
    it('应该基于关键词找到相似项目', () => {
      const currentProject = {
        repo: 'owner/agent-tool',
        description: 'An AI agent framework for workflow automation',
        domain: 'agent'
      };

      const allWikis = [
        {
          owner: 'owner2',
          repo: 'agent-framework',
          content: '# owner2/agent-framework\\n\\n领域分类：agent\\n核心功能：agent framework'
        },
        {
          owner: 'owner3',
          repo: 'database-tool',
          content: '# owner3/database-tool\\n\\n领域分类：database'
        }
      ];

      const similar = analyzer.findSimilarProjects(currentProject, allWikis);
      expect(similar).toHaveLength(1);
      expect(similar[0].repo).toBe('agent-framework');
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- tests/wiki/cross-reference.test.js
```
Expected: FAIL

- [ ] **Step 3: 实现 CrossReferenceAnalyzer**

```javascript
/**
 * Cross Reference Analyzer - 跨项目关联分析
 * 分析项目之间的关系：相似项目、引用关系、同领域等
 */

const logger = require('../utils/logger');

class CrossReferenceAnalyzer {
  constructor() {
    // arXiv ID 正则匹配
    this.arxivRegex = /arXiv[:\s]+(\d{4}\.\d{4,5})/gi;
  }

  /**
   * 从 BibTeX 中提取引用关系
   * @param {string} bibtex - BibTeX 内容
   * @returns {Array} arXiv ID 列表
   */
  extractCitationsFromBibTeX(bibtex) {
    if (!bibtex) return [];

    const citations = [];
    let match;

    while ((match = this.arxivRegex.exec(bibtex)) !== null) {
      const arxivId = match[1];
      if (!citations.includes(arxivId)) {
        citations.push(arxivId);
      }
    }

    logger.debug(\`从 BibTeX 提取 \${citations.length} 个引用：\${citations.join(', ')}\`);
    return citations;
  }

  /**
   * 基于 Wiki 内容检测相似项目
   * @param {Object} currentProject - 当前项目
   * @param {Array} allWikis - 所有 Wiki 内容数组
   * @returns {Array} 相似项目列表
   */
  findSimilarProjects(currentProject, allWikis) {
    if (!allWikis || allWikis.length === 0) return [];

    const currentDomain = currentProject.domain?.toLowerCase();
    const currentDesc = (currentProject.description || '').toLowerCase();
    const currentRepo = (currentProject.repo || '').toLowerCase();

    const scores = [];

    for (const wiki of allWikis) {
      // 跳过自己
      const wikiName = \`\${wiki.owner}/\${wiki.repo}\`.toLowerCase();
      if (wikiName === currentRepo) continue;

      let score = 0;
      const reasons = [];

      // 同领域 +3 分
      const wikiDomain = this._extractField(wiki.content, '领域分类');
      if (wikiDomain && wikiDomain.toLowerCase() === currentDomain) {
        score += 3;
        reasons.push('同领域');
      }

      // 同技术栈 +2 分
      const wikiLanguage = this._extractField(wiki.content, '语言');
      if (wikiLanguage && wikiLanguage === currentProject.language) {
        score += 2;
        reasons.push('同技术栈');
      }

      // 关键词匹配 +1 分
      const wikiContent = wiki.content.toLowerCase();
      const keywords = this._extractKeywords(currentDesc);
      let keywordMatch = 0;
      for (const kw of keywords) {
        if (wikiContent.includes(kw)) {
          keywordMatch++;
        }
      }
      if (keywordMatch >= 2) {
        score += 1;
        reasons.push(\`关键词匹配 (\${keywordMatch})\`);
      }

      if (score > 0) {
        scores.push({
          owner: wiki.owner,
          repo: wiki.repo,
          score,
          reasons
        });
      }
    }

    // 按分数降序排序
    scores.sort((a, b) => b.score - a.score);

    logger.debug(\`找到 \${scores.length} 个相似项目\`);
    return scores.slice(0, 5);
  }

  /**
   * 基于关键词检测领域内项目
   * @param {string} domain - 领域名称
   * @param {Array} allWikis - 所有 Wiki 内容
   * @returns {Array} 领域内项目列表
   */
  getProjectsByDomain(domain, allWikis) {
    if (!domain || !allWikis) return [];

    const domainLower = domain.toLowerCase();
    const projects = [];

    for (const wiki of allWikis) {
      const wikiDomain = this._extractField(wiki.content, '领域分类');
      if (wikiDomain && wikiDomain.toLowerCase() === domainLower) {
        projects.push({
          owner: wiki.owner,
          repo: wiki.repo,
          content: wiki.content
        });
      }
    }

    return projects;
  }

  /**
   * 从 Wiki 内容中提取字段值
   * @param {string} content - Wiki 内容
   * @param {string} fieldName - 字段名称
   * @returns {string|null} 字段值
   */
  _extractField(content, fieldName) {
    if (!content) return null;
    
    const regex = new RegExp(\`- \${fieldName}：(.+)\\n\`);
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * 从文本中提取关键词
   * @param {string} text - 文本内容
   * @returns {Array} 关键词列表
   */
  _extractKeywords(text) {
    if (!text) return [];

    // 简单的关键词提取：提取名词性短语
    const keywords = [];
    
    // 技术关键词
    const techKeywords = [
      'agent', 'rag', 'llm', 'transformer', 'embedding', 'vector',
      'retrieval', 'fine-tune', 'inference', 'workflow', 'automation',
      '多智能体', '知识库', '检索', '向量', '大模型'
    ];

    const textLower = text.toLowerCase();
    for (const kw of techKeywords) {
      if (textLower.includes(kw.toLowerCase())) {
        keywords.push(kw.toLowerCase());
      }
    }

    return keywords;
  }
}

module.exports = CrossReferenceAnalyzer;
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- tests/wiki/cross-reference.test.js
```
Expected: PASS

- [ ] **Step 5: 提交 CrossReferenceAnalyzer**

```bash
git add src/wiki/cross-reference.js tests/wiki/cross-reference.test.js
git commit -m "feat: 实现跨项目关联分析器"
```

---

### Task 4: Wiki 索引生成器

**Files:**
- Create: `src/generator/wiki-index-generator.js`
- Create: `public/css/wiki-index.css`

- [ ] **Step 1: 创建 Wiki 索引生成器**

```javascript
/**
 * Wiki Index Generator - Wiki 索引页生成器
 * 生成 wiki-index.html 文件，包含所有 Wiki 的导航和统计
 */

const fs = require('fs');
const path = require('path');
const WikiManager = require('../wiki/wiki-manager');
const logger = require('../utils/logger');

class WikiIndexGenerator {
  constructor(options = {}) {
    this.wikiManager = new WikiManager(options);
    this.outputDir = options.outputDir || path.join(process.cwd(), 'reports');
  }

  /**
   * 生成 Wiki 索引页
   * @returns {Promise<string>} 输出文件路径
   */
  async generate() {
    try {
      logger.info('生成 Wiki 索引页...');

      // 获取统计信息
      const stats = await this.wikiManager.getStats();

      // 获取所有项目 Wiki 列表
      const projectWikis = await this._listProjectWikis();

      // 获取所有论文 Wiki 列表
      const paperWikis = await this._listPaperWikis();

      // 获取领域 Wiki 列表
      const domainWikis = await this._listDomainWikis();

      // 生成 HTML
      const html = this._renderHTML(stats, projectWikis, paperWikis, domainWikis);

      // 写入文件
      const outputPath = path.join(this.outputDir, 'wiki-index.html');
      fs.writeFileSync(outputPath, html, 'utf-8');

      logger.success(\`Wiki 索引页已生成：\${outputPath}\`);
      return outputPath;
    } catch (error) {
      logger.error(\`生成 Wiki 索引页失败：\${error.message}\`);
      throw error;
    }
  }

  /**
   * 列出所有项目 Wiki
   */
  async _listProjectWikis() {
    const projectsDir = this.wikiManager.projectsDir;
    if (!fs.existsSync(projectsDir)) return [];

    const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
    const wikis = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(projectsDir, file), 'utf-8');
      const match = file.match(/^(.+)_(.+)\.md$/);
      
      if (match) {
        wikis.push({
          owner: match[1],
          repo: match[2],
          fileName: file,
          firstSeen: this._extractField(content, '首次上榜'),
          appearances: parseInt(this._extractField(content, '上榜次数')) || 0,
          stars: this._extractField(content, 'GitHub Stars'),
          domain: this._extractField(content, '领域分类')
        });
      }
    }

    // 按上榜次数降序排序
    wikis.sort((a, b) => b.appearances - a.appearances);
    return wikis;
  }

  /**
   * 列出所有论文 Wiki
   */
  async _listPaperWikis() {
    const papersDir = this.wikiManager.papersDir;
    if (!fs.existsSync(papersDir)) return [];

    const files = fs.readdirSync(papersDir).filter(f => f.endsWith('.md'));
    const wikis = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(papersDir, file), 'utf-8');
      const arxivId = file.replace('.md', '');
      
      wikis.push({
        arxivId,
        fileName: file,
        title: this._extractField(content, '# ')?.replace('# ', '').trim() || 'Untitled',
        firstRecorded: this._extractField(content, '首次收录'),
        paperType: this._extractField(content, '论文类型'),
        domain: this._extractField(content, '领域分类')
      });
    }

    // 按收录日期降序排序
    wikis.sort((a, b) => new Date(b.firstRecorded) - new Date(a.firstRecorded));
    return wikis;
  }

  /**
   * 列出所有领域 Wiki
   */
  async _listDomainWikis() {
    const domainsDir = this.wikiManager.domainsDir;
    if (!fs.existsSync(domainsDir)) return [];

    const files = fs.readdirSync(domainsDir).filter(f => f.endsWith('.md'));
    const wikis = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(domainsDir, file), 'utf-8');
      const domainName = file.replace('.md', '');
      
      wikis.push({
        name: domainName,
        fileName: file,
        projectCount: (content.match(/owner\/repo/g) || []).length / 2
      });
    }

    return wikis;
  }

  /**
   * 从 Wiki 内容中提取字段
   */
  _extractField(content, pattern) {
    if (!content) return '';
    
    if (pattern.startsWith('# ')) {
      const match = content.match(/^# (.+)$/m);
      return match ? match[1].trim() : '';
    }
    
    const regex = new RegExp(\`- \${pattern}：(.+)\\n\`);
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * 渲染 HTML 页面
   */
  _renderHTML(stats, projectWikis, paperWikis, domainWikis) {
    const topProjects = projectWikis.slice(0, 10);
    const latestPapers = paperWikis.slice(0, 10);

    return \`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Project Wiki - 索引</title>
  <link rel="stylesheet" href="../public/css/wiki-index.css">
</head>
<body>
  <header>
    <h1>📚 AI Project Wiki</h1>
    <p>由 LLM 驱动的项目知识库</p>
  </header>

  <nav class="nav">
    <a href="index.html">报告首页</a>
    <a href="#projects">项目 Wiki</a>
    <a href="#papers">论文 Wiki</a>
    <a href="#domains">领域 Wiki</a>
  </nav>

  <section class="stats-section">
    <h2>📊 统计</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">\${stats.projects}</div>
        <div class="stat-label">收录项目</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">\${stats.papers}</div>
        <div class="stat-label">收录论文</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">\${stats.domains}</div>
        <div class="stat-label">领域 Wiki</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">\${stats.total}</div>
        <div class="stat-label">总 Wiki 条目</div>
      </div>
    </div>
  </section>

  <section id="domains" class="domain-section">
    <h2>领域导航</h2>
    <div class="domain-grid">
      \${domainWikis.map(domain => \`
        <a href="domains/\${domain.name}.html" class="domain-card">
          <h3>\${this._domainIcon(domain.name)} \${domain.name}</h3>
          <p>\${domain.projectCount} 个项目</p>
        </a>
      \`).join('')}
    </div>
  </section>

  <section id="projects" class="project-section">
    <h2>📈 热门项目（按上榜次数）</h2>
    <table class="project-table">
      <thead>
        <tr>
          <th>排名</th>
          <th>项目</th>
          <th>领域</th>
          <th>上榜次数</th>
          <th>Stars</th>
        </tr>
      </thead>
      <tbody>
        \${topProjects.map((p, i) => \`
          <tr>
            <td>\${i + 1}</td>
            <td><a href="projects/\${p.fileName.replace('.md', '')}.html">\${p.owner}/\${p.repo}</a></td>
            <td>\${p.domain}</td>
            <td>\${p.appearances}</td>
            <td>\${p.stars}</td>
          </tr>
        \`).join('')}
      </tbody>
    </table>
  </section>

  <section id="papers" class="paper-section">
    <h2>📄 最新收录论文</h2>
    <table class="paper-table">
      <thead>
        <tr>
          <th>arXiv ID</th>
          <th>标题</th>
          <th>类型</th>
          <th>领域</th>
          <th>收录日期</th>
        </tr>
      </thead>
      <tbody>
        \${latestPapers.map(p => \`
          <tr>
            <td><a href="papers/\${p.fileName.replace('.md', '')}.html">\${p.arxivId}</a></td>
            <td>\${p.title}</td>
            <td>\${p.paperType}</td>
            <td>\${p.domain}</td>
            <td>\${p.firstRecorded}</td>
          </tr>
        \`).join('')}
      </tbody>
    </table>
  </section>

  <footer>
    <p>Generated by LLM Wiki Integration</p>
  </footer>
</body>
</html>\`;
  }

  _domainIcon(domain) {
    const icons = {
      agent: '🤖',
      rag: '🔍',
      llm: '🧠',
      speech: '🎤',
      database: '💾',
      security: '🛡️',
      browser: '🌐',
      devtool: '🛠️'
    };
    return icons[domain.toLowerCase()] || '📦';
  }
}

module.exports = WikiIndexGenerator;
```

- [ ] **Step 2: 创建 Wiki 索引页样式**

```css
/* Wiki Index Page Styles */

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: #f5f5f5;
}

header {
  text-align: center;
  padding: 40px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 30px;
}

header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5em;
}

header p {
  margin: 0;
  opacity: 0.9;
}

.nav {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 30px;
}

.nav a {
  color: #667eea;
  text-decoration: none;
  padding: 10px 20px;
  border-radius: 8px;
  background: white;
  transition: box-shadow 0.2s;
}

.nav a:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

section {
  background: white;
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

section h2 {
  margin-top: 0;
  color: #333;
  border-bottom: 2px solid #667eea;
  padding-bottom: 15px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-value {
  font-size: 2.5em;
  font-weight: bold;
  color: #667eea;
}

.stat-label {
  color: #666;
  margin-top: 5px;
}

/* Domain Grid */
.domain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
}

.domain-card {
  display: block;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  text-decoration: none;
  color: #333;
  transition: transform 0.2s, box-shadow 0.2s;
}

.domain-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.domain-card h3 {
  margin: 0 0 10px 0;
  font-size: 1.2em;
}

.domain-card p {
  margin: 0;
  color: #666;
  font-size: 0.9em;
}

/* Tables */
.project-table,
.paper-table {
  width: 100%;
  border-collapse: collapse;
}

.project-table th,
.project-table td,
.paper-table th,
.paper-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.project-table th,
.paper-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.project-table tr:hover,
.paper-table tr:hover {
  background: #f8f9fa;
}

.project-table a,
.paper-table a {
  color: #667eea;
  text-decoration: none;
}

.project-table a:hover,
.paper-table a:hover {
  text-decoration: underline;
}

footer {
  text-align: center;
  padding: 20px;
  color: #666;
  font-size: 0.9em;
}
```

- [ ] **Step 3: 提交 Wiki 索引生成器**

```bash
git add src/generator/wiki-index-generator.js public/css/wiki-index.css
git commit -m "feat: 添加 Wiki 索引页生成器"
```

---

## Phase 2: 工作流程集成

### Task 5: 日报流程集成 Wiki

**Files:**
- Modify: `src/scraper/report-pipeline.js`
- Modify: `src/generator/html-generator.js`

- [ ] **Step 1: 修改日报流程，在分析前读取 Wiki**

在 `src/scraper/report-pipeline.js` 中找到项目分析部分，添加 Wiki 读取逻辑：

```javascript
// 在分析项目之前添加
const WikiManager = require('../wiki/wiki-manager');
const wikiManager = new WikiManager();

// 对于每个项目，读取 Wiki 获取历史上下文
for (const project of projects) {
  const [owner, repo] = (project.fullName || project.repo || '').split('/');
  if (owner && repo) {
    const wiki = await wikiManager.getOrCreateWiki(owner, repo);
    project.wikiContext = wiki.exists ? JSON.parse(wiki.content) : null;
  }
}
```

- [ ] **Step 2: 修改项目分析器，使用 Wiki 上下文**

修改 `src/analyzer/project-analyzer.js`，在生成分析时考虑 Wiki 历史：

```javascript
/**
 * 生成核心功能列表（增强版）
 * @param {Object} project - 项目数据
 * @param {string} projectType - 项目类型
 * @param {Object} wikiContext - Wiki 历史上下文（可选）
 * @returns {Array} 核心功能列表
 */
function generateCoreFunctions(project, projectType, wikiContext) {
  const patterns = PROJECT_PATTERNS[projectType] || PROJECT_PATTERNS.devtool;
  const langFeature = LANG_FEATURES[project.language] || { strengths: '跨平台开发' };

  let functions = [...patterns.coreFunctions];

  if (langFeature.strengths) {
    functions.push(\`基于 \${project.language} - \${langFeature.strengths}\`);
  }

  // 如果有 Wiki 上下文，添加演变说明
  if (wikiContext && wikiContext.coreFunctions) {
    const oldFunctions = wikiContext.coreFunctions;
    const newFunctions = functions.filter(f => !oldFunctions.includes(f));
    if (newFunctions.length > 0) {
      functions.push('✨ 新增功能：' + newFunctions.join('; '));
    }
  }

  const stars = parseNumber(project.stars);
  if (stars > 10000) {
    functions.push('经过大规模生产环境验证，社区活跃度高');
  } else if (stars > 1000) {
    functions.push('社区认可度良好，持续迭代更新');
  }

  return functions.slice(0, 4);
}
```

- [ ] **Step 3: 分析完成后更新 Wiki**

在日报流程完成后，添加 Wiki 更新逻辑：

```javascript
// 分析完成后，更新项目 Wiki
for (const project of analyzedProjects) {
  const [owner, repo] = (project.fullName || project.repo || '').split('/');
  if (owner && repo) {
    await wikiManager.appendVersion(owner, repo, {
      date: currentDate,
      eventType: '日报收录',
      source: \`[日报 \${currentDate}](../../reports/daily/github-ai-trending-\${currentDate}.html)\`,
      analysis: project.analysis?.summary || '暂无分析内容'
    });
    
    await wikiManager.updateBasicInfo(owner, repo, {
      appearances: (project.wikiContext?.appearances || 0) + 1,
      lastSeen: currentDate,
      stars: project.stars,
      starsDate: currentDate
    });
  }
}
```

- [ ] **Step 4: 提交日报流程集成**

```bash
git add src/scraper/report-pipeline.js src/analyzer/project-analyzer.js
git commit -m "feat: 集成 Wiki 到日报流程"
```

---

### Task 6: HTML 报告增强

**Files:**
- Modify: `src/generator/html-generator.js`

- [ ] **Step 1: 修改项目卡片，显示 Wiki 数据**

在 `html-generator.js` 的 `renderProjectCard` 方法中添加：

```javascript
renderProjectCard(project, index) {
  const analysis = project.analysis || {};
  const wikiContext = project.wikiContext || {};
  
  // ... 现有代码 ...

  return \`
    <div class="project-card">
      <div class="project-header">
        <a href="\${projectUrl}" class="project-name" target="_blank">
          \${index + 1}. \${projectName}
        </a>
        <div class="project-stats">
          \${wikiContext.appearances ? \`
            <span class="stat-badge wiki" title="上榜次数">
              📋 \${wikiContext.appearances}次上榜
            </span>
          \` : ''}
          <span class="stat-badge" title="总星数">
            <svg class="star-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
            \${this.formatNumber(project.stars || 0)}
          </span>
          <span class="stat-badge hot" title="今日星数">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8.5 13.25a.75.75 0 01-.75-.75V9.688l-1.95 1.95a.75.75 0 01-1.06-1.06l3.25-3.25a.75.75 0 011.06 0l3.25 3.25a.75.75 0 11-1.06 1.06l-1.95-1.95v2.812a.75.75 0 01-.75.75zM8 1.25a.75.75 0 01.75.75v2.812l1.95-1.95a.75.75 0 111.06 1.06L8.5 7.172a.75.75 0 01-1.06 0L4.19 3.922a.75.75 0 111.06-1.06l1.95 1.95V2a.75.75 0 01.75-.75z"/></svg>
            +\${project.todayStars || 0}
          </span>
          <!-- 其他现有统计... -->
        </div>
      </div>
      
      \${wikiContext.firstSeen ? \`
        <div class="wiki-insight">
          <strong>💡 历史洞察：</strong>
          首次上榜：\${wikiContext.firstSeen} | 
          累计增长：+\${this.formatNumber(project.stars - (wikiContext.previousStars || 0))} stars
        </div>
      \` : ''}
      
      <!-- 现有项目内容... -->
      
      <a href="../../wiki/projects/\${owner}_\${repo}.md" class="wiki-link" target="_blank">
        查看完整 Wiki →
      </a>
    </div>
  \`;
}
```

- [ ] **Step 2: 添加 Wiki 深度分析模块（周报/月报）**

在周报/月报渲染中添加：

```javascript
renderWikiDeepAnalysis(projects) {
  const recurringProjects = projects.filter(p => {
    const wiki = p.wikiContext;
    return wiki && wiki.appearances && wiki.appearances >= 3;
  });

  if (recurringProjects.length === 0) return '';

  return \`
    <section class="wiki-deep-analysis">
      <h2>📊 Wiki 项目追踪</h2>
      <div class="tracking-grid">
        \${recurringProjects.map(p => \`
          <div class="project-track">
            <h4>\${p.fullName || p.repo}</h4>
            <p>上榜次数：\${p.wikiContext.appearances} | 累计星数：\${this.formatNumber(p.stars)}</p>
            <p>演变：\${p.wikiContext.evolution || '持续热门'}</p>
            <a href="../../wiki/projects/\${p.wikiContext.fileName.replace('.md', '')}.html">查看完整 Wiki</a>
          </div>
        \`).join('')}
      </div>
    </section>
  \`;
}
```

- [ ] **Step 3: 提交 HTML 报告增强**

```bash
git add src/generator/html-generator.js
git commit -m "feat: HTML 报告使用 Wiki 数据增强"
```

---

## Phase 3: 论文 Wiki 集成

### Task 7: 论文 Wiki 集成

**Files:**
- Modify: `src/scraper/paper-downloader.js` 或 `src/scraper/strategies/papers-scraper.js`
- Modify: `src/analyzer/paper-analyzer.js`
- Modify: `src/generator/paper-html-generator.js`

- [ ] **Step 1: 修改论文抓取流程，检查/创建 Wiki**

在论文抓取流程中添加：

```javascript
const WikiManager = require('../wiki/wiki-manager');
const wikiManager = new WikiManager();

// 处理每篇论文时
for (const paper of papers) {
  // 检查 Wiki 是否已存在（论文不重复收录）
  const existingWiki = await wikiManager.getPaperWiki(paper.arxivId);
  
  if (existingWiki) {
    logger.info(\`论文 Wiki 已存在，跳过：\${paper.arxivId}\`);
    continue;
  }

  // 创建新 Wiki
  await wikiManager.createPaperWiki(paper.arxivId, {
    title: paper.title,
    arxivId: paper.arxivId,
    publishDate: paper.publishDate,
    firstRecorded: currentDate,
    paperType: paper.type,
    domain: paper.domain,
    authors: paper.authors,
    contributions: paper.contributions,
    githubLinks: paper.githubUrl,
    analysis: paper.analysis,
    bibtex: paper.bibtex
  });
}
```

- [ ] **Step 2: 从 BibTeX 提取引用关系**

```javascript
const CrossReferenceAnalyzer = require('../wiki/cross-reference');
const crossRefAnalyzer = new CrossReferenceAnalyzer();

// 解析 BibTeX 引用
const citations = crossRefAnalyzer.extractCitationsFromBibTeX(paper.bibtex);

// 更新被引用论文的 Wiki
for (const citedArxivId of citations) {
  await wikiManager.addCitationLink(citedArxivId, paper.arxivId);
}
```

- [ ] **Step 3: 修改论文 HTML 生成器，添加 Wiki 链接**

在 `paper-html-generator.js` 中添加：

```javascript
renderPaperCard(paper) {
  return \`
    <div class="paper-card">
      <h3>\${paper.title}</h3>
      <div class="paper-meta">
        <span class="arxiv-id">arXiv:\${paper.arxivId}</span>
        <span class="paper-type">\${paper.type}</span>
        \${paper.wikiExists ? \`
          <a href="../../wiki/papers/\${paper.arxivId}.md" class="wiki-link">
            查看 Wiki →
          </a>
        \` : ''}
      </div>
      <!-- 其他现有内容... -->
    </div>
  \`;
}
```

- [ ] **Step 4: 提交论文 Wiki 集成**

```bash
git add src/scraper/strategies/papers-scraper.js src/analyzer/paper-analyzer.js src/generator/paper-html-generator.js
git commit -m "feat: 集成 Wiki 到论文流程"
```

---

## Phase 4: 项目对比页

### Task 8: 项目对比页生成器

**Files:**
- Create: `src/generator/comparison-generator.js`
- Create: `public/css/comparison.css`

- [ ] **Step 1: 创建对比页生成器**

```javascript
/**
 * Comparison Generator - 项目对比页生成器
 */

const fs = require('fs');
const path = require('path');
const WikiManager = require('../wiki/wiki-manager');
const logger = require('../utils/logger');

class ComparisonGenerator {
  constructor(options = {}) {
    this.wikiManager = new WikiManager(options);
    this.outputDir = options.outputDir || path.join(process.cwd(), 'reports');
  }

  /**
   * 生成对比页
   * @param {string} projectA - 项目 A (owner/repo)
   * @param {string} projectB - 项目 B (owner/repo)
   * @returns {Promise<string>} 输出文件路径
   */
  async generate(projectA, projectB) {
    try {
      logger.info(\`生成对比页：\${projectA} vs \${projectB}\`);

      const [ownerA, repoA] = projectA.split('/');
      const [ownerB, repoB] = projectB.split('/');

      const wikiA = await this.wikiManager.getOrCreateWiki(ownerA, repoA);
      const wikiB = await this.wikiManager.getOrCreateWiki(ownerB, repoB);

      const dataA = this._parseWiki(wikiA.content);
      const dataB = this._parseWiki(wikiB.content);

      const html = this._renderHTML(dataA, dataB);

      const outputPath = path.join(this.outputDir, 'comparison.html');
      fs.writeFileSync(outputPath, html, 'utf-8');

      logger.success(\`对比页已生成：\${outputPath}\`);
      return outputPath;
    } catch (error) {
      logger.error(\`生成对比页失败：\${error.message}\`);
      throw error;
    }
  }

  _parseWiki(content) {
    if (!content) return {};
    
    return {
      firstSeen: this._extractField(content, '首次上榜'),
      lastSeen: this._extractField(content, '最近上榜'),
      appearances: parseInt(this._extractField(content, '上榜次数')) || 0,
      domain: this._extractField(content, '领域分类'),
      language: this._extractField(content, '语言'),
      stars: this._extractField(content, 'GitHub Stars'),
      coreFunctions: content.match(/## 核心功能\\n([\\s\\S]*?)\\n##/)?.[1] || ''
    };
  }

  _extractField(content, fieldName) {
    const regex = new RegExp(\`- \${fieldName}：(.+)\\n\`);
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  _renderHTML(dataA, dataB) {
    return \`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>项目对比</title>
  <link rel="stylesheet" href="../public/css/comparison.css">
</head>
<body>
  <header>
    <h1>🆚 项目对比</h1>
  </header>

  <section class="selector">
    <p>选择两个项目进行对比</p>
    <form action="comparison.html" method="get">
      <label>项目 A:
        <select name="a" id="project-a">
          <option value="\${dataA.owner}/\${dataA.repo}" selected>\${dataA.owner}/\${dataA.repo}</option>
        </select>
      </label>
      <label>项目 B:
        <select name="b" id="project-b">
          <option value="\${dataB.owner}/\${dataB.repo}" selected>\${dataB.owner}/\${dataB.repo}</option>
        </select>
      </label>
      <button type="submit">对比</button>
    </form>
  </section>

  <section class="comparison-result">
    <table class="metrics-table">
      <thead>
        <tr>
          <th>指标</th>
          <th>\${dataA.owner}/\${dataA.repo}</th>
          <th>\${dataB.owner}/\${dataB.repo}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>首次上榜</td>
          <td>\${dataA.firstSeen || '-'}</td>
          <td>\${dataB.firstSeen || '-'}</td>
        </tr>
        <tr>
          <td>最近上榜</td>
          <td>\${dataA.lastSeen || '-'}</td>
          <td>\${dataB.lastSeen || '-'}</td>
        </tr>
        <tr>
          <td>上榜次数</td>
          <td>\${dataA.appearances}</td>
          <td>\${dataB.appearances}</td>
        </tr>
        <tr>
          <td>GitHub Stars</td>
          <td>\${dataA.stars}</td>
          <td>\${dataB.stars}</td>
        </tr>
        <tr>
          <td>领域分类</td>
          <td>\${dataA.domain}</td>
          <td>\${dataB.domain}</td>
        </tr>
        <tr>
          <td>编程语言</td>
          <td>\${dataA.language}</td>
          <td>\${dataB.language}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <footer>
    <a href="wiki-index.html">返回 Wiki 索引</a>
  </footer>
</body>
</html>\`;
  }
}

module.exports = ComparisonGenerator;
```

- [ ] **Step 2: 创建对比页样式**

```css
/* Comparison Page Styles */

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  background: #f5f5f5;
}

header {
  text-align: center;
  padding: 30px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 30px;
}

header h1 {
  margin: 0;
}

section {
  background: white;
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.selector {
  text-align: center;
}

.selector form {
  display: flex;
  gap: 20px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.selector select {
  padding: 10px 15px;
  font-size: 1em;
  border-radius: 8px;
  border: 1px solid #ddd;
  min-width: 250px;
}

.selector button {
  padding: 10px 30px;
  font-size: 1em;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.selector button:hover {
  background: #5568d3;
}

.metrics-table {
  width: 100%;
  border-collapse: collapse;
}

.metrics-table th,
.metrics-table td {
  padding: 15px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.metrics-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.metrics-table th:nth-child(2),
.metrics-table th:nth-child(3) {
  background: #e8eaf6;
}

.metrics-table tr:hover {
  background: #f8f9fa;
}

footer {
  text-align: center;
}

footer a {
  color: #667eea;
  text-decoration: none;
}
```

- [ ] **Step 3: 提交对比页生成器**

```bash
git add src/generator/comparison-generator.js public/css/comparison.css
git commit -m "feat: 添加项目对比页生成器"
```

---

## Phase 5: 验证与文档

### Task 9: 端到端测试

**Files:**
- Create: `tests/wiki/integration.test.js`

- [ ] **Step 1: 创建集成测试**

```javascript
const path = require('path');
const fs = require('fs');
const WikiManager = require('../../src/wiki/wiki-manager');
const WikiIndexGenerator = require('../../src/generator/wiki-index-generator');

describe('Wiki Integration', () => {
  let wikiManager;
  const testDir = path.join(__dirname, '../fixtures/wiki-integration');

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    wikiManager = new WikiManager({ baseDir: testDir });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('应该完成完整的 Wiki 工作流', async () => {
    // 1. 创建项目 Wiki
    await wikiManager.createProjectWiki('owner', 'repo', {
      domain: 'agent',
      language: 'Python',
      stars: '1,234'
    });

    // 2. 追加版本记录
    await wikiManager.appendVersion('owner', 'repo', {
      date: '2026-04-17',
      eventType: '首次上榜',
      source: '[日报](...)',
      analysis: '分析内容'
    });

    // 3. 验证 Wiki 内容
    const wiki = await wikiManager.getOrCreateWiki('owner', 'repo');
    expect(wiki.exists).toBe(true);
    expect(wiki.content).toContain('### 2026-04-17');

    // 4. 生成索引页
    const generator = new WikiIndexGenerator({ baseDir: testDir });
    const indexPath = await generator.generate();
    expect(fs.existsSync(indexPath)).toBe(true);
    expect(fs.readFileSync(indexPath, 'utf-8')).toContain('owner/repo');
  });
});
```

- [ ] **Step 2: 运行集成测试**

```bash
npm test -- tests/wiki/integration.test.js
```
Expected: PASS

- [ ] **Step 3: 提交集成测试**

```bash
git add tests/wiki/integration.test.js
git commit -m "test: 添加 Wiki 集成测试"
```

---

### Task 10: 更新文档

**Files:**
- Modify: `README.md`
- Create: `docs/WIKI.md`

- [ ] **Step 1: 创建 Wiki 使用文档**

```markdown
# LLM Wiki 使用指南

## 什么是 LLM Wiki？

LLM Wiki 是一个基于 Karpathy LLM Wiki 理念的项目知识库，为每个 GitHub 项目和 HF 论文维护详细的演变历史。

## 目录结构

```
wiki/
├── projects/    # GitHub 项目 Wiki
├── papers/      # 论文 Wiki
└── domains/     # 领域 Wiki
```

## 查看 Wiki

1. 打开 `reports/wiki-index.html` 查看 Wiki 索引
2. 点击项目名称进入详细 Wiki 页面
3. 使用对比功能比较两个项目

## Wiki 更新机制

- **项目 Wiki**: 每次上榜后自动追加版本记录
- **论文 Wiki**: 首次收录时创建，后续不重复

## 对外发布

Wiki 目录可以独立部署为静态网站：

```bash
# 生成 Wiki 索引
node scripts/generate-wiki-index.js

# 部署到服务器
rsync -av wiki/ server:/path/to/wiki/
```
```

- [ ] **Step 2: 更新 README**

在 README.md 中添加 Wiki 相关说明：

```markdown
### Wiki 知识库（新增）

- ✅ **项目 Wiki** - 为每个 GitHub 项目维护演变历史
- ✅ **论文 Wiki** - 为每篇 HF 论文创建详细档案
- ✅ **领域 Wiki** - 跨项目领域聚合分析
- ✅ **Wiki 索引页** - `reports/wiki-index.html`
- ✅ **项目对比** - `reports/comparison.html`

查看 [docs/WIKI.md](docs/WIKI.md) 了解更多。
```

- [ ] **Step 3: 提交文档**

```bash
git add docs/WIKI.md README.md
git commit -m "docs: 添加 LLM Wiki 使用文档"
```

---

## 验收清单

- [ ] Wiki 目录结构创建完成
- [ ] WikiManager 测试通过
- [ ] CrossReferenceAnalyzer 测试通过
- [ ] 日报流程集成 Wiki
- [ ] HTML 报告显示 Wiki 数据
- [ ] 论文 Wiki 创建和关联更新
- [ ] Wiki 索引页可访问
- [ ] 项目对比页可访问
- [ ] 集成测试通过
- [ ] 文档完整

---

## 后续优化（不在本次实施范围）

1. **领域 Wiki 自动生成** - 基于项目 Wiki 聚合生成
2. **Wiki 搜索功能** - 全文搜索 Wiki 内容
3. **Markdown → HTML 转换** - 独立的 Wiki 静态网站
4. **引用图谱可视化** - 使用 D3.js 展示论文引用关系
