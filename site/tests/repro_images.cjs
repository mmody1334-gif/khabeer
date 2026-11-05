// فحص موسّع للصور: كل الصفوف، دروس أكثر، والأنشطة الصفية والملخصات — ونكشف أثر loading="lazy".
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

const scrollAll = async (p) => p.evaluate(async () => {
  const step = Math.round(window.innerHeight * 0.8);
  for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); }
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 400));
});

const imgStats = async (p, sel) => p.evaluate(async (s) => {
  const imgs = [...document.querySelectorAll(s)];
  await Promise.all(imgs.map(im => im.complete ? null : new Promise(r => { const t = setTimeout(r, 4000); im.onload = im.onerror = () => { clearTimeout(t); r(); }; })));
  return {
    total: imgs.length,
    loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
    broken: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
    lazy: imgs.filter(i => i.getAttribute('loading') === 'lazy').length,
    zeroSize: imgs.filter(i => i.getBoundingClientRect().width === 0).length,
    brokenSrc: imgs.filter(i => i.complete && i.naturalWidth === 0).slice(0, 3).map(i => i.getAttribute('src')),
  };
}, sel);

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await c.newPage();
  const errs = [], badReq = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (/\/fin\//.test(r.url()) && r.status() >= 400) badReq.push(r.status() + ' ' + r.url().slice(-40)); });
  p.on('requestfailed', r => { if (/\/fin\//.test(r.url())) badReq.push('FAIL ' + r.url().slice(-40)); });

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

  const setCourse = async (want) => p.evaluate(async (w) => {
    const subj = document.getElementById('courseSelSubj') || document.getElementById('subjSel');
    const sel = document.getElementById('courseSel');
    const s = w.split('|')[0];
    if (subj && subj.tagName === 'SELECT' && subj.options.length > 1) {
      const o = [...subj.options].find(x => x.value === s);
      if (o) { subj.value = s; subj.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1100)); }
    }
    if (sel && [...sel.options].some(x => x.value === w)) {
      sel.value = w; sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 2400)); return true;
    }
    return false;
  }, want);

  // ===== /quiz: كل مقرر له امتحانات نهائية =====
  console.log('\n===== الاختبار القصير (/quiz) =====');
  for (const key of ['العلوم|الخامس', 'العلوم|الثامن', 'الأحياء|التاسع', 'الأحياء|العاشر', 'الأحياء|الحادي عشر', 'الأحياء|الثاني عشر', 'الكيمياء|التاسع']) {
    await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#courseSel', { timeout: 25000 });
    await p.waitForTimeout(1200);
    if (!await setCourse(key)) { console.log('  (تخطّي ' + key + ': غير متاح)'); continue; }
    const mk = await p.evaluate(async () => {
      [...document.querySelectorAll('[data-lid]')].slice(0, 3).forEach(x => x.click());
      await new Promise(r => setTimeout(r, 400));
      const m = document.getElementById('makeBtn'); if (m) m.click();
      await new Promise(r => setTimeout(r, 3000));
      return document.querySelectorAll('#paper .qi').length;
    });
    await scrollAll(p);
    const st = await imgStats(p, '#paper .qi img');
    console.log(`  ${key.padEnd(24)} أسئلة=${mk} صور=${st.total} محمّلة=${st.loaded} مكسورة=${st.broken} lazy=${st.lazy} حجم0=${st.zeroSize}`);
    ok('  ' + key + ': لا صور مكسورة', st.broken === 0, JSON.stringify(st.brokenSrc));
    if (st.total > 0) ok('  ' + key + ': كل الصور تُرسم', st.loaded === st.total, `${st.loaded}/${st.total}`);
  }

  // ===== /remedial: الأنشطة الصفية بكل تبويباتها =====
  console.log('\n===== الخطط العلاجية (/remedial) =====');
  for (const key of ['العلوم|الثامن', 'الأحياء|التاسع', 'الكيمياء|التاسع']) {
    await p.goto(B + '/remedial', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#courseSel', { timeout: 25000 });
    await p.waitForTimeout(1200);
    if (!await setCourse(key)) { console.log('  (تخطّي ' + key + ')'); continue; }
    await p.evaluate(async () => {
      [...document.querySelectorAll('[data-lid]:not([disabled])')].slice(0, 2).forEach(x => x.click());
      await new Promise(r => setTimeout(r, 500));
      const m = document.getElementById('makeBtn'); if (m) m.click();
      await new Promise(r => setTimeout(r, 3000));
    });
    const parts = await p.$$eval('[data-part]', bs => bs.map(x => x.getAttribute('data-part')));
    for (const part of parts) {
      await p.evaluate(async (pt) => {
        const t = [...document.querySelectorAll('[data-part]')].find(x => x.getAttribute('data-part') === pt);
        if (t) { t.click(); await new Promise(r => setTimeout(r, 900)); }
      }, part);
      await scrollAll(p);
      const st = await imgStats(p, '#paper img');
      if (st.total > 0 || st.broken > 0) {
        console.log(`  ${key.padEnd(20)} تبويب=${part.padEnd(7)} صور=${st.total} محمّلة=${st.loaded} مكسورة=${st.broken} lazy=${st.lazy}`);
        ok('  ' + key + '/' + part + ': لا صور مكسورة', st.broken === 0, JSON.stringify(st.brokenSrc));
        if (st.total > 0) ok('  ' + key + '/' + part + ': كل الصور تُرسم', st.loaded === st.total, `${st.loaded}/${st.total}`);
      } else {
        console.log(`  ${key.padEnd(20)} تبويب=${part.padEnd(7)} (بلا صور)`);
      }
    }
  }

  // ===== /summaries =====
  console.log('\n===== الملخصات (/summaries) =====');
  await p.goto(B + '/summaries', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1200);
  if (await setCourse('الأحياء|التاسع')) {
    await p.evaluate(async () => {
      [...document.querySelectorAll('[data-lid]:not([disabled])')].slice(0, 2).forEach(x => x.click());
      await new Promise(r => setTimeout(r, 500));
      const m = document.getElementById('makeBtn'); if (m) m.click();
      await new Promise(r => setTimeout(r, 3000));
    });
    await scrollAll(p);
    const st = await imgStats(p, '#paper img');
    console.log(`  الأحياء|التاسع صور=${st.total} مكسورة=${st.broken}`);
    ok('  الملخصات: لا صور مكسورة', st.broken === 0, JSON.stringify(st.brokenSrc));
  }

  ok('لا طلبات صور فاشلة على الإطلاق', badReq.length === 0, badReq.slice(0, 4).join(' | ') || 'لا شيء');
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
