/* ============================================================================
   TEXAS HOLD'EM — opponents. Five personalities decide from Monte-Carlo
   equity against the live opponents, pot odds, position, stack depth and a
   personality-shaped dose of bluffing. Pure logic (node-testable).
   ========================================================================== */
(function (root) {
  'use strict';
  const PK = root.PK || (root.PK = {});
  const C = PK.cards;

  const PERSONALITIES = {
    tight:   { name: 'tight-passive',   fold: 0.10, aggr: 0.25, bluff: 0.04, call: 0.00, sizing: 0.55, iters: 360 },
    lag:     { name: 'loose-aggressive', fold: -0.08, aggr: 0.75, bluff: 0.22, call: 0.05, sizing: 0.85, iters: 300 },
    station: { name: 'calling station', fold: -0.14, aggr: 0.15, bluff: 0.03, call: 0.18, sizing: 0.5, iters: 240 },
    maniac:  { name: 'maniac',          fold: -0.16, aggr: 0.95, bluff: 0.35, call: 0.08, sizing: 1.1, iters: 220 },
    solid:   { name: 'solid',           fold: 0.02, aggr: 0.5, bluff: 0.10, call: 0.0, sizing: 0.7, iters: 420 }
  };

  /* quick preflop hand class bonus so the bots respect suitedness/connectedness beyond raw equity */
  function preflopBonus(hole) {
    const r1 = C.rankOf(hole[0]), r2 = C.rankOf(hole[1]), suited = C.suitOf(hole[0]) === C.suitOf(hole[1]);
    const hi = Math.max(r1, r2), lo = Math.min(r1, r2), gap = hi - lo;
    let b = 0;
    if (r1 === r2) b += 0.04 + hi * 0.004;
    if (suited) b += 0.02;
    if (gap === 1 && hi >= 5) b += 0.015;
    if (hi === 12) b += 0.01;
    return b;
  }

  /* returns { action: 'fold'|'check'|'call'|'raise'|'allin', amount, think } */
  function decide(engine, seat, rnd) {
    rnd = rnd || Math.random;
    const s = engine.seats[seat], h = engine.hand, p = PERSONALITIES[s.ai] || PERSONALITIES.solid;
    const la = engine.legalActions(seat);
    const alive = h.players.filter(i => !engine.seats[i].folded && i !== seat);
    const nOpp = Math.max(1, alive.length);
    const iters = h.street === 'preflop' ? p.iters : Math.round(p.iters * 1.3);
    let eq = PK.equity(s.cards, h.board, nOpp, iters, rnd).equity;
    if (h.street === 'preflop') eq += preflopBonus(s.cards);
    /* position: later is better */
    const order = h.players.slice(h.players.indexOf(engine.button) + 1).concat(h.players.slice(0, h.players.indexOf(engine.button) + 1));
    const posFrac = order.indexOf(seat) / Math.max(1, order.length - 1);
    eq += 0.03 * (posFrac - 0.5);
    const pot = h.pot, toCall = la.toCall, potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
    const bbs = s.stack / engine.bb, shortStack = bbs <= 12;
    const effStack = s.stack + s.bet;
    const r = rnd();
    const think = 0.7 + rnd() * 1.6 + (toCall > 0 ? 0.3 : 0);
    const raiseTo = (mult) => { const target = Math.round(Math.max(la.minRaiseTo, h.currentBet + Math.max(engine.bb, (pot + toCall) * mult))); return Math.min(target, la.maxRaiseTo); };
    const allInNow = () => ({ action: 'allin', amount: la.maxRaiseTo, think: think + 0.4 });

    if (toCall === 0) {
      /* may check or bet */
      const strong = eq > 0.62 - p.aggr * 0.08, medium = eq > 0.45;
      if (la.canRaise && (strong && r < 0.55 + p.aggr * 0.4)) return shortStack && eq > 0.6 ? allInNow() : { action: 'raise', amount: raiseTo(p.sizing * (0.6 + rnd() * 0.6)), think: think };
      if (la.canRaise && medium && r < p.aggr * 0.35) return { action: 'raise', amount: raiseTo(p.sizing * 0.6), think: think };
      if (la.canRaise && h.street !== 'preflop' && r < p.bluff && eq > 0.18) return { action: 'raise', amount: raiseTo(p.sizing * 0.7), think: think + 0.3 };
      if (la.canRaise && h.street === 'preflop' && seat !== h.bbSeat && r < p.aggr * 0.5 && eq > 0.4) return { action: 'raise', amount: raiseTo(1.0), think: think };
      return { action: 'check', amount: 0, think: think * 0.8 };
    }
    /* facing a bet */
    const required = potOdds + p.fold;                      /* equity needed to continue */
    const cheap = toCall <= engine.bb * 2 && h.street === 'preflop';
    if (eq + p.call < required && !(cheap && eq > 0.3) && !(p.call > 0.1 && toCall < s.stack * 0.15 && eq > 0.25)) {
      if (r < p.bluff * 0.3 && la.canRaise && h.street !== 'preflop') return { action: 'raise', amount: raiseTo(p.sizing), think: think + 0.5 };
      return { action: 'fold', amount: 0, think: think * 0.9 };
    }
    const veryStrong = eq > 0.78, strong = eq > 0.62;
    if (la.canRaise) {
      if (veryStrong && (shortStack || toCall >= s.stack * 0.4 || r < 0.5 + p.aggr * 0.3)) return toCall >= s.stack * 0.5 || shortStack ? allInNow() : { action: 'raise', amount: raiseTo(p.sizing * 1.2), think: think };
      if (strong && r < p.aggr * 0.6) return { action: 'raise', amount: raiseTo(p.sizing), think: think };
      if (r < p.bluff * 0.4 && eq > 0.3 && h.street !== 'river') return { action: 'raise', amount: raiseTo(p.sizing), think: think + 0.3 };
    }
    if (toCall >= s.stack) return eq > required + 0.08 || p.call > 0.1 ? { action: 'call', amount: toCall, think: think + 0.5 } : { action: 'fold', amount: 0, think: think };
    return { action: 'call', amount: toCall, think: think };
  }
  PK.ai = { PERSONALITIES: PERSONALITIES, decide: decide, preflopBonus: preflopBonus };
  if (typeof module !== 'undefined' && module.exports) module.exports = PK;
})(typeof window !== 'undefined' ? window : globalThis);
