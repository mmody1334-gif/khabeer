// «النماذج الإدارية»: نماذج جاهزة يملؤها المعلم وتُطبع بالترويسة الرسمية أو تُحمَّل Word:
// محضر اجتماع · تقرير نشاط (بالصور) · تقرير زيارة تبادلية · إشعار ولي أمر · سجل متابعة الطلبة (فارغ للطباعة)
// · شهادات شكر وتقدير (لعدة أسماء دفعة واحدة) · غلاف وفهرس ملف الإنجاز.
// كل نموذج يُحفظ في حساب المعلم (نوع form) ويُفتح من أي جهاز.
(function(){
'use strict';
guard();
var me=null,saved=[],T=null,D=null,id=null,dirty=false;
function today(){var d=new Date();return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate();}
function track(type,detail,title){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,detail:detail||'',title:title||''})});}catch(e){}}
function para(t){return esc(t||'').replace(/\n/g,'<br>')||'&nbsp;';}
function lines(t){return String(t||'').split('\n').map(function(x){return x.trim();}).filter(Boolean);}
var C='border:1px solid #555;padding:5px 7px;vertical-align:top;text-align:right',CH='border:1px solid #555;padding:5px 7px;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#e3f1eb;font-weight:bold;text-align:center';
function tb(head,rows,word){return '<table style="width:100%;border-collapse:collapse;margin:4px 0 12px;font-size:'+(word?'11pt':'.9em')+'"><thead><tr>'+head.map(function(h){return '<th style="'+CH+'">'+h+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(c){return '<td style="'+C+'">'+c+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';}
function kv(rows,word){return '<table style="width:100%;border-collapse:collapse;margin:4px 0 12px;font-size:'+(word?'11pt':'.92em')+'">'+rows.map(function(r){return '<tr><th style="'+CH+';width:26%">'+r[0]+'</th><td style="'+C+'">'+r[1]+'</td></tr>';}).join('')+'</table>';}
function sec(t){return '<h3 style="margin:12px 0 4px;font-size:1em;border-bottom:2px solid #1f8a70;padding-bottom:2px">'+t+'</h3>';}
function head(title,line2,word){var H=schoolHdr();return OFFICIAL_HEAD({dir:H.dir,school:H.school,title:title,line2:line2||('الفصل الدراسي: '+H.term+' - العام الدراسي: '+H.year+'م'),word:word});}
function sigs(list,word){return '<table style="width:100%;border-collapse:collapse;margin-top:22px;page-break-inside:avoid;font-size:'+(word?'11pt':'.92em')+'"><tr>'+list.map(function(s){return '<td style="text-align:center;vertical-align:top;padding:4px"><b>'+s[0]+'</b><br>'+esc(s[1]||'')+'<br><span style="color:#777">التوقيع: ..............</span></td>';}).join('')+'</tr></table>';}
function tableRows(v,n){return (v||[]).filter(function(r){return r.some(function(c){return String(c||'').trim();});});}

// ---------- النماذج ----------
var TPL=[
 {id:'meeting',icon:'🗂',name:'محضر اجتماع',desc:'اجتماع القسم أو المادة: الحضور، جدول الأعمال، القرارات والمسؤوليات.',
  fields:[['title','عنوان الاجتماع','text','اجتماع قسم العلوم'],['no','رقم الاجتماع','text','1'],['date','التاريخ','text',today()],['time','الوقت','text','الحصة السابعة'],['place','المكان','text','غرفة القسم'],['chair','رئيس الاجتماع','text',''],['clerk','مقرر الاجتماع','text',''],
   ['present','الحضور (كل اسم في سطر)','textarea',''],['absent','الغائبون (اختياري)','textarea',''],['agenda','جدول الأعمال (كل بند في سطر)','textarea',''],
   ['decisions','القرارات والتوصيات','table',['البند / الموضوع','القرار','المسؤول عن التنفيذ','موعد التنفيذ']],['notes','ملاحظات إضافية','textarea','']],
  render:function(d,w){return head('محضر '+(d.title||'اجتماع')+(d.no?' رقم ('+esc(d.no)+')':''),'',w)+
    kv([['التاريخ',esc(d.date)],['الوقت',esc(d.time)],['المكان',esc(d.place)],['رئيس الاجتماع',esc(d.chair)],['مقرر الاجتماع',esc(d.clerk)]],w)+
    sec('الحضور ('+lines(d.present).length+')')+tb(['م','الاسم','التوقيع'],lines(d.present).map(function(n,i){return [i+1,esc(n),''];}),w)+
    (lines(d.absent).length?sec('الغائبون')+'<p>'+lines(d.absent).map(esc).join('، ')+'</p>':'')+
    sec('جدول الأعمال')+'<ol>'+lines(d.agenda).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ol>'+
    sec('القرارات والتوصيات')+tb(['م','البند / الموضوع','القرار','المسؤول عن التنفيذ','موعد التنفيذ'],tableRows(d.decisions).map(function(r,i){return [i+1].concat(r.map(esc));}),w)+
    (d.notes?sec('ملاحظات')+'<p>'+para(d.notes)+'</p>':'')+sigs([['مقرر الاجتماع',d.clerk],['رئيس الاجتماع',d.chair],['مدير المدرسة','']],w);}},
 {id:'activity',icon:'🎯',name:'تقرير نشاط / فعالية',desc:'تقرير منفّذ عن نشاط أو مسابقة أو فعالية، مع حتى 4 صور.',
  fields:[['name','اسم النشاط','text',''],['field','المجال','text','علمي'],['date','تاريخ التنفيذ','text',today()],['place','المكان','text',''],['team','المنفذون','text',(me&&me.name)||''],['target','الفئة المستهدفة وعددها','text',''],
   ['goals','الأهداف (كل هدف في سطر)','textarea',''],['steps','وصف التنفيذ','textarea',''],['results','النتائج والأثر','textarea',''],['recs','التوصيات','textarea',''],['photos','صور النشاط','photos',4]],
  render:function(d,w){var ph=(d.photos||[]).filter(Boolean);
    return head('تقرير نشاط: '+(d.name||''),'',w)+kv([['اسم النشاط','<b>'+esc(d.name)+'</b>'],['المجال',esc(d.field)],['تاريخ التنفيذ',esc(d.date)],['المكان',esc(d.place)],['المنفذون',esc(d.team)],['الفئة المستهدفة',esc(d.target)]],w)+
    sec('الأهداف')+'<ol>'+lines(d.goals).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ol>'+sec('وصف التنفيذ')+'<p>'+para(d.steps)+'</p>'+sec('النتائج والأثر')+'<p>'+para(d.results)+'</p>'+(d.recs?sec('التوصيات')+'<p>'+para(d.recs)+'</p>':'')+
    (ph.length?sec('صور من النشاط')+'<table style="width:100%;border-collapse:collapse;page-break-inside:avoid"><tr>'+ph.map(function(src,i){return (i&&i%2===0?'</tr><tr>':'')+'<td style="width:50%;padding:4px;text-align:center"><img src="'+src+'" style="max-width:100%;max-height:'+(w?'200px':'62mm')+';border:1px solid #ccc;border-radius:6px"'+(w?' width="300"':'')+'></td>';}).join('')+'</tr></table>':'')+
    sigs([['منفذ النشاط',d.team],['مدير المدرسة','']],w);}},
 {id:'visit',icon:'👁',name:'تقرير زيارة تبادلية',desc:'زيارة صفية بين المعلمين: بيانات الحصة، الجوانب الإيجابية، المقترحات.',
  fields:[['visitor','المعلم الزائر','text',(me&&me.name)||''],['visited','المعلم المزور','text',''],['subject','المادة','text',''],['grade','الصف / الشعبة','text',''],['lesson','عنوان الدرس','text',''],['date','التاريخ','text',today()],['period','الحصة','text',''],
   ['strats','الاستراتيجيات والوسائل المستخدمة','textarea',''],['pos','الجوانب الإيجابية','textarea',''],['dev','جوانب تحتاج إلى تطوير / مقترحات','textarea',''],['gain','ما استفاده الزائر','textarea','']],
  render:function(d,w){return head('تقرير زيارة صفية تبادلية','',w)+kv([['المعلم الزائر',esc(d.visitor)],['المعلم المزور',esc(d.visited)],['المادة',esc(d.subject)],['الصف / الشعبة',esc(d.grade)],['عنوان الدرس',esc(d.lesson)],['التاريخ والحصة',esc(d.date)+(d.period?' — الحصة '+esc(d.period):'')]],w)+
    sec('الاستراتيجيات والوسائل المستخدمة')+'<p>'+para(d.strats)+'</p>'+sec('الجوانب الإيجابية')+'<p>'+para(d.pos)+'</p>'+sec('جوانب تحتاج إلى تطوير ومقترحات')+'<p>'+para(d.dev)+'</p>'+(d.gain?sec('ما استفاده المعلم الزائر')+'<p>'+para(d.gain)+'</p>':'')+
    sigs([['المعلم الزائر',d.visitor],['المعلم المزور',d.visited],['المعلم الأول','']],w);}},
 {id:'parent',icon:'✉️',name:'إشعار ولي أمر',desc:'إشعار بمستوى الطالب أو دعوة لزيارة المدرسة، لطالب أو أكثر.',
  fields:[['students','أسماء الطلاب (كل اسم في سطر — يُطبع إشعار لكل طالب)','textarea',''],['grade','الصف / الشعبة','text',''],['subject','المادة','text',''],['kind','نوع الإشعار','select',['إشعار بمستوى الطالب','دعوة لزيارة المدرسة','إشعار تفوق وشكر','إشعار بتأخر في الواجبات']],
   ['body','نص الإشعار','textarea','نود إحاطتكم علمًا بأن مستوى ابنكم في مادة … يحتاج إلى متابعة، ونأمل تعاونكم معنا في …'],['date','التاريخ','text',today()],['teacher','معلم المادة','text',(me&&me.name)||'']],
  render:function(d,w){var ns=lines(d.students);if(!ns.length)ns=[''];
    return ns.map(function(n,i){return (i?(w?'<br clear="all" style="page-break-before:always">':'<div style="page-break-before:always;break-before:page"></div>'):'')+head(d.kind||'إشعار ولي أمر','',w)+
      '<p style="font-size:'+(w?'13pt':'1.05em')+';line-height:2">المكرم ولي أمر الطالب/ <b>'+esc(n||'........................')+'</b> &nbsp; الصف: '+esc(d.grade||'........')+' &nbsp; المحترم<br>السلام عليكم ورحمة الله وبركاته، وبعد:</p>'+
      '<p style="font-size:'+(w?'13pt':'1.05em')+';line-height:2;text-indent:2em">'+para(d.body)+'</p><p style="font-size:'+(w?'13pt':'1.05em')+'">شاكرين لكم حسن تعاونكم.</p><p style="text-align:left">التاريخ: '+esc(d.date)+'</p>'+
      sigs([['معلم المادة',d.teacher],['مدير المدرسة','']],w)+
      '<div style="border-top:1px dashed #777;margin-top:26px;padding-top:8px;font-size:'+(w?'11pt':'.9em')+'">✂ <b>إفادة ولي الأمر:</b> اطّلعت على الإشعار الخاص بالطالب/ '+esc(n)+' ........................................................ &nbsp; التوقيع: ............ &nbsp; التاريخ: ............</div>';}).join('');}},
 {id:'tracker',icon:'📋',name:'سجل متابعة الطلبة',desc:'كشف فارغ للطباعة بأسماء طلابك ومعايير المتابعة (الواجب، الكتاب، المشاركة…).',
  fields:[['grade','الصف / الشعبة','text',''],['subject','المادة','text',''],['students','أسماء الطلاب (كل اسم في سطر)','textarea',''],['crit','معايير المتابعة (كل معيار في سطر)','textarea','الواجب\nالكتاب والدفتر\nالمشاركة\nالسلوك'],['weeks','عدد الأسابيع / المرات','text','4']],
  render:function(d,w){var ns=lines(d.students),cr=lines(d.crit),wk=Math.max(1,Math.min(10,+d.weeks||4)),fs=w?'9pt':(cr.length*wk>16?'.62em':'.75em');
    var CC='border:1px solid #555;padding:2px 3px;text-align:center;height:'+(w?'16pt':'20px');
    return head('سجل متابعة الطلبة — '+(d.subject||''),'الصف: '+(d.grade||'')+' · الفصل الدراسي: '+schoolHdr().term+' - العام الدراسي: '+schoolHdr().year+'م',w)+
      '<table style="width:100%;border-collapse:collapse;font-size:'+fs+'"><thead><tr><th style="'+CH+'" rowspan="2">م</th><th style="'+CH+'" rowspan="2">اسم الطالب</th>'+cr.map(function(c){return '<th style="'+CH+'" colspan="'+wk+'">'+esc(c)+'</th>';}).join('')+'</tr><tr>'+cr.map(function(){var h='';for(var i=1;i<=wk;i++)h+='<th style="'+CH+'">'+i+'</th>';return h;}).join('')+'</tr></thead><tbody>'+
      (ns.length?ns:Array(25).join('.').split('.')).map(function(n,i){var h='<tr><td style="'+CC+'">'+(i+1)+'</td><td style="'+CC+';text-align:right;white-space:nowrap;min-width:110px">'+esc(n)+'</td>';cr.forEach(function(){for(var k=0;k<wk;k++)h+='<td style="'+CC+'"></td>';});return h+'</tr>';}).join('')+'</tbody></table>'+
      '<p style="font-size:.8em;color:#555">الرموز المقترحة: ✓ منجز · ✗ غير منجز · ½ منجز جزئيًا</p>';}},
 {id:'cert',icon:'🏅',name:'شهادات شكر وتقدير',desc:'شهادة بالعرض لكل اسم — اكتب الأسماء مرة واحدة فتُطبع شهادة لكل طالب أو زميل.',
  fields:[['names','الأسماء (كل اسم في سطر)','textarea',''],['title','عنوان الشهادة','select',['شهادة شكر وتقدير','شهادة تفوق','شهادة مشاركة','شهادة تميّز']],['reason','نص التكريم','textarea','وذلك لتفوقه وتميزه في مادة … خلال الفصل الدراسي الأول، متمنين له دوام التوفيق والنجاح.'],
   ['date','التاريخ','text',today()],['sig1','التوقيع الأول (المسمى والاسم)','text','معلم المادة: '+((me&&me.name)||'')],['sig2','التوقيع الثاني','text','مدير المدرسة: ']],
  landscape:true,
  render:function(d,w){var ns=lines(d.names);if(!ns.length)ns=[''];var H=schoolHdr(),org=location.origin;
    return '<span class="ohead" hidden></span>'+ns.map(function(n,i){return (i?(w?'<br clear="all" style="page-break-before:always">':'<div style="page-break-before:always;break-before:page"></div>'):'')+
      '<div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;border:6px double #c98a1e;outline:2px solid #1f8a70;outline-offset:-14px;padding:22px 34px;min-height:'+(w?'auto':'170mm')+';box-sizing:border-box;text-align:center;position:relative;background:#fffdf7">'+
      '<table style="width:100%;border-collapse:collapse"><tr><td style="text-align:right;width:30%;font-size:.8em;line-height:1.5"><img src="'+org+'/brand/moe.png" style="height:'+(w?'60px':'18mm')+'"'+(w?' height="60"':'')+'><br>'+esc(H.dir)+'<br>'+esc(H.school)+'</td><td></td><td style="text-align:left;width:30%"><img src="'+org+'/brand/vision.png" style="height:'+(w?'58px':'17mm')+'"'+(w?' height="58"':'')+'></td></tr></table>'+
      '<div style="font-size:'+(w?'30pt':'2.4em')+';font-weight:800;color:#0b3b33;margin:6px 0 4px">'+esc(d.title||'شهادة شكر وتقدير')+'</div>'+
      '<div style="font-size:'+(w?'14pt':'1.15em')+';margin:10px 0">تتقدم إدارة '+esc(H.school.replace(/\s*\(.*\)$/,''))+' بخالص الشكر والتقدير إلى</div>'+
      '<div style="font-size:'+(w?'26pt':'2.1em')+';font-weight:800;color:#c98a1e;margin:8px 0;border-bottom:2px dotted #c98a1e;display:inline-block;padding:0 30px 4px">'+esc(n||'........................')+'</div>'+
      '<div style="font-size:'+(w?'14pt':'1.15em')+';line-height:2;margin:12px 40px">'+para(d.reason)+'</div>'+
      '<table style="width:100%;border-collapse:collapse;margin-top:26px;font-size:'+(w?'12pt':'1em')+'"><tr><td style="text-align:center;width:33%"><b>'+esc(d.sig1||'')+'</b><br><span style="color:#777">التوقيع: ............</span></td><td style="text-align:center">التاريخ: '+esc(d.date)+'</td><td style="text-align:center;width:33%"><b>'+esc(d.sig2||'')+'</b><br><span style="color:#777">التوقيع: ............</span></td></tr></table></div>';}).join('');}},
 {id:'portfolio',icon:'📁',name:'ملف الإنجاز (الغلاف والفهرس)',desc:'غلاف ملف إنجاز المعلم وفهرس أقسامه.',
  fields:[['teacher','اسم المعلم','text',(me&&me.name)||''],['job','الوظيفة','text','معلم'],['subject','المادة','text',''],['sections','أقسام الملف (كل قسم في سطر)','textarea','البيانات الشخصية والسيرة الذاتية\nالخطة الفصلية وتوزيع المنهج\nنماذج من التحضير\nالاختبارات القصيرة وتحليل نتائجها\nالخطط العلاجية والإثرائية\nسجل الطلبة ذوي صعوبات التعلم\nالبحوث الإجرائية\nالزيارات الصفية والتبادلية\nالأنشطة والمسابقات\nالدورات وشهادات الشكر']],
  render:function(d,w){var H=schoolHdr(),org=location.origin;
    return '<div style="text-align:center;padding-top:'+(w?'20pt':'18mm')+'"><img src="'+org+'/brand/moe.png" style="height:'+(w?'90px':'28mm')+'"'+(w?' height="90"':'')+'><div style="margin:6px 0 30px">سلطنة عُمان<br>'+esc(H.dir)+'<br>'+esc(H.school)+'</div>'+
      '<div style="font-size:'+(w?'34pt':'2.8em')+';font-weight:800;color:#0b3b33;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:3px solid #1f8a70;border-radius:18px;display:inline-block;padding:10px 40px">ملف الإنجاز</div>'+
      '<div style="font-size:'+(w?'18pt':'1.5em')+';margin-top:40px;line-height:2.2"><b>'+esc(d.job||'المعلم')+':</b> '+esc(d.teacher)+'<br><b>المادة:</b> '+esc(d.subject)+'<br><b>العام الدراسي:</b> '+esc(H.year)+'م</div><img src="'+org+'/brand/vision.png" style="height:'+(w?'80px':'24mm')+';margin-top:40px"'+(w?' height="80"':'')+'></div>'+
      (w?'<br clear="all" style="page-break-before:always">':'<div style="page-break-before:always;break-before:page"></div>')+head('فهرس ملف الإنجاز','',w)+tb(['م','القسم','الصفحة'],lines(d.sections).map(function(s,i){return [i+1,esc(s),''];}),w);}}
];

// ---------- الواجهة ----------
function renderHome(){
  var h='<div class="an-head"><h2>🗂 النماذج الإدارية</h2><p class="muted">املأ النموذج واطبعه بالترويسة الرسمية أو حمّله Word. كل ما تكتبه يُحفظ في حسابك وتفتحه من أي جهاز.</p></div>'+
    '<div class="fm-grid">'+TPL.map(function(t){return '<button type="button" class="fm-card" data-t="'+t.id+'"><span class="fm-ic">'+t.icon+'</span><b>'+esc(t.name)+'</b><small>'+esc(t.desc)+'</small></button>';}).join('')+'</div>'+
    '<h3 class="an-sub">نماذجي المحفوظة</h3>'+(saved.length?'<ul class="an-list">'+saved.map(function(q){return '<li><button type="button" class="link-btn" data-open="'+q.id+'"><b>'+esc(q.title)+'</b></button><span class="muted small">'+esc(fmtDate(q.updated_at))+'</span><button type="button" class="x" data-del="'+q.id+'" aria-label="حذف">×</button></li>';}).join('')+'</ul>':'<p class="muted">لا توجد نماذج محفوظة بعد.</p>');
  $('fmMain').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-t]'),function(b){b.onclick=function(){openTpl(b.getAttribute('data-t'),null,null);};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'),function(b){b.onclick=function(){api('/api/quizzes/'+b.getAttribute('data-open')).then(function(r){openTpl(r.quiz.data.tpl,r.quiz.data.data,r.quiz.id);},function(e){toast(e.message);});};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-del]'),function(b){b.onclick=function(){dialog({title:'حذف النموذج المحفوظ؟',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/quizzes/'+b.getAttribute('data-del'),null,'DELETE').then(load);});};});
}
function load(){return api('/api/quizzes?kind=form').then(function(r){saved=r.quizzes||[];renderHome();},function(e){$('fmMain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});}
function openTpl(tid,data,qid){
  T=TPL.filter(function(t){return t.id===tid;})[0];if(!T)return;
  id=qid;D=data||{};
  T.fields.forEach(function(f){if(D[f[0]]==null){D[f[0]]=f[2]==='table'?[['','','',''],['','','',''],['','','','']]:f[2]==='photos'?[]:f[2]==='select'?f[3][0]:(f[3]||'');}});
  dirty=!qid;renderForm();
}
function field(f){
  var k=f[0],v=D[k];
  if(f[2]==='textarea')return '<label class="rsf wide">'+esc(f[1])+'<textarea class="an-in" data-k="'+k+'" rows="'+(k==='students'||k==='names'||k==='present'?6:3)+'">'+esc(v||'')+'</textarea></label>';
  if(f[2]==='select')return '<label class="rsf">'+esc(f[1])+'<select class="an-in" data-k="'+k+'">'+f[3].map(function(o){return '<option'+(o===v?' selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select></label>';
  if(f[2]==='table')return '<div class="rsf wide">'+esc(f[1])+'<table class="an-t"><thead><tr>'+f[3].map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'<th></th></tr></thead><tbody>'+v.map(function(r,i){return '<tr>'+f[3].map(function(c,j){return '<td><input class="an-in" style="width:100%" data-tk="'+k+'" data-r="'+i+'" data-c="'+j+'" value="'+esc(r[j]||'')+'"></td>';}).join('')+'<td><button type="button" class="x" data-trm="'+k+'" data-r="'+i+'">×</button></td></tr>';}).join('')+'</tbody></table><button type="button" class="btn small" data-tadd="'+k+'">+ صف</button></div>';
  if(f[2]==='photos')return '<div class="rsf wide">'+esc(f[1])+' (حتى '+f[3]+')<div class="fm-ph">'+v.map(function(src,i){return '<span><img src="'+src+'" alt=""><button type="button" class="x" data-prm="'+i+'">×</button></span>';}).join('')+(v.length<f[3]?'<label class="btn small">📷 إضافة صورة<input type="file" accept="image/*" multiple hidden data-ph="'+k+'"></label>':'')+'</div></div>';
  return '<label class="rsf">'+esc(f[1])+'<input class="an-in" data-k="'+k+'" value="'+esc(v||'')+'"></label>';
}
function renderForm(){
  var h='<div class="an-bar no-print"><button type="button" class="btn small" id="fmBack">→ النماذج</button><b>'+T.icon+' '+esc(T.name)+'</b><span class="muted small" id="fmStatus"></span>'+
    '<span class="an-acts"><button type="button" class="btn primary" id="fmPrint">🖨 طباعة / PDF</button><button type="button" class="btn" id="fmWord">⬇ Word</button><button type="button" class="btn" id="fmSave">حفظ</button></span></div>'+
    '<section class="qcard"><div class="rsf-grid">'+T.fields.map(field).join('')+'</div></section>'+
    '<section class="qcard"><h3>المعاينة</h3><div class="paper fm-prev" id="fmPrev"></div></section>';
  $('fmMain').innerHTML=h;status();prev();bind();window.scrollTo(0,0);
}
var prevT=null;function prev(){clearTimeout(prevT);prevT=setTimeout(function(){var el=$('fmPrev');if(el)el.innerHTML=T.render(D,false);},150);}
function status(){var el=$('fmStatus');if(el)el.textContent=dirty?'لم يُحفظ بعد':(id?'محفوظ في حسابك ✓':'');}
function touch(){dirty=true;status();prev();}
function titleOf(){var n=D.title||D.name||D.lesson||D.kind||D.teacher||'';return T.name+(n&&n!==T.name?' — '+String(n).slice(0,60):'')+(D.date?' ('+D.date+')':'');}
function save(){return api('/api/quizzes',{id:id,title:titleOf(),grade:D.grade||'',subject:D.subject||'',kind:'form',data:{tpl:T.id,data:D}}).then(function(r){id=r.id;dirty=false;status();toast('حُفظ في حسابك');},function(e){toast(e.message);});}
function bind(){
  $('fmBack').onclick=function(){T=null;load();};
  $('fmSave').onclick=save;$('fmPrint').onclick=printIt;$('fmWord').onclick=wordIt;
  var q=function(s){return document.querySelectorAll(s);};
  Array.prototype.forEach.call(q('[data-k]'),function(el){var f=function(){D[el.getAttribute('data-k')]=el.value;touch();};el.oninput=f;el.onchange=f;});
  Array.prototype.forEach.call(q('[data-tk]'),function(el){el.oninput=function(){D[el.getAttribute('data-tk')][+el.getAttribute('data-r')][+el.getAttribute('data-c')]=el.value;touch();};});
  Array.prototype.forEach.call(q('[data-tadd]'),function(b){b.onclick=function(){var k=b.getAttribute('data-tadd');D[k].push(['','','','']);touch();renderForm();};});
  Array.prototype.forEach.call(q('[data-trm]'),function(b){b.onclick=function(){D[b.getAttribute('data-trm')].splice(+b.getAttribute('data-r'),1);touch();renderForm();};});
  Array.prototype.forEach.call(q('[data-prm]'),function(b){b.onclick=function(){D.photos.splice(+b.getAttribute('data-prm'),1);touch();renderForm();};});
  Array.prototype.forEach.call(q('[data-ph]'),function(inp){inp.onchange=function(){
    var k=inp.getAttribute('data-ph'),max=4,files=[].slice.call(inp.files||[]).slice(0,max-D[k].length);
    Promise.all(files.map(shrink)).then(function(urls){D[k]=D[k].concat(urls.filter(Boolean));touch();renderForm();});
  };});
}
// تصغير الصورة (أقصى بُعد 900px، JPEG) حتى يبقى النموذج خفيفًا عند الحفظ
function shrink(file){return new Promise(function(res){var fr=new FileReader();fr.onload=function(){var im=new Image();im.onload=function(){var s=Math.min(1,900/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',0.72));};im.onerror=function(){res(null);};im.src=fr.result;};fr.onerror=function(){res(null);};fr.readAsDataURL(file);});}
var MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function pageCss(){return T.landscape?'<style>@page{size:A4 landscape;margin:0}</style>':'';}
function printIt(){
  track('form_print',T.id,titleOf());
  var html=pageCss()+T.render(D,false);
  if(!IN_APP&&!MOBILE){$('printArea').innerHTML='<div class="ppage">'+html+'</div>';doPrint(titleOf());return;}
  var w=null;if(!IN_APP){try{w=window.open('','_blank');}catch(e){w=null;}}
  api('/api/export',{format:'print',name:titleOf(),html:'<div class="pg">'+html+'</div>'}).then(function(r){if(w){try{w.location.href=r.url;return;}catch(e){}}location.href=r.url;},function(e){if(w)try{w.close();}catch(x){}toast(e.message);});
}
function wordIt(){
  track('form_word',T.id,titleOf());toast('جارٍ التجهيز…');
  var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(titleOf())+'</title>'+
    '<style>@page WordSection1{size:'+(T.landscape?'841.9pt 595.3pt;mso-page-orientation:landscape':'595.3pt 841.9pt')+';margin:30pt}div.WordSection1{page:WordSection1}body{font-family:"Simplified Arabic",Arial;font-size:12pt;direction:rtl}table{direction:rtl}</style></head><body dir="rtl" lang="AR-OM"><div class="WordSection1" dir="rtl">'+T.render(D,true)+'</div></body></html>';
  api('/api/export',{format:'doc',name:titleOf(),html:html}).then(function(r){var a=document.createElement('a');a.href=r.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);},function(e){toast(e.message);});
}
api('/api/me').then(function(m){me=m;initNav(m);
  // القيم الافتراضية التي تعتمد على اسم المعلم
  TPL.forEach(function(t){t.fields.forEach(function(f){if(f[2]==='text'&&/^(visitor|team|teacher)$/.test(f[0])&&!f[3])f[3]=m.name||'';if(f[0]==='sig1')f[3]='معلم المادة: '+(m.name||'');});});
  load();},function(e){$('fmMain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
