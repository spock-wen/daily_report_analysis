# HuggingFace Papers HTML 报告优化设计

**创建日期**: 2026-04-04  
**状态**: 待审阅

---

## 1. 概述

### 1.1 优化目标

优化 HuggingFace AI Papers 日报 HTML 报告的信息结构和内容呈现，移除无用模块，增强详情面板的信息密度。

### 1.2 问题背景

当前 HTML 报告存在以下问题：
1. **语言分布无意义** - 论文关注的是研究领域，不是编程语言
2. **详情面板重复** - 展开后内容与列表完全一致，无增量信息
3. **摘要翻译截断** - 450 字符限制导致长摘要显示不完整
4. **缺少论文类型标签** - 无法快速识别综述/工具/研究
5. **排序逻辑单一** - 0 Star 论文无法区分优先级

---

## 2. 设计方案

### 2.1 信息架构调整

```
移除前:
┌─────────────────────────────────────┐
│ [统计卡片区]                         │
├─────────────────────────────────────┤
│ [语言分布] ← 移除                    │
├─────────────────────────────────────┤
│ [AI 深度洞察]                         │
├─────────────────────────────────────┤
│ [论文列表]                           │
└─────────────────────────────────────┘

移除后:
┌─────────────────────────────────────┐
│ [统计卡片区]                         │
├─────────────────────────────────────┤
│ [AI 深度洞察]                         │
├─────────────────────────────────────┤
│ [论文列表] + [类型标签] + [快速操作] │
└─────────────────────────────────────┘
```

### 2.2 详情面板内容设计

**当前问题**: 详情面板只是列表内容的重复

**优化后详情面板包含**:

| 信息类型 | 列表卡片 | 详情面板 |
|---------|---------|---------|
| 标题 | ✅ 显示 | ✅ 显示 |
| Stars | ✅ 显示 | ✅ 显示 |
| 论文类型标签 | ✅ 显示 | ✅ 显示 |
| 作者 | ✅ 显示 | ✅ 显示 |
| 链接 | ✅ 快速链接 | ✅ 完整链接集合 |
| 摘要 | 一句话 (~100 字) | **完整翻译 + 英文原文** |
| 快速操作 | ❌ | ✅ `[arXiv] [PDF] [GitHub] [引用]` |
| BibTeX 引用 | ❌ | ✅ 完整引用格式 |

---

## 3. 模块设计

### 3.1 论文类型判断（规则引擎）

**判断逻辑**:

```javascript
function classifyPaper(paper) {
  const abstract = paper.details.abstract.toLowerCase();
  const title = paper.title.toLowerCase();
  const hasGithub = paper.details.github_links?.length > 0;
  
  // 1. 综述类
  const surveyKeywords = [
    'survey', 'review', 'overview', 'comprehensive', 
    'taxonomy', 'state-of-the-art', 'advances', 'progress',
    'systematic', 'retrospective'
  ];
  
  if (surveyKeywords.some(kw => abstract.includes(kw) || title.includes(kw))) {
    return '综述';
  }
  
  // 2. 工具/系统类
  if (hasGithub && (abstract.includes('implement') || abstract.includes('system') || 
                    abstract.includes('framework') || abstract.includes('tool') ||
                    abstract.includes('library') || abstract.includes('package'))) {
    return '工具';
  }
  
  // 3. 数据集类
  if (abstract.includes('dataset') || abstract.includes('benchmark')) {
    return '数据';
  }
  
  // 4. 默认：研究论文
  return '研究';
}
```

**标签样式**:
```css
.paper-type { 
  background: var(--accent-orange); 
  color: var(--bg-primary); 
  padding: 2px 8px; 
  border-radius: 4px; 
  font-size: 0.6875rem; 
  font-weight: 600;
}
```

---

### 3.2 摘要处理

**列表卡片** - 一句话摘要:
- 截取前 100-120 字符
- 末尾加 `...`

**详情面板** - 完整摘要:
- 完整中文翻译（分段翻译，无字符限制）
- 英文原文摘要（方便专业读者查证）

---

### 3.3 BibTeX 引用生成

**格式**:
```bibtex
@article{author_lastname_year,
  title = {论文标题},
  author = {作者 1 and 作者 2 and ...},
  journal = {arXiv preprint},
  volume = {arXiv:xxxx.xxxxx},
  year = {2026}
}
```

