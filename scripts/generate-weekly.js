#!/usr/bin/env node
/**
 * GitHub Trending 周报生成脚本 - 极简工业风格
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ARCHIVE_BASE = '/srv/www/daily-report/archive';
const WEEKLY_DIR = '/srv/www/daily-report/weekly';
const REPORTS_DIR = '/srv/www/daily-report/reports/weekly';
const LOG_FILE = '/var/log/github-monitor.log';

function log(message) {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const logLine = `[${timestamp}] [周报] ${message}\n`;
    console.log(logLine.trim());
    try { fs.appendFileSync(LOG_FILE, logLine); } catch (e) {}
}

function getWeekId(date = new Date()) {
    const d = new Date(date);
    const temp = new Date(d);
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
    const year = temp.getFullYear();
    const firstJan = new Date(year, 0, 1);
    const weekNum = Math.ceil((((temp - firstJan) / 86400000) + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function getDateRange(weekId) {
    const [year, week] = weekId.split('-W');
    const jan1 = new Date(parseInt(year), 0, 1);
    const dayOfWeek = jan1.getDay();
    const firstMonday = new Date(jan1);
    firstMonday.setDate(jan1.getDate() + ((dayOfWeek === 0 ? 1 : 8 - dayOfWeek) % 7));
    if (dayOfWeek === 1) firstMonday.setDate(jan1.getDate());
    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (parseInt(week) - 1) * 7);
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
        const archiveFile = path.join(ARCHIVE_BASE, dateStr.substring(0, 4), dateStr.substring(5, 7), `${dateStr}.json`);
        if (fs.existsSync(archiveFile)) {
            const data = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
            (data.projects || []).forEach(p => {
                if (!projects[p.repo]) {
                    projects[p.repo] = { ...p, appearances: 0, totalStars: 0, dailyStars: [] };
                }
                projects[p.repo].appearances++;
                const stars = parseInt(p.todayStars?.replace(/,/g, '') || '0');
                projects[p.repo].totalStars += stars;
                projects[p.repo].dailyStars.push(stars);
            });
        }
    }
    return Object.values(projects);
}

function categorizeProjects(projects) {
    const sustained = projects.filter(p => p.appearances >= 3).sort((a, b) => b.totalStars - a.totalStars);
    const newcomers = projects.filter(p => p.appearances === 1).sort((a, b) => b.totalStars - a.totalStars);
    const weeklyTop = [...projects].sort((a, b) => b.totalStars - a.totalStars).slice(0, 10);
    return { sustained, newcomers, weeklyTop };
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

async function callLLMAnalysis(weekId, dateRange, aggregated, categories, lastWeekData) {
    const domainSummary = aggregated.topLanguages.map(l => `${l.name} (${l.count}个)`).join(', ');
    
    const prompt = `分析 ${weekId} (${dateRange.start}~${dateRange.end}) 的 GitHub Trending 周报数据。

## 周度统计
- 上榜项目：${aggregated.totalProjects} 个
- 累计 Stars: ${aggregated.totalStars.toLocaleString()} ⭐
- AI 项目占比：${aggregated.aiRatio}%
- 主导语言：${domainSummary}

## 持续热门项目（≥3 天上榜）
${categories.sustained.slice(0, 5).map(p => `- **${p.repo}**: ${p.appearances}天，+${p.totalStars.toLocaleString()}⭐`).join('\n') || '无'}

## 新面孔项目
${categories.newcomers.slice(0, 5).map(p => `- **${p.repo}**: +${p.totalStars.toLocaleString()}⭐`).join('\n') || '无'}

## 周榜 Top 5
${categories.weeklyTop.slice(0, 5).map((p, i) => `${i+1}. **${p.repo}**: +${p.totalStars.toLocaleString()}⭐`).join('\n')}

${lastWeekData ? `## 上周对比
- 上周项目数：${lastWeekData.totalProjects} 个（本周 ${aggregated.totalProjects} 个，${aggregated.totalProjects > lastWeekData.totalProjects ? '↑' : '↓'}${Math.abs(aggregated.totalProjects - lastWeekData.totalProjects)}个）
- 上周 AI 占比：${lastWeekData.aiRatio}%（本周 ${aggregated.aiRatio}%，${aggregated.aiRatio > lastWeekData.aiRatio ? '↑' : '↓'}${Math.abs(aggregated.aiRatio - lastWeekData.aiRatio)}%）
` : ''}
请输出 JSON 格式的周度洞察：
{
  "weeklyTheme": "一句话总结本周主题（20-30 字）",
  "hot": ["热点洞察 1（结合具体项目）", "...", "...", "..."],
  "shortTerm": ["短期趋势 1（1-4 周）", "...", "..."],
  "action": ["行动建议 1（针对技术决策者）", "...", "..."]
}`;

    return new Promise((resolve) => {
        const req = https.request({
            hostname: '127.0.0.1',
            port: 18789,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LLM_API_KEY || ''}`
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    const content = response.choices?.[0]?.message?.content;
                    if (!content) throw new Error('No content');
                    let jsonStr = content.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '').replace(/^```\s*/, '');
                    resolve(JSON.parse(jsonStr));
                } catch (e) {
                    log(`⚠️  LLM 解析失败：${e.message}，使用默认分析`);
                    resolve(getDefaultInsights(aggregated, categories));
                }
            });
        });
        req.on('error', (e) => {
            log(`⚠️  LLM 请求失败：${e.message}，使用默认分析`);
            resolve(getDefaultInsights(aggregated, categories));
        });
        req.write(JSON.stringify({
            model: 'bailian/qwen3.5-plus',
            messages: [
                { role: 'system', content: '输出纯 JSON，不要 markdown，不要额外文本。' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        }));
        req.end();
    });
}

