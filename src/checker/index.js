'use strict';

const fs = require('fs');
const path = require('path');
const history = require('../metrics/history');
const { loadConfig } = require('./config');
const {
  buildContext,
  ensureDataDir,
  readBriefFromDisk,
  readInsightsFromDisk,
  resolveRenderMap,
  resolveFacts,
} = require('./context');
const {
  loadDocument,
  createJsonDocument,
  detectDocumentTarget,
} = require('./document');
const { dedupeFindings } = require('./rules/util');

const RULES = [
  require('./rules/a1'),
  require('./rules/a2'),
  require('./rules/a5'),
  require('./rules/b3'),
  require('./rules/b4'),
  require('./rules/b5'),
  require('./rules/b6'),
  require('./rules/b7'),
  require('./rules/b8'),
  require('./rules/b10'),
  require('./rules/b12'),
  require('./rules/b13'),
  require('./rules/b15'),
  require('./rules/b16'),
  require('./rules/b17'),
  require('./rules/b18'),
  require('./rules/c1'),
  require('./rules/c2'),
  require('./rules/c3'),
  require('./rules/c4'),
  require('./rules/c5'),
  require('./rules/d2'),
  require('./rules/r4-binding'),
  require('./rules/r5'),
];

const R5_DISABLED_RULES = new Set([
  'A1', 'A2', 'A5',
  'B3', 'B4', 'B5', 'B6', 'B10', 'B18',
  'C1', 'C2', 'C4',
  'D2',
]);

