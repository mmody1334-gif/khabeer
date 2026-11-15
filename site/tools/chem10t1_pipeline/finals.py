# -*- coding: utf-8 -*-
"""الاختبارات النهائية السابقة — الكيمياء — الصف العاشر — الفصل الدراسي الأول.

يقرأ أوراق الوزارة (الطبقة النصية) ونماذج إجاباتها:
  - مراسي الأسئلة: رقم السؤال في الهامش الأيمن (قد يُقرأ معكوسًا «61» = 16) ويُحلّ بالتسلسل.
  - صورة لكل سؤال من مرساه إلى مرسى السؤال التالي (عبر الصفحات)، مع qb لتبييض الرقم الأصلي.
  - نموذج الإجابة: جدول (الجزئية · الإجابة · الدرجة · رقم الهدف · هدف التقويم · مستوى الصعوبة · الصفحة · الوحدة).
    الدرجة والهدف والمستوى من النموذج الرسمي نفسه؛ والدرس من رقم صفحة الكتاب.
الاستخدام: python3 finals.py <SITE> <مجلد ملفات PDF>   (يكتب finals.json[الكيمياء|العاشر] + finals/img/chem10)
"""
import hashlib, json, os, re, sys, unicodedata
import pdfplumber, pymupdf
from PIL import Image
import numpy as np

SITE, SRC = sys.argv[1], sys.argv[2]
KEY, SLUG, BASE = 'الكيمياء|العاشر', 'chem10', 2600
# (معرّف الورقة، الملف، صفحات الأسئلة، صفحات النموذج، العام، الدور، الدرجة الكلية)
PAPERS = [
    ('k10a-0', 'y2526.pdf', (2, 15), (18, 23), '2025-2026', 'الدور الأول', 60),
    ('k10b-0', 'y2425.pdf', (2, 13), (16, 20), '2024-2025', 'الدور الأول', 60),
    ('k10b-1', 'y2425.pdf', (22, 31), (34, 40), '2024-2025', 'الدور الثاني', 60),
]
# صفحة بداية كل درس في كتاب الطالب (ترقيم الكتاب) — من فهرس الكتاب؛ صفحات «أسئلة نهاية الوحدة» للمراجعة
STARTS = [(15, 0), (17, 1), (19, 2), (23, 3), (33, 4), (35, 5), (39, 6), (42, 7), (45, 8), (50, 9),
          (52, 10), (59, 11), (61, 12), (65, 13), (69, 14), (78, 15), (80, 16), (86, 17), (90, 18), (99, 19)]
UNIT_OF = {0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 4, 17: 4, 18: 4, 19: 4}
UNITS = {'الأولى': 1, 'الثانية': 2, 'الثالثة': 3, 'الرابعة': 4}
AO = {'معرفة': 'معرفة', 'تطبيق': 'تطبيق', 'استدلال': 'استدلال', 'استقصاء': 'استقصاء'}
AR = re.compile(r'[؀-ۿ]')


# ---- إصلاح النص العربي المستخرج (ترتيب «لا» المركّب ومبادلات حروف متجاورة) — على نمط ss12_pipeline/fixar.py
import collections, itertools, glob
ARW = re.compile(r'[\u0621-\u064A]+')
def _strip_h(w): return re.sub(r'[\u064B-\u0652]', '', w)
V = collections.Counter()
for f in [os.path.join(SITE, 'data', x) for x in ('lessons.json', 'quiz_bank.json', 'study_pack.json', 'arabic_lessons_g5_to_g12.json')] + glob.glob(os.path.join(SITE, 'data', 'bio_bank', '*.txt')):
    if os.path.exists(f):
        for w in ARW.findall(_strip_h(unicodedata.normalize('NFKC', open(f, encoding='utf-8').read()))): V[w] += 1
