// 给共享 facts 追加缺失的 role（只追加、新编号接在末尾，不动已有编号），值由 buildFacts 从同一份夹具 brief 算出
const fs=require('fs'),path=require('path'),os=require('os');
const [factsPath,briefPath]=process.argv.slice(2);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'r10c-'));fs.mkdirSync(path.join(tmp,'briefs/daily'),{recursive:true});
const brief=JSON.parse(fs.readFileSync(briefPath,'utf8'));const date=brief.date||'2026-10-21';
fs.writeFileSync(path.join(tmp,'briefs/daily',`data-${date}.json`),JSON.stringify(brief));
process.env.REPORT_DATA_DIR=tmp;
const R='/workspace/report-refactor/daily_report_analysis';const metrics=require(R+'/src/metrics');const {buildFacts}=require(R+'/src/facts/build-facts');
const computed=metrics.enrichDailyBrief(brief,{date});const built=buildFacts({level:'daily',period:date,brief,metrics:computed});
const all=Array.isArray(built)?built:built.facts;
const raw=JSON.parse(fs.readFileSync(factsPath,'utf8'));const arr=Array.isArray(raw)?raw:raw.facts;
const have=new Set(arr.map(f=>f.role));let next=Math.max(...arr.map(f=>+String(f.id).replace(/\D/g,'')||0))+1;const added=[];
const want=new Set((process.env.ROLES||'').split(','));for(const f of all){if(want.size>1&&!want.has(f.role))continue;if(!f.role||have.has(f.role))continue;have.add(f.role);const n={...f,id:'f'+(next++),source:(f.source||'')+'（r10c 迁移追加，夹具 brief 计算）'};arr.push(n);added.push(`${n.id} ${n.role}=${n.value}`);}
fs.writeFileSync(factsPath,JSON.stringify(raw,null,2)+'\n');console.log(factsPath,'追加',added.length,'\n  '+added.join('\n  '));
