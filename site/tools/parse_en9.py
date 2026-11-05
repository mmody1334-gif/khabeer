# يحوّل دفتر تحضير الإنجليزي (PDF) إلى دروس بصيغة الموقع
import re, json, sys, subprocess, difflib
src = sys.argv[1]; out = sys.argv[2]
txt = subprocess.run(['pdftotext', '-layout', src, '-'], capture_output=True, text=True).stdout
AR = re.compile(r'[؀-ۿﭐ-﻿]')
lines = [l for l in txt.split('\n') if not re.search(r'Alnoufli|Grade 9A · English Lesson Plans|Noor LMS-ready', l)]
# ---- contents
cont = {}
for l in lines:
    m = re.match(r'^\s*(\d{1,2})\s+([A-Z][A-Z ]+?)\s{2,}(.+?)\s{2,}(Starter|Unit\d: Lesson\d)\s*$', l)
    if m and int(m.group(1)) not in cont: cont[int(m.group(1))] = (m.group(2).strip(), m.group(3).strip(), m.group(4))
cont[49] = ('REVIEW', 'Review: Units 1–3 (Workbook)', 'Unit3: Lesson8')
UNITS = {0: 'Starter: Fun times!', 1: 'Unit 1: Identity', 2: 'Unit 2: Connections', 3: 'Unit 3: The future is now'}
# ---- lesson blocks
starts = [i for i, l in enumerate(lines) if re.match(r'^\s*LESSON\s*$', l) or re.match(r'^\s*LESSON\s{2,}\S', l)]
assert len(starts) == 49, len(starts)
starts.append(len(lines))
NOUR_STRAT = ['الفصل المقلوب','التعلم التعاوني','التعلم التشاركي','التعلم الذاتي','التعلم بالاكتشاف','التعلم المبني على حل المشكلات','التعلم المبني على المشاريع','التعلم المبني على اللعب','التعلم بالنمذجة','التعلم المتمايز','الخرائط الذهنية','العصف الذهني','رحلات تعليمية','رحلات تعليمية افتراضية','تجارب معملية','تجارب معملية افتراضية','تقارير كتب','دراسة حالة','أخرى']
NOUR_RES = ['الكتاب','كتب الكترونية','السبورة التقليدية','السبورة الذكية','الأقلام','جهاز عرض البيانات','جهاز الحاسب','صورة توضيحية','عروض تقديمية','نماذج مجسمة','الوسائط المتعددة (سمعية - بصرية)','الوسائط الاجتماعية','برمجيات /تطبيقات مثل Edpuzzle, Padlet, Kahoot','أخرى']
def norm(s): return re.sub(r'[ًٌٍَُِّْـ]', '', s).replace('ي', 'ى').replace('ى', 'ي').replace('ئ','ي').replace('ة', 'ه').replace('أ','ا').replace('إ','ا').replace('آ','ا')
def pres_fix(s):  # glyph quirk in this PDF: final ي shown as ين / similar
    return s.replace('الذهين', 'الذهني').replace('االسرتاتيجيات','الاستراتيجيات')
def match_list(raw, lst):
    raw = pres_fix(raw)
    parts = [p.strip(' )(') for p in re.split(r'[،,]', raw) if p.strip(' )(')]
    got = []
    full = norm(raw)
    for item in lst:
        n = norm(item.split(' (')[0])
        if n and n in full and item not in got: got.append(item)
    for p in parts:
        best = difflib.get_close_matches(norm(p), [norm(x) for x in lst], 1, 0.75)
        if best:
            it = lst[[norm(x) for x in lst].index(best[0])]
            if it not in got: got.append(it)
    return got
