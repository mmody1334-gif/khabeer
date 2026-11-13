# يكتب دروس الإنجليزية 11–12 وبنوكها وملخصاتها وألعابها و«أستطيع أن» في مستودع (أو أكثر)
import json, sys, re, importlib
sys.path.insert(0, '/home/claude/enwork')
FIELDS = ['concepts', 'pre_learning', 'outcomes', 'strategies', 'activities_teach', 'resources', 'formative', 'enrich', 'closing', 'homework', 'misconceptions', 'hw_q1', 'hw_a1', 'hw_q2', 'hw_a2']
STRAT = ['Dialogue and discussion.', 'Survey', 'Brainstorming.', 'Predict, interpret, observe, interpret', 'Collaborative learning.', 'Figure (7) the cognitive', 'Measurement.', 'Story', 'Mind maps.', 'Inductive exploration', 'Learning by doing', 'Role play.', 'Peer learning,', 'Problem Solving']
SKILL_STRAT = {'Reading': [0, 2, 4, 12], 'Grammar': [0, 6, 10, 12], 'Vocabulary': [2, 4, 8, 10], 'Listening and Speaking': [0, 4, 11, 12], 'Writing': [2, 4, 10, 12]}

def strategies(skill):
    on = SKILL_STRAT[skill]
    return '\n'.join('( %s ) %s' % ('√' if i in on else ' ', s) for i, s in enumerate(STRAT)) + '\nOthers:\n……………………...................................'

def lesson(m, u):
    vocab = ', '.join(w for w, _ in u['vocab'])
    concepts = []
    if u.get('grammar'): concepts.append('• Grammar Focus: ' + u['grammar'])
    concepts.append('• Topic Vocabulary: ' + vocab + '.')
    concepts.append('• Key Skill (' + u['skill'] + '): ' + u['focus'])
    acts = ['Materials: Coursebook pp. %s; Workbook pp. %s; board' % (u['cb'], u['wb'])]
    for i, (t, mins, bl) in enumerate(u['steps'], 1):
        acts.append('Step %d: %s %d min' % (i, t, mins))
        acts += ['   - ' + b for b in bl]
    res = 'Coursebook (Engage with English %s) pp. %s\nWorkbook pp. %s\nWhiteboard\nScreen / projector%s' % (
        '11A' if m.SLUG == 'en11' else '12A', u['cb'], u['wb'], '\nAudio CD' if u['skill'] in ('Listening and Speaking',) or 'Listen' in ' '.join(b for _, _, bl in u['steps'] for b in bl) else '')
    r = {'id': u['id'], 'subject': m.SUBJECT, 'grade': m.GRADE, 'term': 1, 'unit': u['th'], 'unit_name': 'Theme %s: %s' % (u['th'], m.THEMES[u['th']]),
         'lesson_no': u['no'], 'nour_tree': 'Theme %s' % u['th'], 'title': 'Unit %d: %s' % (u['no'], u['title']),
         'concepts': '\n'.join(concepts),
         'pre_learning': '• Warm-up: ' + u['warm'] + '\n• Assessment: Check students\' prior knowledge through their answers and note the vocabulary they already know.',
         'outcomes': '\n'.join('• ' + o for o in u['outcomes']),
         'strategies': strategies(u['skill']),
         'activities_teach': '\n'.join(acts), 'resources': res,
         'formative': u['formative'], 'enrich': u['enrich'], 'closing': u['closing'], 'homework': u['homework'], 'misconceptions': u['misc'],
         'hw_q1': u['hw'][0], 'hw_a1': u['hw'][1], 'hw_q2': u['hw'][2], 'hw_a2': u['hw'][3], 'hw_type': 'essay',
         'src': m.SLUG, 'review': False}
    nop = getattr(m, 'NOPREP', set())
    r['ai_filled'] = FIELDS[:] if u['id'] in nop else ['concepts', 'pre_learning', 'formative', 'enrich', 'closing', 'misconceptions', 'hw_q1', 'hw_a1', 'hw_q2', 'hw_a2']
    return r

def study(u):
    s = u['study']
    return {'summary': {'intro': s['intro'], 'outcomes': [{'code': '', 'text': t, 'points': p} for t, p in s['O']],
                        'terms': [{'t': a, 'd': b} for a, b in u['vocab']], 'remember': s['R']},
            'remedial': {'focus': s['focus'], 'weak_areas': s['weak'], 'simple': s['simple'], 'activities': [
                {'title': 'Fill in the gaps', 'type': 'fill', 'instructions': 'Complete each sentence with the correct word.', 'items': [{'q': q, 'a': a} for q, a in s['F']]},
                {'title': 'Choose the correct answer', 'type': 'choose', 'instructions': 'Choose the correct answer from the brackets.', 'items': [{'q': q, 'a': a} for q, a in s['C']]},
                {'title': 'Answer briefly', 'type': 'short', 'instructions': 'Answer the questions in a few words.', 'items': [{'q': q, 'a': a} for q, a in s['S']]}]}}

def games(u):
    g = u['games']
    return {'claims': [{'text': t, 'true': v, 'why': w} for t, v, w in g['claims']],
            'links': [{'a': a, 'b': b, 'answer': c} for a, b, c in g['links']],
            'sequence': {'title': g['seq'][0], 'steps': g['seq'][1]}}

