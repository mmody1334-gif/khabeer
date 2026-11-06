// «بليكرز» — بطاقات الإجابة داخل المنصة (بديل Plickers بلا حساب ولا تطبيق خارجي):
// 1) صفوفي: المعلم يضيف صفًا (المادة والصف) ويلصق الأسماء ← يُحفظ «الاسم الأول + القبيلة» لكل طالب،
//    ورقم الطالب = ترتيبه في الكشف = رقم بطاقته ← طباعة البطاقات (بطاقتان في الصفحة مثل Plickers).
// 2) توليد أسئلة من بنك المنصة لنفس الصف (5/10/15/20) ← بدء الجلسة:
//    الكمبيوتر يعرض السؤال (شاشة السبورة)، والجوال يمسح البطاقات ويتحكم (التالي، إظهار الإجابة).
//    الجهازان بنفس حساب المعلم، والتزامن عبر الخادم.
// 3) النتائج: كل طالب باسمه صح/خطأ في كل سؤال ← تقرير، و«تحليل النتائج»، و«سجل صعوبات التعلم».
(function(){
'use strict';
guard();
var me=null,courses=[],classes=[],sessions=[];
var QS=new URLSearchParams(location.search),BOARD=QS.get('board')==='1',SCAN=+QS.get('scan')||0,BSID=+QS.get('s')||0;
var LET=CARD_LET;
function track(type,detail,title){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,detail:detail||'',title:title||''})});}catch(e){}}
function today(){var d=new Date();return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate();}
function main(h){$('cdMain').innerHTML=h;window.scrollTo(0,0);}
function each(sel,fn){Array.prototype.forEach.call(document.querySelectorAll(sel),fn);}
function pctS(x){return Math.round(x*100)+'%';}
function isPhone(){return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||Math.min(screen.width,screen.height)<700;}
function courseName(k){var c=courses.filter(function(x){return x.key===k;})[0];return c?c.subject+' — '+gLabel(c.grade):'';}
function scanUrl(id){return location.origin+'/cards'+'?scan='+id;}

// «الاسم الأول + القبيلة»: يُتجاهل «بن/بنت» والأسماء الوسطى، ويُحافظ على الأسماء المركّبة (عبد الله، آل سعيد)
function shortName(full){
  var w=String(full||'').replace(/ـ/g,'').replace(/[()\[\]،,.]/g,' ').split(/\s+/).filter(Boolean);
  w=w.filter(function(x){return !/^(بن|بنت|ابن|إبن|ولد|bin|bint)$/i.test(x);});
  if(!w.length)return String(full||'').trim();
  var first=w[0],i=1;
  if(/^(عبد|عبدال|أبو|ابو|أبي|ام|أم)$/.test(first)&&w.length>1){first+=' '+w[1];i=2;}
  if(w.length<=i)return first;
  var last=w[w.length-1],prev=w[w.length-2];
  if(w.length-2>=i&&/^(آل|ال|أل|بو|أبو|ابو|بني|البو|ذو)$/.test(prev))last=prev+' '+last;
  return first+' '+last;
}
function parseNames(t){
  return String(t||'').split(/\r?\n/).map(function(l){
    // يقبل اللصق من Excel أو نور: يأخذ أطول خلية فيها حروف، ويحذف الترقيم في أول السطر
    var cells=l.split('\t').map(function(x){return x.trim();}).filter(function(x){return /[A-Za-z؀-ۿ]/.test(x);});
    var nm=cells.sort(function(a,b){return b.length-a.length;})[0]||'';
    return nm.replace(/^\s*[\d٠-٩]+\s*[-.)–]?\s*/,'').replace(/\s+/g,' ').trim();
  }).filter(Boolean);
}


// ================= الشرح =================
// رسم البطاقة كما يرفعها الطالب لكل إجابة (أ: كما هي، ب: الجانب الأيمن للأعلى، ج: مقلوبة، د: الجانب الأيسر للأعلى)
function holdSvg(k,size,en){return '<div class="ck-hold" style="width:'+size+'px;height:'+size+'px"><div style="transform:rotate('+[0,-90,180,90][k]+'deg)">'+cardSvg(7,{en:en})+'</div></div>';}
function holdRow(size,en){var L=en?CARD_LET_EN:LET;return '<div class="ck-holds">'+[0,1,2,3].map(function(k){return '<figure><span class="ck-up">▲ '+L[k]+'</span>'+holdSvg(k,size,en)+'<figcaption>إجابتي <b>'+L[k]+'</b></figcaption></figure>';}).join('')+'</div>';}
function help(){
  dialog({title:'طريقة الاستخدام — كروت الأسئلة (بليكرز)',wide:true,cancelText:false,okText:'فهمت ✓',html:'<div class="ck-help">'+
    '<h4>للمعلم: 4 خطوات</h4><ol>'+
      '<li><b>أضف صفًا:</b> اختر المادة والصف، والصق الأسماء بترتيب الكشف (من Excel أو نور). تحفظ المنصة <b>الاسم الأول والقبيلة</b> فقط (علي بن سالم بن محمد الشامسي ← علي الشامسي).</li>'+
      '<li><b>اطبع البطاقات:</b> بطاقتان في الصفحة بحجم 100%. البطاقة رقم 1 لأول طالب في الكشف، وهكذا. يحتفظ الطالب ببطاقته لكل الحصص.</li>'+
      '<li><b>ولّد الأسئلة:</b> اختر الدروس والعدد (5/10/15/20) ثم «بدء الجلسة».</li>'+
      '<li><b>اعرض وامسح:</b> «عرض الأسئلة» على كمبيوتر الفصل، وامسح رمز QR الظاهر عليه بكاميرا جوالك (بنفس حسابك) فتفتح كاميرا المسح. من الجوال: «التالي» و«الإجابة»، والسبورة تتبعك.</li></ol>'+
    '<h4>للطالب: كيف يرفع البطاقة؟</h4><p>يمسك البطاقة بحيث يكون حرف إجابته في <b>الأعلى</b> ويرفعها مواجهةً للمعلم:</p>'+holdRow(92)+
    '<h4>نصائح لمسح سريع ودقيق</h4><ul>'+
      '<li>قف أمام الصف وحرّك الجوال ببطء من جهة لأخرى؛ الكاميرا تقرأ عدة بطاقات في اللحظة نفسها، ويظهر إطار <b style="color:#16a34a">أخضر</b> واسم الطالب على كل بطاقة سُجّلت.</li>'+
      '<li>الإطار <b style="color:#e8890c">البرتقالي</b> يعني أن البطاقة قُرئت مرة واحدة وتنتظر التأكيد — أبقِ الكاميرا عليها لحظة.</li>'+
      '<li>لا يغطّي الطالب المربع الأسود بأصابعه، والإضاءة العادية تكفي (تجنّب الضوء المنعكس على البطاقة).</li>'+
      '<li>لو لم تُقرأ بطاقات آخر الصف: اقترب خطوة، أو اطبع «بطاقة كبيرة في الصفحة».</li>'+
      '<li>يستطيع الطالب تغيير إجابته وأنت تمسح: يُسجَّل آخر اتجاه رفعه.</li>'+
      '<li>زر «👥» في الجوال يعرض من بقي بلا إجابة.</li></ul>'+
    '<p class="muted small">يعمل المسح من متصفح الجوال (Chrome أو Safari) ومن تطبيق خبير بعد تحديثه.</p></div>'});
  try{localStorage.setItem('tahdir_cards_help','1');}catch(e){}
}

