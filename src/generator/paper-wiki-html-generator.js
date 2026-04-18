#!/usr/bin/env node
/**
 * 论文 Wiki 详情页面生成器
 * 将论文 Wiki Markdown 转换为 HTML 详情页
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class PaperWikiHtmlGenerator {
  constructor(options = {}) {
    this.wikiDir = options.wikiDir || path.join(process.cwd(), 'wiki', 'papers');
    this.outputDir = options.outputDir || path.join(process.cwd(), 'reports', 'papers');
  }

  /**
   * 生成所有论文 Wiki 的 HTML 详情页
   * @returns {Promise<string[]>} 生成的文件路径列表
   */
  async generateAll() {
    logger.info('[PaperWikiHtmlGenerator] 开始生成论文 Wiki 详情页...');

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

    logger.success(`[PaperWikiHtmlGenerator] 完成：${generatedPaths.length} 个论文 Wiki 已生成`);
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
      arxivId: '',
      publishDate: '',
      firstRecorded: '',
      paperType: '',
      domain: '',
      authors: [],
      contributions: [],
      githubLinks: [],
      analysis: '',
      bibtex: ''
    };

    // 提取标题
    const titleMatch = content.match(/^# (.+)$/m);
    if (titleMatch) data.title = titleMatch[1].trim();

    // 提取基本信息
    data.arxivId = this.extractField(content, 'arXiv ID');
    data.publishDate = this.extractField(content, '发布日期');
    data.firstRecorded = this.extractField(content, '首次收录');
    data.paperType = this.extractField(content, '论文类型');
    data.domain = this.extractField(content, '领域分类');

    // 提取作者
    const authorsMatch = content.match(/## 作者与机构\s*\n([\s\S]*?)(?=## |$)/);
    if (authorsMatch) {
      const authorsText = authorsMatch[1].trim();
      if (authorsText && authorsText !== 'Unknown') {
        data.authors = authorsText.split(',').map(a => a.trim()).filter(a => a);
      }
    }

    // 提取核心贡献
    const contribMatch = content.match(/## 核心贡献\s*\n([\s\S]*?)(?=## |$)/);
    if (contribMatch) {
      const lines = contribMatch[1].split('\n').filter(l => l.trim());
      data.contributions = lines.map(l => l.replace(/^- /, '')).filter(l => l);
    }

    // 提取 GitHub 链接
    const githubMatch = content.match(/## GitHub 实现\s*\n([\s\S]*?)(?=## |$)/);
    if (githubMatch) {
      const lines = githubMatch[1].split('\n').filter(l => l.trim());
      data.githubLinks = lines.map(l => l.trim()).filter(l => l.startsWith('http'));
    }

    // 提取收录分析
    const analysisMatch = content.match(/## 收录分析\s*\n([\s\S]*?)(?=## |$)/);
    if (analysisMatch) {
      data.analysis = analysisMatch[1].trim();
    }

    // 提取 BibTeX
    const bibtexMatch = content.match(/```bibtex\s*([\s\S]*?)\s*```/);
    if (bibtexMatch) {
      data.bibtex = bibtexMatch[1].trim();
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
    const arxivId = data.arxivId || fileName.replace('.md', '');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title || arxivId} - AI Project Wiki</title>
  <link rel="stylesheet" href="../../public/css/wiki-paper.css">
</head>
<body>
  <header>
    <a href="../wiki-index.html" class="back-link">← 返回 Wiki 索引</a>
    <h1>${data.title || 'Untitled'}</h1>
    <p class="arxiv-id">arXiv:${arxivId}</p>
  </header>

  <main>
    <section class="info-section">
      <h2>📊 基本信息</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">arXiv ID</span>
          <span class="value">${arxivId}</span>
        </div>
        <div class="info-item">
          <span class="label">发布日期</span>
          <span class="value">${data.publishDate || '-'}</span>
        </div>
        <div class="info-item">
          <span class="label">首次收录</span>
          <span class="value">${data.firstRecorded || '-'}</span>
        </div>
        <div class="info-item">
          <span class="label">论文类型</span>
          <span class="value">${this.getTypeIcon(data.paperType)} ${data.paperType || '-'}</span>
        </div>
        <div class="info-item">
          <span class="label">领域分类</span>
          <span class="value">${this.getDomainIcon(data.domain)} ${data.domain || '-'}</span>
        </div>
      </div>
    </section>

    ${data.authors.length > 0 ? `
    <section class="authors-section">
      <h2>👥 作者与机构</h2>
      <p>${data.authors.join(', ')}</p>
    </section>
    ` : ''}

    ${data.contributions.length > 0 ? `
    <section class="contributions-section">
      <h2>🎯 核心贡献</h2>
      <ul>
        ${data.contributions.map(c => `<li>${c}</li>`).join('')}
      </ul>
    </section>
    ` : ''}

    ${data.githubLinks.length > 0 ? `
    <section class="github-section">
      <h2>🔗 GitHub 实现</h2>
      ${data.githubLinks.map(link => `
        <a href="${link}" target="_blank" class="github-link">
          <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          ${link}
        </a>
      `).join('')}
    </section>
    ` : ''}

    ${data.analysis ? `
    <section class="analysis-section">
      <h2>📝 收录分析</h2>
      <p>${data.analysis}</p>
    </section>
    ` : ''}

    ${data.bibtex ? `
    <section class="bibtex-section">
      <h2>📚 BibTeX 引用</h2>
      <pre class="bibtex-block">${this.escapeHtml(data.bibtex)}</pre>
    </section>
    ` : ''}

    <section class="links-section">
      <h2>🔗 外部链接</h2>
      <div class="link-buttons">
        <a href="https://arxiv.org/abs/${arxivId}" target="_blank" class="link-btn arxiv">
          arXiv 页面
        </a>
        <a href="https://arxiv.org/pdf/${arxivId}" target="_blank" class="link-btn pdf">
          PDF 下载
        </a>
        ${data.githubLinks.length > 0 ? `
          <a href="${data.githubLinks[0]}" target="_blank" class="link-btn github">
            GitHub 仓库
          </a>
        ` : ''}
        <a href="https://huggingface.co/papers/${arxivId}" target="_blank" class="link-btn hf">
          HuggingFace Papers
        </a>
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
   * 获取类型图标
   */
  getTypeIcon(type) {
    const icons = {
      Survey: '📖',
      Benchmark: '📊',
      Dataset: '💾',
      Tool: '🛠️',
      Research: '🔬'
    };
    return icons[type] || '📄';
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

  /**
   * HTML 转义
   */
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// CLI 执行
if (require.main === module) {
  (async () => {
    const generator = new PaperWikiHtmlGenerator();
    try {
      const paths = await generator.generateAll();
      console.log(`\n✅ 已生成 ${paths.length} 个论文 Wiki 详情页`);
    } catch (error) {
      console.error(`❌ 生成失败：${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = PaperWikiHtmlGenerator;
