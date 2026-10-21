#!/usr/bin/env node
'use strict';

/**
 * 历史期样例生成（S2/S5）
 *
 * 用法：
 *   node scripts/generate-sample.js <daily|weekly|monthly> <期次> [--out-dir D] [--data-dir D]
 *
 * 期次：2026-10-12 / 2026-W42 / 2026-09
 *
 * 只读取既有 brief，不抓取 GitHub；强制 REPORT_NO_PUSH=1、REPORT_NO_WIKI=1，
 * 不调用 notifier、wiki-sync、git push 或首页生成。
 *
 * 退出码：0 = PASS；1 = 核查 FAIL（写 .FAIL.html 供审阅）或执行失败；2 = 参数/数据错误。
 */

const fs = require('fs');
const path = require('path');
const history = require('../src/metrics/history');
const { buildFacts } = require('../src/facts/build-facts');
const { dedupeFindings } = require('../src/checker/rules/util');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_CSS_DIR = path.join(ROOT_DIR, 'public', 'css');
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
  console.error(`用法：node scripts/generate-sample.js <daily|weekly|monthly> <期次> --data-dir D --out-dir D

期次示例：
  daily   2026-10-12
  weekly  2026-W42
  monthly 2026-09

必填选项：
  --data-dir D          既有 brief/insights 的源数据目录（不得回退到 ./data）
  --out-dir D           输出根目录，写入其下 data/、reports/、check/（不得是仓库根目录或位于源 data-dir 内）

核查 FAIL 时仍写自包含 HTML 供审阅，文件名带 .FAIL 标记。`);
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
  // 不覆盖已有文件：先前生成的 r2 brief/insights 必须被后续期次沿用。
  if (fs.existsSync(destPath)) return false;
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
    // 当期 brief/insights 由本次运行生成；这里只拷历史，避免把当期文件当成「已存在」。
    const briefDates = listDailyDates(sourceBriefsDaily).filter(date => date >= from && date < period);
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

    // 当期周榜 brief 从源目录直接读，不拷入输出目录。
    for (const week of weeks.slice(1, 2)) {
      copy(path.join('briefs', 'weekly', `data-weekly-${week}.json`));
    }
    for (const week of weeks.slice(1)) {
      copy(path.join('insights', 'weekly', `insights-${week}.json`));
    }
    return;
  }

  const monthDates = history.getMonthDates(period);
  const prevMonth = history.getPrevMonth(period);
  const prevMonthDates = prevMonth ? history.getMonthDates(prevMonth) : [];
  // 上月新秀需要回看上月第一天之前的 30 天（例如 2026-08 需要 7 月日榜）。
  const start = history.addDays(prevMonthDates[0] || monthDates[0], -30);
  const end = monthDates[monthDates.length - 1];

  const briefDates = listDailyDates(sourceBriefsDaily).filter(date => date >= start && date <= end);
  copyDailyBriefs(briefDates);

  for (const week of history.getWeeksInMonth(period)) {
    copy(path.join('insights', 'weekly', `insights-${week}.json`));
  }

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
    const finalSentence = hasChinese(sentence) || !hasChinese(project.descZh)
      ? sentence
      : `${name}：${project.descZh}`;
    project.analysis = project.analysis || {};
    project.analysis.oneSentence = finalSentence;
  }

  // B17：oneSentence 为空时用 descZh（无则 description）生成，避免卡片回退成英文。
  const { generateOneSentence } = require('../src/analyzer/project-analyzer');
  for (const project of brief.projects || []) {
    project.analysis = project.analysis || {};
    if (!String(project.analysis.oneSentence || '').trim()) {
      project.analysis.oneSentence = generateOneSentence(project);
    }
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
      isSample: true,
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
    monthTop: metrics?.top || brief.monthTop,
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

// B13 失败后改名得到的 .FAIL.html 也补上 FAIL 横条，保持与核查 FAIL 路径一致。
function addFailBanner(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (/class="fail-banner"/.test(html)) return;
  const marked = html.replace(
    /<body([^>]*)>/i,
    '<body$1>\n<div class="fail-banner">内容核查未通过（FAIL）· 本页仅供审阅</div>'
  );
  fs.writeFileSync(htmlPath, marked, 'utf8');
}

// B13：样例 HTML 自包含——把 <link rel="stylesheet"> 指向的 public/css 文件内联进 <style>。
function inlineStylesheets(html) {
  return String(html || '').replace(/<link\b[^>]*>/gi, tag => {
    const relMatch = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const rel = relMatch ? (relMatch[1] || relMatch[2] || relMatch[3] || '') : '';
    if (!/\bstylesheet\b/i.test(rel)) return tag;
    const match = /\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(tag);
    const href = match ? (match[1] || match[2] || match[3]) : null;
    if (!href) return tag;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(href)) return tag;
    const clean = href.split('#')[0].split('?')[0];
    const cssPath = path.join(PUBLIC_CSS_DIR, path.basename(clean));
    if (!fs.existsSync(cssPath)) return tag;
    return `<style>\n${fs.readFileSync(cssPath, 'utf8')}\n</style>`;
  });
}

