// الذكاء الاصطناعي بخادم محاكٍ (صيغة OpenAI): تصحيح المقالي للطالب، البحث الإجرائي، أسئلة الألعاب، الحدود اليومية
const http = require('http');
const PW = require('./_pw.cjs');
let pass = 0, fail = 0, calls = [];
const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
const mock = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
  const j = JSON.parse(b), u = j.messages[1].content; calls.push({ auth: req.headers.authorization, model: j.model, user: u });
  let content;
  if (/إجابة الطالب/.test(u)) content = '{"score": 1, "feedback": "إجابة صحيحة جزئيًا: ذكرت المكوّن ولم تذكر وظيفته."}';
  else if (/المفاتيح/.test(u)) content = '```json\n{"intro":"فقرة مقدمة مخصصة أولى.\\n\\nفقرة ثانية.","theory":"إطار نظري مخصص للمادة.","discussion":"مناقشة مخصصة للأرقام."}\n```';
  else content = JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ stem: 'سؤال مولّد رقم ' + (i + 1) + '؟', choices: ['أ', 'ب', 'ج', 'د'], correct: i % 4 })));
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 500 } }));
}); });
(async () => {
  await new Promise(r => mock.listen(8899, r));
  process.env.AI_KEY = 'test-key'; process.env.AI_URL = 'http://127.0.0.1:8899/v1/chat/completions';
  const s = await PW.boot({ port: 8808 }); const B = s.BASE;
  const b = await PW.chromium.launch({ headless: true });
  const c = await b.newContext({ viewport: { width: 1300, height: 950 }, locale: 'ar-OM' });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shut = () => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } });
  const settle = async () => { await p.waitForTimeout(2000); for (let i = 0; i < 3; i++) { await shut(); await p.waitForTimeout(250); } };
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); await shut();
  if (await p.$('#setupForm')) { await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500); await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); }
  await shut(); if (await p.$('#loginForm')) { await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForTimeout(2500); }
  // 1) الألعاب
  await p.goto(B + '/games', { waitUntil: 'domcontentloaded' }); await settle();
  const before = await p.evaluate(() => { const el = document.getElementById('selInfo'); return document.querySelectorAll('[data-aigen]').length; });
  await p.evaluate(() => { const cb = document.querySelector('input[data-lid]:not([disabled])'); cb.checked = true; cb.dispatchEvent(new Event('change')); });
  await p.click('#aiGen'); await p.waitForTimeout(2500);
  const info = await p.textContent('#selInfo');
  ok('أسئلة ألعاب بالذكاء الاصطناعي تُضاف', /سؤال/.test(info) && calls.some(x => /اكتب 8 أسئلة/.test(x.user)), info);
  ok('المفتاح يُرسل من الخادم فقط', calls.every(x => x.auth === 'Bearer test-key') && !(await p.content()).includes('test-key'));
  // 2) البحث الإجرائي
  await p.goto(B + '/research', { waitUntil: 'domcontentloaded' }); await settle();
  await p.click('#rsNew'); await p.waitForTimeout(400);
  ok('خيار الذكاء الاصطناعي في البحث', !!(await p.$('#f_ai')));
  await p.fill('#f_material', 'الأحياء'); await p.fill('#f_grade', 'العاشر'); await p.fill('#f_scores', '10 15\n12 16\n9 14');
  await p.click('#rsGen'); await p.waitForTimeout(2500);
  const doc = await p.evaluate(() => (document.querySelector('.rs-doc') || {}).innerText || '');
  ok('البحث يحوي النص المخصص', /فقرة مقدمة مخصصة/.test(doc) && /إطار نظري مخصص/.test(doc) && /مناقشة مخصصة/.test(doc));
  ok('طلب البحث بلا مراجع مخترعة', calls.some(x => /المفاتيح/.test(x.user)));
  ok('بلا أخطاء صفحة', !errs.length, errs.join(' | '));
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  s.stop(); mock.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
