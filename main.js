// Staggered fade-up on load
const reveals = document.querySelectorAll('.reveal');
requestAnimationFrame(() => {
  reveals.forEach((el, i) => {
    el.style.transitionDelay = `${i * 60}ms`;
    el.classList.add('in');
  });
});

// Morph buttons (Gabriel style): button pulses into a black circle with an X
// and opens its panel. About grows the hero box down; Contact grows socials right.
const morphs = [
  { btn: document.querySelector('.about-btn'), panel: document.getElementById('about-panel') },
  { btn: document.querySelector('.contact'),   panel: document.getElementById('socials-row') },
];

function setMorph(m, open) {
  const { btn, panel } = m;
  if (btn.classList.contains('is-open') === open) return;
  btn.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', String(open));
  panel.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
  panel.querySelectorAll('a').forEach(a => { a.tabIndex = open ? 0 : -1; });
  // restart the squash-and-settle pulse
  btn.classList.remove('anim-open', 'anim-close');
  void btn.offsetWidth;
  btn.classList.add(open ? 'anim-open' : 'anim-close');
}

const closeAll = () => morphs.forEach(m => setMorph(m, false));

morphs.forEach(m => {
  m.btn.addEventListener('click', e => {
    e.stopPropagation();
    const willOpen = !m.btn.classList.contains('is-open');
    morphs.forEach(o => { if (o !== m) setMorph(o, false); });
    setMorph(m, willOpen);
  });
});

// Contact form: sent through Web3Forms (free, delivers to my Gmail), so the
// visitor stays on the page. Until the key is set, or if the request fails,
// fall back to opening the visitor's email app with the message filled in.
const WEB3FORMS_KEY = '210d36cd-b5fd-4887-b3a3-edde5bdd6c72'; // public by design: only delivers to my inbox
const CONTACT_EMAIL = 'nguyenhonza1301@gmail.com';
const form = document.getElementById('contact-form');
const statusEl = form.querySelector('.form-status');
const submitBtn = form.querySelector('button[type="submit"]');

function setStatus(text, ok = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('ok', ok);
}

async function sendViaWeb3Forms(f) {
  const { name, email, message, botcheck } = f.elements;
  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: WEB3FORMS_KEY,
      subject: `Portfolio message from ${name.value.trim()}`,
      from_name: 'Portfolio',
      name: name.value.trim(),
      email: email.value.trim(),
      message: message.value.trim(),
      botcheck: botcheck.checked,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || `HTTP ${res.status}`);
}

function mailtoFromForm(f) {
  const { name: n, email: em, message: msg } = f.elements;
  const name = n.value.trim();
  const email = em.value.trim();
  const message = msg.value.trim();
  const subject = `Portfolio message from ${name}`;
  const body = `${message}\n\n${name}\n${email}`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  if (!WEB3FORMS_KEY) { window.location.href = mailtoFromForm(form); return; }

  submitBtn.disabled = true;
  setStatus('Sending…');
  try {
    await sendViaWeb3Forms(form);
    form.reset();
    setStatus("Thanks, your message is on its way. I'll reply soon.", true);
  } catch {
    setStatus('Could not send right now. Opening your email app instead.');
    window.location.href = mailtoFromForm(form);
  } finally {
    submitBtn.disabled = false;
  }
});

// Click outside an open panel, or Esc, closes everything
document.addEventListener('click', e => {
  if (!e.target.closest('.about-panel, .socials-row')) closeAll();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAll();
});
