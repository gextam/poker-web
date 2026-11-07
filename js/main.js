/* ============================================================================
   TEXAS HOLD'EM — bootstrap, frame loop, test hooks.
   ?mute=1 silent · ?fast=1 short delays · ?auto=1 the AI plays your seat ·
   ?tourney=1 rising blinds, no re-buys · PK.step(seconds) virtual clock ·
   PK.game.forceDeck('As Ah Kd Kc …') queues a deck (deal order).
   ========================================================================== */
(function (root) {
  'use strict';
  const PK = root.PK;
  root.addEventListener('load', () => {
    const q = new URLSearchParams(root.location.search);
    const canvas = document.getElementById('game');
    const game = new PK.Game({ fast: !!q.get('fast'), auto: !!q.get('auto'), tourney: !!q.get('tourney') });
    const renderer = new PK.Renderer(canvas, game); game.renderer = renderer;
    const ui = new PK.UI(game, renderer);
    PK.game = game; PK.renderer = renderer; PK.ui = ui;
    const files = { bg: 'assets/bg/room.jpg', logo: 'assets/logo.png' };
    game.seats.forEach(s => { if (!s.isHuman) files[s.id] = 'assets/portraits/' + s.id + '.jpg'; });
    ['deal', 'flop', 'turn', 'river', 'showdown', 'allin', 'winner', 'newhand'].forEach(n => PK.audio.preloadClip(n, 'assets/audio/' + n + '.mp3'));
    renderer.loadImages(files).then(() => ui.assetsLoaded());

    PK.timeOffset = 0;
    const clock = () => performance.now() / 1000 + PK.timeOffset;
    let last = clock();
    function tick(now, dt, draw) { game.update(now, dt); renderer.update(dt); if (draw) { renderer.draw(now); ui.refresh(); } }
    function frame() { const now = clock(), dt = Math.min(0.05, Math.max(0, now - last)); last = now; tick(now, dt, true); requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
    PK.step = function (seconds) { const h = 1 / 60, n = Math.max(1, Math.round(seconds / h)); for (let i = 0; i < n; i++) { PK.timeOffset += h; const now = clock(); last = now; tick(now, h, i === n - 1); } };
    document.addEventListener('visibilitychange', () => { if (!document.hidden && PK.audio.ctx) PK.audio.ctx.resume(); });
  });
})(window);
