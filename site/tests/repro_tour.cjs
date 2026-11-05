// يتحقق من: (1) الدليل يبدأ بـ«أداة نور»، (2) يظهر لأول دخول فقط (علم الخادم)،
// (3) لا يظهر لمن له زيارات سابقة، (4) زر «؟ دليل» يعيده دائمًا.
const PW = require('./_pw.cjs');
const ADMIN = { u: 'mohamed', p: (process.env.TEST_PASS||'') };
const NEW = { name: 'أ. نورة الجديدة', u: 'nouranew', p: (process.env.TEST_PASS||''),
              scope: ['العلوم|الخامس', 'العلوم|السادس'] };
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

async function signin(p, B, u, pw) {
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  if (!(await p.$('#loginForm'))) return { noForm: true };
  await p.fill('#username', u); await p.fill('#password', pw);
  await p.click('#loginBtn'); await p.waitForTimeout(2700);
  return {};
}

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];

  // ---------- المدير ----------
  const cA = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'ar-OM' });
  const pA = await cA.newPage();
  pA.on('pageerror', e => errs.push('admin: ' + e.message));
  await pA.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await pA.waitForTimeout(900);
  if (await pA.$('#setupForm')) {
    await pA.fill('#name', 'أ. محمد مجدي'); await pA.fill('#username', ADMIN.u);
    await pA.fill('#password', ADMIN.p); await pA.fill('#password2', ADMIN.p);
    await pA.click('#setupForm button[type=submit]'); await pA.waitForTimeout(1800);
    await pA.goto(B + '/', { waitUntil: 'domcontentloaded' }); await pA.waitForTimeout(700);
  }
  if (await pA.$('#loginForm')) {
    await pA.fill('#username', ADMIN.u); await pA.fill('#password', ADMIN.p);
    await pA.click('#loginBtn'); await pA.waitForTimeout(2600);
  }
  await pA.goto(B + '/admin', { waitUntil: 'domcontentloaded' }); await pA.waitForTimeout(3200);
  const meAdmin = await pA.evaluate(async () => await (await fetch('/api/me', { credentials: 'same-origin' })).json());
  console.log('/api/me للمدير: ' + JSON.stringify(meAdmin));
  ok('المدير له حقل «أول دخول» من الخادم', typeof meAdmin.first === 'boolean', 'first=' + meAdmin.first);
  await pA.goto(B + '/app', { waitUntil: 'domcontentloaded' }); await pA.waitForTimeout(2600);
  ok('المدير لا يرى الدليل تلقائيًّا', !(await pA.$('#tourOv')), 'لا جولة');

  const created = await pA.evaluate(async (t) => {
    const r = await fetch('/api/admin/teachers', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: t.name, username: t.u, password: t.p, scope: t.scope }) });
    return { status: r.status, body: (await r.text()).slice(0, 120) };
  }, NEW);
  console.log('إنشاء المعلمة: ' + JSON.stringify(created));
  ok('إنشاء المعلمة نجح', created.status === 200, created.body);

  // ---------- معلمة جديدة: أول دخول ----------
  const c1 = await b.newContext({ viewport: { width: 1450, height: 950 }, locale: 'ar-OM' });
  const p1 = await c1.newPage();
  p1.on('pageerror', e => errs.push('new: ' + e.message));
  const sg1 = await signin(p1, B, NEW.u, NEW.p);
  console.log('نموذج الدخول ظهر: ' + !sg1.noForm);
  const txt1 = await p1.evaluate(() => document.body.innerText.slice(0, 180));
  console.log('بعد الدخول: ' + txt1.replace(/\\n/g, ' | '));
  const me1 = await p1.evaluate(async () => await (await fetch('/api/me', { credentials: 'same-origin' })).json());
  console.log('/api/me للمعلمة الجديدة: ' + JSON.stringify(me1));
  ok('المعلمة الجديدة «أول دخول»', me1.first === true, 'first=' + me1.first);

  await p1.evaluate(() => { try { localStorage.removeItem('tahdir_tour_v1'); localStorage.removeItem('kbs_welcome_v1'); localStorage.setItem('tahdir_test_tour','1'); } catch (e) { } });
  await p1.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(1400);
  await p1.evaluate(async () => {
    const ov = document.getElementById('modal');
    if (ov && !ov.hidden) { const x = ov.querySelector('.m-actions .btn'); if (x) x.click(); }
    await new Promise(r => setTimeout(r, 900));
  });
  await p1.waitForTimeout(2000);

  const t = await p1.evaluate(() => {
    const ov = document.getElementById('tourOv'); if (!ov) return null;
    const tip = document.getElementById('tourTip');
    return { first: (tip.querySelector('.tour-h') || {}).textContent || '',
             n: (tip.querySelector('.tour-n') || {}).textContent || '' };
  });
  console.log('خطوة 1: ' + JSON.stringify(t));
  ok('الدليل يظهر للمعلمة الجديدة', !!t, t ? 'ظهر' : 'لم يظهر');

  const step2 = await p1.evaluate(async () => {
    const n = document.getElementById('tourNext'); if (!n) return { err: 'لا زر' };
    n.click(); await new Promise(x => setTimeout(x, 750));
    const tip = document.getElementById('tourTip');
    const spot = document.getElementById('tourSpot');
    const btn = document.getElementById('toolBtn');
    let onTool = false;
    if (spot && !spot.hidden && btn) {
      const s = spot.getBoundingClientRect(), r = btn.getBoundingClientRect();
      onTool = Math.abs(s.top - r.top) < 16 && Math.abs(s.left - r.left) < 16;
    }
    return { head: (tip.querySelector('.tour-h') || {}).textContent || '',
             n: (tip.querySelector('.tour-n') || {}).textContent || '',
             cta: !!document.getElementById('tourCta'), onToolBtn: onTool };
  });
  console.log('خطوة 2: ' + JSON.stringify(step2));
  ok('الدليل يبدأ بـ«أداة نور»', /أداة نور/.test(step2.head || ''), step2.head || '—');
  ok('الثانية تُظلّل زر الأداة', step2.onToolBtn === true, step2.onToolBtn ? 'عليه' : 'ليس عليه');
  ok('فيها زر «كيف أثبّتها؟»', step2.cta === true, step2.cta ? 'موجود' : 'مفقود');

  const walk = await p1.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 9; i++) {
      const n = document.getElementById('tourNext'); if (!n) break;
      n.click(); await new Promise(x => setTimeout(x, 380));
      const ov = document.getElementById('tourOv'); if (!ov) { out.push('انتهت'); break; }
      out.push((document.querySelector('#tourTip .tour-h') || {}).textContent || '');
    }
    return out;
  });
  console.log('بقية الخطوات: ' + JSON.stringify(walk));
  ok('الدليل يكتمل ويُغلق', walk.includes('انتهت') || !(await p1.$('#tourOv')), 'أُغلق');

  // ---------- دخول ثانٍ: لا يظهر ----------
  const c2 = await b.newContext({ viewport: { width: 1450, height: 950 }, locale: 'ar-OM' });
  const p2 = await c2.newPage();
  p2.on('pageerror', e => errs.push('second: ' + e.message));
  await signin(p2, B, NEW.u, NEW.p);
  const me2 = await p2.evaluate(async () => await (await fetch('/api/me', { credentials: 'same-origin' })).json());
  console.log('/api/me بعد الدخول الثاني: ' + JSON.stringify(me2));
  ok('بعد الدخول الثاني ليس «أول دخول»', me2.first === false, 'first=' + me2.first);

  await p2.evaluate(() => { try { localStorage.clear(); localStorage.setItem('tahdir_test_tour','1'); } catch (e) { } });
  await p2.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(3200);
  ok('لا يظهر لمن له زيارات سابقة (ولو مسح التخزين)', !(await p2.$('#tourOv')), 'لا جولة');

  const re = await p2.evaluate(async () => {
    const x = document.getElementById('tourBtn'); if (!x) return { err: 'لا زر' };
    x.click(); await new Promise(r => setTimeout(r, 750));
    return { shown: !!document.getElementById('tourOv') };
  });
  ok('زر «؟ دليل» يعيده دائمًا', !re.err && re.shown, re.err || 'أُعيد');

  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript: ' + (real.length ? real.join('\n') : '(لا شيء)'));
  ok('لا أخطاء JavaScript', real.length === 0, real.slice(0, 3).join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
