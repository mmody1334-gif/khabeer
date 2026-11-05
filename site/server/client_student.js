// «مساحة الطالب» (/s/رمز الصف): بلا حساب. الطالب يكتب اسمه مرة (يُحفظ على جهازه)، ثم يختار الدرس:
// الملخص · تدريب بتصحيح فوري · بطاقات المصطلحات. نتيجة كل تدريب تصل لمعلمه (الاسم والدرجة فقط).
(function(){
'use strict';
var CODE=(location.pathname.split('/')[2]||new URLSearchParams(location.search).get('c')||'').toUpperCase(),INFO=null,L=null,Q=null;
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
function rich(t){return esc(t||'').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');}
function get(path){return fetch(path,{cache:'no-store'}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'خطأ');return j;});});}
function post(path,b){return fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json();});}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function view(h){$('st').innerHTML=h;window.scrollTo(0,0);}
function name(){return ls('st_name_'+CODE)||'';}
function top(back){return '<header class="st-top">'+(back?'<button type="button" class="st-back" id="stBack">→</button>':'')+'<div><b>'+esc(INFO?INFO.name:'مساحة الطالب')+'</b><small>'+(INFO?esc(INFO.subject+' · الصف '+INFO.grade):'')+'</small></div><span class="st-me">'+esc(name()||'')+'</span></header>';}
function codeForm(err){
  view('<form class="st-card st-join" id="cf"><div class="st-logo">🎒</div><h1>مساحة الطالب</h1><p>اكتب رمز الصف الذي أعطاك إياه معلمك.</p>'+(err?'<p class="st-err">'+esc(err)+'</p>':'')+
    '<input id="cc" class="ltr" maxlength="6" value="'+esc(CODE)+'" placeholder="ABC123" autocomplete="off" required><button class="st-go">دخول ▶</button></form>');
  $('cf').onsubmit=function(e){e.preventDefault();CODE=$('cc').value.trim().toUpperCase();history.replaceState(null,'','/s/'+CODE);start();};
}
function nameForm(){
  view(top(false)+'<form class="st-card st-join" id="nf"><h2>أهلًا بك 👋</h2><p>اكتب اسمك ليعرف معلمك تقدّمك في التدريب.</p><input id="nn" maxlength="30" placeholder="مثال: أحمد سالم" required autocomplete="off"><button class="st-go">متابعة ▶</button></form>');
  $('nn').focus();$('nf').onsubmit=function(e){e.preventDefault();ls('st_name_'+CODE,$('nn').value.trim());home();};
}
function start(){
  if(!/^[A-Z0-9]{6}$/.test(CODE))return codeForm('');
  get('/api/s/info?c='+CODE).then(function(r){INFO=r;document.title=r.name+' · مساحة الطالب';if(!name())nameForm();else home();},function(e){codeForm(e.message);});
}
function home(){
  var units={},order=[];INFO.lessons.forEach(function(l){var k=l.unit;if(!units[k]){units[k]={name:l.unit_name,ls:[]};order.push(k);}units[k].ls.push(l);});
  var done={};try{done=JSON.parse(ls('st_done_'+CODE)||'{}')||{};}catch(e){}
  var h=top(false)+'<div class="st-hello">مرحبًا <b>'+esc(name())+'</b> — اختر درسًا لتراجعه وتتدرب عليه. <button type="button" class="st-link" id="chg">تغيير الاسم</button></div>';
  order.forEach(function(k){h+='<section class="st-unit"><h2>الوحدة '+esc(k)+(units[k].name?': '+esc(units[k].name):'')+'</h2><div class="st-ls">'+
    units[k].ls.map(function(l){var d=done[l.id];return '<button type="button" class="st-l" data-l="'+l.id+'"><span>'+esc(l.title)+'</span>'+(d!=null?'<em>'+d+'%</em>':'')+'</button>';}).join('')+'</div></section>';});
  if(!order.length)h+='<p class="st-card">لا توجد دروس متاحة بعد.</p>';
  view(h);
  $('chg').onclick=nameForm;
  Array.prototype.forEach.call(document.querySelectorAll('[data-l]'),function(b){b.onclick=function(){openLesson(+b.getAttribute('data-l'));};});
}
function openLesson(id,tab){
  view(top(true)+'<div class="st-card">جارٍ التحميل…</div>');$('stBack').onclick=home;
  get('/api/s/lesson?c='+CODE+'&id='+id).then(function(r){L=r;lessonView(tab||(r.summary?'sum':'quiz'));},function(e){view(top(true)+'<div class="st-card st-err">'+esc(e.message)+'</div>');$('stBack').onclick=home;});
}
function lessonView(tab){
  var s=L.summary,terms=s&&s.terms||[];
  var tabs=[['sum','📖 الملخص',!!s],['quiz','✍️ تدريب',L.items.length>0],['cards','🃏 بطاقات المصطلحات',terms.length>0]].filter(function(t){return t[2];});
  var h=top(true)+'<h1 class="st-title">'+esc(L.lesson.title)+'</h1><div class="st-tabs">'+tabs.map(function(t){return '<button type="button" class="'+(t[0]===tab?'on':'')+'" data-tab="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div><div id="stBody"></div>';
  view(h);$('stBack').onclick=home;
  Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'),function(b){b.onclick=function(){lessonView(b.getAttribute('data-tab'));};});
  if(tab==='sum')summary();else if(tab==='cards')cards(terms);else quiz();
}
function summary(){
  var s=L.summary,h='<div class="st-card st-sum">'+(s.intro?'<p class="st-intro">'+rich(s.intro)+'</p>':'');
  (s.outcomes||[]).forEach(function(o){h+='<h3>'+(o.code?'<span>'+esc(o.code)+'</span> ':'')+esc(o.text)+'</h3><ul>'+(o.points||[]).map(function(p){return '<li>'+rich(p)+'</li>';}).join('')+'</ul>';});
  if((s.terms||[]).length)h+='<h3>المصطلحات</h3><dl>'+s.terms.map(function(t){return '<dt>'+esc(t.t)+'</dt><dd>'+rich(t.d)+'</dd>';}).join('')+'</dl>';
  if((s.remember||[]).length)h+='<h3>تذكّر</h3><ul>'+s.remember.map(function(t){return '<li>'+rich(t)+'</li>';}).join('')+'</ul>';
  $('stBody').innerHTML=h+'</div>'+(L.items.length?'<button type="button" class="st-go wide" id="toQ">✍️ تدرّب على هذا الدرس</button>':'');
  if($('toQ'))$('toQ').onclick=function(){lessonView('quiz');};
}
function cards(terms){
  var i=0,ord=shuffle(terms);
  function draw(){var t=ord[i];$('stBody').innerHTML='<div class="st-flip" id="fl" tabindex="0"><div class="st-fc"><b>'+esc(t.t)+'</b><small>اضغط لعرض المعنى</small></div></div><div class="st-nav"><button type="button" class="st-go" id="pv">→ السابق</button><span>'+(i+1)+' / '+ord.length+'</span><button type="button" class="st-go" id="nx">التالي ←</button></div>';
    $('fl').onclick=function(){var f=this;if(f.classList.toggle('on'))f.firstChild.innerHTML='<b>'+esc(t.t)+'</b><p>'+rich(t.d)+'</p>';else f.firstChild.innerHTML='<b>'+esc(t.t)+'</b><small>اضغط لعرض المعنى</small>';};
    $('pv').onclick=function(){i=(i-1+ord.length)%ord.length;draw();};$('nx').onclick=function(){i=(i+1)%ord.length;draw();};}
  draw();
}
// ---------- التدريب ----------
function quiz(){
  var mc=shuffle(L.items.filter(function(x){return x.type==='mcq'&&x.choices&&x.choices.length&&!x.img;})),op=shuffle(L.items.filter(function(x){return x.type!=='mcq'&&!x.img;}));
  var items=mc.slice(0,7).concat(op.slice(0,Math.max(3,10-Math.min(7,mc.length))));
  items=items.slice(0,10);
  if(!items.length){$('stBody').innerHTML='<div class="st-card">لا توجد أسئلة تدريب لهذا الدرس.</div>';return;}
  Q={items:items,i:0,score:0,max:0,answered:false};qDraw();
}
function qDraw(){
  if(Q.i>=Q.items.length)return qEnd();
  var it=Q.items[Q.i],h='<div class="st-prog"><span style="width:'+Math.round(Q.i/Q.items.length*100)+'%"></span></div><div class="st-card st-q"><div class="st-qn">سؤال '+(Q.i+1)+' من '+Q.items.length+'</div><p class="st-stem">'+rich(it.stem)+'</p>';
  if(it.table&&it.table.rows)h+='<table class="st-t">'+it.table.rows.map(function(r,ri){return '<tr>'+r.map(function(c){return (ri?'<td>':'<th>')+rich(c)+(ri?'</td>':'</th>');}).join('')+'</tr>';}).join('')+'</table>';
  if(it.type==='mcq'){h+='<div class="st-ch">'+it.choices.map(function(c,k){return '<button type="button" data-k="'+k+'">'+rich(c)+'</button>';}).join('')+'</div>';}
  else h+=(INFO.ai?'<textarea class="st-ans" id="ans" rows="3" placeholder="اكتب إجابتك هنا ثم اضغط «صحّح إجابتي»"></textarea><div class="st-nav"><button type="button" class="st-go" id="aiG">✨ صحّح إجابتي</button><button type="button" class="st-link" id="show">عرض نموذج الإجابة فقط</button></div>'
    :'<textarea class="st-ans" id="ans" rows="3" placeholder="اكتب إجابتك هنا (اختياري) ثم اعرض نموذج الإجابة"></textarea><button type="button" class="st-go" id="show">عرض نموذج الإجابة</button>');
  h+='<div id="fb"></div></div>';
  $('stBody').innerHTML=h;
  if(it.type==='mcq')Array.prototype.forEach.call(document.querySelectorAll('.st-ch [data-k]'),function(b){b.onclick=function(){
    if(Q.answered)return;Q.answered=true;var k=+b.getAttribute('data-k'),ok=k===it.correct;Q.max+=1;if(ok)Q.score+=1;
    Array.prototype.forEach.call(document.querySelectorAll('.st-ch [data-k]'),function(x){var kk=+x.getAttribute('data-k');x.classList.add(kk===it.correct?'ok':(kk===k?'no':'dim'));});
    $('fb').innerHTML='<div class="st-fb '+(ok?'ok':'no')+'">'+(ok?'✓ إجابة صحيحة، أحسنت!':'✗ الإجابة الصحيحة: '+rich(it.choices[it.correct]))+(it.notes?'<small>'+rich(it.notes)+'</small>':'')+'</div><button type="button" class="st-go" id="nx">التالي ←</button>';
    $('nx').onclick=next;};});
  else if($('aiG'))$('aiG').onclick=function(){
    var a=$('ans').value.trim();if(a.length<2){$('ans').focus();return;}
    var btn=this;btn.disabled=true;btn.textContent='جارٍ التصحيح…';
    post('/api/s/grade',{c:CODE,lid:L.lesson.id,qid:it.qid,answer:a}).then(function(r){
      if(r.error){btn.disabled=false;btn.textContent='✨ صحّح إجابتي';$('fb').innerHTML='<div class="st-fb no">'+esc(r.error)+'</div>';return;}
      $('ans').disabled=true;var fr=r.max?r.score/r.max:0,cls=fr>=0.99?'ok':fr>0?'key':'no';
      btn.parentNode.remove();Q.max+=1;Q.score+=fr;
      $('fb').innerHTML='<div class="st-fb '+cls+'"><b>'+(fr>=0.99?'✓ ':fr>0?'½ ':'✗ ')+'درجتك: '+r.score+' من '+r.max+'</b><br>'+esc(r.feedback||'')+'</div><div class="st-fb key"><b>نموذج الإجابة:</b><br>'+rich(it.answer)+'</div><button type="button" class="st-go" id="nx">التالي ←</button>';
      $('nx').onclick=next;
    },function(){btn.disabled=false;btn.textContent='✨ صحّح إجابتي';toast&&toast('تعذّر الاتصال، حاول مرة أخرى');});
  };
  if($('show'))$('show').onclick=function(){if($('aiG'))$('aiG').parentNode.remove();
    this.remove();$('fb').innerHTML='<div class="st-fb key"><b>نموذج الإجابة:</b><br>'+rich(it.answer)+(it.notes?'<small>'+rich(it.notes)+'</small>':'')+'</div><p class="st-self">قارن إجابتك بالنموذج: هل كانت صحيحة؟</p><div class="st-selfb"><button type="button" class="st-go ok" data-s="1">✓ نعم</button><button type="button" class="st-go half" data-s="0.5">½ جزئيًا</button><button type="button" class="st-go no" data-s="0">✗ لا</button></div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-s]'),function(b){b.onclick=function(){Q.max+=1;Q.score+=+b.getAttribute('data-s');next();};});
  };
}
function next(){Q.i++;Q.answered=false;qDraw();}
function qEnd(){
  var p=Q.max?Math.round(Q.score/Q.max*100):0,done={};try{done=JSON.parse(ls('st_done_'+CODE)||'{}')||{};}catch(e){}
  done[L.lesson.id]=p;ls('st_done_'+CODE,JSON.stringify(done));
  post('/api/s/attempt',{c:CODE,name:name(),lid:L.lesson.id,score:Q.score,max:Q.max,n:Q.items.length}).catch(function(){});
  $('stBody').innerHTML='<div class="st-card st-end"><div class="st-big">'+(p>=80?'🌟':p>=50?'👍':'💪')+'</div><h2>'+p+'%</h2><p>'+(p>=80?'ممتاز! أتقنت هذا الدرس.':p>=50?'جيد، راجع الملخص وحاول مرة أخرى لتتقنه.':'لا بأس، اقرأ الملخص جيدًا ثم أعد التدريب.')+'</p>'+
    '<div class="st-nav"><button type="button" class="st-go" id="again">🔁 تدريب جديد</button><button type="button" class="st-go" id="sum">📖 الملخص</button><button type="button" class="st-go" id="hm">الدروس</button></div></div>';
  $('again').onclick=function(){lessonView('quiz');};$('sum').onclick=function(){lessonView(L.summary?'sum':'quiz');};$('hm').onclick=home;
}
start();
})();
