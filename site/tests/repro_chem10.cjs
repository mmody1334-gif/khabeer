// الكيمياء صف 10 — الفصل الدراسي الأول: كل مزايا المنصة تعمل، والفصل الثاني (348–361) مرحَّل ومخفي.
// الاختبار القصير بمواصفة العلوم للصف العاشر: 10 درجات · اختياران من متعدد · مفردة طويلة · معرفة 4 · تطبيق 4 · استدلال 2
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'Bio@2026x');
const SUBJ = 'الكيمياء', KEY = 'الكيمياء|العاشر';
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

  // 1) الدروس
  const L = await api('/api/lessons');
  const ls = (L.lessons || L).filter(l => l.subject === SUBJ && l.grade === 'العاشر');
  ok('20 درسًا في 4 وحدات (1–4) من الفصل الأول', ls.length === 20 && [...new Set(ls.map(l => String(l.unit)))].sort().join() === '1,2,3,4' && ls.every(l => +l.term === 1), ls.length + ' درسًا');
  ok('دروس الفصل الثاني (348–361) مخفية', !(L.lessons || L).some(l => l.id >= 348 && l.id <= 361), '');
  ok('كل درس مكتمل التحضير والواجب', ls.every(l => l.outcomes && l.activities_teach && l.formative && l.hw_q1 && l.hw_a1 && l.hw_q2 && l.hw_a2), '');

  // 2) البنك والنهائيات
  const bank = await api('/api/quiz/bank?key=' + encodeURIComponent(KEY));
  const it = bank.items || [];
  const fin = it.filter(x => String(x.qid).startsWith('f'));
  ok('البنك يضم أسئلة الدروس', it.filter(x => !String(x.qid).startsWith('f')).length >= 170, it.length + ' مفردة، منها ' + fin.length + ' من الوزارة');
  ok('أهداف البنك بأسماء المستويات الثلاثة (لا AO1/AO2)', it.filter(x => !String(x.qid).startsWith('f')).every(x => ['معرفة', 'تطبيق', 'استدلال'].includes(x.ao)), [...new Set(it.map(x => x.ao))].join('، '));
  ok('لا أسئلة من الفصل الثاني في البنك', !it.some(x => x.lesson_id >= 348 && x.lesson_id <= 361), '');
  ok('كل درس له اختيار من متعدد في هدفين ومقالية', ls.every(l => { const q = it.filter(x => x.lesson_id === l.id); return new Set(q.filter(x => x.type === 'mcq').map(x => x.ao)).size >= 2 && q.some(x => x.type !== 'mcq'); }), '');
  const F = await api('/api/finals?key=' + encodeURIComponent(KEY));
  const G = F[KEY] || F;
  const papers = Object.keys((G && G.papers) || {});
  ok('امتحانات الفصل الثاني مخفية', papers.every(pp => +G.papers[pp].term === 1), papers.join(' '));
  ok('3 أوراق (2024/2025 دوران + 2025/2026) مجموع كل منها 60', papers.length === 3 && papers.every(pp => (G.q || []).filter(q => q.p === pp).reduce((s, q) => s + q.m, 0) === 60), papers.join(' '));
  ok('أرقام الأشكال والجداول مربوطة برقم السؤال (lb)', (G.q || []).filter(q => q.lb && q.lb.length).length >= 40, (G.q || []).filter(q => q.lb && q.lb.length).length + ' مفردة');
  ok('كل مفردة نهائية مربوطة بدرس من الفصل الأول ولها صورة وإجابة', (G.q || []).every(q => q.l >= 2600 && q.l <= 2619 && q.im && q.a), (G.q || []).length + ' مفردة');

  // 3) الاختبار القصير
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1300);
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
      boxes.slice(start, start + 4).forEach(x => { if (!x.checked) x.click(); });
      await new Promise(x => setTimeout(x, 500));
      document.getElementById('makeBtn').click();
      await new Promise(x => setTimeout(x, 3500));
      const items = [...document.querySelectorAll('#paper .qi')];
      const metas = window.__ssDoc ? [] : [];
      const side = (document.getElementById('qside') || document.body).innerText;
      return { n: items.length, side };
    }, [KEY, SUBJ, k]);
    const doc = await p.evaluate(() => {
      // نقرأ الورقة من شارات البيانات (نوع · هدف · درجة) أسفل كل مفردة
      return [...document.querySelectorAll('[data-meta]')].map(e => e.textContent);
    });
    runs.push({ ...r, doc });
  }
  const parsed = runs.map(r => r.doc.map(t => {
    const m = t.match(/(\d+)\s*د/); return { t, mcq: /اختيار/.test(t), m: m ? +m[1] : 0 };
  }));
  ok('5–7 مفردات في كل ورقة', runs.every(r => r.n >= 5 && r.n <= 7), JSON.stringify(runs.map(r => r.n)));
  ok('مفردتا اختيار من متعدد', parsed.every(d => d.filter(x => x.mcq).length === 2), JSON.stringify(parsed.map(d => d.filter(x => x.mcq).length)));
  ok('مجموع الورقة 10 درجات', parsed.every(d => d.reduce((s, x) => s + x.m, 0) === 10), JSON.stringify(parsed.map(d => d.reduce((s, x) => s + x.m, 0))));
  const lv = d => ['معرفة', 'تطبيق', 'استدلال'].map(n => d.filter(x => x.t.includes(n)).reduce((s, x) => s + x.m, 0));
  ok('توزيع المستويات (معرفة 4 · تطبيق 4 · استدلال 2)', parsed.every(d => lv(d).join() === '4,4,2'), JSON.stringify(parsed.map(lv)));

  // 4) الواجب المنزلي تكويني
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
  }, [KEY, SUBJ]);
  ok('صفحة الواجب تعرض المقرر', hw.length > 0, '');

  // 5) الملخصات والألعاب و«أستطيع أن» والاختبار التشخيصي
  const st = await api('/api/study?key=' + encodeURIComponent(KEY)).catch(() => null);
  for (const [path, label] of [['/summaries', 'الملخصات'], ['/remedial', 'الخطط العلاجية'], ['/cando', 'أستطيع أن'], ['/games', 'الألعاب'], ['/diag', 'الاختبار التشخيصي'], ['/finals', 'الاختبارات النهائية']]) {
    await p.goto(B + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2200);
    const has = await p.evaluate((s) => {
      const t = document.body.innerHTML; return t.includes(s);
    }, SUBJ);
    ok(label + ': المادة تظهر', has, '');
  }
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
