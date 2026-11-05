// يتحقق من ظهور الاختبارات النهائية للغة الإنجليزية (الصف العاشر) بالأقسام الثمانية.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'ar-OM' });
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

  // 1) هل المادة في فهرس النهائيات؟
  await p.goto(B + '/finals', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  const idx = await p.evaluate(() => window.FIN_INDEX || {});
  const enKeys = Object.keys(idx).filter(k => /إنجليز|انجليز|English/i.test(k));
  console.log('مفاتيح إنجليزية في FIN_INDEX: ' + JSON.stringify(enKeys));
  ok('اللغة الإنجليزية في فهرس النهائيات', enKeys.some(k => /العاشر/.test(k)), enKeys.join(' · '));
  // 2) نفتح المادة ونحصي الأقسام
  const r = await p.evaluate(async () => {
    // القائمة منسدلتان: #courseSelSubj للمادة ثم #courseSel للصف
    const sub = document.getElementById('courseSelSubj');
    const sel = document.getElementById('courseSel');
    if (!sel) return { err: 'لا قائمة مواد' };
    if (!sub) return { err: 'لا قائمة مواد (subject)' };
    const subjects = [...sub.options].map(o => o.textContent.trim());
    const o = [...sub.options].find(x => /إنجليز/i.test(x.textContent));
    if (!o) return { err: 'لا مادة إنجليزية', subjects };
    sub.value = o.value; sub.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 1500));
    const grades = [...sel.options].map(x => x.textContent.trim());
    const g = [...sel.options].find(x => /عاشر/i.test(x.textContent));
    if (!g) return { err: 'لا صف عاشر', subjects, grades };
    sel.value = g.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 3500));
    const imgs = [...document.querySelectorAll('#fmain img')].map(i => ({ s: i.src.split('/').pop(), w: i.naturalWidth, h: i.naturalHeight }));
    const picks = [...document.querySelectorAll('#fmain input[type=checkbox]')].length;
    const units = [...document.querySelectorAll('#fside [data-u]')].map(x => x.textContent.trim());
    return { title: o.textContent.trim() + ' · ' + g.textContent.trim(), subjects, grades, imgs, picks, units, body: document.getElementById('fmain').textContent.slice(0, 120) };
  });
  console.log('المادة: ' + r.title);
  if (r.subjects) console.log('المواد: ' + JSON.stringify(r.subjects));
  if (r.grades) console.log('صفوف الإنجليزي: ' + JSON.stringify(r.grades));
  if (r.err) console.log('خطأ: ' + r.err);
  console.log('الصور: ' + JSON.stringify((r.imgs || []).map(i => i.s)));
  console.log('الوحدات/الأقسام: ' + JSON.stringify((r.units || []).slice(0, 10)));
  ok('المادة تُفتح', !r.err, r.err || 'فتحت');
  // الوحدة الواحدة تعرض سؤالها فقط — فنتحقق من ظهور صورة الوحدة الأولى وسلامة أبعادها
  ok('صورة القسم ظاهرة', (r.imgs || []).length >= 1, (r.imgs || []).length + ' صورة');
  ok('الصورة محمّلة بأبعاد سليمة', (r.imgs || []).every(i => i.w > 400 && i.h > 400),
     JSON.stringify((r.imgs || []).map(i => i.w + 'x' + i.h)));
  ok('الأقسام الثمانية في الشريط', (r.units || []).length >= 8, (r.units || []).length + ' قسمًا');
  // نتحقق من كل الأقسام بالتتابع
  const all = await p.evaluate(async () => {
    const out = [];
    const btns = [...document.querySelectorAll('#fside [data-u]')];
    for (const bt of btns) {
      bt.click(); await new Promise(x => setTimeout(x, 1600));
      const im = document.querySelector('#fmain img');
      out.push({ u: bt.getAttribute('data-u'), src: im ? im.src.split('/').pop() : '', w: im ? im.naturalWidth : 0 });
    }
    return out;
  });
  console.log('الأقسام: ' + JSON.stringify(all.map(a => a.u + ':' + a.src + '(' + a.w + ')')));
  ok('كل الأقسام الثمانية تُحمّل صورها', all.length >= 8 && all.every(a => a.w > 400), all.filter(a => !(a.w > 400)).length + ' فاشل');

  // 3) نتحقق من ظهور الإجابات عند التفعيل (نعود للقسم الأول أولًا)
  const ans = await p.evaluate(async () => {
    const b1 = document.querySelector('#fside [data-u="1"]');
    if (b1) { b1.click(); await new Promise(x => setTimeout(x, 1500)); }
    const chk = document.getElementById('ansChk');
    if (!chk) return { err: 'لا خيار إجابات' };
    chk.checked = true; chk.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 1800));
    const t = document.getElementById('fmain').textContent;
    return { hasTeacher: /teacher/.test(t), hasBrazil: /Brazil/.test(t), sample: t.slice(0, 200) };
  });
  console.log('إجابات ظاهرة: teacher=' + ans.hasTeacher + ' Brazil=' + ans.hasBrazil);
  ok('الإجابات تُعرض', !ans.err && (ans.hasTeacher || ans.hasBrazil), ans.err || 'ظاهرة');

  await p.screenshot({ path: require('path').join(__dirname, 'en10_finals.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
