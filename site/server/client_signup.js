(function(){
'use strict';
// التسجيل بالإيميل · تأكيد الرمز · استعادة كلمة المرور · صفحة انتظار التفعيل
var GR=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر'];
function gn(g){var i=GR.indexOf(g);return i<0?99:i;}
function showErr(id,msg){var e=$(id);if(!e)return;e.textContent=msg||'';e.hidden=!msg;}
function busy(btn,on,txt){if(!btn)return;if(on){btn._t=btn.textContent;btn.textContent=txt||'لحظة…';btn.disabled=true;}else{btn.textContent=btn._t||btn.textContent;btn.disabled=false;}}
function eyes(){Array.prototype.forEach.call(document.querySelectorAll('[data-eye]'),function(b){b.onclick=function(){var i=$(b.getAttribute('data-eye'));i.type=i.type==='password'?'text':'password';b.textContent=i.type==='password'?'إظهار':'إخفاء';b.setAttribute('aria-pressed',String(i.type==='text'));};});}
function cooldown(btn,sec){if(!btn)return;var n=sec;btn.disabled=true;var base=btn.getAttribute('data-l')||btn.textContent;btn.setAttribute('data-l',base);
  (function tick(){if(n<=0){btn.disabled=false;btn.textContent=base;return;}btn.textContent=base+' ('+n+')';n--;setTimeout(tick,1000);})();}
function digits(i){i.addEventListener('input',function(){var v=i.value.replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);}).replace(/\D/g,'').slice(0,6);if(i.value!==v)i.value=v;});}
// نفس بصمة الجهاز في صفحة الدخول، حتى لا يُحسب الدخول بعد التسجيل جهازًا إضافيًّا
function fingerprint(){
  var n=navigator,s=screen,str=[n.userAgent,n.platform||'',n.language||'',(n.languages||[]).join(','),s.width+'x'+s.height+'x'+(window.devicePixelRatio||1),s.colorDepth,(Intl.DateTimeFormat().resolvedOptions().timeZone||''),n.hardwareConcurrency||'',n.deviceMemory||'',n.maxTouchPoints||0].join('|');
  if(window.crypto&&crypto.subtle)return crypto.subtle.digest('SHA-256',new TextEncoder().encode(str)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2);}).join('').slice(0,40);});
  var h=0x811c9dc5,h2=0x811c9dc5,rev=str.split('').reverse().join(''),i;
  for(i=0;i<str.length;i++){h^=str.charCodeAt(i);h=(h*0x01000193)>>>0;}for(i=0;i<rev.length;i++){h2^=rev.charCodeAt(i);h2=(h2*0x01000193)>>>0;}
  var a=('00000000'+h.toString(16)).slice(-8),c=('00000000'+h2.toString(16)).slice(-8);return Promise.resolve((a+c+a+c+a).slice(0,40));
}
function signIn(email,pw){return fingerprint().then(function(fp){return api('/api/login',{username:email,password:pw,fp:fp,screen:screen.width+'×'+screen.height});});}
eyes();

