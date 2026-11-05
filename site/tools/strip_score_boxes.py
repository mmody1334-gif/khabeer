# -*- coding: utf-8 -*-
"""يزيل «صندوق درجة الصفحة» من كل صور الامتحانات (كل المواد والصفوف).

صندوق الدرجة مربّع بخط أفقي وداخله رقم، يُطبع في رأس كل صفحة امتحان، وكثيرًا ما
يدخل في قصّ السؤال الأول فيظهر «مربّع فيه رقم» لا علاقة له بالسؤال.

الاستخدام:
    python site/tools/strip_score_boxes.py            # قياس فقط: كم صورة فيها صندوق
    python site/tools/strip_score_boxes.py --apply    # يزيلها ويكتب الصور من جديد

الكشف بالبنية لا بالحجم (انظر strip_score_box في clean_fin.py)، ولذلك يقبل
الصناديق الكاملة والمقطوعة جزئيًا، ويرفض الجداول والحدود والأشكال المشابهة.
"""
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clean_fin import strip_score_box, DARK

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'finals', 'img')
APPLY = '--apply' in sys.argv


def corner_ink(g):
    H, W = g.shape
    return float((g[:max(10, int(H * 0.30)), :max(10, int(W * 0.22))] < 170).mean())


files = []
for r, _, fs in os.walk(D):
    for f in fs:
        if f.lower().endswith(('.webp', '.png', '.jpg', '.jpeg')):
            files.append(os.path.join(r, f))
files.sort()
print('عدد الصور: %d | وضع التطبيق: %s' % (len(files), 'نعم' if APPLY else 'قياس فقط'))

hits, changed = [], 0
for k, p in enumerate(files, 1):
    try:
        im = Image.open(p)
        g = np.array(im.convert('L'))
        before = corner_ink(g)
        a = g.copy()
        n = strip_score_box(a)
        if n:
            hits.append((os.path.relpath(p, D), n, round(before, 4)))
            if APPLY:
                rgb = np.array(im.convert('RGB'))
                mask = (a == 255) & (g != 255)
                rgb[mask] = 255
                Image.fromarray(rgb).save(p, 'WEBP', quality=88, method=4)
                changed += 1
    except Exception as e:
        print('خطأ في %s: %s' % (os.path.basename(p), str(e)[:60]))
    if k % 400 == 0:
        print('   ... فُحص %d/%d | إصابات حتى الآن %d' % (k, len(files), len(hits)))

print('\n=== النتيجة ===')
print('صور أُزيل منها صندوق الدرجة: %d' % len(hits))
if APPLY:
    print('صور كُتبت من جديد: %d' % changed)
from collections import Counter
c = Counter(h[0].split(os.sep)[0] for h in hits)
print('التوزيع على المجلدات: %s' % dict(c))
import json
json.dump(hits, open(os.path.join(os.environ.get('TEMP','.'), 'box_hits.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for rel, n, b in hits: print('   %-30s صناديق=%d كثافة_قبل=%.4f' % (rel, n, b))
