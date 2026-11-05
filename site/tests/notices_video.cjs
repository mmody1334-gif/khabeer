// إشعار الفيديو الترويجي: كل منصة ترى إعلانها، يظهر في نافذة أول ما تفتح الصفحة (مرة واحدة)، ويبقى في الجرس
const PW = require('./_pw.cjs');
const OUT = process.env.OUT || __dirname;
let pass = 0, fail = 0; const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8821) }); const B = s.BASE;
  const b = await PW.chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: 1280, height: 860 } });
  // الجرس معطّل للاختبارات الآلية (navigator.webdriver): نُظهره هنا كما يراه المعلم
  await c.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
  if (await p.$('#setupForm')) { await p.fill('#name', 'أ. محمد'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500); await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800); }
  if (await p.$('#loginForm')) { await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForTimeout(2500); }
  const k = await p.evaluate(() => fetch('/api/notices?b=k').then(r => r.json()));
  ok('خبير: إعلانها فقط', k.notices.some(n => n.video === '/promo/kabsula.mp4'));
  ok('ملف الفيديو يُخدم', await p.evaluate(() => fetch('/pv/kabsula.mp4', { headers: { Range: 'bytes=0-99' } }).then(async r => r.status === 206 && (await r.arrayBuffer()).byteLength === 100)));
  for (const [path, vid] of [['/quiz', 'kabsula']]) {
    await p.goto(B + path, { waitUntil: 'domcontentloaded' });
    // نافذة الترحيب/الدليل قد تظهر أولًا: نغلق ما ليس فيديو حتى تظهر نافذة الإعلان
    let got = false;
    for (let i = 0; i < 20 && !got; i++) { await p.waitForTimeout(700); got = !!(await p.$('#nvVid')); if (!got) await p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } const t = document.querySelector('.tour-skip,#tourSkip'); t && t.click(); }); }
    ok(path + ': نافذة الفيديو ظهرت عند فتح الصفحة', got);
    if (got) {
      await p.waitForTimeout(1500);
      const st = await p.$eval('#nvVid', v => ({ src: v.getAttribute('src'), t: v.currentTime, h264: !!v.canPlayType('video/mp4; codecs="avc1.640028"') }));
      // Chromium الخاص بالاختبارات بلا H.264 (المتصفحات والتطبيق الحقيقي تدعمه): نتحقق من التشغيل حين يتوفر
      ok(path + ': فيديو المنصة الصحيح' + (st.h264 ? ' يعمل' : ' (متصفح الاختبار بلا H.264)'), st.src === '/pv/' + vid + '.mp4' && (!st.h264 || st.t > 0), JSON.stringify(st));
      await p.screenshot({ path: OUT + '/notice_video_' + vid + '.png' });
      await p.click('#mOk'); await p.waitForTimeout(400);
    }
    await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4500);
    ok(path + ': لا تتكرر بعد قراءتها', !(await p.$('#nvVid')));
    await p.click('#bellBtn'); await p.waitForTimeout(800);
    ok(path + ': الفيديو باقٍ في الجرس', await p.evaluate(v => !!document.querySelector('#bellPanel video.bp-vid[src="/pv/' + v + '.mp4"]'), vid));
    await p.keyboard.press('Escape');
  }
  ok('بلا أخطاء جافاسكربت', !errs.length, errs.join(' | '));
  console.log(pass + ' pass, ' + fail + ' fail');
  await b.close(); process.exit(fail ? 1 : 0);
})();
