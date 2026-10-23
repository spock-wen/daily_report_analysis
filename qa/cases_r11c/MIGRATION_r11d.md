# MIGRATION r11d（R11C 四周柱零值守卫 + 首页 kind）

时间：2026-10-23 Asia/Singapore

## R11C
- 新增：月报在「四周主题非空」且脚注四柱合计为 0 → FAIL（`monthly.weekBars.zeroWithThemes`）。
- `fixtures/monthly_pass.html`：补 weekbar 主题文案 + 非零脚注（合计约 306.7k）。
- 新增 `fixtures/monthly_zerobars_fail.html`：主题非空 + `W37 0 · … · 合计约 0`（R11C-M-F02）。
- 保留原 `monthly_fail.html`（缺 SVG / chart.js / bars-row）作结构门 FAIL。
- `run_r11c.js` 增加 R11C-M-F02。

## 首页 kind
- 新目录 `qa/cases_home_kind/`：对 `homePeriodKind` 相对日历断言（本周/上周、本月/上月 + 硬编码回归哨）。
- 挂入 `qa/run_all.sh` ⑦。

未放宽 B3/B4/B6/B10/C3；未撕 FAIL 红条；未灌站。
