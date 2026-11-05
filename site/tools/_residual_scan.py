# -*- coding: utf-8 -*-
# البواقي: إجابة=سؤال، وبعد استثناء "الأسئلة الشقيقة" (أفعال الأمر التعليمية)
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

IMP = re.compile(r'^(علل|اذكر|حدد|ضح|وضح|عرف|عرفي|بين|س\d?\s*[/:]|س:\s*|استخرج|اقرا|اكتب|معد|قارن|أعد|عد|تمهل|بيّن|بين)')
les = {l['id']: l for l in json.load(io.open('site/data/arabic_lessons_g5_to_g12.json', encoding='utf-8'))}
res = io.open('site/tools/_residual.txt', 'w', encoding='utf-8')
n = 0
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
            if IMP.match(cn): continue          # سؤال شقيق/توجيه لا إجابة
            s = score(q, c)
            if s > bs: best, bs = c, s
        n += 1
        res.write('\n=== %d %s (%s) تط=%d\nسؤال: %s\nإجابة: %s\nأفضل: %s\n' % (
            l['id'], ak, l.get('title'), bs, q, a, (best if best else 'لا')))
res.close(); print('الحالات:', n)
