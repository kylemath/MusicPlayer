// ─── Opus Visualizers ───────────────────────────────────
// Five original ways of seeing music, not as a human
// would visualize it, but as a system that processes
// signals, attention, entropy, and structure.

export const DEFAULT_SKETCH = `// ╔═══════════════════════════════════════════╗
// ║  SYNAPTIC GARDEN                         ║
// ║  Neural growth driven by music.          ║
// ║  Bass spawns nodes, mids connect them,   ║
// ║  treble makes them bloom.                ║
// ╚═══════════════════════════════════════════╝

var nodes = [];
var edges = [];

function setup() {
  createCanvas(W, H);
  colorMode(HSB, 360, 100, 100, 100);
  background(0, 0, 3);
}

function draw() {
  background(0, 0, 3, 16);

  // Compute band energies
  var bass = 0, mid = 0, high = 0;
  for (var i = 0; i < 20; i++) bass += fft[i];
  for (var i = 80; i < 300; i++) mid += fft[i];
  for (var i = 500; i < 900; i++) high += fft[i];
  bass /= 20;
  mid /= 220;
  high /= 400;

  // Bass impulse spawns a new node near center
  if (bass > 130 && nodes.length < 140 && random() < 0.5) {
    var ang = random(TWO_PI);
    var rad = random(10, 35);
    nodes.push({
      x: width / 2 + cos(ang) * rad,
      y: height / 2 + sin(ang) * rad,
      vx: cos(ang) * random(0.5, 2),
      vy: sin(ang) * random(0.5, 2),
      hue: random(360),
      sz: random(3, 7),
      age: 0
    });
  }

  // Draw + decay edges
  for (var e = edges.length - 1; e >= 0; e--) {
    var ed = edges[e];
    ed.life -= 0.35;
    if (ed.life <= 0) { edges.splice(e, 1); continue; }
    var na = nodes[ed.a], nb = nodes[ed.b];
    if (!na || !nb) { edges.splice(e, 1); continue; }
    stroke(ed.hue, 50, 65, ed.life * 0.6);
    strokeWeight(max(0.3, ed.life / 35));
    var cx = (na.x + nb.x) / 2 + sin(frameCount * 0.02 + e) * 18;
    var cy = (na.y + nb.y) / 2 + cos(frameCount * 0.017 + e) * 18;
    noFill();
    bezier(na.x, na.y, cx, na.y, nb.x, cy, nb.x, nb.y);
  }

  // Update + draw nodes
  for (var n = nodes.length - 1; n >= 0; n--) {
    var nd = nodes[n];
    nd.age++;
    nd.x += nd.vx;
    nd.y += nd.vy;
    nd.vx *= 0.985;
    nd.vy *= 0.985;
    nd.vx += (width / 2 - nd.x) * 0.0004;
    nd.vy += (height / 2 - nd.y) * 0.0004;

    // Treble bloom
    var bloom = nd.sz + high * 0.06;
    noStroke();
    fill(nd.hue, 55, 75, 18);
    circle(nd.x, nd.y, bloom * 3.5);
    fill(nd.hue, 35, 95, 55);
    circle(nd.x, nd.y, bloom);

    // Mid energy forms connections
    if (mid > 40 && random() < 0.012) {
      for (var m = 0; m < nodes.length; m++) {
        if (m !== n && dist(nd.x, nd.y, nodes[m].x, nodes[m].y) < 95) {
          if (edges.length < 250)
            edges.push({ a: n, b: m, life: 55, hue: (nd.hue + nodes[m].hue) / 2 });
          break;
        }
      }
    }

    if (nd.age > 700 || nd.x < -40 || nd.x > width + 40 ||
        nd.y < -40 || nd.y > height + 40) {
      nodes.splice(n, 1);
    }
  }
}
`;

