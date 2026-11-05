(function(){
'use strict';
guard();
var GRADE_NUM={'الأول':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
var me=null,courses=[],course=null,data={lessons:[],items:[]},lessonById={},sel={},game=null,stopFns=[];
var teams=null,sound=true;
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function gnum(){return course?(GRADE_NUM[course.grade]||9):9;}
function isEn(){return course&&/انجليز|إنجليز|English/i.test(course.subject);}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function clone(o){return JSON.parse(JSON.stringify(o));}
function rich(t){return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');}
function track(type,detail){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,grade:course&&course.grade,detail:detail||''})});}catch(e){}}
function stopAll(){stopFns.forEach(function(f){try{f();}catch(e){}});stopFns=[];}
function every(ms,fn){var id=setInterval(fn,ms);stopFns.push(function(){clearInterval(id);});return id;}
// ---------- صوت بسيط ----------
var actx=null;
function beep(kind){juice(kind);}
// @@FX@@

// ---------- مصادر الأسئلة ----------
function selIds(){var ids=data.lessons.map(function(l){return l.id;}).filter(function(id){return sel[id];});return ids.length?ids:[];}
// عدد الأسئلة **الصالحة للعب** لهذا الدرس (سؤال اختيار من متعدد بخيارين على الأقل).
// نستثني ما لا يُلعب، وإلا ظهرت لوحة فارغة («اختر الإجابة الصحيحة» بلا سؤال).
function playableItem(x){return (x.choices||[]).length>=2;}
function itemCount(id){return data.items.filter(function(x){return x.lesson_id===id&&playableItem(x);}).length;}
function pool(){var s={};selIds().forEach(function(i){s[i]=1;});return data.items.filter(function(x){return s[x.lesson_id]&&playableItem(x);});}
function mcqPool(){return pool().filter(function(x){return x.type==='mcq'&&x.choices&&x.choices.length>=2;});}
var DIFF={'منخفضة':1,'متوسطة':2,'مرتفعة':3};
function diff(x){return DIFF[x.difficulty]||(x.type==='long'?3:1);}
// مفردة اختيار من متعدد بترتيب بدائل جديد
function mixMcq(x){var c=x.choices.map(function(t,i){return {t:t,ok:i===x.correct};});c=shuffle(c);var y=clone(x);y.choices=c.map(function(z){return z.t;});y.correct=c.findIndex?c.findIndex(function(z){return z.ok;}):c.map(function(z){return z.ok;}).indexOf(true);return y;}
function answerText(x){return x.type==='mcq'?x.choices[x.correct]:(x.answer||'');}
function tableHtml(x){if(!x.table||!x.table.rows)return '';var h='<table class="g-table">'+(x.table.caption?'<caption>'+esc(x.table.caption)+'</caption>':'');x.table.rows.forEach(function(r,i){h+='<tr>'+r.map(function(c){return i?'<td>'+rich(c)+'</td>':'<th>'+rich(c)+'</th>';}).join('')+'</tr>';});return h+'</table>';}
function qHtml(x){return '<div class="g-stem" dir="auto">'+rich(x.stem)+'</div>'+tableHtml(x);}
var SHAPES=['▲','◆','●','■'];

// ---------- كتالوج الألعاب ----------
var GAMES=[
 {id:'live',icon:'📱',name:'تحدي مباشر بالجوالات',desc:'كل طالب يدخل من جواله بالرمز أو QR، يجاوب، وتظهر لوحة الصدارة على السبورة.',grades:[5,12],need:'mcq',min:4},
 {id:'tug',hot:1,icon:'🪢',name:'شدّ الحبل',desc:'لاعبان على شاشة واحدة: كل إجابة صحيحة تشدّ الحبل نحوك، والخطأ يجمّدك. ثلاث صحيحة متتالية = شدّة مضاعفة 🔥',grades:[5,12],best:[5,12],need:'mcq',min:6},
 {id:'runner',hot:1,icon:'🏃',name:'العدّاء',desc:'جرْي لا ينتهي على طريقة Subway Surfers: عند كل حاجز يتباطأ الزمن ويظهر سؤال، والإجابة الصحيحة تحدد الاتجاه الآمن ⬅️ ⬆️ ➡️. الخطأ = اصطدام!',grades:[5,12],best:[5,12],need:'mcq',min:6},
 {id:'ball',hot:1,icon:'⚽',name:'مباراة كرة القدم',desc:'فريقان على شاشة واحدة: كل إجابة صحيحة تدحرج الكرة نحو مرمى الخصم… هدددف! أكثر الفريقين أهدافًا يفوز.',grades:[5,12],best:[5,10],need:'mcq',min:6},
 {id:'rocket',hot:1,icon:'🚀',name:'سباق الصواريخ',desc:'من 2 إلى 4 لاعبين، كل إجابة صحيحة تدفع صاروخك نحو القمر. أول صاروخ يصل يفوز!',grades:[5,12],best:[5,12],need:'mcq',min:6},
 {id:'balloon',hot:1,icon:'🎈',name:'فرقعة البالونات',desc:'السؤال يظهر والبالونات تطير بالخيارات: فرقِع الصحيح قبل أن يهرب! الأسرع يكسب نقاطًا أكثر.',grades:[5,12],best:[5,9],need:'mcq',min:6},
 {id:'jeopardy',icon:'🏆',name:'تحدي الفرق',desc:'لوحة أسئلة بالدروس والدرجات (100–400). الأصعب بدرجة أعلى، والفرق تتنافس.',grades:[5,12],best:[9,12],need:'any',min:6},
 {id:'millionaire',icon:'💰',name:'سلّم المليون',desc:'10 أسئلة تتدرج من السهل للصعب، مع وسائل مساعدة: حذف إجابتين، وقت إضافي، رأي الفصل.',grades:[5,12],need:'mcq',min:6},
 {id:'escape',icon:'🔐',name:'غرفة الهروب',desc:'خمسة أقفال، كل قفل سؤال يكشف رقمًا من الرمز. الخطأ يكلّف دقيقة. اهربوا قبل انتهاء الوقت!',grades:[7,12],best:[9,12],need:'mcq',min:5},
 {id:'memory',icon:'🧠',name:'لعبة الذاكرة والتوصيل',desc:'اقلب بطاقتين: سؤال وإجابته. الفريق اللي يطابق أكثر يفوز.',grades:[5,10],need:'mcq',min:4},
 {id:'words',icon:'🔤',name:'البحث عن الكلمات',desc:'شبكة حروف فيها مصطلحات الدروس المختارة. حدّد أول حرف وآخر حرف.',grades:[5,9],need:'words',min:5},
 {id:'wheel',icon:'🎡',name:'عجلة الأسئلة',desc:'لفّ العجلة لاختيار طالب أو فريق، ثم يظهر سؤال عشوائي من الدروس.',grades:[5,12],need:'any',min:1},
 {id:'myth',icon:'🧪',name:'حقيقة أم مغالطة؟',desc:'عبارات علمية بعضها مغالطات شائعة. كل فريق يصوّت: حقيقة أم مغالطة؟ ثم يظهر التعليل العلمي.',grades:[10,12],need:'claims',min:4,teen:1},
 {id:'seq',icon:'🧬',name:'رتّب العملية',desc:'مراحل عملية حيوية مبعثرة (انقسام، بناء بروتين، نبضة عصبية، PCR…). رتّبوها بأقل أخطاء وأسرع وقت.',grades:[10,12],need:'seq',min:1,teen:1},
 {id:'case',icon:'🕵️',name:'ملف القضية',desc:'سؤال تحليلي ببيانات. كل دليل تكشفه يقلل النقاط: 400 ثم 300 ثم 200… حلّوا القضية بأقل الأدلة.',grades:[10,12],need:'case',min:2,teen:1},
 {id:'bet',icon:'🎯',name:'رهان الثقة',desc:'أسئلة متقدمة. كل فريق يختار إجابته ويراهن من 1 إلى 3 حسب ثقته: الصح يكسب الرهان والخطأ يخسره.',grades:[10,12],need:'hard',min:4,teen:1},
 {id:'links',icon:'🔗',name:'ما العلاقة؟',desc:'مفهومان من الدرس. الفرق تشرح العلاقة بينهما خلال دقيقة، ثم تظهر العلاقة النموذجية للمقارنة.',grades:[10,12],need:'links',min:2,teen:1},
 {id:'cards',icon:'🗂️',name:'بطاقات المراجعة',desc:'سؤال على الوجه والإجابة على الظهر، تشمل أسئلة البيانات والتحليل. مناسبة لمراجعة سريعة قبل الاختبار.',grades:[9,12],best:[10,12],need:'any',min:3},
 {id:'draw',icon:'🎰',name:'قرعة عشوائية بالأرقام',desc:'اكتب عدد طلاب الصف واقرع: يظهر رقم طالب عشوائي بتدوير سريع، مع إمكانية استبعاد الأرقام الخارجة. بلا أسئلة ولا تحضير — تنفع لاختيار الملقي والدور والسؤال الشفهي.',grades:[5,12],need:'none',min:0}
];
function fits(g){var n=gnum();return n>=g.grades[0]&&n<=g.grades[1];}
function bestFor(g){var n=gnum(),b=g.best||g.grades;return n>=b[0]&&n<=b[1];}

