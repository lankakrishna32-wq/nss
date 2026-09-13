const ADMIN_KEY = "srgecNssAdmin";
const DATA_KEY = "srgecNssData";
const REQUIRED_DATA_VERSION = 6;

// Admin Credentials
const validCredentials = [
  { username: "admin", password: "srgec@nss2026" },
  { username: "admin", password: "nss@srgec" },
  { username: "srgecnss", password: "srgec@nss2026" }
];

function showSyncBadge(message, isSuccess) {
  let badge = document.getElementById("admin-sync-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "admin-sync-badge";
    badge.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;padding:8px 16px;border-radius:20px;font-size:0.85rem;font-weight:600;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:all 0.3s ease;pointer-events:none;";
    document.body.appendChild(badge);
  }

  if (isSuccess === true) {
    badge.style.background = "rgba(34, 197, 94, 0.25)";
    badge.style.border = "1px solid #22c55e";
    badge.style.color = "#4ade80";
  } else if (isSuccess === false) {
    badge.style.background = "rgba(239, 68, 68, 0.25)";
    badge.style.border = "1px solid #ef4444";
    badge.style.color = "#f87171";
  } else {
    badge.style.background = "rgba(245, 130, 32, 0.25)";
    badge.style.border = "1px solid #f58220";
    badge.style.color = "#fb923c";
  }
  badge.innerHTML = message;
}

async function getData() {

  // 1. Try loading live data from Node.js + MongoDB
  try {
    const response = await fetch("/api/site");

    if (response.ok) {
      const result = await response.json();

      if (result.success && result.data && result.data.version) {

        localStorage.setItem(
          DATA_KEY,
          JSON.stringify(result.data)
        );

        showSyncBadge(
          "🟢 Live & Synced with MongoDB",
          true
        );

        return result.data;
      }
    }

    console.warn(
      "Could not fetch from Node.js, falling back..."
    );

  } catch (e) {

    console.warn(
      "Node.js server unavailable, falling back:",
      e
    );
  }


  // 2. Check localStorage
  const stored = localStorage.getItem(DATA_KEY);

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


  // 3. Final fallback to site.json
  const response = await fetch("/data/site.json");
  const data = await response.json();

  localStorage.setItem(
    DATA_KEY,
    JSON.stringify(data)
  );

  return data;
}


async function saveData(data) {

  // Immediately update localStorage
  localStorage.setItem(
    DATA_KEY,
    JSON.stringify(data)
  );

  // Save to Node.js + MongoDB
  showSyncBadge(
    "💾 Saving to MongoDB...",
    null
  );

  try {

    const response = await fetch("/api/site", {
      method: "PUT",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(data)
    });


    const result = await response.json();


    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "MongoDB save failed"
      );
    }


    showSyncBadge(
      "🟢 Saved & Synced with MongoDB",
      true
    );

  } catch (err) {

    console.error(
      "MongoDB save error:",
      err
    );

    showSyncBadge(
      "⚠️ MongoDB Sync Failed (Saved Locally)",
      false
    );

    throw err;
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

function guard() {
  const path = location.pathname.toLowerCase();
  const isLoginPage = path.includes("login") || path.endsWith("/admin") || path.endsWith("/admin/");
  const isLoggedIn = localStorage.getItem(ADMIN_KEY) === "true";
  if (!isLoggedIn && !isLoginPage) {
    location.replace("/admin/login.html");
  }
}

function initAdminNav() {
  const path = location.pathname.toLowerCase();
  const currentFile = path.split("/").pop().replace(".html", "") || "dashboard";

  document.querySelectorAll("[data-admin-nav] a").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    const hrefFile = href.split("/").pop().replace(".html", "");
    if (currentFile === hrefFile) {
      a.classList.add("active");
    } else {
      a.classList.remove("active");
    }
  });

  document.querySelectorAll("[data-logout]").forEach(btn => {
    btn.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_KEY);
      location.href = "/admin/login.html";
    });
  });
}

function initLogin() {
  const form = document.querySelector("[data-login]");
  if (!form) return;

  // If already logged in, go to dashboard
  if (localStorage.getItem(ADMIN_KEY) === "true") {
    location.href = "/admin/dashboard.html";
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    const user = (fields.get("username") || "").trim();
    const pass = (fields.get("password") || "").trim();

    const match = validCredentials.some(c => c.username === user && c.password === pass);

    if (match) {
      localStorage.setItem(ADMIN_KEY, "true");
      location.href = "/admin/dashboard.html";
    } else {
      const err = document.querySelector("[data-login-error]");
      if (err) err.textContent = "Invalid User ID or Password. Please try again.";
    }
  });
}

