# LLM Wiki 知识库系统

## 概述

LLM Wiki 是一个基于 Karpathy LLM Wiki 理念构建的项目知识库系统，为 GitHub AI Trending 报告和 HuggingFace 论文提供持久化的 Wiki 知识管理功能。

## 核心理念

- **Pure Markdown**: 所有 Wiki 以纯 Markdown 格式存储，便于版本控制和管理
- **版本追加**: 不覆盖原有内容，每次更新追加新版本历史记录
- **版本控制**: Wiki 文件存储在 git 中，可追溯历史变更

## 目录结构

```
wiki/
├── projects/          # 项目 Wiki
│   ├── owner_repo1.md
│   └── owner_repo2.md
├── papers/            # 论文 Wiki
│   ├── 2401.12345.md
│   └── 2402.67890.md
└── domains/           # 领域 Wiki
    ├── agent.md
    ├── rag.md
    └── llm.md
```

## 核心模块

### WikiManager (`src/wiki/wiki-manager.js`)

Wiki 核心管理类，提供 CRUD 操作：

```javascript
const wikiManager = new WikiManager();

// 创建项目 Wiki
await wikiManager.createProjectWiki(owner, repo, {
  firstSeen: '2026-04-01',
  appearances: '5',
  domain: 'agent',
  language: 'Python',
  stars: '5,200',
  coreFunctions: ['功能 1', '功能 2']
});

// 追加版本历史
await wikiManager.appendVersion(owner, repo, {
  date: '2026-04-15',
  eventType: '日报收录',
  source: '[日报 2026-04-15](../../daily/...)',
  analysis: '热点分析内容'
});

// 更新基本信息
await wikiManager.updateBasicInfo(owner, repo, {
  stars: '6,000',
  language: 'Python',
  domain: 'agent'
});

// 获取统计信息
const stats = await wikiManager.getStats();
// { projects: 10, papers: 5, domains: 8, total: 23 }
```

### WikiTemplates (`src/wiki/wiki-templates.js`)

提供三种 Wiki 模板：

- **project**: 项目 Wiki 模板
- **paper**: 论文 Wiki 模板
- **domain**: 领域 Wiki 模板

### CrossReferenceAnalyzer (`src/wiki/cross-reference.js`)

跨项目关联分析器：

```javascript
const analyzer = new CrossReferenceAnalyzer();

// 从 BibTeX 提取 arXiv 引用
const citations = analyzer.extractCitationsFromBibTeX(bibtex);

// 查找相似项目
const similar = analyzer.findSimilarProjects(currentProject, allWikis);

// 获取领域内项目
const projects = analyzer.getProjectsByDomain('agent', allWikis);
```

### WikiIndexGenerator (`src/generator/wiki-index-generator.js`)

生成 Wiki 索引 HTML 页面：

```javascript
const generator = new WikiIndexGenerator({ outputDir: 'reports' });
const indexPath = await generator.generate();
```

生成页面包含：
- 统计卡片（项目数、论文数、领域数）
- 领域导航
- 热门项目排行榜
- 最新收录论文列表

### ComparisonGenerator (`src/generator/comparison-generator.js`)

生成项目对比 HTML 页面：

```javascript
const generator = new ComparisonGenerator({ outputDir: 'reports/comparison' });
const comparisonPath = await generator.generate([
  { owner: 'user1', repo: 'project1' },
  { owner: 'user2', repo: 'project2' }
]);
```

对比维度：
- 上榜次数（带进度条可视化）
- GitHub Stars
- 编程语言
- 领域分类
- 首次上榜日期
- 版本历史摘要

## 集成工作流

### 日报/周报流程

ReportPipeline 自动更新 Wiki：

1. 抓取 GitHub trending 数据
2. AI 分析生成洞察
3. **自动更新项目 Wiki 版本历史**
4. 生成 HTML 报告（显示 Wiki 徽章）
5. 发送推送通知