// ================= التسجيل =================
var reg=$('regForm');
if(reg){
  var picked={},C=[];
  api('/api/public/courses').then(function(r){
    C=(r.courses||[]).slice().sort(function(a,b){return a.subject.localeCompare(b.subject,'ar')||(gn(a.grade)-gn(b.grade));});
    var by={},order=[];C.forEach(function(c){if(!by[c.subject]){by[c.subject]=[];order.push(c.subject);}by[c.subject].push(c);});
    $('r_courses').innerHTML=order.map(function(s){
      return '<details><summary><span>'+esc(s)+'</span><em data-cnt="'+esc(s)+'"></em></summary><div class="su-g">'+by[s].map(function(c){
        return '<label><input type="checkbox" data-k="'+esc(c.key)+'" data-s="'+esc(s)+'"> الصف '+esc(gLabel(c.grade))+'</label>';}).join('')+'</div></details>';
    }).join('')||'<span class="muted">لا توجد مواد حاليًا.</span>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-k]'),function(i){i.onchange=function(){if(i.checked)picked[i.getAttribute('data-k')]=1;else delete picked[i.getAttribute('data-k')];count();};});
  },function(e){$('r_courses').innerHTML='<span class="muted">'+esc(e.message)+'</span>';});
  function count(){
    var n=Object.keys(picked).length;$('r_count').textContent=n?('اخترت '+n+' صفًا'):'';
    Array.prototype.forEach.call(document.querySelectorAll('[data-cnt]'),function(e){var s=e.getAttribute('data-cnt'),k=0;Object.keys(picked).forEach(function(x){if(x.split('|')[0]===s)k++;});e.textContent=k?('✓ '+k):'';});
  }
  var data=null;
  function send(btn){
    return api('/api/register/start',data).then(function(r){
      $('otpTo').textContent=data.email;reg.hidden=true;$('otpForm').hidden=false;showErr('otpErr','');
      if(r.dev_code)$('otp').value=r.dev_code;
      $('otp').focus();cooldown($('resend'),60);
    });
  }
  reg.addEventListener('submit',function(e){
    e.preventDefault();showErr('regErr','');
    data={name:$('r_name').value.trim(),email:$('r_email').value.trim().toLowerCase(),phone:$('r_phone').value.trim(),password:$('r_pass').value,scope:Object.keys(picked)};
    if(data.name.length<3)return showErr('regErr','اكتب اسمك الكامل.');
    if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(data.email))return showErr('regErr','البريد الإلكتروني غير صحيح.');
    if(data.phone.replace(/\D/g,'').length<8)return showErr('regErr','اكتب رقم الجوال.');
    if(data.password.length<8)return showErr('regErr','كلمة المرور 8 أحرف على الأقل.');
    if(!data.scope.length)return showErr('regErr','اختر صفًا واحدًا على الأقل من الصفوف التي تدرّسها.');
    var b=$('regBtn');busy(b,true,'جارٍ الإرسال…');
    send(b).then(function(){busy(b,false);},function(ex){busy(b,false);showErr('regErr',ex.message);});
  });
  digits($('otp'));
  $('resend').onclick=function(){var b=$('resend');b.disabled=true;send().catch(function(ex){showErr('otpErr',ex.message);b.disabled=false;});};
  $('editData').onclick=function(){$('otpForm').hidden=true;reg.hidden=false;};
  $('otpForm').addEventListener('submit',function(e){
    e.preventDefault();showErr('otpErr','');
    var code=$('otp').value;if(code.length!==6)return showErr('otpErr','الرمز 6 أرقام.');
    var b=$('otpBtn');busy(b,true,'جارٍ التأكيد…');
    api('/api/register/verify',{email:data.email,code:code}).then(function(){
      b.textContent='تم إنشاء الحساب ✓';
      return signIn(data.email,data.password).then(function(){location.href='/pending';},function(){location.href='/';});
    },function(ex){busy(b,false);showErr('otpErr',ex.message);});
  });
}

// ================= نسيت كلمة المرور =================
var fg=$('fgForm');
if(fg){
  var fe='';
  function fsend(){return api('/api/reset/start',{email:fe}).then(function(r){$('fgTo').textContent=fe;fg.hidden=true;$('fg2Form').hidden=false;if(r.dev_code)$('f_code').value=r.dev_code;$('f_code').focus();cooldown($('fgResend'),60);});}
  fg.addEventListener('submit',function(e){e.preventDefault();showErr('fgErr','');fe=$('f_email').value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(fe))return showErr('fgErr','البريد الإلكتروني غير صحيح.');
    var b=$('fgBtn');busy(b,true,'جارٍ الإرسال…');fsend().then(function(){busy(b,false);},function(ex){busy(b,false);showErr('fgErr',ex.message);});});
  digits($('f_code'));
  $('fgResend').onclick=function(){$('fgResend').disabled=true;fsend().catch(function(ex){showErr('fg2Err',ex.message);$('fgResend').disabled=false;});};
  $('fg2Form').addEventListener('submit',function(e){e.preventDefault();showErr('fg2Err','');
    var pw=$('f_pass').value;if(pw.length<8)return showErr('fg2Err','كلمة المرور 8 أحرف على الأقل.');
    var b=$('fg2Btn');busy(b,true,'جارٍ الحفظ…');
    api('/api/reset/verify',{email:fe,code:$('f_code').value,password:pw}).then(function(){b.textContent='تم ✓ جارٍ الدخول…';
      return signIn(fe,pw).then(function(r){location.href=r.role==='admin'?'/admin':'/app';},function(){location.href='/';});
    },function(ex){busy(b,false);showErr('fg2Err',ex.message);});});
}

