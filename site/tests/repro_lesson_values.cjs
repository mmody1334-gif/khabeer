// يتحقق أن كل درس إسلامي له قيمه الخاصة، وأن التصدير يستخدم قيم الدرس لا العامة.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

const openLessonByIndex = (p, idx) => p.evaluate(async (i) => {
  const sel = document.getElementById('subjSel');
  if (sel) {
    const o = [...sel.options].find(x => /إسلام/.test(x.value));
    if (o) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 800)); }
  }
  const g = [...document.querySelectorAll('.g-btn')].find(x => /الثامن/.test(x.textContent));
  if (g && !g.parentElement.querySelector('.g-body.open')) { g.click(); await new Promise(r => setTimeout(r, 700)); }
  const u = [...document.querySelectorAll('.u-btn')].find(x => x.offsetParent !== null);
  const list = document.querySelector('.u-block .l-list');
  if (u && list && !list.classList.contains('open')) { u.click(); await new Promise(r => setTimeout(r, 700)); }
  const ls = [...document.querySelectorAll('.l-list button')].filter(x => x.offsetParent !== null);
  if (!ls[i]) return { err: 'لا درس' };
  const t = ls[i].textContent.trim().slice(0, 26);
  ls[i].click();
  await new Promise(r => setTimeout(r, 1100));
  const f = k => { const el = document.getElementById('f_' + k); return el ? el.value : null; };
  return { title: t, strategies: f('strategies'), resources: f('resources'), outcomes: (f('outcomes') || '').slice(0, 50) };
}, idx);

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

  const seen = [];
  for (let i = 0; i < 4; i++) {
    const r = await openLessonByIndex(p, i);
    if (r.err) break;
    seen.push(r);
    console.log(`\n[${i + 1}] ${r.title}`);
    console.log('    الاستراتيجيات: ' + String(r.strategies).split('\n')[0].slice(0, 60));
    console.log('    الوسائل: ' + String(r.resources).split('\n')[0].slice(0, 60));
    console.log('    المخرجات: ' + String(r.outcomes).split('\n')[0].slice(0, 60));
  }
  ok('أربعة دروس مختلفة ظهرت', seen.length === 4, seen.length + ' دروس');
  const dStrat = new Set(seen.map(x => String(x.strategies).slice(0, 50)));
  const dRes = new Set(seen.map(x => String(x.resources).slice(0, 40)));
  ok('الاستراتيجيات تختلف بين الدروس', dStrat.size >= 3, dStrat.size + ' استراتيجية مختلفة');
  ok('الوسائل تختلف بين الدروس', dRes.size >= 2, dRes.size + ' وسائل مختلفة');
  ok('لا درس بقيم فارغة', seen.every(x => String(x.strategies || '').length > 10 && String(x.resources || '').length > 5),
    JSON.stringify(seen.map(x => [String(x.strategies).length, String(x.resources).length])));

  // نجرّب «نسخ للتحضير» من داخل الدرس ونتأكد أن القيم مضمّنة
  const copied = await p.evaluate(async () => {
    const btn = [...document.querySelectorAll('[data-copy]')].find(b => b.getAttribute('data-copy') === 'strategies');
    if (!btn) return { ok: false, why: 'لا زر نسخ' };
    let captured = '';
    const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (t) => { captured = t; return Promise.resolve(); };
    btn.click();
    await new Promise(r => setTimeout(r, 500));
    navigator.clipboard.writeText = orig;
    return { ok: true, len: captured.length, head: captured.slice(0, 80) };
  });
  console.log('\nنسخ حقل الاستراتيجيات: ' + JSON.stringify(copied));
  ok('زر نسخ الاستراتيجيات يعمل', copied.ok && copied.len > 10, JSON.stringify(copied));
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
