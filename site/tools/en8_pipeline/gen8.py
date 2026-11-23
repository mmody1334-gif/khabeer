# يكتب دروس الإنجليزية 8 (الفصل الأول) وبنكها وملخصاتها وألعابها و«أستطيع أن» في مستودع (أو أكثر)
import json, sys, re
sys.path.insert(0, '/home/claude/en8'); sys.path.insert(0, '/home/claude/enwork')
import en8_src as m
from gen import study, games, STRAT

KIND_STRAT = {'Vocabulary': [0, 2, 4, 11], 'Dialogue': [0, 4, 11, 12], 'Grammar': [0, 6, 10, 12], 'Reading': [0, 3, 4, 7],
              'Vocabulary and Grammar': [2, 4, 10, 12], 'Culture': [0, 4, 10, 13], 'Everyday English': [0, 11, 12, 10], 'Writing': [2, 4, 10, 12], 'Review': [0, 4, 8, 12]}
FORMATIVE = ('Setting aims and criteria: lesson objectives presentation.\nMonitoring students\' learning: Lollipop stick technique.\n'
             'Peer learning: pair work; group work; Think-pair-share technique.\nIndependent learning: Summative and thought-provoking questions technique.')

def strategies(kind):
    on = KIND_STRAT[kind]
    return '\n'.join('( %s ) %s' % ('√' if i in on else ' ', s) for i, s in enumerate(STRAT)) + '\nOthers:\n……………………...................................'

def enrich(u):
    w = ', '.join(x for x, _ in u['vocab'][:4])
    if u['kind'] in ('Grammar', 'Vocabulary and Grammar', 'Review') and u.get('grammar'):
        return ('High achievers: write five sentences of their own using %s, then swap and check a partner\'s sentences.\n'
                'Low achievers: complete gapped sentences with the target form, using the grammar table in the Class Book.') % u['grammar'].split(':')[0].split('(')[0].strip().rstrip('.')
    if u['kind'] in ('Writing',):
        return 'High achievers: write a longer text and add one more paragraph.\nLow achievers: use a writing frame with sentence starters and the model text.'
    if u['kind'] in ('Reading', 'Culture'):
        return 'High achievers: write three extra questions about the text and ask a partner.\nLow achievers: match the new words (%s) to their meanings, then answer two simple questions.' % w
    return 'High achievers: write a short dialogue or paragraph using the new language (%s).\nLow achievers: match the new words or expressions to pictures or meanings and say them aloud.' % w

def misconceptions(u):
    g = u.get('grammar') or ''
    out = []
    if 'obligation' in g: out.append('Students add "to" after must / should ("must to close"). Modal + base verb.\nStudents think "needn\'t" means "mustn\'t".')
    if 'Reported' in g: out.append('Students keep question word order in reported questions ("She asked where did I live"). Use statement order.')
    if 'Reflexive' in g: out.append('Students write "hisself" or "theirselves". Correct forms: himself, themselves.')
    if 'Past perfect' in g: out.append('Students use the past perfect for every past action. It is only for the earlier of two past actions.')
    if 'would rather' in g: out.append('Students write "I\'d rather to go". would rather + base verb.')
    if 'Compound' in g: out.append('Students add -s to the number in compound adjectives ("a nine-hours flight").')
    if 'Zero conditional' in g: out.append('Students use "will" in the if-clause ("If it will rain…").')
    if 'Second conditional' in g: out.append('Students use "would" in the if-clause ("If I would have…"). Use the past simple: If I had…')
    if 'unless' in g: out.append('Students use a negative verb after unless ("Unless you don\'t hurry").')
    if 'while and however' in g: out.append('Students use "however" in the middle of a sentence without punctuation, or "while" to start a new sentence.')
    if 'Strong adjectives' in g: out.append('Students say "very terrific" / "very enormous". Strong adjectives don\'t take "very".')
    if 'advice' in g: out.append('Students say "If I was you" or "ought go". Use If I were you / ought to.')
    if 'phrasal' in g.lower() or 'Phrasal' in g: out.append('Students translate phrasal verbs word for word (get up ≠ "get" + "up" literally).')
    if not out: out.append('Students confuse new words with similar ones; check meaning with pictures and example sentences.\nStudents translate expressions word for word instead of learning them as fixed phrases.')
    return '\n'.join(out)

