// r10d 第 2 轮：旧夹具 facts 按本仓 buildFacts（S1/S2 新 role）只在末尾追加缺失 role，不动已有编号
const fs=require('fs'),path=require('path');
const {buildFacts}=require('/workspace/report-refactor/daily_report_analysis/src/facts/build-facts');
const R='/home/box/shared/report-redesign/',C=R+'refactor/cases/';
const WANT=/^(category_share|language_share|new_face_rate|max_today|hot_count|avg_stars)$/;
const seen=new Map();
for(const f of fs.readdirSync(C).filter(n=>n.endsWith('.jsonl')))for(const l of fs.readFileSync(C+f,'utf8').split('\n')){
  if(!l.trim())continue;const c=JSON.parse(l);if(c.rule_id!=='R5'||!c.facts||!c.file)continue;
  const dir=path.dirname(R+c.file);const b=fs.readdirSync(dir).find(n=>/^data-\d{4}-\d{2}-\d{2}\.json$/.test(n));if(!b)continue;
  if(!seen.has(R+c.facts))seen.set(R+c.facts,dir+'/'+b);}
for(const [fp,bp] of seen){
  if(!fs.existsSync(fp))continue;const fx=JSON.parse(fs.readFileSync(fp,'utf8'));const arr=Array.isArray(fx)?fx:fx.facts;
  const brief=JSON.parse(fs.readFileSync(bp,'utf8'));const period=bp.match(/\d{4}-\d{2}-\d{2}/)[0];
  const r=buildFacts({level:'daily',period,brief});const nf=Array.isArray(r)?r:r.facts;
  const have=new Set(arr.map(x=>x.role));let max=0;for(const x of arr){const m=/^f(\d+)$/.exec(x.id||'');if(m)max=Math.max(max,+m[1]);}
  const add=[];for(const x of nf){if(x.role&&WANT.test(x.role)&&!have.has(x.role)){add.push({...x,id:'f'+String(++max).padStart(1,'0')});have.add(x.role);}}
  if(add.length){arr.push(...add);fs.writeFileSync(fp,JSON.stringify(fx,null,2)+'\n');}
  console.log(path.relative(C,fp),'+',add.map(x=>x.role).join(',')||'-');}
