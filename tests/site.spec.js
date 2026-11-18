const {test, expect} = require('@playwright/test');
const USER='11111111-1111-4111-8111-111111111111';
const PHOTO='22222222-2222-4222-8222-222222222222';
async function setup(page, {guest=false, failInsert=false, failRefresh=false}={}) {
  await page.addInitScript(({USER,PHOTO,guest,failInsert,failRefresh}) => {
    window.__mock={user:guest?null:{id:USER,email:'runner@example.test',user_metadata:{}},news:[2026,2027].flatMap(year=>[1,2].map(n=>({id:`${year}-${n}`,event_year:year,title:`${year} 赛事新闻标题 ${n}`,summary:'这是用于浏览器回归验证的新闻摘要内容。',published_at:'2026-11-17',category:'箱根驿传',athlete_names:[],source_url:'https://example.test/news',author_id:USER}))),posts:[],removed:[],calls:[],authCallbacks:[],failInsert,failRefresh,committed:false};
    const m=window.__mock;
    const query = table => {
      let op='select', payload, filters=[];
      const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},limit(){return q;},in(){return q;},maybeSingle(){return q;},insert(v){op='insert';payload=v;return q;},upsert(v){op='insert';payload=v;return q;},update(v){op='update';payload=v;return q;},delete(){op='delete';return q;},then(resolve,reject){return Promise.resolve().then(()=>{
        m.calls.push({table,op,payload});
        let list=table==='wsd_event_news'?m.news:table==='wsd_community_submissions'?m.posts:[];
        if(op==='select'&&table==='wsd_community_submissions'&&m.committed&&m.failRefresh)throw Error('simulated refresh failure');
        if(op==='insert'){
          if(m.failInsert)return {data:null,error:{message:'simulated insert failure'}};
          const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),status:'published',...payload};
          list.push(row);m.committed=true;return {data:[{id:row.id}],error:null};
        }
        const selected=list.filter(x=>filters.every(([k,v])=>x[k]===v));
        if(op==='update')selected.forEach(x=>Object.assign(x,payload));
        if(op==='delete')selected.forEach(x=>list.splice(list.indexOf(x),1));
        return {data:selected,error:null};
      }).then(resolve,reject);}};return q;
    };
    window.__client={auth:{getUser:async()=>({data:{user:m.user}}),onAuthStateChange:fn=>{m.authCallbacks.push(fn);return {};},signOut:async()=>{m.user=null;return {};},signInWithOAuth:async()=>({})},from:query,rpc:async (name,args)=>{if(name==='wsd_set_photo_primary'){m.posts.forEach(x=>x.is_primary=x.id===args.p_photo_id);}if(name==='wsd_update_photo_crop'){Object.assign(m.posts.find(x=>x.id===args.p_photo_id),{focal_x:args.p_x,focal_y:args.p_y});}return {data:name==='wsd_is_community_admin'?false:name==='wsd_my_submission_ids'?m.posts.map(x=>x.id):[],error:null};},storage:{from:()=>({upload:async()=>({error:null}),remove:async keys=>{m.removed.push(...keys);return {error:null};},getPublicUrl:key=>({data:{publicUrl:'https://example.test/'+key}})})},channel:()=>({on(){return this;},subscribe(){return this;}})};
  },{USER,PHOTO,guest,failInsert,failRefresh});
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({contentType:'application/javascript',body:'export const createClient=()=>window.__client;'}));
  await page.route('https://example.test/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"/>'}));
  await page.route('https://*.supabase.co/**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
  await page.goto('/');
  await expect(page.locator('[data-news-year="2026"] .wsd-news-card')).toHaveCount(2);
}
test('homepage introduces the site and offers beginner navigation',async({page})=>{
  await setup(page);
  const guide=page.locator('#view-overview .wsd-start');
  await expect(guide).toBeVisible();
  await expect(guide.locator('.wsd-start-card')).toHaveCount(3);
  await expect(guide.locator('.wsd-start-glossary')).not.toHaveAttribute('open','');
  await guide.locator('summary').click();
  await expect(guide.locator('dt')).toHaveCount(6);
  await expect(guide).toContainText('箱根驿传');
  await guide.locator('[data-go="athletes"]').click();
  await expect(page.locator('#view-athletes')).toBeVisible();
  await expect(page).toHaveURL(/#athletes$/);
  await page.evaluate(()=>show('overview'));
  await guide.locator('[data-go="season"]').click();
  await expect(page.locator('#view-season')).toBeVisible();
  await page.evaluate(()=>show('overview'));
  await guide.locator('[data-go="races"]').click();
  await expect(page.locator('#view-races')).toBeVisible();
});

test('beginner navigation fits a narrow phone screen',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await setup(page);
  const guide=page.locator('#view-overview .wsd-start');
  await expect(guide).toBeVisible();
  await expect(guide.locator('.wsd-start-card')).toHaveCount(3);
  await expect(guide.evaluate(el=>el.scrollWidth <= el.clientWidth)).resolves.toBe(true);
});


