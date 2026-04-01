// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

// Animate elements on scroll
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.1 }
);

document.querySelectorAll(".card, .flow-step, .app-card, .asset-card, .arch-box").forEach((el) => {
  el.classList.add("animate-in");
  observer.observe(el);
});

// Animate stats counting up
const statObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.textContent, 10);
        if (isNaN(target)) return;

        let current = 0;
        const duration = 1200;
        const step = duration / (target || 1);

        if (target === 0) {
          el.textContent = "0";
          return;
        }

        const interval = setInterval(() => {
          current++;
          el.textContent = current;
          if (current >= target) clearInterval(interval);
        }, step);

        statObserver.unobserve(el);
      }
    });
  },
  { threshold: 0.5 }
);

document.querySelectorAll(".stat-value").forEach((el) => {
  statObserver.observe(el);
});
