# Wiki 工作流集成设计

**日期**: 2026-04-19  
**状态**: 已批准  
**触发**: 将未集成的 Wiki 功能（Wiki 索引页生成、领域 Wiki 更新）集成到日报/周报工作流

---

## 1. 概述

### 1.1 目标

将剩余的 Wiki 功能集成到日报、周报、月报工作流中，实现完整的自动化 Wiki 知识管理：

1. **Wiki 索引页自动生成** - 每次报告生成后自动更新 Wiki 索引
2. **领域 Wiki 自动更新** - 按项目领域分类自动维护领域概览页面

### 1.2 不集成的功能

以下功能**不**集成到自动工作流：

- **引用关系追踪** - 论文场景意义不大
- **项目对比页** - 按需查询型功能，保持手动触发

---

## 2. 架构设计

### 2.1 集成点

```
┌─────────────────────────────────────────────────────────────┐
│                    日报/周报/月报工作流                        │
│                                                              │
│  1. 抓取数据 → 2. AI 分析 → 3. 生成 HTML → 4. 更新首页         │
│                                                              │
│  5. 更新项目 Wiki (已完成)                                     │
│         ↓                                                    │
│  ┌────▼────────────────────────────────────┐                 │
│  │  【新增】Wiki 后处理步骤                              │
│  │   ├── 生成 Wiki 索引页 (reports/wiki-index.html)      │
│  │   └── 更新领域 Wiki (wiki/domains/{domain}.md)        │
│  └─────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块依赖

```
ReportPipeline (report-pipeline.js)
    └── WikiPostProcessor (新增)
            ├── WikiIndexGenerator (已有)
            └── WikiManager (已有)
                    └── CrossReferenceAnalyzer (已有，仅用于领域项目聚合)
```

---

## 3. 详细设计

### 3.1 Wiki 索引页生成

**触发时机**: 每次日报、周报、月报工作流完成后

**执行逻辑**:
```javascript
const WikiIndexGenerator = require('./generator/wiki-index-generator');
const generator = new WikiIndexGenerator({ outputDir: 'reports' });
await generator.generate();
```

**输出**: `reports/wiki-index.html`

**内容**:
- 统计卡片（项目数、领域 Wiki 数、总条目数）
- 领域导航网格
- 热门项目排行榜（按上榜次数 TOP 10）

**更新策略**: 全量重新生成（非增量），确保数据一致性

---

### 3.2 领域 Wiki 更新

**触发时机**: 每次日报、周报、月报工作流完成后

**执行逻辑**:
```javascript
// 从当日/当周/当月所有项目中提取领域分类
// 为每个领域更新对应的 wiki/domains/{domain}.md
```

**领域 Wiki 格式**:
```markdown
# {领域名称} 领域

## 领域概览
- 项目总数：N
- 最近更新：YYYY-MM-DD

## 代表项目（按上榜次数排序）
| 项目 | 首次上榜 | 上榜次数 | Stars |
|------|----------|----------|-------|
| owner/repo | 2026-04-01 | 8 | 15,234 |
| ... | ... | ... | ... |
```

**更新策略**: 轻量级更新
- ✅ 更新项目总数
- ✅ 更新代表项目列表（从项目 Wiki 中读取）
- ✅ 更新最近更新时间
- ❌ 不生成趋势分析（避免 LLM 调用开销）
- ❌ 不生成演变历史

---

### 3.3 新增模块：WikiPostProcessor

**文件**: `src/wiki/wiki-post-processor.js`

**职责**: 统一管理 Wiki 后处理逻辑

```javascript
class WikiPostProcessor {
  constructor(options = {}) {
    this.wikiManager = new WikiManager(options);
    this.indexGenerator = new WikiIndexGenerator(options);
  }

  /**
   * 执行 Wiki 后处理
   * @param {Array} projects - 当日/周/月的项目列表
   * @param {string} type - 报告类型 (daily/weekly/monthly)
   */
  async process(projects, type) {
    // 1. 生成 Wiki 索引页
    await this.indexGenerator.generate();

    // 2. 更新领域 Wiki
    await this.updateDomainWikis(projects);
  }