function getDefaultInsights(aggregated, categories) {
    const topProject = categories.weeklyTop[0];
    return {
        weeklyTheme: `${topProject?.repo?.split('/')[0] || 'AI 项目'}领衔，${aggregated.aiRatio}% AI 项目占比彰显技术变革力度`,
        hot: [
            `${topProject?.repo || '头部项目'} 以 +${topProject?.totalStars?.toLocaleString() || '数千'}⭐领跑本周`,
            `${categories.sustained.length}个项目持续霸榜，说明不是单日炒作而是真实技术需求`,
            `AI 项目占比高达${aggregated.aiRatio}%，${aggregated.topLanguages[0]?.name || 'Python'} 生态占据主导`
        ],
        shortTerm: [
            `自托管 AI 从概念走向实用：多个项目提供本地部署方案`,
            `多智能体协作成为新热点：从单一 Agent 到多 Agent 协同`,
            `AI 安全与可解释性受重视：开发者开始关注模型透明度`
        ],
        action: [
            '评估现有架构是否支持 AI Agent 集成，预留扩展接口',
            '关注自托管 AI 方案，为敏感数据场景做准备',
            '建立 AI 项目评估机制，关注安全性与可维护性'
        ]
    };
}

function linkifyRepos(text, projects) {
    if (!text) return '';
    const repoMap = new Map();
    projects.forEach(p => {
        if (p.repo) {
            repoMap.set(p.repo, p.repo);
            const shortName = p.repo.split('/')[1];
            if (shortName && shortName !== p.repo) repoMap.set(shortName, p.repo);
        }
    });
    let result = text;
    Array.from(repoMap.keys()).sort((a, b) => b.length - a.length).forEach(name => {
        const repo = repoMap.get(name);
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(`(?<!\\[)(?<![\\p{L}\\/])${escaped}(?![\\p{L}\\]\\/])`, 'gu'), `[${name}](https://github.com/${repo})`);
    });
    return result;
}

function mdLink(text) {
    if (!text) return '';
    try {
        return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    } catch (e) {
        return text;
    }
}

