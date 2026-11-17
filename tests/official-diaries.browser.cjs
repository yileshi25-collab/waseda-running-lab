/* Run after npm install --no-save --package-lock=false playwright@1.58.2.
   Start python3 -m http.server 8080 first. All Supabase traffic is mocked. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:375,height:812}});
    await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({contentType:'application/javascript',body:`export const createClient=()=>({auth:{getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({})},rpc:async()=>({data:[],error:null}),from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>q,then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};return q;},channel:()=>({on(){return this},subscribe(){return this}})});`}));
    await page.route('https://*.supabase.co/**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
    await page.goto('http://127.0.0.1:8080/');
    await page.evaluate(()=>show('community'));
    const section=page.locator('#wsdOfficialDiaries');
    await page.waitForFunction(()=>document.querySelector('[data-diary-status]')?.textContent.includes('319'));
    assert.equal(await section.locator('[data-diary-list] .wsd-official-diary-card').count(),5);
    assert.equal(await section.locator('[data-diary-archive]').getAttribute('open'),null);
    assert.ok(await section.evaluate(el=>el.scrollWidth<=el.clientWidth));
    assert.equal(await section.locator('[data-diary-edit],[data-diary-delete],[data-diary-add-panel]:not([hidden])').count(),0);
    await section.locator('[data-diary-archive] summary').click();
    assert.equal(await section.locator('[data-diary-archive-list] .wsd-official-diary-card').count(),24);
    await section.locator('[data-diary-more]').click();
    assert.equal(await section.locator('[data-diary-archive-list] .wsd-official-diary-card').count(),48);
    await section.locator('[data-diary-search]').fill('谷川 航太');
    assert.ok(await section.locator('[data-diary-archive-list] .wsd-official-diary-card').count()>0);
    await section.locator('[data-diary-search]').fill('');
    await section.locator('[data-diary-month]').selectOption('2026-01');
    assert.ok(await section.locator('[data-diary-archive-list] .wsd-official-diary-card').count()>0);
    for(const date of await section.locator('[data-diary-archive-list] time').allTextContents())assert.ok(date.startsWith('2026-01'));
    await page.evaluate(()=>{show('athletes');openDetail('谷川 航太');});
    const group=page.locator('#detailBody [data-wsd-editorial-group="diary"]');
    await group.waitFor();await group.locator('summary').click();
    await page.waitForFunction(()=>document.querySelector('[data-wsd-editorial-group="diary"]')?.textContent.includes('≠philanthropy'));
    const dates=await group.locator('.wsd-editorial-entry-head small').allTextContents();
    assert.ok(dates.every(text=>text.includes('2026-')));
    assert.equal(await group.locator('[data-wsd-editorial-delete],[data-wsd-editorial-edit]').count(),0);
    const offline=await browser.newPage();
    await offline.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.abort());
    await offline.route('https://*.supabase.co/**',route=>route.abort());
    await offline.goto('http://127.0.0.1:8080/');
    await offline.evaluate(()=>show('community'));
    await offline.waitForFunction(()=>document.querySelector('[data-diary-status]')?.textContent.includes('319'));
    await offline.close();
    // Authenticated admin: verify that additions, edits, hiding and restoration persist via the override API.
    const adminPage=await browser.newPage({viewport:{width:375,height:812}});
    await adminPage.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({contentType:'application/javascript',body:`
      window.__diaryOverrides=[];
      export const createClient=()=>({
        auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111',email:'admin@example.test'}}}),
          onAuthStateChange:()=>({}),signOut:async()=>({})},
        rpc:async name=>({data:name==='wsd_is_community_admin'?true:[],error:null}),
        from:table=>{
          let op='select',payload;
          const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>q,
            upsert:value=>{op='upsert';payload=value;return q;},
            then:(resolve,reject)=>Promise.resolve().then(()=>{
              if(op==='upsert'){
                const found=window.__diaryOverrides.findIndex(r=>r.diary_id===payload.diary_id);
                if(found>=0)window.__diaryOverrides[found]={...payload};
                else window.__diaryOverrides.push({...payload});
                return {data:[{diary_id:payload.diary_id}],error:null};
              }
              return {data:table==='wsd_official_diary_overrides'?window.__diaryOverrides:[],error:null};
            }).then(resolve,reject)};
          return q;
        },
        channel:()=>({on(){return this},subscribe(){return this}})
      });
    `}));
    await adminPage.route('https://*.supabase.co/**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
    await adminPage.goto('http://127.0.0.1:8080/');
    await adminPage.evaluate(()=>show('community'));
    const adminSection=adminPage.locator('#wsdOfficialDiaries');
    await adminPage.waitForFunction(()=>document.querySelector('[data-diary-add-panel]')?.hidden===false);
    await adminSection.locator('[data-diary-add-panel] summary').click();
    const addForm=adminSection.locator('[data-diary-add-form]');
    await addForm.locator('[name="author"]').fill('測試部員');
    await addForm.locator('[name="title"]').fill('測試部員：新しい日誌');
    await addForm.locator('[name="published_at"]').fill('2026-11-17');
    await addForm.locator('[name="source_url"]').fill('https://waseda-ac.jp/diary/detail/999999');
    await addForm.locator('[type="submit"]').click();
    const newCard=adminSection.locator('[data-diary-list] [data-diary-card="official-diary-999999"]');
    await newCard.waitFor();
    assert.ok((await newCard.textContent()).includes('新しい日誌'));
    await newCard.locator('[data-diary-edit]').click();
    await newCard.locator('[data-diary-edit-form] [name="title"]').fill('測試部員：修正した日誌');
    await newCard.locator('[data-diary-edit-form] [type="submit"]').click();
    await adminPage.waitForFunction(()=>document.querySelector('[data-diary-list] [data-diary-card="official-diary-999999"] h3')?.textContent.includes('修正した日誌'));
    adminPage.once('dialog',dialog=>dialog.accept());
    await newCard.locator('[data-diary-delete]').click();
    await adminPage.waitForFunction(()=>!document.querySelector('[data-diary-card="official-diary-999999"]'));
    await adminSection.locator('[data-diary-hidden-panel] summary').click();
    await adminSection.locator('[data-diary-restore="official-diary-999999"]').click();
    await newCard.waitFor();
    assert.equal(await adminPage.evaluate(()=>window.__diaryOverrides[0].hidden),false);
    await adminPage.close();
    console.log('Browser checks passed: latest five, archive search/paging, athlete association, guest read-only, offline fallback and admin add/edit/hide/restore.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
