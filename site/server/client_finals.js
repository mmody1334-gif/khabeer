(function(){
'use strict';
// «الاختبارات النهائية»: أسئلة امتحانات الوزارة للأعوام السابقة مجمّعة حسب الوحدة والدرس
var FIN_INDEX=window.FIN_INDEX||{};
var me=null,courses=[],course=null,data=null,unitSel=lsGet('tahdir_fin_unit')||'',lessonSel='',yearSel='',showAns=false,picked={};
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function track(type,detail){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,grade:course&&course.grade,detail:detail||'',title:''})});}catch(e){}}
function paper(q){return data.papers[q.p]||{};}
function srcLabel(q){var p=paper(q);return [p.year,p.session,p.region].filter(Boolean).join(' · ');}
function lessonTitle(id){var l=data.lessons[id];return l?l.title:'';}
function units(){
  var c={};data.q.forEach(function(q){c[q.u]=(c[q.u]||0)+1;});
  return Object.keys(c).sort(function(a,b){return parseInt(a,10)-parseInt(b,10);}).map(function(u){return {u:u,name:data.units[u]||'',n:c[u]};});
}
function years(){var s={};Object.keys(data.papers).forEach(function(k){s[data.papers[k].year]=1;});return Object.keys(s).sort().reverse();}
function filtered(){
  return data.q.filter(function(q){return q.u===unitSel&&(!lessonSel||String(q.l)===lessonSel||String(q.l2)===lessonSel)&&(!yearSel||paper(q).year===yearSel);});
}
// أسئلة المحدد التي تنتمي للوحدة المعروضة حاليًا (الطباعة السريعة لا تخلط الوحدات)
function unitPicked(){
  if(!data)return [];
  return data.q.filter(function(q){return picked[q.id]&&q.u===unitSel;});
}
// كل المحدد بترتيب العرض الحالي (وحدة ← درس ← عام/سؤال) بدل ترتيب البيانات الأصلي
function pickedInOrder(){
  var byId={};
  data.q.forEach(function(q){byId[q.id]=q;});
  var out=[];
  filtered().forEach(function(q){if(picked[q.id]){out.push(q);delete byId[q.id];}});
  Object.keys(picked).forEach(function(id){if(byId[id])out.push(byId[id]);});
  return out;
}
function renderSide(){
  var h='<section class="qcard"><h3>1. المادة والصف</h3>'+coursePick(courses,course&&course.key,'courseSel')+'</section>';
  if(!data){$('fside').innerHTML=h;bindSide();return;}
  var us=units();if(!us.some(function(x){return x.u===unitSel;}))unitSel=us.length?us[0].u:'';
  h+='<section class="qcard"><h3>2. الوحدة</h3><div class="fin-units">'+us.map(function(x){return '<button type="button" class="fin-u'+(x.u===unitSel?' on':'')+'" data-u="'+esc(x.u)+'"><b>الوحدة '+esc(x.u)+'</b><span>'+esc(x.name)+'</span><em>'+x.n+' سؤالًا</em></button>';}).join('')+'</div></section>';
  var ls={};data.q.forEach(function(q){if(q.u===unitSel){if(q.l)ls[q.l]=(ls[q.l]||0)+1;if(q.l2)ls[q.l2]=(ls[q.l2]||0)+1;}});
  var lids=Object.keys(ls).sort(function(a,b){return (+a||0)-(+b||0)||String(a).localeCompare(String(b),'ar');});
  h+='<section class="qcard"><h3>3. التصفية</h3><label class="qrow">الدرس <select id="lessonSel" class="qsel"><option value="">كل دروس الوحدة</option>'+lids.map(function(id){return '<option value="'+id+'"'+(lessonSel===id?' selected':'')+'>'+esc(lessonTitle(id))+' ('+ls[id]+')</option>';}).join('')+'</select></label>'+
    '<label class="qrow">العام <select id="yearSel" class="qsel"><option value="">كل الأعوام</option>'+years().map(function(y){return '<option'+(yearSel===y?' selected':'')+'>'+esc(y)+'</option>';}).join('')+'</select></label>'+
    '<label class="qrow small"><input type="checkbox" id="ansChk"'+(showAns?' checked':'')+'> إظهار الإجابات</label></section>';
  var np=Object.keys(picked).length,npu=unitPicked().length,nOther=np-npu;
  h+='<section class="qcard"><h3>ورقة مراجعة</h3><p class="muted small" style="margin:0 0 8px">اختر أسئلة بعلامة ☐ ثم اطبعها ورقة واحدة (أو احفظها PDF).</p><div class="qrow"><button type="button" class="btn primary" id="printPicked"'+(np?'':' disabled')+'>🖨 اطبع المختار ('+np+')</button><button type="button" class="btn small" id="clearPicked"'+(np?'':' disabled')+'>مسح</button></div>'+
    '<div class="qrow"><button type="button" class="btn small" id="printUnit">🖨 اطبع كل أسئلة العرض الحالي</button>'+(npu?'<button type="button" class="btn small" id="printPickedUnit">🖨 المختار في هذه الوحدة ('+npu+')</button>':'')+'</div>'+
    (nOther?'<p class="muted small" style="margin:6px 0 0">لديك '+nOther+' سؤالًا مختارًا من وحدة أخرى. زر «اطبع المختار» يجمعها كلها.</p>':'')+'</section>';
  $('fside').innerHTML=h;bindSide();
}
function card(q){
  var p=paper(q),lt=lessonTitle(q.l);
  return '<article class="fin-q" id="q_'+q.id+'"><header><label class="fin-pick"><input type="checkbox" data-pick="'+q.id+'"'+(picked[q.id]?' checked':'')+'></label>'+
    '<span class="chip">'+esc(p.year||'')+'</span><span class="chip">'+esc(p.session||'')+'</span>'+(p.region?'<span class="chip">'+esc(p.region)+'</span>':'')+
    '<span class="chip">السؤال '+esc(q.n)+'</span><span class="chip strong">'+esc(q.m)+' '+(q.m==1?'درجة':'درجات')+'</span>'+(q.ao?'<span class="chip">'+esc(q.ao)+'</span>':'')+
    (lt?'<span class="chip lesson">'+esc(lt)+'</span>':'')+'</header>'+
    (q.im?'<img loading="lazy" src="/fin/'+esc(q.im)+'" width="'+q.w+'" height="'+q.h+'" alt="'+esc((q.x||'').slice(0,120))+'">'
         :'<div class="fin-txt">'+esc(q.x||'')+'</div>')+
    '<details class="fin-ans"'+(showAns?' open':'')+'><summary>الإجابة'+(q.as==='ai'?' <span class="muted small">(مقترحة — لا يوجد نموذج)</span>':' <span class="muted small">(من نموذج الإجابة)</span>')+'</summary><div class="fin-a">'+esc(q.a).replace(/\n/g,'<br>')+(q.ai||[]).map(function(a){return '<img loading="lazy" src="/fin/'+esc(a[0])+'" width="'+a[1]+'" height="'+a[2]+'" alt="نموذج الإجابة" style="max-width:100%;height:auto;display:block;margin:6px 0">';}).join('')+'</div></details></article>';
}
function renderMain(){
  if(!data){$('fmain').innerHTML='<div class="welcome"><h2>اختر المادة والصف</h2></div>';return;}
  var qs=filtered(),u=units().filter(function(x){return x.u===unitSel;})[0];
  var by={},order=[];
  qs.forEach(function(q){var k=q.l||0;if(!by[k]){by[k]=[];order.push(k);}by[k].push(q);});
  order.sort(function(a,b){return (a||1e9)-(b||1e9);});
  qs.forEach(function(q){by[q.l||0].sort(function(a,b){return (paper(b).year||'').localeCompare(paper(a).year||'')||(a.p<b.p?-1:a.p>b.p?1:0)||(parseInt(a.n,10)-parseInt(b.n,10));});});
  var marks=qs.reduce(function(s,q){return s+(+q.m||0);},0);
  var h='<div class="fin-head"><h2>الوحدة '+esc(unitSel)+(u&&u.name?': '+esc(u.name):'')+'</h2><p class="muted">'+qs.length+' سؤالًا من امتحانات الوزارة ('+marks+' درجة) — '+years().join('، ')+'</p></div>';
  if(!qs.length)h+='<div class="welcome"><h2>لا توجد أسئلة بهذه التصفية</h2></div>';
  order.forEach(function(k){
    h+='<section class="fin-lesson"><h3>'+(k?esc(lessonTitle(k)):'أسئلة من دروس غير مضافة في الموقع')+' <span class="muted small">('+by[k].length+')</span></h3>'+by[k].map(card).join('')+'</section>';
  });
  $('fmain').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-pick]'),function(b){b.onchange=function(){var id=b.getAttribute('data-pick');if(b.checked)picked[id]=1;else delete picked[id];renderSide();};});
}
var MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function finName(title){return (title+' - '+course.subject+' - الصف '+gLabel(course.grade)).replace(/[\\/:*?"<>|]+/g,'-').slice(0,100);}
function printHtml(qs,title,abs){
  var O=abs?location.origin:'';
  var H=schoolHdr(),tot=qs.reduce(function(s,q){return s+(+q.m||0);},0);
  var box='<table style="border-collapse:collapse;margin:0 auto"><tr><td style="border:1.5px solid #000;width:64px;height:28px"></td></tr><tr><td style="border:1.5px solid #000;width:64px;height:28px;text-align:center;font-weight:bold">'+tot+'</td></tr></table>';
  return '<div class="ppage pg">'+OFFICIAL_HEAD({dir:H.dir,school:H.school,title:title+' — '+course.subject+' للصف '+gLabel(course.grade),line2:'الفصل الدراسي: '+H.term+' - العام الدراسي: '+H.year+'م',student:true,box:box})+
    qs.map(function(q,i){return '<div class="fin-pq"><div class="fin-pn">'+(i+1)+') <small>['+esc(srcLabel(q))+' · س'+esc(q.n)+' · '+esc(q.m)+' د]</small></div><img '+finImgAttr({img:q.im,lb:q.lb,srcno:q.n},i+1,O)+' style="max-width:100%"></div>';}).join('')+'</div>'+
    (showAns?'<div class="ppage pg"><h2 style="text-align:center">الإجابات</h2>'+qs.map(function(q,i){return '<p><b>'+(i+1)+')</b> '+supify(esc(finRelabel(q.a,q.n,i+1))).replace(/\n/g,'<br>')+'</p>';}).join('')+'</div>':'');
}
function printQs(qs,title){
  if(!qs.length)return;
  track('finals_print',title+' ('+qs.length+')');
  if(IN_APP||MOBILE){ // التطبيق والموبايل: صفحة طباعة مستقلة تُفتح في المتصفح
    var w=null;if(!IN_APP){try{w=window.open('','_blank');}catch(e){w=null;}}
    toast('جارٍ التجهيز…');
    finReady(function(){return printHtml(qs,title,true);}).then(function(h){return api('/api/export',{format:'print',name:finName(title),html:h});}).then(function(r){
      if(w){try{w.location.href=r.url;return;}catch(e){}}
      var a=document.createElement('a');a.href=r.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);
      if(IN_APP)toast('تُفتح صفحة الطباعة في المتصفح… اختر «حفظ PDF» أو الطابعة');
    },function(e){if(w)try{w.close();}catch(x){}toast(e.message);});
    return;
  }
  finReady(function(){return printHtml(qs,title,false);}).then(function(h){
  var a=$('printArea');a.innerHTML=h;
  var imgs=a.querySelectorAll('img'),left=imgs.length;
  function go(){doPrint(finName(title));}
  if(!left)return go();
  Array.prototype.forEach.call(imgs,function(im){if(im.complete){if(--left===0)go();}else im.onload=im.onerror=function(){if(--left===0)go();};});
  });
}
function bindSide(){
  bindCoursePick(courses,'courseSel',selectCourse);
  Array.prototype.forEach.call(document.querySelectorAll('[data-u]'),function(b){b.onclick=function(){unitSel=b.getAttribute('data-u');lessonSel='';lsSet('tahdir_fin_unit',unitSel);renderSide();renderMain();window.scrollTo(0,0);};});
  if($('lessonSel'))$('lessonSel').onchange=function(){lessonSel=this.value;renderMain();};
  if($('yearSel'))$('yearSel').onchange=function(){yearSel=this.value;renderMain();};
  if($('ansChk'))$('ansChk').onchange=function(){showAns=this.checked;renderMain();};
  if($('printPicked'))$('printPicked').onclick=function(){printQs(pickedInOrder(),'ورقة مراجعة من امتحانات الوزارة');};
  if($('printPickedUnit'))$('printPickedUnit').onclick=function(){printQs(unitPicked(),'ورقة مراجعة — الوحدة '+unitSel);};
  if($('clearPicked'))$('clearPicked').onclick=function(){picked={};renderSide();renderMain();};
  if($('printUnit'))$('printUnit').onclick=function(){var u=units().filter(function(x){return x.u===unitSel;})[0];printQs(filtered(),'أسئلة الوحدة '+unitSel+(u&&u.name?': '+u.name:'')+' من امتحانات الوزارة');};
}
function selectCourse(key){
  course=courses.filter(function(c){return c.key===key;})[0]||null;data=null;picked={};lessonSel='';yearSel='';
  if(!course){renderSide();renderMain();return Promise.resolve();}
  lsSet('tahdir_fin_course',key);renderSide();$('fmain').innerHTML='<div class="welcome"><h2>جارٍ التحميل…</h2></div>';
  return api('/api/finals?key='+encodeURIComponent(key)).then(function(d){data=d;track('finals_open',key);renderSide();renderMain();},function(e){$('fmain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
}
Promise.all([api('/api/me'),api('/api/courses')]).then(function(r){
  me=r[0];initNav(me);
  courses=(r[1].courses||[]).filter(function(c){return FIN_INDEX[c.key];}).map(function(c){return Object.assign({},c,{key:c.key});});
  if(!courses.length){$('fmain').innerHTML='<div class="welcome"><h2>لا توجد اختبارات نهائية لصفوفك بعد</h2><p>نضيف امتحانات بقية المواد تباعًا.</p></div>';renderSide();return;}
  var last=lsGet('tahdir_fin_course'),c=courses.filter(function(x){return x.key===last;})[0]||cpDefault(courses);
  selectCourse(c.key);
},function(e){$('fmain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
