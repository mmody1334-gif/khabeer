import pymupdf,re,sys,json
PAPERS={'2324-0':('q2324.pdf',5,17),'2324-1':('q2324.pdf',21,32),'2425-0':('x2425.pdf',3,20),'2425-1':('x2425.pdf',32,47),'2526-0':('x2526.pdf',3,18),'2526-1':('x2526.pdf',30,45)}
def lines(page):
    out=[]
    for b in page.get_text('dict')['blocks']:
        if b.get('type')!=0: continue
        for l in b['lines']:
            sp=[s for s in l['spans'] if s['text'].strip()]
            if not sp: continue
            out.append({'x0':l['bbox'][0],'x1':l['bbox'][2],'y0':l['bbox'][1],'y1':l['bbox'][3],'spans':[(s['bbox'][0],s['bbox'][2],s['text'].strip()) for s in sp]})
    return out
def anchors(pid):
    f,a,b=PAPERS[pid]; d=pymupdf.open(f); res=[]
    for pn in range(a,b+1):
        p=d[pn-1]
        for l in lines(p):
            if l['y0']<30 or l['y0']>790: continue
            # rightmost spans
            rs=sorted(l['spans'],key=lambda s:-s[1])
            for s in rs[:3]:
                t=s[2].strip(' )(|\t')
                if re.fullmatch(r'\d{1,2}',t) and s[1]>490:
                    res.append((pn,round(l['y0']),'Q',int(t),round(s[1]))); break
                if re.fullmatch(r'[أبجد]\.?|-?[أبجد]\.',t) and s[1]>480:
                    res.append((pn,round(l['y0']),'P',t,round(s[1]))); break
    return res
if __name__=='__main__':
    for pid in sys.argv[1:]:
        for r in anchors(pid): print(pid,r)
