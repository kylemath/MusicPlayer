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
};
