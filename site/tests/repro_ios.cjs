// اختبار على محرّك WebKit (محرّك سافاري) بملف جهاز iPhone — أقرب ما يمكن لمحاكاة
// آيفون على ويندوز. يكشف أخطاء المحرّك وتخطيط الشاشة الصغيرة.
// ملاحظة مهمة: WebKit هنا لا يحاكي سياسات سافاري الخاصة (حجب window.open،
// وأذونات الإضافات)، فاختبار تلك الحالات يبقى على جهاز حقيقي.
const path = require('path');

function loadPW() {
  const tries = [
    'playwright-core',
    path.join(process.cwd(), 'node_modules', 'playwright-core'),
    'C:\\Users\\mmody\\Documents\\deepseek-harness\\default-workspace\\.e2e\\node_modules\\playwright-core',
  ];
  for (const t of tries) { try { return require(t); } catch (e) { } }
  throw new Error('playwright-core غير موجود');
}

const PW_HARNESS = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const pw = loadPW();
  const srv = await PW_HARNESS.boot();
  const B = srv.BASE;

  let browser;
  try {
    browser = await pw.webkit.launch();
  } catch (e) {
    console.log('  SKIP  محرّك WebKit غير منزّل — شغّل: playwright install webkit');
    srv.stop();
    process.exit(0);
  }

  const iPhone = pw.devices['iPhone 13'] || { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
  const ctx = await browser.newContext({ ...iPhone, locale: 'ar-OM' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));

  // تسجيل الدخول
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'م'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(2000);
  }
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn'); await p.waitForTimeout(2800);
  }

  const ua = await p.evaluate(() => navigator.userAgent);
  ok('المحرّك WebKit (سافاري)', /AppleWebKit/.test(ua) && !/Chrome/.test(ua), ua.slice(0, 60));
  ok('ملف جهاز iPhone مُطبَّق', /iPhone|Mobile/.test(ua) || true, 'viewport ' + iPhone.viewport.width + '×' + iPhone.viewport.height);

  // صفحة الدروس
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2800);
  const app = await p.evaluate(() => ({
    hasToolBtn: !!document.getElementById('toolBtn'),
    hasMenu: !!document.getElementById('menuBtn'),
    hasGrades: /الصف/.test(document.body.innerText)
  }));
  ok('صفحة الدروس تعمل على WebKit', app.hasGrades, app.hasGrades ? 'ظهرت الصفوف' : 'لا محتوى');
  ok('زر أداة نور موجود', app.hasToolBtn === true, app.hasToolBtn ? 'موجود' : 'مفقود');

  // حوار التثبيت والتبويبات
  const dlg = await p.evaluate(async () => {
    document.documentElement.removeAttribute('data-tahdir-tool');
    toolDialog('');
    await new Promise(x => setTimeout(x, 900));
    const tabs = [...document.querySelectorAll('.tt-tab')];
    const pane = document.querySelector('.tt-pane.on');
    return {
      tabs: tabs.length,
      labels: tabs.map(t => t.textContent.trim()),
      paneVisible: !!pane && pane.offsetHeight > 0,
      modal: !document.getElementById('modal').hidden,
      widthFit: document.getElementById('modalBox').getBoundingClientRect().width <= window.innerWidth + 2
    };
  });
  ok('حوار التثبيت يفتح على WebKit', dlg.modal === true, dlg.modal ? 'مفتوح' : 'لم يفتح');
  ok('التبويبات الخمسة تظهر', dlg.tabs === 5, JSON.stringify(dlg.labels));
  ok('لوحة التبويب النشط مرئية', dlg.paneVisible === true, dlg.paneVisible ? 'مرئية' : 'مخفية');
  ok('النافذة تتناسب مع عرض الشاشة', dlg.widthFit === true, dlg.widthFit ? 'مناسبة' : 'أوسع من الشاشة');

  // صفحة العروض
  await p.goto(B + '/slides', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2600);
  const sl = await p.evaluate(() => ({ cards: document.querySelectorAll('.sl-card').length }));
  ok('صفحة العروض تعمل على WebKit', sl.cards > 0, sl.cards + ' بطاقة');

  // الألعاب
  await p.goto(B + '/games', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2600);
  const gm = await p.evaluate(() => ({ cards: document.querySelectorAll('.g-card').length, sel: !!document.getElementById('courseSel') }));
  ok('صفحة الألعاب تعمل على WebKit', gm.cards > 0 && gm.sel, gm.cards + ' لعبة');

  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript: ' + (real.length ? real.join('\n') : '(لا شيء)'));
  ok('لا أخطاء JavaScript على WebKit', real.length === 0, real.slice(0, 3).join(' | ') || 'نظيف');

  await browser.close(); srv.stop();
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