async function loadRegistrations() {
  const registrations = document.querySelector(
    "[data-registration-table]"
  );

  if (!registrations) return;

  try {
    const response = await fetch("/api/registrations");

    if (!response.ok) {
      throw new Error("Failed to fetch registrations");
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error(
        result.message || "Failed to load registrations"
      );
    }

    if (result.data.length === 0) {
      registrations.innerHTML =
        '<div class="card card-body" style="text-align:center;color:var(--muted);padding:32px"><p>No volunteer registrations received yet.</p></div>';
    } else {
      registrations.innerHTML = makeTable(
        result.data,
        ["type", "name", "roll", "branch", "createdAt"],
        false
      );
    }
  } catch (error) {
    console.error("Failed to load registrations:", error);

    registrations.innerHTML =
      '<div class="card card-body" style="text-align:center;color:#ef4444;padding:32px"><p>Could not load volunteer registrations.</p></div>';
  }
}

function fillOverview(data) {
  const wrap = document.querySelector("[data-admin-stats]");
  const roles = document.querySelector("[data-admin-roles]");

  if (wrap) {
    const captainCount = (data.band && data.band.captains) ? data.band.captains.length : 2;
    const bandCount = (data.band && data.band.members) ? data.band.members.length : 8;
    const cards = [
      ["Volunteers Count", data.stats && data.stats[0] ? data.stats[0].value : 240],
      ["Total Activities", data.activities ? data.activities.length : 0],
      ["National Camps", data.camps ? data.camps.length : 0],
      ["Band Captains", captainCount],
      ["Band Members", bandCount],
      ["Gallery Items", data.gallery ? data.gallery.length : 0]
    ];
    wrap.innerHTML = cards.map(function(item) {
      return '<article class="stat-card"><div class="stat-value">' + item[1] + '</div><div class="stat-label">' + item[0] + '</div></article>';
    }).join("");
  }

  if (roles) {
    var rolesArr = data.roles || [];
    roles.innerHTML = rolesArr.map(function(role) {
      return '<article class="card card-body"><h3 style="color:var(--orange);font-size:1.1rem;margin-bottom:6px">' + escapeHtml(role.name) + '</h3><p style="color:var(--muted);font-size:0.85rem;line-height:1.5">' + escapeHtml(role.scope) + '</p></article>';
    }).join("");
  }
}

function managerFields(type) {
  if (type === "activities") return ["title", "description", "date", "location", "category", "volunteers", "organizers", "image"];
  if (type === "camps") return ["name", "description", "dates", "location", "state", "authority", "image"];
  if (type === "members") return ["name", "role", "branch", "roll", "period", "status", "bio", "image"];
  if (type === "band-captains" || type === "captains") return ["name", "role", "branch", "roll", "period", "status", "bio", "image"];
  if (type === "band" || type === "band-members") return ["name", "role", "branch", "roll", "status", "image"];
  return ["title", "type", "year", "album", "image"];
}

function makeInput(field, value) {
  value = value || "";
  var label = field.replace(/([A-Z])/g, " $1");
  var isLong = (field === "description" || field === "bio" || field === "achievements" || field === "camps" || field === "tags");

  if (field === "status") {
    var val = value || "active";
    return '<label>Status<select class="input" name="status"><option value="active"' + (val === "active" ? " selected" : "") + '>Active</option><option value="alumni"' + (val === "alumni" ? " selected" : "") + '>Alumni / Former</option></select></label>';
  }

  if (field === "category") {
    var catVal = value || "Health";
    return '<label>Category<select class="input" name="category">' +
      '<option value="Health"' + (catVal === "Health" ? " selected" : "") + '>Health & Blood Donation</option>' +
      '<option value="Environment"' + (catVal === "Environment" ? " selected" : "") + '>Environment & Greenery</option>' +
      '<option value="Cleanliness"' + (catVal === "Cleanliness" ? " selected" : "") + '>Cleanliness & Swachh Bharat</option>' +
      '<option value="Awareness"' + (catVal === "Awareness" ? " selected" : "") + '>Awareness & Rally</option>' +
      '<option value="Education"' + (catVal === "Education" ? " selected" : "") + '>Education & Outreach</option>' +
      '</select></label>';
  }

  if (isLong) {
    var textVal = Array.isArray(value) ? value.join(", ") : value;
    return '<label>' + label + '<textarea class="input" name="' + field + '" rows="3">' + escapeHtml(textVal) + '</textarea></label>';
  }

  var inputType = "text";
  if (field === "date") inputType = "date";
  if (field === "volunteers" || field === "year") inputType = "number";
  var placeholder = "";
  if (field === "period") placeholder = ' placeholder="e.g. 2024 - 2026"';
  if (field === "role") placeholder = ' placeholder="e.g. NSS Band Captain (Active) or Side Drum Lead"';
  return '<label>' + label + '<input class="input" name="' + field + '" type="' + inputType + '" value="' + escapeHtml(value) + '"' + placeholder + '></label>';
}

