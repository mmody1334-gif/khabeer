// «بطاقات الإجابة» — الرمز والكاشف (بلا مكتبات خارجية).
// البطاقة: مربع 6×6 خلايا (إطار أسود + 4×4 بتات) داخل هامش أبيض، وعلى جوانبها الحروف أ/ب/ج/د.
// الطالب يدير البطاقة فيصبح حرف إجابته في الأعلى؛ الكاشف يعرف رقم البطاقة من البتات، والإجابة من اتجاهها.
// القاموس: 64 رمزًا، المسافة بين أي رمزين (بكل دورانهما) ≥ 4 بتات، فيُصحَّح خطأ بت واحد ولا يختلط رمز بآخر.
var CARD_CODES=[38450,65217,10134,18845,11673,8669,8566,20266,59372,24004,6730,34104,43726,57713,40301,9467,25620,55857,62409,44215,36704,61877,33174,45256,60518,15480,47243,35295,2605,53146,50322,28505,52728,49972,63693,11209,30059,31354,37761,54791,40854,4747,48449,33109,15790,51548,43507,45447,15657,12569,22280,4464,54391,35819,22590,53664,46287,9001,60873,22841,33710,34188,12852,21014];
var CARD_MAX=CARD_CODES.length;
// الحروف على جوانب البطاقة: الأعلى أ، اليمين ب، الأسفل ج، اليسار د
var CARD_SIDES=['top','right','bottom','left'];
var CARD_LET=['أ','ب','ج','د'],CARD_LET_EN=['A','B','C','D'];
function cardRot(c){var o=0;for(var r=0;r<4;r++)for(var k=0;k<4;k++)if(c>>(r*4+k)&1)o|=1<<(k*4+(3-r));return o;}
var CARD_ROTS=CARD_CODES.map(function(c){var a=[c];for(var i=0;i<3;i++)a.push(cardRot(a[i]));return a;});
function popcnt(x){x=x-((x>>1)&0x5555);x=(x&0x3333)+((x>>2)&0x3333);x=(x+(x>>4))&0x0f0f;return (x+(x>>8))&0x1f;}

