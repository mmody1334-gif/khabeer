// محرّك الاختبارات والواجبات لتطبيق خبير الأصلي.
// الدوال بين السطرين التاليين تُنسخ حرفيًّا عند البناء من client_quiz.js (build_worker.py ← quiz_engine_js)،
// فيعمل التطبيق بنفس مواصفات «وثيقة تقويم تعلم الطلبة» ونفس خوارزمية التكوين والفحص في الموقع،
// وأي تعديل عليها في الموقع يصل للتطبيق بلا تحديث.
(function(){
'use strict';
var course=null,bank={lessons:[],items:[]},lessonById={},mode='quiz',HW=false;
var cfg={quizNo:'الأول',total:10,lessons:{},unit:'',reviewCount:0,dlv:[true,true,true],dn:6};
// @@ENGINE@@
function unitsList(){
  var m={},order=[];bank.lessons.forEach(function(l){var k=String(l.unit);if(!m[k]){m[k]={unit:k,name:l.unit_name||'',lessons:[]};order.push(k);}m[k].lessons.push(l);});
  return order.sort(function(a,b){return parseInt(a,10)-parseInt(b,10);}).map(function(k){return m[k];});
}
var BASE='',SID='',UNAME='';
function get(path){var h={};if(SID)h['X-Tahdir-Sid']=SID;return fetch(BASE+path,{credentials:'include',headers:h}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;});});}
function setOpts(o){o=o||{};mode=o.mode||'quiz';HW=mode==='hw';cfg.quizNo=o.quizNo||'الأول';cfg.unit=o.unit!=null?String(o.unit):'';cfg.reviewCount=+o.reviewCount||0;
  cfg.dlv=o.dlv||[true,true,true];cfg.dn=+o.dn||6;cfg.lessons={};(o.lessons||[]).forEach(function(id){cfg.lessons[id]=true;});}
