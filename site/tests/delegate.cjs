// «تفويض كمدير»: المدير الرئيسي يرقّي معلمًا إلى مدير مفوَّض (صلاحيات كاملة + أجهزة غير محدودة)،
// والمفوَّض لا يستطيع حذف المدير الرئيسي أو تعديله، والرئيسي وحده يسحب التفويض.
const PW = require('./_pw.cjs');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
(async () => {
  const srv = await PW.boot(); const B = srv.BASE;
  async function call(path, body, sid, method) {
    const h = { 'Content-Type': 'application/json', Origin: B, ...(sid ? { 'X-Tahdir-Sid': sid } : {}) };
    const r = await fetch(B + path, { method: method || (body ? 'POST' : 'GET'), headers: h, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) { } return { s: r.status, j, t };
  }
  const login = async (u, p, fp) => (await call('/api/login', { username: u, password: p, fp, did: fp })).j.sid;
  await call('/api/setup', { name: 'المدير', username: 'owner', password: (process.env.TEST_PASS||'') });
  const A = await login('owner', (process.env.TEST_PASS||''), 'o1');
  ok('دخول المدير الرئيسي', !!A);
  await call('/api/admin/teachers', { name: 'أ. سالم', username: 'salem', password: (process.env.TEST_PASS||''), role: 'admin' }, A);
  await call('/api/admin/teachers', { name: 'أ. علي', username: 'ali', password: (process.env.TEST_PASS||'') }, A);
  let st = (await call('/api/admin/stats', null, A)).j;
  const id = n => st.users.find(u => u.username === n).id;
  ok('إنشاء معلم لا يسمح بدور مدير مُمرَّر', st.users.find(u => u.username === 'salem').role === 'teacher');
  const OW = id('owner'), SA = id('salem'), AL = id('ali');
  let r = await call('/api/admin/teachers/' + SA, { action: 'delegate', value: 1 }, A);
  ok('الرئيسي يفوّض معلمًا', r.s === 200, r.t);
  // أجهزة غير محدودة: 4 أجهزة مختلفة
  const sids = []; for (const d of ['d1', 'd2', 'd3', 'd4']) sids.push(await login('salem', (process.env.TEST_PASS||''), d));
  ok('المفوَّض يدخل من 4 أجهزة', sids.every(Boolean));
  const S = sids[3];
  r = await call('/api/me', null, S); ok('/api/me يُظهر delegated', r.j.role === 'admin' && r.j.delegated === true, r.t);
  r = await call('/api/admin/stats', null, S); ok('المفوَّض يفتح لوحة التحكم', r.s === 200);
  r = await call('/api/admin/teachers/' + AL, { action: 'rename', name: 'أ. علي الجديد' }, S); ok('المفوَّض يعدّل معلمًا', r.s === 200);
  r = await call('/api/admin/teachers/' + OW, null, S, 'DELETE'); ok('المفوَّض لا يحذف الرئيسي', r.s === 403, r.t);
  r = await call('/api/admin/teachers/' + OW, { action: 'password', password: (process.env.TEST_PASS||'') }, S); ok('المفوَّض لا يغيّر كلمة مرور الرئيسي', r.s === 403);
  r = await call('/api/admin/teachers/' + OW, { action: 'toggle' }, S); ok('المفوَّض لا يوقف الرئيسي', r.s === 403);
  r = await call('/api/admin/teachers/' + AL, { action: 'delegate', value: 1 }, S); ok('المفوَّض لا يفوّض غيره', r.s === 403);
  r = await call('/api/admin/teachers/' + SA, { action: 'delegate', value: 0 }, S); ok('المفوَّض لا يسحب التفويض', r.s === 403);
  ok('الرئيسي ما زال يدخل بكلمة مروره', !!(await login('owner', (process.env.TEST_PASS||''), 'o2')));
  r = await call('/api/admin/teachers/' + SA, { action: 'delegate', value: 0 }, A); ok('الرئيسي يسحب التفويض', r.s === 200, r.t);
  r = await call('/api/admin/stats', null, S); ok('بعد السحب: لا وصول للوحة', r.s !== 200);
  st = (await call('/api/admin/stats', null, A)).j;
  ok('رجع معلمًا عاديًا', st.users.find(u => u.id === SA).role === 'teacher');
  await call('/api/admin/teachers/' + SA, { action: 'delegate', value: 1 }, A);
  r = await call('/api/admin/teachers/' + SA, null, A, 'DELETE'); ok('الرئيسي يحذف المفوَّض', r.s === 200, r.t);
  console.log(`\n${pass} PASS · ${fail} FAIL`); await srv.stop?.(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
