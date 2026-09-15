#!/usr/bin/env node
/**
 * 补跑日报 AI 分析 + HTML 生成
 * 用法: node scripts/backfill-insights.js 2026-09-11 2026-09-12 2026-09-13 2026-09-14
 */

const path = require('path');
const fs = require('fs');
const { callLLM } = require('../src/utils/llm');
const { writeJson } = require('../src/utils/fs');
const { getAIInsightsPath, getDailyReportPath } = require('../src/utils/path');
const logger = require('../src/utils/logger');
const HTMLGenerator = require('../src/generator/html-generator');
const InsightAnalyzer = require('../src/analyzer/insight-analyzer');

async function main() {
  const dates = process.argv.slice(2);
  if (!dates.length) {
    console.error('用法: node scripts/backfill-insights.js <date1> <date2> ...');
    process.exit(1);
  }

  const analyzer = new InsightAnalyzer();
  const generator = new HTMLGenerator();

  for (const date of dates) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📅 补跑 ${date}`);
    console.log(`${'='.repeat(60)}`);

    const briefPath = path.join(__dirname, `../data/briefs/daily/data-${date}.json`);
    if (!fs.existsSync(briefPath)) {
      console.error(`❌ 数据文件不存在: ${briefPath}`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(briefPath, 'utf-8'));
    const projects = data.projects || [];
    if (!projects.length) {
      console.error(`❌ ${date} 无项目数据`);
      continue;
    }

    // 构建 analysisData（跟 pipeline 一致）
    const analysisData = {
      ...data,
      brief: {
        projects: projects,
        stats: data.stats || {},
        generatedAt: data.generatedAt || new Date().toISOString()
      },
      date: data.date || date
    };

    try {
      console.log(`🤖 AI 分析中...`);
      const insights = await analyzer.analyzeDaily(analysisData);

      // 保存 insights
      const insightsPath = getAIInsightsPath('daily', date);
      await writeJson(insightsPath, insights);
      console.log(`✅ Insights 已保存: ${insightsPath}`);

      // 重新生成 HTML
      const reportData = {
        ...data,
        date: data.date || date,
        projects: projects,
        trending_repos: projects,
        stats: data.stats || {
          totalProjects: projects.length,
          aiProjects: projects.filter(r => r.isAI).length,
          avgStars: Math.round(projects.reduce((s, p) => s + (p.stars || 0), 0) / projects.length)
        },
        brief: {
          trending_repos: projects,
          stats: data.stats || {},
          period: '每日',
          generated_at: data.generatedAt || new Date().toISOString()
        },
        aiInsights: insights
      };

      const htmlPath = await generator.generateDaily(reportData);
      console.log(`✅ HTML 已生成: ${htmlPath}`);

      // 验证
      const html = fs.readFileSync(htmlPath, 'utf-8');
      const hasFallback = html.includes('AI 分析服务暂时不可用');
      console.log(`${hasFallback ? '⚠️  仍有降级文本' : '✅ 无降级文本'}`);
    } catch (error) {
      console.error(`❌ ${date} 失败: ${error.message}`);
    }
  }
}

main().catch(err => {
  console.error('脚本异常:', err);
  process.exit(1);
});