**生成逻辑**:
```javascript
function generateBibTeX(paper) {
  const arxivId = paper.paper_url.split('/').pop();
  const year = arxivId.startsWith('26') ? '2026' : '20' + arxivId.substring(0, 2);
  const firstAuthor = paper.authors?.[0]?.split(' ').pop() || 'unknown';
  
  return `@article{${firstAuthor.toLowerCase()}${year.replace('20', '')},
  title = {${paper.title}},
  author = {${paper.authors?.join(' and ') || 'Unknown'}},
  journal = {arXiv preprint},
  volume = {arXiv:${arxivId}},
  year = {${year}}
}`;
}
```

---

### 3.4 快速操作按钮组

**HTML 结构**:
```html
<div class="quick-actions">
  <a href="${arxivUrl}" target="_blank" class="action-btn">arXiv</a>
  <a href="${pdfUrl}" target="_blank" class="action-btn">PDF</a>
  ${githubLinks.length > 0 ? `<a href="${githubLinks[0]}" target="_blank" class="action-btn">GitHub</a>` : ''}
  <button onclick="copyBibtex()" class="action-btn">引用</button>
</div>
```

**样式**:
```css
.quick-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.action-btn {
  background: var(--accent);
  color: var(--bg-primary);
  padding: 4px 12px;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
}

.action-btn:hover {
  opacity: 0.9;
}
```

---

### 3.5 排序逻辑优化

**当前逻辑**:
```javascript
// 仅按 Stars 降序，0 Star 在后
papers.sort((a, b) => {
  if (a.stars === 0 && b.stars === 0) return 0;
  if (a.stars === 0) return 1;
  if (b.stars === 0) return -1;
  return b.stars - a.stars;
});
```

**优化后逻辑**:
```javascript
// Stars 优先，同 Star 数时有 GitHub 仓库的在前
papers.sort((a, b) => {
  const starsA = a.stars || 0;
  const starsB = b.stars || 0;
  const hasGithubA = a.details?.github_links?.length > 0;
  const hasGithubB = b.details?.github_links?.length > 0;
  
  // 优先按 Stars 排序
  if (starsA !== starsB) {
    return starsB - starsA;
  }
  
  // Stars 相同，有 GitHub 仓库的优先
  if (hasGithubA && !hasGithubB) return -1;
  if (!hasGithubA && hasGithubB) return 1;
  
  return 0;
});
```

---

### 3.6 响应式优化

**新增断点**:
```css
@media (max-width: 640px) {
  .stats-grid { 
    grid-template-columns: 1fr; /* 统计卡片单列 */
  }
  
  .paper-details.active { 
    grid-template-columns: 1fr; /* 详情面板单列 */
  }
  
  .paper-header { 
    flex-direction: column; /* 标题和 Stars 堆叠 */
  }
  
  .quick-actions { 
    flex-wrap: wrap; /* 按钮换行 */
  }
}
```

---

## 4. 变更文件清单

| 文件 | 变更内容 |
|------|---------|
| `src/generator/paper-html-generator.js` | 1. 移除 `renderLanguageDistribution` 方法 2. 新增 `classifyPaper` 方法 3. 新增 `generateBibTeX` 方法 4. 修改 `renderPaperCard` 增加类型标签和快速操作 5. 修改 `renderHTML` 详情面板内容 6. 优化排序逻辑 |
| `reports/papers/daily/*.html` | 输出格式变更 |

---

## 5. 成功标准

- [ ] 无"语言分布"模块
- [ ] 每篇论文有类型标签（综述/工具/研究/数据）
- [ ] 列表卡片显示一句话摘要（~100 字）
- [ ] 详情面板包含完整翻译（无截断）
- [ ] 详情面板包含英文原文摘要
- [ ] 详情面板包含 BibTeX 引用格式
- [ ] 详情面板顶部有快速操作按钮组
- [ ] 移动端（<640px）布局正常
- [ ] 排序逻辑：Stars 降序，同 Star 数有 GitHub 优先

---

## 6. 设计检查清单

- [x] 语言分布模块移除
- [x] 论文类型判断逻辑定义
- [x] 详情面板内容设计
- [x] BibTeX 引用格式定义
- [x] 快速操作按钮组设计
- [x] 排序逻辑优化
- [x] 响应式布局设计

---

**下一步**: 用户审阅设计文档，确认后进入 implementation plan 阶段。
