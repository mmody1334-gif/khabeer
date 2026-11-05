// مساحة الطالب: المعلم ينشئ صفًا برمز ← الطالب يدخل بلا حساب ← ملخص وتدريب وبطاقات ← النتيجة تظهر للمعلم
const PW = require('./_pw.cjs');
const OUT = process.env.OUT || __dirname;
let pass = 0, fail = 0;
const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8806) }); const B = s.BASE;
  const b = await PW.chromium.launch({ headless: true });
  const c = await b.newContext({ viewport: { width: 1300, height: 950 }, locale: 'ar-OM' });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shut = () => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } });
  const settle = async () => { await p.waitForTimeout(2000); for (let i = 0; i < 3; i++) { await shut(); await p.waitForTimeout(250); } };
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); await shut();
  if (await p.$('#setupForm')) { await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500); await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); }
  await shut(); if (await p.$('#loginForm')) { await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForTimeout(2500); }
  await p.goto(B + '/space', { waitUntil: 'domcontentloaded' }); await settle();
  await p.click('#spNew'); await p.waitForTimeout(1500);
  await p.fill('#spName', 'العلوم — الخامس / 1');
  await p.click('#mOk'); await p.waitForTimeout(1800);
  const code = await p.evaluate(() => { const e = document.querySelector('.sp-big'); return e && e.textContent; });
  ok('إنشاء صف برمز وQR', /^[A-Z0-9]{6}$/.test(code || '') && !!(await p.$('.sp-qr svg')), code);
  await shut();
  // الطالب: سياق جديد بلا جلسة
  const sc = await b.newContext({ ...require('playwright-core').devices['iPhone 13'], locale: 'ar-OM' });
  await sc.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const q = await sc.newPage(); q.on('pageerror', e => errs.push('student: ' + e.message));
  await q.goto(B + '/s/' + code, { waitUntil: 'domcontentloaded' }); await q.waitForTimeout(1500);
  ok('الطالب يفتح الرابط بلا حساب', !!(await q.$('#nn')), q.url());
  await q.fill('#nn', 'أحمد سالم'); await q.click('#nf .st-go'); await q.waitForTimeout(500);
  const nl = await q.$$eval('[data-l]', x => x.length); ok('قائمة الدروس', nl > 3, nl);
  await q.click('[data-l]'); await q.waitForTimeout(1500);
  ok('الملخص', /المصطلحات|st-sum/.test(await q.content()));
  await q.screenshot({ path: OUT + '/student_summary.png' });
  await q.click('[data-tab="quiz"]'); await q.waitForTimeout(400);
  for (let i = 0; i < 12; i++) {
    if (await q.$('.st-end')) break;
    if (await q.$('.st-ch [data-k]')) { await q.click('.st-ch [data-k="0"]'); await q.waitForTimeout(150); await q.click('#nx'); }
    else if (await q.$('#show')) { await q.click('#show'); await q.waitForTimeout(150); await q.click('[data-s="1"]'); }
    await q.waitForTimeout(200);
  }
  const pc = await q.evaluate(() => (document.querySelector('.st-end h2') || {}).textContent);
  ok('التدريب ينتهي بنتيجة', /%$/.test(pc || ''), pc);
  await q.screenshot({ path: OUT + '/student_end.png' });
  if (await q.$('[data-tab="cards"]')) { await q.click('[data-tab="cards"]'); await q.waitForTimeout(300); await q.click('#fl'); ok('بطاقات المصطلحات', !!(await q.$('.st-flip.on'))); }
  // المعلم يرى النتيجة
  await p.goto(B + '/space', { waitUntil: 'domcontentloaded' }); await settle();
  await p.click('[data-st]'); await p.waitForTimeout(1500);
  const t = await p.textContent('#spMain'); ok('النتيجة تظهر للمعلم', /أحمد سالم/.test(t) && /طالبًا تدرّبوا/.test(t));
  // رمز خاطئ
  await q.goto(B + '/s/ZZZZZZ', { waitUntil: 'domcontentloaded' }); await q.waitForTimeout(1200);
  ok('رمز خاطئ برسالة واضحة', /غير صحيح/.test(await q.textContent('#st')));
  ok('بلا أخطاء صفحة', !errs.length, errs.join(' | '));
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  s.stop(); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
