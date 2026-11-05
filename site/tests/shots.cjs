const { chromium } = require('playwright');
async function pickC(p, sel, key) { const s = key.split('|')[0]; if (await p.isVisible(sel + 'Subj')) { if (await p.inputValue(sel + 'Subj') !== s) { await p.selectOption(sel + 'Subj', s); await p.waitForTimeout(700); } } if (await p.inputValue(sel) !== key) { await p.selectOption(sel, key); await p.waitForTimeout(700); } }
const B='http://localhost:8787', O='/tmp/claude-0/-home-claude-tahdir-app/0c317531-7d49-5838-9e9a-1ef869cbd305/scratchpad/deck/img/';
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1.5});const p=await c.newPage();
await p.goto(B+'/');await p.fill('#username','mohamed');await p.fill('#password',(process.env.TEST_PASS||''));await p.fill('#password2',(process.env.TEST_PASS||''));await p.click('#setupForm button[type=submit]');
await p.waitForURL(B+'/');await p.fill('#username','mohamed');await p.fill('#password',(process.env.TEST_PASS||''));await p.click('#loginBtn');await p.waitForURL(B+'/admin');
const shot=async n=>{await p.waitForTimeout(700);await p.screenshot({path:O+n+'.png'});};
// prep
await p.goto(B+'/app');await p.waitForSelector('#subjSel');await p.selectOption('#subjSel','الأحياء');await p.waitForTimeout(300);
await p.evaluate(()=>{const el=[...document.querySelectorAll('.g-name')].find(x=>x.textContent.includes('التاسع'));el.closest('button').click();});
await p.waitForTimeout(300);await p.click('.g-body.open .u-btn >> nth=0');await p.click('.l-list.open .l-item >> nth=1');await p.waitForSelector('#sendPrepBtn');await shot('prep');
// quiz
await p.goto(B+'/quiz');await p.waitForSelector('#courseSel');await pickC(p,'#courseSel','الأحياء|التاسع');await p.waitForSelector('[data-lid]');
for(const i of ['4','5','6'])await p.check(`[data-lid="${i}"]`);await p.click('#makeBtn');await p.waitForSelector('.checks');await shot('quiz');
await p.click('[data-pv="key"]');await shot('quiz_key');
// games
await p.goto(B+'/games');await p.waitForSelector('#courseSel');await pickC(p,'#courseSel','الأحياء|الحادي عشر');await p.waitForSelector('[data-unit]');await p.check('[data-unit="1"]');await shot('games');
for(const g of ['jeopardy','millionaire','escape','memory','wheel','live']){try{await p.click(`[data-game="${g}"]`,{timeout:3000});await p.waitForSelector('#stage',{timeout:4000});await p.waitForTimeout(900);await p.screenshot({path:O+'g_'+g+'.png'});await p.click('#gBack',{timeout:2000}).catch(()=>{});await p.waitForTimeout(400);}catch(e){console.log('skip',g);}}
// finals
await p.goto(B+'/finals');await p.waitForSelector('.fin-q img');await pickC(p,'#courseSel','الأحياء|التاسع');await p.waitForSelector('.fin-q img');await p.waitForTimeout(1200);await shot('finals');
// summaries & remedial
await p.goto(B+'/summaries');await p.waitForSelector('#courseSel');await pickC(p,'#courseSel','الأحياء|التاسع');await p.waitForSelector('[data-lid]');await p.check('[data-lid] >> nth=3');await p.click('#makeBtn');await p.waitForSelector('#paper h3');await shot('summary');
await p.goto(B+'/remedial');await p.waitForSelector('#courseSel');await pickC(p,'#courseSel','الأحياء|التاسع');await p.waitForSelector('[data-lid]');await p.check('[data-lid]:not([disabled]) >> nth=2');await p.click('#makeBtn');await p.waitForSelector('#stTbl');await shot('remedial');
await p.goto(B+'/grading');await p.waitForTimeout(1500);await shot('grading');
// mobile
const m=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,storageState:await c.storageState()});const mp=await m.newPage();await mp.goto(B+'/app');await mp.waitForTimeout(1500);await mp.screenshot({path:O+'mobile.png'});
await b.close();})();
