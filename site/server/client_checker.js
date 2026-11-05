/* مصحّح الاختبار القصير — يقرأ ملف Word/PDF أو نصًّا، ويطلب الفحص من الخادم.
   استخراج النصّ يتم **في المتصفح**: Word بلا أي مكتبة (ZIP + DecompressionStream)،
   وPDF عبر pdf.js المخزّن محليًّا. فلا يخرج من جهاز المعلّم إلا النصّ. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  // **الـnonce يُلتقط الآن** وقت تنفيذ هذا السكربت: المحمّل يُنشئ <script nonce> ثم
  // يحذفه بعد التنفيذ، فلا يبقى في DOM أي script[nonce] — ولهذا كان تحميل pdf.js
  // يُحجب بـCSP. نقرأه من document.currentScript ونحتفظ به.
  var NONCE = (function () {
    try {
      var cs = document.currentScript;
      if (cs && cs.nonce) return cs.nonce;
      if (cs && cs.getAttribute) { var a = cs.getAttribute('nonce'); if (a) return a; }
    } catch (e) { }
    var n = document.querySelector('script[nonce]');
    return n ? (n.nonce || n.getAttribute('nonce') || '') : '';
  })();
  // احتياط أخير: نلتقط أي nonce يظهر لاحقًا (لو تأخّر التنفيذ عن إنشاء العنصر).
  if (!NONCE) {
    try {
      var mo = new MutationObserver(function () {
        var s = document.querySelector('script[nonce]');
        if (s) { NONCE = s.nonce || s.getAttribute('nonce') || ''; mo.disconnect(); }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) { } }, 8000);
    } catch (e) { }
  }

  // ---------- فكّ ضغط ZIP (DOCX) ----------
  async function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('متصفحك لا يدعم فكّ الضغط — استخدم الصق النصّ');
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([u8]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function readDocxEntries(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf);
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('الملف ليس Word صالحًا (.docx)');
    var total = dv.getUint16(eocd + 10, true), ptr = dv.getUint32(eocd + 16, true);
    var out = null, numXml = '';
    for (var k = 0; k < total; k++) {
      if (ptr + 46 > u8.length || dv.getUint32(ptr, true) !== 0x02014b50) break;
      var method = dv.getUint16(ptr + 10, true);
      var csize = dv.getUint32(ptr + 20, true);
      var nameLen = dv.getUint16(ptr + 28, true), extraLen = dv.getUint16(ptr + 30, true), comLen = dv.getUint16(ptr + 32, true);
      var lho = dv.getUint32(ptr + 42, true);
      var name = new TextDecoder().decode(u8.subarray(ptr + 46, ptr + 46 + nameLen));
      ptr += 46 + nameLen + extraLen + comLen;
      if (name !== 'word/document.xml' && name !== 'word/numbering.xml') continue;
      var lnameLen = dv.getUint16(lho + 26, true), lextraLen = dv.getUint16(lho + 28, true);
      var dstart = lho + 30 + lnameLen + lextraLen;
      if (!csize) { // حجم غير مسجّل: نأخذ حتى الترويسة التالية أو نهاية الملف
        var nxt = u8.length;
        for (var q = dstart + 4; q < u8.length - 4; q++) {
          if (dv.getUint32(q, true) === 0x08074b50 || dv.getUint32(q, true) === 0x02014b50) { nxt = q; break; }
        }
        csize = nxt - dstart;
      }
      var data = u8.subarray(dstart, dstart + csize);
      var xml = new TextDecoder().decode(method === 0 ? data : await inflateRaw(data));
      if (name === 'word/numbering.xml') numXml = xml; else out = xml;
    }
    if (!out) throw new Error('لم أجد محتوى الورقة داخل ملف Word');
    // نُلحق تعريفات الترقيم بالمستند ليقرأها xmlToText (الترقيم التلقائي لا يُكتب في النصّ)
    return numXml ? out + '\u0000NUMBERING\u0000' + numXml : out;
  }
  // **الترقيم التلقائي في Word**: أرقام الأسئلة (1. 2. …) وحروف الفروع (أ. ب. …) تُولَّد
  // من numbering.xml ولا تُكتب في نصّ الفقرة، فكانت الورقة تُقرأ بلا أرقام فلا تُرى
  // المفردات. نعيد بناءها: لكل فقرة numId/ilvl نزيد عدّادها ونكتب الرقم بصيغته.
  function numberingMap(numXml) {
    var abs = {}, nums = {};
    (numXml.match(/<w:abstractNum\b[\s\S]*?<\/w:abstractNum>/g) || []).forEach(function (a) {
      var id = (/w:abstractNumId="(\d+)"/.exec(a) || [])[1]; if (id == null) return;
      var lv = {};
      (a.match(/<w:lvl\b[\s\S]*?<\/w:lvl>/g) || []).forEach(function (l) {
        var il = +((/w:ilvl="(\d+)"/.exec(l) || [])[1] || 0);
        lv[il] = { fmt: (/<w:numFmt w:val="([^"]+)"/.exec(l) || [])[1] || 'decimal', start: +((/<w:start w:val="(\d+)"/.exec(l) || [])[1] || 1),
          text: (/<w:lvlText w:val="([^"]*)"/.exec(l) || [])[1] || '%1.' };
      });
      abs[id] = lv;
    });
    (numXml.match(/<w:num\b[\s\S]*?<\/w:num>/g) || []).forEach(function (n) {
      var id = (/w:numId="(\d+)"/.exec(n) || [])[1], a = (/<w:abstractNumId w:val="(\d+)"/.exec(n) || [])[1];
      if (id != null && a != null) nums[id] = abs[a] || {};
    });
    return nums;
  }
  var AR_LET = 'أبجدهوزحطيكلمنسعفصقرشتثخذضظغ'.split('');
  function fmtNum(fmt, n) {
    if (fmt === 'bullet' || fmt === 'none') return '';
    if (/arabicAlpha|arabicAbjad|hebrew/.test(fmt)) return AR_LET[(n - 1) % AR_LET.length];
    if (fmt === 'lowerLetter') return String.fromCharCode(96 + ((n - 1) % 26) + 1);
    if (fmt === 'upperLetter') return String.fromCharCode(64 + ((n - 1) % 26) + 1);
    if (/Roman/i.test(fmt)) { var r = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']; return r[n] || String(n); }
    return String(n);
  }
  function xmlToText(xml) {
    var parts = String(xml).split('\u0000NUMBERING\u0000');
    var doc = parts[0], nmap = parts[1] ? numberingMap(parts[1]) : {};
    // مربعات النص تُخزَّن مرتين (Choice للعرض الحديث وFallback للقديم) فتتكرّر
    // نصوصها ودرجاتها [1] فتتضاعف الدرجة الكلية — نحذف نسخة Fallback.
    doc = doc.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '');
    var ctr = {};
    doc = doc.replace(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g, function (all, inner) {
      var pPr = (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(inner) || [''])[0];
      var nid = (/<w:numId w:val="(\d+)"/.exec(pPr) || [])[1], il = +((/<w:ilvl w:val="(\d+)"/.exec(pPr) || [])[1] || 0);
      if (nid == null || nid === '0' || !nmap[nid]) return all;
      var lv = nmap[nid][il] || { fmt: 'decimal', start: 1, text: '%1.' };
      var c = ctr[nid] || (ctr[nid] = {});
      c[il] = (c[il] == null ? lv.start : c[il] + 1);
      Object.keys(c).forEach(function (k) { if (+k > il) delete c[k]; });
      var lab = fmtNum(lv.fmt, c[il]); if (!lab) return all;
      var tx = lv.text.replace(/%(\d)/g, function (_, d) { var l2 = +d - 1; return l2 === il ? lab : fmtNum((nmap[nid][l2] || {}).fmt || 'decimal', c[l2] || 1); });
      if (!/[\.\)\-]$/.test(tx)) tx += '.';
      return all.replace(/(<\/w:pPr>)/, '$1<w:t>' + tx + ' </w:t>');
    });
    var s = doc
      .replace(/<w:tab[^>]*\/>/g, ' ')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); })
      .replace(/&amp;/g, '&');
    return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ---------- PDF ----------
  function loadPdfJs() {
    return new Promise(function (res, rej) {
      if (window.pdfjsLib) return res(window.pdfjsLib);
      var s = document.createElement('script');
      s.src = '/pdf/pdf.min.js';
      if (NONCE) s.setAttribute('nonce', NONCE); else if (s.nonce !== undefined) s.nonce = NONCE;
      s.async = true;
      s.onload = function () {
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.js'; } catch (e) { }
        res(window.pdfjsLib);
      };
      s.onerror = function () { rej(new Error('تعذّر تحميل قارئ PDF — جرّب ملف Word أو الصق النصّ')); };
      document.head.appendChild(s);
    });
  }
  async function readPdf(buf) {
    var lib = await loadPdfJs();
    var doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
    var pages = [];
    for (var p = 1; p <= doc.numPages; p++) {
      var pg = await doc.getPage(p);
      var tc = await pg.getTextContent();
      var items = [];
      tc.items.forEach(function (it) {
        var s = it.str || '';
        if (!s.trim()) return;                       // الفراغات لا تحمل معلومة
        var tr = it.transform || [1, 0, 0, 1, 0, 0];
        items.push({ s: s, x: tr[4], y: tr[5], w: it.width || 0, h: it.height || 8 });
      });
      // **بناء الأسطر من المواضع**: كثير من ملفات PDF العربية لا تحوي محارف مسافات،
      // فتخرج الكلمات ملتصقة («ملادةاالختبار»). نُدرج مسافة كلّما اتّسعت الفجوة
      // الأفقية بين قطعتين — وهو ما يعيد حدود الكلمات.
      items.sort(function (a, b) { return (Math.abs(b.y - a.y) > Math.max(3, a.h * 0.5)) ? (b.y - a.y) : (a.x - b.x); });
      var groups = [], cur = [], lastY = null;
      items.forEach(function (it) {
        if (lastY !== null && Math.abs(it.y - lastY) > Math.max(3, it.h * 0.5)) { groups.push(cur); cur = []; }
        cur.push(it); lastY = it.y;
      });
      if (cur.length) groups.push(cur);
      var lines = groups.map(function (line) {
        // **اتجاه السطر**: السطر العربي يُقرأ من اليمين إلى اليسار، فنرتّب قطعه تنازليًّا
        // حسب الموضع الأفقي. كان الترتيب تصاعديًّا دائمًا فتخرج الجملة مقلوبة الكلمات
        // («عشر الحادي للصف…») ويُلصق رقم السؤال بآخرها فتضيع بعض المفردات.
        var ar = 0, la = 0;
        line.forEach(function (it) { ar += (it.s.match(/[\u0600-\u06FF\uFB50-\uFEFF]/g) || []).length; la += (it.s.match(/[A-Za-z]/g) || []).length; });
        var rtl = ar > la;
        line.sort(function (a, b) { return rtl ? (b.x + b.w) - (a.x + a.w) : a.x - b.x; });
        var out = '';
        for (var k = 0; k < line.length; k++) {
          if (k > 0) {
            var prev = line[k - 1];
            var gap = rtl ? prev.x - (line[k].x + line[k].w) : line[k].x - (prev.x + prev.w);
            var spaceAt = Math.max(0.8, (line[k].h || 8) * 0.16);
            var endsSpace = /\s$/.test(prev.s), startsSpace = /^\s/.test(line[k].s);
            if (!endsSpace && !startsSpace && gap > spaceAt) out += ' ';
          }
          out += line[k].s;
        }
        return out.replace(/\s{2,}/g, ' ').trim();
      });
      pages.push(lines.filter(Boolean).join('\n'));
    }
    return pages.join('\n');
  }

  // ---------- العرض ----------
  var ICON = { pass: '✓', warn: '!', fail: '✕', skip: '–' };
  function render(rep) {
    var out = $('#chkOut'); if (!out) return;
    if (!rep || !rep.checks) { out.innerHTML = '<p class="chk-err">تعذّر الفحص.</p>'; return; }
    var s = rep.summary || {};
    var cls = rep.ok ? 'ok' : 'bad';
    var h = '<div class="chk-res ' + cls + '">';
    h += '<div class="chk-sum"><span class="chk-num">' + (s.items || 0) + '</span> مفردة</div>';
    h += '<div class="chk-sum"><span class="chk-num">' + (s.marks || 0) + '</span> / ' + (s.expectedMarks || '—') + ' درجة</div>';
    h += '<div class="chk-sum"><b>' + (s.fails || 0) + '</b> خطأ · <b>' + (s.warns || 0) + '</b> ملاحظة</div>';
    h += '</div>' + (rep.pdfNote ? '<div class="chk-note" style="margin:0 0 10px">' + esc(rep.pdfNote) + '</div>' : '') + '<ul class="chk-list">';
    rep.checks.forEach(function (c) {
      h += '<li class="chk-it chk-' + c.status + '"><span class="chk-ic">' + (ICON[c.status] || '·') + '</span>'
        + '<span class="chk-tx"><b>' + esc(c.title) + '</b>' + (c.detail ? '<span class="chk-dt">' + esc(c.detail) + '</span>' : '') + '</span></li>';
    });
    h += '</ul>';
    if (rep.items && rep.items.length) {
      h += '<details class="chk-tbl"><summary>تفصيل المفردات (' + rep.items.length + ')</summary><table>';
      h += '<tr><th>#</th><th>الدرجة</th><th>خيارات</th><th>بداية السؤال</th></tr>';
      rep.items.forEach(function (it) {
        h += '<tr><td>' + it.n + '</td><td>' + (it.marks == null ? '—' : it.marks) + '</td>'
          + '<td>' + (it.mcq ? (it.opts || 0) : '—') + '</td><td class="chk-q">' + esc(it.start || '') + '</td></tr>';
      });
      h += '</table></details>';
    }
    out.innerHTML = h;
  }

  async function run() {
    var out = $('#chkOut'), stat = $('#chkStat'), btn = $('#chkRun');
    var gEl = document.querySelector('input[name="chkGrade"]:checked');
    var grade = (gEl && gEl.value) || 'الحادي عشر';
    var withAns = ($('#chkAns') ? !!$('#chkAns').checked : true);
    var txt = ($('#chkText') && $('#chkText').value || '').trim();
    var f = droppedFile || ($('#chkFile') && $('#chkFile').files && $('#chkFile').files[0]);
    if (!txt && !f) {
      if (out) out.innerHTML = '<p class="chk-err">اختر ملفًا أو الصق نصّ الورقة أولًا.</p>';
      return;
    }
    if (btn) btn.disabled = true;
    if (stat) stat.textContent = 'جارٍ التحليل…';
    var source = 'text';
    try {
      if (!txt && f) {
        var buf = await f.arrayBuffer();
        var nm = (f.name || '').toLowerCase();
        if (/\.docx$/.test(nm) || /wordprocessingml/.test(f.type || '')) { txt = xmlToText(await readDocxEntries(buf)); source = 'docx'; }
        else if (/\.pdf$/.test(nm) || f.type === 'application/pdf') { txt = await readPdf(buf); source = 'pdf'; }
        else if (/\.txt$/.test(nm) || /^text\//.test(f.type || '')) { txt = new TextDecoder().decode(buf); source = 'txt'; }
        else { txt = new TextDecoder().decode(buf); source = 'txt'; }
      }
      if (!txt || txt.replace(/\s/g, '').length < 20) throw new Error('لم أستخرج نصًّا كافيًا — ربما الملف صور ممسوحة (يحتاج OCR). الصق النصّ بدلًا من ذلك.');
      if (stat) stat.textContent = 'جارٍ الفحص…';
      var r = await fetch('/api/checkquiz', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: txt, grade: grade, source: source, withAnswer: withAns }),
      });
      var rep = await r.json();
      if (!r.ok) throw new Error(rep && rep.error || 'تعذّر الفحص');
      // ملف تعذّرت قراءته بدقة (PDF بصري أو صور ممسوحة): نوضّح بدل عرض تقرير خاطئ
      if (rep && rep.unreadable) {
        if (out) out.innerHTML = '<div class="chk-note"><b>تعذّرت قراءة هذا الملف بدقة</b><br>' + esc(rep.message) + '</div>';
        if (stat) stat.textContent = '';
        if (btn) btn.disabled = false;
        return;
      }
      // PDF: غالبًا يخرج النصّ معكوسًا فيصعب الحكم على الصياغة — نوسمه
      // لو عُكس النصّ تلقائيًّا (PDF بصري) صار قابلًا للحكم على الصياغة أيضًا.

      // ورقة خارجية بصيغة PDF: نُنبه أن بعض القواعد قد لا تُقرأ لالتصاق الكلمات
      if (source === 'pdf') rep.pdfNote = 'قراءة PDF تقريبية: قد تلتصق بعض الكلمات وتُفقد الدرجات أو الخيارات. للدقة الكاملة ارفع نسخة Word أو الصق النصّ.';
      render(rep);
      if (stat) stat.textContent = txt.length.toLocaleString('ar') + ' حرفًا · ' + ({ docx: 'Word', pdf: 'PDF', text: 'نصّ', txt: 'نصّ' }[source] || '');
    } catch (e) {
      if (out) out.innerHTML = '<p class="chk-err">' + esc(e.message || 'خطأ') + '</p>';
      if (stat) stat.textContent = '';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // الملف المسحوب يُحفظ هنا لأن تعيين input.files قد يُرفض في بعض المتصفحات —
  // فكان السحب يُفتح ويقول «اختر ملفًا» بلا فائدة.
  var droppedFile = null;

  // شريط تأكيد **واضح** بعد الرفع: الاسم والحجم والنوع بلون أخضر بارز، مع زر إزالة.
  // كان التأكيد سطرًا رماديًّا صغيرًا أسفل الزر فلا يُلاحظ أن الرفع تمّ.
  function showFile(f) {
    var bar = $('#chkFileOk'), txt = $('#chkFileOkTxt'), drop = $('#chkDrop'), st = $('#chkStat');
    if (!bar || !txt) return;
    var ext = (f.name.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
    var kind = ext === 'docx' ? 'Word' : ext === 'pdf' ? 'PDF' : ext === 'txt' ? 'نصّ' : (ext || 'ملف');
    var kb = f.size < 1024 ? f.size + ' بايت' : Math.round(f.size / 1024) + ' KB';
    // <bdi> يعزل اتجاه اسم الملف والحجم (لاتيني) عن النصّ العربي فلا يتشابكان
    txt.innerHTML = 'تم اختيار الملف: <bdi>' + esc(f.name) + '</bdi> · <bdi>' + esc(kb) + '</bdi> · ' + esc(kind) + ' — جاهز للفحص';
    bar.hidden = false;
    if (drop) drop.classList.add('has');
    if (st) st.textContent = '';
  }
  function clearFile() {
    var bar = $('#chkFileOk'), inp = $('#chkFile'), drop = $('#chkDrop'), st = $('#chkStat'), out = $('#chkOut');
    droppedFile = null;
    if (inp) { try { inp.value = ''; } catch (e) { } }
    if (bar) bar.hidden = true;
    if (drop) drop.classList.remove('has');
    if (st) st.textContent = '';
    if (out) out.innerHTML = '';
  }

  function init() {
    var drop = $('#chkDrop'), inp = $('#chkFile'), pick = $('#chkRun'), panel = $('#chkPanel');
    if (!drop || !inp) return;
    drop.addEventListener('click', function () { inp.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      droppedFile = null;
      if (f) showFile(f); else clearFile();
    });
    var clr = $('#chkFileClear');
    if (clr) clr.addEventListener('click', function (e) { e.stopPropagation(); clearFile(); });
    function takeDrop(e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      droppedFile = f;
      try { var dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; } catch (err) { }
      showFile(f);
      run();
    }
    // نستقبل السحب على الصندوق **وعلى القسم كله** حتى لا يفتح المتصفح الملف
    // إن أفلته المعلّم خارج الصندوق بقليل.
    [drop, panel].forEach(function (zone) {
      if (!zone) return;
      ['dragenter', 'dragover'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); });
      });
      ['dragleave'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { if (zone === drop) drop.classList.remove('over'); });
      });
      zone.addEventListener('drop', takeDrop);
    });
    // منع المتصفح من فتح الملف لو أُفلت في أي مكان آخر من الصفحة
    window.addEventListener('dragover', function (e) { e.preventDefault(); }, false);
    window.addEventListener('drop', function (e) { e.preventDefault(); }, false);
    if (pick) pick.addEventListener('click', run);
  }
  // منفذ تشخيص (للاختبار الآلي فقط): يتيح فحص ما يُستخرج من الملفات بدقّة.
  try { window.__tahdirChk = { readPdf: readPdf, readDocxEntries: readDocxEntries, xmlToText: xmlToText }; } catch (e) { }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
