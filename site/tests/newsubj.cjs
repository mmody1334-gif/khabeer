const { chromium } = require('playwright');
async function pickC(p, sel, key) { const s = key.split('|')[0]; if (await p.isVisible(sel + 'Subj')) { if (await p.inputValue(sel + 'Subj') !== s) { await p.selectOption(sel + 'Subj', s); await p.waitForTimeout(700); } } if (await p.inputValue(sel) !== key) { await p.selectOption(sel, key); await p.waitForTimeout(900); } }
const B='http://localhost:8787';
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:1300,height:900}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(B+'/');await p.fill('#username','mohamed');await p.fill('#password',(process.env.TEST_PASS||''));await p.fill('#password2',(process.env.TEST_PASS||''));await p.click('#setupForm button[type=submit]');
await p.waitForURL(B+'/');await p.fill('#username','mohamed');await p.fill('#password',(process.env.TEST_PASS||''));await p.click('#loginBtn');await p.waitForURL(B+'/admin');
for(const k of ['العلوم|السابع','الفيزياء|التاسع','الفيزياء|العاشر','العلوم|السادس','الكيمياء|الثاني عشر']){
 await p.goto(B+'/quiz');await p.waitForSelector('#courseSel');await pickC(p,'#courseSel',k);await p.waitForSelector('[data-lid]');
 const ids=await p.$$eval('[data-lid]:not([disabled])',e=>e.slice(1,4).map(x=>x.getAttribute('data-lid')));for(const i of ids)await p.check('[data-lid="'+i+'"]');
 await p.click('#makeBtn');await p.waitForSelector('.checks');const ch=await p.$eval('.checks',e=>e.innerText.split('\n')[0]);
 await p.goto(B+'/remedial');await p.waitForSelector('#courseSel');await pickC(p,'#courseSel',k);await p.waitForSelector('[data-lid]');await p.check('[data-lid]:not([disabled]) >> nth=1');await p.click('#makeBtn');await p.waitForSelector('#stTbl');await p.click('[data-part="cls"]');await p.waitForTimeout(400);
 const n=await p.$eval('#paper',e=>(e.innerText.match(/س\d+\./g)||[]).length);
 console.log(k,'| quiz:',ch.slice(0,70),'| class Qs:',n);
}
await p.screenshot({path:'/tmp/claude-0/-home-claude-tahdir-app/0c317531-7d49-5838-9e9a-1ef869cbd305/scratchpad/brand/shots/chem12_cls.png'});
console.log('errors',errs);await b.close();})();
