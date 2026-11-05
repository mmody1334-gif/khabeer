const { chromium } = require('playwright');
const B = 'http://localhost:8787';
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1300, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]');
  await p.waitForURL(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForURL(B + '/admin');
  await p.goto(B + '/app'); await p.waitForSelector('#subjSel'); console.log('subjects:', await p.$$eval('#subjSel option', e => e.map(x => x.textContent)));
  console.log('sci grades:', await p.$$eval('.g-name', e => e.map(x => x.textContent)));
  await p.selectOption('#subjSel', 'اللغة الإنجليزية'); await p.waitForTimeout(200);
  console.log('en grades:', await p.$$eval('.g-name', e => e.map(x => x.textContent)));
  await p.click('.g-btn'); console.log('units:', await p.$$eval('.u-name', e => e.map(x => x.textContent)));
  await p.click('.u-btn >> nth=1'); await p.click('.l-list.open .l-item >> nth=2');
  await p.waitForSelector('#f_concepts'); console.log('dir:', await p.getAttribute('#f_concepts', 'dir'), 'title:', await p.inputValue('#f_title'));
  console.log('has weekly field:', !!(await p.$('#f_weekly')));
  await p.click('#copyJsonBtn'); await p.waitForTimeout(300);
  const j = JSON.parse(await p.evaluate(() => navigator.clipboard.readText()));
  console.log('prep:', j.subject, j.grade, 'unit', j.unit, 'lesson_no', j.lesson_no, 'term', j.term, '| objective:', j.objective.slice(0, 80), '| weekly:', (j.fields.weekly_study_plan_comments || '').slice(0, 60), '| selects:', JSON.stringify(j.selects));
  await p.click('[data-ltab="hw"]'); await p.click('#copyHwBtn'); await p.waitForTimeout(300);
  const h = JSON.parse(await p.evaluate(() => navigator.clipboard.readText()));
  console.log('hw:', h.subject, h.unit, h.lesson_no, h.items.map(i => i.type + ':' + i.text.slice(0, 50) + ' => ' + i.answer + ' @' + i.correct));
  await p.screenshot({ path: __dirname + '/en_lesson.png' });
  // Starter lesson
  await p.click('[data-ltab="prep"]'); await p.click('.u-btn >> nth=0'); await p.click('.l-list.open .l-item >> nth=0'); await p.click('#copyJsonBtn'); await p.waitForTimeout(300);
  const s = JSON.parse(await p.evaluate(() => navigator.clipboard.readText())); console.log('starter:', s.unit, s.lesson_no, s.title);
  // quiz page hides English
  await p.goto(B + '/quiz'); await p.waitForSelector('#courseSel'); console.log('quiz courses:', await p.$$eval('#courseSel option', o => o.map(x => x.textContent)));
  console.log('errors', errs); await b.close();
})();
