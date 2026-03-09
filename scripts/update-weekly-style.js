#!/usr/bin/env node

/**
 * 更新周报 HTML 模板以匹配日报风格
 */

const fs = require('fs');
const path = require('path');

const htmlGeneratorPath = path.join(__dirname, '../src/generator/html-generator.js');

// 读取文件
let content = fs.readFileSync(htmlGeneratorPath, 'utf8');

// 找到并替换 renderWeeklyHTML 方法的 CSS 部分
const newWeeklyCSS = `  /**
   * 渲染周报 HTML
   * @param {Object} data - 周报数据
   * @returns {string} HTML 字符串
   */
  renderWeeklyHTML(data) {
    const { brief, aiInsights, weekStart, weekEnd, weekLabel } = data;
    const trendingRepos = brief?.trending_repos || [];
    const stats = brief?.stats || {};

    return \`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub AI Trending 周报 - \${weekLabel || weekStart}</title>
    <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-card: #161b22;
      --text-primary: #c9d1d9;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --accent: #58a6ff;
      --accent-green: #3fb950;
      --accent-orange: #d29922;
      --border: #30363d;
      --border-light: #21262d;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
      padding: 24px 16px;
      font-size: 13px;
    }
    
    .container {
      max-width: 960px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      padding: 32px 0 24px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 32px;
    }
    
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
    }
    
    .date {
      color: var(--text-secondary);
      font-size: 0.8125rem;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 24px;
    }
    
    .stat-card {
      background: var(--bg-card);
      padding: 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      text-align: center;
    }
    
    .stat-value {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--accent-green);
      line-height: 1.2;
    }
    
    .stat-value .star-icon {
      color: #fbbf24;
      width: 20px;
      height: 20px;
      vertical-align: middle;
      display: inline-block;
    }
    
    .stat-value .star-icon + span {
      vertical-align: middle;
      display: inline-block;
    }
    
    .stat-label {
      color: var(--text-secondary);
      margin-top: 4px;
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    
    section {
      margin-bottom: 24px;
    }
    
    h2 {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
    }
    
    .insight-section {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 24px;
    }
    
    .insight-block {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-light);
    }
    
    .insight-block:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    
    .insight-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .insight-content {
      font-size: 0.8125rem;
      line-height: 1.6;
      color: var(--text-secondary);
    }
    
    .insight-content a {
      color: var(--accent);
      text-decoration: none;
    }
    
    .insight-content a:hover {
      text-decoration: underline;
    }
    
    .theme-box {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 24px;
    }
    
    .theme-text {
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--text-primary);
    }
    
    .project-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .project-card {
      background: var(--bg-card);
      padding: 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      transition: border-color 0.2s;
    }
    
    .project-card:hover {
      border-color: var(--text-muted);
    }
    
    .project-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--accent);
      text-decoration: none;
      line-height: 1.4;
      display: block;
      margin-bottom: 6px;
    }
    
    .project-name:hover {
      text-decoration: underline;
    }
    
    .project-description {
      font-size: 0.75rem;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 8px;
    }
    
    .project-stats {
      display: flex;
      gap: 12px;
      font-size: 0.6875rem;
      color: var(--text-secondary);
    }
    
    .project-stats span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .category-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    
    .category-card {
      background: var(--bg-card);
      padding: 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
    }
    
    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .category-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .category-count {
      font-size: 0.6875rem;
      color: var(--text-secondary);
    }
    
    .category-list {
      list-style: none;
    }
    
    .category-list li {
      font-size: 0.75rem;
      padding: 4px 0;
    }
    
    .category-list a {
      color: var(--accent);
      text-decoration: none;
    }
    
    .category-list a:hover {
      text-decoration: underline;
    }
    
    footer {
      text-align: center;
      padding: 24px 0;
      border-top: 1px solid var(--border);
      margin-top: 32px;
      color: var(--text-secondary);
      font-size: 0.6875rem;
    }
    
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .project-grid {
        grid-template-columns: 1fr;
      }
      
      .category-grid {
        grid-template-columns: 1fr;
      }
    }
    </style>
</head>
<body>
    <div class="container">
        \${this.renderHeader(weekLabel, weekStart, weekEnd)}
        \${this.renderWeeklyStats(stats, trendingRepos)}
        \${this.renderWeeklyTheme(aiInsights, trendingRepos)}
        \${this.renderAIInsights(aiInsights, trendingRepos)}
        \${this.renderTopProjects(aiInsights, trendingRepos)}
        \${this.renderProjectGroups(trendingRepos)}
        \${this.renderFooter()}
    </div>
</body>
</html>\`;
  }`;

// 替换 renderWeeklyHTML 方法
const oldMethodRegex = /  \/\*\*\n   \* 渲染周报 HTML\n   \* @param \{Object\} data - 周报数据\n   \* @returns \{string\} HTML 字符串\n   \*\/\n  renderWeeklyHTML\(data\) \{[\s\S]*?\n  \}\n\n  \/\*\*\n   \* 渲染周报 Header/g;

const replacement = newWeeklyCSS + '\n\n  /**\n   * 渲染周报 Header';

content = content.replace(oldMethodRegex, replacement);

// 写回文件
fs.writeFileSync(htmlGeneratorPath, content, 'utf8');

console.log('✅ 周报 HTML 模板已更新为日报风格');
