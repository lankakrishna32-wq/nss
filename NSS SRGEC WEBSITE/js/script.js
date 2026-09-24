const SITE_KEY = "srgecNssData";
const REQUIRED_DATA_VERSION = 6;

const navItems = [
  ["Home", "index.html"],
  ["About Us", "about.html"],
  ["Activities", "activities.html"],
  ["Core Team", "core-team.html"],
  ["Gallery", "gallery.html"],
  ["Contact", "contact.html"]
];

async function loadSiteData() {

  // 1. Try loading live data from Node.js + MongoDB
  try {
    const response = await fetch("/api/site");

    if (response.ok) {
      const result = await response.json();

      if (result.success && result.data && result.data.version) {
        localStorage.setItem(
          SITE_KEY,
          JSON.stringify(result.data)
        );

        return result.data;
      }
    }

    console.warn("Could not fetch from Node.js, falling back...");
  } catch (e) {
    console.warn(
      "Node.js server unavailable, falling back:",
      e
    );
  }

  // 2. Check localStorage for fast instant render
  const stored = localStorage.getItem(SITE_KEY);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);

      if (parsed.version === REQUIRED_DATA_VERSION) {
        return parsed;
      }

    } catch (e) {
      console.warn(
        "Invalid stored data, re-fetching site.json"
      );
    }
  }

  // 3. Final fallback to static site.json
  const response = await fetch("data/site.json");
  const data = await response.json();

  localStorage.setItem(
    SITE_KEY,
    JSON.stringify(data)
  );

  return data;
}

async function saveSiteData(data) {
  localStorage.setItem(SITE_KEY, JSON.stringify(data));

  try {
    const response = await fetch("/api/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "MongoDB save failed");
    }

    console.log("Site data saved to MongoDB successfully");

  } catch (err) {
    console.warn("MongoDB save error:", err);
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return escapeHtml(dateStr);
  return d.toLocaleString("en-IN", { month: "short", year: "numeric", day: "2-digit" });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read the selected PDF."));
    reader.readAsDataURL(file);
  });
}

function initShell() {
  document.documentElement.dataset.theme = localStorage.getItem("srgecTheme") || "dark";
  const page = document.body.dataset.page || "index.html";
  
  document.querySelectorAll("[data-nav]").forEach((nav) => {
    nav.innerHTML = navItems.map(([label, href]) => 
      `<a class="${href === page ? "active" : ""}" href="${href}">${label}</a>`
    ).join("");
  });

  document.querySelectorAll("[data-year]").forEach((el) => el.textContent = new Date().getFullYear());

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const currentTheme = document.documentElement.dataset.theme || "dark";
      const next = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("srgecTheme", next);
    });
  });

  document.querySelectorAll("[data-menu-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector("[data-nav]")?.classList.toggle("open");
    });
  });

  // Modal Backdrop HTML setup if not present
  if (!document.getElementById("app-modal-backdrop")) {
    const backdrop = document.createElement("div");
    backdrop.id = "app-modal-backdrop";
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal-box" id="app-modal-box">
        <button class="modal-close" id="app-modal-close" aria-label="Close">&times;</button>
        <div id="app-modal-content"></div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
    document.getElementById("app-modal-close")?.addEventListener("click", closeModal);
  }

  document.querySelectorAll(".loader").forEach(el => el.remove());
}

function openModal(htmlContent) {
  const backdrop = document.getElementById("app-modal-backdrop");
  const content = document.getElementById("app-modal-content");
  if (!backdrop || !content) return;
  content.innerHTML = htmlContent;
  backdrop.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const backdrop = document.getElementById("app-modal-backdrop");
  if (!backdrop) return;
  backdrop.classList.remove("open");
  document.body.style.overflow = "";
}

function observeReveals() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

