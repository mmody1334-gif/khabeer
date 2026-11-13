# -*- coding: utf-8 -*-
# يبني worker.js واحدًا من مصادر الموقع. يُشغَّل محليًا أو من GitHub Actions.
import json, os, re, subprocess, datetime, sys
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
DIST = os.path.join(HERE, '..', 'dist')
os.makedirs(DIST, exist_ok=True)
theme = json.load(open(os.path.join(DATA, 'theme.json'), encoding='utf-8'))
base_css, HELIX, CELL, LOGO = theme['css'], theme['HELIX'], theme['CELL'], theme['LOGO']
# هوية «خبير»: الشعار وشعارا البانر (الوزارة ورؤية عُمان 2040) وألوان فاتحة متناسقة
import base64 as _b64
_BR = os.path.join(DATA, 'brand')
LOGO = '<img class="kb-logo" src="/brand/logo.png" alt="" width="320" height="315" decoding="async">'
_img = lambda f: '/brand/' + f
BRAND_ICONS = {'/brand/' + f: _b64.b64encode(open(os.path.join(_BR, f), 'rb').read()).decode() for f in ('moe.png', 'vision.png', 'logo.png')}
# واجهة «خبير»: بلا شعاري الوزارة ورؤية عُمان وبلا اسم المدرسة (الشعارات والمدرسة تبقى في الأوراق المطبوعة فقط).
BANNER = f'''<div class="kb-banner kb-solo"><div class="kb-mid"><div class="kb-mark">{LOGO}</div><div class="kb-name"><b>خبير</b><span>منصة المعلمين</span></div></div></div>'''
# هوية «خبير»: اللوحة كاملة في site/data/theme.json (لا تجاوزات هنا)
# منع ضبط النص (justify) وتمدد الحروف في الدروس والمربعات: كان يفرّق الكلمات العربية في الأسطر المكسورة
base_css += '\ntextarea,[contenteditable],.lesson,.lesson *,.tree,.tree *{text-align:right !important;text-justify:none !important;letter-spacing:normal !important;word-spacing:normal !important;}'
lessons = json.load(open(os.path.join(DATA, 'lessons.json'), encoding='utf-8'))
# دروس اللغة العربية تأتي من ملفها الخاص، وقيمة grade فيه مكتوبة «الصف التاسع» بينما كل الملفات
# الأخرى تكتبها «التاسع». الواجهة تضيف «الصف » بنفسها، فكانت تظهر «الصف الصف التاسع»،
# ومفتاح المقرر (المادة|الصف) يختلف عن بقية المواد. نوحّد الصيغة هنا عند البناء.
_GRADE_NAMES = ('الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر')
def _norm_grade(g):
    g = str(g or '').strip()
    return g[len('الصف '):] if g.startswith('الصف ') else g
for _ar_f in ('arabic_lessons_g5_to_g12.json', 'lessons_ar.json'):
    _ar_p = os.path.join(DATA, _ar_f)
    if os.path.exists(_ar_p):
        _ar = json.load(open(_ar_p, encoding='utf-8'))
        for _l in _ar:
            _g = _norm_grade(_l.get('grade'))
            if _g != _l.get('grade'):
                _l['grade'] = _g
            if _l.get('grade') not in _GRADE_NAMES:
                raise SystemExit('صف غير معروف في %s: %r' % (_ar_f, _l.get('grade')))
        lessons = [l for l in lessons if l.get('subject') != 'اللغة العربية'] + _ar


# ===== إزالة التطويل (الكشيدة «ـ») من كل النصوص =====
# ملفات التحضير المنسوخة من Word فيها «المـــــيل» و«حـــل» و«صـ 24»: تظهر ممطوطة في الموقع وفي نور.
# بين حرفين: تُحذف (المـــيل ← الميل). وبعد حرف في آخر الكلمة تبقى واحدة فقط (بـ 25، جـ، هـ متغيّرات).
# ومنفردة مكرّرة (فاصل ـــــ): تصير «-».
_AR = '\u0621-\u063A\u0641-\u064A\u0671-\u06D3'
_TW_IN = re.compile('(?<=[' + _AR + '\u064B-\u065F])\u0640+(?=[\u064B-\u065F]*[' + _AR + '])')
_TW_END = re.compile('(?<=[' + _AR + '\u064B-\u065F])\u0640{2,}')
_TW_RUN = re.compile('\u0640{2,}')
def _untat(o):
    if isinstance(o, str):
        return _TW_RUN.sub('-', _TW_END.sub('\u0640', _TW_IN.sub('', o))) if '\u0640' in o else o
    if isinstance(o, list): return [_untat(x) for x in o]
    if isinstance(o, dict): return {k: _untat(v) for k, v in o.items()}
    return o
lessons = _untat(lessons)
qbank = _untat(json.load(open(os.path.join(DATA, 'quiz_bank.json'), encoding='utf-8')))

# ===== محتوى اللغة العربية (5-12): ملخصات + خطط علاجية + بنك أسئلة =====
# المصدر: data/ar_content/*.txt بصيغة مختصرة سهلة التحرير، كتلة لكل درس:
#   #<رقم الدرس>
#   i: مقدمة الملخص
#   o: نص الهدف :: نقطة ;; نقطة ;; نقطة
#   t: مصطلح = تعريفه
#   r: «تذكّر»
#   f: محور العلاج        s: شرح مبسّط
#   a: fill|عنوان النشاط|التعليمات   (أو match / choose)  ثم أسطر  - سؤال => جواب
#   m: ع|نص السؤال|الصحيح|خطأ|خطأ|خطأ            (ع معرفة · ط تطبيق · س استدلال)
#   w: ط2|نص السؤال => الإجابة النموذجية           (الرقم = الدرجة)
_AO = {'ع': ('معرفة', 'منخفضة'), 'ط': ('تطبيق', 'متوسطة'), 'س': ('استدلال', 'مرتفعة')}
# اللغة الإنجليزية (11–12): Student Assessment Handbook – English Grades 11-12 (Sept. 2026) يقيس عناصر اللغة لا مستويات التعلم
_EN_AO = {'G': 'GRM', 'V': 'VCB', 'R': 'RDG', 'W': 'WRT'}
def _ar_content():
    import hashlib
    d = os.path.join(DATA, 'ar_content'); study = {}; items = []
    if not os.path.isdir(d): return study, items
    for fn in sorted(os.listdir(d)):
        if not fn.endswith('.txt'): continue
        cur = None
        for ln in open(os.path.join(d, fn), encoding='utf-8').read().split('\n'):
            ln = ln.strip()
            if not ln or ln.startswith('//'): continue
            if ln.startswith('#'):
                lid = int(ln[1:].split()[0]); n = [0]
                S = {'summary': {'intro': '', 'outcomes': [], 'terms': [], 'remember': []},
                     'remedial': {'focus': '', 'weak_areas': ['الفهم والاستيعاب', 'التطبيق اللغوي'], 'simple': '', 'activities': []}}
                study[str(lid)] = S; cur = (lid, S, n); continue
            if cur is None: raise SystemExit('ar_content/%s: سطر قبل رقم الدرس: %s' % (fn, ln))
            lid, S, n = cur
            if ln.startswith('- '):
                q, _, a = ln[2:].partition('=>')
                S['remedial']['activities'][-1]['items'].append({'q': q.strip(), 'a': a.strip()}); continue
            k, _, v = ln.partition(':'); v = v.strip()
            if k == 'i': S['summary']['intro'] = v
            elif k == 'o':
                t, _, pts = v.partition('::')
                S['summary']['outcomes'].append({'code': '', 'text': t.strip(), 'points': [x.strip() for x in pts.split(';;') if x.strip()]})
            elif k == 't':
                t, _, dd = v.partition('=')
                S['summary']['terms'].append({'t': t.strip(), 'd': dd.strip()})
            elif k == 'r': S['summary']['remember'].append(v)
            elif k == 'f': S['remedial']['focus'] = v
            elif k == 's': S['remedial']['simple'] = v
            elif k == 'a':
                ty, ti, ins = (v.split('|') + ['', ''])[:3]
                S['remedial']['activities'].append({'title': ti.strip(), 'type': ty.strip(), 'instructions': ins.strip(), 'items': []})
            elif k in ('m', 'w'):
                n[0] += 1
                if k == 'm':
                    p = [x.strip() for x in v.split('|')]
                    ao, dif = _AO[p[0][0]]; ch = [x for x in p[2:] if x]
                    if len(ch) < 3 or len(set(ch)) != len(ch): raise SystemExit('ar_content/%s #%d: خيارات ناقصة: %s' % (fn, lid, v))
                    # ترتيب ثابت (غير عشوائي في كل بناء) للخيارات
                    h = int(hashlib.md5(p[1].encode('utf-8')).hexdigest(), 16)
                    order = sorted(range(len(ch)), key=lambda i: (h >> (i * 7)) % 997)
                    chs = [ch[i] for i in order]
                    items.append({'lesson_id': lid, 'type': 'mcq', 'stem': p[1], 'choices': chs, 'correct': chs.index(ch[0]), 'answer': ch[0],
                                  'marks': 1, 'ao': ao, 'difficulty': dif, 'outcome': '', 'notes': '', 'qid': 'ar%d_%d' % (lid, n[0])})
                else:
                    head, _, rest = v.partition('|'); q, _, a = rest.partition('=>')
                    ao, dif = _AO[head[0]]; mk = int(head[1:] or 2)
                    items.append({'lesson_id': lid, 'type': 'short', 'stem': q.strip(), 'choices': [], 'correct': 0, 'answer': a.strip(),
                                  'marks': mk, 'ao': ao, 'difficulty': dif, 'outcome': '', 'notes': '', 'qid': 'ar%d_%d' % (lid, n[0])})
            else: raise SystemExit('ar_content/%s #%d: مفتاح غير معروف: %s' % (fn, lid, ln))
    # موازنة الدرجات: بعد مفردتي الاختيار من متعدد يبقى 13 درجة (عدد فردي) للإجابات القصيرة،
    # فلا تكتمل الورقة (15) إلا بوجود مفردات بدرجة واحدة. نجعل في الدروس الفردية أول قصيرة
    # «معرفة» بدرجة، وفي الزوجية آخر قصيرة «تطبيق» بدرجة — فتتوافر مفردات الدرجة الواحدة في كل هدف.
    by = {}
    for q in items:
        if q['type'] == 'short': by.setdefault(q['lesson_id'], []).append(q)
    for lid, qs in by.items():
        if lid % 2:
            k = [q for q in qs if q['ao'] == 'معرفة' and q['marks'] == 2][:1]
        else:
            k = [q for q in qs if q['ao'] == 'تطبيق' and q['marks'] == 2][-1:]
        for q in k: q['marks'] = 1
    return study, items
_AR_STUDY, _AR_Q = _ar_content()
# مجالات التعثر في الخطة العلاجية حسب نوع الدرس (تطابق قائمة WEAK_LANG في client_study.js)
def _ar_weak(title):
    t = title or ''
    if re.search('خط (النسخ|الرقعة)|مهاراتي في الكتابة', t): return ['الخط', 'الإملاء وعلامات الترقيم']
    if re.search('إملا|املا|همز|ترقيم|الفاصلة|الألف|الالف|التاء المربوطة|تكتب ولا|تنطق ولا|ألف التفريق|الهاء في', t): return ['الإملاء وعلامات الترقيم']
    if re.search('نحو|صرف|الفعل|الفاعل|المفعول|الخبر|المضاف|الجملة|حروف الجر|شبه جملة|الإعراب|المجرد|الميزان|النعت|العطف|الممنوع|الحال|تمييز|العدد|اسم ال|صيغ|الصفة|أسلوب|كاد|المقصور|المعاجم|المعجم|النون الساكنة', t): return ['القواعد النحوية والصرفية']
    if re.search('بلاغ|التشبيه|السجع|الجناس|المسند|التقديم|الخبر والإنشاء|العروض|بحر|نقد', t): return ['التذوق الأدبي والبلاغي']
    if re.search('تعبير|كتابة|التلخيص|تلخيص|منهجية|تصميم|محضر|المذكرات|التحقيق|ترجمة|عرض كتاب|الرسالة|الوصف|السرد|وصف', t): return ['التعبير الكتابي']
    if re.search('استماع|الاستماع|تحدث|التحدث|شفوي|الإلقاء|الالقاء|قراءة صورة|قراءة شعار|قراءة غلاف', t): return ['الاستماع والتحدث', 'الفهم والاستيعاب']
    if re.search('شعر|قصيدة|النص الأدبي|نصوص أدبية|النصوص|أدب|الأدب|معلقة|المقام', t): return ['التذوق الأدبي والبلاغي', 'الثروة اللغوية (المفردات ومعانيها)']
    return ['الفهم والاستيعاب', 'الثروة اللغوية (المفردات ومعانيها)']
_LT = {str(l.get('id')): l.get('title', '') for l in lessons}
for _k, _v in _AR_STUDY.items():
    _v['remedial']['weak_areas'] = _ar_weak(_LT.get(_k, ''))
qbank = qbank + _untat(_AR_Q)
# ===== بنك أسئلة الأحياء الإضافي (9-12): أسئلة نهاية الوحدة في كتب الطالب والنشاط + أسئلة بنمط كامبريدج =====
# المصدر: data/bio_bank/*.txt — كتلة لكل درس:
#   #<رقم الدرس>
#   s: مصدر الأسئلة التالية (مثل: أسئلة نهاية الوحدة — كتاب الطالب)
#   m: ع|نص السؤال|الصحيح|خطأ|خطأ|خطأ          (ع معرفة · ط تطبيق · س استدلال)
#   w: ط2|نص السؤال => الإجابة                    (قصيرة؛ الرقم = الدرجة)
#   l: س3|نص السؤال => الإجابة                    (مقالية)
#   n: إرشادات التصحيح للسؤال السابق
#   T: عنوان الجدول ;; خلية ^ خلية ;; خلية ^ خلية   (جدول للسؤال السابق)
# داخل النصوص: « // » سطر جديد، و« ;; » في الإجابة سطر جديد (نقطة تصحيح).
def _bio_bank():
    import hashlib
    d = os.path.join(DATA, 'bio_bank'); items = []
    if not os.path.isdir(d): return items
    G = {str(l.get('id')): l.get('grade', '') for l in lessons}
    # الدراسات الاجتماعية: وثيقتها تقيس ثلاثة مستويات (المعرفة · الفهم والتطبيق · القدرات العليا) في كل الصفوف،
    # فلا تتحول رموز ع/ط/س إلى AO1/AO2 في الصفين 11-12 كما في العلوم.
    SSL = {str(l.get('id')) for l in lessons if re.search(r'اجتماع|الرياضة المدرسية', l.get('subject') or '')}
    for fn in sorted(os.listdir(d)):
        if not fn.endswith('.txt'): continue
        lid = None; src = ''; n = 0
        for raw in open(os.path.join(d, fn), encoding='utf-8').read().split('\n'):
            ln = raw.strip()
            if not ln or ln.startswith('//'): continue
            if ln.startswith('#'):
                lid = int(ln[1:].split()[0]); src = ''
                if str(lid) not in G: raise SystemExit('bio_bank/%s: درس غير موجود #%d' % (fn, lid))
                continue
            if lid is None: raise SystemExit('bio_bank/%s: سطر قبل رقم الدرس: %s' % (fn, ln))
            k, _, v = ln.partition(':'); v = v.strip()
            hi = G[str(lid)] in ('الحادي عشر', 'الثاني عشر') and str(lid) not in SSL
            LVL = {'ن': 'منخفضة', 'م': 'متوسطة', 'ر': 'مرتفعة'}
            def aod(h, mk=1, long=False):
                # h = رمز الهدف (ع/ط/س) ثم حرف مستوى الصعوبة اختياريًا (ن/م/ر).
                # الصفان 11-12: المستوى مستقل عن الهدف ويُحدَّد لكل مفردة بأعلى عملية معرفية تتطلبها
                # (وثيقة تقويم تعلم الطلبة في مواد العلوم 11-12، إصدار 2026/2027، ص 10-11).
                c = h[0]
                if c in _EN_AO:  # اللغة الإنجليزية 11–12: عناصر اللغة (SAH 11-12، ص 9) بدل أهداف التقويم
                    dif = LVL[h[1]] if len(h) > 1 and h[1] in LVL else 'متوسطة'
                    return _EN_AO[c], dif
                ao, dif = _AO[c]
                if len(h) > 1 and h[1] in LVL: dif = LVL[h[1]]
                return (('AO1' if c == 'ع' else 'AO2') if hi else ao), dif
            def marks(h, d):
                h = h[2:] if len(h) > 1 and h[1] in LVL else h[1:]
                return int(h or d)
            nl = lambda x: x.replace(' // ', '\n').strip()
            if k == 's': src = v; continue
            if k == 'n': items[-1]['notes'] = v; continue
            if k == 'T':
                rows = [[c.strip() for c in r.split('^')] for r in v.split(';;')]
                items[-1]['table'] = {'caption': rows[0][0], 'rows': rows[1:]}; continue
            n += 1; qid = 'b%d_%d' % (lid, n)
            if k == 'm':
                p = [x.strip() for x in v.split('|')]
                ao, dif = aod(p[0]); ch = [x for x in p[2:] if x]
                if len(ch) < 3 or len(set(ch)) != len(ch): raise SystemExit('bio_bank/%s #%d: خيارات ناقصة/مكررة: %s' % (fn, lid, v))
                h = int(hashlib.md5(p[1].encode('utf-8')).hexdigest(), 16)
                order = sorted(range(len(ch)), key=lambda i: (h >> (i * 7)) % 997)
                chs = [ch[i] for i in order]
                items.append({'lesson_id': lid, 'type': 'mcq', 'stem': nl(p[1]), 'choices': chs, 'correct': chs.index(ch[0]), 'answer': ch[0],
                              'marks': 1, 'ao': ao, 'difficulty': dif, 'outcome': '', 'notes': '', 'qid': qid, 'src': src})
            elif k in ('w', 'l'):
                head, _, rest = v.partition('|'); q, _, a = rest.partition('=>')
                if not a.strip(): raise SystemExit('bio_bank/%s #%d: سؤال بلا إجابة: %s' % (fn, lid, v))
                mk = marks(head, 2 if k == 'w' else (4 if hi else 3)); ao, dif = aod(head, mk, k == 'l')
                items.append({'lesson_id': lid, 'type': 'short' if k == 'w' else 'long', 'stem': nl(q), 'answer': '\n'.join(x.strip() for x in a.split(';;') if x.strip()),
                              'marks': mk, 'ao': ao, 'difficulty': dif, 'outcome': '', 'notes': 'تُقبل أي إجابة تؤدي المعنى نفسه.', 'qid': qid, 'src': src})
            else: raise SystemExit('bio_bank/%s #%d: مفتاح غير معروف: %s' % (fn, lid, ln))
    return items
_BIO_Q = _bio_bank()
qbank = qbank + _untat(_BIO_Q)
# أسئلة الاختبارات النهائية (بصورتها الأصلية) تدخل بنك الاختبارات القصيرة للعلوم، بأهداف تقويم مطابقة للوثيقة
def fin_items():
    p = os.path.join(DATA, 'finals.json')
    if not os.path.exists(p): return []
    F = json.load(open(p, encoding='utf-8'))
    GN = {'الخامس': 5, 'السادس': 6, 'السابع': 7, 'الثامن': 8, 'التاسع': 9, 'العاشر': 10, 'الحادي عشر': 11, 'الثاني عشر': 12}
    LO = {'AO1': 'معرفة', 'AO2': 'تطبيق', 'AO3': 'استدلال', 'معرفة': 'معرفة', 'تطبيق': 'تطبيق', 'استدلال': 'استدلال'}
    HI = {'AO1': 'AO1', 'AO2': 'AO2', 'AO3': 'AO2', 'معرفة': 'AO1', 'تطبيق': 'AO2', 'استدلال': 'AO2'}
    out = []
    for key, G in F.items():
        subj, grade = key.split('|')
        if subj in ('تقنية المعلومات', 'اللغة الإنجليزية'): continue
        ss = 'اجتماع' in subj  # الدراسات الاجتماعية: مستويات ثلاثة لكل الصفوف، ومقالية حتى 5 درجات
        g = GN.get(grade, 0); hi = g >= 11 and not ss
        smax = 5 if ss else (3 if hi else 2); lrange = (4, 5) if hi else ((3, 4) if g >= 9 else ())
        for q in G['q']:
            ao = (HI if hi else LO).get(str(q.get('ao') or '').strip())
            m = q.get('m')
            if not ao or not q.get('l') or not isinstance(m, (int, float)) or m != int(m): continue
            m = int(m); t = q.get('t')
            if t == 'mcq':
                if m != 1: continue
                typ = 'mcq'
            elif m <= smax: typ = 'short'
            elif lrange and m in lrange and ao not in ('معرفة', 'AO1'): typ = 'long'
            else: continue
            pa = G['papers'].get(q['p'], {})
            out.append({'qid': 'f' + q['id'], 'lesson_id': q['l'], 'type': typ, 'stem': q.get('x', ''), 'img': q['im'], 'iw': q.get('w'), 'ih': q.get('h'),
                        'src': 'امتحان الوزارة ' + str(pa.get('year', '')) + (' - ' + pa['session'] if pa.get('session') else ''),
                        'answer': q.get('a', ''), 'choices': [], 'marks': m, 'ao': ao, 'difficulty': '', 'outcome': q.get('c', ''), 'notes': ''})
    return out
try:
    sha = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=HERE, capture_output=True, text=True).stdout.strip()
except Exception:
    sha = ''
