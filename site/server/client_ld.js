// «سجل الطلبة ذوي صعوبات التعلم»: سجلات يملؤها المعلم (فارغة في البداية) لكل صف/شعبة:
// اسم الطالب، جوانب الصعوبة، مستوى الأداء الحالي، الخطة الفردية (الأهداف، الاستراتيجيات، التكييفات، التقويم) والمتابعة.
// يُحفظ في حساب المعلم على السيرفر (نوع ld في مخزن «اختباراتي») فيجده من أي جهاز، ولا يظهر في لوحة التحكم.
(function(){
'use strict';
guard();
var me=null,list=[],R=null,cur=-1,dirty=false;
var ASPECTS=[
  ['القراءة','قراءة مصاحبة وقراءة متكررة لنص قصير · تقسيم النص إلى أجزاء قصيرة · بطاقات المفردات المصوّرة · تظليل الكلمات المفتاحية','قراءة الأسئلة للطالب عند الحاجة · خط أكبر ومسافات أوسع · وقت إضافي'],
  ['الكتابة والإملاء','نسخ موجّه ثم إملاء منظور فإملاء غير منظور · قوائم الكلمات الشائعة الخطأ · أوراق بخطوط مساعدة','تقليل كمية الكتابة · قبول الإجابة الشفهية أو بالاختيار · عدم احتساب الأخطاء الإملائية في غير مادتها'],
  ['الحساب والعمليات','استخدام المحسوسات والصور · تجزئة المسألة إلى خطوات · بطاقات الحقائق الأساسية','السماح بجدول الضرب أو الآلة الحاسبة عند الحاجة · مسائل أقل بنفس المهارة'],
  ['الفهم والاستيعاب','أسئلة قبل القراءة وبعدها · المنظمات البصرية وخرائط المفاهيم · إعادة الصياغة بلغة الطالب','تبسيط صياغة الأسئلة · أمثلة محلولة قبل المطلوب'],
  ['الانتباه والتركيز','مهام قصيرة متتابعة مع تعزيز فوري · إشارات متفق عليها لإعادة الانتباه · قائمة مهام مرئية','الجلوس قرب المعلم بعيدًا عن المشتتات · فترات راحة قصيرة · تعليمات خطوة بخطوة'],
  ['الذاكرة','التكرار المتباعد · الربط بالصور والقصص · الملخصات والبطاقات','ورقة مساعدة بالمصطلحات · مراجعة قصيرة قبل كل درس'],
  ['التعبير الشفهي','التعلم بالأقران · نماذج جمل جاهزة · فرص مشاركة مخطط لها مسبقًا','إعطاء وقت للتفكير قبل الإجابة · قبول الإجابة المكتوبة أو بالإشارة'],
  ['المهارات الحركية الدقيقة','تمارين المسك والتتبع · أدوات كتابة مُعدّلة','أوراق مطبوعة بدل النسخ من السبورة · مساحات إجابة أوسع'],
  ['التنظيم والتخطيط','جداول ومهام مقسّمة · قوائم مراجعة ذاتية · ملف منظم للمادة','تذكير بالمواعيد · تقسيم الواجبات الطويلة'],
  ['السلوك والتكيف','عقد سلوكي بسيط وتعزيز إيجابي · أدوار ومسؤوليات داخل الصف','التواصل المستمر مع ولي الأمر والأخصائي الاجتماعي']];
var ASP_NAMES=ASPECTS.map(function(a){return a[0];});
function today(){var d=new Date();return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate();}
function track(type,detail,title){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,detail:detail||'',title:title||''})});}catch(e){}}
function blankStudent(){return {name:'',aspects:[],other:'',level:'',diag:'',goalsL:'',goalsS:'',strat:'',accom:'',eval:'',follow:[]};}
function newR(){return {id:null,title:'',subject:'',grade:'',section:'',teacher:me&&me.name||'',year:schoolHdr().year,students:[],sig:{spec:'',principal:''}};}

// ---------- الحفظ ----------
var saveT=null;
function save(silent){
  if(!R)return Promise.resolve();
  R.title=(R.title||'').trim()||('سجل صعوبات التعلم — '+(R.subject||'')+' '+(R.grade||'')+(R.section?' / '+R.section:'')).trim();
  return api('/api/quizzes',{id:R.id,title:R.title,grade:R.grade,subject:R.subject,kind:'ld',data:R}).then(function(r){R.id=r.id;dirty=false;status();if(!silent)toast('حُفظ في حسابك');},function(e){toast(e.message);});
}
function touch(){dirty=true;status();clearTimeout(saveT);saveT=setTimeout(function(){save(true);},2000);}
function status(){var el=$('ldStatus');if(el)el.textContent=dirty?'جارٍ الحفظ…':(R&&R.id?'محفوظ في حسابك ✓':'');}

