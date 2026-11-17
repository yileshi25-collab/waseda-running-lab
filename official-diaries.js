/* Official member diary index. Original entries are preserved in the static JSON.
 * Canonical entries are admin managed; fan contributions use the existing editorial table.
 * Community diary submissions appear in both the official index and athlete profiles.
 */
(() => {
  'use strict';
  const source = new URL('data/official-diaries-2026.json?v=20261117-longdistance1', document.currentScript.src);
  const TABLE = 'wsd_official_diary_overrides';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = value => String(value).normalize('NFKC').replace(/\s/g, '').replace(/髙/g, '高').replace(/﨑/g, '崎').toLowerCase();
  const urlPattern = /^https:\/\/waseda-ac\.jp\/diary\/detail\/([0-9]{1,8})$/;
  const datePattern = /^2026-\d{2}-\d{2}$/;
  const numberOf = row => Number(String(row.id).replace('official-diary-', '')) || 0;
  const valid = row => row && typeof row.author === 'string' && typeof row.title === 'string' &&
    datePattern.test(row.published_at) && urlPattern.test(row.source_url) &&
    row.id === 'official-diary-' + row.source_url.match(urlPattern)[1];

  window.WSD_OFFICIAL_DIARIES_READY = fetch(source).then(response => {
    if (!response.ok) throw Error('HTTP ' + response.status);
    return response.json();
  }).then(index => {
    if (!Array.isArray(index.entries) || index.total !== index.entries.length ||
        index.entries.some(row => !valid(row))) throw Error('日志索引格式无效');
    return index;
  }).catch(error => ({entries:[], error:error.message}));

  window.addEventListener('DOMContentLoaded', async () => {
    const root = document.getElementById('wsdCommunityRoot');
    if (!root) return;
    const section = document.createElement('section');
    section.className = 'panel panel-pad wsd-official-diaries';
    section.id = 'wsdOfficialDiaries';
    section.innerHTML = [
      '<div class="eyebrow">OFFICIAL MEMBER DIARIES · 2026</div>',
      '<h2>官方部员日志</h2>',
      '<p data-diary-description>正在读取官方日志索引…</p>',
      '<p data-diary-status role="status" aria-live="polite"></p>',
      '<div class="wsd-diary-latest"><h3>最新五篇</h3><div data-diary-list></div></div>',
      '<details class="wsd-diary-archive" data-diary-archive>',
        '<summary>展开历史日志</summary>',
        '<div class="wsd-diary-tools">',
          '<label>搜索作者／标题<input class="input" type="search" data-diary-search placeholder="支持有空格／无空格的日文姓名"></label>',
          '<label>月份<select class="select" data-diary-month><option value="all">全部月份</option></select></label>',
        '</div>',
        '<p class="wsd-diary-help">搜索会检索全部日志，包括上方最新五篇。</p>',
        '<div data-diary-archive-list></div>',
        '<button class="btn btn-small" type="button" data-diary-more hidden>加载更多日志</button>',
      '</details>',
      '<details class="wsd-diary-manage" data-diary-add-panel>',
        '<summary>＋ 跑友添加部员日志（登录后投稿）</summary>',
        '<p class="wsd-diary-help">登录 Google 后，任何跑友都可以补录有官网原文的部员日志；投稿同时出现在“跑友实时投稿”和选手的“部员日志”。投稿内容与官网原文分开标识，未经独立核实。</p>',
        '<form data-diary-add-form class="wsd-diary-form">',
          '<label>对应选手／官网作者<input name="athlete_name" list="wsdDiaryAthleteNames" required minlength="2" maxlength="75" placeholder="输入选手日文姓名"></label>',
          '<datalist id="wsdDiaryAthleteNames"></datalist>',
          '<label>官网原标题<input name="title" required minlength="2" maxlength="100" placeholder="原文标题"></label>',
          '<label>原文发布日期<input name="published_at" type="date" min="2026-01-01" max="2026-12-31" required></label>',
          '<label>官网原文链接<input name="source_url" type="url" required placeholder="https://waseda-ac.jp/diary/detail/1234"></label>',
          '<label>投稿署名<input name="display_name" required minlength="2" maxlength="30" value="早稻田跑友"></label>',
          '<label>补充说明（选填，不复制全文）<textarea name="body" rows="3" maxlength="4000"></textarea></label>',
          '<div class="wsd-diary-buttons"><button class="btn btn-primary btn-small" type="submit">投稿并同步到选手资料</button></div>',
        '</form>',
      '</details>',
      '<details class="wsd-diary-manage" data-diary-hidden-panel hidden><summary data-diary-hidden-summary>已隐藏日志</summary><div data-diary-hidden-list></div></details>',
      '<p class="wsd-diary-feedback" role="status" aria-live="polite" data-diary-feedback></p>'
    ].join('');
    root.after(section);
    const index = await window.WSD_OFFICIAL_DIARIES_READY;
    const description = section.querySelector('[data-diary-description]');
    if (index.error) {
      description.textContent = '日志索引读取失败，请刷新重试：' + index.error;
      return;
    }
    description.textContent = '仅收录现役长距离选手和2026年毕业长距离OB的官网日志与跑友补录；不转载全文。';
    const link = document.createElement('a');
    link.href = 'https://waseda-ac.jp/diary/category/1';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '查看官网部员日记 ↗';
    description.append(' ', link);

    const latest = section.querySelector('[data-diary-list]');
    const archive = section.querySelector('[data-diary-archive]');
    const older = section.querySelector('[data-diary-archive-list]');
    const search = section.querySelector('[data-diary-search]');
    const month = section.querySelector('[data-diary-month]');
    const more = section.querySelector('[data-diary-more]');
    const addPanel = section.querySelector('[data-diary-add-panel]');
    const hiddenPanel = section.querySelector('[data-diary-hidden-panel]');
    const feedback = section.querySelector('[data-diary-feedback]');
    let db = null, admin = false, overrides = [], rows = [], hiddenRows = [];
    let communityRows = [], permissions = {admin:false,user:false,editableIds:[]};
    let limit = 24, busy = false;
    const allowedAuthors = new Set((index.allowed_authors || []).map(key));
    const base = new Map(index.entries.filter(row => allowedAuthors.has(key(row.author))).map(row => [row.id, row]));
    const message = (text, bad = false) => {
      feedback.textContent = text;
      feedback.style.color = bad ? '#b33659' : '#386c54';
    };
    const editable = row => [
      '<div class="wsd-diary-buttons">',
      '<button class="btn btn-small" type="button" data-diary-edit="' + esc(row.id) + '">编辑</button>',
      '<button class="btn btn-small wsd-diary-delete" type="button" data-diary-delete="' + esc(row.id) + '">删除</button>',
      '</div>'
    ].join('');
    const card = row => {
      const contributed=!!row._community;
      const canEdit=contributed&&permissions.user&&(permissions.admin||permissions.editableIds.includes(row.id));
      return '<article class="wsd-official-diary-card'+(contributed?' wsd-editorial-entry wsd-diary-contribution':'')+'" data-diary-card="' + esc(row.id) + '">' +
        '<small>'+(contributed?'跑友补录 · 待核实':'官网索引')+' · <time datetime="' + esc(row.published_at) + '">' + esc(row.published_at) + '</time></small>' +
        '<h3>' + esc(row.title) + '</h3><p>作者／选手：' + esc(row.author) + '</p>' +
        (contributed?'<p>投稿者：'+esc(row.display_name)+'</p>':'') +
        '<a href="' + esc(row.source_url) + '" target="_blank" rel="noopener noreferrer">在官网阅读原文 ↗</a>' +
        (contributed?(canEdit?'<div class="wsd-diary-buttons"><button class="btn btn-small" type="button" data-wsd-editorial-edit="'+esc(row.id)+'">编辑投稿</button>'+
          '<button class="btn btn-small wsd-diary-delete" type="button" data-wsd-editorial-delete="'+esc(row.id)+'">删除投稿</button></div>':''):
          '<div class="wsd-diary-buttons"><button class="btn btn-small" type="button" data-diary-suggest="'+esc(row.id)+'">补充／更正这篇日志</button></div>'+(admin?editable(row):''))+'</article>';
    };

    function publish() {
      window.WSD_OFFICIAL_DIARIES_VISIBLE = rows.map(row => ({...row}));
      window.dispatchEvent(new Event('wsd-official-diaries-updated'));
    }
    function rebuild() {
      const all = new Map(base);
      hiddenRows = [];
      for (const override of overrides) {
        const row = {
          id: override.diary_id, author: override.author, title: override.title,
          published_at: override.published_at, source_url: override.source_url
        };
        if (!valid(row) || !allowedAuthors.has(key(row.author))) continue;
        if (override.hidden) {
          all.delete(row.id);
          hiddenRows.push(row);
        } else {
          all.set(row.id, row);
        }
      }
      rows = [...all.values()].sort((a, b) => b.published_at.localeCompare(a.published_at) || numberOf(b) - numberOf(a));
      hiddenRows.sort((a, b) => b.published_at.localeCompare(a.published_at) || numberOf(b) - numberOf(a));
      publish();
      render();
    }
    function render() {
      const shown=[...rows,...communityRows].sort((a,b)=>b.published_at.localeCompare(a.published_at)||numberOf(b)-numberOf(a));
      const latestRows = shown.slice(0, 5);
      latest.innerHTML = latestRows.length ? latestRows.map(card).join('') : '<p>暂无日志。</p>';
      const months = [...new Set(shown.map(row => row.published_at.slice(0, 7)))].sort().reverse();
      const currentMonth = month.value;
      month.innerHTML = '<option value="all">全部月份</option>' +
        months.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
      month.value = months.includes(currentMonth) ? currentMonth : 'all';
      const query = key(search.value.trim());
      const filtered = (query || month.value !== 'all' ? shown : shown.slice(5))
        .filter(row => (month.value === 'all' || row.published_at.startsWith(month.value)) &&
          key(row.author + row.title).includes(query));
      older.innerHTML = filtered.length ? filtered.slice(0, limit).map(card).join('') :
        '<p class="wsd-diary-help">没有找到符合条件的日志。</p>';
      more.hidden = filtered.length <= limit;
      section.querySelector('[data-diary-status]').textContent =
        '共 ' + shown.length + ' 篇（含 ' + communityRows.length + ' 篇跑友补录）· 显示最新 ' + latestRows.length + ' 篇';
      archive.querySelector('summary').textContent = '展开历史日志（' + Math.max(0, shown.length - 5) + ' 篇）';
      addPanel.hidden = false;
      hiddenPanel.hidden = !admin || hiddenRows.length === 0;
      section.querySelector('[data-diary-hidden-summary]').textContent = '已隐藏日志（' + hiddenRows.length + ' 篇，可恢复）';
      section.querySelector('[data-diary-hidden-list]').innerHTML = hiddenRows.map(row =>
        '<article class="wsd-official-diary-card"><small>' + esc(row.published_at) + '</small><h3>' + esc(row.title) +
        '</h3><p>作者：' + esc(row.author) + '</p><button class="btn btn-small" type="button" data-diary-restore="' +
        esc(row.id) + '">恢复显示</button></article>'
      ).join('');
    }
    function validate(values, editingId = null) {
      const author = String(values.author || '').trim();
      const title = String(values.title || '').trim();
      const published_at = String(values.published_at || '');
      const source_url = String(values.source_url || '').trim();
      const match = source_url.match(urlPattern);
      if (author.length < 2 || author.length > 80 || title.length < 2 || title.length > 200)
        throw Error('请填写有效的作者和标题。');
      if (!match) throw Error('必须使用早稻田竞走部官网的部员日志链接。');
      if (!allowedAuthors.has(key(author))) throw Error('只收录现役长距离选手及2026年毕业长距离OB。');
      if (!datePattern.test(published_at) ||
          Number.isNaN(Date.parse(published_at)) ||
          published_at > new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10))
        throw Error('请填写有效的 2026 年发布日期（不能晚于今天）。');
      const diary_id = 'official-diary-' + match[1];
      if (editingId && diary_id !== editingId) throw Error('编辑已有日志时不能更改原文的文章 ID。');
      return {diary_id, author, title, published_at, source_url, hidden:false};
    }
    const valuesOf = form => Object.fromEntries(new FormData(form).entries());
    function validateCommunity(values) {
      const rawName=String(values.athlete_name||'').trim();
      const candidate=typeof getAthletes==='function'?getAthletes().find(a=>key(a.name)===key(rawName)):null;
      const athlete_name=candidate?candidate.name:rawName;
      const title=String(values.title||'').trim();
      const published_at=String(values.published_at||'');
      const source_url=String(values.source_url||'').trim();
      const display_name=String(values.display_name||'').trim();
      const body=String(values.body||'').trim();
      if(athlete_name.length<2||athlete_name.length>75||title.length<2||title.length>100||
         display_name.length<2||display_name.length>30||body.length>4000)throw Error('请检查选手、标题、署名或说明长度。');
      if(!urlPattern.test(source_url))throw Error('必须使用竞走部官网真实的部员日志链接。');
      if(!allowedAuthors.has(key(athlete_name)))throw Error('只收录现役长距离选手及2026年毕业长距离OB。');
      if(!datePattern.test(published_at)||Number.isNaN(Date.parse(published_at))||
         published_at>new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10))
        throw Error('请输入有效的 2026 年原文发布日期。');
      return {athlete_name,scope:'bio',race_ref:null,category:'diary',title,body,source_url,display_name,published_at};
    }
    const formHTML = row => '<form class="wsd-diary-form" data-diary-edit-form="' + esc(row.id) + '">' +
      '<label>作者<input name="author" required minlength="2" maxlength="80" value="' + esc(row.author) + '"></label>' +
      '<label>标题<input name="title" required minlength="2" maxlength="200" value="' + esc(row.title) + '"></label>' +
      '<label>发布日期<input name="published_at" type="date" min="2026-01-01" max="2026-12-31" required value="' + esc(row.published_at) + '"></label>' +
      '<label>官网原文链接<input name="source_url" type="url" required value="' + esc(row.source_url) + '"></label>' +
      '<div class="wsd-diary-buttons"><button class="btn btn-primary btn-small" type="submit">保存修改</button>' +
      '<button class="btn btn-small" type="button" data-diary-cancel>取消</button></div></form>';
    async function save(payload) {
      if (!admin || !db) throw Error('只有管理员登录后才能管理官方日志。');
      // PostgREST upsert attempts to update the conflict key as well, but the
      // database deliberately grants UPDATE only on editable columns.
      // Keep the original diary ID immutable and only send table columns.
      const {diary_id, author, title, published_at, source_url, hidden} = payload;
      const fields = {author, title, published_at, source_url, hidden};
      if (!/^official-diary-[0-9]{1,8}$/.test(diary_id))
        throw Error('无效的官网日志编号。');
      const exists = overrides.some(row => row.diary_id === diary_id);
      const query = exists
        ? db.from(TABLE).update(fields).eq('diary_id', diary_id)
        : db.from(TABLE).insert({diary_id, ...fields});
      const {data, error} = await query.select('diary_id');
      if (error || !data?.length) throw Error(error?.message || '保存未生效，请确认管理员登录状态和数据库权限。');
      await loadOverrides();
    }
    async function loadOverrides() {
      if (!db) return;
      const {data, error} = await db.from(TABLE)
        .select('diary_id,author,title,published_at,source_url,hidden,updated_at').limit(3000);
      if (error) throw error;
      overrides = data || [];
      rebuild();
    }
    async function refreshPermissions() {
      if (!db) return;
      try {
        const {data:{user}, error} = await db.auth.getUser();
        if (error) throw error;
        if (!user) admin = false;
        else {
          const result = await db.rpc('wsd_is_community_admin');
          admin = !result.error && result.data === true;
        }
      } catch { admin = false; }
      render();
    }
    function syncCommunityDiaries() {
      permissions=window.WSD_COMMUNITY_DIARY_PERMISSIONS||{admin:false,user:false,editableIds:[]};
      communityRows=(window.WSD_COMMUNITY_DIARIES||[])
        .filter(row=>datePattern.test(row.published_at||'')&&urlPattern.test(row.source_url||'')&&allowedAuthors.has(key(row.athlete_name||'')))
        .map(row=>({...row,author:row.athlete_name,_community:true}));
      render();
    }
    window.addEventListener('wsd-community-diaries-updated',syncCommunityDiaries);
    const suggestions=[...new Set([...index.entries.map(row=>row.author),...index.allowed_authors,
      ...(typeof getAthletes==='function'?getAthletes().map(row=>row.name).filter(name=>allowedAuthors.has(key(name))):[])])].sort((a,b)=>a.localeCompare(b,'ja'));
    section.querySelector('#wsdDiaryAthleteNames').innerHTML=suggestions.map(name=>
      '<option value="'+esc(name)+'"></option>').join('');
    search.addEventListener('input', () => {limit = 24; render();});
    month.addEventListener('change', () => {limit = 24; render();});
    more.addEventListener('click', () => {limit += 24; render();});
    section.addEventListener('click', async event => {
      const suggest = event.target.closest('[data-diary-suggest]');
      if (suggest) {
        const row=rows.find(r=>r.id===suggest.dataset.diarySuggest);
        if (!row) return;
        addPanel.open=true;
        const form=addPanel.querySelector('[data-diary-add-form]');
        for(const name of ['title','published_at','source_url']){
          form.elements.namedItem(name).value=row[name];
        }
        form.elements.namedItem('athlete_name').value=row.author;
        addPanel.scrollIntoView({behavior:'smooth',block:'center'});
        message('已带入官网原文信息。可以补充说明，提交后作为跑友修订发布到实时投稿。');
        return;
      }
      const edit = event.target.closest('[data-diary-edit]');
      const cancel = event.target.closest('[data-diary-cancel]');
      const remove = event.target.closest('[data-diary-delete]');
      const restore = event.target.closest('[data-diary-restore]');
      if (cancel) { cancel.closest('[data-diary-edit-form]')?.remove(); return; }
      if (!admin) return;
      if (edit) {
        const row = rows.find(r => r.id === edit.dataset.diaryEdit);
        if (!row) return;
        const element = edit.closest('[data-diary-card]');
        section.querySelectorAll('[data-diary-edit-form]').forEach(form => form.remove());
        element.insertAdjacentHTML('beforeend', formHTML(row));
        element.querySelector('[name="title"]').focus();
        return;
      }
      if ((!remove && !restore) || busy) return;
      const id = remove?.dataset.diaryDelete || restore?.dataset.diaryRestore;
      const row = [...rows, ...hiddenRows].find(item => item.id === id);
      if (!row) return;
      if (remove && !confirm('确定将这篇日志从本站隐藏吗？官网原文与备份不受影响，管理员可以恢复。')) return;
      busy = true;
      try {
        await save({...row, diary_id: row.id, hidden: !!remove});
        message(remove ? '已从本站隐藏该日志，可在“已隐藏日志”中恢复。' : '已恢复显示。');
      } catch (error) { message('操作失败：' + error.message, true); }
      finally {busy = false;}
    });
    section.addEventListener('submit', async event => {
      const form = event.target.closest('[data-diary-add-form], [data-diary-edit-form]');
      if (!form) return;
      event.preventDefault();
      if (busy) return;
      const editingId = form.dataset.diaryEditForm || null;
      let payload;
      try {payload=editingId?validate(valuesOf(form),editingId):validateCommunity(valuesOf(form));}
      catch(error){message(error.message,true);return;}
      if (editingId && !admin) {message('只有管理员可以直接修订官网索引。',true);return;}
      if (!db) {message('投稿系统尚未连接，请检查网络。',true);return;}
      let signedIn=null;
      try {const result=await db.auth.getUser();signedIn=result.data?.user;}
      catch {}
      if (!signedIn) {
        message('请先在本页上方使用 Google 账号登录，再提交部员日志。',true);
        document.getElementById('wsdAuth')?.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      busy=true;
      const button=form.querySelector('[type="submit"]');
      button.disabled=true;
      try {
        if (editingId) {
          await save(payload);
          message('官网索引修改已保存。');
        } else {
          const {error}=await db.from('wsd_community_editorial').insert({...payload,author_id:signedIn.id});
          if(error)throw error;
          form.reset();
          window.dispatchEvent(new Event('wsd-community-editorial-refresh'));
          message('跑友日志投稿成功！已同步至“跑友实时投稿”和对应选手资料。');
        }
      } catch(error) {message('保存失败：'+error.message,true);}
      finally {busy=false;if(button.isConnected)button.disabled=false;}
    });

    rebuild(); // The original public JSON works even when Supabase is unavailable.
    syncCommunityDiaries();
    if (typeof window.WSD_GET_SUPABASE !== 'function') return;
    try {
      db = await window.WSD_GET_SUPABASE();
      await loadOverrides();
      await refreshPermissions();
      db.auth.onAuthStateChange(() => {
        setTimeout(() => {refreshPermissions().catch(() => {});}, 0);
      });
      const refresh = () => {
        if (!document.hidden) loadOverrides().catch(error => message('日志更新读取失败：' + error.message, true));
      };
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', refresh);
    } catch (error) {
      message('暂时无法读取日志管理数据，仍可查看原始索引：' + error.message, true);
    }
  });
})();