PRE = ['', 'و', 'ف', 'ب', 'ك', 'ل', 'وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'وب', 'ول', 'وس']
def _known(w):
    if V[w] >= 2: return True
    return any(p and w.startswith(p) and V[w[len(p):]] >= 2 and len(w) - len(p) >= 3 for p in PRE)
def _fixword(w):
    b = _strip_h(w)
    if _known(b) or len(b) < 3: return w
    n = len(b); cands = []
    for k in (1, 2, 3):
        for combo in itertools.combinations(range(n - 1), k):
            if any(combo[i + 1] - combo[i] < 2 for i in range(len(combo) - 1)): continue
            c = list(b)
            for i in combo: c[i], c[i + 1] = c[i + 1], c[i]
            c = ''.join(c)
            if _known(c): cands.append((k, -V[c], c))
        if cands: break
    return sorted(cands)[0][2] if cands else w
def fixtext(s):
    s = unicodedata.normalize('NFKC', s or '')
    s = re.sub(r'[\u0640\u200c-\u200f\u202a-\u202e\ufeff]', '', s)
    s = re.sub(r'([ء-ي]) ([ةى])(?=[^ء-ي]|$)', r'\1\2', s)
    s = re.sub(r'(^|[^ء-ي])ا([لم])(ل|أ|إ|ا|آ)?', lambda m: m.group(1) + ('ال' + m.group(3) if m.group(2) == 'ل' and m.group(3) in ('أ', 'إ', 'ا', 'آ') else 'ا' + m.group(2) + (m.group(3) or '')), s)
    s = re.sub(r'(^|[^ء-ي])امل(?=[ء-ي]{2})', r'\1الم', s)
    for a, b in (('يف', 'في'), ('إىل', 'إلى'), ('عىل', 'على'), ('اىل', 'الى'), ('حتى', 'حتى')):
        s = re.sub(r'(^|[^ء-ي])' + a + r'(?=[^ء-ي]|$)', r'\1' + b, s)
    return ARW.sub(lambda m: _fixword(m.group(0)), s)


# صفوف نموذج الإجابة التي لا يفصلها مستخرج الجداول (خلايا مدمجة) — قُرئت من صورة الصفحة 36 في ملف 2024/2025
MISSING = {'k10b-1': [
    {'n': 15, 'sub': '', 'ans': 'المرحلة (1): يتم تسخين الخارصين بوجود الهواء. المرحلة (2): اختزال أكسيد الخارصين بالكربون.', 'm': 2, 'ao': 'AO1', 'dif': '', 'page': 36, 'unit': None, 'code': '7.1'},
    {'n': 16, 'sub': '', 'ans': 'السبب: قوته وكثافته المنخفضة، وتكوّن طبقة من أكسيد الألومنيوم تحمي سطح الفلز من التآكل.', 'm': 1, 'ao': 'AO1', 'dif': '', 'page': 45, 'unit': None, 'code': '7.10'}]}

# مفردات الاستقصاء بلا رقم صفحة في النموذج: الدرس من موضوع السؤال
LESSON_FIX = {('k10a-0', 2): 2, ('k10a-0', 9): 8, ('k10a-0', 29): 18}

# إجابات في النموذج مظللة أو مرسومة (لا نص لها) — قُرئت من صور صفحات نموذج الإجابة
ANS_FIX = {
    ('k10a-0', 26): 'التمثيل البياني الذي تزداد فيه درجة الغليان بانتظام بزيادة عدد ذرات الكربون (من نحو −160 °C عند ذرة واحدة إلى نحو 150 °C عند تسع ذرات).',
    ('k10b-0', 5): 'A: الليثيوم، B: البوتاسيوم، C: الصوديوم.',
    ('k10b-0', 13): 'أدوات المائدة.',
    ('k10b-0', 16): '4',
    ('k10b-0', 22): 'C4H10',
    ('k10b-0', 24): 'الصيغة البنائية للإيثان: H3C–CH3 (ذرتا كربون بينهما رابطة أحادية، وكل منهما مرتبطة بثلاث ذرات هيدروجين).',
    ('k10b-0', 27): 'الهيدروكربون المشبع: الأنبوبة B، صيغته C2H6. الهيدروكربون غير المشبع: الأنبوبة A، صيغته C2H4.',
    ('k10b-0', 28): 'A و C',
    ('k10b-0', 30): 'الأقل لزوجة: W ، الأعلى تطايرًا: W',
    ('k10b-1', 5): 'A',
    ('k10b-1', 9): 'ترتيب النشاط تصاعديًا: Y ثم X ثم Z (Z الأكثر نشاطًا).',
    ('k10b-1', 10): 'الفولاذ اللين: سهل التشكيل، ليس هشًا. الفولاذ المقاوم للصدأ: متين، لا يتآكل. الحديد الصلب: أرخص من الفولاذ، سهل الصب في قوالب.',
    ('k10b-1', 20): 'الكتلة المولية: S = 32 g/mol، O = 16 g/mol. عدد المولات: S = 1 mol، O = 2 mol. أبسط نسبة 1 : 2. الصيغة: SO2.',
    ('k10a-0', 28): 'أ. X: البروبان CH3–CH2–CH3 ، Z: ثنائي برومو البروبان CH3–CHBr–CH2Br ، Y: البروبانول CH3–CH2–CH2OH / ب. تفاعل هدرجة.',
}

def lesson_of(page):
    best = None
    for p, i in STARTS:
        if page >= p: best = i
    return best


def vis2log(s):
    """نص جدول pdfplumber مقلوب بصريًا: نقلب السطر ثم نعيد الأجزاء اللاتينية/الرقمية إلى اتجاهها."""
    out = []
    for line in (s or '').split('\n'):
        if not AR.search(unicodedata.normalize('NFKC', line)):
            out.append(unicodedata.normalize('NFKC', line).strip()); continue
        # نقلب قبل NFKC حتى يبقى حرف «لا» المركّب حرفًا واحدًا فلا ينعكس ترتيبه
        r = unicodedata.normalize('NFKC', line[::-1])
        r = re.sub(r'[A-Za-z0-9][A-Za-z0-9 ()+\-.,/=→:%\[\]²³⁺⁻]*[A-Za-z0-9)\]]|[A-Za-z0-9]', lambda m: m.group(0)[::-1], r)
        r = r.translate(str.maketrans('()[]', ')(]['))
        r = re.sub(r'\)([A-Za-z0-9+\-]+)\(', r'(\1)', r)
        out.append(r.strip())
    return fixtext(' '.join(x for x in out if x))


def answers(pdf, rng):
    """جداول نماذج الإجابة تختلف بين الأعوام؛ نحدد الأعمدة من عناوينها."""
    rows, cols, cur = [], None, None
    with pdfplumber.open(pdf) as P:
        for pn in range(rng[0], rng[1] + 1):
            for t in P.pages[pn - 1].extract_tables():
                for r in t:
                    h = [vis2log(c).replace(' ', '') for c in r]
                    if any(x in ('الإجابة', 'الاجابة') for x in h):
                        cols = {}
                        for k, x in enumerate(h):
                            if x in ('المفردة', 'الجزئية'): cols['n'] = k
                            elif x in ('الإجابة', 'الاجابة'): cols['ans'] = k
                            elif x == 'الدرجة': cols['m'] = k
                            elif 'الصفحة' in x: cols['page'] = k
                            elif x in ('هدفالتقويم', 'مستوىالتعلم', 'هدف'): cols['ao'] = k
                            elif x.startswith('مستوى'): cols['dif'] = k
                            elif x == 'الوحدة': cols['unit'] = k
                            elif x in ('رقمالهدف', 'هدفالتعليم', 'رقم'): cols['code'] = k
                        # عمود الجزئية غير المعنون (2024/2025): بين الإجابة والمفردة
                        if 'n' in cols and 'ans' in cols and cols['n'] - cols['ans'] == 2: cols['sub'] = cols['n'] - 1
                        continue
                    if not cols or len(r) <= max(cols.values()): continue
                    g = lambda k: (r[cols[k]] or '') if k in cols else ''
                    raw = unicodedata.normalize('NFKC', g('n')).replace('\n', '').replace(' ', '')
                    m = re.match(r'^(\d{1,2})([أبجده]?)$', raw) or re.match(r'^([أبجده])(\d{1,2})$', raw)
                    if m:
                        n, sub = (m.group(1), m.group(2)) if m.group(1).isdigit() else (m.group(2), m.group(1))
                        cur = int(n)
                    elif raw == '' and cur is not None and (g('ans') or g('m')):
                        sub = ''
                    else:
                        continue
                    if 'sub' in cols:
                        sub = sub or unicodedata.normalize('NFKC', g('sub')).strip()
                    mt = g('m'); bk = re.findall(r'\[(\d+)\]', mt)
                    mk = int(bk[-1]) if bk else sum(int(x) for x in re.findall(r'\d+', mt))
                    aov = ' '.join(vis2log(c).replace(' ', '') for c in r if c)
                    ao = next((v for v in ('AO1', 'AO2', 'AO3', 'معرفة', 'تطبيق', 'استدلال', 'استقصاء') if v in aov), '')
                    pg = [int(x) for x in re.findall(r'\d{1,3}', g('page'))]
                    rows.append({'n': cur, 'sub': sub, 'ans': vis2log(g('ans')), 'm': mk, 'ao': ao,
                                 'dif': next((v for v in ('منخفض', 'متوسط', 'مرتفع') if v in aov), ''), 'page': min(pg) if pg else None,
                                 'unit': UNITS.get(vis2log(g('unit')).replace(' ', '')), 'code': g('code').replace('\n', '').replace(' ', '')})
    return rows


def spans(page):
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                t = s['text'].strip()
                if t: yield t, s['bbox']


def anchors(doc, rng):
    W = doc[rng[0] - 1].rect.width
    cands = []
    for pn in range(rng[0], rng[1] + 1):
        for t, bb in spans(doc[pn - 1]):
            if bb[2] < W * 0.9: continue
            m = re.match(r'^[\-\s‪]*(\d{1,2})\s*[\)\-]?\s*', unicodedata.normalize('NFKC', t))
            if m and (len(t.strip()) <= 5 or bb[0] > W * 0.85 or re.match(r'^\d{1,2}\s*[\)\-]', t.strip())):
                cands.append((pn, bb[1], m.group(1), bb))
    cands.sort(key=lambda c: (c[0], c[1]))
    out, exp = [], 1
    for pn, y, d, bb in cands:
        if int(d) == exp or (len(d) == 2 and int(d[::-1]) == exp):
            out.append((exp, pn, y, bb)); exp += 1
    return out


def render(doc, pn, cache={}):
    k = (id(doc), pn)
    if k not in cache:
        pix = doc[pn - 1].get_pixmap(dpi=150, colorspace=pymupdf.csGRAY)
        a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width).copy()
        sc = 150 / 72
        a[:int(125 * sc), :int(a.shape[1] * 0.2)] = 255   # مربع رقم الصفحة أعلى اليسار
        a[int(727 * sc):, :] = 255                          # رقم الصفحة أسفلها
        for t, bb in spans(doc[pn - 1]):                    # «انتهت الأسئلة…» وما بعدها
            if 'انتهت' in unicodedata.normalize('NFKC', t) or 'انتهت' in unicodedata.normalize('NFKC', t)[::-1]:
                a[int((bb[1] - 4) * sc):, :] = 255
        cache[k] = a
    return cache[k]


