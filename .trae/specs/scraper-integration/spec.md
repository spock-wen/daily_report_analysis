# GitHub Trending 抓取与报告生成一体化 Spec

## Why

当前项目依赖前置项目 [daily_report](https://github.com/spock-wen/daily_report) 通过 GitHub Actions 定时抓取数据并推送到服务器，存在以下问题：
- 依赖 GitHub Actions，配置复杂
- 数据推送流程增加运维成本
- 无法灵活控制抓取和分析时间

本方案将抓取功能整合到当前项目，实现一站式报告生成。

## What Changes

- ✅ 新增 `src/scraper/` 模块，直接从 GitHub 抓取 Trending 数据
- ✅ 实现智能重试机制（5 分钟间隔，最多 12 次）
- ✅ 使用 node-cron 定时任务替代 GitHub Actions
- ✅ 抓取完成后自动触发 AI 分析和报告生成
- ✅ 失败时发送通知，成功时不通知（静默运行）
- ✅ 调整抓取时间：日报 8:00、周报周一 8:30、月报每月 1 日 9:00

## Impact

- **Affected specs**: 
  - [simplify-architecture](../simplify-architecture/spec.md) - 架构进一步简化
  - [weekly-report](../weekly-report/spec.md) - 报告生成流程扩展
  
- **Affected code**:
  - 新增 `src/scraper/` 目录
  - 修改 `scripts/` 目录下的脚本
  - 修改 `package.json` 添加新依赖
  - 修改 `.env.example` 添加新配置

## ADDED Requirements

### Requirement: 抓取模块
系统 SHALL 提供以下抓取功能：
- 直接从 https://github.com/trending 抓取数据
- 支持日报、周报、月报三种类型
- 解析 HTML 并提取项目信息（repo、name、desc、stars、language 等）

#### Scenario: 抓取日报
- **WHEN** 定时任务在每天 8:00 触发
- **THEN** 系统尝试从 GitHub 抓取日榜数据

### Requirement: 智能重试机制
系统 SHALL 提供智能重试功能：
- 抓取失败时自动重试
- 重试间隔：5 分钟
- 最大重试次数：12 次（总计 1 小时）
- 每次重试记录日志

#### Scenario: 重试成功
- **WHEN** 第 1 次抓取失败
- **THEN** 等待 5 分钟后重试第 2 次
- **WHEN** 第 2 次抓取成功
- **THEN** 继续执行后续流程

#### Scenario: 重试失败
- **WHEN** 连续 12 次抓取都失败
- **THEN** 放弃本次报告生成
- **AND** 发送失败通知

### Requirement: 定时任务调度
系统 SHALL 提供以下定时任务：
- 日报：每天 8:00 开始抓取
- 周报：每周一 8:30 开始抓取
- 月报：每月 1 日 9:00 开始抓取

#### Scenario: 定时任务触发
- **WHEN** 系统启动
- **THEN** 所有定时任务自动注册并等待触发时间

### Requirement: 自动报告生成（一体化流程）
系统 SHALL 在抓取成功后**立即**自动执行以下完整流程：
1. 保存原始数据到 `data/briefs/{type}/data-{date}.json`
2. 调用 AI 分析模块生成洞察，保存到 `data/insights/{type}/insights-{date}.json`
3. 生成 HTML 报告，保存到 `reports/{type}/report-{date}.html`
4. 更新首页 `reports/index.html`
5. 发送推送通知（飞书/WeLink），包含报告链接

#### Scenario: 抓取成功
- **WHEN** 抓取成功获取到数据
- **THEN** **立即**自动触发完整报告生成流程（抓取 → AI 分析 → HTML 报告 → 推送）
- **AND** 最终生成 HTML 报告并发送推送通知
- **AND** 整个流程在后台一次性完成，无需手动干预

### Requirement: 推送通知
系统 SHALL 提供以下推送通知功能：

**成功通知**（可选）：
- 通知渠道：飞书/WeLink（根据配置）
- 通知内容：报告类型、生成时间、报告链接、关键数据摘要
- 在 HTML 报告生成完成后立即发送

**失败通知**（必需）：
- 通知渠道：飞书/WeLink（根据配置）
- 通知内容：失败类型、错误信息、重试次数、建议操作
- 仅在全部重试失败后发送

#### Scenario: 抓取成功
- **WHEN** 完整报告生成流程完成（HTML 报告已生成）
- **THEN** 立即发送成功通知，包含报告链接

#### Scenario: 抓取失败
- **WHEN** 12 次重试后仍然失败
- **THEN** 发送失败通知到配置的通知渠道

## MODIFIED Requirements

### Requirement: 报告生成流程
**原有**: 从 `data/briefs/` 读取数据后生成报告

**修改后**: 
- 增加数据抓取环节
- 支持手动指定日期生成（现有功能保留）
- 支持定时任务自动触发

## REMOVED Requirements

### Requirement: 依赖前置项目推送数据
**Reason**: 抓取功能已整合到当前项目，不再需要独立的前置项目推送数据

**Migration**: 
- 保留 `data/briefs/` 目录结构，保持向后兼容
- 手动生成报告的脚本仍然可用
- 历史数据不受影响

## Technical Decisions

### 1. 直接访问 GitHub
- 不使用镜像源或代理服务
- 通过重试机制应对网络不稳定
- 简单直接，减少依赖

### 2. 重试策略
- 固定间隔 5 分钟
- 最大 12 次重试
- 指数退避过于复杂，不必要

### 3. node-cron
- 轻量级定时任务库
- 支持 cron 表达式
- 社区成熟，维护活跃

### 4. HTML 解析
- 使用 cheerio 库解析 GitHub HTML
- 不依赖 Puppeteer 等重型工具
- 保持依赖精简

## Configuration

### 新增环境变量

```bash
# 抓取功能开关
SCRAPER_ENABLED=true

# 重试配置
MAX_RETRY_ATTEMPTS=12
RETRY_INTERVAL_MINUTES=5

# 定时任务配置
SCHEDULER_ENABLED=true

# 通知配置
NOTIFY_ON_FAILURE=true
```

## Success Criteria

1. ✅ 定时任务能按时触发抓取
2. ✅ 抓取成功后**立即**自动生成完整报告（JSON → AI 分析 → HTML → 推送）
3. ✅ 重试机制正常工作
4. ✅ 成功时发送推送通知（包含报告链接）
5. ✅ 失败时发送失败通知
6. ✅ 日志记录完整
7. ✅ 手动生成报告功能仍然可用
8. ✅ 整个流程一体化，无需手动干预