// ---------- الواجهة الجانبية ----------
function unitsList(){var m={},order=[];data.lessons.forEach(function(l){var k=String(l.unit);if(!m[k]){m[k]={unit:k,name:l.unit_name||'',lessons:[]};order.push(k);}m[k].lessons.push(l);});return order.map(function(k){return m[k];});}
// أسئلة ألعاب جديدة بالذكاء الاصطناعي: تُحفظ في المنصة فيستفيد منها كل المعلمين، وتظهر مع بقية الأسئلة
var AI_ON=false;try{api('/api/ai/status').then(function(x){AI_ON=!!x.on;if(AI_ON&&course&&courses.length)renderSide();},function(){});}catch(e){}
function aiGen(ids,btn){
  var t=btn.textContent;btn.disabled=true;btn.textContent='✨ جارٍ التوليد…';
  api('/api/ai/game-items',{key:course.key,lessons:ids}).then(function(r){
    return api('/api/games/data?key='+encodeURIComponent(course.key)).then(function(d){data=d;lessonById={};data.lessons.forEach(function(l){lessonById[l.id]=l;});ids.forEach(function(id){sel[id]=1;});renderSide();if(!game)renderHome();toast('أُضيف '+(r.added||0)+' سؤالًا جديدًا ✓');});
  },function(e){btn.disabled=false;btn.textContent=t;toast(e.message);});
}
function renderSide(){
  var h='<section class="qcard"><h3>1. المادة والصف</h3>'+coursePick(courses,course&&course.key,'courseSel')+'</section>';
  h+='<section class="qcard"><h3>2. الدروس</h3><div class="lpick">';
  unitsList().forEach(function(u){
    h+='<div class="lp-unit"><div class="lp-uh"><label><input type="checkbox" data-unit="'+esc(u.unit)+'"'+(u.lessons.every(function(l){return sel[l.id];})?' checked':'')+'> '+(isEn()?esc(u.name||'Unit '+u.unit):'الوحدة '+esc(u.unit)+(u.name?': '+esc(u.name):''))+'</label></div>';
    u.lessons.forEach(function(l){
      var n=itemCount(l.id), off=n===0;
      // الدروس بلا أسئلة صالحة للعب تُعطَّل (ولا تُظلَّل) بدل أن تُنتج لوحة فارغة
      if(off&&sel[l.id])delete sel[l.id];
      h+='<label class="lp-l'+(off?' lp-off':'')+'"'+(off?' title="لا توجد أسئلة ألعاب لهذا الدرس بعد"':'')+'><input type="checkbox" data-lid="'+l.id+'"'+(sel[l.id]?' checked':'')+(off?' disabled':'')+'> <span dir="auto">'+esc(l.title)+'</span><span class="muted">'+(off?(AI_ON?'<button type="button" class="ai-mini" data-aigen="'+l.id+'" title="ولّد أسئلة لهذا الدرس بالذكاء الاصطناعي">✨ ولّد</button>':'لا أسئلة'):n)+'</span></label>';
    });
    h+='</div>';
  });
  h+='</div><p class="muted small" id="selInfo"></p>'+(AI_ON?'<button type="button" class="btn small" id="aiGen" title="8 أسئلة جديدة لكل درس مختار (حتى 3 دروس)">✨ أسئلة جديدة بالذكاء الاصطناعي</button>':'')+'</section>';
  h+='<section class="qcard"><h3>الفرق</h3><div class="teams-ed" id="teamsEd"></div><div class="qrow"><button type="button" class="btn small" id="addTeam">+ فريق</button><label class="small"><input type="checkbox" id="sndChk"'+(sound?' checked':'')+'> الأصوات</label></div></section>';
  $('gside').innerHTML=h;
  bindCoursePick(courses,'courseSel',selectCourse);
  Array.prototype.forEach.call(document.querySelectorAll('[data-lid]'),function(b){b.onchange=function(){var id=+b.getAttribute('data-lid');if(b.checked)sel[id]=1;else delete sel[id];info();if(!game)renderHome();};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-unit]'),function(b){b.onchange=function(){var u=unitsList().filter(function(x){return x.unit===b.getAttribute('data-unit');})[0];u.lessons.forEach(function(l){if(b.checked)sel[l.id]=1;else delete sel[l.id];});renderSide();if(!game)renderHome();};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-aigen]'),function(b){b.onclick=function(e){e.preventDefault();e.stopPropagation();aiGen([+b.getAttribute('data-aigen')],b);};});
  if($('aiGen'))$('aiGen').onclick=function(){var ids=selIds();if(!ids.length){toast('اختر درسًا (حتى 3 دروس)');return;}if(ids.length>3)toast('سأولّد لأول 3 دروس مختارة');aiGen(ids.slice(0,3),this);};
  $('addTeam').onclick=function(){if(teams.length>=6)return;teams.push({name:'الفريق '+(teams.length+1),score:0});saveTeams();renderTeams();};
  $('sndChk').onchange=function(){sound=this.checked;};
  renderTeams();info();
}
function info(){var p=pool();var el=$('selInfo');if(el)el.textContent=selIds().length?('المختار: '+selIds().length+' درس · '+p.length+' سؤال ('+p.filter(function(x){return x.type==='mcq';}).length+' اختيار من متعدد)'):'اختر درسًا أو أكثر';}
var TEAM_COLORS=['#e21b3c','#1368ce','#d89e00','#26890c','#864cbf','#0aa3a3'];
function saveTeams(){lsSet('tahdir_teams',teams.map(function(t){return t.name;}));}
function renderTeams(){
  var el=$('teamsEd');if(!el)return;
  el.innerHTML=teams.map(function(t,i){return '<div class="team-row"><span class="tdot" style="background:'+TEAM_COLORS[i]+'"></span><input data-tn="'+i+'" value="'+esc(t.name)+'">'+(teams.length>2?'<button type="button" class="x" data-tx="'+i+'" aria-label="حذف">×</button>':'')+'</div>';}).join('');
  Array.prototype.forEach.call(el.querySelectorAll('[data-tn]'),function(inp){inp.onchange=function(){teams[+inp.getAttribute('data-tn')].name=inp.value.trim()||('الفريق '+(+inp.getAttribute('data-tn')+1));saveTeams();renderScore();};});
  Array.prototype.forEach.call(el.querySelectorAll('[data-tx]'),function(b){b.onclick=function(){teams.splice(+b.getAttribute('data-tx'),1);saveTeams();renderTeams();renderScore();};});
}
function selectCourse(key){
  course=courses.filter(function(c){return c.key===key;})[0];sel={};game=null;stopAll();
  lsSet('tahdir_games_course',key);
  $('gmain').innerHTML='<div class="welcome"><h2>جارٍ التحميل…</h2></div>';
  return api('/api/games/data?key='+encodeURIComponent(key)).then(function(r){data=r;lessonById={};data.lessons.forEach(function(l){lessonById[l.id]=l;});renderSide();renderHome();},function(e){toast(e.message);});
}
function enough(g){
  if(g.need==='none')return true; // قرعة الأرقام لا تحتاج أسئلة
  var p=pool();
  if(g.need==='mcq')return p.filter(function(x){return x.type==='mcq';}).length>=g.min;
  if(g.need==='words')return wordList().length>=g.min;
  if(g.need==='claims')return packList('claims').length>=g.min;
  if(g.need==='links')return packList('links').length>=g.min;
  if(g.need==='seq')return packSeqs().length>=g.min;
  if(g.need==='case')return caseItems().length>=g.min;
  if(g.need==='hard')return hardMcq().length>=g.min;
  return p.length>=g.min;
}
function renderHome(){arena(false);
  stopAll();game=null;
  // مادة/صف بلا أسئلة صالحة للعب: نوضّح ذلك صراحة بدل عرض ألعاب كلها معطّلة
  if(!data.items.some(playableItem)){
    $('gmain').innerHTML='<div class="g-none"><div class="g-none-ic">🎲</div><h2>لا توجد ألعاب لهذه المادة بعد</h2>'+
      '<p>الألعاب تُبنى من بنك الأسئلة ومن واجبات الدروس. هذه المادة/الصف لا تحتوي أسئلة اختيار من متعدد قابلة للعب حتى الآن، فلم نعرض لوحة فارغة.</p>'+
      '<p class="muted small">المواد المتاحة للألعاب حاليًا: العلوم · الفيزياء · الكيمياء · تقنية المعلومات (وبعض الواجبات في مواد أخرى).</p>'+
      '<p><button type="button" class="btn primary" id="quickDraw">🎰 قرعة عشوائية بالأرقام (تعمل بلا أسئلة)</button></p></div>';
    var qd=$('quickDraw');if(qd)qd.onclick=function(){startGame(GAMES.filter(function(x){return x.id==='draw';})[0]);};
    return;
  }
  var h='<div class="g-home"><div class="g-intro"><h2>🎲 ركن الألعاب التعليمية</h2><p>اختر الدروس من القائمة، ثم اللعبة. الأسئلة تُسحب من بنك الأسئلة وواجبات الدروس'+(isEn()?' والمفردات':' والمصطلحات')+'، ومستواها يناسب الصف. اعرضها على السبورة بملء الشاشة.</p></div><div class="g-cards">';
  var list=gnum()>=10?GAMES.filter(function(g){return g.teen;}).concat(GAMES.filter(function(g){return !g.teen;})):GAMES.filter(function(g){return !g.teen;});
  // ألعاب الحركة الجديدة أولًا في كل الصفوف
  list=list.filter(function(g){return g.hot;}).concat(list.filter(function(g){return !g.hot;}));
  list.forEach(function(g,gi){
    if(gi===0&&g.hot)h+='<h3 class="g-sec">🎮 ألعاب الحركة والحماس: مؤثرات وأصوات وأنيميشن</h3>';
    if(gnum()>=10&&g.teen&&(!list[gi-1]||!list[gi-1].teen))h+='<h3 class="g-sec">🎓 ألعاب للمرحلة الثانوية (10–12): تفكير وتحليل ومنافسة</h3>';
    if(!g.hot&&!g.teen&&list[gi-1]&&(list[gi-1].teen||list[gi-1].hot))h+='<h3 class="g-sec">ألعاب لكل الصفوف</h3>';
    var ok=enough(g),f=fits(g),b=bestFor(g);
    h+='<button type="button" class="g-card'+(ok?'':' off')+(g.hot?' hot':'')+'" data-game="'+g.id+'"'+(ok?'':' aria-disabled="true"')+'><span class="g-ic">'+g.icon+'</span><b>'+esc(g.name)+'</b><span class="g-desc">'+esc(g.desc)+'</span>'+
      '<span class="g-tags">'+(b?'<span class="tag good">مقترحة لصفك</span>':f?'<span class="tag">تناسب صفك</span>':'<span class="tag warn">الأنسب للصفوف '+g.grades[0]+'–'+g.grades[1]+'</span>')+(ok?'':'<span class="tag warn">'+(selIds().length?'تحتاج دروسًا أكثر':'اختر الدروس')+'</span>')+'</span></button>';
  });
  h+='</div></div>';
  $('gmain').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-game]'),function(b){b.onclick=function(){var g=GAMES.filter(function(x){return x.id===b.getAttribute('data-game');})[0];if(!enough(g)){toast(selIds().length?'اختر دروسًا أكثر لهذه اللعبة':'اختر الدروس أولًا من القائمة');return;}startGame(g);};});
}
// «الساحة»: ألعاب الحركة تملأ الشاشة كلها (فوق الشريط الجانبي والترويسة) لتظهر الشخصيات والمشهد كبيرة على السبورة
function arena(on){var st=$('stage');if(st)st.classList.toggle('arena',!!on);document.body.classList.toggle('g-arena',!!on);}
function stage(title,inner){
  document.body.classList.remove('g-arena');
  return '<div class="g-stage" id="stage"><div class="g-bar"><button type="button" class="btn small" id="gBack">→ الألعاب</button><b class="g-title">'+esc(title)+'</b><span class="g-bar-r"><button type="button" class="btn small" id="gFull">⛶ ملء الشاشة</button></span></div><div class="g-score" id="gScore"></div><div class="gm-body" id="gBody">'+inner+'</div></div>';
}
function bindStage(){$('gBack').onclick=renderHome;$('gFull').onclick=function(){toggleFull($('stage'));};}
var prevSc={};
function renderScore(showButtons,val){
  var el=$('gScore');if(!el)return;
  // الفريق الذي تغيّرت نقاطه: تقفز بطاقته ويتطاير شرر من رقمه
  var bumped=[];teams.forEach(function(t,i){if(prevSc[i]!=null&&prevSc[i]!==t.score)bumped.push(i);prevSc[i]=t.score;});
  setTimeout(function(){bumped.forEach(function(i){var c=el.querySelectorAll('.sc')[i];if(!c)return;c.classList.add('bump');var r=c.getBoundingClientRect();if(teams[i].score>0)fxBurst(r.left+r.width/2,r.top+r.height/2,[TEAM_COLORS[i],'#ffd400','#fff'],18);});},0);
  el.innerHTML=teams.map(function(t,i){return '<div class="sc" style="--tc:'+TEAM_COLORS[i]+'"><span class="sc-n">'+esc(t.name)+'</span><span class="sc-v">'+t.score+'</span>'+(showButtons?'<span class="sc-b"><button type="button" data-plus="'+i+'">+'+val+'</button><button type="button" data-minus="'+i+'">−'+val+'</button></span>':'')+'</div>';}).join('');
}
function resetScores(){teams.forEach(function(t){t.score=0;});}
// @@TUG@@
function startGame(g){
  stopAll();game=g.id;track('game_play',g.id);
  ({tug:gTug,runner:gRunner,ball:gBall,rocket:gRocket,balloon:gBalloon,live:gLive,jeopardy:gJeopardy,millionaire:gMillion,escape:gEscape,memory:gMemory,words:gWords,wheel:gWheel,cards:gCards,myth:gMyth,seq:gSeq,case:gCase,bet:gBet,links:gLinks,draw:gDraw})[g.id](g);
}
function timerHtml(id){return '<div class="g-timer" id="'+id+'"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" class="tr-bg"/><circle cx="18" cy="18" r="16" class="tr-fg" id="'+id+'C" stroke-dasharray="100 100"/></svg><span id="'+id+'T"></span></div>';}
function runTimer(id,secs,onEnd){
  var end=Date.now()+secs*1000,last=-1;
  var tick=function(){var left=Math.max(0,end-Date.now()),s=Math.ceil(left/1000);var t=$(id+'T'),c=$(id+'C');if(!t){stop();return;}t.textContent=s;c.setAttribute('stroke-dasharray',(left/(secs*10))+' 100');
    if(s<=5&&s!==last&&s>0)beep('tick');last=s;if(left<=0){stop();onEnd&&onEnd();}};
  var iv=setInterval(tick,200),stop=function(){clearInterval(iv);};stopFns.push(stop);tick();
  return {stop:stop,add:function(n){end+=n*1000;secs+=n;}};
}

