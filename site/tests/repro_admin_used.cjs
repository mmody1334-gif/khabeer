// يتحقق من: (1) إخفاء «الصفوف المستخدمة» عن حساب المدير، (2) عرضها قائمةً تُفتح
// لبقية المعلمين، (3) أن تسجيل دخول المعلم يعمل ويُطبّق صلاحياته فعلًا.
const PW = require('./_pw.cjs');
const ADMIN = { u: 'mohamed', p: (process.env.TEST_PASS||'') };
const T = { name: 'أ. سالم الاختبار', u: 'salem_t', p: (process.env.TEST_PASS||''),
            scope: ['اللغة العربية|الخامس', 'اللغة العربية|السادس', 'اللغة العربية|السابع', 'اللغة العربية|الثامن'] };
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

async function login(p, B, u, pw) {
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(700);
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', ADMIN.u);
    await p.fill('#password', ADMIN.p); await p.fill('#password2', ADMIN.p);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
    await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(700);
  }
  if (!(await p.$('#loginForm'))) return { already: true };
  await p.fill('#username', u); await p.fill('#password', pw);
  await p.click('#loginBtn'); await p.waitForTimeout(2600);
  const txt = await p.evaluate(() => document.body.innerText.slice(0, 400));
  const onApp = /دروس|التحضير|المواد/.test(txt);
  const errMsg = (txt.match(/(هذا الحساب[^\n]{0,120}|كلمة المرور[^\n]{0,80}|غير صحيح[^\n]{0,60})/) || [])[1] || '';
  return { onApp, errMsg, txt: txt.slice(0, 160) };
}

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];

  // ---------- 1) لوحة المدير ----------
  const c1 = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'ar-OM' });
  const p1 = await c1.newPage();
  p1.on('pageerror', e => errs.push('admin: ' + e.message));
  await login(p1, B, ADMIN.u, ADMIN.p);
  await p1.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(3500);

  // نُنشئ معلمًا بصلاحية
  await p1.evaluate(async (t) => {
    await fetch('/api/admin/teachers', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: t.name, username: t.u, password: t.p, scope: t.scope })
    });
  }, T);
  await p1.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(3800);

  const tbl = await p1.evaluate(() => {
    const rows = [...document.querySelectorAll('.tbl tbody tr')];
    return rows.map(tr => {
      const cells = [...tr.children].map(td => td.textContent.trim());
      const isAdmin = /مدير/.test(tr.textContent);
      const det = tr.querySelector('.sc-used');
      const used = tr.children[4] ? tr.children[4].textContent.trim() : '';
      return { name: (tr.querySelector('b') || {}).textContent || '', isAdmin,
               used, hasDetails: !!det, summary: det ? det.querySelector('summary').textContent.trim() : '',
               chips: tr.children[4] ? tr.children[4].querySelectorAll('.chip-s').length : 0 };
    });
  });
  const adminRow = tbl.find(r => r.isAdmin);
  const teacherRow = tbl.find(r => /سالم/.test(r.name));
  console.log('صف المدير: ' + JSON.stringify(adminRow));
  console.log('صف المعلم: ' + JSON.stringify(teacherRow));

  ok('حساب المدير بلا «صفوف مستخدمة»', !!adminRow && adminRow.used === '—', adminRow ? adminRow.used : 'لا صف');

  // ---------- 2) دخول المعلم ----------
  const c2 = await b.newContext({ viewport: { width: 1400, height: 950 }, locale: 'ar-OM' });
  const p2 = await c2.newPage();
  const terr = [];
  p2.on('pageerror', e => terr.push('teacher: ' + e.message));
  const r2 = await login(p2, B, T.u, T.p);
  console.log('دخول المعلم: ' + JSON.stringify({ onApp: r2.onApp, err: r2.errMsg }));
  ok('المعلم يسجّل الدخول ويصل للتطبيق', !!r2.onApp, r2.errMsg || 'دخل');
  ok('لا رسالة خطأ في الدخول', !r2.errMsg, r2.errMsg || 'بلا خطأ');

  // «الصفوف المستخدمة» تُجمع من جدول الأحداث (نوع view/grade). نولّد استخدامًا
  // حقيقيًّا لهذا المعلم في أربعة صفوف حتى تُبنى قائمته فعلًا.
  await p2.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(2500);
  const seeded = await p2.evaluate(async (grades) => {
    let n = 0;
    for (const g of grades) {
      const r = await fetch('/api/event', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'view', grade: g, detail: '', title: '' })
      });
      if (r.ok) n++;
    }
    return n;
  }, ['الخامس', 'السادس', 'السابع', 'الثامن']);
  console.log('أحداث استخدام مولّدة: ' + seeded);
  ok('توليد أحداث الاستخدام', seeded === 4, seeded + ' حدثًا');

  // نعود للوحة المدير ونتحقق من القائمة المطويّة
  await p1.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(3800);
  const tbl2 = await p1.evaluate(() => {
    const tr = [...document.querySelectorAll('.tbl tbody tr')].find(r => /سالم/.test(r.textContent));
    if (!tr) return { err: 'لا صف' };
    const det = tr.querySelector('.sc-used');
    return {
      hasDetails: !!det,
      summary: det ? det.querySelector('summary').textContent.trim() : '',
      chips: det ? det.querySelectorAll('.chip-s').length : 0,
      usedText: tr.children[4] ? tr.children[4].textContent.trim() : ''
    };
  });
  console.log('قائمة المعلم: ' + JSON.stringify(tbl2));
  ok('المعلم له قائمة تُفتح (تفاصيل)', !tbl2.err && tbl2.hasDetails, tbl2.err || (tbl2.hasDetails ? 'موجودة' : 'غير موجودة'));
  ok('القائمة تعرض عدد الصفوف', /\d+\s*صفوف/.test(tbl2.summary || ''), tbl2.summary || '');
  ok('الصفوف الأربعة داخل القائمة', tbl2.chips === 4, (tbl2.chips || 0) + ' صفًا');

  // نفتح القائمة ونتحقق من ظهور الرقاقات
  const opened = await p1.evaluate(() => {
    const d = [...document.querySelectorAll('.sc-used')].find(x => /صفوف/.test(x.textContent));
    if (!d) return { err: 'لا قائمة' };
    d.open = true;
    const chips = [...d.querySelectorAll('.chip-s')].map(x => x.textContent.trim());
    return { chips: chips.length, text: chips.join(' · ') };
  });
  ok('القائمة تُفتح وتُظهر الصفوف', !opened.err && (opened.chips || 0) > 0, opened.err || opened.text);

  // صلاحياته تُطبَّق: يرى مواده فقط
  await p2.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(3500);
  const seen = await p2.evaluate(async () => {
    const r = await fetch('/api/courses', { credentials: 'same-origin' });
    const d = await r.json();
    return (d.courses || []).map(c => c.key);
  });
  console.log('مقررات المعلم: ' + JSON.stringify(seen));
  ok('المعلم يرى مقرراته الأربعة فقط', seen.length === 4 && seen.every(k => /^اللغة العربية\|/.test(k)),
     seen.length + ' مقررًا');
  ok('لا يستطيع فتح مقرر خارج صلاحيته',
     (await p2.evaluate(async () => (await fetch('/api/quiz/bank?key=' + encodeURIComponent('الرياضيات|الخامس'), { credentials: 'same-origin' })).status)) === 403,
     'HTTP 403');

  await p2.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(2000);
  const adminBlocked = await p2.evaluate(() => ({ url: location.pathname, hasDash: !!document.getElementById('dash') }));
  ok('المعلم لا يدخل لوحة التحكم', adminBlocked.url !== '/admin' || !adminBlocked.hasDash,
     adminBlocked.url);

  await p1.screenshot({ path: require('path').join(__dirname, 'admin_used.png') });
  await b.close(); srv.stop();
  const real = [...new Set(errs.concat(terr))];
  console.log('\nأخطاء JavaScript: ' + (real.length ? real.join('\n') : '(لا شيء)'));
  ok('لا أخطاء JavaScript', real.length === 0, real.slice(0, 3).join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
