(function(){
'use strict';
guard();
var GRADE_ORDER=['الصف الخامس','الصف السادس','الصف السابع','الصف الثامن','الصف التاسع','الصف العاشر','الصف الحادي عشر','الصف الثاني عشر','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الأول الثانوي','الثاني الثانوي','الثالث الثانوي','المسار العام'];
function ckey(l){return (l.subject||'')+'|'+l.grade;}
var LEGACY_SUBJ={'':1,'الأحياء':1,'العلوم':1,'اللغة الإنجليزية':1};
function toolMin(l,v){return LEGACY_SUBJ[l.subject||'']?v:'3.4.0';}
function isEn(l){return /انجليز|إنجليز|English/i.test(l.subject||'');}
// المواد: كل معلم يختار مادته ثم تظهر صفوفها
var SUBJ_ICON={'العلوم':'🔬','الأحياء':'🧬','الكيمياء':'⚗️','الفيزياء':'🧲','العلوم البيئية':'🌍','اللغة الإنجليزية':'🔤','اللغة العربية':'📖','الرياضيات':'➗','الدراسات الاجتماعية':'🗺️','تقنية المعلومات':'💻','التربية الإسلامية':'🕌'};
var SUBJ_ORDER=['العلوم','الأحياء','الكيمياء','الفيزياء','العلوم البيئية','الرياضيات','الرياضيات الأساسية','الرياضيات المتقدمة','اللغة العربية','اللغة الإنجليزية','الدراسات الاجتماعية','التربية الإسلامية','تقنية المعلومات'];
var subj=null;try{subj=localStorage.getItem('tahdir_subject');}catch(e){}
var searchQ='';
// تطبيع عربي خفيف للبحث: همزات/تاء مربوطة/ألف مقصورة/همزة وصل تبدل، ويطوّع التشكيل والمسافات
function normAr(t){return String(t||'').replace(/[\u064B-\u0652\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/[ىئي]/g,'ي').replace(/ؤ/g,'و').replace(/\s+/g,' ').trim().toLowerCase();}
function subjOf(l){return l.subject||'';}
function subjIcon(s){return SUBJ_ICON[s]||'📘';}
function subjects(){var s={};lessons.forEach(function(l){s[subjOf(l)]=1;});return Object.keys(s).sort(function(a,b){var x=SUBJ_ORDER.indexOf(a),y=SUBJ_ORDER.indexOf(b);return (x<0?99:x)-(y<0?99:y)||a.localeCompare(b,'ar');});}
var GRADE_NUM={'الأول':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
function gradeNum(g){return GRADE_NUM[String(g||'').replace(/^الصف\s+/,'').trim()]||0;}
// بعض الملفات تكتب الصف «الصف التاسع» وبعضها «التاسع»؛ نعرضه بصيغة واحدة دائمًا
function gradeLabel(g){return String(g||'').replace(/^الصف\s+/,'').trim();}
function gradeRange(s){var g=lessons.filter(function(l){return subjOf(l)===s;}).map(function(l){return gradeNum(l.grade);}).filter(function(n){return n>0;});if(!g.length)return '';var a=Math.min.apply(null,g),b=Math.max.apply(null,g);return a===b?'الصف '+String(l_name(a)):'الصفوف '+a+'–'+b;}
function l_name(n){for(var k in GRADE_NUM){if(GRADE_NUM[k]===n)return k;}return n;}
function inGroup(l){var ss=subjects();if(ss.length<2)return true;return subjOf(l)===subj;}
var me=null,lessons=[],currentId=null,openGrades={},openUnits={},viewed={};
// ---------- القيم الثابتة: لكل مادة قيمها الخاصة ----------
// السبب: التربية الإسلامية تحتاج «المصحف» و«القصة النبوية» في المصادر، بينما الأحياء
// تحتاج «المجهر» و«الشرائح»، فالقيم الثابتة الواحدة لا تصلح للجميع.
// DEF_SETTINGS = الافتراضي لأي مادة · SUBJ_SETTINGS = قيم مادة بعينها (تُدمج فوق الافتراضي).
var DEF_SETTINGS={level:['التذكُّر','الإبداع'],strategies:['الحوار والمناقشة','التعلم التعاوني','التعلم التشاركي','التعلم الذاتي'],resources:['الكتاب','السبورة التقليدية','جهاز عرض البيانات','الوسائط المتعددة (سمعية - بصرية)']};
var SUBJ_SETTINGS={
  'التربية الإسلامية':{
    strategies:['الحوار والمناقشة','التعلم التعاوني','القصة','الخرائط الذهنية'],
    resources:['كتاب الطالب','المصحف','القصة النبوية والسيرة','بطاقات الأنشطة والرسومات','جهاز عرض البيانات','لوحة الكلمات القرآنية']
  }
};
function subjKeyOf(s){s=String(s||'الافتراضي');return 'tahdir_settings_v2:'+s;}
function baseSettingsFor(s){return Object.assign(JSON.parse(JSON.stringify(DEF_SETTINGS)),SUBJ_SETTINGS[s]||{});}
// المادة النشطة: المختارة في الشريط، أو مادة الدرس المفتوح، أو أول مادة متاحة
function activeSubject(){
  try{ if(typeof subj!=='undefined'&&subj)return subj; }catch(e){}
  if(typeof currentId!=='undefined'&&currentId!=null){
    var l=(lessons||[]).filter(function(x){return String(x.id)===String(currentId);})[0];
    if(l&&typeof subjOf==='function')return subjOf(l);
  }
  return (typeof subjects==='function'&&subjects()[0])||'الافتراضي';
}
var settings=null,_setSubj=null; var GLOBAL_SET={hwMark:null};
function useSettingsFor(s){
  var k=String(s||'الافتراضي');
  if(_setSubj===k&&settings)return settings;
  var st=lsGet(subjKeyOf(k));
  settings=Object.assign(baseSettingsFor(k),st||{});
  _setSubj=k;
  return settings;
}
function saveSettings(){ if(settings)lsSet(subjKeyOf(_setSubj),settings); }
function settingsForSubject(s){useSettingsFor(s);}
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function editsKey(){return 'tahdir_edits_'+me.username;}
var ESSENTIAL=[
  {key:'concepts',label:'المفاهيم',icon:'mol'},
  {key:'pre_learning',label:'التهيئة / التمهيد / التعلم القبلي',icon:'seed'},
  {key:'activities_teach',label:'إجراءات سير الدرس / الأنشطة التدريسية',icon:'scope'},
  {key:'strategies',label:'الاستراتيجيات كما وردت في ملف التحضير',icon:'seed',note:'خاصة بهذا الدرس — تظهر في قائمة الاستراتيجيات عند النسخ إلى نور'},
  {key:'resources',label:'الوسائل ومصادر التعلم',icon:'scope',note:'خاصة بهذا الدرس — تُختار تلقائيًا في نور'},
  {key:'formative',label:'التقويم التكويني',icon:'cell'},
  {key:'closing',label:'التقويم الختامي',icon:'leaf'},
  {key:'homework',label:'الأنشطة والمهام المنزلية',icon:'flask'},
  {key:'outcomes',label:'المخرجات التعليمية',icon:'dna',note:'تُعلَّم كلها تلقائيًا في نور'},
  {key:'weekly',label:'ملاحظات ضمن خطة الدراسة الأسبوعية',icon:'seed',note:'يشاهدها الطالب وولي الأمر'}
];
var EN_LABEL={strategies:'Strategies',resources:'Teaching aids & resources'};
var EXTRA=[
  {key:'enrich',label:'نشاط إثرائي / علاجي (تفريد التعليم)'},
  {key:'misconceptions',label:'المفاهيم الخاطئة وسوء الفهم'}
];
var ICONS={
  dna:'<path d="M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12s10 6 10 6"/><path d="M8.5 7h7M8.5 17h7M10 12h4"/>',
  cell:'<ellipse cx="12" cy="12" rx="9" ry="7.5"/><circle cx="13" cy="11" r="3"/><circle cx="13" cy="11" r=".9" fill="currentColor"/><path d="M6 14.5c1-.8 2-.8 3 0"/>',
  leaf:'<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 14 10"/>',
  mol:'<circle cx="6" cy="7" r="2.3"/><circle cx="18" cy="7" r="2.3"/><circle cx="12" cy="17" r="2.3"/><path d="M8 8.3l2.7 6.6M16 8.3l-2.7 6.6M8.3 7h7.4"/>',
  seed:'<path d="M12 21v-8"/><path d="M12 13c-4 0-6-3-6-7 4 0 6 3 6 7z"/><path d="M12 11c0-4 2-6 6-6 0 4-2 6-6 6z"/>',
  scope:'<path d="M6 21h12M9 21v-3h6v3M10 18l-1-3 5-9 3 1.6-5 9"/><path d="M13.5 4.5l1.3-2.2 3 1.7-1.3 2.2"/><path d="M15 17a5 5 0 0 0 3-7"/>',
  flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>'
};
function icon(n){return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[n]||'')+'</svg>';}
function track(type,l,detail){
  try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,lesson_id:l&&l.id,detail:detail||''})});}catch(e){}
}
function grades(){var s={},out=[];lessons.forEach(function(l){if(!inGroup(l))return;var k=ckey(l);if(!s[k]){s[k]=1;out.push(k);}});
  return out.sort(function(a,b){var x=a.split('|'),y=b.split('|');var gi=GRADE_ORDER.indexOf(x[1]),gj=GRADE_ORDER.indexOf(y[1]);return (gi-gj)||x[0].localeCompare(y[0],'ar');});}
