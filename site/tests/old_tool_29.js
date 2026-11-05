// ==UserScript==
// @name         لصق التحضير والواجب - نور (التحضير الآلي)
// @namespace    https://tahdir-al-aali.local/
// @version      2.9.0
// @description  يرسل التحضير والواجب من موقع التحضير الآلي إلى نور: يفتح صفحة الصف، يختار الدرس، ويملأ الحقول. لا يضغط حفظ أبدًا. إعداد: أ. محمد مجدي.
// @author       أ. محمد مجدي
// @match        https://lms.moe.gov.om/teacher/*
// @match        https://tahdir.hudhaifa-bio.workers.dev/*
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @updateURL    https://tahdir.hudhaifa-bio.workers.dev/tool/tahdir-noor.user.js
// @downloadURL  https://tahdir.hudhaifa-bio.workers.dev/tool/tahdir-noor.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  const VERSION = '2.9.0';
  const uw = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const PENDING_KEY = 'tahdir_pending_hw';
  const PREP_KEY = 'tahdir_pending_prep';
  const CID_KEY = 'tahdir_last_cid';
  const GRADES_KEY = 'tahdir_grade_cids';
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
  function subjKey(subject, grade) { return String(subject || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, '') + '|' + grade; }
  function cidFor(map, grade, subject) { return (subject && map[subjKey(subject, grade)]) || map[grade]; }
  function routeUrl(kind, grade, subject) {
    const map = GM_getValue(GRADES_KEY, {}) || {};
    const cid = cidFor(map, grade, subject);
    if (!cid) return NOUR + '/teacher';
    return NOUR + (kind === 'prep' ? '/teacher/courses/add_preparation/cid:' : '/teacher/homeworks/create/cid:') + cid;
  }

  // ================= على موقع التحضير الآلي =================
  if (location.hostname === 'tahdir.hudhaifa-bio.workers.dev') {
    document.documentElement.setAttribute('data-tahdir-tool', VERSION);
    function onSend(kind, e) {
      let data;
      try { data = JSON.parse(String(e.detail)); } catch (err) { return; }
      if (kind === 'hw' && (!validPayload(data, 'homework') || !Array.isArray(data.items) || !data.items.length)) return;
      if (kind === 'prep' && (!data || data.source !== 'tahdir-al-aali' || data.kind === 'homework')) return;
      GM_setValue(kind === 'prep' ? PREP_KEY : PENDING_KEY, { data: data, ts: Date.now(), routed: false });
      document.dispatchEvent(new CustomEvent('tahdir-' + kind + '-ack'));
      // نفتح نور مباشرة على صفحة هذا الصف (أو الرئيسية أول مرة لنتعرف على أرقام الصفوف)
      GM_openInTab(routeUrl(kind, data.grade || '', data.subject || ''), { active: true });
    }
    document.addEventListener('tahdir-send-hw', e => onSend('hw', e));
    document.addEventListener('tahdir-send-prep', e => onSend('prep', e));
    return;
  }

  // ================= على منصة نور =================
  const path = location.pathname;
  const IS_HW = /\/questions\/add_bulk_questions\//.test(path);
  const IS_PREP = /\/courses\/add_preparation\//.test(path);
  const IS_TASK = /\/homeworks\/(create|edit|add)\//.test(path);
  const cidMatch = path.match(/\/cid:([^/]+)/);
  if (cidMatch && typeof GM_setValue !== 'undefined') GM_setValue(CID_KEY, cidMatch[1]);
  const GRADE_RE = /(الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي\s*عشر|الثاني\s*عشر)\s*$/;
  function learnGrades() {
    const map = GM_getValue(GRADES_KEY, {}) || {};
    let changed = false;
    document.querySelectorAll('a[href*="/courses/browse_content/cid:"]').forEach(a => {
      const t = (a.textContent || '').trim().replace(/\s+/g, ' ');
      const m = t.match(GRADE_RE), c = (a.getAttribute('href') || '').match(/cid:([^/?#]+)/);
      if (m && c) {
        const g = m[1].replace(/\s+/g, ' '), subj = t.split('/')[0].trim();
        if (map[g] !== c[1]) { map[g] = c[1]; changed = true; }
        if (subj && subj !== t) { const k = subjKey(subj, g); if (map[k] !== c[1]) { map[k] = c[1]; changed = true; } }
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
      showToast('لم أتعرف على «' + grade + '» في قائمة صفوفك في نور. افتح صفحة ' + (kind === 'prep' ? '«إضافة تحضير»' : '«إضافة مهمة»') + ' لهذا الصف بنفسك وسأكمل الباقي.', null, null, 9000);
      return false;
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
      ? 'الصق هنا الواجب الذي نسخته من موقع «التحضير الآلي» (زر «نسخ للأداة»):'
      : 'الصق هنا التحضير الذي نسخته من موقع «التحضير الآلي» (زر «نسخ JSON لأداة نور»):';
    const text = prompt(msg, '');
    if (text === null) return null;
    if (!text.trim()) { alert('لم يتم لصق أي نص.'); return null; }
    let data;
    try { data = JSON.parse(text); } catch (e) { alert('النص الملصوق غير صحيح. انسخه مرة أخرى من الزر المخصص في موقع «التحضير الآلي».'); return null; }
    if (data.source !== 'tahdir-al-aali') { alert('هذا النص لم يُنسخ من موقع «التحضير الآلي».'); return null; }
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
    addButton('📋 لصق من التحضير الآلي', runPrep);
  }
  const pending = getPending();
  const prepPending = getPending(PREP_KEY);
  if (IS_PREP && prepPending) { clearPending(PREP_KEY); fillPrepAuto(prepPending.data); }
  else if (pending && IS_TASK && !pending.formDone) fillTaskForm();
  else if (!BUSY) {
    learnGradesWait('', 10000); // نحدّث أرقام الصفوف في الخلفية
    routeIfNeeded().then(moving => { const p = getPending(); if (!moving && p) showPendingBar(p); });
  }
  else if (pending) showPendingBar(pending);
})();
