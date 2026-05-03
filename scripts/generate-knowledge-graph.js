#!/usr/bin/env node

/**
 * 生成知识图谱脚本
 * 从 Wiki 数据构建知识图谱并生成首页
 */

const path = require('path');
const logger = require('../src/utils/logger');
const { IndexPageGenerator } = require('../src/wiki');

async function main() {
  try {
    logger.info('========================================');
    logger.info('  GitHub AI 趋势知识图谱生成器');
    logger.info('========================================');

    const generator = new IndexPageGenerator();
    const outputPath = path.join(process.cwd(), 'reports', 'wiki-index.html');
    await generator.generate(outputPath);

    logger.info('');
    logger.success('知识图谱生成完成！');
    logger.info(`输出文件: ${outputPath}`);
    logger.info('');
    logger.info('提示: 在浏览器中打开该文件查看知识图谱');
    logger.info('');

  } catch (error) {
    logger.error('生成知识图谱时出错:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

main();
