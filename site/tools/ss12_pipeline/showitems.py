import json,sys
from crop import crop
from PIL import Image
pid=sys.argv[1]; want=sys.argv[2].split(','); W=int(sys.argv[3]) if len(sys.argv)>3 else 700
its=json.load(open(f'items_{pid}.json')); ims=[]
for it in its:
    if f"{it['n']}{it['part']}" in want:
        c,_=crop(pid,it); r=W/c.width; ims.append(c.resize((W,int(c.height*r))))
H=sum(i.height for i in ims); can=Image.new('L',(W,H),255); y=0
for i in ims: can.paste(i,(0,y)); y+=i.height
can.save('show.png'); print(can.size)
