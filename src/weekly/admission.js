'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { ensureDataDir } = require('../checker/context');
const { getISOWeekId, resetHistoryCache } = require('../metrics/history');
const { assessWeeklyRaw, resolveExpectedWeekStart } = require('./raw-readiness');

const ISO_WEEK_RE = /^\d{4}-W\d{2}$/;

function formalWeeklyHtmlPath(reportsDir, isoWeek) {
  if (!ISO_WEEK_RE.test(isoWeek)) {
    throw new Error(`非法周报期次：${isoWeek}`);
  }
  return path.join(reportsDir, 'weekly', `github-weekly-${isoWeek}.html`);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function receiptPath(formalDataDir, isoWeek) {
  return path.join(formalDataDir, '.admission', `weekly-${isoWeek}.json`);
}

function readReceipt(formalDataDir, isoWeek) {
  const filePath = receiptPath(formalDataDir, isoWeek);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function writeReceipt(formalDataDir, content, flags) {
  writeJson(receiptPath(formalDataDir, content.isoWeek), {
    version: 1,
    rawHash: content.rawHash,
    isoWeek: content.isoWeek,
    weekStart: content.weekStart,
    htmlCommitted: flags.htmlCommitted === true,
    notified: flags.notified === true,
    content,
  });
}

function readReusable(formalDataDir, snapshot) {
  const receipt = readReceipt(formalDataDir, snapshot.isoWeek);
  if (!receipt || receipt.rawHash !== snapshot.hash || !receipt.content) return null;
  if (receipt.isoWeek !== snapshot.isoWeek) return null;
  return receipt.content;
}

function cloneContent(content, snapshot) {
  if (!content || typeof content !== 'object') {
    throw new Error('预检没有返回可发布的内容');
  }
  const admitted = JSON.parse(JSON.stringify(content));
  admitted.rawHash = snapshot.hash;
  admitted.isoWeek = snapshot.isoWeek;
  admitted.weekStart = snapshot.weekStart;
  return admitted;
}

function writeAdmittedArtifacts(formalDataDir, content) {
  const isoWeek = content.isoWeek;
  if (content.insights) {
    writeJson(path.join(formalDataDir, 'insights', 'weekly', `insights-${isoWeek}.json`), content.insights);
  }
  if (content.brief) {
    writeJson(path.join(formalDataDir, 'briefs', 'weekly', `data-weekly-${isoWeek}.json`), content.brief);
  }
  if (content.facts) {
    writeJson(path.join(formalDataDir, 'facts', `facts-weekly-${isoWeek}.json`), content.facts);
  }
  if (content.renderMap) {
    writeJson(path.join(formalDataDir, 'render', `render_map-weekly-${isoWeek}.json`), content.renderMap);
  }
}

function commitHtml(dest, html) {
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(dest)}.${process.pid}.tmp`);
  fs.writeFileSync(temp, html, 'utf8');
  try {
    fs.linkSync(temp, dest);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function acquireLock(lockFile, allowSteal = true) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const token = `${process.pid}\n${Date.now()}-${Math.random()}`;
  try {
    const fd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(fd, token);
    return { fd, token, lockFile };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let current = '';
    try {
      current = fs.readFileSync(lockFile, 'utf8');
    } catch (readError) {
      return null;
    }
    const pid = Number(String(current).split('\n')[0]);
    if (allowSteal && !pidAlive(pid)) {
      try {
        fs.unlinkSync(lockFile);
      } catch (unlinkError) {
        return null;
      }
      return acquireLock(lockFile, false);
    }
    return null;
  }
}

function releaseLock(lock) {
  if (!lock) return;
  try {
    const current = fs.readFileSync(lock.lockFile, 'utf8');
    if (current === lock.token) fs.unlinkSync(lock.lockFile);
  } catch (error) {
    // 锁已消失时不再改正式产物。
  }
  try {
    fs.closeSync(lock.fd);
  } catch (error) {
    // 关闭失败不影响已经完成的发布判断。
  }
}

async function waitForWeeklyRaw(options) {
  const waitMs = Number.isFinite(options.waitMs) ? options.waitMs : 0;
  const pollMs = Number.isFinite(options.pollMs) && options.pollMs > 0 ? options.pollMs : 5000;
  const settleMs = Number.isFinite(options.settleMs) ? options.settleMs : 0;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const sleep = typeof options.sleep === 'function'
    ? options.sleep
    : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const deadline = now() + waitMs;
  let stable = null;

  while (true) {
    const assessed = assessWeeklyRaw({
      wikiBase: options.wikiBase,
      weekStart: options.weekStart,
      filePath: options.filePath,
      readFile: options.readFile,
    });
    const t = now();
    if (assessed.ready) {
      if (waitMs === 0 || settleMs === 0) return assessed;
      if (stable && stable.hash === assessed.hash && (t - stable.since) >= settleMs) return assessed;
      if (!stable || stable.hash !== assessed.hash) stable = { hash: assessed.hash, since: t };
    } else {
      stable = null;
    }
    if (t >= deadline) {
      if (assessed.ready) {
        return { ...assessed, ready: false, pass: false, code: 'RAW_UNSTABLE' };
      }
      return assessed;
    }
    const before = t;
    await sleep(Math.min(pollMs, deadline - t));
    if (now() === before) {
      return assessed.ready
        ? { ...assessed, ready: false, pass: false, code: 'RAW_UNSTABLE' }
        : assessed;
    }
  }
}

function alreadyPublished(htmlPath, isoWeek) {
  return {
    success: true,
    code: 'ALREADY_PUBLISHED',
    pass: true,
    skipped: true,
    isoWeek,
    htmlPath,
  };
}

async function defaultPreflight(ctx) {
  const { runIsolatedWeeklyPreflight } = require('./isolated-preflight');
  return runIsolatedWeeklyPreflight(ctx);
}

async function inspectWeeklyContent(options) {
  const { snapshot, isolatedRoot, insights, brief, facts, renderMap } = options;
  const dataDir = path.join(isolatedRoot, 'data');
  const period = snapshot.isoWeek;
  fs.mkdirSync(path.join(dataDir, 'insights', 'weekly'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'briefs', 'weekly'), { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'insights', 'weekly', `insights-${period}.json`),
    `${JSON.stringify(insights, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(dataDir, 'briefs', 'weekly', `data-weekly-${period}.json`),
    `${JSON.stringify(brief, null, 2)}\n`
  );
  const savedDataDir = process.env.REPORT_DATA_DIR;
  const logger = { info() {}, error() {} };
  try {
    const { runContentGate } = require('../checker/gate');
    const gate = await runContentGate({
      level: 'weekly',
      period,
      dataDir,
      logger,
      insights,
      brief,
      facts,
      renderMap,
    });
    return {
      pass: gate.pass === true,
      findings: gate.findings || [],
      failPaths: gate.paths || null,
      content: gate.pass ? {
        rawHash: snapshot.hash,
        isoWeek: snapshot.isoWeek,
        weekStart: snapshot.weekStart,
        insights,
        brief,
        facts: facts || null,
        renderMap: renderMap || null,
      } : null,
    };
  } finally {
    const repoData = path.join(__dirname, '../../data');
    ensureDataDir(savedDataDir || repoData);
    if (savedDataDir === undefined) delete process.env.REPORT_DATA_DIR;
    else process.env.REPORT_DATA_DIR = savedDataDir;
    resetHistoryCache();
  }
}

async function runWeeklyAdmission(options = {}) {
  const resolved = resolveExpectedWeekStart(options);
  if (!resolved.ok) {
    return { success: false, code: resolved.code, pass: false };
  }

  const isoWeek = getISOWeekId(resolved.weekStart);
  const formalDataDir = options.formalDataDir;
  const formalReportsDir = options.formalReportsDir;
  const htmlPath = formalWeeklyHtmlPath(formalReportsDir, isoWeek);
  if (fs.existsSync(htmlPath)) return alreadyPublished(htmlPath, isoWeek);

  const lock = acquireLock(options.lockFile || path.join(formalDataDir, '.locks', 'weekly-admission.lock'));
  if (!lock) {
    return { success: false, code: 'ALREADY_RUNNING', pass: false, isoWeek };
  }

  try {
    if (fs.existsSync(htmlPath)) return alreadyPublished(htmlPath, isoWeek);

    const snapshot = await waitForWeeklyRaw({ ...options, weekStart: resolved.weekStart });
    if (!snapshot.ready) {
      return {
        success: false,
        code: snapshot.code || 'RAW_NOT_READY',
        pass: false,
        isoWeek,
        filePath: snapshot.filePath || null,
      };
    }

    const isolatedRoot = options.isolatedRoot
      || fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-preflight-'));
    const ctx = { snapshot, isolatedRoot, formalDataDir, formalReportsDir };
    let admitted = readReusable(formalDataDir, snapshot);
    if (!admitted) {
      const preflight = options.preflight || defaultPreflight;
      let preflightResult;
      try {
        preflightResult = await preflight(ctx);
      } catch (error) {
        return { success: false, code: 'PREFLIGHT_ERROR', pass: false, error: error.message, isoWeek };
      }
      if (!preflightResult || preflightResult.pass !== true) {
        return {
          success: false,
          code: (preflightResult && preflightResult.code) || 'CONTENT_CHECK_FAILED',
          pass: false,
          findings: (preflightResult && preflightResult.findings) || [],
          failPaths: (preflightResult && preflightResult.failPaths) || null,
          isoWeek,
        };
      }
      const again = assessWeeklyRaw({
        wikiBase: options.wikiBase,
        weekStart: resolved.weekStart,
      });
      if (!again.ready || again.hash !== snapshot.hash) {
        return { success: false, code: 'INPUT_CHANGED', pass: false, isoWeek };
      }
      try {
        admitted = cloneContent(preflightResult.content, snapshot);
      } catch (error) {
        return { success: false, code: 'PREFLIGHT_ERROR', pass: false, error: error.message, isoWeek };
      }
      writeReceipt(formalDataDir, admitted, { htmlCommitted: false, notified: false });
    }

    const htmlWriter = options.htmlWriter || require('./formal-publish').renderFormalWeeklyHtml;
    let html;
    try {
      html = await htmlWriter(admitted, ctx);
    } catch (error) {
      return { success: false, code: 'PUBLISH_FAILED', pass: false, error: error.message, isoWeek };
    }
    if (typeof html !== 'string' || !html.trim()) {
      return { success: false, code: 'PUBLISH_FAILED', pass: false, error: '正式 HTML 为空', isoWeek };
    }

    try {
      commitHtml(htmlPath, html);
    } catch (error) {
      if (error.code === 'EEXIST') return alreadyPublished(htmlPath, isoWeek);
      return { success: false, code: 'PUBLISH_FAILED', pass: false, error: error.message, isoWeek };
    }
    writeAdmittedArtifacts(formalDataDir, admitted);
    writeReceipt(formalDataDir, admitted, { htmlCommitted: true, notified: false });

    if (options.enableIndex && typeof options.indexWriter === 'function') {
      try {
        await options.indexWriter(ctx);
      } catch (error) {
        return {
          success: true,
          code: 'PUBLISHED',
          pass: true,
          isoWeek,
          htmlPath,
          indexError: error.message,
        };
      }
    }

    if (options.noPush !== true && options.enableNotification && typeof options.notify === 'function') {
      try {
        await options.notify(admitted, ctx);
        writeReceipt(formalDataDir, admitted, { htmlCommitted: true, notified: true });
      } catch (error) {
        return {
          success: false,
          code: 'NOTIFY_FAILED',
          pass: false,
          isoWeek,
          htmlPath,
          error: error.message,
        };
      }
    }

    let wikiError = null;
    if (options.enableWiki && typeof options.wikiWriter === 'function') {
      try {
        await options.wikiWriter(admitted, ctx);
      } catch (error) {
        wikiError = error.message;
      }
    }

    return { success: true, code: 'PUBLISHED', pass: true, isoWeek, htmlPath, wikiError };
  } finally {
    releaseLock(lock);
  }
}

module.exports = {
  assessWeeklyRaw,
  resolveExpectedWeekStart,
  runWeeklyAdmission,
  inspectWeeklyContent,
  formalWeeklyHtmlPath,
};
