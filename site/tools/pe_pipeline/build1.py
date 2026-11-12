import json,re
R=json.load(open('raw.json'))
HAR=re.compile(r'[ً-ْٰـ]')
def clean(t):
    t=t.replace('‏','').replace('‎','').replace('\xa0',' ')
    t=re.sub(r'(?m)^\s*[ـ_]{2,}\s*','',t)
    t=re.sub(r'\s*ـ{2,}\s*','، ',t)
    t=HAR.sub('',t)
    t=re.sub(r'_{3,}|\.{6,}','',t)
    t=re.sub(r'[♦●•▪]\s*','',t)
    lines=[re.sub(r'[ \t]+',' ',x).strip(' -–:') for x in t.split('\n')]
    lines=[x for x in lines if x and x not in ('.','،')]
    return '\n'.join(lines)
STRAT=['الحوار والمناقشة','الاستقصاء','العصف الذهني','تنبأ، فسر، لاحظ، فسر','التعلم التعاوني','شكل (7) المعرفي','القياس','القصة','الخرائط الذهنية','الاستكشاف الاستقرائي','التعلم باللعب','تمثيل الأدوار','التعلم بالأقران','حل المشكلات']
def strategies(t):
    sel=[]
    for line in t.split('\n'):
        m=re.match(r'\s*\(([^)]*)\)\s*(.+)',line)
        if m and m.group(1).strip():
            name=m.group(2).strip(' .,')
            for s in STRAT:
                if s.split('،')[0] in name: sel.append(s)
        m2=re.match(r'\s*(.+?)\s*\(\s*√\s*\)',line)
        if m2:
            for s in STRAT:
                if s in m2.group(1): sel.append(s)
    for s in re.findall(r'([^()\n√]+?)\s*\(\s*√\s*\)',t):
        for x in STRAT:
            if x in s and x not in sel: sel.append(x)
    return sel
SKIP={11,26,68,69,70,71,72}
out=[]
for k,x in enumerate(R):
    if k in SKIP: continue
    raw=x['raw']; pre='\n'.join(raw.get('pre',[]))
    A=raw.get('A',['']*4)+['']*4; B=raw.get('B',['']*4)+['']*4
    out.append(dict(k=k,grade=x['grade'],hdr=clean(' | '.join(x['hdr'][1:])),pre=clean(pre),outcomes=clean(A[0]),strat=strategies(A[1]),stratraw=A[1][:0],acts=clean(A[2]),res=clean(A[3]),formative=clean(B[0]),enrich=clean(B[1]),closing=clean(B[2]),homework=clean(B[3])))
json.dump(out,open('clean.json','w'),ensure_ascii=False,indent=1)
with open('review.txt','w') as f:
    for o in out:
        f.write('\n######## %d %s | %s\n'%(o['k'],o['grade'],o['hdr']))
        for key in ['pre','outcomes','strat','acts','res','formative','enrich','closing','homework']:
            f.write('--[%s] %s\n'%(key,o[key] if isinstance(o[key],str) else '، '.join(o[key])))
print(len(out))
