'use strict';

const { checkReport, writeFailList } = require('./index');

/**
 * 生成流程内容闸（D1/D3）
 * 1. 先核查；FAIL 时用 FAIL 清单重写洞察 1 次；
 * 2. 仍 FAIL：写 FAIL 清单并返回 pass=false（调用方不得写 HTML/推送）；
 * 3. 每期打印一行 AI_CALLS period=<期号> count=<n>。
 */
function checkOptions(options) {
  const result = { level: options.level, period: options.period, dataDir: options.dataDir };
  if (typeof options.getRenderMap === 'function') result.renderMap = options.getRenderMap();
  else if (options.renderMap !== undefined) result.renderMap = options.renderMap;
  if (typeof options.getFacts === 'function') result.facts = options.getFacts();
  else if (options.facts !== undefined) result.facts = options.facts;
  if (options.renderMapPath) result.renderMapPath = options.renderMapPath;
  if (options.factsPath) result.factsPath = options.factsPath;
  if (options.r3) result.r3 = true;
  return result;
}

async function runContentGate(options = {}) {
  const { level, period, dataDir, rewrite, getAiCallCount, logger } = options;

  let result = checkReport(checkOptions(options));
  let rewrites = 0;

  if (!result.pass && typeof rewrite === 'function') {
    logger.info(`[ContentGate] 内容核查 FAIL ${result.findings.length} 条，重写洞察 1 次...`);
    try {
      await rewrite(result.findings);
    } catch (error) {
      logger.error(`[ContentGate] 重写洞察失败：${error.message}`);
    }
    rewrites = 1;
    result = checkReport(checkOptions(options));
  }

  const calls = typeof getAiCallCount === 'function'
    ? getAiCallCount()
    : rewrites + 1;
  logger.info(`AI_CALLS period=${period} count=${calls}`);

  if (result.pass) {
    return { pass: true, findings: [], rewrites };
  }

  const paths = writeFailList({
    level,
    period,
    dataDir: result.dataDir || dataDir,
    findings: result.findings,
  });

  const stopMessage = options.writeHtmlOnFail
    ? '[ContentGate] 内容核查仍 FAIL，停止生成（不写正式 HTML、不推送；仅输出 .FAIL.html 供审阅）'
    : '[ContentGate] 内容核查仍 FAIL，停止生成（不写 HTML、不推送）';
  logger.error(stopMessage, {
    level,
    period,
    failCount: result.findings.length,
    jsonPath: paths.jsonPath,
  });

  return { pass: false, findings: result.findings, paths, rewrites };
}

module.exports = {
  runContentGate,
};
