#!/usr/bin/env node
'use strict';

/**
 * 历史期样例生成（S2/S5）
 *
 * 用法：
 *   node scripts/generate-sample.js <daily|weekly|monthly> <期次> [--out-dir D] [--data-dir D] [--write-html-on-fail]
 *
 * 期次：2026-10-12 / 2026-W42 / 2026-09
 *
 * 只读取既有 brief，不抓取 GitHub；强制 REPORT_NO_PUSH=1、REPORT_NO_WIKI=1，
 * 不调用 notifier、wiki-sync、git push 或首页生成。
 *
 * 退出码：0 = PASS；1 = 核查 FAIL（未写 HTML）或执行失败；2 = 参数/数据错误。
 */

const fs = require('fs');
const path = require('path');
const history = require('../src/metrics/history');

const ROOT_DIR = path.join(__dirname, '..');
const LEVELS = ['daily', 'weekly', 'monthly'];
const PERIOD_RES = {
  daily: /^\d{4}-\d{2}-\d{2}$/,
  weekly: /^\d{4}-W\d{2}$/,
  monthly: /^\d{4}-\d{2}$/,
};

const LEGACY_BRIEF_KEYS = [
  'aiInsights',
  'coreFunctions',
  'useCases',
  'trends',
  'core_features',
  'use_cases',
  'trend_data',
];

function parseArgs(argv) {
  const result = { positional: [], options: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      result.positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      result.options[key] = next;
      i += 1;
    } else {
      result.options[key] = true;
    }
  }
  return result;
}

function isValidPeriod(level, period) {
  if (!PERIOD_RES[level].test(period)) return false;

  if (level === 'daily') {
    return history.formatDate(history.parseDate(period)) === period;
  }
  if (level === 'weekly') {
    const start = history.getISOWeekStart(period);
    return Boolean(start) && history.getISOWeekId(start) === period;
  }
  const month = Number(period.slice(5));
  return month >= 1 && month <= 12;
}

function printUsage() {
  console.error(`用法：node scripts/generate-sample.js <daily|weekly|monthly> <期次> [--out-dir D] [--data-dir D] [--write-html-on-fail]

期次示例：
  daily   2026-10-12
  weekly  2026-W42
  monthly 2026-09

选项：
  --data-dir D          既有 brief/insights 的源数据目录（默认 ./data）
  --out-dir D           输出根目录，写入其下 data/、reports/、check/（默认仓库根目录）
  --write-html-on-fail  核查 FAIL 时仍写 HTML 供审阅，文件名带 .FAIL 标记`);
}

function briefFileName(level, period) {
  if (level === 'daily') return `data-${period}.json`;
  if (level === 'weekly') return `data-weekly-${period}.json`;
  return `data-month-${period}.json`;
}

