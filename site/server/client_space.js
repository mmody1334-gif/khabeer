// «مساحة الطالب» — صفحة المعلم: ينشئ صفًا برمز (لمادة وصف، وكل الدروس أو دروس مختارة)،
// يعطي طلابه الرمز أو الرابط أو رمز QR، ويتابع تدريبهم: من تدرّب، وعلى أي درس، وكم كانت نتيجته.
(function(){
'use strict';
guard();
var me=null,courses=[],classes=[];
function link(c){return location.origin+'/s/'+c.code;}
function cName(key){var p=String(key).split('|');return p[0]+' — الصف '+p[1];}
function renderList(){
  var h='<div class="an-head"><h2>🎒 مساحة الطالب</h2><p class="muted">أنشئ صفًا لطلابك، وأعطهم الرمز أو الرابط: يدخلون بلا حساب، فيقرؤون ملخصات الدروس ويتدربون بأسئلة بتصحيح فوري وبطاقات المصطلحات، وتظهر لك نتائج تدريبهم هنا.</p></div>'+
    '<div class="an-new"><button type="button" class="btn primary" id="spNew">+ صف جديد</button></div><h3 class="an-sub">صفوفي</h3>';
  h+=classes.length?'<div class="sp-grid">'+classes.map(function(c){return '<div class="sp-card"><div class="sp-h"><b>'+esc(c.name)+'</b><span class="sp-code ltr">'+esc(c.code)+'</span></div><small class="muted">'+esc(cName(c.course))+' · '+(c.lessons?c.lessons.length+' درسًا':'كل الدروس')+'</small>'+
    '<div class="sp-n"><span>'+(c.students||0)+' طالب</span><span>'+(c.attempts||0)+' تدريب</span></div>'+
    '<div class="sp-b"><button type="button" class="btn small primary" data-st="'+c.id+'">📊 النتائج</button><button type="button" class="btn small" data-sh="'+c.id+'">🔗 الرابط و QR</button><button type="button" class="btn small" data-ed="'+c.id+'">✎</button><button type="button" class="x" data-del="'+c.id+'">×</button></div></div>';}).join('')+'</div>':'<p class="muted">لا توجد صفوف بعد.</p>';
  $('spMain').innerHTML=h;
  $('spNew').onclick=function(){edit(null);};
  var by=function(id){return classes.filter(function(c){return c.id===+id;})[0];};
  Array.prototype.forEach.call(document.querySelectorAll('[data-sh]'),function(b){b.onclick=function(){share(by(b.getAttribute('data-sh')));};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-ed]'),function(b){b.onclick=function(){edit(by(b.getAttribute('data-ed')));};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-st]'),function(b){b.onclick=function(){stats(by(b.getAttribute('data-st')));};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-del]'),function(b){b.onclick=function(){dialog({title:'حذف الصف؟',message:'سيتوقف الرمز عن العمل وتُحذف نتائج تدريب الطلاب فيه.',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/classes/'+b.getAttribute('data-del'),null,'DELETE').then(load);});};});
}
function load(){return api('/api/classes').then(function(r){classes=r.classes||[];renderList();},function(e){toast(e.message);});}
function share(c){
  var url=link(c),qr='';
  try{if(typeof qrSvg==='function')qr=qrSvg(url,220);}catch(e){}
  dialog({title:'رابط «'+c.name+'»',okText:'نسخ الرابط',cancelText:'إغلاق',html:'<div class="sp-share"><div class="sp-big ltr">'+esc(c.code)+'</div><p class="ltr"><a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(url)+'</a></p>'+(qr?'<div class="sp-qr">'+qr+'</div>':'')+'<p class="muted small">يفتح الطلاب الرابط، أو يدخلون '+esc(location.host)+'/s ويكتبون الرمز.</p></div>'})
    .then(function(ok){if(ok)copyText(url);});
}
function edit(c){
  var cur=c?c.course:(courses[0]&&courses[0].key),sel=c&&c.lessons?c.lessons.slice():null;
  var draw=function(lessons){
    var h='<div class="rsf-grid"><label class="rsf wide">اسم الصف<input class="an-in" id="spName" value="'+esc(c?c.name:'')+'" placeholder="مثال: الأحياء — التاسع / 2"></label>'+
      '<label class="rsf wide">المادة والصف<select class="an-in" id="spCourse">'+courses.map(function(x){return '<option value="'+esc(x.key)+'"'+(x.key===cur?' selected':'')+'>'+esc(cName(x.key))+'</option>';}).join('')+'</select></label>'+
      '<label class="rsf wide"><span><input type="checkbox" id="spAll"'+(sel?'':' checked')+'> كل دروس الصف</span></label></div>'+
      '<div class="sp-ls" id="spLs"'+(sel?'':' hidden')+'>'+lessons.map(function(l){return '<label><input type="checkbox" data-l="'+l.id+'"'+(sel&&sel.indexOf(l.id)>=0?' checked':'')+'> الوحدة '+esc(l.unit)+': '+esc(l.title)+'</label>';}).join('')+'</div>';
    return h;
  };
  var lessonsFor=function(key){return api('/api/quiz/bank?key='+encodeURIComponent(key)).then(function(b){return b.lessons||[];},function(){return [];});};
  lessonsFor(cur).then(function(ls){
    dialog({title:c?'تعديل الصف':'صف جديد',okText:c?'حفظ':'إنشاء الرمز',cancelText:'إلغاء',html:'<div id="spForm">'+draw(ls)+'</div>'}).then(function(ok){
      if(!ok)return;
    });
    var bind=function(){
      $('spCourse').onchange=function(){cur=this.value;sel=null;var nm=$('spName').value;lessonsFor(cur).then(function(l2){$('spForm').innerHTML=draw(l2);$('spName').value=nm;bind();});};
      $('spAll').onchange=function(){$('spLs').hidden=this.checked;};
    };
    bind();
    // نلتقط القيم قبل إغلاق النافذة
    var okBtn=$('mOk');okBtn.addEventListener('click',function(){
      var name=$('spName').value.trim(),all=$('spAll').checked,ids=[].slice.call(document.querySelectorAll('#spLs [data-l]:checked')).map(function(x){return +x.getAttribute('data-l');});
      if(!name){toast('اكتب اسم الصف');return;}
      api('/api/classes',{id:c?c.id:null,name:name,course:cur,lessons:all?null:ids}).then(function(r){load().then(function(){if(!c){var n=classes.filter(function(x){return x.id===r.id;})[0];if(n)share(n);}});},function(e){toast(e.message);});
    },true);
  });
}
function stats(c){
  $('spMain').innerHTML='<div class="welcome"><h2>جارٍ التحميل…</h2></div>';
  Promise.all([api('/api/classes/'+c.id+'/stats'),api('/api/quiz/bank?key='+encodeURIComponent(c.course)).catch(function(){return {lessons:[]};})]).then(function(r){
    var a=r[0].attempts||[],T={};(r[1].lessons||[]).forEach(function(l){T[l.id]=l.title;});
    var st={},le={};
    a.forEach(function(x){var p=x.max?x.score/x.max:0,k=x.name||'طالب';(st[k]=st[k]||{n:0,s:0,last:0,ls:{}});st[k].n++;st[k].s+=p;st[k].last=Math.max(st[k].last,x.at);st[k].ls[x.lesson_id]=1;
      (le[x.lesson_id]=le[x.lesson_id]||{n:0,s:0,who:{}});le[x.lesson_id].n++;le[x.lesson_id].s+=p;le[x.lesson_id].who[k]=1;});
    var h='<div class="an-bar"><button type="button" class="btn small" id="spBack">→ صفوفي</button><b>📊 '+esc(c.name)+'</b><span class="muted small">'+esc(cName(c.course))+' · الرمز <span class="ltr">'+esc(c.code)+'</span></span></div>';
    if(!a.length)h+='<div class="qcard"><p class="muted">لم يتدرب أي طالب بعد. شارك الرابط مع طلابك.</p><button type="button" class="btn" id="spShare">🔗 الرابط و QR</button></div>';
    else{
      h+='<div class="an-cards"><div><b>'+Object.keys(st).length+'</b><span>طالبًا تدرّبوا</span></div><div><b>'+a.length+'</b><span>تدريبًا</span></div><div><b>'+Math.round(a.reduce(function(s,x){return s+(x.max?x.score/x.max:0);},0)/a.length*100)+'%</b><span>متوسط النتائج</span></div></div>';
      h+='<section class="qcard"><h3>الطلاب</h3><div class="an-scroll"><table class="an-t"><thead><tr><th>الطالب</th><th>عدد التدريبات</th><th>الدروس</th><th>متوسط النتيجة</th><th>آخر تدريب</th></tr></thead><tbody>'+
        Object.keys(st).sort(function(x,y){return st[y].n-st[x].n;}).map(function(k){var s=st[k],p=Math.round(s.s/s.n*100);return '<tr><td style="text-align:right">'+esc(k)+'</td><td>'+s.n+'</td><td>'+Object.keys(s.ls).length+'</td><td style="color:'+(p<50?'#c0392b':'inherit')+'"><b>'+p+'%</b></td><td>'+esc(fmtDate(s.last))+'</td></tr>';}).join('')+'</tbody></table></div></section>';
      h+='<section class="qcard"><h3>الدروس</h3><div class="an-scroll"><table class="an-t"><thead><tr><th>الدرس</th><th>عدد الطلاب</th><th>عدد التدريبات</th><th>متوسط النتيجة</th></tr></thead><tbody>'+
        Object.keys(le).sort(function(x,y){return le[y].n-le[x].n;}).map(function(k){var s=le[k],p=Math.round(s.s/s.n*100);return '<tr><td style="text-align:right">'+esc(T[k]||('درس '+k))+'</td><td>'+Object.keys(s.who).length+'</td><td>'+s.n+'</td><td style="color:'+(p<50?'#c0392b':'inherit')+'"><b>'+p+'%</b></td></tr>';}).join('')+'</tbody></table></div></section>';
    }
    $('spMain').innerHTML=h;$('spBack').onclick=load;if($('spShare'))$('spShare').onclick=function(){share(c);};
  },function(e){toast(e.message);load();});
}
Promise.all([api('/api/me'),api('/api/courses')]).then(function(r){me=r[0];initNav(me);courses=(r[1].courses||[]).filter(function(c){return c.lessons;});load();},function(e){$('spMain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
