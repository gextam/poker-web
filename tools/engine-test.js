/* Rules-engine tests: blinds, min-raise, side pots, splits, folds. usage: node tools/engine-test.js */
'use strict';
const PK = require('../js/cards.js'); require('../js/engine.js');
const C = PK.cards;
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL', name, extra == null ? '' : JSON.stringify(extra)); } }
function seats(stacks) { return stacks.map((st, i) => ({ id: 'p' + i, name: 'P' + i, stack: st })); }
/* deck builder: cards dealt from the END of the array (deck.pop()). Order of deal: first card to each player left of button, second card each, then burn+flop(3), burn+turn, burn+river. */
function deck(spec) { const cards = C.parseMany(spec); const d = C.shuffle(C.newDeck(), () => 0.5).filter(c => cards.indexOf(c) < 0); return d.concat(cards.slice().reverse()); }

/* 1. three-way all-in with different stacks -> main pot + two side pots */
{
  const S = seats([100, 300, 1000]); const E = new PK.Engine({ seats: S, sb: 5, bb: 10, button: 2 });
  /* button = seat 0 after advance (button starts at 2 -> moves to 0). SB = seat 1, BB = seat 2, first to act = seat 0 */
  /* deal order from seat 1: P1 c1, P2 c1, P0 c1, P1 c2, P2 c2, P0 c2, burn, flop x3, burn, turn, burn, river */
  const d = deck('Ks Kh' + ' ' + 'Qs Qh' + ' ' + 'As Ah' + ' ' + 'Kd Qd Ad' + ' ' + '2c' + ' ' + '7h 9h 2d' + ' ' + '3c' + ' ' + '5s' + ' ' + '4c' + ' ' + '6d');
  /* reorder to deal sequence: P1 c1=Ks, P2 c1=Qs, P0 c1=As, P1 c2=Kh, P2 c2=Qh, P0 c2=Ah */
  const seq = C.parseMany('Ks Qs As Kh Qh Ah 2c 7h 9h 2d 3c 5s 4c 6d');
  const full = C.shuffle(C.newDeck(), () => 0.5).filter(c => seq.indexOf(c) < 0).concat(seq.slice().reverse());
  E.startHand(full);
  check('button moved to seat 0', E.button === 0);
  check('blinds posted', S[1].bet === 5 && S[2].bet === 10 && E.hand.pot === 15);
  check('first actor is seat 0', E.hand.actor === 0);
  check('P0 shoves 100', E.act(0, 'allin'));
  check('P1 shoves 300 (raise re-opens)', E.act(1, 'allin'));
  check('P2 calls', E.act(2, 'call'));
  check('betting over: run-out requested on the flop', E.hand.street === 'flop' && E.hand.actor === -1, E.hand.street);
  let guard = 0; while (!E.hand.done && guard++ < 5) E.continueRunout();   /* the UI paces these with delays */
  check('hand ran out to showdown', E.hand.street === 'showdown' && E.hand.done, E.hand.street);
  const pots = E.hand.pots;
  check('two pots (P2 only called 300)', pots.length === 2, pots);
  check('main pot 300 eligible all', pots[0].amount === 300 && pots[0].eligible.length === 3, pots[0]);
  check('side pot 400 eligible P1,P2', pots[1].amount === 400 && pots[1].eligible.join() === '1,2', pots[1]);
  check('P2 kept the uncalled 700', S[2].stack === 700, S[2].stack);
  /* board 7h 9h 2d 5s 4c: P0 AA, P1 KK, P2 QQ -> P0 wins main (300), P1 wins side1 (400), P2 gets 700 back */
  check('stacks after showdown', S[0].stack === 300 && S[1].stack === 400 && S[2].stack === 700, S.map(s => s.stack));
  check('history recorded', E.history.length === 1 && E.history[0].winners.length === 2);
}
/* 2. split pot with odd chip to first seat after the button */
{
  const S = seats([500, 500, 500]); const E = new PK.Engine({ seats: S, sb: 5, bb: 10, button: 2 });
  const seq = C.parseMany('2c Ah 4c 3d 7c 5d 8h 9s Ts Js 6h Qs 2h Kh');   /* deal order: P1 P2 P0 twice, burn, flop, burn, turn, burn, river -> P2 holds the ace for the ace-high straight */
  const full = C.shuffle(C.newDeck(), () => 0.5).filter(c => seq.indexOf(c) < 0).concat(seq.slice().reverse());
  E.startHand(full);
  E.act(0, 'raise', 30); E.act(1, 'call'); E.act(2, 'call');          /* flop */
  E.act(1, 'check'); E.act(2, 'check'); E.act(0, 'check');            /* turn */
  E.act(1, 'check'); E.act(2, 'check'); E.act(0, 'check');            /* river */
  E.act(1, 'check'); E.act(2, 'check'); E.act(0, 'check');
  check('reached showdown', E.hand.street === 'showdown');
  /* board straight K high for everyone except P2 who has an ace: A-high straight */
  check('P2 wins with ace-high straight', E.hand.winners.length === 1 && E.hand.winners[0].seat === 2 && S[2].stack === 560, E.hand.winners);
}
/* 3. heads-up blinds: button posts small blind and acts first preflop */
{
  const S = seats([200, 200]); const E = new PK.Engine({ seats: S, sb: 5, bb: 10, button: 1 });
  E.startHand();
  check('HU: button is seat 0 and posts SB', E.button === 0 && S[0].bet === 5 && S[1].bet === 10);
  check('HU: button acts first preflop', E.hand.actor === 0);
  E.act(0, 'call'); check('HU: BB option', E.hand.actor === 1 && E.hand.street === 'preflop');
  E.act(1, 'check'); check('HU: flop dealt, BB acts first postflop', E.hand.street === 'flop' && E.hand.actor === 1 && E.hand.board.length === 3);
}
/* 4. minimum raise rule and short all-in not reopening */
{
  const S = seats([1000, 1000, 55]); const E = new PK.Engine({ seats: S, sb: 5, bb: 10, button: 2 });
  E.startHand();
  const la0 = E.legalActions(0); check('min raise to 20 preflop', la0.minRaiseTo === 20, la0);
  E.act(0, 'raise', 30); check('raise to 30 sets min raise 20', E.hand.minRaise === 20 && E.hand.currentBet === 30);
  const la1 = E.legalActions(1); check('next min raise to 50', la1.minRaiseTo === 50, la1);
  E.act(1, 'call');
  E.act(2, 'allin');  /* seat 2 all-in for 55 total: raise by 25 >= minRaise 20 -> full raise */
  check('all-in 55 is a full raise', E.hand.currentBet === 55 && E.hand.minRaise === 25);
  const la0b = E.legalActions(0); check('seat 0 may re-raise after full raise', la0b.canRaise === true);
}
{
  const S = seats([1000, 1000, 45]); const E = new PK.Engine({ seats: S, sb: 5, bb: 10, button: 2 });
  E.startHand(); E.act(0, 'raise', 30); E.act(1, 'call'); E.act(2, 'allin');   /* 45 total: raise by 15 < 20 -> short */
  check('short all-in does not change min raise', E.hand.currentBet === 45 && E.hand.minRaise === 20);
  const la = E.legalActions(0); check('seat 0 capped: may only call the short raise', la.canRaise === false && la.toCall === 15, la);
  E.act(0, 'call'); const la1 = E.legalActions(1); check('seat 1 also capped', la1.canRaise === false);
  E.act(1, 'call'); check('flop after both call', E.hand.street === 'flop');
}
/* 5. everyone folds -> uncontested, bettor gets pot back including blinds */
{
  const S = seats([500, 500, 500]); const E = new PK.Engine({ seats: S, sb: 5, bb: 10, button: 2 });
  E.startHand(); E.act(0, 'raise', 40); E.act(1, 'fold'); E.act(2, 'fold');
  check('uncontested win', E.hand.done && S[0].stack === 515 && E.hand.winners[0].seat === 0, S.map(s => s.stack));
}
console.log(pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
