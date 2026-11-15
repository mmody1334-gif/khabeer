"""يرحّل كيمياء الصف العاشر — الفصل الدراسي الثاني من بيانات المنصة الظاهرة إلى مخزن مخفي.

المحتوى (14 درسًا 348–361، بنك الأسئلة، الملخصات والخطط العلاجية، الألعاب، امتحانا 2024/2025 j33)
كان مسجّلًا خطأً كأنه مقرر الصف العاشر الوحيد. يُنقل إلى site/data/term2/chem10/ كما هو بلا أي تعديل،
ولا يقرأه build_worker.py، فلا يظهر في أي صفحة. عند إضافة الفصل الدراسي الثاني إلى المنصة يُعاد بـ:
  python3 stash_term2.py <SITE> --restore
الاستخدام: python3 stash_term2.py <SITE>   (آمن عند التكرار)
"""
import json, os, shutil, sys

SITE = sys.argv[1]
RESTORE = '--restore' in sys.argv
D = os.path.join(SITE, 'data')
OUT = os.path.join(D, 'term2', 'chem10')
KEY = 'الكيمياء|العاشر'
IDS = set(range(348, 362))
UNITS = ['5', '6', '7', '8']


def rd(p):
    return json.load(open(p, encoding='utf-8'))


def wr(p, o, indent=1):
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(o, f, ensure_ascii=False, indent=indent)


def dump_style(p):
    s = open(p, encoding='utf-8').read(200)
    return None if s.startswith('{"') or s.startswith('[{') else 1


def stash():
    os.makedirs(OUT, exist_ok=True)
    if os.path.exists(os.path.join(OUT, 'lessons.json')):
        print('already stashed'); return
    styles = {f: dump_style(os.path.join(D, f)) for f in ('lessons.json', 'quiz_bank.json', 'study_pack.json', 'games_pack.json', 'finals.json')}
    L = rd(os.path.join(D, 'lessons.json'))
    t2 = [l for l in L if l['id'] in IDS]
    assert len(t2) == 14 and all(l.get('subject') == 'الكيمياء' and l['grade'] == 'العاشر' and l.get('term') == 2 for l in t2)
    wr(os.path.join(OUT, 'lessons.json'), t2)
    wr(os.path.join(D, 'lessons.json'), [l for l in L if l['id'] not in IDS], styles['lessons.json'])

    Q = rd(os.path.join(D, 'quiz_bank.json'))
    wr(os.path.join(OUT, 'quiz_bank.json'), [q for q in Q if q['lesson_id'] in IDS])
    wr(os.path.join(D, 'quiz_bank.json'), [q for q in Q if q['lesson_id'] not in IDS], styles['quiz_bank.json'])

    S = rd(os.path.join(D, 'study_pack.json'))
    st = {'lessons': {k: S['lessons'].pop(k) for k in list(S['lessons']) if int(k) in IDS},
          'units': {k: S['units'].pop(k) for k in list(S['units']) if k in [KEY + '|' + u for u in UNITS]}}
    wr(os.path.join(OUT, 'study_pack.json'), st)
    wr(os.path.join(D, 'study_pack.json'), S, styles['study_pack.json'])

    G = rd(os.path.join(D, 'games_pack.json'))
    wr(os.path.join(OUT, 'games_pack.json'), {k: G.pop(k) for k in list(G) if k.isdigit() and int(k) in IDS})
    wr(os.path.join(D, 'games_pack.json'), G, styles['games_pack.json'])

    F = rd(os.path.join(D, 'finals.json'))
    fin = F.pop(KEY)
    assert all(p.get('term') == 2 for p in fin['papers'].values())
    wr(os.path.join(OUT, 'finals.json'), fin)
    wr(os.path.join(D, 'finals.json'), F, styles['finals.json'])
    src = os.path.join(SITE, 'finals', 'img', 'chem10')
    dst = os.path.join(OUT, 'finals_img')
    os.makedirs(dst, exist_ok=True)
    for q in fin['q']:
        n = os.path.basename(q['im'])
        if os.path.exists(os.path.join(src, n)):
            shutil.move(os.path.join(src, n), os.path.join(dst, n))
    if os.path.isdir(src) and not os.listdir(src):
        os.rmdir(src)
    print('stashed', len(t2), 'lessons')


def restore():
    """يُستخدم عند إضافة الفصل الثاني: يدمج المخزن مع بيانات الفصل الأول (لا يستبدلها)."""
    L = rd(os.path.join(D, 'lessons.json')); t2 = rd(os.path.join(OUT, 'lessons.json'))
    have = {l['id'] for l in L}
    wr(os.path.join(D, 'lessons.json'), L + [l for l in t2 if l['id'] not in have])
    Q = rd(os.path.join(D, 'quiz_bank.json')); qh = {q['qid'] for q in Q}
    wr(os.path.join(D, 'quiz_bank.json'), Q + [q for q in rd(os.path.join(OUT, 'quiz_bank.json')) if q['qid'] not in qh])
    S = rd(os.path.join(D, 'study_pack.json')); st = rd(os.path.join(OUT, 'study_pack.json'))
    S['lessons'].update(st['lessons']); S['units'].update(st['units'])
    wr(os.path.join(D, 'study_pack.json'), S, None)
    G = rd(os.path.join(D, 'games_pack.json')); G.update(rd(os.path.join(OUT, 'games_pack.json')))
    wr(os.path.join(D, 'games_pack.json'), G)
    F = rd(os.path.join(D, 'finals.json')); fin = rd(os.path.join(OUT, 'finals.json'))
    cur = F.setdefault(KEY, {'subject': 'الكيمياء', 'grade': 'العاشر', 'units': {}, 'papers': {}, 'q': []})
    cur['units'].update(fin['units']); cur['papers'].update(fin['papers'])
    ids = {q['id'] for q in cur['q']}; cur['q'] += [q for q in fin['q'] if q['id'] not in ids]
    wr(os.path.join(D, 'finals.json'), F, None)
    img = os.path.join(SITE, 'finals', 'img', 'chem10'); os.makedirs(img, exist_ok=True)
    for n in os.listdir(os.path.join(OUT, 'finals_img')):
        shutil.copy(os.path.join(OUT, 'finals_img', n), os.path.join(img, n))
    print('restored; remember: the UI must then distinguish term 1/2 for الكيمياء|العاشر')


restore() if RESTORE else stash()
