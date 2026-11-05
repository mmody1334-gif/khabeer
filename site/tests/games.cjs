const { chromium } = require('playwright');
async function pickC(p, sel, key) { const s = key.split('|')[0]; if (await p.isVisible(sel + 'Subj')) { if (await p.inputValue(sel + 'Subj') !== s) { await p.selectOption(sel + 'Subj', s); await p.waitForTimeout(600); } } if (await p.inputValue(sel) !== key) await p.selectOption(sel, key); }
const B = 'http://localhost:8787', OUT = __dirname + '/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (o = {}) => { const c = await b.newContext({ viewport: { width: 1360, height: 900 }, ...o }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|TUNNEL/.test(m.text())) errs.push(m.text()); }); return [c, p]; };
  const [ac, p] = await mk();
  await p.goto(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]');
  await p.waitForURL(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForURL(B + '/admin');
  await p.goto(B + '/app'); await p.waitForSelector('#menuBtn'); await p.click('#menuBtn'); await p.click('#menuList a[href="/games"]'); await p.waitForURL(B + '/games');
  await p.waitForSelector('#courseSel'); await pickC(p, '#courseSel', 'الأحياء|الحادي عشر'); await p.waitForSelector('[data-unit]');
  await p.check('[data-unit="1"]'); await p.waitForTimeout(200);
  console.log('sel info:', await p.textContent('#selInfo'));
  console.log('cards:', await p.$$eval('.g-card', e => e.map(x => x.querySelector('b').textContent + (x.classList.contains('off') ? '(off)' : '') + ' [' + x.querySelector('.g-tags').innerText.replace(/\s+/g, ' ') + ']')));
  await p.screenshot({ path: OUT + 'g_home.png', fullPage: true });
  const play = async (id) => { await p.click(`[data-game="${id}"]`); await p.waitForSelector('#stage'); };
  // jeopardy
  await play('jeopardy'); await p.waitForSelector('.jp-t'); console.log('jeopardy tiles:', await p.$$eval('.jp-t:not(.done)', e => e.length));
  await p.screenshot({ path: OUT + 'g_jeopardy.png' });
  await p.click('.jp-t >> nth=3'); await p.waitForSelector('#jpShow'); await p.click('#jpShow'); await p.click('[data-plus="0"]'); await p.screenshot({ path: OUT + 'g_jp_q.png' }); await p.click('#jpBack');
  console.log('team scores:', await p.$$eval('.sc-v', e => e.map(x => x.textContent)));
  await p.click('#gBack');
  // millionaire
  await play('millionaire'); await p.waitForSelector('[data-o]'); await p.click('#h50'); console.log('50:50 removed:', await p.$$eval('.lv-opt.gone', e => e.length));
  await p.screenshot({ path: OUT + 'g_mil.png' });
  await p.click('[data-o]:not(.gone) >> nth=0'); await p.waitForTimeout(2600); console.log('millionaire after answer:', (await p.textContent('#gBody')).slice(0, 60).replace(/\s+/g, ' '));
  await p.click('#gBack');
  // escape
  await play('escape'); await p.waitForSelector('[data-l]'); console.log('locks:', await p.$$eval('[data-l]', e => e.length));
  await p.click('[data-l="0"]'); await p.waitForSelector('[data-a]'); await p.screenshot({ path: OUT + 'g_escape.png' }); await p.click('#gBack');
  // memory
  await play('memory'); await p.waitForSelector('[data-m]'); console.log('memory cards:', await p.$$eval('[data-m]', e => e.length));
  await p.click('[data-m="0"]'); await p.click('[data-m="1"]'); await p.waitForTimeout(1500); await p.screenshot({ path: OUT + 'g_memory.png' }); await p.click('#gBack');
  // wheel
  await play('wheel'); await p.click('#whSpin'); await p.waitForTimeout(4400); console.log('wheel picked:', (await p.textContent('.wh-who')).replace(/\s+/g, ' '));
  await p.screenshot({ path: OUT + 'g_wheel.png' }); await p.click('#gBack');
  // cards
  await play('cards'); await p.click('#fc'); console.log('flashcard flipped:', await p.$eval('#fc', e => e.classList.contains('flip'))); await p.screenshot({ path: OUT + 'g_cards.png' }); await p.click('#gBack');
  // grade 5 word search
  await pickC(p, '#courseSel', 'العلوم|الخامس'); await p.waitForSelector('[data-unit]'); await p.check('[data-unit="3"]'); await p.waitForTimeout(200);
  await play('words'); await p.waitForSelector('.ws-c'); console.log('grade5 words:', await p.$$eval('.ws-list span.w', e => e.map(x => x.textContent)));
  await p.screenshot({ path: OUT + 'g_words5.png' }); await p.click('#gBack');
  // English
  await pickC(p, '#courseSel', 'اللغة الإنجليزية|التاسع'); await p.waitForSelector('[data-unit]'); await p.check('[data-unit="1"]'); await p.waitForTimeout(200);
  console.log('EN cards:', await p.$$eval('.g-card', e => e.map(x => x.querySelector('b').textContent + (x.classList.contains('off') ? '(off)' : ''))));
  await play('words'); await p.waitForSelector('.ws-c'); console.log('EN words:', await p.$$eval('.ws-list span.w', e => e.map(x => x.textContent)));
  await p.screenshot({ path: OUT + 'g_words_en.png' }); await p.click('#gBack');
  // ---- live challenge (grade 12)
  await pickC(p, '#courseSel', 'الأحياء|الثاني عشر'); await p.waitForSelector('[data-unit]'); await p.check('[data-unit="2"]'); await p.waitForTimeout(200);
  await play('live'); await p.fill('#lvN', '3'); await p.click('#lvGo'); await p.waitForSelector('.lv-code');
  const code = (await p.textContent('.lv-code')).replace(/\D/g, ''); console.log('room code', code);
  await p.screenshot({ path: OUT + 'g_live_lobby.png' });
  const phones = [];
  for (const name of ['أحمد', 'سالم', 'مريم']) {
    const [c, ph] = await mk({ viewport: { width: 390, height: 844 }, isMobile: true });
    await ph.goto(B + '/play?c=' + code); await ph.fill('#jn', name); await ph.click('.pl-go'); await ph.waitForSelector('.pl-big'); phones.push(ph);
  }
  await p.waitForTimeout(1500); console.log('lobby players:', await p.$$eval('.lv-players .chip', e => e.map(x => x.textContent)));
  await p.click('#lvStart');
  for (let qn = 0; qn < 3; qn++) {
    await Promise.all(phones.map(ph => ph.waitForSelector('[data-c]', { timeout: 8000 })));
    if (qn === 0) await phones[0].screenshot({ path: OUT + 'g_phone_q.png' });
    // each phone answers a different option
    for (let i = 0; i < phones.length; i++) await phones[i].click(`[data-c="${i % 4}"]`);
    await p.waitForSelector('#lvNext', { timeout: 8000 }); // auto reveal after all answered
    if (qn === 0) { await p.screenshot({ path: OUT + 'g_live_reveal.png' }); await phones[0].waitForSelector('.pl-rank', { timeout: 5000 }); await phones[0].screenshot({ path: OUT + 'g_phone_reveal.png' }); }
    await p.click('#lvNext');
  }
  await p.waitForSelector('.podium', { timeout: 8000 }); console.log('final:', await p.$$eval('.lv-lead.full .lr', e => e.map(x => x.innerText.replace(/\s+/g, ' '))));
  await p.screenshot({ path: OUT + 'g_live_end.png' });
  await phones[1].waitForSelector('#plNew', { timeout: 6000 }); console.log('phone end:', (await phones[1].textContent('.pl-card')).replace(/\s+/g, ' ').slice(0, 80));
  // security: answer after end, wrong token
  console.log('bad token state:', await phones[2].evaluate(c => fetch('/api/play/state?code=' + c + '&pid=1&t=xx').then(r => r.json()), code));
  console.log('teacher live api as anon:', await (await (await b.newContext()).request.get(B + '/api/live/state?code=' + code)).status());
  // report
  await p.goto(B + '/admin'); await p.waitForSelector('[data-tab="report"]'); await p.click('[data-tab="report"]'); await p.waitForSelector('#csvBtn');
  console.log('report:', await p.$$eval('.tbl thead th', e => e.map(x => x.textContent).join('|')));
  console.log('errors', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
