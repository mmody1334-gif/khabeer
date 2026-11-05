// يتحقق من نهائيات الرياضيات: الظهور، الصور، دخول البنك، وتوليد الاختبار القصير.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

// المقررات المتوقّعة وعدد درجات الاختبار القصير وفق وثيقة الرياضيات
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
  const c = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'ar-OM' });
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

  // 1) فهرس النهائيات
  await p.goto(B + '/finals', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  const idx = await p.evaluate(() => window.FIN_INDEX || {});
  const mathKeys = Object.keys(idx).filter(k => /رياض/.test(k));
  console.log('مفاتيح الرياضيات في FIN_INDEX: ' + JSON.stringify(mathKeys));
  ok('المقررات العشرة في فهرس النهائيات', mathKeys.length >= 10, mathKeys.length + ' مقررًا');

  // 2) نفتح كل مقرر ونتحقق من الصور
  const res = await p.evaluate(async (courses) => {
    const out = [];
    const sub = document.getElementById('courseSelSubj');
    const sel = document.getElementById('courseSel');
    if (!sub || !sel) return { err: 'لا قوائم' };
    for (const [subject, grade] of courses) {
      const so = [...sub.options].find(x => x.textContent.replace(/[^\u0600-\u06FF ]/g, '').trim() === subject);
      if (!so) { out.push({ subject, grade, err: 'لا مادة' }); continue; }
      sub.value = so.value; sub.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 900));
      const go = [...sel.options].find(x => x.textContent.includes(grade));
      if (!go) { out.push({ subject, grade, err: 'لا صف' }); continue; }
      sel.value = go.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 2600));
      const units = [...document.querySelectorAll('#fside [data-u]')];
      if (!units.length) { out.push({ subject, grade, err: 'لا وحدات' }); continue; }
      units[0].click(); await new Promise(x => setTimeout(x, 1500));
      // الصور تُحمَّل كسولًا (loading="lazy")، فنمرّر الصفحة حتى تُحمَّل كلها.
      // الصف 11 قد يعرض أكثر من 50 صورة في الوحدة، فنمرّر مرّات كافية ثم ننتظر.
      const main = document.getElementById('fmain');
      for (let k = 0; k < 40; k++) {
        window.scrollBy(0, 1200);
        if (main) main.scrollTop = main.scrollHeight;
        await new Promise(x => setTimeout(x, 200));
        const im = [...document.querySelectorAll('#fmain img')];
        if (im.length && im.every(i => i.complete && i.naturalWidth > 50)) break;
      }
      await new Promise(x => setTimeout(x, 2500));
      window.scrollTo(0, 0);
      const imgs = [...document.querySelectorAll('#fmain img')];
      const broken = imgs.filter(i => !i.complete || i.naturalWidth < 50).length;
      const chk = [...document.querySelectorAll('#fmain input[type=checkbox]')].length;
      out.push({ subject, grade, units: units.length, imgs: imgs.length, broken, picks: chk });
    }
    return { out };
  }, COURSES);
  if (res.err) { ok('فتح المقررات', false, res.err); }
  else {
    for (const r of res.out) {
      const label = r.subject + ' · ' + r.grade;
      if (r.err) { ok(label, false, r.err); continue; }
      console.log('  ' + label + ': ' + r.units + ' وحدة · ' + r.imgs + ' صورة · مكسورة=' + r.broken);
      ok(label, r.imgs > 0 && r.broken === 0, r.imgs + ' صورة · مكسورة ' + r.broken);
    }
  }

  // 3) البنك والاختبار القصير لكل مقرر
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  const bank = await p.evaluate(async (courses) => {
    const out = [];
    for (const [subject, grade] of courses) {
      const r = await fetch('/api/quiz/bank?key=' + encodeURIComponent(subject + '|' + grade), { credentials: 'same-origin' });
      if (!r.ok) { out.push({ subject, grade, err: r.status }); continue; }
      const d = await r.json();
      const fin = (d.items || []).filter(x => String(x.qid || '').startsWith('f'));
      out.push({ subject, grade, total: (d.items || []).length, fin: fin.length,
                 types: [...new Set((d.items || []).map(x => x.type))],
                 marks: [...new Set((d.items || []).map(x => x.marks))].sort(),
                 withImg: (d.items || []).filter(x => x.img).length });
    }
    return out;
  }, COURSES);
  console.log('\nالبنك:');
  for (const r of bank) {
    const label = r.subject + ' · ' + r.grade;
    if (r.err) { ok('بنك ' + label, false, 'HTTP ' + r.err); continue; }
    console.log('  ' + label + ': ' + r.total + ' مفردة (منها ' + r.fin + ' وزارية) · أنواع=' + JSON.stringify(r.types) + ' · درجات=' + JSON.stringify(r.marks));
    ok('بنك ' + label, r.fin > 0, r.fin + ' مفردة وزارية');
  }

  await p.screenshot({ path: require('path').join(__dirname, 'math_finals.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
