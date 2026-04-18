#!/usr/bin/env node
/**
 * 领域 Wiki 页面生成器
 * 为每个领域（agent/rag/llm 等）生成导航页
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class DomainWikiGenerator {
  constructor(options = {}) {
    this.projectsDir = options.projectsDir || path.join(process.cwd(), 'wiki', 'projects');
    this.outputDir = options.outputDir || path.join(process.cwd(), 'reports', 'domains');
    this.domains = ['agent', 'rag', 'llm', 'speech', 'vision', 'dev-tool', 'other'];
  }

  /**
   * 生成所有领域 Wiki 页面
   * @returns {Promise<string[]>} 生成的文件路径列表
   */
  async generateAll() {
    logger.info('[DomainWikiGenerator] 开始生成领域 Wiki 页面...');

    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // 获取所有项目 Wiki 数据
    const projects = await this._loadAllProjects();

    // 按领域分组
    const projectsByDomain = this._groupByDomain(projects);

    const generatedPaths = [];

    for (const domain of this.domains) {
      const domainProjects = projectsByDomain[domain] || [];
      if (domainProjects.length === 0) {
        logger.debug(`  跳过空领域：${domain}`);
        continue;
      }

      const html = this.renderDomain(domain, domainProjects);
      const outputPath = path.join(this.outputDir, domain + '.html');
      fs.writeFileSync(outputPath, html, 'utf-8');
      generatedPaths.push(outputPath);

      logger.debug(`  已生成：${domain}.html (${domainProjects.length} 个项目)`);
    }

    logger.success(`[DomainWikiGenerator] 完成：${generatedPaths.length} 个领域 Wiki 已生成`);
    return generatedPaths;
  }

  /**
   * 加载所有项目 Wiki
   */
  async _loadAllProjects() {
    const files = fs.readdirSync(this.projectsDir).filter(f => f.endsWith('.md'));
    const projects = [];

    for (const file of files) {
      const wikiPath = path.join(this.projectsDir, file);
      const content = fs.readFileSync(wikiPath, 'utf-8');
      const match = file.match(/^(.+)_(.+)\.md$/);

      if (match) {
        projects.push({
          owner: match[1],
          repo: match[2],
          fileName: file.replace('.md', ''),
          title: `${match[1]}/${match[2]}`,
          firstSeen: this._extractField(content, '首次上榜'),
          appearances: parseInt(this._extractField(content, '上榜次数')) || 0,
          stars: this._parseStars(this._extractField(content, 'GitHub Stars')),
          domain: this._extractField(content, '领域分类'),
          language: this._extractField(content, '语言'),
          coreFunctions: this._extractSection(content, '核心功能')
        });
      }
    }

    return projects;
  }

  /**
   * 按领域分组
   */
  _groupByDomain(projects) {
    const groups = {};
    for (const project of projects) {
      const domain = project.domain?.toLowerCase() || 'other';
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(project);
    }

    // 每个领域内按 Stars 降序排序
    for (const domain of Object.keys(groups)) {
      groups[domain].sort((a, b) => b.stars - a.stars);
    }

    return groups;
  }

  /**
   * 解析 Stars 数值
   */
  _parseStars(starsStr) {
    if (!starsStr) return 0;

    // 处理 k 单位
    if (starsStr.toLowerCase().includes('k')) {
      return Math.round(parseFloat(starsStr.replace(/k/i, '')) * 1000);
    }

    // 处理逗号分隔
    return parseInt(starsStr.replace(/,/g, '')) || 0;
  }

  /**
   * 提取字段
   */
  _extractField(content, fieldName) {
    const regex = new RegExp(`- ${fieldName}：(.+)\\n`);
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * 提取章节内容
   */
  _extractSection(content, sectionName) {
    const match = content.match(new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=## |$)`));
    if (match) {
      return match[1].split('\n').filter(l => l.trim()).map(l => l.replace(/^- /, ''));
    }
    return [];
  }

  /**
   * 渲染领域页面
   */
  renderDomain(domain, projects) {
    const domainNames = {
      agent: '🤖 Agent',
      rag: '🔍 RAG (Retrieval-Augmented Generation)',
      llm: '🧠 LLM (Language Model)',
      speech: '🎤 Speech & Audio',
      vision: '👁️ Computer Vision',
      'dev-tool': '🛠️ Developer Tools',
      other: '📦 Other'
    };

    const domainDesc = {
      agent: '智能代理、多智能体系统、自主决策',
      rag: '检索增强生成、知识检索、向量数据库',
      llm: '大语言模型、Transformer、预训练模型',
      speech: '语音识别、语音合成、音频处理',
      vision: '图像生成、目标检测、视频理解',
      'dev-tool': '开发工具、调试、测试、部署',
      other: '其他 AI 相关项目'
    };

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${domainNames[domain] || domain} - AI Project Wiki</title>
  <link rel="stylesheet" href="../../public/css/wiki-domain.css">
</head>
<body>
  <header>
    <a href="../wiki-index.html" class="back-link">← 返回 Wiki 索引</a>
    <h1>${domainNames[domain] || domain}</h1>
    <p class="domain-desc">${domainDesc[domain] || ''}</p>
  </header>

  <main>
    <section class="stats-section">
      <h2>📊 领域统计</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${projects.length}</div>
          <div class="stat-label">项目数量</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this._formatStars(projects.reduce((sum, p) => sum + p.stars, 0))}</div>
          <div class="stat-label">总 Stars</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this._formatStars(Math.round(projects.reduce((sum, p) => sum + p.stars, 0) / projects.length))}</div>
          <div class="stat-label">平均 Stars</div>
        </div>
      </div>
    </section>

    <section class="projects-section">
      <h2>🚀 项目列表（按 Stars 排序）</h2>
      <table class="project-table">
        <thead>
          <tr>
            <th>排名</th>
            <th>项目</th>
            <th>首次上榜</th>
            <th>上榜次数</th>
            <th>Stars</th>
            <th>语言</th>
          </tr>
        </thead>
        <tbody>
          ${projects.map((p, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><a href="../projects/${p.fileName}.html">${p.title}</a></td>
              <td>${p.firstSeen || '-'}</td>
              <td>${p.appearances}</td>
              <td>${this._formatStars(p.stars)}</td>
              <td>${p.language || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section class="nav-section">
      <h2>📂 其他领域</h2>
      <div class="domain-nav">
        ${this.domains.filter(d => d !== domain).map(d => `
          <a href="../domains/${d}.html" class="domain-link">
            ${domainNames[d] || d}
          </a>
        `).join('')}
      </div>
    </section>
  </main>

  <footer>
    <p>Generated by LLM Wiki Integration</p>
  </footer>
</body>
</html>`;
  }

  /**
   * 格式化 Stars
   */
  _formatStars(stars) {
    if (stars >= 10000) {
      return `${(stars / 10000).toFixed(1)}w`;
    }
    if (stars >= 1000) {
      return `${(stars / 1000).toFixed(1)}k`;
    }
    return `${stars}`;
  }
}

// CLI 执行
if (require.main === module) {
  (async () => {
    const generator = new DomainWikiGenerator();
    try {
      const paths = await generator.generateAll();
      console.log(`\n✅ 已生成 ${paths.length} 个领域 Wiki 页面`);
    } catch (error) {
      console.error(`❌ 生成失败：${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = DomainWikiGenerator;