// ترويسة الورقة كما حفظها المعلم في صفحة الاختبارات (نفس التخزين المحلي لمتصفح التطبيق)
function myHdr(){var h=Object.assign(clone(DEF_HDR),lsGet('tahdir_quiz_hdr_'+UNAME)||{});if(h.dir&&/للتربية والتعليم/.test(h.dir))h.dir=h.dir.replace(/للتربية والتعليم/g,'للتعليم');return h;}
function newDoc(kind,items,extra,hdr){
  var d=Object.assign({kind:kind,subject:course.subject,grade:course.grade,course:course.key,quizNo:cfg.quizNo,total:cfg.total,hdr:hdr||myHdr(),items:items,lessons:Object.keys(cfg.lessons).map(Number),id:null,title:''},extra||{});
  d.spec=kind==='quiz'?spec(cfg.total):null;return d;
}
function useDoc(d){if(!course||course.key!==d.course)throw new Error('course');cfg.quizNo=d.quizNo||cfg.quizNo;}
window.KE={
  version:1,
  init:function(base,sid){BASE=base||'';SID=sid||'';return get('/api/me').then(function(m){UNAME=m.username||'';return {ok:true,name:m.name||''};});},
  qno:function(){return QNO;},
  state:function(){return {u:UNAME,key:course?course.key:null};},
  // تحميل بنك المقرر: الدروس والمفردات (اختيار من متعدد، قصيرة، طويلة، أسئلة الوزارة بصورها)
  load:function(key,c){
    return get('/api/quiz/bank?key='+encodeURIComponent(key)).then(function(r){
      course=c;bank=r;lessonById={};bank.lessons.forEach(function(l){lessonById[l.id]=l;});
      cfg.total=gnum(course.grade)===5?10:15;
      var cnt={};bank.items.forEach(function(x){cnt[x.lesson_id]=(cnt[x.lesson_id]||0)+1;});
      return {lessons:bank.lessons.map(function(l){return {id:l.id,unit:String(l.unit),unit_name:l.unit_name||'',title:l.title,term:+l.term||1,n:cnt[l.id]||0};}),
        units:unitsList().map(function(u){return {unit:u.unit,name:u.name,n:u.lessons.reduce(function(s,l){return s+(cnt[l.id]||0);},0)};}),
        items:bank.items.length,hw:hwSpec(),hwText:hwSpecText(hwSpec()),quizSpec:spec(),specText:Object.keys(spec().targets).map(function(k){return aoTxt(k)+' '+spec().targets[k];}).join('، '),
        mcq:bank.items.filter(function(x){return x.type==='mcq';}).length};
    });
  },
  // نفس make() في الموقع: quiz · review · diff · hw — يعيد {doc} أو {error}
  make:function(o,hdr){
    setOpts(o);
    if(mode==='hw'){
      var hs=hwSpec();if(!hs||hs.none)return {error:'لا يوجد واجب منزلي لهذه المادة في وثيقة التقويم'};
      var idsH=lessonOrder().filter(function(id){return cfg.lessons[id];});if(!idsH.length)return {error:'اختر درسًا واحدًا على الأقل'};
      var itH=assembleHw(poolFor(idsH),hs,idsH);if(itH.length<hs.items[0])return {error:'لا توجد مفردات كافية في الدروس المختارة لتكوين الواجب'};
      return {doc:newDoc('homework',itH,{lessons:idsH,hwDiscuss:hs.discuss||0,hwFormative:!!hs.formative,model:'أ'},hdr)};
    }
    if(mode==='quiz'){
      var ids=lessonOrder().filter(function(id){return cfg.lessons[id];});if(!ids.length)return {error:'اختر درسًا واحدًا على الأقل'};
      var items=assemble(poolFor(ids),spec(cfg.total),ids);if(!items.length)return {error:'لا توجد مفردات كافية في الدروس المختارة'};
      return {doc:newDoc('quiz',items,null,hdr)};
    }
    if(mode==='diff'){
      var idsD=lessonOrder().filter(function(id){return cfg.lessons[id];});if(!idsD.length)return {error:'اختر درسًا واحدًا على الأقل'};
      if(!cfg.dlv.some(Boolean))return {error:'اختر مستوى واحدًا على الأقل'};
      var itD=makeDiff(idsD);if(!itD.length)return {error:'لا توجد مفردات كافية في الدروس المختارة'};
      return {doc:newDoc('diff',itD,{lessons:idsD,studentLine:true},hdr)};
    }
    var u=unitsList().filter(function(x){return x.unit===cfg.unit;})[0];if(!u)return {error:'اختر الوحدة'};
    var ids2=u.lessons.map(function(l){return l.id;}),pool=poolFor(ids2),pick2=pool;
    if(cfg.reviewCount&&pool.length>cfg.reviewCount){var by={};pool.forEach(function(x){(by[x.lesson_id]=by[x.lesson_id]||[]).push(x);});Object.keys(by).forEach(function(k){by[k]=shuffle(by[k]);});
      pick2=[];var i=0;while(pick2.length<cfg.reviewCount&&i<200){ids2.forEach(function(id){if(by[id]&&by[id].length&&pick2.length<cfg.reviewCount)pick2.push(by[id].shift());});i++;}}
    var ord={};ids2.forEach(function(id,i){ord[id]=i;});
    pick2=pick2.slice().sort(function(a,b){return (ord[a.lesson_id]-ord[b.lesson_id])||(tOrd(a)-tOrd(b));}).map(clone);
    if(!pick2.length)return {error:'لا توجد مفردات لهذه الوحدة'};
    return {doc:newDoc('review',pick2,{unit:u.unit,unit_name:u.name,lessons:ids2},hdr)};
  },
  // نفس remakeDoc(): نموذج آخر بنفس الدروس والمواصفات وأسئلة مختلفة قدر الإمكان
  remake:function(doc){
    useDoc(doc);var ids=(doc.lessons&&doc.lessons.length?doc.lessons:doc.items.map(function(x){return x.lesson_id;})).map(Number).filter(function(v,i,a){return a.indexOf(v)===i;});
    var cur={};doc.items.forEach(function(x){cur[x.qid]=1;});var it;
    if(doc.kind==='homework'){var hs=hwSpec(),pool0=poolFor(ids),fresh0=pool0.filter(function(x){return !cur[x.qid];});it=assembleHw(fresh0,hs,ids);if(it.length<hs.items[0])it=assembleHw(pool0,hs,ids);doc.model=doc.model==='أ'?'ب':'أ';}
    else{var pool=poolFor(ids),fresh=pool.filter(function(x){return !cur[x.qid];});it=assemble(fresh,spec(),ids);if(!it.length||!checks(Object.assign({},doc,{items:it})).every(function(c){return c[0];}))it=assemble(pool,spec(),ids);}
    if(!it.length)return {error:'لا توجد مفردات كافية لنموذج آخر'};
    var same=it.filter(function(x){return cur[x.qid];}).length;
    doc.items=it;doc.lessons=ids;doc.id=null;doc.title='';
    return {doc:doc,msg:same?'نموذج آخر ('+(it.length-same)+' مفردة جديدة من '+it.length+')':'نموذج آخر بأسئلة جديدة كلها'};
  },
  // نفس itemAct('swap'): بديل من نفس النوع والهدف والدرجة قدر الإمكان
  swap:function(doc,i){
    useDoc(doc);var it=doc.items[i];if(!it)return {error:'غير موجود'};
    var inDoc={};doc.items.forEach(function(x){if(x.qid)inDoc[x.qid]=1;});
    var ids=doc.lessons&&doc.lessons.length?doc.lessons:[it.lesson_id];
    var pool=poolFor(ids).filter(function(x){return !inDoc[x.qid];});
    var c=pool.filter(function(x){return x.type===it.type&&x.ao===it.ao&&x.marks===it.marks;});
    if(!c.length)c=pool.filter(function(x){return x.type===it.type&&x.ao===it.ao;});
    if(!c.length)c=pool.filter(function(x){return x.type===it.type;});
    if(!c.length)return {error:'لا توجد مفردة بديلة مناسبة في الدروس المختارة'};
    var same=c.filter(function(x){return x.lesson_id===it.lesson_id;});
    doc.items[i]=clone(pick(same.length?same:c));if(it.lv!=null)doc.items[i].lv=it.lv;
    return {doc:doc,msg:doc.items[i].marks!==it.marks?'استُبدلت (تغيّرت الدرجة)':'استُبدلت المفردة'};
  },
  checks:function(doc){useDoc(doc);return checks(doc);},
  title:function(doc){return titleText(doc);},
  meta:function(doc){useDoc(doc);return doc.items.map(function(x){var L=lessonOf(x);return {type:TYPE_TXT[x.type]||x.type,ao:aoTxt(x.ao)||x.ao||'',lesson:L.title||'',lv:lvOf(doc,x)};});},
  levels:function(){return DIFF_LV.map(function(L){return {name:L.name,hint:L.hint};});},
  total:function(doc){return doc.kind==='homework'?hwTotal(doc):sumMarks(doc.items);}
};
})();