### 论文流程

PapersScraper 自动创建/更新论文 Wiki：

1. 下载 HuggingFace latest.json
2. 过滤高 Star 论文
3. **提取 arXiv ID，创建/更新论文 Wiki**
4. 检测论文领域和类型
5. 提取代码链接

### 历史数据迁移

使用迁移脚本处理已有的 JSON 数据：

```bash
node scripts/migrate-json-to-wiki.js
```

功能：
- 扫描 `data/insights/daily/*.json`
- 按项目聚合历史数据
- 批量创建 Wiki 文件
- 追加每个版本的历史记录

## Wiki 格式示例

### 项目 Wiki

```markdown
# owner/repo

## 基本信息
- 首次上榜：2026-04-01
- 最近上榜：2026-04-15
- 上榜次数：5
- 领域分类：agent
- 语言：Python
- GitHub Stars: 5,200

## 核心功能
- 功能 1
- 功能 2

## 版本历史
### 2026-04-15 (日报收录)
**来源**: [日报 2026-04-15](...)
**分析**: 热点分析内容

## 跨项目关联
- 相似项目：user/project
- 引用论文：arXiv:2401.12345
```

### 论文 Wiki

```markdown
# Paper Title

## 基本信息
- arXiv ID: 2401.12345
- 发布日期：2024-01-15
- 首次收录：2026-04-10
- 论文类型：Research
- 领域分类：LLM
- 作者：Author et al.
- GitHub Stars: 1,200

## 代码链接
- https://github.com/user/repo

## 论文摘要
（待分析）

## 收录历史
### 2026-04-10 (HuggingFace)
**来源**: [HuggingFace Papers](https://huggingface.co/papers/2401.12345)
**Stars**: 1,200

## 相关论文
（待分析）
```

## HTML 报告增强

项目卡片显示 Wiki 徽章：

- 📚 **Wiki**: 表示项目已被 Wiki 收录
- **(N)**: 显示上榜次数（多次上榜时）

徽章样式：紫色渐变背景，悬停时显示阴影效果。

## 测试

运行端到端测试：

```bash
node tests/e2e/wiki-integration.test.js
```

测试覆盖：
- Wiki 创建和版本更新
- 索引页和对比页生成
- HTML 徽章渲染
- 跨项目关联分析

## 使用示例

### 在项目中使用

```javascript
// 在 ReportPipeline 中
const WikiManager = require('../wiki/wiki-manager');
const wikiManager = new WikiManager();

// 日报生成时自动更新 Wiki
await wikiManager.appendVersion(owner, repo, {
  date: new Date().toISOString().split('T')[0],
  eventType: '日报收录',
  source: '[日报 2026-04-17](...)',
  analysis: '分析内容'
});
```

### 生成索引页

```bash
node scripts/generate-wiki-index.js
```

### 生成项目对比

```javascript
const ComparisonGenerator = require('./src/generator/comparison-generator');
const generator = new ComparisonGenerator();
const path = await generator.generate([
  { owner: 'user1', repo: 'repo1' },
  { owner: 'user2', repo: 'repo2' }
]);
```

## 配置文件

在 `.env` 中配置：

```bash
# Wiki 基础目录（可选，默认：./wiki）
WIKI_BASE_DIR=./wiki

# 输出目录（可选）
WIKI_OUTPUT_DIR=./reports
```

## 未来扩展

- [ ] LLM 自动生成项目分析摘要
- [ ] 项目关系图谱可视化
- [ ] Wiki 变更通知
- [ ] 领域 Wiki 自动聚合
- [ ] 与主报告系统的深度集成

## 参考

- [Karpathy LLM Wiki](https://github.com/karpathy/llm-wiki)
- 设计文档：`docs/superpowers/specs/2026-04-17-llm-wiki-integration-design.md`
- 实施计划：`docs/superpowers/plans/2026-04-17-llm-wiki-integration.md`