// Render Core Team (Programme Officer Side-by-Side + Compact Cards + Profile Modal)
function renderCoreTeam(members) {
  const membersWrap = document.querySelector("[data-members]");
  if (!membersWrap) return;

  const po = members.find(m => m.role.includes("Programme Officer") || m.branch === "Faculty");
  const studentCoordinators = members.filter(m => m !== po);

  // Active / Alumni Tab Logic
  const tabsContainer = document.querySelector("[data-team-tabs]");
  let activeTab = "active";

  const renderGrid = (filterStatus) => {
    if (!membersWrap) return;
    const filtered = studentCoordinators.filter(m => (m.status || "active") === filterStatus);
    
    membersWrap.innerHTML = filtered.map(m => `
      <div class="member-card-compact reveal" onclick="showMemberModal('${escapeHtml(m.name)}')">
        <span class="status-tag ${m.status === 'alumni' ? 'alumni' : 'active'}">${m.status === 'alumni' ? 'Alumni' : 'Active'}</span>
        <img src="${m.image}" alt="${escapeHtml(m.name)}" class="member-avatar">
        <h3 class="member-name">${escapeHtml(m.name)}</h3>
        <div class="member-role">${escapeHtml(m.role)}</div>
        <div class="member-period">${escapeHtml(m.period)} &bull; ${escapeHtml(m.branch)}</div>
        <span class="click-hint">View Details &rarr;</span>
      </div>
    `).join("");

    observeReveals();
  };

  if (tabsContainer) {
    tabsContainer.innerHTML = `
      <div class="tabs-header">
        <button class="tab-btn active" data-tab="active">Active Coordinators</button>
        <button class="tab-btn" data-tab="alumni">Former / Alumni Coordinators</button>
      </div>
    `;

    tabsContainer.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        tabsContainer.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeTab = btn.dataset.tab;
        renderGrid(activeTab);
      });
    });
  }

  renderGrid(activeTab);
  window._siteMembers = members;
}

window.showMemberModal = function(memberName) {
  const members = window._siteMembers || [];
  const m = members.find(item => item.name === memberName);
  if (!m) return;

  const html = `
    <div class="profile-modal-body">
      <div class="profile-modal-header">
        <img src="${m.image}" alt="${escapeHtml(m.name)}" class="profile-modal-img">
        <div class="profile-modal-meta">
          <span class="status-tag ${m.status === 'alumni' ? 'alumni' : 'active'}" style="margin-bottom: 8px;">
            ${m.branch === 'Faculty' ? 'Programme Officer' : (m.status === 'alumni' ? 'Former Coordinator / Alumni' : 'Active Coordinator')}
          </span>
          <h2>${escapeHtml(m.name)}</h2>
          <div class="role">${escapeHtml(m.role)}</div>
          <div class="details">
            ${m.designation ? `<strong>Designation:</strong> ${escapeHtml(m.designation)}<br>` : ''}
            ${m.branch && m.branch !== 'Faculty' ? `<strong>Branch:</strong> ${escapeHtml(m.branch)}<br>` : ''}
            ${m.roll ? `<strong>Roll No:</strong> ${escapeHtml(m.roll)}<br>` : ''}
            ${m.Email ? `<strong>Email:</strong> ${escapeHtml(m.Email)}<br>` : ''}
            ${m.phone ? `<strong>Contact:</strong> ${escapeHtml(m.phone)}<br>` : ''}
            ${m.period ? `<strong>Term:</strong> ${escapeHtml(m.period)}` : ''}
          </div>
        </div>
      </div>
      <div class="profile-section">
        <h4>Biography & Information</h4>
        <p>${escapeHtml(m.bio)}</p>
      </div>
      ${m.college ? `
        <div class="profile-section">
          <h4>Institution & Office Address</h4>
          <p>${escapeHtml(m.college)}</p>
        </div>
      ` : ''}
      ${m.achievements ? `
        <div class="profile-section">
          <h4>Key Achievements</h4>
          <p>${escapeHtml(m.achievements)}</p>
        </div>
      ` : ''}
      ${m.camps ? `
        <div class="profile-section">
          <h4>Camp Guidance & Participation</h4>
          <p>${escapeHtml(m.camps)}</p>
        </div>
      ` : ''}
    </div>
  `;
  openModal(html);
};

