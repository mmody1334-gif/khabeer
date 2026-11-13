# استخراج مفردات قصيرة من امتحانات الوزارة إلى بنك الأسئلة (قراءة 1 صح/خطأ، مفردات/قواعد)
import pdfplumber, re, subprocess, json, sys
sys.path.insert(0, '/home/claude/enfin')
from build import PAPERS, render
DPI = 110; S = DPI / 72.0

def words(pdf, pno):
    with pdfplumber.open(pdf) as P:
        pg = P.pages[pno - 1]; ws = pg.extract_words()
        if len(ws) > 30:
            return [(w['text'], w['x0'] * S, w['top'] * S, w['x1'] * S, w['bottom'] * S) for w in ws]
    im = render(pdf, pno, DPI); im.save('/tmp/_w.png')
    out = subprocess.run(['tesseract', '/tmp/_w.png', '-', '-l', 'eng', 'tsv'], capture_output=True, text=True).stdout
    res = []
    for ln in out.split('\n')[1:]:
        c = ln.split('\t')
        if len(c) == 12 and c[11].strip() and c[10] != '-1' and float(c[10]) > 30:
            x, y, w, h = map(int, c[6:10]); res.append((c[11], x, y, x + w, y + h))
    return res

def dark(im, box):
    g = im.convert('L').crop(tuple(int(v) for v in box)); px = list(g.get_flattened_data()) if hasattr(g,'get_flattened_data') else list(g.getdata())
    return sum(1 for v in px if v < 110) / max(1, len(px))

def bubble_left(im, w):
    _, x0, t, x1, b = w; h = b - t; cy = (t + b) / 2
    return dark(im, (x0 - 2.2 * h - 4, cy - h * 0.45, x0 - 4, cy + h * 0.45))

def find_num_rows(ws, nums):
    rows = {}
    for t, x0, top, x1, b in ws:
        m = re.fullmatch(r'(\d{1,2})\.?', t)
        if m and int(m.group(1)) in nums and int(m.group(1)) not in rows:
            rows[int(m.group(1))] = (x0, top, x1, b)
    return rows

def tf_answers(pdf, pno, nums):
    ws = words(pdf, pno); im = render(pdf, pno, DPI)
    tr = [w for w in ws if w[0] == 'True']; fa = [w for w in ws if w[0] == 'False']
    if not tr or not fa: return {}
    tr = min(tr, key=lambda w: w[2]); fa = min(fa, key=lambda w: w[2])
    rows = find_num_rows([w for w in ws if w[1] < tr[1]], nums)
    out = {}
    for n, (x0, top, x1, b) in rows.items():
        cy = (top + b) / 2; h = (b - top)
        dt = dark(im, ((tr[1] + tr[3]) / 2 - h, cy - h * 0.5, (tr[1] + tr[3]) / 2 + h, cy + h * 0.5))
        df = dark(im, ((fa[1] + fa[3]) / 2 - h, cy - h * 0.5, (fa[1] + fa[3]) / 2 + h, cy + h * 0.5))
        if max(dt, df) > 0.25 and abs(dt - df) > 0.15: out[n] = 'True' if dt > df else 'False'
    return out

def mcq_answers(pdf, pno, items):
    # items: {n: [options]} → {n: correct option}
    ws = words(pdf, pno); im = render(pdf, pno, DPI)
    rows = find_num_rows(ws, set(items)); out = {}
    for n, opts in items.items():
        if n not in rows: continue
        x0, top, x1, b = rows[n]; cy = (top + b) / 2
        line = sorted([w for w in ws if abs((w[2] + w[4]) / 2 - cy) < 9 and w[1] > x1], key=lambda w: w[1])
        best = None
        for o in opts:
            first = o.split()[0]
            cand = [w for w in line if w[0].strip('.,') == first]
            if not cand: continue
            d = bubble_left(im, cand[0])
            if best is None or d > best[1]: best = (o, d, cand[0])
        if best and best[1] > 0.3: out[n] = best[0]
    return out

def qtext(pdf, a, b):
    with pdfplumber.open(pdf) as P:
        return '\n'.join(P.pages[i - 1].extract_text() or '' for i in range(a, b + 1))

CLEAN = re.compile(r'^(Do|not|write|in|this|space|Diploma, English.*|ENGLISH .CORE.*|\d{1,2})$')
def lines(t): return [l for l in t.split('\n') if l.strip() and not CLEAN.match(l.strip())]

def rdg1(t, nums):
    body = t[t.find('True or False'):]
    body = '\n'.join(lines(body))
    out = {}
    for i, n in enumerate(nums):
        m = re.search(r'(?:^|\n)%d\.\s+(.*?)\nStatement True False\n(.*?)(?=\n\d{1,2}\.\s|\nREADING|\nReading|$)' % n, body, re.S)
        if m:
            txt = re.sub(r'\s*\n\s*', ' ', m.group(1)).strip(); st = re.sub(r'\s*\n\s*', ' ', m.group(2)).strip()
            st = re.sub(r'\s*(READING 1 \(continued\)|Reading 1 \(continued\)).*$', '', st)
            st = re.sub(r'\s*Do not write in this space.*$', '', st).strip()
            txt = re.sub(r'\s*Do not write in this space\s*', ' ', txt).strip()
            out[n] = (txt, st)
    return out

