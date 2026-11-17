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
 '<div class="hist24-row">'+sourceLink(r.link)+'<button type="button" class="btn btn-small" data-open-alumni="'+safe(r.name)+'">个人完整履历 ↗</button>'+'</div></article>').join('')||'<p class="hist24-empty">暂无符合筛选条件的成绩。</p>';
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
// 2026 post-graduation OB race results checked against organizer, team, or university sources.
const OB_RESULTS_2026=[{"id":"ob2026-1","year":2026,"name":"山口 智規","grade":null,"meet":"金栗記念選抜陸上中長距離大会","event":"5000m","date":"2026-04-11","time":"13:16.38","rank":4,"status":"OB","link":"https://www.sg-hldgs.co.jp/trackfield/result/2026/result260411-1.html","stage":"PB · SGホールディングス","verifiedOriginal":true,"sourceType":"official_2026"},{"id":"ob2026-2","year":2026,"name":"山口 智規","grade":null,"meet":"セイコーゴールデングランプリ陸上2026東京","event":"1500m","date":"2026-05-17","time":"3:38.51","rank":4,"status":"OB","link":"https://www.sg-hldgs.co.jp/trackfield/result/2026/result260517-1.html","stage":"SGホールディングス","verifiedOriginal":true,"sourceType":"official_2026"},{"id":"ob2026-3","year":2026,"name":"山口 智規","grade":null,"meet":"トリーア国際競技会（ドイツ）","event":"3000m","date":"2026-09-02","time":"7:47.13","rank":6,"status":"OB","link":"https://www.rikujyokyogi.co.jp/archives/215447","stage":"PB · SGホールディングス","verifiedOriginal":true,"sourceType":"official_2026"},{"id":"ob2026-4","year":2026,"name":"山口 智規","grade":null,"meet":"愛知・名古屋2026アジア競技大会","event":"5000m","date":"2026-09-29","time":"13:31.43","rank":2,"status":"OB","link":"https://www.jaaf.or.jp/news/article/24151/?category=2","stage":"银牌 · SGホールディングス","verifiedOriginal":true,"sourceType":"official_2026"},{"id":"ob2026-5","year":2026,"name":"井川 龍人","grade":null,"meet":"セイコーゴールデングランプリ陸上2026東京","event":"3000m","date":"2026-05-17","time":"7:39.36","rank":2,"status":"OB","link":"https://www.asahi-kasei.com/jp/sports-event/track-field/schedule/2026/0517","stage":"日本纪录 · 旭化成","verifiedOriginal":true,"sourceType":"official_2026"},{"id":"ob2026-6","year":2026,"name":"井川 龍人","grade":null,"meet":"第110回日本陸上競技選手権大会","event":"5000m","date":"2026-06-12","time":"13:28.42","rank":4,"status":"OB","link":"https://waseda-ac.jp/news/detail/896","stage":"预赛第3组第4名 · 晋级","verifiedOriginal":true,"sourceType":"official_2026"},{"id":"ob2026-7","year":2026,"name":"伊藤 大志","grade":null,"meet":"第110回日本陸上競技選手権大会","event":"5000m","date":"2026-06-12","time":"13:38.89","rank":9,"status":"OB","link":"https://waseda-ac.jp/news/detail/896","stage":"预赛第3组第9名","verifiedOriginal":true,"sourceType":"official_2026"},{"id":"ob2026-8","year":2026,"name":"太田 直希","grade":null,"meet":"第110回日本陸上競技選手権大会","event":"5000m","date":"2026-06-12","time":"13:41.41","rank":12,"status":"OB","link":"https://waseda-ac.jp/news/detail/896","stage":"预赛第3组第12名","verifiedOriginal":true,"sourceType":"official_2026"}];
records.push(...OB_RESULTS_2026);
window.WSD_HISTORY_RECORDS=records;
window.WSD_HISTORY_2025_SUPPLEMENT=records.filter(x=>x.year===2025).map(r=>({
 date:r.date,event:r.meet,type:classifyEvent(r.event),metric:r.event,name:r.name,grade:r.grade||null,time:r.time,rank:r.rank||null,
 note:(r.status==='OB'?'毕业后 · ':'在校 · ')+'朋友整理 · 待逐项复核'+(r.stage?' · '+r.stage:''),
 source:r.link,fromWorkbook:true
}));
window.dispatchEvent(new Event('wsd-history-loaded'));
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
.hist24-loadrow{text-align:center;margin:18px 0 26px}
.hist24-ekiden-list{display:grid;gap:12px;margin-bottom:25px}
.hist24-ekiden-card{background:#fff;border:1px solid #ebdfe4;border-radius:12px;overflow:hidden}
.hist24-ekiden-card>summary{display:flex;align-items:center;justify-content:space-between;gap:14px;list-style:none;padding:16px;cursor:pointer;background:#fbf6f8}
.hist24-ekiden-card>summary::-webkit-details-marker{display:none}
.hist24-ekiden-name,.hist24-ekiden-results{display:flex;flex-direction:column;gap:5px}
.hist24-ekiden-name>b{font-size:14px;color:#5b2d43}
.hist24-ekiden-name>small{font-size:11px;color:#917984}
.hist24-ekiden-results{text-align:right}
.hist24-ekiden-results b{color:#7d304d;font-size:12px}
.hist24-ekiden-results strong{font-size:20px;color:#5b2d43;font-variant-numeric:tabular-nums}
.hist24-ekiden-details{padding:12px 16px 16px}
.hist24-ekiden-details a{color:#842d51;text-decoration:underline}
.hist24-ekiden-table{border-collapse:collapse;min-width:430px;width:100%;font-size:12px}
.hist24-ekiden-table th,.hist24-ekiden-table td{padding:10px;border-bottom:1px solid #f0e6eb;text-align:left}
.hist24-ekiden-table th{background:#f9f3f6;color:#765268}
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
const EKIDEN_2024=[{"key":"hak","name":"第100回 箱根驿传","date":"2024-01-02 / 01-03","rank":7,"total":"10:56:40","distance":"217.1km","note":"往路 5:26:05（第5） · 复路 5:30:35（第10）","url":"https://www.hakone-ekiden.jp/record/tournament-university.php?tn=103&university_id=50","legs":[["間瀬田 純平","21.3","1:01:53",12],["山口 智規","23.1","1:06:31",4],["辻 文哉","21.4","1:02:39",7],["石塚 陽士","20.9","1:02:50",13],["工藤 慎作","20.8","1:12:12",6],["柳本 匡哉","20.8","1:01:02",20],["諸冨 湧","21.3","1:04:30",14],["伊福 陽太","21.4","1:04:56",5],["菖蒲 敦司","23.1","1:10:22",11],["菅野 雄太","23.0","1:09:45",5]]},{"key":"izu","name":"第36回 出云驿传","date":"2024-10-14","rank":6,"total":"2:12:23","distance":"45.1km","note":"全6区 · 第6区工藤慎作区间第2","url":"https://waseda-ac.jp/competition/detail/410","legs":[["山口 智規","8.0","24:09",12],["伊藤 大志","5.8","16:49",10],["山口 竣平","8.5","25:15",11],["藤本 進次郎","6.2","18:04",7],["長屋 匡起","6.4","18:31",3],["工藤 慎作","10.2","29:35",2]]},{"key":"zen","name":"第56回 全日本大学驿传","date":"2024-11-03","rank":5,"total":"5:14:24","distance":"106.8km","note":"全8区 · 第5区山口竣平刷新当时校纪录","url":"https://waseda-ac.jp/competition/detail/412","legs":[["間瀬田 純平","9.5","28:30",19],["山口 智規","11.1","31:48",5],["藤本 進次郎","11.9","35:32",15],["伊藤 大志","11.8","34:04",5],["山口 竣平","12.4","36:08",3],["伊福 陽太","12.8","38:21",10],["長屋 匡起","17.6","51:49",5],["工藤 慎作","19.7","58:12",3]]}];
function renderEkiden2024(){
 const el=$('hist24Ekiden');if(!el)return;
 el.innerHTML=EKIDEN_2024.map((r,i)=>'<details class="hist24-ekiden-card" '+'><summary><span class="hist24-ekiden-name"><b>'+safe(r.name)+'</b><small>'+safe(r.date)+' · '+safe(r.distance)+'</small></span><span class="hist24-ekiden-results"><b>第'+r.rank+'名</b><strong>'+safe(r.total)+'</strong></span><span aria-hidden="true">⌄</span></summary><div class="hist24-ekiden-details"><p class="hist24-summary">'+safe(r.note)+' · <a target="_blank" rel="noopener noreferrer" href="'+safe(r.url)+'">查看官方成绩 ↗</a></p><div class="tablewrap"><table class="hist24-ekiden-table"><thead><tr><th>区间</th><th>选手</th><th>距离</th><th>成绩</th><th>区间名次</th></tr></thead><tbody>'+r.legs.map((v,j)=>'<tr><td>'+(j+1)+'区</td><td>'+safe(v[0])+'</td><td>'+safe(v[1])+' km</td><td><b>'+safe(v[2])+'</b></td><td>第'+v[3]+'名</td></tr>').join('')+'</tbody></table></div></div></details>').join('');
}
const data2024=records.filter(r=>r.year===2024);
const GRADUATES_2026=[
 {name:'山口 智規',schoolYear:2026,source:'https://www.waseda.jp/top/news/117621'},
 {name:'間瀬田 純平',schoolYear:2026,source:'https://www.waseda.jp/top/news/117621'},
 {name:'宮岡 凛太',schoolYear:2026,source:'https://www.waseda.jp/top/news/117621'},
 {name:'伊藤 幸太郎',schoolYear:2026,source:'https://www.waseda.jp/top/news/117621'}
];
const grad2026Keys=new Set(GRADUATES_2026.map(x=>normalizeName(x.name)));
const obNames=[...new Map([...records.map(r=>r.name),...GRADUATES_2026.map(r=>r.name)].map(n=>[normalizeName(n),n])).values()].sort((a,b)=>a.localeCompare(b,'ja'));
const obNameKeys=new Set([...records.filter(r=>r.status==='OB').map(r=>normalizeName(r.name)),...grad2026Keys]);
const page2024=panel('archive2024','2024 · HISTORICAL RACE DATABASE','2024 全年成绩','2024自然年 · 在校及OB毕业后比赛成绩',
 '<div class="hist24-note">共209条成绩，按自然年及比赛时身份归档。资料如需修改，可在跑友共建提交补充，管理员可查验。</div>'+
 '<div class="sectionhead" style="margin:22px 0 10px"><div><div class="eyebrow">2024 · THREE MAJOR EKIDEN</div><h3>三大驿传 · 团队总成绩</h3><p>点击赛事可查看每区选手、成绩与名次</p></div></div><div id="hist24Ekiden" class="hist24-ekiden-list"></div>'+
 '<div class="hist24-toolbar"><input id="hist24Search" type="search" placeholder="搜索姓名、比赛或项目"><select id="hist24Status"><option value="all">在校与OB</option><option value="student">在校成绩</option><option value="OB">OB毕业后</option></select><select id="hist24Meet"><option value="all">全部赛事</option></select><select id="hist24Event"><option value="all">全部项目</option></select><select id="hist24Month"><option value="all">全年月份</option>'+Array.from({length:12},(_,i)=>'<option value="'+String(i+1).padStart(2,'0')+'">'+(i+1)+'月</option>').join('')+'</select><button id="hist24Export" class="btn btn-small">导出CSV ↓</button></div>'+
 '<p id="hist24Count" class="hist24-summary"></p><div id="hist24List" class="hist24-grid"></div><div class="hist24-loadrow"><button type="button" id="hist24More" class="btn btn-small" hidden>加载更多成绩 ↓</button></div>');
const obPage=panel('obarchive','WASEDA ATHLETE HISTORY · ALUMNI','选手历史档案 / OB','一人一档 · 合并历史成绩 · 2026届毕业选手已加入',
 '<div class="hist24-note">共'+obNames.length+'位历史选手档案，包括2026届毕业生及2026年有来源的OB赛果。2026年1月箱根属于毕业前成绩，4月后的职业比赛归入OB；可提交修改，管理员可查验。</div>'+ 
 '<div class="wsd-open-controls"><button type="button" class="wsd-open-btn" data-wsd-new="ob_result">＋ 新增OB比赛成绩</button></div>'+
 '<div class="hist24-toolbar"><input id="histObSearch" type="search" placeholder="搜索选手姓名"><select id="histObScope"><option value="all">全部历史选手</option><option value="ob">仅OB毕业选手</option><option value="2026">2026届毕业选手</option></select><select id="histObYear" aria-label="按比赛年份筛选"><option value="all">所有比赛年份</option><option value="2026">2026年比赛</option><option value="2025">2025年比赛</option><option value="2024">2024年比赛</option></select><button class="btn btn-small" id="histObExport">导出OB成绩 ↓</button></div>'+ 
 '<div id="histObCount" class="hist24-summary"></div><details class="hist24-ob-fold"><summary>展开／收起 OB 选手名单（按年份筛选）</summary><div id="histObNames" class="hist24-ob-list"></div></details><div id="histObDetail" class="hist24-ob-detail"></div>');
host.insertAdjacentHTML('beforebegin',page2024+obPage);
const foldStyle=document.createElement("style");foldStyle.textContent=".hist24-ob-fold{margin:14px 0;border:1px solid #e8dce1;border-radius:12px;background:#fff;padding:12px}.hist24-ob-fold>summary{cursor:pointer;font-weight:750;color:#74324e;padding:7px}.hist24-ob-fold[open]>summary{margin-bottom:12px}";document.head.appendChild(foldStyle);
const index2025=navItems.findIndex(x=>x[0]==='archive2025');
navItems.splice(Math.max(0,index2025),0,['archive2024','2024 全年','◷']);
const indexSeason=navItems.findIndex(x=>x[0]==='season');
navItems.splice(indexSeason,0,['obarchive','历史选手 / OB','♧']);
setupNav();
renderEkiden2024();
const meetSelect=$('hist24Meet');
for(const meet of [...new Set(data2024.map(r=>r.meet).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'))){const opt=document.createElement('option');opt.value=meet;opt.textContent=meet;meetSelect.appendChild(opt);}
const eventSelect=$('hist24Event');
for(const event of [...new Set(data2024.map(r=>r.event))].sort((a,b)=>a.localeCompare(b,'ja'))){const opt=document.createElement('option');opt.value=event;opt.textContent=event;eventSelect.appendChild(opt);}
let filtered2024=data2024;
let visible2024=24;
function refresh2024(reset=true){
 if(reset)visible2024=24;
 const active2024=allAthleteHistory().filter(r=>Number(r.year)===2024);
 const meetSelect=$('hist24Meet'),eventSelect=$('hist24Event');
 for(const [select,values] of [[meetSelect,active2024.map(r=>r.meet)],[eventSelect,active2024.map(r=>r.event)]]){
  const known=new Set([...select.options].map(o=>o.value));
  for(const v of new Set(values.filter(Boolean)))if(!known.has(v)){const o=document.createElement('option');o.value=v;o.textContent=v;select.appendChild(o);known.add(v);}
 }
 const q=$('hist24Search').value.trim().toLowerCase(),status=$('hist24Status').value,ev=$('hist24Event').value,meet=$('hist24Meet').value,mon=$('hist24Month').value;
 filtered2024=active2024.filter(r=>(status==='all'||r.status===status)&&(ev==='all'||r.event===ev)&&(meet==='all'||r.meet===meet)&&(mon==='all'||r.date.slice(5,7)===mon)&&(!q||[r.name,r.meet,r.event,r.time].some(x=>String(x).toLowerCase().includes(q)))).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'ja'));
 $('hist24Count').textContent='已展示 '+Math.min(visible2024,filtered2024.length)+' / '+filtered2024.length+' 条符合条件的成绩 · 共'+active2024.length+'条记录';
 $('hist24List').innerHTML=renderResults(filtered2024.slice(0,visible2024));
 const more=$('hist24More');more.hidden=visible2024>=filtered2024.length;
}
['hist24Search','hist24Status','hist24Meet','hist24Event','hist24Month'].forEach(id=>$(id).addEventListener(id==='hist24Search'?'input':'change',()=>refresh2024(true)));
$('hist24More').onclick=()=>{visible2024+=24;refresh2024(false);};
$('hist24Export').onclick=()=>exportRows(filtered2024,'waseda_2024_results.csv');
let currentOb='';
function allAthleteHistory(){
 const legacy=(window.WSD_2025_ARCHIVE_ROWS||[])
   .map((r,i)=>({id:'verified2025-'+i,year:2025,name:r.name,grade:r.grade,meet:r.event,event:r.metric,date:r.date,time:r.time,rank:r.rank,status:'student',link:r.source,stage:r.note,verifiedOriginal:true}));
 const recent=[];
 const hak=(typeof RACES!=='undefined'?RACES.hak:null);
 (hak?.legs||[]).forEach((leg,index)=>{
  if(!grad2026Keys.has(normalizeName(leg[0])))return;
  const n=index+1;
  recent.push({id:'hakone2026-'+n,year:2026,name:leg[0],grade:4,meet:'第102回箱根駅伝',event:'箱根駅伝 '+n+'区',
    date:n<=5?'2026-01-02':'2026-01-03',time:leg[2],rank:leg[3],status:'student',
    link:hak.source||'https://waseda-ac.jp/competition/detail/747',stage:leg[1]+'km · 毕业前',verifiedOriginal:true});
 });
 const api=window.WSD_OPEN_ARCHIVE;
 const source=[...recent,...legacy,...records];
 const patched=api?api.patch('ob_result',source,api.keyOb):source.map(r=>({...r,_editKey:'ob:'+[r.name,r.date,r.meet,r.event,r.time].join('|').slice(0,178)}));
 const seen=new Set(),out=[];
 for(const r of patched){
  const key=[normalizeName(r.name),String(r.date).slice(0,10),normalizeName(r.time),normalizeName(r.event)].join('|');
  if(seen.has(key))continue;
  seen.add(key);out.push(r);
 }
 return out.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function athleteTimeline(name){
 return allAthleteHistory().filter(r=>normalizeName(r.name)===normalizeName(name));
}
function alumniRowHTML(r){
 return '<div class="hist24-timeline-row"><div class="hist24-timeline-main"><span class="hist24-timeline-date">'+safe(r.date||'日期待核实')+'</span><b>'+safe(r.event)+'</b><strong>'+safe(r.time)+'</strong></div>'+
 '<div class="hist24-timeline-extra">'+safe(r.meet||'')+(r.rank?' · 第'+safe(r.rank)+'名':'')+
 (r.grade?' · 当时'+safe(r.grade)+'年级':'')+(r.stage?' · '+safe(r.stage):'')+
 (r.verifiedOriginal?' · 既有年度档案':'')+
 (r.link?' · '+sourceLink(r.link):'')+'</div><div class="wsd-open-controls"><button type="button" class="wsd-open-btn" data-wsd-edit="ob_result" data-wsd-key="'+safe(r._editKey||'')+'">修改／删除</button></div></div>';
}
function renderAlumniTimeline(name){
 const all=athleteTimeline(name);
 const selectedYear=$('histObYear')?.value||'all';
 const shown=selectedYear==='all'?all:all.filter(r=>String(r.year||r.date?.slice(0,4)||'')===selectedYear);
 const byYear=new Map();
 for(const r of shown){
  const year=String(r.year||r.date?.slice(0,4)||'其他');
  if(!byYear.has(year))byYear.set(year,[]);
  byYear.get(year).push(r);
 }
 const years=[...byYear.keys()].sort((a,b)=>b.localeCompare(a));
 const wbOB=shown.filter(r=>r.status==='OB').length;
 const isGrad26=grad2026Keys.has(normalizeName(name));
 const school=shown.filter(r=>r.status!=='OB').length;
 $('histObDetail').innerHTML='<div class="panel panel-pad hist24-athlete-profile">'+
 '<div class="wsd-open-controls"><button type="button" class="wsd-open-btn" data-wsd-new="ob_result" data-wsd-name="'+safe(name)+'">＋ 新增此人比赛成绩</button><small>公开编辑，修改留有版本记录</small></div><div class="hist24-profile-heading"><div><div class="eyebrow">ONE ATHLETE · COMPLETE RACE LOG</div><h3>'+safe(name)+(isGrad26?' <span class="hist24-label">2026届毕业</span>':'')+'</h3><p class="hist24-summary">合并展示已收录的各年比赛纪录，包括2026年有来源的OB比赛成绩；按年份及参赛时身份分组。</p></div><button type="button" class="btn btn-small" id="histObProfileExport">导出此人全部成绩 ↓</button></div>'+
 (isGrad26?'<p class="hist24-summary">毕业年份：2026年3月 · 2026年1月箱根驿传仍属于在校期间。<a href="https://www.waseda.jp/top/news/117621" target="_blank" rel="noopener noreferrer">早稻田大学毕业专题 ↗</a></p>':'')+
 '<div class="hist24-profile-stats"><div><b>'+shown.length+'</b><small>'+(selectedYear==='all'?'已合并成绩':selectedYear+'年成绩')+'</small></div><div><b>'+wbOB+'</b><small>毕业后成绩</small></div><div><b>'+school+'</b><small>在校成绩及原档案</small></div></div>'+
 (years.length?years.map((year,i)=>{
  const rows=byYear.get(year),ob=rows.filter(r=>r.status==='OB'),student=rows.filter(r=>r.status!=='OB');
  const block=(items,label)=>items.length?'<div class="hist24-stage-head">'+label+' · '+items.length+' 条</div>'+items.map(alumniRowHTML).join(''):'';
  return '<details class="hist24-year-group" '+(i===0?'open':'')+'><summary><b>'+safe(year)+' 年</b><span>'+rows.length+' 条 · OB '+ob.length+' / 在校 '+student.length+'</span><span aria-hidden="true">⌄</span></summary><div class="hist24-year-content">'+block(ob,'毕业后 / OB')+block(student,'在校期间 / 原有档案')+'</div></details>';
 }).join(''):'<p class="hist24-empty">该年份暂无收录的比赛成绩，可切换「所有比赛年份」查看其他记录。</p>')+
 '<div class="hist24-note">每位选手只对应一个人物档案；同一场比赛不会重复列出。2026届毕业生在现有来源中尚无毕业后赛事记录时，不会虚构OB比赛。成绩如需修改，可在跑友共建提交，管理员可查验。</div></div>';
 const yearList=$('histObDetail').querySelector('details.hist24-year-group');
 if(yearList)yearList.insertAdjacentHTML('beforebegin','<div class="wsd-open-controls"><button type="button" class="wsd-open-btn" data-ob-bulk="open">展开全部年份</button><button type="button" class="wsd-open-btn" data-ob-bulk="close">收起全部年份</button></div>');
 $('histObProfileExport').onclick=()=>exportRows(all,'waseda_'+name.replace(/[\\/:*?"<>|]/g,'_')+'_all_results.csv');
}
function openAlumniProfile(name,scroll=true){
 const found=obNames.find(n=>normalizeName(n)===normalizeName(name));
 if(!found)return false;
 currentOb=found;
 $('histObSearch').value='';
 $('histObScope').value='all';
 $('histObYear').value='all';
 refreshOB();
 renderAlumniTimeline(found);
 show('obarchive');
 if(scroll)$('histObDetail').scrollIntoView({behavior:'smooth',block:'start'});
 return true;
}
window.WSD_OPEN_ALUMNI_PROFILE=openAlumniProfile;
function refreshOB(){
 const all=allAthleteHistory();
 const select=$('histObYear'),picked=select.value;
 const years=[...new Set(all.map(r=>String(r.year||r.date?.slice(0,4)||'')).filter(x=>/^\d{4}$/.test(x)))].sort((a,b)=>b.localeCompare(a));
 select.innerHTML='<option value="all">所有比赛年份</option>'+years.map(y=>'<option value="'+y+'">'+y+'年比赛</option>').join('');
 if(years.includes(picked))select.value=picked;
 const allNames=[...new Map([...all.map(r=>r.name),...GRADUATES_2026.map(r=>r.name)].map(n=>[normalizeName(n),n])).values()].sort((a,b)=>a.localeCompare(b,'ja'));
 obNames.splice(0,obNames.length,...allNames);
 for(const r of all)if(r.status==='OB')obNameKeys.add(normalizeName(r.name));
 const q=$('histObSearch').value.trim().toLowerCase();
 const scope=$('histObScope').value,year=$('histObYear').value;
 const names=obNames.filter(n=>(scope==='all'||scope==='ob'&&obNameKeys.has(normalizeName(n))||scope==='2026'&&grad2026Keys.has(normalizeName(n)))&&
  (year==='all'||athleteTimeline(n).some(r=>String(r.year||r.date?.slice(0,4)||'')===year))&&
  normalizeName(n).toLowerCase().includes(normalizeName(q).toLowerCase()));
 $('histObCount').textContent='显示 '+names.length+' / '+obNames.length+' 位选手；点击姓名查看其合并后的个人比赛履历';
 $('histObNames').innerHTML=names.map(n=>{
  const obRows=all.filter(r=>r.status==='OB'&&normalizeName(r.name)===normalizeName(n));
  return '<button type="button" data-ob-name="'+safe(n)+'" class="'+(currentOb===n?'active':'')+'"><strong>'+safe(n)+'</strong><small>'+(obRows.length?'毕业后 '+obRows.length+' 条':'在校期间档案')+' · '+(year==='all'?'全部年份':year+'年')+'</small></button>';
 }).join('')||'<div class="hist24-empty">未找到匹配的OB选手。</div>';
 if(currentOb&&!names.includes(currentOb)){currentOb='';$('histObDetail').innerHTML='';}
}
$('histObSearch').addEventListener('input',refreshOB);
$('histObScope').addEventListener('change',refreshOB);
$('histObYear').addEventListener('change',()=>{refreshOB();if(currentOb)renderAlumniTimeline(currentOb);});
document.addEventListener('click',e=>{
 const link=e.target.closest('[data-open-alumni]');if(!link)return;
 e.preventDefault();openAlumniProfile(link.dataset.openAlumni);
});
$('histObDetail').addEventListener('click',e=>{
 const control=e.target.closest('[data-ob-bulk]');
 if(!control)return;
 $('histObDetail').querySelectorAll('details.hist24-year-group').forEach(d=>{d.open=control.dataset.obBulk==='open';});
});
$('histObNames').addEventListener('click',e=>{
 const btn=e.target.closest('[data-ob-name]');if(!btn)return;
 openAlumniProfile(btn.dataset.obName);
});
$('histObExport').onclick=()=>exportRows(allAthleteHistory().filter(r=>r.status==='OB'),'waseda_ob_all_years.csv');
window.addEventListener('wsd-open-archive-change',()=>{refreshOB();refresh2024();if(currentOb)renderAlumniTimeline(currentOb);});
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
 note.textContent='2025年补充82条历史成绩原始记录，并与已有成绩进行去重。成绩如需修改，可在跑友共建提交资料，管理员可查验。';
 title?.before(note);
}
window.WSD_REFRESH_2025_ARCHIVE?.();
if(location.hash==='#archive2024')show('archive2024');
if(location.hash==='#obarchive')show('obarchive');
})();