// ================= انتظار التفعيل =================
var pend=$('pendBody');
if(pend){
  $('pendOut').onclick=logout;
  var img='';
  function dt(t){return t?new Date(t).toLocaleDateString('ar-OM',{day:'numeric',month:'long',year:'numeric'}):'';}
  function shrink(file){return new Promise(function(res,rej){
    if(!/^image\//.test(file.type))return rej(new Error('اختر صورة (لقطة شاشة أو صورة الإيصال).'));
    var fr=new FileReader();fr.onerror=function(){rej(new Error('تعذّرت قراءة الصورة.'));};
    fr.onload=function(){var im=new Image();im.onerror=function(){rej(new Error('تعذّرت قراءة الصورة.'));};im.onload=function(){
      var m=1400,w=im.width,h=im.height,k=Math.min(1,m/Math.max(w,h));var c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);var q=.82,u=c.toDataURL('image/jpeg',q);while(u.length>1300000&&q>.4){q-=.12;u=c.toDataURL('image/jpeg',q);}res(u);};im.src=fr.result;};
    fr.readAsDataURL(file);});}
  function render(s){
    if(s.active){location.href='/app';return;}
    var P=s.payment,I=s.info||{},h='';
    if(P&&P.status==='pending')h+='<div class="st wait">⏳<div><b>إيصالك قيد المراجعة</b>رفعته '+esc(fmtDate(P.created_at))+'. ستُفتح لك المواد بمجرد تأكيد التحويل، ويصلك بريد بذلك.</div></div>';
    else if(P&&P.status==='rejected')h+='<div class="st bad">⚠️<div><b>لم يُقبل الإيصال الأخير</b>'+esc(P.reason||'')+' — ارفع إيصالًا صحيحًا من جديد.</div></div>';
    else if(s.expired)h+='<div class="st bad">⌛<div><b>انتهى اشتراكك</b>انتهى في '+esc(dt(s.paid_until))+'. جدّد الاشتراك للفصل الجديد لتعود المواد.</div></div>';
    else h+='<div class="st wait">👋<div><b>أهلًا '+esc(s.name)+'، حسابك جاهز</b>باقي خطوة واحدة: حوّل قيمة الاشتراك وارفع صورة الإيصال، وتُفتح لك المواد بعد التأكيد.</div></div>';
    if(s.req_scope&&s.req_scope.length)h+='<div class="sub">الصفوف التي طلبتها:</div><div class="su-chips">'+s.req_scope.map(function(k){var p=String(k).split('|');return '<span>'+esc(p[0])+' — '+esc(gLabel(p[1]))+'</span>';}).join('')+'</div>';
    if(!(P&&P.status==='pending')){
      h+='<h3 style="margin:6px 0 2px;font-size:1rem">بيانات التحويل</h3><div class="su-pay">'+(I.price?'<span class="pr">قيمة الاشتراك: '+esc(I.price)+'</span>':'')+(I.details?esc(I.details):'<span class="muted">ستضيف الإدارة بيانات التحويل قريبًا. تواصل معنا عبر واتساب.</span>')+'</div>';
      h+='<div class="su-up"><label class="drop" for="rcpt" id="drop"><span style="font-size:1.6rem">🧾</span><span>اضغط لاختيار صورة الإيصال</span></label><input type="file" id="rcpt" accept="image/*" hidden>'+
        '<textarea id="rnote" maxlength="300" placeholder="ملاحظة (اختياري): اسم المحوِّل، رقم العملية…"></textarea>'+
        '<div class="err" id="upErr" role="alert" hidden></div><button type="button" class="btn primary go" id="upBtn" disabled>إرسال الإيصال للمراجعة</button></div>';
    }
    if(I.whatsapp)h+='<a class="su-wa" target="_blank" rel="noopener" href="https://wa.me/'+esc(String(I.whatsapp).replace(/\D/g,''))+'?text='+encodeURIComponent('السلام عليكم، أنا '+s.name+' ('+s.email+') سجّلت في منصة خبير وأريد تفعيل اشتراكي.')+'">💬 تواصل معنا على واتساب</a>';
    pend.innerHTML=h;
    var f=$('rcpt');if(!f)return;
    f.onchange=function(){showErr('upErr','');var fl=f.files&&f.files[0];if(!fl)return;
      shrink(fl).then(function(u){img=u;$('drop').innerHTML='<img alt="الإيصال" src="'+u+'"><span>اضغط لتغيير الصورة</span>';$('upBtn').disabled=false;},function(e){showErr('upErr',e.message);});};
    $('upBtn').onclick=function(){var b=$('upBtn');busy(b,true,'جارٍ الرفع…');
      api('/api/pay/receipt',{img:img,note:$('rnote').value}).then(function(){toast('وصل الإيصال ✓');load();},function(e){busy(b,false);showErr('upErr',e.message);});};
  }
  function load(){return api('/api/pay/status').then(render,function(e){pend.innerHTML='<p class="err">'+esc(e.message)+'</p>';});}
  load();
  // نتحقق كل دقيقة: لو فعّل المدير الحساب تنتقل الصفحة تلقائيًّا
  setInterval(function(){if(!document.hidden)api('/api/pay/status').then(function(s){if(s.active)location.href='/app';},function(){});},60000);
}
})();
