// اختبار FIX-4: صفحة الطالب /play — العدّاد لا يتجمد بعد إرسال الإجابة.
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

  // --- المعلم: يهيّئ حساب المدير إن كانت القاعدة جديدة، ثم يفتح غرفة تحدٍّ عبر الـ API ---
  const tc = await b.newContext({ locale: 'ar-OM' });
  const tp = await tc.newPage();
  tp.on('pageerror', e => errs.push('teacher ' + e.message));
  await tp.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await tp.$('#setupForm')) {
    await tp.fill('#name', 'أ. محمد مجدي'); await tp.fill('#username', USER);
    await tp.fill('#password', PASS); await tp.fill('#password2', PASS);
    await tp.click('#setupForm button[type=submit]');
    await tp.waitForTimeout(1800);
    await tp.goto(B + '/', { waitUntil: 'domcontentloaded' });
  }
  if (await tp.$('#loginForm')) {
    await tp.fill('#username', USER); await tp.fill('#password', PASS);
    await tp.click('#loginBtn'); await tp.waitForTimeout(2800);
  }
  const room = await tp.evaluate(async () => {
    const items = [1, 2, 3].map(i => ({ stem: 'سؤال رقم ' + i + '؟', choices: ['أ', 'ب', 'ج', 'د'], correct: 0 }));
    const r = await fetch('/api/live/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'اختبار الطالب', grade: 'التاسع', dur: 30, items }) });
    return r.json();
  });
  ok('إنشاء غرفة التحدي', !!room.code, JSON.stringify(room));

  // --- الطالب: يدخل من صفحة /play ---
  const sc = await b.newContext({ locale: 'ar-OM', viewport: { width: 400, height: 850 } });
  const sp = await sc.newPage();
  sp.on('pageerror', e => errs.push('student ' + e.message));
  await sp.goto(B + '/play?c=' + room.code, { waitUntil: 'domcontentloaded' });
  await sp.fill('#jn', 'أحمد');
  await sp.click('.pl-go');
  await sp.waitForSelector('.pl-card', { timeout: 15000 });
  await sp.waitForTimeout(1500);
  const lobby = await sp.$eval('#pl', d => d.innerText);
  ok('الطالب دخل الغرفة وشاهد شاشة الانتظار', /أنت في التحدي/.test(lobby), lobby.replace(/\s+/g, ' ').slice(0, 60));

  // --- المعلم: يبدأ السؤال ثم يكشفه ---
  const ctl = async a => tp.evaluate(async ([code, act]) => {
    const r = await fetch('/api/live/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, action: act }) });
    return r.json();
  }, [room.code, a]);
  await ctl('start');
  await sp.waitForSelector('.pl-o', { timeout: 15000 });
  await sp.waitForTimeout(1500);
  const qView = await sp.evaluate(() => ({ left: (document.getElementById('plLeft') || {}).textContent, opts: document.querySelectorAll('.pl-o').length }));
  ok('الطالب يرى السؤال والعدّاد', qView.opts === 4 && !!qView.left, JSON.stringify(qView));

  // ننتظر لنتأكد أن العدّاد يتغيّر فعلًا
  await sp.waitForTimeout(2500);
  const left2 = await sp.evaluate(() => (document.getElementById('plLeft') || {}).textContent);
  ok('العدّاد يتغيّر أثناء السؤال', left2 !== qView.left, qView.left + ' → ' + left2);

  // --- الطالب: يجاوب ---
  await sp.click('.pl-o');
  await sp.waitForTimeout(2000);
  const answered = await sp.evaluate(() => ({ text: document.getElementById('pl').innerText.replace(/\s+/g, ' ').slice(0, 120), hasLeft: !!document.getElementById('plLeft'), left: (document.getElementById('plLeft') || {}).textContent }));
  ok('شاشة «تم إرسال إجابتك» تظهر', /تم إرسال إجابتك/.test(answered.text), answered.text.slice(0, 70));
  ok('العدّاد ما زال معروضًا على شاشة الانتظار (إصلاح FIX-4)', answered.hasLeft === true, JSON.stringify(answered));

  const leftA = answered.left;
  await sp.waitForTimeout(2600);
  const leftB = await sp.evaluate(() => (document.getElementById('plLeft') || {}).textContent);
  ok('العدّاد يتحرك بعد الإجابة (لم يتجمد)', leftA !== leftB, leftA + ' → ' + leftB);

  // --- المعلم يكشف النتيجة: الطالب يرى التقييم والترتيب ---
  await ctl('reveal');
  await sp.waitForTimeout(2600);
  const revealed = await sp.evaluate(() => document.getElementById('pl').innerText.replace(/\s+/g, ' '));
  ok('الطالب يرى النتيجة والترتيب', /إجابة صحيحة|إجابة خاطئة/.test(revealed) && /ترتيبك/.test(revealed), revealed.slice(0, 90));
  await sp.screenshot({ path: require('path').join(__dirname, 'regress_play.png') });

  // --- المعلم ينهي: الطالب يرى النهاية ثم «تحدٍّ جديد» يعمل ---
  await ctl('next');
  await ctl('next');
  await ctl('next');
  await sp.waitForTimeout(3000);
  const ended = await sp.evaluate(() => document.getElementById('pl').innerText.replace(/\s+/g, ' '));
  const endShown = /انتهى التحدي/.test(ended);
  ok('شاشة النهاية تظهر للطالب', endShown, ended.slice(0, 80));
  if (endShown) {
    await sp.click('#plNew');
    await sp.waitForTimeout(800);
    const back = await sp.evaluate(() => !!document.getElementById('jf'));
    ok('زر «تحدٍّ جديد» يعيد نموذج الدخول', back === true, 'jf=' + back);
    // نتأكد أن الاستطلاع القديم لا يرمي استثناءً بعد إعادة النموذج
    await sp.waitForTimeout(2000);
  }

  await b.close(); srv.stop();
  const all = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', all.length ? all.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', all.length === 0, all.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
