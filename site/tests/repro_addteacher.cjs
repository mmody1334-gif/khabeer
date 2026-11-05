// يتحقق من حوار «إضافة معلمين»: قوائم منسدلة للمواد بدل شبكة مسطّحة،
// وخيار «تحديد كل صفوف المادة» يعمل.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'ar-OM' });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));

  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'م'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
  }
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn'); await p.waitForTimeout(2600);
  }
  await p.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3200);

  const r = await p.evaluate(async () => {
    const btn = document.getElementById('addBtn');
    if (!btn) return { err: 'لا زر إضافة' };
    btn.click(); await new Promise(x => setTimeout(x, 1000));
    const box = document.getElementById('modalBox');
    const accs = [...box.querySelectorAll('.sc-acc')];
    const before = {
      accs: accs.length,
      flat: box.querySelectorAll('[data-isc]').length,
      textarea: !!box.querySelector('#mText'),
      count: (document.getElementById('addCount') || {}).textContent || ''
    };
    const first = accs[0];
    const all = first.querySelector('[data-all]');
    first.open = true;
    all.checked = true; all.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 700));
    const a2 = [...box.querySelectorAll('.sc-acc')];
    const after = {
      count: (document.getElementById('addCount') || {}).textContent || '',
      badge: (a2[0].querySelector('.sc-e') || {}).textContent || '',
      checked: [...a2[0].querySelectorAll('[data-sc]')].filter(x => x.checked).length,
      total: a2[0].querySelectorAll('[data-sc]').length
    };
    // إلغاء التحديد يعمل أيضًا
    const all2 = a2[0].querySelector('[data-all]');
    all2.checked = false; all2.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 600));
    const a3 = [...box.querySelectorAll('.sc-acc')];
    const cleared = [...a3[0].querySelectorAll('[data-sc]')].filter(x => x.checked).length;
    return { before, after, cleared };
  });

  if (r.err) { ok('حوار إضافة معلمين يفتح', false, r.err); }
  else {
    ok('حوار إضافة معلمين يفتح', r.before.accs > 0, r.before.accs + ' مادة');
    ok('قوائم منسدلة لا شبكة مسطّحة', r.before.flat === 0 && r.before.accs > 0, 'مسطّح=' + r.before.flat);
    ok('خانة كتابة المعلمين موجودة', r.before.textarea === true, r.before.textarea ? 'موجودة' : 'مفقودة');
    ok('«تحديد كل الصفوف» يحدّد الجميع', r.after.checked === r.after.total && r.after.total > 0, r.after.checked + '/' + r.after.total);
    ok('شارة المادة تُظهر «كل الصفوف»', /كل الصفوف/.test(r.after.badge), r.after.badge);
    ok('العدّاد يتحدّث', /محدَّد/.test(r.after.count), r.after.count);
    ok('إلغاء التحديد يعمل', r.cleared === 0, r.cleared + ' محدَّد');
  }

  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript: ' + (real.length ? real.join('\n') : '(لا شيء)'));
  ok('لا أخطاء JavaScript', real.length === 0, real.slice(0, 3).join(' | ') || 'نظيف');

  await b.close(); srv.stop();
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
