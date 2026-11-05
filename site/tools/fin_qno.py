#!/usr/bin/env python3
"""يبيّض رقم السؤال الأصلي المطبوع في أول صورة سؤال الاختبار النهائي («٦)»).

المنصة ترقّم أسئلة ورقة المعلم من جديد وتكتب الرقم فوق الصورة، فيظهر الرقم الأصلي
للامتحان داخل الصورة رقمًا ثانيًا خاطئًا. المواضع (qb) يحدّدها fin_labels.py ويحفظها في
site/data/finals.json، ولا يُحفظ موضع إلا إذا قُرئ فيه رقم السؤال الأصلي نفسه.

يُشغَّل عند النشر على نسخة الأصول (dist/assets/fin) — الأصول في site/finals تبقى كما هي:
    python3 site/tools/fin_qno.py site/dist/assets/fin
لا يفشل أبدًا (يتخطى أي صورة بها مشكلة).
"""
import json, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'finals', 'img')
    d = json.load(open(os.path.join(ROOT, 'data', 'finals.json'), encoding='utf-8'))
    n = bad = 0
    for G in d.values():
        for q in G.get('q', []):
            b, im = q.get('qb'), q.get('im')
            if not b or not im:
                continue
            p = os.path.join(root, im)
            try:
                img = Image.open(p).convert('RGB')
                x, y, w, h = b
                img.paste((255, 255, 255), (max(0, x), max(0, y), min(img.width, x + w), min(img.height, y + h)))
                img.save(p, 'WEBP', quality=88, method=4)
                n += 1
            except Exception as e:  # noqa
                bad += 1
                print('skip', im, e)
    print(f'fin_qno: {n} question numbers removed, {bad} skipped')


if __name__ == '__main__':
    main()
