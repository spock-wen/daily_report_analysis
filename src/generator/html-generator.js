const { writeHtml } = require('../utils/fs');
const { getDailyReportPath, getWeeklyReportPath, getMonthlyReportPath } = require('../utils/path');
const { renderTemplate, markdownToHtml } = require('../utils/template');
const logger = require('../utils/logger');

class HTMLGenerator {
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

  renderDailyHTML(data) {
    const { aiInsights, date } = data;
    const projects = data.projects || data.trending_repos || [];
    const stats = data.stats || {};

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub AI Trending 日报 - ${date}</title>
  <link rel="stylesheet" href="../../public/css/style.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>GitHub AI Trending 日报</h1>
      <div class="date">${date}</div>
    </header>

    ${this.renderStatsSection(stats)}
    ${this.renderAIInsightsSection(aiInsights, projects)}
    ${this.renderProjectListSection(projects)}
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

  renderStatsSection(stats) {
    const statItems = [
      {
        label: '上榜项目',
        value: stats.totalProjects || stats.total_projects || 0,
        icon: null
      },
      {
        label: 'AI 项目',
        value: stats.aiProjects || stats.ai_projects || 0,
        icon: null
      },
      {
        label: '平均 Stars',
        value: stats.avgStars || stats.avg_stars || '0',
        icon: `<svg class="star-icon" viewBox="0 0 16 16" fill="currentColor" style="width: 20px; height: 20px;"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>`
      },
      {
        label: '高热项目',
        value: stats.hotProjects || stats.hot_projects || 0,
        icon: null
      }
    ];

    return `
      <section class="stats-grid">
        ${statItems.map(stat => `
          <div class="stat-card">
            <div class="stat-value">
              ${stat.icon ? `${stat.icon}<span style="vertical-align: middle;">${stat.value}</span>` : stat.value}
            </div>
            <div class="stat-label">${stat.label}</div>
          </div>
        `).join('')}
      </section>
    `;
  }

  renderProjectListSection(projects) {
    if (!projects || projects.length === 0) {
      return '<section><h2>项目榜单</h2><p>暂无数据</p></section>';
    }

    return `
      <section>
        <h2>项目榜单</h2>
        <div class="project-list">
          ${projects.map((project, index) => this.renderProjectCard(project, index)).join('')}
        </div>
      </section>
    `;
  }

  renderProjectCard(project, index) {
    const analysis = project.analysis || {};
    const coreFeatures = analysis.coreFunctions || [];
    const useCases = analysis.useCases || [];
    const trends = analysis.trends || [];

    return `
      <div class="project-card">
        <div class="project-header">
          <a href="${project.url || '#'}" class="project-name" target="_blank">
            ${index + 1}. ${project.fullName || project.repo || project.name}
          </a>
          <div class="project-stats">
            <span class="stat-badge" title="总星数">
              <svg class="star-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
              ${this.formatNumber(project.stars || 0)}
            </span>
            <span class="stat-badge hot" title="今日星数">
              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8.5 13.25a.75.75 0 01-.75-.75V9.688l-1.95 1.95a.75.75 0 01-1.06-1.06l3.25-3.25a.75.75 0 011.06 0l3.25 3.25a.75.75 0 11-1.06 1.06l-1.95-1.95v2.812a.75.75 0 01-.75.75zM8 1.25a.75.75 0 01.75.75v2.812l1.95-1.95a.75.75 0 111.06 1.06L8.5 7.172a.75.75 0 01-1.06 0L4.19 3.922a.75.75 0 111.06-1.06l1.95 1.95V2a.75.75 0 01.75-.75z"/></svg>
              +${project.todayStars || 0}
            </span>
            <span class="stat-badge" title="分支数">
              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/></svg>
              ${project.forks || 0}
            </span>
            ${project.language ? `
              <span class="stat-badge" title="编程语言">
                ${project.language}
              </span>
            ` : ''}
          </div>
        </div>
        <div class="project-description">${project.descZh || project.desc || project.description || '暂无描述'}</div>
        ${(coreFeatures.length > 0 || useCases.length > 0 || trends.length > 0) ? `
          <button class="toggle-btn" onclick="toggleDetails(${index})" id="btn-${index}">
            查看详情
          </button>
          <div class="project-details" id="details-${index}">
            ${coreFeatures.length > 0 ? `
              <div class="detail-column">
                <h4>核心功能</h4>
                <ul>
                  ${this.renderDetailItems(coreFeatures)}
                </ul>
              </div>
            ` : ''}
            ${useCases.length > 0 ? `
              <div class="detail-column">
                <h4>适用场景</h4>
                <ul>
                  ${this.renderDetailItems(useCases)}
                </ul>
              </div>
            ` : ''}
            ${trends.length > 0 ? `
              <div class="detail-column">
                <h4>热度趋势</h4>
                <ul>
                  ${this.renderDetailItems(trends)}
                </ul>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  formatNumber(num) {
    if (typeof num === 'string') return num;
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  renderDetailItems(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return '<li>暂无数据</li>';
    }
    return items.map(item => `<li>${item}</li>`).join('');
  }

  renderAIInsightsSection(aiInsights, projects = []) {
    if (!aiInsights) {
      return '<section><h2>AI 深度洞察</h2><p>AI 分析尚未完成</p></section>';
    }

    const summary = aiInsights.summary || aiInsights.oneLiner || '';
    const projectInsights = aiInsights.project_insights || [];
    const trends = aiInsights.trends || aiInsights.shortTerm || aiInsights.longTerm || [];
    const recommendations = aiInsights.recommendations || aiInsights.action || [];
    const hot = aiInsights.hot || [];
    const hypeIndex = aiInsights.hypeIndex;

    const projectUrlMap = {};
    projects.forEach(project => {
      if (project.url) {
        if (project.fullName) projectUrlMap[project.fullName] = project.url;
        if (project.repo) projectUrlMap[project.repo] = project.url;
        if (project.name && project.name.includes('/')) projectUrlMap[project.name] = project.url;
      }
    });

    const linkifyProjectName = (text) => {
      if (!text) return text;
      const projectRegex = /([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/g;
      return text.replace(projectRegex, (match, projectName) => {
        const cleanProjectName = projectName.replace(/[.,:;!?)]+$/, '');
        const url = projectUrlMap[cleanProjectName];
        if (url) {
          return `<a href="${url}" class="project-link" target="_blank">${cleanProjectName}</a>`;
        }
        return match;
      });
    };

    return `
      <section class="ai-insights">
        <h2>AI 深度洞察</h2>
        ${summary ? `<p>${markdownToHtml(summary)}</p>` : ''}

        ${hypeIndex ? `
          <div class="hype-badge">
            <div class="hype-title">🔥 热度指数：${hypeIndex.score}/5</div>
            <div class="hype-reason">${linkifyProjectName(hypeIndex.reason) || ''}</div>
          </div>
        ` : ''}

        ${hot && hot.length > 0 ? `
          <h3>热点项目</h3>
          <ul>
            ${hot.map(item => `<li>${linkifyProjectName(item)}</li>`).join('')}
          </ul>
        ` : ''}

        ${projectInsights.length > 0 ? `
          <h3>重点项目分析</h3>
          ${projectInsights.map(insight => `
            <div style="margin-bottom: 12px;">
              <div style="margin-bottom: 4px;">
                ${insight.project_name ? `<a href="${insight.github_url || '#'}" class="project-link" target="_blank">${insight.project_name}</a>` : ''}
              </div>
              <p>${insight.analysis || ''}</p>
            </div>
          `).join('')}
        ` : ''}

        ${trends.length > 0 ? `
          <h3>趋势观察</h3>
          <ul>
            ${Array.isArray(trends) ? trends.map(trend => `<li>${linkifyProjectName(trend)}</li>`).join('') : ''}
          </ul>
        ` : ''}

        ${recommendations.length > 0 ? `
          <h3>推荐建议</h3>
          <ul>
            ${Array.isArray(recommendations) ? recommendations.map(rec => `<li>${linkifyProjectName(rec)}</li>`).join('') : ''}
          </ul>
        ` : ''}
      </section>
    `;
  }

  renderWeeklyHTML(data) {
    return this.renderDailyHTML({ ...data, date: data.weekStart || data.month });
  }

  renderMonthlyHTML(data) {
    return this.renderDailyHTML({ ...data, date: data.month });
  }
}

module.exports = HTMLGenerator;
