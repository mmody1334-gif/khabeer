import json,re,sys,importlib.util
sys.path.insert(0,'/home/claude/work/ss12')
from lessons_src import L
PIDS=['2324-0','2324-1','2425-0','2425-1','2526-0','2526-1']
META={'2324-0':('2023-2024','الدور الأول'),'2324-1':('2023-2024','الدور الثاني'),'2425-0':('2024-2025','الدور الأول'),'2425-1':('2024-2025','الدور الثاني'),'2526-0':('2025-2026','الدور الأول'),'2526-1':('2025-2026','الدور الثاني')}
def lesson_for(page,txt):
    c=[l for l in L if l['pages'][0]<=page<=l['pages'][1]]
    if not c:
        if page<12: return 2450
        if 49<=page<=51: return 2459 if page<51 else 2460
        if page>76: return 2467
        return None
    if len(c)>1:
        if page==63: return 2463 if re.search(r'التشريع|النظام الأساسي|الخطط|التنمية|قانون',txt) else 2462
        if page==72: return 2467 if re.search(r'انقراض|الحيوان|محمي',txt) else 2466
    return c[0]['id']
K3=r'علّ?ل|استنتج|دلّ?ل|برهن|من وجهة نظرك|رأيك|اقترح|ناقش|قيّ?م|هل تحقق|هل |ما الدلائل|ما دلالة|توقع|تنبأ'
K2=r'استخرج|ادرس|حدّ?د|ارسم|ظلّ?ل|صنّ?ف|وضّ?ح|فسّ?ر|رتّ?ب|انسب|مثّ?ل|قارن|الخريطة|الشكل|الجدول|المخطط|الرسم|الصورة|النص|العبارة|المسطرة|التسلسل|الترتيب'
def ao_of(txt,mcq):
    t=re.sub(r'\s+',' ',txt)
    if re.search(K3,t): return 'استدلال'
    if re.search(K2,t): return 'تطبيق'
    return 'معرفة'
def load_ans(pid):
    spec=importlib.util.spec_from_file_location('a',f'ans_{pid}.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m.A
out=[]
for pid in PIDS:
    its=json.load(open(f'items_{pid}.json')); A=load_ans(pid)
    keys=[f"{z['n']}{z['part']}" for z in its]
    assert set(keys)==set(A.keys()), (pid,set(keys)^set(A.keys()))
    tot=sum(A[k][0] for k in A); assert tot==70,(pid,tot)
    for z in its:
        k=f"{z['n']}{z['part']}"; m,pg,a=A[k]
        x=z['text']
        lid=lesson_for(pg,x+a)
        out.append(dict(pid=pid,k=k,n=z['n'],part=z['part'],m=m,page=pg,l=lid,ao=ao_of(x,z['n']<=14),a=a,x=x,segs=z['segs'],box=z['box'] if z['part'] in ('','أ') else None,pg=z['pg']))
json.dump(out,open('all_items.json','w'),ensure_ascii=False,indent=0)
import collections
print(len(out), collections.Counter(o['ao'] for o in out), collections.Counter(o['l'] for o in out))
print([o['k'] for o in out if o['l'] is None])