// Render Stats Counters with Interactive Links
function renderStats(data) {
  const wrap = document.querySelector("[data-stats]");
  const stats = data && data.stats;
  if (!wrap || !stats) return;

  const activities = Array.isArray(data.activities) ? data.activities : [];
  const approvedVolunteerCount = Array.isArray(data.volunteers) ? data.volunteers.length : 0;
  const bloodDonationCount = activities.filter(activity => {
    const searchable = [
      activity.title,
      activity.description,
      activity.category,
      ...(Array.isArray(activity.tags) ? activity.tags : [])
    ].join(" ").toLowerCase();
    return searchable.includes("blood donation");
  }).length;
  const visibleStats = stats
    .filter(s => String(s.label || "").trim().toLowerCase() !== "camps")
    .map(s => {
      const label = String(s.label || "").trim().toLowerCase();
      if (label === "volunteers" || label === "nss volunteers") {
        return { ...s, label: "Volunteers", value: approvedVolunteerCount };
      }
      if (label === "activities") {
        return { ...s, value: activities.length };
      }
      if (label === "blood donation drives") {
        return { ...s, value: bloodDonationCount };
      }
      return s;
    });

  wrap.innerHTML = visibleStats.map(s => {
    if (s.link) {
      return `
        <a href="${s.link}" class="stat-card clickable reveal" style="display: block; text-decoration: none;">
          <div class="stat-value" data-count="${s.value}">0</div>
          <div class="stat-label">${escapeHtml(s.label)} &rarr;</div>
        </a>
      `;
    }
    return `
      <div class="stat-card reveal">
        <div class="stat-value" data-count="${s.value}">0</div>
        <div class="stat-label">${escapeHtml(s.label)}</div>
      </div>
    `;
  }).join("");

  animateCounters();
}

function animateCounters() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const max = Number(el.dataset.count);
      let current = 0;
      const step = Math.max(1, Math.ceil(max / 50));
      const timer = setInterval(() => {
        current += step;
        if (current >= max) {
          el.textContent = max;
          clearInterval(timer);
        } else {
          el.textContent = current;
        }
      }, 30);
      io.unobserve(el);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll("[data-count]").forEach((el) => io.observe(el));
}

// Render Activities with Compact Cards & Click Modal
function renderActivityCards(data) {
  const wrap = document.querySelector("[data-activities]");
  if (!wrap || !data.activities) return;

  const searchInput = document.querySelector("[data-search]");
  const yearFilter = document.querySelector("[data-year-filter]");
  const categoryFilter = document.querySelector("[data-category-filter]");

  const years = [...new Set(data.activities.map(a => a.year || new Date(a.date).getFullYear()))].sort((a, b) => b - a);
  const categories = [...new Set(data.activities.map(a => a.category))].sort();

  if (yearFilter) {
    yearFilter.innerHTML = `<option value="">All Years</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
  }
  if (categoryFilter) {
    categoryFilter.innerHTML = `<option value="">All Categories</option>` + categories.map(c => `<option value="${c}">${c}</option>`).join("");
  }

  const filterAndPaint = () => {
    const term = (searchInput?.value || "").toLowerCase();
    const selYear = yearFilter?.value || "";
    const selCat = categoryFilter?.value || "";

    const filtered = data.activities.filter(a => {
      const text = `${a.title} ${a.description} ${a.location} ${a.category}`.toLowerCase();
      const matchTerm = !term || text.includes(term);
      const matchYear = !selYear || String(a.year || new Date(a.date).getFullYear()) === selYear;
      const matchCat = !selCat || a.category === selCat;
      return matchTerm && matchYear && matchCat;
    });

    if (filtered.length === 0) {
      wrap.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 40px;">No activities found matching criteria.</p>`;
      return;
    }

    wrap.innerHTML = filtered.map((a, idx) => `
      <div class="card reveal" style="cursor: pointer;" onclick="showActivityModal(${idx})">
        <img src="${a.image}" alt="${escapeHtml(a.title)}" class="card-media">
        <div class="card-body">
          <span class="eyebrow" style="margin-bottom: 8px;">${escapeHtml(a.category)}</span>
          <h3 style="font-size: 1.15rem; margin-bottom: 8px;">${escapeHtml(a.title)}</h3>
          <p style="color: var(--muted); font-size: 0.85rem; margin-bottom: 12px;">📅 ${formatDate(a.date)} &bull; 📍 ${escapeHtml(a.location)}</p>
          <p style="font-size: 0.9rem; color: var(--text); line-height: 1.5; margin-bottom: 14px;">${escapeHtml(a.description.substring(0, 90))}...</p>
          <span class="click-hint" style="opacity: 1; transform: none;">Click to view full details &rarr;</span>
        </div>
      </div>
    `).join("");

    observeReveals();
    window._filteredActivities = filtered;
  };

  [searchInput, yearFilter, categoryFilter].forEach(el => el?.addEventListener("input", filterAndPaint));
  filterAndPaint();
}

