import pymupdf,json,os,sys
from PIL import Image,ImageDraw
from anchors import PAPERS
from extract import strip_side,xr
DPI=200; S=DPI/72
_cache={}
def page_img(f,pg):
    k=(f,pg)
    if k not in _cache:
        os.makedirs('pages',exist_ok=True); fn=f'pages/{f[:-4]}_{pg:03d}.png'
        if not os.path.exists(fn):
            pix=pymupdf.open(f)[pg-1].get_pixmap(dpi=DPI,colorspace=pymupdf.csGRAY); pix.save(fn)
        _cache[k]=Image.open(fn).convert('L')
    return _cache[k]
def clean_edges(c,lim=14,thr=160):
    # يمسح بقايا سطر مجاور مقطوع عند حافة القصّ (حتى أول صف أبيض)
    c=c.copy(); W,H=c.size; px=c.load()
    def ink(y): return any(px[x,y]<thr for x in range(0,W,2))
    for rows in (range(0,min(lim,H)),range(H-1,max(H-1-lim,-1),-1)):
        rows=list(rows)
        if rows and ink(rows[0]):
            band=[]
            for y in rows:
                if not ink(y): break
                band.append(y)
            else: band=[]  # الحبر ممتد (إطار/صورة) — لا نمسح
            for y in band:
                for x in range(W): px[x,y]=255
    return c
def crop(pid,it):
    f=PAPERS[pid][0]; d=pymupdf.open(f); parts=[]; qb=None
    for i,(pg,y0,y1) in enumerate(it['segs']):
        x0,x1=xr(strip_side(d[pg-1])); im=page_img(f,pg)
        c=im.crop((int(x0*S),int(y0*S),int(x1*S),int(y1*S)))
        c=clean_edges(c)
        b=it.get('box')
        if b and pg==it['pg'] and y0<=b[1]<y1 and qb is None:
            off=sum(p.height for p in parts)
            qb=[int((b[0]-x0)*S)-6,int((b[1]-y0)*S)+off-3,int((b[2]-b[0])*S)+14,int((b[3]-b[1])*S)+6]
        parts.append(c)
    w=max(p.width for p in parts); h=sum(p.height for p in parts)
    can=Image.new('L',(w,h),255); y=0
    for p in parts: can.paste(p,(0,y)); y+=p.height
    return can,qb
if __name__=='__main__':
    pid=sys.argv[1]; its=json.load(open(f'items_{pid}.json'))
    th=[]
    for it in its:
        c,qb=crop(pid,it); c=c.convert('RGB')
        if qb: ImageDraw.Draw(c).rectangle([qb[0],qb[1],qb[0]+qb[2],qb[1]+qb[3]],outline=(255,0,0),width=4)
        r=330/c.width; c=c.resize((330,max(1,int(c.height*r))))
        ImageDraw.Draw(c).text((5,5),f"{it['n']}{it['part']}",fill=(0,0,255))
        th.append(c)
    cols=6; rows=[th[i:i+cols] for i in range(0,len(th),cols)]
    H=sum(max(x.height for x in r) for r in rows); can=Image.new('RGB',(330*cols+5*cols,H+5*len(rows)),'gray'); y=0
    for r in rows:
        x=0
        for t in r: can.paste(t,(x,y)); x+=335
        y+=max(t.height for t in r)+5
    can.save(f'prev_{pid}.jpg',quality=60); print(can.size)
