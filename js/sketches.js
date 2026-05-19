/* Generative backgrounds — ported from phoenixperry.github.io/sandpit
   Three instance-mode p5 sketches:
     - waveSketch     → title / closing slides
     - terrainSketch  → "Antigravity Machine" terrain slide (#terrain-container)
     - whitneySketch  → ambient backgrounds for content slides (.whitney-bg)
*/

/* ============================================================
   WAVE — phoenixperry.com homepage wave, used on title slides
   ============================================================ */
const waveSketch = function (p) {
  let phase = 0;
  let zoff = 0;
  let waveStates = [];
  const maxWaveStates = 25;
  let colors = [];
  let waveActive = true;
  let needsResize = false;
  let currentContainer = null;

  function getContainer() {
    return currentContainer ||
      document.getElementById('p5-container') ||
      document.getElementById('p5-container-end');
  }

  p.setup = function () {
    const container = getContainer();
    const w = container ? container.offsetWidth : 1;
    const h = container ? container.offsetHeight : 1;
    const cnv = p.createCanvas(w, h);
    if (container) cnv.parent(container);
    currentContainer = container;
    colors = [
      p.color('#a8e622'), p.color('#ffcc00'), p.color('#ff9505'),
      p.color('#ff2d55'), p.color('#e91e63'), p.color('#af52de'),
      p.color('#33cabb'), p.color('#007aff'), p.color('#030303'),
      p.color('#f7f2dd')
    ];
  };

  /* re-parent the wave canvas between #p5-container and #p5-container-end */
  p.adoptContainer = function (container) {
    if (!container || container === currentContainer) {
      needsResize = true;
      return;
    }
    container.appendChild(p.canvas);
    currentContainer = container;
    needsResize = true;
  };

  p.setActive = function (active) {
    waveActive = active;
    if (active) needsResize = true;
  };

  p.draw = function () {
    if (!waveActive) return;

    if (needsResize) {
      const container = getContainer();
      if (container && container.offsetWidth > 0) {
        p.resizeCanvas(container.offsetWidth, container.offsetHeight);
        needsResize = false;
      }
    }

    p.background(0);
    const mouseWaveHeight = p.map(p.mouseY, 0, p.height, 5, 100);
    const currentState = [];

    for (let i = 0; i < colors.length - 1; i++) {
      const wavePoints = [];
      const yOffset = i * 80;
      for (let x = 0; x <= p.width; x += 10) {
        const distanceFromMouse = p.abs(p.mouseX - x);
        const defaultWaveHeight = distanceFromMouse < 20 ? mouseWaveHeight : 50;
        const waveHeight = defaultWaveHeight;
        const y = p.height / 2 +
          p.sin(x * 0.01 + phase * i) * waveHeight *
          p.noise(x * 0.01, yOffset * 0.1, zoff) + yOffset;
        wavePoints.push({ x: x, y: y, color: colors[i] });
      }
      currentState.push(wavePoints);
    }

    waveStates.unshift(currentState);
    if (waveStates.length > maxWaveStates) waveStates.pop();

    waveStates.forEach((state, index) => {
      state.forEach((wavePoints) => {
        const col = p.color(
          p.red(wavePoints[0].color),
          p.green(wavePoints[0].color),
          p.blue(wavePoints[0].color),
          255 - (index * 10)
        );
        p.stroke(col);
        p.noFill();
        p.beginShape();
        wavePoints.forEach(point => p.vertex(point.x, point.y));
        p.endShape();
      });
    });

    phase += 0.005;
    zoff += 0.005;
  };

  p.windowResized = function () {
    if (!waveActive) { needsResize = true; return; }
    const container = getContainer();
    if (container && container.offsetWidth > 0) {
      p.resizeCanvas(container.offsetWidth, container.offsetHeight);
    }
  };
};

window.waveP5 = new p5(waveSketch);

/* ============================================================
   TERRAIN — gravity wells + drifting worm, used on the
   Antigravity Machine slide (#terrain-container)
   ============================================================ */
