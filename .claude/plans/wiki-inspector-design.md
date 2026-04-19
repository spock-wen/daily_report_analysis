# Wiki 巡检机制设计方案

## Context

用户提出需要为 Wiki 系统建立巡检机制，目的是主动发现并报告 Wiki 数据的健康问题，而不是等到用户手动发现问题。

当前状态：
- Wiki 系统已集成到日报/周报/月报工作流中
- 已有基础的去重逻辑（`appendVersion` 中的 date-eventType 检查）
- 已有清理脚本（`clean-wiki-duplicates.js`）
- **缺失**：系统性的健康检查、问题发现、数据质量监控

---

## 设计目标

1. **主动发现问题**：在用户报告之前发现数据质量问题
2. **可执行的检查**：每个检查项都能明确指出问题和修复建议
3. **低侵入性**：不影响现有报告生成流程
4. **可扩展**：新增检查项不需要修改核心逻辑

---

## 架构设计

### 三层巡检体系

```
┌─────────────────────────────────────────────────────────────┐
│                    Wiki Inspector                           │
│  统一入口：scripts/wiki-inspect.js                          │
│  输出：检查报告（CLI + HTML + JSON）                        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   结构完整性检查  │ │   数据质量检查    │ │   关联性检查     │
│  StructureCheck  │ │   QualityCheck   │ │  RelationCheck   │
├──────────────────┤ ├──────────────────┤ ├──────────────────┤
│ • 文件存在性     │ │ • 字段完整性     │ │ • 跨项目引用     │
│ • Markdown 格式   │ │ • 数据格式       │ │ • 领域分布       │
│ • 必填章节       │ │ • Stars 趋势     │ │ • 孤立项目检测   │
│ • 版本连续性     │ │ • 更新频率       │ │ • 重复内容       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 检查项设计

### 一、结构完整性检查（StructureCheck）

| 检查项 | 检查逻辑 | 健康标准 | 修复建议 |
|--------|---------|---------|---------|
| `file-exists` | 检查 `wiki/projects/{owner}_{repo}.md` 文件存在 | 100% 存在 | 重新运行报告生成 |
| `markdown-valid` | 解析 Markdown 语法是否合法 | 无语法错误 | 手动修复或重新生成 |
| `required-sections` | 检查包含：基本信息、核心功能、版本历史 | 3 个章节都存在 | 补充缺失章节 |
| `version-history-not-empty` | 版本历史章节至少有 1 条记录 | ≥1 条记录 | 检查数据源是否遗漏 |

### 二、数据质量检查（QualityCheck）

| 检查项 | 检查逻辑 | 健康标准 | 修复建议 |
|--------|---------|---------|---------|
| `stars-format` | Stars 字段必须是数字或可解析格式（如 1.5k） | 100% 可解析 | 标准化格式 |
| `domain-valid` | domain 必须在预定义列表中 | 100% 有效 | 使用默认值 'other' |
| `date-format` | 日期必须是 YYYY-MM-DD 格式 | 100% 合规 | 格式化修复 |
| `no-duplicate-versions` | 同一 date-eventType 不能有重复 | 0 重复 | 运行 `clean-wiki-duplicates.js` |
| `core-functions-not-empty` | 核心功能列表不应为空 | ≥80% 项目有内容 | 重新分析或手动补充 |
| `stars-up-to-date` | Stars 更新日期与最近上榜日期差异 ≤7 天 | ≥90% 项目合规 | 触发数据刷新 |

### 三、关联性检查（RelationCheck）

| 检查项 | 检查逻辑 | 健康标准 | 修复建议 |
|--------|---------|---------|---------|
| `domain-projects-count` | 每个领域至少有 1 个项目 | 所有领域 ≥1 | 检查领域分类逻辑 |
| `orphan-projects` | 检测没有领域分类的项目 | =0 | 补充领域分类 |
| `cross-reference-valid` | 跨项目引用的目标项目必须存在 | 100% 有效 | 清理无效引用 |
| `domain-wiki-exists` | 每个有项目的领域必须有对应的 `domains/{domain}.md` | 100% 存在 | 运行 Wiki 后处理 |

---

## 输出设计

### CLI 输出（终端）

```
============================================================
  Wiki 健康检查报告
  检查时间：2026-04-19 19:45:32
  项目总数：106
============================================================

✅ 结构完整性检查
  ✅ file-exists          106/106 文件存在
  ✅ markdown-valid       106/106 格式正确
  ⚠️  required-sections     98/106 包含必填章节 (8 个缺失)
  ✅ version-history      106/106 有版本历史

⚠️  数据质量检查
  ✅ stars-format         106/106 格式正确
  ✅ domain-valid         106/106 领域有效
  ✅ date-format          106/106 日期格式正确
  ⚠️  no-duplicates        90/106 无重复 (16 个有重复)
  ⚠️  core-functions       75/106 有核心功能 (31 个为空)
  ⚠️  stars-up-to-date     89/106 数据新鲜 (17 个过期)

✅ 关联性检查
  ✅ domain-projects      7 个领域都有项目
  ✅ orphan-projects      0 个孤立项目
  ✅ cross-reference      45/45 引用有效
  ✅ domain-wiki          7/7 领域 Wiki 存在

============================================================
  总体健康度：85/100 (良好)
  
  需要关注的问题:
  1. 8 个项目缺失必填章节
  2. 16 个项目有重复版本记录
  3. 31 个项目核心功能为空
  4. 17 个项目 Stars 数据过期
  
  修复建议:
  • 运行 node scripts/clean-wiki-duplicates.js 清理重复记录
  • 重新运行日报工作流刷新数据
