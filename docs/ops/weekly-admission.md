# 周报准入：调度、备份、回滚

本文只描述报告仓 `daily_report_analysis` 的入口变化。不修改 Hermes 的 gateway、服务或任务，也不新增第二套采集。

## 已核实的现网关系

依据 2026-11-08 SGT 的只读溯源，以及本仓代码：

- 报告站代码当时为 `main@ea72c07e7aaace30e7c8c4ac7d7956ee90b0f61e`，目录 `/srv/www/daily-report`。
- 周榜 raw 在另一仓 `trending_analysis_report`（当时 `main@7ef5c1d52eb6dbdf9bfdee96d379066405e55533`），目录 `/srv/www/github-trending-wiki`。周文件是 `raw/trending-weekly/{周一 YYYY-MM-DD}.json`。加载逻辑见 `src/loader/wiki-trending-raw-loader.js`。
- Hermes 任务 `weekly-report`（`7f1b52184350`）周日 12:00 执行 `python3 scripts/github_weekly_collector.py`。2026-11-01 的日志和 mtime 显示 12:00:48 写出 `raw/trending-weekly/2026-10-26.json`。2026-11-08 10:00 时，目标 `raw/trending-weekly/2026-11-02.json` 尚未就绪。
- root cron 也在周日 12:00 执行 `node scripts/run-weekly-workflow.js`。两边没有顺序依赖。
- 旧入口在抓取后直接跑正式流水线。`--no-push` 只关通知，仍会写 HTML 和首页。见改前的 `scripts/run-weekly-workflow.js` 与 `src/scraper/report-pipeline.js`。

因此不能靠「只改时刻」或假定已经串行。10:00 的数据缺失是采集尚未运行，不是内容核查失败。

## 报告端现在做什么

`node scripts/run-weekly-workflow.js` 是唯一正式发布入口。`CompleteWorkflow.triggerManual('weekly')` 和周报 `executePipeline` 在没有隔离预检标记时直接拒绝，避免再走旧的「先写页再核查」。

1. 解析周期。`--week-start` 必须是周一。不传时用运行日所在周的周一（2026-11-08 → 2026-11-02）。主机时区需为 Asia/Singapore，或显式传 `--week-start` / `--as-of`。
2. 有限等待 raw。默认 `WEEKLY_RAW_WAIT_MS=180000`、`WEEKLY_RAW_POLL_MS=5000`、`WEEKLY_RAW_SETTLE_MS=2000`。文件要存在、非空、可解析、`projects` 非空，且 `week_start` / `date` / `week_end` 与该周一吻合。等待结束仍不齐则退出码 2，不预检、不写页、不推送。
3. 隔离预检。把当前正式 `data/` 复制到临时目录后跑一次流水线，强制关闭 HTML、首页、通知和 Wiki。ContentGate 在这次里运行，AI 只发生在这次。
4. 预检通过后重新读取 raw。哈希变了则退出码 5，不发布。
5. 把通过的内容写入 `data/.admission/weekly-{ISO周}.json`，再提交正式 HTML `reports/weekly/github-weekly-{ISO周}.html`。正式名已存在则不再覆盖、不再预检。`*.FAIL.html` 不是正式名，失败路径也不会写成正式名。
6. 发布失败但收据还在、raw 哈希未变时，重跑复用收据，不再做第二次预检或 AI。

退出码：0 已发布或正式页已在；2 raw 未就绪；3 内容核查失败；4 已有运行；5 预检后输入变了；1 其他。

## 建议的调度切换

不要改 Hermes `weekly-report`，继续让它在周日 12:00 写 raw。

把 root cron 从「周日 12:00 直接跑旧工作流」改成「Hermes 采集时刻之后再跑新入口」。按已提供的溯源，采集是周日 12:00 SGT，报告可放在周日 12:10 SGT，让默认 3 分钟有限等待只覆盖剩余竞态。下面是示例，不是从服务器抄来的现有 crontab；`node`、工作目录和日志路径要沿用该机原来的写法：

```cron
10 12 * * 0 cd /srv/www/daily-report && WIKI_TRENDING_BASE=/srv/www/github-trending-wiki node scripts/run-weekly-workflow.js
```

若这台机器的 cron 不是 Asia/Singapore，不要照搬 12:10，改成该时区里「采集启动之后约 10 分钟」。

不要把等待加到 2 小时去迁就 10:00。数据没到就是未就绪。

`contentgate-2` 周日 10:00 的旧 Bot 例行仍会在 raw 齐时以 `--no-push` 跑正式工作流。本变更不改 Bot。新入口验证前，那条例行仍可能抢先写页；验证后由操作者停用或改成只读监督。

## 上线前备份

在报告机、切换 cron 之前，把下面这些目录复制到报告机已有的备份位置。路径来自本次溯源里的 `/srv/www/daily-report`；备份目录本身没有在这次只读溯源里给出，不要新建一套未约定的系统目录，沿用该机原来的备份位置：

```bash
# 在报告机上，于切换 cron 之前执行。备份目标换成该机已有位置。
cp -a /srv/www/daily-report/reports/weekly "$backup/reports-weekly"
cp -a /srv/www/daily-report/reports/index.html "$backup/index.html"
cp -a /srv/www/daily-report/data/briefs/weekly "$backup/briefs-weekly"
cp -a /srv/www/daily-report/data/insights/weekly "$backup/insights-weekly"
cp -a /srv/www/daily-report/data/facts "$backup/facts"
cp -a /srv/www/daily-report/data/render "$backup/render"
cp -a /srv/www/daily-report/wiki "$backup/wiki"
```

记录当前发布的 git SHA，以及 cron 里原来的那一行。

## 回滚

1. 把 root cron 改回切换前的命令（或先删掉新行，避免新旧一起跑）。
2. 代码退回切换前的 SHA。退回后旧入口又会直接跑正式流水线，所以回滚代码时不要同时留着会自动触发的 cron。
3. 若新入口已经写出本周正式 HTML，而该页不该保留：停 cron 后，只用备份覆盖对应的 `reports/weekly/github-weekly-{周}.html`、`reports/index.html` 和该周 `data/briefs|insights|facts|render`。不要用删除整个 `reports/weekly` 的方式回滚。
4. `data/.admission/weekly-{周}.json` 只是收据。回滚已发布页面时把它一并移走，避免下一次误复用。
5. 不回滚 Hermes，也不改 Bot 例行。那部分仍按操作者原计划处理。

## 尚未在本仓闭环的边界

- 本仓不能让 Hermes 先写完 raw，也不能看见采集进程。raw 晚于有限等待就会退出码 2。
- 隔离预检里的那一次流水线仍会调用现有 AI 与 GitHub 增强。通过后的发布不再调用。预检失败不会写正式页。
- 正式页一旦提交，再次执行不会改页，也不会补发已经错过的通知。通知失败返回 `NOTIFY_FAILED`，页面可能已经在盘上。
- 首页生成失败不会撤回已写出的正式 HTML。需要在同一 `REPORT_OUT_DIR` 下另行执行 `node scripts/generate-index.js`。
- Wiki 只有在未设置 `REPORT_NO_WIKI=1` 且正式 HTML 已经提交后，才用已通过的内容更新。预检阶段不写 Wiki。Wiki 更新失败不会撤回正式页；因为正式页已在，再次执行不会改页，也不会自动重试 Wiki。
- 进程内调度器的周报回调不再发布页面。周报发布只走这个脚本。
- 已发布正式页不会被自动覆盖。要重做某一周，必须先停调度，人工移开该周正式 HTML 和收据，再显式重跑。本说明不授权这样做。
