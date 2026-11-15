// يتحقق من إعادة ترقيم الأسئلة (س1، س2…) في أوراق الخطط العلاجية بعد حذف سؤال من الورقة القابلة للتحرير،
// في «الأنشطة الصفية» و«النشاط الجماعي» (مع تحديث جدول أعضاء المجموعة).
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = 'Bio@2026x';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

async function pickC(p, key) {
  const s = key.split('|')[0];
  if (await p.isVisible('#courseSelSubj')) { if (await p.inputValue('#courseSelSubj') !== s) { await p.selectOption('#courseSelSubj', s); await p.waitForTimeout(600); } }
  if (await p.inputValue('#courseSel') !== key) await p.selectOption('#courseSel', key);
  await p.waitForTimeout(600);
}
// يحذف السؤال رقم k من الورقة كما يفعل المعلم: تحديد الكتلة ثم Delete (يرفع حدث input)
async function delQ(p, k) {
  await p.evaluate(k => {
    const b = [...document.querySelectorAll('#paper b')].filter(x => /^(س|Q)\d+\.\s*$/.test(x.textContent.trim()))[k - 1];
    const blk = b.closest('#paper > div > div') || b.parentElement;
    const r = document.createRange(); r.selectNode(blk);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.getElementById('paper').focus();
    document.execCommand('delete');
  }, k);
  await p.waitForTimeout(200);
}
const nums = p => p.$$eval('#paper b', e => e.map(x => x.textContent.trim()).filter(t => /^(س|Q)\d+\.$/.test(t)));
const seq = a => a.every((t, i) => +t.replace(/\D/g, '') === i + 1);

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'ar-OM' });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'م'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
  }
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#loginForm')) { await p.fill('#username', USER); await p.fill('#password', PASS); await p.click('#loginBtn'); await p.waitForTimeout(2600); }

  for (const base of ['/remedial']) {
    await p.goto(B + base, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#courseSel, #courseSelSubj'); await pickC(p, 'الأحياء|الحادي عشر'); await p.waitForSelector('[data-lid]');
    const ids = await p.$$eval('[data-lid]:not([disabled])', e => e.slice(0, 3).map(x => x.getAttribute('data-lid')));
    for (const i of ids) await p.check(`[data-lid="${i}"]`);
    await p.click('#makeBtn'); await p.waitForSelector('#paper #stTbl');
    await p.click('[data-part="cls"]'); await p.waitForTimeout(300);
    const n0 = await nums(p);
    ok(base + ' الأنشطة الصفية فيها 4 أسئلة على الأقل', n0.length >= 4, n0.length);
    await delQ(p, 3);
    let n1 = await nums(p);
    ok(base + ' بعد حذف س3 الترقيم متسلسل', n1.length === n0.length - 1 && seq(n1), n1.join(' '));
    await delQ(p, 1);
    n1 = await nums(p);
    ok(base + ' بعد حذف س1 الترقيم متسلسل', n1.length === n0.length - 2 && seq(n1), n1.join(' '));
    // يُحفظ مع الجزء: التنقل بين الأجزاء والعودة يبقي الترقيم
    await p.click('[data-part="plan"]'); await p.waitForTimeout(200); await p.click('[data-part="cls"]'); await p.waitForTimeout(200);
    ok(base + ' الترقيم الجديد محفوظ بعد التنقل', JSON.stringify(await nums(p)) === JSON.stringify(n1));

    // النشاط الجماعي + جدول الأعضاء
    await p.selectOption('#gSize', '3'); await p.click('#grpBtn'); await p.waitForSelector('#paper #grpTbl');
    const g0 = await nums(p);
    await delQ(p, 2);
    const g1 = await nums(p);
    ok(base + ' النشاط الجماعي: الترقيم متسلسل بعد الحذف', g1.length === g0.length - 1 && seq(g1), g1.join(' '));
    const refs = await p.$$eval('#grpTbl tbody td', e => e.map(x => x.textContent).join(' · ').match(/سؤال \d+/g) || []);
    const rn = refs.map(x => +x.replace(/\D/g, ''));
    ok(base + ' جدول الأعضاء يطابق الأرقام الجديدة', rn.length === g1.length && rn.every((x, i) => x === i + 1), rn.join(','));
  }
  ok('لا أخطاء في الصفحة', !errs.length, errs.join(' | '));
  await b.close(); srv.stop();
  console.log(`\n${pass} PASS / ${fail} FAIL`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
