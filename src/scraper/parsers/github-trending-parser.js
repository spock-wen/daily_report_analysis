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

      // 提取星数 - 使用多种方法尝试获取
      let stars = 0;
      let todayStars = 0;
      let forks = 0;

      // 获取元素的 HTML 内容用于正则匹配
      const htmlContent = $element.prop('outerHTML') || '';
      
      // 提取总星数 - 匹配 stargazers 链接
      const starsMatch = htmlContent.match(/href="\/[^"]*\/stargazers"[^>]*>([\s\S]*?)<\/a>/);
      if (starsMatch) {
        const starsText = this.cleanHtml(starsMatch[1]).replace(/\s+/g, '');
        stars = this.parseStarCount(starsText);
      }
      
      // 如果方法1失败，尝试方法2: 通过选择器查找
      if (stars === 0) {
        $element.find('a[href*="stargazers"]').each((index, el) => {
          const text = $element.find(el).text().trim();
          const match = text.match(/([\d,.kKmM]+)/);
          if (match) {
            stars = this.parseStarCount(match[1]);
            return false; // 找到后停止
          }
        });
      }

      // 提取 fork 数 - 匹配 forks 链接
      const forksMatch = htmlContent.match(/href="\/[^"]*\/forks"[^>]*>([\s\S]*?)<\/a>/);
      if (forksMatch) {
        const forksText = this.cleanHtml(forksMatch[1]).replace(/\s+/g, '');
        forks = this.parseStarCount(forksText);
      }
      
      // 如果方法1失败，尝试方法2: 通过选择器查找
      if (forks === 0) {
        $element.find('a[href*="forks"]').each((index, el) => {
          const text = $element.find(el).text().trim();
          const match = text.match(/([\d,.kKmM]+)/);
          if (match) {
            forks = this.parseStarCount(match[1]);
            return false; // 找到后停止
          }
        });
      }

      // 提取今日新增星数
      // 方法1: 通过正则匹配 "X stars today" 或 "X stars this week" 等
      const sinceLabel = this.since === 'daily' ? 'today' : 
                        this.since === 'weekly' ? 'this week' : 'this month';
      const todayStarsRegex = new RegExp(`([\d,.kKmM]+)\s*stars?\\s*${sinceLabel}`, 'i');
      const todayStarsMatch = htmlContent.match(todayStarsRegex);
      if (todayStarsMatch) {
        todayStars = this.parseStarCount(todayStarsMatch[1]);
      }
      
      // 方法2: 查找包含 "today" 或 "this week" 的元素
      if (todayStars === 0) {
        $element.find('span, div').each((index, el) => {
          const text = $element.find(el).text().trim();
          const match = text.match(/([\d,.kKmM]+)\s*stars?\s*(today|this week|this month)/i);
          if (match) {
            todayStars = this.parseStarCount(match[1]);
            return false; // 找到后停止
          }
        });
      }

      // 方法3: 查找数字后跟 "today" 文本
      if (todayStars === 0) {
        const todayMatch = htmlContent.match(/>(\d[\d,kKmM]*)\s*star/i);
        if (todayMatch) {
          todayStars = this.parseStarCount(todayMatch[1]);
        }
      }

      logger.debug(`仓库 ${fullName} | Stars: ${stars} | Today: ${todayStars} | Forks: ${forks}`);

      // 提取主题标签
      const topics = [];
      $element.find('a.topic-tag-link').each((index, el) => {
        const topic = $element.find(el).text().trim();
        if (topic) {
          topics.push(topic);
        }
      });

      // 提取仓库链接
      const url = nameElement.attr('href');
      const fullUrl = url ? `https://github.com${url}` : '';

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
   * 清理 HTML 标签和实体
   * @param {string} text - 包含 HTML 的文本
   * @returns {string} 清理后的纯文本
   */
  cleanHtml(text) {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
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
