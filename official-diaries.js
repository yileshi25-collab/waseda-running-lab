/* Official member diary index. Original entries are preserved in the static JSON.
 * Administrator additions, corrections and site-level removals live in Supabase.
 * Public readers never receive write controls; Postgres RLS enforces admin rights.
 */
(() => {
  'use strict';
  const source = new URL('data/official-diaries-2026.json?v=20261117-diaries1', document.currentScript.src);
  const TABLE = 'wsd_official_diary_overrides';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = value => String(value).normalize('NFKC').replace(/\s/g, '').toLowerCase();
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
      '<details class="wsd-diary-manage" data-diary-add-panel hidden>',
        '<summary>＋ 添加官方部员日志（管理员）</summary>',
        '<form data-diary-add-form class="wsd-diary-form">',
          '<label>作者<input name="author" required minlength="2" maxlength="80" placeholder="官网署名"></label>',
          '<label>标题<input name="title" required minlength="2" maxlength="200" placeholder="官网原标题"></label>',
          '<label>发布日期<input name="published_at" type="date" min="2026-01-01" max="2026-12-31" required></label>',
          '<label>官网原文链接<input name="source_url" type="url" required placeholder="https://waseda-ac.jp/diary/detail/1234"></label>',
          '<div class="wsd-diary-buttons"><button class="btn btn-primary btn-small" type="submit">添加日志</button></div>',
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
    description.textContent = '收录 2026 年公开部员日志的标题、作者、发布日期及原文链接；不转载全文。';
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
    let limit = 24, busy = false;
    const base = new Map(index.entries.map(row => [row.id, row]));
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
    const card = row => '<article class="wsd-official-diary-card" data-diary-card="' + esc(row.id) + '">' +
      '<small>官方部员日志 · <time datetime="' + esc(row.published_at) + '">' + esc(row.published_at) + '</time></small>' +
      '<h3>' + esc(row.title) + '</h3><p>作者：' + esc(row.author) + '</p>' +
      '<a href="' + esc(row.source_url) + '" target="_blank" rel="noopener noreferrer">在官网阅读原文 ↗</a>' +
      (admin ? editable(row) : '') + '</article>';

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
        if (!valid(row)) continue;
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
      const latestRows = rows.slice(0, 5);
      latest.innerHTML = latestRows.length ? latestRows.map(card).join('') : '<p>暂无日志。</p>';
      const months = [...new Set(rows.map(row => row.published_at.slice(0, 7)))].sort().reverse();
      const currentMonth = month.value;
      month.innerHTML = '<option value="all">全部月份</option>' +
        months.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
      month.value = months.includes(currentMonth) ? currentMonth : 'all';
      const query = key(search.value.trim());
      const filtered = (query || month.value !== 'all' ? rows : rows.slice(5))
        .filter(row => (month.value === 'all' || row.published_at.startsWith(month.value)) &&
          key(row.author + row.title).includes(query));
      older.innerHTML = filtered.length ? filtered.slice(0, limit).map(card).join('') :
        '<p class="wsd-diary-help">没有找到符合条件的日志。</p>';
      more.hidden = filtered.length <= limit;
      section.querySelector('[data-diary-status]').textContent =
        '共 ' + rows.length + ' 篇 · 显示最新 ' + latestRows.length + ' 篇，历史列表可展开';
      archive.querySelector('summary').textContent = '展开历史日志（' + Math.max(0, rows.length - 5) + ' 篇）';
      addPanel.hidden = !admin;
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
      if (!datePattern.test(published_at) ||
          Number.isNaN(Date.parse(published_at)) ||
          published_at > new Date().toISOString().slice(0, 10))
        throw Error('请填写有效的 2026 年发布日期（不能晚于今天）。');
      const diary_id = 'official-diary-' + match[1];
      if (editingId && diary_id !== editingId) throw Error('编辑已有日志时不能更改原文的文章 ID。');
      return {diary_id, author, title, published_at, source_url, hidden:false};
    }
    const valuesOf = form => Object.fromEntries(new FormData(form).entries());
    const formHTML = row => '<form class="wsd-diary-form" data-diary-edit-form="' + esc(row.id) + '">' +
      '<label>作者<input name="author" required minlength="2" maxlength="80" value="' + esc(row.author) + '"></label>' +
      '<label>标题<input name="title" required minlength="2" maxlength="200" value="' + esc(row.title) + '"></label>' +
      '<label>发布日期<input name="published_at" type="date" min="2026-01-01" max="2026-12-31" required value="' + esc(row.published_at) + '"></label>' +
      '<label>官网原文链接<input name="source_url" type="url" required value="' + esc(row.source_url) + '"></label>' +
      '<div class="wsd-diary-buttons"><button class="btn btn-primary btn-small" type="submit">保存修改</button>' +
      '<button class="btn btn-small" type="button" data-diary-cancel>取消</button></div></form>';
    async function save(payload) {
      if (!admin || !db) throw Error('只有管理员登录后才能管理官方日志。');
      const {data, error} = await db.from(TABLE).upsert(payload, {onConflict:'diary_id'}).select('diary_id');
      if (error || !data?.length) throw Error(error?.message || '保存未生效，请检查管理员权限。');
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
    search.addEventListener('input', () => {limit = 24; render();});
    month.addEventListener('change', () => {limit = 24; render();});
    more.addEventListener('click', () => {limit += 24; render();});
    section.addEventListener('click', async event => {
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
      if (!admin || busy) return;
      const editingId = form.dataset.diaryEditForm || null;
      let payload;
      try {
        payload = validate(valuesOf(form), editingId);
        if (!editingId && (base.has(payload.diary_id) || overrides.some(row => row.diary_id === payload.diary_id)))
          throw Error('这篇日志已经收录，请使用“编辑”或“恢复显示”。');
      } catch (error) { message(error.message, true); return; }
      busy = true;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await save(payload);
        if (!editingId) form.reset();
        message(editingId ? '日志修改已保存。' : '官方日志已添加并公开显示。');
      } catch (error) { message('保存失败：' + error.message, true); }
      finally {busy = false; if (button.isConnected) button.disabled = false;}
    });

    rebuild(); // The original public JSON works even when Supabase is unavailable.
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