const terrainSketch = function (p) {
  const ZOOM = 2.2;
  const Y_OFFSET = 0;
  const GRIDDENSITY = 0.9;
  const NOISE_SCALE = 0.2;
  const NOISE_DETAIL = 0.5;
  const HEIGHT_AMPLITUDE = 8;
  const FLOW_SPEED = 0.05;
  const DRIFT_SPEED = 0.02;
  const NUM_WELLS = 5;
  const WELL_SIZE_MIN = 0.08;
  const WELL_SIZE_MAX = 0.15;
  const WELL_DEPTH_MIN = 4;
  const WELL_DEPTH_MAX = 8;
  const WELL_SCROLL_SPEED = 0.05;
  const WORM_TERRAIN_INFLUENCE = 0.1;
  const WORM_RANDOMNESS = 0.25;
  const WORM_INERTIA = 0.95;
  const WORM_MAX_SPEED = 1.0;
  const WORM_WELL_AVOIDANCE = 0.3;

  let cols, rows, scl, terrain = [], flying = 0, xDrift = 0;
  let wells = [], worm, wormTrail = [], maxTrail;
  let isActive = false;
  let canvasReady = false;

  const palette = [
    '#030303', '#007aff', '#33cabb', '#a8e622', '#fc0',
    '#ff9505', '#e91e63', '#ff2d55', '#af52de', '#f7f2dd'
  ];

  function initScene() {
    scl = p.min(p.width, p.height) * 0.025 * GRIDDENSITY;
    cols = p.floor(p.width / scl);
    rows = p.floor(p.height / scl);
    terrain = [];
    for (let x = 0; x < cols; x++) terrain[x] = new Array(rows).fill(0);
    maxTrail = p.floor(cols * 0.6);
    wells = [];
    for (let i = 0; i < NUM_WELLS; i++) wells.push(makeWell());
    worm = { pos: p.createVector(cols / 2, rows * 0.6), vel: p5.Vector.random2D() };
    wormTrail = [];
  }

  function makeWell() {
    return {
      x: p.random(cols), y: p.random(rows),
      r: p.random(cols * WELL_SIZE_MIN, cols * WELL_SIZE_MAX),
      depth: p.random(scl * WELL_DEPTH_MIN, scl * WELL_DEPTH_MAX)
    };
  }

  p.setup = function () { p.noCanvas(); };

  function createTerrainCanvas() {
    const container = document.getElementById('terrain-container');
    if (!container || container.offsetWidth === 0) return false;
    const cnv = p.createCanvas(container.offsetWidth, container.offsetHeight, p.WEBGL);
    cnv.parent('terrain-container');
    p.ortho();
    initScene();
    canvasReady = true;
    return true;
  }

  p.draw = function () {
    if (!isActive || !canvasReady) return;
    p.background(10);
    updateFlow();
    generateTerrain();
    updateWorm();
    p.rotateX(p.atan(p.sqrt(1 / 2)));
    p.rotateZ(p.PI / 4);
    p.scale(ZOOM);
    p.translate(-cols * scl / 2, -rows * scl / 2 + rows * scl * Y_OFFSET);
    drawTerrain();
    drawWorm();
  };

  function updateFlow() {
    flying -= FLOW_SPEED;
    xDrift += DRIFT_SPEED;
    for (const w of wells) {
      w.y += WELL_SCROLL_SPEED;
      if (w.y > rows + w.r) { w.y = -w.r; w.x = p.random(cols); }
    }
  }

  function generateTerrain() {
    for (let y = 0; y < rows; y++) {
      const yoff = (y + flying) * NOISE_SCALE;
      for (let x = 0; x < cols; x++) {
        const xoff = (x + xDrift) * NOISE_SCALE;
        const n = p.noise(xoff * NOISE_DETAIL, yoff * NOISE_DETAIL);
        let h = p.map(n, 0, 1, -scl * HEIGHT_AMPLITUDE, scl * HEIGHT_AMPLITUDE);
        for (const w of wells) {
          const d = p.dist(x, y, w.x, w.y);
          if (d < w.r) {
            const t = d / w.r;
            const falloff = p.pow(p.cos(t * p.PI) * 0.5 + 0.5, 1.5);
            h -= falloff * w.depth;
          }
        }
        terrain[x][y] = h;
      }
    }
  }

  function getColor(h) {
    let t = p.map(h, -scl * HEIGHT_AMPLITUDE, scl * HEIGHT_AMPLITUDE, 0, 1);
    t = p.constrain(t, 0, 1);
    const scaled = t * (palette.length - 1);
    const i = p.floor(scaled);
    const frac = scaled - i;
    const c1 = p.color(palette[i]);
    const c2 = p.color(palette[p.min(i + 1, palette.length - 1)]);
    const c = p.lerpColor(c1, c2, frac);
    return p.color(p.red(c), p.green(c), p.blue(c), 220);
  }

  function drawTerrain() {
    p.noStroke();
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols - 1; x++) {
        const h1 = terrain[x][y], h2 = terrain[x + 1][y];
        const h3 = terrain[x][y + 1], h4 = terrain[x + 1][y + 1];
        const avg = (h1 + h2 + h3 + h4) * 0.25;
        p.fill(getColor(avg));
        p.beginShape(p.TRIANGLES);
        p.vertex(x * scl, y * scl, h1);
        p.vertex((x + 1) * scl, y * scl, h2);
        p.vertex(x * scl, (y + 1) * scl, h3);
        p.vertex((x + 1) * scl, y * scl, h2);
        p.vertex((x + 1) * scl, (y + 1) * scl, h4);
        p.vertex(x * scl, (y + 1) * scl, h3);
        p.endShape();
      }
    }
  }

  function updateWorm() {
    const force = p.createVector(0, 0);
    const x = p.floor(worm.pos.x);
    const y = p.floor(worm.pos.y);
    if (x > 1 && x < cols - 2 && y > 1 && y < rows - 2) {
      const h = terrain[x][y], hx = terrain[x + 1][y], hy = terrain[x][y + 1];
      const grad = p.createVector(hx - h, hy - h);
      grad.mult(WORM_TERRAIN_INFLUENCE);
      force.add(grad);
    }
    for (const w of wells) {
      const d = p.dist(worm.pos.x, worm.pos.y, w.x, w.y);
      if (d < w.r) {
        const dir = p5.Vector.sub(worm.pos, p.createVector(w.x, w.y));
        dir.normalize();
        dir.mult(WORM_WELL_AVOIDANCE);
        force.add(dir);
      }
    }
    worm.vel.mult(WORM_INERTIA);
    force.add(p5.Vector.random2D().mult(WORM_RANDOMNESS));
    worm.vel.add(force);
    worm.vel.limit(WORM_MAX_SPEED);
    worm.pos.add(worm.vel);
    worm.pos.x = p.constrain(worm.pos.x, 1, cols - 2);
    worm.pos.y = p.constrain(worm.pos.y, 1, rows - 2);
    wormTrail.push(worm.pos.copy());
    if (wormTrail.length > maxTrail) wormTrail.shift();
  }

  function drawWorm() {
    p.stroke(255, 80, 80);
    p.strokeWeight(scl * 0.25);
    p.noFill();
    p.beginShape();
    for (const pt of wormTrail) {
      const x = p.floor(pt.x), y = p.floor(pt.y);
      const z = terrain[x][y] + scl * 0.6;
      p.vertex(x * scl, y * scl, z);
    }
    p.endShape();
  }

  p.windowResized = function () {
    if (!canvasReady) return;
    const container = document.getElementById('terrain-container');
    if (container && container.offsetWidth > 0) {
      p.resizeCanvas(container.offsetWidth, container.offsetHeight);
      initScene();
    }
  };

  p.setActive = function (a) {
    isActive = a;
    if (a) {
      if (!canvasReady) {
        createTerrainCanvas();
      } else {
        const container = document.getElementById('terrain-container');
        if (container && container.offsetWidth > 0) {
          p.resizeCanvas(container.offsetWidth, container.offsetHeight);
          initScene();
        }
      }
    }
  };
};

