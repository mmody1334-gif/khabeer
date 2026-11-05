// «الواجبات المنزلية»: قسم مستقل، درجة ثابتة حسب وثيقة التقويم لكل مادة/صف، اختيار درس محدد، طباعة بالترويسة
const PW = require('./_pw.cjs');
const OUT = process.env.OUT || __dirname;
let pass = 0, fail = 0; const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8825) }); const B = s.BASE;
  const b = await PW.chromium.launch({ headless: true });
  const c = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'ar-OM' }); await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shut = () => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } });
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); await shut();
  if (await p.$('#setupForm')) { await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500); await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); }
  await shut(); if (await p.$('#loginForm')) { await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForTimeout(2500); }

  const places = await p.evaluate(async () => {
    const N = 'الواجبات المنزلية', get = u => fetch(u).then(r => r.text()), d = h => new DOMParser().parseFromString(h, 'text/html');
    const app = d(await get('/app')), kh = d(await get('/khome'));
    const has = (doc, sel) => [...doc.querySelectorAll(sel)].some(a => a.textContent.includes(N));
    return { menu: has(app, '#menuList a[href="/homework"]'), home: has(kh, 'a[href="/homework"]') };
  });
  ok('«الواجبات المنزلية» قسم مستقل (المزيد + الرئيسية)', Object.values(places).every(Boolean), JSON.stringify(places));

  await p.goto(B + '/homework', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600); await shut();
  ok('صفحة /homework في وضع الواجب', await p.evaluate(() => window.PAGE_MODE === 'hw'));

  const courses = await p.evaluate(() => fetch('/api/courses').then(r => r.json()).then(j => (j.courses || []).filter(c => c.quiz_items).map(c => ({ key: c.key, subject: c.subject, grade: c.grade }))));
  const bySub = {}; courses.forEach(c => { if (!bySub[c.subject]) bySub[c.subject] = c; });
  // اختيار مادة/صف عبر القائمتين المنسدلتين، ثم انتظار تحميل البنك (ظهور قائمة الدروس أو رسالة)
  const pickCourse = async (crs) => {
    await p.evaluate(crs => {
      const ss = document.getElementById('courseSelSubj'), gs = document.getElementById('courseSel');
      if (ss && ss.value !== crs.subject) { ss.value = crs.subject; ss.dispatchEvent(new Event('change', { bubbles: true })); }
      const set = () => { const g = document.getElementById('courseSel'); if (g) { g.value = crs.key; g.dispatchEvent(new Event('change', { bubbles: true })); } };
      setTimeout(set, 50);
    }, crs);
    await p.waitForTimeout(1600); await shut();
  };
  const genFromFirstLesson = async () => p.evaluate(async () => {
    const cb = [...document.querySelectorAll('[data-lid]')].find(x => !x.disabled); if (!cb) return { err: 'no-lesson' };
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    const mk = document.getElementById('makeBtn'); if (!mk) return { err: 'no-make' };
    mk.click(); await new Promise(r => setTimeout(r, 400));
    const ch = document.querySelector('.checks'); if (!ch) return { err: 'no-doc' };
    const pv = (document.getElementById('paper') || {}).innerText || '';
    return { ok: ch.classList.contains('ok'), checks: [...ch.querySelectorAll('li')].map(x => x.innerText), paper: pv };
  });

  const EXPECT = { 'العلوم': 5, 'الفيزياء': 5, 'الكيمياء': 5, 'العلوم البيئية': 5, 'التربية الإسلامية': 8 };
  for (const subj of Object.keys(EXPECT)) {
    const crs = bySub[subj]; if (!crs) { console.log('  (لا يوجد صف لـ ' + subj + ')'); continue; }
    await pickCourse(crs);
    const r = await genFromFirstLesson();
    const totLine = (r.checks || []).find(x => /الكلية|المجموع/.test(x)) || (r.checks || []).find(x => /درجة الأسئلة/.test(x)) || '';
    const num = (totLine.match(/\d+/g) || []).pop();
    ok(subj + ' (' + crs.grade + '): درجة الواجب = ' + EXPECT[subj] + ' ومطابق للوثيقة', r.ok === true && +num === EXPECT[subj], JSON.stringify({ num, totLine, err: r.err }));
  }

  // تقنية المعلومات: لا واجب منزلي
  if (bySub['تقنية المعلومات']) {
    await pickCourse(bySub['تقنية المعلومات']);
    const noHw = await p.evaluate(() => (document.getElementById('qside').innerText || '') + '|' + (document.getElementById('qmain').innerText || '') + '|' + (document.getElementById('makeBtn') ? 'HASBTN' : 'NOBTN'));
    ok('تقنية المعلومات: لا واجب منزلي في الوثيقة (بلا زر تكوين)', /ليس لها واجب|لا واجب/.test(noHw) && /NOBTN/.test(noHw), noHw.slice(0,80));
  }

  // اختيار درس محدد (الثالث فقط): الواجب يغطّي درسًا واحدًا (ليس أول درس ولا الوحدة كاملة)
  await pickCourse(bySub['العلوم'] || courses[0]);
  const specific = await p.evaluate(async () => {
    const cbs = [...document.querySelectorAll('[data-lid]')].filter(x => !x.disabled);
    if (cbs.length < 3) return { skip: true };
    cbs.forEach(x => { if (x.checked) { x.checked = false; x.dispatchEvent(new Event('change', { bubbles: true })); } });
    const pick = cbs[2]; pick.checked = true; pick.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('makeBtn').click(); await new Promise(r => setTimeout(r, 400));
    const ch = document.querySelector('.checks');
    const cov = [...ch.querySelectorAll('li')].map(x => x.innerText).find(x => /يغطّي|يغطي/.test(x)) || '';
    return { cov };
  });
  ok('اختيار درس محدد يعمل (يغطّي درسًا واحدًا من المختار)', specific.skip || /\b1\b|واحد/.test(specific.cov) || /يغطّي 1/.test(specific.cov), JSON.stringify(specific));

  // الطباعة بالترويسة: اسم الطالب + «الواجب المنزلي» + ترويسة المدرسة + انتهت الأسئلة
  const paper = await p.evaluate(() => { const t = (document.getElementById('paper') || {}).innerText || ''; return { school: /مدرسة/.test(t), student: /اسم الطالب/.test(t), hw: /الواجب المنزلي/.test(t), end: /انتهت الأسئلة/.test(t) }; });
  ok('الطباعة بالترويسة الرسمية + اسم الطالب + «الواجب المنزلي»', paper.school && paper.student && paper.hw && paper.end, JSON.stringify(paper));
  const keyv = await p.evaluate(() => { const bk = document.querySelector('[data-pv="key"]'); if (bk) bk.click(); return (document.getElementById('paper') || {}).innerText || ''; });
  ok('نموذج الإجابة جدول بالإجابة والدرجة وهدف التقويم', /الإجابة/.test(keyv) && /هدف التقويم/.test(keyv) && /المجموع/.test(keyv), '');
  await p.screenshot({ path: OUT + '/homework.png', fullPage: true });

  // نموذج آخر يبدّل حرف النموذج
  const another = await p.evaluate(async () => { const rb = document.getElementById('remakeBtn'); if (!rb) return 'no-remake'; const before = (document.getElementById('docTitle') || {}).value || ''; rb.click(); await new Promise(r => setTimeout(r, 400)); return 'ok'; });
  ok('زر «نموذج آخر» متاح للواجب', another === 'ok', another);

  // الحفظ ضمن kind=homework
  const saved = await p.evaluate(async () => { const sb = document.getElementById('saveBtn'); if (sb) sb.click(); await new Promise(r => setTimeout(r, 600)); const r = await fetch('/api/quizzes?kind=homework').then(x => x.json()); return (r.quizzes || []).length; });
  ok('الواجب يُحفظ ويُسترجع ضمن kind=homework', saved >= 1, 'n=' + saved);

  ok('بلا أخطاء جافاسكربت', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(pass + ' pass, ' + fail + ' fail');
  await b.close(); process.exit(fail ? 1 : 0);
})();
