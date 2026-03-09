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
      --bg-secondary: #0f0f0f;
      --bg-card: #141414;
      --text-primary: #f0f0f0;
      --text-secondary: #888888;
      --text-muted: #666666;
      --accent: #00ff41;
      --accent-dim: #00cc33;
      --border: #1f1f1f;
      --border-light: #2a2a2a;
      --success: #00ff41;
      --warning: #ffaa00;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 24px 16px;
      font-size: 14px;
    }
    
    .container {
      max-width: 1024px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      padding: 48px 0 32px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 40px;
    }
    
    h1 {
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    
    .date {
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 400;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }
    
    .stat-card {
      background: var(--bg-card);
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
      text-align: center;
      transition: all 0.2s;
    }
    
    .stat-card:hover {
      border-color: var(--border-light);
      background: var(--bg-secondary);
    }
    
    .stat-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--accent);
      line-height: 1.2;
    }
    
    .stat-label {
      color: var(--text-secondary);
      margin-top: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    section {
      margin-bottom: 32px;
    }
    
    h2 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-icon {
      width: 18px;
      height: 18px;
      color: var(--accent);
    }
    
    .project-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .project-card {
      background: var(--bg-card);
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
      transition: all 0.2s;
    }
    
    .project-card:hover {
      border-color: var(--border-light);
      background: var(--bg-secondary);
    }
    
    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 12px;
    }
    
    .project-name {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text-primary);
      text-decoration: none;
      line-height: 1.4;
    }
    
    .project-name:hover {
      color: var(--accent);
    }
    
    .project-stats {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    
    .stat-item {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--bg-secondary);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      color: var(--text-secondary);
      border: 1px solid var(--border);
      white-space: nowrap;
    }
    
    .stat-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: var(--text-muted);
    }
    
    .stat-icon-hot {
      color: #ff6b35;
    }
    
    .stat-value {
      font-weight: 500;
      color: var(--text-primary);
    }
    
    .project-description {
      color: var(--text-secondary);
      font-size: 0.875rem;
      line-height: 1.5;
      margin-bottom: 12px;
    }
    
    .toggle-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .toggle-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    
    .project-details {
      display: none;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    
    .project-details.active {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    
    .detail-column {
      background: var(--bg-secondary);
      padding: 12px;
      border-radius: 6px;
    }
    
    .detail-column h4 {
      color: var(--text-primary);
      margin-bottom: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .detail-column ul {
      list-style: none;
    }
    
    .detail-column li {
      color: var(--text-secondary);
      padding: 4px 0;
      font-size: 0.8125rem;
      line-height: 1.5;
    }
    
    .ai-insights {
      background: var(--bg-card);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    
    .ai-insights h3 {
      color: var(--text-primary);
      margin-bottom: 12px;
      font-size: 0.875rem;
      font-weight: 600;
    }
    
    .ai-insights p {
      color: var(--text-secondary);
      margin-bottom: 16px;
      line-height: 1.7;
      font-size: 0.875rem;
    }
    
    .ai-insights ul {
      margin-bottom: 16px;
      padding-left: 20px;
    }
    
    .ai-insights li {
      color: var(--text-secondary);
      margin-bottom: 6px;
      font-size: 0.875rem;
      line-height: 1.6;
    }
    
    .project-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 500;
    }
    
    .project-link:hover {
      text-decoration: underline;
    }
    
    .hype-card {
      margin-bottom: 16px;
      padding: 12px;
      background: var(--bg-secondary);
      border-radius: 6px;
      border-left: 2px solid var(--accent);
    }
    
    .hype-title {
      color: var(--accent);
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 6px;
    }
    
    .hype-reason {
      color: var(--text-secondary);
      font-size: 0.8125rem;
      line-height: 1.6;
    }
    
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .project-header {
        flex-direction: column;
      }
      
      .project-details.active {
        grid-template-columns: 1fr;
      }
      
      h1 {
        font-size: 1.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>GitHub AI Trending 日报</h1>
      <div class="date">${date}</div>
    </header>

    ${this.renderStatsSection(stats)}
    ${this.renderAIInsightsSection(aiInsights, trendingRepos)}
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
      { 
        label: '上榜项目', 
        value: stats.total_projects || 0,
        icon: `<svg class="stat-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17 17h-2v2c0 .55-.45 1-1 1s-1-.45-1-1v-2H9v2c0 .55-.45 1-1 1s-1-.45-1-1v-2H5c-.55 0-1-.45-1-1V5c0-.55.45-1 1-1h2V2c0-.55.45-1 1-1s1 .45 1 1v2h4V2c0-.55.45-1 1-1s1 .45 1 1v2h2c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zM5 5v10h2V5H5zm6 0v10h2V5h-2zm6 0v10h2V5h-2z"/></svg>`
      },
      { 
        label: 'AI 项目', 
        value: stats.ai_projects || 0,
        icon: `<svg class="stat-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5"/></svg>`
      },
      { 
        label: '平均 Stars', 
        value: stats.avg_stars || 0,
        icon: `<svg class="stat-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
      },
      { 
        label: '高热项目', 
        value: stats.hot_projects || 0,
        icon: `<svg class="stat-icon stat-icon-hot" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4.97 0-9-3.58-9-8 0-2.52 1.17-5.32 3.19-7.23.28-.27.69-.35 1.05-.2.36.15.6.5.6.9 0 .87-.35 1.7-.97 2.32-.69.69-1.08 1.62-1.08 2.61 0 3.42 2.78 6.2 6.21 6.2s6.21-2.78 6.21-6.2c0-1.52-.55-2.96-1.56-4.08-.28-.31-.33-.77-.13-1.14.2-.37.62-.58 1.03-.53 4.27.54 7.66 4.15 7.66 8.55 0 4.42-4.03 8-9 8z"/></svg>`
      }
    ];

    return `
      <section class="stats-grid">
        ${statItems.map(stat => `
          <div class="stat-card">
            <div class="stat-value">
              ${stat.icon}
              <span>${stat.value}</span>
            </div>
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
        <h2>
          <svg class="section-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
          项目榜单
        </h2>
        <div class="project-list">
          ${projects.map((project, index) => `
            <div class="project-card">
              <div class="project-header">
                <a href="${project.url || '#'}" class="project-name" target="_blank">
                  ${index + 1}. ${project.name}
                </a>
                <div class="project-stats">
                  <span class="stat-item" title="总星数">
                    <svg class="stat-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span class="stat-value">${project.stars || 0}</span>
                  </span>
                  <span class="stat-item" title="今日星数">
                    <svg class="stat-icon stat-icon-hot" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 23c-4.97 0-9-3.58-9-8 0-2.52 1.17-5.32 3.19-7.23.28-.27.69-.35 1.05-.2.36.15.6.5.6.9 0 .87-.35 1.7-.97 2.32-.69.69-1.08 1.62-1.08 2.61 0 3.42 2.78 6.2 6.21 6.2s6.21-2.78 6.21-6.2c0-1.52-.55-2.96-1.56-4.08-.28-.31-.33-.77-.13-1.14.2-.37.62-.58 1.03-.53 4.27.54 7.66 4.15 7.66 8.55 0 4.42-4.03 8-9 8z"/>
                    </svg>
                    <span class="stat-value">+${project.todayStars || 0}</span>
                  </span>
                  <span class="stat-item" title="分支数">
                    <svg class="stat-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17 17h-2v2c0 .55-.45 1-1 1s-1-.45-1-1v-2H9v2c0 .55-.45 1-1 1s-1-.45-1-1v-2H5c-.55 0-1-.45-1-1V5c0-.55.45-1 1-1h2V2c0-.55.45-1 1-1s1 .45 1 1v2h4V2c0-.55.45-1 1-1s1 .45 1 1v2h2c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zM5 5v10h2V5H5zm6 0v10h2V5h-2zm6 0v10h2V5h-2z"/>
                    </svg>
                    <span class="stat-value">${project.forks || 0}</span>
                  </span>
                  ${project.language ? `
                    <span class="stat-item" title="编程语言">
                      <svg class="stat-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                      </svg>
                      <span class="stat-value">${project.language}</span>
                    </span>
                  ` : ''}
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
   * @param {Object} aiInsights - AI 洞察数据
   * @param {Array} trendingRepos - 项目列表，用于匹配项目链接
   */
  renderAIInsightsSection(aiInsights, trendingRepos = []) {
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

    // 创建项目名到 URL 的映射
    const projectUrlMap = {};
    trendingRepos.forEach(project => {
      if (project.name && project.url) {
        projectUrlMap[project.name] = project.url;
      }
    });

    // 辅助函数：从文本中提取项目名并生成带链接的 HTML
    const linkifyProjectName = (text) => {
      if (!text) return text;
      
      // 全局匹配所有 owner/repo 格式（支持中英文冒号和括号等分隔符）
      const projectRegex = /([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/g;
      
      return text.replace(projectRegex, (match, projectName) => {
        const url = projectUrlMap[projectName];
        if (url) {
          return `<a href="${url}" class="project-link" target="_blank">${projectName}</a>`;
        }
        return match;
      });
    };

    return `
      <section class="ai-insights">
        <h2>
          <svg class="section-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5"/>
          </svg>
          AI 深度洞察
        </h2>
        ${summary ? `<p>${markdownToHtml(summary)}</p>` : ''}
        
        ${hypeIndex ? `
          <div class="hype-card">
            <div class="hype-title">🔥 热度指数：${hypeIndex.score}/5</div>
            <div class="hype-reason">${linkifyProjectName(hypeIndex.reason) || ''}</div>
          </div>
        ` : ''}
        
        ${hot && hot.length > 0 ? `
          <h3>🔥 热点项目</h3>
          <ul>
            ${hot.map(item => `<li>${linkifyProjectName(item)}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${projectInsights.length > 0 ? `
          <h3>🎯 重点项目分析</h3>
          ${projectInsights.map(insight => `
            <div style="margin-bottom: 16px;">
              <h4 style="margin-bottom: 6px;">
                ${insight.project_name ? `<a href="${insight.github_url || '#'}" class="project-link" target="_blank">${insight.project_name}</a>` : ''}
              </h4>
              <p>${insight.analysis || ''}</p>
            </div>
          `).join('')}
        ` : ''}
        
        ${trends.length > 0 ? `
          <h3>📈 趋势观察</h3>
          <ul>
            ${Array.isArray(trends) ? trends.map(trend => `<li>${linkifyProjectName(trend)}</li>`).join('') : ''}
          </ul>
        ` : ''}
        
        ${recommendations.length > 0 ? `
          <h3>💡 推荐建议</h3>
          <ul>
            ${Array.isArray(recommendations) ? recommendations.map(rec => `<li>${linkifyProjectName(rec)}</li>`).join('') : ''}
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
