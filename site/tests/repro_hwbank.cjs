// الواجب الإلكتروني: اختيار السؤالين من بنك أسئلة الدرس (نصية فقط) بنفس آلية الإرسال والتصحيح
// + بنوك الرياضيات (5–12) والإنجليزية (9–10) من الامتحانات الوزارية 2024/2025 و2025/2026
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS || 'Bio@2026x');
let pass = 0, fail = 0; const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8841) }); const B = s.BASE;
  const b = await PW.chromium.launch({ headless: true, executablePath: PW.findChrome && PW.findChrome() || process.env.CHROME_PATH || undefined });
  const c = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'ar-OM', permissions: ['clipboard-read', 'clipboard-write'] }); await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shut = () => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } });
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); await shut();
  if (await p.$('#setupForm')) { await p.fill('#name', 'أ. محمد'); await p.fill('#username', USER); await p.fill('#password', PASS); await p.fill('#password2', PASS); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500); await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); }
  await shut(); if (await p.$('#loginForm')) { await p.fill('#username', USER); await p.fill('#password', PASS); await p.click('#loginBtn'); await p.waitForTimeout(2500); }
  await p.goto(B + '/app#prep', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500); await shut();
  const LS = await p.evaluate(() => fetch('/api/lessons').then(r => r.json()).then(j => (j.lessons || j).map(l => ({ id: l.id, subject: l.subject, grade: l.grade, title: l.title, hw_type: l.hw_type, hw_q1: l.hw_q1 }))));
  const open = async (id) => {
    const l = LS.find(x => x.id === id);
    await p.fill('#lesSearch', ''); await p.fill('#lesSearch', l.title); await p.waitForTimeout(250);
    await p.click('[data-sid="' + id + '"]'); await p.waitForTimeout(500); await shut();
    await p.click('[data-ltab="hw"]'); await p.waitForTimeout(700);
  };
  const hwJson = async () => { await p.click('#copyHwBtn'); await p.waitForTimeout(250); return JSON.parse(await p.evaluate(() => navigator.clipboard.readText())); };

  // 1) البنوك الجديدة: لكل مقرر أسئلة نصية في البنك
  const counts = await p.evaluate(async (all) => {
    const want = { 'الرياضيات|الخامس': 0, 'الرياضيات|السادس': 0, 'الرياضيات|السابع': 0, 'الرياضيات|الثامن': 0, 'الرياضيات|التاسع': 0, 'الرياضيات|العاشر': 0,
      'الرياضيات الأساسية|الحادي عشر': 0, 'الرياضيات المتقدمة|الحادي عشر': 0, 'الرياضيات الأساسية|الثاني عشر': 0, 'الرياضيات المتقدمة|الثاني عشر': 0,
      'اللغة الإنجليزية|التاسع': 0, 'اللغة الإنجليزية|العاشر': 0 };
    for (const k of Object.keys(want)) {
      const ids = all.filter(l => (l.subject + '|' + l.grade) === k).map(l => l.id);
      for (const id of ids) { const j = await fetch('/api/hw/bank?id=' + id).then(r => r.json()); want[k] += (j.items || []).length; }
    }
    return want;
  }, LS);
  for (const [k, v] of Object.entries(counts)) ok('بنك نصي: ' + k, v > 0, v);

  // 2) البنك لا يُرجع أسئلة بصور/أشكال/جداول، وكل اختيار من متعدد له إجابة صحيحة ضمن الاختيارات
  const clean = await p.evaluate(async () => {
    const j = await fetch('/api/hw/bank?id=1800').then(r => r.json());
    return (j.items || []).every(q => !q.img && !q.fig && (q.type !== 'mcq' || (q.choices || [])[q.correct] != null));
  });
  ok('أسئلة البنك نصية وكل اختيار من متعدد له إجابة صحيحة', clean);

  // 3) واجهة الدرس: زر «اختيار من بنك الأسئلة» → السطر الأول هو الإجابة الصحيحة → نفس JSON الإرسال
  const pick = async (id, n, idx, reopen = true) => {
    if (reopen) await open(id);
    const vis = await p.evaluate(n => { const b = document.querySelector('[data-hwbank="' + n + '"]'); return !!b && !b.hidden; }, n);
    if (!vis) return { vis };
    await p.click('[data-hwbank="' + n + '"]'); await p.waitForTimeout(300);
    const list = await p.$$eval('#modalBox [data-hwb]', x => x.length);
    await p.click('#modalBox [data-hwb="' + idx + '"]'); await p.waitForTimeout(300);
    const st = await p.evaluate(n => ({ q: document.getElementById('f_hw_q' + n).value, a: document.getElementById('f_hw_a' + n).value, modalClosed: document.getElementById('modal').hidden,
      mcq: /اختيار من متعدد/.test((document.querySelector('.copybar-text strong') || {}).textContent || ''), tag: (document.getElementById('f_hw_q' + n).closest('.sec').querySelector('.sugg') || {}).textContent }), n);
    const j = await hwJson();
    return { vis: true, list, ...st, item: j.items.find(x => x.text === st.q) };
  };
  const bank1800 = await p.evaluate(() => fetch('/api/hw/bank?id=1800').then(r => r.json()).then(j => j.items.filter(q => q.type === 'mcq')));
  const r1 = await pick(1800, 1, 0);
  const exp = bank1800[0];
  ok('رياضيات 9: الزر ظاهر والقائمة تعرض أسئلة الاختيار من متعدد فقط', r1.vis && r1.list === bank1800.length, JSON.stringify({ list: r1.list, mcq: bank1800.length }));
  ok('رياضيات 9: نص السؤال انتقل إلى خانة السؤال 1', r1.q === exp.stem, r1.q);
  ok('رياضيات 9: السطر الأول = الإجابة الصحيحة، وبقية الاختيارات بعده', r1.a.split('\n')[0] === exp.choices[exp.correct] && r1.a.split('\n').length === exp.choices.length, JSON.stringify(r1.a));
  ok('رياضيات 9: الواجب اختيار من متعدد وJSON الإرسال يحدد الإجابة الصحيحة', r1.mcq && r1.item.type === 'mcq' && r1.item.choices[r1.item.correct - 1] === exp.choices[exp.correct], JSON.stringify(r1.item));
  ok('رياضيات 9: النافذة أُغلقت والوسم صار «من بنك الأسئلة»', r1.modalClosed && r1.tag === 'من بنك الأسئلة', r1.tag);

  const r2 = await pick(1800, 2, 1, false);
  const j2 = await hwJson();
  ok('رياضيات 9: سؤالان مختلفان من البنك في الواجب', j2.items.length === 2 && j2.items[0].text !== j2.items[1].text, JSON.stringify(j2.items.map(x => x.text)));

  // الإنجليزية 9 (واجب اختيار من متعدد في التحضير الأصلي)
  const en = await pick(206, 1, 0);
  ok('إنجليزي 9: الاختيار من البنك يعمل والسطر الأول صحيح', en.vis && en.item && en.item.type === 'mcq' && en.item.choices[en.item.correct - 1] === en.a.split('\n')[0], JSON.stringify(en.item));

  // درس واجبه مقالي: السؤال المختار يُنقل بنصه وإجابته النموذجية
  const essayId = await p.evaluate(async (LS) => { for (const l of LS) { if (l.hw_type !== 'mcq' && String(l.hw_q1 || '').trim() && l.id < 120) { const j = await fetch('/api/hw/bank?id=' + l.id).then(r => r.json()); if ((j.items || []).length) return l.id; } } return 0; }, LS);
  if (essayId) {
    const es = await pick(essayId, 1, 0);
    ok('واجب مقالي (' + essayId + '): ينتقل السؤال وإجابته النموذجية', es.vis && !es.mcq && es.q.length > 3 && es.a.length > 0 && es.item && !es.item.choices, JSON.stringify({ q: es.q.slice(0, 60), a: es.a.slice(0, 60) }));
  } else ok('يوجد درس مقالي له بنك', false);

  ok('لا أخطاء JavaScript', !errs.length, errs.join(' | '));
  await open(1800); await p.screenshot({ path: __dirname + '/shot_hwbank.png' });
  await open(1800);
  await p.click('[data-hwbank="1"]'); await p.waitForTimeout(400);
  await p.screenshot({ path: __dirname + '/shot_hwbank_modal.png' });
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); await b.close(); s.stop && s.stop(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