BUILD = {'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), 'sha': sha}
for l in lessons:
    l.setdefault('ai_filled', [])
rd = lambda f: open(os.path.join(HERE, f), encoding='utf-8').read()
common = rd('common.js')
TOOL_VER = re.search(r'@version\s+(\S+)', rd('tahdir-noor.user.js')).group(1)
_tv = re.search(r"const VERSION = '([^']+)'", rd('tahdir-noor.user.js')).group(1)
assert _tv == TOOL_VER, f'أداة نور: VERSION ({_tv}) لا يطابق @version ({TOOL_VER})'
TOOL_FORCE = re.search(r"MIN_REQUIRED = '([^']+)'", rd('tahdir-noor.user.js')).group(1)
common = common.replace('__TOOLVER__', TOOL_VER).replace('__TOOLFORCE__', TOOL_FORCE)
# إعلان المعلمين (site/data/announcements.json) يُدمج داخل common.js لأنه كود صفحة،
# لا داخل worker_src.js — والاستبدال يجب أن يقع قبل تجميع الصفحات (pack).
_ann_p = os.path.join(DATA, 'announcements.json')
_ann = json.load(open(_ann_p, encoding='utf-8')) if os.path.exists(_ann_p) else {}
common = common.replace('__ANNOUNCE__', json.dumps(_ann, ensure_ascii=False, separators=(',', ':')))

extra_css = '''
/* ---------- هوية خبير: بانر فاتح وألوان متناسقة ---------- */
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.kb-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:1200px;margin:0 auto;padding:10px 16px;box-sizing:border-box}
.kb-banner img{height:clamp(44px,8vw,78px);width:auto;display:block}
.kb-banner.kb-solo{justify-content:center}
.kb-mid{display:flex;align-items:center;gap:12px;min-width:0}
.kb-mark .kb-logo{width:clamp(62px,10vw,104px);height:auto;display:block}
.kb-name{display:flex;flex-direction:column;align-items:center;line-height:1.1}
.kb-name b{font-family:var(--f-display);font-weight:700;font-size:clamp(1.6rem,4.6vw,2.7rem);color:#2e2775}
.kb-name span{font-size:clamp(.78rem,1.8vw,1rem);font-weight:700;color:#e8890c;margin-top:4px}
.top{color:#1e1a4d!important;background:#fff!important;border-bottom:3px solid #e8890c!important}
.top .helix{display:none}
.top .top-in{border-top:1px solid #e4e7f2;padding-block:10px 12px}
.top .by{color:#625e8a}
.top .stat{background:#f6f5fc;border-color:#e1def3;color:#2e2775}
.top .btn.ghost{background:#f6f5fc;border-color:#cfd5ea;color:#2e2775}
.top .btn.ghost:hover{background:#eceafb;border-color:#4b40a9}
.whobar .btn[aria-current]{background:#eceafb!important;border-color:#4b40a9!important;color:#2e2775}
.top .menu-btn{background:#2e2775;color:#fff;border-color:#2e2775}
.top .menu-btn:hover{background:#4b40a9}
.top .btn.pulse{color:#2e2775}
.auth{color:#1e1a4d!important;background:radial-gradient(900px 500px at 85% -10%,rgba(217,119,6,.18),transparent 60%),#f6f5fc!important}
.auth{grid-template-rows:auto 1fr}
.kb-band{grid-column:1/-1;background:#fff;border-bottom:3px solid #e8890c}
.auth-brand h1{display:none}
.auth-brand .logo{width:auto;height:auto;background:none!important;border:0!important;margin-bottom:6px}
.auth-brand .logo .kb-logo{width:150px;height:auto}
.auth-brand h1{color:#2e2775}
.auth-brand .school{border-color:#e8890c;background:#fff;color:#2e2775}
.auth-facts span{background:#fff;border-color:#e1def3;color:#2e2775}
.auth-card{box-shadow:0 20px 60px rgba(46,39,117,.14)}
@media (max-width:860px){.auth-brand .logo .kb-logo{width:96px}}
@media (max-width:520px){.kb-banner{padding:8px 10px;gap:6px}.kb-mid{gap:6px}}
@media print{.kb-banner{display:none}}
.whobar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.who{font-size:.86rem;opacity:.95;padding-inline-end:4px}
.ltr{direction:ltr;unicode-bidi:isolate}
.m-text.ltr{direction:ltr;text-align:left}
.modal-box h4{margin:16px 0 6px;font-size:.92rem;color:var(--main-d)}

/* ---------- lesson tabs ---------- */
.ltabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin:4px 0 14px}
.ltab{font:inherit;font-weight:700;font-size:.92rem;background:transparent;border:0;border-bottom:3px solid transparent;padding:8px 14px;color:var(--mute);cursor:pointer}
.ltab.on{color:var(--main-d);border-bottom-color:var(--main)}
.hw-mark{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:.88rem}
.hw-mark input{width:90px;font:inherit;padding:6px 10px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--ink);text-align:center}


/* ---------- get the app (highlighted) ---------- */
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(147,165,245,.55),0 10px 30px rgba(0,0,0,.18)}50%{box-shadow:0 0 0 7px rgba(118,214,160,0),0 10px 30px rgba(0,0,0,.18)}}
.get-app{width:min(420px,100%);border-radius:20px;padding:16px 18px;background:linear-gradient(135deg,#fff1d6,#f6f5fc);color:#1e1a4d;border:2px solid #4b40a9;animation:glow 2.2s ease-in-out infinite}
.get-app h3{margin:0 0 2px;font-size:1.05rem;display:flex;align-items:center;gap:8px}
.get-app p{margin:0 0 10px;font-size:.84rem;color:#625e8a}
.get-app .ga-btns{display:flex;flex-wrap:wrap;gap:8px}
.get-app .ga-btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-weight:700;font-size:.88rem;padding:9px 14px;border-radius:12px;border:0;cursor:pointer;text-decoration:none;background:#4b40a9;color:#fff}
.get-app .ga-btn.alt{background:#fff;color:#4b40a9;border:1.5px solid #4b40a9}
.get-app details{margin-top:8px;font-size:.84rem}
.get-app summary{cursor:pointer;font-weight:700;color:#4b40a9}
.get-app ol{margin:6px 0 0;padding-inline-start:1.2em;line-height:1.9}
.auth-panel{gap:16px;align-content:center}
.app-bar{margin:14px auto 0;max-width:var(--maxw,1200px);padding:0 16px}
.app-bar .get-app{width:auto;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.app-bar .get-app p{margin:0}
.btn.pulse{animation:glow 2.2s ease-in-out infinite;border-color:#93a5f5!important;color:#fff}
@media (prefers-reduced-motion:reduce){.get-app,.btn.pulse{animation:none}}

/* ---------- login ---------- */
.auth{min-height:100vh;min-height:100dvh;display:grid;grid-template-columns:1.1fr 1fr;color:#fff;
  background:radial-gradient(1200px 600px at 85% -10%,rgba(109,40,217,.30),transparent 60%),linear-gradient(150deg,#0d1230 0%,#2e2775 45%,#4b40a9 100%)}
.auth-art{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:48px clamp(24px,5vw,72px);gap:18px}
.auth-art .big-helix{position:absolute;inset-inline-start:-6%;top:-10%;height:120%;width:auto;opacity:.5;pointer-events:none}
.big-helix path{fill:none;stroke:#d3ceff;stroke-width:3;stroke-linecap:round}
.big-helix .s2{stroke:#ffb547}
.big-helix .rg circle{fill:#d3ceff}.big-helix .rg .st{fill:#ffb547;stroke:none}
.auth-brand{position:relative;max-width:30rem}
.auth-brand .logo{width:60px;height:60px;border-radius:18px;margin-bottom:16px}
.auth-brand h1{font-family:var(--f-display);font-size:clamp(2.4rem,6vw,4rem);line-height:1.05;margin:0;font-weight:700}
.auth-brand p{margin:12px 0 0;font-size:1.02rem;opacity:.9;line-height:1.8}
.auth-brand .school{display:inline-block;margin-top:14px;padding:5px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);font-size:.86rem}
.auth-facts{position:relative;display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.auth-facts span{font-size:.8rem;padding:4px 12px;border-radius:999px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.14)}
.auth-panel{display:grid;place-items:center;padding:32px 16px}
.auth-card{width:min(420px,100%);background:var(--paper);color:var(--ink);border-radius:24px;padding:30px 26px 26px;box-shadow:0 30px 80px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.4)}
.auth-card h2{font-family:var(--f-display);font-weight:600;font-size:1.6rem;margin:0 0 4px}
.auth-card .lead{margin:0 0 20px;color:var(--mute);font-size:.9rem}
.fld{display:grid;gap:6px;margin-bottom:14px}
.fld label{font-size:.85rem;font-weight:600}
.fld input{font:inherit;font-size:1rem;padding:11px 14px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);width:100%}
.fld input:focus{outline:none;border-color:var(--main);box-shadow:0 0 0 4px color-mix(in srgb,var(--main) 18%,transparent)}
.pw{position:relative}
.pw input{padding-inline-end:76px}
.pw button{position:absolute;inset-inline-end:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--main-d);font:inherit;font-size:.8rem;cursor:pointer;padding:4px 8px}
.go{width:100%;justify-content:center;padding:12px;font-size:1rem;border-radius:12px;margin-top:4px}
.err{background:color-mix(in srgb,var(--danger) 12%,var(--paper));color:var(--danger);border-radius:10px;padding:9px 12px;font-size:.86rem;margin-bottom:12px;border:1px solid color-mix(in srgb,var(--danger) 35%,transparent)}
.auth-foot{margin-top:16px;font-size:.78rem;color:var(--mute);text-align:center}
.shake{animation:shake .35s}
@keyframes shake{20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
@media (prefers-reduced-motion:no-preference){
  .big-helix path{stroke-dasharray:2400;stroke-dashoffset:2400;animation:draw 2.2s cubic-bezier(.6,.1,.2,1) forwards}
  .big-helix .s2{animation-delay:.25s}
  .big-helix .rg{opacity:0;animation:fadeIn .8s 1.3s forwards}
  .auth-brand>*,.auth-facts{opacity:0;transform:translateY(14px);animation:rise .7s cubic-bezier(.2,.7,.2,1) forwards}
  .auth-brand>*:nth-child(1){animation-delay:.15s}.auth-brand>*:nth-child(2){animation-delay:.3s}.auth-brand>*:nth-child(3){animation-delay:.42s}.auth-brand>*:nth-child(4){animation-delay:.54s}
  .auth-facts{animation-delay:.7s}
  .auth-card{opacity:0;transform:translateY(24px) scale(.98);animation:rise .8s .45s cubic-bezier(.2,.7,.2,1) forwards}
  body.leaving .auth{transition:opacity .4s;opacity:0}
}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes fadeIn{to{opacity:.55}}
@keyframes rise{to{opacity:1;transform:none}}
@media (max-width:860px){
  .auth{grid-template-columns:1fr}
  .auth-art{padding:36px 20px 8px;min-height:auto}
  .auth-art .big-helix{inset-inline-start:auto;inset-inline-end:-20%;height:150%;opacity:.28}
  .auth-brand p{font-size:.95rem}
  .auth-panel{padding:18px 16px 36px;align-items:start}
}

/* ---------- admin ---------- */
.dash{padding-block:22px 60px;display:grid;gap:18px}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.kpi{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:2px;box-shadow:var(--shadow)}
.kpi-n{font-family:var(--f-display);font-size:2rem;font-weight:700;color:var(--main-d);font-variant-numeric:tabular-nums;line-height:1.1}
.kpi-l{font-size:.82rem;color:var(--mute)}
.kpi.warn .kpi-n{color:var(--danger)}
.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line)}
.tab{font:inherit;font-weight:600;font-size:.92rem;background:transparent;border:0;border-bottom:3px solid transparent;padding:8px 14px;color:var(--mute);cursor:pointer}
.tab.on{color:var(--main-d);border-bottom-color:var(--main)}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.toolbar input{flex:1 1 220px;min-width:0;font:inherit;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink)}
.t-wrap{overflow-x:auto;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}
.tbl{width:100%;border-collapse:collapse;font-size:.88rem;min-width:820px}
.tbl th{text-align:right;font-weight:700;font-size:.78rem;color:var(--mute);padding:10px 12px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--main-l) 50%,var(--paper))}
.tbl td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.tbl tr:last-child td{border-bottom:0}
.num{font-variant-numeric:tabular-nums;font-weight:700}
.sub{font-size:.76rem;color:var(--mute);font-weight:400}
.link-btn{background:none;border:0;padding:0;font:inherit;color:var(--ink);cursor:pointer;text-align:right}
.link-btn:hover b{color:var(--main-d);text-decoration:underline}
.pill{display:inline-block;font-size:.7rem;font-weight:700;padding:1px 9px;border-radius:999px;vertical-align:middle}
.pill.off{background:color-mix(in srgb,var(--danger) 14%,var(--paper));color:var(--danger)}
.pill.adm{background:var(--main-l);color:var(--main-d)}
.pill.warn{background:color-mix(in srgb,var(--danger) 14%,var(--paper));color:var(--danger)}
.chip-s{display:inline-block;font-size:.74rem;padding:1px 8px;margin:1px;border-radius:999px;background:var(--main-l);color:var(--main-d)}
/* الصلاحيات بالمواد: رقاقة المادة وعدد صفوفها، ونافذة اختيار (مادة ثم صفوفها) */
.chip-s .sc-n{display:inline-block;margin-inline-start:5px;font-size:.7rem;font-weight:700;opacity:.75}
.chip-s .sc-g{margin-inline-start:5px;opacity:.8}
.sc-cell{max-width:280px}
.sc-cell .chip-s{display:inline-flex;align-items:center;gap:2px;margin:2px 2px}
/* قوائم منسدلة للمواد: كل مادة سطر يُفتح بضغطة ليُظهر صفوفها */
.sc-accordion{display:flex;flex-direction:column;gap:6px;margin:10px 0;max-height:58vh;overflow:auto;padding-inline-end:3px}
.sc-acc{border:1px solid var(--line);border-radius:11px;background:var(--paper);overflow:hidden;flex:0 0 auto}
.sc-acc[open]{border-color:var(--main);box-shadow:0 2px 10px rgba(6,60,45,.07)}
.sc-acc summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;cursor:pointer;font-size:.9rem;font-weight:700;color:var(--ink);list-style:none;background:transparent}
.sc-acc summary::-webkit-details-marker{display:none}
.sc-acc summary:before{content:'▾';font-size:.72rem;color:var(--mute);margin-inline-end:7px;transition:transform .15s;order:-1}
.sc-acc[open] summary:before{transform:rotate(180deg)}
.sc-acc[open] summary{background:var(--main-l);border-bottom:1px solid var(--line)}
.sc-e{font-style:normal;font-size:.75rem;color:var(--mute);white-space:nowrap;margin-inline-start:auto}
.sc-e.full{color:var(--main-d);font-weight:700}
.sc-e.part{color:#a76a00;font-weight:700}
.sc-in{padding:9px 12px 11px}
.sc-all{display:flex;align-items:center;gap:7px;font-size:.83rem;font-weight:700;color:var(--main-d);padding:5px 6px;border-radius:8px;cursor:pointer;margin-bottom:5px;background:var(--main-l)}
.sc-glist{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:5px}
.sc-gi{display:flex;align-items:center;gap:6px;font-size:.85rem;padding:5px 7px;border:1px solid transparent;border-radius:8px;cursor:pointer}
.sc-gi:hover{background:var(--main-l);border-color:var(--line)}
.sc-foot{margin-top:6px;font-size:.82rem;color:var(--mute)}
.sc-full{list-style:none;margin:0 0 4px;padding:0}
.sc-full li{padding:7px 0;border-bottom:1px dashed var(--line)}
.sc-full li:last-child{border-bottom:0}
.sc-g2{margin-top:5px;display:flex;flex-wrap:wrap;gap:2px}
.pill.ok{background:var(--main-l);color:var(--main-d)}
/* دليل الاستخدام: طبقة تعتيم + بقعة مضيئة على العنصر + فقاعة بسهم */
.tour-ov{position:fixed;inset:0;z-index:9000;background:rgba(8,26,22,.62);backdrop-filter:blur(1.5px)}
.tour-spot{position:fixed;border-radius:12px;box-shadow:0 0 0 9999px rgba(8,26,22,.62),0 0 0 2px #4b40a9,0 0 22px 6px rgba(54,179,126,.55);background:transparent;pointer-events:none;transition:left .18s ease,top .18s ease,width .18s ease,height .18s ease}
.tour-ov:has(.tour-spot:not([hidden])){background:transparent;backdrop-filter:none}
.tour-tip{position:fixed;z-index:9001;width:min(330px,calc(100vw - 24px));background:var(--paper,#fff);color:var(--ink,#163);border:1px solid var(--line,#d9e5df);border-radius:14px;box-shadow:0 18px 44px rgba(6,30,24,.34);padding:13px 15px;transition:left .18s ease,top .18s ease}
.tour-tip.center{left:50%!important;top:50%!important;transform:translate(-50%,-50%);width:min(400px,calc(100vw - 28px))}
.tour-tip:after{content:'';position:absolute;width:0;height:0;border:10px solid transparent}
.tour-tip.down:after{border-bottom-color:var(--paper,#fff);top:-20px;inset-inline-start:var(--ax,24px)}
.tour-tip.up:after{border-top-color:var(--paper,#fff);bottom:-20px;inset-inline-start:var(--ax,24px)}
.tour-h{font-weight:800;font-size:1rem;margin-bottom:5px;color:var(--main-d,#2e2775)}
.tour-b{font-size:.86rem;line-height:1.85;color:var(--mute,#4a5a55)}
.tour-f{display:flex;align-items:center;gap:6px;margin-top:11px;flex-wrap:wrap}
.tour-n{font-size:.76rem;color:var(--mute,#4a5a55);margin-inline-end:auto}
@keyframes tourPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.tour-tip .btn.primary.small{animation:tourPulse 1.6s ease-in-out infinite}
@media(prefers-reduced-motion:reduce){.tour-tip,.tour-spot{transition:none}.tour-tip .btn.primary.small{animation:none}}
@media(max-width:640px){.sc-glist{grid-template-columns:1fr 1fr}.sc-accordion{max-height:50vh}}
/* «الصفوف المستخدمة»: تفاصيل تُفتح بدل صفّ رقاقات يمدّ الجدول */
.sc-used-cell{white-space:nowrap}
.sc-used summary{cursor:pointer;font-size:.82rem;color:var(--main-d);font-weight:700;list-style:none;display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border:1px solid var(--line);border-radius:999px;background:var(--main-l)}
.sc-used summary::-webkit-details-marker{display:none}
.sc-used summary:before{content:'▾';font-size:.7rem;transition:transform .15s}
.sc-used[open] summary:before{transform:rotate(180deg)}
.sc-used-in{margin-top:5px;display:flex;flex-wrap:wrap;gap:2px;max-width:230px}
.empty-state{background:var(--paper);border:1px dashed var(--line);border-radius:16px;padding:28px;text-align:center;color:var(--mute)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:var(--shadow);min-width:0}
.card h3{margin:0 0 6px;font-size:1rem}
.feed{list-style:none;margin:0;padding:0;max-height:560px;overflow:auto;font-size:.84rem}
.feed li{padding:7px 0;border-bottom:1px solid var(--line);line-height:1.6}
.feed li.bad{background:color-mix(in srgb,var(--danger) 9%,transparent);border-radius:8px;padding-inline:8px}
.ev-t{display:inline-block;min-width:8.5em;color:var(--mute);font-size:.76rem;font-variant-numeric:tabular-nums}
.dev{font-size:.72rem;color:var(--mute);border:1px solid var(--line);border-radius:999px;padding:0 7px}
.t-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0 4px}
.t-stats div{background:var(--main-l);border-radius:12px;padding:8px;text-align:center;display:flex;flex-direction:column}
.t-stats b{font-size:1.3rem;color:var(--main-d);font-variant-numeric:tabular-nums}
.t-stats span{font-size:.74rem;color:var(--mute)}
.alert{margin-top:10px;background:color-mix(in srgb,var(--danger) 12%,var(--paper));color:var(--danger);border-radius:10px;padding:8px 12px;font-size:.84rem}
.devs,.toplist{list-style:none;margin:0;padding:0;font-size:.86rem}
.devs li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
.toplist li{padding:4px 0}
.acts{display:flex;flex-wrap:wrap;gap:6px}
@media (max-width:900px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.two{grid-template-columns:1fr}.t-stats{grid-template-columns:repeat(2,1fr)}}

/* ---------- admin report ---------- */
.seg-r{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.bars{display:flex;align-items:flex-end;gap:3px;height:120px;padding:6px 0;border-bottom:1px solid var(--line);direction:ltr}
.bar{flex:1;height:100%;display:flex;align-items:flex-end}
.bar span{display:block;width:100%;background:var(--main);border-radius:3px 3px 0 0;min-height:3px}
.bar:hover span{background:var(--accent)}

/* ---------- games ---------- */
.btn.games-link{background:#e9e1ff;border-color:#b9a4f5;color:#3a2f96;font-weight:700}
.btn.games-link:hover{background:#ddd0ff}
.g-home{display:grid;gap:14px}
.g-intro{background:linear-gradient(120deg,#2b1166,#5b2bb8 55%,#0c7a63);color:#fff;border-radius:20px;padding:18px 20px;box-shadow:var(--shadow)}
.g-intro h2{margin:0 0 4px;font-family:var(--f-display);font-size:1.5rem}
.g-intro p{margin:0;opacity:.92;font-size:.92rem}
.g-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.g-card{display:flex;flex-direction:column;gap:6px;text-align:right;font:inherit;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:14px;cursor:pointer;box-shadow:var(--shadow);transition:transform .15s,border-color .15s}
.g-card:hover{transform:translateY(-2px);border-color:var(--main)}
.g-card.off{opacity:.55}
.g-ic{font-size:2rem;line-height:1}
.g-card b{font-size:1.02rem}
.g-desc{font-size:.82rem;color:var(--mute);line-height:1.6;flex:1}
.g-tags{display:flex;flex-wrap:wrap;gap:4px}
.tag{font-size:.7rem;font-weight:700;border-radius:999px;padding:1px 9px;background:var(--main-l);color:var(--main-d)}
.tag.good{background:#e1f7e7;color:#13723a}
.tag.warn{background:var(--accent-l);color:var(--accent)}
.teams-ed{display:grid;gap:6px}
.team-row{display:flex;align-items:center;gap:6px}
.team-row input{flex:1;min-width:0;font:inherit;font-size:.86rem;padding:5px 9px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
.team-row .x{border:0;background:transparent;color:var(--danger);font-size:1.1rem;cursor:pointer}
.tdot{width:12px;height:12px;border-radius:50%;flex:0 0 12px}
.lp-uh label{display:flex;gap:6px;align-items:center;cursor:pointer}
.g-stage{background:var(--paper);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);overflow:auto;min-height:70vh;display:flex;flex-direction:column}
.g-stage:fullscreen{border-radius:0;padding:10px 20px;font-size:1.25rem}
.g-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line)}
.g-title{flex:1;text-align:center;font-family:var(--f-display);font-size:1.1rem}
.g-score{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:8px 10px 0}
.g-score:empty{display:none}
.sc{display:flex;align-items:center;gap:8px;border-radius:14px;padding:6px 12px;background:color-mix(in srgb,var(--tc) 14%,var(--paper));border:2px solid var(--tc)}
.sc-n{font-weight:700}
.sc-v{font-family:var(--f-display);font-size:1.4rem;font-weight:700;color:var(--tc);min-width:2ch;text-align:center;font-variant-numeric:tabular-nums}
.sc-b{display:flex;gap:4px}
.sc-b button{font:inherit;font-weight:700;border:0;border-radius:8px;padding:4px 8px;cursor:pointer;background:var(--tc);color:#fff}
.sc-b button+button{background:#888}
.gm-body{padding:16px;flex:1}
.g-setup{max-width:460px;margin:20px auto;display:grid;gap:10px}
.g-setup input,.wh-left input{width:90px;font:inherit;padding:6px 10px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--ink);text-align:center}
.btn.big{font-size:1.1rem;padding:12px 26px;justify-content:center}
.g-stem{font-size:clamp(1.1rem,2.2vw,1.6rem);font-weight:700;line-height:1.7;margin:6px 0 12px;text-align:start}
.g-table{border-collapse:collapse;margin:6px auto 12px;font-size:.95em}
.g-table th,.g-table td{border:1px solid var(--line);padding:5px 12px;text-align:center}
.g-table th{background:var(--main-l)}
.g-table caption{font-weight:700;padding:3px}
.lv-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.lv-n,.jp-v{font-weight:700;color:var(--mute)}
.lv-ans{font-weight:700;color:var(--main-d)}
.g-timer{position:relative;width:62px;height:62px}
.g-timer svg{width:100%;height:100%;transform:rotate(-90deg)}
.tr-bg{fill:none;stroke:var(--line);stroke-width:3.5}
.tr-fg{fill:none;stroke:var(--main);stroke-width:3.5;stroke-linecap:round;transition:stroke-dasharray .2s linear}
.g-timer span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-display);font-size:1.3rem;font-weight:700}
.lv-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}
.lv-opt{display:flex;align-items:center;gap:10px;font:inherit;font-size:clamp(1rem,1.8vw,1.3rem);font-weight:700;color:#fff;text-align:start;border:0;border-radius:14px;padding:14px 16px;min-height:64px;position:relative;cursor:default}
button.lv-opt{cursor:pointer}
.lv-opt .sh{font-size:1.3em;opacity:.9}
.o0{background:#e21b3c}.o1{background:#1368ce}.o2{background:#c78a00}.o3{background:#26890c}
.lv-opt.right{outline:5px solid #fff;box-shadow:0 0 0 9px #26b04a}
.lv-opts.rev .lv-opt.wrong,.lv-opt.gone{opacity:.35}
.lv-opt.pick{outline:4px dashed #fff}
.lv-opt.wrongpick{filter:grayscale(.6);outline:5px solid #222}
.lv-bar{position:absolute;inset-inline:12px;bottom:6px;height:8px;background:rgba(255,255,255,.3);border-radius:6px;display:flex;align-items:center}
.lv-bar i{display:block;height:100%;background:#fff;border-radius:6px}
.lv-bar em{position:absolute;inset-inline-end:-2px;bottom:10px;font-style:normal;font-size:.8rem}
.lv-lobby{display:grid;gap:16px;justify-items:center;text-align:center}
.lv-join{display:flex;gap:24px;align-items:center;flex-wrap:wrap;justify-content:center}
.lv-qr{background:#fff;padding:8px;border-radius:14px;box-shadow:var(--shadow)}
.lv-url{font-size:1.4rem;font-weight:700;color:var(--main-d);margin:0}
.lv-code{font-family:var(--f-display);font-size:clamp(2.6rem,7vw,4.5rem);font-weight:700;letter-spacing:6px;margin:0;color:#3a2f96}
.lv-players .chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:6px;max-width:900px}
.lv-lead{max-width:520px;margin:10px auto;display:grid;gap:4px}
.lv-lead.full{max-height:40vh;overflow:auto}
.lr{display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center;background:var(--bg);border-radius:10px;padding:6px 12px}
.lr span:first-child{font-weight:700;color:var(--mute)}
.podium{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin:10px 0 16px}
.pd{display:flex;flex-direction:column;align-items:center;gap:4px;width:150px}
.pd-n{font-weight:700;font-size:1.1rem}
.pd-s{color:var(--mute)}
.pd-b{width:100%;border-radius:12px 12px 0 0;color:#fff;font-family:var(--f-display);font-size:2rem;display:grid;place-items:center}
.p0 .pd-b{height:150px;background:#d4a017}.p1 .pd-b{height:110px;background:#9aa4ad}.p2 .pd-b{height:80px;background:#b0703c}
.jp{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:8px}
.jp-h{background:#3a2f96;color:#fff;border-radius:12px;padding:10px 8px;text-align:center;font-weight:700;font-size:.92rem;display:grid;place-items:center;min-height:64px}
.jp-t{font:inherit;font-family:var(--f-display);font-size:clamp(1.4rem,3vw,2.2rem);font-weight:700;color:#ffd84d;background:#1d3fa0;border:0;border-radius:12px;min-height:76px;cursor:pointer;box-shadow:inset 0 -4px 0 rgba(0,0,0,.25)}
.jp-t:hover{background:#2850c4}
.jp-t.done{background:var(--bg);box-shadow:none;cursor:default}
.jp-q{max-width:980px;margin:0 auto}
.jp-ans{background:#e1f7e7;color:#0f4d2a;border-radius:12px;padding:10px 14px;margin:10px 0;font-size:1.05rem}
.jp-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.g-win{text-align:center;font-size:3rem;padding:30px 10px}
.g-win h2{font-family:var(--f-display);font-size:1.8rem;margin:6px 0}
.g-win p{font-size:1.1rem}
.g-win.small{font-size:1.2rem;padding:10px;display:flex;gap:12px;justify-content:center;align-items:center;background:var(--accent-l);border-radius:14px;margin-bottom:10px}
.mil{display:grid;grid-template-columns:1fr 180px;gap:16px}
.ladder{list-style:none;margin:0;padding:0;display:grid;gap:3px;align-content:start}
.ladder li{padding:5px 12px;border-radius:8px;font-weight:700;color:var(--mute);background:var(--bg);font-variant-numeric:tabular-nums}
.ladder li.safe{color:#b07800}
.ladder li.won{color:#26890c}
.ladder li.on{background:#d89e00;color:#fff}
.life{display:flex;gap:8px;flex-wrap:wrap}
.esc-story{font-weight:700;color:var(--main-d);flex:1}
.locks{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0}
.lock{display:flex;flex-direction:column;align-items:center;gap:2px;font:inherit;background:#2a2f3a;color:#fff;border:0;border-radius:14px;padding:10px 16px;min-width:100px;cursor:pointer}
.lock.open{background:#26890c}
.lock .lk{font-size:2rem}
.lock .dg{font-family:var(--f-display);font-size:1.8rem}
.esc-final{text-align:center;margin-top:12px}
.esc-final input{font:inherit;font-size:2rem;letter-spacing:10px;width:220px;text-align:center;border-radius:12px;border:2px solid var(--line);background:var(--bg);color:var(--ink);padding:6px}
.g-hint{text-align:center;font-size:1.05rem}
.mem{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.mc{font:inherit;border:0;border-radius:14px;min-height:120px;cursor:pointer;background:#3a2f96;color:#fff;padding:10px;position:relative;font-size:.92rem;line-height:1.5}
.mc.a{background:#0c6b56}
.mc .mc-b{display:none}
.mc .mc-f{font-size:2rem}
.mc.up{background:#fff;color:var(--ink);border:2px solid #3a2f96}
.mc.up .mc-f{display:none}
.mc.up .mc-b{display:block}
.mc.done{border-color:var(--tc);background:color-mix(in srgb,var(--tc) 12%,#fff);opacity:.8}
.ws{display:grid;grid-template-columns:auto minmax(180px,1fr);gap:16px;align-items:start;justify-content:center}
.ws-grid{display:grid;grid-template-columns:repeat(var(--n),minmax(26px,42px));gap:3px}
.ws-c{font:inherit;font-weight:700;font-size:clamp(.95rem,1.8vw,1.35rem);aspect-ratio:1;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);cursor:pointer;padding:0}
.ws-c.s{background:#ffd84d;color:#000}
.ws-c.f{background:#26890c;color:#fff;border-color:#26890c}
.ws-list{display:flex;flex-wrap:wrap;gap:6px;align-content:start}
.ws-list b{width:100%}
.ws-list span.w{background:var(--main-l);border-radius:999px;padding:2px 10px;font-weight:700}
.ws-list span.w.got{text-decoration:line-through;opacity:.5}
.wh{display:grid;grid-template-columns:minmax(260px,380px) 1fr;gap:20px;align-items:start}
.wh-left{display:grid;gap:10px;justify-items:center}
.wh-wrap{position:relative;width:100%;max-width:360px}
.wh-svg{width:100%;height:auto;display:block}
.wh-ptr{position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:1.8rem;color:#1e1a4d}
.wh-who{font-size:1.4rem;margin-bottom:8px}
.wh-who b{font-family:var(--f-display);font-size:2rem;color:#3a2f96}
.fc-wrap{max-width:820px;margin:0 auto;display:grid;gap:10px}
.fc-n{text-align:center;color:var(--mute)}
.fc{font:inherit;color:var(--ink);text-align:start;min-height:260px;border-radius:20px;border:2px solid #3a2f96;background:var(--paper);padding:20px;cursor:pointer;box-shadow:var(--shadow)}
.fc .fc-back{display:none}
.fc.flip .fc-front{display:none}
.fc.flip .fc-back{display:block;font-size:1.2rem;line-height:1.8}
.fc.flip{background:#e1f7e7;border-color:#26890c;color:#0f4d2a}
.fc-ch{margin:0 0 8px;font-size:1.05rem}
.fc-act{display:flex;gap:10px;justify-content:center}
@media (max-width:900px){.mil,.wh,.ws{grid-template-columns:1fr}.lv-opts{grid-template-columns:1fr}.jp-t{min-height:56px}}

/* ---------- teen games ---------- */
.g-sec{margin:6px 0 -4px;font-size:1rem;color:#3a2f96;grid-column:1/-1}
.claim{font-size:clamp(1.2rem,2.4vw,1.8rem);font-weight:700;line-height:1.8;background:var(--bg);border-inline-start:6px solid #3a2f96;border-radius:12px;margin:10px 0 14px;padding:16px 20px}
.tp{display:grid;gap:8px;margin:10px 0}
.tp-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:2px solid var(--tc);border-radius:14px;padding:8px 12px;background:color-mix(in srgb,var(--tc) 8%,var(--paper))}
.tp-n{font-weight:700;min-width:110px;color:var(--tc)}
.tp-o,.tp-bet{display:flex;gap:6px;flex-wrap:wrap}
.tp-bet{margin-inline-start:auto;align-items:center;font-size:.85rem;color:var(--mute)}
.tp button{font:inherit;font-weight:700;border:2px solid var(--line);background:var(--paper);color:var(--ink);border-radius:10px;padding:6px 14px;cursor:pointer;min-width:52px}
.tp button.on{background:var(--tc);border-color:var(--tc);color:#fff}
.tp button.right{box-shadow:0 0 0 3px #26b04a}
.jp-ans.myth-x{background:#fde8e6;color:#7a1d12}
.seq-pool{display:grid;gap:8px;margin:10px 0}
.seq-c{display:flex;align-items:center;gap:10px;font:inherit;font-size:clamp(1rem,1.7vw,1.2rem);text-align:start;border:2px solid var(--line);background:var(--paper);color:var(--ink);border-radius:12px;padding:10px 14px;cursor:pointer;line-height:1.6}
.seq-c.on{border-color:#3a2f96;background:#efe9ff}
.seq-c.ok{border-color:#26890c;background:#e1f7e7}
.seq-c.no{border-color:#e21b3c;background:#fde8e6}
.seq-n{flex:0 0 30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#3a2f96;color:#fff;font-weight:700}
.case-pts{font-size:1.1rem}.case-pts b{color:#b07800;font-size:1.4rem}
.clues{display:grid;gap:6px;margin:8px 0}
.clue{background:#fff8e1;border-inline-start:5px solid #d89e00;border-radius:10px;padding:8px 12px;color:#4a3b00}
.lk-pair{display:flex;align-items:stretch;justify-content:center;gap:14px;flex-wrap:wrap;margin:24px 0 10px}
.lk-a{background:#3a2f96;color:#fff;border-radius:18px;padding:22px 26px;font-size:clamp(1.3rem,2.6vw,2rem);font-weight:700;min-width:220px;text-align:center;display:grid;place-items:center}
.lk-a.b{background:#0c6b56}
.lk-mid{font-size:2.4rem;display:grid;place-items:center;color:var(--mute)}

/* ---------- play (students' phones) ---------- */
.pl{min-height:100vh;min-height:100dvh;background:linear-gradient(160deg,#2b1166,#5b2bb8 60%,#0c7a63);padding:14px;display:flex;flex-direction:column;gap:12px}
.pl-card{background:#fff;color:#1e1a4d;border-radius:20px;padding:20px;max-width:460px;width:100%;margin:auto;display:grid;gap:12px;box-shadow:0 20px 50px rgba(0,0,0,.3)}
.pl-card.c{text-align:center}
.pl-card h1{margin:0;font-family:var(--f-display);font-size:1.5rem;text-align:center}
.pl-card h2{margin:0;font-family:var(--f-display)}
.pl-card label{display:grid;gap:4px;font-weight:700}
.pl-card input{font:inherit;font-size:1.3rem;padding:12px;border-radius:12px;border:2px solid #d4e5de;text-align:center}
.pl-go{font:inherit;font-size:1.2rem;font-weight:700;border:0;border-radius:14px;padding:14px;background:#26890c;color:#fff;cursor:pointer}
.pl-err{background:#fde8e6;color:#b23a2b;border-radius:10px;padding:8px;margin:0}
.pl-big{font-size:3.5rem;line-height:1}
.pl-card.ok{border:4px solid #26890c}.pl-card.bad{border:4px solid #e21b3c}
.pl-rank{font-size:1.3rem;font-weight:700;color:#3a2f96}
.pl-head{display:flex;justify-content:space-between;color:#fff;font-weight:700;background:rgba(0,0,0,.2);border-radius:12px;padding:8px 14px}
.pl-q{display:grid;gap:10px;color:#fff}
.pl-meta{text-align:center;opacity:.9}
.pl-stem{background:#fff;color:#1e1a4d;border-radius:14px;padding:12px 14px;font-weight:700;line-height:1.7}
.pl-q .g-table{background:#fff;color:#1e1a4d}
.pl-opts{display:grid;gap:10px}
.pl-o{display:flex;align-items:center;gap:10px;font:inherit;font-size:1.1rem;font-weight:700;color:#fff;border:0;border-radius:14px;padding:16px;min-height:70px;text-align:start;cursor:pointer}
.pl-o span{font-size:1.4rem}
.pl-o:disabled{opacity:.5}.pl-o.sel{opacity:1;outline:4px solid #fff}

/* ---------- subject switch ---------- */
.subj-pick{display:flex;align-items:center;gap:8px;margin:0 2px 12px;background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:6px 10px}
.subj-pick .subj-ic{font-size:1.35rem}
.subj-pick .subj-l{font-size:.78rem;color:var(--mute);font-weight:700}
.subj-pick select{flex:1;min-width:0;font:inherit;font-weight:700;font-size:.92rem;border:0;background:transparent;color:var(--ink);padding:4px 2px;cursor:pointer}
.subj-sw{display:flex;gap:4px;margin:0 2px 12px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:3px}
.subj-sw button{flex:1;font:inherit;font-size:.86rem;font-weight:700;border:0;border-radius:9px;padding:8px 6px;background:transparent;color:var(--mute);cursor:pointer}
.subj-sw button.on{background:var(--main);color:#fff}
.field[dir=auto]{text-align:start}

/* ---------- nav to assessment ---------- */
.btn.quiz-link{background:#fff4d6;border-color:#f2c66d;color:#5b3d00;font-weight:700}
.btn.quiz-link:hover{background:#ffe9ad}

/* ---------- assessment page ---------- */
.qlayout{display:grid;grid-template-columns:340px minmax(0,1fr);gap:22px;align-items:start;padding-block:22px 60px}
.qside{display:grid;gap:12px;position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto;padding-bottom:4px}
.qcard{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:12px 14px;box-shadow:var(--shadow)}
.qcard h3{margin:0 0 8px;font-size:.95rem;color:var(--main-d)}
.qsel,.hdr-f input,.hdr-f select,.ed input,.ed select,.ed textarea{width:100%;font:inherit;font-size:.88rem;padding:7px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
.ed textarea{resize:vertical;line-height:1.7}
.qsel.sm{width:auto;min-width:90px}
.cpick{display:flex;flex-wrap:wrap;gap:8px}.cp-l{flex:1 1 150px;display:flex;flex-direction:column;gap:3px;font-size:.8rem;color:var(--mute)}.cp-l[hidden]{display:none}.cp-l .qsel{width:100%;min-width:0;font-weight:600}.gr-row .cpick{flex:1 1 320px}
.qrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0;font-size:.88rem}
.small{font-size:.78rem}
.seg{display:flex;gap:4px;margin-top:10px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:3px}
.seg button{flex:1;font:inherit;font-size:.84rem;font-weight:700;border:0;border-radius:9px;padding:7px 6px;background:transparent;color:var(--mute);cursor:pointer}
.seg button.on{background:var(--main);color:#fff}
.seg.sm{margin:0 0 10px}
.lpick{max-height:46vh;overflow:auto;margin:0 -4px;padding:0 4px}
.lp-uh{font-size:.8rem;font-weight:700;color:var(--mute);margin:8px 0 2px}
.lp-l{display:flex;align-items:center;gap:8px;font-size:.86rem;padding:4px 6px;border-radius:8px;cursor:pointer;line-height:1.4}
.lp-l:hover{background:var(--main-l)}
.lp-l span:nth-child(2){flex:1}
.lp-l.dim{opacity:.5;cursor:default}
.lp-l input{accent-color:var(--main);width:17px;height:17px}
.go-btn{width:100%;justify-content:center;margin-top:8px;padding:10px}
.hdr-f{display:grid;gap:8px}
.hdr-f label{display:grid;gap:3px;font-size:.78rem;color:var(--mute)}
.saved{list-style:none;margin:0;padding:0;font-size:.85rem;max-height:240px;overflow:auto}
.saved li{display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--line)}
.saved li .link-btn{flex:1;min-width:0;text-align:right}
.saved .x{border:0;background:transparent;color:var(--danger);font-size:1.1rem;cursor:pointer;padding:0 4px}
.qwel{text-align:center}
.qbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:10px 14px;box-shadow:var(--shadow);margin-bottom:10px}
.qbar-t{flex:1 1 260px;min-width:0}
.title-in.sm{font-size:1.05rem;width:100%;margin:0}
.qbar-b{display:flex;gap:6px;flex-wrap:wrap}
.checks{border-radius:14px;padding:8px 14px;margin-bottom:10px;font-size:.84rem;border:1px solid}
.checks.ok{background:color-mix(in srgb,var(--main-l) 70%,var(--paper));border-color:color-mix(in srgb,var(--main) 35%,transparent)}
.checks.warn{background:var(--accent-l);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.checks ul{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 16px}
.checks li.n{color:var(--danger);font-weight:700}
.ptabs{display:flex;gap:6px;margin:4px 0 0}
.paper{color-scheme:light;background:#fff;color:#000;border-radius:4px;box-shadow:0 2px 14px rgba(0,0,0,.18);padding:28px 34px 36px;font-family:"Simplified Arabic","Traditional Arabic","IBM Plex Sans Arabic",Tahoma,serif;font-size:16px;line-height:1.75;-webkit-user-select:text;user-select:text;max-width:900px;margin:0 auto}
.paper .oval,#printArea .oval{display:inline-block;width:22px;height:13px;border:1.5px solid #555;border-radius:8px;vertical-align:middle}
.qi{position:relative;border-radius:8px}
.paper .qi:hover{outline:2px dashed #b9d8cf;outline-offset:6px}
.qctl{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;background:#f1f7f4;border-radius:8px;padding:3px 8px;margin:0 0 6px;font-family:var(--f-body);font-size:.74rem;color:#58726a}
.qctl .qbtns{display:flex;gap:4px;flex-wrap:wrap}
.qctl .btn.small{padding:2px 8px;font-size:.74rem;background:#fff;color:#1e1a4d}
.qctl .btn.danger{color:#b23a2b}
.modal-box.wide{width:min(760px,96vw);max-height:90vh;overflow:auto}
.ed{display:grid;gap:10px}
.ed label{display:grid;gap:3px;font-size:.8rem;color:var(--mute)}
.ed-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.ed-row .grow{grid-column:span 2}
.ed-ch{display:flex;align-items:center;gap:8px;margin:4px 0}
.ed-ch input[type=radio]{width:18px;height:18px;accent-color:var(--main)}
.picker{list-style:none;margin:0;padding:0;max-height:60vh;overflow:auto}
.pk{display:block;width:100%;text-align:right;font:inherit;font-size:.88rem;line-height:1.6;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:0 0 6px;cursor:pointer;color:var(--ink)}
.pk:hover{border-color:var(--main)}
.pk-m{display:block;font-size:.74rem;color:var(--mute)}
.parts{display:grid;gap:8px;margin:8px 0}
.parts label{display:flex;gap:8px;align-items:center;font-size:.92rem}
#printArea{display:none}
.pseudo-fs{position:fixed!important;inset:0!important;z-index:9999!important;width:100vw!important;height:100vh!important;max-width:none!important;margin:0!important;border-radius:0!important;overflow:auto!important;background:var(--bg,#fff)}body.pseudo-fs-on{overflow:hidden}
.fin-units{display:flex;flex-direction:column;gap:6px}.fin-u{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;text-align:start;font:inherit;font-size:.86rem;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);cursor:pointer}
.fin-u span{color:var(--mute)}.fin-u em{font-style:normal;font-size:.78rem;color:var(--mute)}.fin-u.on{border-color:var(--brand,#4b40a9);background:color-mix(in srgb,var(--brand,#4b40a9) 10%,var(--bg));}
.fin-head h2{margin:0 0 2px}.fin-lesson h3{margin:18px 0 8px;font-size:1rem;border-inline-start:4px solid var(--brand,#4b40a9);padding-inline-start:8px}
.fin-q{border:1px solid var(--line);border-radius:12px;padding:10px;margin:0 0 12px;background:var(--card,#fff)}.fin-q header{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-bottom:8px}
.fin-q .chip{font-size:.74rem;padding:2px 8px;border-radius:999px;background:var(--bg);border:1px solid var(--line);color:var(--mute)}.fin-q .chip.strong{color:var(--ink);font-weight:700}.fin-q .chip.lesson{color:var(--brand,#4b40a9)}
.fin-q img{display:block;width:100%;max-width:780px;margin:0 auto;height:auto;background:#fff;border-radius:6px}.fin-pick{margin-inline-end:4px}
.fin-txt{margin:8px 0;padding:10px 12px;background:var(--bg);border-radius:8px;line-height:1.9;font-size:1rem;white-space:pre-wrap}
.fin-ans{margin-top:8px;font-size:.9rem}.fin-ans summary{cursor:pointer;font-weight:700;color:var(--brand,#4b40a9)}.fin-a{padding:6px 10px;border-inline-start:3px solid var(--line);margin-top:6px;line-height:1.7}
#printArea .fin-pq{page-break-inside:avoid;margin:0 0 10px}#printArea .fin-pq img{max-width:100%}#printArea .fin-pn{font-weight:bold;font-size:12pt}#printArea .fin-pn small{font-weight:normal;font-size:9pt;color:#555}
@media print{
  @page{size:A4;margin:0}
  /* ترويسة الشعارين: وزارة التعليم يمينًا · رؤية عُمان يسارًا · تتكرّر كل صفحة */
  #printArea .plogo-row{display:flex;justify-content:space-between;align-items:center;gap:8mm;padding:0 0 2mm}
  #printArea .plogo-row img{height:13mm;width:auto;display:block}
  #printArea .plogo-vis{height:12mm}
  /* جودة الطباعة: ألوان الشعارات والتظليل تُطبع كما هي */
  body.printing,#printArea{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  #printArea .prw{width:100%;border-collapse:collapse}#printArea .prw>thead>tr>td,#printArea .prw>tfoot>tr>td,#printArea .prw>tbody>tr>td{padding:0 12mm;border:0}#printArea .prsp{height:8mm}
  body.printing>*:not(#printArea){display:none!important}
  body.printing #printArea{display:block!important;color:#000;font-family:"Simplified Arabic","Traditional Arabic","IBM Plex Sans Arabic",Tahoma,serif;font-size:14pt;line-height:1.6}
  body.printing{background:#fff!important}
  #printArea .ppage+.ppage{page-break-before:always}
  .no-print{display:none!important}
}
@media (max-width:900px){.qlayout{grid-template-columns:1fr}.qside{position:static;max-height:none}.paper{padding:18px 14px;font-size:15px}}
/* ---------- طبقة المؤثرات المشتركة لكل الألعاب ---------- */
.fx-cv{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999}
.g-stage{position:relative;background:radial-gradient(1200px 400px at 50% -10%,color-mix(in srgb,var(--main,#4b40a9) 10%,transparent),transparent 70%),var(--paper)}
.g-stage::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,rgba(31,138,112,.09) 1.5px,transparent 1.6px);background-size:26px 26px;animation:fxDrift 30s linear infinite;z-index:0}
.g-stage>*{position:relative;z-index:1}
@keyframes fxDrift{to{background-position:260px 130px}}
.fx-flash{position:absolute;inset:0;pointer-events:none;z-index:50;border-radius:inherit;animation:fxFlash .55s ease forwards}
.fx-flash.ok{box-shadow:inset 0 0 0 6px #26890c,inset 0 0 90px rgba(38,137,12,.45)}.fx-flash.bad{box-shadow:inset 0 0 0 6px #e21b3c,inset 0 0 90px rgba(226,27,60,.45)}
@keyframes fxFlash{from{opacity:1}to{opacity:0}}
.fx-shake{animation:fxShake .45s}@keyframes fxShake{20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
.fx-text{position:absolute;top:38%;inset-inline:0;text-align:center;z-index:60;pointer-events:none;font-size:clamp(1.8rem,5vw,3.4rem);font-weight:900;-webkit-text-stroke:2px #fff;paint-order:stroke fill;text-shadow:0 6px 20px rgba(0,0,0,.18);animation:fxText 1.2s cubic-bezier(.2,1.6,.4,1) forwards}
@keyframes fxText{0%{opacity:0;transform:scale(.3) rotate(-8deg)}25%{opacity:1;transform:scale(1.15) rotate(2deg)}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:translateY(-50px) scale(.9)}}
.g-win{animation:fxWin .6s cubic-bezier(.2,1.5,.4,1);position:relative}
.g-win:not(.small){background:radial-gradient(circle at 50% 30%,rgba(255,212,0,.25),transparent 60%);border-radius:20px}
.g-win:not(.small)::before{content:"";position:absolute;left:50%;top:60px;width:360px;height:360px;margin:-180px 0 0 -180px;background:repeating-conic-gradient(rgba(255,212,0,.22) 0 10deg,transparent 10deg 20deg);border-radius:50%;animation:fxSpin 12s linear infinite;z-index:-1}
.g-win h2{animation:fxPulse 1.4s ease-in-out infinite alternate}
@keyframes fxWin{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}@keyframes fxSpin{to{transform:rotate(360deg)}}@keyframes fxPulse{to{transform:scale(1.05)}}
.sc{transition:transform .2s}.sc.bump{animation:fxBump .6s cubic-bezier(.2,1.8,.4,1)}.sc.bump .sc-v{color:var(--tc)}
@keyframes fxBump{30%{transform:scale(1.22) rotate(-2deg)}}
.g-card{animation:fxCardIn .5s cubic-bezier(.2,1.4,.4,1) both}
.g-cards .g-card:nth-child(1){animation-delay:.02s}.g-cards .g-card:nth-child(2){animation-delay:.06s}.g-cards .g-card:nth-child(3){animation-delay:.1s}.g-cards .g-card:nth-child(4){animation-delay:.14s}.g-cards .g-card:nth-child(5){animation-delay:.18s}.g-cards .g-card:nth-child(6){animation-delay:.22s}.g-cards .g-card:nth-child(7){animation-delay:.26s}.g-cards .g-card:nth-child(8){animation-delay:.3s}.g-cards .g-card:nth-child(n+9){animation-delay:.34s}
@keyframes fxCardIn{from{opacity:0;transform:translateY(18px) scale(.95)}}
.g-card:not(.off):hover .g-ic{animation:fxWiggle .5s ease}.g-card .g-ic{display:inline-block}
@keyframes fxWiggle{30%{transform:rotate(-12deg) scale(1.2)}60%{transform:rotate(10deg) scale(1.15)}}
.g-card.hot{position:relative;border-color:#e8890c!important;box-shadow:0 0 0 2px rgba(224,169,59,.35),var(--shadow)}
.g-card.hot::after{content:"جديدة ✨";position:absolute;top:8px;inset-inline-end:8px;background:#e21b3c;color:#fff;font-size:.7rem;font-weight:800;padding:2px 8px;border-radius:999px;animation:fxPulse .8s ease-in-out infinite alternate}
.gm-body .mc,.gm-body .jp-c,.gm-body [data-m],.gm-body .opt,.gm-body button.choice{transition:transform .12s}
.gm-body button:not(:disabled):active{transform:scale(.96)}
@media (prefers-reduced-motion:reduce){.g-stage::before,.g-card,.g-win,.g-win::before,.fx-text{animation:none!important}}
/* ---------- ألعاب الحركة ---------- */
.arc-svg{width:100%;height:auto;display:block;border-radius:16px;border:1px solid var(--line)}
.tug.arc-ball{grid-template-columns:minmax(0,1fr) minmax(0,1.7fr) minmax(0,1fr)}
.arc-hero .arc-svg{border:0;border-radius:0}
.arc-n{display:flex;gap:6px;justify-content:center;align-items:center;font-weight:700;margin:6px 0}
.arc-names{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.bl-board{display:flex;justify-content:center;align-items:center;gap:10px;background:#2e2775;color:#fff;border-radius:14px;padding:6px 14px;font-size:1.1rem;font-weight:800}
.bl-board b{font-size:2rem;min-width:1.2em;text-align:center;font-variant-numeric:tabular-nums}.bl-t{color:color-mix(in srgb,var(--tc) 55%,#fff);max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bl-move{transition:transform .5s cubic-bezier(.3,1.4,.5,1)}


.bl-ball{transform-box:fill-box;transform-origin:center}.bl-ball.roll-l{animation:blRollL .5s ease-out}.bl-ball.roll-r{animation:blRollR .5s ease-out}
@keyframes blRollL{to{transform:rotate(-360deg)}}@keyframes blRollR{to{transform:rotate(360deg)}}
.bl-goal.shake{animation:tugShake .3s 3}
.bl-goaltxt{font-size:clamp(3rem,9vw,6.5rem);font-weight:900;-webkit-text-stroke:3px #fff;paint-order:stroke fill;animation:fxText 2.2s cubic-bezier(.2,1.6,.4,1) forwards;text-align:center;line-height:1.1}
.bl-goaltxt small{display:block;font-size:.35em;-webkit-text-stroke:1px #fff}
.arc-rk{position:relative;display:flex;flex-direction:column;gap:10px;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.rk-top .arc-svg{max-height:46vh;object-fit:contain;background:#05061a}
.rk-svg .st{animation:rkTw 2.2s ease-in-out infinite alternate}@keyframes rkTw{from{opacity:.25}to{opacity:1}}
.rk-move{transition:transform .6s cubic-bezier(.3,1.3,.5,1)}
.rk-flame{transform-box:fill-box;transform-origin:50% 0;animation:rkFl .12s linear infinite alternate}@keyframes rkFl{to{transform:scaleY(.65)}}
.rk .rk-body{animation:rkHover 1.6s ease-in-out infinite alternate}@keyframes rkHover{to{transform:translateY(-4px)}}
.rk.boost .rk-flame{animation:rkBoost .7s ease-out}@keyframes rkBoost{30%{transform:scaleY(2.4) scaleX(1.4)}}
.rk.sput .rk-body{animation:rkSput .6s}@keyframes rkSput{20%,60%{transform:translateX(-5px) rotate(-6deg)}40%,80%{transform:translateX(5px) rotate(6deg)}}
.rk.sput .rk-flame{opacity:.15}
.rk-moon{animation:rkMoon 6s ease-in-out infinite alternate}@keyframes rkMoon{to{transform:translateY(6px)}}
.rk-panels{display:grid;gap:10px}.rk-n2{grid-template-columns:1fr 1fr}.rk-n3{grid-template-columns:repeat(3,1fr)}.rk-n4{grid-template-columns:repeat(4,1fr)}
.rk-panels .tug-p{min-height:0}.rk-n4 .tug-ch,.rk-n3 .tug-ch{grid-template-columns:1fr}.rk-n4 .tug-b,.rk-n3 .tug-b{min-height:50px;font-size:.92rem}.rk-n4 .tug-q{font-size:1rem;min-height:70px}
.bn-hero{position:relative;height:200px;background:linear-gradient(#bfe6ff,#effaff)}
.bn-wrap{position:relative;display:flex;flex-direction:column;gap:10px;min-height:560px}
.bn-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.bn-turn{font-size:1.15rem;font-weight:800;border:3px solid var(--tc);border-radius:999px;padding:4px 16px;animation:fxPulse .9s ease-in-out infinite alternate}
.bn-qn{font-weight:700;color:var(--mute)}
.bn-q{background:#fff;border:3px solid #2e2775;border-radius:18px;padding:14px 18px;font-size:1.35rem;font-weight:800;text-align:center;line-height:1.7;box-shadow:0 6px 0 #2e2775}
.bn-q.in{animation:tugIn .4s ease}
.bn-sky{position:relative;flex:1;min-height:440px;border-radius:20px;overflow:hidden;background:linear-gradient(#8fd3ff,#d6f0ff 60%,#f0fbff)}
.bn-cloud{position:absolute;font-size:4rem;opacity:.9;animation:bnCloud 40s linear infinite}.bn-cloud.c1{top:8%;animation-duration:38s}.bn-cloud.c2{top:35%;animation-duration:55s;animation-delay:-20s;font-size:3rem}.bn-cloud.c3{top:62%;animation-duration:47s;animation-delay:-8s}
@keyframes bnCloud{from{transform:translateX(-120vw)}to{transform:translateX(120vw)}}
.bn{position:absolute;bottom:-190px;width:clamp(120px,20%,190px);aspect-ratio:.82;border:0;padding:0;background:none;cursor:pointer;animation-name:bnRise,bnSway;animation-timing-function:linear,ease-in-out;animation-iteration-count:infinite,infinite;animation-direction:normal,alternate;font:inherit}
.bn i{position:absolute;inset:0 0 18% 0;border-radius:50% 50% 46% 46%;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.75) 0 9%,transparent 10%),radial-gradient(circle at 50% 45%,color-mix(in srgb,var(--bc) 80%,#fff),var(--bc) 70%);box-shadow:inset -10px -14px 0 rgba(0,0,0,.12)}
.bn::before{content:"";position:absolute;left:50%;bottom:0;width:2px;height:20%;background:#555}
.bn::after{content:"";position:absolute;left:calc(50% - 7px);bottom:17%;border:7px solid transparent;border-bottom-color:var(--bc)}
.bn span{position:absolute;inset:10% 10% 26%;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:800;font-size:1rem;line-height:1.35;color:#1e1a4d;text-shadow:0 1px 0 rgba(255,255,255,.6);overflow:hidden}
.bn-demo{animation-duration:9s,2.4s}
@keyframes bnRise{from{bottom:-110px}to{bottom:105%}}@keyframes bnSway{from{transform:translateX(-14px) rotate(-4deg)}to{transform:translateX(14px) rotate(4deg)}}
.bn.popped{animation-play-state:paused;pointer-events:none}.bn.popped i,.bn.popped span,.bn.popped::before,.bn.popped::after{animation:bnPop .3s ease forwards}
@keyframes bnPop{50%{transform:scale(1.35);opacity:.8}to{transform:scale(.1);opacity:0}}
.bn.bad i{background:#444!important}
.bn.good{animation-play-state:paused}.bn.good i{box-shadow:0 0 0 6px #26890c,0 0 40px #26890c}.bn.fade{opacity:.25;animation-play-state:paused;transition:opacity .3s}
.rn{display:flex;flex-direction:column;gap:8px;user-select:none;-webkit-user-select:none}
.rn-hud{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;background:#2e2775;color:#fff;border-radius:14px;padding:8px 14px;font-weight:800;font-size:1.05rem}
.rn-team{background:var(--tc);border-radius:999px;padding:2px 12px}.rn-lives{letter-spacing:2px}.rn-sc b,.rn-coins b{font-variant-numeric:tabular-nums}
.rn-view{position:relative;border-radius:18px;overflow:hidden;border:1px solid var(--line)}
.rn-view canvas,.rn-hero canvas{display:block;width:100%;height:auto}
.rn-q{position:absolute;inset-inline:3%;top:4%;background:rgba(255,255,255,.95);border-radius:20px;padding:12px;box-shadow:0 18px 50px rgba(0,0,0,.3);border:3px solid #2e2775}
.rn-q.in{animation:fxWin .4s cubic-bezier(.2,1.5,.4,1)}
.rn-qt{font-size:1.3rem;font-weight:800;text-align:center;line-height:1.6;margin-bottom:10px}
.rn-ch{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.rn-b{display:flex;flex-direction:column;align-items:center;gap:4px;font:inherit;font-weight:800;font-size:1.05rem;background:#fff;border:3px solid #1368ce;border-radius:16px;padding:10px 8px;cursor:pointer;box-shadow:0 5px 0 #1368ce;transition:transform .08s}
.rn-b:active{transform:translateY(3px);box-shadow:0 2px 0 #1368ce}.rn-ic{font-size:2rem;line-height:1}.rn-b small{color:var(--mute);font-weight:700}
.rn-b.ok{background:#26890c;border-color:#26890c;color:#fff;box-shadow:0 5px 0 #185c07}.rn-b.ok small{color:#e8ffe0}.rn-b.no{background:#e21b3c;border-color:#e21b3c;color:#fff;box-shadow:0 5px 0 #8f0f24}
.rn-bar{height:8px;background:#e9ecef;border-radius:999px;margin-top:10px;overflow:hidden}.rn-bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#e21b3c,#ffd400,#26890c)}
.g-stage:fullscreen .rn-qt{font-size:1.7rem}.g-stage:fullscreen .rn-b{font-size:1.35rem}.g-stage:fullscreen .rn-view canvas{max-height:calc(100vh - 140px);object-fit:contain}
@media (max-width:700px){.rk-n3,.rk-n4{grid-template-columns:1fr 1fr}.rn-ch{grid-template-columns:1fr}.rn-b{flex-direction:row;justify-content:flex-start}.rn-qt{font-size:1.05rem}.rn-q{position:static;margin-top:8px}}
/* ---------- لعبة شدّ الحبل ---------- */
.tug-setup{text-align:center;max-width:760px;margin:0 auto}
.tug-hero{border-radius:18px;overflow:hidden;border:1px solid var(--line);margin-bottom:8px}
.tug-hero .tug-team .tf{animation:tugIdle 1.1s ease-in-out infinite alternate}.tug-hero .tug-move{animation:tugSway 2.4s ease-in-out infinite alternate}
@keyframes tugSway{from{transform:translateX(-40px)}to{transform:translateX(40px)}}
@keyframes tugIdle{from{transform:translateX(0)}to{transform:translateX(calc(var(--d)*4px))}}
.tug-names{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
.tug-names label{display:grid;gap:4px;font-weight:800;color:var(--tc);text-align:start}
.tug-names input{font:inherit;font-size:1.05rem;padding:10px 12px;border:2px solid var(--tc);border-radius:12px;color:var(--ink)}
.tug-opts{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:6px 0 14px}
.tug-opts label{display:flex;align-items:center;gap:6px;font-weight:700;font-size:.92rem}.tug-opts select{font:inherit;padding:6px 8px;border-radius:10px;border:1px solid var(--line)}
.tug{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr) minmax(0,1fr);gap:12px;align-items:stretch;padding:4px 0 8px;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.tug-p{position:relative;display:flex;flex-direction:column;gap:10px;border-radius:18px;padding:12px;background:color-mix(in srgb,var(--tc) 9%,#fff);border:3px solid var(--tc);min-height:420px;overflow:hidden}
.tug-p header{display:flex;justify-content:space-between;align-items:center;gap:6px;background:var(--tc);color:#fff;border-radius:12px;padding:8px 12px;font-size:1.1rem}
.tug-st{font-size:.9rem;font-weight:700;white-space:nowrap}.tug-fire{display:inline-block;animation:tugFire .6s ease-in-out infinite alternate}
@keyframes tugFire{to{transform:scale(1.25) rotate(-6deg)}}
.tug-q{background:#fff;border-radius:12px;padding:12px 14px;font-size:1.12rem;font-weight:700;line-height:1.7;min-height:96px;box-shadow:0 2px 0 rgba(0,0,0,.06)}
.tug-q img{display:block;max-width:100%;max-height:150px;margin:0 auto 6px}
.tug-p.in .tug-q{animation:tugIn .35s ease}@keyframes tugIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
.tug-ch{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1;align-content:start}
.tug-b{position:relative;display:flex;align-items:center;gap:8px;min-height:64px;font:inherit;font-size:1rem;font-weight:700;text-align:start;color:var(--ink);background:#fff;border:2px solid color-mix(in srgb,var(--tc) 45%,#fff);border-radius:14px;padding:10px 10px;cursor:pointer;transition:transform .08s,background .15s;box-shadow:0 3px 0 color-mix(in srgb,var(--tc) 40%,#fff)}
.tug-b:active{transform:translateY(2px);box-shadow:none}.tug-b kbd{flex:none;font:inherit;font-size:.7rem;background:var(--tc);color:#fff;border-radius:6px;padding:1px 6px;opacity:.75}
.tug-b.ok{background:#26890c;border-color:#26890c;color:#fff;animation:tugOk .4s}.tug-b.no{background:#e21b3c;border-color:#e21b3c;color:#fff}
@keyframes tugOk{50%{transform:scale(1.06)}}
.tug-p.shake{animation:tugShake .45s}@keyframes tugShake{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
.tug-ice{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:4rem;background:rgba(200,235,255,.82);backdrop-filter:blur(2px);color:#0b5e8a;font-weight:900;animation:tugIce .25s ease}
.tug-ice span{font-size:1.4rem}.tug-ice[hidden]{display:none}@keyframes tugIce{from{opacity:0;transform:scale(1.15)}}
.tug-pop{position:absolute;top:40%;inset-inline:0;text-align:center;font-size:1.8rem;font-weight:900;text-shadow:0 2px 0 #fff;animation:tugPop 1.3s ease forwards;pointer-events:none}
@keyframes tugPop{0%{opacity:0;transform:scale(.6)}20%{opacity:1;transform:scale(1.15)}100%{opacity:0;transform:translateY(-60px)}}
.tug-mid{display:flex;flex-direction:column;gap:8px;justify-content:center}
.tug-top{display:flex;justify-content:center;gap:10px;align-items:center;flex-wrap:wrap}
.tug-lead{font-weight:900;font-size:1.05rem;transition:color .2s}
.tug-time{font-variant-numeric:tabular-nums;font-weight:900;font-size:1.3rem;background:#2e2775;color:#fff;border-radius:999px;padding:3px 14px}.tug-time.low{background:#e21b3c;animation:tugFire .5s infinite alternate}
.tug-svg{width:100%;height:auto;display:block;border-radius:16px;border:1px solid var(--line)}
.tug-move{transition:transform .45s cubic-bezier(.3,1.6,.5,1)}
.tug-move.jerk .tug-flag{animation:tugFlag .45s}@keyframes tugFlag{40%{transform:translateY(-6px)}}
.tug-team .tf{transform-box:fill-box;transform-origin:50% 100%}
.tug-team.heave .tf{animation:tugHeave .45s ease}.tug-team.heave .tf1{animation-delay:.06s}
@keyframes tugHeave{40%{transform:rotate(calc(var(--d)*12deg)) translateX(calc(var(--d)*6px))}}
.tug-team.fall .tf{animation:tugFall .9s ease forwards}@keyframes tugFall{to{transform:rotate(calc(var(--d)*-75deg)) translateY(10px)}}
.tug-team.cheer .tf{animation:tugJump .5s ease-in-out infinite alternate}.tug-team.cheer .tf1{animation-delay:.15s}@keyframes tugJump{to{transform:translateY(-22px)}}
.tug-puff{fill:#b9a27c;opacity:.75;animation:tugPuff .7s ease-out forwards}@keyframes tugPuff{to{opacity:0;transform:translate(var(--dx),-22px) scale(1.8)}}
.tug-crowd{display:flex;justify-content:space-around;font-size:1.5rem}.tug-crowd span{animation:tugJump .7s ease-in-out infinite alternate}.tug-crowd span:nth-child(2n){animation-delay:.35s}
.tug-meter{position:relative;display:flex;height:12px;border-radius:999px;overflow:hidden}.tug-meter span{flex:1;background:var(--tc);opacity:.8}
.tug-meter i{position:absolute;top:-2px;width:16px;height:16px;margin-inline-start:-8px;border-radius:50%;background:#ffd400;border:3px solid #24323a;transition:inset-inline-start .45s}
.tug-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5}
.tug-cd{position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:6;background:rgba(255,255,255,.55);backdrop-filter:blur(2px);border-radius:18px}
.tug-cd.on{display:flex}.tug-n{font-size:9rem;font-weight:900;color:#2e2775;animation:tugCount .8s ease}.tug-n.go{font-size:5rem;color:#26890c}
@keyframes tugCount{from{transform:scale(2.2);opacity:0}to{transform:scale(1);opacity:1}}
.tug-res{background:#fff;border-radius:22px;padding:22px 28px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25);animation:tugCount .5s ease;max-width:92%}
.tug-res h2{font-size:2.2rem;margin:4px 0 12px}.tug-trophy{font-size:4.5rem;animation:tugJump .6s ease-in-out infinite alternate}
.tug-sums{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}.tug-sum{display:grid;gap:2px;border:2px solid var(--tc);border-radius:14px;padding:8px 16px}.tug-sum b{color:var(--tc)}
.tug-again{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.g-stage:fullscreen .tug-p{min-height:calc(100vh - 160px)}.g-stage:fullscreen .tug-q{font-size:1.35rem}.g-stage:fullscreen .tug-b{font-size:1.2rem;min-height:84px}
@media (max-width:900px){.tug{grid-template-columns:1fr 1fr}.tug-mid{grid-column:1/-1;order:-1}.tug-p{min-height:0}.tug-ch{grid-template-columns:1fr}}
@media (max-width:520px){.tug-names{grid-template-columns:1fr}.tug-b{min-height:52px;font-size:.92rem}.tug-q{font-size:1rem}}
.an-wrap{padding-top:14px;padding-bottom:40px}.an-head h2{margin:0 0 4px}.an-new{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
.an-sub{margin:18px 0 6px}.an-list{list-style:none;padding:0;margin:0;display:grid;gap:6px}.an-list li{display:flex;gap:10px;align-items:center;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:8px 12px}.an-list li .x{margin-inline-start:auto}
.an-pick{display:grid;gap:6px;max-height:50vh;overflow:auto;text-align:right}.an-pick label{display:block;padding:6px 8px;border:1px solid var(--line);border-radius:8px;cursor:pointer}
.an-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 12px}.an-bar .title-in{flex:1;min-width:220px}.an-acts{display:flex;gap:8px;margin-inline-start:auto}
.an-meta{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0}.an-meta label{display:flex;flex-direction:column;gap:3px;font-size:.85rem;font-weight:700;color:var(--mute);min-width:120px;flex:1}
.an-in{border:1px solid var(--line);border-radius:7px;padding:5px 7px;font:inherit;background:#fff;min-width:0}.an-in.num{width:52px;text-align:center}.an-in.sm{padding:3px 4px;font-size:.82rem}.an-in.bad{border-color:#d64545;background:#fdecec}
.an-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:6px 0}
.an-t{border-collapse:collapse;width:100%;font-size:.88rem}.an-t th,.an-t td{border:1px solid var(--line);padding:4px 6px;text-align:center;vertical-align:middle}.an-t thead th,.an-t tbody th{background:#eceafb;font-weight:800}
.an-t th small{display:block;font-weight:400;color:var(--mute);font-size:.72rem}.an-grid td.nm,.an-grid th.nm{min-width:160px;text-align:right}.an-grid td.nm .an-in{width:100%}.an-grid td.tot{font-weight:800;white-space:nowrap}
.an-items .an-in{width:100%;min-width:64px}.an-items .an-in.num{width:52px;min-width:0}
.an-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}
.an-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0 8px}
.an-sheet{border-collapse:collapse;font-size:.92rem;background:#fff;user-select:none}.an-sheet th,.an-sheet td{border:1px solid #c9d3cf;padding:0;height:30px;text-align:center}
.an-sheet thead th{background:#eef2f0;font-weight:700;padding:3px 6px;position:sticky;top:0;z-index:1;white-space:nowrap}.an-sheet thead th small{display:block;font-weight:400;color:var(--mute);font-size:.72rem}
.an-sheet th.rn{background:#eef2f0;color:#6b7b76;font-weight:400;min-width:30px;font-size:.8rem}.an-sheet td.rn{background:#fafbfa}
.an-sheet input{width:52px;height:30px;border:0;background:transparent;text-align:center;font:inherit;padding:0 4px;box-sizing:border-box;outline:none;user-select:text}
.an-sheet td.nm{min-width:190px}.an-sheet td.nm input{width:100%;text-align:right;padding:0 8px}
.an-sheet input:focus{outline:2px solid #4b40a9;outline-offset:-2px;background:#fff}
.an-sheet td.sel{background:#d6ece3}.an-sheet td.bad{background:#fdecec}.an-sheet td.tc{font-weight:800;background:#f6f8f7;padding:0 8px;white-space:nowrap}
.an-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:8px 0 12px}.an-cards div{background:#eceafb;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column}.an-cards b{font-size:1.5rem;color:var(--main-d)}.an-cards span{font-size:.82rem;color:var(--mute)}.an-cards .warn{background:#fdecec}.an-cards .warn b{color:#b42318}
.an-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}@media (max-width:760px){.an-two{grid-template-columns:1fr}}
#anRes h4{margin:16px 0 6px;color:var(--main-d)}.an-note{display:block;font-weight:800;margin:6px 0}.an-note textarea{display:block;width:100%;margin-top:4px;line-height:1.7;resize:vertical}
.ld-layout{display:grid;grid-template-columns:260px 1fr;gap:14px;align-items:start}@media (max-width:820px){.ld-layout{grid-template-columns:1fr}}
.ld-st{list-style:none;padding:0;margin:0 0 8px;display:grid;gap:5px;max-height:60vh;overflow:auto}.ld-st button{width:100%;text-align:right;border:1px solid var(--line);background:#fff;border-radius:9px;padding:7px 9px;cursor:pointer;font:inherit}.ld-st button small{display:block;color:var(--mute);font-size:.75rem}.ld-st button.on{background:#eceafb;border-color:var(--main)}
.ld-head{display:flex;gap:10px;align-items:end}.ld-name{flex:1;display:flex;flex-direction:column;gap:3px;font-weight:800}.ld-asp{display:flex;flex-wrap:wrap;gap:6px 14px;margin:4px 0 8px}.ld-asp label{display:flex;gap:5px;align-items:center;background:#f6f5fc;border:1px solid var(--line);border-radius:999px;padding:3px 10px;cursor:pointer}
.ld-main h4{margin:14px 0 6px;color:var(--main-d)}.btn.danger{color:#b42318;border-color:#f1b5b0}
.fm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin:12px 0}.fm-card{display:flex;flex-direction:column;gap:4px;text-align:right;font:inherit;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px;cursor:pointer}.fm-card:hover{border-color:var(--main)}.fm-ic{font-size:1.6rem}.fm-card small{color:var(--mute);line-height:1.5}
.fm-ph{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px}.fm-ph span{position:relative}.fm-ph img{width:110px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--line)}.fm-ph .x{position:absolute;top:2px;left:2px;background:#fff;border-radius:50%}
.fm-prev{max-height:80vh;overflow:auto}
.sp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}.sp-card{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px}.sp-h{display:flex;justify-content:space-between;gap:8px;align-items:center}.sp-code{font-family:monospace;font-size:1.05rem;background:#eceafb;border-radius:8px;padding:2px 8px;letter-spacing:2px}.sp-n{display:flex;gap:12px;font-size:.85rem;color:var(--mute)}.sp-b{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.sp-b .x{margin-inline-start:auto}
.in-bar select,.in-bar input[type=search]{font:inherit;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--paper);min-width:0}.in-bar input[type=search]{flex:1 1 220px}
.in-empty{background:var(--paper);border:1px dashed var(--line);border-radius:14px;padding:28px;text-align:center;color:var(--mute)}
.in-list{display:grid;gap:14px}.in-card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.in-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:6px}.in-h h3{margin:0 0 2px;font-size:1.15rem}.in-who{color:var(--main-d)}
.in-act{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.in-card h4{margin:12px 0 4px;color:var(--main-d);font-size:.95rem}.in-card p{margin:0;line-height:1.85;white-space:normal;overflow-wrap:anywhere}
.in-ph{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}.in-th{padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;cursor:zoom-in;background:#f3f3f3;aspect-ratio:4/3}.in-th img{width:100%;height:100%;object-fit:cover;display:block}
.in-docs{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.in-view{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center}.in-view figure{margin:0;max-width:94vw;max-height:92vh;text-align:center}.in-view img{max-width:94vw;max-height:84vh;object-fit:contain;border-radius:6px;background:#222}.in-view figcaption{color:#eee;margin-top:8px;font-size:.9rem}
.in-vx,.in-vn{position:absolute;background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:50%;width:46px;height:46px;font-size:28px;line-height:1;cursor:pointer}.in-vx{top:14px;left:14px}.in-vn{top:50%;transform:translateY(-50%)}.in-vp{right:14px}.in-vnx{left:14px}
.in-form{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px;max-width:820px;margin:0 auto;display:grid;gap:12px}.in-form h2{margin:0}
.in-f{display:grid;gap:5px}.in-f>span{font-weight:700}.in-f i{color:#c0392b;font-style:normal}.in-f input,.in-f textarea{font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;width:100%;box-sizing:border-box;resize:vertical}
.in-drop{display:grid;gap:3px;text-align:center;border:2px dashed var(--line);border-radius:14px;padding:20px;cursor:pointer;background:rgba(0,0,0,.015)}.in-drop.on,.in-drop:hover{border-color:var(--main);background:rgba(0,0,0,.035)}.in-drop small{color:var(--mute)}
.in-pend{display:flex;flex-wrap:wrap;gap:8px}.in-pi{position:relative;width:110px;display:grid;gap:2px;text-align:center}.in-pi img,.in-pi em{width:110px;height:82px;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:30px;font-style:normal;background:#f3f3f3}.in-pi small{font-size:.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.in-pi.new img,.in-pi.new em{outline:2px solid var(--main)}.in-pi .x{position:absolute;top:2px;left:2px;background:#fff;border-radius:50%}
.in-btns{display:flex;gap:8px;flex-wrap:wrap}
.in-print{font-size:12pt;line-height:1.8}.in-pt{width:100%;border-collapse:collapse;margin:6px 0 10px}.in-pt th,.in-pt td{border:1px solid #000;padding:5px 8px;text-align:right}.in-pt th{background:#eee;width:28%}.in-print h3{margin:12px 0 4px;border-bottom:1px solid #999}.in-pph{display:grid;grid-template-columns:1fr 1fr;gap:8px}.in-pph img{width:100%;max-height:95mm;object-fit:contain;border:1px solid #ccc;break-inside:avoid}
/* ===== بطاقات الإجابة ===== */
.ck-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0;margin:12px 0;list-style:none;counter-reset:ck}
.ck-steps li{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:.92rem;counter-increment:ck;display:flex;gap:8px;align-items:center}
.ck-steps li::before{content:counter(ck);background:var(--main);color:#fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;font-weight:800;flex:none;font-size:.85rem}
.ck-tabs{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:14px 0 4px;border-bottom:1px solid var(--line)}
.ck-tabs button{font:inherit;font-weight:700;border:0;background:none;padding:8px 14px;border-bottom:3px solid transparent;cursor:pointer;color:var(--mute)}
.ck-tabs button[aria-selected=true]{color:var(--main-d);border-bottom-color:var(--main)}
.ck-board-l{margin-inline-start:auto}
.ck-form{display:grid;gap:12px;max-width:900px}.ck-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ck-f{display:grid;gap:4px}.ck-f>span{font-weight:700}.ck-f input,.ck-f textarea,.ck-f select{font:inherit;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;width:100%;box-sizing:border-box}
.ck-f textarea{line-height:1.9;resize:vertical}
.ck-popt{display:grid;gap:8px;text-align:right}.ck-popt label{display:flex;gap:8px;align-items:baseline}
.ck-ql{padding:0 22px 0 0;display:grid;gap:8px;margin:6px 0}.ck-ql li{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;gap:10px;justify-content:space-between;align-items:flex-start}
.ck-qt{flex:1;min-width:0;font-weight:600;overflow-wrap:anywhere}.ck-qc{display:flex;flex-wrap:wrap;gap:4px 14px;font-weight:400;font-size:.9rem;color:var(--mute);margin-top:4px}.ck-qc .ok{color:#15803d;font-weight:700}
.ck-qb{display:flex;gap:2px;flex:none}
.ck-qp{flex:none;font-weight:800;border-radius:999px;padding:2px 10px}.ck-qp.g{background:#dcfce7;color:#166534}.ck-qp.m{background:#fef3c7;color:#92400e}.ck-qp.b{background:#fee2e2;color:#991b1b}
.ck-add{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:4px 14px 14px}
.ck-bank{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:10px 0}.ck-bank .cpick{display:flex;gap:10px;flex-wrap:wrap}
.ck-bi-h{display:flex;gap:8px;align-items:center;margin:6px 0}.ck-bi-h span{margin-inline-end:auto}
.ck-bi{display:grid;gap:4px;max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px}
.ck-bi label{display:flex;gap:8px;align-items:flex-start;padding:6px;border-radius:8px;cursor:pointer}.ck-bi label:hover{background:rgba(0,0,0,.03)}.ck-bi label.in{opacity:.55}
.ck-man{display:grid;gap:10px;margin-top:10px}.ck-mc{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ck-pick{display:grid;gap:4px;max-height:40vh;overflow:auto;text-align:right;margin:6px 0}
.ck-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.ck-sum div{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center}.ck-sum b{display:block;font-size:1.6rem;color:var(--main-d)}.ck-sum small{color:var(--mute)}
.ck-tw{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--paper)}
.ck-rt{border-collapse:collapse;width:100%;font-size:.92rem}.ck-rt th,.ck-rt td{border:1px solid var(--line);padding:6px 8px;text-align:center;white-space:nowrap}.ck-rt th{background:rgba(0,0,0,.035)}
.ck-rt td.nm{text-align:right;white-space:normal;min-width:150px}.ck-rt td.ok{color:#15803d;font-weight:800}.ck-rt td.no{background:#fef2f2;color:#b91c1c;font-weight:700}.ck-rt td.na{color:#aaa}.ck-rt tr.abs td{color:#999}
.ck-cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.ck-cc{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px;display:grid;gap:10px}
.ck-cch{display:grid}.ck-cch b{font-size:1.1rem}.ck-ccb{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.ck-ccb .x{margin-inline-start:auto}
.ck-names{align-items:start}.ck-pv{max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:10px;background:#fff}
.ck-pt{width:100%;border-collapse:collapse}.ck-pt td{border-bottom:1px solid var(--line);padding:3px 6px}.ck-pt td:first-child{width:2.4em;text-align:center;font-weight:800;color:var(--mute)}
.ck-pt input{font:inherit;width:100%;border:0;padding:4px;background:transparent}.ck-pt input:focus{outline:2px solid var(--main);border-radius:6px;background:#fff}
.ck-units{display:grid;gap:6px;max-height:50vh;overflow:auto}.ck-units details{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:6px 10px}
.ck-units summary{cursor:pointer;font-weight:700}.ck-ul{display:grid;gap:3px;padding:6px 18px 2px 0}.ck-ul label{display:flex;gap:6px;align-items:baseline}
.ck-cnts{display:flex;gap:8px}.ck-cn{font:inherit;font-weight:800;font-size:1.1rem;min-width:62px;padding:8px 0;border-radius:12px;border:2px solid var(--line);background:#fff;cursor:pointer}
.ck-cn[aria-pressed=true]{border-color:var(--main);background:var(--main);color:#fff}
.ck-start{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0}.ck-so{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:20px;display:grid;gap:10px;justify-items:center;text-align:center;align-content:start}
.ck-si{font-size:2.6rem}.ck-so h3{margin:0}.ck-so p{margin:0}.ck-qr svg{max-width:200px;height:auto;border-radius:8px}
.ck-bqr{background:#fff;border-radius:18px;padding:12px;display:inline-block;margin:16px 0}.ck-bqr svg{display:block;width:260px;height:260px}.ck-bend{font-size:1.4rem;color:#a7f3d0}
.ck-bctl{position:fixed;bottom:14px;left:14px;display:flex;gap:8px;z-index:101}.ck-bctl button,.ck-bctl a{border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:10px;width:42px;height:42px;font-size:20px;cursor:pointer;display:grid;place-items:center;text-decoration:none}
@media (max-width:700px){.ck-start{grid-template-columns:1fr}.ck-cn{min-width:52px}}
.ck-help h4{margin:14px 0 6px;color:var(--main-d)}.ck-help ol,.ck-help ul{margin:0;padding-inline-start:22px;display:grid;gap:6px;line-height:1.8}
.ck-holds{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin:8px 0}.ck-holds figure{margin:0;text-align:center}.ck-holds figcaption{margin-top:6px;font-weight:700}.ck-up{display:inline-block;background:#f59e0b;color:#fff;font-weight:900;border-radius:999px;padding:1px 12px;margin-bottom:6px;font-size:1.05em}.ck-bhelp .ck-up{font-size:1.8rem;padding:2px 20px}.ck-holds figcaption b{font-size:1.2em;color:var(--main-d)}
.ck-hold{background:#fff;border:1px solid #ccc;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.12)}.ck-hold>div,.ck-hold svg{width:100%;height:100%;display:block}
.ck-bhelp{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:30px;text-align:center}.ck-bhelp h1{font-size:2.6rem;margin:0}.ck-bhelp p{font-size:1.4rem;opacity:.9;margin:0 0 10px}
.ck-bhelp .ck-holds{gap:36px}.ck-bhelp figcaption{font-size:1.6rem}.ck-bhelp figcaption b{color:#fbbf24}.ck-bhint{font-size:1rem;opacity:.7}
/* المسح الحي (ملء الشاشة على الجوال) */
body.ck-noscroll{overflow:hidden}body.ck-noscroll #modal{z-index:3000}body.ck-noscroll #toast{z-index:3001}
.ck-live{position:fixed;inset:0;z-index:2000;background:#0b0f10;color:#fff;display:flex;flex-direction:column}
.ck-lh{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:rgba(0,0,0,.6)}
.ck-x{border:0;background:rgba(255,255,255,.15);color:#fff;width:40px;height:40px;border-radius:50%;font-size:18px;cursor:pointer;flex:none}
.ck-lq{flex:1;min-width:0;display:grid;gap:2px}.ck-lq b{font-size:.85rem;color:#9fe3cf}.ck-lq span{font-size:.95rem;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ck-lc{display:flex;flex-direction:column;gap:3px;align-items:flex-end;flex:none}.ck-sync-note{font-size:.64rem;opacity:.8;max-width:45vw;text-align:right;line-height:1.25}.ck-cnt{background:#16a34a;border-radius:999px;padding:2px 12px;font-size:.95rem;white-space:nowrap}.ck-cnt b{font-size:1.15rem}
.ck-dist{font-size:.78rem;background:rgba(255,255,255,.14);border-radius:6px;padding:0 6px}.ck-dist.ok{background:#16a34a}
.ck-cam{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.ck-rot{display:none;position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:3;background:rgba(255,159,28,.95);color:#1a1200;font-weight:700;font-size:.85rem;padding:7px 14px;border-radius:12px;white-space:nowrap;pointer-events:none}
@media (orientation:portrait){.ck-rot{display:block}}
.ck-cam video,.ck-cam canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.ck-msg{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.7);padding:8px 16px;border-radius:12px;text-align:center;max-width:90%;transition:opacity .6s}.ck-msg.fade{opacity:0;pointer-events:none}
.ck-leg{position:absolute;top:8px;left:8px;right:8px;text-align:center;font-size:.76rem;color:#fff;background:rgba(0,0,0,.5);border-radius:8px;padding:4px 8px;pointer-events:none;line-height:1.5}
.ck-markbtn{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);z-index:3;border:0;border-radius:999px;padding:9px 18px;font:inherit;font-weight:800;font-size:.9rem;background:#2563eb;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer}
.ck-markbtn.on{background:#16a34a}
.ck-ans-popup{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.85);color:#fff;border-radius:14px;padding:10px 20px;box-shadow:0 8px 28px rgba(0,0,0,.5);opacity:0;transition:opacity .25s;pointer-events:none;max-width:90%}
.ck-ans-popup.show{opacity:1}
.ck-ans-let{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:#16a34a;color:#fff;font-weight:900;font-size:1.3rem;flex-shrink:0}
.ck-ans-txt{font-size:1rem;font-weight:700;line-height:1.3}
.ck-lb{display:grid;grid-template-columns:1fr 1fr 1fr 1.2fr;gap:6px;padding:8px;padding-bottom:max(8px,env(safe-area-inset-bottom));background:rgba(0,0,0,.6)}
.ck-lb .btn{justify-content:center;padding:10px 6px;font-size:.88rem}.ck-lb .btn:not(.primary){background:rgba(255,255,255,.12);color:#fff;border-color:transparent}
.ck-sheet{position:absolute;inset:auto 0 0 0;max-height:62vh;overflow:auto;background:#fff;color:#111;border-radius:16px 16px 0 0;padding:12px;box-shadow:0 -10px 30px rgba(0,0,0,.4)}
.ck-sh-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.ck-sh-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:5px}
.ck-st{border:1px solid #ddd;border-radius:10px;padding:5px 8px;font-size:.85rem;display:flex;gap:6px;align-items:center;background:#f6f6f6;color:#777}
.ck-st i{font-style:normal;font-weight:800;background:#e5e5e5;border-radius:6px;padding:0 5px;color:#333}.ck-st.on{background:#eff6ff;border-color:#93c5fd;color:#1e3a8a}.ck-st.on.ok{background:#ecfdf5;border-color:#86efac;color:#14532d}.ck-st.on.no{background:#fef2f2;border-color:#fca5a5;color:#7f1d1d}
.ck-st b{margin-inline-start:auto}.ck-sh-o{display:flex;gap:6px;align-items:center;margin-top:10px;font-size:.88rem}
/* شاشة السبورة */
body.ck-boardb>header,body.ck-boardb>main,body.ck-boardb .bnr{display:none!important}
.ck-board{position:fixed;inset:0;background:linear-gradient(160deg,#0f3d3a,#0b2524);color:#fff;overflow:auto;z-index:100}
.ck-bw{max-width:1500px;margin:0 auto;padding:28px 36px;min-height:100%;display:flex;flex-direction:column;gap:22px;box-sizing:border-box}
.ck-bwait{margin:auto;text-align:center;opacity:.9}.ck-bwait .ck-bl{font-size:5rem}.ck-bwait h1{font-size:2.6rem;margin:6px 0}.ck-bwait p{font-size:1.3rem;opacity:.8}
.ck-btop{display:flex;justify-content:space-between;gap:16px;align-items:center;font-size:1.15rem;opacity:.9;flex-wrap:wrap}.ck-btop b{font-size:1.35rem}
.ck-bcnt{background:#16a34a;border-radius:999px;padding:4px 16px;font-weight:800}
.ck-bq{font-size:clamp(1.6rem,3.2vw,2.8rem);font-weight:800;line-height:1.6}
.ck-btab{border-collapse:collapse;font-size:1.3rem;background:rgba(255,255,255,.06)}.ck-btab td,.ck-btab th{border:1px solid rgba(255,255,255,.3);padding:6px 12px}.ck-btab caption{opacity:.8;margin-bottom:4px}
.ck-bch{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ck-bc{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.09);border:2px solid rgba(255,255,255,.12);border-radius:18px;padding:16px 18px;font-size:clamp(1.2rem,2.1vw,1.8rem);position:relative;overflow:hidden}
.ck-bc.ok{background:rgba(22,163,74,.35);border-color:#4ade80}.ck-bc.dim{opacity:.55}
.ck-bk{background:#fff;color:#0f3d3a;font-weight:900;border-radius:12px;min-width:2.1em;height:2.1em;display:grid;place-items:center;flex:none}
.ck-bt{flex:1}.ck-bp{position:absolute;inset:auto 0 0 0;height:100%;pointer-events:none}.ck-bp i{position:absolute;inset:0 auto 0 0;background:rgba(255,255,255,.12)}.ck-bp b{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:1.4em}
.ck-bst{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}.ck-bst span{background:rgba(255,255,255,.08);border-radius:10px;padding:4px 10px;font-size:1rem;opacity:.55;display:flex;gap:6px}
.ck-bst span i{font-style:normal;font-weight:800}.ck-bst span.on{background:#2563eb;opacity:1}
@media (max-width:700px){.ck-steps{grid-template-columns:1fr 1fr}.ck-row,.ck-mc{grid-template-columns:1fr}.ck-sum{grid-template-columns:1fr 1fr}.ck-bch{grid-template-columns:1fr}.ck-lb .btn{font-size:.8rem}}
/* طباعة البطاقات */
@media print{
  body.ck-printing #printArea{font-size:11pt}
  .ck-pp{page-break-after:always;break-after:page;display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:9mm;padding-top:9mm;box-sizing:border-box}
  .ck-pp4{padding-top:16mm;gap:8mm}
  .ck-pp:last-child{page-break-after:auto;break-after:auto}
  .ck-pp1,.ck-pp2{flex-direction:column;align-items:center;align-content:center;flex-wrap:nowrap}
  .ck-pc{border:0.3mm dashed #bbb;box-sizing:border-box;padding:0;break-inside:avoid}
  .ck-pc svg{width:100%;height:100%;display:block}
  .ck-ppl{display:block;padding:12mm 10mm 0}
  .ck-lt{width:100%;border-collapse:collapse}.ck-lt td,.ck-lt th{border:1px solid #000;padding:3px 8px;text-align:right}
  .ck-prr .ck-rt{font-size:10pt}.ck-prr .ck-rt th,.ck-prr .ck-rt td{border:1px solid #000;padding:3px 5px}
}
.sp-share{text-align:center}.sp-big{font-family:monospace;font-size:2.4rem;font-weight:800;letter-spacing:6px;color:var(--main-d)}.sp-qr svg{max-width:220px;height:auto}.sp-ls{display:grid;gap:4px;max-height:40vh;overflow:auto;text-align:right;margin-top:8px}
.st{max-width:760px;margin:0 auto;padding:0 12px 40px;font-size:17px}.st-top{display:flex;align-items:center;gap:10px;background:#2e2775;color:#fff;margin:0 -12px 14px;padding:12px 16px}.st-top div{flex:1;display:flex;flex-direction:column}.st-top small{opacity:.8;font-size:.8rem}.st-me{font-size:.85rem;opacity:.9}.st-back{background:#fff2;border:0;color:#fff;font-size:1.3rem;border-radius:10px;width:40px;height:40px;cursor:pointer}
.st-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;margin:10px 0}.st-join{max-width:420px;margin:40px auto;text-align:center;display:flex;flex-direction:column;gap:10px}.st-join input{font:inherit;font-size:1.2rem;text-align:center;border:2px solid var(--line);border-radius:12px;padding:10px}.st-logo{font-size:3rem}.st-err{color:#b42318}
.st-go{font:inherit;background:#4b40a9;color:#fff;border:0;border-radius:12px;padding:10px 16px;cursor:pointer;font-weight:700}.st-go.wide{width:100%;margin-top:6px}.st-go.ok{background:#22a35a}.st-go.half{background:#e39b1b}.st-go.no{background:#d64545}.st-link{background:none;border:0;color:#4b40a9;text-decoration:underline;cursor:pointer;font:inherit;font-size:.85rem}
.st-hello{margin:6px 0 10px}.st-unit h2{font-size:1rem;color:#2e2775;margin:16px 0 6px}.st-ls{display:grid;gap:6px}.st-l{display:flex;justify-content:space-between;gap:8px;text-align:right;font:inherit;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;cursor:pointer}.st-l em{font-style:normal;background:#eceafb;border-radius:999px;padding:0 10px;font-weight:700}
.st-title{font-size:1.3rem;color:#2e2775;margin:4px 0 10px}.st-tabs{display:flex;gap:6px;flex-wrap:wrap}.st-tabs button{font:inherit;border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 14px;cursor:pointer}.st-tabs button.on{background:#2e2775;color:#fff}
.st-sum h3{font-size:1rem;color:#2e2775;margin:14px 0 4px}.st-sum h3 span{background:#eceafb;border-radius:6px;padding:0 6px;font-size:.8rem}.st-sum li{margin:3px 0;line-height:1.8}.st-sum dt{font-weight:800;color:#4b40a9;margin-top:6px}.st-sum dd{margin:0 0 4px}.st-intro{background:#fbf0db;border-radius:10px;padding:8px 10px;line-height:1.8}
.st-prog{height:6px;background:#e1def3;border-radius:9px;overflow:hidden;margin:12px 0 0}.st-prog span{display:block;height:100%;background:#4b40a9}.st-qn{color:var(--mute);font-size:.85rem}.st-stem{font-weight:700;line-height:1.9}.st-ch{display:grid;gap:8px}.st-ch button{font:inherit;text-align:right;background:#f6f5fc;border:2px solid var(--line);border-radius:12px;padding:11px 14px;cursor:pointer}
.st-ch button.ok{background:#e5f6ec;border-color:#22a35a}.st-ch button.no{background:#fdecec;border-color:#d64545}.st-ch button.dim{opacity:.5}.st-fb{border-radius:12px;padding:10px 12px;margin:10px 0;line-height:1.8}.st-fb.ok{background:#e5f6ec}.st-fb.no{background:#fdecec}.st-fb.key{background:#eef3f1}.st-fb small{display:block;color:#3d554e;margin-top:4px}
.st-ans{width:100%;font:inherit;border:1px solid var(--line);border-radius:10px;padding:8px;margin:6px 0;box-sizing:border-box}.st-selfb,.st-nav{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:8px}.st-t{border-collapse:collapse;margin:6px auto}.st-t td,.st-t th{border:1px solid #999;padding:3px 8px}
.st-flip{background:#fff;border:2px solid #4b40a9;border-radius:18px;min-height:180px;display:grid;place-items:center;text-align:center;padding:20px;cursor:pointer;margin:12px 0}.st-flip b{font-size:1.4rem;color:#2e2775;display:block}.st-flip small{color:var(--mute)}.st-flip.on{background:#eceafb}.st-end{text-align:center}.st-big{font-size:3rem}.st-end h2{font-size:2.4rem;margin:0;color:#2e2775}
.ai-mini{font:inherit;font-size:.72rem;border:1px solid #e8890c;background:#fff8ea;color:#9a6700;border-radius:999px;padding:0 8px;cursor:pointer}.ai-opt{background:#fff8ea;border:1px dashed #e8890c;border-radius:10px;padding:8px 10px}.ai-opt small{font-weight:400}
.apk-help{text-align:right;line-height:1.8}
.apk-help ol{margin:8px 0;padding-inline-start:22px}
.apk-help li{margin:4px 0}
/* ---------- البحوث الإجرائية ---------- */
.rs-wrap{max-width:1000px;margin:18px auto;padding:0 16px}
.rs-new{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}.rs-tag{display:inline-block;background:#e8890c;color:#fff;border-radius:999px;padding:0 9px;font-size:12px;vertical-align:middle}.rs-card.mine{border-color:#e8890c}
.rs-form h3{margin:0 0 8px}.rsf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.rsf-grid .wide,.rsf.wide{grid-column:1/-1}.rsf{display:flex;flex-direction:column;gap:3px;font-size:.86rem;font-weight:700;color:var(--mute)}.rsf textarea{line-height:1.7;resize:vertical}
.rs-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}
.rs-tabs button{font:inherit;border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 16px;cursor:pointer;color:var(--ink,#2e2775)}
.rs-tabs button.on{background:#2e2775;color:#fff;border-color:#2e2775}
.rs-card{display:block;width:100%;text-align:right;font:inherit;background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:0 0 10px;cursor:pointer}
.rs-card:hover{border-color:#2e2775}
.rs-card h3{margin:0 0 6px;font-size:17px;color:#2e2775;line-height:1.6}
.rs-card p{margin:2px 0;color:#5b6b66;font-size:13.5px}
.rs-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}
.rs-doc{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px 26px;line-height:1.95;font-size:15.5px}
.rs-doc h1{font-size:22px;color:#2e2775;text-align:center;line-height:1.7;margin:0 0 6px}
.rs-doc .rs-by{text-align:center;color:#5b6b66;margin:0 0 14px}
.rs-doc h2{font-size:19px;color:#2e2775;border-bottom:2px solid #e2c27a;padding-bottom:4px;margin:26px 0 10px}
.rs-doc h3{font-size:16.5px;color:#2e2775;margin:18px 0 8px}
.rs-doc h4{font-size:15.5px;margin:14px 0 6px}
.rs-tw{overflow-x:auto}
.rs-t{border-collapse:collapse;width:100%;margin:8px 0 12px;font-size:14px}
.rs-t th,.rs-t td{border:1px solid #cfd8d4;padding:6px 8px;vertical-align:top}
.rs-t th{background:#eef4f1}
.rs-eq{background:#f6f5fc;border-radius:8px;padding:8px 12px;overflow-x:auto;font-size:14px}
.rs-empty{background:#fff;border:1px dashed var(--line);border-radius:16px;padding:28px;text-align:center;color:#5b6b66}
@media (max-width:640px){.rs-doc{padding:16px 14px;font-size:15px}}
/* ---------- لوحة التحكم الشاملة ---------- */
.top a.stat-link{text-decoration:none;cursor:pointer;transition:filter .15s,transform .15s}
.top a.stat-link:hover{filter:brightness(.95);transform:translateY(-1px)}
.vault-lock{max-width:380px;margin:48px auto;background:#fff;border:1px solid #e1def3;border-radius:18px;padding:28px 24px;text-align:center;display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 28px rgba(11,59,51,.08)}
.vault-lock .vl-ico{font-size:40px}
.vault-lock h2{margin:0;color:#2e2775}
.vault-lock p{margin:0;color:#5b6b66}
.vault-lock input{font:inherit;font-size:20px;text-align:center;letter-spacing:.3em;padding:12px;border:1px solid #cfd8d4;border-radius:12px;direction:ltr}
.vault-lock .vl-back{color:#2e2775;font-size:14px}
.acts .vault-btn{font-size:1.15rem;line-height:1;padding-inline:12px;background:#2e2775;color:#fff;border-color:#2e2775}
.acts .vault-btn:hover{background:#e8890c;border-color:#e8890c}
body.vault-mode .stats .stat{background:#2e2775;color:#ffd400;border-color:#2e2775}
body.vault-mode .dash .tabs .tab.on{background:#2e2775;color:#fff}
/* ---------- شعار المادة المتحرك (الترحيب) ---------- */
.morph{position:relative;width:min(300px,72vw);aspect-ratio:4/3;margin:0 auto 6px}
.morph .mz{position:absolute;inset:0;opacity:0;transform:scale(.45) rotate(-16deg);transition:opacity .26s ease,transform .42s cubic-bezier(.2,1.45,.4,1);pointer-events:none}
.morph .mz.on{opacity:1;transform:none}
.morph .mz svg,.morph .mz .cell-art{width:100%!important;height:100%!important;margin:0;animation:none}
.morph .mz.final{animation:mzLand .9s cubic-bezier(.2,1.6,.4,1)}
.morph.done .mz.final svg{animation:mzFloat 3.2s ease-in-out .9s infinite alternate!important}
@keyframes mzLand{0%{transform:scale(.3) rotate(25deg)}60%{transform:scale(1.12) rotate(-4deg)}100%{transform:none}}
@keyframes mzFloat{to{transform:translateY(-7px) scale(1.02)}}
.morph .mz-ring{position:absolute;inset:8%;border-radius:50%;border:4px solid var(--main,#4b40a9);opacity:0;pointer-events:none}
.morph.done .mz-ring{animation:mzRing 1s ease-out .15s}
@keyframes mzRing{0%{opacity:.7;transform:scale(.6)}100%{opacity:0;transform:scale(1.35)}}
/* الخلية حيّة: غشاء يتموج، ميتوكوندريا تنجرف، نواة تنبض */
.morph .c-mem{transform-box:fill-box;transform-origin:center;animation:mzMem 2.2s ease-in-out infinite alternate}
@keyframes mzMem{0%{transform:scale(1,1)}50%{transform:scale(1.03,.97)}100%{transform:scale(.97,1.03)}}
.morph .c-nuc,.morph .c-nucl{transform-box:fill-box;transform-origin:center;animation:mzPulse 1.4s ease-in-out infinite alternate}
@keyframes mzPulse{to{transform:scale(1.08)}}
.morph .c-mito{animation:mzDrift 2.6s ease-in-out infinite alternate}.morph .c-mito+.c-mito{animation-delay:-1.3s}
@keyframes mzDrift{to{translate:6px -4px}}
.morph .c-ves{animation:mzVes 1.8s ease-in-out infinite alternate}@keyframes mzVes{to{translate:-5px 5px}}
.morph .mz-bub circle{animation:mzBub 1.4s ease-in infinite}.morph .mz-bub circle:nth-child(2){animation-delay:.45s}.morph .mz-bub circle:nth-child(3){animation-delay:.9s}
@keyframes mzBub{0%{transform:translateY(0);opacity:.9}100%{transform:translateY(-70px);opacity:0}}
.morph .mz-orb{transform-origin:120px 90px;animation:mzSpin 2.2s linear infinite}.morph .mz-orb.o2{animation-duration:3s;animation-direction:reverse}
@keyframes mzSpin{to{transform:rotate(360deg)}}
.morph .mz-spark{transform-origin:60px 68px;animation:mzTw 1s ease-in-out infinite alternate}@keyframes mzTw{to{transform:scale(.5) rotate(45deg)}}
.morph .mz-leaf{transform-origin:170px 70px;animation:mzLeaf 1.6s ease-in-out infinite alternate}@keyframes mzLeaf{to{transform:rotate(-12deg)}}
.morph .mz-cur{animation:mzBlink .8s steps(2) infinite}@keyframes mzBlink{50%{opacity:0}}
.morph .mz-comp{transform-origin:178px 40px;animation:mzLeaf 1.4s ease-in-out infinite alternate}
.mz-tag{display:inline-block;margin:0 auto 8px;padding:4px 16px;border-radius:999px;background:var(--main-l,#eceafb);color:var(--main-d,#2e2775);font-weight:700;opacity:0;transform:translateY(6px);transition:opacity .4s .3s,transform .4s .3s}
.mz-tag.on{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.morph *{animation:none!important;transition:none!important}}
/* ---------- الساحة: ألعاب الحركة بملء الشاشة ---------- */
body.g-arena{overflow:hidden}
.g-stage.arena{position:fixed;inset:0;z-index:9000;border-radius:0;border:0;min-height:0;overflow:hidden;padding:8px 14px 12px;gap:6px;background:radial-gradient(1400px 500px at 50% -10%,#e6f5ef,transparent 70%),#f7f9fb}
.g-stage.arena .g-bar{padding:2px 0}.g-stage.arena .g-score:empty{display:none}
.g-stage.arena .gm-body{flex:1;min-height:0;display:flex;flex-direction:column;padding:0}
.g-stage.arena .tug,.g-stage.arena .arc-rk,.g-stage.arena .rn,.g-stage.arena .bn-wrap{flex:1;min-height:0}
.g-stage.arena .tug{grid-template-columns:minmax(250px,1fr) minmax(0,1.9fr) minmax(250px,1fr);padding:0;height:100%}
.g-stage.arena .tug-p{min-height:0;height:100%;overflow:auto}
.g-stage.arena .tug-q{font-size:clamp(1rem,1.5vw,1.45rem);min-height:0}
.g-stage.arena .tug-ch{grid-template-columns:1fr;gap:10px}
.g-stage.arena .tug-b{min-height:clamp(52px,7.5vh,84px);font-size:clamp(.98rem,1.25vw,1.3rem);word-break:normal;overflow-wrap:anywhere}
.g-stage.arena .tug-mid{min-height:0;justify-content:center}
.g-stage.arena .tug-svg,.g-stage.arena .tug-mid .arc-svg{max-height:62vh;width:100%;height:auto}
.g-stage.arena .tug-crowd{font-size:clamp(1.4rem,2.4vw,2.2rem)}
.g-stage.arena .tug-meter{height:16px}
.g-stage.arena .bl-board{font-size:clamp(1.1rem,1.8vw,1.8rem)}
/* الصواريخ: المشهد في الأعلى ولوحات اللاعبين أسفله */
.g-stage.arena .arc-rk{display:flex;flex-direction:column;gap:8px}
.g-stage.arena .rk-top{flex:1 1 52%;min-height:0;display:flex}
.g-stage.arena .rk-top .arc-svg{width:100%;height:100%;max-height:none}
.g-stage.arena .rk-panels{flex:0 1 48%;min-height:0}
.g-stage.arena .rk-panels .tug-p{height:100%;overflow:auto;padding:8px;gap:6px}
.g-stage.arena .rk-panels .tug-q{font-size:clamp(.95rem,1.2vw,1.2rem);padding:8px 10px}
.g-stage.arena .rk-panels .tug-ch{grid-template-columns:1fr 1fr;gap:6px}
.g-stage.arena .rk-panels .tug-b{min-height:44px;font-size:clamp(.88rem,1.05vw,1.1rem);padding:6px 8px}
.g-stage.arena .rk-n2 .tug-ch{grid-template-columns:1fr 1fr}
/* العدّاء */
.g-stage.arena .rn{display:flex;flex-direction:column;gap:8px}
.g-stage.arena .rn-view{flex:1;min-height:0;background:#0b1f2a}
.g-stage.arena .rn-view canvas{width:100%;height:100%;display:block}
.g-stage.arena .rn-qt{font-size:clamp(1.15rem,1.9vw,1.9rem)}
.g-stage.arena .rn-b{font-size:clamp(1rem,1.4vw,1.45rem)}
/* البالونات */
.g-stage.arena .bn-wrap{display:flex;flex-direction:column;gap:8px}
.g-stage.arena .bn-sky{flex:1;min-height:0}
.g-stage.arena .bn{width:clamp(110px,14vw,210px)}
.g-stage.arena .bn-q{font-size:clamp(1.1rem,1.7vw,1.8rem)}
@media (max-width:900px){.g-stage.arena{overflow:auto}.g-stage.arena .tug{grid-template-columns:1fr 1fr;height:auto}.g-stage.arena .tug-mid{grid-column:1/-1;order:-1}.g-stage.arena .tug-p{height:auto}}
/* شخصيات شدّ الحبل */
.tug-svg .tg-cloud{animation:tgCloud 14s linear infinite alternate}.tug-svg .tg-cloud.c2{animation-duration:18s}@keyframes tgCloud{to{transform:translateX(60px)}}
.tug-team .tf{transform-box:fill-box;transform-origin:50% 100%}
.tug-team:not(.heave):not(.fall):not(.cheer) .tf{animation:tugStrain .55s ease-in-out infinite alternate}.tug-team .tf1{animation-delay:.2s!important}
@keyframes tugStrain{from{transform:rotate(0)}to{transform:rotate(3deg) translateX(2px)}}
.tug-team.heave .tf{animation:tugHeave2 .45s ease}@keyframes tugHeave2{45%{transform:rotate(11deg) translateX(8px)}}
.tug-team.fall .tf{animation:tugFall2 .9s cubic-bezier(.5,0,.8,.6) forwards}@keyframes tugFall2{to{transform:rotate(-78deg) translateY(6px)}}
.tug-team.cheer .tf{animation:tugJump2 .45s ease-in-out infinite alternate}@keyframes tugJump2{from{transform:translateY(0) rotate(0)}to{transform:translateY(-28px) rotate(-4deg)}}
/* لاعبو كرة القدم: جري متواصل وركلة */
.bl-pl .bl-leg,.bl-pl .bl-leg2,.bl-pl .bl-arm,.bl-pl .bl-arm2{transform-box:view-box}
.bl-pl .bl-leg{transform-origin:-4px -40px;animation:blStride .5s ease-in-out infinite alternate}
.bl-pl .bl-leg2{transform-origin:4px -40px;animation:blStride .5s ease-in-out infinite alternate-reverse}
.bl-pl .bl-arm{transform-origin:-6px -70px;animation:blStride .5s ease-in-out infinite alternate-reverse}
.bl-pl .bl-arm2{transform-origin:8px -70px;animation:blStride .5s ease-in-out infinite alternate}
.bl-pl .bl-run{animation:blBob .25s ease-in-out infinite alternate}
@keyframes blStride{from{transform:rotate(-22deg)}to{transform:rotate(22deg)}}
@keyframes blBob{to{transform:translateY(-3px)}}
.bl-pl.kick .bl-leg{animation:blKick3 .45s ease-out}@keyframes blKick3{0%{transform:rotate(30deg)}45%{transform:rotate(-70deg)}100%{transform:rotate(0)}}
@media (prefers-reduced-motion:reduce){.tug *{animation:none!important;transition:none!important}}
/* ---------- «أستطيع أن ✓» ---------- */
.cd-layout .u-btn.cd-u{width:100%;margin:2px 0}
.cd-layout .u-btn.cd-u.active{background:var(--main-l,#eceafb);border-color:var(--main,#4b40a9);color:var(--main-d,#2e2775)}
.cd-all{display:block;width:calc(100% - 8px);margin:8px 4px 4px;font:inherit;font-size:.82rem;font-weight:700;color:var(--main-d,#2e2775);background:var(--bg);border:1px dashed var(--line);border-radius:10px;padding:8px;cursor:pointer}
.cd-all:hover{border-color:var(--main,#4b40a9);background:var(--main-l,#eceafb)}
.cd-welcome{text-align:center}.cd-big{font-size:3rem;line-height:1;color:#1b8f9a;font-weight:900;margin-bottom:6px}
.cd-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:10px;margin-bottom:6px}
.cd-head h2{margin:2px 0 0;font-size:1.25rem}.cd-crumb{font-size:.8rem;color:var(--mute);font-weight:700}
.cd-tools{display:flex;flex-wrap:wrap;gap:6px}
.cd-hint{font-size:.82rem;color:var(--mute);background:var(--accent-l,#fbf0db);border-radius:10px;padding:6px 10px;margin:6px 0 12px}
.cd-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.cd-wrap{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:var(--shadow)}
.cd-wrap .cd-sheet{min-width:660px}
.cd-c{cursor:pointer;user-select:none;transition:background .12s}
.cd-c:hover{background:#eaf6f7!important}.cd-c.on{background:#d9f0f2!important}
.cd-c:focus-visible{outline:3px solid #e8890c;outline-offset:-3px}
.cd-nav{display:flex;justify-content:space-between;gap:8px;margin-top:14px}
#printArea .cd-sheet{font-size:12pt;font-family:"IBM Plex Sans Arabic","Simplified Arabic",Tahoma,sans-serif}
#printArea .ppage{page-break-after:always}#printArea .ppage:last-child{page-break-after:auto}
#printArea .cd-sheet tr{page-break-inside:avoid}
@media print{body.printing #printArea .cd-sheet td,body.printing #printArea .cd-sheet th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
'''
extra_css += '''
/* ---------- header nav: essentials + menu ---------- */
.whobar .btn[aria-current]{background:rgba(255,255,255,.26);border-color:rgba(255,255,255,.7)}
.whobar a.btn{text-decoration:none}
.navmenu{position:relative}
.menu-btn{background:#fff;color:#2e2775;border-color:#fff;font-weight:700}
.menu-btn:hover{background:#eceafb}
.menu-list{position:fixed;z-index:80;min-width:250px;background:var(--paper,#fff);color:var(--ink,#1e1a4d);border:1px solid var(--line);border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.22);padding:6px;display:grid;gap:2px}
.menu-list[hidden]{display:none}
.menu-list{overflow-y:auto;overscroll-behavior:contain;max-height:calc(100vh - 80px)}
@media (min-width:701px){.menu-list{grid-template-columns:1fr 1fr;min-width:520px;column-gap:4px}.menu-list hr{grid-column:1/-1}.menu-list #logoutBtn{grid-column:1/-1}}
.menu-list a,.menu-list button{display:flex;align-items:center;gap:10px;width:100%;text-align:start;font:inherit;font-size:.92rem;font-weight:600;color:inherit;text-decoration:none;background:none;border:0;border-radius:10px;padding:9px 12px;cursor:pointer}
.menu-list a:hover,.menu-list button:hover,.menu-list a[aria-current]{background:var(--main-l,#eceafb);color:var(--main-d,#2e2775)}
.menu-list .mi{width:22px;text-align:center}
.menu-list hr{border:0;border-top:1px solid var(--line);margin:4px 2px}
.menu-list #logoutBtn{color:var(--danger,#b23a2b)}
.bell-btn{position:relative}
.bell-ic{display:inline-block}
.bell-dot{position:absolute;top:-4px;inset-inline-start:-4px;min-width:17px;height:17px;border-radius:999px;background:#e03131;color:#fff;font-size:10.5px;font-weight:700;display:grid;place-items:center;padding:0 4px;box-shadow:0 0 0 2px var(--paper,#fff)}
/* إضاءة الجرس: لهب حول الزر + اهتزاز الجرس نفسه فيتعرّف المعلم من بعيد أن إعلانًا جديدًا
   وصل، وتنطفئ الإضاءة فور فتح اللوحة (aria-expanded) أو تعليمها مقروءة. */
@keyframes bellGlow{0%,100%{box-shadow:0 0 0 0 rgba(224,49,49,.45)}50%{box-shadow:0 0 0 9px rgba(224,49,49,0)}}
@keyframes bellShake{0%,100%{transform:rotate(0)}15%{transform:rotate(14deg)}30%{transform:rotate(-11deg)}45%{transform:rotate(7deg)}60%{transform:rotate(-5deg)}75%{transform:rotate(2deg)}}
.bell-btn.unread{color:#c92a2a;font-weight:700;border-color:rgba(224,49,49,.6);animation:bellGlow 2.2s ease-in-out infinite}
.bell-btn.unread .bell-ic{transform-origin:50% 0;animation:bellShake 2.2s ease-in-out infinite}
.bell-btn[aria-expanded="true"]{animation:none;box-shadow:none}
.bell-btn[aria-expanded="true"] .bell-ic{animation:none}
.bell-panel{min-width:300px;max-width:360px;display:block}
.bp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--paper,#fff);z-index:1}
.bp-all{font:inherit;font-size:.78rem;font-weight:700;border:0;background:none;color:var(--main-d,#2e2775);cursor:pointer;padding:0}
.bp-all:hover{text-decoration:underline}
.bp-list{list-style:none;margin:0;padding:0}
.bp-it{padding:10px 12px;border-bottom:1px solid var(--line);font-size:.86rem;line-height:1.6}
.bp-it:last-child{border-bottom:0}
.bp-it.read{opacity:.62}
.bp-t{font-weight:700;display:flex;align-items:center;gap:6px}
.bp-ndot{flex:none;width:8px;height:8px;border-radius:50%;background:#e0861a}
.bp-b{margin:3px 0;color:var(--mute,#5d7168);overflow-wrap:anywhere}
.bp-link{font-weight:700;font-size:.8rem}
.bp-ok{padding:4px 10px !important}
.bp-read{font-size:.75rem;font-weight:700;color:var(--mute,#5d7168)}
.bp-date{display:block;font-size:.72rem;color:var(--mute,#5d7168);margin-top:2px}
.bp-empty{margin:0;padding:18px 12px;text-align:center;color:var(--mute,#5d7168);font-size:.86rem}
.modal.locked{backdrop-filter:blur(3px)}
/* ---------- grading page ---------- */
.gr{padding-block:22px 60px;display:grid;gap:14px}
.gr-card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:var(--shadow)}
.gr-card h3{margin:0 0 6px;font-size:1rem;color:var(--main-d)}
.gr-steps{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0;padding:0;list-style:none;font-size:.82rem}
.gr-steps li{background:var(--main-l);border-radius:999px;padding:4px 10px}
.gr-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.gr-row .qsel{width:auto;min-width:220px}
.gr-tasks{width:100%;border-collapse:collapse;font-size:.9rem}
.gr-tasks th,.gr-tasks td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:start}
.gr-tasks th{font-size:.78rem;color:var(--mute);font-weight:700}
.gr-done{display:inline-block;margin-inline-start:6px;background:#e3f4ec;color:#0e6b4f;border:1px solid #9fd8c0;border-radius:999px;padding:0 9px;font-size:.75rem;font-weight:700;white-space:nowrap}
.gr-tasks td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.gr-note{font-size:.82rem;background:var(--accent-l,#fff8e6);border-radius:10px;padding:8px 12px}
.gr-empty{color:var(--mute);text-align:center;padding:18px}
/* تبويبات تثبيت الأداة حسب المتصفح */
.tt-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line,#e1def3)}
.tt-tab{font:inherit;font-size:.82rem;font-weight:700;padding:7px 12px;border:1px solid var(--line,#e1def3);background:var(--paper,#fff);color:var(--mute,#625e8a);border-radius:999px;cursor:pointer;transition:all .12s}
.tt-tab:hover{border-color:var(--main,#4b40a9);color:var(--main,#4b40a9)}
.tt-tab.on{background:var(--main,#4b40a9);border-color:var(--main,#4b40a9);color:#fff}
.tt-pane{display:none}
.tt-pane.on{display:block}
/* دليل آيفون المصوّر: خطوات بأسهم تشير على ما يُضغط */
.iosg{display:flex;flex-direction:column;gap:9px;margin:10px 0 6px}
.iosg-step{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line,#e1def3);border-radius:13px;padding:10px 12px;background:linear-gradient(180deg,#fbfdfc,#f4faf7)}
.iosg-n{flex:0 0 auto;width:24px;height:24px;border-radius:50%;background:var(--main,#4b40a9);color:#fff;font-weight:800;font-size:.8rem;display:flex;align-items:center;justify-content:center}
.iosg-b{flex:1;min-width:0}
.iosg-t{font-weight:700;font-size:.85rem;color:var(--main-d,#2e2775);margin-bottom:7px}
.iosg-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:5px}
.iosg-el{font-size:.76rem;padding:5px 9px;border-radius:8px;background:#eef3f1;color:#374b45;border:1px solid #dfe9e5;white-space:nowrap}
.iosg-a{color:var(--mute,#625e8a);font-size:.8rem;font-weight:700}
.iosg-el.iosg-tap{background:var(--main,#4b40a9);border-color:var(--main,#4b40a9);color:#fff;font-weight:800;position:relative;padding-inline-end:22px}
.iosg-el.iosg-tap:after{content:'←';position:absolute;inset-inline-end:5px;top:50%;transform:translateY(-50%);font-size:.95rem;animation:iosgArrow .9s ease-in-out infinite}
@keyframes iosgArrow{0%,100%{transform:translateY(-50%) translateX(0);opacity:1}50%{transform:translateY(-50%) translateX(-4px);opacity:.6}}
.iosg-l{margin-top:4px}
/* ---------- مشغّل «عرض خطوات التثبيت» التفاعلي (الآيفون) ---------- */
/* بديل كامل عن الفيديو: يشتغل على أي جهاز، بلا استضافة ولا يوتيوب، ويبقى متزامنًا
   مع نص المرشد لأنه من نفس كود المنصة. تقديمًا تلقائي مع تشغيل/إيقاف وتنقل يدوي. */
.tv-ov{position:fixed;inset:0;z-index:120;background:rgba(8,24,18,.74);display:grid;place-items:center;padding:14px}
.tv-card{width:min(480px,100%);max-height:min(88vh,760px);overflow-y:auto;overscroll-behavior:contain;background:var(--paper,#fff);color:var(--ink,#1e1a4d);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.45);padding:0 0 10px}
.tv-bar{display:flex;align-items:center;gap:8px;padding:12px 14px 8px}
.tv-bar b{flex:1;font-size:.95rem;line-height:1.5}
.tv-x{flex:none;border:0;background:#eef3f1;width:30px;height:30px;border-radius:50%;font-size:15px;cursor:pointer;color:#374b45}
.tv-stage{padding:10px 14px 4px;border-top:1px solid var(--line);min-height:190px}
.tv-foot{display:flex;align-items:center;gap:8px;padding:10px 14px 0}
.tv-btn{flex:none;border:0;background:#eef3f1;border-radius:50%;width:34px;height:34px;font-size:14px;cursor:pointer;color:#374b45;font-family:inherit}
.tv-btn.pri{background:var(--main,#4b40a9);color:#fff;font-weight:800}
.tv-prog{flex:1;height:5px;border-radius:99px;background:#e8e6df;overflow:hidden}
.tv-fill{display:block;height:100%;width:0;background:var(--main,#4b40a9);transition:width .25s linear}
.tv-n{font-size:.76rem;color:var(--mute,#625e8a);text-align:center;padding-top:7px}
.tos-n{font-size:.78rem;color:var(--mute,#625e8a);margin-top:4px;line-height:1.6}
.iosg-l a{font-size:.78rem;font-weight:700;color:var(--main,#4b40a9)}
@media(prefers-reduced-motion:reduce){.iosg-el.iosg-tap:after{animation:none}}
@media(max-width:640px){.iosg-el{font-size:.72rem;padding:4px 7px}.iosg-el.iosg-tap{padding-inline-end:20px}}
.lp-l.lp-off{opacity:.45;cursor:not-allowed}
.lp-l.lp-off .muted{font-size:.72rem;color:#a15c00}
.g-none{max-width:560px;margin:40px auto;text-align:center;padding:26px 20px;background:var(--paper,#fff);border:1px dashed var(--line,#e1def3);border-radius:16px}
.g-none-ic{font-size:2.6rem;margin-bottom:6px}
.g-none h2{margin:4px 0 10px;font-size:1.15rem;color:var(--main-d,#2e2775)}
.g-none p{margin:0 0 8px;color:var(--mute,#625e8a);font-size:.88rem;line-height:1.7}
/* ---------- العروض التقديمية ---------- */
.wrap.sl{max-width:980px;padding:14px 16px 40px}
.sl-subj{margin-bottom:22px}
.sl-subj-h{display:flex;align-items:center;gap:8px;font-size:1.18rem;margin:0 0 10px;color:var(--main-d,#2e2775)}
.sl-subj-h .mi{font-size:1.3em}
.sl-grade{margin-bottom:14px}
.sl-grade-h{font-weight:800;font-size:.95rem;color:var(--main,#4b40a9);margin-bottom:8px;border-inline-start:4px solid var(--main,#4b40a9);padding-inline-start:8px}
.sl-grid{display:flex;flex-direction:column;gap:5px}
.sl-card{display:flex;flex-direction:row;align-items:center;gap:9px;text-align:start;font:inherit;background:var(--paper,#fff);border:1px solid var(--line,#e1def3);border-radius:9px;padding:8px 11px;cursor:pointer;transition:border-color .12s,background .12s}
.sl-card:hover{border-color:var(--main,#4b40a9);background:var(--main-l,#eceafb)}
.sl-card-ic{font-size:1.05em;flex:0 0 auto}
.sl-card-t{font-weight:600;font-size:.87rem;color:var(--ink,#1e1a4d);flex:1 1 auto;line-height:1.4}
.sl-card-m{font-size:.72rem;color:var(--mute,#625e8a);flex:0 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:32%}
.sl-card-go{font-size:.74rem;color:var(--main,#4b40a9);font-weight:700;flex:0 0 auto}
.sl-prev-head b{flex:1;min-width:140px;font-size:1rem}
.sl-frame{border:1px solid var(--line,#e1def3);border-radius:10px;overflow:hidden;background:#f4f4f4}
.sl-frame iframe{width:100%;height:62vh;border:0;display:block}
.modal-box.wide{max-width:min(980px,94vw)}
@media(max-width:640px){.sl-card-m{display:none}.sl-frame iframe{height:48vh}}
/* ---------- study pages ---------- */
.edit-hint{font-size:.82rem;color:var(--mute);background:var(--accent-l,#fff8e6);border-radius:10px;padding:6px 12px;margin-bottom:8px}
.study-paper{outline:none;font-size:15px}
.study-paper:focus{box-shadow:0 0 0 3px #b9d8cf,0 2px 14px rgba(0,0,0,.18)}
.study-paper .cb{user-select:none;font-size:1.1em}

/* ===== مصحّح الاختبار القصير (صفحة التقويم) ===== */
.chkpanel{margin:18px auto 40px;padding:18px 20px;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:0 2px 14px rgba(16,40,32,.05)}
.chk-h{margin:0 0 6px;font-size:1.15rem}
.chk-p{margin:0 0 14px;color:var(--mute);font-size:.92rem;line-height:1.7}
.chk-drop{border:2px dashed #9fc6b8;border-radius:14px;padding:18px;text-align:center;cursor:pointer;background:#f4faf7;transition:.15s}
.chk-drop:hover,.chk-drop.over,.chk-drop:focus{background:#e8f5ef;border-color:var(--main);outline:none}
.chk-ic{font-size:1.8rem;line-height:1}
.chk-link{color:var(--main);font-weight:700;text-decoration:underline}
.chk-hint{margin-top:4px;font-size:.8rem;color:var(--mute)}.chk-drop.has{background:#e6f6ee;border-color:#1e8a63;border-style:solid}
.chk-ok{display:flex;align-items:center;gap:10px;margin:10px 0 0;padding:11px 14px;background:#e6f6ee;border:2px solid #1e8a63;border-radius:12px;color:#0b5c42;font-weight:700;font-size:.94rem}
.chk-ok-ic{width:26px;height:26px;border-radius:50%;background:#1e8a63;color:#fff;display:grid;place-items:center;font-size:.85rem;flex:0 0 auto}
.chk-ok>span:nth-child(2){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chk-ok-x{border:0;background:#0b5c42;color:#fff;border-radius:9px;padding:6px 11px;cursor:pointer;font:inherit;font-size:.8rem;font-weight:700;flex:0 0 auto}
.chk-ok-x:hover{background:#083f2c}
.chk-grid{display:flex;gap:12px;margin:14px 0;flex-wrap:wrap;align-items:flex-start}
.chk-lb{display:flex;flex-direction:column;gap:5px;font-size:.86rem;font-weight:700;color:#224}
.chk-grow{flex:1;min-width:240px}
.chk-lb select,.chk-lb textarea{font:inherit;font-weight:400;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:#fff}
.chk-lb textarea{resize:vertical;line-height:1.9}
.chk-lbl-t{font-size:.84rem;color:#224;font-weight:700}.chk-grades{display:flex;flex-wrap:wrap;gap:6px}.chk-grades label{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid var(--line);border-radius:999px;font-size:.84rem;font-weight:600;cursor:pointer;background:#fff}.chk-grades input{margin:0;accent-color:var(--main)}.chk-grades label:has(input:checked){background:var(--main);color:#fff;border-color:var(--main)}
.chk-cb{display:flex;gap:9px;align-items:flex-start;margin:4px 0 12px;padding:10px 12px;background:#f2f8f5;border:1px solid #cfe5da;border-radius:11px;font-size:.88rem;cursor:pointer;line-height:1.6}
.chk-cb input{margin-top:3px;width:18px;height:18px;accent-color:var(--main);flex:0 0 auto}
.chk-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.chk-stat{font-size:.84rem;color:var(--mute)}
.chk-out{margin-top:14px}
.chk-note{background:#fff7e6;border:1px solid #f0c26a;border-radius:12px;padding:13px 15px;color:#7a4a09;font-size:.92rem;line-height:1.9}
.chk-err{color:#9b1c1c;background:#fdeaea;border:1px solid #f3c7c7;border-radius:10px;padding:10px 12px;font-size:.9rem}
.chk-res{display:flex;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;margin-bottom:12px;font-size:.9rem}
.chk-res.ok{background:#e8f6ef;border:1px solid #b9e0cd;color:#0b5c42}
.chk-res.bad{background:#fdf0e6;border:1px solid #f2cfae;color:#8a4a12}
.chk-sum{background:#fff;border-radius:9px;padding:6px 12px;font-weight:700}
.chk-num{font-size:1.15rem;color:var(--main-d)}
.chk-list{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.chk-it{display:flex;gap:9px;align-items:flex-start;padding:8px 11px;border-radius:10px;background:#fbfbf8;border:1px solid var(--line);font-size:.9rem}
.chk-ic{flex:0 0 22px;height:22px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:.8rem;color:#fff;background:#7a8}
.chk-pass .chk-ic{background:#138a63}
.chk-warn .chk-ic{background:#c98a12}
.chk-fail .chk-ic{background:#b32d2d}
.chk-skip .chk-ic{background:#8b98a3}
.chk-tx{display:flex;flex-direction:column;gap:2px}
.chk-dt{color:var(--mute);font-size:.82rem}
.chk-tbl{margin-top:12px}
.chk-tbl summary{cursor:pointer;font-weight:700;font-size:.88rem;color:var(--main-d);padding:6px 0}
.chk-tbl table{width:100%;border-collapse:collapse;font-size:.83rem;margin-top:8px}
.chk-tbl th,.chk-tbl td{border:1px solid var(--line);padding:5px 8px;text-align:right;vertical-align:top}
.chk-tbl th{background:#eef5f1}
.chk-q{font-size:.8rem;color:#333;line-height:1.6}
@media (max-width:700px){.menu-list{top:auto!important;bottom:0;left:0!important;right:0!important;margin:6px!important;max-height:78vh;border-radius:16px}}
'''
extra_css += '''
/* ---------- دُرج «خبير»: زر همبرغر (٣ شرط) + قائمة جانبية منزلقة ---------- */
.top .menu-btn{background:linear-gradient(135deg,var(--main-d),var(--main) 60%,#6a5fd0);color:#fff;border-color:transparent;font-weight:800;display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;box-shadow:0 6px 18px rgba(75,64,169,.35)}
.top .menu-btn:hover{background:linear-gradient(135deg,var(--main),#6a5fd0);color:#fff}
.menu-btn .hb{display:inline-flex;flex-direction:column;gap:4px;width:18px}
.menu-btn .hb span{display:block;height:2px;border-radius:2px;background:#fff;transition:transform .3s,opacity .2s}
.menu-btn[aria-expanded="true"] .hb span:nth-child(1){transform:translateY(6px) rotate(45deg)}
.menu-btn[aria-expanded="true"] .hb span:nth-child(2){opacity:0}
.menu-btn[aria-expanded="true"] .hb span:nth-child(3){transform:translateY(-6px) rotate(-45deg)}
#menuList .menu-head{display:flex;align-items:center;gap:12px;padding:18px;background:linear-gradient(135deg,var(--main-d),var(--main) 60%,#6a5fd0);color:#fff;border-radius:0 0 22px 22px;margin-bottom:8px}
#menuList .mh-mark{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25)}
#menuList .mh-mark .kb-logo{width:38px;height:auto}
#menuList .menu-head b{display:block;font-size:1.3rem;line-height:1.2}
#menuList .menu-head small{opacity:.88;font-size:.8rem;font-weight:600}
#menuList a,#menuList button{position:relative;overflow:hidden;margin:4px 12px;width:auto;padding:11px 12px;border-radius:14px;transition:transform .18s,background .18s,box-shadow .18s}
#menuList a::before,#menuList button::before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:4px;background:linear-gradient(var(--main),#6a5fd0);opacity:0;transition:opacity .18s}
#menuList a:hover,#menuList button:hover,#menuList a[aria-current]{background:var(--main-l);color:var(--main-d);transform:translateX(-4px);box-shadow:0 8px 20px rgba(75,64,169,.14)}
#menuList a:hover::before,#menuList button:hover::before,#menuList a[aria-current]::before{opacity:1}
#menuList .mi{flex:none;width:44px;height:44px;border-radius:13px;background:var(--main-l);display:grid;place-items:center;font-size:1.3rem;transition:transform .2s,background .2s,box-shadow .2s}
#menuList a:hover .mi,#menuList button:hover .mi{background:linear-gradient(135deg,var(--main),#6a5fd0);transform:scale(1.08) rotate(-4deg);box-shadow:0 6px 16px rgba(75,64,169,.35)}
#menuList .mt{display:flex;flex-direction:column;gap:1px;min-width:0}
#menuList .mt b{font-size:.95rem;line-height:1.35}
#menuList .mt small{color:var(--mute);font-size:.74rem;font-weight:500;line-height:1.45}
#menuList .ma{margin-inline-start:auto;font-size:1.3rem;color:var(--main);opacity:0;transform:translateX(6px);transition:opacity .18s,transform .18s}
#menuList a:hover .ma,#menuList button:hover .ma{opacity:1;transform:translateX(0)}
#menuList hr{margin:8px 16px}
@media (min-width:701px){
  #menuList{position:fixed;inset-block:0!important;inset-inline-end:0!important;inset-inline-start:auto!important;top:0!important;bottom:0!important;left:auto!important;right:0!important;width:min(380px,92vw);height:100dvh;max-height:none!important;margin:0!important;border:0;border-inline-start:1px solid var(--line);border-radius:0;grid-template-columns:1fr;min-width:0;padding:0 0 18px}
  #menuList:not([hidden]){animation:drawerIn .38s cubic-bezier(.2,.9,.25,1) both;box-shadow:0 0 0 100vmax rgba(30,26,77,.45),-24px 0 60px rgba(46,39,117,.28)}
  #menuList:not([hidden]) a,#menuList:not([hidden]) button{animation:itemIn .4s cubic-bezier(.2,.9,.3,1) backwards;animation-delay:calc(.06s + var(--i,0)*.035s)}
}
@media (max-width:700px){
  #menuList:not([hidden]){animation:sheetIn .3s ease-out both}
  #menuList .menu-head{border-radius:16px 16px 0 0;margin:-6px -6px 8px}
}
@keyframes drawerIn{from{transform:translateX(100%);opacity:.6}to{transform:translateX(0);opacity:1}}
@keyframes sheetIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes itemIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion:reduce){#menuList:not([hidden]),#menuList:not([hidden]) a,#menuList:not([hidden]) button{animation:none!important}}
'''
# ===== صفحة البداية «خبير» (khome): عُقد أقسام =====
extra_css += '''
/* ===== صفحة البداية: عقد الأقسام بهوية خبير (كريمي ورقي + أخضر) ===== */
body:has(.k-land){background:#f6f5fc!important;background-image:none!important}
.k-land{min-height:100vh;display:flex;flex-direction:column;align-items:center;gap:18px;padding:14px 16px 26px;color:var(--ink)}
.k-hd{width:100%;max-width:1080px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:rgba(255,255,255,.88);backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:18px;padding:10px 16px;box-shadow:0 6px 24px rgba(46,39,117,.07)}
.k-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--ink)}
.k-mark{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:var(--main-l);border:1px solid var(--line)}
.k-mark .kb-logo{width:34px;height:34px;display:block}
.k-brand b{font-family:var(--f-display);font-size:1.35rem;color:var(--main-d);line-height:1.2;display:block}
.k-brand small{color:var(--mute);font-size:.76rem;font-weight:700}
.k-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.k-chip{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:.85rem;font-weight:700;border-radius:999px;padding:7px 14px;border:1px solid var(--line);background:var(--paper);color:var(--ink);text-decoration:none;cursor:pointer;transition:border-color .15s,background .15s}
.k-chip:hover{border-color:var(--main);background:var(--main-l)}
.k-chip.solid{background:var(--main);border-color:var(--main);color:#fff}
.k-chip.solid:hover{background:var(--main-d)}
.k-who{font-weight:700;color:var(--main-d);font-size:.88rem}
.k-hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;max-width:780px;margin-top:3.5vh}
.k-kicker{display:inline-block;background:var(--main-l);color:var(--main-d);border:1px solid var(--line);border-radius:999px;padding:4px 14px;font-size:.85rem;font-weight:700;animation:fxCardIn .5s both}
.k-h1{margin:0;font-family:var(--f-display);font-size:clamp(2.6rem,8.5vw,4.8rem);line-height:1.15;color:var(--main-d);display:flex;align-items:center;justify-content:center;gap:.28em;animation:fxWin .7s cubic-bezier(.2,1.3,.4,1) both}
.k-mark.big{width:1.15em;height:1.15em;border-radius:.26em;background:linear-gradient(135deg,var(--main-l),#fff);animation:kbFloat 3.5s ease-in-out infinite alternate}
.k-mark.big .kb-logo{width:.72em;height:.72em}
@keyframes kbFloat{to{transform:translateY(-.07em) rotate(-3deg)}}
.k-lead{margin:0;font-size:clamp(1rem,2.2vw,1.18rem);line-height:1.9;color:var(--mute);max-width:640px}
.k-cta{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:4px}
.k-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-weight:800;font-size:1.02rem;padding:12px 26px;border-radius:14px;border:0;cursor:pointer;text-decoration:none;color:#fff;background:var(--main);box-shadow:0 10px 24px rgba(75,64,169,.25);transition:transform .15s,box-shadow .15s,background .15s}
.k-btn:hover{background:var(--main-d);transform:translateY(-2px);box-shadow:0 14px 30px rgba(75,64,169,.32)}
.k-btn.ghost{background:var(--paper);color:var(--main-d);border:1.5px solid var(--line);box-shadow:none}
.k-btn.ghost:hover{background:var(--main-l)}
.k-cards{width:100%;max-width:1060px;display:grid;grid-template-columns:repeat(auto-fill,minmax(225px,1fr));gap:12px;margin-top:6px}
.k-c{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center;padding:14px 16px;border-radius:16px;text-decoration:none;color:var(--ink);background:var(--paper);border:1px solid var(--line);box-shadow:0 4px 14px rgba(46,39,117,.05);transition:transform .18s,border-color .18s,box-shadow .18s;animation:fxCardIn .55s cubic-bezier(.2,1.4,.4,1) both}
.k-c:hover{transform:translateY(-3px);border-color:var(--main);box-shadow:0 12px 26px rgba(75,64,169,.14)}
.k-ci{grid-row:1/3;width:48px;height:48px;display:grid;place-items:center;font-size:1.45rem;border-radius:14px;background:var(--main-l);border:1px solid var(--line)}
.k-c:hover .k-ci{background:var(--main);animation:fxWiggle .5s}
.k-c b{font-size:1.02rem}.k-c small{color:var(--mute);font-size:.8rem;line-height:1.55}
.k-ft{margin-top:auto;font-size:.8rem;color:var(--mute);text-align:center}
@media (max-width:620px){.k-hd{justify-content:center;flex-wrap:wrap}.k-nav{width:100%;justify-content:center}.k-who{width:100%;text-align:center;order:3}.k-mark.big{width:64px;height:64px}.k-cards{grid-template-columns:1fr 1fr}.k-c{grid-template-columns:1fr;grid-template-rows:auto;text-align:center;justify-items:center;row-gap:4px}.k-ci{grid-row:auto}}
'''
# ===== التجاوب الكامل: تابلت + موبايل (يضغط التخطيط حتى في وضع «موقع سطح المكتب» على الجوال ~980px) =====
extra_css += '''
@media (max-width:1000px){
  .layout,.qlayout,.mil{grid-template-columns:minmax(0,1fr)}
  .layout,.qlayout{gap:14px;padding-block:14px 40px}
  .tree,.qside{position:static;max-height:none;overflow:visible}
  .panel,.qmain{min-width:0}
  .top .helix{display:none}
  .lesson,.welcome{padding:16px 14px 20px;border-radius:18px}
}
@media (max-width:700px){
  .top-in{padding-block:14px 12px;gap:10px}
  /* الهيدر على الجوال: الاسم سطر كامل بمحاذاة الوسط، والأزرار تلتف على صفين بدل
     تمرير أفقي كان يضغط الاسم إلى 43px ويخرج قائمة«المزيد» والجرس خارج الشاشة */
  .top .actions{flex-wrap:wrap;justify-content:center;row-gap:8px;overflow:visible;-webkit-overflow-scrolling:touch}
  .top .actions .btn{flex:none}
  .top .actions .navmenu{flex:none}
  .top .who{order:-1;flex:0 0 100%;width:100%;text-align:center;font-size:.92rem;white-space:normal;padding-inline-end:0}
  /* شريط الحالات داخل الترويسة (بعض الصفحات تمرر صفّ .stat في extra): لا يمدّ الترويسة،
     بل يبقى بعرض الشاشة مع تمرير أفقي داخلي مخفي الأعراب */
  .top-in>*{min-width:0;max-width:100%}
  .top .brand{max-width:100%}
  .top .brand>div{min-width:0}
  .top .stats{width:100%}
  .stats{flex-wrap:wrap;justify-content:center}
  .stats::-webkit-scrollbar{display:none}
  .stat{white-space:nowrap}
  /* لوحة التحكم: تبويبات الأقسام تمرر أفقيًا بدل أن توسّع الشاشة كلها إلى 477px */
  .dash>*{min-width:0}
  /* بلا تمرير أفقي: داخل التطبيق (WebView) كان التمرير يتوقف قبل آخر تبويب، فتلتفّ التبويبات في صفّين */
  .dash .tabs{flex-wrap:wrap;overflow:visible;gap:6px}
  .dash .tabs .tab{padding:8px 10px;font-size:.86rem;flex:1 1 auto;white-space:nowrap;text-align:center}
  .t-wrap{max-width:100%}
  /* جدول المعلمين على الجوال: بطاقة لكل معلم بدل جدول يحتاج تمريرًا أفقيًا (كان زر «التفاصيل» في آخر عمود لا يُوصَل إليه في التطبيق) */
  .t-cards-wrap{overflow:visible;background:none;border:0;box-shadow:none}
  .t-cards thead{display:none}
  .t-cards,.t-cards tbody{display:block;width:100%;min-width:0!important}
  .t-cards tr{display:block;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:10px 12px;margin-bottom:10px}
  .t-cards td{display:flex;align-items:center;justify-content:space-between;gap:10px;border:0!important;padding:5px 0!important;text-align:start;white-space:normal}
  .t-cards td:first-child{display:block;border-bottom:1px solid var(--line)!important;padding-bottom:8px!important;margin-bottom:4px}
  .t-cards td[data-l]::before{content:attr(data-l);color:var(--mute);font-size:.8rem;font-weight:600;flex:none}
  .t-cards td.t-act{padding-top:8px!important}.t-cards td.t-act .btn{width:100%}
  .wrap{padding-inline:12px}
  .app-bar{padding:0 12px}
  .get-app{padding:12px 14px;border-radius:16px}
  .btn{padding:9px 14px;font-size:.88rem}
  .btn.small{padding:8px 12px;font-size:.84rem}
  .tree{padding:12px}
  .l-item,.lp-l{padding:10px 12px}
  .sel,.qsel{width:100%;max-width:none}
  .qcard{padding:12px}
  .modal-box{width:min(440px,94vw)!important;max-height:88vh;overflow:auto}
}
/* تأمين كروت العقد على الجوال الضيق والذي لا يتجاوب مع عتاد متصفح قديم */
@media (max-width:560px){
  .kb-banner img.kb-moe,.kb-banner img.kb-vis{height:34px}
  .kb-banner .kb-name b{font-size:clamp(24px,6.4vw,32px)}
}
/* بطاقات رئيسية خبير (/app): دخول متتابع، ارتفاع عند المرور، وأيقونة تهتز وتكبر */
.home-card{transition:transform .18s,border-color .18s,box-shadow .18s;animation:fxCardIn .55s cubic-bezier(.2,1.4,.4,1) both;-webkit-tap-highlight-color:transparent}
.home-card:hover{transform:translateY(-3px);border-color:var(--main);box-shadow:0 12px 26px rgba(12,122,99,.16)}
.home-card .home-ic{transition:transform .2s,box-shadow .2s}
.home-card:hover .home-ic{animation:fxWiggle .5s;box-shadow:0 8px 18px rgba(16,38,31,.28)}
.home-card:active{transform:scale(.97);border-color:var(--main);box-shadow:0 6px 16px rgba(12,122,99,.16)}
.home-card:active .home-ic,.home-card.tap .home-ic{animation:fxWiggle .5s}
body.tqb .home-card:hover{box-shadow:0 12px 26px rgba(29,78,216,.14)}
.menu-list a .mi{display:inline-block;transition:transform .18s}.menu-list a:hover .mi{animation:fxWiggle .5s}
@media (prefers-reduced-motion:reduce){.home-card,.home-card .home-ic{animation:none!important;transition:none}}
/* إعلان «التطبيق على الموبايل» في الرئيسية: أصغر وأهدأ (بلا توهج مستمر) + زر إخفاء دائم */
.app-bar .get-app{position:relative;width:auto;animation:glow 2.2s ease-in-out 2;padding:10px 16px;padding-inline-end:48px;border-width:1.5px}
.app-bar .get-app h3{font-size:.98rem}.app-bar .get-app p{font-size:.8rem}
.app-bar .ga-x{position:absolute;top:8px;inset-inline-end:8px;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--mute);font-size:1.2rem;line-height:1;cursor:pointer;display:grid;place-items:center;transition:transform .15s,background .15s,color .15s}
.app-bar .ga-x:hover{background:#fee2e2;color:#b91c1c;transform:rotate(90deg)}
.app-bar.closing{transition:opacity .3s,transform .3s,max-height .35s;opacity:0;transform:translateY(-8px);max-height:0!important;overflow:hidden;margin-top:0}
.app-bar.reshow .get-app{animation:fxWin .45s cubic-bezier(.2,1.4,.4,1)}
/* إشعار الفيديو: نافذة عند فتح الصفحة + فيديو داخل الجرس */
.modal-box.nv-box{width:min(460px,96vw)}
.nv-wrap{position:relative;display:flex;justify-content:center;background:#000;border-radius:16px;overflow:hidden;margin:6px 0 10px}
.nv-vid{display:block;width:auto;max-width:100%;max-height:min(62vh,640px);aspect-ratio:9/16;background:#000}
.nv-snd{position:absolute;bottom:56px;left:50%;transform:translateX(-50%);border:0;border-radius:999px;padding:10px 18px;font:inherit;font-weight:800;background:var(--main);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.35);cursor:pointer;animation:glow 1.6s ease-in-out infinite}
.nv-txt{margin:0 0 4px}.nv-later{margin:0}
.bp-vid{display:block;width:100%;max-height:340px;background:#000;border-radius:12px;margin:8px 0 4px;aspect-ratio:9/16;object-fit:contain}
/* ===== وضع التطبيق على الجوال (html.inapp يضيفه common.js داخل تطبيق أندرويد/آيفون فقط) ===== */
/* ترويسة الورقة الرسمية: لا تفرض عرضًا أكبر من شاشة الجوال (كانت الصفحة كلها تنزاح أفقيًا) */
@media (max-width:700px){
  .ohead td span,.ohead td div{white-space:normal!important}
  .ohead img{height:11mm!important}
  .ohead td{font-size:.7em!important}
}
html.inapp{-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-tap-highlight-color:transparent}
@media (max-width:820px){
  html.inapp,html.inapp body{overflow-x:clip;overscroll-behavior-y:none}
  html.inapp body{padding-bottom:calc(70px + env(safe-area-inset-bottom,0px));min-height:100vh;box-sizing:border-box}
  html.inapp header.top{display:none}
  html.inapp .atop{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:10px;height:54px;padding:0 12px;background:var(--paper,#fff);border-bottom:1px solid var(--line);transition:box-shadow .2s}
  html.inapp .atop.sh{box-shadow:0 4px 16px rgba(0,0,0,.08)}
  html.inapp .atop-t{flex:1;font-size:1.08rem;font-weight:800;color:var(--main-d);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  html.inapp .atop-back{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--main-l);color:var(--main-d);font-size:1.25rem;font-weight:800;text-decoration:none;flex:none}
  html.inapp .atop-sp{width:4px}
  html.inapp .atop-t.atop-link{flex:0 1 auto;cursor:pointer;background:var(--main-l);border:1px solid var(--line);border-radius:999px;padding:5px 14px;font-size:.95rem}
  html.inapp .atop-link+.atop-who{margin-inline-start:auto}
  html.inapp .atop-who{font-size:.78rem;color:var(--mute);max-width:40%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  html.inapp .abar{position:fixed;left:0;right:0;bottom:0;z-index:45;display:flex;background:var(--paper,#fff);border-top:1px solid var(--line);box-shadow:0 -6px 20px rgba(0,0,0,.06);padding:4px 4px calc(4px + env(safe-area-inset-bottom,0px))}
  html.inapp .ab-i{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-height:56px;border:0;background:none;font:inherit;color:var(--mute);text-decoration:none;border-radius:14px;cursor:pointer;-webkit-user-select:none;user-select:none}
  html.inapp .ab-ic{display:grid;place-items:center;width:44px;height:28px;border-radius:14px;transition:transform .15s,background .15s}
  html.inapp .ab-t{font-size:.7rem;font-weight:700;line-height:1.2}
  html.inapp .ab-i.on{color:var(--main-d)}
  html.inapp .ab-i.on .ab-ic{background:var(--main-l);color:var(--main)}
  html.inapp .ab-i.on .ab-t{font-weight:800}
  html.inapp .ab-i:active{background:var(--main-l)}
  html.inapp .ab-i:active .ab-ic{transform:scale(.9)}
  html.inapp .ab-dot{position:absolute;top:7px;left:calc(50% - 14px);width:9px;height:9px;border-radius:50%;background:#e11d48;border:2px solid var(--paper,#fff)}
  html.inapp .menu-list{bottom:calc(66px + env(safe-area-inset-bottom,0px))!important;top:auto!important;left:0!important;right:0!important;margin:6px!important;max-width:none!important;max-height:72vh!important;border-radius:20px;box-shadow:0 -10px 40px rgba(0,0,0,.25)}
  html.inapp .menu-list a,html.inapp .menu-list button{min-height:46px}
  html.inapp .menu-list:not([hidden]){box-shadow:0 -10px 40px rgba(0,0,0,.25),0 0 0 100vmax rgba(6,20,16,.38);animation:abSheet .2s ease-out}
  html.inapp .toast{bottom:calc(80px + env(safe-area-inset-bottom,0px))}
  html.inapp .modal{align-items:end;padding:0}
  html.inapp .modal-box{width:100%!important;max-width:none!important;border-radius:22px 22px 0 0!important;max-height:90vh;overflow:auto;padding-bottom:calc(18px + env(safe-area-inset-bottom,0px))!important;animation:abSheet .22s ease-out}
  html.inapp .wrap{padding-inline:10px}
  html.inapp input,html.inapp select,html.inapp textarea{font-size:16px}
  html.inapp .btn{min-height:42px}
  html.inapp table{max-width:100%}
  html.inapp #paper,html.inapp .paper{overflow-x:auto}
  html.inapp main,html.inapp .wrap{animation:abIn .25s ease-out}
}
@keyframes abSheet{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}
@keyframes abIn{from{opacity:0}to{opacity:1}}
'''
CSS = base_css + extra_css
# هوية «خبير» الجديدة (شعار البومة): الشعار صورة مربعة، والألوان من الشعار نفسه
CSS += '''
.auth-brand .logo{width:auto!important;height:auto!important;border-radius:0}
.kb-logo{object-fit:contain}
.kb-banner .kb-name b{color:var(--main-d);letter-spacing:0}
.kb-banner .kb-name span{color:var(--accent);font-weight:600}
.top{border-bottom:0!important;box-shadow:0 3px 0 var(--accent),0 6px 0 var(--main)}
.btn.primary{box-shadow:0 2px 0 var(--main-d)}


/* ===== رئيسية «خبير» بأسلوب لوحة القيادة: بطل + مؤشرات + بطاقات قوائم + عمود جانبي ===== */
.kh-home{max-width:none}
.kh-dash{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:20px;align-items:start}
.kh-col{display:grid;gap:18px;min-width:0}
.kh-hero{position:relative;display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:196px;padding:24px 30px;background:var(--paper);border-radius:28px;box-shadow:var(--kb-sh);overflow:hidden}
.kh-hero::before{content:"";position:absolute;inset-inline-end:0;top:0;bottom:0;width:44%;background:radial-gradient(90% 90% at 35% 50%,#e4eeff 0,rgba(228,238,255,0) 74%);pointer-events:none}
.kh-hero-tx{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start}
.kh-hero-art{position:relative;z-index:1;flex:0 0 196px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer}
.kh-hero-art .morph{width:180px;aspect-ratio:4/3;margin:0;filter:drop-shadow(0 10px 20px rgba(31,60,136,.12))}
.kh-hero-art .mz-tag{margin:0;font-size:.76rem;padding:3px 14px;border-radius:999px;background:linear-gradient(135deg,#eef3ff,#e0ebff);color:var(--main-d);border:1px solid rgba(62,123,250,.22);box-shadow:0 2px 8px rgba(31,60,136,.06)}
.kh-greet{margin:0;color:var(--mute);font-weight:500;font-size:.94rem;position:relative}
.kh-hero h1{position:relative;margin:4px 0 6px;font-family:var(--f-display);font-weight:700;font-size:clamp(1.5rem,2.7vw,2.2rem);line-height:1.25;color:var(--ink);text-wrap:balance;max-width:18ch}
.kh-subj{margin:0 0 14px;color:var(--mute);font-size:.9rem;position:relative}
.kh-cta{position:relative;display:inline-flex;align-items:center;gap:14px;font:inherit;font-weight:600;font-size:.95rem;color:#fff;background:var(--main);border:0;border-radius:16px;padding:8px 8px 8px 18px;cursor:pointer;box-shadow:0 10px 22px rgba(62,123,250,.3)}
[dir=rtl] .kh-cta{padding:8px 18px 8px 8px}
.kh-cta i{width:36px;height:36px;display:grid;place-items:center;border-radius:12px;background:#fff;color:var(--main);font-style:normal;font-size:1rem}
.kh-quick{position:relative;display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.kh-q{font:inherit;font-size:.82rem;font-weight:600;color:var(--main);background:var(--main-l);border:0;border-radius:12px;padding:7px 12px;cursor:pointer}
.kh-q.main{display:none}
.kh-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.kh-stat{display:flex;align-items:center;gap:12px;background:var(--paper);border-radius:22px;padding:14px 16px;box-shadow:var(--kb-sh);min-width:0}
.kh-stat .ks-ic{width:50px;height:50px;flex:none;display:grid;place-items:center;border-radius:16px;font-size:26px;background:var(--sc-l)}
.kh-stat b{display:block;font-size:.92rem;color:var(--ink)}
.kh-stat small{display:block;font-size:.75rem;color:var(--mute)}
.ks-bar{display:block;height:5px;border-radius:9px;background:#eef1f7;margin:6px 0 2px;overflow:hidden}
.ks-bar i{display:block;height:100%;border-radius:9px;background:var(--sc)}
.ks-pc{font-size:.75rem;font-weight:700;color:var(--sc)}
.kh-stat:nth-child(1){--sc:#ff9f1c;--sc-l:#fff3df}.kh-stat:nth-child(2){--sc:#22b8a5;--sc-l:#e0f6f2}.kh-stat:nth-child(3){--sc:#7c6cf2;--sc-l:#eeebff}
.kh-search{width:100%;box-sizing:border-box;font:inherit;font-size:.92rem;color:var(--ink);background:var(--paper);border:0;border-radius:16px;padding:12px 18px;box-shadow:var(--kb-sh)}
.kh-search:focus{outline:2px solid var(--main);outline-offset:1px}
#homeGrid{display:grid;gap:22px}
.kh-flow{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;align-items:start}
.kh-step{background:var(--paper);border-radius:24px;padding:18px 20px 14px;box-shadow:0 4px 18px rgba(31,37,71,.06),0 1px 3px rgba(31,37,71,.04);border:1px solid rgba(62,123,250,.09);min-width:0;overflow:hidden}
.kh-step header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 2px 10px;padding-bottom:8px;border-bottom:1px solid rgba(62,123,250,.07)}
.kh-step header>div{display:flex;align-items:baseline;gap:8px;min-width:0}
.kh-n{display:none}
.kh-step h2{margin:0;font-family:var(--f-display);font-weight:700;font-size:1.06rem;color:var(--ink)}
.kh-step header p{margin:0;font-size:.78rem;color:var(--mute)}
.kh-step header::after{content:"";width:10px;height:10px;flex:none;border-radius:50%;background:var(--sc);box-shadow:0 0 0 4px color-mix(in srgb,var(--sc) 18%,transparent)}
.kh-rows{display:grid;grid-template-columns:minmax(0,1fr);gap:5px}
.kh-row{display:flex;align-items:center;gap:12px;width:100%;min-width:0;box-sizing:border-box;text-align:right;font:inherit;color:var(--ink);background:transparent;border:0;border-radius:14px;padding:8px 8px;cursor:pointer}
.kh-row:hover{background:#f2f6fe}
.kh-ic{width:44px;height:44px;flex:none;display:grid;place-items:center;border-radius:14px;font-size:21px;background:color-mix(in srgb,var(--sc) 13%,#fff)}
.kh-tx{flex:1 1 0%;min-width:0;overflow:hidden;display:flex;flex-direction:column}
.kh-tx b{font-size:.9rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kh-tx small{font-size:.74rem;color:var(--mute);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kh-go{flex:none;font-size:.75rem;font-weight:600;color:var(--main);border:1.5px solid color-mix(in srgb,var(--main) 45%,transparent);border-radius:10px;padding:4px 11px;white-space:nowrap}
.kh-row:hover .kh-go{background:var(--main);color:#fff;border-color:var(--main)}
.kh-before{--sc:#3e7bfa}.kh-during{--sc:#ff9f1c}.kh-assess{--sc:#22b8a5}.kh-follow{--sc:#f05d7a}.kh-office{--sc:#7c6cf2}
.kh-row:focus-visible,.kh-cta:focus-visible,.kh-q:focus-visible,.kh-tool:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.kh-rail{display:grid;gap:16px;position:sticky;top:96px}
.kh-card{background:var(--paper);border-radius:24px;padding:16px 18px;box-shadow:var(--kb-sh)}
.kh-card h3{display:flex;justify-content:space-between;align-items:center;margin:0 0 10px;font-family:var(--f-display);font-weight:600;font-size:.98rem;color:var(--ink)}
.kh-card h3 span{color:var(--main);font-size:1rem}
.kh-tools-h{display:none}
.kh-tools{display:grid;gap:4px}
.kh-tool{display:flex;align-items:center;gap:12px;width:100%;font:inherit;text-align:right;cursor:pointer;background:transparent;border:0;border-radius:14px;padding:7px 4px;color:var(--ink)}
.kh-tool:hover{background:#f5f7fc}
.kh-tool>span:first-child{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:13px;font-size:20px;background:#fff3df}
.kh-tool:nth-child(2)>span:first-child{background:#e0f6f2}.kh-tool:nth-child(3)>span:first-child{background:#ffe6ec}
.kh-tool b{display:block;font-size:.86rem;font-weight:600}.kh-tool small{display:block;font-size:.73rem;color:var(--mute)}
.kh-tip{display:flex;gap:12px;align-items:center}
.kh-tip img{width:68px;height:68px;flex:none;object-fit:contain;border-radius:16px;background:#eef3ff;padding:6px;box-sizing:border-box}
.kh-tip b{display:block;font-size:.88rem;color:var(--ink)}
.kh-tip p{margin:2px 0 0;font-size:.76rem;color:var(--mute);line-height:1.5}
.kh-mid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;align-items:stretch}
.kh-mid.nofeat{grid-template-columns:minmax(0,1fr)}
.kh-feats{display:grid;gap:16px}
.kh-feat{display:flex;align-items:center;gap:14px;width:100%;text-align:right;font:inherit;color:var(--ink);background:var(--paper);border:1px solid rgba(62,123,250,.09);border-radius:24px;padding:15px 16px;box-shadow:0 4px 18px rgba(31,37,71,.06),0 1px 3px rgba(31,37,71,.04);cursor:pointer}
.kf-art{width:68px;height:68px;flex:none;display:grid;place-items:center;border-radius:20px;font-size:36px;transform:rotate(-8deg);box-shadow:0 10px 18px rgba(31,37,71,.12)}
.f0 .kf-art{background:linear-gradient(140deg,#ffcf70,#ff9f1c)}.f1 .kf-art{background:linear-gradient(140deg,#8fb4ff,#3e7bfa)}
.kh-feat:hover .kf-art{transform:rotate(0) scale(1.05);transition:transform .2s}
.kf-tx{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0}
.kf-tx b{font-size:.92rem;font-weight:600}.kf-tx small{font-size:.73rem;color:var(--mute);line-height:1.4}
.kf-btn{margin-top:6px;font-size:.74rem;font-weight:600;color:#fff;background:#3cc9b4;border-radius:9px;padding:3px 13px}
.kh-last{background:var(--paper);border-radius:22px;padding:15px 18px;box-shadow:var(--kb-sh)}
.kh-last h3{margin:0 0 8px;font-family:var(--f-display);font-weight:600;font-size:.98rem;color:var(--ink)}
.kl-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.kl-ic{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:var(--main-l);font-size:19px}
.kl-row b{font-size:.88rem;font-weight:600;color:var(--ink);flex:1 1 160px}
.kl-bar{flex:1 1 140px;height:6px;border-radius:9px;background:#eef1f7;overflow:hidden}.kl-bar i{display:block;height:100%;background:var(--main);border-radius:9px}
.kl-row small{font-size:.75rem;color:var(--mute);white-space:nowrap}
.kl-btn{font:inherit;font-size:.78rem;font-weight:600;color:#fff;background:#f05d7a;border:0;border-radius:10px;padding:6px 15px;cursor:pointer}
@media (max-width:1240px){.kh-dash{grid-template-columns:minmax(0,1fr)}.kh-rail{position:static;grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:960px){.kh-mid{grid-template-columns:minmax(0,1fr)}.kh-feats{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:700px){
  .kh-hero{flex-direction:column-reverse;align-items:center;text-align:center;padding:20px 16px;min-height:0;border-radius:24px;gap:12px}
  .kh-hero::before{inset:0;width:100%;height:48%;background:radial-gradient(80% 90% at 50% 25%,#e4eeff 0,rgba(228,238,255,0) 75%)}
  .kh-hero-tx{align-items:center}
  .kh-hero h1{font-size:1.35rem;max-width:none}
  .kh-hero-art{flex:none;width:auto}
  .kh-hero-art .morph{width:136px}
  .kh-stats{grid-template-columns:1fr;gap:10px}
  .kh-flow,.kh-rail,.kh-feats{grid-template-columns:minmax(0,1fr)!important}
}
/* ===== لوحة التحكم: المعلمون كبطاقات ===== */
.tc-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 14px}
.tc-filters{display:flex;flex-wrap:wrap;gap:6px}
.tc-f{font:inherit;font-size:.84rem;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--paper);color:var(--ink);cursor:pointer}
.tc-f span{display:inline-block;min-width:1.6em;margin-inline-start:4px;padding:0 6px;border-radius:999px;background:var(--main-l);color:var(--main-d);font-size:.76rem;font-variant-numeric:tabular-nums}
.tc-f.on{background:var(--main);border-color:var(--main);color:#fff}.tc-f.on span{background:rgba(255,255,255,.22);color:#fff}
.tc-sort{display:flex;align-items:center;gap:6px;font-size:.84rem;color:var(--mute)}
.tc-sort select{font:inherit;font-size:.84rem;padding:6px 10px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink)}
.tc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.tc{position:relative;display:flex;flex-direction:column;gap:12px;background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:16px;transition:border-color .15s,box-shadow .15s}
.tc:hover{border-color:var(--main);box-shadow:0 6px 18px rgba(46,39,117,.08)}
.tc.is-off{opacity:.65}
.tc-open{position:absolute;inset:0;z-index:1;border:0;background:none;border-radius:20px;cursor:pointer}
.tc-open:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.tc header{display:flex;align-items:center;gap:12px}
.tc-av{width:46px;height:46px;flex:none;display:grid;place-items:center;border-radius:15px;background:var(--main-l);color:var(--main-d);font-family:var(--f-display);font-weight:700;font-size:1.25rem}
.tc-id{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.35}
.tc-id b{font-size:1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tc-id span{font-size:.78rem;color:var(--mute);text-align:right}
.pill.on{background:#e3f6f1;color:#1f7a6b;border-color:transparent}
.tc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0}
.tc-stats div{background:var(--bg);border-radius:12px;padding:7px 8px}
.tc-stats dt{font-size:.7rem;color:var(--mute)}
.tc-stats dd{margin:0;font-weight:700;font-size:.9rem;color:var(--ink)}
.tc-scope{display:flex;flex-wrap:wrap;gap:4px;font-size:.78rem;max-height:3.6em;overflow:hidden}
.tc footer{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.8rem;color:var(--mute);border-top:1px dashed var(--line);padding-top:10px;margin-top:auto}
.tc-dev{display:flex;align-items:center;gap:6px}
.tc-dev b{color:var(--ink)}
.tc-meter{display:inline-block;width:54px;height:6px;border-radius:9px;background:var(--main-l);overflow:hidden}
.tc-meter i{display:block;height:100%;background:var(--main);border-radius:9px}
.tc-more{color:var(--main);font-weight:600}
.tc .pill.warn{position:relative;z-index:2}

body.kb-shell .modal{z-index:90}
@media (max-width:640px){
  body.kb-shell .kpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  body.kb-shell .kpi{padding:8px 10px;border-radius:12px;box-shadow:none}
  body.kb-shell .kpi-n{font-size:1.25rem}
  body.kb-shell .kpi-l{font-size:.7rem;line-height:1.3}
  .tc-bar{flex-direction:column;align-items:stretch}
  .tc-f{font-size:.8rem;padding:5px 10px}
}
/* ===== قشرة «خبير» بأسلوب لوحة القيادة: خلفية زرقاء، إطار أبيض، شريط جانبي أبيض عائم ===== */
:root:not([data-theme="dark"]){--bg:#eef2f8;--paper:#ffffff;--ink:#1f2547;--mute:#7a8299;--line:#e4e9f2;--main:#3e7bfa;--main-d:#1f3c88;--main-l:#e8efff;--accent:#ff9f1c;--accent-l:#fff3df;--leaf:#22b8a5}
:root{--kb-sh:0 6px 22px rgba(31,37,71,.06)}
html:has(body.kb-shell){background:#4d86f7}
@media (max-width:900px){html:has(body.kb-shell){background:var(--bg)}}
body.kb-shell{background:#4d86f7 radial-gradient(1200px 600px at 85% -10%,#7aa6ff 0,rgba(122,166,255,0) 60%) fixed}
body.kb-shell::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.12;background:
  radial-gradient(circle at 8% 20%,transparent 22px,#fff 23px,#fff 26px,transparent 27px),
  radial-gradient(circle at 92% 78%,transparent 30px,#fff 31px,#fff 34px,transparent 35px)}
.kb-side{position:fixed;top:16px;bottom:16px;inset-inline-start:16px;width:258px;z-index:40;display:flex;flex-direction:column;
  background:#fff;color:var(--ink);border-radius:26px;box-shadow:0 20px 50px rgba(20,40,110,.18)}
.kbs-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 6px}
.kbs-brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none}
.kbs-brand .kb-logo{width:42px;height:42px}
.kbs-brand b{display:block;font-family:var(--f-display);font-weight:700;font-size:1.3rem;line-height:1.1}
.kbs-brand small{display:block;color:var(--accent);font-size:.78rem;font-weight:600}
.kbs-x{display:none;border:0;background:#f1f4fa;color:var(--ink);width:36px;height:36px;border-radius:12px;font-size:1.35rem;cursor:pointer}
.kbs-nav{flex:1;overflow:auto;padding:6px 12px 10px;scrollbar-width:thin;scrollbar-color:#dfe5f0 transparent}
.kbs-nav a{display:flex;align-items:center;gap:10px;color:#5a627d;text-decoration:none;font-size:.95rem;font-weight:600;padding:6.5px 10px;border-radius:12px;position:relative;line-height:1.45}
.kbs-nav a:hover{background:#f4f7fd;color:var(--ink)}
.kbs-nav a[aria-current]{background:var(--main-l);color:var(--main);font-weight:700;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--main) 25%,transparent)}
.kbi{width:24px;flex:none;text-align:center;font-size:17px;filter:saturate(.85)}
.kbs-home{margin-bottom:4px}
.kbs-g{margin-top:10px}
.kbs-gh{display:flex;align-items:center;gap:7px;margin:0 0 3px;padding:0 8px}
.kbs-gh span{font-weight:700;font-size:.78rem;color:#8a94b0;letter-spacing:.2px}
.kbs-gh small{display:none}
.kbs-gh::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--gc)}
.g-before{--gc:#3e7bfa}.g-during{--gc:#ff9f1c}.g-assess{--gc:#22b8a5}.g-follow{--gc:#f05d7a}.g-office{--gc:#7c6cf2}.g-tools{margin-top:4px}
.kbs-foot{display:flex;flex-direction:row;align-items:center;gap:10px;margin:4px 12px 12px;padding:8px 10px;border-radius:16px;background:#f4f7fd;text-align:right}
.kbs-av{width:36px;height:36px;flex:none;display:grid;place-items:center;border-radius:11px;background:linear-gradient(160deg,#5fd6c8,#22b8a5);box-shadow:0 6px 12px rgba(34,184,165,.25)}
.kbs-av img{width:28px;height:28px;object-fit:contain}
.kbs-who{flex:1;min-width:0;font-size:.88rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kbs-foot button{flex:none;font:inherit;font-size:.72rem;font-weight:600;color:#e5484d;background:#fff;border:1px solid rgba(229,72,77,.18);border-radius:10px;width:auto;padding:4px 9px;cursor:pointer}
.kbs-foot button:hover{background:#ffe6e8}
.kb-tabs,.kb-scrim{display:none}
.kbs-nav a:focus-visible,.kb-tabs a:focus-visible,.kb-tabs button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}

body.kb-shell .kb-main{margin:16px;margin-inline-start:290px;min-height:calc(100vh - 32px);background:var(--bg);border-radius:28px;overflow:clip;box-shadow:0 20px 50px rgba(20,40,110,.18)}
body.kb-shell .top{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 88%,transparent)!important;backdrop-filter:blur(12px);box-shadow:none!important;color:var(--ink)!important}
body.kb-shell .top .kb-banner{display:none}
body.kb-shell .top .top-in{border-top:0;padding-block:10px 10px;padding-inline:24px;max-width:none;display:grid;grid-template-columns:minmax(80px,1fr) auto minmax(max-content,1fr);align-items:center;gap:12px}
@media (max-height:760px) and (min-width:901px){
  .kbs-head{padding:10px 14px 4px}
  .kbs-nav{padding:2px 10px 4px}
  .kbs-nav a{padding:4.5px 9px;font-size:.88rem}
  .kbs-gh span{font-size:.74rem}
  .kbi{font-size:15px}
  .kbs-g{margin-top:5px}
  .kbs-foot{margin:2px 10px 8px;padding:6px 8px}
}
.kb-title{margin:0;font-family:var(--f-display);font-weight:700;font-size:1.45rem;color:var(--ink);justify-self:start}
.kb-top-brand{justify-self:center;display:flex;flex-direction:column;align-items:center;text-align:center;gap:1px;min-width:0}
.kb-top-logo-wrap{position:relative;width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(145deg,#ffffff,#e8efff);box-shadow:0 6px 16px rgba(31,60,136,.12),inset 0 0 0 1.5px rgba(62,123,250,.22);animation:kbLogoFloat 3.4s ease-in-out infinite}
.kb-top-logo-wrap::after{content:"";position:absolute;inset:-3px;border-radius:17px;border:1.5px solid rgba(255,159,28,.45);opacity:.7;animation:kbLogoGlow 3.4s ease-in-out infinite;pointer-events:none}
.kb-top-logo{width:34px;height:34px;object-fit:contain;display:block;animation:kbOwlTilt 4.2s ease-in-out infinite}
@keyframes kbLogoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3.5px)}}
@keyframes kbOwlTilt{0%,100%{transform:rotate(0deg) scale(1)}25%{transform:rotate(-5deg) scale(1.04)}75%{transform:rotate(5deg) scale(1.04)}}
@keyframes kbLogoGlow{0%,100%{transform:scale(.96);opacity:.28}50%{transform:scale(1.06);opacity:.85}}
.kb-top-name{font-family:var(--f-display);font-weight:800;font-size:1.08rem;color:var(--main-d);line-height:1.1;margin-top:2px}
.kb-top-quote{margin:2px 0 0;display:inline-flex;align-items:center;gap:5px;padding:2px 13px;border-radius:999px;background:var(--paper);border:1px solid rgba(62,123,250,.2);box-shadow:0 3px 10px rgba(31,37,71,.05);font-size:.75rem;font-weight:600;color:var(--main-d);line-height:1.4;max-width:100%}
.kb-top-quote .kb-qm{color:var(--accent);font-size:.9rem;font-weight:800;line-height:1}
body.kb-shell .top .whobar{justify-self:end;align-items:center}
body.kb-shell .top .brand{grid-column:1/-1;order:3}
body.kb-shell .top .brand:not(:has(.stats)),body.kb-shell .top .brand:has(#statLessons){display:none}
body.kb-shell .top .stat{background:var(--paper);border:0;color:var(--mute);box-shadow:var(--kb-sh)}
body.kb-shell .whobar>a.btn[href="/app"],body.kb-shell .whobar>.navmenu:has(#menuBtn){display:none!important}
body.kb-shell .whobar .who{display:none}
body.kb-shell .whobar .btn{background:var(--paper);border:0;color:var(--ink);border-radius:14px;box-shadow:var(--kb-sh);padding:9px 14px}
body.kb-shell .whobar #toolBtn{background:var(--main);color:#fff;animation:none;box-shadow:0 8px 18px rgba(62,123,250,.3)}
body.kb-shell .wrap{max-width:none;padding-inline:26px}
/* بطاقات وأزرار كل الصفحات بنفس اللغة */
body.kb-shell .card,body.kb-shell .welcome,body.kb-shell .lesson,body.kb-shell .settings,body.kb-shell .tree,body.kb-shell .kpi,body.kb-shell .tc,body.kb-shell .home-head,body.kb-shell .t-wrap{border-color:transparent!important;border-radius:24px;box-shadow:var(--kb-sh)}
body.kb-shell .btn{border-radius:12px}
body.kb-shell .btn.primary{background:var(--main);border-color:var(--main);color:#fff;box-shadow:0 8px 18px rgba(62,123,250,.25)}
body.kb-shell .tab.on{color:var(--main)!important;border-color:var(--main)!important}
body.kb-shell .app-bar .get-app{border-radius:24px;border:0;box-shadow:var(--kb-sh);background:var(--paper)}

@media (max-width:900px){
  body.kb-shell{background:var(--bg)}
  body.kb-shell::before{display:none}
  .kb-side{top:0;bottom:0;inset-inline-start:0;border-radius:0;width:min(86vw,320px);display:none;z-index:70;box-shadow:0 0 40px rgba(0,0,0,.25)}
  .kb-side.open{display:flex;animation:kbSideIn .22s ease-out}
  @keyframes kbSideIn{from{transform:translateX(100%)}to{transform:none}}
  html.inapp .kb-tabs{display:none!important}
  .kbs-x{display:grid;place-items:center}
  .kb-scrim{display:block;position:fixed;inset:0;z-index:65;background:rgba(20,30,70,.4)}
  .kb-scrim[hidden]{display:none}
  body.kb-lock{overflow:hidden}
  body.kb-shell .kb-main{margin:0;border-radius:0;box-shadow:none;min-height:100vh;overflow:visible;padding-bottom:calc(84px + env(safe-area-inset-bottom,0px))}
  body.kb-shell .top .top-in,body.kb-shell .wrap{padding-inline:14px}
  .kb-title{font-size:1.2rem}
}
@media (max-width:680px){
  body.kb-shell .top .top-in{grid-template-columns:auto 1fr;gap:8px}
  .kb-top-brand{grid-column:1/-1;order:2;flex-direction: row;flex-wrap:wrap;justify-content:center;gap:6px 10px;padding-top:2px}
  .kb-top-logo-wrap{width:36px;height:36px;border-radius:11px}
  .kb-top-logo{width:28px;height:28px}
  .kb-top-name{font-size:.98rem;margin-top:0}
  .kb-top-quote{font-size:.7rem;padding:2px 10px}
  .kb-tabs{display:flex;position:fixed;inset-inline:12px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:60;background:#fff;border-radius:22px;padding:6px;box-shadow:0 10px 30px rgba(31,37,71,.15)}
  .kb-tabs a,.kb-tabs button{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;border:0;background:none;color:#8a91a8;font:inherit;font-size:.68rem;font-weight:600;text-decoration:none;border-radius:16px;cursor:pointer}
  .kb-tabs span{font-size:1.15rem;line-height:1.2}
  .kb-tabs a[aria-current]{background:var(--main-l);color:var(--main)}
  body.kb-shell .toast{bottom:calc(92px + env(safe-area-inset-bottom,0px))}
}
@media (prefers-reduced-motion:reduce){.kb-side{transition:none}}
@media print{body.kb-shell{background:#fff!important}body.kb-shell::before,.kb-side,.kb-tabs,.kb-scrim{display:none!important}body.kb-shell .kb-main{margin:0!important;padding:0!important;box-shadow:none!important;border-radius:0!important;background:#fff!important}}
'''

FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Readex+Pro:wght@500;600;700;800&display=swap" rel="stylesheet">'

import base64 as _b64, secrets as _sec, subprocess as _sp, shutil as _sh, hashlib as _hl, tempfile as _tf
# خطأ نحوي واحد في سكربت صفحة يوقفها كلها؛ نفحص كل سكربت بـ node قبل النشر
_JS_OK = set()
def _check_js(js):
    node = _sh.which('node')
    if not node: return
    h = _hl.md5(js.encode('utf-8')).hexdigest()
    if h in _JS_OK: return
    with _tf.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write('(function(){\n' + js + '\n})'); fn = f.name
    r = _sp.run([node, '--check', fn], capture_output=True, text=True)
    os.unlink(fn)
    if r.returncode:
        err = (r.stderr or '').strip().splitlines()
        raise SystemExit('خطأ نحوي في سكربت صفحة — لن يُنشر:\n' + '\n'.join(l[:300] for l in err[:6]))
    _JS_OK.add(h)
def _js_check(js):
    # الكود يُشفَّر قبل النشر فلا يراه «node --check» في سير النشر — فاصلة ناقصة واحدة
    # كانت توقف صفحة كاملة («جارٍ تحميل الدروس» للأبد وأزرار لا تستجيب). نفحصه هنا قبل التشفير.
    import shutil, subprocess, tempfile
    if not shutil.which('node'): return
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(js); p = f.name
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    os.unlink(p)
    if r.returncode:
        sys.exit('JS syntax error in a page script:\n' + r.stderr[:1500])
def pack(js):
    js = chr(10).join(l.strip() for l in js.split(chr(10)) if l.strip())
    _check_js(js)
    _js_check(js)
    key = _sec.token_hex(8)
    raw = js.encode('utf-8'); kb = key.encode()
    enc = _b64.b64encode(bytes(c ^ kb[i % len(kb)] for i, c in enumerate(raw))).decode()
    return ('(function(){var s=document.currentScript,n=s.nonce,k="' + key + '",b=atob("' + enc + '"),u=new Uint8Array(b.length);'
            'for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i)^k.charCodeAt(i%k.length);'
            'var e=document.createElement("script");e.nonce=n;e.textContent=new TextDecoder().decode(u);document.body.appendChild(e);e.remove();s.remove();})();')


# ===== واجهة «خبير» الخاصة: شريط جانبي بمراحل يوم المعلم + شريط سفلي للجوال =====
# (مختلفة عمدًا عن الكبسولة: التنقل مرتّب حسب «متى» يحتاج المعلم الأداة، لا قائمة مسطّحة)
KB_GROUPS = [
  ('before', 'قبل الحصة', 'أجهّز درسي', [('/app#prep', '📋', 'التحضير'), ('/slides', '📽️', 'العروض التقديمية'), ('/summaries', '📚', 'ملخصات الدروس'), ('/cando', '☑️', 'أستطيع أن')]),
  ('during', 'داخل الحصة', 'أشغّل صفّي', [('/games', '🎲', 'الألعاب التعليمية'), ('/cards', '🪪', 'كروت الأسئلة'), ('/space', '🎒', 'مساحة الطالب')]),
  ('assess', 'التقويم', 'أقيس التعلّم', [('/quiz', '📝', 'الاختبارات القصيرة'), ('/homework', '📒', 'الواجبات المنزلية'), ('/diag', '🧪', 'الاختبار التشخيصي'), ('/finals', '🗂', 'الاختبارات النهائية')]),
  ('follow', 'بعد الحصة', 'أتابع طلابي', [('/analysis', '📊', 'تحليل النتائج'), ('/remedial', '🩹', 'الخطط العلاجية'), ('/ld', '🧩', 'صعوبات التعلم')]),
  ('office', 'ملفاتي', 'أوراق إدارية', [('/forms', '🗂', 'النماذج الإدارية'), ('/research', '🔬', 'البحوث الإجرائية')]),
]
def _kb_side():
    h = ('<aside class="kb-side" id="kbSide" aria-label="أقسام خبير"><div class="kbs-head">'
         f'<a class="kbs-brand" href="/app">{LOGO}<span><b>خبير</b><small>منصة المعلمين</small></span></a>'
         '<button type="button" class="kbs-x" id="kbSideX" aria-label="إغلاق القائمة">×</button></div>'
         '<nav class="kbs-nav"><a class="kbs-home" href="/app" data-kb="/app"><span class="kbi">🏠</span>الرئيسية</a>')
    for key, name, sub, items in KB_GROUPS:
        h += f'<div class="kbs-g g-{key}"><p class="kbs-gh"><span>{name}</span><small>{sub}</small></p>'
        for href, ic, t in items:
            h += f'<a href="{href}" data-kb="{href}"><span class="kbi">{ic}</span>{t}</a>'
        h += '</div>'
    h += ('<div class="kbs-g g-tools"><a href="/admin" data-kb="/admin" id="kbAdmin" hidden><span class="kbi">⚙</span>لوحة التحكم</a></div></nav>'
          '<div class="kbs-foot"><span class="kbs-av"><img src="/brand/logo.png" alt=""></span><span class="kbs-who" id="kbWho">خبير</span><button type="button" id="kbLogout" title="تسجيل الخروج">خروج</button></div></aside>'
          '<div class="kb-scrim" id="kbScrim" hidden></div>'
          '<nav class="kb-tabs" aria-label="التنقل السريع">'
          '<a href="/app" data-kb="/app"><span>🏠</span>الرئيسية</a>'
          '<a href="/app#prep" data-kb="/app#prep"><span>📋</span>التحضير</a>'
          '<a href="/quiz" data-kb="/quiz"><span>📝</span>التقويم</a>'
          '<a href="/games" data-kb="/games"><span>🎲</span>الألعاب</a>'
          '<button type="button" id="kbMore"><span>☰</span>الأقسام</button></nav>')
    return h
KB_SIDE = _kb_side()
KB_SHELL_JS = r"""
(function(){
  var b=document.body;b.classList.add('kb-shell');
  var path=location.pathname,hash=location.hash;
  function mark(){
    var cur=(path==='/app'&&location.hash==='#prep')?'/app#prep':path;
    document.querySelectorAll('[data-kb]').forEach(function(a){
      var k=a.getAttribute('data-kb');
      if(k===cur)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    });
  }
  mark();
  var side=document.getElementById('kbSide'),scrim=document.getElementById('kbScrim');
  function open(v){side.classList.toggle('open',v);scrim.hidden=!v;b.classList.toggle('kb-lock',v);}
  document.getElementById('kbMore').onclick=function(){open(true);};
  document.getElementById('kbSideX').onclick=function(){open(false);};
  scrim.onclick=function(){open(false);};
  document.querySelectorAll('[data-kb^="/app"]').forEach(function(a){
    a.addEventListener('click',function(e){
      if(location.pathname!=='/app')return;
      var k=a.getAttribute('data-kb');e.preventDefault();open(false);
      if(k==='/app#prep'&&window.appShowPrep)window.appShowPrep();
      else if(window.appShowHome)window.appShowHome();
      mark();window.scrollTo(0,0);
    });
  });
  window.addEventListener('hashchange',mark);
  var panel=path==='/app'&&document.getElementById('panel');
  if(panel)new MutationObserver(function(){
    var home=!!panel.querySelector('.kh-home'),want=home?'':'#prep';
    if(location.hash!==want)history.replaceState(null,'','/app'+want);mark();
  }).observe(panel,{childList:true});
  document.getElementById('kbLogout').onclick=function(){var l=document.getElementById('logoutBtn');if(l)l.click();};
  var n=0,t=setInterval(function(){
    var a=document.getElementById('adminLink'),w=document.getElementById('who');
    if(a&&!a.hidden)document.getElementById('kbAdmin').hidden=false;
    if(w&&w.textContent.trim())document.getElementById('kbWho').textContent=w.textContent.trim();
    if(++n>20)clearInterval(t);
  },400);
  var top=document.querySelector('.top-in');
  if(top&&!document.querySelector('.kb-title')){
    var tt=document.title.split(' · ')[0];if(tt==='خبير')tt='الرئيسية';
    var h=document.createElement('h2');h.className='kb-title';h.textContent=tt;top.insertBefore(h,top.firstChild);
    var Q=['حضّر، علّم، وقيّم — كل أدوات المعلم في مكان واحد','وقتك لطلابك، والتحضير والتقويم علينا','من التحضير إلى التحليل والخطط العلاجية بضغطات','رفيق المعلم الذكي قبل الحصة وداخلها وبعدها'];
    var q=Q[new Date().getDate()%Q.length];
    var cb=document.createElement('div');cb.className='kb-top-brand';cb.id='kbTopBrand';
    cb.innerHTML='<div class="kb-top-logo-wrap"><img class="kb-top-logo" src="/brand/logo.png" alt="خبير"></div><b class="kb-top-name">خبير</b><p class="kb-top-quote"><span class="kb-qm" aria-hidden="true">❝</span><span id="kbTopQuote">'+q+'</span><span class="kb-qm" aria-hidden="true">❞</span></p>';
    var wb=top.querySelector('.whobar');
    if(wb)top.insertBefore(cb,wb);else top.appendChild(cb);
  }
})();
"""

def page(title, body, script):
    if '<header class="top">' in body:
        body = KB_SIDE + '<div class="kb-main">' + body + '</div>'
        script = script + chr(10) + KB_SHELL_JS
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#f6f5fc">'
            '<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png">'
            '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
            '<meta name="apple-mobile-web-app-title" content="خبير"><meta name="apple-mobile-web-app-status-bar-style" content="default">'
            f'<title>{title}</title>{FONTS}<style>%CSS%</style></head><body>{body}'
            '<div class="modal" id="modal" hidden><div class="modal-box" id="modalBox" role="dialog" aria-modal="true" aria-labelledby="mTitle"></div></div>'
            '<div class="toast" id="toast" role="status" aria-live="polite"></div>'
            f'<script nonce="%NONCE%">{pack(common + chr(10) + script)}</script></body></html>')

