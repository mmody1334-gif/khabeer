// يتحقق أن العلوم صف 7 يظهر فعليًا في: الاختبارات النهائية، الاختبارات القصيرة، والأنشطة الصفية.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
const KEY = 'العلوم|السابع';

const scrollAll = (p) => p.evaluate(async () => {
  const step = Math.round(window.innerHeight * 0.8);
  for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
  window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 300));
});
const imgStats = (p, sel) => p.evaluate(async (s) => {
  const imgs = [...document.querySelectorAll(s)];
  await Promise.all(imgs.map(im => im.complete ? null : new Promise(r => { const t = setTimeout(r, 5000); im.onload = im.onerror = () => { clearTimeout(t); r(); }; })));
  return { total: imgs.length, loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
           broken: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
           brokenSrc: imgs.filter(i => i.complete && i.naturalWidth === 0).slice(0, 2).map(i => i.getAttribute('src')) };
}, sel);

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await c.newPage();
  const errs = [], bad = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (/\/fin\/sci7/.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(-30)); });

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

  const pick = async (sel, subjSel, want) => p.evaluate(async ([s, ss, w]) => {
    const subj = document.getElementById(ss);
    const sel2 = document.getElementById(s);
    const sub = w.split('|')[0];
    if (subj && subj.tagName === 'SELECT' && subj.options.length > 1) {
      const o = [...subj.options].find(x => x.value === sub);
      if (o) { subj.value = sub; subj.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1100)); }
    }
    if (sel2 && [...sel2.options].some(x => x.value === w)) {
      sel2.value = w; sel2.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 2500)); return true;
    }
    return false;
  }, [sel, subjSel, want]);

  // ---------- (1) الاختبارات النهائية ----------
  console.log('\n===== الاختبارات النهائية (/finals) =====');
  await p.goto(B + '/finals', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#fside', { timeout: 25000 });
  await p.waitForTimeout(1500);
  const hasG7 = await pick('courseSel', 'courseSelSubj', KEY);
  ok('مقرر العلوم|السابع متاح في الاختبارات النهائية', hasG7, hasG7 ? 'موجود' : 'غير موجود');
  if (hasG7) {
    await p.waitForSelector('.fin-q', { timeout: 25000 });
    await p.waitForTimeout(1500);
    const chips = await p.$$eval('.fin-u', bs => bs.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    console.log('   الوحدات: ' + JSON.stringify(chips));
    ok('الوحدات الست ظاهرة', chips.length === 6, chips.length + ' وحدة');
    await scrollAll(p);
    const st = await imgStats(p, '.fin-q img');
    console.log('   صور الصفحة: ' + JSON.stringify(st));
    ok('أسئلة الصف السابع بصورها', st.total > 0 && st.broken === 0, `صور=${st.total} مكسورة=${st.broken}`);
    const header = await p.$eval('#fmain', d => d.innerText.slice(0, 90).replace(/\s+/g, ' '));
    console.log('   الترويسة: ' + header);
  }

  // ---------- (2) الاختبار القصير ----------
  console.log('\n===== الاختبار القصير (/quiz) =====');
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1200);
  const bank = await p.evaluate(async (k) => {
    const r = await fetch('/api/quiz/bank?key=' + encodeURIComponent(k));
    const j = await r.json();
    if (j.error) return { error: j.error };
    const fin = (j.items || []).filter(x => String(x.qid).startsWith('f'));
    return { lessons: (j.lessons || []).length, items: (j.items || []).length, fin: fin.length,
             withImg: fin.filter(x => x.img).length,
             types: [...new Set(fin.map(x => x.type))], marks: [...new Set(fin.map(x => x.marks))].sort() };
  }, KEY);
  console.log('   بنك الأسئلة: ' + JSON.stringify(bank));
  ok('بنك أسئلة الصف السابع متاح', !bank.error && bank.items > 0, JSON.stringify(bank).slice(0, 120));
  ok('أسئلة الامتحانات النهائية تدخل البنك', bank.fin > 0, bank.fin + ' مفردة');
  ok('كل أسئلة الوزارة بصور', bank.fin === bank.withImg, `${bank.withImg}/${bank.fin}`);
  ok('أنواع المفردات وفق الوثيقة (بلا طويلة)', !bank.types.includes('long'), JSON.stringify(bank.types));
  ok('درجات المفردات 1–2 فقط', bank.marks.every(m => m <= 2), JSON.stringify(bank.marks));
  // نكوّن اختبارًا فعليًا
  await pick('courseSel', 'courseSelSubj', KEY);
  const made = await p.evaluate(async () => {
    [...document.querySelectorAll('[data-lid]')].slice(0, 3).forEach(x => x.click());
    await new Promise(r => setTimeout(r, 400));
    const m = document.getElementById('makeBtn'); if (m) m.click();
    await new Promise(r => setTimeout(r, 3000));
    return document.querySelectorAll('#paper .qi').length;
  });
  await scrollAll(p);
  const qst = await imgStats(p, '#paper .qi img');
  console.log('   الورقة: %d سؤال، %d صورة', made, qst.total);
  ok('تكوين اختبار من دروس الصف السابع', made > 0, made + ' سؤال');
  ok('صور الورقة سليمة', qst.broken === 0, `مكسورة=${qst.broken} ${JSON.stringify(qst.brokenSrc)}`);

  // ---------- (3) الأنشطة الصفية ----------
  console.log('\n===== الأنشطة الصفية (/remedial) =====');
  await p.goto(B + '/remedial', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1200);
  const hasG7r = await pick('courseSel', 'courseSelSubj', KEY);
  ok('مقرر الصف السابع متاح في الخطط العلاجية', hasG7r, hasG7r ? 'موجود' : 'غير موجود');
  if (hasG7r) {
    await p.evaluate(async () => {
      const boxes = [...document.querySelectorAll('[data-lid]:not([disabled])')];
      boxes.slice(0, 2).forEach(x => x.click());
      await new Promise(r => setTimeout(r, 500));
      const m = document.getElementById('makeBtn'); if (m) m.click();
      await new Promise(r => setTimeout(r, 3000));
      const t = [...document.querySelectorAll('[data-part]')].find(x => x.getAttribute('data-part') === 'cls');
      if (t) { t.click(); await new Promise(r => setTimeout(r, 1200)); }
    });
    await scrollAll(p);
    const rst = await imgStats(p, '#paper img');
    console.log('   الأنشطة: ' + JSON.stringify(rst));
    ok('الأنشطة الصفية تُبنى بلا صور مكسورة', rst.broken === 0, `صور=${rst.total} مكسورة=${rst.broken}`);
  }

  ok('لا طلبات صور sci7 فاشلة', bad.length === 0, bad.slice(0, 3).join(' | ') || 'لا شيء');
  await p.screenshot({ path: require('path').join(__dirname, 'g7_site.png'), fullPage: true });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
