// Quan Nguyen — portfolio. Zero dependencies.
// The drum: cards sit on a cylinder (rotateX around an axis R behind them).
// Every input (wheel, drag, keys, dots, clicks) only moves `target`;
// one rAF loop eases `pos` toward it and writes the transforms.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const drum = document.getElementById('drum');
const cards = [...drum.querySelectorAll('.dcard')];
const dotsNav = document.getElementById('dots');
const N = cards.length;
const STEP = 62;          // degrees between neighbouring cards
const LAST = N - 1;

let pos = 0;              // rendered position (fractional card index)
let target = 0;           // where we're heading
let radius = 520;
let raf = 0;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- dots ----------
const dots = cards.map((card, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', `Show ${card.dataset.name}`);
  b.addEventListener('click', () => go(i));
  dotsNav.append(b);
  return b;
});

// ---------- render ----------
function measure() {
  const h = cards[0].offsetHeight;
  radius = h * 1.1;
}

function render() {
  const front = Math.round(pos);
  cards.forEach((card, i) => {
    const d = i - pos;
    const ad = Math.abs(d);
    if (ad > 1.9) {
      card.style.visibility = 'hidden';
      return;
    }
    card.style.visibility = 'visible';
    card.style.transform =
      `translateZ(${-radius}px) rotateX(${-d * STEP}deg) translateZ(${radius}px)`;
    card.style.opacity = String(clamp(1 - Math.max(0, ad - 0.1) * 0.5, 0, 1));
    card.style.setProperty('--fade', clamp(ad * 0.7, 0, 0.85).toFixed(3));
    card.style.zIndex = String(100 - Math.round(ad * 10));
    const isFront = i === front;
    card.classList.toggle('is-front', isFront);
    card.setAttribute('aria-hidden', String(!isFront));
    card.tabIndex = isFront ? 0 : -1;
  });
  dots.forEach((b, i) => b.setAttribute('aria-current', String(i === front)));
}

// Frame-rate independent ease: same feel at 60 Hz, 120 Hz or a throttled tab.
let lastT = 0;
function tick(now) {
  const dt = Math.min(250, now - (lastT || now - 16.7));
  lastT = now;
  const delta = target - pos;
  if (reduceMotion || Math.abs(delta) < 0.0005) {
    pos = target;
    render();
    raf = 0;
    lastT = 0;
    return;
  }
  pos += delta * (1 - Math.pow(1 - 0.14, dt / 16.7));
  render();
  raf = requestAnimationFrame(tick);
}

function kick() {
  if (!raf) raf = requestAnimationFrame(tick);
}

function go(i) {
  target = clamp(i, 0, LAST);
  kick();
}

// ---------- wheel: only while hovering the drum, and never past the ends ----------
let snapTimer = 0;
drum.addEventListener('wheel', (e) => {
  const dy = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : 0;
  if (!dy) return;
  const atStart = target <= 0 && dy < 0;
  const atEnd = target >= LAST && dy > 0;
  if (atStart || atEnd) return;            // let the page scroll on
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 0.12 : 0.0032;  // lines vs pixels
  target = clamp(target + clamp(dy * unit, -0.6, 0.6), 0, LAST);
  kick();
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => go(Math.round(target)), 140);
}, { passive: false });

// ---------- drag ----------
let drag = null;
let suppressClick = false;

drum.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  drag = { y: e.clientY, start: target, moved: 0, lastY: e.clientY, lastT: e.timeStamp, v: 0, id: e.pointerId };
});

drum.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dy = e.clientY - drag.y;
  drag.moved = Math.max(drag.moved, Math.abs(dy));
  if (drag.moved > 4 && !drum.classList.contains('is-dragging')) {
    drum.classList.add('is-dragging');
    drum.setPointerCapture(e.pointerId);
  }
  const dt = Math.max(1, e.timeStamp - drag.lastT);
  drag.v = (e.clientY - drag.lastY) / dt;
  drag.lastY = e.clientY;
  drag.lastT = e.timeStamp;
  target = clamp(drag.start - dy / (cards[0].offsetHeight * 0.75), -0.25, LAST + 0.25);
  kick();
});

function endDrag() {
  if (!drag) return;
  suppressClick = drag.moved > 4;
  const fling = clamp(-drag.v * 0.9, -1, 1);   // px/ms → cards
  drum.classList.remove('is-dragging');
  drag = null;
  go(Math.round(target + fling));
}
drum.addEventListener('pointerup', endDrag);
drum.addEventListener('pointercancel', endDrag);

// A click on a side card brings it to the front instead of opening it.
cards.forEach((card, i) => {
  card.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); suppressClick = false; return; }
    if (i !== Math.round(pos)) { e.preventDefault(); go(i); }
  });
  card.addEventListener('dragstart', (e) => e.preventDefault());
});

// ---------- keys ----------
drum.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); go(Math.round(target) + 1); }
  else if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); go(Math.round(target) - 1); }
  else if (k === 'Home') { e.preventDefault(); go(0); }
  else if (k === 'End') { e.preventDefault(); go(LAST); }
});

addEventListener('resize', () => { measure(); render(); });
measure();
render();

// ---------- intro + reveals ----------
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('is-ready')));

const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('is-in'));
}
