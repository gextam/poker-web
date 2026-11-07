/* ============================================================================
   TEXAS HOLD'EM — Monte-Carlo hand equity: hero hole cards (+ board) against
   N random opponents. Returns win / tie / equity fractions.
   ========================================================================== */
(function (root) {
  'use strict';
  const PK = root.PK || (root.PK = {});
  const evaluate = PK.cards.evaluate;

  function equity(hole, board, nOpp, iters, rnd) {
    rnd = rnd || Math.random; iters = iters || 500; nOpp = Math.max(1, nOpp);
    const known = {}; hole.forEach(c => { known[c] = 1; }); board.forEach(c => { known[c] = 1; });
    const pool = []; for (let c = 0; c < 52; c++) if (!known[c]) pool.push(c);
    const missing = 5 - board.length, need = missing + 2 * nOpp;
    let win = 0, tie = 0;
    const full = board.slice(); full.length = 5;
    const hero7 = hole.slice(); hero7.length = 7;
    const opp7 = new Array(7);
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < need; i++) { const j = i + Math.floor(rnd() * (pool.length - i)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      for (let i = 0; i < missing; i++) full[board.length + i] = pool[i];
      for (let i = 0; i < 5; i++) { hero7[2 + i] = full[i]; opp7[2 + i] = full[i]; }
      const hv = evaluate(hero7).value;
      let best = -1, ties = 0, off = missing;
      for (let o = 0; o < nOpp; o++) {
        opp7[0] = pool[off]; opp7[1] = pool[off + 1]; off += 2;
        const v = evaluate(opp7).value;
        if (v > best) { best = v; ties = 1; } else if (v === best) ties++;
      }
      if (hv > best) win++; else if (hv === best) tie += 1 / (ties + 1);
    }
    return { win: win / iters, tie: tie / iters, equity: (win + tie) / iters };
  }
  PK.equity = equity;
  if (typeof module !== 'undefined' && module.exports) module.exports = PK;
})(typeof window !== 'undefined' ? window : globalThis);
