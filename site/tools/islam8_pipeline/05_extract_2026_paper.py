# -*- coding: utf-8 -*-
"""يستخرج نصوص أسئلة الورقة الأنظف (2025-2026) ويعرضها مرتّبة حسب السؤال والجزء.

هذه الورقة طبقة نصّها أنظف من غيرها، فنستخرج منها أسئلة صالحة للعرض كاملة،
ونربطها بدروس المنهج بالكلمات المفتاحية.
"""
import json, os, re
import pymupdf

BASE = r'D:\oman curriculam\OneDrive_1_12-10-2026\الفصل الدراسي الأول\8'
SRC = os.path.join(BASE, 'التربية الإسلامية، الصف8، 25-26، الفصل1.pdf')
OUT = os.path.join(os.environ.get('TEMP', '.'), 'islam_2026.json')

FIX = [('اإلسالم', 'الإسلام'), ('األول', 'الأول'), ('اآلتية', 'الآتية'), ('اآلتي', 'الآتي'),
       ('اإلنسان', 'الإنسان'), ('اإليمان', 'الإيمان'), ('األرض', 'الأرض'), ('األناة', 'الأناة'),
       ('هللا', 'الله'), ('األحزاب', 'الأحزاب'), ('األمانة', 'الأمانة'), ('األخالق', 'الأخلاق'),
       ('ال تعاىل', 'الله تعالى'), ('األمن', 'الأمن'), ('األنصار', 'الأنصار')]


def fix(t):
    for a, b in FIX:
        t = t.replace(a, b)
    t = re.sub(r'[._…-]{5,}', ' ', t)
    t = re.sub(r'\s{2,}', ' ', t)
    return t.strip()


AR = '[\u0600-\u06FF]'


def main():
    doc = pymupdf.open(SRC)
    print('صفحات الورقة: %d' % doc.page_count)
    # نجمع نص كل الصفحات في سطور نظيفة
    lines = []
    for pi in range(doc.page_count):
        for ln in doc[pi].get_text().split('\n'):
            s = fix(ln)
            if len(s) < 4:
                continue
            if re.fullmatch(r'[\d\s\(\)\[\]\.\-:]+', s):
                continue
            lines.append((pi + 1, s))
    text = ' '.join(s for _, s in lines)
    # نقطع عند «السؤال ...» ثم عند الأجزاء «(أ) (ب) (ج) (د)»
    parts = re.split(r'(?=السؤال\s+ال(?:أول|اول|ثاني|ثاين|ثالث|رابع|خامس|سادس))', text)
    items = []
    for chunk in parts:
        chunk = chunk.strip()
        if not chunk:
            continue
        mq = re.match(r'السؤال\s+ال(\S+)', chunk)
        qno = mq.group(1) if mq else ''
        # نقسم على الأجزاء
        sub = re.split(r'(?=[\(\[]\s*[أبجد]\s*[\)\]]|(?<![\u0600-\u06FF])[أبجد]\s*[\)\-–]\s)', chunk)
        for sc in sub:
            sc = sc.strip()
            if len(sc) < 10:
                continue
            mp = re.match(r'[\(\[]?\s*([أبجد])\s*[\)\]]?', sc)
            pno = mp.group(1) if mp else ''
            body = re.sub(r'^[\(\[]?\s*[أبجد]\s*[\)\]]?\s*', '', sc).strip()
            body = re.sub(r'^السؤال\s+ال\S+\s*[:\-–]?\s*', '', body)
            body = re.sub(r'^\s*[\(\[]\s*\d{1,2}\s*[\)\]]\s*(درجات?|درجة)?\s*[\.:]?\s*', '', body)
            body = re.sub(r'\s*[\(\[]\s*\d{1,2}\s*[\)\]]\s*$', '', body)
            if len(body) < 12:
                continue
            # نقتصر على النص العربي المعقول (نتجاهل الآيات الطويلة المشوّهة)
            if len(re.findall(AR, body)) < 8:
                continue
            items.append({'q': qno, 'part': pno, 'text': body[:600]})
    # إزالة التكرار
    seen, uniq = set(), []
    for it in items:
        k = it['text'][:80]
        if k in seen:
            continue
        seen.add(k)
        uniq.append(it)
    json.dump(uniq, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('مفردات مستخرجة: %d' % len(uniq))
    for i, it in enumerate(uniq[:40], 1):
        print('%3d س%s/جزء %s: %s' % (i, it['q'][:6], it['part'], it['text'][:110]))
    print('\nالحفظ: %s' % OUT)


if __name__ == '__main__':
    main()
