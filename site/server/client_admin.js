(function(){
'use strict';
guard();
// «الشاملة»: نفس اللوحة على /shamela، تعرض فقط المعلمين المنقولين إليها (مخفية عن اللوحة الأساسية)
var VAULT=/^\/shamela/.test(location.pathname),VQ=VAULT?'vault=1':'';
function vq(u){return VQ?u+(u.indexOf('?')>=0?'&':'?')+VQ:u;}
var data=null,act=null,tab='teachers',q='',rep=null,repDays=30,crs=null,lessonsAll=null,openCourse=null,ntc=null;
var GRADES=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر'];
function gn(g){var i=GRADES.indexOf(g);return i<0?99:i;}
var REASONS={wrong_password:'كلمة مرور خاطئة',device_limit:'جهاز إضافي مرفوض',disabled:'حساب موقوف',locked:'محاولات كثيرة'};
// تسميات أنواع الأحداث في سجل النشاط. يجب أن تغطي كل نوع في EVENT_TYPES داخل worker_src.js،
// وإلا ظهر الحدث في السجل بنصه الإنجليزي الخام.
var TYPES={login:'دخول',view:'فتح درس',copy_all:'نسخ التحضير كاملًا',copy_json:'نسخ لأداة نور',copy_field:'نسخ خانة',copy_hw:'نسخ الواجب',send_prep:'إرسال تحضير إلى نور',send_hw:'إرسال واجب إلى نور',quiz_make:'تكوين اختبار قصير',review_make:'تكوين مراجعة وحدة',quiz_print:'طباعة اختبار',quiz_word:'تحميل اختبار Word',quiz_save:'حفظ اختبار',diag_run:'تشغيل اختبار تشخيصي',diag_print:'طباعة نتيجة التشخيص',remedial_make:'تكوين خطة علاجية / نشاط صفي',remedial_print:'طباعة خطة علاجية',remedial_word:'تحميل خطة علاجية Word',summary_make:'تكوين ملخص',summary_print:'طباعة ملخص',summary_word:'تحميل ملخص Word',finals_open:'فتح الاختبارات النهائية',finals_print:'طباعة أسئلة وزارية',game_play:'تشغيل لعبة',game_live:'تحدٍّ مباشر بالجوالات',grade_start:'بدء تصحيح واجب',tasks_fetch:'جلب مهام نور',device_stale_removed:'إزالة جهاز مهمل تلقائيًا'};
function load(){
  return Promise.all([api(vq('/api/admin/stats')),api(vq('/api/admin/activity')),api('/api/admin/courses'),api('/api/lessons'),api(vq('/api/admin/report?days='+repDays)),api(vq('/api/admin/notices'))]).then(function(r){data=r[0];act=r[1];crs=r[2];lessonsAll=r[3].lessons;rep=r[4];ntc=r[5];render();},function(e){if(e.message==='vault_locked')return vaultLock();toast(e.message);});
}
// «الشاملة» محمية بكلمة مرور خاصة تُطلب مرة لكل جلسة دخول
function vaultLock(){
  $('dash').innerHTML='<form class="vault-lock" id="vaultForm" autocomplete="off"><div class="vl-ico">🔒</div><h2>لوحة التحكم الشاملة</h2><p>أدخل كلمة المرور الخاصة بهذه اللوحة.</p>'+
    '<input type="password" id="vaultPw" inputmode="numeric" placeholder="كلمة المرور" aria-label="كلمة مرور اللوحة الشاملة" required>'+
    '<button type="submit" class="btn primary">فتح اللوحة</button><a class="vl-back" href="/admin">العودة إلى لوحة التحكم</a></form>';
  var f=$('vaultForm'),i=$('vaultPw');i.focus();
  f.onsubmit=function(ev){ev.preventDefault();var b=f.querySelector('button');b.disabled=true;
    api('/api/admin/vault-unlock',{password:i.value}).then(function(){$('dash').innerHTML='<div class="empty-state">جارٍ تحميل البيانات…</div>';load();},function(e){b.disabled=false;i.value='';i.focus();toast(e.message);});};
}
function courseName(k){var p=String(k).split('|');return p[0]+' — الصف '+gLabel(p[1]);}
function sortedCourses(){return (crs.courses||[]).slice().sort(function(a,b){return (gn(a.grade)-gn(b.grade))||a.subject.localeCompare(b.subject,'ar');});}
// ---------- الصلاحيات: تجميعها بالمواد بدل تكرار كل صف ----------
// مفتاح الصلاحية «المادة|الصف». المعلم الذي يدرّس العربية في سبعة صفوف كان يظهر
// بسبع رقاقات متشابهة تشغل الجدول كله. فنجمعها في رقاقة واحدة لكل مادة.
function scopeSubjects(){
  var out=[],seen={};
  sortedCourses().forEach(function(c){if(!seen[c.subject]){seen[c.subject]=1;out.push(c.subject);}});
  return out;
}
function subjectGrades(s){
  var g=[],seen={};
  sortedCourses().forEach(function(c){if(c.subject===s&&!seen[c.grade]){seen[c.grade]=1;g.push(c.grade);}});
  return g.sort(function(a,b){return gn(a)-gn(b);});
}
function parseScope(u){
  var sc=[];try{sc=JSON.parse(u.scope||'[]')||[];}catch(e){}
  var by={};
  sc.forEach(function(k){var p=String(k).split('|');if(!p[0]||!p[1])return;(by[p[0]]=by[p[0]]||[]).push(p[1]);});
  return {list:sc,by:by};
}
// رقاقة مختصرة: اسم المادة إن كانت كل صفوفها مسموحة، وإلا اسم المادة مع صفوفها
function scopeChip(subject,grades){
  var all=subjectGrades(subject);
  var full=all.length&&all.every(function(g){return grades.indexOf(g)>=0;});
  return full?'<span class="chip-s" title="كل صفوف '+esc(subject)+'">'+esc(subject)+'<b class="sc-n">'+all.length+'</b></span>'
             :'<span class="chip-s" title="'+esc(grades.map(function(g){return 'الصف '+gLabel(g);}).join(' · '))+'">'+esc(subject)+' <span class="sc-g">'+grades.map(gLabel).join(' · ')+'</span></span>';
}
function scopeChips(u){
  var p=parseScope(u);
  var subs=Object.keys(p.by);
  if(!subs.length)return '<span class="muted">كل الصفوف</span>';
  return subs.map(function(s){return scopeChip(s,p.by[s]);}).join('');
}
// قائمة الصفوف كاملة (للعرض في نافذة التفاصيل)
function scopeFull(u){
  var p=parseScope(u);
  var subs=Object.keys(p.by);
  if(!subs.length)return '<p class="muted">لم تُحدَّد صفوف — يرى المعلم كل الصفوف.</p>';
  return '<ul class="sc-full">'+subs.map(function(s){
    var gs=p.by[s].slice().sort(function(a,b){return gn(a)-gn(b);});
    var all=subjectGrades(s),full=all.length&&all.every(function(g){return gs.indexOf(g)>=0;});
    return '<li><b>'+esc(s)+'</b>'+(full?' <span class="pill ok">كل الصفوف ('+all.length+')</span>':'')
      +'<div class="sc-g2">'+gs.map(function(g){return '<span class="chip-s">الصف '+esc(gLabel(g))+'</span>';}).join('')+'</div></li>';
  }).join('')+'</ul>';
}
// ---------- التقرير ----------
function reportView(){
  var t=rep.totals,rows=rep.rows.filter(function(r){return r.role!=='admin';});
  var h='<div class="toolbar"><div class="seg-r">'+[[7,'آخر 7 أيام'],[30,'آخر 30 يومًا'],[0,'كل المدة']].map(function(o){return '<button type="button" class="btn small'+(repDays===o[0]?' primary':'')+'" data-days="'+o[0]+'">'+o[1]+'</button>';}).join('')+'</div><button type="button" class="btn" id="csvBtn">⬇ تنزيل التقرير (Excel/CSV)</button></div>';
  h+='<div class="kpis">'+[['معلمون استخدموا الموقع',rows.filter(function(r){return r.last_active;}).length],['تحضيرات أُرسلت لنور',t.preps],['واجبات أُرسلت لنور',t.hws],['اختبارات ومراجعات',t.quizzes],['مرات الدخول',t.logins]].map(function(k){return '<div class="kpi"><span class="kpi-n">'+k[1]+'</span><span class="kpi-l">'+k[0]+'</span></div>';}).join('')+'</div>';
  h+='<div class="t-wrap"><table class="tbl"><thead><tr><th>المعلم</th><th>الصفوف</th><th>دخول</th><th>تحضيرات</th><th>واجبات</th><th>اختبارات</th><th>مراجعات</th><th>ألعاب</th><th>علاجي/ملخصات</th><th>طباعة/Word</th><th>آخر دخول</th></tr></thead><tbody>'+
    rows.sort(function(a,b){return (b.preps+b.hws+b.quizzes)-(a.preps+a.hws+a.quizzes)||(b.last_active||0)-(a.last_active||0);}).map(function(r){
      var sc=[];try{sc=JSON.parse(r.scope||'[]')||[];}catch(e){}
      return '<tr><td><b>'+esc(r.name)+'</b><div class="sub ltr">'+esc(r.username)+'</div></td><td>'+(sc.length?scopeChips(r):'<span class="muted">كل الصفوف</span>')+'</td>'+
        '<td class="num">'+r.logins+'</td><td class="num">'+r.preps+'<span class="sub"> · '+r.prep_lessons+' درس</span></td><td class="num">'+r.hws+'<span class="sub"> · '+r.hw_lessons+' درس</span></td><td class="num">'+r.quizzes+'</td><td class="num">'+r.reviews+'</td><td class="num">'+(r.games||0)+'</td><td class="num">'+(r.study||0)+'</td><td class="num">'+r.prints+'</td><td>'+esc(ago(r.last_login))+'</td></tr>';
    }).join('')+'</tbody></table></div>';
  if(rep.by_grade.length)h+='<section class="card"><h3>الاستخدام حسب الصف</h3><div class="t-wrap" style="box-shadow:none"><table class="tbl" style="min-width:420px"><thead><tr><th>الصف</th><th>تحضيرات</th><th>واجبات</th><th>اختبارات ومراجعات</th></tr></thead><tbody>'+rep.by_grade.sort(function(a,b){return gn(a.grade)-gn(b.grade);}).map(function(g){return '<tr><td>'+esc(g.grade)+'</td><td class="num">'+g.preps+'</td><td class="num">'+g.hws+'</td><td class="num">'+g.quizzes+'</td></tr>';}).join('')+'</tbody></table></div></section>';
  if(rep.daily.length){var byD={};rep.daily.forEach(function(d){byD[d.d]=d;});var today=Math.floor((Date.now()+14400000)/86400000),days=[];
    for(var di=today-29;di<=today;di++)days.push(byD[di]||{d:di,users:0,preps:0,hws:0,quizzes:0});
    var mx=Math.max.apply(null,days.map(function(d){return d.preps+d.hws+d.quizzes;}).concat([1]));
    h+='<section class="card"><h3>النشاط اليومي (آخر 30 يومًا)</h3><div class="bars" role="img" aria-label="رسم النشاط اليومي">'+days.map(function(d){var v=d.preps+d.hws+d.quizzes,dt=new Date(d.d*86400000);return '<div class="bar" title="'+esc(dt.toLocaleDateString('ar-OM',{day:'numeric',month:'short'}))+': '+d.preps+' تحضير، '+d.hws+' واجب، '+d.quizzes+' اختبار، '+d.users+' معلم"><span style="height:'+Math.max(3,Math.round(v/mx*100))+'%"></span></div>';}).join('')+'</div><p class="muted">كل عمود يوم: مجموع التحضيرات والواجبات والاختبارات. مرّر المؤشر على العمود للتفاصيل.</p></section>';}
  return h;
}
function downloadCsv(){
  var rows=[['المعلم','اسم المستخدم','الصفوف','مرات الدخول','تحضيرات','دروس محضّرة','واجبات','دروس بواجبات','اختبارات','مراجعات','ألعاب','خطط علاجية/ملخصات','طباعة/Word','آخر دخول']];
  rep.rows.filter(function(r){return r.role!=='admin';}).forEach(function(r){var sc=[];try{sc=JSON.parse(r.scope||'[]')||[];}catch(e){}
    rows.push([r.name,r.username,sc.map(courseName).join(' / ')||'كل الصفوف',r.logins,r.preps,r.prep_lessons,r.hws,r.hw_lessons,r.quizzes,r.reviews,r.games||0,r.study||0,r.prints,r.last_login?new Date(r.last_login).toLocaleString('ar-OM'):'']);});
  var csv=rows.map(function(r){return r.map(function(c){c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',');}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='تقرير-الاستخدام-'+(repDays?repDays+'-يوم':'كامل')+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);
}
// ---------- المواد والدروس ----------
function coursesView(){
  var list=sortedCourses();
  var h='<div class="toolbar"><p class="muted" style="flex:1;margin:0">كل صف ومادة يظهر هنا. الصفوف الأصلية (الأحياء 9–12 والعلوم 5) لها تحضير وبنك أسئلة جاهز. أضف مادة أو صفًا جديدًا ثم أضف دروسه، ويظهر للمعلمين المسموح لهم في صفحة الدروس مع الإرسال لنور.</p><button type="button" class="btn primary" id="addCourse">+ مادة / صف جديد</button></div>';
  h+='<div class="t-wrap"><table class="tbl" style="min-width:640px"><thead><tr><th>المادة والصف</th><th>الدروس</th><th>دروس أضفتها</th><th>بنك الأسئلة</th><th>المعلمون</th><th></th></tr></thead><tbody>'+list.map(function(c){
    var tn=data.users.filter(function(u){var sc=[];try{sc=JSON.parse(u.scope||'[]')||[];}catch(e){}return u.role!=='admin'&&(!sc.length||sc.indexOf(c.key)>=0);}).length;
    return '<tr><td><b>'+esc(c.subject)+'</b> — الصف '+esc(gLabel(c.grade))+'</td><td class="num">'+c.lessons+'</td><td class="num">'+c.custom+'</td><td class="num">'+(c.quiz_items||'<span class="muted">—</span>')+'</td><td class="num">'+tn+'</td><td><button type="button" class="btn small" data-course="'+esc(c.key)+'">الدروس</button></td></tr>';}).join('')+'</tbody></table></div>';
  if(openCourse){
    var c=list.filter(function(x){return x.key===openCourse;})[0];
    var ls=lessonsAll.filter(function(l){return (l.subject||'')+'|'+l.grade===openCourse;});
    h+='<section class="card"><div class="toolbar" style="margin-bottom:8px"><h3 style="flex:1;margin:0">'+esc(courseName(openCourse))+' · '+ls.length+' درس</h3><button type="button" class="btn primary small" id="addLesson">+ درس جديد</button>'+(c&&!c.lessons?'<button type="button" class="btn small danger" id="delCourse">حذف هذا الصف</button>':'')+'</div>'+
      (ls.length?'<ul class="toplist">'+ls.map(function(l){return '<li style="display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);padding:6px 0"><span class="u-num" style="flex:0 0 26px">'+esc(l.unit)+'</span><span style="flex:1">'+esc(l.title)+(l.custom?'':' <span class="muted">(أصلي)</span>')+'</span>'+(l.custom?'<button type="button" class="btn small" data-editl="'+l.id+'">تعديل</button><button type="button" class="btn small danger" data-dell="'+l.id+'">حذف</button>':'<a class="btn small" href="/app">فتح في صفحة الدروس</a>')+'</li>';}).join('')+'</ul>':'<p class="muted">لا توجد دروس بعد. اضغط «درس جديد».</p>')+'</section>';
  }
  return h;
}
var LFORM=[['concepts','المفاهيم'],['pre_learning','التهيئة / التمهيد / التعلم القبلي'],['activities_teach','إجراءات سير الدرس / الأنشطة التدريسية'],['formative','التقويم التكويني'],['closing','التقويم الختامي'],['homework','الأنشطة والمهام المنزلية'],['outcomes','المخرجات التعليمية'],['hw_q1','سؤال الواجب 1'],['hw_a1','إجابة/اختيارات السؤال 1'],['hw_q2','سؤال الواجب 2'],['hw_a2','إجابة/اختيارات السؤال 2']];
function lessonForm(key,l){
  l=l||{};var p=key.split('|');
  var h='<div class="ed"><div class="ed-row"><label>الوحدة (رقم)<input id="l_unit" type="number" min="1" value="'+esc(l.unit||1)+'"></label><label>رقم الدرس في الوحدة<input id="l_no" type="number" min="1" value="'+esc(l.lesson_no||'')+'"></label><label>الفصل الدراسي<select id="l_term"><option value="1">الأول</option><option value="2"'+(+l.term===2?' selected':'')+'>الثاني</option></select></label><label>نوع الواجب<select id="l_hwt"><option value="essay">مقالي</option><option value="mcq"'+(l.hw_type==='mcq'?' selected':'')+'>اختيار من متعدد</option></select></label></div>'+
    '<label>اسم الوحدة<input id="l_uname" value="'+esc(l.unit_name||'')+'"></label><label>عنوان الدرس (كما في نور)<input id="l_title" value="'+esc(l.title||'')+'"></label>'+
    LFORM.map(function(f){return '<label>'+f[1]+'<textarea id="l_'+f[0]+'" rows="'+(/hw_/.test(f[0])?2:3)+'">'+esc(l[f[0]]||'')+'</textarea></label>';}).join('')+
    '<p class="muted small">في واجب الاختيار من متعدد: اكتب الاختيارات كل واحد في سطر، والسطر الأول هو الصحيح.</p></div>';
  var ov=$('modal'),box=$('modalBox');
  box.innerHTML='<h3 id="mTitle">'+(l.id?'تعديل درس':'درس جديد')+' · '+esc(courseName(key))+'</h3>'+h+'<div class="m-actions"><button type="button" class="btn" id="mCancel">إلغاء</button><button type="button" class="btn primary" id="mOk">حفظ الدرس</button></div>';
  box.classList.add('wide');ov.hidden=false;
  var close=function(){ov.hidden=true;box.innerHTML='';box.classList.remove('wide');};
  $('mCancel').onclick=close;
  $('mOk').onclick=function(){
    var b={id:l.id||0,subject:p[0],grade:p[1],unit:$('l_unit').value,lesson_no:$('l_no').value,term:$('l_term').value,hw_type:$('l_hwt').value,unit_name:$('l_uname').value.trim(),title:$('l_title').value.trim()};
    LFORM.forEach(function(f){b[f[0]]=$('l_'+f[0]).value;});
    if(!b.title){toast('اكتب عنوان الدرس');return;}
    api('/api/admin/custom_lessons',b).then(function(){close();toast('حُفظ الدرس');load();},function(e){toast(e.message);});
  };
}
function addCourse(){
  var h='<div class="ed"><label>المادة<input id="c_subj" placeholder="مثال: الكيمياء، العلوم، الفيزياء" list="subjList"></label><datalist id="subjList"><option>الأحياء</option><option>العلوم</option><option>الكيمياء</option><option>الفيزياء</option><option>العلوم البيئية</option><option>تقنية المعلومات</option><option>الدراسات الاجتماعية</option></datalist>'+
    '<label>الصف<select id="c_grade">'+GRADES.map(function(g){return '<option>'+g+'</option>';}).join('')+'</select></label><p class="muted small">اكتب اسم المادة كما يظهر في قائمة صفوفك في نور (مثل «الكيمياء / الحادي عشر») حتى تفتح أداة نور الصف الصحيح تلقائيًا.</p></div>';
  var ov=$('modal'),box=$('modalBox');
  box.innerHTML='<h3 id="mTitle">مادة أو صف جديد</h3>'+h+'<div class="m-actions"><button type="button" class="btn" id="mCancel">إلغاء</button><button type="button" class="btn primary" id="mOk">إضافة</button></div>';ov.hidden=false;
  var close=function(){ov.hidden=true;box.innerHTML='';};
  $('mCancel').onclick=close;
  $('mOk').onclick=function(){var s=$('c_subj').value.trim(),g=$('c_grade').value;if(!s){toast('اكتب اسم المادة');return;}
    api('/api/admin/courses',{subject:s,grade:g}).then(function(r){close();openCourse=r.key;toast('أُضيف. أضف الدروس الآن');load();},function(e){toast(e.message);});};
}
function scopeDialog(u){
  var picked={};
  parseScope(u).list.forEach(function(k){picked[k]=1;});
  var subs=scopeSubjects();
  // قوائم منسدلة: كل مادة سطر واحد يُفتح بضغطة ليُظهر صفوفها (بدل قائمة مسطّحة
  // بكل الصفوف معًا كانت تُلبِس المعلم وتُطيل النافذة). الاختيار تراكميٌّ بين
  // المواد، وعدّاد كل مادة يظهر على سطرها حتى وهي مغلقة.
  function countOf(s){return subjectGrades(s).filter(function(g){return picked[s+'|'+g];}).length;}
  function badge(s){
    var all=subjectGrades(s),n=countOf(s);
    if(!n)return '<em class="sc-e">—</em>';
    return '<em class="sc-e '+(n===all.length?'full':'part')+'">'+(n===all.length?'كل الصفوف ('+all.length+')':n+' من '+all.length)+'</em>';
  }
  function rows(){
    return subs.map(function(s){
      var all=subjectGrades(s),open=false;
      // نفتح تلقائيًّا المواد التي فيها اختيار جزئي (ليتذكّر المعلم ما اختاره)
      var n=countOf(s); open = n>0 && n<all.length;
      var body='<div class="sc-in">'+
        '<label class="sc-all"><input type="checkbox" data-all="'+esc(s)+'"'+(n===all.length&&n>0?' checked':'')+'> تحديد كل صفوف '+esc(s)+'</label>'+
        '<div class="sc-glist">'+all.map(function(g){
          var k=s+'|'+g;
          return '<label class="sc-gi"><input type="checkbox" data-sc="'+esc(k)+'"'+(picked[k]?' checked':'')+'> الصف '+esc(gLabel(g))+'</label>';
        }).join('')+'</div></div>';
      return '<details class="sc-acc" data-acc="'+esc(s)+'"'+(open?' open':'')+'>'+
        '<summary><span class="sc-t">'+esc(s)+'</span>'+badge(s)+'</summary>'+body+'</details>';
    }).join('');
  }
  function paint(){
    $('scAcc').innerHTML=rows();
    var total=Object.keys(picked).length;
    $('scCount').textContent=total?('محدَّد: '+total+' صفًا في '+Object.keys(parseScope({scope:JSON.stringify(Object.keys(picked))}).by).length+' مادة'):'لم تحدّد شيئًا — سيرى المعلم كل الصفوف';
    Array.prototype.forEach.call(box.querySelectorAll('[data-sc]'),function(c){c.onchange=function(){
      if(c.checked)picked[c.getAttribute('data-sc')]=1;else delete picked[c.getAttribute('data-sc')];
      var s=c.getAttribute('data-sc').split('|')[0], det=box.querySelector('[data-acc="'+s.replace(/"/g,'\\"')+'"]');
      var op=det?det.open:false; paint();
      var d2=box.querySelector('[data-acc="'+s.replace(/"/g,'\\"')+'"]'); if(d2)d2.open=op;};});
    Array.prototype.forEach.call(box.querySelectorAll('[data-all]'),function(c){c.onchange=function(){
      var s=c.getAttribute('data-all'),all=subjectGrades(s),on=c.checked;
      all.forEach(function(g){if(on)picked[s+'|'+g]=1;else delete picked[s+'|'+g];});
      var det=box.querySelector('[data-acc="'+s.replace(/"/g,'\\"')+'"]'),op=det?det.open:true; paint();
      var d2=box.querySelector('[data-acc="'+s.replace(/"/g,'\\"')+'"]'); if(d2)d2.open=op;};});
  }
  var h='<p class="m-msg">افتح المادة من القائمة المنسدلة ثم اختر صفوفها. ما تختاره يظهر لـ '+esc(u.name)+' في صفحة الدروس والتقويم والنهائيات. وإن تركت الكل فارغًا يرى كل الصفوف.</p>'+
    '<div class="sc-accordion" id="scAcc"></div><div class="sc-foot" id="scCount"></div>';
  var ov=$('modal'),box=$('modalBox');
  box.innerHTML='<h3 id="mTitle">المواد والصفوف المسموحة</h3>'+h+'<div class="m-actions"><button type="button" class="btn" id="mCancel">إلغاء</button><button type="button" class="btn primary" id="mOk">حفظ</button></div>';ov.hidden=false;
  var close=function(){ov.hidden=true;box.innerHTML='';};
  paint();
  $('mCancel').onclick=close;
  $('mOk').onclick=function(){var v=Object.keys(picked);close();act1(u,{action:'scope',value:v},'حُفظت المواد والصفوف');};
}
function kpis(){
  var t=data.totals,blocked=data.users.reduce(function(s,u){return s+(u.blocked?u.blocked.n:0);},0);
  var items=[['المعلمون',t.teachers,''],['نشطون هذا الأسبوع',t.active7,''],['مرات الدخول',t.logins,''],['دروس منسوخة',t.copies,''],['أجهزة مرفوضة',blocked,blocked?'warn':'']];
  return '<div class="kpis">'+items.map(function(k){return '<div class="kpi '+k[2]+'"><span class="kpi-n">'+k[1]+'</span><span class="kpi-l">'+k[0]+'</span></div>';}).join('')+'</div>';
}
// «الصفوف المستخدمة»: تُعرض قائمةً تُفتح بدل صفٍّ من الرقاقات يمدّ الجدول.
// وحساب المدير لا تُعرض له إطلاقًا (استخدامه ليس موضوع التقرير).
function usedGrades(u){
  if(u.role==='admin')return '<span class="muted">—</span>';
  var gs=(u.grades||[]).map(function(g){return g.grade;}).filter(Boolean);
  gs.sort(function(a,b){return gn(a)-gn(b);});
  if(!gs.length)return '<span class="muted">—</span>';
  var chips=gs.map(function(g){return '<span class="chip-s">'+esc(g)+'</span>';}).join('');
  if(gs.length<=2)return chips;
  return '<details class="sc-used"><summary>'+gs.length+' صفوف</summary><div class="sc-used-in">'+chips+'</div></details>';
}
var tf='all',tsort='recent';
function tActive7(u){return u.last_login&&(Date.now()-u.last_login)<7*864e5;}
function tInitial(n){n=String(n||'').replace(/^(أ\.|د\.|م\.)\s*/,'').trim();return n?n.charAt(0):'؟';}
function teacherRows(){
  var all=data.users,n7=all.filter(tActive7).length,off=all.filter(function(u){return !u.active;}).length,bl=all.filter(function(u){return u.blocked;}).length;
  var list=all.filter(function(u){
    if(q&&(u.name+' '+u.username+' '+(u.scope||'')).toLowerCase().indexOf(q)<0)return false;
    if(tf==='active')return tActive7(u);
    if(tf==='idle')return u.active&&!tActive7(u);
    if(tf==='off')return !u.active;
    if(tf==='blocked')return !!u.blocked;
    return true;
  });
  list=list.slice().sort(function(x,y){
    if(tsort==='name')return String(x.name).localeCompare(String(y.name),'ar');
    if(tsort==='use')return (y.lessons_copied||0)-(x.lessons_copied||0);
    return (y.last_login||0)-(x.last_login||0);
  });
  var F=[['all','الكل',all.length],['active','نشطون هذا الأسبوع',n7],['idle','لم يدخلوا هذا الأسبوع',all.length-n7-off],['off','موقوفون',off]];
  if(bl)F.push(['blocked','محاولات من أجهزة أخرى',bl]);
  var h='<div class="tc-bar"><div class="tc-filters" role="group" aria-label="تصفية المعلمين">'+F.map(function(f){return '<button type="button" class="tc-f'+(tf===f[0]?' on':'')+'" data-tf="'+f[0]+'">'+f[1]+' <span>'+f[2]+'</span></button>';}).join('')+'</div>'+
    '<label class="tc-sort">ترتيب <select id="tSort"><option value="recent"'+(tsort==='recent'?' selected':'')+'>آخر دخول</option><option value="use"'+(tsort==='use'?' selected':'')+'>الأكثر استخدامًا</option><option value="name"'+(tsort==='name'?' selected':'')+'>الاسم</option></select></label></div>';
  if(!all.length)return h+'<div class="empty-state">'+(VAULT?'لا يوجد معلمون في اللوحة الشاملة بعد. افتح أي معلم في لوحة التحكم الأساسية واضغط السهم ⬅ بجوار «كلمة مرور جديدة» لنقله إلى هنا.':'لا يوجد معلمون بعد. أضف المعلمين من زر «إضافة معلمين».')+'</div>';
  if(!list.length)return h+'<div class="empty-state">لا يوجد معلم يطابق البحث أو التصفية. جرّب كلمة أخرى أو اختر «الكل».</div>';
  return h+'<div class="tc-grid">'+list.map(function(u){
    var adm=u.role==='admin',st=!u.active?'<span class="pill off">موقوف</span>':adm?(+u.delegated?'<span class="pill adm">مدير مفوَّض</span>':'<span class="pill adm">مدير</span>'):(tActive7(u)?'<span class="pill on">نشط</span>':'');
    var dv=u.devices.length,mx=adm?0:+u.max_devices||0,pc=mx?Math.min(100,Math.round(dv/mx*100)):0;
    return '<article class="tc'+(!u.active?' is-off':'')+'"><button type="button" class="tc-open" data-open="'+u.id+'" aria-label="تفاصيل '+esc(u.name)+'"></button>'+
      '<header><span class="tc-av" aria-hidden="true">'+esc(tInitial(u.name))+'</span><div class="tc-id"><b>'+esc(u.name)+'</b><span class="ltr">'+esc(u.username)+'</span></div>'+st+'</header>'+
      '<dl class="tc-stats"><div><dt>آخر دخول</dt><dd>'+esc(ago(u.last_login))+'</dd></div><div><dt>مرات الدخول</dt><dd class="num">'+u.logins+'</dd></div><div><dt>دروس منسوخة</dt><dd class="num">'+u.lessons_copied+'</dd></div></dl>'+
      '<div class="tc-scope">'+(adm?'<span class="muted">كل المواد والصفوف</span>':scopeChips(u))+'</div>'+
      '<footer><span class="tc-dev">الأجهزة <b class="num">'+dv+'/'+(adm?'∞':mx)+'</b>'+(mx?'<i class="tc-meter"><i style="width:'+pc+'%"></i></i>':'')+'</span>'+
      (u.blocked?'<span class="pill warn" title="آخر محاولة '+esc(fmtDate(u.blocked.last))+'">'+u.blocked.n+' محاولة من جهاز آخر</span>':'<span class="tc-more">التفاصيل ‹</span>')+'</footer></article>';
  }).join('')+'</div>';
}
function typeLabel(t){return TYPES[t]||('نشاط: '+String(t==null?'':t).replace(/_/g,' '));}
function activityView(){
  var ev=act.events.map(function(e){return '<li><span class="ev-t">'+esc(fmtDate(e.at))+'</span><b>'+esc(e.name)+'</b> '+esc(typeLabel(e.type))+(e.lesson_title?' · <span class="muted">'+esc(e.grade)+' — '+esc(e.lesson_title)+'</span>':'')+(e.label?' <span class="dev">'+esc(e.label)+'</span>':'')+'</li>';}).join('');
  var fa=act.failed.map(function(a){return '<li class="'+(a.reason==='device_limit'?'bad':'')+'"><span class="ev-t">'+esc(fmtDate(a.at))+'</span><b>'+esc(a.name||a.username)+'</b> '+esc(REASONS[a.reason]||a.reason)+(a.label?' <span class="dev">'+esc(a.label)+'</span>':'')+(a.ip?' <span class="muted ltr">'+esc(a.ip)+'</span>':'')+'</li>';}).join('');
  return '<div class="two"><section class="card"><h3>آخر النشاطات</h3><ul class="feed">'+(ev||'<li class="muted">لا يوجد نشاط بعد.</li>')+'</ul></section>'+
    '<section class="card"><h3>محاولات دخول مرفوضة</h3><p class="muted">الصف الأحمر يعني أن أحدًا حاول الدخول بحساب معلم من جهاز ثالث.</p><ul class="feed">'+(fa||'<li class="muted">لا توجد محاولات مرفوضة.</li>')+'</ul></section></div>';
}
// ---------- الإشعارات (الجرس) ----------
// الإعلان الذي يكتبه المدير هنا يظهر لكل المعلمين في جرس أعلى الشريط، مع عدد القراءات.
// الجرس يُضيء وتهتز أيقونته لكافة المعلمين ما دام الإعلان غير مقروء عندهم.
function noticesView(){
  var list=(ntc&&ntc.notices)||[];
  var h='<div class="toolbar"><p class="muted" style="flex:1;margin:0">أرسل إشعارًا لكل المعلمين: ما تنشره هنا يصل إلى جرس 🔔 أعلى الشريط عند كل معلم، ويضيء الجرس وتهتز أيقونته حتى يفتحه. كل معلم يعلم الإعلان «مقروء» بنفسه، وتشاهد هنا كم شخصًا قرأ كل إعلان.</p><button type="button" class="btn primary" id="addNotice">+ إرسال إشعار</button></div>';
  h+='<div class="kpis"><div class="kpi"><span class="kpi-n">'+list.length+'</span><span class="kpi-l">إعلان منشور</span></div><div class="kpi"><span class="kpi-n">'+list.reduce(function(s,n){return s+n.reads;},0)+'</span><span class="kpi-l">مجموع القراءات</span></div><div class="kpi"><span class="kpi-n">'+list.reduce(function(s,n){return s+(n.reads>0?1:0);},0)+'</span><span class="kpi-l">إعلان قرأه أحدهم</span></div></div>';
  h+=list.length?'<div class="t-wrap"><table class="tbl" style="min-width:640px"><thead><tr><th>العنوان والنص</th><th>الرابط · المنصة</th><th>قرأه</th><th>التاريخ</th><th></th></tr></thead><tbody>'+list.map(function(n){
    return '<tr><td><b>'+esc(n.title)+'</b><div class="sub">'+esc(n.body.length>140?n.body.slice(0,140)+'…':n.body)+'</div></td>'+
      '<td>'+(n.url?'<a href="'+esc(n.url)+'" target="_blank" rel="noopener" class="sub ltr">رابط ↗</a>':'')+(n.video?'<a href="'+esc(n.video)+'" target="_blank" rel="noopener" class="sub">🎬 فيديو</a>':'')+(!n.url&&!n.video?'<span class="muted">—</span>':'')+
        '<div class="sub">خبير</div></td>'+
      '<td class="num">'+n.reads+'</td><td>'+esc(fmtDate(n.created_at))+'</td>'+
      '<td><button type="button" class="btn small danger" data-delno="'+n.id+'">حذف</button></td></tr>';
  }).join('')+'</tbody></table></div>':'<p class="muted">لا توجد إعلانات منشورة بعد.</p>';
  return h;
}
// قوالب جاهزة: أكثر ما يرسله المدير «إضافة» و«تحديث» و«صيانة» — بضغطة تُعبّأ ثم يعدّل النص ويجري
var NO_TPL=[
  ['add','إضافة جديدة','إضافة جديدة على الموقع 🔔','أُضيفت إضافات جديدة إلى الموقع — افتح صفحة الدروس واستكشف الجديد، والجرس في أعلى الشريط يخبرك بكل إضافة قادمة.'],
  ['up','تحديث الموقع','تحديث الموقع 🔔','حُدّث الموقع بميزات جديدة. التحديث يتم تلقائيًا — أعد فتح الصفحة فقط لتحصل على الأحدث.'],
  ['mtn','صيانة مسائية','تنبيه صيانة مسائية','سيكون هناك فترة صيانة الليلة قد تتعطل خلالها بعض الخدمات مؤقتًا. أعد فتح الصفحة بعدها واعمل كالعادة.']];
function addNotice(){
  var h='<p class="muted small" style="margin:4px 0 8px">اختر قالبًا جاهزًا بضغطة ثم عدّل نصه، أو اكتب إشعارك مباشرة. ينشر بمجرد الضغط «نشر الإشعار» ويضيء الجرس لكل المعلمين.</p>'+
    '<div class="n-tp" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+NO_TPL.map(function(t){return '<button type="button" class="btn small" data-tpl="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div>'+
    '<div class="ed"><label>العنوان<input id="n_title" maxlength="120" placeholder="مثال: صيانة نور مساء اليوم"></label>'+
    '<label>النص<textarea id="n_body" rows="5" maxlength="4000" placeholder="اكتب نص الإشعار…"></textarea></label>'+
    '<label>رابط (اختياري)<input id="n_url" dir="ltr" placeholder="https://…"></label>'+
    '<label>المنصة<select id="n_brand"><option value="">كل المعلمين</option><option value="k">خبير فقط</option></select></label>'+
    '<label>فيديو (اختياري — يظهر في نافذة لكل معلم أول ما يفتح الصفحة)<select id="n_video"><option value="">بدون فيديو</option><option value="/promo/kabsula.mp4">🎬 إعلان «خبير»</option></select></label></div>';
  var ov=$('modal'),box=$('modalBox');
  box.innerHTML='<h3 id="mTitle">إرسال إشعار لكل المعلمين</h3>'+h+'<div class="m-actions"><button type="button" class="btn" id="mCancel">إلغاء</button><button type="button" class="btn primary" id="mOk">نشر الإشعار</button></div>';ov.hidden=false;
  Array.prototype.forEach.call(box.querySelectorAll('[data-tpl]'),function(b){
    b.onclick=function(){
      var t=NO_TPL.filter(function(x){return x[0]===b.getAttribute('data-tpl');})[0];
      $('n_title').value=t[2];$('n_body').value=t[3];
      var f=$('n_body');f.focus();f.setSelectionRange(f.value.length,f.value.length);
    };
  });
  var close=function(){ov.hidden=true;box.innerHTML='';};
  $('mCancel').onclick=close;
  $('mOk').onclick=function(){
    var b={title:$('n_title').value.trim(),body:$('n_body').value.trim(),url:$('n_url').value.trim(),brand:$('n_brand').value,video:$('n_video').value};
    if(!b.title||!b.body){toast('اكتب العنوان والنص');return;}
    api('/api/admin/notices',b).then(function(){close();toast('نُشر الإشعار — وصل لجرس كل المعلمين مع إضاءة 🔔');load();},function(e){toast(e.message);});
  };
}
function render(){
  var T=[['teachers','المعلمون'],['report','تقرير الاستخدام'],['courses','المواد والدروس'],['activity','النشاط والتنبيهات'],['notices','الإشعارات']];
  var h=(tab==='report'?'':kpis())+'<div class="tabs" role="tablist">'+T.map(function(t){return '<button type="button" role="tab" class="tab'+(tab===t[0]?' on':'')+'" data-tab="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div>';
  if(tab==='teachers')h+='<div class="toolbar"><input id="search" type="search" placeholder="ابحث باسم المعلم أو اسم المستخدم أو المادة" value="'+esc(q)+'">'+(VAULT?'':'<button type="button" class="btn primary" id="addBtn">إضافة معلمين</button>')+'</div>'+teacherRows();
  else if(tab==='report')h+=reportView();
  else if(tab==='courses')h+=coursesView();
  else if(tab==='notices')h+=noticesView();
  else h+=activityView();
  $('dash').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'),function(b){b.onclick=function(){tab=b.getAttribute('data-tab');render();};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'),function(b){b.onclick=function(){openTeacher(+b.getAttribute('data-open'));};});
  if($('search'))$('search').oninput=function(){q=this.value.trim().toLowerCase();var pos=this.selectionStart;render();var s=$('search');s.focus();s.setSelectionRange(pos,pos);};
  if($('addBtn'))$('addBtn').onclick=addTeachers;
  Array.prototype.forEach.call(document.querySelectorAll('[data-tf]'),function(b){b.onclick=function(){tf=b.getAttribute('data-tf');render();};});
  if($('tSort'))$('tSort').onchange=function(){tsort=this.value;render();};
  Array.prototype.forEach.call(document.querySelectorAll('[data-days]'),function(b){b.onclick=function(){repDays=+b.getAttribute('data-days');api(vq('/api/admin/report?days='+repDays)).then(function(r){rep=r;render();});};});
  if($('csvBtn'))$('csvBtn').onclick=downloadCsv;
  if($('addCourse'))$('addCourse').onclick=addCourse;
  Array.prototype.forEach.call(document.querySelectorAll('[data-course]'),function(b){b.onclick=function(){openCourse=b.getAttribute('data-course');render();};});
  if($('addLesson'))$('addLesson').onclick=function(){lessonForm(openCourse,null);};
  if($('delCourse'))$('delCourse').onclick=function(){api('/api/admin/courses?key='+encodeURIComponent(openCourse),null,'DELETE').then(function(){openCourse=null;load();toast('حُذف');},function(e){toast(e.message);});};
  Array.prototype.forEach.call(document.querySelectorAll('[data-editl]'),function(b){b.onclick=function(){var l=lessonsAll.filter(function(x){return x.id===+b.getAttribute('data-editl');})[0];if(l)lessonForm(openCourse,l);};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-dell]'),function(b){b.onclick=function(){dialog({title:'حذف هذا الدرس؟',message:'يُحذف من صفحة الدروس لكل المعلمين.',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/admin/custom_lessons/'+b.getAttribute('data-dell'),null,'DELETE').then(function(){toast('حُذف الدرس');load();});});};});
  if($('addNotice'))$('addNotice').onclick=addNotice;
  Array.prototype.forEach.call(document.querySelectorAll('[data-delno]'),function(b){b.onclick=function(){dialog({title:'حذف هذا الإعلان؟',message:'يُحذف من جرس كل المعلمين.',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/admin/notices/'+b.getAttribute('data-delno'),null,'DELETE').then(function(){toast('حُذف الإعلان');load();},function(e){toast(e.message);});});};});
}
function addTeachers(){
  // قوائم منسدلة بدل شبكة ضخمة بكل المقررات: مادة واحدة تُفتح لتُظهر صفوفها،
  // وخيار «تحديد كل الصفوف» لكل مادة — أخفّ بكثير عند إضافة معلم.
  var picked={};
  function countOf(s){return subjectGrades(s).filter(function(g){return picked[s+'|'+g];}).length;}
  function accHtml(){
    return scopeSubjects().map(function(s){
      var all=subjectGrades(s), n=countOf(s);
      var badge = n ? (n===all.length?'كل الصفوف ('+all.length+')':n+' من '+all.length) : '—';
      return '<details class="sc-acc" data-acc="'+esc(s)+'"'+(n>0&&n<all.length?' open':'')+'>'+
        '<summary><span class="sc-t">'+esc(s)+'</span><em class="sc-e'+(n===all.length&&n?' full':(n?' part':''))+'">'+badge+'</em></summary>'+
        '<div class="sc-in"><label class="sc-all"><input type="checkbox" data-all="'+esc(s)+'"'+(n===all.length&&n?' checked':'')+'> تحديد كل صفوف '+esc(s)+'</label>'+
        '<div class="sc-glist">'+all.map(function(g){
          var k=s+'|'+g;
          return '<label class="sc-gi"><input type="checkbox" data-sc="'+esc(k)+'"'+(picked[k]?' checked':'')+'> الصف '+esc(gLabel(g))+'</label>';
        }).join('')+'</div></div></details>';
    }).join('');
  }
  var sc='<p class="m-msg">اختر المواد والصفوف التي ستظهر لهم. اتركها فارغة ليروا كل الصفوف — ويمكن تعديلها لاحقًا لكل معلم.</p>'+
    '<div class="sc-accordion" id="addAcc"></div><p class="sc-foot" id="addCount"></p>';
  var pr=dialog({title:'إضافة معلمين',message:'اكتب كل معلم في سطر: الاسم، اسم المستخدم، كلمة المرور. لو تركت كلمة المرور فاضية تُنشأ تلقائيًا.',html:sc,textarea:true,placeholder:'أحمد البلوشي، ahmed.b، 123456\nسالم الهنائي، salim.h',okText:'إضافة',
    extra:function(box){return {text:(box.querySelector('#mText')||{}).value||'',scope:Object.keys(picked)};}});
  // بناء القوائم بعد إدراجها في النافذة
  (function bind(){
    var box=$('modalBox'); if(!box||!$('addAcc'))return;
    function paint(){
      $('addAcc').innerHTML=accHtml();
      var total=Object.keys(picked).length;
      $('addCount').textContent=total?('محدَّد: '+total+' صفًا'):'لم تحدّد شيئًا — سيرى المعلم كل الصفوف';
      wire();
    }
    function wire(){
      Array.prototype.forEach.call(box.querySelectorAll('[data-sc]'),function(c){c.onchange=function(){
        var k=c.getAttribute('data-sc');
        if(c.checked)picked[k]=1;else delete picked[k];
        var s=k.split('|')[0], det=box.querySelector('[data-acc="'+s.replace(/"/g,'\\"')+'"]'), op=det?det.open:false;
        paint(); var d2=box.querySelector('[data-acc="'+s.replace(/"/g,'\\"')+'"]'); if(d2)d2.open=op;};});
      Array.prototype.forEach.call(box.querySelectorAll('[data-all]'),function(c){c.onchange=function(){
        var s=c.getAttribute('data-all'), all=subjectGrades(s), on=c.checked;
        all.forEach(function(g){if(on)picked[s+'|'+g]=1;else delete picked[s+'|'+g];});
        var det=box.querySelector('[data-acc="'+s.replace(/"/g,'\\"')+'"]'), op=det?det.open:true;
        paint(); var d2=box.querySelector('[data-acc="'+s.replace(/"/g,'\\"')+'"]'); if(d2)d2.open=op;};});
    }
    paint();
  })();
  return pr.then(function(r){
    if(!r||!r.text)return;
    var chosen=r.scope||[];
    api('/api/admin/import',{text:r.text,scope:chosen}).then(function(res){
      var ok=res.done.map(function(d){return d.name+' | '+d.username+' | '+d.password;}).join('\n');
      var bad=res.errors.map(function(e){return '• '+e.line+': '+e.error;}).join('\n');
      dialog({title:'تمت إضافة '+res.done.length+' معلم',message:res.done.length?'احفظ بيانات الدخول التالية وأرسلها للمعلمين. لن تظهر كلمات المرور مرة أخرى.':'',textarea:true,readonly:true,ltr:false,value:ok+(bad?'\n\nلم تتم إضافة:\n'+bad:''),okText:'نسخ البيانات',cancelText:'إغلاق'}).then(function(c){if(c)copyText(ok);});
      load();
    },function(e){toast(e.message);});
  });
}
function openTeacher(id){
  var u=data.users.filter(function(x){return x.id===id;})[0];if(!u)return;
  // المدير المفوَّض: صلاحيات المدير كاملة، لكن لا يعدّل المدير الرئيسي ولا مفوَّضًا آخر
  var isDel=u.role==='admin'&&+u.delegated===1,meOwner=!ME.delegated,locked=!meOwner&&u.role==='admin'&&u.id!==ME.id;
  var dev=u.devices.map(function(d){return '<li><div><b>'+esc(d.label||'جهاز')+'</b><div class="sub">أول دخول '+esc(fmtDate(d.first_seen))+' · آخر استخدام '+esc(ago(d.last_seen))+(d.ip?' · <span class="ltr">'+esc(d.ip)+'</span>':'')+'</div></div><button type="button" class="btn small danger" data-rmdev="'+d.id+'">إزالة</button></li>';}).join('')||'<li class="muted">لم يسجّل دخولًا من أي جهاز بعد.</li>';
  var top=u.top.map(function(t){return '<li>'+esc(t.grade)+' — '+esc(t.title)+' <span class="muted">('+t.n+')</span></li>';}).join('')||'<li class="muted">لم ينسخ أي درس بعد.</li>';
  var html='<div class="t-stats"><div><b>'+u.logins+'</b><span>مرة دخول</span></div><div><b>'+u.lessons_viewed+'</b><span>درس فتحه</span></div><div><b>'+u.lessons_copied+'</b><span>درس نسخه</span></div><div><b>'+u.copies+'</b><span>عملية نسخ</span></div></div>'+
    (u.blocked?'<div class="alert">تمت محاولة الدخول بهذا الحساب من جهاز إضافي '+u.blocked.n+' مرة، آخرها '+esc(fmtDate(u.blocked.last))+'.</div>':'')+
    '<h4>المواد والصفوف المسموحة</h4>'+scopeFull(u)+
    '<h4>الأجهزة ('+u.devices.length+' من '+(u.role==='admin'?'غير محدود':u.max_devices)+')</h4><ul class="devs">'+dev+'</ul>'+
    '<h4>أكثر الدروس نسخًا</h4><ul class="toplist">'+top+'</ul>'+
    '<h4>إجراءات</h4>'+(locked?'<p class="muted">🔒 هذا حساب '+(isDel?'مدير مفوَّض آخر':'المدير الرئيسي')+'، ولا يمكنك تعديله.</p>':'<div class="acts">'+
      (meOwner&&u.role!=='admin'?'<button type="button" class="btn small primary" data-act="delegate">⭐ تفويض كمدير</button>':'')+
      (meOwner&&isDel?'<button type="button" class="btn small danger" data-act="undelegate">سحب صلاحية المدير</button><button type="button" class="btn small" data-act="toggle">'+(u.active?'إيقاف الحساب':'تفعيل الحساب')+'</button><button type="button" class="btn small danger" data-act="delete">حذف الحساب</button>':'')+
      (u.role!=='admin'?'<button type="button" class="btn small vault-btn" data-act="vault" title="'+(VAULT?'إرجاع إلى لوحة التحكم الأساسية':'نقل إلى لوحة التحكم الشاملة')+'" aria-label="'+(VAULT?'إرجاع إلى لوحة التحكم الأساسية':'نقل إلى لوحة التحكم الشاملة')+'">'+(VAULT?'➡':'⬅')+'</button>':'')+
      '<button type="button" class="btn small" data-act="password">كلمة مرور جديدة</button>'+
      '<button type="button" class="btn small" data-act="rename">تعديل الاسم</button>'+
      (u.role!=='admin'?'<button type="button" class="btn small primary" data-act="scope">المواد والصفوف المسموحة</button><button type="button" class="btn small" data-act="clean_stale">مسح الأجهزة المهملة</button><button type="button" class="btn small" data-act="reset_devices">مسح كل الأجهزة</button><button type="button" class="btn small" data-act="max_devices">عدد الأجهزة المسموح</button><button type="button" class="btn small" data-act="toggle">'+(u.active?'إيقاف الحساب':'تفعيل الحساب')+'</button><button type="button" class="btn small danger" data-act="delete">حذف المعلم</button>':'')+
    '</div>');
  dialog({title:u.name,message:u.username,html:html,okText:'إغلاق',cancelText:false});
  setTimeout(function(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-rmdev]'),function(b){b.onclick=function(){act1(u,{action:'remove_device',device:+b.getAttribute('data-rmdev')},'أُزيل الجهاز');};});
    Array.prototype.forEach.call(document.querySelectorAll('[data-act]'),function(b){b.onclick=function(){doAct(u,b.getAttribute('data-act'));};});
  },0);
}
// إغلاق أي نافذة مفتوحة. نستخدم closeDialog حتى يُحلّ وعد النافذة السابقة ويُزال مستمع لوحة المفاتيح،
// وإلا تراكم المستمعون وبقيت النوافذ القديمة تستجيب لزر Escape.
function closeModal(){closeDialog(null);var ov=$('modal');if(ov){ov.hidden=true;ov.classList.remove('locked');}var b=$('modalBox');if(b)b.innerHTML='';}
function act1(u,payload,msg){return api('/api/admin/teachers/'+u.id,payload).then(function(r){toast(msg);closeModal();return load().then(function(){return r;});},function(e){toast(e.message);});}
function doAct(u,a){
  closeModal();
  if(a==='password')return dialog({title:'كلمة مرور جديدة لـ '+u.name,input:true,placeholder:'اتركها فارغة لإنشاء كلمة مرور تلقائية',okText:'حفظ'}).then(function(v){if(v===null)return;api('/api/admin/teachers/'+u.id,{action:'password',password:v}).then(function(r){load();dialog({title:'كلمة المرور الجديدة',textarea:true,readonly:true,value:u.username+' | '+r.password,okText:'نسخ',cancelText:'إغلاق'}).then(function(c){if(c)copyText(u.username+' | '+r.password);});},function(e){toast(e.message);});});
  if(a==='rename')return dialog({title:'تعديل اسم المعلم',input:true,value:u.name,okText:'حفظ'}).then(function(v){if(v)act1(u,{action:'rename',name:v},'حُفظ الاسم');});
  if(a==='max_devices')return dialog({title:'عدد الأجهزة المسموح لـ '+u.name,input:true,value:String(u.max_devices),placeholder:'من 1 إلى 5',okText:'حفظ'}).then(function(v){if(v)act1(u,{action:'max_devices',value:+v},'تم التعديل');});
  if(a==='clean_stale')return api('/api/admin/teachers/'+u.id,{action:'clean_stale'}).then(function(r){toast(r.removed?('أُزيل '+r.removed+' جهازًا مهملًا'):'لا توجد أجهزة مهملة');load();},function(e){toast(e.message);});
  if(a==='reset_devices')return dialog({title:'مسح أجهزة '+u.name,message:'سيُسجَّل خروجه من كل الأجهزة، ويستطيع الدخول من جهازين جديدين.',okText:'مسح الأجهزة',danger:true}).then(function(ok){if(ok)act1(u,{action:'reset_devices'},'مُسحت الأجهزة');});
  if(a==='scope')return scopeDialog(u);
  if(a==='delegate')return dialog({title:'تفويض '+u.name+' كمدير',message:'سيصبح له نفس صلاحياتك في لوحة التحكم، وأجهزته غير محدودة. لا يستطيع حذفك أو تعديل حسابك، وتستطيع سحب التفويض منه في أي وقت.',okText:'تفويض كمدير'}).then(function(ok){if(ok)act1(u,{action:'delegate',value:1},'صار '+u.name+' مديرًا مفوَّضًا');});
  if(a==='undelegate')return dialog({title:'سحب صلاحية المدير من '+u.name,message:'يرجع معلمًا عاديًا بحد الأجهزة المعتاد، ويُسجَّل خروجه من كل الأجهزة.',okText:'سحب الصلاحية',danger:true}).then(function(ok){if(ok)act1(u,{action:'delegate',value:0},'سُحبت صلاحية المدير');});
  if(a==='vault')return act1(u,{action:'vault',value:VAULT?0:1},VAULT?'أُرجع '+u.name+' إلى لوحة التحكم الأساسية':'نُقل '+u.name+' إلى اللوحة الشاملة');
  if(a==='toggle')return act1(u,{action:'toggle'},u.active?'أُوقف الحساب':'فُعّل الحساب');
  if(a==='delete')return dialog({title:'حذف '+u.name,message:'سيُحذف الحساب نهائيًا ولن يستطيع الدخول. تبقى إحصائياته القديمة محفوظة.',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/admin/teachers/'+u.id,null,'DELETE').then(function(){toast('حُذف المعلم');load();},function(e){toast(e.message);});});
}
(function(){
  // شارة «لوحة التحكم» أعلى اليمين: تفتح «الشاملة»، ومن داخلها تعود إلى اللوحة الأساسية
  var st=document.querySelector('.stats .stat');if(!st)return;
  if(VAULT){document.title='الشاملة · خبير';document.body.classList.add('vault-mode');}
  var a=document.createElement('a');a.className='stat stat-link';a.href=VAULT?'/admin':'/shamela';
  a.textContent=VAULT?'لوحة التحكم الشاملة':'لوحة التحكم';a.title=VAULT?'العودة إلى لوحة التحكم الأساسية':'فتح لوحة التحكم الشاملة';
  st.parentNode.replaceChild(a,st);
})();
$('refreshBtn').onclick=function(){load().then(function(){toast('تم التحديث');});};
var ME={};
api('/api/me').then(function(m){ME=m||{};initNav(m);});
load();
})();
