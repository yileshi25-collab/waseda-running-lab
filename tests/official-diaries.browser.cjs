/* Browser integration for official diary index and community submission linkage.
   Run after npm ci, starting python3 -m http.server 8080 first. Supabase is mocked. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const MOCK_SOURCE = "\n  window.__diaryData=[];\n  window.__diaryOverrides=[];\n  window.__isAdmin=__ADMIN__;\n  const USER='11111111-1111-4111-8111-111111111111';\n  export const createClient=()=>({\n    auth:{\n      getUser:async()=>({data:{user:{id:USER,email:'runner@example.test'}}}),\n      onAuthStateChange:()=>({}),signOut:async()=>({})\n    },\n    rpc:async name=>({\n      data:name==='wsd_is_community_admin'?window.__isAdmin:\n        name==='wsd_my_editorial_ids'?window.__diaryData.filter(x=>x.author_id===USER).map(x=>({id:x.id})):[],\n      error:null\n    }),\n    from:table=>{\n      let op='select',payload;\n      const filters=[];\n      const data=()=>table==='wsd_community_editorial'?window.__diaryData:\n        table==='wsd_official_diary_overrides'?window.__diaryOverrides:[];\n      const matching=()=>data().filter(x=>filters.every(([k,v])=>x[k]===v));\n      const q={\n        select:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>q,\n        eq:(k,v)=>{filters.push([k,v]);return q;},\n        insert:v=>{op='insert';payload=v;return q;},\n        upsert:v=>{op='upsert';payload=v;return q;},\n        update:v=>{op='update';payload=v;return q;},\n        delete:()=>{op='delete';return q;},\n        then:(resolve,reject)=>Promise.resolve().then(()=>{\n          const rows=data();\n          // Reflect the production DB column grants: UPSERT cannot update the immutable PK.\n          // Also reject accidental non-table fields such as UI-only \"id\".\n          if(table==='wsd_official_diary_overrides' &&\n             (op==='upsert'||payload&&('id' in payload||'updated_at' in payload)))\n            return {data:null,error:{message:'permission denied for table wsd_official_diary_overrides'}};\n          if(op==='insert'){\n            const row={id:crypto.randomUUID(),created_at:'2026-11-17T10:00:00Z',related_athletes:[],...payload};\n            rows.push(row);return {data:[{id:row.id}],error:null};\n          }\n          if(op==='upsert'){\n            const idx=rows.findIndex(r=>r.diary_id===payload.diary_id);\n            if(idx<0)rows.push({...payload});\n            else rows[idx]={...rows[idx],...payload};\n            return {data:[{diary_id:payload.diary_id}],error:null};\n          }\n          if(op==='update'){\n            const chosen=matching();chosen.forEach(row=>Object.assign(row,payload));\n            return {data:chosen.map(row=>({id:row.id,diary_id:row.diary_id})),error:null};\n          }\n          if(op==='delete'){\n            const chosen=matching();\n            chosen.forEach(row=>rows.splice(rows.indexOf(row),1));\n            return {data:chosen.map(row=>({id:row.id})),error:null};\n          }\n          return {data:matching(),error:null};\n        }).then(resolve,reject)\n      };\n      return q;\n    },\n    channel:()=>({on(){return this},subscribe(){return this}})\n  });\n";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH ||
    (require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  const stubNetwork = async (page,script) => {
    await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>
      route.fulfill({contentType:'application/javascript',body:script}));
    await page.route('https://*.supabase.co/**',route=>
      route.fulfill({contentType:'application/json',body:'[]'}));
  };
  try {
    const guest=await browser.newPage({viewport:{width:375,height:812}});
    await stubNetwork(guest,
      'export const createClient=()=>({auth:{getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({})},'+
      'rpc:async()=>({data:[],error:null}),from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,'+
      'maybeSingle:()=>q,then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};return q;},'+
      'channel:()=>({on(){return this},subscribe(){return this}})});');
    await guest.goto('http://127.0.0.1:8080/');
    await guest.evaluate(()=>show('community'));
    const section=guest.locator('#wsdOfficialDiaries');
    await guest.waitForFunction(()=>document.querySelector('[data-diary-status]')?.textContent.includes('319'));
    assert.equal(await section.locator('[data-diary-list] .wsd-official-diary-card').count(),5);
    assert.equal(await section.locator('[data-diary-archive]').getAttribute('open'),null);
    assert.ok(await section.evaluate(el=>el.scrollWidth<=el.clientWidth));
    assert.equal(await section.locator('[data-diary-edit],[data-diary-delete],[data-wsd-editorial-edit]').count(),0);
    assert.equal(await section.locator('[data-diary-list] [data-diary-suggest]').count(),5);
    assert.equal(await section.locator('[data-diary-add-panel]').count(),1);
    await section.locator('[data-diary-archive] summary').click();
    assert.equal(await section.locator('[data-diary-archive-list] .wsd-official-diary-card').count(),24);
    await section.locator('[data-diary-more]').click();
    assert.equal(await section.locator('[data-diary-archive-list] .wsd-official-diary-card').count(),48);
    await section.locator('[data-diary-search]').fill('谷川 航太');
    assert.ok(await section.locator('[data-diary-archive-list] .wsd-official-diary-card').count()>0);
    await section.locator('[data-diary-search]').fill('');
    await section.locator('[data-diary-month]').selectOption('2026-01');
    assert.ok(await section.locator('[data-diary-archive-list] .wsd-official-diary-card').count()>0);
    for(const date of await section.locator('[data-diary-archive-list] time').allTextContents())
      assert.ok(date.startsWith('2026-01'));
    await guest.evaluate(()=>{show('athletes');openDetail('谷川 航太');});
    const group=guest.locator('#detailBody [data-wsd-editorial-group="diary"]');
    await group.waitFor();await group.locator('summary').click();
    await guest.waitForFunction(()=>document.querySelector('[data-wsd-editorial-group="diary"]')?.textContent.includes('≠philanthropy'));
    assert.equal(await group.locator('[data-wsd-editorial-edit],[data-wsd-editorial-delete]').count(),0);
    await guest.close();

    const offline=await browser.newPage();
    await offline.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.abort());
    await offline.route('https://*.supabase.co/**',route=>route.abort());
    await offline.goto('http://127.0.0.1:8080/');
    await offline.evaluate(()=>show('community'));
    await offline.waitForFunction(()=>document.querySelector('[data-diary-status]')?.textContent.includes('319'));
    await offline.close();

    async function signedInPage(isAdmin) {
      const page=await browser.newPage({viewport:{width:375,height:812}});
      await stubNetwork(page,MOCK_SOURCE.replace('__ADMIN__',String(isAdmin)));
      await page.goto('http://127.0.0.1:8080/');
      await page.evaluate(()=>show('community'));
      await page.waitForFunction(()=>document.querySelector('[data-diary-status]')?.textContent.includes('319') &&
        !!window.WSD_COMMUNITY_DIARY_PERMISSIONS);
      return page;
    }
    // Regular signed-in runner can add, edit, delete own diary and automatically update both views.
    const runner=await signedInPage(false);
    const runnerSection=runner.locator('#wsdOfficialDiaries');
    assert.equal(await runnerSection.locator('[data-diary-edit],[data-diary-delete]').count(),0);
    await runnerSection.locator('[data-diary-add-panel] summary').click();
    const form=runnerSection.locator('[data-diary-add-form]');
    await form.locator('[name="athlete_name"]').fill('谷川航太');
    await form.locator('[name="title"]').fill('谷川航太：テスト日誌');
    await form.locator('[name="published_at"]').fill('2026-11-17');
    await form.locator('[name="source_url"]').fill('https://waseda-ac.jp/diary/detail/999999');
    await form.locator('[name="display_name"]').fill('駅伝ファン');
    await form.locator('[type="submit"]').click();
    const posted=runnerSection.locator('[data-diary-list] .wsd-diary-contribution').first();
    await posted.waitFor();
    assert.ok((await posted.textContent()).includes('テスト日誌'));
    await runner.waitForFunction(()=>document.querySelector('#wsdFeed')?.textContent.includes('テスト日誌'));
    assert.equal(await runner.evaluate(()=>window.__diaryData[0].athlete_name),'谷川 航太');
    await runner.evaluate(()=>{show('athletes');openDetail('谷川 航太');});
    await runner.waitForFunction(()=>document.querySelector('#detailBody [data-wsd-editorial-group="diary"]')?.textContent.includes('テスト日誌'));
    await runner.evaluate(()=>{closeDetail();show('community');});

    await posted.locator('[data-wsd-editorial-edit]').click();
    await posted.locator('.wsd-editorial-admin-form input[name="title"]').fill('谷川航太：修正後の日誌');
    await posted.locator('.wsd-editorial-admin-form [type="submit"]').click();
    await runner.waitForFunction(()=>window.__diaryData[0]?.title.includes('修正後'));
    await runner.waitForFunction(()=>document.querySelector('#wsdFeed')?.textContent.includes('修正後'));
    runner.once('dialog',dialog=>dialog.accept());
    await posted.locator('[data-wsd-editorial-delete]').click();
    await runner.waitForFunction(()=>window.__diaryData.length===0);
    await runner.waitForFunction(()=>!document.querySelector('#wsdFeed')?.textContent.includes('修正後'));
    await runner.close();

    // Admin can moderate another person's post and maintain original official index.
    const admin=await signedInPage(true);
    const adminSection=admin.locator('#wsdOfficialDiaries');
    await admin.evaluate(()=>{
      window.__diaryData.push({
        id:crypto.randomUUID(),author_id:'22222222-2222-4222-8222-222222222222',
        athlete_name:'谷川 航太',scope:'bio',race_ref:null,related_athletes:[],category:'diary',
        title:'他人の投稿',body:'',display_name:'別の跑友',
        published_at:'2026-11-17',source_url:'https://waseda-ac.jp/diary/detail/999998',
        created_at:'2026-11-17T10:00:00Z'
      });
      window.dispatchEvent(new Event('wsd-community-editorial-refresh'));
    });
    await admin.waitForFunction(()=>document.querySelector('#wsdOfficialDiaries')?.textContent.includes('他人の投稿'));
    const otherPost=adminSection.locator('.wsd-diary-contribution').first();
    assert.equal(await otherPost.locator('[data-wsd-editorial-edit]').count(),1);
    await otherPost.locator('[data-wsd-editorial-edit]').click();
    await otherPost.locator('.wsd-editorial-admin-form input[name="title"]').fill('管理者が修正');
    await otherPost.locator('.wsd-editorial-admin-form [type="submit"]').click();
    await admin.waitForFunction(()=>window.__diaryData[0]?.title==='管理者が修正');
    admin.once('dialog',dialog=>dialog.accept());
    await otherPost.locator('[data-wsd-editorial-delete]').click();
    await admin.waitForFunction(()=>window.__diaryData.length===0);

    const original=adminSection.locator('[data-diary-card="official-diary-1687"]').first();
    await original.locator('[data-diary-edit]').click();
    await original.locator('[data-diary-edit-form] [name="title"]').fill('管理员修改的官网索引');
    await original.locator('[data-diary-edit-form] [type="submit"]').click();
    await admin.waitForFunction(()=>document.querySelector('[data-diary-card="official-diary-1687"]')?.textContent.includes('管理员修改'));
    admin.once('dialog',dialog=>dialog.accept());
    await original.locator('[data-diary-delete]').click();
    await admin.waitForFunction(()=>!document.querySelector('[data-diary-card="official-diary-1687"]'));
    await adminSection.locator('[data-diary-hidden-panel] summary').click();
    await adminSection.locator('[data-diary-restore="official-diary-1687"]').click();
    await admin.waitForFunction(()=>document.querySelector('[data-diary-card="official-diary-1687"]'));
    assert.equal(await admin.evaluate(()=>window.__diaryOverrides[0].hidden),false);
    await admin.close();
    console.log('Diary browser checks passed: collapsed latest five, historical search, guest read, runner CRUD, real-time feed, profile sync and admin moderation.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