def crop(doc, a, nxt, last_page):
    sc = 150 / 72
    n, pn, y, bb = a
    segs, qb = [], None
    p = pn
    while True:
        arr = render(doc, p); H = arr.shape[0]
        top = (y - 6) * sc if p == pn else 60 * sc
        if nxt and nxt[1] == p: bot = (nxt[2] - 6) * sc
        else: bot = H * 0.93
        seg = arr[int(top):int(bot), int(arr.shape[1] * 0.03):int(arr.shape[1] * 0.97)]
        if p == pn:
            x0 = int(bb[0] * sc - arr.shape[1] * 0.03) - 4
            qb = [x0, 0, int((bb[2] - bb[0]) * sc) + 14, int((bb[3] - bb[1]) * sc) + 10]
        segs.append(seg)
        if (nxt and nxt[1] == p) or p >= (nxt[1] if nxt else last_page): break
        p += 1
    out = []
    for s in segs:
        ink = (s < 200).any(1)
        if ink.any():
            lo, hi = np.argmax(ink), len(ink) - np.argmax(ink[::-1])
            if s is segs[0]: lo = 0
            out.append(s[max(0, lo - 4):hi + 6])
    w = max(s.shape[1] for s in out)
    img = Image.fromarray(np.vstack([np.pad(s, ((0, 0), (0, w - s.shape[1])), constant_values=255) for s in out]))
    f = 1.0
    if img.width > 1000:
        f = 1000 / img.width; img = img.resize((1000, int(img.height * f)), Image.LANCZOS)
    qb = [int(v * f) for v in qb]
    return img, qb


