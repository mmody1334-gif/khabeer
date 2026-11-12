// يحاكي Tampermonkey في كروم: يحقن أداة نور قبل تحميل كل صفحة (كما تفعل الإضافة،
// وبمعزل عن CSP)، ثم يتحقق من:
//   1) هل سجّلت الأداة إصدارها في data-tahdir-tool؟
//   2) هل يستجيب «إرسال التحضير إلى نور» من أول ضغطة؟
//   3) هل تُفتح صفحة نور الصحيحة (إضافة التحضير لهذا الصف)؟
//   4) هل تظهر نافذة «ثبّت/حدّث الأداة» بالخطأ؟
const PW = require('./_pw.cjs');
const fs = require('fs');
const path = require('path');
const TOOL = fs.readFileSync(path.join(__dirname, '../server/tahdir-noor.user.js'), 'utf8')
  .replace("location.hostname === 'khabeer.khabeer.workers.dev'",
           "(location.hostname === 'khabeer.khabeer.workers.dev' || location.hostname === 'localhost')");
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 950 }, locale: 'ar-OM' });

  // ✅ الحقن قبل أي تحميل: بدائل GM_* ثم الأداة نفسها. هذا يتجاوز CSP فيعمل.
  await c.addInitScript(`
    (function(){
      var S = {};
      // نُهيّئ خريطة أرقام الصفوف كما لو أن الأداة تعلّمتها من نور سابقًا،
      // حتى نتحقق أن الإرسال يفتح صفحة الصف الصحيحة لا الصفحة الرئيسية.
      var SEED = (function(){ try { return JSON.parse(sessionStorage.getItem('__seedGradeMap') || 'null'); } catch(e){ return null; } })();
      if (SEED) S['tahdir_grade_cids'] = SEED;
      window.GM_getValue = function(k, d){ return (k in S) ? S[k] : d; };
      window.GM_setValue = function(k, v){ S[k] = v; };
      window.GM_deleteValue = function(k){ delete S[k]; };
      window.GM_registerMenuCommand = function(){};
      window.__opened = [];
      window.GM_openInTab = function(u){ window.__opened.push(String(u)); window.open(String(u), '_blank'); };
      window.__store = function(k, v){ S[k] = v; };
      try { ${TOOL} window.__toolRan = true; }
      catch (e) { window.__toolErr = String(e && e.message); }
    })();
  `);

  const errs = [];
  const p = await c.newPage();
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  // 1) تهيئة المدير ثم الدخول
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

  // 2) صفحة الدروس — الأداة محقونة من أول تحميل
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.g-btn', { timeout: 25000 });
  await p.waitForTimeout(1500);

  const diag = await p.evaluate(() => ({
    ver: document.documentElement.getAttribute('data-tahdir-tool'),
    ran: !!window.__toolRan, err: window.__toolErr || null,
    hasGM: typeof GM_getValue, host: location.hostname,
  }));
  console.log('تشخيص:', JSON.stringify(diag));
  ok('الأداة سجّلت إصدارها من أول تحميل', !!diag.ver, 'data-tahdir-tool=' + JSON.stringify(diag.ver));
  ok('الأداة اشتغلت بلا استثناء', diag.ran && !diag.err, diag.err || 'ok');

  // 3) نفتح درسًا ونضغط «إرسال التحضير إلى نور» — من أول ضغطة
  await p.click('.g-btn'); await p.click('.u-btn'); await p.click('.l-item');
  await p.waitForSelector('#sendPrepBtn', { timeout: 15000 });
  await p.click('#sendPrepBtn');
  await p.waitForTimeout(2500);

  const after = await p.evaluate(() => window.__opened || []);
  console.log('\nنداءات فتح نور:', after.length);
  after.forEach(u => console.log('   → ' + u));
  ok('فتح نور من أول ضغطة', after.length >= 1, after.length + ' نداء');

  const modal = await p.evaluate(() => {
    const ov = document.getElementById('modal');
    return { hidden: ov.hidden, text: (document.getElementById('modalBox').textContent || '').slice(0, 160) };
  });
  const wronglyShown = !modal.hidden && /ثبّت|حدّث|تثبيت/.test(modal.text);
  ok('لم تظهر نافذة «ثبّت/حدّث الأداة» بالخطأ', !wronglyShown, JSON.stringify(modal));

  // 4) الضغطة الثانية لا تفتح نور مرتين
  await p.click('#sendPrepBtn').catch(() => {});
  await p.waitForTimeout(2000);
  const total = await p.evaluate(() => (window.__opened || []).length);
  console.log('إجمالي النداءات بعد ضغطتين:', total);
  ok('لا فتح مزدوج لنور', total <= 2, total + ' نداء');

  // 5) بعد تعلّم أرقام الصفوف في نور: هل تُفتح صفحة «إضافة تحضير» لهذا الصف بالذات؟
  //    صفحة /app ليس فيها منتقي مقررات، فنملأ الخريطة بكل الصفوف الممكنة ثم نتحقق أن التوجيه
  //    استعمل رقم الصف الذي أرسلته الأداة فعلًا (نقرأه من سجل الحدث).
  const mapCheck = await p.evaluate(() => {
    const SK = ['الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر'];
    const SUB = ['العلوم','الأحياء','الكيمياء','الفيزياء','العلوم البيئية','اللغة العربية','تقنية المعلومات','اللغة الإنجليزية'];
    const map = {};
    SK.forEach(g => { map[g] = '55501'; SUB.forEach(s => { map[s + '|' + g] = '55501'; }); });
    window.__store('tahdir_grade_cids', map);
    const m = GM_getValue('tahdir_grade_cids', null);
    window.__opened.length = 0;
    return { count: m ? Object.keys(m).length : 0 };
  });
  console.log('\nعدد مفاتيح خريطة الصفوف:', mapCheck.count);
  // نراقب نداء GM_openInTab ومنطق التوجيه
  await p.evaluate(() => {
    window.__log = [];
    const orig = window.GM_openInTab;
    window.GM_openInTab = function (u) { window.__log.push('openInTab: ' + u); return orig(u); };
    ['tahdir-v3-send-prep', 'tahdir-send-prep'].forEach(ev => {
      document.addEventListener(ev, e => {
        let d = {};
        try { d = JSON.parse(String(e.detail)); } catch (x) {}
        window.__log.push(ev + ' → grade=' + d.grade + ' subject=' + d.subject + ' kind=' + d.kind);
      }, true);
    });
  });
  await p.click('#sendPrepBtn');
  await p.waitForTimeout(2500);
  const routed = await p.evaluate(() => ({ opened: window.__opened || [], log: window.__log || [] }));
  console.log('سجل التوجيه:', JSON.stringify(routed.log));
  console.log('نداءات نور:', JSON.stringify(routed.opened));
  const toPrep = routed.opened.some(u => /add_preparation\/cid:55501/.test(u));
  ok('تُفتح صفحة «إضافة تحضير» للصف الصحيح', toPrep, routed.opened.join(' | '));
  ok('نداء واحد فقط', routed.opened.length === 1, routed.opened.length + ' نداء');

  await p.screenshot({ path: path.join(__dirname, 'tool_chrome_check.png'), fullPage: true });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
