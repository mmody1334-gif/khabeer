# -*- coding: utf-8 -*-
# فحص الحالات التي إجابتها = سؤالها: احسب أفضل مرشّح (بعد استثناء نسخ السؤال)
import json, io, re, sys
sys.stdout.reconfigure(encoding='utf-8')
src = io.open('site/tools/_fix_ar_hw.py', encoding='utf-8').read()
cut = src.find('# ---------- التنفيذ ----------')
g = {}; exec(compile(src[:cut], 'f', 'exec'), g)
norm = g['norm']; stem_clean = g['stem_clean']; tokens = g['tokens']; score = g['score']
def lines_of(txt):
    out = []
    for ln in str(txt or '').split('\n'):
        ln = re.sub(r'^[\s\-\=\_\d\.\)\*\u0660-\u0669]+', '', ln.strip()).strip()
        if len(ln) >= 15 and not ln.endswith('؟') and not ln.rstrip().endswith(':'):
            out.append(ln)
    return out

les = {l['id']: l for l in json.load(io.open('site/data/arabic_lessons_g5_to_g12.json', encoding='utf-8'))}
res = io.open('site/tools/_same_scan.txt', 'w', encoding='utf-8')
for l in les.values():
    for qk, ak in (('hw_q1', 'hw_a1'), ('hw_q2', 'hw_a2')):
        q, a = str(l.get(qk) or ''), str(l.get(ak) or '')
        if not q.strip() or not a.strip(): continue
        qz = norm(stem_clean(q)).replace('؟', '').replace('?', '').rstrip('. ').strip()
        az = norm(a).replace('؟', '').replace('?', '').rstrip('. ').strip()
        if re.sub(r'[\W_]+', '', qz) != re.sub(r'[\W_]+', '', az): continue
        cands = []
        for f in ('activities_teach', 'formative', 'closing', 'enrich', 'concepts'):
            cands += lines_of(l.get(f))
        best, bs = None, 0
        for c in cands:
            cn = norm(c).replace('؟', '').replace('?', '').rstrip('. ').strip()
            if re.sub(r'[\W_]+', '', cn) == re.sub(r'[\W_]+', '', qz): continue
            if len(cn) < len(qz) and cn in qz: continue
            s = score(q, c)
            if s > bs: best, bs = c, s
        res.write('%d %s | ق=%s | أفضل=%s (ت%d)\n' % (l['id'], ak, q[:55], (best[:60] if best else 'لا مرشح'), bs))
res.close(); print('انتهى')
