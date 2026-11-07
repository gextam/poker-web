#!/usr/bin/env node
/* Headless smoke test: plays hands in Chrome via the DevTools protocol (muted), with the AI
   driving your seat, then a scripted hand with a forced deck. usage: node tools/smoke.mjs */
import { openGame } from './cdp.mjs';

let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) pass++; else fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };

async function main() {
  /* 1. autoplay: many hands, chips conserved (minus re-buys) */
  let g = await openGame('mute=1&fast=1&auto=1');
  try {
    await g.page.eval('PK.ui.start(); PK.step(0.5); true');
    const r = await g.page.eval(`(() => { PK.step(240); let n = 0; while (PK.game.state !== 'between' && n++ < 600) PK.step(0.25);
      const stacks = PK.game.seats.map(s => s.stack), sum = stacks.reduce((a, b) => a + b, 0), rebuys = PK.game.stats.rebuys || 0;
      return JSON.stringify({ hands: PK.game.stats.hands, state: PK.game.state, sum, rebuys, stacks, history: PK.game.engine.history.length, feed: PK.game.feed.length }); })()`);
    const o = JSON.parse(r);
    check('several hands were played by the AI table', o.hands >= 6, o.hands);
    check('chips are conserved across hands (6,000 + re-buys)', o.sum === 6000 + 1000 * o.rebuys, { sum: o.sum, rebuys: o.rebuys });
    check('hand history recorded', o.history === o.hands || o.history === o.hands - 1, o.history);
    const sd = await g.page.eval(`JSON.stringify(PK.game.engine.history.filter(h => h.winners.some(w => w.hand)).slice(0, 3).map(h => h.winners.map(w => w.hand)))`);
    check('showdowns produced named hands', JSON.parse(sd).length > 0, JSON.parse(sd));
  } finally { check('no page errors (autoplay)', g.errors.length === 0, g.errors); await g.close(); }

  /* 2. scripted hand: you hold aces, raise, call down; aces win at showdown */
  g = await openGame('mute=1&fast=1');
  try {
    await g.page.eval(`PK.game.forceDeck('2c 3d 4c 5d 6c As 8d 9h Tc Jd Qc Ah Kd 2h 7d 8c Ks Jh Kh Qd'); PK.ui.start(); PK.step(0.5); true`);
    const r = await g.page.eval(`(() => { const acts = []; let n = 0;
      while (!(PK.game.engine.hand && PK.game.engine.hand.done) && n++ < 2000) {
        if (PK.game.canAct()) { const la = PK.game.legal(); const a = la.canCheck ? 'check' : 'call'; PK.game.act(a); acts.push(a); }
        PK.step(0.2);
      }
      const h = PK.game.engine.history[0];
      return JSON.stringify({ done: !!(PK.game.engine.hand && PK.game.engine.hand.done), acts, hole: PK.game.seats[0].cards.map(PK.cards.str), board: h.board.map(PK.cards.str), winners: h.winners.map(w => ({ seat: w.seat, amount: w.amount, hand: w.hand })), stack: PK.game.seats[0].stack }); })()`);
    const o = JSON.parse(r);
    check('scripted hand completed', o.done, o.acts);
    check('you were dealt the aces', o.hole.join(' ') === 'As Ah', o.hole);
    check('board came as forced', o.board.join(' ') === '2h 7d 8c Jh Qd', o.board);
    check('aces won the pot at showdown', o.winners.some(w => w.seat === 0 && /aces/.test(w.hand)) && o.stack > 1000, o.winners);
    const ui = await g.page.eval(`PK.step(3); PK.ui.toggleHelp(true); const open = !document.getElementById('help').classList.contains('hidden'); PK.ui.toggleHelp(false); JSON.stringify({ open, buttons: ['btn-fold','btn-check','btn-raise','btn-allin','btn-rebuy','btn-help'].every(id => !!document.getElementById(id)), feed: document.getElementById('feed').children.length })`);
    const u = JSON.parse(ui);
    check('help overlay toggles and controls exist', u.open && u.buttons && u.feed > 3, u);
  } finally { check('no page errors (scripted)', g.errors.length === 0, g.errors); await g.close(); }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
