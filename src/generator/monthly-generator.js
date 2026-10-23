const { writeHtml } = require('../utils/fs');
const { getMonthlyReportPath } = require('../utils/path');
const logger = require('../utils/logger');
const ChartRenderer = require('./chart-renderer');
const { renderMonthlyV3 } = require('./monthly-v3-view-model');

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
    return renderMonthlyV3(data);
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

  hasValue(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
    const text = String(value).trim();
    return text !== '' && text !== '0' && text !== '0%' && text !== 'null' && text !== 'undefined' && text !== 'NaN';
  }

  buildDaysOnListMap(data = {}) {
    const items = data.metrics?.top || data.monthTop || [];
    const map = new Map();
    for (const item of items) {
      if (item && item.fullName && Number.isFinite(item.daysOnList)) {
        map.set(item.fullName, item.daysOnList);
      }
    }
    return map;
  }

  /**
   * 渲染月度概览
   */
  renderOverview(stats = {}, caption = '') {
    const recurring = stats.recurringProjects;
    const newProjects = stats.newProjects;
    const aiProjects = stats.aiProjects;

    const items = [
      { value: stats.totalProjects, label: '总项目数', detail: '日榜去重' },
      { value: recurring, label: '重复上榜', detail: '上榜 ≥2 天' },
      { value: newProjects, label: '月度新星', detail: '30 天内首次进入日榜' },
      { value: aiProjects, label: 'AI 项目', detail: '日榜去重' }
    ].filter(item => this.hasValue(item.value));

    if (items.length === 0) {
      return this.hasValue(caption) ? `<p class="metric-caption">${caption}</p>` : '';
    }

    return `
      <section class="monthly-overview">
        <h2>月度概览</h2>
        <div class="stats-grid">
          ${items.map(stat => `
            <div class="stat-card">
              <div class="stat-value">${stat.value}</div>
              <div class="stat-label">${stat.label}</div>
              <div class="stat-detail">${stat.detail}</div>
            </div>
          `).join('')}
        </div>
        ${this.hasValue(caption) ? `<p class="metric-caption">${caption}</p>` : ''}
      </section>
    `;
  }

  renderMonthlyMetricsSection(data) {
    const prev = data.prevMonthStats || {};
    const stats = data.stats || {};
    const weekThemes = data.weekThemes || [];
    const dropList = data.dropList || [];
    const dropListNote = data.dropListNote;
    const lines = [];

    const compare = [];
    if (this.hasValue(stats.totalProjects) || this.hasValue(prev.projects)) {
      compare.push(`项目数 ${stats.totalProjects ?? '—'}（上月 ${prev.projects ?? '—'}）`);
    }
    if (this.hasValue(stats.newStarsTotal) || this.hasValue(prev.newStarsTotal)) {
      compare.push(`新增星 ${stats.newStarsTotal ?? '—'}（上月 ${prev.newStarsTotal ?? '—'}）`);
    }
    if (this.hasValue(stats.newProjects) || this.hasValue(prev.rookies)) {
      compare.push(`新秀 ${stats.newProjects ?? '—'}（上月 ${prev.rookies ?? '—'}）`);
    }
    if (this.hasValue(stats.top5Share) || this.hasValue(prev.top5Share)) {
      compare.push(`头部集中度 ${stats.top5Share ?? '—'}%（上月 ${prev.top5Share ?? '—'}%）`);
    }
    if (compare.length > 0) {
      lines.push(`<p>较上月：${compare.join('；')}。</p>`);
    }

    const themes = weekThemes
      .filter(item => item && (item.week || item.theme))
      .map(item => `<li>${item.week || ''}（${item.startDate || ''} 起）：${item.theme || '主题未知'}</li>`);
    if (themes.length > 0) {
      lines.push(`<h3>各周主题</h3><ul>${themes.join('')}</ul>`);
    }

    if (dropList.length > 0) {
      const items = dropList.map(item => `${item.fullName}（上月第 ${item.prevRank}，本月${item.currentRank ? `第 ${item.currentRank}` : '未进 Top10'}）`);
      lines.push(`<h3>回落清单</h3><ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`);
    } else {
      lines.push(`<h3>回落清单</h3><p>${dropListNote || '本月无回落'}</p>`);
    }

    return `
      <section class="monthly-metrics">
        <h2>本月与上月</h2>
        ${lines.join('')}
      </section>
    `;
  }

  renderMonthTop(monthTop) {
    if (!Array.isArray(monthTop) || monthTop.length === 0) return '';

    const items = monthTop.filter(item => this.hasValue(item.monthStars) || this.hasValue(item.daysOnList));
    if (items.length === 0) return '';

    return `
      <section class="month-top">
        <h2>月度 TOP（按本月新增星）</h2>
        <div class="project-list">
          ${items.map((item, index) => `
            <div class="project-item">
              <div class="name">
                <a href="https://github.com/${item.fullName}" target="_blank">${index + 1}. ${item.fullName}</a>
              </div>
              <div class="desc">
                ${this.hasValue(item.monthStars) ? `本月新增 ${item.monthStars} 星` : ''}
                ${this.hasValue(item.monthStars) && this.hasValue(item.daysOnList) ? ' · ' : ''}
                ${this.hasValue(item.daysOnList) ? `上榜 ${item.daysOnList} 天` : ''}
              </div>
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

    const oneLiner = this.hasValue(monthlyTheme.oneLiner) ? monthlyTheme.oneLiner : '';
    const detailed = this.hasValue(monthlyTheme.detailed) ? monthlyTheme.detailed : '';
    if (!oneLiner && !detailed) return '';

    return `
      <section class="monthly-theme">
        <h2>月度主题</h2>
        ${oneLiner ? `<div class="theme-one-liner">${oneLiner}</div>` : ''}
        ${detailed ? `<div class="theme-detailed">${detailed}</div>` : ''}
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
   * 渲染 Wiki 追踪模块
   */
  renderWikiTracking(aggregation, daysOnList = new Map()) {
    if (!aggregation) return '';

    const projects = aggregation.recurringProjects || aggregation.topGainers || [];
    const domains = {};

    // 按领域分组
    projects.forEach(p => {
      const domain = p.analysis?.type || p.type || p.domain || 'other';
      if (!domains[domain]) {
        domains[domain] = [];
      }
      domains[domain].push(p);
    });

    // 领域名称映射
    const domainNames = {
      agent: '🤖 Agent 智能体',
      llm: '🧠 LLM 大模型',
      rag: '🔍 RAG 检索增强',
      vision: '👁️ 视觉处理',
      speech: '🎤 语音音频',
      devtools: '🛠️ 开发工具',
      devtool: '🛠️ 开发工具',
      general: '📦 通用工具',
      other: '📦 其他领域'
    };

    return `
      <section class="wiki-tracking">
        <h2>📚 Wiki 知识追踪</h2>
        <div class="wiki-intro">
          本月上榜项目已收录至 <a href="../wiki/index.html" class="wiki-link">AI Project Wiki</a>，点击查看详细版本历史与领域分析
        </div>
        <div class="domain-list">
          ${Object.entries(domains).map(([domain, domainProjects]) => `
            <div class="domain-card">
              <div class="domain-header">
                <h3>${domainNames[domain] || domain}</h3>
                <span class="project-count">${domainProjects.length} 个项目</span>
              </div>
              <div class="domain-projects">
                <ul class="wiki-project-list">
                  ${domainProjects.slice(0, 5).map(p => `
                    <li class="wiki-project-item">
                      <a href="../wiki/projects/${p.repo.replace('/', '_')}.md" class="wiki-project-link">
                        ${p.repo}
                      </a>
                      ${Number.isFinite(daysOnList.get(p.repo))
                        ? `<span class="wiki-appearances">上榜 ${daysOnList.get(p.repo)} 次</span>`
                        : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
              <div class="domain-footer">
                <a href="../wiki/domains/${domain}.md" class="wiki-domain-link">查看 ${domain} 领域 Wiki →</a>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  /**
   * 渲染月度 TOP 项目
   */
  renderLongTermValue(topProjects, monthTop = []) {
    if (!topProjects || topProjects.length === 0) return '';

    const metricByRepo = new Map((monthTop || []).map(item => [item.fullName, item]));

    return `
      <section class="top-projects">
        <h2>月度 TOP 项目</h2>
        ${topProjects.slice(0, 5).map((project, index) => {
          const metric = metricByRepo.get(project.repo) || {};
          const oneSentence = project.oneSentence || project.value || project.description || '';

          return `
          <div class="top-project-card">
            <div class="top-project-header">
              <div>
                <span class="rank">${index + 1}</span>
                <span class="repo-name">
                  <a href="https://github.com/${project.repo}" target="_blank">${project.repo}</a>
                </span>
                ${this.hasValue(project.category) ? `<span class="category">${project.category}</span>` : ''}
              </div>
            </div>
            ${this.hasValue(oneSentence) ? `<div class="description">${oneSentence}</div>` : ''}
            ${project.reasons && project.reasons.length > 0 ? `
              <div class="reasons">
                <h4>入选理由</h4>
                <ul>
                  ${project.reasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            <div class="meta">
              ${this.hasValue(metric.monthStars) ? `<span>本月新增 ${metric.monthStars} 星</span>` : ''}
              ${this.hasValue(metric.daysOnList) ? `<span>上榜 ${metric.daysOnList} 天</span>` : ''}
              ${this.hasValue(project.stars) ? `<span>累计 ${project.stars} 星</span>` : ''}
              ${this.hasValue(project.language) ? `<span>💻 ${project.language}</span>` : ''}
              ${this.hasValue(project.sustainability) ? `<span>持续性：${project.sustainability}</span>` : ''}
            </div>
          </div>
        `;
        }).join('')}
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
    if (!darkHorse || !this.hasValue(darkHorse.repo)) return '';

    return `
      <section class="dark-horse">
        <h2>🦄 月度黑马</h2>
        <div class="dark-horse-card">
          <div class="repo">
            <a href="https://github.com/${darkHorse.repo}" target="_blank" style="color: white;">${darkHorse.repo}</a>
          </div>
          ${this.hasValue(darkHorse.reason) ? `<div class="reason">${darkHorse.reason}</div>` : ''}
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
