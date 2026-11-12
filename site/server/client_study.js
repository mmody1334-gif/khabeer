(function(){
'use strict';
// صفحتا «الخطط العلاجية» و«ملخصات الدروس» — نفس الكود، ويحدد PAGE_KIND أيهما
var KIND=window.PAGE_KIND||'remedial',REM=KIND==='remedial';
var GRADE_NUM={'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
var DEF_HDR={dir:'',school:'',year:'2027/2026',term:'الأول',teacher:''};
var WEAK_AR=['الرسم العلمي','المفاهيم العلمية','مهارات حسابية','مهارات القراءة والكتابة الأساسية','كتابة الرموز والصيغ','تحليل الأشكال البيانية والمخططات العلمية','تحليل وتفسير الجداول العلمية','تطبيق القوانين','التفسير العلمي','مهارات التطبيق العملي'];
var WEAK_IT=['المفاهيم والمصطلحات التقنية','المهارات العملية على الحاسوب','اتباع الخطوات والإجراءات','التفكير المنطقي وحل المشكلات','البرمجة وكتابة الشفرات','تنظيم البيانات وتحليلها','الأمن الرقمي والمواطنة الرقمية','مهارات القراءة والكتابة الأساسية'];
// اللغة العربية: مجالات تعثر لغوية بدل المجالات العلمية
var WEAK_LANG=['الفهم والاستيعاب','الثروة اللغوية (المفردات ومعانيها)','القراءة الجهرية والطلاقة','القواعد النحوية والصرفية','الإملاء وعلامات الترقيم','التعبير الكتابي','التذوق الأدبي والبلاغي','الخط','الاستماع والتحدث'];
var WEAK_EN=['Reading comprehension','Vocabulary','Grammar','Writing','Listening','Speaking','Spelling & punctuation'];
var T_ACTS=[['إعادة شرح المفاهيم الأساسية بأسلوب مبسط وأمثلة من الحياة',1],['أوراق عمل علاجية متدرجة من السهل إلى الأصعب',1],['التعلم بالأقران (طالب متمكن مع طالب متعثر)',1],['تعليم فردي قصير داخل الحصة',0],['استخدام الوسائل والنماذج والصور والمخططات',1],['تقسيم المهمة إلى خطوات قصيرة ومتابعة كل خطوة',0],['تكليفات منزلية قصيرة ومتابعتها وتصحيحها',0],['اختبارات تشخيصية قصيرة لقياس التقدم',0],['التعزيز والتحفيز المستمر',1],['حصص تقوية / مراجعة',0]];
var S_ACTS=[['التواصل مع ولي الأمر وإطلاعه على الخطة',1],['متابعة الأخصائي الاجتماعي / النفسي',0],['متابعة المعلم الأول للمادة',1],['توفير حصص تقوية ضمن جدول المدرسة',0],['تكريم الطلاب المتحسنين',0]];
var me=null,courses=[],course=null,data=null,byId={},sel={},sumMode='lesson',unitSel='',doc=null,dirty=false,part='',hdr=null,rows=5,gsize=5,gper=1,gnames='';
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function track(type,detail,title){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,grade:course&&course.grade,detail:detail||'',title:title||''})});}catch(e){}}
function gnum(g){return GRADE_NUM[g]||99;}
function isEnC(c){return /انجليز|إنجليز|English/i.test((c||course||{}).subject||'');}
function clone(o){return JSON.parse(JSON.stringify(o));}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function hdrKey(){return 'tahdir_quiz_hdr_'+(me?me.username:'');}
function unitsList(){
  var m={},order=[];data.lessons.forEach(function(l){var k=String(l.unit);if(!m[k]){m[k]={unit:k,name:l.unit_name||'',lessons:[]};order.push(k);}m[k].lessons.push(l);});
  return order.sort(function(a,b){return parseInt(a,10)-parseInt(b,10);}).map(function(k){return m[k];});
}
// ---------- مكوّنات الورقة (أنماط مضمّنة لتعمل في الطباعة وWord) ----------
var TB='border-collapse:collapse;width:100%;margin:4px 0 10px',TD='border:1px solid #000;padding:4px 7px;vertical-align:top',TH=TD+';background:#e6e6e6;font-weight:bold;text-align:center';
function cb(on){return '<span class="cb" contenteditable="false" style="font-family:\'Segoe UI Symbol\',\'DejaVu Sans\',sans-serif;cursor:pointer">'+(on?'☑':'☐')+'</span>';}
function H(t,en){return '<h3 style="font-size:1.05em;margin:12px 0 4px;padding:2px 8px;background:#eef3f1;border-inline-start:4px solid #0e7c66">'+t+'</h3>';}
function sheetHead(title,en,student){
  var h=hdr;
  return OFFICIAL_HEAD({dir:h.dir,school:h.school,title:title,line2:'الفصل الدراسي: '+h.term+' - العام الدراسي: '+h.year+'م',en:en,
    student:student?(en?'Name: ........................................ &nbsp; Class: ..........':true):false});
}
function wrap(html,en){return '<div dir="'+(en?'ltr':'rtl')+'" style="text-align:'+(en?'left':'right')+'">'+html+'</div>';}
function lessonsSel(){var ids=Object.keys(sel).map(Number);return data.lessons.filter(function(l){return ids.indexOf(l.id)>=0;});}
function st(l){return data.study[l.id]||null;}
function fallbackSummary(l){ // درس مضاف بلا ملخص جاهز: نبني هيكلًا من مخرجاته
  var o=String(l.outcomes||'').split('\n').map(function(x){return x.trim();}).filter(Boolean);
  return {intro:'',outcomes:(o.length?o:['…']).map(function(t){return {code:'',text:t,points:['…']};}),terms:String(l.concepts||'').split(/[،,]/).map(function(x){return x.trim();}).filter(Boolean).slice(0,6).map(function(t){return {t:t,d:'…'};}),remember:[]};
}
// ---------- الأنشطة الصفية: أسئلة أعلى مستوى (تطبيق واستدلال) لكل درس ----------
function classHtml(ls,key){
  var en=isEnC(),AR='أبجد'.split('');
  var title=en?(key?'Answer key – ':'')+'Class activities (challenge) – Grade 9':(key?'إجابات ':'')+'الأنشطة الصفية (أسئلة متوسطة وأسئلة تحدٍّ) في مادة '+course.subject+' للصف '+course.grade;
  var h=sheetHead(title,en,!key),n=0,any=false,hard=(data&&data.hard)||{};
  if(!key)h+='<p style="margin:2px 0 8px;font-size:.95em">'+(en?'Work in pairs or groups. Show your reasoning.':'تُنفَّذ داخل الصف فرديًا أو في مجموعات. وضّح خطوات تفكيرك وحلّك.')+'</p>';
  ls.forEach(function(l){var it=hard[l.id];if(!it||!it.length)return;any=true;
    h+='<h3 style="font-size:1.08em;margin:14px 0 4px;border-bottom:1.5px solid #000">'+(en?'Lesson: ':'الدرس: ')+esc(l.title)+'</h3>';
    it.forEach(function(q){n++;
      var lab=(q.mid?(en?'Medium':'متوسط')+' · ':(en?'Challenge':'تحدٍّ')+' · ')+((q.ao==='استدلال'||q.ao==='AO2')?(en?'Reasoning':'استدلال'):(q.ao==='تطبيق'?(en?'Application':'تطبيق'):(en?'Knowledge':'معرفة')));
      h+='<div style="margin:8px 0 10px;page-break-inside:avoid"><b>'+(en?'Q':'س')+n+'.</b> <span style="font-size:.8em;border:1px solid #888;border-radius:8px;padding:0 6px">'+lab+' · '+q.marks+(en?' mark(s)':' درجة')+'</span><div style="margin-top:3px">'+esc(q.stem).replace(/\n/g,'<br>')+'</div>';
      if(q.img)h+='<img src="'+location.origin+'/fin/'+esc(q.img)+'" alt="" style="display:block;max-width:100%;margin:6px auto">';
      if(q.type==='mcq'&&q.choices&&q.choices.length)h+='<div style="margin:4px 0">'+q.choices.map(function(c,i){return '<span style="display:inline-block;min-width:45%;margin:2px 0">'+(en?String.fromCharCode(65+i):AR[i])+') '+esc(c)+'</span>';}).join('')+'</div>';
      if(key)h+='<div style="border:1px solid #0e7c66;background:#f1f8f5;border-radius:6px;padding:5px 9px;margin-top:4px"><b>'+(en?'Answer: ':'الإجابة: ')+'</b>'+esc(q.type==='mcq'&&q.choices&&q.choices[q.correct]!=null?q.choices[q.correct]:q.answer).replace(/\n/g,'<br>')+(q.type==='mcq'||!q.answer||q.answer===q.choices[q.correct]?'':'')+'</div>';
      else if(q.type!=='mcq')h+='<div style="border-bottom:1px dotted #999;height:'+(Math.min(q.marks||1,5)*22+10)+'px"></div>';
      h+='</div>';
    });
  });
  if(!any)h+='<p>'+(en?'No challenge questions for these lessons yet.':'لا توجد أسئلة تحدٍّ جاهزة لهذه الدروس بعد.')+'</p>';
  return wrap(h,en);
}
// ---------- الخطة العلاجية ----------
function planHtml(ls){
  var en=isEnC(),weak=en?WEAK_EN:(/تقنية/.test(course.subject||'')?WEAK_IT:(/العربية/.test(course.subject||'')?WEAK_LANG:WEAK_AR)),on={};
  ls.forEach(function(l){var s=st(l);if(s)s.remedial.weak_areas.forEach(function(w){on[w]=1;});});
  var title='نموذج خطة علاجية للطالب دون المستوى في مادة/ '+course.subject+' للصف '+course.grade;
  var h=sheetHead(title,false,false);
  h+='<table style="'+TB+'"><tr><td style="'+TD+';width:50%"><b>معلم المادة:</b> '+esc(hdr.teacher||'..............................')+'</td><td style="'+TD+'"><b>الفترة الزمنية للخطة:</b> من ........... إلى ...........</td></tr>'+
    '<tr><td style="'+TD+'" colspan="2"><b>الدروس / المحتوى المستهدف:</b> '+ls.map(function(l){return esc(l.title);}).join('، ')+'</td></tr></table>';
  h+=H('أولًا: بيانات الطلاب دون المستوى');
  h+='<table id="stTbl" style="'+TB+'"><thead><tr><th style="'+TH+';width:5%">م</th><th style="'+TH+';width:24%">اسم الطالب</th><th style="'+TH+';width:9%">الشعبة</th><th style="'+TH+';width:11%">الدرجة / المستوى</th><th style="'+TH+'">جوانب الضعف</th><th style="'+TH+';width:25%">مدى التحسن</th></tr></thead><tbody>';
  for(var i=0;i<rows;i++)h+=stRow(i+1);
  h+='</tbody></table>';
  h+=H('ثانيًا: جوانب الضعف (مجالات التعثر)');
  h+='<table style="'+TB+'"><tr>'+weak.map(function(w,i){return (i&&i%2===0?'</tr><tr>':'')+'<td style="'+TD+';width:50%">'+cb(on[w])+' '+esc(w)+'</td>';}).join('')+(weak.length%2?'<td style="'+TD+'"></td>':'')+'</tr></table>';
  h+=H('ثالثًا: المهارات المستهدفة والأنشطة العلاجية');
  h+='<table style="'+TB+'"><thead><tr><th style="'+TH+';width:18%">الدرس</th><th style="'+TH+'">المهارة / المفهوم المستهدف</th><th style="'+TH+';width:26%">النشاط العلاجي</th><th style="'+TH+';width:14%">أداة التقويم</th><th style="'+TH+';width:10%">التاريخ</th><th style="'+TH+';width:8%">تحقق</th></tr></thead><tbody>';
  ls.forEach(function(l){var s=st(l),r=s?s.remedial:null;
    h+='<tr><td style="'+TD+'">'+esc(l.title)+'</td><td style="'+TD+'">'+esc(r?r.focus:'')+'</td><td style="'+TD+'">'+(r?r.activities.map(function(a,k){return (k+1)+'. '+esc(a.title);}).join('<br>'):'')+'</td><td style="'+TD+'">ورقة عمل علاجية<br>سؤال شفهي</td><td style="'+TD+'"></td><td style="'+TD+';text-align:center">'+cb(0)+'</td></tr>';});
  h+='</tbody></table>';
  h+=H('رابعًا: الإجراءات العلاجية من قِبل المعلم');
  h+='<table style="'+TB+'"><tr>'+T_ACTS.map(function(a,i){return (i&&i%2===0?'</tr><tr>':'')+'<td style="'+TD+';width:50%">'+cb(a[1])+' '+esc(a[0])+'</td>';}).join('')+'</tr></table>';
  h+=H('خامسًا: الإجراءات من قِبل المدرسة وولي الأمر');
  h+='<table style="'+TB+'"><tr>'+S_ACTS.map(function(a,i){return (i&&i%2===0?'</tr><tr>':'')+'<td style="'+TD+';width:50%">'+cb(a[1])+' '+esc(a[0])+'</td>';}).join('')+(S_ACTS.length%2?'<td style="'+TD+'"></td>':'')+'</tr></table>';
  h+=H('سادسًا: ملاحظات ونتائج تنفيذ الخطة');
  h+='<p>.................................................................................................................................................</p><p>.................................................................................................................................................</p>';
  h+='<table style="width:100%;border-collapse:collapse;margin-top:18px;text-align:center"><tr><td style="width:33%"><b>معلم المادة</b><br>'+esc(hdr.teacher||'.........................')+'<br>التوقيع: ..............</td><td style="width:33%"><b>المعلم الأول</b><br>.........................<br>التوقيع: ..............</td><td style="width:34%"><b>مدير المدرسة</b><br>.........................<br>التوقيع: ..............</td></tr></table>';
  return wrap(h,false);
}
function stRow(n){return '<tr><td style="'+TD+';text-align:center">'+n+'</td><td style="'+TD+'"></td><td style="'+TD+'"></td><td style="'+TD+'"></td><td style="'+TD+'"></td><td style="'+TD+';font-size:.85em">'+cb(0)+' تحسّن '+cb(0)+' جزئي '+cb(0)+' لم يتحسن</td></tr>';}
// ---------- ورقة الأنشطة العلاجية ونموذج إجابتها ----------
var LET_AR='أبجدهوزح',LET_EN='ABCDEFGH';
function itemsHtml(a,en,key){
  var L=en?LET_EN:LET_AR,dots='..........................................................';
  if(a.type==='match'){
    var mix=a._mix||(a._mix=shuffle(a.items.map(function(_,i){return i;})));
    if(key)return '<p>'+a.items.map(function(it,i){return (i+1)+' ← '+L[mix.indexOf(i)];}).join(' &nbsp; | &nbsp; ')+'</p>';
    return '<table style="'+TB+'"><tr><th style="'+TH+'">'+(en?'Column A':'العمود (أ)')+'</th><th style="'+TH+';width:12%">'+(en?'Letter':'الحرف')+'</th><th style="'+TH+'">'+(en?'Column B':'العمود (ب)')+'</th></tr>'+
      a.items.map(function(it,i){return '<tr><td style="'+TD+'">'+(i+1)+'. '+esc(it.q)+'</td><td style="'+TD+';text-align:center">( &nbsp; &nbsp; )</td><td style="'+TD+'">'+L[i]+') '+esc(a.items[mix[i]].a)+'</td></tr>';}).join('')+'</table>';
  }
  return '<ol style="margin:2px 0 8px;padding-inline-start:1.6em">'+a.items.map(function(it){
    if(key)return '<li>'+esc(it.a)+'</li>';
    var ln=(a.type==='short'||a.type==='order'||a.type==='label')?'<br>'+dots:(a.type==='draw'?'<br>'+dots:'');
    return '<li style="margin-bottom:4px">'+esc(it.q)+ln+'</li>';}).join('')+'</ol>'+(a.type==='draw'&&!key?'<div style="border:1px dashed #777;height:150px;margin:4px 0 10px"></div>':'');
}
function sheetHtml(ls,key){
  var en=isEnC();
  var title=en?(key?'Answer key – ':'')+'Remedial activities – English – Grade 9':(key?'نموذج إجابة ':'')+'أنشطة علاجية في مادة '+course.subject+' للصف '+course.grade;
  var h=sheetHead(title,en,!key);
  ls.forEach(function(l,li){var s=st(l);if(!s)return;var r=s.remedial;
    h+='<h3 style="font-size:1.08em;margin:14px 0 4px;border-bottom:1.5px solid #000">'+(en?'Lesson: ':'الدرس: ')+esc(l.title)+'</h3>';
    if(!key)h+='<div style="border:1px solid #0e7c66;background:#f1f8f5;border-radius:6px;padding:6px 10px;margin:4px 0 8px"><b>'+(en?'In simple words: ':'الفكرة ببساطة: ')+'</b>'+esc(r.simple).replace(/\n/g,'<br>')+'</div>';
    r.activities.forEach(function(a,k){
      h+='<p style="margin:8px 0 2px"><b>'+(en?'Activity ':'النشاط ')+(k+1)+': '+esc(a.title)+'</b>'+(key?'':'<br><span style="font-size:.92em">'+esc(a.instructions)+'</span>')+'</p>'+itemsHtml(a,en,key);
    });
  });
  return wrap(h,en);
}
// ---------- الملخصات ----------
function lessonSum(l,en,brief){
  var s=st(l),S=s?s.summary:fallbackSummary(l),h='';
  h+='<h3 style="font-size:1.12em;margin:14px 0 4px;border-bottom:1.5px solid #0e7c66;color:#07493b">'+(en?'Lesson: ':'الدرس: ')+esc(l.title)+'</h3>';
  if(S.intro)h+='<div style="background:#f1f8f5;border:1px solid #bcd9cf;border-radius:6px;padding:6px 10px;margin:4px 0 8px">'+esc(S.intro)+'</div>';
  h+='<p style="margin:6px 0 2px"><b>'+(en?'Learning outcomes and key points':'مخرجات التعلم وأهم النقاط')+'</b></p>';
  S.outcomes.forEach(function(o){
    h+='<div style="margin:4px 0 6px"><div style="font-weight:bold">'+(o.code?'<span style="background:#e6e6e6;padding:0 6px;border-radius:4px;font-size:.85em" dir="ltr">'+esc(o.code)+'</span> ':'')+esc(o.text)+'</div>'+
      '<ul style="margin:2px 0;padding-inline-start:1.5em">'+(brief?o.points.slice(0,2):o.points).map(function(p){return '<li>'+esc(p)+'</li>';}).join('')+'</ul></div>';
  });
  if(!brief&&S.terms&&S.terms.length)h+='<p style="margin:8px 0 2px"><b>'+(en?'Key words':'المصطلحات العلمية')+'</b></p><table style="'+TB+'">'+S.terms.map(function(t){return '<tr><td style="'+TD+';width:28%;font-weight:bold">'+esc(t.t)+'</td><td style="'+TD+'">'+esc(t.d)+'</td></tr>';}).join('')+'</table>';
  if(!brief&&S.remember&&S.remember.length)h+='<div style="border:1.5px dashed #b45309;background:#fff8ec;border-radius:6px;padding:6px 10px;margin:6px 0"><b>'+(en?'Remember!':'تذكّر 💡')+'</b><ul style="margin:2px 0;padding-inline-start:1.5em">'+S.remember.map(function(p){return '<li>'+esc(p)+'</li>';}).join('')+'</ul></div>';
  return h;
}
function summaryHtml(){
  var en=isEnC(),h;
  if(sumMode==='unit'){
    var u=unitsList().filter(function(x){return x.unit===unitSel;})[0];if(!u)return '';
    var U=data.units[u.unit]||{title:u.name,big_ideas:[],connections:'',check:[]};
    h=sheetHead(en?'Unit '+u.unit+' summary: '+(U.title||u.name||''):'ملخص الوحدة '+u.unit+(u.name?': '+u.name:'')+' — '+course.subject+' للصف '+course.grade,en,false);
    if(U.big_ideas.length)h+=H(en?'Big ideas':'الأفكار الكبرى للوحدة')+'<ul style="padding-inline-start:1.5em">'+U.big_ideas.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>';
    if(U.connections)h+=H(en?'How the lessons connect':'كيف ترتبط دروس الوحدة؟')+'<p>'+esc(U.connections)+'</p>';
    h+=H(en?'Lesson summaries':'ملخص دروس الوحدة');
    u.lessons.forEach(function(l){h+=lessonSum(l,en,true);});
    if(U.check.length)h+=H(en?'Check yourself':'أسئلة مراجعة الوحدة')+'<ol style="padding-inline-start:1.6em">'+U.check.map(function(x){return '<li style="margin-bottom:4px">'+esc(x)+'<br>..........................................................</li>';}).join('')+'</ol>';
    return wrap(h,en);
  }
  var ls=lessonsSel();
  h=sheetHead(en?'Lesson summary – English – Grade 9':(ls.length>1?'ملخصات دروس ':'ملخص درس ')+course.subject+' للصف '+course.grade,en,false);
  ls.forEach(function(l){h+=lessonSum(l,en,false);});
  return wrap(h,en);
}
// ==== group activity ====
// ---------- النشاط الجماعي: أسئلة (سهل / متوسط / تحدٍّ خفيف) موزّعة على أعضاء المجموعة ----------
var GROLES=['قائد المجموعة','مقرِّر المجموعة (يكتب الإجابة)','المتحدّث الرسمي','ضابط الوقت','مراجع الإجابات','منسّق الأدوات والمواد'];
var GLVL={1:['سهل','#e3f4e8','#2e7d4f'],2:['متوسط','#fff3d6','#9a6b00'],3:['تحدٍّ','#fde3e3','#b3261e']};
var STARTW=('ما ماذا لماذا كيف أين متى كم هل أي أيهما أيها اذكر سم عرف فسر اكتب قارن صف اشرح احسب اقترح حدد استخدم علل توقع صنف قيم صمم لاحظ عد بين وضح استنتج ارسم أكمل أعط اختر رتب ميز عين حلل أوجد تنبأ قدر أجب سجل حول ضع طبق لخص ناقش استخلص أشر برهن مثل').split(' ');
function nAr(s){return String(s||'').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');}
var STARTSET={};STARTW.forEach(function(w){STARTSET[nAr(w)]=1;});
function isQ(line){ // يبدأ بأداة استفهام أو فعل أمر؟
  var s=String(line||'').replace(/^\s*(?:[\(\[]?[0-9\u0660-\u0669]+[\)\]\.\-:]|[\(\[]?[ابجدهوزحطي][\)\]\.\-:])\s*/,'').trim();
  var w=nAr(s.split(/\s+/)[0]||'').replace(/[:،,\.؟?]+$/,'');
  return !!STARTSET[w];
}
function qClean(t){ // يزيل ترقيم الامتحان الأصلي، ويرفض سؤالًا ناقصًا ينتهي بنقطتين وحده
  if(!t)return '';
  t=t.replace(/^\s*[\(\[]?[0-9\u0660-\u0669]+[\)\]\.\-:]\s*/,'');
  if(t.indexOf('\n')<0&&/[:：]\s*$/.test(t))return '';
  if(t.replace(/[_\s.…]+/g,' ').trim().length<14||(/_{3,}/.test(t)&&t.length<45))return ''; // سؤال ناقص أو مجرد فراغ
  return t;
}
function hasVis(q){return !!(q.img||(q.table&&q.table.rows&&q.table.rows.length));}
function qText(q){return qClean(qText0(q));}
function qText0(q){ // نص السؤال يبدأ بأداة استفهام/أمر؛ مع الشكل أو الجدول نقتطع من أول جملة سؤال
  var lines=String(q.stem||'').replace(/\*\*/g,'').split('\n').map(function(x){return x.trim();}).filter(function(x){return x&&x.charAt(0)!=='[';});
  if(!lines.length)return '';
  if(isQ(lines[0]))return lines.join('\n');
  if(!hasVis(q))return '';
  for(var i=0;i<lines.length;i++){if(isQ(lines[i]))return lines.slice(i).join('\n');}
  for(var a=0;a<lines.length;a++){var ss=lines[a].match(/[^.؟?!]+[.؟?!]?/g)||[];for(var j=1;j<ss.length;j++){if(isQ(ss[j]))return [ss.slice(j).join(' ').trim()].concat(lines.slice(a+1)).join('\n');}}
  return '';
}
function lvlOf(q){ // 1 سهل · 2 متوسط · 3 تحدٍّ خفيف · 0 مستبعد
  var m=q.marks||1,d=q.difficulty||'',ao=q.ao||'',know=(ao==='معرفة'||ao==='AO1'||ao==='تذكر وفهم');
  if(d==='منخفضة')return m<=2?1:2;
  if(d==='متوسطة')return m<=3?2:0;
  if(d==='مرتفعة')return m<=3?3:0;
  if(m===1)return know?1:2;
  if(m===2)return 2;
  if(m===3)return know?2:3;
  return 0;
}
function levelPlan(T){ // نسبة تقريبية 40% سهل · 40% متوسط · 20% تحدٍّ خفيف
  if(T<=1)return [1];if(T===2)return [1,3];if(T===3)return [1,2,3];
  var h=Math.max(1,Math.round(T*0.2)),e=Math.round(T*0.4),m=T-e-h,out=[],i;
  for(i=0;i<e;i++)out.push(1);for(i=0;i<m;i++)out.push(2);for(i=0;i<h;i++)out.push(3);return out;
}
function interleave(items){ // توزيع عادل على الدروس المختارة
  var by={},ids=[];items.forEach(function(q){if(!by[q.lesson_id]){by[q.lesson_id]=[];ids.push(q.lesson_id);}by[q.lesson_id].push(q);});
  var out=[],more=true;while(more){more=false;ids.forEach(function(id){if(by[id].length){out.push(by[id].shift());more=true;}});}
  return out;
}
function buildPools(items){
  var pools={1:[],2:[],3:[]},seen={};
  shuffle(items).forEach(function(q){
    if(q.type==='mcq'&&(!q.choices||!q.choices.length)&&!q.answer)return;
    var t=qText(q);if(!t||t.length>380)return;
    var lv=lvlOf(q);if(!lv)return;
    var k=nAr(t).replace(/\s+/g,'').slice(0,60);if(seen[k])return;seen[k]=1;
    var pri=Math.random()-(hasVis(q)?0.55:0)-(lv===3&&(q.marks||1)===2?0.15:0);
    pools[lv].push({q:q,t:t,lv:lv,pri:pri,lesson_id:q.lesson_id});
  });
  [1,2,3].forEach(function(l){pools[l]=interleave(pools[l].sort(function(a,b){return a.pri-b.pri;}));});
  return pools;
}
function takeQ(pools,lv,used){ // يأخذ سؤالًا بالمستوى المطلوب، وإن نقص يستعير من أقرب مستوى
  var order={1:[1,2],2:[2,1,3],3:[3,2]}[lv];
  for(var o=0;o<order.length;o++){var p=pools[order[o]];for(var i=0;i<p.length;i++){if(!used[p[i].q.qid||p[i].t]){var it=p.splice(i,1)[0];used[it.q.qid||it.t]=1;return {q:it.q,t:it.t,lv:lv};}}}
  return null;
}
function buildAssign(items,N,K){ // يعيد قائمة بأسئلة كل عضو
  var pools=buildPools(items),lvls=levelPlan(N*K),used={},members=[],j,i;
  for(j=0;j<N;j++)members.push([]);
  for(j=0;j<N;j++){
    if(K===1){var a=takeQ(pools,lvls[j],used);if(a)members[j].push(a);}
    else{ // متوازن: الأسهل مع الأصعب حتى يتقارب جهد الأعضاء
      for(i=0;i<K;i++){var idx=(i%2===0)?j+Math.floor(i/2)*N:lvls.length-1-j-Math.floor(i/2)*N;idx=Math.max(0,Math.min(lvls.length-1,idx));var b=takeQ(pools,lvls[idx],used);if(b)members[j].push(b);}
    }
  }
  members.forEach(function(m){m.sort(function(x,y){return x.lv-y.lv;});});
  return members;
}
function lvlBadge(lv){var g=GLVL[lv];return '<span style="font-size:.8em;border:1px solid '+g[2]+';color:'+g[2]+';background:'+g[1]+';border-radius:8px;padding:0 7px;font-weight:bold">'+g[0]+'</span>';}
function visHtml(q){
  var h='';
  if(q.table&&q.table.rows&&q.table.rows.length){
    h+='<table style="'+TB+';width:78%;margin:6px auto">'+(q.table.caption?'<caption style="font-size:.9em;font-weight:bold;padding:2px">'+esc(q.table.caption)+'</caption>':'')+
      q.table.rows.map(function(r,ri){return '<tr>'+r.map(function(c){return '<td style="'+(ri===0?TH:TD+';text-align:center')+'">'+esc(c)+'</td>';}).join('')+'</tr>';}).join('')+'</table>';
  }
  if(q.img)h+='<img src="'+location.origin+'/fin/'+esc(q.img)+'" alt="" style="display:block;max-width:100%;margin:6px auto">';
  return h;
}
function groupHtml(members,N,K,names,key){
  var AR='أبجد'.split(''),title=(key?'إجابات ':'')+'نشاط جماعي في مادة '+course.subject+' للصف '+course.grade;
  var ls=lessonsSel(),h=sheetHead(title,false,false),n=0,tot=0,cnt={1:0,2:0,3:0};
  members.forEach(function(m){m.forEach(function(a){tot++;cnt[a.lv]++;});});
  h+='<table style="'+TB+'"><tr><td style="'+TD+';width:50%"><b>اسم المجموعة:</b> '+(key?'..............................':'..............................')+'</td><td style="'+TD+'"><b>الصف / الشعبة:</b> '+esc(gLabel(course.grade))+' / ..........</td></tr>'+
    '<tr><td style="'+TD+'" colspan="2"><b>الدروس:</b> '+ls.map(function(l){return esc(l.title);}).join('، ')+'</td></tr></table>';
  h+=H('أعضاء المجموعة وأدوارهم');
  h+='<table id="grpTbl" style="'+TB+'"><thead><tr><th style="'+TH+';width:6%">م</th><th style="'+TH+';width:34%">اسم الطالب</th><th style="'+TH+';width:30%">دوره في المجموعة</th><th style="'+TH+'">أسئلته (المستوى)</th></tr></thead><tbody>'+
    members.map(function(m,i){return '<tr><td style="'+TD+';text-align:center">'+(i+1)+'</td><td style="'+TD+'">'+esc(names[i]||'')+'</td><td style="'+TD+'">'+esc(GROLES[i]||'عضو')+'</td><td style="'+TD+';font-size:.9em">'+(m.length?m.map(function(a,k){return 'سؤال '+(i*K+k+1)+' ('+GLVL[a.lv][0]+')';}).join(' · '):'—')+'</td></tr>';}).join('')+'</tbody></table>';
  if(!key)h+='<div style="border:1px solid #0e7c66;background:#f1f8f5;border-radius:6px;padding:6px 10px;margin:6px 0 8px"><b>خطوات العمل:</b> ١) يجيب كل عضو عن سؤاله بمفرده (3 دقائق). ٢) يعرض إجابته على المجموعة ويناقشها. ٣) تتفق المجموعة على الإجابة النهائية ويكتبها المقرِّر. ٤) يعرض المتحدّث الرسمي إجابات المجموعة أمام الصف. &nbsp; <span style="font-size:.9em">المستويات: '+lvlBadge(1)+' '+lvlBadge(2)+' '+lvlBadge(3)+'</span></div>';
  else h+='<p style="margin:4px 0 8px;font-size:.92em">عدد الأسئلة: <b>'+tot+'</b> (سهلة '+cnt[1]+'، متوسطة '+cnt[2]+'، تحدٍّ '+cnt[3]+'). تُقبل أي إجابة تؤدي المعنى نفسه.</p>';
  members.forEach(function(m,i){
    h+='<h3 style="font-size:1.05em;margin:14px 0 4px;border-bottom:1.5px solid #000">'+(i+1)+'. '+esc(names[i]||('الطالب '+(i+1)))+' <span style="font-size:.85em;font-weight:normal">— '+esc(GROLES[i]||'عضو')+'</span></h3>';
    if(!m.length)h+='<p>لا توجد أسئلة متاحة لهذا العضو.</p>';
    m.forEach(function(a){
      n++;var q=a.q,mk=q.marks||1;
      h+='<div style="margin:8px 0 10px;page-break-inside:avoid"><b>س'+n+'.</b> '+lvlBadge(a.lv)+' <span style="font-size:.8em;border:1px solid #888;border-radius:8px;padding:0 6px">'+mk+' درجة</span><div style="margin-top:3px">'+esc(a.t).replace(/\n/g,'<br>')+'</div>'+visHtml(q);
      if(q.type==='mcq'&&q.choices&&q.choices.length)h+='<div style="margin:4px 0">'+q.choices.map(function(c,ci){return '<span style="display:inline-block;min-width:45%;margin:2px 0">'+AR[ci]+') '+esc(c)+'</span>';}).join('')+'</div>';
      if(key){var ans=(q.type==='mcq'&&q.choices&&q.choices[q.correct]!=null)?AR[q.correct]+') '+q.choices[q.correct]:q.answer;
        h+='<div style="border:1px solid #0e7c66;background:#f1f8f5;border-radius:6px;padding:5px 9px;margin-top:4px"><b>الإجابة: </b>'+esc(ans||'').replace(/\n/g,'<br>')+(q.notes?'<div style="font-size:.85em;color:#555;margin-top:2px">'+esc(q.notes)+'</div>':'')+'</div>';}
      else if(q.type!=='mcq')h+='<div style="border-bottom:1px dotted #999;height:'+(Math.min(mk,5)*22+10)+'px"></div>';
      h+='</div>';
    });
  });
  if(!key)h+='<table style="'+TB+';margin-top:14px"><tr><td style="'+TD+';width:50%"><b>درجة المجموعة:</b> ........ / '+members.reduce(function(s,m){return s+m.reduce(function(t,a){return t+(a.q.marks||1);},0);},0)+'</td><td style="'+TD+'"><b>توقيع المعلم:</b> ..............</td></tr></table>';
  return wrap(h,false);
}
var bankCache={};
function loadBank(key){
  if(bankCache[key])return Promise.resolve(bankCache[key]);
  return api('/api/quiz/bank?key='+encodeURIComponent(key)).then(function(r){bankCache[key]=r.items||[];return bankCache[key];});
}
// ---------- واجب سريع (مواد العلوم): 5 أسئلة عشوائية من عدد دروس أو الوحدة كاملة ----------
var HW_SUBJ=/علوم|أحياء|فيزياء|كيمياء|بيئ|اجتماع|الرياضة المدرسية/; // مواد العلوم (والدراسات الاجتماعية والرياضة المدرسية) التي تظهر لها بطاقة الواجب السريع
var hwUnit='',hwCount='5';
function isSciC(){return HW_SUBJ.test((course||{}).subject||'');}
function hwHtml(items,key){
  var LET='أبجدهوزح',tot=0;
  var h=sheetHead('واجب منزلي — مادة '+course.subject+' للصف '+course.grade,false,!key);
  if(!key)h+='<p style="margin:2px 0 8px;font-size:.95em">أجب عن جميع الأسئلة الآتية في الفراغات المخصصة (أو في دفتر الواجب). راجع الدرس قبل البدء، وتحقّق من صياغة إجابتك.</p>';
  items.forEach(function(q,i){
    tot+=q.marks||1;
    var isMcq=q.type==='mcq'&&q.choices&&q.choices.length>=2;
    var ans=isMcq?q.choices[q.correct]!=null?q.choices[q.correct]:'':String(q.answer||'');
    h+='<div style="margin:10px 0 12px;page-break-inside:avoid"><div><b>س'+(i+1)+'. </b><span style="font-size:.78em;border:1px solid #888;border-radius:8px;padding:0 6px">'+(q.ao||'معرفة')+' · '+(q.marks||1)+' درجة</span>'+
      '<span style="font-size:.82em;color:#555"> الدرس: '+esc((byId[q.lesson_id]||{}).title||'')+'</span></div>'+
      '<div style="margin-top:3px" dir="auto">'+esc(q.stem).replace(/\*\*/g,'').replace(/\n/g,'<br>')+'</div>';
    if(q.img)h+='<img src="'+location.origin+'/fin/'+esc(q.img)+'" alt="" style="display:block;max-width:100%;margin:6px auto">';
    if(isMcq)h+='<div style="margin:4px 0">'+q.choices.map(function(c,k){return '<span style="display:inline-block;min-width:45%;margin:2px 0">'+LET[k]+') '+esc(c)+'</span>';}).join('')+'</div>';
    if(key)h+='<div style="border:1px solid #0e7c66;background:#f1f8f5;border-radius:6px;padding:5px 9px;margin-top:4px"><b>الإجابة: </b><span dir="auto">'+esc(ans).replace(/\n/g,'<br>')+'</span></div>';
    else if(!isMcq)h+='<div style="border-bottom:1px dotted #999;height:'+Math.min((q.marks||1)*22+12,60)+'px;margin-top:4px"></div>';
    h+='</div>';
  });
  h+='<table style="'+TB+';margin-top:14px"><tr><td style="'+TD+';width:34%"><b>مجموع الدرجات:</b> ........ / '+tot+'</td><td style="'+TD+';width:33%"><b>توقيع ولي الأمر:</b> ..............</td><td style="'+TD+'"><b>ملاحظات المعلم:</b> ...........................</td></tr></table>';
  return wrap(h,false);
}
function makeHw(){
  if(!course||!data)return;
  var units=unitsList(),u=units.filter(function(x){return x.unit===hwUnit;})[0]||units[0];
  if(!u){toast('لا توجد وحدات لهذا الصف');return;}
  var ls=hwCount==='all'?u.lessons.slice():u.lessons.slice(0,Math.max(1,Math.min(15,parseInt(hwCount,10)||5)));
  toast('جارٍ سحب الأسئلة…');
  loadBank(course.key).then(function(items){
    var ids={};ls.forEach(function(l){ids[l.id]=1;});
    var mine=items.filter(function(q){return ids[q.lesson_id]&&q.stem&&q.type!=='long'&&answersOk(q);});
    if(!mine.length){toast('لا توجد أسئلة قابلة للسحب في هذه الدروس');return;}
    // توزيع عادل على الدروس: دورة من كل درس حتى إكمال 5
    var byL={};
    mine.forEach(function(q){(byL[q.lesson_id]=byL[q.lesson_id]||[]).push(q);});
    var lids=shuffle(Object.keys(byL).map(Number));
    var picked=[];
    while(picked.length<5&&lids.some(function(k){return byL[k].length;})){
      lids.forEach(function(k){var g=byL[k];if(g.length&&picked.length<5)picked.push(g.pop());});
    }
    if(picked.length<5)toast('الأسئلة المتاحة أقل من 5 ('+picked.length+' سؤالًا)');
    var sheet=hwHtml(picked,false),key=hwHtml(picked,true);
    if(doc&&doc.kind===KIND&&doc.course===course.key){curPaper();doc.parts.hw=sheet;doc.parts.hwkey=key;}
    else doc={kind:KIND,course:course.key,subject:course.subject,grade:course.grade,title:('واجب سريع — '+course.subject+' '+course.grade+' — الوحدة '+u.unit).slice(0,150),parts:{hw:sheet,hwkey:key},lessons:ls.map(function(l){return l.id;}),id:null,en:false};
    dirty=true;part='hw';track('remedial_make','واجب سريع '+picked.length+' أسئلة',doc.title);renderDoc();
  },function(e){toast(e.message);});
}
function answersOk(q){
  if(q.type==='mcq')return (q.choices||[]).length>=2&&q.choices[q.correct]!=null;
  return String(q.answer||'').trim().length>0;
}
function makeGroup(){
  if(!course||!data)return;
  var ls=lessonsSel();if(!ls.length){toast('اختر درسًا واحدًا على الأقل');return;}
  var ids={};ls.forEach(function(l){ids[l.id]=1;});
  var N=gsize,K=gper,names=String(gnames||'').split('\n').map(function(x){return x.trim();}).filter(Boolean).slice(0,N);
  toast('جارٍ تجهيز الأسئلة…');
  loadBank(course.key).then(function(items){
    var mine=items.filter(function(q){return ids[q.lesson_id];}),m=buildAssign(mine,N,K),tot=m.reduce(function(s,x){return s+x.length;},0);
    if(!tot){toast('لا توجد أسئلة مناسبة لهذه الدروس');return;}
    var sheet=groupHtml(m,N,K,names,false),key=groupHtml(m,N,K,names,true);
    if(doc&&doc.kind===KIND&&doc.course===course.key){curPaper();doc.parts.grp=sheet;doc.parts.grpkey=key;}
    else doc={kind:KIND,course:course.key,subject:course.subject,grade:course.grade,title:('نشاط جماعي — '+course.subject+' '+course.grade+' — '+ls.map(function(l){return l.title;}).join('، ')).slice(0,150),parts:{grp:sheet,grpkey:key},lessons:ls.map(function(l){return l.id;}),id:null,en:false};
    dirty=true;part='grp';track('remedial_make','نشاط جماعي '+N+'×'+K,doc.title);renderDoc();
    if(tot<N*K)toast('الأسئلة المتاحة أقل من المطلوب ('+tot+' من '+(N*K)+')');
  },function(e){toast(e.message);});
}
// ==== end group ====
// ---------- الواجهة ----------
function renderSide(){
  var h='<section class="qcard"><h3>1. المادة والصف</h3>'+coursePick(courses,course&&course.key,'courseSel');
  if(!REM)h+='<div class="seg"><button type="button" class="'+(sumMode==='lesson'?'on':'')+'" data-sm="lesson">ملخص درس</button><button type="button" class="'+(sumMode==='unit'?'on':'')+'" data-sm="unit">ملخص وحدة</button></div>';
  h+='</section>';
  if(!course||!data){$('qside').innerHTML=h;bindSide();return;}
  var units=unitsList();
  if(!REM&&sumMode==='unit'){
    h+='<section class="qcard"><h3>2. الوحدة</h3><select id="unitSel" class="qsel">'+units.map(function(u){return '<option value="'+esc(u.unit)+'"'+(unitSel===u.unit?' selected':'')+'>الوحدة '+esc(u.unit)+(u.name?': '+esc(u.name):'')+'</option>';}).join('')+'</select><button type="button" class="btn primary go-btn" id="makeBtn">اعرض ملخص الوحدة</button></section>';
  }else{
    h+='<section class="qcard"><h3>2. '+(REM?'الدروس التي تعثّر فيها الطلاب':'الدروس')+' <span class="muted">(حتى 6)</span></h3><div class="lpick">';
    units.forEach(function(u){
      h+='<div class="lp-unit"><div class="lp-uh">الوحدة '+esc(u.unit)+(u.name?': '+esc(u.name):'')+'</div>';
      u.lessons.forEach(function(l){var ok=!!st(l);h+='<label class="lp-l'+(ok||!REM?'':' dim')+'"><input type="checkbox" data-lid="'+l.id+'"'+(sel[l.id]?' checked':'')+(ok||!REM?'':' disabled')+'> <span>'+esc(l.title)+'</span></label>';});
      h+='</div>';
    });
    h+='</div>';
    if(REM)h+='<label class="qrow">عدد صفوف الطلاب <input id="rowsIn" type="number" min="1" max="30" value="'+rows+'" class="qsel sm" style="width:80px"></label>';
    h+='<button type="button" class="btn primary go-btn" id="makeBtn">'+(REM?'كوّن الخطة والأنشطة':'اعرض الملخص')+'</button></section>';
    if(REM)h+='<section class="qcard"><h3>👥 نشاط جماعي</h3><label class="qrow">عدد أفراد المجموعة <select id="gSize" class="qsel sm">'+[2,3,4,5,6].map(function(n){return '<option'+(n===gsize?' selected':'')+'>'+n+'</option>';}).join('')+'</select></label><label class="qrow">أسئلة كل طالب <select id="gPer" class="qsel sm"><option value="1"'+(gper===1?' selected':'')+'>سؤال واحد</option><option value="2"'+(gper===2?' selected':'')+'>سؤالان</option></select></label><label class="qrow" style="flex-direction:column;align-items:stretch">أسماء الأعضاء (اختياري، اسم في كل سطر — الأول يأخذ الأسهل)<textarea id="gNames" class="qsel" rows="4" placeholder="الطالب الأول&#10;الطالب الثاني">'+esc(gnames)+'</textarea></label><button type="button" class="btn primary go-btn" id="grpBtn">كوّن النشاط الجماعي</button><div class="muted small" style="margin-top:6px">أسئلة سهلة ومتوسطة وتحدٍّ خفيف، بالأشكال والجداول ونموذج إجابة.</div></section>';
    // «الواجبات المنزلية» صار قسمًا مستقلًا في القائمة الرئيسية (/homework) بدرجات وأنواع وفق الوثيقة
  }
  h+='<section class="qcard"><h3>بيانات الورقة</h3><div class="hdr-f">'+(REM?'<label>اسم معلم المادة<input id="h_teacher" value="'+esc(hdr.teacher)+'"></label>':'')+
    '<label>المديرية<input id="h_dir" value="'+esc(hdr.dir)+'"></label><label>المدرسة<input id="h_school" value="'+esc(hdr.school)+'"></label>'+
    '<label>الفصل الدراسي<select id="h_term"><option'+(hdr.term==='الأول'?' selected':'')+'>الأول</option><option'+(hdr.term==='الثاني'?' selected':'')+'>الثاني</option></select></label><label>العام الدراسي<input id="h_year" value="'+esc(hdr.year)+'" class="ltr"></label></div></section>'+
    '<section class="qcard"><h3>'+(REM?'خططي المحفوظة':'ملخصاتي المحفوظة')+'</h3><ul class="saved" id="savedList"><li class="muted">جارٍ التحميل…</li></ul></section>';
  $('qside').innerHTML=h;bindSide();loadSaved();
}
function bindSide(){
  bindCoursePick(courses,'courseSel',selectCourse);
  Array.prototype.forEach.call(document.querySelectorAll('[data-sm]'),function(b){b.onclick=function(){sumMode=b.getAttribute('data-sm');renderSide();};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-lid]'),function(b){b.onchange=function(){var id=+b.getAttribute('data-lid');if(b.checked){if(Object.keys(sel).length>=6){b.checked=false;toast('اختر 6 دروس كحد أقصى');return;}sel[id]=1;}else delete sel[id];};});
  if($('unitSel'))$('unitSel').onchange=function(){unitSel=this.value;};
  if($('rowsIn'))$('rowsIn').onchange=function(){rows=Math.max(1,Math.min(30,parseInt(this.value,10)||5));};
  if($('makeBtn'))$('makeBtn').onclick=make;
  if($('gSize'))$('gSize').onchange=function(){gsize=Math.max(2,Math.min(6,parseInt(this.value,10)||5));};
  if($('gPer'))$('gPer').onchange=function(){gper=this.value==='2'?2:1;};
  if($('gNames'))$('gNames').onchange=function(){gnames=this.value;};
  if($('grpBtn'))$('grpBtn').onclick=function(){if($('gNames'))gnames=$('gNames').value;makeGroup();};
  ['dir','school','year','term','teacher'].forEach(function(k){var el=$('h_'+k);if(el)el.onchange=function(){hdr[k]=el.value.trim()||DEF_HDR[k];lsSet(hdrKey(),hdr);};});
}
var studySeq=0; // رقم طلب حزمة الدراسة: يمنع نتيجة صف قديم من الكتابة فوق الصف الحالي
function selectCourse(key){
  course=courses.filter(function(c){return c.key===key;})[0]||null;sel={};unitSel='';data=null;
  if(!course){renderSide();return Promise.resolve();}
  lsSet('tahdir_study_course',key);
  // على الصف الجديد لا معنى لورقة الصف القديم: نمسحها حتى لا تُحفظ على الصف الخطأ
  if(doc&&doc.course!==course.key){doc=null;dirty=false;}
  var seq=++studySeq;
  if(!doc)$('qmain').innerHTML='<div class="welcome"><h2>جارٍ التحميل…</h2></div>';
  return api('/api/study?key='+encodeURIComponent(key)).then(function(r){
    if(seq!==studySeq)return; // وصلت متأخرة بعد تبديل صف آخر
    data=r;byId={};data.lessons.forEach(function(l){byId[l.id]=l;});
    var u=unitsList();unitSel=u.length?u[0].unit:'';
    renderSide();if(!doc)welcome();
  },function(e){if(seq===studySeq)toast(e.message);});
}
function welcome(){
  $('qmain').innerHTML=REM?
    '<div class="welcome qwel"><h2>🩹 الخطط العلاجية والأنشطة الصفية</h2><p>لكل درس: المهارة التي يتعثر فيها الطلاب، شرح مبسط، و3 أنشطة علاجية متدرجة مع نموذج الإجابة — مكتوبة من مخرجات التعلم في المنهج العُماني. ومعها نموذج «خطة علاجية للطالب دون المستوى» جاهز للتعبئة. ومعها تبويب <b>«الأنشطة الصفية»</b>: أسئلة تحدٍّ أعلى مستوى (تطبيق واستدلال، وأسئلة الوزارة بالرسوم) لكل درس مع إجاباتها. وبطاقة <b>«نشاط جماعي»</b> توزّع أسئلة سهلة ومتوسطة وتحدٍّ خفيف على أفراد المجموعة (2–6) بأدوارهم وأسمائهم، مع نموذج الإجابة.</p><div class="welcome-steps"><span>1. اختر الدروس</span><span>2. كوّن الخطة</span><span>3. عدّل أي نص بالضغط عليه</span><span>4. اطبع أو حمّل Word</span></div></div>':
    '<div class="welcome qwel"><h2>📚 ملخصات الدروس والوحدات</h2><p>ملخص لكل درس مبني على مخرجات التعلم في المنهج العُماني والكتاب المدرسي: الفكرة الأساسية، نقاط كل مخرج، المصطلحات، وأخطاء شائعة. وملخص للوحدة بأفكارها الكبرى وأسئلة مراجعة.</p><div class="welcome-steps"><span>1. اختر درسًا أو وحدة</span><span>2. اعرض الملخص</span><span>3. عدّل ما تريد</span><span>4. اطبع أو حمّل Word للطلاب</span></div></div>';
}
// ==== mind map ====
// ---------- خريطة ذهنية بالعرض لملخص الدرس (تُقرأ من study.mm) ----------
var MMCSS='<style>@page{size:A4 landscape;margin:10mm}.mm{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;color:#1b1f1d;background:#fff;line-height:1.7;font-size:.95em}.mm *{box-sizing:border-box}'+
'.mm .mh{display:flex;align-items:center;gap:10px;background:#e3f1eb;border-bottom:3px solid #1f8a70;padding:8px 12px;border-radius:8px 8px 0 0}.mm .mh b{background:#1f8a70;color:#fff;border-radius:8px;padding:0 12px;font-size:1.25em}.mm .mh span{font-weight:700}.mm .mh em{margin-inline-start:auto;font-style:normal;font-weight:900;font-size:1.15em}'+
'.mm .mg2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;padding:10px}.mm .mc{border:1.5px solid #cfd8d3;border-radius:10px;padding:8px 10px;break-inside:avoid}.mm .wide{grid-column:1/-1}'+
'.mm .mp{display:inline-block;border-radius:999px;padding:1px 14px;font-weight:800;margin:0 0 4px}.mm .mp i{font-style:normal;font-size:.75em;background:#0002;border-radius:6px;padding:0 6px;margin-inline-start:6px}'+
'.mm .g{background:#d8ecc0}.mm .pu{background:#e6d3ef}.mm .b{background:#cfe0f5}.mm .r{background:#f7d3d0}.mm .y{background:#fbe7a8}'+
'.mm .mr{color:#c62828;font-weight:700}.mm .mb{color:#1a4fb4;font-weight:700}'+
'.mm ul.mk{list-style:none;margin:2px 0;padding:0 10px 0 0;border-right:3px solid #1b1f1d}.mm ul.mk li{position:relative;padding:1px 12px 1px 0}.mm ul.mk li:before{content:"◄";position:absolute;right:-9px;top:.5em;font-size:.7em;background:#fff}'+
'.mm .ms{display:flex;gap:8px;align-items:flex-start}.mm .ms b{flex:none;width:24px;height:24px;border-radius:50%;background:#1f8a70;color:#fff;display:grid;place-items:center;font-size:.85em;margin-top:2px}.mm .ma{text-align:center;line-height:1;font-size:.9em;color:#1f8a70}'+
'.mm table.mt{border-collapse:collapse;width:100%;margin:4px 0;font-size:.92em}.mm table.mt td,.mm table.mt th{border:1px solid #9aa8a1;padding:2px 6px;vertical-align:top}.mm table.mt th{background:#eef3f1}'+
'.mm .mg{text-align:center;margin:6px 0}.mm .mg svg{width:100%;max-width:380px;height:auto}'+
'.mm .cmp3{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}.mm .cmp3>div{border:2px solid #cfd8d3;border-radius:10px;padding:4px 8px}.mm .cmp3 .mp{display:block;text-align:center}.mm .cmp3 ul{margin:2px 0;padding-right:18px}'+
'.mm .tip{background:#fbe7a8;border-radius:10px;padding:6px 12px}.mm .tip ul{margin:2px 0;padding-right:18px}.mm .mem{margin-top:6px;font-weight:800;text-align:center;border:2px dashed #1f8a70;border-radius:10px;padding:4px 8px}</style>';
function mmT(s){return esc(s).replace(/\{\{(.+?)\}\}/g,'<bdi dir="ltr">$1</bdi>').replace(/\[\[(.+?)\]\]/g,'<span class="mr">$1</span>').replace(/\(\((.+?)\)\)/g,'<span class="mb">$1</span>');}
function mmUl(p){return '<ul class="mk">'+p.map(function(x){return '<li>'+mmT(x)+'</li>';}).join('')+'</ul>';}
function mmSec(s){
  var h='<div class="mc"><div class="mp '+s.c+'">'+esc(s.h)+(s.o?'<i dir="ltr">'+esc(s.o)+'</i>':'')+'</div>';
  if(s.pts)h+=mmUl(s.pts);
  if(s.flow)h+=s.flow.map(function(x,i){return '<div class="ms"><b>'+(i+1)+'</b><span>'+mmT(x)+'</span></div>'+(i<s.flow.length-1?'<div class="ma">▼</div>':'');}).join('');
  if(s.tbl)h+='<table class="mt"><tr>'+s.tbl.h.map(function(x){return '<th>'+esc(x)+'</th>';}).join('')+'</tr>'+s.tbl.r.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+mmT(c)+'</td>';}).join('')+'</tr>';}).join('')+'</table>';
  if(s.svg)h+='<div class="mg">'+s.svg+'</div>';
  return h+'</div>';
}
function mmHtml(l){
  var s=st(l),m=s&&s.mm;if(!m)return '';
  var S=s.summary||{outcomes:[]},h='<div class="mm"><div class="mh"><b>'+esc(l.unit)+'</b><span>'+esc(l.unit_name||'')+'</span><em>'+esc(l.title)+'</em></div><div class="mg2">';
  if(S.outcomes&&S.outcomes.length)h+='<div class="mc wide"><div class="mp g">أهداف الدرس</div><ul class="mk">'+S.outcomes.map(function(o){return '<li>'+(o.code?'<span class="mb" dir="ltr">'+esc(o.code)+'</span> ':'')+esc(o.text)+'</li>';}).join('')+'</ul></div>';
  (m.sec||[]).forEach(function(x){h+=mmSec(x);});
  if(m.cmp)h+='<div class="mc wide"><div class="mp pu">'+esc(m.cmp.h)+'</div><div class="cmp3">'+m.cmp.cols.map(function(c){return '<div><span class="mp '+c.c+'">'+esc(c.h)+'</span><ul>'+c.pts.map(function(p){return '<li>'+mmT(p)+'</li>';}).join('')+'</ul></div>';}).join('')+'</div></div>';
  if(m.tips&&m.tips.length)h+='<div class="mc wide tip"><b>تريكات</b><ul>'+m.tips.map(function(p){return '<li>'+mmT(p)+'</li>';}).join('')+'</ul>'+(m.mem?'<div class="mem">'+mmT(m.mem)+'</div>':'')+'</div>';
  return h+'</div></div>';
}
function mmAll(ls){var a=ls.map(mmHtml).filter(Boolean);return a.length?wrap(MMCSS+a.join('<div style="page-break-after:always"></div>'),false):'';}
// ==== end mind map ====
function make(){
  if(!course||!data)return;
  var ls=lessonsSel();
  if((REM||sumMode==='lesson')&&!ls.length){toast('اختر درسًا واحدًا على الأقل');return;}
  var title,parts;
  if(REM){
    parts={plan:planHtml(ls),sheet:sheetHtml(ls,false),key:sheetHtml(ls,true),cls:classHtml(ls,false),clskey:classHtml(ls,true)};
    title='خطة علاجية — '+course.subject+' '+course.grade+' — '+ls.map(function(l){return l.title;}).join('، ');part='plan';
    track('remedial_make',ls.length+' دروس',title);
  }else{
    parts={main:summaryHtml()};part='main';
    if(sumMode==='lesson'){var mmh=mmAll(ls);if(mmh){parts.mm=mmh;part='mm';}}
    var u=unitsList().filter(function(x){return x.unit===unitSel;})[0];
    title=sumMode==='unit'?'ملخص الوحدة '+unitSel+(u&&u.name?': '+u.name:'')+' — '+course.grade:'ملخص: '+ls.map(function(l){return l.title;}).join('، ');
    track('summary_make',sumMode==='unit'?'الوحدة '+unitSel:ls.length+' دروس',title);
  }
  doc={kind:KIND,course:course.key,subject:course.subject,grade:course.grade,title:title.slice(0,150),parts:parts,lessons:ls.map(function(l){return l.id;}),id:null,en:isEnC()};
  dirty=true;renderDoc();
}
var PART_TXT={plan:'نموذج الخطة العلاجية',sheet:'ورقة الأنشطة للطالب',key:'نموذج الإجابة',cls:'الأنشطة الصفية',clskey:'إجابات الأنشطة الصفية',mm:'خريطة ذهنية بالعرض',grp:'النشاط الجماعي',grpkey:'إجابات النشاط الجماعي',hw:'الواجب السريع',hwkey:'إجابات الواجب السريع',main:'الملخص'};
function partKeys(){return REM?['plan','sheet','key','cls','clskey','grp','grpkey','hw','hwkey']:['mm','main'];}
function presentKeys(){var k=partKeys().filter(function(x){return doc&&doc.parts&&doc.parts[x];});return k.length?k:partKeys();}
function renderDoc(){
  if(!doc){welcome();return;}
  var h='<div class="qbar no-print"><div class="qbar-t"><input class="title-in sm" id="docTitle" value="'+esc(doc.title)+'" aria-label="الاسم في قائمتك"><div class="muted small">'+(doc.id?'محفوظ':'غير محفوظ بعد')+(dirty&&doc.id?' · فيه تعديلات لم تُحفظ':'')+'</div></div>'+
    '<div class="qbar-b"><button type="button" class="btn primary" id="printBtn">🖨 طباعة / PDF</button><button type="button" class="btn" id="wordBtn">⬇ تحميل Word</button><button type="button" class="btn" id="saveBtn">حفظ</button>'+
    (REM&&part==='plan'?'<button type="button" class="btn" id="rowAdd">+ صف طالب</button><button type="button" class="btn" id="rowDel">− صف</button>':'')+'</div></div>'+
    '<div class="edit-hint no-print">✎ اضغط على أي نص في الورقة لتعديله أو حذفه أو الكتابة فيه'+(REM?'، واضغط على المربع ☐ لتحديده':'')+'.</div>'+
    ((REM||(doc.parts&&doc.parts.mm))?'<div class="ptabs no-print" role="tablist">'+presentKeys().map(function(k){return '<button type="button" class="ltab'+(part===k?' on':'')+'" data-part="'+k+'">'+PART_TXT[k]+'</button>';}).join('')+'</div>':'')+
    '<div class="paper study-paper" id="paper" contenteditable="true" spellcheck="false">'+clean(doc.parts[part]||'')+'</div>';
  $('qmain').innerHTML=h;
  var pp=$('paper');
  pp.addEventListener('input',function(){doc.parts[part]=pp.innerHTML;dirty=true;});
  pp.addEventListener('click',function(e){var t=e.target;if(t&&t.classList&&t.classList.contains('cb')){t.textContent=t.textContent==='☑'?'☐':'☑';doc.parts[part]=pp.innerHTML;dirty=true;}});
  Array.prototype.forEach.call(document.querySelectorAll('[data-part]'),function(b){b.onclick=function(){part=b.getAttribute('data-part');renderDoc();};});
  $('docTitle').onchange=function(){doc.title=this.value.trim()||doc.title;dirty=true;};
  $('printBtn').onclick=printDoc;$('wordBtn').onclick=wordDoc;$('saveBtn').onclick=saveDoc;
  if($('rowAdd'))$('rowAdd').onclick=function(){var tb=pp.querySelector('#stTbl tbody');if(!tb)return;var n=tb.rows.length+1;tb.insertAdjacentHTML('beforeend',stRow(n));doc.parts[part]=pp.innerHTML;dirty=true;};
  if($('rowDel'))$('rowDel').onclick=function(){var tb=pp.querySelector('#stTbl tbody');if(!tb||tb.rows.length<2)return;tb.deleteRow(-1);doc.parts[part]=pp.innerHTML;dirty=true;};
}
// تنظيف HTML المحفوظ/الملصوق قبل عرضه (لا سكربتات ولا أحداث)
function clean(html){
  var t=document.createElement('template');t.innerHTML=String(html||'');
  Array.prototype.forEach.call(t.content.querySelectorAll('script,iframe,object,embed,link,meta,style,form,input,button,textarea,select'),function(x){x.remove();});
  Array.prototype.forEach.call(t.content.querySelectorAll('*'),function(x){Array.prototype.slice.call(x.attributes).forEach(function(a){var n=a.name.toLowerCase();if(n.indexOf('on')===0||((n==='href'||n==='src'||n==='xlink:href')&&/^\s*(javascript|data):/i.test(a.value)))x.removeAttribute(a.name);});});
  var d=document.createElement('div');d.appendChild(t.content.cloneNode(true));return d.innerHTML;
}
function curPaper(){var pp=$('paper');if(pp)doc.parts[part]=pp.innerHTML;}
function chooseParts(title){
  if(!REM)return Promise.resolve(['main']);
  // نستخدم dialog المشتركة: تغلق النافذة وترفع الحدث وعدّاد لوحة المفاتيح معها
  var html='<div class="parts">'+presentKeys().map(function(k){return '<label><input type="checkbox" name="pp" value="'+k+'"'+((part==='cls'||part==='clskey')?(k===part||(part==='cls'&&k==='clskey')?' checked':''):(part==='grp'||part==='grpkey')?(k===part||(part==='grp'&&k==='grpkey')?' checked':''):(k==='plan'||k==='sheet'||k===part?' checked':''))+'> '+PART_TXT[k]+'</label>';}).join('')+'</div>';
  return dialog({title:title,cancelText:'إلغاء',okText:'متابعة',group:'pp',html:html}).then(function(v){
    if(!v)return null;
    if(!v.length){toast('اختر جزءًا واحدًا على الأقل');return null;}
    return v;
  });
}
function forOut(html){return clean(html).replace(/ contenteditable="false"/g,'').replace(/<span class="cb"[^>]*>/g,'<span>');}
var leavingOk=0,MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function fileName(){return String(doc.title||'خبير').replace(/[\\/:*?"<>|]+/g,'-').slice(0,90);}
function serverFile(format,html,win){
  toast('جارٍ التجهيز…');
  return api('/api/export',{format:format,name:fileName(),html:supify(html)}).then(function(r){
    if(win){try{win.location.href=r.url;return;}catch(e){}}
    leavingOk=Date.now();var a=document.createElement('a');a.href=r.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);
  },function(e){if(win)try{win.close();}catch(x){}toast(e.message);});
}
function printDoc(){
  curPaper();
  chooseParts('طباعة / حفظ PDF').then(function(ps){
    if(!ps)return;track(KIND==='remedial'?'remedial_print':'summary_print',ps.join('+'),doc.title);
    if(!IN_APP&&!MOBILE){
      var a=$('printArea');a.innerHTML=ps.map(function(k){return '<div class="ppage">'+forOut(doc.parts[k])+'</div>';}).join('');
      doPrint(fileName());
      return;
    }
    var w=null;if(!IN_APP){try{w=window.open('','_blank');}catch(e){w=null;}}
    serverFile('print',ps.map(function(k){return '<div class="pg">'+forOut(doc.parts[k])+'</div>';}).join(''),w).then(function(){if(IN_APP)toast('تُفتح صفحة الطباعة في المتصفح… اختر «حفظ PDF» أو الطابعة');});
  });
}
function wordDoc(){
  curPaper();
  chooseParts('تحميل ملف Word').then(function(ps){
    if(!ps)return;
    var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(doc.title)+'</title>'+
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->'+
      '<style>@page WordSection1{size:595.3pt 841.9pt;margin:30pt 34pt 30pt 34pt}div.WordSection1{page:WordSection1}body{font-family:"Simplified Arabic","Traditional Arabic",Arial;font-size:12.5pt}p{margin:0 0 4pt}h3{font-size:13pt}</style></head>'+
      '<body dir="'+(doc.en&&!REM?'ltr':'rtl')+'"><div class="WordSection1">'+ps.map(function(k){return forOut(doc.parts[k]);}).join('<br clear="all" style="page-break-before:always">')+'</div></body></html>';
    track(KIND==='remedial'?'remedial_word':'summary_word',ps.join('+'),doc.title);
    serverFile('doc',html,null).then(function(){toast(IN_APP?'يُحمَّل ملف Word عبر المتصفح، ستجده في «التنزيلات»':'تم تحميل ملف Word');});
  });
}
function saveDoc(){
  curPaper();
  var t=($('docTitle')&&$('docTitle').value.trim())||doc.title;doc.title=t;
  return api('/api/quizzes',{id:doc.id,title:t,grade:doc.grade,subject:doc.subject,kind:KIND,data:doc}).then(function(r){doc.id=r.id;dirty=false;renderDoc();loadSaved();toast('حُفظ ✓');},function(e){toast(e.message);});
}
function loadSaved(){
  if(!$('savedList'))return;
  api('/api/quizzes?kind='+KIND).then(function(r){
    var l=r.quizzes||[];var el=$('savedList');if(!el)return;
    el.innerHTML=l.length?l.map(function(q){return '<li><button type="button" class="link-btn" data-open="'+q.id+'"><b>'+esc(q.title)+'</b></button><span class="muted small">'+esc(fmtDate(q.updated_at))+'</span><button type="button" class="x" data-delq="'+q.id+'" aria-label="حذف">×</button></li>';}).join(''):'<li class="muted">لا يوجد. بعد التكوين اضغط «حفظ».</li>';
    Array.prototype.forEach.call(el.querySelectorAll('[data-open]'),function(b){b.onclick=function(){openSaved(+b.getAttribute('data-open'));};});
    Array.prototype.forEach.call(el.querySelectorAll('[data-delq]'),function(b){b.onclick=function(){dialog({title:'حذف الملف المحفوظ؟',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/quizzes/'+b.getAttribute('data-delq'),null,'DELETE').then(function(){if(doc&&doc.id===+b.getAttribute('data-delq'))doc.id=null;loadSaved();toast('حُذف');});});};});
  },function(){});
}
function openSaved(id){
  api('/api/quizzes/'+id).then(function(r){
    var d=r.quiz.data;d.id=r.quiz.id;d.title=r.quiz.title;
    var go=function(){doc=d;dirty=false;part=presentKeys()[0];renderDoc();};
    if(!course||course.key!==d.course){var c=courses.filter(function(x){return x.key===d.course;})[0];if(c){doc=null;selectCourse(c.key).then(go);return;}}
    go();
  },function(e){toast(e.message);});
}
// ---------- البداية ----------
window.addEventListener('beforeunload',function(e){if(Date.now()-leavingOk<5000)return;if(doc&&dirty){e.preventDefault();e.returnValue='';}});
Promise.all([api('/api/me'),api('/api/courses')]).then(function(r){
  me=r[0];initNav(me);
  hdr=Object.assign(clone(DEF_HDR),lsGet(hdrKey())||{});
  courses=(r[1].courses||[]).sort(function(a,b){return (gnum(a.grade)-gnum(b.grade))||a.subject.localeCompare(b.subject,'ar');});
  if(!courses.length){$('qmain').innerHTML='<div class="welcome"><h2>لا توجد صفوف متاحة لحسابك</h2><p>تواصل مع مدير المنصة.</p></div>';return;}
  // قادم من «تحليل النتائج»: نختار الدروس الأضعف ونكوّن الخطة العلاجية مباشرة
  var hf=null;try{hf=JSON.parse(localStorage.getItem('tahdir_handoff')||'null');}catch(e){}
  if(REM&&hf&&hf.to==='remedial'&&Date.now()-(hf.at||0)<15*60000){
    try{localStorage.removeItem('tahdir_handoff');}catch(e){}
    var hc=courses.filter(function(x){return x.key===hf.course;})[0];
    if(hc){selectCourse(hc.key).then(function(){sel={};(hf.lessons||[]).forEach(function(id){if(byId[id]&&st(byId[id]))sel[id]=1;});renderSide();if(Object.keys(sel).length){make();toast('خطة علاجية للدروس الأضعف في التحليل ✓');}else toast('لا توجد خطط علاجية جاهزة لهذه الدروس');});return;}
  }
  var last=lsGet('tahdir_study_course')||lsGet('tahdir_quiz_course'),c=courses.filter(function(x){return x.key===last;})[0]||cpDefault(courses);
  selectCourse(c.key);
},function(e){$('qmain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
