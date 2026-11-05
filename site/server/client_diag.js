(function(){
'use strict';
// صفحة «الاختبار التشخيصي»: اختبار قصير يغطي المادة كاملة (العلوم والرياضيات)
// يسحب أسئلة من بنك الأسئلة بواقع أسئلة موزعة على كل الوحدات، ويقيمها المعلم مع الطلاب
// فورًا سؤالًا سؤالًا، ثم يظهر تقريرًا بالمستوى وأضعف الوحدات والدروس مع طباعة رسمية.
guard();
var SCI_RE=/علوم|أحياء|فيزياء|كيمياء|بيئ/,MATH_RE=/رياض/;
var courses=[],course=null,bank=null,run=null;
var $id=function(x){return document.getElementById(x);};
function track(type,detail){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,lesson_id:course&&course.key?course.subject+' '+course.grade:'',detail:detail||''})});}catch(e){}}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function rich(t){return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');}
function slug(s){return String(s||'').replace(/[\\/:*?"<>|]+/g,'-').slice(0,80);}

// ---------- الشريط الجانبي: مادة وصف وعدد الأسئلة ----------
function renderSide(){
  var sci=courses.filter(function(c){return SCI_RE.test(c.subject);}),mth=courses.filter(function(c){return MATH_RE.test(c.subject);});
  var cs=sci.concat(mth); // مواد العلوم أولًا ثم الرياضيات
  if(!cs.length){
    $('qside').innerHTML='<section class="qcard"><h3>لا توجد مواد مطابقة</h3><p class="muted small">الاختبار التشخيصي متاح لمواد العلوم (علوم · فيزياء · كيمياء · أحياء · بيئة) والرياضيات، ولا تُظهر لك قائمة الحساب مواد منها.</p></section>';
    $('qmain').innerHTML='<div class="welcome"><h2>🧪 لا توجد مواد متاحة لحسابك بعد</h2></div>';
    return;
  }
  var h='<section class="qcard"><h3>1. المادة والصف</h3>'+coursePick(cs,course&&course.key,'dgCourse')+
    '<label class="qrow">عدد الأسئلة <select id="dgCount" class="qsel sm"><option value="10">10 أسئلة</option><option value="15">15 سؤالًا</option><option value="20">20 سؤالًا</option></select></label>'+
    '<button type="button" class="btn primary go-btn" id="dgGo">ابدأ الاختبار التشخيصي</button></section>'+
    '<section class="qcard"><h3>كيف يعمل؟</h3><ul class="muted small" style="padding-inline-start:18px;line-height:1.9">'+
    '<li>تُسحب الأسئلة عشوائيًا من بنك المادة كاملة، موزّعة على وحداتها حتى تغطي الكتاب.</li>'+
    '<li>اعرض سؤالًا سؤالًا وعلّم إجابة الطلاب (الاختيارات تُصحَّح تلقائيًا، وقصيرة الإجابة تقيمها أنت بنموذج الإجابة).</li>'+
    '<li>آخر الاختبار: نسبة النجاح، وتحليل لكل وحدة، وقائمة الدروس المتعثرة لتبني عليها الخطط العلاجية.</li>'+
    '<li>التقرير قابل للطباعة بالترويسة الرسمية، ويُحسب في سجل النشاط.</li></ul></section>';
  $('qside').innerHTML=h;
  bindCoursePick(cs,'dgCourse',function(key){course=cs.filter(function(c){return c.key===key;})[0]||null;bank=null;run=null;welcome();});
  if($('dgGo'))$('dgGo').onclick=start;
}
function welcome(){
  $('qmain').innerHTML='<div class="welcome qwel"><h2>🧪 الاختبار التشخيصي'+(course?(' — '+esc(course.subject)+' — الصف '+esc(course.grade)):'')+'</h2><p>اختر المادة والصف وعدد الأسئلة من القائمة، ثم اضغط «ابدأ الاختبار التشخيصي». الأسئلة تغطي وحدات المادة كاملة لتحدد أين يتعثر الطلاب من أول الفصل.</p></div>';
}

// ---------- سحب الأسئلة من البنك: توزيع عادل على الوحدات ----------
function okItem(q){
  if(!q||!q.stem)return false;
  if(q.type==='mcq')return (q.choices||[]).length>=2&&q.choices[q.correct]!=null;
  return String(q.answer||'').trim().length>0; // قصيرة بنموذج إجابة
}
function sample(target){
  var byU={},order=[],les={};
  bank.lessons.forEach(function(l){les[String(l.id)]=l;});
  bank.items.forEach(function(q){
    if(!okItem(q))return;
    var l=les[String(q.lesson_id)];if(!l)return;
    var k=String(l.unit);if(!byU[k]){byU[k]=[];order.push(k);}
    byU[k].push(q);
  });
  if(!order.length)return [];
  order.sort(function(a,b){return (parseInt(a,10)||0)-(parseInt(b,10)||0);});
  // داخل كل وحدة: نفضّل المزج (اختيار من متعدد ثم مقالي قصير) بترتيب عشوائي
  order.forEach(function(k){var m=byU[k],mcq=m.filter(function(q){return q.type==='mcq';}),sht=m.filter(function(q){return q.type!=='mcq';});byU[k]=shuffle(mcq).concat(shuffle(sht));});
  var out=[];
  // دورة أولى: سؤال من كل وحدة، ثم دورات تالية حتى بلوغ العدد المطلوب
  var cur=order.slice();
  while(out.length<target&&cur.length){
    var next=[];
    cur.forEach(function(k){var g=byU[k];if(g.length){out.push(g.pop());if(g.length)next.push(k);}});
    cur=next;
  }
  // إن نفدت أسئلة البنك قبل العدد المطلوب فنكمل بما تيسر
  return out.slice(0,target);
}
function start(){
  if(!course){toast('اختر المادة والصف أولًا');return;}
  var target=parseInt(($('dgCount')||{}).value||'10',10)||10;
  $('qmain').innerHTML='<div class="welcome"><h2>جارٍ سحب أسئلة «'+esc(course.subject)+' — الصف '+esc(course.grade)+'»…</h2></div>';
  api('/api/quiz/bank?key='+encodeURIComponent(course.key)).then(function(r){
    bank={lessons:r.lessons||[],items:r.items||[]};
    var qs=sample(target);
    if(qs.length<3){$('qmain').innerHTML='<div class="welcome"><h2>لا توجد أسئلة كافية في بنك هذه المادة بعد</h2><p class="muted">أكمل تحضير الدروس وواجباتها لتتشكل أسئلة التشخيص تلقائيًا.</p></div>';return;}
    if(qs.length<target)toast('تُوفر '+qs.length+' سؤالًا فقط من بنك هذه المادة');
    run={qs:qs,i:0,ans:[],lesson:{}};
    bank.lessons.forEach(function(l){run.lesson[String(l.id)]=l;});
    track('diag_run',course.subject+' '+course.grade+' · '+qs.length+' سؤالًا');
    show();
  },function(e){toast(e.message||'تعذر جلب البنك');$('qmain').innerHTML='<div class="welcome"><h2>تعذّر جلب البنك</h2></div>';});
}

// ---------- عرض سؤال سؤال ----------
function bar(){var d=run.i/Math.max(run.qs.length,1)*100;return '<div style="height:8px;background:#e3ede8;border-radius:6px;margin-bottom:10px;overflow:hidden"><div style="height:100%;width:'+d+'%;background:#0e7c66;border-radius:6px;transition:width .3s"></div></div>';}
function show(){
  stopAll0();
  if(run.i>=run.qs.length)return result();
  var q=run.qs[run.i],l=run.lesson[String(q.lesson_id)]||{};
  var done=run.ans.filter(function(a){return a.ok!=null;}).length,ok=run.ans.filter(function(a){return a.ok;}).length;
  var h='<div class="qcard dg-run"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">'+
    '<span class="muted small">السؤال '+(run.i+1)+' من '+run.qs.length+' · الوحدة '+esc(l.unit||'')+(l.unit_name?(' — '+esc(l.unit_name)):'')+'</span>'+
    '<span class="muted small">الصحيح حتى الآن: <b>'+ok+'</b> / '+done+'</span></div>'+bar()+
    '<div style="font-size:.82em;color:#58726a;margin-bottom:4px">الدرس: '+esc(l.title||'')+' · '+(q.ao||'معرفة')+' · '+(q.marks||1)+' درجة</div>'+
    '<div class="dg-q" dir="auto" style="font-size:1.06em;line-height:1.7">'+rich(q.stem)+'</div>';
  if(q.img)h+='<img src="'+location.origin+'/fin/'+esc(q.img)+'" alt="" style="display:block;max-width:100%;max-height:340px;margin:8px auto">';
  if(q.type==='mcq'){
    h+='<div class="dg-opts" style="display:grid;gap:6px;margin-top:10px">'+q.choices.map(function(c,k){
      var LET='أبجدهوزح';
      return '<button type="button" class="btn dg-opt" data-diag="'+k+'" dir="auto" style="text-align:start;border:1.5px solid var(--line,#d4e5de);border-radius:10px;padding:9px 12px;background:var(--paper,#fff)"><b>'+LET[k]+') </b>'+esc(c)+'</button>';
    }).join('')+'</div><div id="dgFb"></div>';
  }else{
    h+='<div style="margin-top:10px;position:relative"><div contenteditable="true" id="dgTxt" dir="auto" style="border:1.5px solid var(--line,#d4e5de);border-radius:10px;padding:10px;min-height:70px;background:var(--paper,#fff);font:inherit;line-height:1.7" data-ph="اكتب إجابة الطلاب هنا…"></div>'+
    '<button type="button" class="btn primary" id="dgMark" style="margin-top:8px">صحّح بنموذج الإجابة</button></div><div id="dgFb"></div>';
  }
  $('qmain').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('.dg-opt'),function(b){
    b.onclick=function(){
      var k=+b.getAttribute('data-diag'),right=k===q.correct;
      Array.prototype.forEach.call(document.querySelectorAll('.dg-opt'),function(o){o.disabled=true;if(+o.getAttribute('data-diag')===q.correct)o.style.cssText+=';border-color:#0e7c66;background:#e3f1eb';});
      if(!right)b.style.cssText+=';border-color:#b42318;background:#fdecec;text-decoration:line-through';
      run.ans.push({q:q,ok:right,unit:String((l.unit)||'')});
      fb(right,letter(q.correct));
    };
  });
  var mk=$('dgMark');if(mk)mk.onclick=function(){
    var v=(($('dgTxt')||{}).textContent||'').trim();
    if(!v){toast('اكتب الإجابة أولًا — أو علّمها مباشرة');return;}
    $('dgTxt').contentEditable='false';$('dgTxt').style.background='#f4f8f6';mk.disabled=true;
    run.ans.push({q:q,self:true,unit:String((l.unit)||'')});
    selfGrade(q);
  };
  nextBtn(false);
}
function letter(k){return 'أبجدهوزح'.charAt(k)||'?';}
function nextBtn(need){
  var h='<button type="button" class="btn primary go-btn" id="dgNext"'+(need?'':' disabled')+' style="margin-top:12px">'+(run.i+1<run.qs.length?'السؤال التالي ◀':'النتيجة النهائية 🏁')+'</button>';
  var f=$('dgFb');if(f)f.insertAdjacentHTML('afterend',h);
  var n=$('dgNext');
  if(n)n.onclick=function(){run.i++;show();};
}
function fb(right,cor){
  var f=$('dgFb');if(f)f.innerHTML='<div style="margin-top:8px;border-radius:9px;padding:7px 10px;font-weight:700;background:'+(right?'#e3f1eb;color:#0e7c66':'#fdecec;color:#b42318')+'">'+(right?'✅ إجابة صحيحة':'❌ غير صحيحة — الصواب: '+cor)+'</div>';
  nextBtn(true);
}
function selfGrade(q){
  var LET='أبجدهوزح';
  var f=$('dgFb');if(f)f.innerHTML='<div style="margin-top:8px"><b class="muted small">نموذج الإجابة:</b><div dir="auto" style="border:1px solid #0e7c66;background:#f1f8f5;border-radius:8px;padding:7px 10px;margin-top:4px">'+rich(q.answer)+'</div>'+
    '<div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn" id="sgY" style="border-color:#0e7c66">✅ أجابوا صحيحًا</button><button type="button" class="btn" id="sgN" style="border-color:#b42318">❌ لم يجيبوا صح</button></div></div>';
  if($('sgY'))$('sgY').onclick=function(){var a=run.ans[run.ans.length-1];a.ok=true;a.self=true;fb(true,letter(0));};
  if($('sgN'))$('sgN').onclick=function(){var a=run.ans[run.ans.length-1];a.ok=false;a.self=true;fb(false,letter(0));};
}
var tmrs=[];
function stopAll0(){tmrs.forEach(clearTimeout);tmrs=[];}

// ---------- التقرير النهائي ----------
function unitStats(){
  var m={};
  run.ans.forEach(function(a){var k=a.unit||'؟';if(!m[k])m[k]={ok:0,tot:0};m[k].tot++;if(a.ok)m[k].ok++;});
  var names={};bank.lessons.forEach(function(l){names[String(l.unit)]=l.unit_name||'';});
  return Object.keys(m).map(function(k){return {unit:k,name:names[k]||'',ok:m[k].ok,tot:m[k].tot};});
}
function weakLessons(){
  var m={};
  run.ans.forEach(function(a){if(a.ok)return;var l=run.lesson[String(a.q.lesson_id)]||{},k=String(a.q.lesson_id);if(!m[k])m[k]={t:l.title||'',u:l.unit||''};});
  return Object.keys(m).map(function(k){return m[k];});
}
function result(){
  stopAll0();
  var tot=run.ans.length,ok=run.ans.filter(function(a){return a.ok;}).length,pct=tot?Math.round(ok/tot*100):0;
  var us=unitStats(),wl=weakLessons();
  var verdict=pct>=85?'مستوى ممتاز — المادة مُتقنة والطلاب جاهزون للمضي.':pct>=70?'مستوى جيد — راجع الدروس المتعثرة أسفله قبل الشروع في جديد المنهج.':pct>=50?'مستوى متوسط — تحتاج خططًا علاجية للوحدات الضعيفة بأسفل التقرير.':'مستوى منخفض — ابنِ خططًا علاجية للدروس المتعثرة، وأعد التشخيص بعد العلاج.';
  var h='<div class="qcard dg-res"><h2>🧪 نتيجة التشخيص — '+esc(course.subject)+' · الصف '+esc(course.grade)+'</h2>'+
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:10px 0">'+
    '<div style="border:2px solid #0e7c66;border-radius:12px;padding:10px 18px;text-align:center"><div style="font-size:1.9em;font-weight:900;color:#0e7c66">'+pct+'%</div><div class="muted small">النسبة الكلية</div></div>'+
    '<div style="border:1.5px solid var(--line,#d4e5de);border-radius:12px;padding:10px 18px;text-align:center"><div style="font-size:1.9em;font-weight:900">'+ok+'/'+tot+'</div><div class="muted small">إجابات صحيحة</div></div></div>'+
    '<p style="font-weight:700">'+verdict+'</p>'+
    '<h3 style="margin:12px 0 4px">التحليل حسب الوحدة</h3>'+
    '<table style="width:100%;border-collapse:collapse;font-size:.9em">'+us.map(function(u){
      var p=Math.round(u.ok/u.tot*100),c=p>=70?'#0e7c66':p>=50?'#9a6700':'#b42318';
      return '<tr><td style="border:1px solid #ccc;padding:5px 8px">الوحدة '+esc(u.unit)+(u.name?' — '+esc(u.name):'')+'</td><td style="border:1px solid #ccc;padding:5px 8px;white-space:nowrap">'+u.ok+' / '+u.tot+'</td><td style="border:1px solid #ccc;padding:5px 8px;min-width:110px"><div style="background:#e3ede8;border-radius:5px;overflow:hidden"><div style="width:'+p+'%;height:9px;background:'+c+'"></div></div></td></tr>';
    }).join('')+'</table>'+
    (wl.length?('<h3 style="margin:12px 0 4px">الدرسات المتعثرة ('+wl.length+')</h3><ul style="padding-inline-start:18px;font-size:.92em;line-height:1.8">'+wl.map(function(w){return '<li>الوحدة '+esc(w.u)+' — '+esc(w.t)+'</li>';}).join('')+'</ul><p class="muted small">افتح صفحة «الخطط العلاجية والأنشطة الصفية» واختر هذه الدروس لتكوين الخطة.</p>'):'<p style="color:#0e7c66;font-weight:700">لا دروس متعثرة — أحسنت! 🎉</p>')+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn primary" id="dgPrint">🖨️ اطبع التقرير</button><button type="button" class="btn" id="dgAgain">🔄 أعد تشخيصًا بأسئلة جديدة</button></div></div>';
  $('qmain').innerHTML=h;
  track('diag_run',course.subject+' '+course.grade+' · '+pct+'% ('+ok+"/"+tot+')');
  if($('dgAgain'))$('dgAgain').onclick=start;
  if($('dgPrint'))$('dgPrint').onclick=function(){printRep(ok,tot,pct,us,wl);};
}
function printRep(ok,tot,pct,us,wl){
  var now=new Date(),d=now.toLocaleDateString('ar-OM');
  var h=OFFICIAL_HEAD({dir:'المديرية العامة للتعليم بمحافظة البريمي',school:'مدرسة حذيفة بن محصن (5-12)',title:'تقرير الاختبار التشخيصي — '+course.subject,line2:'الصف: '+course.grade+' — الفصل: ..... — التاريخ: '+d});
  h+='<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><tr><td style="border:1px solid #000;padding:5px 8px"><b>اسم الحصة / الشعبة:</b> ..................</td><td style="border:1px solid #000;padding:5px 8px"><b>الأسئلة:</b> '+tot+'</td><td style="border:1px solid #000;padding:5px 8px"><b>الصحيح:</b> '+ok+'</td><td style="border:1px solid #000;padding:5px 8px"><b>النسبة:</b> '+pct+'%</td></tr></table>';
  h+='<h3 style="font-size:1em;margin:10px 0 4px;background:#eef3f1;padding:2px 8px;border-inline-start:4px solid #0e7c66">التحليل حسب الوحدة</h3>';
  h+='<table style="width:100%;border-collapse:collapse;font-size:.92em"><tr><th style="border:1px solid #000;padding:4px 7px;background:#e6e6e6">الوحدة</th><th style="border:1px solid #000;padding:4px 7px;background:#e6e6e6">الصحيح / المطلوب</th><th style="border:1px solid #000;padding:4px 7px;background:#e6e6e6">الملاحظة</th></tr>'+
    us.map(function(u){var p=Math.round(u.ok/u.tot*100);return '<tr><td style="border:1px solid #000;padding:4px 7px">الوحدة '+esc(u.unit)+(u.name?' — '+esc(u.name):'')+'</td><td style="border:1px solid #000;padding:4px 7px;text-align:center">'+u.ok+' / '+u.tot+'</td><td style="border:1px solid #000;padding:4px 7px">'+(p>=70?'مستوى مقبول':p>=50?'تحتاج مراجعة':'تحتاج خطة علاجية')+'</td></tr>';}).join('')+'</table>';
  if(wl.length){
    h+='<h3 style="font-size:1em;margin:10px 0 4px;background:#eef3f1;padding:2px 8px;border-inline-start:4px solid #0e7c66">الدرسات المتعثرة — تُبنى عليها الخطط العلاجية</h3>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:.92em"><tr><th style="border:1px solid #000;padding:4px 7px;background:#e6e6e6">#</th><th style="border:1px solid #000;padding:4px 7px;background:#e6e6e6">الوحدة</th><th style="border:1px solid #000;padding:4px 7px;background:#e6e6e6">الدرس</th><th style="border:1px solid #000;padding:4px 7px;background:#e6e6e6">الإجراء المقترح</th></tr>'+
      wl.map(function(w,i){return '<tr><td style="border:1px solid #000;padding:4px 7px;text-align:center">'+(i+1)+'</td><td style="border:1px solid #000;padding:4px 7px">'+esc(w.u)+'</td><td style="border:1px solid #000;padding:4px 7px">'+esc(w.t)+'</td><td style="border:1px solid #000;padding:4px 7px;color:#888">(يُملأ يدويًا)</td></tr>';}).join('')+'</table>';
  }
  h+='<p style="margin-top:10px;font-size:.9em"><b>ملاحظات المعلم:</b> ..........................................................................................................................</p>';
  $('printArea').innerHTML=h;
  track('diag_print',course.subject+' '+course.grade+' · '+pct+'%');
  doPrint('تقرير-تشخيصي-'+slug(course.subject+'-'+course.grade));
}

// ---------- الإقلاع ----------
api('/api/courses').then(function(r){
  courses=r.courses||[];
  renderSide();
},function(e){$('qside').innerHTML='';$('qmain').innerHTML='<div class="welcome"><h2>تعذر تحميل قائمة المواد</h2><p class="muted">'+esc(e.message||'')+'</p></div>';});
})();
