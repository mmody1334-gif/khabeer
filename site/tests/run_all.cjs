// مشغّل كل اختبارات الانحدار: يُقلع سيرفرًا محليًا واحدًا نظيفًا ثم يشغّل كل طقم بالترتيب.
//   node run_all.cjs            → كل الأطقم
//   node run_all.cjs fixes play → أطقم محدّدة فقط
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const DIR = __dirname;
const PORT = +(process.env.PORT || 8787);
const TESTS = [
  ['homework', 'homework.cjs', 'الواجبات المنزلية: قسم مستقل، درجة ثابتة لكل مادة وفق الوثيقة، اختيار درس محدد، طباعة بالترويسة'],
  ['fixes', 'regress_fixes.cjs', 'أحداث /api/event، سجل النشاط، ورقة المراجعة، النوافذ، تبديل المقرر'],
  ['labels', 'regress_labels.cjs', 'تسمية الصفوف (لا «الصف الصف») ونطاق الصلاحيات'],
  ['play', 'regress_play.cjs', 'تحدٍّ مباشر كامل: دخول طالب، إجابة، كشف، نهاية، عدّاد'],
  ['quizcard', 'repro_quiz_numbering.cjs', 'ترقيم أسئلة الامتحانات النهائية في الاختبار القصير'],
  ['tool', 'repro_tool_chrome.cjs', 'أداة نور في كروم: التثبيت والتشغيل من أول ضغطة'],
  ['notice', 'repro_update_notice.cjs', 'إعلان تحديث الأداة للمعلمين: يظهر مرة واحدة ولا يُزعج'],
  ['bell', 'notices.cjs', 'مركز الإشعارات (الجرس): يضيف المدير إعلانًا، لكل معلم «مقروء» خاص به في قاعدة البيانات، والعدّاد والحذف'],
  ['login', 'repro_login.cjs', 'الدخول وحد الأجهزة: الرفض برسالة واضحة، والاستبدال التلقائي للمهمل'],
  ['images', 'repro_images.cjs', 'صور أسئلة الوزارة تُرسم فعلًا في النهائية والتقويم والأنشطة الصفية'],
  ['sci7', 'repro_sci7.cjs', 'العلوم صف 7: يظهر في النهائية والتقويم والأنشطة، بأنواع ودرجات مطابقة للوثيقة'],
  ['imgratio', 'repro_img_ratio.cjs', 'نسبة أسئلة الوزارة بصورها في الاختبار القصير لا تقل عن 30%'],
  ['en10fin', 'repro_en10fin.cjs', 'نهائيات الإنجليزية ص10: 8 أقسام/60 درجة بإجاباتها'],
  ['en10', 'repro_en10.cjs', 'اللغة الإنجليزية صف 10: 32 درسًا في 4 وحدات بتحضير إنجليزي'],
  ['addteacher', 'repro_addteacher.cjs', 'إضافة معلمين: قوائم منسدلة للمواد وتحديد كل الصفوف'],
  ['iosflow', 'repro_ios_flow.cjs', 'آيفون: نقل المهمة من المنصة إلى نور عبر الرابط'],
  ['iosnour', 'repro_ios_nour.cjs', 'آيفون: نور يفتح الرئيسية ثم يوجّه للصف (أو يسأل «هل هذا الصف؟») ويحفظ رقمه'],
  ['ios', 'repro_ios.cjs', 'آيفون/WebKit: الصفحات والتبويبات على محرّك سافاري'],
  ['tooltabs', 'repro_tooltabs.cjs', 'تبويبات تثبيت الأداة: كروم · فايرفوكس · إيدج · سافاري'],
  ['mathgames', 'repro_mathgames.cjs', 'ألعاب الرياضيات: أسئلة مولّدة من أهداف الدروس 5-9'],
  ['slides', 'repro_slides.cjs', 'العروض التقديمية: قائمة ومعاينة وتحميل من درايف'],
  ['auth', 'repro_auth.cjs', 'الدخول: كوكيز وترويسات — لا أجهزة مكررة ولا عودة للدخول'],
  ['tour', 'repro_tour.cjs', 'دليل الاستخدام: جولة مصوّرة بأسهم + وضع التطبيق'],
  ['adminused', 'repro_admin_used.cjs', 'لوحة التحكم: قائمة الصفوف المستخدمة ودخول المعلم'],
  ['adminscope', 'repro_admin_scope.cjs', 'لوحة التحكم: الصلاحيات بالمواد ونافذة المادة ثم الصفوف'],
  ['mathquiz', 'repro_mathquiz.cjs', 'الاختبارات القصيرة للرياضيات: 10 مقررات وفق وثيقة التقويم'],
  ['mathfin', 'repro_mathfin.cjs', 'نهائيات الرياضيات: 10 مقررات و1363 مفردة وبنكها'],
  ['math', 'repro_math.cjs', 'الرياضيات صف 5: الدروس والوحدات والتحضير الكامل'],
  ['arabic67', 'repro_arabic67.cjs', 'اللغة العربية 6 و7: النهائيات الممسوحة (تقسيم بالأقسام) + البنك والاختبار'],
  ['arabicspec', 'repro_arabic_spec.cjs', 'اللغة العربية: مواصفة الاختبار القصير + توليد الورقة من أسئلة الوزارة'],
  ['arabic', 'repro_arabic.cjs', 'اللغة العربية والتربية الإسلامية: التحضير كامل وبلا تصادم معرّفات'],
  ['lessonvals', 'repro_lesson_values.cjs', 'القيم الثابتة داخل كل درس: الاستراتيجيات والوسائل بقيم المادة'],
  ['settsubj', 'repro_settings_subject.cjs', 'أُزيل زر القيم الثابتة وصارت الحقول داخل الدرس'],
  ['islam8spec', 'repro_islam8_spec.cjs', 'التربية الإسلامية: الورقة تطابق جدول المواصفات (15 درجة · 3 أسئلة)'],
  ['islam8quiz', 'repro_islam8_quiz.cjs', 'التربية الإسلامية: البنك والألعاب والتقويم'],
  ['ss12', 'repro_ss12.cjs', 'الدراسات الاجتماعية صف 12: 18 درسًا و6 أوراق وزارية، والاختبار القصير وفق وثيقة 2026 (3 اختيار + مقالية 7 · 3/5/2)'],
  ['pe', 'repro_pe.cjs', 'الرياضة المدرسية 5–11: التحضير من ملفات الوورد بترتيب فهرس الكتب، والواجب من أسئلة التحضير، وأنشطة في البنك'],
  ['islam8', 'repro_islam8.cjs', 'التربية الإسلامية صف 8: 27 درسًا و72 مفردة تظهر في النهائية والتقويم والأنشطة'],
];

