/**
 * IndexPageGenerator - 首页知识图谱生成器
 * 生成包含知识图谱的首页 HTML
 */

const fs = require('fs');
const path = require('path');
const KnowledgeGraph = require('../wiki/graph/knowledge-graph');
const DomainMapper = require('../wiki/config/domain-mapper');
const logger = require('../utils/logger');

class IndexPageGenerator {
  constructor() {
    this.kg = new KnowledgeGraph();
    this.domainMapper = new DomainMapper();
  }

  /**
   * 生成首页 HTML
   * @param {string} outputPath - 输出路径
   */
  async generate(outputPath = 'reports/wiki-index.html') {
    logger.info('开始生成知识图谱首页...');

    // 1. 构建知识图谱
    await this.kg.buildFromWiki();

    // 2. 获取数据
    const stats = this.kg.getStats();
    const topProjects = this.kg.getTopHotProjects(20);
    const superDomains = this.domainMapper.getAllSuperDomains();

    // 3. 为热门项目获取邻居
    const projectsWithNeighbors = topProjects.map(project => ({
      ...project,
      neighbors: this.kg.getNeighbors(project.fullName, { limit: 3 })
    }));

    // 4. 生成 HTML
    const html = this._renderHTML({
      stats,
      projects: projectsWithNeighbors,
      superDomains
    });

    // 5. 写入文件
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, html, 'utf-8');

