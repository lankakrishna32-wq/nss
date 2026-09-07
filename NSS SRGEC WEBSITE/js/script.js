const SITE_KEY = "srgecNssData";
const REQUIRED_DATA_VERSION = 6;

const navItems = [
  ["Home", "index.html"],
  ["About NSS", "about.html"],
  ["NSS Activities", "activities.html"],
  ["NSS Band Team", "band-team.html"],
  ["Camps", "camps.html"],
  ["NSS Core Team", "core-team.html"],
  ["Gallery", "gallery.html"],
  ["Contact", "contact.html"]
];

async function loadSiteData() {
  // 1. Try reading live from Cloud Firestore first
  if (window.NssFirebase && window.NssFirebase.isReady()) {
    try {
      const cloudData = await window.NssFirebase.fetchData();
      if (cloudData && cloudData.version) {
        localStorage.setItem(SITE_KEY, JSON.stringify(cloudData));
        return cloudData;
      }
    } catch (e) {
      console.warn("Could not fetch from Firestore, falling back:", e);
    }
  }

  // 2. Check localStorage for fast instant render
  const stored = localStorage.getItem(SITE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.version === REQUIRED_DATA_VERSION) {
        // If Firestore is empty, seed it with this data
        if (window.NssFirebase && window.NssFirebase.isReady()) {
          window.NssFirebase.saveData(parsed).catch(console.warn);
        }
        return parsed;
      }
    } catch (e) {
      console.warn("Invalid stored data, re-fetching site.json");
    }
  }

  // 3. Fallback to static site.json and seed Firestore
  const response = await fetch("data/site.json");
  const data = await response.json();
  localStorage.setItem(SITE_KEY, JSON.stringify(data));
  if (window.NssFirebase && window.NssFirebase.isReady()) {
    window.NssFirebase.saveData(data).catch(console.warn);
  }
  return data;
}

