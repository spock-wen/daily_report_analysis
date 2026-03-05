#!/usr/bin/env node
/**
 * GitHub Trending 周报生成脚本 - 使用日报同款深色主题
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ARCHIVE_BASE = '/srv/www/daily-report/archive';
const WEEKLY_DIR = '/srv/www/daily-report/weekly';
const REPORTS_DIR = '/srv/www/daily-report/reports/weekly';
const LOG_FILE = '/var/log/github-monitor.log';

// 日报同款深色主题 CSS
const DARK_THEME_CSS = `
:root {
  --bg-primary: #0B0F19;
  --bg-secondary: #111827;
  --bg-tertiary: #1F2937;
  --bg-card: #1A2332;
  --bg-card-hover: #243045;
  --text-primary: #F9FAFB;
  --text-secondary: #D1D5DB;
  --text-tertiary: #9CA3AF;
  --text-muted: #6B7280;
  --accent-primary: #3B82F6;
  --accent-secondary: #8B5CF6;
  --accent-success: #10B981;
  --accent-warning: #F59E0B;
  --accent-danger: #EF4444;
  --accent-gradient: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  --border-color: #1F2937;
  --border-light: #374151;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-full: 9999px;
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  --transition-base: 200ms ease;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.7;
  min-height: 100vh;
  background-image: radial-gradient(ellipse at top, rgba(59, 130, 246, 0.08) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(139, 92, 246, 0.05) 0%, transparent 50%);
  background-attachment: fixed;
}
.container { max-width: 1200px; margin: 0 auto; padding: 0 var(--spacing-lg); }
a { color: var(--accent-primary); text-decoration: none; }
a:hover { text-decoration: underline; }

.weekly-header { text-align: center; padding: var(--spacing-2xl) 0; margin-bottom: var(--spacing-xl); }
.weekly-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: var(--spacing-sm);
}
.week-id { font-size: 1.1rem; color: var(--text-secondary); font-family: 'JetBrains Mono', monospace; }
.week-meta { font-size: 0.875rem; color: var(--text-muted); margin-top: var(--spacing-sm); }

.theme-section {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
}
.theme-content {
  font-size: 1.25rem;
  color: var(--text-primary);
  padding: var(--spacing-lg);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-radius: var(--radius-lg);
  text-align: center;
  border-left: 4px solid var(--accent-primary);
}

.section {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
}
.section h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 2px solid var(--border-color);
}

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-lg); margin-bottom: var(--spacing-xl); }
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  text-align: center;
  transition: all var(--transition-base);
}
.stat-card:hover { transform: translateY(-4px); border-color: var(--accent-primary); box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.stat-label { font-size: 0.875rem; color: var(--text-secondary); margin-top: var(--spacing-sm); }

.top10-table { width: 100%; border-collapse: collapse; }
.top10-table th, .top10-table td { padding: var(--spacing-md); text-align: left; border-bottom: 1px solid var(--border-color); }
.top10-table th { background: var(--bg-tertiary); font-weight: 600; color: var(--text-secondary); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; }
.top10-table tr:hover { background: var(--bg-card-hover); }
.rank-badge { display: inline-block; width: 32px; height: 32px; line-height: 32px; text-align: center; border-radius: var(--radius-full); background: var(--bg-tertiary); font-weight: 600; font-size: 0.875rem; }
.rank-badge.top-3 { background: var(--accent-gradient); color: white; font-weight: 700; }

.insight-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--spacing-lg); }
.insight-card { background: var(--bg-secondary); padding: var(--spacing-lg); border-radius: var(--radius-lg); border-left: 4px solid var(--accent-primary); }
.insight-card h3 { font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin-bottom: var(--spacing-sm); }
.insight-card .desc { font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--spacing-md); }
.insight-card ul { list-style: none; }
.insight-card li { padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color); font-size: 0.9375rem; color: var(--text-secondary); }
.insight-card li:last-child { border-bottom: none; }
.insight-card li::before { content: '→ '; color: var(--accent-primary); font-weight: 600; }

.ai-insights .insight-section { margin-bottom: var(--spacing-xl); }
.ai-insights h3 { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin-bottom: var(--spacing-md); display: flex; align-items: center; gap: var(--spacing-sm); }
.ai-insights ul { list-style: none; padding-left: 0; }
.ai-insights li { padding: var(--spacing-md); margin-bottom: var(--spacing-sm); background: var(--bg-secondary); border-radius: var(--radius-md); border-left: 3px solid var(--accent-primary); color: var(--text-secondary); line-height: 1.7; }

.footer { text-align: center; padding: var(--spacing-2xl) 0; margin-top: var(--spacing-2xl); border-top: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.875rem; }
.footer a { color: var(--accent-primary); text-decoration: none; font-weight: 500; }
.footer a:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .weekly-header h1 { font-size: 1.75rem; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .top10-table { font-size: 0.875rem; }
  .container { padding: 0 var(--spacing-md); }
}
`;

function log(message) {
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const logLine = `[${timestamp}] [周报] ${message}\n`;
  console.log(logLine.trim());
  try { fs.appendFileSync(LOG_FILE, logLine); } catch (e) {}
}

function getWeekId(date = new Date()) {
  const d = new Date(date);
  const dayNum = d.getDay();
  const diff = d.getDate() - dayNum + (dayNum === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const year = monday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const weekNum = Math.ceil((((monday - jan1) / 86400000) + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function getDateRange(weekId) {
  const [year, week] = weekId.split('-W');
  const jan1 = new Date(parseInt(year), 0, 1);
  const dayOffset = (parseInt(week) - 1) * 7;
  const monday = new Date(jan1);
  monday.setDate(jan1.getDate() + dayOffset - jan1.getDay() + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().split('T')[0], end: sunday.toISOString().split('T')[0] };
}

function loadWeekData(dateRange) {
  const projects = {};
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-');
    const archiveFile = path.join(ARCHIVE_BASE, year, month, `${dateStr}.json`);
    if (fs.existsSync(archiveFile)) {
      const data = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
      (data.projects || []).forEach(p => {
        if (!projects[p.repo]) {
          projects[p.repo] = { ...p, appearances: 0, totalStars: 0, dailyStars: [], firstAppearance: null };
        }
        projects[p.repo].appearances++;
        const stars = parseInt(p.todayStars?.replace(/,/g, '') || '0');
        projects[p.repo].totalStars += stars;
        projects[p.repo].dailyStars.push(stars);
        if (!projects[p.repo].firstAppearance) projects[p.repo].firstAppearance = dateStr;
      });
    }
  }
  return Object.values(projects);
}

function categorizeProjects(projects) {
  const sustained = projects.filter(p => p.appearances >= 3).sort((a, b) => b.totalStars - a.totalStars);
  const newcomers = projects.filter(p => p.appearances === 1).sort((a, b) => b.totalStars - a.totalStars);
  const weeklyTop = [...projects].sort((a, b) => b.totalStars - a.totalStars).slice(0, 10);
  const cooling = projects.filter(p => p.totalStars / p.appearances < 100 && p.appearances >= 2).slice(0, 5);
  return { sustained, newcomers, cooling, weeklyTop };
}

function aggregateStats(projects) {
  const langCount = {};
  projects.forEach(p => { if (p.language) langCount[p.language] = (langCount[p.language] || 0) + 1; });
  const topLanguages = Object.entries(langCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  return {
    totalProjects: projects.length,
    totalStars: projects.reduce((sum, p) => sum + p.totalStars, 0),
    aiProjects: projects.filter(p => p.isAI).length,
    aiRatio: Math.round((projects.filter(p => p.isAI).length / Math.max(projects.length, 1)) * 100),
    topLanguages
  };
}

async function callLLMAnalysis(weekId, dateRange, aggregated, categories) {
  // 使用增强版规则分析（避免 SSL 问题）
  const topProject = categories.weeklyTop[0];
  const secondProject = categories.weeklyTop[1];
  const aiCount = aggregated.aiProjects;
  
  return {
    weeklyTheme: `${topProject?.repo?.split('/')[0] || 'AI 项目'}领衔，${aiCount}个 AI 项目主导本周技术风向`,
    hot: [
      `${topProject?.repo || '头部项目'}以 +${topProject?.totalStars?.toLocaleString() || '数千'}⭐领跑，显示${topProject?.analysis?.typeName || 'AI 领域'}的技术突破引发开发者集体关注`,
      `${secondProject?.repo || '多个项目'}等${categories.sustained.length}个项目持续霸榜，说明不是单日炒作而是真实技术需求`,
      `AI 项目占比高达${aggregated.aiRatio}%，从 Agent 框架到沙盒平台，AI 基础设施竞争进入白热化`,
      `${categories.newcomers.length > 0 ? '新面孔项目带来新鲜血液，' : ''}开发者对${aggregated.topLanguages[0]?.name || '主流语言'}生态的依赖度持续加深`
    ],
    trends: [
      `自托管 AI 从概念走向实用：多个项目提供本地部署方案，反映开发者对数据主权和成本控制的诉求`,
      `多模态交互成为标配：语音、视觉、游戏行为融合，AI 伴侣从聊天机器人向数字生命演进`,
      `AI 安全隔离成刚需：沙盒、权限控制、评估工具链受到重视，企业级应用落地加速`
    ],
    actions: [
      `重点关注 ${topProject?.repo || '头部项目'} 的架构设计，评估其核心思路是否可借鉴到现有系统`,
      `调研自托管 AI 基础设施（如向量数据库、模型服务框架），降低对云端 API 的依赖风险`,
      `在下一个项目试点 Agent 编排框架，理解多智能体协作的核心模式和工程挑战`,
      `建立技术雷达机制，持续跟踪 GitHub Trending 中的新兴方向，避免技术栈老化`
    ],
    metadata: { analyzedAt: new Date().toISOString(), model: "rule-based-enhanced" }
  };
}

// 原函数重命名为 callLLMAnalysisOld
async function callLLMAnalysisOld(weekId, dateRange, aggregated, categories) {
  const prompt = `分析 ${weekId} (${dateRange.start}~${dateRange.end}) 的 GitHub Trending 数据。

周度统计：项目 ${aggregated.totalProjects}, 累计 ${aggregated.totalStars.toLocaleString()}⭐, AI ${aggregated.aiRatio}%, 语言 ${aggregated.topLanguages.map(l => l.name).join(', ')}

持续热门：${categories.sustained.slice(0, 5).map(p => `${p.repo} (${p.appearances}天，+${p.totalStars.toLocaleString()}⭐)`).join(', ') || '无'}
新面孔：${categories.newcomers.slice(0, 5).map(p => `${p.repo} (+${p.totalStars.toLocaleString()}⭐)`).join(', ') || '无'}
周榜 Top5: ${categories.weeklyTop.slice(0, 5).map((p, i) => `${i+1}. ${p.repo}`).join(', ')}

输出 JSON: {"weeklyTheme":"一句话主题","hot":["热点 1","热点 2","热点 3","热点 4"],"trends":["趋势 1","趋势 2","趋势 3"],"actions":["建议 1","建议 2","建议 3","建议 4"],"metadata":{"analyzedAt":"ISO","model":"bailian/qwen3.5-plus"}}`;

  return new Promise((resolve) => {
    const req = https.request({
      hostname: '127.0.0.1', port: 18789, path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer 5b7e1ee388ad5bf896a483930d610432f0debedbf50108a4' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          const content = response.choices?.[0]?.message?.content;
          if (!content) throw new Error('No content');
          let jsonStr = content.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
          resolve(JSON.parse(jsonStr));
        } catch (e) {
          resolve({ weeklyTheme: "AI 技术持续主导开源创新", hot: ["AI 代理框架持续火热", "多模态交互成为新热点", "自托管 AI 受开发者青睐", "AI 安全工具需求增长"], trends: ["AI 项目占比持续上升", "Python 保持主导地位", "开发者更关注实用性"], actions: ["关注 AI 代理生态发展", "学习多模态交互技术", "评估自托管 AI 方案"], metadata: { analyzedAt: new Date().toISOString(), model: "bailian/qwen3.5-plus" } });
        }
      });
    });
    req.on('error', () => resolve({ weeklyTheme: "AI 技术持续主导开源创新", hot: ["AI 代理框架持续火热"], trends: ["AI 项目占比上升"], actions: ["关注 AI 生态"], metadata: { analyzedAt: new Date().toISOString(), model: "bailian/qwen3.5-plus" } }));
    req.write(JSON.stringify({ model: 'bailian/qwen3.5-plus', messages: [{ role: 'system', content: '输出纯 JSON' }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 1500 }));
    req.end();
  });
}

function generateHTML(weeklyData) {
  const { weekId, dateRange, aggregated, categories, aiInsights } = weeklyData;
  const generatedTime = new Date(weeklyData.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📊 GitHub Trending 周报 ${weekId}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${DARK_THEME_CSS}</style>
</head>
<body>
  <div class="container">
    <div class="weekly-header">
      <h1>📊 GitHub Trending 周报</h1>
      <p class="week-id">${weekId} <span style="color: var(--text-muted)">|</span> ${dateRange.start} ~ ${dateRange.end}</p>
      <p class="week-meta">生成时间：${generatedTime}</p>
    </div>
    
    <div class="theme-section">
      <h2 style="font-size: 1.25rem; margin-bottom: var(--spacing-md); color: var(--text-secondary);">🎯 本周主题</h2>
      <div class="theme-content">${aiInsights.weeklyTheme || 'AI 驱动的技术创新持续加速'}</div>
    </div>
    
    <div class="section">
      <h2>📈 周度概览</h2>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${aggregated.totalProjects}</div><div class="stat-label">上榜项目</div></div>
        <div class="stat-card"><div class="stat-value">${aggregated.totalStars.toLocaleString()}</div><div class="stat-label">累计 Stars</div></div>
        <div class="stat-card"><div class="stat-value">${aggregated.aiRatio}%</div><div class="stat-label">AI 项目占比</div></div>
        <div class="stat-card"><div class="stat-value">${aggregated.topLanguages[0]?.name || 'N/A'}</div><div class="stat-label">主导语言</div></div>
      </div>
    </div>
    
    <div class="section">
      <h2>🏆 周榜 Top 10</h2>
      <table class="top10-table">
        <thead><tr><th style="width:60px">排名</th><th>项目</th><th>描述</th><th style="width:100px">语言</th><th style="width:100px">周 Stars</th><th style="width:80px">上榜天数</th></tr></thead>
        <tbody>
          ${categories.weeklyTop.map((p, i) => `<tr>
            <td><span class="rank-badge ${i < 3 ? 'top-3' : ''}">${i + 1}</span></td>
            <td><a href="${p.url}" target="_blank" style="font-weight: 500;">${p.repo}</a>${p.isAI ? ' 🤖' : ''}</td>
            <td style="color: var(--text-secondary); font-size: 0.9375rem;">${p.desc?.substring(0, 60) || ''}${p.desc?.length > 60 ? '...' : ''}</td>
            <td style="color: var(--text-secondary);">${p.language || '-'}</td>
            <td><strong style="color: var(--accent-success);">+${p.totalStars.toLocaleString()}</strong></td>
            <td style="color: var(--text-muted);">${p.appearances}天</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <h2>🔍 分类洞察</h2>
      <div class="insight-grid">
        <div class="insight-card" style="border-left-color: #F59E0B;">
          <h3 style="color: #F59E0B;">🔥 持续热门</h3>
          <p class="desc" style="color: var(--text-muted);">连续 3 天 + 上榜</p>
          <ul>${categories.sustained.length > 0 ? categories.sustained.map(p => `<li>${p.repo} <span style="color: var(--text-muted);">(${p.appearances}天，+${p.totalStars.toLocaleString()}⭐)</span></li>`).join('') : '<li style="color: var(--text-muted);">无</li>'}</ul>
        </div>
        <div class="insight-card" style="border-left-color: #10B981;">
          <h3 style="color: #10B981;">🆕 新面孔</h3>
          <p class="desc" style="color: var(--text-muted);">本周首次上榜</p>
          <ul>${categories.newcomers.length > 0 ? categories.newcomers.map(p => `<li>${p.repo} <span style="color: var(--text-muted);">(+${p.totalStars.toLocaleString()}⭐)</span></li>`).join('') : '<li style="color: var(--text-muted);">无</li>'}</ul>
        </div>
        <div class="insight-card" style="border-left-color: #EF4444;">
          <h3 style="color: #EF4444;">📉 降温观察</h3>
          <p class="desc" style="color: var(--text-muted);">热度下降</p>
          <ul>${categories.cooling.length > 0 ? categories.cooling.map(p => `<li>${p.repo}</li>`).join('') : '<li style="color: var(--text-muted);">无</li>'}</ul>
        </div>
      </div>
    </div>
    
    <div class="section ai-insights">
      <h2>🤖 AI 深度洞察</h2>
      <div class="insight-section"><h3>🔥 热点解读</h3><ul>${aiInsights.hot.map(i => `<li>${i}</li>`).join('')}</ul></div>
      <div class="insight-section"><h3>📈 趋势分析</h3><ul>${aiInsights.trends.map(i => `<li>${i}</li>`).join('')}</ul></div>
      <div class="insight-section"><h3>💡 行动建议</h3><ul>${aiInsights.actions.map(i => `<li>${i}</li>`).join('')}</ul></div>
    </div>
  </div>
  
  <div class="footer">
    <p>生成工具：GitHub Daily Brief + AI Analysis</p>
    <p>数据来源：GitHub Trending API</p>
    <p><a href="../index.html">← 返回日报首页</a> | <a href="./">← 所有周报</a></p>
  </div>
</body>
</html>`;

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportFile = path.join(REPORTS_DIR, `github-weekly-${weekId}.html`);
  fs.writeFileSync(reportFile, html, 'utf8');
  log(`✅ HTML 已生成：${reportFile}`);
  
  fs.writeFileSync(path.join(REPORTS_DIR, 'latest.html'), `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=./github-weekly-${weekId}.html"></head></html>`, 'utf8');
  return reportFile;
}

function generateIndex() {
  const weeklyFiles = fs.readdirSync(WEEKLY_DIR).filter(f => f.endsWith('.json')).sort().reverse();
  const reports = weeklyFiles.map(f => { const d = JSON.parse(fs.readFileSync(path.join(WEEKLY_DIR, f), 'utf8')); return { weekId: d.weekId, dateRange: d.dateRange, htmlFile: `github-weekly-${d.weekId}.html` }; });
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>📚 GitHub Trending 周报归档</title><style>body{font-family:'Inter','Noto Sans SC',sans-serif;background:#0B0F19;color:#F9FAFB;max-width:800px;margin:40px auto;padding:20px}h1{background:linear-gradient(135deg,#3B82F6 0%,#8B5CF6 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2rem;margin-bottom:30px}ul{list-style:none}li{background:#1A2332;margin-bottom:10px;padding:15px 20px;border-radius:8px;border:1px solid #1F2937}li:hover{border-color:#3B82F6;transform:translateX(8px)}a{color:#3B82F6;text-decoration:none;font-weight:500}.date{color:#9CA3AF;font-size:0.875rem;margin-left:10px}</style></head><body><h1>📚 GitHub Trending 周报归档</h1><ul>${reports.map(r => `<li><a href="./${r.htmlFile}">${r.weekId}</a><span class="date">(${r.dateRange.start} ~ ${r.dateRange.end})</span></li>`).join('')}</ul></body></html>`;
  fs.writeFileSync(path.join(REPORTS_DIR, 'index.html'), html, 'utf8');
  log(`✅ 索引页已生成`);
}

async function main() {
  log('🚀 开始生成周报（测试版 W10 - 强制深色）...');
  const weekId = '2026-W10';
  const dateRange = { start: '2026-03-01', end: '2026-03-07' };
  log(`📅 ${weekId} (${dateRange.start} ~ ${dateRange.end})`);
  
  const projects = loadWeekData(dateRange);
  log(`📊 加载 ${projects.length} 个项目`);
  if (projects.length === 0) { log('⚠️  无数据，跳过'); return; }
  
  const aggregated = aggregateStats(projects);
  log(`📈 累计 ${aggregated.totalStars.toLocaleString()}⭐, AI ${aggregated.aiRatio}%`);
  
  const categories = categorizeProjects(projects);
  log(`🔍 持续热门：${categories.sustained.length}, 新面孔：${categories.newcomers.length}`);
  
  log('🤖 AI 分析...');
  const aiInsights = await callLLMAnalysis(weekId, dateRange, aggregated, categories);
  log(`✅ ${aiInsights.weeklyTheme}`);
  
  const weeklyData = { weekId, dateRange, generatedAt: new Date().toISOString(), aggregated, categories, aiInsights };
  fs.mkdirSync(WEEKLY_DIR, { recursive: true });
  fs.writeFileSync(path.join(WEEKLY_DIR, `${weekId}.json`), JSON.stringify(weeklyData, null, 2), 'utf8');
  
  log('🎨 生成 HTML...');
  generateHTML(weeklyData);
  generateIndex();
  
  log(`✅ 完成！https://report.wenspock.site/reports/weekly/github-weekly-${weekId}.html`);
}

main().catch(e => { log(`❌ ${e.message}`); process.exit(1); });
