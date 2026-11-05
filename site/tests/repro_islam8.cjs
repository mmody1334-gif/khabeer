// يتحقق من ظهور «التربية الإسلامية — الصف الثامن» في الصفحات الثلاث وأن مفرداته سليمة.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
const KEY = 'التربية الإسلامية|الثامن';

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
  }
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn'); await p.waitForTimeout(2500);
  }

  // المصادقة على المقرر (الصلاحيات) — نضيف النطاق للمعلم ثم نعيد الدخول
  const had = await p.evaluate(async (k) => {
    const r = await fetch('/api/courses'); const j = await r.json();
    return (j.courses || []).some(x => x.key === k);
  }, KEY);
  ok('المقرر مُدرج في /api/courses', had, had ? 'موجود' : 'غير موجود');

  // نتحقق أن بنك الأسئلة يعمل للمقرر
  const bank = await p.evaluate(async (k) => {
    const r = await fetch('/api/quiz/bank?key=' + encodeURIComponent(k));
    const j = await r.json();
    return { err: j.error || '', lessons: (j.lessons || []).length, items: (j.items || []).length };
  }, KEY);
  console.log('   بنك الأسئلة: ' + JSON.stringify(bank));
  ok('بنك أسئلة التربية الإسلامية متاح', !bank.err && bank.lessons > 0, `دروس=${bank.lessons} مفردات=${bank.items}`);

  // صفحة الاختبارات النهائية
  await p.goto(B + '/finals', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1500);
  const sel = await p.evaluate(async (k) => {
    const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
    const has = subj ? [...subj.options].some(o => o.value === 'التربية الإسلامية') : false;
    if (has) {
      subj.value = 'التربية الإسلامية'; subj.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1200));
    }
    const hasKey = cs ? [...cs.options].some(o => o.value === k) : false;
    if (hasKey) {
      cs.value = k; cs.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 2500));
    }
    return { has, hasKey, cards: document.querySelectorAll('.fin-q').length,
             units: [...document.querySelectorAll('.fin-u')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).slice(0, 4) };
  }, KEY);
  console.log('   النهائية: ' + JSON.stringify(sel));
  ok('المادة متاحة في الاختبارات النهائية', sel.has, sel.has ? 'نعم' : 'لا');
  ok('الصف الثامن متاح للمادة', sel.hasKey, sel.hasKey ? 'نعم' : 'لا');
  ok('مفردات النهائية تظهر', sel.cards > 0, sel.cards + ' بطاقة');

  // صفحة الاختبار القصير
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1200);
  const quizRes = await p.evaluate(async (k) => {
    const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
    const has = subj ? [...subj.options].some(o => o.value === 'التربية الإسلامية') : false;
    if (has) { subj.value = 'التربية الإسلامية'; subj.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1200)); }
    const hasKey = cs ? [...cs.options].some(o => o.value === k) : false;
    if (hasKey) { cs.value = k; cs.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 2500)); }
    return { has, hasKey, lessons: document.querySelectorAll('[data-lid]').length };
  }, KEY);
  console.log('   التقويم: ' + JSON.stringify(quizRes));
  ok('المادة متاحة في الاختبارات القصيرة', quizRes.has && quizRes.lessons > 0, `دروس=${quizRes.lessons}`);

  // صفحة الأنشطة الصفية
  await p.goto(B + '/remedial', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1200);
  const rem = await p.evaluate(async (k) => {
    const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
    const has = subj ? [...subj.options].some(o => o.value === 'التربية الإسلامية') : false;
    if (has) { subj.value = 'التربية الإسلامية'; subj.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1200)); }
    const hasKey = cs ? [...cs.options].some(o => o.value === k) : false;
    return { has, hasKey };
  }, KEY);
  ok('المادة متاحة في الخطط العلاجية', rem.hasKey, JSON.stringify(rem));

  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