// ================= القائمة الرئيسية =================
function load(){
  return api('/api/quizzes?kind=cclass,csession').then(function(r){
    var l=r.quizzes||[];classes=l.filter(function(q){return q.kind==='cclass';});sessions=l.filter(function(q){return q.kind==='csession';});home();
  },function(e){main('<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>');});
}
var TAB='classes';
function home(){
  var h='<div class="an-head"><h2>🪪 كروت الأسئلة (بليكرز)</h2><p class="muted">لكل طالب بطاقة مطبوعة برمز خاص، يديرها فيصبح حرف إجابته في الأعلى، وتمسح الفصل كله بكاميرا جوالك في ثوانٍ: يُسجَّل كل طالب باسمه صح أو خطأ. الأسئلة تُعرض على شاشة الكمبيوتر وتتحكم فيها من الجوال.</p></div>'+
    '<ol class="ck-steps"><li><b>أضف صفًا</b> والصق أسماء الطلاب</li><li><b>اطبع البطاقات</b> ووزّعها بالترتيب</li><li><b>ولّد الأسئلة</b> من بنك الصف</li><li><b>اعرض على الكمبيوتر</b> وامسح بالجوال</li></ol>'+
    '<div class="an-new"><button type="button" class="btn small" id="ckHelp">❓ طريقة الاستخدام</button></div>'+
    '<div class="ck-tabs" role="tablist"><button role="tab" data-tab="classes" aria-selected="'+(TAB==='classes')+'">👥 صفوفي ('+classes.length+')</button><button role="tab" data-tab="sessions" aria-selected="'+(TAB==='sessions')+'">📋 الجلسات والنتائج ('+sessions.length+')</button></div>';
  if(TAB==='classes'){
    h+='<div class="an-new"><button type="button" class="btn primary" id="cdNewC">+ إضافة صف</button></div>';
    h+=classes.length?'<div class="ck-cg">'+classes.map(function(c){return '<div class="ck-cc"><div class="ck-cch"><b>'+esc(c.title)+'</b><small class="muted">'+esc(c.subject||'')+' '+esc(c.grade?'· '+gLabel(c.grade):'')+'</small></div>'+
      '<div class="ck-ccb"><button type="button" class="btn small primary" data-go="'+c.id+'">✨ توليد أسئلة وبدء</button><button type="button" class="btn small" data-pr="'+c.id+'">🖨 طباعة البطاقات</button><button type="button" class="btn small ghost" data-ed="'+c.id+'">✎ الطلاب</button><button type="button" class="x" data-del="'+c.id+'" title="حذف">×</button></div></div>';}).join('')+'</div>'
      :'<p class="muted">لا توجد صفوف بعد. ابدأ بـ «+ إضافة صف».</p>';
  }else{
    h+=sessions.length?'<ul class="an-list">'+sessions.map(function(s){return '<li><div><b>'+esc(s.title)+'</b><small class="muted"> · '+fmtDate(s.updated_at)+'</small></div><span class="an-li-b"><button type="button" class="btn small primary" data-res="'+s.id+'">📊 النتائج</button><button type="button" class="btn small" data-start="'+s.id+'">▶ متابعة</button><button type="button" class="x" data-del="'+s.id+'" title="حذف">×</button></span></li>';}).join('')+'</ul>'
      :'<p class="muted">لا توجد جلسات بعد. ابدأ من «صفوفي» ← «توليد أسئلة وبدء».</p>';
  }
  main(h);
  each('[data-tab]',function(b){b.onclick=function(){TAB=b.getAttribute('data-tab');home();};});
  if($('cdNewC'))$('cdNewC').onclick=function(){editClass(null);};
  $('ckHelp').onclick=help;
  var seen=null;try{seen=localStorage.getItem('tahdir_cards_help');}catch(e){}
  if(!seen&&!classes.length&&!SCAN)setTimeout(help,400);
  each('[data-ed]',function(b){b.onclick=function(){getDoc(b.getAttribute('data-ed')).then(editClass);};});
  each('[data-pr]',function(b){b.onclick=function(){getDoc(b.getAttribute('data-pr')).then(printCards);};});
  each('[data-go]',function(b){b.onclick=function(){getDoc(b.getAttribute('data-go')).then(generate);};});
  each('[data-res]',function(b){b.onclick=function(){getDoc(b.getAttribute('data-res')).then(results);};});
  each('[data-start]',function(b){b.onclick=function(){getDoc(b.getAttribute('data-start')).then(startScreen);};});
  each('[data-del]',function(b){b.onclick=function(){var id=b.getAttribute('data-del');dialog({title:'حذف نهائي؟',message:TAB==='classes'?'سيُحذف الصف وقائمة طلابه (تبقى نتائج جلساته السابقة).':'ستُحذف الجلسة وإجابات الطلاب فيها.',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/quizzes/'+id,null,'DELETE').then(load);});};});
}
function getDoc(id){return api('/api/quizzes/'+id).then(function(r){var d=r.quiz.data;d.id=r.quiz.id;d.updated_at=r.quiz.updated_at;return d;},function(e){toast(e.message);throw e;});}
function saveDoc(kind,d){return api('/api/quizzes',{id:d.id||undefined,title:d.title,grade:d.grade||'',subject:d.subject||'',kind:kind,data:d}).then(function(r){d.id=r.id;d.updated_at=r.updated_at||d.updated_at;return d;});}
function pendingKey(id){return 'tahdir_cards_pending_'+id;}
function restorePending(S){
  try{var raw=localStorage.getItem(pendingKey(S.id));if(!raw)return S;var p=JSON.parse(raw),d=p&&p.data;if(!d||String(d.id)!==String(S.id))return S;
    if(JSON.stringify(S.answers||{})===JSON.stringify(d.answers||{})&&S.cur===d.cur&&S.reveal===d.reveal){localStorage.removeItem(pendingKey(S.id));return S;}
    if((+S.updated_at||0)<=(+p.baseUpdatedAt||0)){d.updated_at=S.updated_at;d.id=S.id;d._pendingRestore=true;toast('استُعيدت إجابات محفوظة على هذا الهاتف لم تصل إلى الخادم بعد.');return d;}
    toast('توجد نسخة محلية أقدم من بيانات الخادم؛ أبقينا الأحدث على الخادم لتجنب استبدال إجابات أخرى.');
  }catch(e){}return S;
}

// ================= إضافة صف =================
function editClass(C){
  C=C||{id:null,title:'',course:cpLs('tahdir_cards_course')||'',subject:'',grade:'',students:[]};
  var rows=C.students.map(function(s){return {full:s.full||s.name,name:s.name};});
  var h='<div class="an-head"><h2>'+(C.id?'طلاب «'+esc(C.title)+'»':'إضافة صف')+'</h2><p class="muted">الصق أسماء الطلاب بترتيب كشف الأسماء (اسم في كل سطر، من Excel أو نور). المنصة تأخذ <b>الاسم الأول والقبيلة</b> فقط ليظهرا مع المسح: «علي بن سالم بن محمد الشامسي» ← «علي الشامسي». رقم الطالب في الكشف هو رقم بطاقته.</p></div>'+
    '<div class="ck-form"><div class="ck-row"><label class="ck-f"><span>اسم الصف</span><input id="cfT" value="'+esc(C.title)+'" placeholder="مثال: العاشر / 2"></label><div class="ck-f"><span>المادة والصف</span>'+coursePick(courses,C.course||cpDefault(courses).key,'cfK')+'</div></div>'+
    '<div class="ck-row ck-names"><label class="ck-f"><span>أسماء الطلاب <small class="muted" id="cfN"></small></span><textarea id="cfL" rows="16" placeholder="علي بن سالم بن محمد الشامسي&#10;أحمد سعيد خلفان الكعبي&#10;…">'+esc(rows.map(function(r){return r.full;}).join('\n'))+'</textarea></label>'+
    '<div class="ck-f"><span>كما تظهر في الكاميرا <small class="muted">(يمكنك تعديل أي اسم)</small></span><div class="ck-pv" id="cfP"></div></div></div>'+
    '<div class="err" id="cfE" hidden></div><div class="an-new"><button type="button" class="btn primary" id="cfSave">💾 حفظ الصف</button><button type="button" class="btn" id="cfBack">رجوع</button></div></div>';
  main(h);
  var cKey=C.course||cpDefault(courses).key;
  bindCoursePick(courses,'cfK',function(k){cKey=k;});
  var edits={};rows.forEach(function(r){if(r.name!==shortName(r.full))edits[r.full]=r.name;});
  function prev(){
    var names=parseNames($('cfL').value);
    $('cfN').textContent='('+names.length+' طالبًا'+(names.length>CARD_MAX?' — الحد الأقصى '+CARD_MAX:'')+')';
    $('cfP').innerHTML=names.length?'<table class="ck-pt">'+names.map(function(f,i){return '<tr><td>'+(i+1)+'</td><td><input data-full="'+esc(f)+'" value="'+esc(edits[f]||shortName(f))+'"></td></tr>';}).join('')+'</table>':'<p class="muted">ستظهر الأسماء هنا.</p>';
    each('[data-full]',function(el){el.oninput=function(){edits[el.getAttribute('data-full')]=el.value.trim();};});
  }
  $('cfL').oninput=prev;prev();
  $('cfBack').onclick=load;
  $('cfSave').onclick=function(){
    var names=parseNames($('cfL').value),e=$('cfE');e.hidden=true;
    if(!$('cfT').value.trim()){e.textContent='اكتب اسم الصف.';e.hidden=false;return;}
    if(!names.length){e.textContent='الصق أسماء الطلاب.';e.hidden=false;return;}
    if(names.length>CARD_MAX){e.textContent='الحد الأقصى '+CARD_MAX+' طالبًا في الصف.';e.hidden=false;return;}
    var c=courses.filter(function(x){return x.key===cKey;})[0];
    var oldOrder=C.students.map(function(s){return s.full||s.name;}).join('\n');
    C.title=$('cfT').value.trim();C.course=cKey;C.subject=c?c.subject:'';C.grade=c?c.grade:'';
    C.students=names.map(function(f,i){return {n:i+1,full:f,name:edits[f]||shortName(f)};});
    cpLs('tahdir_cards_course',cKey);
    var changed=C.id&&oldOrder&&oldOrder!==names.join('\n');
    saveDoc('cclass',C).then(function(){toast('حُفظ الصف');track('cards_class',String(names.length),C.title);TAB='classes';
      dialog({title:'حُفظ «'+C.title+'»',message:(changed?'⚠ تغيّر ترتيب الكشف: رقم بطاقة كل طالب = ترتيبه الجديد، فأعد توزيع البطاقات أو اطبعها من جديد.\n\n':'')+'التالي: اطبع البطاقات ووزّعها — بطاقة رقم 1 لأول طالب في الكشف، وهكذا.',okText:'🖨 طباعة البطاقات',cancelText:'لاحقًا'}).then(function(ok){if(ok)printCards(C);else load();});
    },function(x){e.textContent=x.message;e.hidden=false;});
  };
}

// ================= طباعة البطاقات =================
function printCards(C){
  var opt={per:2,en:/إنجليزي|English/i.test(C.subject||''),nm:true};
  var dp=dialog({title:'طباعة بطاقات «'+C.title+'»',html:'<div class="ck-popt"><label><input type="radio" name="cdps" value="2" checked> بطاقتان في الصفحة <small class="muted">(مثل Plickers — مناسب لأغلب الفصول)</small></label>'+
    '<label><input type="radio" name="cdps" value="1"> بطاقة كبيرة في الصفحة <small class="muted">(للفصول الكبيرة جدًا)</small></label>'+
    '<label><input type="radio" name="cdps" value="4"> 4 بطاقات في الصفحة <small class="muted">(فصل صغير)</small></label>'+
    '<hr><label><input type="checkbox" id="cdpEn"'+(/إنجليزي|English/i.test(C.subject||'')?' checked':'')+'> حروف إنجليزية A B C D</label>'+
    '<label><input type="checkbox" id="cdpNm" checked> اسم الطالب على بطاقته (صغير)</label>'+
    '<p class="muted small">اطبع بحجم 100% (بلا «ملاءمة للصفحة») على ورق أبيض، والأفضل ورق مقوّى. الأبيض والأسود يكفي.</p></div>',okText:'🖨 طباعة',cancelText:'إلغاء'});
  // النافذة تُمسح عند الإغلاق: نقرأ الخيارات أثناء تغييرها
  each('input[name=cdps]',function(r){r.onchange=function(){opt.per=+r.value;};});
  $('cdpEn').onchange=function(){opt.en=this.checked;};$('cdpNm').onchange=function(){opt.nm=this.checked;};
  dp.then(function(ok){
    if(!ok){load();return;}
    var per=opt.per,en=opt.en,nm=opt.nm;
    var sz=per===1?180:per===2?134:92,h='',list=C.students;
    for(var i=0;i<list.length;i+=per){
      h+='<div class="ck-pp ck-pp'+per+'">'+list.slice(i,i+per).map(function(s){return '<div class="ck-pc" style="width:'+sz+'mm;height:'+sz+'mm">'+cardSvg(s.n,{name:nm?s.name:'',en:en})+'</div>';}).join('')+'</div>';
    }
    var half=Math.ceil(list.length/2),tr='';
    for(var j=0;j<half;j++){var a=list[j],b=list[j+half];tr+='<tr><td>'+a.n+'</td><td>'+esc(a.full||a.name)+'</td><td>'+(b?b.n:'')+'</td><td>'+(b?esc(b.full||b.name):'')+'</td></tr>';}
    h+='<div class="ck-pp ck-ppl"><h2 style="text-align:center">توزيع بطاقات «'+esc(C.title)+'»</h2><table class="ck-lt"><tr><th>البطاقة</th><th>الطالب</th><th>البطاقة</th><th>الطالب</th></tr>'+tr+'</table>'+
      '<p style="margin-top:8mm;font-size:12pt">طريقة الإجابة: يمسك الطالب بطاقته بحيث يكون حرف إجابته في <b>الأعلى</b>، ويرفعها مواجهةً للمعلم، ولا يغطي المربع الأسود بأصابعه.</p></div>';
    var ar=$('printArea'),t=document.title;ar.innerHTML=h;document.title=('بطاقات '+C.title).replace(/[\\/:*?"<>|]+/g,'-');document.body.classList.add('printing','ck-printing');
    track('cards_print',String(per),C.title);
    setTimeout(function(){window.print();setTimeout(function(){document.body.classList.remove('printing','ck-printing');ar.innerHTML='';document.title=t;load();},800);},150);
  });
}

// ================= توليد الأسئلة =================
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function generate(C){
  if(!C.students.length){toast('أضف طلاب الصف أولًا');return;}
  main('<div class="welcome"><h2>جارٍ تحميل بنك أسئلة '+esc(courseName(C.course)||C.title)+'…</h2></div>');
  api('/api/quiz/bank?key='+encodeURIComponent(C.course)).then(function(b){
    var pool=(b.items||[]).filter(function(q){return q.type==='mcq'&&q.choices&&q.choices.length>=2&&q.choices.length<=4;});
    var has={};pool.forEach(function(q){has[q.lesson_id]=(has[q.lesson_id]||0)+1;});
    var lessons=(b.lessons||[]).filter(function(l){return has[l.id];});
    if(!lessons.length){main('<div class="welcome"><h2>لا توجد أسئلة اختيار من متعدد لهذا الصف بعد</h2><p><button class="btn" id="gB">رجوع</button></p></div>');$('gB').onclick=load;return;}
    var units={};lessons.forEach(function(l){var k=(l.term||1)+'|'+(l.unit||0);(units[k]=units[k]||{t:l.term||1,u:l.unit,name:l.unit_name||'',ls:[]}).ls.push(l);});
    var sel={},count=10,Q=[];
    var h='<div class="an-head"><h2>✨ توليد أسئلة — '+esc(C.title)+'</h2><p class="muted">'+esc(courseName(C.course))+' · اختر الدروس وعدد الأسئلة، وتُسحب أسئلة اختيار من متعدد عشوائيًا من بنك المنصة.</p></div>'+
      '<div class="ck-form"><div class="ck-f"><span>الدروس</span><div class="ck-units">'+Object.keys(units).map(function(k){var U=units[k];
        return '<details'+(Object.keys(units).length<4||k===Object.keys(units)[0]?' open':'')+'><summary><label><input type="checkbox" data-unit="'+esc(k)+'"> '+(U.t>1?'ف'+U.t+' · ':'')+(U.u?'الوحدة '+U.u+(U.name?': '+esc(U.name):''):'دروس')+'</label></summary><div class="ck-ul">'+U.ls.map(function(l){return '<label><input type="checkbox" data-les="'+l.id+'" data-u="'+esc(k)+'"> '+esc(l.title)+' <small class="muted">('+has[l.id]+')</small></label>';}).join('')+'</div></details>';}).join('')+'</div></div>'+
      '<div class="ck-f"><span>عدد الأسئلة</span><div class="ck-cnts">'+[5,10,15,20].map(function(n){return '<button type="button" class="ck-cn" data-cn="'+n+'" aria-pressed="'+(n===count)+'">'+n+'</button>';}).join('')+'</div></div>'+
      '<div class="an-new"><button type="button" class="btn primary" id="gGen">✨ توليد الأسئلة</button><button type="button" class="btn" id="gBack">رجوع</button></div><div id="gOut"></div></div>';
    main(h);
    each('[data-unit]',function(c){c.onclick=function(e){e.stopPropagation();};c.onchange=function(){var k=c.getAttribute('data-unit');each('[data-u="'+k+'"]',function(x){x.checked=c.checked;});};});
    each('[data-cn]',function(b){b.onclick=function(){count=+b.getAttribute('data-cn');each('[data-cn]',function(x){x.setAttribute('aria-pressed',x===b);});};});
    $('gBack').onclick=load;
    var L=function(id){return lessons.filter(function(l){return l.id===id;})[0];};
    function mk(q){var l=L(q.lesson_id);return {stem:q.stem,choices:q.choices.slice(),correct:q.correct,ao:q.ao||'',qid:q.qid,lesson_id:q.lesson_id,lesson:l?l.title:'',table:q.table||null};}
    function picked(){var ids=[];each('[data-les]:checked',function(c){ids.push(+c.getAttribute('data-les'));});return ids;}
    $('gGen').onclick=function(){
      var ids=picked();if(!ids.length){toast('اختر درسًا واحدًا على الأقل');return;}
      var p=shuffle(pool.filter(function(q){return ids.indexOf(q.lesson_id)>=0;}));
      // توزيع متوازن على الدروس المختارة
      var by={};p.forEach(function(q){(by[q.lesson_id]=by[q.lesson_id]||[]).push(q);});
      var out=[],k=0;while(out.length<count&&out.length<p.length){var lid=ids[k%ids.length];if(by[lid]&&by[lid].length)out.push(by[lid].shift());k++;if(k>count*ids.length*4)break;}
      Q=out.map(mk);draw();
    };
    function draw(){
      var ids=picked();
      $('gOut').innerHTML='<h3 class="an-sub">الأسئلة ('+Q.length+')'+(Q.length<count?' <small class="muted">— المتاح في الدروس المختارة '+Q.length+' فقط</small>':'')+'</h3><ol class="ck-ql">'+Q.map(function(q,i){return '<li><div class="ck-qt">'+esc(q.stem)+'<div class="ck-qc">'+q.choices.map(function(c,k){return '<span'+(k===q.correct?' class="ok"':'')+'>'+LET[k]+') '+esc(c)+'</span>';}).join('')+'</div><small class="muted">'+esc(q.lesson)+'</small></div><span class="ck-qb"><button type="button" class="btn small ghost" data-rep="'+i+'" title="سؤال آخر">🔄</button><button type="button" class="x" data-qx="'+i+'" title="حذف">×</button></span></li>';}).join('')+'</ol>'+
        '<div class="an-new"><button type="button" class="btn primary" id="gGo">▶ بدء الجلسة</button><button type="button" class="btn" id="gAgain">✨ توليد من جديد</button></div>';
      each('[data-qx]',function(b){b.onclick=function(){Q.splice(+b.getAttribute('data-qx'),1);draw();};});
      each('[data-rep]',function(b){b.onclick=function(){var i=+b.getAttribute('data-rep'),used={};Q.forEach(function(q){used[q.qid]=1;});
        var alt=shuffle(pool.filter(function(q){return ids.indexOf(q.lesson_id)>=0&&!used[q.qid];}));if(!alt.length){toast('لا توجد أسئلة أخرى في الدروس المختارة');return;}Q[i]=mk(alt[0]);draw();};});
      $('gAgain').onclick=function(){$('gGen').click();};
      $('gGo').onclick=function(){
        if(!Q.length){toast('لا توجد أسئلة');return;}
        var lt=Q[0].lesson&&Q.every(function(q){return q.lesson===Q[0].lesson;})?Q[0].lesson:'مراجعة';
        var S={id:null,title:lt+' — '+C.title,classId:C.id,className:C.title,course:C.course,subject:C.subject,grade:C.grade,date:today(),questions:Q,answers:{},cur:0,reveal:false};
        saveDoc('csession',S).then(function(){track('cards_session',String(Q.length),S.title);startScreen(S);},function(e){toast(e.message);});
      };
    }
  },function(e){main('<div class="welcome"><h2>تعذّر تحميل الأسئلة</h2><p>'+esc(e.message)+'</p></div>');});
}

// ================= شاشة البدء: الكمبيوتر يعرض والجوال يمسح =================
function startScreen(S){
  var url=scanUrl(S.id),qr='';try{qr=qrSvg(url,220);}catch(e){}
  var h='<div class="an-head"><h2>▶ '+esc(S.title)+'</h2><p class="muted">'+S.questions.length+' سؤالًا · '+esc(S.className||'')+'</p></div>'+
    '<div class="ck-start"><div class="ck-so"><div class="ck-si">🖥</div><h3>اعرض الأسئلة على الكمبيوتر</h3><p class="muted">افتحها على كمبيوتر الفصل (على السبورة). تعرض السؤال والاختيارات وعدد من أجاب، وتتغير تلقائيًا حين تتحكم من الجوال.</p><button type="button" class="btn primary" id="stBoard">🖥 عرض الأسئلة</button></div>'+
    '<div class="ck-so"><div class="ck-si">📱</div><h3>افتح الكاميرا من الجوال</h3><p class="muted">امسح الرمز بكاميرا جوالك (بنفس حسابك في المنصة أو تطبيقها)، أو افتح «الجلسات والنتائج» من الجوال واضغط «متابعة».</p>'+(qr?'<div class="ck-qr">'+qr+'</div>':'')+'<button type="button" class="btn" id="stCopy">🔗 نسخ رابط المسح</button>'+(isPhone()?'<button type="button" class="btn primary" id="stScan">📷 ابدأ المسح بهذا الجوال</button>':'')+'</div></div>'+
    '<div class="an-new"><button type="button" class="btn ghost" id="stBack">رجوع</button></div>';
  main(h);
  $('stBoard').onclick=function(){location.href='/cards'+'?board=1&s='+S.id;};
  $('stCopy').onclick=function(){copyText(url);toast('نُسخ الرابط');};
  if($('stScan'))$('stScan').onclick=function(){openScan(S.id);};
  $('stBack').onclick=function(){TAB='sessions';load();};
}
// المسح بالعرض: إطار الكاميرا الأفقي يرى صفًّا أعرض من الطلاب.
// في التطبيق: يُقفل الاتجاه أفقيًا عبر الجسر. في المتصفح: ملء الشاشة + قفل أفقي (أندرويد)، وإلا تنبيه «أدر الجوال».
function scanLand(on){
  try{if(window.TahdirBridge&&TahdirBridge.setLandscape){TahdirBridge.setLandscape(!!on);return;}}catch(e){}
  try{
    if(on){var el=document.documentElement;if(el.requestFullscreen&&screen.orientation&&screen.orientation.lock&&!document.fullscreenElement)el.requestFullscreen({navigationUI:'hide'}).then(function(){return screen.orientation.lock('landscape');}).catch(function(){});}
    else{if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(function(){});}
  }catch(e){}
}
function openScan(id){
  scanLand(true);
  getDoc(id).then(function(S){S=restorePending(S);return getDoc(S.classId).then(function(C){live(S,C);},function(){toast('الصف المرتبط بالجلسة غير موجود');});});
}

// ================= المسح الحي (الجوال) =================
function live(S,C){
  var restoredPending=!!S._pendingRestore;delete S._pendingRestore;S.answers=S.answers||{};S.cur=Math.min(S.cur||0,S.questions.length-1);S.reveal=false;
  var roster={};C.students.forEach(function(s){roster[s.n]=s.name;});
  var st={stream:null,run:false,maxW:1280,pend:{},showLet:true,mark:false,wake:null,dirty:false,lastPush:0,saveT:null,ms:0,rev:0,saving:false,savePromise:null,retryT:null,retryN:0,liveBusy:false,liveNext:null,liveRetryT:null,liveRetryN:0,closing:false,closed:false,toRes:false,syncText:'جارٍ الاتصال بالسبورة'};
  var o=document.createElement('div');o.className='ck-live';o.id='cdLive';
  o.innerHTML='<div class="ck-lh"><button type="button" class="ck-x" id="lvX" aria-label="إنهاء">✕</button><div class="ck-lq"><b id="lvN"></b><span id="lvQ"></span></div><div class="ck-lc" id="lvC"></div></div>'+
    '<div class="ck-cam" id="lvCam"><video id="lvV" playsinline muted autoplay></video><canvas id="lvO"></canvas><div class="ck-rot" id="lvRot" aria-hidden="true">↻ أدر الجوال بالعرض لترى طلابًا أكثر في الصورة</div><div class="ck-msg" id="lvM">جارٍ تشغيل الكاميرا…</div><div class="ck-ans-popup" id="lvAns" hidden></div><div class="ck-leg" id="lvLeg">🟦 سُجِّلت إجابته · اضغط «أرِني الصح والخطأ» لتراها على جوالك وحدك</div><button type="button" class="ck-markbtn" id="lvMk">✓✗ أرِني الصح والخطأ</button></div>'+
    '<div class="ck-lb"><button type="button" class="btn" id="lvP">→ السابق</button><button type="button" class="btn" id="lvR">👁 الإجابة</button><button type="button" class="btn" id="lvL">👥 <span id="lvLn"></span></button><button type="button" class="btn primary" id="lvNx">التالي ←</button></div>'+
    '<div class="ck-sheet" id="lvSh" hidden></div>';
  document.body.appendChild(o);document.body.classList.add('ck-noscroll');
  var V=$('lvV'),O=$('lvO'),octx=O.getContext('2d'),work=document.createElement('canvas'),wctx=work.getContext('2d',{willReadFrequently:true});
  var ac=null;function beep(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();var os=ac.createOscillator(),g=ac.createGain();os.frequency.value=1200;g.gain.value=0.05;os.connect(g);g.connect(ac.destination);os.start();os.stop(ac.currentTime+0.06);}catch(e){}try{navigator.vibrate&&navigator.vibrate(25);}catch(e){}}
  function A(){return S.answers[S.cur]||(S.answers[S.cur]={});}
  function head(){
    var q=S.questions[S.cur],a=A(),n=Object.keys(a).length,tot=C.students.length;
    $('lvN').textContent='السؤال '+(S.cur+1)+' / '+S.questions.length+(S.reveal?' · الإجابة: '+LET[q.correct]:'');
    $('lvQ').textContent=q.stem;
    var okN=Object.keys(a).filter(function(x){return a[x]===q.correct;}).length;
    $('lvC').innerHTML='<span class="ck-sync-note" id="lvSync" aria-live="polite">'+esc(st.syncText)+'</span><span class="ck-cnt"><b>'+n+'</b> / '+tot+'</span>'+((S.reveal||st.mark)&&n?'<span class="ck-dist ok">✓ '+okN+'</span><span class="ck-dist">✗ '+(n-okN)+'</span>':'');
    $('lvLn').textContent=tot-n?(tot-n)+' بقي':'سُجِّل الكل';
    $('lvP').disabled=S.cur===0;$('lvNx').textContent=S.cur===S.questions.length-1?'إنهاء ✓':'التالي ←';
    $('lvR').textContent=S.reveal?'🙈 إخفاء':'👁 الإجابة';
    // مستطيل منبثق يُظهر الإجابة الصحيحة فوق الكاميرا (خاص بالمعلم على جواله)
    var ap=$('lvAns'),showRW=S.reveal||st.mark;
    if(showRW){ap.innerHTML='<span class="ck-ans-let">'+LET[q.correct]+'</span><span class="ck-ans-txt">'+esc(q.choices[q.correct])+'</span>';ap.hidden=false;ap.className='ck-ans-popup show';}else{ap.hidden=true;ap.className='ck-ans-popup';}
    if(!$('lvSh').hidden)sheet();
    push();
  }
  function sheet(){
    var a=A(),q=S.questions[S.cur];
    $('lvSh').innerHTML='<div class="ck-sh-h"><b>'+esc(C.title)+'</b><button type="button" class="btn small" id="lvShX">إغلاق</button></div><div class="ck-sh-g">'+C.students.map(function(s){var v=a[s.n];
      return '<span class="ck-st'+(v==null?'':' on'+((S.reveal||st.mark)?(v===q.correct?' ok':' no'):''))+'"><i>'+s.n+'</i>'+esc(s.name)+(v!=null&&(S.reveal||st.mark||st.showLet)?' <b>'+LET[v]+'</b>':'')+'</span>';}).join('')+'</div>'+
      '<label class="ck-sh-o"><input type="checkbox" id="lvSL"'+(st.showLet?' checked':'')+'> إظهار حرف كل طالب على الجوال</label>';
    $('lvShX').onclick=function(){$('lvSh').hidden=true;};
    $('lvSL').onchange=function(){st.showLet=this.checked;sheet();};
  }
  // الكمبيوتر (شاشة السبورة) يقرأ هذه الحالة من الخادم كل ثانية تقريبًا
  var pushT=null;
  function setSyncText(t){st.syncText=t;var e=$('lvSync');if(e)e.textContent=t;}
  function liveState(){var q=S.questions[S.cur],a=A();return {t:Date.now(),sid:S.id,title:S.title,cls:C.title,i:S.cur,n:S.questions.length,q:{stem:q.stem,choices:q.choices,table:q.table||null,correct:S.reveal?q.correct:null},reveal:S.reveal,done:Object.keys(a).map(Number),dist:S.reveal?q.choices.map(function(_,k){return Object.keys(a).filter(function(x){return a[x]===k;}).length;}):null,students:C.students.map(function(s){return [s.n,s.name];}),ended:false};}
  function scheduleLiveRetry(){if(st.liveRetryT||!st.liveNext||!navigator.onLine||(st.closed&&!st.liveNext.ended))return;if(st.liveRetryN>=8){setSyncText('تعذّر الاتصال — راجع الاتصال وأعد فتح الشاشة');return;}var ms=Math.min(15000,500*Math.pow(2,Math.min(st.liveRetryN,5)));st.liveRetryN++;st.liveRetryT=setTimeout(function(){st.liveRetryT=null;var x=st.liveNext;st.liveNext=null;if(x)transmitLive(x);},ms);}
  function transmitLive(state){if(st.closed&&!state.ended)return;if(st.liveBusy){st.liveNext=state;return;}st.liveNext=null;clearTimeout(st.liveRetryT);st.liveRetryT=null;st.liveBusy=true;setSyncText(navigator.onLine?'جارٍ المزامنة مع السبورة…':'لا يوجد اتصال — ستُعاد المحاولة تلقائيًا');
    api('/api/cards/live?sid='+encodeURIComponent(S.id),{state:state}).then(function(){st.liveBusy=false;st.liveRetryN=0;if(st.liveNext){var x=st.liveNext;st.liveNext=null;transmitLive(x);}else{setSyncText(state.ended?'انتهت الجلسة':'متصل بالسبورة');if(st.closed)cleanupListeners();}},function(){st.liveBusy=false;if(!st.liveNext)st.liveNext=state;if(navigator.onLine){setSyncText('تعذّر الاتصال — جارٍ إعادة المحاولة');scheduleLiveRetry();}else setSyncText('لا يوجد اتصال — ستُعاد المحاولة تلقائيًا');});
  }
  function push(){clearTimeout(pushT);pushT=setTimeout(function(){transmitLive(liveState());},250);}
  function backupPending(){if(!S.id)return;try{localStorage.setItem(pendingKey(S.id),JSON.stringify({baseUpdatedAt:+S.updated_at||0,data:S}));}catch(e){}}
  function scheduleSaveRetry(){if(st.retryT||!st.dirty||!navigator.onLine||st.closed)return;if(st.retryN>=8){setSyncText('تعذّر حفظ الإجابات — أبقِ الصفحة مفتوحة وأعد الاتصال');return;}var ms=Math.min(30000,1000*Math.pow(2,Math.min(st.retryN,5)));st.retryN++;st.retryT=setTimeout(function(){st.retryT=null;persistNow().catch(scheduleSaveRetry);},ms);}
  function persistNow(){clearTimeout(st.saveT);st.saveT=null;if(!st.dirty)return Promise.resolve(S);if(st.saving)return st.savePromise.then(function(){return st.dirty?persistNow():S;});if(!navigator.onLine)return Promise.reject(new Error('لا يوجد اتصال بالإنترنت'));
    var rev=st.rev,snap=JSON.parse(JSON.stringify(S));st.saving=true;setSyncText('جارٍ حفظ الإجابات…');
    st.savePromise=saveDoc('csession',snap).then(function(saved){st.saving=false;st.retryN=0;clearTimeout(st.retryT);st.retryT=null;if(saved.updated_at)S.updated_at=saved.updated_at;if(st.rev===rev){st.dirty=false;try{localStorage.removeItem(pendingKey(S.id));}catch(e){}}else{st.dirty=true;backupPending();}if(st.dirty)return persistNow();setSyncText('متصل بالسبورة');if(st.closing)finishClose();return S;},function(e){st.saving=false;st.dirty=true;setSyncText('تعذّر حفظ الإجابات — جارٍ إعادة المحاولة');throw e;});return st.savePromise;
  }
  function save(){clearTimeout(st.saveT);st.saveT=setTimeout(function(){persistNow().catch(scheduleSaveRetry);},1500);}
  function markDirty(){if(st.closed||st.closing)return;st.dirty=true;st.rev++;st.retryN=0;clearTimeout(st.retryT);st.retryT=null;backupPending();save();}
  function finishClose(){if(!st.closing||st.closed||st.dirty||st.saving)return;st.closed=true;clearTimeout(st.saveT);clearTimeout(st.retryT);st.saveT=st.retryT=null;stopCam();o.remove();document.body.classList.remove('ck-noscroll');if(SCAN)history.replaceState(null,'',location.pathname);if(st.toRes)results(S);else load();cleanupListeners();}
  function onOnline(){if(st.dirty){clearTimeout(st.retryT);st.retryT=null;st.retryN=0;persistNow().catch(scheduleSaveRetry);}if(st.liveNext){clearTimeout(st.liveRetryT);st.liveRetryT=null;st.liveRetryN=0;var x=st.liveNext;st.liveNext=null;transmitLive(x);}else if(!st.closed&&!st.closing)push();}
  function onOffline(){setSyncText('لا يوجد اتصال — ستُعاد المحاولة تلقائيًا');}
  function onVisibility(){if(document.visibilityState==='hidden'){if(st.dirty)persistNow().catch(scheduleSaveRetry);if(!st.closed&&!st.closing)push();}}
  function cleanupListeners(){if(st.liveBusy||st.liveNext||st.liveRetryT)return;window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);document.removeEventListener('visibilitychange',onVisibility);}
  window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);document.addEventListener('visibilitychange',onVisibility);
  function stopCam(){st.run=false;scanLand(false);if(st.stream){st.stream.getTracks().forEach(function(t){t.stop();});st.stream=null;}try{st.wake&&st.wake.release();}catch(e){}}
  function close(toRes){
    if(st.closing||st.closed)return;st.closing=true;st.toRes=toRes;stopCam();clearTimeout(st.saveT);clearTimeout(pushT);st.saveT=pushT=null;
    transmitLive({t:Date.now(),sid:S.id,title:S.title,ended:true});st.dirty=true;st.rev++;backupPending();persistNow().then(finishClose).catch(function(e){toast('تعذّر الحفظ؛ سنعيد المحاولة تلقائيًا. أبقِ الصفحة مفتوحة واتصل بالإنترنت.');scheduleSaveRetry();});
  }
  $('lvX').onclick=function(){dialog({title:'إنهاء المسح؟',message:'تُحفظ الإجابات، ويمكنك متابعة الجلسة لاحقًا.',okText:'إنهاء وعرض النتائج',cancelText:'متابعة المسح'}).then(function(ok){if(ok)close(true);});};
  $('lvP').onclick=function(){if(S.cur>0){st.prevQ=A();S.cur--;S.reveal=false;st.pend={};st.qStart=Date.now();st.held={};markDirty();head();}};
  $('lvNx').onclick=function(){if(S.cur<S.questions.length-1){st.prevQ=A();S.cur++;S.reveal=false;st.pend={};st.qStart=Date.now();st.held={};markDirty();head();}else close(true);};
  $('lvR').onclick=function(){S.reveal=!S.reveal;markDirty();head();};
  // زر خاص بالمعلم: يُظهر الصح/الخطأ على جوّاله فقط (لا يكشف للطلاب على السبورة)
  $('lvMk').onclick=function(){st.mark=!st.mark;$('lvMk').classList.toggle('on',st.mark);
    $('lvMk').textContent=st.mark?'🙈 إخفاء الصح والخطأ':'✓✗ أرِني الصح والخطأ';
    var lg=$('lvLeg');if(lg)lg.innerHTML=st.mark?'🟩 صح · 🟥 خطأ (تظهر لك وحدك) — «👁 الإجابة» تكشفها للطلاب على السبورة':'🟦 سُجِّلت إجابته · اضغط «أرِني الصح والخطأ» لتراها على جوالك وحدك';
    if(!$('lvSh').hidden)sheet();head();};
  $('lvL').onclick=function(){var sh=$('lvSh');sh.hidden=!sh.hidden;if(!sh.hidden)sheet();};
  head();if(restoredPending)markDirty();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){$('lvM').innerHTML='المتصفح لا يدعم الكاميرا. افتح الصفحة من Chrome أو Safari على الجوال.';return;}
  navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}}).then(function(s){
    st.stream=s;V.srcObject=s;st.run=true;
    try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(function(w){st.wake=w;},function(){});}catch(e){}
    var started=false;function go(){if(started)return;started=true;V.play().catch(function(){});$('lvM').textContent='وجّه الكاميرا نحو بطاقات الطلاب';setTimeout(function(){var m=$('lvM');if(m)m.classList.add('fade');},2500);loop();}
    V.onloadedmetadata=go;if(V.readyState>=1)go();
  },function(e){$('lvM').innerHTML='تعذّر تشغيل الكاميرا: '+esc(e&&e.name==='NotAllowedError'?'لم يُسمح بالوصول. اسمح للموقع باستخدام الكاميرا من إعدادات المتصفح ثم أعد المحاولة.':(e&&e.message||''));});
  function loop(){
    if(!st.run||!document.getElementById('cdLive'))return;
    var t0=performance.now();
    if(V.readyState>=2&&V.videoWidth){
      var sc=Math.min(1,st.maxW/V.videoWidth),w=Math.round(V.videoWidth*sc),h=Math.round(V.videoHeight*sc);
      if(work.width!==w||work.height!==h){work.width=w;work.height=h;O.width=w;O.height=h;}
      wctx.drawImage(V,0,0,w,h);
      var hits=[];try{hits=cardDetect(cardGray(wctx,w,h),w,h);}catch(e){}
      handle(hits);draw(hits);
      st.ms=performance.now()-t0;
      if(st.ms>170&&st.maxW>800)st.maxW-=160;else if(st.ms<60&&st.maxW<1920)st.maxW+=160;
    }
    setTimeout(loop,Math.max(15,100-(performance.now()-t0)));
  }
  // تُسجَّل الإجابة بعد قراءتها نفسها في إطارين متتاليين (منعًا لأي قراءة عابرة)، ويمكن للطالب تغييرها
  // منع الاحتساب المزدوج:
  // • بعد الانتقال لسؤال جديد: بطاقة ما زالت مرفوعة بنفس إجابة السؤال السابق لا تُحتسب حتى يُنزلها الطالب (تختفي ⅔ ثانية) أو يديرها لإجابة أخرى
  // • الإجابة الجديدة تحتاج 3 قراءات متطابقة متتالية، وتغيير إجابة مسجّلة يحتاج 6 (حتى لا تُقرأ البطاقة مائلة وهي تُنزَل)
  function handle(hits){
    var a=A(),changed=false,now=Date.now();
    st.held=st.held||{};var prev=st.prevQ||{};
    var seen={};
    hits.forEach(function(h){
      if(!roster[h.n]||seen[h.n]){h.ok=false;return;}seen[h.n]=1;
      var stale=prev[h.n]===h.ans&&a[h.n]==null;
      if(stale&&(now-(st.qStart||0)<1500||(st.held[h.n]&&now-st.held[h.n]<700))){st.held[h.n]=now;h.ok=false;h.wait=true;return;}
      if(!stale||st.held[h.n])delete st.held[h.n];
      var p=st.pend[h.n];
      if(p&&p.ans===h.ans&&now-p.t<1500){p.c++;p.t=now;}else{p=st.pend[h.n]={ans:h.ans,c:1,t:now};}
      var need=a[h.n]==null?3:6;
      h.ok=p.c>=need||a[h.n]===h.ans;
      if(p.c>=need&&a[h.n]!==h.ans){var isNew=a[h.n]==null;a[h.n]=h.ans;changed=true;if(isNew)beep();}
    });
    if(changed){markDirty();head();}
  }
  function draw(hits){
    octx.clearRect(0,0,O.width,O.height);
    var a=A(),q=S.questions[S.cur],lw=Math.max(2,O.width/400),fs=Math.max(14,O.width/55);
    octx.font='700 '+fs+'px Tajawal,Arial';octx.textAlign='center';octx.textBaseline='bottom';
    hits.forEach(function(h){
      if(!roster[h.n])return;
      // الألوان: برتقالي = جارٍ القراءة · أزرق = سُجِّلت إجابته (ليست صحّة) · عند إظهار الصح/الخطأ: أخضر صح · أحمر خطأ
      // showRW = إظهار الصح والخطأ: إمّا كشف للطلاب (S.reveal) أو عرض خاص بالمعلم على جواله (st.mark)
      var showRW=S.reveal||st.mark;
      var c=h.corners,rec=a[h.n]===h.ans&&h.ok;
      var col=!rec?'#f59e0b':(showRW?(h.ans===q.correct?'#16a34a':'#dc2626'):'#2563eb');
      octx.beginPath();octx.moveTo(c[0][0],c[0][1]);for(var i=1;i<4;i++)octx.lineTo(c[i][0],c[i][1]);octx.closePath();
      octx.lineWidth=lw;octx.strokeStyle=col;octx.stroke();octx.fillStyle=col+'33';octx.fill();
      var mx=(c[0][0]+c[1][0]+c[2][0]+c[3][0])/4,my=Math.min(c[0][1],c[1][1],c[2][1],c[3][1])-4;
      // بلا إظهار: اسم الطالب + حرفه المختار (بلا ✓ حتى لا يُفهَم أنه صحيح). عند الإظهار: ✓ صح / ✗ خطأ
      var mark=!rec?'':(showRW?(h.ans===q.correct?'✓ ':'✗ '):'');
      var label=mark+roster[h.n]+(rec?' · '+LET[h.ans]:'');
      var tw=octx.measureText(label).width+12;octx.fillStyle='rgba(0,0,0,.7)';octx.fillRect(mx-tw/2,my-fs-6,tw,fs+6);
      octx.fillStyle='#fff';octx.fillText(label,mx,my-2);
    });
  }
}

