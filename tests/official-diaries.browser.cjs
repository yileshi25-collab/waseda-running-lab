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
    assert.equal(await section.locator('.wsd-official-diary-card').count(),24);
    assert.ok(await section.evaluate(el=>el.scrollWidth<=el.clientWidth));
    await section.locator('[data-diary-more]').click();
    assert.equal(await section.locator('.wsd-official-diary-card').count(),48);
    await section.locator('[data-diary-search]').fill('谷川 航太');
    assert.ok(await section.locator('.wsd-official-diary-card').count()>0);
    await section.locator('[data-diary-search]').fill('');
    await section.locator('[data-diary-month]').selectOption('2026-01');
    assert.ok(await section.locator('.wsd-official-diary-card').count()>0);
    for(const date of await section.locator('time').allTextContents())assert.ok(date.startsWith('2026-01'));
    await page.evaluate(()=>{show('athletes');openDetail('谷川 航太');});
    const group=page.locator('#detailBody [data-wsd-editorial-group="diary"]');
    await group.waitFor();await group.locator('summary').click();
    await page.waitForFunction(()=>document.querySelector('[data-wsd-editorial-group="diary"]')?.textContent.includes('≠philanthropy'));
    const dates=await group.locator('.wsd-editorial-entry-head small').allTextContents();
    assert.ok(dates.every(text=>text.includes('2026-')));
    assert.equal(await group.locator('[data-wsd-editorial-delete],[data-wsd-editorial-edit]').count(),0);
    console.log('Browser checks passed: index, pagination, whitespace search, January, mobile fit, canonical athlete association and read-only official entries.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
