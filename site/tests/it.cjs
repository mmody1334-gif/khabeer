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
  await p.selectOption('#subjSel', 'تقنية المعلومات'); await p.waitForTimeout(200);
  console.log('IT grades:', await p.$$eval('.g-name', e => e.map(x => x.textContent)));
  await p.evaluate(() => { const el = [...document.querySelectorAll('.g-name')].find(x => x.textContent.includes('الخامس')); el.closest('button').click(); });
  await p.waitForTimeout(300); await p.click('.g-body.open .u-btn >> nth=0'); await p.click('.l-list.open .l-item >> nth=0'); await p.waitForSelector('#sendPrepBtn');
  console.log('lesson:', await p.inputValue('#f_title'));
  await p.screenshot({ path: OUT + 'it_lesson.png' });
  for (const [g, a, b2] of [['السادس', 0, 3], ['الثامن', 2, 5], ['التاسع', 0, 2], ['العاشر', 1, 3], ['الحادي عشر', 3, 5], ['الثاني عشر', 6, 9]]) {
    await p.goto(B + '/quiz'); await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'تقنية المعلومات|' + g); await p.waitForSelector('[data-lid]'); await p.waitForTimeout(300);
    const ids = await p.$$eval('[data-lid]:not([disabled])', (e, r) => e.slice(r[0], r[1]).map(x => x.getAttribute('data-lid')), [a, b2]); for (const i of ids) await p.check(`[data-lid="${i}"]`);
    await p.click('#makeBtn'); await p.waitForSelector('.checks'); await p.waitForTimeout(300); console.log('quiz IT', g, ids.join(','), (await p.textContent('.checks b')).trim());
  }
  await p.screenshot({ path: OUT + 'it_quiz.png', fullPage: true });
  await p.goto(B + '/games'); await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'تقنية المعلومات|الثاني عشر'); await p.waitForSelector('[data-unit]'); await p.check('[data-unit="2"]'); await p.waitForTimeout(200);
  console.log('IT12 games:', await p.$$eval('.g-card', e => e.slice(0, 8).map(x => x.querySelector('b').textContent + (x.classList.contains('off') ? '(off)' : ''))));
  await p.goto(B + '/games'); await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'تقنية المعلومات|السابع'); await p.waitForSelector('[data-unit]'); await p.check('[data-unit="1"]'); await p.waitForTimeout(200);
  console.log('IT7 games:', await p.$$eval('.g-card', e => e.slice(0, 8).map(x => x.querySelector('b').textContent + (x.classList.contains('off') ? '(off)' : ''))));
  await p.goto(B + '/summaries'); await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'تقنية المعلومات|الثامن'); await p.waitForSelector('[data-lid]');
  await p.check('[data-lid] >> nth=3'); await p.click('#makeBtn'); await p.waitForSelector('#paper h3'); console.log('IT8 summary:', (await p.textContent('#paper h3')).slice(0, 60));
  await p.screenshot({ path: OUT + 'it_summary.png', fullPage: false });
  await p.goto(B + '/remedial'); await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'تقنية المعلومات|التاسع'); await p.waitForSelector('[data-lid]');
  await p.check('[data-lid]:not([disabled]) >> nth=0'); await p.click('#makeBtn'); await p.waitForSelector('#stTbl');
  const t = await p.textContent('#paper'); console.log('remedial IT9 weak list IT:', t.includes('البرمجة وكتابة الشفرات'), 'science list absent:', !t.includes('الرسم العلمي'));
  await p.screenshot({ path: OUT + 'it_remedial.png', fullPage: false });
  console.log('errors', errs); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
