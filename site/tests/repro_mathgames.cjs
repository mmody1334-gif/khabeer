// يتحقق من أسئلة ألعاب الرياضيات المولّدة: تغطية كاملة للصفوف 5-9، وخلوّ الصف 10
// منها (حسب المطلوب)، وسلامة بنية كل سؤال.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = (process.env.TEST_PASS||'');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const B = srv.BASE;
  async function call(path, body, ck) {
    const r = await fetch(B + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(ck ? { Cookie: ck } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { s: r.status, j: await r.json().catch(() => ({})), ck: (r.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ') };
  }
  let r = await call('/api/setup', { name: 'م', username: USER, password: PASS });
  r = await call('/api/login', { name: 'م', username: USER, password: PASS, fp: 'a' });
  const ck = r.ck;

  const grades = ['الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'];
  for (const g of grades) {
    const key = 'الرياضيات|' + g;
    const d = await call('/api/games/data?key=' + encodeURIComponent(key), null, ck);
    if (d.j.error) { ok('الرياضيات ' + g, false, d.j.error); continue; }
    const items = (d.j.items || []).filter(x => (x.choices || []).length >= 2);
    const cov = new Set(items.map(x => x.lesson_id));
    const lessons = (d.j.lessons || []).length;
    ok('الرياضيات ' + g + ' — كل الدروس لها أسئلة', cov.size === lessons && lessons > 0, cov.size + '/' + lessons + ' · ' + items.length + ' سؤالًا');
  }

  // الصف العاشر: لا أسئلة (حسب الطلب)
  const d10 = await call('/api/games/data?key=' + encodeURIComponent('الرياضيات|العاشر'), null, ck);
  const items10 = (d10.j.items || []).filter(x => (x.choices || []).length >= 2);
  ok('الرياضيات العاشر بلا أسئلة (كما طُلب)', items10.length === 0, items10.length + ' سؤالًا');

  // سلامة البنية على الصف الخامس
  const d5 = await call('/api/games/data?key=' + encodeURIComponent('الرياضيات|الخامس'), null, ck);
  const it5 = (d5.j.items || []).filter(x => x.src === 'math-game');
  const bad = it5.filter(x => !x.stem || (x.choices || []).length !== 4 || !(x.correct >= 0 && x.correct <= 3) || new Set(x.choices).size !== 4);
  ok('بنية الأسئلة سليمة (نص + 4 خيارات + فهرس صحيح)', it5.length > 0 && bad.length === 0, it5.length + ' سؤالًا · مرفوض ' + bad.length);

  // الأسئلة تُستخدم فعليًا في الألعاب (المخزون يكفي لألعاب MCQ)
  const mcq = (d5.j.items || []).filter(x => x.type === 'mcq' && (x.choices || []).length >= 2);
  ok('مخزون الخامس يكفي للعبة اختيار من متعدد', mcq.length >= 6, mcq.length + ' مفردة');

  srv.stop();
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