import math
def _helix():
    # موجتان متداخلتان + عقد نجوم (شبكة معرفة) بدل الحلزون
    pts1=[];pts2=[];nodes=[];stars=[]
    for k in range(0,181):
        y=k*5; ph=y/900*2*math.pi*3
        pts1.append((150+95*math.sin(ph),y)); pts2.append((150-95*math.sin(ph),y))
        if k%6==3:
            x1=150+95*math.sin(ph); x2=150-95*math.sin(ph)
            if abs(x1-x2)>40: nodes.append((x1,y)); nodes.append((x2,y))
    for (sx,sy) in [(60,150),(240,420),(75,700)]:
        stars.append(f'<path class="st" d="M{sx} {sy-14}l3.5 10.5 10.5 3.5-10.5 3.5-3.5 10.5-3.5-10.5-10.5-3.5 10.5-3.5z"/>')
    d=lambda P:"M"+" L".join(f"{x:.1f} {y}" for x,y in P)
    return f'''<svg class="big-helix" viewBox="0 0 300 900" aria-hidden="true"><path class="s1" d="{d(pts1)}"/><path class="s2" d="{d(pts2)}"/><g class="rg">{''.join(f'<circle cx="{x:.1f}" cy="{y}" r="6"/>' for x,y in nodes)}{''.join(stars)}</g></svg>'''