def run():
    bank = {'11': [], '12': []}
    for g in ('11', '12'):
        for pid, qpdf, (qa, qb), kpdf, (ka, kb), year, sess in PAPERS[g]:
            src = 'امتحان الوزارة %s — %s' % (year.replace('-', '/'), 'الدور الأول' if sess == 1 else 'الدور الثاني')
            T = qtext(qpdf, qa, qb)
            nums = list(range(1, 6)) if g == '11' else list(range(31, 38))
            r1 = rdg1(T[T.find('READING 1' if g == '11' else 'Reading 1'):] if g == '12' else T[T.find('READING 1 (Items'):], nums) if True else {}
            if g == '12':
                i1 = T.find('Reading 1 (Items'); i1 = i1 if i1 >= 0 else T.find('READING 1 (Items'); r1 = rdg1(T[i1:], nums)
            # مفاتيح
            ans = {}
            for p in range(ka, kb + 1):
                a = tf_answers(kpdf, p, set(nums))
                if len(a) >= len(nums) - 1: ans = a; break
            for n in nums:
                if n in r1 and n in ans:
                    txt, st = r1[n]
                    bank[g].append({'k': 'RDG', 't': 'w', 'q': txt + ' // Statement: ' + st + ' (True or False?)', 'a': ans[n], 'src': src, 'pid': pid})
            print(pid, 'RDG1', len(r1), 'keys', len(ans))
            if g == '11':
                kt = qtext(kpdf, ka, kb)
                m = re.search(r'VOCABULARY \(Items 1.5\)(.*?)GRAMMAR \(Items 6.10\)(.*?)(?:\n3\n|GRAMMAR/VOCABULARY|$)', T, re.S)
                kv = {}
                for n in range(1, 11):
                    mm = re.search(r'(?:^|\s)%d\.\s*([A-Za-z\'’\\/ -]+?)(?=\s+\d{1,2}\.|\n|$)' % n, kt[kt.find('VCB ('):kt.find('Notes', kt.find('VCB ('))])
                    if mm: kv[n] = mm.group(1).strip()
                if m:
                    voc, grm = m.group(1), m.group(2)
                    for n in range(1, 6):
                        mm = re.search(r'%d\.\s*(\((?:noun|verb|adjective|adverb|n|v|adj|adv)[^)]*\).*?)(?=\n%d\.|$)' % (n, n + 1), voc, re.S)
                        if mm and n in kv:
                            q = re.sub(r'\s*\n\s*', ' ', mm.group(1)).strip()
                            q = q.replace(' e.g.', ' // e.g.').replace(' e.g ', ' // e.g. ')
                            bank[g].append({'k': 'VCB', 't': 'w', 'q': 'Complete the word: ' + q, 'a': kv[n], 'src': src, 'pid': pid})
                    for n in range(6, 11):
                        mm = re.search(r'%d\.\s*(.*?)(?=\n%d\.|\n\d+\n|$)' % (n, n + 1), grm, re.S)
                        if mm and n in kv:
                            q = re.sub(r'\s*\n\s*', ' ', mm.group(1)).strip()
                            bank[g].append({'k': 'GRM', 't': 'w', 'q': 'Complete with ONE word: ' + q, 'a': kv[n].replace('\\', ' / '), 'src': src, 'pid': pid})
            else:
                m = re.search(r'Vocabulary \(Items 16\s*.\s*20\).*?correct option\.\n(.*?)(?:\nDo not write|\nGrammar)', T, re.S | re.I)
                if m:
                    L = lines(m.group(1)); items = {}; stems = {}; i = 0
                    while i < len(L):
                        mm = re.match(r'(\d{2})\.\s*(.*)', L[i])
                        if mm:
                            n = int(mm.group(1)); st = mm.group(2); i += 1
                            while i < len(L) and not re.match(r'\d{2}\.', L[i]) and (i + 1 < len(L) and not re.match(r'\d{2}\.', L[i + 1]) or i + 1 == len(L)) and len(L[i].split()) > 4:
                                st += ' ' + L[i]; i += 1
                            if i < len(L): items[n] = L[i].split(); stems[n] = st; i += 1
                        else: i += 1
                    km = {}
                    for p in range(ka, kb + 1):
                        km = mcq_answers(kpdf, p, items)
                        if len(km) >= 3: break
                    for n in items:
                        if n in km and len(items[n]) == 4:
                            bank[g].append({'k': 'VCB', 't': 'm', 'q': stems[n], 'a': km[n], 'ch': [km[n]] + [o for o in items[n] if o != km[n]], 'src': src, 'pid': pid})
                    print(pid, 'VCB16-20', len(items), 'keys', len(km))
    json.dump(bank, open('/home/claude/enfin/out/bank_fin.json', 'w'), ensure_ascii=False, indent=1)
    for g in bank: print(g, len(bank[g]), {k: sum(1 for x in bank[g] if x['k'] == k) for k in ('RDG', 'VCB', 'GRM')})

run()
