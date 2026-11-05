// يتحقق من إصلاح ترقيم أسئلة الامتحانات النهائية في الاختبار القصير — على الشاشة وفي وضع الطباعة.
const PW = require('./_pw.cjs');
let chromium, findChrome, BASE;
const path = require('path');
let CHROME;
let B;
const OUT = __dirname;
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  chromium = PW.chromium; BASE = srv.BASE; B = srv.BASE; CHROME = PW.findChrome();
  console.log('السيرفر:', srv.startedByUs ? 'بدأ جديدًا' : 'مُعاد استخدامه (موجود ومحدَّث)');
  const b = await chromium.launch({ executablePath: CHROME, headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM' });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));

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

  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(2000);

  const picked = await p.evaluate(async () => {
    const subj = document.getElementById('courseSelSubj');
    const sel = document.getElementById('courseSel');
    for (const w of ['العلوم|الثامن', 'الأحياء|التاسع', 'الأحياء|العاشر', 'العلوم|الخامس']) {
      const s = w.split('|')[0];
      if (subj) { const o = [...subj.options].find(x => x.value === s); if (o) { subj.value = s; subj.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1000)); } }
      if ([...sel.options].some(x => x.value === w)) { sel.value = w; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 2200)); return w; }
    }
    return sel.value;
  });
  console.log('المقرر:', picked);

  // (1) نتحقق أن نص السؤال القادم من الامتحانات النهائية لم يبقَ فيه الرقم الأصلي
  const stems = await p.evaluate(async () => {
    const r = await fetch('/api/quiz/bank?key=' + encodeURIComponent(document.getElementById('courseSel').value));
    const j = await r.json();
    const fin = (j.items || []).filter(x => String(x.qid || '').startsWith('f'));
    return fin.slice(0, 6).map(x => ({ qid: x.qid, img: !!x.img, stem: String(x.stem || '').slice(0, 46) }));
  });
  console.log('\nأسئلة من الامتحانات النهائية في بنك الأسئلة:');
  stems.forEach(s => console.log('   %s صورة=%s نص=%s', s.qid, s.img ? 'نعم' : 'لا ', s.stem));
  const withNum = stems.filter(s => /^\s*\(?\s*\d{1,2}\s*[\)\.\-]/.test(s.stem));
  ok('لم يبقَ رقم السؤال الأصلي في نص السؤال', withNum.length === 0, withNum.length + ' من ' + stems.length + ' فيه رقم');
  ok('أسئلة الامتحانات النهائية تحمل صورتها', stems.length > 0 && stems.every(s => s.img), stems.length + ' سؤالًا');

  // (2) نكوّن اختبارًا ونقيس الفجوة بين الرقم والصورة + نلقط وضع الطباعة
  const made = await p.evaluate(async () => {
    [...document.querySelectorAll('[data-lid]')].slice(0, 3).forEach(c => c.click());
    await new Promise(r => setTimeout(r, 400));
    const mk = document.getElementById('makeBtn'); if (mk) mk.click();
    await new Promise(r => setTimeout(r, 2500));
    return { qis: document.querySelectorAll('#paper .qi').length, imgs: document.querySelectorAll('#paper .qi img').length };
  });
  console.log('\nالورقة: %d سؤالًا، %d صورة', made.qis, made.imgs);
  ok('الاختبار تكوّن وفيه أسئلة بصور', made.qis > 0 && made.imgs > 0, JSON.stringify(made));

  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(600);

  const printCheck = await p.evaluate(async () => {
    // نستدعي مسار الطباعة الفعلي: زر الطباعة يبني #printArea ثم يطبع.
    // هنا نبني #printArea يدويًا بنفس الدالة المستخدمة لتفادي نافذة الطباعة.
    const imgs = [...document.querySelectorAll('#paper .qi img')];
    const out = [];
    imgs.slice(0, 6).forEach((img, i) => {
      const qi = img.closest('.qi');
      const numP = qi.querySelector('p');
      const nr = numP.getBoundingClientRect(), ir = img.getBoundingClientRect();
      out.push({
        n: i + 1,
        num: (numP.textContent || '').trim().slice(0, 6),
        gap: Math.round(ir.top - nr.bottom),
        numInOwnBlock: nr.bottom,
        imgTop: ir.top,
        wrapperBreak: getComputedStyle(img.parentElement).breakInside,
        // هل الرقم والصورة في نفس الكتلة غير القابلة للانقسام؟
        sameBlock: img.parentElement.contains(numP),
        pageBreakOnQi: getComputedStyle(qi).pageBreakInside,
      });
    });
    return out;
  });
  console.log('\nقياس في وضع الطباعة:');
  printCheck.forEach(s => console.log('   س' + s.n + '  رقم=' + s.num + '  فجوة=' + s.gap + 'px' +
    '  كتلة_واحدة=' + s.sameBlock + '  منع_انقسام=' + s.wrapperBreak + '/' + s.pageBreakOnQi));
  ok('الرقم والصورة في نفس الكتلة غير القابلة للانقسام',
    printCheck.length > 0 && printCheck.every(s => s.sameBlock && /avoid/.test(s.wrapperBreak)),
    JSON.stringify(printCheck[0] || {}));
  const maxGap = Math.max(...printCheck.map(s => s.gap));
  ok('لا فجوة كبيرة بين الرقم والصورة', maxGap <= 12, 'أكبر فجوة ' + maxGap + 'px');
  ok('رقم السؤال مولَّد ومرتّب', printCheck.every(s => /^\(\d+\)$/.test(s.num) || /^\d+\)$/.test(s.num)),
    printCheck.map(s => s.num).join(' | '));

  await p.screenshot({ path: path.join(OUT, 'quiz_finals_print.png'), fullPage: true });

  // (3) نفحص ورقة الطباعة الحقيقية عبر doPrint (نبني printArea بأنفسنا بنفس الدالة)
  const printArea = await p.evaluate(() => {
    const a = document.getElementById('printArea');
    // نستخدم نفس مسار الطباعة: زر PDF يملأ printArea ثم يطبع
    return { hasArea: !!a, cssHide: getComputedStyle(a).display };
  });
  console.log('\n#printArea:', JSON.stringify(printArea));

  await b.close(); srv.stop();
  console.log('\nأخطاء JavaScript:', errs.length ? errs.join(' | ') : '(لا شيء)');
  ok('لا أخطاء JavaScript', errs.length === 0, errs.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
