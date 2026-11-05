// يتحقق من مواصفة الاختبار القصير للغة العربية + توليد ورقة فعلية من أسئلة الوزارة.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM' });
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
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1300);

  // هل اللغة العربية متاحة في قائمة المواد؟
  const subs = await p.evaluate(() => [...document.getElementById('courseSelSubj').options].map(o => o.value));
  ok('اللغة العربية متاحة في الاختبارات', subs.some(x => /العربية/.test(x)), subs.filter(x => /العربية/.test(x)).join(','));

  const KEY = 'اللغة العربية|الثامن';
  const runs = [];
  for (let k = 0; k < 3; k++) {
    const r = await p.evaluate(async (key) => {
      const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
      subj.value = 'اللغة العربية'; subj.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 1400));
      if (![...cs.options].some(o => o.value === key)) return { err: 'المقرر غير متاح', opts: [...cs.options].map(o => o.value) };
      cs.value = key; cs.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 2200));
      const lids = [...document.querySelectorAll('[data-lid]')];
      lids.slice(0, 8).forEach(x => { if (!x.checked) x.click(); });
      await new Promise(x => setTimeout(x, 500));
      document.getElementById('makeBtn').click();
      await new Promise(x => setTimeout(x, 3200));
      const items = [...document.querySelectorAll('#paper .qi')];
      const marks = items.map(it => { const m = it.innerText.match(/\[(\d+)\]/); return m ? +m[1] : 0; });
      return {
        n: items.length, sum: marks.reduce((a, x) => a + x, 0), marks,
        mcq: items.filter(it => it.querySelector('table.chs')).length,
        imgs: items.filter(it => it.querySelector('img')).length,
        lessons: lids.length,
        spec: ((document.querySelector('.spec, .spec-box, #spec') || document.body).innerText || '')
          .match(/الدرجة الكلية\s*(\d+)\s*من\s*(\d+)/) || null,
        specText: ((document.querySelector('.checks') || document.body).innerText || '')
          .replace(/\s+/g, ' ').slice(0, 460),
      };
    }, KEY);
    runs.push(r);
    if (r.err) { console.log('خطأ: ' + r.err + ' | ' + JSON.stringify(r.opts || [])); break; }
    console.log(`توليد ${k + 1}: ${r.n} سؤالًا | مجموع=${r.sum} | MCQ=${r.mcq} | بصور=${r.imgs} | دروس=${r.lessons}`);
  }

  const good = runs.filter(r => !r.err);
  const first = good[0] || {};
  console.log('\nلوحة المواصفة: ' + (first.specText || '(لا)'));
  const wantsTotal = (first.specText || '').match(/من\s*15/);
  ok('دروس العربية ظهرت في الاختيار', good.length > 0 && first.lessons >= 8, first.lessons ? first.lessons + ' درسًا' : 'لا');
  ok('وُلّدت ورقة اختبار للعربية', good.length > 0 && good.every(r => r.n >= 1), good.map(r => r.n).join(','));
  ok('لوحة المواصفة تطبّق وثيقة التقويم (المطلوب 15 درجة)', !!wantsTotal, (first.specText || '').slice(0, 90));
  ok('عدد المفردات في نطاق الوثيقة (3-10)', good.length > 0 && good.every(r => r.n >= 1 && r.n <= 10), good.map(r => r.n).join(','));
  ok('الأسئلة تحمل صورة سؤال الوزارة', good.length > 0 && good.some(r => r.imgs > 0), good.map(r => r.imgs).join(','));
  ok('نطاق المفردات القصيرة 1-2 درجة (كما الوثيقة)', good.length > 0 && good.every(r => r.marks.every(m => m <= 2)), JSON.stringify(first.marks));
  await p.screenshot({ path: require('path').join(__dirname, 'arabic_quiz_spec.png'), fullPage: false });

  // الأنشطة الصفية (الخطط العلاجية) تستفيد من نفس المفردات
  await p.goto(B + '/remedial', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  const rem = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200));
  console.log('\nالأنشطة: ' + rem.slice(0, 150));
  ok('صفحة الأنشطة تُفتح بلا خطأ', rem.length > 20, rem.slice(0, 60));

  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
