# 日报模板（design-v2）
- `daily.mustache`：Mustache 语法（无逻辑）。`{{x}}` 转义输出；`{{{css}}}` 不转义，生成器把 `site.css` 全文内联进去（PLAN r4 C 环要求 CSS 内联）；`{{#list}}…{{/list}}` 循环/条件；`{{^x}}` 取反；`{{.}}` 字符串数组当前项。
- `site.css`：唯一样式表，无外部依赖、无 JS。
- 参考实现：`../sample/build_sample.py`（Python + chevron）把真实数据组装成 view-model，`../sample/viewmodel-2026-10-21.json` 是完整示例，生成器照这个结构填即可。Node 端可用 mustache.js，语法相同。

## 占位 → 字段（brief＝data/briefs/daily/data-{date}.json，ins＝data/insights/daily/insights-{date}.json，facts＝data/facts/facts-daily-{date}.json）
| 占位 | 字段 / 算法 |
|---|---|
| css | template/site.css 全文 |
| date / dateShort | brief.date / 其 MM-DD |
| scrapedAtLocal / generatedAtLocal | brief.scrapedAt / brief.generatedAt 转 UTC+8，MM-DD HH:mm |
| week.label / week.href | 由 date 算 ISO 周（2026-W43）/ 周报路径 |
| nav.* / archive[] {label,href,cls,cur} | reports/ 目录文件名；cls=sub 为日报子项，cur=当前页 |
| verdict.oneLiner | ins.oneLiner |
| verdict.hypeScore / hypeDots / hypeReason | ins.hypeIndex.score / score 个●+(5-score) 个○ / ins.hypeIndex.reason |
| cmp.prevDateShort / prevDateLabel | brief.dailyDiff.prevDate（上期快照日，不一定是昨天） |
| cmp.lastMonthDateShort | 上月同期 facts 的来源日期（f34 source 中的日期） |
| cmp.rows[] {label,now,refs[1]} | 见 FIELD_MAP 第 2 节逐行；refs 仅保留上期 |
| refs[].value / dirText / dirCls | facts 参照值 / facts 方向值（上升/下降/持平）/ up·down·flat；没有参照值时给 `{missing:true}`，页面显示「—」 |
| cmp.caption | 生成端写的读者口径说明（不得含字段名） |
| stats[] {label,value,prev,dirText} | brief.stats.totalProjects/aiProjects/avgStars + facts f4；prev 与方向取 facts 昨日项 |
| trends[] | ins.coreTrends |
| streak[] {fullName,anchor,days,todayStars,text}，streakCount | ins.streakBrief[i]；days=brief.streakDays[fullName]；todayStars=projects[].todayStars；按 days 降序 |
| churn.nums / newCount / returnedCount / keptCount / droppedCount | brief.dailyDiff.counts + facts f52 留存率、f53 新面孔率 |
| churn.text | ins.churn |
| churn.new / kept / dropped [] {fullName,anchor} | brief.dailyDiff.new / kept / dropped（掉榜无锚点，不链接） |
| deep.text | ins.deepAnalysis |
| deep.actions[] / deep.hasActions | ins.action 取前 3 条（最多 3）/ 有建议时为真，否则整段「建议」不渲染 |
| total | brief.stats.totalProjects |
| projects[] | brief.projects[]（按 todayStars 降序）：rank、fullName、url、tag、tagNew（tag 为 新/回归 时真）、oneSentence（ins.project_insights[].oneSentence，缺省回落 analysis.oneSentence）、descZh、typeName（analysis.typeName）、language、community（analysis.community.level）、todayStars/starsFmt/forksFmt（千分位）、streakText（streakDays+" 天"）、anchor（"p-"+fullName 小写非字母数字转 -） |
| related[] {href,title,sub} | 上期日报（dailyDiff.prevDate + 其 stats.totalProjects）、上周周报、上月月报、Wiki；均来自 reports/ 与 wiki 目录 |
| footer | 固定文案 + total + scrapedAtLocal |

注意：方向词（上升/下降/持平、▲▼＝）只由 facts 方向值给出，模板不写死，与 r4 A 环一致。
- `isFail`：为真时在页首渲染 FAIL 横条（`.FAIL.html` 使用），其余内容与正常页一致。
- `isSample`：仅 `generate-sample.js` 置真时渲染「AI 文案仅验证版式」提示；正式生成路径不设置该标志。
- 深度分析建议最多 3 条：`deep.actions = ins.action.slice(0, 3)`，其余不显示。
