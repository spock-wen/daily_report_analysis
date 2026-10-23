'use strict';

/**
 * 页头数值字段清单（J12）。
 * 生成器页头实际输出的全部数值字段，逐层列出；清单外的页头数字一律判 FAIL。
 * r11b：周报改为新增合计/剔头部环比/换血率/上榜项目数；月报页头不再用四卡（格局表为主）。
 * 旧标签仍保留以兼容 content-compare 历史夹具 HTML。
 */
module.exports = {
  daily: [
    { key: 'totalProjects', label: '上榜项目', kind: 'int' },
    { key: 'aiProjects', label: 'AI 项目', kind: 'int' },
    { key: 'avgStars', label: '平均 Stars', kind: 'text' },
    { key: 'hotProjects', label: '高热项目', kind: 'int' },
  ],
  weekly: [
    { key: 'weekNewStars', label: '本周新增合计', kind: 'text' },
    { key: 'exHeadRate', label: '环比（剔头部）', kind: 'text' },
    { key: 'churnRate', label: '换血率', kind: 'text' },
    { key: 'totalProjects', label: '上榜项目数', kind: 'int' },
    // 兼容旧夹具
    { key: 'totalProjectsLegacy', label: '上榜项目', kind: 'int' },
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
