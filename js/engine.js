/* ============================================================================
   TEXAS HOLD'EM — the rules engine. Pure state machine, no timing, no DOM:
   button and blinds (including heads-up), dealing, betting rounds with the
   minimum-raise and short-all-in rules, run-outs when betting is over, side
   pots from contributions, showdown with 7-card evaluation and tie splitting
   (odd chips to the first seat after the button), hand history.
   Events: handStart, log, action, turn, street, runout, showdown, handEnd.
   ========================================================================== */
(function (root) {
  'use strict';
  const PK = root.PK || (root.PK = {});
  const C = PK.cards;
  const STREETS = ['preflop', 'flop', 'turn', 'river'];

  function Engine(opts) {
    opts = opts || {};
    this.seats = opts.seats;
    this.sb = opts.sb || 5; this.bb = opts.bb || 10;
    this.rng = opts.rng || Math.random;
    this.button = opts.button != null ? opts.button : -1;
    this.handNo = 0; this.listeners = []; this.hand = null; this.history = [];
  }
  const P = Engine.prototype;
  P.on = function (fn) { this.listeners.push(fn); };
  P.emit = function (type, data) { this.listeners.forEach(fn => fn(type, data)); };

  P.startHand = function (forcedDeck) {
    const players = [];
    this.seats.forEach((s, i) => { if (s.stack > 0 && !s.sittingOut) players.push(i); });
    if (players.length < 2) return false;
    this.handNo++;
    let b = this.button;
    do { b = (b + 1) % this.seats.length; } while (players.indexOf(b) < 0);
    this.button = b;
    this.seats.forEach(s => { s.cards = []; s.folded = true; s.allIn = false; s.bet = 0; s.total = 0; s.acted = false; s.capped = false; s.show = false; s.winAmount = 0; s.handName = null; s.ev = null; s.best = null; s.lastAction = null; });
    players.forEach(i => { this.seats[i].folded = false; });
    const deck = forcedDeck ? forcedDeck.slice() : C.shuffle(C.newDeck(), this.rng);
    const h = this.hand = { deck: deck, board: [], street: 'preflop', pots: [], pot: 0, currentBet: 0, minRaise: this.bb, actor: -1, lastRaiser: -1, players: players, log: [], winners: [], done: false, raises: 0 };
    const n = players.length, bPos = players.indexOf(b);
    const sbSeat = n === 2 ? players[bPos] : players[(bPos + 1) % n];
    const bbSeat = n === 2 ? players[(bPos + 1) % n] : players[(bPos + 2) % n];
    this.put(sbSeat, this.sb); this.log(sbSeat, 'posts small blind', this.seats[sbSeat].bet);
    this.put(bbSeat, this.bb); this.log(bbSeat, 'posts big blind', this.seats[bbSeat].bet);
    h.currentBet = this.bb; h.minRaise = this.bb; h.lastRaiser = bbSeat; h.sbSeat = sbSeat; h.bbSeat = bbSeat;
    for (let round = 0; round < 2; round++) for (let k = 1; k <= n; k++) this.seats[players[(bPos + k) % n]].cards.push(deck.pop());
    this.emit('handStart', { handNo: this.handNo, button: b, sb: sbSeat, bb: bbSeat, players: players.slice() });
    const first = n === 2 ? sbSeat : players[(bPos + 3) % n];
    h.actor = this.nextToAct(first, true);
    if (h.actor < 0) this.nextStreet(); else this.emit('turn', { seat: h.actor });
    return true;
  };
  P.put = function (seat, amount) {
    const s = this.seats[seat]; amount = Math.max(0, Math.min(amount, s.stack));
    s.stack -= amount; s.bet += amount; s.total += amount; this.hand.pot += amount;
    if (s.stack === 0) s.allIn = true;
    return amount;
  };
  P.log = function (seat, what, amount) { const e = { street: this.hand.street, seat: seat, name: this.seats[seat].name, what: what, amount: amount || 0 }; this.hand.log.push(e); this.emit('log', e); };

  P.legalActions = function (seat) {
    const s = this.seats[seat], h = this.hand;
    const toCall = Math.min(Math.max(0, h.currentBet - s.bet), s.stack);
    const maxRaiseTo = s.bet + s.stack;
    const minRaiseTo = Math.min(h.currentBet + h.minRaise, maxRaiseTo);
    const canRaise = !s.capped && maxRaiseTo > h.currentBet;
    return { toCall: toCall, canCheck: toCall === 0, canRaise: canRaise, minRaiseTo: minRaiseTo, maxRaiseTo: maxRaiseTo, pot: h.pot, currentBet: h.currentBet };
  };
  /* action: 'fold' | 'check' | 'call' | 'raise' (amount = raise TO) | 'allin' */
  P.act = function (seat, action, amount) {
    const h = this.hand; if (!h || h.done || seat !== h.actor) return false;
    const s = this.seats[seat], la = this.legalActions(seat);
    if (action === 'allin') { const to = s.bet + s.stack; action = (to > h.currentBet && la.canRaise) ? 'raise' : 'call'; amount = to; if (action === 'call' && la.toCall === 0) action = 'check'; }
    switch (action) {
      case 'fold': s.folded = true; s.lastAction = 'FOLD'; this.log(seat, 'folds'); break;
      case 'check': if (!la.canCheck) return false; s.lastAction = 'CHECK'; this.log(seat, 'checks'); break;
      case 'call': {
        if (la.toCall === 0) return false;
        const paid = this.put(seat, la.toCall); s.lastAction = s.allIn ? 'ALL IN' : 'CALL'; this.log(seat, s.allIn ? 'calls all-in' : 'calls', paid); break;
      }
      case 'bet': case 'raise': {
        if (!la.canRaise) return false;
        let to = Math.round(amount || la.minRaiseTo);
        if (to >= la.maxRaiseTo) to = la.maxRaiseTo; else if (to < la.minRaiseTo) to = la.minRaiseTo;
        if (to <= h.currentBet) return false;
        const raiseBy = to - h.currentBet, fullRaise = raiseBy >= h.minRaise;
        const wasBet = h.currentBet === 0;
        this.put(seat, to - s.bet);
        if (fullRaise) { h.minRaise = raiseBy; h.players.forEach(i => { if (i !== seat) { this.seats[i].acted = false; this.seats[i].capped = false; } }); }
        else { h.players.forEach(i => { if (i !== seat) { if (this.seats[i].acted) this.seats[i].capped = true; this.seats[i].acted = false; } }); }
        h.currentBet = to; h.lastRaiser = seat; h.raises++;
        s.lastAction = s.allIn ? 'ALL IN' : (wasBet ? 'BET' : 'RAISE');
        this.log(seat, (wasBet ? 'bets' : 'raises to') + (s.allIn ? ' all-in' : ''), to); break;
      }
      default: return false;
    }
    s.acted = true;
    this.emit('action', { seat: seat, action: action, bet: s.bet, stack: s.stack, pot: h.pot });
    this.advance();
    return true;
  };
  P.nextToAct = function (from, inclusive) {
    const h = this.hand, n = h.players.length, idx = Math.max(0, h.players.indexOf(from));
    for (let k = inclusive ? 0 : 1; k <= n; k++) { const seat = h.players[(idx + k) % n], s = this.seats[seat]; if (!s.folded && !s.allIn) return seat; }
    return -1;
  };
  P.advance = function () {
    const h = this.hand, alive = h.players.filter(i => !this.seats[i].folded);
    if (alive.length === 1) { this.finish(); return; }
    const canAct = alive.filter(i => !this.seats[i].allIn);
    const done = canAct.every(i => this.seats[i].acted && this.seats[i].bet === h.currentBet);
    if (!done) { h.actor = this.nextToAct(h.actor, false); if (h.actor < 0) { this.nextStreet(); return; } this.emit('turn', { seat: h.actor }); return; }
    this.nextStreet();
  };
  P.nextStreet = function () {
    const h = this.hand, alive = h.players.filter(i => !this.seats[i].folded);
    h.players.forEach(i => { const s = this.seats[i]; s.bet = 0; s.acted = false; s.capped = false; if (s.lastAction !== 'FOLD' && s.lastAction !== 'ALL IN') s.lastAction = null; });
    h.currentBet = 0; h.minRaise = this.bb; h.raises = 0;
    if (h.street === 'river') { this.showdown(); return; }
    h.street = STREETS[STREETS.indexOf(h.street) + 1];
    h.deck.pop();
    const n = h.street === 'flop' ? 3 : 1; for (let i = 0; i < n; i++) h.board.push(h.deck.pop());
    this.emit('street', { street: h.street, board: h.board.slice() });
    const canAct = alive.filter(i => !this.seats[i].allIn);
    if (canAct.length < 2) { h.actor = -1; this.emit('runout', { street: h.street }); return; }
    h.actor = this.nextToAct(this.button, false); this.emit('turn', { seat: h.actor });
  };
  /* when betting is over before the river, the game calls this to deal the next card */
  P.continueRunout = function () { const h = this.hand; if (h && !h.done && h.actor === -1 && h.street !== 'showdown') this.nextStreet(); };

  P.buildPots = function () {
    const h = this.hand, contrib = h.players.map(i => ({ seat: i, total: this.seats[i].total, folded: this.seats[i].folded }));
    const levels = Array.from(new Set(contrib.filter(c => c.total > 0).map(c => c.total))).sort((a, b) => a - b);
    const pots = []; let prev = 0;
    levels.forEach(level => {
      let amount = 0; const eligible = [];
      contrib.forEach(c => { amount += Math.min(c.total, level) - Math.min(c.total, prev); if (!c.folded && c.total >= level) eligible.push(c.seat); });
      if (amount > 0) pots.push({ amount: amount, eligible: eligible });
      prev = level;
    });
    const merged = [];
    pots.forEach(p => { const last = merged[merged.length - 1]; if (last && last.eligible.join() === p.eligible.join()) last.amount += p.amount; else merged.push(p); });
    /* a pot nobody alive can claim (its only contributors folded) rolls into the previous pot */
    for (let i = merged.length - 1; i > 0; i--) if (!merged[i].eligible.length) { merged[i - 1].amount += merged[i].amount; merged.splice(i, 1); }
    return merged;
  };
  P.orderFromButton = function (seats) { const n = this.seats.length, out = []; for (let k = 1; k <= n; k++) { const i = (this.button + k) % n; if (seats.indexOf(i) >= 0) out.push(i); } return out; };
  P.showdown = function () {
    const h = this.hand; h.street = 'showdown'; h.actor = -1;
    const alive = h.players.filter(i => !this.seats[i].folded);
    alive.forEach(i => { const s = this.seats[i], b5 = C.best5(s.cards.concat(h.board)); s.ev = b5.ev; s.best = b5.cards; s.handName = C.describe(b5.ev); s.show = true; });
    const pots = this.buildPots(), awards = [];
    pots.forEach((p, pi) => {
      let best = -1; p.eligible.forEach(i => { if (this.seats[i].ev.value > best) best = this.seats[i].ev.value; });
      const winners = this.orderFromButton(p.eligible.filter(i => this.seats[i].ev.value === best));
      const share = Math.floor(p.amount / winners.length); let odd = p.amount - share * winners.length;
      winners.forEach(i => { let amt = share; if (odd > 0) { amt++; odd--; } this.seats[i].stack += amt; this.seats[i].winAmount += amt; awards.push({ pot: pi, seat: i, amount: amt, hand: this.seats[i].handName, cards: this.seats[i].best }); });
    });
    h.pots = pots; h.winners = awards;
    this.emit('showdown', { board: h.board.slice(), awards: awards, pots: pots, uncontested: false });
    this.finish();
  };
  P.finish = function () {
    const h = this.hand; if (h.done) return;
    const alive = h.players.filter(i => !this.seats[i].folded);
    if (h.street !== 'showdown') {
      const w = alive[0], pots = this.buildPots(); let total = 0; pots.forEach(p => { total += p.amount; });
      this.seats[w].stack += total; this.seats[w].winAmount = total;
      h.pots = pots; h.winners = [{ pot: 0, seat: w, amount: total, hand: null, cards: null }];
      this.emit('showdown', { board: h.board.slice(), awards: h.winners, pots: pots, uncontested: true });
    }
    h.done = true; h.actor = -1;
    this.history.unshift({ handNo: this.handNo, board: h.board.slice(), winners: h.winners.slice(), log: h.log.slice(), seats: this.seats.map(s => ({ name: s.name, cards: s.show ? s.cards.slice() : null, stack: s.stack })) });
    if (this.history.length > 60) this.history.length = 60;
    this.emit('handEnd', { handNo: this.handNo, winners: h.winners });
  };
  PK.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = PK;
})(typeof window !== 'undefined' ? window : globalThis);
