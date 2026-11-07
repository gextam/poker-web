/* Unit tests for the hand evaluator, naming and best-five selection. usage: node tools/eval-test.js */
'use strict';
const PK = require('../js/cards.js');
const C = PK.cards;
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL', name, extra || ''); } }
const ev = s => C.evaluate(C.parseMany(s));
const name = s => C.describe(ev(s));

/* categories */
check('royal flush', ev('As Ks Qs Js Ts 2d 3c').cat === 8 && name('As Ks Qs Js Ts 2d 3c') === 'Royal flush');
check('straight flush 9 high', name('9h 8h 7h 6h 5h Ad Ac') === 'Straight flush, nine high');
check('steel wheel', name('Ah 2h 3h 4h 5h Kd Kc') === 'Straight flush, five high');
check('quads', name('7s 7h 7d 7c Kd 2c 3c') === 'Four of a kind, sevens');
check('quads kicker', ev('7s 7h 7d 7c Kd 2c 3c').value > ev('7s 7h 7d 7c Qd 2c 3c').value);
check('full house kings over tens', name('Ks Kh Kd Ts Th 2c 3c') === 'Full house, kings over tens');
check('full house from two trips', name('Ks Kh Kd Ts Th Td 3c') === 'Full house, kings over tens');
check('full house beats flush', ev('Ks Kh Kd Ts Th 2c 3c').value > ev('As Qs 9s 5s 2s Kd Kc').value);
check('flush king high', name('Ks Qs 9s 5s 2s Ad Jc') === 'Flush, king high');
check('flush uses best five', ev('Ks Qs 9s 5s 2s 3s 4s').ranks.join() === [11, 10, 7, 3, 2].join());
check('straight ten high', name('Th 9s 8d 7c 6h Ad Ac') === 'Straight, ten high');
check('wheel', name('Ah 2s 3d 4c 5h Kd Qc') === 'Straight, five high');
check('ace high straight', name('Ah Ks Qd Jc Th 2d 2c') === 'Straight, ace high');
check('wheel loses to six-high straight', ev('Ah 2s 3d 4c 5h Kd Qc').value < ev('2h 3s 4d 5c 6h Kd Qc').value);
check('trips', name('Qs Qh Qd 9c 4h 2d 3c') === 'Three of a kind, queens');
check('two pair aces and eights', name('As Ah 8d 8c Kh 2d 3c') === 'Two pair, aces and eights');
check('two pair kicker', ev('As Ah 8d 8c Kh 2d 3c').value > ev('As Ah 8d 8c Qh 2d 3c').value);
check('three pairs -> best two + kicker', ev('As Ah 8d 8c 2h 2d Kc').ranks.join() === [12, 6, 11].join());
check('pair of queens', name('Qs Qh 9d 4c 2h Kd 3c') === 'Pair of queens');
check('pair kickers', ev('Qs Qh Ad Kc 2h 3d 4c').value > ev('Qs Qh Ad Jc 2h 3d 4c').value);
check('high card ace', name('As Kh 9d 4c 2h 3d 7c') === 'High card, ace');
check('high card compare', ev('As Kh 9d 4c 2h 3d 7c').value > ev('As Qh 9d 4c 2h 3d 7c').value);
/* ties */
check('board plays tie', ev('As Ks Qs Js Ts 2d 3c').value === ev('As Ks Qs Js Ts 9d 8c').value);
check('split pot same two pair', ev('Ad 5c Ks Kh 8d 8c 2h').value === ev('Ac 4d Ks Kh 8d 8c 2h').value);
/* 5 and 6 card inputs */
check('five cards', name('As Ad Ah Kd Kc') === 'Full house, aces over kings');
check('six cards', name('As Ad 7h 7d 7c 2s') === 'Full house, sevens over aces');
/* best5 */
const b = C.best5(C.parseMany('Ks Kh Kd Ts Th 2c 3c'));
check('best5 picks the full house cards', b.cards.map(C.str).sort().join() === C.parseMany('Ks Kh Kd Ts Th').map(C.str).sort().join(), b.cards.map(C.str).join(' '));
check('best5 agrees with evaluate', C.best5(C.parseMany('9h 8h 7h 6h 5h Ad Ac')).ev.value === ev('9h 8h 7h 6h 5h Ad Ac').value);
/* exhaustive consistency: random 7-card hands, direct evaluate == max over 21 combos */
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
let agree = 0; for (let t = 0; t < 4000; t++) { const d = C.shuffle(C.newDeck(), rnd).slice(0, 7); if (C.evaluate(d).value === C.best5(d).ev.value) agree++; }
check('4000 random hands: direct evaluate matches combo maximum', agree === 4000, agree);
/* category frequencies over random 7-card hands (sanity vs known odds) */
const freq = new Array(9).fill(0), N = 60000; for (let t = 0; t < N; t++) freq[C.evaluate(C.shuffle(C.newDeck(), rnd).slice(0, 7)).cat]++;
const pct = freq.map(f => (100 * f / N).toFixed(2));
check('pair frequency ~43.8%', Math.abs(pct[1] - 43.8) < 1.5, pct[1]);
check('two pair ~23.5%', Math.abs(pct[2] - 23.5) < 1.5, pct[2]);
check('flush ~3.03%', Math.abs(pct[5] - 3.03) < 0.5, pct[5]);
check('full house ~2.60%', Math.abs(pct[6] - 2.6) < 0.5, pct[6]);
console.log('category % (7-card):', C.CATEGORY.map((c, i) => c + ' ' + pct[i]).join(' | '));
console.log(pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
