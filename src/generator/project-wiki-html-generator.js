#!/usr/bin/env node
/**
 * 项目 Wiki 详情页面生成器
 * 将项目 Wiki Markdown 转换为 HTML 详情页
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class ProjectWikiHtmlGenerator {
  constructor(options = {}) {
    this.wikiDir = options.wikiDir || path.join(process.cwd(), 'wiki', 'projects');
    this.outputDir = options.outputDir || path.join(process.cwd(), 'reports', 'projects');
  }

  /**
   * 生成所有项目 Wiki 的 HTML 详情页
   * @returns {Promise<string[]>} 生成的文件路径列表
   */
  async generateAll() {
    logger.info('[ProjectWikiHtmlGenerator] 开始生成项目 Wiki 详情页...');

    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const files = fs.readdirSync(this.wikiDir).filter(f => f.endsWith('.md'));
    const generatedPaths = [];

    for (const file of files) {
      const wikiPath = path.join(this.wikiDir, file);
      const content = fs.readFileSync(wikiPath, 'utf-8');
      const html = this.renderHTML(file, content);

      const outputFileName = file.replace('.md', '.html');
      const outputPath = path.join(this.outputDir, outputFileName);
      fs.writeFileSync(outputPath, html, 'utf-8');
      generatedPaths.push(outputPath);

      logger.debug(`  已生成：${outputFileName}`);
    }

    logger.success(`[ProjectWikiHtmlGenerator] 完成：${generatedPaths.length} 个项目 Wiki 已生成`);
    return generatedPaths;
  }

  /**
   * 解析 Wiki Markdown 内容
   * @param {string} content - Markdown 内容
   * @returns {Object} 解析后的数据
   */
  parseWikiContent(content) {
    const data = {
      title: '',
      firstSeen: '',
      lastSeen: '',
      appearances: 0,
      domain: '',
      language: '',
      stars: '',
      coreFunctions: [],
      versionHistory: []
    };

    // 提取标题
    const titleMatch = content.match(/^# (.+)$/m);
    if (titleMatch) data.title = titleMatch[1].trim();

    // 提取基本信息
    data.firstSeen = this.extractField(content, '首次上榜');
    data.lastSeen = this.extractField(content, '最近上榜');
    data.appearances = parseInt(this.extractField(content, '上榜次数')) || 0;
    data.domain = this.extractField(content, '领域分类');
    data.language = this.extractField(content, '语言');
    data.stars = this.extractField(content, 'GitHub Stars');

    // 提取核心功能
    const coreFuncMatch = content.match(/## 核心功能\s*\n([\s\S]*?)(?=## |$)/);
    if (coreFuncMatch) {
      const lines = coreFuncMatch[1].split('\n').filter(l => l.trim());
      data.coreFunctions = lines.map(l => l.replace(/^- /, ''));
    }

    // 提取版本历史
    const versionMatch = content.match(/## 版本历史\s*\n([\s\S]*?)(?=## |$)/);
    if (versionMatch) {
      const entries = versionMatch[1].split(/\n(?=### )/).filter(e => e.trim());
      data.versionHistory = entries.map(entry => {
        const dateMatch = entry.match(/### (\d{4}-\d{2}-\d{2})/);
        const sourceMatch = entry.match(/\*\*来源\*\*: \[([^\]]+)\]/);
        const analysisMatch = entry.match(/\*\*分析\*\*: (.+)/);
        return {
          date: dateMatch ? dateMatch[1] : '',
          source: sourceMatch ? sourceMatch[1] : '',
          analysis: analysisMatch ? analysisMatch[1].trim() : ''
        };
      });
    }

    return data;
  }

  /**
   * 提取字段值
   */
  extractField(content, fieldName) {
    const regex = new RegExp(`- ${fieldName}：(.+)\\n`);
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * 渲染 HTML
   */
  renderHTML(fileName, content) {
    const data = this.parseWikiContent(content);
    const [owner, repo] = fileName.replace('.md', '').split('_');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title || `${owner}/${repo}`} - AI Project Wiki</title>
  <link rel="stylesheet" href="../../public/css/wiki-project.css">
</head>
<body>
  <header>
    <a href="../wiki-index.html" class="back-link">← 返回 Wiki 索引</a>
    <h1>${owner}/${repo}</h1>
    ${data.stars ? `<p class="stars">⭐ ${data.stars} Stars</p>` : ''}
  </header>

  <main>
    <section class="info-section">
      <h2>📊 基本信息</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">首次上榜</span>
          <span class="value">${data.firstSeen || '-'}</span>
        </div>
        <div class="info-item">
          <span class="label">最近上榜</span>
          <span class="value">${data.lastSeen || '-'}</span>
        </div>
        <div class="info-item">
          <span class="label">上榜次数</span>
          <span class="value">${data.appearances}</span>
        </div>
        <div class="info-item">
          <span class="label">领域分类</span>
          <span class="value">${this.getDomainIcon(data.domain)} ${data.domain || '-'}</span>
        </div>
        <div class="info-item">
          <span class="label">编程语言</span>
          <span class="value">${data.language || '-'}</span>
        </div>
      </div>
    </section>

    ${data.coreFunctions.length > 0 ? `
    <section class="core-functions">
      <h2>🎯 核心功能</h2>
      <ul>
        ${data.coreFunctions.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </section>
    ` : ''}

    ${data.versionHistory.length > 0 ? `
    <section class="version-history">
      <h2>📜 版本历史</h2>
      <div class="timeline">
        ${data.versionHistory.map(v => `
          <div class="timeline-item">
            <div class="timeline-date">${v.date}</div>
            <div class="timeline-content">
              ${v.analysis ? `<p class="analysis">${v.analysis}</p>` : ''}
              ${v.source ? `<p class="source"><a href="../../${v.source.replace('../../', '')}">${v.source}</a></p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </section>
    ` : ''}

    <section class="links-section">
      <h2>🔗 外部链接</h2>
      <a href="https://github.com/${owner}/${repo}" target="_blank" class="github-link">
        <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        在 GitHub 上查看
      </a>
    </section>
  </main>

  <footer>
    <p>Generated by LLM Wiki Integration</p>
  </footer>
</body>
</html>`;
  }

  /**
   * 获取领域图标
   */
  getDomainIcon(domain) {
    const icons = {
      agent: '🤖',
      rag: '🔍',
      llm: '🧠',
      speech: '🎤',
      vision: '👁️',
      'dev-tool': '🛠️',
      security: '🔒',
      database: '💾',
      other: '📦'
    };
    return icons[domain?.toLowerCase()] || '📦';
  }
}

// CLI 执行
if (require.main === module) {
  (async () => {
    const generator = new ProjectWikiHtmlGenerator();
    try {
      const paths = await generator.generateAll();
      console.log(`\n✅ 已生成 ${paths.length} 个项目 Wiki 详情页`);
    } catch (error) {
      console.error(`❌ 生成失败：${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = ProjectWikiHtmlGenerator;