def lesson(u):
    concepts = []
    if u.get('grammar'): concepts.append('• Grammar Focus: ' + u['grammar'])
    concepts.append('• Target Language: ' + u['target'] + '.')
    concepts.append('• Key Vocabulary: ' + ', '.join(w for w, _ in u['vocab']) + '.')
    acts = ['Materials: Class Book pp. %s; Activity Book pp. %s; flashcards / poster; audio' % (u['cb'], u['ab']), 'Period 1 (Class Book):']
    acts += ['   - ' + t for t in u['tasks1']]
    acts.append('Period 2 (Activity Book):')
    acts += ['   - ' + t for t in u['tasks2']]
    r = {'id': u['id'], 'subject': m.SUBJECT, 'grade': m.GRADE, 'term': 1, 'unit': u['u'], 'unit_name': 'Unit %s: %s' % (u['u'], m.UNITS[u['u']]),
         'lesson_no': u['no'], 'nour_tree': 'Unit %s' % u['u'], 'title': 'Lesson %d: %s – %s' % (u['no'], u['kind'], u['title']),
         'concepts': '\n'.join(concepts),
         'pre_learning': '• Starting the lesson: ' + u['start'],
         'outcomes': '\n'.join('• ' + a for a in u['aims']),
         'strategies': strategies(u['kind']),
         'activities_teach': '\n'.join(acts),
         'resources': 'Class Book (8A) pp. %s\nActivity Book (8A) pp. %s\nFlashcards / poster\nTeacher\'s Guide\nAudio / video' % (u['cb'], u['ab']),
         'formative': FORMATIVE, 'enrich': enrich(u), 'closing': u['finish'], 'homework': u['hwk'], 'misconceptions': misconceptions(u),
         'hw_q1': u['hw'][0], 'hw_a1': u['hw'][1], 'hw_q2': u['hw'][2], 'hw_a2': u['hw'][3], 'hw_type': 'essay', 'src': m.SLUG, 'review': False,
         'ai_filled': ['enrich', 'misconceptions', 'hw_q1', 'hw_a1', 'hw_q2', 'hw_a2']}
    return r

def adapt(u):
    # الحقول التي تحتاجها دوال gen.study/games (المصممة للصف 11–12)
    s = u['study']
    u2 = dict(u); u2['study'] = dict(s, focus=s.get('focus') or ('%s: %s' % (u['kind'], u['title'])), weak=s.get('weak') or [{'Vocabulary': 'Vocabulary', 'Dialogue': 'Speaking', 'Grammar': 'Grammar', 'Reading': 'Reading comprehension', 'Vocabulary and Grammar': 'Grammar', 'Culture': 'Reading comprehension', 'Everyday English': 'Speaking', 'Writing': 'Writing', 'Review': 'Grammar'}[u['kind']]])
    return u2

def unit_summary(th):
    us = [u for u in m.U if u['u'] == th]
    return {'title': 'Unit %s: %s' % (th, m.UNITS[th]),
            'big_ideas': ['Lesson %d – %s: %s' % (u['no'], u['kind'], u['title']) for u in us],
            'connections': 'Unit %s (%s) follows the same path in every unit: new vocabulary, a dialogue, grammar with listening, a Book Club text, more vocabulary and grammar, a culture project, everyday English, a reading text, writing and a review. ' % (th, m.UNITS[th]) +
                           'The words and grammar you meet early in the unit are used again in the reading, speaking and writing lessons.',
            'check': [u['hw'][0] for u in us][:6]}

