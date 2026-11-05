#!/usr/bin/env python3
"""يحدّد في صور أسئلة الاختبارات النهائية مواضع الأرقام التي تتبع ترتيب السؤال في
الامتحان الأصلي، حتى تُصحَّح حين يأخذ السؤال رقمًا آخر في ورقة المعلم:

  qb — رقم السؤال المطبوع في أول السطر («٦)»): يُبيَّض عند النشر (fin_qno.py)
       لأن المنصة تكتب رقم السؤال الجديد فوق الصورة.
  lb — الجزء الأول من رقم الشكل/الجدول («الشكل ٦-١» ← «٦»): تُرسم فوقه في المتصفح
       قيمة رقم السؤال الجديد («٣») فيصبح «الشكل ٣-١».

الطريقة: Tesseract يحدّد الكلمات وأماكنها، ثم نقرأ الخانات بمطابقة أشكالها مع
قوالب أرقام (هندية وعربية)، ولا نقبل أي موضع إلا إذا كانت قراءته = رقم السؤال
الأصلي (q.n) — فلا يُمَسّ رقم لا علاقة له بترتيب السؤال.

  lb: [[x, y, w, h, e, b, s], ...]   بالبكسل في الصورة الأصلية
      e=1 أرقام هندية (٣) / 0 عربية (3) · b=1 غامق · s='r'/'l' جهة الشرطة من المربع
  qb: [x, y, w, h]

الاستخدام: python3 site/tools/fin_labels.py [--only bio12] [--limit N] [--write]
بلا --write يطبع إحصاءً فقط. مع --write يكتب الحقلين في site/data/finals.json.
"""
import json, os, re, subprocess, sys, csv, io
from multiprocessing import Pool

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
IMG = os.path.join(ROOT, 'finals', 'img')
DATA = os.path.join(ROOT, 'data', 'finals.json')
DARK = 165
FONTS = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
         '/usr/share/fonts/truetype/freefont/FreeSerif.ttf', '/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', '/usr/share/fonts/truetype/freefont/FreeSans.ttf']
WORD_RE = re.compile(r'(شكل|جدول|لشكل|لجدول)')
S = 24


def norm(mask):
    """قناع خانة ← مربع S×S مع الحفاظ على النسبة، ثم تنعيم."""
    ys, xs = np.where(mask)
    if not len(ys):
        return None
    m = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32)
    h, w = m.shape
    k = (S - 2) / max(h, w)
    nh, nw = max(1, round(h * k)), max(1, round(w * k))
    m = cv2.resize(m, (nw, nh), interpolation=cv2.INTER_AREA)
    out = np.zeros((S, S), np.float32)
    y0, x0 = (S - nh) // 2, (S - nw) // 2
    out[y0:y0 + nh, x0:x0 + nw] = m
    return cv2.GaussianBlur(out, (3, 3), 0.8)


def build_templates():
    T = []  # (ch, system, vec, relh)
    chars = [(str(i), 0) for i in range(10)] + [(chr(0x660 + i), 1) for i in range(10)] + [(chr(0x6f0 + i), 1) for i in (4, 5, 6)]
    for f in FONTS:
        if not os.path.exists(f):
            continue
        ft = ImageFont.truetype(f, 64)
        ref = None
        for ch, sysm in chars + [('(', 2), (')', 2)]:
            im = Image.new('L', (120, 120), 0)
            ImageDraw.Draw(im).text((20, 10), ch, 255, font=ft)
            a = np.array(im) > 100
            ys, _ = np.where(a)
            if not len(ys):
                continue
            hh = ys.max() - ys.min() + 1
            if ch in ('1', '١'):
                ref = ref or {}
                ref[sysm] = hh
            v = norm(a)
            T.append([ch, sysm, v, hh])
        for t in T:
            if len(t) == 4 and ref:
                t.append(t[3] / ref.get(t[1] if t[1] < 2 else 1, t[3]))
    for t in T:
        if len(t) == 4:
            t.append(1.0)
    return T


TPL = None


def val(ch):
    o = ord(ch)
    if 0x660 <= o <= 0x669: return o - 0x660
    if 0x6f0 <= o <= 0x6f9: return o - 0x6f0
    return int(ch)


