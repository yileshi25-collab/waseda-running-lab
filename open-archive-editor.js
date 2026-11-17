/* Public collaborative edits for history, school records and OB results. */
(async function(){
"use strict";
const cfg=window.WSD_COMMUNITY_CONFIG;
if(!cfg?.url||!cfg?.publishableKey)return;
let mod;try{mod=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");}
catch(e){console.error("Editor SDK",e);return;}
const db=mod.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $=id=>document.getElementById(id);
const names={ob_result:"OB／选手比赛成绩",ekiden:"驿传战绩",school_record:"学校纪录",alltime_rank:"历代排名"};
const fields={
ob_result:[["name","选手姓名","text",1],["year","年份","number",1],["date","比赛日期","date",1],["meet","赛事名称","text",1],["event","项目／区间","text",1],["time","成绩","text",1],["rank","名次","number"],["status","比赛时身份","select",1,["OB","student"]],["link","HTTPS来源","url"],["stage","备注","text"]],
ekiden:[["year","年份","number",1],["race","赛事","select",1,["hak","izu","zen"]],["edition","届次","number"],["rank","总名次","number"],["total","团队总成绩","text"],["out","往路（箱根）","text"],["back","复路（箱根）","text"],["source","HTTPS来源","url"],["legs_text","各区：区号｜姓名｜公里｜时间｜区间名次（每行一条）","textarea"]],
school_record:[["gender","性别","select",1,["男","女"]],["event","项目","text",1],["performance","纪录","text",1],["athlete","保持者","text",1],["date","创造日期","text"],["source","HTTPS来源","url"]],
alltime_rank:[["gender","性别","select",1,["男","女"]],["event","项目","text",1],["rank","历史名次","number",1],["performance","成绩","text",1],["athlete","选手","text",1],["year","纪录年份","number",1],["source","HTTPS来源","url"]]
};
let edits=[],ready=false,active=null;
const keyOb=r=>"ob:"+[r.name,r.date,r.meet,r.event,r.time].map(x=>String(x||"").trim()).join("|").slice(0,178);
const keyEk=r=>"race:"+r.race+":"+r.year;
const keySchool=r=>"school:"+r.gender+":"+r.event;
const keyRank=r=>"rank:"+r.gender+":"+r.event+":"+r.rank+":"+r.athlete;
const get=(kind,key)=>edits.find(x=>x.entity_type===kind&&x.record_key===key);
function base(kind,key){
const d=window.WSD_OFFICIAL_RECORDS||{};
if(kind==="ekiden")return [...(d.hakone||[]).map(r=>({...r,race:"hak"})),...(d.otherEkiden||[]).map(r=>({...r,race:r.type}))].find(r=>keyEk(r)===key)||{};
if(kind==="school_record")return(d.school||[]).find(r=>keySchool(r)===key)||{};
if(kind==="alltime_rank")return(d.rankings||[]).find(r=>keyRank(r)===key)||{};
if(kind==="ob_result"){
const old=window.WSD_HISTORY_RECORDS||[];
const extra=(window.WSD_2025_ARCHIVE_ROWS||[]).map(r=>({name:r.name,date:r.date,year:2025,meet:r.event,event:r.metric,time:r.time,rank:r.rank,status:"student",link:r.source,stage:r.note}));
return[...old,...extra].find(r=>keyOb(r)===key)||{};
}
return{};
}
window.WSD_OPEN_ARCHIVE={
keyOb,keyEk,keySchool,keyRank,
get loaded(){return ready},
get rows(){return edits.slice()},
patch(kind,original,keyFn){
const seen=new Set(),result=[];
for(const obj of original){
const key=keyFn(obj),edit=get(kind,key);
if(edit){seen.add(key);if(!edit.is_deleted)result.push({...obj,...edit.payload,_editKey:key,_edited:true});}
else result.push({...obj,_editKey:key});
}
for(const edit of edits){if(edit.entity_type!==kind||seen.has(edit.record_key)||!edit.record_key.startsWith("new:")||edit.is_deleted)continue;
result.push({...edit.payload,_editKey:edit.record_key,_edited:true,_new:true});}
return result;
},
open:(kind,key)=>open(kind,key)
};
const style=document.createElement("style");
style.textContent=[
".wsd-open-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:11px 0}",
".wsd-open-btn{border:1px solid #b88ca1;background:#fff;color:#742d4c;border-radius:9px;padding:9px 11px;font-size:11px;font-weight:750;cursor:pointer}",
".wsd-open-btn:hover{background:#faf0f5}",
".wsd-open-btn.danger{color:#b33047;border-color:#e1abba}",
".wsd-edit-modal{border:0;padding:0;background:transparent;width:min(680px,96vw);max-height:90vh}",
".wsd-edit-modal::backdrop{background:rgba(31,15,24,.67)}",
".wsd-edit-sheet{background:white;border-radius:16px;padding:22px;overflow:auto;max-height:89vh}",
".wsd-edit-sheet h3{margin:0 0 10px;color:#55273d}",
".wsd-edit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:12px;margin:16px 0}",
".wsd-edit-grid label{font-size:11px;color:#745361;font-weight:700;display:flex;flex-direction:column;gap:5px}",
".wsd-edit-grid input,.wsd-edit-grid select,.wsd-edit-grid textarea{width:100%;min-width:0;border:1px solid #d8c4cf;border-radius:9px;background:#fff;padding:10px;font-size:13px}",
".wsd-edit-grid .full{grid-column:1/-1}",
".wsd-edit-grid textarea{min-height:110px}",
".wsd-edit-actions{display:flex;flex-wrap:wrap;gap:8px}",
".wsd-edit-help,.wsd-edit-status{font-size:11px;color:#846d79;line-height:1.85}",
"@media(max-width:500px){.wsd-edit-grid{grid-template-columns:1fr}.wsd-edit-sheet{padding:15px}}"
].join("\n");
document.head.appendChild(style);
const dlg=document.createElement("dialog");dlg.className="wsd-edit-modal";
dlg.innerHTML='<div class="wsd-edit-sheet"><h3 id="wsdEditTitle"></h3><p class="wsd-edit-help">所有访客均可新增、修改、删除（可恢复）数据。历史版本会保留，请尽量附官方来源。</p><form id="wsdEditForm"><div id="wsdEditGrid" class="wsd-edit-grid"></div><p id="wsdEditStatus" class="wsd-edit-status" role="status"></p><div class="wsd-edit-actions"><button type="submit" class="wsd-open-btn">保存</button><button type="button" class="wsd-open-btn danger" id="wsdDelete">删除</button><button type="button" class="wsd-open-btn" id="wsdRestore">恢复</button><button type="button" class="wsd-open-btn" id="wsdClose">取消</button></div></form></div>';
document.body.appendChild(dlg);
function fieldHtml([key,label,type,required,options],value){
const mark=required?" required":"",valueStr=esc(value??"");
if(type==="select")return '<label>'+esc(label)+'<select name="'+key+'"'+mark+'>'+options.map(o=>'<option value="'+esc(o)+'"'+(String(value??"")===o?" selected":"")+'>'+esc(({hak:"箱根",izu:"出云",zen:"全日本",student:"在校",OB:"毕业后"}[o]||o))+'</option>').join("")+'</select></label>';
if(type==="textarea")return '<label class="full">'+esc(label)+'<textarea name="'+key+'" maxlength="3000">'+valueStr+'</textarea></label>';
return '<label'+(type==="url"?' class="full"':'')+'>'+esc(label)+'<input name="'+key+'" type="'+(type==="number"||type==="url"||type==="date"?type:"text")+'" value="'+valueStr+'" maxlength="500"'+(type==="number"?' min="0" step="1"':'')+mark+'></label>';
}
function merged(kind,key){const e=get(kind,key);return e?{...base(kind,key),...e.payload}:base(kind,key);}
function open(kind,key=""){
if(!fields[kind])return;
active={kind,key};
const obj=key?merged(kind,key):{};
const values={...obj};
if(kind==="ekiden")values.legs_text=(obj.legs||[]).map(x=>[x.leg,x.name,x.km??"",x.time,x.rank??""].join(" | ")).join("\n");
$("wsdEditTitle").textContent=(key?"修改／恢复 ":"新增 ")+names[kind];
$("wsdEditGrid").innerHTML=fields[kind].map(row=>fieldHtml(row,values[row[0]])).join("");
$("wsdEditStatus").textContent=ready?"保存后页面将同步更新，历史版本可追溯。":"数据库尚未连接，请刷新重试。";
$("wsdDelete").hidden=!key||!!get(kind,key)?.is_deleted;
$("wsdRestore").hidden=!get(kind,key)?.is_deleted;
dlg.showModal();
}
function parse(kind,form){
const data=new FormData(form),out={};
for(const [key,label,type,required] of fields[kind]){
if(key==="legs_text")continue;
const v=String(data.get(key)??"").trim();
if(required&&!v)throw Error("请填写"+label);
if(v.length>480)throw Error(label+"过长");
if(type==="url"&&v&&(!/^https:\/\/[^\s/]+\.[^\s/]+/.test(v)))throw Error("来源链接必须是HTTPS网址");
if(type==="number"){out[key]=v===""?null:Number(v);if(out[key]!=null&&(!Number.isInteger(out[key])||out[key]<0||out[key]>99999))throw Error(label+"不正确");}
else out[key]=v;
}
if(kind==="ob_result"&&(!/^\d{4}-\d{2}-\d{2}$/.test(out.date)||Number(out.date.slice(0,4))!==out.year))throw Error("请填写与比赛年份一致的完整日期");
if(kind==="ekiden"){
if(out.year<1920||out.year>2100)throw Error("驿传年份应在1920至2100之间");
const text=String(data.get("legs_text")||"").trim();
out.legs=text?text.split(/\r?\n/).filter(Boolean).map((line,i)=>{
const p=line.split(/[|｜]/).map(x=>x.trim());
if(p.length!==5)throw Error("第"+(i+1)+"行区间必须有5列");
const leg=Number(p[0]),km=p[2]?Number(p[2]):null,rank=p[4]?Number(p[4]):null;
if(!Number.isInteger(leg)||leg<1||leg>10||!p[1]||!p[3]||km!=null&&(!Number.isFinite(km)||km<0)||rank!=null&&(!Number.isInteger(rank)||rank<1))throw Error("第"+(i+1)+"行区间内容有误");
return {leg,name:p[1],km,time:p[3],rank};
}):[];
}
if(kind==="alltime_rank"&&(out.rank<1||out.rank>100||out.year<1900||out.year>2100))throw Error("历代排名/年份不正确");
return out;
}
async function reload(){
const {data,error}=await db.from("wsd_open_archive_edits").select("entity_type,record_key,payload,is_deleted,updated_at").order("updated_at",{ascending:false}).limit(4000);
if(error)throw error;
edits=data||[];ready=true;window.dispatchEvent(new Event("wsd-open-archive-change"));
}
async function save(kind,key,payload,deleted){
if(!ready)throw Error("协作数据库暂不可用");
const present=get(kind,key);
const q=present?db.from("wsd_open_archive_edits").update({payload,is_deleted:deleted}).eq("entity_type",kind).eq("record_key",key):db.from("wsd_open_archive_edits").insert({entity_type:kind,record_key:key,payload,is_deleted:deleted});
const {error}=await q;if(error)throw error;
await reload();
}
$("wsdEditForm").addEventListener("submit",async e=>{
e.preventDefault();const btn=e.target.querySelector('[type="submit"]');btn.disabled=true;
try{const payload=parse(active.kind,e.target);await save(active.kind,active.key||"new:"+crypto.randomUUID(),payload,false);dlg.close();}
catch(err){$("wsdEditStatus").textContent="保存失败："+err.message;}
finally{btn.disabled=false;}
});
$("wsdDelete").onclick=async()=>{if(!confirm("确定删除此条记录？可以恢复，历史版本不会丢失。"))return;
try{await save(active.kind,active.key,merged(active.kind,active.key),true);dlg.close();}
catch(err){$("wsdEditStatus").textContent="删除失败："+err.message;}};
$("wsdRestore").onclick=async()=>{try{await save(active.kind,active.key,merged(active.kind,active.key),false);dlg.close();}catch(err){$("wsdEditStatus").textContent="恢复失败："+err.message;}};
$("wsdClose").onclick=()=>dlg.close();
document.addEventListener("click",e=>{
const add=e.target.closest("[data-wsd-new]");if(add){e.preventDefault();open(add.dataset.wsdNew);return;}
const edit=e.target.closest("[data-wsd-edit]");if(edit){e.preventDefault();open(edit.dataset.wsdEdit,edit.dataset.wsdKey);}
});
// Public recovery list: soft-deleted rows stay accessible for restoration.
const recovery=document.createElement("section");
recovery.id="wsdArchiveRecovery";
recovery.className="wsd-edit-recovery";
recovery.innerHTML='<details><summary>最近删除的资料 · 恢复入口</summary><div id="wsdArchiveRecoveryList"></div></details>';
const targetSection=document.getElementById("view-obarchive");
if(targetSection)targetSection.appendChild(recovery);
const recoveryStyle=document.createElement("style");
recoveryStyle.textContent=".wsd-edit-recovery{border:1px solid #e6d8df;border-radius:10px;padding:12px;margin:25px 0;background:#fff}.wsd-edit-recovery summary{cursor:pointer;font-size:12px;font-weight:750;color:#7b3654}.wsd-edit-recovery p{font-size:11px;color:#876e7c}.wsd-recovery-item{display:flex;align-items:center;justify-content:space-between;gap:9px;border-bottom:1px solid #eee5e9;padding:8px 0;font-size:11px;flex-wrap:wrap}";
document.head.appendChild(recoveryStyle);
function refreshRecovery(){
const list=$("wsdArchiveRecoveryList");if(!list)return;
const deleted=edits.filter(x=>x.is_deleted).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))).slice(0,80);
list.innerHTML=deleted.length?deleted.map(x=>'<div class="wsd-recovery-item"><span>'+esc(names[x.entity_type])+' · '+esc(String(x.record_key).slice(0,65))+'</span><button type="button" class="wsd-open-btn" data-wsd-edit="'+esc(x.entity_type)+'" data-wsd-key="'+esc(x.record_key)+'">查看／恢复</button></div>').join(""):'<p>暂无删除记录。</p>';
}
window.addEventListener("wsd-open-archive-change",refreshRecovery);
try{await reload();}catch(e){console.error("Archive editor data unavailable",e);}
window.addEventListener("focus",()=>{if(ready)reload().catch(()=>{});});
setInterval(()=>{if(ready&&!document.hidden)reload().catch(()=>{});},90000);
})();