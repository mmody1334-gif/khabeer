// أوراق العمل المتمايزة (3 مستويات) + سجل الطلبة ذوي صعوبات التعلم (حفظ في الحساب، الخطة الفردية، الطباعة)
const PW = require('./_pw.cjs');
const OUT = process.env.OUT || __dirname;
let pass = 0, fail = 0;
const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8803) }); const B = s.BASE;
  const b = await PW.chromium.launch({ headless: true });
  const c = await b.newContext({ viewport: { width: 1300, height: 950 }, locale: 'ar-OM' });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await c.addInitScript(() => { window.print = () => { window.__p = document.getElementById('printArea').innerHTML; }; });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shut = () => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } });
  const settle = async () => { await p.waitForTimeout(2000); for (let i = 0; i < 3; i++) { await shut(); await p.waitForTimeout(250); } };
  const toPdf = async (name) => {
    await p.waitForFunction(() => window.__p, null, { timeout: 8000 }); await p.waitForTimeout(1300);
    await p.evaluate(() => { const a = document.getElementById('printArea'); a.innerHTML = window.__p; document.body.classList.add('printing'); });
    await p.waitForTimeout(1000); await p.emulateMedia({ media: 'print' }); await p.pdf({ path: OUT + '/' + name + '.pdf', format: 'A4', printBackground: true });
    await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => { document.body.classList.remove('printing'); document.getElementById('printArea').innerHTML = ''; window.__p = ''; });
  };
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); await shut();
  if (await p.$('#setupForm')) { await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500); await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); }
  await shut(); if (await p.$('#loginForm')) { await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForTimeout(2500); }

  // ---- الأوراق المتمايزة ----
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' }); await settle();
  await p.click('[data-mode="diff"]'); await p.waitForTimeout(400);
  await p.evaluate(() => { [...document.querySelectorAll('input[data-lid]:not([disabled])')].slice(0, 2).forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event('change')); }); });
  await p.click('#makeBtn'); await p.waitForTimeout(1000);
  const heads = await p.$$eval('#paper .ohead .ptitle', x => x.map(e => e.textContent));
  ok('ثلاث أوراق بثلاث ترويسات', heads.length === 3 && /الأساسي/.test(heads[0]) && /الإثرائي/.test(heads[2]), heads.join(' | '));
  const checks = await p.$$eval('.checks li', x => x.map(e => e.textContent));
  ok('ملخص كل مستوى', checks.length === 3, checks.join(' | '));
  await p.click('#printBtn'); await p.waitForTimeout(500);
  await p.evaluate(() => { const r = document.querySelector('#modalBox input[value="both"]') || document.querySelector('#modalBox [data-p="both"]'); if (r) { r.click(); } const ok = document.getElementById('mOk'); ok && ok.click(); });
  await toPdf('diff_sheets');
  ok('طباعة الأوراق المتمايزة', true);
  await p.click('#saveBtn'); await p.waitForTimeout(800);
  ok('تُحفظ في «اختباراتي»', (await p.$$eval('#savedList [data-open]', x => x.length)) >= 1);

  // ---- سجل صعوبات التعلم ----
  await p.goto(B + '/ld', { waitUntil: 'domcontentloaded' }); await settle();
  ok('السجل يبدأ فارغًا', /لا توجد سجلات/.test(await p.textContent('#ldMain')));
  await p.click('#ldNew'); await p.waitForTimeout(400);
  await p.fill('#ldSubj', 'العلوم'); await p.fill('#ldGrade', 'السادس'); await p.fill('#ldSec', '2');
  await p.fill('#ldName', 'سالم خالد');
  await p.check('[data-asp="القراءة"]'); await p.check('[data-asp="الانتباه والتركيز"]');
  await p.fill('[data-f="level"]', 'يقرأ الكلمات المفردة ويتعثر في الجمل الطويلة.');
  await p.click('#ldSuggest'); await p.waitForTimeout(300);
  const strat = await p.inputValue('[data-f="strat"]'); ok('اقتراح الاستراتيجيات من الجوانب', /القراءة/.test(strat) && /الانتباه/.test(strat));
  await p.click('#ldFw'); await p.waitForTimeout(200); await p.fill('[data-fw="0"][data-k="n"]', 'تحسن في قراءة الجمل القصيرة');
  await p.click('#ldAdd'); await p.waitForTimeout(200); await p.fill('#ldName', 'محمد ناصر'); await p.check('[data-asp="الحساب والعمليات"]');
  await p.waitForTimeout(2800);
  ok('يُحفظ في الحساب', /محفوظ/.test(await p.textContent('#ldStatus')));
  await p.click('#ldPrintAll'); await toPdf('ld_register');
  await p.click('[data-st="0"]'); await p.waitForTimeout(300); await p.click('#ldPrintOne'); await toPdf('ld_plan');
  // يُعاد فتحه من الحساب
  await p.goto(B + '/ld', { waitUntil: 'domcontentloaded' }); await settle();
  await p.click('[data-open]'); await p.waitForTimeout(800);
  ok('يُعاد فتحه بطالبين', (await p.$$eval('[data-st]', x => x.length)) === 2);
  ok('بلا أخطاء صفحة', !errs.length, errs.join(' | '));
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  s.stop(); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
