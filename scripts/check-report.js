#!/usr/bin/env node
'use strict';

/**
 * 内容核查脚本（D1/D4）
 *
 * 用法：
 *   node scripts/check-report.js <daily|weekly|monthly> <期次> [--data-dir D] [--insights FILE] [--brief FILE] [--out-dir D]
 *   node scripts/check-report.js --cases <jsonl> [--cases-root DIR] [--data-dir D]
 *
 * 退出码：0 = PASS，1 = FAIL（或有用例未通过）。
 */

const fs = require('fs');
const path = require('path');

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
    const value = next !== undefined && !next.startsWith('--') ? next : true;
    if (value !== true) i += 1;
    const existing = result.options[key];
    if (existing === undefined) {
      result.options[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result.options[key] = [existing, value];
    }
  }
  return result;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function printFindings(result, limit = 200) {
  console.log('');
  console.log(`FAIL ${result.findings.length} 条：`);
  for (const finding of result.findings.slice(0, limit)) {
    const location = `${finding.file || '(未知文件)'}${finding.line ? `:${finding.line}` : ''}`;
    console.log(`- [${finding.rule_id}] ${location} ${finding.field || ''} | ${finding.message}`);
    if (finding.quote) console.log(`    「${finding.quote}」`);
  }
  if (result.findings.length > limit) {
    console.log(`... 其余 ${result.findings.length - limit} 条见 FAIL 清单文件`);
  }
}

function runReport(args) {
  const { checkReport, writeFailList } = require('../src/checker');
  const [level, period] = args.positional;
  if (!level || !period) {
    console.error('用法：node scripts/check-report.js <daily|weekly|monthly> <期次> [--data-dir D] [--insights FILE] [--brief FILE]');
    return 2;
  }

  const options = { level, period };
  if (args.options['data-dir']) options.dataDir = args.options['data-dir'];
  if (args.options.insights) options.insights = readJson(args.options.insights);
  if (args.options.brief) options.brief = readJson(args.options.brief);

  const result = checkReport(options);

  console.log(`内容核查：${level} ${period}`);
  console.log(`数据目录：${result.dataDir}`);
  console.log(result.pass ? 'PASS' : 'FAIL');

  if (!result.pass) {
    printFindings(result);
    const paths = writeFailList({
      level,
      period,
      dataDir: result.dataDir,
      findings: result.findings,
      outDir: args.options['out-dir'],
    });
    console.log('');
    console.log(`FAIL 清单：${paths.jsonPath}`);
    console.log(`FAIL 清单：${paths.mdPath}`);
    return 1;
  }

  return 0;
}

function runCases(args) {
  const { evaluateCase } = require('../src/checker');
  const rawCases = args.options.cases;
  const casesPaths = (Array.isArray(rawCases) ? rawCases : [rawCases])
    .filter(item => typeof item === 'string');
  if (casesPaths.length === 0) {
    console.error('用法：node scripts/check-report.js --cases <jsonl> [--cases <jsonl> ...] [--cases-root DIR] [--data-dir D]');
    return 2;
  }

  const casesRoot = path.resolve(args.options['cases-root'] || '/home/box/shared/report-redesign');
  const dataDir = args.options['data-dir'] || path.join(__dirname, '..', 'data');

  const results = [];
  for (const casesPath of casesPaths) {
    let resolvedCasesPath = path.resolve(casesPath);
    if (!fs.existsSync(resolvedCasesPath)) {
      const fallback = path.resolve(casesRoot, casesPath);
      if (fs.existsSync(fallback)) resolvedCasesPath = fallback;
    }
    if (!fs.existsSync(resolvedCasesPath)) {
      console.error(`用例文件不存在：${resolvedCasesPath}`);
      return 2;
    }

    const lines = fs.readFileSync(resolvedCasesPath, 'utf8')
      .split(/\r?\n/)
      .filter(line => line.trim());

    for (const line of lines) {
      let item;
      try {
        item = JSON.parse(line);
      } catch (error) {
        console.error(`用例 JSON 解析失败：${error.message}`);
        results.push({ ok: false, case: { id: '(parse error)' }, error: error.message });
        continue;
      }
      const evaluation = evaluateCase(item, { casesRoot, dataDir });
      results.push(evaluation);
      const status = evaluation.ok ? 'PASS' : 'FAIL';
      const expectation = item.expect;
      console.log(`${status} ${item.id} rule=${item.rule_id} expect=${expectation}${evaluation.error ? ` error=${evaluation.error}` : ''}`);
      if (!evaluation.ok) {
        if (evaluation.matched.length === 0) {
          console.log(`   未命中期望的 ${item.rule_id} FAIL；实际 findings=${evaluation.findings.length}`);
          for (const finding of evaluation.findings.slice(0, 5)) {
            console.log(`   - [${finding.rule_id}] ${finding.file}:${finding.line} ${finding.field} | ${finding.message}`);
          }
        } else {
          for (const finding of evaluation.matched.slice(0, 3)) {
            console.log(`   - [${finding.rule_id}] ${finding.file}:${finding.line} ${finding.field} | ${finding.message}`);
          }
        }
      }
    }
  }

  const summary = results.reduce((acc, item) => {
    const expected = item.case?.expect;
    if (item.ok) acc.pass += 1;
    else acc.fail += 1;
    if (expected === 'FAIL') acc.expectedFail += 1;
    else if (expected === 'PASS') acc.expectedPass += 1;
    return acc;
  }, { pass: 0, fail: 0, expectedFail: 0, expectedPass: 0 });

  console.log('');
  console.log(`用例结果：${summary.pass}/${results.length} 通过（期望 FAIL ${summary.expectedFail}，期望 PASS ${summary.expectedPass}）`);
  if (summary.fail > 0) {
    console.log(`未通过：${summary.fail}`);
    return 1;
  }
  return 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.options.cases) return runCases(args);
  return runReport(args);
}

process.exitCode = main();