// ========== 1) تحدي مباشر بالجوالات ==========
function gLive(g){
  var mc=mcqPool(),n=Math.min(mc.length,12),dur=gnum()>=11?30:(isEn()?20:25);
  var h='<div class="g-setup"><h3>📱 تحدي مباشر بالجوالات</h3><p class="muted">يدخل الطلاب من جوالاتهم على صفحة التحدي بالرمز أو QR، بدون حساب. مناسب للفصل كله أو لمجموعات.</p>'+
    '<label class="qrow">عدد الأسئلة <input type="number" id="lvN" min="3" max="'+Math.min(30,mc.length)+'" value="'+n+'"></label>'+
    '<label class="qrow">وقت كل سؤال (ثانية) <input type="number" id="lvD" min="10" max="120" value="'+dur+'"></label>'+
    '<button type="button" class="btn primary go-btn" id="lvGo">أنشئ التحدي</button></div>';
  $('gmain').innerHTML=stage(g.name,h);bindStage();
  $('lvGo').onclick=function(){
    var N=Math.max(3,Math.min(+$('lvN').value||10,mc.length)),D=Math.max(10,Math.min(120,+$('lvD').value||20));
    var items=shuffle(mc).slice(0,N).sort(function(a,b){return diff(a)-diff(b);}).map(mixMcq).map(function(x){return {stem:x.stem,choices:x.choices,correct:x.correct,table:x.table||null};});
    api('/api/live/create',{title:course.subject+' — الصف '+gLabel(course.grade),grade:course.grade,dur:D,items:items}).then(function(r){track('game_live',String(N));liveHost(r.code,items);},function(e){toast(e.message);});
  };
}
function liveHost(code,items){
  var url=location.origin+'/play?c='+code,last=null,busy=false,autoNext=false;
  var draw=function(st){
    var b=$('gBody');if(!b)return;
    if(st.state==='lobby'){
      b.innerHTML='<div class="lv-lobby"><div class="lv-join"><div class="lv-qr">'+qrSvg(url,260)+'</div><div><p>ادخل من الجوال على:</p><p class="lv-url ltr">'+esc(location.host)+'/play</p><p>رمز التحدي</p><p class="lv-code ltr">'+code.slice(0,3)+' '+code.slice(3)+'</p></div></div>'+
        '<div class="lv-players"><b>اللاعبون ('+st.players.length+')</b><div class="chips">'+st.players.map(function(p){return '<span class="chip">'+esc(p.name)+'</span>';}).join('')+'</div></div>'+
        '<button type="button" class="btn primary big" id="lvStart"'+(st.players.length?'':' disabled')+'>ابدأ التحدي ▶</button></div>';
      $('lvStart').onclick=function(){ctl('start');};
    }else if(st.state==='question'){
      var q=st.q;
      if(!last||last.qi!==st.qi||last.state!=='question'){
        b.innerHTML='<div class="lv-q"><div class="lv-top"><span class="lv-n">السؤال '+(st.qi+1)+' من '+st.total+'</span>'+timerHtml('lvT')+'<span class="lv-ans" id="lvAns"></span></div>'+qHtml(q)+
          '<div class="lv-opts">'+q.choices.map(function(c,i){return '<div class="lv-opt o'+i+'" dir="auto"><span class="sh">'+SHAPES[i]+'</span>'+rich(c)+'</div>';}).join('')+'</div><button type="button" class="btn" id="lvSkip">إظهار الإجابة الآن</button></div>';
        runTimer('lvT',Math.ceil(st.left/1000),function(){ctl('reveal');});
        $('lvSkip').onclick=function(){ctl('reveal');};
      }
      var a=$('lvAns');if(a)a.textContent='أجاب '+st.answered+' من '+st.players.length;
      if(st.players.length&&st.answered>=st.players.length&&!busy)ctl('reveal');
    }else if(st.state==='reveal'){
      if(!last||last.qi!==st.qi||last.state!=='reveal'){
        stopAll();every(1000,poll);
        var q2=st.q,mx=Math.max.apply(null,st.dist.concat([1]));beep('ok');
        b.innerHTML='<div class="lv-q"><div class="lv-top"><span class="lv-n">السؤال '+(st.qi+1)+' من '+st.total+'</span></div>'+qHtml(q2)+
          '<div class="lv-opts rev">'+q2.choices.map(function(c,i){return '<div class="lv-opt o'+i+(i===q2.correct?' right':' wrong')+'" dir="auto"><span class="sh">'+(i===q2.correct?'✓':SHAPES[i])+'</span>'+rich(c)+'<span class="lv-bar"><i style="width:'+(st.dist[i]/mx*100)+'%"></i><em>'+st.dist[i]+'</em></span></div>';}).join('')+'</div>'+
          '<div class="lv-lead"><b>لوحة الصدارة</b>'+st.players.slice(0,5).map(function(p,i){return '<div class="lr"><span>'+(i+1)+'</span><span>'+esc(p.name)+'</span><b>'+p.score+'</b></div>';}).join('')+'</div>'+
          '<button type="button" class="btn primary big" id="lvNext">'+(st.qi+1<st.total?'السؤال التالي ◀':'النتيجة النهائية 🏁')+'</button></div>';
        $('lvNext').onclick=function(){ctl('next');};
      }
    }else if(st.state==='end'){
      if(!last||last.state!=='end'){
        stopAll();beep('win');
        var p=st.players;
        b.innerHTML='<div class="podium">'+[1,0,2].map(function(i){return p[i]?'<div class="pd p'+i+'"><span class="pd-n">'+esc(p[i].name)+'</span><span class="pd-s">'+p[i].score+'</span><div class="pd-b">'+(i+1)+'</div></div>':'';}).join('')+'</div>'+
          '<div class="lv-lead full">'+p.map(function(x,i){return '<div class="lr"><span>'+(i+1)+'</span><span>'+esc(x.name)+'</span><b>'+x.score+'</b></div>';}).join('')+'</div><button type="button" class="btn primary" id="lvAgain">تحدٍّ جديد</button>';
        $('lvAgain').onclick=function(){gLive(GAMES[0]);};
      }
    }
    last=st;
  };
  var poll=function(){if(busy)return;api('/api/live/state?code='+code).then(draw,function(){});};
  var ctl=function(a){if(busy)return;busy=true;api('/api/live/control',{code:code,action:a}).then(function(){busy=false;poll();},function(e){busy=false;toast(e.message);});};
  stopAll();every(1000,poll);poll();
}