function normalizeItem(type, item) {
  if (type === "activities") {
    item.tags = String(item.tags || item.category).split(",").map(function(tag) { return tag.trim(); }).filter(Boolean);
    if (item.date) {
      try {
        item.month = new Date(item.date).toLocaleString("en-IN", { month: "long" });
        item.year = String(new Date(item.date).getFullYear());
      } catch(e) {}
    }
  }
  return item;
}

function makeTable(list, fields, actions) {
  if (actions === undefined) actions = true;
  if (!list || !list.length) return '<div class="card card-body" style="text-align:center;color:var(--muted);padding:32px"><p>No records found. Use the form to add new entries.</p></div>';

  var html = '<table><thead><tr>';
  for (var i = 0; i < fields.length; i++) {
    html += '<th>' + fields[i] + '</th>';
  }
  if (actions) html += '<th>Action</th>';
  html += '</tr></thead><tbody>';

  for (var j = 0; j < list.length; j++) {
    html += '<tr>';
    for (var k = 0; k < fields.length; k++) {
      var cellVal = list[j][fields[k]];
      if (Array.isArray(cellVal)) cellVal = cellVal.join(", ");
      html += '<td>' + escapeHtml(cellVal || "") + '</td>';
    }
    if (actions) {
      html += '<td><div style="display:flex;gap:6px"><button class="btn ghost" data-edit="' + j + '">Edit</button><button class="btn ghost" data-delete="' + j + '" style="color:#ef4444;border-color:rgba(239,68,68,0.4)">Del</button></div></td>';
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function renderManager(data, type, editIndex) {
  if (editIndex === undefined) editIndex = null;

  var table = document.querySelector("[data-manager-table]");
  var form = document.querySelector("[data-manager-form]");
  if (!table || !form || !type) return;

  var fields = managerFields(type);
  var list;
  var entityName;

  data.band = data.band || {};
  data.band.captains = data.band.captains || [];
  data.band.members = data.band.members || [];

  if (type === "band-captains" || type === "captains") {
    list = data.band.captains;
    entityName = "Band Captain";
  } else if (type === "band" || type === "band-members") {
    list = data.band.members;
    entityName = "Band Member";
  } else {
    list = data[type] || [];
    entityName = type.slice(0, -1);
  }

  var current = (editIndex === null) ? {} : (list[editIndex] || {});

  var formHtml = '<h2>' + (editIndex === null ? "Add New" : "Edit") + ' ' + entityName + '</h2>';
  for (var i = 0; i < fields.length; i++) {
    formHtml += makeInput(fields[i], current[fields[i]]);
  }
  formHtml += '<label>Upload image<input class="input" name="upload" type="file" accept="image/*"></label>';
  formHtml += '<div class="actions"><button class="btn orange" type="submit">' + (editIndex === null ? "Add " + entityName : "Save Changes") + '</button>';
  if (editIndex !== null) {
    formHtml += '<button class="btn ghost" type="button" data-cancel-edit>Cancel</button>';
  }
  formHtml += '</div>';
  formHtml += '<p class="meta">⚡ Changes automatically sync in real-time to Cloud Firestore for all website visitors.</p>';

  form.innerHTML = formHtml;
  table.innerHTML = makeTable(list, fields.slice(0, 4));

  form.onsubmit = function(event) {
    event.preventDefault();

    var submitBtn = form.querySelector('button[type="submit"]');
    var originalText = submitBtn ? submitBtn.textContent : "Save";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving & Syncing...";
    }

    var formData = new FormData(form);
    var item = {};

    formData.forEach(function(value, key) {
      if (key !== "upload") {
        item[key] = value;
      }
    });

    item = normalizeItem(type, item);

    var fileInput = form.querySelector('input[name="upload"]');
    var file = fileInput && fileInput.files
      ? fileInput.files[0]
      : null;

    function proceed(finalImage) {

      if (finalImage) {
        item.image = finalImage;
      } else if (!item.image && editIndex !== null) {
        item.image = current.image;
      }

      finishSave(data, type, list, item, editIndex)
        .finally(function() {

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }

        });
    }

    function compressImage(file) {

      return new Promise(function(resolve, reject) {

        var reader = new FileReader();

        reader.onload = function(event) {

          var img = new Image();

          img.onload = function() {

            var maxSize = 1200;

            var width = img.width;
            var height = img.height;

            if (width > maxSize || height > maxSize) {

              if (width > height) {

                height = Math.round(height * maxSize / width);
                width = maxSize;

              } else {

                width = Math.round(width * maxSize / height);
                height = maxSize;

              }
            }

            var canvas = document.createElement("canvas");

            canvas.width = width;
            canvas.height = height;

            var ctx = canvas.getContext("2d");

            ctx.drawImage(
              img,
              0,
              0,
              width,
              height
            );

            var compressedImage =
              canvas.toDataURL("image/jpeg", 0.75);

            resolve(compressedImage);
          };

          img.onerror = function() {
            reject(new Error("Could not load image"));
          };

          img.src = event.target.result;
        };

        reader.onerror = function() {
          reject(new Error("Could not read image"));
        };

        reader.readAsDataURL(file);
      });
    }


    // Process uploaded image
    if (file) {

      showSyncBadge(
        "🖼️ Optimizing uploaded image...",
        null
      );

      compressImage(file)
        .then(function(compressed) {

          proceed(compressed);

        })
        .catch(function(err) {

          console.warn(
            "Image compression failed:",
            err
          );

          // Fallback: use original image
          var reader = new FileReader();

          reader.onload = function() {
            proceed(reader.result);
          };

          reader.readAsDataURL(file);
        });

    } else {

      // No new image selected
      proceed(null);

    }

  };

  var cancelBtn = form.querySelector("[data-cancel-edit]");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function() { renderManager(data, type); });
  }

  var editBtns = table.querySelectorAll("[data-edit]");
  for (var e = 0; e < editBtns.length; e++) {
    (function(btn) {
      btn.addEventListener("click", function() {
        renderManager(data, type, Number(btn.getAttribute("data-edit")));
      });
    })(editBtns[e]);
  }

  var delBtns = table.querySelectorAll("[data-delete]");
  for (var d = 0; d < delBtns.length; d++) {
    (function(btn) {
      btn.addEventListener("click", function() {
        if (confirm("Are you sure you want to delete this " + entityName + "?")) {
          list.splice(Number(btn.getAttribute("data-delete")), 1);
          if (type === "band-captains" || type === "captains") {
            data.band.captains = list;
          } else if (type === "band" || type === "band-members") {
            data.band.members = list;
          }
          saveData(data).then(function() {
            renderManager(data, type);
          });
        }
      });
    })(delBtns[d]);
  }
}

