/* ============================================================================
   TEXAS HOLD'EM — canvas renderer: poker room backdrop, oval table with wood
   rail and felt, six seats with photoreal avatars, vector playing cards
   (pre-rendered), chip stacks, dealer button, flying cards and chips, card
   flips, action tags, turn timer, showdown highlights and the winner banner.
   ========================================================================== */
(function (root) {
  'use strict';
  const PK = root.PK, C = PK.cards;
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const CENTER = { x: 960, y: 500 };
  const SEAT_ANGLES = [90, 148, 212, 270, 328, 32];
  const SEATS = SEAT_ANGLES.map(a => { const r = a * Math.PI / 180; return { x: Math.round(960 + 720 * Math.cos(r)), y: Math.round(500 + 360 * Math.sin(r)) }; });
  SEATS[0].y = 838;   /* keep your name plate clear of the action bar */
  function toward(p, dist) { const dx = CENTER.x - p.x, dy = CENTER.y - p.y, L = Math.hypot(dx, dy) || 1; return { x: p.x + dx / L * dist, y: p.y + dy / L * dist }; }
  const SHOE = { x: 1160, y: 330 };
  const CARD = { w: 74, h: 104, cw: 92, ch: 128 };
  const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  PK.fmt = fmt; PK.LAYOUT = { W: W, H: H, SEATS: SEATS, CENTER: CENTER, SHOE: SHOE, CARD: CARD, toward: toward };
  function roundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const CHIP_COLORS = [[1, '#e8e8e8', '#333'], [5, '#d8262c', '#fff'], [25, '#1f8a3a', '#fff'], [100, '#1b1b1f', '#fff'], [500, '#7a2ea3', '#fff'], [1000, '#e9c250', '#2a1a00']];

  function Renderer(canvas, game) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.game = game;
    this.scale = 1; this.dpr = 1; this.images = {}; this.cardCache = {}; this.anims = []; this.tags = {}; this.now = 0;
    this.resize(); root.addEventListener('resize', () => this.resize());
  }
  const P = Renderer.prototype;
  P.resize = function () {
    const vw = root.innerWidth, vh = root.innerHeight, s = Math.min(vw / W, vh / H);
    this.scale = s; this.dpr = Math.min(2, root.devicePixelRatio || 1);
    const stage = document.getElementById('stage'); if (stage) stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    this.canvas.width = Math.round(W * s * this.dpr); this.canvas.height = Math.round(H * s * this.dpr);
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
  };
  P.loadImages = function (files) { return Promise.all(Object.keys(files).map(k => new Promise(res => { const img = new Image(); img.onload = () => { this.images[k] = img; res(); }; img.onerror = () => res(); img.src = files[k]; }))); };

  /* ---------------------------------------------------------- cards */
  P.cardImage = function (card, faceUp) {
    const key = faceUp ? card : 'back'; if (this.cardCache[key]) return this.cardCache[key];
    const w = CARD.cw * 2, h = CARD.ch * 2, c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
    roundRect(ctx, 1, 1, w - 2, h - 2, 16);
    if (!faceUp) {
      const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#8a1c22'); g.addColorStop(1, '#4a0c10'); ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(255,215,130,0.35)'; ctx.lineWidth = 2;
      for (let i = -h; i < w + h; i += 14) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0); ctx.stroke(); }
      ctx.restore();
      ctx.lineWidth = 6; ctx.strokeStyle = '#f3e2b0'; roundRect(ctx, 10, 10, w - 20, h - 20, 12); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; roundRect(ctx, 1, 1, w - 2, h - 2, 16); ctx.stroke();
      this.cardCache[key] = c; return c;
    }
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#eceae2'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#b9b5a8'; ctx.stroke();
    const r = C.rankOf(card), s = C.suitOf(card), red = s === 1 || s === 2, col = red ? '#c8102e' : '#15151a', sym = C.SUIT_SYM[s], rk = C.RANKS[r] === 'T' ? '10' : C.RANKS[r];
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 44px ' + FONT; ctx.fillText(rk, 28, 32); ctx.font = '36px ' + FONT; ctx.fillText(sym, 28, 72);
    ctx.save(); ctx.translate(w - 28, h - 32); ctx.rotate(Math.PI); ctx.font = '700 44px ' + FONT; ctx.fillText(rk, 0, 0); ctx.font = '36px ' + FONT; ctx.fillText(sym, 0, 40); ctx.restore();
    if (r >= 9 && r <= 11) {
      roundRect(ctx, 46, 54, w - 92, h - 108, 10); ctx.fillStyle = red ? '#fbe3e6' : '#e9e9ee'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#c9a84a'; ctx.stroke();
      ctx.fillStyle = '#c9a84a'; ctx.font = '700 22px ' + SERIF; ctx.fillText('♛', w / 2, 76);
      ctx.fillStyle = col; ctx.font = '700 96px ' + SERIF; ctx.fillText(C.RANKS[r], w / 2, h / 2 + 4);
      ctx.font = '40px ' + FONT; ctx.fillText(sym, w / 2, h - 80);
    } else if (r === 12) { ctx.font = '150px ' + FONT; ctx.fillText(sym, w / 2, h / 2 + 6); }
    else { ctx.font = '120px ' + FONT; ctx.globalAlpha = 0.9; ctx.fillText(sym, w / 2, h / 2 + 6); ctx.globalAlpha = 1; }
    this.cardCache[key] = c; return c;
  };
  P.drawCard = function (ctx, card, x, y, w, h, faceUp, flip, alpha) {
    const img = this.cardImage(card, faceUp);
    ctx.save(); if (alpha != null) ctx.globalAlpha = alpha;
    ctx.translate(x + w / 2, y + h / 2); if (flip != null) ctx.scale(Math.max(0.02, Math.abs(flip)), 1);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
  };
  P.drawChip = function (ctx, x, y, color, text, textColor, r) {
    r = r || 14; ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.72);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(0, 5, r, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r); g.addColorStop(0, lighten(color, 0.3)); g.addColorStop(1, color); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = r * 0.2; ctx.setLineDash([r * 0.45, r * 0.6]); ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (text) { ctx.fillStyle = textColor; ctx.font = '900 ' + Math.round(r * 0.8) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.scale(1, 1.38); ctx.fillText(text, 0, 1); }
    ctx.restore();
  };
  function lighten(hex, k) { const n = parseInt(hex.slice(1), 16); const f = c => Math.min(255, Math.round(c + (255 - c) * k)); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }
  function chipBreakdown(amount) { const out = []; let a = Math.round(amount); for (let i = CHIP_COLORS.length - 1; i >= 0 && a > 0; i--) { const v = CHIP_COLORS[i][0]; const n = Math.floor(a / v); for (let k = 0; k < n && out.length < 14; k++) out.push(CHIP_COLORS[i]); a -= n * v; } return out; }
  P.drawStack = function (ctx, x, y, amount, label, above) {
    const chips = chipBreakdown(amount); if (!chips.length) return;
    const cols = Math.min(3, Math.ceil(chips.length / 6)); const per = Math.ceil(chips.length / cols);
    chips.forEach((ch, i) => { const col = Math.floor(i / per), row = i % per; this.drawChip(ctx, x + (col - (cols - 1) / 2) * 24, y - row * 5, ch[1], null, ch[2], 12); });
    if (label) { ctx.save(); ctx.font = '700 17px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6; ctx.fillText(fmt(amount), x, above ? y - per * 5 - 18 : y + 22); ctx.restore(); }
  };

  /* ------------------------------------------------------- animation */
  P.flyCard = function (seat, card, delay, dur) { const to = this.cardSlot(seat, this.game.seats[seat].cards.indexOf(card)); this.anims.push({ type: 'card', card: card, from: SHOE, to: to, t: -delay, dur: dur || 0.32, seat: seat }); };
  P.flyChips = function (from, to, amount, delay, dur) { const chips = chipBreakdown(amount).slice(0, 8); chips.forEach((ch, i) => this.anims.push({ type: 'chip', color: ch[1], from: from, to: to, t: -(delay || 0) - i * 0.03, dur: dur || 0.5 })); };
  P.flip = function (seat) { this.anims.push({ type: 'flip', seat: seat, t: 0, dur: 0.45 }); };
  P.tag = function (seat, text, color) { this.tags[seat] = { text: text, color: color || '#fff', t0: this.now }; };
  P.update = function (dt) { this.anims = this.anims.filter(a => (a.t += dt) < a.dur); };
  P.cardSlot = function (seat, idx) { const base = toward(SEATS[seat], seat === 0 ? 140 : seat === 3 ? 172 : 150); return { x: base.x - CARD.w + Math.max(0, idx) * (CARD.w + 6) - 3, y: base.y - CARD.h / 2 }; };
  P.betSpot = function (seat) { return toward(SEATS[seat], seat === 0 ? 250 : seat === 3 ? 268 : 245); };
  P.pendingCards = function (seat) { let n = 0; this.anims.forEach(a => { if (a.type === 'card' && a.seat === seat) n++; }); return n; };

  /* --------------------------------------------------------- drawing */
  P.draw = function (now) {
    const ctx = this.ctx, S = this.scale * this.dpr, g = this.game, e = g.engine, h = e.hand; this.now = now;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    this.drawBackground(ctx); this.drawTable(ctx);
    /* pot + board */
    const pot = h ? h.pot : 0;
    if (pot > 0) this.drawStack(ctx, 960, 410, pot, true, true);
    if (h) {
      ctx.save(); ctx.font = '700 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(243,226,176,0.85)'; ctx.letterSpacing = '3px'; ctx.fillText(pot > 0 ? 'POT' : '', 960, 352); ctx.restore();
      h.board.forEach((card, i) => { const x = 960 - (5 * 100) / 2 + i * 100 + 4, y = 500 - CARD.ch / 2; const bornAt = g.boardShown[i]; if (bornAt == null) return; const age = now - bornAt; const flip = age < 0.3 ? Math.cos((1 - age / 0.3) * Math.PI / 2) : 1; const lit = g.highlight ? g.highlight.has(card) : true; this.drawCard(ctx, card, x, y, CARD.cw, CARD.ch, true, age < 0.3 ? Math.max(0.05, flip) : null, lit ? 1 : 0.42); });
    }
    /* seats */
    for (let i = 0; i < g.seats.length; i++) this.drawSeat(ctx, i, now);
    this.drawButton(ctx);
    this.drawAnims(ctx);
    this.drawBanner(ctx, now);
  };
  P.drawBackground = function (ctx) {
    const img = this.images.bg; ctx.fillStyle = '#0a0a0e'; ctx.fillRect(0, 0, W, H);
    if (img) { const r = Math.max(W / img.width, H / img.height), w = img.width * r, h = img.height * r; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); }
    const v = ctx.createRadialGradient(960, 520, 300, 960, 520, 1300); v.addColorStop(0, 'rgba(0,0,0,0.1)'); v.addColorStop(1, 'rgba(0,0,0,0.78)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  };
  P.drawTable = function (ctx) {
    ctx.save(); ctx.translate(CENTER.x, CENTER.y);
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24; ctx.fillStyle = '#2a140a'; ctx.beginPath(); ctx.ellipse(0, 0, 770, 380, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    let g = ctx.createLinearGradient(-770, -380, 770, 380); g.addColorStop(0, '#6a3418'); g.addColorStop(0.5, '#3d1a0b'); g.addColorStop(1, '#5a2b14'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 770, 380, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,215,120,0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, 745, 356, 0, 0, TAU); ctx.stroke();
    g = ctx.createRadialGradient(0, -40, 60, 0, 0, 720); g.addColorStop(0, '#2a7a4c'); g.addColorStop(0.7, '#1a5a36'); g.addColorStop(1, '#0f3f26'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 712, 326, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 600, 250, 0, 0, TAU); ctx.stroke();
    const logo = this.images.logo; if (logo) { ctx.globalAlpha = 0.16; const lw = 520, lh = lw * logo.height / logo.width; ctx.drawImage(logo, -lw / 2, -lh / 2 + 150, lw, lh); ctx.globalAlpha = 1; }
    ctx.restore();
  };
  P.drawSeat = function (ctx, i, now) {
    const g = this.game, s = g.seats[i], e = g.engine, h = e.hand, pos = SEATS[i], acting = h && !h.done && h.actor === i, human = i === 0;
    const R = 48;
    /* bet chips */
    if (s.bet > 0) { const b = this.betSpot(i); this.drawStack(ctx, b.x, b.y, s.bet, true); }
    /* hole cards */
    const cards = s.cards || [], shown = cards.length - this.pendingCards(i);
    const faceUp = human ? true : !!s.show;
    for (let k = 0; k < shown; k++) {
      const card = cards[k], slot = this.cardSlot(i, k);
      const fl = this.anims.find(a => a.type === 'flip' && a.seat === i); let flip = null, up = faceUp;
      if (fl) { const u = fl.t / fl.dur; flip = Math.cos(u * Math.PI); up = u > 0.5; }
      const lit = g.highlight ? g.highlight.has(card) : true;
      this.drawCard(ctx, card, slot.x, slot.y, CARD.w, CARD.h, up, flip, s.folded ? 0.22 : (lit ? 1 : 0.45));
      if (g.highlight && lit && s.show) { ctx.save(); ctx.shadowColor = 'rgba(255,215,90,1)'; ctx.shadowBlur = 24; ctx.lineWidth = 3; ctx.strokeStyle = '#ffe17a'; roundRect(ctx, slot.x - 2, slot.y - 2, CARD.w + 4, CARD.h + 4, 9); ctx.stroke(); ctx.restore(); }
    }
    /* avatar */
    ctx.save();
    if (acting) { ctx.shadowColor = 'rgba(255,215,90,1)'; ctx.shadowBlur = 24 + 10 * Math.sin(now * 6); }
    ctx.fillStyle = acting ? '#ffe17a' : s.folded || s.stack === 0 && !s.allIn ? '#3a3a44' : '#b58900'; ctx.beginPath(); ctx.arc(pos.x, pos.y, R + 4, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.arc(pos.x, pos.y, R, 0, TAU); ctx.clip();
    const img = this.images[s.id]; if (img) ctx.drawImage(img, pos.x - R, pos.y - R, 2 * R, 2 * R); else { ctx.fillStyle = '#2a2a33'; ctx.fillRect(pos.x - R, pos.y - R, 2 * R, 2 * R); ctx.fillStyle = '#f3e2b0'; ctx.font = '700 40px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.name[0], pos.x, pos.y); }
    if (s.folded && h && !h.done) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(pos.x - R, pos.y - R, 2 * R, 2 * R); }
    ctx.restore();
    /* turn timer arc for the human */
    if (acting && human && g.turnStart != null) { const frac = Math.max(0, 1 - (now - g.turnStart) / g.turnLimit); ctx.beginPath(); ctx.arc(pos.x, pos.y, R + 9, -Math.PI / 2, -Math.PI / 2 + frac * TAU); ctx.lineWidth = 5; ctx.strokeStyle = frac < 0.3 ? '#ff5a5a' : '#7cff9d'; ctx.stroke(); }
    /* name plate */
    const pw = 150, ph = 46, px = pos.x - pw / 2, py = pos.y + R + 8;
    ctx.fillStyle = 'rgba(8,8,12,0.88)'; roundRect(ctx, px, py, pw, ph, 10); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = acting ? '#ffe17a' : 'rgba(233,194,80,0.45)'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f3e2b0'; ctx.font = '700 15px ' + FONT; ctx.fillText(s.name.toUpperCase(), pos.x, py + 14);
    ctx.fillStyle = s.stack === 0 ? '#ff8a8a' : '#ffe9a8'; ctx.font = '800 18px ' + FONT; ctx.fillText(s.stack === 0 ? (s.allIn ? 'ALL IN' : 'BUSTED') : fmt(s.stack), pos.x, py + 33);
    /* action tag */
    const tag = this.tags[i];
    if (tag && now - tag.t0 < 2.2) { const a = Math.min(1, (2.2 - (now - tag.t0)) / 0.4); ctx.globalAlpha = a; ctx.fillStyle = tag.color; roundRect(ctx, pos.x - 54, pos.y - R - 34, 108, 26, 13); ctx.fill(); ctx.fillStyle = '#111'; ctx.font = '800 14px ' + FONT; ctx.fillText(tag.text, pos.x, pos.y - R - 21); ctx.globalAlpha = 1; }
    /* hand name at showdown */
    if (s.show && s.handName && !human && h && h.street === 'showdown') { ctx.fillStyle = 'rgba(0,0,0,0.75)'; const t = s.handName, tw = ctx.measureText(t).width + 24; ctx.font = '600 13px ' + FONT; roundRect(ctx, pos.x - tw / 2, py + ph + 4, tw, 22, 8); ctx.fill(); ctx.fillStyle = s.winAmount > 0 ? '#ffe17a' : '#cfc7b0'; ctx.fillText(t, pos.x, py + ph + 15); }
    ctx.restore();
  };
  P.drawButton = function (ctx) {
    const e = this.game.engine; if (e.button < 0) return; const p = toward(SEATS[e.button], e.button === 0 ? 300 : 280); const o = { x: p.x + 70, y: p.y };
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3; ctx.fillStyle = '#f7f3e6'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 16, 11, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#222'; ctx.font = '900 10px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('D', o.x, o.y + 1); ctx.restore();
  };
  P.drawAnims = function (ctx) {
    this.anims.forEach(a => {
      if (a.t < 0 || !a.from || !a.to) return; const u = Math.min(1, a.t / a.dur), e = 1 - Math.pow(1 - u, 3);
      const x = a.from.x + (a.to.x - a.from.x) * e, y = a.from.y + (a.to.y - a.from.y) * e - Math.sin(u * Math.PI) * 40;
      if (a.type === 'card') { ctx.save(); ctx.translate(x + CARD.w / 2, y + CARD.h / 2); ctx.rotate((1 - u) * 0.8); this.drawCard(ctx, a.card, -CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, false, null, 1); ctx.restore(); }
      else if (a.type === 'chip') this.drawChip(ctx, x, y, a.color, null, null, 12);
    });
  };
  P.drawBanner = function (ctx, now) {
    const b = this.game.banner; if (!b) return; const age = now - b.t0; if (age > b.dur) return;
    const a = Math.min(1, age / 0.3) * Math.min(1, (b.dur - age) / 0.4);
    ctx.save(); ctx.globalAlpha = a; ctx.font = '700 30px ' + SERIF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(b.text).width + 60; ctx.fillStyle = 'rgba(6,6,10,0.85)'; roundRect(ctx, 960 - tw / 2, 586, tw, 52, 14); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#e9c250'; ctx.stroke();
    ctx.fillStyle = '#ffe9a8'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8; ctx.fillText(b.text, 960, 612); ctx.restore();
  };
  PK.Renderer = Renderer;
})(window);
