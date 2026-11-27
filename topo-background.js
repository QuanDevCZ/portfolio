/*
 * Topo Background: a drifting contour map on a canvas.
 * Plain-JS port of Kokonut UI's topo-background (v1.1.0) by @dorianbaffier,
 * MIT License, https://kokonutui.com · https://github.com/kokonut-labs/kokonutui
 * The original is a React component; this version needs no React or build step.
 *
 * Usage:
 *   const stop = TopoBackground(containerElement, {
 *     interval: 0.07,     // height between contour lines; lower = more lines
 *     speed: 1,           // drift speed; 0 holds it still
 *     interactive: true,  // hill under the cursor, ripple on click
 *     seed: 26,           // same seed = same map every visit
 *     labels: true,       // elevation numbers on the heavy contours
 *     avoid: '.card',     // CSS selector: no labels under these elements
 *     pointerTarget: el,  // where to listen for the cursor (default: container)
 *   });
 *   stop(); // removes the canvas and all listeners
 *
 * Lines take the container's CSS `color`, so restyle them from CSS.
 */
(function () {
  'use strict';

  const CELL = 12;              // px between field samples
  const TERRAIN_SCALE = 360;    // width of a hill, px
  const INDEX_EVERY = 5;        // every 5th line drawn heavier
  const HILL_HEIGHT = 0.5;
  const HILL_SPREAD = 120;
  const HILL_FOLLOW = 9;
  const HILL_RISE = 5;
  const RIPPLE_MS = 1800;
  const RIPPLE_SPEED = 0.24;    // px per ms
  const RIPPLE_WIDTH = 42;
  const RIPPLE_HEIGHT = 0.2;
  const RIPPLE_WAVELENGTH = 96;
  const IDLE_FRAME_MS = 33;     // drift alone only needs ~30fps
  const LABEL_SPACING = 210;
  const LABEL_BASE = 500;
  const LABEL_STEP = 20;
  const LABEL_MARGIN = 0.16;
  const MAX_LABEL_ANGLE = Math.PI / 3;
  const LABEL_FONT = '500 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';

  /** Seeded 3D gradient noise (Perlin's improved noise), about -1 to 1. */
  function createNoise(seed) {
    const p = Array.from({ length: 256 }, (_, i) => i);
    let state = seed >>> 0 || 1;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + (b - a) * t;
    const grad = (hash, x, y, z) => {
      const h = hash & 15;
      const u = h < 8 ? x : y;
      let v = z;
      if (h < 4) v = y;
      else if (h === 12 || h === 14) v = x;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };
    return (x, y, z) => {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      const fx = x - Math.floor(x), fy = y - Math.floor(y), fz = z - Math.floor(z);
      const u = fade(fx), v = fade(fy), w = fade(fz);
      const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
      const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
      return lerp(
        lerp(
          lerp(grad(perm[AA], fx, fy, fz), grad(perm[BA], fx - 1, fy, fz), u),
          lerp(grad(perm[AB], fx, fy - 1, fz), grad(perm[BB], fx - 1, fy - 1, fz), u),
          v
        ),
        lerp(
          lerp(grad(perm[AA + 1], fx, fy, fz - 1), grad(perm[BA + 1], fx - 1, fy, fz - 1), u),
          lerp(grad(perm[AB + 1], fx, fy - 1, fz - 1), grad(perm[BB + 1], fx - 1, fy - 1, fz - 1), u),
          v
        ),
        w
      );
    };
  }

  /** Marching-squares segment(s) for one cell. Corner bits: TL 8, TR 4, BR 2, BL 1. */
  function cellSegments(path, index, box, cross) {
    const { x0, y0, x1, y1 } = box;
    const { top, right, bottom, left } = cross;
    const line = (ax, ay, bx, by) => { path.moveTo(ax, ay); path.lineTo(bx, by); };
    switch (index) {
      case 1: case 14: line(x0, left, bottom, y1); break;
      case 2: case 13: line(bottom, y1, x1, right); break;
      case 3: case 12: line(x0, left, x1, right); break;
      case 4: case 11: line(top, y0, x1, right); break;
      case 6: case 9: line(top, y0, bottom, y1); break;
      case 7: case 8: line(x0, left, top, y0); break;
      case 5: line(x0, left, top, y0); line(bottom, y1, x1, right); break;   // saddle
      case 10: line(top, y0, x1, right); line(x0, left, bottom, y1); break;  // saddle
      default: break;
    }
  }

  /** Offer a point on an index contour as a label spot; closest to its slot centre wins. */
  function offerLabel(slots, label) {
    const { x, y } = label;
    if (
      y < slots.height * LABEL_MARGIN || y > slots.height * (1 - LABEL_MARGIN) ||
      x < 24 || x > slots.width - 24 ||
      slots.avoid.some(r => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1)
    ) return;
    const row = Math.floor(y / LABEL_SPACING);
    const shifted = x + slots.drift + (row % 2) * (LABEL_SPACING / 2);
    const col = Math.floor(shifted / LABEL_SPACING);
    const cx = (col + 0.5) * LABEL_SPACING;
    const cy = (row + 0.5) * LABEL_SPACING;
    const score = (shifted - cx) ** 2 + (y - cy) ** 2;
    if (score > (LABEL_SPACING * 0.32) ** 2) return;
    const key = row * 100000 + col;
    const current = slots.best.get(key);
    if (!current || score < current.score) slots.best.set(key, { ...label, score });
  }

  function offerCellLabel(slots, a, b, c, d, x0, y0, level, t) {
    const gx = b - a + c - d;
    const gy = d - a + c - b;
    const px = gx / (2 * CELL), py = gy / (2 * CELL);
    const g2 = px * px + py * py;
    const lift = g2 > 0 ? (t - (a + b + c + d) / 4) / g2 : 0;
    const half = CELL / 2;
    const ox = Math.max(-half, Math.min(half, lift * px));
    const oy = Math.max(-half, Math.min(half, lift * py));
    let angle = Math.atan2(gx, -gy);
    if (angle > Math.PI / 2) angle -= Math.PI;
    else if (angle < -Math.PI / 2) angle += Math.PI;
    if (Math.abs(angle) > MAX_LABEL_ANGLE) return;
    offerLabel(slots, { x: x0 + half + ox, y: y0 + half + oy, angle, level });
  }

  function traceContours(field, cols, rows, interval, minor, major, slots) {
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = field[j * cols + i];
        const b = field[j * cols + i + 1];
        const c = field[(j + 1) * cols + i + 1];
        const d = field[(j + 1) * cols + i];
        const first = Math.ceil(Math.min(a, b, c, d) / interval);
        const last = Math.floor(Math.max(a, b, c, d) / interval);
        if (first > last) continue;
        const x0 = i * CELL, y0 = j * CELL;
        const box = { x0, y0, x1: x0 + CELL, y1: y0 + CELL };
        for (let level = first; level <= last; level++) {
          const t = level * interval;
          const index = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
          if (index === 0 || index === 15) continue;
          const isIndex = level % INDEX_EVERY === 0;
          cellSegments(isIndex ? major : minor, index, box, {
            top: x0 + CELL * ((t - a) / (b - a)),
            right: y0 + CELL * ((t - b) / (c - b)),
            bottom: x0 + CELL * ((t - d) / (c - d)),
            left: y0 + CELL * ((t - a) / (d - a)),
          });
          if (isIndex && slots && index !== 5 && index !== 10) {
            offerCellLabel(slots, a, b, c, d, x0, y0, level, t);
          }
        }
      }
    }
  }

  function stepHill(hill, dt) {
    const follow = 1 - Math.exp(-HILL_FOLLOW * dt);
    hill.x += (hill.targetX - hill.x) * follow;
    hill.y += (hill.targetY - hill.y) * follow;
    const goal = hill.on ? 1 : 0;
    hill.amount += (goal - hill.amount) * (1 - Math.exp(-HILL_RISE * dt));
    return Math.abs(hill.targetX - hill.x) > 0.5 ||
      Math.abs(hill.targetY - hill.y) > 0.5 ||
      Math.abs(goal - hill.amount) > 0.002;
  }

  function TopoBackground(root, options) {
    const {
      interval = 0.07,
      speed = 1,
      interactive = true,
      seed = 26,
      labels = true,
      avoid = null,
      pointerTarget = root,
    } = options || {};

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    root.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => canvas.remove();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const noise = createNoise(seed);
    const avoidEls = avoid ? Array.from(document.querySelectorAll(avoid)) : [];

    let width = 0, height = 0, cols = 0, rows = 0;
    let field = new Float32Array(0);
    let color = '';
    const hill = { x: 0, y: 0, targetX: 0, targetY: 0, amount: 0, on: false };
    const ripples = [];
    let time = 0, last = 0, lastPaint = 0, raf = 0, visible = true;
    const slots = { drift: 0, width: 0, height: 0, best: new Map(), avoid: [] };

    // Measured every paint, so it stays right while the page scrolls under a fixed map.
    const measureAvoid = () => {
      const origin = canvas.getBoundingClientRect();
      slots.avoid = avoidEls.map(el => {
        const r = el.getBoundingClientRect();
        return {
          x0: r.left - origin.left - 16, y0: r.top - origin.top - 12,
          x1: r.right - origin.left + 16, y1: r.bottom - origin.top + 12,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      field = new Float32Array(cols * rows);
      color = getComputedStyle(canvas).color;
    };

    const sample = now => {
      const z = time * 0.05;
      const drift = time * 6;
      const hillOn = hill.amount > 0.001;
      const spread = 2 * HILL_SPREAD * HILL_SPREAD;
      const ringWidth = 2 * RIPPLE_WIDTH * RIPPLE_WIDTH;
      for (let j = 0; j < rows; j++) {
        const y = j * CELL;
        for (let i = 0; i < cols; i++) {
          const x = i * CELL;
          const nx = (x + drift) / TERRAIN_SCALE;
          const ny = y / TERRAIN_SCALE;
          let v = noise(nx, ny, z) * 0.78 + noise(nx * 2.3 + 17.1, ny * 2.3 + 4.7, z * 1.4) * 0.22;
          if (hillOn) {
            const dx = x - hill.x, dy = y - hill.y;
            v += HILL_HEIGHT * hill.amount * Math.exp(-(dx * dx + dy * dy) / spread);
          }
          for (const ripple of ripples) {
            const age = now - ripple.start;
            const d = Math.hypot(x - ripple.x, y - ripple.y) - age * RIPPLE_SPEED;
            const fadeOut = 1 - age / RIPPLE_MS;
            v += RIPPLE_HEIGHT * fadeOut * fadeOut *
              Math.exp(-(d * d) / ringWidth) *
              Math.cos((d / RIPPLE_WAVELENGTH) * Math.PI * 2);
          }
          field[j * cols + i] = v;
        }
      }
    };

    // Knock the lines out under each label, then print the elevation.
    const drawLabels = () => {
      ctx.font = LABEL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const label of slots.best.values()) {
        const text = String(LABEL_BASE + label.level * LABEL_STEP);
        const w = ctx.measureText(text).width + 8;
        ctx.save();
        ctx.translate(Math.round(label.x), Math.round(label.y));
        ctx.rotate(label.angle);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        ctx.fillRect(-w / 2, -6, w, 12);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.5;
        ctx.fillText(text, 0, 0.5);
        ctx.restore();
      }
    };

    const paint = now => {
      sample(now);
      const minor = new Path2D();
      const major = new Path2D();
      slots.best.clear();
      slots.drift = time * 6;
      slots.width = width;
      slots.height = height;
      if (labels) measureAvoid();
      traceContours(field, cols, rows, interval, minor, major, labels ? slots : null);
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 0.75;
      ctx.stroke(minor);
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = 1.1;
      ctx.stroke(major);
      if (labels) drawLabels();
      ctx.globalAlpha = 1;
    };

    const frame = now => {
      raf = 0;
      if (!visible) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const hillMoving = stepHill(hill, dt);
      while (ripples.length > 0 && now - ripples[0].start > RIPPLE_MS) ripples.shift();
      const settling = hillMoving || ripples.length > 0;
      time += dt * speed;
      if (settling || now - lastPaint >= IDLE_FRAME_MS) {
        paint(now);
        lastPaint = now;
      }
      if (speed > 0 || settling) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf && visible && !reduceMotion) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    // Repaint if the line colour changes (e.g. a theme switch).
    let colorTimer = 0;
    const checkColor = () => {
      const next = getComputedStyle(canvas).color;
      if (next !== color) {
        color = next;
        if (reduceMotion || !raf) paint(performance.now());
      }
    };
    const watchColor = () => {
      if (visible && !colorTimer) {
        checkColor();
        colorTimer = window.setInterval(checkColor, 500);
      } else if (!visible && colorTimer) {
        window.clearInterval(colorTimer);
        colorTimer = 0;
      }
    };

    resize();
    paint(performance.now());
    canvas.classList.add('is-ready');
    start();

    const resizeObserver = new ResizeObserver(() => { resize(); paint(performance.now()); });
    resizeObserver.observe(canvas);

    // Stop drawing while off screen or in a background tab.
    let onScreen = true;
    const updateVisible = () => {
      visible = onScreen && document.visibilityState === 'visible';
      watchColor();
      if (visible) start();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      updateVisible();
    });
    intersection.observe(root);
    document.addEventListener('visibilitychange', updateVisible);
    watchColor();

    // While the map is static (reduced motion), labels still need to follow scrolling.
    const onScroll = () => { if (!raf) paint(performance.now()); };
    if (labels && avoidEls.length) window.addEventListener('scroll', onScroll, { passive: true });

    const local = event => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onMove = event => {
      if (event.pointerType !== 'mouse') return; // no hover on touch
      const point = local(event);
      if (!hill.on) { hill.x = point.x; hill.y = point.y; }
      hill.targetX = point.x;
      hill.targetY = point.y;
      hill.on = true;
      start();
    };
    const onLeave = () => { hill.on = false; start(); };
    const onDown = event => {
      // Clicks on the content are not meant for the map.
      if (event.target.closest && event.target.closest('a, button, input, textarea, label')) return;
      ripples.push({ ...local(event), start: performance.now() });
      if (ripples.length > 4) ripples.shift();
      start();
    };
    const leaveTarget = pointerTarget === window ? document.documentElement : pointerTarget;
    if (interactive && !reduceMotion) {
      pointerTarget.addEventListener('pointermove', onMove);
      leaveTarget.addEventListener('pointerleave', onLeave);
      pointerTarget.addEventListener('pointerdown', onDown);
    }

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', updateVisible);
      window.removeEventListener('scroll', onScroll);
      window.clearInterval(colorTimer);
      pointerTarget.removeEventListener('pointermove', onMove);
      leaveTarget.removeEventListener('pointerleave', onLeave);
      pointerTarget.removeEventListener('pointerdown', onDown);
      canvas.remove();
    };
  }

  window.TopoBackground = TopoBackground;
})();
