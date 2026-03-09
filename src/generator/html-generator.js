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
  <link rel="stylesheet" href="../../public/css/style.css">
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
        icon: null
      },
      { 
        label: 'AI 项目', 
        value: stats.ai_projects || 0,
        icon: null
      },
      { 
        label: '平均 Stars', 
        value: this.formatNumber(stats.avg_stars || 0),
        icon: `<svg class="star-icon" viewBox="0 0 16 16" fill="currentColor" style="width: 20px; height: 20px;"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>`
      },
      { 
        label: '高热项目', 
        value: stats.hot_projects || 0,
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

  /**
   * 渲染项目列表
   */
  renderProjectListSection(projects) {
    if (!projects || projects.length === 0) {
      return '<section><h2>项目榜单</h2><p>暂无数据</p></section>';
    }

    return `
      <section>
        <h2>项目榜单</h2>
        <div class="project-list">
          ${projects.map((project, index) => `
            <div class="project-card">
              <div class="project-header">
                <a href="${project.url || '#'}" class="project-name" target="_blank">
                  ${index + 1}. ${project.name}
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
   * 格式化数字（添加千位分隔符）
   */
  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
      return '<section><h2>AI 深度洞察</h2><p>AI 分析尚未完成</p></section>';
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

  /**
   * 渲染周报 HTML
   * @param {Object} data - 周报数据
   * @returns {string} HTML 字符串
   */
  renderWeeklyHTML(data) {
    const { brief, aiInsights, weekStart, weekEnd, weekLabel } = data;
    const trendingRepos = brief?.trending_repos || [];
    const stats = brief?.stats || {};

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub AI Trending 周报 - ${weekLabel || weekStart}</title>
    <link rel="stylesheet" href="../../public/css/style.css">
    <link rel="stylesheet" href="../../public/css/weekly.css">
</head>
<body>
    <div class="container">
        ${this.renderHeader(weekLabel, weekStart, weekEnd)}
        ${this.renderWeeklyStats(stats, trendingRepos)}
        ${this.renderWeeklyTheme(aiInsights, trendingRepos)}
        ${this.renderAIInsights(aiInsights, trendingRepos)}
        ${this.renderTopProjects(aiInsights, trendingRepos)}
        ${this.renderProjectGroups(trendingRepos)}
        ${this.renderFooter()}
    </div>
</body>
</html>`;
  }

  /**
   * 渲染周报 Header
   */
  renderHeader(weekLabel, weekStart, weekEnd) {
    const dateRange = weekStart && weekEnd ? `${weekStart} ~ ${weekEnd}` : '';
    return `
        <header>
            <h1>GitHub AI Trending 周报</h1>
            <p class="date">${weekLabel || dateRange}</p>
        </header>
    `;
  }

  /**
   * 渲染周度统计
   */
  renderWeeklyStats(stats, trendingRepos) {
    const totalProjects = stats?.total_projects || stats?.totalProjects || trendingRepos.length;
    const aiProjects = stats?.ai_projects || stats?.aiProjects || trendingRepos.filter(p => p.isAI).length;
    const aiPercentage = totalProjects > 0 ? Math.round((aiProjects / totalProjects) * 100) : 0;
    const avgStars = stats?.avg_stars || stats?.avgStars || '0';
    
    // 找出最大黑马（今日 Stars 最多的项目）
    let topHorse = null;
    let maxStars = 0;
    trendingRepos.forEach(p => {
      const todayStars = parseInt(p.todayStars) || 0;
      if (todayStars > maxStars) {
        maxStars = todayStars;
        topHorse = p;
      }
    });

    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${totalProjects}</div>
                <div class="stat-label">上榜项目</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${this.formatNumber(avgStars)}</div>
                <div class="stat-label">平均 Stars</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${aiPercentage}%</div>
                <div class="stat-label">AI 项目</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${topHorse ? this.formatNumber(maxStars) : '0'}</div>
                <div class="stat-label">最大黑马</div>
                <div style="margin-top:4px;font-size:0.6875rem;color:var(--text-secondary)">${topHorse?.name || '-'}</div>
            </div>
        </div>
    `;
  }

  /**
   * 渲染周度主题
   */
  renderWeeklyTheme(aiInsights, trendingRepos) {
    if (!aiInsights) return '';
    
    const weeklyTheme = aiInsights.weeklyTheme || aiInsights.weekly_theme;
    if (!weeklyTheme) return '';

    const projectUrlMap = this.createProjectUrlMap(trendingRepos);
    const oneLiner = this.linkifyText(weeklyTheme.oneLiner || weeklyTheme.one_liner, projectUrlMap);
    const detailed = this.linkifyText(weeklyTheme.detailed || '', projectUrlMap);

    return `
        <section>
            <h2>周度主题</h2>
            <div class="theme-box">
                <div class="theme-text">${oneLiner}</div>
                ${detailed ? `<div style="margin-top: 8px; font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.6;">${detailed}</div>` : ''}
            </div>
        </section>
    `;
  }

  /**
   * 渲染 AI 深度洞察
   */
  renderAIInsights(aiInsights, trendingRepos) {
    if (!aiInsights) return '';

    const projectUrlMap = this.createProjectUrlMap(trendingRepos);
    
    // 热点
    const highlights = aiInsights.highlights || aiInsights.hot || [];
    // 趋势
    const trends = aiInsights.trends?.shortTerm || aiInsights.shortTerm || [];
    // 新兴领域
    const emergingFields = aiInsights.emergingFields || aiInsights.emerging_fields || [];
    // 行动建议
    const recommendations = aiInsights.recommendations?.developers || aiInsights.recommendations?.development || aiInsights.action || [];

    return `
        <section>
            <h2>AI 深度洞察</h2>
            <div class="insight-section">
                ${highlights.length > 0 ? `
                <div class="insight-block">
                    <div class="insight-label">本周热点</div>
                    <div class="insight-content">
                        <ul class="insight-list" style="list-style: none; padding-left: 0;">
                            ${highlights.map(item => `<li style="padding: 4px 0; border-bottom: 1px solid var(--border-light);">› ${this.linkifyText(item, projectUrlMap)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                ` : ''}

                ${trends.length > 0 ? `
                <div class="insight-block">
                    <div class="insight-label">短期趋势</div>
                    <div class="insight-content">
                        <ul class="insight-list" style="list-style: none; padding-left: 0;">
                            ${trends.map(item => `<li style="padding: 4px 0; border-bottom: 1px solid var(--border-light);">› ${this.linkifyText(item, projectUrlMap)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                ` : ''}

                ${emergingFields.length > 0 ? `
                <div class="insight-block">
                    <div class="insight-label">新兴领域</div>
                    <div class="insight-content">
                        ${emergingFields.map(field => {
                          if (typeof field === 'string') {
                            return `<div style="padding: 8px 0; border-bottom: 1px solid var(--border-light);">
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${field}</div>
                            </div>`;
                          } else {
                            const fieldName = field.field || field.name || '';
                            const fieldDesc = field.description || '';
                            return `<div style="padding: 8px 0; border-bottom: 1px solid var(--border-light);">
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${fieldName}</div>
                                ${fieldDesc ? `<div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.5;">${fieldDesc}</div>` : ''}
                            </div>`;
                          }
                        }).join('')}
                    </div>
                </div>
                ` : ''}

                ${recommendations.length > 0 ? `
                <div class="insight-block">
                    <div class="insight-label">行动建议</div>
                    <div class="insight-content">
                        <ul class="insight-list" style="list-style: none; padding-left: 0;">
                            ${recommendations.map(item => `<li style="padding: 4px 0; border-bottom: 1px solid var(--border-light);">› ${this.linkifyText(item, projectUrlMap)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                ` : ''}
            </div>
        </section>
    `;
  }

  /**
   * 渲染重点项目推荐
   */
  renderTopProjects(aiInsights, trendingRepos) {
    const topProjects = aiInsights?.topProjects || [];
    if (topProjects.length === 0) return '';

    return `
        <section>
            <h2>重点项目推荐</h2>
            <div class="project-grid">
                ${topProjects.slice(0, 3).map(project => {
                  const repo = trendingRepos.find(p => p.name === project.repo) || {};
                  const category = project.category || '技术创新';
                  const reason = project.reason || '';
                  const value = project.value || '';
                  
                  return `
                    <div class="project-card">
                        <div class="project-header">
                            <a href="${repo.url || '#'}" target="_blank" class="project-name">${project.repo}</a>
                            <div class="project-stats">
                                <span class="stat-badge" title="总星数">
                                    <svg class="star-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
                                    ${this.formatNumber(repo.stars || 0)}
                                </span>
                                <span class="stat-badge" title="分支数">
                                    <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/></svg>
                                    ${this.formatNumber(repo.forks || 0)}
                                </span>
                            </div>
                        </div>
                        ${repo.description ? `<div class="project-description">${repo.description}</div>` : ''}
                        ${reason ? `
                        <div class="reason-box">
                            <div class="reason-label">入选理由</div>
                            <div class="reason-content">${reason}</div>
                        </div>
                        ` : ''}
                    </div>
                  `;
                }).join('')}
            </div>
        </section>
    `;
  }

  /**
   * 渲染完整项目列表（按领域分组，与日报一致）
   */
  renderProjectGroups(trendingRepos) {
    if (!trendingRepos || trendingRepos.length === 0) return '';

    // 按类型分组
    const groups = {};
    trendingRepos.forEach(project => {
      const type = project.analysis?.typeName || project.analysis?.type || '其他';
      if (!groups[type]) groups[type] = [];
      groups[type].push(project);
    });

    // 使用全局唯一的 index
    let globalIndex = 0;

    return `
        <section>
            <h2>完整项目列表</h2>
            ${Object.entries(groups).map(([type, projects]) => `
                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 0.8125rem; font-weight: 600; color: var(--text-primary); margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border);">
                        ${type}（${projects.length}个）
                    </h3>
                    <div class="project-list">
                        ${projects.map((project) => {
                          const idx = globalIndex++;
                          return this.renderProjectCard(project, idx);
                        }).join('')}
                    </div>
                </div>
            `).join('')}
        </section>
    `;
  }

  /**
   * 渲染单个项目卡片（与日报一致）
   */
  renderProjectCard(project, index) {
    const coreFeatures = project.analysis?.coreFunctions || project.analysis?.core_features || [];
    const useCases = project.analysis?.useCases || project.analysis?.use_cases || [];
    const trends = project.analysis?.trends || [];
    const language = project.language;

    return `
        <div class="project-card" style="margin-bottom: 8px;">
            <div class="project-header">
                <a href="${project.url || '#'}" target="_blank" class="project-name">${project.name}</a>
                <div class="project-stats">
                    <span class="stat-badge" title="总星数">
                        <svg class="star-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
                        ${this.formatNumber(project.stars || 0)}
                    </span>
                    <span class="stat-badge" title="分支数">
                        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/></svg>
                        ${this.formatNumber(project.forks || 0)}
                    </span>
                    ${language ? `
                    <span class="stat-badge" title="编程语言">
                        ${language}
                    </span>
                    ` : ''}
                </div>
            </div>
            ${project.description ? `<div class="project-description">${project.description}</div>` : ''}
            ${(coreFeatures.length > 0 || useCases.length > 0 || trends.length > 0) ? `
            <button class="toggle-btn" onclick="toggleDetails('weekly-${index}')" id="btn-weekly-${index}">
                查看详情
            </button>
            <div class="project-details" id="details-weekly-${index}">
                ${coreFeatures.length > 0 ? `
                <div class="detail-column">
                    <h4>核心功能</h4>
                    <ul>
                        ${coreFeatures.map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                ${useCases.length > 0 ? `
                <div class="detail-column">
                    <h4>使用场景</h4>
                    <ul>
                        ${useCases.map(u => `<li>${u}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                ${trends.length > 0 ? `
                <div class="detail-column">
                    <h4>热度趋势</h4>
                    <ul>
                        ${trends.map(t => `<li>${t}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>
    `;
  }

  /**
   * 渲染 Footer
   */
  renderFooter() {
    return `
        <footer>
            由 AI 自动生成 · 数据来源 GitHub Trending API
        </footer>
        <script>
          function toggleDetails(id) {
            const details = document.getElementById('details-' + id);
            const btn = document.getElementById('btn-' + id);
            if (details && btn) {
              const isActive = details.classList.contains('active');
              if (isActive) {
                details.classList.remove('active');
                btn.textContent = '查看详情';
              } else {
                details.classList.add('active');
                btn.textContent = '收起详情';
              }
            }
          }
        </script>
    `;
  }

  /**
   * 创建项目名到 URL 的映射
   */
  createProjectUrlMap(trendingRepos) {
    const projectUrlMap = {};
    trendingRepos.forEach(project => {
      if (project.name && project.url) {
        projectUrlMap[project.name] = project.url;
      }
    });
    return projectUrlMap;
  }

  /**
   * 将文本中的项目名转换为可点击链接
   */
  linkifyText(text, projectUrlMap) {
    if (!text) return text;
    
    const projectRegex = /([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/g;
    
    return text.replace(projectRegex, (match, projectName) => {
      const url = projectUrlMap[projectName];
      if (url) {
        return `<a href="${url}" target="_blank">${projectName}</a>`;
      }
      return match;
    });
  }

  /**
   * 渲染月报 HTML（简化版，后续完善）
   */
  renderMonthlyHTML(data) {
    return this.renderDailyHTML({ ...data, date: data.month });
  }
}

module.exports = HTMLGenerator;
