(function(){
'use strict';
guard();
// ---------- ثوابت ----------
var GRADE_NUM={'الأول':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
var HI_AO=['AO1','AO2'],LO_AO=['معرفة','تطبيق','استدلال'];
var AO_TXT={'تذكر وفهم':'تذكر وفهم',AO1:'AO1 · المعرفة والفهم',AO2:'AO2 · التطبيق والتحليل والتقييم','معرفة':'معرفة','تطبيق':'تطبيق','استدلال':'استدلال'};
var TYPE_TXT={mcq:'اختيار من متعدد',short:'إجابة قصيرة',long:'إجابة طويلة'};
var QNO=['الأول','الثاني','الثالث','الرابع'];
var DEF_HDR={dir:'',school:'',year:'2027/2026',term:'الأول'};
var me=null,courses=[],course=null,bank={lessons:[],items:[]},lessonById={},mode='quiz';
// صفحة «الواجبات المنزلية»: نفس محرّك التقويم، لكن القسم واجب منزلي فقط (window.PAGE_MODE==='hw')
var HW=window.PAGE_MODE==='hw';if(HW)mode='hw';
var cfg={quizNo:'الأول',total:10,lessons:{},unit:'',reviewCount:0,dlv:[true,true,true],dn:6};
var hdr=null,doc=null,dirty=false,paperView='quiz';
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function track(type,detail,title){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,grade:course&&course.grade,detail:detail||'',title:title||''})});}catch(e){}}
function gnum(g){return GRADE_NUM[g]||99;}
function isIT(){return !!course&&/تقنية/.test(course.subject||'');}
// التربية الإسلامية: لها جدول مواصفات خاص في وثيقة تقويم تعلم الطلبة (5-12) 2026
function isIslam(){return !!course&&/إسلام/.test(course.subject||'');}
// اللغة العربية: لها مواصفة خاصة في وثيقة تقويم تعلم الطلبة في اللغة العربية (5-12) 2026/2027
function isArabic(){return !!course&&/العربية/.test(course.subject||'');}
// الرياضيات: وثيقة تقويم تعلم الطلبة في مادة الرياضيات (5-10) سبتمبر 2026،
// ووثيقة (11-12) سبتمبر 2026. تشمل «الرياضيات» و«الرياضيات الأساسية/المتقدمة».
function isMath(){return !!course&&/رياض/.test(course.subject||'');}
function isHi(){return course&&gnum(course.grade)>=11&&!isIT()&&!isIslam()&&!isArabic();}
function aoList(){return isIT()?IT_AO:(isIslam()?LO_AO:(isHi()?HI_AO:LO_AO));}
var IT_AO=['تذكر وفهم','تطبيق','استدلال'];
function clone(o){return JSON.parse(JSON.stringify(o));}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
// خلط يفضّل أسئلة الوزارة (التي لها صورة) حتى تظهر في كل المواد مثل الأحياء، وإن كان عددها أقل في بنك المادة
// ترتيب مرجّح للمرشّحين: أسئلة الوزارة بصورها تتقدَّم بوزن أصغر بكثير من غيرها،
// لأنها الأفضل تقويميًا (سؤال أصلي برسمه) وعددها في البنك قليل مقابل الأسئلة الكتابية،
// فبلا هذا الترجيح القوي لا تكاد تدخل ورقة الاختبار.
function shuffleP(a){return a.map(function(x){return [Math.random()*(x&&x.img?0.04:1),x];}).sort(function(p,q){return p[0]-q[0];}).map(function(p){return p[1];});}

// ---------- مواصفات الاختبار حسب الصف (وثيقة تقويم تعلم الطلبة) ----------
// جدول مواصفات الاختبار القصير الرسمي (الصفوف 5–12)
function spec(){
  var g=gnum(course.grade);
  // جدول مواصفات الاختبار القصير — التربية الإسلامية (وثيقة تقويم تعلم الطلبة 5-12 · 2026/2027)
  // الوثيقة الرسمية (Book538076/Book425265): الاختبار القصير =
  //   الصفوف 5-9:  تلاوة القرآن وحفظه (3) + المهارات العقلية والقيم (12) = 15 درجة
  //   الصفوف 10-12: تلاوة القرآن وحفظه (2) + المهارات العقلية والقيم (8)  = 10 درجات
  // (للمهارات العقلية والقيم: اختيار من متعدد + إجابة قصيرة/مقالية، بلا مفردة طويلة للصفوف 5-8)
  if(isIslam()){
    if(g>=10){
      return {total:10,targets:{'معرفة':4,'تطبيق':4,'استدلال':2},mcqCount:2,mcqAos:2,long:{count:0,marks:[]},shortMax:2,items:[5,7],label:'التربية الإسلامية (10-12)'};
    }
    return {total:15,targets:{'معرفة':6,'تطبيق':6,'استدلال':3},mcqCount:3,mcqAos:2,long:{count:0,marks:[]},shortMax:2,items:[9,12],label:'التربية الإسلامية (5-9)'};
  }
  // اللغة العربية — وثيقة تقويم تعلم الطلبة في اللغة العربية (5-12) 2026/2027:
  //   المجموع 15 درجة · عدد المفردات بين 3 و10 · يُنوّع بين الموضوعي والمقالي.
  //   توزيع الدرجات على مجالات الاختبار:
  //     الصفوف 5-10: الفهم 4 · النص 3-4 · القراءة 3-4 · النص الأدبي 2 · التصحيح اللغوي 2
  //     الصفوف 11-12: الفهم 4 · النص 4 · القراءة 4 · النص الأدبي/البلاغة 3 (بلا تصحيح لغوي)
  //   (نُسقط المجالات على أهداف التقويم الثلاثة لتوافق محرّك الاختبار)
  if(isArabic()){
    var tgAr = g>=11 ? {'معرفة':4,'تطبيق':8,'استدلال':3} : {'معرفة':4,'تطبيق':9,'استدلال':2};
    // مفردتا اختيار من متعدد (درجة لكل منهما) تنوّعان بين الموضوعي والمقالي كما تطلب الوثيقة،
    // وتسمحان ببلوغ الدرجات الفردية (تطبيق 9). أسئلة الوزارة المستخرجة مقاطع قصيرة بلا خيارات،
    // فإن خلا البنك من الاختيار من متعدد (مقرر لم يُغنَ بعد) نعود إلى 0 حتى لا يتعطل التوليد.
    var arMcq=(bank.items||[]).filter(function(x){return x.type==='mcq';}).length>=2?2:0;
    return {total:15,targets:tgAr,mcqCount:arMcq,mcqAos:arMcq?2:0,long:{count:0,marks:[]},shortMax:2,items:[3,10],label:'اللغة العربية'};
  }
  // الرياضيات — وثيقة تقويم تعلم الطلبة في مادة الرياضيات (سبتمبر 2026):
  //   الصفوف 5-10: المجموع 10 · المفردات 6-7 · معرفة 4 · تطبيق 4 · استدلال 2
  //     الصعوبة: منخفض 4 · متوسط 4 · مرتفع 2
  //     الصفان 5-6: مفردتان اختيار من متعدد (1 لكل) + 8 درجات أنواع أخرى (4-5 مفردات × 1-2)
  //     الصفوف 7-10: مفردتان اختيار من متعدد (1 لكل) + مفردة إجابة طويلة (3)
  //                  + 5 درجات أنواع أخرى (3-4 مفردات × 1-2)
  //   الصفان 11-12: المجموع 10 · المفردات 5 · هدف التقويم الأول 5 والثاني 5
  //     مفردتان اختيار من متعدد (1 لكل) + مفردتان إجابة قصيرة (2 لكل) + مفردة إجابة طويلة (4)
  if(isMath()){
    // مفردتا اختيار من متعدد في كل ورقة كما تنصّ الوثيقة، والبنك صار يحويها بعد
    // رصد أسئلة «ضع دائرة حول…» بالتخطيط (خيارات قصيرة متباعدة أفقيًّا على سطر).
    if(g>=11){
      return {total:10,targets:{AO1:5,AO2:5},mcqCount:2,mcqAos:2,
              long:{count:1,marks:[4]},shortMax:2,items:[5,7],label:'11–12 (الرياضيات)'};
    }
    // الصفوف 7-10 فيها مفردة إجابة طويلة بثلاث درجات؛ 5-6 بلا إجابة طويلة
    var hasLong = g >= 7;
    return {total:10,targets:{'معرفة':4,'تطبيق':4,'استدلال':2},mcqCount:2,mcqAos:2,
            long:{count:hasLong?1:0,marks:hasLong?[3]:[]},shortMax:2,items:[6,7],
            label:hasLong?'7–10 (الرياضيات)':'5–6 (الرياضيات)'};
  }
  if(isIT()){ // وثيقة تقويم تقنية المعلومات (الاختبار القصير): تذكر وفهم 50% · تطبيق 30% · استدلال 20%
    if(g>=11)return {total:10,targets:{'تذكر وفهم':5,'تطبيق':3,'استدلال':2},mcqCount:2,mcqAos:2,long:{count:1,marks:[3]},shortMax:2,items:[6,8],label:'11–12 (تقنية المعلومات)'};
    if(g>=9)return {total:20,targets:{'تذكر وفهم':10,'تطبيق':6,'استدلال':4},mcqCount:4,mcqAos:2,long:{count:1,marks:[3]},shortMax:2,items:[12,18],label:'9–10 (تقنية المعلومات)'};
    return {total:10,targets:{'تذكر وفهم':5,'تطبيق':3,'استدلال':2},mcqCount:2,mcqAos:2,long:{count:0,marks:[]},shortMax:2,items:[6,10],label:'5–8 (تقنية المعلومات)'};
  }
  if(g>=11)return {total:10,targets:{AO1:3,AO2:7},mcq:{AO1:1,AO2:1},mcqCount:2,long:{count:1,marks:[4,5]},shortMax:3,items:[5,99],label:'11–12'};
  if(g===10)return {total:10,targets:{'معرفة':4,'تطبيق':4,'استدلال':2},mcqCount:2,mcqAos:2,long:{count:1,marks:[3,4]},shortMax:2,items:[5,7],label:'10'};
  if(g===9)return {total:15,targets:{'معرفة':6,'تطبيق':6,'استدلال':3},mcqCount:3,mcqAos:2,long:{count:1,marks:[3,4]},shortMax:2,items:[9,12],label:'9'};
  return {total:15,targets:{'معرفة':6,'تطبيق':6,'استدلال':3},mcqCount:3,mcqAos:2,long:{count:0,marks:[]},shortMax:2,items:[9,12],label:'5–8'};
}
// في الصفوف 5–8 لا توجد مفردة طويلة: المفردات الطويلة بدرجتين تُستخدم كمفردات قصيرة
function prepPool(pool,sp){
  return pool.map(function(x){if(!sp.long.count&&x.type==='long'&&x.marks<=sp.shortMax){var y=clone(x);y.type='short';return y;}return x;})
    .filter(function(x){return x.type==='mcq'||(x.type==='short'&&x.marks<=sp.shortMax)||(x.type==='long'&&sp.long.count&&sp.long.marks.indexOf(x.marks)>=0&&x.ao!=='معرفة'&&x.ao!=='تذكر وفهم');});
}