// ================= شاشة السبورة (الكمبيوتر) =================
function board(){
  document.body.classList.add('ck-boardb');
  var o=document.createElement('div');o.className='ck-board';o.innerHTML='<div class="ck-bw" id="bdW"></div><div class="ck-bhelp" id="bdH" hidden><h1>كيف ترفع بطاقتك؟</h1><p>اجعل حرف إجابتك في <b>الأعلى</b>، وارفع البطاقة مواجهةً للمعلم، ولا تغطِّ المربع الأسود بأصابعك.</p>'+holdRow(200)+'</div><div class="ck-bctl"><button type="button" id="bdHelp" title="شرح للطلاب">👨‍🎓</button><button type="button" id="bdFs" title="ملء الشاشة">⛶</button><a href="'+'/cards'+'" title="رجوع">✕</a></div>';
  document.body.appendChild(o);
  $('bdHelp').onclick=function(){var h=$('bdH');h.hidden=!h.hidden;$('bdW').hidden=!h.hidden;};
  $('bdFs').onclick=function(){try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();}catch(e){}};
  var S0=null,last='';
  if(BSID)getDoc(BSID).then(function(s){S0=s;last='';tick(true);},function(){});
  function waiting(s){
    var url=BSID?scanUrl(BSID):'',qr='';try{if(url)qr=qrSvg(url,260);}catch(e){}
    $('bdW').innerHTML='<div class="ck-bwait">'+(S0?'<h1>'+esc(S0.title)+'</h1><p>'+S0.questions.length+' سؤالًا · '+esc(S0.className||'')+'</p>':'<div class="ck-bl">🪪</div><h1>شاشة السبورة</h1>')+
      (s&&s.ended&&s.sid===BSID?'<p class="ck-bend">انتهت الجلسة — النتائج على جوال المعلم وفي «الجلسات والنتائج».</p>':
      (qr?'<div class="ck-bqr">'+qr+'</div><p>امسح الرمز بكاميرا جوالك (بنفس الحساب) لبدء مسح البطاقات.<br>سيظهر السؤال الأول هنا تلقائيًا.</p><p class="ck-bhint">👨‍🎓 لشرح طريقة رفع البطاقة للطلاب اضغط الزر أسفل الشاشة.</p>':'<p>ابدأ الجلسة من جوالك بنفس الحساب، وسيظهر السؤال هنا تلقائيًا.</p>'))+'</div>';
  }
  function tick(once){
    api('/api/cards/live?sid='+encodeURIComponent(BSID||'')).then(function(r){
      var s=r.state,key=JSON.stringify(s||{});if(key===last)return;last=key;
      var mine=s&&!s.ended&&Date.now()-s.t<3*3600*1000&&(!BSID||s.sid===BSID);
      if(!mine){waiting(s);return;}
      var q=s.q,done={};(s.done||[]).forEach(function(n){done[n]=1;});
      var tot=(s.dist||[]).reduce(function(x,y){return x+y;},0);
      $('bdW').innerHTML='<div class="ck-btop"><span>'+esc(s.cls||'')+' · '+esc(s.title||'')+'</span><b>السؤال '+(s.i+1)+' من '+s.n+'</b><span class="ck-bcnt">أجاب '+(s.done||[]).length+' من '+s.students.length+'</span></div>'+
        '<div class="ck-bq">'+esc(q.stem)+'</div>'+(q.table&&q.table.rows?'<table class="ck-btab">'+(q.table.caption?'<caption>'+esc(q.table.caption)+'</caption>':'')+q.table.rows.map(function(rw,i){return '<tr>'+rw.map(function(c){return i?'<td>'+esc(c)+'</td>':'<th>'+esc(c)+'</th>';}).join('')+'</tr>';}).join('')+'</table>':'')+
        '<div class="ck-bch">'+q.choices.map(function(c,k){var m=s.dist?s.dist[k]:0,p=tot?Math.round(m/tot*100):0;
          return '<div class="ck-bc'+(s.reveal?(k===q.correct?' ok':' dim'):'')+'"><span class="ck-bk">'+LET[k]+'</span><span class="ck-bt">'+esc(c)+'</span>'+(s.reveal?'<span class="ck-bp"><i style="width:'+p+'%"></i><b>'+p+'%</b></span>':'')+'</div>';}).join('')+'</div>'+
        '<div class="ck-bst">'+s.students.map(function(x){return '<span class="'+(done[x[0]]?'on':'')+'"><i>'+x[0]+'</i>'+esc(x[1])+'</span>';}).join('')+'</div>';
    },function(){}).then(function(){if(!once)setTimeout(function(){tick();},1000);});
  }
  waiting(null);tick();
}

