// يختبر إضافة المتصفح الحقيقية (dist/ext_test) في Chromium: الموقع يتعرف عليها والإرسال يفتح نور ويوجّه للصف
const { chromium } = require('playwright'); const os = require('os'); const fs = require('fs');
const B = 'http://localhost:8787', EXT = __dirname + '/../dist/ext_test';
const NOUR_HOME = `<html><body><h1>الرئيسية</h1><nav id=sb></nav><script>setTimeout(()=>{sb.innerHTML='<a href="/teacher/courses/browse_content/cid:111">الاحياء / التاسع</a><a href="/teacher/courses/browse_content/cid:222">الاحياء / العاشر</a><a href="/teacher/courses/browse_content/cid:666">العلوم / السادس</a>'},800)</script></body></html>`;
(async () => {
  const dir = fs.mkdtempSync(os.tmpdir() + '/ext-');
  const c = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 }, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const errs = []; const visited = [];
  await c.route('https://lms.moe.gov.om/**', r => { visited.push(r.request().url()); r.fulfill({ contentType: 'text/html; charset=utf-8', body: /add_preparation/.test(r.request().url()) ? '<html><body><h2>إضافة تحضير</h2></body></html>' : NOUR_HOME }); });
  let sw = c.serviceWorkers()[0]; if (!sw) sw = await c.waitForEvent('serviceworker', { timeout: 10000 });
  console.log('extension loaded:', sw.url().split('/')[2].length === 32);
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]');
  await p.waitForURL(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForURL(B + '/admin');
  await p.goto(B + '/app'); await p.waitForTimeout(3000);
  console.log('site sees:', await p.evaluate(() => [document.documentElement.getAttribute('data-tahdir-tool'), document.documentElement.getAttribute('data-tahdir-ext')]), 'modal:', await p.isVisible('#modal'), 'tool btn:', await p.textContent('#toolBtn'));
  await p.evaluate(() => { const el = [...document.querySelectorAll('.tree *')].find(x => x.textContent.trim() === 'الصف العاشر'); el && el.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const el = [...document.querySelectorAll('.tree *')].find(x => x.textContent.trim() === 'القلب'); el && el.click(); });
  await p.waitForSelector('#sendPrepBtn'); await p.evaluate(() => document.getElementById('sendPrepBtn').scrollIntoView({ block: 'center' })); await p.screenshot({ path: __dirname + '/store_1.png' });
  const np = c.waitForEvent('page', { timeout: 10000 });
  await p.click('#sendPrepBtn'); await p.waitForTimeout(500); console.log('toast:', await p.textContent('#toast'));
  const n = await np; console.log('opened:', n.url());
  // تبويبات الإضافة لا تمر على route في Playwright: نعيد فتح نفس الصفحة بعد ربط المحاكاة
  await n.route('https://lms.moe.gov.om/**', r => { visited.push(r.request().url()); r.fulfill({ contentType: 'text/html; charset=utf-8', body: /add_preparation/.test(r.request().url()) ? '<html><body><h2>إضافة تحضير</h2></body></html>' : NOUR_HOME }); });
  if (!/lms\.moe/.test(n.url())) await n.goto('https://lms.moe.gov.om/teacher');
  await n.waitForURL(/add_preparation/, { timeout: 15000 }).catch(() => {});
  console.log('nour tab:', n.url()); console.log('visited:', visited);
  console.log('errors', errs); await c.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
