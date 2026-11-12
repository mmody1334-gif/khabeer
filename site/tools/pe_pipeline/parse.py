import docx, json, re, sys, glob, unicodedata
from docx.table import Table
from docx.text.paragraph import Paragraph
import sys
SRC=sys.argv[1] if len(sys.argv)>1 else './'
# ملفات التحضير بأسماء مختصرة (انسخها بهذه الأسماء قبل التشغيل)
FILES=[('الخامس','g5.docx'),('السادس','g6.docx'),('السابع','g7.docx'),('الثامن','g8_l1.docx'),('الثامن','g8_l2.docx'),
 ('الثامن','g8.docx'),('التاسع','g9.docx'),('العاشر','g10.docx'),('الحادي عشر','g11.docx')]
def cells(row):
    out=[];prev=None
    for c in row.cells:
        if c._tc is prev: continue
        prev=c._tc; out.append(c.text.strip())
    return out
def rows_of(path):
    d=docx.Document(path); R=[]
    for ch in d.element.body.iter():
        if ch.tag.endswith('}tr'):
            # only direct rows of top-level tables handled by Table API below
            pass
    for ch in d.element.body.iterchildren():
        if ch.tag.endswith('}tbl'):
            for r in Table(ch,d).rows: R.append(cells(r))
    return R
out=[]
for grade,fn in FILES:
    R=rows_of(SRC+fn); cur=None
    for i,r in enumerate(R):
        j=' || '.join(r)
        if re.search(r'الصف\s*:',r[0]) and any('عنوان الدرس' in c for c in r):
            cur={'grade':grade,'file':fn,'hdr':r,'raw':{}}; out.append(cur); continue
        if cur is None: continue
        if r[0].startswith('التعلم القبلي'):
            cur['raw'].setdefault('pre',[]).extend(r[1:])
        elif r[0].startswith('الأهداف/') and i+1<len(R):
            cur['raw']['A']=R[i+1]
        elif r[0].startswith('التقويم التكويني') and i+1<len(R):
            cur['raw']['B']=R[i+1]
json.dump(out,open('raw.json','w'),ensure_ascii=False,indent=1)
for k,x in enumerate(out): print(k,x['grade'],'|',' / '.join(x['hdr'][1:])[:110],'| A' if 'A' in x['raw'] else '','B' if 'B' in x['raw'] else '', len(json.dumps(x['raw'],ensure_ascii=False)))
