// المواد الجديدة: اختيار المادة، تحضير درس كيمياء، اختبار قصير، ألعاب، ملخص
const { chromium } = require('playwright');
async function pickC(p, sel, key) { const s = key.split('|')[0]; if (await p.isVisible(sel + 'Subj')) { if (await p.inputValue(sel + 'Subj') !== s) { await p.selectOption(sel + 'Subj', s); await p.waitForTimeout(600); } } if (await p.inputValue(sel) !== key) await p.selectOption(sel, key); }
const B = 'http://localhost:8787', OUT = __dirname + '/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]');
  await p.waitForURL(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForURL(B + '/admin');
  await p.goto(B + '/app'); await p.waitForSelector('#subjSel');
  console.log('subjects:', await p.$$eval('#subjSel option', e => e.map(x => x.textContent)));
  await p.selectOption('#subjSel', 'الكيمياء'); await p.waitForTimeout(200);
  console.log('chem grades:', await p.$$eval('.g-name', e => e.map(x => x.textContent)));
  await p.screenshot({ path: OUT + 'sub_tree.png' });
  await p.evaluate(() => { const el = [...document.querySelectorAll('.g-name')].find(x => x.textContent.includes('الحادي عشر')); el.closest('button').click(); });
  await p.waitForTimeout(300); await p.click('.g-body.open .u-btn >> nth=0'); await p.click('.l-list.open .l-item >> nth=0'); await p.waitForSelector('#sendPrepBtn');
  console.log('lesson:', await p.inputValue('#f_title'), '| concepts:', (await p.textContent('#panel')).includes('عدد الكتلة') || (await p.textContent('#panel')).slice(0, 0));
  await p.screenshot({ path: OUT + 'sub_lesson.png', fullPage: false });
  // quiz
  await p.goto(B + '/quiz'); await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'الكيمياء|الحادي عشر'); await p.waitForSelector('[data-lid]');
  const ids = await p.$$eval('[data-lid]:not([disabled])', e => e.slice(0, 3).map(x => x.getAttribute('data-lid'))); for (const i of ids) await p.check(`[data-lid="${i}"]`);
  await p.click('#makeBtn'); await p.waitForSelector('.checks'); console.log('quiz chem11 checks:', (await p.textContent('.checks b')).trim());
  await pickC(p, '#courseSel', 'العلوم|الثامن'); await p.waitForSelector('[data-lid]'); await p.waitForTimeout(300);
  const ids8 = await p.$$eval('[data-lid]:not([disabled])', e => e.slice(4, 7).map(x => x.getAttribute('data-lid'))); for (const i of ids8) await p.check(`[data-lid="${i}"]`);
  await p.click('#makeBtn'); await p.waitForTimeout(500); console.log('quiz sci8 checks:', (await p.textContent('.checks b')).trim());
  await p.screenshot({ path: OUT + 'sub_quiz8.png', fullPage: true });
  // games chem10 teen
  await p.goto(B + '/games'); await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'الكيمياء|العاشر'); await p.waitForSelector('[data-unit]'); await p.check('[data-unit="6"]'); await p.waitForTimeout(200);
  console.log('chem10 games:', await p.$$eval('.g-card', e => e.slice(0, 6).map(x => x.querySelector('b').textContent + (x.classList.contains('off') ? '(off)' : ''))));
  // summaries env12
  await p.goto(B + '/summaries'); await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'العلوم البيئية|الثاني عشر'); await p.waitForSelector('[data-lid]');
  await p.check('[data-lid] >> nth=2'); await p.click('#makeBtn'); await p.waitForSelector('#paper h3'); console.log('env12 summary:', (await p.textContent('#paper h3')).slice(0, 60));
  await p.goto(B + '/remedial'); await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'الكيمياء|التاسع'); await p.waitForSelector('[data-lid]');
  await p.check('[data-lid]:not([disabled]) >> nth=0'); await p.click('#makeBtn'); await p.waitForSelector('#stTbl'); console.log('remedial chem9 ok');
  console.log('errors', errs); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