function generateHTML(weeklyData, lastWeekData) {
    const { weekId, dateRange, aggregated, categories, aiInsights, darkHorse, domains } = weeklyData;
    const generatedTime = new Date(weeklyData.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    const projectRows = categories.weeklyTop.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><a href="${p.url}" target="_blank">${p.repo}</a>${p.isAI ? ' 🤖' : ''}</td>
            <td>${p.descZh || p.desc || ''}</td>
            <td>${p.language || ''}</td>
            <td><span style="color: var(--accent);">+${p.totalStars.toLocaleString()}</span></td>
            <td>${p.appearances}天</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Trending 周报 - ${weekId}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0a0a0a; --bg-elevated: #141414; --bg-subtle: #1a1a1a;
            --text: #fff; --text-dim: #888; --text-muted: #555;
            --border: #222; --accent: #00ff41;
            --space-sm: 0.5rem; --space-md: 1rem; --space-lg: 1.5rem; --space-xl: 2rem;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
        .container { max-width: 1024px; margin: 0 auto; padding: var(--space-xl) var(--space-lg); }
        
        .header { padding-bottom: var(--space-xl); border-bottom: 1px solid var(--border); margin-bottom: var(--space-xl); }
        .logo { display: flex; align-items: baseline; gap: var(--space-md); margin-bottom: var(--space-sm); }
        h1 { font-family: 'IBM Plex Mono', monospace; font-size: 1.25rem; font-weight: 600; text-transform: uppercase; }
        .subtitle { color: var(--text-dim); font-size: 0.875rem; font-family: 'JetBrains Mono', monospace; }
        
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); margin-bottom: var(--space-xl); }
        .stat { background: var(--bg-elevated); border: 1px solid var(--border); padding: var(--space-lg); }
        .stat-value { font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; line-height: 1; }
        .stat-label { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: var(--text-muted); text-transform: uppercase; margin-top: var(--space-sm); }
        .stat-trend { font-size: 0.75rem; margin-top: var(--space-xs); }
        .stat-trend.up { color: var(--accent); }
        .stat-trend.down { color: #ff4444; }
        
        .section { margin-bottom: var(--space-xl); }
        .section-title { font-family: 'IBM Plex Mono', monospace; font-size: 0.875rem; font-weight: 600; text-transform: uppercase; margin-bottom: var(--space-lg); display: flex; align-items: center; gap: var(--space-sm); }
        .section-title::before { content: ''; width: 8px; height: 8px; background: var(--accent); }
        
        .theme-box { background: var(--bg-elevated); border: 1px solid var(--border); padding: var(--space-lg); margin-bottom: var(--space-xl); }
        .theme-text { font-size: 1.125rem; line-height: 1.8; color: var(--text); }
        
        .insights { background: var(--bg-elevated); border: 1px solid var(--border); padding: var(--space-lg); margin-bottom: var(--space-xl); }
        .insight-block { margin-bottom: var(--space-xl); padding-bottom: var(--space-lg); border-bottom: 1px solid var(--border); }
        .insight-block:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
        .insight-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.9375rem; font-weight: 700; color: var(--text); text-transform: uppercase; margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-sm); }
        .insight-label::before { content: ''; width: 10px; height: 10px; background: var(--accent); }
        .insight-content { font-size: 0.9375rem; line-height: 1.8; color: var(--text-dim); }
        .insight-content a { color: var(--accent); text-decoration: none; }
        .insight-content a:hover { text-decoration: underline; }
        .insight-list { list-style: none; }
        .insight-list li { padding: var(--space-sm) 0; border-bottom: 1px solid var(--border); }
        .insight-list li:last-child { border-bottom: none; }
        .insight-list li::before { content: '› '; color: var(--accent); font-weight: 600; margin-right: var(--space-sm); }
        
        table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        th { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: var(--text-dim); text-transform: uppercase; padding: var(--space-md); text-align: left; border-bottom: 1px solid var(--border); }
        td { padding: var(--space-md); border-bottom: 1px solid var(--border); }
        tr:hover { background: var(--bg-subtle); }
        td a { color: var(--accent); text-decoration: none; }
        td a:hover { text-decoration: underline; }
        
        .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-bottom: var(--space-xl); }
        .comparison-card { background: var(--bg-elevated); border: 1px solid var(--border); padding: var(--space-lg); }
        .comparison-card h3 { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; font-weight: 600; color: var(--text); margin-bottom: var(--space-md); }
        .comparison-card ul { list-style: none; }
        .comparison-card li { padding: var(--space-xs) 0; color: var(--text-dim); font-size: 0.875rem; }
        .comparison-card li::before { content: '• '; color: var(--accent); }
        .comparison-card a { color: var(--text-dim); text-decoration: none; border-bottom: 1px solid var(--border); }
        .comparison-card a:hover { color: var(--accent); border-bottom-color: var(--accent); }
        
        .footer { padding-top: var(--space-xl); border-top: 1px solid var(--border); text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: var(--text-muted); text-transform: uppercase; }
        
        @media (max-width: 768px) {
            .stats { grid-template-columns: repeat(2, 1fr); }
            .comparison-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="logo">
                <span class="logo-icon">◈</span>
                <h1>GitHub Trending 周报</h1>
            </div>
            <p class="subtitle">${weekId} · ${dateRange.start} ~ ${dateRange.end}</p>
        </header>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-value">${aggregated.totalProjects}</div>
                <div class="stat-label">上榜项目</div>
                ${lastWeekData ? `<div class="stat-trend ${aggregated.totalProjects > lastWeekData.totalProjects ? 'up' : 'down'}">${aggregated.totalProjects > lastWeekData.totalProjects ? '↑' : '↓'}${Math.abs(aggregated.totalProjects - lastWeekData.totalProjects)} vs 上周</div>` : ''}
            </div>
            <div class="stat">
                <div class="stat-value">${aggregated.totalStars.toLocaleString()}</div>
                <div class="stat-label">累计 Stars</div>
            </div>
            <div class="stat">
                <div class="stat-value">${aggregated.aiRatio}%</div>
                <div class="stat-label">AI 项目</div>
                ${lastWeekData ? `<div class="stat-trend ${aggregated.aiRatio > lastWeekData.aiRatio ? 'up' : 'down'}">${aggregated.aiRatio > lastWeekData.aiRatio ? '↑' : '↓'}${Math.abs(aggregated.aiRatio - lastWeekData.aiRatio)}% vs 上周</div>` : ''}
            </div>
            <div class="stat">
                <div class="stat-value">${darkHorse?.totalStars?.toLocaleString() || 'N/A'}</div>
                <div class="stat-label">最大黑马</div>
                <div class="stat-trend" style="color:var(--text-dim);font-size:0.6875rem">${darkHorse?.repo?.split('/')[1] || ''}</div>
            </div>
        </div>
        
        ${domains.length > 0 ? `
        <section class="section">
            <div class="section-title">领域分布</div>
            <div class="comparison-grid" style="grid-template-columns: repeat(${Math.min(domains.length, 4)}, 1fr);">
                ${domains.slice(0, 4).map(d => `
                <div class="comparison-card">
                    <h3>${d.name}</h3>
                    <div class="stat-value" style="font-size:1.5rem">${d.count}</div>
                    <div class="stat-label">个项目</div>
                </div>
                `).join('')}
            </div>
        </section>` : ''}
        
        <section class="section">
            <div class="section-title">周度主题</div>
            <div class="theme-box">
                <div class="theme-text">${aiInsights.weeklyTheme || 'AI 驱动的技术创新持续加速'}</div>
            </div>
        </section>
        
        <section class="section">
            <div class="section-title">AI 深度洞察</div>
            <div class="insights">
                <div class="insight-block">
                    <div class="insight-label">🔥 本周热点</div>
                    <div class="insight-content">
                        <ul class="insight-list">
                            ${(aiInsights.hot || []).map(i => `<li>${mdLink(linkifyRepos(i, categories.weeklyTop))}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                
                <div class="insight-block">
                    <div class="insight-label">📈 短期趋势（1-4 周）</div>
                    <div class="insight-content">
                        <ul class="insight-list">
                            ${(aiInsights.shortTerm || []).map(i => `<li>${mdLink(linkifyRepos(i, categories.weeklyTop))}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                
                ${(aiInsights.action && aiInsights.action.length > 0) ? `
                <div class="insight-block">
                    <div class="insight-label">🎯 行动建议</div>
                    <div class="insight-content">
                        <ol class="insight-list" style="list-style: decimal; padding-left: var(--space-md);">
                            ${aiInsights.action.slice(0, 3).map(i => `<li style="border:none; padding: var(--space-sm) 0;">${mdLink(linkifyRepos(i, categories.weeklyTop))}</li>`).join('')}
                        </ol>
                    </div>
                </div>` : ''}
            </div>
        </section>
        
        <section class="section">
            <div class="section-title">分类洞察</div>
            <div class="comparison-grid">
                <div class="comparison-card">
                    <h3>🔥 持续热门</h3>
                    <ul>
                        ${categories.sustained.slice(0, 5).map(p => `<li><a href="${p.url}" target="_blank">${p.repo}</a> <span style="color:var(--text-muted)">上榜${p.appearances}天</span>，+${p.totalStars.toLocaleString()}⭐</li>`).join('')}
                    </ul>
                </div>
                <div class="comparison-card">
                    <h3>🆕 新面孔</h3>
                    <ul>
                        ${categories.newcomers.slice(0, 5).map(p => `<li><a href="${p.url}" target="_blank">${p.repo}</a> (+${p.totalStars.toLocaleString()}⭐)</li>`).join('')}
                    </ul>
                </div>
            </div>
        </section>
        
        <section class="section">
            <div class="section-title">周榜 Top 10</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:50px">排名</th>
                        <th>项目</th>
                        <th>描述</th>
                        <th style="width:100px">语言</th>
                        <th style="width:80px">周 Stars</th>
                        <th style="width:60px">天数</th>
                    </tr>
                </thead>
                <tbody>${projectRows}</tbody>
            </table>
        </section>
        
        <footer class="footer">由 OpenClaw 自动生成 · 数据来源 GitHub Trending API</footer>
    </div>
</body>
</html>`;
}

async function main() {
    log('🚀 开始生成周报...');
    
    // 优先使用已有数据的周
    const existingWeeks = fs.readdirSync(WEEKLY_DIR).filter(f => f.endsWith('.json')).sort().reverse();
    let weekId, dateRange, projects;
    
    if (existingWeeks.length > 0) {
        const latestWeek = JSON.parse(fs.readFileSync(path.join(WEEKLY_DIR, existingWeeks[0]), 'utf8'));
        weekId = latestWeek.weekId;
        dateRange = latestWeek.dateRange;
        log(`📅 ${weekId} (${dateRange.start} ~ ${dateRange.end}) [已有数据]`);
        projects = loadWeekData(dateRange);
    } else {
        weekId = getWeekId();
        dateRange = getDateRange(weekId);
        log(`📅 ${weekId} (${dateRange.start} ~ ${dateRange.end})`);
        projects = loadWeekData(dateRange);
    }
    
    log(`📊 加载 ${projects.length} 个项目`);
    if (projects.length === 0) { log('⚠️  无数据，跳过'); return; }
    
    const aggregated = aggregateStats(projects);
    log(`📈 累计 ${aggregated.totalStars.toLocaleString()}⭐, AI ${aggregated.aiRatio}%`);
    
    const categories = categorizeProjects(projects);
    log(`🔍 持续热门：${categories.sustained.length}, 新面孔：${categories.newcomers.length}`);
    
    // 加载上周数据用于对比
    let lastWeekData = null;
    if (existingWeeks.length > 1) {
        const lastWeek = JSON.parse(fs.readFileSync(path.join(WEEKLY_DIR, existingWeeks[1]), 'utf8'));
        lastWeekData = lastWeek.aggregated;
        log(`📊 上周对比：${lastWeekData.totalProjects}个项目，AI ${lastWeekData.aiRatio}%`);
    }
    
    log('🤖 AI 分析...');
    const aiInsights = await callLLMAnalysis(weekId, dateRange, aggregated, categories, lastWeekData);
    log(`✅ ${aiInsights.weeklyTheme}`);
    
    // 计算最大黑马（本周增长最快）
    const darkHorse = categories.weeklyTop[0];
    
    // 计算领域分布
    const domainCount = {};
    projects.forEach(p => {
        const domain = p.analysis?.typeName || '其他';
        domainCount[domain] = (domainCount[domain] || 0) + 1;
    });
    const domains = Object.entries(domainCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    
    const weeklyData = { weekId, dateRange, generatedAt: new Date().toISOString(), aggregated, categories, aiInsights, darkHorse, domains };
    fs.mkdirSync(WEEKLY_DIR, { recursive: true });
    fs.writeFileSync(path.join(WEEKLY_DIR, `${weekId}.json`), JSON.stringify(weeklyData, null, 2), 'utf8');
    
    log('🎨 生成 HTML...');
    const html = generateHTML(weeklyData, lastWeekData);
    const reportFile = path.join(REPORTS_DIR, `github-weekly-${weekId}.html`);
    fs.writeFileSync(reportFile, html, 'utf8');
    fs.writeFileSync(path.join(REPORTS_DIR, 'latest.html'), `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=./github-weekly-${weekId}.html"></head></html>`, 'utf8');
    
    // 更新索引页
    const weeklyFiles = fs.readdirSync(WEEKLY_DIR).filter(f => f.endsWith('.json')).sort().reverse();
    const reports = weeklyFiles.map(f => {
        const d = JSON.parse(fs.readFileSync(path.join(WEEKLY_DIR, f), 'utf8'));
        return { weekId: d.weekId, dateRange: d.dateRange, htmlFile: `github-weekly-${d.weekId}.html` };
    });
    const indexHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>GitHub Trending 周报归档</title><style>body{font-family:'Plus Jakarta Sans',sans-serif;background:#0a0a0a;color:#fff;max-width:800px;margin:40px auto;padding:20px}h1{font-family:'IBM Plex Mono',monospace;font-size:1.25rem;text-transform:uppercase}ul{list-style:none}li{background:#141414;margin-bottom:10px;padding:15px 20px;border:1px solid #222}li:hover{border-color:#00ff41}a{color:#00ff41;text-decoration:none}.date{color:#888;font-size:0.8125rem;margin-left:10px}</style></head><body><h1>◈ GitHub Trending 周报归档</h1><ul>${reports.map(r => `<li><a href="./${r.htmlFile}">${r.weekId}</a><span class="date">(${r.dateRange.start} ~ ${r.dateRange.end})</span></li>`).join('')}</ul></body></html>`;
    fs.writeFileSync(path.join(REPORTS_DIR, 'index.html'), indexHtml, 'utf8');
    
    log(`✅ 完成！https://report.wenspock.site/reports/weekly/github-weekly-${weekId}.html`);
}

main().catch(e => { log(`❌ ${e.message}`); process.exit(1); });
