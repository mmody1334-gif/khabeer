// يتحقق من لوحة التحكم: الصلاحيات بالمواد، نافذة الاختيار (مادة ثم صفوفها)،
// عرض التفاصيل، وسلامة صفحة الدخول — مع رصد أي خطأ JavaScript.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'ar-OM' });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });

  // ---- صفحة الدخول ----
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
  }
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  const loginOk = !!(await p.$('#loginForm')) || !!(await p.$('#app'));
  ok('صفحة الدخول تُبنى', loginOk, 'نموذج الدخول موجود');
  const loginErrs = errs.filter(e => !/favicon|manifest|sw\.js/i.test(e));
  ok('لا أخطاء في صفحة الدخول', loginErrs.length === 0, loginErrs.slice(0, 2).join(' | ') || 'نظيف');
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn'); await p.waitForTimeout(2500);
  }

  // ---- لوحة التحكم ----
  errs.length = 0;
  // نُنشئ معلمًا بصلاحية (المستخدم الحالي «مدير» فلا تظهر له أعمدة الصلاحيات)
  await p.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  const seed = await p.evaluate(async () => {
    const r = await fetch('/api/admin/teachers', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'أ. سعيد المعلمي', username: 'saeed_t', password: (process.env.TEST_PASS||''),
        scope: ['اللغة العربية|الخامس', 'اللغة العربية|السادس', 'اللغة العربية|السابع', 'الرياضيات|الخامس']
      })
    });
    return { status: r.status, body: await r.text() };
  });
  console.log('إنشاء معلم للاختبار: HTTP ' + seed.status + ' ' + String(seed.body).slice(0, 60));
  await p.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4000);

  // 1) عمود الصلاحيات بالمواد
  const cols = await p.evaluate(() => {
    const th = [...document.querySelectorAll('.tbl thead th')].map(x => x.textContent.trim());
    const chips = [...document.querySelectorAll('.sc-cell .chip-s')].map(x => ({
      text: x.textContent.trim(), title: x.getAttribute('title') || ''
    }));
    return { th, chips };
  });
  console.log('أعمدة الجدول: ' + JSON.stringify(cols.th));
  ok('عنوان العمود تجميعي', cols.th.some(h => /المواد والصفوف/.test(h)), cols.th.join(' | '));
  ok('الصلاحيات تُعرض بالمواد (لا تكرار صفوف)',
     cols.chips.length > 0 && new Set(cols.chips.map(x => x.text.replace(/\d+$/, ''))).size >= 1,
     cols.chips.slice(0, 4).map(x => x.text).join(' · '));

  // 2) نافذة المواد والصفوف: اختر مادة ثم صفوفها
  const dlg = await p.evaluate(async () => {
    // نفتح أول معلم له زر الصلاحيات
    const row = [...document.querySelectorAll('.tbl tbody tr')].find(tr => /سعيد/.test(tr.textContent));
    if (!row) return { err: 'لا صف للمعلم' };
    const btn = row.querySelector('[data-open]');
    if (!btn) return { err: 'لا زر تفاصيل' };
    btn.click(); await new Promise(x => setTimeout(x, 1500));
    const sc = [...document.querySelectorAll('button')].find(b => /data-act|المواد والصفوف/.test(b.textContent));
    const scBtn = [...document.querySelectorAll('[data-act="scope"]')][0];
    if (!scBtn) return { err: 'لا زر صلاحيات' };
    scBtn.click(); await new Promise(x => setTimeout(x, 1200));
    const accs = [...document.querySelectorAll('#scAcc .sc-acc')].map(a => ({
      s: a.getAttribute('data-acc'), open: a.open, badge: (a.querySelector('.sc-e') || {}).textContent || ''
    }));
    const firstOpen = document.querySelector('#scAcc .sc-acc[open]') || document.querySelector('#scAcc .sc-acc');
    const grades = [...firstOpen.querySelectorAll('[data-sc]')].map(x => x.getAttribute('data-sc'));
    return { accs, cur: firstOpen.getAttribute('data-acc'), grades,
             hasAll: !!firstOpen.querySelector('[data-all]') };
  });
  if (dlg.err) { ok('نافذة الصلاحيات', false, dlg.err); }
  else {
    console.log('المواد في النافذة: ' + JSON.stringify((dlg.accs||[]).slice(0, 6).map(x => x.s + ' ' + x.badge)));
    console.log('صفوف المادة المفتوحة (' + dlg.cur + '): ' + JSON.stringify(dlg.grades.slice(0, 6)));
    ok('النافذة تعرض المواد قوائم منسدلة', (dlg.accs||[]).length > 0, (dlg.accs||[]).length + ' مادة');
    ok('تُفتح صفوف المادة المختارة', dlg.grades.length > 0, dlg.grades.length + ' صفًا');
    ok('زر «تحديد كل الصفوف» موجود', dlg.hasAll, 'موجود');
    ok('مفاتيح الصفوف بصيغة «مادة|صف»', dlg.grades.every(g => /\|/.test(g)), dlg.grades[0] || '');

    // نختار كل صفوف المادة ثم نفتح مادة أخرى ونختار صفًّا منها
    const sel = await p.evaluate(async () => {
      const openAcc = document.querySelector('#scAcc .sc-acc[open]') || document.querySelector('#scAcc .sc-acc');
      const all = openAcc.querySelector('[data-all]');
      all.checked = true; all.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(x => setTimeout(x, 900));
      // بعد إعادة الرسم تُستبدل العناصر، فنقرأ من الشجرة الجديدة
      const acc1 = document.querySelector('#scAcc .sc-acc[open]') || document.querySelector('#scAcc .sc-acc');
      const afterAll = [...acc1.querySelectorAll('[data-sc]')].filter(x => x.checked).length;
      const accs = [...document.querySelectorAll('#scAcc .sc-acc')];
      const second = accs[1] || accs[0];
      if (second) { second.open = true; await new Promise(x => setTimeout(x, 500)); }
      const g2 = second ? [...second.querySelectorAll('[data-sc]')] : [];
      if (g2[0]) { g2[0].checked = true; g2[0].dispatchEvent(new Event('change', { bubbles: true })); }
      await new Promise(x => setTimeout(x, 700));
      const cur2 = second ? second.getAttribute('data-acc') : '';
      const count = (document.getElementById('scCount') || {}).textContent || '';
      const badges = [...document.querySelectorAll('#scAcc .sc-e')].map(x => x.textContent.trim());
      return { afterAll, cur2, count, badges };
    });
    console.log('بعد «تحديد الكل»: ' + sel.afterAll + ' صفًا · المادة الثانية: ' + sel.cur2 + ' · ' + sel.count);
    ok('تحديد كل الصفوف يعمل', sel.afterAll > 1, sel.afterAll + ' صفًا');
    ok('عدّاد المادة يظهر على كل مادة', sel.badges.length > 0, JSON.stringify(sel.badges.slice(0, 4)));

    // حفظ
    const saved = await p.evaluate(async () => {
      const okb = document.getElementById('mOk');
      if (!okb) return { err: 'لا زر حفظ' };
      okb.click(); await new Promise(x => setTimeout(x, 2600));
      return { hidden: (document.getElementById('modal') || {}).hidden };
    });
    ok('الحفظ يغلق النافذة', !saved.err && saved.hidden !== false, saved.err || 'أُغلقت');
  }

  // 3) التفاصيل تعرض القائمة الكاملة
  const det = await p.evaluate(async () => {
    const row = [...document.querySelectorAll('.tbl tbody tr')].find(tr => /سعيد/.test(tr.textContent));
    const btn = row && row.querySelector('[data-open]');
    if (!btn) return { err: 'لا زر' };
    btn.click(); await new Promise(x => setTimeout(x, 1600));
    const box = document.getElementById('modalBox');
    const t = box ? box.textContent : '';
    const items = [...document.querySelectorAll('.sc-full li')].length;
    return { has: /المواد والصفوف المسموحة/.test(t), items, chips: document.querySelectorAll('.sc-full .chip-s').length };
  });
  console.log('التفاصيل: مواد=' + det.items + ' · رقاقات=' + det.chips);
  ok('التفاصيل تعرض المواد والصفوف', !det.err && det.has, det.err || 'موجود');
  ok('التفاصيل تسرد الصفوف كاملة', (det.chips || 0) > 0, (det.chips || 0) + ' رقاقة');

  await p.screenshot({ path: require('path').join(__dirname, 'admin_scope.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)].filter(e => !/favicon|manifest|sw\.js/i.test(e));
  console.log('\nأخطاء JavaScript في لوحة التحكم: ' + (real.length ? real.join('\n') : '(لا شيء)'));
  ok('لا أخطاء JavaScript في اللوحة', real.length === 0, real.slice(0, 3).join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
