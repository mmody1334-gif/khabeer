import pymupdf,re,json,sys
from anchors import PAPERS,lines
from fixar import fixtext,norm
TOP_CONT=60; BOT=736
def strip_side(p):
    for l in lines(p):
        t=norm(' '.join(s[2] for s in l['spans']))
        if 'تكتب' in t and 30<l['y0']<70: return 'L' if l['x0']<100 else 'R'
    return 'R'
def xr(side): return (50,582) if side=='L' else (16,550)
def anchors(pid):
    f,a,b=PAPERS[pid]; d=pymupdf.open(f); out=[]; nexp=1
    for pn in range(a,b+1):
        p=d[pn-1]; R=567 if strip_side(p)=='L' else 539
        for l in sorted(lines(p),key=lambda l:l['y0']):
            if l['y0']<30 or l['y0']>BOT: continue
            rs=sorted(l['spans'],key=lambda s:-s[1])
            for s in rs[:3]:
                t=s[2].strip(' )(|\t')
                if re.fullmatch(r'\d{1,2}',t) and s[1]>=525 and int(t)==nexp:
                    out.append(dict(pg=pn,y=l['y0'],k='Q',n=nexp,box=(s[0]-10,l['y0'],max(s[1],l['x1']),l['y1']))); nexp+=1; break
                if (re.match(r'^[بجد]\s*\.',t) or re.fullmatch(r'\.\s*[بجد]',t)) and s[1]>=R-31 and nexp>15:
                    out.append(dict(pg=pn,y=l['y0'],k='P',part=t.strip('. ')[0],box=None)); break
    return d,out
def text_of(d,segs):
    tx=[]
    for pg,y0,y1 in segs:
        p=d[pg-1]; side=strip_side(p); x0,x1=xr(side)
        for l in sorted(lines(p),key=lambda l:(round(l['y0']/3),-l['x1'])):
            if y0-1<=l['y0']<y1-2 and l['x0']>=x0-6 and l['x1']<=x1+6:
                tx.append(' '.join(s[2] for s in sorted(l['spans'],key=lambda s:-s[1])))
    return fixtext('\n'.join(tx))
def find_end(d,a,b,last):
    for pn in range(last,b+1):
        for l in lines(d[pn-1]):
            if 'انتهت' in fixtext(' '.join(s[2] for s in l['spans'])): return (pn,l['y0']-4)
    return (b,BOT)
END={}
def build(pid):
    d,an=anchors(pid); f,a,b=PAPERS[pid]; END[pid]=find_end(d,a,b,an[-1]['pg'])
    items=[]
    for i,x in enumerate(an):
        nx=an[i+1] if i+1<len(an) else None
        segs=[]; pg=x['pg']; y=x['y']-3
        endpg,endy=(nx['pg'],nx['y']-3) if nx else END[pid]
        while True:
            if pg>=endpg: segs.append((pg,y,endy)); break
            segs.append((pg,y,BOT)); pg+=1; y=TOP_CONT
        segs=[s for s in segs if s[2]-s[1]>20]
        cur=dict(segs=segs,box=x['box'],pg=x['pg'])
        if x['k']=='Q':
            n=x['n']; cur.update(n=n,part='أ' if n>=15 else '')
        else:
            cur.update(n=items[-1]['n'],part=x['part'])
        items.append(cur)
    # المثير المشترك لأسئلة الاختيار من متعدد: نص أعلى الصفحة قبل أول مرساة
    first0={id(z):z['segs'][0][1] for z in items}
    for it in items:
        if it['n']>14: continue
        pg=it['pg']; firsty=min(first0[id(z)] for z in items if z['pg']==pg)
        if first0[id(it)]==firsty and firsty>90:
            stim=(pg,TOP_CONT,firsty)
            st=text_of(d,[stim])
            nums=[int(z) for z in re.findall(r'(?<!\d)\d{1,2}(?!\d)',st)]
            if it['n'] not in nums: continue
            targets=[z for z in items if z['n']<=14 and z['n'] in nums and z['n']>=it['n'] and z['pg'] in (pg,pg+1)]
            for z in targets:
                if stim not in z['segs']: z['segs']=[stim]+z['segs']; z['stim']=st
    # مثير مشترك في **منتصف** الصفحة: سطر «... أجب عن المفردتين (6-7)» داخل منطقة سؤال سابق
    for i,it in enumerate(items):
        if it['n']>14 or it.get('stim'): pass
        for si,(pg,y0,y1) in enumerate(list(it['segs'])):
            if it.get('stim') and si==0: continue
            for l in sorted(lines(d[pg-1]),key=lambda l:l['y0']):
                if not (y0+8<l['y0']<y1): continue
                t=fixtext(' '.join(z[2] for z in l['spans']))
                if not re.search(r'فردت|فردات',t): continue
                if it['n']<=14:
                    nums=[int(z) for z in re.findall(r'(?<!\d)\d{1,2}(?!\d)',t)]
                    if not nums or min(nums)<=it['n']: continue
                    tg=[z for z in items if z['n'] in nums and z['n']<=14 and not z.get('stim')]
                else:
                    lets=re.findall(r'[بجد](?=\s*[،,)\(]|\s*$)',re.split(r'فردت|فردات',t)[-1])
                    tg=[z for z in items if z['n']==it['n'] and z['part'] in lets and z is not it and not z.get('stim')]
                if not tg: continue
                cut=l['y0']-3; stim=(pg,cut,y1)
                it['segs'][si]=(pg,y0,cut)
                for z in tg:
                    z['segs']=[stim]+z['segs']; z['stim']=text_of(d,[stim])
                break
    stims=[]
    for z in items:
        for sg in z['segs']:
            if z.get('stim') and sg[1]==TOP_CONT and sg is z['segs'][0]: stims.append(sg)
    for z in items:
        own=[]
        for sg in z['segs']:
            if sg in stims and z.get('stim') and sg==z['segs'][0]: own.append(sg); continue
            pg,y0,y1=sg
            for st in stims:
                if st[0]==pg and y0<st[2] and y1>st[1] and not (z.get('stim') and z['segs'][0]==st):
                    if y0>=st[1]: y0=st[2]
                    else: y1=st[1]
            if y1-y0>20: own.append((pg,y0,y1))
        z['segs']=own
    for it in items: it['text']=text_of(d,[s for s in it['segs']])
    return items
if __name__=='__main__':
    for pid in sys.argv[1:]:
        its=build(pid); json.dump(its,open(f'items_{pid}.json','w'),ensure_ascii=False,indent=0)
        print(pid,len(its),'items', [f"{z['n']}{z['part']}" for z in its])
