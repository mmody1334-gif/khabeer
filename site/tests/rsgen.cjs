// مولّد البحوث الإجرائية: النموذج ← بحث كامل بالإحصاء ← محفوظ في الحساب ← تعديل ← طباعة
const PW = require('./_pw.cjs');
const OUT = process.env.OUT || __dirname;
let pass = 0, fail = 0;
const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8804) }); const B = s.BASE;
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
  await p.goto(B + '/research', { waitUntil: 'domcontentloaded' }); await settle();
  ok('البحث الجاهز ما زال موجودًا', (await p.$$eval('.rs-card', x => x.length)) >= 1);
  await p.click('#rsNew'); await p.waitForTimeout(400);
  await p.selectOption('#f_subject', 'الرياضيات');
  await p.fill('#f_material', 'الرياضيات'); await p.fill('#f_grade', 'السابع'); await p.fill('#f_target', 'طلاب الصف السابع / 1');
  await p.selectOption('#f_strat', 'games'); await p.fill('#f_dv', 'مهارات حل المسائل الرياضية');
  await p.fill('#f_max', '20'); await p.fill('#f_scores', '10\t15\n12\t16\n9\t14\n11\t13\n8\t15\n14\t18\n7\t12\n10\t11');
  await p.waitForTimeout(300);
  const st = await p.textContent('#f_stats'); ok('الإحصاء الحي (t ودلالته)', /t = 6\.19/.test(st) && /دال/.test(st), st);
  ok('عنوان تلقائي', /الألعاب التعليمية/.test(await p.textContent('#f_titleHint')), await p.textContent('#f_titleHint'));
  await p.click('#rsGen'); await p.waitForTimeout(2000);
  const doc = await p.evaluate(() => document.querySelector('.rs-doc').innerText);
  ok('البحث كُتب بفصوله', ['المقدمة والإحساس بالمشكلة', 'فرضيات البحث', 'الإطار النظري', 'النتائج ومناقشتها', 'الخاتمة', 'المراجع'].every(h => doc.includes(h)));
  ok('قيمة t ومربع إيتا في النتائج', /6\.19/.test(doc) && /0\.85/.test(doc) && /كبير/.test(doc));
  ok('مرجع حقيقي للاستراتيجية', /Gee, J\. P\. \(2003\)/.test(doc));
  await p.click('#rsPrint'); await p.waitForFunction(() => window.__p, null, { timeout: 8000 }); await p.waitForTimeout(1300);
  await p.evaluate(() => { const a = document.getElementById('printArea'); a.innerHTML = window.__p; document.body.classList.add('printing'); });
  await p.waitForTimeout(1000); await p.emulateMedia({ media: 'print' }); await p.pdf({ path: OUT + '/research_gen.pdf', format: 'A4', printBackground: true });
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => { document.body.classList.remove('printing'); document.getElementById('printArea').innerHTML = ''; });
  ok('الطباعة بالترويسة', /class="ohead"/.test(await p.evaluate(() => window.__p)));
  // التعديل ثم إعادة الفتح من الحساب
  await p.click('#rsEdit'); await p.waitForTimeout(300); await p.fill('#f_title', 'عنوان مخصص للتجربة'); await p.click('#rsGen'); await p.waitForTimeout(1800);
  await p.goto(B + '/research', { waitUntil: 'domcontentloaded' }); await settle();
  await p.click('[data-s="الرياضيات"]'); await p.waitForTimeout(300);
  const cards = await p.$$eval('.rs-card.mine h3', x => x.map(e => e.textContent));
  ok('محفوظ في الحساب وتعديل واحد (بلا تكرار)', cards.length === 1 && /عنوان مخصص/.test(cards[0]), cards.join(' | '));
  ok('بلا أخطاء صفحة', !errs.length, errs.join(' | '));
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  s.stop(); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
