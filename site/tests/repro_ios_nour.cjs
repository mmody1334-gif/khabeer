// الآيفون (Userscripts): «إرسال التحضير إلى نور» يفتح رئيسية نور (/teacher#tahdir=…) لأن الموقع لا يعرف رقم الصف.
// يجب أن تكمل الأداة التوجيه بنفسها:
//   (أ) نور فيه قائمة الصفوف → توجيه تلقائي إلى «إضافة تحضير» للصف الصحيح
//   (ب) القائمة مخفية (جوال) → شريط «افتح الصف» ثم في صفحة الصف «هل هذا الصف؟ متابعة» → إضافة تحضير، ويُحفظ الرقم
//   (ج) المرة التالية → توجيه مباشر بالرقم المحفوظ
const fs = require('fs'), path = require('path');
function loadPW() { for (const t of ['playwright-core', 'playwright']) { try { return require(t); } catch (e) { } } throw new Error('playwright-core غير موجود'); }
const TOOL = fs.readFileSync(path.join(__dirname, '..', 'server', 'tahdir-noor.user.js'), 'utf8');
const SHIM = "window.GM={getValue:(k)=>window.__gm('get',k),setValue:(k,v)=>window.__gm('set',k,v),deleteValue:(k)=>window.__gm('del',k),listValues:()=>window.__gm('list'),openInTab:(u)=>Promise.resolve({})};";
const PAYLOAD = { source: 'tahdir-al-aali', kind: 'prep', title: 'مقدمة إلى التحول الرقمي', grade: 'الثاني عشر', subject: 'تقنية المعلومات', unit: '2',
  fields: { description: 'أ', activities: 'ب', formative_assessment: 'ج', closing_assessment: 'د', pre_learning: 'هـ', lesson_vocabulary: 'و' } };
const enc = encodeURIComponent(Buffer.from(unescape(encodeURIComponent(JSON.stringify(PAYLOAD))), 'binary').toString('base64'));
const HOME_LINKS = '<html><body><h1>أهلا</h1><nav id=sb></nav><script>setTimeout(()=>{sb.innerHTML=\'<a href="/teacher/courses/browse_content/cid:501">تقنية المعلومات / الحادي عشر</a><a href="/teacher/courses/browse_content/cid:502">تقنية المعلومات / الثاني عشر</a>\'},700)</script></body></html>';
const HOME_HIDDEN = '<html><body><h1>أهلا</h1><p>مركز الإشعارات</p></body></html>';
const COURSE = '<html><body><h2>تقنية المعلومات / الثاني عشر</h2></body></html>';
const PREP = '<html><body><h2>إضافة تحضير</h2></body></html>';
let pass = 0, fail = 0; const ok = (n, c, d) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n + (d ? '  → ' + d : '')); c ? pass++ : fail++; };
(async () => {
  const pw = loadPW(); let browser;
  try { browser = await pw.webkit.launch(); } catch (e) {
    if (!process.env.CHROME_PATH) { console.log('  SKIP  لا WebKit ولا CHROME_PATH'); process.exit(0); }
    browser = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH }); console.log('  (WebKit غير متاح — Chromium بملف iPhone)');
  }
  const store = new Map();
  async function ctxFor(home) {
    const ctx = await browser.newContext({ ...pw.devices['iPhone 13'], locale: 'ar-OM' });
    await ctx.route('https://lms.moe.gov.om/**', r => { const u = r.request().url(); r.fulfill({ contentType: 'text/html; charset=utf-8', body: /add_preparation/.test(u) ? PREP : /browse_content/.test(u) ? COURSE : home }); });
    await ctx.exposeFunction('__gm', async (op, k, v) => { if (op === 'get') return store.has(k) ? store.get(k) : undefined; if (op === 'set') { store.set(k, v); return 1; } if (op === 'del') { store.delete(k); return 1; } if (op === 'list') return [...store.keys()]; return null; });
    await ctx.addInitScript({ content: SHIM }); await ctx.addInitScript({ content: TOOL });
    return ctx;
  }
  // (أ)
  let ctx = await ctxFor(HOME_LINKS), p = await ctx.newPage();
  await p.goto('https://lms.moe.gov.om/teacher#tahdir=' + enc);
  await p.waitForURL(/add_preparation/, { timeout: 15000 }).catch(() => {});
  ok('(أ) الرئيسية فيها الصفوف → توجيه تلقائي', /add_preparation\/cid:502/.test(p.url()), p.url().replace('https://lms.moe.gov.om', ''));
  await ctx.close(); store.clear();
  // (ب)
  ctx = await ctxFor(HOME_HIDDEN); p = await ctx.newPage();
  await p.goto('https://lms.moe.gov.om/teacher#tahdir=' + enc);
  await p.waitForSelector('#tahdir-course-bar', { timeout: 15000 }).catch(() => {});
  const t1 = await p.textContent('#tahdir-course-bar').catch(() => '');
  ok('(ب) القائمة مخفية → شريط «افتح الصف» ثابت', /افتح هذا الصف/.test(t1), (t1 || 'لا شريط').slice(0, 60));
  await p.goto('https://lms.moe.gov.om/teacher/courses/browse_content/cid:502');
  await p.waitForSelector('#tahdir-course-bar', { timeout: 8000 }).catch(() => {});
  const t2 = await p.textContent('#tahdir-course-bar').catch(() => '');
  ok('(ب) صفحة الصف → «هل هذا صف…؟»', /هل هذا صف «تقنية المعلومات \/ الثاني عشر»/.test(t2), (t2 || 'لا شريط').slice(0, 60));
  await p.click('#tahdir-course-bar button').catch(() => {});
  await p.waitForURL(/add_preparation/, { timeout: 8000 }).catch(() => {});
  ok('(ب) «متابعة» → إضافة تحضير للصف', /add_preparation\/cid:502/.test(p.url()), p.url().replace('https://lms.moe.gov.om', ''));
  const map = store.get('tahdir_grade_cids') || {};
  ok('(ب) رقم الصف محفوظ للمرة القادمة', Object.values(map).includes('502'), JSON.stringify(map).slice(0, 80));
  await ctx.close();
  // (ج) — نفس التخزين (الرقم محفوظ)، والقائمة ما زالت مخفية
  ctx = await ctxFor(HOME_HIDDEN); p = await ctx.newPage();
  await p.goto('https://lms.moe.gov.om/teacher#tahdir=' + enc);
  await p.waitForURL(/add_preparation/, { timeout: 15000 }).catch(() => {});
  ok('(ج) المرة التالية → توجيه مباشر بلا سؤال', /add_preparation\/cid:502/.test(p.url()), p.url().replace('https://lms.moe.gov.om', ''));
  await browser.close();
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message.slice(0, 200)); process.exit(1); });
