// يتحقق من ظهور مادة الرياضيات وكل صف مبنيّ فيها، بتحضيره الكامل.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
const GRADES = ['الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
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

  const subs = await p.evaluate(() => { const s = document.getElementById('subjSel'); return s ? [...s.options].map(o => o.value) : []; });
  console.log('المواد: ' + JSON.stringify(subs));
  ok('مادة الرياضيات ظاهرة', subs.some(x => /رياض/.test(x)), subs.filter(x => /رياض/.test(x)).join(','));

  // نختار الرياضيات مرة واحدة
  await p.evaluate(async () => {
    const s = document.getElementById('subjSel');
    const o = [...s.options].find(x => /رياض/.test(x.value));
    if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); }
    await new Promise(x => setTimeout(x, 1200));
  });
  await p.waitForTimeout(1500);

  const grades = await p.evaluate(() => [...document.querySelectorAll('.g-btn')].map(x => x.textContent.trim().replace(/\d+\s*درس.*/, '').trim()));
  console.log('صفوف الرياضيات: ' + JSON.stringify(grades));

  for (const g of GRADES) {
    const r = await p.evaluate(async (grade) => {
      // نفتح الصف
      const gb = [...document.querySelectorAll('.g-btn')].find(x => x.textContent.includes(grade));
      if (!gb) return { err: 'لا صف ' + grade };
      const body = gb.parentElement.querySelector('.g-body');
      if (!body || !body.classList.contains('open')) { gb.click(); await new Promise(x => setTimeout(x, 900)); }
      const units = [...gb.parentElement.querySelectorAll('.u-btn, .u-name')].map(x => x.textContent.trim());
      // نفتح أول وحدة
      const ub = [...gb.parentElement.querySelectorAll('.u-btn')].filter(x => x.offsetParent !== null);
      if (!ub.length) return { err: 'لا وحدات', units };
      ub[0].click(); await new Promise(x => setTimeout(x, 900));
      const ls = [...document.querySelectorAll('.l-list button')].filter(x => x.offsetParent !== null);
      if (!ls.length) return { err: 'لا دروس', units };
      const title = ls[0].textContent.trim().slice(0, 40);
      ls[0].click(); await new Promise(x => setTimeout(x, 1500));
      const shown = [], empty = [];
      for (const k of ['concepts', 'pre_learning', 'outcomes', 'strategies', 'activities_teach', 'resources', 'formative', 'closing', 'homework']) {
        const el = document.getElementById('f_' + k);
        if (el) shown.push(k);
        if (!el || !String(el.value).trim()) empty.push(k);
      }
      return { title, units: units.length, shown: shown.length, empty, count: ls.length };
    }, g);
    if (r.err) { ok('صف ' + g + ' يعمل', false, r.err + ' ' + JSON.stringify(r.units || [])); continue; }
    console.log('  ' + g + ': ' + r.units + ' وحدة · ' + r.count + ' درسًا في الأولى · "' + r.title + '" · فارغة=' + JSON.stringify(r.empty));
    ok('صف ' + g + ': الدروس والحقول', r.shown >= 9 && r.empty.length === 0, r.shown + ' حقلًا · فارغة ' + r.empty.length);
  }

  await p.screenshot({ path: require('path').join(__dirname, 'math_grades.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
