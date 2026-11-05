// أرقام الأشكال في صور أسئلة الاختبارات النهائية تتبع رقم السؤال في ورقة المعلم
// node tests/devserver.mjs 8787 &  ثم  node tests/fin_labels.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:8787', OUT = __dirname + '/';
const LIDS = (process.env.LIDS || '').split(',').filter(Boolean);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] }); const errs = [];
  const mk = async () => { const c = await b.newContext({ viewport: { width: 1360, height: 950 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const ap = await mk();
  await ap.goto(B + '/'); await ap.fill('#username', 'mohamed'); await ap.fill('#password', (process.env.TEST_PASS||'')); await ap.fill('#password2', (process.env.TEST_PASS||'')); await ap.click('#setupForm button[type=submit]');
  await ap.waitForURL(B + '/'); await ap.fill('#username', 'mohamed'); await ap.fill('#password', (process.env.TEST_PASS||'')); await ap.click('#loginBtn'); await ap.waitForURL(B + '/admin');
  await ap.evaluate(() => fetch('/api/admin/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'سالم، salim، 123456', scope: ['الأحياء|الثاني عشر'] }) }));
  const p = await mk();
  await p.goto(B + '/'); await p.fill('#username', 'salim'); await p.fill('#password', '123456'); await p.click('#loginBtn'); await p.waitForURL(B + '/app');
  await p.goto(B + '/quiz'); await p.waitForSelector('[data-lid]');
  for (const id of LIDS) if (await p.$(`[data-lid="${id}"]:not([disabled])`)) await p.check(`[data-lid="${id}"]`);
  await p.click('#makeBtn'); await p.waitForSelector('#paper .qi');
  let got = 0;
  for (let i = 0; i < 40 && !got; i++) {
    got = await p.$$eval('#paper img[data-fx]', e => e.length);
    if (!got) { await p.click('#remakeBtn'); await p.waitForTimeout(150); }
  }
  console.log('images needing a new figure number:', got);
  if (!got) { console.log('FAIL: none found'); process.exit(1); }
  await p.waitForFunction(() => [...document.querySelectorAll('#paper img[data-fx]')].every(i => i.src.startsWith('data:image/png')), null, { timeout: 15000 });
  const info = await p.$$eval('#paper img[data-fx]', e => e.map(i => ({ k: i.getAttribute('data-fx'), n: i.closest('.qi').querySelector('b').textContent })));
  console.log(info);
  const ok1 = info.every(x => x.k.split('|')[1] + ')' === x.n);
  const qi = await p.$('#paper img[data-fx]'); const qe = await qi.evaluateHandle(i => i.closest('.qi'));
  await qe.screenshot({ path: OUT + 'fin_label_q.png' });
  // نقل السؤال لأسفل: الرقم الجديد يتغيّر ويُرسم من جديد
  const i0 = await qe.evaluate(e => +e.getAttribute('data-i'));
  const last = await p.$$eval('#paper .qi', e => e.length - 1);
  await p.click(`[data-act="${i0 < last ? 'down' : 'up'}"][data-i="${i0}"]`);
  await p.waitForTimeout(300);
  await p.waitForFunction(() => [...document.querySelectorAll('#paper img[data-fx]')].every(i => i.src.startsWith('data:image/png')), null, { timeout: 15000 });
  const info2 = await p.$$eval('#paper img[data-fx]', e => e.map(i => ({ k: i.getAttribute('data-fx'), n: i.closest('.qi').querySelector('b').textContent })));
  const ok2 = info2.every(x => x.k.split('|')[1] + ')' === x.n);
  console.log(info2);
  // ملف Word: الصور المعدّلة تُرسل مضمَّنة
  const body = await p.evaluate(() => new Promise(res => { const o = window.fetch; window.fetch = function (u, opt) { if (/api\/export/.test(u)) { res(JSON.parse(opt.body).html); window.fetch = o; } return o.apply(this, arguments); }; document.getElementById('wordBtn').click(); setTimeout(() => { const ok = [...document.querySelectorAll('button')].find(x => /متابعة/.test(x.textContent)); ok && ok.click(); }, 300); }));
  const nData = (body.match(/src="data:image\/png/g) || []).length;
  console.log('word: embedded fixed images', nData, 'size', body.length);
  console.log(ok1 && ok2 && nData >= 1 && !errs.length ? 'PASS' : 'FAIL', errs);
  await b.close();
})();
