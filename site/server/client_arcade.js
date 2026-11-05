// ========== ألعاب الحركة: مباراة كرة القدم · سباق الصواريخ · فرقعة البالونات ==========
// محرّك «اللوحات المتوازية»: كل لاعب له لوحة بسؤاله وأزراره (لمس متعدد على السبورة)، والإجابة الصحيحة
// تحرّك عنصره في المشهد. الخطأ يجمّده لحظة. ثلاث صحيحة متتالية = حركة مضاعفة.
var ARC_C=['#e21b3c','#1368ce','#d89e00','#26890c'];
var ARC_KEYS=[['7','8','9','0'],['1','2','3','4']];
function arcPanels(n,names){
  var h='';for(var i=0;i<n;i++)h+='<section class="tug-p arc-p arc-p'+i+'" id="arP'+i+'" style="--tc:'+ARC_C[i]+'"><header><b>'+esc(names[i])+'</b><span class="tug-st" id="arSt'+i+'"></span></header><div class="tug-q" id="arQ'+i+'" dir="auto"></div><div class="tug-ch" id="arC'+i+'"></div><div class="tug-ice" id="arI'+i+'" hidden>❄️<span>تجمّد!</span></div></section>';
  return h;
}
// يُنشئ اللاعبين ويربط الأزرار ولوحة المفاتيح. يرجع {P, start(), stop()}
function arcEngine(n,o){
  var keys=n===2?ARC_KEYS:null,run=false,P=[];
  var base=tugDeck();
  for(var i=0;i<n;i++){var off=Math.floor(base.length*i/n);P.push({i:i,deck:base.slice(off).concat(base.slice(0,off)),k:0,q:null,lock:true,streak:0,right:0,wrong:0});}
  var stat=function(p){var s=$('arSt'+p.i);if(s)s.innerHTML='✅ '+p.right+(p.streak>=2?' <span class="tug-fire">🔥'+p.streak+'</span>':'');};
  var show=function(p){
    if(!run)return;if(p.k>=p.deck.length){p.deck=shuffle(p.deck);p.k=0;}
    var x=mixMcq(p.deck[p.k++]);p.q=x;p.lock=false;
    $('arQ'+p.i).innerHTML=(x.img?'<img src="'+esc(x.img)+'" alt="">':'')+rich(x.stem);
    $('arC'+p.i).innerHTML=x.choices.map(function(c,ci){return '<button type="button" class="tug-b" data-c="'+ci+'">'+(keys?'<kbd>'+keys[p.i][ci]+'</kbd>':'')+'<span dir="auto">'+rich(c)+'</span></button>';}).join('');
    Array.prototype.forEach.call($('arC'+p.i).querySelectorAll('.tug-b'),function(b){b.addEventListener('pointerdown',function(e){e.preventDefault();answer(p,+b.getAttribute('data-c'));});b.onclick=function(e){if(e.detail===0)answer(p,+b.getAttribute('data-c'));};});
    var el=$('arP'+p.i);el.classList.remove('in');void el.offsetWidth;el.classList.add('in');
  };
  var popText=function(i,t){var el=document.createElement('div');el.className='tug-pop';el.style.color=ARC_C[i];el.textContent=t;$('arP'+i).appendChild(el);setTimeout(function(){el.remove();},1300);};
  var answer=function(p,ci){
    if(!run||p.lock||!p.q)return;p.lock=true;
    var bs=$('arC'+p.i).querySelectorAll('.tug-b'),ok=ci===p.q.correct;
    bs[ci].classList.add(ok?'ok':'no');
    if(ok){p.right++;p.streak++;sfx('ok');var r=bs[ci].getBoundingClientRect();fxBurst(r.left+r.width/2,r.top+r.height/2,[ARC_C[p.i],'#ffd400','#fff'],16);
      var steps=p.streak%3===0?2:1;if(steps===2){sfx('fire');popText(p.i,'🔥 مضاعفة!');}
      stat(p);var cont=o.onRight(p,steps);if(cont!==false)setTimeout(function(){show(p);},380);}
    else{p.wrong++;p.streak=0;stat(p);sfx('bad');bs[p.q.correct].classList.add('ok');o.onWrong&&o.onWrong(p);
      var el=$('arP'+p.i);el.classList.add('shake');setTimeout(function(){el.classList.remove('shake');},450);
      setTimeout(function(){if(!run)return;$('arI'+p.i).hidden=false;sfx('freeze');setTimeout(function(){if(!run)return;$('arI'+p.i).hidden=true;show(p);},1000);},650);}
  };
  var keyH=function(e){if(!run||!keys)return;for(var i=0;i<2;i++){var ci=keys[i].indexOf(e.key);if(ci>=0&&P[i].q&&ci<P[i].q.choices.length){e.preventDefault();answer(P[i],ci);}}};
  document.addEventListener('keydown',keyH);stopFns.push(function(){document.removeEventListener('keydown',keyH);run=false;});
  P.forEach(stat);
  return {P:P,start:function(){run=true;P.forEach(show);},stop:function(){run=false;P.forEach(function(p){p.lock=true;});},resume:function(){run=true;P.forEach(function(p){p.lock=false;});},show:show,popText:popText};
}
// عدّ تنازلي مشترك على عنصر طبقة
function arcCount(el,done,go){
  var n=3;el.className='tug-cd on';
  var step=function(){if(!document.body.contains(el))return;
    if(n>0){el.innerHTML='<span class="tug-n">'+n+'</span>';sfx('count');n--;setTimeout(step,800);}
    else{el.innerHTML='<span class="tug-n go">'+(go||'انطلق!')+'</span>';sfx('go');setTimeout(function(){if(!document.body.contains(el))return;el.className='tug-cd';el.innerHTML='';done();},650);}};
  setTimeout(step,250);
}
function arcResult(el,title,color,icon,rows,btns){
  el.innerHTML='<div class="tug-res"><div class="tug-trophy">'+icon+'</div><h2 style="color:'+(color||'')+'">'+title+'</h2><div class="tug-sums">'+rows+'</div><div class="tug-again">'+btns+'</div></div>';
  el.className='tug-cd on res';
}
function arcSum(p,name,extra){return '<div class="tug-sum" style="--tc:'+ARC_C[p.i]+'"><b>'+esc(name)+'</b>'+(extra||'')+'<span>✅ '+p.right+' صحيحة</span><span>❌ '+p.wrong+' خاطئة</span></div>';}
function arcNames(n){var out=[],def=['الأحمر','الأزرق','الأصفر','الأخضر'];for(var i=0;i<n;i++)out.push(teams[i]?teams[i].name:'الفريق '+def[i]);return out;}
function arcSetup(g,o){
  // o: {icon,title,desc,hero,min,max,opts:[{id,label,options:[[v,t]],def}],start(names,cfg)}
  var n=+(lsGet('arc_n_'+g.id)||o.min);if(n<o.min||n>o.max)n=o.min;
  var draw=function(){
    var names=arcNames(n);
    var h='<div class="g-setup tug-setup"><div class="tug-hero arc-hero">'+o.hero+'</div><h3>'+o.icon+' '+esc(o.title)+'</h3><p class="muted">'+o.desc+'</p>'+
      (o.max>o.min?'<div class="arc-n">عدد اللاعبين: '+[2,3,4].filter(function(k){return k>=o.min&&k<=o.max;}).map(function(k){return '<button type="button" class="btn small'+(k===n?' primary':'')+'" data-n="'+k+'">'+k+'</button>';}).join('')+'</div>':'')+
      '<div class="tug-names arc-names">'+names.map(function(nm,i){return '<label style="--tc:'+ARC_C[i]+'">اللاعب '+(i+1)+'<input id="arN'+i+'" value="'+esc(nm)+'" maxlength="24"></label>';}).join('')+'</div>'+
      '<div class="tug-opts">'+o.opts.map(function(op){var v=lsGet('arc_'+g.id+'_'+op.id);if(v==null)v=op.def;return '<label>'+op.label+' <select id="arO_'+op.id+'">'+op.options.map(function(x){return '<option value="'+x[0]+'"'+(String(x[0])===String(v)?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></label>';}).join('')+'</div>'+
      '<button type="button" class="btn primary go-btn" id="arGo">'+o.go+'</button>'+(n===2&&o.keys!==false?'<p class="muted small">⌨️ لوحة المفاتيح: اللاعب الأيمن 7 8 9 0 · اللاعب الأيسر 1 2 3 4</p>':'')+'</div>';
    $('gmain').innerHTML=stage(g.name,h);bindStage();
    Array.prototype.forEach.call(document.querySelectorAll('[data-n]'),function(b){b.onclick=function(){n=+b.getAttribute('data-n');lsSet('arc_n_'+g.id,n);draw();};});
    $('arGo').onclick=function(){
      var nm=[],cfg={};for(var i=0;i<n;i++){nm.push($('arN'+i).value.trim()||names[i]);if(teams[i])teams[i].name=nm[i];}saveTeams();
      o.opts.forEach(function(op){cfg[op.id]=+$('arO_'+op.id).value;lsSet('arc_'+g.id+'_'+op.id,cfg[op.id]);});
      o.start(nm,cfg);
    };
  };
  draw();
}

// ---------- ⚽ مباراة كرة القدم ----------
// لاعب كرة كرتوني بجانب جانبي: رأس وشعر وعين، قميص برقم، ذراعان وساقان تتأرجحان أثناء الجري،
// والساق الأمامية تركل. يُرسم متجهًا لليسار ويُعكس للفريق الآخر.
function ballToon(id,x,color,num,face){
  var skin=id==='blPR'?'#e7b48a':'#f1c9a5',dark='#1d2733',sh=tugShade(color);
  return '<g transform="translate('+x+' 236) scale('+(face<0?1:-1)+' 1) scale(1.25)"><g id="'+id+'" class="bl-pl">'+
    '<ellipse cx="0" cy="2" rx="22" ry="5" fill="#000" opacity=".22"/>'+
    '<g class="bl-run">'+
      '<g class="bl-leg2"><path d="M4 -40 L8 -20 L12 -3" fill="none" stroke="'+skin+'" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 -40 L6 -30" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M7 -9 L12 -3" stroke="'+sh+'" stroke-width="8" stroke-linecap="round"/><path d="M8 -4 h10 a4 4 0 0 1 0 6 h-12z" fill="'+dark+'"/></g>'+
      '<path d="M8 -70 L18 -58 L14 -46" fill="none" stroke="'+skin+'" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" class="bl-arm2"/>'+
      '<path d="M-12 -74 C-12 -84 12 -84 12 -74 L10 -44 L-10 -44 Z" fill="'+color+'" stroke="'+sh+'" stroke-width="2"/>'+
      '<text x="0" y="-52" font-size="15" fill="#fff" text-anchor="middle" font-weight="900" transform="scale('+(face<0?1:-1)+' 1)" style="font-family:sans-serif">'+num+'</text>'+
      '<rect x="-11" y="-46" width="22" height="9" rx="3" fill="#f4f6fb" stroke="'+sh+'" stroke-width="1.5"/>'+
      '<g class="bl-leg"><path d="M-4 -40 L-10 -21 L-14 -4" fill="none" stroke="'+skin+'" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M-4 -40 L-6 -30" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M-11 -10 L-14 -4" stroke="'+color+'" stroke-width="8" stroke-linecap="round"/><path d="M-12 -5 h-10 a4 4 0 0 0 0 6 h12z" fill="'+dark+'"/></g>'+
      '<path d="M-6 -70 L-16 -58 L-22 -50" fill="none" stroke="'+skin+'" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" class="bl-arm"/>'+
      '<path d="M-6 -70 L-11 -64" stroke="'+color+'" stroke-width="8" stroke-linecap="round"/>'+
      '<circle cx="0" cy="-92" r="13" fill="'+skin+'" stroke="'+dark+'" stroke-width="1.8"/>'+
      '<path d="M-13 -94 C-13 -110 13 -110 13 -92 C8 -100 -4 -100 -9 -94 Z" fill="'+dark+'"/>'+
      '<ellipse cx="-6" cy="-92" rx="3.4" ry="3.8" fill="#fff"/><circle cx="-7" cy="-91.5" r="2" fill="'+dark+'"/>'+
      '<path d="M-10 -84 q4 3 7 0" stroke="'+dark+'" stroke-width="1.8" fill="none" stroke-linecap="round"/>'+
      '<circle cx="3" cy="-86" r="3" fill="#ff8a8a" opacity=".45"/>'+
    '</g></g></g>';
}
function ballScene(){
  var r=ARC_C[0],b=ARC_C[1],stripes='';for(var i=0;i<10;i++)stripes+='<rect x="'+(i*80)+'" y="0" width="80" height="360" fill="'+(i%2?'#3fa34d':'#47b257')+'"/>';
  return '<svg class="arc-svg" viewBox="0 0 800 360" preserveAspectRatio="xMidYMid meet" role="img" aria-label="ملعب كرة القدم">'+stripes+
    '<rect width="800" height="360" fill="url(#blVig)"/><defs><radialGradient id="blVig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient></defs>'+
    '<g fill="none" stroke="#fff" stroke-width="4" opacity=".9"><rect x="30" y="20" width="740" height="320" rx="4"/><line x1="400" y1="20" x2="400" y2="340"/><circle cx="400" cy="180" r="55"/><rect x="30" y="100" width="90" height="160"/><rect x="680" y="100" width="90" height="160"/><path d="M120 150 a32 32 0 0 1 0 60"/><path d="M680 150 a32 32 0 0 0 0 60"/></g>'+
    '<circle cx="400" cy="180" r="5" fill="#fff"/>'+
    '<g id="bgL" class="bl-goal"><rect x="4" y="120" width="30" height="120" fill="#fff" opacity=".3"/><path d="M8 125l22 22M8 145l22 22M8 165l22 22M8 185l22 22M8 205l22 22M30 125l-22 22M30 145l-22 22M30 165l-22 22M30 185l-22 22M30 205l-22 22" stroke="#fff" stroke-width="1.3" opacity=".7"/><path d="M34 120H4V240H34" stroke="#fff" stroke-width="7" fill="none" stroke-linejoin="round"/></g>'+
    '<g id="bgR" class="bl-goal"><rect x="766" y="120" width="30" height="120" fill="#fff" opacity=".3"/><path d="M770 125l22 22M770 145l22 22M770 165l22 22M770 185l22 22M770 205l22 22M792 125l-22 22M792 145l-22 22M792 165l-22 22M792 185l-22 22M792 205l-22 22" stroke="#fff" stroke-width="1.3" opacity=".7"/><path d="M766 120H796V240H766" stroke="#fff" stroke-width="7" fill="none" stroke-linejoin="round"/></g>'+
    '<g id="blMove" class="bl-move">'+
      ballToon('blPR',466,r,10,-1)+ballToon('blPB',334,b,7,1)+
      '<g class="bl-ball-wrap"><ellipse cx="400" cy="238" rx="13" ry="4" fill="#000" opacity=".25"/><g id="blBall" class="bl-ball"><circle cx="400" cy="222" r="14" fill="#fff" stroke="#24323a" stroke-width="2"/><path d="M400 214l7 5-3 8h-8l-3-8z" fill="#24323a"/><path d="M393 210l-4-4M407 210l4-4M389 226l-5 2M411 226l5 2M400 232v4" stroke="#24323a" stroke-width="2"/></g></g>'+
    '</g></svg>';
}
function gBall(g){
  arcSetup(g,{icon:'⚽',title:'مباراة كرة القدم',hero:ballScene(),min:2,max:2,go:'صافرة البداية ⚽',
    desc:'فريقان على شاشة واحدة. كل إجابة صحيحة تدحرج الكرة نحو مرمى الخصم، وعند وصولها: هدددف! الخطأ يجمّد لاعبك لحظة. الفائز صاحب الأهداف الأكثر عند نهاية الوقت.',
    opts:[{id:'len',label:'طول الملعب',def:4,options:[[3,'قصير'],[4,'عادي'],[6,'طويل']]},{id:'time',label:'وقت المباراة',def:180,options:[[120,'دقيقتان'],[180,'3 دقائق'],[300,'5 دقائق'],[0,'أول من يسجّل 3']]}],
    start:function(names,cfg){ballPlay(g,names,cfg);}});
}
function ballPlay(g,names,cfg){
  stopAll();tugCtx();
  var N=cfg.len,pos=0,goals=[0,0],over=false,paused=true;
  var h='<div class="tug arc-ball" id="arc">'+arcPanels(2,names).replace('</section>','</section><div class="tug-mid"><div class="bl-board"><span class="bl-t" style="--tc:'+ARC_C[0]+'">'+esc(names[0])+'</span><b id="blS0">0</b><span class="bl-sep">-</span><b id="blS1">0</b><span class="bl-t" style="--tc:'+ARC_C[1]+'">'+esc(names[1])+'</span></div>'+(cfg.time?'<div class="tug-top"><span class="tug-time" id="tgTime">'+cfg.time+'</span></div>':'<div class="tug-top muted small">أول من يسجّل 3 أهداف</div>')+ballScene()+'<div class="tug-crowd" aria-hidden="true"><span>📣</span><span>🙌</span><span>🥁</span><span>👏</span><span>📣</span><span>🎺</span></div></div>')+'<canvas class="tug-fx" id="tgFx"></canvas><div class="tug-cd" id="tgCd"></div></div>';
  $('gBody').innerHTML=h;$('gScore').innerHTML='';arena(true);
  var mv=$('blMove'),ball=$('blBall');
  var place=function(){mv.style.transform='translateX('+(-pos/N*330)+'px)';};
  var E=arcEngine(2,{
    onRight:function(p,steps){
      if(over||paused)return false;
      pos=Math.max(-N,Math.min(N,pos+(p.i===0?1:-1)*steps));
      var pl=$(p.i===0?'blPR':'blPB');pl.classList.remove('kick');void pl.getBoundingClientRect();pl.classList.add('kick');
      ball.classList.remove('roll-l','roll-r');void ball.getBoundingClientRect();ball.classList.add(p.i===0?'roll-l':'roll-r');
      sfx('kickball');place();
      if(Math.abs(pos)>=N){goal(p.i);return false;}
    }
  });
  var goal=function(w){
    paused=true;E.stop();goals[w]++;$('blS'+w).textContent=goals[w];
    var net=$(w===0?'bgL':'bgR');net.classList.add('shake');setTimeout(function(){net.classList.remove('shake');},900);
    sfx('goal');fxParty(ARC_C[w]);
    var cd=$('tgCd');cd.className='tug-cd on';cd.innerHTML='<div class="bl-goaltxt" style="color:'+ARC_C[w]+'">⚽ هدددف!<small>'+esc(names[w])+'</small></div>';
    if(!cfg.time&&goals[w]>=3){setTimeout(function(){finish();},1800);return;}
    setTimeout(function(){if(over||!$('tgCd'))return;pos=0;place();sfx('whistle');cd.className='tug-cd';cd.innerHTML='';paused=false;E.resume();E.P.forEach(function(p){E.show(p);});},2200);
  };
  var finish=function(){
    if(over)return;over=true;paused=true;E.stop();clearTimeout(beatT);sfx('whistle');
    var w=goals[0]===goals[1]?-1:(goals[0]>goals[1]?0:1);
    setTimeout(function(){
      if(w>=0){sfx('win');fxParty(ARC_C[w]);track('ball_win',names[w]);}else sfx('tie');
      arcResult($('tgCd'),w<0?'تعادل '+goals[0]+' - '+goals[1]:esc(names[w])+' يفوز '+Math.max(goals[0],goals[1])+' - '+Math.min(goals[0],goals[1]),w<0?'':ARC_C[w],w<0?'🤝':'🏆',
        arcSum(E.P[0],names[0],'<span>⚽ '+goals[0]+'</span>')+arcSum(E.P[1],names[1],'<span>⚽ '+goals[1]+'</span>'),
        '<button type="button" class="btn primary" id="arAgain">🔁 مباراة جديدة</button><button type="button" class="btn" id="arSwap">⇄ تبديل الجهتين</button><button type="button" class="btn" id="arSet">⚙️ الإعدادات</button>');
      $('arAgain').onclick=function(){ballPlay(g,names,cfg);};$('arSwap').onclick=function(){ballPlay(g,[names[1],names[0]],cfg);};$('arSet').onclick=function(){gBall(g);};
    },700);
  };
  var beatT=null,beat=function(){if(over)return;if(!paused)sfx('kick');beatT=setTimeout(beat,560-Math.abs(pos)/N*250);};stopFns.push(function(){clearTimeout(beatT);});
  place();
  arcCount($('tgCd'),function(){sfx('whistle');paused=false;E.start();beat();if(cfg.time)runTimer2(cfg.time,finish);},'صافرة!');
}

// ---------- 🚀 سباق الصواريخ ----------
function rocketSvg(c,i){
  return '<g class="rk" id="rk'+i+'"><g class="rk-body">'+
    '<path d="M0 -46 C14 -30 16 -6 14 18 L-14 18 C-16 -6 -14 -30 0 -46Z" fill="#f4f6fb" stroke="#24323a" stroke-width="2.5"/>'+
    '<path d="M0 -46 C8 -38 11 -30 12 -24 L-12 -24 C-11 -30 -8 -38 0 -46Z" fill="'+c+'"/>'+
    '<circle cx="0" cy="-8" r="7" fill="#7fd3ff" stroke="#24323a" stroke-width="2.5"/>'+
    '<path d="M-14 4 L-26 24 L-14 18Z M14 4 L26 24 L14 18Z" fill="'+c+'" stroke="#24323a" stroke-width="2"/>'+
    '<g class="rk-flame"><path d="M-9 20 Q0 52 9 20Z" fill="#ffb000"/><path d="M-5 20 Q0 38 5 20Z" fill="#fff3a0"/></g></g></g>';
}
function rocketScene(n,W){
  var w=W||800,h=420,stars='';for(var i=0;i<70;i++)stars+='<circle class="st" cx="'+Math.round(Math.random()*w)+'" cy="'+Math.round(Math.random()*h*.85)+'" r="'+(Math.random()*1.8+.4).toFixed(1)+'" style="animation-delay:'+(Math.random()*3).toFixed(2)+'s"/>';
  var lanes='',rk='';for(var j=0;j<n;j++){var x=Math.round(w*(j+.5)/n);lanes+='<line x1="'+x+'" y1="70" x2="'+x+'" y2="'+(h-40)+'" stroke="'+ARC_C[j]+'" stroke-width="2" stroke-dasharray="3 9" opacity=".55"/>';rk+='<g transform="translate('+x+' 0)"><g class="rk-move" id="rkm'+j+'" style="transform:translateY('+(h-60)+'px)"><g transform="scale(1.6)">'+rocketSvg(ARC_C[j],j)+'</g></g></g>';}
  return '<svg class="arc-svg rk-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="سباق الصواريخ نحو القمر">'+
    '<defs><radialGradient id="rkSky" cx=".5" cy="0" r="1.1"><stop offset="0" stop-color="#2b2f6b"/><stop offset=".6" stop-color="#0d1033"/><stop offset="1" stop-color="#05061a"/></radialGradient></defs>'+
    '<rect width="'+w+'" height="'+h+'" fill="url(#rkSky)"/><g fill="#fff">'+stars+'</g>'+
    '<g class="rk-moon"><circle cx="'+(w/2)+'" cy="-150" r="200" fill="#f3efd9"/><circle cx="'+(w/2-90)+'" cy="20" r="18" fill="#ddd6b8"/><circle cx="'+(w/2+70)+'" cy="30" r="12" fill="#ddd6b8"/><circle cx="'+(w/2+10)+'" cy="8" r="9" fill="#ddd6b8"/></g>'+
    '<text x="'+(w-60)+'" y="120" font-size="34">🪐</text><text x="40" y="200" font-size="26">🛰️</text>'+
    lanes+'<rect y="'+(h-34)+'" width="'+w+'" height="34" fill="#3b4254"/><rect y="'+(h-34)+'" width="'+w+'" height="4" fill="#ffd400" opacity=".7"/>'+rk+'</svg>';
}
function gRocket(g){
  arcSetup(g,{icon:'🚀',title:'سباق الصواريخ',hero:rocketScene(3),min:2,max:4,go:'أطلقوا الصواريخ 🚀',
    desc:'من 2 إلى 4 لاعبين، لكل لاعب صاروخ ولوحة أسئلة. كل إجابة صحيحة تدفع صاروخك نحو القمر 🌕، والخطأ يُطفئ المحرك لحظة. أول صاروخ يصل القمر يفوز!',
    opts:[{id:'len',label:'المسافة إلى القمر',def:8,options:[[6,'قريبة'],[8,'عادية'],[11,'بعيدة']]}],
    start:function(names,cfg){rocketPlay(g,names,cfg);}});
}
function rocketPlay(g,names,cfg){
  stopAll();tugCtx();
  var n=names.length,N=cfg.len,H=420,hgt=[],over=false;for(var i=0;i<n;i++)hgt.push(0);
  var h='<div class="arc-rk" id="arc"><div class="rk-top">'+rocketScene(n)+'</div><div class="rk-panels rk-n'+n+'">'+arcPanels(n,names)+'</div><canvas class="tug-fx" id="tgFx"></canvas><div class="tug-cd" id="tgCd"></div></div>';
  $('gBody').innerHTML=h;$('gScore').innerHTML='';arena(true);
  // المشهد بعرض الساحة كله (بدل شريط ضيق بحواف سوداء)
  var tb=document.querySelector('.rk-top').getBoundingClientRect();if(tb.width>300&&tb.height>150)document.querySelector('.rk-top').innerHTML=rocketScene(n,Math.max(800,Math.round(420*tb.width/tb.height)));
  var y=function(k){return (H-60)-k/N*(H-140);};
  var move=function(i){var m=$('rkm'+i);m.style.transform='translateY('+y(hgt[i])+'px)';};
  var E=arcEngine(n,{
    onRight:function(p,steps){
      if(over)return false;hgt[p.i]=Math.min(N,hgt[p.i]+steps);move(p.i);
      var r=$('rk'+p.i);r.classList.remove('boost');void r.getBoundingClientRect();r.classList.add('boost');sfx('launch');
      if(hgt[p.i]>=N){win(p.i);return false;}
    },
    onWrong:function(p){var r=$('rk'+p.i);r.classList.remove('sput');void r.getBoundingClientRect();r.classList.add('sput');if(hgt[p.i]>0&&cfg.len>=11){hgt[p.i]--;move(p.i);}}
  });
  var win=function(w){
    over=true;E.stop();sfx('boom');setTimeout(function(){sfx('win');},350);
    var svg=document.querySelector('.rk-svg'),r=svg.getBoundingClientRect();
    for(var k=0;k<5;k++)(function(k){setTimeout(function(){fxBurst(r.left+r.width*(.2+Math.random()*.6),r.top+r.height*(.1+Math.random()*.3),[ARC_C[w],'#ffd400','#fff','#7fd3ff'],40);sfx('pop');},k*260);})(k);
    fxParty(ARC_C[w]);track('rocket_win',names[w]);
    var order=E.P.slice().sort(function(a,b){return hgt[b.i]-hgt[a.i]||b.right-a.right;});
    var medal=['🥇','🥈','🥉','🎖️'];
    setTimeout(function(){
      arcResult($('tgCd'),esc(names[w])+' وصل القمر أولًا!',ARC_C[w],'🚀🌕',order.map(function(p,k){return arcSum(p,medal[k]+' '+names[p.i]);}).join(''),
        '<button type="button" class="btn primary" id="arAgain">🔁 سباق جديد</button><button type="button" class="btn" id="arSet">⚙️ الإعدادات</button>');
      $('arAgain').onclick=function(){rocketPlay(g,names,cfg);};$('arSet').onclick=function(){gRocket(g);};
    },1500);
  };
  arcCount($('tgCd'),function(){sfx('launch');E.start();},'إطلاق!');
}

// ---------- 🎈 فرقعة البالونات ----------
function gBalloon(g){
  var h='<div class="g-setup tug-setup"><div class="tug-hero bn-hero">'+[0,1,2,3].map(function(i){return '<span class="bn bn-demo" style="--bc:'+['#ff4d6d','#4dabf7','#ffd43b','#51cf66'][i]+';left:'+(12+i*22)+'%;animation-delay:'+(i*.5)+'s"><i></i></span>';}).join('')+'</div>'+
    '<h3>🎈 فرقعة البالونات</h3><p class="muted">لعبة للفصل كله بالفرق (من القائمة الجانبية). يظهر السؤال، وتطير البالونات بالخيارات: فرقِع البالون الصحيح قبل أن يهرب! الأسرع يكسب نقاطًا أكثر، والخطأ ينقل الدور.</p>'+
    '<div class="tug-opts"><label>عدد الأسئلة <select id="bnN"><option>8</option><option selected>12</option><option>16</option></select></label><label>الوقت لكل سؤال <select id="bnT"><option value="15">15 ثانية</option><option value="20" selected>20 ثانية</option><option value="30">30 ثانية</option></select></label></div>'+
    '<button type="button" class="btn primary go-btn" id="bnGo">ابدأ الفرقعة 🎈</button></div>';
  $('gmain').innerHTML=stage(g.name,h);bindStage();
  $('bnGo').onclick=function(){balloonPlay(g,+$('bnN').value,+$('bnT').value);};
}
function balloonPlay(g,count,secs){
  stopAll();tugCtx();resetScores();
  var qs=tugDeck().slice(0,count),qi=-1,turn=0,timer=null,locked=false;
  var BC=['#ff4d6d','#4dabf7','#ffd43b','#51cf66','#b197fc'];
  arena(true);$('gBody').innerHTML='<div class="bn-wrap" id="bnWrap"><div class="bn-head"><span class="bn-turn" id="bnTurn"></span><span class="bn-qn" id="bnQn"></span>'+timerHtml('bnT')+'</div><div class="bn-q" id="bnQ" dir="auto"></div><div class="bn-sky" id="bnSky"><div class="bn-cloud c1">☁️</div><div class="bn-cloud c2">☁️</div><div class="bn-cloud c3">☁️</div></div><div class="tug-cd" id="tgCd"></div></div>';
  renderScore(false);
  var setTurn=function(){$('bnTurn').innerHTML='الدور: <b style="color:'+TEAM_COLORS[turn]+'">'+esc(teams[turn].name)+'</b>';$('bnTurn').style.setProperty('--tc',TEAM_COLORS[turn]);};
  var next=function(){
    if(timer)timer.stop();qi++;locked=false;
    if(qi>=qs.length){endScreen(g,gBalloon);return;}
    var x=mixMcq(qs[qi]);
    $('bnQn').textContent='سؤال '+(qi+1)+' من '+qs.length;setTurn();
    var qel=$('bnQ');qel.innerHTML=rich(x.stem);qel.classList.remove('in');void qel.offsetWidth;qel.classList.add('in');
    var sky=$('bnSky');Array.prototype.forEach.call(sky.querySelectorAll('.bn'),function(b){b.remove();});
    var cols=shuffle(BC);
    x.choices.forEach(function(c,ci){
      var b=document.createElement('button');b.type='button';b.className='bn';
      b.style.setProperty('--bc',cols[ci]);b.style.left=(6+ci*(88/x.choices.length))+'%';
      b.style.animationDuration=(secs*.75+Math.random()*3).toFixed(1)+'s, '+(2.2+Math.random()).toFixed(1)+'s';
      b.style.animationDelay=(ci*.35)+'s, 0s';
      b.innerHTML='<i></i><span dir="auto">'+rich(c)+'</span>';
      b.addEventListener('pointerdown',function(e){e.preventDefault();hit(b,ci===x.correct,x);});
      sky.appendChild(b);
    });
    timer=runTimer('bnT',secs,function(){if(locked)return;locked=true;sfx('swoosh');reveal(x);toast('انتهى الوقت ⏰');turn=(turn+1)%teams.length;setTimeout(next,1800);});
  };
  var reveal=function(x){Array.prototype.forEach.call($('bnSky').querySelectorAll('.bn'),function(b,i){if(i===x.correct)b.classList.add('good');else b.classList.add('fade');});};
  var hit=function(b,ok,x){
    if(locked||b.classList.contains('popped'))return;
    var r=b.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,col=getComputedStyle(b).getPropertyValue('--bc');
    if(ok){locked=true;timer.stop();b.classList.add('popped');sfx('pop');setTimeout(function(){sfx('coin');},120);fxBurst(cx,cy,[col,'#ffd400','#fff'],36);
      var left=+($('bnTT')?$('bnTT').textContent:0)||0,pts=left>=secs*.66?3:left>=secs*.33?2:1;
      teams[turn].score+=pts;renderScore(false);fxText('+'+pts+' '+FX_OK[Math.floor(Math.random()*FX_OK.length)],TEAM_COLORS[turn]);
      reveal(x);setTimeout(next,1500);}
    else{b.classList.add('popped','bad');sfx('boom');fxBurst(cx,cy,['#555','#888','#333'],22,'dot');fxFlash('bad');
      turn=(turn+1)%teams.length;setTurn();toast('خطأ! الدور ينتقل إلى '+teams[turn].name);}
  };
  arcCount($('tgCd'),next,'فرقِعوا!');
}
