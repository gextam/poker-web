#!/usr/bin/env node
/* Documentation screenshots via headless Chrome (muted, deterministic forced deck). usage: node tools/screenshots.mjs */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { openGame, ROOT } from './cdp.mjs';

const OUT = path.join(ROOT, 'docs', 'screenshots');
async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const g = await openGame('mute=1&fast=1');
  const shot = async name => { await g.page.eval('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); await g.page.shot(path.join(OUT, name + '.jpg')); console.log('  saved docs/screenshots/' + name + '.jpg'); };
  const until = async (cond, maxSteps) => g.page.eval(`(() => { let n = 0; while (!(${cond}) && n++ < ${maxSteps || 400}) PK.step(0.1); return (${cond}); })()`);
  try {
    await shot('splash');
    await g.page.eval(`PK.game.forceDeck('2c 3d 4c 5d 6c As 8d 9h Tc Jd Qc Ah Kd 2h 7d 8c Ks Jh Kh Qd'); PK.ui.start(); PK.step(0.45); true`);
    await shot('deal');
    await until('PK.game.canAct()'); await shot('action');
    await g.page.eval(`PK.game.act('raise', 40); true`);
    await until(`PK.game.engine.hand.street === 'flop' && PK.game.canAct()`); await shot('flop');
    await g.page.eval(`(() => { let n = 0; while (!PK.game.engine.hand.done && n++ < 1500) { if (PK.game.canAct()) { const la = PK.game.legal(); PK.game.act(la.canCheck ? 'check' : 'call'); } PK.step(0.1); } PK.step(1.4); return true; })()`);
    await shot('showdown');
    await g.page.eval(`(() => { PK.step(6); let n = 0; while (!PK.game.canAct() && n++ < 600) PK.step(0.1); return true; })()`); await shot('table');
    await g.page.eval('PK.ui.toggleHelp(true); true'); await shot('help');
    await fs.copyFile(path.join(OUT, 'showdown.jpg'), path.join(OUT, 'hero.jpg'));
  } finally { await g.close(); }
  if (g.errors.length) { console.log('PAGE ERRORS:'); g.errors.forEach(e => console.log(' -', e)); process.exitCode = 2; } else console.log('no page errors');
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
