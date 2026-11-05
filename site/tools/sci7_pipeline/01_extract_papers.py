# يُشغَّل أولًا: يستخرج أوراق العلوم صف 7 الثلاث إلى مجلد عمل مؤقت.
# يعدّل PAPER ranges أعلاه لو تغيّرت صفحات الأوراق في الملف المصدر.
# -*- coding: utf-8 -*-
"""يستخرج أوراق امتحان العلوم صف 7 الثلاث من الملف المجمّع، ويطبع جدول مراجعة.

- يستخدم مراسي علامات الدرجة [n] (الأدق في هذه الأوراق).
- يقصّ كل مفردة صورةً منظّفة ويحفظها webp.
- يطبع لكل مفردة: الرقم، الصفحة، الدرجة، وأول سطر من النص — للمراجعة وربط الدروس.
"""
import json, os, subprocess, sys

HERE = r'C:\Users\mmody\Documents\deepseek-harness\default-workspace\tahdir-app\tahdir-app-main\site\tools'
PY = sys.executable
SRC = r'D:\oman curriculam\OneDrive_1_12-10-2026\الفصل الدراسي الأول\7\العلوم\العلوم، الصف25،7 -26، الفصل 1.pdf'
OUT = os.path.join(os.environ.get('TEMP', '.'), 'sci7merge')

PAPERS = [
    # (صفحات الأسئلة، العام، الدور/الفترة، المنطقة)
    ('2-8',   '2025-2026', 'الدور الأول - الفترة الصباحية', ''),
    ('15-21', '2025-2026', 'الدور الأول - فترة مسائية', ''),
    ('27-33', '2025-2026', 'الدور الثاني', ''),
]

if os.path.exists(OUT):
    import shutil; shutil.rmtree(OUT)
os.makedirs(OUT, exist_ok=True)

all_items = []
for pages, year, session, region in PAPERS:
    cmd = [PY, os.path.join(HERE, 'extract_exam.py'), SRC,
           '--slug', 'sci7', '--out', OUT, '--pages', pages, '--anchor', 'qnum', '--cut', 'marks',
           '--year', year, '--session', session, '--region', region]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    print(r.stdout.strip() or r.stderr.strip()[:300])

# نجمع كل نتائج الاستخراج
import glob
for f in sorted(glob.glob(os.path.join(OUT, 'questions_sci7_*.json'))):
    j = json.load(open(f, encoding='utf-8'))
    for it in j['items']:
        it['paper'] = j['meta']['pages']
        it['session'] = j['meta']['session']
        all_items.append(it)

# ترقيم متسلسل واضح عبر الأوراق الثلاث
for i, it in enumerate(all_items, 1):
    it['seq'] = i

json.dump(all_items, open(os.path.join(OUT, 'ALL.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

print('\n' + '=' * 100)
print('إجمالي المفردات: %d | مجموع الدرجات: %d' % (len(all_items), sum(i['marks'] for i in all_items)))
print('=' * 100)
print('%-4s %-6s %-4s %-4s %s' % ('تسلسل', 'ورقة', 'ص', 'درجة', 'النص'))
for it in all_items:
    t = (it.get('text') or '').replace('\n', ' ')
    print('%-6d %-6s %-4s %-4s %s' % (it['seq'], it['paper'], it['src_page'], it['marks'], t[:88]))
