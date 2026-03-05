#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const ROOT_DIR = '/srv/www/daily-report';
const DATA_FILE = path.join(ROOT_DIR, 'briefs', 'data.json');
const INSIGHTS_FILE = path.join(ROOT_DIR, '.ai_insights.json');
const STATE_FILE = path.join(ROOT_DIR, '.processor_state.json');
const OUTPUT_DIR = ROOT_DIR;

// 飞书配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_a916e5b5a1b8dcd4';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || 'rXVOqRNAKGtD8edjDwuYmbaWjuJbHSmO';
const FEISHU_RECEIVE_ID = process.env.FEISHU_RECEIVE_ID || 'ou_c5f7c0e7dda00b982d531a474fb0d542';

// WeLink 配置（Webhook 方式）- 支持多个机器人
// 环境变量格式：用逗号分隔多个 URL，例如：https://...token=abc...,https://...token=xyz...
const WELINK_WEBHOOK_URLS = process.env.WELINK_WEBHOOK_URLS 
    ? process.env.WELINK_WEBHOOK_URLS.split(',').map(url => url.trim())
    : [
    'https://open.welink.huaweicloud.com/api/werobot/v1/webhook/send?token=35dfd31807064f3b9ca277a7bd0db0e3&channel=standard',
    'https://open.welink.huaweicloud.com/api/werobot/v1/webhook/send?token=669110b5da7d4d249b63c05ea76924d5&channel=standard'
  ];

// 报告 URL 配置
const REPORT_BASE_URL = process.env.REPORT_BASE_URL || 'https://report.wenspock.site';

function loadData() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function loadInsights() { return JSON.parse(fs.readFileSync(INSIGHTS_FILE, 'utf8')); }
function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch(e) { return { lastProcessedAt: null }; } }
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8'); }

function getAnalysisTypeIcon(typeName) {
    const icons = {
        '语音处理': '🎤', 'Agent 系统': '🤖', '开发工具': '🛠️',
        '通用工具': '🔧', '数据处理': '📊', '机器学习': '🧠'
    };
    return icons[typeName] || '🔧';
}

