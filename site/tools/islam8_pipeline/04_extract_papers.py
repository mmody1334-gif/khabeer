# -*- coding: utf-8 -*-
"""يستخرج نصوص أسئلة أوراق التربية الإسلامية صف 8 (5 أوراق).

طبقة النص في هذه الأوراق مجزّأة أسطرًا ومعها خطوط نقاط الكتابة، فننظّفها:
  - نحذف أسطر النقاط (…… / ....) والخطوط الفاصلة والأرقام المعزولة.
  - ننضمّ الشظايا في نصّ واحد لكل ورقة.
  - نقطع عند عناوين الأسئلة «السؤال الأول/الثاني/...» وعند الأجزاء «(أ)(ب)(ج)(د)».
  - نلتقط درجة كل جزء من «( N ) درجات» أو «[ N ]».
الناتج: JSON فيه لكل ورقة أجزاؤها ونصوصها، لربطها بنماذج الإجابة.
"""
import json, os, re, sys
import pymupdf

BASE = r'D:\oman curriculam\OneDrive_1_12-10-2026\الفصل الدراسي الأول\8'
DL = r'C:\Users\mmody\Downloads'
OUT = os.path.join(os.environ.get('TEMP', '.'), 'islam_papers.json')

ORD = {'األول': 1, 'الأول': 1, 'الاول': 1, 'الثاني': 2, 'الثاين': 2, 'الثالث': 3, 'الرابع': 4,
       'الخامس': 5, 'السادس': 6}

FIX = [('اإلسالمي', 'الإسلامي'), ('اإلسالم', 'الإسلام'), ('األول', 'الأول'), ('اآلتية', 'الآتية'),
       ('اآلتي', 'الآتي'), ('األرض', 'الأرض'), ('اإلنسان', 'الإنسان'), ('اإليمان', 'الإيمان'),
       ('هللا', 'الله'), ('ال تعاىل', 'الله تعالى'), ('األحزاب', 'الأحزاب'), ('األناة', 'الأناة'),
       ('األخالق', 'الأخلاق'), ('األمانة', 'الأمانة'), ('األمن', 'الأمن'), ('األنصار', 'الأنصار'),
       ('األنبياء', 'الأنبياء'), ('األحكام', 'الأحكام'), ('األخبار', 'الأخبار'), ('األموال', 'الأموال')]


def fix(t):
    for a, b in FIX:
        t = t.replace(a, b)
    return t


DOTS = re.compile(r'^[\s._\-–—·…]+$')


def clean_lines(path):
    doc = pymupdf.open(path)
    out = []
    for pi in range(doc.page_count):
        raw = doc[pi].get_text()
        for ln in raw.split('\n'):
            s = ln.strip()
            if not s:
                continue
            if DOTS.match(s):
                continue
            # سطر نقاط طويل داخل نص (نقتطع الجزء النقّطي)
            s = re.sub(r'[._…-]{6,}', ' ', s)
            s = re.sub(r'\s{2,}', ' ', s).strip()
            if len(s) < 3 or DOTS.match(s):
                continue
            if re.fullmatch(r'[\d\s\(\)\[\]\.\-]{1,6}', s):   # أرقام معزولة
                continue
            out.append((pi + 1, fix(s)))
    return out


def is_header(s):
    """هل السطر عنوان سؤال أو جزء؟"""
    if re.search(r'السؤال\s+ال', s):
        return 'q'
    if re.fullmatch(r'[\(\[]\s*[أبجد]\s*[\)\]]\s*[\d\s\.]*', s) or re.match(r'^[\(\[]\s*[أبجد]\s*[\)\]]', s):
        return 'part'
    if re.match(r'^\s*[أبجد]\s*[\)\-–]\s', s):
        return 'part'
    return None


def marks_of(s):
    m = re.search(r'[\(\[]\s*(\d{1,2})\s*[\)\]]\s*درج', s) or re.search(r'\(\s*(\d{1,2})\s*\)\s*درج', s) or re.search(r'\[\s*(\d{1,2})\s*\]', s)
    return int(m.group(1)) if m else None


def parse_paper(path, label):
    lines = clean_lines(path)
    items, cur = [], None
    for pno, s in lines:
        kind = is_header(s)
        if kind == 'q':
            m = re.search(r'السؤال\s+ال(\S+)', s)
            no = ORD.get(m.group(1), None) if m else None
            cur = {'paper': label, 'page': pno, 'q': no, 'part': None,
                   'marks': marks_of(s), 'text': re.sub(r'^.*?درجات\s*', '', s).strip(), 'src': s}
            items.append(cur)
            continue
        if kind == 'part':
            lab = re.search(r'[أبجد]', s)
            cur = {'paper': label, 'page': pno, 'q': (items[-1]['q'] if items else None),
                   'part': lab.group(0) if lab else None, 'marks': marks_of(s),
                   'text': re.sub(r'^[\(\[]?\s*[أبجد]\s*[\)\]]?\s*', '', s).strip(), 'src': s}
            items.append(cur)
            continue
        if cur is None:
            continue
        mk = marks_of(s)
        if mk and cur.get('marks') is None:
            cur['marks'] = mk
        add = re.sub(r'^[\(\[]?\s*[أبجد]\s*[\)\]]?\s*', '', s)
        if add and len(add) > 2:
            cur['text'] = (cur['text'] + ' ' + add).strip()
    # تنظيف نهائي
    for it in items:
        it['text'] = re.sub(r'\s{2,}', ' ', it['text']).strip(' .:-–—')
        it['text'] = re.sub(r'^[\d\s\.\)\]]+', '', it['text']).strip()
    return [it for it in items if len(it['text']) >= 8]


def main():
    papers = []
    srcs = [
        (os.path.join(BASE, 'Q8IslamicEdu_AlDhahirah_FirstExam_2023-2024.pdf'), 'الداخلية 2023-2024 د1'),
        (os.path.join(BASE, 'Q8IslamicEdu_AlSharqiah_SecondExam_2023-2024.pdf'), 'الشرقية 2023-2024 د2'),
        (os.path.join(BASE, 'Q8IslamicEdu_Dhofar_FirstExam_2023-2024.pdf'), 'ظفار 2023-2024 د1'),
        (os.path.join(BASE, 'Qs&Ans_IslamicStudies, Grade8, 2024-2025, Sem1.pdf'), 'أسئلة وأجوبة 2024-2025'),
        (os.path.join(BASE, 'التربية الإسلامية، الصف8، 25-26، الفصل1.pdf'), 'المنهج 2025-2026'),
    ]
    for p, lab in srcs:
        if not os.path.exists(p):
            print('ناقص:', lab); continue
        items = parse_paper(p, lab)
        papers += items
        print('%-28s مفردات=%-4d | أمثلة: %s' % (lab, len(items),
              ' | '.join(i['text'][:40] for i in items[:2])))
    json.dump(papers, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\nالإجمالي: %d | الحفظ: %s' % (len(papers), OUT))
    print('\n=== كل المفردات المستخرجة ===')
    for i, it in enumerate(papers, 1):
        print('%3d [%s] س%s جزء %s درجة=%s' % (i, it['paper'][:12], it['q'], it['part'], it['marks']))
        print('     %s' % it['text'][:130])


if __name__ == '__main__':
    main()
