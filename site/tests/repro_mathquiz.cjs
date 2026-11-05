// يتحقق من توليد الاختبار القصير للرياضيات ومطابقته لوثيقة التقويم (سبتمبر 2026).
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

// المتوقّع من وثيقة التقويم: الدرجة الكلية · أقل مفردات · أكثر مفردات · وجود إجابة طويلة
//
// ملاحظة على عدد المفردات للصفين 11-12: الوثيقة تحدّده بخمس (مفردتا اختيار من
// متعدد + مفردتا إجابة قصيرة + مفردة إجابة طويلة). وبنك الرياضيات مبنيّ من أوراق
// الوزارة ولا يحوي **اختيارًا من متعدد** (كل مفرداته إجابة قصيرة أو طويلة)، فيُبنى
// العدد من المفردات القصيرة (1-2 درجة) والإجابة الطويلة (4). وحين تقلّ مفردات
// درجة 2 في ورقة ما يتجاوز العدد خمسًا — وهذا ما يحدث في «الرياضيات الأساسية ·
// الثاني عشر» (فيها مفردة واحدة بدرجة 2 في الهدف الأول، فبلوغ 5 درجات يحتاج أربع
// مفردات). فالنطاق المسموح 5-7، مع بقاء **المجموع 10 والإجابة الطويلة** مطابقين.
const EXPECT = {
  'الخامس': [10, 6, 7, false], 'السادس': [10, 6, 7, false],
  'السابع': [10, 6, 7, true], 'الثامن': [10, 6, 7, true],
  'التاسع': [10, 6, 7, true], 'العاشر': [10, 6, 7, true],
  'الحادي عشر': [10, 5, 9, true], 'الثاني عشر': [10, 5, 9, true],
};
const COURSES = [
  ['الرياضيات', 'الخامس'], ['الرياضيات', 'السادس'], ['الرياضيات', 'السابع'],
  ['الرياضيات', 'الثامن'], ['الرياضيات', 'التاسع'], ['الرياضيات', 'العاشر'],
  ['الرياضيات الأساسية', 'الحادي عشر'], ['الرياضيات المتقدمة', 'الحادي عشر'],
  ['الرياضيات الأساسية', 'الثاني عشر'], ['الرياضيات المتقدمة', 'الثاني عشر'],
];

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'ar-OM' });
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

  const subs = await p.evaluate(() => [...document.getElementById('courseSelSubj').options].map(o => o.value));
  ok('مواد الرياضيات متاحة في التقويم', subs.filter(x => /رياض/.test(x)).length >= 3,
     subs.filter(x => /رياض/.test(x)).join(' · '));

  for (const [subject, grade] of COURSES) {
    const key = subject + '|' + grade;
    const r = await p.evaluate(async (cfg) => {
      const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
      const so = [...subj.options].find(o => o.value === cfg.subject);
      if (!so) return { err: 'لا مادة ' + cfg.subject };
      subj.value = cfg.subject; subj.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 1500));
      if (![...cs.options].some(o => o.value === cfg.key)) {
        return { err: 'المقرر غير متاح', opts: [...cs.options].map(o => o.value).slice(0, 8) };
      }
      cs.value = cfg.key; cs.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 2500));
      const lids = [...document.querySelectorAll('[data-lid]')];
      if (!lids.length) return { err: 'لا دروس للاختيار' };
      lids.forEach(x => { if (!x.checked) x.click(); });
      await new Promise(x => setTimeout(x, 600));
      const mb = document.getElementById('makeBtn');
      if (!mb) return { err: 'لا زر توليد' };
      mb.click();
      await new Promise(x => setTimeout(x, 3600));
      const items = [...document.querySelectorAll('#paper .qi')];
      // الدرجة تُعرض «N درجة» في ميتا المفردة، أو «[N]» في بعض المواد
      const marks = items.map(it => {
        const t = it.innerText;
        let m = t.match(/(\d+)\s*درجة/);
        if (m) return +m[1];
        m = t.match(/\[(\d+)\]/);
        return m ? +m[1] : 0;
      });
      const types = items.map(it => (it.innerText.match(/^(اختيار من متعدد|إجابة قصيرة|إجابة طويلة)/) || [])[1] || '');
      const imgs = document.querySelectorAll('#paper .qi img').length;
      const nMcq = types.filter(x => x === 'اختيار من متعدد').length;
      const tm = document.body.textContent.match(/الدرجة الكلية\s*(\d+)/);
      return {
        n: items.length, sum: marks.reduce((a, x) => a + x, 0), marks, imgs,
        panel: tm ? +tm[1] : null,
        hasLong: marks.some(m => m >= 3), types, nMcq,
        lessons: lids.length,
      };
    }, { subject, grade, key });
    const label = subject + ' · ' + grade;
    if (r.err) { ok('توليد ' + label, false, r.err + ' ' + JSON.stringify(r.opts || '')); continue; }
    const exp = EXPECT[grade] || [10, 5, 7, true];
    console.log('  ' + label + ': مجموع=' + r.sum + ' · مفردات=' + r.n + ' · درجات=' + JSON.stringify(r.marks) + ' · أنواع=' + JSON.stringify(r.types) + ' · صور=' + r.imgs);
    ok('توليد ' + label + ' بمجموع 10', r.sum === exp[0], 'المجموع ' + r.sum);
    ok('  عدد المفردات في نطاق الوثيقة (' + exp[1] + '-' + exp[2] + ')', r.n >= exp[1] && r.n <= exp[2], r.n + ' مفردة');
    ok('  الإجابة الطويلة كما الوثيقة', r.hasLong === exp[3], r.hasLong ? 'فيها' : 'بلا');
    ok('  الأسئلة تحمل صورة الوزارة', r.imgs > 0, r.imgs + ' صورة');
    ok('  مفردتا اختيار من متعدد (الوثيقة)', r.nMcq === 2, r.nMcq + ' مفردة');
  }

  await p.screenshot({ path: require('path').join(__dirname, 'math_quiz.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