def unit_summary(m, th):
    us = [u for u in m.U if u['th'] == th]
    return {'title': 'Theme %s: %s' % (th, m.THEMES[th]),
            'big_ideas': ['Unit %d – %s: %s' % (u['no'], u['title'], u['focus']) for u in us],
            'connections': 'Theme %s (%s) develops all the skills around one topic: Unit 1 focuses on reading, Unit 2 on grammar, Unit 3 on vocabulary, Unit 4 on listening and speaking, and Unit 5 on writing. ' % (th, m.THEMES[th]) +
                           'The vocabulary and ideas you meet in the reading lesson are used again in the grammar, speaking and writing tasks.',
            'check': [u['hw'][0] for u in us] + [u['hw'][2] for u in us][:3]}

# ---------- بنك الأسئلة ----------
def bank_txt(m, finals):
    out = ['// بنك أسئلة اللغة الإنجليزية — %s (الفصل الدراسي الأول) — Engage with English %s' % (m.GRADE, '11A' if m.SLUG == 'en11' else '12A'),
           '// (الملف في مجلد bio_bank لأن صيغته ومحلّله واحد.)',
           '// عناصر اللغة حسب Student Assessment Handbook – English Grades 11-12 (Sept. 2026), ص 9:',
           '//   G = GRM (القواعد) · V = VCB (المفردات) · R = RDG (القراءة) · W = WRT (الكتابة) — والحرف التالي مستوى الصعوبة: ن منخفضة، م متوسطة، ر مرتفعة.',
           '// المصادر: نصوص الكتاب وأنشطته، ومفردات امتحانات الوزارة للفصل الأول (قراءة 1، مفردات، قواعد) منسوبة إلى أقرب درس.', '']
    for u in m.U:
        out.append('#%d' % u['id'])
        out.append('s: Coursebook pp. %s — Unit %d: %s' % (u['cb'], u['no'], u['title']))
        for ln in u['bank']:
            m = re.match(r"(w: R[^|]*\|)([^/]+?) // True or False\? => (.+)$", ln)
            if m:  # عبارة من نص الكتاب بلا فقرة: نحيل إلى نص الوحدة صراحة
                ln = '%sAccording to the coursebook text (Unit %d: %s), is this statement True or False? // %s => %s' % (m.group(1), u['no'], u['title'], m.group(2).strip(), m.group(3))
            out.append(ln)
        for f in finals.get(u['id'], []):
            out.append('s: ' + f['src'])
            code = {'RDG': 'R', 'VCB': 'V', 'GRM': 'G'}[f['k']]
            q = f['q'].replace('|', '/').replace('=>', '→')
            if f['t'] == 'm':
                out.append('m: %sم|%s|%s' % (code, q, '|'.join(c.replace('|', '/') for c in f['ch'])))
            else:
                out.append('w: %sم1|%s => %s' % (code, q, f['a']))
        out.append('')
    return '\n'.join(out)

def assign_finals(m, items):
    # نسب كل مفردة وزارية إلى أقرب درس بالكلمات المشتركة (المفردات + العنوان + نصوص البنك)
    keys = {}
    for u in m.U:
        txt = ' '.join([u['title'], u['focus']] + [w + ' ' + d for w, d in u['vocab']] + u['bank']).lower()
        keys[u['id']] = set(re.findall(r'[a-z]{4,}', txt))
    STOP = set('that this with from have they their there which what when where your about would could should will were been into than then them also some more most very just only many much other such these those after before because while'.split())
    res = {u['id']: [] for u in m.U}; rr = 0; ids = [u['id'] for u in m.U]
    for it in items:
        ws = set(re.findall(r'[a-z]{4,}', (it['q'] + ' ' + it['a']).lower())) - STOP
        best = max(ids, key=lambda i: (len(ws & keys[i]), -len(res[i])))
        if not ws & keys[best]: best = min(ids, key=lambda i: len(res[i]))
        res[best].append(it)
    return res

def cando_txt(m):
    out = ['@ %s|%s' % (m.SUBJECT, m.GRADE)]
    for th in m.THEMES:
        out.append('# %s Theme %s: %s' % (th, th, m.THEMES[th]))
        for u in m.U:
            if u['th'] != th: continue
            for c in u['cando']: out.append('%s-%d | %s' % (th, u['no'], c))
    return '\n'.join(out) + '\n'

if __name__ == '__main__':
    FB = json.load(open('/home/claude/enfin/out/bank_fin.json'))
    mods = [importlib.import_module('en11_src'), importlib.import_module('en12_src')]
    for site in sys.argv[1:]:
        L = json.load(open(site + '/data/lessons.json'))
        ids = {u['id'] for m in mods for u in m.U}
        L = [x for x in L if x['id'] not in ids] + [lesson(m, u) for m in mods for u in m.U]
        json.dump(L, open(site + '/data/lessons.json', 'w'), ensure_ascii=False, indent=1)
        sp = site + '/data/study_pack.json'; S = json.load(open(sp)); gp = site + '/data/games_pack.json'; G = json.load(open(gp))
        for m in mods:
            for u in m.U:
                S['lessons'][str(u['id'])] = study(u); G[str(u['id'])] = games(u)
            for th in m.THEMES:
                S['units']['%s|%s|%s' % (m.SUBJECT, m.GRADE, th)] = unit_summary(m, th)
            fin = assign_finals(m, FB['11' if m.SLUG == 'en11' else '12'])
            open(site + '/data/bio_bank/%s.txt' % m.SLUG, 'w').write(bank_txt(m, fin))
            open(site + '/data/cando_src/%s.txt' % m.SLUG, 'w').write(cando_txt(m))
        for path, obj in ((sp, S), (gp, G)):
            raw = open(path).read(); ind = 1 if raw.startswith('{\n ') else None
            json.dump(obj, open(path, 'w'), ensure_ascii=False, indent=ind, separators=None if ind else (',', ':'))
        print(site, len(L), 'lessons')
