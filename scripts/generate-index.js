#!/usr/bin/env node

/**
 * 首页生成脚本
 * 用法：node scripts/generate-index.js
 */

const fs = require('fs');
const path = require('path');

// 工具函数
const utils = require('../src/utils');

async function generateIndex() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 开始生成首页');
  console.log('='.repeat(60));

  try {
    // 步骤 1: 收集所有报告数据
    console.log('📥 步骤 1/3: 收集报告数据...');
    const reportsData = collectReportsData();
    console.log(`   ✅ 收集到 ${reportsData.daily.length} 篇日报，${reportsData.weekly.length} 篇周报，${reportsData.monthly.length} 篇月报\n`);

    // 步骤 2: 生成 HTML
    console.log('🎨 步骤 2/3: 生成 HTML...');
    const html = generateIndexHTML(reportsData);
    const indexPath = path.join(process.cwd(), 'reports', 'index.html');
    fs.writeFileSync(indexPath, html, 'utf-8');
    console.log(`   ✅ HTML 已生成：${indexPath}\n`);

    // 步骤 3: 复制样式文件（如果不存在）
    console.log('📋 步骤 3/3: 检查样式文件...');
    const cssSource = path.join(process.cwd(), 'public', 'css', 'index.css');
    if (!fs.existsSync(cssSource)) {
      console.log('   ⚠️  样式文件不存在，请手动创建 public/css/index.css');
    } else {
      console.log('   ✅ 样式文件已存在\n');
    }

    // 完成
    console.log('='.repeat(60));
    console.log('🎉 首页生成完成！');
    console.log('='.repeat(60));
    console.log(`📄 报告文件：${indexPath}`);
    console.log(`🔗 访问链接：file:///${indexPath.replace(/\\/g, '/')}\n`);

    return {
      success: true,
      indexPath,
      reportCounts: {
        daily: reportsData.daily.length,
        weekly: reportsData.weekly.length,
        monthly: reportsData.monthly.length
      }
    };
  } catch (error) {
    console.error('\n❌ 首页生成失败:', error.message);
    console.error(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 收集所有报告数据
 */
function collectReportsData() {
  const dataDir = path.join(process.cwd(), 'data', 'briefs');
  const reportsData = {
    daily: [],
    weekly: [],
    monthly: []
  };

  // 收集日报数据
  const dailyDir = path.join(dataDir, 'daily');
  if (fs.existsSync(dailyDir)) {
    const dailyFiles = fs.readdirSync(dailyDir)
      .filter(f => f.startsWith('data-') && f.endsWith('.json'))
      .sort();

    dailyFiles.forEach(file => {
      const filePath = path.join(dailyDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // 提取日期
      const dateMatch = file.match(/data-(\d{4}-\d{2}-\d{2})\.json/);
      const date = dateMatch ? dateMatch[1] : data.date;

      // 提取 AI 洞察主题
      const theme = data.aiInsights?.theme || data.aiInsights?.monthlyTheme || '';

      reportsData.daily.push({
        date,
        title: `GitHub AI Trending 日报 - ${date}`,
        type: 'daily',
        projectCount: data.projects?.length || 0,
        aiProjectCount: data.projects?.filter(p => p.isAI).length || 0,
        avgStars: calculateAvgStars(data.projects),
        theme,
        projects: data.projects || []
      });
    });
  }

  // 收集周报数据
  const weeklyDir = path.join(dataDir, 'weekly');
  if (fs.existsSync(weeklyDir)) {
    const weeklyFiles = fs.readdirSync(weeklyDir)
      .filter(f => f.startsWith('data-weekly-') && f.endsWith('.json'))
      .sort();

    weeklyFiles.forEach(file => {
      const filePath = path.join(weeklyDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // 从文件名提取周数（data-weekly-2026-W11.json → 2026-W11）
      const weekMatch = file.match(/data-weekly-(\d{4}-W\d{2})\.json/);
      const week = weekMatch ? weekMatch[1] : (data.week || data.date);

      // 提取 AI 洞察主题（处理对象或字符串）
      const themeInsights = data.aiInsights || {};
      let theme = '';
      if (themeInsights.weeklyTheme) {
        theme = typeof themeInsights.weeklyTheme === 'string'
          ? themeInsights.weeklyTheme
          : (themeInsights.weeklyTheme.oneLiner || themeInsights.weeklyTheme.detailed || '');
      } else if (themeInsights.theme) {
        theme = themeInsights.theme;
      }

      reportsData.weekly.push({
        week,
        date: week,
        title: `GitHub AI Trending 周报 - ${week}`,
        type: 'weekly',
        projectCount: data.projects?.length || 0,
        aiProjectCount: data.projects?.filter(p => p.isAI).length || 0,
        avgStars: calculateAvgStars(data.projects),
        theme,
        projects: data.projects || []
      });
    });
  }

  // 收集月报数据
  const monthlyDir = path.join(dataDir, 'monthly');
  if (fs.existsSync(monthlyDir)) {
    const monthlyFiles = fs.readdirSync(monthlyDir)
      .filter(f => f.startsWith('data-month') && f.endsWith('.json'))
      .sort();

    monthlyFiles.forEach(file => {
      const filePath = path.join(monthlyDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // 提取月份
      const monthMatch = file.match(/data-(?:monthly-)?(\d{4}-\d{2})\.json/);
      const month = monthMatch ? monthMatch[1] : (data.month || data.date);

      // 提取 AI 洞察主题（处理对象或字符串）
      const themeInsights = data.aiInsights || {};
      let theme = '';
      if (themeInsights.monthlyTheme) {
        theme = typeof themeInsights.monthlyTheme === 'string'
          ? themeInsights.monthlyTheme
          : (themeInsights.monthlyTheme.oneLiner || themeInsights.monthlyTheme.detailed || '');
      } else if (themeInsights.weeklyTheme) {
        theme = typeof themeInsights.weeklyTheme === 'string'
          ? themeInsights.weeklyTheme
          : (themeInsights.weeklyTheme.oneLiner || themeInsights.weeklyTheme.detailed || '');
      } else if (themeInsights.theme) {
        theme = themeInsights.theme;
      }

      reportsData.monthly.push({
        month,
        date: month,
        title: `GitHub AI Trending 月报 - ${month}`,
        type: 'monthly',
        projectCount: data.aggregation?.totalProjects || data.projects?.length || 0,
        aiProjectCount: data.aggregation?.aiProjects || data.projects?.filter(p => p.isAI).length || 0,
        avgStars: data.aggregation?.topGainers?.length > 0 || data.projects?.length > 0
          ? calculateAvgStars(data.aggregation?.topGainers || data.projects || [])
          : '0',
        theme,
        projects: data.projects || []
      });
    });
  }

  return reportsData;
}

/**
 * 计算平均 Stars
 */
function calculateAvgStars(projects) {
  if (!projects || projects.length === 0) return '0';

  const total = projects.reduce((sum, p) => {
    const stars = typeof p.stars === 'number' ? p.stars : parseInt(p.stars) || 0;
    return sum + stars;
  }, 0);

  const avg = Math.round(total / projects.length);
  return avg >= 1000 ? `${(avg / 1000).toFixed(1)}k` : avg.toString();
}

/**
 * 构建 Chart.js 数据
 */
function buildChartData(reportsData) {
  // 按日期排序
  const dailyData = [...reportsData.daily].sort((a, b) => a.date.localeCompare(b.date));

  // 提取标签
  const labels = dailyData.map(d => d.date.slice(5)); // "2026-03-28" -> "03-28"

  // 选项：新增项目数
  const projectsData = dailyData.map(d => d.projectCount);

  // 选项：星数增长（总星数）
  const starsData = dailyData.map(d => {
    const projects = d.projects || [];
    return projects.reduce((sum, p) => {
      const stars = typeof p.stars === 'number' ? p.stars : parseInt(p.stars) || 0;
      return sum + stars;
    }, 0);
  });

  // 选项：AI 占比
  const aiRatioData = dailyData.map(d => {
    const projects = d.projects || [];
    if (projects.length === 0) return 0;
    const aiCount = projects.filter(p => p.isAI).length;
    return Math.round((aiCount / projects.length) * 100);
  });

  return {
    labels,
    datasets: {
      projects: {
        label: '新增项目',
        data: projectsData,
        borderColor: '#3fb950',
        backgroundColor: 'rgba(63, 185, 80, 0.1)',
        tension: 0.4,
        fill: true
      },
      stars: {
        label: '星数总量',
        data: starsData,
        borderColor: '#58a6ff',
        backgroundColor: 'rgba(88, 166, 255, 0.1)',
        tension: 0.4,
        fill: true
      },
      'ai-ratio': {
        label: 'AI 占比',
        data: aiRatioData,
        borderColor: '#d29922',
        backgroundColor: 'rgba(210, 153, 34, 0.1)',
        tension: 0.4,
        fill: true
      }
    },
    switchers: [
      { id: 'projects', label: '新增项目数', yMin: 0 },
      { id: 'stars', label: '星数总量', yMin: 0 },
      { id: 'ai-ratio', label: 'AI 占比 (%)', yMin: 0, yMax: 100 }
    ]
  };
}

/**
 * 构建统计数据
 */
function buildStats(reportsData, allProjects) {
  const totalReports = reportsData.daily.length + reportsData.weekly.length + reportsData.monthly.length;
  const totalProjects = allProjects.length;
  const aiProjects = allProjects.filter(p => p.isAI).length;
  const aiPercentage = totalProjects > 0 ? Math.round((aiProjects / totalProjects) * 100) : 0;
  const avgStarsAll = allProjects.length > 0 ? calculateAvgStars(allProjects) : '0';

  return [
    { label: '📅 累计日报', value: reportsData.daily.length, detail: '每日更新' },
    { label: '📊 累计周报', value: reportsData.weekly.length, detail: '每周汇总' },
    { label: '📈 累计月报', value: reportsData.monthly.length, detail: '月度深度' },
    { label: '🔍 追踪项目', value: totalProjects, detail: `AI: ${aiProjects} 个` },
    {
      label: '🤖 AI 占比',
      value: `${aiPercentage}%`,
      detail: `追踪中`
    },
    {
      label: '⭐ 平均 Stars',
      value: avgStarsAll,
      detail: '综合平均'
    }
  ];
}

/**
 * 构建最新报告卡片数据
 */
function buildLatestReports(reportsData) {
  const latestDaily = reportsData.daily[reportsData.daily.length - 1];
  const latestWeekly = reportsData.weekly[reportsData.weekly.length - 1];
  const latestMonthly = reportsData.monthly[reportsData.monthly.length - 1];

  const cards = [];

  if (latestDaily) {
    cards.push({
      type: 'daily',
      icon: '📅',
      title: '最新日报',
      date: latestDaily.date,
      stats: {
        total: latestDaily.projectCount,
        ai: latestDaily.aiProjectCount,
        avgStars: latestDaily.avgStars
      },
      url: `daily/github-ai-trending-${latestDaily.date}.html`,
      theme: latestDaily.theme
    });
  }

  if (latestWeekly) {
    cards.push({
      type: 'weekly',
      icon: '📊',
      title: '最新周报',
      date: latestWeekly.week,
      stats: {
        total: latestWeekly.projectCount,
        avgStars: latestWeekly.avgStars
      },
      url: `weekly/github-weekly-${latestWeekly.week}.html`,
      theme: latestWeekly.theme
    });
  }

  if (latestMonthly) {
    cards.push({
      type: 'monthly',
      icon: '📈',
      title: '最新月报',
      date: latestMonthly.month,
      stats: {
        total: latestMonthly.projectCount,
        avgStars: latestMonthly.avgStars
      },
      url: `monthly/github-monthly-${latestMonthly.month}.html`,
      theme: latestMonthly.theme
    });
  }

  return cards;
}

/**
 * 构建 Top 5 热榜数据
 */
function buildTopProjects(allProjects) {
  // 去重（按 repo 名称）
  const uniqueProjects = Array.from(
    new Map(allProjects.map(p => [p.repo, p])).values()
  );

  // 按 Stars 排序，取 Top 5
  const topProjects = uniqueProjects
    .sort((a, b) => ((b.stars || 0) - (a.stars || 0)))
    .slice(0, 5);

  return topProjects.map((p, index) => ({
    rank: index + 1,
    fullName: p.fullName || p.repo,
    url: p.url,
    starsDisplay: p.stars >= 1000 ? `${(p.stars / 1000).toFixed(1)}k` : p.stars.toString(),
    desc: p.descZh || p.desc || '暂无描述',
    analysis: p.analysis || {},
    language: p.language || 'Unknown'
  }));
}

/**
 * 构建报告存档数据
 */
function buildArchives(reportsData) {
  const archives = [
    {
      title: '📅 日报存档',
      items: reportsData.daily.slice(-14).reverse().map(d => ({
        date: d.date,
        url: `daily/github-ai-trending-${d.date}.html`,
        count: d.projectCount
      }))
    },
    {
      title: '📊 周报存档',
      items: reportsData.weekly.slice(-6).reverse().map(w => ({
        date: w.week,
        url: `weekly/github-weekly-${w.week}.html`,
        count: w.projectCount
      }))
    },
    {
      title: '📈 月报存档',
      items: reportsData.monthly.slice(-6).reverse().map(m => ({
        date: m.month,
        url: `monthly/github-monthly-${m.month}.html`,
        count: m.projectCount
      }))
    }
  ];

  return archives;
}

/**
 * 生成首页 HTML
 */
function generateIndexHTML(reportsData) {
  // 合并所有项目用于 Top 5 和统计
  const allProjects = [
    ...reportsData.daily.flatMap(d => d.projects || []),
    ...reportsData.weekly.flatMap(w => w.projects || []),
    ...reportsData.monthly.flatMap(m => m.projects || [])
  ];

  // 构建各种数据
  const chartData = buildChartData(reportsData);
  const stats = buildStats(reportsData, allProjects);
  const latestReports = buildLatestReports(reportsData);
  const topProjects = buildTopProjects(allProjects);
  const archives = buildArchives(reportsData);

  // 生成 Chart.js 数据 JSON
  const chartDataJson = JSON.stringify(chartData, null, 2);

  // 生成统计卡片 HTML
  const statsHTML = stats.map(stat => `
        <div class="stat-card">
          <div class="stat-value">${stat.value}</div>
          <div class="stat-label">${stat.label}</div>
          ${stat.detail ? `<div class="stat-detail">${stat.detail}</div>` : ''}
        </div>`).join('');

  // 生成最新报告卡片 HTML
  const reportCardsHTML = latestReports.map(card => `
        <div class="report-card ${card.type}">
          <div class="report-card-header">
            <h3><span class="icon">${card.icon}</span>${card.title}</h3>
            <span class="report-date">${card.date}</span>
          </div>
          <div class="report-card-stats">
            <span class="stat">${card.stats.total} 个项目</span>
            ${card.stats.ai ? `<span class="stat">${card.stats.ai} AI 项目</span>` : ''}
            <span class="stat">⭐ ${card.stats.avgStars}</span>
          </div>
          ${card.theme ? `<div class="report-card-theme">${card.theme}</div>` : ''}
          <a href="${card.url}" class="report-card-btn">查看详情</a>
        </div>`).join('');

  // 生成Chart tabs HTML
  const chartTabsHTML = chartData.switchers.map((s, i) => `
          <button class="chart-tab ${i === 0 ? 'active' : ''}" data-chart="${s.id}">
            ${s.label}
          </button>`).join('');

  // 生成 Top 5 热榜 HTML
  const topProjectsHTML = topProjects.map(p => `
        <div class="top-project-card">
          <div class="top-project-rank">#${p.rank}</div>
          <a href="${p.url}" class="top-project-name" target="_blank">${p.fullName}</a>
          <div class="top-project-stars">⭐ ${p.starsDisplay}</div>
          <div class="top-project-desc">${p.desc}</div>
          <div class="top-project-tags">
            <span class="tag">${p.analysis.typeName || '其他'}</span>
            <span class="tag">${p.language}</span>
          </div>
        </div>`).join('');

  // 生成存档 HTML
  const archivesHTML = archives.map(archive => `
        <div class="archive-tab">
          <span class="archive-type">${archive.title}</span>
          <ul>
            ${archive.items.map(item => `
              <li>
                <a href="${item.url}" target="_blank">${item.date}</a>
                <span class="archive-count">${item.count} 个项目</span>
              </li>`).join('')}
          </ul>
        </div>`).join('');

  const latestDailyUrl = latestReports.find(r => r.type === 'daily')?.url || '#';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub AI Trending 洞察系统</title>
  <link rel="stylesheet" href="../public/css/index.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
  <div class="container">
    <!-- 1. 头部区域 -->
    <header>
      <h1>🚀 GitHub AI Trending 洞察系统</h1>
      <p class="subtitle">每日/每周/每月 AI 项目趋势追踪</p>
      <p class="last-update">最后更新：${new Date().toLocaleString('zh-CN')}</p>
    </header>

    <!-- 2. 系统状态卡片 -->
    <section class="system-status">
      <h2 class="sr-only">系统状态</h2>
      <div class="status-grid">
        ${statsHTML}
      </div>
    </section>

    <!-- 3. 最新报告卡片 -->
    <section class="latest-reports">
      <h2>🆕 最新报告</h2>
      <div class="report-cards">
        ${reportCardsHTML}
      </div>
    </section>

    <!-- 4. 可交互图表 -->
    <section class="trends-chart">
      <div class="chart-header">
        <h2>📈 实时趋势</h2>
        <div class="chart-tabs" role="tablist">
          ${chartTabsHTML}
        </div>
      </div>
      <div class="chart-container">
        <canvas id="trendChart"></canvas>
      </div>
    </section>

    <!-- 5. Top 5 热榜项目 -->
    <section class="top-projects">
      <h2>🔥 Top 5 热榜项目</h2>
      <div class="top-projects-grid">
        ${topProjectsHTML}
      </div>
      <a href="${latestDailyUrl}" class="view-all-btn">查看完整榜单 →</a>
    </section>

    <!-- 6. 报告存档（折叠面板） -->
    <section class="archive-section">
      <h2>
        📁 报告存档
        <button class="toggle-btn" aria-expanded="false">
          展开全部 →
        </button>
      </h2>
      <div class="archive-content" hidden>
        ${archivesHTML}
      </div>
    </section>

    <!-- 7. 底部 -->
    <footer>
      <p>由 AI 自动生成 · 数据来源 GitHub Trending API</p>
      <p>最后更新：${new Date().toLocaleString('zh-CN')}</p>
    </footer>
  </div>

  <script>
    // ========== Chart.js 初始化 ==========
    const chartData = ${JSON.stringify(chartData, null, 2)};

    // Chart 配置
    const chartConfig = {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [ chartData.datasets[chartData.switchers[0].id] ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: 'var(--text-primary)',
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(22, 27, 34, 0.95)',
            titleColor: '#c9d1d9',
            bodyColor: '#c9d1d9',
            borderColor: '#30363d',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            ticks: { color: '#8b949e' },
            grid: { color: '#21262d' },
            border: { color: '#30363d' }
          },
          y: {
            ticks: { color: '#8b949e' },
            grid: { color: '#21262d' },
            border: { color: '#30363d' }
          }
        }
      }
    };

    // 初始化图表
    const ctx = document.getElementById('trendChart');
    const trendChart = new Chart(ctx, chartConfig);

    // 切换图表数据
    document.querySelectorAll('.chart-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // 更新 active 状态
        document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // 切换数据
        const chartId = tab.dataset.chart;
        trendChart.data.datasets = [chartData.datasets[chartId]];
        trendChart.update();
      });
    });

    // ========== 折叠面板交互 ==========
    const toggleBtn = document.querySelector('.toggle-btn');
    const archiveContent = document.querySelector('.archive-content');

    toggleBtn.addEventListener('click', () => {
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', !expanded);
      toggleBtn.textContent = expanded ? '展开全部 →' : '收起 ←';
      archiveContent.hidden = expanded;
    });
  </script>
</body>
</html>`;
}

/**
 * 获取周号（辅助函数）
 */
function getWeekNumber(dateStr) {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

// 执行生成
generateIndex()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 未处理的错误:', error);
    process.exit(1);
  });
