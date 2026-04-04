# HuggingFace Papers 数据目录

存储 HuggingFace AI Papers 报告的原始数据和洞察。

## 目录结构

```
data/papers/
├── daily/          # 每日数据
│   ├── papers-YYYY-MM-DD.json
│   └── papers-latest.json
├── insights/       # AI 洞察
│   └── papers-YYYY-MM-DD.json
└── README.md
```

## 文件说明

### daily/papers-YYYY-MM-DD.json

每日完整数据，包含所有论文（Stars > 0）

```json
{
  "scrapedAt": "...",
  "date": "2026-04-01",
  "papers": [...],
  "stats": {
    "totalCount": 100,
    "filteredCount": 30,
    "minStars": 10
  }
}
```

**字段说明**:
- `scrapedAt`: 抓取时间（ISO 8601 格式）
- `date`: 日期（YYYY-MM-DD 格式）
- `papers`: 论文列表（全部论文，Stars > 0）
- `stats`: 统计信息
  - `totalCount`: 论文总数
  - `filteredCount`: 热门论文数量（Stars >= minStars）
  - `minStars`: 热门论文阈值

### daily/papers-latest.json

原始 latest.json 数据（原始格式，完整未过滤）

### insights/papers-YYYY-MM-DD.json

AI 分析生成的洞察

```json
{
  "oneLiner": "...",
  "languageDistribution": {...},
  "technicalInsights": [...],
  "communityValue": [...],
  "applicationOutlook": [...]
}
```

**字段说明**:
- `oneLiner`: 一句话总结（30字以内）
- `languageDistribution`: 编程语言/框架分布
- `technicalInsights`: 技术亮点分析
- `communityValue`: 开源社区价值
- `applicationOutlook`: 应用前景展望
