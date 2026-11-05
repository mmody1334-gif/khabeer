// يتحقق من صفحة العروض التقديمية: القائمة، المجموعات، المعاينة، وزر التحميل.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'ar-OM' });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
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

  // 1) القائمة في «المزيد»
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  const menu = await p.evaluate(async () => {
    const mb = document.getElementById('menuBtn');
    if (mb) mb.click();
    await new Promise(x => setTimeout(x, 400));
    const items = [...document.querySelectorAll('#menuList a, #menuList button')].map(x => ({ t: x.textContent.trim(), h: x.getAttribute('href') }));
    const mb2 = document.getElementById('menuBtn'); if (mb2) mb2.click();
    return items;
  });
  const slidesItem = menu.find(x => /عروض/.test(x.t));
  ok('بند «العروض التقديمية» في المزيد', !!slidesItem, slidesItem ? slidesItem.h : 'مفقود');

  // 2) صفحة العروض
  await p.goto(B + '/slides', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const page = await p.evaluate(() => ({
    cards: document.querySelectorAll('.sl-card').length,
    grades: [...document.querySelectorAll('.sl-grade-h')].map(x => x.textContent.trim().replace(/\s*\(\d+\)/, '')),
    subj: [...document.querySelectorAll('.sl-subj-h')].map(x => x.textContent.trim()),
    empty: !!document.querySelector('.empty-state')
  }));
  console.log('المواد: ' + JSON.stringify(page.subj));
  console.log('الصفوف: ' + JSON.stringify(page.grades));
  ok('الصفحة تعرض العروض', page.cards > 0, page.cards + ' بطاقة');
  ok('العروض مجمّعة حسب الصف', page.grades.length >= 4, JSON.stringify(page.grades));
  ok('المادة هي الأحياء', page.subj.some(s => /الأحياء/.test(s)), JSON.stringify(page.subj));

  // 3) فتح بطاقة → معاينة + تحميل
  const prev = await p.evaluate(async () => {
    const card = document.querySelector('.sl-card');
    if (!card) return { err: 'لا بطاقة' };
    card.click();
    await new Promise(x => setTimeout(x, 1500));
    const box = document.getElementById('modalBox');
    const ifr = box ? box.querySelector('iframe') : null;
    const dl = box ? [...box.querySelectorAll('a')].find(a => /تحميل/.test(a.textContent)) : null;
    const open = box ? [...box.querySelectorAll('a')].find(a => /فتح/.test(a.textContent)) : null;
    return {
      title: (box && box.querySelector('.sl-prev-head b') || {}).textContent || '',
      iframe: ifr ? ifr.src : '',
      dl: dl ? dl.href : '',
      open: open ? open.href : '',
      wide: box ? box.classList.contains('wide') : false
    };
  });
  console.log('المعاينة: ' + JSON.stringify(prev));
  ok('النافذة تعرض معاينة (iframe)', /drive\.google\.com\/file\/d\/.*\/preview/.test(prev.iframe || ''), prev.iframe || 'لا معاينة');
  ok('زر التحميل المباشر من درايف', /usercontent\.google\.com\/download/.test(prev.dl || ''), prev.dl || 'لا زر');
  ok('زر «فتح في Google Drive»', /drive\.google\.com\/file\/d\/.*\/view/.test(prev.open || ''), prev.open || 'لا زر');
  ok('النافذة عريضة', prev.wide === true, prev.wide ? 'عريضة' : 'عادية');

  await p.screenshot({ path: require('path').join(__dirname, 'slides.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript: ' + (real.length ? real.join('\n') : '(لا شيء)'));
  ok('لا أخطاء JavaScript', real.length === 0, real.slice(0, 3).join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
