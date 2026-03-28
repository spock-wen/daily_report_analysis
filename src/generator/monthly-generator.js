const { writeHtml } = require('../utils/fs');
const { getMonthlyReportPath } = require('../utils/path');
const logger = require('../utils/logger');
const ChartRenderer = require('./chart-renderer');

/**
 * 月度报告 HTML 生成器
 * 文件：src/generator/monthly-generator.js
 */
class MonthlyGenerator {
  constructor() {
    this.chartRenderer = new ChartRenderer();
  }

  /**
   * 生成月度报告 HTML
   * @param {Object} monthlyData - 月度聚合数据
   * @returns {Promise<string>} HTML 文件路径
   */
  async generate(monthlyData) {
    try {
      logger.info('生成月报 HTML...', { month: monthlyData.month });

      const html = this.renderMonthlyHTML(monthlyData);
      const filePath = getMonthlyReportPath(monthlyData.month);

      await writeHtml(filePath, html);

      logger.success(`月报 HTML 已生成：${filePath}`);
      return filePath;
    } catch (error) {
      logger.error(`生成月报 HTML 失败：${error.message}`, {
        month: monthlyData.month,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 渲染月度报告 HTML
   */
  renderMonthlyHTML(data) {
    const { month, aggregation, aiInsights } = data;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub AI 月度趋势报告 - ${month}</title>
  <link rel="stylesheet" href="../../public/css/style.css">
  <link rel="stylesheet" href="../../public/css/monthly.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
  <div class="container monthly-report">
    ${this.renderHeader(month)}
    ${this.renderOverview(aggregation)}
    ${this.renderTheme(aiInsights?.monthlyTheme)}
    ${this.renderTrendEvolution(aiInsights?.trendEvolution)}
    ${this.renderCharts(aggregation)}
    ${this.renderLongTermValue(aiInsights?.longTermValue)}
    ${this.renderEmergingFields(aiInsights?.emergingFields)}
    ${this.renderDarkHorse(aiInsights?.darkHorse)}
    ${this.renderNextMonthForecast(aiInsights?.nextMonthForecast)}
    ${this.renderFullProjectList(aggregation)}
  </div>
</body>
</html>`;
  }

  /**
   * 渲染报告头部
   */
  renderHeader(month) {
    return `
      <header class="monthly-header">
        <h1>GitHub AI 月度趋势报告</h1>
        <div class="month">${month}</div>
        <div class="subtitle">深度分析 · 趋势洞察 · 生态全景</div>
      </header>
    `;
  }

  /**
   * 渲染月度概览
   */
  renderOverview(aggregation) {
    const stats = [
      { value: aggregation?.totalProjects || 0, label: '总项目数', detail: '去重后' },
      { value: aggregation?.recurringProjects?.length || 0, label: '重复上榜', detail: '≥2 次' },
      { value: aggregation?.newProjects?.length || 0, label: '月度新星', detail: '首次出现' },
      { value: Object.values(aggregation?.typeDistribution || {}).reduce((a, b) => a + b, 0), label: 'AI 项目', detail: '含 Agent/LLM 等' }
    ];

    return `
      <section class="monthly-overview">
        <h2>月度概览</h2>
        <div class="stats-grid">
          ${stats.map(stat => `
            <div class="stat-card">
              <div class="stat-value">${stat.value}</div>
              <div class="stat-label">${stat.label}</div>
              <div class="stat-detail">${stat.detail}</div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  /**
   * 渲染月度主题
   */
  renderTheme(monthlyTheme) {
    if (!monthlyTheme) return '';

    return `
      <section class="monthly-theme">
        <h2>月度主题</h2>
        <div class="theme-one-liner">${monthlyTheme.oneLiner || '暂无数据'}</div>
        <div class="theme-detailed">${monthlyTheme.detailed || '暂无详细分析'}</div>
      </section>
    `;
  }

  /**
   * 渲染趋势演变
   */
  renderTrendEvolution(trendEvolution) {
    if (!trendEvolution || trendEvolution.length === 0) return '';

    return `
      <section class="trend-evolution">
        <h2>趋势演变</h2>
        <div class="timeline">
          ${trendEvolution.map((item, index) => `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <h3>${item.period}</h3>
                <div class="dates">${item.dates || ''}</div>
                <div class="theme">${item.theme || item.topType || ''}</div>
                <div class="analysis">${item.analysis || '暂无分析'}</div>
                ${item.keyProjects && item.keyProjects.length > 0 ? `
                  <div class="key-projects">
                    <h4>关键项目</h4>
                    <ul>
                      ${item.keyProjects.map(p => `<li><a href="https://github.com/${p}" target="_blank" class="repo-link">${p}</a></li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  /**
   * 渲染数据可视化图表
   */
  renderCharts(aggregation) {
    // 领域分布饼图
    const typeLabels = Object.keys(aggregation?.typeDistribution || {});
    const typeValues = Object.values(aggregation?.typeDistribution || {});

    // 语言分布柱状图
    const langLabels = Object.keys(aggregation?.languageDistribution || {});
    const langValues = Object.values(aggregation?.languageDistribution || {});

    return `
      <section class="data-visualization">
        <h2>数据可视化</h2>
        <div class="charts-grid">
          <div class="chart-container">
            <h4 class="chart-title">领域分布</h4>
            ${this.chartRenderer.renderPieChart('typeChart', {
              labels: typeLabels,
              values: typeValues
            }, {
              legendPosition: 'bottom'
            })}
          </div>
          <div class="chart-container">
            <h4 class="chart-title">语言分布 TOP5</h4>
            ${this.chartRenderer.renderBarChart('languageChart', {
              labels: langLabels,
              values: langValues
            }, {
              showLegend: false
            })}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * 渲染月度 TOP 项目
   */
  renderLongTermValue(topProjects) {
    if (!topProjects || topProjects.length === 0) return '';

    return `
      <section class="top-projects">
        <h2>月度 TOP 项目</h2>
        ${topProjects.slice(0, 5).map((project, index) => `
          <div class="top-project-card">
            <div class="top-project-header">
              <div>
                <span class="rank">${index + 1}</span>
                <span class="repo-name">
                  <a href="https://github.com/${project.repo}" target="_blank">${project.repo}</a>
                </span>
                <span class="category">${project.category || '技术创新'}</span>
              </div>
              <span class="score">${project.score || 0}</span>
            </div>
            <div class="description">${project.value || project.description || ''}</div>
            ${project.reasons && project.reasons.length > 0 ? `
              <div class="reasons">
                <h4>入选理由</h4>
                <ul>
                  ${project.reasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            <div class="meta">
              ${project.stars ? `<span>⭐ ${project.stars}</span>` : ''}
              ${project.language ? `<span>💻 ${project.language}</span>` : ''}
              ${project.sustainability ? `<span>持续性：${project.sustainability}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </section>
    `;
  }

  /**
   * 渲染新兴领域
   */
  renderEmergingFields(emergingFields) {
    if (!emergingFields || emergingFields.length === 0) return '';

    return `
      <section class="emerging-fields">
        <h2>新兴领域</h2>
        ${emergingFields.map(field => `
          <div class="field-card">
            <h3>${field.field}</h3>
            <div class="description">${field.description || ''}</div>
            ${field.trend ? `<span class="trend ${field.trend}">${field.trend}</span>` : ''}
            ${field.projects && field.projects.length > 0 ? `
              <div class="projects">
                <h4>代表项目</h4>
                <ul>
                  ${field.projects.map(p => `<li><a href="https://github.com/${p}" target="_blank" class="repo-link">${p}</a></li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </section>
    `;
  }

  /**
   * 渲染月度黑马
   */
  renderDarkHorse(darkHorse) {
    if (!darkHorse) return '';

    return `
      <section class="dark-horse">
        <h2>🦄 月度黑马</h2>
        <div class="dark-horse-card">
          <div class="repo">
            <a href="https://github.com/${darkHorse.repo}" target="_blank" style="color: white;">${darkHorse.repo}</a>
          </div>
          <div class="reason">${darkHorse.reason || '暂无描述'}</div>
        </div>
      </section>
    `;
  }

  /**
   * 渲染下月预测
   */
  renderNextMonthForecast(forecast) {
    if (!forecast) return '';

    return `
      <section class="next-month-forecast">
        <h2>🔮 下月预测</h2>
        <div class="forecast-content">${forecast}</div>
      </section>
    `;
  }

  /**
   * 渲染完整项目列表
   */
  renderFullProjectList(aggregation) {
    const allProjects = [
      ...(aggregation?.topGainers || []),
      ...(aggregation?.recurringProjects || []).filter(p => !aggregation.topGainers?.find(g => g.repo === p.repo))
    ].slice(0, 50); // 限制显示数量

    // 按类型分组
    const typeGroups = {};
    allProjects.forEach(project => {
      const type = project.type || this.detectType(project);
      if (!typeGroups[type]) {
        typeGroups[type] = [];
      }
      typeGroups[type].push(project);
    });

    return `
      <section class="full-project-list">
        <h2>完整项目列表</h2>
        ${Object.entries(typeGroups).map(([type, projects]) => `
          <div class="type-group">
            <h3>${this.getTypeName(type)}</h3>
            <div class="project-list">
              ${projects.map(p => {
                // 处理描述：优先中文，其次英文，最后显示提示
                let descText = p.descZh || p.description || '';
                const hasChineseDesc = !!(p.descZh);
                const hasEnglishDesc = !!(p.description);
                const showTranslateTip = hasEnglishDesc && !hasChineseDesc;

                if (!descText) {
                  descText = '<span style="color: var(--text-muted); font-style: italic;">暂无描述</span>';
                } else if (showTranslateTip) {
                  descText = `<span title="${descText}">${descText.substring(0, 80)}${descText.length > 80 ? '...' : ''}</span>`;
                }

                return `
                <div class="project-item">
                  <div class="name">
                    <a href="https://github.com/${p.repo}" target="_blank">${p.repo}</a>
                  </div>
                  <div class="desc">${descText}</div>
                </div>
              `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </section>
    `;
  }

  /**
   * 检测项目类型
   */
  detectType(project) {
    const desc = (project.description || '').toLowerCase();
    const name = (project.repo || '').toLowerCase();
    const text = `${desc} ${name}`;

    if (text.includes('agent') || text.includes('autonomous')) return 'agent';
    if (text.includes('llm') || text.includes('language model')) return 'llm';
    if (text.includes('vision') || text.includes('image')) return 'vision';
    if (text.includes('speech') || text.includes('audio')) return 'speech';
    if (text.includes('dev') || text.includes('tool')) return 'devtools';
    return 'other';
  }

  /**
   * 获取类型名称
   */
  getTypeName(type) {
    const names = {
      agent: '🤖 Agent 智能体',
      llm: '🧠 LLM 大模型',
      vision: '👁️ 视觉处理',
      speech: '🎤 语音音频',
      devtools: '🛠️ 开发工具',
      other: '📦 其他'
    };
    return names[type] || type;
  }
}

module.exports = MonthlyGenerator;
