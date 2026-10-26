// Quan Nguyen — portfolio. Zero dependencies.
// Intro fade-in once the page is painted, then cards fade up as they scroll in.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