def text_of(doc, a, nxt):
    """نص السؤال بترتيبه المنطقي من pdftotext (لا من pymupdf الذي يعكس ترتيب الكلمات العربية)."""
    import subprocess
    n, pn, y, bb = a
    t, p = [], pn
    while True:
        r = doc[p - 1].rect
        y0 = y - 2 if p == pn else 60
        y1 = nxt[2] - 2 if nxt and nxt[1] == p else r.height * 0.93
        t.append(subprocess.run(['pdftotext', '-f', str(p), '-l', str(p), '-r', '72', '-x', '0', '-y', str(int(y0)), '-W', str(int(r.width)),
                                 '-H', str(max(1, int(y1 - y0))), doc.name, '-'], capture_output=True, text=True).stdout)
        if (nxt and nxt[1] == p) or (nxt is None) or p >= nxt[1]: break
        p += 1
    s = unicodedata.normalize('NFKC', '\n'.join(t)).replace('\u202b', '').replace('\u202c', '').replace('\u202a', '').replace('\x0c', '')
    s = re.sub(r'_{2,}', ' ', s); s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n\s*\n+', '\n', s).strip()
    s = re.sub(r'(^|\n)\s*\)\s*(\d{1,2})\s*', r'\1\2) ', s)
    s = re.sub(r'\(\s*\)\s*([A-Za-z0-9][A-Za-z0-9 ,،.\-]*?)(?=\s*[\u0600-\u06FF]|$)', lambda m: '(' + m.group(1).strip() + ') ', s)
    s = fixtext(s)
    for a, b in (('حامية', 'حماية'), ('مل يحدث', 'لم يحدث'), ('ميثّل', 'يمثّل'), ('ميثل', 'يمثل'), ('ثالثة', 'ثلاثة'), ('ثالث عناصر', 'ثلاثة عناصر'), (' بني ال', ' بين ال'), ('يبني ', 'يبيّن '), ('ّيبني', 'يبيّن'), ('ّبيني', 'يبيّن')):
        s = s.replace(a, b)
    return s


