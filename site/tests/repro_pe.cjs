// الرياضة المدرسية (5–11، الفصل الأول): التحضير من ملفات الوورد مرتبًا حسب فهرس الكتب،
// والواجب المنزلي من أسئلة التحضير نفسها، وأنشطة (اختيار من متعدد) في بنك الأسئلة.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'Bio@2026x');
const SUBJ = 'الرياضة المدرسية';
const COUNTS = { 'الخامس': 11, 'السادس': 12, 'السابع': 7, 'الثامن': 13, 'التاسع': 6, 'العاشر': 6, 'الحادي عشر': 11 };
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

  // 1) الدروس: العدد لكل صف، والترتيب بالوحدات كما في فهرس الكتاب
  const L = await api('/api/lessons');
  const all = (L.lessons || L).filter(l => l.subject === SUBJ);
  const per = {}; all.forEach(l => { per[l.grade] = (per[l.grade] || 0) + 1; });
  ok('عدد الدروس لكل صف (5–11)', Object.keys(COUNTS).every(g => per[g] === COUNTS[g]), JSON.stringify(per));
  ok('كل درس مكتمل التحضير', all.every(l => l.concepts && l.pre_learning && l.outcomes && l.strategies && l.activities_teach && l.resources && l.formative && l.closing && l.homework), all.length + ' درسًا');
  ok('كل درس له سؤالا واجب بإجابتيهما', all.every(l => l.hw_q1 && l.hw_a1 && l.hw_q2 && l.hw_a2), '');
  ok('الوحدات والأرقام متسلسلة (ترتيب الفهرس)', Object.keys(COUNTS).every(g => {
    const ls = all.filter(l => l.grade === g).sort((a, b) => a.id - b.id);
    return ls.every((l, i) => i === 0 || (+l.unit > +ls[i - 1].unit && l.lesson_no === 1) || (l.unit === ls[i - 1].unit && l.lesson_no === ls[i - 1].lesson_no + 1));
  }), '');
  const g11 = all.filter(l => l.grade === 'الحادي عشر');
  ok('الحادي عشر: 4 وحدات بأسماء الكتاب', new Set(g11.map(l => l.unit_name)).size === 4 && g11.some(l => l.unit_name === 'التنظيم والإدارة في الرياضة المدرسية'), [...new Set(g11.map(l => l.unit_name))].join(' · '));
  const g6 = all.filter(l => l.grade === 'السادس' && /الموانع/.test(l.title));
  ok('السادس: تمرينات الموانع في الوحدة الأولى كما في الفهرس', g6.length === 1 && g6[0].unit === '1', '');
  ok('لا توقيعات أو أسماء مدارس من ملفات التحضير', !all.some(l => /يعتمد\s*[/.:]|مديرة? المدرسة|المشرف التربوي|مدرسة\s*[:/]/.test(JSON.stringify(l))), '');

  // 2) البنك: أسئلة التحضير + أنشطة اختيار من متعدد لكل درس
  const sample = {};
  for (const g of Object.keys(COUNTS)) {
    const key = SUBJ + '|' + g;
    const bank = await api('/api/quiz/bank?key=' + encodeURIComponent(key));
    const it = bank.items || [], ls = all.filter(l => l.grade === g);
    sample[g] = it;
    ok(g + ': لكل درس أسئلة تحضير وأنشطة (3 اختيار من متعدد)', ls.every(l => { const q = it.filter(x => x.lesson_id === l.id); return q.filter(x => x.type === 'mcq').length >= 3 && q.filter(x => x.type !== 'mcq').length >= 2; }), it.length + ' مفردة');
    ok(g + ': المستويات معرفة/تطبيق/استدلال', it.every(x => ['معرفة', 'تطبيق', 'استدلال'].includes(x.ao)), [...new Set(it.map(x => x.ao))].join('، '));
    ok(g + ': سؤالا واجب الدرس من البنك نفسه', ls.every(l => it.some(x => x.lesson_id === l.id && x.stem === l.hw_q1) && it.some(x => x.lesson_id === l.id && x.stem === l.hw_q2)), '');
  }

  // 3) الواجب المنزلي: تكويني، ومن أسئلة التحضير فقط
  await p.goto(B + '/homework', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1300);
  const KEY = SUBJ + '|الثامن';
  const hw = await p.evaluate(async ([key, subjName]) => {
    const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
    subj.value = subjName; subj.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 1200));
    cs.value = key; cs.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 2600));
    const side = document.body.innerText;
    const boxes = [...document.querySelectorAll('[data-lid]')];
    boxes.forEach(x => { if (x.checked) x.click(); });
    if (boxes[2]) boxes[2].click();
    await new Promise(x => setTimeout(x, 500));
    document.getElementById('makeBtn').click();
    await new Promise(x => setTimeout(x, 3000));
    const paper = (document.getElementById('paper') || document.body).innerText;
    return { side, paper, lid: boxes[2] && boxes[2].getAttribute('data-lid') };
  }, [KEY, SUBJ]);
  ok('الواجب المنزلي تكويني للرياضة المدرسية', /تكوين/.test(hw.side), '');
  const les = all.find(l => String(l.id) === String(hw.lid));
  ok('ورقة الواجب تحوي سؤالي التحضير', !!les && hw.paper.includes(les.hw_q1.slice(0, 20)) && hw.paper.includes(les.hw_q2.slice(0, 20)), les ? les.title : 'لا درس');

  // 4) صفحة التحضير تعرض المادة
  for (const path of ['/app']) {
    await p.goto(B + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3200);
    const subs = await p.evaluate(() => { const s = document.getElementById('subjSel'); return s ? [...s.options].map(x => x.value) : []; });
    ok('التحضير ' + path + ': المادة في قائمة المواد', subs.includes(SUBJ), subs.join('، '));
  }
  // لقطة لدرس مفتوح للمراجعة البصرية
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  await p.evaluate((s) => { const e = document.getElementById('subjSel'); if (e) { e.value = s; e.dispatchEvent(new Event('change', { bubbles: true })); } }, SUBJ);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: require('path').join(__dirname, 'pe_prep.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
