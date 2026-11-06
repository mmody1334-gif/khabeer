// ==UserScript==
// @name         لصق التحضير والواجب - نور (خبير)
// @namespace    https://tahdir-al-aali.local/
// @version      3.5.0
// @description  يرسل التحضير والواجب من موقع خبير إلى نور: يفتح صفحة الصف، يختار الدرس، ويملأ الحقول. لا يضغط حفظ أبدًا.
// @author       خبير
// @match        https://lms.moe.gov.om/*
// @match        https://lms.moe.gov.om/teacher
// @match        https://tahdir.hudhaifa-bio.workers.dev/*
// @match        https://khaber.site/*
// @match        https://www.khaber.site/*
// @match        https://khabeer.khabeer.workers.dev/*
// @match        https://elkabsula.me/*
// @match        https://www.elkabsula.me/*
// @match        https://elkabsula.com/*
// @match        https://www.elkabsula.com/*
// @match        https://elkabsula.works/*
// @match        https://www.elkabsula.works/*
// @match        https://elkabsula.site/*
// @match        https://www.elkabsula.site/*
// @match        https://elkabsula.online/*
// @match        https://www.elkabsula.online/*
// @match        https://elkabsula.tech/*
// @match        https://www.elkabsula.tech/*
// @match        https://elkabsula.studio/*
// @match        https://www.elkabsula.studio/*
// @match        https://alkabsula.com/*
// @match        https://www.alkabsula.com/*
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @updateURL    https://khaber.site/tool/tahdir-noor.user.js
// @downloadURL  https://khaber.site/tool/tahdir-noor.user.js
// @run-at       document-start
// ==/UserScript==

