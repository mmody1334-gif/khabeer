// ========== طبقة المؤثرات المشتركة لكل الألعاب ==========
// أصوات مولّدة بـ WebAudio (بلا ملفات) + شرر وومضات واهتزاز وقصاصات احتفال على canvas شفاف فوق الصفحة.
var tugA=null;
function tugCtx(){try{tugA=tugA||new (window.AudioContext||window.webkitAudioContext)();if(tugA.state==='suspended')tugA.resume();return tugA;}catch(e){return null;}}
function tone(a,type,f0,f1,t0,dur,vol){var o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f0,t0);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t0+dur);g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+.012);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.connect(g);g.connect(a.destination);o.start(t0);o.stop(t0+dur+.05);}
function noise(a,t0,dur,vol,f0,f1,q){var n=Math.floor(a.sampleRate*dur),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=Math.random()*2-1;var s=a.createBufferSource();s.buffer=b;var bp=a.createBiquadFilter();bp.type='bandpass';bp.Q.value=q||1.2;bp.frequency.setValueAtTime(f0,t0);bp.frequency.exponentialRampToValueAtTime(f1,t0+dur);var g=a.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+dur*.25);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);s.connect(bp);bp.connect(g);g.connect(a.destination);s.start(t0);s.stop(t0+dur);}
function sfx(k){
  if(!sound)return;var a=tugCtx();if(!a)return;var t=a.currentTime;
  if(k==='ok'){tone(a,'sine',784,784,t,.12,.18);tone(a,'sine',1175,1175,t+.08,.22,.16);}
  else if(k==='pull'){noise(a,t,.28,.25,500,2600,1.4);tone(a,'sine',140,60,t,.18,.35);}
  else if(k==='bad'){tone(a,'square',160,110,t,.32,.07);tone(a,'sawtooth',120,90,t,.32,.05);}
  else if(k==='freeze'){tone(a,'triangle',1800,2600,t,.25,.05);}
  else if(k==='count'){tone(a,'sine',660,660,t,.18,.2);}
  else if(k==='go'){tone(a,'sine',990,990,t,.12,.22);tone(a,'sine',1320,1320,t+.1,.4,.22);noise(a,t,.6,.12,800,3000,.7);}
  else if(k==='fire'){tone(a,'sawtooth',300,1200,t,.35,.08);noise(a,t,.35,.1,1000,4000,1);}
  else if(k==='kick'){tone(a,'sine',150,45,t,.16,.45);}
  else if(k==='win'){[523,659,784,1046].forEach(function(f,i){tone(a,'triangle',f,f,t+i*.12,.32,.2);});tone(a,'triangle',1046,1046,t+.5,.8,.22);tone(a,'triangle',1318,1318,t+.5,.8,.15);noise(a,t+.3,1.6,.18,700,1800,.5);}
  else if(k==='tie'){tone(a,'triangle',523,392,t,.5,.18);}
  else if(k==='tick'){tone(a,'sine',1200,1200,t,.05,.05);}
  else if(k==='pop'){noise(a,t,.12,.35,1800,600,.8);tone(a,'sine',900,300,t,.1,.15);}
  else if(k==='launch'){noise(a,t,1.1,.22,200,1400,.6);tone(a,'sawtooth',90,320,t,1,.05);}
  else if(k==='boom'){noise(a,t,.7,.4,900,80,.6);tone(a,'sine',90,30,t,.5,.5);}
  else if(k==='whistle'){tone(a,'sine',2200,2300,t,.18,.12);tone(a,'sine',2200,2350,t+.22,.45,.12);}
  else if(k==='goal'){noise(a,t,2,.25,500,1500,.4);[392,523,659,784].forEach(function(f,i){tone(a,'square',f,f,t+i*.1,.22,.06);});tone(a,'square',1046,1046,t+.45,.7,.07);}
  else if(k==='kickball'){tone(a,'sine',220,70,t,.12,.5);noise(a,t,.08,.25,2000,800,1);}
  else if(k==='coin'){tone(a,'square',988,988,t,.08,.07);tone(a,'square',1319,1319,t+.08,.25,.07);}
  else if(k==='swoosh'){noise(a,t,.35,.2,3000,400,1.5);}
}
// قصاصات احتفال على canvas
function confetti(cv,main){
  if(!cv)return;var r=cv.getBoundingClientRect(),W=cv.width=r.width,H=cv.height=r.height,c=cv.getContext('2d'),cols=[main,'#ffd400','#26890c','#ffffff','#864cbf',main],ps=[];
  for(var i=0;i<170;i++)ps.push({x:W/2+(Math.random()-.5)*W*.3,y:H*.35,vx:(Math.random()-.5)*14,vy:-Math.random()*13-4,s:4+Math.random()*7,r:Math.random()*6,vr:(Math.random()-.5)*.3,c:cols[i%cols.length]});
  var t0=Date.now(),run=true;stopFns.push(function(){run=false;});
  (function fr(){if(!run||!document.body.contains(cv))return;c.clearRect(0,0,W,H);ps.forEach(function(p){p.vy+=.32;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;c.save();c.translate(p.x,p.y);c.rotate(p.r);c.fillStyle=p.c;c.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);c.restore();});
    if(Date.now()-t0<4200)requestAnimationFrame(fr);else c.clearRect(0,0,W,H);})();
}