function ping(port) {
  return new Promise(res => {
    const r = http.get({ host: '127.0.0.1', port, path: '/version', timeout: 1500 }, x => { x.resume(); res(x.statusCode === 200); });
    r.on('error', () => res(false));
    r.on('timeout', () => { r.destroy(); res(false); });
  });
}

function freePort(port) {
  return new Promise(async res => {
    if (!(await ping(port))) return res(true);
    console.error('!! المنفذ ' + port + ' مشغول بسيرفر آخر. أوقفه أولًا ثم أعد التشغيل.');
    res(false);
  });
}

(async () => {
  const want = process.argv.slice(2);
  const list = want.length ? TESTS.filter(t => want.includes(t[0])) : TESTS;
  if (!list.length) { console.error('لا يوجد طقم مطابق. المتاح: ' + TESTS.map(t => t[0]).join(', ')); process.exit(2); }
  if (!(await freePort(PORT))) process.exit(2);

  let srv = null;
  async function bootServer() {
    const s = spawn(process.execPath, ['--experimental-sqlite', 'devserver.mjs', String(PORT)],
      { cwd: DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    let l = '', u = false;
    s.stdout.on('data', d => { l += String(d); if (/listening/.test(l)) u = true; });
    s.stderr.on('data', d => { l += String(d); });
    for (let i = 0; i < 50 && !u; i++) await new Promise(r => setTimeout(r, 200));
    if (!u) { s.kill(); throw new Error('لم يبدأ السيرفر:\n' + l); }
    return s;
  }

  console.log('== سيرفر الاختبار على المنفذ ' + PORT + ' (يُعاد لكل طقم: قاعدة بيانات نظيفة)');

  const summary = [];
  for (let i = 0; i < list.length; i++) {
    const [key, file, desc] = list[i];
    // سيرفر نظيف لكل طقم: صفحة /setup تعمل مرة واحدة فقط لكل قاعدة بيانات
    srv = await bootServer();
    console.log('\n' + '='.repeat(72));
    console.log('== [' + key + '] ' + file + ' — ' + desc);
    console.log('='.repeat(72));
    const t0 = Date.now();
    const code = await new Promise(res => {
      const p = spawn(process.execPath, [file], { cwd: DIR, stdio: 'inherit', env: { ...process.env, B: 'http://localhost:' + PORT } });
      p.on('exit', c => res(c === null ? 1 : c));
    });
    try { srv.kill(); } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
    summary.push({ key, code, secs: Math.round((Date.now() - t0) / 1000) });
  }

  console.log('\n' + '='.repeat(72));
  console.log('== الملخّص');
  let bad = 0;
  summary.forEach(s => {
    if (s.code !== 0) bad++;
    console.log('   ' + (s.code === 0 ? 'PASS' : 'FAIL') + '  ' + s.key.padEnd(10) + s.secs + 'ث');
  });
  console.log('   الإجمالي: ' + (summary.length - bad) + ' ناجح، ' + bad + ' فاشل');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