function inlineSampleStyles(htmlPath) {
  if (!htmlPath || !fs.existsSync(htmlPath)) return;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const inlined = inlineStylesheets(html);
  if (inlined !== html) fs.writeFileSync(htmlPath, inlined, 'utf8');
}

// B13：对最终写出的 HTML 文件运行自包含检查（PASS 与 .FAIL 两条路径都要核）。
function checkFinalHtml(htmlPath, level) {
  const { loadDocument } = require('../src/checker/document');
  const b13 = require('../src/checker/rules/b13');
  const doc = loadDocument(htmlPath, 'html');
  const findings = b13.check({}, doc) || [];
  if (level === 'daily') {
    const b17 = require('../src/checker/rules/b17');
    findings.push(...(b17.check({ level }, doc) || []));
  }
  return findings;
}

function hasChinese(text) {
  return /[\u4e00-\u9fa5]/.test(String(text || ''));
}

// B16/项目卡：英文描述必须翻译成中文；翻译失败沿用原文并在日志标出。
async function ensureChineseDescriptions(brief) {
  const { translateDescription } = require('../src/analyzer/project-analyzer');
  const logger = require('../src/utils/logger');
  for (const project of brief.projects || []) {
    if (hasChinese(project.descZh)) continue;
    const description = project.descZh || project.description || project.desc || '';
    if (!description) continue;
    const translated = await translateDescription(description);
    if (hasChinese(translated)) {
      project.descZh = translated;
    } else {
      const fullName = project.fullName || project.repo || project.name || '(未知项目)';
      logger.warn(`项目描述翻译失败，沿用原文：${fullName}`);
      if (!project.descZh) project.descZh = translated || description;
    }
  }
}

async function writeSampleHtml(level, reportData, { fail = false } = {}) {
  // .FAIL.html 与正常样例共用同一模板与样式，仅在页首追加 FAIL 横条。
  reportData.isFail = fail;
  const generatedPath = await generateHtml(level, reportData);
  let htmlPath = generatedPath;
  if (fail) {
    htmlPath = addFailMarker(generatedPath);
    fs.renameSync(generatedPath, htmlPath);
  }
  inlineSampleStyles(htmlPath);
  return htmlPath;
}

function isSameOrInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function reportDirName(level) {
  return level;
}

