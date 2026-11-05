// يتحقق أن «الاستراتيجيات» و«الوسائل» صارت حقولًا داخل نموذج كل درس.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

// يفتح أول درس تربية إسلامية عبر الواجهة (محدّدات الشجرة: subjSel · g-btn · u-btn · .l-list button)
async function openFirstLesson(p) {
  return p.evaluate(async () => {
    const out = { steps: [] };
    const sel = document.getElementById('subjSel');
    if (sel) {
      const opt = [...sel.options].find(o => /إسلام/.test(o.value));
      if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 900)); out.steps.push('subject'); }
    }
    const g = [...document.querySelectorAll('.g-btn')].find(x => /الثامن/.test(x.textContent));
    if (g) { g.click(); await new Promise(r => setTimeout(r, 800)); out.steps.push('grade'); }
    const u = [...document.querySelectorAll('.u-btn')].find(x => x.offsetParent !== null);
    if (u) { u.click(); await new Promise(r => setTimeout(r, 800)); out.steps.push('unit'); }
    const ls = [...document.querySelectorAll('.l-list button')].filter(x => x.offsetParent !== null);
    out.lessonsFound = ls.length;
    if (ls.length) { ls[0].click(); await new Promise(r => setTimeout(r, 1200)); out.steps.push('lesson:' + ls[0].textContent.trim().slice(0, 24)); }
    return out;
  });
}

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM' });
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
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);

  const noBtn = await p.evaluate(() => !document.getElementById('settingsBtn'));
  const nav = await p.evaluate(() => (document.getElementById('navBar') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 160));
  console.log('الشريط: ' + nav);
  ok('أُزيل زر «القيم الثابتة» من الشريط', noBtn, 'أُزيل');

  const opened = await openFirstLesson(p);
  console.log('خطوات الفتح: ' + JSON.stringify(opened));
  await p.waitForTimeout(1200);

  const r = await p.evaluate(() => {
    const f = k => { const el = document.getElementById('f_' + k); return el ? el.value : null; };
    return {
      strategies: f('strategies'), resources: f('resources'),
      concepts: f('concepts'), outcomes: (f('outcomes') || '').slice(0, 60),
      shown: ['concepts', 'pre_learning', 'activities_teach', 'strategies', 'resources', 'formative', 'closing', 'homework', 'outcomes'].filter(k => document.getElementById('f_' + k)),
      panelHead: (document.querySelector('.panel h2') || document.querySelector('h2') || {}).textContent || '',
    };
  });
  console.log('عنوان اللوحة: ' + r.panelHead);
  console.log('الحقول الظاهرة (%d): %s', r.shown.length, JSON.stringify(r.shown));
  console.log('  الاستراتيجيات: ' + String(r.strategies).slice(0, 100).replace(/\n/g, ' | '));
  console.log('  الوسائل: ' + String(r.resources).slice(0, 110).replace(/\n/g, ' | '));
  console.log('  المخرجات: ' + String(r.outcomes).slice(0, 70).replace(/\n/g, ' | '));

  ok('حقل «الاستراتيجيات» ظاهر في الدرس', r.strategies !== null && r.strategies.length > 0, 'موجود بقيمة');
  ok('حقل «الوسائل ومصادر التعلم» ظاهر', r.resources !== null && r.resources.length > 0, 'موجود بقيمة');
  ok('الاستراتيجيات فيها «الحوار والمناقشة»', /الحوار والمناقشة/.test(r.strategies || ''), String(r.strategies).slice(0, 50));
  ok('الوسائل فيها محتوى من ملف التحضير', /الكتاب|المصحف|جهاز|بطاقات/.test(r.resources || ''), String(r.resources).slice(0, 50));
  ok('الحقول الأساسية التسعة كلها ظاهرة', r.shown.length >= 9, r.shown.length + ' حقلًا');
  ok('المخرجات التعليمية مملوءة', String(r.outcomes || '').length > 10, String(r.outcomes).slice(0, 40));
  await p.screenshot({ path: require('path').join(__dirname, 'lesson_fields_subject.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
