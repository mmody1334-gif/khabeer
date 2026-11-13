// اللغة الإنجليزية 11–12 (Engage with English 11A/12A، الفصل الأول): كل مزايا المنصة تعمل، والاختبار القصير يطابق
// Student Assessment Handbook – English Grades 11-12 (Sept. 2026)، ص 9 (Quizzes) وص 7 (الواجب تكويني):
//   الصف 11: 10 درجات = GRM/VCB (5: قواعد 3 + مفردات 2) + RDG (5) · 10 مفردات بدرجة واحدة.
//   الصف 12: 10 درجات = RDG (5) + مهمة كتابة WRT واحدة (5 بمقياس التقدير) · 6 مفردات.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'Bio@2026x');
const SUBJ = 'اللغة الإنجليزية';
const G = { 'الحادي عشر': { key: SUBJ + '|الحادي عشر', items: 10, mcq: 5, lv: { 'القواعد': 3, 'المفردات': 2, 'القراءة': 5, 'الكتابة': 0 }, papers: 6, total: 60 },
            'الثاني عشر': { key: SUBJ + '|الثاني عشر', items: 6, mcq: 3, lv: { 'القواعد': 0, 'المفردات': 0, 'القراءة': 5, 'الكتابة': 5 }, papers: 4, total: 70 } };
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM' });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'أ. محمد'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
  }
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn'); await p.waitForTimeout(2500);
  }
  const api = (u) => p.evaluate(async (u) => (await fetch(u, { credentials: 'same-origin' })).json(), u);
  const L = await api('/api/lessons');

  for (const [grade, S] of Object.entries(G)) {
    console.log('— ' + SUBJ + ' ' + grade);
    // 1) الدروس
    const ls = (L.lessons || L).filter(l => l.subject === SUBJ && l.grade === grade);
    ok('20 درسًا (4 محاور × 5 وحدات)', ls.length === 20 && new Set(ls.map(l => String(l.unit))).size === 4, ls.length + ' درسًا');
    ok('كل درس مكتمل التحضير والواجب', ls.every(l => l.outcomes && l.activities_teach && l.formative && l.strategies && l.hw_q1 && l.hw_a1 && l.hw_q2 && l.hw_a2), '');
    // 2) البنك
    const bank = await api('/api/quiz/bank?key=' + encodeURIComponent(S.key));
    const it = bank.items || [];
    ok('البنك بعناصر اللغة (GRM/VCB/RDG/WRT) لا مستويات التعلم', it.length > 150 && it.every(x => ['GRM', 'VCB', 'RDG', 'WRT'].includes(x.ao)), it.length + ' مفردة: ' + [...new Set(it.map(x => x.ao))].join('، '));
    ok('كل درس فيه اختيار من متعدد في عنصرين ومفردة قراءة قصيرة', ls.every(l => { const q = it.filter(x => x.lesson_id === l.id); return new Set(q.filter(x => x.type === 'mcq').map(x => x.ao)).size >= 2 && q.some(x => x.type === 'short' && x.ao === 'RDG'); }), '');
    ok('مفردات من امتحانات الوزارة في البنك', it.filter(x => /امتحان الوزارة/.test(x.src || '')).length >= 30, it.filter(x => /امتحان الوزارة/.test(x.src || '')).length + ' مفردة');
    // 3) النهائيات
    const F = await api('/api/finals?key=' + encodeURIComponent(S.key));
    const FG = F[S.key] || F;
    const papers = Object.keys((FG && FG.papers) || {});
    ok(S.papers + ' أوراق امتحانات', papers.length === S.papers, papers.join(' '));
    ok('مجموع كل ورقة ' + S.total + ' درجة (9 أقسام)', papers.every(pp => { const q = (FG.q || []).filter(q => q.p === pp); return q.length === 9 && q.reduce((s, q) => s + q.m, 0) === S.total; }), '');
    ok('كل قسم له صورة ونموذج إجابة', (FG.q || []).every(q => q.im && q.ai && q.ai.length), (FG.q || []).length + ' قسمًا');
  }

  // 4) الاختبار القصير
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1300);
  for (const [grade, S] of Object.entries(G)) {
    const runs = [];
    for (let k = 0; k < 6; k++) {
      const r = await p.evaluate(async ([key, subjName, k]) => {
        const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
        subj.value = subjName; subj.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(x => setTimeout(x, 1200));
        cs.value = key; cs.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(x => setTimeout(x, 2600));
        const boxes = [...document.querySelectorAll('[data-lid]')];
        boxes.forEach(x => { if (x.checked) x.click(); });
        const start = (k * 3) % Math.max(1, boxes.length - 4);
        boxes.slice(start, start + 3).forEach(x => { if (!x.checked) x.click(); });
        await new Promise(x => setTimeout(x, 500));
        document.getElementById('makeBtn').click();
        await new Promise(x => setTimeout(x, 3500));
        return { n: document.querySelectorAll('#paper .qi').length, ltr: document.querySelectorAll('#paper .qi[dir=ltr]').length, doc: [...document.querySelectorAll('[data-meta]')].map(e => e.textContent) };
      }, [S.key, SUBJ, k]);
      runs.push(r);
    }
    const parsed = runs.map(r => r.doc.map(t => { const m = t.match(/(\d+)\s*درجة/); return { t, mcq: /اختيار/.test(t), m: m ? +m[1] : 0 }; }));
    ok(grade + ': ' + S.items + ' مفردات في كل ورقة', runs.every(r => r.n === S.items), JSON.stringify(runs.map(r => r.n)));
    ok(grade + ': المفردات باتجاه LTR', runs.every(r => r.ltr === r.n), '');
    ok(grade + ': ' + S.mcq + ' اختيار من متعدد', parsed.every(d => d.filter(x => x.mcq).length === S.mcq), JSON.stringify(parsed.map(d => d.filter(x => x.mcq).length)));
    ok(grade + ': مجموع الورقة 10 درجات', parsed.every(d => d.reduce((s, x) => s + x.m, 0) === 10), JSON.stringify(parsed.map(d => d.reduce((s, x) => s + x.m, 0))));
    const lv = d => Object.keys(S.lv).map(n => d.filter(x => x.t.includes(' · ' + n + ' (')).reduce((s, x) => s + x.m, 0));
    ok(grade + ': توزيع عناصر اللغة كما في الوثيقة ' + JSON.stringify(S.lv), parsed.every(d => lv(d).join() === Object.values(S.lv).join()), JSON.stringify(parsed.map(lv)));
  }

  // 5) الواجب المنزلي تكويني
  await p.goto(B + '/homework', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const hw = await p.evaluate(async ([key, subjName]) => {
    const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
    if (!subj || !cs) return '';
    subj.value = subjName; subj.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 1200));
    cs.value = key; cs.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 2500));
    return document.body.innerText;
  }, [G['الحادي عشر'].key, SUBJ]);
  ok('الواجب المنزلي تكويني (لا يُرصد) حسب الوثيقة', /تكوين/.test(hw), '');

  // 6) الصفحات الأخرى
  for (const [path, label] of [['/summaries', 'الملخصات'], ['/remedial', 'الخطط العلاجية'], ['/cando', 'أستطيع أن'], ['/games', 'الألعاب'], ['/diag', 'الاختبار التشخيصي'], ['/finals', 'الاختبارات النهائية']]) {
    await p.goto(B + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2200);
    const has = await p.evaluate((s) => document.body.innerHTML.includes(s), SUBJ);
    ok(label + ': المادة تظهر', has, '');
  }
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
