# GitHub AI Trending 周报功能 Spec

## Why

目前项目已实现日报功能，但缺少周度维度的趋势总结和分析。周报能够：
- 提供一周项目的整体概览和趋势分析
- 发现技术模式和新兴领域
- 帮助开发者把握中长期技术方向
- 补充日报的短期视角，形成完整的时间维度报告体系

**核心价值定位**：
- 日报 = 快速响应（今日热点）
- 周报 = 深度分析（趋势洞察）
- **差异化**：AI 深度分析驱动，不只是数据堆砌

## What Changes

### 新增功能
- **周报 HTML 模板**：AI 深度分析驱动的周报页面结构
- **周度主题提炼**：一句话总结本周核心特点
- **AI 深度洞察模块**：热点、趋势、行动建议
- **重点项目推荐**：AI 评估推荐 Top 3
- **项目分组展示**：按领域/类型分类

### 修改内容
- **html-generator.js**：实现完整的 `renderWeeklyHTML()` 方法
- **prompts.json**：优化周报 AI 提示词，增加周度主题、行动建议
- **insight-analyzer.js**：可能需要调整解析逻辑以支持新字段

### 保持复用
- 数据加载流程（`DataLoader.loadWeeklyData()`）✅ 已存在
- AI 分析流程（`InsightAnalyzer.analyzeWeekly()`）✅ 已存在
- 脚本执行流程（`generate-weekly.js`）✅ 已存在

## Impact

### 影响的功能
- HTML 生成器：需要实现完整的周报模板
- AI 分析器：需要优化提示词和输出格式
- 用户体验：周报应该比日报更有深度

### 影响的文件
- `src/generator/html-generator.js` - 主要修改文件
- `config/prompts.json` - 周报提示词优化
- `src/analyzer/insight-analyzer.js` - 可能需要微调解析逻辑
- `reports/weekly/` - 新增周报输出目录

## ADDED Requirements

### Requirement: 周报 HTML 模板结构
系统 SHALL 提供周报专用的 HTML 模板，包含以下模块：

1. **Header** - 标题和周期
2. **周度概览** - 核心统计数据
3. **周度主题** - AI 提炼的一句话总结
4. **AI 深度洞察** - 热点、趋势、行动建议
5. **重点项目推荐** - AI 评估的 Top 3
6. **项目分组展示** - 按领域分类
7. **Footer** - 版权信息

### Requirement: 周度概览数据
系统 SHALL 展示以下核心指标：
- 上榜项目总数
- AI 项目数量及占比
- 平均 Stars
- 领域分布（Agent、语音处理、通用工具等）
- 语言分布（TypeScript、Python 等）

### Requirement: 周度主题（AI 提炼）
系统 SHALL 展示 AI 生成的周度主题：
- **一句话总结**：概括本周核心特点（50 字以内）
- **详细解读**：深入分析本周趋势（200 字左右）

示例：
```
🎯 本周主题
"Agent 系统持续主导，自托管 AI 与多智能体协作成双热点"

本周 10 个上榜项目中，6 个为 Agent 系统，占比达 60%。
值得关注的是，多个项目聚焦'自托管'和'多智能体协作'两个方向，
反映出 AI 应用正从'云端服务'向'本地部署'、从'单一 AI'向'多 AI 协作'演进...
```

### Requirement: AI 深度洞察
系统 SHALL 展示 AI 生成的深度分析，包含：

**🔥 本周热点**
- 具体项目和数据支撑
- 为什么值得关注

**📈 技术趋势**
- 短期趋势（1-4 周）

**🆕 新兴领域**
- 新兴技术领域
- 代表性项目

**🎯 行动建议**
- 针对开发者的建议
- 针对企业的建议

### Requirement: 重点项目推荐
系统 SHALL 展示 AI 评估的 Top 3 推荐项目：
- 项目名称和链接
- 入选理由（为什么推荐）
- 核心价值
- 适用场景

示例：
```
🏆 本周最值得关注的 3 个项目

1. RuView（技术创新）
   - 入选理由：跨界融合 WiFi 信号与人体姿态估计
   - 核心价值：无摄像头隐私保护方案
   - 适用场景：医疗监护、智能家居、安防
```

### Requirement: 项目分组展示
系统 SHALL 按项目类型/领域分组展示：
- **Agent 系统**：智能代理、自动化工具
- **语音处理**：语音识别、TTS 等
- **通用工具**：开发工具、效率工具
- **其他领域**：新兴领域项目

每组包含：
- 分组标题和项目数量
- 该领域的项目列表
- 每个项目的核心信息

### Requirement: 视觉设计
系统 SHALL 采用精致的暗黑科技风格：
- 使用高级字体组合（JetBrains Mono + IBM Plex Mono + Plus Jakarta Sans）
- 配色方案：黑色背景 + 绿色强调色
- 统一的间距系统
- 响应式设计，支持移动端

