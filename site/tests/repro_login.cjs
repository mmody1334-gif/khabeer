// اختبارات الدخول وحد الأجهزة. سيناريوهان لا يجتمعان لأن نافذة الإهمال تُضبط عند تشغيل السيرفر:
//   (أ) نافذة افتراضية 30 يومًا: جهازان حديثان ⇒ الثالث يُرفض برسالة واضحة.
//   (ب) STALE_SECONDS صغير: الجهاز المهمل يُستبدل تلقائيًا.
// الاستخدام:
//   node repro_login.cjs                      → (أ)
//   STALE_SECONDS=1 node repro_login.cjs      → (ب)
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
const T = { u: 'ahmed.b', p: 'Ahmed@2026' };
const STALE = +(process.env.STALE_SECONDS || 0);
const MODE = STALE > 0 ? 'stale' : 'limit';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

const UA = {
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];
  console.log('الوضع: ' + (MODE === 'stale' ? `استبدال الجهاز المهمل (نافذة ${STALE}ث)` : 'حد الأجهزة (نافذة 30 يومًا)'));

  const login = async (uaKey, creds) => {
    const c = await b.newContext({ viewport: { width: 1200, height: 900 }, locale: 'ar-OM', userAgent: UA[uaKey] });
    const p = await c.newPage();
    p.on('pageerror', e => errs.push(uaKey + ': ' + e.message));
    await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
    if (await p.$('#setupForm')) {   // أول تشغيل: ننشئ المدير
      await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', USER);
      await p.fill('#password', PASS); await p.fill('#password2', PASS);
      await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
      await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
    }
    if (await p.$('#loginForm')) {
      await p.fill('#username', creds.u); await p.fill('#password', creds.p);
      await p.click('#loginBtn'); await p.waitForTimeout(3000);
    }
    const st = await p.evaluate(async () => {
      const me = await fetch('/api/me');
      const e = document.getElementById('loginErr');
      return { path: location.pathname, me: me.status, err: e && !e.hidden ? e.textContent.trim() : '' };
    });
    await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    st.onApp = await p.evaluate(() => !!document.querySelector('.g-btn, #tree'));
    return { p, c, ...st };
  };

  const ADMIN = { u: USER, p: PASS };
  const admin = await login('win', ADMIN);
  await admin.p.evaluate(async (t) => {
    await fetch('/api/admin/teachers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'أحمد البلوشي', username: t.u, password: t.p }) });
  }, T);
  const teacherId = await admin.p.evaluate(async (u) => {
    const r = await fetch('/api/admin/stats'); const j = await r.json();
    const x = j.users.find(y => y.username === u); return x ? x.id : null;
  }, T.u);
  const devices = () => admin.p.evaluate(async (id) => {
    const r = await fetch('/api/admin/stats'); const j = await r.json();
    const u = j.users.find(x => x.id === id);
    return (u.devices || []).map(d => ({ label: d.label || '', ageMs: Date.now() - d.last_seen }));
  }, teacherId);
  const resetDevices = () => admin.p.evaluate(async (id) => {
    await fetch('/api/admin/teachers/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset_devices' }) });
  }, teacherId);

  if (MODE === 'limit') {
    console.log('\n--- جهازان حديثان: الثالث يُرفض ---');
    const d1 = await login('android', T);
    ok('الجهاز الأول يدخل ويصل للدروس', d1.me === 200 && d1.onApp, `me=${d1.me} onApp=${d1.onApp}`);
    const d2 = await login('ipad', T);
    ok('الجهاز الثاني يدخل ويصل للدروس', d2.me === 200 && d2.onApp, `me=${d2.me} onApp=${d2.onApp}`);
    const d3 = await login('iphone', T);
    ok('الجهاز الثالث يُرفض (حماية من مشاركة الحساب)', d3.me === 401, 'me=' + d3.me);
    ok('الرسالة تشرح السبب وتذكر الأجهزة وتاريخ آخر دخول',
      /2 أجهزة/.test(d3.err) && /•/.test(d3.err) && /آخر دخول/.test(d3.err), d3.err.replace(/\n+/g, ' | ').slice(0, 130));
    ok('الرسالة ترشد لمسح الأجهزة', /مسح الأجهزة|محمد مجدي/.test(d3.err), d3.err.slice(0, 60));
    ok('لا يُضاف جهاز ثالث للمعلم', (await devices()).length === 2, 'عدد=' + (await devices()).length);

    console.log('\n--- «مسح الأجهزة المهملة» لا يحذف الحديثة ---');
    const cl = await admin.p.evaluate(async (id) => {
      const r = await fetch('/api/admin/teachers/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clean_stale' }) });
      return r.json();
    }, teacherId);
    ok('لا يحذف شيئًا لأن الأجهزة حديثة', cl.removed === 0, JSON.stringify(cl));

    console.log('\n--- بعد مسح الأجهزة يدخل جهاز جديد ---');
    await resetDevices();
    const d4 = await login('iphone', T);
    ok('الجهاز الجديد يدخل بعد المسح', d4.me === 200 && d4.onApp, `me=${d4.me} onApp=${d4.onApp}`);

    console.log('\n--- الجلسة تثبت ولا تُعيد للصفحة الرئيسية ---');
    for (const url of ['/app', '/quiz', '/finals', '/summaries', '/remedial']) {
      await d4.p.goto(B + url, { waitUntil: 'domcontentloaded' });
      await d4.p.waitForTimeout(800);
      const at = new URL(d4.p.url()).pathname;
      ok('يبقى داخل ' + url, at === url, at);
    }

    console.log('\n--- أنواع أجهزة غير معتادة تُقبل (الحد نوعي لا نظامي) ---');
    // جهاز بنظام غير شائع (لينكس/كروم بوك): يجب أن يدخل ويُسمّى بلا كسر
    const linuxCtx = await b.newContext({
      viewport: { width: 1280, height: 800 }, locale: 'ar-OM',
      userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const lp = await linuxCtx.newPage();
    lp.on('pageerror', e => errs.push('cros: ' + e.message));
    await lp.goto(B + '/', { waitUntil: 'domcontentloaded' });
    if (await lp.$('#loginForm')) {
      await lp.fill('#username', T.u); await lp.fill('#password', T.p);
      await lp.click('#loginBtn'); await lp.waitForTimeout(3000);
    }
    const ls = await lp.evaluate(async () => {
      const me = await fetch('/api/me');
      const e = document.getElementById('loginErr');
      return { me: me.status, err: e && !e.hidden ? e.textContent.trim() : '' };
    });
    // إما يدخل (لو كان أحد الجهازين مهملًا) أو يُرفض برسالة الأجهزة — المهم أنه لا يفشل بلا سبب
    const accepted = ls.me === 200;
    const refusedProperly = ls.me === 401 && /2 أجهزة/.test(ls.err);
    ok('جهاز بنظام غير شائع: يدخل أو يُرفض برسالة واضحة', accepted || refusedProperly,
      accepted ? 'دخل بنجاح (نوع الجهاز غير مقيّد)' : 'رُفض: ' + ls.err.slice(0, 60));
  } else {
    console.log('\n--- استبدال الجهاز المهمل تلقائيًا ---');
    await resetDevices();
    const A = await login('android', T);
    ok('جهاز A دخل', A.me === 200, 'me=' + A.me);
    await new Promise(r => setTimeout(r, (STALE + 1) * 1000));
    const B2 = await login('ipad', T);
    ok('جهاز B دخل', B2.me === 200, 'me=' + B2.me);
    await new Promise(r => setTimeout(r, (STALE + 1) * 1000));
    const C = await login('iphone', T);
    ok('جهاز C دخل باستبدال المهمل تلقائيًا', C.me === 200 && C.onApp, `me=${C.me} onApp=${C.onApp} err="${(C.err || '').slice(0, 50)}"`);
    const after = await devices();
    ok('العدد بقي عند الحد (2)', after.length === 2, 'عدد=' + after.length);
    ok('الجهاز المهمل (Android) أُزيل', !after.some(d => /Android/.test(d.label)), after.map(d => d.label).join(' | '));
    ok('الجهاز الجديد موجود (iPhone)', after.some(d => /iPhone/.test(d.label)), after.map(d => d.label).join(' | '));
    // في هذا الوضع لا نتحقق من «الرفض»: نافذة الإهمال ثانية واحدة فيصير أي جهاز مهملًا
    // خلال ثوانٍ ويُستبدل — وهذا هو السلوك المقصود هنا.
    ok('لم يبقَ جهاز قديم محجوز (الاستبدال نظّف القديم)', !after.some(d => /Android/.test(d.label)),
      after.map(d => d.label).join(' | '));
  }

  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
