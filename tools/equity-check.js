/* Monte-Carlo equity sanity checks against well-known values. usage: node tools/equity-check.js */
'use strict';
const PK = require('../js/cards.js'); require('../js/equity.js');
const C = PK.cards;
let seed = 777; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
/* exact enumeration for heads-up preflop matchups (both hands fixed) */
function exactHU(a, b) {
  const used = {}; a.concat(b).forEach(c => { used[c] = 1; }); const pool = []; for (let c = 0; c < 52; c++) if (!used[c]) pool.push(c);
  let win = 0, tie = 0, total = 0; const n = pool.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) for (let l = k + 1; l < n; l++) for (let m = l + 1; m < n; m++) {
    const board = [pool[i], pool[j], pool[k], pool[l], pool[m]];
    const va = C.evaluate(a.concat(board)).value, vb = C.evaluate(b.concat(board)).value; total++; if (va > vb) win++; else if (va === vb) tie++;
  }
  return { equity: (win + tie / 2) / total, win: win / total, tie: tie / total };
}
let fail = 0;
function check(label, got, expect, tol) { const ok = Math.abs(got - expect) <= tol; if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + label.padEnd(40) + ' got ' + (got * 100).toFixed(1) + '%  expected ' + (expect * 100).toFixed(1) + '% ±' + (tol * 100).toFixed(1)); }
const AA = C.parseMany('As Ah'), KK = C.parseMany('Kd Kc'), AKs = C.parseMany('As Ks'), QQ = C.parseMany('Qd Qc'), o72 = C.parseMany('7d 2c'), JTs = C.parseMany('Js Ts');
console.log('exact enumeration (1,712,304 boards each) vs Monte Carlo:');
const e1 = exactHU(AA, KK); check('AA vs KK exact', e1.equity, 0.8195, 0.01);
const e2 = exactHU(AKs, QQ); check('AKs vs QQ exact', e2.equity, 0.46, 0.015);
const e3 = exactHU(AA, o72); check('AA vs 72o exact', e3.equity, 0.88, 0.015);
/* Monte Carlo against random hands (random opponent holdings) */
const mc = (h, n, it) => PK.equity(h, [], n, it, rnd).equity;
check('AA vs 1 random (MC)', mc(AA, 1, 20000), 0.852, 0.012);
check('AA vs 5 random (MC)', mc(AA, 5, 20000), 0.493, 0.015);
check('KK vs 1 random (MC)', mc(KK, 1, 20000), 0.824, 0.012);
check('72o vs 1 random (MC)', mc(o72, 1, 20000), 0.347, 0.015);
check('JTs vs 1 random (MC)', mc(JTs, 1, 20000), 0.575, 0.015);
check('AKs vs 1 random (MC)', mc(AKs, 1, 20000), 0.67, 0.015);
/* postflop: set vs flush draw */
const set = C.parseMany('9s 9h'), fd = C.parseMany('Ad Kd'), board = C.parseMany('9d 7d 2c');
const used = {}; set.concat(fd, board).forEach(c => { used[c] = 1; }); const pool = []; for (let c = 0; c < 52; c++) if (!used[c]) pool.push(c);
let w = 0, t = 0, tot = 0; for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) { const b5 = board.concat([pool[i], pool[j]]); const vs = C.evaluate(set.concat(b5)).value, vf = C.evaluate(fd.concat(b5)).value; tot++; if (vs > vf) w++; else if (vs === vf) t++; }
check('set of nines vs nut flush draw on 9d7d2c (exact)', (w + t / 2) / tot, 0.75, 0.03);
console.log(fail ? fail + ' check(s) failed' : 'all equity checks passed');
process.exitCode = fail ? 1 : 0;