def comp_cost(vec, relh, ch_val, sysm):
    """أقل مسافة بين خانة وقالب الرقم ch_val في النظام sysm."""
    best = 9
    for ch, s, v, _hh, rh in TPL:
        if s != sysm or s == 2 or val(ch) != ch_val:
            continue
        d = float(np.abs(vec - v).mean()) + 0.35 * abs(np.log((relh + 1e-3) / (rh + 1e-3)))
        best = min(best, d)
    return best


def read_comp(vec, relh):
    """أفضل قراءة لخانة: (القيمة، النظام، المسافة) — والقوسان تعود قيمتهما None."""
    best = (None, None, 9)
    for ch, s, v, _hh, rh in TPL:
        d = float(np.abs(vec - v).mean()) + 0.35 * abs(np.log((relh + 1e-3) / (rh + 1e-3)))
        if d < best[2]:
            best = (None if s == 2 else val(ch), s, d)
    return best


CACHE = os.environ.get('FIN_OCR_CACHE', '/tmp/fin_ocr_cache')


def ocr(path):
    """كلمات الصورة من وضعين لـ Tesseract (سطور كاملة + كلمات متفرّقة) مدموجة."""
    ck = os.path.join(CACHE, path.replace('/', '_') + '.json')
    if os.path.exists(ck):
        return json.load(open(ck))
    words = []
    for psm in ('4', '11'):
        r = subprocess.run(['tesseract', path, '-', '-l', 'ara', '--psm', psm, 'tsv'], capture_output=True, text=True)
        for row in csv.DictReader(io.StringIO(r.stdout), delimiter='\t', quoting=csv.QUOTE_NONE):
            try:
                if row['level'] != '5' or not (row['text'] or '').strip():
                    continue
                w = {'x': int(row['left']), 'y': int(row['top']), 'w': int(row['width']), 'h': int(row['height']), 't': row['text'].strip()}
            except Exception:
                continue
            if any(abs(v['x'] - w['x']) < 6 and abs(v['y'] - w['y']) < 6 and abs(v['w'] - w['w']) < 8 for v in words):
                continue
            words.append(w)
    os.makedirs(CACHE, exist_ok=True)
    json.dump(words, open(ck, 'w'))
    return words


def same_line(a, b):
    ov = min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y'])
    return ov >= 0.5 * min(a['h'], b['h'])


def qno_box(ink):
    """أقصى يمين السطر الأول: الكتلة المفصولة بمسافة عن نص السؤال (موضع «٦)»).
    المرساة: أعلى خانة نصّية تنتهي في آخر 12% من العرض ضمن أول 160 بكسل."""
    H, W = ink.shape
    vline = ink.mean(0) > 0.35                      # خطوط الإطار العمودية
    a = ink.copy(); a[:, vline] = False
    top = a[:min(H, 160)].astype(np.uint8)
    n, _l, st, _ = cv2.connectedComponentsWithStats(top, connectivity=8)
    anc = [st[i] for i in range(1, n) if st[i][0] + st[i][2] > W * 0.88 and 8 <= st[i][3] <= 45 and st[i][2] <= 40 and st[i][4] >= 8]
    out = []
    for x, y, w, h, _ar in sorted(anc, key=lambda t: t[1])[:2]:
        y0, y1 = max(0, y - 2), min(H - 1, y + h + 2)
        prof = a[y0:y1 + 1].any(0)
        xs = np.where(prof)[0]
        x1 = xs[-1]; xx = x1; gap = 0; x0 = x1
        while xx > 0:
            xx -= 1
            if prof[xx]:
                gap = 0; x0 = xx
            else:
                gap += 1
                if gap >= 9:
                    break
        if x1 - x0 <= W * 0.045 and gap >= 9:
            b = (int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1))
            if b not in out:
                out.append(b)
    return out

