// يعمل في عالم الإضافة المعزول: يوفّر التخزين وفتح التبويبات للسكربت الرئيسي (عالم الصفحة)
(function () {
  'use strict';
  const ok = k => typeof k === 'string' && /^tahdir_/.test(k);
  const reply = (type, data) => document.dispatchEvent(new CustomEvent('tahdir-ext-' + type, { detail: JSON.stringify(data) }));
  document.addEventListener('tahdir-ext-req', e => {
    let m; try { m = JSON.parse(String(e.detail)); } catch (x) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.type === 'hello') chrome.storage.local.get(null, all => { const s = {}; Object.keys(all || {}).forEach(k => { if (ok(k)) s[k] = all[k]; }); reply('snap', s); });
    else if (m.type === 'set' && ok(m.key)) chrome.storage.local.set({ [m.key]: m.value });
    else if (m.type === 'del' && ok(m.key)) chrome.storage.local.remove(m.key);
    else if (m.type === 'open' && typeof m.url === 'string' && /^https:\/\/lms\.moe\.gov\.om\//.test(m.url)) chrome.runtime.sendMessage({ open: m.url });
  });
})();
