// واجهة تطبيق الجوال (TahdirApp): لا تمرير أفقي في أي صفحة، شريط سفلي، قائمة كورقة سفلية + لقطات m_*.png
const PW = require('./_pw.cjs');
const OUT = process.env.OUT || __dirname;
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 TahdirApp/1';
const PAGES = (process.env.PAGES || 'app,quiz,diag,games,slides,remedial,summaries,cando,cards,analysis,ld,forms,space,research,finals,grading,admin').split(',');
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8817) }); const B = s.BASE;
  const b = await PW.chromium.launch({ headless: true });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, locale: 'ar-OM' });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shut = () => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } document.querySelectorAll('.tour-skip,#tourSkip').forEach(x => x.click()); });
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
  if (await p.$('#setupForm')) { await p.fill('#name', 'أ. محمد'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500); await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); }
  if (await p.$('#loginForm')) { await p.screenshot({ path: OUT + '/m_login.png' }); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForTimeout(2500); }
  const res = {};
  const audit = async (name) => {
    await p.waitForTimeout(1500); await shut(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const W = document.documentElement.clientWidth, bad = [];
      for (const el of document.querySelectorAll('body *')) { const b = el.getBoundingClientRect(); if (b.width && (b.right > W + 1 || b.left < -1)) { let q = el, inside = false; while ((q = q.parentElement)) { const cs = getComputedStyle(q); if (/auto|scroll|hidden/.test(cs.overflowX)) { inside = true; break; } } if (!inside) bad.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' ' + Math.round(b.left) + '..' + Math.round(b.right)); } }
      return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 6) };
    });
    res[name] = r; await p.screenshot({ path: OUT + '/m_' + name.replace(/\//g, '_') + '.png' });
  };
  await audit('home');
  for (const k of PAGES) { await p.goto(B + '/' + k, { waitUntil: 'domcontentloaded' }); await audit(k); }
  // صفحات بعد التفاعل: اختبار مولّد، وتحضير درس مفتوح
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-lid]'); await shut();
  for (const id of await p.$$eval('[data-lid]:not([disabled])', e => e.slice(0, 3).map(x => x.getAttribute('data-lid')))) await p.check(`[data-lid="${id}"]`);
  await p.click('#makeBtn'); await p.waitForSelector('#paper .qi'); await audit('quiz_made');
  await p.screenshot({ path: OUT + '/m_quiz_full.png', fullPage: true });
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500); await shut();
  const lb = await p.$('[data-lesson],.lesson-item,#lessonList button,#lessons button'); if (lb) { await lb.click().catch(()=>{}); await audit('app_lesson'); }
  let pass = 0, fail = 0; const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x ? '  → ' + x : '')); };
  for (const [k, v] of Object.entries(res)) ok('بلا تمرير أفقي: ' + k, v.sw <= v.W && !v.bad.length, v.bad.join(' | '));
  // واجهة التطبيق: شريط سفلي + عنوان القسم + القائمة كورقة سفلية + التحضير بلا إعادة تحميل
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); await shut();
  ok('شريط علوي بعنوان القسم', (await p.textContent('#atop .atop-t')) === 'التقويم والاختبارات');
  ok('الشريط السفلي ظاهر و«الاختبارات» نشط', await p.evaluate(() => { const r = document.getElementById('abar').getBoundingClientRect(); return r.bottom >= innerHeight - 1 && document.getElementById('abQuiz').classList.contains('on'); }));
  await p.click('#abMenu'); await p.waitForTimeout(300);
  ok('«الأقسام» تفتح القائمة كورقة سفلية', await p.evaluate(() => { const m = document.getElementById('menuList'); const r = m.getBoundingClientRect(); return !m.hidden && r.height > 200 && r.bottom <= innerHeight; }));
  await p.click('#abHome'); await p.waitForURL(/\/app$/); await p.waitForTimeout(1200); await shut();
  await p.click('#abPrep'); await p.waitForTimeout(500);
  ok('«التحضير» من الشريط يفتح شجرة الدروس', await p.evaluate(() => location.hash === '#prep' && !!document.querySelector('.welcome') && document.querySelector('#atop .atop-t').textContent === 'التحضير'));
  // الكمبيوتر بلا تغيير
  const pc = await (await b.newContext({ viewport: { width: 1366, height: 860 }, storageState: await c.storageState() })).newPage();
  await pc.goto(B + '/quiz', { waitUntil: 'domcontentloaded' }); await pc.waitForTimeout(800);
  ok('الموقع على الكمبيوتر بلا شريط تطبيق', !(await pc.$('#abar')) && await pc.isVisible('header.top'));
  ok('بلا أخطاء جافاسكربت', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(pass + ' pass, ' + fail + ' fail');
  await b.close(); process.exit(0);
})();
