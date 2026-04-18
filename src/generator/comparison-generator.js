/**
 * Comparison Generator - 项目对比页生成器
 * 生成项目对比 HTML 页面，支持多个项目的维度对比
 */

const fs = require('fs');
const path = require('path');
const WikiManager = require('../wiki/wiki-manager');
const CrossReferenceAnalyzer = require('../wiki/cross-reference');
const logger = require('../utils/logger');

class ComparisonGenerator {
  constructor(options = {}) {
    this.wikiManager = new WikiManager(options);
    this.analyzer = new CrossReferenceAnalyzer();
    this.outputDir = options.outputDir || path.join(process.cwd(), 'reports', 'comparison');
  }

  /**
   * 生成项目对比页
   * @param {Array} projectIds - 项目 ID 数组 [{owner, repo}]
   * @returns {Promise<string>} 输出文件路径
   */
  async generate(projectIds) {
    try {
      logger.info('生成项目对比页...', { projects: projectIds.length });

      // 确保输出目录存在
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      // 加载所有项目的 Wiki 数据
      const projects = await this._loadProjectWikis(projectIds);

      // 生成对比数据
      const comparisonData = this._generateComparisonData(projects);

      // 生成 HTML
      const html = this._renderHTML(comparisonData);

      // 写入文件
      const outputPath = path.join(this.outputDir, `comparison-${Date.now()}.html`);
      fs.writeFileSync(outputPath, html, 'utf-8');

      logger.success(`项目对比页已生成：${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error(`生成项目对比页失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 加载项目 Wiki 数据
   * @param {Array} projectIds - 项目 ID 数组
   * @returns {Promise<Array>} Wiki 数据数组
   */
  async _loadProjectWikis(projectIds) {
    const projects = [];

    for (const projectId of projectIds) {
      try {
        const wikiPath = path.join(this.wikiManager.projectsDir, `${projectId.owner}_${projectId.repo}.md`);

        if (!fs.existsSync(wikiPath)) {
          logger.warn(`Wiki 不存在：${projectId.owner}/${projectId.repo}`);
          continue;
        }

        const content = fs.readFileSync(wikiPath, 'utf-8');

        projects.push({
          owner: projectId.owner,
          repo: projectId.repo,
          content,
          ...this._parseWikiContent(content)
        });
      } catch (error) {
        logger.error(`加载 ${projectId.owner}/${projectId.repo} Wiki 失败：${error.message}`);
      }
    }

    return projects;
  }

  /**
   * 解析 Wiki 内容
   * @param {string} content - Wiki Markdown 内容
   * @returns {Object} 解析后的数据
   */
  _parseWikiContent(content) {
    const data = {};

    // 提取基本信息
    const firstSeenMatch = content.match(/- 首次上榜：(.+)/);
    const appearancesMatch = content.match(/- 上榜次数：(.+)/);
    const domainMatch = content.match(/- 领域分类：(.+)/);
    const languageMatch = content.match(/- 语言：(.+)/);
    const starsMatch = content.match(/- GitHub Stars: (.+)/);
    const coreFuncMatch = content.match(/- 核心功能：(.+)/);

    data.firstSeen = firstSeenMatch?.[1]?.trim() || null;
    data.appearances = parseInt(appearancesMatch?.[1]?.trim()) || 0;
    data.domain = domainMatch?.[1]?.trim() || null;
    data.language = languageMatch?.[1]?.trim() || null;
    data.stars = starsMatch?.[1]?.trim() || null;
    data.coreFunctions = coreFuncMatch ? coreFuncMatch[1].split(',').map(s => s.trim()) : [];

    // 提取版本历史
    const versionHistoryMatch = content.match(/## 版本历史([\s\S]*?)(?=##|$)/);
    data.versionHistory = versionHistoryMatch ? versionHistoryMatch[1].trim() : '';

    // 提取跨项目关联
    const crossRefMatch = content.match(/## 跨项目关联([\s\S]*?)(?=##|$)/);
    data.crossReferences = crossRefMatch ? crossRefMatch[1].trim() : '';

    return data;
  }

  /**
   * 生成对比数据
   * @param {Array} projects - 项目 Wiki 数据数组
   * @returns {Object} 对比数据
   */
  _generateComparisonData(projects) {
    if (projects.length === 0) {
      return { projects: [], dimensions: [] };
    }

    // 对比维度
    const dimensions = [
      { key: 'appearances', label: '上榜次数', type: 'number' },
      { key: 'stars', label: 'GitHub Stars', type: 'stars' },
      { key: 'language', label: '编程语言', type: 'text' },
      { key: 'domain', label: '领域分类', type: 'text' },
      { key: 'firstSeen', label: '首次上榜', type: 'date' }
    ];

    // 计算每个维度的最大值（用于进度条）
    const maxValues = {};
    for (const dim of dimensions) {
      if (dim.type === 'number' || dim.type === 'stars') {
        maxValues[dim.key] = Math.max(...projects.map(p => {
          const val = p[dim.key];
          if (!val) return 0;
          if (dim.type === 'stars') {
            return this._parseStars(val);
          }
          return parseInt(val) || 0;
        }));
      }
    }

    return {
      projects,
      dimensions,
      maxValues,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 解析 Stars 字符串为数字
   * @param {string} starsStr - Stars 字符串（如 "5.2k"）
   * @returns {number} 数字
   */
  _parseStars(starsStr) {
    if (!starsStr) return 0;
    if (typeof starsStr === 'number') return starsStr;

    const str = starsStr.trim().toLowerCase();
    if (str.endsWith('k')) {
      return parseFloat(str.slice(0, -1)) * 1000;
    }
    if (str.endsWith('w')) {
      return parseFloat(str.slice(0, -1)) * 10000;
    }
    return parseInt(str.replace(/,/g, '')) || 0;
  }

  /**
   * 渲染 HTML 页面
   * @param {Object} data - 对比数据
   * @returns {string} HTML 字符串
   */
  _renderHTML(data) {
    const { projects, dimensions, maxValues } = data;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>项目对比 - AI Project Wiki</title>
  <link rel="stylesheet" href="../../public/css/comparison.css">
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --text-primary: #c9d1d9;
      --text-secondary: #8b949e;
      --accent: #58a6ff;
      --accent-green: #3fb950;
      --accent-purple: #9333ea;
      --border: #30363d;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 24px;
      line-height: 1.5;
    }

    .container { max-width: 1400px; margin: 0 auto; }

    header {
      text-align: center;
      padding: 32px 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 32px;
    }

    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    .subtitle { color: var(--text-secondary); font-size: 0.875rem; }

    .comparison-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 32px;
    }

    .comparison-table th,
    .comparison-table td {
      padding: 12px 16px;
      border: 1px solid var(--border);
      text-align: left;
    }

    .comparison-table th {
      background: var(--bg-secondary);
      font-weight: 600;
      color: var(--text-secondary);
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    .comparison-table td.project-name {
      font-weight: 600;
      min-width: 200px;
    }

    .comparison-table td.project-name a {
      color: var(--accent);
      text-decoration: none;
    }

    .comparison-table td.project-name a:hover {
      text-decoration: underline;
    }

    .stat-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .bar {
      flex: 1;
      height: 8px;
      background: var(--bg-secondary);
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--accent-purple));
      border-radius: 4px;
      transition: width 0.3s;
    }

    .bar-value {
      min-width: 60px;
      text-align: right;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .wiki-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--accent);
      text-decoration: none;
      font-size: 0.8125rem;
      transition: all 0.2s;
    }

    .wiki-link:hover {
      background: var(--border);
      text-decoration: none;
    }

    .version-history {
      max-width: 400px;
      font-size: 0.8125rem;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .tag {
      display: inline-block;
      padding: 2px 8px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .domain-agent { color: #f472b6; }
    .domain-rag { color: #60a5fa; }
    .domain-llm { color: #a78bfa; }
    .domain-speech { color: #34d399; }
    .domain-vision { color: #fbbf24; }
    .domain-dev-tool { color: #fb923c; }
    .domain-other { color: var(--text-muted); }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      cursor: pointer;
      text-decoration: none;
      transition: opacity 0.2s;
    }

    .btn:hover { opacity: 0.9; }
    .btn-secondary { background: var(--bg-secondary); border: 1px solid var(--border); }

    @media (max-width: 768px) {
      .comparison-table { font-size: 0.75rem; }
      .comparison-table th, .comparison-table td { padding: 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 项目对比</h1>
      <p class="subtitle">Generated at ${new Date(data.generatedAt).toLocaleString('zh-CN')}</p>
    </header>

    <table class="comparison-table">
      <thead>
        <tr>
          <th>项目</th>
          ${dimensions.map(d => `<th>${d.label}</th>`).join('')}
          <th>版本历史</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${projects.map(p => `
          <tr>
            <td class="project-name">
              <a href="https://github.com/${p.owner}/${p.repo}" target="_blank">${p.owner}/${p.repo}</a>
            </td>
            ${this._renderDimensionCells(p, dimensions, maxValues)}
            <td class="version-history">
              ${this._renderVersionHistory(p.versionHistory)}
            </td>
            <td>
              <a href="../wiki/projects/${p.owner}_${p.repo}.html" class="wiki-link" target="_blank">
                📚 Wiki
              </a>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="actions">
      <a href="../wiki-index.html" class="btn">📚 返回 Wiki 索引</a>
      <a href="../index.html" class="btn btn-secondary">🏠 返回报告首页</a>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * 渲染维度单元格
   * @param {Object} project - 项目数据
   * @param {Array} dimensions - 维度数组
   * @param {Object} maxValues - 最大值对象
   * @returns {string} HTML 字符串
   */
  _renderDimensionCells(project, dimensions, maxValues) {
    return dimensions.map(dim => {
      const value = project[dim.key];

      if (dim.type === 'number' || dim.type === 'stars') {
        const numValue = dim.type === 'stars' ? this._parseStars(value) : (parseInt(value) || 0);
        const percentage = maxValues[dim.key] > 0 ? (numValue / maxValues[dim.key]) * 100 : 0;

        return `
          <td>
            <div class="stat-bar">
              <div class="bar">
                <div class="bar-fill" style="width: ${percentage}%"></div>
              </div>
              <span class="bar-value">${value || '0'}</span>
            </div>
          </td>
        `;
      }

      if (dim.type === 'text') {
        if (dim.key === 'domain') {
          const domainClass = `domain-${(value || 'other').toLowerCase()}`;
          return `<td><span class="tag ${domainClass}">${value || 'N/A'}</span></td>`;
        }
        return `<td>${value || 'N/A'}</td>`;
      }

      if (dim.type === 'date') {
        return `<td>${value || 'N/A'}</td>`;
      }

      return `<td>N/A</td>`;
    }).join('');
  }

  /**
   * 渲染版本历史
   * @param {string} versionHistory - 版本历史内容
   * @returns {string} HTML 字符串
   */
  _renderVersionHistory(versionHistory) {
    if (!versionHistory) return '暂无记录';

    // 提取最近 3 条记录
    const lines = versionHistory.split('\n').filter(l => l.trim());
    const recentLines = lines.slice(0, 6);

    return recentLines.map(line => `<div>${line.substring(0, 50)}${line.length > 50 ? '...' : ''}</div>`).join('');
  }
}

module.exports = ComparisonGenerator;