async function finishSave(data, type, list, item, editIndex) {
  if (editIndex === null) {
    list.unshift(item);
  } else {
    list[editIndex] = item;
  }
  if (type === "band-captains" || type === "captains") {
    data.band = data.band || {};
    data.band.captains = list;
  } else if (type === "band" || type === "band-members") {
    data.band = data.band || {};
    data.band.members = list;
  }
  await saveData(data);
  renderManager(data, type);
}

function initSettings(data) {
  var form = document.querySelector("[data-settings]");
  if (!form) return;

  if (form.announcements) form.announcements.value = (data.announcements || []).join("\n");
  if (form.events) form.events.value = (data.events || []).map(function(ev) {
    return (ev.date || "") + "|" + (ev.title || "") + "|" + (ev.type || "") + "|" + (ev.venue || "");
  }).join("\n");
  if (form.established) form.established.value = (data.home && data.home.established) || "";
  if (form.year) form.year.value = (data.home && data.home.year) || "";
  if (form.firstOfficer) form.firstOfficer.value = (data.home && data.home.firstOfficer) || "";
  if (form.facultyCoordinator) form.facultyCoordinator.value = (data.home && data.home.facultyCoordinator) || "DR. V. Naveen Kumar";
  if (form.email) form.email.value = (data.contact && data.contact.email) || "srgecnss@gmail.com";
  if (form.phone) form.phone.value = (data.contact && data.contact.phone) || "+91 9666658751";
  if (form.address) form.address.value = (data.contact && data.contact.address) || "";

  form.addEventListener("submit", function(event) {
    event.preventDefault();
    data.announcements = form.announcements.value.split("\n").map(function(s) { return s.trim(); }).filter(Boolean);
    data.events = form.events.value.split("\n").map(function(line) {
      var parts = line.split("|");
      return {
        date: (parts[0] || "").trim(),
        title: (parts[1] || "").trim(),
        type: (parts[2] || "").trim(),
        venue: (parts[3] || "").trim()
      };
    }).filter(function(ev) { return ev.date && ev.title; });

    data.home = data.home || {};
    data.home.established = form.established.value;
    data.home.year = form.year.value;
    data.home.firstOfficer = form.firstOfficer.value;
    data.home.facultyCoordinator = form.facultyCoordinator.value;

    data.contact = data.contact || {};
    data.contact.email = form.email.value;
    data.contact.phone = form.phone.value;
    data.contact.address = form.address.value;

    saveData(data).then(function() {
      var status = document.querySelector("[data-save-status]");
      if (status) {
        status.textContent = "Settings saved and synced with Cloud Firestore for all users!";
        setTimeout(function() { status.textContent = ""; }, 4000);
      }
    });
  });

  // Force MongoDB Sync Button
  var cloudSyncBtn = document.getElementById("btn-cloud-sync");

  if (cloudSyncBtn) {
    cloudSyncBtn.addEventListener("click", async function() {

      cloudSyncBtn.disabled = true;

      var originalHtml = cloudSyncBtn.innerHTML;

      cloudSyncBtn.textContent = "Syncing with MongoDB...";

      try {

        await saveData(data);

        alert(
          "Success! All website data has been synced to MongoDB. Any visitor or device will now see the latest updates."
        );

        showSyncBadge(
          "🟢 Live & Synced for All Users",
          true
        );

      } catch (err) {

        alert(
          "MongoDB sync failed: " + err.message
        );

        showSyncBadge(
          "⚠️ MongoDB Sync Error",
          false
        );

      } finally {

        cloudSyncBtn.disabled = false;

        cloudSyncBtn.innerHTML = originalHtml;

      }

    });
  }

  // Export JSON
  var exportBtn = document.getElementById("btn-export-data");
  if (exportBtn) {
    exportBtn.addEventListener("click", function() {
      var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      var a = document.createElement("a");
      a.setAttribute("href", dataStr);
      a.setAttribute("download", "srgec-nss-data-" + new Date().toISOString().slice(0, 10) + ".json");
      a.click();
    });
  }

  // Import JSON
  var importInput = document.getElementById("file-import-data");
  if (importInput) {
    importInput.addEventListener("change", function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var imported = JSON.parse(ev.target.result);
          if (imported) {
            saveData(imported).then(function() {
              var st = document.getElementById("import-status");
              if (st) {
                st.textContent = "Data imported & synced with Cloud! Reloading...";
                st.style.color = "var(--green)";
              }
              setTimeout(function() { location.reload(); }, 1200);
            });
          }
        } catch (err) {
          alert("Invalid JSON file. Please upload a valid site.json backup.");
        }
      };
      reader.readAsText(file);
    });
  }
}

function initReset() {
  var btns = document.querySelectorAll("[data-reset-demo]");
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener("click", function() {
      if (confirm("Reset all data to original defaults?")) {
        localStorage.removeItem(DATA_KEY);
        location.reload();
      }
    });
  }
}

// Main initialization
document.addEventListener("DOMContentLoaded", function() {
  guard();
  initLogin();
  initAdminNav();

  var path = location.pathname.toLowerCase();
  if (path.includes("login")) return;

  getData().then(function(data) {
    fillOverview(data);
    loadRegistrations();
    var manager = document.body.getAttribute("data-manager");
    if (manager) renderManager(data, manager);
    initSettings(data);
    initReset();
  }).catch(function(err) {
    console.error("Failed to load site data:", err);
    var main = document.querySelector(".admin-main");
    if (main) {
      main.innerHTML += '<div class="card card-body" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);padding:24px;margin-top:16px"><h3 style="color:#ef4444">Data Load Error</h3><p style="color:var(--muted)">Could not load site.json. Try clearing browser cache and reloading.</p><button class="btn ghost" onclick="localStorage.removeItem(\'srgecNssData\');location.reload()">Clear Cache & Reload</button></div>';
    }
  });
});
