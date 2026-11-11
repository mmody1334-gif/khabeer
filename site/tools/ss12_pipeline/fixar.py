import re,unicodedata,glob,json,collections,itertools
AR=re.compile(r'[\u0621-\u0652\u0671]+')
def norm(s):
    s=unicodedata.normalize('NFKC',s)
    s=re.sub(r'[ـ‌-‏‪-‮﻿]','',s)
    s=s.replace('\t',' ').replace(' ',' ')
    return s
def strip_h(w): return re.sub(r'[ً-ْ]','',w)
# vocabulary from book OCR + prep + lessons
V=collections.Counter()
srcs=glob.glob('/home/claude/work/book/p-*.txt')+['/home/claude/work/src/prep.txt','/home/claude/work/ss12/lessons_src.py']
for f in srcs:
    for w in AR.findall(strip_h(norm(open(f).read()))): V[w]+=1
FIX={'يف':'في','إىل':'إلى','عىل':'على','اىل':'الى','عام':None}
PRE=['','و','ف','ب','ك','ل','وال','بال','فال','كال','لل','ال','وب','ول','وس']
def known(w):
    if V[w]>=2: return True
    for p in PRE:
        if p and w.startswith(p) and V[w[len(p):]]>=2 and len(w)-len(p)>=3: return True
    return False
def fixword(w):
    b=strip_h(w)
    if b in FIX and FIX[b]: return FIX[b]
    if known(b) or len(b)<3: return w
    # بداية «اال/األ/اإل/امل» = «ال» + حرف (ترتيب معكوس لربط لام الألف)
    cands=[]
    n=len(b)
    pairs=list(range(n-1))
    for k in (1,2,3):
        for combo in itertools.combinations(pairs,k):
            if any(combo[i+1]-combo[i]<2 for i in range(len(combo)-1)): continue
            c=list(b)
            for i in combo: c[i],c[i+1]=c[i+1],c[i]
            c=''.join(c)
            if known(c): cands.append((k,-V[c],c))
        if cands: break
    if cands: return sorted(cands)[0][2]
    return w
def fixtext(s):
    s=norm(s)
    s=re.sub(r'(^|[^ء-ي])يف(?=[^ء-ي]|$)',r'\1في',s)
    s=re.sub(r'(^|[^ء-ي])إىل(?=[^ء-ي]|$)',r'\1إلى',s)
    s=re.sub(r'(^|[^ء-ي])عىل(?=[^ء-ي]|$)',r'\1على',s)
    return AR.sub(lambda m:fixword(m.group(0)),s)
if __name__=='__main__':
    import sys
    print(len(V))
    for t in ['ادرس الخريطة املقابلة التي توضح خط سري الحملة العسكرية من إحدى الدول األوروبية إىل املرشق، ثم أجب عام يأيت','املادة: الدراسات االجتامعية (هذا وطني يف العراقة واملجد)','بناء حصن األسود','معركة بني النباهنة واإلمام أيب الحسن الخرويص','املحافظة الشاملية التي تبدأ منها حدود املنطقة البحرية']:
        print(fixtext(t))
