/* Waseda Running Lab community extension.
 * GitHub Pages is read-only. Posts are stored in Supabase.
 * Only publishable credentials belong in community-config.js.
 * Authorization & limits belong to the database (supabase/community.sql).
 */
(async function () {
  "use strict";
  const root = document.getElementById("wsdCommunityRoot");
  if (!root) return;
  const cfg = window.WSD_COMMUNITY_CONFIG || {};
  function safePublicKey(key) {
    if (typeof key!=="string" || key.length<=30 || key.startsWith("sb_secret_")) return false;
    if (key.startsWith("sb_publishable_")) return true;
    // Historical Supabase "anon" keys are JWTs; reject any service_role JWT.
    try {
      const part = key.split(".")[1];
      if (!part) return false;
      const raw = atob(part.replace(/-/g,"+").replace(/_/g,"/"));
      return JSON.parse(raw).role === "anon";
    } catch { return false; }
  }
  const TABLE = "wsd_community_submissions";
  const BUCKET = "wsd-community-photos";
  const REPORTS = "wsd_community_reports";
  const CORRECTIONS = "wsd_community_date_corrections";
  const EDITORIAL = "wsd_community_editorial";
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g,
    c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const https = s => {
    try { const x = new URL(s);return x.protocol==="https:" && !x.username && !x.password && s.length<=400; }
    catch { return false; }
  };
  const note = (s,bad=false) => { const x=$("wsdCommunityStatus"); if(x){x.textContent=s;x.style.color=bad?"#b33659":"#755163";} };
  root.innerHTML = '<div class="wsd-community-grid">'+
    '<section class="wsd-community-panel"><h3>发布比赛成绩或照片</h3><p>访客可以直接浏览。使用 Google 登录后即可投稿，发布后自动公开。投稿不会自动覆盖官方成绩或 PB。</p>'+
      '<div id="wsdSetup" class="wsd-community-alert" hidden></div>'+
      '<div id="wsdAuth" hidden>'+
        '<div class="wsd-community-auth-line"><strong id="wsdAuthName">未登录</strong><button class="btn btn-small" type="button" id="wsdSignOut" hidden>退出登录</button></div>'+
        '<div id="wsdLogin" class="wsd-auth-mode">'+
          '<button id="wsdGoogleSignIn" type="button" class="btn btn-primary wsd-google-button"><span class="wsd-google-symbol" aria-hidden="true">G</span> 使用 Google 账号登录</button>'+
          '<p>使用 Google 账号验证身份。登录后自动返回此网站，上传成绩与有权分享的照片。首次使用前，网站管理员须在 Supabase 启用 Google Provider。</p>'+
          '<p><a href="https://github.com/yileshi25-collab/waseda-running-lab/blob/main/GOOGLE-OAUTH-SETUP.md" target="_blank" rel="noopener noreferrer">Google 登录启用指南 ↗</a></p></div>'+
        '<form id="wsdSubmitForm" class="wsd-community-form" hidden>'+
          '<label>投稿类型<select id="wsdKind"><option value="race">比赛成绩</option><option value="photo">选手照片</option></select></label>'+
          '<label>投稿署名<input id="wsdDisplayName" maxlength="30" minlength="2" required value="早稻田跑友"></label>'+
          '<label>选手姓名<input id="wsdAthlete" list="wsdAthleteNames" maxlength="75" required placeholder="按日文姓名检索／输入"></label><datalist id="wsdAthleteNames"></datalist>'+
          '<div id="wsdRaceFields" class="wsd-community-form">'+
            '<label>比赛项目<input id="wsdEvent" maxlength="80" placeholder="1500m / 5000m / 箱根驿传 4区"></label>'+
            '<label>赛事名称（选填）<input id="wsdMeet" maxlength="120" placeholder="例如：全国高校综合体育大会"></label>'+
            '<label>成绩所属阶段<select id="wsdCareerStage"><option value="university">大学</option><option value="high_school">高中</option><option value="junior_high">初中</option><option value="elementary">小学</option><option value="other">其他／待核实</option></select></label>'+
            '<label>当时就读学校／队伍（选填）<input id="wsdSchool" maxlength="100" placeholder="例如：某某高校／中学"></label>'+
            '<label>比赛日期<input id="wsdRaceDate" type="date" min="1990-01-01"></label>'+
            '<label>成绩<input id="wsdTime" maxlength="20" placeholder="13:45.12 或 1:02:36"></label>'+
            '<label>名次（可选）<input id="wsdRank" type="number" min="1" max="50000"></label>'+
          '</div><div id="wsdPhotoFields" class="wsd-community-form" hidden>'+
            '<label>照片（JPEG、PNG、WebP；输入 ≤6MB，输出 JPEG ≤2MB）<input id="wsdPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label>'+
            '<label>摄影者 / 来源署名<input id="wsdCredit" maxlength="120"></label>'+
            '<label>使用依据<select id="wsdLicense"><option value="own">本人拍摄，允许网站公开</option><option value="permission">获得原摄影者明确许可</option><option value="cc-by">CC BY 可再分发</option><option value="public-domain">公共领域</option></select></label>'+
          '</div>'+
          '<label>来源链接（比赛成绩必填，照片选填；HTTPS）<input id="wsdSource" type="url" maxlength="400" placeholder="https://..."></label>'+
          '<label>补充说明<input id="wsdNotes" maxlength="500" placeholder="可填赛事轮次、出处或授权说明；不要填隐私"></label>'+
          '<label class="wsd-community-tick"><input type="checkbox" id="wsdRights" required><span>我确认成绩与来源真实、拥有照片公开权限，未包含私人信息，同意立即公开及接受举报。</span></label>'+
          '<button type="submit" class="btn btn-primary" id="wsdPublish">发布后立即公开</button>'+
        '</form>'+
      '</div>'+
      '<div class="wsd-community-status" id="wsdCommunityStatus" role="status" aria-live="polite"></div>'+
      '<p class="wsd-community-help">Google 账号登录后可以连续上传照片和比赛成绩，不设每分钟、每小时或每天的投稿次数上限。图片限制大小并重新编码以清除位置元数据。作者可删除自己的投稿，管理员可删除任何投稿；违规内容也可举报。</p>'+
    '</section><section class="wsd-community-panel"><div class="wsd-community-top">'+
    '<h3>跑友实时投稿</h3><select id="wsdFeedKind" aria-label="筛选投稿"><option value="all">所有投稿</option><option value="race">比赛成绩</option><option value="photo">人物照片</option><option value="editorial">采访／总结／日志</option></select></div>'+
    '<div class="wsd-community-feed" id="wsdFeed"><div class="wsd-community-skeleton">正在准备投稿列表…</div></div>'+
    '<p class="wsd-community-help">社区投稿不等于官方认证。请核对比赛原始来源；若发现错误、侵权或隐私问题，请举报。</p>'+
    '<section id="wsdBulkPanel" hidden style="margin:18px 0;padding:16px;border:1px solid #e4cfd7;border-radius:12px"><h3>管理员 · 批量导入个人比赛成绩（CSV）</h3><p>仅管理员可导入。CSV 表头：athlete_name,meet_name,event_name,race_date,result_time,rank,source_url,career_stage,school_name,notes。必填：选手、赛事、项目、日期、成绩、来源。</p><button type="button" class="btn btn-small" id="wsdBulkTemplate">下载 CSV 模板</button> <input type="file" id="wsdBulkFile" accept=".csv,text/csv" aria-label="选择比赛成绩CSV"><div id="wsdBulkPreview" style="margin-top:10px;max-height:320px;overflow:auto"></div><button type="button" class="btn btn-small" id="wsdBulkImport" disabled>确认导入有效记录</button><p id="wsdBulkStatus" role="status"></p></section>'+ 
    '<div id="wsdAdminSummary" class="wsd-admin-indicator"></div>'+
    '</section></div>';
  const setup = $("wsdSetup");
  if (!(cfg.enabled===true && https(cfg.url) && safePublicKey(cfg.publishableKey))) {
    setup.hidden=false;
    setup.innerHTML = '协作上传尚未开启：需要先安装数据库并填写 Supabase 公共配置。<a href="https://github.com/yileshi25-collab/waseda-running-lab/blob/main/COMMUNITY-SETUP.md" target="_blank" rel="noopener noreferrer">启用步骤 ↗</a>';
    $("wsdFeed").innerHTML='<div class="wsd-community-skeleton">未配置后端。原有网站和赛果仍可正常使用。</div>';
    return;
  }
  let createClient;
  try { ({createClient} = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")); }
  catch { note("数据库组件加载失败，请检查网络连接。",true);return; }
  const sb=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let user=null,admin=false,posts=[],active="all";
  let ownPostIds=new Set(),ownCorrectionIds=new Set(),corrections=[],deleting=false;
  let editorial=[],ownEditorialIds=new Set();
  async function loadOwnPostIds(){
    if(!user){ownPostIds=new Set();return;}
    // The public feed does not expose author UUIDs. This RPC returns
    // ONLY IDs owned by the currently signed-in account.
    const {data,error}=await sb.rpc("wsd_my_submission_ids");
    if(error){ownPostIds=new Set();note("读取自己的投稿列表失败："+error.message,true);return;}
    ownPostIds=new Set((data||[]).map(v=>
      typeof v==="string"?v:v?.wsd_my_submission_ids).filter(Boolean));
  }
  async function loadOwnCorrectionIds(){
    if(!user){ownCorrectionIds=new Set();return;}
    const {data,error}=await sb.rpc("wsd_my_date_correction_ids");
    if(error){ownCorrectionIds=new Set();note("读取日期修正权限失败："+error.message,true);return;}
    ownCorrectionIds=new Set((data||[]).map(x=>x?.id).filter(Boolean));
  }
  async function loadOwnEditorialIds(){
    if(!user){ownEditorialIds=new Set();return;}
    const {data,error}=await sb.rpc("wsd_my_editorial_ids");
    if(error){ownEditorialIds=new Set();note("读取个人文字投稿权限失败："+error.message,true);return;}
    ownEditorialIds=new Set((data||[]).map(x=>x?.id).filter(Boolean));
  }
  const editorialCategories={bio:"选手简介",interview:"采访",summary:"赛后总结",diary:"部员日志",
    article:"相关文章／相关新闻",analysis:"赛事分析",other:"其他补充"};
  function canDeleteEditorial(row){
    return !!user&&(admin||ownEditorialIds.has(row.id));
  }
  function publicEditorialEntries(scope,name,raceRef){
    return editorial.filter(r=>r.scope===scope&&resolveAthleteName(r.athlete_name)===name&&
      (scope==="bio"||r.race_ref===raceRef));
  }
  function editorialEntryHTML(row){
    return '<article class="wsd-editorial-entry">'+
      '<div class="wsd-editorial-entry-head"><span class="wsd-editorial-tag">'+
        esc(editorialCategories[row.category]||"补充资料")+'</span>'+
        '<small>'+esc(row.display_name)+' · '+new Date(row.created_at).toLocaleDateString("zh-CN")+'</small></div>'+
      '<strong>'+esc(row.title)+'</strong>'+
      (row.body?'<p class="wsd-editorial-body">'+esc(row.body)+'</p>':"")+
      (https(row.source_url||"")?'<a href="'+esc(row.source_url)+'" rel="noopener noreferrer nofollow" target="_blank">阅读采访／原文链接 ↗</a>':"")+
      (canDeleteEditorial(row)?'<button type="button" class="wsd-editorial-delete" data-wsd-editorial-delete="'+esc(row.id)+'">删除这条补充</button>':"")+
      '</article>';
  }
  function editorialAddButton(scope,name,raceRef,label){
    return user?
      '<button type="button" class="wsd-editorial-add" data-wsd-editorial-add="'+scope+'" data-wsd-athlete="'+esc(name)+'"'+
      (raceRef?' data-wsd-race-ref="'+esc(raceRef)+'"':"")+'>'+esc(label)+'</button>':
      '<small class="wsd-editorial-guest">登录 Google 后可补充链接或文字。</small>';
  }
  function decorateBio(name,head){
    const body=$("detailBody");
    if(!body||!head)return;
    let panel=body.querySelector(".wsd-community-gallery.wsd-athlete-bio");
    if(panel&&panel.dataset.wsdAthlete!==name){panel.remove();panel=null;}
    if(!panel){
      panel=document.createElement("section");
      panel.className="wsd-community-gallery wsd-athlete-bio";
      panel.dataset.wsdAthlete=name;
      const basicProfile=body.querySelector(".wsd-athlete-bio:not(.wsd-community-gallery)");
      (basicProfile||head).after(panel);
    }
    const raceRows=careerHistoryFor(name).rows;
    const raceByRef=new Map(raceRows.filter(x=>x.raceRef).map(x=>[x.raceRef,x]));
    const entries=[...publicEditorialEntries("bio",name,null),...editorial.filter(x=>x.scope==="race"&&resolveAthleteName(x.athlete_name)===name)];
    const sig=entries.map(x=>x.id).join(",")+"|"+[...ownEditorialIds].join(",")+"|"+admin+"|"+!!user;
    if(panel.dataset.wsdEditorialSignature===sig||panel.querySelector("[data-wsd-editorial-form]"))return;
    const groups=[["bio","选手介绍","个人经历、跑步背景"],["diary","部员日志","训练日记、部员感想"],["interview","选手采访","官方采访、媒体专访"],["summary","赛后总结","比赛回顾、赛后感想"],["article","相关文章／相关新闻","新闻报道、专题文章"],["analysis","赛事分析","表现分析、跑友观察"],["other","其他补充","其他选手相关资料"]];
    panel.innerHTML='<div class="wsd-athlete-photo-heading"><h4>选手资料 · ATHLETE LIBRARY</h4>'+
      '<span>'+entries.length+' 条资料</span></div>'+
      groups.map(([category,label,description],i)=>{
        const list=entries.filter(x=>x.category===category);
        return '<details class="wsd-athlete-editorial-group" data-wsd-editorial-group="'+category+'" '+(i===0?'open':"")+' style="border-top:1px solid #eee1e6;padding:9px 0">'+
          '<summary style="cursor:pointer;font-weight:700;padding:5px 0">'+esc(label)+' <small style="font-weight:400;color:#96818b;margin-left:8px">'+esc(description)+'</small> · '+list.length+' 条</summary>'+
          (list.length?list.map(x=>{
            const race=x.scope==="race"?raceByRef.get(x.race_ref):null;
            return editorialEntryHTML(x)+(x.scope==="race"?'<div class="wsd-editorial-race-context" style="font-size:11px;color:#806d76;margin:-5px 0 13px">关联赛事：'+(race?esc(race.date+" · "+race.meet+" · "+race.event):"赛事记录暂不可用")+(race?'<button type="button" data-wsd-jump-race="'+esc(x.race_ref)+'" style="margin-left:8px;cursor:pointer">查看赛事 ↗</button>':"")+'</div>':"");
          }).join(""):'<p class="wsd-editorial-empty">暂无此类资料。</p>')+'</details>';
      }).join("")+
      '<div class="wsd-editorial-actions">'+editorialAddButton("bio",name,null,"＋ 添加选手资料")+'</div>'+
      '<div class="wsd-editorial-form-slot"></div>'+
      '<small class="wsd-editorial-disclaimer">资料由跑友补充，不代表官方认证；请注明来源，勿发布私人联系方式等敏感信息。</small>';
    panel.dataset.wsdEditorialSignature=sig;
  }
  function decorateEditorialSlots(){
    document.querySelectorAll("[data-wsd-race-attach]").forEach(slot=>{
      const name=resolveAthleteName(slot.dataset.wsdAthlete||"");
      const raceRef=slot.dataset.wsdRaceRef||"";
      if(!name||!raceRef)return;
      const entries=publicEditorialEntries("race",name,raceRef);
      const sig=entries.map(x=>x.id).join(",")+"|"+[...ownEditorialIds].join(",")+"|"+admin+"|"+!!user;
      if(slot.dataset.wsdEditorialSignature===sig||slot.querySelector("[data-wsd-editorial-form]"))return;
      slot.innerHTML='<div class="wsd-race-editorial-head"><strong>采访与赛后总结</strong>'+
        '<span>'+entries.length+' 条</span></div>'+
        (entries.length?entries.map(editorialEntryHTML).join(""):"")+
        '<div class="wsd-editorial-actions">'+editorialAddButton("race",name,raceRef,"＋ 添加赛事相关资料")+'</div>'+
        '<div class="wsd-editorial-form-slot"></div>';
      slot.dataset.wsdEditorialSignature=sig;
    });
  }
  async function refreshEditorial(){
    const {data,error}=await sb.from(EDITORIAL)
      .select("id,athlete_name,scope,race_ref,category,title,body,source_url,display_name,created_at")
      .order("created_at",{ascending:false}).limit(1500);
    if(error){note("读取选手简介／采访资料失败："+error.message,true);return;}
    editorial=data||[];
    await loadOwnEditorialIds();
    const head=$("detailBody")?.querySelector(".detail-head");
    const name=head?.querySelector("h2")?.textContent?.trim();
    if(name)decorateBio(name,head);
    decorateEditorialSlots();
    drawFeed();
  }
  function syncSharedViews(){
    window.WSD_COMMUNITY_RACES=posts.filter(p=>p.kind==="race").map(p=>({...p,athlete_name:resolveAthleteName(p.athlete_name)}));
    window.WSD_DATE_CORRECTIONS=corrections;
    window.WSD_MY_POST_IDS=[...ownPostIds];
    window.WSD_MY_DATE_CORRECTION_IDS=[...ownCorrectionIds];
    window.WSD_IS_ADMIN=admin;
    if(typeof window.WSD_REFRESH_SHARED_VIEWS==="function")window.WSD_REFRESH_SHARED_VIEWS();
  }
  async function refreshCorrections(){
    const {data,error}=await sb.from(CORRECTIONS)
      .select("id,record_id,corrected_date,created_at")
      .order("created_at",{ascending:false}).order("id",{ascending:false})
      .limit(1000);
    if(error){note("读取日期修正记录失败："+error.message,true);return;}
    corrections=data||[];
    await loadOwnCorrectionIds();
    syncSharedViews();
  }
  const oauthPendingKey="wsd-google-signin-pending";
  const photoPendingKey="wsd-pending-athlete-photo";
  function navigateCommunity(){
    const btn=document.querySelector('[data-go="community"]');
    if(btn){btn.click();return;}
    location.hash="community";
  }
  function shouldReturnCommunity(){
    try{
      if(sessionStorage.getItem(oauthPendingKey)==="1"){
        sessionStorage.removeItem(oauthPendingKey);
        return true;
      }
    }catch(e){}
    return location.search.includes("code=") ||
       location.hash.includes("access_token=");
  }
  const roster=Array.isArray(window.WSD_ATHLETE_NAMES)?window.WSD_ATHLETE_NAMES:[];
  function resolveAthleteName(name){
    const val=String(name||"").trim();
    const normalized=val.replace(/\s+/g,"").toLowerCase();
    const registered=roster.find(n=>n.replace(/\s+/g,"").toLowerCase()===normalized);
    if(registered)return registered;
    try{
      if(typeof ANNUAL_2026!=="undefined"){
        const record=ANNUAL_2026.find(r=>
          String(r.csvName||"").replace(/\s+/g,"").toLowerCase()===normalized);
        if(record)return record.name;
      }
    }catch(e){}
    return val;
  }
  $("wsdAthleteNames").innerHTML=roster.map(n=>'<option value="'+esc(n)+'"></option>').join("");
  $("wsdAuth").hidden=false;
  function postImage(r) {
    if (!r.image_path || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(r.image_path)) return "";
    const url=sb.storage.from(BUCKET).getPublicUrl(r.image_path).data.publicUrl;
    return https(url)?url:"";
  }
  function sourceLink(url,label){
    return https(url)?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer nofollow">'+esc(label)+' ↗</a>':"";
  }
  function photoFocus(r){
    const value=(v,fallback)=>Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=100?Number(v):fallback;
    return value(r.focal_x,50)+"% "+value(r.focal_y,20)+"%";
  }
  function athletePhotos(name){
    return posts.filter(r=>r.kind==="photo"&&resolveAthleteName(r.athlete_name)===name)
      .sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  }
  function coverPhoto(name){
    const photos=athletePhotos(name);
    return photos.find(r=>r.is_primary===true)||photos[0]||null;
  }
  function canManagePhoto(r){
    return !!user&&(admin||ownPostIds.has(r.id));
  }
  function photoActions(r,isCover,withDelete){
    if(!canManagePhoto(r))return "";
    return '<div class="wsd-photo-actions">'+
      '<button type="button" data-wsd-edit-crop="'+esc(r.id)+'">调整显示位置</button>'+
      (isCover?"":'<button type="button" data-wsd-set-cover="'+esc(r.id)+'">设为头像</button>')+
      (withDelete?'<button type="button" class="wsd-photo-action-delete" data-wsd-delete="'+esc(r.id)+'">删除照片</button>':"")+
      '</div>';
  }
  function drawFeed(){
    if($("wsdFeed")?.querySelector("[data-wsd-editorial-form]")){
      decorateRoster();decorateDetails();return;
    }
    const items=[...posts,...editorial.map(r=>({...r,kind:"editorial"}))].filter(r=>active==="all"||r.kind===active).sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")));
    const feed=$("wsdFeed");
    const expanded=new Set([...feed.querySelectorAll("details[data-wsd-feed-category][open]")].map(el=>el.dataset.wsdFeedCategory));
    const renderPost=r=>{
      if(r.kind==="editorial")return '<article class="wsd-post"><div class="wsd-post-body"><div class="wsd-post-type">ARTICLE / '+esc(editorialCategories[r.category]||"文字资料")+'</div><h4>'+esc(r.title)+'</h4><p>选手：'+esc(r.athlete_name)+'</p>'+(r.body?'<p>'+esc(r.body)+'</p>':"")+'<small>投稿者：'+esc(r.display_name)+' · '+new Date(r.created_at).toLocaleString("zh-CN")+'</small><footer>'+sourceLink(r.source_url,"阅读原文")+'</footer></div></article>';
      const image=r.kind==="photo"?postImage(r):"";
      const chosen=r.kind==="photo"?coverPhoto(resolveAthleteName(r.athlete_name)):null;
      const isCover=chosen?.id===r.id;
      const metadata=r.kind==="race"?
        '<strong>'+esc(r.result_time||"")+'</strong><div class="wsd-post-meta"><span>'+esc(r.event_name||"")+'</span><span>'+esc(r.race_date||"")+'</span>'+
        '<span>'+esc(({university:"大学",high_school:"高中",junior_high:"初中",elementary:"小学",other:"其他／待核实"})[r.career_stage]||"大学")+'</span>'+
        (r.meet_name?'<span>'+esc(r.meet_name)+'</span>':"")+
        (r.school_name?'<span>'+esc(r.school_name)+'</span>':"")+
        (r.rank?'<span>第 '+Number(r.rank)+' 名</span>':"")+'</div>':
        '<small>摄影／来源：'+esc(r.image_credit||"")+' · '+esc(r.image_license||"")+'</small>';
      return '<article class="wsd-post">'+
       (image?'<a class="wsd-post-image-link" href="'+esc(image)+'" target="_blank" rel="noopener noreferrer" title="打开完整原图">'+
         '<img loading="lazy" referrerpolicy="no-referrer" class="wsd-post-photo" src="'+esc(image)+'" style="object-position:'+photoFocus(r)+'" alt="'+esc(r.athlete_name)+' 投稿照片"></a>':"")+
       '<div class="wsd-post-body"><div class="wsd-post-type">'+(r.kind==="photo"?"PHOTO / 跑友照片":"RACE / 跑友成绩")+
       (isCover?' <span class="wsd-cover-label">选手头像</span>':"")+'</div>'+
       '<h4>'+esc(r.athlete_name)+'</h4>'+metadata+
       (r.notes?'<p>'+esc(r.notes)+'</p>':"")+
       '<small>投稿者：'+esc(r.display_name)+' · '+new Date(r.created_at).toLocaleString("zh-CN")+'</small>'+
       (r.kind==="photo"?photoActions(r,isCover,false):
         '<div class="wsd-race-editorial-slot" data-wsd-race-attach data-wsd-race-ref="community-'+esc(r.id)+'" data-wsd-athlete="'+esc(resolveAthleteName(r.athlete_name))+'"></div>')+
       '<footer>'+sourceLink(r.source_url,"资料来源")+
       (user?'<button data-wsd-report="'+esc(r.id)+'" type="button">举报</button>':'<small>登录后可举报</small>')+
       (user&&(admin||ownPostIds.has(r.id))?'<button class="wsd-community-delete" data-wsd-delete="'+esc(r.id)+'" type="button">'+(admin&&!ownPostIds.has(r.id)?'管理员删除':'删除我的投稿')+'</button>':"")+
       '</footer></div></article>';
    };
    const categories=[["race","比赛成绩"],["photo","人物照片"],["editorial","采访／总结／日志"]];
    feed.innerHTML=items.length?categories.map(([kind,label])=>{
      const group=items.filter(r=>r.kind===kind);
      if(active!=="all"&&active!==kind)return "";
      return '<details class="wsd-feed-category" data-wsd-feed-category="'+kind+'" '+(expanded.has(kind)||(!feed.dataset.wsdGrouped&&kind==="race")?'open':"")+'><summary style="cursor:pointer;padding:12px 4px;font-weight:700">'+esc(label)+' · '+group.length+' 条</summary><div class="wsd-feed-category-content">'+(group.length?group.map(renderPost).join(""):'<p class="wsd-community-help">暂无此类投稿。</p>')+'</div></details>';
    }).join(""):'<div class="wsd-community-skeleton">暂无此类投稿。登录后可上传第一条。</div>';
    feed.dataset.wsdGrouped="1";
    decorateRoster();
    decorateDetails();
  }
  async function refresh(){
    const {data,error}=await sb.from(TABLE).select(
      "id,kind,athlete_name,display_name,event_name,race_date,result_time,rank,notes,source_url,image_path,image_credit,image_license,created_at,status,is_primary,focal_x,focal_y,career_stage,school_name,meet_name"
    ).eq("status","published").order("created_at",{ascending:false}).limit(1000);
    if(error){note("读取社区资料失败："+error.message,true);return;}
    posts=data||[];
    await loadOwnPostIds();
    drawFeed();
    syncSharedViews();
  }
  function decorateRoster(){
    const list=$("rosterBody");
    if(!list)return;
    const covers=new Map();
    for(const r of posts.filter(x=>x.kind==="photo")){
      const name=resolveAthleteName(r.athlete_name);
      if(!covers.has(name))covers.set(name,coverPhoto(name));
    }
    list.querySelectorAll(".playercell").forEach(cell=>{
      const name=cell.querySelector("[data-player]")?.getAttribute("data-player");
      if(!name)return;
      const data=covers.get(name);
      const icon=cell.querySelector(".playericon");
      const current=cell.querySelector("img.wsd-community-avatar");
      const url=data?postImage(data):"";
      if(!url){
        if(current){
          const placeholder=document.createElement("div");
          placeholder.className="playericon";
          placeholder.textContent="W";
          current.replaceWith(placeholder);
        }
        return;
      }
      if(current){
        if(current.getAttribute("src")!==url)current.src=url;
        current.style.objectPosition=photoFocus(data);
        return;
      }
      if(!icon)return;
      const img=document.createElement("img");
      img.src=url;img.loading="lazy";img.referrerPolicy="no-referrer";
      img.alt=name+" · 跑友分享的头像";img.className="wsd-community-avatar";
      img.style.objectPosition=photoFocus(data);
      icon.replaceWith(img);
    });
  }
  function photoCardsFor(name){
    const photos=athletePhotos(name);
    const cover=photos.find(r=>r.is_primary===true)||photos[0]||null;
    const gallery=photos.filter(r=>r.id!==cover?.id).slice(0,24);
    const renderTile=r=>{
      const url=postImage(r);
      return url?'<div class="wsd-athlete-photo-tile"><a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'" title="摄影：'+esc(r.image_credit||"")+'；点击打开完整图片">'+
         '<img loading="lazy" referrerpolicy="no-referrer" alt="'+esc(name)+' 跑友分享照片" src="'+esc(url)+'" style="object-position:'+photoFocus(r)+'">'+
         '<span>摄影：'+esc(r.image_credit||"")+'</span></a>'+
         photoActions(r,false,true)+'</div>':"";
    };
    const coverURL=cover?postImage(cover):"";
    const coverHTML=coverURL?'<div class="wsd-athlete-photo-hero">'+
      '<a href="'+esc(coverURL)+'" target="_blank" rel="noopener noreferrer" title="打开完整头像照片">'+
      '<img class="wsd-athlete-main-photo" loading="lazy" referrerpolicy="no-referrer" src="'+esc(coverURL)+'" alt="'+esc(name)+' 当前头像" style="object-position:'+photoFocus(cover)+'"></a>'+
      '<div class="wsd-athlete-cover-meta"><strong>选手头像</strong><span>摄影：'+esc(cover.image_credit||"")+'</span>'+
      (cover.is_primary?'<small>已指定为头像</small>':'<small>默认使用最早上传的照片</small>')+
      photoActions(cover,true,true)+'</div></div>':
      '<div class="wsd-no-athlete-photos"><span aria-hidden="true">▧</span><strong>暂无公开照片</strong><small>上传第一张照片后，它会自动成为选手头像</small></div>';
    const ids=photos.map(r=>r.id+":"+r.is_primary+":"+r.focal_x+":"+r.focal_y+":"+(admin?"admin":ownPostIds.has(r.id)?"owner":"visitor")).join(",");
    return {count:photos.length,ids,
      coverHTML,html:gallery.map(renderTile).join("")||
       (cover?'<p class="wsd-gallery-empty">还没有其他照片。继续上传的照片会进入这里。</p>':"")};
  }
  function athleteUploader(name){
    if(!user){
      return '<div class="wsd-athlete-photo-signin">'+
        '<div class="wsd-athlete-photo-add-icon" aria-hidden="true">＋</div>'+
        '<strong>为这位选手添加照片</strong><p>Google 登录后即可投稿，所有访问者都能查看。</p>'+
        '<button class="btn btn-primary" type="button" data-wsd-photo-login="'+esc(name)+'">使用 Google 登录上传</button></div>';
    }
    return '<form class="wsd-community-form wsd-athlete-photo-form" data-wsd-photo-form data-wsd-athlete="'+esc(name)+'">'+
      '<label class="wsd-photo-drop">'+
        '<div class="wsd-photo-drop-instruction" data-wsd-photo-instruction>'+
          '<span class="wsd-photo-add-icon" aria-hidden="true">＋</span>'+
          '<strong>点击选择照片</strong><small>JPEG / PNG / WebP，原图最多 6 MB</small></div>'+
        '<img class="wsd-photo-selected-preview" data-wsd-photo-preview alt="即将上传的照片预览" hidden>'+
        '<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required aria-label="选择'+esc(name)+'的照片">'+
      '</label>'+
      '<label>投稿署名<input type="text" name="display_name" value="早稻田跑友" minlength="2" maxlength="30" required></label>'+
      '<label>摄影者／来源署名<input type="text" name="credit" maxlength="120" required placeholder="照片由谁拍摄？"></label>'+
      '<label>照片使用依据<select name="license" required>'+
        '<option value="own">本人拍摄，同意公开</option>'+
        '<option value="permission">已获得摄影者明确授权</option>'+
        '<option value="cc-by">CC BY（遵守署名要求）</option>'+
        '<option value="public-domain">公共领域</option>'+
      '</select></label>'+
      '<label>照片来源网址（选填）<input type="url" name="source" maxlength="400" placeholder="可留空"></label>'+
      '<label class="wsd-community-tick"><input type="checkbox" name="rights" required><span>我拥有公开这张照片的权利，照片不包含私人信息，同意作为社区投稿公开。</span></label>'+
      '<button class="btn btn-primary wsd-athlete-upload-button" type="submit">发布这位选手的照片</button>'+
      '<div class="wsd-athlete-upload-status" data-wsd-photo-status role="status" aria-live="polite"></div>'+
      '<p class="wsd-photo-upload-caveat">自动压缩为不含 EXIF 位置资料的 JPEG（≤2 MB）。照片由跑友投稿，未经官方核实。</p>'+
    '</form>';
  }
  function careerStageLabel(stage){
    return ({university:"大学",high_school:"高中",junior_high:"初中",elementary:"小学",other:"其他／待核实"})[stage]||"大学";
  }
  function careerHistoryFor(name){
    const schoolPosts=posts.filter(r=>r.kind==="race"&&resolveAthleteName(r.athlete_name)===name&&
      (String(r.race_date||"").slice(0,4)!=="2026"||r.career_stage!=="university"));
    // Only historical 2025 rows already present in the site's archive.
    // We never assume a race was from a specific school stage without evidence.
    const static2025=(Array.isArray(window.WSD_2025_ARCHIVE_ROWS)?window.WSD_2025_ARCHIVE_ROWS:[])
      .filter(r=>r.profileName===name);
    const static2026=(typeof window.WSD_GET_ATHLETE_2026_RESULTS==="function"?window.WSD_GET_ATHLETE_2026_RESULTS():(window.WSD_2026_ATHLETE_RESULTS||[])).filter(r=>r.name===name);
    const rows=[
      ...static2026.map(r=>({date:r.date||"2026",stage:"站内 2026 赛事档案",meet:r.meet||"",event:r.event||"",time:r.time||"",rank:r.rank,school:"",note:r.notes||"",source:r.link||"",communityId:r.communityId||null,recordId:r.id,correctionId:r.correctionId||null,raceRef:r.communityId?"community-"+r.communityId:"2026-"+r.id})),
      ...static2025.map(r=>({date:r.date,stage:"站内 2025 赛事档案",
        meet:r.event||"",event:r.metric||"",time:r.time||"",rank:r.rank,
        school:"",note:r.note||"",source:r.source||"",communityId:null,raceRef:r.raceRef||""})),
      ...schoolPosts.map(r=>({date:r.race_date,stage:careerStageLabel(r.career_stage),
        meet:r.meet_name||"跑友补充赛事",event:r.event_name||"",
        time:r.result_time||"",rank:r.rank,school:r.school_name||"",
        note:r.notes||"",source:r.source_url||"",communityId:r.id,raceRef:"community-"+r.id}))
    ].sort((a,b)=>b.date.localeCompare(a.date)||a.event.localeCompare(b.event));
    const groups=new Map();
    for(const row of rows){
      const year=row.date.slice(0,4)||"年份待核实";
      if(!groups.has(year))groups.set(year,[]);
      groups.get(year).push(row);
    }
    return {rows,groups};
  }
  function decorateCareerHistory(name,head){
    const body=$("detailBody");
    if(!body)return;
    let section=body.querySelector(".wsd-career-history");
    if(section&&section.dataset.athlete!==name){section.remove();section=null;}
    if(!section){
      section=document.createElement("section");
      section.className="wsd-community-gallery wsd-career-history";
      section.dataset.athlete=name;
      head.after(section);
    }
    const {rows,groups}=careerHistoryFor(name);
    const visibleKey=rows.map(r=>r.communityId+":"+r.date+":"+r.event+":"+r.time)
      .join("|")+";"+admin+";"+[...ownPostIds].join(",");
    if(section.dataset.historyKey===visibleKey)return;
    const histories=[...groups].map(([year,items])=>
      '<details class="wsd-career-year" '+(year==="2026"?'open':"")+'><summary>'+esc(year)+' 年 · '+items.length+' 条</summary>'+
      items.map(r=>'<div class="wsd-career-record" data-wsd-race-record="'+esc(r.raceRef||"")+'">'+
        '<div class="wsd-career-record-head"><time>'+esc(r.date)+'</time><span class="wsd-career-stage">'+esc(r.stage)+'</span></div>'+
        '<div class="wsd-career-record-meet">'+esc(r.meet)+' · '+esc(r.event)+'</div>'+
        '<div class="wsd-career-record-result"><b>'+esc(r.time)+'</b>'+
          (r.rank?'<span>第 '+esc(r.rank)+' 名</span>':"")+'</div>'+
        (r.school?'<small>当时学校／队伍：'+esc(r.school)+'</small>':"")+
        (r.note?'<p>'+esc(r.note)+'</p>':"")+
        (r.recordId!=null&&typeof window.WSD_ATHLETE_DATE_CONTROLS==="function"?window.WSD_ATHLETE_DATE_CONTROLS({id:r.recordId,date:r.date==="2026"?"":r.date,communityId:r.communityId,correctionId:r.correctionId}):"")+
        '<div class="wsd-race-editorial-slot" data-wsd-race-attach data-wsd-race-ref="'+esc(r.raceRef||"")+'" data-wsd-athlete="'+esc(name)+'"></div>'+
        '<div class="wsd-career-record-foot">'+
          (r.communityId?'<span class="wsd-community-origin">跑友补录 · 未经独立核实</span>':
            '<span class="wsd-community-origin">站内赛事档案</span>')+
          sourceLink(r.source,"成绩来源")+
          (r.communityId&&(admin||ownPostIds.has(r.communityId))?
            '<button class="wsd-community-delete" type="button" data-wsd-delete="'+esc(r.communityId)+'">删除我的补充</button>':"")+
        '</div></div>').join("")+'</details>'
    ).join("");
    section.innerHTML='<div class="wsd-athlete-photo-heading"><h4>选手赛事记录 · RACE HISTORY</h4>'+
      '<span>'+rows.length+' 条</span></div>'+
      '<p class="wsd-career-intro">按年份由新到旧排列：2026 → 2025 → 更早年份。可补充大学、初中及高中成绩。原始资料与社区补充会明确区分；未经核实的投稿不会修改个人 PB。</p>'+
      (histories||'<p class="wsd-career-empty">暂无关联的历年或中学成绩，欢迎补录。</p>')+
      '<button class="btn btn-small wsd-career-add" type="button" data-wsd-add-history="'+esc(name)+'">＋ 为 '+esc(name)+' 补充历年／中学成绩</button>';
    section.dataset.historyKey=visibleKey;
  }
  function decorateDetails(){
    const body=$("detailBody");
    if(!body)return;
    const head=body.querySelector(".detail-head");
    const name=head?.querySelector("h2")?.textContent?.trim();
    if(!name)return;
    let section=body.querySelector(".wsd-athlete-photo-section");
    if(section&&section.dataset.wsdAthlete!==name){section.remove();section=null;}
    if(!section){
      section=document.createElement("section");
      section.className="wsd-community-gallery wsd-athlete-photo-section";
      section.dataset.wsdAthlete=name;
      section.innerHTML='<div class="wsd-athlete-photo-heading"><h4>选手照片 · ATHLETE PHOTOS</h4>'+
        '<span data-wsd-photo-count>0 张</span></div>'+
        '<div class="wsd-athlete-photo-cover" data-wsd-photo-cover></div>'+
        '<h5 class="wsd-gallery-subheading">其他照片 · PHOTO GALLERY</h5>'+
        '<div class="wsd-athlete-photo-collection" data-wsd-photo-cards></div>'+
        '<div data-wsd-uploader></div>'+
        '<div class="wsd-athlete-race-extras" data-wsd-athlete-races></div>';
      head.after(section);
    }
    decorateCareerHistory(name,head);
    decorateBio(name,head);
    // Stable profile order: basic information, editorial bio, athlete photos, race history.
    const basic=body.querySelector(".wsd-athlete-bio:not(.wsd-community-gallery)");
    const editorialBio=body.querySelector(".wsd-community-gallery.wsd-athlete-bio");
    const photos=body.querySelector(".wsd-athlete-photo-section");
    const career=body.querySelector(".wsd-career-history");
    let preceding=head;
    for(const element of [basic,editorialBio,photos,career]){
      if(element){preceding.after(element);preceding=element;}
    }
    const result=photoCardsFor(name);
    const cards=section.querySelector("[data-wsd-photo-cards]");
    const coverSlot=section.querySelector("[data-wsd-photo-cover]");
    if(cards.dataset.photoIds!==result.ids){
      coverSlot.innerHTML=result.coverHTML;
      cards.innerHTML=result.html;
      cards.dataset.photoIds=result.ids;
    }
    section.querySelector("[data-wsd-photo-count]").textContent=result.count+" 张社区照片";
    const upload=section.querySelector("[data-wsd-uploader]");
    const authState=user?"signed":"guest";
    if(upload.dataset.authState!==authState){
      upload.innerHTML=athleteUploader(name);
      upload.dataset.authState=authState;
    }
    const races=posts.filter(r=>resolveAthleteName(r.athlete_name)===name&&r.kind==="race").slice(0,6);
    const extras=section.querySelector("[data-wsd-athlete-races]");
    const raceIds=races.map(r=>r.id+":"+(admin?"admin":ownPostIds.has(r.id)?"owner":"visitor")).join(",");
    if(extras.dataset.raceIds!==raceIds){
      extras.innerHTML=races.length?'<h5>跑友补充赛果</h5>'+
        races.map(r=>'<div class="wsd-community-mini-races">'+
          esc(r.race_date||"")+" · "+esc(r.event_name||"")+" · <b>"+esc(r.result_time||"")+"</b> "+
          sourceLink(r.source_url,"来源")+
          '<div class="wsd-race-editorial-slot" data-wsd-race-attach data-wsd-race-ref="community-'+esc(r.id)+'" data-wsd-athlete="'+esc(name)+'"></div>'+
          (user&&(admin||ownPostIds.has(r.id))?' <button type="button" class="wsd-athlete-race-delete" data-wsd-delete="'+esc(r.id)+'">删除投稿</button>':"")+
          '</div>').join(""):"";
      extras.dataset.raceIds=raceIds;
    }
  }
  const detailEl=$("detailBody");
  if(detailEl){
    detailEl.addEventListener("click",e=>{
      const deletion=e.target.closest("[data-wsd-delete]");
      if(deletion){
        e.preventDefault();
        deletePost(deletion.dataset.wsdDelete).catch(err=>note("删除操作失败："+err.message,true));
        return;
      }
      const button=e.target.closest("[data-wsd-photo-login]");
      if(!button)return;
      const name=button.getAttribute("data-wsd-photo-login");
      if(!name)return;
      try{sessionStorage.setItem(photoPendingKey,name);}catch(e){}
      $("wsdGoogleSignIn").click();
    });
    detailEl.addEventListener("change",e=>{
      const input=e.target.closest('input[type="file"][name="photo"]');
      if(!input||!input.closest("[data-wsd-photo-form]"))return;
      const form=input.closest("[data-wsd-photo-form]");
      const preview=form.querySelector("[data-wsd-photo-preview]");
      const instruction=form.querySelector("[data-wsd-photo-instruction]");
      const file=input.files?.[0];
      if(!file){
        preview.hidden=true;
        instruction.hidden=false;
        return;
      }
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>6*1024*1024){
        input.value="";
        preview.hidden=true;
        instruction.hidden=false;
        form.querySelector("[data-wsd-photo-status]").textContent="只支持 JPEG/PNG/WebP，原图最多 6 MB。";
        return;
      }
      const previewURL=URL.createObjectURL(file);
      preview.onload=()=>URL.revokeObjectURL(previewURL);
      preview.onerror=()=>{URL.revokeObjectURL(previewURL);preview.hidden=true;};
      preview.src=previewURL;
      preview.hidden=false;
      instruction.hidden=true;
      form.querySelector("[data-wsd-photo-status]").textContent=file.name+" · 已选中，填写署名与授权后即可发布。";
    });
    detailEl.addEventListener("submit",async e=>{
      const form=e.target.closest("[data-wsd-photo-form]");
      if(!form)return;
      e.preventDefault();
      const status=form.querySelector("[data-wsd-photo-status]");
      const say=(message,bad=false)=>{
        status.textContent=message;
        status.style.color=bad?"#b33659":"#755163";
      };
      if(!user){say("请先使用 Google 登录。",true);return;}
      const name=form.dataset.wsdAthlete||"";
      const who=form.elements.namedItem("display_name").value.trim();
      const credit=form.elements.namedItem("credit").value.trim();
      const license=form.elements.namedItem("license").value;
      const source=form.elements.namedItem("source").value.trim();
      const file=form.elements.namedItem("photo").files?.[0];
      if(!name||name.length<2||name.length>75){say("选手姓名无效。",true);return;}
      if(who.length<2||who.length>30||!credit||credit.length>120){say("请检查投稿署名和摄影者署名。",true);return;}
      if(!["own","permission","cc-by","public-domain"].includes(license)){say("请选择照片的使用依据。",true);return;}
      if(source&&!https(source)){say("照片来源须使用 HTTPS 链接。",true);return;}
      if(!file||!form.elements.namedItem("rights").checked){say("请选择照片并确认公开权限。",true);return;}
      const button=form.querySelector('button[type="submit"]');
      button.disabled=true;button.textContent="正在上传…";
      let uploaded=null;
      try{
        const blob=await convertJpeg(file);
        const key=user.id+"/"+crypto.randomUUID()+".jpg";
        const {error:storageError}=await sb.storage.from(BUCKET).upload(
          key,blob,{contentType:"image/jpeg",upsert:false});
        if(storageError)throw storageError;
        uploaded=key;
        const {error:postError}=await sb.from(TABLE).insert({
          author_id:user.id,
          display_name:who,
          kind:"photo",
          athlete_name:name,
          notes:"",
          source_url:source||null,
          image_path:key,
          image_credit:credit,
          image_license:license
        });
        if(postError)throw postError;
        say("照片发布成功！已加入 "+name+" 的资料页，其他访客可以看到。");
        form.reset();
        const preview=form.querySelector("[data-wsd-photo-preview]");
        preview.hidden=true;preview.removeAttribute("src");
        form.querySelector("[data-wsd-photo-instruction]").hidden=false;
        await refresh();
      }catch(err){
        if(uploaded)await sb.storage.from(BUCKET).remove([uploaded]);
        say("照片发布失败："+(err?.message||String(err)),true);
      }finally{
        button.disabled=false;button.textContent="发布这位选手的照片";
      }
    });
  }
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-wsd-add-history]");
    if(!b)return;
    e.preventDefault();
    const name=resolveAthleteName(b.dataset.wsdAddHistory||"");
    if(!name)return;
    if(typeof closeDetail==="function")closeDetail();
    navigateCommunity();
    $("wsdKind").value="race";
    $("wsdKind").onchange();
    $("wsdAthlete").value=name;
    $("wsdCareerStage").value="university";
    note(user?"已选择 "+name+"，请补充所属年份、学校阶段和成绩。":"请先使用 Google 登录，再为这位选手补充历史成绩。");
    if(user)$("wsdRaceDate").focus();
  });
  $("wsdFeedKind").onchange=e=>{active=e.target.value;drawFeed();};
  const rosterEl=$("rosterBody");
  if(rosterEl)new MutationObserver(()=>{if(rosterEl.querySelector(".playericon"))decorateRoster();}).observe(rosterEl,{childList:true});
  if(detailEl)new MutationObserver(()=>{if(detailEl.querySelector(".detail-head")&&!detailEl.querySelector(".wsd-community-gallery"))decorateDetails();}).observe(detailEl,{childList:true});
  async function setAuth(){
    const {data:{user:u}}=await sb.auth.getUser();
    user=u;
    $("wsdLogin").hidden=!!u;
    $("wsdSubmitForm").hidden=!u;
    $("wsdSignOut").hidden=!u;
    $("wsdAuthName").textContent=u?"已登录："+u.email:"未登录 · 访客仅可浏览";
    if(u){
      let photoTarget="";
      try{
        photoTarget=sessionStorage.getItem(photoPendingKey)||"";
        if(photoTarget)sessionStorage.removeItem(photoPendingKey);
      }catch(e){}
      if(photoTarget&&typeof getAthlete==="function"&&getAthlete(photoTarget)&&typeof openDetail==="function"){
        try{sessionStorage.removeItem(oauthPendingKey);}catch(e){}
        if(typeof show==="function")show("athletes");
        openDetail(photoTarget);
      }else if(shouldReturnCommunity()){
        navigateCommunity();
      }
    }
    if(u){
      const {data}=await sb.rpc("wsd_is_community_admin");
      admin=data===true;
      bulkPanel.hidden=!admin;
      if(admin)loadReports();else $("wsdAdminSummary").textContent="";
    }else{admin=false;bulkPanel.hidden=true;$("wsdAdminSummary").textContent="";}
    await loadOwnPostIds();
    await loadOwnCorrectionIds();
    drawFeed();
    syncSharedViews();
    await refreshEditorial();
    renderRankContribution();
  }
  $("wsdGoogleSignIn").onclick=async()=>{
    const button=$("wsdGoogleSignIn");
    button.disabled=true;
    note("正在连接 Google 登录…");
    try{
      // OAuth callback is handled by Supabase Auth first. Never use
      // #community here, since tokens can arrive in the URL fragment.
      const redirectTo=location.origin+location.pathname;
      try{sessionStorage.setItem(oauthPendingKey,"1");}catch(e){}
      const {error}=await sb.auth.signInWithOAuth({
        provider:"google",
        options:{redirectTo}
      });
      if(error)throw error;
      // Browser navigates to Google; the selected athlete is stored in this tab.
    }catch(err){
      try{sessionStorage.removeItem(oauthPendingKey);}catch(e){}
      button.disabled=false;
      note("Google 登录未能启动："+(err?.message||String(err))+
        "。请检查 Supabase Authentication → Sign In / Providers → Google 是否开启。",true);
    }
  };
  $("wsdSignOut").onclick=async()=>{await sb.auth.signOut();await setAuth();};
  $("wsdKind").onchange=()=>{
    const isPhoto=$("wsdKind").value==="photo";
    $("wsdPhotoFields").hidden=!isPhoto;
    $("wsdRaceFields").hidden=isPhoto;
    $("wsdSource").required=!isPhoto;
  };
  async function convertJpeg(file){
    const ok=["image/jpeg","image/png","image/webp"];
    if(!file||!ok.includes(file.type)||file.size>6*1024*1024)
      throw Error("请上传 JPEG/PNG/WebP，原图不超过 6MB。");
    const blobUrl=URL.createObjectURL(file);
    const img=new Image();
    try {
      await new Promise((resolve,reject)=>{
        img.onload=resolve;img.onerror=()=>reject(Error("无法读取照片"));
        img.src=blobUrl;
      });
      if(img.width<160||img.height<160||img.width*img.height>35000000)
        throw Error("照片尺寸过小或过大");
      const factor=Math.min(1,1600/Math.max(img.width,img.height));
      const c=document.createElement("canvas");
      c.width=Math.round(img.width*factor);c.height=Math.round(img.height*factor);
      const ctx=c.getContext("2d",{alpha:false});
      ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);
      ctx.drawImage(img,0,0,c.width,c.height);
      let quality=.84,out;
      for(let i=0;i<4;i++){
        out=await new Promise(resolve=>c.toBlob(resolve,"image/jpeg",quality));
        if(out&&out.size<=2*1024*1024)break;
        quality-=.16;
      }
      if(!out||out.size>2*1024*1024)throw Error("重编码后的文件仍过大");
      return out; // canvas strips EXIF GPS and metadata from original file
    }finally{URL.revokeObjectURL(blobUrl);}
  }
  $("wsdSubmitForm").onsubmit=async e=>{
    e.preventDefault();
    if(!user){note("请先使用 Google 账号登录。",true);return;}
    if(!$("wsdRights").checked){note("请确认公开授权与数据准确性。",true);return;}
    const kind=$("wsdKind").value;
    const name=resolveAthleteName($("wsdAthlete").value.trim());
    const who=$("wsdDisplayName").value.trim();
    const source=$("wsdSource").value.trim();
    if(name.length<2||name.length>75||who.length<2||who.length>30){note("姓名或署名长度不正确。",true);return;}
    if(source&&!https(source)){note("来源必须为 HTTPS 链接。",true);return;}
    const notes=$("wsdNotes").value.trim();
    if(/https?:\/\/|www\./i.test(notes)){note("链接请填在来源栏，说明栏不可加入网址。",true);return;}
    const button=$("wsdPublish");button.disabled=true;button.textContent="提交中…";
    let uploaded=null;
    try{
      const item={author_id:user.id,display_name:who,kind,athlete_name:name,
        notes,source_url:source||null};
      if(kind==="race"){
        if(!source)throw Error("比赛成绩需要提供原始 HTTPS 来源");
        if(!$("wsdEvent").value.trim()||!$("wsdRaceDate").value)throw Error("请填写比赛项目和日期");
        const time=$("wsdTime").value.trim();
        if(!/^\d{1,2}(:\d{2}){1,2}(\.\d{1,2})?$/.test(time))throw Error("成绩格式如 13:45.12 或 1:02:36");
        const rank=$("wsdRank").value.trim();
        const stage=$("wsdCareerStage").value;
        const meet=$("wsdMeet").value.trim();
        const school=$("wsdSchool").value.trim();
        if(!["university","high_school","junior_high","elementary","other"].includes(stage))throw Error("请选择成绩所属阶段");
        if(meet&&(meet.length<2||meet.length>120||/https?:\/\/|www\./i.test(meet)))throw Error("赛事名称应为 2–120 字，不含网址");
        if(school&&(school.length<2||school.length>100||/https?:\/\/|www\./i.test(school)))throw Error("学校名称应为 2–100 字，不含网址");
        item.career_stage=stage;item.meet_name=meet||null;item.school_name=school||null;
        item.event_name=$("wsdEvent").value.trim();
        item.race_date=$("wsdRaceDate").value;
        item.result_time=time;item.rank=rank?Number(rank):null;
      }else{
        const credit=$("wsdCredit").value.trim();
        if(!credit)throw Error("照片必须填写摄影者／来源署名");
        const license=$("wsdLicense").value;
        const blob=await convertJpeg($("wsdPhoto").files[0]);
        const id=crypto.randomUUID();
        const key=user.id+"/"+id+".jpg";
        const result=await sb.storage.from(BUCKET).upload(key,blob,{contentType:"image/jpeg",upsert:false});
        if(result.error)throw result.error;
        uploaded=key;
        item.image_path=key;item.image_credit=credit;item.image_license=license;
      }
      const {error}=await sb.from(TABLE).insert(item);
      if(error)throw error;
      note("已公开发布，其他访客可以立即看到！");
      $("wsdSubmitForm").reset();$("wsdKind").value="race";$("wsdKind").onchange();
      await refresh();
    }catch(err){
      if(uploaded)await sb.storage.from(BUCKET).remove([uploaded]);
      note("投稿失败："+(err?.message||String(err)),true);
    }finally{button.disabled=false;button.textContent="发布后立即公开";}
  };

  // Admin-only batch CSV import. Database RLS remains the final authority.
  let bulkRows=[];
  const bulkPanel=$("wsdBulkPanel"),bulkFile=$("wsdBulkFile"),bulkPreview=$("wsdBulkPreview"),bulkImport=$("wsdBulkImport"),bulkStatus=$("wsdBulkStatus");
  const bulkHeaders=["athlete_name","meet_name","event_name","race_date","result_time","rank","source_url","career_stage","school_name","notes"];
  function parseBulkCsv(src){
    const rows=[];let row=[],field="",quoted=false;
    src=src.replace(/^\\uFEFF/,"");
    for(let i=0;i<src.length;i++){const ch=src[i];
      if(quoted){if(ch==='"'&&src[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
      else if(ch==='"')quoted=true;else if(ch===","){row.push(field);field="";}
      else if(ch==="\\n"){row.push(field.replace(/\\r$/,""));rows.push(row);row=[];field="";}
      else field+=ch;
    }
    if(quoted)throw Error("CSV 引号未闭合");
    if(field||row.length){row.push(field.replace(/\\r$/,""));rows.push(row);}
    return rows;
  }
  const bulkKey=x=>[x.athlete_name,x.meet_name,x.event_name,x.race_date,x.result_time].map(v=>String(v||"").trim().toLowerCase()).join("|");
  $("wsdBulkTemplate").onclick=()=>{
    const csv=bulkHeaders.join(",")+"\\r\\n"+["示例选手","示例大会","5000m","2026-11-01","13:45.12","","https://example.org/results","university","",""].join(",")+"\\r\\n";
    const blob=new Blob(["\\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="waseda-athlete-results-template.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  bulkFile.onchange=async()=>{
    bulkRows=[];bulkImport.disabled=true;bulkPreview.textContent="";bulkStatus.textContent="";
    if(!admin||!user)return;
    const file=bulkFile.files?.[0];if(!file)return;
    if(file.size>1024*1024){bulkStatus.textContent="文件不能超过 1MB";return;}
    try{
      const parsed=parseBulkCsv(await file.text());if(parsed.length<2)throw Error("CSV 没有数据行");
      const headers=parsed.shift().map(x=>x.trim().toLowerCase());
      for(const key of ["athlete_name","meet_name","event_name","race_date","result_time","source_url"])if(!headers.includes(key))throw Error("缺少必填列："+key);
      if(parsed.length>300)throw Error("单次最多导入 300 行");
      const seen=new Set();
      const {data:existing,error:existingError}=await sb.from(TABLE).select("athlete_name,meet_name,event_name,race_date,result_time").eq("kind","race").limit(5000);
      if(existingError)throw existingError;
      for(const x of existing||[])seen.add(bulkKey(x));
      const valid=[],issues=[];
      parsed.forEach((cells,i)=>{
        if(cells.length===1&&!cells[0].trim())return;
        const x=Object.fromEntries(bulkHeaders.map(k=>[k,(cells[headers.indexOf(k)]||"").trim()]));
        let err="";
        if(!x.athlete_name||!x.meet_name||!x.event_name||!x.race_date||!x.result_time||!x.source_url)err="必填字段缺失";
        else if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(x.race_date)||Number.isNaN(Date.parse(x.race_date)))err="日期格式错误";
        else if(!/^\\d{1,2}(:\\d{2}){1,2}(\\.\\d{1,2})?$/.test(x.result_time))err="成绩格式错误";
        else if(!https(x.source_url))err="来源须为 HTTPS 链接";
        else if(x.rank&&(!/^\\d+$/.test(x.rank)||Number(x.rank)<1))err="名次须为正整数";
        else if(x.athlete_name.length>100||x.meet_name.length>120||x.event_name.length>120||x.notes.length>1000)err="字段过长";
        else if(x.career_stage&&!["university","high_school","junior_high","elementary","other"].includes(x.career_stage))err="阶段不支持";
        else if(seen.has(bulkKey(x)))err="重复记录";
        if(err)issues.push("第"+(i+2)+"行："+err);else{seen.add(bulkKey(x));valid.push(x);}
      });
      bulkRows=valid;
      bulkPreview.innerHTML="<strong>可导入 "+valid.length+" 条；跳过 "+issues.length+" 条</strong>"+
        "<div style='font-size:12px'>"+issues.slice(0,40).map(x=>"<p>"+esc(x)+"</p>").join("")+"</div>"+
        "<div style='font-size:12px'>"+valid.slice(0,15).map(x=>"<p>"+esc(x.athlete_name)+" · "+esc(x.meet_name)+" · "+esc(x.event_name)+" · "+esc(x.result_time)+"</p>").join("")+"</div>";
      bulkImport.disabled=!valid.length;
    }catch(e){bulkStatus.textContent="读取失败："+e.message;}
  };
  bulkImport.onclick=async()=>{
    if(!admin||!user||!bulkRows.length)return;
    if(!confirm("确认公开导入 "+bulkRows.length+" 条个人比赛成绩？"))return;
    bulkImport.disabled=true;let done=0;
    for(let i=0;i<bulkRows.length;i+=25){
      const batch=bulkRows.slice(i,i+25).map(x=>({author_id:user.id,display_name:"管理员",kind:"race",athlete_name:x.athlete_name,meet_name:x.meet_name,event_name:x.event_name,race_date:x.race_date,result_time:x.result_time,rank:x.rank?Number(x.rank):null,source_url:x.source_url,career_stage:x.career_stage||"university",school_name:x.school_name||null,notes:x.notes||""}));
      const {error}=await sb.from(TABLE).insert(batch);
      if(error){bulkStatus.textContent="已导入 "+done+" 条；第 "+(i+1)+" 行起失败："+error.message+"。请重新导出未导入数据，避免重复。";await refresh();return;}
      done+=batch.length;bulkStatus.textContent="已导入 "+done+" / "+bulkRows.length+" 条";
    }
    bulkRows=[];bulkFile.value="";bulkStatus.textContent="成功导入 "+done+" 条比赛成绩。";await refresh();
  };
  async function loadReports(){
    if(!admin)return;
    const {data,error}=await sb.from(REPORTS).select("submission_id,reason,created_at").order("created_at",{ascending:false}).limit(40);
    if(error){$("wsdAdminSummary").textContent="管理员举报列表加载失败："+error.message;return;}
    const grouped=new Map();
    for(const x of data||[]){
      if(!grouped.has(x.submission_id))grouped.set(x.submission_id,[]);
      grouped.get(x.submission_id).push(x.reason);
    }
    $("wsdAdminSummary").innerHTML="<strong>管理员 · 举报处理</strong><p>当前显示最近 40 次举报。可永久删除投稿；照片也会尝试从云端存储删除。</p>"+
      ([...grouped.entries()].map(([id,reasons])=>
        '<div class="wsd-admin-report"><span>'+esc(id)+' · '+reasons.length+' 次 · '+esc(reasons.join("、"))+
        '</span><button data-wsd-admin-delete="'+esc(id)+'" class="btn btn-small wsd-community-delete" type="button">管理员永久删除</button></div>'
      ).join("")||'<p>暂无举报</p>');
  }
  async function deletePost(id){
    if(deleting)return;
    if(!user){note("请先使用 Google 登录后再删除投稿。",true);return;}
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
      note("无效的投稿编号。",true);return;
    }
    if(!admin&&!ownPostIds.has(id)){
      note("你只能删除自己发布的投稿。",true);return;
    }
    const {data:records,error:lookupError}=await sb.from(TABLE)
      .select("id,kind,image_path,status").eq("id",id).limit(1);
    if(lookupError){note("无法检查投稿："+lookupError.message,true);return;}
    const item=records?.[0];
    if(!item){note("投稿不存在或你没有权限查看。",true);await refresh();return;}
    const description=item.kind==="photo"?"照片":"比赛成绩";
    if(!confirm("确定永久删除这条"+description+"投稿吗？\n对应照片也会从云端删除，操作无法撤销。"))return;
    deleting=true;
    try{
      // Database RLS checks author_id = auth.uid() OR community admin.
      // Remove the DB row first. Storage RLS allows owners to remove
      // their photo after it is no longer referenced by a submission.
      const {data:deleted,error:deleteError}=await sb.from(TABLE)
        .delete().eq("id",id).select("id");
      if(deleteError)throw deleteError;
      if(!deleted?.length)throw new Error("投稿已删除，或账号没有删除权限");
      let warning="";
      if(item.kind==="photo"&&item.image_path){
        try{
          const {error:storageError}=await sb.storage.from(BUCKET)
            .remove([item.image_path]);
          if(storageError)throw storageError;
        }catch(err){
          warning="；但照片文件清理失败，请联系管理员在 Supabase Storage 手动删除残留文件";
        }
      }
      await refresh();
      if(admin)await loadReports();
      const message="投稿已删除，并从共享网站移除"+warning;
      note(message,!!warning);
      if(typeof toast==="function")toast(message);
    }catch(err){
      const message="删除投稿失败："+(err?.message||String(err));
      note(message,true);
      if(typeof toast==="function")toast(message);
    }finally{deleting=false;}
  }
  $("wsdAdminSummary").onclick=async e=>{
    const b=e.target.closest("[data-wsd-admin-delete]");
    if(b)await deletePost(b.dataset.wsdAdminDelete);
  };
  $("wsdFeed").onclick=async e=>{
    const report=e.target.closest("[data-wsd-report]");
    const deletion=e.target.closest("[data-wsd-delete]");
    if(deletion){await deletePost(deletion.dataset.wsdDelete);return;}
    if(report&&user){
      const id=report.dataset.wsdReport;
      const reason=prompt("举报原因（wrong-result / copyright / privacy / abuse / other）","wrong-result");
      if(reason===null)return;
      if(!["wrong-result","copyright","privacy","abuse","other"].includes(reason)){
        note("举报原因必须从给定选项中选择。",true);return;
      }
      const {error}=await sb.from(REPORTS).insert({submission_id:id,reporter_id:user.id,reason});
      note(error?"举报失败："+error.message:"已收到举报，谢谢。",!!error);
    }
  };
  // Small, mobile-friendly shared crop editor. This adjusts presentation only;
  // the original JPEG in Storage is never recropped or replaced.
  const cropOverlay=document.createElement("div");
  cropOverlay.className="wsd-crop-overlay";
  cropOverlay.id="wsdPhotoCropOverlay";
  cropOverlay.hidden=true;
  cropOverlay.innerHTML=
    '<div class="wsd-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="wsdCropTitle">'+
      '<div class="wsd-crop-header"><h3 id="wsdCropTitle">调整照片显示位置</h3>'+
      '<button type="button" data-wsd-crop-close aria-label="关闭照片调整" class="wsd-crop-close">×</button></div>'+
      '<p>可拖动左侧预览，或调整横向／纵向滑块；同时查看右侧头像效果。不会修改原图。</p>'+
      '<div class="wsd-crop-preview-grid"><div class="wsd-crop-preview" data-wsd-crop-drag>'+
        '<img data-wsd-crop-image alt="投稿照片横向裁切预览"><span>投稿照片</span></div>'+
        '<div class="wsd-crop-avatar-preview"><img data-wsd-crop-avatar alt="选手头像正方形裁切预览"><span>选手头像</span></div></div>'+
      '<form id="wsdPhotoCropForm">'+
        '<label>左右位置 <output data-wsd-crop-x-value>50%</output>'+
          '<input type="range" name="focal_x" min="0" max="100" step="1" value="50" aria-label="照片左右位置"></label>'+
        '<label>上下位置 <output data-wsd-crop-y-value>20%</output>'+
          '<input type="range" name="focal_y" min="0" max="100" step="1" value="20" aria-label="照片上下位置"></label>'+
        '<div class="wsd-crop-buttons">'+
          '<button class="btn btn-primary" type="submit" data-wsd-crop-save>保存位置</button>'+
          '<button class="btn" type="button" data-wsd-crop-close>取消</button>'+
        '</div><div class="wsd-crop-status" data-wsd-crop-status role="status"></div>'+
      '</form>'+
    '</div>';
  document.body.appendChild(cropOverlay);
  let croppingId=null;
  let photoActionBusy=false;
  const cropForm=cropOverlay.querySelector("#wsdPhotoCropForm");
  const cropPreview=cropOverlay.querySelector("[data-wsd-crop-drag]");
  function updateCropPreview(){
    const x=Number(cropForm.elements.namedItem("focal_x").value);
    const y=Number(cropForm.elements.namedItem("focal_y").value);
    cropOverlay.querySelector("[data-wsd-crop-image]").style.objectPosition=x+"% "+y+"%";
    cropOverlay.querySelector("[data-wsd-crop-avatar]").style.objectPosition=x+"% "+y+"%";
    cropOverlay.querySelector("[data-wsd-crop-x-value]").textContent=x+"%";
    cropOverlay.querySelector("[data-wsd-crop-y-value]").textContent=y+"%";
  }
  function closeCrop(){
    cropOverlay.hidden=true;
    croppingId=null;
    cropOverlay.querySelector("[data-wsd-crop-image]").removeAttribute("src");
    cropOverlay.querySelector("[data-wsd-crop-avatar]").removeAttribute("src");
  }
  function openCrop(id){
    const row=posts.find(r=>r.id===id&&r.kind==="photo");
    if(!row||!canManagePhoto(row)){note("只有照片上传者或管理员可以调整这张照片。",true);return;}
    const url=postImage(row);
    if(!url)return;
    croppingId=id;
    const image=cropOverlay.querySelector("[data-wsd-crop-image]");
    image.src=url;
    cropOverlay.querySelector("[data-wsd-crop-avatar]").src=url;
    cropForm.elements.namedItem("focal_x").value=Number.isInteger(row.focal_x)?row.focal_x:50;
    cropForm.elements.namedItem("focal_y").value=Number.isInteger(row.focal_y)?row.focal_y:20;
    cropOverlay.querySelector("[data-wsd-crop-status]").textContent="";
    cropOverlay.hidden=false;
    updateCropPreview();
    cropForm.elements.namedItem("focal_y").focus();
  }
  cropOverlay.addEventListener("click",e=>{
    if(e.target===cropOverlay||e.target.closest("[data-wsd-crop-close]"))closeCrop();
  });
  cropForm.addEventListener("input",updateCropPreview);
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&!cropOverlay.hidden){
      e.preventDefault();
      e.stopImmediatePropagation();
      closeCrop();
    }
  },true);
  let dragStart=null;
  cropPreview.addEventListener("pointerdown",e=>{
    if(!croppingId)return;
    dragStart={id:e.pointerId,x:e.clientX,y:e.clientY,
      fx:Number(cropForm.elements.namedItem("focal_x").value),
      fy:Number(cropForm.elements.namedItem("focal_y").value)};
    cropPreview.setPointerCapture(e.pointerId);
  });
  cropPreview.addEventListener("pointermove",e=>{
    if(!dragStart||dragStart.id!==e.pointerId)return;
    const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
    const fx=clamp(dragStart.fx-(e.clientX-dragStart.x)*100/Math.max(cropPreview.clientWidth,1));
    const fy=clamp(dragStart.fy-(e.clientY-dragStart.y)*100/Math.max(cropPreview.clientHeight,1));
    cropForm.elements.namedItem("focal_x").value=fx;
    cropForm.elements.namedItem("focal_y").value=fy;
    updateCropPreview();
  });
  for(const kind of ["pointerup","pointercancel","lostpointercapture"]){
    cropPreview.addEventListener(kind,()=>{dragStart=null;});
  }
  cropForm.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!croppingId||photoActionBusy)return;
    const button=cropForm.querySelector("[data-wsd-crop-save]");
    const status=cropOverlay.querySelector("[data-wsd-crop-status]");
    button.disabled=true;button.textContent="正在保存…";photoActionBusy=true;
    try{
      const {error}=await sb.rpc("wsd_update_photo_crop",{
        p_photo_id:croppingId,
        p_x:Number(cropForm.elements.namedItem("focal_x").value),
        p_y:Number(cropForm.elements.namedItem("focal_y").value)
      });
      if(error)throw error;
      closeCrop();
      await refresh();
      note("照片显示位置已保存，所有访问者都会看到新位置。");
      if(typeof toast==="function")toast("照片位置已更新");
    }catch(err){status.textContent="保存失败："+(err?.message||String(err));}
    finally{photoActionBusy=false;button.disabled=false;button.textContent="保存位置";}
  });
  document.addEventListener("click",async e=>{
    const edit=e.target.closest("[data-wsd-edit-crop]");
    if(edit){e.preventDefault();openCrop(edit.dataset.wsdEditCrop);return;}
    const set=e.target.closest("[data-wsd-set-cover]");
    if(!set)return;
    e.preventDefault();
    if(photoActionBusy)return;
    const id=set.dataset.wsdSetCover;
    const photo=posts.find(r=>r.id===id&&r.kind==="photo");
    if(!photo||!canManagePhoto(photo)){note("只有照片上传者或管理员可以设置这张照片为头像。",true);return;}
    photoActionBusy=true;set.disabled=true;
    try{
      const {error}=await sb.rpc("wsd_set_photo_primary",{p_photo_id:id});
      if(error)throw error;
      await refresh();
      note("已设置为 "+resolveAthleteName(photo.athlete_name)+" 的头像。");
      if(typeof toast==="function")toast("已设置为选手头像");
    }catch(err){
      const msg="设置头像失败："+(err?.message||String(err));
      note(msg,true);if(typeof toast==="function")toast(msg);
    }finally{photoActionBusy=false;set.disabled=false;}
  });
  document.addEventListener("click",e=>{
    const btn=e.target.closest("[data-wsd-jump-race]");if(!btn)return;
    const ref=btn.dataset.wsdJumpRace;
    const record=[...document.querySelectorAll("[data-wsd-race-record]")].find(x=>x.dataset.wsdRaceRecord===ref);
    if(!record)return;
    const year=record.closest("details");if(year)year.open=true;
    record.scrollIntoView({behavior:"smooth",block:"center"});
  });
  function editorialFormHTML(scope,name,raceRef){
    const choices='<label>资料类型<select name="category" required>'+
      '<option value="bio">选手介绍</option><option value="diary">部员日志</option>'+
      '<option value="interview">选手采访</option><option value="summary">赛后总结</option>'+
      '<option value="article">相关文章／相关新闻</option><option value="analysis">赛事分析</option>'+
      '<option value="other">其他补充</option></select></label>';
    const races=careerHistoryFor(name).rows.filter(x=>x.raceRef&&editorialRaceRefValid(x.raceRef));
    const raceChoice='<label>关联赛事（赛后总结、赛事分析必选；其他资料可选）<select name="linked_race">'+
      '<option value="">— 不关联具体赛事 —</option>'+races.map(x=>'<option value="'+esc(x.raceRef)+'" '+(raceRef===x.raceRef?'selected':'')+'>'+esc(x.date+' · '+x.meet+' · '+x.event)+'</option>').join("")+
      '</select></label>';
    return '<form class="wsd-editorial-form" data-wsd-editorial-form data-scope="'+esc(scope)+'"'+
      ' data-wsd-athlete="'+esc(name)+'"'+
      (raceRef?' data-wsd-race-ref="'+esc(raceRef)+'"':"")+'>'+
      choices+raceChoice+
      '<label>标题<input name="title" type="text" maxlength="100" minlength="2" required placeholder="'+
        (scope==="bio"?'例如：选手经历与比赛风格':'例如：赛后采访／赛事回顾')+'"></label>'+
      '<label>手写内容（可选）<textarea name="body" rows="5" maxlength="4000" placeholder="可以直接撰写简介、采访摘要或比赛总结；请勿整段复制未经许可的文章。"></textarea></label>'+
      '<label>原文／采访链接（可选）<input name="source_url" type="url" maxlength="400" placeholder="https://..."></label>'+
      '<label>投稿署名<input name="display_name" type="text" minlength="2" maxlength="30" value="早稻田跑友" required></label>'+
      '<p class="wsd-editorial-hint">文字和链接至少填写一项；允许两者同时填写。投稿将向所有访客公开。</p>'+
      '<div class="wsd-editorial-form-controls"><button class="btn btn-primary btn-small" type="submit">发布资料</button>'+
      '<button class="btn btn-small" type="button" data-wsd-editorial-cancel>取消</button></div>'+
      '<div class="wsd-editorial-form-status" role="status" data-wsd-editorial-status></div></form>';
  }
  function editorialRaceRefValid(ref){
    return /^(?:2026-[1-9][0-9]{0,4}|2025-[0-9]{1,5}|community-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(ref);
  }
  document.addEventListener("click",async e=>{
    const cancel=e.target.closest("[data-wsd-editorial-cancel]");
    if(cancel){
      e.preventDefault();
      cancel.closest(".wsd-editorial-form-slot")?.replaceChildren();
      return;
    }
    const del=e.target.closest("[data-wsd-editorial-delete]");
    if(del){
      e.preventDefault();
      if(!user){note("请先登录才能删除自己投稿的资料。",true);return;}
      const id=del.dataset.wsdEditorialDelete||"";
      if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return;
      if(!admin&&!ownEditorialIds.has(id)){note("你只能删除自己写的简介或采访资料。",true);return;}
      if(!confirm("确定永久删除这条简介／采访资料吗？删除后无法撤销。"))return;
      del.disabled=true;
      const {data,error}=await sb.from(EDITORIAL).delete().eq("id",id).select("id");
      if(error||!data?.length){
        del.disabled=false;
        note("删除资料失败："+(error?.message||"账号没有删除权限"),true);
        return;
      }
      await refreshEditorial();
      note("这条简介／采访资料已删除。");
      return;
    }
    const button=e.target.closest("[data-wsd-editorial-add]");
    if(!button)return;
    e.preventDefault();
    if(!user){note("请先使用 Google 账号登录，再添加资料。",true);return;}
    const scope=button.dataset.wsdEditorialAdd||"";
    const name=resolveAthleteName(button.dataset.wsdAthlete||"");
    const raceRef=button.dataset.wsdRaceRef||"";
    if(!["bio","race"].includes(scope)||name.length<2||name.length>75)return;
    if(scope==="race"&&!editorialRaceRefValid(raceRef))return;
    const target=button.closest(".wsd-athlete-bio,.wsd-race-editorial-slot");
    const holder=target?.querySelector(".wsd-editorial-form-slot");
    if(!holder)return;
    if(holder.querySelector("form")){holder.replaceChildren();return;}
    holder.innerHTML=editorialFormHTML(scope,name,raceRef);
    holder.querySelector('input[name="title"]')?.focus();
  });
  document.addEventListener("submit",async e=>{
    const form=e.target.closest("[data-wsd-editorial-form]");
    if(!form)return;
    e.preventDefault();
    const status=form.querySelector("[data-wsd-editorial-status]");
    const fail=msg=>{status.textContent=msg;status.style.color="#b33659";};
    if(!user){fail("请先使用 Google 登录。");return;}
    const scope=form.elements.namedItem("linked_race")?.value?"race":"bio";
    const name=resolveAthleteName(form.dataset.wsdAthlete||"");
    const raceRef=form.elements.namedItem("linked_race")?.value||"";
    const title=form.elements.namedItem("title").value.trim();
    const body=form.elements.namedItem("body").value.trim();
    const url=form.elements.namedItem("source_url").value.trim();
    const displayName=form.elements.namedItem("display_name").value.trim();
    const category=form.elements.namedItem("category")?.value;
    if(!["bio","race"].includes(scope)||name.length<2||name.length>75){fail("选手姓名无效。");return;}
    if(scope==="race"&&!editorialRaceRefValid(raceRef)){fail("关联赛事编号无效。");return;}
    if(!["bio","interview","summary","diary","article","analysis","other"].includes(category)||(scope==="race"&&category==="bio")){fail("资料类型无效。");return;}
    if(["summary","analysis"].includes(category)&&scope!=="race"){fail("赛后总结和赛事分析必须选择关联赛事。");return;}
    if(title.length<2||title.length>100||body.length>4000||displayName.length<2||displayName.length>30){fail("请检查标题、正文及署名长度。");return;}
    if(!body&&!url){fail("请填写文字内容或原文链接，至少填写一项。");return;}
    if(url&&!https(url)){fail("链接需要使用 HTTPS，且长度不超过 400 字。");return;}
    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;button.textContent="正在发布…";
    try{
      const {error}=await sb.from(EDITORIAL).insert({
        author_id:user.id,athlete_name:name,scope,
        race_ref:scope==="race"?raceRef:null,category,title,body,
        source_url:url||null,display_name:displayName
      });
      if(error)throw error;
      status.textContent="已公开发布！";
      form.closest(".wsd-editorial-form-slot")?.replaceChildren();
      await refreshEditorial();
      note("资料已添加，其他访客也可以查看。");
      if(typeof toast==="function")toast("简介／采访资料已保存");
    }catch(err){
      fail("发布失败："+(err?.message||String(err)));
      button.disabled=false;button.textContent="发布资料";
    }
  });
  // The original application redraws race cards on search/filter changes.
  // Reattach small article widgets to new cards without disrupting form input.
  let editorialDecorationPending=false;
  const articleTargets=["seasonCards","arc25List","detailBody","wsdFeed"];
  for(const id of articleTargets){
    const container=$(id);
    if(!container)continue;
    new MutationObserver(()=>{
      if(editorialDecorationPending)return;
      editorialDecorationPending=true;
      queueMicrotask(()=>{
        editorialDecorationPending=false;
        decorateEditorialSlots();
      });
    }).observe(container,{childList:true,subtree:true});
  }
  async function saveSharedDateCorrection(form){
    if(!user){note("请先使用 Google 登录才能修正日期。",true);return;}
    const recordId=Number(form.dataset.wsdRecordId);
    if(!Number.isInteger(recordId)||recordId<1||recordId>176){note("原始赛果记录编号无效。",true);return;}
    const correctedDate=form.elements.namedItem("corrected_date")?.value||"";
    const isValid=/^2026-\d{2}-\d{2}$/.test(correctedDate)&&
      !Number.isNaN(Date.parse(correctedDate+"T00:00:00Z"))&&
      new Date(correctedDate+"T00:00:00Z").toISOString().slice(0,10)===correctedDate;
    if(!isValid){form.querySelector("[data-wsd-date-error]").textContent="请输入正确的 2026 年比赛日期。";return;}
    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;button.textContent="保存中…";
    const {error}=await sb.from(CORRECTIONS).insert({
      record_id:recordId,author_id:user.id,corrected_date:correctedDate
    });
    if(error){
      form.querySelector("[data-wsd-date-error]").textContent="日期保存失败："+error.message;
      button.disabled=false;button.textContent="保存修正";
      return;
    }
    const message="日期已公开更新为 "+correctedDate+"（跑友修订，未作独立核实）。";
    note(message);
    if(typeof toast==="function")toast(message);
    await refreshCorrections();
  }
  async function removeSharedDateCorrection(id){
    if(!user){note("请先登录以撤销日期修正。",true);return;}
    if(!/^[0-9a-f-]{36}$/i.test(id)){note("日期修正编号无效。",true);return;}
    if(!admin&&!ownCorrectionIds.has(id)){note("只能撤销自己补充的日期，管理员可删除所有修正。",true);return;}
    if(!confirm("确认删除这条日期修正吗？\n页面将恢复原始日期或显示上一条有效修订。该操作不能撤销。"))return;
    const {data,error}=await sb.from(CORRECTIONS).delete().eq("id",id).select("id");
    if(error||!data?.length){note("撤销日期修正失败："+(error?.message||"无权删除或记录不存在"),true);return;}
    const message="日期修订已删除，页面已恢复到之前的有效日期。";
    note(message);if(typeof toast==="function")toast(message);
    await refreshCorrections();
  }
  document.addEventListener("click",e=>{
    const globalDelete=e.target.closest("[data-wsd-delete]");
    if(globalDelete&&!globalDelete.closest("#wsdFeed,#detailBody")){
      e.preventDefault();
      deletePost(globalDelete.dataset.wsdDelete).catch(err=>note("删除投稿失败："+err.message,true));
      return;
    }
    const remove=e.target.closest("[data-wsd-date-remove]");
    if(remove){
      e.preventDefault();
      removeSharedDateCorrection(remove.dataset.wsdDateRemove).catch(err=>note("撤销修订失败："+err.message,true));
      return;
    }
    const cancel=e.target.closest("[data-wsd-date-cancel]");
    if(cancel){e.preventDefault();cancel.closest(".wsd-date-edit-slot")?.replaceChildren();return;}
    const edit=e.target.closest("[data-wsd-date-edit]");
    if(!edit)return;
    e.preventDefault();
    if(!user){
      note("请先使用 Google 登录，然后回到 2026 年度成绩修改日期。",true);
      navigateCommunity();
      return;
    }
    const id=Number(edit.dataset.wsdDateEdit);
    if(!Number.isInteger(id)||id<1||id>176)return;
    const record=ANNUAL_2026.find(r=>r.id===id);
    if(!record)return;
    const slot=edit.closest(".annual26-result,.season-result")?.querySelector(".wsd-date-edit-slot");
    if(!slot)return;
    if(slot.querySelector("form")){slot.replaceChildren();return;}
    const today=edit.dataset.wsdCurrentDate||"";
    const initial=/^2026-\d{2}-\d{2}$/.test(today)?today:"";
    slot.innerHTML='<form class="wsd-inline-date-form" data-wsd-correction-form data-wsd-record-id="'+id+'">'+
      '<label>比赛准确日期<input name="corrected_date" type="date" min="2026-01-01" max="2026-12-31" value="'+esc(initial)+'" required></label>'+
      '<div class="wsd-inline-date-buttons"><button type="submit" class="btn btn-primary btn-small">保存修正</button>'+
      '<button type="button" class="btn btn-small" data-wsd-date-cancel>取消</button></div>'+
      '<small>仅修正此条赛事的日期；原始资料不会被改写。日期将标注为跑友补录。</small>'+
      '<div class="wsd-inline-date-error" data-wsd-date-error role="status"></div></form>';
    slot.querySelector('input[type="date"]')?.focus();
  });
  document.addEventListener("submit",e=>{
    const form=e.target.closest("[data-wsd-correction-form]");
    if(!form)return;
    e.preventDefault();
    saveSharedDateCorrection(form).catch(err=>note("提交修订失败："+err.message,true));
  });

  // Collaborative international rankings: signed-in friends suggest values;
  // only existing community admins publish verified snapshots.
  const rankMount=$("rankContributionMount");
  function renderRankContribution(){
    if(!rankMount)return;
    if(!user){
      rankMount.innerHTML='<details><summary>＋ 参与维护世界／亚洲排名</summary><p class="int-rank-help">请先在「跑友社区」使用 Google 登录。登录后可以提交选手排名和官方来源，管理员核实后才会出现在正式榜单。</p><div class="int-rank-editor-status"><button type="button" class="btn btn-small" data-wsd-rank-login>前往 Google 登录</button></div></details>';
      return;
    }
    const names=(typeof getAthletes==='function'?getAthletes():[]).filter(a=>!a.communityOnly).map(a=>a.name);
    rankMount.innerHTML='<details><summary>＋ '+(admin?'管理员：更新与审核国际排名':'跑友协作：提交世界／亚洲排名修正')+'</summary>'+
      '<p class="int-rank-help">'+(admin?'管理员可以审核、发布跑友的排名提议。':'Google 登录后可提交排名提议，核实后发布；不会立即覆盖官方排名。')+'请填写 World Athletics 对应项目、榜单日期与官方来源。亚洲排名无法核实可留空。</p>'+
      '<form id="wsdRankSuggestForm" class="int-rank-form">'+
      '<label>选手姓名 <select name="athlete_name" required><option value="">选择选手</option>'+names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('')+'</select></label>'+
      '<label>排名项目 <select name="event_name" required><option value="1500m">1500m</option><option value="3000m">3000m</option><option value="3000mSC">3000mSC</option><option value="5000m" selected>5000m</option><option value="10000m">10000m</option><option value="Half Marathon">Half Marathon</option><option value="Road Running">Road Running</option><option value="Marathon">Marathon</option></select></label>'+
      '<label>世界排名 <input name="world_rank" type="number" min="1" max="100000" placeholder="可留空"></label>'+
      '<label>亚洲排名 <input name="asia_rank" type="number" min="1" max="100000" placeholder="可留空"></label>'+
      '<label>排名积分 <input name="ranking_points" type="number" step="0.01" min="0" max="999999" placeholder="可留空"></label>'+
      '<label>官方榜单发布日期 <input name="ranking_date" type="date" min="2000-01-01" required></label>'+
      '<label class="int-rank-full">World Athletics 官方来源（HTTPS）<input name="source_url" type="url" maxlength="500" placeholder="https://worldathletics.org/..." required></label>'+
      '<button type="submit" class="btn btn-primary btn-small int-rank-submit">提交排名待审核</button>'+
      '</form><div class="int-rank-editor-status" id="wsdRankEditStatus" role="status" aria-live="polite"></div>'+
      (admin?'<div id="wsdRankReview" class="int-rank-review">审核队列读取中…</div>':'')+
      '</details>';
    if(admin)loadRankSuggestions().catch(err=>rankEditStatus('加载审核队列失败：'+err.message,true));
  }
  function rankEditStatus(message,bad=false){
    const el=$("wsdRankEditStatus");if(el){el.textContent=message;el.style.color=bad?'#ad3459':'#725160';}
  }
  function rankValidate(form){
    const fd=new FormData(form);
    const n=name=>String(fd.get(name)||'').trim();
    const world=n("world_rank"),asia=n("asia_rank"),points=n("ranking_points");
    const rankOf=v=>v===''?null:Number(v);
    if(world===''&&asia==='')throw Error('至少填写世界排名或亚洲排名。');
    const date=n("ranking_date");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>new Date(Date.now()+7*86400000).toISOString().slice(0,10))throw Error('请填写正确的官方排名发布日期。');
    const source=n("source_url");
    if(!https(source)||!source.toLowerCase().startsWith('https://worldathletics.org/')&&!source.toLowerCase().startsWith('https://www.worldathletics.org/'))throw Error('请使用 World Athletics 官方 HTTPS 链接。');
    const athlete=n("athlete_name");
    if(!(typeof getAthletes==='function'&&getAthletes().some(a=>a.name===athlete&&!a.communityOnly)))throw Error('请选择现有选手名单中的姓名。');
    const event=n("event_name");
    const allowed=new Set(['1500m','3000m','3000mSC','5000m','10000m','Half Marathon','Road Running','Marathon']);
    if(!allowed.has(event))throw Error('请选择有效的排名项目。');
    return {athlete_name:athlete,event_name:event,world_rank:rankOf(world),asia_rank:rankOf(asia),ranking_points:rankOf(points),ranking_date:date,source_url:source};
  }
  async function loadRankSuggestions(){
    const box=$("wsdRankReview");if(!box||!admin)return;
    const {data,error}=await sb.from('wsd_rank_suggestions').select('id,athlete_name,event_name,world_rank,asia_rank,ranking_points,ranking_date,source_url,created_at').eq('status','pending').order('created_at',{ascending:true}).limit(60);
    if(error)throw error;
    box.innerHTML='<strong>待审核排名提议（'+data.length+'）</strong>'+(data.length?data.map(r=>
      '<article class="int-rank-review-item"><b>'+esc(r.athlete_name)+' · '+esc(r.event_name)+'</b>'+
      '<small>世界：'+(r.world_rank??'—')+' / 亚洲：'+(r.asia_rank??'—')+' / 积分：'+(r.ranking_points??'—')+' / 日期：'+esc(r.ranking_date)+'</small>'+
      '<a href="'+esc(r.source_url)+'" target="_blank" rel="noopener noreferrer">核对官方来源 ↗</a>'+
      '<div class="tools"><button type="button" class="btn btn-primary btn-small" data-rank-approve="'+esc(r.id)+'">核实并发布</button><button type="button" class="btn btn-small" data-rank-reject="'+esc(r.id)+'">驳回</button></div></article>').join(''):'<p class="int-rank-help">暂无待审核提议。</p>');
  }
  async function decideRankSuggestion(id,approve){
    if(!admin)throw Error('只有管理员可以审核。');
    const {data:found,error:readError}=await sb.from('wsd_rank_suggestions').select('id,athlete_name,event_name,world_rank,asia_rank,ranking_points,ranking_date,source_url,status').eq('id',id).eq('status','pending').single();
    if(readError||!found)throw readError||Error('提议已处理。');
    if(approve){
      const {data:existing,error:exErr}=await sb.from('wsd_athlete_world_rankings').select('world_rank,asia_rank,ranking_points').eq('athlete_name',found.athlete_name).eq('event_name',found.event_name).eq('ranking_date',found.ranking_date).maybeSingle();
      if(exErr)throw exErr;
      const payload={athlete_name:found.athlete_name,event_name:found.event_name,ranking_date:found.ranking_date,source_url:found.source_url,
        world_rank:found.world_rank??existing?.world_rank??null,
        asia_rank:found.asia_rank??existing?.asia_rank??null,
        ranking_points:found.ranking_points??existing?.ranking_points??null,rank_basis:'official'};
      const {error:upErr}=await sb.from('wsd_athlete_world_rankings').upsert(payload,{onConflict:'athlete_name,event_name,ranking_date'});
      if(upErr)throw upErr;
    }
    const {error:decErr}=await sb.from('wsd_rank_suggestions').update({status:approve?'approved':'rejected',decided_at:new Date().toISOString()}).eq('id',id);
    if(decErr)throw decErr;
    if(approve&&typeof refreshInternationalRankings==='function')await refreshInternationalRankings();
    await loadRankSuggestions();
    rankEditStatus(approve?'已发布经核实的排名。':'已驳回此提议。');
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-wsd-rank-login]')){
      e.preventDefault();navigateCommunity();return;
    }
    const approve=e.target.closest('[data-rank-approve]'),reject=e.target.closest('[data-rank-reject]');
    if(approve||reject){
      e.preventDefault();const btn=approve||reject;btn.disabled=true;
      decideRankSuggestion(approve?.dataset.rankApprove||reject.dataset.rankReject,!!approve).catch(err=>{rankEditStatus('审核失败：'+err.message,true);btn.disabled=false;});
    }
  });
  document.addEventListener('submit',e=>{
    const form=e.target.closest('#wsdRankSuggestForm');if(!form)return;
    e.preventDefault();
    if(!user){rankEditStatus('请先登录。',true);return;}
    let payload;try{payload=rankValidate(form);}catch(err){rankEditStatus(err.message,true);return;}
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;
    sb.from('wsd_rank_suggestions').insert(payload).then(({error})=>{
      if(error)throw error;
      form.reset();rankEditStatus('排名提议已提交，管理员核对官方来源后会发布。');
      if(admin)loadRankSuggestions().catch(()=>{});
    }).catch(err=>rankEditStatus('提交失败：'+err.message,true)).finally(()=>{submit.disabled=false;});
  });

  sb.auth.onAuthStateChange(()=>{Promise.resolve().then(setAuth).catch(()=>{});});
  await setAuth();await Promise.all([refresh(),refreshCorrections(),refreshEditorial()]);
  const callbackParams=new URLSearchParams(location.search);
  const fragmentParams=new URLSearchParams(location.hash.startsWith("#")?location.hash.slice(1):"");
  const callbackError=callbackParams.get("error_description")||
     fragmentParams.get("error_description")||
     callbackParams.get("error");
  if(callbackError){
    try{sessionStorage.removeItem(oauthPendingKey);}catch(e){}
    navigateCommunity();
    note("Google 登录没有完成："+callbackError+"。请确认已在 Supabase 启用 Google Provider，且 Google Cloud 的授权回调地址准确。",true);
    // OAuth error details are no longer needed in the browser URL.
    history.replaceState(null,"",location.origin+location.pathname+"#community");
  }
  sb.channel("wsd-community-public").on("postgres_changes",
    {event:"*",schema:"public",table:TABLE},()=>{refresh().catch(()=>{});}).subscribe();
  // Reconnect fallback and updates from other tabs, keeping public feed fresh.
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)Promise.all([refresh(),refreshCorrections(),refreshEditorial()]).catch(()=>{});});
  window.addEventListener("focus",()=>Promise.all([refreshCorrections(),refreshEditorial()]).catch(()=>{}));
  // Date changes are refreshed periodically without broadcasting author IDs through Realtime.
  setInterval(()=>{if(!document.hidden)Promise.all([refreshCorrections(),refreshEditorial()]).catch(()=>{});},60000);
})();
