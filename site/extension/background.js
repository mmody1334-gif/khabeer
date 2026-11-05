// يفتح صفحة نور في تبويب جديد عند الإرسال من الموقع
chrome.runtime.onMessage.addListener((m, sender) => {
  if (m && typeof m.open === 'string' && /^https:\/\/lms\.moe\.gov\.om\//.test(m.open)) {
    chrome.tabs.create({ url: m.open, active: true, index: sender && sender.tab ? sender.tab.index + 1 : undefined });
  }
});
// بعد التثبيت مباشرة: نُعيد المعلم إلى تبويب المنصة ونُحدّثه، فتعمل الأداة فورًا
// وتعرض المنصة «تم التثبيت» بدل أن يبحث المعلم عن التبويب ويحدّثه بنفسه.
chrome.runtime.onInstalled.addListener(d => {
  if (!d || d.reason !== 'install') return;
  const urls = ((chrome.runtime.getManifest().content_scripts || [])[0] || {}).matches || [];
  const site = urls.filter(u => !/lms\.moe\.gov\.om/.test(u));
  if (!site.length) return;
  chrome.tabs.query({ url: site }, tabs => {
    (tabs || []).forEach((t, i) => {
      chrome.tabs.reload(t.id);
      if (i === 0) { chrome.tabs.update(t.id, { active: true }); if (chrome.windows) chrome.windows.update(t.windowId, { focused: true }); }
    });
  });
});