function reportFileName(level, period) {
  if (level === 'daily') return `github-ai-trending-${period}.html`;
  if (level === 'weekly') return `github-weekly-${period}.html`;
  return `github-monthly-${period}.html`;
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

  const dataDirOption = args.options['data-dir'];
  const outDirOption = args.options['out-dir'];
  if (typeof dataDirOption !== 'string' || typeof outDirOption !== 'string'
    || !dataDirOption.trim() || !outDirOption.trim()) {
    console.error('错误：--data-dir 与 --out-dir 均为必填，不使用仓库根目录或 data/ 作为默认值。');
    printUsage();
    return 2;
  }

  const sourceDataDir = path.resolve(dataDirOption);
  const outDir = path.resolve(outDirOption);
  const outDataDir = path.join(outDir, 'data');
  const outReportsDir = path.join(outDir, 'reports');
  // 核查 FAIL 时无需开关：始终写 .FAIL.html 供审阅。
  const writeHtmlOnFail = true;

  if (outDir === path.resolve(ROOT_DIR)) {
    console.error(`错误：--out-dir 不得等于仓库根目录：${outDir}`);
    return 2;
  }
  if (isSameOrInside(outDir, sourceDataDir) || isSameOrInside(outDataDir, sourceDataDir)) {
    console.error(`错误：--out-dir 不得等于或位于源 data-dir 内（out-dir=${outDir}，data-dir=${sourceDataDir}）`);
    return 2;
  }

  const sourceBriefPath = path.join(sourceDataDir, 'briefs', level, briefFileName(level, period));
  if (!fs.existsSync(sourceBriefPath)) {
    console.error(`当期 brief 不存在：${sourceBriefPath}`);
    return 2;
  }

  const outBriefPath = path.join(outDataDir, 'briefs', level, briefFileName(level, period));
  const outInsightsPath = path.join(outDataDir, 'insights', level, insightFileName(period));
  const outReportPath = path.join(outReportsDir, reportDirName(level), reportFileName(level, period));
  const outFactsPath = path.join(outDataDir, 'facts', `facts-${level}-${period}.json`);
  const renderMapPath = path.join(outDataDir, 'render', `render_map-${level}-${period}.json`);
  const checkBaseName = path.join(outDir, 'check', `check-${level}-${period}`);
  const conflicts = [
    outBriefPath,
    outInsightsPath,
    outFactsPath,
    renderMapPath,
    outReportPath,
    addFailMarker(outReportPath),
    `${checkBaseName}.json`,
    `${checkBaseName}.md`,
  ].filter(filePath => fs.existsSync(filePath));
  if (conflicts.length > 0) {
    console.error('错误：以下输出文件已存在，拒绝覆盖：');
    for (const filePath of conflicts) console.error(`  - ${filePath}`);
    return 2;
  }

  process.env.REPORT_DATA_DIR = outDataDir;
  process.env.REPORT_OUT_DIR = outReportsDir;
  process.env.REPORT_NO_PUSH = '1';
  process.env.REPORT_NO_WIKI = '1';

  copySupportingData(sourceDataDir, outDataDir, level, period);
  history.resetHistoryCache();

  const brief = JSON.parse(fs.readFileSync(sourceBriefPath, 'utf8'));
  scrubLegacyBrief(brief);
  await ensureChineseDescriptions(brief);

  if (level === 'daily') {
    brief.date = period;
    // B14：日报榜单按 todayStars 降序。
    brief.projects = (brief.projects || []).slice().sort((left, right) => {
      return (Number(right.todayStars) || 0) - (Number(left.todayStars) || 0);
    });
  }
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

  const writeBrief = () => {
    ensureDir(path.dirname(outBriefPath));
    fs.writeFileSync(outBriefPath, `${JSON.stringify(brief, null, 2)}\n`, 'utf8');
  };
  writeBrief();

  const facts = buildFacts({ level, period, brief, metrics: computed });
  if (!facts) {
    console.error(`无法生成 ${level} ${period} 的事实表`);
    return 2;
  }
  ensureDir(path.dirname(outFactsPath));
  try {
    fs.writeFileSync(outFactsPath, `${JSON.stringify(facts, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    if (error.code === 'EEXIST') {
      console.error(`错误：事实表已存在，拒绝覆盖：${outFactsPath}`);
      return 2;
    }
    throw error;
  }

  const InsightAnalyzer = require('../src/analyzer/insight-analyzer');
  const MonthlyAnalyzer = require('../src/analyzer/monthly-analyzer');
  const { renderInsights, writeRenderMap } = require('../src/render/placeholder-renderer');
  const { sanitizeInsights, writeDeletedSentences } = require('../src/render/sanitize-insights');

  let analyzer;
  let analysisData;
  if (level === 'daily') {
    analyzer = new InsightAnalyzer();
    analysisData = { date: period, brief, facts };
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
      facts,
    };
  } else {
    analyzer = new MonthlyAnalyzer();
    analysisData = {
      ...brief,
      month: period,
      dailyDataList: computed.dailyDates.map(date => ({ date })),
      weeklyDataList: computed.weekThemes.map(item => ({ week: item.week })),
      facts,
    };
  }

  const runAnalysis = (options = {}) => {
    if (level === 'daily') return analyzer.analyzeDaily(analysisData, options);
    if (level === 'weekly') return analyzer.analyzeWeekly(analysisData, options);
    return analyzer.analyze(analysisData, options);
  };

  let insights = await runAnalysis();
  if (!insights || typeof insights !== 'object') insights = {};

  const { isR5Insights } = require('../src/checker/rules/r5');

  if (level === 'daily' && isR5Insights(insights)) {
    const r5Insights = insights;
    ensureDir(path.dirname(outInsightsPath));
    fs.writeFileSync(outInsightsPath, `${JSON.stringify(r5Insights, null, 2)}\n`, 'utf8');

    if (!Array.isArray(r5Insights.renderEntries)) {
      console.error('错误：r5 insights 缺少 renderEntries，无法执行 r5 检查');
      return 1;
    }

    const { loadDocument } = require('../src/checker/document');
    const { buildContext } = require('../src/checker/context');
    const { loadConfig } = require('../src/checker/config');
    const r5 = require('../src/checker/rules/r5');
    const doc = loadDocument(outInsightsPath, 'insights');
    const ctx = buildContext({
      level,
      period,
      dataDir: outDataDir,
      brief,
      insights: r5Insights,
      facts,
    });
    const r5Findings = r5.check(ctx, doc, loadConfig());

    const reportData = buildReportData(level, period, brief, computed, r5Insights);
    const generatedHtmlPath = await writeSampleHtml(level, reportData, { fail: false });
    const htmlFindings = checkFinalHtml(generatedHtmlPath, level);
    const findings = dedupeFindings([...r5Findings, ...htmlFindings]);
    const pass = findings.length === 0;
    let htmlPath = generatedHtmlPath;
    if (!pass) {
      htmlPath = addFailMarker(generatedHtmlPath);
      fs.renameSync(generatedHtmlPath, htmlPath);
      addFailBanner(htmlPath);
      for (const finding of htmlFindings) {
        if (finding.file === generatedHtmlPath) finding.file = htmlPath;
      }
    }
    const checkPaths = writeCheckArtifacts({
      outDir,
      level,
      period,
      pass,
      findings,
    });

    console.log('');
    console.log(`期次：${level} ${period}`);
    console.log(`源数据：${sourceDataDir}`);
    console.log(`输出：${outDir}`);
    console.log(`R5 检查：${r5Findings.length} 条`);
    console.log(`成品 HTML 检查：${htmlFindings.length} 条`);
    console.log(`槽位缺省：${(r5Insights.usedDefaults || []).length} 条`);
    console.log(`核查清单：${checkPaths.jsonPath}`);
    console.log(`核查清单：${checkPaths.mdPath}`);
    console.log(`事实表：${outFactsPath}`);
    console.log(pass ? `HTML：${htmlPath}` : `HTML：写出 .FAIL.html：${htmlPath}`);
    return pass ? 0 : 1;
  }

  const projectTags = {};
  for (const project of brief?.projects || []) {
    const name = project.fullName || project.repo || project.name;
    if (name && project.tag) projectTags[name] = project.tag;
  }

  const deletedSentences = [];
  const deletedLogPath = () => path.join(outDir, 'check', `deleted-sentences-${level}-${period}.json`);

  const renderCurrent = () => {
    const sanitized = sanitizeInsights(insights);
    insights = sanitized.insights;
    for (const item of sanitized.deleted) {
      if (!deletedSentences.some(existing =>
        existing.path === item.path
        && existing.sentence === item.sentence
        && existing.word === item.word)) {
        deletedSentences.push(item);
      }
    }
    writeDeletedSentences({ outDir, level, period, deleted: deletedSentences });
    return renderInsights({
      insights,
      facts: facts.facts,
      projects: facts.projects,
      projectTags,
      level,
      period,
    });
  };

  const renderFeedback = errors => errors.map(error => ({
    rule_id: 'B3',
    field: error.path,
    quote: error.quote || error.placeholder,
    message: error.message,
  }));

  const persistRendered = (rendered) => {
    insights = rendered.insights;
    fs.writeFileSync(outInsightsPath, `${JSON.stringify(insights, null, 2)}\n`, 'utf8');
    applyOneSentences(brief, insights);
    writeBrief();
  };

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

  let rendered = renderCurrent();
  if (rendered.errors.length > 0 && analyzer.getAiCallCount() < 2) {
    console.error(`[render] 占位校验失败 ${rendered.errors.length} 条，重试 AI 1 次...`);
    const rewritten = await runAnalysis({ feedback: renderFeedback(rendered.errors) });
    if (rewritten && typeof rewritten === 'object') insights = rewritten;
    rendered = renderCurrent();
  }

  if (rendered.errors.length > 0) {
    const placeholderFindings = rendered.errors.map(error => ({
      file: outInsightsPath,
      field: error.path,
      line: null,
      rule_id: 'B3',
      quote: error.quote || error.placeholder,
      message: error.message,
    }));

    // 占位未解析处原样保留（rendered.insights 中仍是占位文本），不删句。
    persistRendered(rendered);

    // B3：占位校验失败不提前退出，继续运行后续全部内容核查规则；
    // 占位 FAIL 与规则 FAIL 合并成一份清单，AI 调用次数保持不变（≤2）。
    const gate = await runContentGate({
      level,
      period,
      dataDir: outDataDir,
      logger: gateLogger,
      writeHtmlOnFail,
      getRenderMap: () => rendered,
      facts,
      getAiCallCount: () => analyzer.getAiCallCount(),
    });

    const reportData = buildReportData(level, period, brief, computed, rendered.insights);
    const htmlPath = await writeSampleHtml(level, reportData, { fail: true });
    const b13Findings = checkFinalHtml(htmlPath, level);
    const findings = dedupeFindings([...placeholderFindings, ...gate.findings, ...b13Findings]);
    const checkPaths = writeCheckArtifacts({
      outDir,
      level,
      period,
      pass: false,
      findings,
    });

    console.log('');
    console.log(`期次：${level} ${period}`);
    console.log(`源数据：${sourceDataDir}`);
    console.log(`输出：${outDir}`);
    console.log(`核查：FAIL（${findings.length} 条，含占位校验失败）`);
    console.log(`自写方向/状态句删除：${deletedSentences.length} 条`);
    if (deletedSentences.length > 0) console.log(`删除记录：${deletedLogPath()}`);
    console.log(`核查清单：${checkPaths.jsonPath}`);
    console.log(`核查清单：${checkPaths.mdPath}`);
    console.log(`事实表：${outFactsPath}`);
    console.log(`HTML：写出 .FAIL.html：${htmlPath}`);
    return 1;
  }

  persistRendered(rendered);
  let lastRendered = rendered;

  let placeholderFailures = [];
  let gate = await runContentGate({
    level,
    period,
    dataDir: outDataDir,
    logger: gateLogger,
    writeHtmlOnFail,
    getRenderMap: () => lastRendered,
    facts,
    getAiCallCount: () => analyzer.getAiCallCount(),
    rewrite: analyzer.getAiCallCount() < 2
      ? async (findings) => {
          const rewritten = await runAnalysis({ feedback: findings });
          if (rewritten && typeof rewritten === 'object') {
            insights = rewritten;
          }
          const next = renderCurrent();
          if (next.errors.length > 0) {
            placeholderFailures = next.errors;
            persistRendered(lastRendered);
            const detail = next.errors
              .map(error => `${error.path} ${error.placeholder} ${error.message}`)
              .join('；');
            throw new Error(`重写后占位校验失败：${detail}`);
          }
          persistRendered(next);
          lastRendered = next;
          return insights;
        }
      : undefined,
  });

  if (placeholderFailures.length > 0) {
    gate = {
      ...gate,
      pass: false,
      findings: placeholderFailures.map(error => ({
        file: outInsightsPath,
        field: error.path,
        line: null,
        rule_id: 'B3',
        quote: error.quote || error.placeholder,
        message: error.message,
      })),
    };
  }

  try {
    writeRenderMap({
      level,
      period,
      entries: lastRendered.entries,
      renderMapPath,
    });
  } catch (error) {
    console.error(`错误：${error.message}`);
    return 1;
  }

  const reportData = buildReportData(level, period, brief, computed, insights);

  let htmlPath = await writeSampleHtml(level, reportData, { fail: !gate.pass });
  const b13Findings = checkFinalHtml(htmlPath, level);
  let pass = gate.pass && b13Findings.length === 0;
  if (gate.pass && b13Findings.length > 0) {
    const failPath = addFailMarker(htmlPath);
    fs.renameSync(htmlPath, failPath);
    addFailBanner(failPath);
    for (const finding of b13Findings) {
      if (finding.file === htmlPath) finding.file = failPath;
    }
    htmlPath = failPath;
  }
  const findings = [...gate.findings, ...b13Findings];
  const checkPaths = writeCheckArtifacts({
    outDir,
    level,
    period,
    pass,
    findings,
  });

  console.log('');
  console.log(`期次：${level} ${period}`);
  console.log(`源数据：${sourceDataDir}`);
  console.log(`输出：${outDir}`);
  console.log(`核查：${pass ? 'PASS' : 'FAIL'}（${findings.length} 条）`);
  console.log(`自写方向/状态句删除：${deletedSentences.length} 条`);
  if (deletedSentences.length > 0) console.log(`删除记录：${deletedLogPath()}`);
  console.log(`核查清单：${checkPaths.jsonPath}`);
  console.log(`核查清单：${checkPaths.mdPath}`);
  console.log(`事实表：${outFactsPath}`);
  console.log(`渲染记录：${renderMapPath}`);
  console.log(pass ? `HTML：${htmlPath}` : `HTML：写出 .FAIL.html：${htmlPath}`);

  return pass ? 0 : 1;
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
