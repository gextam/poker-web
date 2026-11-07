/* ============================================================================
   TEXAS HOLD'EM — DOM: action bar with bet slider and presets, HUD, hand
   history feed, rebuy, help, splash, keyboard and sound controls.
   ========================================================================== */
(function (root) {
  'use strict';
  const PK = root.PK;
  const $ = id => document.getElementById(id);
  const A = () => PK.audio;
  function UI(game, renderer) {
    this.game = game; this.renderer = renderer;
    this.el = { fold: $('btn-fold'), check: $('btn-check'), raise: $('btn-raise'), allin: $('btn-allin'), slider: $('slider'), amount: $('amount'), presets: Array.from(document.querySelectorAll('.preset')), rebuy: $('btn-rebuy'), help: $('btn-help'), sound: $('btn-sound'), vol: $('vol'), feed: $('feed'), hud: $('hud'), message: $('message'), helpBox: $('help'), helpClose: $('help-close'), splash: $('splash'), splashText: $('splash-text'), stackYou: $('stack-you'), toCall: $('to-call') };
    this.splashVisible = true; this.ready = false; this.helpOpen = false; this.feedLen = -1; this.raiseTo = 0;
    this.bind();
  }
  const P = UI.prototype;
  P.bind = function () {
    const g = this.game, e = this.el;
    const press = (el, fn) => el.addEventListener('click', ev => { ev.preventDefault(); A().init(); fn(); });
    press(e.fold, () => g.act('fold'));
    press(e.check, () => { const la = g.legal(); if (!la) { A().deny(); return; } g.act(la.canCheck ? 'check' : 'call'); });
    press(e.raise, () => g.act('raise', this.raiseTo));
    press(e.allin, () => g.act('allin'));
    press(e.rebuy, () => g.rebuy());
    press(e.help, () => { A().tick(); this.toggleHelp(); }); press(e.helpClose, () => { A().tick(); this.toggleHelp(false); });
    press(e.sound, () => { const m = A().toggleMute(); this.updateSound(); if (!m) A().tick(); });
    e.vol.addEventListener('input', () => { A().init(); A().setVolume(parseFloat(e.vol.value)); if (A().muted) { A().setMuted(false); this.updateSound(); } });
    e.slider.addEventListener('input', () => { this.raiseTo = parseInt(e.slider.value, 10); this.syncAmount(); });
    e.amount.addEventListener('change', () => { const la = g.legal(); if (!la) return; this.raiseTo = Math.max(la.minRaiseTo, Math.min(la.maxRaiseTo, parseInt(e.amount.value, 10) || la.minRaiseTo)); this.syncAmount(); });
    e.presets.forEach(p => press(p, () => { const la = g.legal(); if (!la) return; const pot = la.pot + la.toCall; let v = la.minRaiseTo; const k = p.dataset.p; if (k === 'half') v = la.currentBet + Math.round(pot * 0.5); else if (k === 'pot') v = la.currentBet + pot; else if (k === 'max') v = la.maxRaiseTo; this.raiseTo = Math.max(la.minRaiseTo, Math.min(la.maxRaiseTo, v)); this.syncAmount(); A().tick(); }));
    e.splash.addEventListener('pointerdown', () => { if (this.ready) this.start(); });
    root.addEventListener('keydown', ev => {
      if (ev.repeat) return;
      if (ev.code === 'Space' || ev.code === 'Enter') { ev.preventDefault(); A().init(); if (this.splashVisible) { if (this.ready) this.start(); } else if (this.helpOpen) this.toggleHelp(false); else e.check.click(); return; }
      if (this.splashVisible) return; A().init();
      switch (ev.code) {
        case 'KeyF': e.fold.click(); break; case 'KeyC': e.check.click(); break; case 'KeyR': e.raise.click(); break; case 'KeyA': e.allin.click(); break;
        case 'ArrowUp': case 'ArrowRight': { const la = g.legal(); if (la) { this.raiseTo = Math.min(la.maxRaiseTo, this.raiseTo + g.engine.bb); this.syncAmount(); } break; }
        case 'ArrowDown': case 'ArrowLeft': { const la = g.legal(); if (la) { this.raiseTo = Math.max(la.minRaiseTo, this.raiseTo - g.engine.bb); this.syncAmount(); } break; }
        case 'KeyH': this.toggleHelp(); break; case 'KeyM': A().toggleMute(); this.updateSound(); break; case 'Escape': this.toggleHelp(false); break; default: break;
      }
    });
    e.vol.value = A().volume; this.updateSound();
  };
  P.start = function () { A().init(); this.splashVisible = false; this.el.splash.classList.add('hidden'); this.game.begin(); };
  P.assetsLoaded = function () { this.ready = true; this.el.splashText.textContent = 'TAKE YOUR SEAT'; this.el.splash.classList.add('ready'); };
  P.syncAmount = function () { this.el.slider.value = this.raiseTo; this.el.amount.value = this.raiseTo; this.el.raise.textContent = (this.lastLa && this.lastLa.currentBet === 0 ? 'BET ' : 'RAISE TO ') + PK.fmt(this.raiseTo); };
  function set(el, text) { if (el && el._t !== text) { el._t = text; el.textContent = text; } }
  P.refresh = function () {
    const g = this.game, e = this.el, la = g.legal(), active = !!la && g.canAct();
    if (la && (!this.lastLa || this.lastLa.minRaiseTo !== la.minRaiseTo || this.lastLa.maxRaiseTo !== la.maxRaiseTo || this.lastLa.currentBet !== la.currentBet)) { e.slider.min = la.minRaiseTo; e.slider.max = la.maxRaiseTo; e.slider.step = Math.max(1, Math.round(g.engine.bb / 2)); this.raiseTo = la.minRaiseTo; this.lastLa = la; this.syncAmount(); }
    if (!la) this.lastLa = null;
    e.fold.disabled = !active; e.check.disabled = !active; e.raise.disabled = !active || !la.canRaise || la.minRaiseTo >= la.maxRaiseTo; e.allin.disabled = !active; e.slider.disabled = !active || !la.canRaise; e.amount.disabled = e.slider.disabled;
    e.presets.forEach(p => { p.disabled = e.slider.disabled; });
    set(e.check, la ? (la.canCheck ? 'CHECK' : 'CALL ' + PK.fmt(la.toCall)) : 'CHECK');
    if (la && la.canRaise && la.minRaiseTo >= la.maxRaiseTo) set(e.raise, 'ALL IN ' + PK.fmt(la.maxRaiseTo));
    document.getElementById('actions').classList.toggle('live', active);
    set(e.stackYou, PK.fmt(g.human().stack));
    set(e.toCall, la && la.toCall ? 'TO CALL ' + PK.fmt(la.toCall) : (la ? 'YOUR ACTION' : ''));
    e.rebuy.classList.toggle('hidden', !g.needRebuy);
    set(e.hud, 'HAND #' + g.engine.handNo + '  ·  BLINDS ' + g.engine.sb + '/' + g.engine.bb + (g.tourney ? '  ·  LEVEL ' + (g.level + 1) : '  ·  CASH GAME') + '  ·  BUY-IN ' + PK.fmt(g.buyIn));
    set(e.message, g.message || '');
    if (g.feed.length !== this.feedLen || (g.feed[0] && g.feed[0] !== this.lastFeed)) { this.feedLen = g.feed.length; this.lastFeed = g.feed[0]; e.feed.innerHTML = g.feed.slice(0, 60).map(f => '<div class="line ' + f.cls + '">' + f.text + '</div>').join(''); }
  };
  P.updateSound = function () { this.el.sound.textContent = A().muted ? '🔇' : '🔊'; this.el.sound.classList.toggle('muted', A().muted); };
  P.toggleHelp = function (force) { const open = force == null ? !this.helpOpen : force; this.helpOpen = open; this.el.helpBox.classList.toggle('hidden', !open); };
  PK.UI = UI;
})(window);
