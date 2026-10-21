#!/usr/bin/env node
'use strict';

/**
 * B12：从一份抓取快照构建日报 brief。
 *
 * 用法：
 *   node scripts/build-brief-from-snapshot.js \
 *     --snapshot <trending-raw.json> --data-dir <D>
 *
 * 约束：
 * - 只读取快照里的 stars/todayStars/forks 等数字，不调用 GitHub API，不重抓、不改数字；
 * - 可以复用历史 brief 的描述翻译/分析，但绝不覆盖快照数字；
 * - 目标 brief 已存在时直接报错退出，不覆盖；
 * - 把快照的 scrapedAt 写入 brief，供成品页显示抓取时刻（UTC+8）。
 *
 * 退出码：0 = 成功；2 = 参数/数据错误。
 */

const fs = require('fs');
const path = require('path');
const history = require('../src/metrics/history');
const metrics = require('../src/metrics');
const ProjectAnalyzer = require('../src/scraper/project-analyzer');

// 本地判断是否 AI 项目，不调用 GitHub API。
const AI_TEXT_RE = /(?:^|[^a-z0-9])(ai|agent|llm|gpt|model|machine learning|deep learning|neural|transformer|rag|embedding|copilot|assistant|智能|大模型|机器学习)(?:[^a-z0-9]|$)/i;

function detectAIProject(repository) {
  const text = `${repository.name || ''} ${repository.description || ''} ${repository.language || ''} ${(repository.topics || []).join(' ')}`;
  return AI_TEXT_RE.test(text);
}

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

function printUsage() {
  console.error(`用法：node scripts/build-brief-from-snapshot.js --snapshot <trending-raw.json> --data-dir D

必填选项：
  --snapshot <file>   抓取快照（含 scrapedAt 与 repositories[]）
  --data-dir D        数据目录；brief 写到 D/briefs/daily/data-<抓取日>.json，已存在则拒绝覆盖

日报期次按 scrapedAt 换算的 SGT 日期（UTC+8）自动命名。`);
}

function formatAvgStars(projects) {
  if (!projects.length) return '0';
  const total = projects.reduce((sum, project) => sum + (Number(project.stars) || 0), 0);
  const avg = Math.round(total / projects.length);
  return avg >= 1000 ? `${(avg / 1000).toFixed(0)}k` : `${avg}`;
}

function collectPriorProjects(date) {
  const map = new Map();
  for (const entry of history.getRecentDailyEntries(date, 30)) {
    for (const project of entry.brief?.projects || []) {
      const key = history.projectKey(project);
      if (!key || map.has(key)) continue;
      map.set(key, project);
    }
  }
  return map;
}

function projectKeyOf(repository) {
  return repository.fullName
    || (repository.owner && repository.name ? `${repository.owner}/${repository.name}` : repository.name);
}

function buildProject(repository, prior, analyzer) {
  const fullName = projectKeyOf(repository);
  if (!fullName) return null;

  const description = repository.description || repository.desc || '';
  const project = {
    fullName,
    name: repository.name || fullName.split('/')[1] || '',
    owner: repository.owner || fullName.split('/')[0] || '',
    description,
    // 数字只取快照，后续不调用 GitHub API 覆盖。
    stars: Number(repository.stars) || 0,
    todayStars: Number(repository.todayStars) || 0,
    forks: Number(repository.forks) || 0,
    language: repository.language || '',
    topics: Array.isArray(repository.topics) ? repository.topics.slice() : [],
    url: repository.url || `https://github.com/${fullName}`,
    repo: fullName,
    desc: description,
    descZh: prior?.descZh || '',
    hasApiData: false,
    isAI: prior?.isAI !== undefined ? Boolean(prior.isAI) : detectAIProject({ ...repository, fullName }),
  };

  // 描述翻译/分析可以复用历史 brief；数字不参与复用。
  const analysis = prior?.analysis
    ? JSON.parse(JSON.stringify(prior.analysis))
    : analyzer.generateAnalysis({ ...project, description });
  // 只复用描述翻译/类型分析；oneSentence 按快照描述重写，避免把历史数字带进本期卡片。
  analysis.oneSentence = analyzer.generateOneSentence(project);
  project.analysis = analysis;

  return project;
}