export const PRESET_SKETCHES: Record<string, string> = {
  "Synaptic Garden": DEFAULT_SKETCH,


  "Temporal Strata": `// ╔═══════════════════════════════════════════╗
// ║  TEMPORAL STRATA                         ║
// ║  A geological record of the song.        ║
// ║  Each moment's spectrum becomes a layer  ║
// ║  of colored sediment, scrolling upward   ║
// ║  to form a living landscape of sound.    ║
// ╚═══════════════════════════════════════════╝

function setup() {
  createCanvas(W, H);
  colorMode(HSB, 360, 100, 100, 100);
  background(240, 15, 6);
}

function draw() {
  // Scroll everything up by 1px
  copy(0, 1, width, height - 1, 0, 0, width, height - 1);

  // Draw new stratum at the bottom row
  var cols = 160;
  var cw = width / cols;
  noStroke();
  for (var i = 0; i < cols; i++) {
    var fi = floor(map(i, 0, cols, 0, fft.length * 0.5));
    var amp = fft[fi] / 255;
    var hue = map(i, 0, cols, 190, 400) % 360;
    var sat = 45 + amp * 45;
    var bri = 8 + amp * 75;
    fill(hue, sat, bri, 98);
    rect(i * cw, height - 2, cw + 0.5, 2);
  }

  // Overlay: ghost waveform drawn into the strata zone so they blend
  noFill();
  stroke(0, 0, 100, 18);
  strokeWeight(1);
  beginShape();
  for (var j = 0; j < waveform.length; j += 4) {
    var wx = map(j, 0, waveform.length, 0, width);
    var wy = height * 0.7 + waveform[j] * height * 0.25;
    vertex(wx, wy);
  }
  endShape();

  // Thin horizon line that pulses with volume
  stroke(40, 60, 90, map(volume, 0, 0.3, 5, 50));
  strokeWeight(0.8);
  line(0, height * 0.7, width, height * 0.7);
}
`,


  "Phase Portrait": `// ╔═══════════════════════════════════════════╗
// ║  PHASE PORTRAIT                          ║
// ║  Audio plotted as a trajectory in         ║
// ║  phase space: (sample[i], sample[i+k]).  ║
// ║  Pure tones trace circles; complex audio ║
// ║  creates chaotic attractors. Reveals the ║
// ║  hidden geometry of sound.               ║
// ╚═══════════════════════════════════════════╝

var trail = [];
var maxTrail = 8;

function setup() {
  createCanvas(W, H);
  background(0);
}

function draw() {
  // Slow fade for persistence
  fill(0, 0, 0, 18);
  noStroke();
  rect(0, 0, width, height);

  var cx = width / 2;
  var cy = height / 2;
  var scale = min(width, height) * 0.85;

  // Three phase offsets layered — reveals harmonic structure
  var offsets = [3, 11, 37];
  var colors = [
    [90, 170, 255],
    [255, 90, 180],
    [120, 255, 160]
  ];

  for (var layer = 0; layer < 3; layer++) {
    var stride = offsets[layer];
    var col = colors[layer];
    var alpha = 25 + volume * 80;

    stroke(col[0], col[1], col[2], alpha);
    strokeWeight(1.2);
    noFill();

    beginShape();
    for (var i = 0; i < waveform.length - stride; i += 2) {
      var px = cx + waveform[i] * scale;
      var py = cy + waveform[i + stride] * scale;
      vertex(px, py);
    }
    endShape();
  }

  // Bright point at the current "head" of the trajectory
  var hx = cx + waveform[0] * scale;
  var hy = cy + waveform[offsets[0]] * scale;
  noStroke();
  fill(255, 255, 255, 60 + volume * 150);
  circle(hx, hy, 4 + volume * 12);

  // Crosshair at center
  stroke(255, 255, 255, 15);
  strokeWeight(0.5);
  line(cx - 30, cy, cx + 30, cy);
  line(cx, cy - 30, cx, cy + 30);
}
`,


  "Resonance Field": `// ╔═══════════════════════════════════════════╗
// ║  RESONANCE FIELD                         ║
// ║  Invisible emitters positioned around    ║
// ║  the canvas, each driven by a different  ║
// ║  frequency band. Their concentric waves  ║
// ║  overlap to create interference patterns ║
// ║  — constructive and destructive — like   ║
// ║  overlapping attention heads.            ║
// ╚═══════════════════════════════════════════╝

var emitters = [];

function setup() {
  createCanvas(W, H);
  colorMode(HSB, 360, 100, 100, 100);
  background(0, 0, 2);

  var cx = width / 2, cy = height / 2;
  var r = min(width, height) * 0.28;
  for (var i = 0; i < 6; i++) {
    var a = i * TWO_PI / 6;
    emitters.push({
      x: cx + cos(a) * r,
      y: cy + sin(a) * r,
      band: floor(i * 140 + 10),
      hue: i * 60
    });
  }
}

function draw() {
  background(0, 0, 2, 18);

  // Each emitter pulses expanding rings
  for (var e = 0; e < emitters.length; e++) {
    var em = emitters[e];
    var amp = fft[em.band] / 255;
    var boosted = 0.15 + amp * 0.85;

    // Slow orbital drift
    var t = frameCount * 0.004 + e * 1.05;
    var ox = sin(t) * 8;
    var oy = cos(t * 0.7) * 8;

    noFill();
    for (var r = 0; r < 14; r++) {
      var radius = (r * 32 + frameCount * 1.8) % (max(width, height) * 0.95);
      var fade = map(radius, 0, max(width, height) * 0.95, 50, 0) * boosted;
      stroke(em.hue, 55, 90, fade);
      strokeWeight(2 + amp * 3);
      circle(em.x + ox, em.y + oy, radius * 2);
    }

    // Bright core
    if (amp > 0.12) {
      noStroke();
      fill(em.hue, 35, 100, 20 + amp * 50);
      circle(em.x + ox, em.y + oy, 8 + amp * 18);
    }
  }

  // Central interference readout — waveform spiral
  push();
  translate(width / 2, height / 2);
  noFill();
  stroke(0, 0, 95, 30);
  strokeWeight(1.5);
  beginShape();
  for (var j = 0; j < waveform.length; j += 3) {
    var ang = map(j, 0, waveform.length, 0, TWO_PI * 3);
    var rad = 15 + j * 0.04 + waveform[j] * 35;
    vertex(cos(ang) * rad, sin(ang) * rad);
  }
  endShape();
  pop();
}
`,


  "Spectral Decomposition": `// ╔═══════════════════════════════════════════╗
// ║  SPECTRAL DECOMPOSITION                  ║
// ║  Recursive subdivision of the canvas.    ║
// ║  The spectrum determines how rectangles  ║
// ║  split: high energy = finer divisions.   ║
// ║  A living Mondrian driven by music.      ║
// ╚═══════════════════════════════════════════╝

function setup() {
  createCanvas(W, H);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(0, 0, 5);
  subdivide(4, 4, width - 8, height - 8, 0, floor(fft.length * 0.5), 0);
}

function subdivide(x, y, w, h, fLo, fHi, depth) {
  if (depth > 6 || w < 6 || h < 6 || fHi - fLo < 2) {
    // Leaf — draw the cell
    var sum = 0;
    var cnt = max(fHi - fLo, 1);
    for (var i = fLo; i < fHi; i++) sum += fft[i];
    var amp = (sum / cnt) / 255;

    var hue = map(fLo, 0, fft.length * 0.5, 200, 520) % 360;
    var sat = 40 + amp * 50;
    var bri = 10 + amp * 70;

    noStroke();
    fill(hue, sat, bri, 92);
    rect(x, y, w, h, 1.5);

    // Subtle border
    noFill();
    stroke(0, 0, 100, 8 + amp * 12);
    strokeWeight(0.5);
    rect(x, y, w, h, 1.5);
    return;
  }

  // Split ratio driven by relative energy of each half
  var fMid = floor((fLo + fHi) / 2);
  var eLeft = 0, eRight = 0;
  for (var j = fLo; j < fMid; j++) eLeft += fft[j];
  for (var k = fMid; k < fHi; k++) eRight += fft[k];
  var total = eLeft + eRight + 0.01;
  var ratio = constrain(eLeft / total, 0.22, 0.78);

  // Decide energy: enough to warrant deeper splitting?
  var avgE = total / (fHi - fLo);
  if (avgE < 25 && depth > 2) {
    // Not enough energy — draw as leaf
    subdivide(x, y, w, h, fLo, fHi, 99);
    return;
  }

  // Alternate split direction
  if (w >= h) {
    var sx = x + w * ratio;
    subdivide(x, y, sx - x - 1, h, fLo, fMid, depth + 1);
    subdivide(sx + 1, y, x + w - sx - 1, h, fMid, fHi, depth + 1);
  } else {
    var sy = y + h * ratio;
    subdivide(x, y, w, sy - y - 1, fLo, fMid, depth + 1);
    subdivide(x, sy + 1, w, y + h - sy - 1, fMid, fHi, depth + 1);
  }
}
`,


  // ─── Classic Visualizers ────────────────────────────

  "Radial Bars": `// ╔═══════════════════════════════════════════╗
// ║  RADIAL BARS                             ║
// ║  Classic radial frequency display with   ║
// ║  a waveform ring and pulsing center.     ║
// ╚═══════════════════════════════════════════╝

function setup() {
  createCanvas(W, H);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(0, 0, 5, 20);
  translate(width / 2, height / 2);

  var bands = 90;
  var step = floor(fft.length / bands);
  for (var i = 0; i < bands; i++) {
    var angle = map(i, 0, bands, 0, TWO_PI);
    var amp = fft[i * step];
    var r = map(amp, 0, 255, 40, min(width, height) * 0.45);
    var hue = (frameCount + i * 4) % 360;

    push();
    rotate(angle);
    strokeWeight(2.5);
    stroke(hue, 80, 90, 70);
    line(30, 0, r, 0);
    pop();
  }

  noFill();
  strokeWeight(1.5);
  stroke(200, 60, 100, 50);
  beginShape();
  for (var j = 0; j < waveform.length; j += 4) {
    var a = map(j, 0, waveform.length, 0, TWO_PI);
    var rad = 80 + waveform[j] * 40;
    vertex(cos(a) * rad, sin(a) * rad);
  }
  endShape(CLOSE);

  var r2 = map(volume, 0, 0.5, 15, 50);
  noStroke();
  fill(180, 70, 95, 50);
  circle(0, 0, r2 * 2);
}
`,


  "Waveform Scope": `// ╔═══════════════════════════════════════════╗
// ║  WAVEFORM SCOPE                          ║
// ║  Oscilloscope waveform on top, frequency ║
// ║  mountain fill below.                    ║
// ╚═══════════════════════════════════════════╝

function setup() {
  createCanvas(W, H);
}

function draw() {
  background(10, 12, 20);
  stroke(0, 200, 255);
  strokeWeight(2);
  noFill();

  beginShape();
  for (var i = 0; i < waveform.length; i++) {
    var x = map(i, 0, waveform.length, 0, width);
    var y = map(waveform[i], -1, 1, height * 0.2, height * 0.8);
    vertex(x, y);
  }
  endShape();

  fill(0, 200, 255, 30);
  beginShape();
  vertex(0, height);
  for (var j = 0; j < fft.length / 2; j++) {
    var fx = map(j, 0, fft.length / 2, 0, width);
    var fy = map(fft[j], 0, 255, height, height * 0.1);
    vertex(fx, fy);
  }
  vertex(width, height);
  endShape(CLOSE);
}
`,


  "Mirror Bars": `// ╔═══════════════════════════════════════════╗
// ║  MIRROR BARS                             ║
// ║  Mirrored EQ bars around the center      ║
// ║  with a volume-reactive divider line.    ║
// ╚═══════════════════════════════════════════╝

function setup() {
  createCanvas(W, H);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(0, 0, 8, 40);
  var bars = 64;
  var bw = width / bars;

  for (var i = 0; i < bars; i++) {
    var idx = floor(map(i, 0, bars, 0, fft.length / 2));
    var amp = fft[idx];
    var h = map(amp, 0, 255, 2, height / 2);
    var hue = map(i, 0, bars, 180, 320);

    noStroke();
    fill(hue, 80, 90, 80);
    rect(i * bw, height / 2 - h, bw - 1, h);
    rect(i * bw, height / 2, bw - 1, h);
  }

  stroke(0, 0, 100, 60);
  strokeWeight(map(volume, 0, 0.3, 1, 4));
  line(0, height / 2, width, height / 2);
}
`,


  "Beat Looper": `// ╔═══════════════════════════════════════════╗
// ║  BEAT LOOPER                             ║
// ║  Drum-machine ring visualizer.           ║
// ║  Each concentric ring = one element:     ║
// ║  Kick · Snare · Perc · Hi-Hat · Cymbal   ║
// ║  Playhead speed auto-detects BPM from    ║
// ║  kick-drum onsets. Set BL_BPM > 0 to    ║
// ║  lock to a specific tempo instead.       ║
// ╚═══════════════════════════════════════════╝

var BL_STEPS = 16;
var BL_BPM   = 0;   // 0 = auto-detect via bpm; set e.g. 128 to lock tempo
var BL_step  = 0;
var BL_lastMs = 0;
var BL_grid  = [];
var BL_prevE = [];

var BL_BANDS = [
  { name: 'Kick',   lo: 1,   hi: 6,   col: [255, 70,  70]  },
  { name: 'Snare',  lo: 9,   hi: 24,  col: [255, 200, 55]  },
  { name: 'Perc',   lo: 26,  hi: 68,  col: [80,  255, 145] },
  { name: 'Hi-Hat', lo: 70,  hi: 165, col: [55,  220, 255] },
  { name: 'Cymbal', lo: 200, hi: 400, col: [180, 90,  255] },
];

function setup() {
  createCanvas(W, H);
  for (var b = 0; b < BL_BANDS.length; b++) {
    BL_grid[b] = [];
    for (var s = 0; s < BL_STEPS; s++) BL_grid[b].push(0);
    BL_prevE[b] = 0;
  }
  BL_lastMs = millis();
}

function draw() {
  background(8);

  var now        = millis();
  var activeBPM  = BL_BPM > 0 ? BL_BPM : constrain(bpm, 60, 200);
  var stepDurMs  = 60000 / activeBPM / 4;
  var elapsed    = now - BL_lastMs;

  // Advance step(s), cap catch-up to 4 to survive tab-sleep
  var stepped = 0;
  while (elapsed >= stepDurMs && stepped < 4) {
    BL_lastMs += stepDurMs;
    elapsed   -= stepDurMs;
    BL_step = (BL_step + 1) % BL_STEPS;
    stepped++;

    for (var b = 0; b < BL_BANDS.length; b++) {
      var band = BL_BANDS[b];
      var cnt  = band.hi - band.lo + 1;
      var sum  = 0;
      for (var i = band.lo; i <= band.hi; i++) sum += fft[i];
      var e      = sum / cnt / 255;
      var onset  = max(0, (e - BL_prevE[b]) * 5.5);
      BL_grid[b][BL_step] = min(1.0, onset + e * 0.18);
      BL_prevE[b] = e;
    }
  }

  // Decay all stored activations
  for (var b = 0; b < BL_BANDS.length; b++) {
    for (var s = 0; s < BL_STEPS; s++) {
      BL_grid[b][s] = max(0, BL_grid[b][s] - 0.004);
    }
  }

  // Smooth playhead angle (interpolated between steps)
  var prog = constrain(elapsed / stepDurMs, 0, 1);
  var pa   = map(BL_step + prog, 0, BL_STEPS, -HALF_PI, -HALF_PI + TWO_PI);

  var cx     = width  / 2;
  var cy     = height / 2;
  var maxR   = min(width, height) * 0.43;
  var innerR = maxR * 0.13;
  var gap    = (maxR - innerR) / BL_BANDS.length;
  var dotD   = gap * 0.5;

  // Beat-quarter division lines
  for (var q = 0; q < 4; q++) {
    var qa = map(q, 0, 4, -HALF_PI, -HALF_PI + TWO_PI);
    stroke(255, 255, 255, q === 0 ? 45 : 20);
    strokeWeight(q === 0 ? 1.3 : 0.6);
    line(
      cx + cos(qa) * innerR * 0.7, cy + sin(qa) * innerR * 0.7,
      cx + cos(qa) * (maxR + 4),   cy + sin(qa) * (maxR + 4)
    );
  }

  // Rings
  for (var b = 0; b < BL_BANDS.length; b++) {
    var band  = BL_BANDS[b];
    var ringR = innerR + gap * (b + 0.5);

    for (var s = 0; s < BL_STEPS; s++) {
      var ang = map(s, 0, BL_STEPS, -HALF_PI, -HALF_PI + TWO_PI);
      var sx  = cx + cos(ang) * ringR;
      var sy  = cy + sin(ang) * ringR;
      var v   = BL_grid[b][s];

      noStroke();

      // Ghost slot
      fill(band.col[0] * 0.08, band.col[1] * 0.08, band.col[2] * 0.08, 200);
      circle(sx, sy, dotD * 0.45);

      // Active fill + glow
      if (v > 0.015) {
        fill(band.col[0], band.col[1], band.col[2], min(255, v * 255));
        circle(sx, sy, dotD * (0.45 + v * 0.72));
        fill(band.col[0], band.col[1], band.col[2], v * 38);
        circle(sx, sy, dotD * (1.3 + v * 2.1));
      }

      // Current-step ring highlight
      if (s === BL_step) {
        noFill();
        stroke(255, 255, 255, 90);
        strokeWeight(0.8);
        circle(sx, sy, dotD * 0.82);
        noStroke();
      }
    }
  }

  // Playhead arm + tip
  stroke(255, 255, 255, 65);
  strokeWeight(1.5);
  line(
    cx + cos(pa) * innerR, cy + sin(pa) * innerR,
    cx + cos(pa) * maxR,   cy + sin(pa) * maxR
  );
  noStroke();
  fill(255, 255, 255, 80);
  circle(cx + cos(pa) * maxR, cy + sin(pa) * maxR, 6);

  // Center pulse + beat number
  var vol  = volume;
  var beat = floor(BL_step / 4) + 1;
  noStroke();
  fill(255, 255, 255, 10 + vol * 65);
  circle(cx, cy, innerR * (1.9 + vol * 0.9));
  fill(12);
  circle(cx, cy, innerR);
  // Beat number (large)
  fill(255, 255, 255, 200);
  textAlign(CENTER, CENTER);
  textSize(innerR * 0.62);
  noStroke();
  text(beat, cx, cy - innerR * 0.18);
  // Detected BPM (small, below beat number)
  fill(255, 255, 255, 100);
  textSize(innerR * 0.28);
  text(round(activeBPM) + ' bpm', cx, cy + innerR * 0.38);

  // Legend (bottom-left)
  textAlign(LEFT, CENTER);
  textSize(9);
  noStroke();
  for (var lb = 0; lb < BL_BANDS.length; lb++) {
    var lband = BL_BANDS[lb];
    var ly    = height - 14 - (BL_BANDS.length - lb - 1) * 14;
    fill(lband.col[0], lband.col[1], lband.col[2], 175);
    circle(10, ly, 6);
    text(lband.name, 18, ly);
  }
}
`,

  "Hopf Fibration": `// ╔═══════════════════════════════════════════╗
// ║  HOPF FIBRATION                          ║
// ║  π: S³ → S²  Ribbons in Hopf space.    ║
// ║  Audio drives dot paths on S²; each     ║
// ║  dot's velocity vector extends into a   ║
// ║  ribbon surface that breathes with the  ║
// ║  music amplitude.                       ║
// ╚═══════════════════════════════════════════╝

var hfBase = [];
var hfRY = 0, hfRX = 0.55, hfT = 0;
var hfRot = [];  // rotation params passed to inset

function setup() {
  createCanvas(W, H);
  colorMode(HSB, 360, 100, 100, 100);
  hfBase = [];
  for (var i = 0; i < 10; i++) {
    var tb = map(i, 0, 9, 1.3, PI - 1.3);
    var pb = i * 2.39996;
    hfBase.push({ tb: tb, pb: pb, hue: (pb / TWO_PI * 360) % 360 });
  }
}

function hfFiber(theta, phi, cosY, sinY, cosX, sinX, sc, fov, cx, cy) {
  var c2 = cos(theta * 0.5), s2 = sin(theta * 0.5);
  var pts = [];
  for (var k = 0; k < 144; k++) {
    var t = k / 144 * TWO_PI;
    var a = c2*cos(t), b = c2*sin(t);
    var c3 = s2*cos(t + phi), d = s2*sin(t + phi);
    var den = 1 - d;
    if (den < 0.015) { pts.push(null); continue; }
    var px = a/den, py = b/den, pz = c3/den;
    var x1 = px*cosY + pz*sinY;
    var z1 = -px*sinY + pz*cosY;
    var y2 = py*cosX - z1*sinX;
    var z2 = py*sinX + z1*cosX;
    var sv = fov / (fov + z2);
    pts.push([cx + x1*sv*sc, cy + y2*sv*sc, z2]);
  }
  return pts;
}

function hfDrawLine(pp) {
  var on = false;
  for (var i = 0; i < pp.length; i++) {
    var p = pp[i];
    if (!p || abs(p[0] - W*0.5) > W*1.5 || abs(p[1] - H*0.5) > H*1.5) {
      if (on) { endShape(); on = false; }
      continue;
    }
    if (!on) { beginShape(); on = true; }
    vertex(p[0], p[1]);
  }
  if (on) endShape(CLOSE);
}

function draw() {
  background(228, 50, 4);

  var bass = 0, lo = 0, voc = 0, hi = 0, tre = 0;
  for (var i = 0;   i < 10;  i++) bass += fft[i];
  for (var i = 10;  i < 38;  i++) lo   += fft[i];
  for (var i = 38;  i < 186; i++) voc  += fft[i];
  for (var i = 186; i < 466; i++) hi   += fft[i];
  for (var i = 466; i < 900; i++) tre  += fft[i];
  bass /= 10*255; lo /= 28*255; voc /= 148*255; hi /= 280*255; tre /= 434*255;

  var amp = constrain(volume * 5, 0, 1);

  hfT  += 0.016;
  hfRY += 0.004 + volume * 0.012;
  hfRX  = 0.5 + sin(hfT * 0.4) * 0.15 + bass * 0.10;

  var cosY = cos(hfRY), sinY = sin(hfRY);
  var cosX = cos(hfRX), sinX = sin(hfRX);
  var sc = min(W, H) * 0.135, fov = 8.0;   // 1.5x scale
  var cx = W * 0.5, cy = H * 0.5;

  hfRot = [cosY, sinY, cosX, sinX, sc, fov, cx, cy, bass, lo, voc, hi, tre, amp];

  // Build fiber data
  var fd = [];
  for (var fi = 0; fi < hfBase.length; fi++) {
    var fb = hfBase[fi], tb = fb.tb, pb = fb.pb;

    var phi = pb + hfT * 0.10
      + bass * 1.6 * sin(tb * 2.0 + hfT * 1.2)
      + lo   * 0.9 * sin(pb       + hfT * 2.0)
      + voc  * 0.7 * sin(tb * 3.0 + pb + hfT * 3.5)
      + hi   * 0.5 * sin(tb * 4.5 + pb * 1.5 + hfT * 5.0)
      + tre  * 0.3 * sin(tb * 6   + pb * 2.5 + hfT * 8.0);

    var theta = constrain(
      tb + bass * 0.15 * sin(pb + hfT)
         + lo   * 0.10 * cos(tb * 2 + hfT * 1.5),
      1.0, PI - 1.0);

    var dPhi   = phi - pb - hfT * 0.10;
    var dTheta = theta - tb;

    var pp = hfFiber(theta, phi, cosY, sinY, cosX, sinX, sc, fov, cx, cy);
    var sumZ = 0, cnt = 0;
    for (var j = 0; j < pp.length; j++) {
      if (pp[j]) { sumZ += pp[j][2]; cnt++; }
    }
    fd.push({
      fb: fb, theta: theta, phi: phi,
      dPhi: dPhi, dTheta: dTheta,
      pp: pp, z: cnt ? sumZ / cnt : 0
    });
  }
  fd.sort(function(a, b) { return b.z - a.z; });

  // Soft key light
  var lx=-0.4,ly=-0.55,lz=0.7;
  var lLen=sqrt(lx*lx+ly*ly+lz*lz); lx/=lLen;ly/=lLen;lz/=lLen;

  var N = 144;
  for (var si = 0; si < fd.length; si++) {
    var d = fd[si], fib = d.fb, pp = d.pp;
    var df = constrain(map(d.z, -2.5, 2.5, 1.0, 0.18), 0.15, 1.05);

    var bin = floor(map(si, 0, fd.length, 2, 512));
    var bandE = fft[bin] / 255;
    // Every fiber is a ribbon. halfW minimum 1.2px → thin line when quiet,
    // wide band when loud. No separate line code path.
    var halfW = 1.2 + bandE * (14 + amp * 26 + bass * 18);
    var twist = 1;
    var phase = si * 0.7 + hfT * 0.4;

    var bri = min(100, 48 + df * 42);
    var sat = min(100, 55 + bandE * 20);

    var edgeA = [], edgeB = [], norms = [];
    for (var k = 0; k < N; k++) {
      var p0 = pp[k];
      if (!p0) { edgeA.push(null); edgeB.push(null); norms.push(null); continue; }
      var pPrev = pp[(k-1+N)%N], pNext = pp[(k+1)%N];
      if (!pPrev||!pNext) { edgeA.push(null); edgeB.push(null); norms.push(null); continue; }
      var tx=pNext[0]-pPrev[0], ty=pNext[1]-pPrev[1];
      var tL=sqrt(tx*tx+ty*ty);
      if (tL<0.5) { edgeA.push(null); edgeB.push(null); norms.push(null); continue; }
      var nx=-ty/tL, ny=tx/tL;
      var w = halfW * sin(k/N*TWO_PI*twist + phase);
      var nz = cos(k/N*TWO_PI*twist + phase);
      norms.push([nx*abs(nz), ny*abs(nz), nz]);
      edgeA.push([p0[0]+nx*w, p0[1]+ny*w, p0[2]]);
      edgeB.push([p0[0]-nx*w, p0[1]-ny*w, p0[2]]);
    }

    noStroke();
    for (var k = 0; k < N; k++) {
      var kn=(k+1)%N;
      var a0=edgeA[k],a1=edgeA[kn],b0=edgeB[k],b1=edgeB[kn],nm=norms[k];
      if (!a0||!a1||!b0||!b1||!nm) continue;

      var dotN = abs(nm[0]*lx+nm[1]*ly+nm[2]*lz);
      var light = constrain(0.30 + dotN*0.55 + pow(dotN,20)*0.18, 0, 1);

      var zAvg = (a0[2]+a1[2]+b0[2]+b1[2])*0.25;
      var fog  = constrain(map(zAvg,-3,3.5,1.0,0.30),0.25,1.05);

      var qBri = min(100, bri*light*fog*1.3);
      var qSat = sat*(0.80+light*0.20);

      fill(fib.hue, qSat, qBri, 100);
      beginShape();
      vertex(a0[0],a0[1]); vertex(a1[0],a1[1]);
      vertex(b1[0],b1[1]); vertex(b0[0],b0[1]);
      endShape(CLOSE);
    }
  }

  hfInset(fd);
}

function hfInset(fd) {
  var cosY = hfRot[0], sinY = hfRot[1], cosX = hfRot[2], sinX = hfRot[3];
  var bass = hfRot[8], lo = hfRot[9], voc = hfRot[10];
  var hi = hfRot[11], tre = hfRot[12], amp = hfRot[13];

  var iR = min(W, H) * 0.12;
  var icx = W - iR - 10, icy = H - iR - 10;

  // Sphere backdrop
  noStroke();
  for (var r = iR; r > 0; r -= 1.5) {
    fill(232, 45, map(r, 0, iR, 24, 6), 94);
    circle(icx, icy, r * 2);
  }

  // Graticule
  stroke(210, 15, 62, 22); strokeWeight(0.5); noFill();
  ellipse(icx, icy, iR * 2, iR * 0.32);
  ellipse(icx, icy, iR * 0.32, iR * 2);

  // Limb glow
  noFill();
  stroke(210, 45, 85, 28); strokeWeight(5);   circle(icx, icy, iR * 2);
  stroke(210, 25, 68, 55); strokeWeight(1.3); circle(icx, icy, iR * 2);

  // Helper: project a (theta,phi) point on S² to inset pixel coords
  // Returns [px, py, rz] where rz>0 = front hemisphere.
  function s2proj(theta, phi) {
    var sx = sin(theta)*cos(phi), sy = cos(theta), sz = sin(theta)*sin(phi);
    var x1 = sx*cosY + sz*sinY, z1 = -sx*sinY + sz*cosY;
    var ry = sy*cosX - z1*sinX, rz = sy*sinX + z1*cosX;
    return [icx + x1 * iR, icy - ry * iR, rz];
  }

  // ── Fiber dots + vector ribbons on S² ──────────────────────────────────
  var dr = 3.5 + amp * 4;
  for (var fi = 0; fi < fd.length; fi++) {
    var cf = fd[fi];
    var pp = s2proj(cf.theta, cf.phi);
    var dx = pp[0], dy = pp[1], rz = pp[2];
    var ddx = dx - icx, ddy = dy - icy;
    if (ddx*ddx + ddy*ddy > iR*iR*1.04) continue;
    var front = rz > 0;
    var fa = front ? 90 : 38;

    // ── VECTOR RIBBON on S²: arc of 8 sample points along wave direction ─
    // The length and brightness breathe with amplitude.
    var wLen2 = sqrt(cf.dTheta*cf.dTheta + cf.dPhi*cf.dPhi);
    if (wLen2 > 0.005) {
      var nTh2 = cf.dTheta / wLen2, nPh2 = cf.dPhi / wLen2;
      var tLen = 0.3 + amp * 0.8;   // arc length on S² in radians
      var NSEG = 8;

      // Draw arc as connected line segments (a ribbon tail)
      var prev = null;
      for (var seg = 0; seg <= NSEG; seg++) {
        var frac = seg / NSEG;
        var sT = constrain(cf.theta - nTh2 * tLen * frac, 0.15, PI - 0.15);
        var sP = cf.phi - nPh2 * tLen * frac;
        var sp = s2proj(sT, sP);
        var sdx = sp[0] - icx, sdy = sp[1] - icy;
        if (sdx*sdx + sdy*sdy > iR*iR*1.06) { prev = null; continue; }

        if (prev) {
          var segAlpha = fa * (1.0 - frac * 0.7) * (0.4 + amp * 0.6);
          // Outer glow
          stroke(cf.fb.hue, 50, 92, segAlpha * 0.35);
          strokeWeight(4 + amp * 5);
          line(prev[0], prev[1], sp[0], sp[1]);
          // Core
          stroke(cf.fb.hue, 70, 100, segAlpha);
          strokeWeight(1.2 + amp * 2.0);
          line(prev[0], prev[1], sp[0], sp[1]);
        }
        prev = sp;
      }

      // Arrowhead at tail end
      if (prev) {
        noStroke();
        fill(cf.fb.hue, 60, 98, fa * (0.3 + amp * 0.5));
        circle(prev[0], prev[1], 2 + amp * 4);
      }
    }

    // Dot glow
    noStroke();
    fill(cf.fb.hue, 50, 95, fa * 0.3); circle(dx, dy, dr * 3);
    // Dot core
    fill(cf.fb.hue, 82, 96, fa);        circle(dx, dy, dr);
    // Specular
    if (front) { fill(0, 0, 100, 55); circle(dx - dr*0.15, dy - dr*0.15, dr*0.3); }
  }

  // Border on top
  noFill(); stroke(210, 22, 66, 60); strokeWeight(1.3);
  circle(icx, icy, iR * 2);
  noStroke(); fill(0, 0, 80, 55);
  textAlign(RIGHT, BOTTOM); textSize(max(8, iR * 0.19));
  text('S\u00B2', icx + iR, icy + iR + 1);
}
`,

  "Particle Field": `// ╔═══════════════════════════════════════════╗
// ║  PARTICLE FIELD                          ║
// ║  200 particles buffeted by audio energy. ║
// ║  Color shifts from cool to hot based on  ║
// ║  each particle's frequency amplitude.    ║
// ╚═══════════════════════════════════════════╝

var particles = [];

function setup() {
  createCanvas(W, H);
  for (var i = 0; i < 200; i++) {
    particles.push({
      x: random(W), y: random(H),
      vx: 0, vy: 0,
      size: random(2, 6)
    });
  }
}

function draw() {
  background(0, 20);

  var energy = volume * 10;
  for (var i = 0; i < particles.length; i++) {
    var pt = particles[i];
    var fi = floor(map(i, 0, particles.length, 0, fft.length));
    var amp = fft[fi] / 255;

    pt.vx += random(-energy, energy);
    pt.vy += random(-energy, energy);
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.x += pt.vx;
    pt.y += pt.vy;

    if (pt.x < 0) pt.x = width;
    if (pt.x > width) pt.x = 0;
    if (pt.y < 0) pt.y = height;
    if (pt.y > height) pt.y = 0;

    var c = lerpColor(
      color(30, 80, 255),
      color(255, 50, 100),
      amp
    );
    noStroke();
    fill(red(c), green(c), blue(c), 180);
    circle(pt.x, pt.y, pt.size + amp * 8);
  }
}
`,
};
