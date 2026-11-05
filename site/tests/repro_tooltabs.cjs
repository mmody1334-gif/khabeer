// يتحقق من تبويبات تثبيت الأداة حسب المتصفح: كروم · فايرفوكس · إيدج · ماك/سافاري.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1200, height: 900 }, locale: 'ar-OM' });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'م'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
  }
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn'); await p.waitForTimeout(2500);
  }
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2600);

  const r = await p.evaluate(async () => {
    document.documentElement.removeAttribute('data-tahdir-tool');
    toolDialog('');
    await new Promise(x => setTimeout(x, 900));
    return {
      tabs: [...document.querySelectorAll('.tt-tab')].map(t => t.getAttribute('data-tab')),
      active: (document.querySelector('.tt-tab.on') || {}).getAttribute ? document.querySelector('.tt-tab.on').getAttribute('data-tab') : '',
      panes: [...document.querySelectorAll('.tt-pane')].map(x => x.getAttribute('data-pane')),
      shown: !document.getElementById('modal').hidden
    };
  });
  ok('الحوار يُظهر 5 تبويبات', r.tabs.length === 5, JSON.stringify(r.tabs));
  ok('تضم كروم وفايرفوكس وإيدج وسافاري وآيفون',
    ['chrome', 'firefox', 'edge', 'safari', 'ios'].every(k => r.tabs.includes(k)), JSON.stringify(r.tabs));
  ok('المتصفح الحالي محدَّد تلقائيًّا', r.tabs.includes(r.active), 'المحدد: ' + r.active);
  ok('لكل تبويب لوحة مستقلة', r.panes.length === 5, JSON.stringify(r.panes));

  // كل لوحة فيها مصدرها الصحيح: كروم → إضافة «خبير» (ZIP)، إيدج → متجر Edge (منشورة رسميًا)،
  // فايرفوكس → Tampermonkey، سافاري → App Store
  const stores = await p.evaluate(() => [...document.querySelectorAll('.tt-pane')].map(x => x.innerHTML));
  const map = { chrome: '/download/tahdir-ext.zip', firefox: 'addons.mozilla', edge: 'microsoftedge.microsoft.com', safari: 'apps.apple.com' };
  let allOk = true, detail = [];
  for (const pn of ['chrome', 'firefox', 'edge', 'safari']) {
    const idx = (await p.evaluate(pn2 => [...document.querySelectorAll('.tt-pane')].findIndex(x => x.getAttribute('data-pane') === pn2), pn));
    const has = stores[idx] && stores[idx].includes(map[pn]);
    detail.push(pn + ':' + (has ? '✓' : '✗'));
    if (!has) allOk = false;
  }
  ok('كل تبويب يفتح متجره الصحيح', allOk, detail.join(' '));

  // تبويب سافاري: تحذير Legacy + خطوات الإعدادات
  const saf = await p.evaluate(async () => {
    const s = [...document.querySelectorAll('.tt-tab')].find(t => t.getAttribute('data-tab') === 'safari');
    s.click(); await new Promise(x => setTimeout(x, 400));
    const pane = document.querySelector('.tt-pane.on');
    return {
      id: pane.getAttribute('data-pane'),
      legacy: /Legacy/.test(pane.textContent),
      settings: /الإعدادات/.test(pane.textContent),
      allow: /lms\.moe\.gov\.om/.test(pane.textContent)
    };
  });
  ok('التبديل إلى سافاري يعمل', saf.id === 'safari', saf.id);
  ok('يُحذّر من نسخة Legacy', saf.legacy === true, saf.legacy ? 'موجود' : 'مفقود');
  ok('يذكر خطوات تفعيل الإضافة والسماح للموقع', saf.settings && saf.allow, (saf.settings ? 'الإعدادات ' : '') + (saf.allow ? 'lms.moe ' : ''));

  const ios = await p.evaluate(async () => {
    const s=[...document.querySelectorAll('.tt-tab')].find(t=>t.getAttribute('data-tab')==='ios');
    if(!s)return {err:'لا تبويب'};
    s.click(); await new Promise(x=>setTimeout(x,400));
    const pane=document.querySelector('.tt-pane.on');
    return { id:pane.getAttribute('data-pane'), free:/Userscripts/.test(pane.textContent), openSource:/مجاني/.test(pane.textContent), appStore:pane.innerHTML.indexOf('apps.apple.com')>=0 };
  });
  ok('تبويب آيفون يعرض Userscripts المجاني', ios.id==='ios' && ios.free && ios.openSource, JSON.stringify(ios));
  // دليل مصوّر بأسهم: 3 خطوات وإشارات ضغط واضحة
  const guide = await p.evaluate(() => {
    const pane = document.querySelector('.tt-pane.on');
    const taps = [...pane.querySelectorAll('.iosg-tap')];
    return {
      steps: pane.querySelectorAll('.iosg-step').length,
      taps: taps.length,
      labels: taps.map(t => t.textContent.trim()),
      arrow: taps.length ? getComputedStyle(taps[0], '::after').content : '',
      rows: pane.querySelectorAll('.iosg-row').length,
      overflow: pane.scrollWidth > pane.clientWidth + 2
    };
  });
  ok('دليل مصوّر من 3 خطوات', guide.steps === 3, guide.steps + ' خطوة');
  ok('أسهم إشارة على ما يُضغط', guide.taps >= 4, guide.taps + ' إشارة: ' + JSON.stringify(guide.labels));
  ok('سهم مرئي على العنصر (::after)', guide.arrow && guide.arrow !== 'none', String(guide.arrow).slice(0, 20));
  ok('الدليل لا يتجاوز عرض الشاشة', guide.overflow === false, guide.overflow ? 'يتجاوز' : 'مناسب');
  ok('فيه رابط App Store', ios.appStore===true, ios.appStore?'موجود':'مفقود');

  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript: ' + (real.length ? real.join('\n') : '(لا شيء)'));
  ok('لا أخطاء JavaScript', real.length === 0, real.slice(0, 3).join(' | ') || 'نظيف');

  await b.close(); srv.stop();
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