window.terrainP5 = new p5(terrainSketch);

/* ============================================================
   WHITNEY — harmonic ambient backgrounds
   Patterns: permutations, converge, matrix, lissajous, arabesque,
             orbits, branches, constellation, weather, gravity-bodies,
             topo-wells, agent-network
   ============================================================ */
const whitneySketch = function (p) {
  let w, h;
  let t = 0;
  let isActive = false;
  let currentConfig = null;
  let canvasEl = null;

  p.setup = function () {
    const cnv = p.createCanvas(1, 1);
    canvasEl = cnv.elt;
    canvasEl.style.display = 'none';
    p.pixelDensity(1);
  };

  p.draw = function () {
    if (!isActive || !currentConfig) return;
    p.background(3);
    const type = currentConfig.type;
    const col = currentConfig.color;
    if (type === 'permutations') drawPermutations(col);
    else if (type === 'converge') drawConverge(col);
    else if (type === 'matrix') drawMatrix(col);
    else if (type === 'lissajous') drawLissajous(col);
    else if (type === 'arabesque') drawArabesque(col);
    else if (type === 'orbits') drawOrbits(col);
    else if (type === 'branches') drawBranches(col);
    else if (type === 'constellation') drawConstellation(col);
    else if (type === 'weather') drawWeather(col);
    else if (type === 'gravity-bodies') drawGravityBodies(col);
    else if (type === 'topo-wells') drawTopoWells(col);
    else if (type === 'agent-network') drawAgentNetwork(col);
    t += 1;
  };

  /* ----- PERMUTATIONS ----- */
  function drawPermutations(col) {
    const cx = w * 0.5, cy = h * 0.5;
    const radius = Math.min(w, h) * 0.38;
    const n = 60;
    const speed = 0.00015;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const angle = t * speed * (i + 1);
      pts.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
    const c = p.color(col);
    for (let i = 0; i < n; i++) {
      const j = (i + 7) % n;
      const k = (i + 13) % n;
      const alpha = 130 + 60 * Math.sin(t * 0.001 + i * 0.3);
      c.setAlpha(alpha);
      p.stroke(c);
      p.strokeWeight(1.3);
      p.line(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
      c.setAlpha(alpha * 0.5);
      p.strokeWeight(0.8);
      p.line(pts[i].x, pts[i].y, pts[k].x, pts[k].y);
    }
    p.noStroke();
    for (let i = 0; i < n; i++) {
      const alpha = 200 + 55 * Math.sin(t * 0.002 + i * 0.5);
      c.setAlpha(alpha);
      p.fill(c);
      const sz = 4 + 2 * Math.sin(t * 0.001 + i);
      p.ellipse(pts[i].x, pts[i].y, sz, sz);
    }
  }

  /* ----- CONVERGE ----- */
  function drawConverge(col) {
    const cx = w * 0.5, cy = h * 0.5;
    const maxR = Math.min(w, h) * 0.42;
    const n = 48, rings = 4, speed = 0.00012;
    const c = p.color(col);
    for (let ring = 0; ring < rings; ring++) {
      const radius = maxR * (0.25 + ring * 0.22);
      const ringOffset = ring * 0.618;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const angle = t * speed * (i + 1 + ring * 3) + ringOffset;
        const wobble = Math.sin(t * 0.001 + i * 0.4 + ring) * radius * 0.08;
        const r = radius + wobble;
        pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
      }
      if (ring > 0) {
        const prevRadius = maxR * (0.25 + (ring - 1) * 0.22);
        const prevOffset = (ring - 1) * 0.618;
        for (let i = 0; i < n; i += 2) {
          const prevAngle = t * speed * (i + 1 + (ring - 1) * 3) + prevOffset;
          const px = cx + prevRadius * Math.cos(prevAngle);
          const py = cy + prevRadius * Math.sin(prevAngle);
          c.setAlpha(70);
          p.stroke(c);
          p.strokeWeight(0.8);
          p.line(pts[i].x, pts[i].y, px, py);
        }
      }
      p.noStroke();
      for (let i = 0; i < n; i++) {
        const alpha = 120 + 80 * Math.sin(t * 0.002 + i * 0.6);
        c.setAlpha(alpha);
        p.fill(c);
        p.ellipse(pts[i].x, pts[i].y, 4, 4);
      }
    }
  }

  /* ----- MATRIX ----- */
  function drawMatrix(col) {
    const cols = 24, rows = 16;
    const spacingX = w / (cols + 1);
    const spacingY = h / (rows + 1);
    const speed = 0.0005;
    const c = p.color(col);
    p.noStroke();
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const baseX = (gx + 1) * spacingX;
        const baseY = (gy + 1) * spacingY;
        const dx = Math.sin(t * speed * (gx + 1) + gy * 0.3) * spacingX * 0.4;
        const dy = Math.cos(t * speed * (gy + 1) + gx * 0.2) * spacingY * 0.4;
        const x = baseX + dx;
        const y = baseY + dy;
        const alpha = 110 + 80 * Math.sin(t * 0.002 + gx * 0.4 + gy * 0.3);
        c.setAlpha(alpha);
        p.fill(c);
        const sz = 3.5 + Math.sin(t * 0.001 + gx + gy) * 1.5;
        p.ellipse(x, y, sz, sz);
        if (gx < cols - 1) {
          const nx = (gx + 2) * spacingX +
            Math.sin(t * speed * (gx + 2) + gy * 0.3) * spacingX * 0.4;
          const ny = baseY +
            Math.cos(t * speed * (gy + 1) + (gx + 1) * 0.2) * spacingY * 0.4;
          c.setAlpha(50);
          p.stroke(c);
          p.strokeWeight(0.6);
          p.line(x, y, nx, ny);
          p.noStroke();
        }
      }
    }
  }

  /* ----- LISSAJOUS ----- */
  function drawLissajous(col) {
    const cx = w * 0.5, cy = h * 0.5;
    const c = p.color(col);
    const curves = 6;
    for (let curve = 0; curve < curves; curve++) {
      const freqA = 1.5 + curve * 0.8 + Math.sin(t * 0.00008 + curve * 1.9) * 0.7;
      const freqB = 2.3 + curve * 0.6 + Math.cos(t * 0.00011 + curve * 2.3) * 0.6;
      const phaseShift = t * 0.00018 + curve * 0.9;
      const ampDrift = Math.sin(t * 0.00006 + curve * 3.1);
      const rxBase = w * (0.38 + curve * 0.04 + ampDrift * 0.12);
      const ryBase = h * (0.36 + curve * 0.035 - ampDrift * 0.08);
      p.noFill();
      const alpha = 90 + curve * 18;
      c.setAlpha(alpha);
      p.stroke(c);
      p.strokeWeight(0.6 + (curves - curve) * 0.22);
      p.beginShape();
      const steps = 1000;
      for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        const angle = frac * Math.PI * 2 * 5;
        const swell = 1 + 0.15 * Math.sin(angle * 1.3 + t * 0.0002 + curve);
        const rx = rxBase * swell;
        const ry = ryBase * (2 - swell);
        const x = cx + rx * Math.sin(freqA * angle + phaseShift);
        const y = cy + ry * Math.sin(freqB * angle);
        p.vertex(x, y);
      }
      p.endShape();
    }
    p.noStroke();
    for (let i = 0; i < 30; i++) {
      const cIdx = i % curves;
      const freqA = 1.5 + cIdx * 0.8 + Math.sin(t * 0.00008 + cIdx * 1.9) * 0.7;
      const freqB = 2.3 + cIdx * 0.6 + Math.cos(t * 0.00011 + cIdx * 2.3) * 0.6;
      const ps = t * 0.00018 + cIdx * 0.9;
      const ad = Math.sin(t * 0.00006 + cIdx * 3.1);
      const rxB = w * (0.38 + cIdx * 0.04 + ad * 0.12);
      const ryB = h * (0.36 + cIdx * 0.035 - ad * 0.08);
      const angle = (i / 30) * Math.PI * 2 * 5 + t * 0.0004;
      const swell = 1 + 0.15 * Math.sin(angle * 1.3 + t * 0.0002 + cIdx);
      const x = cx + rxB * swell * Math.sin(freqA * angle + ps);
      const y = cy + ryB * (2 - swell) * Math.sin(freqB * angle);
      const pulse = 3 + Math.sin(t * 0.002 + i * 0.8) * 2;
      c.setAlpha(160 + Math.sin(t * 0.001 + i) * 60);
      p.fill(c);
      p.ellipse(x, y, pulse, pulse);
    }
  }

  /* ----- ARABESQUE ----- */
  function drawArabesque(col) {
    const cx = w * 0.5, cy = h * 0.5;
    const r1 = Math.min(w, h) * 0.2;
    const r2 = Math.min(w, h) * 0.38;
    const n = 36;
    const speed1 = 0.0005, speed2 = 0.0003;
    const c = p.color(col);
    const inner = [], outer = [];
    for (let i = 0; i < n; i++) {
      const a1 = t * speed1 * (i + 1);
      inner.push({ x: cx + r1 * Math.cos(a1), y: cy + r1 * Math.sin(a1) });
      const a2 = t * speed2 * (i + 1) + Math.PI * 0.5;
      outer.push({ x: cx + r2 * Math.cos(a2), y: cy + r2 * Math.sin(a2) });
    }
    for (let i = 0; i < n; i++) {
      const j = (i + Math.floor(n * 0.382)) % n;
      const alpha = 80 + 40 * Math.sin(t * 0.002 + i * 0.4);
      c.setAlpha(alpha);
      p.stroke(c);
      p.strokeWeight(1.0);
      p.line(inner[i].x, inner[i].y, outer[j].x, outer[j].y);
    }
    p.noStroke();
    for (let i = 0; i < n; i++) {
      const alpha = 160 + 60 * Math.sin(t * 0.003 + i);
      c.setAlpha(alpha);
      p.fill(c);
      p.ellipse(inner[i].x, inner[i].y, 4.5, 4.5);
      c.setAlpha(alpha * 0.75);
      p.fill(c);
      p.ellipse(outer[i].x, outer[i].y, 3.5, 3.5);
    }
  }

  /* ----- ORBITS ----- */
  function drawOrbits(col) {
    const cx = w * 0.5, cy = h * 0.5;
    const maxR = Math.max(w, h) * 0.52;
    const orbits = 10, dotsPerOrbit = 32;
    const speed = 0.0004;
    const c = p.color(col);
    for (let o = 0; o < orbits; o++) {
      const radius = maxR * (0.08 + o * 0.092);
      const orbitSpeed = speed / (o * 0.35 + 1);
      const tilt = o * 0.3 + Math.sin(t * 0.00015 + o) * 0.2;
      const eccX = 1 + 0.15 * Math.sin(t * 0.0004 + o * 1.2);
      const eccY = 1 - 0.15 * Math.sin(t * 0.0004 + o * 1.2);
      c.setAlpha(25 + o * 3);
      p.stroke(c);
      p.strokeWeight(0.5);
      p.noFill();
      p.push();
      p.translate(cx, cy);
      p.rotate(tilt);
      p.ellipse(0, 0, radius * 2 * eccX, radius * 2 * eccY);
      p.pop();
      p.noStroke();
      for (let i = 0; i < dotsPerOrbit; i++) {
        const angle = t * orbitSpeed * (i + 1) + o * 1.5;
        const rx = radius * eccX, ry = radius * eccY;
        const lx = rx * Math.cos(angle), ly = ry * Math.sin(angle);
        const x = cx + lx * Math.cos(tilt) - ly * Math.sin(tilt);
        const y = cy + lx * Math.sin(tilt) + ly * Math.cos(tilt);
        const alpha = 130 + 90 * Math.sin(t * 0.002 + i * 0.5 + o);
        c.setAlpha(alpha);
        p.fill(c);
        const sz = 3.5 + Math.sin(t * 0.001 + i + o) * 1.8;
        p.ellipse(x, y, sz, sz);
        if (i % 3 === 0) {
          c.setAlpha(25 + o * 3);
          p.stroke(c);
          p.strokeWeight(0.3);
          p.line(x, y, cx, cy);
          p.noStroke();
        }
      }
    }
    const corePulse = 1 + Math.sin(t * 0.002) * 0.3;
    c.setAlpha(50);
    p.noStroke();
    p.fill(c);
    p.ellipse(cx, cy, 20 * corePulse, 20 * corePulse);
    c.setAlpha(200);
    p.fill(c);
    p.ellipse(cx, cy, 6 * corePulse, 6 * corePulse);
  }

  /* ----- BRANCHES ----- */
  function drawBranches(col) {
    const c = p.color(col);
    const trunks = 9;
    const spacing = w / (trunks + 1);
    for (let tr = 0; tr < trunks; tr++) {
      const x = spacing * (tr + 1) + Math.sin(t * 0.0006 + tr * 1.8) * spacing * 0.2;
      const y = h + 10;
      const angle = -Math.PI / 2 + Math.sin(t * 0.0004 + tr * 2.1) * 0.15;
      const len = h * 0.32 + Math.sin(tr * 1.3) * h * 0.05;
      drawBranch(c, x, y, angle, len, 0, 7, tr);
    }
  }
  function drawBranch(c, x, y, angle, len, depth, maxDepth, seed) {
    if (depth >= maxDepth || len < 2) return;
    let sway = Math.sin(t * 0.0003 * (depth + 1) + seed * 1.7 + depth * 0.9) * 0.15 * (depth + 1);
    sway += Math.sin(t * 0.00012 + seed * 3.1 + depth * 1.4) * 0.06 * depth;
    const a = angle + sway;
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    const lineAlpha = 180 - depth * 16;
    const weight = 2.2 - depth * 0.25;
    c.setAlpha(Math.max(lineAlpha, 40));
    p.stroke(c);
    p.strokeWeight(Math.max(weight, 0.4));
    p.line(x, y, x2, y2);
    p.noStroke();
    const dotAlpha = 220 - depth * 18;
    c.setAlpha(Math.max(dotAlpha, 60));
    p.fill(c);
    const pulse = Math.sin(t * 0.002 + seed * 2 + depth * 0.7) * 0.5;
    const dotSz = 5 - depth * 0.5 + pulse;
    p.ellipse(x2, y2, Math.max(dotSz, 1.5), Math.max(dotSz, 1.5));
    const shrink = 0.66 + Math.sin(t * 0.0002 + seed + depth) * 0.05;
    const spread = 0.4 + depth * 0.06;
    drawBranch(c, x2, y2, a - spread, len * shrink, depth + 1, maxDepth, seed + 0.3);
    drawBranch(c, x2, y2, a + spread, len * shrink, depth + 1, maxDepth, seed + 0.7);
    if (depth > 0 && depth < 5 && ((seed * 7 + depth) % 3 < 1)) {
      const midSpread = Math.sin(t * 0.00025 + seed * 3 + depth) * 0.35;
      drawBranch(c, x2, y2, a + midSpread, len * shrink * 0.7, depth + 2, maxDepth, seed + 1.1);
    }
  }

  /* ----- GRAVITY-BODIES ----- */
  let gBodies = [], gTrailPts = [];
  const G_BODY_COUNT = 28, G_TRAIL_MAX = 6000, G_CONSTANT = 120;
  function initGravityBodies() {
    gBodies = []; gTrailPts = [];
    for (let i = 0; i < G_BODY_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.0;
      const isBig = Math.random() < 0.2;
      const mass = isBig ? (6 + Math.random() * 6) : (1 + Math.random() * 3);
      gBodies.push({
        x: w * 0.08 + Math.random() * w * 0.84,
        y: h * 0.08 + Math.random() * h * 0.84,
        vx: Math.cos(angle) * speed * (isBig ? 0.4 : 1),
        vy: Math.sin(angle) * speed * (isBig ? 0.4 : 1),
        mass, id: i
      });
    }
  }
  function drawGravityBodies(col) {
    if (gBodies.length === 0) initGravityBodies();
    const c = p.color(col);
    for (let i = 0; i < gBodies.length; i++) {
      let ax = 0, ay = 0;
      const bi = gBodies[i];
      for (let j = 0; j < gBodies.length; j++) {
        if (i === j) continue;
        const bj = gBodies[j];
        const dx = bj.x - bi.x, dy = bj.y - bi.y;
        let distSq = dx * dx + dy * dy;
        const minDist = (bi.mass + bj.mass) * 8;
        distSq = Math.max(distSq, minDist * minDist);
        const dist = Math.sqrt(distSq);
        const force = G_CONSTANT * bj.mass / distSq;
        ax += (dx / dist) * force;
        ay += (dy / dist) * force;
      }
      bi.vx += ax * 0.016; bi.vy += ay * 0.016;
      bi.vx *= 0.999; bi.vy *= 0.999;
      const spd = Math.sqrt(bi.vx * bi.vx + bi.vy * bi.vy);
      if (spd > 3.5) { bi.vx = (bi.vx / spd) * 3.5; bi.vy = (bi.vy / spd) * 3.5; }
    }
    for (let i = 0; i < gBodies.length; i++) {
      const bi = gBodies[i];
      bi.x += bi.vx; bi.y += bi.vy;
      const margin = 60;
      if (bi.x < margin) bi.vx += 0.05;
      if (bi.x > w - margin) bi.vx -= 0.05;
      if (bi.y < margin) bi.vy += 0.05;
      if (bi.y > h - margin) bi.vy -= 0.05;
      gTrailPts.push({ x: bi.x, y: bi.y, id: bi.id, mass: bi.mass, birth: t });
    }
    while (gTrailPts.length > G_TRAIL_MAX) gTrailPts.shift();
    for (let id = 0; id < G_BODY_COUNT; id++) {
      p.noFill();
      p.beginShape();
      for (let k = 0; k < gTrailPts.length; k++) {
        const pt = gTrailPts[k];
        if (pt.id !== id) continue;
        const age = t - pt.birth;
        const fade = Math.max(0, 1 - age / 600);
        if (fade <= 0) continue;
        c.setAlpha(fade * 160);
        p.stroke(c);
        p.strokeWeight(0.6 + pt.mass * 0.25);
        p.curveVertex(pt.x, pt.y);
      }
      p.endShape();
    }
    for (let i = 0; i < gBodies.length; i++) {
      for (let j = i + 1; j < gBodies.length; j++) {
        const bi = gBodies[i], bj = gBodies[j];
        const dx = bj.x - bi.x, dy = bj.y - bi.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 300;
        if (dist < maxDist) {
          const strength = 1 - dist / maxDist;
          c.setAlpha(strength * strength * 120);
          p.stroke(c);
          p.strokeWeight(0.4 + strength);
          p.line(bi.x, bi.y, bj.x, bj.y);
        }
      }
    }
    for (let i = 0; i < gBodies.length; i++) {
      const bi = gBodies[i];
      const pulse = 1 + Math.sin(t * 0.003 + bi.id * 1.5) * 0.2;
      c.setAlpha(50); p.noStroke(); p.fill(c);
      p.ellipse(bi.x, bi.y, (bi.mass * 5 + 14) * pulse, (bi.mass * 5 + 14) * pulse);
      c.setAlpha(230); p.fill(c);
      p.ellipse(bi.x, bi.y, (bi.mass * 2.2 + 4) * pulse, (bi.mass * 2.2 + 4) * pulse);
    }
  }

  /* ----- TOPO-WELLS ----- */
  const TW_GRID_SIZE = 36, TW_EXTENT = 1.25, TW_WELL_COUNT = 4;
  const TW_TILT = 1.05, TW_MAX_DEPTH = 1.1;
  let twWells = [], twInitted = false;
  function initTopoWells() {
    twWells = [];
    for (let i = 0; i < TW_WELL_COUNT; i++) {
      twWells.push({
        x: (Math.random() - 0.5) * 1.6,
        z: (Math.random() - 0.5) * 1.6,
        vx: (Math.random() - 0.5) * 0.0012,
        vz: (Math.random() - 0.5) * 0.0012,
        mass: 0.22 + Math.random() * 0.22,
        radius: 0.14 + Math.random() * 0.12
      });
    }
    twInitted = true;
  }
  function drawTopoWells(col) {
    if (!twInitted) initTopoWells();
    const c = p.color(col);
    for (const wl of twWells) {
      wl.x += wl.vx; wl.z += wl.vz;
      if (wl.x < -1.0 || wl.x > 1.0) wl.vx *= -1;
      if (wl.z < -1.0 || wl.z > 1.0) wl.vz *= -1;
    }
    const gs = TW_GRID_SIZE;
    const step = (TW_EXTENT * 2) / gs;
    const tiltSin = Math.sin(TW_TILT), tiltCos = Math.cos(TW_TILT);
    const ypMax = TW_MAX_DEPTH * tiltCos + TW_EXTENT * tiltSin;
    const ypMin = -TW_EXTENT * tiltSin;
    const vSpan = ypMax - ypMin;
    const scale = Math.max(w / (2 * TW_EXTENT), h / vSpan);
    const cx = w * 0.5;
    const cy = h * 0.5 - ((ypMax + ypMin) * 0.5) * scale;
    const screen = new Array(gs + 1);
    for (let i = 0; i <= gs; i++) {
      screen[i] = new Array(gs + 1);
      const x = -TW_EXTENT + i * step;
      for (let j = 0; j <= gs; j++) {
        const z = -TW_EXTENT + j * step;
        let y = 0;
        for (const wl of twWells) {
          const dx = x - wl.x, dz = z - wl.z;
          const r = Math.sqrt(dx * dx + dz * dz);
          const softening = wl.radius * 0.35;
          y -= wl.mass * wl.radius / (r + softening);
        }
        y = -TW_MAX_DEPTH * Math.tanh(-y / TW_MAX_DEPTH);
        const yp = -y * tiltCos - z * tiltSin;
        screen[i][j] = { sx: cx + x * scale, sy: cy + yp * scale, depth: y };
      }
    }
    p.noStroke();
    for (let i = 0; i <= gs; i++) {
      for (let j = 0; j <= gs; j++) {
        const v0 = screen[i][j];
        const a = p.map(v0.depth, -TW_MAX_DEPTH, 0, 77, 230, true);
        const dSize = p.map(v0.depth, -TW_MAX_DEPTH, 0, 3.2, 1.4, true);
        c.setAlpha(a);
        p.fill(c);
        p.ellipse(v0.sx, v0.sy, dSize, dSize);
      }
    }
  }

  /* ----- WEATHER ----- */
  let weatherParticles = [];
  const WEATHER_COUNT = 400;
  const NOISE_SCALE_W = 0.0025, NOISE_Z_SPEED = 0.00012;
  let noiseZ = 0;
  function initWeather() {
    weatherParticles = [];
    for (let i = 0; i < WEATHER_COUNT; i++) {
      weatherParticles.push({
        x: Math.random() * w, y: Math.random() * h,
        px: 0, py: 0,
        age: Math.floor(Math.random() * 300),
        maxAge: 350 + Math.floor(Math.random() * 400),
        speed: 0.2 + Math.random() * 0.4
      });
    }
  }
  function flowNoise(x, y, z) {
    let v = 0;
    v += Math.sin(x * 0.008 + z * 0.7) * Math.cos(y * 0.015 + z * 0.5);
    v += Math.sin(x * 0.004 - y * 0.018 + z * 1.2) * 0.6;
    v += Math.cos(x * 0.013 + y * 0.006 - z * 0.4) * 0.35;
    v += Math.sin(x * 0.002 + y * 0.009 + z * 1.6) * 0.5;
    v += Math.cos(x * 0.022 - y * 0.003 + z * 0.9) * 0.2;
    return v;
  }
  function drawWeather(col) {
    if (weatherParticles.length === 0) initWeather();
    const c = p.color(col);
    noiseZ += NOISE_Z_SPEED;
    for (let i = 0; i < weatherParticles.length; i++) {
      const pt = weatherParticles[i];
      pt.px = pt.x; pt.py = pt.y;
      let angle = flowNoise(pt.x * NOISE_SCALE_W, pt.y * NOISE_SCALE_W, noiseZ) * Math.PI * 2;
      angle += Math.sin(pt.y * 0.0006 + noiseZ * 0.3) * 0.3;
      pt.x += Math.cos(angle) * pt.speed;
      pt.y += Math.sin(angle) * pt.speed;
      pt.age++;
      const lifeFrac = pt.age / pt.maxAge;
      let fade = lifeFrac < 0.15 ? lifeFrac / 0.15 :
                 lifeFrac > 0.75 ? (1 - lifeFrac) / 0.25 : 1.0;
      fade = Math.max(fade, 0);
      const alpha = fade * 180;
      c.setAlpha(alpha);
      p.stroke(c);
      const weight = 1.0 + fade * 1.4 + Math.sin(pt.age * 0.03 + i) * 0.5;
      p.strokeWeight(Math.max(weight, 0.6));
      const dx = pt.x - pt.px, dy = pt.y - pt.py;
      if (dx * dx + dy * dy < 80) p.line(pt.px, pt.py, pt.x, pt.y);
      p.noStroke();
      c.setAlpha(alpha * 1.4);
      p.fill(c);
      p.ellipse(pt.x, pt.y, 2.5 + fade * 2.0, 2.5 + fade * 2.0);
      if (pt.age > pt.maxAge || pt.x < -20 || pt.x > w + 20 ||
          pt.y < -20 || pt.y > h + 20) {
        pt.x = Math.random() * w; pt.y = Math.random() * h;
        pt.px = pt.x; pt.py = pt.y;
        pt.age = 0;
        pt.maxAge = 350 + Math.floor(Math.random() * 400);
        pt.speed = 0.2 + Math.random() * 0.4;
      }
    }
  }

  /* ----- CONSTELLATION ----- */
  let cParticles = [], cTrails = [];
  const NUM_PARTICLES = 60, TRAIL_MAX = 1200, CONNECT_DIST = 0.55;
  function initConstellationParticles() {
    cParticles = []; cTrails = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      cParticles.push({
        lat: (Math.random() - 0.5) * Math.PI * 0.9,
        lon: Math.random() * Math.PI * 2,
        latSpd: (Math.random() - 0.5) * 0.00008,
        lonSpd: 0.00015 + Math.random() * 0.00025,
        phase: Math.random() * Math.PI * 2
      });
    }
  }
  function sphereToScreen(lat, lon, radius, cx, cy, rotY) {
    const x3 = radius * Math.cos(lat) * Math.sin(lon + rotY);
    const y3 = radius * Math.sin(lat);
    const z3 = radius * Math.cos(lat) * Math.cos(lon + rotY);
    const perspective = 1.0 + z3 / (radius * 3);
    return {
      x: cx + x3 * perspective,
      y: cy - y3 * perspective,
      z: z3, depth: perspective
    };
  }
  function drawConstellation(col) {
    if (cParticles.length === 0) initConstellationParticles();
    const c = p.color(col);
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * 0.44;
    const rotY = t * 0.00012;
    const screenPos = [];
    for (let i = 0; i < cParticles.length; i++) {
      const pt = cParticles[i];
      pt.lat += pt.latSpd + Math.sin(t * 0.00005 + pt.phase) * 0.00003;
      pt.lon += pt.lonSpd;
      if (pt.lat > Math.PI * 0.44) pt.latSpd = -Math.abs(pt.latSpd);
      if (pt.lat < -Math.PI * 0.44) pt.latSpd = Math.abs(pt.latSpd);
      const sp = sphereToScreen(pt.lat, pt.lon, radius, cx, cy, rotY);
      screenPos.push(sp);
      cTrails.push({ x: sp.x, y: sp.y, z: sp.z, birth: t, depth: sp.depth });
    }
    while (cTrails.length > TRAIL_MAX) cTrails.shift();
    for (let i = 0; i < cTrails.length; i++) {
      const tr = cTrails[i];
      const age = t - tr.birth;
      const fade = Math.max(0, 1 - age / 400);
      if (fade <= 0) continue;
      const alpha = fade * 160 * tr.depth;
      c.setAlpha(Math.min(alpha, 200));
      p.noStroke(); p.fill(c);
      p.ellipse(tr.x, tr.y, 2.5 * tr.depth * fade, 2.5 * tr.depth * fade);
    }
    for (let i = 0; i < screenPos.length; i++) {
      for (let j = i + 1; j < screenPos.length; j++) {
        const pi = cParticles[i], pj = cParticles[j];
        const dLat = pi.lat - pj.lat, dLon = pi.lon - pj.lon;
        const angDist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (angDist < CONNECT_DIST) {
          const strength = 1 - angDist / CONNECT_DIST;
          const avgDepth = (screenPos[i].depth + screenPos[j].depth) / 2;
          c.setAlpha(strength * 150 * avgDepth);
          p.stroke(c);
          p.strokeWeight(1.0 * avgDepth);
          p.line(screenPos[i].x, screenPos[i].y, screenPos[j].x, screenPos[j].y);
        }
      }
    }
    for (let i = 0; i < screenPos.length; i++) {
      const sp = screenPos[i];
      const pulse = 1 + Math.sin(t * 0.001 + cParticles[i].phase) * 0.3;
      c.setAlpha(240 * sp.depth);
      p.noStroke(); p.fill(c);
      p.ellipse(sp.x, sp.y, (5.5 + pulse) * sp.depth, (5.5 + pulse) * sp.depth);
    }
    c.setAlpha(45); p.noFill(); p.stroke(c); p.strokeWeight(0.8);
    p.beginShape();
    for (let a = 0; a <= Math.PI * 2; a += 0.05) {
      const sp = sphereToScreen(0, a, radius, cx, cy, rotY);
      p.vertex(sp.x, sp.y);
    }
    p.endShape();
    p.beginShape();
    for (let a = -Math.PI / 2; a <= Math.PI / 2; a += 0.05) {
      const sp = sphereToScreen(a, 0, radius, cx, cy, rotY);
      p.vertex(sp.x, sp.y);
    }
    p.endShape();
  }

  /* ----- AGENT-NETWORK ----- */
  const AN_COUNT = 68, AN_CONNECT_DIST = 190;
  const AN_SPEED_MIN = 0.06, AN_SPEED_MAX = 0.18;
  let anAgents = [], anInitted = false;
  function initAgentNetwork() {
    anAgents = [];
    for (let i = 0; i < AN_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = AN_SPEED_MIN + Math.random() * (AN_SPEED_MAX - AN_SPEED_MIN);
      anAgents.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        noiseSeed: Math.random() * 1000
      });
    }
    anInitted = true;
  }
  function drawAgentNetwork(col) {
    if (!anInitted || anAgents.length === 0) initAgentNetwork();
    const c = p.color(col);
    for (let i = 0; i < anAgents.length; i++) {
      const a = anAgents[i];
      const hdNoise = p.noise(a.noiseSeed, t * 0.0006);
      const hdDelta = (hdNoise - 0.5) * 0.02;
      const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      const angle = Math.atan2(a.vy, a.vx) + hdDelta;
      a.vx = Math.cos(angle) * speed;
      a.vy = Math.sin(angle) * speed;
      a.x += a.vx; a.y += a.vy;
      if (a.x < -15) a.x = w + 15;
      if (a.x > w + 15) a.x = -15;
      if (a.y < -15) a.y = h + 15;
      if (a.y > h + 15) a.y = -15;
    }
    p.noFill();
    p.strokeWeight(0.6);
    const distSqMax = AN_CONNECT_DIST * AN_CONNECT_DIST;
    for (let i = 0; i < anAgents.length; i++) {
      const ai = anAgents[i];
      for (let j = i + 1; j < anAgents.length; j++) {
        const aj = anAgents[j];
        const dx = ai.x - aj.x, dy = ai.y - aj.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < distSqMax) {
          const strength = 1 - Math.sqrt(d2) / AN_CONNECT_DIST;
          c.setAlpha(Math.pow(strength, 1.4) * 205);
          p.stroke(c);
          p.line(ai.x, ai.y, aj.x, aj.y);
        }
      }
    }
    p.noStroke();
    c.setAlpha(225);
    p.fill(c);
    for (let i = 0; i < anAgents.length; i++) {
      p.ellipse(anAgents[i].x, anAgents[i].y, 2.5, 2.5);
    }
  }

  /* ----- ACTIVATION ----- */
  p.activate = function (container, config) {
    if (!container) {
      isActive = false;
      if (canvasEl) canvasEl.style.display = 'none';
      return;
    }
    container.innerHTML = '';
    container.appendChild(canvasEl);
    canvasEl.style.display = 'block';
    w = container.offsetWidth;
    h = container.offsetHeight;
    p.resizeCanvas(w, h);
    currentConfig = config;
    isActive = true;
    if (config.type === 'constellation') { cParticles = []; cTrails = []; }
    if (config.type === 'weather') { weatherParticles = []; noiseZ = 0; }
    if (config.type === 'gravity-bodies') { gBodies = []; gTrailPts = []; }
    if (config.type === 'topo-wells') { twInitted = false; }
    if (config.type === 'agent-network') { anInitted = false; }
  };

  p.deactivate = function () { isActive = false; };

  p.windowResized = function () {
    if (isActive && canvasEl.parentElement) {
      w = canvasEl.parentElement.offsetWidth;
      h = canvasEl.parentElement.offsetHeight;
      p.resizeCanvas(w, h);
    }
  };
};

window.whitneyP5 = new p5(whitneySketch);
