#!/usr/bin/env python3
"""يستخرج «نموذج الإجابة» الرسمي (جدول الوزارة) لمفردات اختبار نهائي ويكتبه في finals.json.

جدول النموذج (من اليمين): المفردة · [الجزئية] · الإجابة · الدرجة · معلومات أخرى · رقم الهدف ·
هدف التقويم · الصفحة · الوحدة. النص العربي في هذه الملفات مقلوب بصريًّا، لذلك:
  - الإجابة (ومعها «معلومات أخرى» إن لم تكن «-») تُقصّ **صورةً** من الخلية ← حقل ai
    (كثير من الإجابات جداول وعلامات ✓ ومربعات تظليل لا تُنقل نصًّا).
  - رقم الهدف (7Cs1…) لاتيني يُقرأ نصًّا ← حقل c ، وهدف التقويم يُطابَق بعد قلب الحروف ← حقل ao.

الاستخدام:
  python3 fin_model_answers.py <pdf> --course "العلوم|السابع" --map g7-2_8=9-13 --map g7-15_21=22-25 [--write] [--dpi 150]
  --map <ورقة في finals.json>=<صفحات النموذج>. بلا --write: تقرير فقط.
"""
import argparse, json, os, re, sys
import pymupdf

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FIN = os.path.join(ROOT, 'data', 'finals.json')
IMG = os.path.join(ROOT, 'finals', 'img')
DIG = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
CODE = re.compile(r'\b\d{1,2}[A-Z][A-Za-z]{0,3}\d{1,2}\b')
CODE2 = re.compile(r'\b\d{1,2}\s*-\s*\d{1,2}\b')
SUB = set('أبجدهـوزحطيكل') | {'هـ'}
AO_WORDS = {'معرفة': 'معرفة', 'تطبيق': 'تطبيق', 'استدلال': 'استدلال'}


def norm(t):
    return re.sub(r'\s+', '', (t or '').translate(DIG))


def ao_of(t):
    s = re.sub(r'[^ء-ي]', '', t or '')
    for w in AO_WORDS:
        if w in s or w in s[::-1] or sorted(w) == sorted(s):
            return w
    if 'AO' in (t or ''):
        m = re.search(r'AO\s*([123])', t); return m and 'AO' + m.group(1)
    return ''


def pages(spec):
    out = []
    for part in spec.split(','):
        a, _, b = part.partition('-'); out += list(range(int(a), int(b or a) + 1))
    return out


def _cluster(vals, tol=2.5):
    vals = sorted(vals); out = []
    for v in vals:
        if out and v - out[-1][-1] <= tol: out[-1].append(v)
        else: out.append([v])
    return [sum(c) / len(c) for c in out]


def grid(p):
    """خطوط الجدول من المستطيلات الرفيعة (الوزارة ترسم الحدود مستطيلات معبّأة) والخطوط."""
    H, V = [], []
    for dr in p.get_drawings():
        for it in dr['items']:
            if it[0] == 're': r = it[1]
            elif it[0] == 'l': r = pymupdf.Rect(it[1], it[2]).normalize()
            else: continue
            if r.height < 3 and r.width > 3: H.append((r.x0, r.x1, (r.y0 + r.y1) / 2))
            elif r.width < 3 and r.height > 3: V.append(((r.x0 + r.x1) / 2, r.y0, r.y1))
    return H, V


_WC = {}
_ACOL = {}


def words(p, rect):
    """كلمات مركزها داخل المستطيل (القصّ بالحدود يُسقط أرقامًا مثل 10 ← 0)، مرتبة من اليمين."""
    key = (p.parent.name, p.number)
    if key not in _WC: _WC[key] = p.get_text('words')
    ws = [w for w in _WC[key] if rect.x0 <= (w[0] + w[2]) / 2 <= rect.x1 and rect.y0 <= (w[1] + w[3]) / 2 <= rect.y1]
    ws.sort(key=lambda w: (round(w[1] / 4), -w[0]))
    return [w[4] for w in ws]