test('home highlights the meaning of a PB using on-site athlete comparisons',async({page})=>{
  await setup(page);
  const story=page.locator('#homePerformanceStory');
  await expect(story).toBeVisible();
  await expect(story.locator('#wsdStoryPB')).toHaveText('13:17.19');
  await expect(story.locator('#wsdStoryExplanation')).toContainText('排名第1');
  await expect(story.locator('#wsdStoryPace')).toContainText('2:39/km');
  await expect(story).toContainText('区间第1');
  await story.locator('[data-player="山口 竣平"]').click();
  await expect(page.locator('#detailOverlay')).toHaveClass(/active/);
  await expect(page.locator('#detailBody [data-athlete-insight]')).toContainText('第1 / 38');
  await expect(page.locator('#detailBody [data-athlete-insight]')).toContainText('区间第1名');
});

test('PB explanations follow the selected distance and race interpretations follow the selected race',async({page})=>{
  await setup(page);
  const rank=page.locator('#wsdRankInsight');
  await expect(rank).toContainText('5000m');
  await page.locator('#rankingPills [data-rank-metric="pb10000"]').click();
  await expect(rank).toContainText('10000m');
  await page.evaluate(()=>show('races'));
  const race=page.locator('#wsdRaceInsight');
  await expect(race).toContainText('同一赛段');
  await expect(race).toContainText('全日本大学駅伝');
  await page.locator('#racePills [data-race="izu"]').click();
  await expect(race).toContainText('出雲駅伝');
  await expect(race).toContainText('区间第1');
  await page.locator('#racePills [data-race="hak"]').click();
  await expect(race).toContainText('箱根駅伝');
  await expect(race).toContainText('全队最终第4名');
});