// ---------- قائمة السجلات ----------
function renderList(){
  var h='<div class="an-head"><h2>🧩 سجل الطلبة ذوي صعوبات التعلم</h2><p class="muted">أنشئ سجلًا لكل صف أو شعبة، وأضف طلابك وجوانب الصعوبة لدى كل طالب وخطته الفردية ومتابعتها. السجل محفوظ في حسابك وحدك وتفتحه من أي جهاز، ويُطبع بالترويسة الرسمية.</p></div>'+
    '<div class="an-new"><button type="button" class="btn primary" id="ldNew">+ سجل جديد</button><a class="btn" href="'+'/quiz'+'">📝 أوراق عمل متمايزة (المستوى الأساسي)</a></div><h3 class="an-sub">سجلاتي</h3>';
  h+=list.length?'<ul class="an-list">'+list.map(function(q){return '<li><button type="button" class="link-btn" data-open="'+q.id+'"><b>'+esc(q.title)+'</b></button><span class="muted small">'+esc(fmtDate(q.updated_at))+'</span><button type="button" class="x" data-del="'+q.id+'" aria-label="حذف">×</button></li>';}).join('')+'</ul>':'<p class="muted">لا توجد سجلات بعد.</p>';
  $('ldMain').innerHTML=h;
  $('ldNew').onclick=function(){R=newR();R.students=[blankStudent()];cur=0;dirty=true;renderEditor();};
  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'),function(b){b.onclick=function(){api('/api/quizzes/'+b.getAttribute('data-open')).then(function(r){R=r.quiz.data;R.id=r.quiz.id;R.sig=R.sig||{};cur=R.students.length?0:-1;dirty=false;renderEditor();},function(e){toast(e.message);});};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-del]'),function(b){b.onclick=function(){dialog({title:'حذف السجل؟',message:'سيُحذف السجل وكل بيانات طلابه نهائيًا.',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/quizzes/'+b.getAttribute('data-del'),null,'DELETE').then(load);});};});
}
function load(){return api('/api/quizzes?kind=ld').then(function(r){list=r.quizzes||[];renderList();},function(e){$('ldMain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});}

// ---------- المحرّر ----------
function inp(id,v,ph){return '<input class="an-in" id="'+id+'" value="'+esc(v||'')+'" placeholder="'+esc(ph||'')+'">';}
function ta(k,v,ph,rows){return '<textarea class="an-in" data-f="'+k+'" rows="'+(rows||3)+'" placeholder="'+esc(ph||'')+'">'+esc(v||'')+'</textarea>';}
function renderEditor(){
  var s=R.students[cur];
  var h='<div class="an-bar no-print"><button type="button" class="btn small" id="ldBack">→ سجلاتي</button><input class="title-in sm" id="ldTitle" value="'+esc(R.title||'')+'" placeholder="اسم السجل (مثال: صعوبات التعلم — العلوم السادس / 2)"><span class="muted small" id="ldStatus"></span>'+
    '<span class="an-acts"><button type="button" class="btn primary" id="ldPrintAll">🖨 طباعة السجل</button>'+(s?'<button type="button" class="btn" id="ldPrintOne">🖨 الخطة الفردية للطالب</button>':'')+'<button type="button" class="btn" id="ldWord">⬇ Word</button></span></div>'+
    '<section class="qcard"><h3>بيانات السجل</h3><div class="an-meta"><label>المادة'+inp('ldSubj',R.subject)+'</label><label>الصف'+inp('ldGrade',R.grade)+'</label><label>الشعبة'+inp('ldSec',R.section)+'</label><label>العام الدراسي'+inp('ldYear',R.year)+'</label></div></section>'+
    '<div class="ld-layout"><aside class="qcard ld-side"><h3>الطلاب ('+R.students.length+')</h3><ul class="ld-st">'+R.students.map(function(x,i){return '<li><button type="button" class="'+(i===cur?'on':'')+'" data-st="'+i+'"><b>'+esc(x.name||('طالب '+(i+1)))+'</b><small>'+esc(x.aspects.join('، ')||'—')+'</small></button></li>';}).join('')+'</ul>'+
      '<button type="button" class="btn small" id="ldAdd">+ طالب</button></aside><section class="qcard ld-main">';
  if(!s)h+='<p class="muted">أضف طالبًا لتبدأ.</p>';
  else h+='<div class="ld-head"><label class="ld-name">اسم الطالب'+inp('ldName',s.name,'الاسم الثلاثي')+'</label><button type="button" class="btn small danger" id="ldDel">حذف الطالب</button></div>'+
    '<h4>جوانب الصعوبة</h4><div class="ld-asp">'+ASP_NAMES.map(function(a){return '<label><input type="checkbox" data-asp="'+esc(a)+'"'+(s.aspects.indexOf(a)>=0?' checked':'')+'> '+esc(a)+'</label>';}).join('')+'</div>'+
    '<label class="an-note">جوانب أخرى'+inp('ldOther',s.other,'اختياري')+'</label>'+
    '<label class="an-note">التشخيص / مصدر الإحالة'+ta('diag',s.diag,'مثال: محوّل من أخصائي صعوبات التعلم — تقرير بتاريخ …',2)+'</label>'+
    '<label class="an-note">مستوى الأداء الحالي (نقاط القوة والاحتياج)'+ta('level',s.level,'ما يستطيعه الطالب الآن وما يحتاج إليه',3)+'</label>'+
    '<h4>الخطة الفردية <button type="button" class="btn small" id="ldSuggest" title="يكتب استراتيجيات وتكييفات مقترحة حسب الجوانب المختارة">✨ اقتراح من الجوانب المختارة</button></h4>'+
    '<label class="an-note">الأهداف بعيدة المدى'+ta('goalsL',s.goalsL,'مثال: أن يقرأ الطالب فقرة من 5 أسطر قراءة صحيحة',2)+'</label>'+
    '<label class="an-note">الأهداف قصيرة المدى'+ta('goalsS',s.goalsS,'أهداف أسبوعية قابلة للقياس',3)+'</label>'+
    '<label class="an-note">الاستراتيجيات والأنشطة'+ta('strat',s.strat,'',3)+'</label>'+
    '<label class="an-note">التكييفات (في الحصة والاختبارات)'+ta('accom',s.accom,'',3)+'</label>'+
    '<label class="an-note">أساليب التقويم'+ta('eval',s.eval,'مثال: ملاحظة مباشرة · أوراق عمل المستوى الأساسي · سجل قراءة',2)+'</label>'+
    '<h4>المتابعة</h4><table class="an-t"><thead><tr><th style="width:110px">التاريخ</th><th>الإجراء / الملاحظة</th><th style="width:150px">مستوى التقدم</th><th style="width:30px"></th></tr></thead><tbody>'+
      s.follow.map(function(f,i){return '<tr><td><input class="an-in" data-fw="'+i+'" data-k="d" value="'+esc(f.d||'')+'"></td><td><input class="an-in" style="width:100%" data-fw="'+i+'" data-k="n" value="'+esc(f.n||'')+'"></td><td><select class="an-in" data-fw="'+i+'" data-k="p">'+['','لم يتحقق','تحقق جزئيًا','تحقق'].map(function(o){return '<option'+(o===f.p?' selected':'')+'>'+o+'</option>';}).join('')+'</select></td><td><button type="button" class="x" data-fwdel="'+i+'">×</button></td></tr>';}).join('')+
    '</tbody></table><button type="button" class="btn small" id="ldFw">+ متابعة</button>';
  h+='</section></div><section class="qcard"><h3>الاعتماد</h3><div class="an-meta"><label>معلم المادة'+inp('ldT',R.teacher)+'</label><label>أخصائي صعوبات التعلم'+inp('ldSp',R.sig.spec)+'</label><label>مدير المدرسة'+inp('ldP',R.sig.principal)+'</label></div></section>';
  $('ldMain').innerHTML=h;status();bind();
}
function bind(){
  var s=R.students[cur];
  $('ldBack').onclick=function(){var go=function(){R=null;load();};if(dirty)save(true).then(go);else go();};
  $('ldTitle').oninput=function(){R.title=this.value;touch();};
  [['ldSubj','subject'],['ldGrade','grade'],['ldSec','section'],['ldYear','year'],['ldT','teacher']].forEach(function(p){$(p[0]).oninput=function(){R[p[1]]=this.value;touch();};});
  $('ldSp').oninput=function(){R.sig.spec=this.value;touch();};$('ldP').oninput=function(){R.sig.principal=this.value;touch();};
  Array.prototype.forEach.call(document.querySelectorAll('[data-st]'),function(b){b.onclick=function(){cur=+b.getAttribute('data-st');renderEditor();};});
  $('ldAdd').onclick=function(){R.students.push(blankStudent());cur=R.students.length-1;touch();renderEditor();var n=$('ldName');if(n)n.focus();};
  $('ldPrintAll').onclick=function(){printIt(registerHtml(false),'سجل صعوبات التعلم');};
  if($('ldPrintOne'))$('ldPrintOne').onclick=function(){printIt(planHtml(R.students[cur],false),'الخطة الفردية — '+(R.students[cur].name||''));};
  $('ldWord').onclick=wordIt;
  if(!s)return;
  $('ldName').oninput=function(){s.name=this.value;touch();var b=document.querySelector('[data-st="'+cur+'"] b');if(b)b.textContent=s.name||('طالب '+(cur+1));};
  $('ldOther').oninput=function(){s.other=this.value;touch();};
  $('ldDel').onclick=function(){dialog({title:'حذف الطالب من السجل؟',okText:'حذف',danger:true}).then(function(ok){if(!ok)return;R.students.splice(cur,1);cur=Math.min(cur,R.students.length-1);touch();renderEditor();});};
  Array.prototype.forEach.call(document.querySelectorAll('[data-asp]'),function(c){c.onchange=function(){var a=c.getAttribute('data-asp');s.aspects=s.aspects.filter(function(x){return x!==a;});if(c.checked)s.aspects.push(a);s.aspects.sort(function(x,y){return ASP_NAMES.indexOf(x)-ASP_NAMES.indexOf(y);});touch();var sm=document.querySelector('[data-st="'+cur+'"] small');if(sm)sm.textContent=s.aspects.join('، ')||'—';};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-f]'),function(t){t.oninput=function(){s[t.getAttribute('data-f')]=t.value;touch();};});
  $('ldSuggest').onclick=function(){
    if(!s.aspects.length){toast('اختر جانب صعوبة واحدًا على الأقل');return;}
    var st=[],ac=[];ASPECTS.forEach(function(a){if(s.aspects.indexOf(a[0])>=0){st.push('• '+a[0]+': '+a[1]);ac.push('• '+a[0]+': '+a[2]);}});
    s.strat=(s.strat?s.strat.trim()+'\n':'')+st.join('\n');s.accom=(s.accom?s.accom.trim()+'\n':'')+ac.join('\n');
    if(!s.eval)s.eval='ملاحظة مباشرة في الحصة · أوراق عمل المستوى الأساسي · مقارنة أداء الطالب بأدائه السابق';
    touch();renderEditor();toast('أُضيفت المقترحات — عدّلها بما يناسب الطالب');
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-fw]'),function(el){var f=function(){s.follow[+el.getAttribute('data-fw')][el.getAttribute('data-k')]=el.value;touch();};el.oninput=f;el.onchange=f;});
  Array.prototype.forEach.call(document.querySelectorAll('[data-fwdel]'),function(b){b.onclick=function(){s.follow.splice(+b.getAttribute('data-fwdel'),1);touch();renderEditor();};});
  $('ldFw').onclick=function(){s.follow.push({d:today(),n:'',p:''});touch();renderEditor();};
}

// ---------- الطباعة ----------
var G='-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#e3f1eb;',C='border:1px solid #555;padding:4px 6px;vertical-align:top;text-align:right',CH=C+';'+G+'font-weight:bold;text-align:center';
function para(t){return esc(t||'').replace(/\n/g,'<br>')||'&nbsp;';}
function head(title,word){var H=schoolHdr();return OFFICIAL_HEAD({dir:H.dir,school:H.school,title:title,line2:'المادة: '+(R.subject||'')+' · الصف: '+(R.grade||'')+(R.section?' / '+R.section:'')+' · العام الدراسي: '+(R.year||H.year),word:word});}
function sigs(word,extra){return '<table style="width:100%;border-collapse:collapse;margin-top:18px;page-break-inside:avoid;font-size:'+(word?'11pt':'.9em')+'"><tr>'+[['معلم المادة',R.teacher],['أخصائي صعوبات التعلم',R.sig.spec]].concat(extra||[]).concat([['مدير المدرسة',R.sig.principal]]).map(function(s){return '<td style="text-align:center;vertical-align:top;padding:4px"><b>'+s[0]+'</b><br>'+esc(s[1]||'')+'<br><span style="color:#777">التوقيع: ..............</span></td>';}).join('')+'</tr></table>';}
function registerHtml(word){
  var fs=word?'10pt':'.82em';
  return '<div dir="rtl">'+head('سجل الطلبة ذوي صعوبات التعلم',word)+'<table style="width:100%;border-collapse:collapse;font-size:'+fs+'"><thead><tr>'+['م','اسم الطالب','جوانب الصعوبة','مستوى الأداء الحالي','أبرز الاستراتيجيات والتكييفات','آخر متابعة'].map(function(x){return '<th style="'+CH+'">'+x+'</th>';}).join('')+'</tr></thead><tbody>'+
    R.students.filter(function(s){return s.name||s.aspects.length;}).map(function(s,i){var lf=s.follow[s.follow.length-1];
      return '<tr><td style="'+C+';text-align:center">'+(i+1)+'</td><td style="'+C+';white-space:nowrap"><b>'+esc(s.name)+'</b></td><td style="'+C+'">'+esc(s.aspects.concat(s.other?[s.other]:[]).join('، '))+'</td><td style="'+C+'">'+para(s.level)+'</td><td style="'+C+'">'+para(String(s.strat||'').split('\n').slice(0,2).join('\n'))+'</td><td style="'+C+'">'+(lf?esc(lf.d||'')+'<br>'+esc(lf.n||'')+(lf.p?' ('+esc(lf.p)+')':''):'')+'</td></tr>';}).join('')+
    '</tbody></table>'+sigs(word)+'</div>';
}
function planHtml(s,word){
  var row=function(k,v){return '<tr><th style="'+CH+';width:24%">'+k+'</th><td style="'+C+'">'+v+'</td></tr>';};
  var T='width:100%;border-collapse:collapse;margin:0 0 10px;font-size:'+(word?'11pt':'.9em');
  return '<div dir="rtl">'+head('الخطة التربوية الفردية — صعوبات التعلم',word)+
    '<table style="'+T+'">'+row('اسم الطالب','<b>'+esc(s.name||'')+'</b>')+row('جوانب الصعوبة',esc(s.aspects.concat(s.other?[s.other]:[]).join('، ')))+row('التشخيص / مصدر الإحالة',para(s.diag))+row('مستوى الأداء الحالي',para(s.level))+'</table>'+
    '<table style="'+T+'">'+row('الأهداف بعيدة المدى',para(s.goalsL))+row('الأهداف قصيرة المدى',para(s.goalsS))+row('الاستراتيجيات والأنشطة',para(s.strat))+row('التكييفات',para(s.accom))+row('أساليب التقويم',para(s.eval))+'</table>'+
    '<table style="'+T+'"><thead><tr><th style="'+CH+';width:18%">التاريخ</th><th style="'+CH+'">الإجراء / الملاحظة</th><th style="'+CH+';width:20%">مستوى التقدم</th></tr></thead><tbody>'+
      (s.follow.length?s.follow:[{},{},{}]).map(function(f){return '<tr><td style="'+C+';height:22px">'+esc(f.d||'')+'</td><td style="'+C+'">'+esc(f.n||'')+'</td><td style="'+C+'">'+esc(f.p||'')+'</td></tr>';}).join('')+'</tbody></table>'+
    sigs(word,[['ولي الأمر','']])+'</div>';
}
var MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function printIt(html,name){
  track('ld_print','',name);
  if(!IN_APP&&!MOBILE){$('printArea').innerHTML='<div class="ppage">'+html+'</div>';doPrint(name);return;}
  var w=null;if(!IN_APP){try{w=window.open('','_blank');}catch(e){w=null;}}
  api('/api/export',{format:'print',name:name,html:'<div class="pg">'+html+'</div>'}).then(function(r){if(w){try{w.location.href=r.url;return;}catch(e){}}location.href=r.url;},function(e){if(w)try{w.close();}catch(x){}toast(e.message);});
}
function wordIt(){
  var parts=[registerHtml(true)].concat(R.students.filter(function(s){return s.name;}).map(function(s){return planHtml(s,true);}));
  var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>سجل صعوبات التعلم</title>'+
    '<style>@page WordSection1{size:595.3pt 841.9pt;margin:30pt}div.WordSection1{page:WordSection1}body{font-family:"Simplified Arabic",Arial;font-size:12pt;direction:rtl}table{direction:rtl}</style></head><body dir="rtl" lang="AR-OM"><div class="WordSection1" dir="rtl">'+
    parts.join('<br clear="all" style="page-break-before:always">')+'</div></body></html>';
  toast('جارٍ التجهيز…');
  api('/api/export',{format:'doc',name:R.title||'سجل صعوبات التعلم',html:html}).then(function(r){var a=document.createElement('a');a.href=r.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);},function(e){toast(e.message);});
}
window.addEventListener('beforeunload',function(e){if(dirty&&R){save(true);e.preventDefault();e.returnValue='';}});
api('/api/me').then(function(m){me=m;initNav(m);load();},function(e){$('ldMain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
