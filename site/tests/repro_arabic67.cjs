// يتحقق من الاختبارات النهائية للغة العربية في كل الصفوف (5-11) وربطها بالاختبارات القصيرة.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
const GRADES = ['الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
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

  // 1) بنك الأسئلة لكل صف
  const banks = await p.evaluate(async (grades) => {
    const out = {};
    for (const g of grades) {
      const r = await (await fetch('/api/quiz/bank?key=' + encodeURIComponent('اللغة العربية|' + g))).json();
      out[g] = { items: (r.items || []).length, imgs: (r.items || []).filter(x => x.img).length };
    }
    return out;
  }, GRADES);
  console.log('بنك أسئلة اللغة العربية (من النهائيات):');
  for (const g of GRADES) console.log('   %s: %3d مفردة | %3d بصور', g.padEnd(12), banks[g].items, banks[g].imgs);
  ok('كل الصفوف السبعة لها بنك أسئلة', GRADES.every(g => banks[g].items > 0),
    GRADES.map(g => g + '=' + banks[g].items).join(' · '));
  ok('المفردات تحمل صور الورقة الوزارية', GRADES.every(g => banks[g].imgs > 0),
    GRADES.map(g => banks[g].imgs).join(','));

  // 2) توليد اختبار فعلي لكل صف
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1200);
  const gen = {};
  for (const g of GRADES) {
    const r = await p.evaluate(async (key) => {
      const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
      subj.value = 'اللغة العربية'; subj.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 1300));
      if (![...cs.options].some(o => o.value === key)) return { err: 'المقرر غير متاح' };
      cs.value = key; cs.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 1800));
      const lids = [...document.querySelectorAll('[data-lid]')];
      lids.slice(0, 8).forEach(x => { if (!x.checked) x.click(); });
      await new Promise(x => setTimeout(x, 400));
      document.getElementById('makeBtn').click();
      await new Promise(x => setTimeout(x, 3000));
      const items = [...document.querySelectorAll('#paper .qi')];
      return {
        n: items.length, imgs: items.filter(it => it.querySelector('img')).length,
        lessons: lids.length,
        spec: ((document.querySelector('.checks') || document.body).innerText || '').replace(/\s+/g, ' '),
      };
    }, 'اللغة العربية|' + g);
    gen[g] = r;
    if (r.err) { console.log('\n[%s] %s', g, r.err); continue; }
    const m = (r.spec.match(/الدرجة الكلية\s*(\d+)\s*من\s*(\d+)/) || []);
    console.log('\n[%s] %d سؤالًا | بصور=%d | دروس=%d | الدرجة %s من %s', g, r.n, r.imgs, r.lessons, m[1] || '?', m[2] || '?');
  }
  const good = GRADES.filter(g => gen[g] && !gen[g].err);
  ok('وُلّد اختبار لكل صف', good.length === GRADES.length, good.length + '/' + GRADES.length);
  ok('الأسئلة بصور الوزارة في كل صف', good.every(g => gen[g].imgs > 0), good.map(g => gen[g].imgs).join(','));
  ok('المواصفة تطبّق وثيقة التقويم (15 درجة)', good.every(g => /من\s*15/.test(gen[g].spec || '')),
    good.map(g => ((gen[g].spec || '').match(/من\s*(\d+)/) || [])[1]).join(','));
  await p.screenshot({ path: require('path').join(__dirname, 'arabic_all_grades.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
