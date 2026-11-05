// خبير — Cloudflare Worker + D1
// خبير: منصة المعلمين
const LESSONS = __LESSONS__;
const PAGES = __PAGES__;
const TOOL = __TOOL__;
const ICONS = __ICONS__;
const APK = __APK__;
const EXTZIP = __EXTZIP__;
const PRIVACY = __PRIVACY__;
const QBANK = __QBANK__;
let GPACK = {};
let STUDY = { lessons: {}, units: {} };
let FINALS = {};
const PACKDIR = __PACKDIR__;
let PACKS_OK = null;
async function loadPacks(env, url) {
  if (PACKS_OK) return PACKS_OK;
  PACKS_OK = (async () => {
    const get = async n => { const r = await env.ASSETS.fetch(new Request(new URL(PACKDIR + n + '.json', url.origin))); if (!r.ok) throw new Error('pack ' + n + ' ' + r.status); return r.json(); };
    const [s, g, f] = await Promise.all([get('study'), get('games'), get('finals')]);
    STUDY = s; GPACK = g; FINALS = f; return true;
  })().catch(e => { PACKS_OK = null; throw e; });
  return PACKS_OK;
}
// أسئلة الاختبارات النهائية للعلوم تدخل بنك الاختبار القصير بصورتها الأصلية، بأهداف تقويم الوثيقة
const FG = { 'الخامس': 5, 'السادس': 6, 'السابع': 7, 'الثامن': 8, 'التاسع': 9, 'العاشر': 10, 'الحادي عشر': 11, 'الثاني عشر': 12 };
const AO_LO = { AO1: 'معرفة', AO2: 'تطبيق', AO3: 'استدلال', 'معرفة': 'معرفة', 'تطبيق': 'تطبيق', 'استدلال': 'استدلال' };
const AO_HI = { AO1: 'AO1', AO2: 'AO2', AO3: 'AO2', 'معرفة': 'AO1', 'تطبيق': 'AO2', 'استدلال': 'AO2' };
// تقنية المعلومات: مستويات الوثيقة (تذكر وفهم/تطبيق/استدلال)، والإجابة القصيرة 1–2 والطويلة 3 درجات
function itBank(key, items) {
  if (!/تقنية/.test(key)) return items;
  return items.map(q => {
    let ao = q.ao;
    if (ao === 'معرفة' || ao === 'AO1') ao = 'تذكر وفهم';
    else if (ao === 'AO2') ao = /مرتفع/.test(q.difficulty || '') ? 'استدلال' : 'تطبيق';
    let type = q.type;
    if (type !== 'mcq' && q.marks === 3 && ao !== 'تذكر وفهم') type = 'long';
    else if (type === 'long' && q.marks <= 2) type = 'short';
    return { ...q, ao, type };
  });
}
// «الأنشطة الصفية»: أسئلة أعلى مستوى لكل درس (تطبيق/استدلال، درجات أعلى، صعوبة أعلى، وأسئلة الوزارة بالرسوم)
function hardItems(key, ls) {
  const ids = new Set(ls.map(l => l.id)), out = {};
  const all = itBank(key, QBANK.filter(q => ids.has(q.lesson_id)).concat(finQuizItems(key).filter(q => ids.has(q.lesson_id))));
  const lvl = q => ({ 'استدلال': 3, 'AO2': 3, 'تطبيق': 2, 'AO1': 1, 'معرفة': 1 }[q.ao] || 1);
  const dif = q => ({ 'مرتفعة': 2, 'متوسطة': 1 }[q.difficulty] || 0);
  const score = q => lvl(q) * 10 + dif(q) * 4 + Math.min(q.marks || 1, 5) * 2 + (q.type === 'long' ? 3 : 0) + (q.img ? 4 : 0) - (q.type === 'mcq' ? 6 : 0);
  ls.forEach(l => {
    // أسئلة متوسطة (سؤالان على الأقل) ثم أسئلة تحدٍّ أعلى مستوى
    const mine = all.filter(q => q.lesson_id === l.id && q.stem);
    const isMid = q => q.difficulty === 'متوسطة' || (lvl(q) === 2 && (q.marks || 1) <= 2);
    const mid = mine.filter(q => isMid(q) && q.type !== 'long').sort((x, y) => (y.marks || 1) - (x.marks || 1));
    const hard = mine.filter(q => lvl(q) >= 2).sort((x, y) => score(y) - score(x));
    const pick = [], seen = new Set();
    const add = q => { const k = String(q.stem).slice(0, 60); if (seen.has(k)) return false; seen.add(k); pick.push({ type: q.type, stem: String(q.stem).replace(/\*\*/g, ''), choices: q.choices || [], correct: q.correct, answer: q.answer || '', marks: q.marks || 1, ao: q.ao, img: q.img || '', mid: isMid(q) }); return true; };
    let nm = 0; for (const q of mid) { if (nm >= 2) break; if (add(q)) nm++; }
    for (const q of hard) { if (pick.length >= 7) break; add(q); }
    pick.sort((x, y) => (y.mid ? 1 : 0) - (x.mid ? 1 : 0));
    if (pick.length) out[l.id] = pick;
  });
  return out;
}
// مستوى هدف التقويم لسؤال الوزارة: بعضها مكتوب مركّبًا («معرفة / تطبيق»، «AO1/AO2»، «أ: AO1 ؛ ب: AO2») أو فارغًا
// نأخذ الأعلى مستوى فيها، والفارغ يُستنتج من الدرجة، حتى لا تسقط أسئلة كثيرة من الفيزياء والعلوم والعلوم البيئية
const AO_RANK = { AO1: 1, 'معرفة': 1, 'تذكر': 1, AO2: 2, 'تطبيق': 2, AO3: 3, 'استدلال': 3 };
function normAO(raw, hi, m) {
  const found = String(raw || '').match(/AO[123]|معرفة|تذكر|تطبيق|استدلال/g) || [];
  const top = found.length ? found.reduce((a, b) => (AO_RANK[b] > AO_RANK[a] ? b : a)) : ((+m || 1) >= 2 ? 'تطبيق' : 'معرفة');
  return (hi ? AO_HI : AO_LO)[top];
}
// نص سؤال الوزارة يبدأ برقمه الأصلي («2) ...»). الواجهة ترقّم الاختبار من جديد،
// فنُزيل الرقم هنا حتى لا يظهر مرتين. وفي الصورة يُبيَّض الرقم عند النشر (fin_qno.py)،
// وتُرسم أرقام الأشكال («الشكل ٦-١») بالرقم الجديد في المتصفح (lb، انظر finMake في common.js).
function stripQNo(t) {
  return String(t || '').replace(/^\s*\(?\s*\d{1,2}\s*[\)\u002e\-]\s*/, '').trim();
}
function finQuizItems(key) {
  const G = FINALS[key]; if (!G) return [];
  const [subj, grade] = key.split('|'); if (subj === 'تقنية المعلومات' || subj === 'اللغة الإنجليزية') return [];
  // اللغة العربية والتربية الإسلامية تستخدمان **أسماء أهداف التقويم العربية** في جداول
  // مواصفاتهما (معرفة · تطبيق · استدلال)، بينما العلوم والكيمياء… تستخدم رموز AO1/AO2.
  // فلو حوّلنا مفرداتهما إلى رموز AO للصفوف 11-12 لما طابقت مواصفتهما فلم يُولَّد اختبار.
  const ARAO = (subj === 'اللغة العربية' || subj === 'التربية الإسلامية');
  // الرياضيات — وثيقة تقويم الرياضيات (سبتمبر 2026): مفردة إجابة طويلة واحدة في كل
  // اختبار قصير، بثلاث درجات للصفوف 7-10 وبأربع درجات للصفين 11-12، وبلا إجابة
  // طويلة في الصفين 5-6. فلا بد من تمرير درجاتها هنا وإلا سقطت من البنك.
  const isM = /رياض/.test(subj);
  const g = FG[grade] || 0, hi = g >= 11 && !ARAO, smax = hi ? 3 : 2,
        lr = isM ? (g >= 11 ? [4] : (g >= 7 ? [3] : []))
                 : (hi ? [4, 5] : (g >= 9 ? [3, 4] : []));
  const out = [];
  for (const q of G.q) {
    const m = q.m, ao = normAO(q.ao, hi, m);
    if (!ao || !q.l || typeof m !== 'number' || m !== Math.floor(m)) continue;
    let type;
    if (q.t === 'mcq') { if (m !== 1) continue; type = 'mcq'; }
    else if (m <= smax) type = 'short';
    else if (lr.includes(m) && ao !== 'معرفة' && ao !== 'AO1') type = 'long';
    else continue;
    const pa = G.papers[q.p] || {};
    out.push({ qid: 'f' + q.id, lesson_id: q.l, type, stem: stripQNo(q.x), img: q.im, iw: q.w, ih: q.h, srcno: String(q.n || ''), lb: q.lb || undefined, src: 'امتحان الوزارة ' + (pa.year || '') + (pa.session ? ' - ' + pa.session : ''),
      answer: q.a || '', fig: !!q.fig, choices: Array.isArray(q.ch) ? q.ch : [], correct: (typeof q.cor === 'number' ? q.cor : 0), marks: m, ao, difficulty: '', outcome: q.c || '', notes: '' });
  }
  return out;
}
const BUILD = __BUILD__;
// أسئلة ألعاب مولّدة من أهداف دروس الرياضيات 5-9 (لا تمسّ توليد الاختبارات)
const GMATH = __GAMESMATH__;
LESSONS.forEach(l => { if (!l.subject) l.subject = l.grade === 'الخامس' ? 'العلوم' : 'الأحياء'; if (!l.term) l.term = 1; });
const LESSON_IDS = new Set(LESSONS.map(l => l.id));
const courseKey = l => (l.subject || '') + '|' + (l.grade || '');
const CUSTOM_BASE = 100000;
const MANIFEST = JSON.stringify({ name: 'خبير', short_name: 'خبير', lang: 'ar', dir: 'rtl', start_url: '/', scope: '/', display: 'standalone', background_color: '#f6f5fc', theme_color: '#f6f5fc',
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] });

