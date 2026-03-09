# 周报开发任务清单

## 任务列表

### Task 1: 优化 AI 提示词 ⭐ (优先级：高) ✅
**目标**：更新 `prompts.json` 中的周报提示词，支持新的输出格式

- [x] 分析现有周报提示词结构
- [x] 添加 `weeklyTheme` 字段（一句话总结 + 详细解读）
- [x] 优化 `topProjects` 格式（增加 category、value、useCases）
- [x] 添加 `trends` 字段（shortTerm 短期趋势）
- [x] 优化 `emergingFields` 格式（包含 field、description、projects）
- [x] 添加 `recommendations` 字段（developers、enterprises）
- [x] 更新示例输出
- [x] 测试提示词效果

**输出物**：更新后的 `config/prompts.json` ✅

---

### Task 2: 实现周报 HTML 模板 ⭐⭐⭐ (优先级：最高) ✅
**目标**：在 `html-generator.js` 中实现完整的 `renderWeeklyHTML()` 方法

#### 2.1 设计 CSS 样式 ✅
- [x] 定义 CSS 变量（配色、间距、字体）
- [x] 引入 Google Fonts（JetBrains Mono、IBM Plex Mono、Plus Jakarta Sans）
- [x] 编写基础样式（body、container、header、footer）
- [x] 编写统计卡片样式
- [x] 编写 AI 洞察卡片样式
- [x] 编写项目分组卡片样式
- [x] 编写响应式媒体查询

#### 2.2 实现渲染方法 ✅
- [x] 实现 `renderWeeklyHTML()` 主方法
- [x] 实现 `renderHeader()` - Header（标题、周期）
- [x] 实现 `renderWeeklyStats()` - 周度概览（统计数据）
- [x] 实现 `renderWeeklyTheme()` - 周度主题（AI 提炼）
- [x] 实现 `renderAIInsights()` - AI 深度洞察（热点、趋势、行动建议）
- [x] 实现 `renderTopProjects()` - 重点项目推荐（Top 3）
- [x] 实现 `renderProjectGroups()` - 项目分组展示（按领域）
- [x] 实现 `renderFooter()` - Footer

#### 2.3 辅助方法 ✅
- [x] 实现项目分组逻辑（按 analysis.type）
- [x] 实现领域分布统计
- [x] 实现语言分布统计
- [x] 实现数字格式化（千位分隔符）

**输出物**：更新后的 `src/generator/html-generator.js` ✅

---

### Task 3: 更新 AI 洞察解析逻辑 (优先级：中) ✅
**目标**：确保 `insight-analyzer.js` 能正确解析新的 AI 输出格式

- [x] 检查 `parseInsights()` 方法
- [x] 支持新的 JSON 格式（weeklyTheme、trends、recommendations 等）
- [x] 补充项目链接信息（github_url）
- [x] 添加字段验证和容错处理
- [x] 测试解析逻辑

**输出物**：更新后的 `src/analyzer/insight-analyzer.js` ✅

---

### Task 4: 测试周报生成流程 (优先级：高) ✅
**目标**：使用真实数据测试完整流程

#### 4.1 功能测试 ✅
- [x] 运行 `node scripts/generate-weekly.js 2026-W11`
- [x] 检查 AI 洞察生成是否成功
- [x] 检查 HTML 文件生成位置
- [x] 检查 HTML 内容完整性

#### 4.2 视觉测试 ✅
- [x] 在 Chrome 中打开 HTML
- [x] 检查视觉效果是否精致
- [x] 检查响应式布局（调整窗口大小）
- [x] 检查字体渲染
- [x] 检查颜色和对比度

#### 4.3 内容验证 ✅
- [x] 统计数据是否准确
- [x] AI 洞察内容是否有深度
- [x] 项目链接是否可点击
- [x] 项目分组是否合理
- [x] 周度主题是否精准

#### 4.4 性能测试 ✅
- [x] 测量生成时间（目标 < 5 秒）
- [x] 检查 HTML 文件大小
- [x] 测试浏览器加载速度

**输出物**：测试报告和问题清单 ✅

---

### Task 5: 代码审查和优化 (优先级：中) ✅
**目标**：确保代码质量和一致性

- [x] 检查代码风格（与日报一致）
- [x] 移除不必要的注释
- [x] 优化代码结构
- [x] 检查错误处理
- [x] 确保日志输出完整
- [x] 运行 lint（如果有）
- [x] 代码审查

**输出物**：优化后的代码 ✅

---

## 任务依赖关系

```
Task 1 (提示词) → Task 3 (解析逻辑)
                      ↓
Task 2 (HTML 模板) ──────→ Task 4 (测试) → Task 5 (审查)
```

- **Task 1** 和 **Task 2** 可以并行
- **Task 3** 依赖于 Task 1（需要知道新格式）
- **Task 4** 依赖于 Task 2 和 Task 3
- **Task 5** 最后执行

---

## 技术要点

### 1. AI 输出格式（新）
```json
{
  "weeklyTheme": {
    "oneLiner": "一句话总结（50 字以内）",
    "detailed": "详细解读（200 字左右）"
  },
  "highlights": ["热点 1", "热点 2", "热点 3"],
  "topProjects": [
    {
      "repo": "owner/repo",
      "category": "技术创新",
      "reason": "入选理由",
      "value": "核心价值",
      "useCases": ["场景 1", "场景 2"]
    }
  ],
  "trends": {
    "shortTerm": ["短期趋势 1", "短期趋势 2"]
  },
  "emergingFields": [
    {
      "field": "领域名称",
      "description": "领域描述",
      "projects": ["项目 1", "项目 2"]
    }
  ],
  "recommendations": {
    "developers": ["建议 1", "建议 2"],
    "enterprises": ["建议 1", "建议 2"]
  }
}
```

### 2. 项目分组逻辑
```javascript
// 按 analysis.type 分组
const groups = {
  agent: [],      // Agent 系统
  speech: [],     // 语音处理
  general: [],    // 通用工具
  other: []       // 其他
};

projects.forEach(project => {
  const type = project.analysis?.type || 'other';
  if (!groups[type]) groups[type] = [];
  groups[type].push(project);
});
```

### 3. 统计数据计算
```javascript
const stats = {
  totalProjects: projects.length,
  aiProjects: projects.filter(p => p.isAI).length,
  aiPercentage: Math.round(projects.filter(p => p.isAI).length / projects.length * 100),
  avgStars: Math.round(projects.reduce((sum, p) => sum + p.stars, 0) / projects.length),
  langDistribution: { TypeScript: 5, Python: 4, ... },
  typeDistribution: { 'Agent 系统': 6, '通用工具': 3, ... }
};
```

---

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
