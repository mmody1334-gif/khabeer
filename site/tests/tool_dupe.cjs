// يحاكي Tampermonkey على الموقع: نسخة قديمة مكررة + الجديدة، بالترتيبين
const { chromium } = require('playwright'); const fs = require('fs');
const B = 'http://localhost:8787';
const fix = s => s.replace("location.hostname === 'khabeer.khabeer.workers.dev'", 'true');
const NEW = fix(fs.readFileSync(__dirname + '/../server/tahdir-noor.user.js', 'utf8')), OLD = fix(fs.readFileSync(__dirname + '/old_tool_29.js', 'utf8'));
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 1300, height: 850 }, bypassCSP: true }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('framenavigated', f => { if (f === p.mainFrame()) console.log('nav', f.url()); });
  await p.goto(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]');
  await p.waitForURL(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForURL(B + '/admin');
  let scripts = [];
  const opened = [];
  await c.exposeBinding('__opened', (_, who, u) => opened.push(who + ' ' + u));
  // كل نسخة في نطاق مستقل مثل Tampermonkey، وكل واحدة تخزينها منفصل
  await p.addInitScript(() => { window.__runTools = (list) => list.forEach(([who, src, delay]) => setTimeout(() => { const S = {}; const f = new Function('GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_openInTab', 'GM_registerMenuCommand', 'unsafeWindow', src);
    f((k, d) => (k in S ? S[k] : d), (k, v) => { S[k] = v; }, k => { delete S[k]; }, (u) => window.__opened(who, u), () => {}, window); }, delay)); });
  const load = async (list, url = '/app') => { await p.goto(B + url); await p.evaluate(l => window.__runTools(l), list); await p.waitForTimeout(4000); };
  const state = async () => ({ url: p.url(), attr: await p.evaluate(() => document.documentElement.getAttribute('data-tahdir-tool')), old: await p.evaluate(() => document.documentElement.getAttribute('data-tahdir-tool-old')), modal: await p.isVisible('#modal'), title: (await p.textContent('#modalBox')).slice(0, 40) });
  await load([['old', OLD, 0]]); console.log('old only:', await state());
  await p.click('#mOk').catch(() => {}); await p.waitForTimeout(300);
  await load([['old', OLD, 0]]); console.log('old only after clicking update (still old):', await state());
  await load([['old', OLD, 0], ['new', NEW, 300]]); console.log('new after old (dup):', await state());
  await load([['new', NEW, 0], ['old', OLD, 300]]); console.log('old after new (dup):', await state());
  await load([['old', OLD, 0], ['new', NEW, 2900]]); console.log('new late (Firefox):', await state());
  await load([['new', NEW, 0], ['new2', NEW, 100]]); console.log('two new copies:', await state());
  // send with duplicates: only one copy opens Nour
  await load([['old', OLD, 0], ['new', NEW, 100], ['new2', NEW, 200]]);
  await p.click('.tree .g-head >> nth=1').catch(() => {});
  const lid = await p.evaluate(() => fetch('/api/lessons').then(r => r.json()).then(j => j.lessons.find(l => l.grade === 'العاشر').id));
  opened.length = 0;
  await p.evaluate(() => { const el = [...document.querySelectorAll('.tree *')].find(x => x.textContent.trim() === 'القلب'); el && el.click(); });
  await p.waitForSelector('#sendPrepBtn', { timeout: 8000 }); await p.click('#sendPrepBtn'); await p.waitForTimeout(800);
  console.log('opened tabs on send:', opened, 'toast:', await p.textContent('#toast'));
  console.log('errors', errs); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
