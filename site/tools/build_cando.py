import json,re,sys,glob,collections
src_dir,lessons_p,out_p=sys.argv[1:4]
L=json.load(open(lessons_p))
def subj(l):
    s=l.get('subject')
    if not s: return 'العلوم' if l['grade']=='الخامس' else 'الأحياء'
    return s
UN={}
for l in L: UN.setdefault(subj(l)+'|'+l['grade'],{})[str(l['unit'])]=l.get('unit_name')
D=collections.OrderedDict(); cur=None; unit=None; errs=[]
for f in sorted(glob.glob(src_dir+'/*.txt')):
    for ln,line in enumerate(open(f,encoding='utf-8'),1):
        line=line.rstrip()
        if not line.strip(): continue
        if line.startswith('@ '):
            k=line[2:].strip(); s,g=k.split('|'); cur=D.setdefault(k,{'subject':s,'grade':g,'units':[]}); unit=None
        elif line.startswith('# '):
            m=re.match(r'# (\d+) (.+)',line); u,n=m.group(1),m.group(2).strip()
            if UN.get(cur['subject']+'|'+cur['grade'],{}).get(u)!=n: errs.append(f'{f}:{ln} unit name mismatch {u} {n!r} vs {UN.get(cur["subject"]+"|"+cur["grade"],{}).get(u)!r}')
            unit={'u':u,'name':n,'rows':[]}; cur['units'].append(unit)
        elif line.startswith('- '):
            unit['rows'][-1].setdefault('b',[]).append(line[2:].strip())
        else:
            m=re.match(r'(\d+-\d+) \| (.+)',line)
            if not m: errs.append(f'{f}:{ln} bad line {line!r}'); continue
            r=m.group(1)
            if r.split('-')[0]!=unit['u']: errs.append(f'{f}:{ln} ref {r} not in unit {unit["u"]}')
            unit['rows'].append({'r':r,'t':m.group(2).strip()})
for e in errs: print('ERR',e)
for k,v in D.items(): print(k,len(v['units']),sum(len(u['rows']) for u in v['units']))
json.dump(D,open(out_p,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
