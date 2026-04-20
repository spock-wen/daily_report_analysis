/**
 * Wiki 模板定义 v2
 * 优化版：增加更多结构化字段，支持更丰富的内容
 */

const WIKI_TEMPLATES_V2 = {
  // GitHub 项目 Wiki 模板（优化版）
  project_v2: `# {owner}/{repo}

## 📊 基本信息

| 字段 | 值 |
|------|-----|
| 首次上榜 | {firstSeen} |
| 最近上榜 | {lastSeen} |
| 上榜次数 | {appearances} |
| 领域分类 | {domain} |
| 编程语言 | {language} |
| GitHub Stars | {stars} |
| 项目状态 | {projectStatus} |

## 🎯 项目概述

{projectOverview}

## ✨ 核心功能

{coreFunctions}

## 🛠️ 技术栈

{techStack}

## 📈 版本历史

{versionHistory}

## 🔗 跨项目关联

{crossReferences}

## 📝 备注

{notes}
`,

  // 论文 Wiki 模板（优化版）
  paper_v2: `# {title}

## 📊 基本信息

| 字段 | 值 |
|------|-----|
| arXiv ID | {arxivId} |
| 发布日期 | {publishDate} |
| 首次收录 | {firstRecorded} |
| 论文类型 | {paperType} |
| 领域分类 | {domain} |
| 引用次数 | {citations} |

## 👥 作者与机构

{authors}

## 📋 摘要

{abstract}

## 💡 核心贡献

{contributions}

## 🔗 资源链接

| 类型 | 链接 |
|------|------|
| arXiv | {arxivLink} |
| GitHub | {githubLink} |
| 项目主页 | {projectPage} |
| HuggingFace | {hfLink} |

## 📝 解读与分析

{analysis}

## 🔗 相关论文

{relatedPapers}

## 📚 BibTeX

\`\`\`bibtex
{bibtex}
\`\`\`
`,

  // 领域 Wiki 模板（优化版）
  domain_v2: `# {domainName} 领域

## 📊 领域概览

| 指标 | 数值 |
|------|------|
| 项目总数 | {projectCount} |
| 总 Stars | {totalStars} |
| 平均 Stars | {avgStars} |
| 本月新增 | {newThisMonth} |
| 活跃项目 | {activeProjects} |

## 🎯 领域定义

{domainDefinition}

## 🔥 代表项目（按上榜次数排序）

| 排名 | 项目 | 首次上榜 | 上榜次数 | Stars | 核心能力 |
|------|------|----------|----------|-------|----------|
{projectTable}

## 📈 趋势演变

{trendEvolution}

## 🔄 跨领域关联

{crossDomainRelations}

## 📚 学习资源

{learningResources}
`
};

/**
 * 渲染模板 v2
 * @param {string} template - 模板名称
 * @param {Object} data - 数据对象
 * @returns {string} 渲染后的 Markdown
 */
function renderTemplateV2(template, data) {
  const templateStr = WIKI_TEMPLATES_V2[template];
  if (!templateStr) {
    throw new Error(`Unknown template: ${template}`);
  }

  let result = templateStr;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(placeholder, value !== undefined ? value : '');
  }
  return result;
}

/**
 * 生成项目概述（基于核心功能和描述）
 * @param {Object} project - 项目数据
 * @returns {string} 项目概述
 */
function generateProjectOverview(project) {
  const {
    owner,
    repo,
    description = '',
    coreFunctions = [],
    domain = '通用工具',
    stars = '0'
  } = project;

  const starsNum = parseInt(stars?.replace(/,/g, '').replace(/k/, '000') || '0');
  let statusDesc = '新兴项目';
  if (starsNum >= 50000) statusDesc = '⭐ 明星项目';
  else if (starsNum >= 20000) statusDesc = '🌟 热门项目';
  else if (starsNum >= 5000) statusDesc = '💎 优质项目';
  else if (starsNum >= 1000) statusDesc = '📈 成长项目';

  const desc = description || coreFunctions[0] || `${owner}/${repo} 是一个 ${domain} 领域的开源项目`;

  return `${statusDesc}。${desc}`;
}

/**
 * 生成技术栈描述
 * @param {Object} project - 项目数据
 * @returns {string} 技术栈描述
 */
function generateTechStack(project) {
  const { language, topics = [] } = project;

  const parts = [];
  if (language && language !== 'Unknown') {
    parts.push(`**主要语言**: ${language}`);
  }
  if (topics.length > 0) {
    parts.push(`**技术标签**: ${topics.slice(0, 8).join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : '（暂无详细技术栈信息）';
}

module.exports = {
  WIKI_TEMPLATES_V2,
  renderTemplateV2,
  generateProjectOverview,
  generateTechStack
};
