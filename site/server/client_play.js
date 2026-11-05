(function(){
'use strict';
var S=null,timer=null,lastKey='',SH=['▲','◆','●','■'];
function ss(k,v){try{if(v===undefined)return JSON.parse(sessionStorage.getItem(k)||'null');if(v===null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,JSON.stringify(v));}catch(e){return null;}}
function rich(t){return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');}
function post(path,b){return fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'حدث خطأ');return j;});});}
function view(h){$('pl').innerHTML=h;}
function joinForm(err){
  clearTimeout(timer);lastKey=''; // نوقف أي استطلاع قديم، وإلا نادى draw على S وهو null
  var c=(new URLSearchParams(location.search).get('c')||'').replace(/\D/g,'');
  view('<form class="pl-card" id="jf"><h1>🎮 تحدي خبير</h1>'+(err?'<p class="pl-err">'+esc(err)+'</p>':'')+
    '<label>رمز التحدي<input id="jc" class="ltr" inputmode="numeric" maxlength="6" value="'+esc(c)+'" placeholder="123456" required></label>'+
    '<label>اسمك<input id="jn" maxlength="24" placeholder="مثال: أحمد 9/2" required autocomplete="off"></label><button class="pl-go" type="submit">دخول ▶</button></form>');
  $(c?'jn':'jc').focus();
  $('jf').onsubmit=function(e){e.preventDefault();var b=this.querySelector('button');b.disabled=true;
    post('/api/play/join',{code:$('jc').value,name:$('jn').value}).then(function(r){S={code:$('jc').value.replace(/\D/g,''),pid:r.pid,t:r.token,title:r.title};ss('tahdir_play',S);loop();},function(er){joinForm(er.message);});};
}
function loop(){clearTimeout(timer);poll();}
function poll(){
  fetch('/api/play/state?code='+S.code+'&pid='+S.pid+'&t='+S.t,{cache:'no-store'}).then(function(r){return r.json();}).then(function(st){
    draw(st);
    // نستمر في السؤال والكشف بسرعة، وبعد النهاية ببطء حتى لا تتجمد شاشة الطالب لو غيّر المعلم الحالة
    var next=st.state==='question'&&!st.answered?1200
      :st.state==='gone'?0
      :st.state==='end'?15000
      :1800;
    if(next)timer=setTimeout(poll,next);
  },function(){timer=setTimeout(poll,3000);});
}
function head(st){return '<div class="pl-head"><span>'+esc(st.you?st.you.name:'')+'</span><b>'+(st.you?st.you.score:0)+' نقطة</b></div>';}
function draw(st){
  var key=st.state+'|'+st.qi+'|'+(st.answered?1:0);
  if(st.state==='gone'){ss('tahdir_play',null);S=null;joinForm('انتهى التحدي أو تغيّر. ادخل برمز جديد.');return;}
  if(key===lastKey&&st.state!=='question')return;
  if(key===lastKey&&st.state==='question'){
    // تحديث العدّاد فقط. لو الطالب جاوب أو انتهى الوقت، نعيد الرسم بدل ترك الشاشة مجمّدة.
    var t=$('plLeft');
    if(t)t.textContent=Math.max(0,Math.ceil(st.left/1000));
    if(st.left<=0||st.answered){lastKey='';draw(st);}
    return;
  }
  lastKey=key;
  if(st.state==='lobby')view(head(st)+'<div class="pl-card c"><div class="pl-big">✅</div><h2>أنت في التحدي!</h2><p>انتظر حتى يبدأ المعلم…</p><p class="muted">'+esc(st.title||'')+'</p></div>');
  else if(st.state==='question'){
    if(st.answered){view(head(st)+'<div class="pl-card c"><div class="pl-big">⏳</div><h2>تم إرسال إجابتك</h2><p>انتظر النتيجة… <b id="plLeft">'+Math.max(0,Math.ceil(st.left/1000))+'</b> ث</p></div>');return;}
    var q=st.q;
    view(head(st)+'<div class="pl-q"><div class="pl-meta">السؤال '+(st.qi+1)+' من '+st.total+' · <b id="plLeft">'+Math.ceil(st.left/1000)+'</b> ث</div><div class="pl-stem" dir="auto">'+rich(q.stem)+'</div>'+(q.table&&q.table.rows?'<table class="g-table">'+q.table.rows.map(function(r,i){return '<tr>'+r.map(function(c){return i?'<td>'+rich(c)+'</td>':'<th>'+rich(c)+'</th>';}).join('')+'</tr>';}).join('')+'</table>':'')+
      '<div class="pl-opts">'+q.choices.map(function(c,i){return '<button type="button" class="pl-o o'+i+'" data-c="'+i+'" dir="auto"><span>'+SH[i]+'</span>'+rich(c)+'</button>';}).join('')+'</div></div>');
    Array.prototype.forEach.call(document.querySelectorAll('[data-c]'),function(b){b.onclick=function(){
      Array.prototype.forEach.call(document.querySelectorAll('[data-c]'),function(x){x.disabled=true;});b.classList.add('sel');
      post('/api/play/answer',{code:S.code,pid:S.pid,t:S.t,qi:st.qi,choice:+b.getAttribute('data-c')}).then(function(){lastKey='';poll();},function(){lastKey='';poll();});};});
  }else if(st.state==='reveal'){
    var m=st.mine;
    view(head(st)+'<div class="pl-card c '+(m&&m.ok?'ok':'bad')+'"><div class="pl-big">'+(m?(m.ok?'🎉':'❌'):'⌛')+'</div><h2>'+(m?(m.ok?'إجابة صحيحة! +'+m.pts:'إجابة خاطئة'):'لم تُجب في الوقت')+'</h2>'+
      '<p>الإجابة الصحيحة: <b dir="auto">'+rich(st.q.choices[st.correct])+'</b></p><p class="pl-rank">ترتيبك: '+st.rank+'</p></div>');
  }else if(st.state==='end'){
    ss('tahdir_play',null);
    view(head(st)+'<div class="pl-card c"><div class="pl-big">'+(st.rank<=3?['🥇','🥈','🥉'][st.rank-1]:'🏁')+'</div><h2>انتهى التحدي</h2><p class="pl-rank">ترتيبك: '+st.rank+'</p><p>مجموعك: '+st.you.score+' نقطة</p><button type="button" class="pl-go" id="plNew">تحدٍّ جديد</button></div>');
    $('plNew').onclick=function(){S=null;lastKey='';joinForm();};
  }
}
S=ss('tahdir_play');
var urlC=(new URLSearchParams(location.search).get('c')||'');
if(S&&(!urlC||urlC===S.code))loop();else joinForm();
})();
