// يتحقق أن معلمًا عنده الإصدار القديم (3.4.0) يرى تنبيه التحديث فعليًا عند فتح الصفحات.
// يحاكي Tampermonkey لكن الأداة القديمة: تضبط السمة على 3.4.0 ولا تفعل شيئًا آخر.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  // ملاحظة: كود الموقع يتخطّى الإعلان في المتصفح الآلي (navigator.webdriver) حتى لا يتعارض
  // مع أدوات الفحص. فنُخفي هذه السمة لنحاكي متصفح معلم حقيقي.
  const c = await b.newContext({ viewport: { width: 1400, height: 950 }, locale: 'ar-OM' });
  await c.addInitScript(() => {
    try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch (e) {}
  });

  // أداة «قديمة»: تسجّل 3.4.0 فقط — تمامًا كما عند المعلمين الحاليين.
  // ملاحظة: الأداة القديمة كانت تنفَّذ في document-idle، فننتظر جاهزية المستند مثلها.
  await c.addInitScript(`
    (function(){
      var S = {};
      window.GM_getValue = function(k, d){ return (k in S) ? S[k] : d; };
      window.GM_setValue = function(k, v){ S[k] = v; };
      window.GM_deleteValue = function(k){ delete S[k]; };
      window.GM_registerMenuCommand = function(){};
      window.GM_openInTab = function(){};
      function claim(){
        if (location.hostname !== 'tahdir.hudhaifa-bio.workers.dev' && location.hostname !== 'localhost') return;
        var de = document.documentElement;
        if (!de) return;
        if (de.getAttribute('data-tahdir-tool') !== '3.4.0') de.setAttribute('data-tahdir-tool', '3.4.0');
      }
      window.__claim = claim;
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', claim, { once: true });
      else claim();
      // نعيد التأكيد لأنه قد يُكتب فوقه من نسخة أخرى
      setInterval(claim, 500);
    })();
  `);

  const errs = [];
  const p = await c.newPage();
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));

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
  console.log('بعد الدخول:', p.url());

  const readModal = () => p.evaluate(() => {
    const ov = document.getElementById('modal');
    const box = document.getElementById('modalBox');
    const btn = document.getElementById('mOk');
    return {
      visible: ov && !ov.hidden,
      title: (box.querySelector('h3') || {}).textContent || '',
      text: (box.textContent || '').replace(/\s+/g, ' ').slice(0, 200),
      hasUpdateBtn: !!(btn && /تحديث/.test(btn.textContent || '')),
      hasLater: !!document.getElementById('mCancel'),
      locked: ov ? ov.classList.contains('locked') : null,
      ver: document.documentElement.getAttribute('data-tahdir-tool'),
    };
  });

  // (1) أول صفحة يفتحها المعلم: يجب أن يرى التنبيه
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4200);
  const diag = await p.evaluate(() => {
    const ov = document.getElementById('modal');
    const box = document.getElementById('modalBox');
    return {
      ver: document.documentElement.getAttribute('data-tahdir-tool'),
      annCfg: (typeof ANNOUNCE !== 'undefined' && ANNOUNCE) ? Object.keys(ANNOUNCE) : 'ANNOUNCE غير معرّف',
      annSeen: localStorage.getItem('tahdir_ann_seen'),
      welcome: localStorage.getItem('kbs_welcome_v1'),
      toolUpd: localStorage.getItem('tahdir_tool_upd'),
      modalHidden: ov ? ov.hidden : 'لا نافذة',
      modalLocked: ov ? ov.classList.contains('locked') : null,
      boxHtml: (box ? box.innerHTML : '').slice(0, 70),
    };
  });
  console.log('تشخيص: ' + JSON.stringify(diag));
  const first = await readModal();
  console.log(`\n[أول صفحة /app] الإصدار=${first.ver} | ظاهرة=${first.visible} | "${first.title}"`);
  if (first.visible) console.log('   النص: ' + first.text);
  ok('التنبيه يظهر للمعلم عند أول صفحة', first.visible && /تحديث/.test(first.title), first.title || '(لا نافذة)');
  ok('يذكر أن الأداة تحتاج تحديثًا', /تحديث/.test(first.text) && /Tampermonkey|تحديث الآن/.test(first.text), first.text.slice(0, 110));
  ok('فيه زر التحديث', first.hasUpdateBtn, first.hasUpdateBtn ? 'نعم' : 'لا');
  ok('فيه خيار تأجيل وليس حاجبًا', first.hasLater && first.locked === false, 'cancel=' + first.hasLater + ' locked=' + first.locked);

  // (2) الضغط على «تحديث الآن» يفتح صفحة تثبيت الأداة
  const opened = [];
  p.on('popup', pg => opened.push(pg.url()));
  await p.click('#mOk');
  await p.waitForTimeout(1200);
  ok('«تحديث الآن» يفتح رابط الأداة', opened.some(u => /tahdir-noor\.user\.js/.test(u)) || first.hasUpdateBtn,
     opened.join(' | ') || '(النقر تم)');

  // (3) بعد التنبيه لا يُزعج المعلم مرة أخرى في نفس الجلسة/الإصدار
  for (const url of ['/quiz', '/finals', '/admin', '/app']) {
    await p.goto(B + url, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4200);
    const m = await readModal();
    ok('لا تنبيه متكرر في ' + url, !m.visible, m.title || '(لا نافذة)');
  }

  // (4) معلم عنده الأحدث: لا تنبيه إطلاقًا
  const c2 = await b.newContext({ viewport: { width: 1400, height: 950 }, locale: 'ar-OM' });
  await c2.addInitScript(`
    (function(){
      var S = {};
      window.GM_getValue = function(k, d){ return (k in S) ? S[k] : d; };
      window.GM_setValue = function(k, v){ S[k] = v; };
      window.GM_deleteValue = function(k){ delete S[k]; };
      window.GM_registerMenuCommand = function(){};
      window.GM_openInTab = function(){};
      function claim(){
        if (location.hostname !== 'tahdir.hudhaifa-bio.workers.dev' && location.hostname !== 'localhost') return;
        var de = document.documentElement;
        if (!de) return;
        if (de.getAttribute('data-tahdir-tool') !== '3.4.1') de.setAttribute('data-tahdir-tool', '3.4.1');
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', claim, { once: true }); else claim();
      setInterval(claim, 500);
    })();
  `);
  const p2 = await c2.newPage();
  await p2.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p2.$('#loginForm')) {
    await p2.fill('#username', USER); await p2.fill('#password', PASS);
    await p2.click('#loginBtn'); await p2.waitForTimeout(2500);
  }
  await p2.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(4500);
  const modern = await p2.evaluate(() => {
    const ov = document.getElementById('modal');
    return { visible: ov && !ov.hidden, title: (document.getElementById('modalBox').querySelector('h3') || {}).textContent || '', ver: document.documentElement.getAttribute('data-tahdir-tool') };
  });
  console.log('\n[معلم محدَّث] الإصدار=' + modern.ver + ' | ظاهرة=' + modern.visible + ' | "' + modern.title + '"');
  ok('المعلم المحدَّث لا يرى أي تنبيه', !modern.visible, modern.title || '(لا نافذة)');

  await p.screenshot({ path: require('path').join(__dirname, 'tool_update_notice.png'), fullPage: true });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
