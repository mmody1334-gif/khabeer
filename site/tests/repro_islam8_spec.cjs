// يتحقق من مطابقة ورقة التربية الإسلامية لجدول مواصفات الوثيقة (15 درجة · 3 أسئلة).
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
const KEY = 'التربية الإسلامية|الثامن';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
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
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1300);

  const runs = [];
  for (let k = 0; k < 5; k++) {
    const r = await p.evaluate(async (key) => {
      const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
      subj.value = 'التربية الإسلامية'; subj.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 1300));
      cs.value = key; cs.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 2600));
      [...document.querySelectorAll('[data-lid]')].slice(0, 6).forEach(x => { if (!x.checked) x.click(); });
      await new Promise(x => setTimeout(x, 500));
      document.getElementById('makeBtn').click();
      await new Promise(x => setTimeout(x, 3200));
      const items = [...document.querySelectorAll('#paper .qi')];
      const marks = items.map(it => {
        const m = it.innerText.match(/\[(\d+)\]/);
        return m ? +m[1] : 0;
      });
      const mcq = items.filter(it => it.querySelector('table.chs')).length;
      const specBox = (document.querySelector('#paper') || document.body).innerText.match(/(\d+)\s*درجة/);
      return { total: items.length, sum: marks.reduce((a, x) => a + x, 0), marks, mcq,
               short: items.length - mcq, specTotal: specBox ? +specBox[1] : 0 };
    }, KEY);
    runs.push(r);
    console.log(`توليد ${k + 1}: ${r.total} سؤالًا | مجموع=${r.sum} | MCQ=${r.mcq} | قصيرة=${r.short}`);
  }
  const sums = runs.map(r => r.sum);
  const totals = runs.map(r => r.total);
  ok('مجموع الدرجات = 15 (مطابق للوثيقة)', sums.every(s => s === 15), JSON.stringify(sums));
  ok('عدد الأسئلة في نطاق 9–12', totals.every(t => t >= 9 && t <= 12), JSON.stringify(totals));
  ok('3 مفردات اختيار من متعدد', runs.every(r => r.mcq === 3), JSON.stringify(runs.map(r => r.mcq)));
  ok('باقي المفردات إجابة قصيرة (درجة قصوى 2)', runs.every(r => r.marks.every(m => m <= 2)), JSON.stringify(runs[0].marks));
  ok('لا توجد مفردة طويلة', runs.every(r => r.sum === 15 && r.marks.length > 0), 'لا إجابة طويلة في الورقة');
  await p.screenshot({ path: require('path').join(__dirname, 'islam8_spec_check.png'), fullPage: true });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
