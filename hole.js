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
    'uniform sampler2D uTex; uniform sampler2D uGlow; uniform sampler2D uLogo; uniform float uLogoA; uniform vec4 uLogoR; uniform vec4 uTx; uniform vec2 uTxB; uniform float uTxA; uniform float uTxW;',
    'const vec3 HOT = vec3(1.0, 0.95, 0.86); const vec3 WARM = vec3(1.0, 0.54, 0.24);',
    'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1.0,0.0)), f.x), mix(h2(i+vec2(0.0,1.0)), h2(i+vec2(1.0,1.0)), f.x), f.y); }',
    'float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ if (float(i) >= uQ) break; s += a * n2(p); p = p * 2.03 + 7.3; a *= 0.5; } return s; }',
    // noise around a circle without a seam: angle a (any value), k features per radian, y along the radius
    'float afbm(float a, float k, float y){ a = mod(a + 3.14159265, 6.28318531); return mix(fbm(vec2(a * k, y)), fbm(vec2((a - 6.28318531) * k, y)), a / 6.28318531); }',
    // Arkuzo Galaxy tints for a few stars
    // the wordmark texture at a point given in hole units (y up); uTx is its rectangle on the page in CSS pixels
    'vec2 txUv(vec2 s){ vec2 c = uCtr + vec2(s.x, -s.y) * uRs; return (c - uTx.xy) / uTx.zw; }',
    'vec4 txAt(vec2 s){ vec2 uv = txUv(s); if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0); return texture2D(uTex, uv); }',
    'float glowAt(vec2 s){ vec2 uv = txUv(s); if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0; return texture2D(uGlow, uv).a; }',
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
    '  float arc = exp(-pow((r - 1.55) / 0.32, 2.0)) * (0.2 + 0.8 * up);',
    '  if (arc > 0.004) {',
    '    float arcN = afbm(hang - uTime * 0.07, 5.0, r * 2.3);',
    '    float arcBeam = pow(clamp(1.0 + 0.7 * cos(hang + 0.2), 0.05, 1.8), 1.8);',
    '    lit += mix(WARM, HOT, 0.45) * arc * (0.12 + 1.05 * arcN * arcN) * arcBeam * outside * 0.8;',
    '  }',
    '  lit += HOT * exp(-pow((r - 1.16) / 0.06, 2.0)) * (1.0 - up) * 0.9 * outside;',
    // photon ring: razor thin and blinding, a faint second ring inside, and a soft glow standing in for bloom
    '  float dring = r - 1.035;',
    '  float beat = 0.9 + 0.16 * pow(0.5 + 0.5 * sin(uTime * 0.9), 6.0);',
    '  if (abs(dring) < 0.12) lit += HOT * exp(-pow(dring / 0.018, 2.0)) * (0.75 + 0.5 * afbm(hang + uTime * 0.086, 7.0, 3.0)) * 1.5 * beat * outside;',
    '  lit += HOT * exp(-pow((r - 1.012) / 0.007, 2.0)) * 0.45 * outside;',
    '  lit += mix(WARM, HOT, 0.6) * exp(-max(r - 1.0, 0.0) * 4.0) * 0.08 * outside;',
    '  float spi = afbm(hang + log(max(r, 1e-3)) * 3.5 - uTime * 0.11, 2.0, r * 0.52);',
    '  lit += WARM * vec3(1.0, 0.5, 0.35) * 0.12 * smoothstep(0.5, 0.85, spi) * exp(-(r - 1.0) * 0.6) * outside;',
    '  lit += vec3(0.6, 0.1, 0.05) * 0.06 * exp(-(r - 1.0) * 1.4) * outside;',
    '  lit += vec3(0.55, 0.12, 0.08) * 0.03 * exp(-r * 0.6) * outside;',
    '  col += lit * uInten;',
    // filmic shoulder instead of hard clipping
    '  col = 1.0 - exp(-col * uExpo * 1.15);',
    // deeper, warmer midtones: the haze sinks towards black and ember, the blinding ring stays white
    '  col = pow(col, vec3(1.25, 1.36, 1.52));',
    // the shadow is truly black: it hides everything behind it, the meteors included
    '  float a = clamp(max(1.0 - outside, max(col.r, max(col.g, col.b))), 0.0, 1.0);',
    // --- the wordmark, caught by the hole: stretched towards the ring and squeezed across it near the ends (like
    // spaghettification), bowed along the ring, a shimmer of warped space and colour fringes; the middle stays clean
    // --- the Arkuzo mark deep inside the shadow, behind the wordmark: barely there, beating with the ring, seen
    // through static like a dying broadcast, with scanlines, a rolling bar and now and then a glitch that tears it apart
    '  if (uLogoA > 0.001 && r < 1.0) {',
    '    float tt = uTime, inner = 1.0 - smoothstep(0.5, 0.97, r);',
    '    float gb = step(0.9, h2(vec2(floor(tt * 6.0), 7.3))) * step(0.5, h2(vec2(floor(tt * 23.0), 1.9)));',
    '    float band = floor((p.y + 3.0) * 30.0);',
    '    vec2 lp = p;',
    '    lp.x += (h2(vec2(band, floor(tt * 30.0))) - 0.5) * 0.12 * gb;',
    '    lp.x += sin(p.y * 40.0 + tt * 3.0) * 0.0025;',
    '    lp = (lp - uLogoR.xy) / (1.0 + 0.015 * sin(tt * 0.9));',
    '    vec2 luv = vec2(lp.x / uLogoR.z + 0.5, 0.5 - lp.y / uLogoR.w);',
    '    float ca = 0.004 + 0.035 * gb;',
    '    vec3 lg = vec3(0.0);',
    '    if (luv.x > -0.05 && luv.x < 1.05 && luv.y > 0.0 && luv.y < 1.0) {',
    '      lg = vec3(texture2D(uLogo, luv + vec2(ca, 0.0)).a, texture2D(uLogo, luv).a, texture2D(uLogo, luv - vec2(ca, 0.0)).a);',
    '    }',
    '    vec2 px = floor(gl_FragCoord.xy / max(uScale, 1.0) / 1.5);',
    '    float st = h2(px + fract(tt * 17.31) * 113.0);',
    '    float sl = 0.72 + 0.28 * sin(css.y * 2.2);',
    '    float roll = 0.75 + 0.25 * smoothstep(0.0, 0.1, fract(-p.y * 0.35 - tt * 0.11)) * (1.0 - smoothstep(0.1, 0.2, fract(-p.y * 0.35 - tt * 0.11)));',
    '    float pulse = 0.55 + 0.6 * pow(0.5 + 0.5 * sin(tt * 0.9), 6.0);',
    '    float fade = smoothstep(-0.75, 0.35, lp.y) * inner;',
    '    vec3 mk = lg * mix(0.2, 1.0, st) * sl * roll * pulse * fade * 0.3;',
    '    mk *= vec3(1.0, 0.8, 0.74) * (1.0 + gb * 0.9);',
    '    col += mk * uLogoA;',
    // a faint snow over the whole void, so the black is never quite still
    '    col += vec3(st * st) * 0.022 * inner * uLogoA;',
    '  }',
    '  if (uTxA > 0.001 && abs(p.x) < uTxB.x && abs(p.y) < uTxB.y) {',
    '    float rr = length(p), w = uTxW, ax = abs(p.x);',
    '    vec2 src = p * (1.0 - 0.22 * w * pow(min(rr, 1.3), 4.0));',
    '    src.y *= 1.0 + 0.55 * w * ax * ax * ax;',
    '    src.y += 0.06 * w * src.x * src.x;',
    '    src += p / max(rr, 1e-3) * 0.0022 * w * sin(rr * 42.0 - uTime * 1.7);',
    '    float ca = 0.014 * w * rr * rr;',
    '    vec4 t0 = txAt(src * (1.0 + ca)), t1 = txAt(src), t2 = txAt(src * (1.0 - ca));',
    '    vec4 tx = vec4(t0.r, t1.g, t2.b, max(t0.a, max(t1.a, t2.a)));',
    '    float ga = glowAt(src);',
    '    vec3 tcol = tx.rgb * mix(vec3(1.0), vec3(1.0, 0.84, 0.68), smoothstep(0.3, 0.95, rr) * 0.55);',
    '    vec3 glow = mix(HOT, vec3(0.72, 0.86, 1.0), 0.45) * ga * 0.16;',
    // past the radius where the pull folds back, the mapping would mirror the letters: fade out before it
    '    float rf = min(0.975, pow(1.0 / (1.1 * w), 0.25));',
    '    float keep = (1.0 - smoothstep(rf - 0.07, rf, rr)) * uTxA;',
    '    float ta = tx.a * keep;',
    '    col = col * (1.0 - ta) + (tcol + glow * (1.0 - tx.a)) * keep;',
    '    a = max(a, max(ta, ga * 0.16 * keep));',
    '  }',
    '  gl_FragColor = vec4(col, a);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { var log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log); }
    return s;
  }
  var U = {};
  // compiles the shader and uploads the triangle; runs again when the GPU context comes back (iOS drops it in the background)
  function setup() {
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aLoc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    ['uCss', 'uScale', 'uCtr', 'uRs', 'uTime', 'uRoll', 'uIncl', 'uExpo', 'uInten', 'uQ', 'uWarp', 'uPar', 'uStars', 'uTex', 'uGlow', 'uLogo', 'uLogoA', 'uLogoR', 'uTx', 'uTxB', 'uTxA', 'uTxW'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.uniform1i(U.uTex, 0);
    glowTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, glowTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.uniform1i(U.uGlow, 1);
    logoTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, logoTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.uniform1i(U.uLogo, 2); gl.activeTexture(gl.TEXTURE0);
    logoOk = false; loadLogo();
    txOk = false;
  }
  // the mark for the inside of the hole (same file as the small logo above the wordmark)
  var logoTex = null, logoOk = false, logoImg = null, logoAspect = 304 / 318;
  function loadLogo() {
    var put = function () {
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, logoTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, logoImg);
      gl.activeTexture(gl.TEXTURE0);
      logoAspect = logoImg.naturalWidth / Math.max(1, logoImg.naturalHeight);
      logoOk = true; root.classList.add('mark-in-hole');
    };
    if (logoImg && logoImg.complete && logoImg.naturalWidth) { put(); return; }
    var mk = document.querySelector('.mark');
    logoImg = new Image(); logoImg.onload = put;
    logoImg.src = mk ? mk.getAttribute('src') : 'assets/mark.png';
  }
  var tex = null, glowTex = null, txOk = false, txRect = [0, 0, 1, 1], txB = [0, 0];
  try { setup(); } catch (e) {
    if (window.console) console.warn('arkuzo hole: falling back to the plain sky', e);
    canvas.remove(); arrive(); return;
  }

  // the plain star canvas (sky.js) now only draws meteors; its stars come from here so the hole can bend them
  var shared = window.__arkHole = { on: true, meteors: false };

  // ---------- layout: the hole sits behind the content, its shadow frames the logo, wordmark and button ----------
  var W = 0, H = 0, scale = 1, rsRest = 300, ctrX = 0, ctrY = 0, incl = 0.3;
  var maxScale = touch ? 1 : 1.5, quality = 1;
  var wm = document.querySelector('.wordmark');
  // width of the wordmark at 100px, with the CSS letter-spacing of .04em
  function wordmarkW100() {
    if (!wm) return 400;
    var m = document.createElement('canvas').getContext('2d'), t = wm.textContent.trim();
    m.font = '400 100px ' + getComputedStyle(wm).fontFamily;
    return m.measureText(t).width + t.length * 4;
  }
  // the wordmark drawn into a texture, brushed metal like the CSS; the shader bends it
  function makeText() {
    if (!wm) return;
    var cs = getComputedStyle(wm), fs = parseFloat(cs.fontSize) || 60, t = wm.textContent.trim(), r = wm.getBoundingClientRect();
    var pad = Math.round(fs * 0.6), ts = Math.min(2, window.devicePixelRatio || 1) * (touch ? 1 : 1.25);
    var w = r.width + pad * 2, h = r.height + pad * 2;
    var c = document.createElement('canvas'); c.width = Math.ceil(w * ts); c.height = Math.ceil(h * ts);
    var g = c.getContext('2d'); g.scale(ts, ts);
    g.font = '400 ' + fs + 'px ' + cs.fontFamily; g.textBaseline = 'middle';
    var grad = g.createLinearGradient(0, h / 2 - fs * 0.42, 0, h / 2 + fs * 0.42);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.42, '#eef1f6'); grad.addColorStop(1, '#a9b1c0');
    g.fillStyle = grad;
    var ls = fs * 0.04, widths = t.split('').map(function (ch) { return g.measureText(ch).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + ls * (t.length - 1), x = w / 2 - total / 2;
    var x0 = x;
    for (var i = 0; i < t.length; i++) { g.fillText(t[i], x, h / 2 + fs * 0.02); x += widths[i] + ls; }
    var gc = document.createElement('canvas'); gc.width = Math.ceil(w * 0.5); gc.height = Math.ceil(h * 0.5);
    var gg = gc.getContext('2d'); gg.scale(0.5, 0.5);
    gg.font = g.font; gg.textBaseline = 'middle'; gg.fillStyle = '#fff';
    gg.shadowColor = '#fff'; gg.shadowBlur = fs * 0.12; gg.shadowOffsetX = 100000 * 0.5;   // shadow sizes ignore the 0.5 scale (device pixels)
    for (var j = 0, gx = x0; j < t.length; j++) { gg.fillText(t[j], gx - 100000, h / 2 + fs * 0.02); gx += widths[j] + ls; }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, glowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gc);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    txRect = [r.left + r.width / 2 - w / 2, r.top + r.height / 2 - h / 2, w, h];
    txB = [Math.min(1.4, (w / 2) / rsRest * 1.2), (h / 2) / rsRest * 2.2];
    txOk = true;
    root.classList.add('lensed');
  }
  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    scale = Math.min(window.devicePixelRatio || 1, maxScale) * quality;
    canvas.width = Math.max(1, Math.round(W * scale)); canvas.height = Math.max(1, Math.round(H * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    // a big hole: the shadow fills most of the screen's height (most of the width on phones)
    rsRest = Math.max(110, Math.min(W * 0.44, H * 0.36));
    // the wordmark spans about three quarters of the shadow, so its ends reach into the pull of the ring
    var fs = Math.max(24, Math.min(170, rsRest * 2 * 0.74 / wordmarkW100() * 100));
    root.style.setProperty('--wm', fs.toFixed(1) + 'px');
    root.style.setProperty('--gap', Math.round(rsRest * 0.19) + 'px');
    if (wm) { var r = wm.getBoundingClientRect(); ctrX = r.left + r.width / 2; ctrY = r.top + r.height / 2; } else { ctrX = W / 2; ctrY = H / 2; }
    incl = W < 640 ? 0.34 : 0.28;
    makeText();
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
  var raf = 0, last = 0, time = 0, frames = 0, slow = 0, tuned = false, txA = 1, txW = 1, txWarpX = 0, logoA = 1;
  function render(dt) {
    var rs = rsRest, roll = 0, warp = 0, expo = 1, inten = 1;
    txA = 1; txW = 1 + 0.08 * Math.sin(time * 0.45); txWarpX = 0; logoA = 1;
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
      // the wordmark condenses out of the warped space as the camera settles
      var k = Math.min(1, Math.max(0, (u - 0.45) / 0.45)); k = k * k * (3 - 2 * k);
      txA = k; txW = 1 + 5 * (1 - k) * (1 - k); txWarpX = 1.5 * (1 - k);
      // the mark flickers on a moment before the wordmark, like a signal finding its channel
      var lk = Math.min(1, Math.max(0, (u - 0.3) / 0.4)); logoA = lk * (lk < 1 ? 0.55 + 0.45 * (Math.sin(time * 37) > 0 ? 1 : 0) : 1);
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
    gl.uniform4f(U.uTx, txRect[0] - px * 10, txRect[1] - py * 8, txRect[2], txRect[3]); gl.uniform2f(U.uTxB, txB[0] * (1 + txWarpX), txB[1] * (1 + txWarpX));
    gl.uniform1f(U.uTxA, txOk ? txA : 0); gl.uniform1f(U.uTxW, txW);
    gl.uniform1f(U.uLogoA, logoOk ? logoA : 0); gl.uniform4f(U.uLogoR, 0.0, 0.06, 1.3 * logoAspect, 1.3);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now; time += dt;
    render(dt);
    // a device that cannot keep up gets fewer pixels (after the intro). If fewer pixels do not make it faster, the frame
    // rate is capped (iPhone Low Power Mode runs at 30 fps), so the sharp picture comes back and tuning stops.
    if (!intro && !tuned && dt) {
      dts.push(dt);
      if (dts.length >= 90) {
        var med = dts.slice().sort(function (a, b) { return a - b; })[45]; dts.length = 0;
        if (med <= 0.024) tuned = true;
        else if (prevMed && med > prevMed * 0.88) { tuned = true; quality = prevQ; layout(); }
        else if (quality > 0.55) { prevMed = med; prevQ = quality; quality *= 0.7; layout(); }
        else tuned = true;
      }
    }
    raf = requestAnimationFrame(frame);
  }
  var dts = [], prevMed = 0, prevQ = 1;
  function start() { if (raf || still) return; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  // iOS fires resize on every step of the address bar sliding in and out: lay out once per frame at most
  var relayout = 0;
  window.addEventListener('resize', function () {
    if (relayout) return;
    relayout = requestAnimationFrame(function () { relayout = 0; layout(); if (still) render(0); });
  }, { passive: true });
  var lost = false;
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (!lost) start(); });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; stop(); }, false);
  canvas.addEventListener('webglcontextrestored', function () {
    try { setup(); lost = false; layout(); if (still) render(0); else start(); } catch (e) { canvas.remove(); shared.on = false; shared.meteors = true; }
  }, false);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); if (still) render(0); });

  // test hooks: at(t) freezes the intro at t seconds, play() runs it again
  shared.at = function (t) { if (!intro) intro = { t: 0, rate: 1, hold: 0.3, dur: 4.0, shown: true }; intro.t = t; intro.rate = 0; intro.rs = 0; };
  shared.draw = function () { render(0); };
  shared.play = function () { intro = { t: 0, rate: 1, hold: 0.3, dur: 4.0, shown: true }; };

  layout();
  if (still || !intro) { shared.meteors = true; arrive(); }
  if (still) render(0); else start();
})();