function multiSubj(){var s={};lessons.forEach(function(l){s[l.subject||'']=1;});return Object.keys(s).length>1;}
function unitsOf(g){var s={};lessons.forEach(function(l){if(ckey(l)===g)s[l.unit]=1;});return Object.keys(s).sort(function(a,b){return parseInt(a,10)-parseInt(b,10);});}
function lessonsOf(g,u){return lessons.filter(function(l){return ckey(l)===g&&String(l.unit)===String(u);}).sort(function(a,b){return (a.lesson_no||0)-(b.lesson_no||0)||a.id-b.id;});}
function isEmpty(l){return !(l.pre_learning||l.outcomes||l.activities_teach);}

function renderTree(){
  var tree=$('tree'),ss=subjects();
  if(ss.length>1&&ss.indexOf(subj)<0)subj=ss[0];
  tree.innerHTML='<button type="button" class="btn small home-back" id="homeBackBtn">🏠 الرئيسية</button>'+'<div class="srch" style="margin:2px 0 10px"><input id="lesSearch" type="search" style="width:100%;box-sizing:border-box;padding:8px 11px;border:1.5px solid var(--line,#d4e5de);border-radius:10px;font:inherit;background:var(--paper,#fff)" placeholder="🔎 ابحث بدرس… (عنوان أو كلمة أو رقم)" value="'+esc(searchQ)+'" aria-label="البحث في الدروس"></div>'+(ss.length>1?'<label class="subj-pick"><span class="subj-ic" aria-hidden="true">'+subjIcon(subj)+'</span><span class="subj-l">المادة</span><select id="subjSel" aria-label="اختر المادة">'+ss.map(function(x){return '<option value="'+esc(x)+'"'+(x===subj?' selected':'')+'>'+esc(x)+' · '+esc(gradeRange(x))+'</option>';}).join('')+'</select></label>':'')+'<h2 class="tree-h">'+(ss.length>1?subjIcon(subj)+' '+esc(subj):'الكتاب المدرسي')+'</h2>';
  if($('lesSearch')){
    $('lesSearch').oninput=function(){
      searchQ=this.value;renderTree();
      var n=$('lesSearch');
      if(n){try{n.focus();n.setSelectionRange(n.value.length,n.value.length);}catch(e){}}
    };
  }
  if($('subjSel'))$('subjSel').onchange=function(){subj=this.value;try{localStorage.setItem('tahdir_subject',subj);}catch(e){}renderTree();};
  if($('homeBackBtn'))$('homeBackBtn').onclick=function(){showHome();};
  // أثناء البحث: نعرض نتائج البحث وحدها بدل الشجرة الكاملة، حتى لا يشتّت الشاشة
  if(!searchQ.trim()){grades().forEach(function(g){
    var gDiv=document.createElement('div');gDiv.className='g-block';
    var count=lessons.filter(function(l){return ckey(l)===g;}).length,gp=g.split('|');
    var gBtn=document.createElement('button');gBtn.className='g-btn';gBtn.type='button';
    gBtn.innerHTML='<span class="g-name">الصف '+esc(gradeLabel(gp[1]))+'</span><span class="g-meta">'+count+' درس <span class="chev">▾</span></span>';
    var gBody=document.createElement('div');gBody.className='g-body';
    if(openGrades[g]||lessons.some(function(l){return l.id===currentId&&ckey(l)===g;}))gBody.classList.add('open');
    unitsOf(g).forEach(function(u){
      var ls=lessonsOf(g,u),key=g+'|'+u;
      var uDiv=document.createElement('div');uDiv.className='u-block';
      var uBtn=document.createElement('button');uBtn.className='u-btn';uBtn.type='button';
      var uName=(ls[0]&&ls[0].unit_name)||'';
      uBtn.innerHTML='<span class="u-num">'+esc(u)+'</span><span class="u-name">'+(uName?esc(uName):'الوحدة '+esc(u))+'</span><span class="u-badge">'+ls.length+'</span>';
      var lList=document.createElement('div');lList.className='l-list';
      if(openUnits[key]||ls.some(function(l){return l.id===currentId;}))lList.classList.add('open');
      ls.forEach(function(l){
        var b=document.createElement('button');b.type='button';var e=isEmpty(l);
        b.className='l-item'+(l.id===currentId?' active':'')+(e?' empty':'');
        b.innerHTML='<span>'+esc(l.title||'(بدون عنوان)')+'</span>'+(e?'<span class="l-flag">فارغ</span>':'');
        b.onclick=function(){selectLesson(l.id);};lList.appendChild(b);
      });
      uBtn.onclick=function(){openUnits[key]=!lList.classList.contains('open');lList.classList.toggle('open');};
      uDiv.appendChild(uBtn);uDiv.appendChild(lList);gBody.appendChild(uDiv);
    });
    gBtn.onclick=function(){openGrades[g]=!gBody.classList.contains('open');gBody.classList.toggle('open');};
    gDiv.appendChild(gBtn);gDiv.appendChild(gBody);tree.appendChild(gDiv);
  });
  }
  // نتائج البحث: دروس مطابقة من كل المواد والصفوف، بفتح الدرس مباشرة بضغطة واحدة
  if(searchQ.trim()){
    var q=normAr(searchQ),hits=lessons.filter(function(l){return normAr((l.title||'')+' '+(l.unit_name||'')+' درس '+(l.lesson_no||'')).indexOf(q)>=0;}).slice(0,40);
    var res=document.createElement('div');res.className='tree-res';
    res.innerHTML='<div style="font-weight:800;margin:14px 2px 6px;color:var(--mute,#58726a);font-size:.88em">'+(hits.length?('نتائج البحث: '+hits.length+' درسًا'+(hits.length===40?' (الحد الأقصى للعرض)':'')):'لا توجد دروس بهذا البحث — جرّب كلمة قصيرة')+'</div>'+
      hits.map(function(l){return '<button type="button" class="l-item" data-sid="'+esc(l.id)+'"><span>'+esc(l.title||'(بدون عنوان)')+'</span><span style="color:var(--mute,#58726a);font-size:.78em;white-space:nowrap">'+esc(gradeLabel(l.grade))+(l.unit?' · و '+esc(l.unit):'')+'</span></button>';}).join('');
    tree.appendChild(res);
    Array.prototype.forEach.call(res.querySelectorAll('[data-sid]'),function(b){b.onclick=function(){
      var l=lessons.filter(function(x){return String(x.id)===b.getAttribute('data-sid');})[0];if(!l)return;
      subj=subjOf(l)||subj;try{localStorage.setItem('tahdir_subject',subj);}catch(e){}
      selectLesson(l.id);
    };});
  }
}
function linksOf(t){
  var m=String(t||'').match(/https?:\/\/[^\s)<>"]+/g);if(!m)return '';
  var u=[];m.forEach(function(x){x=x.replace(/[.,،]+$/,'');if(u.indexOf(x)<0)u.push(x);});
  return '<div class="links">'+u.map(function(x){var host=x.replace(/^https?:\/\//,'').split('/')[0].replace(/^www\./,'');return '<a href="'+esc(x)+'" target="_blank" rel="noopener noreferrer">فتح الرابط: '+esc(host)+'</a>';}).join('')+'</div>';
}
var EN_LABEL={concepts:'Concepts',pre_learning:'Warm-up',activities_teach:'Lesson Procedures',formative:'Formative Assessment',closing:'Closing Assessment',homework:'Homework',outcomes:'Objectives',weekly:'Weekly Study Plan Comments (Arabic, for parents)',strategies:'Strategies',resources:'Resources',enrich:'Enrichment / Remedial',misconceptions:'Common Mistakes'};
function fieldBlock(l,f,ess){
  if(isEn(l)&&EN_LABEL[f.key])f={key:f.key,icon:f.icon,note:f.key==='outcomes'?'Noor ticks all lesson outcomes automatically':f.key==='weekly'?'':f.note,label:EN_LABEL[f.key]+' · '+f.label};
  var admin=me.role==='admin';
  return '<section class="sec'+(ess?' ess':' extra')+'">'+
    '<div class="sec-head"><h3>'+(ess?icon(f.icon):'')+'<span>'+esc(isEn(l)&&EN_LABEL[f.key]?EN_LABEL[f.key]:f.label)+'</span></h3>'+(f.note?'<span class="sec-note">'+esc(f.note)+'</span>':'')+
    ((l.ai_filled||[]).indexOf(f.key)>=0?'<span class="sugg" title="كتبها المساعد لاكتمال التحضير">مقترح</span>':'')+'</div>'+
    '<textarea class="field" dir="auto" id="f_'+f.key+'" spellcheck="false">'+esc(l[f.key]||'')+'</textarea>'+linksOf(l[f.key])+
    '<div class="sec-actions"><button type="button" class="btn small primary" data-copy="'+f.key+'">نسخ</button>'+
    '<button type="button" class="btn small" data-save="'+f.key+'">'+(admin?'حفظ للجميع':'حفظ على جهازي')+'</button></div></section>';
}
function buildCopyAll(l){
  if(isEn(l)||l.subject==='اللغة العربية'){ // تحضير الإنجليزي بالإنجليزية بالكامل
    var e='Title:\n'+(l.title||'')+'\n\nStrategies: '+(l.strategies||'')+'\nResources: '+(l.resources||'')+'\n\n';
    [['concepts','Concepts'],['pre_learning','Warm-up'],['activities_teach','Lesson Procedures'],['formative','Formative Assessment'],['closing','Closing Assessment'],['homework','Homework'],['outcomes','Objectives']].forEach(function(f){e+='— '+f[1]+' —\n'+(l[f[0]]||'')+'\n\n';});
    return e.trim();
  }
  var out='العنوان:\n'+(l.title||'')+'\n\n';
  if(isEn(l))out+='Strategies: '+(l.strategies||'')+'\nResources: '+(l.resources||'')+'\n\n';
  else out+='المستوى: '+settings.level.join('، ')+'\nالاستراتيجيات: '+settings.strategies.join('، ')+'\nالمصادر التعليمية: '+settings.resources.join('، ')+'\n\n';
  ESSENTIAL.forEach(function(f){if(f.key==='weekly'&&!l.weekly)return;out+='— '+f.label+' —\n'+(l[f.key]||'')+'\n\n';});
  return out.trim();
}
function lessonFieldValue(l,k){var e=$('f_'+k);return e?e.value:String(l&&l[k]||'');}
function buildCopyJson(l){
  useSettingsFor(subjOf(l));   // القيم الثابتة لمادة هذا الدرس: لكل مادة قيمها الخاصة
  var c=function(k){return lessonFieldValue(l,k);};
  var pre=c('pre_learning'),preOnly=(pre.match(/(^|\n)\s*التعلم القبلي\s*[:：][^\n]*/)||[''])[0].trim();
  var objective='';
  if(isEn(l)){objective=c('outcomes').split('\n').map(function(x){return x.replace(/^[•◆\-\s]+/,'').trim();}).filter(Boolean).join('\n');}
  else if(l.grade==='الخامس'){ // عبارات «أستطيع أن» تُكتب في خانة «إضافة مخرج تعليمي آخر»
    var ol=c('outcomes').split('\n').map(function(x){return x.trim();}).filter(Boolean);
    var main=ol.filter(function(x){return !/^5E/i.test(x);});if(!main.length)main=ol;
    objective=main.map(function(x){return x.replace(/^[0-9A-Za-z]+\s*[:：]\s*/,'');}).join('\n');
  }
  return JSON.stringify({source:'tahdir-al-aali',kind:'prep',title:l.title||'',grade:l.grade,subject:l.subject||'',unit:String(l.unit),unit_name:l.unit_name||'',lesson_no:lessonNo(l),term:+l.term||1,
    objective:objective,
    fields:{lesson_vocabulary:c('concepts'),description:pre,pre_learning:preOnly||pre,thinking_skills:c('activities_teach'),
    formative_assessment:c('formative'),closing_assessment:c('closing'),activities:c('homework'),weekly_study_plan_comments:c('weekly')},tick_all_outcomes:true,
    selects:{taxonomies:settings.level,strategies:(l.sel_strategies&&l.sel_strategies.length)?l.sel_strategies:settings.strategies,teaching_aids:(l.sel_resources&&l.sel_resources.length)?l.sel_resources:settings.resources}});
}
function saveField(l,k,v,btn){
  if(me.role==='admin'){
    var payload={};payload[k]=v;
    return api('/api/admin/lessons/'+l.id,payload).then(function(){l[k]=v;dropSugg(l,k,btn);renderTree();toast('حُفظ للجميع');},function(e){toast(e.message);});
  }
  var ed=lsGet(editsKey())||{};ed[l.id]=ed[l.id]||{};ed[l.id][k]=v;lsSet(editsKey(),ed);
  l[k]=v;dropSugg(l,k,btn);renderTree();toast('حُفظ على جهازك');
}
function dropSugg(l,k,btn){if(l.ai_filled)l.ai_filled=l.ai_filled.filter(function(x){return x!==k;});var s=btn&&btn.closest('.sec');var tg=s&&s.querySelector('.sugg');if(tg)tg.remove();}
var lessonTab='prep';
function isMcq(l){return l.hw_type==='mcq';}
function hwBlock(l){
  var admin=me.role==='admin',mcq=isMcq(l),h='<div class="copybar"><div class="copybar-text"><strong>'+(mcq?'واجب اختيار من متعدد: سؤالان بأربعة اختيارات':'واجب مقالي من سؤالين')+'</strong><span>اضغط «إرسال الواجب إلى نور» ونور مفتوحة: تُفتح صفحة إضافة المهمة لهذا الصف وتُجهَّز تلقائيًا، احفظها، ثم تُضاف الأسئلة في «إضافة مجموعة مفردات دفعة واحدة».</span></div>'+
    '<div class="copybar-btns"><button type="button" class="btn primary" id="sendHwBtn">إرسال الواجب إلى نور</button><button type="button" class="btn" id="copyHwBtn">نسخ للأداة</button><button type="button" class="btn" id="copyHwTxt">نسخ كنص</button></div></div>'+
    '<div class="hw-mark"><label for="hwMark">درجة كل سؤال</label><input id="hwMark" type="number" min="0" step="0.5" value="'+esc(settings.hwMark==null?1:settings.hwMark)+'"></div><div class="secs">';
  [1,2].forEach(function(n){
    h+='<section class="sec ess"><div class="sec-head"><h3>'+icon(n===1?'seed':'leaf')+'<span>السؤال '+n+'</span></h3><span class="sugg" title="كتبه المساعد من محتوى الدرس">مقترح</span></div>'+
      '<textarea class="field" dir="auto" id="f_hw_q'+n+'" spellcheck="false">'+esc(l['hw_q'+n]||'')+'</textarea>'+
      '<div class="sec-head" style="margin-top:10px"><h3 style="font-size:.86rem;color:var(--mute)"><span>'+(mcq?'الاختيارات الأربعة: السطر الأول هو الإجابة الصحيحة (يُخلط ترتيبها تلقائيًا عند الإرسال)':'الإجابة النموذجية')+'</span></h3></div>'+
      '<textarea class="field" dir="auto" id="f_hw_a'+n+'" spellcheck="false">'+esc(l['hw_a'+n]||'')+'</textarea>'+
      '<div class="sec-actions"><button type="button" class="btn small primary" data-copy="hw_q'+n+'">نسخ السؤال</button>'+
      '<button type="button" class="btn small" data-save="hw_q'+n+'">'+(admin?'حفظ السؤال للجميع':'حفظ السؤال')+'</button>'+
      '<button type="button" class="btn small" data-save="hw_a'+n+'">'+(mcq?(admin?'حفظ الاختيارات للجميع':'حفظ الاختيارات'):(admin?'حفظ الإجابة للجميع':'حفظ الإجابة'))+'</button></div></section>';
  });
  return h+'</div>';
}
function hwVal(l,k){var el=$('f_'+k);return el?el.value:(l[k]||'');}
function shuffled(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function mcqChoices(raw){return String(raw||'').split('\n').map(function(x){return x.trim();}).filter(Boolean).slice(0,6);}
function hwItems(l){var m=GLOBAL_SET.hwMark==null?1:GLOBAL_SET.hwMark;
  if(isMcq(l))return [1,2].map(function(n){var c=mcqChoices(hwVal(l,'hw_a'+n));if(c.length<2)return {text:''};var right=c[0],mix=shuffled(c);
    return {type:'mcq',text:hwVal(l,'hw_q'+n),choices:mix,correct:mix.indexOf(right)+1,answer:right,mark:m};}).filter(function(x){return x.text.trim();});
  return [1,2].map(function(n){return {text:hwVal(l,'hw_q'+n),answer:hwVal(l,'hw_a'+n),mark:m};}).filter(function(x){return x.text.trim();});}
function lessonNo(l){if(l.lesson_no)return +l.lesson_no;var n=0;for(var i=0;i<lessons.length;i++){var x=lessons[i];if(ckey(x)===ckey(l)&&String(x.unit)===String(l.unit)){n++;if(x.id===l.id)return n;}}return 0;}
function buildHwJson(l){var t=$('f_title');return JSON.stringify({source:'tahdir-al-aali',kind:'homework',title:(t&&t.value.trim())||l.title||'',base_title:l.title||'',grade:l.grade,subject:l.subject||'',unit:String(l.unit),lesson_no:lessonNo(l),items:hwItems(l)});}
function sendToNour(kind,json,okMsg,minVer,fallback){
  // المسار الوحيد: أداة نور مثبتة على المتصفح (Tampermonkey) أو التطبيق. لا حجب بسبب الإصدار:
  // نتحقق فقط أن الأداة موجودة، ولو كانت قديمة نُنبّه بلطف ونكمل.
  if(!IN_APP&&!hasExt()&&!toolVersion()){
    toolDialog('الإرسال إلى نور يحتاج تثبيت «أداة نور» مرة واحدة على متصفحك (خطوتان فقط).');
    return false;
  }
  var done=false,ev='tahdir-'+kind+'-ack';
  function onAck(){done=true;document.removeEventListener(ev,onAck);toast(okMsg);}
  document.addEventListener(ev,onAck);
  try{var o=JSON.parse(json);o.nonce=Date.now().toString(36)+Math.random().toString(36).slice(2,8);json=JSON.stringify(o);}catch(e){}
  // في المتصفح نستخدم أسماء أحداث لا تسمعها النسخ القديمة المكررة من الأداة
  document.dispatchEvent(new CustomEvent((IN_APP?'tahdir-send-':'tahdir-v3-send-')+kind,{detail:json}));
  setTimeout(function(){if(!done){document.removeEventListener(ev,onAck);toast('لم تستجب الأداة. أعد تحميل الصفحة وحاول مرة أخرى');}},1500);
  return true;
}
function sendHw(l){
  if(!hwItems(l).length){toast('لا توجد أسئلة في هذا الواجب');return;}
  if(sendToNour('hw',buildHwJson(l),'أُرسل الواجب ✓ تابع في نور',toolMin(l,isMcq(l)?'2.6':'2.3'),function(){copyText(buildHwJson(l));track('copy_hw',l);}))track('send_hw',l,'send');
}
function sendPrep(l){
  if(sendToNour('prep',buildCopyJson(l),'أُرسل التحضير ✓ تابع في نور',toolMin(l,isEn(l)?'2.9':'2.3'),function(){copyText(buildCopyJson(l));track('copy_json',l);}))track('send_prep',l,'send');
}
function buildHwText(l){var L='أبجدهو';return 'واجب: '+(l.title||'')+'\n\n'+hwItems(l).map(function(x,i){return (i+1)+'- '+x.text+(x.choices?'\n'+x.choices.map(function(c,k){return '   '+L[k]+') '+c;}).join('\n'):'');}).join('\n\n');}
function renderLesson(l){
  var p=$('panel'),admin=me.role==='admin';
  var h='<article class="lesson"><div class="crumb">'+(l.subject?esc(l.subject)+' <span>›</span> ':'')+'الصف '+esc(gradeLabel(l.grade))+' <span>›</span> الوحدة '+esc(l.unit)+(l.unit_name?' · '+esc(l.unit_name):'')+'</div>'+
    '<div class="lesson-head"><input class="title-in" id="f_title" value="'+esc(l.title)+'" aria-label="عنوان الدرس">'+
    '<div class="head-actions"><button type="button" class="btn small" data-save="title">'+(admin?'حفظ العنوان للجميع':'حفظ العنوان')+'</button></div></div>'+
    ((l.ai_filled||[]).filter(function(k){return k!=='concepts';}).length?'<div class="empty-note">الخانات المعلّمة «مقترح» لم تكن في ملف التحضير الأصلي. راجعها قبل الاستخدام.</div>':'')+
    (isEmpty(l)?'<div class="empty-note">لم يُرفع تحضير لهذا الدرس بعد.</div>':'')+
    '<div class="ltabs" role="tablist"><button type="button" role="tab" class="ltab'+(lessonTab==='prep'?' on':'')+'" data-ltab="prep">التحضير</button><button type="button" role="tab" class="ltab'+(lessonTab==='hw'?' on':'')+'" data-ltab="hw">الواجب الإلكتروني</button></div>'+
    '<div id="hwPane"'+(lessonTab==='hw'?'':' hidden')+'>'+hwBlock(l)+'</div><div id="prepPane"'+(lessonTab==='prep'?'':' hidden')+'>'+
    '<div class="copybar"><div class="copybar-text"><strong>التحضير إلى نور</strong><span>اضغط «إرسال التحضير إلى نور» ونور مفتوحة: تُفتح «إضافة تحضير» لهذا الصف ويُختار الدرس وتُملأ الأركان. يبقى لك التواريخ وزر «إضافة».</span></div>'+
    '<div class="copybar-btns"><button type="button" class="btn primary" id="sendPrepBtn">إرسال التحضير إلى نور</button><button type="button" class="btn" id="copyJsonBtn">نسخ للأداة</button><button type="button" class="btn" id="copyAllBtn">نسخ كنص</button></div></div><div class="secs">';
  ESSENTIAL.forEach(function(f){if(f.key==='weekly'&&!l.weekly&&!isEn(l))return;h+=fieldBlock(l,f,true);});
  h+='</div><button type="button" class="extra-toggle" id="extraToggle" aria-expanded="false"><span>عناصر مرجعية من ملف التحضير الأصلي</span><span class="muted">لا تُنسخ إلى نور</span></button><div class="extra-body" id="extraBody" hidden>';
  EXTRA.forEach(function(f){h+=fieldBlock(l,f,false);});
  h+='</div></div></article>';
  p.innerHTML=h;
  Array.prototype.forEach.call(p.querySelectorAll('[data-ltab]'),function(b){b.onclick=function(){lessonTab=b.getAttribute('data-ltab');renderLesson(l);};});
  $('sendHwBtn').onclick=function(){sendHw(l);};
  $('copyHwBtn').onclick=function(){copyText(buildHwJson(l));track('copy_hw',l);};
  $('copyHwTxt').onclick=function(){copyText(buildHwText(l));track('copy_hw',l,'text');};
  $('hwMark').onchange=function(){var v=parseFloat(this.value);if(!(v>=0))v=1;GLOBAL_SET.hwMark=v;lsSet('tahdir_settings_v1',Object.assign(lsGet('tahdir_settings_v1')||{},GLOBAL_SET));toast('تم حفظ الدرجة');};
  $('extraToggle').onclick=function(){var b=$('extraBody');b.hidden=!b.hidden;this.setAttribute('aria-expanded',String(!b.hidden));};
  $('copyAllBtn').onclick=function(){copyText(buildCopyAll(l));track('copy_all',l);};
  $('sendPrepBtn').onclick=function(){sendPrep(l);};
  $('copyJsonBtn').onclick=function(){copyText(buildCopyJson(l));track('copy_json',l);};
  Array.prototype.forEach.call(p.querySelectorAll('[data-copy]'),function(b){b.onclick=function(){var k=b.getAttribute('data-copy');copyText($('f_'+k).value);track('copy_field',l,k);};});
  Array.prototype.forEach.call(p.querySelectorAll('[data-save]'),function(b){b.onclick=function(){var k=b.getAttribute('data-save');saveField(l,k,$('f_'+k).value.trim?$('f_'+k).value:$('f_'+k).value,b);};});
}
function selectLesson(id){
  var _lay=document.querySelector('.wrap.layout');if(_lay)_lay.classList.remove('home-view');
  currentId=id;var l=lessons.filter(function(x){return x.id===id;})[0];if(!l)return;
  renderTree();renderLesson(l);
  if(!viewed[id]){viewed[id]=1;track('view',l);}
  if(window.innerWidth<=860){try{$('panel').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}}
}

// ===== شعار المادة المتحرك في شاشة الترحيب =====
// خلية حيّة تنبض، ثم تتحول تباعًا إلى رموز المواد (دورق الكيمياء، ذرّة الفيزياء، مجهر العلوم…)
// وتستقر أخيرًا على رمز مادة المعلم. الإدارة = الأحياء.
var MORPH_ICONS={
  bio:null, // تُؤخذ من رسم الخلية
  chem:'<svg viewBox="0 0 240 180"><defs><linearGradient id="mzLiq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ee0c3"/><stop offset="1" stop-color="#1f8a70"/></linearGradient></defs><path d="M104 22h32M108 22v44L70 146a10 10 0 0 0 9 14h82a10 10 0 0 0 9-14L132 66V22" fill="#eef9f5" stroke="#0b3b33" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M86 118h68l16 28a10 10 0 0 1-9 14H79a10 10 0 0 1-9-14z" fill="url(#mzLiq)"/><g class="mz-bub"><circle cx="104" cy="140" r="5" fill="#fff" opacity=".85"/><circle cx="124" cy="146" r="3.5" fill="#fff" opacity=".8"/><circle cx="138" cy="134" r="4" fill="#fff" opacity=".8"/></g><path d="M100 40h14M100 54h10" stroke="#0b3b33" stroke-width="3" stroke-linecap="round" opacity=".5"/></svg>',
  phys:'<svg viewBox="0 0 240 180"><g fill="none" stroke="#1368ce" stroke-width="5"><ellipse cx="120" cy="90" rx="84" ry="30"/><ellipse cx="120" cy="90" rx="84" ry="30" transform="rotate(60 120 90)"/><ellipse cx="120" cy="90" rx="84" ry="30" transform="rotate(-60 120 90)"/></g><circle cx="120" cy="90" r="15" fill="#e21b3c"/><circle cx="114" cy="85" r="5" fill="#fff" opacity=".6"/><g class="mz-orb"><circle cx="204" cy="90" r="8" fill="#ffd400" stroke="#0b3b33" stroke-width="2"/></g><g class="mz-orb o2"><circle cx="78" cy="17" r="8" fill="#ffd400" stroke="#0b3b33" stroke-width="2"/></g></svg>',
  sci:'<svg viewBox="0 0 240 180"><g stroke="#0b3b33" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M70 160h110" /><path d="M125 160v-20" /><path d="M98 140h56" fill="none"/><rect x="104" y="30" width="26" height="70" rx="6" transform="rotate(-25 117 65)" fill="#e3f1eb"/><path d="M150 72a40 40 0 0 1-30 68" fill="none"/><path d="M116 108l18 8"/><circle cx="148" cy="66" r="10" fill="#e8890c"/></g><g class="mz-spark"><path d="M60 50l6 12 12 6-12 6-6 12-6-12-12-6 12-6z" fill="#ffd400"/></g></svg>',
  env:'<svg viewBox="0 0 240 180"><circle cx="120" cy="90" r="62" fill="#4dabf7"/><path d="M84 52c18 4 22 22 10 30s-2 22 12 28-6 26-22 18c-10-14-18-34-12-50 3-10 6-20 12-26zM140 40c14 8 30 22 34 44-10 2-20-6-24 4s4 18-6 24-18-10-14-24 2-26 10-48z" fill="#51cf66"/><g class="mz-leaf"><path d="M168 30c30 0 40 22 34 44-26 0-40-18-34-44z" fill="#2f9e44"/><path d="M172 36c8 14 16 24 28 34" stroke="#d3f9d8" stroke-width="3" fill="none"/></g></svg>',
  it:'<svg viewBox="0 0 240 180"><rect x="56" y="34" width="128" height="86" rx="10" fill="#0b3b33"/><rect x="66" y="44" width="108" height="66" rx="5" fill="#12243a"/><path d="M50 128h140l-12 18H62z" fill="#9aa7b8"/><g class="mz-code" font-family="monospace" font-weight="900" font-size="26" fill="#7fd3ff"><text x="80" y="86">&lt;/&gt;</text></g><rect class="mz-cur" x="150" y="68" width="10" height="22" fill="#ffd400"/></svg>',
  math:'<svg viewBox="0 0 240 180"><text x="120" y="120" text-anchor="middle" font-size="96" font-weight="900" fill="#1368ce" font-family="serif">π</text><g class="mz-comp" stroke="#0b3b33" stroke-width="6" stroke-linecap="round"><path d="M178 40l-22 70M178 40l22 70"/><circle cx="178" cy="40" r="7" fill="#e8890c"/></g><text x="56" y="70" font-size="34" font-weight="900" fill="#e21b3c">+</text><text x="54" y="140" font-size="34" font-weight="900" fill="#26890c">÷</text></svg>',
  ar:'<svg viewBox="0 0 240 180"><path d="M120 50c-20-14-48-16-70-10v100c22-6 50-4 70 10 20-14 48-16 70-10V40c-22-6-50-4-70 10z" fill="#fff" stroke="#0b3b33" stroke-width="6" stroke-linejoin="round"/><path d="M120 50v100" stroke="#0b3b33" stroke-width="5"/><text x="86" y="112" text-anchor="middle" font-size="46" font-weight="900" fill="#1f8a70">ض</text><text x="156" y="112" text-anchor="middle" font-size="40" font-weight="900" fill="#e8890c">ع</text></svg>',
  en:'<svg viewBox="0 0 240 180"><rect x="52" y="34" width="136" height="112" rx="18" fill="#fff" stroke="#0b3b33" stroke-width="6"/><text x="120" y="116" text-anchor="middle" font-size="62" font-weight="900" fill="#1368ce" font-family="sans-serif">Aa</text><path d="M188 52l20-12v100l-20-12" fill="#e21b3c"/></svg>',
  isl:'<svg viewBox="0 0 240 180"><path d="M120 34c-24 22-48 30-48 60v52h96V94c0-30-24-38-48-60z" fill="#1f8a70" stroke="#0b3b33" stroke-width="5" stroke-linejoin="round"/><path d="M106 146v-30a14 14 0 0 1 28 0v30" fill="#e3f1eb" stroke="#0b3b33" stroke-width="4"/><path d="M60 60v86M180 60v86" stroke="#0b3b33" stroke-width="8" stroke-linecap="round"/><path d="M128 18a14 14 0 1 0 6 22a11 11 0 1 1-6-22z" fill="#ffd400"/></svg>'
};
var MORPH_NAMES={bio:'الأحياء',chem:'الكيمياء',phys:'الفيزياء',sci:'العلوم',env:'العلوم البيئية',it:'تقنية المعلومات',math:'الرياضيات',ar:'اللغة العربية',en:'اللغة الإنجليزية',isl:'التربية الإسلامية'};
function morphKey(sub){sub=sub||'';
  if(!sub||/أحياء/.test(sub))return 'bio';if(/كيمياء/.test(sub))return 'chem';if(/فيزياء/.test(sub))return 'phys';if(/بيئ/.test(sub))return 'env';
  if(/علوم/.test(sub))return 'sci';if(/تقنية/.test(sub))return 'it';if(/رياض/.test(sub))return 'math';if(/العربية/.test(sub))return 'ar';
  if(/انجليز|إنجليز|English/i.test(sub))return 'en';if(/إسلام/.test(sub))return 'isl';return 'bio';}
function teacherMorph(){
  if(me&&me.role==='admin')return 'bio';
  var ss=subjects();if(ss.length===1)return morphKey(ss[0]);
  return morphKey(subj!=null&&ss.indexOf(subj)>=0?subj:ss[0]);
}
function morphHtml(){
  var cell=$('cellArt')?$('cellArt').innerHTML:'';
  return '<div class="morph" id="morph" aria-hidden="true">'+Object.keys(MORPH_NAMES).map(function(k){return '<div class="mz mz-'+k+'" data-k="'+k+'">'+(k==='bio'?cell:MORPH_ICONS[k])+'</div>';}).join('')+'<div class="mz-ring"></div></div><div class="mz-tag" id="mzTag"></div>';
}
function runMorph(){
  var box=$('morph');if(!box)return;var fin=teacherMorph();
  var all=box.querySelectorAll('.mz'),byK={};Array.prototype.forEach.call(all,function(e){byK[e.getAttribute('data-k')]=e;});
  var order=['bio'].concat(['chem','phys','sci','env','it','math','ar','en','isl'].filter(function(k){return k!==fin;})).concat([fin]);
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var show=function(k,final){Array.prototype.forEach.call(all,function(e){e.classList.remove('on');});var e=byK[k];if(!e)return;void e.offsetWidth;e.classList.add('on');if(final){e.classList.add('final');box.classList.add('done');var t=$('mzTag');if(t){t.innerHTML='مادتك: <b>'+esc(MORPH_NAMES[k])+'</b>';t.classList.add('on');}}};
  if(reduce){show(fin,true);return;}
  box.classList.add('alive');show('bio');
  var i=0,step=function(){if(!document.body.contains(box))return;i++;if(i>=order.length)return;var last=i===order.length-1;show(order[i],last);if(!last)setTimeout(step,i===1?560:460);};
  setTimeout(step,1700);
}
var morphPlayed=false;
function showWelcome(t,m){$('panel').innerHTML='<div class="welcome">'+$('cellArt').innerHTML+'<h2>'+esc(t)+'</h2><p>'+esc(m)+'</p></div>';}
function openSettings(){
  // «القيم الثابتة» انتقلت إلى داخل تحضير كل درس (الاستراتيجيات + الوسائل ومصادر التعلم)
  showWelcome('القيم الثابتة صارت داخل الدرس','افتح أي درس من القائمة، وستجد حقلَي «الاستراتيجيات» و«الوسائل ومصادر التعلم» جاهزين بقيم المادة، وتقدر تعدّلها لكل درس على حدة.');
}

// ===== الرئيسية: قائمة مرتبة =====
// التحضير يعيد شجرة الدروس الحالية؛ باقي البطاقات تنتقل لمساراتها الحالية.
// لا شيء هنا يغيّر درسًا أو بحثًا أو إرسالًا إلى نور.
// الأنيميشن المتحرك (morph) لم يُمسّ: يبقى كما هو في شاشة التحضير، يتحرك بين
// المواد ويستقر على مادة المعلم. لا توجد بطاقة المكتبة هنا.
var HOME_CARDS=[
  {key:'prep',title:'التحضير',icon:'📋',sub:'دروس جاهزة للإرسال إلى نور',route:''},
  {key:'quiz',title:'التقويم والاختبارات',icon:'📝',sub:'اختبارات قصيرة وفق الوثيقة',route:'/quiz'},
  {key:'homework',title:'الواجبات المنزلية',icon:'📒',sub:'ورقة واجب بدرجات وأنواع وفق الوثيقة',route:'/homework'},
  {key:'cards',title:'كروت الأسئلة (بليكرز)',icon:'🪪',sub:'بطاقة لكل طالب وامسح الصف بالجوال',route:'/cards'},
  {key:'games',title:'الألعاب التعليمية',icon:'🎲',sub:'شد الحبل، العداء، كرة القدم…',route:'/games'},
  {key:'slides',title:'العروض التقديمية',icon:'📽️',sub:'عروض كل مادة وصف',route:'/slides'},
  {key:'finals',title:'الاختبارات النهائية',icon:'🗂',sub:'أسئلة الوزارة حسب الدرس',route:'/finals'},
  {key:'remedial',title:'الخطط العلاجية',icon:'🩹',sub:'للطلاب دون المستوى',route:'/remedial'},
  {key:'summaries',title:'ملخصات الدروس',icon:'📚',sub:'وفق مخرجات التعلم',route:'/summaries'},
  {key:'cando',title:'أستطيع أن',icon:'☑️',sub:'قوائم التقييم الذاتي',route:'/cando'},
  {key:'research',title:'البحوث الإجرائية',icon:'🔬',sub:'العلوم، اللغة العربية، الرياضيات',route:'/research'},
  {key:'diag',title:'الاختبار التشخيصي',icon:'🧪',sub:'قياس مستوى الطالب قبل الدرس',route:'/diag'},
  {key:'analysis',title:'تحليل نتائج الاختبارات',icon:'📊',sub:'نتائج وتقارير سريعة',route:'/analysis'},
  {key:'ld',title:'سجل صعوبات التعلم',icon:'🧩',sub:'متابعة الطلاب المتعثرين',route:'/ld'},
  {key:'forms',title:'النماذج الإدارية',icon:'🗂',sub:'نماذج جاهزة للطباعة',route:'/forms'},
  {key:'space',title:'مساحة الطالب',icon:'🎒',sub:'أنشطة ومراجعات للطلاب',route:'/space'}
];
// أدوات خبير فقط: أداة نور، دليلك للاستخدام، التطبيق والأدوات.
// (بطاقة المكتبة محذوفة بناءً على طلب المعلم.)
var HOME_TOOLS=[
  {key:'tool',title:'أداة نور',icon:'📤',sub:'إرسال التحضير والواجب بضغطة واحدة',act:'tool'},
  {key:'guide',title:'دليلك للاستخدام',icon:'❓',sub:'شرح سريع خطوة بخطوة',act:'tour'},
  {key:'app',title:'التطبيق والأدوات',icon:'📱',sub:'أندرويد وآيفون وأداة الكمبيوتر',act:'app'}
];
// مادة المعلم كما هي مسجلة له في لوحة التحكم: الخادم يرسل للمعلم دروسه
// المسموحة فقط، فمادته تُستنتج من تلك الدروس. الإدارة = الأحياء (كما في teacherMorph).
function teacherSubject(){
  if(me&&me.role==='admin')return 'الأحياء';
  var ss=subjects();
  if(ss.length===1)return ss[0];
  if(subj&&ss.indexOf(subj)>=0)return subj;
  return ss[0]||'العلوم';
}
var KH_FLOW=[
  {id:'before',name:'قبل الحصة',sub:'أجهّز درسي',keys:['prep','slides','summaries','cando']},
  {id:'during',name:'داخل الحصة',sub:'أشغّل صفّي',keys:['games','cards','space']},
  {id:'assess',name:'التقويم',sub:'أقيس التعلّم',keys:['quiz','homework','diag','finals']},
  {id:'follow',name:'بعد الحصة',sub:'أتابع طلابي',keys:['analysis','remedial','ld']},
  {id:'office',name:'ملفاتي',sub:'أوراق إدارية وبحوث',keys:['forms','research']}
];
function khGreet(){var h=new Date().getHours();return h<12?'صباح الخير':'مساء الخير';}
var homeQ='';
function homeCardHtml(c,attr,i){
  return '<button type="button" class="home-card" '+attr+'="'+esc(c.key)+'" style="animation-delay:'+((i||0)*0.05).toFixed(2)+'s"><span class="home-ic" aria-hidden="true">'+c.icon+'</span><span class="home-title">'+esc(c.title)+'</span><span class="home-sub">'+esc(c.sub)+'</span></button>';
}
function renderHomeCards(){
  var q=normAr(homeQ);
  var main=HOME_CARDS.filter(function(c){return !q||normAr(c.title+' '+c.sub).indexOf(q)>=0;});
  var tools=HOME_TOOLS.filter(function(c){return !q||normAr(c.title+' '+c.sub).indexOf(q)>=0;});
  var g=$('homeGrid');
  if(g){
    if(!main.length)g.innerHTML='<div class="home-empty">لا توجد أقسام مطابقة للبحث.</div>';
    else g.innerHTML=KH_FLOW.map(function(st,si){
      var rows=main.filter(function(c){return st.keys.indexOf(c.key)>=0;});
      if(!rows.length)return '';
      return '<section class="kh-step kh-'+st.id+'"><header><span class="kh-n">'+(si+1)+'</span><div><h2>'+esc(st.name)+'</h2><p>'+esc(st.sub)+'</p></div></header><div class="kh-rows">'+
        rows.map(function(c){return '<button type="button" class="kh-row" data-home="'+esc(c.key)+'"><span class="kh-ic" aria-hidden="true">'+c.icon+'</span><span class="kh-tx"><b>'+esc(c.title)+'</b><small>'+esc(c.sub)+'</small></span><span class="kh-go" aria-hidden="true">‹</span></button>';}).join('')+'</div></section>';
    }).join('');
  }
  var t=$('homeTools');if(t)t.innerHTML=tools.length?tools.map(function(c){return '<button type="button" class="kh-tool" data-tool="'+esc(c.key)+'"><span aria-hidden="true">'+c.icon+'</span><span><b>'+esc(c.title)+'</b><small>'+esc(c.sub)+'</small></span></button>';}).join(''):'';
  var th=$('homeToolsHead');if(th)th.style.display=tools.length?'':'none';
  Array.prototype.forEach.call(document.querySelectorAll('[data-home]'),function(b){
    b.onclick=function(){
      var k=b.getAttribute('data-home');
      var c=HOME_CARDS.filter(function(x){return x.key===k;})[0];if(!c)return;
      if(c.key==='prep'){showPrep();return;}
      // على الجوال لا يوجد «مرور»: نُظهر اهتزاز الأيقونة لحظة ثم ننتقل
      if(window.matchMedia&&matchMedia('(hover:none)').matches){b.classList.add('tap');setTimeout(function(){location.href=c.route;},180);return;}
      location.href=c.route;
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-tool]'),function(b){
    b.onclick=function(){
      var k=b.getAttribute('data-tool');
      if(k==='tool'){if(typeof toolDialog==='function')toolDialog('');else if($('toolBtn'))$('toolBtn').click();}
      else if(k==='tour'){if(typeof tourStart==='function')tourStart();else if($('tourBtn'))$('tourBtn').click();}
      else if(k==='app'){var ab=$('appBar');if(ab){if(ab.hidden){ab.hidden=false;ab.classList.remove('reshow');ab.offsetHeight;ab.classList.add('reshow');}ab.scrollIntoView({behavior:'smooth',block:'start'});}else if($('pcBtn'))$('pcBtn').click();}
    };
  });
}
function showHome(){
  if(window.abSync)window.abSync(false);
  var lay=document.querySelector('.wrap.layout');if(lay)lay.classList.add('home-view');
  // شريحة المعلم: الاسم + «معلم المادة» فقط، بلا صف (بناءً على طلب المعلم).
  var nm=(me&&me.name?me.name:'').trim();
  $('panel').innerHTML='<div class="home kh-home"><section class="kh-hero"><img class="kh-owl" src="/brand/logo.png" alt=""><div class="kh-hi"><p class="kh-greet">'+khGreet()+(nm?'، '+esc(nm):'')+'</p><h1>ماذا تحتاج لحصتك اليوم؟</h1><p class="kh-subj">معلم '+esc(teacherSubject())+'</p></div>'+
    '<div class="kh-quick"><button type="button" class="kh-q main" data-home="prep">📋 ابدأ التحضير</button><button type="button" class="kh-q" data-home="quiz">📝 اختبار جديد</button><button type="button" class="kh-q" data-home="games">🎲 لعبة للصف</button></div>'+
    '<input id="homeSearch" class="home-search kh-search" type="search" placeholder="ابحث عن أداة: اختبار، ملخص، لعبة…" value="'+esc(homeQ)+'" aria-label="البحث في أقسام خبير"></section>'+
    '<div class="kh-flow" id="homeGrid"></div><h2 class="kh-tools-h" id="homeToolsHead">أدوات خبير</h2><div class="kh-tools" id="homeTools"></div></div>';
  renderHomeCards();
  var inp=$('homeSearch');
  if(inp)inp.oninput=function(){homeQ=this.value;renderHomeCards();};
}
function showPrep(){
  if(window.abSync)window.abSync(true);
  var lay=document.querySelector('.wrap.layout');if(lay)lay.classList.remove('home-view');
  renderTree();
  // الأنيميشن (morph) هنا كما هو تمامًا، لم يُغيَّر.
  $('panel').innerHTML='<div class="welcome">'+morphHtml()+'<h2>'+esc('أهلًا '+me.name)+'</h2><p>'+esc('اختر الصف ثم الوحدة ثم الدرس. كل درس مقسّم بنفس خانات نموذج «إضافة تحضير» في منصة نور.')+'</p></div>';
  runMorph();
}

function init(){
  // لا يوجد زر «قيم ثابتة» في الشريط: الاستراتيجيات والوسائل صارت حقولًا في كل درس.
  if(IN_APP){if($('appBar'))$('appBar').hidden=true;}
  else{
    // إعلان التطبيق: يُخفى نهائيًا بزر ×، ويبقى متاحًا من بطاقة «التطبيق والأدوات»
    var AB='tahdir_appbar_closed',ab=$('appBar');
    try{if(ab&&localStorage.getItem(AB))ab.hidden=true;}catch(e){}
    if($('appBarX'))$('appBarX').onclick=function(){
      try{localStorage.setItem(AB,'1');}catch(e){}
      ab.style.maxHeight=ab.offsetHeight+'px';ab.offsetHeight;ab.classList.add('closing');
      setTimeout(function(){ab.hidden=true;ab.classList.remove('closing');ab.style.maxHeight='';},360);
      toast('تم الإخفاء — تجده في «التطبيق والأدوات» أسفل الرئيسية');
    };
    if($('pcBtn'))$('pcBtn').onclick=function(){toolDialog('');};
    if($('iosBtn'))$('iosBtn').onclick=function(){dialog({title:'التطبيق على الآيفون',html:'<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em"><li>افتح الموقع من متصفح <b>Safari</b>.</li><li>اضغط زر <b>«مشاركة»</b> ⬆ أسفل الشاشة.</li><li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b> ثم «إضافة».</li></ol><p class="m-msg">يظهر «خبير» بأيقونة على شاشتك مثل أي تطبيق.</p>',okText:'تم',cancelText:false});};}
  Promise.all([api('/api/me'),api('/api/lessons')]).then(function(r){
    me=r[0];lessons=r[1].lessons;
    // نحمّل القيم الثابتة للمادة الأولى، وتُبدَّل تلقائيًا عند فتح درس مادة أخرى
    useSettingsFor(activeSubject());
    try{var g=lsGet('tahdir_settings_v1');if(g&&g.hwMark!=null)GLOBAL_SET.hwMark=g.hwMark;}catch(e){}
    initNav(me);
    if(location.hash==='#settings'){history.replaceState(null,'','/app');setTimeout(openSettings,50);}
    if(me.role!=='admin'){var ed=lsGet(editsKey())||{};lessons.forEach(function(l){var e=ed[l.id];if(e)Object.keys(e).forEach(function(k){l[k]=e[k];if(l.ai_filled)l.ai_filled=l.ai_filled.filter(function(x){return x!==k;});});});}
    $('statLessons').textContent=lessons.length;$('statFilled').textContent=lessons.filter(function(l){return !isEmpty(l);}).length;
    renderTree();if(location.hash==="#prep")showPrep();else showHome();
  },function(e){showWelcome('تعذّر تحميل الدروس',e.message);});
}
// شريط التطبيق السفلي (common.js) ينتقل بين الرئيسية والتحضير بلا إعادة تحميل
window.appShowPrep=showPrep;window.appShowHome=showHome;
init();
})();
