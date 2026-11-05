const { chromium } = require('playwright');
async function pickC(p, sel, key) { const s = key.split('|')[0]; if (await p.isVisible(sel + 'Subj')) { if (await p.inputValue(sel + 'Subj') !== s) { await p.selectOption(sel + 'Subj', s); await p.waitForTimeout(600); } } if (await p.inputValue(sel) !== key) await p.selectOption(sel, key); }
const B = 'http://localhost:8787', OUT = __dirname + '/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|TUNNEL/.test(m.text())) errs.push(m.text()); });
  await p.goto(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.fill('#password2', (process.env.TEST_PASS||'')); await p.click('#setupForm button[type=submit]');
  await p.waitForURL(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', (process.env.TEST_PASS||'')); await p.click('#loginBtn'); await p.waitForURL(B + '/admin');
  await p.goto(B + '/games'); await p.waitForSelector('#courseSel');
  await pickC(p, '#courseSel', 'الأحياء|الثاني عشر'); await p.waitForSelector('[data-unit="1"]'); await p.check('[data-unit="1"]'); await p.waitForTimeout(200);
  console.log('g12 order:', await p.$$eval('.g-cards > *', e => e.map(x => x.tagName === 'H3' ? '## ' + x.textContent : x.querySelector('b').textContent + (x.classList.contains('off') ? '(off)' : ''))));
  await p.screenshot({ path: OUT + 't_home12.png', fullPage: true });
  const play = async id => { await p.click(`[data-game="${id}"]`); await p.waitForSelector('#stage'); };
  // myth
  await play('myth'); await p.waitForSelector('.claim'); await p.click('[data-tp="0"][data-v="0"]'); await p.click('[data-tp="1"][data-v="1"]'); await p.click('#myRev');
  console.log('myth scores:', await p.$$eval('.sc-v', e => e.map(x => x.textContent)), (await p.textContent('#myAns')).slice(0, 80));
  await p.screenshot({ path: OUT + 't_myth.png' }); await p.click('#gBack');
  // seq
  await play('seq'); await p.waitForSelector('[data-s]'); const n = await p.$$eval('[data-s]', e => e.length);
  for (let i = 0; i < n; i++) await p.click(`[data-s="${i}"]`);
  await p.screenshot({ path: OUT + 't_seq.png' }); await p.click('#sqCheck'); await p.waitForSelector('#sqNext');
  console.log('seq steps', n, 'ok/no:', await p.$$eval('.seq-c.ok', e => e.length), await p.$$eval('.seq-c.no', e => e.length), 'score', await p.$$eval('.sc-v', e => e.map(x => x.textContent)));
  await p.screenshot({ path: OUT + 't_seq_done.png' }); await p.click('#gBack');
  // case
  await play('case'); await p.waitForSelector('#csClue'); await p.click('#csClue'); console.log('case pts after clue:', await p.textContent('.case-pts b'));
  await p.click('#csSolve'); await p.click('[data-plus="1"]'); console.log('case scores:', await p.$$eval('.sc-v', e => e.map(x => x.textContent)));
  await p.screenshot({ path: OUT + 't_case.png' }); await p.click('#gBack');
  // bet
  await play('bet'); await p.waitForSelector('[data-tp]'); await p.click('[data-tp="0"][data-v="0"]'); await p.click('[data-tb="0"][data-v="3"]'); await p.click('[data-tp="1"][data-v="1"]'); await p.click('#btRev');
  console.log('bet scores:', await p.$$eval('.sc-v', e => e.map(x => x.textContent)));
  await p.screenshot({ path: OUT + 't_bet.png' }); await p.click('#gBack');
  // links
  await play('links'); await p.waitForSelector('.lk-pair'); await p.click('#lkShow'); console.log('link answer:', (await p.textContent('#lkAns')).slice(0, 90));
  await p.screenshot({ path: OUT + 't_links.png' }); await p.click('#gBack');
  // grade 10 + grade 9 visibility
  await pickC(p, '#courseSel', 'الأحياء|العاشر'); await p.waitForSelector('[data-unit="1"]'); await p.check('[data-unit="1"]'); await p.waitForTimeout(200);
  console.log('g10 teen cards:', await p.$$eval('.g-card', e => e.slice(0, 5).map(x => x.querySelector('b').textContent + (x.classList.contains('off') ? '(off)' : '') + '[' + x.querySelector('.g-tags').innerText.replace(/\s+/g, ' ') + ']')));
  await pickC(p, '#courseSel', 'الأحياء|التاسع'); await p.waitForSelector('[data-unit="1"]'); await p.check('[data-unit="1"]'); await p.waitForTimeout(200);
  console.log('g9 last cards:', await p.$$eval('.g-card', e => e.slice(-5).map(x => x.querySelector('b').textContent + '[' + x.querySelector('.g-tags').innerText.replace(/\s+/g, ' ') + ']')));
  console.log('errors', errs); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
