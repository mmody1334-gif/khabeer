// يتحقق من الاختبار القصير والألعاب لمقرر التربية الإسلامية صف 8 بعد إضافة البنك.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
const KEY = 'التربية الإسلامية|الثامن';

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
  }
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn'); await p.waitForTimeout(2500);
  }

  // ===== بنك الأسئلة والألعاب (API) =====
  const api = await p.evaluate(async (k) => {
    const q = await (await fetch('/api/quiz/bank?key=' + encodeURIComponent(k))).json();
    const g = await (await fetch('/api/games/data?key=' + encodeURIComponent(k))).json();
    return {
      bank: { lessons: (q.lessons || []).length, items: (q.items || []).length,
              mcq: (q.items || []).filter(x => x.type === 'mcq').length,
              types: [...new Set((q.items || []).map(x => x.type))],
              marks: [...new Set((q.items || []).map(x => x.marks))].sort() },
      games: { lessons: (g.lessons || []).length, items: (g.items || []).length,
               mcq: (g.items || []).filter(x => x.type === 'mcq').length },
    };
  }, KEY);
  console.log('البنك: ' + JSON.stringify(api.bank));
  console.log('الألعاب: ' + JSON.stringify(api.games));
  ok('بنك الأسئلة فيه مفردات للمقرر', api.bank.items > 50, api.bank.items + ' مفردة');
  ok('البنك يغطّي الدروس الـ27', api.bank.lessons === 27, api.bank.lessons + ' درسًا');
  ok('البنك فيه اختيار من متعدد', api.bank.mcq > 20, api.bank.mcq + ' مفردة');
  ok('درجات المفردات وفق الوثيقة (1-2)', api.bank.marks.every(m => m <= 2), JSON.stringify(api.bank.marks));
  ok('الألعاب تجد أسئلة للمقرر', api.games.items > 50, api.games.items + ' مفردة');
  ok('الألعاب تجد اختيارًا من متعدد', api.games.mcq > 20, api.games.mcq + ' مفردة');

  // ===== توليد اختبار قصير فعلي =====
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1300);
  const made = await p.evaluate(async (k) => {
    const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
    subj.value = 'التربية الإسلامية'; subj.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 1400));
    cs.value = k; cs.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 2800));
    const boxes = [...document.querySelectorAll('[data-lid]')];
    boxes.slice(0, 5).forEach(x => { if (!x.checked) x.click(); });
    await new Promise(x => setTimeout(x, 600));
    document.getElementById('makeBtn').click();
    await new Promise(x => setTimeout(x, 3500));
    const items = [...document.querySelectorAll('#paper .qi')];
    return { total: items.length, withChoices: items.filter(x => x.querySelector('.qc, [class*=choice], ol, ul')).length,
             texts: items.slice(0, 6).map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 90)) };
  }, KEY);
  console.log('\nورقة الاختبار القصير: %d سؤالًا | فيها اختيارات: %d' % (made.total, made.withChoices));
  made.texts.forEach((t, i) => console.log('   %d) %s' % (i + 1, t)));
  ok('الاختبار القصير يولّد أسئلة', made.total > 0, made.total + ' سؤالًا');
  await p.screenshot({ path: require('path').join(__dirname, 'islam8_quiz_final.png'), fullPage: true });

  // ===== تشغيل لعبة =====
  await p.goto(B + '/games', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1300);
  const game = await p.evaluate(async (k) => {
    const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
    subj.value = 'التربية الإسلامية'; subj.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 1400));
    cs.value = k; cs.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 3000));
    const boxes = [...document.querySelectorAll('[data-lid]')];
    boxes.slice(0, 3).forEach(x => { if (!x.checked) x.click(); });
    await new Promise(x => setTimeout(x, 600));
    const btns = [...document.querySelectorAll('button')].map(x => x.textContent.trim());
    return { boxes: boxes.length, buttons: btns.slice(0, 14),
             body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300) };
  }, KEY);
  console.log('\nالألعاب — الدروس: %d | الأزرار: %s' % (game.boxes, JSON.stringify(game.buttons)));
  ok('ركن الألعاب يعرض الدروس الثلاثة المختارة', game.boxes >= 3, game.boxes + ' درسًا');
  await p.screenshot({ path: require('path').join(__dirname, 'islam8_games_final.png'), fullPage: true });

  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
