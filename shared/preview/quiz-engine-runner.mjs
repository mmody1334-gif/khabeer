import fs from 'fs'; import readline from 'readline';
globalThis.window = globalThis;
(0, eval)(fs.readFileSync(process.argv[2], 'utf8'));
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async l => {
  const t = l.indexOf('\t'), id = l.slice(0, t), expr = l.slice(t + 1);
  let o; try { const r = await (0, eval)('(' + expr + ')'); o = { ok: r === undefined ? null : r }; } catch (e) { o = { err: String(e && e.message || e) }; }
  process.stdout.write(id + '\t' + JSON.stringify(o) + '\n');
});
