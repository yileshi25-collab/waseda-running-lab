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
            '<label>比赛项目<input id="wsdEvent" maxlength="80" placeholder="5000m / 箱根驿传 4区"></label>'+
            '<label>比赛日期<input id="wsdRaceDate" type="date" min="2020-01-01"></label>'+
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
      '<p class="wsd-community-help">Google 账号登录；每个账号限 1 条/分钟、6 条/小时、20 条/天。图片限制大小并重新编码以清除位置元数据。作者可删除自己的投稿，管理员可删除任何投稿；违规内容也可举报。</p>'+
    '</section><section class="wsd-community-panel"><div class="wsd-community-top">'+
    '<h3>跑友实时投稿</h3><select id="wsdFeedKind" aria-label="筛选投稿"><option value="all">所有投稿</option><option value="race">比赛成绩</option><option value="photo">人物照片</option></select></div>'+
    '<div class="wsd-community-feed" id="wsdFeed"><div class="wsd-community-skeleton">正在准备投稿列表…</div></div>'+
    '<p class="wsd-community-help">社区投稿不等于官方认证。请核对比赛原始来源；若发现错误、侵权或隐私问题，请举报。</p>'+
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
  function drawFeed(){
    const items=posts.filter(r=>active==="all"||r.kind===active);
    $("wsdFeed").innerHTML=items.length?items.map(r=>{
      const image=r.kind==="photo"?postImage(r):"";
      const metadata=r.kind==="race"?
        '<strong>'+esc(r.result_time||"")+'</strong><div class="wsd-post-meta"><span>'+esc(r.event_name||"")+'</span><span>'+esc(r.race_date||"")+'</span>'+
        (r.rank?'<span>第 '+Number(r.rank)+' 名</span>':"")+'</div>':
        '<small>摄影／来源：'+esc(r.image_credit||"")+' · '+esc(r.image_license||"")+'</small>';
      return '<article class="wsd-post">'+(image?'<img loading="lazy" referrerpolicy="no-referrer" class="wsd-post-photo" src="'+esc(image)+'" alt="'+esc(r.athlete_name)+' 投稿照片">':"")+
       '<div class="wsd-post-body"><div class="wsd-post-type">'+(r.kind==="photo"?"PHOTO / 跑友照片":"RACE / 跑友成绩")+'</div>'+
       '<h4>'+esc(r.athlete_name)+'</h4>'+metadata+
       (r.notes?'<p>'+esc(r.notes)+'</p>':"")+
       '<small>投稿者：'+esc(r.display_name)+' · '+new Date(r.created_at).toLocaleString("zh-CN")+'</small>'+
       '<footer>'+sourceLink(r.source_url,"资料来源")+
       (user?'<button data-wsd-report="'+esc(r.id)+'" type="button">举报</button>':'<small>登录后可举报</small>')+
       (user&&(admin||r.author_id===user.id)?'<button class="wsd-community-delete" data-wsd-delete="'+esc(r.id)+'" type="button">'+(admin&&r.author_id!==user.id?'管理员删除':'删除我的投稿')+'</button>':"")+
       '</footer></div></article>';
    }).join(""):'<div class="wsd-community-skeleton">暂无此类投稿。登录后可上传第一条。</div>';
    decorateRoster();
    decorateDetails();
  }
  async function refresh(){
    const {data,error}=await sb.from(TABLE).select(
      "id,author_id,kind,athlete_name,display_name,event_name,race_date,result_time,rank,notes,source_url,image_path,image_credit,image_license,created_at,status"
    ).eq("status","published").order("created_at",{ascending:false}).limit(200);
    if(error){note("读取社区资料失败："+error.message,true);return;}
    posts=data||[];drawFeed();
  }
  function decorateRoster(){
    const list=$("rosterBody");
    if(!list)return;
    const images=new Map();
    for(const r of posts)if(r.kind==="photo"&&!images.has(r.athlete_name))images.set(r.athlete_name,r);
    list.querySelectorAll(".playercell").forEach(cell=>{
      const name=cell.querySelector("[data-player]")?.getAttribute("data-player");
      if(!name)return;
      const data=images.get(name);
      const icon=cell.querySelector(".playericon");
      const current=cell.querySelector("img.wsd-community-avatar");
      const url=data?postImage(data):"";
      if(!url){
        if(current){
          const placeholder=document.createElement("div");
          placeholder.className="playericon";placeholder.textContent="W";
          current.replaceWith(placeholder);
        }
        return;
      }
      if(current){if(current.getAttribute("src")!==url)current.src=url;return;}
      if(!icon)return;
      const img=document.createElement("img");
      img.src=url;img.loading="lazy";img.referrerPolicy="no-referrer";
      img.alt=name+" · 跑友分享的照片";img.className="wsd-community-avatar";
      icon.replaceWith(img);
    });
  }
  function photoCardsFor(name){
    const all=posts.filter(r=>r.athlete_name===name&&r.kind==="photo").slice(0,16);
    const cards=all.map(r=>{
      const url=postImage(r);
      return url?'<div class="wsd-athlete-photo-tile"><a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'" title="摄影：'+esc(r.image_credit||"")+'">'+
         '<img loading="lazy" referrerpolicy="no-referrer" alt="'+esc(name)+' 跑友分享照片" src="'+esc(url)+'">'+
         '<span>摄影：'+esc(r.image_credit||"")+'</span></a>'+
         (user&&(admin||r.author_id===user.id)?'<button class="wsd-photo-tile-delete" type="button" data-wsd-delete="'+esc(r.id)+'">删除照片</button>':"")+
         '</div>':"";
    }).join("");
    return {count:all.length,ids:all.map(r=>r.id).join(","),
      html:cards||'<div class="wsd-no-athlete-photos"><span aria-hidden="true">▧</span><strong>暂无公开照片</strong><small>欢迎上传你有权分享的选手照片</small></div>'};
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
  function decorateDetails(){
    const body=$("detailBody");
    if(!body)return;
    const head=body.querySelector(".detail-head");
    const name=head?.querySelector("h2")?.textContent?.trim();
    if(!name)return;
    let section=body.querySelector(".wsd-community-gallery");
    if(section&&section.dataset.wsdAthlete!==name){section.remove();section=null;}
    if(!section){
      section=document.createElement("section");
      section.className="wsd-community-gallery wsd-athlete-photo-section";
      section.dataset.wsdAthlete=name;
      section.innerHTML='<div class="wsd-athlete-photo-heading"><h4>选手照片 · ATHLETE PHOTOS</h4>'+
        '<span data-wsd-photo-count>0 张</span></div>'+
        '<div class="wsd-athlete-photo-collection" data-wsd-photo-cards></div>'+
        '<div data-wsd-uploader></div>'+
        '<div class="wsd-athlete-race-extras" data-wsd-athlete-races></div>';
      head.after(section);
    }
    const result=photoCardsFor(name);
    const cards=section.querySelector("[data-wsd-photo-cards]");
    if(cards.dataset.photoIds!==result.ids){
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
    const races=posts.filter(r=>r.athlete_name===name&&r.kind==="race").slice(0,6);
    const extras=section.querySelector("[data-wsd-athlete-races]");
    const raceIds=races.map(r=>r.id).join(",");
    if(extras.dataset.raceIds!==raceIds){
      extras.innerHTML=races.length?'<h5>跑友补充赛果</h5>'+
        races.map(r=>'<div class="wsd-community-mini-races">'+
          esc(r.race_date||"")+" · "+esc(r.event_name||"")+" · <b>"+esc(r.result_time||"")+"</b> "+
          sourceLink(r.source_url,"来源")+
          (user&&(admin||r.author_id===user.id)?' <button type="button" class="wsd-athlete-race-delete" data-wsd-delete="'+esc(r.id)+'">删除投稿</button>':"")+
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
      if(admin)loadReports();else $("wsdAdminSummary").textContent="";
    }else{admin=false;$("wsdAdminSummary").textContent="";}
    drawFeed();
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
    const name=$("wsdAthlete").value.trim();
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
    if(!user){note("请先使用 Google 登录后再删除投稿。",true);return;}
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
      note("无效的投稿 ID。",true);return;
    }
    const {data:records,error:lookupError}=await sb.from(TABLE)
      .select("id,author_id,kind,image_path,status").eq("id",id).limit(1);
    if(lookupError){note("无法检查投稿权限："+lookupError.message,true);return;}
    const item=records?.[0];
    if(!item){note("这条投稿不存在或你无权查看。",true);await refresh();return;}
    if(!admin&&item.author_id!==user.id){
      note("你只能删除自己发布的投稿。",true);return;
    }
    const description=item.kind==="photo"?"照片":"比赛成绩";
    if(!confirm("确定永久删除这条"+description+"投稿吗？\n删除后将从社区列表和选手资料页移除，且无法撤销。"))return;
    const {data:deleted,error:deleteError}=await sb.from(TABLE)
      .delete().eq("id",id).select("id");
    if(deleteError){note("删除投稿失败："+deleteError.message,true);return;}
    if(!deleted?.length){
      note("删除未成功：投稿可能已被删除，或当前账号没有删除权限。",true);
      await refresh();return;
    }
    let warning="";
    if(item.kind==="photo"&&item.image_path){
      try{
        // Existing Storage policy allows owner to remove an unreferenced file,
        // or an administrator to remove it. Delete DB row first.
        const {error:storageError}=await sb.storage.from(BUCKET).remove([item.image_path]);
        if(storageError)throw storageError;
      }catch(err){
        warning="；但云端原图清理失败，请通知管理员进入 Supabase Storage 手动删除该文件";
      }
    }
    await refresh();
    if(admin)await loadReports();
    note("这条"+description+"投稿已永久删除"+warning,!!warning);
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
  sb.auth.onAuthStateChange(()=>{Promise.resolve().then(setAuth).catch(()=>{});});
  await setAuth();await refresh();
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
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh().catch(()=>{});});
})();
