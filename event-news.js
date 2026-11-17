/* Annual community news. Mutations remain subject to Supabase RLS. */
window.addEventListener('DOMContentLoaded', async () => {
  const panels = [...document.querySelectorAll('[data-news-year]')];
  if (!panels.length) return;
  let sb;
  try { sb = await window.WSD_GET_SUPABASE(); }
  catch { panels.forEach(p => p.querySelector('.wsd-news-feed').textContent = '新闻组件加载失败，请刷新重试。'); return; }
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; }
    catch { return ''; }
  };
  let user = null, admin = false;
  const rows = new Map(), requests = new WeakMap();
  const canEdit = row => !!user && (admin || row.author_id === user.id);
  async function auth() {
    const {data, error} = await sb.auth.getUser();
    user = error ? null : data?.user; admin = false;
    if (user) { const {data} = await sb.rpc('wsd_is_community_admin'); admin = data === true; }
  }
  const message = (p, text) => { p.querySelector('.wsd-news-feedback').textContent = text; };
  async function refresh(p) {
    const request = (requests.get(p) || 0) + 1;
    requests.set(p, request);
    const feed = p.querySelector('.wsd-news-feed');
    const open = !!feed.querySelector('details[open]');
    const category = p.querySelector('.wsd-news-filter').value;
    try {
      let query = sb.from('wsd_event_news').select('id,title,summary,source_url,published_at,category,athlete_names,author_id')
        .eq('event_year', Number(p.dataset.newsYear)).order('published_at', {ascending:false}).order('id', {ascending:false}).limit(100);
      if (category !== 'all') query = query.eq('category', category);
      const {data, error} = await query;
      if (requests.get(p) !== request) return;
      if (error) throw error;
      const items = data || [];
      rows.set(p, new Map(items.map(row => [row.id, row])));
      const card = row => '<article class="wsd-news-card"><small>' + esc(row.published_at) + ' · ' + esc(row.category) + '</small><h3>' + esc(row.title) + '</h3><p>' + esc(row.summary) + '</p>' +
        (row.athlete_names?.length ? '<small>关联选手：' + row.athlete_names.map(esc).join('、') + '</small><br>' : '') +
        (safeURL(row.source_url) ? '<a href="' + esc(safeURL(row.source_url)) + '" target="_blank" rel="noopener noreferrer">查看原始来源 ↗</a>' : '<small>来源链接无效</small>') +
        (canEdit(row) ? '<div class="wsd-news-manage"><button type="button" data-news-action="edit" data-news-id="' + esc(row.id) + '">编辑</button><button type="button" data-news-action="delete" data-news-id="' + esc(row.id) + '">删除</button></div>' : '') + '</article>';
      feed.innerHTML = items.length ? card(items[0]) + (items.length > 1 ? '<details class="wsd-news-archive-fold" ' + (open ? 'open' : '') + '><summary>查看其余 ' + (items.length-1) + ' 条赛事新闻 <span>展开／收起</span></summary><div class="wsd-news-archive-list">' + items.slice(1).map(card).join('') + '</div></details>' : '') : '<p class="keyline">暂时没有相关新闻。欢迎登录后投稿。</p>';
      return true;
    } catch (error) {
      if (requests.get(p) === request) message(p, '新闻读取失败，可切换分类重试：' + error.message);
      return false;
    }
  }
  for (const p of panels) {
    const form = p.querySelector('.wsd-news-form'), toggle = p.querySelector('.wsd-news-toggle');
    const feedback = document.createElement('p');
    feedback.className = 'wsd-news-feedback'; feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
    form.after(feedback);
    form.id = 'wsd-news-form-' + p.dataset.newsYear;
    toggle.setAttribute('aria-controls', form.id);
    let editing = null, busy = false;
    function visible(show) {
      form.hidden = !show; toggle.setAttribute('aria-expanded', String(show));
      toggle.textContent = show ? '收起投稿表单' : '＋ 投稿赛事新闻';
    }
    function reset() {
      editing = null; form.reset();
      form.querySelector('[type="submit"]').textContent = '立即公开发布';
      form.querySelector('.wsd-news-status').textContent = '';
    }
    visible(false);
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'btn btn-small'; cancel.textContent = '取消编辑／投稿';
    cancel.onclick = () => { if (!busy) { reset(); visible(false); } };
    form.append(cancel);
    toggle.onclick = () => { if (!busy) visible(form.hidden); };
    p.querySelector('.wsd-news-filter').onchange = () => refresh(p);
    p.querySelector('.wsd-news-feed').onclick = async e => {
      const button = e.target.closest('[data-news-action]');
      if (!button || busy) return;
      const row = rows.get(p)?.get(button.dataset.newsId);
      if (!row || !canEdit(row)) return;
      if (button.dataset.newsAction === 'edit') {
        if (!form.hidden && (editing || [...new FormData(form).values()].some(v => String(v).trim() && String(v) !== form.elements.category.value)) && !confirm('替换当前尚未保存的新闻内容？')) return;
        reset(); editing = row.id;
        for (const key of ['title','published_at','category','summary','source_url']) form.elements[key].value = row[key];
        form.elements.athlete_names.value = (row.athlete_names || []).join('、');
        form.querySelector('[type="submit"]').textContent = '保存修改';
        visible(true); form.elements.title.focus(); return;
      }
      if (!confirm('确定永久删除这条赛事新闻？')) return;
      busy = true; button.disabled = true;
      try {
        const {data, error} = await sb.from('wsd_event_news').delete().eq('id', row.id).select('id');
        if (error || !data?.length) throw error || Error('没有删除权限或新闻已被删除');
        if (editing === row.id) { reset(); visible(false); }
        message(p, '新闻已删除。'); await refresh(p);
      } catch (error) { message(p, '删除失败：' + error.message); }
      finally { busy = false; button.disabled = false; }
    };
    form.onsubmit = async e => {
      e.preventDefault(); if (busy) return;
      const status = form.querySelector('.wsd-news-status'), button = form.querySelector('[type="submit"]');
      busy = true; button.disabled = true; let saved = false;
      try {
        const {data, error} = await sb.auth.getUser();
        if (error || !data?.user) throw Error('请先在「跑友共建」完成 Google 登录。');
        const fd = new FormData(form), value = key => String(fd.get(key) || '').trim();
        const source = safeURL(value('source_url'));
        if (!source || source.length > 500) throw Error('来源须为最多 500 字的有效 HTTPS 链接。');
        if (!form.reportValidity()) return;
        const payload = {title:value('title'), summary:value('summary'), category:value('category'), published_at:value('published_at'), source_url:source,
          athlete_names:value('athlete_names').split(/[、,，]/).map(v => v.trim()).filter(Boolean).slice(0,12)};
        if (payload.title.length < 5 || payload.summary.length < 15) throw Error('请检查标题及摘要长度。');
        status.textContent = '正在保存…';
        let query = sb.from('wsd_event_news');
        const result = editing ? await query.update(payload).eq('id', editing).select('id') : await query.insert({...payload, event_year:Number(p.dataset.newsYear), author_id:data.user.id}).select('id');
        if (result.error || !result.data?.length) throw result.error || Error('没有保存权限');
        saved = true; const wasEdit = !!editing; reset(); visible(true);
        p.querySelector('.wsd-news-filter').value = 'all';
        const text = wasEdit ? '修改已保存。' : '新闻已公开发布，可继续投稿。';
        status.textContent = text; message(p, text);
        if (!await refresh(p)) message(p, text + '列表刷新失败，请刷新页面查看，勿重复提交。');
      } catch (error) { status.textContent = (saved ? '已保存，但刷新失败：' : '保存失败：') + error.message; }
      finally { busy = false; button.disabled = false; }
    };
  }
  try { await auth(); } catch { /* Guest browsing still works. */ }
  panels.forEach(refresh);
  sb.auth.onAuthStateChange(() => { setTimeout(async () => {
    try { await auth(); panels.forEach(refresh); } catch { panels.forEach(p => message(p, '登录状态读取失败，请刷新重试。')); }
  }, 0); });
});