def main():
    L = {l['id']: l for l in json.load(open(os.path.join(SITE, 'data', 'lessons.json'), encoding='utf-8'))}
    imgdir = os.path.join(SITE, 'finals', 'img', SLUG)
    os.makedirs(imgdir, exist_ok=True)
    G = {'subject': 'الكيمياء', 'grade': 'العاشر', 'units': {str(u): L[BASE + i]['unit_name'] for i, u in UNIT_OF.items()}, 'papers': {}, 'q': []}
    report = []
    for pid, fn, qr, ar, year, sess, total in PAPERS:
        qf, af = (fn, fn) if isinstance(fn, str) else fn
        doc = pymupdf.open(os.path.join(SRC, qf))
        A = anchors(doc, qr)
        rows = answers(os.path.join(SRC, af), ar) + MISSING.get(pid, [])
        by = {}
        for r in rows: by.setdefault(r['n'], []).append(r)
        msum = sum(r['m'] or 0 for r in rows)
        report.append(f'{pid}: anchors {len(A)} (last {A[-1][0] if A else 0}), answer rows {len(rows)}, marks {msum}/{total}')
        G['papers'][pid] = {'year': year, 'term': 1, 'session': sess, 'region': '', 'total': total}
        for i, a in enumerate(A):
            n = a[0]; parts = by.get(n, [])
            if not parts:
                report.append(f'  {pid} q{n}: no answer row'); continue
            nxt = A[i + 1] if i + 1 < len(A) else None
            img, qb = crop(doc, a, nxt, qr[1])
            qid = hashlib.md5(f'{pid}-{n}'.encode()).hexdigest()[:10]
            img.save(os.path.join(imgdir, qid + '.webp'), 'WEBP', quality=60, method=6)
            m = sum(p['m'] or 0 for p in parts)
            lid = [lesson_of(p['page']) for p in parts if p['page'] and lesson_of(p['page']) is not None]
            # الهدف: الهدف صاحب الدرجات الأكثر (عند التعادل الأعلى مستوى)
            w = {}
            for p in parts: w[p['ao']] = w.get(p['ao'], 0) + (p['m'] or 0)
            rank = {'معرفة': 0, 'AO1': 0, 'تطبيق': 1, 'AO2': 1, 'استدلال': 2, 'استقصاء': 3, '': -1}
            ao = max(w, key=lambda k: (w[k], rank.get(k, -1))) if w else ''
            l1 = BASE + lid[0] if lid else None
            if (pid, n) in LESSON_FIX: l1 = BASE + LESSON_FIX[(pid, n)]
            if l1 is None:
                u = next((p['unit'] for p in parts if p['unit']), None)
                l1 = BASE + {1: 4, 2: 9, 3: 15, 4: 19}[u] if u else None
            l2 = next((BASE + x for x in lid if BASE + x != l1), None)
            mcq = len(parts) == 1 and m == 1 and bool(re.search(r'ظلل|ضع دائرة|☐|▢', _strip_h(text_of(doc, a, nxt))))
            ans = ' / '.join((p['sub'] + '. ' if p['sub'] else '') + p['ans'] for p in parts)
            ans = ANS_FIX.get((pid, n), ans)
            G['q'].append({'id': qid, 'p': pid, 'n': str(n), 'm': m, 't': 'mcq' if mcq else ('short' if m <= 2 else 'structured'),
                           'x': text_of(doc, a, nxt), 'a': ans, 'as': 'ms', 'c': parts[0].get('code', ''), 'ao': ao,
                           'u': str(L[l1]['unit']) if l1 else '', 'l': l1, 'l2': l2,
                           'im': f'{SLUG}/{qid}.webp', 'w': img.width, 'h': img.height, 'qb': qb})
    fp = os.path.join(SITE, 'data', 'finals.json')
    F = json.load(open(fp, encoding='utf-8'))
    F[KEY] = G
    json.dump(F, open(fp, 'w', encoding='utf-8'), ensure_ascii=False)
    print('\n'.join(report))
    for pid in G['papers']:
        qs = [q for q in G['q'] if q['p'] == pid]
        print(pid, len(qs), 'items', sum(q['m'] for q in qs), 'marks', {k: sum(1 for q in qs if q['ao'] == k) for k in ('معرفة', 'تطبيق', 'استدلال', 'استقصاء', '')})



