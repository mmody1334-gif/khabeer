# -*- coding: utf-8 -*-
"""يولّد مقرر الكيمياء — الصف العاشر — الفصل الدراسي الأول (المعرّفات 2600–2619) في منصة واحدة.
الاستخدام: python3 gen.py <SITE> [parsed.json]   (آمن عند التكرار)
parsed.json من parse.py على ملف التحضير (أ/ رمضان عبدالحليم، مدرسة وادي السيل، 2025/2026)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import C, UNITS, PAGES, TITLE_FIX, UNIT_SUM

SITE = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'parsed.json'), encoding='utf-8'))
D = os.path.join(SITE, 'data')
BASE = 2600
IDS = set(range(BASE, BASE + len(P)))
assert len(P) == 20

lessons = []
no_in_unit = {}
for i, p in enumerate(P):
    c = C[i]
    no_in_unit[p['unit']] = no_in_unit.get(p['unit'], 0) + 1
    ai = ['concepts', 'hw_q1', 'hw_a1', 'hw_q2', 'hw_a2']
    mis = p['misconceptions']
    if not mis:
        mis = c['misconceptions']; ai.append('misconceptions')
    l = {'grade': 'العاشر', 'unit': str(p['unit']), 'unit_name': UNITS[p['unit']], 'title': TITLE_FIX.get(i, p['title']),
         'concepts': c['concepts'], 'pre_learning': p['pre_learning'], 'outcomes': p['outcomes'], 'strategies': p['strategies'],
         'activities_teach': p['activities_teach'], 'resources': p['resources'], 'formative': p['formative'], 'enrich': p['enrich'],
         'closing': p['closing'], 'homework': p['homework'], 'id': BASE + i, 'misconceptions': mis,
         'hw_q1': c['hw'][0], 'hw_a1': c['hw'][1], 'hw_q2': c['hw'][2], 'hw_a2': c['hw'][3], 'ai_filled': ai,
         'subject': 'الكيمياء', 'term': 1, 'lesson_no': no_in_unit[p['unit']],
         'src': 'تحضير أ. رمضان عبدالحليم (2025/2026) + كتاب الطالب ص %d–%d' % PAGES[i], 'review': False}
    lessons.append(l)

lp = os.path.join(D, 'lessons.json')
L = [x for x in json.load(open(lp, encoding='utf-8')) if x['id'] not in IDS]
# يُدرج المقرر قبل الكيمياء للحادي عشر (362) ليبقى الترتيب حسب الصف
at = next((k for k, x in enumerate(L) if x['id'] == 362), len(L))
L[at:at] = lessons
json.dump(L, open(lp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

sp = os.path.join(D, 'study_pack.json')
S = json.load(open(sp, encoding='utf-8'))
for i, p in enumerate(P):
    c = C[i]
    S['lessons'][str(BASE + i)] = {
        'summary': {'intro': c['intro'], 'outcomes': c['outcomes'], 'terms': [{'t': t, 'd': d} for t, d in c['terms']], 'remember': c['remember']},
        'remedial': {'focus': c['focus'], 'weak_areas': c['weak'], 'simple': c['simple'], 'activities': c['acts']}}
for u, s in UNIT_SUM.items():
    S['units']['الكيمياء|العاشر|%d' % u] = {'title': UNITS[u], 'big_ideas': s['big'], 'connections': s['conn'], 'check': s['check']}
json.dump(S, open(sp, 'w', encoding='utf-8'), ensure_ascii=False)

gp = os.path.join(D, 'games_pack.json')
G = json.load(open(gp, encoding='utf-8'))
for i in range(len(P)):
    c = C[i]
    G[str(BASE + i)] = {'claims': [{'text': t, 'true': v, 'why': w} for t, v, w in c['claims']],
                        'links': [{'a': a, 'b': b, 'answer': x} for a, b, x in c['links']]}
json.dump(G, open(gp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', len(lessons), 'lessons →', SITE)
