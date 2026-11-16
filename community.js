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
    '<section class="wsd-community-panel"><h3>发布比赛成绩或照片</h3><p>访客可以直接浏览。登录邮箱后即可投稿，发布后自动公开。投稿不会自动覆盖官方成绩或 PB。</p>'+
      '<div id="wsdSetup" class="wsd-community-alert" hidden></div>'+
      '<div id="wsdAuth" hidden>'+
        '<div class="wsd-community-auth-line"><strong id="wsdAuthName">未登录</strong><button class="btn btn-small" type="button" id="wsdSignOut" hidden>退出登录</button></div>'+
        '<div id="wsdLogin" class="wsd-auth-mode"><form id="wsdLoginForm" class="wsd-community-form">'+
          '<label>邮箱地址<input id="wsdEmail" type="email" maxlength="150" autocomplete="email" required placeholder="your@email.com"></label>'+
          '<div id="wsdTurnstile"></div><button class="btn btn-primary" type="submit" id="wsdLoginButton">发送登录邮件</button></form>'+
          '<p>使用邮箱登录链接验证身份。请在同一浏览器中打开邮件链接。</p></div>'+
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
          '<label>来源链接（成绩必填；HTTPS）<input id="wsdSource" type="url" maxlength="400" placeholder="https://..."></label>'+
          '<label>补充说明<input id="wsdNotes" maxlength="500" placeholder="可填赛事轮次、出处或授权说明；不要填隐私"></label>'+
          '<label class="wsd-community-tick"><input type="checkbox" id="wsdRights" required><span>我确认成绩与来源真实、拥有照片公开权限，未包含私人信息，同意立即公开及接受举报。</span></label>'+
          '<button type="submit" class="btn btn-primary" id="wsdPublish">发布后立即公开</button>'+
        '</form>'+
      '</div>'+
      '<div class="wsd-community-status" id="wsdCommunityStatus" role="status" aria-live="polite"></div>'+
      '<p class="wsd-community-help">登录需要验证码；每个账号限 1 条/分钟、6 条/小时、20 条/天。图片限制大小并重新编码以清除位置元数据。违规内容可以举报并由管理员撤下。</p>'+
    '</section><section class="wsd-community-panel"><div class="wsd-community-top">'+
    '<h3>跑友实时投稿</h3><select id="wsdFeedKind" aria-label="筛选投稿"><option value="all">所有投稿</option><option value="race">比赛成绩</option><option value="photo">人物照片</option></select></div>'+
    '<div class="wsd-community-feed" id="wsdFeed"><div class="wsd-community-skeleton">正在准备投稿列表…</div></div>'+
    '<p class="wsd-community-help">社区投稿不等于官方认证。请核对比赛原始来源；若发现错误、侵权或隐私问题，请举报。</p>'+
    '<div id="wsdAdminSummary" class="wsd-admin-indicator"></div>'+
    '</section></div>';
  const setup = $("wsdSetup");
  if (!(cfg.enabled===true && https(cfg.url) && safePublicKey(cfg.publishableKey) &&
        typeof cfg.turnstileSiteKey==="string" && cfg.turnstileSiteKey.length>8)) {
    setup.hidden=false;
    setup.innerHTML = '协作上传尚未开启：需要先安装数据库并填写 Supabase 公共配置。<a href="https://github.com/yileshi25-collab/waseda-running-lab/blob/main/COMMUNITY-SETUP.md" target="_blank" rel="noopener noreferrer">启用步骤 ↗</a>';
    $("wsdFeed").innerHTML='<div class="wsd-community-skeleton">未配置后端。原有网站和赛果仍可正常使用。</div>';
    return;
  }
  let createClient;
  try { ({createClient} = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")); }
  catch { note("数据库组件加载失败，请检查网络连接。",true);return; }
  const sb=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let user=null,admin=false,posts=[],active="all",captchaToken="",captchaWidget=null;
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
       (admin?'<button class="wsd-community-admin-post" data-wsd-hide="'+esc(r.id)+'" type="button">管理员撤下</button>':"")+
       '</footer></div></article>';
    }).join(""):'<div class="wsd-community-skeleton">暂无此类投稿。登录后可上传第一条。</div>';
    decorateRoster();
    decorateDetails();
  }
  async function refresh(){
    const {data,error}=await sb.from(TABLE).select(
      "id,kind,athlete_name,display_name,event_name,race_date,result_time,rank,notes,source_url,image_path,image_credit,image_license,created_at,status"
    ).eq("status","published").order("created_at",{ascending:false}).limit(60);
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
      const data=images.get(name),icon=cell.querySelector(".playericon");
      if(!data||!icon)return;
      const url=postImage(data);if(!url)return;
      const img=document.createElement("img");
      img.src=url;img.loading="lazy";img.referrerPolicy="no-referrer";
      img.alt=name+" · 跑友分享的照片";img.className="wsd-community-avatar";
      icon.replaceWith(img);
    });
  }
  function decorateDetails(){
    const body=$("detailBody");
    if(!body)return;
    const name=body.querySelector(".detail-head h2")?.textContent?.trim();
    if(!name||body.querySelector(".wsd-community-gallery"))return;
    const relevant=posts.filter(r=>r.athlete_name===name).slice(0,8);
    if(!relevant.length)return;
    const section=document.createElement("section");
    section.className="wsd-community-gallery";
    const cards=relevant.map(r=>{
      if(r.kind==="photo"){
        const url=postImage(r);
        return url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'"><img loading="lazy" alt="'+esc(name)+' 社区照片" src="'+esc(url)+'"><span>摄影：'+esc(r.image_credit||"")+'</span></a>':"";
      }
      return '<div class="wsd-community-mini-races">'+esc(r.race_date)+' · '+esc(r.event_name)+' · <b>'+esc(r.result_time)+'</b> '+sourceLink(r.source_url,"来源")+'</div>';
    }).join("");
    section.innerHTML='<h4>社区投稿 · '+relevant.length+' 条</h4><div class="wsd-community-gallery-items">'+cards+'</div><p class="wsd-community-help">跑友投稿，未经官方核实。</p>';
    body.querySelector(".detail-head")?.after(section);
  }
  $("wsdFeedKind").onchange=e=>{active=e.target.value;drawFeed();};
  const rosterEl=$("rosterBody"),detailEl=$("detailBody");
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
      const {data}=await sb.rpc("wsd_is_community_admin");
      admin=data===true;
      if(admin)loadReports();else $("wsdAdminSummary").textContent="";
    }else{admin=false;$("wsdAdminSummary").textContent="";}
    drawFeed();
  }
  async function loadTurnstile(){
    if(window.turnstile) {captchaWidget=window.turnstile.render("#wsdTurnstile",{
      sitekey:cfg.turnstileSiteKey,callback:t=>{captchaToken=t;},
      "expired-callback":()=>{captchaToken="";},
      "error-callback":()=>{captchaToken="";}
    });return;}
    const script=document.createElement("script");
    script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async=true;script.defer=true;
    script.onload=()=>loadTurnstile();
    script.onerror=()=>note("验证码无法加载；登录已关闭以防止滥用。",true);
    document.head.appendChild(script);
  }
  $("wsdLoginForm").onsubmit=async e=>{
    e.preventDefault();
    if(!captchaToken){note("请先通过验证码验证。",true);return;}
    const btn=$("wsdLoginButton");btn.disabled=true;
    try{
      const redirect=location.origin+location.pathname+"#community";
      const {error}=await sb.auth.signInWithOtp({
        email:$("wsdEmail").value.trim(),
        options:{emailRedirectTo:redirect,captchaToken}
      });
      if(error)throw error;
      note("已发送登录链接，请查看邮箱。");
    }catch(err){note("发送登录邮件失败："+err.message,true);}
    finally{
      btn.disabled=false;captchaToken="";
      if(window.turnstile&&captchaWidget!==null)window.turnstile.reset(captchaWidget);
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
    if(!user){note("请先登录邮箱账号。",true);return;}
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
        if(["cc-by","public-domain"].includes(license)&&!source)throw Error("开放授权需提供原始来源链接");
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
    $("wsdAdminSummary").innerHTML="<strong>管理员 · 举报处理</strong><p>当前显示最近 40 次举报。隐藏照片会同时尝试删除公开存储中的图片。</p>"+
      ([...grouped.entries()].map(([id,reasons])=>
        '<div class="wsd-admin-report"><span>'+esc(id)+' · '+reasons.length+' 次 · '+esc(reasons.join("、"))+
        '</span><button data-wsd-admin-hide="'+esc(id)+'" class="btn btn-small" type="button">隐藏内容</button></div>'
      ).join("")||'<p>暂无举报</p>');
  }
  async function hidePost(id){
    if(!admin)return;
    const {data:items,error:queryErr}=await sb.from(TABLE).select("id,kind,image_path,status").eq("id",id).limit(1);
    if(queryErr){note("无法加载目标内容："+queryErr.message,true);return;}
    const post=items?.[0];
    if(!post){note("未找到投稿。",true);return;}
    if(!confirm("确认撤下此投稿吗？照片会尝试从公共存储永久删除。"))return;
    const {error}=await sb.from(TABLE).update({status:"hidden"}).eq("id",id);
    if(error){note("撤下失败："+error.message,true);return;}
    let photoProblem="";
    if(post.kind==="photo"&&post.image_path){
      const {error:removeErr}=await sb.storage.from(BUCKET).remove([post.image_path]);
      if(removeErr)photoProblem="；图片删除失败，请在 Supabase Storage 手动删除："+removeErr.message;
    }
    note("投稿已撤下"+photoProblem,!!photoProblem);
    await refresh();await loadReports();
  }
  $("wsdAdminSummary").onclick=async e=>{
    const b=e.target.closest("[data-wsd-admin-hide]");
    if(b)await hidePost(b.dataset.wsdAdminHide);
  };
  $("wsdFeed").onclick=async e=>{
    const report=e.target.closest("[data-wsd-report]");
    const hide=e.target.closest("[data-wsd-hide]");
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
    if(hide&&admin)await hidePost(hide.dataset.wsdHide);
  };
  sb.auth.onAuthStateChange(()=>{Promise.resolve().then(setAuth).catch(()=>{});});
  await setAuth();await refresh();
  await loadTurnstile();
  sb.channel("wsd-community-public").on("postgres_changes",
    {event:"*",schema:"public",table:TABLE},()=>{refresh().catch(()=>{});}).subscribe();
  // Reconnect fallback and updates from other tabs, keeping public feed fresh.
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh().catch(()=>{});});
})();
