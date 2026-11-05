// يتحقق من مطابقة الاختبار القصير لجدول المواصفات في كل الصفوف، مع اختيارات دروس عشوائية
const { chromium } = require('playwright');
async function pickC(p, sel, key) { const s = key.split('|')[0]; if (await p.isVisible(sel + 'Subj')) { if (await p.inputValue(sel + 'Subj') !== s) { await p.selectOption(sel + 'Subj', s); await p.waitForTimeout(600); } } if (await p.inputValue(sel) !== key) await p.selectOption(sel, key); }
const B = 'http://localhost:8787';
(async () => {
  const b = await chromium.launch(); const c = await b.newContext(); const p = await c.newPage();
  await p.goto(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]');
  await p.waitForURL(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForURL(B + '/admin');
  await p.goto(B + '/quiz'); await p.waitForSelector('#courseSel');
  console.log('quiz courses:', await p.$$eval('#courseSel option', o => o.map(x => x.textContent)));
  for (const g of ['العلوم|الخامس', 'الأحياء|التاسع', 'الأحياء|العاشر', 'الأحياء|الحادي عشر', 'الأحياء|الثاني عشر']) {
    await pickC(p, '#courseSel', g); await p.waitForSelector('[data-lid]'); await p.waitForTimeout(300);
    const r = await p.evaluate(async () => {
      const all = [...document.querySelectorAll('[data-lid]:not([disabled])')].map(x => x.getAttribute('data-lid'));
      let ok = 0, fails = {}, N = 40, mcqMax = 0, mcqCounts = {};
      for (let t = 0; t < N; t++) {
        document.querySelectorAll('[data-lid]').forEach(x => { if (x.checked) x.click(); });
        const k = 2 + Math.floor(Math.random() * 4), start = Math.floor(Math.random() * (all.length - k));
        // دروس متتالية (كما يفعل المعلم عادة)
        for (let i = 0; i < k; i++) document.querySelector(`[data-lid="${all[start + i]}"]`).click();
        document.getElementById('makeBtn').click(); await new Promise(r => setTimeout(r, 30));
        const box = document.querySelector('.checks'); if (!box) continue;
        const m = box.innerText.match(/اختيار من متعدد: (\d+)/); if (m) mcqCounts[m[1]] = (mcqCounts[m[1]] || 0) + 1;
        if (box.classList.contains('ok')) ok++; else [...box.querySelectorAll('li.n')].forEach(li => { const k2 = li.textContent.replace(/\d+/g, '#'); fails[k2] = (fails[k2] || 0) + 1; });
      }
      return { ok, N, mcqCounts, fails };
    });
    console.log(g, JSON.stringify(r));
  }
  await b.close();
})();