window.showActivityModal = function(index) {
  const list = window._filteredActivities || [];
  const a = list[index];
  if (!a) return;

  const html = `
    <div style="padding: 28px;">
      <img src="${a.image}" alt="${escapeHtml(a.title)}" style="width: 100%; height: 260px; object-fit: cover; border-radius: var(--radius); margin-bottom: 20px;">
      <span class="eyebrow">${escapeHtml(a.category)}</span>
      <h2 style="font-size: 1.8rem; margin: 8px 0 12px;">${escapeHtml(a.title)}</h2>
      <p style="color: var(--muted); font-size: 0.95rem; margin-bottom: 16px;">
        📅 <strong>Date:</strong> ${formatDate(a.date)} &bull; 📍 <strong>Location:</strong> ${escapeHtml(a.location)}
      </p>
      <div style="margin-bottom: 20px; line-height: 1.7; color: var(--text);">
        <p>${escapeHtml(a.description)}</p>
      </div>
      <div style="background: var(--bg-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; gap: 20px; flex-wrap: wrap;">
        <div><strong>Volunteers:</strong> ${escapeHtml(String(a.volunteers))}</div>
        <div><strong>Organizers:</strong> ${escapeHtml(a.organizers || "NSS Unit")}</div>
      </div>
    </div>
  `;
  openModal(html);
};