// ========== 2) تحدي الفرق (Jeopardy) ==========
function gJeopardy(g){
  resetScores();
  var ids=selIds().slice(0,6),vals=[100,200,300,400],used={},board=[];
  ids.forEach(function(id){
    var its=shuffle(data.items.filter(function(x){return x.lesson_id===id;})),col=[];
    vals.forEach(function(v,vi){
      var want=vi<2?1:vi===2?2:3,c=its.filter(function(x){return !used[x.qid]&&diff(x)===want;});
      if(!c.length)c=its.filter(function(x){return !used[x.qid]&&Math.abs(diff(x)-want)<=1;});
      if(!c.length)c=its.filter(function(x){return !used[x.qid];});
      var x=c[0];if(x){used[x.qid]=1;col.push({v:v,x:x.type==='mcq'?mixMcq(x):x,done:false});}else col.push(null);
    });
    board.push({l:lessonById[id],col:col});
  });
  if(ids.length===1){ // درس واحد: نوزّع على أعمدة حسب نوع السؤال
    var its=shuffle(data.items.filter(function(x){return x.lesson_id===ids[0];}));board=[];
    ['mcq','short','long'].forEach(function(t){var c=its.filter(function(x){return x.type===t;});if(!c.length)return;board.push({l:{title:{mcq:'اختيار من متعدد',short:'إجابة قصيرة',long:'تحليل وتفسير'}[t]},col:vals.map(function(v,i){var x=c[i];return x?{v:v,x:x.type==='mcq'?mixMcq(x):x,done:false}:null;})});});
  }
  var draw=function(){
    var b=$('gBody');
    b.innerHTML='<div class="jp" style="--cols:'+board.length+'">'+board.map(function(c){return '<div class="jp-h" dir="auto">'+esc(c.l.title||'')+'</div>';}).join('')+
      vals.map(function(v,vi){return board.map(function(c,ci){var t=c.col[vi];return t?'<button type="button" class="jp-t'+(t.done?' done':'')+'" data-c="'+ci+'" data-r="'+vi+'"'+(t.done?' disabled':'')+'>'+(t.done?'':v)+'</button>':'<div class="jp-t done"></div>';}).join('');}).join('')+'</div>';
    renderScore(false);
    Array.prototype.forEach.call(b.querySelectorAll('[data-c]'),function(btn){btn.onclick=function(){openTile(+btn.getAttribute('data-c'),+btn.getAttribute('data-r'));};});
  };
  var openTile=function(ci,ri){
    var t=board[ci].col[ri],x=t.x,secs=x.type==='long'?90:x.type==='short'?45:25;
    var b=$('gBody');
    b.innerHTML='<div class="jp-q"><div class="lv-top"><span class="jp-v">'+t.v+' نقطة · '+esc(board[ci].l.title||'')+'</span>'+timerHtml('jpT')+'</div>'+qHtml(x)+
      (x.type==='mcq'?'<div class="lv-opts">'+x.choices.map(function(c,i){return '<div class="lv-opt o'+i+'" dir="auto"><span class="sh">'+SHAPES[i]+'</span>'+rich(c)+'</div>';}).join('')+'</div>':'')+
      '<div class="jp-ans" id="jpAns" hidden><b>الإجابة:</b><div dir="auto">'+rich(answerText(x))+'</div></div>'+
      '<div class="jp-act"><button type="button" class="btn primary" id="jpShow">إظهار الإجابة</button><button type="button" class="btn" id="jpBack">رجوع للوحة</button></div><p class="muted small">بعد الإجابة: اضغط + للفريق الصحيح (أو − للخطأ إن رغبت)، ثم «رجوع للوحة».</p></div>';
    renderScore(true,t.v);
    runTimer('jpT',secs,function(){beep('bad');});
    $('jpShow').onclick=function(){$('jpAns').hidden=false;if(x.type==='mcq'){var o=b.querySelectorAll('.lv-opt');o[x.correct].classList.add('right');}};
    $('jpBack').onclick=function(){t.done=true;stopAll();draw();if(board.every(function(c){return c.col.every(function(z){return !z||z.done;});}))finish();};
    Array.prototype.forEach.call(document.querySelectorAll('[data-plus]'),function(bb){bb.onclick=function(){teams[+bb.getAttribute('data-plus')].score+=t.v;beep('ok');renderScore(true,t.v);bindPM();};});
    var bindPM=function(){Array.prototype.forEach.call(document.querySelectorAll('[data-plus]'),function(bb){bb.onclick=function(){teams[+bb.getAttribute('data-plus')].score+=t.v;beep('ok');renderScore(true,t.v);bindPM();};});Array.prototype.forEach.call(document.querySelectorAll('[data-minus]'),function(bb){bb.onclick=function(){teams[+bb.getAttribute('data-minus')].score-=t.v;beep('bad');renderScore(true,t.v);bindPM();};});};bindPM();
  };
  var finish=function(){var w=teams.slice().sort(function(a,b){return b.score-a.score;})[0];beep('win');$('gBody').innerHTML='<div class="g-win">🏆<h2>الفائز: '+esc(w.name)+'</h2><p>'+w.score+' نقطة</p><button type="button" class="btn primary" id="again">لعبة جديدة</button></div>';$('again').onclick=function(){gJeopardy(g);};};
  $('gmain').innerHTML=stage(g.name,'');bindStage();draw();
}

// ========== 3) سلّم المليون ==========
function gMillion(g){
  var mc=shuffle(mcqPool()),qs=[];
  [1,1,1,2,2,2,2,3,3,3].forEach(function(d){var c=mc.filter(function(x){return qs.indexOf(x)<0&&diff(x)===d;});if(!c.length)c=mc.filter(function(x){return qs.indexOf(x)<0;});if(c.length)qs.push(c[0]);});
  qs=qs.map(mixMcq);
  var PR=['100','200','500','1,000','5,000','10,000','50,000','100,000','500,000','1,000,000'],SAFE=[4],cur=0,life={h50:1,time:1,cls:1},tmr=null;
  var secs=gnum()>=11?60:45;
  var ladder=function(){return '<ol class="ladder">'+PR.map(function(p,i){return i<qs.length?'<li class="'+(i===cur?'on':'')+(i<cur?' won':'')+(SAFE.indexOf(i)>=0?' safe':'')+'">'+p+'</li>':'';}).reverse().join('')+'</ol>';};
  var show=function(){
    stopAll();var x=qs[cur];
    $('gBody').innerHTML='<div class="mil"><div class="mil-main"><div class="lv-top"><span class="lv-n">السؤال '+(cur+1)+' — '+PR[cur]+'</span>'+timerHtml('mT')+'</div>'+qHtml(x)+
      '<div class="lv-opts">'+x.choices.map(function(c,i){return '<button type="button" class="lv-opt o'+i+'" data-o="'+i+'" dir="auto"><span class="sh">'+'أبجد'[i]+'</span>'+rich(c)+'</button>';}).join('')+'</div>'+
      '<div class="life"><button type="button" class="btn" id="h50"'+(life.h50?'':' disabled')+'>✂️ حذف إجابتين</button><button type="button" class="btn" id="htime"'+(life.time?'':' disabled')+'>⏱ +30 ثانية</button><button type="button" class="btn" id="hcls"'+(life.cls?'':' disabled')+'>🙋 رأي الفصل</button></div></div>'+ladder()+'</div>';
    tmr=runTimer('mT',secs,function(){lose('انتهى الوقت!');});
    Array.prototype.forEach.call(document.querySelectorAll('[data-o]'),function(b){b.onclick=function(){answer(+b.getAttribute('data-o'),b);};});
    $('h50').onclick=function(){life.h50=0;this.disabled=true;var w=[0,1,2,3].filter(function(i){return i!==x.correct&&i<x.choices.length;});shuffle(w).slice(0,2).forEach(function(i){var b=document.querySelector('[data-o="'+i+'"]');if(b){b.disabled=true;b.classList.add('gone');}});};
    $('htime').onclick=function(){life.time=0;this.disabled=true;tmr.add(30);};
    $('hcls').onclick=function(){life.cls=0;this.disabled=true;dialog({title:'🙋 رأي الفصل',message:'اطلب من الفصل رفع اليد لكل خيار (أ، ب، ج، د) خلال 10 ثوانٍ، ثم يقرر المتسابق.',okText:'تم',cancelText:false});};
  };
  var answer=function(i,b){stopAll();var x=qs[cur],opts=document.querySelectorAll('[data-o]');Array.prototype.forEach.call(opts,function(o){o.disabled=true;});b.classList.add('pick');
    setTimeout(function(){opts[x.correct].classList.add('right');if(i===x.correct){beep('ok');setTimeout(function(){cur++;if(cur>=qs.length)win();else show();},1300);}else{b.classList.add('wrongpick');beep('bad');setTimeout(function(){lose('إجابة خاطئة');},1500);}},900);};
  var lose=function(why){stopAll();var safe=-1;SAFE.forEach(function(s){if(cur>s)safe=s;});$('gBody').innerHTML='<div class="g-win">😮<h2>'+esc(why)+'</h2><p>الإجابة الصحيحة: <b dir="auto">'+rich(qs[cur].choices[qs[cur].correct])+'</b></p><p>تخرج بـ '+(safe>=0?PR[safe]:'0')+' نقطة</p><button type="button" class="btn primary" id="again">لعبة جديدة</button></div>';$('again').onclick=function(){gMillion(g);};};
  var win=function(){beep('win');$('gBody').innerHTML='<div class="g-win">🏆<h2>مبروك! وصلت للقمة</h2><p>'+PR[qs.length-1]+' نقطة</p><button type="button" class="btn primary" id="again">لعبة جديدة</button></div>';$('again').onclick=function(){gMillion(g);};};
  $('gmain').innerHTML=stage(g.name,'');bindStage();show();
}