def comps_in(ink, box, padx=4, pady=4):
    H, W = ink.shape
    x, y, w, h = box
    x0, y0, x1, y1 = max(0, x - padx), max(0, y - pady), min(W, x + w + padx), min(H, y + h + pady)
    sub = ink[y0:y1, x0:x1].astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(sub, connectivity=8)
    out = []
    for i in range(1, n):
        cx, cy, cw, ch, ar = st[i]
        if ar < 3:
            continue
        # الخانة يجب أن تقع داخل المربع (لا تمتد من كلمة مجاورة)
        if cx == 0 and x0 > 0 or cx + cw >= x1 - x0 and x1 < W:
            if cw > 2 * padx + 2:
                pass
        out.append({'x': x0 + cx, 'y': y0 + cy, 'w': cw, 'h': ch, 'm': lab[cy:cy + ch, cx:cx + cw] == i})
    return out


def is_dash(c, hmax):
    return c['w'] >= 1.5 * c['h'] and c['h'] <= max(3, 0.3 * hmax) and c['w'] <= 1.4 * hmax


def group_read(cs, hmax):
    """يقرأ مجموعة خانات (يسار←يمين) ويعيد التكاليف لكل نظام."""
    vecs = [(norm(c['m']), c['h'] / hmax) for c in cs]
    return vecs


def cost_str(vecs, s, sysm):
    if len(vecs) != len(s):
        return 9
    return sum(comp_cost(v, rh, int(d), sysm) for (v, rh), d in zip(vecs, s)) / len(s)


def bbox(cs):
    x0 = min(c['x'] for c in cs); y0 = min(c['y'] for c in cs)
    x1 = max(c['x'] + c['w'] for c in cs); y1 = max(c['y'] + c['h'] for c in cs)
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]


def boldness(ink, b):
    x, y, w, h = b
    m = ink[y:y + h, x:x + w].astype(np.uint8)
    if not m.any():
        return 0
    dt = cv2.distanceTransform(m, cv2.DIST_L2, 3)
    sw = 2 * float(np.percentile(dt[m > 0], 90))
    return 1 if sw / max(1, h) >= 0.205 else 0


def is_close_paren(c):
    """قوس «)» وحده: أقرب إلى قالب «)» منه إلى «(» وإلى ١/1 والألف (خطوط مستقيمة)."""
    v = norm(c['m'])
    if v is None or c['w'] > 0.45 * c['h'] or c['w'] < 3:
        return False
    best = {}
    for ch, s, t, _hh, _rh in TPL:
        if ch in ('(', ')', '1', '\u0661'):
            k = ch if ch in '()' else 'one'
            best[k] = min(best.get(k, 9), float(np.abs(v - t).mean()))
    m = c['m']; h = m.shape[0]
    # انحناء: منتصف القوس «)» أبعد يمينًا من طرفيه
    def xc(rows):
        r = m[rows]; ys, xs = np.where(r)
        return xs.mean() if len(xs) else 0
    mid = xc(slice(int(h * .4), int(h * .6) + 1)); ends = (xc(slice(0, max(1, int(h * .15)))) + xc(slice(int(h * .85), h))) / 2
    return best.get(')', 9) < 0.2 and best[')'] + 0.02 < best.get('(', 9) and best[')'] + 0.02 < best.get('one', 9) and mid - ends >= max(1.5, 0.25 * c['w'])


def clean_digits(cs, hmax):
    """يحذف القوسين والنقاط الصغيرة جدًّا."""
    out = []
    for c in cs:
        if c['h'] < 0.18 * hmax and c['w'] < 0.18 * hmax:
            continue  # نقطة/شظية — والصفر الهندي يُعالَج أدناه
        v, s, d = read_comp(norm(c['m']), c['h'] / hmax)
        if s == 2 and d < 0.22:
            continue
        out.append(c)
    return out


def analyze(job):
    try:
        return _analyze(job)
    except Exception as e:  # صورة واحدة لا توقف التحليل
        return {'im': job[0], 'err': repr(e)}