============================================================
```

### JSON 输出（机器可读）

```json
{
  "timestamp": "2026-04-19T19:45:32.000Z",
  "summary": {
    "totalProjects": 106,
    "healthScore": 85,
    "passedChecks": 9,
    "warningChecks": 4,
    "failedChecks": 0
  },
  "checks": [
    {
      "name": "no-duplicate-versions",
      "category": "quality",
      "status": "warning",
      "message": "16 个项目有重复版本记录",
      "details": [
        {"file": "wiki/projects/jamiepine_voicebox.md", "duplicates": 4},
        {"file": "wiki/projects/lsdefine_GenericAgent.md", "duplicates": 4}
      ],
      "fixCommand": "node scripts/clean-wiki-duplicates.js"
    }
  ]
}
```

### HTML 输出（可视化报告）

- 健康度仪表盘（饼图/进度条）
- 问题项目列表（可点击定位）
- 历史趋势图（健康度变化）
- 一键修复按钮（触发修复脚本）

---

## 实现方案

### 文件结构

```
src/wiki/
  ├── inspector/
  │   ├── wiki-inspector.js      # 主检查器
  │   ├── checks/
  │   │   ├── structure-check.js # 结构检查
  │   │   ├── quality-check.js   # 质量检查
  │   │   └── relation-check.js  # 关联检查
  │   └── reporters/
  │       ├── cli-reporter.js    # CLI 输出
  │       ├── json-reporter.js   # JSON 输出
  │       └── html-reporter.js   # HTML 报告
scripts/
  ├── wiki-inspect.js            # CLI 入口
  └── wiki-repair.js             # 修复脚本（可选）
```

### 核心接口

```javascript
class WikiInspector {
  constructor(options = {}) {
    this.wikiDir = options.baseDir || path.join(process.cwd(), 'wiki');
    this.checks = []; // 注册的检查项
  }

  // 注册检查项
  registerCheck(category, name, checkFn) {
    this.checks.push({ category, name, checkFn });
  }

  // 执行所有检查
  async inspect() {
    const results = [];
    for (const check of this.checks) {
      const result = await check.checkFn(this.wikiDir);
      results.push(result);
    }
    return this.aggregate(results);
  }

  // 聚合结果并计算健康度
  aggregate(results) {
    // ...
  }
}

// 检查项标准接口
async function checkFn(wikiDir) {
  return {
    name: 'check-name',
    status: 'pass' | 'warning' | 'fail',
    message: '检查结果描述',
    details: [], // 问题详情
    fixCommand: '可选的修复命令'
  };
}
```

### 使用方式

```bash
# 完整检查
node scripts/wiki-inspect.js

# 只检查特定类别
node scripts/wiki-inspect.js --category quality

# 只检查特定项目
node scripts/wiki-inspect.js --project owner/repo

# 输出 JSON 格式
node scripts/wiki-inspect.js --json

# 生成 HTML 报告
node scripts/wiki-inspect.js --html

# 自动修复可修复的问题
node scripts/wiki-inspect.js --auto-fix
```

---

## 集成点

### 1. 定期巡检（定时任务）

在现有调度器中添加巡检任务：

```javascript
// src/scraper/scheduler.js
const { WikiInspector } = require('../wiki/inspector/wiki-inspector');

// 每天 6:00 执行巡检（在日报生成前）
cron.schedule('0 6 * * *', async () => {
  const inspector = new WikiInspector();
  const report = await inspector.inspect();
  if (report.healthScore < 80) {
    // 发送告警通知
    await notifyAdmin(report);
  }
});
```

### 2. CI/CD 集成

在提交前或部署前运行检查：

```yaml
# .github/workflows/wiki-check.yml
jobs:
  wiki-health:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: node scripts/wiki-inspect.js --json > wiki-health.json
      - name: Check health score
        run: |
          SCORE=$(jq .summary.healthScore wiki-health.json)
          if [ $SCORE -lt 70 ]; then
            echo "Wiki health score too low: $SCORE"
            exit 1
          fi
```

### 3. 报告生成后检查

在 ReportPipeline 完成后触发增量检查：

```javascript
// src/scraper/report-pipeline.js
async execute(type, data) {
  // ... 现有流程
  
  // 步骤：wiki-health-check
  if (this.enableWikiPostProcessing) {
    await this.executeStep('wiki-health-check', async () => {
      const inspector = new WikiInspector();
      const report = await inspector.inspectIncremental(changedProjects);
      if (report.hasIssues) {
        logger.warn('Wiki health check found issues', report);
      }
    });
  }
}
```

---

## 修复脚本（可选）

```bash
# 一键修复所有可修复的问题
node scripts/wiki-repair.js

# 交互式修复（逐个确认）
node scripts/wiki-repair.js --interactive

# 只修复特定问题
node scripts/wiki-repair.js --fix duplicates
node scripts/wiki-repair.js --fix format
node scripts/wiki-repair.js --fix stale-data
```

---

## 验证计划

1. **单元测试**：每个检查项独立测试
2. **集成测试**：模拟问题数据，验证检查器能正确发现
3. **性能测试**：1000+ Wiki 文件时，检查时间 < 30 秒
4. **真实运行**：在现有 Wiki 数据上运行，验证问题检出率

---

## 下一步

1. 创建 `src/wiki/inspector/` 目录结构
2. 实现 3 个检查模块（structure/quality/relation）
3. 实现 CLI 和 JSON Reporter
4. 编写测试用例
5. 集成到调度器（可选）