function generateHtml(data, insights) {
    const { date, projects, stats, summary } = data;
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const totalProjects = stats?.totalProjects || projects.length;
    const aiProjects = stats?.aiProjects || projects.filter(p => p.isAI).length;
    const avgStars = stats?.avgStars || 'N/A';
    
    const sortedProjects = [...projects].sort((a, b) => {
        const aStars = parseInt(a.todayStars.replace(/,/g, '')) || 0;
        const bStars = parseInt(b.todayStars.replace(/,/g, '')) || 0;
        return bStars - aStars;
    });
    
    const getLanguageColor = (lang) => {
        const colors = {
            'TypeScript': '#3178C6', 'JavaScript': '#F7DF1E', 'Python': '#3776AB',
            'Java': '#b07219', 'C++': '#000000', 'C': '#555555', 'Go': '#00ADD8',
            'Rust': '#dea584', 'Ruby': '#701516', 'Shell': '#89e051'
        };
        return colors[lang] || '#6B7280';
    };
    
    const getStarClass = (stars) => {
        const num = parseInt(stars.replace(/,/g, '')) || 0;
        if (num >= 500) return 'super-hot';
        if (num >= 100) return 'hot';
        return '';
    };
    
    let projectRows = sortedProjects.map((p, i) => {
        const rankClass = i < 3 ? 'top-3' : '';
        const starClass = getStarClass(p.todayStars);
        const langColor = getLanguageColor(p.language);
        return `
        <tr>
            <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
            <td><a href="${p.url}" target="_blank">${p.repo}</a>${p.isAI ? ' 🤖' : ''}</td>
            <td>${p.descZh || p.desc || ''}</td>
            <td><span style="color: ${langColor}; font-weight: 500;">${p.language || ''}</span></td>
            <td><span class="star-count ${starClass}">⭐ ${p.todayStars}</span></td>
            <td>${p.stars}</td>
        </tr>
        <tr class="analysis-row">
            <td colspan="6">
                <div class="analysis-card">
                    <div class="analysis-header">
                        <span class="analysis-type-badge">${getAnalysisTypeIcon(p.analysis?.typeName)} ${p.analysis?.typeName || '通用工具'}</span>
                        <span class="community-level level-${p.analysis?.community?.level === '极高' ? 'high' : p.analysis?.community?.level === '高' ? 'medium' : 'low'}">
                            ${p.analysis?.community?.level === '极高' ? '🔥' : p.analysis?.community?.level === '高' ? '✅' : '⚪'} ${p.analysis?.community?.level || '中'}
                        </span>
                    </div>
                    <div class="analysis-content">
                        <div class="analysis-section">
                            <h4>✨ 核心功能</h4>
                            <ul>
                                ${(p.analysis?.coreFunctions || []).map(f => `<li>${f}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="analysis-section">
                            <h4>🎯 适用场景</h4>
                            <ul>
                                ${(p.analysis?.useCases || []).map(u => `<li>${u}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="analysis-section">
                            <h4>🔥 热度趋势</h4>
                            <ul class="trends-list">
                                ${(p.analysis?.trends || []).map(t => `<li>${t}</li>`).join('')}
                            </ul>
                        </div>
                        ${p.analysis?.community?.desc ? `<div class="community-desc"><strong>社区说明：</strong>${p.analysis.community.desc}</div>` : ''}
                    </div>
                </div>
            </td>
        </tr>
    `}).join('');
    
    const insightsMd = `## 📌 技术趋势洞察

### 今日热点
${insights.hot.map(i => `- **${i.split('：')[0]?.replace(/（.*?\）/g, '') || i}**：${i}`).join('\n')}

### 短期趋势（1-3 个月）
${insights.shortTerm.map(i => `- **${i.split('：')[0] || i}**：${i}`).join('\n')}

### 长期趋势（6-12 个月）
${insights.longTerm.map(i => `- **${i.split('：')[0] || i}**：${i}`).join('\n')}

## 🎯 行动建议

${insights.action.map((i, idx) => { const colonIdx = i.indexOf(":"); const t = colonIdx > 0 ? i.substring(0, colonIdx) : i; const d = colonIdx > 0 ? i.substring(colonIdx + 1) : ""; return `${idx+1}. **${t}**${d ? ":"+d : ""}`; }).join("\n\n")}`;
    return `<!DOCTYPE html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="GitHub AI 项目每日简报 - 追踪技术前沿，发现优质项目">
    <title>🚀 GitHub AI 项目每日简报 - ${date}</title>
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Marked.js for Markdown parsing -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    
    <style>
        /* ========================================
           CSS Variables - Design System
        ======================================== */
        :root {
            /* Colors - Modern Dark Theme */
            --bg-primary: #0B0F19;
            --bg-secondary: #111827;
            --bg-tertiary: #1F2937;
            --bg-card: #1A2332;
            --bg-card-hover: #243045;
            --bg-elevated: #2D3748;
            
            --text-primary: #F9FAFB;
            --text-secondary: #D1D5DB;
            --text-tertiary: #9CA3AF;
            --text-muted: #6B7280;
            
            --accent-primary: #3B82F6;
            --accent-secondary: #8B5CF6;
            --accent-success: #10B981;
            --accent-warning: #F59E0B;
            --accent-danger: #EF4444;
            --accent-info: #06B6D4;
            
            --accent-gradient: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
            --gradient-warm: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%);
            --gradient-cool: linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%);
            --gradient-success: linear-gradient(135deg, #10B981 0%, #3B82F6 100%);
            
            --border-color: #1F2937;
            --border-light: #374151;
            
            /* Shadows */
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3);
            --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
            --shadow-glow: 0 0 20px rgba(59, 130, 246, 0.3);
            --shadow-glow-purple: 0 0 20px rgba(139, 92, 246, 0.3);
            
            /* Spacing */
            --spacing-xs: 0.25rem;
            --spacing-sm: 0.5rem;
            --spacing-md: 1rem;
            --spacing-lg: 1.5rem;
            --spacing-xl: 2rem;
            --spacing-2xl: 3rem;
            
            /* Border Radius */
            --radius-sm: 0.375rem;
            --radius-md: 0.5rem;
            --radius-lg: 0.75rem;
            --radius-xl: 1rem;
            --radius-2xl: 1.5rem;
            --radius-full: 9999px;
            
            /* Transitions */
            --transition-fast: 150ms ease;
            --transition-base: 200ms ease;
            --transition-slow: 300ms ease;
            
            /* Container */
            --container-max: 1200px;
        }
        
        /* ========================================
           Reset & Base Styles
        ======================================== */
        *, *::before, *::after {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html {
            scroll-behavior: smooth;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        body {
            font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.7;
            min-height: 100vh;
            background-image: 
                radial-gradient(ellipse at top, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at bottom right, rgba(139, 92, 246, 0.05) 0%, transparent 50%);
            background-attachment: fixed;
        }
        
        /* ========================================
           Layout & Container
        ======================================== */
        .container {
            max-width: var(--container-max);
            margin: 0 auto;
            padding: 0 var(--spacing-lg);
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 0 var(--spacing-md);
            }
        }
        
        /* ========================================
           Header Section
        ======================================== */
        header {
            padding: var(--spacing-2xl) 0 var(--spacing-xl);
            border-bottom: 1px solid var(--border-color);
            position: relative;
            overflow: hidden;
        }
        
        header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: var(--accent-gradient);
            opacity: 0.5;
        }
        
        .header-content {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: var(--spacing-xl);
            flex-wrap: wrap;
            margin-bottom: var(--spacing-lg);
        }
        
        .logo {
            display: flex;
            align-items: flex-start;
            gap: var(--spacing-lg);
        }
        
        .logo-icon {
            width: 56px;
            height: 56px;
            background: var(--accent-gradient);
            border-radius: var(--radius-xl);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            box-shadow: var(--shadow-glow);
            flex-shrink: 0;
            transition: transform var(--transition-base), box-shadow var(--transition-base);
        }
        
        .logo-icon:hover {
            transform: scale(1.05);
            box-shadow: var(--shadow-glow), 0 0 30px rgba(59, 130, 246, 0.4);
        }
        
        .logo-text h1 {
            font-family: 'Inter', sans-serif;
            font-size: 32px;
            font-weight: 800;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1.2;
            margin-bottom: var(--spacing-xs);
        }
        
        .logo-text p {
            color: var(--text-secondary);
            font-size: 15px;
            font-weight: 400;
        }
        
        .header-actions {
            display: flex;
            gap: var(--spacing-md);
            flex-wrap: wrap;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-sm);
            padding: var(--spacing-sm) var(--spacing-lg);
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            color: var(--text-primary);
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            transition: all var(--transition-base);
            cursor: pointer;
            white-space: nowrap;
        }
        
        .btn:hover {
            border-color: var(--accent-primary);
            background: var(--bg-card-hover);
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
        }
        
        .btn-primary {
            background: var(--accent-gradient);
            border: none;
            color: white;
        }
        
        .btn-primary:hover {
            box-shadow: var(--shadow-glow), var(--shadow-md);
            transform: translateY(-2px);
        }
        
        .meta-bar {
            display: flex;
            gap: var(--spacing-xl);
            padding: var(--spacing-lg) 0;
            flex-wrap: wrap;
            border-top: 1px solid var(--border-color);
            margin-top: var(--spacing-lg);
        }
        
        .meta-item {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            color: var(--text-secondary);
            font-size: 14px;
        }
        
        .meta-icon {
            font-size: 16px;
            opacity: 0.8;
        }
        
        .meta-value {
            font-family: 'JetBrains Mono', monospace;
            color: var(--text-primary);
            font-weight: 500;
        }
        
        /* ========================================
           Stats Section
        ======================================== */
        .stats {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-2xl);
            padding: var(--spacing-xl);
            margin: var(--spacing-xl) 0;
            box-shadow: var(--shadow-lg);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: var(--spacing-lg);
        }
        
        @media (max-width: 1024px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        @media (max-width: 640px) {
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
        
        .stat-item {
            text-align: center;
            padding: var(--spacing-lg);
            background: var(--bg-secondary);
            border-radius: var(--radius-xl);
            border: 1px solid var(--border-color);
            transition: all var(--transition-base);
            position: relative;
            overflow: hidden;
        }
        
        .stat-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--accent-gradient);
            opacity: 0;
            transition: opacity var(--transition-base);
        }
        
        .stat-item:hover {
            border-color: var(--accent-primary);
            transform: translateY(-4px);
            box-shadow: var(--shadow-lg);
        }
        
        .stat-item:hover::before {
            opacity: 1;
        }
        
        .stat-value {
            font-size: 40px;
            font-weight: 800;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-family: 'Inter', sans-serif;
            line-height: 1;
            margin-bottom: var(--spacing-sm);
        }
        
        .stat-label {
            color: var(--text-secondary);
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
        }
        
        /* ========================================
           Insights Section
        ======================================== */
        .insights {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-2xl);
            padding: var(--spacing-xl);
            margin: var(--spacing-xl) 0;
            box-shadow: var(--shadow-lg);
        }
        
        #insights-content {
            animation: fadeInUp 0.5s ease;
        }
        
        #insights-content h2 {
            font-family: 'Inter', sans-serif;
            font-size: 24px;
            font-weight: 700;
            margin: var(--spacing-xl) 0 var(--spacing-lg);
            padding-bottom: var(--spacing-md);
            border-bottom: 1px solid var(--border-color);
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
        }
        
        #insights-content h2:first-child {
            margin-top: 0;
        }
        
        #insights-content h2::before {
            content: '';
            width: 4px;
            height: 24px;
            background: var(--accent-gradient);
            border-radius: var(--radius-sm);
        }
        
        #insights-content h3 {
            font-family: 'Inter', sans-serif;
            font-size: 18px;
            font-weight: 600;
            margin: var(--spacing-lg) 0 var(--spacing-md);
            color: var(--text-primary);
        }
        
        #insights-content ul,
        #insights-content ol {
            margin-bottom: var(--spacing-lg);
            padding-left: var(--spacing-xl);
        }
        
        #insights-content li {
            margin-bottom: var(--spacing-sm);
            color: var(--text-secondary);
            line-height: 1.8;
        }
        
        #insights-content li::marker {
            color: var(--accent-primary);
        }
        
        #insights-content strong {
            color: var(--text-primary);
            font-weight: 600;
        }
        
        /* ========================================
           Projects Table
        ======================================== */
        .table-container {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-2xl);
            overflow: hidden;
            margin: var(--spacing-xl) 0;
            box-shadow: var(--shadow-lg);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        thead {
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
        }
        
        th {
            padding: var(--spacing-md) var(--spacing-lg);
            text-align: left;
            font-weight: 600;
            font-size: 12px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-family: 'Inter', sans-serif;
        }
        
        tbody tr {
            border-bottom: 1px solid var(--border-color);
            transition: background var(--transition-base);
        }
        
        tbody tr:last-child {
            border-bottom: none;
        }
        
        tbody tr:not(.analysis-row):hover {
            background: var(--bg-card-hover);
        }
        
        td {
            padding: var(--spacing-lg);
            font-size: 14px;
            vertical-align: middle;
            word-break: break-word;
        }
        
        td:nth-child(3) {
            max-width: 300px;
        }
        
        @media (max-width: 768px) {
            td:nth-child(3) {
                max-width: none;
            }
        }
        
        td a {
            color: var(--accent-primary);
            text-decoration: none;
            font-family: 'JetBrains Mono', monospace;
            font-weight: 500;
            transition: color var(--transition-fast);
        }
        
        td a:hover {
            color: var(--accent-secondary);
            text-decoration: underline;
        }
        
        /* Rank badge */
        .rank-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            font-size: 14px;
            color: var(--text-secondary);
        }
        
        .rank-badge.top-3 {
            background: var(--accent-gradient);
            border: none;
            color: white;
            box-shadow: var(--shadow-glow);
        }
        
        /* Star count */
        .star-count {
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-xs);
            padding: var(--spacing-xs) var(--spacing-sm);
            background: var(--bg-secondary);
            border-radius: var(--radius-md);
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            font-weight: 600;
        }
        
        .star-count.hot {
            background: rgba(245, 158, 11, 0.1);
            color: var(--accent-warning);
        }
        
        .star-count.super-hot {
            background: rgba(239, 68, 68, 0.1);
            color: var(--accent-danger);
        }
        
        /* ========================================
           Analysis Cards
        ======================================== */
        .analysis-row {
            background: var(--bg-secondary);
        }
        
        .analysis-card {
            padding: var(--spacing-lg);
            margin: var(--spacing-md) var(--spacing-lg);
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-xl);
            transition: all var(--transition-base);
        }
        
        .analysis-card:hover {
            border-color: var(--border-light);
            box-shadow: var(--shadow-md);
        }
        
        .analysis-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--spacing-lg);
            flex-wrap: wrap;
            gap: var(--spacing-md);
        }
        
        .analysis-type-badge {
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-xs);
            padding: var(--spacing-xs) var(--spacing-md);
            background: var(--accent-gradient);
            border-radius: var(--radius-full);
            font-size: 12px;
            font-weight: 600;
            color: white;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .community-level {
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-xs);
            padding: var(--spacing-xs) var(--spacing-md);
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-full);
            font-size: 12px;
            font-weight: 500;
        }
        
        .community-level.level-high {
            border-color: var(--accent-warning);
            color: var(--accent-warning);
        }
        
        .community-level.level-medium {
            border-color: var(--accent-success);
            color: var(--accent-success);
        }
        
        .community-level.level-low {
            border-color: var(--text-muted);
            color: var(--text-muted);
        }
        
        .analysis-content {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: var(--spacing-lg);
        }
        
        @media (max-width: 1024px) {
            .analysis-content {
                grid-template-columns: 1fr;
            }
        }
        
        .analysis-section {
            padding: var(--spacing-md);
            background: var(--bg-tertiary);
            border-radius: var(--radius-lg);
            border: 1px solid var(--border-color);
        }
        
        .analysis-section h4 {
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: var(--spacing-sm);
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
        }
        
        .analysis-section ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .analysis-section li {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.8;
            padding-left: var(--spacing-md);
            position: relative;
            margin-bottom: var(--spacing-xs);
        }
        
        .analysis-section li::before {
            content: '•';
            color: var(--accent-primary);
            position: absolute;
            left: 0;
            font-weight: bold;
        }
        
        .trends-list li::before {
            content: '';
        }
        
        .community-desc {
            grid-column: 1 / -1;
            margin-top: var(--spacing-md);
            padding-top: var(--spacing-md);
            border-top: 1px solid var(--border-color);
            font-size: 13px;
            color: var(--text-secondary);
        }
        
        .community-desc strong {
            color: var(--text-primary);
            font-weight: 600;
        }
        
        /* ========================================
           Footer
        ======================================== */
        .footer {
            text-align: center;
            margin: var(--spacing-2xl) 0;
            padding: var(--spacing-xl) 0;
            border-top: 1px solid var(--border-color);
            color: var(--text-muted);
            font-size: 13px;
        }
        
        .footer a {
            color: var(--accent-primary);
            text-decoration: none;
            font-weight: 500;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        /* ========================================
           Scroll to Top Button
        ======================================== */
        .scroll-top {
            position: fixed;
            bottom: 32px;
            right: 32px;
            width: 48px;
            height: 48px;
            background: var(--accent-gradient);
            border: none;
            border-radius: var(--radius-full);
            color: white;
            font-size: 20px;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            transition: all var(--transition-base);
            box-shadow: var(--shadow-glow);
            z-index: 100;
        }
        
        .scroll-top.visible {
            opacity: 1;
            visibility: visible;
        }
        
        .scroll-top:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-glow), 0 0 30px rgba(59, 130, 246, 0.4);
        }
        
        /* ========================================
           Animations
        ======================================== */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.5;
            }
        }
        
        .animate-fade-in {
            animation: fadeInUp 0.5s ease;
        }
        
        /* ========================================
           Responsive Design
        ======================================== */
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
                gap: var(--spacing-lg);
            }
            
            .logo {
                width: 100%;
            }
            
            .logo-text h1 {
                font-size: 24px;
            }
            
            .header-actions {
                width: 100%;
            }
            
            .btn {
                flex: 1;
                justify-content: center;
            }
            
            .meta-bar {
                gap: var(--spacing-md);
            }
            
            .stat-value {
                font-size: 32px;
            }
            
            /* 移动端表格优化 - 使用卡片式布局 */
            table, thead, tbody, th, td, tr {
                display: block;
            }
            
            thead tr {
                position: absolute;
                top: -9999px;
                left: -9999px;
            }
            
            tbody tr {
                margin: var(--spacing-md) 0;
                padding: var(--spacing-md);
                background: var(--bg-card);
                border-radius: var(--radius-lg);
                border: 1px solid var(--border-color);
            }
            
            td {
                border: none;
                padding: var(--spacing-sm) 0;
                position: relative;
                padding-left: 0;
            }
            
            td:first-child {
                padding-top: 0;
            }
            
            td:last-child {
                padding-bottom: 0;
            }
            
            /* 移动端隐藏分析卡片，使用内联显示 */
            .analysis-row {
                display: none;
            }
            
            .scroll-top {
                bottom: 24px;
                right: 24px;
                width: 44px;
                height: 44px;
            }
        }
        
        @media (max-width: 480px) {
            .logo-icon {
                width: 48px;
                height: 48px;
                font-size: 24px;
            }
            
            .logo-text h1 {
                font-size: 20px;
            }
            
            .logo-text p {
                font-size: 13px;
            }
            
            .stat-value {
                font-size: 28px;
            }
            
            .stat-label {
                font-size: 12px;
            }
            
            td {
                font-size: 12px;
            }
        }
        
        /* ========================================
           Print Styles
        ======================================== */
        @media print {
            body {
                background: white;
                color: black;
            }
            
            .scroll-top {
                display: none;
            }
            
            .analysis-card {
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header>
            <div class="header-content">
                <div class="logo">
                    <div class="logo-icon">🚀</div>
                    <div class="logo-text">
                        <h1>GitHub AI 项目每日简报</h1>
                        <p>追踪技术前沿 · 发现优质项目</p>
                    </div>
                </div>
                <div class="header-actions">
                    <a href="index.html" class="btn">
                        <span>←</span>
                        <span>返回首页</span>
                    </a>
                    <button class="btn btn-primary" onclick="window.print()">
                        <span>📄</span>
                        <span>打印简报</span>
                    </button>
                </div>
            </div>
            <div class="meta-bar">
                <div class="meta-item">
                    <span class="meta-icon">📅</span>
                    <span class="meta-value">${date}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">⏰</span>
                    <span class="meta-value">${now}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">📊</span>
                    <span class="meta-value">GitHub Trending (24h)</span>
                </div>
            </div>
        </header>
        
        <!-- Stats Section -->
        <div class="stats">
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${totalProjects}</div>
                    <div class="stat-label">热门项目</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${aiProjects}</div>
                    <div class="stat-label">AI 相关</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${avgStars}</div>
                    <div class="stat-label">平均 Stars</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${summary?.hotProjectCount || 0}</div>
                    <div class="stat-label">高热项目</div>
                </div>
            </div>
        </div>
        
        <!-- Insights Section -->
        <div class="insights">
            <div id="insights-content"></div>
        </div>
        
        <!-- Projects Table -->
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 60px;">排名</th>
                        <th>项目</th>
                        <th>描述</th>
                        <th>语言</th>
                        <th style="width: 100px;">今日增长</th>
                        <th style="width: 100px;">总 Stars</th>
                    </tr>
                </thead>
                <tbody>${projectRows}</tbody>
            </table>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <p>由 <a href="#">OpenClaw</a> 自动生成 · 数据来自 GitHub Trending · 每日更新</p>
        </div>
    </div>
    
    <!-- Scroll to Top Button -->
    <button class="scroll-top" id="scroll-top" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">↑</button>
    
    <script>
        // Parse and render markdown
        const insightsMd = ${JSON.stringify(insightsMd)};
        document.getElementById('insights-content').innerHTML = marked.parse(insightsMd);
        
        // Scroll to top button visibility
        const scrollTopBtn = document.getElementById('scroll-top');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        });
        
        // Add target="_blank" and rel="noopener noreferrer" to external links
        document.querySelectorAll('a[href^="http"]').forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });
        
        // Animate stats on load
        document.addEventListener('DOMContentLoaded', () => {
            const statItems = document.querySelectorAll('.stat-item');
            statItems.forEach((item, index) => {
                item.style.opacity = '0';
                item.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                }, index * 100);
            });
        });
    </script>
</body>
</html>`;
}

function generateIndexHtml(data) {
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('github-ai-trending-') && f.endsWith('.html'))
        .map(f => f.replace('github-ai-trending-', '').replace('.html', '')).sort().reverse();
    const briefItems = files.map(d => `<a href="github-ai-trending-${d}.html" class="brief-item"><div><div class="brief-date">${d}</div><div class="brief-title">GitHub AI 项目每日简报</div></div><div class="brief-arrow">→</div></a>`).join('');
    const totalProjects = data?.stats?.totalProjects || data?.projects?.length || 0;
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>🚀 GitHub AI 每日简报</title><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@300;400;500;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>:root{--bg-primary:#0a0e17;--bg-secondary:#111827;--bg-card:#1a2332;--text-primary:#f0f4f8;--text-secondary:#94a3b8;--accent-primary:#3b82f6;--accent-gradient:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%);--border-color:#1e293b;}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Noto Sans SC',sans-serif;background:var(--bg-primary);color:var(--text-primary);min-height:100vh}.container{max-width:800px;margin:0 auto;padding:48px 24px}.logo{display:flex;align-items:center;gap:16px;margin-bottom:8px}.logo-icon{width:48px;height:48px;background:var(--accent-gradient);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px}h1{font-family:'Outfit',sans-serif;font-size:32px;font-weight:600;background:var(--accent-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.subtitle{color:var(--text-secondary);margin-bottom:32px}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:40px}.stat-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:24px;text-align:center}.stat-value{font-size:36px;font-weight:bold;background:var(--accent-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-family:'Outfit',sans-serif}.stat-label{color:var(--text-secondary);font-size:13px;margin-top:8px}.brief-list{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:24px}.brief-list h2{font-size:18px;margin-bottom:20px;padding-left:12px;border-left:3px solid var(--accent-primary)}.brief-item{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;margin-bottom:12px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border-color);text-decoration:none;color:inherit;transition:all 0.2s}.brief-item:hover{border-color:var(--accent-primary);transform:translateX(8px)}.brief-date{font-weight:600;color:var(--text-primary);font-family:'JetBrains Mono',monospace}.brief-title{color:var(--text-secondary);font-size:13px;margin-top:4px}.brief-arrow{color:var(--accent-primary);font-size:18px}.footer{text-align:center;margin-top:48px;padding-top:24px;border-top:1px solid var(--border-color);color:var(--text-secondary);font-size:13px}</style></head><body><div class="container"><div class="logo"><div class="logo-icon">🚀</div><h1>GitHub AI 每日简报</h1></div><p class="subtitle">追踪技术前沿，发现优质项目</p><div class="stats"><div class="stat-card"><div class="stat-value">${files.length}</div><div class="stat-label">简报总数</div></div><div class="stat-card"><div class="stat-value">${totalProjects}</div><div class="stat-label">收录项目</div></div></div><div class="brief-list"><h2>历史简报</h2>${briefItems}</div><div class="footer">由 OpenClaw 自动生成 | 每日更新</div></div></body></html>`;
}

async function getFeishuToken() {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET });
        const req = https.request({ hostname: 'open.feishu.cn', port: 443, path: '/open-apis/auth/v3/tenant_access_token/internal', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 }, (res) => {
            let data = ''; res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data).tenant_access_token); } catch (e) { reject(e); } });
        });
        req.on('error', reject); req.write(body); req.end();
    });
}

