import json,sys
sys.path.insert(0,'/home/claude/work/ss12')
from lessons_src import L, SUBJECT, GRADE
FIELDS=['concepts','pre_learning','outcomes','strategies','activities_teach','resources','formative','enrich','closing','homework','misconceptions','hw_q1','hw_a1','hw_q2','hw_a2']
NOPREP={2465,2466,2467}
def build():
    out=[]
    for l in L:
        r={'grade':GRADE,'unit':l['unit'],'unit_name':l['unit_name'],'title':l['title'],'id':l['id'],
           'ai_filled':(FIELDS[:] if l['id'] in NOPREP else ['concepts','misconceptions','hw_q1','hw_a1','hw_q2','hw_a2']),
           'subject':SUBJECT,'term':1,'lesson_no':l['lesson_no'],'src':'ss12','code':l['code'],'review':False}
        for f in FIELDS: r[f]=l[f]
        out.append(r)
    return out
if __name__=='__main__':
    for site in sys.argv[1:]:
        p=site+'/data/lessons.json'; A=json.load(open(p))
        ids={l['id'] for l in L}
        A=[x for x in A if x['id'] not in ids]+build()
        json.dump(A,open(p,'w'),ensure_ascii=False,indent=1)
        print(site,len(A))