var fxCv=null,fxPs=[],fxRun=false,fxLast={x:innerWidth/2,y:innerHeight/2};
document.addEventListener('pointerdown',function(e){fxLast={x:e.clientX,y:e.clientY};},true);
function fxCanvas(){
  var host=document.fullscreenElement||document.body;
  if(!fxCv){fxCv=document.createElement('canvas');fxCv.className='fx-cv';}
  if(fxCv.parentNode!==host)host.appendChild(fxCv);
  fxCv.width=innerWidth;fxCv.height=innerHeight;return fxCv;
}
function fxLoop(){
  if(fxRun)return;fxRun=true;var cv=fxCanvas(),c=cv.getContext('2d');
  (function fr(){c.clearRect(0,0,cv.width,cv.height);
    fxPs=fxPs.filter(function(p){return p.life>0;});
    fxPs.forEach(function(p){p.life--;p.vy+=p.g;p.vx*=.985;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;c.save();c.globalAlpha=Math.min(1,p.life/25);c.translate(p.x,p.y);c.rotate(p.r);c.fillStyle=p.c;
      if(p.k==='star'){c.beginPath();for(var i=0;i<10;i++){var a=i*Math.PI/5,rr=i%2?p.s*.45:p.s;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();}
      else if(p.k==='dot'){c.beginPath();c.arc(0,0,p.s/2,0,7);c.fill();}
      else c.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);c.restore();});
    if(fxPs.length)requestAnimationFrame(fr);else{c.clearRect(0,0,cv.width,cv.height);fxRun=false;}})();
}
// شرر/نجوم من نقطة (الافتراضي: آخر لمسة)
function fxBurst(x,y,cols,n,kind){
  x=x==null?fxLast.x:x;y=y==null?fxLast.y:y;cols=cols||['#ffd400','#26890c','#ffffff','#1fd1a5'];n=n||28;fxCanvas();
  for(var i=0;i<n;i++){var a=Math.random()*Math.PI*2,v=3+Math.random()*7;fxPs.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,g:.18,s:5+Math.random()*8,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:cols[i%cols.length],life:40+Math.random()*25,k:kind||(i%3?'star':'dot')});}
  fxLoop();
}
// احتفال كامل: قصاصات من الأعلى وشرر من الجانبين
function fxParty(main){
  var W=innerWidth,cols=[main||'#e21b3c','#ffd400','#26890c','#1368ce','#ffffff','#864cbf'];fxCanvas();
  for(var i=0;i<220;i++)fxPs.push({x:Math.random()*W,y:-20-Math.random()*innerHeight*.5,vx:(Math.random()-.5)*3,vy:2+Math.random()*4,g:.06,s:6+Math.random()*8,r:Math.random()*6,vr:(Math.random()-.5)*.3,c:cols[i%cols.length],life:160+Math.random()*80,k:'rect'});
  fxBurst(W*.15,innerHeight*.75,cols,40);fxBurst(W*.85,innerHeight*.75,cols,40);
}
function fxFlash(kind){
  var st=document.getElementById('stage')||document.body,f=document.createElement('div');f.className='fx-flash '+kind;st.appendChild(f);setTimeout(function(){f.remove();},600);
  if(kind==='bad'){st.classList.remove('fx-shake');void st.offsetWidth;st.classList.add('fx-shake');setTimeout(function(){st.classList.remove('fx-shake');},500);}
}
// نص كبير يقفز في منتصف الشاشة («صح!»، «هدف!»…)
function fxText(t,color){
  var host=document.getElementById('stage')||document.body,el=document.createElement('div');el.className='fx-text';el.style.color=color||'#26890c';el.textContent=t;host.appendChild(el);setTimeout(function(){el.remove();},1200);
}
var FX_OK=['أحسنت!','ممتاز!','رائع!','صح!','عبقري!','إجابة موفّقة!'];
// كل الألعاب تستدعي beep: نحوّلها إلى صوت غني + أثر بصري يناسب الحدث
function juice(kind){
  if(kind==='ok'){sfx('ok');fxBurst();fxFlash('ok');}
  else if(kind==='bad'){sfx('bad');fxFlash('bad');}
  else if(kind==='win'){sfx('win');fxParty();}
  else if(kind==='tick'){sfx('tick');}
  else sfx(kind);
}
