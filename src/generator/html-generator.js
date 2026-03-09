const { writeHtml } = require('../utils/fs');
const { getDailyReportPath, getWeeklyReportPath, getMonthlyReportPath } = require('../utils/path');
const { renderTemplate, markdownToHtml } = require('../utils/template');
const logger = require('../utils/logger');

/**
 * HTML 生成器 - 负责生成报告 HTML
 */
class HTMLGenerator {
  /**
   * 生成日报 HTML
   * @param {Object} dailyData - 日报数据
   * @returns {Promise<string>} 生成的 HTML 文件路径
   */
  async generateDaily(dailyData) {
    try {
      logger.info('生成日报 HTML...', { date: dailyData.date });

      const html = this.renderDailyHTML(dailyData);
      const filePath = getDailyReportPath(dailyData.date);
      
      await writeHtml(filePath, html);
      
      logger.success(`日报 HTML 已生成：${filePath}`);
      return filePath;
    } catch (error) {
      logger.error(`生成日报 HTML 失败：${error.message}`, { date: dailyData.date });
      throw error;
    }
  }

  /**
   * 生成周报 HTML
   * @param {Object} weeklyData - 周报数据
   * @returns {Promise<string>} 生成的 HTML 文件路径
   */
  async generateWeekly(weeklyData) {
    try {
      logger.info('生成周报 HTML...', { weekStart: weeklyData.weekStart });

      const html = this.renderWeeklyHTML(weeklyData);
      const filePath = getWeeklyReportPath(weeklyData.weekStart);
      
      await writeHtml(filePath, html);
      
      logger.success(`周报 HTML 已生成：${filePath}`);
      return filePath;
    } catch (error) {
      logger.error(`生成周报 HTML 失败：${error.message}`, { weekStart: weeklyData.weekStart });
      throw error;
    }
  }

  /**
   * 生成月报 HTML
   * @param {Object} monthlyData - 月报数据
   * @returns {Promise<string>} 生成的 HTML 文件路径
   */
  async generateMonthly(monthlyData) {
    try {
      logger.info('生成月报 HTML...', { month: monthlyData.month });

      const html = this.renderMonthlyHTML(monthlyData);
      const filePath = getMonthlyReportPath(monthlyData.month);
      
      await writeHtml(filePath, html);
      
      logger.success(`月报 HTML 已生成：${filePath}`);
      return filePath;
    } catch (error) {
      logger.error(`生成月报 HTML 失败：${error.message}`, { month: monthlyData.month });
      throw error;
    }
  }

  /**
   * 渲染日报 HTML
   * @param {Object} data - 日报数据
   * @returns {string} HTML 字符串
   */
  renderDailyHTML(data) {
    const { brief, aiInsights, date } = data;
    const trendingRepos = brief.trending_repos || [];
    const stats = brief.stats || {};

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub AI Trending 日报 - ${date}</title>
  <style>
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #111111;
      --bg-card: #1a1a1a;
      --text-primary: #e0e0e0;
      --text-secondary: #a0a0a0;
      --accent: #00ff41;
      --accent-dim: #00cc33;
      --border: #333333;
      --success: #00ff41;
      --warning: #ffaa00;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      padding: 40px 0;
      border-bottom: 2px solid var(--accent);
      margin-bottom: 40px;
    }
    
    h1 {
      font-size: 2.5rem;
      color: var(--accent);
      margin-bottom: 10px;
    }
    
