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
const { buildCaseViewModel } = require('./case-vm');

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
  require('./rules/r11b'),
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

  // B1：daily 未显式给 viewModel 时，用 brief/insights/facts 构造 VM 再进规则
  // （与 case 运行器共用 case-vm.js 一处实现，构造失败直接抛错，不静默退回不受检）
  let viewModel = options.viewModel;
  if (viewModel === undefined && level === 'daily' && brief) {
    viewModel = buildCaseViewModel({ brief, insights, facts, date: period });
  }

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

  return runRules({
    level,
    period,
    dataDir,
    brief,
    insights,
    documents,
    renderMap,
    facts,
    r3: options.r3,
    viewModel,
    prevDate: options.prevDate,
  });
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

// 按 `a.b[0].c` 这类路径给对象赋值（叶子不存在则创建），仅供用例改写 VM 用。
function setPath(target, pathText, value) {
  if (!target || typeof target !== 'object' || !pathText) return target;
  const keys = String(pathText)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(key => key !== '');
  if (!keys.length) return target;
  let node = target;
  for (const [index, key] of keys.entries()) {
    const isLast = index === keys.length - 1;
    const arrayKey = /^\d+$/.test(key);
    if (isLast) {
      if (arrayKey) node[Number(key)] = value;
      else node[key] = value;
      break;
    }
    const nextKey = keys[index + 1];
    const wantArray = /^\d+$/.test(nextKey);
    if (node[key] === undefined || node[key] === null || typeof node[key] !== 'object') {
      node[key] = wantArray ? [] : {};
    }
    node = node[key];
  }
  return target;
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
        // 构造 VM 失败直接抛错：该 case 记为错误/FAIL，不得 catch{} 吞掉后悄悄退回不受检。
        brief = JSON.parse(fs.readFileSync(path.join(fixtureDir, briefFileName), 'utf8'));
        let insights = null;
        if (fs.existsSync(filePath)) insights = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        viewModel = buildCaseViewModel({
          brief,
          insights,
          facts: readCaseJson(caseItem.facts, root),
          prevDate: caseItem.prevDate,
          date: brief.date || (briefFileName.match(/\d{4}-\d{2}-\d{2}/) || [])[0],
        });
        // 用例可在 cases 里声明 {path, value} 改写 VM，仅影响本条用例的检查。
        const mutation = caseItem.vm_mutation;
        if (mutation && typeof mutation === 'object' && mutation.path && viewModel) {
          setPath(viewModel, mutation.path, mutation.value);
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

  // B5：期望 FAIL 且指定了 expected_hit_fields 时，命中还需覆盖每个字段（前缀匹配）
  const expectedFields = Array.isArray(caseItem.expected_hit_fields)
    ? caseItem.expected_hit_fields.filter(field => field !== '(none)')
    : [];
  let missingFields = [];
  if (caseItem.expect === 'FAIL' && expectedFields.length > 0) {
    const hitFields = matched.map(finding => String(finding.field || ''));
    missingFields = expectedFields.filter(expected =>
      !hitFields.some(hit => hit === expected || hit.startsWith(`${expected}.`) || hit.startsWith(`${expected}[`))
    );
  }

  const ruleOk = caseItem.expect === 'FAIL'
    ? (matched.length > 0 && missingFields.length === 0)
    : matched.length === 0;
  const deletion = evaluateDeletedLog(caseItem, root, result);
  return {
    case: caseItem,
    ok: ruleOk && deletion.ok,
    error: deletion.ok ? undefined : deletion.error,
    matched,
    missingFields,
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
