const { writeHtml } = require('../utils/fs');
const { getPaperReportPath } = require('../utils/path');
const logger = require('../utils/logger');

class PaperHtmlGenerator {
  constructor() {
    this.name = 'PaperHtmlGenerator';
  }

  /**
   * 生成日报 HTML
   * @param {Object} data - 论文数据
   * @returns {Promise<string>} HTML 文件路径
   */
  async generate(data) {
    const { date, papers, aiInsights } = data;

    logger.info('[PaperHtmlGenerator] 开始生成 HTML 报告...', { date });

    const html = await this.renderHTML(data);
    const filePath = getPaperReportPath(date);

    await writeHtml(filePath, html);

    logger.success('[PaperHtmlGenerator] HTML 报告已生成', { path: filePath });
    return filePath;
  }

  /**
   * 渲染 HTML
   * @param {Object} data - 论文数据
   * @returns {Promise<string>} HTML 字符串
   */
  async renderHTML(data) {
    const { date, papers, aiInsights } = data;

    // 按星数排序（有星数的在前，无星数的在后）
    const sortedPapers = [...papers].sort((a, b) => {
      const starsA = a.stars || 0;
      const starsB = b.stars || 0;
      if (starsA === 0 && starsB === 0) return 0;
      if (starsA === 0) return 1;
      if (starsB === 0) return -1;
      return starsB - starsA;
    });

    // 翻译摘要
    for (const paper of sortedPapers) {
      if (paper.details?.abstract && !paper.details.abstract_zh) {
        paper.details.abstract_zh = await this.translateAbstract(paper.details.abstract);
      }
    }

    // 统计信息
    const totalCount = papers.length;
    const totalStars = papers.reduce((sum, p) => sum + (p.stars || 0), 0);
    const avgStars = totalCount > 0 ? Math.round(totalStars / totalCount) : 0;
    const papersWithStars = papers.filter(p => p.stars > 0).length;

    // 语言分布
    const langDist = aiInsights?.languageDistribution || {};
    const langDistHtml = this.renderLanguageDistribution(langDist);

    // AI 洞察
    const aiInsightsHtml = this.renderAiInsights(aiInsights);

    // 论文列表（已排序）
    const papersHtml = sortedPapers.map((p, index) => this.renderPaperCard(p, index)).join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HuggingFace AI Papers 日报 - ${date}</title>
  <link rel="stylesheet" href="../../public/css/style.css">
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-card: #161b22;
      --text-primary: #c9d1d9;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --accent: #58a6ff;
      --accent-green: #3fb950;
      --accent-orange: #d29922;
      --border: #30363d;
      --border-light: #21262d;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif; background: var(--bg-primary); color: var(--text-primary); line-height: 1.5; padding: 24px 16px; font-size: 13px; }
    .container { max-width: 960px; margin: 0 auto; }
    header { text-align: center; padding: 32px 0 24px; border-bottom: 1px solid var(--border); margin-bottom: 32px; }
    h1 { font-size: 1.5rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
    .date { color: var(--text-secondary); font-size: 0.8125rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 24px; }
    .stat-card { background: var(--bg-card); padding: 12px; border-radius: 6px; border: 1px solid var(--border); text-align: center; }
    .stat-value { font-size: 1.25rem; font-weight: 600; color: var(--accent-green); line-height: 1.2; }
    .stat-value .star-icon { color: #fbbf24; width: 20px; height: 20px; vertical-align: middle; display: inline-block; }
    .stat-label { color: var(--text-secondary); margin-top: 4px; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.04em; }
    section { margin-bottom: 24px; }
    h2 { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
    .project-list { display: flex; flex-direction: column; gap: 8px; }
    .star-icon { width: 16px; height: 16px; vertical-align: middle; }
    .paper-card { background: var(--bg-card); border-radius: 6px; padding: 12px; margin: 8px 0; border: 1px solid var(--border); transition: border-color 0.2s; }
    .paper-card:hover { border-color: var(--text-muted); }
    .paper-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 12px; }
    .paper-name { font-size: 0.875rem; font-weight: 600; color: var(--accent); text-decoration: none; line-height: 1.4; }
    .paper-name:hover { text-decoration: underline; }
    .paper-stats { display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
    .stat-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.6875rem; color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 6px; border-radius: 10px; border: 1px solid var(--border); white-space: nowrap; }
    .stat-badge .star-icon { color: #fbbf24; width: 12px; height: 12px; }
    .paper-abstract { background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin: 8px 0; border: 1px solid var(--border); }
    .paper-abstract strong { color: var(--text-primary); }
    .paper-meta { color: var(--text-secondary); font-size: 0.75rem; margin: 8px 0; }
    .paper-meta a { color: var(--accent); text-decoration: none; }
    .paper-meta a:hover { text-decoration: underline; }
    .toggle-btn { background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-secondary); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.6875rem; font-weight: 500; transition: all 0.2s; }
    .toggle-btn:hover { border-color: var(--text-muted); color: var(--text-primary); }
    .paper-details { display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
    .paper-details.active { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .detail-column { background: var(--bg-secondary); padding: 8px; border-radius: 6px; }
    .detail-column h4 { color: var(--text-primary); margin-bottom: 6px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; }
    .detail-column ul { list-style: none; }
    .detail-column li { color: var(--text-secondary); padding: 3px 0; font-size: 0.75rem; line-height: 1.4; }
    .ai-section { background: var(--bg-card); padding: 16px; border-radius: 6px; border: 1px solid var(--border); }
    .ai-section h2, .ai-section h3 { color: var(--text-primary); margin: 16px 0 8px; font-size: 0.75rem; font-weight: 600; }
    .ai-section h2:first-child, .ai-section h3:first-child { margin-top: 0; }
    .ai-section p { color: var(--text-secondary); margin-bottom: 12px; line-height: 1.6; font-size: 0.8125rem; }
    .ai-section ul { margin-bottom: 12px; padding-left: 16px; }
    .ai-section li { color: var(--text-secondary); margin-bottom: 4px; font-size: 0.8125rem; line-height: 1.5; }
    .lang-dist { display: flex; flex-wrap: wrap; gap: 10px; }
    .lang-item { background: var(--accent); color: var(--bg-primary); padding: 5px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
    @media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .paper-details.active { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>HuggingFace AI Papers 日报</h1>
      <div class="date">${date}</div>
    </header>

    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${totalCount}</div>
        <div class="stat-label">论文总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${papersWithStars}</div>
        <div class="stat-label">有 Stars 论文</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">
          <svg class="star-icon" viewBox="0 0 16 16" fill="currentColor" style="width: 20px; height: 20px;"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
          <span style="vertical-align: middle;">${totalStars.toLocaleString()}</span>
        </div>
        <div class="stat-label">总 Stars</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${avgStars}</div>
        <div class="stat-label">平均 Stars</div>
      </div>
    </section>

    ${langDistHtml}

    ${aiInsightsHtml}

    <section>
      <h2>论文列表（共 ${totalCount} 篇）</h2>
      <div class="project-list">
        ${papersHtml}
      </div>
    </section>
  </div>

  <script>
    function toggleDetails(paperId) {
      const details = document.getElementById('details-' + paperId);
      const btn = document.getElementById('btn-' + paperId);
      if (details && btn) {
        details.classList.toggle('active');
        btn.textContent = details.classList.contains('active') ? '收起详情' : '查看详情';
      }
    }
  </script>
</body>
</html>`;
  }

  /**
   * 渲染统计信息
   */
  renderStatsSection(totalCount, totalStars, avgStars) {
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalCount}</div>
          <div class="stat-label">论文总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalStars.toLocaleString()}</div>
          <div class="stat-label">总 Stars</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgStars}</div>
          <div class="stat-label">平均 Stars</div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染语言分布
   */
  renderLanguageDistribution(dist) {
    const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return '';

    const items = entries.slice(0, 10).map(([lang, count]) =>
      `<span class="lang-item">${lang}(${count})</span>`
    ).join('');

    return `
      <section class="ai-section">
        <h3>语言分布</h3>
        <div class="lang-dist">${items}</div>
      </section>
    `;
  }

  /**
   * 渲染 AI 洞察
   */
  renderAiInsights(aiInsights) {
    if (!aiInsights) return '';

    return `
      <section class="ai-section">
        <h2>AI 深度洞察</h2>
        <p>${aiInsights.oneLiner || ''}</p>

        ${aiInsights.technicalInsights && aiInsights.technicalInsights.length > 0 ? `
          <h3>技术亮点</h3>
          <ul>
            ${aiInsights.technicalInsights.map(insight => `
              <li>
                <strong>${insight.paper}</strong>: ${insight.innovation}
              </li>
            `).join('')}
          </ul>
        ` : ''}

        ${aiInsights.communityValue && aiInsights.communityValue.length > 0 ? `
          <h3>社区价值</h3>
          <ul>
            ${aiInsights.communityValue.map(v => `<li>${v}</li>`).join('')}
          </ul>
        ` : ''}

        ${aiInsights.applicationOutlook && aiInsights.applicationOutlook.length > 0 ? `
          <h3>应用前景</h3>
          <ul>
            ${aiInsights.applicationOutlook.map(v => `<li>${v}</li>`).join('')}
          </ul>
        ` : ''}
      </section>
    `;
  }

  /**
   * 渲染论文卡片
   */
  renderPaperCard(paper, index) {
    const githubLinks = paper.details?.github_links || [];
    const arxivUrl = paper.details?.arxiv_page_url || paper.paper_url;
    const pdfUrl = paper.details?.pdf_url || '';
    const abstract = paper.details?.abstract || '';
    const abstractZh = paper.details?.abstract_zh || abstract;

    // 提取 repo 名称
    let repoName = 'N/A';
    if (githubLinks.length > 0) {
      const match = githubLinks[0].match(/github\.com\/([^/]+\/[^/]+)/);
      if (match) repoName = match[1];
    }

    return `
      <div class="paper-card">
        <div class="paper-header">
          <a href="${paper.paper_url}" class="paper-name" target="_blank">
            ${index + 1}. ${paper.title}
          </a>
          <div class="paper-stats">
            <span class="stat-badge" title="Stars">
              <svg class="star-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
              ${paper.stars || 0}
            </span>
            ${githubLinks.length > 0 ? `<span class="stat-badge" title="GitHub">${repoName}</span>` : ''}
          </div>
        </div>

        ${paper.authors?.length ? `<div class="paper-meta">作者：${paper.authors.join(', ')}</div>` : ''}

        <div class="paper-meta">
          HuggingFace: <a href="${paper.paper_url}" target="_blank">链接</a> |
          arXiv: <a href="${arxivUrl}" target="_blank">链接</a>
          ${pdfUrl ? `| PDF: <a href="${pdfUrl}" target="_blank">下载</a>` : ''}
          ${githubLinks.length > 0 ? `| GitHub: ${githubLinks.map(url => `<a href="${url}" target="_blank">${url.split('github.com/')[1] || 'code'}</a>`).join(', ')}` : ''}
        </div>

        ${abstractZh ? `
          <div class="paper-abstract">
            <strong>摘要：</strong>${abstractZh}
          </div>
        ` : ''}

        <button class="toggle-btn" onclick="toggleDetails(${index})" id="btn-${index}">
          查看详情
        </button>
        <div class="paper-details" id="details-${index}">
          <div class="detail-column">
            <h4>论文信息</h4>
            <ul>
              <li>标题：${paper.title}</li>
              <li>Stars: ${paper.stars || 0}</li>
              ${paper.authors?.length ? `<li>作者：${paper.authors.join(', ')}</li>` : ''}
              <li>HuggingFace: <a href="${paper.paper_url}" target="_blank">${paper.paper_url}</a></li>
              ${arxivUrl ? `<li>arXiv: <a href="${arxivUrl}" target="_blank">${arxivUrl}</a></li>` : ''}
            </ul>
          </div>
          ${abstractZh ? `
            <div class="detail-column">
              <h4>摘要</h4>
              <p>${abstractZh}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 翻译摘要
   */
  async translateAbstract(text) {
    if (!text) return '暂无摘要';

    // 检查是否包含中文
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return text;
    }

    try {
      const cleanText = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      // 截断到 450 字符（API 限制 500）
      const truncatedText = cleanText.length > 450 ? cleanText.substring(0, 450) + '...' : cleanText;

      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(truncatedText)}&langpair=en|zh-CN`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return data.responseData.translatedText;
      } else {
        throw new Error(data.responseDetails || 'Translation failed');
      }
    } catch (error) {
      logger.warn('[PaperHtmlGenerator] 翻译失败，返回原文: ' + error.message);
      return text;
    }
  }
}

module.exports = PaperHtmlGenerator;
