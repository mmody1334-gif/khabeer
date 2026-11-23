# اختبارات الوزارة للغة الإنجليزية — الصف الثامن (الفصل الأول، 40 درجة): صورة لكل قسم + نموذج الإجابة (+ نص الاستماع إن وُجد)
import sys, re, json, hashlib, pdfplumber
sys.path.insert(0, '/home/claude/enfin')
import build as B
B.OUT = '/home/claude/fin8/out'
F = '/home/claude/fin8'
# (pid, pdf, q-pages, key-pages, script-page|None, year, session label)
PAPERS = [
 ('en8-2024-25-1m', F + '/p2425.pdf', (1, 9), (10, 13), 14, '2024-2025', 'الدور الأول (المدارس الصباحية)'),
 ('en8-2024-25-1e', F + '/p2425.pdf', (15, 23), (24, 27), 28, '2024-2025', 'الدور الأول (المدارس المسائية)'),
 ('en8-2024-25-2', F + '/p2425.pdf', (29, 37), (38, 41), 42, '2024-2025', 'الدور الثاني'),
 ('en8-2025-26-1m', F + '/p2526.pdf', (1, 9), (10, 13), None, '2025-2026', 'الدور الأول (المدارس الصباحية)'),
 ('en8-2025-26-1e', F + '/p2526.pdf', (14, 22), (23, 26), None, '2025-2026', 'الدور الأول (المدارس المسائية)'),
 ('en8-2025-26-2', F + '/p2526.pdf', (27, 35), (36, 39), None, '2025-2026', 'الدور الثاني'),
]
ORDER = ['LISTENING 1', 'LISTENING 2', 'GRAMMAR/VOCABULARY', 'READING 1', 'READING 2', 'WRITING 1', 'WRITING 2']
AR = {'LISTENING 1': 'الاستماع 1', 'LISTENING 2': 'الاستماع 2', 'GRAMMAR/VOCABULARY': 'القواعد والمفردات', 'READING 1': 'القراءة 1', 'READING 2': 'القراءة 2', 'WRITING 1': 'الكتابة 1', 'WRITING 2': 'الكتابة 2'}

def run():
    allq = []; papers = {}
    for pid, pdf, (qa, qb), (ka, kb), scr, year, sess in PAPERS:
        secs = {}; cur = None
        with pdfplumber.open(pdf) as P:
            for pno in range(qa, qb + 1):
                t = P.pages[pno - 1].extract_text() or ''
                h, rest = B.page_header(t)
                if h:
                    cur = h
                    secs.setdefault(h, []).append(pno)
                elif cur and len(t) > 300 and not cur.startswith('WRITING'):
                    secs[cur].append(pno)
            kt = {p: (P.pages[p - 1].extract_text() or '') for p in range(ka, kb + 1)}
        miss = [s for s in ORDER if s not in secs]
        if miss: raise SystemExit('%s: أقسام ناقصة %s' % (pid, miss))
        total = 0
        for n, s in enumerate(ORDER, 1):
            pages = secs[s]
            img = B.save(B.stack([B.render(pdf, p) for p in pages]), 'en8/%s/sec%d.webp' % (pid, n))
            with pdfplumber.open(pdf) as P:
                t0 = '\n'.join(P.pages[p - 1].extract_text() or '' for p in pages)
            mk = sum(int(x) for x in re.findall(r'\(\s*(\d+)\s*marks?\s*\)', t0[:400], re.I))
            kp = [p for p, t in kt.items() if re.search(B.KEYLAB[s], t, re.I)][:1]
            if s.startswith('WRITING'):
                kp = [p for p, t in kt.items() if re.search(r'WRITING\s*%s\b' % s[-1], t, re.I)][:1]
            ai = [B.save(B.stack([B.render(pdf, p)]), 'en8/%s/key%d.webp' % (pid, p)) for p in kp]
            if scr and s.startswith('LISTENING'):
                ai.append(B.save(B.stack([B.render(pdf, scr)]), 'en8/%s/script%d.webp' % (pid, scr)))
            allq.append({'id': hashlib.md5((pid + s).encode()).hexdigest()[:14], 'p': pid, 'n': str(n), 'm': mk, 't': s, 'x': AR[s],
                         'a': 'نموذج الإجابة الرسمي في الصورة أدناه.' + (' ويليه نص الاستماع.' if scr and s.startswith('LISTENING') else ''),
                         'as': 'ms', 'c': '', 'ao': '', 'u': str(n), 'l': None, 'l2': None, 'srcno': n, 'im': img[0], 'w': img[1], 'h': img[2], 'ai': ai})
            total += mk
        papers[pid] = {'year': year, 'term': 1, 'session': sess + ' — الفصل الدراسي الأول', 'total': total}
        print(pid, total, {s: secs[s] for s in ORDER}, [q['ai'] and len(q['ai']) for q in allq[-7:]])
    json.dump({'papers': papers, 'units': {str(n): AR[s] for n, s in enumerate(ORDER, 1)}, 'q': allq}, open(B.OUT + '/finals_en8.json', 'w'), ensure_ascii=False, indent=1)

if __name__ == "__main__": run()
