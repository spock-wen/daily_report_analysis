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
    const { aiInsights, date, period } = data;
    // 支持多种数据格式：根级别 projects/trending_repos 或 brief.trending_repos
    const projects = data.projects || data.trending_repos || data.brief?.trending_repos || [];
    const stats = data.stats || data.brief?.stats || {};
    
    // 根据 period 字段判断是日报还是周报
    const reportType = period === '每周' ? '周报' : period === '每月' ? '月报' : '日报';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub AI Trending ${reportType} - ${date}</title>
  <link rel="stylesheet" href="../../public/css/style.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>GitHub AI Trending ${reportType}</h1>
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
    
    // 确保项目名称有 GitHub 链接
    const projectName = project.fullName || project.repo || project.name || '';
    const projectUrl = project.url || (projectName ? `https://github.com/${projectName}` : '#');

    return `
      <div class="project-card">
        <div class="project-header">
          <a href="${projectUrl}" class="project-name" target="_blank">
            ${index + 1}. ${projectName}
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

  escapeHtml(text) {
    if (!text) return '';
    const htmlEntities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return String(text).replace(/[&<>"']/g, char => htmlEntities[char]);
  }

  linkifyProjects(text, projects = []) {
    if (!text) return '';
    
    let result = text;
    
    // 辅助函数：在非链接部分执行替换
    const replaceOutsideLinks = (input, regex, replacer) => {
      const linkRegex = /(<a[^>]*>.*?<\/a>)/g;
      const parts = input.split(linkRegex);
      return parts.map((part, index) => {
        // 偶数索引是非链接部分，奇数索引是链接部分
        if (index % 2 === 1) {
          return part; // 保持链接部分不变
        }
        return part.replace(regex, replacer);
      }).join('');
    };
    
    // 1. 处理反引号包裹的项目（如 `owner/repo`）
    result = result.replace(/`([^`]+)`/g, (match, content) => {
      if (content.includes('/')) {
        return `<a href="https://github.com/${content}" target="_blank">${content}</a>`;
      }
      return match;
    });
    
    // 2. 直接匹配文本中的 owner/repo 格式
    // 支持：行首、空格、中文标点、英文标点后的 owner/repo
    const ownerRepoRegex = /(^|[\s（(,:：;；，。！？、\-])((?:[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+))/gm;
    result = replaceOutsideLinks(result, ownerRepoRegex, (match, prefix, repoPath) => {
      // 排除日期格式（如 03-17），但保留 ai/deepagents 这种格式
      const firstPart = repoPath.split('/')[0];
      // 如果第一部分是纯数字（两位数），认为是日期，跳过
      if (/^\d{2}$/.test(firstPart)) {
        return match;
      }
      return `${prefix}<a href="https://github.com/${repoPath}" target="_blank">${repoPath}</a>`;
    });
    
    // 3. 使用项目列表匹配项目名（如 "BettaFish" 匹配到 "666ghj/BettaFish"）
    if (projects && projects.length > 0) {
      // 构建项目名称到完整路径的映射
      const projectNameMap = new Map();
      projects.forEach(project => {
        const fullName = project.fullName || project.repo || project.name;
        if (fullName && fullName.includes('/')) {
          const nameOnly = fullName.split('/')[1];
          if (nameOnly) {
            projectNameMap.set(nameOnly, fullName);
          }
        }
      });
      
      // 按名称长度降序排序，避免短名匹配到长名的一部分
      const sortedNames = Array.from(projectNameMap.keys()).sort((a, b) => b.length - a.length);
      
      // 只在非链接部分匹配项目名
      sortedNames.forEach(nameOnly => {
        const fullName = projectNameMap.get(nameOnly);
        const nameRegex = new RegExp(`(^|[^a-zA-Z0-9_-])${this.escapeRegex(nameOnly)}(?![a-zA-Z0-9_-])`, 'g');
        result = replaceOutsideLinks(result, nameRegex, `$1<a href="https://github.com/${fullName}" target="_blank">${nameOnly}</a>`);
      });
    }
    
    return result;
  }
  
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  escapeAndLinkify(text, projects = []) {
    if (!text) return '';
    
    // 检查文本是否已经包含 GitHub 链接
    if (text.includes('href="https://github.com/')) {
      // 已经有链接，直接返回（不转义，避免破坏已有 HTML）
      return text;
    }
    
    // 如果没有链接，进行链接化
    return this.linkifyProjects(text, projects);
  }

  formatNumber(num) {
    if (num === null || num === undefined) return '0';
    if (typeof num === 'string') num = parseInt(num, 10);
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toLocaleString();
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
    const { aiInsights, date, weekStart } = data;
    const projects = data.projects || data.trending_repos || data.brief?.trending_repos || [];
    const stats = data.stats || data.brief?.stats || {};
    const summary = data.summary || {};

    // 按类型分组
    const groupedProjects = this.groupProjectsByType(projects);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub AI Trending 周报 - ${weekStart || date}</title>
  <link rel="stylesheet" href="../../public/css/style.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>GitHub AI Trending 周报</h1>
      <div class="date">${weekStart || date}</div>
    </header>

    ${this.renderWeeklyStatsSection(stats, summary)}
    ${this.renderWeeklyThemeSection(aiInsights, projects)}
    ${this.renderDeepTrendsSection(aiInsights, projects)}
    ${this.renderWeeklyInsightsSection(aiInsights, projects)}
    ${this.renderTopProjectsSection(aiInsights, projects)}
    ${this.renderGroupedProjectsSection(groupedProjects)}
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

  renderWeeklyStatsSection(stats, summary) {
    const totalProjects = stats.totalProjects || stats.total_projects || summary.total || 0;
    const aiProjects = stats.aiProjects || stats.ai_projects || summary.aiCount || 0;
    const aiPercentage = totalProjects > 0 ? Math.round((aiProjects / totalProjects) * 100) : 0;
    const avgStars = stats.avgStars || stats.avg_stars || summary.avgStars || '0';
    const maxTodayStars = summary.maxTodayStars || 0;
    const hotProject = summary.topProject || '';

    return `
      <section class="weekly-overview">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${totalProjects}</div>
            <div class="stat-label">上榜项目</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgStars}</div>
            <div class="stat-label">平均 Stars</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${aiPercentage}%</div>
            <div class="stat-label">AI 项目</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${maxTodayStars.toLocaleString()}</div>
            <div class="stat-label">最大黑马</div>
            <div class="stat-subtitle">${hotProject.split('/')[1] || hotProject}</div>
          </div>
        </div>
      </section>
    `;
  }

  renderWeeklyThemeSection(aiInsights, projects = []) {
    if (!aiInsights || !aiInsights.weeklyTheme) {
      return '';
    }

    const { oneLiner, detailed } = aiInsights.weeklyTheme;

    return `
      <section class="weekly-theme">
        <h2>周度主题</h2>
        <div class="theme-content">
          <div class="theme-title">${this.escapeAndLinkify(oneLiner, projects)}</div>
          <div class="theme-description">${this.escapeAndLinkify(detailed, projects)}</div>
        </div>
      </section>
    `;
  }

  renderDeepTrendsSection(aiInsights, projects = []) {
    if (!aiInsights || !aiInsights.deepTrends) {
      return '';
    }

    const deepTrends = aiInsights.deepTrends;
    
    // 解析文本内容为多个段落
    const paragraphs = deepTrends.content
      ? deepTrends.content.split('\n\n').filter(p => p.trim())
      : [];

    return `
      <section class="deep-trend-section">
        <div class="trend-header">
          ${deepTrends.title ? `<div class="trend-title">${deepTrends.title}</div>` : ''}
          ${deepTrends.summary ? `<div class="trend-summary">${deepTrends.summary}</div>` : ''}
        </div>
        
        <div class="trend-content">
          ${paragraphs.map(p => `<p>${this.escapeAndLinkify(p, projects)}</p>`).join('')}
        </div>

        ${deepTrends.evidence && deepTrends.evidence.length > 0 ? `
          <div class="evidence-list">
            <div class="evidence-title">关键佐证 (Evidence)</div>
            <div class="evidence-items">
              ${deepTrends.evidence.map(ev => `
                <div class="evidence-item">
                  <div class="evidence-day">${ev.day}</div>
                  <div>
                    <a href="https://github.com/${ev.name}" class="evidence-link" target="_blank">${ev.name}</a>
                    <div class="evidence-reason">${ev.reason}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </section>
    `;
  }

  renderWeeklyStatsSection(stats, summary) {
    const totalProjects = stats.totalProjects || stats.total_projects || summary.total || 0;
    const aiProjects = stats.aiProjects || stats.ai_projects || summary.aiCount || 0;
    const aiPercentage = totalProjects > 0 ? Math.round((aiProjects / totalProjects) * 100) : 0;
    const avgStars = stats.avgStars || stats.avg_stars || summary.avgStars || '0';
    const maxTodayStars = summary.maxTodayStars || 0;
    const hotProject = summary.topProject || '';

    return `
      <section class="weekly-overview">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${totalProjects}</div>
            <div class="stat-label">上榜项目</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgStars}</div>
            <div class="stat-label">平均 Stars</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${aiPercentage}%</div>
            <div class="stat-label">AI 项目</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${maxTodayStars.toLocaleString()}</div>
            <div class="stat-label">最大黑马</div>
            <div class="stat-subtitle">${hotProject.split('/')[1] || hotProject}</div>
          </div>
        </div>
      </section>
    `;
  }

  renderWeeklyInsightsSection(aiInsights, projects = []) {
    if (!aiInsights) {
      return '';
    }

    const highlights = aiInsights.highlights || [];
    const trends = aiInsights.trends || {};
    const emergingFields = aiInsights.emergingFields || [];
    const recommendations = aiInsights.recommendations || {};

    return `
      <section class="ai-insights weekly">
        <h2>AI 深度洞察</h2>
        
        ${highlights.length > 0 ? `
          <div class="insights-block">
            <h3>🔥 本周热点</h3>
            <ul class="highlights-list">
              ${highlights.map(highlight => `<li>${this.escapeAndLinkify(highlight, projects)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${trends.shortTerm && trends.shortTerm.length > 0 ? `
          <div class="insights-block">
            <h3>📈 短期趋势</h3>
            <ul class="trends-list">
              ${trends.shortTerm.map(trend => `<li>${this.escapeAndLinkify(trend, projects)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${emergingFields.length > 0 ? `
          <div class="insights-block">
            <h3>🆕 新兴领域</h3>
            ${emergingFields.map(field => `
              <div class="emerging-field">
                <div class="field-name">${this.escapeAndLinkify(field.field, projects)}</div>
                <div class="field-description">${this.escapeAndLinkify(field.description, projects)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${(recommendations.developers && recommendations.developers.length > 0) || (recommendations.enterprises && recommendations.enterprises.length > 0) ? `
          <div class="insights-block">
            <h3>🎯 行动建议</h3>
            ${recommendations.developers && recommendations.developers.length > 0 ? `
              <h4>开发者建议</h4>
              <ul class="recommendations-list">
                ${recommendations.developers.map(rec => `<li>${this.escapeAndLinkify(rec, projects)}</li>`).join('')}
              </ul>
            ` : ''}
            ${recommendations.enterprises && recommendations.enterprises.length > 0 ? `
              <h4>企业建议</h4>
              <ul class="recommendations-list">
                ${recommendations.enterprises.map(rec => `<li>${this.escapeAndLinkify(rec, projects)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        ` : ''}
      </section>
    `;
  }

  renderTopProjectsSection(aiInsights, projects) {
    if (!aiInsights || !aiInsights.topProjects || aiInsights.topProjects.length === 0) {
      return '';
    }

    const topProjects = aiInsights.topProjects.slice(0, 3);

    return `
      <section class="top-projects">
        <h2>重点项目推荐</h2>
        <div class="top-projects-grid">
          ${topProjects.map((project, index) => {
            const fullProject = projects.find(p => (p.repo || p.fullName) === project.repo);
            const desc = fullProject?.desc || fullProject?.description || project.reason || '';
            const projectUrl = `https://github.com/${project.repo}`;
            
            return `
              <div class="top-project-card">
                <div class="top-project-header">
                  <a href="${projectUrl}" target="_blank" class="top-project-name">
                    ${index + 1}. ${project.repo}
                  </a>
                  ${project.category ? `<span class="category-badge">${project.category}</span>` : ''}
                </div>
                <div class="top-project-desc">${desc}</div>
                <div class="top-project-reason">
                  <div class="reason-label">入选理由</div>
                  <div class="reason-text">${project.reason}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  renderGroupedProjectsSection(groupedProjects) {
    if (!groupedProjects || Object.keys(groupedProjects).length === 0) {
      return '';
    }

    return `
      <section class="grouped-projects">
        <h2>完整项目列表</h2>
        ${Object.entries(groupedProjects).map(([typeName, typeProjects]) => {
          const typeInfo = this.getTypeInfo(typeName);
          
          return `
            <div class="project-group">
              <h3>${typeInfo.name}（${typeProjects.length}个）</h3>
              <div class="project-list">
                ${typeProjects.map((project, index) => this.renderProjectCard(project, index)).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </section>
    `;
  }

  getTypeInfo(typeName) {
    const typeMap = {
      'agent': { name: 'Agent 系统', icon: '🤖' },
      'llm': { name: 'LLM 工具/框架', icon: '🧠' },
      'speech': { name: '语音处理', icon: '🎤' },
      'general': { name: '通用工具', icon: '🛠️' },
      'vision': { name: '视觉处理', icon: '👁️' },
      'code': { name: '代码工具', icon: '💻' },
      'data': { name: '数据处理', icon: '📊' }
    };
    return typeMap[typeName] || { name: typeName, icon: '📦' };
  }

  groupProjectsByType(projects) {
    const grouped = {};
    projects.forEach(project => {
      const type = project.analysis?.type || project.type || 'general';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(project);
    });
    return grouped;
  }
}

module.exports = HTMLGenerator;