async function sendFeishuNotification(date, token, data, insights) {
    const reportUrl = `${REPORT_BASE_URL}/github-ai-trending-${date}.html`;
    
    // 获取 TOP 5 项目
    const sortedProjects = [...data.projects].sort((a, b) => {
        const aStars = parseInt(a.todayStars.replace(/,/g, '')) || 0;
        const bStars = parseInt(b.todayStars.replace(/,/g, '')) || 0;
        return bStars - aStars;
    });
    const top5 = sortedProjects.slice(0, 5);
    
    const totalProjects = data.stats?.totalProjects || data.projects.length;
    
    // 构建项目列表内容
    const topProjectsContent = [];
    top5.forEach((p, i) => {
        const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i];
        const desc = (p.descZh || p.desc || '暂无描述').substring(0, 80) + ((p.descZh || p.desc || '').length > 80 ? '...' : '');
        topProjectsContent.push(
            [{ tag: 'text', text: `${emoji} ${p.repo} - ⭐ ${p.todayStars}\n` }],
            [{ tag: 'text', text: `${desc}\n` }],
            [{ tag: 'text', text: `🏷️ ${p.language || '未知'}\n\n` }]
        );
    });
    
    // 构建完整内容数组
    const contentArray = [
        [{ tag: 'text', text: `📊 今日概览\n` }],
        [{ tag: 'text', text: `今日新增 ${totalProjects} 个热门项目，涵盖多个技术领域\n` }],
        [{ tag: 'hr' }],
        [{ tag: 'text', text: `🔥 热门项目 TOP 5\n\n` }]
    ];
    
    // 添加 TOP5 项目
    topProjectsContent.forEach(item => {
        contentArray.push(item);
    });
    
    // 继续添加其他内容
    contentArray.push(
        [{ tag: 'hr' }],
        [{ tag: 'text', text: `💡 核心洞察\n` }],
        [{ tag: 'text', text: `${insights.hot[0] || '暂无'}\n\n` }],
        [{ tag: 'hr' }],
        [{ tag: 'text', text: `📈 趋势分析\n` }],
        [{ tag: 'text', text: `短期：${insights.shortTerm[0] || '暂无'}\n\n` }],
        [{ tag: 'text', text: `长期：${insights.longTerm[0] || '暂无'}\n\n` }],
        [{ tag: 'hr' }],
        [{ tag: 'text', text: `🎯 行动建议\n` }],
        [{ tag: 'text', text: `${insights.action[0] || '暂无'}\n\n` }],
        [{ tag: 'hr' }],
        [{ tag: 'text', text: `\n📋 查看详细报告：\n${reportUrl}\n\n` }],
        [{ tag: 'text', text: `⏰ 更新时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` }]
    );
    
    const content = {
        zh_cn: {
            title: `🚀 GitHub 热门项目日报 (${date})`,
            content: contentArray
        }
    };
    
    const body = JSON.stringify({ 
        receive_id: FEISHU_RECEIVE_ID, 
        msg_type: 'post', 
        content: JSON.stringify(content) 
    });
    
    return new Promise((resolve, reject) => {
        const req = https.request({ 
            hostname: 'open.feishu.cn', 
            port: 443, 
            path: '/open-apis/im/v1/messages?receive_id_type=open_id', 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}`,
                'Content-Length': Buffer.byteLength(body) 
            }, 
            timeout: 10000 
        }, (res) => {
            let data = ''; 
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject); 
        req.write(body); 
        req.end();
    });
}

// WeLink 发送消息（Webhook 方式）
async function sendWeLinkNotification(date, data, insights, webhookUrl) {
    const reportUrl = `${REPORT_BASE_URL}/github-ai-trending-${date}.html`;
    
    // 获取 TOP 5 项目
    const sortedProjects = [...data.projects].sort((a, b) => {
        const aStars = parseInt(a.todayStars.replace(/,/g, '')) || 0;
        const bStars = parseInt(b.todayStars.replace(/,/g, '')) || 0;
        return bStars - aStars;
    });
    const top5 = sortedProjects.slice(0, 5);
    
    const totalProjects = data.stats?.totalProjects || data.projects.length;
    
    // 构建文本消息内容（WeLink webhook 主要支持 text 类型，限制 500 字符）
    let text = `🚀 GitHub 热门项目日报 (${date})\n\n`;
    text += `📊 今日概览：${totalProjects} 个热门项目\n\n`;
    text += `🔥 TOP5 项目：\n`;
    
    top5.forEach((p, i) => {
        const emoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
        text += `${emoji} ${p.repo} +${p.todayStars}⭐\n`;
    });
    
    text += `\n💡 核心洞察：\n`;
    text += `${insights.hot[0] ? insights.hot[0].substring(0, 80) + '...' : '暂无'}\n\n`;
    text += `📋 完整报告：\n${reportUrl}\n`;
    
    // 生成 UUID 和时间戳
    const uuid = crypto.randomUUID();
    const timeStamp = Date.now();
    
    const body = JSON.stringify({
        messageType: 'text',
        content: {
            text: text
        },
        timeStamp: timeStamp,
        uuid: uuid,
        isAtAll: false
    });
    
    // 解析 webhook URL
    const webhookUrlObj = new URL(webhookUrl);
    const path = webhookUrlObj.pathname + webhookUrlObj.search;
    
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: webhookUrlObj.hostname,
            port: 443,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Charset': 'UTF-8',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: 10000
        }, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.code === '0' || result.code === 0 || result.errCode === 0) {
                        resolve(JSON.stringify(result));
                    } else {
                        reject(new Error(`WeLink 发送失败：${result.message || result.errMsg || result.errMsgEn || JSON.stringify(result)}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// 更新日报列表页
function updateDailyIndex(data) {
    const dailyDir = path.join(ROOT_DIR, 'reports', 'daily');
    const indexFile = path.join(dailyDir, 'index.html');
    
    if (!fs.existsSync(indexFile)) {
        console.log('⚠️ 日报列表页不存在，跳过更新');
        return;
    }
    
    let html = fs.readFileSync(indexFile, 'utf8');
    
    // 检查是否已存在今天的报告
    if (html.includes(`github-ai-trending-${data.date}.html`)) {
        console.log('ℹ️ 列表页已包含今日报告，跳过更新');
        return;
    }
    
    // 计算今日总 Stars
    const totalStars = data.projects.reduce((sum, p) => {
        const stars = parseInt(p.todayStars?.replace(/,/g, '') || '0');
        return sum + stars;
    }, 0);
    
    const newEntry = `      <div class="report-item" onclick="location.href='github-ai-trending-${data.date}.html'">
        <div class="report-info">
          <div class="report-icon">📅</div>
          <div class="report-meta">
            <h3>${data.date}</h3>
            <p>${data.date}</p>
          </div>
        </div>
        <div class="report-stats">
          <span class="report-stat"><strong>+${totalStars.toLocaleString()}</strong> Stars</span>
          <span class="report-stat"><strong>${data.projects.length}</strong> 个项目</span>
        </div>
        <span class="report-arrow">→</span>
      </div>
      
`;
    
    // 在 reports-list 开头插入新条目
    html = html.replace('<div class="reports-list">', '<div class="reports-list">\n' + newEntry);
    fs.writeFileSync(indexFile, html, 'utf8');
    console.log('✅ 日报列表页已更新');
}

async function main() {
    // 检查是否跳过通知（调试模式）
    // 默认跳过通知（调试模式），只有 SKIP_NOTIFY=0 时才发送
const skipNotify = process.env.SKIP_NOTIFY !== '0';
    
    console.log('🦞 生成 HTML（AI 洞察已就绪）');
    const data = loadData();
    const insights = loadInsights();
    console.log(`📊 数据：${data.date}, ${data.projects.length} 个项目`);
    console.log(`💡 洞察：热点${insights.hot.length}条，短期${insights.shortTerm.length}条，长期${insights.longTerm.length}条，建议${insights.action.length}条`);
    
    const html = generateHtml(data, insights);
    const htmlFile = path.join(OUTPUT_DIR, `github-ai-trending-${data.date}.html`);
    fs.writeFileSync(htmlFile, html, 'utf8');
    console.log(`✅ HTML 已生成：${htmlFile}`);
    
    // 移动到 reports/daily 目录
    const dailyDir = path.join(ROOT_DIR, 'reports', 'daily');
    if (!fs.existsSync(dailyDir)) fs.mkdirSync(dailyDir, { recursive: true });
    const dailyFile = path.join(dailyDir, `github-ai-trending-${data.date}.html`);
    fs.copyFileSync(htmlFile, dailyFile);
    console.log(`✅ 已复制到日报目录：${dailyFile}`);
    
    // 更新日报列表页
    updateDailyIndex(data);
    
    // fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), generateIndexHtml(data), 'utf8');
    // console.log('✅ 首页已更新');
    // 首页由 generate-index-stats.js 统一管理，避免覆盖新版 Tab 切换首页
    
    if (!skipNotify) {
        try {
            const token = await getFeishuToken();
            const result = await sendFeishuNotification(data.date, token, data, insights);
            console.log('✅ 飞书已发送，响应:', result.substring(0, 100));
        } catch (e) { console.error('❌ 飞书失败:', e.message); }
        
        // WeLink 推送（支持多个机器人）
        for (const url of WELINK_WEBHOOK_URLS) {
            if (url && url.includes('token=')) {
                try {
                    const weLinkResult = await sendWeLinkNotification(data.date, data, insights, url);
                    console.log('✅ WeLink 已发送至:', url.substring(0, 50) + '...', '响应:', weLinkResult.substring(0, 50));
                } catch (e) { console.error('❌ WeLink 发送失败 (' + url.substring(0, 50) + '):', e.message); }
            }
        }
    } else {
        console.log('⏭️  跳过通知推送（调试模式）');
    }
    
    const state = loadState();
    state.lastProcessedAt = data.generatedAt;
    saveState(state);
    console.log('✅ 完成！');
}

main().catch(console.error);
