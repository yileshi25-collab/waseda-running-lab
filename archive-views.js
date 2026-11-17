/* 2024-2025 historical archive and alumni viewer.
   Data extracted from community-supplied workbook; not independently verified.
   Loaded separately to preserve 2026/current-athlete statistics. */
(async function(){
"use strict";
const host=document.getElementById("view-athletes");
if(!host)return;
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $=id=>document.getElementById(id);
function sourceLink(url){try{const u=new URL(url);return u.protocol==="https:"?'<a href="'+safe(u.href)+'" target="_blank" rel="noopener noreferrer">来源 ↗</a>':'';}catch{return '';}}
function classifyEvent(e){
 if(/駅伝|驿传|駅传/.test(e))return "驿传";
 if(/マラソン|马拉松|ロード|Road|5km|10km|15km|ハーフ/i.test(e))return "路跑";
 return "场地";
}
function renderResults(rows){
 return rows.map(r=>'<article class="hist24-item">'+
 '<div class="hist24-row"><small>'+safe(r.date)+' · '+safe(r.meet)+'</small><span class="hist24-label">'+(r.status==='OB'?'OB · 毕业后':'在校成绩')+'</span></div>'+
 '<div class="hist24-row"><strong>'+safe(r.name)+'</strong><b class="hist24-time">'+safe(r.time)+'</b></div>'+
 '<div class="hist24-tags"><span>'+safe(r.event)+'</span>'+(r.grade?'<span>当时'+safe(r.grade)+'年级</span>':'')+(r.rank?'<span>第'+safe(r.rank)+'名</span>':'')+(r.stage?'<span>'+safe(r.stage)+'</span>':'')+'</div>'+
 '<div class="hist24-row"><small>朋友整理的历史记录 · 待逐项复核</small>'+sourceLink(r.link)+(r.status==='OB'?'<button type="button" class="btn btn-small" data-open-alumni="'+safe(r.name)+'">个人完整履历 ↗</button>':'')+'</div></article>').join('')||'<p class="hist24-empty">暂无符合筛选条件的成绩。</p>';
}
function exportRows(rows,filename){
 const heads=['year','athlete','grade_at_race','meet','event','date','time','rank','identity_at_race','source_url','stage'];
 const csv=(v)=>{const str=String(v??"");return /[",\r\n]/.test(str)?'"'+str.replace(/"/g,'""')+'"':str;};
 const matrix=[heads,...rows.map(r=>[r.year,r.name,r.grade,r.meet,r.event,r.date,r.time,r.rank,r.status,r.link,r.stage])];
 const blob=new Blob(['\ufeff'+matrix.map(r=>r.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function panel(id,eyebrow,title,subtitle,body){
 return '<section class="view" id="view-'+id+'"><div class="sectionhead"><div><div class="eyebrow">'+eyebrow+'</div><h2>'+title+'</h2><p>'+subtitle+'</p></div></div>'+body+'</section>';
}
function normalizeName(x){return String(x||"").replace(/[\s\u3000]/g,'');}
let records=[];
try{
 if(!window.DecompressionStream)throw Error('当前浏览器不支持gzip解压');
 const binary=Uint8Array.from(atob(window.WSD_HISTORY_GZIP||''),c=>c.charCodeAt(0));
 const stream=new Blob([binary]).stream().pipeThrough(new DecompressionStream('gzip'));
 const raw=JSON.parse(await new Response(stream).text());
 records=raw.map((x,i)=>({id:'friend-'+i,year:Number(x[0]),name:x[1],grade:x[2],meet:x[3],event:x[4],date:x[5],time:x[6],rank:x[7],status:x[8],link:x[9],stage:x[10]}));
 if(records.length!==291||records.filter(x=>x.year===2024).length!==209||records.filter(x=>x.year===2025).length!==82)throw Error('历史档案条数不匹配');
}catch(err){
 console.error('Historical archive import failed:',err);
 const info=document.createElement('div');info.className='panel panel-pad';info.textContent='2024—2025历史档案读取失败。原有数据没有受到影响。';host.before(info);return;
}
window.WSD_HISTORY_RECORDS=records;
window.WSD_HISTORY_2025_SUPPLEMENT=records.filter(x=>x.year===2025).map(r=>({
 date:r.date,event:r.meet,type:classifyEvent(r.event),metric:r.event,name:r.name,grade:r.grade||null,time:r.time,rank:r.rank||null,
 note:(r.status==='OB'?'毕业后 · ':'在校 · ')+'朋友整理 · 待逐项复核'+(r.stage?' · '+r.stage:''),
 source:r.link,fromWorkbook:true
}));
const css=String.raw`
.hist24-toolbar{display:flex;gap:9px;flex-wrap:wrap;margin:15px 0}
.hist24-toolbar input,.hist24-toolbar select{padding:11px;border:1px solid #e5d8df;border-radius:9px;background:#fff;color:#4e3240;min-width:125px;max-width:100%}
.hist24-toolbar input{min-width:220px;flex:1}
.hist24-summary{font-size:12px;color:#806f79;margin:10px 0 16px}
.hist24-note{font-size:12px;color:#826b77;line-height:1.8;padding:13px 16px;background:#fbf7f9;border:1px solid #ebdfe5;border-radius:11px;margin:15px 0}
.hist24-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px}
.hist24-item{border:1px solid #ece2e5;border-radius:11px;padding:13px 15px;background:#fff;min-width:0}
.hist24-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:7px 0}
.hist24-row small{color:#897782;font-size:11px;line-height:1.6}
.hist24-row a{color:#872e54;font-size:11px;text-decoration:underline}
.hist24-row strong{font-size:14px;color:#4c2538}
.hist24-time{font-size:17px;font-variant-numeric:tabular-nums;color:#72304d}
.hist24-label,.hist24-tags span{border-radius:7px;padding:3px 7px;background:#f4ebf0;color:#814860;font-size:10px}
.hist24-tags{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}
.hist24-empty{padding:18px;color:#88727b}
.hist24-ob-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:9px}
.hist24-ob-list button{border:1px solid #e6dae0;background:#fff;text-align:left;border-radius:9px;padding:12px;cursor:pointer}
.hist24-ob-list button:hover{border-color:#af788e}
.hist24-ob-list small{display:block;font-size:10px;margin-top:6px;color:#85727b}
.hist24-ob-list button.active{border-color:#872c50;background:#f9f0f4}
.hist24-ob-detail{margin-top:15px}
.hist24-ob-detail h3{font-size:17px;margin:0 0 8px;color:#602b41}
.hist24-ob-detail .hist24-grid{margin-top:15px}
@media(max-width:580px){.hist24-grid{grid-template-columns:1fr}.hist24-toolbar input{min-width:100%}}
`;
const st=document.createElement('style');st.textContent=css+"\n.hist24-profile-heading{display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap}\n.hist24-profile-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:15px 0 19px}\n.hist24-profile-stats>div{padding:12px;background:#f9f3f6;border-radius:9px;display:flex;flex-direction:column;gap:5px}\n.hist24-profile-stats b{font-size:21px;color:#76334f;font-variant-numeric:tabular-nums}\n.hist24-profile-stats small{font-size:10px;color:#87727d}\n.hist24-year-group{border:1px solid #ebdfe4;border-radius:11px;margin:13px 0;overflow:hidden}\n.hist24-year-group>summary{list-style:none;display:flex;justify-content:space-between;gap:12px;align-items:center;cursor:pointer;background:#faf5f7;padding:14px 16px}\n.hist24-year-group>summary::-webkit-details-marker{display:none}\n.hist24-year-group>summary b{color:#63283e;font-size:15px}\n.hist24-year-group>summary span{color:#85717b;font-size:11px}\n.hist24-year-group:not([open])>summary span:last-child{transform:rotate(-90deg)}\n.hist24-year-content{padding:9px 16px 14px}\n.hist24-stage-head{font-size:12px;font-weight:750;color:#71384e;border-bottom:1px solid #e8dbe1;padding:13px 0 8px;margin:6px 0}\n.hist24-timeline-row{padding:11px 0;border-bottom:1px solid #f1e8ec}\n.hist24-timeline-main{display:grid;grid-template-columns:115px minmax(105px,1fr) auto;gap:10px;align-items:center}\n.hist24-timeline-date{font-size:11px;color:#9a8790;font-variant-numeric:tabular-nums}\n.hist24-timeline-main b{color:#523241;font-size:12px}\n.hist24-timeline-main strong{color:#712849;font-size:14px;font-variant-numeric:tabular-nums}\n.hist24-timeline-extra{font-size:11px;color:#8f7c85;line-height:1.7;padding-left:125px;margin-top:4px}\n.hist24-timeline-extra a{color:#892f54;text-decoration:underline}\n@media(max-width:570px){.hist24-timeline-main{grid-template-columns:1fr auto}.hist24-timeline-date{grid-column:1/-1}.hist24-timeline-extra{padding-left:0}.hist24-profile-stats{gap:5px}}\n";document.head.appendChild(st);
const data2024=records.filter(r=>r.year===2024);
const obNames=[...new Map(records.filter(r=>r.status==='OB').map(r=>[normalizeName(r.name),r.name])).values()].sort((a,b)=>a.localeCompare(b,'ja'));
const page2024=panel('archive2024','2024 · HISTORICAL RACE DATABASE','2024 全年成绩','2024自然年 · 在校成绩与OB毕业后成绩分开标注 · 来自朋友整理表',
 '<div class="hist24-note">共209条原始成绩。按自然年归档；选手身份以比赛发生时的资料为准。来源链接来自朋友整理，尚未逐条独立核验，不能视为完整赛事清单。</div>'+
 '<div class="hist24-toolbar"><input id="hist24Search" type="search" placeholder="搜索姓名、比赛或项目"><select id="hist24Status"><option value="all">在校与OB</option><option value="student">在校成绩</option><option value="OB">OB毕业后</option></select><select id="hist24Event"><option value="all">全部项目</option></select><select id="hist24Month"><option value="all">全年月份</option>'+Array.from({length:12},(_,i)=>'<option value="'+String(i+1).padStart(2,'0')+'">'+(i+1)+'月</option>').join('')+'</select><button id="hist24Export" class="btn btn-small">导出CSV ↓</button></div>'+
 '<p id="hist24Count" class="hist24-summary"></p><div id="hist24List" class="hist24-grid"></div>');
const obPage=panel('obarchive','WASEDA OB · ALUMNI','OB / 历代毕业选手','独立OB历史资料库 · 只列毕业后至少有一条比赛成绩的选手',
 '<div class="hist24-note">目前有'+obNames.length+'名选手收录了毕业后成绩。人物档案可以同时查看他们2024—2025年在校及毕业后收录的成绩；不会参与2026现役选手统计。资料来自朋友整理，尚需逐项核验。</div>'+
 '<div class="hist24-toolbar"><input id="histObSearch" type="search" placeholder="搜索毕业选手姓名"><button class="btn btn-small" id="histObExport">导出OB成绩 ↓</button></div>'+
 '<div id="histObCount" class="hist24-summary"></div><div id="histObNames" class="hist24-ob-list"></div><div id="histObDetail" class="hist24-ob-detail"></div>');
host.insertAdjacentHTML('beforebegin',page2024+obPage);
const index2025=navItems.findIndex(x=>x[0]==='archive2025');
navItems.splice(Math.max(0,index2025),0,['archive2024','2024 全年','◷']);
const indexSeason=navItems.findIndex(x=>x[0]==='season');
navItems.splice(indexSeason,0,['obarchive','OB 历代选手','♧']);
setupNav();
const eventSelect=$('hist24Event');
for(const event of [...new Set(data2024.map(r=>r.event))].sort((a,b)=>a.localeCompare(b,'ja'))){const opt=document.createElement('option');opt.value=event;opt.textContent=event;eventSelect.appendChild(opt);}
let filtered2024=data2024;
function refresh2024(){
 const q=$('hist24Search').value.trim().toLowerCase(),status=$('hist24Status').value,ev=$('hist24Event').value,mon=$('hist24Month').value;
 filtered2024=data2024.filter(r=>(status==='all'||r.status===status)&&(ev==='all'||r.event===ev)&&(mon==='all'||r.date.slice(5,7)===mon)&&(!q||[r.name,r.meet,r.event,r.time].some(x=>String(x).toLowerCase().includes(q)))).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'ja'));
 $('hist24Count').textContent='显示 '+filtered2024.length+' / '+data2024.length+' 条成绩 · '+new Set(filtered2024.map(r=>r.name)).size+' 名选手';
 $('hist24List').innerHTML=renderResults(filtered2024);
}
['hist24Search','hist24Status','hist24Event','hist24Month'].forEach(id=>$(id).addEventListener(id==='hist24Search'?'input':'change',refresh2024));
$('hist24Export').onclick=()=>exportRows(filtered2024,'waseda_2024_results.csv');
let currentOb='';
function athleteTimeline(name){
 const key=normalizeName(name);
 const wb=records.filter(r=>normalizeName(r.name)===key);
 const legacy=(window.WSD_2025_ARCHIVE_ROWS||[])
   .filter(r=>normalizeName(r.name)===key)
   .map((r,i)=>({id:'verified2025-'+i,year:2025,name:r.name,grade:r.grade,meet:r.event,event:r.metric,date:r.date,time:r.time,rank:r.rank,status:'student',link:r.source,stage:r.note,verifiedOriginal:true}));
 const seen=new Set();
 const unique=[];
 // Prefer existing official archive to friend-supplied records when identical.
 for(const r of [...legacy,...wb]){
  const uniq=[normalizeName(r.name),String(r.date).slice(0,10),normalizeName(r.time),normalizeName(r.event)].join('|');
  if(seen.has(uniq))continue;
  seen.add(uniq);unique.push(r);
 }
 return unique.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.event).localeCompare(String(b.event)));
}
function alumniRowHTML(r){
 return '<div class="hist24-timeline-row"><div class="hist24-timeline-main"><span class="hist24-timeline-date">'+safe(r.date||'日期待核实')+'</span><b>'+safe(r.event)+'</b><strong>'+safe(r.time)+'</strong></div>'+
 '<div class="hist24-timeline-extra">'+safe(r.meet||'')+(r.rank?' · 第'+safe(r.rank)+'名':'')+
 (r.grade?' · 当时'+safe(r.grade)+'年级':'')+(r.stage?' · '+safe(r.stage):'')+
 (r.verifiedOriginal?' · 官方档案已收录':' · 朋友整理（待复核）')+
 (r.link?' · '+sourceLink(r.link):'')+'</div></div>';
}
function renderAlumniTimeline(name){
 const all=athleteTimeline(name);
 const byYear=new Map();
 for(const r of all){
  const year=String(r.year||r.date?.slice(0,4)||'其他');
  if(!byYear.has(year))byYear.set(year,[]);
  byYear.get(year).push(r);
 }
 const years=[...byYear.keys()].sort((a,b)=>b.localeCompare(a));
 const wbOB=records.filter(r=>normalizeName(r.name)===normalizeName(name)&&r.status==='OB').length;
 const school=all.filter(r=>r.status!=='OB').length;
 $('histObDetail').innerHTML='<div class="panel panel-pad hist24-athlete-profile">'+
 '<div class="hist24-profile-heading"><div><div class="eyebrow">ONE ATHLETE · COMPLETE RACE LOG</div><h3>'+safe(name)+'</h3><p class="hist24-summary">合并展示2024—2025年已收录的比赛纪录，优先保留原网站的官方赛事记录。按年份分组，并区分在校和OB身份。</p></div><button type="button" class="btn btn-small" id="histObProfileExport">导出此人全部成绩 ↓</button></div>'+
 '<div class="hist24-profile-stats"><div><b>'+all.length+'</b><small>已合并成绩</small></div><div><b>'+wbOB+'</b><small>毕业后成绩</small></div><div><b>'+school+'</b><small>在校成绩及原档案</small></div></div>'+
 years.map((year,i)=>{
  const rows=byYear.get(year),ob=rows.filter(r=>r.status==='OB'),student=rows.filter(r=>r.status!=='OB');
  const block=(items,label)=>items.length?'<div class="hist24-stage-head">'+label+' · '+items.length+' 条</div>'+items.map(alumniRowHTML).join(''):'';
  return '<details class="hist24-year-group" '+(i===0?'open':'')+'><summary><b>'+safe(year)+' 年</b><span>'+rows.length+' 条 · OB '+ob.length+' / 在校 '+student.length+'</span><span aria-hidden="true">⌄</span></summary><div class="hist24-year-content">'+block(ob,'毕业后 / OB')+block(student,'在校期间 / 原有档案')+'</div></details>';
 }).join('')+
 '<div class="hist24-note">每位选手只对应一个人物档案。2024和2025年度页仍可按日期查找；同一场比赛不会在本人物档案里重复列出。原始Excel身份标记与官方档案可能存在差异，未核实记录均保留来源标注。</div></div>';
 $('histObProfileExport').onclick=()=>exportRows(all,'waseda_'+name.replace(/[\\/:*?"<>|]/g,'_')+'_all_results.csv');
}
function openAlumniProfile(name,scroll=true){
 const found=obNames.find(n=>normalizeName(n)===normalizeName(name));
 if(!found)return false;
 currentOb=found;
 $('histObSearch').value='';
 refreshOB();
 renderAlumniTimeline(found);
 show('obarchive');
 if(scroll)$('histObDetail').scrollIntoView({behavior:'smooth',block:'start'});
 return true;
}
window.WSD_OPEN_ALUMNI_PROFILE=openAlumniProfile;
function refreshOB(){
 const q=$('histObSearch').value.trim().toLowerCase();
 const names=obNames.filter(n=>normalizeName(n).toLowerCase().includes(normalizeName(q).toLowerCase()));
 $('histObCount').textContent='显示 '+names.length+' / '+obNames.length+' 位OB；点击姓名查看其合并后的个人比赛履历';
 $('histObNames').innerHTML=names.map(n=>{
  const obRows=records.filter(r=>r.status==='OB'&&normalizeName(r.name)===normalizeName(n));
  return '<button type="button" data-ob-name="'+safe(n)+'" class="'+(currentOb===n?'active':'')+'"><strong>'+safe(n)+'</strong><small>毕业后 '+obRows.length+' 条 · 全部年份合并</small></button>';
 }).join('')||'<div class="hist24-empty">未找到匹配的OB选手。</div>';
 if(currentOb&&!names.includes(currentOb)){currentOb='';$('histObDetail').innerHTML='';}
}
$('histObSearch').addEventListener('input',refreshOB);
document.addEventListener('click',e=>{
 const link=e.target.closest('[data-open-alumni]');if(!link)return;
 e.preventDefault();openAlumniProfile(link.dataset.openAlumni);
});
$('histObNames').addEventListener('click',e=>{
 const btn=e.target.closest('[data-ob-name]');if(!btn)return;
 openAlumniProfile(btn.dataset.obName);
});
$('histObExport').onclick=()=>exportRows(records.filter(r=>r.status==='OB'),'waseda_ob_2024_2025.csv');
refresh2024();refreshOB();
// Add workbook-only events to the existing 2025 event filter without overwriting its official records.
const metric2025=$('arc25Metric');
if(metric2025){
 const known=new Set([...metric2025.options].map(o=>o.value));
 for(const event of [...new Set(window.WSD_HISTORY_2025_SUPPLEMENT.map(r=>r.metric))].sort((a,b)=>a.localeCompare(b,'ja'))){
  if(known.has(event))continue;
  const option=document.createElement('option');option.value=event;option.textContent=event;
  metric2025.appendChild(option);known.add(event);
 }
 const title=$('arc25Count');
 const note=document.createElement('p');note.className='hist24-note';
 note.textContent='2025年另有82条朋友整理的原始记录参与补充；页面会与已有官方及社区赛果按选手、日期和成绩去重。朋友整理记录均标为待复核，且不修改现有官方记录。';
 title?.before(note);
}
window.WSD_REFRESH_2025_ARCHIVE?.();
if(location.hash==='#archive2024')show('archive2024');
if(location.hash==='#obarchive')show('obarchive');
})();