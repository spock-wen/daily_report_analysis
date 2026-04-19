/**
 * JSON Reporter - JSON 格式报告输出
 */

/**
 * 生成 JSON 报告
 */
function generateReport(inspectResult) {
  return JSON.stringify(inspectResult, null, 2);
}

/**
 * 生成简化版 JSON 报告（用于 CI/CD 判断）
 */
function generateCiCdReport(inspectResult) {
  const { summary, results } = inspectResult;

  return JSON.stringify({
    success: summary.failedChecks === 0,
    healthScore: summary.healthScore,
    totalChecks: results.length,
    passedChecks: summary.passedChecks,
    warningChecks: summary.warningChecks,
    failedChecks: summary.failedChecks,
    failed: results.filter(r => r.status === 'fail').map(r => ({
      name: r.name,
      message: r.message
    })),
    timestamp: inspectResult.timestamp
  }, null, 2);
}

module.exports = {
  generateReport,
  generateCiCdReport
};
