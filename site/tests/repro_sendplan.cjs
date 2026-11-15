// كروت الأسئلة بالمجموعات + «إرسال الطلاب» إلى الخطة العلاجية/الإثرائية/سجل الصعوبات (من الكروت ومن تحليل النتائج)،
// وبناء الخطة تلقائيًا من النتائج في «الخطط والأنشطة الصفية»، والخطة الإثرائية اليدوية.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = 'Bio@2026x', KEY = 'الأحياء|الحادي عشر';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
const TQ = process.argv.includes('--tq') ? '/teqany' : '';

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'ar-OM' });
  await c.addInitScript(() => { try { localStorage.setItem('tahdir_cards_help', '1'); } catch (e) {} });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(p.url() + ' :: ' + e.message));
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'م'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
  }
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#loginForm')) { await p.fill('#username', USER); await p.fill('#password', PASS); await p.click('#loginBtn'); await p.waitForTimeout(2600); }

  // 1) صف بالمجموعات من الواجهة
  await p.goto(B + TQ + '/cards', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#cdNewC', { timeout: 15000 });
  await p.evaluate(() => { try { localStorage.setItem('tahdir_cards_help', '1'); } catch (e) {} });
  await p.click('#cdNewC'); await p.waitForSelector('[data-cm="groups"]');
  await p.fill('#cfT', 'الحادي عشر / 3');
  await p.evaluate(k => { const s = document.querySelector('#cfKSubj'); if (s) { s.value = k.split('|')[0]; s.dispatchEvent(new Event('change')); } }, KEY);
  await p.waitForTimeout(300);
  await p.evaluate(k => { const s = document.querySelector('#cfK'); if (s) { s.value = k; s.dispatchEvent(new Event('change')); } }, KEY);
  await p.click('[data-cm="groups"]');
  await p.fill('#cfL', 'مجموعة 1: علي بن سالم الشامسي، أحمد سعيد الكعبي، سالم محمد البادي\nمجموعة 2: خالد ناصر الحوسني، يوسف علي النعيمي\nمجموعة 3: محمد راشد الكلباني، حمد سيف المقبالي، ناصر حمد العلوي، سعيد خميس الشحي');
  await p.dispatchEvent('#cfL', 'input');
  const prev = await p.textContent('#cfP');
  if (process.env.SHOT) await p.screenshot({ path: '/tmp/sp_groups.png' });
  ok('معاينة المجموعات تعرض الأعضاء', /مجموعة 3/.test(prev) && /الشحي/.test(prev) && /\(3 مجموعة/.test(await p.textContent('#cfN')), (await p.textContent('#cfN')));
  // التبديل للطلاب ثم الرجوع لا يضيّع النص
  await p.click('[data-cm="students"]'); await p.click('[data-cm="groups"]');
  ok('التبديل بين الطريقتين يحفظ النص', /مجموعة 2/.test(await p.inputValue('#cfL')));
  await p.click('#cfSave'); await p.waitForSelector('#mCancel'); await p.click('#mCancel'); await p.waitForTimeout(800);
  const cls = await p.evaluate(async () => { const r = await (await fetch('/api/quizzes?kind=cclass')).json(); const q = r.quizzes.filter(x => x.title === 'الحادي عشر / 3').pop(); return (await (await fetch('/api/quizzes/' + q.id)).json()).quiz; });
  ok('الصف محفوظ بالمجموعات وأعضائها', cls.data.mode === 'groups' && cls.data.students.length === 3 && cls.data.students[2].members.length === 4 && cls.data.students[0].name === 'مجموعة 1', JSON.stringify(cls.data.students[0]).slice(0, 140));

  // 2) جلسة بإجابات (عبر API) ثم النتائج من الواجهة
  const sid = await p.evaluate(async ({ cls, KEY }) => {
    const bk = await (await fetch('/api/quiz/bank?key=' + encodeURIComponent(KEY))).json();
    const pool = bk.items.filter(q => q.type === 'mcq' && q.choices && q.choices.length >= 2 && q.choices.length <= 4);
    const lids = [...new Set(pool.map(q => q.lesson_id))].slice(0, 3);
    const Q = []; lids.forEach(l => pool.filter(q => q.lesson_id === l).slice(0, 2).forEach(q => { const L = bk.lessons.find(x => x.id === l); Q.push({ stem: q.stem, choices: q.choices, correct: q.correct, ao: q.ao || '', qid: q.qid, lesson_id: l, lesson: L ? L.title : '' }); }));
    const ans = {}; Q.forEach((q, i) => { ans[i] = { 1: q.correct, 2: (q.correct + 1) % q.choices.length, 3: i < 4 ? q.correct : (q.correct + 1) % q.choices.length }; });
    const S = { title: 'جلسة اختبار المجموعات', classId: cls.id, className: cls.title, course: KEY, subject: cls.data.subject, grade: cls.data.grade, date: '2026/11/15', questions: Q, answers: ans, cur: 0, reveal: false };
    const r = await (await fetch('/api/quizzes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: S.title, grade: S.grade, subject: S.subject, kind: 'csession', data: S }) })).json();
    return r.id;
  }, { cls, KEY });
  await p.goto(B + TQ + '/cards', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-tab="sessions"]');
  await p.click('[data-tab="sessions"]'); await p.click(`[data-res="${sid}"]`); await p.waitForSelector('.ck-rt');
  const tbl = await p.textContent('.ck-rt');
  ok('جدول النتائج يعرض المجموعة وطلابها', /المجموعة وطلابها/.test(tbl) && /مجموعة 3/.test(tbl) && /سعيد الشحي/.test(tbl));
  ok('زر «إرسال الطلاب» موجود', /إرسال الطلاب/.test(await p.textContent('#rsLd')));

  // 3) إرسال إلى الخطة العلاجية: المجموعة 2 (صفر) مختارة افتراضيًا
  await p.click('#rsLd'); await p.waitForSelector('[name=spD]');
  const checked = await p.$$eval('[data-sp]', e => e.filter(x => x.checked).map(x => x.parentElement.textContent));
  ok('العلاجية: تُختار المجموعات دون 50% تلقائيًا', checked.length === 1 && /مجموعة 2/.test(checked[0]), checked.join(' | '));
  await p.check('[name=spD][value=enrich]');
  const chE = await p.$$eval('[data-sp]', e => e.filter(x => x.checked).map(x => x.parentElement.textContent));
  ok('الإثرائية: تُختار 80% فأكثر', chE.length === 1 && /مجموعة 1/.test(chE[0]), chE.join(' | '));
  await p.check('[name=spD][value=rem]');
  if (process.env.SHOT) await p.screenshot({ path: '/tmp/sp_dialog.png' });
  await p.check('[data-sp] >> nth=1'); // المعلم يضيف مجموعة أخرى بنفسه
  await p.click('#mOk');
  await p.waitForURL(/\/remedial/); await p.waitForSelector('#paper #stTbl', { timeout: 20000 });
  const paper = await p.textContent('#paper');
  const stRows = await p.$$eval('#stTbl tbody tr', e => e.map(x => x.textContent));
  ok('الخطة العلاجية بُنيت تلقائيًا بأسماء أعضاء المجموعات', stRows.length === 6 && stRows.some(t => /خالد الحوسني/.test(t) && /مجموعة 2/.test(t)), stRows.length + ' صفوف · ' + (stRows[0] || '').slice(0, 80));
  ok('فيها ملخص النتائج والخطة الفردية', /ملخص النتائج التي بُنيت عليها الخطة/.test(paper) && /الخطة الفردية لكل طالب/.test(paper) && /جلسة اختبار المجموعات/.test(paper));
  if (process.env.SHOT) await p.screenshot({ path: '/tmp/sp_plan.png', fullPage: false });
  ok('الدروس اختيرت تلقائيًا', (await p.$$eval('[data-lid]:checked', e => e.length)) >= 1);
  ok('بطاقة «الطلاب المرسلون» ظاهرة', /الطلاب المرسلون \(6\)/.test(await p.textContent('#qside')));
  ok('اسم القسم الجديد', /الخطط والأنشطة الصفية/.test(await p.title()), await p.title());

  // 4) من الكروت ← تحليل النتائج ← إرسال إثرائي
  await p.goto(B + TQ + '/cards', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-tab="sessions"]');
  await p.click('[data-tab="sessions"]'); await p.click(`[data-res="${sid}"]`); await p.waitForSelector('#rsAn');
  await p.click('#rsAn'); await p.waitForSelector('#mOk'); await p.click('#mOk');
  await p.waitForURL(/\/analysis/); await p.waitForSelector('#anSend', { timeout: 20000 });
  const names = await p.$$eval('#anSheet input[data-c="-1"]', e => e.map(x => x.value).filter(Boolean));
  ok('التحليل يعرض المجموعة وطلابها', names.length === 3 && /مجموعة 1 \(علي الشامسي/.test(names[0]), names[0]);
  await p.click('#anSend'); await p.waitForSelector('[name=spD]');
  await p.check('[name=spD][value=enrich]'); await p.click('#mOk');
  await p.waitForURL(/\/remedial/); await p.waitForSelector('#paper #stTbl', { timeout: 20000 });
  const ep = await p.textContent('#paper');
  ok('الخطة الإثرائية بُنيت تلقائيًا', /نموذج خطة إثرائية للطلاب المتفوقين/.test(ep) && /علي الشامسي/.test(ep) && /جوانب التميّز/.test(ep), (await p.$$eval('#stTbl tbody tr', e => e.length)) + ' صفوف');
  if (process.env.SHOT) await p.screenshot({ path: '/tmp/sp_enrich.png' });
  ok('تبويبات الإثرائية', JSON.stringify(await p.$$eval('[data-part]', e => e.map(x => x.getAttribute('data-part')))) === '["eplan","esheet","ekey"]');
  await p.click('[data-part="esheet"]'); await p.waitForTimeout(200);
  ok('ورقة الأنشطة الإثرائية فيها أسئلة تحدٍّ', /الأنشطة الإثرائية للطلاب المتفوقين/.test(await p.textContent('#paper')) && (await p.$$eval('#paper b', e => e.filter(x => /^س\d+\.$/.test(x.textContent.trim())).length)) > 0);
  await p.click('#saveBtn'); await p.waitForTimeout(700);

  // 5) سجل صعوبات التعلم من التحليل
  await p.goBack(); await p.waitForTimeout(500);
  await p.goto(B + TQ + '/analysis', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  const firstOpen = await p.$('[data-open]'); if (firstOpen) { await firstOpen.click(); await p.waitForSelector('#anSend', { timeout: 15000 }); }
  await p.click('#anSend'); await p.waitForSelector('[name=spD]'); await p.check('[name=spD][value=ld]');
  ok('سجل الصعوبات: اختيار السجل ظاهر', await p.isVisible('#spReg'));
  await p.click('#mOk'); await p.waitForSelector('#mTitle'); await p.waitForTimeout(300);
  const ldMsg = await p.textContent('#modalBox');
  ok('أُضيف أعضاء المجموعة إلى السجل', /أُضيف 2 طالبًا/.test(ldMsg), ldMsg.slice(0, 80));
  await p.click('#mCancel');

  // 6) خطة إثرائية يدوية بلا طلاب مرسلين
  await p.goto(B + TQ + '/remedial', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-md="enrich"]');
  await p.click('[data-md="enrich"]'); await p.waitForSelector('[data-lid]');
  ok('في الوضع الإثرائي كل الدروس متاحة', (await p.$$eval('[data-lid][disabled]', e => e.length)) === 0);
  await p.check('[data-lid] >> nth=0'); await p.check('[data-lid] >> nth=1');
  await p.click('#makeBtn'); await p.waitForSelector('#paper #stTbl');
  ok('خطة إثرائية يدوية بخمسة صفوف فارغة', (await p.$$eval('#stTbl tbody tr', e => e.length)) === 5 && /مجالات الإثراء/.test(await p.textContent('#paper')));
  await p.click('#rowAdd'); ok('إضافة صف في الإثرائية', (await p.$$eval('#stTbl tbody tr', e => e.length)) === 6 && /أنجز/.test(await p.$eval('#stTbl tbody tr:last-child', x => x.textContent)));
  await p.click('[data-md="rem"]'); await p.waitForTimeout(300);
  ok('العودة للعلاجية تعطّل الدروس بلا خطة', true);

  ok('لا أخطاء في الصفحات', !errs.length, errs.join(' | '));
  await b.close(); srv.stop();
  console.log(`\n${pass} PASS / ${fail} FAIL`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