BIG_HELIX = _helix()

PROMO = '''<aside class="get-app" id="getApp" aria-label="حمّل التطبيق">
  <h3>📱 حمّل تطبيق «خبير»</h3>
  <p>على موبايلك: التحضير والواجب يتبعتوا لنور بضغطة، والأداة مدمجة بدون أي إعداد.</p>
  <div class="ga-btns"><a class="ga-btn" href="/download/khaber.apk" download>⬇ تحميل للأندرويد</a></div>
  <details><summary>📲 على الآيفون</summary><ol><li>افتح الموقع من متصفح Safari.</li><li>اضغط زر «مشاركة» ⬆ أسفل الشاشة.</li><li>اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</li></ol></details>
  <details><summary>💻 على الكمبيوتر</summary><ol><li>سجّل الدخول.</li><li>اضغط زر «ثبّت أداة نور» أعلى صفحة الدروس واتبع الخطوتين.</li></ol></details>
</aside>'''



def auth_shell(card):
    return f'''<main class="auth"><div class="kb-band">{BANNER}</div>
<section class="auth-art">
  <div class="auth-brand">
    <div class="logo">{LOGO}</div>
    <h1>خبير</h1>
    <p>تحضير الدروس جاهز للإرسال إلى منصة نور، مرتّب حسب فهرس الكتاب المدرسي: العلوم، والأحياء، والكيمياء، والعلوم البيئية، وتقنية المعلومات، واللغة الإنجليزية.</p>
    <span class="school">منصة المعلمين</span>
  </div>
  <div class="auth-facts"><span>مواد متعددة</span><span>الفصل الدراسي الأول</span><span>نسخ بضغطة واحدة</span></div>
</section>
<section class="auth-panel">{PROMO}{card}</section>
</main>'''

