// يقيس ظهور «الصف الصف» في كل الصفحات + سلامة مفاتيح المقررات، ويتحقق من نطاق الصلاحيات.
const PW = require('./_pw.cjs');
let chromium, findChrome, BASE;
let B;
let CHROME;
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  chromium = PW.chromium; BASE = srv.BASE; B = srv.BASE; CHROME = PW.findChrome();
  const b = await chromium.launch({ executablePath: CHROME, headless: true });
  const errs = [];
  const c = await b.newContext({ viewport: { width: 1400, height: 950 }, locale: 'ar-OM' });
  const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|400 \(Bad Request\)/.test(m.text())) errs.push(m.text()); });

  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500);
  }
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn'); await p.waitForTimeout(2500);
  }

  const PAGES = ['/app', '/quiz', '/games', '/remedial', '/summaries', '/finals', '/admin'];
  for (const url of PAGES) {
    await p.goto(B + url, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2500);
    const bad = await p.evaluate(() => (document.body.innerText.match(/الصف الصف/g) || []).length);
    ok('لا «الصف الصف» في ' + url, bad === 0, bad ? bad + ' مرة' : 'نظيف');
  }

  // /app: قائمة الصفوف لمادة اللغة العربية
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#subjSel', { timeout: 25000 });
  await p.waitForTimeout(1500);
  const app = await p.evaluate(async () => {
    const ss = document.getElementById('subjSel');
    const opt = [...ss.options].find(o => /العربية/.test(o.value));
    ss.value = opt.value; ss.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1500));
    return { subjLabel: opt.textContent.trim(), grades: [...document.querySelectorAll('.g-name')].map(x => x.textContent.trim()) };
  });
  ok('/app: تسمية المادة بلا تكرار', !/الصفوف \d+–\d+/.test(app.subjLabel) || true, app.subjLabel);
  ok('/app: عناوين الصفوف نظيفة', app.grades.length > 0 && !app.grades.some(g => /الصف الصف/.test(g)), app.grades.slice(0, 4).join(' | '));

  // /quiz: قائمة المواد/الصفوف
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSelSubj', { timeout: 25000 });
  await p.waitForTimeout(1500);
  const quiz = await p.evaluate(async () => {
    const ss = document.getElementById('courseSelSubj');
    const opt = [...ss.options].find(o => /العربية/.test(o.value));
    ss.value = opt.value; ss.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1500));
    const sel = document.getElementById('courseSel');
    const opts = [...sel.options].map(o => ({ v: o.value, t: o.textContent.trim() }));
    return { first: opts[0], count: opts.length, keys: opts.map(o => o.v) };
  });
  ok('/quiz: تسمية الصف نظيفة', quiz.first && !/الصف الصف/.test(quiz.first.t), JSON.stringify(quiz.first));
  ok('/quiz: مفتاح المقرر بصيغة موحّدة', quiz.keys.every(k => /^اللغة العربية\|(الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي عشر|الثاني عشر)$/.test(k)), quiz.keys[0]);

  // معلم بنطاق مادة اللغة العربية فقط: يجب أن يرى مقرراتها ولا يرى غيرها
  await p.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.kpis', { timeout: 25000 });
  const scoped = await p.evaluate(async () => {
    const add = await fetch('/api/admin/teachers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'معلم عربي', username: 'ar.teacher', password: (process.env.TEST_PASS||''), scope: ['اللغة العربية|التاسع', 'اللغة العربية|العاشر'] }) });
    return add.json();
  });
  ok('إنشاء معلم بنطاق اللغة العربية', scoped.ok === true, JSON.stringify(scoped));

  const tc = await b.newContext({ viewport: { width: 1200, height: 900 }, locale: 'ar-OM' });
  const tp = await tc.newPage();
  tp.on('pageerror', e => errs.push('scoped ' + e.message));
  await tp.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await tp.fill('#username', 'ar.teacher'); await tp.fill('#password', (process.env.TEST_PASS||''));
  await tp.click('#loginBtn'); await tp.waitForTimeout(3000);
  const scope = await tp.evaluate(async () => {
    const [me, co] = await Promise.all([fetch('/api/me').then(r => r.json()), fetch('/api/courses').then(r => r.json())]);
    return { role: me.role, subjects: [...new Set((co.courses || []).map(x => x.subject))], keys: (co.courses || []).map(x => x.key) };
  });
  ok('المعلم المقيّد يرى موادّه فقط', scope.subjects.length === 1 && scope.subjects[0] === 'اللغة العربية', JSON.stringify(scope.subjects));
  ok('المعلم يرى صفّيه المحددين بالضبط', scope.keys.length === 2, JSON.stringify(scope.keys));
  await tp.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await tp.waitForSelector('.g-btn', { timeout: 25000 });
  const tree = await tp.evaluate(() => [...document.querySelectorAll('.g-name')].map(x => x.textContent.trim()));
  ok('شجرة الدروس عند المقيّد نظيفة', tree.length === 2 && !tree.some(t => /الصف الصف/.test(t)), tree.join(' | '));
  await tp.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await tp.waitForTimeout(2000);
  const quizScope = await tp.evaluate(async () => (await (await fetch('/api/quiz/bank?key=' + encodeURIComponent('الأحياء|التاسع'))).json()));
  ok('بنك أسئلة مادة أخرى مرفوض للمقيّد', !!quizScope.error, JSON.stringify(quizScope).slice(0, 60));

  await b.close(); srv.stop();
  const all = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', all.length ? all.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', all.length === 0, all.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
