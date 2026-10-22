// ctrl 家族从 generate-sample + mock 产出整套重建（brief/insights/facts 同源，编号一致）
const fs=require('fs');const O='/workspace/r10c_mig/out_2026-10-21/data';const F='/home/box/shared/report-redesign/refactor/cases/fixtures_r10/';
const rd=p=>JSON.parse(fs.readFileSync(p,'utf8'));const wr=(p,j)=>fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
const brief=rd(O+'/briefs/daily/data-2026-10-21.json'),ins=rd(O+'/insights/daily/insights-2026-10-21.json'),facts=rd(O+'/facts/facts-daily-2026-10-21.json');
const fam={ctrl_pass:i=>i,P8:i=>({...i,hero:{lead:'openai/codex 以 98765 星居首'}}),P9:i=>({...i,metrics:[{label:'上榜项目',value:'987,654',dYText:'▲123,456'}]}),
 degraded_fail:i=>({...i,_fallback:true,oneLiner:'AI 分析服务暂时不可用，请查看完整项目列表。'}),facts_missing_fail:i=>i};
for(const [d,f] of Object.entries(fam)){wr(F+d+'/data-2026-10-21.json',brief);wr(F+d+'/insights-2026-10-21.json',f(ins));
 let fx=JSON.parse(JSON.stringify(facts));if(d==='facts_missing_fail'){if(Array.isArray(fx))fx=fx.filter(x=>x.role!=='prev_new_face_rate');else fx.facts=fx.facts.filter(x=>x.role!=='prev_new_face_rate');}
 wr(F+d+'/facts.json',fx);console.log(d,'ok',(Array.isArray(fx)?fx:fx.facts).length);}
