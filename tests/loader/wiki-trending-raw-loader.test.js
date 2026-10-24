/**
 * wiki-trending-raw-loader + DailyScraper 日榜路径
 * - 映射正确
 * - 文件缺失抛错且不触发 scrape URL / fetch
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  mapWikiProject,
  mapWikiRawToScrapeShape,
  loadWikiTrendingRaw,
  rawFilePath
} = require('../../src/loader/wiki-trending-raw-loader');
const DailyScraper = require('../../src/scraper/strategies/daily-scraper');
const GitHubScraper = require('../../src/scraper/github-scraper');

const FIXTURE = path.join(
  __dirname,
  '../fixtures/wiki-trending-raw/2026-10-18.json'
);

describe('wiki-trending-raw-loader', () => {
  it('mapWikiProject 映射 repo→fullName/owner/name 与 stars 字段', () => {
    const mapped = mapWikiProject({
      rank: 1,
      repo: 'anthropics/claude-plugins-official',
      description: 'Official plugins',
      language: 'Python',
      stars_today: 1383,
      total_stars: 41683,
      url: 'https://github.com/anthropics/claude-plugins-official'
    });
    assert.strictEqual(mapped.fullName, 'anthropics/claude-plugins-official');
    assert.strictEqual(mapped.owner, 'anthropics');
    assert.strictEqual(mapped.name, 'claude-plugins-official');
    assert.strictEqual(mapped.todayStars, 1383);
    assert.strictEqual(mapped.stars, 41683);
    assert.strictEqual(mapped.description, 'Official plugins');
    assert.strictEqual(mapped.language, 'Python');
    assert.strictEqual(mapped.url, 'https://github.com/anthropics/claude-plugins-official');
    assert.strictEqual(mapped.rank, 1);
    assert.strictEqual('forks' in mapped, false);
    assert.strictEqual('topics' in mapped, false);
  });

  it('mapWikiRawToScrapeShape 用真实 wiki-B 样例', () => {
    const raw = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const data = mapWikiRawToScrapeShape(raw, '2026-10-18');
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.period, 'daily');
    assert.strictEqual(data.source, 'wiki-trending-raw');
    assert.strictEqual(data.date, '2026-10-18');
    assert.strictEqual(data.count, raw.count);
    assert.strictEqual(data.repositories.length, raw.projects.length);
    assert.strictEqual(data.projects.length, raw.projects.length);
    assert.strictEqual(
      data.repositories[0].fullName,
      'anthropics/claude-plugins-official'
    );
    assert.strictEqual(data.repositories[0].todayStars, 1383);
    assert.strictEqual(data.repositories[0].stars, 41683);
  });

  it('loadWikiTrendingRaw 从 base 读文件', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-raw-base-'));
    const destDir = path.join(base, 'raw', 'trending');
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(FIXTURE, path.join(destDir, '2026-10-18.json'));

    const data = await loadWikiTrendingRaw({ base, date: '2026-10-18' });
    assert.strictEqual(data.count, 13);
    assert.strictEqual(data.source, 'wiki-trending-raw');
  });

  it('文件缺失抛错', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-raw-miss-'));
    await assert.rejects(
      () => loadWikiTrendingRaw({ base, date: '2099-01-01' }),
      (err) => {
        assert.match(err.message, /缺失/);
        assert.strictEqual(err.code, 'WIKI_TRENDING_RAW_MISSING');
        return true;
      }
    );
  });

  it('空 projects 抛错', () => {
    assert.throws(
      () => mapWikiRawToScrapeShape({ date: '2026-10-18', projects: [] }, '2026-10-18'),
      /为空/
    );
  });
});

describe('DailyScraper wiki raw 路径', () => {
  let tmpBase;

  before(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-raw-daily-'));
    const destDir = path.join(tmpBase, 'raw', 'trending');
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(FIXTURE, path.join(destDir, '2026-10-18.json'));
  });

  it('execute(daily) 读 raw 且不调用 fetch', async () => {
    const scraper = new DailyScraper();
    let fetchCalled = false;
    scraper.fetch = async () => {
      fetchCalled = true;
      throw new Error('不应请求 github.com/trending');
    };

    const data = await scraper.execute({
      date: '2026-10-18',
      wikiBase: tmpBase
    });

    assert.strictEqual(fetchCalled, false);
    assert.strictEqual(data.source, 'wiki-trending-raw');
    assert.strictEqual(data.repositories[0].fullName, 'anthropics/claude-plugins-official');
    assert.ok(!String(scraper.url || '').includes('SHOULD_NOT'));
  });

  it('raw 缺失时抛错且不触发 fetch（不回落 HTML）', async () => {
    const scraper = new DailyScraper();
    let fetchCalled = false;
    scraper.fetch = async () => {
      fetchCalled = true;
      return '<html></html>';
    };

    await assert.rejects(
      () => scraper.execute({ date: '2099-01-01', wikiBase: tmpBase }),
      /缺失|wiki/
    );
    assert.strictEqual(fetchCalled, false);
  });

  it('GitHubScraper type=daily 同样走 raw', async () => {
    const scraper = new GitHubScraper({ type: 'daily' });
    let fetchCalled = false;
    scraper.fetch = async () => {
      fetchCalled = true;
      return '<html></html>';
    };
    const data = await scraper.execute({ date: '2026-10-18', wikiBase: tmpBase });
    assert.strictEqual(fetchCalled, false);
    assert.strictEqual(data.period, 'daily');
  });
});
