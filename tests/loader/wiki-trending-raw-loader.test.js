/**
 * wiki-trending-raw-loader + Daily/Weekly/MonthlyScraper 路径
 * - 映射正确（日 stars_today；周/月 stars_this_period → todayStars）
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
  rawFilePath,
  resolvePeriodKey
} = require('../../src/loader/wiki-trending-raw-loader');
const DailyScraper = require('../../src/scraper/strategies/daily-scraper');
const WeeklyScraper = require('../../src/scraper/strategies/weekly-scraper');
const MonthlyScraper = require('../../src/scraper/strategies/monthly-scraper');
const GitHubScraper = require('../../src/scraper/github-scraper');

const FIXTURE = path.join(
  __dirname,
  '../fixtures/wiki-trending-raw/2026-10-18.json'
);
const FIXTURE_WEEKLY = path.join(
  __dirname,
  '../fixtures/wiki-trending-raw/weekly-2026-10-19.json'
);
const FIXTURE_MONTHLY = path.join(
  __dirname,
  '../fixtures/wiki-trending-raw/monthly-2026-10.json'
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

  it('mapWikiProject 周/月用 stars_this_period→todayStars，不编造 forks/topics', () => {
    const mapped = mapWikiProject({
      rank: 1,
      repo: 'cloudflare/security-audit-skill',
      description: 'A coding-agent skill',
      language: 'JavaScript',
      stars_this_period: 18942,
      total_stars: 42041,
      url: 'https://github.com/cloudflare/security-audit-skill'
    }, 'weekly');
    assert.strictEqual(mapped.fullName, 'cloudflare/security-audit-skill');
    assert.strictEqual(mapped.todayStars, 18942);
    assert.strictEqual(mapped.stars, 42041);
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

  it('mapWikiRawToScrapeShape 周样例', () => {
    const raw = JSON.parse(fs.readFileSync(FIXTURE_WEEKLY, 'utf8'));
    const data = mapWikiRawToScrapeShape(raw, '2026-10-19', 'weekly');
    assert.strictEqual(data.period, 'weekly');
    assert.strictEqual(data.source, 'wiki-trending-raw');
    assert.strictEqual(data.date, '2026-10-19');
    assert.strictEqual(data.week_start, '2026-10-19');
    assert.strictEqual(data.count, 8);
    assert.strictEqual(data.repositories[0].fullName, 'cloudflare/security-audit-skill');
    assert.strictEqual(data.repositories[0].todayStars, 18942);
    assert.strictEqual(data.repositories[0].stars, 42041);
    assert.strictEqual('forks' in data.repositories[0], false);
  });

  it('mapWikiRawToScrapeShape 月样例', () => {
    const raw = JSON.parse(fs.readFileSync(FIXTURE_MONTHLY, 'utf8'));
    const data = mapWikiRawToScrapeShape(raw, '2026-10', 'monthly');
    assert.strictEqual(data.period, 'monthly');
    assert.strictEqual(data.date, '2026-10');
    assert.strictEqual(data.month, '2026-10');
    assert.strictEqual(data.count, 8);
    assert.strictEqual(data.repositories[0].todayStars, 75768);
    assert.strictEqual(data.repositories[0].stars, 42041);
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

  it('loadWikiTrendingRaw weekly 从 trending-weekly 读', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-raw-w-'));
    const destDir = path.join(base, 'raw', 'trending-weekly');
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(FIXTURE_WEEKLY, path.join(destDir, '2026-10-19.json'));

    const data = await loadWikiTrendingRaw({
      base,
      date: '2026-10-19',
      period: 'weekly'
    });
    assert.strictEqual(data.period, 'weekly');
    assert.strictEqual(data.count, 8);
    assert.ok(rawFilePath(base, '2026-10-19', 'weekly').includes('trending-weekly'));
  });

  it('loadWikiTrendingRaw monthly 从 trending-monthly 读', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-raw-m-'));
    const destDir = path.join(base, 'raw', 'trending-monthly');
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(FIXTURE_MONTHLY, path.join(destDir, '2026-10.json'));

    const data = await loadWikiTrendingRaw({
      base,
      date: '2026-10',
      period: 'monthly'
    });
    assert.strictEqual(data.period, 'monthly');
    assert.strictEqual(data.month, '2026-10');
    assert.strictEqual(data.count, 8);
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

  it('周/月文件缺失抛错', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-raw-miss-wm-'));
    await assert.rejects(
      () => loadWikiTrendingRaw({ base, date: '2099-01-01', period: 'weekly' }),
      /缺失/
    );
    await assert.rejects(
      () => loadWikiTrendingRaw({ base, date: '2099-01', period: 'monthly' }),
      /缺失/
    );
  });

  it('空 projects 抛错', () => {
    assert.throws(
      () => mapWikiRawToScrapeShape({ date: '2026-10-18', projects: [] }, '2026-10-18'),
      /为空/
    );
  });

  it('resolvePeriodKey weekly 归一到周一', () => {
    // 2026-10-24 周六 → 周一 2026-10-19
    assert.strictEqual(resolvePeriodKey('weekly', '2026-10-24'), '2026-10-19');
    assert.strictEqual(resolvePeriodKey('weekly', '2026-10-19'), '2026-10-19');
    assert.strictEqual(resolvePeriodKey('monthly', '2026-10-24'), '2026-10');
    assert.strictEqual(resolvePeriodKey('monthly', '2026-10'), '2026-10');
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

describe('WeeklyScraper / MonthlyScraper wiki raw 路径', () => {
  let tmpBase;

  before(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-raw-wm-'));
    const wDir = path.join(tmpBase, 'raw', 'trending-weekly');
    const mDir = path.join(tmpBase, 'raw', 'trending-monthly');
    fs.mkdirSync(wDir, { recursive: true });
    fs.mkdirSync(mDir, { recursive: true });
    fs.copyFileSync(FIXTURE_WEEKLY, path.join(wDir, '2026-10-19.json'));
    fs.copyFileSync(FIXTURE_MONTHLY, path.join(mDir, '2026-10.json'));
  });

  it('execute(weekly) 读 raw 且不请求 trending?since=weekly', async () => {
    const scraper = new WeeklyScraper();
    let fetchCalled = false;
    let fetchUrl = null;
    scraper.fetch = async (url) => {
      fetchCalled = true;
      fetchUrl = url;
      throw new Error('不应请求 github.com/trending?since=weekly');
    };

    const data = await scraper.execute({
      date: '2026-10-19',
      wikiBase: tmpBase
    });

    assert.strictEqual(fetchCalled, false);
    assert.strictEqual(fetchUrl, null);
    assert.strictEqual(data.source, 'wiki-trending-raw');
    assert.strictEqual(data.period, 'weekly');
    assert.strictEqual(data.repositories[0].todayStars, 18942);
    assert.ok(!String(scraper.url || '').includes('fetched'));
  });

  it('weekly raw 缺失抛错且不回落 HTML', async () => {
    const scraper = new WeeklyScraper();
    let fetchCalled = false;
    scraper.fetch = async () => {
      fetchCalled = true;
      return '<html>trending weekly</html>';
    };
    await assert.rejects(
      () => scraper.execute({ date: '2099-01-06', wikiBase: tmpBase }),
      /缺失|wiki/
    );
    assert.strictEqual(fetchCalled, false);
  });

  it('execute(monthly) 读 raw 且不请求 trending?since=monthly', async () => {
    const scraper = new MonthlyScraper();
    let fetchCalled = false;
    scraper.fetch = async () => {
      fetchCalled = true;
      throw new Error('不应请求 github.com/trending?since=monthly');
    };

    const data = await scraper.execute({
      date: '2026-10',
      wikiBase: tmpBase
    });

    assert.strictEqual(fetchCalled, false);
    assert.strictEqual(data.period, 'monthly');
    assert.strictEqual(data.month, '2026-10');
    assert.strictEqual(data.repositories[0].todayStars, 75768);
  });

  it('monthly raw 缺失抛错且不回落 HTML', async () => {
    const scraper = new MonthlyScraper();
    let fetchCalled = false;
    scraper.fetch = async () => {
      fetchCalled = true;
      return '<html>trending monthly</html>';
    };
    await assert.rejects(
      () => scraper.execute({ date: '2099-01', wikiBase: tmpBase }),
      /缺失|wiki/
    );
    assert.strictEqual(fetchCalled, false);
  });

  it('GitHubScraper type=weekly|monthly 同样走 raw', async () => {
    for (const type of ['weekly', 'monthly']) {
      const scraper = new GitHubScraper({ type });
      let fetchCalled = false;
      scraper.fetch = async () => {
        fetchCalled = true;
        return '<html></html>';
      };
      const date = type === 'weekly' ? '2026-10-19' : '2026-10';
      const data = await scraper.execute({ date, wikiBase: tmpBase });
      assert.strictEqual(fetchCalled, false, `${type} must not fetch`);
      assert.strictEqual(data.period, type);
      assert.strictEqual(data.source, 'wiki-trending-raw');
    }
  });
});