def _analyze(job):
    q, n, ks = job
    path = os.path.join(IMG, q)
    res = {'im': q}
    try:
        g = np.array(Image.open(path).convert('L'))
    except Exception as e:
        res['err'] = str(e); return res
    H, W = g.shape
    ink = g < DARK
    words = ocr(path)
    if not words:
        return res
    N = str(n)
    # ---------- رقم السؤال المطبوع ----------
    vl = ink.mean(0) > 0.35
    for qbx in qno_box(ink):
        cs = [c for c in comps_in(ink, qbx, 0, 0) if c['h'] > 3]
        if not cs:
            continue
        # حارس 1: الكلمة التي يقرؤها Tesseract هنا لا تحوي حروفًا عربية («(ظلّل» · «ارسم» · «أحد»)
        bx0, by0, bw0, bh0 = qbx
        ov = [w for w in words if w['x'] < bx0 + bw0 and w['x'] + w['w'] > bx0 and w['y'] < by0 + bh0 and w['y'] + w['h'] > by0]
        if any(re.search(r'[\u0621-\u064A]', w['t']) for w in ov):
            continue
        # حارس 2: لا خط عمودي ملاصق (خانة جدول، لا رقم سؤال)
        ya, yb = max(0, by0 - 8), min(H, by0 + bh0 + 8)
        def vbar(xa, xb):
            xa, xb = max(0, xa), min(W, xb)
            if xb <= xa:
                return False
            colf = ink[ya:yb, xa:xb].mean(0)
            return bool(((colf >= 0.9) & ~vl[xa:xb]).any())
        if vbar(bx0 - 45, bx0) or vbar(bx0 + bw0, bx0 + bw0 + 30):
            continue
        hmax = max(c['h'] for c in cs)
        kinds = [read_comp(norm(c['m']), c['h'] / hmax) for c in cs]
        b = bbox(cs)
        box = [b[0] - 3, b[1] - 3, b[2] + 6, b[3] + 6]
        ds = sorted([c for c in clean_digits(cs, hmax) if not is_dash(c, hmax)], key=lambda c: c['x'])
        if ds and len(ds) == len(N):
            vecs = group_read(ds, hmax)
            c0, c1 = cost_str(vecs, N, 0), cost_str(vecs, N, 1)
            alt = min((cost_str(vecs, str(x), sm) for x in range(1, 1000) for sm in (0, 1) if str(x) != N and len(str(x)) == len(N)), default=9)
            if min(c0, c1) < 0.20 and min(c0, c1) <= alt:
                res['qb'] = box; break
            res['qb_rej'] = [round(min(c0, c1), 3), round(alt, 3)]
    # ---------- رقم الشكل/الجدول ----------
    if not ks:
        return res
    cands = []
    for i, w in enumerate(words):
        if re.search(r'[\d٠-٩][\-–][\d٠-٩]|[\-–]', w['t']) and re.search(r'[\d٠-٩]', w['t']):
            cands.append(w)
        if WORD_RE.search(w['t']):
            same = [v for v in words if v is not w and same_line(v, w) and v['x'] + v['w'] <= w['x'] + 4 and w['x'] - (v['x'] + v['w']) < 3 * w['h']]
            if same:
                cands.append(max(same, key=lambda v: v['x']))
    seen, lbs, rej = set(), [], []
    for w in cands:
        key = (w['x'], w['y'])
        if key in seen:
            continue
        seen.add(key)
        cs = comps_in(ink, (w['x'], w['y'], w['w'], w['h']), 3, 3)
        if len(cs) < 3:
            continue
        hmax = max(c['h'] for c in cs)
        dashes = [c for c in cs if is_dash(c, hmax) and abs((c['y'] + c['h'] / 2) - (min(x['y'] for x in cs) + hmax / 2)) < hmax * 0.4]
        if len(dashes) != 1:
            continue
        dsh = dashes[0]
        rest = clean_digits([c for c in cs if c is not dsh], hmax)
        L = sorted([c for c in rest if c['x'] + c['w'] <= dsh['x'] + 1], key=lambda c: c['x'])
        R = sorted([c for c in rest if c['x'] >= dsh['x'] + dsh['w'] - 1], key=lambda c: c['x'])
        if not L or not R:
            continue
        vl, vr = group_read(L, hmax), group_read(R, hmax)
        best = None
        for k in ks:
            for sysm in (0, 1):
                hy_r = cost_str(vr, N, sysm) + cost_str(vl, k, sysm)   # N يمين الشرطة (الأقرب لكلمة «الشكل»)
                hy_l = cost_str(vl, N, sysm) + cost_str(vr, k, sysm)
                for c, side in ((hy_r, 'R'), (hy_l, 'L')):
                    if best is None or c < best[0]:
                        best = (c, side, sysm, k)
        if best is None or best[0] / 2 > 0.21:
            rej.append(round(best[0] / 2, 3) if best else None)
            continue
        # إن كان N=k (مثل ١-١) فالجهة تُحسم لاحقًا بعرف الورقة
        grp = R if best[1] == 'R' else L
        b = bbox(grp)
        amb = 1 if best[3] == N else 0
        lbs.append([b[0], b[1], b[2], b[3], best[2], boldness(ink, b), 'l' if best[1] == 'R' else 'r', amb,
                    bbox(L), bbox(R)])
    if lbs:
        res['lb'] = lbs
    if rej:
        res['lb_rej'] = rej
    return res


