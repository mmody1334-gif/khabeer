# -*- coding: utf-8 -*-
"""يستخرج مفردات نماذج الإجابة الثلاثة (الإجابة + الدرجة + صفحة الكتاب + المستوى).

التنسيق الموحّد في النماذج:
    ... <الإجابة> <الدرجة 1 أو 2> <صفحة الكتاب 15..170> <المستوى المعرفي> ...
مثال حقيقي:
    «متصل. 1 35 تطبيق»              ⇒ الإجابة «متصل.» درجة 1 صفحة 35 مستوى تطبيق
    «الوقوف بعرفة. 1 50 تطبيق»      ⇒ الإجابة «الوقوف بعرفة.» درجة 1 صفحة 50
    «بهتان ا . 1 73 فهم»            ⇒ الإجابة «بهتان» (الشظية «ا» ضجيج استخراج)
"""
import json, os, re
import pymupdf

BASE = r'D:\oman curriculam\OneDrive_1_12-10-2026\الفصل الدراسي الأول\8'
OUT = os.path.join(os.environ.get('TEMP', '.'), 'islam_answers.json')

LEVELS = r'(?:ال\s?ت\s?ذ\s?ك\s?ر|ت\s?ذ\s?ك\s?ر|ال\s?ف\s?ه\s?م|ف\s?ه\s?م|ال\s?ت\s?ط\s?ب\s?ي\s?ق|ت\s?ط\s?ب\s?ي\s?ق|ال\s?ق\s?د\s?ر\s?ا\s?ت|ق\s?د\s?ر\s?ا\s?ت|م\s?ق\s?ا\s?ل\s?ي|م\s?و\s?ض\s?و\s?ع\s?ي)'
ROW = re.compile(r'([\u0621-\u064A\u0671-\u06D3][^0-9]{2,120}?)\s+([12])\s+(\d{2,3})\s+(' + LEVELS + r')')

NOISE_WORDS = ('الدرجة', 'الصفحة', 'المستوى', 'المفردة', 'الجزئية', 'المخرج', 'البديل',
               'المجموع', 'تابع', 'نموذج', 'امتحان', 'المادة', 'التربية', 'يتبع')

FIX = [('اإلسالمي', 'الإسلامي'), ('اإلسالم', 'الإسلام'), ('األول', 'الأول'),
       ('اآلتية', 'الآتية'), ('هللا', 'الله'), ('ال تعاىل', 'الله تعالى'),
       ('ال تذكر', 'التذكر'), ('ال فهم', 'الفهم'), ('ال تطبيق', 'التطبيق'),
       ('ال قدرات', 'القدرات'), ('ر تذك', 'تذكر'), ('قدرا ت', 'قدرات')]


def fix(t):
    for a, b in FIX:
        t = t.replace(a, b)
    return re.sub(r'\s{2,}', ' ', t).strip()


def parse(path, label, session):
    doc = pymupdf.open(path)
    items = []
    for pi in range(doc.page_count):
        t = fix(re.sub(r'\s+', ' ', doc[pi].get_text()))
        for m in ROW.finditer(t):
            ans = m.group(1).strip(' .:-–—')
            marks = int(m.group(2))
            page = int(m.group(3))
            level = re.sub(r'\s+', '', m.group(4))
            if not (12 <= page <= 170):
                continue
            if len(ans) < 3 or any(w in ans for w in NOISE_WORDS):
                continue
            # نُبقي آخر 90 حرفًا فقط (الجزء الأقرب للدرجة هو الإجابة)
            if len(ans) > 90:
                ans = ans[-90:].strip(' .:-–—')
            items.append({'src': label, 'session': session, 'page': pi + 1,
                          'ans': ans, 'marks': marks, 'book_page': page, 'level': level})
    return items


def main():
    files = [
        ('Ans8IslamicEdu_AlDhahirah_FirstExam_2023-2024.pdf', 'الداخلية', '2023-2024 الدور الأول'),
        ('Ans8IslamicEdu_AlSharqiah_SecondExam_2023-2024.pdf', 'الشرقية', '2023-2024 الدور الثاني'),
        ('Ans8IslamicEdu_Dhofar_FirstExam_2023-2024.pdf', 'ظفار', '2023-2024 الدور الأول'),
    ]
    all_items = []
    for f, lab, session in files:
        p = os.path.join(BASE, f)
        if not os.path.exists(p):
            print('ناقص:', f); continue
        items = parse(p, lab, session)
        all_items += items
        print('%-12s مفردات=%-4d | أول 4: %s' % (lab, len(items),
              ' · '.join('%s(%dص%d)' % (i['ans'][:16], i['marks'], i['book_page']) for i in items[:4])))
    json.dump(all_items, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\nالإجمالي: %d | الحفظ في %s' % (len(all_items), OUT))
    # توزيع الصفحات للتحقق من الربط
    from collections import Counter
    c = Counter(i['book_page'] for i in all_items)
    print('أكثر صفحات الكتاب تكرارًا:', c.most_common(12))


if __name__ == '__main__':
    main()
