// اختبار مسار الآيفون الكامل على محرّك WebKit بملف iPhone 13:
//   (أ) المنصة تُشفّر المهمة وتُلحقها برابط نور (#tahdir=…)
//   (ب) نور يفكّ الترميز ويخزّن المهمة routed=true ثم ينظّف الرابط
// يحاكي Userscripts: GM.* غير متزامنة فقط، بلا GM_* المتزامنة، وبلا تخزين مشترك مضمون.
const fs = require('fs');
const path = require('path');

function loadPW() {
  const tries = [
    'playwright-core',
    path.join(process.cwd(), 'node_modules', 'playwright-core'),
    'C:\\Users\\mmody\\Documents\\deepseek-harness\\default-workspace\\.e2e\\node_modules\\playwright-core',
  ];
  for (const t of tries) { try { return require(t); } catch (e) { } }
  throw new Error('playwright-core غير موجود');
}

const H = require('./_pw.cjs');
const TOOL = fs.readFileSync(path.join(__dirname, '..', 'server', 'tahdir-noor.user.js'), 'utf8')
  .replace("location.hostname === 'tahdir.hudhaifa-bio.workers.dev'",
    "(location.hostname === 'tahdir.hudhaifa-bio.workers.dev' || location.hostname === 'localhost')");

const SHIM = "window.__opened='';" +
  "window.GM={getValue:(k)=>window.__gm('get',k),setValue:(k,v)=>window.__gm('set',k,v)," +
  "deleteValue:(k)=>window.__gm('del',k),listValues:()=>window.__gm('list')," +
  "openInTab:(u)=>{window.__opened=u;return Promise.resolve({});}};";

const PAYLOAD = {
  source: 'tahdir-al-aali', kind: 'prep', title: 'الاستدامة', grade: 'الحادي عشر',
  subject: 'العلوم البيئية', unit: '1', objective: 'يعرّف الاستدامة',
  fields: {
    lesson_vocabulary: 'الاستدامة والموارد', description: 'شرح',
    thinking_skills: 'نشاط جماعي', formative_assessment: 'ما معنى الاستدامة؟',
    closing_assessment: 'اذكر إجراءً', activities: 'كتاب الأنشطة ص12',
  },
};

let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const pw = loadPW();
  const srv = await H.boot();
  const B = srv.BASE;
  let browser;
  try { browser = await (process.env.CHROME_PATH?pw.chromium.launch({executablePath:process.env.CHROME_PATH}):pw.webkit.launch()); }
  catch (e) { console.log('  SKIP  محرّك WebKit غير منزّل'); srv.stop(); process.exit(0); }

  const ctx = await browser.newContext({ ...pw.devices['iPhone 13'], locale: 'ar-OM' });
  const store = new Map();
  const p = await ctx.newPage();
  await p.exposeFunction('__gm', async (op, k, v) => {
    if (op === 'get') return store.has(k) ? store.get(k) : undefined;
    if (op === 'set') { store.set(k, v); return 1; }
    if (op === 'del') { store.delete(k); return 1; }
    if (op === 'list') return [...store.keys()];
    return null;
  });
  await ctx.addInitScript({ content: SHIM });
  await ctx.addInitScript({ content: TOOL });

  // (أ) المنصة تُنتج الرابط الحامل للمهمة
  await p.goto(B + '/privacy', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1400);
  const opened = await p.evaluate(async (pl) => {
    document.dispatchEvent(new CustomEvent('tahdir-v3-send-prep', { detail: JSON.stringify(pl) }));
    await new Promise(r => setTimeout(r, 1400));
    return window.__opened || '';
  }, PAYLOAD);
  ok('المنصة تُلحق المهمة بالرابط', /[#&]tahdir=/.test(opened), opened ? opened.length + ' حرفًا' : 'لا رابط');
  ok('الرابط داخل الحد الأمني', opened.length > 0 && opened.length < 60000, String(opened.length));

  // (ب) نور يفكّ الترميز — نفتح صفحة محلية بالهاش نفسه الذي أنتجته المنصة
  const hashOnly = /[#&]tahdir=([^&]+)/.exec(opened);
  const enc = hashOnly ? hashOnly[1] : '';
  ok('الرابط يحمل قيمة مشفّرة', !!enc, enc ? enc.length + ' حرفًا' : 'مفقود');

  // أولًا: نتحقق أن القيمة تفكّ إلى المهمة نفسها (داخل الصفحة)
  const decoded = await p.evaluate((e) => {
    try {
      const raw = decodeURIComponent(escape(atob(decodeURIComponent(e))));
      const o = JSON.parse(raw);
      return { title: o.title, grade: o.grade, fields: Object.keys(o.fields || {}).length, src: o.source };
    } catch (err) { return { err: err.message }; }
  }, enc);
  ok('القيمة تفكّ إلى المهمة الصحيحة',
    decoded.title === PAYLOAD.title && decoded.grade === PAYLOAD.grade && decoded.src === 'tahdir-al-aali',
    decoded.err || (decoded.title + ' · ' + decoded.grade));
  ok('الحقول الستة داخل الحمولة', decoded.fields === 6, String(decoded.fields));

  // ثانيًا: نفتح صفحة أخرى بهذا الهاش — كما يحدث تمامًا حين يفتح نور
  store.delete('tahdir_pending_prep');
  await p.goto(B + '/privacy#tahdir=' + enc, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  const got = store.get('tahdir_pending_prep');
  ok('نور يفكّ الهاش ويخزّن المهمة', !!got, got ? '«' + got.data.title + '»' : 'لم تُخزَّن');
  ok('العنوان والصف سليمان', !!got && got.data.title === PAYLOAD.title && got.data.grade === PAYLOAD.grade,
    got ? got.data.title + ' · ' + got.data.grade : '');
  ok('الحقول الستة وصلت', !!got && Object.keys(got.data.fields || {}).length === 6,
    got ? String(Object.keys(got.data.fields || {}).length) : '');
  // الصفحة هنا ليست «إضافة تحضير»، فلا تُوسم «تم التوجيه» — وإلا توقّف نور على الرئيسية (مشكلة الآيفون)
  ok('غير موسومة routed (ليست صفحة الهدف)', !!got && got.routed === false, got ? String(got.routed) : '');
  const clean = await p.evaluate(() => location.hash);
  ok('الرابط يُنظَّف بعد القراءة', clean === '' || clean === '#', 'hash="' + clean + '"');
  ok('المهمة باقية للاستخدام', store.has('tahdir_pending_prep'), store.has('tahdir_pending_prep') ? 'باقية' : 'ضاعت');
  await browser.close(); srv.stop();
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message.slice(0, 200)); process.exit(1); });
