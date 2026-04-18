const BaseScraper = require('../base-scraper');
const { downloadLatestPapers, saveRawData } = require('../paper-downloader');
const { getPaperDataPath, getPaperLatestPath } = require('../../utils/path');
const { writeJson } = require('../../utils/fs');
const logger = require('../../utils/logger');
const WikiManager = require('../../wiki/wiki-manager');
const path = require('path');
const fs = require('fs');

/**
 * PapersScraper - HuggingFace 论文抓取器
 * 继承 BaseScraper，专门用于抓取 HuggingFace 最新论文数据
 */
class PapersScraper extends BaseScraper {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} options.minStars - 最小 Stars 数阈值（默认 10）
   */
  constructor(options = {}) {
    super({
      type: 'paper',
      name: 'PapersScraper',
      timeout: options.timeout
    });
    this.minStars = options.minStars || 10;
    this.wikiManager = new WikiManager();
  }

  /**
   * 获取抓取器类型
   * @returns {string} 类型标识
   */
  getType() {
    return 'paper';
  }

  /**
   * 获取调度 cron 表达式
   * 默认每天早上 8 点执行
   * @returns {string} Cron 表达式
   */
  getSchedule() {
    return process.env.PAPER_SCHEDULE || '0 0 8 * * *';
  }

  /**
   * 获取输出文件名
   * @param {Date} date - 日期对象
   * @returns {string} 文件名
   */
  getFileName(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `papers-${year}-${month}-${day}.json`;
  }

  /**
   * 获取输出目录
   * @returns {string} 输出目录路径
   */
  getOutputDir() {
    return 'data/papers/daily';
  }

  /**
   * 获取完整输出路径
   * @param {string} baseDir - 基础目录
   * @param {Date} date - 日期对象
   * @returns {string} 完整路径
   */
  getOutputPath(baseDir = process.cwd(), date = new Date()) {
    const path = require('path');
    return path.join(baseDir, this.getOutputDir(), this.getFileName(date));
  }

  /**
   * 执行抓取
   * @param {Object} options - 选项
   * @param {boolean} options.saveToFile - 是否保存到文件
   * @returns {Promise<Object>} 抓取结果
   */
  async execute(options = {}) {
    logger.title('[PapersScraper] 开始抓取 HuggingFace 论文数据');

    // 步骤 1: 下载 latest.json
    const downloaded = await downloadLatestPapers();

    // 步骤 2: 过滤 Stars >= minStars 的论文
    const filteredPapers = downloaded.papers.filter(p => p.stars >= this.minStars);

    // 步骤 3: 保存完整数据（所有论文）
    const fullPath = this.getOutputPath(process.cwd(), new Date(downloaded.downloadedDate));
    await writeJson(fullPath, {
      scrapedAt: downloaded.downloadedAt,
      date: downloaded.downloadedDate,
      papers: downloaded.papers,
      stats: {
        totalCount: downloaded.papers.length,
        filteredCount: filteredPapers.length,
        minStars: this.minStars
      }
    });

    // 步骤 4: 保存 latest.json（原始数据）
    await saveRawData(downloaded, getPaperLatestPath());

    // 步骤 5: 更新论文 Wiki（新增）
    await this.updatePaperWikis(downloaded.papers, downloaded.downloadedDate);

    logger.success('[PapersScraper] 抓取完成', {
      total: downloaded.papers.length,
      filtered: filteredPapers.length,
      path: fullPath
    });

    return {
      success: true,
      data: downloaded,
      filteredPapers,
      path: fullPath
    };
  }

  /**
   * 更新论文 Wiki（收录时自动创建/更新）
   * @param {Array} papers - 论文数组
   * @param {string} date - 日期
   */
  async updatePaperWikis(papers, date) {
    logger.info('[PapersScraper] 开始更新论文 Wiki...');

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const paper of papers) {
      if (paper.stars < this.minStars) {
        skippedCount++;
        continue;
      }

      try {
        // 从 URL 提取 arXiv ID
        const arxivId = this.extractArxivId(paper.paper_url);
        if (!arxivId) {
          logger.debug(`[PapersScraper] 无法提取 arXiv ID: ${paper.paper_url}`);
          skippedCount++;
          continue;
        }

        // 检测论文领域
        const domain = this.detectPaperDomain(paper);

        // 检查 Wiki 是否已存在
        const wikiPath = path.join(this.wikiManager.papersDir, `${arxivId}.md`);
        const wikiExists = fs.existsSync(wikiPath);

        if (!wikiExists) {
          // 创建新 Wiki
          await this.wikiManager.createPaperWiki(arxivId, {
            title: paper.title,
            arxivId,
            authors: paper.authors?.join(', ') || 'Unknown',
            publishedDate: paper.details?.publishedDate || date,
            firstRecorded: date,
            paperType: this.detectPaperType(paper),
            domain,
            stars: String(paper.stars),
            codeLinks: this.extractCodeLinks(paper),
            summary: '（待分析）',
            versionHistory: '',
            relatedPapers: '（待分析）'
          });
          createdCount++;
          logger.debug(`[PapersScraper] 创建论文 Wiki: ${arxivId}`);
        } else {
          // 更新已有 Wiki（更新 stars 和收录历史）
          await this.wikiManager.updateBasicInfo(arxivId, null, {
            stars: String(paper.stars),
            lastUpdated: date
          });
          updatedCount++;
          logger.debug(`[PapersScraper] 更新论文 Wiki: ${arxivId}`);
        }
      } catch (error) {
        logger.warn(`[PapersScraper] 处理论文 ${paper.paper_url} 失败：${error.message}`);
      }
    }

    logger.info(`[PapersScraper] 论文 Wiki 更新完成：${createdCount} 个新建，${updatedCount} 个更新，${skippedCount} 个跳过`);
  }

  /**
   * 从 URL 提取 arXiv ID
   * @param {string} url - 论文 URL
   * @returns {string|null} arXiv ID
   */
  extractArxivId(url) {
    if (!url) return null;

    // 匹配 arxiv.org/abs/2401.12345 格式
    const absMatch = url.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i);
    if (absMatch) return absMatch[1];

    // 匹配 ar5iv.org/html/2401.12345 格式
    const htmlMatch = url.match(/ar5iv\.org\/html\/(\d{4}\.\d{4,5})/i);
    if (htmlMatch) return htmlMatch[1];

    return null;
  }

  /**
   * 检测论文领域
   * @param {Object} paper - 论文对象
   * @returns {string} 领域名称
   */
  detectPaperDomain(paper) {
    const text = (paper.title + ' ' + JSON.stringify(paper.details || {})).toLowerCase();

    if (text.includes('agent') || text.includes('multi') || text.includes('swarm')) return 'agent';
    if (text.includes('rag') || text.includes('retrieval') || text.includes('retriever')) return 'rag';
    if (text.includes('llm') || text.includes('language model') || text.includes('transformer')) return 'llm';
    if (text.includes('speech') || text.includes('audio') || text.includes('voice') || text.includes('tts')) return 'speech';
    if (text.includes('vision') || text.includes('image') || text.includes('diffusion')) return 'vision';
    if (text.includes('code') || text.includes('programming') || text.includes('dev')) return 'dev-tool';
    if (text.includes('robot') || text.includes('control')) return 'robotics';

    return 'other';
  }

  /**
   * 检测论文类型
   * @param {Object} paper - 论文对象
   * @returns {string} 论文类型
   */
  detectPaperType(paper) {
    const text = (paper.title + ' ' + JSON.stringify(paper.details || {})).toLowerCase();

    if (text.includes('survey') || text.includes('review')) return 'Survey';
    if (text.includes('benchmark') || text.includes('evaluation')) return 'Benchmark';
    if (text.includes('dataset')) return 'Dataset';
    if (text.includes('framework') || text.includes('tool')) return 'Tool';

    return 'Research';
  }

  /**
   * 提取代码链接
   * @param {Object} paper - 论文对象
   * @returns {Array} 代码链接数组
   */
  extractCodeLinks(paper) {
    const links = [];
    const details = paper.details || {};

    if (details.code_url) links.push(details.code_url);
    if (details.github_url) links.push(details.github_url);
    if (details.demo_url) links.push(details.demo_url);

    return links;
  }

  /**
   * 获取抓取器描述
   * @returns {Object} 描述信息
   */
  getDescription() {
    return {
      name: this.name,
      type: this.getType(),
      description: 'HuggingFace 论文抓取器',
      schedule: this.getSchedule(),
      minStars: this.minStars
    };
  }
}

module.exports = PapersScraper;
