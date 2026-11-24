// نموذج الإجابة: كل مفردة تصل إلى مولّد الاختبار القصير/الخطط العلاجية يجب أن يكون لها إجابة
// (حادثة 24 نوفمبر 2026: مفردات وزارية بلا نموذج إجابة — العلوم 7 كلها والرياضيات والعربية — كانت
//  تدخل الاختبار فتخرج خانات فارغة في نموذج الإجابة).
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS || 'Bio@2026x');
let pass = 0, fail = 0; const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8853) }); const B = s.BASE;
  const b = await PW.chromium.launch({ headless: true, executablePath: PW.findChrome && PW.findChrome() || process.env.CHROME_PATH || undefined });
  const c = await b.newContext({ locale: 'ar-OM' }); await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shut = () => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } });
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); await shut();
  if (await p.$('#setupForm')) { await p.fill('#name', 'أ. محمد'); await p.fill('#username', USER); await p.fill('#password', PASS); await p.fill('#password2', PASS); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500); await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); }
  await shut(); if (await p.$('#loginForm')) { await p.fill('#username', USER); await p.fill('#password', PASS); await p.click('#loginBtn'); await p.waitForTimeout(2500); }

  const r = await p.evaluate(async () => {
    const cs = (await fetch('/api/courses').then(r => r.json())).courses || [];
    const out = [];
    for (const c of cs) {
      const j = await fetch('/api/quiz/bank?key=' + encodeURIComponent(c.key)).then(r => r.json());
      const its = j.items || [];
      const has = q => (q.type === 'mcq' ? ((q.choices || [])[q.correct] != null || String(q.answer || '').trim() || (q.aimg || []).length)
                                          : (String(q.answer || '').trim() || (q.aimg || []).length));
      const bad = its.filter(q => !has(q));
      out.push({ key: c.key, n: its.length, fin: its.filter(q => String(q.qid).startsWith('f')).length, bad: bad.length, flagged: bad.every(q => q.noans), ex: bad.slice(0, 3).map(q => q.qid + ':' + String(q.stem || '').slice(0, 40)) });
    }
    return out;
  });
  const KEEP = [];  // استثناء الرياضيات أُلغي بعد استخراج إجاباتها من نماذج الوزارة
  const finBad = r.filter(x => !KEEP.includes(x.key) && x.ex.some(e => e.startsWith('f')));
  ok('لا مفردة وزارية بلا إجابة خارج المقررات المستثناة', finBad.length === 0, finBad.map(x => x.key + ' ' + x.ex.join(' | ')).join(' ; ') || r.length + ' مقرر');
  const fin = r.find(x => x.key === 'العلوم|السابع') || {};
  ok('العلوم 7: مفردات الوزارة عادت إلى البنك بنماذج إجاباتها', fin.fin >= 40, (fin.fin || 0) + ' مفردة وزارية');
  const m9 = r.find(x => x.key === 'الرياضيات|التاسع') || {};
  ok('الرياضيات 9: مفردات الوزارة في البنك بإجاباتها', m9.fin >= 40 && !m9.bad, (m9.fin || 0) + ' مفردة');
  const sci7 = r.find(x => x.key === 'العلوم|السابع') || {};
  ok('العلوم 7: البنك يكفي للاختبار بعد استبعاد المفردات بلا إجابة', sci7.n > 30, sci7.n + ' سؤال (وزارية ' + sci7.fin + ')');
  for (const x of r.filter(x => x.bad)) console.log('  INFO  أسئلة بنك نصية بلا إجابة: ' + x.key + ' = ' + x.bad + '  ' + x.ex.join(' | '));

  // صفحة الاختبارات النهائية: المفردة بلا نموذج إجابة تقول ذلك صراحة بدل «الإجابة» فارغة
  await p.goto(B + '/finals', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
  ok('لا أخطاء JavaScript', errs.length === 0, errs.join(' | ') || 'نظيف');
  console.log(`\n=== ${pass} ناجح، ${fail} فاشل ===`);
  await b.close(); s.stop && s.stop(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
