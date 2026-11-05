// «بليكرز — بطاقات الإجابة»: اختبار شامل بكاميرا مُحاكاة (فيديو y4m فيه فصل يرفع البطاقات)
// المعلم (كمبيوتر): يضيف صفًا بأسماء كاملة ← يولّد أسئلة ← يفتح شاشة السبورة
// المعلم (جوال بكاميرا): يفتح رابط المسح ← تُقرأ بطاقات الطلاب ← صح/خطأ لكل طالب باسمه ← السبورة تتزامن
const PW = require('./_pw.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const OUT = process.env.OUT || __dirname;
let pass = 0, fail = 0;
const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
const NAMES = ['علي بن سالم بن محمد بن علي بن الشامسي', 'أحمد سعيد خلفان الكعبي', '3- محمد علي البلوشي', 'عبد الله بن حمد آل سعيد', 'سالم ناصر سالم الهنائي',
  'خالد بن راشد المعمري', 'يوسف أحمد الحوسني', 'فهد سيف الغافري', 'حمد خميس البادي', 'ماجد سليمان الريامي', 'سعود هلال العامري', 'راشد عبيد الكلباني',
  'مازن محمد السيابي', 'هيثم علي الفارسي', 'أيمن سعيد الشكيلي', 'بدر حمود العبري', 'طلال صالح الجابري', 'نواف خالد المقبالي', 'زياد ناصر الحارثي', 'عمر مبارك الشحي'];
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8815) }); const B = s.BASE;
  const errs = [];
  const shut = p => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } });
  // ===== الكمبيوتر =====
  const b1 = await PW.chromium.launch({ headless: true });
  const c1 = await b1.newContext({ viewport: { width: 1366, height: 860 }, locale: 'ar-OM' }); await c1.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await c1.newPage(); p.on('pageerror', e => errs.push('pc: ' + e.message));
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); await shut(p);
  if (await p.$('#setupForm')) { await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500); await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); }
  await shut(p); if (await p.$('#loginForm')) { await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForTimeout(2500); }
  await p.goto(B + '/cards', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000); await shut(p);
  // الاسم والأماكن: «المزيد» + بطاقات الواجهة (خبير) + واجهة تقني وقائمتها
  const places = await p.evaluate(async () => {
    const N = 'كروت الأسئلة (بليكرز)', get = u => fetch(u).then(r => r.text()), d = h => new DOMParser().parseFromString(h, 'text/html');
    const kh = d(await get('/khome'));
    const has = (doc, sel) => [...doc.querySelectorAll(sel)].some(a => a.textContent.includes(N));
    return { menu: has(document, '#menuList a[href="/cards"]'), home: has(kh, 'a[href="/cards"]'), title: document.querySelector('.an-head h2').textContent.includes(N) };
  });
  ok('«كروت الأسئلة (بليكرز)» في المزيد وبطاقات الواجهة', Object.values(places).every(Boolean), JSON.stringify(places));
  // الشرح: يفتح تلقائيًا أول مرة، وصور رفع البطاقة صحيحة (الكاشف نفسه يقرأ كل صورة بإجابتها)
  ok('«طريقة الاستخدام» فُتحت تلقائيًا أول زيارة', await p.evaluate(() => localStorage.getItem('tahdir_cards_help') === '1'));
  await p.click('#ckHelp'); await p.waitForSelector('.ck-help .ck-holds figure');
  await p.screenshot({ path: OUT + '/cards_help.png', fullPage: true });
  const holds = await p.evaluate(async () => {
    const out = [];
    for (const f of document.querySelectorAll('.ck-help .ck-holds figure')) {
      const svg = f.querySelector('svg').outerHTML.replace('<svg ', '<svg width="300" height="300" ');
      const rot = +(f.querySelector('.ck-hold>div').style.transform.match(/-?\d+/)[0]);
      const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await im.decode();
      const c = document.createElement('canvas'); c.width = 500; c.height = 500; const x = c.getContext('2d'); x.fillStyle = '#777'; x.fillRect(0, 0, 500, 500);
      x.translate(250, 250); x.rotate(rot * Math.PI / 180); x.drawImage(im, -150, -150, 300, 300);
      const h = cardDetect(cardGray(x, 500, 500), 500, 500)[0]; out.push(h ? h.ans : -1);
    }
    return out;
  });
  ok('صور الشرح: كل اتجاه يُقرأ بإجابته (أ ب ج د)', holds.join() === '0,1,2,3', holds.join());
  await shut(p); await p.waitForTimeout(300);
  ok('خطوات «دليلك للاستخدام!» لهذه الصفحة', await p.evaluate(() => tourSteps().length === 6 && /بليكرز/.test(tourSteps()[0].title)));
  ok('القسم في «المزيد» باسم كروت الأسئلة (بليكرز)', await p.evaluate(() => /كروت الأسئلة \(بليكرز\)/.test((document.querySelector('#menuList a[href="/cards"]') || {}).textContent || '')));
  // إضافة صف
  await p.click('#cdNewC'); await p.waitForSelector('#cfL');
  await p.fill('#cfT', 'العاشر / 2');
  // صف عاشر في مادة لها أسئلة اختيار من متعدد
  const course = await p.evaluate(async () => { const cs = (await api('/api/courses')).courses.filter(c => c.lessons); for (const c of cs.filter(c => /العاشر/.test(c.grade)).concat(cs)) { const b = await api('/api/quiz/bank?key=' + encodeURIComponent(c.key)); if ((b.items || []).filter(q => q.type === 'mcq').length > 30) return { key: c.key, subject: c.subject }; } });
  await p.selectOption('#cfKSubj', course.subject).catch(() => {}); await p.waitForTimeout(150); await p.selectOption('#cfK', course.key);
  await p.fill('#cfL', NAMES.join('\n')); await p.waitForTimeout(200);
  const pv = await p.$$eval('#cfP input', x => x.map(i => i.value));
  ok('الاسم الأول + القبيلة', pv[0] === 'علي الشامسي' && pv[1] === 'أحمد الكعبي' && pv[2] === 'محمد البلوشي' && pv[3] === 'عبد الله آل سعيد', pv.slice(0, 4).join(' | '));
  await p.screenshot({ path: OUT + '/cards_class.png', fullPage: true });
  await p.click('#cfSave'); await p.waitForTimeout(900); await shut(p); await p.waitForTimeout(800);
  ok('حفظ الصف', (await p.$$('.ck-cc')).length === 1);
  // طباعة البطاقات
  await p.evaluate(() => { window.print = () => { window.__p = document.getElementById('printArea').innerHTML; }; });
  await p.click('[data-pr]'); await p.waitForSelector('input[name=cdps]', { timeout: 8000 }); await p.click('#mOk'); await p.waitForFunction(() => window.__p, null, { timeout: 5000 });
  ok('طباعة بطاقتين في الصفحة (10 صفحات + قائمة التوزيع)', await p.evaluate(() => document.createRange().createContextualFragment(window.__p).querySelectorAll('.ck-pp2').length === 10 && /علي بن سالم/.test(window.__p)));
  await p.evaluate(() => { const a = document.getElementById('printArea'); a.innerHTML = window.__p; document.body.classList.add('printing', 'ck-printing'); });
  await p.emulateMedia({ media: 'print' }); await p.pdf({ path: OUT + '/cards_print.pdf', format: 'A4', printBackground: true, pageRanges: '1-2,11' }); await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => { document.body.classList.remove('printing', 'ck-printing'); document.getElementById('printArea').innerHTML = ''; });
  await p.waitForTimeout(1200); await shut(p);
  // توليد الأسئلة
  await p.click('[data-go]'); await p.waitForSelector('.ck-units summary', { timeout: 15000 });
  await p.click('.ck-units details summary input[type=checkbox]');
  await p.click('[data-cn="5"]'); await p.click('#gGen'); await p.waitForTimeout(300);
  ok('توليد 5 أسئلة من بنك الصف', (await p.$$('#gOut .ck-ql li')).length === 5);
  await p.click('[data-rep="0"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/cards_gen.png', fullPage: true });
  await p.click('#gGo'); await p.waitForSelector('.ck-start', { timeout: 8000 });
  ok('شاشة البدء: عرض على الكمبيوتر + QR للجوال', !!(await p.$('.ck-qr svg')) && !!(await p.$('#stBoard')));
  await p.screenshot({ path: OUT + '/cards_start.png', fullPage: true });
  const S = await p.evaluate(() => api('/api/quizzes?kind=csession').then(r => api('/api/quizzes/' + r.quizzes[0].id)).then(r => ({ id: r.quiz.id, q: r.quiz.data.questions.map(q => q.correct) })));
  const S2 = await p.evaluate(async () => { const c=(await api('/api/quizzes?kind=cclass')).quizzes[0],title='جلسة اختبار عزل البث';return (await api('/api/quizzes',{title,grade:c.grade||'',subject:c.subject||'',kind:'csession',data:{id:null,title,classId:c.id,className:c.title,questions:[],answers:{},cur:0,reveal:false}})).id; });
  await p.click('#stBoard'); await p.waitForSelector('.ck-bqr svg', { timeout: 8000 });
  ok('السبورة تنتظر الجوال وتعرض رمز QR', /امسح الرمز/.test(await p.textContent('#bdW')));
  await p.evaluate(async id=>api('/api/cards/live?sid='+id,{state:{t:Date.now(),sid:id,title:'جلسة أخرى',ended:false}}),S2);
  const isolated=await p.evaluate(async ids=>{const a=await api('/api/cards/live?sid='+ids[0]),b=await api('/api/cards/live?sid='+ids[1]);return {main:a.state,other:b.state&&b.state.title};},[S.id,S2]);
  ok('حالة بث كل جلسة مستقلة ولا تستبدل شاشة جلسة أخرى', !isolated.main&&isolated.other==='جلسة أخرى', JSON.stringify(isolated));
  await p.screenshot({ path: OUT + '/cards_board_wait.png' });
  await p.click('#bdHelp'); await p.waitForTimeout(300);
  ok('السبورة: «شرح للطلاب» يعرض طريقة رفع البطاقة', !(await p.$eval('#bdH', e => e.hidden)) && (await p.$$('#bdH figure')).length === 4);
  await p.screenshot({ path: OUT + '/cards_board_help.png' });
  await p.click('#bdHelp'); await p.waitForTimeout(200);

  // ===== فيديو الكاميرا: 12 طالبًا يرفعون بطاقاتهم =====
  // السؤال 1: الطلاب 1..8 يجيبون الصحيح، 9..12 يجيبون خطأ
  const correct0 = S.q[0], correct1 = S.q[1];
  const ans0 = {}; for (let n = 1; n <= 12; n++) ans0[n] = n <= 8 ? correct0 : (correct0 + 1 + (n % 3)) % 4;
  const ans1 = {}; for (let n = 1; n <= 12; n++) ans1[n] = n % 2 ? correct1 : (correct1 + 2) % 4;
  async function makeVideo(ans, file) {
    const pr = await (await b1.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    await pr.setContent('<body style="margin:0"></body>'); await pr.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../server/client_cardscan.js'), 'utf8') });
    const frames = [];
    for (let f = 0; f < 2; f++) {
      await pr.evaluate(({ ans, f }) => {
        document.body.innerHTML = ''; document.body.style.background = 'linear-gradient(180deg,#d9d2c3,#8f8676)';
        const st = document.createElement('div'); st.style.cssText = 'position:fixed;inset:0;perspective:900px;overflow:hidden'; document.body.appendChild(st);
        Object.keys(ans).forEach((n, i) => {
          const d = document.createElement('div'), size = 92 - Math.floor(i / 6) * 22;
          const r = [0, -90, 180, 90][ans[n]] + ((i * 37) % 30 - 15) + f * 3;
          d.style.cssText = `position:absolute;left:${60 + (i % 6) * 200 + (Math.floor(i / 6) ? 40 : 0)}px;top:${80 + Math.floor(i / 6) * 260}px;width:${size}px;height:${size}px;transform:rotateX(${(i % 5) * 7 - 14}deg) rotateY(${(i % 4) * 9 - 13}deg) rotate(${r}deg)`;
          d.innerHTML = cardSvg(+n, {}).replace('<svg ', '<svg width="100%" height="100%" '); st.appendChild(d);
        });
      }, { ans, f });
      await pr.waitForTimeout(60);
      const b64 = await pr.evaluate(async (png) => { const im = new Image(); im.src = 'data:image/png;base64,' + png; await im.decode(); const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, 1280, 720).data, W = 1280, H = 720, Y = new Uint8Array(W * H), U = new Uint8Array(W * H / 4), V = new Uint8Array(W * H / 4);
        for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { const i = (y * W + xx) * 4; Y[y * W + xx] = (0.257 * d[i] + 0.504 * d[i + 1] + 0.098 * d[i + 2] + 16) | 0; }
        for (let y = 0; y < H; y += 2) for (let xx = 0; xx < W; xx += 2) { const i = (y * W + xx) * 4, j = (y / 2) * (W / 2) + xx / 2; U[j] = (-0.148 * d[i] - 0.291 * d[i + 1] + 0.439 * d[i + 2] + 128) | 0; V[j] = (0.439 * d[i] - 0.368 * d[i + 1] - 0.071 * d[i + 2] + 128) | 0; }
        const all = new Uint8Array(Y.length + U.length + V.length); all.set(Y); all.set(U, Y.length); all.set(V, Y.length + U.length);
        let s = ''; for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000)); return btoa(s);
      }, (await pr.screenshot()).toString('base64'));
      frames.push(Buffer.from(b64, 'base64'));
    }
    const parts = [Buffer.from('YUV4MPEG2 W1280 H720 F10:1 Ip A1:1 C420jpeg\n')];
    for (let k = 0; k < 20; k++) { parts.push(Buffer.from('FRAME\n')); parts.push(frames[k % 2]); }
    fs.writeFileSync(file, Buffer.concat(parts)); await pr.context().close();
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cam-'));
  await makeVideo(ans0, dir + '/q1.y4m'); await makeVideo(ans1, dir + '/q2.y4m');

  // ===== الجوال بالكاميرا =====
  async function phone(video, injectLiveFailure) {
    const b = await PW.chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + video] });
    const c = await b.newContext({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true, locale: 'ar-OM', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36', permissions: ['camera'] });
    await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const q = await c.newPage(); q.on('pageerror', e => errs.push('phone: ' + e.message));
    if(injectLiveFailure)await q.addInitScript(()=>{window.__forcedFailures={live:true};const nativeFetch=window.fetch.bind(window);window.fetch=function(input,init){const u=typeof input==='string'?input:input.url,p=new URL(u,location.href).pathname,m=((init&&init.method)||'GET').toUpperCase();if(m==='POST'&&p==='/api/cards/live'&&window.__forcedFailures.live){window.__forcedFailures.live=false;return Promise.reject(new TypeError('Injected network failure'));}return nativeFetch(input,init);};});
    await q.goto(B + '/', { waitUntil: 'domcontentloaded' }); await q.waitForTimeout(600); await shut(q);
    if (await q.$('#loginForm')) { await q.fill('#username', 'mohamed'); await q.fill('#password', (process.env.TEST_PASS||'')); await q.click('#loginBtn'); await q.waitForTimeout(2000); }
    await q.goto(B + '/cards?scan=' + S.id, { waitUntil: 'domcontentloaded' });
    await q.waitForSelector('#cdLive', { timeout: 15000 }); await shut(q);
    return { b, q, c };
  }
  let ph = await phone(dir + '/q1.y4m', true), q = ph.q;
  await ph.c.setOffline(true);
  await q.waitForFunction(() => /^12/.test((document.querySelector('.ck-cnt') || {}).textContent || ''), null, { timeout: 25000 }).catch(() => {});
  const cnt1 = await q.textContent('.ck-cnt');
  ok('الجوال يقرأ 12 بطاقة معًا في السؤال 1', /^12\s*\/\s*20/.test(cnt1.trim()), cnt1);
  await q.waitForTimeout(1800);
  const offlineBackup=await q.evaluate(id=>!!localStorage.getItem('tahdir_cards_pending_'+id),S.id);
  const offlineCount=await p.evaluate(async id=>{const r=await api('/api/quizzes/'+id);return Object.keys((r.quiz.data.answers||{})[0]||{}).length;},S.id);
  ok('أثناء انقطاع الإنترنت: تُحفظ نسخة محلية ولا يُدّعى حفظها على الخادم',offlineBackup&&offlineCount<12,'local='+offlineBackup+'; server='+offlineCount);
  await ph.c.setOffline(false); await q.waitForTimeout(400); await q.screenshot({ path: OUT + '/cards_phone_scan.png' });
  // السبورة تتزامن
  await p.waitForFunction(() => /أجاب 12 من 20/.test(document.body.textContent), null, { timeout: 8000 }).catch(() => {});
  ok('السبورة على الكمبيوتر تعرض السؤال وعدد من أجاب', /أجاب 12 من 20/.test(await p.textContent('#bdW')) && !!(await p.$('.ck-bq')));
  let injected=await q.evaluate(()=>window.__forcedFailures);
  ok('فشل بث مؤقت من الجوال ← إعادة إرسال تلقائية للسبورة', !injected.live);
  ok('السبورة لا تكشف الإجابة قبل الإظهار', !(await p.$('.ck-bc.ok')));
  const savedAfterRetry=await p.waitForFunction(async id=>{const r=await api('/api/quizzes/'+id);return Object.keys((r.quiz.data.answers||{})[0]||{}).length>=12;},S.id,{timeout:15000}).then(()=>true).catch(()=>false);
  ok('عودة الإنترنت ← تُحفظ الإجابات المعلّقة تلقائيًا على الخادم',savedAfterRetry);
  const backupCleared=await q.waitForFunction(id=>!localStorage.getItem('tahdir_cards_pending_'+id),S.id,{timeout:8000}).then(()=>true).catch(()=>false);
  ok('حُذفت النسخة المحلية المؤقتة بعد تأكيد الحفظ على الخادم',backupCleared);
  await p.screenshot({ path: OUT + '/cards_board_q1.png' });
  await q.click('#lvR'); await p.waitForSelector('.ck-bc.ok', { timeout: 6000 }).catch(() => {});
  ok('إظهار الإجابة من الجوال ← تظهر على السبورة بالنسب', !!(await p.$('.ck-bc.ok')) && /67%/.test(await p.textContent('.ck-bc.ok')), await p.textContent('.ck-bc.ok').catch(() => ''));
  await p.screenshot({ path: OUT + '/cards_board_reveal.png' });
  await q.click('#lvNx'); await p.waitForFunction(() => /السؤال 2 من 5/.test(document.body.textContent), null, { timeout: 6000 }).catch(() => {});
  ok('«التالي» من الجوال ← السؤال 2 على السبورة', /السؤال 2 من 5/.test(await p.textContent('#bdW')));
  await q.waitForTimeout(1800); await ph.b.close();
  // السؤال 2 (الطلاب غيّروا اتجاه البطاقات)
  ph = await phone(dir + '/q2.y4m'); q = ph.q;
  ok('متابعة الجلسة تبدأ من السؤال 2', /السؤال 2/.test(await q.textContent('#lvN')));
  await q.waitForFunction(() => /^12/.test((document.querySelector('.ck-cnt') || {}).textContent || ''), null, { timeout: 25000 }).catch(() => {});
  ok('قراءة السؤال 2', /^12/.test((await q.textContent('.ck-cnt')).trim()));
  await q.click('#lvL'); await q.waitForTimeout(300); await q.screenshot({ path: OUT + '/cards_phone_sheet.png' });
  await q.click('#lvShX');
  await q.click('#lvX'); await q.waitForTimeout(300); await q.click('#mOk'); await q.waitForSelector('.ck-rt', { timeout: 10000 });
  // النتائج: صح/خطأ لكل طالب باسمه
  const res = await q.evaluate(() => [...document.querySelectorAll('.ck-rt tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())));
  let exact = true; const why = [];
  for (let n = 1; n <= 12; n++) {
    const row = res[n - 1], e1 = ans0[n] === correct0, e2 = ans1[n] === correct1;
    const g1 = row[2] === '✓', g2 = row[3] === '✓';
    if (g1 !== e1 || g2 !== e2) { exact = false; why.push(n + ':' + row.slice(2, 4).join('/')); }
  }
  ok('صح/خطأ لكل طالب = الإجابة الفعلية (12 طالبًا × سؤالان، دقة 100%)', exact, why.join(' '));
  ok('الطلاب الذين لم يرفعوا بطاقات = لم يُمسح', res.slice(12).every(r => /لم يُمسح/.test(r.join(' '))));
  ok('الأسماء في النتائج (الاسم الأول + القبيلة)', res[0][1] === 'علي الشامسي' && res[3][1] === 'عبد الله آل سعيد');
  await q.setViewportSize({ width: 400, height: 1400 }); await q.screenshot({ path: OUT + '/cards_results_phone.png' });
  await ph.b.close();
  // ===== الكمبيوتر: النتائج ← التحليل وسجل الصعوبات =====
  await p.goto(B + '/cards', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500); await shut(p);
  await p.click('[data-tab="sessions"]'); await p.click('[data-res="' + S.id + '"]'); await p.waitForSelector('.ck-rt');
  ok('السبورة أُبلغت بانتهاء الجلسة', await p.evaluate(id => api('/api/cards/live?sid='+id).then(r => r.state && r.state.ended === true), S.id));
  await p.screenshot({ path: OUT + '/cards_results.png', fullPage: true });
  await p.click('#rsAn'); await p.waitForTimeout(800);
  const an = await p.evaluate(() => api('/api/quizzes?kind=analysis').then(r => api('/api/quizzes/' + r.quizzes[0].id)).then(r => r.quiz.data));
  ok('«تحليل النتائج»: مفردة لكل سؤال ودرجات الطلاب الممسوحين', an.items.length === 2 && an.students.length === 20 && an.students[0].name === NAMES[0] && an.students[0].s.length === 2 && an.students[19].s.length === 0, an.students[0].s.join(','));
  await p.click('#mOk'); await p.waitForURL(/\/analysis/, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(1800);
  ok('فتح التحليل مباشرة', /analysis/.test(p.url()) && /تحليل/.test(await p.textContent('#anMain')));
  await p.goto(B + '/cards', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500); await shut(p);
  await p.click('[data-tab="sessions"]'); await p.click('[data-res="' + S.id + '"]'); await p.waitForSelector('.ck-rt');
  await p.click('#rsLd'); await p.waitForTimeout(600);
  const lowN = await p.$$eval('[data-lw]', x => x.length);
  await p.click('#mOk'); await p.waitForTimeout(1200);
  const ld = await p.evaluate(() => api('/api/quizzes?kind=ld').then(r => r.quizzes.length ? api('/api/quizzes/' + r.quizzes[0].id).then(r => r.quiz.data) : null));
  const expLow = Object.keys(ans0).filter(n => ((ans0[n] === correct0) + (ans1[n] === correct1)) / 2 < 0.5).length;
  ok('المتعثرون (دون 50%) ← سجل صعوبات التعلم بملاحظة المتابعة', lowN === expLow && ld && ld.students.length === expLow && /تقويم بالبطاقات/.test(ld.students[0].follow[0].n), lowN + '/' + expLow);
  // الكاميرا مسموحة لهذه الصفحة فقط
  const pp = await p.evaluate(async () => [(await fetch('/cards')).headers.get('permissions-policy'), (await fetch('/quiz')).headers.get('permissions-policy')]);
  ok('إذن الكاميرا لصفحة البطاقات فقط', /camera=\(self\)/.test(pp[0]) && /camera=\(\)/.test(pp[1]), pp.join(' | '));
  // بطاقة القسم في الرئيسية التي يراها المعلم (/app): تنقل إلى الصفحة الصحيحة
  for (const [home, dest, key] of [['/app', '/cards', 'cards'], ['/app', '/quiz', 'quiz']]) {
    await p.goto(B + home, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2200); await shut(p); await p.evaluate(() => { const t = document.getElementById('tourOv'); if (t) t.remove(); });
    const card = await p.$('[data-home="' + key + '"]');
    const txt = card ? await card.textContent() : '';
    if (card) { await card.click(); await p.waitForTimeout(1200); }
    ok('بطاقة «' + key + '» في رئيسية ' + home + ' ← ' + dest, (key !== 'cards' || /كروت الأسئلة \(بليكرز\)/.test(txt)) && new URL(p.url()).pathname === dest, txt.trim().slice(0, 40) + ' → ' + p.url());
  }
  ok('بلا أخطاء جافاسكربت', errs.length === 0, errs.join(' | '));
  console.log(`\n${pass} pass, ${fail} fail`); await b1.close(); s.stop && s.stop(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
