const cheerio = require('cheerio');
const logger = require('../../utils/logger');

/**
 * GitHubTrendingParser - GitHub Trending 页面解析器
 * 使用 cheerio 解析 GitHub Trending HTML 页面
 * 
 * 提取字段：
 * - repo: 仓库全名
 * - name: 仓库名称
 * - owner: 所有者
 * - desc: 描述
 * - stars: 总星数
 * - todayStars: 今日新增星数
 * - language: 编程语言
 * - topics: 主题标签
 * - url: 仓库链接
 */
class GitHubTrendingParser {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.language - 筛选的编程语言（可选）
   * @param {string} options.since - 时间范围（daily/weekly/monthly）
   */
  constructor(options = {}) {
    this.language = options.language || '';
    this.since = options.since || 'daily';
    this.name = 'GitHubTrendingParser';
  }

  /**
   * 解析 GitHub Trending HTML
   * @param {string} html - HTML 内容
   * @returns {Array} 仓库数据数组
   */
  parse(html) {
    logger.info(`[${this.name}] 开始解析 GitHub Trending 页面...`);

    if (!html || typeof html !== 'string') {
      throw new Error('无效的 HTML 内容');
    }

    try {
      const $ = cheerio.load(html);
      const repositories = [];

      // 查找所有仓库卡片
      // GitHub Trending 页面的仓库卡片通常使用 article 标签
      $('article.Box-row').each((index, element) => {
        try {
          const repoData = this.parseRepository($(element));
          if (repoData) {
            repositories.push(repoData);
          }
        } catch (error) {
          logger.warn(`[${this.name}] 解析第 ${index + 1} 个仓库失败：${error.message}`);
        }
      });

      logger.success(`[${this.name}] 解析完成，共提取 ${repositories.length} 个仓库`);
      
      return repositories;
    } catch (error) {
      logger.error(`[${this.name}] 解析失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 解析单个仓库卡片
   * @param {CheerioAPI} $element - 仓库卡片元素
   * @returns {Object|null} 仓库数据
   */
  parseRepository($element) {
    try {
      // 提取仓库名称和所有者
      const nameElement = $element.find('h2.h3.lh-condensed a');
      const fullName = nameElement.attr('href')?.replace(/^\//, '') || '';
      const [owner, name] = fullName.split('/');

      if (!owner || !name) {
        logger.debug('跳过无效仓库：无法解析所有者和名称');
        return null;
      }

      // 提取描述
      let description = $element.find('p.col-9.color-fg-muted.my-1.pr-4').text().trim();
      if (!description) {
        // 尝试其他选择器
        description = $element.find('p[class*="color-fg-muted"]').first().text().trim();
      }

      // 提取编程语言
      const languageElement = $element.find('[itemprop="programmingLanguage"]');
      const language = languageElement.length > 0 ? languageElement.text().trim() : null;

      // 提取星数
      const starsElements = $element.find('a.mr-3.Link--muted');
      let stars = 0;
      let todayStars = 0;

      starsElements.each((_, el) => {
        const text = $(el).text().trim();
        const starMatch = text.match(/([\d,.kKmM]+)\s*stars?/i);
        
        if (starMatch) {
          const starCount = this.parseStarCount(starMatch[1]);
          
          // 如果有 fork 信息在前面，则这是总星数
          if (text.includes('fork')) {
            return;
          }
          
          // 判断是总星数还是今日星数
          if (stars === 0) {
            stars = starCount;
          }
        }
      });

      // 提取今日新增星数（通常在星数后面）
      const todayStarsElement = $element.find('span.d-inline-block.float-sm-left');
      if (todayStarsElement.length > 0) {
        const todayText = todayStarsElement.text().trim();
        const todayMatch = todayText.match(/([\d,.kKmM]+)\s*stars?\s*today/i);
        if (todayMatch) {
          todayStars = this.parseStarCount(todayMatch[1]);
        }
      }

      // 如果无法从页面提取今日星数，尝试从总星数推断（降级处理）
      if (todayStars === 0 && stars > 0) {
        // 无法推断，保持为 0
        logger.debug(`仓库 ${fullName} 无法获取今日星数`);
      }

      // 提取主题标签
      const topics = [];
      $element.find('a.topic-tag-link').each((_, el) => {
        const topic = $(el).text().trim();
        if (topic) {
          topics.push(topic);
        }
      });

      // 提取仓库链接
      const url = nameElement.attr('href');
      const fullUrl = url ? `https://github.com${url}` : '';

      // 提取 fork 数量
      const forkElement = $element.find('a.Link--muted:contains("fork")');
      let forks = 0;
      if (forkElement.length > 0) {
        const forkText = forkElement.text().trim();
        const forkMatch = forkText.match(/([\d,.kKmM]+)\s*forks?/i);
        if (forkMatch) {
          forks = this.parseStarCount(forkMatch[1]);
        }
      }

      // 构建仓库数据对象
      const repoData = {
        fullName,
        owner,
        name,
        description: description || '',
        stars,
        todayStars,
        forks,
        language: language || '',
        topics,
        url: fullUrl,
        scrapedAt: new Date().toISOString(),
        trendPeriod: this.since
      };

      logger.debug(`解析仓库：${fullName} | Stars: ${stars} | Today: ${todayStars} | Language: ${language || 'N/A'}`);
      
      return repoData;
    } catch (error) {
      logger.warn(`解析仓库卡片失败：${error.message}`);
      return null;
    }
  }

  /**
   * 解析星数（支持 k, m 等单位）
   * @param {string} starStr - 星数字符串
   * @returns {number} 星数
   */
  parseStarCount(starStr) {
    if (!starStr) return 0;
    
    // 移除逗号和空格
    const cleanStr = starStr.replace(/,/g, '').trim().toLowerCase();
    
    // 处理 k (千) 和 m (百万) 单位
    if (cleanStr.includes('k')) {
      return Math.floor(parseFloat(cleanStr.replace('k', '')) * 1000);
    } else if (cleanStr.includes('m')) {
      return Math.floor(parseFloat(cleanStr.replace('m', '')) * 1000000);
    } else {
      return parseInt(cleanStr, 10) || 0;
    }
  }

  /**
   * 过滤仓库列表
   * @param {Array} repositories - 仓库列表
   * @param {Object} filters - 过滤条件
   * @returns {Array} 过滤后的仓库列表
   */
  filterRepositories(repositories, filters = {}) {
    let filtered = repositories;

    // 按语言过滤
    if (filters.language) {
      filtered = filtered.filter(repo => 
        repo.language && repo.language.toLowerCase() === filters.language.toLowerCase()
      );
      logger.info(`按语言过滤后剩余 ${filtered.length} 个仓库`);
    }

    // 按最小星数过滤
    if (filters.minStars !== undefined) {
      filtered = filtered.filter(repo => repo.stars >= filters.minStars);
      logger.info(`按最小星数过滤后剩余 ${filtered.length} 个仓库`);
    }

    // 按主题过滤
    if (filters.topics && filters.topics.length > 0) {
      filtered = filtered.filter(repo => 
        filters.topics.some(topic => 
          repo.topics.some(repoTopic => 
            repoTopic.toLowerCase() === topic.toLowerCase()
          )
        )
      );
      logger.info(`按主题过滤后剩余 ${filtered.length} 个仓库`);
    }

    return filtered;
  }

  /**
   * 标准化输出格式
   * @param {Array} repositories - 仓库列表
   * @returns {Object} 标准化的数据结构
   */
  standardize(repositories) {
    return {
      success: true,
      count: repositories.length,
      scrapedAt: new Date().toISOString(),
      source: 'GitHub Trending',
      language: this.language || 'all',
      period: this.since,
      repositories: repositories.map(repo => ({
        fullName: repo.fullName,
        name: repo.name,
        owner: repo.owner,
        description: repo.description,
        stars: repo.stars,
        todayStars: repo.todayStars,
        forks: repo.forks,
        language: repo.language,
        topics: repo.topics,
        url: repo.url
      }))
    };
  }
}

module.exports = GitHubTrendingParser;
