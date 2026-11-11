import json,sys
sys.path.insert(0,'/home/claude/work/ss12')
from study_src import P, UNITS
KEYU='الدراسات الاجتماعية|الثاني عشر|'
def study_lesson(p):
    return {'summary':{'intro':p['intro'],'outcomes':[{'code':'','text':t,'points':pts} for t,pts in p['O']],
                       'terms':[{'t':a,'d':b} for a,b in p['T']],'remember':p['R']},
            'remedial':{'focus':p['focus'],'weak_areas':p['weak'],'simple':p['simple'],'activities':[
                {'title':'أكمل الفراغ','type':'fill','instructions':'املأ الفراغ بالكلمة المناسبة.','items':[{'q':q,'a':a} for q,a in p['F']]},
                {'title':'اختر الإجابة الصحيحة','type':'choose','instructions':'اختر الإجابة الصحيحة من بين القوسين.','items':[{'q':q,'a':a} for q,a in p['C']]},
                {'title':'أجب بإيجاز','type':'short','instructions':'أجب عن الأسئلة الآتية بإيجاز.','items':[{'q':q,'a':a} for q,a in p['S']]}]}}
def games_lesson(p):
    return {'claims':[{'text':t,'true':v,'why':w} for t,v,w in p['claims']],
            'links':[{'a':a,'b':b,'answer':c} for a,b,c in p['links']],
            'sequence':{'title':p['seq'][0],'steps':p['seq'][1]}}
for site in sys.argv[1:]:
    sp=site+'/data/study_pack.json'; S=json.load(open(sp))
    for i,p in P.items(): S['lessons'][str(i)]=study_lesson(p)
    for u,d in UNITS.items(): S['units'][KEYU+u]={'title':d['title'],'big_ideas':d['big'],'connections':d['conn'],'check':d['check']}
    gp=site+'/data/games_pack.json'; G=json.load(open(gp))
    for i,p in P.items(): G[str(i)]=games_lesson(p)
    for path,obj in ((sp,S),(gp,G)):
        raw=open(path).read()
        ind=1 if raw.startswith('{\n ') else None
        json.dump(obj,open(path,'w'),ensure_ascii=False,indent=ind,separators=None if ind else (',',':'))
    print(site,len(S['lessons']),len(G))