// Render Gallery Masonry
function renderGallery(gallery) {
  const wrap = document.querySelector("[data-gallery]");
  if (!wrap || !gallery) return;

  const albumFilter = document.querySelector("[data-album-filter]");
  const yearFilter = document.querySelector("[data-gallery-year-filter]");
  const typeFilter = document.querySelector("[data-type-filter]");

  const hiddenAlbumFilters = new Set(["Band Team", "Camps", "College Events"]);
  const albums = [...new Set(gallery.map(g => g.album))]
    .filter(album => !hiddenAlbumFilters.has(album))
    .sort();
  const years = [...new Set(gallery.map(g => g.year))].sort((a, b) => b - a);

  if (albumFilter) {
    albumFilter.innerHTML = `<option value="">All Albums</option>` + albums.map(a => `<option value="${a}">${a}</option>`).join("");
  }
  if (yearFilter) {
    yearFilter.innerHTML = `<option value="">All Years</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
  }

  const filterAndPaint = () => {
    const selAlbum = albumFilter?.value || "";
    const selYear = yearFilter?.value || "";
    const selType = typeFilter?.value || "";

    const filtered = gallery.filter(item => {
      return (!selAlbum || item.album === selAlbum) &&
             (!selYear || item.year === selYear) &&
             (!selType || item.type === selType);
    });

    wrap.innerHTML = filtered.map((item, idx) => `
      <div class="gallery-card reveal" onclick="showGalleryLightbox(${idx})">
        <img src="${item.image}" alt="${escapeHtml(item.title)}">
        <div class="gallery-overlay">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.album)} &bull; ${escapeHtml(item.year)}</p>
        </div>
      </div>
    `).join("");

    observeReveals();
    window._filteredGallery = filtered;
  };

  [albumFilter, yearFilter, typeFilter].forEach(el => el?.addEventListener("input", filterAndPaint));
  filterAndPaint();
}

window.showGalleryLightbox = function(idx) {
  const items = window._filteredGallery || [];
  const item = items[idx];
  if (!item) return;

  const html = `
    <div style="padding: 20px; text-align: center;">
      <img src="${item.image}" alt="${escapeHtml(item.title)}" style="max-height: 70vh; width: auto; max-width: 100%; border-radius: var(--radius); margin-bottom: 16px;">
      <h3 style="font-size: 1.4rem;">${escapeHtml(item.title)}</h3>
      <p style="color: var(--muted); font-size: 0.9rem;">${escapeHtml(item.album)} Album &bull; ${escapeHtml(item.year)} &bull; ${escapeHtml(item.type)}</p>
    </div>
  `;
  openModal(html);
};

// Render Upcoming Events Calendar Cards
function renderEvents(events) {
  const wrap = document.querySelector("[data-events]");
  if (!wrap || !events) return;

  wrap.innerHTML = events.map(e => {
    const d = new Date(e.date);
    const day = isNaN(d.getTime()) ? "10" : d.getDate();
    const month = isNaN(d.getTime()) ? "SEP" : d.toLocaleString("en-IN", { month: "short" });

    return `
      <div class="calendar-card reveal">
        <div class="calendar-date-box">
          <strong>${day}</strong>
          <span>${month}</span>
        </div>
        <div>
          <h3 style="font-size: 1.1rem; margin-bottom: 4px;">${escapeHtml(e.title)}</h3>
          <p style="color: var(--muted); font-size: 0.85rem;">📍 ${escapeHtml(e.venue)} &bull; Tag: ${escapeHtml(e.type)}</p>
        </div>
      </div>
    `;
  }).join("");
}

// Registration form handler
function initRegistrations(data) {
  document.querySelectorAll("[data-registration-form]").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : "Submit";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
      }

      const statusEl = form.querySelector("[data-form-status]");

      try {
        const formData = Object.fromEntries(
          [...new FormData(form).entries()].filter(([, value]) => typeof value === "string")
        );

        const aadhaarFile = form.querySelector('input[name="aadhaarCard"]')?.files?.[0];
        if (aadhaarFile) {
          const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
          const allowedExtensions = /\.(pdf|jpe?g|png|webp)$/i;
          const maxFileSize = 500 * 1024;

          if (!allowedTypes.has(aadhaarFile.type) && !allowedExtensions.test(aadhaarFile.name)) {
            throw new Error("Please upload your Aadhaar card as a PDF, JPG, PNG, or WebP file.");
          }
          if (aadhaarFile.size > maxFileSize) {
            throw new Error("The Aadhaar card file must be 500 KB or smaller.");
          }

          formData.aadhaarCard = {
            fileName: aadhaarFile.name,
            mimeType: aadhaarFile.type || "application/octet-stream",
            size: aadhaarFile.size,
            data: await readFileAsBase64(aadhaarFile)
          };
        }

        formData.type = form.dataset.registrationForm;
        formData.createdAt = new Date().toISOString();

        // Send registration to Node.js → MongoDB
        const response = await fetch("/api/registrations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Registration submission failed"
          );
        }

        form.reset();

        if (statusEl) {
          statusEl.textContent =
            "Registration submitted successfully!";
          statusEl.style.color = "var(--green)";
        }

      } catch (error) {
        console.error("Registration submission error:", error);

        if (statusEl) {
          statusEl.textContent = error.message || "Registration submission failed. Please try again.";
          statusEl.style.color = "red";
        }

      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  });
}

function renderAllComponents(data) {
  if (!data) return;
  renderStats(data);
  renderCoreTeam(data.members);
  renderActivityCards(data);
  renderGallery(data.gallery);
  renderEvents(data.events);
  observeReveals();
}

// Document Ready Setup
document.addEventListener("DOMContentLoaded", async () => {
  initShell();
  observeReveals();

  const data = await loadSiteData();
  renderAllComponents(data);
  initRegistrations(data);
})
// Make the public Volunteers directory available from every main-site navigation menu.
(() => {
    const addVolunteersLink = () => {
        document.querySelectorAll('a[href*="activities"], a[href="#activities"]').forEach((activities) => {
            const nav = activities.closest('nav, .nav-links, .navbar, .navigation') || activities.parentElement;
            if (!nav || nav.querySelector('a[href="volunteers.html"]')) return;
            const link = document.createElement('a');
            link.href = 'volunteers.html';
            link.textContent = 'Volunteers';
            link.className = activities.className;
            link.classList.remove('active');
            link.removeAttribute('aria-current');
            nav.insertBefore(link, activities);
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addVolunteersLink);
    } else {
        addVolunteersLink();
    }
})();
// Add the Contact-page social links to the footer's Hamara Bharat Office section.
(() => {
    const socialDefinitions = [
        { key: 'whatsapp', label: 'WhatsApp Channel', symbol: '◉' },
        { key: 'linkedin', label: 'LinkedIn', symbol: 'in' },
        { key: 'facebook', label: 'Facebook', symbol: 'f' }
    ];

    const createSocialBlock = (footer, links) => {
        if (!footer || footer.querySelector('.footer-social-media')) return;
        const officeHeading = Array.from(footer.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b'))
            .find((element) => /hamara bharat office/i.test(element.textContent));
        const block = document.createElement('div');
        block.className = 'footer-social-media';
        block.innerHTML = '<p>Follow Us</p><div class="footer-social-media__links"></div>';
        const container = block.querySelector('.footer-social-media__links');

        socialDefinitions.forEach((social) => {
            const source = links.find((link) => link.key === social.key);
            const anchor = document.createElement('a');
            if (!source?.href) return;
            anchor.href = source.href;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            anchor.className = `footer-social-media__link footer-social-media__link--${social.key}`;
            anchor.setAttribute('aria-label', social.label);
            anchor.textContent = social.symbol;
            container.appendChild(anchor);
        });

        const officeColumn = officeHeading?.parentElement;
        const locationLine = officeColumn && Array.from(officeColumn.querySelectorAll('p, div, span'))
            .find((element) => element.children.length === 0 && /^location:/i.test(element.textContent.trim()));
        if (locationLine) {
            locationLine.insertAdjacentElement('afterend', block);
        } else if (officeHeading) {
            officeHeading.parentElement.appendChild(block);
        } else {
            footer.appendChild(block);
        }
    };

    const socialLinksFrom = (documentToRead) => socialDefinitions.map((social) => {
        const anchor = Array.from(documentToRead.querySelectorAll('a')).find((link) =>
            link.textContent.toLowerCase().includes(social.key)
        );
        return { key: social.key, href: anchor?.href };
    });

    const addFooterSocials = async () => {
        const footer = document.querySelector('footer');
        if (!footer) return;
        let links = socialLinksFrom(document);
        if (links.filter((link) => link.href).length < socialDefinitions.length) {
            try {
                const response = await fetch('contact.html');
                if (response.ok) {
                    const contactPage = new DOMParser().parseFromString(await response.text(), 'text/html');
                    links = socialLinksFrom(contactPage);
                }
            } catch (error) {
                // The current page can still show any social links already available in its markup.
            }
        }
        createSocialBlock(footer, links);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addFooterSocials);
    else addFooterSocials();

    // Some pages create their footer after page scripts load.
    new MutationObserver(() => addFooterSocials()).observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