// ========== 4) غرفة الهروب ==========
function gEscape(g){
  var mc=mcqPool(),hi=gnum()>=10;
  var ordered=shuffle(mc).sort(function(a,b){return hi?diff(b)-diff(a):diff(a)-diff(b);});
  var locks=[],spare=[];ordered.forEach(function(x){if(locks.length<5)locks.push(x);else spare.push(x);});
  locks=shuffle(locks).map(mixMcq);spare=spare.map(mixMcq);
  var digits=locks.map(function(){return Math.floor(Math.random()*10);}),open=locks.map(function(){return false;}),mins=hi?12:10,total=null;
  var story=isEn()?'The library is locked! Solve each lock to get one digit of the door code.':course.subject==='العلوم'?'باب مختبر العلوم انقفل! كل قفل يفتح بسؤال ويعطيكم رقمًا من رمز الباب.':'مختبر الأحياء انغلق والتجربة ستفسد! حلّوا الأقفال الخمسة لتعرفوا رمز الباب.';
  var draw=function(){
    $('gBody').innerHTML='<div class="esc"><div class="lv-top"><span class="esc-story">'+esc(story)+'</span>'+timerHtml('eT')+'</div><div class="locks">'+locks.map(function(x,i){return '<button type="button" class="lock'+(open[i]?' open':'')+'" data-l="'+i+'"'+(open[i]?' disabled':'')+'><span class="lk">'+(open[i]?'🔓':'🔒')+'</span><span>القفل '+(i+1)+'</span><b class="dg">'+(open[i]?digits[i]:'?')+'</b></button>';}).join('')+'</div>'+
      '<div id="lockQ"></div>'+(open.every(Boolean)?'<div class="esc-final"><p>اكتبوا رمز الباب (الأرقام بالترتيب):</p><input id="codeIn" class="ltr" maxlength="5" inputmode="numeric"><button type="button" class="btn primary" id="codeGo">افتح الباب 🚪</button></div>':'')+'</div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-l]'),function(b){b.onclick=function(){ask(+b.getAttribute('data-l'));};});
    if($('codeGo'))$('codeGo').onclick=function(){if($('codeIn').value.replace(/\D/g,'')===digits.join('')){stopAll();beep('win');$('gBody').innerHTML='<div class="g-win">🚪✨<h2>'+(isEn()?'You escaped!':'هربتم بنجاح!')+'</h2><button type="button" class="btn primary" id="again">لعبة جديدة</button></div>';$('again').onclick=function(){gEscape(g);};}else{beep('bad');toast('الرمز غير صحيح');}};
  };
  var ask=function(i){
    var x=locks[i];
    $('lockQ').innerHTML='<div class="jp-q">'+qHtml(x)+'<div class="lv-opts">'+x.choices.map(function(c,k){return '<button type="button" class="lv-opt o'+k+'" data-a="'+k+'" dir="auto"><span class="sh">'+SHAPES[k]+'</span>'+rich(c)+'</button>';}).join('')+'</div></div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-a]'),function(b){b.onclick=function(){
      if(+b.getAttribute('data-a')===x.correct){beep('ok');open[i]=true;draw();}
      else{beep('bad');b.classList.add('wrongpick');toast('خطأ! خُصمت دقيقة'+(spare.length?' وتغيّر سؤال القفل':''));total.add(-60);if(spare.length)locks[i]=spare.shift();setTimeout(function(){ask(i);},900);}
    };});
  };
  $('gmain').innerHTML=stage(g.name,'');bindStage();draw();
  total=runTimer('eT',mins*60,function(){$('gBody').innerHTML='<div class="g-win">⏰<h2>انتهى الوقت!</h2><p>الرمز كان: <b class="ltr">'+digits.join('')+'</b></p><button type="button" class="btn primary" id="again">حاولوا مرة أخرى</button></div>';$('again').onclick=function(){gEscape(g);};});
}

// ========== 5) الذاكرة والتوصيل ==========
function gMemory(g){
  resetScores();
  var c=shuffle(mcqPool().filter(function(x){return x.stem.length<=150&&x.choices[x.correct].length<=60&&!x.table;}));
  var pairs=c.slice(0,gnum()<=6?6:8),cards=[];
  pairs.forEach(function(x,i){cards.push({p:i,t:x.stem,kind:'q'});cards.push({p:i,t:x.choices[x.correct],kind:'a'});});
  cards=shuffle(cards);var openC=[],turn=0,matched=0,lock=false;
  var draw=function(){
    $('gBody').innerHTML='<p class="g-hint">دور: <b style="color:'+TEAM_COLORS[turn]+'">'+esc(teams[turn].name)+'</b> — اقلب بطاقتين: سؤال وإجابته الصحيحة.</p><div class="mem">'+cards.map(function(cd,i){return '<button type="button" class="mc'+(cd.open||cd.done?' up':'')+(cd.done?' done':'')+' '+cd.kind+'" data-m="'+i+'"'+(cd.done?' disabled':'')+' style="'+(cd.done?'--tc:'+TEAM_COLORS[cd.by]:'')+'"><span class="mc-f">'+(cd.kind==='q'?'❓':'💡')+'</span><span class="mc-b" dir="auto">'+rich(cd.t)+'</span></button>';}).join('')+'</div>';
    renderScore(false);
    Array.prototype.forEach.call(document.querySelectorAll('[data-m]'),function(b){b.onclick=function(){flip(+b.getAttribute('data-m'));};});
  };
  var flip=function(i){if(lock||cards[i].open||cards[i].done)return;cards[i].open=true;openC.push(i);draw();
    if(openC.length===2){lock=true;var a=cards[openC[0]],b=cards[openC[1]];
      setTimeout(function(){if(a.p===b.p&&a.kind!==b.kind){a.done=b.done=true;a.by=b.by=turn;teams[turn].score+=1;matched++;beep('ok');}else{beep('bad');turn=(turn+1)%teams.length;}a.open=b.open=false;openC=[];lock=false;draw();
        if(matched===pairs.length){var w=teams.slice().sort(function(x,y){return y.score-x.score;})[0];beep('win');$('gBody').insertAdjacentHTML('afterbegin','<div class="g-win small">🏆 الفائز: '+esc(w.name)+' ('+w.score+')<button type="button" class="btn primary" id="again">لعبة جديدة</button></div>');$('again').onclick=function(){gMemory(g);};}},1300);}};
  $('gmain').innerHTML=stage(g.name,'');bindStage();draw();
}

