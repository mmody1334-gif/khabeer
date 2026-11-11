(function(){
'use strict';
// تصحيح الواجبات تلقائيًا: الموقع يعرض مهام نور التي قرأتها «أداة نور»، والأداة هي التي تصحح داخل نور
var NEED='3.5.3',me=null,courses=[],tasks={},serverTs=0,gotTool=false,checking=true,lastReady=null;
var GRADE_NUM={'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
function lsGet(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function track(type,detail,title,grade){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,grade:grade||'',detail:detail||'',title:title||''})});}catch(e){}}
function norm(s){return String(s||'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,'');}
// التصحيح التلقائي يحتاج إصدارًا حديثًا (فيه تبديل الطلاب تلقائيًا)
function toolReady(){return IN_APP||hasExt()||toolOk(NEED);}
// نرسل الطلب، ولو لم تردّ الأداة نعيد المحاولة مرة بمهلة أطول (الأداة قد تُحقن متأخرة)
function ask(type,obj,ackType,ms){
  return ask1(type,obj,ackType,ms||2000).then(function(d){return d||ask1(type,obj,ackType,4000);});
}
function ask1(type,obj,ackType,ms){
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
    // المهام التي أنهت الأداة تصحيحها
    var gd=d.graded||{},G=graded();Object.keys(gd).forEach(function(aid){var a=gd[aid];if(a&&(!G[aid]||(+a.ts||0)>(+G[aid].ts||0))){G[aid]=a;changed=true;}});
    Object.keys(t).forEach(function(cid){if(cid.charAt(0)==='_')return;var a=t[cid],b=tasks[cid];if(!b||(+a.ts||0)>(+b.ts||0)){tasks[cid]=a;changed=true;}});
    if(changed)save();
    return changed;
  });
}
// «المسح»: مهمة أو صف كامل يُخفى من القائمة. يرجع فقط لو جُلبت المهام من نور من جديد بعد المسح
function hid(){var h=tasks._hidden;if(!h||typeof h!=='object'||Array.isArray(h)){h=tasks._hidden={};}return h;}
function graded(){var g=tasks._graded;if(!g||typeof g!=='object'||Array.isArray(g)){g=tasks._graded={};}return g;}
function aidOf(u){return (String(u||'').match(/\/aid:([^/?#]+)/)||[])[1]||'';}
function doneBadge(t){var d=graded()[t.aid||aidOf(t.subUrl)];if(!d)return '';
  return ' <span class="gr-done" title="صحّحت الأداة هذه المهمة. لو سلّم طلاب جدد بعدها صحّحها مرة أخرى — المصحَّحون لا يُلمسون.">✓ تم التصحيح '+esc(new Date(d.ts).toLocaleDateString('en-CA'))+(d.total?' ('+(+d.saved||0)+' من '+(+d.total)+')':'')+'</span>';}
function save(){return api('/api/nour/tasks',{tasks:tasks}).catch(function(){toast('تعذّر الحفظ في الموقع');});}
function visTasks(g){var h=hid();return (g.tasks||[]).filter(function(t){var d=h[t.subUrl];return !d||(+g.ts||0)>d;});}
function delTask(cid,i){var g=tasks[cid],t=g&&visTasks(g)[i];if(!t)return;if(!confirm('مسح المهمة «'+(t.title||'—')+'» من القائمة؟\n(لا يمسح شيئًا في نور)'))return;hid()[t.subUrl]=Date.now();save();render();toast('مُسحت المهمة');}
function delGroup(cid){var g=tasks[cid];if(!g)return;if(!confirm('مسح كل مهمات هذا الصف من القائمة؟\n(لا يمسح شيئًا في نور)'))return;tasks[cid]={cid:cid,grade:g.grade,subject:g.subject,tasks:[],ts:Date.now()};save();render();toast('مُسحت مهمات الصف');}
function grKey(){var last=lsGet('tahdir_grade_course','');return courses.some(function(c){return c.key===last;})?last:(courses.length?cpDefault(courses).key:'');}
function render(){
  var ready=toolReady(),v=toolVersion();
  var comment=lsGet('tahdir_grade_comment','أحسنت');
  var h='<section class="gr-card"><h3>✅ تصحيح الواجبات تلقائيًا <span class="muted small">(تجريبي)</span></h3>'+
    '<p class="m-msg" style="margin:0">«أداة نور» تفتح تسليمات الواجب، وتدخل على كل طالب سلّم ولم يُصحَّح، وتختار <b>الدرجة النهائية</b> لكل سؤال وتكتب التعليق، ثم تضغط «درجة التسليم» وتنتقل للطالب التالي تلقائيًا. (لو ألغيت «احفظ تلقائيًا» تقف عند كل طالب لتحفظ بنفسك.)</p>'+
    '<ul class="gr-steps"><li>1. اجلب المهمات من نور</li><li>2. اختر المهمة واضغط «صحّح تلقائيًا»</li><li>3. اترك تبويب نور يكمل كل الطلاب</li></ul></section>';
  if(!ready&&checking){
    h+='<section class="gr-card"><div class="gr-note">⏳ أبحث عن «أداة نور» في متصفحك…</div></section>';
  }else if(!ready){
    h+='<section class="gr-card"><div class="gr-note">'+(v?'التصحيح التلقائي يحتاج «أداة نور» الإصدار '+NEED+' أو أحدث، وعندك '+esc(v)+'.':'التصحيح التلقائي يعمل من خلال «أداة نور» على متصفحك.')+
      ' <button type="button" class="btn small primary" id="grTool">'+(v?'حدّث الأداة':'ثبّت الأداة')+'</button></div></section>';
  }
  h+='<section class="gr-card"><h3>1. اجلب المهمات من نور</h3><div class="gr-row">'+coursePick(courses,grKey(),'grCourse')+
    '<button type="button" class="btn primary" id="grFetch">اجلب المهمات من نور</button>'+
    '<label class="gr-row small"><input type="checkbox" id="grAuto"'+(lsGet('tahdir_grade_autosave',true)?' checked':'')+'> احفظ تلقائيًا وانتقل للطالب التالي</label>'+
    '<label class="gr-row small" style="margin-inline-start:auto">التعليق للطالب <input id="grComment" class="qsel" style="min-width:160px" value="'+esc(comment)+'" maxlength="120"></label></div>'+
    '<p class="muted small" style="margin:8px 0 0">تفتح صفحة «المهام الإلكترونية» للصف في نور وتحفظ الأداة قائمتها هنا. ويمكنك أيضًا فتح «المهام الإلكترونية» في نور بنفسك — الأداة تحفظ المهام تلقائيًا وتضيف زر «✓ صحّح تلقائيًا» بجانب كل مهمة.</p></section>';
  var groups=Object.keys(tasks).filter(function(cid){return cid.charAt(0)!=='_';}).map(function(cid){return tasks[cid];}).filter(function(g){return g&&g.cid&&visTasks(g).length;})
    .sort(function(a,b){return (GRADE_NUM[a.grade]||99)-(GRADE_NUM[b.grade]||99);});
  h+='<section class="gr-card"><h3>2. مهماتك في نور <button type="button" class="btn small" id="grRefresh" style="margin-inline-start:8px">🔄 تحديث القائمة</button></h3>';
  if(!groups.length)h+='<div class="gr-empty">لا توجد مهمات محفوظة بعد. اختر الصف واضغط «اجلب المهمات من نور».</div>';
  groups.forEach(function(g){
    h+='<h4 style="margin:12px 0 4px">'+esc((g.subject?g.subject+' — ':'')+(g.grade?'الصف '+gLabel(g.grade):'صف في نور'))+' <span class="muted small">· آخر تحديث '+esc(fmtDate(g.ts))+'</span> <button type="button" class="btn small" data-dg="'+esc(g.cid)+'" title="مسح كل مهمات هذا الصف من القائمة">🗑 مسح الكل</button></h4>'+
      '<div class="t-wrap"><table class="gr-tasks"><thead><tr><th>المهمة</th><th>المفردات</th><th>تاريخ النشر</th><th>آخر موعد للتسليم</th><th></th></tr></thead><tbody>'+
      visTasks(g).map(function(t,i){return '<tr><td><b>'+esc(t.title||'—')+'</b>'+doneBadge(t)+'</td><td class="num">'+(t.count||'')+'</td><td class="num">'+esc(t.published||'')+'</td><td class="num">'+esc(t.due||'')+'</td>'+
        '<td style="white-space:nowrap"><button type="button" class="btn small primary" data-g="'+esc(g.cid)+'" data-i="'+i+'">✓ صحّح تلقائيًا</button> <button type="button" class="btn small" data-dt="'+esc(g.cid)+'" data-i="'+i+'" title="مسح المهمة من القائمة">🗑</button></td></tr>';}).join('')+'</tbody></table></div>';
  });
  h+='<p class="gr-note" style="margin:10px 0 0">الطلاب الذين لم يسلّموا، ومن صُحِّح من قبل، لا تلمسهم الأداة. لو لم تجد قائمة الدرجة أو مربع التعليق في صفحة طالب تقف ولا تحفظ. تقدر توقفها في أي لحظة من زر «إيقاف» أعلى صفحة نور.</p></section>';
  $('gr').innerHTML=h;
  $('grRefresh').onclick=function(){var b=this;b.disabled=true;Promise.all([api('/api/nour/tasks').catch(function(){return {};}),pullFromTool()]).then(function(r){
    var srv=(r[0]&&r[0].tasks)||{};Object.keys(srv).forEach(function(k){var a=srv[k],o=tasks[k];if(k==='_hidden'){var h=hid();Object.keys(a||{}).forEach(function(u){if(!h[u]||a[u]>h[u])h[u]=a[u];});return;}if(k==='_graded'){var G=graded();Object.keys(a||{}).forEach(function(u){if(!G[u]||(+a[u].ts||0)>(+G[u].ts||0))G[u]=a[u];});return;}if(k.charAt(0)==='_')return;if(!o||(+a.ts||0)>(+o.ts||0))tasks[k]=a;});
    render();toast(gotTool?'حُدّثت القائمة':'لم تستجب «أداة نور» — تأكد أنها مفعّلة');});};
  if($('grTool'))$('grTool').onclick=function(){toolDialog('');};
  bindCoursePick(courses,'grCourse',function(k){lsSet('tahdir_grade_course',k);});
  $('grComment').oninput=function(){lsSet('tahdir_grade_comment',this.value.trim()||'أحسنت');};
  $('grAuto').onchange=function(){lsSet('tahdir_grade_autosave',this.checked);};
  $('grFetch').onclick=function(){
    var c=courses.filter(function(x){return x.key===$('grCourse').value;})[0];if(!c)return;
    ask('fetch-tasks',{grade:c.grade,subject:c.subject},'fetch-ack',1500).then(function(d){
      if(!d){toolDialog('لم تستجب «أداة نور». تأكد أنها مثبتة ومفعّلة ثم حدّث الصفحة.');return;}
      track('tasks_fetch',courseName(c),'',c.grade);waitTasks();
      toast(d.cid?'فتحت «المهام الإلكترونية» في نور… ارجع هنا بعد ظهور القائمة':'فتحت نور: افتح «المهام الإلكترونية» لهذا الصف وستُحفظ تلقائيًا');
    });
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-g]'),function(b){b.onclick=function(){
    var g=tasks[b.getAttribute('data-g')],t=g&&visTasks(g)[+b.getAttribute('data-i')];if(!t)return;
    var cm=($('grComment').value||'').trim()||'أحسنت';lsSet('tahdir_grade_comment',cm);
    ask('grade',{subUrl:t.subUrl,title:t.title,comment:cm,autosave:$('grAuto').checked},'grade-ack',1500).then(function(d){
      if(!d){toolDialog('لم تستجب «أداة نور». تأكد أنها مثبتة ومفعّلة ثم حدّث الصفحة.');return;}
      track('grade_start',t.title,t.title,g.grade);
      toast('فتحت تسليمات «'+t.title+'» في نور… التصحيح يبدأ تلقائيًا');
    });
  };});
  Array.prototype.forEach.call(document.querySelectorAll('[data-dt]'),function(b){b.onclick=function(){delTask(b.getAttribute('data-dt'),+b.getAttribute('data-i'));};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-dg]'),function(b){b.onclick=function(){delGroup(b.getAttribute('data-dg'));};});
}
// الأداة قد تُحقن بعد ثوانٍ (خصوصًا عند أول فتح للمتصفح): نراقب ظهورها ونعيد العرض ونسحب مهامها
function sync(){
  var r=toolReady();
  return pullFromTool().then(function(c){if(c||r!==lastReady){lastReady=r;render();}});
}
// بعد «اجلب المهمات»: نسأل الأداة كل 3 ثوانٍ (حتى 3 دقائق) إلى أن تصل المهام الجديدة
var waitT=null;
function waitTasks(){
  clearInterval(waitT);var n=0;
  waitT=setInterval(function(){if(++n>60){clearInterval(waitT);return;}pullFromTool().then(function(c){if(c){clearInterval(waitT);render();toast('✓ وصلت المهمات من نور');}});},3000);
}
function watchTool(){
  try{new MutationObserver(function(){sync();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-tahdir-tool','data-tahdir-ext']});}catch(e){}
  [300,1200,2500,5000,9000].forEach(function(ms){setTimeout(sync,ms);});
  setTimeout(function(){checking=false;lastReady=null;sync();},9500);
}
document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(sync,500);});
Promise.all([api('/api/me'),api('/api/courses'),api('/api/nour/tasks')]).then(function(r){
  me=r[0];initNav(me);
  courses=(r[1].courses||[]).sort(function(a,b){return ((GRADE_NUM[a.grade]||99)-(GRADE_NUM[b.grade]||99))||a.subject.localeCompare(b.subject,'ar');});
  tasks=r[2].tasks||{};
  if(toolReady())checking=false;
  lastReady=toolReady();render();
  watchTool();
},function(e){$('gr').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
