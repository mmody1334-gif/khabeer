# مفردات القواعد/المفردات (1–10) من اختبارات الصف الثامن ← جمل مستقلة بخياراتها الثلاثة والإجابة المظللة في نموذج الإجابة
import sys, re, json, pdfplumber
sys.path.insert(0, '/home/claude/enfin'); sys.path.insert(0, '/home/claude/fin8')
import build as B
from bank import words, bubble_left
from build8 import PAPERS
GRAM = set('is are was were be been being am had have has did do does will would can could may might must should shall myself yourself oneself need off over himself herself itself ourselves yourselves themselves who which whose that where when whom a an the at on in to of for by with from if unless than more most less few many much some any its it\'s their there they he she we you i me him her us them while however because so but and or not don\'t doesn\'t didn\'t won\'t'.split())

def is_gram(opts):
    lo = [o.lower() for o in opts]
    if all(o in GRAM for o in lo): return True
    import os
    if len(os.path.commonprefix(lo)) >= 3: return True
    if set(lo) <= set('see saw seen say said saying go went gone'.split()): return True
    return all(o in GRAM for o in lo)  # صيغ لفعل واحد (win / wins / winning)

def rows_by_y(ws):
    rows = {}
    for w in ws:
        y = round((w[2] + w[4]) / 2 / 6)
        rows.setdefault(y, []).append(w)
    return [sorted(v, key=lambda w: w[1]) for k, v in sorted(rows.items())]

def gap(n): return r'_+\s*\(\s*%s\s*\)|\(\s*%s\s*\)\s*_+' % (n, n)
def run():
    out = []
    for pid, pdf, (qa, qb), (ka, kb), scr, year, sess in PAPERS:
        with pdfplumber.open(pdf) as P:
            gp = next(p for p in range(qa, qb + 1) if 'GRAMMAR/VOCABULARY' in (P.pages[p - 1].extract_text() or ''))
            t = P.pages[gp - 1].extract_text()
            kp = next((p for p in range(ka, kb + 1) if re.search(r'GRM\s*/\s*VCB', P.pages[p - 1].extract_text() or '')), ka + 1)
        lines = t.split('\n')
        i0 = next(i for i, l in enumerate(lines) if 'shade in the bubble' in l)
        opts = {}; body = []
        for l in lines[i0 + 1:]:
            mm = re.match(r'^(\d{1,2})\.\s+(.+)$', l.strip())
            if mm and int(mm.group(1)) <= 10 and len(mm.group(2).split()) == 3:
                opts[int(mm.group(1))] = mm.group(2).split()
            elif not opts:
                body.append(l)
        passage = ' '.join(body)
        # الإجابات من نموذج الإجابة
        ws = words(pdf, kp); im = B.render(pdf, kp, 110)
        rows = rows_by_y(ws); ans = {}; used = set()
        for n in sorted(opts):
            for ri, r in enumerate(rows):
                if ri in used: continue
                toks = [w[0] for w in r]
                if all(o in toks for o in opts[n]) and len(toks) <= 6:
                    sc = sorted(((bubble_left(im, next(w for w in r if w[0] == o)), o) for o in opts[n]), reverse=True)
                    if sc[0][0] >= 0.15 and sc[0][0] - sc[1][0] >= 0.04: ans[n] = sc[0][1]
                    used.add(ri); break
        # جملة مستقلة لكل فراغ: نملأ الفراغات الأخرى بإجاباتها
        filled = passage
        sents = re.split(r'(?<=[.!?])\s+', re.sub(r'\s+', ' ', passage))
        src = 'اختبار الوزارة للصف الثامن %s — %s' % (year.replace('-', '/'), sess)
        for n in sorted(opts):
            if n not in ans: continue
            s = next((x for x in sents if re.search(r'\(%d\)' % n, x)), None)
            if not s: continue
            for k in opts:
                if k != n and k in ans: s = re.sub(gap(k), ' ' + ans[k] + ' ', s)
            s = re.sub(gap(n), ' ______ ', s)
            s = re.sub(gap(r'\d+'), ' … ', s)
            s = re.sub(r'([a-z])to ', r'\1 to ', s); s = re.sub(r'\s+([,.;!?])', r'\1', re.sub(r'\s+', ' ', s)).strip()
            if '______' not in s or len(s) > 220: continue
            out.append({'k': 'G' if is_gram(opts[n]) else 'V', 'q': s, 'ch': [ans[n]] + [o for o in opts[n] if o != ans[n]], 'src': src, 'pid': pid})
        print(pid, 'opts', len(opts), 'keys', len(ans), ans)
    json.dump(out, open('/home/claude/fin8/out/bank8.json', 'w'), ensure_ascii=False, indent=1)
    print(len(out), sum(1 for x in out if x['k'] == 'G'), 'G')

if __name__ == "__main__": run()