## MODIFIED Requirements

### Requirement: HTML 生成器的周报渲染方法
**原要求**：`renderWeeklyHTML()` 使用简化版本，直接调用日报模板

**修改后**：
```javascript
/**
 * 渲染周报 HTML
 * @param {Object} data - 周报数据（包含 brief 和 aiInsights）
 * @returns {string} HTML 字符串
 */
renderWeeklyHTML(data) {
  // 完整的周报模板，包含：
  // 1. Header（标题、周期）
  // 2. 周度概览（统计数据）
  // 3. 周度主题（AI 提炼）
  // 4. AI 深度洞察（热点、趋势、行动建议）
  // 5. 重点项目推荐（AI 评估 Top 3）
  // 6. 项目分组展示（按领域）
  // 7. Footer
}
```

### Requirement: AI 提示词优化
**原提示词输出格式**：
```json
{
  "summary": "周度总结",
  "highlights": ["亮点 1"],
  "topProjects": [{"repo": "owner/repo", "reason": "理由"}],
  "techTrends": ["趋势 1"],
  "emergingFields": ["领域 1"],
  "nextWeekWatch": ["关注 1"]
}
```

**修改后输出格式**：
```json
{
  "weeklyTheme": {
    "oneLiner": "一句话总结（50 字以内）",
    "detailed": "详细解读（200 字左右）"
  },
  "highlights": [
    "热点 1（包含项目和数据）",
    "热点 2",
    "热点 3"
  ],
  "topProjects": [
    {
      "repo": "owner/repo",
      "category": "技术创新|持续热门|企业价值",
      "reason": "入选理由（100 字以内）",
      "value": "核心价值",
      "useCases": ["适用场景 1", "适用场景 2"]
    }
  ],
  "trends": {
    "shortTerm": ["短期趋势 1", "短期趋势 2"]
  },
  "emergingFields": [
    {
      "field": "领域名称",
      "description": "领域描述",
      "projects": ["代表项目 1", "代表项目 2"]
    }
  ],
  "recommendations": {
    "developers": ["开发者建议 1", "建议 2"],
    "enterprises": ["企业建议 1", "建议 2"]
  }
}
```

## REMOVED Requirements

无（周报功能为新增功能，不涉及移除）

## 设计规范

### 配色方案
参考报告的设计风格，使用更精致的配色：
```css
:root {
  --bg: #0a0a0a;
  --bg-elevated: #141414;
  --bg-subtle: #1a1a1a;
  --text: #fff;
  --text-dim: #888;
  --text-muted: #555;
  --border: #222;
  --accent: #00ff41;
}
```

### 字体系统
使用 Google Fonts 的高级字体组合：
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- **Plus Jakarta Sans**：正文字体
- **IBM Plex Mono**：标题、数字
- **JetBrains Mono**：代码、技术术语

### 间距系统
使用统一的间距变量：
```css
--space-sm: 0.5rem;   /* 8px */
--space-md: 1rem;     /* 16px */
--space-lg: 1.5rem;   /* 24px */
--space-xl: 2rem;     /* 32px */
```

### 布局设计
- **统计卡片**：4 列网格（移动端 2 列）
- **领域分布**：4 列网格（移动端 1 列）
- **项目分组**：2 列网格（移动端 1 列）
- **AI 洞察**：全宽卡片式布局

### 响应式断点
- **桌面端**：≥ 960px
- **平板端**：768px - 959px
- **移动端**：< 768px

## 数据流程

### 数据来源
1. **周报 JSON**（主要数据源）
   - `data\briefs\weekly\data-weekly-2026-W11.json`
   - 包含：项目列表、统计数据、汇总信息

2. **AI 洞察 JSON**（核心价值）
   - `data\ai-insights\weekly\ai-insights-weekly-2026-W11.json`
   - 包含：周度主题、深度洞察、推荐建议

### 数据处理流程
```
1. 读取周报 JSON
   ↓
2. 加载/生成 AI 洞察
   ↓
3. 整合数据
   ↓
4. 渲染 HTML 模板
   ↓
5. 输出周报文件
```

## 验收标准

### 功能验收
- [ ] 周报 HTML 可以正常生成
- [ ] 所有模块内容完整展示
- [ ] AI 洞察内容合理、有深度
- [ ] 项目链接可点击
- [ ] 响应式设计正常

### 质量验收
- [ ] 视觉效果精致、专业
- [ ] 内容有价值（不只是数据堆砌）
- [ ] 与日报有明显差异化
- [ ] 代码风格一致

### 性能验收
- [ ] 生成时间 < 5 秒
- [ ] HTML 文件大小合理
- [ ] 浏览器加载流畅