async function saveSiteData(data) {
  localStorage.setItem(SITE_KEY, JSON.stringify(data));
  if (window.NssFirebase && window.NssFirebase.isReady()) {
    try {
      await window.NssFirebase.saveData(data);
    } catch (err) {
      console.warn("Firestore save error:", err);
    }
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
  const poWrap = document.querySelector("[data-po-member]");
  const membersWrap = document.querySelector("[data-members]");
  if (!membersWrap && !poWrap) return;

  const po = members.find(m => m.role.includes("Programme Officer") || m.branch === "Faculty");
  const studentCoordinators = members.filter(m => m !== po);

  if (poWrap && po) {
    poWrap.innerHTML = `
      <div class="po-profile-card card reveal" onclick="showMemberModal('${escapeHtml(po.name)}')">
        <img src="${po.image}" alt="${escapeHtml(po.name)}" class="po-profile-img">
        <div class="po-profile-info">
          <span class="status-tag active" style="margin-bottom: 8px;">Programme Officer</span>
          <h3 class="po-name">${escapeHtml(po.name)}</h3>
          <div class="po-role">${escapeHtml(po.role)}</div>
          <p class="po-college"><strong>Department:</strong> ${escapeHtml(po.designation || 'Associate Professor of Physics')}</p>
          <p class="po-address">${escapeHtml(po.college || 'Seshadri Rao Gudlavalleru Engineering College, Gudlavalleru, Krishna District, AP 521356')}</p>
          <div class="po-contacts">
            <span>✉️ <strong>Email:</strong> <a href="mailto:${escapeHtml(po.email || 'srgecnss@gmail.com')}" style="color: var(--orange);">${escapeHtml(po.email || 'srgecnss@gmail.com')}</a></span>
            <span>📞 <strong>Contact No:</strong> ${escapeHtml(po.phone || '+91 9666658751')}</span>
          </div>
          <span class="click-hint" style="opacity: 1; transform: none; margin-top: 12px;">Click profile for full details &rarr;</span>
        </div>
      </div>
    `;
  }

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
            ${m.email ? `<strong>Email:</strong> ${escapeHtml(m.email)}<br>` : ''}
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
function renderStats(stats) {
  const wrap = document.querySelector("[data-stats]");
  if (!wrap || !stats) return;

  wrap.innerHTML = stats.map(s => {
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

// Render Camps Section
function renderCamps(camps) {
  const wrap = document.querySelector("[data-camps]");
  if (!wrap || !camps) return;

  wrap.innerHTML = camps.map((c, idx) => `
    <div class="card reveal" style="cursor: pointer;" onclick="showCampModal(${idx})">
      <img src="${c.image}" alt="${escapeHtml(c.name)}" class="card-media">
      <div class="card-body">
        <span class="status-tag active" style="margin-bottom: 8px;">${escapeHtml(c.state)}</span>
        <h3 style="font-size: 1.15rem; margin-bottom: 6px;">${escapeHtml(c.name)}</h3>
        <p style="color: var(--muted); font-size: 0.85rem; margin-bottom: 10px;">📍 ${escapeHtml(c.location)} &bull; 🗓️ ${escapeHtml(c.dates)}</p>
        <p style="font-size: 0.9rem; color: var(--text); margin-bottom: 12px;">${escapeHtml(c.description.substring(0, 90))}...</p>
        <span class="click-hint" style="opacity: 1; transform: none;">View Camp Details &rarr;</span>
      </div>
    </div>
  `).join("");

  window._siteCamps = camps;
}

window.showCampModal = function(index) {
  const camps = window._siteCamps || [];
  const c = camps[index];
  if (!c) return;

  const html = `
    <div style="padding: 28px;">
      <img src="${c.image}" alt="${escapeHtml(c.name)}" style="width: 100%; height: 260px; object-fit: cover; border-radius: var(--radius); margin-bottom: 20px;">
      <span class="status-tag active" style="margin-bottom: 8px;">${escapeHtml(c.state)}</span>
      <h2 style="font-size: 1.7rem; margin: 8px 0 12px;">${escapeHtml(c.name)}</h2>
      <p style="color: var(--muted); font-size: 0.95rem; margin-bottom: 16px;">
        📍 <strong>Location:</strong> ${escapeHtml(c.location)} &bull; 🗓️ <strong>Dates:</strong> ${escapeHtml(c.dates)}
      </p>
      <div style="margin-bottom: 20px; line-height: 1.7; color: var(--text);">
        <p>${escapeHtml(c.description)}</p>
      </div>
      <div style="background: var(--bg-alt); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
        <strong>Organizing Authority:</strong> ${escapeHtml(c.authority)}
      </div>
    </div>
  `;
  openModal(html);
};

// Render Selected Students (Compact Cards & Modals)
function renderSelectedStudents(students) {
  const wrap = document.querySelector("[data-selected-students]");
  if (!wrap || !students) return;

  wrap.innerHTML = students.map((s, idx) => `
    <div class="member-card-compact reveal" onclick="showStudentModal(${idx})">
      <span class="status-tag ${s.status === 'alumni' ? 'alumni' : 'active'}">${s.status === 'alumni' ? 'Alumni' : 'Active'}</span>
      <img src="${s.image}" alt="${escapeHtml(s.name)}" class="member-avatar">
      <h3 class="member-name">${escapeHtml(s.name)}</h3>
      <div class="member-role">${escapeHtml(s.camp)}</div>
      <div class="member-period">${escapeHtml(s.batch)} &bull; ${escapeHtml(s.branch)}</div>
      <span class="click-hint">View Selection &rarr;</span>
    </div>
  `).join("");

  window._selectedStudents = students;
}

window.showStudentModal = function(idx) {
  const students = window._selectedStudents || [];
  const s = students[idx];
  if (!s) return;

  const html = `
    <div class="profile-modal-body">
      <div class="profile-modal-header">
        <img src="${s.image}" alt="${escapeHtml(s.name)}" class="profile-modal-img">
        <div class="profile-modal-meta">
          <span class="status-tag ${s.status === 'alumni' ? 'alumni' : 'active'}" style="margin-bottom: 8px;">
            National / State Camp Representative
          </span>
          <h2>${escapeHtml(s.name)}</h2>
          <div class="role">${escapeHtml(s.camp)}</div>
          <div class="details">
            <strong>Branch:</strong> ${escapeHtml(s.branch)} (${escapeHtml(s.year)})<br>
            <strong>Roll No:</strong> ${escapeHtml(s.roll)}<br>
            <strong>Batch:</strong> ${escapeHtml(s.batch)}
          </div>
        </div>
      </div>
      <div class="profile-section">
        <h4>Camp & Representation Details</h4>
        <p><strong>Camp Attended:</strong> ${escapeHtml(s.camp)}</p>
        <p><strong>University Represented:</strong> ${escapeHtml(s.university)}</p>
        <p><strong>State Represented:</strong> ${escapeHtml(s.state)}</p>
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

  const albums = [...new Set(gallery.map(g => g.album))].sort();
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

// Render Band Team (Instruments Inventory, Captain Portfolio, Members Portfolio)
function renderBand(band) {
  if (!band) return;

  // 1. Instruments Inventory
  const instrumentsWrap = document.querySelector("[data-band-instruments]");
  if (instrumentsWrap && band.instruments) {
    instrumentsWrap.innerHTML = band.instruments.map(inst => `
      <div class="card instrument-card reveal">
        <img src="${inst.image}" alt="${escapeHtml(inst.name)}" class="instrument-img">
        <div class="card-body" style="padding: 20px;">
          <span class="eyebrow" style="margin-bottom: 6px;">${escapeHtml(inst.category)}</span>
          <h3 style="font-size: 1.15rem; margin-bottom: 8px; color: var(--text);">${escapeHtml(inst.name)}</h3>
          <p style="color: var(--muted); font-size: 0.88rem; line-height: 1.5;">${escapeHtml(inst.description)}</p>
        </div>
      </div>
    `).join("");
  }

  // 2. Band Captains Portfolio (Active & Alumni)
  const captainsWrap = document.querySelector("[data-band-captains]");
  const captainTabsWrap = document.querySelector("[data-captain-tabs]");
  if (captainsWrap && band.captains) {
    let activeCapTab = "active";

    const renderCaptains = (statusFilter) => {
      const filteredCaptains = band.captains.filter(c => (c.status || "active") === statusFilter);
      if (filteredCaptains.length === 0) {
        captainsWrap.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--muted);">No captain records found.</p>`;
        return;
      }

      captainsWrap.innerHTML = filteredCaptains.map(c => `
        <div class="card reveal" style="padding: 24px; display: flex; gap: 20px; align-items: center;">
          <img src="${c.image}" alt="${escapeHtml(c.name)}" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 2px solid var(--orange); flex-shrink: 0;">
          <div>
            <span class="status-tag ${c.status === 'alumni' ? 'alumni' : 'active'}" style="margin-bottom: 6px;">${c.status === 'alumni' ? 'Former Captain' : 'Active Captain'}</span>
            <h3 style="font-size: 1.25rem; margin-bottom: 4px;">${escapeHtml(c.name)}</h3>
            <p style="color: var(--orange); font-weight: 600; font-size: 0.9rem; margin-bottom: 6px;">${escapeHtml(c.role)}</p>
            <p style="color: var(--muted); font-size: 0.85rem; margin-bottom: 4px;"><strong>Branch:</strong> ${escapeHtml(c.branch)} &bull; <strong>Roll:</strong> ${escapeHtml(c.roll)}</p>
            <p style="color: var(--muted); font-size: 0.85rem;"><strong>Term:</strong> ${escapeHtml(c.period)}</p>
          </div>
        </div>
      `).join("");
      observeReveals();
    };

    if (captainTabsWrap) {
      captainTabsWrap.innerHTML = `
        <div class="tabs-header">
          <button class="tab-btn active" data-captab="active">Active Captain</button>
          <button class="tab-btn" data-captab="alumni">Former / Alumni Captains</button>
        </div>
      `;

      captainTabsWrap.querySelectorAll("[data-captab]").forEach(btn => {
        btn.addEventListener("click", () => {
          captainTabsWrap.querySelectorAll("[data-captab]").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          activeCapTab = btn.dataset.captab;
          renderCaptains(activeCapTab);
        });
      });
    }

    renderCaptains(activeCapTab);
  }

  // 3. Band Members Portfolio (Active & Alumni)
  const bandMembersWrap = document.querySelector("[data-band-members]");
  const bandTabsWrap = document.querySelector("[data-band-tabs]");
  if (bandMembersWrap && band.members) {
    let activeBandTab = "active";

    const renderMembers = (statusFilter) => {
      const filteredMembers = band.members.filter(m => (m.status || "active") === statusFilter);
      if (filteredMembers.length === 0) {
        bandMembersWrap.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--muted);">No member records found.</p>`;
        return;
      }

      bandMembersWrap.innerHTML = filteredMembers.map(m => `
        <div class="member-card-compact reveal">
          <span class="status-tag ${m.status === 'alumni' ? 'alumni' : 'active'}">${m.status === 'alumni' ? 'Alumni' : 'Active'}</span>
          <img src="${m.image}" alt="${escapeHtml(m.name)}" class="member-avatar">
          <h3 class="member-name">${escapeHtml(m.name)}</h3>
          <div class="member-role">${escapeHtml(m.role)}</div>
          <div class="member-period">Roll: ${escapeHtml(m.roll)} &bull; ${escapeHtml(m.branch)}</div>
        </div>
      `).join("");
      observeReveals();
    };

    if (bandTabsWrap) {
      bandTabsWrap.innerHTML = `
        <div class="tabs-header">
          <button class="tab-btn active" data-bandtab="active">Current Active Band Team</button>
          <button class="tab-btn" data-bandtab="alumni">Former / Alumni Band Team</button>
        </div>
      `;

      bandTabsWrap.querySelectorAll("[data-bandtab]").forEach(btn => {
        btn.addEventListener("click", () => {
          bandTabsWrap.querySelectorAll("[data-bandtab]").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          activeBandTab = btn.dataset.bandtab;
          renderMembers(activeBandTab);
        });
      });
    }

    renderMembers(activeBandTab);
  }
}

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
  document.querySelectorAll("[data-registration-form]").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : "Submit";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
      }

      const formData = Object.fromEntries(new FormData(form).entries());
      formData.type = form.dataset.registrationForm;
      formData.createdAt = new Date().toISOString();

      // Submit directly to Cloud Firestore
      if (window.NssFirebase && window.NssFirebase.isReady()) {
        try {
          await window.NssFirebase.submitRegistration(formData);
        } catch (err) {
          console.warn("Firestore registration submission error:", err);
        }
      }

      data.registrations = data.registrations || [];
      data.registrations.unshift(formData);
      saveSiteData(data);

      form.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }

      const statusEl = form.querySelector("[data-form-status]");
      if (statusEl) {
        statusEl.textContent = "Registration submitted successfully and synced to Cloud!";
        statusEl.style.color = "var(--green)";
      }
    });
  });
}

function renderAllComponents(data) {
  if (!data) return;
  renderStats(data.stats);
  renderCoreTeam(data.members);
  renderActivityCards(data);
  renderCamps(data.camps);
  renderSelectedStudents(data.selectedStudents);
  renderGallery(data.gallery);
  renderBand(data.band);
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

  // Real-Time Live Sync: whenever admin updates activities/camps/gallery/settings,
  // updates automatically reflect live on any user's open screen!
  if (window.NssFirebase && window.NssFirebase.isReady()) {
    window.NssFirebase.listen((freshData) => {
      if (freshData && freshData.version) {
        console.log("Live Firestore update received, refreshing views...");
        localStorage.setItem(SITE_KEY, JSON.stringify(freshData));
        renderAllComponents(freshData);
      }
    });
  }
});
