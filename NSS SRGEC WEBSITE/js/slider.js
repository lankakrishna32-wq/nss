document.addEventListener("DOMContentLoaded", async () => {
  const slider = document.querySelector("[data-slider]");
  if (!slider) return;

  const dataStr = localStorage.getItem("srgecNssData");
  let data;
  if (dataStr) {
    try { data = JSON.parse(dataStr); } catch (e) {}
  }
  if (!data) {
    const res = await fetch("data/site.json");
    data = await res.json();
  }

  const slides = [...(data.activities || []), ...(data.camps || []).map(c => ({ title: c.name, description: c.description, image: c.image }))].slice(0, 6);

  slider.innerHTML = `
    <div class="slides" style="display: flex; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); width: 100%;">
      ${slides.map(slide => `
        <article class="slide" style="min-width: 100%; position: relative; height: 420px; display: flex; align-items: flex-end; overflow: hidden; border-radius: var(--radius);">
          <img src="${slide.image}" alt="${slide.title}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(0.55);">
          <div style="position: relative; z-index: 2; padding: 32px; max-width: 650px;">
            <span class="eyebrow">SRGEC NSS Highlight</span>
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