def page_items(p):
    """يعيد صفوف المفردات في صفحة نموذج إجابة. الصفحة قد تحوي أكثر من جدول (دليل تصحيح الثاني عشر:
    جدول لكل مفردة بعنوانه)، فتُقسم أولًا إلى كتل رأسية منفصلة."""
    H, V = grid(p)
    if not H or not V: return []
    key = (p.parent.name, p.number)
    if key not in _WC: _WC[key] = p.get_text('words')
    iv = []
    for _, a, b in sorted(V, key=lambda v: v[1]):
        if b - a < 3: continue
        if iv and a <= iv[-1][1] + 6: iv[-1][1] = max(iv[-1][1], b)
        else: iv.append([a, b])
    out = []
    for a, b in iv:
        if b - a < 30: continue
        out += _block_items(p, [h for h in H if a - 4 <= h[2] <= b + 4], [v for v in V if v[1] >= a - 4 and v[2] <= b + 4])
    return out


def _block_items(p, H, V):
    if not H or not V: return []
    # الجدول الرئيس: أطول الخطوط الرأسية تحدد امتداده
    xs = _cluster([v[0] for v in V])
    # أعمدة الجدول: الفواصل الرأسية التي تمتد على جزء معتبر من الصفحة
    span = {}
    for x, y0, y1 in V:
        k = min(xs, key=lambda c: abs(c - x)); span[k] = span.get(k, 0) + (y1 - y0)
    mx = max(span.values())  # فواصل جداول صغيرة داخل خلية الإجابة لا تُعد أعمدة
    cols = sorted(x for x in xs if span[x] >= 0.75 * mx)
    if len(cols) < 6: return []
    ys_all = sorted(h[2] for h in H if h[1] - h[0] > 15)
    # حدود الجدول الرئيس: وسيط أعلى/أسفل فواصل الأعمدة (لا مربع «تنبيه» أعلى الصفحة الأولى)
    def seg(x): return [v for v in V if abs(v[0] - x) <= 2.5 and v[2] - v[1] > 3]
    def main_iv(x):  # أطول امتداد متصل لفواصل العمود (يستبعد مربع العنوان المنفصل)
        iv = []
        for _, a, b in sorted(seg(x), key=lambda v: v[1]):
            if iv and a <= iv[-1][1] + 4: iv[-1][1] = max(iv[-1][1], b)
            else: iv.append([a, b])
        return max(iv, key=lambda r: r[1] - r[0])
    ivs = [main_iv(x) for x in cols]
    top, bot = min(r[0] for r in ivs), max(r[1] for r in ivs)
    H = [h for h in H if top - 3 <= h[2] <= bot + 3]
    bands = list(zip(cols[:-1], cols[1:]))
    def btxt(b, y0, y1): return ' '.join(words(p, pymupdf.Rect(b[0] + 1, y0 + 1, b[1] - 1, y1 - 1)))
    # عمود الرقم = أيمن عمود؛ عمود رمز الهدف = أكثر عمود فيه رموز لاتينية
    nb = bands[-1]
    # عمود هدف التقويم: أكثر عمود فيه «معرفة/تطبيق/استدلال» أو AO1/AO2
    def aon(i): return sum(1 for w in words(p, pymupdf.Rect(bands[i][0], top, bands[i][1], bot)) if ao_of(w))
    ao_i = max(range(len(bands) - 1), key=aon); ao_i = ao_i if aon(ao_i) else None
    # عمود رمز الهدف: رموز لاتينية (7Cs1) أو أرقام بشرطة (1-3) في الرياضيات
    def cn(i): return len(CODE.findall(btxt(bands[i], top, bot))) + len(CODE2.findall(btxt(bands[i], top, bot).translate(DIG)))
    code_i = max(range(len(bands) - 1), key=cn); code_i = code_i if cn(code_i) else None
    # عمود الإجابة: أعرض عمود عدا عمود الرقم؛ الدرجة: عمود ضيق مجاور كلُّ نصه أرقام صغيرة
    def head(i): return norm(btxt(bands[i], top, min(bot, top + 45)))
    hits = [i for i in range(len(bands) - 1) if len(head(i)) <= 14 and any(k in head(i) for k in ('جاب', 'باج', 'بج'))]  # عنوان قصير لا نص إرشادات
    key = p.parent.name
    if len(hits) == 1:
        a_i = hits[0]; _ACOL[key] = bands[a_i]  # عمود الإجابة من صفحة فيها عنوان الجدول
    elif key in _ACOL:  # صفحة تابعة بلا عنوان: العمود الأكثر تطابقًا مع عمود الإجابة المعروف
        ax0, ax1 = _ACOL[key]
        a_i = max(range(len(bands) - 1), key=lambda i: min(bands[i][1], ax1) - max(bands[i][0], ax0))
    else:
        a_i = max(range(len(bands) - 1), key=lambda i: bands[i][1] - bands[i][0])
    def numeric(i):
        ws = [w.translate(DIG) for w in words(p, pymupdf.Rect(bands[i][0], top + 40, bands[i][1], bot))]
        ws = [w for w in ws if w.strip()]
        return ws and sum(1 for w in ws if re.fullmatch(r'\d(?:\.\d)?', w)) >= 0.7 * len(ws)
    m_i = next((i for i in (a_i - 1, a_i + 1) if 0 <= i < len(bands) - 1 and i not in (ao_i, code_i) and numeric(i)), None)
    notes_i = None
    if m_i is not None:
        j = m_i + (m_i - a_i)  # عمود الإرشادات/المعلومات الأخرى بعد الدرجة في الاتجاه نفسه
        if 0 <= j < len(bands) - 1 and j not in (ao_i, code_i): notes_i = j
    # حدود المفردات: الخطوط الأفقية التي تعبر عمود الرقم
    cov = {}
    for x0, x1, y in H:  # الخط قد يُرسم مقاطع؛ نجمع تغطيته لعرض عمود الرقم
        ov = min(x1, nb[1]) - max(x0, nb[0])
        if ov > 0:
            k = next((c for c in cov if abs(c - y) <= 2.5), y); cov[k] = cov.get(k, 0) + ov
    yy = _cluster([y for y, v in cov.items() if v >= 0.6 * (nb[1] - nb[0])])
    yy = [y for y in yy if top - 2 <= y <= bot + 2]
    if not yy or yy[0] - top > 3: yy = [top] + yy
    if bot - yy[-1] > 3: yy.append(bot)
    # خطوط صفوف عمود الإجابة (لتقسيم امتداد فيه أكثر من رقم مفردة: خلايا رقم بلا فاصل بينها)
    ra = sorted(_cluster([h[2] for h in H if min(h[1], bands[a_i][1]) - max(h[0], bands[a_i][0]) > 0.5 * (bands[a_i][1] - bands[a_i][0])]))
    allw = [w for w in _WC[(p.parent.name, p.number)] if nb[0] <= (w[0] + w[2]) / 2 <= nb[1]]
    spans = []
    for y0, y1 in zip(yy[:-1], yy[1:]):
        nums = sorted(((w[1] + w[3]) / 2, w[4].translate(DIG)) for w in allw if y0 < (w[1] + w[3]) / 2 < y1 and re.fullmatch(r'\d{1,2}', w[4].translate(DIG)))
        if len(nums) <= 1: spans.append((y0, y1)); continue
        cuts = []
        for (ya, _), (yb, _) in zip(nums, nums[1:]):
            mid = (ya + yb) / 2
            c = min((r for r in ra if ya < r < yb), key=lambda r: abs(r - mid), default=None)
            if c: cuts.append(c)
        b = [y0] + cuts + [y1]
        spans += list(zip(b[:-1], b[1:]))
    out = []; hdr_marks = ''
    for y0, y1 in spans:
        if y1 - y0 < 8: continue
        # الرقم: من عمود الرقم وعمود الجزئية معًا (أرقام الوزارة قد تقع في أيٍّ منهما)
        t = ' '.join(words(p, pymupdf.Rect(bands[a_i][1] if a_i == len(bands) - 2 else nb[0], y0, nb[1], y1))).translate(DIG)
        t = [x for x in re.sub(r'[^0-9]', ' ', t).split() if len(x) <= 2]
        _ht = norm(btxt(bands[a_i], y0, y1))
        is_hdr = len(_ht) <= 14 and any(k in _ht for k in ('الإجابة', 'ةباجإلا', 'ةبا جإلا', 'إجابة', 'جاب', 'باج'))
        if is_hdr:
            hm = re.findall(r'\d+', btxt(bands[m_i], y0, y1).translate(DIG)) if m_i is not None else []
            if hm: hdr_marks = hm[-1]
            continue
        if not (t or (code_i is not None and (CODE.search(btxt(bands[code_i], y0, y1)) or CODE2.search(btxt(bands[code_i], y0, y1).translate(DIG))))): continue  # صف العنوان
        ct = btxt(bands[code_i], y0, y1).translate(DIG) if code_i is not None else ''
        out.append({'n': t or None, 'rect': pymupdf.Rect(bands[a_i][0], y0, bands[a_i][1], y1),
                    'codes': CODE.findall(ct) or [re.sub(r'\s+', '', c) for c in CODE2.findall(ct)],
                    'ao': [ao_of(w) for w in words(p, pymupdf.Rect(bands[ao_i][0], y0, bands[ao_i][1], y1))] if ao_i is not None else [],
                    'marks': marks_of(p, bands, a_i, m_i, y0, y1) or hdr_marks,
                    'notes': pymupdf.Rect(bands[notes_i][0], y0, bands[notes_i][1], y1) if notes_i is not None else None,
                    'notes_txt': btxt(bands[notes_i], y0, y1) if notes_i is not None else ''})
    return out