    .date {
      color: var(--text-secondary);
      font-size: 1.1rem;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .stat-card {
      background: var(--bg-card);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid var(--border);
      text-align: center;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: var(--accent);
    }
    
    .stat-label {
      color: var(--text-secondary);
      margin-top: 5px;
    }
    
    section {
      margin-bottom: 40px;
    }
    
    h2 {
      font-size: 1.8rem;
      color: var(--accent);
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }
    
    .project-list {
      display: grid;
      gap: 15px;
    }
    
    .project-card {
      background: var(--bg-card);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid var(--border);
      transition: transform 0.2s;
    }
    
    .project-card:hover {
      transform: translateX(5px);
      border-color: var(--accent);
    }
    
    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .project-name {
      font-size: 1.3rem;
      color: var(--accent);
      text-decoration: none;
    }
    
    .project-name:hover {
      text-decoration: underline;
    }
    
    .project-stats {
      display: flex;
      gap: 15px;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    
    .project-description {
      color: var(--text-primary);
      margin-bottom: 15px;
    }
    
    .project-details {
      display: none;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid var(--border);
    }
    
    .project-details.active {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    
    .detail-column {
      background: var(--bg-secondary);
      padding: 15px;
      border-radius: 6px;
    }
    
    .detail-column h4 {
      color: var(--accent);
      margin-bottom: 10px;
      font-size: 1rem;
    }
    
    .detail-column ul {
      list-style: none;
    }
    
    .detail-column li {
      color: var(--text-secondary);
      padding: 5px 0;
      font-size: 0.9rem;
    }
    
    .toggle-btn {
      background: transparent;
      border: 1px solid var(--accent);
      color: var(--accent);
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }
    
    .toggle-btn:hover {
      background: var(--accent);
      color: var(--bg-primary);
    }
    
    .ai-insights {
      background: var(--bg-card);
      padding: 30px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    
    .ai-insights h3 {
      color: var(--accent);
      margin-bottom: 15px;
      font-size: 1.3rem;
    }
    
    .ai-insights p {
      color: var(--text-primary);
      margin-bottom: 20px;
      line-height: 1.8;
    }
    
    .project-link {
      color: var(--accent);
      text-decoration: none;
    }
    
    .project-link:hover {
      text-decoration: underline;
    }
    
    @media (max-width: 768px) {
      .project-details.active {
        grid-template-columns: 1fr;
      }
      
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      h1 {
        font-size: 1.8rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 GitHub AI Trending 日报</h1>
      <div class="date">${date}</div>
    </header>

    ${this.renderStatsSection(stats)}
    ${this.renderAIInsightsSection(aiInsights)}
    ${this.renderProjectListSection(trendingRepos)}
  </div>

  <script>
    function toggleDetails(projectId) {
      const details = document.getElementById('details-' + projectId);
      const btn = document.getElementById('btn-' + projectId);
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
   * 渲染统计部分
   */
  renderStatsSection(stats) {
    const statItems = [
      { label: '上榜项目', value: stats.total_projects || 0 },
      { label: 'AI 项目', value: stats.ai_projects || 0 },
      { label: '平均 Stars', value: stats.avg_stars || 0 },
      { label: '高热项目', value: stats.hot_projects || 0 }
    ];

    return `
      <section class="stats-grid">
        ${statItems.map(stat => `
          <div class="stat-card">
            <div class="stat-value">${stat.value}</div>
            <div class="stat-label">${stat.label}</div>
          </div>
        `).join('')}
      </section>
    `;
  }

  /**
   * 渲染项目列表
   */
  renderProjectListSection(projects) {
    if (!projects || projects.length === 0) {
      return '<section><h2>📊 项目榜单</h2><p>暂无数据</p></section>';
    }

    return `
      <section>
        <h2>📊 项目榜单</h2>
        <div class="project-list">
          ${projects.map((project, index) => `
            <div class="project-card">
              <div class="project-header">
                <a href="${project.url || '#'}" class="project-name" target="_blank">
                  ${index + 1}. ${project.name}
                </a>
                <div class="project-stats">
                  <span>⭐ ${project.stars || 0}</span>
                  <span>🍴 ${project.forks || 0}</span>
                  ${project.language ? `<span>📝 ${project.language}</span>` : ''}
                </div>
              </div>
              <div class="project-description">${project.description || '暂无描述'}</div>
              <button class="toggle-btn" onclick="toggleDetails(${index})" id="btn-${index}">
                查看详情
              </button>
              <div class="project-details" id="details-${index}">
                <div class="detail-column">
                  <h4>核心功能</h4>
                  <ul>
                    ${this.renderDetailItems(project.core_features)}
                  </ul>
                </div>
                <div class="detail-column">
                  <h4>适用场景</h4>
                  <ul>
                    ${this.renderDetailItems(project.use_cases)}
                  </ul>
                </div>
                <div class="detail-column">
                  <h4>热度趋势</h4>
                  <ul>
                    ${this.renderDetailItems(project.trend_data)}
                  </ul>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  /**
   * 渲染详情项
   */
  renderDetailItems(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return '<li>暂无数据</li>';
    }
    return items.map(item => `<li>${item}</li>`).join('');
  }

  /**
   * 渲染 AI 洞察部分
   */
  renderAIInsightsSection(aiInsights) {
    if (!aiInsights) {
      return '<section><h2>🤖 AI 深度洞察</h2><p>AI 分析尚未完成</p></section>';
    }

    // 支持两种格式：新格式（summary/project_insights）和旧格式（oneLiner/hot/action）
    const summary = aiInsights.summary || aiInsights.oneLiner;
    const projectInsights = aiInsights.project_insights || [];
    const trends = aiInsights.trends || aiInsights.shortTerm || aiInsights.longTerm || [];
    const recommendations = aiInsights.recommendations || aiInsights.action || [];
    const hot = aiInsights.hot || [];
    const hypeIndex = aiInsights.hypeIndex;

    return `
      <section class="ai-insights">
        <h2>🤖 AI 深度洞察</h2>
        ${summary ? `<p>${markdownToHtml(summary)}</p>` : ''}
        
        ${hypeIndex ? `
          <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--accent);">
            <h4 style="color: var(--accent); margin-bottom: 8px;">🔥 热度指数：${hypeIndex.score}/5</h4>
            <p style="color: var(--text-secondary);">${hypeIndex.reason || ''}</p>
          </div>
        ` : ''}
        
        ${hot && hot.length > 0 ? `
          <h3>🔥 热点项目</h3>
          <ul style="color: var(--text-secondary); padding-left: 20px; margin-bottom: 20px;">
            ${hot.map(item => `<li style="margin-bottom: 8px;">${item}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${projectInsights.length > 0 ? `
          <h3>🎯 重点项目分析</h3>
          ${projectInsights.map(insight => `
            <div style="margin-bottom: 20px;">
              <h4 style="color: var(--accent); margin-bottom: 8px;">
                ${insight.project_name ? `<a href="${insight.github_url || '#'}" class="project-link" target="_blank">${insight.project_name}</a>` : ''}
              </h4>
              <p style="color: var(--text-secondary);">${insight.analysis || ''}</p>
            </div>
          `).join('')}
        ` : ''}
        
        ${trends.length > 0 ? `
          <h3>📈 趋势观察</h3>
          <ul style="color: var(--text-secondary); padding-left: 20px; margin-bottom: 20px;">
            ${Array.isArray(trends) ? trends.map(trend => `<li>${trend}</li>`).join('') : ''}
          </ul>
        ` : ''}
        
        ${recommendations.length > 0 ? `
          <h3>💡 推荐建议</h3>
          <ul style="color: var(--text-secondary); padding-left: 20px;">
            ${Array.isArray(recommendations) ? recommendations.map(rec => `<li>${rec}</li>`).join('') : ''}
          </ul>
        ` : ''}
      </section>
    `;
  }

  /**
   * 渲染周报 HTML（简化版，后续完善）
   */
  renderWeeklyHTML(data) {
    return this.renderDailyHTML({ ...data, date: data.weekStart });
  }

  /**
   * 渲染月报 HTML（简化版，后续完善）
   */
  renderMonthlyHTML(data) {
    return this.renderDailyHTML({ ...data, date: data.month });
  }
}

module.exports = HTMLGenerator;
