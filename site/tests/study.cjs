const { chromium } = require('playwright');
async function pickC(p, sel, key) { const s = key.split('|')[0]; if (await p.isVisible(sel + 'Subj')) { if (await p.inputValue(sel + 'Subj') !== s) { await p.selectOption(sel + 'Subj', s); await p.waitForTimeout(600); } } if (await p.inputValue(sel) !== key) await p.selectOption(sel, key); }
const B = 'http://localhost:8787', OUT = __dirname + '/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|TUNNEL/.test(m.text())) errs.push(m.text()); });
  await p.goto(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]');
  await p.waitForURL(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForURL(B + '/admin');
  console.log('admin nav visible:', await p.$$eval('.whobar > .btn, .whobar > a', e => e.filter(x => x.offsetParent).map(x => x.textContent.trim())));
  await p.goto(B + '/app'); await p.waitForSelector('#menuBtn');
  console.log('app nav visible:', await p.$$eval('.whobar > .btn, .whobar > a', e => e.filter(x => x.offsetParent).map(x => x.textContent.trim())));
  await p.click('#menuBtn'); await p.waitForTimeout(200);
  console.log('menu:', await p.$$eval('#menuList a, #menuList button', e => e.filter(x => !x.hidden).map(x => x.textContent.trim())));
  await p.screenshot({ path: OUT + 'n_menu.png' });
  await p.click('#menuList a[href="/remedial"]'); await p.waitForURL(B + '/remedial');
  await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'الأحياء|العاشر'); await p.waitForSelector('[data-lid]');
  const ids = await p.$$eval('[data-lid]:not([disabled])', e => e.slice(0, 2).map(x => x.getAttribute('data-lid')));
  for (const i of ids) await p.check(`[data-lid="${i}"]`);
  await p.fill('#h_teacher', 'محمد مجدي'); await p.dispatchEvent('#h_teacher', 'change');
  await p.click('#makeBtn'); await p.waitForSelector('#paper #stTbl');
  console.log('plan rows', await p.$$eval('#stTbl tbody tr', e => e.length), 'checked boxes', await p.$$eval('#paper .cb', e => e.filter(x => x.textContent === '☑').length));
  await p.click('#rowAdd'); console.log('after add', await p.$$eval('#stTbl tbody tr', e => e.length));
  const cb0 = await p.$('#paper .cb'); const before = await cb0.textContent(); await cb0.click(); console.log('cb toggle', before, '->', await cb0.textContent());
  await p.click('#paper h3'); await p.keyboard.press('End'); await p.keyboard.type(' (معدّل)');
  await p.screenshot({ path: OUT + 'r_plan.png', fullPage: true });
  await p.click('[data-part="sheet"]'); await p.waitForTimeout(200); console.log('sheet has edit?', (await p.textContent('#paper')).includes('النشاط 1'));
  await p.screenshot({ path: OUT + 'r_sheet.png', fullPage: true });
  await p.click('[data-part="plan"]'); console.log('edit kept:', (await p.textContent('#paper')).includes('(معدّل)'));
  // word
  await p.click('#wordBtn'); await p.click('#mOk'); const dl = await p.waitForEvent('download'); const fp = OUT + 'r_test.doc'; await dl.saveAs(fp);
  const doc = require('fs').readFileSync(fp, 'utf8'); console.log('word name', dl.suggestedFilename(), 'size', doc.length, 'has plan', doc.includes('نموذج خطة علاجية'), 'has edit', doc.includes('(معدّل)'), 'no contenteditable', !doc.includes('contenteditable'));
  // save + list
  await p.click('#saveBtn'); await p.waitForTimeout(500); console.log('saved list:', await p.$$eval('#savedList li', e => e.map(x => x.textContent.slice(0, 60))));
  // English remedial
  await pickC(p, '#courseSel', 'اللغة الإنجليزية|التاسع'); await p.waitForSelector('[data-lid]'); await p.check('[data-lid]:not([disabled]) >> nth=3');
  await p.click('#makeBtn'); await p.waitForSelector('#stTbl'); console.log('EN weak:', await p.$$eval('#paper td', e => e.filter(x => /Grammar|Vocabulary/.test(x.textContent)).map(x => x.textContent.trim()).slice(0, 3)));
  await p.click('[data-part="sheet"]'); await p.waitForTimeout(200); await p.screenshot({ path: OUT + 'r_sheet_en.png', fullPage: true });
  // summaries
  await p.goto(B + '/summaries'); await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'الأحياء|الثاني عشر'); await p.waitForSelector('[data-lid]');
  await p.check('[data-lid] >> nth=0'); await p.click('#makeBtn'); await p.waitForSelector('#paper h3');
  console.log('summary sections:', await p.$$eval('#paper b', e => e.map(x => x.textContent).slice(0, 6)));
  await p.screenshot({ path: OUT + 's_lesson.png', fullPage: true });
  await p.click('[data-sm="unit"]'); await p.click('#makeBtn'); await p.waitForSelector('#paper h3');
  console.log('unit summary h3:', await p.$$eval('#paper h3', e => e.map(x => x.textContent).slice(0, 8)));
  await p.screenshot({ path: OUT + 's_unit.png', fullPage: true });
  await p.click('#saveBtn'); await p.waitForTimeout(400); console.log('saved summaries:', await p.$$eval('#savedList li', e => e.length));
  // quiz list must not show remedial/summary
  await p.goto(B + '/quiz'); await p.waitForSelector('#savedList li'); await p.waitForTimeout(500); console.log('quiz saved list:', await p.$$eval('#savedList li', e => e.map(x => x.textContent.slice(0, 40))));
  // forced update: pretend an old tool is installed
  await p.goto(B + '/app'); await p.evaluate(() => document.documentElement.setAttribute('data-tahdir-tool', '2.9.0')); await p.waitForTimeout(3000);
  console.log('force modal:', await p.isVisible('#modal'), (await p.textContent('#modalBox')).slice(0, 60));
  await p.mouse.click(20, 880); await p.keyboard.press('Escape'); console.log('still locked:', await p.isVisible('#modal'));
  await p.screenshot({ path: OUT + 'n_force.png' });
  await p.goto(B + '/app'); await p.evaluate(() => document.documentElement.setAttribute('data-tahdir-tool', '9.9.9')); await p.waitForTimeout(3000); console.log('no modal for latest:', !(await p.isVisible('#modal')));
  // settings link from another page
  await p.goto(B + '/games#'); await p.click('a[href="/app#settings"]'); await p.waitForURL(B + '/app'); await p.waitForTimeout(600); console.log('settings opened:', (await p.textContent('#panel')).includes('تم'));
  // mobile menu
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, storageState: await c.storageState() }); const mp = await m.newPage();
  await mp.goto(B + '/remedial'); await mp.waitForSelector('#menuBtn'); await mp.screenshot({ path: OUT + 'n_mobile.png' }); await mp.click('#menuBtn'); await mp.waitForTimeout(200); await mp.screenshot({ path: OUT + 'n_mobile_menu.png' });
  console.log('errors', errs); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
