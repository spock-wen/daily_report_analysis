'use strict';

/**
 * 检查器用例 VM 构造（唯一实现）
 *
 * cases_r5/r9/r10 等夹具只写 insights（AI 输出），页面字段（hero/metrics/cmp/
 * rankRows/…）一律由 brief 经 buildViewModel 生成后注入检查器。
 * 生成端（scripts/generate-sample.js）与检查器（src/checker/index.js evaluateCase）
 * 共用这里一处实现，避免两侧各写一份导致行为漂移。
 *
 * 构造失败直接抛错，由调用方记为错误/FAIL，不得静默吞掉。
 */

function buildCaseViewModel({ brief, insights, facts, date }) {
  if (!brief || typeof brief !== 'object') return undefined;
  const { buildViewModel } = require('../generator/daily-v3-view-model');
  const projects = brief.projects || brief.trending_repos || [];
  const stats = brief.stats || {};
  const reportData = {
    ...brief,
    date: date || brief.date,
    projects,
    trending_repos: projects,
    stats,
    aiInsights: insights || null,
    brief: {
      ...brief,
      trending_repos: projects,
      stats,
      generated_at: brief.generatedAt,
    },
    facts,
    dailyDiff: brief.dailyDiff,
    streakDays: brief.streakDays,
    caption: brief.caption,
    isSample: true,
  };
  return buildViewModel(reportData);
}

module.exports = { buildCaseViewModel };
