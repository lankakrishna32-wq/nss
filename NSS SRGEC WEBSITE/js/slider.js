document.addEventListener("DOMContentLoaded", async () => {
  const slider = document.querySelector("[data-slider]");
  if (!slider) return;


  let data;
  try {
    const res = await fetch("/api/site");
    if (!res.ok) {
      throw new Error("Failed to fetch site data");
    }
    const result = await res.json();
    if (!result.success || !result.data) {
      throw new Error(result.message || "Invalid site data");
    }
    data = result.data;
  } catch (error) {
    console.error("Failed to load slider data:", error);
    return;
  }
  
  const slides = [...(data.activities || []).map(c => ({ title: c.name, description: c.description, image: c.image }))].slice(0, 6);

  slider.innerHTML = `
    <div class="slides" style="display: flex; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); width: 100%;">
      ${slides.map(slide => `
        <article class="slide" style="min-width: 100%; position: relative; height: 420px; display: flex; align-items: flex-end; overflow: hidden; border-radius: var(--radius);">
          <img src="${slide.image}" alt="${slide.title}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(0.55);">
          <div style="position: relative; z-index: 2; padding: 32px; max-width: 650px;">
            <span class="eyebrow">Highlights</span>
            <h2 style="font-size: 2rem; color: #fff; margin: 8px 0;">${slide.title}</h2>
            <p style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.6;">${slide.description}</p>
          </div>
        </article>
      `).join("")}
    </div>
    <div style="position: absolute; right: 24px; bottom: 24px; z-index: 3; display: flex; gap: 8px;">
      <button class="icon-btn" data-prev aria-label="Previous">&larr;</button>
      <button class="icon-btn" data-next aria-label="Next">&rarr;</button>
    </div>
  `;

  const track = slider.querySelector(".slides");
  let current = 0;

  const go = (dir) => {
    current = (current + dir + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
  };

  slider.querySelector("[data-prev]")?.addEventListener("click", () => go(-1));
  slider.querySelector("[data-next]")?.addEventListener("click", () => go(1));

  setInterval(() => go(1), 5500);
});
// Shared scroll-reveal animation for page sections and dynamically added cards.
(() => {
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        });
    }, { threshold: 0.14 });

    const applyScrollReveal = () => {
        document.querySelectorAll(
            '.volunteers-directory__intro, .volunteer-name, .volunteers-directory__empty, .core-team-slot, .core-team-chart'
        ).forEach((element) => {
            if (element.dataset.scrollRevealReady) return;
            element.dataset.scrollRevealReady = 'true';
            element.classList.add('page-scroll-reveal');
            revealObserver.observe(element);
        });
    };

    window.addEventListener('DOMContentLoaded', applyScrollReveal);
    new MutationObserver(applyScrollReveal).observe(document.documentElement, { childList: true, subtree: true });
})();
