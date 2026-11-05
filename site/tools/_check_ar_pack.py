# -*- coding: utf-8 -*-
# فحص الحزم المنشورة: هل أسئلة العربية وملخصاتها وصلت فعلاً لأكواد ومعرض الصفحات؟
import re, json, glob, os, io, sys
sys.stdout.reconfigure(encoding='utf-8')

s = open('site/dist/worker.js', encoding='utf-8', errors='replace').read()
miss = [860, 861, 950, 1000, 1100, 1141]
counts = {m: s.count('"lesson_id":%d,' % m) for m in miss}
print('occurrences of lesson_id=n in worker.js:', counts)
arm = re.findall(r'"qid":"ar(\d+)_(\d+)"', s)
print('arabic question qids in dist:', len(arm), ' distinct lessons:', len(set(a for a, _ in arm)))

p = glob.glob('site/dist/assets/d/*/study.json')[0]
st = json.load(open(p, encoding='utf-8'))
ks = [k for k in st['lessons'].keys() if k.isdigit() and 860 <= int(k) <= 1141]
v = st['lessons'].get('860', {})
print('study arabic covered:', len(ks))
print('860 keys:', list(v.keys()))
print('860 summary intro:', str(v.get('summary', {}).get('intro'))[:80])
print('860 remedial activities:', len(v.get('remedial', {}).get('activities', [])))
