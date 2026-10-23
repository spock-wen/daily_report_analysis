# MIGRATION r10c：夹具迁移（2026-10-22 23:20–23:45 UTC+8）
没有改业务代码 src/，没有碰 65，没有跑 run_all.sh。核对用 /workspace/r10c_mig/hits.js、pass_find.js 逐条调用 evaluateCase。迁移前的全量备份在 /workspace/r10c_mig/cases_before/。

## 一、ctrl 夹具整套重建（fixtures_r10）
- 生成方式：在 box 上用 sample_r9/data 的真实 briefs（09-21…10-21），本地 mock 回放 r8 的 AI 回复（127.0.0.1:18999，共请求 2 次）。命令是 `node scripts/generate-sample.js daily 2026-10-21 --data-dir … --out-dir /workspace/r10c_mig/out_2026-10-21`，四个关闭开关都已强制打开。brief、insights（含 renderEntries）、facts 都出自同一次生成，编号一致。
- 写入 regen_ctrl.js 的结果：
  - ctrl_pass：三份文件都换成生成结果，facts 188 条。
  - P8：同一套，insights 只多一个 `hero.lead`「openai/codex 以 98765 星居首」。
  - P9：同一套，insights 只多一个 `metrics`（987,654 / ▲123,456）。
  - degraded_fail：同一套，insights 加 `_fallback: true`，oneLiner 是「AI 分析服务暂时不可用…」。
  - facts_missing_fail：同一套，facts 去掉 prev_new_face_rate，剩 187 条。
- 附带发现：这次生成本身就是 FAIL。10-21 有 R5 11 条，10-19 有 6 条，.FAIL.html 都写在 out-dir，仓库保持干净（B7 生效）。原因见第四节，都是 src 的问题。

## 二、补 facts（只追加，不改已有编号）
- fixtures_r5/facts.json 追加 f20 avg_stars=103k、f21 hot_count=2；fixtures_r9/facts.json 追加同样两条。
- 值由 build-facts 从 22 份同样的夹具 brief 算出（supplement_facts.js，用一个隔离的 REPORT_DATA_DIR）。
- 没法补的：max_today、category_share、language_share、new_face_rate。夹具没有历史数据，build-facts 不产出这些条目，但页面数据照样显示数字。按新的 B3 规则这些格子会被拦，属于 src 问题（第四节）。

## 三、B5 字段名改名（只改名，不删字段，不缩小核对范围）
migrate_b5.out 逐条：
- A1-F01：hotIndex.reason → hypeIndex.reason
- A2-F01：keyFindings[1] → highlights
- A2-F02、A2-F03、B7-F02：theme.detailed → weeklyTheme.detailed
- B7-F01、B7-F05：其中的 theme.detailed → weeklyTheme.detailed，其余字段保留
- A5-F01：longTermValue[].reasons → longTermValue[0].reasons
- C1-F01：projects[morluto/rea].analysis.useCases → projects[0].analysis.useCases（rea 在该 brief 里排第 0 位）
- C2-F02：projects[*].analysis.trends → projects[0].analysis.trends（检查器不支持 * 通配）
- C3-F22：oneLiner → monthlyTheme.oneLiner

## 四、应拦用例在新夹具下的命中情况（fail_hits.tsv）
- 一共 121 条应拦用例，114 条仍然拦住，而且期望的字段全部命中：
  - cases 29/34
  - programmer_r2 19/19
  - r3 21/22
  - r5 26/27
  - r9 12/12
  - r10 7/7（P8→hero，P9→metrics，DEGRADED→insights，PCT→cmp.rows[8].now，PUNCT→analysis，AGENT→projects[0].descZh，CMP-FACTS-MISSING→cmp.rows[9].refs[0].value）
- 7 条整条仍被拦下，但期望字段没有全部命中。这是检查器真实的漏检，没有靠缩小期望来掩盖：
  - B3-F01：期望两个仓库名，只命中 debpalash/VoiceStudio，漏了 HKUDS/CLI-Anything。
  - B7-F01：期望 weeklyTheme.detailed、stats.aiProjects，只命中 header.aiPercent。
  - B7-F05：期望 weeklyTheme.detailed，只命中 header.aiProjects。
  - B8-F01：stats.avgStars 没命中。
  - C3-F24：期望 footer，命中的是 document。
  - R3-B6-F01：期望 weeklyTheme.oneLiner，命中的是 document。
  - R5-CARD-ENGLISH-F06：期望 projects[0].descShortZh，命中的是 descZh 和若干空字段。

## 五、应过用例
- cases、programmer_r2、r3 的应过用例全部通过。各举 2 条（检查对象是 content-compare 的历史数据，数字出处是夹具自己的 facts 或 brief）：
  - A2-P01「+229268」、A2-P02「316,460 Star」
  - A1-P01「xerj 累计 6898 星、今日 164」、D2-P02（不含数字）
  - R3-B4-P01「morluto/rea 本周新增 229268 星」（fixtures_r3/b4_rendered_pass/facts.json）、R3-B4-P02「2026-W42」（b4_whitelist_pass/facts.json）
- r5（19 条里 18 条不通过）、r9（6/6 不通过）、r10（5/5 不通过）的应过用例在新规则下仍然红。原因全在 src，不是夹具编号的问题：
  1. facts 不产出 max_today 这个条目（只有 prev_max_today），对比表「最大单项目新增」就找不到出处。这条在真实 10-21 数据上也出现。
  2. C3 让简介表的一句话直接免去重，但检查器还保留着「一句话不得等于简介」的规则，两边冲突。graphify、Kronos、ruflo、agency、vllm 都命中。
  3. C6：「代理」只在页面数据里被替换成「智能体」，但术语检查还会扫 insights 原始槽位和 descShortZh（页面数据里没有这个字段，取的是原值），所以仍然报「代理」。另外「智能代理」替换后变成「智能智能体」，又触发连续重复词检查（r5 夹具）。
  4. B2 改成读页面数据后，旧的「核心趋势须含较昨日/较上一有数据日…」检查不认程序句里的「较上期」；深度分析的 2–4 句检查也会被单句程序文本触发。
  5. 夹具没有历史数据时，页面数据仍然显示 category_share、language_share、new_face_rate 的数字，但 facts 不产出对应条目。
- ctrl_pass 的关键数字和出处（facts-daily-2026-10-21）：上榜 13（f1），AI 10（f2），当日新增 14,517（f5），上期 11,251（f24），高热 13（f4），留存率 58.3%（f84），上期 61.5%（f108），新面孔率 15.4%（f85），上期 33.3%（f109），前 3 合计 7,138（f107），Agent 份额 76.9%（f74），上期 66.7%（f75）。最大单项目新增 3,861 **在 facts 里没有出处**，见第 1 条。

## 六、结论
- 夹具这一侧已经对齐：编号一致，字段名改成了新命名。
- 剩下 29 条应过用例变红、7 条期望字段没命中，要绿需要改 src 的 5 处，见第五节 1–5。按裁定这次不动 src，所以没改。