// ================= النتائج =================
function calc(S,C){
  var Q=S.questions,stu=(C&&C.students||[]).slice().sort(function(a,b){return a.n-b.n;});
  var qs=Q.map(function(q,i){var a=S.answers[i]||{},vals=Object.keys(a).map(function(k){return a[k];}),ok=vals.filter(function(v){return v===q.correct;}).length;return {n:vals.length,ok:ok,p:vals.length?ok/vals.length:0,dist:q.choices.map(function(_,k){return vals.filter(function(v){return v===k;}).length;})};});
  // الأسئلة التي عُرضت فعلًا (أجاب عنها طالب واحد على الأقل): النسبة تُحسب منها، لا من كل الأسئلة المولّدة
  var asked=[];qs.forEach(function(x,i){if(x.n)asked.push(i);});
  var rows=stu.map(function(s){var sc=0,ans=0,cells=Q.map(function(q,i){var a=(S.answers[i]||{})[s.n];if(a==null)return null;ans++;var ok=a===q.correct;if(ok)sc++;return {a:a,ok:ok};});return {n:s.n,name:s.name,full:s.full||s.name,cells:cells,sc:sc,ans:ans,p:asked.length?sc/asked.length:0};});
  var present=rows.filter(function(r){return r.ans>0;});
  return {rows:rows,present:present,qs:qs,asked:asked,avg:present.length?present.reduce(function(x,r){return x+r.p;},0)/present.length:0};
}
function results(S){
  getDoc(S.classId).then(show,function(){show({title:S.className,students:S.roster||[]});});
  function show(C){
    if(C.students&&C.students.length&&!S.roster){S.roster=C.students;}
    var R=calc(S,C),Q=S.questions;
    var h='<div class="an-head"><h2>📊 نتائج «'+esc(S.title)+'»</h2><p class="muted">'+esc(C.title||S.className||'')+' · '+esc(S.date||'')+' · '+(R.asked.length<Q.length?'عُرض '+R.asked.length+' من '+Q.length+' أسئلة':Q.length+' سؤالًا')+' · مُسح '+R.present.length+' من '+R.rows.length+' طالبًا</p></div>'+
      '<div class="ck-sum"><div><b>'+pctS(R.avg)+'</b><small>متوسط الصف</small></div><div><b>'+R.present.filter(function(r){return r.p>=0.8;}).length+'</b><small>80% فأكثر</small></div><div><b>'+R.present.filter(function(r){return r.p<0.5;}).length+'</b><small>دون 50%</small></div><div><b>'+R.qs.filter(function(q){return q.n&&q.p<0.5;}).length+'</b><small>سؤال صعب</small></div></div>'+
      '<div class="an-new"><button type="button" class="btn primary" id="rsAn">📊 إرسال إلى «تحليل النتائج»</button><button type="button" class="btn" id="rsLd">🧩 المتعثرون ← «سجل صعوبات التعلم»</button><button type="button" class="btn" id="rsPr">🖨 طباعة التقرير</button><button type="button" class="btn" id="rsRun">▶ متابعة الجلسة</button><button type="button" class="btn ghost" id="rsBack">رجوع</button></div>'+
      '<div class="ck-tw">'+table(R,Q)+'</div>'+
      '<h3 class="an-sub">الأسئلة</h3><ol class="ck-ql">'+Q.map(function(q,i){var x=R.qs[i];return '<li><div class="ck-qt">'+esc(q.stem)+'<div class="ck-qc">'+q.choices.map(function(c,k){var p=x.n?Math.round(x.dist[k]/x.n*100):0;return '<span'+(k===q.correct?' class="ok"':'')+'>'+LET[k]+') '+esc(c)+' <b>'+p+'%</b></span>';}).join('')+'</div></div><span class="ck-qp '+(x.p>=0.8?'g':x.p>=0.5?'m':'b')+'">'+(x.n?pctS(x.p):'—')+'</span></li>';}).join('')+'</ol>';
    main(h);
    $('rsBack').onclick=function(){TAB='sessions';load();};
    $('rsRun').onclick=function(){startScreen(S);};
    $('rsPr').onclick=function(){printRes(S,C,R);};
    $('rsAn').onclick=function(){toAnalysis(S,C,R);};
    $('rsLd').onclick=function(){toLd(S,C,R);};
  }
}
function table(R,Q){
  return '<table class="ck-rt"><thead><tr><th>#</th><th>الطالب</th>'+Q.map(function(_,i){return '<th>س'+(i+1)+'</th>';}).join('')+'<th>الدرجة</th><th>%</th></tr></thead><tbody>'+
    R.rows.map(function(r){return '<tr'+(r.ans?'':' class="abs"')+'><td>'+r.n+'</td><td class="nm">'+esc(r.name)+'</td>'+r.cells.map(function(c){return c?'<td class="'+(c.ok?'ok':'no')+'" title="'+LET[c.a]+'">'+(c.ok?'✓':'✗ '+LET[c.a])+'</td>':'<td class="na">—</td>';}).join('')+
      '<td><b>'+(r.ans?r.sc+'/'+R.asked.length:'لم يُمسح')+'</b></td><td>'+(r.ans?pctS(r.p):'')+'</td></tr>';}).join('')+'</tbody></table>';
}
function printRes(S,C,R){
  var sh=schoolHdr(),Q=S.questions;
  var h=OFFICIAL_HEAD({dir:sh.dir,school:sh.school,title:'نتائج تقويم بالبطاقات: '+S.title,line2:(C.title||'')+' · '+(S.date||'')+' · العام الدراسي '+sh.year})+
    '<p>عدد الأسئلة: '+R.asked.length+' · الطلاب الذين مُسحت إجاباتهم: '+R.present.length+' من '+R.rows.length+' · متوسط الصف: '+pctS(R.avg)+'</p>'+table(R,Q)+
    '<h3>نسبة الإجابة الصحيحة لكل سؤال</h3><table class="ck-rt"><tr><th>السؤال</th><th>نص السؤال</th><th>الإجابة</th><th>أجاب</th><th>الصواب</th></tr>'+
    Q.map(function(q,i){var x=R.qs[i];return '<tr><td>'+(i+1)+'</td><td class="nm">'+esc(q.stem)+'</td><td>'+LET[q.correct]+'</td><td>'+x.n+'</td><td>'+(x.n?pctS(x.p):'—')+'</td></tr>';}).join('')+'</table>';
  $('printArea').innerHTML='<div class="ck-prr">'+h+'</div>';doPrint('نتائج '+S.title);
}
function toAnalysis(S,C,R){
  var Q=S.questions;
  var A={id:null,title:'تحليل '+S.title,source:'cards',quizId:null,course:S.course||'',subject:S.subject||'',grade:S.grade||'',date:S.date||today(),teacher:me&&me.name||'',threshold:50,
    items:R.asked.map(function(i){var q=Q[i];return {max:1,ao:q.ao||'',lesson:q.lesson||'',lid:q.lesson_id||null,qid:q.qid||null};}),
    students:R.rows.map(function(r){return {name:r.full,s:r.ans?R.asked.map(function(i){var c=r.cells[i];return c&&c.ok?1:0;}):[]};}),notes:null,sugg:{},sig:{senior:'',principal:''}};
  api('/api/quizzes',{title:A.title,grade:A.grade,subject:A.subject,kind:'analysis',data:A}).then(function(r){
    track('cards_to_analysis','',S.title);
    dialog({title:'أُنشئ التحليل ✓',message:'«'+A.title+'» محفوظ في «تحليل نتائج الاختبارات» بكل الإحصاءات (المتوسط، التمييز، مستوى كل مفردة، المتعثرون…).',okText:'فتح التحليل',cancelText:'لاحقًا'}).then(function(ok){if(ok)location.href='/analysis'+'?open='+r.id;});
  },function(e){toast(e.message);});
}
function toLd(S,C,R){
  var low=R.present.filter(function(r){return r.p<0.5;}).sort(function(a,b){return a.p-b.p;});
  var sel={pick:[],reg:'new'};
  api('/api/quizzes?kind=ld').then(function(rr){
    var regs=rr.quizzes||[];
    dialog({title:'إضافة المتعثرين إلى «سجل صعوبات التعلم»',html:(low.length?'<p class="muted small">الطلاب دون 50% في هذه الجلسة (عدّل الاختيار):</p><div class="ck-pick">'+low.map(function(r,i){return '<label><input type="checkbox" data-lw="'+i+'" checked> '+esc(r.full)+' <small class="muted">('+r.sc+'/'+R.asked.length+')</small></label>';}).join('')+'</div>'+
      '<label class="ck-f"><span>السجل</span><select id="ldReg">'+regs.map(function(g){return '<option value="'+g.id+'">'+esc(g.title)+'</option>';}).join('')+'<option value="new">+ سجل جديد: '+esc(C.title||S.className||'')+'</option></select></label><p class="muted small">يُضاف الطالب الجديد إلى السجل، ومن كان فيه تُضاف له ملاحظة متابعة بنتيجة الجلسة.</p>':'<p>لا يوجد طلاب دون 50% في هذه الجلسة 👏</p>'),
      okText:low.length?'إضافة':'حسنًا',cancelText:low.length?'إلغاء':false,
      extra:function(box){var pk=[];Array.prototype.forEach.call(box.querySelectorAll('[data-lw]:checked'),function(c){pk.push(low[+c.getAttribute('data-lw')]);});var rg=box.querySelector('#ldReg');sel={pick:pk,reg:rg?rg.value:'new'};}}).then(function(ok){
      if(!ok||!low.length)return;
      var pick=sel.pick,reg=sel.reg;
      if(!pick.length)return;
      var p=reg==='new'?Promise.resolve({id:null,title:'سجل صعوبات التعلم — '+(C.title||S.className||''),subject:S.subject||'',grade:S.grade||'',section:C.title||'',teacher:me&&me.name||'',year:schoolHdr().year,students:[],sig:{spec:'',principal:''}}):getDoc(reg);
      p.then(function(Rg){
        var note=function(r){return 'تقويم بالبطاقات «'+S.title+'»: '+r.sc+'/'+R.asked.length+' ('+pctS(r.p)+')';};
        var added=0,upd=0;
        pick.forEach(function(r){
          var ex=Rg.students.filter(function(s){var n=(s.name||'').trim();return n===r.full.trim()||n===r.name.trim();})[0];
          if(ex){ex.follow=ex.follow||[];ex.follow.push({d:today(),n:note(r),p:''});upd++;}
          else{Rg.students.push({name:r.full,aspects:[],other:'',level:'',diag:note(r),goalsL:'',goalsS:'',strat:'',accom:'',eval:'',follow:[{d:today(),n:note(r),p:''}]});added++;}
        });
        return api('/api/quizzes',{id:Rg.id||undefined,title:Rg.title,grade:Rg.grade||'',subject:Rg.subject||'',kind:'ld',data:Rg}).then(function(){
          track('cards_to_ld',String(pick.length),S.title);
          dialog({title:'تم ✓',message:(added?'أُضيف '+added+' طالبًا إلى السجل. ':'')+(upd?'أُضيفت ملاحظة متابعة لـ '+upd+' طالبًا موجودًا.':''),okText:'فتح السجل',cancelText:'إغلاق'}).then(function(o){if(o)location.href='/ld';});
        });
      }).catch(function(e){toast(e.message);});
    });
  },function(e){toast(e.message);});
}

// ================= البداية =================
if(BOARD){api('/api/me').then(function(m){me=m;board();});return;}
Promise.all([api('/api/me'),api('/api/courses')]).then(function(r){
  me=r[0];initNav(me);courses=(r[1].courses||[]).filter(function(c){return c.lessons;});
  if(SCAN){openScan(SCAN);load();}else load();
},function(e){main('<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>');});
})();
