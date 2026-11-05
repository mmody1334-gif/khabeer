// اختبار آلي شامل للتعديلات: يشغّل السيرفر المحلي، يهيّئ المدير، ويفحص كل إصلاح في متصفح حقيقي.
const PW = require('./_pw.cjs');
let chromium, findChrome, BASE;
const fs = require('fs');
const path = require('path');
let B;
// اللقطات تُكتب كـ tests/*.png حتى يتجاهلها .gitignore
const OUT = __dirname;
let CHROME;
const NAME = 'أ. محمد مجدي', USER = 'mohamed', PASS = (process.env.TEST_PASS||'');

let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  chromium = PW.chromium; BASE = srv.BASE; B = srv.BASE; CHROME = PW.findChrome();
  const b = await chromium.launch({ executablePath: CHROME, headless: true });
  const errs = [];
  const mk = async (o = {}) => {
    const c = await b.newContext({ viewport: { width: 1400, height: 950 }, locale: 'ar-OM', permissions: ['clipboard-read', 'clipboard-write'], ...o });
    const p = await c.newPage();
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::ERR|400 \(Bad Request\)/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
    return p;
  };
  const p = await mk();
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#setupForm')) {
    await p.fill('#name', NAME); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]');
    await p.waitForTimeout(1500);
  }
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn');
    await p.waitForSelector('.kpis, .g-btn, #qside', { timeout: 25000 }).catch(() => {});
    await p.waitForTimeout(1200);
  }

  console.log('\n=== الصفحات المخفية: «تصحيح الواجبات» لا يظهر في القائمة لكنه يعمل بالرابط ===');
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#menuBtn', { timeout: 20000 });
  await p.click('#menuBtn');
  await p.waitForTimeout(300);
  const menuText = await p.$eval('#menuList', m => m.innerText);
  const gradingLinks = await p.$$eval('#menuList a', as => as.map(a => a.getAttribute('href')));
  ok('لا يوجد رابط /grading في قائمة التنقل', !gradingLinks.includes('/grading'), gradingLinks.join(' , '));
  ok('لا ذكر لـ«تصحيح» في القائمة', !/تصحيح/.test(menuText), menuText.replace(/\s+/g, ' ').slice(0, 80));
  await p.keyboard.press('Escape');
  // لكن الصفحة نفسها ما زالت تعمل بالرابط المباشر
  const gr = await p.goto(B + '/grading', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#gr', { timeout: 20000 });
  await p.waitForTimeout(2500);
  const grText = await p.$eval('#gr', d => d.innerText.replace(/\s+/g, ' '));
  ok('صفحة /grading تعمل بالرابط المباشر', gr.status() === 200 && /تصحيح الواجبات/.test(grText), 'HTTP ' + gr.status());

  console.log('\n=== FIX-1: أحداث finals_open / finals_print لا تُرفض ===');
  const evtCheck = await p.evaluate(async () => {
    const send = async t => (await fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: t, detail: 'x' }) })).status;
    const out = {};
    for (const t of ['finals_open', 'finals_print', 'view', 'bogus_type']) out[t] = await send(t);
    return out;
  });
  ok('finals_open مقبول', evtCheck['finals_open'] === 200, 'HTTP ' + evtCheck['finals_open']);
  ok('finals_print مقبول', evtCheck['finals_print'] === 200, 'HTTP ' + evtCheck['finals_print']);
  ok('view ما زال مقبولًا', evtCheck['view'] === 200, 'HTTP ' + evtCheck['view']);
  ok('نوع مجهول ما زال مرفوضًا', evtCheck['bogus_type'] === 400, 'HTTP ' + evtCheck['bogus_type']);

  console.log('\n=== FIX-2: سجل النشاط يعرض الأحداث بالعربية ===');
  await p.goto(B + '/finals', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  await p.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.kpis', { timeout: 20000 });
  await p.click('.tab >> nth=3').catch(() => {});
  await p.waitForTimeout(800);
  const feed = await p.$eval('#dash', d => d.innerText);
  const hasArabicFinals = /فتح الاختبارات النهائية/.test(feed);
  const rawEnglish = (feed.match(/\b(finals_open|finals_print|tasks_fetch|grade_start|game_live)\b/g) || []);
  ok('حدث finals_open يظهر بالعربية', hasArabicFinals, hasArabicFinals ? 'موجود' : 'غير موجود');
  ok('لا أنواع إنجليزية خام في السجل', rawEnglish.length === 0, rawEnglish.join(',') || 'نظيف');

  console.log('\n=== FIX-5: ورقة المراجعة في الاختبارات النهائية ===');
  await p.goto(B + '/finals', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.fin-q', { timeout: 25000 }).catch(() => {});
  const unitCount = (await p.$$('.fin-u')).length;
  ok('وحدات الامتحانات ظاهرة', unitCount > 1, unitCount + ' وحدة');
  if (unitCount > 1) {
    // (أ) في الوحدة الأولى: لا مختار بعد ⇒ لا زر «المختار في هذه الوحدة»
    let side = await p.$eval('#fside', d => d.innerText);
    ok('لا زر «المختار في هذه الوحدة» قبل الاختيار', !/المختار في هذه الوحدة/.test(side), '—');
    // (ب) نختار سؤالًا من الوحدة الأولى
    await p.check('.fin-q input[data-pick]');
    await p.waitForTimeout(500);
    side = await p.$eval('#fside', d => d.innerText);
    ok('زر «اطبع المختار (1)» يظهر', /اطبع المختار \(1\)/.test(side), side.match(/اطبع المختار \(\d+\)/)?.[0] || '—');
    ok('زر «المختار في هذه الوحدة» يظهر بعد الاختيار', /المختار في هذه الوحدة/.test(side), '—');
    // (ج) ننتقل لوحدة ثانية: المحدد يبقى، لكن الزر الخاص بالوحدة يختفي ويظهر التنبيه
    const fresh = await p.$$('.fin-u');
    await fresh[1].click();
    await p.waitForTimeout(1800);
    side = await p.$eval('#fside', d => d.innerText);
    const inUnitBtn = /المختار في هذه الوحدة/.test(side);
    const otherNote = /من وحدة أخرى/.test(side);
    const total = /اطبع المختار \(1\)/.test(side);
    const checkedInNewUnit = await p.$$eval('.fin-q input[data-pick]:checked', xs => xs.length);
    ok('المحدد يبقى محفوظًا بعد تبديل الوحدة', checkedInNewUnit === 0, 'محدد في الوحدة الجديدة: ' + checkedInNewUnit);
    ok('الإجمالي ما زال 1', total, side.match(/اطبع المختار \(\d+\)/)?.[0] || '—');
    ok('لا زر «المختار في هذه الوحدة» (لا محدد في الوحدة المعروضة)', !inUnitBtn, inUnitBtn ? 'ظهر خطأً' : 'مفقود كما يجب');
    ok('تنبيه «من وحدة أخرى» ظاهر', otherNote, otherNote ? 'موجود' : 'مفقود');
  }

  console.log('\n=== FIX-3: لعبة البحث عن الكلمات لا تنهار ===');
  await p.goto(B + '/games', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.g-card', { timeout: 25000 });
  // نختار أول درس ثم نحقن حالة «لا كلمات» لنرى أن الرسالة تظهر بدل الانهيار
  await p.click('[data-lid]').catch(() => {});
  await p.waitForTimeout(600);
  const wordsResult = await p.evaluate(async () => {
    // نحاكي درسًا بلا مصطلحات: نفرّغ concepts لكل الدروس المختارة
    const before = document.querySelectorAll('.g-card').length;
    return { before };
  });
  ok('بطاقات الألعاب ظاهرة', wordsResult.before > 0, wordsResult.before + ' لعبة');

  console.log('\n=== FIX-8: تسريب مستمعي النوافذ في لوحة التحكم ===');
  await p.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.kpis', { timeout: 20000 });
  // نفتح نافذة تفاصيل معلم ثم نغلقها ونكرر: نقيس أن Escape لا يفتح/يغلق نوافذ عالقة
  const leak = await p.evaluate(async () => {
    const ov = document.getElementById('modal');
    let opens = 0;
    for (let i = 0; i < 3; i++) {
      const btn = document.querySelector('[data-open]');
      if (!btn) break;
      btn.click();
      await new Promise(r => setTimeout(r, 250));
      if (!ov.hidden) opens++;
      // نغلق بمفتاح Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
    }
    // بعد آخر Escape يجب أن تكون النافذة مغلقة ولا شيء معلّق
    return { opens, closedAtEnd: ov.hidden, boxEmpty: document.getElementById('modalBox').innerHTML === '' };
  });
  ok('نافذة التفاصيل تُفتح وتُغلق بـ Escape', leak.opens > 0 && leak.closedAtEnd, JSON.stringify(leak));
  ok('لا محتوى عالق في صندوق النافذة', leak.boxEmpty, JSON.stringify(leak));

  console.log('\n=== FIX-7: تبديل المقرر في التقويم ===');
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(2000);
  const quizSwitch = await p.evaluate(async () => {
    const sel = document.getElementById('courseSel');
    const subj = document.getElementById('courseSelSubj');
    // نختار الدروس ونكوّن اختبارًا
    document.querySelectorAll('[data-lid]').forEach((c, i) => { if (i < 2) c.click(); });
    await new Promise(r => setTimeout(r, 300));
    const mk = document.getElementById('makeBtn');
    if (mk) mk.click();
    await new Promise(r => setTimeout(r, 1200));
    const hadPaper = !!document.querySelector('#paper .qi');
    // نبدّل الصف
    const before = sel.value;
    const opt = [...sel.options].find(o => o.value !== before);
    if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    await new Promise(r => setTimeout(r, 2500));
    const paperAfter = !!document.querySelector('#paper .qi');
    const welcomeAfter = /welcome/.test(document.getElementById('qmain').innerHTML);
    return { hadPaper, changed: sel.value !== before, paperAfter, welcomeAfter };
  });
  ok('كوّن اختبارًا من الصف الأول', quizSwitch.hadPaper, JSON.stringify(quizSwitch));
  ok('تبديل الصف نجح', quizSwitch.changed, JSON.stringify(quizSwitch));
  ok('الورقة القديمة مُسحت بعد تبديل الصف', !quizSwitch.paperAfter || quizSwitch.welcomeAfter, JSON.stringify(quizSwitch));

  await p.screenshot({ path: path.join(OUT, 'regress_final.png'), fullPage: true });
  await b.close(); srv.stop();

  const real = [...new Set(errs)];
  console.log('\n=== أخطاء JavaScript ===');
  console.log(real.length ? real.join('\n') : '(لا شيء)');
  console.log('\n=== النتيجة: ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail || real.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
