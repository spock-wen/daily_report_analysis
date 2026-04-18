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
    throw new Error(`Unknown template: ${template}`);
  }

  let result = templateStr;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(placeholder, value || '');
  }
  return result;
}

module.exports = {
  WIKI_TEMPLATES,
  renderTemplate
};
