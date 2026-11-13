(function(){
'use strict';
guard();
var GRADE_ORDER=['الصف الخامس','الصف السادس','الصف السابع','الصف الثامن','الصف التاسع','الصف العاشر','الصف الحادي عشر','الصف الثاني عشر','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الأول الثانوي','الثاني الثانوي','الثالث الثانوي','المسار العام'];
function ckey(l){return (l.subject||'')+'|'+l.grade;}
var LEGACY_SUBJ={'':1,'الأحياء':1,'العلوم':1,'اللغة الإنجليزية':1};
function toolMin(l,v){return LEGACY_SUBJ[l.subject||'']?v:'3.4.0';}
function isEn(l){return /انجليز|إنجليز|English/i.test(l.subject||'');}
// المواد: كل معلم يختار مادته ثم تظهر صفوفها
var SUBJ_ICON={'العلوم':'🔬','الأحياء':'🧬','الكيمياء':'⚗️','الفيزياء':'🧲','العلوم البيئية':'🌍','اللغة الإنجليزية':'🔤','اللغة العربية':'📖','الرياضيات':'➗','الدراسات الاجتماعية':'🗺️','تقنية المعلومات':'💻','التربية الإسلامية':'🕌','الرياضة المدرسية':'⚽'};
var SUBJ_ORDER=['العلوم','الأحياء','الكيمياء','الفيزياء','العلوم البيئية','الرياضيات','الرياضيات الأساسية','الرياضيات المتقدمة','اللغة العربية','اللغة الإنجليزية','الدراسات الاجتماعية','التربية الإسلامية','تقنية المعلومات','الرياضة المدرسية'];
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
  },
  // الرياضة المدرسية: الدرس عملي في الساحة؛ الاستراتيجيات والوسائل من نماذج تحضير المادة
  'الرياضة المدرسية':{
    strategies:['الحوار والمناقشة','التعلم التعاوني','التعلم باللعب','التعلم بالأقران','حل المشكلات','العصف الذهني'],
    resources:['الكرات','الأقماع','الأطواق','الصافرة','الحبال','المقعد السويدي','ساعة الإيقاف','الصور التوضيحية','عرض فيديو للمهارة']
  },
  // الدراسات الاجتماعية: الخريطة والأطلس وتحليل النصوص والأشكال من أدوات المادة الأساسية
  'الدراسات الاجتماعية':{
    strategies:['الحوار والمناقشة','العصف الذهني','الخرائط الذهنية','التعلم التعاوني','تحليل النصوص','التعامل مع الخريطة'],
    resources:['الكتاب المدرسي','الأطلس المدرسي','الخرائط','جهاز عرض البيانات','الوسائط المتعددة (سمعية - بصرية)','مصادر التعلم الإلكترونية']
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
// درس بلا واجب مكتوب (مثل الرياضيات): يبدأ اختيارًا من متعدد ليُملأ من بنك الأسئلة بنفس آلية الإرسال والتصحيح
function isMcq(l){return l.hw_type==='mcq'||(!l.hw_type&&!String(l.hw_q1||'').trim()&&!String(l.hw_q2||'').trim());}
// ===== اختيار أسئلة الواجب من بنك أسئلة الدرس =====
var HW_BANK={};
function hwBank(l){
  if(HW_BANK[l.id])return HW_BANK[l.id];
  HW_BANK[l.id]=api('/api/hw/bank?id='+encodeURIComponent(l.id)).then(function(r){
    var it=(r&&r.items)||[];return isMcq(l)?it.filter(function(q){return q.type==='mcq';}):it;
  },function(){delete HW_BANK[l.id];return [];});
  return HW_BANK[l.id];
}
function bankRight(q){return q.type==='mcq'?String((q.choices||[])[q.correct]!=null?q.choices[q.correct]:q.answer||''):String(q.answer||'');}
function pickHwFromBank(l,n){
  hwBank(l).then(function(items){
    if(!items.length){toast('لا توجد أسئلة نصية في بنك هذا الدرس');return;}
    var used=[1,2].filter(function(k){return k!==n;}).map(function(k){return String(hwVal(l,'hw_q'+k)).trim();});
    var h='<p class="m-msg">اضغط السؤال لينتقل إلى خانة السؤال '+n+(isMcq(l)?'، وتنتقل اختياراته والإجابة الصحيحة في السطر الأول.':'، وتنتقل إجابته النموذجية.')+'</p><div class="hwb-list">';
    items.forEach(function(q,i){
      var right=bankRight(q),dup=used.indexOf(String(q.stem).trim())>=0;
      h+='<button type="button" class="hwb-item'+(dup?' used':'')+'" data-hwb="'+i+'"><span class="hwb-stem" dir="auto">'+esc(q.stem).replace(/\n/g,'<br>')+'</span>'+
        (q.type==='mcq'?'<span class="hwb-ch" dir="auto">'+(q.choices||[]).map(function(c){return '<span'+(c===right?' class="ok"':'')+'>'+esc(c)+'</span>';}).join('')+'</span>':'<span class="hwb-ans" dir="auto">'+esc(right).replace(/\n/g,' · ')+'</span>')+
        '<span class="hwb-meta">'+(q.type==='mcq'?'اختيار من متعدد':'إجابة قصيرة')+(q.ao?' · '+esc(({GRM:'القواعد',VCB:'المفردات',RDG:'القراءة',WRT:'الكتابة'})[q.ao]||q.ao):'')+(q.difficulty?' · '+esc(q.difficulty):'')+(q.src?' · '+esc(q.src):'')+(dup?' · مستخدم في السؤال الآخر':'')+'</span></button>';
    });
    h+='</div>';
    dialog({title:'بنك أسئلة الدرس ('+items.length+')',html:h,okText:'إغلاق',cancelText:false,wide:true});
    Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-hwb]'),function(b){b.onclick=function(){
      var q=items[+b.getAttribute('data-hwb')],right=bankRight(q),qa=$('f_hw_q'+n),aa=$('f_hw_a'+n),L='أبجدهو';
      if(isMcq(l)){qa.value=q.stem;aa.value=[right].concat((q.choices||[]).filter(function(c){return c!==right;})).join('\n');}
      else{qa.value=q.type==='mcq'?q.stem+'\n'+(q.choices||[]).map(function(c,k){return L[k]+') '+c;}).join('\n'):q.stem;aa.value=right;}
      var sec=qa.closest('.sec'),tg=sec&&sec.querySelector('.sugg');if(tg){tg.hidden=false;tg.textContent='من بنك الأسئلة';tg.title=q.src||'من بنك أسئلة الدرس';}
      closeDialog(null);toast('أُضيف السؤال '+n+' من البنك — احفظه إن أردت بقاءه');track('hw_bank_pick',l);
    };});
  });
}
function hwBlock(l){
  var admin=me.role==='admin',mcq=isMcq(l),h='<div class="copybar"><div class="copybar-text"><strong>'+(mcq?'واجب اختيار من متعدد: سؤالان بأربعة اختيارات':'واجب مقالي من سؤالين')+'</strong><span>اضغط «إرسال الواجب إلى نور» ونور مفتوحة: تُفتح صفحة إضافة المهمة لهذا الصف وتُجهَّز تلقائيًا، احفظها، ثم تُضاف الأسئلة في «إضافة مجموعة مفردات دفعة واحدة».</span></div>'+
    '<div class="copybar-btns"><button type="button" class="btn primary" id="sendHwBtn">إرسال الواجب إلى نور</button><button type="button" class="btn" id="copyHwBtn">نسخ للأداة</button><button type="button" class="btn" id="copyHwTxt">نسخ كنص</button></div></div>'+
    '<div class="hw-mark"><label for="hwMark">درجة كل سؤال</label><input id="hwMark" type="number" min="0" step="0.5" value="'+esc(settings.hwMark==null?1:settings.hwMark)+'"></div><div class="secs">';
  [1,2].forEach(function(n){
    h+='<section class="sec ess"><div class="sec-head"><h3>'+icon(n===1?'seed':'leaf')+'<span>السؤال '+n+'</span></h3>'+(String(l['hw_q'+n]||'').trim()?'<span class="sugg" title="كتبه المساعد من محتوى الدرس">مقترح</span>':'<span class="sugg" hidden></span>')+'</div>'+
      '<textarea class="field" dir="auto" id="f_hw_q'+n+'" spellcheck="false">'+esc(l['hw_q'+n]||'')+'</textarea>'+
      '<div class="sec-head" style="margin-top:10px"><h3 style="font-size:.86rem;color:var(--mute)"><span>'+(mcq?'الاختيارات الأربعة: السطر الأول هو الإجابة الصحيحة (يُخلط ترتيبها تلقائيًا عند الإرسال)':'الإجابة النموذجية')+'</span></h3></div>'+
      '<textarea class="field" dir="auto" id="f_hw_a'+n+'" spellcheck="false">'+esc(l['hw_a'+n]||'')+'</textarea>'+
      '<div class="sec-actions"><button type="button" class="btn small primary" data-copy="hw_q'+n+'">نسخ السؤال</button>'+
      '<button type="button" class="btn small" data-save="hw_q'+n+'">'+(admin?'حفظ السؤال للجميع':'حفظ السؤال')+'</button>'+
      '<button type="button" class="btn small" data-save="hw_a'+n+'">'+(mcq?(admin?'حفظ الاختيارات للجميع':'حفظ الاختيارات'):(admin?'حفظ الإجابة للجميع':'حفظ الإجابة'))+'</button>'+
      '<button type="button" class="btn small hwb-btn" data-hwbank="'+n+'" hidden>اختيار من بنك الأسئلة</button></div></section>';
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
  var hb=p.querySelectorAll('[data-hwbank]');
  if(hb.length)hwBank(l).then(function(items){if(!items.length)return;Array.prototype.forEach.call(hb,function(b){b.hidden=false;b.textContent='اختيار من بنك الأسئلة ('+items.length+')';b.onclick=function(){pickHwFromBank(l,+b.getAttribute('data-hwbank'));};});});
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
  chem:'<svg viewBox="0 0 240 180"><defs><linearGradient id="mzLiq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38d9a9"/><stop offset="1" stop-color="#0e7a5f"/></linearGradient><linearGradient id="mzGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3faf8"/><stop offset="1" stop-color="#d8f3ec"/></linearGradient></defs><path d="M98 20h44M106 20v42L64 142a14 14 0 0 0 12 20h88a14 14 0 0 0 12-20L134 62V20" fill="url(#mzGlass)" stroke="#1a2e4c" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M82 108c14-6 26 6 40 0s24-6 36 0l18 34a14 14 0 0 1-12 20H76a14 14 0 0 1-12-20z" fill="url(#mzLiq)"/><path d="M78 148h84" stroke="#7ee0c3" stroke-width="3" stroke-linecap="round" opacity=".5"/><g class="mz-bub"><circle cx="102" cy="138" r="6" fill="#fff" opacity=".9"/><circle cx="126" cy="146" r="4.5" fill="#fff" opacity=".85"/><circle cx="142" cy="130" r="5" fill="#fff" opacity=".85"/><circle cx="116" cy="118" r="3.5" fill="#fff" opacity=".75"/></g><path d="M106 36h12M106 48h9M96 86h14" stroke="#1a2e4c" stroke-width="3" stroke-linecap="round" opacity=".55"/><g class="mz-spark"><path d="M176 34l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="#ff9f1c"/></g></svg>',
  phys:'<svg viewBox="0 0 240 180"><g fill="none" stroke="#3e7bfa" stroke-width="4.5"><ellipse cx="120" cy="90" rx="86" ry="30"/><ellipse cx="120" cy="90" rx="86" ry="30" transform="rotate(60 120 90)" stroke="#6a5fd0"/><ellipse cx="120" cy="90" rx="86" ry="30" transform="rotate(-60 120 90)"/></g><circle cx="114" cy="86" r="11" fill="#e21b3c"/><circle cx="127" cy="86" r="10" fill="#3e7bfa"/><circle cx="120" cy="97" r="10.5" fill="#ff9f1c"/><circle cx="120" cy="89" r="9.5" fill="#e21b3c"/><circle cx="116" cy="85" r="3.5" fill="#fff" opacity=".75"/><g class="mz-orb"><circle cx="206" cy="90" r="8.5" fill="#ffd400" stroke="#1a2e4c" stroke-width="2.5"/></g><g class="mz-orb o2"><circle cx="77" cy="16" r="8.5" fill="#22b8a5" stroke="#1a2e4c" stroke-width="2.5"/></g><g class="mz-orb"><circle cx="77" cy="164" r="7.5" fill="#ff9f1c" stroke="#1a2e4c" stroke-width="2.5"/></g></svg>',
  sci:'<svg viewBox="0 0 240 180"><g stroke="#1a2e4c" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"><path d="M66 158h112"/><path d="M84 158l8-16h60l8 16" fill="#dce6f7"/><path d="M138 66c28 10 42 40 28 68-8 16-24 24-44 24" fill="none" stroke-width="8"/><path d="M88 118h54" stroke-width="6"/><rect x="94" y="111" width="32" height="6" rx="2" fill="#38d9a9" stroke-width="3"/><g transform="rotate(-24 115 62)"><rect x="102" y="26" width="26" height="58" rx="6" fill="#e8efff"/><rect x="106" y="14" width="18" height="14" rx="3" fill="#ff9f1c"/><rect x="107" y="84" width="16" height="14" rx="3" fill="#3e7bfa"/></g><circle cx="142" cy="70" r="11" fill="#ff9f1c"/><circle cx="142" cy="70" r="4" fill="#fff" stroke="none"/></g><g class="mz-spark"><path d="M58 46l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" fill="#ffd400"/></g></svg>',
  env:'<svg viewBox="0 0 240 180"><defs><clipPath id="envClip"><circle cx="116" cy="92" r="62"/></clipPath><radialGradient id="envSea" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="#74c0fc"/><stop offset="100%" stop-color="#1864ab"/></radialGradient></defs><circle cx="116" cy="92" r="62" fill="url(#envSea)"/><g clip-path="url(#envClip)"><ellipse cx="116" cy="92" rx="62" ry="26" fill="none" stroke="#d0ebff" stroke-width="1.8" opacity=".5"/><ellipse cx="116" cy="92" rx="30" ry="62" fill="none" stroke="#d0ebff" stroke-width="1.8" opacity=".5"/><line x1="54" y1="92" x2="178" y2="92" stroke="#d0ebff" stroke-width="1.8" opacity=".5"/><line x1="116" y1="30" x2="116" y2="154" stroke="#d0ebff" stroke-width="1.8" opacity=".5"/><path d="M54 46c14 0 24 8 22 18-2 8-10 10-8 18 2 6 14 10 16 20 2 12-6 26-16 32-12-14-18-50-14-88z" fill="#51cf66" stroke="#2b8a3e" stroke-width="1.5"/><path d="M104 38c18-4 40 4 50 18 4 8-4 16-12 18-8 2-14-2-18 4-4 6 8 12 6 24-2 14-12 28-22 30-8 2-14-8-14-18 0-8-8-14-10-22-2-10 4-18 12-22 6-4 4-10 8-32z" fill="#69db7c" stroke="#2b8a3e" stroke-width="1.5"/></g><circle cx="116" cy="92" r="62" fill="none" stroke="#1a2e4c" stroke-width="5"/><g class="mz-leaf"><path d="M158 22c32-4 48 18 42 46-28 4-46-14-42-46z" fill="#2b8a3e" stroke="#1a2e4c" stroke-width="4" stroke-linejoin="round"/><path d="M164 30c10 12 20 22 32 32" stroke="#b2f2bb" stroke-width="3.5" stroke-linecap="round" fill="none"/></g></svg>',
  it:'<svg viewBox="0 0 240 180"><rect x="52" y="28" width="136" height="90" rx="12" fill="#1f2547" stroke="#1a2e4c" stroke-width="5"/><rect x="62" y="38" width="116" height="70" rx="6" fill="#0f172a"/><circle cx="72" cy="46" r="3" fill="#ff5f56"/><circle cx="82" cy="46" r="3" fill="#ffbd2e"/><circle cx="92" cy="46" r="3" fill="#27c93f"/><path d="M38 122h164l-14 22H52z" fill="#dce6f7" stroke="#1a2e4c" stroke-width="5" stroke-linejoin="round"/><rect x="104" y="128" width="32" height="6" rx="3" fill="#8ea0f8"/><g class="mz-code" font-family="monospace" font-weight="900" font-size="25" fill="#4dabf7"><text x="96" y="84" text-anchor="middle" direction="ltr">&lt;/&gt;</text></g><rect x="128" y="64" width="28" height="6" rx="3" fill="#38d9a9"/><rect x="128" y="76" width="18" height="6" rx="3" fill="#ff9f1c"/><rect class="mz-cur" x="150" y="72" width="7" height="16" rx="2" fill="#ffd400"/></svg>',
  math:'<svg viewBox="0 0 240 180"><circle cx="116" cy="94" r="56" fill="#eef3ff" stroke="#3e7bfa" stroke-width="3" stroke-dasharray="6 6"/><text x="110" y="122" text-anchor="middle" font-size="88" font-weight="900" fill="#3e7bfa" font-family="serif">π</text><g class="mz-comp" stroke="#1a2e4c" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"><path d="M176 34v12"/><path d="M176 44l-22 72M176 44l22 72"/><path d="M160 88h32" stroke-width="4"/><circle cx="176" cy="44" r="7" fill="#ff9f1c"/></g><text x="50" y="68" font-size="34" font-weight="900" fill="#e21b3c">+</text><text x="48" y="142" font-size="34" font-weight="900" fill="#22b8a5">÷</text></svg>',
  ar:'<svg viewBox="0 0 240 180"><path d="M120 46c-22-14-52-16-76-8v102c24-8 54-6 76 8 22-14 52-16 76-8V38c-24-8-54-6-76 8z" fill="#fff" stroke="#1a2e4c" stroke-width="5.5" stroke-linejoin="round"/><path d="M120 46v102" stroke="#1a2e4c" stroke-width="5"/><path d="M114 140v24l6-6 6 6v-24z" fill="#e21b3c"/><path d="M58 56h44M58 68h34M138 56h44M148 68h34" stroke="#dce6f7" stroke-width="4" stroke-linecap="round"/><text x="82" y="112" text-anchor="middle" font-size="44" font-weight="900" fill="#0e9f6e" font-family="Readex Pro,Tahoma,sans-serif">ض</text><text x="158" y="112" text-anchor="middle" font-size="42" font-weight="900" fill="#ff9f1c" font-family="Readex Pro,Tahoma,sans-serif">ع</text></svg>',
  en:'<svg viewBox="0 0 240 180"><rect x="44" y="34" width="112" height="112" rx="20" fill="#e8efff" stroke="#1a2e4c" stroke-width="5" transform="rotate(-6 100 90)"/><rect x="64" y="32" width="124" height="114" rx="20" fill="#fff" stroke="#1a2e4c" stroke-width="5.5"/><path d="M158 32v32l10-8 10 8V32z" fill="#ff9f1c" stroke="#1a2e4c" stroke-width="3.5" stroke-linejoin="round"/><text x="124" y="112" text-anchor="middle" font-size="60" font-weight="900" fill="#3e7bfa" font-family="Readex Pro,sans-serif">Aa</text><circle cx="84" cy="54" r="6" fill="#22b8a5"/></svg>',
  isl:'<svg viewBox="0 0 240 180"><path d="M120 36c-26 22-50 32-50 62v50h100V98c0-30-24-40-50-62z" fill="#22b8a5" stroke="#1a2e4c" stroke-width="5.5" stroke-linejoin="round"/><path d="M120 36c-12 22-22 34-22 62v50h44V98c0-28-10-40-22-62z" fill="#38d9a9" opacity=".45"/><path d="M104 148v-32a16 16 0 0 1 32 0v32" fill="#fff3df" stroke="#1a2e4c" stroke-width="4.5"/><path d="M54 54v94M186 54v94" stroke="#1a2e4c" stroke-width="7" stroke-linecap="round"/><path d="M44 148h152" stroke="#1a2e4c" stroke-width="5.5" stroke-linecap="round"/><path d="M128 14a14 14 0 1 0 6 22a11 11 0 1 1-6-22z" fill="#ffd400" stroke="#1a2e4c" stroke-width="2"/></svg>',
  pe:'<svg viewBox="0 0 240 180"><circle cx="110" cy="96" r="60" fill="#fff" stroke="#1a2e4c" stroke-width="5.5"/><path d="M110 70l24 17-9 28h-30l-9-28z" fill="#1a2e4c"/><path d="M110 70V40M134 87l28-10M125 115l17 24M95 115l-17 24M86 87l-28-10" stroke="#1a2e4c" stroke-width="5" stroke-linecap="round"/><path d="M168 40h36a12 12 0 0 1 0 24h-22" fill="#f59f0b" stroke="#1a2e4c" stroke-width="4"/><circle cx="178" cy="58" r="16" fill="#22b8a5" stroke="#1a2e4c" stroke-width="4"/></svg>',
  ss:'<svg viewBox="0 0 240 180"><circle cx="110" cy="96" r="62" fill="#e8f7f4" stroke="#1a2e4c" stroke-width="5.5"/><g fill="none" stroke="#22b8a5" stroke-width="4"><ellipse cx="110" cy="96" rx="26" ry="62"/><path d="M48 96h124M58 66h104M58 126h104"/></g><path d="M78 70c10-6 22-4 26 6s-4 16 4 22-2 18-14 16c-12-8-20-22-16-44z" fill="#f59f0b" opacity=".85"/><g class="mz-pin"><path d="M176 30c-16 0-26 12-26 26 0 20 26 46 26 46s26-26 26-46c0-14-10-26-26-26z" fill="#f97316" stroke="#1a2e4c" stroke-width="4"/><circle cx="176" cy="56" r="9" fill="#fff"/></g></svg>',
};
var MORPH_NAMES={bio:'الأحياء',chem:'الكيمياء',phys:'الفيزياء',sci:'العلوم',env:'العلوم البيئية',it:'تقنية المعلومات',math:'الرياضيات',ar:'اللغة العربية',en:'اللغة الإنجليزية',isl:'التربية الإسلامية',ss:'الدراسات الاجتماعية',pe:'الرياضة المدرسية'};
function morphKey(sub){sub=sub||'';
  if(!sub||/أحياء/.test(sub))return 'bio';if(/كيمياء/.test(sub))return 'chem';if(/فيزياء/.test(sub))return 'phys';if(/بيئ/.test(sub))return 'env';
  if(/علوم/.test(sub))return 'sci';if(/تقنية/.test(sub))return 'it';if(/رياضيات/.test(sub))return 'math';if(/العربية/.test(sub))return 'ar';
  if(/انجليز|إنجليز|English/i.test(sub))return 'en';if(/إسلام/.test(sub))return 'isl';if(/اجتماع/.test(sub))return 'ss';if(/الرياضة المدرسية|التربية البدنية/.test(sub))return 'pe';return 'bio';}
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
  var tKeys=(typeof subjects==='function'?subjects():[]).map(morphKey);
  var base=['bio','chem','ar','en'];
  tKeys.forEach(function(k){if(base.indexOf(k)<0)base.push(k);});
  var order=['bio'].concat(base.filter(function(k){return k!=='bio'&&k!==fin;})).concat([fin]);
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var show=function(k,final){Array.prototype.forEach.call(all,function(e){e.classList.remove('on','final');});var e=byK[k];if(!e)return;void e.offsetWidth;e.classList.add('on');var t=$('mzTag');if(t){t.innerHTML=(final?'مادتك: ':'')+'<b>'+esc(MORPH_NAMES[k])+'</b>';t.classList.add('on');}if(final){e.classList.add('final');box.classList.add('done');}};
  if(reduce){show(fin,true);return;}
  box.classList.remove('done');box.classList.add('alive');show('bio',false);
  var i=0,step=function(){if(!document.body.contains(box))return;i++;if(i>=order.length)return;var last=i===order.length-1;show(order[i],last);if(!last)setTimeout(step,340);};
  setTimeout(step,520);
  box.onclick=function(){runMorph();};
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
    if(!main.length){g.innerHTML='<div class="home-empty">لا توجد أقسام مطابقة للبحث.</div>';}
    else{
      var listCard=function(st){
        var rows=main.filter(function(c){return st.keys.indexOf(c.key)>=0;});
        if(!rows.length)return '';
        return '<section class="kh-step kh-'+st.id+'"><header><div><h2>'+esc(st.name)+'</h2><p>'+esc(st.sub)+'</p></div></header><div class="kh-rows">'+
          rows.map(function(c){return '<button type="button" class="kh-row" data-home="'+esc(c.key)+'"><span class="kh-ic" aria-hidden="true">'+c.icon+'</span><span class="kh-tx"><b>'+esc(c.title)+'</b><small>'+esc(c.sub)+'</small></span><span class="kh-go" aria-hidden="true">افتح</span></button>';}).join('')+'</div></section>';
      };
      var FEAT=[['games','العب مع صفّك','تحدٍّ على السبورة أو بالجوالات','العب'],['cards','قيّم الصف كله','بطاقة لكل طالب وتمسح بالكاميرا','ابدأ']];
      var feats=FEAT.filter(function(f){return main.some(function(c){return c.key===f[0];});}).map(function(f,i){var c=main.filter(function(x){return x.key===f[0];})[0];
        return '<button type="button" class="kh-feat f'+i+'" data-home="'+f[0]+'"><span class="kf-art" aria-hidden="true">'+c.icon+'</span><span class="kf-tx"><b>'+esc(f[1])+'</b><small>'+esc(f[2])+'</small><span class="kf-btn">'+esc(f[3])+'</span></span></button>';}).join('');
      var first=listCard(KH_FLOW[0]),rest=KH_FLOW.slice(1).map(listCard).join('');
      g.innerHTML=(feats||first?'<div class="kh-mid'+(feats?'':' nofeat')+'">'+(feats?'<div class="kh-feats">'+feats+'</div>':'')+first+'</div>':'')+(rest?'<div class="kh-flow">'+rest+'</div>':'');
    }
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
  var tot=lessons.length,done=lessons.filter(function(l){return !isEmpty(l);}).length,seen=Object.keys(viewed||{}).length,pc=tot?Math.round(done/tot*100):0,ps=tot?Math.min(100,Math.round(seen/tot*100)):0;
  var TIPS=[['أرسل التحضير لنور بضغطة','افتح الدرس واضغط «إرسال إلى نور»، والأداة تملأ الخانات وأنت تراجع وتحفظ.'],['اختبار في دقيقة','من «الاختبارات القصيرة» اختر الدروس، والمنصة تكوّن الاختبار بالترويسة الرسمية.'],['حصة أنشط','«الألعاب التعليمية» تحوّل المراجعة إلى تحدٍّ بين الطلاب على السبورة.'],['تابع المتعثرين','ارفع درجات الاختبار في «تحليل النتائج» لتعرف من يحتاج خطة علاجية.']];
  var tip=TIPS[new Date().getDate()%TIPS.length];
  $('panel').innerHTML='<div class="home kh-home"><div class="kh-dash"><div class="kh-col">'+
    '<section class="kh-hero"><div class="kh-hero-tx"><p class="kh-greet">'+khGreet()+(nm?'، '+esc(nm):'')+'</p><h1>حصتك القادمة جاهزة في دقائق</h1><p class="kh-subj">معلم '+esc(teacherSubject())+'</p>'+
      '<button type="button" class="kh-cta" data-home="prep">ابدأ التحضير<i aria-hidden="true">‹</i></button>'+
      '<div class="kh-quick"><button type="button" class="kh-q" data-home="quiz">📝 اختبار جديد</button><button type="button" class="kh-q" data-home="games">🎲 لعبة للصف</button></div></div><div class="kh-hero-art" title="اضغط لإعادة تحريك شعار المادة">'+morphHtml()+'</div></section>'+
    '<div class="kh-stats">'+
      '<div class="kh-stat"><span class="ks-ic" aria-hidden="true">📚</span><div style="flex:1;min-width:0"><b>الدروس المتاحة</b><small>'+tot+' درسًا في مادتك</small><span class="ks-bar"><i style="width:100%"></i></span><span class="ks-pc">'+tot+'</span></div></div>'+
      '<div class="kh-stat"><span class="ks-ic" aria-hidden="true">✅</span><div style="flex:1;min-width:0"><b>تحضير جاهز</b><small>'+done+' من '+tot+' درسًا</small><span class="ks-bar"><i style="width:'+pc+'%"></i></span><span class="ks-pc">'+pc+'%</span></div></div>'+
      '<div class="kh-stat"><span class="ks-ic" aria-hidden="true">👁️</span><div style="flex:1;min-width:0"><b>دروس فتحتها</b><small>'+seen+' درسًا حتى الآن</small><span class="ks-bar"><i style="width:'+ps+'%"></i></span><span class="ks-pc">'+ps+'%</span></div></div>'+
    '</div>'+
    '<input id="homeSearch" class="home-search kh-search" type="search" placeholder="ابحث عن أداة: اختبار، ملخص، لعبة…" value="'+esc(homeQ)+'" aria-label="البحث في أقسام خبير">'+
    '<div id="homeGrid"></div>'+
    '<section class="kh-last"><h3>تقدّم تحضيرك</h3><div class="kl-row"><span class="kl-ic" aria-hidden="true">📋</span><b>تحضير دروس '+esc(teacherSubject())+'</b><span class="kl-bar"><i style="width:'+pc+'%"></i></span><small>'+pc+'% · '+done+' من '+tot+'</small><button type="button" class="kl-btn" data-home="prep">أكمل</button></div></section></div>'+
    '<aside class="kh-rail"><section class="kh-card"><h3>أدوات خبير<span aria-hidden="true">‹</span></h3><h2 class="kh-tools-h" id="homeToolsHead">أدوات خبير</h2><div class="kh-tools" id="homeTools"></div></section>'+
      '<section class="kh-card"><h3>نصيحة اليوم</h3><div class="kh-tip"><img src="/brand/logo.png" alt=""><div><b>'+esc(tip[0])+'</b><p>'+esc(tip[1])+'</p></div></div></section></aside>'+
  '</div></div>';
  renderHomeCards();
  runMorph();
  var inp=$('homeSearch');
  if(inp)inp.oninput=function(){homeQ=this.value;renderHomeCards();};
}
// جملة تعريفية تتبدّل يوميًّا تحت اللوجو في الشريط العلوي
function khQuote(){
  var Q=['حضّر، علّم، وقيّم — كل أدوات المعلم في مكان واحد','وقتك لطلابك، والتحضير والتقويم علينا','من التحضير إلى التحليل والخطط العلاجية بضغطات','رفيق المعلم الذكي قبل الحصة وداخلها وبعدها'];
  return Q[new Date().getDate()%Q.length];
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
  var lsDone=false,lsSlow=setTimeout(function(){if(lsDone)return;var w=$('panel')&&$('panel').querySelector('.welcome');if(!w)return;
    var d=document.createElement('p'),bt=document.createElement('button');d.textContent='التحميل أبطأ من المعتاد… ';bt.type='button';bt.className='btn';bt.textContent='أعد المحاولة';bt.onclick=function(){location.reload();};d.appendChild(bt);w.appendChild(d);},15000);
  Promise.all([api('/api/me'),api('/api/lessons')]).then(function(r){
    lsDone=true;clearTimeout(lsSlow);
    me=r[0];lessons=r[1].lessons;
    // نحمّل القيم الثابتة للمادة الأولى، وتُبدَّل تلقائيًا عند فتح درس مادة أخرى
    useSettingsFor(activeSubject());
    try{var g=lsGet('tahdir_settings_v1');if(g&&g.hwMark!=null)GLOBAL_SET.hwMark=g.hwMark;}catch(e){}
    initNav(me);
    if(location.hash==='#settings'){history.replaceState(null,'','/app');setTimeout(openSettings,50);}
    if(me.role!=='admin'){var ed=lsGet(editsKey())||{};lessons.forEach(function(l){var e=ed[l.id];if(e)Object.keys(e).forEach(function(k){l[k]=e[k];if(l.ai_filled)l.ai_filled=l.ai_filled.filter(function(x){return x!==k;});});});}
    if($('statLessons'))$('statLessons').textContent=lessons.length;if($('statFilled'))$('statFilled').textContent=lessons.filter(function(l){return !isEmpty(l);}).length;if($('kbTopQuote'))$('kbTopQuote').textContent=khQuote();
    renderTree();if(location.hash==="#prep")showPrep();else showHome();
  },function(e){lsDone=true;clearTimeout(lsSlow);showWelcome('تعذّر تحميل الدروس',e.message+' — حدّث الصفحة للمحاولة مرة أخرى.');});
}
// شريط التطبيق السفلي (common.js) ينتقل بين الرئيسية والتحضير بلا إعادة تحميل
window.appShowPrep=showPrep;window.appShowHome=showHome;
init();
})();
