// «البحوث الإجرائية»: بحوث جاهزة لكل مادة (العلوم، اللغة العربية، الرياضيات) + «بحوثي»:
// مولّد يكتب بحثًا كاملًا من نموذج يملؤه المعلم ويحسب الإحصاء من درجات القبلي والبعدي (client_rsgen.js).
// البحوث الجاهزة: site/data/research/*.md ← window.RESEARCH. بحوث المعلم: محفوظة في حسابه (نوع research).
(function(){
'use strict';
guard();
var RS=window.RESEARCH||[],G=window.RSGEN,me=null,mine=[],AI_ON=false;
var SUBJECTS=[['العلوم','🔬'],['اللغة العربية','📖'],['الرياضيات','➗']];
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function track(type,detail,title){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,detail:detail||'',title:title||''})});}catch(e){}}
var subj=lsGet('rs_subject')||'العلوم';
if(!SUBJECTS.some(function(s){return s[0]===subj;}))subj='العلوم';

// بحث المعلم ← نفس شكل البحث الجاهز (يُعاد توليده من النموذج في كل فتح فتصله أي تحسينات)
function fromMine(q){var f=q.data.form||{},b=G.build(f);return {id:'u'+q.id,uid:q.id,mine:true,subject:f.subject||q.subject,title:b.title,authors:(f.authors||'').split('\n').filter(Boolean).join(' · '),target:f.target||'',grade:f.grade||'',material:f.material||'',year:f.year||'',html:b.html,form:f};}
function all(){return RS.concat(mine);}
function docHtml(r){
  return '<h1>'+esc(r.title)+'</h1><p class="rs-by">'+esc(r.authors||'')+'</p>'+r.html;
}
// للطباعة وWord: نفس ترويسة الأوراق الرسمية (الشعاران والمديرية والمدرسة) بدل العنوان الكبير
function printDoc(r,word){
  var H=schoolHdr();
  return OFFICIAL_HEAD({dir:H.dir,school:H.school,title:'بحث إجرائي: '+r.title,line2:(r.material||r.subject||'')+(r.grade?' · الصف '+r.grade:'')+(r.year?' · العام الدراسي '+r.year:''),word:word})+
    '<p class="rs-by" style="text-align:center">'+esc(r.authors||'')+'</p>'+r.html;
}
function card(r){
  return '<button type="button" class="rs-card'+(r.mine?' mine':'')+'" data-id="'+esc(r.id)+'"><h3>'+(r.mine?'<span class="rs-tag">بحثي</span> ':'')+esc(r.title)+'</h3>'+
    '<p>'+esc(r.authors||'')+'</p><p>المادة: '+esc(r.material||r.subject)+(r.grade?' · الصف '+esc(r.grade):'')+(r.year?' · '+esc(r.year):'')+'</p>'+(r.target?'<p>الفئة المستهدفة: '+esc(r.target)+'</p>':'')+'</button>';
}
function renderList(){
  var list=all().filter(function(r){return r.subject===subj;});
  var h='<div class="rs-tabs" role="tablist">'+SUBJECTS.map(function(s){
    var n=all().filter(function(r){return r.subject===s[0];}).length;
    return '<button type="button" role="tab" data-s="'+esc(s[0])+'" class="'+(s[0]===subj?'on':'')+'" aria-selected="'+(s[0]===subj)+'">'+s[1]+' '+esc(s[0])+(n?' ('+n+')':'')+'</button>';
  }).join('')+'</div>';
  h+='<div class="rs-new"><button type="button" class="btn primary" id="rsNew">✍️ اكتب بحثًا إجرائيًا جديدًا</button><span class="muted small">املأ نموذجًا قصيرًا ودرجات القبلي والبعدي، فيُكتب البحث كاملًا بفصوله والإحصاء، ويُحفظ في حسابك.</span></div>';
  h+=list.length?list.map(card).join(''):'<div class="rs-empty">لا توجد بحوث إجرائية في «'+esc(subj)+'» بعد. اضغط «اكتب بحثًا إجرائيًا جديدًا» لتبدأ.</div>';
  $('rsMain').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-s]'),function(b){b.onclick=function(){subj=b.getAttribute('data-s');lsSet('rs_subject',subj);renderList();};});
  Array.prototype.forEach.call(document.querySelectorAll('.rs-card'),function(b){b.onclick=function(){openDoc(b.getAttribute('data-id'));};});
  $('rsNew').onclick=function(){renderForm(null);};
}
function openDoc(id){
  var r=all().filter(function(x){return x.id===id;})[0];if(!r)return renderList();
  $('rsMain').innerHTML='<div class="rs-bar"><button type="button" class="btn" id="rsBack">→ رجوع إلى قائمة البحوث</button>'+
    '<button type="button" class="btn primary" id="rsPrint">🖨 طباعة / PDF</button><button type="button" class="btn" id="rsWord">⬇ تحميل Word</button>'+
    (r.mine?'<button type="button" class="btn" id="rsEdit">✎ تعديل البيانات والدرجات</button><button type="button" class="btn danger" id="rsDel">حذف</button>':'')+'</div>'+
    '<article class="rs-doc">'+docHtml(r)+'</article>';
  window.scrollTo(0,0);
  $('rsBack').onclick=function(){renderList();};
  $('rsPrint').onclick=function(){$('printArea').innerHTML='<div class="rs-doc">'+printDoc(r,false)+'</div>';doPrint(r.title);};
  $('rsWord').onclick=function(){
    toast('جارٍ تجهيز ملف Word…');
    var html='<div dir="rtl" style="font-family:Arial;font-size:14pt;line-height:1.7">'+printDoc(r,true).replace(/<table class="rs-t">/g,'<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%">')+'</div>';
    api('/api/export',{format:'doc',name:r.title.slice(0,90),html:html}).then(function(x){
      var a=document.createElement('a');a.href=x.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);
    },function(e){toast(e.message);});
  };
  if(r.mine){
    $('rsEdit').onclick=function(){renderForm(r);};
    $('rsDel').onclick=function(){dialog({title:'حذف البحث؟',message:'سيُحذف البحث من حسابك نهائيًا.',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/quizzes/'+r.uid,null,'DELETE').then(function(){loadMine().then(renderList);});});};
  }
}

// ---------- نموذج المولّد ----------
var DV=['التحصيل الدراسي','فهم المفاهيم العلمية','مهارات القراءة الجهرية','مهارات الكتابة والإملاء','مهارات حل المسائل الرياضية','الدافعية نحو التعلم','مهارات التفكير الناقد','المشاركة الصفية'];
function fld(id,label,v,ph,wide){return '<label class="rsf'+(wide?' wide':'')+'">'+label+'<input class="an-in" id="'+id+'" value="'+esc(v||'')+'" placeholder="'+esc(ph||'')+'"></label>';}
function tfld(id,label,v,ph,rows){return '<label class="rsf wide">'+label+'<textarea class="an-in" id="'+id+'" rows="'+(rows||3)+'" placeholder="'+esc(ph||'')+'">'+esc(v||'')+'</textarea></label>';}
function renderForm(r){
  var H=schoolHdr(),f=r?Object.assign({},r.form):{subject:subj,year:H.year,term:H.term,school:H.school,dir:H.dir,strat:'cmap',weeks:6,mastery:80,authors:'معلم المادة: '+(me&&me.name||'')};
  var h='<div class="rs-bar"><button type="button" class="btn" id="rsBack">→ رجوع</button><b>'+(r?'تعديل البحث':'بحث إجرائي جديد')+'</b></div>'+
   '<section class="qcard rs-form"><h3>١. بيانات البحث</h3><div class="rsf-grid">'+
    '<label class="rsf">المجال<select class="an-in" id="f_subject">'+SUBJECTS.map(function(s){return '<option'+(s[0]===f.subject?' selected':'')+'>'+s[0]+'</option>';}).join('')+'</select></label>'+
    fld('f_material','المادة',f.material,'مثال: الأحياء')+fld('f_grade','الصف',f.grade,'مثال: الحادي عشر')+fld('f_year','العام الدراسي',f.year)+
    fld('f_term','الفصل الدراسي',f.term)+fld('f_school','المدرسة',f.school)+fld('f_target','الفئة المستهدفة',f.target,'مثال: طلاب الصف الحادي عشر / 2',true)+
    fld('f_units','الوحدات أو الدروس',f.units,'مثال: الوحدة الثانية «الجزيئات الحيوية»',true)+
    tfld('f_authors','فريق البحث (كل اسم في سطر)',f.authors,'مشرف المادة: …\nالمعلم الأول: …\nمعلم المادة: …',3)+'</div></section>'+
   '<section class="qcard rs-form"><h3>٢. الاستراتيجية والمشكلة</h3><div class="rsf-grid">'+
    '<label class="rsf wide">الاستراتيجية / الإجراء<select class="an-in" id="f_strat">'+G.STRATS.map(function(s){return '<option value="'+s[0]+'"'+(s[0]===f.strat?' selected':'')+'>'+esc(s[1])+'</option>';}).join('')+'<option value="other"'+(f.strat==='other'?' selected':'')+'>استراتيجية أخرى (أكتبها)</option></select></label>'+
    '<div id="f_otherBox" class="rsf-grid wide"'+(f.strat==='other'?'':' hidden')+'>'+fld('f_stratOther','اسم الاستراتيجية',f.stratOther,'',true)+tfld('f_stratDesc','تعريفها',f.stratDesc,'',2)+tfld('f_stratSteps','خطوات تنفيذها (كل خطوة في سطر)',f.stratSteps,'',3)+'</div>'+
    '<label class="rsf wide">المتغير الذي تريد تحسينه<input class="an-in" id="f_dv" list="dvList" value="'+esc(f.dv||'')+'" placeholder="مثال: التحصيل الدراسي"><datalist id="dvList">'+DV.map(function(d){return '<option value="'+esc(d)+'">';}).join('')+'</datalist></label>'+
    tfld('f_problem','ما الذي لاحظته؟ (الإحساس بالمشكلة) — اختياري',f.problem,'مثال: لاحظت ضعف الطلاب في الربط بين المفاهيم، وانخفاض متوسط الاختبار القصير الأول إلى 55%…',3)+
    fld('f_title','عنوان البحث (اتركه فارغًا لعنوان تلقائي)',f.title,'',true)+'<p class="muted small wide" id="f_titleHint"></p></div></section>'+
   '<section class="qcard rs-form"><h3>٣. التنفيذ والدرجات</h3><div class="rsf-grid">'+
    fld('f_weeks','مدة التنفيذ (أسابيع)',f.weeks)+fld('f_max','الدرجة العظمى للأداة',f.max,'مثال: 30')+fld('f_mastery','حدّ الإتقان %',f.mastery)+
    fld('f_tool','وصف أداة البحث — اختياري',f.tool,'مثال: اختبار تحصيلي من 20 مفردة',true)+
    tfld('f_scores','درجات الطلاب: لكل طالب سطر فيه «القبلي البعدي» — تقدر تلصقهما من Excel',f.scores,'12  18\n15  20\n9  14',7)+
    '<p class="muted small wide" id="f_stats"></p></div>'+
    (AI_ON?'<label class="rsf wide ai-opt"><span><input type="checkbox" id="f_ai"'+(f.ai||!r?' checked':'')+'> ✨ اكتب المقدمة والإطار النظري ومناقشة النتائج بالذكاء الاصطناعي، مخصّصة لمادتك وصفّك ونتائجك</span><small class="muted">بلا مراجع أو دراسات مخترعة — المراجع من القائمة الموثّقة فقط. راجع النص قبل الاعتماد.</small></label>':'')+
    '<div class="rs-bar"><button type="button" class="btn primary" id="rsGen">✍️ اكتب البحث واحفظه</button><span class="muted small">يُحفظ في حسابك ويظهر في «'+esc(f.subject||subj)+'».</span></div></section>';
  $('rsMain').innerHTML=h;window.scrollTo(0,0);
  var ids=['subject','material','grade','year','term','school','target','units','authors','strat','stratOther','stratDesc','stratSteps','dv','problem','title','weeks','max','mastery','tool','scores'];
  var read=function(){ids.forEach(function(k){var el=$('f_'+k);if(el)f[k]=el.value;});f.dir=f.dir||H.dir;return f;};
  var live=function(){read();$('f_otherBox').hidden=f.strat!=='other';$('f_titleHint').textContent=f.title?'':'العنوان التلقائي: '+G.titleOf(f);
    var A=G.analyze(f);$('f_stats').textContent=A?('عدد الطلاب '+A.n+' · متوسط القبلي '+A.pre.m.toFixed(2)+' · متوسط البعدي '+A.post.m.toFixed(2)+' · t = '+(isFinite(A.t)?A.t.toFixed(2):'—')+' · p '+(A.p<0.001?'< 0.001':'= '+A.p.toFixed(3))+(A.sig?' (دال)':' (غير دال)')):'أدخل درجات طالبين على الأقل لتظهر الإحصاءات.';};
  ids.forEach(function(k){var el=$('f_'+k);if(el){el.oninput=live;el.onchange=live;}});live();
  $('rsBack').onclick=function(){if(r)openDoc(r.id);else renderList();};
  $('rsGen').onclick=function(){
    read();if(!f.grade||!(f.material||f.subject)){toast('اكتب المادة والصف على الأقل');return;}
    var t=G.titleOf(f),btn=this;
    var useAI=$('f_ai')&&$('f_ai').checked;
    var pre=useAI?(function(){
      btn.disabled=true;btn.textContent='✨ جارٍ الكتابة بالذكاء الاصطناعي…';
      var A=G.analyze(f),st=A?{n:A.n,pre:A.pre.m.toFixed(2),post:A.post.m.toFixed(2),t:isFinite(A.t)?A.t.toFixed(2):'—',p:A.p<0.001?'< 0.001':A.p.toFixed(3),sig:A.sig,eta:A.eta.toFixed(2)}:null;
      return api('/api/ai/research',{form:Object.assign({},f,{title:t,stratName:G.stratName(f),stats:st})}).then(function(x){f.ai=x;},function(e){toast(e.message);});
    })():Promise.resolve((function(){if(!useAI)delete f.ai;})());
    pre.then(function(){btn.disabled=false;btn.textContent='✍️ اكتب البحث واحفظه';
    api('/api/quizzes',{id:r?r.uid:null,title:t,grade:f.grade,subject:f.subject,kind:'research',data:{form:f}}).then(function(x){
      track('research_gen',f.strat,t);subj=f.subject;lsSet('rs_subject',subj);
      loadMine().then(function(){openDoc('u'+x.id);toast('كُتب البحث وحُفظ في حسابك ✓');});
    },function(e){toast(e.message);});
    });
  };
}
function loadMine(){
  return api('/api/quizzes?kind=research').then(function(r){
    return Promise.all((r.quizzes||[]).map(function(q){return api('/api/quizzes/'+q.id).then(function(x){return fromMine(x.quiz);},function(){return null;});}));
  }).then(function(l){mine=(l||[]).filter(Boolean);},function(){mine=[];});
}
api('/api/me').then(function(m){me=m;initNav(m);api('/api/ai/status').then(function(x){AI_ON=!!x.on;},function(){});return loadMine();}).then(renderList,function(){renderList();});
renderList();
})();