const SESSION_DAYS = 30;
const MAX_FAILS = 5;
const LOCK_MIN = 15;
const PBKDF2_ITER = 100000;
// جهاز لم يُستخدم هذه المدة يُعدّ مهجورًا، فيُستبدل تلقائيًا عند اكتمال الحد
// (تغيّر جهاز أو متصفح، أو مُسحت بيانات المتصفح) فلا يبقى المعلم محجوبًا.
// قابلة للضبط من بيئة الـWorker (STALE_SECONDS) لتسهيل الاختبار المحلي.
const STALE_DAYS = 30;
function staleSeconds(env) {
  const v = env && env.STALE_SECONDS ? parseInt(env.STALE_SECONDS, 10) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : STALE_DAYS * 86400;
}
const LESSON_FIELDS = ['title','unit_name','hw_type','weekly','hw_q1','hw_a1','hw_q2','hw_a2','concepts','pre_learning','outcomes','strategies','activities_teach','resources','formative','enrich','closing','homework','misconceptions'];
// أنواع الأحداث المقبولة في /api/event. أي نوع غير مذكور هنا يُرفض، فيضيع الحدث بصمت.
// عند إضافة track() جديد في client_*.js أضف نوعه هنا وأضف تسميته العربية في TYPES داخل client_admin.js.
const EVENT_TYPES = new Set([
  // التحضير والدروس
  'view', 'copy_all', 'copy_json', 'copy_field', 'copy_hw', 'send_prep', 'send_hw',
  // الاختبارات القصيرة ومراجعات الوحدات
  'quiz_make', 'review_make', 'quiz_print', 'quiz_word', 'quiz_save', 'remedy_make',
  // الاختبار التشخيصي
  'diag_run', 'diag_print',
  // تحليل النتائج · الأوراق المتمايزة · سجل صعوبات التعلم
  'analysis_new', 'research_gen', 'ai_research', 'ai_game', 'form_print', 'form_word', 'analysis_print', 'analysis_word', 'diff_make', 'diff_print', 'ld_print',
  // الخطط العلاجية والملخصات
  'remedial_make', 'remedial_print', 'remedial_word', 'summary_make', 'summary_print', 'summary_word',
  // الألعاب التعليمية
  'game_play', 'game_live',
  // الاختبارات النهائية السابقة
  'finals_open', 'finals_print',
  // تصحيح الواجبات
  'grade_start', 'tasks_fetch'
]);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'teacher', active INTEGER NOT NULL DEFAULT 1, max_devices INTEGER NOT NULL DEFAULT 2, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS devices(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, device_id TEXT NOT NULL, fp TEXT, label TEXT, ip TEXT, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, UNIQUE(user_id, device_id))`,
  `CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, device_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, grade TEXT, lesson_id INTEGER, lesson_title TEXT, detail TEXT, device_id TEXT, ip TEXT, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, user_id INTEGER, ok INTEGER NOT NULL, reason TEXT, device_id TEXT, label TEXT, ip TEXT, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS lesson_overrides(lesson_id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS custom_lessons(id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS courses(key TEXT PRIMARY KEY, subject TEXT NOT NULL, grade TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS quizzes(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, grade TEXT, subject TEXT, kind TEXT, data TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS qz_user ON quizzes(user_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY, owner INTEGER NOT NULL, title TEXT, grade TEXT, data TEXT NOT NULL, state TEXT NOT NULL, qi INTEGER NOT NULL DEFAULT -1, q_started INTEGER, dur INTEGER NOT NULL DEFAULT 20, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS players(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, name TEXT NOT NULL, token TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, ans_qi INTEGER NOT NULL DEFAULT -1, ans_choice INTEGER, ans_ok INTEGER, ans_pts INTEGER, ans_at INTEGER, joined_at INTEGER NOT NULL, UNIQUE(code, name))`,
  `CREATE INDEX IF NOT EXISTS pl_code ON players(code)`,
  `CREATE TABLE IF NOT EXISTS nour_tasks(user_id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS exports(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT, format TEXT, body TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS ai_items(id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, data TEXT NOT NULL, user_id INTEGER, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ai_items_l ON ai_items(lesson_id)`,
  `CREATE TABLE IF NOT EXISTS ai_log(id INTEGER PRIMARY KEY AUTOINCREMENT, who TEXT NOT NULL, kind TEXT NOT NULL, tokens INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ai_log_who ON ai_log(who, kind, at)`,
  `CREATE TABLE IF NOT EXISTS classes(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, course TEXT NOT NULL, lessons TEXT, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS s_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL, name TEXT, lesson_id INTEGER, score REAL, max REAL, n INTEGER, ip TEXT, at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sa_class ON s_attempts(class_id, at)`,
  `CREATE TABLE IF NOT EXISTS moves(code TEXT PRIMARY KEY, sid TEXT, did TEXT, exp INTEGER NOT NULL)`,
  // مركز الإشعارات: يضيف المدير الإعلانات من لوحة التحكم، ويتلقاها كل المستخدمين في الجرس بأعلى الشريط.
  // «مقروء» لكل مستخدم على حدة (جدول منفصل) - تبقى حتى لو مسح المتصفح تخزينه.
  `CREATE TABLE IF NOT EXISTS notices(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notice_reads(notice_id INTEGER NOT NULL, user_id INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(notice_id, user_id))`,
  `CREATE INDEX IF NOT EXISTS nr_user ON notice_reads(user_id)`,
  `CREATE INDEX IF NOT EXISTS ev_user ON events(user_id, type)`,
  `CREATE INDEX IF NOT EXISTS ev_at ON events(at)`,
  `CREATE INDEX IF NOT EXISTS at_user ON attempts(username, at)`
];
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map(s => db.prepare(s)));
  try { await db.prepare('ALTER TABLE users ADD COLUMN scope TEXT').run(); } catch (e) { /* already there */ }
  // «الشاملة»: معلمون نُقلوا إلى لوحة التحكم المخفية (/shamela) فلا يظهرون في اللوحة الأساسية
  try { await db.prepare('ALTER TABLE users ADD COLUMN vault INTEGER NOT NULL DEFAULT 0').run(); } catch (e) { /* already there */ }
  // «مدير مفوَّض»: معلم رُقّي إلى مدير (role='admin', delegated=1) — نفس صلاحيات المدير وأجهزة غير محدودة،
  // لكنه لا يستطيع المساس بالمدير الرئيسي، والمدير الرئيسي وحده يمنح التفويض ويسحبه.
  try { await db.prepare('ALTER TABLE users ADD COLUMN delegated INTEGER NOT NULL DEFAULT 0').run(); } catch (e) { /* already there */ }
  // فتح «الشاملة» بكلمة مرورها يُحفظ على الجلسة نفسها (يعمل حتى مع حجب الكوكيز)
  try { await db.prepare('ALTER TABLE sessions ADD COLUMN vault_ok INTEGER NOT NULL DEFAULT 0').run(); } catch (e) { /* already there */ }
  // الإشعارات: فيديو اختياري (يُعرض في الجرس ونافذة عند فتح الصفحة) ومنصة مستهدفة: k خبير · فارغ = الكل
  try { await db.prepare('ALTER TABLE notices ADD COLUMN video TEXT').run(); } catch (e) { /* already there */ }
  try { await db.prepare('ALTER TABLE notices ADD COLUMN brand TEXT').run(); } catch (e) { /* already there */ }
  // إشعار الفيديو الترويجي: يُنشر مرة واحدة فقط (لو حذفه المدير لا يعود)
  try {
    const seeded = await db.prepare("SELECT v FROM kv WHERE k = 'seed_promo_v1'").first();
    if (!seeded) {
      const t = Date.now();
      await db.batch([
        db.prepare('INSERT INTO notices(title,body,url,video,brand,created_at) VALUES(?,?,?,?,?,?)').bind('🎬 شاهد إعلان «خبير»', 'فيديو قصير في دقيقة: كيف تحوّل «خبير» حصتك — التحضير الجاهز، والاختبارات وفق الوثيقة، والألعاب التعليمية، والعروض… كل ما يحتاجه المعلم في مكان واحد. شاركه مع زملائك!', null, '/promo/kabsula.mp4', 'k', t),
        db.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES('seed_promo_v1','1')")
      ]);
    }
  } catch (e) { /* لا يوقف الموقع */ }
  schemaReady = true;
}

// ---------- helpers ----------
const now = () => Date.now();
const enc = new TextEncoder();
function hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function rand(n = 32) { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); }
async function hashPass(pw, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cookies(req) {
  const out = {}; (req.headers.get('Cookie') || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function setCookie(name, val, maxAgeSec, req) {
  // Secure على https فقط: بعض المتصفحات (WebKit/سافاري) ترفض كوكي Secure على http
  // — ولو كان localhost — فلا تُحفظ الجلسة ويُعاد المستخدم لصفحة الدخول.
  const https = req ? new URL(req.url).protocol === 'https:' : true;
  return `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly${https ? '; Secure' : ''}; SameSite=Lax; Max-Age=${maxAgeSec}`;
}
function ipOf(req) { return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || ''; }
// مدة مختصرة بالعربية لعرضها في رسائل الأجهزة
function ago(t) {
  if (!t) return 'غير معروف';
  const s = (now() - t) / 1000;
  if (s < 120) return 'قبل لحظات';
  if (s < 3600) return 'قبل ' + Math.floor(s / 60) + ' دقيقة';
  if (s < 86400) return 'قبل ' + Math.floor(s / 3600) + ' ساعة';
  const d = Math.floor(s / 86400);
  if (d === 1) return 'أمس';
  if (d < 30) return 'قبل ' + d + ' يومًا';
  return 'قبل ' + Math.floor(d / 30) + ' شهر';
}
function deviceLabel(ua) {
  ua = ua || '';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'جهاز';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'متصفح';
  return os + ' · ' + br;
}
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000'
};
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS, ...extra } });
}
// استجابة JSON كبيرة (كتالوج الدروس ~6.5MB) مع ETag: أول طلب يحمّل البيانات، وكل
// عودة لاحقة تُرجع **304 بلا جسم** — فكان الرجوع للصفحة الرئيسية يعيد تنزيل
// الكتالوج كاملًا فيبدو ثقيلًا.
function hashStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; } return h.toString(16); }
function jsonETag(req, data) {
  const body = JSON.stringify(data);
  const etag = '"' + (BUILD && BUILD.sha || '') + '-' + body.length.toString(36) + '-' + hashStr(body) + '"';
  const inm = req.headers.get('If-None-Match') || '';
  if (inm && inm.split(',').map(x => x.trim()).indexOf(etag) >= 0) {
    return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'private, no-cache', ...SEC_HEADERS } });
  }
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-cache', ETag: etag, ...SEC_HEADERS } });
}
function html(name, extra = {}) {
  if (name === 'cards') extra = { 'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()', ...extra };
  const nonce = rand(16);
  const body = PAGES[name].replace(/%NONCE%/g, nonce).replace('%CSS%', () => PAGES.css);
  // worker-src 'self' ضروري لـpdf.js: إن لم يُذكر يرث script-src (وهو nonce فقط)
  // فيُحجب عامل القراءة. والقصر على 'self' يمنع أي عامل خارجي.
  const csp = `default-src 'self'; script-src 'nonce-${nonce}'; worker-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`;
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': csp, ...SEC_HEADERS, ...extra } });
}
function redirect(to, extra = {}) { return new Response(null, { status: 302, headers: { Location: to, ...SEC_HEADERS, ...extra } }); }
async function body(req) {
  const t = await req.text();
  if (t.length > 2_000_000) throw new Error('too_large');
  try { return JSON.parse(t || '{}'); } catch { return {}; }
}
function sameOrigin(req) {
  const o = req.headers.get('Origin');
  if (!o) return true; // sendBeacon from same page may omit it in some browsers; cookies are SameSite=Lax
  try { return new URL(o).host === new URL(req.url).host; } catch { return false; }
}
function cleanUser(u) { return String(u || '').trim().toLowerCase().slice(0, 60); }

// ---------- auth ----------
async function currentUser(req, env) {
  const c = cookies(req);
  // الجلسة تُقرأ من الكوكي أولًا، ثم من ترويسة X-Tahdir-Sid. بعض المتصفحات
  // (المدمجة في واتساب/إنستقرام، أو مع حجب كوكيز الطرف الأول) ترفض كوكي الجلسة
  // فيعود المعلم لصفحة الدخول بعد كل محاولة ويُسجَّل جهاز جديد كل مرة.
  const sid = c.sid || String(req.headers.get('X-Tahdir-Sid') || '').trim();
  if (!sid) return null;
  const row = await env.DB.prepare(
    `SELECT s.token, s.device_id, s.expires_at, s.last_seen, s.vault_ok, u.id, u.name, u.username, u.role, u.active, u.scope, u.delegated
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).bind(sid).first();
  if (!row || row.expires_at < now() || !row.active) return null;
  // device must still be registered (admin may have removed it)
  if (row.role !== 'admin') {
    const d = await env.DB.prepare('SELECT id FROM devices WHERE user_id = ? AND device_id = ?').bind(row.id, row.device_id).first();
    if (!d) { await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(c.sid).run(); return null; }
  }
  if (now() - (row.last_seen || 0) > 5 * 60 * 1000) {
    await env.DB.batch([
      env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?').bind(now(), c.sid),
      env.DB.prepare('UPDATE devices SET last_seen = ? WHERE user_id = ? AND device_id = ?').bind(now(), row.id, row.device_id)
    ]);
  }
  return row;
}

async function login(req, env) {
  const b = await body(req);
  const username = cleanUser(b.username), password = String(b.password || '');
  const fp = String(b.fp || '').slice(0, 64);
  const ua = req.headers.get('User-Agent') || '';
  const label = deviceLabel(ua) + (b.screen ? ' · ' + String(b.screen).slice(0, 15) : '');
  const ip = ipOf(req);
  const c = cookies(req);
  // معرّف الجهاز من الكوكي، وإلا من ترويسة X-Tahdir-Did (متصفح بلا كوكيز).
  const hDid = String(req.headers.get('X-Tahdir-Did') || '').trim();
  let did = /^[a-f0-9]{48}$/.test(c.did || '') ? c.did : (/^[a-f0-9]{48}$/.test(hDid) ? hDid : null);
  const t = now();
  const logA = (ok, reason, uid) => env.DB.prepare('INSERT INTO attempts(username,user_id,ok,reason,device_id,label,ip,at) VALUES(?,?,?,?,?,?,?,?)').bind(username, uid || null, ok ? 1 : 0, reason, did || '', label, ip, t).run();

  if (!username || !password) return json({ error: 'اكتب اسم المستخدم وكلمة المرور.' }, 400);
  const fails = await env.DB.prepare('SELECT COUNT(*) n FROM attempts WHERE username = ? AND ok = 0 AND reason = ? AND at > ?').bind(username, 'wrong_password', t - LOCK_MIN * 60000).first();
  if (fails && fails.n >= MAX_FAILS) { await logA(false, 'locked'); return json({ error: `محاولات كثيرة خاطئة. حاول بعد ${LOCK_MIN} دقيقة.` }, 429); }

  const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  const ok = u ? safeEq(await hashPass(password, u.salt), u.pass_hash) : (await hashPass(password, '00'.repeat(16)), false);
  if (!u || !ok) { await logA(false, 'wrong_password', u && u.id); return json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' }, 401); }
  if (!u.active) { await logA(false, 'disabled', u.id); return json({ error: 'هذا الحساب موقوف. تواصل مع مدير المنصة.' }, 403); }

  // ---- device check ----
  const devs = (await env.DB.prepare('SELECT * FROM devices WHERE user_id = ?').bind(u.id).all()).results || [];
  let dev = did ? devs.find(d => d.device_id === did) : null;
  if (!dev && fp) { dev = devs.find(d => d.fp === fp); if (dev) did = dev.device_id; }
  if (!did) did = rand(24);
  if (!dev && u.role !== 'admin' && devs.length >= u.max_devices) {
    // الحد مكتمل. لكن الجهاز القديم الذي لم يُستخدم منذ STALE_DAYS يومًا يكون مهجورًا
    // (تغيّر جهاز/متصفح، أو بيانات متصفح مُمحاة)، فلا نُعطّل المعلم بسببه:
    // نُزيل الأقدم المهمل وندخله. أما لو كان الجهازان مستعملين فعلًا فنمنع (حماية من مشاركة الحساب).
    const oldest = devs.slice().sort((a, b) => (a.last_seen || 0) - (b.last_seen || 0))[0];
    const stale = oldest && (t - (oldest.last_seen || 0)) > staleSeconds(env) * 1000;
    if (stale) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND device_id = ?').bind(u.id, oldest.device_id),
        env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(oldest.id),
        env.DB.prepare('INSERT INTO events(user_id,type,detail,device_id,ip,at) VALUES(?,?,?,?,?,?)').bind(u.id, 'device_stale_removed', String(oldest.label || '').slice(0, 40), did, ip, t)
      ]);
    } else {
      await logA(false, 'device_limit', u.id);
      const list = devs.slice().sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0))
        .map(d => '• ' + (d.label || 'جهاز') + ' — آخر دخول ' + ago(d.last_seen)).join('\n');
      return json({
        error: `هذا الحساب مسجّل بالفعل على ${u.max_devices} أجهزة، وكلها مستعملة حديثًا. لا يمكن الدخول من جهاز جديد.\n\nأجهزتك المسجّلة:\n${list}\n\nإن كنت غيّرت جهازك، اطلب من مدير المنصة «مسح الأجهزة» ثم ادخل مرة أخرى.`
      }, 403, { 'Set-Cookie': setCookie('did', did, 63072000, req) });
    }
  }
  if (!dev) {
    await env.DB.prepare('INSERT INTO devices(user_id,device_id,fp,label,ip,first_seen,last_seen) VALUES(?,?,?,?,?,?,?)').bind(u.id, did, fp, label, ip, t, t).run();
  } else {
    await env.DB.prepare('UPDATE devices SET last_seen = ?, ip = ?, label = ?, fp = COALESCE(NULLIF(?,\'\'), fp) WHERE id = ?').bind(t, ip, label, fp, dev.id).run();
  }

  const token = rand(32);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions(token,user_id,device_id,created_at,expires_at,last_seen) VALUES(?,?,?,?,?,?)').bind(token, u.id, did, t, t + SESSION_DAYS * 86400000, t),
    env.DB.prepare('INSERT INTO events(user_id,type,device_id,ip,at) VALUES(?,?,?,?,?)').bind(u.id, 'login', did, ip, t),
    env.DB.prepare('INSERT INTO attempts(username,user_id,ok,reason,device_id,label,ip,at) VALUES(?,?,?,?,?,?,?,?)').bind(username, u.id, 1, 'ok', did, label, ip, t),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t)
  ]);
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS });
  headers.append('Set-Cookie', setCookie('sid', token, SESSION_DAYS * 86400, req));
  headers.append('Set-Cookie', setCookie('did', did, 63072000, req));
  // نُعيد الرمز في الجسم أيضًا ليعمل المتصفح الذي يرفض الكوكيز (انظر currentUser).
  return new Response(JSON.stringify({ ok: true, role: u.role, name: u.name, sid: token, did }), { headers });
}

// ---------- lessons ----------
function scopeOf(me) {
  if (!me || me.role === 'admin' || !me.scope) return null;
  try { const a = JSON.parse(me.scope); return Array.isArray(a) && a.length ? new Set(a) : null; } catch { return null; }
}
// إزالة التطويل «ـ» من نصوص الدروس المعدّلة/المضافة من لوحة التحكم (كما يُطبَّق على البيانات عند البناء)
function untat(o) {
  if (typeof o === 'string') return o.indexOf('\u0640') < 0 ? o : o.replace(/(?<=[\u0621-\u063A\u0641-\u064A\u0671-\u06D3\u064B-\u065F])\u0640+(?=[\u064B-\u065F]*[\u0621-\u063A\u0641-\u064A\u0671-\u06D3])/g, '').replace(/(?<=[\u0621-\u063A\u0641-\u064A\u0671-\u06D3\u064B-\u065F])\u0640{2,}/g, '\u0640').replace(/\u0640{2,}/g, '-');
  if (Array.isArray(o)) return o.map(untat);
  if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = untat(o[k]); return r; }
  return o;
}
async function customLessons(env) {
  const rows = (await env.DB.prepare('SELECT id, data FROM custom_lessons ORDER BY id').all()).results || [];
  const out = []; rows.forEach(r => { try { out.push({ ...untat(JSON.parse(r.data)), id: r.id, custom: true, ai_filled: [] }); } catch {} });
  return out;
}
async function allLessons(env) {
  const rows = (await env.DB.prepare('SELECT lesson_id, data FROM lesson_overrides').all()).results || [];
  const ov = {}; rows.forEach(r => { try { ov[r.lesson_id] = untat(JSON.parse(r.data)); } catch {} });
  const base = LESSONS.map(l => ov[l.id] ? { ...l, ...ov[l.id], ai_filled: (l.ai_filled || []).filter(k => !(k in ov[l.id])) } : l);
  return base.concat(await customLessons(env));
}
async function lessonsFor(env, me) {
  const all = await allLessons(env), sc = scopeOf(me);
  return sc ? all.filter(l => sc.has(courseKey(l))) : all;
}
async function coursesList(env) {
  const all = await allLessons(env), m = new Map();
  all.forEach(l => { const k = courseKey(l); const c = m.get(k) || { key: k, subject: l.subject, grade: l.grade, lessons: 0, custom: 0, quiz_items: 0 }; c.lessons++; if (l.custom) c.custom++; m.set(k, c); });
  const extra = (await env.DB.prepare('SELECT key, subject, grade FROM courses').all()).results || [];
  extra.forEach(c => { if (!m.has(c.key)) m.set(c.key, { key: c.key, subject: c.subject, grade: c.grade, lessons: 0, custom: 0, quiz_items: 0, empty: true }); });
  const byLesson = new Map(all.map(l => [l.id, courseKey(l)]));
  QBANK.forEach(q => { const k = byLesson.get(q.lesson_id); if (k && m.get(k)) m.get(k).quiz_items++; });
  // **النهائيات تُغذي مولّد الاختبارات القصيرة** (عبر finQuizItems)، وكان العدّاد
  // يحسب QBANK وحده — فظهرت موادّ نهائياتها كاملة بعبارة «بدون بنك أسئلة» ومنعت
  // بناء الورقة. نضيف مفردات النهائيات الصالحة إلى عدّاد كل مقرر.
  m.forEach(c => {
    try { const f = finQuizItems(c.key).length; if (f) c.quiz_items += f; } catch (e) {}
  });
  return [...m.values()];
}

// ---------- مصحّح الاختبار القصير: قواعد فحص ورقة **نصّية** مرفوعة ----------
// المتصفح يستخرج النصّ من Word/PDF ثم يُرسله هنا. لذا لا نعرف توزيع الأهداف (AO)
// لأنه غير مطبوع في الورقة — نفحص ما هو مرئي: الترقيم · العدد · الدرجات ·
// صياغة بداية السؤال · سلامة الخيارات.
const QSTART = /^(ما|ماذا|كيف|لماذا|لمَ|أي|أيّ|متى|أين|كم|هل|من|مَن|اذكر|اذكري|عدّد|عدد|عدّ|عرّف|عرف|اشرح|فسّر|فسر|وضّح|بيّن|صِف|صف|قارن|احسب|علّل|علل|صنّف|صنف|رتّب|رتب|توقّع|توقع|سمِّ|سمّ|سم|حدّد|حدد|أعط|اعط|اكتب|أكمل|اكمل|استنتج|استخرج|استدل|ميّز|ميز|قدّر|قدر|ناقش|برهن|أثبت|اثبت|أوجد|اوجد|ارسم|ضع|ظلّل|ظلل|اختر|أجب|اجب|ادرس|تأمّل|تأمل|لاحظ|انظر|استعن|استخدم|املأ|صل|طابق|حلّل|حلل|اقترح|صحّح|صحح|سجّل|سجل|قيّم|قيم|بين|ارسمي|اقرأ|تتبّع|تتبع|تنبأ|تنبّأ|توقع|تنبا)(?=\s|$|[\?؟:،\.])/;
const SHORT_SPECS = (function () {
  // مواصفات الاختبار القصير لمواد العلوم — مستخرجة من وثيقتي تقويم تعلم الطلبة
  // (5-10) و(11-12) للعام 2026-2027 (site.moe.gov.om).
  const ko59 = { total: 15, items: [9, 12], aoMode: 'KO', targets: { 'معرفة': 6, 'تطبيق': 6, 'استدلال': 3 }, mcqCount: 3, long: { count: 0, marks: [] } };
  const ko9 = { total: 15, items: [9, 12], aoMode: 'KO', targets: { 'معرفة': 6, 'تطبيق': 6, 'استدلال': 3 }, mcqCount: 3, long: { count: 1, marks: [3, 4] } };
  const ko10 = { total: 10, items: [5, 7], aoMode: 'KO', targets: { 'معرفة': 4, 'تطبيق': 4, 'استدلال': 2 }, mcqCount: 2, long: { count: 1, marks: [3, 4] } };
  const ao11 = { total: 10, items: [5, 99], aoMode: 'AO', targets: { 'AO1': 3, 'AO2': 7 }, mcqCount: 2, long: { count: 1, marks: [4, 5] } };
  return { 5: ko59, 6: ko59, 7: ko59, 8: ko59, 9: ko9, 10: ko10, 11: ao11, 12: ao11 };
})();

