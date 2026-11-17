/* arkuzo black hole: a giant black hole behind the wordmark. The intro starts inside its shadow, the camera falls out of it,
   the photon ring sweeps in from the edges and the page arrives. Stars are drawn here too, so they can be bent around the hole. */
(function () {
  'use strict';

  var root = document.documentElement;
  var canvas = document.querySelector('.hole');
  var hero = document.querySelector('.hero');
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  function arrive() { root.classList.add('arrived'); }

  var gl = null;
  try {
    var opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance',
      preserveDrawingBuffer: /[?&]debug\b/.test(location.search) };   // ?debug: lets a test read the frame back
    gl = canvas && (canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts));
  } catch (e) { gl = null; }
  if (!gl || !hero) { if (canvas) canvas.remove(); arrive(); return; }

  // ---------- shader ----------
  var VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
  var FS = [
    'precision highp float;',
    'uniform vec2 uCss; uniform float uScale; uniform vec2 uCtr; uniform float uRs; uniform float uTime; uniform float uRoll;',
    'uniform float uIncl; uniform float uExpo; uniform float uInten; uniform float uQ; uniform float uWarp; uniform vec2 uPar; uniform float uStars;',
    'const vec3 HOT = vec3(1.0, 0.95, 0.86); const vec3 WARM = vec3(1.0, 0.54, 0.24);',
    'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1.0,0.0)), f.x), mix(h2(i+vec2(0.0,1.0)), h2(i+vec2(1.0,1.0)), f.x), f.y); }',
    'float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ if (float(i) >= uQ) break; s += a * n2(p); p = p * 2.03 + 7.3; a *= 0.5; } return s; }',
    // noise around a circle without a seam: angle a (any value), k features per radian, y along the radius
    'float afbm(float a, float k, float y){ a = mod(a + 3.14159265, 6.28318531); return mix(fbm(vec2(a * k, y)), fbm(vec2((a - 6.28318531) * k, y)), a / 6.28318531); }',
    // Arkuzo Galaxy tints for a few stars
    'vec3 tint(float t){ return t < 0.25 ? vec3(0.22,0.74,0.97) : t < 0.5 ? vec3(0.65,0.55,0.98) : t < 0.75 ? vec3(1.0,0.9,0.64) : vec3(0.18,0.83,0.75); }',
    // one star per grid cell, kept away from the cell edges so a single lookup is enough
    'vec3 layer(vec2 q, float cell, float prob, float r0, float r1, float a0, float a1, float sd, float tp){',
    '  vec2 g = q / cell; vec2 id = floor(g); vec2 f = fract(g); float h = h2(id + sd);',
    '  if (h > prob) return vec3(0.0);',
    '  vec2 pos = vec2(h2(id + sd + 3.1), h2(id + sd + 7.7)) * 0.6 + 0.2;',
    '  float rad = mix(r0, r1, pow(h2(id + sd + 11.3), 3.0));',
    '  float d = length((f - pos) * cell);',
    '  float a = mix(a0, a1, h2(id + sd + 5.3)) * (0.72 + 0.28 * sin(uTime * (0.4 + h * 2.6) + h * 40.0));',
    '  float ht = h2(id + sd + 13.7); vec3 c = ht < tp ? tint(ht / tp) : vec3(1.0);',
    '  return c * a * (exp(-d * d / (rad * rad)) + exp(-d / (rad * 3.2)) * 0.1);',
    '}',
    'vec3 stars(vec2 q){',
    '  vec3 s = layer(q + uPar * 0.35, 46.0, 0.6, 0.45, 0.9, 0.18, 0.7, 1.0, 0.06);',
    '  s += layer(q + uPar * 0.7, 120.0, 0.55, 0.7, 1.35, 0.35, 0.9, 17.0, 0.12);',
    '  s += layer(q + uPar, 330.0, 0.42, 1.1, 2.0, 0.6, 1.0, 41.0, 0.2);',
    '  return s;',
    '}',
    'void main(){',
    '  vec2 css = gl_FragCoord.xy / uScale;',
    '  vec2 pr = vec2(css.x - uCtr.x, (uCss.y - css.y) - uCtr.y) * vec2(1.0, -1.0) / uRs;',   // Rs units, y up
    '  float r = length(pr);',
    '  float outside = smoothstep(0.985, 1.003, r);',
    '  vec3 col = vec3(0.0);',
    // --- the sky behind it, bent by the hole: every pixel looks up where its light really came from
    '  if (outside > 0.0 && uStars > 0.0) {',
    '    float E = 1.55;',
    '    vec2 sp = pr * (1.0 - E * E / max(r * r, 1e-3));',
    '    vec2 q = uCtr + vec2(sp.x, -sp.y) * uRs;',
    '    float mag = clamp(1.0 / abs(1.0 - pow(E / r, 4.0)), 1.0, 5.0);',
    '    vec3 sc = stars(q);',
    // falling out of the hole: the stars streak towards it
    '    if (uWarp > 0.01) { vec2 dir = normalize(sp + 1e-4) * uWarp * 38.0; for (int k = 1; k < 7; k++) sc += stars(q + dir * float(k)) * (1.0 - float(k) / 7.0); sc *= 1.0 / (1.0 + uWarp * 1.6); }',
    '    float hz = smoothstep(0.5, 0.9, fbm(q / 640.0 + 3.0));',
    '    sc += vec3(0.05, 0.08, 0.16) * hz * 0.55 + vec3(0.12, 0.05, 0.16) * smoothstep(0.62, 0.95, fbm(q / 900.0 + 9.0)) * 0.35;',
    '    col += sc * mag * outside * uStars;',
    '  }',
    // --- the hole itself, rolled by uRoll
    '  float c = cos(uRoll), s = sin(uRoll); vec2 p = vec2(c * pr.x - s * pr.y, s * pr.x + c * pr.y);',
    '  float hang = atan(p.y, p.x);',
    // accretion disk seen almost edge-on; the inner gas orbits faster, so the turbulence shears into spirals
    '  vec2 dp = vec2(p.x, p.y / uIncl); float dr = length(dp); float ang = atan(dp.y, dp.x);',
    '  float inner = 2.3, outer = 5.6;',
    '  float band = smoothstep(inner * 0.9, inner * 1.12, dr) * (1.0 - smoothstep(2.7, outer, dr));',
    '  vec3 lit = vec3(0.0);',
    '  if (band > 0.002) {',
    '    float om = uTime * 0.3 * pow(inner / max(dr, inner), 1.5);',
    '    float sw = afbm(ang - om + dr * 0.17, 3.0, dr * 1.05);',
    '    float fil = afbm(ang - om * 1.4, 11.0, dr * 4.4);',
    '    float heat = pow(clamp(1.0 - (dr - inner) / (outer - inner), 0.0, 1.0), 2.3);',
    // relativistic beaming: the side rushing towards us blazes, the other side sinks into dull red
    '    float beam = pow(clamp(1.0 + 0.78 * cos(ang + 0.2), 0.04, 1.9), 2.6);',
    '    float disk = band * (0.1 + 0.75 * sw + 0.55 * fil * fil) * (0.01 + heat * (0.4 + 0.6 * heat)) * beam * 0.85;',
    '    vec3 dcol = mix(WARM * vec3(0.95, 0.55, 0.4), HOT, clamp(heat * 1.15 + sw * 0.25, 0.0, 1.0));',
    '    dcol = mix(dcol, vec3(0.74, 0.86, 1.0), clamp((beam - 2.2) * 0.2, 0.0, 0.6));',
    '    dcol = mix(dcol, vec3(0.75, 0.15, 0.08), clamp((0.5 - beam) * 0.9, 0.0, 0.6));',
    '    lit += dcol * disk * (p.y < 0.0 ? 1.0 : outside);',
    '  }',
    // the far side of the disk, lensed into a wide arc over the shadow and a thin one under it
    '  float up = smoothstep(-0.15, 0.55, sin(hang));',
    '  float arc = exp(-pow((r - 1.62) / 0.42, 2.0)) * (0.25 + 0.75 * up);',
    '  if (arc > 0.004) {',
    '    float arcN = afbm(hang - uTime * 0.07, 5.0, r * 2.3);',
    '    float arcBeam = pow(clamp(1.0 + 0.7 * cos(hang + 0.2), 0.05, 1.8), 1.8);',
    '    lit += mix(WARM, HOT, 0.55) * arc * (0.2 + 0.95 * arcN) * arcBeam * outside * 0.9;',
    '  }',
    '  lit += HOT * exp(-pow((r - 1.16) / 0.06, 2.0)) * (1.0 - up) * 0.9 * outside;',
    // photon ring: razor thin and blinding, a faint second ring inside, and a soft glow standing in for bloom
    '  float dring = r - 1.035;',
    '  if (abs(dring) < 0.12) lit += HOT * exp(-pow(dring / 0.018, 2.0)) * (0.75 + 0.5 * afbm(hang + uTime * 0.086, 7.0, 3.0)) * 1.5 * outside;',
    '  lit += HOT * exp(-pow((r - 1.012) / 0.007, 2.0)) * 0.45 * outside;',
    '  lit += mix(WARM, HOT, 0.6) * exp(-max(r - 1.0, 0.0) * 4.0) * 0.08 * outside;',
    '  float spi = afbm(hang + log(max(r, 1e-3)) * 3.5 - uTime * 0.11, 2.0, r * 0.52);',
    '  lit += WARM * vec3(1.0, 0.5, 0.35) * 0.07 * smoothstep(0.55, 0.85, spi) * exp(-(r - 1.0) * 0.6) * outside;',
    '  lit += vec3(0.55, 0.12, 0.08) * 0.03 * exp(-r * 0.6) * outside;',
    '  col += lit * uInten;',
    // filmic shoulder instead of hard clipping
    '  col = 1.0 - exp(-col * uExpo * 1.15);',
    // the shadow is truly black: it hides everything behind it, the meteors included
    '  float a = clamp(max(1.0 - outside, max(col.r, max(col.g, col.b))), 0.0, 1.0);',
    '  gl_FragColor = vec4(col, a);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { var log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log); }
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    if (window.console) console.warn('arkuzo hole: falling back to the plain sky', e);
    canvas.remove(); arrive(); return;
  }
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aLoc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['uCss', 'uScale', 'uCtr', 'uRs', 'uTime', 'uRoll', 'uIncl', 'uExpo', 'uInten', 'uQ', 'uWarp', 'uPar', 'uStars'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  // the plain star canvas (sky.js) now only draws meteors; its stars come from here so the hole can bend them
  var shared = window.__arkHole = { on: true, meteors: false };

  // ---------- layout: the hole sits behind the content, its shadow frames the logo, wordmark and button ----------
  var W = 0, H = 0, scale = 1, rsRest = 300, ctrX = 0, ctrY = 0, incl = 0.3;
  var maxScale = touch ? 1 : 1.5, quality = 1;
  function wordmarkWidth() {
    var wm = document.querySelector('.wordmark'); if (!wm) return 0;
    var cs = getComputedStyle(wm), fs = parseFloat(cs.fontSize) || 60;
    var m = document.createElement('canvas').getContext('2d');
    m.font = '400 ' + fs + 'px ' + cs.fontFamily;
    return m.measureText(wm.textContent).width + wm.textContent.length * fs * 0.04;
  }
  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    scale = Math.min(window.devicePixelRatio || 1, maxScale) * quality;
    canvas.width = Math.max(1, Math.round(W * scale)); canvas.height = Math.max(1, Math.round(H * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    var mark = document.querySelector('.mark'), btn = document.querySelector('.discord');
    var top = mark ? mark.getBoundingClientRect().top : H * 0.3, bot = btn ? btn.getBoundingClientRect().bottom : H * 0.7;
    ctrX = W / 2; ctrY = (top + bot) / 2;
    var half = (bot - top) / 2;
    rsRest = Math.max(wordmarkWidth() / 2 * 1.14, half * (W < 640 ? 1.32 : 1.18), Math.min(W, H) * 0.3);
    // phones in portrait: tilt the disk a little more so it passes under the text
    incl = W < 640 ? 0.38 : 0.3;
  }

  // ---------- intro ----------
  var seen = false;
  try { seen = sessionStorage.getItem('arkuzo-intro') === '1'; } catch (e) { /* storage blocked */ }
  var intro = still || !root.classList.contains('js-intro') ? null : { t: 0, rate: seen ? 2.2 : 1, hold: 0.3, dur: 4.0, shown: false };
  function skip() { if (intro) intro.rate = Math.max(intro.rate, (intro.hold + intro.dur - intro.t) / 0.9); }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, skip, { passive: true }); });
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // ---------- parallax ----------
  var mx = 0, my = 0, px = 0, py = 0;
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX / W - 0.5; my = e.clientY / H - 0.5;
  }, { passive: true });

  // ---------- frame ----------
  var raf = 0, last = 0, time = 0, frames = 0, slow = 0, tuned = false;
  function render(dt) {
    var rs = rsRest, roll = 0, warp = 0, expo = 1, inten = 1;
    px += (mx - px) * 0.05; py += (my - py) * 0.05;
    if (intro) {
      intro.t += dt * intro.rate;
      var u = Math.min(1, Math.max(0, (intro.t - intro.hold) / intro.dur));
      var e = 0.7 * (1 - Math.pow(1 - u, 3)) + 0.3 * easeInOut(u);
      var halfDiag = Math.hypot(W, H) / 2, start = halfDiag * 5 / rsRest;
      rs = rsRest * Math.pow(start, 1 - e);   // zooming out in log space feels like a steady fall
      roll = 0.5 * Math.pow(1 - e, 2);
      var prev = intro.rs || rs; warp = Math.min(1, Math.abs(Math.log(prev / rs)) / Math.max(dt, 1e-3) * 0.16); intro.rs = rs;
      expo = 1 + 0.55 * Math.exp(-Math.pow((rs * 1.035 - halfDiag) / (halfDiag * 0.35), 2));
      inten = 0.55 + 0.45 * Math.min(1, e * 1.4);
      if (!intro.shown && u > 0.6) { intro.shown = true; arrive(); }
      if (u >= 1) {
        intro = null; arrive(); shared.meteors = true;
        try { sessionStorage.setItem('arkuzo-intro', '1'); } catch (err) { /* storage blocked */ }
      }
    } else {
      rs = rsRest * (1 + 0.004 * Math.sin(time * 0.6));
    }
    gl.uniform2f(U.uCss, W, H); gl.uniform1f(U.uScale, scale);
    gl.uniform2f(U.uCtr, ctrX - px * 10, ctrY - py * 8); gl.uniform1f(U.uRs, rs);
    gl.uniform1f(U.uTime, time); gl.uniform1f(U.uRoll, roll); gl.uniform1f(U.uIncl, incl);
    gl.uniform1f(U.uExpo, expo); gl.uniform1f(U.uInten, inten); gl.uniform1f(U.uQ, touch || quality < 1 ? 4 : 5);
    gl.uniform1f(U.uWarp, warp); gl.uniform2f(U.uPar, -px * 18, -py * 18); gl.uniform1f(U.uStars, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now; time += dt;
    render(dt);
    // a device that cannot keep up gets fewer pixels (once, after the intro)
    if (!intro && !tuned && dt) {
      frames++; if (dt > 0.024) slow++;
      if (frames >= 90) { tuned = true; if (slow > 45 && quality > 0.55) { quality *= 0.7; layout(); tuned = false; frames = slow = 0; } }
    }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (raf || still) return; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  window.addEventListener('resize', function () { layout(); if (still) render(0); }, { passive: true });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); if (still) render(0); });

  // test hooks: at(t) freezes the intro at t seconds, play() runs it again
  shared.at = function (t) { if (!intro) intro = { t: 0, rate: 1, hold: 0.3, dur: 4.0, shown: true }; intro.t = t; intro.rate = 0; intro.rs = 0; };
  shared.draw = function () { render(0); };
  shared.play = function () { intro = { t: 0, rate: 1, hold: 0.3, dur: 4.0, shown: true }; };

  layout();
  if (still || !intro) { shared.meteors = true; arrive(); }
  if (still) render(0); else start();
})();