// ========== 6) البحث عن الكلمات ==========
function normWord(w){return String(w||'').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[إأآ]/g,'ا').trim();}
function wordList(){
  var out=[],seen={};
  var STOP={THE:1,AND:1,BUT:1,THAT:1,THIS:1,WITH:1,ABOUT:1,BECAUSE:1,FROM:1,THEY:1,WHEN:1,WHAT:1,WHICH:1,WILL:1,WOULD:1,SHOULD:1,COULD:1,HAVE:1,THERE:1,THEIR:1,YOUR:1,BAD:1,GOOD:1,VERY:1,ALSO:1,INTO:1,ONLY:1,SOME:1,MOST:1,MORE:1,THAN:1,THEN:1,DOES:1,DON:1,USE:1,USED:1,FORM:1,FORMS:1,VERB:1,VERBS:1,NOUN:1,NOUNS:1};
  selIds().forEach(function(id){var l=lessonById[id];if(!l)return;var c=String(l.concepts||'');
    if(isEn()){var vl=c.split(/\n/).filter(function(x){return /Vocabulary|Collocations|Adjectives|Phrasal|Words|Expressions/i.test(x);});if(vl.length)c=vl.join('\n');}
    c.split(/\n/).forEach(function(line){line=line.replace(/^[•\-\s]+/,'');var m=line.match(/^[^:：]{2,40}[:：](.*)$/);if(m&&/[A-Za-z]/.test(line))line=m[1];
      line.split(/[،,;؛\/()]+/).forEach(function(w){w=normWord(w).replace(/[.؟?!"“”]/g,'');
        if(isEn()){if(!/^[A-Za-z]{4,11}$/.test(w))return;w=w.toUpperCase();if(STOP[w])return;}
        else{if(/\s/.test(w)){var parts=w.split(/\s+/);if(parts.length===2&&parts[0]==='ال')w=parts.join('');else return;}if(!/^[ء-ي]{3,10}$/.test(w))return;}
        if(!seen[w]){seen[w]=1;out.push(w);}});});});
  return out;
}
function gWords(g){
  // حماية: لو ما فيه كلمات صالحة (درس مفاهيمي بلا مصطلحات، أو مادة إنجليزية بلا Vocabulary) نرجع للرئيسية بدل الانهيار
  var all=wordList();
  if(!all.length){toast('هذه الدروس ما فيها مصطلحات تنفع للبحث عن الكلمات. اختر دروسًا أخرى فيها مفاهيم أو مصطلحات.');renderHome();return;}
  var words=shuffle(all).slice(0,gnum()<=6?8:10).sort(function(a,b){return b.length-a.length;});
  var N=Math.max(10,Math.min(14,words[0].length+3)),grid=[],place=[];
  for(var r=0;r<N;r++){grid.push([]);for(var c=0;c<N;c++)grid[r].push('');}
  var dirs=gnum()<=6?[[0,1],[1,0]]:[[0,1],[1,0],[1,1],[-1,1]];
  var placed=[];
  words.forEach(function(w){var ch=Array.from(w),ok=false;
    for(var t=0;t<200&&!ok;t++){var d=pick(dirs),r0=Math.floor(Math.random()*N),c0=Math.floor(Math.random()*N),fit=true;
      for(var k=0;k<ch.length;k++){var r=r0+d[0]*k,c=c0+d[1]*k;if(r<0||c<0||r>=N||c>=N||(grid[r][c]&&grid[r][c]!==ch[k])){fit=false;break;}}
      if(fit){var cells=[];for(var k2=0;k2<ch.length;k2++){var rr=r0+d[0]*k2,cc=c0+d[1]*k2;grid[rr][cc]=ch[k2];cells.push(rr+'_'+cc);}placed.push({w:w,cells:cells,found:false});ok=true;}}});
  // كلمة طويلة ما لقيت مكانًا: لا نعرضها في القائمة حتى لا يبحث الطلاب عن كلمة غير موجودة في الشبكة
  var dropped=words.length-placed.length;
  if(dropped>0)toast('تعذّر إدراج '+dropped+' كلمة طويلة في الشبكة، فحُذفت من القائمة.');
  if(!placed.length){toast('تعذّر بناء شبكة الحروف من هذه الدروس. اختر دروسًا أخرى.');renderHome();return;}
  var AL=isEn()?'ABCDEFGHIJKLMNOPRSTUVWY':'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
  for(var r1=0;r1<N;r1++)for(var c1=0;c1<N;c1++)if(!grid[r1][c1])grid[r1][c1]=AL[Math.floor(Math.random()*AL.length)];
  var first=null,found={};
  var draw=function(){
    $('gBody').innerHTML='<div class="ws"><div class="ws-grid" style="--n:'+N+'" dir="'+(isEn()?'ltr':'rtl')+'">'+grid.map(function(row,r){return row.map(function(ch,c){var k=r+'_'+c;return '<button type="button" class="ws-c'+(found[k]?' f':'')+(first===k?' s':'')+'" data-ws="'+k+'">'+ch+'</button>';}).join('');}).join('')+'</div>'+
      '<div class="ws-list"><b>الكلمات ('+placed.filter(function(p){return p.found;}).length+'/'+placed.length+')</b>'+placed.map(function(p){return '<span class="w'+(p.found?' got':'')+'" dir="auto">'+esc(p.w)+'</span>';}).join('')+'<p class="muted small">اضغط أول حرف ثم آخر حرف في الكلمة.</p>'+timerHtml('wT')+'</div></div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-ws]'),function(b){b.onclick=function(){cell(b.getAttribute('data-ws'));};});
  };
  var cell=function(k){
    if(!first){first=k;draw();return;}
    var a=first.split('_').map(Number),b=k.split('_').map(Number);first=null;
    var dr=Math.sign(b[0]-a[0]),dc=Math.sign(b[1]-a[1]),len=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))+1,cells=[];
    if(!(a[0]===b[0]||a[1]===b[1]||Math.abs(b[0]-a[0])===Math.abs(b[1]-a[1]))){draw();return;}
    for(var i=0;i<len;i++)cells.push((a[0]+dr*i)+'_'+(a[1]+dc*i));
    var hit=placed.filter(function(p){return !p.found&&(p.cells.join()===cells.join()||p.cells.slice().reverse().join()===cells.join());})[0];
    if(hit){hit.found=true;hit.cells.forEach(function(c){found[c]=1;});beep('ok');}else beep('bad');
    draw();if(placed.every(function(p){return p.found;})){stopAll();beep('win');$('gBody').insertAdjacentHTML('afterbegin','<div class="g-win small">🎉 وجدتم كل الكلمات!<button type="button" class="btn primary" id="again">شبكة جديدة</button></div>');$('again').onclick=function(){gWords(g);};}
  };
  $('gmain').innerHTML=stage(g.name,'');bindStage();draw();runTimer('wT',gnum()<=6?600:420,function(){toast('انتهى الوقت!');});
}

// ========== 7) عجلة الأسئلة ==========
function gWheel(g){
  var mode='students',n=+(lsGet('tahdir_class_size')||25),rot=0,asked={};
  var labels=function(){return mode==='teams'?teams.map(function(t){return t.name;}):Array.from({length:n},function(_,i){return String(i+1);});};
  var wheelSvg=function(){var L=labels(),k=L.length,R=150,h='';
    L.forEach(function(t,i){var a0=2*Math.PI*i/k-Math.PI/2,a1=2*Math.PI*(i+1)/k-Math.PI/2,x0=160+R*Math.cos(a0),y0=160+R*Math.sin(a0),x1=160+R*Math.cos(a1),y1=160+R*Math.sin(a1),am=(a0+a1)/2;
      h+='<path d="M160 160L'+x0.toFixed(1)+' '+y0.toFixed(1)+'A'+R+' '+R+' 0 '+(k<=2?1:0)+' 1 '+x1.toFixed(1)+' '+y1.toFixed(1)+'Z" fill="'+TEAM_COLORS[i%6]+'" stroke="#fff" stroke-width="2"/>'+
        '<text x="'+(160+R*.68*Math.cos(am)).toFixed(1)+'" y="'+(160+R*.68*Math.sin(am)).toFixed(1)+'" fill="#fff" font-size="'+(k>30?9:k>16?12:15)+'" font-weight="700" text-anchor="middle" dominant-baseline="middle">'+esc(t).slice(0,10)+'</text>';});
    return '<svg viewBox="0 0 320 320" class="wh-svg"><g id="whG" style="transform-origin:160px 160px;transform:rotate('+rot+'deg)">'+h+'</g><circle cx="160" cy="160" r="18" fill="#fff" stroke="#10261f" stroke-width="3"/></svg><div class="wh-ptr">▼</div>';};
  var draw=function(){
    $('gBody').innerHTML='<div class="wh"><div class="wh-left"><div class="seg sm"><button type="button" class="'+(mode==='students'?'on':'')+'" data-wm="students">أرقام الطلاب</button><button type="button" class="'+(mode==='teams'?'on':'')+'" data-wm="teams">الفرق</button></div>'+
      (mode==='students'?'<label class="qrow">عدد الطلاب <input type="number" id="whN" min="2" max="45" value="'+n+'"></label>':'')+
      '<div class="wh-wrap">'+wheelSvg()+'</div><button type="button" class="btn primary big" id="whSpin">لفّ العجلة 🎡</button></div><div class="wh-q" id="whQ"><p class="muted">لفّ العجلة ليظهر من سيجيب وسؤاله.</p></div></div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-wm]'),function(b){b.onclick=function(){mode=b.getAttribute('data-wm');draw();};});
    if($('whN'))$('whN').onchange=function(){n=Math.max(2,Math.min(45,+this.value||25));lsSet('tahdir_class_size',n);draw();};
    $('whSpin').onclick=spin;
  };
  var spin=function(){
    var L=labels(),k=L.length,idx=Math.floor(Math.random()*k),seg=360/k;
    var target=360-(idx*seg+seg/2);rot=rot-(rot%360)+360*5+target;
    var gg=$('whG');gg.style.transition='transform 4s cubic-bezier(.17,.67,.2,1)';gg.style.transform='rotate('+rot+'deg)';$('whSpin').disabled=true;
    setTimeout(function(){beep('ok');$('whSpin').disabled=false;
      // مفتاح التكرار: qid إن وُجد، وإلا نص السؤال — لأن بعض المفردات (واجبات الدروس) بلا qid
      // فكان asked[undefined] يجمعها كلها فلا تظهر إلا مرة واحدة.
      var p=pool();
      if(!p.length){toast('لا توجد أسئلة في الدروس المختارة.');return;}
      var keyOf=function(y){return y.qid!=null?('q'+y.qid):('s'+String(y.stem||'').slice(0,80));};
      var un=p.filter(function(y){return !asked[keyOf(y)];});
      if(!un.length){asked={};un=p;}
      var x=pick(un);asked[keyOf(x)]=1;if(x.type==='mcq')x=mixMcq(x);
      $('whQ').innerHTML='<div class="wh-who">'+(mode==='teams'?'الفريق: ':'الطالب رقم ')+'<b>'+esc(L[idx])+'</b></div>'+qHtml(x)+(x.type==='mcq'?'<div class="lv-opts">'+x.choices.map(function(c,i){return '<div class="lv-opt o'+i+'" dir="auto"><span class="sh">'+SHAPES[i]+'</span>'+rich(c)+'</div>';}).join('')+'</div>':'')+
        '<button type="button" class="btn" id="whA">إظهار الإجابة</button><div class="jp-ans" id="whAns" hidden dir="auto">'+rich(answerText(x))+'</div>';
      $('whA').onclick=function(){$('whAns').hidden=false;if(x.type==='mcq')document.querySelectorAll('#whQ .lv-opt')[x.correct].classList.add('right');};
    },4100);
  };
  $('gmain').innerHTML=stage(g.name,'');bindStage();draw();
}