function checkQuizText(text, grade, subject, withAnswer) {
  // NFKC: أشكال العرض العربية (ﻓﻲ اﻟﺸﻜﻞ) تُردّ إلى حروفها الأصلية فتُقرأ الكلمات.
  // ولام-ألف المركّبة تخرج من PDF مقلوبة في أول الكلمة («األمراض» بدل «الأمراض»).
  const clean = s => String(s || '').normalize('NFKC').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\u200c/g, ' ')
    .replace(/(^|[^\u0621-\u064A])([وفبك]?)ا([اأإآ])ل/g, '$1$2ال$3')
    .replace(/[\u0660-\u0669]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    .replace(/[\u06f0-\u06f9]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 48))
    // درجات مكتوبة بأقواس معكوسة في بعض ملفات PDF: «]4[» بدل «[4]»
    .replace(/\]\s*(\d{1,2})\s*\[/g, '[$1]')
    // أقواس الدرجة تتشابك مع علامات مجاورة عند تصدير Word إلى PDF: «[ )1]» و«[ .4]»
    .replace(/[\[\]]\s*[\.\)\(،\-]?\s*(\d{1,2})\s*[\.\)\(،\-]?\s*[\[\]]/g, '[$1]')
    .replace(/\[\s*(\d{1,2})\s*\[/g, '[$1]');
  // **كشف النصّ المعكوس**: ملفات PDF عربية كثيرة تخزّن الحروف بترتيب بصري (RTL)
  // فيخرج السطر «: مسلأا نامع ةنطلس» بدل «سلطنة عمان الأصل:». العلامة العملية أن
  // أرقام الأسئلة تظهر **في نهاية** السطر «)1» بدل بدايته «1)». فنعكس كل سطر.
  // **تصحيح ترتيب النصّ**: ملفات PDF العربية تُخرج الكلمات بترتيب **بصري** (الكلمة
  // الأخيرة أوّلًا) وحروف كل كلمة سليمة. فنحاول ثلاثة ترتيبات ونختار الأصحّ بقياس
  // عدد الكلمات العربية الشائعة الظاهرة (النصّ السليم يحتويها بكثرة).
  const COMMON = ['من', 'في', 'على', 'أن', 'هذا', 'هذه', 'التي', 'الذي', 'مع', 'عن', 'إلى', 'الى', 'هو', 'هي', 'ما', 'لا', 'كل', 'بعد', 'قبل', 'بين', 'عند', 'كان', 'قد', 'أو', 'او', 'ثم', 'لكن', 'عدد', 'سؤال', 'الدرجة', 'يجب', 'أي', 'اي'];
  const wordsOf = s => new Set((String(s).match(/[\u0600-\u06FF]+/g) || []));
  const hitsOf = s => { const w = wordsOf(s); let n = 0; COMMON.forEach(x => { if (w.has(x)) n++; }); return n; };
  const fixNum = l => {
    const m = /^[\.\)\-،]?\s*(\d{1,2})\s*[\.\)\-،]?\s+/.exec(l);
    return m ? (m[1] + ') ' + l.slice(m[0].length)) : l;
  };
  let norm = clean(text);
  let unreversed = false;
  const hBase = hitsOf(norm);
  // في الترتيب البصري يأتي رقم المفردة **ملتصقًا بآخر كلمة** («…كشفت.1»).
  // فنفصله أولًا، ثم نعكس ترتيب الكلمات، ثم نُعيد الرقم إلى أوّل السطر.
  const revWordsLine = l => {
    let s = l.trim(), num = null;
    const mEnd = /^(.*?)[\s]*[\.\)\-،]?\s*(\d{1,2})\s*[\.\)\-،]?\s*$/.exec(s);
    if (mEnd && mEnd[1].trim()) { num = mEnd[2]; s = mEnd[1].trim(); }
    const r = s.split(/\s+/).reverse().join(' ');
    return num ? (num + ') ' + r) : r;
  };
  const byChars = norm.split('\n').map(l => l.split('').reverse().join('')).join('\n');
  const byWords = norm.split('\n').map(revWordsLine).join('\n');
  const hChars = hitsOf(byChars), hWords = hitsOf(byWords);
  const bestHits = Math.max(hBase, hChars, hWords);
  if (bestHits > hBase && bestHits === hWords) {
    norm = byWords.split('\n').map(fixNum).join('\n'); unreversed = true;
  } else if (bestHits > hBase && bestHits === hChars) {
    norm = byChars.split('\n').map(fixNum).join('\n'); unreversed = true;
  }
  // **رقم المفردة في نهاية السطر**: بعض ملفات PDF تلصق الرقم بآخر كلمة («…كشفت.1»)
  // بدل أن تبدأ به. ننقله إلى أوّل السطر — بشرط أن يسبقه نصّ كافٍ حتى لا نحوّل
  // أرقام الخيارات («1- …») إلى مفردات.
  // لا نطبّقها إن كانت الأرقام في أوائل الأسطر أصلًا (ترتيب سليم): وإلا تحوّل سطر
  // ينتهي بـ«الشكل (4-1)» أو بالعام الدراسي إلى مفردة وهمية تكسر الترقيم.
  const leadNums = norm.split('\n').filter(l => /^\s*\d{1,2}\s*[\)\.\-]\s*\S/.test(l)).length;
  if (leadNums < 3) norm = norm.split('\n').map(l => {
    const s = l.trim();
    const m = /^(.*\S)\s*[\.\)\-،]?\s*(\d{1,2})\s*[\.\)\-،]?\s*$/.exec(s);
    if (!m) return l;
    const body = m[1].trim(), num = m[2];
    if (body.length < 15) return l;                 // نصّ قصير جدًا: ليس مفردة
    if (/^\d{1,2}\s*[\)\.\-]/.test(body)) return l;  // يبدأ برقم أصلًا
    return num + ') ' + body;
  }).join('\n');
  // بوّابة جودة: نصّ عربي كثير بلا كلمات شائعة = مقروء خطأً (بصري/ممسوح)
  if (wordsOf(norm).size >= 12 && bestHits < 3) {
    return {
      unreadable: true,
      message: 'لم أستطع قراءة نصّ هذا الملف بدقة (يخزّن الحروف بترتيب بصري أو أنه صور ممسوحة). '
        + 'افحص نسخة Word من الورقة، أو انسخ النصّ والصقه في المربّع — فالفحص يعتمد على النصّ لا على الشكل.',
      summary: { items: 0, marks: 0, expectedMarks: 0, grade: 0, fails: 0, warns: 0, unreversed: false },
      checks: [], items: [],
    };
  }
  // **تشوّه خطوط Word عند التصدير إلى PDF**: حروف متصلة تُخزَّن مقلوبة («عىل» = على،
  // «يف» = في، «منوذج» = نموذج، «املحلول» = المحلول، «استدالل» = استدلال، «فرس» = فسّر).
  // نصلح الأشيع منها لأن عليها تقوم قراءة نموذج الإجابة وأهداف التقويم وصياغة الأسئلة.
  norm = norm
    .replace(/(^|[^\u0621-\u064A])عىل(?=[^\u0621-\u064A]|$)/g, '$1على')
    .replace(/(^|[^\u0621-\u064A])([إا])ىل(?=[^\u0621-\u064A]|$)/g, '$1إلى')
    .replace(/(^|[^\u0621-\u064A])يف(?=[^\u0621-\u064A]|$)/g, '$1في')
    .replace(/(^|[^\u0621-\u064A])فرس(?=[^\u0621-\u064A]|$)/g, '$1فسر')
    .replace(/منوذج/g, 'نموذج')
    .replace(/استد(?:الل|اللل)/g, 'استدلال')
    .replace(/(^|[^\u0621-\u064A])([وفبك]?)امل(?!أ)(?=[\u0621-\u064A]{2})/g, '$1$2الم');
  const all = norm.split('\n').map(l => l.trim()).filter(l => l);
  const g = FG[grade] || 11;
  const spec = SHORT_SPECS[g] || SHORT_SPECS[11];
  // نموذج الإجابة قد يعيد الترقيم من 1 — نعزله قبل التحليل، ونقرأ منه هدف كل سؤال.
  const ANS_MARK = /(نموذج\s*(?:ال)?[إا]جابة|نموذج\s*الحل|ال[إا]جابة\s*النموذجية|مفتاح\s*ال[إا]جابة|answer\s*key|marking\s*scheme)/i;
  let ansAt = -1;
  if (withAnswer !== false) {
    for (let i = 0; i < all.length; i++) { if (ANS_MARK.test(all[i])) { ansAt = i; break; } }
  }
  const lines = ansAt < 0 ? all : all.slice(0, ansAt);
  const ansLines = ansAt < 0 ? [] : all.slice(ansAt + 1);
  const goalMap = {}, goalList = {}, keyMarks = {};
  // هدف التقويم كلمة مستقلة في عمود «هدف التقويم» («والتطبيق بدرجة» في الملاحظات ليست هدفًا)
  const GW = /(?:^|\s)(معرفة|تطبيق|استدلال|تذكر|فهم|AO\s*[123])(?=\s|$|[\.،])/gi;
  if (ansLines.length) {
    let cur = null;
    ansLines.forEach(l => {
      // في جدول نموذج الإجابة يبدأ السطر برقم المفردة (1 أو «2 (أ)»)؛ ونقبل الرقم فقط إن
      // كان استمرارًا للمفردة الحالية أو التي تليها، حتى لا تُحسب الدرجة «2» رقمَ مفردة.
      const m = /^(\d{1,2})(?=\s|[\)\.\-]|$)/.exec(l);
      if (m && (cur == null ? +m[1] === 1 : (+m[1] === cur || +m[1] === cur + 1))) cur = +m[1];
      if (!cur) return;
      let gm; GW.lastIndex = 0;
      while ((gm = GW.exec(l))) {
        let gg = gm[1].replace(/\s/g, '');
        gg = /^AO/i.test(gg) ? gg.toUpperCase() : (gg === 'تذكر' || gg === 'فهم') ? 'معرفة' : gg;
        (goalList[cur] = goalList[cur] || []).push(gg);
      }
      if (keyMarks[cur] == null) {
        const rest = l.replace(/^\d{1,2}\s*/, '').replace(/\d{1,2}\s*-\s*\d{1,2}/g, ' ');
        const km = /(?:^|\s)([1-6])(?=\s|$)/.exec(rest);
        if (km) keyMarks[cur] = +km[1];
      }
      const a = /AO\s*([123])/i.exec(l);
      if (a) goalMap[cur] = 'AO' + a[1];
      else if (!goalMap[cur]) {
        if (/استدلال|تحليل|تقييم/.test(l)) goalMap[cur] = 'استدلال';
        else if (/تطبيق/.test(l)) goalMap[cur] = 'تطبيق';
        else if (/معرفة|تذكر|فهم/.test(l)) goalMap[cur] = 'معرفة';
      }
    });
  }
  const starts = [];
  lines.forEach((l, i) => {
    const m = /^(\d{1,2})\s*[\)\.\-]\s*(.*)$/.exec(l);
    if (m) starts.push({ i, n: +m[1], rest: (m[2] || '').trim() });
  });
  const items = starts.map((s, k) => {
    const end = k + 1 < starts.length ? starts[k + 1].i : lines.length;
    const body = lines.slice(s.i, end).join('\n').trim();
    const bodyNoNum = body.replace(/^[\(\[]?\s*\d{1,2}\s*[\)\]\-\.]\s*/, '').trim();
    // الدرجة تُطبع في **وسط** المفردة لا آخرها، وقد تتعدّد إن كان للسؤال أجزاء
    // (أ) و(ب) — فنجمع كل [n] في المفردة بدل أخذ الأول.
    let marks = null;
    const allM = bodyNoNum.match(/\[\s*(\d{1,2})\s*\]/g) || [];
    if (allM.length) {
      marks = allM.reduce((a, x) => a + (+(/\d{1,2}/.exec(x) || [0])[0]), 0);
    } else {
      const mm = /[\[\(]\s*(\d{1,2})\s*[\]\)]\s*$/.exec(bodyNoNum) || /\s[\[\(]\s*(\d{1,2})\s*[\]\)]\s*$/.exec(bodyNoNum);
      if (mm) marks = +mm[1];
    }
    const optMarks = (bodyNoNum.match(/(^|\s)[أبجد]\s*[\)\]]/g) || []).length;
    const bubbled = (bodyNoNum.match(/\u2b2d/g) || []).length;
    // **خيارات مرقّمة**: كثير من أوراق الوزارة ترقّم الخيارات (1- 2- 3- 4-) بدل الحروف.
    // وجود الأرقام 1..4 داخل المفردة علامة قوية على أنها اختيار من متعدد.
    const numSet = {};
    (bodyNoNum.match(/(?:^|\s)([1-4])\s*[-–\)\.]/g) || []).forEach(s => { const d = (/[1-4]/.exec(s) || [])[0]; if (d) numSet[d] = 1; });
    const numOpts = Object.keys(numSet).length;
    // خيارات بحروف لاتينية مفردة (X W Z Y) — شائعة في أسئلة التوصيل والتظليل
    const latin = {};
    (bodyNoNum.match(/(?:^|\s)([A-Za-z])(?=\s|$)/g) || []).forEach(s => { const c = s.trim(); if (c) latin[c.toUpperCase()] = 1; });
    const latinOpts = Object.keys(latin).length;
    // عبارات التعليم على الاختيار («ظلل الشكل ()») علامة قاطعة على سؤال اختيار
    // حتى لو جاءت خياراته كلماتٍ عادية لا حروفًا.
    const tickHint = /ظل+ل\s*الشكل|ظل+ل\s*\(|ضع\s*دائرة|اختر\s*الإجابة|ضع\s*علامة/i.test(bodyNoNum);
    // سؤال فيه أسطر إجابة (____) أو «فسّر إجابتك» سؤال كتابي وإن طُلب فيه تظليل اختيار
    const writes = /_{5,}/.test(bodyNoNum) || /فس+ر\s*[إا]جابتك|علل\s*[إا]جابتك/.test(bodyNoNum);
    const isMcq = !writes && (optMarks >= 3 || bubbled >= 3 || numOpts >= 4 || latinOpts >= 4 || tickHint);
    // الفروع (أ. ب. ج.) تُحسب مفردات في جدول المواصفات
    const parts = isMcq ? 0 : (bodyNoNum.match(/(?:^|\n)\s*[أبجده]\s*[\.\)]\s*\S/g) || []).length;
    const partMarks = allM.map(x => +(/\d{1,2}/.exec(x) || [0])[0]);
    if (marks == null && keyMarks[s.n] != null) marks = keyMarks[s.n];
    const firstPart = bodyNoNum.split(/\n/).filter(x => !/^\s*[أبجد]\s*[\)\]]/.test(x)).join(' ').slice(0, 120);
    const gl = goalList[s.n] || [];
    // توزيع درجات المفردة على أهدافها: إن تعددت الأهداف بعدد فروع الدرجات نوزّعها بالترتيب
    let goalMarks = null;
    if (gl.length > 1 && partMarks.length === gl.length) { goalMarks = {}; gl.forEach((k, j) => { goalMarks[k] = (goalMarks[k] || 0) + partMarks[j]; }); }
    let goal = gl[0] || goalMap[s.n] || null;
    if (!goal) {
      const aoM = /AO\s*([123])/i.exec(bodyNoNum);
      if (aoM) goal = 'AO' + aoM[1];
      else if (/استدلال|تحليل|تقييم/.test(bodyNoNum)) goal = 'استدلال';
      else if (/تطبيق/.test(bodyNoNum)) goal = 'تطبيق';
      else if (/معرفة|تذكر|فهم/.test(bodyNoNum)) goal = 'معرفة';
    }
    // عدد الخيارات: -1 تعني «اختيار مؤكَّد لكن الخيارات نصّية لا تُعدّ» فلا نحكم عليها
    const optCount = Math.max(optMarks, bubbled, numOpts, latinOpts);
    // بداية السؤال: إن بدأت المفردة بسياق («يوضح الشكل…») نقبلها إذا جاء بعده سؤال صحيح
    const segs = bodyNoNum.replace(/_{3,}/g, ' ').split(/\n|[\.؟:]\s+|\s-\s/).map(x => x.replace(/^[\s\-–•]*([أبجده]\s*[\.\)])?\s*/, '').trim()).filter(Boolean);
    const qOk = segs.some(x => QSTART.test(x));
    return { n: s.n, marks, isMcq, parts, goalMarks, qOk, partMax: partMarks.length > 1 ? Math.max.apply(null, partMarks) : null, opts: optCount ? optCount : (tickHint ? -1 : 0), goal, start: firstPart.trim(), raw: bodyNoNum };
  });
  const checks = [];
  const add = (id, title, status, detail) => checks.push({ id, title, status, detail });
  // ① الترقيم
  const nums = items.map(x => x.n);
  const seqOk = nums.every((n, i) => n === i + 1);
  add('num-seq', 'ترقيم المفردات متسلسل بلا فجوات', seqOk ? 'pass' : 'fail',
    seqOk ? ' 1 · 2 · … · ' + nums.length : 'التسلسل: ' + nums.join(' · '));
  const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
  add('num-dup', 'لا تكرار في الأرقام', dup.length ? 'fail' : 'pass', dup.length ? 'مكرّر: ' + [...new Set(dup)].join('، ') : 'لا تكرار');
  // ② عدد المفردات
  const cnt = items.length, lo = spec.items[0], hi = spec.items[1];
  const cntP = items.reduce((a, x) => a + Math.max(1, x.parts || 0), 0);
  const cntLabel = hi >= 99 ? 'لا تقل عن ' + lo : lo + '–' + hi;
  add('count', 'عدد المفردات ' + cntLabel, (cntP >= lo && cntP <= hi) ? 'pass' : 'fail', cntP === cnt ? cnt + ' مفردة' : cntP + ' مفردة (' + cnt + ' أسئلة بفروعها)');
  // ③ الدرجة الكلية
  const withMarks = items.filter(x => x.marks != null);
  const total = withMarks.reduce((a, x) => a + x.marks, 0);
  const allMarks = withMarks.length === cnt;
  add('total', 'الدرجة الكلية ' + spec.total,
    (allMarks && total === spec.total) ? 'pass' : (allMarks ? 'fail' : 'warn'),
    withMarks.length
      ? (allMarks ? (total + ' درجة') : ('قُرئت ' + withMarks.length + ' من ' + cnt + ' درجة — الورقة المطبوعة قد لا تُظهر درجات المفردات'))
      : 'لم أتمكّن من قراءة الدرجات — تأكد أنها مكتوبة هكذا [4]');
  // ④ بداية السؤال
  // قاعدة الصياغة تُطبَّق على المفردات **الكتابية** فقط؛ سؤال الاختيار نصّه غالبًا
  // عبارة يكملها الخيار («جميع ما يلي… ما عدا») فهو سليم وإن لم يبدأ باستفهام.
  const textItems = items.filter(x => !x.isMcq);
  const badStart = textItems.filter(x => x.start && !QSTART.test(x.start) && !x.qOk);
  add('qstart', 'المفردات الكتابية تبدأ بأداة استفهام أو فعل أمر', badStart.length ? 'warn' : 'pass',
    badStart.length ? 'تحتاج مراجعة: ' + badStart.map(x => 'م' + x.n).join('، ') : (textItems.length ? 'كل المفردات سليمة' : 'لا مفردات كتابية'));
  // ⑤ الخيارات
  const mcqs = items.filter(x => x.isMcq);
  const badOpt = mcqs.filter(x => x.opts > 0 && x.opts !== 4);
  const unknownOpt = mcqs.filter(x => x.opts < 0);
  add('opts', 'كل اختيار من متعدد له 4 خيارات', badOpt.length ? 'fail' : 'pass',
    mcqs.length
      ? (badOpt.length ? 'عدد خاطئ في: ' + badOpt.map(x => 'م' + x.n + '(' + x.opts + ')').join('، ')
        : (unknownOpt.length ? ((mcqs.length - unknownOpt.length) ? 'صحيح في ' + (mcqs.length - unknownOpt.length) + ' · ' : '') + 'خيارات مرسومة أو نصّية لا تُعدّ آليًّا في ' + unknownOpt.map(x => 'م' + x.n).join('، ') : mcqs.length + ' سؤالًا بخيارات سليمة'))
      : 'لا أسئلة اختيار');
  // ⑥ خيارات مكرّرة
  const dupOpt = [];
  items.forEach(x => {
    if (!x.isMcq) return;
    const opts = x.raw.split(/\n/).map(l => (/(^|\s)[أبجد]\s*[\)\]]\s*/.exec(l) || [''])[0] ? l.replace(/^.*?[أبجد]\s*[\)\]]\s*/, '').trim() : '').filter(Boolean);
    if (opts.length >= 2 && new Set(opts).size < opts.length) dupOpt.push(x.n);
  });
  add('opts-dup', 'لا خيارات مكرّرة', dupOpt.length ? 'warn' : 'pass', dupOpt.length ? 'في: ' + dupOpt.map(n => 'م' + n).join('، ') : 'لا تكرار');
  // ⑦ مفردة فارغة
  const empty = items.filter(x => (x.raw || '').replace(/\s/g, '').length < 8);
  add('empty', 'لا مفردة فارغة', empty.length ? 'fail' : 'pass', empty.length ? 'فارغة: ' + empty.map(x => 'م' + x.n).join('، ') : 'سليمة');
  // ⑧ أرقام وزراية متبقّية
  const orig = items.filter(x => /^\s*\(?\s*\d{1,2}\s*\)\s*\d+\s*\)/.test(x.raw));
  add('orig-no', 'لا رقم وزراي متبقٍّ', orig.length ? 'warn' : 'pass', orig.length ? 'في: ' + orig.map(x => 'م' + x.n).join('، ') : 'نظيف');
  // ⑨ توزيع الأهداف (يُفحص إن وُجد هدف لكل مفردة من نموذج الإجابة)
  const withGoal = items.filter(x => x.goal);
  if (withGoal.length === items.length && items.length) {
    const goals = Object.keys(spec.targets);
    const got = {}, want = spec.targets;
    goals.forEach(k => got[k] = 0);
    items.forEach(x => { if (x.goalMarks) Object.keys(x.goalMarks).forEach(k => { got[k] = (got[k] || 0) + x.goalMarks[k]; }); else got[x.goal] = (got[x.goal] || 0) + (x.marks || 0); });
    const okD = goals.every(k => got[k] === want[k]);
    const wantTxt = goals.map(k => k + '=' + want[k]).join(' · ');
    add('ao', 'توزيع الأهداف: ' + wantTxt, okD ? 'pass' : 'fail', goals.map(k => k + '=' + got[k]).join(' · '));
  } else {
    add('ao', 'توزيع الأهداف ' + Object.keys(spec.targets).join(' / '), 'skip',
      withGoal.length ? 'قُرئ في ' + withGoal.length + ' من ' + items.length + ' مفردات' : withAnswer === false ? 'لم يُفحص: علّم «الملف يحتوي نموذج الإجابة»' : 'لم أجد الأهداف في نموذج الإجابة');
  }
  // ⑩ عدد اختيار من متعدد وإجابة طويلة (وفق وثيقة الصف)
  const nMcq = items.filter(x => x.isMcq).length;
  add('mcq2', 'مفردات اختيار من متعدد: ' + spec.mcqCount, nMcq === spec.mcqCount ? 'pass' : 'fail', nMcq + ' مفردة');
  if (spec.long.count) {
    const loM = Math.min.apply(null, spec.long.marks);
    const nLong = items.filter(x => !x.isMcq && (x.partMax != null ? x.partMax : x.marks) >= loM).length;
    add('long1', 'مفردة إجابة طويلة واحدة (' + spec.long.marks.join('–') + ')', nLong === 1 ? 'pass' : 'warn', nLong + ' مفردة');
  }
  const fails = checks.filter(c => c.status === 'fail').length, warns = checks.filter(c => c.status === 'warn').length;
  return {
    ok: fails === 0, summary: { items: cnt, marks: total, expectedMarks: spec.total, grade: g, range: spec.items, fails, warns, unreversed: unreversed },
    checks, items: items.map(x => ({ n: x.n, marks: x.marks, mcq: x.isMcq, opts: x.opts, goal: x.goal, start: x.start.slice(0, 90) })),
  };
}