def marks_of(p, bands, a_i, m_i, y0, y1):
    """درجات المفردة؛ ما بعد «حل آخر» في عمود الإجابة تكرار لدرجات الحل البديل فلا يُحسب."""
    if m_i is None: return ''
    ws = _WC[(p.parent.name, p.number)]
    alt = [(w[1] + w[3]) / 2 for w in ws if bands[a_i][0] <= (w[0] + w[2]) / 2 <= bands[a_i][1] and y0 < (w[1] + w[3]) / 2 < y1
           and norm(w[4]).strip(':.') in ('آخر', 'خرآ')]
    hal = [(w[1] + w[3]) / 2 for w in ws if bands[a_i][0] <= (w[0] + w[2]) / 2 <= bands[a_i][1] and norm(w[4]).strip(':.') in ('حل', 'لح')]
    alt = [y for y in alt if any(abs(y - h) < 4 for h in hal)]  # «حل آخر» لا «من شكل إلى آخر»
    lim = min(alt) - 3 if alt else y1
    ds = [w[4].translate(DIG) for w in ws if bands[m_i][0] <= (w[0] + w[2]) / 2 <= bands[m_i][1] and y0 < (w[1] + w[3]) / 2 < lim]
    return ' '.join(ds)


def collect(doc, pnos):
    """يجمع صفوف كل مفردة. الأرقام ذات الخانتين تأتي مقلوبة أحيانًا (15 ← «51»)، فيُختار من بين
    الرقم ومقلوبه ما يوافق التسلسل؛ والصف بلا رقم استمرار للمفردة السابقة (ولو في صفحة تالية)."""
    items, last = {}, 0
    for pn in pnos:
        for it in page_items(doc[pn - 1]):
            it['pn'] = pn
            n = None
            if it['n']:
                toks = it['n'] + ([''.join(it['n']), ''.join(reversed(it['n']))] if len(it['n']) == 2 and all(len(x) == 1 for x in it['n']) else [])
                c = {int(v) for x in toks for v in (x, x[::-1]) if len(v) <= 2} - {0}
                if last + 1 in c: n = last + 1
                elif c & {x for x in c if x > last}: n = min(x for x in c if x > last)
                elif last in c: n = last
            if n is None and last == 0 and not it['n']: n = 1
            n = n or last
            if not n: continue
            last = n
            items.setdefault(str(n), []).append(it)
    return items