def init():
    global TPL
    TPL = build_templates()


PAT = re.compile(r'(?:شكل|جدول)\s*\(?\s*(\d+)\s*[-–]\s*(\d+)')


def jobs(d, only=None):
    out = []
    for key, G in d.items():
        for q in G['q']:
            im = q.get('im')
            if not im or (only and not im.startswith(only)):
                continue
            n = str(q.get('n') or '').strip()
            if not n.isdigit():
                continue
            ks = set()
            for a, b in PAT.findall(q.get('x', '')):
                if a == n: ks.add(b)
                elif b == n: ks.add(a)
            out.append((im, n, sorted(ks)))
    return out


def merge(raw):
    """يكتب نتائج التحليل في finals.json: qb و lb (ويحسم N=k بعرف الورقة)."""
    d = json.load(open(DATA, encoding='utf-8'))
    R = {r['im']: r for r in json.load(open(raw, encoding='utf-8'))}
    paper_side = {}
    for G in d.values():
        for q in G['q']:
            r = R.get(q.get('im'))
            for b in (r or {}).get('lb', []):
                if not b[7]:
                    paper_side.setdefault(q['p'], []).append('R' if b[6] == 'l' else 'L')
    nq = nl = 0
    for G in d.values():
        for q in G['q']:
            q.pop('qb', None); q.pop('lb', None)
            r = R.get(q.get('im'))
            if not r:
                continue
            if r.get('qb'):
                q['qb'] = r['qb']; nq += 1
            out = []
            for b in r.get('lb', []):
                side = 'R' if b[6] == 'l' else 'L'
                if b[7]:
                    v = paper_side.get(q['p'], [])
                    side = 'L' if v.count('L') > v.count('R') else 'R'
                box = b[9] if side == 'R' else b[8]
                e = [box[0], box[1], box[2], box[3], b[4], b[5], 'l' if side == 'R' else 'r']
                if e not in out:
                    out.append(e)
            if out:
                q['lb'] = out; nl += 1
    s = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
    open(DATA, 'w', encoding='utf-8').write(s)
    print(f'merged: qb {nq}  lb {nl}')


def main():
    args = sys.argv[1:]
    if '--merge' in args:
        return merge(args[args.index('--merge') + 1])
    only = args[args.index('--only') + 1] if '--only' in args else None
    lim = int(args[args.index('--limit') + 1]) if '--limit' in args else 0
    d = json.load(open(DATA, encoding='utf-8'))
    J = jobs(d, only)
    if lim:
        J = J[:lim]
    with Pool(os.cpu_count() or 2, initializer=init) as p:
        R = p.map(analyze, J, chunksize=4)
    json.dump(R, open(os.environ.get('FIN_RAW', '/tmp/fin_labels_raw.json'), 'w'), ensure_ascii=False)
    nq = sum(1 for r in R if 'qb' in r); nl = sum(1 for r in R if 'lb' in r)
    want = sum(1 for j in J if j[2])
    print(f'images {len(J)}  qno {nq}  labels {nl} (expected-from-text {want})  lb-rejected {sum(1 for r in R if "lb_rej" in r)}')


if __name__ == '__main__':
    main()