    logger.success(`知识图谱首页生成成功: ${outputPath}`);
    return outputPath;
  }

  /**
   * 渲染 HTML
   * @private
   */
  _renderHTML(data) {
    const { stats, projects, superDomains } = data;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub AI 趋势 - 知识图谱</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      line-height: 1.6;
    }

    .header {
      background: linear-gradient(135deg, #1f2937 0%, #0d1117 100%);
      padding: 2rem 1.5rem;
      border-bottom: 1px solid #30363d;
    }

    .header h1 {
      font-size: 2rem;
      color: #58a6ff;
      margin-bottom: 0.5rem;
    }

    .header p {
      color: #8b949e;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      padding: 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .stat-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 1.25rem;
      text-align: center;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #58a6ff;
    }

    .stat-label {
      color: #8b949e;
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }

    .main-content {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 1.5rem;
      padding: 1.5rem;
      max-width: 1600px;
      margin: 0 auto;
    }

    @media (max-width: 1024px) {
      .main-content {
        grid-template-columns: 1fr;
      }
    }

    .sidebar {
      position: sticky;
      top: 1rem;
      height: fit-content;
    }

    .domain-nav {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 1rem;
    }

    .domain-nav h3 {
      color: #58a6ff;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }

    .domain-item {
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .domain-item:hover {
      background: #21262d;
    }

    .domain-item.active {
      background: #238636;
    }

    .domain-icon {
      font-size: 1.25rem;
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }

    .project-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 1.25rem;
      transition: all 0.2s;
      cursor: pointer;
    }

    .project-card:hover {
      border-color: #58a6ff;
      transform: translateY(-2px);
    }

    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .project-name {
      color: #58a6ff;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .project-stars {
      background: #21262d;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.9rem;
      color: #ffa657;
    }

    .project-meta {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .meta-tag {
      font-size: 0.8rem;
      padding: 0.25rem 0.5rem;
      background: #21262d;
      border-radius: 4px;
      color: #8b949e;
    }

    .project-desc {
      color: #8b949e;
      font-size: 0.9rem;
      margin-bottom: 0.75rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .project-functions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .function-tag {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      background: #1158c730;
      color: #58a6ff;
      border-radius: 4px;
    }

    .neighbors-section {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #30363d;
      display: none;
    }

    .neighbors-section.expanded {
      display: block;
    }

    .neighbors-title {
      font-size: 0.85rem;
      color: #8b949e;
      margin-bottom: 0.5rem;
    }

    .neighbor-item {
      font-size: 0.85rem;
      padding: 0.5rem;
      background: #21262d;
      border-radius: 4px;
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .neighbor-name {
      color: #58a6ff;
    }

    .neighbor-types {
      display: flex;
      gap: 0.25rem;
    }

    .neighbor-type-tag {
      font-size: 0.7rem;
      padding: 0.15rem 0.4rem;
      background: #23863630;
      color: #238636;
      border-radius: 4px;
    }

    .search-bar {
      padding: 0 1.5rem 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .search-input {
      width: 100%;
      max-width: 600px;
      padding: 0.75rem 1rem;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      color: #c9d1d9;
      font-size: 1rem;
    }

    .search-input:focus {
      outline: none;
      border-color: #58a6ff;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 GitHub AI 趋势知识图谱</h1>
    <p>探索 AI 领域热门项目及其关联关系</p>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${stats.nodes}</div>
      <div class="stat-label">项目数量</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.edges}</div>
      <div class="stat-label">关联关系</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.superDomains}</div>
      <div class="stat-label">超级领域</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.domains}</div>
      <div class="stat-label">子领域</div>
    </div>
  </div>

  <div class="search-bar">
    <input type="text" class="search-input" id="searchInput" placeholder="搜索项目...">
  </div>

  <div class="main-content">
    <aside class="sidebar">
      <div class="domain-nav">
        <h3>📚 领域导航</h3>
        <div class="domain-item active" data-domain="all">
          <span class="domain-icon">✨</span>
          <span>全部</span>
        </div>
        ${superDomains.map(sd => `
          <div class="domain-item" data-domain="${sd.key}">
            <span class="domain-icon">${sd.icon}</span>
            <span>${sd.name}</span>
          </div>
        `).join('')}
      </div>
    </aside>

    <main class="content">
      <div class="projects-grid" id="projectsGrid">
        ${projects.map(project => this._renderProjectCard(project)).join('')}
      </div>
    </main>
  </div>

  <script>
    // 简单的前端交互逻辑
    let allProjects = ${JSON.stringify(projects)};
    let activeDomain = 'all';

    document.addEventListener('DOMContentLoaded', () => {
      setupDomainNavigation();
      setupSearch();
      setupProjectCards();
    });

    function setupDomainNavigation() {
      const domainItems = document.querySelectorAll('.domain-item');
      domainItems.forEach(item => {
        item.addEventListener('click', () => {
          domainItems.forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          activeDomain = item.dataset.domain;
          filterProjects();
        });
      });
    }

    function setupSearch() {
      const searchInput = document.getElementById('searchInput');
      searchInput.addEventListener('input', (e) => {
        filterProjects(e.target.value.toLowerCase());
      });
    }

    function setupProjectCards() {
      document.addEventListener('click', (e) => {
        const card = e.target.closest('.project-card');
        if (card && !e.target.closest('.neighbors-section')) {
          const neighbors = card.querySelector('.neighbors-section');
          neighbors.classList.toggle('expanded');
        }
      });
    }

    function filterProjects(searchQuery = '') {
      const grid = document.getElementById('projectsGrid');
      let filtered = allProjects;

      if (activeDomain !== 'all') {
        filtered = allProjects.filter(p => p.superDomains.includes(activeDomain));
      }

      if (searchQuery) {
        filtered = filtered.filter(p =>
          p.fullName.toLowerCase().includes(searchQuery) ||
          p.repo.toLowerCase().includes(searchQuery) ||
          p.owner.toLowerCase().includes(searchQuery) ||
          p.domains.some(d => d.toLowerCase().includes(searchQuery))
        );
      }

      grid.innerHTML = filtered.map(p => renderProjectCard(p)).join('');
    }

    function renderProjectCard(project) {
      return \`
        <div class="project-card" data-fullname="\${project.fullName}">
          <div class="project-header">
            <div class="project-name">\${project.fullName}</div>
            <div class="project-stars">⭐ \${project.stars.toLocaleString()}</div>
          </div>
          <div class="project-meta">
            <span class="meta-tag">\${project.language}</span>
            <span class="meta-tag">上榜 \${project.appearances} 次</span>
            \${project.domains.slice(0, 2).map(d => \`<span class="meta-tag">\${d}</span>\`).join('')}
          </div>
          \${project.coreFunctions.length > 0 ? \`
            <div class="project-functions">
              \${project.coreFunctions.slice(0, 3).map(f => \`<span class="function-tag">\${f}</span>\`).join('')}
            </div>
          \` : ''}
          \${project.neighbors && project.neighbors.length > 0 ? \`
            <div class="neighbors-section">
              <div class="neighbors-title">🔗 相关项目</div>
              \${project.neighbors.map(n => \`
                <div class="neighbor-item">
                  <span class="neighbor-name">\${n.project.fullName}</span>
                  <div class="neighbor-types">
                    \${n.types.slice(0, 2).map(t => \`<span class="neighbor-type-tag">\${t}</span>\`).join('')}
                  </div>
                </div>
              \`).join('')}
            </div>
          \` : ''}
        </div>
      \`;
    }
  </script>
</body>
</html>`;
  }

  /**
   * 渲染项目卡片
   * @private
   */
  _renderProjectCard(project) {
    return `
      <div class="project-card" data-fullname="${project.fullName}">
        <div class="project-header">
          <div class="project-name">${project.fullName}</div>
          <div class="project-stars">⭐ ${project.stars.toLocaleString()}</div>
        </div>
        <div class="project-meta">
          <span class="meta-tag">${project.language}</span>
          <span class="meta-tag">上榜 ${project.appearances} 次</span>
          ${project.domains.slice(0, 2).map(d => `<span class="meta-tag">${d}</span>`).join('')}
        </div>
        ${project.coreFunctions.length > 0 ? `
          <div class="project-functions">
            ${project.coreFunctions.slice(0, 3).map(f => `<span class="function-tag">${f}</span>`).join('')}
          </div>
        ` : ''}
        ${project.neighbors && project.neighbors.length > 0 ? `
          <div class="neighbors-section">
            <div class="neighbors-title">🔗 相关项目</div>
            ${project.neighbors.map(n => `
              <div class="neighbor-item">
                <span class="neighbor-name">${n.project.fullName}</span>
                <div class="neighbor-types">
                  ${n.types.slice(0, 2).map(t => `<span class="neighbor-type-tag">${t}</span>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
}

module.exports = IndexPageGenerator;
