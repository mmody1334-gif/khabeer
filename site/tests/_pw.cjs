// يُشغَّل قبل أي اختبار: يضمن وجود سيرفر محلّي حديث ويطبع عنوانه.
// الاستخدام في الاختبارات:  const { chromium, findChrome, BASE } = await require('./_pw.cjs').boot();
const path = require('path');
const fs = require('fs');

function loadPlaywright() {
  const tries = [
    'playwright-core',
    'playwright',
    path.join(process.cwd(), 'node_modules', 'playwright-core'),
    path.join(__dirname, 'node_modules', 'playwright-core'),
    'C:\\Users\\mmody\\Documents\\deepseek-harness\\default-workspace\\.e2e\\node_modules\\playwright-core',
  ];
  for (const t of tries) {
    try { return require(t); } catch (e) { /* جرّب التالي */ }
  }
  throw new Error('لم أجد playwright-core. ثبّته: npm i playwright-core  ثم شغّل الاختبار.');
}

function findChrome() {
  const cands = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  for (const c of cands) { if (fs.existsSync(c)) return c; }
  return undefined;
}

const { spawn } = require('child_process');
const http = require('http');

function ping(port) {
  return new Promise(res => {
    const req = http.get({ host: '127.0.0.1', port, path: '/version', timeout: 1500 }, r => { r.resume(); res(r.statusCode === 200); });
    req.on('error', () => res(false));
    req.on('timeout', () => { req.destroy(); res(false); });
  });
}

function getVersion(port) {
  return new Promise(res => {
    const req = http.get({ host: '127.0.0.1', port, path: '/version', timeout: 1500 }, r => {
      let b = ''; r.on('data', d => b += d);
      r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { res(null); } });
    });
    req.on('error', () => res(null));
    req.on('timeout', () => { req.destroy(); res(null); });
  });
}

async function boot(opts) {
  const port = +(opts && opts.port || process.env.PORT || 8787);
  const buildAt = (() => { try { return fs.statSync(path.join(__dirname, '../dist/worker.js')).mtimeMs; } catch (e) { return 0; } })();
  let child = null;
  if (await ping(port)) {
    const v = await getVersion(port);
    const at = v && v.at ? Date.parse(v.at.replace(' ', 'T') + ':00Z') : 0;
    if (buildAt && at && at < buildAt - 120000) {
      throw new Error('السيرفر على المنفذ ' + port + ' يخدم بناءً أقدم من site/dist/worker.js.\n' +
        '  نسخة السيرفر: ' + v.at + '\n  بناء worker.js: ' + new Date(buildAt).toISOString() + '\n' +
        '  اقتل السيرفر القديم ثم أعد المحاولة، أو شغّل: node devserver.mjs ' + port);
    }
  } else {
    child = spawn(process.execPath, ['--experimental-sqlite', 'devserver.mjs', String(port)],
      { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let up = false;
    child.stdout.on('data', d => { out += String(d); if (/listening/.test(out)) up = true; });
    child.stderr.on('data', d => { out += String(d); });
    for (let i = 0; i < 40 && !up; i++) await new Promise(r => setTimeout(r, 200));
    if (!up) { try { child.kill(); } catch (e) {} throw new Error('devserver لم يبدأ:\n' + out); }
  }
  const stop = () => { if (child) { try { child.kill(); } catch (e) {} child = null; } };
  process.on('exit', stop);
  process.on('SIGINT', () => { stop(); process.exit(130); });
  return { chromium: loadPlaywright().chromium, findChrome, BASE: 'http://localhost:' + port, port, stop, startedByUs: !!child };
}

module.exports = { boot, loadPlaywright, findChrome, chromium: loadPlaywright().chromium };
