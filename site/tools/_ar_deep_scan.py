# -*- coding: utf-8 -*-
# فحص تفصيلي لكل درس عربي: الأسئلة في البنك، الأنشطة الصفية (متوسط/تحدٍّ)، والملخصات
# الهدف: إيجاد أي دروس فريغة فعلًا حتى لو البقايا متوسطة كمية
import json, glob, sys
sys.stdout.reconfigure(encoding='utf-8')

s = open('site/dist/worker.js', encoding='utf-8', errors='replace').read()
import re as _re
mm = _re.search(r'const QBANK\s*=', s)
i = mm.start()
a = i
import re as _re
b = s[a:].find('];')
qb = json.loads(s[a + s[a:].index('=') + 1:a + b + 1])
ar = [q for q in qb if isinstance(q.get('qid'), str) and q['qid'].startswith('ar')]
ar_ar = json.load(open('site/data/arabic_lessons_g5_to_g12.json', encoding='utf-8'))

from collections import Counter
per = Counter(q['lesson_id'] for q in ar)
zeros = [l['id'] for l in ar_ar if per.get(l['id'], 0) == 0]
counts = Counter(per.values())
print('بنك الأسئلة لكل درس: توزيع العدد ->', dict(sorted(counts.items())))
print('دروس بصفر أسئلة:', len(zeros), [(l['id'], l['title'][:30], l['grade']) for l in ar_ar if l['id'] in zeros][:10])

# محاكاة hardItems لكل درس: mid + hard بعدد الأسئلة المعروضة
def lvl(q): return {'استدلال': 3, 'AO2': 3, 'تطبيق': 2, 'AO1': 1, 'معرفة': 1}.get(q.get('ao'), 1)
def is_mid(q):
    return q.get('difficulty') == 'متوسطة' or (lvl(q) == 2 and (q.get('marks') or 1) <= 2)
hard_zero = []
hard_low = []
by_lesson = {}
for q in ar: by_lesson.setdefault(q['lesson_id'], []).append(q)
for l in ar_ar:
    mine = by_lesson.get(l['id'], [])
    mid = [q for q in mine if is_mid(q) and q.get('type') != 'long']
    hard = [q for q in mine if lvl(q) >= 2]
    pick = len(mid[:2]) + len(hard)
    n = min(pick, 7)
    if n == 0: hard_zero.append((l['id'], l['title'][:35], l['grade']))
    elif n <= 2: hard_low.append((l['id'], l['title'][:35], l['grade'], n))
print('دروس بصفر أنشطة صفية:', len(hard_zero), hard_zero[:10])
print('دروس لأنشطة ضئيلة (<=2):', len(hard_low), hard_low[:10])

# الملخص: intro فارغ أو outcomes فارغة
p = glob.glob('site/dist/assets/d/*/study.json')[0]
st = json.load(open(p, encoding='utf-8'))
weak_sum = []
for l in ar_ar:
    v = st['lessons'].get(str(l['id']))
    if not v:
        weak_sum.append((l['id'], l['title'][:30], 'no-study')); continue
    su = v.get('summary') or {}
    if not (su.get('intro') or '').strip() or not su.get('outcomes'):
        weak_sum.append((l['id'], l['title'][:30], 'weak-summary'))
print('دروس بملخص ضعيف/فارغ:', len(weak_sum), weak_sum[:10])

# إجابات الواجب: هل hw_a1 يبدأ بنجمة (*) أي أنه منسوخ من الأنشطة ولا يطابق واجبًا
a_star = [l for l in ar_ar if str(l.get('hw_a1') or '').strip().startswith('*') or str(l.get('hw_a2') or '').strip().startswith('*')]
print('دروس إجابة واجبها تبدأ بنجمة (مشكوك بمطابقتها):', len(a_star))