// اللوحة الأساسية تعرض المدير والمعلمين غير المنقولين، و«الشاملة» تعرض المنقولين فقط
const VAULT_PW_SHA = 'b7d6b125623bd91adbe6793c8df91eb88f90182b85717c5cbf8ba6ec6b39d2fe';
const inVault = (u, vault) => vault ? (+u.vault === 1 && u.role !== 'admin') : !(+u.vault === 1 && u.role !== 'admin');
async function adminStats(env, vault) {
  const DB = env.DB;
  const users = ((await DB.prepare("SELECT id,name,username,role,active,max_devices,created_at,scope,vault,delegated FROM users ORDER BY role='admin' DESC, name").all()).results || []).filter(u => inVault(u, vault));
  const agg = (await DB.prepare(`SELECT user_id,
      SUM(type='login') logins,
      SUM(type LIKE 'copy%') copies,
      COUNT(DISTINCT CASE WHEN type LIKE 'copy%' THEN lesson_id END) lessons_copied,
      COUNT(DISTINCT CASE WHEN type='view' THEN lesson_id END) lessons_viewed,
      MAX(CASE WHEN type='login' THEN at END) last_login,
      MAX(at) last_active
    FROM events GROUP BY user_id`).all()).results || [];
  const grades = (await DB.prepare("SELECT user_id, grade, COUNT(*) n FROM events WHERE grade IS NOT NULL AND grade<>'' GROUP BY user_id, grade").all()).results || [];
  const devs = (await DB.prepare('SELECT id,user_id,device_id,label,ip,first_seen,last_seen FROM devices ORDER BY last_seen DESC').all()).results || [];
  const blocked = (await DB.prepare("SELECT user_id, COUNT(*) n, MAX(at) last FROM attempts WHERE reason='device_limit' GROUP BY user_id").all()).results || [];
  const top = (await DB.prepare("SELECT user_id, lesson_title, grade, COUNT(*) n FROM events WHERE type LIKE 'copy%' GROUP BY user_id, lesson_id ORDER BY n DESC").all()).results || [];
  const weekAgo = now() - 7 * 86400000;
  const active7 = await DB.prepare("SELECT COUNT(DISTINCT user_id) n FROM events WHERE at > ?").bind(weekAgo).first();
  const totals = await DB.prepare("SELECT SUM(type='login') logins, SUM(type LIKE 'copy%') copies FROM events").first();
  const by = (arr, k = 'user_id') => arr.reduce((m, r) => ((m[r[k]] = m[r[k]] || []).push(r), m), {});
  const A = Object.fromEntries(agg.map(r => [r.user_id, r])), G = by(grades), D = by(devs), B = Object.fromEntries(blocked.map(r => [r.user_id, r])), T = by(top);
  const sumA = k => users.reduce((t, u) => t + ((A[u.id] && +A[u.id][k]) || 0), 0);
  return {
    totals: { teachers: users.filter(u => u.role === 'teacher').length, active7: users.filter(u => A[u.id] && A[u.id].last_active > weekAgo).length, logins: sumA('logins'), copies: sumA('copies') },
    users: users.map(u => ({
      ...u,
      logins: (A[u.id] && A[u.id].logins) || 0,
      copies: (A[u.id] && A[u.id].copies) || 0,
      lessons_copied: (A[u.id] && A[u.id].lessons_copied) || 0,
      lessons_viewed: (A[u.id] && A[u.id].lessons_viewed) || 0,
      last_login: A[u.id] && A[u.id].last_login, last_active: A[u.id] && A[u.id].last_active,
      grades: (G[u.id] || []).map(g => ({ grade: g.grade, n: g.n })),
      devices: (D[u.id] || []).map(d => ({ id: d.id, label: d.label, ip: d.ip, first_seen: d.first_seen, last_seen: d.last_seen })),
      blocked: B[u.id] ? { n: B[u.id].n, last: B[u.id].last } : null,
      top: (T[u.id] || []).slice(0, 5).map(t => ({ title: t.lesson_title, grade: t.grade, n: t.n }))
    }))
  };
}
const PREP_T = "('send_prep','copy_json','copy_all')", HW_T = "('send_hw','copy_hw')";
async function adminReport(env, days, vault) {
  const DB = env.DB, since = days > 0 ? now() - days * 86400000 : 0;
  const users = ((await DB.prepare("SELECT id,name,username,role,active,scope,vault FROM users ORDER BY role='admin' DESC, name").all()).results || []).filter(u => inVault(u, vault));
  const UIDS = '(' + (users.map(u => +u.id).join(',') || '0') + ')';
  const agg = (await DB.prepare(`SELECT user_id,
      SUM(type='login') logins,
      SUM(type IN ${PREP_T}) preps,
      COUNT(DISTINCT CASE WHEN type IN ${PREP_T} THEN lesson_id END) prep_lessons,
      SUM(type IN ${HW_T}) hws,
      COUNT(DISTINCT CASE WHEN type IN ${HW_T} THEN lesson_id END) hw_lessons,
      SUM(type='quiz_make') quizzes, SUM(type='review_make') reviews, SUM(type IN ('quiz_print','quiz_word')) prints, SUM(type IN ('game_play','game_live')) games, SUM(type IN ('remedial_make','summary_make')) study,
      COUNT(DISTINCT CASE WHEN type='view' THEN lesson_id END) views,
      MAX(CASE WHEN type='login' THEN at END) last_login, MAX(at) last_active
    FROM events WHERE at > ? GROUP BY user_id`).bind(since).all()).results || [];
  const byGrade = (await DB.prepare(`SELECT grade,
      SUM(type IN ${PREP_T}) preps, SUM(type IN ${HW_T}) hws, SUM(type IN ('quiz_make','review_make')) quizzes
    FROM events WHERE at > ? AND user_id IN ${UIDS} AND grade IS NOT NULL AND grade<>'' GROUP BY grade`).bind(since).all()).results || [];
  const daily = (await DB.prepare(`SELECT CAST((at + 14400000) / 86400000 AS INTEGER) d, COUNT(DISTINCT user_id) users,
      SUM(type IN ${PREP_T}) preps, SUM(type IN ${HW_T}) hws, SUM(type IN ('quiz_make','review_make')) quizzes
    FROM events WHERE at > ? AND user_id IN ${UIDS} GROUP BY d ORDER BY d`).bind(Math.max(since, now() - 30 * 86400000)).all()).results || [];
  const A = Object.fromEntries(agg.map(r => [r.user_id, r])), z = { games: 0, study: 0, logins: 0, preps: 0, prep_lessons: 0, hws: 0, hw_lessons: 0, quizzes: 0, reviews: 0, prints: 0, views: 0, last_login: null, last_active: null };
  const rows = users.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role, active: u.active, scope: u.scope, ...z, ...(A[u.id] || {}) }));
  const sum = k => rows.reduce((t, r) => t + (+r[k] || 0), 0);
  return { days, rows, by_grade: byGrade, daily,
    totals: { active: rows.filter(r => r.last_active).length, logins: sum('logins'), preps: sum('preps'), hws: sum('hws'), quizzes: sum('quizzes') + sum('reviews') } };
}
async function adminActivity(env, vault) {
  const VW = vault ? "u.vault=1 AND u.role<>'admin'" : "NOT (u.vault=1 AND u.role<>'admin')";
  const ev = (await env.DB.prepare(`SELECT e.type,e.grade,e.lesson_title,e.at,e.ip,u.name,d.label FROM events e JOIN users u ON u.id=e.user_id AND ${VW}
     LEFT JOIN devices d ON d.user_id=e.user_id AND d.device_id=e.device_id ORDER BY e.at DESC LIMIT 150`).all()).results || [];
  const at = (await env.DB.prepare(`SELECT a.username,a.reason,a.label,a.ip,a.at,u.name FROM attempts a LEFT JOIN users u ON u.id=a.user_id
     WHERE a.ok=0 AND ${vault ? 'u.id IS NOT NULL AND ' + VW : '(u.id IS NULL OR ' + VW + ')'} ORDER BY a.at DESC LIMIT 100`).all()).results || [];
  return { events: ev, failed: at };
}
async function createUser(env, { name, username, password, role = 'teacher', max_devices = 2, scope = null }) {
  name = String(name || '').trim().slice(0, 80); username = cleanUser(username); password = String(password || '');
  if (!name || !/^[a-z0-9._@-]{3,60}$/.test(username)) throw new Error('اسم المستخدم يكون 3 أحرف إنجليزية أو أرقام على الأقل، بدون مسافات.');
  if (password.length < 6) throw new Error('كلمة المرور 6 أحرف على الأقل.');
  const salt = rand(16), h = await hashPass(password, salt);
  await env.DB.prepare('INSERT INTO users(name,username,pass_hash,salt,role,active,max_devices,created_at,scope) VALUES(?,?,?,?,?,1,?,?,?)').bind(name, username, h, salt, role, Math.max(1, Math.min(5, +max_devices || 2)), now(), Array.isArray(scope) && scope.length ? JSON.stringify(scope) : null).run();
}
function genPass() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789'; const r = new Uint8Array(8); crypto.getRandomValues(r);
  return [...r].map(x => a[x % a.length]).join('');
}

