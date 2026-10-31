# 月报 2026-09：页可见内容 vs 内容检查器

对照日：2026-10-31。基线 `main` `ee5cd4091a56be9b240f11a3093f5660a6e84bbc`。

## 对照了哪两份东西

- 页：旁路 HTML `github-monthly-2026-09.FAIL.html`（本机上传副本 34181 字节，与派单记录的约 34181 字节一致）。去标签后 265 行可见文本。页脚写明 `r11c`，并写明黑马、预测、Wiki 域墙已砍。
- 检查器：`node scripts/check-report.js monthly 2026-09 --data-dir data`。有 `data/render/render_map-monthly-2026-09.json` 与事实表，因此走 r3。渲染记录 `generatedAt` 为 `2026-10-23T09:47:57.597Z`。
- 历史闸证：`check-monthly-2026-09.md`，`generatedAt` `2026-10-23T09:13:00.609Z`，FAIL 13（B3×3 + B4×4 + B10×3 + B6×3）。那次原句还是带 `{{f…:days_on_list}}` 的占位稿。当天较晚的渲染记录和现在这份 FAIL 页，已经是另一稿正文（标题为「2026 年 9 月，208 个项目登上日榜…」）。

页上实际印出的洞察只有两段：`monthlyTheme.oneLiner`（h1 与导语）和 `monthlyTheme.detailed`（「1. 月度主线」）。依据是 `src/generator/monthly-v3-view-model.js` 的 `buildInsights`：`trendEvolution` 按 `early/mid/late` 取字段，当前数据是数组，取不到；`longTermValue` 只在有 `reasons`/`reason`/`summary` 时追加，当前卡片没有这些键；`nextMonthForecast` 与 `description` 不进该视图。去标签文本里也没有「646」「天上榜周期」「9 月最大黑马」「展望 10 月」。

## 修之前，当前洞察文件上的 FAIL

`checkReport` 对同一字段、同一引文只留第一条（`dedupeFindings` 的键不含说明文字）。直接调用 `r4-binding.check` 时，一条引文里还另有数字。

| 规则 | 字段 | 检查器引文里的数字 | 页上有没有这段字 | 类别 |
|---|---|---|---|---|
| B4 | `monthlyTheme.oneLiner` | 2026；另有 9；另有从「147 个」切出来的 14 | 有。h1 与导语 | 检查器。年份月份应算日期；14 是白名单切错 |
| B4 | `monthlyTheme.detailed` | 2026（同字段还会切出 9 与 14，被去重挡住） | 有。「1. 月度主线」 | 同上 |
| B4 | `longTermValue[0].oneSentence` | 9（「9 月最大黑马」） | 无 | 不是读者 FAIL。月份白名单顺带消掉 |
| B4 | `longTermValue[0].description` | 646 | 无。GitHub about，页不渲染 | 数据。不能靠放宽规则吞掉 |
| B4 | `nextMonthForecast` | 10（「10 月」） | 无。r11c 已砍预测 | 不是读者 FAIL。月份白名单顺带消掉 |
| B6 | 整句 `mattpocock/skills` | 行 108，`emergingFields[].projects[]` | 名字出现在 Top 表和主线句子里，但不是单独一句 | 检查器范围。仓库名跨月相同是事实 |
| B6 | 整句 `addyosmani/agent-skills` | 行 110 | 无 | 同上 |
| B6 | 整句 `TauricResearch/TradingAgents` | 行 149 | 无 | 同上 |

历史 13 条里的 B3×3、B10×3（`days_on_list` 对不上「天上榜 / 天的上榜 / 上榜周期」）在当前 `src/facts/roles.js` 上已对得上。用那三句占位稿调用 `findSlotAssignments`：`days_on_list`、`month_stars`、`stars` 都落在允许的槽里。当前洞察文件再跑检查器，B3/B10/C3 条数为 0。页正文也没有「全面爆发」。C3 那条历史样本不再出现。

## 夹具影响（改规则之前）

