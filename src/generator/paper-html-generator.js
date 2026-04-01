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

    const html = this.renderHTML(data);
    const filePath = getPaperReportPath(date);

    await writeHtml(filePath, html);

    logger.success('[PaperHtmlGenerator] HTML 报告已生成', { path: filePath });
    return filePath;
  }

  /**
   * 渲染 HTML
   * @param {Object} data - 论文数据
   * @returns {string} HTML 字符串
   */
  renderHTML(data) {
    const { date, papers, aiInsights } = data;

    // 统计信息
    const totalCount = papers.length;
    const totalStars = papers.reduce((sum, p) => sum + (p.stars || 0), 0);
    const avgStars = totalCount > 0 ? Math.round(totalStars / totalCount) : 0;

    // 语言分布
    const langDist = aiInsights?.languageDistribution || {};
    const langDistHtml = this.renderLanguageDistribution(langDist);

    // AI 洞察
    const aiInsightsHtml = this.renderAiInsights(aiInsights);

    // 论文列表（全量）
    const papersHtml = papers.map(p => this.renderPaperCard(p)).join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HuggingFace AI Papers 日报 - ${date}</title>
  <link rel="stylesheet" href="../../../public/css/style.css">
  <style>
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; }
    .stat-card { background: white; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .stat-value { font-size: 36px; font-weight: bold; color: #667eea; }
    .stat-label { color: #666; margin-top: 5px; }
    .paper-card { background: white; border-radius: 12px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .paper-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
    .paper-meta { color: #666; font-size: 14px; margin-bottom: 10px; }
    .paper-abstract { color: #333; line-height: 1.6; margin: 10px 0; }
    .paper-links { margin-top: 10px; }
    .paper-links a { color: #667eea; margin-right: 15px; }
    .ai-section { background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 30px 0; }
    .lang-dist { display: flex; flex-wrap: wrap; gap: 10px; }
    .lang-item { background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px; }
    hr { border: none; border-top: 1px solid #eee; margin: 30px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HuggingFace AI Papers 日报</h1>
      <p style="font-size: 20px; margin-top: 10px;">${date}</p>
    </div>

    ${this.renderStatsSection(totalCount, totalStars, avgStars)}

    ${langDistHtml}

    ${aiInsightsHtml}

    <h2>论文列表（共 ${totalCount} 篇）</h2>
    ${papersHtml}
  </div>
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
        <h2>AI 洞察</h2>

        ${aiInsights.oneLiner ? `
          <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <strong>今日观察</strong>
            <p style="margin: 5px 0 0 0;">${aiInsights.oneLiner}</p>
          </div>
        ` : ''}

        ${aiInsights.technicalInsights && aiInsights.technicalInsights.length > 0 ? `
          <h3>技术亮点</h3>
          <ul>
            ${aiInsights.technicalInsights.map(insight => `
              <li>
                <strong>${insight.paper}</strong>:
                <p style="margin: 5px 0 0 0;">${insight.innovation}</p>
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
  renderPaperCard(paper) {
    const githubLinks = paper.details?.github_links || [];
    const arxivUrl = paper.details?.arxiv_page_url || paper.paper_url;
    const pdfUrl = paper.details?.pdf_url || '';

    // 翻译摘要（如果有）
    const abstract = paper.details?.abstract || '';
    const abstractZh = paper.details?.abstract_zh || this.translateAbstract(abstract);

    return `
      <div class="paper-card">
        <div class="paper-title">🌟 ${paper.stars} ${paper.title}</div>
        <div class="paper-meta">
          ${paper.authors?.length ? `作者：${paper.authors.join(', ')} | ` : ''}
          HuggingFace: <a href="${paper.paper_url}" target="_blank">链接</a> |
          arXiv: <a href="${arxivUrl}" target="_blank">链接</a> ${
            pdfUrl ? `| PDF: <a href="${pdfUrl}" target="_blank">下载</a>` : ''
          }
        </div>
        ${githubLinks.length > 0 ? `
          <div class="paper-meta">
            GitHub: ${githubLinks.map(url => `<a href="${url}" target="_blank">${url.split('github.com/')[1] || 'code'}</a>`).join(', ')}
          </div>
        ` : ''}
        <div class="paper-abstract"><strong>摘要：</strong>${abstractZh}</div>
      </div>
    `;
  }

  /**
   * 翻译摘要（简单占位，实际使用翻译 API）
   */
  translateAbstract(text) {
    if (!text) return '暂无摘要';

    // TODO: 使用现有的翻译 API
    // const { translateDescription } = require('../scraper/project-analyzer');
    // return await translateDescription(text);

    // 暂时返回原文
    return text;
  }
}

module.exports = PaperHtmlGenerator;