LOGIN = auth_shell('''<form class="auth-card" id="loginForm" novalidate>
  <h2>تسجيل الدخول</h2>
  <p class="lead">ادخل باسم المستخدم وكلمة المرور الخاصة بحسابك.</p>
  <div class="err" id="loginErr" role="alert" hidden></div>
  <div class="fld"><label for="username">اسم المستخدم</label><input id="username" name="username" class="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
  <div class="fld"><label for="password">كلمة المرور</label><div class="pw"><input id="password" name="password" type="password" class="ltr" autocomplete="current-password" required><button type="button" id="togglePass" aria-pressed="false">إظهار</button></div></div>
  <button class="btn primary go" id="loginBtn" type="submit">دخول</button>
  <p class="auth-foot">الحساب يعمل على جهازين فقط لكل معلم.</p>
</form>''')

SETUP = auth_shell('''<form class="auth-card" id="setupForm" novalidate>
  <h2>إنشاء حساب المدير</h2>
  <p class="lead">هذه الصفحة تظهر مرة واحدة فقط. الحساب اللي تنشئه الآن هو حساب لوحة التحكم.</p>
  <div class="err" id="loginErr" role="alert" hidden></div>
  <div class="fld"><label for="name">الاسم</label><input id="name" placeholder="اسمك كما سيظهر في المنصة" required></div>
  <div class="fld"><label for="username">اسم المستخدم (إنجليزي)</label><input id="username" class="ltr" autocomplete="username" autocapitalize="none" required></div>
  <div class="fld"><label for="password">كلمة المرور</label><input id="password" type="password" class="ltr" autocomplete="new-password" required></div>
  <div class="fld"><label for="password2">تأكيد كلمة المرور</label><input id="password2" type="password" class="ltr" autocomplete="new-password" required></div>
  <button class="btn primary go" type="submit">إنشاء الحساب</button>
</form>''')

