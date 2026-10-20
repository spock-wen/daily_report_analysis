const history = require('./history');
const daily = require('./daily-metrics');
const weekly = require('./weekly-metrics');
const monthly = require('./monthly-metrics');

module.exports = {
  ...history,
  DAILY_CAPTION: daily.DAILY_CAPTION,
  WEEKLY_CAPTION: weekly.WEEKLY_CAPTION,
  MONTHLY_CAPTION: monthly.MONTHLY_CAPTION,
  computeDailyMetrics: daily.computeDailyMetrics,
  enrichDailyBrief: daily.enrichDailyBrief,
  computeWeeklyMetrics: weekly.computeWeeklyMetrics,
  enrichWeeklyBrief: weekly.enrichWeeklyBrief,
  computeMonthlyMetrics: monthly.computeMonthlyMetrics,
  enrichMonthlyBrief: monthly.enrichMonthlyBrief,
};
