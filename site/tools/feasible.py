# هل يوجد اختبار مطابق للمواصفات من بنك الأسئلة لكل مجموعة دروس متتالية؟ (بحث شامل)
import json, itertools, collections, sys
L = json.load(open('data/lessons.json')); Q = json.load(open('data/quiz_bank.json'))
NUM = {'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12}
def spec(g):
    if g >= 11: return dict(total=10, t={'AO1':3,'AO2':7}, mcq=2, long=(4,5), smax=3, items=(5,99))
    if g == 10: return dict(total=10, t={'معرفة':4,'تطبيق':4,'استدلال':2}, mcq=2, long=(3,4), smax=2, items=(5,7))
    if g == 9: return dict(total=15, t={'معرفة':6,'تطبيق':6,'استدلال':3}, mcq=3, long=(3,4), smax=2, items=(9,12))
    return dict(total=15, t={'معرفة':6,'تطبيق':6,'استدلال':3}, mcq=3, long=None, smax=2, items=(9,12))
def feasible(items, sp, hi):
    # mcq: choose count; long: one; short: knapsack per ao
    mc = collections.Counter(x['ao'] for x in items if x['type']=='mcq')
    longs = [x for x in items if x['type']=='long' and sp['long'] and x['marks'] in sp['long'] and x['ao']!='معرفة']
    shorts = [x for x in items if (x['type']=='short' and x['marks']<=sp['smax']) or (not sp['long'] and x['type']=='long' and x['marks']<=sp['smax'])]
    aos = list(sp['t'])
    mcq_opts = []
    if hi:
        if mc['AO1'] and mc['AO2']: mcq_opts = [{'AO1':1,'AO2':1}]
    else:
        for combo in itertools.combinations_with_replacement(aos, sp['mcq']):
            c = collections.Counter(combo)
            if len(c) >= 2 and all(mc[a] >= n for a, n in c.items()): mcq_opts.append(dict(c))
    long_opts = [{x['ao']: x['marks']} for x in longs] if sp['long'] else [{}]
    # per-ao subset sums of shorts with item counts
    sums = {}
    for a in aos:
        ms = [x['marks'] for x in shorts if x['ao']==a]
        reach = {(0,0)}
        for m in ms: reach |= {(s+m, n+1) for s, n in reach}
        sums[a] = reach
    for mo in mcq_opts:
        for lo in long_opts:
            need = {a: sp['t'][a] - mo.get(a,0) - lo.get(a,0) for a in aos}
            if any(v < 0 for v in need.values()): continue
            counts = [sorted(n for s, n in sums[a] if s == need[a]) for a in aos]
            if any(not c for c in counts): continue
            base = sum(mo.values()) + (1 if lo else 0)
            lo_n = base + sum(c[0] for c in counts); hi_n = base + sum(c[-1] for c in counts)
            if hi_n >= sp['items'][0] and lo_n <= sp['items'][1]: return True, ''
    return False, f"mcq={dict(mc)} longs={[(x['ao'],x['marks']) for x in longs]} shorts={collections.Counter((x['ao'],x['marks']) for x in shorts)}"
by = collections.defaultdict(list)
for q in Q: by[q['lesson_id']].append(q)
subj = lambda l: l.get('subject') or ('العلوم' if l['grade'] == 'الخامس' else 'الأحياء')
for sname, gname in sorted({(subj(l), l['grade']) for l in L if subj(l) != 'اللغة الإنجليزية'}):
    g = NUM[gname]
    ls = [l for l in L if l['grade']==gname and subj(l) == sname]
    bad = []; tot = 0
    for k in range(2, 6):
        for i in range(len(ls) - k + 1):
            ids = [l['id'] for l in ls[i:i+k]]; items = [q for x in ids for q in by[x]]
            tot += 1; ok, why = feasible(items, spec(g), g >= 11)
            if not ok: bad.append((k, [l['title'][:25] for l in ls[i:i+k]], why))
    print(sname, gname, 'infeasible', len(bad), 'of', tot)
    for b in bad[:4]: print('   ', b)
