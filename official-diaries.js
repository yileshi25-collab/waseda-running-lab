/* Public metadata index, independent of community Auth and database writes. */
(() => {
  'use strict';
  const source = new URL('data/official-diaries-2026.json?v=20261117-diaries1', document.currentScript.src);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = value => String(value).normalize('NFKC').replace(/\s/g, '').toLowerCase();
  window.WSD_OFFICIAL_DIARIES_READY = fetch(source).then(response => {
    if (!response.ok) throw Error('HTTP ' + response.status);
    return response.json();
  }).then(index => {
    if (!Array.isArray(index.entries) || index.total !== index.entries.length || index.entries.some(row =>
      !/^https:\/\/waseda-ac\.jp\/diary\/detail\/\d+$/.test(row.source_url) || !/^2026-\d{2}-\d{2}$/.test(row.published_at))) throw Error('日志索引格式无效');
    return index;
  }).catch(error => ({entries:[], error:error.message}));
  window.addEventListener('DOMContentLoaded', async () => {
    const root = document.getElementById('wsdCommunityRoot');
    if (!root) return;
    const section = document.createElement('section');
    section.className = 'panel panel-pad wsd-official-diaries';
    section.id = 'wsdOfficialDiaries';
    section.innerHTML = '<div class="eyebrow">OFFICIAL MEMBER DIARIES · 2026</div><h2>官方部员日志</h2><p data-diary-description>正在读取官方日志索引…</p><div class="wsd-diary-tools"><label>搜索作者／标题<input class="input" type="search" data-diary-search placeholder="支持有空格／无空格的日文姓名"></label><label>月份<select class="select" data-diary-month><option value="all">全部月份</option></select></label></div><p data-diary-status role="status" aria-live="polite"></p><div data-diary-list></div><button class="btn btn-small" type="button" data-diary-more hidden>加载更多日志</button>';
    root.after(section);
    const index = await window.WSD_OFFICIAL_DIARIES_READY;
    const description = section.querySelector('[data-diary-description]');
    if (index.error) {
      description.textContent = '日志索引读取失败，请刷新重试：' + index.error;
      return;
    }
    description.textContent = `已收录 ${index.total} 篇、${new Set(index.entries.map(row => key(row.author))).size} 位作者，覆盖 2026-01-01 至 ${index.as_of}。包含全队各组；仅保留标题、作者、日期和原文链接，正文请到官网阅读。`;
    const sourceLink = document.createElement('a');
    sourceLink.href = 'https://waseda-ac.jp/diary/category/1'; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer'; sourceLink.textContent = '查看官网部员日记 ↗'; description.append(' ', sourceLink);
    const month = section.querySelector('[data-diary-month]');
    [...new Set(index.entries.map(row => row.published_at.slice(0,7)))].sort().reverse().forEach(value => {
      const option = document.createElement('option'); option.value = value; option.textContent = value; month.append(option);
    });
    const search = section.querySelector('[data-diary-search]'), more = section.querySelector('[data-diary-more]');
    let limit = 24;
    function render() {
      const query = key(search.value.trim());
      const rows = index.entries.filter(row => (month.value === 'all' || row.published_at.startsWith(month.value)) && key(row.author + row.title).includes(query));
      section.querySelector('[data-diary-list]').innerHTML = rows.slice(0,limit).map(row => '<article class="wsd-official-diary-card"><small>官方部员日志 · <time datetime="' + esc(row.published_at) + '">' + esc(row.published_at) + '</time></small><h3>' + esc(row.title) + '</h3><p>作者：' + esc(row.author) + '</p><a href="' + esc(row.source_url) + '" target="_blank" rel="noopener noreferrer">在官网阅读原文 ↗</a></article>').join('');
      section.querySelector('[data-diary-status]').textContent = `找到 ${rows.length} 篇，显示 ${Math.min(limit,rows.length)} 篇。`;
      more.hidden = rows.length <= limit;
    }
    search.addEventListener('input', () => { limit = 24; render(); });
    month.addEventListener('change', () => { limit = 24; render(); });
    more.addEventListener('click', () => { limit += 24; render(); });
    render();
  });
})();