async function newsForm(page,year=2026) {
  await page.evaluate(year=>show(year===2026?'season':'archive2027'),year);
  const p=page.locator(`[data-news-year="${year}"]`);
  await p.locator('.wsd-news-toggle').click();
  const f=p.locator('form');
  await f.locator('[name=title]').fill('新投稿赛事新闻标题');
  await f.locator('[name=summary]').fill('这是一段足够长度的赛事新闻摘要，用于验证投稿功能。');
  await f.locator('[name=published_at]').fill('2026-11-17');
  await f.locator('[name=source_url]').fill('https://example.test/news');
  return {p,f};
}
for(const year of [2026,2027])test(`${year} publish/edit/delete and preserve fold`,async({page})=>{
  await setup(page);const {p,f}=await newsForm(page,year);
  await f.locator('[type=submit]').click();
  await expect(f).toBeVisible();await expect(p.locator('.wsd-news-feedback')).toContainText('已公开发布');
  await expect(p.locator('.wsd-news-card')).toHaveCount(3);
  await p.locator('summary').click();await p.locator('[data-news-action=edit]').last().click();
  await f.locator('[name=title]').fill('修改后的赛事新闻标题');await f.locator('[type=submit]').click();
  await expect(p.locator('details')).toHaveAttribute('open','');
  await expect(p.locator('.wsd-news-card h3').last()).toHaveText('修改后的赛事新闻标题');
  page.once('dialog',d=>d.accept());await p.locator('[data-news-action=delete]').last().click();
  await expect(p.locator('.wsd-news-card')).toHaveCount(2);await expect(p.locator('.wsd-news-feedback')).toHaveText('新闻已删除。');
});
test('guest cannot publish or see management controls',async({page})=>{
  await setup(page,{guest:true});const {p,f}=await newsForm(page);
  await f.locator('[type=submit]').click();await expect(f.locator('.wsd-news-status')).toContainText('Google 登录');
  await expect(p.locator('[data-news-action]')).toHaveCount(0);
  expect(await page.evaluate(()=>__mock.calls.filter(x=>x.op==='insert'))).toHaveLength(0);
});
test('failed news insert retains draft and re-enables submit',async({page})=>{
  await setup(page,{failInsert:true});const {f}=await newsForm(page);
  await f.locator('[type=submit]').click();await expect(f.locator('.wsd-news-status')).toContainText('simulated insert failure');
  await expect(f.locator('[name=title]')).toHaveValue('新投稿赛事新闻标题');await expect(f.locator('[type=submit]')).toBeEnabled();
});
async function photoForm(page){
  await page.evaluate(()=>{show('athletes');openDetail(BASE_ATHLETES[0].name);});
  const f=page.locator('[data-wsd-photo-form]');await expect(f).toBeVisible();
  // Generate a real PNG so canvas JPEG conversion is exercised.
  const bytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=480;c.getContext('2d').fillRect(0,0,320,480);return c.toDataURL().split(',')[1];});
  await f.locator('[name=photo]').setInputFiles({name:'runner.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
  await expect(f.locator('[data-wsd-photo-preview]')).toBeVisible();
  await f.locator('[name=credit]').fill('摄影测试');await f.locator('[name=rights]').check();return f;
}
test('photo upload keeps form and feedback visible',async({page})=>{
  await setup(page);const f=await photoForm(page);await f.locator('[type=submit]').click();
  await expect(f.locator('[data-wsd-photo-status]')).toContainText('上传成功');await expect(f).toBeVisible();
  await expect(page.locator('.wsd-athlete-main-photo')).toHaveCount(1);
  expect(await page.evaluate(()=>__mock.removed)).toHaveLength(0);
});
test('saved photo survives refresh failure',async({page})=>{
  await setup(page,{failRefresh:true});const f=await photoForm(page);await f.locator('[type=submit]').click();
  await expect(f.locator('[data-wsd-photo-status]')).toContainText('照片已发布，但列表刷新失败');
  expect(await page.evaluate(()=>__mock.removed)).toHaveLength(0);await expect(f.locator('[type=submit]')).toBeEnabled();
});
test('failed photo insert cleans orphan and preserves draft',async({page})=>{
  await setup(page,{failInsert:true});const f=await photoForm(page);await f.locator('[type=submit]').click();
  await expect(f.locator('[data-wsd-photo-status]')).toContainText('照片发布失败');
  expect(await page.evaluate(()=>__mock.removed)).toHaveLength(1);await expect(f.locator('[name=credit]')).toHaveValue('摄影测试');
});
test('mobile news has no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:375,height:812});await setup(page);const {p,f}=await newsForm(page);
  expect(await p.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await expect(f.locator('[type=submit]')).toBeVisible();
});
test('photo metadata, crop, cover and delete controls',async({page})=>{
  await setup(page);let f=await photoForm(page);await f.locator('[type=submit]').click();
  await expect(f.locator('[data-wsd-photo-status]')).toContainText('上传成功');
  f=await photoForm(page);await f.locator('[type=submit]').click();
  await expect(page.locator('[data-wsd-photo-count]')).toContainText('2 张');
  const section=page.locator('.wsd-athlete-photo-section');
  await section.locator('[data-wsd-edit-photo-info]').first().click();
  const edit=section.locator('.wsd-photo-info-edit-form');
  await edit.locator('[name=image_credit]').fill('更新后的摄影署名');
  // Background auth refresh must not erase this draft.
  await page.evaluate(()=>__mock.authCallbacks.forEach(fn=>fn('TOKEN_REFRESHED',{user:__mock.user})));
  await expect(edit.locator('[name=image_credit]')).toHaveValue('更新后的摄影署名');
  await edit.locator('[type=submit]').click();await expect(edit).toHaveCount(0);
  await expect(section).toContainText('更新后的摄影署名');
  await section.locator('[data-wsd-edit-crop]').first().click();
  await page.locator('#wsdPhotoCropForm [name=focal_y]').fill('60');
  await page.locator('[data-wsd-crop-save]').click();
  await expect(section.locator('.wsd-athlete-main-photo')).toHaveCSS('object-position','50% 60%');
  await section.locator('[data-wsd-set-cover]').click();
  await expect(section.locator('.wsd-athlete-main-photo')).toHaveCSS('object-position','50% 20%');
  page.once('dialog',d=>d.accept());await section.locator('[data-wsd-delete]').first().click();
  await expect(section.locator('[data-wsd-photo-count]')).toContainText('1 张');
  expect(await page.evaluate(()=>__mock.removed)).toHaveLength(1);
});
test('unsafe stored news source is not rendered as executable link',async({page})=>{
  await setup(page);await page.evaluate(()=>{__mock.news[0].source_url='javascript:alert(1)';__mock.authCallbacks.forEach(fn=>fn('TOKEN_REFRESHED',{user:__mock.user}));});
  await expect(page.locator('[data-news-year="2026"] .wsd-news-card').first().locator('a')).toHaveCount(0);
});
test('mobile photo draft survives background refresh and fits detail panel',async({page})=>{
  await page.setViewportSize({width:375,height:812});await setup(page);const f=await photoForm(page);
  await page.evaluate(()=>__mock.authCallbacks.forEach(fn=>fn('TOKEN_REFRESHED',{user:__mock.user})));
  await expect(f.locator('[data-wsd-photo-preview]')).toBeVisible();
  await expect(f.locator('[name=credit]')).toHaveValue('摄影测试');
  expect(await f.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
test('community photo submission retains photo mode after success',async({page})=>{
  await setup(page);await page.evaluate(()=>show('community'));
  await page.locator('#wsdKind').selectOption('photo');
  await page.locator('#wsdAthlete').fill('山口 竣平');await page.locator('#wsdDisplayName').fill('测试跑友');
  await page.locator('#wsdCredit').fill('测试摄影');
  const bytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=300;return c.toDataURL().split(',')[1];});
  await page.locator('#wsdPhoto').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
  await page.locator('#wsdRights').check();await page.locator('#wsdPublish').click();
  await expect(page.locator('#wsdCommunityStatus')).toContainText('已公开发布');
  await expect(page.locator('#wsdKind')).toHaveValue('photo');await expect(page.locator('#wsdPhoto')).toBeVisible();
});