r3 夹具正文不在本机（`/home/box/shared/report-redesign` 不存在）。扫了仓库里的 `qa/cases_snapshot_r10c/*.jsonl` 引文，以及 `fixtures_r5`、`fixtures_r9`、`fixtures_r10`。

| 用例 | 期望 | 引文里的数字 | 新白名单会不会把它放掉 |
|---|---|---|---|
| R3-B4-F01 | FAIL | 20 万 | 否 |
| R3-B4-F02 | FAIL | 20 万 | 否 |
| R3-B4-F03 | FAIL | 残留 `{{f999}}` | 否。这条不是数字白名单 |
| R3-B4-P01 | PASS | 229268、321942，且有渲染记录 | 否。白名单不碰它们 |
| R3-B4-P02 | PASS | 日期、期号、第 N、Top 10 | 否。更长的日期式样仍先匹配，「9月18日」不会剩一个 18 |
| R3-B6-F01 | FAIL | 无。整句是「插件生态进入实质竞争阶段…」，字段 `weeklyTheme.oneLiner` | 否。`projects` / `keyProjects` 排除碰不到这句 |

`cases.jsonl` 里 C3-F23 的引文是「10 月将有三个确定性走向」，规则是 C3，不是 B4。月份白名单不改变它。

`(?<!\d)` 只修「147 个 / 167 个」被切成 14 / 16。`掉榜 7 个`、`前 7 个`、`7 日` 仍然不要求渲染记录，和改前一样。`3 个月` 里的 3 仍然要渲染记录（`月` 后面是 `个` 时不放行）。

## 改了什么

- `src/checker/rules/r4-binding.js`：`7` 前不能再有数字；在完整日期式样之后放行 `YYYY 年` 和 `M 月`（`月` 后不是 `个`）。
- `src/checker/document.js`：`projects`、`keyProjects` 数组里的仓库名不再当成 B6 句子。散文整句照旧。
- `src/analyzer/monthly-analyzer.js`：不再用 GitHub about 覆盖 `longTermValue[].description`。
- `data/insights/monthly/insights-2026-09.json`：删掉 VoiceStudio 那条含 646 的 about。页本来就不渲染它。
- `README.md`：白名单说明与上述两条对齐。

## 修之后

同一条 `checkReport`：洞察文件 FAIL 为 0。抽数核对：`2026 年 9 月…147 个…414263` 只剩 `208`、`147`、`414263`；`10 月` / `9 月` 被盖住；`3 个月` 仍抽出 3；`147 个` 与 `167 个` 保持整段数字。

brief 仍 FAIL，且都不在 FAIL 页正文里：

| 规则 | 条数 | 位置 | 类别 |
|---|---|---|---|
| B8 | 3 | `data/briefs/monthly/data-month-2026-09.json` 的 `stats` 为 0 | 需拍板。页面上的 208 / 147 来自 `monthly-metrics`，生成时 `enrichMonthlyBrief` 会改写 stats。本环不手改这份 0，避免和未 enrich 的 brief 形状打架 |
| C1 | 1339 | `aggregation.recurringProjects[].analysis` 的固定句 | 需拍板。不是页可见正文。不改 C1 扫描范围，也不改写这批百科模板句 |
| C3 | 111 | 同上，禁词打在模板句上 | 同上 |

这些不是读者 FAIL。把它们硬放行会改 C1/C3 的夹具语义，本环不做。

## qa

`bash qa/run_all.sh` 退出码 1。脚本第一句就停了：`未找到用例文件：/home/box/shared/report-redesign/refactor/cases/*.jsonl`。本机没有这份夹具树，也没有 `node_modules/eslint`。假绿=否。洞察文件那次 `checkReport` 是单独复跑，不是这套加载闸。

## 明确没做

- 没有重生、没有灌站、没有推 WeLink / 飞书。
- 没有把 FAIL 页改回正式文件名。
- 没有改导航上「审阅中 / 2026-09（下架）」。
