function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
var toastTimer=null;
function toast(msg){var t=$('toast');if(!t)return;t.textContent=msg||'تم';t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove('on');},1800);}
// رمز الجلسة الاحتياطي: بعض المتصفحات (متصفح واتساب/إنستقرام المدمج، أو إعداد
// «حجب كوكيز الطرف الأول») ترفض كوكي الجلسة، فيعود المعلم لصفحة الدخول بعد كل
// محاولة ويُسجَّل جهاز جديد كل مرة. فصار الخادم يرسل الرمز في جسم الاستجابة
// أيضًا، ويُحفظ هنا ويُرسَل في ترويسة — فتعمل الجلسة بلا كوكيز.
var SID_KEY='tahdir_sid_v1',DID_KEY='tahdir_did_v1';
function didGet(){try{return localStorage.getItem(DID_KEY)||'';}catch(e){return '';}}
function didSet(v){try{if(v)localStorage.setItem(DID_KEY,v);else localStorage.removeItem(DID_KEY);}catch(e){}}
function sidGet(){try{return localStorage.getItem(SID_KEY)||'';}catch(e){return '';}}
function sidSet(v){try{if(v)localStorage.setItem(SID_KEY,v);else localStorage.removeItem(SID_KEY);}catch(e){}}
function api(path,data,method){
  var o={method:method||(data?'POST':'GET'),credentials:'same-origin',headers:{}};
  if(data){o.headers['Content-Type']='application/json';o.body=JSON.stringify(data);}
  var sid=sidGet(),did=didGet();
  if(path!=='/api/login'){if(sid)o.headers['X-Tahdir-Sid']=sid;if(did)o.headers['X-Tahdir-Did']=did;}
  else if(did){o.headers['X-Tahdir-Did']=did;}
  return fetch(path,o).then(function(r){
    if(r.status===401&&path!=='/api/login'){
      // الرمز الاحتياطي لم يعد صالحًا: نمسحه ونعيد للدخول
      sidSet('');
      location.href='/';return Promise.reject(new Error('انتهت الجلسة'));
    }
    return r.json().catch(function(){return {};}).then(function(j){
      if(!r.ok)throw new Error(j.error||'حدث خطأ');
      if(j&&j.sid)sidSet(j.sid);
      if(j&&j.did)didSet(j.did);
      return j;
    });
  });
}
function copyText(text){
  function fallback(){
    var ta=document.createElement('textarea');ta.value=text||'';ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}
    ta.remove();toast(ok?'تم النسخ':'تعذّر النسخ، حدّد النص وانسخه يدويًا');
  }
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text||'').then(function(){toast('تم النسخ');},fallback);}else fallback();}catch(e){fallback();}
}
var DIALOG=null; // النافذة المفتوحة حاليًا: نستطيع إغلاقها برمجيًا فيصل الوعد ولا يتسرّب مستمع لوحة المفاتيح
function closeDialog(v){
  if(!DIALOG)return false;
  var d=DIALOG;DIALOG=null;
  d.close(v);
  return true;
}
function dialog(opts){
  return new Promise(function(resolve){
    var ov=$('modal'),box=$('modalBox');
    if(ov.classList.contains('locked')){resolve(null);return;}
    if(DIALOG)closeDialog(null); // لا نترك نافذة سابقة معلّقة
    var h='<h3 id="mTitle">'+esc(opts.title)+'</h3>';
    if(opts.message)h+='<p class="m-msg">'+esc(opts.message)+'</p>';
    if(opts.html)h+=opts.html;
    if(opts.input)h+='<input id="mInput" class="m-input" value="'+esc(opts.value||'')+'" placeholder="'+esc(opts.placeholder||'')+'">';
    if(opts.textarea)h+='<textarea id="mText" class="m-text'+(opts.ltr?' ltr':'')+'"'+(opts.readonly?' readonly':'')+' placeholder="'+esc(opts.placeholder||'')+'">'+esc(opts.value||'')+'</textarea>';
    h+='<div class="m-actions">';
    // opts.left: زر إضافي في أقصى يسار صف الأزرار (نهاية السطر في RTL) — لعمليات ثانوية مثل «مسح الأداة»
    if(opts.left)h+='<button type="button" class="btn '+(opts.left.danger?'danger':'')+'" id="mLeft" style="margin-inline-start:auto">'+esc(opts.left.text)+'</button>';
    if(opts.cancelText!==false)h+='<button type="button" class="btn" id="mCancel">'+esc(opts.cancelText||'إلغاء')+'</button>';
    h+='<button type="button" class="btn '+(opts.danger?'danger-solid':'primary')+'" id="mOk">'+esc(opts.okText||'موافق')+'</button></div>';
    box.innerHTML=h;ov.hidden=false;
    if(opts.wide)box.classList.add('wide');else box.classList.remove('wide');
    var inp=$('mInput')||$('mText');if(inp&&!opts.readonly)setTimeout(function(){inp.focus();},30);
    var settled=false;
    function close(v){
      if(settled)return;settled=true;
      // opts.extra نُقرأ قبل مسح النافذة، ويستبدل القيمة المرجعة (مفيد لعناصر تُبنى داخل html)
      if(opts.extra){var ex=opts.extra(box);if(ex!==undefined)v=ex;}
      ov.hidden=true;box.innerHTML='';document.removeEventListener('keydown',onKey);ov.onclick=null;
      if(DIALOG&&DIALOG.close===close)DIALOG=null;
      resolve(v);
    }
    // opts.group: نجمع قيم العناصر المختارة بهذا الاسم (اختيار متعدد أو راديو) ونُرجعها مصفوفة
    // opts.extra: دالة تُقرأ قبل إغلاق النافذة، ويُدمج ناتجها (كائن) مع قيمة الحقل
    function val(){if($('mInput'))return $('mInput').value;if($('mText'))return $('mText').value;if(opts.group)return Array.prototype.map.call(box.querySelectorAll('[name="'+opts.group+'"]:checked'),function(x){return x.value;});return true;}
    function onKey(e){if(e.key==='Escape')close(null);if(e.key==='Enter'&&$('mInput')&&document.activeElement===$('mInput'))close(val());}
    DIALOG={close:close,settle:function(){settled=true;}};
    document.addEventListener('keydown',onKey);
    if($('mCancel'))$('mCancel').onclick=function(){close(null);};
    if($('mLeft'))$('mLeft').onclick=function(){close(null);if(opts.left&&opts.left.onClick)opts.left.onClick();};
    $('mOk').onclick=function(){close(val());};
    ov.onclick=function(e){if(e.target===ov)close(null);};
  });
}
function guard(){
  document.addEventListener('contextmenu',function(e){var t=e.target;if(!(t&&(t.tagName==='TEXTAREA'||t.tagName==='INPUT')))e.preventDefault();});
  document.addEventListener('keydown',function(e){
    var k=(e.key||'').toLowerCase(),c=e.ctrlKey||e.metaKey;
    if(k==='f12'||(c&&k==='u')||(c&&k==='s')||(c&&e.shiftKey&&(k==='i'||k==='j'||k==='c'))){e.preventDefault();e.stopPropagation();}
  },true);
  document.addEventListener('dragstart',function(e){e.preventDefault();});
}
function logout(){api('/api/logout',{}).then(function(){sidSet('');didSet('');location.href='/';},function(){sidSet('');didSet('');location.href='/';});}
function fmtDate(t){if(!t)return '—';var d=new Date(t);return d.toLocaleDateString('ar-OM',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('ar-OM',{hour:'2-digit',minute:'2-digit'});}
function ago(t){if(!t)return 'لم يدخل بعد';var s=(Date.now()-t)/1000;if(s<60)return 'الآن';if(s<3600)return 'منذ '+Math.floor(s/60)+' دقيقة';if(s<86400)return 'منذ '+Math.floor(s/3600)+' ساعة';var d=Math.floor(s/86400);return d===1?'أمس':'منذ '+d+' يوم';}
// ---------- أداة نور (مشتركة لكل الصفحات) ----------
var TOOL_URL='/tool/tahdir-noor.user.js',TOOL_LATEST='__TOOLVER__',TOOL_FORCE='__TOOLFORCE__',IN_APP=/TahdirApp/.test(navigator.userAgent),APK_URL='/download/khabeer.apk';
function verCmp(a,b){a=String(a||'').split('.');b=String(b||'').split('.');for(var i=0;i<3;i++){var d=(parseInt(a[i],10)||0)-(parseInt(b[i],10)||0);if(d)return d;}return 0;}
function toolVersion(){return document.documentElement.getAttribute('data-tahdir-tool')||'';}
// إضافة المتصفح الرسمية: مسار تجريبي غير مفعّل. عند تعبئة الروابط يعمل تلقائيًا،
// وبدونها المسار الوحيد هو Tampermonkey (أبسط للمعلم: إضافة + سكربت وخلاص).
// ضع رابط صفحة الإضافة في كل متجر بعد نشرها؛ يظهر عندها «مرشد التثبيت» (ضغطتان) بدل Tampermonkey.
// إيدج: منشورة رسميًا في Microsoft Edge Add-ons — التثبيت من المتجر بضغطتين.
// فايرفوكس: النسخة المدرِجة (Listed) اعتمدتها موزيلا (٢٠٢٦-١٠-٢٤) — التثبيت الآن من صفحة
// الإضافة الرسمية على AMO بضغطتين، والتحديث يصل تلقائيًا من المتجر مع كل إصدار جديد
// بلا تغيير أي رابط. النسخة Unlisted الموقَّعة (noor-tool-unlisted@elkabsula.site ·
// تسجيل 3104946) تبقى مسارًا احتياطيًا: لو احتجناها نعيد رابط ملف .xpi الموقَّع هنا.
var EXT_STORE={chrome:'',edge:'https://microsoftedge.microsoft.com/addons/detail/%D8%A7%D9%84%D9%83%D8%A8%D8%B3%D9%88%D9%84%D8%A9-%E2%80%94-%D8%A3%D8%AF%D8%A7%D8%A9-%D9%86%D9%88%D8%B1/jbpbibeppdfddjlhkeobfkbccbjcnjpd',firefox:'https://addons.mozilla.org/firefox/addon/%D8%A7%D9%84%D9%83%D8%A8%D8%B3%D9%88%D9%84%D8%A9-%D8%A3%D8%AF%D8%A7%D8%A9-%D9%86%D9%88%D8%B1/'};
// كروم وإيدج وفايرفوكس: إضافة «خبير» بنُسخ متاجر رسمية. سافاري والآيفون: Userscripts كما هي.
var EXT_ZIP='/download/khabeer-ext.zip';
function extBrowser(b){return b==='chrome'||b==='edge';}
// مرشد التثبيت يفحص الرابط: لو كان ملف .xpi موقَّعًا مباشرًا (مسار Unlisted الاحتياطي) يعرض
// خطوة «افتح رابط الأداة ← فايرفوكس يبدأ التثبيت»، ولو صفحة متجر يعرض بطاقة متجر عادية.
function isXpiUrl(u){return !!u&&u.indexOf('/downloads/file/')>=0&&/\.xpi(?:[?#].*)?$/.test(u);}
function extVersion(){return document.documentElement.getAttribute('data-tahdir-ext')||'';}
function hasExt(){return !!document.documentElement.getAttribute('data-tahdir-ext');}
function browserKind(){var u=navigator.userAgent;
     if(/Edg\//.test(u))return 'edge';
     if(/Firefox|FxiOS/.test(u))return 'firefox';
     if(/Chrome|CriOS/.test(u))return 'chrome';
     // سافاري: لا يحتوي Chrome/Edg/Firefox — نتحقق من Safari أو جهاز ماك
     if(/Safari/.test(u)||/Macintosh/.test(u))return 'safari';
     return '';}
function extUrl(){return EXT_STORE[browserKind()]||'';}
function toolOk(min){var v=toolVersion();return !!v&&verCmp(v,min||TOOL_FORCE)>=0;}
// مسار واحد بسيط: Tampermonkey فقط. الإضافة الرسمية تُذكر فقط لو فُعّلت روابطها.
var BROWSER_NAME={chrome:'Chrome',edge:'Edge',firefox:'Firefox',safari:'Safari'};
function tmStoreUrl(){var b=browserKind();
  if(b==='firefox')return 'https://addons.mozilla.org/ar/firefox/addon/tampermonkey/';
  if(b==='edge')return 'https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd';
  // سافاري: Tampermonkey من Mac App Store (مدفوعة رمزية) — نسخة «Legacy» لا تعمل على سافاري الحديث
  if(b==='safari')return 'https://apps.apple.com/app/tampermonkey/id1482490089';
  return 'https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo';}
function tmStoreName(){return (BROWSER_NAME[browserKind()]||'متصفحك');}
// روابط متجر كل متصفح (للتبويبات)
function tmStoreFor(b){
  if(b==='firefox')return 'https://addons.mozilla.org/ar/firefox/addon/tampermonkey/';
  if(b==='edge')return 'https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd';
  if(b==='safari')return 'https://apps.apple.com/app/tampermonkey/id1482490089';
  return 'https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo';}
// ---------- مرشد تثبيت الإضافة من المتجر (كروم · إيدج · فايرفوكس) ----------
// لا يستطيع أي موقع الرسم فوق صفحة المتجر أو نافذة «إضافة» (صفحات محمية)، فنعرض بدلها
// صورًا للشاشة القادمة بلغة متصفح المعلم وعليها مربع أحمر على الزر المطلوب:
//  • كروم/إيدج: داخل نافذة عائمة فوق كل النوافذ (Document Picture-in-Picture).
//  • فايرفوكس (لا يدعمها): يُفتح المتجر في نافذة جانبية ويبقى المرشد ظاهرًا في المنصة.
// بعد التثبيت تُعيد الإضافة نفسها المعلم إلى تبويب المنصة وتحدّثه (background.js) فتظهر «تم ✓».
var GUIDE_KEY='tahdir_ext_guide';
function guideLang(){var l=(navigator.languages&&navigator.languages[0])||navigator.language||'';return /^ar/i.test(l)?'ar':'en';}
var GUIDE_CSS='.xg{font-family:inherit;direction:rtl;color:#163;line-height:1.7}'+
  '.xg h4{margin:4px 0 10px;font-size:17px}.xg-st{display:flex;gap:10px;margin:0 0 14px}'+
  '.xg-n{flex:none;width:26px;height:26px;border-radius:50%;background:#0e7c66;color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px;margin-top:2px}'+
  '.xg-b{flex:1;min-width:0}.xg-t{font-size:14.5px;margin-bottom:6px}.xg-t b{background:#fff1f1;border-radius:5px;padding:0 4px}'+
  '.xg-scr{border:1px solid #cfd8d5;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.08);font-family:Segoe UI,Roboto,Arial,sans-serif}'+
  '.xg-bar{background:#eef1f3;padding:5px 8px;font-size:11px;color:#556;border-bottom:1px solid #dde3e6;display:flex;gap:6px;align-items:center}'+
  '.xg-bar i{width:7px;height:7px;border-radius:50%;background:#c9d0d4;display:inline-block}.xg-bar span{background:#fff;border-radius:9px;padding:1px 9px;flex:1;direction:ltr;text-align:left;overflow:hidden;white-space:nowrap}'+
  '.xg-body{padding:10px;display:flex;align-items:center;gap:9px}.xg-ic{width:38px;height:38px;border-radius:9px;flex:none;background:#0e7c66}'+
  '.xg-nm{flex:1;font-size:12.5px;font-weight:600;color:#222}.xg-nm small{display:block;font-weight:400;color:#777}'+
  '.xg-btn{position:relative;flex:none;background:#0b57d0;color:#fff;border-radius:18px;padding:6px 13px;font-size:12.5px;font-weight:600;white-space:nowrap}'+
  '.xg-btn.ghost{background:#fff;color:#0b57d0;border:1px solid #c7d2e0}'+
  '.xg-hl{outline:3px solid #e01e1e;outline-offset:3px;animation:xgp 1.1s ease-in-out infinite}'+
  '@keyframes xgp{50%{outline-offset:7px;outline-color:#ff6b6b}}'+
  '.xg-hl:after{content:"👆";position:absolute;bottom:-30px;left:50%;transform:translateX(-50%);font-size:22px;animation:xga .9s ease-in-out infinite}'+
  '@keyframes xga{50%{transform:translate(-50%,-6px)}}'+
  '.xg-dlg{padding:12px 12px 16px;font-size:12.5px;color:#222}.xg-dlg b{display:block;font-size:13px;margin-bottom:4px}.xg-dlg p{margin:0 0 10px;color:#666;font-size:11.5px}'+
  '.xg-acts{display:flex;gap:8px;justify-content:flex-end;padding-bottom:18px}'+
  '.xg-ok{background:#e9f7f1;border:1px solid #0e7c66;border-radius:10px;padding:9px 11px;font-size:14px}'+
  '.xg-drag{background:#fff6e0;border:1px solid #e5c26a;border-radius:8px;padding:6px 9px;font-size:12.5px;color:#7a5c00;margin:2px 0 10px}'+
  '.xg-go{display:block;text-align:center;background:#0e7c66;color:#fff;border-radius:10px;padding:10px;font-weight:700;text-decoration:none;margin:4px 0 12px}'+
  '.xg-float{position:fixed;z-index:9999;bottom:14px;left:14px;width:min(370px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;background:#fff;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.25);padding:14px}'+
  '.xg-x{position:absolute;top:8px;left:10px;border:0;background:none;font-size:20px;cursor:pointer;color:#567}';
function guideHtml(b,L,storeUrl){
  var EXT='خبير — أداة نور',ltr=L==='en';
  var T={chrome:{ar:['إضافة إلى Chrome','إضافة إضافة','إلغاء','هل تريد إضافة «'+EXT+'»؟'],en:['Add to Chrome','Add extension','Cancel','Add "'+EXT+'"?'],host:'chromewebstore.google.com'},
         edge:{ar:['الحصول على','إضافة ملحق','إلغاء','هل تريد إضافة «'+EXT+'» إلى Microsoft Edge؟'],en:['Get','Add extension','Cancel','Add "'+EXT+'" to Microsoft Edge?'],host:'microsoftedge.microsoft.com'},
         firefox:{ar:['إضافة إلى Firefox','إضافة','إلغاء','هل تريد إضافة «'+EXT+'»؟'],en:['Add to Firefox','Add','Cancel','Add '+EXT+'?'],host:'addons.mozilla.org'}}[b];
  var t=T[L],dir=' dir="'+(ltr?'ltr':'rtl')+'"';
  // نصّ المرشد نفسه يتبع لغة المتصفح أيضًا (لا الأزرار وحدها): من متصفحه إنجليزي يقرأ الإرشاد بالإنجليزية
  // ومنه عربي يقرأها بالعربية — حتى يطابق كل نصّ في المرشد ما يراه فعليًا على شاشته.
  var TX=ltr
    ?{title:'Install Nour Tool — just two clicks',
      drag:'Drag this window downward so it doesn\u2019t cover the store button \uD83D\uDC47',
      st1:'On the '+T.host+' page press the <b>\u00AB'+esc(t[0])+'\u00BB</b> button',
      st2:'A small popup appears at the top of the browser: press <b>\u00AB'+esc(t[1])+'\u00BB</b>',
      ok:'Done! The extension returns you to the platform automatically and you\u2019ll see the <b>\u201CNour Tool \u2713\u201D</b> button. No Tampermonkey, no settings.'}
    :{title:'تثبيت أداة نور — ضغطتان فقط',
      drag:'اسحب هذه النافذة إلى الأسفل حتى لا تغطي زر التثبيت في المتجر \uD83D\uDC47',
      st1:'في صفحة المتجر ('+T.host+') اضغط الزر <b>«'+esc(t[0])+'»</b>',
      st2:'تظهر نافذة صغيرة أعلى المتصفح: اضغط <b>«'+esc(t[1])+'»</b>',
      ok:'خلاص! الإضافة ترجعك للمنصة لوحدها، ويظهر الزر <b>«أداة نور ✓»</b>. لا Tampermonkey ولا إعدادات.'};
  // رابط .xpi موقَّع (فايرفوكس Unlisted): الضغط عليه يثبّت مباشرة — فنحوّل الخطوة الأولى
  // من «بطاقة متجر» إلى «افتح الرابط»، وتصبح لقطة الخطوة أولًا نافذة التأكيد نفسها.
  var isX=isXpiUrl(storeUrl||'');
  var step1=TX.st1,goLabel=(ltr?'Open the add-on page \u2197':'فتح صفحة الإضافة في المتجر \u2197');
  if(isX){step1=ltr?'Press <b>\u00ABOpen the tool link\u00BB</b> above \u2014 Firefox starts installing right away.':'اضغط <b>«فتح رابط الأداة»</b> أعلاه — فايرفوكس يبدأ التثبيت فورًا.';goLabel=ltr?'Open the tool link \u2197':'فتح رابط الأداة \u2197';}
  var ic='<span class="xg-ic" style="background:#0e7c66 url(/icon-512.png) center/cover"></span>';
  var s1='<div class="xg-scr"'+dir+'><div class="xg-bar"><i></i><i></i><span>'+T.host+'</span></div>'+
    '<div class="xg-body">'+ic+'<div class="xg-nm">'+EXT+'<small>khabeer.khabeer-bio.workers.dev</small></div><span class="xg-btn xg-hl">'+esc(t[0])+'</span></div></div>';
  var s2='<div class="xg-scr"'+dir+'><div class="xg-bar"><i></i><i></i><span>'+T.host+'</span></div>'+
    '<div class="xg-dlg"><b>'+esc(t[3])+'</b><p>'+(ltr?'It can: Read and change your data on lms.moe.gov.om and khabeer.khabeer-bio.workers.dev':'يمكنها قراءة بياناتك وتغييرها على lms.moe.gov.om و khabeer.khabeer-bio.workers.dev')+'</p>'+
    '<div class="xg-acts" style="justify-content:'+(ltr?'flex-end':'flex-start')+'"><span class="xg-btn xg-hl">'+esc(t[1])+'</span><span class="xg-btn ghost">'+esc(t[2])+'</span></div></div></div>';
  function st(n,txt,scr){return '<div class="xg-st"><span class="xg-n">'+n+'</span><div class="xg-b"><div class="xg-t">'+txt+'</div>'+(scr||'')+'</div></div>';}
  return '<div class="xg"><h4>'+TX.title+'</h4>'+
    '<div class="xg-drag">'+TX.drag+'</div>'+
    (storeUrl?'<a class="xg-go" href="'+esc(storeUrl)+'" target="_blank" rel="noopener">'+goLabel+'</a>':'')+
    st('1',step1,isX?'':s1)+
    st('2',TX.st2,s2)+
    st('3','<div class="xg-ok">'+TX.ok+'</div>')+
    '</div>';
}
function extGuide(reason){
  var b=browserKind(),L=guideLang(),eu=extUrl();
  var h=(reason?'<p class="m-msg">'+esc(reason)+'</p>':'')+'<style>'+GUIDE_CSS+'</style>'+guideHtml(b,L,'');
  // رابط .xpi مباشر: الزر الرئيسي يفتح الأداة لا «المتجر»
  var isX=isXpiUrl(eu||'');
  return dialog({title:'أداة نور',html:h,okText:isX?'ابدأ التثبيت':'افتح المتجر وابدأ',cancelText:'إغلاق'}).then(function(r){
    if(!r)return;
    try{sessionStorage.setItem(GUIDE_KEY,'1');}catch(e){}
    var pip=window.documentPictureInPicture;
    if(pip&&pip.requestWindow){
      // النافذة العائمة أولًا (تحتاج ضغطة المعلم)، ثم المتجر في تبويب جديد
      pip.requestWindow({width:390,height:640}).then(function(w){
        var d=w.document;d.title='أداة نور';d.documentElement.setAttribute('dir','rtl');d.documentElement.setAttribute('lang','ar');
        var stl=d.createElement('style');stl.textContent='body{margin:0;padding:14px;font-family:IBM Plex Sans Arabic,Segoe UI,Tahoma,Arial,sans-serif;background:#fff}'+GUIDE_CSS;d.head.appendChild(stl);
        d.body.innerHTML=guideHtml(b,L,eu);
        if(!window.open(eu,'_blank'))return; // لو حُجب: رابط المتجر داخل النافذة العائمة
      }).catch(function(){guideFloat(b,L,eu);window.open(eu,'_blank');});
    }else{
      // كل متصفح بلا PiP (فايرفوكس · سافاري · إصدارات أقدم): نفس التجربة بنافذة عائمة صغيرة
      // تُفتح بضغطة المعلم (فلا يحجبها مانع النوافذ)، تحمل المرشد نفسه وبه زر المتجر وزر
      // تحديث المنصة — تبقى أمام المعلم وهو يثبّت بدل أن يبقى المرشد مدفونًا في تبويب المنصة.
      var wg=null;
      try{wg=window.open('about:blank','tahdir_guide','width=390,height=660');}catch(e){}
      if(wg&&wg.document&&wg.document.body){
        try{
          var dg=wg.document;dg.title='أداة نور';dg.documentElement.setAttribute('dir','rtl');dg.documentElement.setAttribute('lang','ar');
          var stg=dg.createElement('style');stg.textContent='body{margin:0;padding:14px;font-family:IBM Plex Sans Arabic,Segoe UI,Tahoma,Arial,sans-serif;background:#fff}'+GUIDE_CSS;dg.head.appendChild(stg);
          dg.body.innerHTML=guideHtml(b,L,eu);
          var rg=dg.createElement('button');rg.type='button';rg.className='btn small';rg.style.cssText='width:100%;margin-top:10px';
          rg.textContent='ثبّتها؟ حدّث صفحة المنصة ↻';
          rg.onclick=function(){try{if(wg.opener)wg.opener.location.reload();}catch(e){}wg.close();};
          dg.body.appendChild(rg);wg.focus();
        }catch(e){try{wg.close();}catch(e2){}guideFloat(b,L,eu);window.open(eu,'_blank');}
      }else{
        // حُجبت النافذة العائمة: المرشد داخل صفحة المنصة + المتجر بنافذة جانبية (كالسابق)
        guideFloat(b,L,eu);
        var W=Math.min(980,Math.round(screen.availWidth*0.6)),H=Math.min(820,screen.availHeight-40);
        var w2=window.open(eu,'kabsula_store','popup,width='+W+',height='+H+',left='+(screen.availWidth-W)+',top=20');
        if(!w2)window.open(eu,'_blank');
      }
    }
  });
}
// لوحة المرشد داخل المنصة (فايرفوكس، أو عند تعذّر النافذة العائمة)
function guideFloat(b,L,eu){
  if($('xgFloat'))return;
  var p=document.createElement('div');p.id='xgFloat';p.className='xg-float';
  p.innerHTML='<style>'+GUIDE_CSS+'</style><button type="button" class="xg-x" aria-label="إغلاق">×</button>'+guideHtml(b,L,eu)+
    '<button type="button" class="btn small" id="xgReload" style="width:100%">ثبّتها؟ حدّث الصفحة ↻</button>';
  document.body.appendChild(p);
  p.querySelector('.xg-x').onclick=function(){p.remove();};
  $('xgReload').onclick=function(){location.reload();};
}
// بعد عودة المعلم (الإضافة حدّثت التبويب): تأكيد واحد بأن التثبيت تم
(function(){
  var g='';try{g=sessionStorage.getItem(GUIDE_KEY)||'';}catch(e){}
  if(!g)return;
  setTimeout(function(){
    if(!hasExt())return;
    try{sessionStorage.removeItem(GUIDE_KEY);}catch(e){}
    var f=$('xgFloat');if(f)f.remove();
    dialog({title:'تم تثبيت أداة نور ✓',message:'كل شيء جاهز: تقدر الآن ترسل التحضير والواجب إلى نور بضغطة. الإضافة تتحدّث تلقائيًا من المتجر.',okText:'تمام',cancelText:false});
  },1800);
})();
function toolDialog(reason){
  if(IN_APP)return dialog({title:'أداة نور',message:'أنت تستخدم تطبيق «خبير»، والأداة مدمجة فيه وتتحدث تلقائيًا. لا تحتاج تثبيت أي شيء.',okText:'تم',cancelText:false});
  var v=toolVersion(),ok=!!v,eu=extUrl();
  // الأداة تعمل (Tampermonkey أو الإضافة): لا نقترح شيئًا آخر — سكربت Tampermonkey يبقى كما هو.
  // وإلا، ولو للمتصفح إضافة منشورة في متجره: مرشد التثبيت (ضغطتان).
  if(!ok&&eu&&!hasExt())return extGuide(reason);
  if(ok){
    var pr=dialog({title:'أداة نور ✓',message:'الأداة مثبتة وتعمل (الإصدار '+v+'). تقدر ترسل التحضير والواجب إلى نور بضغطة.',okText:'تم',cancelText:false,
      // مسح الأداة: زر أحمر في أقصى يسار الرسالة — يفتح خطوات الإزالة بحسب المتصفح
      left:{text:'🗑 مسح الأداة',danger:true,onClick:toolRemove}});
    Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-copy]'),function(b){b.onclick=function(){copyText(b.getAttribute('data-copy'));};});
    return pr;
  }
  // التثبيت لأول مرة: تبويبات بحسب المتصفح (كروم · فايرفوكس · إيدج · ماك/سافاري)
  var cur=browserKind()||'chrome';
  var TABS=[['chrome','Chrome','🌐'],['firefox','Firefox','🦊'],['edge','Edge','🌊'],['safari','ماك / Safari','🧭'],['ios','iPhone','📱']];
  function stepsFor(b){
    if(b==='ios'){
      function step(n,title,rows,link){
        return '<div class="iosg-step"><span class="iosg-n">'+n+'</span><div class="iosg-b">'+
          '<div class="iosg-t">'+title+'</div>'+
          rows.map(function(r){
            return '<div class="iosg-row">'+r.map(function(x,i){
              var tap = /^@/.test(x);
              var txt = tap ? x.slice(1) : x;
              var el = '<span class="iosg-el'+(tap?' iosg-tap':'')+'">'+esc(txt)+'</span>';
              return (i ? '<span class="iosg-a">›</span>' : '') + el;
            }).join('')+'</div>';
          }).join('')+
          (link?'<div class="iosg-l"><a href="'+link+'" target="_blank" rel="noopener">افتحه الآن ←</a></div>':'')+
        '</div></div>';
      }
      return '<button type="button" class="btn primary" id="iosPlayBtn" style="width:100%;margin:2px 0 6px">🎬 عرض تفاعلي — ٤٠ ثانية</button>'+
      '<div class="iosg">'+
        step('١','ثبّت <b>Userscripts</b> — مجاني',[
          ['App Store','بحث','@Userscripts','احصل']
        ],'https://apps.apple.com/app/userscripts/id1463298887')+
        step('٢','فعّل الإضافة وامنح الإذن',[
          ['@الإعدادات','Safari','الإضافات'],
          ['iOS 26+: الإعدادات','@التطبيقات','Safari','الإضافات'],
          ['@Userscripts','شغّل المفتاح','الكل: سماح']
        ])+
        step('٣','ثبّت الأداة في سافاري',[
          ['سافاري','@aA','Userscripts'],
          ['@Install','تم']
        ])+
        '</div>'+
        '<p class="m-msg muted small" style="margin-top:8px">السهم الأخضر يشير إلى ما يجب الضغط عليه. الخطوات مرة واحدة فقط — بعدها تتحدّث الأداة تلقائيًا.</p>'+
        '<p class="m-msg" style="background:#fff6e0;border-radius:10px;padding:8px 11px"><b>⚠️ لو ظهرت الأداة كـ«كود نصّي» أو نزلت في «الملفات» بلا زر Install</b> — فمعناه أن <b>Userscripts غير مثبّت أو غير مفعّل</b>، وليس عيبًا في الأداة. أكمل الخطوتين ١ و٢.<br><span class="muted small">وإن نزل الملف فعلًا في «الملفات»: افتح Userscripts ← «Set Directory» ← اختر مجلد التنزيلات، ثم انقل <code>tahdir-noor.user.js</code> إليه.</span></p>';
    }
    if(b==='safari'){
      return '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
        '<li>ثبّت <b>Userscripts</b> — <b>مجاني</b>: <a href="https://apps.apple.com/app/userscripts/id1463298887" target="_blank" rel="noopener">افتح App Store</a> (macOS 12+ · سافاري 14.1+).<br><span class="muted small">أو <b>Tampermonkey</b> من Mac App Store (~$1.99) — <a href="'+tmStoreFor('safari')+'" target="_blank" rel="noopener">صفحة التطبيق</a>.</span></li>'+
        '<li><b>سافاري ← الإعدادات (⌘,) ← الإضافات</b> ← فعّل الإضافة.</li>'+
        '<li><b>الإعدادات ← المواقع الإلكترونية</b> ← اسمح بالوصول إلى <b>lms.moe.gov.om</b> و <b>هذا الموقع</b>.</li>'+
        '<li>ارجع واضغط <b>«تثبيت الأداة»</b>، وفي الصفحة التي تُفتح اضغط <b>«تثبيت»</b> ثم <b>Allow</b> إن سألك سافاري.</li></ol>'+
        '<p class="m-msg" style="background:#fff6e0;border-radius:10px;padding:8px 11px"><b>⚠️ تنبيه:</b> لا تستخدم <b>«Tampermonkey Legacy»</b> — فهي لسافاري 6–11 فقط ولن تُثبَّت على سافاري الحديث.</p>';
    }
    if(b==='edge'){
      // إيدج: إضافة «خبير — أداة نور» منشورة في متجر Edge — تثبيت بضغتين وتحديث تلقائي.
      // بدل Tampermonkey ووضع المطوّر؛ ولو مثبّتة قديمًا من ZIP تُستبعد بعد تثبيت نسخة المتجر.
      // الرابط صريح لا عبر extUrl() — فاللوحة قد تُعرض داخل تبويب إيدج لمستخدم متصفح آخر.
      var eu2='edge://extensions',euS=EXT_STORE.edge;
      return '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
        '<li>ثبّت إضافة <b>«خبير — أداة نور»</b> مباشرة من متجر Edge: <a href="'+esc(euS)+'" target="_blank" rel="noopener">افتح صفحة الإضافة في المتجر</a> ثم اضغط <b>«الحصول عليه / Get»</b> ووافق على <b>«إضافة ملحق»</b>.</li>'+
        '<li>خلاص — تتحدّث الإضافة تلقائيًا من المتجر: لا Tampermonkey ولا وضع مطوّر ولا ملفات.</li>'+
        '<li>ارجع للمنصة وحدّث الصفحة؛ الزر يتحول إلى <b>«أداة نور ✓»</b>.</li></ol>'+
        '<p class="m-msg" style="background:#fff6e0;border-radius:10px;padding:8px 11px"><b>💡 لو ثبّتها قديمًا من ملف ZIP (غير مجمّعة):</b> ثبّت نسخة المتجر أعلاه ثم افتح <code class="ltr" style="user-select:all">edge://extensions</code> واحذف بطاقة «خبير» القديمة حتى لا تعمل الأداة مرتين.</p>';
    }
    if(b==='chrome'){
      // كروم: Tampermonkey من المتجر + مفتاح واحد يسمح بالسكربتات (شرط جديد من جوجل منذ Chrome 138).
      // إضافة «خبير» غير المُجمّعة تبقى بديلًا متقدّمًا داخل «طريقة أخرى» (إيدج أُنتقلت إلى متجرها).
      var eu2='chrome://extensions';
      var tmId='dhdgffkkebhmkfjojejmpbldmpobfkfo',det=eu2+'/?id='+tmId;
      var step2='<li>اسمح لـ Tampermonkey بتشغيل السكربتات: <b>كليك يمين</b> على أيقونة Tampermonkey (أو 🧩 ← ⋮ بجانبه) ← <b>«إدارة الإضافة» Manage extension</b> ← فعّل مفتاح <b>«Allow User Scripts»</b>.<br><span class="muted small">أو انسخ <code class="ltr" style="user-select:all">'+det+'</code> <button type="button" class="btn small" data-copy="'+det+'">نسخ</button> والصقه في شريط العنوان. لو لم تجد المفتاح (كروم أقدم): فعّل <b>Developer mode</b> أعلى صفحة <span class="ltr">chrome://extensions</span>.</span></li>';
      return '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
        '<li>ثبّت <b>Tampermonkey</b> من متجر Chrome: <a href="'+tmStoreFor(b)+'" target="_blank" rel="noopener">افتح صفحة الإضافة</a> ثم اضغط «إضافة إلى Chrome».</li>'+
        step2+
        '<li>ارجع هنا، اضغط الزر الأخضر <b>«تثبيت الأداة»</b>، وفي الصفحة التي تُفتح اضغط <b>«تثبيت» Install</b>.</li></ol>'+
        '<p class="m-msg" style="background:#fff6e0;border-radius:10px;padding:8px 11px"><b>💡 لو ثبّت Tampermonkey قبل كده والأداة وقفت فجأة:</b> هي دي المشكلة — نفّذ الخطوة ٢ فقط وحدّث الصفحة.</p>'+
        '<details class="m-msg"><summary class="muted small" style="cursor:pointer">طريقة أخرى (متقدّمة): إضافة «خبير» بدون Tampermonkey</summary><ol style="line-height:2;padding-inline-start:1.2em;margin-top:6px">'+
        '<li><a class="btn small" href="'+EXT_ZIP+'" download>⬇ تحميل إضافة «خبير»</a> ثم <b>فُك الضغط</b> في مكان ثابت مثل «المستندات». <span class="muted small">لا تحذف المجلد بعد التثبيت.</span></li>'+
        '<li>افتح <code class="ltr" style="user-select:all">'+eu2+'</code> <button type="button" class="btn small" data-copy="'+eu2+'">نسخ</button> وفعّل <b>Developer mode</b>.</li>'+
        '<li>اضغط <b>Load unpacked</b> واختر المجلد الذي فككته، ثم حدّث هذه الصفحة.</li></ol>'+
        '<p class="muted small">لو الإضافة وTampermonkey الاثنين متثبّتين مش هيحصل تعارض: الأداة مش هتشتغل مرتين.</p></details>';
    }
    if(b==='firefox'){
      // فايرفوكس: الإضافة منشورة رسميًا (Listed) في موزيلا بعد اعتماد المراجعة — تثبيت بضغتين
      // وتحديث تلقائي من المتجر. الرابط صريح لا عبر extUrl() — فاللوحة قد تُعرض داخل تبويب
      // فايرفوكس لمستخدم متصفح آخر.
      var ffu=EXT_STORE.firefox;
      return '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
        '<li>ثبّت إضافة <b>«خبير — أداة نور»</b> مباشرة من موزيلا: <a href="'+esc(ffu)+'" target="_blank" rel="noopener">افتح صفحة الإضافة على Firefox Add-ons</a> ثم اضغط <b>«إضافة إلى Firefox»</b> ووافق على <b>«إضافة»</b>.</li>'+
        '<li>خلاص — تتحدّث الإضافة تلقائيًا من المتجر: لا Tampermonkey ولا ملفات ولا إعدادات.</li>'+
        '<li>ارجع للمنصة وحدّث الصفحة؛ الزر يتحول إلى <b>«أداة نور ✓»</b>.</li></ol>'+
        '<p class="m-msg" style="background:#fff6e0;border-radius:10px;padding:8px 11px"><b>💡 أداة قديمة بـ Tampermonkey؟</b> الإضافة تتعرّف عليها ومنعًا للتكرار لا تعمل الأداة مرتين. والأفضل بعدها مسح السكربت: زر <b>«🗑 مسح الأداة»</b> في حوار «أداة نور» يشرح خطوات المسح.</p>';
    }
    var nm=b==='firefox'?'Firefox':'Chrome';
    return '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
      '<li>ثبّت <b>Tampermonkey</b> من متجر '+nm+': <a href="'+tmStoreFor(b)+'" target="_blank" rel="noopener">افتح صفحة الإضافة</a> ثم اضغط «إضافة إلى '+nm+'».</li>'+
      '<li>ارجع هنا، اضغط الزر الأخضر <b>«تثبيت الأداة»</b>، وفي الصفحة التي تُفتح اضغط <b>«تثبيت»</b>.</li></ol>';
  }
  var tabbar='<div class="tt-tabs">'+TABS.map(function(t){
    return '<button type="button" class="tt-tab'+(t[0]===cur?' on':'')+'" data-tab="'+t[0]+'">'+t[2]+' '+esc(t[1])+'</button>';
  }).join('')+'</div>';
  var panes=TABS.map(function(t){
    return '<div class="tt-pane'+(t[0]===cur?' on':'')+'" data-pane="'+t[0]+'">'+stepsFor(t[0])+'</div>';
  }).join('');
  // على أندرويد: متصفحات الجوال لا تدعم إضافات السكربتات (Chrome · Samsung Internet)،
  // فملف .user.js يُحمَّل كنص ولا يظهر زر «تثبيت». الحل الأسهل هو التطبيق (الأداة مدمجة).
  var isAndroid=/Android/i.test(navigator.userAgent);
  var andNote=isAndroid
    ? '<div class="m-msg" style="background:var(--main-l,#e3f1eb);border:1px solid var(--main,#1f8a70);border-radius:12px;padding:11px 13px">'+
      '<b>📱 أنت على أندرويد — لا تحتاج تثبيت سكربت.</b><br>'+
      'تطبيق «خبير» فيه الأداة <b>مدمجة</b> ويعمل مباشرة: <a class="btn primary small" href="'+APK_URL+'" target="_blank" rel="noopener" style="margin-top:6px;display:inline-block">⬇ تحميل التطبيق</a>'+
      '<div class="muted small" style="margin-top:7px">متصفحات أندرويد (Chrome · Samsung Internet) <b>لا تدعم إضافات السكربتات</b>، ولهذا عند فتح رابط الأداة تظهر لك <b>كنص فقط</b> ولا يظهر «تثبيت». ولو أردت الأداة على الجوال: استخدم <b>Firefox للأندرويد</b> — وثبّت إضافة «خبير — أداة نور» من صفحتها على موزيلا (متوافقة مع فايرفوكس للأندرويد).</div></div>'
    : '';
  var h=(reason?'<p class="m-msg">'+esc(reason)+'</p>':'')+
   andNote+
   '<p class="m-msg">اختر متصفحك ثم اتبع الخطوات:</p>'+
   tabbar+panes+
   '<p class="m-msg muted small">هذا كل شيء — مرة واحدة للأبد. بعدها تتحدث الأداة تلقائيًا من الموقع.</p>'+
   '<p class="m-msg" style="border-top:1px solid #dfe9e5;padding-top:10px"><b>على الموبايل:</b><br>أندرويد: <a href="'+APK_URL+'" target="_blank" rel="noopener">حمّل تطبيق «خبير»</a> — الأداة مدمجة فيه.<br>آيفون: ثبّت <b>Userscripts</b> (مجاني) ثم افتح رابط الأداة واضغط Install.</p>';
  var sel=cur,okLabel=function(k){return 'تثبيت الأداة';};
  var pr=dialog({title:'تثبيت أداة نور',html:h,okText:okLabel(cur),cancelText:'إغلاق'});
  Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-copy]'),function(b){b.onclick=function(){copyText(b.getAttribute('data-copy'));};});
  // ربط التبويبات داخل النافذة (بعد إدراجها في DOM)
  Array.prototype.forEach.call(document.querySelectorAll('.tt-tab'),function(b){
    b.onclick=function(){
      var k=b.getAttribute('data-tab');sel=k;if($('mOk'))$('mOk').textContent=okLabel(k);
      Array.prototype.forEach.call(document.querySelectorAll('.tt-tab'),function(x){x.classList.toggle('on',x===b);});
      Array.prototype.forEach.call(document.querySelectorAll('.tt-pane'),function(x){x.classList.toggle('on',x.getAttribute('data-pane')===k);});
    };
  });
  // زر «العرض التفاعلي» في تبويب iPhone (دالة iosPlay معرفة لاحقًا — الربط برفعها ينجح)
  if($('iosPlayBtn'))$('iosPlayBtn').onclick=iosPlay;
  return pr.then(function(r){if(!r)return;window.open(TOOL_URL,'_blank');});
}
// ---------- مسح الأداة ----------
// الموقع لا يستطيع إزالة إضافة المتجر/سكربت Tampermonkey برمجيًا — فنُرشد المعلم بخطوات
// إزالة قصيرة بحسب متصفحه (أيقونة يمين أو صفحة الإضافات/لوحة Tampermonkey)، مع نواقل
// نسخ لعنوان صفحة الإضافات لأن المتصفحات لا تسمح بفتح chrome:// وedge:// من صفحات الويب.
function toolRemove(){
  var b=browserKind()||'chrome',exUrl=b==='edge'?'edge://extensions':'chrome://extensions',au=b==='firefox'?'about:addons':'about:blank';
  var h;
  if(b==='edge'||b==='chrome'){
    h='<p class="m-msg">أداة نور مثبتة عندك <b>إضافة متصفح</b>. لمسحها كليًا:</p>'+
      '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
      '<li><b>الأسرع:</b> <b>كليك يمين</b> على أيقونة «خبير — أداة نور» في شريط المتصفح ← <b>«إزالة من المتصفح… / Remove from browser…»</b> ← وافق.</li>'+
      '<li><b>أو من الصفحة المخصصة:</b> افتح <code class="ltr" style="user-select:all">'+exUrl+'</code> <button type="button" class="btn small" data-copy="'+exUrl+'">نسخ</button> ← بطاقة <b>«خبير — أداة نور»</b> ← <b>حذف / Remove</b>.</li></ol>'+
      '<p class="m-msg muted small">بعد المسح حدّث الصفحة هنا: علامة «أداة نور ✓» تختفي، ويبقى ممكن إعادة تثبيتها في أي وقت من قائمة «المزيد» ← «أداة نور».</p>';
  } else if(b==='safari'||b==='ios'){
    h='<p class="m-msg">أداة نور عندك <b>سكربت داخل تطبيق Userscripts</b>. لمسحها:</p>'+
      '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
      '<li>افتح تطبيق <b>Userscripts</b> ← قائمة السكربتات ← اتجه إلى <b>«خبير — أداة نور»</b> ← <b>حذف 🗑</b>.</li>'+
      '<li>ولو أردت إزالة الإضافة كلها: على الآيفون <b>الإعدادات</b> ← <b>Safari</b> ← <b>الإضافات</b> ← Userscripts ← أطفئها أو احذفها. وعلى الماك: <b>سافاري ← الإعدادات ← الإضافات</b> ← Userscripts.</li></ol>'+
      '<p class="m-msg muted small">بعد المسح حدّث الصفحة — لو أردت الأداة مجددًا ثبّتها من قائمة «المزيد» بضغطتين.</p>';
  } else { // فايرفوكس: الأداة إما إضافة منشورة من موزيلا أو سكربت داخل Tampermonkey — نغطي الاثنين
    h='<p class="m-msg">أداة نور عندك أحد الاثنين — إضافة متصفح أو سكربت داخل Tampermonkey:</p>'+
      '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
      '<li><b>لو إضافة:</b> <b>كليك يمين</b> على أيقونة «خبير — أداة نور» في شريط المتصفح ← <b>«إزالة من المتصفح… / Remove from browser…»</b> ← وافق. أو من <code class="ltr" style="user-select:all">'+au+'</code> <button type="button" class="btn small" data-copy="'+au+'">نسخ</button> ← بطاقة الإضافة ← <b>حذف / Remove</b>.</li>'+
      '<li><b>لو سكربت Tampermonkey:</b> اضغط أيقونة Tampermonkey (خانة الإضافات 🧩) ← <b>لوحة التحكم / Dashboard</b> ← السطر <b>«خبير — أداة نور»</b> ← أيقونة <b>السلة 🗑</b> ← وافق. ولإزالة Tampermonkey نفسه: من <code class="ltr" style="user-select:all">'+au+'</code> حدّده ← <b>إزالة</b>.</li></ol>'+
      '<p class="m-msg muted small">بعد المسح حدّث صفحة الموقع. ولو مسحتها بالغلط: «المزيد» ← «أداة نور» ← خطوتان فقط وترجع.</p>';
  }
  var pr=dialog({title:'مسح أداة نور',html:h,okText:'تم',cancelText:false});
  Array.prototype.forEach.call(document.querySelectorAll('#modalBox [data-copy]'),function(b){b.onclick=function(){copyText(b.getAttribute('data-copy'));};});
  return pr;
}
// ---------- عرض تفاعلي لخطوات تثبيت الآيفون ----------
// بديل الفيديو: يشتغل على أي جهاز بلا استضافة ولا يوتيوب، ومشاهده من نفس أنماط المرشد
// (iosg-*) فيبقى متزامنًا مع نصه عند أي تحديث. تقديم تلقائي بين الخطوات مع تشغيل/إيقاف
// وتنقّل يدوي وشريط تقدّم، وزر إغلاق وEscape.
function iosPlay(){
  if($('tvOv'))return;
  // لكل مشهد: العنوان، محتوى محاكاة (نفس أنماط iosg)، مدة العرض
  function row(parts){return '<div class="iosg-row">'+parts+'</div>';}
  function el(x,tap){return '<span class="iosg-el'+(tap?' iosg-tap':'')+'">'+esc(x)+'</span>';}
  var S=[
    {t:'١ · ثبّت تطبيق <b>Userscripts</b> — مجاني',ms:7000,h:
      '<div class="iosg-t">متجر التطبيقات — App Store</div>'+
      row(el('App Store')+el('بحث')+el('Userscripts',1)+el('احصل',1))+
      '<div class="tos-n">أيقونته سوداء. التثبيت مجاني، ومرة واحدة فقط.</div>'},
    {t:'٢ · فعّل الإضافة وامنح الإذن',ms:9000,h:
      '<div class="iosg-t">الإعدادات » Safari » الإضافات</div>'+
      row(el('الإعدادات',1)+el('Safari')+el('الإضافات'))+
      row(el('Userscripts','مفتاح: شغّل')+el('كل المواقع: سماح',1))+
      '<div class="tos-n">iOS 26+: الإعدادات ← التطبيقات ← Safari ← الإضافات.</div>'},
    {t:'٣ · افتح نافذة التثبيت من المنصة',ms:8000,h:
      '<div class="iosg-t">khabeer.khabeer-bio.workers.dev</div>'+
      row(el('زر «أداة نور»',1)+el('تبويب iPhone 📱')+el('تثبيت الأداة',1))+
      '<div class="tos-n">تفتح صفحة الأداة في سافاري — هذا سليم.</div>'},
    {t:'٤ · ثبّت الأداة في سافاري',ms:10000,h:
      '<div class="iosg-t">صفحة الأداة في سافاري</div>'+
      row(el('شريط العنوان')+el('aA',1)+el('Userscripts')+el('Install',1)+el('تم'))+
      '<div class="tos-n">⚠️ لو ظهر «كود نصّي» بلا زر Install: <b>Userscripts غير مفعّل</b> — أكمل الخطوة ٢.</div>'},
    {t:'٥ · حدّث صفحة المنصة وبدّأ',ms:7000,h:
      '<div class="iosg-t">khabeer.khabeer-bio.workers.dev بعد التحديث</div>'+
      row(el('تحديث الصفحة')+el('أداة نور ✓',1))+
      '<div class="tos-n">من هنا: كل درس فيه زر «إرسال التحضير إلى نور» يملأ كل شيء تلقائيًا.</div>'}
  ];
  var i=0,playing=true,tm=null,tLeft=0,last=0;
  var ov=document.createElement('div');ov.id='tvOv';ov.className='tv-ov';
  ov.innerHTML='<div class="tv-card">'+
    '<div class="tv-bar"><b id="tvT"></b><button type="button" class="tv-x" id="tvX" aria-label="إغلاق">✕</button></div>'+
    '<div class="tv-stage" id="tvStage"></div>'+
    '<div class="tv-foot"><button type="button" class="tv-btn" id="tvPrev" aria-label="السابق">‹</button>'+
    '<button type="button" class="tv-btn pri" id="tvPlay" aria-label="تشغيل/إيقاف">⏸</button>'+
    '<button type="button" class="tv-btn" id="tvNext" aria-label="التالي">›</button>'+
    '<span class="tv-prog"><span class="tv-fill" id="tvFill"></span></span></div>'+
    '<div class="tv-n" id="tvN"></div></div>';
  document.body.appendChild(ov);
  function cleanup(){clearTimeout(tm);document.removeEventListener('keydown',onkey);}
  function close(){cleanup();if(ov.parentNode)ov.parentNode.removeChild(ov);}
  function onkey(e){if(e.key==='Escape')close();else if(e.key==='ArrowRight')show(i+1);else if(e.key==='ArrowLeft')show(i-1);}
  function show(n){
    i=(n+S.length)%S.length;
    $('tvT').innerHTML=S[i].t;
    $('tvStage').innerHTML='<div class="iosg">'+S[i].h+'</div>';
    $('tvN').textContent='الخطوة '+(i+1)+' من '+S.length;
    $('tvFill').style.width='0%';
    play();
  }
  function play(){
    playing=true;if($('tvPlay'))$('tvPlay').textContent='⏸';
    tLeft=S[i].ms;last=Date.now();tick();
  }
  function tick(){
    if(!playing)return;
    tLeft=Math.max(0,tLeft-(Date.now()-last));last=Date.now();
    var p=1-tLeft/S[i].ms;if($('tvFill'))$('tvFill').style.width=Math.round(p*100)+'%';
    if(tLeft<=0){show(i+1);return;}
    tm=setTimeout(tick,200);
  }
  function pause(){playing=false;clearTimeout(tm);if($('tvPlay'))$('tvPlay').textContent='▶';}
  $('tvX').onclick=close;
  $('tvPrev').onclick=function(){pause();show(i-1);};
  $('tvNext').onclick=function(){pause();show(i+1);};
  $('tvPlay').onclick=function(){playing?pause():play();};
  $('tvStage').onclick=function(){pause();show(i+1);};
  document.addEventListener('keydown',onkey);
  show(0);
}

// تنبيه غير حاجب: نُخبر المعلم أن هناك إصدارًا أحدث، ولا نمنعه من العمل.
// (الحجب كان يسبب تعطّلًا كاملًا لو تعذّر قراءة الإصدار لأي سبب.)
var UPD_KEY='tahdir_tool_upd';
function updState(){try{var o=JSON.parse(localStorage.getItem(UPD_KEY)||'null');return o&&o.to===TOOL_LATEST?o:{to:TOOL_LATEST,n:0};}catch(e){return {to:TOOL_LATEST,n:0};}}
function updSave(o){try{localStorage.setItem(UPD_KEY,JSON.stringify(o));}catch(e){}}
// تحديث إضافة كروم/إيدج: تنبيه واحد غير حاجب لكل إصدار جديد (لا يخص Tampermonkey/فايرفوكس)
function extUpdateNote(){
  if(IN_APP||!hasExt())return;
  if(document.documentElement.getAttribute('data-tahdir-ext-src')==='store')return; // المتجر يحدّثها تلقائيًا
    var ev=extVersion();if(!ev||verCmp(ev,TOOL_LATEST)>=0)return;
    var es=updState();if(es.n>0)return;updSave({to:TOOL_LATEST,n:1});
    var bx=browserKind()==='edge'?'edge://extensions':'chrome://extensions';
    if(browserKind()==='edge'&&extUrl()){
      // إيدج: الإضافة أصبحت في متجر Edge ولا يتحدّث منها تلقائيًا. بدل «حمّل ZIP وفُكه فوق القديم»
      // ثبت نسخة المتجر بضغتين ثم أزل النسخة غير المجمّعة (حتى لا تعمل الأداة مرتين).
      dialog({title:'تحديث إضافة «خبير»',html:'<p class="m-msg">عندك الإصدار '+esc(ev)+' والأحدث '+esc(TOOL_LATEST)+'. الإضافة صارت في <b>متجر Edge</b> وتتحدّث تلقائيًا من عنده.</p><ol class="m-msg" style="line-height:2;padding-inline-start:1.2em"><li>ثبّت نسخة المتجر بضغتين: <a href="'+extUrl()+'" target="_blank" rel="noopener">صفحة الإضافة في المتجر</a> ← «الحصول عليه / Get».</li><li>أزل النسخة القديمة: افتح <code class="ltr">'+bx+'</code> واضغط الحذف على بطاقة «خبير» (غير المجمّعة).</li></ol>',okText:'🌊 فتح متجر Edge',cancelText:'لاحقًا'})
        .then(function(r){if(r)window.open(extUrl(),'_blank');});
      return;
    }
    dialog({title:'تحديث إضافة «خبير»',html:'<p class="m-msg">عندك الإصدار '+esc(ev)+' والأحدث '+esc(TOOL_LATEST)+'. التحديث مستحسن لكنه غير إلزامي.</p><ol class="m-msg" style="line-height:2;padding-inline-start:1.2em"><li>حمّل الملف الجديد وفُك ضغطه <b>فوق</b> مجلد الإضافة القديم (استبدال الملفات).</li><li>افتح <code class="ltr">'+bx+'</code> واضغط زر التحديث ↻ على بطاقة «خبير — أداة نور».</li></ol>',okText:'⬇ تحميل التحديث',cancelText:'لاحقًا'})
      .then(function(r){if(r){var a=document.createElement('a');a.href=EXT_ZIP;a.download='khabeer-ext.zip';document.body.appendChild(a);a.click();a.remove();}});
}
function toolUpdateNote(){
  if(IN_APP)return;
  if(hasExt())return;
  var v=toolVersion(),ov=$('modal');
  if(!v){ updSave({to:TOOL_LATEST,n:0}); return; }         // غير مثبتة: لا نُزعج في كل صفحة
  if(verCmp(v,TOOL_LATEST)>=0){ updSave({to:TOOL_LATEST,n:0,done:1}); return; }
  var st=updState();
  if(st.n>0)return;                                        // نبّهنا مرة واحدة لهذا الإصدار
  updSave({to:TOOL_LATEST,n:1});
  if(ov&&!ov.hidden)return;
  dialog({title:'تحديث أداة نور',message:'عندك الإصدار '+v+' والأحدث '+TOOL_LATEST+'. التحديث مستحسن لكنه غير إلزامي — تقدر تكمل عادي.',okText:'تحديث الآن',cancelText:'لاحقًا'})
    .then(function(r){if(r)window.open(TOOL_URL,'_blank');});
}
// نُبقي مراقبة الإصدار لتحديث زر «أداة نور» في الشريط، والإعلان يتولّى التنبيه للمعلم.
function watchTool(){
  if(IN_APP)return;
  setTimeout(function(){var ov=$('modal');if(!ov||ov.hidden)extUpdateNote();},3000);
  var t=null;try{new MutationObserver(function(){clearTimeout(t);t=setTimeout(function(){var v=toolVersion();if((v||hasExt())&&$('toolBtn')){$('toolBtn').classList.remove('pulse');$('toolBtn').textContent='أداة نور ✓';}},400);}).observe(document.documentElement,{attributes:true,attributeFilter:['data-tahdir-tool','data-tahdir-ext']});}catch(e){}
  setTimeout(function(){var v=toolVersion();if((v||hasExt())&&$('toolBtn')){$('toolBtn').classList.remove('pulse');$('toolBtn').textContent='أداة نور ✓';}},2500);
}
// ---------- إعلان من السيرفر ----------
// يظهر مرة واحدة لكل معلم (لكل معرّف إعلان)، ويعمل حتى لو كانت الأداة معطّلة تمامًا
// فلا تضبط سمة الإصدار. يُدار من site/data/announcements.json.
var ANNOUNCE=__ANNOUNCE__||{};
var ANN_KEY='tahdir_ann_seen';
function annSeen(){try{return JSON.parse(localStorage.getItem(ANN_KEY)||'[]')||[];}catch(e){return [];}}
function annMark(id){try{var a=annSeen();if(a.indexOf(id)<0){a.push(id);localStorage.setItem(ANN_KEY,JSON.stringify(a.slice(-20)));}}catch(e){}}
function showAnnouncement(){
  var a=ANNOUNCE.toolUpdate;
  if(!a||!a.id||!a.body)return;
  if(navigator.webdriver)return;
  var ov=$('modal');if(!ov)return;                       // صفحات الدخول بلا نافذة: لا إعلان
  if(ov.classList.contains('locked')||!ov.hidden)return;  // لا نقاطع نافذة مفتوحة
  if(annSeen().indexOf(a.id)>=0)return;
  // لو الأداة محدّثة فعلًا فلا داعي للإعلان
  var v=toolVersion();
  if(v&&verCmp(v,TOOL_LATEST)>=0){annMark(a.id);return;}
  // لا نُسجّله كمقروء الآن: لو كانت هناك نافذة مفتوحة نؤجّل ونعرضه في زيارة تالية،
  // وإلا ضاع الإعلان بلا أن يراه المعلم.
  setTimeout(function(){
    if(ov.classList.contains('locked')||!ov.hidden)return;
    annMark(a.id);
    dialog({title:a.title||'إعلان',message:a.body,okText:a.okText||'حسنًا',cancelText:a.cancelText||'لاحقًا'})
      .then(function(r){if(r)window.open(a.url||TOOL_URL,'_blank');});
  },900);
}
// ---------- شريط التنقل: الأساسي ظاهر والباقي في قائمة ----------
function initNav(me){
  // «أول دخول» يأتي من الخادم (عدد أحداث الدخول لهذا الحساب ≤ 1)، لا من تخزين
  // المتصفح — فمن له زيارات سابقة لا يظهر له دليل الاستخدام تلقائيًّا ولو مسح
  // تخزينه، ومن يدخل أول مرة يراه مرة واحدة.
  window.IS_FIRST=!!(me&&me.first);
  var mb=$('menuBtn'),ml=$('menuList');
  if(mb&&ml){
    var close=function(){ml.hidden=true;mb.setAttribute('aria-expanded','false');};
    // القائمة لا تتجاوز الشاشة: لها ارتفاع أقصى وتتمرر من داخلها، فتبقى كل عناصرها في المتناول
    var place=function(){if(window.innerWidth<=700){ml.style.top=ml.style.left=ml.style.maxHeight='';return;}var r=mb.getBoundingClientRect(),top=Math.max(8,r.bottom+8);ml.style.top=top+'px';ml.style.maxHeight=(window.innerHeight-top-12)+'px';ml.style.left=Math.max(8,Math.min(r.left,window.innerWidth-ml.offsetWidth-8))+'px';};
    mb.onclick=function(e){e.stopPropagation();var o=ml.hidden;ml.hidden=!o;mb.setAttribute('aria-expanded',o?'true':'false');if(o)place();};
    window.addEventListener('resize',function(){if(!ml.hidden)place();});window.addEventListener('scroll',function(){if(!ml.hidden)place();},{passive:true});
    document.addEventListener('click',function(e){if(!ml.hidden&&(!ml.contains(e.target)||(e.target.closest&&e.target.closest('button,a'))))close();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  }
  if($('logoutBtn'))$('logoutBtn').onclick=logout;
  if($('tourBtn'))$('tourBtn').onclick=function(){var o=$('tourOv');if(o)return;tourStart();};
  if($('toolBtn')){
    if(IN_APP)$('toolBtn').hidden=true;
    else{$('toolBtn').onclick=function(){toolDialog('');};setTimeout(function(){if(toolVersion()||hasExt()){$('toolBtn').classList.remove('pulse');$('toolBtn').textContent='أداة نور ✓';}},1500);}
  }
  if(me&&me.role==='admin')Array.prototype.forEach.call(document.querySelectorAll('.admin-only'),function(x){x.hidden=false;});
  if(me&&$('who'))$('who').textContent=me.name;
  watchTool();
  showAnnouncement();
  initNotices(me);
}
// ---------- مركز الإشعارات (الجرس) ----------
// إعلانات ديناميكية يضيفها المدير من لوحة التحكم. حالة «مقروء» لكل مستخدم مخزّنة في
// قاعدة البيانات (تبقى حتى لو مسح تخزين المتصفح)، وغير المقروء نقطة حمراء على الجرس.
// الإعلان الثابت المبني داخل الصفحة (showAnnouncement) باقٍ كما هو؛ هذا complementary.
// فيديو الإعلانات يُخدَم من /pv/ (يدعم Range لآيفون) بدل الأصل الثابت /promo/
function vidUrl(u){return String(u||'').replace(/^\/promo\//,'/pv/');}
function initNotices(me){
  if(navigator.webdriver)return; // الاختبارات الآلية لا تحتاج الجرس
  if(!me)return; // الجرس للمسجلين فقط (وإلا فسيرد الخادم 401 ويعيدنا للدخول)
  var bb=$('bellBtn'),bp=$('bellPanel');if(!bb||!bp)return;
  var data=[],open=false;
  // نفس منطق قائمة «المزيد»: ثابت أسفل الزر ولا يتجاوز حواف الشاشة
  var place=function(){var r=bb.getBoundingClientRect(),top=Math.max(8,r.bottom+8);bp.style.top=top+'px';bp.style.maxHeight=(window.innerHeight-top-12)+'px';bp.style.left=Math.max(8,Math.min(r.left,window.innerWidth-bp.offsetWidth-8))+'px';};
  var close=function(){open=false;bp.hidden=true;bb.setAttribute('aria-expanded','false');};
  function load(){
    return api('/api/notices?b=k').then(function(r){data=r.notices||[];paint();},function(){});
  }
  function mark(id){
    api('/api/notices/read',id?{id:id}:{all:1}).then(load,function(){});
  }
  function paint(){
    var unread=data.filter(function(n){return !n.read;}).length;
    var dot=$('bellDot');if(dot)dot.hidden=!unread;
    // إضاءة توهج واهتزاز على الجرس طالما هناك غير مقروء — تتوقف آخر فتح اللوحة (CSS)
    bb.classList.toggle('unread',!!unread);
    var h='<div class="bp-head"><b>🔔 الإشعارات</b>'+(unread?'<button type="button" class="bp-all" id="bpAll">حدّد الكل مقروءًا</button>':'')+'</div>';
    h+=data.length?'<ul class="bp-list">'+data.slice(0,15).map(function(n){
      return '<li class="bp-it'+(n.read?' read':'')+'">'+
        '<div class="bp-t">'+(n.read?'':'<span class="bp-ndot" aria-hidden="true"></span>')+esc(n.title)+'</div>'+
        '<div class="bp-b">'+esc(n.body).replace(/\n/g,'<br>')+'</div>'+
        (n.video?'<video class="bp-vid" src="'+esc(vidUrl(n.video))+'" poster="'+esc(vidUrl(n.video).replace(/\.mp4$/,'.jpg'))+'" controls playsinline preload="none"></video>':'')+
        (n.url?'<a class="bp-link" href="'+esc(n.url)+'" target="_blank" rel="noopener">فتح الرابط ↗</a>':'')+
        (n.read?'<span class="bp-read">مقروء ✓</span>':'<button type="button" class="btn small primary bp-ok" data-no="'+n.id+'">حسنًا</button>')+
        '<span class="bp-date">'+fmtDate(n.created_at)+'</span></li>';
    }).join('')+'</ul>':'<p class="bp-empty">لا توجد إشعارات بعد.</p>';
    bp.innerHTML=h;
    Array.prototype.forEach.call(bp.querySelectorAll('.bp-ok'),function(b){b.onclick=function(e){e.stopPropagation();mark(+b.getAttribute('data-no'));};});
    if($('bpAll'))$('bpAll').onclick=function(e){e.stopPropagation();mark(0);};
  }
  bb.onclick=function(e){
    e.stopPropagation();
    if(open){close();return;}
    open=true;bp.hidden=false;bb.setAttribute('aria-expanded','true');
    place();paint();load();
  };
  // نغلق عند الضغط خارج اللوحة، وعند Esc، ونعيد التموضع عند تمرير/تحجيم الصفحة
  document.addEventListener('click',function(e){if(open&&!bp.contains(e.target))close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  window.addEventListener('resize',function(){if(open)place();});
  window.addEventListener('scroll',function(){if(open)place();},{passive:true});
  // علامة غير المقروء تظهر من أول تحميل الصفحة دون فتح
  // + إشعار فيديو غير مقروء (مثل إعلان المنصة) يُعرض في نافذة بمجرد فتح الصفحة، مرة واحدة لكل معلم
  load().then(function(){
    var v=data.filter(function(n){return n.video&&!n.read;})[0];if(!v)return;
    var tries=0;
    setTimeout(function show(){
      var ov=$('modal');if(!ov)return;
      if(!ov.hidden||$('tourOv')){if(++tries<40)setTimeout(show,900);return;}
      var p=dialog({title:v.title,okText:'حسنًا 👍',cancelText:false,
        html:'<div class="nv-wrap"><video class="nv-vid" id="nvVid" src="'+esc(vidUrl(v.video))+'" poster="'+esc(vidUrl(v.video).replace(/\.mp4$/,'.jpg'))+'" controls playsinline preload="auto"></video>'+
          '<button type="button" class="nv-snd" id="nvSnd" hidden>🔊 شغّل الصوت</button></div><p class="m-msg nv-txt">'+esc(v.body)+'</p><p class="muted small nv-later">تجده دائمًا في الإشعارات 🔔 أعلى الصفحة.</p>'});
      var box=$('modalBox');if(box)box.classList.add('nv-box');
      var vid=$('nvVid'),snd=$('nvSnd');
      if(vid){
        var pr=vid.play();
        // المتصفح قد يمنع التشغيل بالصوت تلقائيًا: نشغّله صامتًا ونعرض زر الصوت
        if(pr&&pr.catch)pr.catch(function(){vid.muted=true;vid.play().catch(function(){});if(snd)snd.hidden=false;});
        if(snd)snd.onclick=function(){vid.muted=false;vid.currentTime=0;vid.play().catch(function(){});snd.hidden=true;};
      }
      mark(v.id);
      p.then(function(){var b=$('modalBox');if(b)b.classList.remove('nv-box');});
    },1200);
  });
}
// اختيار الصف: المادة أولًا (قائمة منبثقة) ثم صفوفها مرتّبة
var CP_ICON={'العلوم':'🔬','الأحياء':'🧬','الكيمياء':'⚗️','الفيزياء':'🧲','العلوم البيئية':'🌍','اللغة الإنجليزية':'🔤','اللغة العربية':'📖','الرياضيات':'➗','الدراسات الاجتماعية':'🗺️','تقنية المعلومات':'💻','التربية الإسلامية':'🕌'};
var CP_ORDER=['العلوم','الأحياء','الكيمياء','الفيزياء','العلوم البيئية','الرياضيات','اللغة العربية','اللغة الإنجليزية','الدراسات الاجتماعية','التربية الإسلامية','تقنية المعلومات'];
var CP_GN={'الأول':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
// بعض الملفات تكتب الصف «الصف التاسع» وبعضها «التاسع»؛ كل العناوين تضيف «الصف » بنفسها
function gLabel(g){return String(g==null?'':g).replace(/^الصف\s+/,'').trim();}
function cpLs(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){}return null;}
function cpSubjects(cs){var s={};cs.forEach(function(c){s[c.subject]=1;});return Object.keys(s).sort(function(a,b){var x=CP_ORDER.indexOf(a),y=CP_ORDER.indexOf(b);return (x<0?99:x)-(y<0?99:y)||a.localeCompare(b,'ar');});}
function cpGrades(cs,s){return cs.filter(function(c){return c.subject===s;}).sort(function(a,b){return (CP_GN[a.grade]||99)-(CP_GN[b.grade]||99);});}
function cpDefault(cs){var subs=cpSubjects(cs),s=cpLs('tahdir_subject');if(subs.indexOf(s)<0)s=subs[0];var g=cpGrades(cs,s),last=cpLs('tahdir_cp_'+s);return g.filter(function(c){return c.key===last;})[0]||g[0]||cs[0];}
function cpGradeOpts(gs,key,extra){return gs.map(function(c){return '<option value="'+esc(c.key)+'"'+(c.key===key?' selected':'')+'>الصف '+esc(gLabel(c.grade))+(extra?extra(c):'')+'</option>';}).join('');}
function coursePick(cs,curKey,id,extra){
  var subs=cpSubjects(cs),cur=cs.filter(function(c){return c.key===curKey;})[0],s=cur?cur.subject:cpDefault(cs).subject;
  return '<div class="cpick"><label class="cp-l"'+(subs.length<2?' hidden':'')+'><span>المادة</span><select id="'+id+'Subj" class="qsel">'+subs.map(function(x){return '<option value="'+esc(x)+'"'+(x===s?' selected':'')+'>'+(CP_ICON[x]||'📘')+' '+esc(x)+'</option>';}).join('')+'</select></label>'+
    '<label class="cp-l"><span>الصف</span><select id="'+id+'" class="qsel">'+cpGradeOpts(cpGrades(cs,s),curKey,extra)+'</select></label></div>';
}
function bindCoursePick(cs,id,onPick,extra){
  var ss=$(id+'Subj'),gs=$(id);if(!ss||!gs)return;
  ss.onchange=function(){var s=this.value;cpLs('tahdir_subject',s);var list=cpGrades(cs,s),last=cpLs('tahdir_cp_'+s),k=list.some(function(c){return c.key===last;})?last:(list[0]&&list[0].key);gs.innerHTML=cpGradeOpts(list,k,extra);if(k)onPick(k);};
  gs.onchange=function(){var v=this.value,c=cs.filter(function(x){return x.key===v;})[0];if(c){cpLs('tahdir_cp_'+c.subject,v);cpLs('tahdir_subject',c.subject);}onPick(v);};
}

// الطباعة المباشرة باسم ملف واضح (اسم PDF = عنوان الصفحة)
function doPrint(name){var a=$('printArea'),t=document.title;document.title=String(name||t).replace(/[\\/:*?"<>|]+/g,'-').slice(0,100);supifyIn(a);a.innerHTML=PR_WRAP(a.innerHTML);document.body.classList.add('printing');setTimeout(function(){window.print();setTimeout(function(){document.body.classList.remove('printing');a.innerHTML='';document.title=t;},800);},60);}
// هوامش الصفحة داخل جدول (thead/tfoot تتكرر في كل صفحة) حتى نلغي هوامش المتصفح التي يطبع فيها الرابط والتاريخ
// ترويسة الطباعة: شعار وزارة التعليم أعلى اليمين وشعار رؤية عُمان أعلى اليسار.
// توضع في <thead> فيتكرّر الشعاران في **كل صفحة** من الورقة المطبوعة.
function PR_LOGOS(){return '<div class="plogo-row"><img class="plogo-moe" src="/brand/moe.png" alt="وزارة التعليم"><img class="plogo-vis" src="/brand/vision.png" alt="رؤية عُمان 2040"></div>';}
// الورقة التي لها ترويسة رسمية (OFFICIAL_HEAD) تحمل الشعارين بنفسها، فلا نكرر صف الشعارات فوقها
function PR_WRAP(h){var lg=/class="ohead"/.test(h)?'':PR_LOGOS();return '<table class="prw"><thead><tr><td>'+lg+'<div class="prsp"></div></td></tr></thead><tfoot><tr><td><div class="prsp"></div></td></tr></tfoot><tbody><tr><td>'+h+'</td></tr></tbody></table>';}
// ترويسة الأوراق الرسمية (الاختبار القصير، أوراق العمل والخطط…) بتنسيق نماذج الوزارة:
// يمين: شعار وزارة التعليم وتحته المديرية والمدرسة · وسط: العنوان في شريط رمادي ثم الفصل/العام ثم مربع اسم الطالب
// · يسار: شعار رؤية عُمان 2040 بنفس الحجم وتحته مربع الدرجة. تعمل في الطباعة وملف Word.
// o = {dir, school, title, line2, student:bool|string, box:html, word:bool, en:bool}
// إعدادات الترويسة المحفوظة من صفحة التقويم (المديرية · المدرسة · العام · الفصل) تُستخدم في كل الأوراق
var SCHOOL_HDR_DEF={dir:'',school:'',year:'2027/2026',term:'الأول'};
function schoolHdr(){var o={};try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^tahdir_quiz_hdr_/.test(k)){o=JSON.parse(localStorage.getItem(k)||'{}')||{};break;}}}catch(e){}
  var r={};Object.keys(SCHOOL_HDR_DEF).forEach(function(k){r[k]=(o&&o[k])||SCHOOL_HDR_DEF[k];});return r;}
function OFFICIAL_HEAD(o){
  var w=!!o.word,org=location.origin,SRC={'moe.png':o.moeSrc,'vision.png':o.visSrc},img=function(f,alt){return '<img src="'+(SRC[f]||org+'/brand/'+f)+'" alt="'+alt+'"'+(w?' height="54"':'')+' style="height:'+(w?'54px':'15mm')+';width:auto;display:block;margin:0 auto 2px">';};
  var small=w?'9.5pt':'.74em',stu='';
  if(o.student)stu='<div style="border:1px solid #000;border-radius:8px;padding:4px 10px;margin-top:5px;font-size:'+(w?'11pt':'.9em')+';white-space:nowrap;text-align:'+(o.en?'left':'right')+'"'+(o.en?' dir="ltr"':'')+'>'+(typeof o.student==='string'?o.student:'اسم الطالب: ................................ &nbsp; الصف: ........')+'</div>';
  return '<table class="ohead" dir="rtl" style="width:100%;border-collapse:collapse"><tr>'+
    '<td style="width:28%;vertical-align:top;text-align:center;font-size:'+small+';line-height:1.45;padding:0">'+img('moe.png','وزارة التعليم')+'سلطنة عُمان<br>'+esc(o.dir||'').replace(/ (بمحافظة)/,'<br>$1')+'<br><span style="white-space:nowrap">'+esc(o.school||'')+'</span></td>'+
    '<td style="width:54%;vertical-align:bottom;text-align:center;padding:0 8px">'+
      '<div class="ptitle" style="font-weight:bold;font-size:'+(w?'13pt':'.94em')+';background:#e6e6e6;padding:3px 6px">'+esc(o.title||'')+'</div>'+
      (o.line2?'<div style="font-size:'+(w?'11pt':'.92em')+';margin-top:2px">'+esc(o.line2)+'</div>':'')+stu+'</td>'+
    '<td style="width:18%;vertical-align:top;text-align:center;padding:0">'+img('vision.png','رؤية عُمان 2040')+(o.box?'<div style="margin-top:4px">'+o.box+'</div>':'')+'</td>'+
    '</tr></table><hr style="border:0;border-top:2.5px solid #000;margin:8px 0 12px">';
}
// الأسس والأيونات: X^2 أو 10^-3 أو Mg^2+ أو ^{...} تُعرض أسًا مرفوعًا
// كانت الشحنة المنفردة (Cl^- و H3O^+ و HCO3^-) لا تطابق النمط لأنه اشترط رقمًا أو حرفًا
// بعد الإشارة، فبقيت «^» ظاهرة في الصفحة وفي ملف Word. والآن تُقبل الإشارة وحدها أيضًا.
// وبعد الأس نضع علامة اتجاه (LRM) حتى لا تقفز الإشارة «−» إلى أول السطر العربي.
var SUP_RE=/\^\{([^}]{1,14})\}|\^((?:[0-9]{1,3}|[A-Za-z])[+\-−]?|[+\-−](?:[0-9]{1,3}|[A-Za-z])?)/g;
function supify(s){return String(s).replace(SUP_RE,function(m,a,b,off,str){var x=a||b,pre=str.charAt(off-1);return '<sup>'+x+'</sup>'+(/[A-Za-z0-9\)\]]/.test(pre)?'\u200e':'');});}
function supifyIn(root){
  if(!root||!root.ownerDocument&&root!==document)return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentNode;if(!p||/^(SCRIPT|STYLE|TEXTAREA|OPTION|TITLE)$/.test(p.nodeName)||p.isContentEditable&&p.closest&&p.closest('[contenteditable="true"]'))return NodeFilter.FILTER_REJECT;return n.nodeValue.indexOf('^')>=0?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;}}),list=[],n;
  while((n=w.nextNode()))list.push(n);
  list.forEach(function(t){SUP_RE.lastIndex=0;if(!SUP_RE.test(t.nodeValue))return;var sp=document.createElement('span');sp.innerHTML=supify(esc(t.nodeValue));var f=document.createDocumentFragment();while(sp.firstChild)f.appendChild(sp.firstChild);t.parentNode.replaceChild(f,t);});
}
try{new MutationObserver(function(ms){ms.forEach(function(m){Array.prototype.forEach.call(m.addedNodes,function(x){if(x.nodeType===1)supifyIn(x);else if(x.nodeType===3&&x.parentNode)supifyIn(x.parentNode);});});}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
document.addEventListener('DOMContentLoaded',function(){supifyIn(document.body);});
// ملء الشاشة: إن لم يدعمه المتصفح/التطبيق نكبّر العنصر داخل النافذة
function toggleFull(el){
  if(el.classList.contains('pseudo-fs')){el.classList.remove('pseudo-fs');document.body.classList.remove('pseudo-fs-on');return;}
  try{if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return;}}catch(e){}
  var fn=el.requestFullscreen||el.webkitRequestFullscreen,done=false;
  if(fn&&!IN_APP){try{var r=fn.call(el);done=true;if(r&&r.catch)r.catch(function(){el.classList.add('pseudo-fs');document.body.classList.add('pseudo-fs-on');});}catch(e){done=false;}}
  if(!done){el.classList.add('pseudo-fs');document.body.classList.add('pseudo-fs-on');}
}
// ---------- دليل الاستخدام: جولة مصوّرة بأسهم لأول دخول ----------
// تُخزَّن مرة واحدة في localStorage، وتُعاد من زر «دليل الاستخدام» في الشريط.
// كل خطوة تُظلّل عنصرًا (spotlight) وتُظهر فقاعة بجانبه مع سهم يشير إليه.
var TOUR_KEY='tahdir_tour_v1',tourEls=null,tourI=0,tourList=[],tourObs=null;
function tourPage(){var p=location.pathname;if(p==='/tahdir')p='/app';return p==='/app'?'app':p==='/quiz'?'quiz':p==='/finals'?'finals':p==='/games'?'games':p==='/remedial'?'remedial':p==='/summaries'?'summaries':p==='/cards'?'cards':'other';}
function tourSteps(){
  var pg=tourPage();
  if(pg==='app')return [
    {sel:null,title:'أهلًا بك في «خبير» ⭐',text:'خطوتان تفصلانك عن تحضير جاهز يُرسل إلى نور بضغطة: ثبّت أداة نور (مرة واحدة)، ثم اختر صفّك. تقدر تعيد هذا الدليل في أي وقت من زر «دليل الاستخدام» أعلى الصفحة.'},
    {sel:'#toolBtn',step:'tool',title:'١) ثبّت «أداة نور» — مرة واحدة فقط',text:'هذه هي الخطوة الأولى والأهم: هي التي تُرسل التحضير والواجب إلى نور وتصحّح الواجبات تلقائيًا. اضغط الزر واتبع خطوات متصفحك (كروم وإيدج وفايرفوكس: Tampermonkey). في تطبيق خبير الأداة مدمجة — لا تحتاج تثبيت شيء.',cta:'كيف أثبّتها؟'},
    {sel:'#subjSel',title:'٢) اختر المادة',text:'بعد تثبيت الأداة: القائمة الأولى للمواد المتاحة لك، والثانية للصفوف. تظهر لك المواد التي سمح بها المدير فقط.'},
    {sel:'.g-btn',title:'٣) اختر الصف',text:'اضغط الصف ليفتح، ثم اختر الوحدة، ثم الدرس. كل درس مقسّم بنفس خانات نموذج «إضافة تحضير» في نور.'},
    {sel:'#sendPrepBtn',title:'٤) أرسل التحضير إلى نور',text:'اضغط «إرسال التحضير إلى نور» ونور مفتوحة: تُفتح «إضافة تحضير» للصف ويُختار الدرس وتُملأ الأركان. يبقى لك التاريخ وزر «إضافة».'},
    {sel:null,title:'كل شيء جاهز ✓',text:'تقدر تعيد هذا الدليل من زر «دليل الاستخدام»، وتجده أيضًا في صفحة «أداة نور».'}
  ];
  if(pg==='quiz')return [
    {sel:null,title:'التقويم والاختبارات',text:'تُبنى الورقة آليًّا من بنك أسئلة الوزارة وفق وثيقة التقويم لصفّك.'},
    {sel:'#courseSel',title:'١) اختر الصف',text:'ثم علّم الدروس المطلوبة من الشجرة.'},
    {sel:'#makeBtn',title:'٢) كوّن الورقة',text:'اضغط «كوّن الاختبار» فتظهر الورقة بالدرجات والتوزيع.'},
    {sel:null,title:'جاهز ✓',text:'تقدر تطبعها أو تنزّلها Word من الأزرار أعلى الورقة.'}
  ];
  if(pg==='finals')return [
    {sel:null,title:'الاختبارات النهائية',text:'أسئلة الوزارة للأعوام السابقة، مقصوصة كما وردت مع الإجابات.'},
    {sel:'#courseSel',title:'١) اختر المقرر',text:'ثم اختر الوحدة من الشريط الجانبي.'},
    {sel:null,title:'جاهز ✓',text:'فعّل «إظهار الإجابات» للمراجعة، أو اطبع المختار من الشريط.'}
  ];
  if(pg==='cards')return [
    {sel:null,title:'كروت الأسئلة (بليكرز) 🪪',text:'لكل طالب بطاقة مطبوعة برمز خاص. يدير الطالب بطاقته فيصبح حرف إجابته في الأعلى، وتمسح الصف كله بكاميرا جوالك، فيُسجَّل كل طالب باسمه صح أو خطأ.'},
    {sel:'#cdNewC',title:'١) أضف صفًا',text:'اختر المادة والصف، والصق أسماء الطلاب بترتيب الكشف. تحفظ المنصة الاسم الأول والقبيلة ليظهرا مع المسح، ورقم الطالب في الكشف هو رقم بطاقته.'},
    {sel:'[data-pr]',title:'٢) اطبع البطاقات',text:'بطاقتان في الصفحة (مثل Plickers). وزّعها بالترتيب: البطاقة 1 لأول طالب في الكشف، وهكذا. يحتفظ الطالب ببطاقته لكل الحصص.'},
    {sel:'[data-go]',title:'٣) ولّد الأسئلة وابدأ',text:'اختر الدروس وعدد الأسئلة (5 أو 10 أو 15 أو 20) من بنك الصف نفسه، ثم «بدء الجلسة».'},
    {sel:'#ckHelp',title:'٤) الكمبيوتر يعرض والجوال يمسح',text:'اعرض الأسئلة على كمبيوتر الفصل، وامسح رمز QR الظاهر عليه بجوالك (بنفس الحساب) لتفتح الكاميرا. من الجوال تنتقل للسؤال التالي وتُظهر الإجابة، والسبورة تتغير وحدها. الشرح الكامل في «طريقة الاستخدام».'},
    {sel:'[data-tab="sessions"]',title:'٥) النتائج',text:'كل جلسة تُحفظ بنتائجها: صح/خطأ لكل طالب، وتقرير للطباعة، وإرسال إلى «تحليل النتائج» و«سجل صعوبات التعلم».'}
  ];
  return [{sel:null,title:'دليل الاستخدام',text:'تنقّل بين الصفحات من القائمة أعلى الشاشة: التحضير · التقويم · الألعاب · النهائيات.'}];
}
function tourRender(){
  var s=tourList[tourI];if(!s)return tourClose();
  var ov=$('tourOv'),spot=$('tourSpot'),tip=$('tourTip');if(!ov)return;
  var t=null;if(s.sel){try{var all=document.querySelectorAll(s.sel);for(var i=0;i<all.length;i++){var r=all[i].getBoundingClientRect();if(r.width>4&&r.height>4&&r.bottom>0&&r.top<innerHeight){t=all[i];break;}}}catch(e){}}
  if(!t&&s.sel){ // العنصر غير موجود في هذه الصفحة → نتخطّاه
    if(tourI<tourList.length-1){tourI++;return tourRender();}
    return tourClose();
  }
  if(t){
    var b=t.getBoundingClientRect(),pad=6;
    spot.hidden=false;
    spot.style.left=(b.left-pad)+'px';spot.style.top=(b.top-pad)+'px';
    spot.style.width=(b.width+pad*2)+'px';spot.style.height=(b.height+pad*2)+'px';
    t.scrollIntoView({block:'center',behavior:'smooth'});
  }else spot.hidden=true;
  tip.className='tour-tip'+(t?'':' center');
  // خطوة الأداة تتغيّر إن كانت مثبتة أصلًا (أو كنا داخل التطبيق حيث الأداة مدمجة)
  var tt=s.title,tb=s.text,cta=s.cta;
  if(s.step==='tool'){
    var inst=IN_APP||!!toolVersion()||hasExt();
    if(inst){
      tt='١) أداة نور جاهزة ✓';
      tb=IN_APP?'أنت داخل تطبيق «خبير»، والأداة مدمجة فيه وتتحدّث تلقائيًا — لا تحتاج تثبيت أي شيء. تابع للخطوة التالية.'
        :'الأداة مثبتة وتعمل على متصفحك ✓ — تقدر ترسل التحضير والواجب إلى نور وتصحّح الواجبات بضغطة. تابع للخطوة التالية.';
      cta='';
    }
  }
  var h='<div class="tour-h">'+esc(tt)+'</div><div class="tour-b">'+esc(tb)+'</div><div class="tour-f">'+
    '<span class="tour-n">'+(tourI+1)+' / '+tourList.length+'</span>'+
    (cta?'<button type="button" class="btn small" id="tourCta">'+esc(cta)+'</button>':'')+
    '<button type="button" class="btn small" id="tourSkip">تخطّي</button>'+
    (tourI>0?'<button type="button" class="btn small" id="tourPrev">السابق</button>':'')+
    '<button type="button" class="btn primary small" id="tourNext">'+(tourI===tourList.length-1?'تم':'التالي')+'</button></div>';
  tip.innerHTML=h;
  if(t){
    var r=t.getBoundingClientRect(),tw=Math.min(330,innerWidth-24),th=tip.offsetHeight||150;
    var left=Math.max(12,Math.min(innerWidth-tw-12,r.left+r.width/2-tw/2));
    var below=r.bottom+14,above=r.top-th-14;
    var top=(below+th<innerHeight-12)?below:Math.max(12,above);
    tip.style.left=left+'px';tip.style.top=top+'px';
    tip.className='tour-tip'+(top<r.top?' up':' down');
    // السهم يصوّب على **مركز العنصر** المُظلَّل، لا على حافة الفقاعة
    var cx=r.left+r.width/2-left;
    cx=Math.max(22,Math.min(tw-22,cx));
    tip.style.setProperty('--ax',cx+'px');
  }else{
    tip.style.left='50%';tip.style.top='50%';
    tip.style.transform='translate(-50%,-50%)';
  }
  if(t)tip.style.transform='';
  if($('tourNext'))$('tourNext').onclick=function(){if(tourI>=tourList.length-1)return tourClose();tourI++;tourRender();};
  if($('tourPrev'))$('tourPrev').onclick=function(){if(tourI>0)tourI--;tourRender();};
  if($('tourSkip'))$('tourSkip').onclick=tourClose;
  if($('tourCta'))$('tourCta').onclick=function(){if(typeof toolDialog==='function')toolDialog('');};
}
function tourStart(){
  tourList=tourSteps();tourI=0;
  if(!tourList.length)return;
  var ov=document.createElement('div');ov.id='tourOv';ov.className='tour-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
  ov.innerHTML='<div class="tour-spot" id="tourSpot" hidden></div><div class="tour-tip" id="tourTip"></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click',function(e){if(e.target===ov)tourClose();});
  tourRender();
  window.addEventListener('resize',tourRender);
  window.addEventListener('scroll',tourRender,{passive:true});
  document.addEventListener('keydown',tourKey,true);
  // أي نافذة تُفتح أثناء الجولة (إعلان تحديث · تنبيه) تُقدَّم عليها الجولة:
  // نُخفيها **بلا** وسمها كمُنجَزة كي تعود في زيارة تالية، وإلا حجبت الأزرار.
  var md=$('modal');
  if(md&&window.MutationObserver){
    tourObs=new MutationObserver(function(){
      if(md&&!md.hidden){tourPause();}
    });
    tourObs.observe(md,{attributes:true,attributeFilter:['hidden']});
  }
}
// إخفاء مؤقّت: لا يوسم الجولة كمُنجَزة
function tourPause(){
  var ov=$('tourOv');if(ov)ov.remove();
  tourDetach();
}
function tourDetach(){
  window.removeEventListener('resize',tourRender);
  window.removeEventListener('scroll',tourRender);
  document.removeEventListener('keydown',tourKey,true);
  if(tourObs){try{tourObs.disconnect();}catch(e){}tourObs=null;}
}
function tourKey(e){if(e.key==='Escape'){e.stopPropagation();tourClose();}}
function tourClose(){
  var ov=$('tourOv');if(ov)ov.remove();
  tourDetach();
  try{localStorage.setItem(TOUR_KEY,'1');}catch(e){}
}
function tourMaybe(){
  try{if(localStorage.getItem(TOUR_KEY))return;}catch(e){return;}
  var force=false,testTour=false;
  try{
    force=localStorage.getItem('tahdir_force_tour')==='1';      // تجاوز كل الشروط (لقطات)
    testTour=localStorage.getItem('tahdir_test_tour')==='1';    // تجاوز webdriver فقط
  }catch(e){}
  if(navigator.webdriver&&!force&&!testTour)return;
  // **أول دخول فقط**: العلم من الخادم (IS_FIRST) لا من المتصفح، فمن سبقت له
  // زيارات لا يظهر له الدليل تلقائيًّا ولو مسح تخزين المتصفح.
  // مهم: الفحص **داخل** حلقة الانتظار أدناه — لأن IS_FIRST لا يكون مضبوطًا إلا
  // بعد وصول /api/me، والفحص هنا مبكرًا كان يُلغي الجولة للجميع.
  var tries=0;
  (function wait(){
    if(!document.querySelector('header.top'))return;
    // ننتظر وصول بيانات المستخدم من الخادم (IS_FIRST يُضبط داخل initNav)
    if(typeof window.IS_FIRST!=='boolean'){if(++tries<30)return setTimeout(wait,300);return;}
    if(!force&&!window.IS_FIRST)return;
    var ov=$('modal');
    if(ov&&!ov.hidden){if(++tries<60)return setTimeout(wait,500);return;}
    tourStart();
  })();
}
// السكربت يُحقن في نهاية <body>، وقد يكون DOMContentLoaded وقع بالفعل — فنفحص
// حالة الاستعداد بدل الاعتماد على الحدث وحده (وإلا لم تُشغَّل الجولة أبدًا).
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tourMaybe);
else setTimeout(tourMaybe,0);

(function(){
  var K='khabeer_welcome_v1';
  if(navigator.webdriver)return;
  try{if(localStorage.getItem(K))return;}catch(e){return;}
  setTimeout(function(){
    if(!document.querySelector('header.top'))return;
    var ov=$('modal');if(!ov||!ov.hidden)return;
    try{localStorage.setItem(K,'1');}catch(e){}
    var h='<p class="m-msg">يسعدنا أن نقدّم لكم <b>«خبير»</b>، الاسم والشكل الجديدان للمنصة. حساباتكم والتحضير والقيم الثابتة كما هي دون أي تغيير.</p>'+
      '<p class="m-msg"><b>لمستخدمي تطبيق الموبايل:</b> احذفوا التطبيق القديم «الكبسولة»، ثم حمّلوا تطبيق «خبير» الجديد.</p>';
    dialog({title:'مرحبًا بكم في «خبير» ⭐',html:h,okText:'⬇ تحميل التطبيق الجديد (أندرويد)',cancelText:'حسنًا'}).then(function(r){if(r)location.href=APK_URL;});
  },900);
})();

// ---------- تحميل تطبيق الأندرويد: تنبيه «Play للحماية» قبل التحميل ----------
// التطبيق يُثبَّت من خارج متجر Play، فيعرض أندرويد للمرة الأولى رسالة «تم حظر التطبيق
// لحماية جهازك» من مطوّر لم يُعرف بعد. لا يستطيع الموقع منعها، لكنها لا تمنع التثبيت:
// نشرح للمعلّم قبل التحميل أين يضغط، حتى لا يظن أن التطبيق ضار فيلغي التثبيت.
document.addEventListener('click',function(e){
  var a=e.target&&e.target.closest&&e.target.closest('a[href$="/download/khabeer.apk"]');
  if(!a||e.ctrlKey||e.metaKey||!$('modal'))return;
  e.preventDefault();
  dialog({title:'📱 تثبيت تطبيق «خبير»',okText:'⬇ تحميل التطبيق',cancelText:'إلغاء',
    html:'<div class="m-msg apk-help"><p>التطبيق آمن ومجاني، ويُثبَّت من موقع خبير مباشرة لا من متجر Play؛ لذلك قد يعرض أندرويد عند التثبيت رسالة <b>«تم حظر التطبيق لحماية جهازك»</b>.</p>'
      +'<ol><li>افتح الملف <b>khabeer.apk</b> بعد اكتمال التحميل.</li>'
      +'<li>إن ظهرت رسالة «خدمة Google Play للحماية» فاضغط <b>«التثبيت على أي حال»</b> (أو «مزيد من التفاصيل» ثم «التثبيت على أي حال»).</li>'
      +'<li>إن طُلب الإذن بالتثبيت من المتصفح ففعّل <b>«السماح من هذا المصدر»</b> ثم ارجع واضغط «تثبيت».</li>'
      +'<li>إن سُئلت عن إرسال التطبيق للفحص فاختر <b>«إرسال»</b> أو «فحص التطبيق»؛ هذا يساعد Google على التعرّف عليه فتختفي الرسالة مع الوقت.</li></ol>'
      +'<p class="muted small">لا يطلب التطبيق أي صلاحيات غير الإنترنت.</p></div>'
  }).then(function(ok){if(ok)location.href=a.getAttribute('href');});
},true);

// ---------- رسالة «تم نقل المنصة» ----------
// من يفتح الرابط القديم (workers.dev) يُحوَّل إلى elkabsula.site، ويضع الخادم علامة
// kmoved لعشر دقائق، فتظهر هذه الرسالة مرة واحدة على كل متصفح.
(function(){
  if(location.hostname!=='elkabsula.site'||!/(?:^|;\s*)kmoved=1/.test(document.cookie))return;
  var K='kabsula_moved_seen_v1';
  try{if(localStorage.getItem(K))return;}catch(e){}
  var tries=0;
  // ننتظر قليلًا حتى تنتهي نوافذ البدء الأخرى، ولا نعتبرها «مقروءة» إلا عند الضغط على «حسنًا»
  // (فلو أغلقتها نافذة أخرى تظهر مجددًا في الصفحة التالية).
  setTimeout(function show(){
    var ov=$('modal');
    if(!ov||!ov.hidden){if(++tries<30)setTimeout(show,800);return;}
    dialog({title:'🌐 العنوان الجديد للمنصة',okText:'حسنًا',cancelText:false,
      html:'<p class="m-msg">تم نقل منصة <b>«الكبسولة»</b> إلى عنوانها الجديد:</p>'+
        '<p class="m-msg" style="text-align:center;font-size:1.25em;direction:ltr"><b>elkabsula.site</b></p>'+
        '<p class="m-msg">الرابط القديم يحوّلكم إلى هنا تلقائيًا، وحساباتكم وتحضيركم كما هي دون أي تغيير. نرجو حفظ العنوان الجديد في المفضلة.</p>'
    }).then(function(r){
      if(r===null){if(++tries<30)setTimeout(show,800);return;} // أُغلقت بنافذة أخرى: نعيد عرضها بعدها
      try{localStorage.setItem(K,'1');}catch(e){}
      document.cookie='kmoved=; Path=/; Max-Age=0; Secure; SameSite=Lax';
    });
  },1500);
})();

// ---------- وضع التطبيق (أندرويد/آيفون): واجهة تطبيق جوال لا صفحة ويب ----------
// شريط علوي مضغوط بعنوان القسم + شريط تنقل سفلي ثابت (الرئيسية · التحضير · الاختبارات · الإشعارات · الأقسام).
// يعمل فقط داخل التطبيق وعلى الشاشات الضيقة (CSS: .inapp تحت 821px)؛ الموقع على الكمبيوتر لا يتغير.
// الأزرار السفلية تستدعي أزرار الصفحة الأصلية نفسها (القائمة · الجرس) فلا يتكرر أي منطق.
function appShell(){
  var R=document.documentElement;R.classList.add('inapp');
  // بلا تكبير بالأصابع: يتصرف كتطبيق (المحتوى نفسه مهيأ لعرض الجوال)
  var vp=document.querySelector('meta[name=viewport]');if(vp&&!/maximum-scale/.test(vp.content))vp.content+=',maximum-scale=1,user-scalable=no';
  var mb=$('menuBtn');if(!mb||$('abar'))return;
  var P=location.pathname||'/',hash=location.hash;
  // عنوان قصير للقسم: نفس اسمه في قائمة «الأقسام»، وإلا أول شارة في الترويسة
  var ma=Array.prototype.filter.call(document.querySelectorAll('#menuList a'),function(a){return (a.getAttribute('href')||'')===P;})[0];
  var st=document.querySelector('header.top .stats .stat'),title=ma?(ma.querySelector('b')?ma.querySelector('b').textContent.trim():ma.textContent.replace(/^\S+\s*/,'').trim()):st?st.textContent.split(':')[0].trim():document.title.split('·')[0].trim();
  if(P==='/app')title=hash==='#prep'?'التحضير':'الرئيسية';
  var top=document.createElement('div');top.className='atop';top.id='atop';
  top.innerHTML=(P!=='/app'||hash==='#prep'?'<a class="atop-back" href="'+'/app'+'" aria-label="الرئيسية">→</a>':'<span class="atop-sp"></span>')+'<b class="atop-t">'+esc(title)+'</b><span class="atop-who" id="atopWho"></span>';
  var hd=document.querySelector('header.top');(hd&&hd.parentNode?hd.parentNode:document.body).insertBefore(top,hd||document.body.firstChild);
  var SV=function(d){return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';};
  var ICO={home:SV('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),prep:SV('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>'),
    quiz:SV('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'),bell:SV('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),menu:SV('<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>')};
  var it=function(id,ic,t,href,on){return (href?'<a':'<button type="button"')+' class="ab-i'+(on?' on':'')+'" id="'+id+'"'+(href?' href="'+href+'"':'')+'><span class="ab-ic" aria-hidden="true">'+ic+'</span><span class="ab-t">'+t+'</span>'+(id==='abBell'?'<span class="ab-dot" id="abDot" hidden></span>':'')+(href?'</a>':'</button>');};
  var nav=document.createElement('nav');nav.className='abar';nav.id='abar';nav.setAttribute('aria-label','التنقل');
  nav.innerHTML=it('abHome',ICO.home,'الرئيسية','/app',P==='/app'&&hash!=='#prep')+it('abPrep',ICO.prep,'التحضير','/app'+'#prep',P==='/app'&&hash==='#prep')+
    it('abQuiz',ICO.quiz,'الاختبارات','/quiz',P==='/quiz')+($('bellBtn')?it('abBell',ICO.bell,'الإشعارات'):'')+it('abMenu',ICO.menu,'الأقسام',null,false);
  document.body.appendChild(nav);
  // القائمة ولوحة الإشعارات داخل الترويسة المخفية على الجوال: ننقلهما إلى body لتظهرا كورقة سفلية
  ['menuList','bellPanel'].forEach(function(id){var x=$(id);if(x)document.body.appendChild(x);});
  // داخل /app: التحضير والرئيسية بلا إعادة تحميل
  if(P==='/app')['abHome','abPrep'].forEach(function(id){$(id).addEventListener('click',function(e){
    if(typeof window.appShowPrep!=='function')return;e.preventDefault();var prep=id==='abPrep';
    if(prep)window.appShowPrep();else window.appShowHome();window.scrollTo(0,0);});});
  // تُستدعى من client_app عند التبديل بين الرئيسية والتحضير (من الشريط أو من بطاقة «التحضير»)
  window.abSync=function(prep){if(!$('abHome')||P!=='/app')return;history.replaceState(null,'','/app'+(prep?'#prep':''));
    $('abHome').classList.toggle('on',!prep);$('abPrep').classList.toggle('on',prep);
    var t=document.querySelector('#atop .atop-t');if(t)t.textContent=prep?'التحضير':'الرئيسية';
    var bk=document.querySelector('#atop .atop-back,#atop .atop-sp');if(bk)bk.outerHTML=prep?'<a class="atop-back" href="'+'/app'+'" aria-label="الرئيسية">→</a>':'<span class="atop-sp"></span>';
    var nb=document.querySelector('#atop .atop-back');if(nb&&prep)nb.onclick=function(ev){ev.preventDefault();window.appShowHome();window.scrollTo(0,0);};};
  $('abMenu').addEventListener('click',function(e){e.stopPropagation();mb.click();});
  if($('abBell'))$('abBell').addEventListener('click',function(e){e.stopPropagation();$('bellBtn').click();});
  // نقطة غير المقروء والاسم من عناصر الصفحة الأصلية
  var sync=function(){var d=$('bellDot'),a=$('abDot');if(d&&a)a.hidden=d.hidden;var w=$('who'),aw=$('atopWho');if(w&&aw&&w.textContent)aw.textContent=w.textContent.split(' ').slice(0,2).join(' ');};
  sync();if(window.MutationObserver){var mo=new MutationObserver(sync);if($('bellDot'))mo.observe($('bellDot'),{attributes:true});if($('who'))mo.observe($('who'),{childList:true,characterData:true,subtree:true});}
  // شارة الترويسة إن كانت رابطًا (مثل «لوحة التحكم» ← اللوحة الشاملة بكلمة مرورها): العنوان العلوي يفتح نفس الرابط
  var tt=top.querySelector('.atop-t');
  tt.addEventListener('click',function(){var l=document.querySelector('header.top .stats a.stat-link');if(l)location.href=l.href;});
  setTimeout(function(){var l=document.querySelector('header.top .stats a.stat-link');if(l){tt.textContent=l.textContent;tt.classList.add('atop-link');tt.setAttribute('role','link');}},0);
  // ظل الشريط العلوي عند التمرير
  window.addEventListener('scroll',function(){top.classList.toggle('sh',window.scrollY>4);},{passive:true});
}
if(IN_APP){try{appShell();}catch(e){}}

// ---------- أرقام الأشكال والجداول في صور أسئلة الاختبارات النهائية ----------
// السؤال المأخوذ من امتحان نهائي يحمل في صورته رقمه الأصلي داخل اسم الشكل («الشكل ٦-١»).
// حين يأخذ السؤال رقمًا آخر في ورقة المعلم (٣ مثلًا) نرسم الرقم الجديد مكان القديم
// فيصبح «الشكل ٣-١». مواضع الأرقام (lb) تُحسب مسبقًا بـ site/tools/fin_labels.py.
// رقم السؤال المطبوع في أول الصورة («٦)») يُبيَّض عند النشر (fin_qno.py).
var FIN_FIX={},FIN_LB={},FIN_FONT='"Traditional Arabic","Simplified Arabic","Times New Roman","Noto Naskh Arabic",serif';
function finDigits(n,e){return String(n).replace(/\d/g,function(d){return e?String.fromCharCode(0x660+ +d):d;});}
function finNeedsFix(it,n){return !!(it&&it.img&&it.lb&&it.lb.length&&it.srcno&&String(it.srcno)!==String(n));}
// يعيد src المناسب الآن + سمة data-fx لتُستبدل الصورة حين يجهز الرسم
function finImgAttr(it,n,base){
  var u=(base||'')+'/fin/'+esc(it.img);
  if(!finNeedsFix(it,n))return 'src="'+u+'"';
  var k=it.img+'|'+n;FIN_LB[it.img]=it.lb;
  return 'src="'+(FIN_FIX[k]||u)+'" data-fx="'+esc(k)+'"';
}
function finRelabel(s,old,n){ // «الشكل 6-1» في النصوص (نموذج الإجابة/نص السؤال)
  if(!old||String(old)===String(n))return s;
  return String(s||'').replace(/((?:شكل|جدول)\s*\(?\s*)(\d+)(\s*[-–]\s*)(\d+)/g,function(m,a,x,dsh,y){
    if(x===String(old))return a+n+dsh+y;if(y===String(old))return a+x+dsh+n;return m;});
}
function finMake(k){
  if(FIN_FIX[k])return Promise.resolve(FIN_FIX[k]);
  var i=k.lastIndexOf('|'),img=k.slice(0,i),n=k.slice(i+1),lb=FIN_LB[img];
  if(!lb)return Promise.resolve(null);
  return new Promise(function(res){
    var im=new Image();
    im.onload=function(){
      try{
        var c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
        var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0);
        lb.forEach(function(b){
          var bx=b[0],by=b[1],bw=b[2],bh=b[3],e=b[4],bold=b[5],anchor=b[6],t=finDigits(n,e);
          var f=function(px){return (bold?'bold ':'')+px+'px '+FIN_FONT;};
          x.textAlign='left';try{x.direction='ltr';}catch(_){}x.font=f(100);var m=x.measureText(t),hh=(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)||70;
          var px=Math.max(6,100*bh/hh);x.font=f(px);m=x.measureText(t);
          var tw=(m.actualBoundingBoxLeft+m.actualBoundingBoxRight)||m.width;
          // الرقم الأطول (١٢ بدل ٦) يمتد في المسافة المجاورة دون أن يلمس الكلمة التالية
          var free=0,d=x.getImageData(0,by,c.width,bh).data,col=function(cx){for(var r=0;r<bh;r++){var o=(r*c.width+cx)*4;if(d[o]<170)return true;}return false;};
          for(var cx=anchor==='l'?bx+bw+1:bx-2;cx>=0&&cx<c.width&&free<60&&!col(cx);cx+=anchor==='l'?1:-1)free++;
          var avail=bw+Math.max(0,free-Math.max(3,bh*0.3)),sx=tw>avail?avail/tw:1,w2=tw*sx;
          var dx=anchor==='l'?bx:bx+bw-w2;
          x.fillStyle='#fff';x.fillRect(Math.min(bx,dx)-1,by-1,Math.max(bx+bw,dx+w2)-Math.min(bx,dx)+2,bh+2);
          x.fillStyle='#000';x.textBaseline='alphabetic';x.textAlign='left';try{x.direction='ltr';}catch(_){}
          x.save();x.translate(dx,by+bh-(m.actualBoundingBoxDescent||0));x.scale(sx,1);x.fillText(t,m.actualBoundingBoxLeft||0,0);x.restore();
        });
        FIN_FIX[k]=c.toDataURL('image/png');res(FIN_FIX[k]);
      }catch(err){res(null);}
    };
    im.onerror=function(){res(null);};
    im.src=location.origin+'/fin/'+img;
  });
}
// يستبدل صور الصفحة المعروضة حين يجهز رسمها
function finPatch(root){
  Array.prototype.forEach.call((root||document).querySelectorAll('img[data-fx]'),function(el){
    var k=el.getAttribute('data-fx');if(FIN_FIX[k]&&el.src===FIN_FIX[k])return;
    finMake(k).then(function(u){if(u&&el.getAttribute('data-fx')===k)el.src=u;});
  });
}
// للطباعة وملف Word: يبني الـ HTML، ويجهّز كل الصور المعدّلة، ثم يبنيه من جديد بها
function finReady(build){
  var h=build(),ks={};h.replace(/data-fx="([^"]+)"/g,function(m,k){ks[k.replace(/&amp;/g,'&')]=1;});
  var L=Object.keys(ks);if(!L.length)return Promise.resolve(h);
  return Promise.all(L.map(finMake)).then(function(){return build();});
}
