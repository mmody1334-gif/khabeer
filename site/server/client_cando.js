// «أستطيع أن ✓»: قوائم التقييم الذاتي في نهاية كل وحدة (كما في كتاب الطالب).
// البيانات في site/data/cando.json (مصدرها site/data/cando_src/*.txt ← tools/build_cando.py)،
// وتصل للصفحة في window.CANDO. لكل مادة صفوف، ولكل صف وحدات، ولكل وحدة صفوف الجدول.
(function(){
'use strict';
guard();
var CD=window.CANDO||{};
var SUBJ_ORDER=['العلوم','الأحياء','الكيمياء','الفيزياء','العلوم البيئية'];
var SUBJ_ICON={'العلوم':'🔬','الأحياء':'🧬','الكيمياء':'⚗️','الفيزياء':'🧲','العلوم البيئية':'🌍'};
var GN={'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
var COLS=['أحتاج إلى بذل المزيد من الجهد','متمكّن إلى حدٍّ ما','مستعدّ للمضيّ قدمًا'];
var UNIT_ORD=['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة','التاسعة','العاشرة','الحادية عشرة','الثانية عشرة'];
var IN_APP_=typeof IN_APP!=='undefined'&&IN_APP,MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function track(type,detail,title){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,detail:detail||'',title:title||''})});}catch(e){}}
function arDig(s){return String(s).replace(/[0-9]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'[d];});}
// رقم الموضوع كما في الكتاب: «١-٢» يُقرأ من اليمين (الوحدة ثم الدرس)
function refHtml(r){return '<bdo dir="rtl">'+esc(arDig(r))+'</bdo>';}
function unitTitle(u){var n=parseInt(u.u,10);return 'الوحدة '+(UNIT_ORD[n-1]||arDig(u.u))+': '+u.name;}
function subjects(){var s={};Object.keys(CD).forEach(function(k){s[CD[k].subject]=1;});return Object.keys(s).sort(function(a,b){var x=SUBJ_ORDER.indexOf(a),y=SUBJ_ORDER.indexOf(b);return (x<0?99:x)-(y<0?99:y);});}
function gradesOf(s){return Object.keys(CD).filter(function(k){return CD[k].subject===s;}).sort(function(a,b){return (GN[CD[a].grade]||0)-(GN[CD[b].grade]||0);});}
function gradeRange(s){var g=gradesOf(s).map(function(k){return GN[CD[k].grade];});if(!g.length)return '';var a=Math.min.apply(null,g),b=Math.max.apply(null,g);return a===b?'الصف '+a:'الصفوف '+a+'–'+b;}

var subj=lsGet('cando_subject'),cur=null,openG={},marks={};
try{var _c=JSON.parse(lsGet('cando_cur')||'null');if(_c&&CD[_c.k])cur=_c;}catch(e){}

function renderTree(){
  var ss=subjects(),tree=$('tree');
  if(ss.indexOf(subj)<0)subj=cur&&CD[cur.k]?CD[cur.k].subject:ss[0];
  var h='<label class="subj-pick"><span class="subj-ic" aria-hidden="true">'+(SUBJ_ICON[subj]||'📘')+'</span><span class="subj-l">المادة</span><select id="subjSel" aria-label="اختر المادة">'+
    ss.map(function(x){return '<option value="'+esc(x)+'"'+(x===subj?' selected':'')+'>'+esc(x)+' · '+esc(gradeRange(x))+'</option>';}).join('')+'</select></label>'+
    '<h2 class="tree-h">'+(SUBJ_ICON[subj]||'')+' '+esc(subj)+'</h2>';
  tree.innerHTML=h;
  $('subjSel').onchange=function(){subj=this.value;lsSet('cando_subject',subj);renderTree();};
  gradesOf(subj).forEach(function(k){
    var C=CD[k],n=C.units.reduce(function(a,u){return a+u.rows.length;},0);
    var gDiv=document.createElement('div');gDiv.className='g-block';
    var gBtn=document.createElement('button');gBtn.type='button';gBtn.className='g-btn';
    gBtn.innerHTML='<span class="g-name">الصف '+esc(C.grade)+'</span><span class="g-meta">'+C.units.length+' وحدات <span class="chev">▾</span></span>';
    var gBody=document.createElement('div');gBody.className='g-body';
    if(openG[k]||(cur&&cur.k===k))gBody.classList.add('open');
    C.units.forEach(function(u,i){
      var b=document.createElement('button');b.type='button';b.className='u-btn cd-u'+(cur&&cur.k===k&&cur.i===i?' active':'');
      b.innerHTML='<span class="u-num">'+esc(u.u)+'</span><span class="u-name">'+esc(u.name)+'</span><span class="u-badge">'+u.rows.length+'</span>';
      b.title='عرض قائمة التقييم الذاتي للوحدة';
      b.onclick=function(){cur={k:k,i:i};lsSet('cando_cur',JSON.stringify(cur));renderTree();show();if(window.innerWidth<900){var p=$('panel');if(p&&p.scrollIntoView)p.scrollIntoView({behavior:'smooth',block:'start'});}};
      gBody.appendChild(b);
    });
    var all=document.createElement('button');all.type='button';all.className='cd-all';all.textContent='🖨 طباعة كل وحدات الصف ('+n+' هدفًا)';
    all.onclick=function(){printUnits(k,C.units.map(function(_,i){return i;}));};
    gBody.appendChild(all);
    gBtn.onclick=function(){openG[k]=!gBody.classList.contains('open');gBody.classList.toggle('open');};
    gDiv.appendChild(gBtn);gDiv.appendChild(gBody);tree.appendChild(gDiv);
  });
}

// ===== ورقة «أستطيع أن» بتصميم المنصة (لا تصميم الكتاب) =====
// الترويسة: شعار المنصة + شعار وزارة التعليم + شعار رؤية عُمان 2040 + المديرية + المدرسة + «مبادرة أستطيع أن».
// التنسيق كله مضمَّن (inline) لتبقى الورقة كما هي في الطباعة وPDF وWord وصفحة التصدير على الجوال.
var INK='#0b3b33',INK2='#1f8a70',GOLD='#e0a93b',PAPER='#fbfaf6',LINE='#c9d8d2';
var RATE=[{t:'أحتاج إلى بذل المزيد من الجهد',bg:'#fdecec',fg:'#b42318',dot:'#e5484d'},{t:'متمكّن إلى حدٍّ ما',bg:'#fff4dc',fg:'#9a6700',dot:'#f5a524'},{t:'مستعدّ للمضيّ قدمًا',bg:'#e5f6ec',fg:'#11703c',dot:'#22a35a'}];
var PCA='-webkit-print-color-adjust:exact;print-color-adjust:exact;';
// شعار المنصة من ترويسة الصفحة نفسها (خبير)
function brandEls(){var b=document.querySelector('.kb-banner');if(!b)return {svgs:[],name:'خبير'};
  var tq=b.querySelector('.tq-logo');if(tq)return {svgs:[].slice.call(tq.querySelectorAll('svg')),name:''};
  var s=b.querySelector('.kb-mark svg');return {svgs:s?[s]:[],name:'خبير'};}
function svgMarkup(el,h){var c=el.cloneNode(true);c.removeAttribute('class');c.setAttribute('xmlns','http://www.w3.org/2000/svg');c.setAttribute('height',h);c.style.cssText='height:'+h+'px;width:auto;vertical-align:middle';return c.outerHTML;}
// للمعاينة والطباعة: الصور برابطها والشعار SVG مضمَّن. لملف Word: كلها صور PNG (Word لا يعرض SVG)
var ASSETS_WORD=null;
function liveAssets(){var be=brandEls();return {moe:'/brand/moe.png',vis:'/brand/vision.png',logo:be.svgs.map(function(s){return svgMarkup(s,46);}).join(''),name:be.name};}
function toDataUrl(src){return fetch(src).then(function(r){return r.blob();}).then(function(b){return new Promise(function(res){var fr=new FileReader();fr.onload=function(){res(fr.result);};fr.readAsDataURL(b);});});}
function svgToPng(el,h){return new Promise(function(res){var c=el.cloneNode(true);c.setAttribute('xmlns','http://www.w3.org/2000/svg');var vb=(c.getAttribute('viewBox')||'0 0 100 100').split(/[\s,]+/).map(Number),w=Math.round(h*vb[2]/vb[3]);c.setAttribute('width',w*3);c.setAttribute('height',h*3);
  var img=new Image();img.onload=function(){var cv=document.createElement('canvas');cv.width=w*3;cv.height=h*3;cv.getContext('2d').drawImage(img,0,0,w*3,h*3);res('<img src="'+cv.toDataURL('image/png')+'" width="'+w+'" height="'+h+'" style="vertical-align:middle">');};
  img.onerror=function(){res('');};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(c));});}
function wordAssets(){
  if(ASSETS_WORD)return Promise.resolve(ASSETS_WORD);
  var be=brandEls();
  return Promise.all([toDataUrl('/brand/moe.png'),toDataUrl('/brand/vision.png'),Promise.resolve([])]).then(function(r){
    ASSETS_WORD={moe:r[0],vis:r[1],logo:r[2].join(' '),name:be.name,word:true};return ASSETS_WORD;
  },function(){var a=liveAssets();a.logo='';return a;});
}
function sheetHeader(A,C,live){
  // نفس ترويسة الأوراق الرسمية في المنصة (الشعار يمينًا · العنوان وسطًا · رؤية 2040 يسارًا)
  var H=schoolHdr();
  return OFFICIAL_HEAD({dir:H.dir,school:H.school,title:'قائمة التقييم الذاتي «أستطيع أن…»',line2:'الفصل الدراسي: '+H.term+' - العام الدراسي: '+H.year+'م',
    student:'اسم الطالب: ................................ &nbsp; الصف / الشعبة: ........',word:!!A.word,moeSrc:A.moe,visSrc:A.vis});
}
function sheetHtml(k,i,opts){
  opts=opts||{};var C=CD[k],u=C.units[i],live=!!opts.live,A=opts.assets||liveAssets();
  var fs=function(pt,rem){return live?rem+'rem':pt+'pt';};
  var th='border:1px solid '+INK+';padding:7px 6px;font-weight:800;text-align:center;vertical-align:middle;font-size:'+fs(10.5,.82)+';line-height:1.35;'+PCA;
  var td='border:1px solid '+LINE+';padding:5px 9px;vertical-align:middle;color:#10261f;line-height:1.6;font-size:'+fs(11.5,.97)+';'+PCA;
  var h='<div class="cd-sheet" style="direction:rtl;font-family:inherit;color:#10261f">'+sheetHeader(A,C,live)+
    '<table style="width:100%;border-collapse:collapse;margin:6px 0"><tr>'+
      '<td style="border:0;padding:0"><span style="'+PCA+'display:inline-block;background:#e3f1eb;color:'+INK+';border:1px solid #b9d9cc;border-radius:999px;padding:3px 14px;font-weight:800;font-size:'+fs(12.5,.98)+'">'+esc(C.subject)+' · الصف '+esc(C.grade)+' · '+esc(unitTitle(u))+'</span></td></tr></table>'+
    '<div style="font-size:'+fs(11,.86)+';color:#3d554e;margin:2px 0 6px">بعد دراسة الوحدة، ضع علامة <b>✓</b> في الخانة التي تعبّر عن مستواك في كل هدف:</div>'+
    '<table class="cd-t" style="width:100%;border-collapse:collapse;table-layout:fixed;border:1.5px solid '+INK+'">'+
    '<colgroup><col style="width:'+(live?'45%':'47%')+'"><col style="width:'+(live?'10%':'9%')+'"><col><col><col></colgroup>'+
    '<thead><tr><th style="'+th+'background:'+INK+';color:#fff">أستطيع أن…</th><th style="'+th+'background:'+INK+';color:#fff">أراجع الموضوع</th>'+
      RATE.map(function(r){return '<th style="'+th+'background:'+r.bg+';color:'+r.fg+'"><span style="'+PCA+'display:inline-block;width:10px;height:10px;border-radius:50%;background:'+r.dot+';margin-inline-end:4px;vertical-align:middle"></span>'+esc(r.t)+'</th>';}).join('')+'</tr></thead><tbody>';
  u.rows.forEach(function(r,ri){
    var mk=marks[k+'|'+i+'|'+ri],z=ri%2?PAPER:'#ffffff';
    h+='<tr style="page-break-inside:avoid"><td style="'+td+'background:'+z+'"><span style="color:'+GOLD+';font-weight:900;margin-inline-end:4px">'+(ri+1)+'.</span>'+esc(r.t)+(r.b&&r.b.length?'<ul style="margin:4px 0 0;padding-inline-start:22px">'+r.b.map(function(b){return '<li>'+esc(b)+'</li>';}).join('')+'</ul>':'')+'</td>'+
      '<td style="'+td+'background:'+z+';text-align:center;white-space:nowrap"><span style="'+PCA+'display:inline-block;background:#e3f1eb;color:'+INK+';border-radius:8px;padding:1px 8px;font-weight:800">'+refHtml(r.r)+'</span></td>'+
      RATE.map(function(c,ci){var on=live&&mk===ci;return '<td style="'+td+'background:'+(on?c.bg:z)+';text-align:center;font-size:'+fs(16,1.35)+';color:'+c.fg+';font-weight:900"'+(live?' class="cd-c'+(on?' on':'')+'" data-r="'+ri+'" data-c="'+ci+'" role="button" tabindex="0" aria-label="'+esc(c.t)+'"':'')+'>'+(on?'✓':'')+'</td>';}).join('')+'</tr>';
  });
  h+='</tbody></table>'+
    '<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:'+fs(10.5,.82)+';color:#3d554e"><tr>'+
    '<td style="border:0;padding:0;white-space:nowrap"><b style="color:'+INK+'">ملاحظات المعلم:</b> <span style="color:#7a8f88;letter-spacing:1px">'+new Array(46).join('.')+'</span></td>'+
    '<td style="border:0;padding:0;text-align:left;width:32%;white-space:nowrap"><b style="color:'+INK+'">توقيع ولي الأمر:</b> <span style="color:#7a8f88;letter-spacing:1px">'+new Array(18).join('.')+'</span></td></tr></table>'+
    '<div style="'+PCA+'margin-top:10px;border-top:2px solid '+GOLD+';padding-top:4px;text-align:center;font-size:'+fs(9,.72)+';color:#5b6d67">مبادرة «أستطيع أن»</div></div>';
  return h;
}
function show(){
  var p=$('panel');
  if(!cur||!CD[cur.k]){
    p.innerHTML='<div class="welcome cd-welcome"><div class="cd-big">✓</div><h2>أستطيع أن…</h2><p>قوائم «التقييم الذاتي» في نهاية كل وحدة من كتاب الطالب، للفصل الدراسي الأول.</p><p class="muted">اختر المادة، ثم افتح الصف واضغط على الوحدة.</p></div>';
    return;
  }
  var C=CD[cur.k],u=C.units[cur.i];
  p.innerHTML='<div class="cd-head"><div><div class="cd-crumb">'+esc(C.subject)+' · الصف '+esc(C.grade)+' · الفصل الدراسي الأول</div><h2>'+esc(unitTitle(u))+'</h2></div>'+
    '<div class="cd-tools"><button type="button" class="btn primary small" id="cdPrint">🖨 طباعة / PDF</button><button type="button" class="btn small" id="cdWord">⬇ Word</button><button type="button" class="btn small" id="cdCopy">📋 نسخ الجدول</button><button type="button" class="btn small" id="cdClear" title="مسح علامات ✓ من الجدول">مسح العلامات</button></div></div>'+
    '<p class="cd-hint">💡 اضغط على أي خانة لوضع ✓ (مفيد عند عرض الجدول على السبورة). الطباعة تخرج الجدول فارغًا ليكمله الطالب.</p>'+
    '<div class="cd-wrap">'+sheetHtml(cur.k,cur.i,{live:true})+'</div>'+
    '<div class="cd-nav">'+(cur.i>0?'<button type="button" class="btn small" id="cdPrev">→ الوحدة السابقة</button>':'<span></span>')+(cur.i<C.units.length-1?'<button type="button" class="btn small" id="cdNext">الوحدة التالية ←</button>':'')+'</div>';
  Array.prototype.forEach.call(p.querySelectorAll('.cd-c'),function(c){
    var tog=function(){var key=cur.k+'|'+cur.i+'|'+c.getAttribute('data-r'),ci=+c.getAttribute('data-c');if(marks[key]===ci)delete marks[key];else marks[key]=ci;show();};
    c.onclick=tog;c.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();tog();}};
  });
  $('cdPrint').onclick=function(){printUnits(cur.k,[cur.i]);};
  $('cdWord').onclick=function(){wordUnits(cur.k,[cur.i]);};
  $('cdCopy').onclick=copySheet;
  $('cdClear').onclick=function(){Object.keys(marks).forEach(function(m){if(m.indexOf(cur.k+'|'+cur.i+'|')===0)delete marks[m];});show();};
  if($('cdPrev'))$('cdPrev').onclick=function(){cur.i--;lsSet('cando_cur',JSON.stringify(cur));renderTree();show();};
  if($('cdNext'))$('cdNext').onclick=function(){cur.i++;lsSet('cando_cur',JSON.stringify(cur));renderTree();show();};
}
function fname(k,ids){var C=CD[k];return ('أستطيع أن - '+C.subject+' - الصف '+C.grade+(ids.length===1?' - الوحدة '+C.units[ids[0]].u:'')).replace(/[\\/:*?"<>|]+/g,'-');}
function pagesHtml(k,ids,cls){return ids.map(function(i){return '<div class="'+cls+'">'+sheetHtml(k,i)+'</div>';}).join('');}
function serverFile(format,html,win,name){
  toast('جارٍ التجهيز…');
  return api('/api/export',{format:format,name:name||'أستطيع أن',html:html}).then(function(r){
    if(win){try{win.location.href=r.url;return;}catch(e){}}
    var a=document.createElement('a');a.href=r.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);
  },function(e){if(win)try{win.close();}catch(x){}toast(e.message);});
}
// طباعة محلية بلا ترويسة الموقع العامة (الورقة فيها شعاراتها)، بهوامش تتكرر في كل صفحة
function printLocal(html,name){
  var a=$('printArea'),t=document.title;document.title=String(name||t).slice(0,100);
  a.innerHTML='<table class="prw"><thead><tr><td><div class="prsp"></div></td></tr></thead><tfoot><tr><td><div class="prsp"></div></td></tr></tfoot><tbody><tr><td>'+html+'</td></tr></tbody></table>';
  document.body.classList.add('printing');
  setTimeout(function(){window.print();setTimeout(function(){document.body.classList.remove('printing');a.innerHTML='';document.title=t;},800);},120);
}
function printUnits(k,ids){
  track('cando_print',CD[k].subject+'|'+CD[k].grade+'|'+ids.length,fname(k,ids));
  if(!IN_APP_&&!MOBILE){printLocal(pagesHtml(k,ids,'ppage'),fname(k,ids));return;}
  var w=null;if(!IN_APP_){try{w=window.open('','_blank');}catch(e){w=null;}}
  serverFile('print',pagesHtml(k,ids,'pg'),w,fname(k,ids)).then(function(){if(IN_APP_)toast('تُفتح صفحة الطباعة في المتصفح… اختر «حفظ PDF» أو الطابعة');});
}
function wordUnits(k,ids){
  track('cando_word',CD[k].subject+'|'+CD[k].grade,fname(k,ids));toast('جارٍ التجهيز…');
  wordAssets().then(function(A){
  var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(fname(k,ids))+'</title>'+
    '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->'+
    '<style>@page WordSection1{size:595.3pt 841.9pt;margin:24pt 26pt 24pt 26pt}div.WordSection1{page:WordSection1}body{font-family:"Simplified Arabic","Traditional Arabic",Arial;font-size:12.5pt}</style></head>'+
    '<body dir="rtl"><div class="WordSection1">'+ids.map(function(i){return sheetHtml(k,i,{assets:A});}).join('<br clear="all" style="page-break-before:always">')+'</div></body></html>';
  serverFile('doc',html,null,fname(k,ids)).then(function(){toast(IN_APP_?'يُحمَّل ملف Word عبر المتصفح، ستجده في «التنزيلات»':'تم تحميل ملف Word');});
  });
}
function copySheet(){
  var C=CD[cur.k],u=C.units[cur.i],html=sheetHtml(cur.k,cur.i);
  var txt=unitTitle(u)+'\nقائمة تقييم ذاتي\nأستطيع أن\tأراجع الموضوع\t'+COLS.join('\t')+'\n'+u.rows.map(function(r){return r.t+(r.b?' '+r.b.map(function(b){return '• '+b;}).join(' '):'')+'\t'+r.r;}).join('\n');
  var done=function(){toast('تم نسخ الجدول — الصقه في Word أو نور');track('cando_copy',C.subject+'|'+C.grade+'|'+u.u,unitTitle(u));};
  try{
    if(navigator.clipboard&&window.ClipboardItem){
      navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([txt],{type:'text/plain'})})]).then(done,function(){fallback();});
      return;
    }
  }catch(e){}
  fallback();
  function fallback(){
    var d=document.createElement('div');d.contentEditable='true';d.style.cssText='position:fixed;left:-9999px;top:0';d.innerHTML=html;document.body.appendChild(d);
    var r=document.createRange();r.selectNodeContents(d);var s=getSelection();s.removeAllRanges();s.addRange(r);
    var ok=false;try{ok=document.execCommand('copy');}catch(e){}
    s.removeAllRanges();d.remove();if(ok)done();else toast('تعذّر النسخ، استخدم «Word» بدلًا منه');
  }
}
renderTree();show();
})();