// سبب @run-at document-start: بعض إعدادات Chrome تحقن الأداة قبل وجود documentElement،
// فكانت تفشل من أول تحميل ولا تعمل إلا بعد فتح/تحديث صفحة أخرى. الآن ننتظر جاهزية المستند أولًا.
(function () {
  'use strict';
  // ===== طبقة توافق لمديري السكربتات الذين لا يوفّرون GM_* المتزامنة =====
  // Userscripts (مجاني على iOS/macOS) يوفّر GM.setValue/GM.getValue **غير المتزامنة**
  // فقط. والمهمة تُحفظ على المنصة وتُقرأ على نور — أي **بين أصلين مختلفين**؛ ولهذا
  // لا يصلح localStorage (معزول لكل أصل) وإلا فقدها نور.
  // الحل: نُحمّل قيم التخزين المشترك في الذاكرة عند البدء (await)، ثم نخدم
  // GM_getValue متزامنةً من الذاكرة، ونكتب في الاتجاهين (ذاكرة + GM.setValue).
  (function gmCompat(){
    try{
      const g = (typeof globalThis!=='undefined')?globalThis:window;
      const P = 'tahdir_noor_';
      const hasGM = !!(g.GM && typeof g.GM.getValue === 'function');
      const cache = Object.create(null);
      // إن كان المدير يوفّر المتزامنة أصلًا (Tampermonkey) فلا حاجة لأي شيء
      if (typeof g.GM_getValue === 'function') { g.__TAHDIR_READY = Promise.resolve(); return; }

      let ready;
      if (hasGM) {
        // تحميل كل مفاتيحنا المشتركة مرة واحدة قبل تشغيل الأداة
        ready = Promise.resolve()
          .then(() => (typeof g.GM.listValues === 'function' ? g.GM.listValues() : []))
          .then(keys => Promise.all((keys || [])
            .filter(k => /^tahdir/.test(k))
            .map(k => g.GM.getValue(k).then(v => { if (v !== undefined && v !== null) cache[k] = v; }).catch(() => {}))))
          .catch(() => {});
      } else {
        // لا GM إطلاقًا: أفضل بديل متاح (نفس الأصل فقط)
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.indexOf(P) === 0) { try { cache[k.slice(P.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) {} }
          }
        } catch (e) {}
        ready = Promise.resolve();
      }

      if (typeof g.GM_getValue !== 'function') g.GM_getValue = function (k, d) {
        return (k in cache) ? cache[k] : d;
      };
      if (typeof g.GM_setValue !== 'function') g.GM_setValue = function (k, v) {
        cache[k] = v;
        try { if (hasGM) g.GM.setValue(k, v); else localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {}
      };
      if (typeof g.GM_deleteValue !== 'function') g.GM_deleteValue = function (k) {
        delete cache[k];
        try { if (hasGM) g.GM.deleteValue(k); else localStorage.removeItem(P + k); } catch (e) {}
      };
      if (typeof g.GM_registerMenuCommand !== 'function') g.GM_registerMenuCommand = function () {};
      // فتح التبويب: نُفضّل GM.openInTab غير المتزامنة (Userscripts على iOS/سافاري)
      // لأن سافاري يحجب window.open إذا لم يكن ناتجًا عن لمسة مباشرة.
      if (typeof g.GM_openInTab !== 'function') g.GM_openInTab = function (u, o) {
        try { if (g.GM && typeof g.GM.openInTab === 'function') { g.GM.openInTab(u, !(o && o.active)); return; } } catch (e) {}
        try { window.open(u, '_blank'); } catch (e) {}
      };
      g.__TAHDIR_READY = ready;
    }catch(e){}
  })();
  const VERSION = '3.5.0';
  const MIN_REQUIRED = '3.1.0'; // أقل إصدار يُجبر الموقع المعلمين عليه (ميزات جديدة لا تفرض تحديثًا على الجميع)

  function boot() {
  const uw = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const PENDING_KEY = 'tahdir_pending_hw';
  const PREP_KEY = 'tahdir_pending_prep';
  // **استقبال المهمة من الرابط**: إن جاء نور برابط يحمل #tahdir=… فكّ الترميز
  // واحفظها كأنها وصلت عبر التخزين، ثم نظّف الرابط. هذا يجعل النقل بين المنصة
  // ونور يعمل بلا اعتماد على تخزين مشترك بين المواقع (شرط عملها على سافاري/iOS).
  // ملاحظة: تغيير الهاش وحده لا يُعيد تحميل الصفحة (same-document navigation)،
  // فنستمع أيضًا لحدث hashchange لتعمل لو كان نور مفتوحًا بالفعل.
  function takeJobFromHash() {
    try {
      const m = /[#&]tahdir=([^&]+)/.exec(location.hash || '');
      if (!m) return false;
      const json = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));
      const data = JSON.parse(json);
      if (data && data.source === 'tahdir-al-aali') {
        const key = data.kind === 'homework' ? PENDING_KEY : PREP_KEY;
        // «تم التوجيه» فقط لو الرابط أوصلنا لصفحة الهدف نفسها. أما لو فتح الرئيسية (/teacher) —
        // وهذا ما يحدث دائمًا على الآيفون لأن الموقع لا يعرف رقم الصف في نور — فنترك التوجيه يكمل.
        const onTarget = data.kind === 'homework'
          ? /\/(homeworks\/(create|edit|add)|questions\/add_bulk_questions)\//.test(location.pathname)
          : /\/courses\/add_preparation\//.test(location.pathname);
        GM_setValue(key, { data: data, ts: Date.now(), routed: onTarget });
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        return true;
      }
    } catch (e) {}
    return false;
  }
  takeJobFromHash();
  // نور مفتوح بالفعل ووصل رابط جديد: نستلم المهمة ونكمل التوجيه
  window.addEventListener('hashchange', function () { if (takeJobFromHash() && location.hostname === 'lms.moe.gov.om' && typeof routeIfNeeded === 'function') { try { routeIfNeeded(); } catch (e) {} } });
  const CID_KEY = 'tahdir_last_cid';
  const GRADES_KEY = 'tahdir_grade_cids';
  const TASKS_KEY = 'tahdir_nour_tasks';   // المهام الإلكترونية التي قرأتها الأداة من نور (لكل صف)
  const JOB_KEY = 'tahdir_grade_job';      // مهمة تصحيح جارية
  const FETCH_KEY = 'tahdir_fetch_tasks';  // طلب من الموقع لجلب مهام صف معيّن
  const NOUR = 'https://lms.moe.gov.om';
  const MAX_AGE = 3 * 60 * 60 * 1000; // الواجب المُرسل يبقى صالحًا 3 ساعات

  // ---------- مشترك ----------
  function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function showToast(msg, actionText, onAction, ms) {
    const t = document.createElement('div');
    Object.assign(t.style, { position: 'fixed', bottom: '70px', left: '20px', zIndex: 999999, background: '#132420', color: '#fff', padding: '10px 16px', borderRadius: '8px', fontFamily: 'Tahoma, sans-serif', fontSize: '13px', maxWidth: '340px', direction: 'rtl', lineHeight: '1.7' });
    const span = document.createElement('span'); span.textContent = msg; t.appendChild(span);
    if (actionText) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = actionText;
      Object.assign(b.style, { marginRight: '10px', background: '#fff', color: '#132420', border: 'none', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' });
      b.onclick = () => { t.remove(); onAction(); };
      t.appendChild(b);
    }
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 4500);
  }
  function validPayload(data, kind) {
    return data && data.source === 'tahdir-al-aali' && ((kind === 'homework') === (data.kind === 'homework'));
  }
  function getPending(key) {
    key = key || PENDING_KEY;
    if (typeof GM_getValue === 'undefined') return null;
    const p = GM_getValue(key, null);
    if (!p || !p.data || Date.now() - p.ts > MAX_AGE) { if (p) GM_deleteValue(key); return null; }
    return p;
  }
  function clearPending(key) { if (typeof GM_deleteValue !== 'undefined') GM_deleteValue(key || PENDING_KEY); }
  // رابط الصفحة المطلوبة لهذا الصف في نور
  function subjKey(subject, grade) { subject = String(subject || '').replace(/لغتي الجميلة|المؤنس و المفيد|المؤنس والمفيد|المؤنس|المفيد/g, 'اللغة العربية'); grade = String(grade || '').replace(/^الصف\s+/, ''); return String(subject || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, '') + '|' + grade; }
  // مفتاح المادة بدون «ال» (نور قد يكتب «كيمياء» أو «الكيمياء»)
  function subjKey2(subject, grade) { subject = String(subject || '').replace(/لغتي الجميلة|المؤنس و المفيد|المؤنس والمفيد|المؤنس|المفيد/g, 'اللغة العربية'); grade = String(grade || '').replace(/^الصف\s+/, ''); return String(subject || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/(^|\s)ال/g, '$1').replace(/\s+/g, '') + '|' + grade; }
  function cidFor(map, grade, subject) {
    if (!subject) return map[grade];
    const hit = map[subjKey(subject, grade)] || map[subjKey2(subject, grade)];
    if (hit) return hit;
    // لا نخلط المواد: نرجع لرقم الصف فقط إذا لم نتعرّف على أي مادة أخرى لهذا الصف
    const others = Object.keys(map).filter(k => k.indexOf('|') > 0 && k.split('|')[1] === grade);
    return others.length ? null : map[grade];
  }
  function routeUrl(kind, grade, subject) {
    const map = GM_getValue(GRADES_KEY, {}) || {};
    const cid = cidFor(map, grade, subject);
    if (!cid) return NOUR + '/teacher';
    return NOUR + (kind === 'prep' ? '/teacher/courses/add_preparation/cid:' : '/teacher/homeworks/create/cid:') + cid;
  }

  // ================= على موقع خبير =================
  // نطاقات الموقع: العامل المجاني (workers.dev) والنطاقات الخاصة — كلها تعمل
  // حتى لا تتعطّل الأداة عند من يُثبّتها من أحدهما.
  if (location.hostname === 'tahdir.hudhaifa-bio.workers.dev' || location.hostname === 'khabeer.khabeer.workers.dev' || location.hostname === 'khaber.site' || location.hostname === 'www.khaber.site' || /(^|\.)(el|al)kabsula\.(me|com|works|site|online|tech|studio)$/.test(location.hostname)) {
    // لو عند المعلم نسخة قديمة مكررة من الأداة، الإصدار الأحدث هو اللي يظهر للموقع دائمًا
    const de = document.documentElement;
    if (!de) return; // لم يجهز المستند بعد (بعض إعدادات الحقن المبكر): لا نرمي استثناءً
    const vcmp = (a, b) => { a = String(a || '').split('.'); b = String(b || '').split('.'); for (let i = 0; i < 3; i++) { const d = (parseInt(a[i], 10) || 0) - (parseInt(b[i], 10) || 0); if (d) return d; } return 0; };
    const claim = () => {
      const cur = de.getAttribute('data-tahdir-tool');
      if (cur && vcmp(cur, VERSION) > 0) return; // نسخة أحدث موجودة: هي المسؤولة
      if (cur && cur !== VERSION) de.setAttribute('data-tahdir-tool-old', cur);
      if (cur !== VERSION) de.setAttribute('data-tahdir-tool', VERSION);
    };
    claim();
    new MutationObserver(claim).observe(de, { attributes: true, attributeFilter: ['data-tahdir-tool'] });
    function onSend(kind, e) {
      if (de.getAttribute('data-tahdir-tool') !== VERSION) return; // نسخة أحدث ستتولى الإرسال
      let data;
      try { data = JSON.parse(String(e.detail)); } catch (err) { return; }
      // نسختان بنفس الإصدار: واحدة فقط تنفّذ الإرسال
      const nonce = String(data && data.nonce || '');
      if (nonce) { if (de.getAttribute('data-tahdir-last') === nonce) return; de.setAttribute('data-tahdir-last', nonce); }
      if (kind === 'hw' && (!validPayload(data, 'homework') || !Array.isArray(data.items) || !data.items.length)) return;
      if (kind === 'prep' && (!data || data.source !== 'tahdir-al-aali' || data.kind === 'homework')) return;
      GM_setValue(kind === 'prep' ? PREP_KEY : PENDING_KEY, { data: data, ts: Date.now(), routed: false });
      document.dispatchEvent(new CustomEvent('tahdir-' + kind + '-ack'));
      // نفتح نور مباشرة على صفحة هذا الصف (أو الرئيسية أول مرة لنتعرف على أرقام الصفوف)
      let url = routeUrl(kind, data.grade || '', data.subject || '');
      // **نقل المهمة داخل الرابط** كمسار مضمون لا يعتمد على التخزين المشترك بين
      // المواقع (سافاري/iOS قد لا يوفّره). نور يقرأ الهاش عند الإقلاع فيتصرّف.
      try {
        const json = JSON.stringify(data);
        const b64 = btoa(unescape(encodeURIComponent(json)));
        if (b64.length < 60000) url += (url.indexOf('#') >= 0 ? '&' : '#') + 'tahdir=' + encodeURIComponent(b64);
      } catch (e) {}
      GM_openInTab(url, { active: true });
    }
    // ---- التصحيح التلقائي: الموقع يطلب المهام المحفوظة، أو جلبها من نور، أو بدء التصحيح ----
    const reply = (type, obj) => document.dispatchEvent(new CustomEvent('tahdir-' + type, { detail: JSON.stringify(obj) }));
    const mine = () => de.getAttribute('data-tahdir-tool') === VERSION;
    document.addEventListener('tahdir-v3-get-tasks', () => { if (mine()) reply('tasks', { tasks: GM_getValue(TASKS_KEY, {}) || {}, job: GM_getValue(JOB_KEY, null) }); });
    document.addEventListener('tahdir-v3-fetch-tasks', e => {
      if (!mine()) return; let d; try { d = JSON.parse(String(e.detail)); } catch (x) { return; }
      const map = GM_getValue(GRADES_KEY, {}) || {}, cid = cidFor(map, d.grade || '', d.subject || '');
      GM_setValue(FETCH_KEY, { grade: d.grade || '', subject: d.subject || '', ts: Date.now() });
      reply('fetch-ack', { cid: cid || '' });
      GM_openInTab(cid ? NOUR + '/teacher/homeworks/index/cid:' + cid : NOUR + '/teacher', { active: true });
    });
    document.addEventListener('tahdir-v3-grade', e => {
      if (!mine()) return; let d; try { d = JSON.parse(String(e.detail)); } catch (x) { return; }
      if (!d || !/^https:\/\/lms\.moe\.gov\.om\/teacher\/lectures\/submissions\//.test(String(d.subUrl || ''))) return;
      const aid = (String(d.subUrl).match(/\/aid:([^/?#]+)/) || [])[1] || '';
      GM_setValue('tahdir_grade_autosave', d.autosave !== false); GM_setValue('tahdir_grade_comment', String(d.comment || 'أحسنت').slice(0, 300));
      GM_setValue(JOB_KEY, { subUrl: d.subUrl, aid: aid, title: String(d.title || ''), comment: String(d.comment || 'أحسنت').slice(0, 300), visited: [], queue: null, filled: 0, saved: 0, ts: Date.now(), active: true, autosave: d.autosave !== false });
      reply('grade-ack', { ok: true });
      GM_openInTab(d.subUrl, { active: true });
    });
    // أسماء أحداث جديدة: النسخ القديمة (حتى 3.0) لا تسمعها فلا تفتح نور مرتين
    document.addEventListener('tahdir-v3-send-hw', e => onSend('hw', e));
    document.addEventListener('tahdir-v3-send-prep', e => onSend('prep', e));
    document.addEventListener('tahdir-send-hw', e => onSend('hw', e));
    document.addEventListener('tahdir-send-prep', e => onSend('prep', e));
    return;
  }

  // ================= على منصة نور =================
  const path = location.pathname;
  // الصفحة الرئيسية لنور هي /teacher (بدون شرطة أخيرة) — نعمل عليها أيضًا. صفحات الدخول وغيرها: لا شيء.
  if (!/^\/teacher(\/|$)/.test(path)) return;
  const IS_HW = /\/questions\/add_bulk_questions\//.test(path);
  const IS_PREP = /\/courses\/add_preparation\//.test(path);
  const IS_TASK = /\/homeworks\/(create|edit|add)\//.test(path);
  const IS_HWLIST = /\/homeworks\/index\//.test(path);
  const IS_SUBS = /\/lectures\/submissions\//.test(path);
  const IS_MARK = /\/lectures\/mark_submission\//.test(path);
  const cidMatch = path.match(/\/cid:([^/]+)/);
  if (cidMatch && typeof GM_setValue !== 'undefined') GM_setValue(CID_KEY, cidMatch[1]);
  const GRADE_RE = /(الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي\s*عشر|الثاني\s*عشر)\s*$/;
  function learnGrades() {
    const map = GM_getValue(GRADES_KEY, {}) || {};
    let changed = false;
    document.querySelectorAll('a[href*="cid:"]').forEach(a => {
      const t = (a.textContent || '').trim().replace(/\s+/g, ' ');
      const m = t.match(GRADE_RE), c = (a.getAttribute('href') || '').match(/cid:([^/?#]+)/);
      if (m && c) {
        const g = m[1].replace(/\s+/g, ' '), subj = t.split('/')[0].trim();
        if (map[g] !== c[1]) { map[g] = c[1]; changed = true; }
        if (subj && subj !== t) { [subjKey(subj, g), subjKey2(subj, g)].forEach(k => { if (map[k] !== c[1]) { map[k] = c[1]; changed = true; } }); }
      }
    });
    if (changed) GM_setValue(GRADES_KEY, map);
    return map;
  }
  const BUSY = IS_HW || IS_PREP || IS_TASK; // صفحات شغل: لا نغادرها تلقائيًا
  // نور يضيف روابط الصفوف (القائمة الجانبية) بعد تحميل الصفحة، فننتظرها حتى 10 ثوانٍ
  async function learnGradesWait(grade, ms) {
    let map = learnGrades();
    for (let i = 0; i < (ms || 10000) / 300 && !(grade ? map[grade] : Object.keys(map).length); i++) {
      await sleep(300); map = learnGrades();
    }
    return map;
  }
  // توجيه تلقائي مرة واحدة بعد الإرسال من الموقع — لا يعيدك للرئيسية أبدًا
  async function routeIfNeeded() {
    for (const [kind, key] of [['prep', PREP_KEY], ['hw', PENDING_KEY]]) {
      const p = getPending(key);
      if (!p || p.routed) continue;
      p.routed = true; GM_setValue(key, p); // مرة واحدة فقط مهما حدث
      const grade = p.data.grade || '', subject = p.data.subject || '';
      const map = await learnGradesWait(grade, 10000);
      if (cidFor(map, grade, subject)) { location.href = routeUrl(kind, grade, subject); return true; }
      // على الجوال قد تكون قائمة الصفوف مخفية فلا نجدها. نطلب من المعلم فتح الصف مرة واحدة،
      // وعند فتحه نسأله «هل هذا الصف؟» ثم نكمل ونحفظ رقمه للمرات القادمة.
      p.needCourse = Date.now(); GM_setValue(key, p);
      showCourseBar(kind, p, null);
      return false;
    }
    return false;
  }
  // شريط «افتح الصف» / «هل هذا الصف؟» — يظهر فقط والمهمة تنتظر اختيار الصف (خلال 30 دقيقة)
  function showCourseBar(kind, p, cid) {
    if (document.getElementById('tahdir-course-bar')) return;
    const grade = p.data.grade || '', subject = p.data.subject || '', label = (subject ? subject + ' / ' : '') + grade;
    const bar = document.createElement('div'); bar.id = 'tahdir-course-bar';
    Object.assign(bar.style, { position: 'fixed', left: '10px', right: '10px', bottom: '14px', zIndex: 999999, background: '#132420', color: '#fff', padding: '12px 14px', borderRadius: '12px', fontFamily: 'Tahoma, sans-serif', fontSize: '14px', direction: 'rtl', lineHeight: '1.8', boxShadow: '0 8px 30px rgba(0,0,0,.35)' });
    const txt = document.createElement('div');
    txt.textContent = cid
      ? 'هل هذا صف «' + label + '»؟ اضغط «متابعة» لأفتح ' + (kind === 'prep' ? '«إضافة تحضير»' : '«إضافة مهمة»') + ' له وأملأ «' + (p.data.title || '') + '».'
      : 'لم أجد «' + label + '» في قائمة صفوفك هنا. افتح هذا الصف من قائمة نور (☰ ← المقررات)، وأنا أكمل تلقائيًا.';
    bar.appendChild(txt);
    const row = document.createElement('div'); Object.assign(row.style, { display: 'flex', gap: '8px', marginTop: '8px' });
    const mk = (t, primary, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; Object.assign(b.style, { flex: primary ? '1' : '0 0 auto', background: primary ? '#1f8a70' : 'transparent', color: '#fff', border: '1px solid ' + (primary ? '#1f8a70' : '#5d7a72'), borderRadius: '8px', padding: '8px 12px', fontFamily: 'inherit', fontSize: '14px', cursor: 'pointer' }); b.onclick = fn; row.appendChild(b); };
    if (cid) mk('متابعة ←', true, () => {
      const map = GM_getValue(GRADES_KEY, {}) || {};
      if (grade) { map[grade] = cid; if (subject) { map[subjKey(subject, grade)] = cid; map[subjKey2(subject, grade)] = cid; } GM_setValue(GRADES_KEY, map); }
      delete p.needCourse; p.routed = true; GM_setValue(kind === 'prep' ? PREP_KEY : PENDING_KEY, p);
      location.href = NOUR + (kind === 'prep' ? '/teacher/courses/add_preparation/cid:' : '/teacher/homeworks/create/cid:') + cid;
    });
    mk('إلغاء', false, () => { delete p.needCourse; GM_setValue(kind === 'prep' ? PREP_KEY : PENDING_KEY, p); bar.remove(); });
    bar.appendChild(row); document.body.appendChild(bar);
  }
  function courseBarIfWaiting() {
    if (!cidMatch) return;
    for (const [kind, key] of [['prep', PREP_KEY], ['hw', PENDING_KEY]]) {
      const p = getPending(key);
      if (p && p.needCourse && Date.now() - p.needCourse < 30 * 60 * 1000) { showCourseBar(kind, p, cidMatch[1]); return true; }
    }
    return false;
  }
  // وصلنا لصفحة الهدف: لا توجيه مرة أخرى
  [['prep', PREP_KEY, IS_PREP], ['hw', PENDING_KEY, IS_TASK || IS_HW]].forEach(([k, key, here]) => {
    const p = here && getPending(key);
    if (p && !p.routed) { p.routed = true; GM_setValue(key, p); }
  });

  function readPayload(expectKind) {
    const msg = expectKind === 'homework'
      ? 'الصق هنا الواجب الذي نسخته من موقع «خبير» (زر «نسخ للأداة»):'
      : 'الصق هنا التحضير الذي نسخته من موقع «خبير» (زر «نسخ JSON لأداة نور»):';
    const text = prompt(msg, '');
    if (text === null) return null;
    if (!text.trim()) { alert('لم يتم لصق أي نص.'); return null; }
    let data;
    try { data = JSON.parse(text); } catch (e) { alert('النص الملصوق غير صحيح. انسخه مرة أخرى من الزر المخصص في موقع «خبير».'); return null; }
    if (data.source !== 'tahdir-al-aali') { alert('هذا النص لم يُنسخ من موقع «خبير».'); return null; }
    const isHw = data.kind === 'homework';
    if (expectKind === 'homework' && !isHw) { alert('هذا تحضير وليس واجبًا. انسخ من تبويب «الواجب الإلكتروني» في الموقع.'); return null; }
    if (expectKind !== 'homework' && isHw) { alert('هذا واجب وليس تحضيرًا. الصقه في صفحة «إضافة مجموعة مفردات دفعة واحدة».'); return null; }
    return data;
  }
  function setVal(el, v) {
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? uw.HTMLTextAreaElement.prototype : uw.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    return true;
  }

  // ---------- شريط «واجب جاهز» في صفحات نور ----------
  function showPendingBar(p) {
    if (IS_HW || document.getElementById('tahdir-pending-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'tahdir-pending-bar';
    Object.assign(bar.style, { position: 'fixed', top: '0', left: '0', right: '0', zIndex: 999998, background: '#0e7c66', color: '#fff', padding: '9px 16px', fontFamily: 'Tahoma, sans-serif', fontSize: '13.5px', direction: 'rtl', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 2px 10px rgba(0,0,0,.2)' });
    const txt = document.createElement('span');
    txt.style.flex = '1';
    txt.textContent = '📝 واجب جاهز للإضافة: «' + (p.data.title || '') + '» (' + p.data.items.length + ' سؤال). ' + (p.formDone
      ? 'احفظ المهمة، ثم افتح «إضافة مجموعة مفردات دفعة واحدة» وستُضاف الأسئلة تلقائيًا.'
      : 'اضغط «إضافة نشاط / تقويم جديد» وسأملأ العنوان والتسليم والتحضير والروزنامة والفصول، ثم الأسئلة في صفحة «إضافة مجموعة مفردات دفعة واحدة».');
    bar.appendChild(txt);
    const bulk = document.querySelector('a[href*="/questions/add_bulk_questions/"]');
    const btnCss = { background: '#fff', color: '#0e7c66', border: 'none', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', textDecoration: 'none' };
    if (bulk) {
      const go = document.createElement('a'); go.href = bulk.getAttribute('href'); go.textContent = 'افتح صفحة الإضافة الآن';
      Object.assign(go.style, btnCss); bar.appendChild(go);
    }
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'إلغاء الواجب';
    Object.assign(cancel.style, btnCss, { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.6)' });
    cancel.onclick = () => { clearPending(); bar.remove(); showToast('تم إلغاء الواجب المُرسل.'); };
    bar.appendChild(cancel);
    document.body.appendChild(bar);
  }

  // ---------- الواجب: صفحة إضافة مجموعة مفردات دفعة واحدة ----------
  function rowsOf(kind) { // kind: 'short' (مقالي) أو 'mcq' (اختيار من متعدد)
    return Array.from(document.querySelectorAll('tr[id^="row_"]')).filter(tr => {
      const t = tr.querySelector('input[name^="data[type]"]');
      return t && t.value === kind;
    });
  }
  function essayRows() { return rowsOf('short'); }
  function jq(el, ev) { // أحداث نور مربوطة بـ jQuery
    if (uw.jQuery) uw.jQuery(el).trigger(ev); else el.dispatchEvent(new Event(ev, { bubbles: true }));
  }
  function rowIndex(tr) { return tr.id.replace('row_', ''); }
  async function fillHomework(data) {
    const items = (data.items || []).filter(x => x && String(x.text || '').trim());
    if (!items.length) { alert('الواجب لا يحتوي على أسئلة.'); return -1; }
    for (let i = 0; i < 50 && !document.getElementById('essay_btn'); i++) await sleep(100);
    const btnOf = { short: document.getElementById('essay_btn'), mcq: document.getElementById('mcq_btn') };
    const free = {};
    ['short', 'mcq'].forEach(k => { free[k] = rowsOf(k).filter(tr => { const h = document.getElementById('text_' + rowIndex(tr)); return h && !h.value.trim(); }); });
    let filled = 0;
    for (const it of items) {
      const kind = it.type === 'mcq' ? 'mcq' : 'short';
      const addBtn = btnOf[kind];
      if (!addBtn) { alert('لم أجد زر ' + (kind === 'mcq' ? '«متعدد الاختيارات»' : '«إضافة مفردة مقالية»') + ' في هذه الصفحة.'); return filled || -1; }
      let tr = free[kind].shift();
      if (!tr) {
        const before = rowsOf(kind).length;
        addBtn.click();
        for (let i = 0; i < 20 && rowsOf(kind).length === before; i++) await sleep(100);
        const rows = rowsOf(kind);
        tr = rows[rows.length - 1];
        if (!tr || rows.length === before) break;
      }
      const i = rowIndex(tr);
      const html = String(it.text).split(/\n+/).map(p => '<p>' + escHtml(p) + '</p>').join('');
      const ok1 = setVal(document.getElementById('text_' + i), html);
      setVal(document.getElementById('mark_' + i), String(it.mark == null ? 1 : it.mark));
      if (kind === 'mcq') {
        const ch = (it.choices || []).slice(0, 6);
        const nc = document.getElementById('number_of_choices_' + i);
        if (nc) { nc.value = String(Math.max(2, ch.length)); jq(nc, 'change'); await sleep(150); }
        ch.forEach((c, k) => { const o = document.getElementById('option_' + i + '_' + (k + 1)); if (o) { setVal(o, c); jq(o, 'change'); } });
        const ca = document.getElementById('tfq_answer_' + i) || tr.querySelector('select.correct-answer');
        if (ca) { ca.value = String(it.correct || 1); jq(ca, 'change'); }
      } else {
        setVal(document.getElementById('correct_answer_' + i), String(it.answer || ''));
      }
      const link = tr.querySelector('a[onclick*="viewQuestionTextModal"]');
      if (link) { link.textContent = 'نص المفردة ✓'; link.title = it.text; }
      if (ok1) filled++;
    }
    if (filled < items.length) alert('تمت إضافة ' + filled + ' من ' + items.length + ' أسئلة فقط. أكمل الباقي يدويًا.');
    return filled;
  }
  async function runHomeworkManual() {
    const data = readPayload('homework');
    if (!data) return;
    const n = await fillHomework(data);
    if (n > 0) showToast('تمت إضافة ' + n + ' سؤال. راجعها ثم اضغط «إنشاء المفردات».');
  }
  async function runHomeworkAuto() {
    const p = getPending();
    if (!p) return;
    clearPending(); // يُستخدم مرة واحدة فقط
    const n = await fillHomework(p.data);
    if (n > 0) {
      showToast('✓ أُضيف واجب «' + (p.data.title || '') + '» (' + n + ' سؤال). راجعه ثم اضغط «إنشاء المفردات».',
        'تراجع', () => { location.reload(); }, 12000);
    }
  }

  // ---------- صفحة إنشاء/تعديل المهمة: العنوان والتواريخ والتحضير والروزنامة والفصول ----------
  function normAr(s) {
    return String(s || '').replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[^؀-ۿa-zA-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }
  function toks(s) {
    return normAr(s).split(' ').filter(w => w.length > 1).map(w => (w.length > 4 && w[0] === 'و') ? w.slice(1) : w);
  }
  function nameScore(a, b) {
    const na = normAr(a), nb = normAr(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1.5;
    const A = toks(a), B = toks(b); if (!A.length || !B.length) return 0;
    const common = A.filter(w => B.includes(w)).length;
    return (2 * common) / (A.length + B.length);
  }
  function pickPreparation(sel, data) {
    let best = null, bestScore = 0;
    Array.from(sel.options).forEach(o => {
      if (!o.value) return;
      let text = o.text, num = 0;
      const m = text.match(/^\s*(\d+)\s*[-–_.\/]\s*(\d+)\s*(.*)$/);
      let u = null, n = null;
      if (m) { u = m[1]; n = m[2]; text = m[3]; }
      if (u && data.unit && data.lesson_no && String(+u) === String(+data.unit) && String(+n) === String(+data.lesson_no)) num = 1;
      const em = o.text.match(/Unit\s*(\d+)\s*:\s*Lesson\s*(\d+)/i);
      if (em && data.lesson_no && +em[1] === +data.unit && +em[2] === +data.lesson_no) num = 1;
      if (/^\s*Starter/i.test(o.text) && String(data.unit) === '0') num = 1;
      const sc = num + Math.max(nameScore(text, data.base_title || data.title), nameScore(text, data.title));
      if (sc >= bestScore) { bestScore = sc; best = o; } // عند التساوي: الأحدث (الأخير في القائمة)
    });
    return bestScore >= 0.6 ? best : null;
  }
  function fmtDate(d) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function addDays(str, days) {
    const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    d.setDate(d.getDate() + days);
    return fmtDate(d);
  }
  function setPicker(id, v) {
    const el = document.getElementById(id); if (!el || !v) return false;
    const $ = uw.jQuery;
    el.value = v;
    if ($) { try { $(el).datetimepicker('update'); } catch (e) {} $(el).trigger('change'); }
    else el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value === v;
  }
  function tick(cb) { if (cb && !cb.checked) cb.click(); return !!(cb && cb.checked); }
  async function fillTaskForm() {
    const p = getPending();
    if (!p || p.formDone) return;
    let titleEl = null;
    for (let i = 0; i < 50 && !(titleEl = document.getElementById('AssignmentTitle')); i++) await sleep(100);
    if (!titleEl) return;
    const data = p.data, $ = uw.jQuery, report = [];
    // 1) التحضير (أولًا، لأنه يملأ «الدروس» تلقائيًا)
    const sel = document.getElementById('AssignmentPreparationId');
    if (sel) {
      const opt = pickPreparation(sel, data);
      if (opt) {
        sel.value = opt.value;
        if ($) $(sel).trigger('change'); else sel.dispatchEvent(new Event('change', { bubbles: true }));
        const wrap = sel.parentElement;
        const styled = wrap && wrap.querySelector('.select-styled'); if (styled) styled.textContent = opt.text;
        if (wrap) wrap.querySelectorAll('.select-options li').forEach(li => li.classList.toggle('active', li.getAttribute('rel') === opt.value));
        report.push('التحضير: ' + opt.text);
      } else report.push('⚠ لم أجد تحضيرًا باسم الدرس، اختره يدويًا');
    }
    // 2) العنوان
    setVal(titleEl, data.title || '');
    report.push('العنوان');
    // 3) التسليم + يومين (والتسليم المتأخر لا يسبق التسليم)
    const due = document.getElementById('duedate'), cut = document.getElementById('cutoffdate');
    const newDue = due && addDays(due.value, 2);
    const newCut = cut && addDays(cut.value, 2); // نحسبه قبل تعديل التسليم لأن نور يحرّكه تلقائيًا
    if (newDue && setPicker('duedate', newDue)) {
      await sleep(300);
      if (newCut) setPicker('cutoffdate', newCut < newDue ? newDue : newCut);
      report.push('التسليم: ' + newDue.slice(0, 16));
    } else report.push('⚠ لم أستطع تعديل تاريخ التسليم');
    // 4) إظهار المهمة في الروزنامة
    if (tick(document.getElementById('show_event'))) report.push('الروزنامة ✓');
    // 5) الفصول: نشر لفصول + تعليم كل فصول هذا الصف
    const toClasses = document.getElementById('AssignmentPublishTo0');
    if (toClasses && !toClasses.checked) toClasses.click();
    // صفحة «إضافة» تسمي المربعات checkbox_<رقم>، وصفحة «تعديل» تسميها LectureCheckbox<رقم>
    const secs = Array.from(new Set(document.querySelectorAll('#sections_list .lecture-container input[type=checkbox], #sections_list input.group_checkbox, input[type=checkbox][id^="LectureCheckbox"]')))
      .filter(c => c.id !== 'sections_select_all' && !/_$/.test(c.id));
    secs.forEach(tick);
    if (secs.length) report.push('الفصول: ' + secs.map(c => (c.closest('label') || c.parentElement).textContent.trim()).join('، '));
    p.formDone = true; GM_setValue(PENDING_KEY, p);
    const bar = document.getElementById('tahdir-pending-bar'); if (bar) bar.remove();
    showToast('✓ جهّزت المهمة: ' + report.join(' · ') + '. راجعها ثم اضغط زر الحفظ بنفسك.', 'تراجع', () => { location.reload(); }, 15000);
  }

  // ---------- التحضير التلقائي: اختيار الفصل والوحدة والدرس من الشجرة ثم ملء الأركان ----------
  function stripTags(t) { return String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
  async function treeKids(T, id, ms) {
    for (let i = 0; i < (ms || 8000) / 150; i++) {
      const n = T.get_node(id);
      if (n && n.children && n.children.length) return Array.from(n.children).map(c => T.get_node(c));
      await sleep(150);
    }
    return [];
  }
  function pickNode(nodes, data, mode) {
    let best = null, bestScore = 0;
    nodes.forEach((n, i) => {
      let text = stripTags(n.text), bonus = 0;
      if (mode === 'unit') {
        const um = text.match(/^Unit\s*(\d+)/i);
        if (um) { if (+um[1] === +data.unit) bonus = 1.2; }
        else if (/^Starter/i.test(text)) { if (+data.unit === 0) bonus = 1.2; }
        else if (i === (+data.unit) - 1) bonus = 1;
        text = text.replace(/^الوحدة\s+\S+\s*[:：-]?\s*/, '');
        const sc = bonus + nameScore(text, data.unit_name || '');
        if (sc > bestScore) { bestScore = sc; best = n; }
      } else {
        const m = text.match(/^\s*(\d+)\s*[-–_.\/]\s*(\d+)\s*(.*)$/), em = text.match(/Unit\s*(\d+)\s*:\s*Lesson\s*(\d+)/i);
        if (m) { text = m[3]; if (+m[1] === +data.unit && +m[2] === +data.lesson_no) bonus = 1; }
        else if (em) { if (+em[1] === +data.unit && +em[2] === +data.lesson_no) bonus = 1.2; }
        else if (nodes.length === 1) bonus = 0.7;
        const sc = bonus + nameScore(text, data.title || '');
        if (sc > bestScore) { bestScore = sc; best = n; }
      }
    });
    return bestScore >= 0.6 ? best : null;
  }
  async function selectNode(T, n) { T.deselect_all(true); T.select_node(n.id); await sleep(200); }
  async function ajaxIdle(maxMs) {
    let idle = 0;
    for (let i = 0; i < maxMs / 150 && idle < 3; i++) { await sleep(150); idle = (uw.jQuery && uw.jQuery.active === 0) ? idle + 1 : 0; }
  }
  async function fillPrepAuto(data) {
    const $ = uw.jQuery;
    let T = null;
    for (let i = 0; i < 80; i++) {
      try { T = $ && $('#jstree_node_tree').jstree(true); } catch (e) { T = null; }
      if (T && T.get_node('#') && T.get_node('#').children.length) break;
      await sleep(150);
    }
    const report = [], warn = [];
    let lessonOk = false;
    if (T) {
      const root = T.get_node(T.get_node('#').children[0]);
      const terms = await treeKids(T, root.id, 3000);
      const termRe = +data.term === 2 ? /الثاني|Second/i : /الأول|First/i;
      const term = terms.find(t => termRe.test(stripTags(t.text))) || terms[0];
      if (term) {
        await selectNode(T, term);
        await ajaxIdle(6000);
        const units = await treeKids(T, term.id);
        const unit = pickNode(units, data, 'unit');
        if (unit) {
          await selectNode(T, unit);
          await ajaxIdle(6000);
          const lessons = await treeKids(T, unit.id);
          await ajaxIdle(6000); // ننتظر طلبات الفصل والوحدة حتى لا تستبدل مخرجات الدرس بعد تعليمها
          const lesson = pickNode(lessons, data, 'lesson');
          if (lesson) {
            await selectNode(T, lesson);
            await ajaxIdle(8000);
            for (let i = 0; i < 40 && !document.querySelector('#criteria-checkbox input[type=checkbox]'); i++) await sleep(150);
            await ajaxIdle(3000);
            const nid = lesson.li_attr && lesson.li_attr.node_id;
            const lid = document.getElementById('lesson-id');
            if (nid && lid && String(lid.value) !== String(nid)) { await selectNode(T, lesson); await ajaxIdle(8000); }
            let cbs = [];
            for (let round = 0; round < 4; round++) { // نعيد التأكد لو نور أعاد رسم القائمة
              cbs = Array.from(document.querySelectorAll('#criteria-checkbox input[type=checkbox]'));
              cbs.forEach(cb => { if (!cb.checked) cb.click(); });
              await sleep(500); await ajaxIdle(2000);
            }
            cbs = Array.from(document.querySelectorAll('#criteria-checkbox input[type=checkbox]'));
            cbs.forEach(cb => { if (!cb.checked) cb.click(); });
            report.push('الدرس: ' + stripTags(lesson.text));
            if (cbs.length) report.push('المخرجات (' + cbs.length + ')'); else warn.push('لم تظهر مخرجات لهذا الدرس');
            lessonOk = true;
          } else warn.push('لم أجد الدرس في الشجرة');
        } else warn.push('لم أجد الوحدة ' + (data.unit || '') + ' في الشجرة');
      } else warn.push('لم أجد الفصل الدراسي');
    } else warn.push('شجرة الدروس لم تظهر');
    if (!lessonOk) { setVal(document.getElementById('PreparationTitle'), data.title || ''); }
    const obj = document.getElementById('PreparationObjective');
    if (obj && data.objective && !obj.value.trim()) { setVal(obj, data.objective); report.push('المخرجات الإضافية'); }
    const ed = fillEditors(data.fields || {});
    const sel = fillChosenSelects(data.selects || {});
    if (ed.ok) report.push('الأركان'); else warn.push('المحررات: ' + ed.error);
    if (sel.ok) report.push('المستوى والاستراتيجيات والمصادر'); else warn.push('القوائم: ' + sel.error);
    const dates = document.getElementById('publishdate-1');
    if (dates) dates.scrollIntoView({ block: 'center' });
    showToast((warn.length ? '⚠ ' + warn.join('، ') + (lessonOk ? '' : '. اختر الدرس من الشجرة بنفسك') + ' · ' : '✓ ') + 'تم: ' + report.join(' · ') + '. يبقى لك التواريخ ثم زر «إضافة».',
      'تراجع', () => { location.reload(); }, 15000);
  }

  // ---------- التحضير: صفحة إضافة تحضير ----------
  const EDITOR_MAP = ['lesson_vocabulary', 'description', 'pre_learning', 'thinking_skills', 'formative_assessment', 'closing_assessment', 'activities', 'weekly_study_plan_comments'];
  function runPrep() {
    const data = readPayload('prep');
    if (!data) return;
    if (data.title) setVal(document.getElementById('PreparationTitle'), data.title);
    const objEl = document.getElementById('PreparationObjective');
    if (objEl && data.objective && !objEl.value.trim()) setVal(objEl, data.objective);
    const outcomesOk = data.tick_all_outcomes ? tickAllOutcomes() : null;
    const ed = fillEditors(data.fields || {});
    const sel = fillChosenSelects(data.selects || {});
    const problems = [];
    if (!ed.ok) problems.push('تعذّر الوصول إلى محررات النص (' + ed.error + ')');
    if (!sel.ok) problems.push('تعذّر الوصول إلى القوائم (' + sel.error + ')');
    if (outcomesOk === false) problems.push('لم يتم العثور على قسم المخرجات التعليمية');
    if (problems.length) alert('تم لصق بعض الحقول فقط:\n- ' + problems.join('\n- '));
    else showToast('تم لصق التحضير. راجع الحقول قبل الحفظ.');
  }
  function tickAllOutcomes() {
    const headings = Array.from(document.querySelectorAll('label, h2, h3, h4, legend, div, span'))
      .filter(el => el.children.length === 0 && /المخرجات\s*التعليمية/.test(el.textContent || ''));
    let container = null;
    for (const h of headings) {
      let p = h.closest('.form-group, fieldset, .panel, .section, div'), hops = 0;
      while (p && hops < 6) { if (p.querySelectorAll('input[type=checkbox]').length >= 1) { container = p; break; } p = p.parentElement; hops++; }
      if (container) break;
    }
    if (!container) return false;
    container.querySelectorAll('input[type=checkbox]').forEach(cb => { if (!cb.checked) cb.click(); });
    return true;
  }
  function fillEditors(fields) {
    if (typeof uw.CKEDITOR === 'undefined') return { ok: false, error: 'CKEDITOR غير معرّف' };
    let any = false;
    EDITOR_MAP.forEach(id => {
      const val = fields[id];
      if (val === undefined || val === null) return;
      const inst = uw.CKEDITOR.instances[id];
      if (inst) { inst.setData(String(val).split('\n').map(escHtml).join('<br>')); any = true; }
      else { const ta = document.getElementById(id); if (ta && String(val)) { setVal(ta, String(val)); any = true; } }
    });
    return any ? { ok: true } : { ok: false, error: 'لم يتم إيجاد محررات النص' };
  }
  function fillChosenSelects(selects) {
    if (typeof uw.jQuery === 'undefined') return { ok: false, error: 'jQuery غير معرّف' };
    const $ = uw.jQuery; let any = false;
    Object.keys(selects).forEach(selId => {
      const wanted = selects[selId]; if (!wanted || !wanted.length) return;
      const $s = $('#' + selId); if (!$s.length) return;
      const values = [];
      $s.find('option').each(function () {
        const t = $(this).text().trim(), n = t.replace(/\s/g, '');
        if (wanted.some(w => t === w || n === String(w).replace(/\s/g, ''))) values.push($(this).val());
      });
      if (values.length) { $s.val(values).trigger('chosen:updated').trigger('change'); any = true; }
    });
    return any ? { ok: true } : { ok: false, error: 'لم يتم إيجاد القوائم' };
  }


  // ================= التصحيح التلقائي للواجبات =================
  // المسار: المهام الإلكترونية ← التسليمات ← «الدرجة» لكل طالب ← الدرجة النهائية + تعليق «أحسنت».
  // المرحلة الأولى: لا تضغط «درجة التسليم» (الحفظ) أبدًا — المعلم يراجع ويحفظ بنفسه، ثم تفتح الأداة الطالب التالي.
  function gBar(html, buttons) {
    let bar = document.getElementById('tahdir-grade-bar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'tahdir-grade-bar';
      Object.assign(bar.style, { position: 'fixed', top: '0', left: '0', right: '0', zIndex: 999998, background: '#3b1d8f', color: '#fff', padding: '9px 16px', fontFamily: 'Tahoma, sans-serif', fontSize: '13.5px', direction: 'rtl', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 2px 10px rgba(0,0,0,.25)', lineHeight: '1.7' });
      document.body.appendChild(bar);
    }
    bar.innerHTML = ''; const t = document.createElement('span'); t.style.flex = '1'; t.innerHTML = html; bar.appendChild(t);
    (buttons || []).forEach(([label, fn, ghost]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      Object.assign(b.style, { background: ghost ? 'transparent' : '#fff', color: ghost ? '#fff' : '#3b1d8f', border: ghost ? '1px solid rgba(255,255,255,.6)' : 'none', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' });
      b.onclick = fn; bar.appendChild(b);
    });
    return bar;
  }
  function getJob() { const j = GM_getValue(JOB_KEY, null); if (!j || !j.active || Date.now() - j.ts > 6 * 3600000) return null; return j; }
  function stopJob(msg) { const j = GM_getValue(JOB_KEY, null); if (j) { j.active = false; GM_setValue(JOB_KEY, j); } const b = document.getElementById('tahdir-grade-bar'); if (b) b.remove(); if (msg) showToast(msg, null, null, 6000); }
  function aidOf(u) { return (String(u || '').match(/\/aid:([^/?#]+)/) || [])[1] || ''; }
  // نعرض كل صفوف الجدول في صفحة واحدة لو كان DataTables
  function showAllRows() {
    try { const $ = uw.jQuery; if ($ && $.fn && $.fn.dataTable) $('table.dataTable').each(function () { try { const t = $(this).DataTable(); if (t.page.len() !== -1 && t.page.info().pages > 1) t.page.len(-1).draw(false); } catch (e) { } }); } catch (e) { }
  }
  async function waitRows(sel, ms) {
    for (let i = 0; i < (ms || 15000) / 300; i++) {
      const rows = Array.from(document.querySelectorAll(sel)).filter(r => r.querySelector('a[href]'));
      if (rows.length) return rows;
      await sleep(300);
    }
    return [];
  }
  // 1) صفحة «المهام الإلكترونية»: نقرأ المهام ونحفظها، ونضيف زر «صحّح تلقائيًا» بجانب كل مهمة
  function courseOfCid(cid) {
    const map = GM_getValue(GRADES_KEY, {}) || {}; let grade = '', subject = '';
    Object.keys(map).forEach(k => { if (map[k] === cid) { if (k.indexOf('|') > 0) { subject = k.split('|')[0]; grade = k.split('|')[1]; } else if (!grade) grade = k; } });
    const f = GM_getValue(FETCH_KEY, null);
    if (!grade && f && Date.now() - f.ts < 15 * 60000) { grade = f.grade; subject = f.subject; }
    return { grade, subject };
  }
  async function scanTasks() {
    showAllRows(); await sleep(400);
    const rows = await waitRows('table tbody tr', 15000);
    showAllRows(); await sleep(300);
    const cid = (path.match(/\/cid:([^/?#]+)/) || [])[1] || '';
    const course = courseOfCid(cid);
    const tasks = [];
    Array.from(document.querySelectorAll('table tbody tr')).forEach(tr => {
      const sub = Array.from(tr.querySelectorAll('a[href*="/lectures/submissions/"]'))[0];
      if (!sub) return;
      const tds = Array.from(tr.querySelectorAll('td')).map(td => (td.textContent || '').replace(/\s+/g, ' ').trim());
      const dates = tds.filter(t => /^\d{4}-\d{2}-\d{2}/.test(t));
      const title = tds.find(t => t && !/^\d/.test(t) && !/معاينة|التسليمات|قائمة المفردات|إحصائيات/.test(t)) || '';
      const count = tds.find(t => /^\d{1,3}$/.test(t)) || '';
      tasks.push({ title, count: +count || 0, published: dates[0] || '', due: dates[1] || '', subUrl: new URL(sub.getAttribute('href'), location.href).href, aid: aidOf(sub.getAttribute('href')) });
      if (!tr.querySelector('.tahdir-grade-btn')) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'tahdir-grade-btn'; b.textContent = '✓ صحّح تلقائيًا';
        Object.assign(b.style, { background: '#3b1d8f', color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'Tahoma, sans-serif', fontSize: '12px', marginInlineStart: '6px' });
        b.onclick = () => startJob({ subUrl: new URL(sub.getAttribute('href'), location.href).href, title });
        const cell = tr.querySelector('td:last-child') || tr; cell.appendChild(b);
      }
    });
    if (!tasks.length) return;
    const all = GM_getValue(TASKS_KEY, {}) || {};
    all[cid] = { cid, grade: course.grade, subject: course.subject, tasks, ts: Date.now(), url: location.href };
    GM_setValue(TASKS_KEY, all);
    const f = GM_getValue(FETCH_KEY, null);
    if (f && Date.now() - f.ts < 15 * 60000) { GM_deleteValue(FETCH_KEY); showToast('✓ حُفظت ' + tasks.length + ' مهمة في موقع «خبير». ارجع للموقع واختر المهمة لتصحيحها.', null, null, 9000); }
  }
  function startJob(d) {
    GM_setValue(JOB_KEY, { subUrl: d.subUrl, aid: aidOf(d.subUrl), title: d.title || '', comment: GM_getValue('tahdir_grade_comment', 'أحسنت') || 'أحسنت', visited: [], queue: null, filled: 0, saved: 0, ts: Date.now(), active: true, autosave: GM_getValue('tahdir_grade_autosave', true) !== false });
    location.href = d.subUrl;
  }
  // 2) صفحة «التسليمات»: أول مرة نبني قائمة الطلاب غير المصحَّحين، وبعدها ننتقل مباشرة للتالي بدون انتظار الجدول
  function nextInQueue(job) { return (job.queue || []).find(x => job.visited.indexOf(x.href) < 0) || null; }
  function goNext(job, next) {
    job.visited.push(next.href); job.ts = Date.now(); GM_setValue(JOB_KEY, job);
    location.href = next.href;
  }
  function finishJob(job, total) {
    gBar('✅ انتهى التصحيح: «' + escHtml(job.title) + '»' + (job.autosave ? ' — حُفظ ' + (job.saved || 0) + ' تسليم' : '') + (total ? ' من ' + total : '') + '.', [['إغلاق', () => stopJob(), false]]);
    const j = GM_getValue(JOB_KEY, null); if (j) { j.active = false; j.finished = Date.now(); GM_setValue(JOB_KEY, j); }
  }
  async function runSubmissions(job) {
    // رجعنا بعد الحفظ وعندنا القائمة: ننتقل فورًا
    if (job.queue) {
      const nx = nextInQueue(job);
      if (nx) { gBar('⚡ التصحيح التلقائي: «' + escHtml(job.title) + '» — ' + job.visited.length + ' من ' + job.queue.length + '… أفتح: <b>' + escHtml(nx.name) + '</b>', [['إيقاف', () => stopJob('أوقفت التصحيح التلقائي.'), true]]); goNext(job, nx); return; }
      finishJob(job, job.queue.length); return;
    }
    gBar('⏳ التصحيح التلقائي: «' + escHtml(job.title) + '» — أقرأ قائمة التسليمات…', [['إيقاف', () => stopJob('أوقفت التصحيح التلقائي.'), true]]);
    showAllRows();
    await waitRows('table tbody tr', 20000);
    showAllRows(); await sleep(300);
    const items = Array.from(document.querySelectorAll('table tbody tr')).map(tr => {
      const a = Array.from(tr.querySelectorAll('a[href*="/lectures/mark_submission/"]'))[0];
      const name = ((tr.querySelector('td') || {}).textContent || '').replace(/\s+/g, ' ').trim();
      return a ? { href: new URL(a.getAttribute('href'), location.href).href, name, graded: /تم التصحيح/.test(tr.textContent || '') } : null;
    }).filter(Boolean);
    if (!items.length) { gBar('لم أجد تسليمات في هذه الصفحة.', [['إغلاق', () => stopJob(), true]]); return; }
    job.queue = items.filter(x => !x.graded).map(x => ({ href: x.href, name: x.name }));
    GM_setValue(JOB_KEY, job);
    const nx = nextInQueue(job);
    if (!nx) { finishJob(job, 0); gBar('✅ كل التسليمات (' + items.length + ') مصحَّحة بالفعل.', [['إغلاق', () => stopJob(), false]]); return; }
    goNext(job, nx);
  }
  // 3) صفحة «الدرجة»: الدرجة النهائية لكل سؤال + التعليق، ثم «درجة التسليم» تلقائيًا (لو مفعّل)
  const numOf = t => { const m = String(t == null ? '' : t).trim().match(/^\d+(\.\d+)?$/); return m ? parseFloat(m[0]) : NaN; };
  function gradeSelects() {
    return Array.from(document.querySelectorAll('select')).filter(sel => {
      const nums = Array.from(sel.options).map(o => numOf(o.value !== '' ? o.value : o.text)).filter(n => !isNaN(n));
      const other = Array.from(sel.options).filter(o => !(o.hasAttribute('value') && o.value === '') && o.text.trim() !== '' && isNaN(numOf(o.value !== '' ? o.value : o.text)));
      return nums.length >= 2 && !other.length && Math.max.apply(null, nums) > 0 && Math.max.apply(null, nums) <= 100;
    });
  }
  function setSelectMax(sel) {
    const opts = Array.from(sel.options).map(o => ({ o, n: numOf(o.value !== '' ? o.value : o.text) })).filter(x => !isNaN(x.n));
    if (!opts.length) return false;
    const best = opts.reduce((a, b) => (b.n > a.n ? b : a));
    sel.value = best.o.value; best.o.selected = true;
    sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
    try {
      const $ = uw.jQuery;
      if ($) { const $s = $(sel); $s.val(best.o.value).trigger('change'); $s.trigger('chosen:updated'); if ($s.selectpicker) try { $s.selectpicker('refresh'); } catch (e) { } if ($s.niceSelect) try { $s.niceSelect('update'); } catch (e) { } }
    } catch (e) { }
    // قوائم مخصّصة فوق القائمة الأصلية (nice-select وما يشبهها): نضغط الخيار الأعلى أيضًا
    const wrap = sel.nextElementSibling;
    if (wrap && /nice-select|dropdown|select/.test(wrap.className || '')) {
      const li = Array.from(wrap.querySelectorAll('[data-value]')).find(x => String(x.getAttribute('data-value')) === String(best.o.value));
      if (li) try { li.click(); } catch (e) { }
    }
    return String(sel.value) === String(best.o.value);
  }
  function customGradeLists() { // قوائم بلا <select>: عناصر [data-value] رقمية داخل نفس الحاوية
    const out = [];
    document.querySelectorAll('.nice-select, [class*="select"]').forEach(w => {
      if (w.tagName === 'SELECT' || w.querySelector('select')) return;
      const lis = Array.from(w.querySelectorAll('[data-value]')).filter(x => !isNaN(numOf(x.getAttribute('data-value'))));
      if (lis.length >= 2) out.push(lis);
    });
    return out;
  }
  function gradeDebug() {
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, el = null;
    while ((n = tw.nextNode())) { if (/^\s*\d+\s*\/\s*$/.test(n.nodeValue)) { el = n.parentElement; break; } }
    let box = el; for (let i = 0; i < 4 && box && box.parentElement; i++) box = box.parentElement;
    return 'tahdir ' + VERSION + ' | ' + location.pathname.slice(0, 60) + '\n' + (box ? box.outerHTML : document.body.innerHTML).replace(/\s+/g, ' ').slice(0, 6000);
  }
  async function runMark(job) {
    gBar('⏳ أكتب الدرجة والتعليق…', [['إيقاف', () => stopJob('أوقفت التصحيح التلقائي.'), true]]);
    let sels = [], lists = [];
    for (let i = 0; i < 80; i++) { sels = gradeSelects(); lists = sels.length ? [] : customGradeLists(); if (sels.length || lists.length) break; await sleep(150); }
    let marked = 0;
    sels.forEach(sl => { if (setSelectMax(sl)) marked++; });
    lists.forEach(lis => { const best = lis.reduce((a, b) => (numOf(b.getAttribute('data-value')) > numOf(a.getAttribute('data-value')) ? b : a)); try { best.click(); marked++; } catch (e) { } });
    // عدد الأسئلة في الصفحة من علامات «1/» بجانب كل سؤال: لا نحفظ إلا لو اخترنا درجة لكل سؤال
    let pills = 0; { const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (/^\s*\d+(\.\d+)?\s*\/\s*$/.test(n.nodeValue)) pills++; }
    const total = Math.max(sels.length + lists.length, pills);
    // التعليق
    let commented = false;
    for (let i = 0; i < 40 && !commented; i++) {
      const CK = uw.CKEDITOR;
      if (CK && CK.instances) {
        const inst = Object.keys(CK.instances).map(k => CK.instances[k]).find(x => x && x.status === 'ready');
        if (inst) { const cur = String(inst.getData() || '').replace(/<[^>]+>|&nbsp;/g, '').trim(); if (!cur) inst.setData('<p>' + escHtml(job.comment || 'أحسنت') + '</p>'); try { inst.updateElement(); } catch (e) { } commented = true; break; }
      }
      const ta = Array.from(document.querySelectorAll('textarea')).find(t => t.offsetParent !== null);
      if (ta && !(CK && Object.keys(CK.instances || {}).length)) { if (!ta.value.trim()) setVal(ta, job.comment || 'أحسنت'); commented = true; break; }
      await sleep(150);
    }
    job.filled = (job.filled || 0) + 1; GM_setValue(JOB_KEY, job);
    const saveBtn = Array.from(document.querySelectorAll('button, input[type=submit], a.btn')).find(b => /درجة التسليم/.test(b.textContent || b.value || ''));
    const pos = job.queue ? (job.visited.length + ' من ' + job.queue.length) : '';
    const ok = total > 0 && marked === total && commented;
    if (ok && job.autosave && saveBtn) {
      gBar('💾 ' + pos + ' — الدرجة النهائية + «' + escHtml(job.comment || 'أحسنت') + '»… أحفظ وأنتقل للتالي', [['إيقاف', () => stopJob('أوقفت التصحيح التلقائي.'), true]]);
      job.saved = (job.saved || 0) + 1; GM_setValue(JOB_KEY, job);
      await sleep(350); // ننتظر تحديث المحرر والقائمة قبل الحفظ
      if (!getJob()) return; // أوقفه المعلم
      saveBtn.click();
      // لو لم ينتقل نور خلال 8 ثوانٍ (خطأ في الحفظ) نتوقف ليتدخل المعلم
      setTimeout(() => { if (/\/lectures\/mark_submission\//.test(location.pathname) && getJob()) { job.saved--; GM_setValue(JOB_KEY, job); gBar('⚠ لم يكتمل الحفظ لهذا الطالب. راجع الصفحة واحفظ بنفسك، أو تخطَّه.', [['تخطَّ هذا الطالب', () => { location.href = job.subUrl; }, true], ['إيقاف', () => stopJob('أوقفت التصحيح التلقائي.'), true]]); } }, 8000);
      return;
    }
    if (saveBtn) { saveBtn.style.outline = '4px solid #f2c66d'; saveBtn.style.outlineOffset = '3px'; try { saveBtn.scrollIntoView({ block: 'center' }); } catch (e) { } }
    const why = !total ? '<b>لم أجد قائمة الدرجة</b> — اخترها بنفسك' : (marked < total ? '<b>لم أستطع اختيار كل الدرجات</b> — راجعها' : (!commented ? '<b>لم أجد مربع التعليق</b>' : ''));
    gBar((why ? '⚠ ' + why : '✅ كتبت الدرجة النهائية والتعليق') + '. اضغط <b>«درجة التسليم»</b> للحفظ، وبعدها أفتح الطالب التالي. ' + pos,
      [['نسخ تقرير للمطوّر', () => { try { navigator.clipboard.writeText(gradeDebug()).then(() => showToast('نُسخ التقرير — أرسله لمدير المنصة')); } catch (e) { prompt('انسخ هذا التقرير:', gradeDebug()); } }, true],
       ['تخطَّ هذا الطالب', () => { location.href = job.subUrl; }, true], ['إيقاف', () => stopJob('أوقفت التصحيح التلقائي.'), true]]);
  }
  // ---------- التشغيل ----------
  function addButton(label, fn) {
    if (document.getElementById('tahdir-paste-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'tahdir-paste-btn'; btn.type = 'button'; btn.textContent = label;
    Object.assign(btn.style, { position: 'fixed', bottom: '20px', left: '20px', zIndex: 999999, background: '#0e7c66', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 18px', fontSize: '14px', fontFamily: 'Tahoma, sans-serif', boxShadow: '0 4px 14px rgba(0,0,0,.25)', cursor: 'pointer' });
    btn.onclick = fn;
    document.body.appendChild(btn);
    if (typeof GM_registerMenuCommand !== 'undefined') GM_registerMenuCommand(label, fn);
  }
  if (IS_HW) {
    addButton('📝 لصق الواجب', runHomeworkManual);
    runHomeworkAuto();
  } else if (IS_PREP) {
    addButton('📋 لصق من خبير', runPrep);
  }
  // التصحيح التلقائي (يعمل فقط لو بدأه المعلم، وعلى نفس الواجب)
  const gjob = uw.__tahdirGradeRan ? null : getJob(); uw.__tahdirGradeRan = true;
  if (IS_HWLIST) scanTasks();
  if (gjob && IS_SUBS && aidOf(path) === gjob.aid) runSubmissions(gjob);
  else if (gjob && IS_MARK && aidOf(path) === gjob.aid) runMark(gjob);
  const pending = getPending();
  const prepPending = getPending(PREP_KEY);
  if (IS_PREP && prepPending) { clearPending(PREP_KEY); fillPrepAuto(prepPending.data); }
  else if (pending && IS_TASK && !pending.formDone) fillTaskForm();
  else if (!BUSY) {
    learnGradesWait('', 10000); // نحدّث أرقام الصفوف في الخلفية
    if (!courseBarIfWaiting()) routeIfNeeded().then(moving => { const p = getPending(); if (!moving && p) showPendingBar(p); });
  }
  else if (pending) showPendingBar(pending);
  }

  // ننتظر **تحميل التخزين المشترك** أولًا (Userscripts على iOS غير متزامن)، ثم
  // جاهزية المستند: قبلها لا يوجد document.documentElement فيفشل كل شيء.
  const start = function () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  };
  const rd = (typeof globalThis !== 'undefined' ? globalThis : window).__TAHDIR_READY;
  if (rd && typeof rd.then === 'function') rd.then(start, start); else start();
})();
