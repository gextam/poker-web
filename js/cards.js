/* ============================================================================
   TEXAS HOLD'EM — cards and hand evaluation.
   Card = integer 0..51: rank = c % 13 (0 = deuce … 12 = ace), suit = c / 13
   (0 ♠, 1 ♥, 2 ♦, 3 ♣). evaluate() ranks any 5–7 cards directly (no combo
   enumeration) into a single comparable integer; best5() returns the five
   cards that make the hand; describe() names it ("Full house, kings over tens").
   Shared by the browser (window.PK) and node tools (module.exports).
   ========================================================================== */
(function (root) {
  'use strict';
  const PK = root.PK || (root.PK = {});
  const RANKS = '23456789TJQKA', SUITS = 'shdc';
  const SUIT_SYM = ['♠', '♥', '♦', '♣'];
  const RANK_WORD = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];
  const RANK_PLURAL = ['twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings', 'aces'];
  const CATEGORY = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

  const rankOf = c => c % 13, suitOf = c => (c / 13) | 0;
  const make = (r, s) => s * 13 + r;
  const parse = str => make(RANKS.indexOf(str[0].toUpperCase()), SUITS.indexOf(str[1].toLowerCase()));
  const str = c => RANKS[rankOf(c)] + SUITS[suitOf(c)];
  const parseMany = s => s.trim().split(/[\s,]+/).filter(Boolean).map(parse);
  function newDeck() { const d = []; for (let i = 0; i < 52; i++) d.push(i); return d; }
  function shuffle(deck, rnd) { rnd = rnd || Math.random; for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = deck[i]; deck[i] = deck[j]; deck[j] = t; } return deck; }

  function straightHigh(mask) {
    for (let h = 12; h >= 4; h--) if (((mask >> (h - 4)) & 0x1F) === 0x1F) return h;
    if ((mask & 0x100F) === 0x100F) return 3;      /* wheel: A 2 3 4 5 */
    return -1;
  }
  function topRanks(mask, n) { const out = []; for (let r = 12; r >= 0 && out.length < n; r--) if (mask & (1 << r)) out.push(r); return out; }
  function encode(cat, ranks) { let v = cat; for (let i = 0; i < 5; i++) v = v * 15 + (i < ranks.length ? ranks[i] + 2 : 0); return v; }

  /* evaluate 5 to 7 cards -> { value, cat, ranks } (higher value wins) */
  function evaluate(cards) {
    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], suitMask = [0, 0, 0, 0], suitCount = [0, 0, 0, 0];
    let mask = 0;
    for (let i = 0; i < cards.length; i++) { const c = cards[i], r = c % 13, s = (c / 13) | 0; counts[r]++; suitMask[s] |= 1 << r; suitCount[s]++; mask |= 1 << r; }
    let flushSuit = -1;
    for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) flushSuit = s;
    if (flushSuit >= 0) { const sh = straightHigh(suitMask[flushSuit]); if (sh >= 0) return { value: encode(8, [sh]), cat: 8, ranks: [sh] }; }
    let quad = -1; const trips = [], pairs = [];
    for (let r = 12; r >= 0; r--) { if (counts[r] === 4) quad = r; else if (counts[r] === 3) trips.push(r); else if (counts[r] === 2) pairs.push(r); }
    if (quad >= 0) { const k = topRanks(mask & ~(1 << quad), 1); return { value: encode(7, [quad, k[0]]), cat: 7, ranks: [quad, k[0]] }; }
    if (trips.length && (pairs.length || trips.length > 1)) {
      const t = trips[0], p = Math.max(pairs.length ? pairs[0] : -1, trips.length > 1 ? trips[1] : -1);
      return { value: encode(6, [t, p]), cat: 6, ranks: [t, p] };
    }
    if (flushSuit >= 0) { const rs = topRanks(suitMask[flushSuit], 5); return { value: encode(5, rs), cat: 5, ranks: rs }; }
    const sh = straightHigh(mask);
    if (sh >= 0) return { value: encode(4, [sh]), cat: 4, ranks: [sh] };
    if (trips.length) { const ks = topRanks(mask & ~(1 << trips[0]), 2), rs = [trips[0]].concat(ks); return { value: encode(3, rs), cat: 3, ranks: rs }; }
    if (pairs.length >= 2) { const k = topRanks(mask & ~(1 << pairs[0]) & ~(1 << pairs[1]), 1), rs = [pairs[0], pairs[1], k[0]]; return { value: encode(2, rs), cat: 2, ranks: rs }; }
    if (pairs.length === 1) { const ks = topRanks(mask & ~(1 << pairs[0]), 3), rs = [pairs[0]].concat(ks); return { value: encode(1, rs), cat: 1, ranks: rs }; }
    const hs = topRanks(mask, 5);
    return { value: encode(0, hs), cat: 0, ranks: hs };
  }
  /* the five cards (subset of the input) that make the best hand */
  function best5(cards) {
    if (cards.length <= 5) return { cards: cards.slice(), ev: evaluate(cards) };
    let best = null; const combo = [], n = cards.length;
    (function rec(start, depth) {
      if (depth === 5) { const ev = evaluate(combo); if (!best || ev.value > best.ev.value) best = { cards: combo.slice(), ev: ev }; return; }
      for (let i = start; i <= n - (5 - depth); i++) { combo[depth] = cards[i]; rec(i + 1, depth + 1); }
    })(0, 0);
    return best;
  }
  function describe(ev) {
    const r = ev.ranks, w = RANK_WORD, pl = RANK_PLURAL;
    switch (ev.cat) {
      case 8: return r[0] === 12 ? 'Royal flush' : 'Straight flush, ' + w[r[0]] + ' high';
      case 7: return 'Four of a kind, ' + pl[r[0]];
      case 6: return 'Full house, ' + pl[r[0]] + ' over ' + pl[r[1]];
      case 5: return 'Flush, ' + w[r[0]] + ' high';
      case 4: return 'Straight, ' + w[r[0]] + ' high';
      case 3: return 'Three of a kind, ' + pl[r[0]];
      case 2: return 'Two pair, ' + pl[r[0]] + ' and ' + pl[r[1]];
      case 1: return 'Pair of ' + pl[r[0]];
      default: return 'High card, ' + w[r[0]];
    }
  }

  PK.cards = { RANKS: RANKS, SUITS: SUITS, SUIT_SYM: SUIT_SYM, RANK_WORD: RANK_WORD, RANK_PLURAL: RANK_PLURAL, CATEGORY: CATEGORY, rankOf: rankOf, suitOf: suitOf, make: make, parse: parse, parseMany: parseMany, str: str, newDeck: newDeck, shuffle: shuffle, evaluate: evaluate, best5: best5, describe: describe, straightHigh: straightHigh };
  if (typeof module !== 'undefined' && module.exports) module.exports = PK;
})(typeof window !== 'undefined' ? window : globalThis);