def clean_block(ls):
    out = []
    for l in ls:
        if AR.search(l) and re.search(r'[A-Za-z]{3,}', l):
            l = re.sub(r'[\u202a-\u202e\u200e\u200f]*[\u0600-\u06FF\uFB50-\uFEFF][\u0600-\u06FF\uFB50-\uFEFF \u202a-\u202e\u200e\u200f]*', ' ', l)
        if AR.search(l):
            l = re.sub(r'\s{3,}[؀-ۿﭐ-﻿‎‏‪-‮ /()،:]+$', '', l)
            if AR.search(l) and not re.search(r'[A-Za-z]{3,}', l): continue
        s = l.strip()
        if not s: continue
        s = re.sub(r'\s{2,}', ' ', s)
        if out and not re.match(r'^(◆|–|STEP\s*\d|Ex\s*\d|By the end)', s) and not out[-1].endswith(':'):
            out[-1] += ' ' + s
        else:
            out.append(s)
    res = []
    for s in out:
        s = s.replace('◆ ', '• ').replace('◆', '•')
        if s.startswith('– '): s = '   - ' + s[2:]
        m = re.match(r'^STEP\s*(\d+)\s+(.*)$', s)
        if m: s = 'Step ' + m.group(1) + ': ' + m.group(2)
        res.append(s)
    return '\n'.join(res).strip()
SECS = [('Objectives', 'outcomes'), ('Concepts', 'concepts'), ('Warm-up', 'pre_learning'), ('Lesson Procedures', 'activities_teach'),
        ('Formative Assessment', 'formative'), ('Closing Assessment', 'closing'), ('Weekly Study Plan Comments', 'weekly')]
lessons = []
for k in range(49):
    blk = lines[starts[k]:starts[k + 1]]
    n = k + 1
    skill, title, tree = cont[n]
    def between(a, b):
        ia = next((i for i, l in enumerate(blk) if re.match(r'^\s*' + a + r'\s*$', l) or re.search(r'^\s*' + a + r'\b', l)), None)
        if ia is None: return []
        ib = next((i for i in range(ia + 1, len(blk)) if re.search(r'^\s*' + b + r'\b', blk[i])), len(blk))
        first = re.sub(r'^\s*' + a, '', blk[ia]) if a == 'Materials' else ''
        return ([first] if first.strip() else []) + blk[ia + 1:ib]
    mat = clean_block(between('Materials', 'Level'))
    strat = ' '.join(l.strip() for l in between('Strategies', 'Resources'))
    res = ' '.join(l.strip() for l in between('Resources', r'\d\s+Objectives|1\s'))
    lv = ' '.join(l.strip() for l in between('Level', 'Strategies'))
    sec = {}
    idx = [(i, key) for i, l in enumerate(blk) for name, key in SECS if re.match(r'^\s*\d\s+' + re.escape(name) + r'\b', l)]
    for j, (i, key) in enumerate(idx):
        end = idx[j + 1][0] if j + 1 < len(idx) else len(blk)
        sec[key] = clean_block(blk[i + 1:end])
    m = re.match(r'Unit(\d): Lesson(\d)', tree)
    unit, lno = (int(m.group(1)), int(m.group(2))) if m else (0, 1)
    acts = ('Materials: ' + mat + '\n' if mat else '') + sec.get('activities_teach', '')
    lessons.append({'n': n, 'skill': skill.title(), 'title': title, 'nour_tree': tree, 'unit': str(unit), 'unit_name': UNITS[unit], 'lesson_no': lno,
                    'materials': mat, 'level_raw': lv, 'strategies_nour': match_list(strat, NOUR_STRAT), 'resources_nour': match_list(res, NOUR_RES),
                    'outcomes': sec.get('outcomes', '').replace('By the end of the lesson, students will be able to:', '').strip(),
                    'concepts': sec.get('concepts', ''), 'pre_learning': sec.get('pre_learning', ''), 'activities_teach': acts,
                    'formative': sec.get('formative', ''), 'closing': sec.get('closing', '')})
json.dump(lessons, open(out, 'w'), ensure_ascii=False, indent=1)
for l in lessons[:3] + lessons[47:]:
    print(l['n'], l['nour_tree'], l['unit'], l['lesson_no'], l['title'], l['strategies_nour'], l['resources_nour'])
print({k: sum(1 for l in lessons if not l[k]) for k in ['outcomes', 'concepts', 'pre_learning', 'activities_teach', 'formative', 'closing', 'materials']})
