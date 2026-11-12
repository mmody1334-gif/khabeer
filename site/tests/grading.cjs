// التصحيح التلقائي: محاكاة Tampermonkey + صفحات نور (المهام ← التسليمات ← الدرجة) — بدون أي ضغط على «درجة التسليم» من الأداة
const { chromium } = require('playwright'); const fs = require('fs');
async function pickC(p, sel, key) { const s = key.split('|')[0]; if (await p.isVisible(sel + 'Subj')) { if (await p.inputValue(sel + 'Subj') !== s) { await p.selectOption(sel + 'Subj', s); await p.waitForTimeout(600); } } if (await p.inputValue(sel) !== key) await p.selectOption(sel, key); }
const B = 'http://localhost:8787', OUT = __dirname + '/';
const TOOL = fs.readFileSync(__dirname + '/../server/tahdir-noor.user.js', 'utf8').replace("location.hostname === 'khabeer.khabeer.workers.dev'", "location.hostname === 'localhost'");
const ENC = 'wo2aAuKy_OMAN', AID = '8Jsj3W2RjM_OMAN';
const students = [['سعود راشد', false], ['عبيد محمد', false], ['علي سلطان', true]];
const graded = {}; let saves = 0;
const page = (title, body, script = '') => `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${title}</title></head><body><nav><a href="/teacher/courses/browse_content/cid:222">الاحياء / العاشر</a></nav>${body}<script>${script}</script></body></html>`;
function nour(url) {
  const u = new URL(url);
  if (/homeworks\/index/.test(u.pathname)) return page('المهام الإلكترونية', `<table><tbody id=tb></tbody></table>`, `setTimeout(()=>{tb.innerHTML='<tr><td><input type=checkbox></td><td>تبادل الغازات في الإنسان</td><td>2</td><td>2026-10-10 19:43:10</td><td>2026-10-18 02:05:00</td><td><a href="#">معاينة</a><ul><li><a href="/teacher/questions/list">قائمة المفردات</a></li><li><a href="/teacher/lectures/submissions/cid:${ENC}/aid:${AID}/tid:X">التسليمات</a></li></ul></td></tr>'},700)`);
  if (/lectures\/submissions/.test(u.pathname)) return page('التسليمات', `<table><tbody>${students.map((s, i) => `<tr><td>${s[0]}</td><td>العاشر</td><td>${graded[i] || s[1] ? 2 : 0}</td><td>${graded[i] || s[1] ? 'تم التصحيح' : ''}</td><td><a href="/teacher/lectures/mark_submission/cid:${ENC}/aid:${AID}/sid:${i}">الدرجة</a></td></tr>`).join('')}</tbody></table>`);
  if (/mark_submission/.test(u.pathname)) { const sid = +u.pathname.match(/sid:(\d+)/)[1];
    return page('الدرجة', `<h3>${students[sid][0]}</h3><div>1/ <select id=q1 style=display:none><option value=''>اختر</option><option>0</option><option>1</option></select><div class=nice-select><ul><li data-value=0>0</li><li data-value=1>1</li></ul></div></div>${process.env.ODD && sid === 1 ? '<div>1/ <span class=pill id=q2>0</span></div>' : "<div>1/ <select id=q2><option value=''></option><option>0</option><option>1</option></select></div>"}<div id=cm></div><button id=save type=button>درجة التسليم</button><button type=button>إلغاء</button>`,
      `window.CKEDITOR={instances:{comments:{status:'ready',d:'',getData(){return this.d},setData(v){this.d=v;cm.innerHTML=v},updateElement(){}}}};save.onclick=()=>{location.href='/teacher/lectures/__save?sid=${sid}&q1='+q1.value+'&q2='+(q2.value||q2.textContent)+'&c='+encodeURIComponent(CKEDITOR.instances.comments.d)};`); }
  return page('الرئيسية', '<h1>الرئيسية</h1>');
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 1300, height: 850 }, bypassCSP: true });
  const store = {};
  await c.exposeBinding('__gm', (src, op, k, v) => { if (op === 'set') store[k] = v; else delete store[k];
    // مثل Tampermonkey: القيم تتزامن بين كل التبويبات
    c.pages().forEach(pg => { if (pg !== src.page) pg.evaluate(([op, k, v]) => { if (window.__S) { if (op === 'set') window.__S[k] = v; else delete window.__S[k]; } }, [op, k, v]).catch(() => {}); }); });
  await c.exposeBinding('__open', async (_, u) => { const p = await c.newPage(); await p.goto(u); });
  await c.route('https://lms.moe.gov.om/**', r => {
    const u = r.request().url();
    if (/__save/.test(u)) { const q = new URL(u).searchParams; graded[+q.get('sid')] = true; saves++; console.log('   teacher saved sid', q.get('sid'), 'q1', q.get('q1'), 'q2', q.get('q2'), 'comment', q.get('c'));
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: `<script>location.replace('https://lms.moe.gov.om/teacher/lectures/submissions/cid:${ENC}/aid:${AID}/tid:X')</script>` }); }
    r.fulfill({ contentType: 'text/html; charset=utf-8', body: nour(u) });
  });
  const hook = p => { p.on('pageerror', e => errs.push(e.message)); p.on('load', () => p.evaluate(([src, S0]) => { const S = window.__S = S0; const f = new Function('GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_openInTab', 'GM_registerMenuCommand', 'unsafeWindow', src);
    f((k, d) => (k in S ? JSON.parse(JSON.stringify(S[k])) : d), (k, v) => { S[k] = v; window.__gm('set', k, v); }, k => { delete S[k]; window.__gm('del', k); }, u => window.__open(u), () => {}, window); }, [TOOL, store]).catch(() => {})); };
  c.on('page', hook);
  const p = await c.newPage();
  await p.goto(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]');
  await p.waitForURL(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForURL(B + '/admin');
  // تعرّف الأداة على أرقام الصفوف من نور أولًا
  const n0 = await c.newPage(); await n0.goto('https://lms.moe.gov.om/teacher'); await n0.waitForTimeout(800); await n0.close();
  // «تصحيح الواجبات» مخفي من الواجهة: يُفتح بالرابط المباشر فقط
  await p.goto(B + '/app'); await p.waitForTimeout(800); await p.click('#menuBtn'); console.log('menu has grading (should be false):', await p.isVisible('#menuList a[href="/grading"]'));
  await p.goto(B + '/grading'); await p.waitForSelector('#grFetch'); await p.waitForTimeout(1600);
  await p.screenshot({ path: OUT + 'gr_empty.png', fullPage: true });
  await pickC(p, '#grCourse', 'الأحياء|العاشر');
  const np = c.waitForEvent('page'); await p.click('#grFetch'); const idx = await np; await idx.waitForLoadState(); await idx.waitForTimeout(2500);
  console.log('index url:', idx.url().replace('https://lms.moe.gov.om', ''), '| buttons on Nour:', await idx.$$eval('.tahdir-grade-btn', e => e.length));
  await idx.screenshot({ path: OUT + 'gr_nour_index.png' });
  await p.bringToFront(); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1500);
  console.log('site tasks:', await p.$$eval('.gr-tasks tbody tr', e => e.map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 80))));
  await p.screenshot({ path: OUT + 'gr_tasks.png', fullPage: true });
  console.log('saved on server:', Object.keys((await (await p.request.get(B + '/api/nour/tasks')).json()).tasks).length);
  // start grading from the site (autosave on: no teacher clicks at all)
  const t0 = Date.now(); const gp = c.waitForEvent('page'); await p.click('[data-g]'); const sp = await gp;
  for (let i = 0; i < 16 && !(await sp.textContent('#tahdir-grade-bar').catch(() => '')).includes('انتهى'); i++) await sp.waitForTimeout(500);
  console.log('autosave run:', ((Date.now() - t0) / 1000).toFixed(1) + 's', '| graded:', graded, '| saves:', saves, '| bar:', (await sp.textContent('#tahdir-grade-bar')).slice(0, 80));
  await sp.screenshot({ path: OUT + 'gr_done.png' });
  console.log('errors', errs); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
