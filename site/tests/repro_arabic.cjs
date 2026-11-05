// يتحقق أن دروس اللغة العربية والإسلامية تُعرض بتحضيرها الكامل، وبلا تصادم معرّفات.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
const F = ['concepts', 'pre_learning', 'outcomes', 'strategies', 'activities_teach', 'resources', 'formative', 'closing', 'homework'];

const pickSubject = (p, re) => p.evaluate(async (src) => {
  const rx = new RegExp(src);
  const sel = document.getElementById('subjSel');
  if (!sel) return { ok: false, why: 'لا قائمة مواد' };
  const o = [...sel.options].find(x => rx.test(x.value));
  if (!o) return { ok: false, why: 'المادة غير متاحة: ' + [...sel.options].map(x => x.value).join('|').slice(0, 120) };
  sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 900));
  return { ok: true, opts: [...sel.options].map(x => x.value) };
}, re.source);

const openGradeLesson = (p, gradeRe) => p.evaluate(async (src) => {
  const rx = new RegExp(src);
  const g = [...document.querySelectorAll('.g-btn')].find(x => rx.test(x.textContent));
  if (!g) return { ok: false, why: 'لا صف' };
  if (!g.parentElement.querySelector('.g-body.open')) { g.click(); await new Promise(r => setTimeout(r, 700)); }
  const u = [...document.querySelectorAll('.u-btn')].find(x => x.offsetParent !== null);
  if (u) { u.click(); await new Promise(r => setTimeout(r, 700)); }
  const ls = [...document.querySelectorAll('.l-list button')].filter(x => x.offsetParent !== null);
  if (!ls.length) return { ok: false, why: 'لا دروس' };
  const title = ls[0].textContent.trim().slice(0, 30);
  ls[0].click(); await new Promise(r => setTimeout(r, 1200));
  const out = { ok: true, title, shown: [], empty: [] };
  for (const k of ['concepts', 'pre_learning', 'outcomes', 'strategies', 'activities_teach', 'resources', 'formative', 'closing', 'homework']) {
    const el = document.getElementById('f_' + k);
    if (el) out.shown.push(k);
    if (!el || !String(el.value).trim()) out.empty.push(k);
  }
  return out;
}, gradeRe.source);

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
  await p.waitForTimeout(3200);

  // 1) قائمة المواد
  const subs = await p.evaluate(() => { const s = document.getElementById('subjSel'); return s ? [...s.options].map(x => x.value) : []; });
  console.log('المواد المتاحة في الشريط: ' + JSON.stringify(subs));
  ok('اللغة العربية متاحة', subs.some(x => /عربية/.test(x)), subs.filter(x => /عربية/.test(x)).join(','));
  ok('التربية الإسلامية متاحة', subs.some(x => /إسلام/.test(x)), subs.filter(x => /إسلام/.test(x)).join(','));

  // 2) اللغة العربية — تحضير كامل
  const arPick = await pickSubject(p, /عربية/);
  const ar = await openGradeLesson(p, /الخامس|السادس|السابع/);
  console.log('\n[اللغة العربية] ' + JSON.stringify(ar));
  ok('دروس اللغة العربية تُعرض', ar.ok && ar.shown.length >= 9, ar.ok ? ar.title : ar.why);
  ok('تحضير العربية مكتمل (بلا حقل فارغ)', ar.ok && ar.empty.length === 0, ar.ok ? ('فارغ: ' + JSON.stringify(ar.empty)) : '');

  // 3) التربية الإسلامية — تحضير كامل بمحتواها
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const isPick = await pickSubject(p, /إسلام/);
  const is = await openGradeLesson(p, /الثامن/);
  const isStrategies = await p.evaluate(() => { const e = document.getElementById('f_strategies'); return e ? e.value.slice(0, 60) : ''; });
  console.log('\n[التربية الإسلامية] ' + JSON.stringify(is));
  console.log('   الاستراتيجيات: ' + isStrategies);
  ok('دروس التربية الإسلامية تُعرض', is.ok && is.shown.length >= 9, is.ok ? is.title : is.why);
  ok('تحضير الإسلامية مكتمل', is.ok && is.empty.length === 0, is.ok ? ('فارغ: ' + JSON.stringify(is.empty)) : '');
  ok('استراتيجيات الإسلامية صحيحة (لا محتوى عربي)', /الحوار والمناقشة|التلاوة|السرد|العصف/.test(isStrategies), isStrategies);

  await p.screenshot({ path: require('path').join(__dirname, 'arabic_islamic_check.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
