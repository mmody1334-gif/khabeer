// اختبار شامل: صفحة التقويم + لوحة التحكم الجديدة (تقرير، مواد ودروس، صفوف مسموحة)
const { chromium } = require('playwright');
async function pickC(p, sel, key) { const s = key.split('|')[0]; if (await p.isVisible(sel + 'Subj')) { if (await p.inputValue(sel + 'Subj') !== s) { await p.selectOption(sel + 'Subj', s); await p.waitForTimeout(600); } } if (await p.inputValue(sel) !== key) await p.selectOption(sel, key); }
const B = 'http://localhost:8787', OUT = __dirname + '/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (o = {}) => { const c = await b.newContext({ viewport: { width: 1360, height: 950 }, acceptDownloads: true, ...o }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push(m.text()); }); return [c, p]; };
  const [ac, ap] = await mk();
  await ap.goto(B + '/'); await ap.fill('#username', 'mohamed'); await ap.fill('#password', (process.env.TEST_PASS||'')); await ap.fill('#password2', (process.env.TEST_PASS||'')); await ap.click('#setupForm button[type=submit]');
  await ap.waitForURL(B + '/'); await ap.fill('#username', 'mohamed'); await ap.fill('#password', (process.env.TEST_PASS||'')); await ap.click('#loginBtn'); await ap.waitForURL(B + '/admin');
  // teachers: one with grade 11+12 only, one for grade 5
  const imp = await ap.evaluate(() => fetch('/api/admin/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'سالم، salim، 123456', scope: ['الأحياء|الحادي عشر', 'الأحياء|الثاني عشر'] }) }).then(r => r.json()));
  console.log('import', imp.done.length, imp.errors);
  await ap.evaluate(() => fetch('/api/admin/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'حمادة، hamada، 121212', scope: ['العلوم|الخامس'] }) }));
  // new course + lesson
  await ap.reload(); await ap.waitForSelector('.kpis');
  await ap.click('[data-tab="courses"]'); await ap.click('#addCourse'); await ap.fill('#c_subj', 'الكيمياء'); await ap.selectOption('#c_grade', 'الحادي عشر'); await ap.click('#mOk');
  await ap.waitForSelector('#addLesson'); await ap.click('#addLesson');
  await ap.fill('#l_uname', 'المادة وخصائصها'); await ap.fill('#l_title', 'الذرة وتركيبها'); await ap.fill('#l_concepts', 'البروتون، النيوترون، الإلكترون'); await ap.fill('#l_outcomes', 'يصف تركيب الذرة'); await ap.fill('#l_hw_q1', 'ما مكونات النواة؟'); await ap.fill('#l_hw_a1', 'البروتونات والنيوترونات');
  await ap.click('#mOk'); await ap.waitForTimeout(600);
  await ap.screenshot({ path: OUT + 'q_admin_courses.png', fullPage: true });
  // give salim chemistry too
  const st = await ap.evaluate(() => fetch('/api/admin/stats').then(r => r.json()));
  const salim = st.users.find(u => u.username === 'salim');
  await ap.evaluate(id => fetch('/api/admin/teachers/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scope', value: ['الأحياء|الحادي عشر', 'الأحياء|الثاني عشر', 'الكيمياء|الحادي عشر'] }) }).then(r => r.json()), salim.id);

  // ---- teacher salim
  const [c1, p1] = await mk();
  await p1.goto(B + '/'); await p1.fill('#username', 'salim'); await p1.fill('#password', '123456'); await p1.click('#loginBtn'); await p1.waitForURL(B + '/app');
  await p1.waitForSelector('.g-btn');
  console.log('salim grades in tree:', await p1.$$eval('.g-name', e => e.map(x => x.textContent)));
  // custom chemistry lesson prep json
  const chemBtn = (await p1.$$('.g-btn')).length; console.log('tree blocks', chemBtn);
  // open quiz page
  await p1.click('#menuBtn'); await p1.click('#menuList a[href="/quiz"]'); await p1.waitForURL(B + '/quiz'); await p1.waitForSelector('#courseSel');
  console.log('quiz courses:', await p1.$$eval('#courseSel option', o => o.map(x => x.textContent)));
  await pickC(p1, '#courseSel', 'الأحياء|الحادي عشر'); await p1.waitForSelector('[data-lid]');
  const lids = await p1.$$eval('[data-lid]:not([disabled])', e => e.slice(0, 3).map(x => x.getAttribute('data-lid')));
  for (const id of lids) await p1.check(`[data-lid="${id}"]`);
  await p1.click('#makeBtn'); await p1.waitForSelector('#paper .qi');
  console.log('checks:', await p1.$eval('.checks', e => e.innerText.replace(/\s+/g, ' ')));
  await p1.screenshot({ path: OUT + 'q_quiz11.png', fullPage: true });
  // run 30 assemblies to measure compliance
  const stats = await p1.evaluate(async () => { let ok = 0; for (let i = 0; i < 30; i++) { document.getElementById('remakeBtn').click(); await new Promise(r => setTimeout(r, 20)); if (document.querySelector('.checks.ok')) ok++; } return ok; });
  console.log('grade 11 compliant assemblies: ' + stats + '/30');
  await p1.click('[data-act="swap"] >> nth=0'); await p1.waitForTimeout(200);
  await p1.click('[data-act="edit"] >> nth=0'); await p1.waitForSelector('#e_stem'); await p1.fill('#e_stem', 'مفردة معدلة من المعلم **للاختبار**'); await p1.click('#mOk');
  console.log('edited first item:', (await p1.textContent('#paper .qi >> nth=0')).slice(0, 80));
  await p1.click('[data-pv="key"]'); await p1.waitForSelector('.keyt'); await p1.screenshot({ path: OUT + 'q_key11.png', fullPage: true });
  await p1.click('#saveBtn'); await p1.waitForTimeout(500);
  console.log('saved list:', await p1.$$eval('#savedList li', e => e.map(x => x.innerText.replace(/\s+/g, ' '))));
  // word download
  await p1.click('#wordBtn'); await p1.waitForSelector('input[name=pp]');
  const [dl] = await Promise.all([p1.waitForEvent('download'), p1.click('#mOk')]);
  await dl.saveAs(OUT + 'q_test.doc'); console.log('word file:', dl.suggestedFilename());
  // mobile + in-app: server export links
  { const [cm, pm] = await mk({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36 TahdirApp/1', storageState: await c1.storageState() });
    await pm.goto(B + '/quiz'); await pm.waitForSelector('[data-lid]');
    await pm.evaluate(() => { const b = document.querySelector('[data-open]'); });
    await pm.click('#savedList [data-open]'); await pm.waitForSelector('#paper .qi');
    await pm.click('#wordBtn'); await pm.waitForSelector('input[name=pp]');
    const [d2] = await Promise.all([pm.waitForEvent('download'), pm.click('#mOk')]);
    console.log('in-app word:', d2.suggestedFilename(), d2.url().replace(/[a-f0-9]{40}/, 'ID'));
    await pm.click('#printBtn'); await pm.waitForSelector('input[name=pp]');
    const [d3] = await Promise.all([pm.waitForEvent('download'), pm.click('#mOk')]);
    console.log('in-app print ->', d3.suggestedFilename());
    const u = d3.url(); const plain = await b.newContext(); const pp = await plain.newPage(); await pp.goto(u); await pp.waitForSelector('.pg');
    console.log('print page in Chrome: pages', await pp.$$eval('.pg', e => e.length), 'has button', !!(await pp.$('#pr')));
    await pp.screenshot({ path: OUT + 'q_printpage.png' }); await plain.close(); await cm.close(); }
  // print area
  await p1.evaluate(() => { window.print = () => { window.__printed = document.getElementById('printArea').innerText.length; }; });
  await p1.click('#printBtn'); await p1.click('#mOk'); await p1.waitForTimeout(300);
  console.log('print area chars:', await p1.evaluate(() => window.__printed));
  await p1.emulateMedia({ media: 'print' });
  // grade 12 quiz
  await p1.emulateMedia({ media: 'screen' });
  await pickC(p1, '#courseSel', 'الأحياء|الثاني عشر'); await p1.waitForTimeout(900); await p1.waitForSelector('[data-lid]');
  const l12 = await p1.$$eval('[data-lid]:not([disabled])', e => e.slice(5, 9).map(x => x.getAttribute('data-lid')));
  for (const id of l12) await p1.check(`[data-lid="${id}"]`);
  await p1.click('#makeBtn'); await p1.waitForSelector('#paper .qi');
  const ok12 = await p1.evaluate(async () => { let ok = 0; for (let i = 0; i < 30; i++) { document.getElementById('remakeBtn').click(); await new Promise(r => setTimeout(r, 20)); if (document.querySelector('.checks.ok')) ok++; } return ok; });
  console.log('grade 12 compliant assemblies: ' + ok12 + '/30');
  // review
  await p1.click('[data-mode="review"]'); await p1.selectOption('#rcSel', '20'); await p1.click('#makeBtn'); await p1.waitForSelector('#paper .qi');
  console.log('review items:', await p1.$$eval('#paper .qi', e => e.length), 'lessons headings:', await p1.$$eval('#paper h4', e => e.length));
  await p1.screenshot({ path: OUT + 'q_review12.png' });
  // scope enforcement
  console.log('salim bank grade5 status:', await p1.evaluate(() => fetch('/api/quiz/bank?key=' + encodeURIComponent('العلوم|الخامس')).then(r => r.status)));
  const ls = await p1.evaluate(() => fetch('/api/lessons').then(r => r.json()));
  console.log('salim lesson count', ls.lessons.length, 'grades', [...new Set(ls.lessons.map(l => l.subject + '|' + l.grade))]);

  // ---- hamada grade 5 (mobile)
  const [c2, p2] = await mk({ viewport: { width: 390, height: 844 }, isMobile: true });
  await p2.goto(B + '/'); await p2.fill('#username', 'hamada'); await p2.fill('#password', '121212'); await p2.click('#loginBtn'); await p2.waitForURL(B + '/app');
  await p2.goto(B + '/quiz'); await p2.waitForSelector('[data-lid]');
  const l5 = await p2.$$eval('[data-lid]:not([disabled])', e => e.slice(0, 3).map(x => x.getAttribute('data-lid')));
  for (const id of l5) await p2.check(`[data-lid="${id}"]`);
  await p2.click('#makeBtn'); await p2.waitForSelector('#paper .qi');
  console.log('grade5 checks:', await p2.$eval('.checks', e => e.innerText.replace(/\s+/g, ' ')));
  const ok5 = await p2.evaluate(async () => { let ok = 0; for (let i = 0; i < 30; i++) { document.getElementById('remakeBtn').click(); await new Promise(r => setTimeout(r, 20)); if (document.querySelector('.checks.ok')) ok++; } return ok; });
  console.log('grade 5 compliant: ' + ok5 + '/30');
  await p2.screenshot({ path: OUT + 'q_mobile5.png', fullPage: true });
  const sw = await p2.evaluate(() => document.documentElement.scrollWidth); console.log('mobile scrollWidth', sw);

  // ---- admin: grades 9 & 10 compliance
  await ap.goto(B + '/quiz'); await ap.waitForSelector('#courseSel');
  for (const g of ['الأحياء|التاسع', 'الأحياء|العاشر']) {
    for (const tot of ['x']) {
      await pickC(ap, '#courseSel', g); await ap.waitForSelector('[data-lid]'); await ap.waitForTimeout(200);
      const ids = await ap.$$eval('[data-lid]:not([disabled])', e => e.slice(0, 3).map(x => x.getAttribute('data-lid')));
      for (const id of ids) await ap.check(`[data-lid="${id}"]`);
      await ap.click('#makeBtn'); await ap.waitForSelector('#paper .qi');
      const ok = await ap.evaluate(async () => { let ok = 0, bad = ''; for (let i = 0; i < 30; i++) { document.getElementById('remakeBtn').click(); await new Promise(r => setTimeout(r, 20)); if (document.querySelector('.checks.ok')) ok++; else bad = document.querySelector('.checks').innerText; } return ok + ' ' + bad.replace(/\s+/g, ' ').slice(0, 300); });
      console.log(g, tot, 'compliant:', ok);
    }
  }
  await ap.screenshot({ path: OUT + 'q_quiz10.png', fullPage: true });
  await ap.goto(B + '/admin');
  // ---- admin report
  await ap.reload(); await ap.waitForSelector('.kpis'); await ap.click('[data-tab="report"]'); await ap.waitForSelector('#csvBtn');
  console.log('report rows:', await ap.$$eval('.tbl tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')).slice(0, 3)));
  await ap.screenshot({ path: OUT + 'q_report.png', fullPage: true });
  const [dl2] = await Promise.all([ap.waitForEvent('download'), ap.click('#csvBtn')]); console.log('csv:', dl2.suggestedFilename());
  console.log('errors', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
