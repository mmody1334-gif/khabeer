// «تحليل نتائج الاختبارات»: من اختبار محفوظ ← إدخال الدرجات (لصق من Excel) ← الإحصاء ← التقرير ← ورقة علاجية وخطة علاجية
const PW = require('./_pw.cjs');
const OUT = process.env.OUT || __dirname;
let pass = 0, fail = 0;
const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8802) }); const B = s.BASE;
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

  // 1) كوّن اختبارًا (الأحياء التاسع) واحفظه
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' }); await settle();
  const picked = await p.evaluate(() => {
    const sel = document.getElementById('courseSel'); if (!sel) return 'nosel';
    const subj = document.getElementById('courseSelSubj');
    if (subj) { const o = [...subj.options].find(o => /أحياء/.test(o.textContent)); if (o) { subj.value = o.value; subj.dispatchEvent(new Event('change')); } }
    const g = [...sel.options].find(o => /التاسع/.test(o.textContent)); if (g) { sel.value = g.value; sel.dispatchEvent(new Event('change')); }
    return sel.value;
  });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { const cbs = [...document.querySelectorAll('input[type=checkbox][data-lid], input[type=checkbox][data-l]')].slice(0, 3); cbs.forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event('change')); }); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.getElementById('makeBtn') || [...document.querySelectorAll('button')].find(x => /كوّن الاختبار/.test(x.textContent)); b && b.click(); });
  await p.waitForTimeout(1200);
  const hasAnal = await p.$('#analBtn');
  ok('زر «تحليل النتائج» في صفحة الاختبار', !!hasAnal, picked);
  await p.click('#analBtn'); await p.waitForURL(/\/analysis/, { timeout: 15000 }); await settle();
  const nItems = await p.evaluate(() => document.querySelectorAll('[data-imax]').length);
  ok('التحليل يفتح بمفردات الاختبار', nItems >= 5, nItems);
  const maxes = await p.evaluate(() => [...document.querySelectorAll('[data-imax]')].map(e => +e.value));
  // 2) لصق 8 طلاب من Excel (اسم + درجات)
  const names = ['أحمد سالم', 'خالد علي', 'سالم ناصر', 'محمد سعيد', 'يوسف حمد', 'علي راشد', 'ناصر خميس', 'حمد سيف'];
  const rows = names.map((n, k) => [n].concat(maxes.map((m, i) => Math.max(0, Math.min(m, Math.round(m * ((k * 7 + i * 3) % 10) / 9))))).join('\t')).join('\n');
  await p.evaluate(t => { const el = document.querySelector('[data-r="0"][data-c="-1"]'); const dt = new DataTransfer(); dt.setData('text', t); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, rows);
  await p.waitForTimeout(400); await p.click('#mOk');
  await p.waitForTimeout(800);
  const N = await p.evaluate(() => document.querySelector('.an-cards div:nth-child(2) b') && document.querySelector('.an-cards div:nth-child(2) b').textContent);
  ok('اللصق من Excel ملأ 8 طلاب', N === '8', N);
  const stat = await p.evaluate(() => [...document.querySelectorAll('.an-stat tbody tr')].map(tr => tr.textContent).slice(0, 2));
  ok('جدول تحليل المفردات', stat.length === 2, stat[0]);
  await p.screenshot({ path: OUT + '/analysis_screen.png', fullPage: true });
  // الحفظ في الحساب
  await p.waitForTimeout(3200);
  const st = await p.textContent('#anStatus'); ok('يُحفظ تلقائيًا في الحساب', /محفوظ/.test(st), st);
  // 3) التقرير
  await p.click('#anPrint'); await p.waitForFunction(() => window.__p, null, { timeout: 8000 }); await p.waitForTimeout(1300);
  await p.evaluate(() => { const a = document.getElementById('printArea'); a.innerHTML = window.__p; document.body.classList.add('printing'); });
  await p.waitForTimeout(1200); await p.emulateMedia({ media: 'print' }); await p.pdf({ path: OUT + '/analysis_report.pdf', format: 'A4', printBackground: true });
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => { document.body.classList.remove('printing'); document.getElementById('printArea').innerHTML = ''; });
  ok('التقرير فيه الترويسة الرسمية', /class="ohead"/.test(await p.evaluate(() => window.__p)));
  // 4) ورقة علاجية
  const wsBtn = await p.$('#anWs');
  ok('زر ورقة العمل العلاجية', !!wsBtn);
  if (wsBtn) {
    await wsBtn.click(); await p.waitForURL(/\/quiz/, { timeout: 15000 }); await p.waitForTimeout(4000);
    const t = await p.evaluate(() => (document.querySelector('.ptitle') || {}).textContent || '');
    ok('ورقة عمل علاجية تُكوَّن تلقائيًا', /ورقة عمل علاجية/.test(t), t);
  }
  // 5) خطة علاجية
  await p.goto(B + '/analysis', { waitUntil: 'domcontentloaded' }); await settle();
  const listed = await p.$$eval('[data-open]', x => x.length); ok('التحليل محفوظ في «تحليلاتي»', listed >= 1, listed);
  await p.click('[data-open]'); await p.waitForTimeout(1500);
  const remBtn = await p.$('#anRem');
  if (remBtn) {
    await remBtn.click(); await p.waitForURL(/\/remedial/, { timeout: 15000 }); await p.waitForTimeout(4000);
    const body = await p.evaluate(() => document.getElementById('qmain').innerText.slice(0, 200));
    ok('خطة علاجية للدروس الأضعف', /علاج/.test(body) && !/اختر درسًا/.test(body), body.slice(0, 80));
  } else ok('زر الخطة العلاجية', false);
  // 6) اختبار من خارج المنصة
  await p.goto(B + '/analysis', { waitUntil: 'domcontentloaded' }); await settle();
  await p.click('#anManual'); await p.waitForTimeout(500);
  ok('تحليل يدوي بخمس مفردات افتراضية', (await p.$$eval('[data-imax]', x => x.length)) === 5);
  // لصق جدول فيه أسماء داخل خانة درجة (كما يفعل المعلم): الأسماء تذهب لعمود الاسم، والصف الأخير (المجاميع) يُتجاهل
  await p.evaluate(() => { const el = document.querySelector('[data-r="0"][data-c="0"]'); const dt = new DataTransfer(); dt.setData('text', 'أحمد سالم\t1\t0\t1\nخالد علي\t0\t1\t1\nسعود ناصر\t1\t1\t0\n\t2\t2\t2'); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await p.waitForTimeout(400); await p.click('#mOk'); await p.waitForTimeout(500);
  const g = await p.evaluate(() => [document.querySelector('[data-r="0"][data-c="-1"]').value, document.querySelector('[data-r="0"][data-c="0"]').value, document.querySelectorAll('#anSheet tbody tr').length, document.querySelectorAll('[data-imax]').length]);
  ok('لصق الأسماء في خانة درجة يُصحَّح تلقائيًا', g[0] === 'أحمد سالم' && g[1] === '1' && g[2] === 3 && g[3] === 3, JSON.stringify(g));
  // رفع ملف Excel حقيقي (RTL، صف عناوين، صف المستويات المدموج، صف الدرجة العظمى، عمود ترقيم، عمود مجموع، صف المعدل)
  await p.setInputFiles('#anFile', process.env.XLSX || (OUT + '/grades_test.xlsx')); await p.waitForTimeout(1200);
  const pv = await p.evaluate(() => document.getElementById('modalBox').innerText.slice(0, 160));
  await p.click('#mOk'); await p.waitForTimeout(600);
  const x = await p.evaluate(() => [document.querySelectorAll('#anSheet tbody tr').length, [...document.querySelectorAll('[data-imax]')].map(e => e.value).join(','), [...document.querySelectorAll('[data-iao]')].map(e => e.value).join(','), document.querySelector('[data-r="0"][data-c="-1"]').value]);
  ok('رفع Excel: 6 طلاب و5 مفردات بدرجاتها العظمى ومستوياتها', x[0] === 6 && x[1] === '1,2,1,3,2' && x[2] === 'AO1,AO1,AO1,AO2,AO2' && x[3] === 'حمد مصبح راشد', JSON.stringify(x) + ' | ' + pv.replace(/\n/g, ' '));
  // التنقل بالأسهم والنسخ لعدة خانات
  await p.click('[data-r="0"][data-c="0"]'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Shift+ArrowLeft');
  ok('تحديد عدة خانات بالأسهم', (await p.$$eval('#anSheet td.sel', x => x.length)) === 2);
  ok('بلا أخطاء صفحة', !errs.length, errs.join(' | '));
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  s.stop(); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