function isR5Daily(ctx) {
  return ctx.level === 'daily' && Boolean(ctx.insights)
    && (ctx.insights.version === 'r5'
      || ctx.insights.version === 'r9'
      || (ctx.insights.slots && typeof ctx.insights.slots === 'object' && !Array.isArray(ctx.insights.slots)));
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

function briefPathFor(level, period) {
  const base = history.getBriefsDir();
  if (level === 'daily') return path.join(base, 'daily', `data-${period}.json`);
  if (level === 'weekly') return path.join(base, 'weekly', `data-weekly-${period}.json`);
  if (level === 'monthly') return path.join(base, 'monthly', `data-month-${period}.json`);
  return null;
}

function insightsPathFor(level, period) {
  return path.join(history.getInsightsDir(), level, `insights-${period}.json`);
}

function sortFindings(findings) {
  return findings.sort((left, right) => {
    if ((left.file || '') !== (right.file || '')) return String(left.file || '').localeCompare(String(right.file || ''));
    if ((left.line || 0) !== (right.line || 0)) return (left.line || 0) - (right.line || 0);
    if (left.rule_id !== right.rule_id) return left.rule_id.localeCompare(right.rule_id);
    return String(left.field || '').localeCompare(String(right.field || ''));
  });
}

function runRules({ level, period, dataDir, brief, insights, documents, renderMap, facts, r3, viewModel, prevDate }) {
  const config = loadConfig();
  const ctx = buildContext({ level, period, dataDir, brief, insights, renderMap, facts, r3, viewModel, prevDate });
  const findings = [];

  for (const doc of documents) {
    for (const rule of RULES) {
      if (!rule.applies(ctx, doc)) continue;
      if (isR5Daily(ctx) && R5_DISABLED_RULES.has(rule.id)) continue;
      const ruleFindings = rule.check(ctx, doc, config) || [];
      findings.push(...ruleFindings);
    }
  }

  return {
    pass: findings.length === 0,
    level,
    period,
    dataDir,
    insights,
    brief,
    findings: sortFindings(dedupeFindings(findings)),
  };
}

function checkReport(options = {}) {
  const level = options.level;
  const period = options.period;
  if (!level || !period) throw new Error('checkReport 需要 level 与 period');
  const dataDir = ensureDataDir(options.dataDir);

  const briefPath = briefPathFor(level, period);
  const insightsPath = insightsPathFor(level, period);

  const brief = options.brief !== undefined ? options.brief : readBriefFromDisk(level, period);
  const insights = options.insights !== undefined ? options.insights : readInsightsFromDisk(level, period);
  const renderMap = resolveRenderMap(options, dataDir, level, period);
  const facts = resolveFacts(options, dataDir, level, period);

  const documents = [];
  if (insights) {
    documents.push(fileExists(insightsPath)
      ? loadDocument(insightsPath, 'insights')
      : createJsonDocument(null, insights, 'insights', { synthetic: true }));
  }
  if (brief) {
    documents.push(fileExists(briefPath)
      ? loadDocument(briefPath, 'brief')
      : createJsonDocument(null, brief, 'brief', { synthetic: true }));
  }

  if (documents.length === 0) {
    return {
      pass: false,
      level,
      period,
      dataDir,
      insights,
      brief,
      findings: [{
        rule_id: 'D1',
        file: insightsPath,
        field: null,
        line: null,
        quote: '',
        message: '缺少该期 brief 与 insights，无法核查',
      }],
    };
  }

  return runRules({ level, period, dataDir, brief, insights, documents, renderMap, facts, r3: options.r3 });
}

function checkDocument(options = {}) {
  const filePath = path.resolve(options.filePath);
  const dataDir = ensureDataDir(options.dataDir);
  let target = options.target || detectDocumentTarget(filePath);
  if (!target) throw new Error(`无法识别文档类型：${filePath}`);
  if (target.date && !target.period) {
    target = { ...target, period: history.getISOWeekId(target.date) };
  }

  const doc = loadDocument(filePath, target.role);
  const brief = target.role === 'brief'
    ? doc.json
    : (options.brief !== undefined ? options.brief : readBriefFromDisk(target.level, target.period));
  const insights = target.role === 'insights'
    ? doc.json
    : (options.insights !== undefined ? options.insights : readInsightsFromDisk(target.level, target.period));
  const renderMap = resolveRenderMap(options, dataDir, target.level, target.period);
  const facts = resolveFacts(options, dataDir, target.level, target.period);

  return {
    ...runRules({
      level: target.level,
      period: target.period,
      dataDir,
      brief,
      insights,
      documents: [doc],
      renderMap,
      facts,
      r3: options.r3,
      viewModel: options.viewModel,
      prevDate: options.prevDate,
    }),
    target,
    doc,
  };
}

function writeFailList(options = {}) {
  const { level, period, findings } = options;
  const dataDir = ensureDataDir(options.dataDir);
  const outDir = options.outDir ? path.resolve(options.outDir) : path.resolve(dataDir, '..', 'check');
  fs.mkdirSync(outDir, { recursive: true });

  const baseName = `check-${level}-${period}`;
  const jsonPath = path.join(outDir, `${baseName}.json`);
  const mdPath = path.join(outDir, `${baseName}.md`);

  const payload = {
    level,
    period,
    generatedAt: new Date().toISOString(),
    pass: false,
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
  lines.push(`# 内容核查 FAIL 清单：${level} ${period}`);
  lines.push('');
  lines.push(`- 生成时间：${payload.generatedAt}`);
  lines.push(`- FAIL 条数：${findings.length}`);
  lines.push('');
  lines.push('| 规则 | 文件 | 行 | 字段 | 原句 | 说明 |');
  lines.push('|---|---|---|---|---|---|');
  for (const finding of payload.findings) {
    const quote = String(finding.quote || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const message = String(finding.message || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(`| ${finding.rule_id} | ${finding.file || ''} | ${finding.line === null ? '' : finding.line} | ${finding.field || ''} | ${quote} | ${message} |`);
  }
  lines.push('');
  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');

  return { jsonPath, mdPath, outDir };
}

function ruleIdMatches(findingRuleId, expectedRuleId) {
  if (!expectedRuleId) return true;
  if (findingRuleId === expectedRuleId) return true;
  if (expectedRuleId === 'NAME' && findingRuleId === 'D2') return true;
  if (expectedRuleId === 'D2' && findingRuleId === 'D2') return true;
  if ((expectedRuleId === 'B11' || expectedRuleId === 'B16') && findingRuleId === 'B18') return true;
  return false;
}

function locationMatches(finding, caseItem) {
  if (caseItem.line === null || caseItem.line === undefined) return true;
  if (finding.line === caseItem.line) return true;
  const caseQuote = String(caseItem.quote || '').replace(/\s+/g, '');
  const findingQuote = String(finding.quote || '').replace(/\s+/g, '');
  if (!caseQuote || !findingQuote) return false;
  return caseQuote.includes(findingQuote) || findingQuote.includes(caseQuote);
}

function readCaseJson(value, root) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const filePath = path.resolve(root, value);
  if (!fileExists(filePath)) throw new Error(`用例引用文件不存在：${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function evaluateDeletedLog(caseItem, root, result) {
  if (!caseItem.deleted_log) return { ok: true };
  const logPath = path.resolve(root, caseItem.deleted_log);
  if (!fileExists(logPath)) {
    return { ok: false, error: `删除日志不存在：${logPath}` };
  }
  const payload = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  const entries = Array.isArray(payload) ? payload : (payload.deleted || []);
  if (entries.length === 0) {
    return { ok: false, error: '删除日志没有记录' };
  }
  for (const entry of entries) {
    if (!entry || typeof entry.path !== 'string' || typeof entry.sentence !== 'string' || typeof entry.word !== 'string') {
      return { ok: false, error: '删除日志条目缺少 path/sentence/word' };
    }
  }
  if (caseItem.deleted_word && !entries.some(entry => entry.word === caseItem.deleted_word)) {
    return { ok: false, error: `删除日志没有记录「${caseItem.deleted_word}」` };
  }
  const product = JSON.stringify(result.doc?.json ?? result.insights ?? '');
  for (const entry of entries) {
    if (entry.sentence && product.includes(entry.sentence)) {
      return { ok: false, error: `成品仍包含已删除句：${entry.sentence}` };
    }
  }
  return { ok: true };
}

function isDailyR5OrR9Insights(filePath) {
  if (!filePath || !filePath.endsWith('.json')) return false;
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Boolean(
      content && typeof content === 'object' && !Array.isArray(content) &&
      (content.version === 'r5' || content.version === 'r9' ||
       (content.slots && typeof content.slots === 'object' && !Array.isArray(content.slots)))
    );
  } catch (e) {
    return false;
  }
}

function evaluateCase(caseItem, options = {}) {
  const root = path.resolve(options.casesRoot || '/home/box/shared/report-redesign');
  const filePath = path.resolve(root, caseItem.file);
  if (!fileExists(filePath)) {
    return { case: caseItem, ok: false, error: `文件不存在：${filePath}`, matched: [], findings: [] };
  }

  let brief = options.brief;
  let viewModel = options.viewModel;
  if (brief === undefined && viewModel === undefined && filePath && isDailyR5OrR9Insights(filePath)) {
    const fixtureDir = path.dirname(filePath);
    if (fs.existsSync(fixtureDir)) {
      const files = fs.readdirSync(fixtureDir);
      const briefFileName = files.find(f => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f));
      if (briefFileName) {
        try {
          brief = JSON.parse(fs.readFileSync(path.join(fixtureDir, briefFileName), 'utf8'));
          let insights = null;
          if (fs.existsSync(filePath)) insights = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          let facts = readCaseJson(caseItem.facts, root);
          const { buildViewModel } = require('../generator/daily-v3-view-model');
          const date = brief.date || (briefFileName.match(/\d{4}-\d{2}-\d{2}/) || [])[0];
          const projects = brief.projects || brief.trending_repos || [];
          const stats = brief.stats || {};
          const reportData = {
            ...brief,
            date,
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
            facts,
            dailyDiff: brief.dailyDiff,
            streakDays: brief.streakDays,
            caption: brief.caption,
            isSample: true,
          };
          viewModel = buildViewModel(reportData);
        } catch (e) {
          // ignore
        }
      }
    }
  }

  let result;
  try {
    const dataDir = caseItem.data_dir
      ? path.resolve(root, caseItem.data_dir)
      : options.dataDir;
    const checkOptions = {
      filePath,
      dataDir,
      renderMap: readCaseJson(caseItem.render_map, root),
      facts: readCaseJson(caseItem.facts, root),
      r3: caseItem.r3,
    };
    if (brief !== undefined) checkOptions.brief = brief;
    if (viewModel !== undefined) checkOptions.viewModel = viewModel;
    if (caseItem.prevDate !== undefined) checkOptions.prevDate = caseItem.prevDate;
    result = checkDocument(checkOptions);
  } catch (error) {
    return { case: caseItem, ok: false, error: error.message, matched: [], findings: [] };
  }

  const matched = result.findings.filter(finding =>
    ruleIdMatches(finding.rule_id, caseItem.rule_id) && locationMatches(finding, caseItem)
  );

  const ruleOk = caseItem.expect === 'FAIL' ? matched.length > 0 : matched.length === 0;
  const deletion = evaluateDeletedLog(caseItem, root, result);
  return {
    case: caseItem,
    ok: ruleOk && deletion.ok,
    error: deletion.ok ? undefined : deletion.error,
    matched,
    findings: result.findings,
    target: result.target,
  };
}

module.exports = {
  RULES,
  checkReport,
  checkDocument,
  writeFailList,
  evaluateCase,
  ruleIdMatches,
  locationMatches,
};