// SVG البطاقة (رقمها يبدأ من 1). opts: {name, size(mm), en}
function cardSvg(n,opts){
  opts=opts||{};var code=CARD_CODES[n-1],S=100,M=11,cell=(S-2*M)/6,h='';
  for(var r=0;r<6;r++)for(var c=0;c<6;c++){
    var black=(r===0||c===0||r===5||c===5)?true:!!(code>>((r-1)*4+(c-1))&1);
    if(black)h+='M'+(M+c*cell).toFixed(2)+' '+(M+r*cell).toFixed(2)+'h'+(cell+0.35).toFixed(2)+'v'+(cell+0.35).toFixed(2)+'h-'+(cell+0.35).toFixed(2)+'z';
  }
  var L=opts.en?CARD_LET_EN:CARD_LET,fs=5.2,mid=S/2,pad=4.6;
  // كل حرف يُقرأ معتدلًا حين يكون جانبه في الأعلى
  var lets='<text x="'+mid+'" y="'+pad+'" transform="rotate(0 '+mid+' '+pad+')">'+L[0]+'</text>'+
    '<text x="'+(S-pad)+'" y="'+mid+'" transform="rotate(90 '+(S-pad)+' '+mid+')">'+L[1]+'</text>'+
    '<text x="'+mid+'" y="'+(S-pad)+'" transform="rotate(180 '+mid+' '+(S-pad)+')">'+L[2]+'</text>'+
    '<text x="'+pad+'" y="'+mid+'" transform="rotate(-90 '+pad+' '+mid+')">'+L[3]+'</text>';
  var nm=opts.name?String(opts.name).replace(/[<&>"]/g,function(ch){return {'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[ch];}):'';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+S+' '+S+'" class="cs-svg"'+(opts.size?' width="'+opts.size+'mm" height="'+opts.size+'mm"':'')+'>'+
    '<rect width="'+S+'" height="'+S+'" fill="#fff"/><path fill="#000" d="'+h+'"/>'+
    '<g font-family="Tajawal,Arial,sans-serif" font-size="'+fs+'" font-weight="700" fill="#9a9a9a" text-anchor="middle" dominant-baseline="central">'+lets+'</g>'+
    '<g font-family="Arial,sans-serif" font-size="5" font-weight="700" fill="#9a9a9a" text-anchor="middle" dominant-baseline="central">'+
      '<text x="'+(M+2.5)+'" y="'+(M-4.6)+'">'+n+'</text><text x="'+(S-M+4.6)+'" y="'+(M+2.5)+'" transform="rotate(90 '+(S-M+4.6)+' '+(M+2.5)+')">'+n+'</text>'+
      '<text x="'+(S-M-2.5)+'" y="'+(S-M+4.6)+'" transform="rotate(180 '+(S-M-2.5)+' '+(S-M+4.6)+')">'+n+'</text><text x="'+(M-4.6)+'" y="'+(S-M-2.5)+'" transform="rotate(-90 '+(M-4.6)+' '+(S-M-2.5)+')">'+n+'</text></g>'+
    (nm?'<text x="'+(mid-7)+'" y="'+(S-M+4.6)+'" font-family="Tajawal,Arial,sans-serif" font-size="3.3" fill="#b5b5b5" text-anchor="start" dominant-baseline="central" direction="rtl">'+nm+'</text>':'')+
  '</svg>';
}

// ---------- الكاشف ----------
// gray: Uint8Array بطول W*H. يعيد [{n (رقم البطاقة), ans (0..3), corners, size}]
function cardDetect(gray,W,H){
  var N=W*H,ii=new Uint32Array((W+1)*(H+1)),x,y,i;
  for(y=0;y<H;y++){var rs=0,o=y*W,io=(y+1)*(W+1),ip=y*(W+1);for(x=0;x<W;x++){rs+=gray[o+x];ii[io+x+1]=ii[ip+x+1]+rs;}}
  var R=Math.max(5,Math.round(Math.min(W,H)/18)),bin=new Uint8Array(N);
  for(y=0;y<H;y++){
    var y0=Math.max(0,y-R),y1=Math.min(H,y+R+1);
    for(x=0;x<W;x++){
      var x0=Math.max(0,x-R),x1=Math.min(W,x+R+1),area=(x1-x0)*(y1-y0);
      var s=ii[y1*(W+1)+x1]-ii[y0*(W+1)+x1]-ii[y1*(W+1)+x0]+ii[y0*(W+1)+x0];
      var g=gray[y*W+x];
      if(g*area<s*0.86-6*area)bin[y*W+x]=1;
    }
  }
  // تسمية المكوّنات المتصلة بالمقاطع الأفقية (اتصال رباعي)
  var rx0=[],rx1=[],ry=[],par=[],prevS=0,prevE=0;
  function find(a){while(par[a]!==a){par[a]=par[par[a]];a=par[a];}return a;}
  for(y=0;y<H;y++){
    var curS=rx0.length,o2=y*W,p=prevS;
    for(x=0;x<W;){
      if(!bin[o2+x]){x++;continue;}
      var s0=x;while(x<W&&bin[o2+x])x++;
      var id=rx0.length;rx0.push(s0);rx1.push(x-1);ry.push(y);par.push(id);
      while(p<prevE&&rx1[p]<s0)p++;
      for(var q=p;q<prevE&&rx0[q]<=x-1;q++){var a=find(q),b=find(id);if(a!==b)par[a<b?b:a]=a<b?a:b;}
    }
    prevS=curS;prevE=rx0.length;
  }
  var comp={},nr=rx0.length;
  for(i=0;i<nr;i++){
    var r=find(i),c=comp[r];
    if(!c)c=comp[r]={area:0,minx:1e9,maxx:-1,miny:1e9,maxy:-1,pts:[]};
    c.area+=rx1[i]-rx0[i]+1;
    if(rx0[i]<c.minx)c.minx=rx0[i];if(rx1[i]>c.maxx)c.maxx=rx1[i];if(ry[i]<c.miny)c.miny=ry[i];if(ry[i]>c.maxy)c.maxy=ry[i];
    c.pts.push(rx0[i]-0.5,ry[i]-0.5,rx0[i]-0.5,ry[i]+0.5,rx1[i]+0.5,ry[i]-0.5,rx1[i]+0.5,ry[i]+0.5);
  }
  var out=[],best={};
  for(var k in comp){
    var C=comp[k],bw=C.maxx-C.minx+1,bh=C.maxy-C.miny+1;
    if(bw<11||bh<11||C.area<70||bw>W*0.9||bh>H*0.9)continue;
    if(bw>bh*4||bh>bw*4)continue;
    if(C.area<bw*bh*0.22)continue;
    var quad=cardQuad(C.pts);if(!quad)continue;
    var qa=polyArea(quad);if(qa<100||C.area<qa*0.42||C.area>qa*1.08)continue;
    var hit=cardRead(gray,W,H,quad);if(!hit)continue;
    hit.size=Math.sqrt(qa);
    if(!best[hit.n]||best[hit.n].size<hit.size)best[hit.n]=hit;
  }
  for(var n in best)out.push(best[n]);
  return out;
}
function polyArea(p){var s=0;for(var i=0;i<4;i++){var j=(i+1)%4;s+=p[i][0]*p[j][1]-p[j][0]*p[i][1];}return s/2;}
// رباعي من الغلاف المحدّب: أبعد نقطتين قطرًا، ثم أبعد نقطة عن القطر في كل جهة
function cardQuad(flat){
  var P=[];for(var i=0;i<flat.length;i+=2)P.push([flat[i],flat[i+1]]);
  P.sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
  function cr(o,a,b){return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);}
  var lo=[],up=[];
  for(i=0;i<P.length;i++){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],P[i])<=0)lo.pop();lo.push(P[i]);}
  for(i=P.length-1;i>=0;i--){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],P[i])<=0)up.pop();up.push(P[i]);}
  lo.pop();up.pop();var h=lo.concat(up);if(h.length<4)return null;
  var a=0,b=0,dm=-1,j;
  for(i=0;i<h.length;i++)for(j=i+1;j<h.length;j++){var dx=h[i][0]-h[j][0],dy=h[i][1]-h[j][1],d=dx*dx+dy*dy;if(d>dm){dm=d;a=i;b=j;}}
  var A=h[a],Bq=h[b],c1=null,c2=null,m1=0,m2=0;
  for(i=0;i<h.length;i++){var v=cr(A,Bq,h[i]);if(v>m1){m1=v;c1=h[i];}if(-v>m2){m2=-v;c2=h[i];}}
  if(!c1||!c2)return null;
  // الرباعي الناتج يجب أن يغطي معظم الغلاف (شكل مربع لا دائرة أو خط)
  var q=[A,c1,Bq,c2];if(polyArea(q)<0)q=[A,c2,Bq,c1];
  var ha=0;for(i=0;i<h.length;i++){j=(i+1)%h.length;ha+=h[i][0]*h[j][1]-h[j][0]*h[i][1];}ha=Math.abs(ha/2);
  var qa=Math.abs(polyArea(q));if(qa<ha*0.8)return null;
  // أضلاع متقاربة الطول (يُسمح بميل المنظور)
  var L=[];for(i=0;i<4;i++){j=(i+1)%4;L.push(Math.hypot(q[i][0]-q[j][0],q[i][1]-q[j][1]));}
  var mn=Math.min.apply(null,L),mx=Math.max.apply(null,L);if(mn<9||mx>mn*3)return null;
  return q;
}
// إسقاط مربع الوحدة على الرباعي (Heckbert)
function cardH(p){
  var x0=p[0][0],y0=p[0][1],x1=p[1][0],y1=p[1][1],x2=p[2][0],y2=p[2][1],x3=p[3][0],y3=p[3][1];
  var dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,sx=x0-x1+x2-x3,sy=y0-y1+y2-y3,den=dx1*dy2-dx2*dy1;
  var g=den?(sx*dy2-dx2*sy)/den:0,h=den?(dx1*sy-sx*dy1)/den:0;
  var a=x1-x0+g*x1,b=x3-x0+h*x3,d=y1-y0+g*y1,e=y3-y0+h*y3;
  return function(u,v){var w=g*u+h*v+1;return [(a*u+b*v+x0)/w,(d*u+e*v+y0)/w];};
}
function cardRead(gray,W,H,quad){
  var M=cardH(quad);
  function px(u,v){var p=M(u/6,v/6),x=p[0]-0.5,y=p[1]-0.5;if(x<0||y<0||x>=W-1||y>=H-1)return -1;
    var xi=x|0,yi=y|0,fx=x-xi,fy=y-yi,o=yi*W+xi;
    return gray[o]*(1-fx)*(1-fy)+gray[o+1]*fx*(1-fy)+gray[o+W]*(1-fx)*fy+gray[o+W+1]*fx*fy;}
  function cellv(r,c){var s=0,n=0,d=[[0,0],[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]];for(var i=0;i<5;i++){var v=px(c+.5+d[i][0],r+.5+d[i][1]);if(v<0)return -1;s+=v;n++;}return s/n;}
  var ring=[],quiet=[],cells=[],r,c,v;
  for(r=0;r<6;r++)for(c=0;c<6;c++){v=cellv(r,c);if(v<0)return null;if(r===0||c===0||r===5||c===5)ring.push(v);else cells.push(v);}
  for(var t=0.5;t<6;t+=1){[[t,-0.3],[t,6.3],[-0.3,t],[6.3,t]].forEach(function(q){var z=px(q[0],q[1]);if(z>=0)quiet.push(z);});}
  if(quiet.length<8)return null;
  var med=function(a){a=a.slice().sort(function(x,y){return x-y;});return a[a.length>>1];};
  var b=med(ring),w=med(quiet);if(w-b<28)return null;
  var thr=(w+b)/2,bad=0;for(var i=0;i<ring.length;i++)if(ring[i]>thr)bad++;
  if(bad>2)return null;
  var bits=0;for(i=0;i<16;i++)if(cells[i]<thr)bits|=1<<i;
  var bn=-1,bk=0,bd=99,sd=99;
  for(var n=0;n<CARD_ROTS.length;n++)for(var k=0;k<4;k++){var dd=popcnt(bits^CARD_ROTS[n][k]);if(dd<bd){sd=bd;bd=dd;bn=n;bk=k;}else if(dd<sd)sd=dd;}
  if(bd>0||sd<3)return null;
  // اتجاه أعلى البطاقة في الصورة: الرمز الأصلي مُدار k مرات مع عقارب الساعة في إطار القراءة
  var up=[[0,-1],[1,0],[0,1],[-1,0]][bk],ce=M(0.5,0.5),tp=M(0.5+up[0]*0.3,0.5+up[1]*0.3),vx=tp[0]-ce[0],vy=tp[1]-ce[1];
  // أعلى البطاقة يشير لأعلى ← أ ، لليمين ← د (الجانب الأيسر صار في الأعلى) ، لأسفل ← ج ، لليسار ← ب
  var ans=Math.abs(vy)>=Math.abs(vx)?(vy<0?0:2):(vx>0?3:1);
  return {n:bn+1,ans:ans,corners:quad,dist:bd};
}
// تحويل إطار فيديو/صورة إلى رمادي
function cardGray(ctx,W,H){var d=ctx.getImageData(0,0,W,H).data,g=new Uint8Array(W*H);for(var i=0,j=0;i<g.length;i++,j+=4)g[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;return g;}