def merge_labels(raw_path):
    """يدمج lb (مواضع رقم الشكل/الجدول) من fin_labels.py لهذا المقرر فقط؛ qb من الطبقة النصية يبقى إن لم يُقرأ."""
    fp = os.path.join(SITE, 'data', 'finals.json')
    F = json.load(open(fp, encoding='utf-8'))
    R = {r['im']: r for r in json.load(open(raw_path, encoding='utf-8'))}
    G = F[KEY]; side = {}
    for q in G['q']:
        for b in (R.get(q['im']) or {}).get('lb', []):
            if not b[7]: side.setdefault(q['p'], []).append('R' if b[6] == 'l' else 'L')
    n = 0
    for q in G['q']:
        r = R.get(q['im']) or {}
        if r.get('qb'): q['qb'] = r['qb']
        out = []
        for b in r.get('lb', []):
            sd = 'R' if b[6] == 'l' else 'L'
            if b[7]:
                v = side.get(q['p'], []); sd = 'L' if v.count('L') > v.count('R') else 'R'
            box = b[9] if sd == 'R' else b[8]
            e = [box[0], box[1], box[2], box[3], b[4], b[5], 'l' if sd == 'R' else 'r']
            if e not in out: out.append(e)
        if out: q['lb'] = out; n += 1
        else: q.pop('lb', None)
    json.dump(F, open(fp, 'w', encoding='utf-8'), ensure_ascii=False)
    print('labels merged:', n)


if '--labels' in sys.argv: merge_labels(sys.argv[sys.argv.index('--labels') + 1])
else: main()
