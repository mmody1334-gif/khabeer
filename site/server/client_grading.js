(function(){
'use strict';
// تصحيح الواجبات تلقائيًا: الموقع يعرض مهام نور التي قرأتها «أداة نور»، والأداة هي التي تصحح داخل نور
var NEED='3.3.0',me=null,courses=[],tasks={},serverTs=0,gotTool=false;
var GRADE_NUM={'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
function lsGet(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function track(type,detail,title,grade){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,grade:grade||'',detail:detail||'',title:title||''})});}catch(e){}}
function norm(s){return String(s||'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,'');}
// التصحيح التلقائي يحتاج إصدارًا حديثًا (فيه تبديل الطلاب تلقائيًا)
function toolReady(){return IN_APP||hasExt()||toolOk(NEED);}
function ask(type,obj,ackType,ms){
  return new Promise(function(res){
    var done=false;function on(e){done=true;document.removeEventListener('tahdir-'+ackType,on);var d={};try{d=JSON.parse(String(e.detail));}catch(x){}res(d);}
    document.addEventListener('tahdir-'+ackType,on);
    document.dispatchEvent(new CustomEvent('tahdir-v3-'+type,{detail:JSON.stringify(obj||{})}));
    setTimeout(function(){if(!done){document.removeEventListener('tahdir-'+ackType,on);res(null);}},ms||1500);
  });
}
function courseName(c){return (c.subject||'')+' — الصف '+(gLabel(c.grade)||'؟');}
// نجمع مهام الأداة (الأحدث) مع النسخة المحفوظة في الموقع، ونحفظ في الموقع لو تغيّر شيء
function pullFromTool(){
  if(!toolReady())return Promise.resolve(false);
  return ask('get-tasks',{},'tasks',1500).then(function(d){
    if(!d)return false;gotTool=true;var changed=false,t=d.tasks||{};
    Object.keys(t).forEach(function(cid){var a=t[cid],b=tasks[cid];if(!b||(+a.ts||0)>(+b.ts||0)){tasks[cid]=a;changed=true;}});
    if(changed)api('/api/nour/tasks',{tasks:tasks}).catch(function(){});
    return changed;
  });
}
function grKey(){var last=lsGet('tahdir_grade_course','');return courses.some(function(c){return c.key===last;})?last:(courses.length?cpDefault(courses).key:'');}
function render(){
  var ready=toolReady(),v=toolVersion();
  var comment=lsGet('tahdir_grade_comment','أحسنت');
  var h='<section class="gr-card"><h3>✅ تصحيح الواجبات تلقائيًا <span class="muted small">(تجريبي)</span></h3>'+
    '<p class="m-msg" style="margin:0">«أداة نور» تفتح تسليمات الواجب، وتدخل على كل طالب سلّم ولم يُصحَّح، وتختار <b>الدرجة النهائية</b> لكل سؤال وتكتب التعليق، ثم تضغط «درجة التسليم» وتنتقل للطالب التالي تلقائيًا. (لو ألغيت «احفظ تلقائيًا» تقف عند كل طالب لتحفظ بنفسك.)</p>'+
    '<ul class="gr-steps"><li>1. اجلب المهمات من نور</li><li>2. اختر المهمة واضغط «صحّح تلقائيًا»</li><li>3. اترك تبويب نور يكمل كل الطلاب</li></ul></section>';
  if(!ready){
    h+='<section class="gr-card"><div class="gr-note">'+(v?'التصحيح التلقائي يحتاج «أداة نور» الإصدار '+NEED+' أو أحدث، وعندك '+esc(v)+'.':'التصحيح التلقائي يعمل من خلال «أداة نور» على متصفحك.')+
      ' <button type="button" class="btn small primary" id="grTool">'+(v?'حدّث الأداة':'ثبّت الأداة')+'</button></div></section>';
  }
  h+='<section class="gr-card"><h3>1. اجلب المهمات من نور</h3><div class="gr-row">'+coursePick(courses,grKey(),'grCourse')+
    '<button type="button" class="btn primary" id="grFetch"'+(ready?'':' disabled')+'>اجلب المهمات من نور</button>'+
    '<label class="gr-row small"><input type="checkbox" id="grAuto"'+(lsGet('tahdir_grade_autosave',true)?' checked':'')+'> احفظ تلقائيًا وانتقل للطالب التالي</label>'+
    '<label class="gr-row small" style="margin-inline-start:auto">التعليق للطالب <input id="grComment" class="qsel" style="min-width:160px" value="'+esc(comment)+'" maxlength="120"></label></div>'+
    '<p class="muted small" style="margin:8px 0 0">تفتح صفحة «المهام الإلكترونية» للصف في نور وتحفظ الأداة قائمتها هنا. ويمكنك أيضًا فتح «المهام الإلكترونية» في نور بنفسك — الأداة تحفظ المهام تلقائيًا وتضيف زر «✓ صحّح تلقائيًا» بجانب كل مهمة.</p></section>';
  var groups=Object.keys(tasks).map(function(cid){return tasks[cid];}).filter(function(g){return g&&g.tasks&&g.tasks.length;})
    .sort(function(a,b){return (GRADE_NUM[a.grade]||99)-(GRADE_NUM[b.grade]||99);});
  h+='<section class="gr-card"><h3>2. مهماتك في نور</h3>';
  if(!groups.length)h+='<div class="gr-empty">لا توجد مهمات محفوظة بعد. اختر الصف واضغط «اجلب المهمات من نور».</div>';
  groups.forEach(function(g){
    h+='<h4 style="margin:12px 0 4px">'+esc((g.subject?g.subject+' — ':'')+(g.grade?'الصف '+gLabel(g.grade):'صف في نور'))+' <span class="muted small">· آخر تحديث '+esc(fmtDate(g.ts))+'</span></h4>'+
      '<div class="t-wrap"><table class="gr-tasks"><thead><tr><th>المهمة</th><th>المفردات</th><th>تاريخ النشر</th><th>آخر موعد للتسليم</th><th></th></tr></thead><tbody>'+
      g.tasks.map(function(t,i){return '<tr><td><b>'+esc(t.title||'—')+'</b></td><td class="num">'+(t.count||'')+'</td><td class="num">'+esc(t.published||'')+'</td><td class="num">'+esc(t.due||'')+'</td>'+
        '<td><button type="button" class="btn small primary" data-g="'+esc(g.cid)+'" data-i="'+i+'"'+(ready?'':' disabled')+'>✓ صحّح تلقائيًا</button></td></tr>';}).join('')+'</tbody></table></div>';
  });
  h+='<p class="gr-note" style="margin:10px 0 0">الطلاب الذين لم يسلّموا، ومن صُحِّح من قبل، لا تلمسهم الأداة. لو لم تجد قائمة الدرجة أو مربع التعليق في صفحة طالب تقف ولا تحفظ. تقدر توقفها في أي لحظة من زر «إيقاف» أعلى صفحة نور.</p></section>';
  $('gr').innerHTML=h;
  if($('grTool'))$('grTool').onclick=function(){toolDialog('');};
  bindCoursePick(courses,'grCourse',function(k){lsSet('tahdir_grade_course',k);});
  $('grComment').onchange=function(){lsSet('tahdir_grade_comment',this.value.trim()||'أحسنت');};
  $('grAuto').onchange=function(){lsSet('tahdir_grade_autosave',this.checked);};
  $('grFetch').onclick=function(){
    var c=courses.filter(function(x){return x.key===$('grCourse').value;})[0];if(!c)return;
    ask('fetch-tasks',{grade:c.grade,subject:c.subject},'fetch-ack',1500).then(function(d){
      if(!d){toolDialog('لم تستجب «أداة نور». تأكد أنها مثبتة ومفعّلة ثم حدّث الصفحة.');return;}
      track('tasks_fetch',courseName(c),'',c.grade);
      toast(d.cid?'فتحت «المهام الإلكترونية» في نور… ارجع هنا بعد ظهور القائمة':'فتحت نور: افتح «المهام الإلكترونية» لهذا الصف وستُحفظ تلقائيًا');
    });
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-g]'),function(b){b.onclick=function(){
    var g=tasks[b.getAttribute('data-g')],t=g&&g.tasks[+b.getAttribute('data-i')];if(!t)return;
    var cm=($('grComment').value||'').trim()||'أحسنت';lsSet('tahdir_grade_comment',cm);
    ask('grade',{subUrl:t.subUrl,title:t.title,comment:cm,autosave:$('grAuto').checked},'grade-ack',1500).then(function(d){
      if(!d){toolDialog('لم تستجب «أداة نور». تأكد أنها مثبتة ومفعّلة ثم حدّث الصفحة.');return;}
      track('grade_start',t.title,t.title,g.grade);
      toast('فتحت تسليمات «'+t.title+'» في نور… التصحيح يبدأ تلقائيًا');
    });
  };});
}
document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(function(){pullFromTool().then(function(c){if(c)render();});},500);});
Promise.all([api('/api/me'),api('/api/courses'),api('/api/nour/tasks')]).then(function(r){
  me=r[0];initNav(me);
  courses=(r[1].courses||[]).sort(function(a,b){return ((GRADE_NUM[a.grade]||99)-(GRADE_NUM[b.grade]||99))||a.subject.localeCompare(b.subject,'ar');});
  tasks=r[2].tasks||{};
  render();
  // الأداة تُحقن بعد تحميل الصفحة بقليل
  setTimeout(function(){pullFromTool().then(function(){render();});},1200);
},function(e){$('gr').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
