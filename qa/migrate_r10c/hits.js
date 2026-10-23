const {evaluateCase}=require('/workspace/report-refactor/daily_report_analysis/src/checker');const fs=require('fs');
const C='/home/box/shared/report-redesign/refactor/cases/';const ids=new Set(process.argv.slice(2));
for(const f of fs.readdirSync(C).filter(x=>x.endsWith('.jsonl'))){for(const l of fs.readFileSync(C+f,'utf8').split('\n').filter(Boolean)){const c=JSON.parse(l);if(ids.size&&!ids.has(c.id))continue;if(!ids.size&&c.expect!=='FAIL')continue;
const r=evaluateCase(c,{casesRoot:'/home/box/shared/report-redesign',dataDir:'/workspace/report-refactor/daily_report_analysis/data'});
console.log([f,c.id,c.expect,r.ok?'OK':'NG',JSON.stringify(c.expected_hit_fields||[]),JSON.stringify([...new Set(r.matched.map(x=>x.field))])].join('\t'));}}
