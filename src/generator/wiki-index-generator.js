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

      // 获取领域 Wiki 列表
      const domainWikis = await this._listDomainWikis();

      // 修正领域数量统计
      stats.domains = domainWikis.length;
      stats.total = stats.projects + stats.domains;

      // 生成 HTML
      const html = this._renderHTML(stats, projectWikis, domainWikis);

      // 写入文件
      const outputPath = path.join(this.outputDir, 'wiki-index.html');

      // 确保输出目录存在
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, html, 'utf-8');

      logger.success(`Wiki 索引页已生成：${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error(`生成 Wiki 索引页失败：${error.message}`);
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
   * 列出所有领域 Wiki
   */
  async _listDomainWikis() {
    const projectsDir = this.wikiManager.projectsDir;
    if (!fs.existsSync(projectsDir)) return [];

    // 从项目 Wiki 中聚合领域信息
    const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
    const domainMap = {};

    for (const file of files) {
      const content = fs.readFileSync(path.join(projectsDir, file), 'utf-8');
      const domain = this._extractField(content, '领域分类');
      if (domain) {
        const domainKey = domain.toLowerCase();
        if (!domainMap[domainKey]) {
          domainMap[domainKey] = 0;
        }
        domainMap[domainKey]++;
      }
    }

    const wikis = [];
    for (const [domainName, projectCount] of Object.entries(domainMap)) {
      wikis.push({
        name: domainName,
        fileName: `${domainName}.html`,
        projectCount
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

    // 同时支持中文冒号（：）和英文冒号（:）
    const regex = new RegExp(`- ${pattern}[：:](.+)\\n`);
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * 渲染 HTML 页面
   */
  _renderHTML(stats, projectWikis, domainWikis) {
    const topProjects = projectWikis.slice(0, 10);

    return `<!DOCTYPE html>
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
    <a href="#domains">领域 Wiki</a>
  </nav>

  <section class="stats-section">
    <h2>📊 统计</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.projects}</div>
        <div class="stat-label">收录项目</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.domains}</div>
        <div class="stat-label">领域 Wiki</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">总 Wiki 条目</div>
      </div>
    </div>
  </section>

  <section id="domains" class="domain-section">
    <h2>领域导航</h2>
    <div class="domain-grid">
      ${domainWikis.map(domain => `
        <a href="domains/${domain.name}.html" class="domain-card">
          <h3>${this._domainIcon(domain.name)} ${domain.name}</h3>
          <p>${domain.projectCount} 个项目</p>
        </a>
      `).join('')}
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
        ${topProjects.map((p, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><a href="projects/${p.fileName.replace('.md', '')}.html">${p.owner}/${p.repo}</a></td>
            <td>${p.domain}</td>
            <td>${p.appearances}</td>
            <td>${p.stars}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </section>

  <footer>
    <p>Generated by LLM Wiki Integration</p>
  </footer>
</body>
</html>`;
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
