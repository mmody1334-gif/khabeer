# ينشر أسئلة امتحانات الدراسات الاجتماعية 12 في data/finals.json وصورها في finals/img/ss12
import json,hashlib,os,sys
from crop import crop
from PIL import Image
SITE=sys.argv[1]
KEY='الدراسات الاجتماعية|الثاني عشر'; SLUG='ss12'
U={'1':'عُمان.. تاريخ وحضارة','2':'بيئتنا.. تنوع وثراء واستدامة'}
META={'2324-0':('2023-2024','الدور الأول'),'2324-1':('2023-2024','الدور الثاني'),'2425-0':('2024-2025','الدور الأول'),'2425-1':('2024-2025','الدور الثاني'),'2526-0':('2025-2026','الدور الأول'),'2526-1':('2025-2026','الدور الثاني')}
L={l['id']:l for l in json.load(open(SITE+'/data/lessons.json'))}
its=json.load(open('all_items.json'))
os.makedirs(f'{SITE}/finals/img/{SLUG}',exist_ok=True)
G={'subject':'الدراسات الاجتماعية','grade':'الثاني عشر','units':U,'papers':{},'q':[]}
for pid,(y,s) in META.items(): G['papers'][f'{SLUG}-{pid}']={'year':y,'term':1,'session':s,'region':'','total':70}
for o in its:
    pid=f"{SLUG}-{o['pid']}"; n=str(o['n'])+('-'+o['part'] if o['part'] else '')
    qid=hashlib.md5(f'{pid}-{n}'.encode()).hexdigest()[:10]
    im,qb=crop(o['pid'],{'segs':o['segs'],'box':o['box'],'pg':o['pg']})
    sc=1.0
    if im.width>1000: sc=1000/im.width; im=im.resize((1000,int(im.height*sc)),Image.LANCZOS)
    im.save(f'{SITE}/finals/img/{SLUG}/{qid}.webp','WEBP',quality=60,method=6)
    if qb: qb=[max(0,int(qb[0]*sc)),max(0,int(qb[1]*sc)),int(qb[2]*sc)+2,int(qb[3]*sc)+2]
    multi='(1)' in o['a'] or '\n' in o['a']
    t='mcq' if o['n']<=14 else ('structured' if multi and o['m']>=3 else 'short')
    l=o['l']; u=str(L[l]['unit'])
    q={'id':qid,'p':pid,'n':n,'m':o['m'],'t':t,'x':o['x'],'a':o['a'],'as':'ms','c':'','ao':o['ao'],'u':u,'l':l,'l2':None,'im':f'{SLUG}/{qid}.webp','w':im.width,'h':im.height}
    if qb: q['qb']=qb
    G['q'].append(q)
F=json.load(open(SITE+'/data/finals.json'))
F[KEY]=G
json.dump(F,open(SITE+'/data/finals.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(G['q']),'items', sum(os.path.getsize(f'{SITE}/finals/img/{SLUG}/'+f) for f in os.listdir(f'{SITE}/finals/img/{SLUG}'))//1024,'KB')
