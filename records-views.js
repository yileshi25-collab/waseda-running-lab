/* Historic Waseda ekiden and official university records. */
(function(){
'use strict';
const D=window.WSD_OFFICIAL_RECORDS;
if(!D||!Array.isArray(D.hakone)||!Array.isArray(D.school))return;
const host=document.getElementById('view-athletes');if(!host)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const urlLink=u=>/^https:\/\/(?:waseda-ac\.jp|www\.hakone-ekiden\.jp)\//.test(String(u||''))?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">官方来源 ↗</a>':'';
const toSec=x=>String(x).split(':').map(Number).reduce((a,b)=>a*60+b,0);
const originalHistory=[...D.hakone.map(x=>({...x,race:'hak'})),...(D.otherEkiden||[]).map(x=>({...x,race:x.type}))];
const api=()=>window.WSD_OPEN_ARCHIVE;
const archiveHistory=()=>api()?api().patch("ekiden",originalHistory,api().keyEk):originalHistory.map(r=>({...r,_editKey:"race:"+r.race+":"+r.year}));
const archiveSchools=()=>api()?api().patch("school_record",D.school,api().keySchool):D.school.map(r=>({...r,_editKey:"school:"+r.gender+":"+r.event}));
const archiveRankings=()=>api()?api().patch("alltime_rank",D.rankings||[],api().keyRank):(D.rankings||[]).map(r=>({...r,_editKey:"rank:"+r.gender+":"+r.event+":"+r.rank+":"+r.athlete}));
const editBtn=(kind,key)=>'<button type="button" class="wsd-open-btn" data-wsd-edit="'+kind+'" data-wsd-key="'+esc(key)+'">修改／删除</button>';
const addBtn=kind=>'<button type="button" class="wsd-open-btn" data-wsd-new="'+kind+'">＋ 新增</button>';
let historyLimit=20,schoolLimit=20;
const raceNames={hak:'箱根驿传',izu:'出云驿传',zen:'全日本大学驿传'};
const decs=[22,21,20,19,18,17,16,15,14,13,23];
const styles=[
'.wrec-wrap{background:#fff;border:1px solid #ede3e6;border-radius:14px;padding:18px;margin:17px 0}',
'.wrec-tools{display:flex;flex-wrap:wrap;gap:9px;margin:15px 0}',
'.wrec-tools input,.wrec-tools select{border:1px solid #e3d6dc;padding:10px 12px;border-radius:9px;color:#5e3650;background:#fff;max-width:100%;font-size:12px}',
'.wrec-tools input{flex:1;min-width:170px}',
'.wrec-keyline{font-size:11px;color:#8f7d85;line-height:1.8;margin:13px 0}',
'.wrec-cards{display:grid;gap:10px}',
'.wrec-card{border:1px solid #eadfe4;border-radius:11px;overflow:hidden}',
'.wrec-card summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;background:#faf6f8}',
'.wrec-card summary::-webkit-details-marker{display:none}',
'.wrec-card summary strong{color:#612a43;font-size:13px}',
'.wrec-card summary span{font-size:12px;color:#795464}',
'.wrec-details{padding:12px 14px}',
'.wrec-tablewrap{overflow-x:auto}',
'.wrec-table{border-collapse:collapse;width:100%;min-width:490px;font-size:12px}',
'.wrec-table th,.wrec-table td{padding:10px;text-align:left;border-bottom:1px solid #f0e7eb}',
'.wrec-table th{background:#fbf6f8;color:#765366}',
'.wrec-table a,.wrec-details a,.wrec-record a{color:#823756;text-decoration:underline;font-size:11px}',
'.wrec-records{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:10px}',
'.wrec-record{border:1px solid #eee4e8;border-radius:12px;padding:14px;background:#fff}',
'.wrec-record small{display:block;color:#937f89;font-size:11px}',
'.wrec-record b{display:block;color:#552438;font-size:23px;margin:9px 0}',
'.wrec-record strong{display:block;color:#5d3549;font-size:13px}',
'.wrec-source-links{display:flex;flex-wrap:wrap;gap:8px}',
'.wrec-source-links a{border:1px solid #ebdfe5;color:#863a57;border-radius:9px;padding:9px 11px;font-size:11px}',
'.wrec-leggrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px}',
'.wrec-legbox{padding:12px;background:#faf6f8;border-radius:10px;border:1px solid #eddee5}',
'.wrec-legbox small{display:block;color:#8f7782;font-size:10px}',
'.wrec-legbox strong{display:block;font-size:20px;color:#6a2d49;margin:6px 0}',
'.wrec-legbox b{font-size:12px}',
'.wrec-statline{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:#725363}',
'.wrec-statline strong{font-size:17px;color:#6a2946}'
].join('\n');
const st=document.createElement('style');st.textContent=styles;document.head.appendChild(st);
const viewH='<section class="view" id="view-racehistory"><div class="sectionhead"><div><div class="eyebrow">EKIDEN · HISTORICAL ARCHIVE</div><h2>早稻田历年驿传战绩</h2><p>按赛事与年份检索团队总成绩，展开查看区间表现</p></div></div>'+
'<div class="wrec-wrap"><h3>2024—2026 · 同区间最快（已收录范围）</h3><p class="wrec-keyline">仅比较2024、2025、2026三个已录入赛季的箱根区间，<strong>不是早稻田历代区间纪录</strong>、也不是大会区间纪录。不同赛道时期不可混排。</p><div class="wrec-leggrid" id="wrecLegBest"></div></div>'+
'<div class="wrec-wrap"><div class="wsd-open-controls">'+addBtn('ekiden')+'<small>公开协作，原始官方数据保留</small></div><div class="wrec-statline"><span>已收录赛果 <strong id="wrecTotal"></strong></span><span>箱根历史范围 <strong>1920—2026</strong></span></div>'+
'<p class="wrec-keyline">已按官网导入第1—102回箱根资料（含未参赛年份）；出云和全日本持续补录。不同年代赛道不同，不直接按用时给跨时代排名。</p>'+
'<div class="wrec-tools"><select id="wrecRace"><option value="all">三大驿传</option><option value="hak">箱根驿传</option><option value="izu">出云驿传</option><option value="zen">全日本大学驿传</option></select><select id="wrecDecade"><option value="all">全部年代</option></select><input type="search" id="wrecSearch" placeholder="搜索年份或届次，例如 2011"></div><p class="wrec-keyline" id="wrecSummary"></p><div class="wsd-open-controls"><button type="button" id="wrecExpand" class="wsd-open-btn">全部展开</button><button type="button" id="wrecCollapse" class="wsd-open-btn">全部收起</button></div><div class="wrec-cards" id="wrecList"></div><div class="wsd-open-controls"><button type="button" id="wrecMore" class="wsd-open-btn">加载更多赛事 ↓</button></div></div>'+
'<div class="wrec-wrap"><h3>箱根驿传 · 分年代原始档案</h3><p class="wrec-keyline">覆盖第1—102回的官方资料，尚未结构化录入的年份可在这里查阅。</p><div class="wrec-source-links" id="wrecArchives"></div></div>'+
</section>';
const viewS='<section class="view" id="view-schoolrecords"><div class="sectionhead"><div><div class="eyebrow">WASEDA · SCHOOL RECORDS</div><h2>田径学校纪录</h2><p>早稻田大学竞走部男子、女子各项目校纪录</p></div></div>'+
'<div class="wrec-wrap"><div class="wsd-open-controls">'+addBtn('school_record')+'</div><p class="wrec-keyline">按官网纪录室逐项整理，可按性别、项目类别或选手姓名查询。校纪录与PB排行榜、区间赏不同。</p><div class="wrec-tools"><select id="wrecGender"><option value="all">男女全部</option><option value="男">男子</option><option value="女">女子</option></select><select id="wrecCategory"><option value="all">全部项目</option><option value="长跑">中长跑／路跑</option><option value="短跑">短跑</option><option value="跨栏">跨栏／障碍</option><option value="竞走">竞走</option><option value="接力">接力</option><option value="田赛">田赛／全能</option></select><input id="wrecRecordSearch" type="search" placeholder="搜选手／项目，如5000m"></div><p class="wrec-keyline" id="wrecRecordCount"></p><div id="wrecRecordList" class="wrec-records"></div><div class="wsd-open-controls"><button type="button" id="wrecSchoolMore" class="wsd-open-btn">加载更多纪录 ↓</button></div></div>'+
'<div class="wrec-wrap"><div class="wsd-open-controls">'+addBtn('alltime_rank')+'</div><h3>各项目历代成绩排名</h3><p class="wrec-keyline">官方历代榜单按性别和项目查询；如果某个名次存在并列或官网排版无法判断，则保留可核实条目，不自行推定排名。</p><div class="wrec-tools"><select id="wrecRankGender"><option value="男">男子</option><option value="女">女子</option></select><select id="wrecRankEvent"><option value="">选择比赛项目</option></select></div><p class="wrec-keyline" id="wrecRankSummary"></p><div class="wrec-tablewrap" id="wrecRankList"></div></div>'+
'<div class="wrec-wrap"><h3>历代Top 10 · 官网完整榜单</h3><p class="wrec-keyline">目前本站优先录入各项目校纪录。历代Top 10尚未全部结构化完成，可通过官网核对。</p><div class="wrec-source-links"><a href="https://waseda-ac.jp/record/detail/2" target="_blank" rel="noopener noreferrer">男子历代排行榜 ↗</a><a href="https://waseda-ac.jp/record/detail/3" target="_blank" rel="noopener noreferrer">女子历代排行榜 ↗</a><a href="https://waseda-ac.jp/record/" target="_blank" rel="noopener noreferrer">官网纪录室 ↗</a></div></div></section>';
host.insertAdjacentHTML('beforebegin',viewH+viewS);
navItems.push(['racehistory','历年驿传战绩','◫'],['schoolrecords','学校纪录','✦']);
if(typeof NAV_GROUPS!=='undefined'){
 const index=NAV_GROUPS.findIndex(x=>x.id==='analysis');
 NAV_GROUPS.splice(index<0?3:index,0,{id:'records',title:'驿传与学校纪录',icon:'◫',items:['races','racehistory','schoolrecords']});
 const analysis=NAV_GROUPS.find(x=>x.id==='analysis');if(analysis)analysis.items=analysis.items.filter(x=>x!=='races');
 NAV_LABELS.racehistory='历年驿传战绩';NAV_LABELS.schoolrecords='田径校纪录';NAV_LABELS.races='2026 驿传分析';
}
setupNav();
for(let y=1920;y<=2020;y+=10){const el=document.createElement('option');el.value=String(y);el.textContent=y+'年代';$('wrecDecade').appendChild(el);}
$('wrecArchives').innerHTML=decs.map((id,i)=>'<a href="https://waseda-ac.jp/record/detail/'+id+'" target="_blank" rel="noopener noreferrer">第'+(i*10+1)+'—'+((i+1)*10)+'回 ↗</a>').join('');
function legsHtml(r){
 if(!r.legs?.length)return '<p class="wrec-keyline">此届逐区数据暂未入库，可前往官网查看。</p>';
 return '<div class="wrec-tablewrap"><table class="wrec-table"><thead><tr><th>区间</th><th>选手</th><th>距离</th><th>成绩</th><th>区间名次</th></tr></thead><tbody>'+r.legs.map(l=>'<tr><td>'+l.leg+'区</td><td>'+esc(l.name)+'</td><td>'+esc(l.km||'—')+' km</td><td>'+esc(l.time)+'</td><td>'+((l.rank!=null)?'第'+l.rank+'名':'—')+'</td></tr>').join('')+'</tbody></table></div>';
}
function renderHistory(){
 const t=$('wrecRace').value,y=$('wrecSearch').value.trim(),d=$('wrecDecade').value;
 const all=archiveHistory().sort((a,b)=>b.year-a.year);
 const filtered=all.filter(r=>(t==='all'||r.race===t)&&(d==='all'||r.year>=Number(d)&&r.year<Number(d)+10)&&(!y||String(r.year).includes(y)||String(r.edition||'').includes(y)));
 $('wrecTotal').textContent=all.filter(x=>x.total).length;
 $('wrecSummary').textContent='显示 '+Math.min(historyLimit,filtered.length)+' / '+filtered.length+' 条筛选记录，共 '+all.length+' 条';
 $('wrecMore').hidden=filtered.length<=historyLimit;
 $('wrecList').innerHTML=filtered.slice(0,historyLimit).map((r,i)=>'<details class="wrec-card"><summary><strong>'+r.year+' · '+esc(raceNames[r.race])+(r.edition?'（第'+r.edition+'回）':'')+'</strong><span>'+(r.status==='not_participated'?'未参赛':'第'+r.rank+'名　'+esc(r.total))+'　⌄</span></summary><div class="wrec-details">'+(r.out?'<p class="wrec-keyline">往路：'+esc(r.out)+' · 复路：'+esc(r.back)+'</p>':'')+(r.status==='not_participated'?'<p class="wrec-keyline">'+esc(r.reason||'未参赛')+'</p>':legsHtml(r))+(r.source_format_note?'<p class="wrec-keyline">'+esc(r.source_format_note)+'</p>':'')+'<p class="wrec-keyline">'+urlLink(r.source)+'</p><div class="wsd-open-controls">'+editBtn('ekiden',r._editKey)+'</div></div></details>').join('')||'<p class="wrec-keyline">此筛选暂无已录入记录，其他年份可查看官网原始档案。</p>';
}
function renderLegBest(){
 const rows=archiveHistory().filter(r=>r.race==='hak'&&r.year>=2024&&r.year<=2026&&r.legs?.length===10);
 let items=[];
 for(let i=1;i<=10;i++){
  const candidates=rows.map(r=>({year:r.year,l:r.legs.find(x=>x.leg===i)})).filter(x=>x.l?.time);
  candidates.sort((a,b)=>toSec(a.l.time)-toSec(b.l.time));
  if(candidates.length)items.push({leg:i,...candidates[0]});
 }
 $('wrecLegBest').innerHTML=items.map(x=>'<div class="wrec-legbox"><small>'+x.leg+'区 · '+esc(x.l.km)+'km</small><strong>'+esc(x.l.time)+'</strong><b>'+esc(x.l.name)+'</b><small>'+x.year+'年 / 区间第'+x.l.rank+'名</small></div>').join('');
}
function category(ev){
 if(/竞走|mW|kmW/.test(ev))return '竞走';
 if(/×/.test(ev))return '接力';
 if(/H|SC/.test(ev))return '跨栏';
 if(/跳|投|铅球|铁饼|链球|标枪|全能/.test(ev))return '田赛';
 if(/^(100m|200m|300m|400m)$/.test(ev))return '短跑';
 return '长跑';
}
function renderSchool(){
 const g=$('wrecGender').value,c=$('wrecCategory').value,q=$('wrecRecordSearch').value.trim().toLowerCase();
 const base=archiveSchools();
 const rows=base.filter(r=>(g==='all'||r.gender===g)&&(c==='all'||category(r.event)===c)&&(!q||(r.event+' '+r.athlete).toLowerCase().includes(q)));
 $('wrecRecordCount').textContent='显示 '+Math.min(schoolLimit,rows.length)+' / '+rows.length+' 条学校纪录';
 $('wrecSchoolMore').hidden=rows.length<=schoolLimit;
 $('wrecRecordList').innerHTML=rows.slice(0,schoolLimit).map(r=>'<article class="wrec-record"><small>'+esc(r.gender)+'子 · '+esc(r.event)+'</small><b>'+esc(r.performance)+'</b><strong>'+esc(r.athlete)+'</strong><small>'+esc(r.date)+'</small>'+urlLink(r.source||'https://waseda-ac.jp/record/')+(r.sourceNote?'<small>'+esc(r.sourceNote)+'</small>':'')+'<div class="wsd-open-controls">'+editBtn('school_record',r._editKey)+'</div></article>').join('')||'<p class="wrec-keyline">没有匹配纪录。</p>';
}

function renderAlltimeRanking(){
 const sex=$('wrecRankGender').value, list=archiveRankings();
 const events=[...new Set(list.filter(r=>r.gender===sex).map(r=>r.event))].sort((a,b)=>a.localeCompare(b,'ja'));
 const select=$('wrecRankEvent'),previous=select.value;
 select.innerHTML=events.map(e=>'<option value="'+esc(e)+'">'+esc(e)+'</option>').join('');
 if(events.includes(previous))select.value=previous;
 else{
  const first=events.find(x=>x==='5000m')||events.find(x=>x==='1500m')||events[0];
  if(first)select.value=first;
 }
 const event=select.value,rows=list.filter(r=>r.gender===sex&&r.event===event)
  .sort((a,b)=>a.rank-b.rank||a.year-b.year);
 $('wrecRankSummary').textContent=events.length?'已收录'+events.length+'个项目的历代排名；当前 '+(sex==='男'?'男子':'女子')+' '+event+' · '+rows.length+'条成绩':'历代排名列表尚未完成本地导入，请使用下方官方榜单链接。';
 $('wrecRankList').innerHTML=rows.length?'<table class="wrec-table"><thead><tr><th>校内排名</th><th>选手</th><th>成绩</th><th>年份</th><th>操作</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.rank+'</td><td>'+esc(r.athlete)+'</td><td>'+esc(r.performance)+'</td><td>'+r.year+'</td><td>'+editBtn('alltime_rank',r._editKey)+'</td></tr>').join('')+'</tbody></table>':'<p class="wrec-keyline">此筛选尚无已经核实的历代名次。</p>';
}
['wrecRace','wrecDecade'].forEach(id=>$(id).addEventListener('change',()=>{historyLimit=20;renderHistory();}));
$('wrecMore').onclick=()=>{historyLimit+=20;renderHistory();};
$('wrecExpand').onclick=()=>{$('wrecList').querySelectorAll('details.wrec-card').forEach(x=>x.open=true);};
$('wrecCollapse').onclick=()=>{$('wrecList').querySelectorAll('details.wrec-card').forEach(x=>x.open=false);};
$('wrecSchoolMore').onclick=()=>{schoolLimit+=20;renderSchool();};
window.addEventListener('wsd-open-archive-change',()=>{renderHistory();renderLegBest();renderSchool();renderAlltimeRanking();});
$('wrecSearch').addEventListener('input',()=>{historyLimit=20;renderHistory();});
['wrecGender','wrecCategory'].forEach(id=>$(id).addEventListener('change',()=>{schoolLimit=20;renderSchool();}));
$('wrecRecordSearch').addEventListener('input',()=>{schoolLimit=20;renderSchool();});
$('wrecRankGender').addEventListener('change',()=>{ $('wrecRankEvent').value='';renderAlltimeRanking(); });
$('wrecRankEvent').addEventListener('change',renderAlltimeRanking);
renderHistory();renderLegBest();renderSchool();renderAlltimeRanking();
if(location.hash==='#racehistory')show('racehistory');
if(location.hash==='#schoolrecords')show('schoolrecords');
})();