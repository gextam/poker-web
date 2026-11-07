/* ============================================================================
   TEXAS HOLD'EM — table orchestration: paces the rules engine with dealing
   and chip animations, AI think time, the human action timer, run-outs,
   showdown reveals, rebuys, blind levels and the hand-history feed.
   ========================================================================== */
(function (root) {
  'use strict';
  const PK = root.PK, C = PK.cards;
  const A = () => PK.audio;
  function cryptoRnd() { const c = root.crypto; if (c && c.getRandomValues) { const a = new Uint32Array(1); c.getRandomValues(a); return a[0] / 4294967296; } return Math.random(); }
  const LEVELS = [[5, 10], [10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400]];

  function Game(opts) {
    opts = opts || {};
    this.buyIn = 1000; this.tourney = !!opts.tourney; this.fast = !!opts.fast; this.autoHuman = !!opts.auto;
    this.seats = [
      { id: 'you', name: 'You', stack: this.buyIn, isHuman: true },
      { id: 'vic', name: 'Vic', stack: this.buyIn, ai: 'tight' },
      { id: 'luna', name: 'Luna', stack: this.buyIn, ai: 'lag' },
      { id: 'benny', name: 'Benny', stack: this.buyIn, ai: 'station' },
      { id: 'rex', name: 'Rex', stack: this.buyIn, ai: 'maniac' },
      { id: 'sofia', name: 'Sofia', stack: this.buyIn, ai: 'solid' }
    ];
    this.engine = new PK.Engine({ seats: this.seats, sb: 5, bb: 10, rng: cryptoRnd });
    this.engine.on((t, d) => this.onEvent(t, d));
    this.renderer = null; this.state = 'boot'; this.now = 0; this.nextHandAt = 0; this.level = 0;
    this.blockedUntil = 0; this.pending = null; this.humanTurn = false; this.turnStart = null; this.turnLimit = this.fast ? 6 : 20;
    this.runoutAt = 0; this.boardShown = []; this.highlight = null; this.banner = null; this.forcedDecks = []; this.feed = [];
    this.stats = { hands: 0, won: 0, biggest: 0 }; this.message = ''; this.needRebuy = false; this.handsAtLevel = 0;
  }
  const P = Game.prototype;
  P.begin = function () { this.state = 'between'; this.nextHandAt = this.now + 0.8; A().startAmbience(); };
  P.log = function (text, cls) { this.feed.unshift({ text: text, cls: cls || '', hand: this.engine.handNo }); if (this.feed.length > 120) this.feed.length = 120; };
  P.human = function () { return this.seats[0]; };

  P.startHand = function () {
    if (this.seats.filter(s => s.stack > 0).length < 2) { this.state = 'idle'; return; }
    this.highlight = null; this.banner = null; this.boardShown = []; if (this.renderer) this.renderer.tags = {};
    if (this.tourney) { const lvl = Math.min(LEVELS.length - 1, Math.floor(this.engine.handNo / 8)); if (lvl !== this.level) { this.level = lvl; this.log('Blinds up: ' + LEVELS[lvl][0] + '/' + LEVELS[lvl][1], 'sys'); } this.engine.sb = LEVELS[lvl][0]; this.engine.bb = LEVELS[lvl][1]; }
    const deck = this.forcedDecks.length ? this.forcedDecks.shift() : null;
    this.state = 'hand';
    if (!this.engine.startHand(deck)) { this.state = 'idle'; }
  };
  P.update = function (now, dt) {
    this.now = now;
    const h = this.engine.hand;
    if (this.state === 'between' && now >= this.nextHandAt) { if (this.needRebuy && !this.autoHuman) return; this.startHand(); return; }
    if (this.state !== 'hand' || !h) return;
    if (this.pending && now >= this.pending.at) { const p = this.pending; this.pending = null; if (!h.done && h.actor === p.seat) this.engine.act(p.seat, p.action, p.amount); }
    if (this.humanTurn && now >= this.blockedUntil) {
      if (this.turnStart == null) { this.turnStart = now; A().yourTurn(); if (this.autoHuman) { const d = PK.ai.decide(this.engine, 0, Math.random); this.pending = { seat: 0, at: now + Math.min(d.think, 0.6), action: d.action, amount: d.amount }; } }
      else if (now - this.turnStart >= this.turnLimit) { const la = this.engine.legalActions(0); this.log('You timed out', 'sys'); this.engine.act(0, la.canCheck ? 'check' : 'fold'); }
      else if (this.turnLimit - (now - this.turnStart) < 5 && Math.floor((now - this.turnStart) * 2) !== Math.floor((now - this.turnStart - dt) * 2)) A().tick();
    }
    if (this.runoutAt && now >= this.runoutAt) { this.runoutAt = 0; this.engine.continueRunout(); }
    if (this.handEndAt && now >= this.handEndAt) { this.handEndAt = 0; this.afterHand(); }
  };

  /* ---------------------------------------------------------- events */
  P.onEvent = function (type, d) {
    const R = this.renderer, h = this.engine.hand, dt = this.fast ? 0.35 : 1;
    if (type === 'handStart') {
      this.stats.hands++; this.humanTurn = false; this.turnStart = null; this.pending = null;
      this.log('Hand #' + d.handNo + ' — blinds ' + this.engine.sb + '/' + this.engine.bb + ' — ' + this.seats[d.button].name + ' on the button', 'hand');
      A().buttonMove(); if (d.handNo % 4 === 1) A().say('newhand'); else if (d.handNo % 4 === 3) A().say('deal');
      let k = 0; const n = d.players.length;
      if (R) { for (let round = 0; round < 2; round++) for (let i = 0; i < n; i++) { const seat = d.players[(d.players.indexOf(d.button) + 1 + i) % n]; R.flyCard(seat, this.seats[seat].cards[round], k * 0.12 * dt, 0.3); setTimeout(() => A().dealCard(), k * 120 * dt); k++; } }
      this.blockedUntil = this.now + (k * 0.12 + 0.45) * dt;
    } else if (type === 'turn') {
      this.humanTurn = d.seat === 0; this.turnStart = null; this.pending = null;
      if (d.seat !== 0) { const dec = PK.ai.decide(this.engine, d.seat, Math.random); this.pending = { seat: d.seat, at: Math.max(this.now, this.blockedUntil) + dec.think * dt, action: dec.action, amount: dec.amount }; }
    } else if (type === 'action') {
      const s = this.seats[d.seat], colors = { fold: '#9a9aa5', check: '#9fd0ff', call: '#7cff9d', bet: '#ffd24a', raise: '#ffd24a' };
      const label = s.lastAction === 'ALL IN' ? 'ALL IN' : d.action === 'call' ? 'CALL ' + PK.fmt(d.bet) : d.action === 'raise' ? (h.raises === 1 && h.street !== 'preflop' ? 'BET ' : 'RAISE ') + PK.fmt(d.bet) : d.action.toUpperCase();
      if (R) R.tag(d.seat, label, s.lastAction === 'ALL IN' ? '#ff6b6b' : colors[d.action] || '#fff');
      if (d.action === 'fold') A().fold(); else if (d.action === 'check') A().check(); else { A().chips(Math.min(8, 1 + Math.floor(d.bet / 40))); if (R) R.flyChips(PK.LAYOUT.SEATS[d.seat], R.betSpot(d.seat), Math.min(d.bet, 300), 0, 0.35); }
      if (s.lastAction === 'ALL IN') { A().allIn(); if (Math.random() < 0.5) A().say('allin'); }
      const e = h.log[h.log.length - 1]; this.log(e.name + ' ' + e.what + (e.amount ? ' ' + PK.fmt(e.amount) : ''), d.seat === 0 ? 'you' : '');
      if (d.seat === 0) this.humanTurn = false;
    } else if (type === 'street') {
      this.humanTurn = false;
      if (R) { this.seats.forEach((s, i) => { if (s.total > 0 && !s.folded || s.total > 0) R.flyChips(R.betSpot(i), { x: 960, y: 418 }, 60, 0, 0.45); }); }
      A().chipSlide();
      const start = d.street === 'flop' ? 0 : d.board.length - 1;
      for (let i = start; i < d.board.length; i++) { this.boardShown[i] = this.now + 0.5 * dt + (i - start) * 0.22 * dt; setTimeout(() => A().flipCard(), (500 + (i - start) * 220) * dt); }
      this.blockedUntil = this.now + (0.5 + (d.board.length - start) * 0.22 + 0.35) * dt;
      if (Math.random() < 0.45) setTimeout(() => A().say(d.street), 300 * dt);
      this.log(d.street.toUpperCase() + ': ' + d.board.map(C.str).join(' '), 'street');
    } else if (type === 'runout') {
      this.runoutAt = this.now + (1.6 + (d.street === 'flop' ? 0.6 : 0)) * dt;
      if (d.street === 'flop' && !this.revealedForRunout) { this.revealedForRunout = true; this.engine.hand.players.forEach(i => { const s = this.seats[i]; if (!s.folded && i !== 0 && !s.show) { s.show = true; if (R) R.flip(i); } }); A().flipCard(); }
    } else if (type === 'showdown') {
      this.humanTurn = false; this.pending = null; this.revealedForRunout = false;
      const winners = d.awards, totalWon = {}; winners.forEach(w => { totalWon[w.seat] = (totalWon[w.seat] || 0) + w.amount; });
      if (!d.uncontested) {
        const alive = h.players.filter(i => !this.seats[i].folded);
        alive.forEach(i => { if (i !== 0 && R && !R.anims.some(a => a.type === 'flip' && a.seat === i)) R.flip(i); });
        A().flipCard(); if (alive.length > 1) A().say('showdown');
        const best = new Set(); winners.forEach(w => { if (w.cards) w.cards.forEach(c => best.add(c)); });
        this.highlight = best;
        const top = winners.slice().sort((a, b) => b.amount - a.amount)[0];
        this.banner = { text: (top.seat === 0 ? 'You win ' : this.seats[top.seat].name + ' wins ') + PK.fmt(totalWon[top.seat]) + ' with ' + top.hand.toLowerCase() + (winners.length > 1 && Object.keys(totalWon).length > 1 ? ' · split pot' : ''), t0: this.now + 0.6 * dt, dur: 4.5 * dt };
        winners.forEach(w => this.log(this.seats[w.seat].name + ' wins ' + PK.fmt(w.amount) + ' with ' + w.hand, w.seat === 0 ? 'win you' : 'win'));
      } else { const w = winners[0]; this.banner = { text: (w.seat === 0 ? 'You take' : this.seats[w.seat].name + ' takes') + ' the pot (' + PK.fmt(w.amount) + ')', t0: this.now + 0.2, dur: 2.6 * dt }; this.log(this.seats[w.seat].name + ' wins ' + PK.fmt(w.amount) + ' uncontested', w.seat === 0 ? 'win you' : 'win'); }
      Object.keys(totalWon).forEach(seat => { if (R) R.flyChips({ x: 960, y: 418 }, PK.LAYOUT.SEATS[seat], Math.min(totalWon[seat], 400), 0.9 * dt, 0.6); });
      const you = totalWon[0] || 0; if (you > 0) { this.stats.won += you; this.stats.biggest = Math.max(this.stats.biggest, you); A().win(you >= 400); if (!d.uncontested) A().say('winner'); } else if (!d.uncontested) setTimeout(() => A().chips(4), 900 * dt);
      this.handEndAt = this.now + (d.uncontested ? 2.8 : 5.2) * dt;
    }
  };
  P.afterHand = function () {
    const you = this.human();
    this.seats.forEach(s => { if (!s.isHuman && s.stack === 0) { if (!this.tourney) { s.stack = this.buyIn; this.stats.rebuys = (this.stats.rebuys || 0) + 1; this.log(s.name + ' re-buys for ' + PK.fmt(this.buyIn), 'sys'); } else { s.sittingOut = true; this.log(s.name + ' is eliminated', 'sys'); } } });
    if (you.stack === 0) { this.needRebuy = true; this.message = 'You are out of chips — REBUY to keep playing'; if (this.autoHuman) this.rebuy(); }
    this.state = 'between'; this.nextHandAt = this.now + (this.fast ? 0.4 : 1.2);
  };
  P.rebuy = function () { const you = this.human(); if (you.stack > 0 && !this.needRebuy) { A().deny(); return; } you.stack += this.buyIn; this.needRebuy = false; this.message = ''; this.stats.rebuys = (this.stats.rebuys || 0) + 1; this.log('You re-buy for ' + PK.fmt(this.buyIn), 'sys you'); A().chips(6); if (this.state === 'idle') { this.state = 'between'; this.nextHandAt = this.now + 0.5; } };
  /* human actions */
  P.canAct = function () { const h = this.engine.hand; return !!h && !h.done && h.actor === 0 && this.now >= this.blockedUntil; };
  P.act = function (action, amount) { if (!this.canAct()) { A().deny(); return false; } const ok = this.engine.act(0, action, amount); if (!ok) A().deny(); return ok; };
  P.legal = function () { const h = this.engine.hand; return h && !h.done && h.actor === 0 ? this.engine.legalActions(0) : null; };
  P.forceDeck = function (spec) { this.forcedDecks.push(PK.deckFrom(spec)); };
  /* deck builder for tests: cards in deal order (first card to the first seat left of the button …), the rest random */
  PK.deckFrom = function (spec) { const cards = C.parseMany(spec); const rest = C.shuffle(C.newDeck(), Math.random).filter(c => cards.indexOf(c) < 0); return rest.concat(cards.slice().reverse()); };
  PK.Game = Game; PK.LEVELS = LEVELS;
})(window);
