/**
 * CLI Reporter - 终端输出报告
 */

const path = require('path');

/**
 * 生成状态图标
 */
function getStatusIcon(status) {
  switch (status) {
    case 'pass': return '✅';
    case 'warning': return '⚠️ ';
    case 'fail': return '❌';
    default: return '❓';
  }
}

/**
 * 生成状态颜色（ANSI 转义码）
 */
function getStatusColor(status) {
  switch (status) {
    case 'pass': return '\x1b[32m'; // Green
    case 'warning': return '\x1b[33m'; // Yellow
    case 'fail': return '\x1b[31m'; // Red
    default: return '\x1b[37m'; // White
  }
}

/**
 * 计算健康度分数
 */
function calculateHealthScore(results) {
  let totalScore = 0;
  let maxScore = 0;

  for (const result of results) {
    const weight = 1; // 每个检查项权重相同
    maxScore += weight;

    switch (result.status) {
      case 'pass':
        totalScore += weight;
        break;
      case 'warning':
        totalScore += weight * 0.5;
        break;
      case 'fail':
        totalScore += 0;
        break;
    }
  }

  return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
}

/**
 * 获取健康度评级
 */
function getHealthRating(score) {
  if (score >= 90) return '优秀';
  if (score >= 80) return '良好';
  if (score >= 70) return '中等';
  if (score >= 60) return '及格';
  return '需改进';
}

/**
 * 获取健康度颜色
 */
function getHealthColor(score) {
  if (score >= 80) return '\x1b[32m'; // Green
  if (score >= 60) return '\x1b[33m'; // Yellow
  return '\x1b[31m'; // Red
}

/**
 * 生成 CLI 报告
 */
function generateReport(inspectResult) {
  const { timestamp, summary, results, categoryResults } = inspectResult;
  const lines = [];
  const reset = '\x1b[0m';

  // 标题
  lines.push('');
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('  Wiki 健康检查报告');
  lines.push(`  检查时间：${timestamp}`);
  lines.push(`  项目总数：${summary.totalProjects}`);
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('');

  // 按类别分组输出
  const categories = {
    structure: '结构完整性检查',
    quality: '数据质量检查',
    relation: '关联性检查'
  };

  for (const [categoryId, categoryName] of Object.entries(categories)) {
    const categoryData = categoryResults[categoryId] || [];
    if (categoryData.length === 0) continue;

    lines.push(`${getStatusColor('pass')}│${reset} ${categoryName}`);
    lines.push(`${getStatusColor('pass')}├─${reset}${'─'.repeat(50)}`);

    for (const result of categoryData) {
      const icon = getStatusIcon(result.status);
      const color = getStatusColor(result.status);
      const name = result.name.padEnd(25, ' ');
      lines.push(`${color}${icon}${reset} ${name} ${result.message}`);
    }

    lines.push('');
  }

  // 总体健康度
  const healthColor = getHealthColor(summary.healthScore);
  const healthRating = getHealthRating(summary.healthScore);

  lines.push('════════════════════════════════════════════════════════════════');
  lines.push(`${healthColor}  总体健康度：${summary.healthScore}/100 (${healthRating})${reset}`);
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('');

  // 问题汇总
  const issues = results.filter(r => r.status !== 'pass');
  if (issues.length > 0) {
    lines.push('  需要关注的问题:');

    for (let i = 0; i < issues.length; i++) {
      lines.push(`  ${i + 1}. ${issues[i].message}`);
    }

    lines.push('');
    lines.push('  修复建议:');

    // 收集所有修复命令
    const fixCommands = new Set();
    for (const issue of issues) {
      if (issue.fixCommand) {
        fixCommands.add(issue.fixCommand);
      }
    }

    if (fixCommands.size > 0) {
      for (const cmd of fixCommands) {
        lines.push(`  • ${cmd}`);
      }
    } else {
      lines.push('  无自动修复建议，请手动处理');
    }

    lines.push('');
  } else {
    lines.push('  🎉 所有检查项通过，Wiki 健康状况良好！');
    lines.push('');
  }

  // 统计摘要
  lines.push('────────────────────────────────────────────────────────────────────');
  lines.push(`  通过：${summary.passedChecks}  警告：${summary.warningChecks}  失败：${summary.failedChecks}`);
  lines.push('────────────────────────────────────────────────────────────────────');
  lines.push('');

  return lines.join('\n');
}

/**
 * 生成简要报告（用于 CI/CD）
 */
function generateBriefReport(inspectResult) {
  const { summary, results } = inspectResult;
  const lines = [];
  const reset = '\x1b[0m';

  const failed = results.filter(r => r.status === 'fail');
  const warnings = results.filter(r => r.status === 'warning');

  if (failed.length > 0) {
    lines.push(`\x1b[31m❌ Wiki 健康检查失败：${failed.length} 项失败，${warnings.length} 项警告\x1b[0m`);
  } else if (warnings.length > 0) {
    lines.push(`\x1b[33m⚠️  Wiki 健康检查警告：${warnings.length} 项警告\x1b[0m`);
  } else {
    lines.push(`\x1b[32m✅ Wiki 健康检查通过：${results.length} 项全部通过\x1b[0m`);
  }

  lines.push(`健康度：${summary.healthScore}/100`);

  return lines.join('\n');
}

module.exports = {
  generateReport,
  generateBriefReport,
  calculateHealthScore,
  getHealthRating
};