function topCount(projects, pick) {
  const counts = new Map();
  for (const project of projects) {
    const key = pick(project);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = null;
  for (const [name, count] of counts) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

function buildSummary(brief) {
  const projects = brief.projects || [];
  const topType = topCount(projects, project => project.analysis?.type);
  const topLang = topCount(projects, project => project.language);
  return {
    date: brief.date,
    period: brief.period,
    triggerType: brief.triggerType,
    total: projects.length,
    aiCount: projects.filter(project => project.isAI).length,
    avgStars: brief.stats?.avgStars,
    topType,
    topLang,
    topProject: projects[0]?.fullName || '',
    maxTodayStars: projects.reduce((max, project) => Math.max(max, Number(project.todayStars) || 0), 0),
    hotProjectCount: projects.filter(project => (Number(project.todayStars) || 0) > 100).length,
    projects: projects.slice(0, 10).map(project => ({
      name: project.fullName,
      type: project.analysis?.type || '',
      lang: project.language || '',
      stars: project.stars,
      todayStars: String(project.todayStars),
      desc: String(project.description || '').slice(0, 120),
    })),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshotOption = args.options.snapshot;
  const dataDirOption = args.options['data-dir'];

  if (typeof snapshotOption !== 'string' || !snapshotOption.trim()
    || typeof dataDirOption !== 'string' || !dataDirOption.trim()) {
    printUsage();
    return 2;
  }

  const snapshotPath = path.resolve(snapshotOption);
  const dataDir = path.resolve(dataDirOption);

  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  } catch (error) {
    console.error(`错误：无法读取快照 ${snapshotPath}：${error.message}`);
    return 2;
  }

  const repositories = snapshot?.repositories;
  if (!Array.isArray(repositories) || repositories.length === 0) {
    console.error(`错误：快照缺少 repositories[]：${snapshotPath}`);
    return 2;
  }
  if (!snapshot.scrapedAt || Number.isNaN(new Date(snapshot.scrapedAt).getTime())) {
    console.error(`错误：快照缺少有效的 scrapedAt：${snapshotPath}`);
    return 2;
  }

  // J1：日报按抓取日（scrapedAt 换算 SGT 日期）命名；--date 不再决定期次。
  const date = history.getScrapedDate(snapshot.scrapedAt);
  if (!date) {
    console.error(`错误：无法从 scrapedAt 换算抓取日：${snapshotPath}`);
    return 2;
  }
  const targetPath = path.join(dataDir, 'briefs', 'daily', `data-${date}.json`);

  if (fs.existsSync(targetPath)) {
    console.error(`错误：目标 brief 已存在，拒绝覆盖：${targetPath}`);
    return 2;
  }

  process.env.REPORT_DATA_DIR = dataDir;
  history.resetHistoryCache();

  const priorByName = collectPriorProjects(date);
  const analyzer = new ProjectAnalyzer();
  const projects = repositories
    .map(repository => buildProject(repository, priorByName.get(projectKeyOf(repository)), analyzer))
    .filter(Boolean)
    // B14：日报榜单按 todayStars 降序，与原站排序不同。
    .sort((left, right) => (Number(right.todayStars) || 0) - (Number(left.todayStars) || 0));

  const brief = {
    generatedAt: new Date().toISOString(),
    scrapedAt: snapshot.scrapedAt,
    date,
    triggerType: 'daily',
    period: '每日',
    sourceSnapshot: snapshotPath,
    projects,
    stats: {
      totalProjects: projects.length,
      aiProjects: projects.filter(project => project.isAI).length,
      avgStars: formatAvgStars(projects),
    },
  };

  const computed = metrics.enrichDailyBrief(brief, { date });
  if (!computed) {
    console.error(`错误：无法计算 ${date} 的日报指标`);
    return 2;
  }
  brief.summary = buildSummary(brief);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.writeFileSync(targetPath, `${JSON.stringify(brief, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    if (error.code === 'EEXIST') {
      console.error(`错误：目标 brief 已存在，拒绝覆盖：${targetPath}`);
      return 2;
    }
    throw error;
  }

  console.log(`快照：${snapshotPath}`);
  console.log(`抓取时刻：${brief.scrapedAt}`);
  console.log(`日期：${date}`);
  console.log(`项目：${projects.length}`);
  console.log(`输出：${targetPath}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`[build-brief-from-snapshot] 执行失败：${error.message}`);
  process.exitCode = 1;
}
