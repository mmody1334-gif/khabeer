// يقيس نسبة أسئلة الوزارة بصورها في الاختبار القصير عبر توليدات متعددة.
// يفشل إن هبطت النسبة تحت الحد الأدنى (انحدار في ترجيح الصور داخل shuffleP).
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await c.newPage();
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

  const runs = [];
  for (let k = 0; k < 8; k++) {
    await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#courseSel', { timeout: 25000 });
    await p.waitForTimeout(1000);
    const r = await p.evaluate(async () => {
      const subj = document.getElementById('courseSelSubj'), sel = document.getElementById('courseSel');
      const o = [...subj.options].find(x => x.value === 'العلوم');
      if (o) { subj.value = 'العلوم'; subj.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1000)); }
      if ([...sel.options].some(x => x.value === 'العلوم|السابع')) {
        sel.value = 'العلوم|السابع'; sel.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 2200));
      }
      // نختار كل دروس الوحدة الأولى (أكثر درسًا فيها أسئلة وزارة)
      [...document.querySelectorAll('[data-lid]')].slice(0, 6).forEach(x => x.click());
      await new Promise(r => setTimeout(r, 500));
      const mk = document.getElementById('makeBtn'); if (mk) mk.click();
      await new Promise(r => setTimeout(r, 3000));
      const items = [...document.querySelectorAll('#paper .qi')];
      return {
        total: items.length,
        img: items.filter(x => x.querySelector('img')).length,
        mcq: items.filter(x => /اختيار من متعدد/.test(x.innerText)).length,
      };
    });
    runs.push(r);
    console.log(`توليد ${k + 1}: ${r.total} سؤال | بصور=${r.img} | اختيار من متعدد=${r.mcq}`);
  }
  const n = runs.length;
  const avgImg = runs.reduce((a, x) => a + x.img, 0) / n;
  const avgTot = runs.reduce((a, x) => a + x.total, 0) / n;
  const pct = runs.reduce((a, x) => a + x.img, 0) / runs.reduce((a, x) => a + x.total, 0) * 100;
  const minImg = Math.min(...runs.map(x => x.img));
  console.log('\nالمتوسط: ' + avgTot.toFixed(1) + ' سؤالًا | بصور=' + avgImg.toFixed(1) + ' | نسبة الصور=' + pct.toFixed(0) + '% | أقل توليد=' + minImg);
  const bad = runs.filter(x => x.img < 3);
  console.log(bad.length ? '  FAIL  كل توليد فيه 3 صور وزارية على الأقل  → إخفاقات: ' + bad.length : '  PASS  كل توليد فيه 3 صور وزارية على الأقل  → الحد الأدنى ' + minImg);
  console.log(pct >= 30 ? '  PASS  نسبة الصور ≥ 30%  → ' + pct.toFixed(0) + '%' : '  FAIL  نسبة الصور ≥ 30%  → ' + pct.toFixed(0) + '%');
  const okAll = bad.length === 0 && pct >= 30;
  console.log('\\n=== ' + (okAll ? 'ناجح' : 'فاشل') + ' ===');
  process.exit(okAll ? 0 : 1);
  await b.close(); srv.stop();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
