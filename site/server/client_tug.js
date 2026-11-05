// ========== شدّ الحبل ==========
// لاعبان على شاشة واحدة (السبورة أو الآيباد): لكل لاعب أسئلته وأزراره. الإجابة الصحيحة تشدّ الحبل
// خطوة نحوه، والخطأ يجمّده لحظة. ثلاث إجابات صحيحة متتالية = «شدّة مضاعفة». يفوز من يسحب الراية لخطّه.
// الأصوات مولَّدة بـ WebAudio (بلا ملفات)، والمشهد SVG متحرّك، والاحتفال قصاصات ملوّنة على canvas.
var TUG_C=['#e21b3c','#1368ce'];
// شخصية كرتونية تشدّ الحبل. تُرسم في إحداثيات محلية (القدمان عند 0,0 والوجه نحو اليسار حيث الحبل)،
// ثم تُعكس أفقيًا للفريق الأيسر. المجموعة الداخلية .tf هي التي تتحرك (ميلان/شدّ/سقوط/قفز)
// حتى لا يلغي تحويلُ CSS موضعَ الشخصية.
function tugToon(color,i,hair){
  var skin=['#f1c9a5','#d9a37a','#c68a5c'][i%3],pants='#2b3a55',dark='#1d2733',sh=tugShade(color);
  return '<g class="tf tf'+i+'">'+
    '<ellipse cx="4" cy="2" rx="40" ry="7" fill="#000" opacity=".18"/>'+
    // الساق الخلفية (ممدودة للخلف) والأمامية (مثنية مرتكزة)
    '<path d="M10 -64 L26 -34 L38 -4" fill="none" stroke="'+pants+'" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>'+
    '<path d="M4 -64 L-14 -36 L-24 -4" fill="none" stroke="#33466a" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>'+
    '<path d="M28 -6 h22 a6 6 0 0 1 0 9 h-24 z" fill="'+dark+'"/><path d="M-34 -6 h20 a6 6 0 0 1 0 9 h-22 a5 5 0 0 1 2 -9z" fill="'+dark+'"/>'+
    '<path d="M27 2 h23" stroke="#fff" stroke-width="2" opacity=".6"/><path d="M-35 2 h21" stroke="#fff" stroke-width="2" opacity=".6"/>'+
    // الذراع الخلفية
    '<path d="M26 -110 L-4 -100 L-36 -96" fill="none" stroke="'+sh+'" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>'+
    // الجذع مائل للخلف
    '<path d="M-6 -66 C-4 -90 8 -114 26 -122 L44 -112 C38 -96 26 -80 18 -62 Z" fill="'+color+'" stroke="'+sh+'" stroke-width="2.5" stroke-linejoin="round"/>'+
    '<path d="M2 -66 C6 -84 16 -102 32 -114" fill="none" stroke="#fff" stroke-width="4" opacity=".55"/>'+
    '<rect x="-8" y="-70" width="30" height="10" rx="5" fill="'+pants+'" transform="rotate(-18 7 -65)"/>'+
    // الرأس
    '<g transform="rotate(14 36 -138)">'+
      '<circle cx="36" cy="-138" r="19" fill="'+skin+'" stroke="'+dark+'" stroke-width="2"/>'+
      '<path d="'+(hair?'M17 -140 C17 -164 56 -166 56 -140 C50 -150 32 -152 24 -146 Z':'M16 -138 C14 -162 58 -164 56 -136 L50 -142 C40 -150 26 -150 20 -140 Z')+'" fill="'+dark+'"/>'+
      '<path d="M15 -141 C14 -151 30 -158 40 -154" fill="none" stroke="'+color+'" stroke-width="6" stroke-linecap="round"/>'+
      '<ellipse cx="26" cy="-139" rx="4.5" ry="5" fill="#fff"/><circle cx="24.5" cy="-138.5" r="2.6" fill="'+dark+'"/>'+
      '<path d="M20 -148 L30 -145" stroke="'+dark+'" stroke-width="2.6" stroke-linecap="round"/>'+
      '<path d="M20 -127 h9" stroke="'+dark+'" stroke-width="2.4" stroke-linecap="round"/><rect x="20.5" y="-129" width="8" height="3" rx="1" fill="#fff"/>'+
      '<circle cx="35" cy="-130" r="4" fill="#ff8a8a" opacity=".45"/>'+
      '<circle cx="44" cy="-137" r="4" fill="'+skin+'" stroke="'+dark+'" stroke-width="1.5"/>'+
    '</g>'+
    // الذراع الأمامية واليدان على الحبل
    '<path d="M30 -112 L2 -104 L-30 -98" fill="none" stroke="'+color+'" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>'+
    '<path d="M2 -104 L-30 -98" fill="none" stroke="'+skin+'" stroke-width="10" stroke-linecap="round"/>'+
    '<circle cx="-34" cy="-97" r="7" fill="'+skin+'" stroke="'+dark+'" stroke-width="1.8"/><circle cx="-42" cy="-96" r="6.5" fill="'+skin+'" stroke="'+dark+'" stroke-width="1.8"/>'+
  '</g>';
}
function tugShade(hex){var n=parseInt(hex.slice(1),16),r=(n>>16)*.68|0,g=((n>>8)&255)*.68|0,b=(n&255)*.68|0;return 'rgb('+r+','+g+','+b+')';}
function tugFigure(x,color,dir,i){
  // dir=1 فريق اليمين (وجهه لليسار نحو الحبل) · dir=-1 فريق اليسار (معكوس)
  return '<g transform="translate('+x+' 330) scale('+(dir>0?1:-1)+' 1) scale(1.08)" class="tfw">'+tugToon(color,i,i===1)+'</g>';
}
function tugScene(){
  var r=TUG_C[0],b=TUG_C[1],grass='';
  for(var k=0;k<46;k++){var gx=(k*37)%800,gy=338+((k*13)%40);grass+='<path d="M'+gx+' '+gy+' l3 -9 l3 9" stroke="#5aa64a" stroke-width="2" fill="none" opacity=".6"/>';}
  return '<svg class="tug-svg" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet" role="img" aria-label="ساحة شدّ الحبل">'+
    '<defs><linearGradient id="tgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd8ff"/><stop offset=".75" stop-color="#e6f6ff"/></linearGradient>'+
    '<linearGradient id="tgGr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd16f"/><stop offset="1" stop-color="#5fa94a"/></linearGradient>'+
    '<pattern id="tgRope" width="16" height="12" patternUnits="userSpaceOnUse"><rect width="16" height="12" fill="#d29b52"/><path d="M-2 12 L8 0 M6 12 L16 0" stroke="#9a6a2c" stroke-width="3.5"/></pattern></defs>'+
    '<rect width="800" height="400" fill="url(#tgSky)"/>'+
    '<g class="tg-cloud"><ellipse cx="140" cy="70" rx="48" ry="16" fill="#fff" opacity=".9"/><ellipse cx="170" cy="60" rx="30" ry="14" fill="#fff" opacity=".9"/></g>'+
    '<g class="tg-cloud c2"><ellipse cx="620" cy="50" rx="56" ry="17" fill="#fff" opacity=".85"/><ellipse cx="590" cy="42" rx="30" ry="13" fill="#fff" opacity=".85"/></g>'+
    '<circle cx="720" cy="80" r="28" fill="#ffe36e"/><circle cx="720" cy="80" r="40" fill="#ffe36e" opacity=".25"/>'+
    '<path d="M0 250 Q120 205 240 245 T480 238 T800 236 V330 H0Z" fill="#b7e39b" opacity=".7"/>'+
    '<rect y="326" width="800" height="74" fill="url(#tgGr)"/>'+grass+
    '<rect x="0" y="326" width="200" height="74" fill="'+b+'" opacity=".16"/><rect x="600" y="326" width="200" height="74" fill="'+r+'" opacity=".16"/>'+
    '<line x1="400" y1="120" x2="400" y2="400" stroke="#24323a" stroke-width="3" stroke-dasharray="9 9" opacity=".5"/>'+
    '<g><line x1="200" y1="150" x2="200" y2="400" stroke="'+b+'" stroke-width="5" stroke-dasharray="6 7"/><path d="M200 150 l30 10 l-30 10z" fill="'+b+'"/></g>'+
    '<g><line x1="600" y1="150" x2="600" y2="400" stroke="'+r+'" stroke-width="5" stroke-dasharray="6 7"/><path d="M600 150 l-30 10 l30 10z" fill="'+r+'"/></g>'+
    '<g id="tugMove" class="tug-move">'+
      '<rect x="150" y="223" width="500" height="13" rx="6.5" fill="url(#tgRope)" stroke="#7a5322" stroke-width="1.5"/>'+
      '<g id="tugB" class="tug-team b">'+tugFigure(258,b,-1,1)+tugFigure(330,b,-1,0)+'</g>'+
      '<g id="tugR" class="tug-team r">'+tugFigure(542,r,1,1)+tugFigure(470,r,1,0)+'</g>'+
      '<g class="tug-flag"><line x1="400" y1="229" x2="400" y2="282" stroke="#24323a" stroke-width="3"/><path d="M400 236 L434 249 L400 262 Z" fill="#ffd400" stroke="#24323a" stroke-width="2"/><circle cx="400" cy="229" r="8" fill="#ffd400" stroke="#24323a" stroke-width="2"/></g>'+
      '<g id="tugDust"></g>'+
    '</g></svg>';
}
function gTug(g){
  var names=[teams[0]?teams[0].name:'الفريق الأحمر',teams[1]?teams[1].name:'الفريق الأزرق'];
  var cfg={target:+(lsGet('tug_target')||5),time:+(lsGet('tug_time')||90),beat:lsGet('tug_beat')!==false};
  var h='<div class="g-setup tug-setup"><div class="tug-hero">'+tugScene()+'</div><h3>🪢 شدّ الحبل</h3>'+
    '<p class="muted">لاعبان (أو فريقان) على شاشة واحدة. كل جهة لها أسئلتها: الإجابة الصحيحة تشدّ الحبل نحوك، والخطأ يجمّدك لحظة. ثلاث إجابات صحيحة متتالية = 🔥 شدّة مضاعفة!</p>'+
    '<div class="tug-names"><label style="--tc:'+TUG_C[0]+'">🟥 اللاعب الأيمن<input id="tgN1" value="'+esc(names[0])+'" maxlength="24"></label><label style="--tc:'+TUG_C[1]+'">🟦 اللاعب الأيسر<input id="tgN2" value="'+esc(names[1])+'" maxlength="24"></label></div>'+
    '<div class="tug-opts"><label>طول الحبل <select id="tgT"><option value="4">قصير (سريع)</option><option value="5">عادي</option><option value="7">طويل</option><option value="9">طويل جدًا</option></select></label>'+
    '<label>الوقت <select id="tgS"><option value="60">دقيقة</option><option value="90">دقيقة ونصف</option><option value="120">دقيقتان</option><option value="180">3 دقائق</option><option value="0">بلا وقت</option></select></label>'+
    '<label class="tug-chk"><input type="checkbox" id="tgB"'+(cfg.beat?' checked':'')+'> طبول الحماس 🥁</label></div>'+
    '<button type="button" class="btn primary go-btn" id="tgGo">ابدأ النزال 🪢</button>'+
    '<p class="muted small">⌨️ على لوحة المفاتيح: اللاعب الأيمن 7 8 9 0 · اللاعب الأيسر 1 2 3 4</p></div>';
  $('gmain').innerHTML=stage(g.name,h);bindStage();
  $('tgT').value=String(cfg.target);$('tgS').value=String(cfg.time);
  $('tgGo').onclick=function(){
    names=[$('tgN1').value.trim()||'الأحمر',$('tgN2').value.trim()||'الأزرق'];
    if(teams[0])teams[0].name=names[0];if(teams[1])teams[1].name=names[1];saveTeams();
    cfg.target=+$('tgT').value;cfg.time=+$('tgS').value;cfg.beat=$('tgB').checked;
    lsSet('tug_target',cfg.target);lsSet('tug_time',cfg.time);lsSet('tug_beat',cfg.beat);
    tugPlay(g,names,cfg);
  };
}
function tugDeck(){
  var all=mcqPool(),short=all.filter(function(x){return String(x.stem).length<=230&&!x.table&&x.choices.every(function(c){return String(c).length<=80;});});
  return shuffle(short.length>=6?short:all);
}
function tugPlay(g,names,cfg){
  stopAll();tugCtx();
  var N=cfg.target,pos=0,over=false,started=false,P=[0,1].map(function(i){return {i:i,deck:tugDeck(),k:0,q:null,lock:true,streak:0,right:0,wrong:0,pulls:0};});
  // ترتيب مختلف للاعبين حتى لا يظهر السؤال نفسه للاثنين في الوقت نفسه
  P[1].deck=P[1].deck.slice(Math.floor(P[1].deck.length/2)).concat(P[1].deck.slice(0,Math.floor(P[1].deck.length/2)));
  var keys=[['7','8','9','0'],['1','2','3','4']];
  var panel=function(i){return '<section class="tug-p tug-p'+i+'" id="tgP'+i+'" style="--tc:'+TUG_C[i]+'"><header><b>'+esc(names[i])+'</b><span class="tug-st" id="tgSt'+i+'"></span></header><div class="tug-q" id="tgQ'+i+'" dir="auto"></div><div class="tug-ch" id="tgC'+i+'"></div><div class="tug-ice" id="tgI'+i+'" hidden>❄️<span>تجمّد!</span></div></section>';};
  var h='<div class="tug" id="tug">'+panel(0)+
    '<div class="tug-mid"><div class="tug-top"><span class="tug-lead" id="tgLead">⚖️ تعادل</span>'+(cfg.time?'<span class="tug-time" id="tgTime">'+cfg.time+'</span>':'')+'</div>'+tugScene()+
    '<div class="tug-crowd" aria-hidden="true"><span>📣</span><span>🙌</span><span>🎉</span><span>👏</span><span>📣</span><span>🙌</span></div>'+
    '<div class="tug-meter"><span style="--tc:'+TUG_C[0]+'"></span><i id="tgMeter"></i><span style="--tc:'+TUG_C[1]+'"></span></div></div>'+
    panel(1)+'<canvas class="tug-fx" id="tgFx"></canvas><div class="tug-cd" id="tgCd"></div></div>';
  $('gBody').innerHTML=h;$('gScore').innerHTML='';arena(true);
  var mv=$('tugMove');
  var setPos=function(){
    var f=pos/N;mv.style.transform='translateX('+(f*200)+'px)';
    $('tgMeter').style.insetInlineStart=(50-f*46)+'%';
    $('tgLead').textContent=pos===0?'⚖️ تعادل':(pos>0?'💪 '+names[0]+' متقدّم':'💪 '+names[1]+' متقدّم');
    $('tgLead').style.color=pos===0?'':TUG_C[pos>0?0:1];
  };
  var stat=function(p){var s=$('tgSt'+p.i);if(s)s.innerHTML='✅ '+p.right+(p.streak>=2?' <span class="tug-fire">🔥'+p.streak+'</span>':'');};
  var show=function(p){
    if(p.k>=p.deck.length){p.deck=shuffle(p.deck);p.k=0;}
    var x=mixMcq(p.deck[p.k++]);p.q=x;p.lock=false;
    $('tgQ'+p.i).innerHTML=(x.img?'<img src="'+esc(x.img)+'" alt="">':'')+rich(x.stem);
    $('tgC'+p.i).innerHTML=x.choices.map(function(c,ci){return '<button type="button" class="tug-b" data-p="'+p.i+'" data-c="'+ci+'"><kbd>'+keys[p.i][ci]+'</kbd><span dir="auto">'+rich(c)+'</span></button>';}).join('');
    Array.prototype.forEach.call($('tgC'+p.i).querySelectorAll('.tug-b'),function(b){b.addEventListener('pointerdown',function(e){e.preventDefault();answer(p,+b.getAttribute('data-c'));});b.onclick=function(e){if(e.detail===0)answer(p,+b.getAttribute('data-c'));};});
    var el=$('tgP'+p.i);el.classList.remove('in');void el.offsetWidth;el.classList.add('in');
  };
  var dust=function(dir){var d=$('tugDust');if(!d)return;var x=dir>0?580:220,h2='';for(var i=0;i<6;i++)h2+='<circle class="tug-puff" cx="'+(x+(Math.random()*60-30))+'" cy="'+(326-Math.random()*10)+'" r="'+(5+Math.random()*7)+'" style="--dx:'+((Math.random()*40-20)*dir)+'px;animation-delay:'+(i*25)+'ms"/>';d.innerHTML=h2;};
  var pull=function(p,steps){
    var dir=p.i===0?1:-1;pos=Math.max(-N,Math.min(N,pos+dir*steps));p.pulls+=steps;
    var tm=$(p.i===0?'tugR':'tugB');tm.classList.remove('heave');void tm.getBoundingClientRect();tm.classList.add('heave');
    mv.classList.remove('jerk');void mv.getBoundingClientRect();mv.classList.add('jerk');
    dust(dir);sfx('pull');setPos();
    if(Math.abs(pos)>=N)finish(pos>0?0:1);
  };
  var answer=function(p,ci){
    if(over||!started||p.lock)return;p.lock=true;
    var bs=$('tgC'+p.i).querySelectorAll('.tug-b'),ok=ci===p.q.correct;
    bs[ci].classList.add(ok?'ok':'no');
    if(ok){
      p.right++;p.streak++;sfx('ok');
      var steps=p.streak>0&&p.streak%3===0?2:1;
      if(steps===2){sfx('fire');popText(p.i,'🔥 شدّة مضاعفة!');}
      stat(p);pull(p,steps);
      if(!over)setTimeout(function(){if(!over)show(p);},380);
    }else{
      p.wrong++;p.streak=0;stat(p);sfx('bad');bs[p.q.correct].classList.add('ok');
      var el=$('tgP'+p.i);el.classList.add('shake');setTimeout(function(){el.classList.remove('shake');},450);
      setTimeout(function(){if(over)return;$('tgI'+p.i).hidden=false;sfx('freeze');
        setTimeout(function(){if(over)return;$('tgI'+p.i).hidden=true;show(p);},1100);},700);
    }
  };
  var popText=function(i,t){var el=document.createElement('div');el.className='tug-pop';el.style.color=TUG_C[i];el.textContent=t;$('tgP'+i).appendChild(el);setTimeout(function(){el.remove();},1300);};
  var keyH=function(e){if(over||!started)return;var k=e.key;for(var i=0;i<2;i++){var ci=keys[i].indexOf(k);if(ci>=0&&P[i].q&&ci<P[i].q.choices.length){e.preventDefault();answer(P[i],ci);}}};
  document.addEventListener('keydown',keyH);stopFns.push(function(){document.removeEventListener('keydown',keyH);});
  // طبول الحماس: تتسارع كلما اقترب الحبل من أحد الخطّين
  var beatT=null,beat=function(){if(over)return;if(cfg.beat&&started)sfx('kick');var near=Math.abs(pos)/N;beatT=setTimeout(beat,620-near*330);};
  stopFns.push(function(){clearTimeout(beatT);});
  var timer=null;
  var finish=function(w){
    if(over)return;over=true;clearTimeout(beatT);if(timer)timer.stop();
    P.forEach(function(p){p.lock=true;});
    var tie=w<0;
    if(!tie){var lt=$(w===0?'tugB':'tugR'),wt=$(w===0?'tugR':'tugB');lt.classList.add('fall');wt.classList.add('cheer');sfx('win');confetti($('tgFx'),TUG_C[w]);track('tug_win',names[w]);}
    else sfx('tie');
    var s=function(p){return '<div class="tug-sum" style="--tc:'+TUG_C[p.i]+'"><b>'+esc(names[p.i])+'</b><span>✅ '+p.right+' صحيحة</span><span>❌ '+p.wrong+' خاطئة</span></div>';};
    setTimeout(function(){
      var cd=$('tgCd');if(!cd)return;
      cd.innerHTML='<div class="tug-res">'+(tie?'<div class="tug-trophy">🤝</div><h2>تعادل!</h2>':'<div class="tug-trophy">🏆</div><h2 style="color:'+TUG_C[w]+'">'+esc(names[w])+' يفوز!</h2>')+
        '<div class="tug-sums">'+s(P[0])+s(P[1])+'</div><div class="tug-again"><button type="button" class="btn primary" id="tgAgain">🔁 جولة جديدة</button><button type="button" class="btn" id="tgSwap">⇄ تبديل الجهتين</button><button type="button" class="btn" id="tgSet">⚙️ الإعدادات</button></div></div>';
      cd.className='tug-cd on res';
      $('tgAgain').onclick=function(){tugPlay(g,names,cfg);};
      $('tgSwap').onclick=function(){tugPlay(g,[names[1],names[0]],cfg);};
      $('tgSet').onclick=function(){gTug(g);};
    },tie?300:1600);
  };
  setPos();stat(P[0]);stat(P[1]);
  // العدّ التنازلي 3، 2، 1، انطلق!
  var cd=$('tgCd'),n=3;cd.className='tug-cd on';
  var step=function(){
    if(!$('tgCd'))return;
    if(n>0){cd.innerHTML='<span class="tug-n">'+n+'</span>';sfx('count');n--;setTimeout(step,800);}
    else{cd.innerHTML='<span class="tug-n go">انطلق!</span>';sfx('go');setTimeout(function(){if(!$('tgCd'))return;cd.className='tug-cd';cd.innerHTML='';started=true;show(P[0]);show(P[1]);beat();
      if(cfg.time)timer=runTimer2(cfg.time,function(){finish(pos===0?-1:(pos>0?0:1));});},650);}
  };
  setTimeout(step,250);
}
function runTimer2(secs,onEnd){
  var end=Date.now()+secs*1000,last=-1,iv=setInterval(function(){var el=$('tgTime');if(!el){clearInterval(iv);return;}var s=Math.max(0,Math.ceil((end-Date.now())/1000));
    if(s!==last){el.textContent=Math.floor(s/60)+':'+('0'+s%60).slice(-2);el.classList.toggle('low',s<=10);if(s<=5&&s>0)sfx('count');last=s;}
    if(s<=0){clearInterval(iv);onEnd();}},200);
  var stop=function(){clearInterval(iv);};stopFns.push(stop);return {stop:stop};
}
