# خط إنتاج الامتحانات النهائية للغة الإنجليزية 11–12: صورة لكل قسم + نموذج الإجابة (نص + صورة صفحة النموذج)
import pdfplumber, re, os, sys, json, hashlib, subprocess
from PIL import Image
OUT = '/home/claude/enfin/out'
os.makedirs(OUT, exist_ok=True)
F11 = '/home/claude/fin11'; F12 = '/home/claude/fin12'
# (slug-paper, pdf, q-pages [a,b], key pdf, key pages [a,b], year, session)
PAPERS = {
 '11': [
  ('en11-2023-24-1', F11+'/q2324.pdf', (3, 17), F11+'/a2324.pdf', (3, 7), '2023-2024', 1),
  ('en11-2023-24-2', F11+'/q2324.pdf', (18, 32), F11+'/a2324.pdf', (8, 12), '2023-2024', 2),
  ('en11-2024-25-1', F11+'/p2425.pdf', (1, 15), F11+'/p2425.pdf', (16, 20), '2024-2025', 1),
  ('en11-2024-25-2', F11+'/p2425.pdf', (21, 35), F11+'/p2425.pdf', (36, 40), '2024-2025', 2),
  ('en11-2025-26-1', F11+'/p2526.pdf', (1, 15), F11+'/p2526.pdf', (16, 21), '2025-2026', 1),
  ('en11-2025-26-2', F11+'/p2526.pdf', (22, 36), F11+'/p2526.pdf', (37, 42), '2025-2026', 2),
 ],
 '12': [
  ('en12-2024-25-1', F12+'/p2425.pdf', (2, 18), F12+'/p2425.pdf', (19, 26), '2024-2025', 1),
  ('en12-2024-25-2', F12+'/p2425.pdf', (28, 46), F12+'/p2425.pdf', (47, 54), '2024-2025', 2),
  ('en12-2025-26-1', F12+'/p2526.pdf', (2, 18), F12+'/p2526.pdf', (19, 26), '2025-2026', 1),
  ('en12-2025-26-2', F12+'/p2526.pdf', (28, 44), F12+'/p2526.pdf', (45, 52), '2025-2026', 2),
 ]}
SEC_ORDER = ['LISTENING 1', 'LISTENING 2', 'VOCABULARY', 'GRAMMAR/VOCABULARY', 'READING 1', 'READING 2', 'READING 3', 'WRITING 1', 'WRITING 2']
SEC_AR = {'LISTENING 1': 'الاستماع 1', 'LISTENING 2': 'الاستماع 2', 'VOCABULARY': 'المفردات والقواعد', 'GRAMMAR/VOCABULARY': 'القواعد والمفردات (نص)',
          'READING 1': 'القراءة 1', 'READING 2': 'القراءة 2', 'READING 3': 'القراءة 3', 'WRITING 1': 'الكتابة 1', 'WRITING 2': 'الكتابة 2'}
HDR = re.compile(r'^\s*(LISTENING\s*[12]|VOCABULARY|GRAMMAR\s*/\s*VOCABULARY|GRAMMAR|READING\s*[123]|WRITING\s*[12])\b(.{0,60})', re.I | re.M)

def norm(h):
    h = re.sub(r'\s+', ' ', h.upper().replace(' /', '/').replace('/ ', '/')).strip()
    if h == 'GRAMMAR': h = 'VOCABULARY'  # الصف 12: القواعد 21–25 تُضمّ إلى المفردات 16–20 (5 درجات معًا)
    return h

def page_header(t):
    lines=[l for l in t.split('\n') if l.strip() and l.strip() not in ('Do','not','write','in','this','space') and not l.startswith('Diploma,') and 'Do not write' not in l]
    for line in lines[:4]:
        m = HDR.match(line.strip())
        if m: return norm(m.group(1)), m.group(2)
    return None, ''

def render(pdf, pno, dpi=110):
    base = '/tmp/r_%s_%d' % (hashlib.md5(pdf.encode()).hexdigest()[:6], pno)
    if not os.path.exists(base + '.png'):
        subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(pno), '-l', str(pno), '-singlefile', '-png', pdf, base], check=True)
    return Image.open(base + '.png').convert('RGB')

def trim(im):
    # قص الهوامش البيضاء العليا والسفلى
    g = im.convert('L'); w, h = g.size; px = g.load()
    rows = [y for y in range(h) if any(px[x, y] < 200 for x in range(0, w, 3))]
    if not rows: return im
    return im.crop((0, max(0, rows[0] - 10), w, min(h, rows[-1] + 10)))

def stack(ims, width=1000):
    ims = [trim(i) for i in ims]
    ims = [i.resize((width, int(i.size[1] * width / i.size[0]))) for i in ims]
    H = sum(i.size[1] for i in ims); c = Image.new('RGB', (width, H), 'white'); y = 0
    for i in ims: c.paste(i, (0, y)); y += i.size[1]
    return c