def bank_txt(finals):
    out = ['// بنك أسئلة اللغة الإنجليزية — الصف الثامن (الفصل الأول) — Class Book / Activity Book 8A (WOW! Magazine)',
           '// عناصر اللغة حسب Student Assessment Handbook – English Grades 5-10 (Sept. 2026):',
           '//   G = GRM (القواعد) · V = VCB (المفردات) · R = RDG (القراءة) · W = WRT (الكتابة) — والحرف التالي مستوى الصعوبة: ن منخفضة، م متوسطة، ر مرتفعة.',
           '// المصادر: خطط الدروس ونصوص الكتاب وأنشطته، ومفردات القواعد/المفردات من اختبارات الوزارة للصف الثامن (2024/2025 و2025/2026) منسوبة إلى أقرب درس.', '']
    for u in m.U:
        out.append('#%d' % u['id'])
        out.append('s: Class Book pp. %s — Unit %s Lesson %d: %s' % (u['cb'], u['u'], u['no'], u['title']))
        out += u['bank']
        for f in finals.get(u['id'], []):
            out.append('s: ' + f['src'])
            out.append('m: %sم|%s|%s' % (f['k'], f['q'].replace('|', '/'), '|'.join(c.replace('|', '/') for c in f['ch'])))
        out.append('')
    return '\n'.join(out)

def assign_finals(items):
    keys = {}
    for u in m.U:
        txt = ' '.join([u['title'], u['target'], u.get('grammar') or ''] + [w + ' ' + d for w, d in u['vocab']] + u['bank']).lower()
        keys[u['id']] = set(re.findall(r"[a-z']{3,}", txt))
    STOP = set("the and that this with from have they their there which what when where your about would could should will were been into than then them also some more most very just only many much other such these those after before because while was are for you can not but our his her its".split())
    res = {u['id']: [] for u in m.U}; ids = [u['id'] for u in m.U]
    for it in items:
        ws = set(re.findall(r"[a-z']{3,}", (it['q'] + ' ' + ' '.join(it['ch'])).lower())) - STOP
        best = max(ids, key=lambda i: (len(ws & keys[i]), -len(res[i])))
        if not ws & keys[best]: best = min(ids, key=lambda i: len(res[i]))
        res[best].append(it)
    return res

def cando_txt():
    out = ['@ %s|%s' % (m.SUBJECT, m.GRADE)]
    for th in m.UNITS:
        out.append('# %s Unit %s: %s' % (th, th, m.UNITS[th]))
        for u in m.U:
            if u['u'] == th:
                for c in u['cando']: out.append('%s-%d | %s' % (th, u['no'], c))
    return '\n'.join(out) + '\n'

if __name__ == '__main__':
    FB = json.load(open('/home/claude/fin8/out/bank8.json'))
    for site in sys.argv[1:]:
        L = json.load(open(site + '/data/lessons.json'))
        ids = {u['id'] for u in m.U}
        assert not any(x['id'] in ids and x.get('src') != m.SLUG for x in L), 'تعارض معرفات'
        L = [x for x in L if x['id'] not in ids] + [lesson(u) for u in m.U]
        json.dump(L, open(site + '/data/lessons.json', 'w'), ensure_ascii=False, indent=1)
        sp = site + '/data/study_pack.json'; S = json.load(open(sp)); gp = site + '/data/games_pack.json'; G = json.load(open(gp))
        for u in m.U:
            S['lessons'][str(u['id'])] = study(adapt(u)); G[str(u['id'])] = games(u)
        for th in m.UNITS: S['units']['%s|%s|%s' % (m.SUBJECT, m.GRADE, th)] = unit_summary(th)
        open(site + '/data/bio_bank/en8.txt', 'w').write(bank_txt(assign_finals(FB)))
        open(site + '/data/cando_src/en8.txt', 'w').write(cando_txt())
        for path, obj in ((sp, S), (gp, G)):
            raw = open(path).read(); ind = 1 if raw.startswith('{\n ') else None
            json.dump(obj, open(path, 'w'), ensure_ascii=False, indent=ind, separators=None if ind else (',', ':'))
        print(site, len(L), 'lessons')
