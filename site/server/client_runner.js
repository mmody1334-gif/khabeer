// ========== 🏃 العدّاء (على طريقة Subway Surfers) ==========
// العدّاء يجري في ثلاثة مسارات ويجمع العملات. عند اقتراب حاجز يتباطأ الزمن ويظهر سؤال بثلاثة خيارات:
// ⬅️ يسار · ⬆️ قفز · ➡️ يمين. الطريق الآمن هو اتجاه الإجابة الصحيحة (الحاجز الأوسط منخفض يُقفز فوقه،
// والجانبيان مفتوحان أو مسدودان). الإجابة الخاطئة = اصطدام وخسارة قلب. الفرق تتناوب الجولات.
function gRunner(g){
  var h='<div class="g-setup tug-setup"><div class="tug-hero rn-hero"><canvas id="rnDemo" width="760" height="300"></canvas></div><h3>🏃 العدّاء</h3>'+
    '<p class="muted">العدّاء يجري ويجمع العملات 🪙. عندما يقترب حاجز يتباطأ الزمن ويظهر سؤال: لكل إجابة اتجاه (⬅️ يسار · ⬆️ قفز · ➡️ يمين). اختر الصحيحة ليتفادى الخطر، والخطأ = اصطدام 💥 وخسارة قلب. الفرق تتناوب: كل فريق جولة حتى تنفد قلوبه أو تنتهي أسئلته.</p>'+
    '<div class="tug-opts"><label>أسئلة كل جولة <select id="rnQ"><option>6</option><option selected>8</option><option>12</option></select></label><label>القلوب <select id="rnL"><option>2</option><option selected>3</option><option>5</option></select></label><label>المشهد <select id="rnS"><option value="city">🏙️ المدينة</option><option value="desert">🏜️ الصحراء العُمانية</option><option value="space">🌌 الفضاء</option></select></label></div>'+
    '<button type="button" class="btn primary go-btn" id="rnGo">ابدأ الجري 🏃</button><p class="muted small">⌨️ الأسهم: ← يسار · ↑ قفز · → يمين (أو المس الإجابة)</p></div>';
  $('gmain').innerHTML=stage(g.name,h);bindStage();
  var sc=lsGet('rn_scene');if(sc)$('rnS').value=sc;
  var demo=runnerWorld($('rnDemo'),{scene:$('rnS').value,demo:true});demo.start();
  $('rnS').onchange=function(){demo.setScene(this.value);};
  $('rnGo').onclick=function(){demo.stop();lsSet('rn_scene',$('rnS').value);resetScores();runnerPlay(g,{q:+$('rnQ').value,lives:+$('rnL').value,scene:$('rnS').value},0);};
}
// العالم: طريق منظوري بثلاثة مسارات على canvas، عدّاء، عملات، حواجز، ديكور جانبي
var RN_SCENES={
  city:{sky:['#7ec8ff','#d9f1ff'],ground:'#6b7a8f',road:'#3d4452',line:'#ffd400',side:['#9aa7b8','#b4c0cf','#7f8da1'],deco:'build'},
  desert:{sky:['#ffb36b','#ffe3b0'],ground:'#e8c27a',road:'#c99a55',line:'#fff3d6',side:['#d9a65a','#e7b86c','#c58f45'],deco:'palm'},
  space:{sky:['#0d1033','#2b2f6b'],ground:'#1a1d3d',road:'#2c3166',line:'#7fd3ff',side:['#3b3f7a','#504a9a','#2d2a60'],deco:'crystal'}
};
function runnerWorld(cv,o){
  var c=cv.getContext('2d'),W=cv.width,H=cv.height,S=RN_SCENES[o.scene]||RN_SCENES.city;
  var HZ=H*.36,GY=H*.98,CX=W/2,RW=Math.min(W*.44,H*.95);
  var t=0,speed=o.demo?1:1,dist=0,run=false,raf=0,slow=1,objs=[],decos=[],lane=0,laneX=0,jumpT=0,crash=0,coinsGot=0,onCoin=null,shake=0;
  var U=H/460,proj=function(z,lx){var s=1/(1+z*4.2);return {x:CX+lx*RW*s,y:HZ+(GY-HZ)*s,s:s*U};};
  for(var i=0;i<14;i++)decos.push({z:i/14,side:i%2?1:-1,k:Math.random()});
  var spawnCoins=function(){var l=Math.floor(Math.random()*3)-1;for(var i=0;i<5;i++)objs.push({t:'coin',z:1+i*.06,l:l});};
  var coinTimer=0;
  function drawSky(){var gr=c.createLinearGradient(0,0,0,HZ);gr.addColorStop(0,S.sky[0]);gr.addColorStop(1,S.sky[1]);c.fillStyle=gr;c.fillRect(0,0,W,HZ+2);
    if(o.scene==='space'){c.fillStyle='#fff';for(var i=0;i<40;i++){var x=(i*97.3)%W,y=(i*53.7)%HZ;c.globalAlpha=.4+.6*Math.abs(Math.sin(t*.03+i));c.fillRect(x,y,2*U,2*U);}c.globalAlpha=1;c.fillStyle='#f3efd9';c.beginPath();c.arc(W*.8,HZ*.4,26*U,0,7);c.fill();}
    else{c.fillStyle=o.scene==='desert'?'#fff2a8':'#fffbe0';c.beginPath();c.arc(W*.82,HZ*.42,(o.scene==='desert'?30:22)*U,0,7);c.fill();
      c.fillStyle='rgba(255,255,255,.85)';[[.15,.3],[.45,.2],[.65,.38]].forEach(function(p,i){var x=((p[0]*W+t*.15*(i+1))%(W+120))-60;c.beginPath();c.ellipse(x,p[1]*HZ,40*U,12*U,0,0,7);c.ellipse(x+25*U,p[1]*HZ-6*U,26*U,10*U,0,0,7);c.fill();});}}
  function drawGround(){c.fillStyle=S.ground;c.fillRect(0,HZ,W,H-HZ);
    var a=proj(1,-1.5),b=proj(1,1.5),d=proj(0,1.5),e=proj(0,-1.5);c.fillStyle=S.road;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineTo(d.x,d.y);c.lineTo(e.x,e.y);c.fill();
    // خطوط المسارات المتقطعة المتحركة
    c.strokeStyle=S.line;for(var L=-.5;L<=.5;L+=1){for(var k=0;k<14;k++){var z0=((k/14)-(dist*.6%1)/14+1)%1,z1=z0+.025;var p0=proj(z0,L),p1=proj(z1,L);c.lineWidth=Math.max(1,5*p0.s);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();}}
    c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=3;[-1.5,1.5].forEach(function(L){var p0=proj(1,L),p1=proj(0,L);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();});}
  function drawDeco(d){var p=proj(d.z,d.side*2.3),s=p.s;
    if(S.deco==='build'){var h=(90+d.k*120)*s,w=70*s;c.fillStyle=S.side[Math.floor(d.k*3)];c.fillRect(p.x-w/2,p.y-h,w,h);c.fillStyle='rgba(255,255,200,.75)';for(var r=0;r<4;r++)for(var q=0;q<2;q++)c.fillRect(p.x-w/2+w*(.2+q*.4),p.y-h+h*(.12+r*.21),w*.2,h*.1);}
    else if(S.deco==='palm'){c.strokeStyle='#8a5a24';c.lineWidth=8*s;c.beginPath();c.moveTo(p.x,p.y);c.quadraticCurveTo(p.x+10*s*d.side,p.y-60*s,p.x,p.y-110*s);c.stroke();c.fillStyle='#2f9e44';for(var a=0;a<5;a++){c.beginPath();c.ellipse(p.x+Math.cos(a*1.25)*30*s,p.y-110*s+Math.sin(a*1.25)*8*s,34*s,9*s,a*1.25,0,7);c.fill();}}
    else{c.fillStyle=S.side[Math.floor(d.k*3)];c.beginPath();c.moveTo(p.x,p.y-120*s*(.6+d.k));c.lineTo(p.x+22*s,p.y);c.lineTo(p.x-22*s,p.y);c.fill();c.fillStyle='rgba(127,211,255,.5)';c.beginPath();c.moveTo(p.x,p.y-120*s*(.6+d.k));c.lineTo(p.x+8*s,p.y);c.lineTo(p.x-4*s,p.y);c.fill();}}
  function drawObj(ob){var p=proj(ob.z,ob.l),s=p.s;
    if(ob.t==='coin'){if(ob.got)return;var w=Math.abs(Math.sin(t*.12+ob.z*9));c.fillStyle='#ffd400';c.strokeStyle='#c98a1e';c.lineWidth=3*s;c.beginPath();c.ellipse(p.x,p.y-40*s,14*s*Math.max(.15,w),14*s,0,0,7);c.fill();c.stroke();return;}
    if(ob.t==='low'){c.fillStyle='#e21b3c';c.fillRect(p.x-60*s,p.y-38*s,120*s,14*s);c.fillStyle='#fff';for(var i=0;i<4;i++)c.fillRect(p.x-60*s+i*30*s+6*s,p.y-38*s,12*s,14*s);c.fillStyle='#555';c.fillRect(p.x-56*s,p.y-24*s,8*s,24*s);c.fillRect(p.x+48*s,p.y-24*s,8*s,24*s);return;}
    if(ob.t==='wall'){ // قطار/جدار عالٍ
      var w=124*s,h=150*s;c.fillStyle=o.scene==='desert'?'#b5651d':(o.scene==='space'?'#6741d9':'#1368ce');c.fillRect(p.x-w/2,p.y-h,w,h);c.fillStyle='rgba(255,255,255,.85)';c.fillRect(p.x-w*.38,p.y-h*.82,w*.76,h*.3);c.fillStyle='#ffd400';c.fillRect(p.x-w*.4,p.y-h*.2,w*.18,h*.08);c.fillRect(p.x+w*.22,p.y-h*.2,w*.18,h*.08);c.fillStyle='#24323a';c.fillRect(p.x-w/2,p.y-6*s,w,6*s);}}
  // العدّاء من الخلف (كما في Subway Surfers): شعر وأذنان، قميص بلون الفريق ورقمه على الظهر،
  // ذراعان تتأرجحان على الجانبين، وساقان بحذاءين يرتفع كل منهما بالتناوب مع ظهور النعل.
  function rr(x,y,w,h,r){c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);}
  function limb(x1,y1,x2,y2,x3,y3,w,col){c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x3,y3);c.stroke();}
  function drawRunner(){
    var p=proj(.02,laneX),s=p.s*1.7,jy=jumpT>0?Math.sin(Math.PI*(1-jumpT))*95*s:0,run=(slow>.5?1:.35)*(crash>0?0:1),ph=t*.32*run,y=p.y-jy;
    var col=o.color||'#e21b3c',skin='#e9b98f',shorts='#24324f',shoe='#1d2733';
    c.save();c.translate(p.x,y);
    // ظل على الأرض (يصغر أثناء القفز)
    c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(0,jy,(28-jy/s*.08)*s,8*s,0,0,7);c.fill();
    if(crash>0){c.rotate((1-crash)*1.3*(laneX>=0?1:-1));}
    var lean=(lane-laneX)*.25;c.rotate(lean);
    var air=jumpT>0;
    // الساقان: الرافعة تقصر (القدم أعلى) وتظهر نعلها
    [[-1,ph],[1,ph+Math.PI]].forEach(function(L){
      var sd=L[0],up=air?.6:Math.max(0,Math.sin(L[1])),fy=-up*22*s,ky=-26*s-up*10*s;
      limb(sd*8*s,-50*s,sd*10*s,ky,sd*9*s,fy-6*s,10*s,skin);
      c.strokeStyle=shorts;c.lineWidth=12*s;c.beginPath();c.moveTo(sd*8*s,-52*s);c.lineTo(sd*9*s,-40*s);c.stroke();
      c.fillStyle=shoe;rr(sd*9*s-8*s,fy-10*s,16*s,12*s,5*s);c.fill();
      if(up>.25){c.fillStyle='#f4f6fb';rr(sd*9*s-7*s,fy-1*s,14*s,4*s,2*s);c.fill();}
      c.fillStyle='#fff';c.fillRect(sd*9*s-8*s,fy-12*s,16*s,3*s);
    });
    // الشورت والقميص
    c.fillStyle=shorts;rr(-17*s,-58*s,34*s,16*s,6*s);c.fill();
    var g=c.createLinearGradient(-18*s,0,18*s,0);g.addColorStop(0,col);g.addColorStop(.5,col);g.addColorStop(1,'rgba(0,0,0,.25)');
    c.fillStyle=col;rr(-18*s,-100*s,36*s,48*s,12*s);c.fill();c.fillStyle=g;c.fill();
    c.fillStyle='rgba(255,255,255,.9)';c.font='900 '+Math.round(19*s)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(o.num||10),0,-74*s);
    c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=3*s;c.beginPath();c.moveTo(-18*s,-93*s);c.lineTo(18*s,-93*s);c.stroke();
    // الذراعان على الجانبين تتأرجحان عكس الساقين
    [[-1,ph+Math.PI],[1,ph]].forEach(function(A){var sd=A[0],sw=air?-1:Math.sin(A[1]),hx=sd*25*s,hy=-66*s-sw*10*s;
      limb(sd*16*s,-94*s,sd*24*s,-80*s-sw*4*s,hx,hy,8*s,skin);c.strokeStyle=col;c.lineWidth=10*s;c.beginPath();c.moveTo(sd*16*s,-95*s);c.lineTo(sd*20*s,-87*s);c.stroke();
      c.fillStyle=skin;c.beginPath();c.arc(hx,hy,4.5*s,0,7);c.fill();});
    // الرأس من الخلف: رقبة، أذنان، شعر، وقبعة بلون الفريق
    c.fillStyle=skin;rr(-5*s,-108*s,10*s,10*s,3*s);c.fill();
    c.beginPath();c.arc(-14*s,-118*s,4*s,0,7);c.arc(14*s,-118*s,4*s,0,7);c.fill();
    c.fillStyle='#2a1d14';c.beginPath();c.arc(0,-120*s,14.5*s,0,7);c.fill();
    c.fillStyle=col;c.beginPath();c.arc(0,-124*s,15*s,Math.PI,0);c.fill();c.fillRect(-15*s,-125*s,30*s,4*s);
    c.fillStyle='rgba(255,255,255,.5)';c.beginPath();c.arc(-5*s,-131*s,4*s,0,7);c.fill();
    c.restore();
  }
  function frame(){
    t++;var sp=speed*slow*(crash>0?0:1);dist+=.012*sp;
    if(!o.demo||true){coinTimer-=sp;if(coinTimer<=0&&!o.paused){spawnCoins();coinTimer=90+Math.random()*80;}}
    objs.forEach(function(ob){ob.z-=.0105*sp;});
    decos.forEach(function(d){d.z-=.0105*sp;if(d.z<0){d.z+=1;d.k=Math.random();}});
    // جمع العملات في مسار العدّاء
    objs.forEach(function(ob){if(ob.t==='coin'&&!ob.got&&ob.z<.04&&ob.z>-.02&&Math.abs(ob.l-laneX)<.5&&jumpT<=.3){ob.got=true;coinsGot++;onCoin&&onCoin();}});
    objs=objs.filter(function(ob){return ob.z>-.08;});
    laneX+=(lane-laneX)*.22;if(jumpT>0)jumpT=Math.max(0,jumpT-.028*Math.max(.35,slow));if(crash>0)crash=Math.max(0,crash-.02);
    c.save();if(shake>0){c.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.88;if(shake<.5)shake=0;}
    drawSky();drawGround();
    decos.slice().sort(function(a,b){return b.z-a.z;}).forEach(drawDeco);
    objs.slice().sort(function(a,b){return b.z-a.z;}).forEach(function(ob){if(ob.z>=.02)drawObj(ob);});
    drawRunner();
    objs.forEach(function(ob){if(ob.z<.02)drawObj(ob);});
    if(slow<.6){c.fillStyle='rgba(13,16,51,'+((.6-slow)*.35)+')';c.fillRect(0,0,W,H);}
    c.restore();
    if(o.demo&&t%140===0)lane=[-1,0,1][Math.floor(Math.random()*3)],(Math.random()<.4&&(jumpT=1));
    if(run)raf=requestAnimationFrame(frame);
  }
  return {
    start:function(){if(run)return;run=true;raf=requestAnimationFrame(frame);stopFns.push(function(){run=false;cancelAnimationFrame(raf);});},
    stop:function(){run=false;cancelAnimationFrame(raf);},
    setScene:function(k){o.scene=k;S=RN_SCENES[k]||S;},
    // حاجز: safe = الاتجاه الآمن (-1 يسار، 0 قفز، 1 يمين)
    obstacle:function(safe){objs=objs.filter(function(x){return x.t==='coin';});[-1,0,1].forEach(function(l){if(l===safe&&l!==0)return;objs.push({t:l===0?(safe===0?'low':'wall'):'wall',z:1,l:l,ob:1});});},
    nearestObstacle:function(){var m=null;objs.forEach(function(x){if(x.ob&&(m==null||x.z<m))m=x.z;});return m;},
    clearObstacles:function(){objs=objs.filter(function(x){return !x.ob;});},
    setSlow:function(v){slow=v;},
    move:function(d){if(d===0)jumpT=1;else lane=d;},
    center:function(){lane=0;},
    crash:function(){crash=1;shake=18;},
    setSpeed:function(v){speed=v;},
    coins:function(){return coinsGot;},
    onCoin:function(f){onCoin=f;},
    get dist(){return dist;}
  };
}
function runnerPlay(g,cfg,ti){
  stopAll();tugCtx();
  var team=teams[ti],qs=tugDeck(),qi=0,lives=cfg.lives,score=0,asked=0,state='run',W;
  var DIRS=[{d:-1,ic:'⬅️',k:'ArrowLeft',t:'يسار'},{d:0,ic:'⬆️',k:'ArrowUp',t:'قفز'},{d:1,ic:'➡️',k:'ArrowRight',t:'يمين'}];
  $('gBody').innerHTML='<div class="rn" id="rn"><div class="rn-hud"><span class="rn-team" style="--tc:'+TEAM_COLORS[ti]+'">🏃 '+esc(team.name)+'</span><span class="rn-lives" id="rnLives"></span><span class="rn-sc">⭐ <b id="rnScore">0</b></span><span class="rn-coins">🪙 <b id="rnCoins">0</b></span><span class="rn-qn" id="rnQn"></span></div>'+
    '<div class="rn-view"><canvas id="rnCv" width="960" height="460"></canvas><div class="rn-q" id="rnQ" hidden><div class="rn-qt" id="rnQt" dir="auto"></div><div class="rn-ch" id="rnCh"></div><div class="rn-bar"><i id="rnBar"></i></div></div><div class="tug-cd" id="tgCd"></div></div></div>';
  renderScore(false);arena(true);
  var cv=$('rnCv'),bx=cv.parentNode.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
  if(bx.width>200&&bx.height>200){cv.width=Math.round(bx.width*dpr);cv.height=Math.round(bx.height*dpr);}
  W=runnerWorld(cv,{scene:cfg.scene,color:TEAM_COLORS[ti],num:ti+1});
  var hud=function(){$('rnLives').textContent='❤️'.repeat(lives)+'🖤'.repeat(Math.max(0,cfg.lives-lives));$('rnScore').textContent=score;$('rnCoins').textContent=W.coins();$('rnQn').textContent='حاجز '+Math.min(asked+1,cfg.q)+' / '+cfg.q;};
  W.onCoin(function(){score+=5;sfx('coin');hud();});
  var tick=setInterval(function(){if(state==='run'){score+=1;$('rnScore').textContent=score;}},250);stopFns.push(function(){clearInterval(tick);});
  var next=null,qTimer=null,cur=null;
  var schedule=function(){next=setTimeout(spawn,2600+Math.random()*1500);};stopFns.push(function(){clearTimeout(next);clearTimeout(qTimer);});
  var spawn=function(){
    if(state!=='run')return;
    if(qi>=qs.length){qs=shuffle(qs);qi=0;}
    var x=mixMcq(qs[qi++]);
    // ثلاثة خيارات: الصحيحة + خطأان
    var wrong=x.choices.map(function(c,i){return i;}).filter(function(i){return i!==x.correct;});wrong=shuffle(wrong).slice(0,2);
    var three=shuffle([x.correct].concat(wrong));
    cur={x:x,map:three.map(function(ci,k){return {ci:ci,dir:DIRS[k]};})};
    cur.safe=cur.map.filter(function(m){return m.ci===x.correct;})[0].dir.d;
    W.obstacle(cur.safe);state='approach';sfx('swoosh');
  };
  // مراقبة اقتراب الحاجز: يتباطأ الزمن ويظهر السؤال
  var watch=setInterval(function(){
    if(state==='approach'){var z=W.nearestObstacle();if(z!=null&&z<.55){state='ask';W.setSlow(.015);ask();}}
  },40);stopFns.push(function(){clearInterval(watch);});
  var ask=function(){
    var q=$('rnQ');$('rnQt').innerHTML=rich(cur.x.stem);
    $('rnCh').innerHTML=cur.map.map(function(m,k){return '<button type="button" class="rn-b" data-k="'+k+'"><span class="rn-ic">'+m.dir.ic+'</span><span class="rn-t" dir="auto">'+rich(cur.x.choices[m.ci])+'</span><small>'+m.dir.t+'</small></button>';}).join('');
    Array.prototype.forEach.call($('rnCh').querySelectorAll('.rn-b'),function(b){b.addEventListener('pointerdown',function(e){e.preventDefault();choose(+b.getAttribute('data-k'));});});
    q.hidden=false;q.classList.remove('in');void q.offsetWidth;q.classList.add('in');sfx('freeze');
    var secs=gnum()>=10?18:15,bar=$('rnBar'),t0=Date.now();bar.style.transition='none';bar.style.width='100%';void bar.offsetWidth;bar.style.transition='width '+secs+'s linear';bar.style.width='0%';
    qTimer=setTimeout(function(){if(state==='ask')choose(-1);},secs*1000);
  };
  var choose=function(k){
    if(state!=='ask')return;state='act';clearTimeout(qTimer);
    var ok=k>=0&&cur.map[k].ci===cur.x.correct,bs=$('rnCh').querySelectorAll('.rn-b');
    if(k>=0)bs[k].classList.add(ok?'ok':'no');
    cur.map.forEach(function(m,j){if(m.ci===cur.x.correct)bs[j].classList.add('ok');});
    asked++;
    setTimeout(function(){
      $('rnQ').hidden=true;W.setSlow(1);
      // الحركة تُنفَّذ لحظة وصول الحاجز تقريبًا، والاصطدام عند ملامسته
      var moved=false,iv=setInterval(function(){
        var z=W.nearestObstacle();
        if(!moved&&(z==null||z<.2)){moved=true;if(k>=0)W.move(cur.map[k].dir.d);if(ok)sfx('swoosh');}
        if(ok&&(z==null||z<-.02)){clearInterval(iv);sfx('ok');score+=50;fxText('+50 '+FX_OK[Math.floor(Math.random()*FX_OK.length)],TEAM_COLORS[ti]);var r=$('rnCv').getBoundingClientRect();fxBurst(r.left+r.width/2,r.top+r.height*.75,[TEAM_COLORS[ti],'#ffd400','#fff'],30);hud();
          setTimeout(function(){W.clearObstacles();W.center();after();},500);}
        if(!ok&&(z==null||z<.05)){clearInterval(iv);W.crash();sfx('boom');fxFlash('bad');lives--;hud();fxText('💥 اصطدام!','#e21b3c');
          setTimeout(function(){W.clearObstacles();W.center();after();},1500);}
      },30);stopFns.push(function(){clearInterval(iv);});
    },ok?350:900);
  };
  var after=function(){
    if(lives<=0||asked>=cfg.q){endRun();return;}
    state='run';hud();schedule();
  };
  var keyH=function(e){if(state!=='ask')return;var k=DIRS.map(function(d){return d.k;}).indexOf(e.key);if(k>=0){e.preventDefault();choose(k);}};
  document.addEventListener('keydown',keyH);stopFns.push(function(){document.removeEventListener('keydown',keyH);});
  var endRun=function(){
    state='end';W.setSlow(.15);team.score+=score;renderScore(false);
    var last=ti>=teams.length-1;
    if(lives>0)sfx('win');else sfx('tie');
    arcResult($('tgCd'),esc(team.name)+': '+score+' نقطة',TEAM_COLORS[ti],lives>0?'🏁':'💥',
      '<div class="tug-sum" style="--tc:'+TEAM_COLORS[ti]+'"><span>🚧 حواجز: '+asked+'</span><span>🪙 عملات: '+W.coins()+'</span><span>❤️ قلوب متبقية: '+lives+'</span></div>',
      last?'<button type="button" class="btn primary" id="rnEnd">🏆 النتيجة النهائية</button>':'<button type="button" class="btn primary" id="rnNext">▶ دور '+esc(teams[ti+1].name)+'</button>');
    if(last)$('rnEnd').onclick=function(){endScreen(g,gRunner);};
    else $('rnNext').onclick=function(){runnerPlay(g,cfg,ti+1);};
  };
  hud();W.start();
  arcCount($('tgCd'),function(){schedule();},'اجرِ!');
}
