# ينشر أسئلة الاختبارات النهائية السابقة: صور مقصوصة (finals/img) + بيانات (data/finals.json)
# الاستخدام: python3 tools/fin_publish.py <مجلد العمل fin>
import json, os, sys, glob, hashlib
from PIL import Image
FIN = sys.argv[1]
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = SITE + '/finals/img'
jobs = {j['id']: j for j in json.load(open(FIN + '/jobs.json'))}
L = json.load(open(SITE + '/data/lessons.json'))
subj = lambda l: l.get('subject') or ('العلوم' if l['grade'] == 'الخامس' else 'الأحياء')
lesson = {l['id']: l for l in L}
SLUG = {'العلوم': 'sci', 'الأحياء': 'bio', 'الكيمياء': 'chem', 'العلوم البيئية': 'env', 'تقنية المعلومات': 'it', 'الفيزياء': 'phy'}
GN = {'الخامس': 5, 'السادس': 6, 'السابع': 7, 'الثامن': 8, 'التاسع': 9, 'العاشر': 10, 'الحادي عشر': 11, 'الثاني عشر': 12}

def crop(fid, parts, out):
    ims = []
    for pg, y0, y1 in parts:
        im = Image.open(f'{FIN}/pages/{fid}/c{int(pg):03d}.png').convert('L'); W, H = im.size
        ims.append(im.crop((int(W * 0.03), int(H * float(y0) / 100), int(W * 0.97), int(H * float(y1) / 100))))
    w = max(i.width for i in ims); h = sum(i.height for i in ims)
    can = Image.new('L', (w, h), 255); y = 0
    for i in ims: can.paste(i, (0, y)); y += i.height
    if can.width > 1000: can = can.resize((1000, int(can.height * 1000 / can.width)), Image.LANCZOS)
    can.save(out, 'WEBP', quality=50, method=6)
    return can.size

out = {}
skip_years = {'2021-2022'}
for f in sorted(glob.glob(FIN + '/out/j*.json')):
    d = json.load(open(f)); job = jobs[d['job']]
    s, g, term = job['group'].split('|')
    key = s + '|' + g; slug = f"{SLUG[s]}{GN[g]}"
    G = out.setdefault(key, {'subject': s, 'grade': g, 'units': {}, 'papers': {}, 'q': []})
    for l in L:
        if subj(l) == s and l['grade'] == g: G['units'].setdefault(str(l['unit']), l['unit_name'])
    os.makedirs(f'{IMG}/{slug}', exist_ok=True)
    for pi, pa in enumerate(d['papers']):
        year = str(pa.get('year') or '')
        if year in skip_years: continue
        pid = f"{d['job']}-{pi}"
        G['papers'][pid] = {'year': year, 'term': int(term), 'session': pa.get('session') or '', 'region': pa.get('region') or '', 'total': pa.get('total_marks')}
        for q in pa['questions']:
            u = str(q.get('unit') or '')
            lid = q.get('lesson_id')
            if lid in lesson: u = str(lesson[lid]['unit'])
            if not u: continue
            if u not in G['units'] and q.get('unit_name'): G['units'][u] = q['unit_name']
            qid = hashlib.md5(f"{pid}-{q['n']}".encode()).hexdigest()[:10]
            fn = f'{IMG}/{slug}/{qid}.webp'
            if not os.path.exists(fn) or os.path.getmtime(fn) < os.path.getmtime(f):
                w, h = crop(pa['fid'], q['parts'], fn)
            else:
                w, h = Image.open(fn).size
            G['q'].append({'id': qid, 'p': pid, 'n': str(q['n']), 'm': q.get('marks'), 't': q.get('type') or '', 'x': q.get('text') or '',
                           'a': q.get('answer') or '', 'as': q.get('answer_src') or 'ms', 'c': q.get('code') or '', 'ao': q.get('ao') or '',
                           'u': u, 'l': lid if lid in lesson else None, 'l2': q.get('lesson_id2') if q.get('lesson_id2') in lesson else None,
                           'im': f'{slug}/{qid}.webp', 'w': w, 'h': h})
json.dump(out, open(SITE + '/data/finals.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for k, G in out.items(): print(k, len(G['papers']), 'papers', len(G['q']), 'q', sorted(G['units']))
tot = sum(os.path.getsize(x) for x in glob.glob(IMG + '/*/*.webp'))
print('images', len(glob.glob(IMG + '/*/*.webp')), round(tot / 1048576, 1), 'MB; data', round(os.path.getsize(SITE + '/data/finals.json') / 1048576, 2), 'MB')