// ---------- مواصفات الواجب المنزلي (وثيقة تقويم تعلم الطلبة 2026/2027) ----------
// لكل مادة وصف درجةٌ ثابتة للواجب الواحد (تُرصد مرتين في الفصل غالبًا)، وعدد مفردات 3–5
// متنوّعة في أهداف التقويم ومستويات الصعوبة. وبعض المواد/الصفوف تكوينيّة بلا درجة.
// • العلوم/الأحياء/الفيزياء/الكيمياء/العلوم البيئية (5–12): 5 درجات للواجب، 3–5 مفردات.
// • الرياضيات (5–11): 5 درجات؛ الصف 12 تكوينيّ (لا تُرصد درجته).
// • التربية الإسلامية (5–9): 8 درجات = 3 مفردات مقالية (2 لكل) + درجتان للمناقشة؛ 10–12 تكوينيّ.
// • اللغة العربية (5–11): 5 درجات؛ الصف 12 تكوينيّ.
// • تقنية المعلومات: لا واجب منزلي في الوثيقة (يُخفى).
// • اللغة الإنجليزية: تكوينيّ (بلا درجة رصد).
function hwSpec(c){
  c=c||course; if(!c) return null;
  var g=gnum(c.grade), s=c.subject||'';
  var sci=/علوم|أحياء|فيزياء|كيمياء|بيئ/.test(s), it=/تقنية/.test(s), isl=/إسلام/.test(s),
      ar=/العربية/.test(s), en=/انجليز|إنجليز|English/i.test(s), math=/رياض/.test(s);
  var hi = g>=11 && !it && !isl && !ar && !en; // صفوف AO1/AO2
  var aos = hi ? ['AO1','AO2'] : (it ? ['تذكر وفهم','تطبيق','استدلال'] : ['معرفة','تطبيق','استدلال']);
  if(it) return {none:true, label:'تقنية المعلومات'}; // بلا واجب منزلي
  if(isl){
    if(g>=10) return {formative:true, items:[3,4], ao:aos, label:'التربية الإسلامية (10–12)'};
    // 5–9: 3 مفردات مقالية × 2 + درجتان للمناقشة = 8
    return {essay:true, count:3, marksEach:2, discuss:2, total:6, items:[3,3], ao:['تطبيق','استدلال'], label:'التربية الإسلامية (5–9)'};
  }
  if(en) return {formative:true, items:[3,4], ao:aos, label:'اللغة الإنجليزية'};
  if(math){
    if(g>=12) return {formative:true, items:[3,5], ao:aos, label:'الرياضيات (12)'};
    return {total:5, items:[3,5], ao:aos, allowLong:true, label:'الرياضيات (5–11)'};
  }
  if(ar){
    if(g>=12) return {formative:true, items:[3,5], ao:aos, label:'اللغة العربية (12)'};
    return {total:5, items:[3,5], ao:aos, allowLong:true, label:'اللغة العربية (5–11)'};
  }
  // العلوم وفروعها (وأي مادة علمية أخرى): 5 درجات لكل الصفوف
  if(sci) return {total:5, items:[3,5], ao:aos, allowLong:true, label:'العلوم (5–12)'};
  // الافتراضي: 5 درجات
  return {total:5, items:[3,5], ao:aos, allowLong:true, label:(s||'')+' '+c.grade};
}
// وصف نصّي لمواصفة الواجب (يظهر في لوحة الإعداد)
function hwSpecText(sp){
  if(!sp) return '';
  if(sp.none) return 'مادة «'+sp.label+'» ليس لها واجب منزلي يُرصد في وثيقة التقويم.';
  if(sp.essay) return 'حسب الوثيقة ('+sp.label+'): الواجب المنزلي '+(sp.total+sp.discuss)+' درجات — '+sp.count+' مفردات مقالية (درجتان لكل مفردة) + '+sp.discuss+' درجتان للمناقشة مع المعلم.';
  if(sp.formative) return 'حسب الوثيقة ('+sp.label+'): الواجب المنزلي تكوينيّ (لا تُرصد له درجة) — '+sp.items[0]+'–'+sp.items[1]+' مفردات متنوّعة للتدرّب.';
  return 'حسب الوثيقة ('+sp.label+'): الواجب المنزلي '+sp.total+' درجات، '+sp.items[0]+'–'+sp.items[1]+' مفردات متنوّعة في أهداف التقويم ومستويات الصعوبة.';
}
// تجميع مفردات الواجب من الدروس المختارة بحيث يبلغ المجموعُ درجةَ الوثيقة بالضبط
function assembleHw(pool,sp,ids){
  var p=pool.filter(function(x){return x.stem||x.img;}); // مفردات النهائيات المصوّرة (بلا نص) مقبولة كذلك
  var byL=function(arr){var m={};arr.forEach(function(x){(m[x.lesson_id]=m[x.lesson_id]||[]).push(x);});return m;};
  // توزيع متوازن على الدروس المختارة (دورة من كل درس)
  var roundRobin=function(arr,cap){var by=byL(arr),out=[],k=0;Object.keys(by).forEach(function(id){by[id]=shuffleP(by[id]);});
    while(out.length<cap&&k<80){var any=false;ids.forEach(function(id){if(by[id]&&by[id].length&&out.length<cap){out.push(by[id].shift());any=true;}});if(!any)break;k++;}return out;};
  if(sp.essay){ // التربية الإسلامية: 3 مفردات مقالية، درجتان لكل مفردة
    var es=roundRobin(p.filter(function(x){return x.type!=='mcq';}),sp.count);
    if(es.length<sp.count)es=roundRobin(p,sp.count);
    return es.slice(0,sp.count).map(function(x){var y=clone(x);y.marks=sp.marksEach;if(y.type==='mcq'){y.type='short';delete y.choices;delete y.correct;}return y;});
  }
  if(sp.formative){ // واجب تكويني: مفردات متنوّعة بلا مجموع محدد
    var pf=p.filter(function(x){return x.type!=='long'||sp.allowLong;});
    return roundRobin(pf,sp.items[1]).map(clone);
  }
  // واجب برصد: نبلغ المجموع المطلوب بعدد مفردات ضمن [min,max]
  var usable=p.filter(function(x){return x.type==='mcq'||x.type==='short'||(x.type==='long'&&sp.allowLong&&x.marks<=3);});
  var sols=subsets(usable,sp.total,160).filter(function(s){return s.length>=sp.items[0]&&s.length<=sp.items[1];});
  if(sols.length){ // اختر الحل الأفضل: أوسع تغطية للدروس وأكثر تنوّعًا في الأهداف
    var best=null,bs=-1;
    sols.forEach(function(s){var lz={},az={};s.forEach(function(x){lz[x.lesson_id]=1;az[x.ao]=1;});
      var sc=Object.keys(lz).length*10+Object.keys(az).length*4+(s.some(function(x){return x.img;})?2:0)+Math.random()*2;
      if(sc>bs){bs=sc;best=s;}});
    var ord={};ids.forEach(function(id,i){ord[id]=i;});
    return best.slice().sort(function(a,b){return (ord[a.lesson_id]-ord[b.lesson_id])||(tOrd(a)-tOrd(b));}).map(clone);
  }
  // احتياطي: اقترب من المجموع قدر الإمكان بمفردات متوازنة
  var out=[],sum=0;roundRobin(usable,sp.items[1]).forEach(function(x){if(sum>=sp.total||out.length>=sp.items[1])return;if(sum+x.marks<=sp.total){out.push(clone(x));sum+=x.marks;}});
  return out;
}

// ---------- تكوين الاختبار تلقائيًا (بحث دقيق يطابق جدول المواصفات) ----------
function subsets(items,target,maxSol){ // مجموعات عشوائية من المفردات مجموع درجاتها = target
  var out=[],seen={};
  // نرتّب المفردات **بالدرجة تنازليًّا** (مع خلط أولًا لتنويع متساويات الدرجة):
  // بحث DFS يجمع الحلول المتفكّكة أولًا (خمس مفردات بدرجة واحدة لهدف من 5)،
  // فتتجاوز الورقة حدّ عدد المفردات في الوثيقة (5 للصفين 11-12 · 6-7 لغيرهما)
  // ويسقط التوليد إلى الاحتياطي بورقة ناقصة. فتقديم الأكبر درجة يُنتج الحلول
  // المُحكمة (2+2+1) مبكرًا. وترتيب Array.sort مستقرّ فتظلّ المتساويات مخلوطة.
  var arr=shuffleP(items).slice().sort(function(a,b){return b.marks-a.marks;});
  (function dfs(k,sum,cur){
    if(out.length>=maxSol)return;
    if(sum===target){var key=cur.map(function(x){return x.qid;}).sort().join(',');if(!seen[key]){seen[key]=1;out.push(cur.slice());}return;}
    for(var i=k;i<arr.length&&out.length<maxSol;i++){if(sum+arr[i].marks<=target){cur.push(arr[i]);dfs(i+1,sum+arr[i].marks,cur);cur.pop();}}
  })(0,0,[]);
  out.sort(function(a,b){return a.length-b.length;});
  return out;
}
function assemble(pool,sp,lessonIds){
  pool=prepPool(pool,sp);
  var order={};lessonIds.forEach(function(id,i){order[id]=i;});
  var aos=Object.keys(sp.targets),mcqs=pool.filter(function(x){return x.type==='mcq';}),longs=pool.filter(function(x){return x.type==='long';}),shorts=pool.filter(function(x){return x.type==='short';});
  // أسئلة الأشكال المتاحة في الدروس المختارة — لضمان ظهور شكلين في كل نموذج
  var imgPool=pool.filter(function(x){return x.img;}),imgMin=imgPool.length>=2?2:(imgPool.length?1:0);
  var best=null,bestScore=-1e9;
  for(var att=0;att<90;att++){
    // اختيار الاختيار من متعدد
    var mc=[],usedQ={};
    if(sp.mcq){Object.keys(sp.mcq).forEach(function(ao){var c=shuffleP(mcqs.filter(function(x){return x.ao===ao;}));for(var n=0;n<sp.mcq[ao]&&c.length;n++)mc.push(c.shift());});}
    else{var c0=shuffleP(mcqs);for(var n=0;n<c0.length&&mc.length<sp.mcqCount;n++){var x=c0[n];var dist={};mc.concat([x]).forEach(function(y){dist[y.ao]=1;});if(mc.length===sp.mcqCount-1&&Object.keys(dist).length<2)continue;mc.push(x);}}
    if(mc.length!==sp.mcqCount)continue;
    var lg=[];if(sp.long.count){if(!longs.length)continue;lg=[shuffleP(longs)[0]];}
    var need={};aos.forEach(function(a){need[a]=sp.targets[a];});
    mc.concat(lg).forEach(function(x){need[x.ao]-=x.marks;usedQ[x.qid]=1;});
    if(aos.some(function(a){return need[a]<0;}))continue;
    var opts=aos.map(function(a){return need[a]===0?[[]]:subsets(shorts.filter(function(x){return x.ao===a;}),need[a],48);});
    if(opts.some(function(o){return !o.length;}))continue;
    for(var t=0;t<25;t++){
      var pickd=mc.concat(lg);opts.forEach(function(o){pickd=pickd.concat(pick(o));});
      var nI=pickd.length;if(nI<sp.items[0]||nI>sp.items[1])continue;
      // **ضمان صورتين على الأقل** في الورقة: نستبدل عنصرًا غير مصوَّر بآخر مصوَّر
      // من **نفس النوع والدرجات والهدف** — فلا تتغيّر مواصفة الوثيقة إطلاقًا
      // (المجموع والأهداف كما هي)، ويظهر شكلان في كل نموذج.
      if(imgMin){
        var have={};pickd.forEach(function(x){have[x.qid]=1;});
        var cands=shuffleP(imgPool.filter(function(x){return !have[x.qid];}));
        for(var ci=0;ci<cands.length;ci++){
          if(pickd.filter(function(x){return x.img;}).length>=imgMin)break;
          var rep=cands[ci],vi=-1;
          for(var vj=0;vj<pickd.length;vj++){var yy=pickd[vj];if(!yy.img&&yy.type===rep.type&&yy.marks===rep.marks&&yy.ao===rep.ao){vi=vj;break;}}
          if(vi>=0)pickd[vi]=rep;
        }
      }
      var cov={};pickd.forEach(function(x){cov[x.lesson_id]=(cov[x.lesson_id]||0)+1;});
      var nImg=pickd.filter(function(x){return x.img;}).length;
      var spread=Object.keys(cov).length*10-Math.max.apply(null,Object.keys(cov).map(function(k){return cov[k];}))+Math.min(nImg,Math.ceil(nI/2))*4+Math.random()*3;
      if(spread>bestScore){bestScore=spread;best=pickd;}
    }
    if(best&&Object.keys(best.reduce(function(m,x){m[x.lesson_id]=1;return m;},{})).length>=Math.min(lessonIds.length,best.length)&&att>8)break;
  }
  if(!best)best=fallbackAssemble(pool,sp);
  best=best.slice().sort(function(a,b){return (order[a.lesson_id]-order[b.lesson_id])||(tOrd(a)-tOrd(b));});
  var longs2=best.filter(function(x){return x.type==='long';});best=best.filter(function(x){return x.type!=='long';}).concat(longs2);
  return best.map(clone);
}
function fallbackAssemble(pool,sp){ // إن لم يوجد حل مطابق تمامًا (مثل درس واحد فقط) نأخذ أقرب اختبار
  var rem=clone(sp.targets),out=[],used={};
  shuffleP(pool).forEach(function(x){if(used[x.qid])return;var mcN=out.filter(function(y){return y.type==='mcq';}).length,lgN=out.filter(function(y){return y.type==='long';}).length;
    if(x.type==='mcq'&&mcN>=sp.mcqCount)return;if(x.type==='long'&&lgN>=sp.long.count)return;
    if((rem[x.ao]||0)>=x.marks){out.push(x);used[x.qid]=1;rem[x.ao]-=x.marks;}});
  return out;
}
function tOrd(x){return {mcq:0,short:1,long:2}[x.type]||1;}