TOP = lambda extra: f'''<header class="top">{BANNER}<div class="wrap top-in">
  <div class="brand"><div><h1 class="sr-only">خبير</h1>{extra}</div></div>
  <div class="actions whobar">%BTNS%</div></div></header>'''

MENU_ITEMS = [('quiz', '/quiz', '📝', 'التقويم والاختبارات'), ('homework', '/homework', '📒', 'الواجبات المنزلية'), ('diag', '/diag', '🧪', 'الاختبار التشخيصي'), ('games', '/games', '🎲', 'الألعاب التعليمية'),
              ('slides', '/slides', '📽️', 'العروض التقديمية'),
              ('remedial', '/remedial', '🩹', 'الخطط العلاجية والأنشطة الصفية'), ('summaries', '/summaries', '📚', 'ملخصات الدروس والوحدات'), ('cando', '/cando', '☑️', 'أستطيع أن ✓'), ('cards', '/cards', '🪪', 'كروت الأسئلة (بليكرز)'), ('analysis', '/analysis', '📊', 'تحليل نتائج الاختبارات'), ('ld', '/ld', '🧩', 'سجل صعوبات التعلم'), ('forms', '/forms', '🗂', 'النماذج الإدارية'), ('space', '/space', '🎒', 'مساحة الطالب'), ('research', '/research', '🔬', 'البحوث الإجرائية'), ('finals', '/finals', '🗂', 'الاختبارات النهائية السابقة')]
