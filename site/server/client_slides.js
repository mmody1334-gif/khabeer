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
function render(){
  var el=document.getElementById('sl');if(!el)return;
  if(!SL.length){
    el.innerHTML='<div class="empty-state"><h2>لا توجد عروض تقديمية بعد</h2><p>تُضاف العروض (PowerPoint) هنا حسب المادة والصف، وستظهر تباعًا.</p></div>';
    return;
  }
  // تجميع حسب المادة ثم الصف
  var subs={};
  SL.forEach(function(s){ (subs[s.subject]=subs[s.subject]||{})[s.grade]=(subs[s.subject][s.grade]||[]).concat(s); });
  var h='';
  Object.keys(subs).sort(function(a,b){return a.localeCompare(b,'ar');}).forEach(function(subj){
    var grades=subs[subj];
    h+='<section class="sl-subj"><h2 class="sl-subj-h"><span class="mi">📽️</span> '+esc(subj)+'</h2>';
    Object.keys(grades).sort(function(a,b){return (gnum(a)-gnum(b))||a.localeCompare(b,'ar');}).forEach(function(gr){
      var list=grades[gr];
      h+='<div class="sl-grade"><div class="sl-grade-h">'+esc(gLabel(gr))+' <span class="muted small">('+list.length+')</span></div><div class="sl-grid">'+
        list.map(function(s){
          return '<button type="button" class="sl-card" data-drive="'+esc(s.drive)+'" data-name="'+esc(s.name)+'" data-unit="'+esc(s.unit||'')+'" title="فتح معاينة العرض">'+
            '<span class="sl-card-ic">📽️</span>'+
            '<span class="sl-card-t">'+esc(s.name)+'</span>'+
            '<span class="sl-card-m">'+(s.unit?esc(s.unit):'')+'</span>'+
            '<span class="sl-card-go">فتح ›</span>'+
          '</button>';
        }).join('')+'</div></div>';
    });
    h+='</section>';
  });
  el.innerHTML=h;
  Array.prototype.forEach.call(el.querySelectorAll('.sl-card'),function(b){
    b.onclick=function(){open(b.getAttribute('data-drive'),b.getAttribute('data-name'));};
  });
}
function open(d,name){
  var html='<div class="sl-prev">'+
    '<div class="sl-prev-head"><b>'+esc(name)+'</b>'+
    '<a class="btn small" href="'+esc(openUrl(d))+'" target="_blank" rel="noopener">فتح في Google Drive</a>'+
    '<a class="btn primary small" href="'+esc(downloadUrl(d))+'" download>⬇ تحميل</a></div>'+
    '<div class="sl-frame"><iframe src="'+esc(previewUrl(d))+'" title="معاينة العرض" loading="lazy" allowfullscreen></iframe></div>'+
    '<p class="muted small" style="margin:8px 0 0">المعاينة من Google Drive. إن لم تظهر فاستخدم «تحميل» أو «فتح في Google Drive». </p></div>';
  dialog({title:'عرض تقديمي',html:html,okText:'إغلاق',cancelText:false,wide:true});
  track('slides_open',name);
}
render();
})();
