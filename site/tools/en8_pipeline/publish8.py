import json, sys, shutil, os
d = json.load(open('/home/claude/fin8/out/finals_en8.json'))
for site in sys.argv[1:]:
    p = site + '/data/finals.json'; F = json.load(open(p))
    F['اللغة الإنجليزية|الثامن'] = {'subject': 'اللغة الإنجليزية', 'grade': 'الثامن', 'papers': d['papers'], 'units': d['units'], 'q': d['q']}
    dst = site + '/finals/img/en8'
    if os.path.isdir(dst): shutil.rmtree(dst)
    shutil.copytree('/home/claude/fin8/out/en8', dst)
    raw = open(p).read(); ind = 1 if raw.startswith('{\n ') else None
    json.dump(F, open(p, 'w'), ensure_ascii=False, indent=ind, separators=None if ind else (',', ':'))
    print(site, len(F))
