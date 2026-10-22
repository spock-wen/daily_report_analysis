// B5：老用例 expected_hit_fields 按检查器当前字段命名改名（只改名，不删字段，不缩小范围）
const fs=require('fs');const C='/home/box/shared/report-redesign/refactor/cases/';
const R={ // id -> [[old,new],...]
 'A1-F01':[['hotIndex.reason','hypeIndex.reason']],
 'A2-F01':[['keyFindings[1]','highlights']],
 'A2-F02':[['theme.detailed','weeklyTheme.detailed']],
 'A2-F03':[['theme.detailed','weeklyTheme.detailed']],
 'B7-F01':[['theme.detailed','weeklyTheme.detailed']],
 'B7-F02':[['theme.detailed','weeklyTheme.detailed']],
 'B7-F05':[['theme.detailed','weeklyTheme.detailed']],
 'A5-F01':[['longTermValue[].reasons','longTermValue[0].reasons']],
 'C1-F01':[['projects[morluto/rea].analysis.useCases','projects[0].analysis.useCases']],
 'C2-F02':[['projects[*].analysis.trends','projects[0].analysis.trends']],
 'C3-F22':[['oneLiner','monthlyTheme.oneLiner']],
};
const log=[];
for(const f of ['cases.jsonl','cases_r3.jsonl']){const out=fs.readFileSync(C+f,'utf8').split('\n').map(l=>{if(!l.trim())return l;const c=JSON.parse(l);const m=R[c.id];if(!m)return l;
 const before=JSON.stringify(c.expected_hit_fields);c.expected_hit_fields=c.expected_hit_fields.map(x=>{const h=m.find(([o])=>o===x);return h?h[1]:x});log.push(`${f}\t${c.id}\t${before}\t->\t${JSON.stringify(c.expected_hit_fields)}`);return JSON.stringify(c);});fs.writeFileSync(C+f,out.join('\n'));}
console.log(log.join('\n'));