function insightFileName(period) {
  return `insights-${period}.json`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileIfNeeded(srcPath, destPath) {
  if (path.resolve(srcPath) === path.resolve(destPath)) return false;
  if (!fs.existsSync(srcPath)) return false;
  ensureDir(path.dirname(destPath));
  fs.copyFileSync(srcPath, destPath);
  return true;
}

function listDailyDates(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .map(name => {
      const match = /^data-(\d{4}-\d{2}-\d{2})\.json$/.exec(name);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .sort();
}

function listDailyInsightDates(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .map(name => {
      const match = /^insights-(\d{4}-\d{2}-\d{2})\.json$/.exec(name);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .sort();
}

function copySupportingData(sourceDataDir, outDataDir, level, period) {
  const copy = (relativePath) => {
    copyFileIfNeeded(
      path.join(sourceDataDir, relativePath),
      path.join(outDataDir, relativePath)
    );
  };

  const sourceBriefsDaily = path.join(sourceDataDir, 'briefs', 'daily');
  const sourceInsightsDaily = path.join(sourceDataDir, 'insights', 'daily');

  const copyDailyBriefs = (dates) => {
    for (const date of dates) {
      copy(path.join('briefs', 'daily', `data-${date}.json`));
    }
  };

  const copyDailyInsights = (dates) => {
    for (const date of dates) {
      copy(path.join('insights', 'daily', `insights-${date}.json`));
    }
  };

  if (level === 'daily') {
    const from = history.addDays(period, -30);
    const briefDates = listDailyDates(sourceBriefsDaily).filter(date => date >= from && date <= period);
    copyDailyBriefs(briefDates);

    const insightDates = listDailyInsightDates(sourceInsightsDaily).filter(date => date >= from && date < period);
    copyDailyInsights(insightDates);
    return;
  }

  if (level === 'weekly') {
    const dates = history.getISOWeekDates(period);
    const from = history.addDays(dates[0], -30);
    const end = dates[6];

    const briefDates = listDailyDates(sourceBriefsDaily).filter(date => date >= from && date <= end);
    copyDailyBriefs(briefDates);

    const insightDates = listDailyInsightDates(sourceInsightsDaily).filter(date => date >= dates[0] && date <= end);
    copyDailyInsights(insightDates);

    const weeks = [
      period,
      history.shiftISOWeek(period, -1),
      history.shiftISOWeek(period, -2),
    ].filter(Boolean);

    for (const week of weeks.slice(0, 2)) {
      copy(path.join('briefs', 'weekly', `data-weekly-${week}.json`));
    }
    for (const week of weeks.slice(1)) {
      copy(path.join('insights', 'weekly', `insights-${week}.json`));
    }
    return;
  }

  const monthDates = history.getMonthDates(period);
  const prevMonth = history.getPrevMonth(period);
  const prevMonthDates = history.getMonthDates(prevMonth);
  const start = prevMonthDates[0] || monthDates[0];
  const end = monthDates[monthDates.length - 1];

  const briefDates = listDailyDates(sourceBriefsDaily).filter(date => date >= start && date <= end);
  copyDailyBriefs(briefDates);

  for (const week of history.getWeeksInMonth(period)) {
    copy(path.join('insights', 'weekly', `insights-${week}.json`));
  }

  copy(path.join('briefs', 'monthly', `data-month-${period}.json`));
  if (prevMonth) {
    copy(path.join('briefs', 'monthly', `data-month-${prevMonth}.json`));
    const prevPrevMonth = history.getPrevMonth(prevMonth);
    copy(path.join('insights', 'monthly', `insights-${prevMonth}.json`));
    if (prevPrevMonth) {
      copy(path.join('insights', 'monthly', `insights-${prevPrevMonth}.json`));
    }
  }
}

function scrubLegacyBrief(value) {
  if (Array.isArray(value)) {
    for (const item of value) scrubLegacyBrief(item);
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const key of LEGACY_BRIEF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) delete value[key];
  }
  for (const key of Object.keys(value)) scrubLegacyBrief(value[key]);
}

function applyOneSentences(brief, insights) {
  if (!brief || !insights) return;
  const sentences = new Map();
  const add = (name, text) => {
    if (name && typeof text === 'string' && text.trim()) {
      sentences.set(name, text.trim());
    }
  };

  for (const item of insights.project_insights || []) {
    add(item.project_name || item.fullName || item.repo, item.oneSentence);
  }
  for (const item of insights.topProjects || []) {
    add(item.repo || item.fullName || item.project_name, item.oneSentence);
  }
  for (const item of insights.longTermValue || []) {
    add(item.repo || item.fullName || item.project_name, item.oneSentence);
  }

  for (const project of brief.projects || []) {
    const name = project.fullName || project.repo || project.name;
    const sentence = sentences.get(name);
    if (!sentence) continue;
    project.analysis = project.analysis || {};
    project.analysis.oneSentence = sentence;
  }
}

function buildReportData(level, period, brief, metrics, insights) {
  const projects = brief.projects || [];
  const stats = brief.stats || {};

  if (level === 'daily') {
    return {
      ...brief,
      date: period,
      projects,
      trending_repos: projects,
      stats,
      aiInsights: insights,
      brief: {
        ...brief,
        trending_repos: projects,
        stats,
        generated_at: brief.generatedAt,
      },
      dailyDiff: brief.dailyDiff,
      streakDays: brief.streakDays,
      caption: brief.caption,
    };
  }

  if (level === 'weekly') {
    const maxTodayStars = projects.reduce((max, project) => {
      return Math.max(max, Number(project.todayStars) || 0);
    }, 0);
    const topProject = projects
      .slice()
      .sort((left, right) => (Number(right.todayStars) || 0) - (Number(left.todayStars) || 0))[0];

    return {
      ...brief,
      date: period,
      week: period,
      weekStart: period,
      weekEnd: metrics.endDate,
      projects,
      trending_repos: projects,
      stats,
      aiInsights: insights,
      brief: {
        ...brief,
        trending_repos: projects,
        stats,
        generated_at: brief.generatedAt,
      },
      weekMetrics: metrics,
      prevWeekStats: brief.prevWeekStats,
      dailyCounts: brief.dailyCounts,
      weekNewStars: brief.weekNewStars,
      caption: brief.caption,
      summary: {
        total: projects.length,
        aiCount: projects.filter(project => project.isAI).length,
        avgStars: stats.avgStars,
        maxTodayStars,
        topProject: topProject ? topProject.fullName : '',
      },
    };
  }

  return {
    ...brief,
    month: period,
    projects,
    stats,
    aiInsights: insights,
    brief: {
      ...brief,
      generated_at: brief.generatedAt,
    },
    monthTop: brief.monthTop,
    prevMonthStats: brief.prevMonthStats,
    weekThemes: brief.weekThemes,
    dropList: brief.dropList,
    dropListNote: brief.dropListNote,
    caption: brief.caption,
    aggregation: brief.aggregation,
  };
}

function writeCheckArtifacts({ outDir, level, period, pass, findings }) {
  const checkDir = path.join(outDir, 'check');
  ensureDir(checkDir);

  const baseName = `check-${level}-${period}`;
  const jsonPath = path.join(checkDir, `${baseName}.json`);
  const mdPath = path.join(checkDir, `${baseName}.md`);

  const payload = {
    level,
    period,
    generatedAt: new Date().toISOString(),
    pass,
    count: findings.length,
    findings: findings.map(finding => ({
      file: finding.file,
      field: finding.field,
      line: finding.line,
      rule_id: finding.rule_id,
      quote: finding.quote,
      message: finding.message,
    })),
  };
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push(`# 内容核查${pass ? ' PASS' : ' FAIL'}：${level} ${period}`);
  lines.push('');
  lines.push(`- 生成时间：${payload.generatedAt}`);
  lines.push(`- 结果：${pass ? 'PASS' : 'FAIL'}`);
  lines.push(`- FAIL 条数：${findings.length}`);
  lines.push('');
  if (findings.length > 0) {
    lines.push('| 规则 | 文件 | 行 | 字段 | 原句 | 说明 |');
    lines.push('|---|---|---|---|---|---|');
    for (const finding of payload.findings) {
      const quote = String(finding.quote || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const message = String(finding.message || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      lines.push(`| ${finding.rule_id} | ${finding.file || ''} | ${finding.line === null ? '' : finding.line} | ${finding.field || ''} | ${quote} | ${message} |`);
    }
    lines.push('');
  }
  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');

  return { jsonPath, mdPath };
}

async function generateHtml(level, reportData) {
  const HTMLGenerator = require('../src/generator/html-generator');
  const generator = new HTMLGenerator();

  if (level === 'daily') return generator.generateDaily(reportData);
  if (level === 'weekly') return generator.generateWeekly(reportData);
  return generator.generateMonthly(reportData);
}

function addFailMarker(htmlPath) {
  const ext = path.extname(htmlPath);
  return `${htmlPath.slice(0, -ext.length)}.FAIL${ext}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [level, period] = args.positional;

  if (!level || !period || !LEVELS.includes(level)) {
    printUsage();
    return 2;
  }
  if (!isValidPeriod(level, period)) {
    console.error(`期次格式不正确：${period}（${level}）`);
    printUsage();
    return 2;
  }

  const sourceDataDir = path.resolve(
    args.options['data-dir']
      || process.env.REPORT_DATA_DIR
      || path.join(ROOT_DIR, 'data')
  );
  const outDir = path.resolve(args.options['out-dir'] || ROOT_DIR);
  const outDataDir = path.join(outDir, 'data');
  const outReportsDir = path.join(outDir, 'reports');
  const writeHtmlOnFail = args.options['write-html-on-fail'] === true;

  const sourceBriefPath = path.join(sourceDataDir, 'briefs', level, briefFileName(level, period));
  if (!fs.existsSync(sourceBriefPath)) {
    console.error(`当期 brief 不存在：${sourceBriefPath}`);
    return 2;
  }

  process.env.REPORT_DATA_DIR = outDataDir;
  process.env.REPORT_OUT_DIR = outReportsDir;
  process.env.REPORT_NO_PUSH = '1';
  process.env.REPORT_NO_WIKI = '1';

  if (path.resolve(outDataDir) === path.resolve(sourceDataDir)) {
    console.warn(`[generate-sample] 输出数据目录与源目录相同，将就地更新 ${level} ${period} 的 brief/insights`);
  }

  copySupportingData(sourceDataDir, outDataDir, level, period);
  history.resetHistoryCache();

  const brief = JSON.parse(fs.readFileSync(sourceBriefPath, 'utf8'));
  scrubLegacyBrief(brief);

  if (level === 'daily') brief.date = period;
  if (level === 'weekly') brief.weekStart = period;
  if (level === 'monthly') brief.month = period;

  const metrics = require('../src/metrics');
  let computed;
  if (level === 'daily') {
    computed = metrics.enrichDailyBrief(brief, { date: period });
  } else if (level === 'weekly') {
    computed = metrics.enrichWeeklyBrief(brief, { week: period });
    brief.week = period;
    brief.weekEnd = computed.endDate;
  } else {
    computed = metrics.enrichMonthlyBrief(brief, { month: period });
  }

  if (!computed) {
    console.error(`无法计算 ${level} ${period} 的期内指标（缺少 brief 或历史数据）`);
    return 2;
  }

  const outBriefPath = path.join(outDataDir, 'briefs', level, briefFileName(level, period));
  const writeBrief = () => {
    ensureDir(path.dirname(outBriefPath));
    fs.writeFileSync(outBriefPath, `${JSON.stringify(brief, null, 2)}\n`, 'utf8');
  };
  writeBrief();

  const outInsightsPath = path.join(outDataDir, 'insights', level, insightFileName(period));
  if (path.resolve(outDataDir) !== path.resolve(sourceDataDir) && fs.existsSync(outInsightsPath)) {
    fs.unlinkSync(outInsightsPath);
  }

  const InsightAnalyzer = require('../src/analyzer/insight-analyzer');
  const MonthlyAnalyzer = require('../src/analyzer/monthly-analyzer');

  let analyzer;
  let analysisData;
  if (level === 'daily') {
    analyzer = new InsightAnalyzer();
    analysisData = { date: period, brief };
  } else if (level === 'weekly') {
    analyzer = new InsightAnalyzer();
    analysisData = {
      weekStart: period,
      date: period,
      brief,
      weekMetrics: computed,
      weekNewStars: brief.weekNewStars,
      prevWeekStats: brief.prevWeekStats,
      dailyCounts: brief.dailyCounts,
    };
  } else {
    analyzer = new MonthlyAnalyzer();
    analysisData = {
      ...brief,
      month: period,
      dailyDataList: computed.dailyDates.map(date => ({ date })),
      weeklyDataList: computed.weekThemes.map(item => ({ week: item.week })),
    };
  }

  const runAnalysis = (options = {}) => {
    if (level === 'daily') return analyzer.analyzeDaily(analysisData, options);
    if (level === 'weekly') return analyzer.analyzeWeekly(analysisData, options);
    return analyzer.analyze(analysisData, options);
  };

  let insights = await runAnalysis();
  if (!insights || typeof insights !== 'object') insights = {};
  applyOneSentences(brief, insights);
  writeBrief();

  const { runContentGate } = require('../src/checker/gate');
  const logger = require('../src/utils/logger');
  const gateLogger = {
    info(message, meta) {
      if (typeof message === 'string' && message.startsWith('AI_CALLS ')) {
        console.log(message);
        return;
      }
      logger.info(message, meta);
    },
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    debug: logger.debug.bind(logger),
    success: logger.success.bind(logger),
  };

  const gate = await runContentGate({
    level,
    period,
    dataDir: outDataDir,
    logger: gateLogger,
    getAiCallCount: () => analyzer.getAiCallCount(),
    rewrite: async (findings) => {
      const rewritten = await runAnalysis({ feedback: findings });
      if (rewritten && typeof rewritten === 'object') {
        insights = rewritten;
      }
      applyOneSentences(brief, insights);
      writeBrief();
      return insights;
    },
  });

  const checkPaths = writeCheckArtifacts({
    outDir,
    level,
    period,
    pass: gate.pass,
    findings: gate.findings,
  });

  const reportData = buildReportData(level, period, brief, computed, insights);

  let htmlPath = null;
  if (gate.pass) {
    htmlPath = await generateHtml(level, reportData);
  } else if (writeHtmlOnFail) {
    const generatedPath = await generateHtml(level, reportData);
    const failPath = addFailMarker(generatedPath);
    fs.renameSync(generatedPath, failPath);
    htmlPath = failPath;
  }

  console.log('');
  console.log(`期次：${level} ${period}`);
  console.log(`源数据：${sourceDataDir}`);
  console.log(`输出：${outDir}`);
  console.log(`核查：${gate.pass ? 'PASS' : 'FAIL'}（${gate.findings.length} 条）`);
  console.log(`核查清单：${checkPaths.jsonPath}`);
  console.log(`核查清单：${checkPaths.mdPath}`);
  console.log(`HTML：${htmlPath || '未写（核查 FAIL）'}`);

  return gate.pass ? 0 : 1;
}

main()
  .then(code => {
    process.exitCode = code;
  })
  .catch(error => {
    console.error(`[generate-sample] 执行失败：${error.message}`);
    console.error(error.stack);
    process.exitCode = 1;
  });