// ========== 8) بطاقات المراجعة ==========
function gCards(g){
  var deck=shuffle(pool()).sort(function(a,b){return diff(a)-diff(b);}).map(function(x){return x.type==='mcq'?mixMcq(x):x;}),i=0,known=0,again=[];
  var draw=function(){
    if(i>=deck.length){if(again.length){deck=again;again=[];i=0;toast('جولة ثانية على البطاقات التي لم تُعرف');}else{beep('win');$('gBody').innerHTML='<div class="g-win">✅<h2>أنهيتم البطاقات</h2><p>عُرفت '+known+' بطاقة</p><button type="button" class="btn primary" id="again">من جديد</button></div>';$('again').onclick=function(){gCards(g);};return;}}
    var x=deck[i];
    $('gBody').innerHTML='<div class="fc-wrap"><div class="fc-n">'+(i+1)+' / '+deck.length+' · '+esc((lessonById[x.lesson_id]||{}).title||'')+'</div><button type="button" class="fc" id="fc"><div class="fc-front">'+qHtml(x)+(x.type==='mcq'?'<ol class="fc-ch" dir="auto">'+x.choices.map(function(c){return '<li>'+rich(c)+'</li>';}).join('')+'</ol>':'')+'<span class="muted small">اضغط لقلب البطاقة</span></div><div class="fc-back" dir="auto"><b>الإجابة</b><div>'+rich(answerText(x))+'</div>'+(x.notes?'<p class="muted small">'+rich(x.notes)+'</p>':'')+'</div></button>'+
      '<div class="fc-act"><button type="button" class="btn" id="fcNo">❌ لم نعرفها</button><button type="button" class="btn primary" id="fcYes">✔ عرفناها</button></div></div>';
    $('fc').onclick=function(){this.classList.toggle('flip');};
    $('fcYes').onclick=function(){known++;i++;draw();};
    $('fcNo').onclick=function(){again.push(x);i++;draw();};
  };
  $('gmain').innerHTML=stage(g.name,'');bindStage();draw();
}

