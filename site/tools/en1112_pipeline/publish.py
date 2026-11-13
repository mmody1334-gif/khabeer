import json, sys, shutil, os
R = json.load(open('/home/claude/enfin/out/finals_en.json'))
GR = {'11': 'الحادي عشر', '12': 'الثاني عشر'}
for site in sys.argv[1:]:
    p = site + '/data/finals.json'; F = json.load(open(p))
    for g, d in R.items():
        for q in d['q']:
            q['m'] = int(q['m']) if float(q['m']).is_integer() else q['m']
        for k in d['papers'].values(): k['total'] = int(k['total'])
        F['اللغة الإنجليزية|' + GR[g]] = {'subject': 'اللغة الإنجليزية', 'grade': GR[g], 'papers': d['papers'], 'units': d['units'], 'q': d['q']}
        dst = site + '/finals/img/en' + g
        if os.path.isdir(dst): shutil.rmtree(dst)
        shutil.copytree('/home/claude/enfin/out/en' + g, dst)
    raw = open(p).read(); ind = 1 if raw.startswith('{\n ') else None
    json.dump(F, open(p, 'w'), ensure_ascii=False, indent=ind, separators=None if ind else (',', ':'))
    print(site, len(F))
