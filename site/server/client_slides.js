// «العروض التقديمية»: عروض البوربوينت مجمّعة حسب المادة والصف، بمعاينة وزر تحميل.
// العروض تُعاين وتُحمَّل بروابط Google Drive المباشرة (الملفات عامة)، ولا تُخزَّن محليًّا.
(function(){
'use strict';
var SL=window.SLIDES||[];
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function track(type,detail){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,detail:detail||'',title:''})});}catch(e){}}
function gnum(g){var m={'الأول':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};return m[String(g||'').replace(/^الصف\s+/,'')]||99;}
function gLabel(g){return String(g==null?'':g).replace(/^الصف\s+/,'');}
function previewUrl(d){return 'https://drive.google.com/file/d/'+encodeURIComponent(d)+'/preview';}
function downloadUrl(d){return 'https://drive.usercontent.google.com/download?id='+encodeURIComponent(d)+'&export=download';}
function openUrl(d){return 'https://drive.google.com/file/d/'+encodeURIComponent(d)+'/view';}
var CSS='.sx{--sx-m:var(--main,#1f8a70);--sx-ml:var(--main-l,#e3f1eb);--sx-md:var(--main-d,#0b3b33)}'+
'.sx-top{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}'+
'.sx-search{width:100%;box-sizing:border-box;font:inherit;font-size:.92rem;padding:10px 14px;border:1px solid var(--line,#e2e0d6);border-radius:12px;background:var(--paper,#fff);color:var(--ink,#10261f);outline:0}'+
'.sx-search:focus{border-color:var(--sx-m)}'+
'.sx-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.sx-tabs::-webkit-scrollbar{display:none}'+
'.sx-tab{flex:0 0 auto;font:inherit;font-size:.86rem;font-weight:700;padding:7px 14px;border-radius:999px;border:1px solid var(--line,#e2e0d6);background:var(--paper,#fff);color:var(--mute,#5b6d67);cursor:pointer}'+
'.sx-tab b{font-weight:600;opacity:.7;margin-inline-start:4px;font-size:.78rem}'+
'.sx-tab.on{background:var(--sx-m);border-color:var(--sx-m);color:#fff}'+
'.sx-unit{border:1px solid var(--line,#e2e0d6);border-radius:14px;background:var(--paper,#fff);margin-bottom:9px;overflow:hidden}'+
'.sx-unit>summary{list-style:none;display:flex;align-items:center;gap:11px;padding:13px 14px;cursor:pointer;-webkit-tap-highlight-color:transparent}'+
'.sx-unit>summary::-webkit-details-marker{display:none}'+
'.sx-un{flex:0 0 auto;min-width:30px;height:30px;border-radius:9px;background:var(--sx-ml);color:var(--sx-md);font-weight:800;font-size:.85rem;display:flex;align-items:center;justify-content:center}'+
'.sx-ut{flex:1 1 auto;font-weight:700;font-size:.95rem;color:var(--ink,#10261f);line-height:1.35}'+
'.sx-cnt{flex:0 0 auto;font-size:.75rem;color:var(--mute,#5b6d67)}'+
'.sx-chev{flex:0 0 auto;width:8px;height:8px;border-left:2px solid var(--mute,#5b6d67);border-bottom:2px solid var(--mute,#5b6d67);transform:rotate(45deg);transition:transform .15s;margin-inline-start:2px}'+
'.sx-unit[open]>summary .sx-chev{transform:rotate(-45deg)}'+
'.sx-unit[open]>summary{border-bottom:1px solid var(--line,#e2e0d6)}'+
'.sx-list{display:flex;flex-direction:column}'+
'.sx-sub{font-size:.74rem;font-weight:800;color:var(--mute,#5b6d67);letter-spacing:.02em;padding:11px 14px 5px;background:rgba(127,127,127,.05);border-top:1px solid var(--line,#e2e0d6)}'+
'.sx-row{display:flex;align-items:center;gap:11px;width:100%;box-sizing:border-box;text-align:start;font:inherit;background:none;border:0;border-top:1px solid var(--line,#e2e0d6);padding:11px 14px;cursor:pointer;color:var(--ink,#10261f);-webkit-tap-highlight-color:transparent}'+
'.sx-list>.sx-row:first-child{border-top:0}'+
'.sx-row:hover,.sx-row:active{background:var(--sx-ml)}'+
'.sx-ln{flex:0 0 auto;min-width:38px;text-align:center;font-size:.78rem;font-weight:800;color:var(--sx-m);direction:ltr}'+
'.sx-lt{flex:1 1 auto;font-size:.88rem;font-weight:600;line-height:1.45}'+
'.sx-arr{flex:0 0 auto;width:7px;height:7px;border-left:2px solid #b4bcb8;border-bottom:2px solid #b4bcb8;transform:rotate(45deg)}'+
'.sx-none{text-align:center;color:var(--mute,#5b6d67);padding:26px 8px;font-size:.9rem}'+
'.sx-h{font-size:1.05rem;margin:0 0 12px;color:var(--sx-md)}';
function injectCss(){if(document.getElementById('sx-css'))return;var s=document.createElement('style');s.id='sx-css';s.textContent=CSS;document.head.appendChild(s);}
function unitNum(u){var m=/^(\d+)\s*-/.exec(u||'');return m?+m[1]:999;}
function unitTitle(u){return String(u||'').replace(/^\d+\s*-\s*/,'');}
function lessonOf(n){var m=/^(\d+)-(\d+)\s*(.*)$/.exec(n||'');return m?{u:+m[1],l:+m[2],t:m[3]||n}:null;}
var curGrade=null,query='';
function norm(s){return String(s||'').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();}
function row(s,num,title){
  return '<button type="button" class="sx-row" data-drive="'+esc(s.drive)+'" data-name="'+esc(s.name)+'"><span class="sx-ln">'+esc(num||'')+'</span><span class="sx-lt">'+esc(title)+'</span><span class="sx-arr"></span></button>';
}
function renderGrade(box,list){
  var q=norm(query).trim();
  if(q)list=list.filter(function(s){return norm(s.name+' '+s.unit).indexOf(q)>=0;});
  if(!list.length){box.innerHTML='<div class="sx-none">لا توجد نتائج</div>';return;}
  var units={};
  list.forEach(function(s){(units[s.unit||'أخرى']=units[s.unit||'أخرى']||[]).push(s);});
  var keys=Object.keys(units).sort(function(a,b){return (unitNum(a)-unitNum(b))||a.localeCompare(b,'ar');});
  var h='';
  keys.forEach(function(k){
    var items=units[k],les=[],extra=[];
    items.forEach(function(s){var L=lessonOf(s.name);if(L)les.push({s:s,L:L});else extra.push(s);});
    les.sort(function(a,b){return (a.L.u-b.L.u)||(a.L.l-b.L.l);});
    var n=unitNum(k);
    h+='<details class="sx-unit"'+(q?' open':'')+'><summary><span class="sx-un">'+(n<999?n:'…')+'</span><span class="sx-ut">'+esc(n<999?unitTitle(k):k)+'</span><span class="sx-cnt">'+items.length+'</span><span class="sx-chev"></span></summary><div class="sx-list">';
    les.forEach(function(o){h+=row(o.s,o.L.u+'-'+o.L.l,o.L.t);});
    if(extra.length){
      h+='<div class="sx-sub">أسئلة ومراجعة وملفات أخرى</div>';
      extra.sort(function(a,b){return a.name.localeCompare(b.name,'ar');}).forEach(function(s){h+=row(s,'',s.name);});
    }
    h+='</div></details>';
  });
  box.innerHTML=h;
}
function render(){
  var el=document.getElementById('sl');if(!el)return;
  injectCss();
  if(!SL.length){
    el.innerHTML='<div class="empty-state"><h2>لا توجد عروض تقديمية بعد</h2><p>تُضاف العروض (PowerPoint) هنا حسب المادة والصف، وستظهر تباعًا.</p></div>';
    return;
  }
  var subs={};
  SL.forEach(function(s){(subs[s.subject]=subs[s.subject]||{})[s.grade]=(subs[s.subject][s.grade]||[]).concat(s);});
  var h='<div class="sx">';
  Object.keys(subs).sort(function(a,b){return a.localeCompare(b,'ar');}).forEach(function(subj,si){
    var grades=subs[subj];
    var gk=Object.keys(grades).sort(function(a,b){return (gnum(a)-gnum(b))||a.localeCompare(b,'ar');});
    var saved=null;try{saved=localStorage.getItem('sx_grade_'+si);}catch(e){}
    if(gk.indexOf(saved)<0)saved=gk[0];
    h+='<section class="sx-subj" data-si="'+si+'"><h2 class="sx-h">'+esc(subj)+'</h2><div class="sx-top">'+
      '<input class="sx-search" type="search" placeholder="ابحث عن درس" aria-label="بحث">'+
      '<div class="sx-tabs">'+gk.map(function(g){return '<button type="button" class="sx-tab'+(g===saved?' on':'')+'" data-g="'+esc(g)+'">'+esc(gLabel(g))+'<b>'+grades[g].length+'</b></button>';}).join('')+'</div></div>'+
      '<div class="sx-body"></div></section>';
  });
  h+='</div>';
  el.innerHTML=h;
  Array.prototype.forEach.call(el.querySelectorAll('.sx-subj'),function(sec){
    var si=sec.getAttribute('data-si'),subj=Object.keys(subs).sort(function(a,b){return a.localeCompare(b,'ar');})[+si],grades=subs[subj];
    var box=sec.querySelector('.sx-body'),inp=sec.querySelector('.sx-search'),cur=sec.querySelector('.sx-tab.on').getAttribute('data-g');
    function draw(){renderGrade(box,grades[cur]);}
    Array.prototype.forEach.call(sec.querySelectorAll('.sx-tab'),function(t){
      t.onclick=function(){cur=t.getAttribute('data-g');Array.prototype.forEach.call(sec.querySelectorAll('.sx-tab'),function(x){x.classList.toggle('on',x===t);});try{localStorage.setItem('sx_grade_'+si,cur);}catch(e){}draw();};
    });
    inp.oninput=function(){query=inp.value;draw();};
    box.addEventListener('click',function(e){var b=e.target.closest?e.target.closest('.sx-row'):null;if(b)open(b.getAttribute('data-drive'),b.getAttribute('data-name'));});
    draw();
  });
}
function open(d,name){
  var html='<div class="sl-prev">'+
    '<div class="sl-prev-head"><b>'+esc(name)+'</b>'+
    '<a class="btn small" href="'+esc(openUrl(d))+'" target="_blank" rel="noopener">فتح في Google Drive</a>'+
    '<a class="btn primary small" href="'+esc(downloadUrl(d))+'" download>تحميل</a></div>'+
    '<div class="sl-frame"><iframe src="'+esc(previewUrl(d))+'" title="معاينة العرض" loading="lazy" allowfullscreen></iframe></div>'+
    '<p class="muted small" style="margin:8px 0 0">المعاينة من Google Drive. إن لم تظهر فاستخدم «تحميل» أو «فتح في Google Drive». </p></div>';
  dialog({title:'عرض تقديمي',html:html,okText:'إغلاق',cancelText:false,wide:true});
  track('slides_open',name);
}
render();
})();

