'use strict';

/**
 * 页头数值字段清单（J12）。
 * 生成器页头实际输出的全部数值字段，逐层列出；清单外的页头数字一律判 FAIL。
 */
module.exports = {
  daily: [
    { key: 'totalProjects', label: '上榜项目', kind: 'int' },
    { key: 'aiProjects', label: 'AI 项目', kind: 'int' },
    { key: 'avgStars', label: '平均 Stars', kind: 'text' },
    { key: 'hotProjects', label: '高热项目', kind: 'int' },
  ],
  weekly: [
    { key: 'totalProjects', label: '上榜项目', kind: 'int' },
    { key: 'avgStars', label: '平均 Stars', kind: 'text' },
    { key: 'aiPercent', label: 'AI 项目', kind: 'percent' },
    { key: 'darkHorse', label: '最大黑马', kind: 'int' },
  ],
  monthly: [
    { key: 'totalProjects', label: '总项目数', kind: 'int' },
    { key: 'recurringProjects', label: '重复上榜', kind: 'int' },
    { key: 'newProjects', label: '月度新星', kind: 'int' },
    { key: 'aiProjects', label: 'AI 项目', kind: 'int' },
  ],
};