def crop(doc, pn, r, dpi, path):
    r = pymupdf.Rect(r.x0 + 2, r.y0 + 2, r.x1 - 2, r.y1 - 2)
    pix = doc[pn - 1].get_pixmap(dpi=dpi, clip=r)
    pix.save(path)
    return [os.path.relpath(path, IMG).replace(os.sep, '/'), pix.width, pix.height]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf'); ap.add_argument('--course', required=True)
    ap.add_argument('--map', action='append'); ap.add_argument('--plan'); ap.add_argument('--write', action='store_true')
    ap.add_argument('--dpi', type=int, default=150); ap.add_argument('--force', action='store_true', help='اكتب حتى لو كان للمفردة إجابة')
    a = ap.parse_args()
    F = json.load(open(FIN, encoding='utf-8')); G = F[a.course]
    doc = pymupdf.open(a.pdf)
    slug = G['q'][0]['im'].split('/')[0]
    os.makedirs(os.path.join(IMG, slug), exist_ok=True)
    done = miss = mism = 0
    plan = []
    for m in a.map or []:
        paper, spec = m.split('=')
        plan.append({'paper': paper, 'pages': spec, 'pairs': None})
    if a.plan:
        plan += json.load(open(a.plan, encoding='utf-8'))
    for P in plan:
        paper, spec = P['paper'], P['pages']
        items = collect(doc, pages(spec))
        tot = sum(float(t) for R in items.values() for it in R for t in re.findall(r'\d+(?:\.\d+)?', it['marks']))
        want = P.get('total') or (G['papers'].get(paper) or {}).get('total')
        print(f'{paper}: صفحات {spec} · مفردات النموذج {len(items)} · مجموع درجاته {tot:g}' + (f' (المتوقع {want}' + (' ✓)' if want and abs(tot - want) < 1e-6 else ' ✗ تحقق)') if want else ''))
        qs = {norm(str(q.get('n', ''))): q for q in G['q'] if q['p'] == paper}
        pairs = P['pairs'] or [[n, n] for n in qs]
        for pn_, mn in pairs:
            q = qs.get(norm(str(pn_))); R = items.get(str(mn))
            if q is None: print('   ✗ لا مفردة منصة', pn_); miss += 1; continue
            if not R: print('   ✗ لا صف للمفردة', mn, '(المنصة', pn_, ')'); miss += 1; continue
            if (str(q.get('a') or '').strip() or q.get('ai')) and not a.force: continue
            n = str(mn)
            ai = []
            for k, it in enumerate(R, 1):
                path = os.path.join(IMG, slug, f"ans_{q['id']}{'' if k == 1 else '_' + str(k)}.png")
                ai.append(crop(doc, it['pn'], it['rect'], a.dpi, path) if a.write else ['(dry)', 0, 0])
            for j, it in enumerate([it for it in R if it['notes'] and re.sub(r'[\s\-–.]', '', it['notes_txt'])], 1):
                path = os.path.join(IMG, slug, f"ans_{q['id']}_n{j}.png")
                if a.write: ai.append(crop(doc, it['pn'], it['notes'], a.dpi, path))
            codes = []
            for it in R:
                for c in it['codes']:
                    if c not in codes: codes.append(c)
            aos = [x for it in R for x in it['ao'] if x]
            mk = sum(float(t) for it in R for t in re.findall(r'\d+(?:\.\d+)?', it['marks']))
            if mk and abs(mk - (q.get('m') or 0)) > 1e-6 and not P.get('keep_marks'):
                mism += 1; print(f'   ~ المفردة {n}: درجة النموذج {mk:g} (كانت {q.get("m")}) ← تُعتمد درجة النموذج')
                if a.write and mk == int(mk):
                    q['m'] = int(mk)
                    if q.get('t') == 'mcq' and q['m'] > 1: q['t'] = 'short'  # «اختيار» بأكثر من درجة = مفردة قصيرة
            q['ai'] = ai; q['as'] = 'ms'
            if codes and all(CODE.fullmatch(c) for c in codes): q['c'] = ' / '.join(codes)  # رموز الرياضيات «1-3» تُقرأ مقلوبة فلا تُكتب
            if aos:
                rank = {'معرفة': 1, 'تطبيق': 2, 'استدلال': 3, 'AO1': 1, 'AO2': 2, 'AO3': 3}
                q['ao'] = max(aos, key=lambda x: rank.get(x, 0))
            done += 1
    print(f'{a.course}: كُتبت إجابات {done} · بلا صف {miss} · فرق درجات {mism}' + ('' if a.write else ' (تجربة بلا كتابة)'))
    if a.write:
        json.dump(F, open(FIN, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
