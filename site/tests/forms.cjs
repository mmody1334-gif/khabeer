// النماذج الإدارية: كل نموذج يُفتح ويُعاين ويُطبع بلا أخطاء، والحفظ في الحساب، والشهادات لعدة أسماء
const PW = require('./_pw.cjs');
const OUT = process.env.OUT || __dirname;
let pass = 0, fail = 0;
const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8805) }); const B = s.BASE;
  const b = await PW.chromium.launch({ headless: true });
  const c = await b.newContext({ viewport: { width: 1300, height: 950 }, locale: 'ar-OM' });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await c.addInitScript(() => { window.print = () => { window.__p = document.getElementById('printArea').innerHTML; }; });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shut = () => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } });
  const settle = async () => { await p.waitForTimeout(2000); for (let i = 0; i < 3; i++) { await shut(); await p.waitForTimeout(250); } };
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); await shut();
  if (await p.$('#setupForm')) { await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500); await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); }
  await shut(); if (await p.$('#loginForm')) { await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForTimeout(2500); }
  await p.goto(B + '/forms', { waitUntil: 'domcontentloaded' }); await settle();
  const ids = await p.$$eval('[data-t]', x => x.map(e => e.getAttribute('data-t')));
  ok('7 نماذج', ids.length === 7, ids.join(','));
  for (const id of ids) {
    await p.goto(B + '/forms', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
    await p.click('[data-t="' + id + '"]'); await p.waitForTimeout(500);
    if (id === 'cert') await p.fill('[data-k="names"]', 'أحمد سالم\nخالد علي\nسالم ناصر');
    if (id === 'meeting') { await p.fill('[data-k="present"]', 'أ. أحمد\nأ. خالد'); await p.fill('[data-k="agenda"]', 'مناقشة نتائج الاختبار القصير'); await p.fill('[data-tk="decisions"][data-r="0"][data-c="0"]', 'نتائج الاختبار'); }
    if (id === 'tracker') await p.fill('[data-k="students"]', 'أحمد\nخالد\nسالم');
    if (id === 'parent') await p.fill('[data-k="students"]', 'أحمد سالم\nخالد علي');
    await p.waitForTimeout(400);
    const prev = await p.evaluate(() => document.getElementById('fmPrev').innerText.length);
    await p.click('#fmPrint'); await p.waitForFunction(() => window.__p, null, { timeout: 8000 }); await p.waitForTimeout(1300);
    await p.evaluate(() => { const a = document.getElementById('printArea'); a.innerHTML = window.__p; document.body.classList.add('printing'); });
    await p.waitForTimeout(900); await p.emulateMedia({ media: 'print' }); await p.pdf({ path: OUT + '/form_' + id + '.pdf', printBackground: true, preferCSSPageSize: true });
    await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => { document.body.classList.remove('printing'); document.getElementById('printArea').innerHTML = ''; window.__p = ''; });
    await p.click('#fmSave'); await p.waitForTimeout(700);
    ok('نموذج ' + id + ': معاينة وطباعة وحفظ', prev > 50 && /محفوظ/.test(await p.textContent('#fmStatus')), prev);
  }
  await p.goto(B + '/forms', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  ok('النماذج المحفوظة في الحساب', (await p.$$eval('[data-open]', x => x.length)) === 7);
  ok('بلا أخطاء صفحة', !errs.length, errs.join(' | '));
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  s.stop(); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
