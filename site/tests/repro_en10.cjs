// يتحقق من ظهور اللغة الإنجليزية (الصف العاشر) بتحضيرها الإنجليزي الكامل.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
const F = ['concepts', 'pre_learning', 'outcomes', 'strategies', 'activities_teach', 'resources', 'formative', 'closing', 'homework'];

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
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);

  const r = await p.evaluate(async () => {
    const sel = document.getElementById('subjSel');
    const o = [...sel.options].find(x => /إنجليز|انجليز|English/i.test(x.value));
    if (!o) return { err: 'لا مادة إنجليزية' };
    sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 1000));
    const grades = [...document.querySelectorAll('.g-btn')].map(x => x.textContent.trim().slice(0, 24));
    const g = [...document.querySelectorAll('.g-btn')].find(x => /العاشر/.test(x.textContent));
    if (!g) return { err: 'لا صف عاشر', grades };
    if (!g.parentElement.querySelector('.g-body.open')) { g.click(); await new Promise(x => setTimeout(x, 800)); }
    const units = [...document.querySelectorAll('.u-name')].map(x => x.textContent.trim());
    const u = [...document.querySelectorAll('.u-btn')].find(x => x.offsetParent !== null);
    if (u) { u.click(); await new Promise(x => setTimeout(x, 800)); }
    const ls = [...document.querySelectorAll('.l-list button')].filter(x => x.offsetParent !== null);
    if (!ls.length) return { err: 'لا دروس', grades, units };
    const title = ls[0].textContent.trim().slice(0, 44);
    ls[0].click(); await new Promise(x => setTimeout(x, 1500));
    const shown = [], empty = [], vals = {};
    for (const k of ['concepts', 'pre_learning', 'outcomes', 'strategies', 'activities_teach', 'resources', 'formative', 'closing', 'homework']) {
      const el = document.getElementById('f_' + k);
      if (el) shown.push(k);
      if (!el || !String(el.value).trim()) empty.push(k);
      vals[k] = el ? String(el.value).slice(0, 70) : '';
    }
    // هل العناوين إنجليزية؟
    const heads = [...document.querySelectorAll('.sec-head h3, .sec-head span')].map(x => x.textContent.trim()).filter(Boolean);
    return { title, grades, units, shown, empty, vals, heads: heads.slice(0, 8), count: ls.length };
  });
  console.log('الصفوف المتاحة: ' + JSON.stringify(r.grades));
  console.log('الوحدات: ' + JSON.stringify(r.units));
  console.log('الدرس: ' + r.title);
  console.log('الفارغة: ' + JSON.stringify(r.empty));
  console.log('عناوين الحقول: ' + JSON.stringify(r.heads));
  console.log('عيّنة مخرجات: ' + String((r.vals || {}).outcomes || '').slice(0, 80));
  ok('مادة الإنجليزية متاحة', !r.err, r.err || 'موجودة');
  ok('الصف العاشر ظاهر', (r.grades || []).some(x => /العاشر/.test(x)), JSON.stringify((r.grades || []).slice(0, 6)));
  ok('الوحدات الأربع ظاهرة', (r.units || []).length >= 4, JSON.stringify(r.units));
  ok('الحقول التسعة ظاهرة', (r.shown || []).length >= 9, (r.shown || []).length + ' حقلًا');
  ok('التحضير مملوء (لا فراغ)', (r.empty || []).length === 0, JSON.stringify(r.empty));
  await p.screenshot({ path: require('path').join(__dirname, 'en10.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