  /**
   * 更新领域 Wiki
   * @param {Array} projects - 项目列表
   */
  async updateDomainWikis(projects) {
    // 按领域分组
    // 更新/创建领域 Wiki 文件
  }
}
```

---

## 4. 工作流集成

### 4.1 ReportPipeline 修改

在 `ReportPipeline.execute()` 方法的步骤 5（更新项目 Wiki）之后，添加步骤 5.5：

```javascript
// 步骤 5: 更新项目 Wiki
if (type === 'daily' || type === 'weekly') {
  await this.executeStep('update-wiki', async () => {
    await this.updateProjectWikis(data, result.insights, type);
  }, result);
}

// 【新增】步骤 5.5: Wiki 后处理
if (this.enableWikiPostProcessing) {
  await this.executeStep('wiki-post-processing', async () => {
    await this.wikiPostProcessor.process(
      data.repositories || data.projects || [],
      type
    );
  }, result);
}
```

### 4.2 CompleteWorkflow 配置

在 `CompleteWorkflow` 构造函数中添加配置选项：

```javascript
this.pipeline = new ReportPipeline({
  enableAI: this.options.enableAI,
  enableHTML: this.options.enableHTML,
  enableIndex: this.options.enableIndex,
  enableNotification: this.options.enableNotification,
  enableWikiPostProcessing: true  // 新增配置
});
```

### 4.3 月报特殊处理

月报工作流需要单独触发 Wiki 后处理，因为月报数据是聚合数据，包含更多项目用于领域 Wiki 更新：

```javascript
// run-monthly-workflow.js
// 步骤 4 之后
await workflow.triggerWikiPostProcessing(monthlyData.projects);
```

---

## 5. 错误处理

### 5.1 Wiki 后处理失败不影响主流程

```javascript
try {
  await this.wikiPostProcessor.process(projects, type);
} catch (error) {
  logger.warn('[WikiPostProcessor] 后处理失败，不影响主报告流程', {
    error: error.message,
    type
  });
  // 不抛出异常，不中断主流程
}
```

### 5.2 领域 Wiki 文件不存在时自动创建

```javascript
const wikiPath = path.join(this.domainsDir, `${domain}.md`);
if (!fs.existsSync(wikiPath)) {
  await this.createDomainWiki(domain, wikiPath);
}
```

---

## 6. 性能考虑

### 6.1 预期开销

| 操作 | 预估时间 | 频率 |
|------|----------|------|
| Wiki 索引页生成 | ~500ms | 日报/周报/月报 |
| 领域 Wiki 更新 | ~200ms/领域 | 日报/周报/月报 |
| **总计** | **~1-2 秒** | - |

### 6.2 优化措施

1. **领域 Wiki 增量更新** - 只更新涉及当天/当周项目的领域
2. **Wiki 索引页缓存** - 如果项目数未变化，跳过生成
3. **异步执行** - Wiki 后处理不阻塞通知发送

---

## 7. 验收标准

1. **Wiki 索引页** - 每次日报/周报/月报后 `reports/wiki-index.html` 自动更新
2. **领域 Wiki** - 项目涉及的领域 Wiki 自动更新，项目列表正确
3. **错误隔离** - Wiki 后处理失败不影响报告生成和推送
4. **无重复 Wiki** - 领域 Wiki 不会重复创建同名文件
5. **日志可追踪** - Wiki 后处理的执行日志清晰可查

---

## 8. 后续扩展（本次不实现）

- [ ] Wiki 变更通知（Telegram/飞书推送 Wiki 更新）
- [ ] 领域趋势分析（LLM 生成领域发展趋势）
- [ ] Wiki 搜索功能（在索引页添加搜索框）
- [ ] 项目对比页自动生成（周报 Top 项目对比）

---

## 9. 相关文件

- `src/wiki/wiki-post-processor.js` - 新增 Wiki 后处理器
- `src/wiki/wiki-manager.js` - Wiki 核心管理
- `src/generator/wiki-index-generator.js` - Wiki 索引生成器
- `src/scraper/report-pipeline.js` - 报告流水线（修改）
- `src/scraper/complete-workflow.js` - 完整工作流（修改）