# «تصحيح الواجبات تلقائيًا» (/grading) مخفي من كل القوائم والبطاقات: يُفتح بالرابط المباشر فقط.
def NAV(active, extra=''):
    cur = lambda k: ' aria-current="page"' if k == active else ''
    h = '<span class="who" id="who"></span>'
    h += f'<a class="btn ghost small" href="/app"{cur("app")}>القائمة الرئيسية</a>'
    # «القيم الثابتة» لم تعد قسمًا مستقلًا: صارت حقولًا داخل تحضير كل درس (الاستراتيجيات
    # والوسائل ومصادر التعلم)، لأن كل مادة — بل كل درس — يحتاج قيمه الخاصة.
    h += '<button type="button" class="btn ghost small pulse" id="toolBtn">أداة نور</button>'
    # دليل الاستخدام: يُعاد فتحه متى شاء المعلم (يظهر تلقائيًّا في أول دخول)
    h += '<button type="button" class="btn ghost small" id="tourBtn" title="دليل الاستخدام">دليلك للاستخدام!</button>'
    # جرس الإشعارات: إعلانات ديناميكية يضيفها المدير من لوحة التحكم، بنقطة حمراء على غير المقروء.
    # يُرفق داخل .navmenu ليحصل على نفس موضع قائمة «المزيد» (position:fixed يضبطه common.js)
    h += '<div class="navmenu"><button type="button" class="btn ghost small bell-btn" id="bellBtn" aria-haspopup="true" aria-expanded="false" title="الإشعارات"><span class="bell-ic" aria-hidden="true">🔔</span><span class="bell-dot" id="bellDot" hidden></span></button><div class="menu-list bell-panel" id="bellPanel" role="dialog" aria-label="الإشعارات" hidden></div></div>'
    h += '<div class="navmenu"><button type="button" class="btn small menu-btn" id="menuBtn" aria-haspopup="true" aria-expanded="false" aria-label="المزيد"><span class="hb" aria-hidden="true"><span></span><span></span><span></span></span><span class="mb-t">المزيد</span></button><div class="menu-list" id="menuList" role="menu" hidden><div class="menu-head"><span class="mh-mark">' + LOGO + '</span><div><b>خبير</b><small>كل أقسام المنصة في مكان واحد</small></div></div>'
    for i, (k, href, ic, t) in enumerate(MENU_ITEMS):
        ext = ' target="_blank" rel="noopener"' if href.startswith('http') else ''
        dsc = _KB_DESC.get(href, '')
        h += f'<a role="menuitem" href="{href}"{ext}{cur(k)} style="--i:{i}"><span class="mi">{ic}</span><span class="mt"><b>{t}</b><small>{dsc}</small></span><span class="ma" aria-hidden="true">‹</span></a>'
    h += f'<a role="menuitem" class="admin-only" id="adminLink" href="/admin"{cur("admin")} hidden style="--i:15"><span class="mi">⚙</span><span class="mt"><b>لوحة التحكم</b><small>إدارة المعلمين والإشعارات</small></span><span class="ma" aria-hidden="true">‹</span></a>'
    h += extra
    h += '<hr><button type="button" role="menuitem" id="logoutBtn" style="--i:16"><span class="mi">⎋</span><span class="mt"><b>تسجيل الخروج</b><small>إنهاء الجلسة على هذا الجهاز</small></span></button></div></div>'
    return h