// ---------- exports (Word / print pages) ----------
// ملف Word كان HTML يشير إلى الصور بروابط على الموقع، فيظهر مكانها ✗ أحمر:
// Word يحجب الصور الخارجية في «طريقة العرض المحمية»، ولا يقرأ صيغة WebP أصلًا
// (أغلب صور أسئلة الاختبارات النهائية WebP). الحل: ملف «صفحة ويب في ملف واحد» (MHTML)
// بامتداد .doc — الصور **مضمَّنة داخل الملف نفسه** فتظهر بلا إنترنت وتُعدَّل وتُحفظ مع المستند.
// صور WebP تُقرأ من نسختها PNG التي تُولَّد عند النشر (site/tools/fin_png.py ← «x.webp.png»).
const MHT_BASE = 'file:///C:/kabsula/';
const b64Of = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
function imgInfo(u8) { // النوع والأبعاد من رأس الملف (PNG/JPEG/GIF/BMP)
  const n = u8.length, be16 = i => (u8[i] << 8) | u8[i + 1], be32 = i => ((u8[i] << 24) >>> 0) + (u8[i + 1] << 16) + (u8[i + 2] << 8) + u8[i + 3];
  if (n > 24 && u8[0] === 0x89 && u8[1] === 0x50) return { type: 'image/png', ext: 'png', w: be32(16), h: be32(20) };
  if (n > 10 && u8[0] === 0x47 && u8[1] === 0x49) return { type: 'image/gif', ext: 'gif', w: u8[6] | (u8[7] << 8), h: u8[8] | (u8[9] << 8) };
  if (n > 26 && u8[0] === 0x42 && u8[1] === 0x4d) return { type: 'image/bmp', ext: 'bmp', w: u8[18] | (u8[19] << 8), h: Math.abs((u8[22] | (u8[23] << 8) | (u8[24] << 16) | (u8[25] << 24))) };
  if (n > 4 && u8[0] === 0xff && u8[1] === 0xd8) {
    for (let i = 2; i + 9 < n;) {
      if (u8[i] !== 0xff) { i++; continue; }
      const mk = u8[i + 1];
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { type: 'image/jpeg', ext: 'jpg', w: be16(i + 7), h: be16(i + 5) };
      if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { i += 2; continue; }
      i += 2 + be16(i + 2);
    }
    return { type: 'image/jpeg', ext: 'jpg', w: 0, h: 0 };
  }
  return null;
}
async function wordMht(env, html, origin) {
  const own = u => u.origin === origin || /(^|\.)elkabsula\.site$|\.workers\.dev$/.test(u.hostname);
  const load = async src => {
    let u8 = null, m = src.match(/^data:image\/[a-z+.-]+;base64,([\s\S]+)$/i);
    if (m) { try { u8 = Uint8Array.from(atob(m[1].replace(/\s+/g, '')), c => c.charCodeAt(0)); } catch (e) { return null; } }
    else {
      let u; try { u = new URL(src.replace(/&amp;/g, '&'), origin); } catch (e) { return null; }
      if (!own(u)) return null;
      const p = u.pathname;
      if (ICONS[p]) u8 = Uint8Array.from(atob(ICONS[p]), c => c.charCodeAt(0));
      else if (env.ASSETS) {
        const r = await env.ASSETS.fetch(new Request(new URL(/\.webp$/i.test(p) ? p + '.png' : p, origin)));
        if (r.ok) u8 = new Uint8Array(await r.arrayBuffer());
      }
    }
    const inf = u8 && imgInfo(u8);
    return inf ? { ...inf, data: b64Of(u8) } : null;
  };
  // كل صورة تُحمَّل مرة واحدة حتى لو تكرّرت (شعار الوزارة في الورقة ونموذج الإجابة)
  const srcs = [...new Set([...html.matchAll(/<img\b[^>]*?\ssrc\s*=\s*(["'])([\s\S]*?)\1/gi)].map(x => x[2]))].slice(0, 45);
  const got = new Map();
  for (let i = 0; i < srcs.length; i += 8) {
    const batch = srcs.slice(i, i + 8), res = await Promise.all(batch.map(s => load(s).catch(() => null)));
    batch.forEach((s, k) => { if (res[k]) got.set(s, { ...res[k], loc: MHT_BASE + 'img' + got.size + '.' + res[k].ext }); });
  }
  // الأبعاد صريحة (width/height): Word يتجاهل max-width و width:auto فتخرج الصورة أكبر من الصفحة
  const MAXW = 640; // ≈ 480pt، داخل عرض صفحة A4 بهوامشها
  html = html.replace(/<img\b[^>]*>/gi, tag => {
    const sm = tag.match(/\ssrc\s*=\s*(["'])([\s\S]*?)\1/i), im = sm && got.get(sm[2]);
    if (!im) return tag;
    const st = (tag.match(/\sstyle\s*=\s*"([^"]*)"/i) || [])[1] || '';
    const num = re => { const x = tag.match(re) || st.match(re); return x ? +x[1] : 0; };
    let w = num(/(?:^|[\s;])width\s*:\s*(\d+(?:\.\d+)?)px/i) || num(/\swidth\s*=\s*["']?(\d+)/i);
    let h = num(/(?:^|[\s;])height\s*:\s*(\d+(?:\.\d+)?)px/i) || num(/\sheight\s*=\s*["']?(\d+)/i);
    if (im.w && im.h) {
      if (w && !h) h = w * im.h / im.w; else if (h && !w) w = h * im.w / im.h; else if (!w && !h) { w = Math.min(im.w, MAXW); h = w * im.h / im.w; }
      if (w > MAXW) { h = h * MAXW / w; w = MAXW; }
    }
    const st2 = st.replace(/(?:^|;)\s*(?:max-|min-)?(?:width|height)\s*:[^;]*/gi, '').replace(/^;+/, '');
    let t = tag.replace(/\s(?:width|height|style)\s*=\s*(["'])[\s\S]*?\1/gi, '').replace(/\s(?:width|height)\s*=\s*\d+/gi, '')
      .replace(sm[0], ' src="' + im.loc + '"');
    if (w && h) t = t.replace(/^<img/i, `<img width="${Math.round(w)}" height="${Math.round(h)}" style="${st2 ? st2 + ';' : ''}width:${Math.round(w)}px;height:${Math.round(h)}px"`);
    else if (st2) t = t.replace(/^<img/i, `<img style="${st2}"`);
    return t;
  });
  // جزء HTML بترميز quoted-printable (كما يحفظه Word نفسه). نحوّل الحروف غير اللاتينية إلى
  // كيانات رقمية (&#1575;) فيصبح النص ASCII خالصًا ولا يتأثّر بأي ترميز.
  const ascii = html.replace(/[^\x00-\x7f]/gu, c => '&#' + c.codePointAt(0) + ';');
  const qp = ascii.replace(/\r\n?/g, '\n').split('\n').map(l => {
    const ch = l.replace(/=/g, '=3D').replace(/[ \t]$/, c => c === ' ' ? '=20' : '=09').match(/=3D|=20|=09|[\s\S]/g) || [];
    const out = []; let cur = '';
    for (const c of ch) { if (cur.length + c.length > 75) { out.push(cur + '='); cur = ''; } cur += c; }
    out.push(cur); return out.join('\r\n');
  }).join('\r\n');
  const B = '----=_NextPart_Kabsula_' + rand(8), wrap = s => s.replace(/.{76}/g, '$&\r\n');
  let mht = `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${B}"; type="text/html"\r\n\r\nThis is a multi-part message in MIME format.\r\n\r\n` +
    `--${B}\r\nContent-Location: ${MHT_BASE}doc.htm\r\nContent-Transfer-Encoding: quoted-printable\r\nContent-Type: text/html; charset="us-ascii"\r\n\r\n${qp}\r\n\r\n`;
  for (const im of got.values()) mht += `--${B}\r\nContent-Location: ${im.loc}\r\nContent-Transfer-Encoding: base64\r\nContent-Type: ${im.type}\r\n\r\n${wrap(im.data)}\r\n\r\n`;
  return mht + `--${B}--\r\n`;
}
// رابط غير قابل للتخمين وصالح 6 ساعات: يعمل في التطبيق والمتصفح الخارجي بدون تسجيل دخول
async function exportFile(req, env, id) {
  const r = await env.DB.prepare('SELECT * FROM exports WHERE id = ?').bind(id).first();
  if (!r || r.created_at < now() - 6 * 3600000) return new Response('انتهت صلاحية الرابط. ارجع للموقع واضغط الزر مرة أخرى.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const ua = req.headers.get('User-Agent') || '', fname = encodeURIComponent(r.name + (r.format === 'doc' ? '.doc' : '.html'));
  const disp = (inline) => (inline ? 'inline' : 'attachment') + `; filename="${r.format === 'doc' ? 'tahdir.doc' : 'tahdir.html'}"; filename*=UTF-8''${fname}`;
  if (r.format === 'doc') return new Response(await wordMht(env, r.body, new URL(req.url).origin), { headers: { 'Content-Type': 'application/msword', 'Content-Disposition': disp(false), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  // صفحة الطباعة: داخل التطبيق نُرجعها كتحميل فيفتحها أندرويد في Chrome حيث تعمل الطباعة وحفظ PDF
  const nonce = rand(16), inApp = /TahdirApp/.test(ua);
  const page = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + r.name.replace(/</g, '') + '</title>' +
    '<style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#e9eeec;font-family:"Simplified Arabic","Traditional Arabic",Tahoma,serif;color:#000}.bar{position:sticky;top:0;display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;padding:10px;background:#07493b;color:#fff;font-family:Tahoma,sans-serif;font-size:14px}.bar button{font:inherit;font-weight:bold;border:0;border-radius:10px;padding:10px 18px;background:#fff;color:#07493b;cursor:pointer}.pg{background:#fff;max-width:800px;margin:14px auto;padding:24px 28px;box-shadow:0 2px 10px rgba(0,0,0,.15);font-size:15px;line-height:1.7}.pg+.pg{page-break-before:always}.oval{display:inline-block;width:22px;height:13px;border:1.5px solid #555;border-radius:8px;vertical-align:middle}@media print{@page{size:A4;margin:0}body{background:#fff}.bar{display:none}.pg{box-shadow:none;margin:0;padding:0;max-width:none;font-size:14pt}.prw td{padding:0 12mm}.prsp{height:11mm}}.prw{width:100%;border-collapse:collapse}.prw td{padding:0;border:0}.prsp{height:0}.fin-pq{page-break-inside:avoid;margin:0 0 10px}.fin-pq img{max-width:100%}@media (max-width:600px){.pg{padding:14px 10px;margin:8px 4px;font-size:14px}}</style></head><body>' +
    '<div class="bar"><span>اضغط «طباعة» ثم اختر «حفظ بتنسيق PDF» أو الطابعة</span><button type="button" id="pr">🖨 طباعة / PDF</button></div><table class="prw"><thead><tr><td><div class="prsp"></div></td></tr></thead><tfoot><tr><td><div class="prsp"></div></td></tr></tfoot><tbody><tr><td>' + r.body + '</td></tr></tbody></table>' +
    `<script nonce="${nonce}">document.getElementById('pr').onclick=function(){window.print();};setTimeout(function(){try{window.print();}catch(e){}},700);</script></body></html>`;
  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': disp(!inApp), 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; script-src 'nonce-${nonce}'`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
}

// ---------- live phone challenge (Kahoot-style) ----------
const ROOM_TTL = 4 * 3600000;
async function roomOf(env, code) {
  const r = await env.DB.prepare('SELECT * FROM rooms WHERE code = ?').bind(String(code || '')).first();
  if (!r || r.created_at < now() - ROOM_TTL) return null;
  r.q = JSON.parse(r.data); return r;
}
function publicQ(q) { return { stem: q.stem, choices: q.choices, table: q.table || null }; }
async function playApi(req, env, p, m, url) {
  const DB = env.DB;
  if (p === '/api/play/join' && m === 'POST') {
    const b = await body(req), code = String(b.code || '').replace(/\D/g, '').slice(0, 6);
    const name = String(b.name || '').replace(/[<>]/g, '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!name) return json({ error: 'اكتب اسمك.' }, 400);
    const r = await roomOf(env, code);
    if (!r || r.state === 'end') return json({ error: 'رمز التحدي غير صحيح أو انتهى التحدي.' }, 404);
    const n = await DB.prepare('SELECT COUNT(*) n FROM players WHERE code = ?').bind(code).first();
    if (n && n.n >= 80) return json({ error: 'اكتمل عدد اللاعبين.' }, 400);
    const token = rand(12);
    try { const row = await DB.prepare('INSERT INTO players(code,name,token,joined_at) VALUES(?,?,?,?) RETURNING id').bind(code, name, token, now()).first(); return json({ ok: true, pid: row.id, token, title: r.title }); }
    catch (e) { return json({ error: 'هذا الاسم مستخدم في التحدي. اكتب اسمًا آخر (مثلًا مع رقمك).' }, 400); }
  }
  if (p === '/api/play/state' || (p === '/api/play/answer' && m === 'POST')) {
    const b = m === 'POST' ? await body(req) : Object.fromEntries(url.searchParams);
    const r = await roomOf(env, b.code); if (!r) return json({ state: 'gone' });
    const pl = await DB.prepare('SELECT * FROM players WHERE id = ? AND code = ? AND token = ?').bind(+b.pid, r.code, String(b.t || '')).first();
    if (!pl) return json({ state: 'gone' });
    const t = now(), q = r.q[r.qi], dur = r.dur * 1000;
    if (p === '/api/play/answer') {
      if (r.state !== 'question' || +b.qi !== r.qi || pl.ans_qi === r.qi) return json({ ok: false });
      const el = t - r.q_started; if (el > dur + 1500) return json({ ok: false, late: true });
      const choice = +b.choice, ok = choice === q.correct ? 1 : 0, pts = ok ? Math.round(1000 - 500 * Math.min(1, el / dur)) : 0;
      await DB.prepare('UPDATE players SET ans_qi=?, ans_choice=?, ans_ok=?, ans_pts=?, ans_at=?, score=score+? WHERE id=?').bind(r.qi, choice, ok, pts, t, pts, pl.id).run();
      return json({ ok: true });
    }
    const out = { state: r.state, qi: r.qi, total: r.q.length, title: r.title, you: { name: pl.name, score: pl.score } };
    if (r.state === 'question') { out.q = publicQ(q); out.left = Math.max(0, dur - (t - r.q_started)); out.answered = pl.ans_qi === r.qi; out.choice = pl.ans_qi === r.qi ? pl.ans_choice : null; }
    if (r.state === 'reveal' || r.state === 'end') {
      if (r.state === 'reveal') { out.q = publicQ(q); out.correct = q.correct; out.mine = pl.ans_qi === r.qi ? { choice: pl.ans_choice, ok: !!pl.ans_ok, pts: pl.ans_pts } : null; }
      const rk = await DB.prepare('SELECT COUNT(*) n FROM players WHERE code = ? AND score > ?').bind(r.code, pl.score).first();
      out.rank = (rk ? rk.n : 0) + 1;
    }
    return json(out);
  }
  return null;
}
async function liveApi(req, env, me, p, m, url) {
  const DB = env.DB;
  if (p === '/api/live/create' && m === 'POST') {
    const b = await body(req);
    const items = (Array.isArray(b.items) ? b.items : []).filter(x => x && Array.isArray(x.choices) && x.choices.length >= 2 && x.correct >= 0 && x.correct < x.choices.length).slice(0, 40)
      .map(x => ({ stem: String(x.stem || '').slice(0, 1500), choices: x.choices.slice(0, 4).map(c => String(c).slice(0, 300)), correct: +x.correct, table: x.table || null }));
    if (!items.length) return json({ error: 'لا توجد أسئلة اختيار من متعدد.' }, 400);
    await DB.prepare('DELETE FROM rooms WHERE created_at < ?').bind(now() - ROOM_TTL).run();
    let code = '';
    for (let i = 0; i < 8; i++) { code = String(100000 + Math.floor(Math.random() * 900000)); if (!(await DB.prepare('SELECT code FROM rooms WHERE code = ?').bind(code).first())) break; }
    await DB.batch([DB.prepare('DELETE FROM players WHERE code = ?').bind(code),
      DB.prepare('INSERT OR REPLACE INTO rooms(code,owner,title,grade,data,state,qi,q_started,dur,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(code, me.id, String(b.title || 'تحدٍّ').slice(0, 120), String(b.grade || ''), JSON.stringify(items), 'lobby', -1, null, Math.max(10, Math.min(120, +b.dur || 20)), now())]);
    return json({ ok: true, code });
  }
  const r = await roomOf(env, (m === 'POST' ? (await req.clone().json().catch(() => ({}))).code : url.searchParams.get('code')));
  if (!r || (r.owner !== me.id && me.role !== 'admin')) return json({ error: 'التحدي غير موجود أو انتهت صلاحيته.' }, 404);
  if (p === '/api/live/state') {
    const pls = (await DB.prepare('SELECT name, score, ans_qi, ans_choice, ans_ok FROM players WHERE code = ? ORDER BY score DESC, joined_at').bind(r.code).all()).results || [];
    const dist = [0, 0, 0, 0]; let answered = 0;
    pls.forEach(x => { if (x.ans_qi === r.qi) { answered++; if (x.ans_choice >= 0 && x.ans_choice < 4) dist[x.ans_choice]++; } });
    const q = r.q[r.qi];
    return json({ state: r.state, qi: r.qi, total: r.q.length, dur: r.dur, left: r.state === 'question' ? Math.max(0, r.dur * 1000 - (now() - r.q_started)) : 0,
      q: q || null, players: pls.map(x => ({ name: x.name, score: x.score, ok: x.ans_qi === r.qi ? !!x.ans_ok : null })), answered, dist });
  }
  if (p === '/api/live/control' && m === 'POST') {
    const b = await body(req), a = b.action;
    if (a === 'next' || a === 'start') {
      const nq = r.qi + 1;
      if (nq >= r.q.length) await DB.prepare("UPDATE rooms SET state='end' WHERE code=?").bind(r.code).run();
      else await DB.prepare("UPDATE rooms SET state='question', qi=?, q_started=? WHERE code=?").bind(nq, now(), r.code).run();
    } else if (a === 'reveal') await DB.prepare("UPDATE rooms SET state='reveal' WHERE code=? AND state='question'").bind(r.code).run();
    else if (a === 'end') await DB.prepare("UPDATE rooms SET state='end' WHERE code=?").bind(r.code).run();
    else return json({ error: 'bad' }, 400);
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
}
async function gamesData(env, me, key) {
  const sc = scopeOf(me); if (sc && !sc.has(key)) return { error: 'غير مسموح.' };
  const ls = (await allLessons(env)).filter(l => courseKey(l) === key);
  const ids = new Set(ls.map(l => l.id));
  // مفردات الألعاب من البنك المثبّت ومن واجبات MCQ ومن حزمة الألعاب.
  // **لا نُدخل مفردات امتحانات الوزارة**: استخراجها يخزّن نص الإجابة الوزارية دون
  // خيارات (choices فارغة)، فكانت تُرسَل إلى صفحة الألعاب وتظهر كلوحة فارغة
  // («اختر الإجابة الصحيحة» بلا سؤال). فنشترط خيارين على الأقل لصلاحية اللعب.
  const playable = q => (q.choices || []).length >= 2;
  const items = QBANK.filter(q => ids.has(q.lesson_id) && playable(q)).map(q => ({ ...q, src: 'bank' }))
    .concat(finQuizItems(key).filter(q => ids.has(q.lesson_id) && playable(q)).map(q => ({ ...q, src: 'fin' })))
    // أسئلة الرياضيات المولّدة من أهداف الدروس (حزمة مستقلة: لا تمسّ توليد الاختبارات)
    .concat(GMATH.filter(q => ids.has(q.lesson_id) && playable(q)));
  let k = 0;
  ls.forEach(l => { if (l.hw_type !== 'mcq') return; [1, 2].forEach(n => {
    const c = String(l['hw_a' + n] || '').split('\n').map(x => x.trim()).filter(Boolean); if (!l['hw_q' + n] || c.length < 2) return;
    items.push({ qid: 900000 + (k++), lesson_id: l.id, type: 'mcq', stem: String(l['hw_q' + n]).replace(/^Choose the correct answer:\s*/i, ''), choices: c.slice(0, 4), correct: 0, marks: 1, ao: '', difficulty: 'منخفضة', src: 'hw' }); }); });
  try {
    const arr = [...ids], ai = [];
    for (let i = 0; i < arr.length; i += 90) { const ch = arr.slice(i, i + 90); ai.push(...(((await env.DB.prepare('SELECT id, lesson_id, data FROM ai_items WHERE lesson_id IN (' + ch.map(() => '?').join(',') + ')').bind(...ch).all()).results) || [])); }
    ai.forEach(r => { try { const q = JSON.parse(r.data); items.push({ qid: 800000000 + r.id, lesson_id: r.lesson_id, type: 'mcq', stem: q.stem, choices: q.choices, correct: q.correct, marks: 1, ao: '', difficulty: 'متوسطة', src: 'ai' }); } catch (e) {} });
  } catch (e) { /* لا شيء */ }
  const pack = {}; ls.forEach(l => { if (GPACK[l.id]) pack[l.id] = GPACK[l.id]; });
  return { lessons: ls.map(l => ({ id: l.id, unit: l.unit, unit_name: l.unit_name, title: l.title, concepts: l.concepts || '', subject: l.subject, grade: l.grade })), items, pack };
}


// ---------- نقل المنصة إلى النطاق الجديد ----------
// الرابط القديم (workers.dev) يُحوِّل صفحات المنصة إلى elkabsula.site، عدا:
//  • الموارد التي تطلبها الأدوات والتطبيقات (/api · /tool · /download · /x · /version …)
//    فلا تتعطل أداة نور (Tampermonkey/الإضافة) ولا تحديثها التلقائي.
//  • تطبيقا أندرويد/آيفون (TahdirApp في User-Agent): نسخهم المثبتة لا تعرف النطاق الجديد.
// التحويل لا يبدأ إلا بعد أن يصل أول طلب فعلي عبر النطاق الجديد (دليل أن الربط اكتمل)،
// فلا ينقطع الموقع لو لم يُضبط النطاق بعد.
const NEW_HOST = 'elkabsula.site', OLD_HOST = 'tahdir.hudhaifa-bio.workers.dev';
let newLive = false, newLiveAt = 0;
async function markNewLive(env) {
  if (newLive) return; newLive = true;
  try { await env.DB.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES('new_host_live','1')").run(); } catch (e) {}
}
async function isNewLive(env) {
  if (newLive) return true;
  if (now() - newLiveAt < 60000) return false;
  newLiveAt = now();
  try { newLive = !!(await env.DB.prepare("SELECT v FROM kv WHERE k='new_host_live'").first()); } catch (e) {}
  return newLive;
}
function isPageNav(req, p) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (/^\/(api|tool|download|x|fin|pdf|assets)(\/|$)/.test(p)) return false;
  if (/^\/(version|manifest\.webmanifest|robots\.txt|sw\.js)$/.test(p) || /\.(png|jpe?g|svg|ico|js|css|json|webmanifest|zip|apk|pdf)$/i.test(p)) return false;
  if (/TahdirApp\//.test(req.headers.get('User-Agent') || '')) return false;
  const dest = req.headers.get('Sec-Fetch-Dest');
  if (dest) return dest === 'document';
  return /text\/html/.test(req.headers.get('Accept') || '');
}
async function moveRedirect(req, env, url) {
  const to = url.pathname + url.search;
  const c = cookies(req);
  const sid = /^[a-f0-9]{64}$/.test(c.sid || '') ? c.sid : '', did = /^[a-f0-9]{48}$/.test(c.did || '') ? c.did : '';
  let dest = 'https://' + NEW_HOST + '/__move?to=' + encodeURIComponent(to);
  if (sid || did) {
    // رمز لمرة واحدة صالح دقيقتين: ينقل جلسة المعلم ومعرّف جهازه فلا يحتاج دخولًا جديدًا
    // ولا يُحسب جهازًا إضافيًا.
    const code = rand(24);
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO moves(code,sid,did,exp) VALUES(?,?,?,?)').bind(code, sid, did, now() + 120000),
        env.DB.prepare('DELETE FROM moves WHERE exp < ?').bind(now())
      ]);
      dest += '&c=' + code;
    } catch (e) {}
  }
  return new Response(null, { status: 302, headers: { Location: dest, 'Cache-Control': 'no-store', ...SEC_HEADERS } });
}
async function moveLanding(req, env, url) {
  let to = url.searchParams.get('to') || '/';
  if (!/^\/(?!\/)/.test(to) || /^\/__move/.test(to)) to = '/';
  const h = new Headers({ Location: to, 'Cache-Control': 'no-store', ...SEC_HEADERS });
  const code = String(url.searchParams.get('c') || '');
  if (/^[a-f0-9]{48}$/.test(code)) {
    const row = await env.DB.prepare('SELECT * FROM moves WHERE code = ?').bind(code).first();
    if (row) {
      await env.DB.prepare('DELETE FROM moves WHERE code = ?').bind(code).run();
      const c = cookies(req);
      if (row.exp >= now()) {
        if (row.sid && !c.sid) h.append('Set-Cookie', setCookie('sid', row.sid, SESSION_DAYS * 86400, req));
        if (row.did && !c.did) h.append('Set-Cookie', setCookie('did', row.did, 63072000, req));
      }
    }
  }
  // علامة قصيرة يقرؤها common.js ليعرض رسالة «تم نقل المنصة» مرة واحدة
  h.append('Set-Cookie', `kmoved=1; Path=/; Secure; SameSite=Lax; Max-Age=600`);
  return new Response(null, { status: 302, headers: h });
}



// ---------- الذكاء الاصطناعي (apmix.ai — صيغة OpenAI) ----------
// المفتاح سرّ في Cloudflare (AI_KEY) لا يصل للمتصفح أبدًا. حدود يومية لكل معلم وكل جهاز طالب،
// وحدّ شهري للرموز (AI_BUDGET) حتى لا تنفد الباقة. لا تُرسل أسماء الطلاب إطلاقًا.
const AI_URL = 'https://api.apmix.ai/v1/chat/completions';
const AI_LIMITS = { grade: 60, research: 12, game: 15 }; // في اليوم لكل (جهاز طالب | معلم)
function aiOn(env) { return !!env.AI_KEY; }
async function aiUsedMonth(env) {
  const m = new Date(); m.setUTCDate(1); m.setUTCHours(0, 0, 0, 0);
  const r = await env.DB.prepare('SELECT COALESCE(SUM(tokens),0) t FROM ai_log WHERE at >= ?').bind(m.getTime()).first();
  return r ? r.t : 0;
}
async function aiGate(env, who, kind) {
  if (!aiOn(env)) return 'الذكاء الاصطناعي غير مفعّل بعد.';
  const n = await env.DB.prepare('SELECT COUNT(*) n FROM ai_log WHERE who = ? AND kind = ? AND at > ?').bind(who, kind, now() - 86400000).first();
  if (n && n.n >= (AI_LIMITS[kind] || 20)) return 'وصلت إلى الحد اليومي لهذه الخدمة. حاول غدًا.';
  const budget = +(env.AI_BUDGET || 2500000);
  if (await aiUsedMonth(env) >= budget) return 'انتهى رصيد الذكاء الاصطناعي لهذا الشهر.';
  return null;
}
async function aiChat(env, who, kind, system, user, maxTokens) {
  const r = await fetch(env.AI_URL || AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.AI_KEY },
    body: JSON.stringify({ model: env.AI_MODEL || 'google/gemini-3.8-flash', temperature: 0.3, max_tokens: maxTokens || 800,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
  const j = await r.json().catch(() => ({}));
  const used = (j.usage && (j.usage.total_tokens || ((j.usage.prompt_tokens || 0) + (j.usage.completion_tokens || 0)))) || Math.ceil((system.length + user.length) / 3) + 300;
  await env.DB.prepare('INSERT INTO ai_log(who,kind,tokens,at) VALUES(?,?,?,?)').bind(who, kind, used, now()).run();
  if (!r.ok) throw new Error('خدمة الذكاء الاصطناعي غير متاحة الآن (' + r.status + ').');
  return String((((j.choices || [])[0] || {}).message || {}).content || '');
}
function aiJson(t) { const m = String(t).replace(/```json|```/g, '').match(/[\[{][\s\S]*[\]}]/); if (!m) throw new Error('رد غير مفهوم من الذكاء الاصطناعي.'); return JSON.parse(m[0]); }
// تصحيح إجابة مقالية للطالب بمقارنتها بنموذج الإجابة
async function aiGrade(env, ip, item, ans) {
  const sys = 'أنت مصحّح لمادة دراسية في المنهج العُماني. قارن إجابة الطالب بنموذج الإجابة. اقبل الصياغة المختلفة إن كان المعنى العلمي صحيحًا، وتجاوز الأخطاء الإملائية البسيطة. لا تمنح درجة لإجابة فارغة أو خارج السؤال. أجب بـ JSON فقط: {"score": رقم من 0 إلى الدرجة العظمى (يقبل النصف), "feedback": "جملة أو جملتان بالعربية الفصحى موجهتان للطالب: ما الصحيح وما الناقص"}';
  const usr = 'السؤال: ' + item.stem + '\nالدرجة العظمى: ' + (item.marks || 1) + '\nنموذج الإجابة: ' + item.answer + (item.notes ? '\nملاحظات التصحيح: ' + item.notes : '') + '\nإجابة الطالب: ' + ans;
  const o = aiJson(await aiChat(env, ip, 'grade', sys, usr, 250));
  const mx = +item.marks || 1; let sc = Math.round(Math.max(0, Math.min(mx, +o.score || 0)) * 2) / 2;
  return { score: sc, max: mx, feedback: String(o.feedback || '').slice(0, 400) };
}
async function aiApi(req, env, me, p, m, url) {
  if (p === '/api/ai/status') return json({ on: aiOn(env) });
  if (p === '/api/ai/research' && m === 'POST') {
    const gate = await aiGate(env, 'u' + me.id, 'research'); if (gate) return json({ error: gate }, 429);
    const f = (await body(req)).form || {};
    const S = f.stats ? 'نتائج التطبيق: عدد الطلبة ' + f.stats.n + '، متوسط القبلي ' + f.stats.pre + '، متوسط البعدي ' + f.stats.post + '، قيمة t = ' + f.stats.t + '، مستوى الدلالة ' + f.stats.p + (f.stats.sig ? ' (دال)' : ' (غير دال)') + '، مربع إيتا ' + f.stats.eta + '.' : 'لا توجد نتائج بعد.';
    const sys = 'أنت خبير في البحث الإجرائي التربوي في سلطنة عُمان. اكتب بالعربية الفصحى بأسلوب أكاديمي واضح ومختصر. ممنوع منعًا باتًّا ذكر أي مرجع أو دراسة سابقة أو اسم باحث أو سنة نشر أو إحصاءات غير المعطاة لك. أجب بـ JSON فقط.';
    const usr = 'بيانات البحث:\nالعنوان: ' + (f.title || '') + '\nالمادة: ' + (f.material || f.subject || '') + '\nالصف: ' + (f.grade || '') + '\nالوحدات: ' + (f.units || '') + '\nالاستراتيجية: ' + (f.stratName || '') + '\nالمتغير: ' + (f.dv || '') + '\nما لاحظه المعلم: ' + (f.problem || '') + '\n' + S +
      '\n\nاكتب JSON بالمفاتيح: {"intro": "مقدمة وإحساس بالمشكلة (فقرتان، 120–180 كلمة) مرتبطة بالمادة والصف وما لاحظه المعلم", "theory": "إطار نظري للاستراتيجية في تدريس هذه المادة تحديدًا (3 فقرات، 200–280 كلمة): كيف تُطبَّق في دروس هذه الوحدات بأمثلة من المادة، ولماذا يُتوقع أن تحسّن المتغير", "discussion": "مناقشة النتائج (فقرتان، 120–180 كلمة) تفسّر الأرقام المعطاة بدقة وبلا مبالغة، وتذكر حدود البحث (حجم العينة) إن كانت النتيجة غير دالة"}';
    try { const o = aiJson(await aiChat(env, 'u' + me.id, 'research', sys, usr, 1600)); return json({ intro: String(o.intro || ''), theory: String(o.theory || ''), discussion: String(o.discussion || '') }); }
    catch (e) { return json({ error: e.message }, 502); }
  }
  if (p === '/api/ai/game-items' && m === 'POST') {
    const b = await body(req), key = String(b.key || ''), sc = scopeOf(me);
    if (sc && !sc.has(key)) return json({ error: 'غير مسموح.' }, 403);
    const ids = (Array.isArray(b.lessons) ? b.lessons : []).map(Number).slice(0, 3);
    const ls = (await allLessons(env)).filter(l => courseKey(l) === key && ids.includes(l.id));
    if (!ls.length) return json({ error: 'اختر درسًا.' }, 400);
    await loadPacks(env, url);
    let added = 0;
    for (const l of ls) {
      const gate = await aiGate(env, 'u' + me.id, 'game'); if (gate) return json({ error: gate, added }, 429);
      const st = (STUDY.lessons[l.id] || {}).summary || {};
      const ctx = [l.outcomes, l.concepts, st.intro, (st.outcomes || []).map(o => o.text + ': ' + (o.points || []).join(' ')).join('\n'), (st.terms || []).map(t => t.t + ': ' + t.d).join('\n')].filter(Boolean).join('\n').slice(0, 3500);
      const old = (await env.DB.prepare('SELECT data FROM ai_items WHERE lesson_id = ?').bind(l.id).all()).results || [];
      const en = /إنجليز|English/i.test(l.subject || '');
      const sys = en ? 'You write multiple-choice game questions for school students. Output JSON only.' : 'أنت معلم تكتب أسئلة اختيار من متعدد لألعاب صفية لطلاب المنهج العُماني بالعربية الفصحى. كل سؤال قصير وواضح، له 4 خيارات قصيرة، وإجابة صحيحة واحدة فقط، والخيارات الخاطئة معقولة. لا تخرج عن محتوى الدرس. أجب بـ JSON فقط.';
      const usr = (en ? 'Lesson: ' : 'الدرس: ') + l.title + ' — ' + (l.subject || '') + ' ' + (l.grade || '') + '\n' + ctx + (old.length ? '\n\nلا تكرر هذه الأسئلة: ' + old.slice(-20).map(r => { try { return JSON.parse(r.data).stem; } catch { return ''; } }).join(' | ') : '') +
        '\n\nاكتب 8 أسئلة بصيغة JSON: [{"stem":"...","choices":["...","...","...","..."],"correct":0}] (correct هو رقم الخيار الصحيح من 0 إلى 3، ونوّع موضعه).';
      try {
        const arr = aiJson(await aiChat(env, 'u' + me.id, 'game', sys, usr, 1800));
        const good = (Array.isArray(arr) ? arr : []).filter(q => q && q.stem && Array.isArray(q.choices) && q.choices.length === 4 && q.correct >= 0 && q.correct < 4).slice(0, 10);
        for (const q of good) { await env.DB.prepare('INSERT INTO ai_items(lesson_id,data,user_id,created_at) VALUES(?,?,?,?)').bind(l.id, JSON.stringify({ stem: String(q.stem).slice(0, 300), choices: q.choices.map(c => String(c).slice(0, 120)), correct: +q.correct }), me.id, now()).run(); added++; }
      } catch (e) { return json({ error: e.message, added }, 502); }
    }
    return json({ ok: true, added });
  }
  return null;
}

// ---------- «مساحة الطالب»: صفوف برمز يفتحها الطلاب بلا حساب ----------
const SCODE_AB = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode() { let c = ''; const a = new Uint8Array(6); crypto.getRandomValues(a); a.forEach(x => { c += SCODE_AB[x % SCODE_AB.length]; }); return c; }
async function classByCode(env, code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) return null;
  const c = await env.DB.prepare('SELECT * FROM classes WHERE code = ? AND active = 1').bind(code).first();
  if (!c) return null;
  const u = await env.DB.prepare('SELECT active FROM users WHERE id = ?').bind(c.user_id).first();
  return u && u.active ? c : null;
}
async function classLessons(env, c) {
  const allow = c.lessons ? new Set(JSON.parse(c.lessons)) : null;
  return (await allLessons(env)).filter(l => courseKey(l) === c.course && (!allow || allow.has(l.id)));
}
async function studentApi(req, env, p, m, url) {
  if (p === '/api/s/info') {
    const c = await classByCode(env, url.searchParams.get('c'));
    if (!c) return json({ error: 'الرمز غير صحيح أو أُغلق هذا الصف. تأكد من الرمز مع معلمك.' }, 404);
    const ls = await classLessons(env, c);
    const t = await env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(c.user_id).first();
    return json({ ai: aiOn(env), name: c.name, teacher: t ? t.name : '', subject: c.course.split('|')[0], grade: c.course.split('|')[1], lessons: ls.map(l => ({ id: l.id, unit: l.unit, unit_name: l.unit_name, title: l.title })) });
  }
  if (p === '/api/s/lesson') {
    const c = await classByCode(env, url.searchParams.get('c'));
    if (!c) return json({ error: 'الرمز غير صحيح.' }, 404);
    const id = +url.searchParams.get('id'), ls = await classLessons(env, c), l = ls.find(x => x.id === id);
    if (!l) return json({ error: 'الدرس غير متاح.' }, 404);
    await loadPacks(env, url);
    const st = STUDY.lessons[id] || {};
    const items = itBank(c.course, QBANK.filter(q => q.lesson_id === id).concat(finQuizItems(c.course).filter(q => q.lesson_id === id)))
      .map(q => ({ qid: q.qid, type: q.type, stem: q.stem, choices: q.choices, correct: q.correct, answer: q.answer, notes: q.notes, marks: q.marks, img: q.img || null, fig: q.fig || null, table: q.table || null }));
    return json({ lesson: { id: l.id, title: l.title, unit: l.unit, unit_name: l.unit_name }, summary: st.summary || null, items });
  }
  if (p === '/api/s/grade' && m === 'POST') {
    const b = await body(req), c = await classByCode(env, b.c);
    if (!c) return json({ error: 'الرمز غير صحيح.' }, 404);
    const ans = String(b.answer || '').trim().slice(0, 700);
    if (ans.length < 2) return json({ error: 'اكتب إجابتك أولًا.' }, 400);
    const ip = 's' + ipOf(req), gate = await aiGate(env, ip, 'grade'); if (gate) return json({ error: gate }, 429);
    const lid = +b.lid, ls = await classLessons(env, c); if (!ls.find(x => x.id === lid)) return json({ error: 'الدرس غير متاح.' }, 404);
    const it = itBank(c.course, QBANK.filter(q => q.lesson_id === lid).concat(finQuizItems(c.course).filter(q => q.lesson_id === lid))).find(q => String(q.qid) === String(b.qid));
    if (!it || it.type === 'mcq' || !it.answer) return json({ error: 'السؤال غير موجود.' }, 404);
    try { return json(await aiGrade(env, ip, it, ans)); } catch (e) { return json({ error: e.message }, 502); }
  }
  if (p === '/api/s/attempt' && m === 'POST') {
    const b = await body(req), c = await classByCode(env, b.c);
    if (!c) return json({ error: 'الرمز غير صحيح.' }, 404);
    const ip = ipOf(req), t = now();
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM s_attempts WHERE ip = ? AND at > ?').bind(ip, t - 3600000).first();
    if (n && n.n > 120) return json({ ok: true, skipped: true });
    const name = String(b.name || '').trim().slice(0, 40) || 'طالب';
    await env.DB.prepare('INSERT INTO s_attempts(class_id,name,lesson_id,score,max,n,ip,at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(c.id, name, +b.lid || null, Math.max(0, +b.score || 0), Math.max(0, +b.max || 0), Math.max(0, Math.min(200, +b.n || 0)), ip, t).run();
    return json({ ok: true });
  }
  return null;
}
async function classesApi(req, env, me, p, m, url) {
  if (p === '/api/classes' && m === 'GET') {
    const r = (await env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM s_attempts a WHERE a.class_id = c.id) attempts, (SELECT COUNT(DISTINCT name) FROM s_attempts a WHERE a.class_id = c.id) students FROM classes c WHERE c.user_id = ? ORDER BY c.created_at DESC`).bind(me.id).all()).results || [];
    return json({ classes: r.map(c => ({ ...c, lessons: c.lessons ? JSON.parse(c.lessons) : null })) });
  }
  if (p === '/api/classes' && m === 'POST') {
    const b = await body(req), sc = scopeOf(me);
    const course = String(b.course || ''), name = String(b.name || '').trim().slice(0, 80);
    if (!course || !name) return json({ error: 'اكتب اسم الصف واختر المادة والصف.' }, 400);
    if (sc && !sc.has(course)) return json({ error: 'غير مسموح.' }, 403);
    const lessons = Array.isArray(b.lessons) && b.lessons.length ? JSON.stringify(b.lessons.map(Number).filter(Boolean).slice(0, 400)) : null;
    if (b.id) {
      await env.DB.prepare('UPDATE classes SET name=?, course=?, lessons=?, active=? WHERE id=? AND user_id=?').bind(name, course, lessons, b.active === false ? 0 : 1, +b.id, me.id).run();
      return json({ ok: true, id: +b.id });
    }
    const cnt = await env.DB.prepare('SELECT COUNT(*) n FROM classes WHERE user_id = ?').bind(me.id).first();
    if (cnt && cnt.n >= 40) return json({ error: 'الحد الأقصى 40 صفًا.' }, 400);
    for (let i = 0; i < 6; i++) {
      const code = newCode();
      try {
        const r = await env.DB.prepare('INSERT INTO classes(user_id,code,name,course,lessons,active,created_at) VALUES(?,?,?,?,?,1,?) RETURNING id').bind(me.id, code, name, course, lessons, now()).first();
        return json({ ok: true, id: r.id, code });
      } catch (e) { /* رمز مكرر نادرًا: نعيد المحاولة */ }
    }
    return json({ error: 'تعذّر إنشاء الرمز، حاول مرة أخرى.' }, 500);
  }
  let mm;
  if ((mm = p.match(/^\/api\/classes\/(\d+)$/)) && m === 'DELETE') {
    const id = +mm[1];
    const c = await env.DB.prepare('SELECT id FROM classes WHERE id = ? AND user_id = ?').bind(id, me.id).first();
    if (c) await env.DB.batch([env.DB.prepare('DELETE FROM s_attempts WHERE class_id = ?').bind(id), env.DB.prepare('DELETE FROM classes WHERE id = ?').bind(id)]);
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/api\/classes\/(\d+)\/stats$/))) {
    const c = await env.DB.prepare('SELECT * FROM classes WHERE id = ? AND user_id = ?').bind(+mm[1], me.id).first();
    if (!c) return json({ error: 'غير موجود' }, 404);
    const a = (await env.DB.prepare('SELECT name, lesson_id, score, max, n, at FROM s_attempts WHERE class_id = ? ORDER BY at DESC LIMIT 3000').bind(c.id).all()).results || [];
    return json({ attempts: a });
  }
  return null;
}

// ---------- router ----------
export default {
  async fetch(req, env) {
    try {
      // **إجبار HTTPS**: كوكي الجلسة موسوم `Secure`، والمتصفح يرفضه على اتصال
      // غير آمن. فلو فُتح الموقع بـhttp:// (رابط قديم مُشارَك، أو إدخال يدوي)
      // لنجح الدخول ثم عاد المعلم لصفحة الدخول، وسُجّل جهاز جديد في كل محاولة
      // حتى يُقفل حسابه بحدّ الأجهزة. فنحوّل أي طلب غير آمن إلى https قبل أي شيء.
      const u0 = new URL(req.url);
      const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(u0.host);
      if (u0.protocol === 'http:' && !isLocal) {
        u0.protocol = 'https:';
        return new Response(null, { status: 301, headers: { Location: u0.toString(), 'Cache-Control': 'no-store' } });
      }
      if (!env.DB) return new Response('اربط قاعدة بيانات D1 بالاسم DB من إعدادات الـ Worker.', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      await ensureSchema(env.DB);
      const url = new URL(req.url), p = url.pathname, m = req.method;
      if (url.hostname === 'www.' + NEW_HOST) return new Response(null, { status: 301, headers: { Location: 'https://' + NEW_HOST + p + url.search, 'Cache-Control': 'no-store' } });
      if (url.hostname === NEW_HOST) {
        await markNewLive(env);
        if (p === '/__move') return moveLanding(req, env, url);
      }
      if (p.startsWith('/api/') && /^\/api\/(study|games|finals|quiz|live|courses)/.test(p)) await loadPacks(env, url);
      if (m !== 'GET' && m !== 'HEAD' && !sameOrigin(req)) return json({ error: 'forbidden' }, 403);

      let mm0;
      const adminCount = async () => ((await env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").first()) || {}).n || 0;

      if (p === '/tool/tahdir-noor.user.js' || p === '/tool/tahdir-noor.meta.js') return new Response(TOOL, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' } });
      if (p === '/privacy' || p === '/support') return new Response(PRIVACY, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", ...SEC_HEADERS } });
      if (p === '/download/khabeer-ext.zip' && EXTZIP) return new Response(Uint8Array.from(atob(EXTZIP), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="khabeer-ext.zip"', 'Cache-Control': 'no-cache' } });
      if (p === '/download/khabeer.apk') return new Response(Uint8Array.from(atob(APK), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Disposition': 'attachment; filename="khabeer.apk"', 'Cache-Control': 'no-cache' } });
      if (ICONS[p]) return new Response(Uint8Array.from(atob(ICONS[p]), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' } });
      if (p === '/manifest.webmanifest') return new Response(MANIFEST, { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
      // فيديو الإعلانات مع دعم Range (Safari/آيفون لا يشغّل الفيديو بدونه، والأصول الثابتة تُرجع الملف كاملًا)
      { const pv = p.match(/^\/pv\/([a-z0-9_-]+\.(mp4|jpg))$/i);
        if (pv && env.ASSETS) {
          const r = await env.ASSETS.fetch(new Request(new URL('/promo/' + pv[1], url.origin)));
          if (!r.ok) return new Response('nf', { status: 404 });
          const buf = new Uint8Array(await r.arrayBuffer()), ct = pv[2].toLowerCase() === 'mp4' ? 'video/mp4' : 'image/jpeg', n = buf.length;
          const H = { 'Content-Type': ct, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' };
          const rg = /bytes=(\d*)-(\d*)/.exec(req.headers.get('Range') || '');
          if (rg && (rg[1] || rg[2])) {
            let a = rg[1] ? +rg[1] : Math.max(0, n - +rg[2]), z = rg[1] && rg[2] ? Math.min(+rg[2], n - 1) : n - 1;
            if (a >= n || a > z) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${n}` } });
            return new Response(req.method === 'HEAD' ? null : buf.subarray(a, z + 1), { status: 206, headers: { ...H, 'Content-Range': `bytes ${a}-${z}/${n}`, 'Content-Length': String(z - a + 1) } });
          }
          return new Response(req.method === 'HEAD' ? null : buf, { headers: { ...H, 'Content-Length': String(n) } });
        } }
      if (p === '/version') { let packs = false; try { packs = await loadPacks(env, url); } catch (e) { packs = String(e.message || e); } return json({ ...BUILD, packs }); }
      if ((mm0 = p.match(/^\/x\/([a-f0-9]{40})$/))) return exportFile(req, env, mm0[1]);
      if (p === '/robots.txt') return new Response('User-agent: *\nDisallow: /', { headers: { 'Content-Type': 'text/plain' } });
      if (p === '/setup') return (await adminCount()) ? redirect('/') : html('setup');
      if (p === '/api/setup' && m === 'POST') {
        if (await adminCount()) return json({ error: 'تم إنشاء حساب المدير من قبل.' }, 403);
        const b = await body(req);
        try { await createUser(env, { ...b, role: 'admin' }); } catch (e) { return json({ error: e.message }, 400); }
        return json({ ok: true });
      }
      if (p === '/api/login' && m === 'POST') return login(req, env);
      if (p === '/play') return html('play');
      if (/^\/s\/[A-Za-z0-9]{6}\/?$/.test(p) || p === '/s' || p === '/s/') return html('student');
      if (p.startsWith('/api/s/')) { const r = await studentApi(req, env, p, m, url); if (r) return r; }
      if (p.startsWith('/api/play/')) { const r = await playApi(req, env, p, m, url); if (r) return r; }

      const me = await currentUser(req, env);
      if (p === '/api/logout' && m === 'POST') {
        const c = cookies(req); if (c.sid) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(c.sid).run();
        const cs = cookies(req), tk = cs.sid || String(req.headers.get('X-Tahdir-Sid') || '').trim();
        if (tk) { try { await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(tk).run(); } catch (e) {} }
        return json({ ok: true }, 200, { 'Set-Cookie': setCookie('sid', '', 0, req) });
      }
      if (p === '/') {
        if (!(await adminCount())) return redirect('/setup');
        return me ? redirect(me.role === 'admin' ? '/admin' : '/app') : html('login');
      }
      if (!me) return p.startsWith('/api/') ? json({ error: 'سجّل الدخول أولًا.' }, 401) : redirect('/');

      // «تصحيح الواجبات» مخفي من القوائم، ويُفتح بالرابط المباشر (/grading)
      if (p === '/app') return html('app');
      if (p === '/api/me') {
        // «first»: أول دخول لهذا الحساب — يُستخدم لإظهار دليل الاستخدام مرة واحدة
        // لمن يدخل أول مرة فقط. معلم له زيارات سابقة (أحداث دخول أكثر من واحد)
        // لا يظهر له الدليل تلقائيًّا، ولو كان قد مسح تخزين المتصفح.
        let lg = 0;
        try {
          const r = await env.DB.prepare("SELECT COUNT(*) n FROM events WHERE user_id = ? AND type = 'login'").bind(me.id).first();
          lg = (r && r.n) || 0;
        } catch (e) { lg = 0; }
        return json({ name: me.name, username: me.username, role: me.role, delegated: +me.delegated === 1, id: me.id, first: lg <= 1 });
      }
      // ---------- مركز الإشعارات (الجرس) ----------
      // قائمة الرسائل الموجهة للمعلمين من المدير: الأخيرة أولاً مع حالة «مقروء» الخاصة بهذا المستخدم
      if (p === '/api/notices') {
        // كل معلم يرى إشعارات خبير (?b=k) + الإشعارات العامة
        const bq = url.searchParams.get('b'), br = bq === 'k' ? 'k' : null;
        const N = (await (br ? env.DB.prepare("SELECT id,title,body,url,video,brand,created_at FROM notices WHERE brand IS NULL OR brand = '' OR brand = ? ORDER BY id DESC LIMIT 20").bind(br)
          : env.DB.prepare('SELECT id,title,body,url,video,brand,created_at FROM notices ORDER BY id DESC LIMIT 20')).all()).results || [];
        const R = new Set(((await env.DB.prepare('SELECT notice_id FROM notice_reads WHERE user_id = ?').bind(me.id).all()).results || []).map(r => r.notice_id));
        return json({ notices: N.map(n => ({ ...n, read: R.has(n.id) })) });
      }
      if (p === '/api/notices/read' && m === 'POST') {
        const b = await body(req);
        if (b.all) {
          const N = (await env.DB.prepare('SELECT id FROM notices').all()).results || [];
          await env.DB.batch(N.map(x => env.DB.prepare('INSERT OR IGNORE INTO notice_reads(notice_id,user_id,at) VALUES(?,?,?)').bind(x.id, me.id, now())));
          return json({ ok: true });
        }
        const id = +b.id || 0; if (!id) return json({ error: 'مطلوب رقم الإشعار' }, 400);
        await env.DB.prepare('INSERT OR IGNORE INTO notice_reads(notice_id,user_id,at) VALUES(?,?,?)').bind(id, me.id, now()).run();
        return json({ ok: true });
      }
      if (p === '/quiz') return html('quiz');
      if (p === '/homework') return html('homework');
      if (p === '/games') return html('games');
      if (p === '/grading') return html('grading');
      if (p === '/api/nour/tasks') {
        if (m === 'POST') {
          const b = await body(req), data = JSON.stringify(b.tasks || {});
          if (data.length > 300000) return json({ error: 'كبير جدًا' }, 400);
          await env.DB.prepare('INSERT INTO nour_tasks(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').bind(me.id, data, now()).run();
          return json({ ok: true });
        }
        const r = await env.DB.prepare('SELECT data, updated_at FROM nour_tasks WHERE user_id = ?').bind(me.id).first();
        return json({ tasks: r ? JSON.parse(r.data) : {}, updated_at: r ? r.updated_at : null });
      }
      if (p === '/remedial') return html('remedial');
      if (p === '/diag') return html('diag');
      if (p === '/summaries') return html('summaries');
      if (p === '/finals') return html('finals');
      if (p === '/slides') return html('slides');
      if (p === '/cando') return html('cando');
      if (p === '/research') return html('research');
      if (p === '/analysis') return html('analysis');
      if (p === '/ld') return html('ld');
      if (p === '/forms') return html('forms');
      if (p === '/space') return html('space');
      if (p === '/cards') return html('cards');
      if (p === '/api/finals') {
        const key = url.searchParams.get('key') || '', sc = scopeOf(me);
        if (sc && !sc.has(key)) return json({ error: 'غير مسموح.' }, 403);
        const G = FINALS[key]; if (!G) return json({ error: 'لا توجد اختبارات لهذا الصف.' }, 404);
        const lessons = {}; (await allLessons(env)).filter(l => courseKey(l) === key).forEach(l => { lessons[l.id] = { title: l.title, unit: l.unit }; });
        return json({ ...G, lessons });
      }
      if (p === '/api/study') {
        const key = url.searchParams.get('key') || '', sc = scopeOf(me);
        if (sc && !sc.has(key)) return json({ error: 'غير مسموح.' }, 403);
        const ls = (await allLessons(env)).filter(l => courseKey(l) === key);
        const study = {}, units = {};
        ls.forEach(l => { if (STUDY.lessons[l.id]) study[l.id] = STUDY.lessons[l.id]; const u = STUDY.units[key + '|' + l.unit]; if (u) units[l.unit] = u; });
        return json({ lessons: ls.map(l => ({ id: l.id, unit: l.unit, unit_name: l.unit_name, title: l.title, subject: l.subject, grade: l.grade, outcomes: l.outcomes || '', concepts: l.concepts || '' })), study, units, hard: hardItems(key, ls) });
      }
      if (p === '/api/games/data') { const d = await gamesData(env, me, url.searchParams.get('key') || ''); return d.error ? json(d, 403) : json(d); }
      if (p.startsWith('/api/live/')) return liveApi(req, env, me, p, m, url);
      if (p === '/api/lessons') return jsonETag(req, { lessons: await lessonsFor(env, me) });
      if (p.startsWith('/api/ai/')) { const r = await aiApi(req, env, me, p, m, url); if (r) return r; }
      // ---------- «بطاقات الإجابة»: حالة الجلسة الحية لشاشة السبورة (جوال المعلم يكتب، والسبورة تقرأ) ----------
      if (p === '/api/cards/live') {
        if (m === 'POST') {
          const t = await req.text();
          if (t.length > 60000) return json({ error: 'too_large' }, 413);
          let b = {}; try { b = JSON.parse(t || '{}'); } catch (e) {}
          const sidParam = url.searchParams.get('sid'), state = b.state || {}, sid = sidParam ? Number(sidParam) : Number(state.sid || 0);
          if (!Number.isSafeInteger(sid) || sid < 1 || (sidParam && Number(state.sid) !== sid)) return json({ error: 'معرّف الجلسة غير صالح.' }, 400);
          const own = await env.DB.prepare('SELECT id FROM quizzes WHERE id = ? AND user_id = ? AND kind = ?').bind(sid, me.id, 'csession').first();
          if (!own) return json({ error: 'الجلسة غير متاحة.' }, 404);
          const value = JSON.stringify(state);
          await env.DB.batch([
            env.DB.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind('cl:' + me.id + ':' + sid, value),
            env.DB.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind('cl:' + me.id, value)
          ]);
          return json({ ok: true });
        }
        const sidParam = url.searchParams.get('sid'), sid = sidParam ? Number(sidParam) : 0;
        if (sidParam && (!Number.isSafeInteger(sid) || sid < 1)) return json({ state: null });
        if (sid) {
          const own = await env.DB.prepare('SELECT id FROM quizzes WHERE id = ? AND user_id = ? AND kind = ?').bind(sid, me.id, 'csession').first();
          if (!own) return json({ state: null });
        }
        let r = sid ? await env.DB.prepare('SELECT v FROM kv WHERE k = ?').bind('cl:' + me.id + ':' + sid).first() : null;
        if (!r) r = await env.DB.prepare('SELECT v FROM kv WHERE k = ?').bind('cl:' + me.id).first();
        let st = null; try { st = r ? JSON.parse(r.v) : null; } catch (e) {}
        if (sid && st && Number(st.sid) !== sid) st = null;
        return json({ state: st });
      }
      if (p.startsWith('/api/classes')) { const r = await classesApi(req, env, me, p, m, url); if (r) return r; }
      if (p === '/api/courses') { const sc = scopeOf(me); return json({ courses: (await coursesList(env)).filter(c => !sc || sc.has(c.key)) }); }
      if (p === '/api/quiz/bank') {
        const key = url.searchParams.get('key') || '', sc = scopeOf(me);
        if (sc && !sc.has(key)) return json({ error: 'غير مسموح.' }, 403);
        const ls = (await allLessons(env)).filter(l => courseKey(l) === key);
        const ids = new Set(ls.map(l => l.id));
        return json({ lessons: ls.map(l => ({ id: l.id, unit: l.unit, unit_name: l.unit_name, title: l.title, subject: l.subject, grade: l.grade, term: l.term || 1 })), items: itBank(key, QBANK.filter(q => ids.has(q.lesson_id)).concat(finQuizItems(key).filter(q => ids.has(q.lesson_id)))) });
      }
      // ---------- مصحّح الاختبار القصير: يفحص ورقة **مرفوعة** (Word/PDF/نصّ) ----------
      // المتصفح هو من يستخرج النصّ (Word عبر DecompressionStream، وPDF عبر pdf.js)،
      // ثم يُرسل النصّ وحده هنا. فنبقى داخل حدود الـWorker بلا مكتبات ثقيلة.
      if (p === '/api/checkquiz' && m === 'POST') {
        const b = await body(req);
        const text = String(b.text || '').slice(0, 400000);
        if (!text.trim()) return json({ error: 'لم يصل نصّ الورقة. جرّب نسخ النصّ ولصقه بدل الرفع.' }, 400);
        return json(checkQuizText(text, b.grade || '', b.subject || '', b.withAnswer !== false));
      }
      if (p === '/api/export' && m === 'POST') {
        const b = await body(req), id = rand(20), fmt = b.format === 'print' ? 'print' : 'doc';
        const name = String(b.name || 'خبير').replace(/[\\/:*?"<>|\r\n]+/g, '-').slice(0, 100);
        await env.DB.batch([
          env.DB.prepare('DELETE FROM exports WHERE created_at < ?').bind(now() - 86400000),
          env.DB.prepare('INSERT INTO exports(id,user_id,name,format,body,created_at) VALUES(?,?,?,?,?,?)').bind(id, me.id, name, fmt, String(b.html || '').slice(0, 1900000), now())
        ]);
        return json({ ok: true, url: '/x/' + id });
      }
      if (p === '/api/quizzes' && m === 'GET') {
        const kinds = (url.searchParams.get('kind') || '').split(',').filter(Boolean);
        let r = (await env.DB.prepare('SELECT id,title,grade,subject,kind,created_at,updated_at FROM quizzes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 400').bind(me.id).all()).results || [];
        if (kinds.length) r = r.filter(q => kinds.includes(q.kind || 'quiz'));
        return json({ quizzes: r.slice(0, 200) });
      }
      if (p === '/api/quizzes' && m === 'POST') {
        const b = await body(req), t = now();
        const title = String(b.title || 'اختبار').trim().slice(0, 160), data = JSON.stringify(b.data || {});
        if (data.length > 400000) return json({ error: 'الاختبار كبير جدًا.' }, 400);
        if (b.id) {
          const r = await env.DB.prepare('UPDATE quizzes SET title=?, grade=?, subject=?, kind=?, data=?, updated_at=? WHERE id=? AND user_id=?').bind(title, String(b.grade || ''), String(b.subject || ''), String(b.kind || ''), data, t, +b.id, me.id).run();
          if (r.meta && r.meta.changes) return json({ ok: true, id: +b.id, updated_at: t });
        }
        const n = await env.DB.prepare('SELECT COUNT(*) n FROM quizzes WHERE user_id = ?').bind(me.id).first();
        if (n && n.n >= 400) return json({ error: 'وصلت إلى الحد الأقصى للملفات المحفوظة. احذف بعضها أولًا.' }, 400);
        const r = await env.DB.prepare('INSERT INTO quizzes(user_id,title,grade,subject,kind,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) RETURNING id').bind(me.id, title, String(b.grade || ''), String(b.subject || ''), String(b.kind || ''), data, t, t).first();
        return json({ ok: true, id: r && r.id, updated_at: t });
      }
      if ((mm0 = p.match(/^\/api\/quizzes\/(\d+)$/))) {
        const id = +mm0[1];
        if (m === 'DELETE') { await env.DB.prepare('DELETE FROM quizzes WHERE id = ? AND user_id = ?').bind(id, me.id).run(); return json({ ok: true }); }
        const r = await env.DB.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?').bind(id, me.id).first();
        if (!r) return json({ error: 'غير موجود' }, 404);
        return json({ quiz: { ...r, data: JSON.parse(r.data) } });
      }
      if (p === '/api/event' && m === 'POST') {
        const b = await body(req);
        const type = EVENT_TYPES.has(b.type) ? b.type : null;
        if (!type) return json({ error: 'bad' }, 400);
        let l = LESSONS.find(x => x.id === +b.lesson_id);
        if (!l && +b.lesson_id >= CUSTOM_BASE) { const r = await env.DB.prepare('SELECT data FROM custom_lessons WHERE id = ?').bind(+b.lesson_id).first(); if (r) { try { l = { ...JSON.parse(r.data), id: +b.lesson_id }; } catch {} } }
        const grade = l ? l.grade : String(b.grade || '').slice(0, 30) || null;
        await env.DB.prepare('INSERT INTO events(user_id,type,grade,lesson_id,lesson_title,detail,device_id,ip,at) VALUES(?,?,?,?,?,?,?,?,?)')
          .bind(me.id, type, grade, l ? l.id : null, l ? l.title : (b.title ? String(b.title).slice(0, 120) : null), String(b.detail || '').slice(0, 40), me.device_id, ipOf(req), now()).run();
        return json({ ok: true });
      }

      // ----- admin only -----
      if (me.role !== 'admin') return p.startsWith('/api/') ? json({ error: 'غير مسموح.' }, 403) : redirect('/app');
      if (p === '/admin') return html('admin');
      // لوحة التحكم «الشاملة» المخفية: نفس الصفحة، والواجهة تطلب بياناتها بـ vault=1
      if (p === '/shamela' || p === '/shamela/') return html('admin');
      // كلمة مرور «الشاملة» (تُخزَّن بصمتها فقط) — تُطلب مرة لكل جلسة دخول
      if (p === '/api/admin/vault-unlock' && m === 'POST') {
        const b = await body(req);
        const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('elkabsula-vault:' + String(b.password || ''))));
        const hex = Array.from(d, x => x.toString(16).padStart(2, '0')).join('');
        if (hex !== VAULT_PW_SHA) { await new Promise(r => setTimeout(r, 900)); return json({ error: 'كلمة المرور غير صحيحة.' }, 403); }
        await env.DB.prepare('UPDATE sessions SET vault_ok = 1 WHERE token = ?').bind(me.token).run();
        return json({ ok: true });
      }
      const VAULT = url.searchParams.get('vault') === '1';
      if (VAULT && !+me.vault_ok) return json({ error: 'vault_locked' }, 423);
      if (p === '/api/admin/stats') return json(await adminStats(env, VAULT));
      if (p === '/api/admin/activity') return json(await adminActivity(env, VAULT));
      if (p === '/api/admin/report') return json(await adminReport(env, Math.max(0, Math.min(3650, +url.searchParams.get('days') || 0)), VAULT));
      // ---------- إدارة الإشعارات: يكتب المدير الإعلان فيتلقاه كل المعلمين في الجرس ----------
      if (p === '/api/admin/notices' && m === 'GET') {
        const N = (await env.DB.prepare('SELECT n.id, n.title, n.body, n.url, n.video, n.brand, n.created_at, (SELECT COUNT(*) FROM notice_reads r WHERE r.notice_id = n.id) reads FROM notices n ORDER BY n.id DESC LIMIT 50').all()).results || [];
        return json({ notices: N });
      }
      if (p === '/api/admin/notices' && m === 'POST') {
        const b = await body(req);
        const t = String(b.title || '').trim().slice(0, 120), bd = String(b.body || '').trim().slice(0, 4000), u = String(b.url || '').trim().slice(0, 300);
        const vd = String(b.video || '').trim().slice(0, 300), br = b.brand === 'k' || b.brand === 't' ? b.brand : null;
        if (!t || !bd) return json({ error: 'اكتب العنوان والنص.' }, 400);
        if (vd && !/^\/promo\/[a-z0-9_-]+\.mp4$/i.test(vd)) return json({ error: 'رابط الفيديو غير صالح.' }, 400);
        await env.DB.prepare('INSERT INTO notices(title,body,url,video,brand,created_at) VALUES(?,?,?,?,?,?)').bind(t, bd, u || null, vd || null, br, now()).run();
        return json({ ok: true });
      }
      { const no = p.match(/^\/api\/admin\/notices\/(\d+)$/);
        if (no && m === 'DELETE') {
          await env.DB.batch([env.DB.prepare('DELETE FROM notices WHERE id = ?').bind(+no[1]), env.DB.prepare('DELETE FROM notice_reads WHERE notice_id = ?').bind(+no[1])]);
          return json({ ok: true });
        } }
      if (p === '/api/admin/courses' && m === 'GET') return json({ courses: await coursesList(env), build: BUILD });
      if (p === '/api/admin/courses' && m === 'POST') {
        const b = await body(req), subject = String(b.subject || '').trim().slice(0, 40), grade = String(b.grade || '').trim().slice(0, 30);
        if (!subject || !grade) return json({ error: 'اكتب المادة والصف.' }, 400);
        await env.DB.prepare('INSERT OR IGNORE INTO courses(key,subject,grade,created_at) VALUES(?,?,?,?)').bind(subject + '|' + grade, subject, grade, now()).run();
        return json({ ok: true, key: subject + '|' + grade });
      }
      if (p === '/api/admin/courses' && m === 'DELETE') {
        const key = url.searchParams.get('key') || '';
        const used = (await customLessons(env)).some(l => courseKey(l) === key) || LESSONS.some(l => courseKey(l) === key);
        if (used) return json({ error: 'احذف دروس هذا الصف أولًا.' }, 400);
        await env.DB.prepare('DELETE FROM courses WHERE key = ?').bind(key).run();
        return json({ ok: true });
      }
      if (p === '/api/admin/custom_lessons' && m === 'POST') {
        const b = await body(req);
        const subject = String(b.subject || '').trim().slice(0, 40), grade = String(b.grade || '').trim().slice(0, 30), title = String(b.title || '').trim().slice(0, 200);
        if (!subject || !grade || !title) return json({ error: 'المادة والصف وعنوان الدرس مطلوبة.' }, 400);
        const data = { subject, grade, title, unit: String(+b.unit || 1), unit_name: String(b.unit_name || '').slice(0, 200), lesson_no: Math.max(0, +b.lesson_no || 0), term: +b.term === 2 ? 2 : 1, hw_type: b.hw_type === 'mcq' ? 'mcq' : 'essay' };
        for (const k of LESSON_FIELDS) if (!(k in data) && typeof b[k] === 'string') data[k] = b[k].slice(0, 20000);
        let id = +b.id || 0;
        if (id) { if (id < CUSTOM_BASE) return json({ error: 'bad id' }, 400); }
        else { const mx = await env.DB.prepare('SELECT MAX(id) m FROM custom_lessons').first(); id = Math.max(CUSTOM_BASE, ((mx && mx.m) || 0) + 1); }
        await env.DB.batch([
          env.DB.prepare('INSERT INTO custom_lessons(id,data,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').bind(id, JSON.stringify(data), now()),
          env.DB.prepare('INSERT OR IGNORE INTO courses(key,subject,grade,created_at) VALUES(?,?,?,?)').bind(subject + '|' + grade, subject, grade, now())
        ]);
        return json({ ok: true, id });
      }
      if ((mm0 = p.match(/^\/api\/admin\/custom_lessons\/(\d+)$/)) && m === 'DELETE') {
        await env.DB.prepare('DELETE FROM custom_lessons WHERE id = ?').bind(+mm0[1]).run();
        return json({ ok: true });
      }
      if (p === '/api/admin/teachers' && m === 'POST') {
        const b = await body(req);
        try { await createUser(env, { ...b, role: 'teacher' }); } catch (e) { return json({ error: /UNIQUE/i.test(e.message) ? 'اسم المستخدم مستخدم من قبل.' : e.message }, 400); }
        return json({ ok: true });
      }
      if (p === '/api/admin/import' && m === 'POST') {
        const b = await body(req); const lines = String(b.text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const done = [], errors = [];
        for (const ln of lines.slice(0, 300)) {
          const parts = ln.split(/\s*[,،\t]\s*/);
          const [name, username] = parts; const password = parts[2] || genPass();
          try { await createUser(env, { name, username, password, scope: Array.isArray(b.scope) ? b.scope.map(String) : null }); done.push({ name, username: cleanUser(username), password }); }
          catch (e) { errors.push({ line: ln, error: /UNIQUE/i.test(e.message) ? 'اسم المستخدم مستخدم من قبل.' : e.message }); }
        }
        return json({ done, errors });
      }
      let mm;
      if ((mm = p.match(/^\/api\/admin\/teachers\/(\d+)$/))) {
        const id = +mm[1];
        const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
        if (!u) return json({ error: 'غير موجود' }, 404);
        // المدير المفوَّض لا يعدّل أي حساب مدير غير حسابه (لا المدير الرئيسي ولا مفوَّضًا آخر)
        const owner = !+me.delegated, tDel = u.role === 'admin' && +u.delegated === 1;
        if (!owner && u.role === 'admin' && u.id !== me.id) return json({ error: 'لا يمكنك تعديل حساب المدير الرئيسي أو مدير آخر.' }, 403);
        if (m === 'DELETE') {
          if (u.role === 'admin' && !(tDel && owner)) return json({ error: 'لا يمكن حذف حساب المدير.' }, 400);
          await env.DB.batch(['users WHERE id', 'devices WHERE user_id', 'sessions WHERE user_id'].map(t => env.DB.prepare(`DELETE FROM ${t} = ?`).bind(id)));
          return json({ ok: true });
        }
        if (m === 'POST') {
          const b = await body(req); const out = { ok: true };
          if (b.action === 'reset_devices') await env.DB.batch([env.DB.prepare('DELETE FROM devices WHERE user_id = ?').bind(id), env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND user_id <> ?').bind(id, me.id)]);
          else if (b.action === 'clean_stale') {
            // إزالة أجهزة هذا المعلم التي لم تُستخدم منذ مدة الإهمال (لا يخسر جهازه الحالي)
            const cut = now() - staleSeconds(env) * 1000;
            const dead = (await env.DB.prepare('SELECT id, device_id FROM devices WHERE user_id = ? AND last_seen < ?').bind(id, cut).all()).results || [];
            if (!dead.length) return json({ ok: true, removed: 0 });
            await env.DB.batch(dead.flatMap(d => [
              env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND device_id = ?').bind(id, d.device_id),
              env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(d.id)
            ]));
            return json({ ok: true, removed: dead.length });
          }
          else if (b.action === 'remove_device') await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND device_id = (SELECT device_id FROM devices WHERE id = ? AND user_id = ?)').bind(id, +b.device, id), env.DB.prepare('DELETE FROM devices WHERE id = ? AND user_id = ?').bind(+b.device, id)]);
          else if (b.action === 'delegate') {
            // منح/سحب صلاحية المدير — للمدير الرئيسي فقط
            if (!owner) return json({ error: 'منح التفويض وسحبه للمدير الرئيسي فقط.' }, 403);
            if (u.role === 'admin' && !tDel) return json({ error: 'هذا هو حساب المدير الرئيسي.' }, 400);
            if (b.value) await env.DB.prepare("UPDATE users SET role = 'admin', delegated = 1, vault = 0, active = 1 WHERE id = ?").bind(id).run();
            else await env.DB.batch([
              env.DB.prepare("UPDATE users SET role = 'teacher', delegated = 0 WHERE id = ?").bind(id),
              env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id)]);
          }
          else if (b.action === 'toggle') {
            if (u.role === 'admin' && !(tDel && owner)) return json({ error: 'لا يمكن إيقاف حساب المدير.' }, 400);
            await env.DB.prepare('UPDATE users SET active = 1 - active WHERE id = ?').bind(id).run();
            await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
          } else if (b.action === 'password') {
            const pw = String(b.password || '') || genPass();
            if (pw.length < 6) return json({ error: 'كلمة المرور 6 أحرف على الأقل.' }, 400);
            const salt = rand(16); await env.DB.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').bind(await hashPass(pw, salt), salt, id).run();
            if (id !== me.id) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
            out.password = pw;
          } else if (b.action === 'max_devices') {
            await env.DB.prepare('UPDATE users SET max_devices = ? WHERE id = ?').bind(Math.max(1, Math.min(5, +b.value || 2)), id).run();
          } else if (b.action === 'scope') {
            const v = Array.isArray(b.value) ? b.value.map(x => String(x).slice(0, 80)).slice(0, 50) : [];
            await env.DB.prepare('UPDATE users SET scope = ? WHERE id = ?').bind(v.length ? JSON.stringify(v) : null, id).run();
          } else if (b.action === 'vault') {
            if (u.role === 'admin') return json({ error: 'لا يمكن نقل حساب المدير.' }, 400);
            await env.DB.prepare('UPDATE users SET vault = ? WHERE id = ?').bind(b.value ? 1 : 0, id).run();
          } else if (b.action === 'rename') {
            const n = String(b.name || '').trim().slice(0, 80); if (!n) return json({ error: 'اكتب الاسم.' }, 400);
            await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(n, id).run();
          } else return json({ error: 'bad action' }, 400);
          return json(out);
        }
      }
      if ((mm = p.match(/^\/api\/admin\/lessons\/(\d+)$/)) && m === 'POST') {
        const id = +mm[1]; const b = await body(req);
        if (id >= CUSTOM_BASE) {
          const r = await env.DB.prepare('SELECT data FROM custom_lessons WHERE id = ?').bind(id).first();
          if (!r) return json({ error: 'غير موجود' }, 404);
          const d = JSON.parse(r.data); for (const k of LESSON_FIELDS) if (typeof b[k] === 'string') d[k] = b[k].slice(0, 20000);
          await env.DB.prepare('UPDATE custom_lessons SET data = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(d), now(), id).run();
          return json({ ok: true });
        }
        if (!LESSON_IDS.has(id)) return json({ error: 'غير موجود' }, 404); const cur = await env.DB.prepare('SELECT data FROM lesson_overrides WHERE lesson_id = ?').bind(id).first();
        const data = cur ? JSON.parse(cur.data) : {};
        for (const k of LESSON_FIELDS) if (typeof b[k] === 'string') data[k] = b[k].slice(0, 20000);
        await env.DB.prepare('INSERT INTO lesson_overrides(lesson_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(lesson_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').bind(id, JSON.stringify(data), now()).run();
        return json({ ok: true });
      }
      return p.startsWith('/api/') ? json({ error: 'not found' }, 404) : redirect('/');
    } catch (e) {
      return json({ error: 'حدث خطأ في السيرفر.', detail: String(e && e.message || e).slice(0, 200) }, 500);
    }
  }
};
