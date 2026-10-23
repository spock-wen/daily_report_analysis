const {evaluateCase}=require('/workspace/report-refactor/daily_report_analysis/src/checker');const fs=require('fs');
const C='/home/box/shared/report-redesign/refactor/cases/';const only=process.argv[2];
for(const f of fs.readdirSync(C).filter(x=>x.endsWith('.jsonl'))){if(only&&f!==only)continue;for(const l of fs.readFileSync(C+f,'utf8').split('\n').filter(Boolean)){const c=JSON.parse(l);
const r=evaluateCase(c,{casesRoot:'/home/box/shared/report-redesign',dataDir:'/workspace/report-refactor/daily_report_analysis/data'});if(r.ok)continue;
console.log(f,c.id,c.expect,'facts='+c.facts);for(const x of (c.expect==='PASS'?r.matched:r.findings).slice(0,12))console.log('   ',x.field,'|',x.message.slice(0,80));if(r.missingFields&&r.missingFields.length)console.log('    missing',r.missingFields);}}