def save(im, rel):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=60); return [rel, im.size[0], im.size[1]]

def keytext(pdf, a, b):
    with pdfplumber.open(pdf) as P:
        return [(i, P.pages[i - 1].extract_text() or '') for i in range(a, b + 1)]

def ocr(im):
    im.save('/tmp/_o.png'); r = subprocess.run(['tesseract', '/tmp/_o.png', '-', '-l', 'eng'], capture_output=True, text=True); return r.stdout

KEYLAB = {'LISTENING 1': r'LISTENING\s*1', 'LISTENING 2': r'LISTENING\s*2', 'VOCABULARY': r'VCB|VOCABULARY', 'GRAMMAR/VOCABULARY': r'GRM\s*/\s*VCB|GRAMMAR\s*/\s*VOCABULARY',
          'READING 1': r'READING\s*1', 'READING 2': r'READING\s*2', 'READING 3': r'READING\s*3', 'WRITING 1': r'WRITING\s*1', 'WRITING 2': r'WRITING\s*2'}

def build(grade):
    allq = []; papers = {}
    for pid, qpdf, (qa, qb), kpdf, (ka, kb), year, sess in PAPERS[grade]:
        secs = {}; order = []; cur = None
        with pdfplumber.open(qpdf) as P:
            for pno in range(qa, qb + 1):
                t = P.pages[pno - 1].extract_text() or ''
                h, rest = page_header(t)
                if h:
                    if 'continued' in rest.lower():
                        if h.startswith('WRITING'): continue  # صفحة أسطر الإجابة
                        cur = h
                    else:
                        cur = h
                        if h in secs and h != 'VOCABULARY': cur = None; continue
                    if cur not in secs: secs[cur] = []; order.append(cur)
                    secs[cur].append(pno)
                elif cur and not cur.startswith('WRITING') and len(t) > 300:
                    secs[cur].append(pno)  # صفحة تكملة بلا عنوان (نص القراءة 3)
        miss = [s for s in SEC_ORDER if s not in secs]
        if miss: raise SystemExit('%s: أقسام ناقصة %s' % (pid, miss))
        # نموذج الإجابة
        kt = keytext(kpdf, ka, kb)
        kimgs = {}
        for pno, t in kt:
            if len(t) < 100: t = ocr(render(kpdf, pno, 150))
            kimgs[pno] = t
        total = 0
        for n, s in enumerate(SEC_ORDER, 1):
            pages = secs[s]
            im = stack([render(qpdf, p) for p in pages])
            img = save(im, 'en%s/%s/sec%d.webp' % (grade, pid, n))
            # الدرجة من العنوان
            with pdfplumber.open(qpdf) as P:
                t0 = '\n'.join(P.pages[p - 1].extract_text() or '' for p in pages)
            mk = 0
            for m in re.finditer(r'\(\s*(\d+)(½)?\s*marks?\s*\)', t0, re.I):
                mk += int(m.group(1)) + (0.5 if m.group(2) else 0)
            kp = [p for p, t in kimgs.items() if re.search(KEYLAB[s], t, re.I)]
            if s == 'VOCABULARY': kp = kp[:1]
            if s == 'GRAMMAR/VOCABULARY' and not kp: kp = [p for p, t in kimgs.items() if re.search(KEYLAB['VOCABULARY'], t, re.I)][:1]
            if s.startswith('WRITING'):
                kp = [p for p in kp if re.search(r'WRITING\s*%s\s*\(' % s[-1], kimgs[p], re.I)] or kp[:1]
            ai = [save(stack([render(kpdf, p, 110)]), 'en%s/%s/key%d.webp' % (grade, pid, p)) for p in kp[:2]]
            q = {'id': hashlib.md5((pid + s).encode()).hexdigest()[:14], 'p': pid, 'n': str(n), 'm': mk, 't': s, 'x': SEC_AR[s],
                 'a': 'نموذج الإجابة الرسمي في الصورة أدناه.' if ai else '', 'as': 'ms', 'c': '', 'ao': '', 'u': str(n), 'l': None, 'l2': None,
                 'srcno': n, 'im': img[0], 'w': img[1], 'h': img[2], 'ai': ai}
            allq.append(q); total += mk
        papers[pid] = {'year': year, 'term': 1, 'session': ('الدور الأول' if sess == 1 else 'الدور الثاني') + ' — الفصل الدراسي الأول', 'total': total}
        print(pid, 'total', total, {s: secs[s] for s in SEC_ORDER})
    units = {str(n): SEC_AR[s] for n, s in enumerate(SEC_ORDER, 1)}
    return {'papers': papers, 'units': units, 'q': allq}

if __name__ == '__main__':
    R = {g: build(g) for g in sys.argv[1:] or ['11', '12']}
    json.dump(R, open(OUT + '/finals_en.json', 'w'), ensure_ascii=False, indent=1)