// ========== ألعاب المرحلة الثانوية ==========
function packList(kind){var out=[];selIds().forEach(function(id){var p=(data.pack||{})[id];if(p&&p[kind])p[kind].forEach(function(x){out.push(Object.assign({lesson_id:id},x));});});return out;}
function packSeqs(){var out=[];selIds().forEach(function(id){var p=(data.pack||{})[id];if(p&&p.sequence)out.push(Object.assign({lesson_id:id},p.sequence));});return out;}
function caseItems(){return pool().filter(function(x){return x.type!=='mcq'&&(x.table||x.type==='long')&&/AO2|استدلال|تطبيق/.test(x.ao||'')&&String(x.answer||'').split('\n').filter(Boolean).length>=2;});}
function hardMcq(){var m=mcqPool();var h=m.filter(function(x){return diff(x)>=2;});return h.length>=4?h:m;}
// لوحة اختيار لكل فريق: يعيد كائنًا بالاختيارات
function teamPicks(opts,withBet){
  return '<div class="tp">'+teams.map(function(t,i){return '<div class="tp-row" style="--tc:'+TEAM_COLORS[i]+'"><span class="tp-n">'+esc(t.name)+'</span><span class="tp-o">'+opts.map(function(o,k){return '<button type="button" data-tp="'+i+'" data-v="'+k+'">'+o+'</button>';}).join('')+'</span>'+
    (withBet?'<span class="tp-bet">رهان: '+[1,2,3].map(function(b){return '<button type="button" data-tb="'+i+'" data-v="'+b+'"'+(b===1?' class="on"':'')+'>×'+b+'</button>';}).join('')+'</span>':'')+'</div>';}).join('')+'</div>';
}
function bindPicks(state){
  Array.prototype.forEach.call(document.querySelectorAll('[data-tp]'),function(b){b.onclick=function(){if(state.locked)return;var i=+b.getAttribute('data-tp');state.pick[i]=+b.getAttribute('data-v');Array.prototype.forEach.call(document.querySelectorAll('[data-tp="'+i+'"]'),function(x){x.classList.toggle('on',x===b);});};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-tb]'),function(b){b.onclick=function(){if(state.locked)return;var i=+b.getAttribute('data-tb');state.bet[i]=+b.getAttribute('data-v');Array.prototype.forEach.call(document.querySelectorAll('[data-tb="'+i+'"]'),function(x){x.classList.toggle('on',x===b);});};});
}
function endScreen(g,fn,msg){var w=teams.slice().sort(function(a,b){return b.score-a.score;})[0];beep('win');$('gBody').innerHTML='<div class="g-win">🏆<h2>'+(msg||('الفائز: '+esc(w.name)))+'</h2><p>'+teams.map(function(t){return esc(t.name)+': '+t.score;}).join(' · ')+'</p><button type="button" class="btn primary" id="again">لعبة جديدة</button></div>';renderScore(false);$('again').onclick=function(){fn(g);};}

// ---- حقيقة أم مغالطة
function gMyth(g){
  resetScores();var cl=shuffle(packList('claims')).slice(0,12),i=0;
  var show=function(){
    stopAll();if(i>=cl.length)return endScreen(g,gMyth);var c=cl[i],st={pick:{},bet:{},locked:false};
    $('gBody').innerHTML='<div class="myth"><div class="lv-top"><span class="lv-n">العبارة '+(i+1)+' من '+cl.length+' · '+esc((lessonById[c.lesson_id]||{}).title||'')+'</span>'+timerHtml('myT')+'</div><blockquote class="claim" dir="auto">«'+rich(c.text)+'»</blockquote>'+
      teamPicks(['✔ حقيقة','✖ مغالطة'])+'<div class="jp-act"><button type="button" class="btn primary" id="myRev">اكشف الإجابة</button></div><div id="myAns"></div></div>';
    renderScore(false);bindPicks(st);runTimer('myT',gnum()>=11?30:25,function(){});
    $('myRev').onclick=function(){if(st.locked){i++;show();return;}st.locked=true;stopAll();var right=c.true?0:1;
      teams.forEach(function(t,k){if(st.pick[k]===right)t.score+=100;});beep('ok');renderScore(false);
      $('myAns').innerHTML='<div class="jp-ans '+(c.true?'':'myth-x')+'"><b>'+(c.true?'✔ حقيقة':'✖ مغالطة')+'</b><div dir="auto">'+rich(c.why)+'</div></div>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-tp]'),function(b){if(+b.getAttribute('data-v')===right)b.classList.add('right');});
      this.textContent=i+1<cl.length?'العبارة التالية ◀':'النتيجة 🏁';};
  };
  $('gmain').innerHTML=stage(g.name,'');bindStage();show();
}
// ---- رتّب العملية
function gSeq(g){
  resetScores();var seqs=shuffle(packSeqs()),si=0,turn=0;
  var show=function(){
    stopAll();if(si>=seqs.length)return endScreen(g,gSeq);var sq=seqs[si],order=[],cards=shuffle(sq.steps.map(function(t,k){return {t:t,k:k};})),t0=Date.now();
    var draw=function(done){
      $('gBody').innerHTML='<div class="seq"><div class="lv-top"><span class="lv-n">'+esc(sq.title)+' · '+esc((lessonById[sq.lesson_id]||{}).title||'')+'</span><span>دور: <b style="color:'+TEAM_COLORS[turn]+'">'+esc(teams[turn].name)+'</b></span>'+(done?'':timerHtml('sqT'))+'</div>'+
        '<p class="muted">اضغطوا البطاقات بالترتيب الصحيح (الأولى أولًا). اضغط بطاقة مختارة لإلغائها.</p><div class="seq-pool">'+cards.map(function(c,ci){var pos=order.indexOf(ci);return '<button type="button" class="seq-c'+(pos>=0?' on':'')+(done?(c.k===pos?' ok':' no'):'')+'" data-s="'+ci+'"'+(done?' disabled':'')+' dir="auto">'+(pos>=0?'<span class="seq-n">'+(pos+1)+'</span>':'')+esc(c.t)+'</button>';}).join('')+'</div>'+
        (done?'<div class="jp-ans"><b>الترتيب الصحيح:</b><ol>'+sq.steps.map(function(t){return '<li dir="auto">'+esc(t)+'</li>';}).join('')+'</ol></div><button type="button" class="btn primary" id="sqNext">'+(si+1<seqs.length?'العملية التالية ◀':'النتيجة 🏁')+'</button>':'<button type="button" class="btn primary" id="sqCheck"'+(order.length===cards.length?'':' disabled')+'>تحقّق</button>')+'</div>';
      renderScore(false);
      if(!done){Array.prototype.forEach.call(document.querySelectorAll('[data-s]'),function(b){b.onclick=function(){var ci=+b.getAttribute('data-s'),p=order.indexOf(ci);if(p>=0)order.splice(p,1);else order.push(ci);draw(false);};});
        $('sqCheck').onclick=function(){stopAll();var right=0;order.forEach(function(ci,p){if(cards[ci].k===p)right++;});var secs=Math.round((Date.now()-t0)/1000),pts=right*50+(right===cards.length?Math.max(0,100-secs):0);
          teams[turn].score+=pts;beep(right===cards.length?'win':'bad');toast(right+' من '+cards.length+' في مكانها الصحيح · +'+pts);cards=order.map(function(ci){return cards[ci];});order=cards.map(function(_,k){return k;});draw(true);};
        runTimer('sqT',90+cards.length*10,function(){toast('انتهى الوقت! تحقّقوا الآن');});}
      else $('sqNext').onclick=function(){si++;turn=(turn+1)%teams.length;show();};
    };
    draw(false);
  };
  $('gmain').innerHTML=stage(g.name,'');bindStage();show();
}
// ---- ملف القضية
function gCase(g){
  resetScores();var cs=shuffle(caseItems()).slice(0,6),i=0;
  var show=function(){
    stopAll();if(i>=cs.length)return endScreen(g,gCase);var x=cs[i],clues=String(x.answer||'').split('\n').filter(Boolean),shown=0;
    var pts=function(){return Math.max(100,400-shown*100);};
    var draw=function(solved){
      $('gBody').innerHTML='<div class="case"><div class="lv-top"><span class="lv-n">🗂️ القضية '+(i+1)+' من '+cs.length+' · '+esc((lessonById[x.lesson_id]||{}).title||'')+'</span><span class="case-pts">قيمة الحل الآن: <b>'+pts()+'</b></span>'+(solved?'':timerHtml('csT'))+'</div>'+qHtml(x)+
        '<div class="clues">'+clues.map(function(c,k){return k<shown||solved?'<div class="clue" dir="auto"><b>'+(solved?'نقطة '+(k+1):'دليل '+(k+1))+':</b> '+rich(c)+'</div>':'';}).join('')+'</div>'+
        (solved?'<button type="button" class="btn primary" id="csNext">'+(i+1<cs.length?'القضية التالية ◀':'النتيجة 🏁')+'</button>':'<div class="jp-act"><button type="button" class="btn" id="csClue"'+(shown>=clues.length-1?' disabled':'')+'>🔍 اكشف دليلًا (−100)</button><button type="button" class="btn primary" id="csSolve">✅ حلّ القضية</button></div><p class="muted small">الفرق تكتب حلها على ورقة. عند «حلّ القضية» تظهر الإجابة كاملة: أعطِ الفريق الصحيح نقاط القضية من الأزرار.</p>')+'</div>';
      renderScore(solved,pts());
      if(!solved){$('csClue').onclick=function(){shown++;draw(false);};$('csSolve').onclick=function(){stopAll();draw(true);};runTimer('csT',x.type==='long'?150:90,function(){toast('انتهى وقت القضية');});}
      else{$('csNext').onclick=function(){i++;show();};bindScoreBtns(pts());}
    };
    draw(false);
  };
  $('gmain').innerHTML=stage(g.name,'');bindStage();show();
}
function bindScoreBtns(v){Array.prototype.forEach.call(document.querySelectorAll('[data-plus]'),function(b){b.onclick=function(){teams[+b.getAttribute('data-plus')].score+=v;beep('ok');renderScore(true,v);bindScoreBtns(v);};});Array.prototype.forEach.call(document.querySelectorAll('[data-minus]'),function(b){b.onclick=function(){teams[+b.getAttribute('data-minus')].score-=v;beep('bad');renderScore(true,v);bindScoreBtns(v);};});}
// ========== قرعة عشوائية بالأرقام: المعلم يكتب عدد الطلاب ويقرع رقماً عشوائياً ==========
function gDraw(g){
  stopAll();
  var defN=Math.max(2,Math.min(99,+(lsGet('tahdir_draw_n')||30)||30));
  var h='<div class="g-setup dw"><h3>🎰 '+esc(g.name)+'</h3><p class="muted">اكتب عدد طلاب الصف ثم اقرع: يدور الرقم بسرعة ثم يستقر على طالب عشوائي. اختر أن يُستبعد كل رقم خرج ليبقى الحظ موزّعًا على الجميع.</p>'+
    '<label class="qrow">عدد الطلاب <input type="number" id="dwN" min="2" max="99" value="'+defN+'"></label>'+
    '<label class="qrow small"><input type="checkbox" id="dwNR"> لا يخرج الرقم مرتين حتى تصفّر السجل</label>'+
    '<div id="dwVal" style="font-size:64px;font-weight:900;text-align:center;color:#1f8a70;border:3px dashed #1f8a70;border-radius:14px;margin:16px 0;padding:6px;min-height:84px;line-height:1.3;user-select:none">؟</div>'+
    '<button type="button" class="btn primary go-btn" id="dwGo">اقرع 🎰</button>'+
    '<div style="margin-top:14px"><span class="muted small">سجل القرعات: </span><span id="dwHist" style="display:inline-flex;flex-wrap:wrap;gap:5px"></span> <button type="button" class="btn small" id="dwZero">تصفير السجل</button></div></div>';
  $('gmain').innerHTML=stage(g.name,h);bindStage();
  var hist=lsGet('tahdir_draw_used_'+(course?course.key:'*'))||[],nr=!!lsGet('tahdir_draw_nr');
  $('dwNR').checked=nr;
  function chips(){var el=$('dwHist');if(el)el.innerHTML=hist.length?hist.map(function(x){return '<span style="border:1px solid #1f8a70;border-radius:9px;padding:1px 9px;font-weight:800;background:#e3f1eb">'+x+'</span>';}).join(''):'<span class="muted small">(فارغ)</span>';}
  $('dwZero').onclick=function(){hist=[];lsSet('tahdir_draw_used_'+(course?course.key:'*'),[]);chips();toast('صُفِّر السجل');};
  $('dwGo').onclick=function(){
    if($('dwVal').textContent==='…')return; // أثناء الدوران لا قرعة جديدة
    var N=Math.max(2,Math.min(99,+$('dwN').value||30));lsSet('tahdir_draw_n',N);
    nr=$('dwNR').checked;lsSet('tahdir_draw_nr',nr);
    var res,free=[];
    if(nr){for(var x=1;x<=N;x++)if(hist.indexOf(x)<0)free.push(x);
      if(!free.length){toast('كل الأرقام خرجت — صفِّر السجل أولًا');return;}
      res=free[Math.floor(Math.random()*free.length)];}
    else res=1+Math.floor(Math.random()*N);
    $('dwGo').disabled=true;$('dwVal').textContent='…';
    var iv=every(60,function(){var v=$('dwVal');if(!v){stopAll();return;}v.textContent=1+Math.floor(Math.random()*N);});
    setTimeout(function(){
      var v=$('dwVal');stopAll();
      if(!v)return; // رجعنا للرئيسية قبل نزول الدوران
      v.textContent=res;
      if(nr&&hist.indexOf(res)<0)hist.push(res);
      lsSet('tahdir_draw_used_'+(course?course.key:'*'),hist);
      chips();$('dwGo').disabled=false;
      beep('ok');var r=v.getBoundingClientRect();fxBurst(r.left+r.width/2,r.top+r.height/2,['#1f8a70','#ffd400','#fff'],16);
      track('game_play','draw');
    },1100);
  };
  chips();
}
// ---- رهان الثقة
function gBet(g){
  resetScores();var qs=shuffle(hardMcq()).slice(0,8).map(mixMcq),i=0;
  var show=function(){
    stopAll();if(i>=qs.length)return endScreen(g,gBet);var x=qs[i],st={pick:{},bet:{},locked:false};
    $('gBody').innerHTML='<div class="bet"><div class="lv-top"><span class="lv-n">السؤال '+(i+1)+' من '+qs.length+'</span>'+timerHtml('btT')+'</div>'+qHtml(x)+
      '<div class="lv-opts">'+x.choices.map(function(c,k){return '<div class="lv-opt o'+k+'" dir="auto"><span class="sh">'+SHAPES[k]+'</span>'+rich(c)+'</div>';}).join('')+'</div>'+
      teamPicks(SHAPES.slice(0,x.choices.length),true)+'<div class="jp-act"><button type="button" class="btn primary" id="btRev">اكشف وحاسب</button></div></div>';
    renderScore(false);bindPicks(st);runTimer('btT',gnum()>=11?60:45,function(){});
    $('btRev').onclick=function(){if(st.locked){i++;show();return;}st.locked=true;stopAll();
      teams.forEach(function(t,k){if(st.pick[k]==null)return;var b=(st.bet[k]||1)*100;t.score+=st.pick[k]===x.correct?b:-b;});
      document.querySelectorAll('.lv-opt')[x.correct].classList.add('right');
      Array.prototype.forEach.call(document.querySelectorAll('[data-tp]'),function(b){if(+b.getAttribute('data-v')===x.correct)b.classList.add('right');});
      beep('ok');renderScore(false);this.textContent=i+1<qs.length?'السؤال التالي ◀':'النتيجة 🏁';};
  };
  $('gmain').innerHTML=stage(g.name,'');bindStage();show();
}
// ---- ما العلاقة؟
function gLinks(g){
  resetScores();var ls=shuffle(packList('links')).slice(0,8),i=0;
  var show=function(){
    stopAll();if(i>=ls.length)return endScreen(g,gLinks);var x=ls[i];
    $('gBody').innerHTML='<div class="links-g"><div class="lv-top"><span class="lv-n">الثنائية '+(i+1)+' من '+ls.length+' · '+esc((lessonById[x.lesson_id]||{}).title||'')+'</span>'+timerHtml('lkT')+'</div>'+
      '<div class="lk-pair"><div class="lk-a" dir="auto">'+esc(x.a)+'</div><div class="lk-mid">⇄</div><div class="lk-a b" dir="auto">'+esc(x.b)+'</div></div><p class="g-hint">ما العلاقة بينهما؟ كل فريق يكتب العلاقة في جملة أو جملتين.</p>'+
      '<div class="jp-act"><button type="button" class="btn primary" id="lkShow">إظهار العلاقة النموذجية</button></div><div id="lkAns"></div></div>';
    renderScore(false);runTimer('lkT',60,function(){beep('bad');});
    $('lkShow').onclick=function(){stopAll();$('lkAns').innerHTML='<div class="jp-ans" dir="auto">'+rich(x.answer)+'</div><p class="muted small">قارنوا إجاباتكم: +100 للإجابة الكاملة (من الأزرار أعلاه).</p><button type="button" class="btn primary" id="lkNext">'+(i+1<ls.length?'التالي ◀':'النتيجة 🏁')+'</button>';renderScore(true,100);bindScoreBtns(100);this.disabled=true;$('lkNext').onclick=function(){i++;show();};};
  };
  $('gmain').innerHTML=stage(g.name,'');bindStage();show();
}

// ---------- البداية ----------
teams=(lsGet('tahdir_teams')||['الفريق الأول','الفريق الثاني']).map(function(n){return {name:n,score:0};});
Promise.all([api('/api/me'),api('/api/courses')]).then(function(r){
  me=r[0];initNav(me);
  courses=(r[1].courses||[]).sort(function(a,b){return ((GRADE_NUM[a.grade]||99)-(GRADE_NUM[b.grade]||99))||a.subject.localeCompare(b.subject,'ar');});
  if(!courses.length){$('gmain').innerHTML='<div class="welcome"><h2>لا توجد صفوف متاحة لحسابك</h2></div>';return;}
  var last=lsGet('tahdir_games_course'),c=courses.filter(function(x){return x.key===last;})[0]||cpDefault(courses);
  selectCourse(c.key);
},function(e){$('gmain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
