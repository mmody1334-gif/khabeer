// «إرسال الطلاب إلى الخطط»: مشترك بين «كروت الأسئلة» و«تحليل النتائج».
// المعلم يختار الوجهة (خطة علاجية / خطة إثرائية / سجل صعوبات التعلم) ويختار الطلاب بنفسه،
// فتُبنى الخطة في صفحة «الخطط والأنشطة الصفية» تلقائيًا من نتائجهم (الدروس الأضعف أو الأقوى، والدرجات، وجوانب الضعف).
// opts: {title, date, teacher, src, course, subject, grade, cls, thr, rows:[{name, full, sc, max, p, les:{lid:{t,got,max}}, ao:{ao:{got,max}}, members?:[names]}]}
var SENDPLAN=(function(){
  function pc(x){return Math.round(x*100)+'%';}
  function today(){var d=new Date();return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate();}
  var DEST={rem:'🩹 خطة علاجية',enrich:'🌟 خطة إثرائية',ld:'🧩 سجل صعوبات التعلم'};
  function pre(dest,r,thr){return dest==='enrich'?r.p>=0.8:r.p<thr;}
  // الطالب الواحد بعد فك المجموعة: كل عضو يأخذ نتيجة مجموعته
  function expand(rows){
    var out=[];
    rows.forEach(function(r){
      if(r.members&&r.members.length)r.members.forEach(function(m){out.push(Object.assign({},r,{name:m,full:m,grp:r.name,members:null}));});
      else out.push(r);
    });
    return out;
  }
  function lessonsOf(r){return Object.keys(r.les||{}).map(function(k){var x=r.les[k];return {lid:+k||null,t:x.t,p:x.max?x.got/x.max:0};});}
  function open(o){
    var thr=o.thr||0.5,rows=o.rows.filter(function(r){return r.max>0;}).sort(function(a,b){return a.p-b.p;}),dest='rem',regs=[];
    if(!rows.length){toast('لا توجد نتائج طلاب بعد');return;}
    var h='<div class="sp-dest" role="radiogroup">'+Object.keys(DEST).map(function(k){return '<label><input type="radio" name="spD" value="'+k+'"'+(k===dest?' checked':'')+'> '+DEST[k]+'</label>';}).join('')+'</div>'+
      '<p class="muted small" id="spHint"></p>'+
      '<div class="an-new" style="margin:4px 0"><button type="button" class="btn small" id="spAll">تحديد الكل</button><button type="button" class="btn small" id="spNone">إلغاء التحديد</button></div>'+
      '<div class="ck-pick sp-pick">'+rows.map(function(r,i){return '<label><input type="checkbox" data-sp="'+i+'"> '+esc(r.name)+(r.members&&r.members.length?' <small class="muted">('+esc(r.members.join('، '))+')</small>':'')+' <small class="muted">— '+(Math.round(r.sc*100)/100)+'/'+r.max+' ('+pc(r.p)+')</small></label>';}).join('')+'</div>'+
      '<label class="ck-f" id="spRegW" hidden><span>السجل</span><select id="spReg"><option value="new">+ سجل جديد: '+esc(o.cls||'')+'</option></select></label>';
    var sel={pick:[],dest:dest,reg:'new'};
    var dp=dialog({title:'إرسال الطلاب إلى الخطط',wide:true,html:h,okText:'إرسال ✓',cancelText:'إلغاء',
      extra:function(box){var pk=[];Array.prototype.forEach.call(box.querySelectorAll('[data-sp]:checked'),function(c){pk.push(rows[+c.getAttribute('data-sp')]);});var rg=box.querySelector('#spReg');sel={pick:pk,dest:dest,reg:rg?rg.value:'new'};}});
    function setDest(d){
      dest=d;
      Array.prototype.forEach.call(document.querySelectorAll('[data-sp]'),function(c){c.checked=pre(d,rows[+c.getAttribute('data-sp')],thr);});
      $('spHint').textContent=d==='enrich'?'اخترنا الطلاب 80% فأكثر — عدّل الاختيار. تُبنى خطة إثرائية من الدروس التي أتقنوها مع أنشطة وأسئلة تحدٍّ.':
        d==='rem'?'اخترنا الطلاب دون '+Math.round(thr*100)+'% — عدّل الاختيار. تُبنى الخطة العلاجية تلقائيًا من الدروس التي تعثّروا فيها ودرجاتهم.':
        'يُضاف الطالب الجديد إلى السجل، ومن كان فيه تُضاف له ملاحظة متابعة بالنتيجة.';
      $('spRegW').hidden=d!=='ld';
    }
    Array.prototype.forEach.call(document.querySelectorAll('[name=spD]'),function(r){r.onchange=function(){setDest(r.value);};});
    $('spAll').onclick=function(){Array.prototype.forEach.call(document.querySelectorAll('[data-sp]'),function(c){c.checked=true;});};
    $('spNone').onclick=function(){Array.prototype.forEach.call(document.querySelectorAll('[data-sp]'),function(c){c.checked=false;});};
    setDest(dest);
    api('/api/quizzes?kind=ld').then(function(r){regs=r.quizzes||[];var s=$('spReg');if(s)s.innerHTML=regs.map(function(g){return '<option value="'+g.id+'">'+esc(g.title)+'</option>';}).join('')+'<option value="new">+ سجل جديد: '+esc(o.cls||'')+'</option>';},function(){});
    dp.then(function(ok){
      if(!ok)return;
      if(!sel.pick.length){toast('اختر طالبًا واحدًا على الأقل');return;}
      if(sel.dest==='ld')toLd(o,expand(sel.pick),sel.reg);else toPlan(o,sel.pick,sel.dest);
    });
  }
  function toPlan(o,pick,mode){
    // الدروس: متوسط الطلاب المختارين في كل درس ← الأضعف للعلاج، والأقوى للإثراء
    var agg={};
    pick.forEach(function(r){Object.keys(r.les||{}).forEach(function(k){var x=r.les[k];if(!agg[k])agg[k]={lid:+k||null,t:x.t,got:0,max:0};agg[k].got+=x.got;agg[k].max+=x.max;});});
    var ls=Object.keys(agg).map(function(k){var a=agg[k];return {lid:a.lid,t:a.t,p:a.max?a.got/a.max:0};}).filter(function(x){return x.lid;});
    var pickL;
    if(mode==='enrich'){pickL=ls.sort(function(a,b){return b.p-a.p;}).slice(0,6);}
    else{pickL=ls.filter(function(x){return x.p<0.65;}).sort(function(a,b){return a.p-b.p;});if(!pickL.length)pickL=ls.sort(function(a,b){return a.p-b.p;}).slice(0,2);pickL=pickL.slice(0,6);}
    var stu=expand(pick).map(function(r){
      var L=lessonsOf(r);
      var ao=Object.keys(r.ao||{}).filter(function(k){var x=r.ao[k];return k&&x.max&&x.got/x.max<0.5;});
      return {name:r.full||r.name,cls:r.grp||o.cls||'',sc:Math.round(r.sc*100)/100,max:r.max,p:r.p,
        weak:L.filter(function(x){return x.p<0.5;}).map(function(x){return x.t;}),strong:L.filter(function(x){return x.p>=0.8;}).map(function(x){return x.t;}),weakAO:ao};
    });
    var hf={to:'remedial',mode:mode,course:o.course||'',lessons:pickL.map(function(x){return x.lid;}),students:stu,
      src:{title:o.title||'',date:o.date||today(),cls:o.cls||'',lessons:pickL.map(function(x){return {t:x.t,p:x.p};})},at:Date.now()};
    try{localStorage.setItem('tahdir_handoff',JSON.stringify(hf));}catch(e){}
    try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'send_to_plan',detail:mode+' '+stu.length,title:o.title||''})});}catch(e){}
    var go=function(){location.href='/remedial';};
    if(o.beforeGo)Promise.resolve(o.beforeGo()).then(go,go);else go();
  }
  function toLd(o,pick,reg){
    var p=reg==='new'?Promise.resolve({id:null,title:'سجل صعوبات التعلم — '+(o.cls||''),subject:o.subject||'',grade:o.grade||'',section:o.cls||'',teacher:o.teacher||'',year:schoolHdr().year,students:[],sig:{spec:'',principal:''}}):
      api('/api/quizzes/'+reg).then(function(r){var d=r.quiz.data;d.id=r.quiz.id;return d;});
    p.then(function(Rg){
      var note=function(r){return (o.src||'تقويم')+' «'+(o.title||'')+'»: '+(Math.round(r.sc*100)/100)+'/'+r.max+' ('+pc(r.p)+')'+(r.grp?' — '+r.grp:'');};
      var added=0,upd=0;Rg.students=Rg.students||[];
      pick.forEach(function(r){
        var nm=String(r.full||r.name||'').trim();
        var ex=Rg.students.filter(function(s){var n=(s.name||'').trim();return n===nm||n===String(r.name||'').trim();})[0];
        if(ex){ex.follow=ex.follow||[];ex.follow.push({d:today(),n:note(r),p:''});upd++;}
        else{Rg.students.push({name:nm,aspects:[],other:'',level:'',diag:note(r),goalsL:'',goalsS:'',strat:'',accom:'',eval:'',follow:[{d:today(),n:note(r),p:''}]});added++;}
      });
      return api('/api/quizzes',{id:Rg.id||undefined,title:Rg.title,grade:Rg.grade||'',subject:Rg.subject||'',kind:'ld',data:Rg}).then(function(){
        dialog({title:'تم ✓',message:(added?'أُضيف '+added+' طالبًا إلى السجل. ':'')+(upd?'أُضيفت ملاحظة متابعة لـ '+upd+' طالبًا موجودًا.':''),okText:'فتح السجل',cancelText:'إغلاق'}).then(function(x){if(x)location.href='/ld';});
      });
    }).catch(function(e){toast(e.message);});
  }
  return {open:open};
})();
