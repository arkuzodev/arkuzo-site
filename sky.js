/* arkuzo sky: a still starfield (tints borrowed from Arkuzo Galaxy) crossed by small white meteors. */
(function () {
  'use strict';

  var canvas = document.querySelector('.sky');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var calm = document.body.classList.contains('calm');        // legal pages: fewer meteors
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Arkuzo Galaxy node colours, used sparingly as star tints
  var TINTS = ['#ffe7a3', '#2dd4bf', '#a78bfa', '#38bdf8', '#6d8bff', '#9aa6d6', '#fbbf24'];

  var W = 0, H = 0, DPR = 1;
  var stars = [];
  var meteors = [];
  var sprites = {};
  var raf = 0, last = 0, clock = 0, nextMeteor = 0;
  var px = 0, py = 0, tx = 0, ty = 0; // parallax: current and target

  function rand(a, b) { return a + Math.random() * (b - a); }

  // soft round dot, pre-rendered once per colour so every star is crisp at any DPR
  function sprite(color) {
    if (sprites[color]) return sprites[color];
    var s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d');
    var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, color);
    gr.addColorStop(0.18, color);
    gr.addColorStop(0.32, hexA(color, 0.35));
    gr.addColorStop(1, hexA(color, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    return (sprites[color] = c);
  }

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function seed() {
    var area = W * H;
    var count = Math.max(160, Math.min(900, Math.round(area / 2300)));
    stars = [];
    for (var i = 0; i < count; i++) {
      var depth = Math.random();                       // 0 far .. 1 near
      var big = Math.random() < 0.035;
      var tinted = Math.random() < 0.1;
      stars.push({
        x: rand(-20, W + 20),
        y: rand(-20, H + 20),
        r: big ? rand(1.3, 2.1) : 0.35 + Math.pow(Math.random(), 2.4) * 1.0,
        a: big ? rand(0.75, 1) : rand(0.22, 0.8),
        d: depth,
        tw: Math.random() < 0.45 ? rand(0.15, 0.55) : 0,  // twinkle amount
        f: rand(0.4, 1.4),
        p: rand(0, Math.PI * 2),
        c: tinted ? TINTS[(Math.random() * TINTS.length) | 0] : '#ffffff'
      });
    }
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
    if (still.matches) draw(0);
  }

  function spawn() {
    // a loose shower: everything falls from upper right towards lower left
    var angle = (28 + rand(-7, 7)) * Math.PI / 180;       // degrees below the horizon
    var bright = Math.random() < 0.14;
    var scale = Math.min(1, Math.max(0.6, W / 1400));
    meteors.push({
      x: rand(W * 0.15, W * 1.15),
      y: rand(-H * 0.15, H * 0.55),
      vx: -Math.cos(angle),                               // leftwards
      vy: Math.sin(angle),                                // downwards
      speed: rand(750, 1300) * scale,
      len: (bright ? rand(200, 280) : rand(80, 170)) * scale,
      w: bright ? 1.6 : 1.1,
      t: 0,
      life: rand(0.45, 0.85),
      peak: bright ? 1 : rand(0.6, 0.9)
    });
  }

  function draw(dt) {
    ctx.clearRect(0, 0, W, H);

    // parallax eases toward the pointer
    px += (tx - px) * 0.04;
    py += (ty - py) * 0.04;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = s.a;
      if (s.tw && dt) a *= 1 - s.tw + s.tw * (0.5 + 0.5 * Math.sin(clock * s.f + s.p));
      var off = 4 + s.d * 14;
      var size = s.r * 6;                 // sprite core is ~1/3 of its box
      ctx.globalAlpha = a;
      ctx.drawImage(sprite(s.c), s.x + px * off - size / 2, s.y + py * off - size / 2, size, size);
    }
    ctx.globalAlpha = 1;

    // meteors
    for (var j = meteors.length - 1; j >= 0; j--) {
      var m = meteors[j];
      m.t += dt;
      var k = m.t / m.life;
      if (k >= 1) { meteors.splice(j, 1); continue; }

      m.x += m.vx * m.speed * dt;
      m.y += m.vy * m.speed * dt;

      // quick ignite, long burn-out
      var env = k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.4);
      var alpha = env * m.peak;
      var tail = m.len * (0.35 + 0.65 * Math.min(1, k / 0.25));
      var tx2 = m.x - m.vx * tail, ty2 = m.y - m.vy * tail;

      var g = ctx.createLinearGradient(m.x, m.y, tx2, ty2);
      g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
      g.addColorStop(0.25, 'rgba(225,238,255,' + alpha * 0.45 + ')');
      g.addColorStop(1, 'rgba(200,225,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = m.w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx2, ty2);
      ctx.stroke();

      // the head: a small hot point with a halo
      ctx.globalAlpha = alpha;
      var hs = m.w * 9;
      ctx.drawImage(sprite('#ffffff'), m.x - hs / 2, m.y - hs / 2, hs, hs);
      ctx.globalAlpha = 1;
    }
  }

  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    clock += dt;

    if (now >= nextMeteor) {
      spawn();
      if (!calm && Math.random() < 0.12) spawn();       // the odd pair
      nextMeteor = now + (calm ? rand(5000, 11000) : rand(900, 2600));
    }

    draw(dt);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || still.matches) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  window.addEventListener('resize', resize, { passive: true });

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    tx = (e.clientX / W - 0.5) * -1;
    ty = (e.clientY / H - 0.5) * -1;
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  var onMotionPref = function () {
    meteors = [];
    if (still.matches) { stop(); draw(0); } else start();
  };
  if (still.addEventListener) still.addEventListener('change', onMotionPref);
  else if (still.addListener) still.addListener(onMotionPref);

  resize();
  nextMeteor = performance.now() + (calm ? 2500 : 550);  // first meteor lands with the page
  if (still.matches) draw(0); else start();
})();
