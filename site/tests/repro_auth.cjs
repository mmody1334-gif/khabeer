// يتحقق من مساري الدخول: (1) بالكوكيز كما في المتصفح العادي، (2) بلا كوكيز
// إطلاقًا (متصفحات واتساب/إنستقرام المدمجة أو مع حجب كوكيز الطرف الأول).
// الهدف منع العلّة المُبلَّغ عنها: العودة لصفحة الدخول مع تسجيل جهاز جديد كل مرة.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

function jar() {
  const m = new Map();
  return {
    add(res) { const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : []; sc.forEach(c => { const kv = c.split(';')[0]; const i = kv.indexOf('='); m.set(kv.slice(0, i).trim(), kv.slice(i + 1)); }); },
    header() { return [...m].map(([k, v]) => k + '=' + v).join('; '); }
  };
}

(async () => {
  const srv = await PW.boot();
  const B = srv.BASE;

  async function call(path, body, hdrs, j) {
    const h = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(hdrs || {}) };
    if (j && j.header()) h['Cookie'] = j.header();
    const r = await fetch(B + path, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
    if (j) j.add(r);
    const t = await r.text(); let p = {}; try { p = JSON.parse(t); } catch (e) { }
    return { s: r.status, j: p, t };
  }

  // إعداد المدير
  let jA = jar();
  let r = await call('/api/setup', { name: 'م', username: USER, password: PASS }, null, jA);
  if (r.s !== 200 && !/موجود/.test(r.t)) console.log('setup: ' + r.s);
  r = await call('/api/login', { name: 'م', username: USER, password: PASS, fp: 'fpa' }, null, jA);
  ok('دخول المدير', r.s === 200, 'HTTP ' + r.s);
  const A = { 'X-Tahdir-Sid': r.j.sid, 'X-Tahdir-Did': r.j.did };

  // ---------- 1) متصفح عادي (كوكيز) ----------
  await call('/api/admin/teachers', { name: 'أ. كوكيز', username: 'withcook', password: (process.env.TEST_PASS||'') }, null, jA);
  const jT = jar();
  let same = true, firstDid = '';
  for (let i = 1; i <= 3; i++) {
    const rr = await call('/api/login', { username: 'withcook', password: (process.env.TEST_PASS||''), fp: 'fpc' }, null, jT);
    const me = await call('/api/me', null, null, jT);
    if (rr.s !== 200 || me.s !== 200) { ok('دخول بالكوكيز — محاولة ' + i, false, 'login=' + rr.s + ' me=' + me.s); break; }
    if (i === 1) firstDid = rr.j.did || '';
    else if ((rr.j.did || '') !== firstDid) same = false;
    if (i === 3) ok('دخول بالكوكيز يعمل ثلاث مرات', true, me.j.name || '');
  }
  ok('معرّف الجهاز ثابت بالكوكيز', same, firstDid.slice(0, 8));

  // ---------- 2) متصفح بلا كوكيز (ترويسات فقط) ----------
  await call('/api/admin/teachers', { name: 'أ. بلا كوكيز', username: 'nocook', password: (process.env.TEST_PASS||'') }, null, jA);
  let hdrs = null, stable = true, did0 = '';
  for (let i = 1; i <= 3; i++) {
    const rr = await call('/api/login', { username: 'nocook', password: (process.env.TEST_PASS||''), fp: 'fpn' }, hdrs);
    if (rr.s !== 200) { ok('دخول بلا كوكيز — محاولة ' + i, false, 'HTTP ' + rr.s + ' ' + rr.t.slice(0, 90)); break; }
    hdrs = { 'X-Tahdir-Sid': rr.j.sid, 'X-Tahdir-Did': rr.j.did };
    const me = await call('/api/me', null, hdrs);
    if (i === 1) { did0 = rr.j.did || ''; ok('الدخول بلا كوكيز ينجح والجلسة تعمل', me.s === 200, 'me=' + me.s + ' ' + (me.j.name || me.j.error || '')); }
    else if ((rr.j.did || '') !== did0) stable = false;
  }
  ok('معرّف الجهاز ثابت بلا كوكيز', stable, did0.slice(0, 8));

  // عدد الأجهزة: يجب أن يبقى 1 لكل معلم رغم ثلاث محاولات
  const st = await call('/api/admin/stats', null, A);
  const devs = (u) => { const x = (st.j.users || []).find(v => v.username === u); return x ? x.devices.length : -1; };
  ok('«أ. كوكيز» له جهاز واحد فقط', devs('withcook') === 1, devs('withcook') + ' جهاز');
  ok('«أ. بلا كوكيز» له جهاز واحد فقط', devs('nocook') === 1, devs('nocook') + ' جهاز');

  // ---------- 3) الجلسة تبقى وتُرفض بعد الخروج ----------
  const before = await call('/api/me', null, hdrs);
  await call('/api/logout', {}, hdrs);
  const after = await call('/api/me', null, hdrs);
  ok('الخروج يُبطل جلسة الترويسة', after.s === 401, 'قبل=' + before.s + ' بعد=' + after.s);

  srv.stop();
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