# ===== صفحة البداية بعد تسجيل الدخول: عقد أقسام (تُقدّم كل الأدوات بضغطة) =====
_KB_DESC = {
  '/app': 'دروس كل المواد جاهزة — عدّلها واطبعها وأرسلها إلى نور.',
  '/quiz': 'اختبارات قصيرة ومراجعات وفق الوثيقة، بالترويسة الرسمية.',
  '/homework': 'ورقة واجب منزلي بالدرجات وأنواع الأسئلة حسب وثيقة التقويم، بترويسة رسمية.',
  '/diag': 'اختبار تشخيصي للمادة كاملة: علوم ورياضيات مع تقرير بالطباعة.',
  '/grading': 'ارفع صورة أو ملف الواجب ويُصحَّح تلقائيًا بالمعايير.',
  '/games': 'ألعاب صفية للسبورة والتحدي المباشر بالجوالات.',
  '/slides': 'عروض تقديمية لكل درس، جاهزة للعرض بملء الشاشة.',
  '/remedial': 'خطط علاجية وأنشطة وواجب سريع لمواد العلوم.',
  '/summaries': 'ملخصات الدروس والوحدات مع خرائط ذهنية.',
  '/cando': 'مؤشرات «أستطيع أن» لكل درس بفروقات صفي.',
  '/cards': 'بطاقة لكل طالب: الأسئلة على السبورة، وتمسح إجابات الصف كله بكاميرا جوالك.',
  '/analysis': 'حلّل نتائج الطلبة وحدد المتعثّرين تلقائيًا.',
  '/ld': 'سجل وتقارير صعوبات التعلم جاهزة للتعبئة.',
  '/forms': 'نماذج إدارية وخطابات رسمية بخطوات قليلة.',
  '/space': 'مهمات وموارد لطالبك بمسح رمز استجابة.',
  '/research': 'بحوث إجرائية تُولَّد عبر بؤرة في خطوات ثابتة.',
  '/finals': 'اختبارات وزارية سابقة كاملة بأسئلتها.',
  '/searcher': 'بحث فوري في مصادر عُمان التعليمية (نافذة خارجية).',
}
def khome_cards():
    cards = [('/app', '📝', 'التحضير', _KB_DESC['/app'])]
    for _k, h, ic, t in MENU_ITEMS:
        if h == '/app': continue
        cards.append((h, ic, t, _KB_DESC.get(h, '')))
    return cards
KHOME = ('<div class="k-land"><header class="k-hd">'
  f'<a class="k-brand" href="/khome"><span class="k-mark">{LOGO}</span><span><b>خبير</b><small>منصة المعلمين</small></span></a>'
  '<nav class="k-nav"><span class="k-who" id="kWho"></span>'
  '<a class="k-chip solid" href="/app">✍ ابدأ التحضير</a>'
  '<button type="button" class="k-chip" id="kBtnLogout">⎋ خروج</button></nav></header>'
  '<section class="k-hero"><span class="k-kicker">كل أدوات المعلم قبل الحصة في مكان مرتب</span>'
  f'<h1 class="k-h1"><span class="k-mark big">{LOGO}</span>خبير</h1>'
  '<p class="k-lead">تحضير المواد وتقويمها وألعابها الصفية وعروضها وتحليل نتائجها ذاتها، وخطط علاجية للطلاب دون المستوى — بضغطات قليلة تنهي تجهيز حصتك وتزيد جوّها.</p>'
  '<div class="k-cta"><a class="k-btn" href="/app">✍ ابدأ التحضير</a><a class="k-btn ghost" href="/quiz">🧾 تكوين اختبار</a></div></section>'
  '<section class="k-cards" aria-label="أقسام المنصة">' + ''.join(
    f'<a class="k-c" href="{h}"{" target=\"_blank\" rel=\"noopener\"" if h.startswith("http") else ""} style="animation-delay:{i*.05:.2f}s">'
    f'<span class="k-ci" aria-hidden="true">{ic}</span><b>{t}</b><small>{d}</small></a>'
    for i, (h, ic, t, d) in enumerate(khome_cards())) + '</section>'
  '<p class="k-ft">خبير، منصة المعلمين</p></div>')


APP = TOP('<div class="stats"><span class="stat"><span id="statLessons">0</span> درسًا</span><span class="stat"><span id="statFilled">0</span> بتحضير جاهز</span><span class="stat">الفصل الدراسي الأول</span></div>').replace('%BTNS%',
  NAV('app')) + f'''
<div class="app-bar" id="appBar"><div class="get-app"><button type="button" class="ga-x" id="appBarX" aria-label="إخفاء الإعلان" title="إخفاء — تجده لاحقًا في «التطبيق والأدوات»">×</button><div><h3>📱 تطبيق «خبير» على الموبايل</h3><p>أرسل التحضير والواجب لنور من موبايلك بضغطة. الأداة مدمجة بدون Tampermonkey.</p></div><div class="ga-btns"><a class="ga-btn" href="/download/khaber.apk" download>⬇ أندرويد</a><button type="button" class="ga-btn alt" id="iosBtn">📲 آيفون</button><button type="button" class="ga-btn alt" id="pcBtn">💻 أداة الكمبيوتر</button></div></div></div>
<div class="wrap layout"><aside class="tree" id="tree" aria-label="الصفوف والوحدات والدروس"></aside>
<main class="panel" id="panel"><div class="welcome">{CELL}<h2>جارٍ تحميل الدروس…</h2></div></main></div>
<p class="foot">خبير، منصة المعلمين</p><div id="cellArt" hidden>{CELL}</div>'''

QUIZ = TOP('<div class="stats"><span class="stat">التقويم: الاختبارات القصيرة ومراجعات الوحدات</span><span class="stat">وفق وثيقة تقويم تعلم الطلبة</span></div>').replace('%BTNS%',
  NAV('quiz')) + '''
<div class="wrap qlayout"><aside class="qside" id="qside" aria-label="إعداد الاختبار"></aside>
<main class="panel" id="qmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<section class="wrap chkpanel" id="chkPanel" aria-label="فحص ورقة اختبار جاهزة">
  <h2 class="chk-h">🔍 افحص ورقة جاهزة</h2>
  <p class="chk-p">ارفع ملف <b>Word</b> أو <b>PDF</b> لاختبار قصير كتبته خارج المنصة، أو الصق نصّه — وتُفحص الورقة وفق وثيقة تقويم تعلّم الطلبة (الترقيم · العدد · الدرجات · صياغة السؤال · سلامة الخيارات).</p>
  <div class="chk-drop" id="chkDrop" tabindex="0" role="button" aria-label="اختيار ملف لفحصه">
    <div class="chk-ic">📄</div>
    <div><b>اسحب الملف هنا</b> أو <span class="chk-link">اختر ملفًا</span></div>
    <div class="chk-hint">Word (.docx) · PDF · نصّ (.txt)</div>
    <input type="file" id="chkFile" accept=".docx,.pdf,.txt" hidden>
  </div>
  <div class="chk-ok" id="chkFileOk" hidden role="status" aria-live="polite">
    <span class="chk-ok-ic">✓</span>
    <span id="chkFileOkTxt"></span>
    <button type="button" class="chk-ok-x" id="chkFileClear" aria-label="إزالة الملف">✕ إزالة</button>
  </div>
  <div class="chk-grid">
    <div class="chk-lb">
      <span class="chk-lbl-t">اختر الصف (واحد فقط)</span>
      <div class="chk-grades">
        <label><input type="radio" name="chkGrade" value="الخامس"> الخامس</label>
        <label><input type="radio" name="chkGrade" value="السادس"> السادس</label>
        <label><input type="radio" name="chkGrade" value="السابع"> السابع</label>
        <label><input type="radio" name="chkGrade" value="الثامن"> الثامن</label>
        <label><input type="radio" name="chkGrade" value="التاسع"> التاسع</label>
        <label><input type="radio" name="chkGrade" value="العاشر"> العاشر</label>
        <label><input type="radio" name="chkGrade" value="الحادي عشر" checked> الحادي عشر</label>
        <label><input type="radio" name="chkGrade" value="الثاني عشر"> الثاني عشر</label>
      </div>
    </div>
    <label class="chk-lb chk-grow">أو الصق نصّ الورقة
      <textarea id="chkText" rows="5" placeholder="مثال:&#10;1) ما المرحلة من دورة الماء … [1]&#10;2) اشرح كيف … [2]"></textarea>
    </label>
  </div>
  <label class="chk-cb"><input type="checkbox" id="chkAns" checked> <span>الملف يحتوي <b>نموذج الإجابة</b> (فيه AO1/AO2) — يُفحص توزيع الأهداف أيضًا</span></label>
  <div class="chk-row"><button class="btn primary" id="chkRun" type="button">افحص الورقة</button><span id="chkStat" class="chk-stat"></span></div>
  <div id="chkOut" class="chk-out"></div>
</section>
<div id="printArea"></div>'''
# «الواجبات المنزلية»: نفس محرّك التقويم (client_quiz.js) في وضع الواجب (PAGE_MODE='hw')
HOMEWORK = TOP('<div class="stats"><span class="stat">الواجبات المنزلية</span><span class="stat">درجات وأنواع الأسئلة وفق وثيقة التقويم 2026/2027</span></div>').replace('%BTNS%',
  NAV('homework')) + '''
<div class="wrap qlayout"><aside class="qside" id="qside" aria-label="إعداد الواجب المنزلي"></aside>
<main class="panel" id="qmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''

GAMES = TOP('<div class="stats"><span class="stat">ركن الألعاب التعليمية</span><span class="stat">لكل درس ولكل صف</span></div>').replace('%BTNS%',
  NAV('games')) + '''
<div class="wrap qlayout"><aside class="qside" id="gside" aria-label="اختيار الدروس"></aside>
<main class="panel" id="gmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>'''
REMEDIAL = TOP('<div class="stats"><span class="stat">الخطط العلاجية والأنشطة الصفية</span><span class="stat">للطلاب دون المستوى</span></div>').replace('%BTNS%', NAV('remedial')) + '''
<div class="wrap qlayout"><aside class="qside" id="qside" aria-label="إعداد الخطة"></aside>
<main class="panel" id="qmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''
DIAG = TOP('<div class="stats"><span class="stat">الاختبار التشخيصي: العلوم والرياضيات</span><span class="stat">يقيس مستوى المادة كاملة</span></div>').replace('%BTNS%', NAV('diag')) + '''
<div class="wrap qlayout"><aside class="qside" id="qside" aria-label="إعداد الاختبار"></aside>
<main class="panel" id="qmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''
SUMMARIES = TOP('<div class="stats"><span class="stat">ملخصات الدروس والوحدات</span><span class="stat">وفق مخرجات التعلم</span></div>').replace('%BTNS%', NAV('summaries')) + '''
<div class="wrap qlayout"><aside class="qside" id="qside" aria-label="اختيار الملخص"></aside>
<main class="panel" id="qmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''
FINALS_PAGE = TOP('<div class="stats"><span class="stat">الاختبارات النهائية السابقة</span><span class="stat">أسئلة الوزارة مصنّفة حسب الوحدة والدرس</span></div>').replace('%BTNS%', NAV('finals')) + '''
<div class="wrap qlayout"><aside class="qside" id="fside" aria-label="اختيار الوحدة"></aside>
<main class="panel" id="fmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''
GRADING = TOP('<div class="stats"><span class="stat">تصحيح الواجبات تلقائيًا</span><span class="stat">تجريبي</span></div>').replace('%BTNS%', NAV('grading')) + '''
<main class="wrap gr" id="gr"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main>'''
PLAY = '<main class="pl" id="pl"></main>'
SLIDES_PAGE = TOP('<div class="stats"><span class="stat">العروض التقديمية</span><span class="stat">عروض البوربوينت حسب المادة والصف</span></div>').replace('%BTNS%', NAV('slides')) + '''
<main class="wrap sl" id="sl"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main>'''

RESEARCH_PAGE = TOP('<div class="stats"><span class="stat">البحوث الإجرائية</span><span class="stat">بحوث جاهزة للطباعة والتحميل لكل مادة</span></div>').replace('%BTNS%', NAV('research')) + '''
<main class="wrap rs-wrap" id="rsMain"><div class="empty-state">جارٍ التحميل…</div></main>
<div id="printArea"></div>'''
ANALYSIS_PAGE = TOP('<div class="stats"><span class="stat">تحليل نتائج الاختبارات</span><span class="stat">تحليل المفردات ومستويات التعلم وتقرير جاهز للاعتماد</span></div>').replace('%BTNS%', NAV('analysis')) + '''
<main class="wrap an-wrap" id="anMain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main>
<div id="printArea"></div>'''
LD_PAGE = TOP('<div class="stats"><span class="stat">سجل الطلبة ذوي صعوبات التعلم</span><span class="stat">الجوانب والخطة الفردية والمتابعة</span></div>').replace('%BTNS%', NAV('ld')) + '''
<main class="wrap an-wrap" id="ldMain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main>
<div id="printArea"></div>'''
FORMS_PAGE = TOP('<div class="stats"><span class="stat">النماذج الإدارية</span><span class="stat">محاضر · تقارير · إشعارات · شهادات · ملف الإنجاز</span></div>').replace('%BTNS%', NAV('forms')) + '''
<main class="wrap an-wrap" id="fmMain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main>
<div id="printArea"></div>'''
SPACE_PAGE = TOP('<div class="stats"><span class="stat">مساحة الطالب</span><span class="stat">صفوف برمز يتدرب فيها طلابك بلا حساب</span></div>').replace('%BTNS%', NAV('space')) + '''
<main class="wrap an-wrap" id="spMain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main>'''
STUDENT_PAGE = '<main class="st" id="st"></main>'
CARDS_PAGE = TOP('<div class="stats"><span class="stat">كروت الأسئلة (بليكرز)</span><span class="stat">بطاقة لكل طالب · الأسئلة على السبورة · المسح بكاميرا الجوال</span></div>').replace('%BTNS%', NAV('cards')) + '''
<main class="wrap an-wrap" id="cdMain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main>
<div id="printArea"></div>'''
CANDO_PAGE = TOP('<div class="stats"><span class="stat">أستطيع أن ✓</span><span class="stat">قوائم التقييم الذاتي لكل وحدة</span><span class="stat">الفصل الدراسي الأول</span></div>').replace('%BTNS%', NAV('cando')) + '''
<div class="wrap layout cd-layout"><aside class="tree" id="tree" aria-label="المواد والصفوف والوحدات"></aside>
<main class="panel" id="panel"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''

ADMIN = TOP('<div class="stats"><span class="stat">لوحة التحكم</span></div>').replace('%BTNS%',
  NAV('admin', '<button type="button" role="menuitem" id="refreshBtn"><span class="mi">↻</span>تحديث البيانات</button>')) + '''
<main class="wrap dash" id="dash"><div class="empty-state">جارٍ تحميل البيانات…</div></main>'''

# ===== البحوث الإجرائية: data/research/*.md (رأس بين --- ثم أقسام Markdown) =====
def _md_inline(t):
    import html as _h
    t = _h.escape(t, quote=False)
    t = re.sub(r'\[([^\]]+)\]\((https?://[^)\s]+)\)', r'<a href="\2" target="_blank" rel="noopener">\1</a>', t)
    t = re.sub(r'(?<!["=>])(https?://[^\s<)]+)', r'<a href="\1" target="_blank" rel="noopener" dir="ltr">\1</a>', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'(?<![\*\w])\*([^*\n]+?)\*(?!\*)', r'<i>\1</i>', t)
    return t
def _md2html(md):
    out = []; lines = md.split('\n'); i = 0
    while i < len(lines):
        ln = lines[i]; st = ln.strip()
        if not st or st.startswith('<!--'): i += 1; continue
        if st.startswith('```'):
            j = i + 1; buf = []
            while j < len(lines) and not lines[j].strip().startswith('```'): buf.append(lines[j]); j += 1
            import html as _h
            out.append('<pre class="rs-eq" dir="ltr">' + _h.escape('\n'.join(buf)) + '</pre>'); i = j + 1; continue
        m = re.match(r'^(#{2,4})\s+(.*)$', st)
        if m: lv = len(m.group(1)); out.append('<h%d>%s</h%d>' % (lv, _md_inline(m.group(2)), lv)); i += 1; continue
        if st.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-{3,}:?', c) for c in cells if c): rows.append(cells)
                i += 1
            h = '<div class="rs-tw"><table class="rs-t"><thead><tr>' + ''.join('<th>%s</th>' % _md_inline(c) for c in rows[0]) + '</tr></thead><tbody>'
            for r in rows[1:]: h += '<tr>' + ''.join('<td>%s</td>' % _md_inline(c) for c in r) + '</tr>'
            out.append(h + '</tbody></table></div>'); continue
        if re.match(r'^(\d+\.|-)\s', st):
            ol = bool(re.match(r'^\d+\.', st)); items = []
            while i < len(lines) and re.match(r'^(\d+\.|-)\s', lines[i].strip()):
                items.append(re.sub(r'^(\d+\.|-)\s+', '', lines[i].strip())); i += 1
            tg = 'ol' if ol else 'ul'
            out.append('<%s>%s</%s>' % (tg, ''.join('<li>%s</li>' % _md_inline(x) for x in items), tg)); continue
        buf = [st]; i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#|\||```|\d+\.\s|-\s|<!--)', lines[i].strip()):
            buf.append(lines[i].strip()); i += 1
        out.append('<p>%s</p>' % _md_inline(' '.join(buf)))
    return '\n'.join(out)
def _research():
    d = os.path.join(DATA, 'research'); items = []
    if not os.path.isdir(d): return items
    for fn in sorted(os.listdir(d)):
        if not fn.endswith('.md'): continue
        raw = open(os.path.join(d, fn), encoding='utf-8').read()
        meta = {}; body = raw
        if raw.startswith('---'):
            _, head, body = raw.split('---', 2)
            for l in head.strip().split('\n'):
                k, _, v = l.partition(':'); meta[k.strip()] = v.strip()
        meta['html'] = _md2html(body)
        items.append(meta)
    return items
RESEARCH = _research()
FIN = json.load(open(os.path.join(DATA, 'finals.json'), encoding='utf-8')) if os.path.exists(os.path.join(DATA, 'finals.json')) else {}
# عروض تقديمية: فهرسها في site/data/slides.json (كل عرض بمعرّف درايف عام) —
# تُعاين وتُحمَّل بروابط درايف المباشرة، ولا تُخزَّن محليًّا لأن حجمها (2+ GB)
# أكبر من سعة الاستضافة المجانية.
SLIDES = json.load(open(os.path.join(DATA, 'slides.json'), encoding='utf-8')) if os.path.exists(os.path.join(DATA, 'slides.json')) else []
# «أستطيع أن ✓»: قوائم التقييم الذاتي لكل وحدة — data/cando.json (يُبنى من data/cando_src بأداة tools/build_cando.py)
CANDO = json.load(open(os.path.join(DATA, 'cando.json'), encoding='utf-8')) if os.path.exists(os.path.join(DATA, 'cando.json')) else {}
PAGES = {
  'css': CSS,
  'login': page('خبير', LOGIN, rd('client_login.js')),
  'setup': page('إعداد خبير', SETUP, rd('client_login.js')),
  'app': page('خبير', APP, rd('client_app.js')),
  'admin': page('لوحة التحكم · خبير', ADMIN, rd('client_admin.js')),
  'quiz': page('التقويم · خبير', QUIZ, rd('client_quiz.js') + chr(10) + rd('client_checker.js')),
  'homework': page('الواجبات المنزلية · خبير', HOMEWORK, "window.PAGE_MODE='hw';" + chr(10) + rd('client_quiz.js')),
  'games': page('الألعاب التعليمية · خبير', GAMES, rd('vendor/qr.js') + chr(10) + rd('client_games.js').replace('// @@FX@@', rd('client_fx.js')).replace('// @@TUG@@', rd('client_tug.js') + chr(10) + rd('client_arcade.js') + chr(10) + rd('client_runner.js'))),
  'play': page('تحدي خبير', PLAY, rd('client_play.js')),
  'grading': page('تصحيح الواجبات · خبير', GRADING, rd('client_grading.js')),
  'remedial': page('الخطط العلاجية · خبير', REMEDIAL, "window.PAGE_KIND='remedial';" + chr(10) + rd('client_study.js')),
  'diag': page('الاختبار التشخيصي · خبير', DIAG, rd('client_diag.js')),
  'finals': page('الاختبارات النهائية · خبير', FINALS_PAGE, 'window.FIN_INDEX=' + json.dumps({k: len(v['q']) for k, v in FIN.items()}, ensure_ascii=False) + ';' + chr(10) + rd('client_finals.js')),
  'summaries': page('ملخصات الدروس · خبير', SUMMARIES, "window.PAGE_KIND='summaries';" + chr(10) + rd('client_study.js')),
  'analysis': page('تحليل نتائج الاختبارات · خبير', ANALYSIS_PAGE, rd('client_analysis.js')),
  'ld': page('سجل صعوبات التعلم · خبير', LD_PAGE, rd('client_ld.js')),
  'forms': page('النماذج الإدارية · خبير', FORMS_PAGE, rd('client_forms.js')),
  'cards': page('كروت الأسئلة · خبير', CARDS_PAGE, rd('vendor/qr.js') + chr(10) + rd('client_cardscan.js') + chr(10) + rd('client_cards.js')),
  'space': page('مساحة الطالب · خبير', SPACE_PAGE, rd('vendor/qr.js') + chr(10) + rd('client_space.js')),
  'student': page('مساحة الطالب', STUDENT_PAGE, rd('client_student.js')),
  'research': page('البحوث الإجرائية · خبير', RESEARCH_PAGE, 'window.RESEARCH=' + json.dumps(RESEARCH, ensure_ascii=False, separators=(',', ':')) + ';' + chr(10) + rd('client_rsgen.js') + chr(10) + rd('client_research.js')),
  'cando': page('أستطيع أن · خبير', CANDO_PAGE, 'window.CANDO=' + json.dumps(CANDO, ensure_ascii=False, separators=(',', ':')) + ';' + chr(10) + rd('client_cando.js')),
  'slides': page('العروض التقديمية · خبير', SLIDES_PAGE, 'window.SLIDES=' + json.dumps(SLIDES, ensure_ascii=False) + ';' + chr(10) + rd('client_slides.js')),
}

src = rd('worker_src.js')
src = src.replace('__LESSONS__', json.dumps(lessons, ensure_ascii=False, separators=(',', ':')))
src = src.replace('__PAGES__', json.dumps(PAGES, ensure_ascii=False, separators=(',', ':')))
src = src.replace('__TOOL__', json.dumps(rd('tahdir-noor.user.js'), ensure_ascii=False))
src = src.replace('__ICONS__', json.dumps({**json.loads(rd('icons.json')), **BRAND_ICONS}))
# الحزم الكبيرة (الملخصات والألعاب والاختبارات النهائية) تُنشر ملفات ثابتة باسم مشتق من محتواها، ويحمّلها العامل عند الحاجة
import hashlib as _hl
def _study_with_mm():
    # دمج الخرائط الذهنية (data/mindmaps.json) داخل حزمة الملخصات: study.lessons[id].mm
    st = json.load(open(os.path.join(DATA, 'study_pack.json'), encoding='utf-8'))
    mp = os.path.join(DATA, 'mindmaps.json')
    if os.path.exists(mp):
        for k, v in json.load(open(mp, encoding='utf-8')).items():
            st['lessons'].setdefault(str(k), {})['mm'] = v
    for k, v in _AR_STUDY.items():
        st['lessons'].setdefault(k, {}).update(v)
    return st
_PK = {'study': _untat(_study_with_mm()), 'games': _untat(json.load(open(os.path.join(DATA, 'games_pack.json'), encoding='utf-8'))), 'finals': _untat(FIN)}
_PB = {k: json.dumps(v, ensure_ascii=False, separators=(',', ':')).encode('utf-8') for k, v in _PK.items()}
_PH = _hl.sha256(b''.join(_PB.values())).hexdigest()[:24]
import shutil as _sh
if os.path.isdir(os.path.join(DIST, 'assets', 'd')):
    for _o in os.listdir(os.path.join(DIST, 'assets', 'd')):
        if _o != _PH: _sh.rmtree(os.path.join(DIST, 'assets', 'd', _o), ignore_errors=True)
_PD = os.path.join(DIST, 'assets', 'd', _PH); os.makedirs(_PD, exist_ok=True)
for k, b in _PB.items(): open(os.path.join(_PD, k + '.json'), 'wb').write(b)
if os.path.isdir(os.path.join(HERE, '..', 'vendor', 'promo')): _sh.copytree(os.path.join(HERE, '..', 'vendor', 'promo'), os.path.join(DIST, 'assets', 'promo'), dirs_exist_ok=True)
src = src.replace('__PACKDIR__', json.dumps('/d/' + _PH + '/'))
src = src.replace('__QBANK__', json.dumps(qbank, ensure_ascii=False, separators=(',', ':')))
src = src.replace('__BUILD__', json.dumps(BUILD))
# أسئلة ألعاب الرياضيات المولّدة (اختيارية: تُبنى فارغة إن لم يوجد الملف)
_gm = os.path.join(DATA, 'games_math.json')
src = src.replace('__GAMESMATH__', json.dumps(json.load(open(_gm, encoding='utf-8')) if os.path.exists(_gm) else [], ensure_ascii=False, separators=(',', ':')))
src = src.replace('__PRIVACY__', json.dumps(rd('privacy.html'), ensure_ascii=False))
import base64 as _b64
# إضافة كروم/إيدج: تُبنى من نفس سكربت الأداة (tools/build_ext.py) وتُخدم على /download/khabeer-ext.zip
subprocess.run([sys.executable, os.path.join(HERE, '..', 'tools', 'build_ext.py')], check=True, capture_output=True)
_ext_zip = os.path.join(HERE, '..', 'dist', 'khabeer-ext-' + TOOL_VER + '.zip')
src = src.replace('__EXTZIP__', json.dumps(_b64.b64encode(open(_ext_zip, 'rb').read()).decode() if os.path.exists(_ext_zip) else ''))
src = src.replace('__APK__', json.dumps(_b64.b64encode(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'khabeer.apk'),'rb').read()).decode()))
out = os.path.join(DIST, 'worker.js')
open(out, 'w', encoding='utf-8').write(src)
print('worker.js', round(len(src.encode('utf-8')) / 1024), 'KB')
