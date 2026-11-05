// يحاكي Tampermonkey: يطبّق قواعد @match ويشغّل السكريبت على صفحة نور وهمية
const { chromium } = require('playwright'); const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../server/tahdir-noor.user.js', 'utf8');
const matches = [...src.matchAll(/@match\s+(\S+)/g)].map(m => m[1]);
const toRe = p => new RegExp('^' + p.replace(/[.?+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
const matchesUrl = u => matches.some(m => toRe(m).test(u));
for (const u of ['https://lms.moe.gov.om/teacher', 'https://lms.moe.gov.om/teacher/', 'https://lms.moe.gov.om/teacher/courses/add_preparation/cid:1', 'https://lms.moe.gov.om/login']) console.log('match', u, matchesUrl(u));
const page = `<html><body><h1>الرئيسية</h1><nav id=sb></nav><script>setTimeout(()=>{sb.innerHTML='<a href="/teacher/courses/browse_content/cid:111">الاحياء / التاسع</a><a href="/teacher/courses/browse_content/cid:222">الاحياء / العاشر</a>'},1200)</script></body></html>`;
(async () => {
  const b = await chromium.launch(); const c = await b.newContext(); const p = await c.newPage();
  const store = { tahdir_pending_prep: { data: { source: 'tahdir-al-aali', grade: 'العاشر', subject: 'الأحياء', title: 'تدخين التبغ' }, ts: Date.now(), routed: false } };
  await c.exposeBinding('__gmSet', (_, k, v) => { store[k] = v; });
  const visited = [];
  await c.route('https://lms.moe.gov.om/**', r => { visited.push(r.request().url()); r.fulfill({ contentType: 'text/html; charset=utf-8', body: r.request().url().includes('add_preparation') ? '<html><body>add prep</body></html>' : page }); });
  p.on('domcontentloaded', async () => {
    if (!matchesUrl(p.url())) return;
    await p.evaluate(([src, store]) => { const S = store; window.GM_getValue = (k, d) => (k in S ? S[k] : d); window.GM_setValue = (k, v) => { S[k] = v; window.__gmSet(k, v); }; window.GM_deleteValue = k => { delete S[k]; window.__gmSet(k, null); }; window.GM_registerMenuCommand = () => {}; window.unsafeWindow = window; (0, eval)(src); }, [src, store]).catch(() => {});
  });
  await p.goto('https://lms.moe.gov.om/teacher');
  await p.waitForURL(/add_preparation/, { timeout: 15000 }).catch(() => {});
  console.log('visited', visited); console.log('final', p.url()); console.log('grades', JSON.stringify(store.tahdir_grade_cids));
  await b.close();
})();