// ---------- أدوات النص ----------
function rich(t){return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');}
function lessonOf(it){return lessonById[it.lesson_id]||{};}
function tableLabel(n){return 'الجدول ('+n+')';}
function relabel(s,n){return String(s||'').replace(/الجدول\s*\(\s*[\d-]+\s*\)/g,tableLabel(n));}
function lineCount(it){if(it.type==='mcq')return 0;var m=+it.marks||1;if(it.lines)return it.lines;return it.type==='long'?Math.max(4,Math.ceil(m*1.6)):(m===1?1:m+1);}

// ---------- ورقة الاختبار (تُستخدم للشاشة والطباعة وملف Word) ----------
function titleText(d,key){
  var subj=d.subject,gr=d.grade;
  if(d.kind==='homework'){
    var pre=key?'نموذج إجابة ':'';
    var base=d.hwFormative?'الواجب المنزلي لمادة '+subj+' للصف '+gr:'الواجب المنزلي '+(d.quizNo||'الأول')+' لمادة '+subj+' للصف '+gr;
    return pre+base+(d.model&&!key?' (نموذج '+d.model+')':'');
  }
  if(d.kind==='diff')return (key?'نموذج إجابة ':'')+'أوراق عمل متمايزة — مادة '+subj+' للصف '+gr;
  if(d.kind==='remedy')return (key?'نموذج إجابة ':'')+'ورقة عمل علاجية — مادة '+subj+' للصف '+gr;
  if(d.kind==='review')return (key?'نموذج إجابة ':'')+'مراجعة نهاية الوحدة '+(d.unit||'')+(d.unit_name?': '+d.unit_name:'')+' — مادة '+subj+' للصف '+gr;
  return (key?'نموذج إجابة ':'')+'الاختبار القصير '+d.quizNo+' لمادة '+subj+' للصف '+gr;
}
function headerHtml(d,key,word){
  var h=d.hdr||hdr,tot=d.kind==='homework'?hwTotal(d):sumMarks(d.items);
  var noBox=key||(d.kind==='homework'&&d.hwFormative);
  var box=noBox?'':'<table class="sbox" style="border-collapse:collapse;margin:0 auto"><tr><td style="border:1.5px solid #000;width:64px;height:28px"></td></tr><tr><td style="border:1.5px solid #000;width:64px;height:28px;text-align:center;font-weight:bold">'+tot+'</td></tr></table>';
  var stu=d.kind==='homework'
    ? (key?false:'اسم الطالب: ________________________ &nbsp; الصف: ______ &nbsp; التاريخ: __________')
    : !(key||d.kind==='review'&&!d.studentLine);
  return OFFICIAL_HEAD({dir:h.dir,school:h.school,title:titleText(d,key),line2:'الفصل الدراسي: '+h.term+' - العام الدراسي: '+h.year+'م',
    student:stu,box:box,word:word});
}
function sumMarks(items){return items.reduce(function(s,x){return s+(+x.marks||0);},0);}
function hwTotal(d){return sumMarks(d.items)+(d.hwDiscuss||0);}
// الاختبارات المحفوظة قبل إضافة مواضع أرقام الأشكال: نأخذها من بنك الأسئلة الحالي
function withLb(it){
  if(it&&it.img&&!it.lb&&bank&&bank.items){for(var j=0;j<bank.items.length;j++){var b=bank.items[j];if(b.img===it.img){if(b.lb)it.lb=b.lb;if(!it.srcno&&b.srcno)it.srcno=b.srcno;break;}}}
  return it;
}
function itemHtml(it,n,tno,word,ctrl){
  withLb(it);
  var stem=it.table?relabel(it.stem,tno):it.stem;
  stem=finRelabel(stem,it.srcno,n);
  // أساس الأمان للطباعة: الرقم لا ينفصل عن سؤال. يُرفع للطباعة عبر #printArea،
  // ولأن .qi عنصر واحد فلا يتقسّم على صفحتين (page-break-inside:avoid في CSS).
  var h='<div class="qi" data-i="'+(n-1)+'" style="margin:0 0 '+(word?'10pt':'16px')+';page-break-inside:avoid;break-inside:avoid">';
  if(ctrl)h+=ctrl;
  // `fig` = صورة توضيحية داخل سؤال نصّي (فيها الشكل فقط).
  // وبلا `fig` = سؤال وزراي مصوَّر تكون الصورة نفسها نصّ السؤال — يُعرض وحده كما كان.
  if(it.img&&!it.fig){
    var W=word?Math.min(560,it.iw||560):0;
    // الصورة نفسها تحمل نص السؤال ورسومه. نضع الرقم **ملاصقًا** لأعلى الصورة بلا
    // فراغ (كما في الأسئلة الكتابية: «3) نص السؤال»)، فلا يبدو الرقم منفصلًا عن
    // سؤاله. ونمنع انقسام السؤال على صفحتين فلا يبقى الرقم وحده أسفل الورقة.
    h+='<div style="page-break-inside:avoid;break-inside:avoid">'+
      '<p style="margin:0;line-height:1"><b>'+n+')</b></p>'+
      '<img '+finImgAttr(it,n,location.origin)+' alt="" style="display:block;max-width:100%;vertical-align:top;'+(W?'width:'+W+'px;':'')+'margin:0 auto"></div>';
    return h+'</div>';
  }
  h+='<p style="margin:0 0 4px"><b>'+n+')</b> '+rich(stem)+'</p>';
  // صورة توضيحية داخل سؤال **نصّي** (شكل/رسم يُقرأ مع النص) — تُعرض بعد السؤال
  // ولا تُلغي النص. التمييز: وجود نص في stem يعني أن الصورة شكل فقط.
  if(it.img){
    var W2=word?Math.min(520,it.iw||520):0;
    h+='<div style="page-break-inside:avoid;break-inside:avoid;text-align:center;margin:6px 0 8px">'+
      '<img '+finImgAttr(it,n,location.origin)+' alt="" style="max-width:100%;'+(W2?'width:'+W2+'px;':'')+'"></div>';
  }
  if(it.table&&it.table.rows){
    h+='<table class="qt" style="border-collapse:collapse;margin:6px auto 6px;min-width:55%">'+(it.table.caption?'<caption style="font-weight:bold;padding:2px">'+esc(relabel(it.table.caption,tno))+'</caption>':'');
    it.table.rows.forEach(function(r,ri){h+='<tr>'+r.map(function(c){return (ri?'<td':'<th')+' style="border:1px solid #000;padding:3px 10px;text-align:center'+(ri?'':';background:#eee')+'">'+rich(c)+(ri?'</td>':'</th>');}).join('')+'</tr>';});
    h+='</table>';
  }
  if(it.type==='mcq'){
    h+='<p style="margin:2px 0 4px;font-weight:bold;color:#9b1c1c">(ظلّل الشكل ( '+(word?'⬭':'<span class="oval"></span>')+' ) المقترن بالإجابة الصحيحة)</p>';
    h+='<table class="chs" style="width:100%;border-collapse:collapse">';
    for(var r=0;r<2;r++){h+='<tr>';for(var c=0;c<2;c++){var k=r*2+c,ch=(it.choices||[])[k];h+='<td style="width:50%;padding:3px 4px;vertical-align:top">'+(ch==null?'':(word?'⬭ ':'<span class="oval"></span> ')+rich(ch))+'</td>';}h+='</tr>';}
    h+='</table><div style="text-align:left;font-weight:bold">['+it.marks+']</div>';
  }else{
    var L=lineCount(it);
    for(var i=0;i<L;i++)h+='<div class="aline" style="border-bottom:1px solid #000;height:'+(word?'20pt':'28px')+';margin:0 0 2px'+(i===L-1?';position:relative':'')+'">'+(i===L-1?'<span style="float:left;font-weight:bold;background:#fff;padding:0 4px">['+it.marks+']</span>':'')+'</div>';
  }
  return h+'</div>';
}
function quizHtml(d,word,withCtrl){
  if(d.kind==='diff')return diffHtml(d,word,withCtrl,false);
  var h=headerHtml(d,false,word),tno=0,lastL=null;
  d.items.forEach(function(it,i){
    if(d.kind==='review'&&it.lesson_id!==lastL){lastL=it.lesson_id;var L=lessonOf(it);h+='<h4 style="margin:14px 0 8px;font-size:'+(word?'12pt':'1em')+';border-bottom:1px dashed #888">الدرس: '+esc(L.title||'')+'</h4>';}
    if(it.table)tno++;
    h+=itemHtml(it,i+1,tno,word,withCtrl?ctrlHtml(i):'');
  });
  var foot='';
  if(d.kind==='homework'){
    if(d.hwDiscuss)foot+='<div style="margin:12px 0 4px;padding:6px 10px;border:1px dashed #000;page-break-inside:avoid"><b>المناقشة مع المعلم:</b> يناقش المعلمُ الطالبَ في حلّه ويرصد له <b>['+d.hwDiscuss+']</b> ضمن درجة الواجب.</div>';
    if(d.hwFormative)foot+='<p style="font-size:.9em;color:#444;margin:8px 0">هذا واجب تكوينيّ للتدرّب — لا تُرصد له درجة في سجل التقويم المستمر وفق الوثيقة.</p>';
  }
  return h+foot+'<p style="text-align:center;font-weight:bold;margin-top:18px">ـ انتهت الأسئلة ـ</p>';
}
function keyHtml(d,word){
  if(d.kind==='diff'&&!d._one)return diffHtml(d,word,false,true);
  var hi=gnum(d.grade)>=11,tno=0;
  var th=function(t){return '<th style="border:1px solid #000;padding:4px;background:#dce9f5;font-size:'+(word?'10pt':'.85em')+'">'+t+'</th>';};
  var td=function(t,al){return '<td style="border:1px solid #000;padding:4px 6px;vertical-align:top;'+(al?'text-align:'+al+';':'')+'font-size:'+(word?'10pt':'.88em')+'">'+t+'</td>';};
  var h=headerHtml(d,true,word)+(hi?'<p style="text-align:center;margin:-4px 0 8px">المادة: '+esc(d.subject)+'</p>':'');
  h+='<table class="keyt" style="width:100%;border-collapse:collapse"><thead><tr>'+th('المفردة')+th('الإجابة')+th('الدرجة')+(hi?th('المعلومات الإضافية')+th('الوحدة'):'')+th('هدف التعلم')+th('هدف التقويم')+(hi?th('مستوى الصعوبة'):'')+'</tr></thead><tbody>';
  d.items.forEach(function(it,i){
    if(it.table)tno++;
    withLb(it);
    var ans=(it.type==='mcq'&&!it.img)?rich(finRelabel((it.choices||[])[it.correct]||'',it.srcno,i+1)):rich(finRelabel(it.table?relabel(it.answer,tno):it.answer,it.srcno,i+1));
    var notes=it.notes?rich(finRelabel(it.table?relabel(it.notes,tno):it.notes,it.srcno,i+1)):'';
    if(!hi&&notes)ans+='<div style="font-size:.85em;color:#444">'+notes+'</div>';
    var L=lessonOf(it);
    h+='<tr>'+td(i+1,'center')+td(ans)+td(it.marks,'center')+(hi?td(notes)+td(esc(L.unit||''),'center'):'')+td(esc(it.outcome||''),'center')+td(esc(it.ao||''),'center')+(hi?td(esc(it.difficulty||''),'center'):'')+'</tr>';
  });
  if(d.kind==='homework'&&d.hwDiscuss)h+='<tr>'+td('المناقشة','center')+td('مناقشة الطالب في حلّه')+td(d.hwDiscuss,'center')+(hi?td('')+td(''):'')+td('')+td('')+(hi?td(''):'')+'</tr>';
  h+='<tr>'+td('<b>المجموع</b>','center')+td('')+td('<b>'+(d.kind==='homework'?hwTotal(d):sumMarks(d.items))+'</b>','center')+(hi?td('')+td(''):'')+td('')+td(aoSummary(d))+(hi?td(''):'')+'</tr>';
  return h+'</tbody></table><p style="text-align:center;font-weight:bold;margin-top:14px">ـ نهاية نموذج الإجابة ـ</p>';
}
// كل مستوى ورقة مستقلة بترويستها، وتبدأ في صفحة جديدة عند الطباعة
function lessonNames(d){var seen={},n=[];d.items.forEach(function(x){var t=(lessonOf(x).title||'');if(t&&!seen[t]){seen[t]=1;n.push(t);}});return n.join('، ');}
// مفردة أُضيفت يدويًا بلا مستوى تُلحق بآخر مستوى في الأوراق
function lvOf(d,x){if(x.lv!=null)return x.lv;var m=0;d.items.forEach(function(y){if(y.lv!=null&&y.lv>m)m=y.lv;});return m;}
function diffHtml(d,word,withCtrl,key){
  var h='',first=true,H=d.hdr||hdr;
  DIFF_LV.forEach(function(L,lv){
    var idx=[];d.items.forEach(function(x,i){if(lvOf(d,x)===lv)idx.push(i);});if(!idx.length)return;
    if(!first)h+=word?'<br clear="all" style="page-break-before:always">':'<div class="pbreak" style="page-break-before:always;break-before:page;height:0"></div><hr class="no-print" style="border:0;border-top:3px dashed #9bb;margin:26px 0">';
    first=false;
    var sub={kind:'remedy',hdr:H,subject:d.subject,grade:d.grade,items:idx.map(function(i){return d.items[i];}),_one:1};
    var title=(key?'نموذج إجابة ':'')+'ورقة عمل — '+L.name+' — '+d.subject+' للصف '+d.grade;
    var head=OFFICIAL_HEAD({dir:H.dir,school:H.school,title:title,line2:'الدرس: '+lessonNames(sub),student:!key,word:word});
    if(key){h+=keyHtml(sub,word).replace(/^[\s\S]*?<hr[^>]*>/,head);return;}
    h+=head;var tno=0;
    idx.forEach(function(i,k){var it=d.items[i];if(it.table)tno++;h+=itemHtml(it,k+1,tno,word,withCtrl?ctrlHtml(i):'');});
    h+='<p style="text-align:center;font-weight:bold;margin-top:14px">ـ انتهت الأسئلة ـ</p>';
  });
  return h;
}
function aoSummary(d){var s={};d.items.forEach(function(x){s[x.ao]=(s[x.ao]||0)+(+x.marks||0);});return Object.keys(s).map(function(k){return esc(k)+': '+s[k];}).join('<br>');}
function ctrlHtml(i){
  return '<div class="qctl no-print"><span class="qmeta" data-meta="'+i+'"></span><span class="qbtns">'+
    '<button type="button" class="btn small" data-act="up" data-i="'+i+'" title="لأعلى">↑</button><button type="button" class="btn small" data-act="down" data-i="'+i+'" title="لأسفل">↓</button>'+
    '<button type="button" class="btn small" data-act="swap" data-i="'+i+'">استبدال</button><button type="button" class="btn small" data-act="edit" data-i="'+i+'">تعديل</button><button type="button" class="btn small danger" data-act="del" data-i="'+i+'">حذف</button></span></div>';
}

// ---------- مطابقة الوثيقة ----------
function checks(d){
  var out=[],items=d.items,tot=sumMarks(items),mc=items.filter(function(x){return x.type==='mcq';}),lg=items.filter(function(x){return x.type==='long';}),sh=items.filter(function(x){return x.type==='short';});
  var ao={};items.forEach(function(x){ao[x.ao]=(ao[x.ao]||0)+(+x.marks||0);});
  if(d.kind==='homework'){
    var hs=hwSpec({subject:d.subject,grade:d.grade});
    if(!hs||hs.none){out.push([true,'لا واجب منزلي لهذه المادة في الوثيقة']);return out;}
    var az={},lz={};items.forEach(function(x){az[x.ao]=1;lz[x.lesson_id]=1;});
    if(hs.formative){out.push([items.length>=hs.items[0],'واجب تكوينيّ — '+items.length+' مفردة (لا تُرصد درجة)']);out.push([Object.keys(az).length>=2,'تنوّع أهداف التقويم: '+Object.keys(az).join('، ')]);return out;}
    if(hs.essay){out.push([items.length===hs.count,items.length+' مفردات مقالية (المطلوب '+hs.count+')']);out.push([tot===hs.total,'درجة الأسئلة '+tot+' من '+hs.total]);out.push([true,'+ '+hs.discuss+' درجتان للمناقشة = المجموع '+(hs.total+hs.discuss)]);return out;}
    out.push([tot===hs.total,'الدرجة الكلية '+tot+' من '+hs.total]);
    out.push([items.length>=hs.items[0]&&items.length<=hs.items[1],'عدد المفردات '+items.length+' (من '+hs.items[0]+' إلى '+hs.items[1]+')']);
    out.push([Object.keys(az).length>=2,'تنوّع أهداف التقويم: '+Object.keys(az).join('، ')]);
    out.push([true,'يغطّي '+Object.keys(lz).length+' درسًا من الدروس المختارة']);
    return out;
  }
  if(d.kind==='diff'){DIFF_LV.forEach(function(L,lv){var it=items.filter(function(x){return lvOf(d,x)===lv;});if(it.length)out.push([true,L.name+': '+it.length+' مفردة، '+sumMarks(it)+' درجة']);});return out;}
  if(d.kind==='review'||d.kind==='remedy'){out.push([true,items.length+' مفردة، المجموع '+tot+' درجة'+(d.kind==='remedy'?' — من الدروس والمستويات الأضعف في تحليل النتائج':'')]);return out;}
  var sp=spec();
  out.push([tot===sp.total,'الدرجة الكلية '+tot+' من '+sp.total]);
  aoList().forEach(function(k){var t=sp.targets[k]||0,v=ao[k]||0;out.push([v===t,k+': '+v+' درجة (المطلوب '+t+')']);});
  out.push([items.length>=sp.items[0]&&items.length<=sp.items[1],'عدد المفردات '+items.length+(sp.items[1]<99?' (من '+sp.items[0]+' إلى '+sp.items[1]+')':' (لا يقل عن '+sp.items[0]+')')]);
  if(isHi()){
    var m1=mc.filter(function(x){return x.ao==='AO1';}).length,m2=mc.filter(function(x){return x.ao==='AO2';}).length;
    out.push([mc.length===2&&m1>=1&&m2>=1,'اختيار من متعدد: '+mc.length+' (مفردتان: واحدة AO1 والأخرى AO2)']);
  }else{
    var a={};mc.forEach(function(x){a[x.ao]=1;});
    out.push([mc.length===sp.mcqCount&&Object.keys(a).length>=2,'اختيار من متعدد: '+mc.length+' (المطلوب '+sp.mcqCount+' تغطي هدفي تقويم على الأقل)']);
  }
  if(sp.long.count)out.push([lg.length===1&&lg.every(function(x){return sp.long.marks.indexOf(x.marks)>=0&&x.ao!=='معرفة'&&x.ao!=='تذكر وفهم';}),'إجابة طويلة: '+lg.length+(lg.length?' ('+lg.map(function(x){return x.marks;}).join('، ')+' درجات)':'')+' — مفردة واحدة من '+sp.long.marks[0]+' إلى '+sp.long.marks[sp.long.marks.length-1]+' درجات'+(isHi()?'':' وليست من مستوى المعرفة')]);
  else out.push([lg.length===0,'إجابة طويلة: '+lg.length+' (لا توجد في الصفوف 5–8)']);
  out.push([sh.every(function(x){return x.marks<=sp.shortMax;}),'الإجابة القصيرة: '+sh.length+' مفردة، كل منها من 1 إلى '+sp.shortMax+' درجة']);
  var ls={};items.forEach(function(x){ls[x.lesson_id]=1;});var n=Object.keys(ls).length;
  out.push([n>=2&&n<=5,'يغطي '+n+' دروس (من 2 إلى 5 دروس)']);
  return out;
}
// ---------- الواجهة ----------
var QX=function(c){return c.quiz_items?'':' (بدون بنك أسئلة)';};
function renderSide(){
  var h='<section class="qcard"><h3>1. المادة والصف</h3>'+coursePick(courses,course&&course.key,'courseSel',QX)+
    (HW?'':'<div class="seg" role="tablist"><button type="button" class="'+(mode==='quiz'?'on':'')+'" data-mode="quiz">اختبار قصير</button><button type="button" class="'+(mode==='review'?'on':'')+'" data-mode="review">مراجعة نهاية الوحدة</button><button type="button" class="'+(mode==='diff'?'on':'')+'" data-mode="diff">أوراق متمايزة</button></div>')+'</section>';
  if(!course){$('qside').innerHTML=h;bindSide();return;}
  var units=unitsList();
  if(mode==='hw'){
    var hs=hwSpec();
    if(hs&&hs.none){
      h+='<section class="qcard"><p class="muted">'+esc(hwSpecText(hs))+' اختر مادة أخرى.</p></section>';
    }else{
      h+='<section class="qcard"><h3>2. الدروس المشمولة <span class="muted">(اختر درسًا أو أكثر)</span></h3><div class="lpick">';
      units.forEach(function(u){
        h+='<div class="lp-unit"><div class="lp-uh">الوحدة '+esc(u.unit)+(u.name?': '+esc(u.name):'')+'</div>';
        u.lessons.forEach(function(l){var n=bank.items.filter(function(x){return x.lesson_id===l.id;}).length;
          h+='<label class="lp-l'+(n?'':' dim')+'"><input type="checkbox" data-lid="'+l.id+'"'+(cfg.lessons[l.id]?' checked':'')+(n?'':' disabled')+'> <span>'+esc(l.title)+'</span><span class="muted">'+n+'</span></label>';});
        h+='</div>';
      });
      h+='</div></section><section class="qcard"><h3>3. الواجب</h3>'+
        (hs&&hs.formative?'':'<label class="qrow">رقم الواجب <select id="qnoSel" class="qsel sm">'+QNO.slice(0,2).map(function(q){return '<option'+(cfg.quizNo===q?' selected':'')+'>'+q+'</option>';}).join('')+'</select></label>')+
        '<p class="muted small">'+hwSpecText(hs)+' أسئلته من بنك الأسئلة والاختبارات النهائية السابقة.</p>'+
        '<button type="button" class="btn primary go-btn" id="makeBtn">كوّن الواجب</button></section>';
    }
  }else if(mode==='quiz'||mode==='diff'){
    h+='<section class="qcard"><h3>2. الدروس المشمولة <span class="muted">'+(mode==='diff'?'(درس أو أكثر)':'(من 2 إلى 5)')+'</span></h3><div class="lpick">';
    units.forEach(function(u){
      h+='<div class="lp-unit"><div class="lp-uh">الوحدة '+esc(u.unit)+(u.name?': '+esc(u.name):'')+'</div>';
      u.lessons.forEach(function(l){var n=bank.items.filter(function(x){return x.lesson_id===l.id;}).length;
        h+='<label class="lp-l'+(n?'':' dim')+'"><input type="checkbox" data-lid="'+l.id+'"'+(cfg.lessons[l.id]?' checked':'')+(n?'':' disabled')+'> <span>'+esc(l.title)+'</span><span class="muted">'+n+'</span></label>';});
      h+='</div>';
    });
    if(mode==='diff')h+='</div></section><section class="qcard"><h3>3. المستويات</h3><p class="muted small">ورقة لكل مستوى من نفس الدروس: <b>أساسي</b> (دعم وصعوبات التعلم) · <b>متوسط</b> · <b>إثرائي</b> (للمتفوقين).</p>'+
      DIFF_LV.map(function(L,i){return '<label class="qrow"><input type="checkbox" data-dlv="'+i+'"'+(cfg.dlv[i]?' checked':'')+'> '+L.name+' <span class="muted small">'+L.hint+'</span></label>';}).join('')+
      '<label class="qrow">عدد المفردات في كل ورقة <select id="dnSel" class="qsel sm">'+[5,6,8,10].map(function(n){return '<option'+(cfg.dn===n?' selected':'')+'>'+n+'</option>';}).join('')+'</select></label>'+
      '<button type="button" class="btn primary go-btn" id="makeBtn">كوّن الأوراق</button></section>';
    else h+='</div></section><section class="qcard"><h3>3. الإعدادات</h3><label class="qrow">رقم الاختبار <select id="qnoSel" class="qsel sm">'+QNO.map(function(q){return '<option'+(cfg.quizNo===q?' selected':'')+'>'+q+'</option>';}).join('')+'</select></label>'+
      '<p class="muted small">'+specText()+'</p>'+
      '<button type="button" class="btn primary go-btn" id="makeBtn">كوّن الاختبار</button></section>';
  }else{
    h+='<section class="qcard"><h3>2. الوحدة</h3><select id="unitSel" class="qsel">'+units.map(function(u){return '<option value="'+esc(u.unit)+'"'+(cfg.unit===u.unit?' selected':'')+'>الوحدة '+esc(u.unit)+(u.name?': '+esc(u.name):'')+'</option>';}).join('')+'</select>'+
      '<label class="qrow">عدد المفردات <select id="rcSel" class="qsel sm">'+[[0,'كل مفردات الوحدة'],[12,'12'],[20,'20'],[30,'30']].map(function(o){return '<option value="'+o[0]+'"'+(+cfg.reviewCount===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>'+
      '<button type="button" class="btn primary go-btn" id="makeBtn">كوّن المراجعة</button></section>';
  }
  h+='<section class="qcard"><h3>رأس الورقة</h3><div class="hdr-f">'+
    '<label>المديرية<input id="h_dir" value="'+esc(hdr.dir)+'"></label><label>المدرسة<input id="h_school" value="'+esc(hdr.school)+'"></label>'+
    '<label>الفصل الدراسي<select id="h_term"><option'+(hdr.term==='الأول'?' selected':'')+'>الأول</option><option'+(hdr.term==='الثاني'?' selected':'')+'>الثاني</option></select></label><label>العام الدراسي<input id="h_year" value="'+esc(hdr.year)+'" class="ltr"></label></div></section>'+
    '<section class="qcard"><h3>'+(HW?'واجباتي المحفوظة':'اختباراتي المحفوظة')+'</h3><ul class="saved" id="savedList"><li class="muted">جارٍ التحميل…</li></ul></section>';
  $('qside').innerHTML=h;bindSide();loadSaved();
}
function specText(){var sp=spec(),t=Object.keys(sp.targets).map(function(k){return k+' '+sp.targets[k];}).join('، ');
  return 'حسب جدول مواصفات الاختبار القصير (الصف '+sp.label+'): '+sp.total+' درجة ('+t+')، '+(sp.items[1]<99?'من '+sp.items[0]+' إلى '+sp.items[1]:'لا يقل عن '+sp.items[0])+' مفردات، '+sp.mcqCount+' اختيار من متعدد، '+(sp.long.count?'ومفردة طويلة واحدة ('+sp.long.marks.join('–')+' درجات)':'بدون مفردة طويلة')+'، والباقي إجابة قصيرة (1–'+sp.shortMax+').';}
function unitsList(){
  var m={},order=[];bank.lessons.forEach(function(l){var k=String(l.unit);if(!m[k]){m[k]={unit:k,name:l.unit_name||'',lessons:[]};order.push(k);}m[k].lessons.push(l);});
  return order.sort(function(a,b){return parseInt(a,10)-parseInt(b,10);}).map(function(k){return m[k];});
}
function bindSide(){
  bindCoursePick(courses,'courseSel',selectCourse,QX);
  Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'),function(b){b.onclick=function(){mode=b.getAttribute('data-mode');renderSide();};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-lid]'),function(b){b.onchange=function(){var id=+b.getAttribute('data-lid');if(b.checked)cfg.lessons[id]=1;else delete cfg.lessons[id];var n=Object.keys(cfg.lessons).length;if(n>5&&mode==='quiz')toast('الوثيقة: الاختبار القصير يغطي من 2 إلى 5 دروس');};});
  if($('qnoSel'))$('qnoSel').onchange=function(){cfg.quizNo=this.value;if(doc&&(doc.kind==='quiz'||doc.kind==='homework')){doc.quizNo=this.value;renderDoc();}};
  if($('totSel'))$('totSel').onchange=function(){cfg.total=+this.value;};
  if($('unitSel'))$('unitSel').onchange=function(){cfg.unit=this.value;};
  if($('rcSel'))$('rcSel').onchange=function(){cfg.reviewCount=+this.value;};
  Array.prototype.forEach.call(document.querySelectorAll('[data-dlv]'),function(b){b.onchange=function(){cfg.dlv[+b.getAttribute('data-dlv')]=b.checked;};});
  if($('dnSel'))$('dnSel').onchange=function(){cfg.dn=+this.value;};
  if($('makeBtn'))$('makeBtn').onclick=make;
  ['dir','school','year','term'].forEach(function(k){var el=$('h_'+k);if(el)el.onchange=function(){hdr[k]=el.value.trim()||DEF_HDR[k];lsSet(hdrKey(),hdr);if(doc){doc.hdr=clone(hdr);renderDoc();}};});
}
function hdrKey(){return 'tahdir_quiz_hdr_'+(me?me.username:'');}
var bankSeq=0; // رقم طلب بنك الأسئلة: يمنع نتيجة صف قديم من الكتابة فوق الصف الحالي
function selectCourse(key){
  course=courses.filter(function(c){return c.key===key;})[0]||null;cfg.lessons={};cfg.unit='';
  if(!course){renderSide();return;}
  lsSet('tahdir_quiz_course',key);
  cfg.total=gnum(course.grade)===5?10:15;
  // على الصف الجديد لا معنى لورقة الصف القديم: نمسحها حتى لا تُحفظ على الصف الخطأ
  if(doc&&doc.course!==course.key){doc=null;dirty=false;paperView='quiz';}
  var seq=++bankSeq;
  $('qmain').innerHTML='<div class="welcome"><h2>جارٍ تحميل بنك الأسئلة…</h2></div>';
  return api('/api/quiz/bank?key='+encodeURIComponent(key)).then(function(r){
    if(seq!==bankSeq)return; // وصلت متأخرة بعد تبديل صف آخر
    bank=r;lessonById={};bank.lessons.forEach(function(l){lessonById[l.id]=l;});
    var u=unitsList();cfg.unit=u.length?u[0].unit:'';
    renderSide();
    if(!doc)welcome();
  },function(e){if(seq===bankSeq)toast(e.message);});
}
function welcome(){
  var n=bank.items.length;
  if(HW){
    var hs=hwSpec();
    $('qmain').innerHTML='<div class="welcome qwel"><h2>الواجبات المنزلية</h2><p>'+
      (hs&&hs.none?esc(hwSpecText(hs))+' اختر مادة أخرى من القائمة.':
       (n?esc(hwSpecText(hs))+' اختر الدرس (أو أكثر) من القائمة ثم اضغط «كوّن الواجب»، فتُسحب الأسئلة من بنك الأسئلة والاختبارات النهائية السابقة.':'لا توجد أسئلة جاهزة لهذا الصف بعد في بنك الأسئلة.'))+'</p>'+
      '<div class="welcome-steps"><span>1. اختر الدرس</span><span>2. كوّن الواجب</span><span>3. استبدل أو عدّل</span><span>4. اطبع بالترويسة أو Word</span></div></div>';
    return;
  }
  $('qmain').innerHTML='<div class="welcome qwel"><h2>التقويم: اختبارات قصيرة ومراجعات</h2><p>'+(n?'في بنك الأسئلة '+n+' مفردة لهذا الصف، مكتوبة من مخرجات التعلم في كل درس ووفق «وثيقة تقويم تعلم الطلبة». اختر الدروس من القائمة ثم اضغط «كوّن الاختبار».':'لا توجد أسئلة جاهزة لهذا الصف بعد. يمكنك تكوين اختبار وكتابة مفرداتك بنفسك.')+'</p>'+
    '<div class="welcome-steps"><span>1. اختر الدروس</span><span>2. كوّن الاختبار</span><span>3. استبدل أو عدّل ما تريد</span><span>4. اطبع أو حمّل Word</span></div>'+(n?'':'<p><button type="button" class="btn primary" id="blankBtn">اختبار فارغ أكتب مفرداته</button></p>')+'</div>';
  if($('blankBtn'))$('blankBtn').onclick=function(){newDoc('quiz',[]);};
}
function poolFor(ids){var s={};ids.forEach(function(i){s[i]=1;});return bank.items.filter(function(x){return s[x.lesson_id];});}
function lessonOrder(){return bank.lessons.map(function(l){return l.id;});}
function newDoc(kind,items,extra){
  doc=Object.assign({kind:kind,subject:course.subject,grade:course.grade,course:course.key,quizNo:cfg.quizNo,total:cfg.total,hdr:clone(hdr),items:items,lessons:Object.keys(cfg.lessons).map(Number),id:null,title:''},extra||{});
  doc.spec=kind==='quiz'?spec(cfg.total):null;
  dirty=true;paperView='quiz';renderDoc();
}
// نموذج آخر للاختبار نفسه: نفس الدروس والمواصفات بأسئلة مختلفة قدر الإمكان
function remakeDoc(){
  if(!doc)return;
  var ids=(doc.lessons&&doc.lessons.length?doc.lessons:doc.items.map(function(x){return x.lesson_id;})).map(Number).filter(function(v,i,a){return a.indexOf(v)===i;});
  if(!course||course.key!==doc.course){var c=courses.filter(function(x){return x.key===doc.course;})[0];if(c){selectCourse(c.key).then(remakeDoc);return;}}
  var cur={};doc.items.forEach(function(x){cur[x.qid]=1;});
  var it;
  if(doc.kind==='homework'){
    var hs=hwSpec(),pool0=poolFor(ids),fresh0=pool0.filter(function(x){return !cur[x.qid];});
    it=assembleHw(fresh0,hs,ids);if(it.length<hs.items[0])it=assembleHw(pool0,hs,ids);
    doc.model=doc.model==='أ'?'ب':'أ';
  }else{
    var pool=poolFor(ids),fresh=pool.filter(function(x){return !cur[x.qid];});it=assemble(fresh,spec(),ids);
    if(!it.length||!checks(Object.assign({},doc,{items:it})).every(function(c){return c[0];}))it=assemble(pool,spec(),ids);
  }
  if(!it.length){toast('لا توجد مفردات كافية لنموذج آخر');return;}
  var same=it.filter(function(x){return cur[x.qid];}).length;
  doc.items=it;doc.lessons=ids;doc.id=null;doc.title='';dirty=true;renderDoc();
  toast(same?'نموذج آخر ('+(it.length-same)+' مفردة جديدة من '+it.length+')':'نموذج آخر بأسئلة جديدة كلها');
}
// ---------- أوراق العمل المتمايزة: ثلاثة مستويات من نفس الدروس ----------
var DIFF_LV=[
  {name:'المستوى الأساسي',hint:'(دعم · صعوبات التعلم)',score:function(x){return (x.difficulty==='منخفضة'?0:x.difficulty==='متوسطة'?3:8)+(LOW_AOS[x.ao]?0:2)+(x.type==='long'?6:x.type==='short'?1:0)+(+x.marks>2?3:0);}},
  {name:'المستوى المتوسط',hint:'',score:function(x){return (x.difficulty==='متوسطة'?0:2)+(x.type==='long'?2:0);}},
  {name:'المستوى الإثرائي',hint:'(للمتفوقين)',score:function(x){return (x.difficulty==='مرتفعة'?0:x.difficulty==='متوسطة'?2:6)+(LOW_AOS[x.ao]?3:0)+(x.type==='mcq'?2:0);}}];
var LOW_AOS={'معرفة':1,'AO1':1,'تذكر وفهم':1};
function makeDiff(ids){
  var pool=shuffle(poolFor(ids)),used={},items=[],ord={};ids.forEach(function(id,i){ord[id]=i;});
  DIFF_LV.forEach(function(L,lv){
    if(!cfg.dlv[lv])return;
    var cand=pool.filter(function(x){return !used[x.qid];}).map(function(x){return [L.score(x)+Math.random()*0.5,x];}).sort(function(a,b){return a[0]-b[0];}).map(function(p){return p[1];});
    // توزيع متوازن على الدروس المختارة
    var by={};cand.forEach(function(x){(by[x.lesson_id]=by[x.lesson_id]||[]).push(x);});
    var pick=[],k=0;while(pick.length<cfg.dn&&k<60){ids.forEach(function(id){if(by[id]&&by[id].length&&pick.length<cfg.dn)pick.push(by[id].shift());});k++;}
    pick.sort(function(a,b){return (tOrd(a)-tOrd(b))||(ord[a.lesson_id]-ord[b.lesson_id]);}).forEach(function(x){used[x.qid]=1;var c=clone(x);c.lv=lv;items.push(c);});
  });
  return items;
}
function make(){
  if(!course)return;
  if(mode==='hw'){
    var hs=hwSpec();
    if(!hs||hs.none){toast('لا يوجد واجب منزلي لهذه المادة في وثيقة التقويم');return;}
    var idsH=lessonOrder().filter(function(id){return cfg.lessons[id];});
    if(!idsH.length){toast('اختر درسًا واحدًا على الأقل');return;}
    var itH=assembleHw(poolFor(idsH),hs,idsH);
    if(itH.length<hs.items[0]){toast('لا توجد مفردات كافية في الدروس المختارة لتكوين الواجب');return;}
    newDoc('homework',itH,{lessons:idsH,hwDiscuss:hs.discuss||0,hwFormative:!!hs.formative,model:'أ'});
    track('hw_make',idsH.length+' دروس',titleText(doc));
    return;
  }
  if(mode==='quiz'){
    var ids=lessonOrder().filter(function(id){return cfg.lessons[id];});
    if(!ids.length){toast('اختر درسًا واحدًا على الأقل');return;}
    var items=assemble(poolFor(ids),spec(cfg.total),ids);
    if(!items.length){toast('لا توجد مفردات كافية في الدروس المختارة');return;}
    newDoc('quiz',items);track('quiz_make',ids.length+' دروس',titleText(doc));
  }else if(mode==='diff'){
    var idsD=lessonOrder().filter(function(id){return cfg.lessons[id];});
    if(!idsD.length){toast('اختر درسًا واحدًا على الأقل');return;}
    if(!cfg.dlv.some(Boolean)){toast('اختر مستوى واحدًا على الأقل');return;}
    var itD=makeDiff(idsD);if(!itD.length){toast('لا توجد مفردات كافية في الدروس المختارة');return;}
    newDoc('diff',itD,{lessons:idsD,studentLine:true});track('diff_make',idsD.length+' دروس',titleText(doc));
  }else{
    var u=unitsList().filter(function(x){return x.unit===cfg.unit;})[0];if(!u)return;
    var ids2=u.lessons.map(function(l){return l.id;}),pool=poolFor(ids2),pick2=pool;
    if(cfg.reviewCount&&pool.length>cfg.reviewCount){ // توزيع متوازن على الدروس
      var by={};pool.forEach(function(x){(by[x.lesson_id]=by[x.lesson_id]||[]).push(x);});Object.keys(by).forEach(function(k){by[k]=shuffle(by[k]);});
      pick2=[];var i=0;while(pick2.length<cfg.reviewCount&&i<200){ids2.forEach(function(id){if(by[id]&&by[id].length&&pick2.length<cfg.reviewCount)pick2.push(by[id].shift());});i++;}
    }
    var ord={};ids2.forEach(function(id,i){ord[id]=i;});
    pick2=pick2.slice().sort(function(a,b){return (ord[a.lesson_id]-ord[b.lesson_id])||(tOrd(a)-tOrd(b));}).map(clone);
    if(!pick2.length){toast('لا توجد مفردات لهذه الوحدة');return;}
    newDoc('review',pick2,{unit:u.unit,unit_name:u.name,lessons:ids2});track('review_make','الوحدة '+u.unit,titleText(doc));
  }
}
function renderDoc(){
  if(!doc){welcome();return;}
  var ck=checks(doc),allOk=ck.every(function(c){return c[0];});
  var h='<div class="qbar no-print"><div class="qbar-t"><input class="title-in sm" id="docTitle" value="'+esc(doc.title||titleText(doc))+'" aria-label="اسم الاختبار في قائمتك"><div class="muted small">'+(doc.id?'محفوظ في اختباراتي':'غير محفوظ بعد')+(dirty&&doc.id?' · فيه تعديلات لم تُحفظ':'')+'</div></div>'+
    '<div class="qbar-b"><button type="button" class="btn primary" id="printBtn">🖨 طباعة / PDF</button><button type="button" class="btn" id="wordBtn">⬇ تحميل Word</button><button type="button" class="btn" id="saveBtn">حفظ</button>'+(doc.kind==='quiz'||doc.kind==='homework'?'<button type="button" class="btn" id="remakeBtn">🔁 نموذج آخر</button>':'')+(doc.kind!=='remedy'?'<button type="button" class="btn" id="analBtn" title="أدخل درجات الطلاب واحصل على تقرير تحليل النتائج">📊 تحليل النتائج</button>':'')+'<button type="button" class="btn" id="addBtn">+ مفردة</button></div></div>'+
    '<div class="checks no-print '+(allOk?'ok':'warn')+'"><b>'+(doc.kind==='review'?'المراجعة':(doc.kind==='homework'?(allOk?'✓ مطابق لمواصفات الواجب المنزلي في وثيقة التقويم':'⚠ راجع النقاط المعلّمة'):(allOk?'✓ مطابق لمواصفات الاختبار القصير في وثيقة التقويم':'⚠ راجع النقاط المعلّمة')))+'</b><ul>'+ck.map(function(c){return '<li class="'+(c[0]?'y':'n')+'">'+(c[0]?'✓':'⚠')+' '+esc(c[1])+'</li>';}).join('')+'</ul></div>'+
    '<div class="ptabs no-print" role="tablist"><button type="button" class="ltab'+(paperView==='quiz'?' on':'')+'" data-pv="quiz">ورقة '+(doc.kind==='review'?'المراجعة':doc.kind==='homework'?'الواجب':'الاختبار')+'</button><button type="button" class="ltab'+(paperView==='key'?' on':'')+'" data-pv="key">نموذج الإجابة</button></div>'+
    '<div class="paper" id="paper">'+(paperView==='quiz'?quizHtml(doc,false,true):keyHtml(doc,false))+'</div>';
  $('qmain').innerHTML=h;finPatch($('qmain'));
  Array.prototype.forEach.call(document.querySelectorAll('[data-meta]'),function(el){var it=doc.items[+el.getAttribute('data-meta')],L=lessonOf(it);el.textContent=TYPE_TXT[it.type]+' · '+(AO_TXT[it.ao]||it.ao||'')+' · '+(it.difficulty||'')+' · '+it.marks+' درجة'+(L.title?' · '+L.title:'');});
  Array.prototype.forEach.call(document.querySelectorAll('[data-pv]'),function(b){b.onclick=function(){paperView=b.getAttribute('data-pv');renderDoc();};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-act]'),function(b){b.onclick=function(){itemAct(b.getAttribute('data-act'),+b.getAttribute('data-i'));};});
  $('docTitle').onchange=function(){doc.title=this.value.trim();dirty=true;};
  $('printBtn').onclick=printDoc;$('wordBtn').onclick=wordDoc;$('saveBtn').onclick=saveDoc;$('addBtn').onclick=addItem;
  if($('remakeBtn'))$('remakeBtn').onclick=remakeDoc;
  if($('analBtn'))$('analBtn').onclick=function(){
    var go=function(){location.href='/analysis'+'?quiz='+doc.id;};
    if(doc.id&&!dirty)go();else saveDoc().then(function(){if(doc.id)go();});
  };
}
function itemAct(a,i){
  var it=doc.items[i];if(!it)return;
  if(a==='up'&&i>0){doc.items.splice(i-1,0,doc.items.splice(i,1)[0]);}
  else if(a==='down'&&i<doc.items.length-1){doc.items.splice(i+1,0,doc.items.splice(i,1)[0]);}
  else if(a==='del'){doc.items.splice(i,1);}
  else if(a==='swap'){
    var inDoc={};doc.items.forEach(function(x){if(x.qid)inDoc[x.qid]=1;});
    var ids=doc.lessons&&doc.lessons.length?doc.lessons:[it.lesson_id];
    var pool=poolFor(ids).filter(function(x){return !inDoc[x.qid];});
    var c=pool.filter(function(x){return x.type===it.type&&x.ao===it.ao&&x.marks===it.marks;});
    if(!c.length)c=pool.filter(function(x){return x.type===it.type&&x.ao===it.ao;});
    if(!c.length)c=pool.filter(function(x){return x.type===it.type;});
    if(!c.length){toast('لا توجد مفردة بديلة مناسبة في الدروس المختارة');return;}
    var same=c.filter(function(x){return x.lesson_id===it.lesson_id;});
    doc.items[i]=clone(pick(same.length?same:c));if(it.lv!=null)doc.items[i].lv=it.lv;toast(doc.items[i].marks!==it.marks?'استُبدلت (تغيّرت الدرجة)':'استُبدلت المفردة');
  }else if(a==='edit'){editItem(i);return;}
  dirty=true;renderDoc();
}
// ---------- محرّر المفردة ----------
function editItem(i,isNew){
  var it=i==null?isNew:doc.items[i];var ao=aoList();
  var ls=bank.lessons.length?bank.lessons:[{id:0,title:'—'}];
  var h='<div class="ed"><div class="ed-row"><label>النوع<select id="e_type">'+['mcq','short','long'].map(function(t){return '<option value="'+t+'"'+(it.type===t?' selected':'')+'>'+TYPE_TXT[t]+'</option>';}).join('')+'</select></label>'+
    '<label>الدرجة<input id="e_marks" type="number" min="1" max="8" value="'+esc(it.marks||1)+'"></label>'+
    '<label>هدف التقويم<select id="e_ao">'+ao.map(function(a){return '<option'+(it.ao===a?' selected':'')+'>'+a+'</option>';}).join('')+'</select></label>'+
    '<label>الصعوبة<select id="e_diff">'+['منخفضة','متوسطة','مرتفعة'].map(function(a){return '<option'+(it.difficulty===a?' selected':'')+'>'+a+'</option>';}).join('')+'</select></label></div>'+
    '<label>الدرس<select id="e_lesson">'+ls.map(function(l){return '<option value="'+l.id+'"'+(+it.lesson_id===l.id?' selected':'')+'>'+esc(l.title)+'</option>';}).join('')+'</select></label>'+
    '<label>نص المفردة <span class="muted">(ضع الكلمة بين ** ** لتظهر بخط عريض)</span><textarea id="e_stem" rows="4">'+esc(it.stem||'')+'</textarea></label>'+
    '<div id="e_mcq"'+(it.type==='mcq'?'':' hidden')+'><div class="muted small">البدائل الأربعة — اختر الصحيح:</div>'+[0,1,2,3].map(function(k){return '<div class="ed-ch"><input type="radio" name="e_c" value="'+k+'"'+(+it.correct===k?' checked':'')+'><input id="e_ch'+k+'" value="'+esc((it.choices||[])[k]||'')+'"></div>';}).join('')+'</div>'+
    '<div id="e_ans"'+(it.type==='mcq'?' hidden':'')+'><label>نموذج الإجابة <span class="muted">(كل سطر = درجة)</span><textarea id="e_answer" rows="4">'+esc(it.answer||'')+'</textarea></label></div>'+
    '<div class="ed-row"><label>هدف التعلم<input id="e_outcome" value="'+esc(it.outcome||'')+'" class="ltr"></label><label class="grow">المعلومات الإضافية<input id="e_notes" value="'+esc(it.notes||'')+'"></label></div>'+
    (it.table?'<p class="muted small">هذه المفردة فيها جدول بيانات يبقى كما هو.</p>':'')+'</div>';
  var ov=$('modal'),box=$('modalBox');
  box.innerHTML='<h3 id="mTitle">'+(i==null?'مفردة جديدة':'تعديل المفردة '+(i+1))+'</h3>'+h+'<div class="m-actions"><button type="button" class="btn" id="mCancel">إلغاء</button><button type="button" class="btn primary" id="mOk">حفظ</button></div>';
  box.classList.add('wide');ov.hidden=false;
  $('e_type').onchange=function(){var m=this.value==='mcq';$('e_mcq').hidden=!m;$('e_ans').hidden=m;if(m)$('e_marks').value=1;};
  var close=function(){ov.hidden=true;box.innerHTML='';box.classList.remove('wide');};
  $('mCancel').onclick=close;ov.onclick=function(e){if(e.target===ov)close();};
  $('mOk').onclick=function(){
    var n=clone(it);n.type=$('e_type').value;n.marks=Math.max(1,parseInt($('e_marks').value,10)||1);n.ao=$('e_ao').value;n.difficulty=$('e_diff').value;
    n.lesson_id=+$('e_lesson').value;n.stem=$('e_stem').value.trim();n.outcome=$('e_outcome').value.trim();n.notes=$('e_notes').value.trim();
    if(!n.stem){toast('اكتب نص المفردة');return;}
    if(n.type==='mcq'){n.choices=[0,1,2,3].map(function(k){return $('e_ch'+k).value.trim();});var r=document.querySelector('input[name="e_c"]:checked');n.correct=r?+r.value:0;n.marks=1;
      if(n.choices.some(function(x){return !x;})){toast('اكتب البدائل الأربعة');return;}}
    else{n.answer=$('e_answer').value.trim();delete n.choices;delete n.correct;}
    if(n.qid&&JSON.stringify(n)!==JSON.stringify(it))n.edited=true;
    if(i==null){if(!n.qid)n.qid=0;doc.items.push(n);}else doc.items[i]=n;
    close();dirty=true;renderDoc();
  };
}
function addItem(){
  var inDoc={};doc.items.forEach(function(x){if(x.qid)inDoc[x.qid]=1;});
  var ids=doc.lessons&&doc.lessons.length?doc.lessons:lessonOrder();
  var pool=poolFor(ids).filter(function(x){return !inDoc[x.qid];});
  var ov=$('modal'),box=$('modalBox');
  var list=function(f){return pool.filter(function(x){return !f||x.type===f;}).slice(0,150).map(function(x){var L=lessonOf(x);return '<li><button type="button" class="pk" data-q="'+x.qid+'"><span class="pk-m">'+esc(TYPE_TXT[x.type])+' · '+esc(x.ao)+' · '+x.marks+' د · '+esc(L.title||'')+'</span>'+rich(x.stem.length>220?x.stem.slice(0,220)+'…':x.stem)+'</button></li>';}).join('')||'<li class="muted">لا توجد مفردات أخرى في هذه الدروس.</li>';};
  box.innerHTML='<h3 id="mTitle">إضافة مفردة</h3><div class="seg sm"><button type="button" class="on" data-f="">الكل</button><button type="button" data-f="mcq">اختيار من متعدد</button><button type="button" data-f="short">قصيرة</button><button type="button" data-f="long">طويلة</button></div><ul class="picker" id="pickList">'+list('')+'</ul><div class="m-actions"><button type="button" class="btn" id="mCancel">إغلاق</button><button type="button" class="btn primary" id="mNew">اكتب مفردة جديدة</button></div>';
  box.classList.add('wide');ov.hidden=false;
  var close=function(){ov.hidden=true;box.innerHTML='';box.classList.remove('wide');};
  var bindPick=function(){Array.prototype.forEach.call(box.querySelectorAll('[data-q]'),function(b){b.onclick=function(){var q=+b.getAttribute('data-q');var x=pool.filter(function(y){return y.qid===q;})[0];if(x){doc.items.push(clone(x));dirty=true;close();renderDoc();toast('أُضيفت المفردة في آخر الورقة');}};});};
  bindPick();
  Array.prototype.forEach.call(box.querySelectorAll('[data-f]'),function(b){b.onclick=function(){Array.prototype.forEach.call(box.querySelectorAll('[data-f]'),function(x){x.classList.toggle('on',x===b);});$('pickList').innerHTML=list(b.getAttribute('data-f'));bindPick();};});
  $('mCancel').onclick=close;ov.onclick=function(e){if(e.target===ov)close();};
  $('mNew').onclick=function(){close();editItem(null,{type:'short',marks:1,ao:aoList()[0],difficulty:'منخفضة',lesson_id:ids[0]||0,stem:'',answer:'',outcome:'',notes:''});};
}
// ---------- الطباعة وملف Word ----------
// نستخدم dialog المشتركة حتى تُغلق النافذة ويُزال مستمع لوحة المفاتيح معها.
// القيمة: 'both' أو 'quiz' أو 'key'، و null يعني أن المعلم ألغى.
function chooseParts(title){
  return dialog({title:title,cancelText:'إلغاء',okText:'متابعة',group:'pp',
    html:'<div class="parts"><label><input type="radio" name="pp" value="both" checked> الورقة ونموذج الإجابة</label><label><input type="radio" name="pp" value="quiz"> ورقة '+(doc.kind==='review'?'المراجعة':(doc.kind==='diff'?'العمل':(doc.kind==='remedy'?'العمل العلاجية':(doc.kind==='homework'?'الواجب':'الاختبار'))))+' فقط</label><label><input type="radio" name="pp" value="key"> نموذج الإجابة فقط</label></div>'})
    .then(function(v){return (v&&v.length)?v[0]:null;});
}
var leavingOk=0,MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function fileName(){return (doc.title||titleText(doc)).replace(/[\\/:*?"<>|]+/g,'-').slice(0,90);}
// التحميل من السيرفر برابط حقيقي: يعمل في التطبيق وفي متصفح الموبايل والكمبيوتر
function serverFile(format,html,win){
  toast('جارٍ التجهيز…');
  return api('/api/export',{format:format,name:fileName(),html:supify(html)}).then(function(r){
    if(win){try{win.location.href=r.url;return;}catch(e){}}
    leavingOk=Date.now();var a=document.createElement('a');a.href=r.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);
  },function(e){if(win)try{win.close();}catch(x){}toast(e.message);});
}
function partsHtml(p,word){return (p!=='key'?(word?'':'<div class="pg">')+quizHtml(doc,word,false)+(word?'':'</div>'):'')+(word&&p==='both'?'<br clear="all" style="page-break-before:always">':'')+(p!=='quiz'?(word?'':'<div class="pg">')+keyHtml(doc,word)+(word?'':'</div>'):'');}
function printDoc(){
  chooseParts('طباعة / حفظ PDF').then(function(p){
    if(!p)return;
    track('quiz_print',p,titleText(doc));
    if(!IN_APP&&!MOBILE){ // الكمبيوتر: طباعة مباشرة من الصفحة
      finReady(function(){return (p!=='key'?'<div class="ppage">'+quizHtml(doc,false,false)+'</div>':'')+(p!=='quiz'?'<div class="ppage">'+keyHtml(doc,false)+'</div>':'');}).then(function(h){
        $('printArea').innerHTML=h;doPrint(fileName());
      });
      return;
    }
    // الموبايل والتطبيق: صفحة طباعة مستقلة (في التطبيق تُفتح في Chrome)
    var w=null;if(!IN_APP){try{w=window.open('','_blank');}catch(e){w=null;}}
    finReady(function(){return partsHtml(p,false);}).then(function(h){return serverFile('print',h,w);}).then(function(){if(IN_APP)toast('تُفتح صفحة الطباعة في المتصفح… اختر «حفظ PDF» أو الطابعة');});
  });
}
function wordDoc(){
  chooseParts('تحميل ملف Word').then(function(p){
    if(!p)return;
    finReady(function(){return partsHtml(p,true);}).then(function(body){
    var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(titleText(doc))+'</title>'+
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->'+
      '<style>@page WordSection1{size:595.3pt 841.9pt;margin:36pt 40pt 36pt 40pt}div.WordSection1{page:WordSection1}body{font-family:"Simplified Arabic","Traditional Arabic",Arial;font-size:13pt;direction:rtl}p{margin:0 0 4pt}table{direction:rtl}.oval{display:inline-block;width:16pt;height:9pt;border:1pt solid #000;border-radius:5pt}</style></head>'+
      '<body dir="rtl" lang="AR-OM"><div class="WordSection1" dir="rtl">'+body+'</div></body></html>';
    track('quiz_word',p,titleText(doc));
    serverFile('doc',html,null).then(function(){toast(IN_APP?'يُحمَّل ملف Word عبر المتصفح، ستجده في «التنزيلات»':'تم تحميل ملف Word');});
    });
  });
}
function saveDoc(){
  var t=($('docTitle')&&$('docTitle').value.trim())||titleText(doc);doc.title=t;
  return api('/api/quizzes',{id:doc.id,title:t,grade:doc.grade,subject:doc.subject,kind:doc.kind,data:doc}).then(function(r){doc.id=r.id;dirty=false;renderDoc();loadSaved();toast('حُفظ في اختباراتي');track('quiz_save',doc.kind,t);},function(e){toast(e.message);});
}
function loadSaved(){
  if(!$('savedList'))return;
  api('/api/quizzes?kind='+(HW?'homework':'quiz,review,diff,remedy')).then(function(r){
    var l=r.quizzes||[];var el=$('savedList');if(!el)return;
    el.innerHTML=l.length?l.map(function(q){return '<li><button type="button" class="link-btn" data-open="'+q.id+'"><b>'+esc(q.title)+'</b></button><span class="muted small">'+esc(fmtDate(q.updated_at))+'</span><button type="button" class="x" data-delq="'+q.id+'" aria-label="حذف">×</button></li>';}).join(''):'<li class="muted">لا يوجد. بعد تكوين اختبار اضغط «حفظ».</li>';
    Array.prototype.forEach.call(el.querySelectorAll('[data-open]'),function(b){b.onclick=function(){openSaved(+b.getAttribute('data-open'));};});
    Array.prototype.forEach.call(el.querySelectorAll('[data-delq]'),function(b){b.onclick=function(){dialog({title:'حذف الاختبار المحفوظ؟',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/quizzes/'+b.getAttribute('data-delq'),null,'DELETE').then(function(){if(doc&&doc.id===+b.getAttribute('data-delq'))doc.id=null;loadSaved();toast('حُذف');});});};});
  },function(){});
}
function openSaved(id){
  api('/api/quizzes/'+id).then(function(r){
    var d=r.quiz.data;d.id=r.quiz.id;d.title=r.quiz.title;
    var go=function(){doc=d;dirty=false;paperView='quiz';if(d.kind==='quiz'){cfg.quizNo=d.quizNo||cfg.quizNo;}renderDoc();renderSide();};
    if(!course||course.key!==d.course){var c=courses.filter(function(x){return x.key===d.course;})[0];if(c){selectCourse(c.key).then(go);return;}}
    go();
  },function(e){toast(e.message);});
}
// ---------- ورقة عمل علاجية (من «تحليل النتائج»): مفردات جديدة من الدروس والمستويات الأضعف ----------
function makeRemedy(h){
  var ids=(h.lessons||[]).map(Number).filter(function(id){return lessonById[id];});
  if(!ids.length){toast('لم أجد دروس التحليل في هذا الصف');return;}
  var ex={};(h.exclude||[]).forEach(function(q){ex[q]=1;});
  var pool=poolFor(ids),fresh=pool.filter(function(x){return !ex[x.qid];});if(fresh.length<4)fresh=pool;
  var weak=(h.ao||[]).slice(0,2),rank=function(x){var i=weak.indexOf(x.ao);return i<0?9:i;};
  var by={};shuffle(fresh).sort(function(a,b){return rank(a)-rank(b);}).forEach(function(x){(by[x.lesson_id]=by[x.lesson_id]||[]).push(x);});
  var out=[],cap=Math.min(10,fresh.length),k=0;
  while(out.length<cap&&k<50){ids.forEach(function(id){if(by[id]&&by[id].length&&out.length<cap)out.push(by[id].shift());});k++;}
  var ord={};ids.forEach(function(id,i){ord[id]=i;});
  out=out.sort(function(a,b){return (ord[a.lesson_id]-ord[b.lesson_id])||(tOrd(a)-tOrd(b));}).map(clone);
  if(!out.length){toast('لا توجد مفردات كافية في بنك الأسئلة لهذه الدروس');return;}
  newDoc('remedy',out,{lessons:ids,studentLine:true,title:'ورقة عمل علاجية — '+(h.title||'').replace(/^تحليل\s*/,'')});
  track('remedy_make',ids.length+' دروس',titleText(doc));toast('ورقة عمل علاجية من الدروس الأضعف ✓');
}
function takeHandoff(to){var h=lsGet('tahdir_handoff');if(!h||h.to!==to||Date.now()-(h.at||0)>15*60000)return null;try{localStorage.removeItem('tahdir_handoff');}catch(e){}return h;}
// ---------- البداية ----------
window.addEventListener('beforeunload',function(e){if(Date.now()-leavingOk<5000)return;if(doc&&dirty&&doc.items.length){e.preventDefault();e.returnValue='';}});
Promise.all([api('/api/me'),api('/api/courses')]).then(function(r){
  me=r[0];initNav(me);
  hdr=Object.assign(clone(DEF_HDR),lsGet(hdrKey())||{});
  // ترقية ترويسة محفوظة سابقًا: اسم المديرية صار «للتعليم» بدل «للتربية والتعليم»
  if(hdr.dir&&/للتربية والتعليم/.test(hdr.dir)){hdr.dir=hdr.dir.replace(/للتربية والتعليم/g,'للتعليم');lsSet(hdrKey(),hdr);}
  courses=(r[1].courses||[]).filter(function(c){return !/انجليز|إنجليز|English/i.test(c.subject);}).sort(function(a,b){return (gnum(a.grade)-gnum(b.grade))||a.subject.localeCompare(b.subject,'ar');});
  if(!courses.length){$('qmain').innerHTML='<div class="welcome"><h2>لا توجد صفوف متاحة لحسابك</h2><p>تواصل مع مدير المنصة.</p></div>';return;}
  var hf=takeHandoff('quiz'),hc=hf&&courses.filter(function(x){return x.key===hf.course;})[0];
  if(hc){selectCourse(hc.key).then(function(){makeRemedy(hf);});return;}
  var last=lsGet('tahdir_quiz_course'),c=courses.filter(function(x){return x.key===last;})[0]||cpDefault(courses);
  selectCourse(c.key);
},function(e){$('qmain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
