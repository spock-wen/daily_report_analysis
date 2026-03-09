---
name: "executing-plans"
description: "Executes and tracks implementation of plans. Invoke when a plan has been approved and needs to be implemented, or when user is ready to start executing tasks from a spec."
---

# Executing Plans 技能

## 功能说明

这个技能用于执行和跟踪已批准的计划实施，确保任务按照 spec 文档中的定义完成。

## 使用场景

当以下情况发生时 invoke 此技能：
1. 用户确认批准了 spec 计划
2. 需要开始实施 tasks.md 中定义的任务
3. 需要跟踪执行进度
4. 需要验证任务完成情况

## 执行流程

### 1. 加载 Spec 文档
- 读取 `spec.md` 了解整体目标
- 读取 `tasks.md` 获取任务列表
- 读取 `checklist.md` 获取验收标准

### 2. 创建 Todo 列表
- 将 tasks.md 中的任务转换为 TodoWrite 列表
- 标记第一个任务为 in_progress
- 其他任务标记为 pending

### 3. 任务执行
- 按顺序执行任务（除非任务间无依赖）
- 每个任务完成后：
  - 标记为 completed
  - 更新 tasks.md 中的复选框
  - 开始下一个任务

### 4. 并行执行
对于无依赖的任务，可以：
- 同时启动多个子代理执行
- 最大化执行效率

### 5. 质量检查
- 每个任务完成后进行自检
- 确保代码符合规范
- 运行测试验证功能

### 6. 验收验证
- 所有任务完成后，对照 checklist.md 逐项验证
- 记录验证结果
- 更新 checklist 中的复选框

## 执行原则

### 专注执行
- 严格按照 spec 和 tasks 执行
- 不随意添加或修改需求
- 如有必要调整，先与用户确认

### 质量保证
- 遵循项目代码规范
- 保持代码风格一致
- 确保功能完整可用

### 进度透明
- 及时更新任务状态
- 让用户清楚当前进度
- 遇到问题及时沟通

### 高效协作
- 合理使用子代理
- 并行处理独立任务
- 优化执行效率

## 与 Spec 模式的配合

```
Spec 模式 → 创建 spec.md, tasks.md, checklist.md
          ↓
用户批准计划
          ↓
Executing Plans → 实施任务 → 验证完成
```

## 输出要求

执行完成后应提供：
1. **完成报告**：所有任务的完成情况
2. **验证结果**：checklist 中各项的验证状态
3. **交付物清单**：生成的文件和功能
4. **后续建议**：可选的优化建议

## 注意事项

- 只在用户批准计划后执行
- 严格执行 spec 定义的范围
- 保持与用户的沟通
- 确保每个任务都经过验证
- 完成所有检查项后才交付
