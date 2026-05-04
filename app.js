/* ─────────────────────────────────────────
   DATA
───────────────────────────────────────── */
const STORAGE_KEY = "mealPreferenceResponses";

/* All possible meal segments */
const ALL_SEGMENTS = [
  { label: "Veg \u2013 Starters",                    icon: "fa-leaf",           cls: "veg",     color: "#16a34a", bg: "#bbf7d0", type: "veg"    },
  { label: "Non-Veg \u2013 Starters",                icon: "fa-drumstick-bite", cls: "nonveg",  color: "#dc2626", bg: "#fecaca", type: "nonveg" },
  { label: "Veg \u2013 Curries, Gravies & More",      icon: "fa-seedling",       cls: "veg",     color: "#15803d", bg: "#86efac", type: "veg"    },
  { label: "Non-Veg \u2013 Curries, Gravies & More",  icon: "fa-burger",         cls: "nonveg",  color: "#b91c1c", bg: "#fca5a5", type: "nonveg" },
  { label: "Dessert and Salad",                     icon: "fa-ice-cream",      cls: "dessert", color: "#d97706", bg: "#fde68a", type: "both"   },
  { label: "Roti, Parathas & more",                icon: "fa-bread-slice",    cls: "veg",     color: "#b45309", bg: "#fef3c7", type: "both"   },
  { label: "Rice, Biryani's & more",                icon: "fa-bowl-rice",      cls: "nonveg",  color: "#7c3aed", bg: "#ede9fe", type: "both"   },
];

/* Segment colour pairs for canvas drawing */
const ALL_SEG_COLORS = [
  ["#00f593", "#00a65e"],
  ["#ff4d4d", "#cc0000"],
  ["#38bdf8", "#0369a1"],
  ["#ff7a00", "#cc5200"],
  ["#ffe033", "#e6a800"],
  ["#f472b6", "#be185d"],
  ["#a855f7", "#6b21a8"],
];

/* Active segments shown on the wheel (set by selectPreference) */
let MEAL_OPTIONS = [...ALL_SEGMENTS];
let SEG_COLORS   = [...ALL_SEG_COLORS];

/* Current food preference: 'veg' | 'nonveg' | 'both' | '' */
let foodPref = "";

/* ─────────────────────────────────────────
   DYNAMIC QUOTA SYSTEM
   Quota per segment = total responses for that pref ÷ number of segments
   Recalculated live before every spin from saved responses.
───────────────────────────────────────── */
function getDynamicQuotas(pref) {
  const responses = getResponses();
  const segs = pref === "veg"
    ? ALL_SEGMENTS.filter(s => s.type === "veg"    || s.type === "both")
    : ALL_SEGMENTS.filter(s => s.type === "nonveg" || s.type === "both");

  // Count how many people have already responded for this preference
  const prefLabels = segs.map(s => s.label);
  // +1 to include the current person about to spin
  const totalForPref = responses.filter(r => prefLabels.includes(r.meal)).length + 1;

  const n    = segs.length;
  const base = Math.floor(totalForPref / n);
  const rem  = totalForPref % n;
  // Distribute remainder across first segments
  return segs.map((s, i) => ({ label: s.label, quota: i < rem ? base + 1 : base }));
}

/* Returns the index within MEAL_OPTIONS to land on,
   skipping any segment whose quota is already full.
   Wheel visually stays intact — only the result is controlled. */
function pickWeightedSegment() {
  const quotas    = getDynamicQuotas(foodPref);
  const responses = getResponses();

  const open = MEAL_OPTIONS
    .map((opt, idx) => {
      const q     = quotas.find(q => q.label === opt.label);
      const count = responses.filter(r => r.meal === opt.label).length;
      const full  = q ? count >= q.quota : false;
      return { idx, full };
    })
    .filter(a => !a.full);

  // Fallback: if somehow all are full, pick any segment
  const pool = open.length ? open : MEAL_OPTIONS.map((_, idx) => ({ idx }));
  return pool[Math.floor(Math.random() * pool.length)].idx;
}

const ADMIN_PASSWORD = "Senthil@123";
let pendingDeleteId  = null;   // stores the id waiting for password confirmation

const SPECIAL_GUESTS = ["romit", "ankit", "avanish", "anoop mp"];

/* ─────────────────────────────────────────
   SPINNER STATE
───────────────────────────────────────── */
/* NUM_SEG and ARC are computed dynamically from MEAL_OPTIONS */
function getNumSeg() { return MEAL_OPTIONS.length; }
function getArc()    { return (2 * Math.PI) / MEAL_OPTIONS.length; }

let currentAngle  = 0;
let isSpinning    = false;
let selectedIndex = -1;

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  spawnParticles();
  drawWheel(currentAngle);
  updateBadge();
  document.getElementById("shareLink").value = window.location.href;

  // Sync from JSONBin on load in background, render localStorage immediately
  renderResponses();
  updateBadge();
  syncFromBin().then(() => {
    renderResponses();
    updateBadge();
  });

  // Blue italic font for special guest names in dropdown
  document.querySelectorAll("#userName option").forEach(opt => {
    if (opt.value !== "" && isSpecialGuest(opt.value)) {
      opt.style.color = "#2563eb";
      opt.style.fontStyle = "italic";
    }
  });

  // Name dropdown change
  document.getElementById("userName").addEventListener("change", () => {
    const name = document.getElementById("userName").value.trim();
    hideSpecialGuestBanner();
    hidePrefStep();
    if (!name) {
      hideDuplicateBanner();
      return;
    }
    if (isSpecialGuest(name)) {
      showSpecialGuestBanner();
      hideDuplicateBanner();
      document.getElementById("stepWheel").style.display = "none";
    } else {
      if (!checkDuplicate(name)) {
        showPrefStep();
      }
    }
  });
});

/* ─────────────────────────────────────────
   HERO PARTICLES
───────────────────────────────────────── */
function spawnParticles() {
  const box = document.getElementById("heroParticles");
  if (!box) return;
  for (let i = 0; i < 22; i++) {
    const s = document.createElement("span");
    const sz = Math.random() * 6 + 3;
    s.style.cssText = [
      `width:${sz}px`, `height:${sz}px`,
      `left:${(Math.random()*100).toFixed(1)}%`,
      `top:${(Math.random()*100).toFixed(1)}%`,
      `animation-duration:${(Math.random()*4+3).toFixed(1)}s`,
      `animation-delay:${(Math.random()*4).toFixed(1)}s`,
    ].join(";");
    box.appendChild(s);
  }
}

/* ─────────────────────────────────────────
   DRAW WHEEL CANVAS
───────────────────────────────────────── */
function drawWheel(rotAngle) {
  const canvas = document.getElementById("wheelCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, R = W / 2 - 4;
  const numSeg = getNumSeg();
  const arc    = getArc();
  ctx.clearRect(0, 0, W, H);

  for (let i = 0; i < numSeg; i++) {
    const start = rotAngle + i * arc;
    const end   = start + arc;
    const [light, dark] = SEG_COLORS[i];

    const grad = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
    grad.addColorStop(0, light);
    grad.addColorStop(1, dark);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, start, end);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + arc / 2);
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle    = "#fff";
    ctx.shadowColor  = "rgba(0,0,0,0.4)";
    ctx.shadowBlur   = 4;
    const tR = R * 0.62;
    const parts = MEAL_OPTIONS[i].label.split(" \u2013 ");
    if (parts.length === 2) {
      ctx.font = "bold 11px Poppins,sans-serif";
      ctx.fillText(parts[0], tR, -16);
      // Split second part further if it contains a comma
      const subParts = parts[1].split(", ");
      if (subParts.length >= 2) {
        ctx.font = "600 11px Poppins,sans-serif";
        ctx.fillText(subParts[0] + ",", tR, -4);
        ctx.fillText(subParts.slice(1).join(", "), tR, 8);
      } else {
        ctx.font = "600 11px Poppins,sans-serif";
        ctx.fillText(parts[1], tR, -2);
      }
    } else {
      const w = MEAL_OPTIONS[i].label.split(" and ");
      const a = MEAL_OPTIONS[i].label.split(" & ");
      if (a.length >= 2) {
        ctx.font = "bold 11px Poppins,sans-serif";
        ctx.fillText(a[0], tR, -8);
        ctx.font = "600 11px Poppins,sans-serif";
        ctx.fillText("& " + a.slice(1).join(" & "), tR, 8);
      } else {
        ctx.font = "bold 11px Poppins,sans-serif";
        ctx.fillText(w[0] || MEAL_OPTIONS[i].label, tR, w[1] ? -8 : 0);
        if (w[1]) ctx.fillText("& " + w[1], tR, 8);
      }
    }
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.strokeStyle = "#1d4ed8";
  ctx.lineWidth   = 6;
  ctx.stroke();
}

/* ─────────────────────────────────────────
   FOOD PREFERENCE
───────────────────────────────────────── */
function showPrefStep() {
  foodPref = "";
  document.getElementById("stepPreference").style.display = "block";
  document.getElementById("stepWheel").style.display = "none";
  // Clear any previous selection
  document.querySelectorAll(".pref-card").forEach(c => c.classList.remove("selected"));
  clearErr("prefError");
}
function hidePrefStep() {
  document.getElementById("stepPreference").style.display = "none";
  document.getElementById("stepWheel").style.display = "none";
  foodPref = "";
  document.querySelectorAll(".pref-card").forEach(c => c.classList.remove("selected"));
}

function selectPreference(pref) {
  foodPref = pref;
  clearErr("prefError");

  // Highlight selected card
  document.querySelectorAll(".pref-card").forEach(c => c.classList.remove("selected"));
  const map = { veg: "prefVeg", nonveg: "prefNonveg" };
  document.getElementById(map[pref]).classList.add("selected");

  // Filter segments based on preference
  if (pref === "veg") {
    MEAL_OPTIONS = ALL_SEGMENTS.filter(s => s.type === "veg" || s.type === "both");
  } else {
    MEAL_OPTIONS = ALL_SEGMENTS.filter(s => s.type === "nonveg" || s.type === "both");
  }

  // Rebuild colour array to match filtered segments
  SEG_COLORS = MEAL_OPTIONS.map(opt => {
    const idx = ALL_SEGMENTS.findIndex(s => s.label === opt.label);
    return ALL_SEG_COLORS[idx];
  });

  // Reset wheel angle and show wheel
  currentAngle  = 0;
  selectedIndex = -1;
  document.getElementById("spinResult").style.display = "none";
  document.getElementById("stepWheel").style.display = "block";
  resetSpin();
  drawWheel(currentAngle);

  // Smooth scroll to wheel
  setTimeout(() => document.getElementById("stepWheel")
    .scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}

/* ─────────────────────────────────────────
   DUPLICATE CHECK
───────────────────────────────────────── */
function isDuplicate(name) {
  return getResponses().some(
    r => r.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
}

function checkDuplicate(name) {
  const existing = getResponses().find(
    r => r.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (existing) {
    showDuplicateBanner(existing);
    return true;
  }
  hideDuplicateBanner();
  return false;
}

function showDuplicateBanner(existing) {
  const banner = document.getElementById("alreadyBanner");
  const sub    = document.getElementById("alreadySub");
  sub.innerHTML = `You already selected <strong>${esc(existing.meal)}</strong>. Only one entry is allowed per person.`;
  banner.style.display = "flex";
  document.getElementById("spinBtn").disabled = true;
}

function hideDuplicateBanner() {
  document.getElementById("alreadyBanner").style.display = "none";
  document.getElementById("spinBtn").disabled = false;
}

/* ─────────────────────────────────────────
   SPECIAL GUEST HELPERS
───────────────────────────────────────── */
function isSpecialGuest(name) {
  return SPECIAL_GUESTS.includes(name.trim().toLowerCase());
}
function showSpecialGuestBanner() {
  const banner = document.getElementById("specialGuestBanner");
  banner.style.display = "flex";
  document.getElementById("spinBtn").disabled = true;
  spawnSgParticles();
  launchConfetti();
}
function hideSpecialGuestBanner() {
  document.getElementById("specialGuestBanner").style.display = "none";
  // Clear particles
  const p = document.getElementById("sgParticles");
  if (p) p.innerHTML = "";
  document.getElementById("stepWheel").style.display = "block";
  if (!document.getElementById("alreadyBanner").style.display ||
      document.getElementById("alreadyBanner").style.display === "none") {
    document.getElementById("spinBtn").disabled = false;
  }
}
function spawnSgParticles() {
  const container = document.getElementById("sgParticles");
  if (!container) return;
  container.innerHTML = "";
  const foods = ["\uD83C\uDF55","\uD83C\uDF54","\uD83C\uDF70","\uD83C\uDF57","\uD83E\uDD57","\uD83C\uDF72","\uD83C\uDF6F","\uD83E\uDD69","\uD83C\uDF71","\uD83C\uDF73"];
  for (let i = 0; i < 12; i++) {
    const s = document.createElement("span");
    s.textContent = foods[Math.floor(Math.random() * foods.length)];
    s.style.cssText = [
      `left:${(Math.random()*90+5).toFixed(1)}%`,
      `animation-duration:${(Math.random()*4+4).toFixed(1)}s`,
      `animation-delay:${(Math.random()*3).toFixed(1)}s`,
      `font-size:${(Math.random()*1+1).toFixed(1)}rem`,
    ].join(";");
    container.appendChild(s);
  }
}

/* ─────────────────────────────────────────
   SPIN THE WHEEL
───────────────────────────────────────── */
function spinWheel() {
  if (isSpinning) return;

  const name = document.getElementById("userName").value.trim();
  if (!name) {
    showErr("nameError");
    document.getElementById("userName").classList.add("error");
    document.getElementById("userName").focus();
    return;
  }
  clearErr("nameError");
    document.getElementById("userName").classList.remove("error");
  // Validate food preference
  if (!foodPref) {
    showErr("prefError");
    document.getElementById("stepPreference")
      .scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  clearErr("prefError");
  // Block duplicate entry
  if (checkDuplicate(name)) return;

  isSpinning    = true;
  selectedIndex = -1;
  document.getElementById("spinResult").style.display = "none";
  clearErr("mealError");

  const btn     = document.getElementById("spinBtn");
  const btnText = document.getElementById("spinBtnText");
  btn.disabled  = true;
  btn.classList.add("spinning");
  btnText.textContent = "Spinning\u2026";

  // Pick a quota-aware target segment (wheel stays full, result is controlled)
  const numSeg     = getNumSeg();
  const arc        = getArc();
  const targetSeg  = pickWeightedSegment();
  const extraSpins = (Math.floor(Math.random() * 6) + 5) * 2 * Math.PI;
  const segMid     = targetSeg * arc + arc / 2;
  const targetAngle = currentAngle + extraSpins + (2 * Math.PI - segMid - (Math.PI / 2) - currentAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

  const duration   = 4200 + Math.random() * 1400;
  const startAngle = currentAngle;
  const startTime  = performance.now();

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function frame(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const angle    = startAngle + (targetAngle - startAngle) * easeOut(progress);
    currentAngle   = angle;
    drawWheel(angle);
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      currentAngle  = angle % (2 * Math.PI);
      isSpinning    = false;
      selectedIndex = targetSeg;
      onSpinDone(targetSeg);
    }
  }
  requestAnimationFrame(frame);
}

/* ─────────────────────────────────────────
   SPIN DONE
───────────────────────────────────────── */
async function onSpinDone(idx) {
  const opt     = MEAL_OPTIONS[idx];
  const btn     = document.getElementById("spinBtn");
  const btnText = document.getElementById("spinBtnText");
  btn.classList.remove("spinning");
  btnText.textContent = "Spun!";
  btn.disabled = true;

  const resultEl = document.getElementById("spinResult");
  const iconEl   = document.getElementById("resultIcon");
  const valueEl  = document.getElementById("resultValue");
  iconEl.className    = `result-icon ${opt.cls}`;
  iconEl.innerHTML    = `<i class="fa-solid ${opt.icon}"></i>`;
  valueEl.textContent = opt.label;
  resultEl.style.display = "flex";

  // Save response instantly to localStorage, sync to JSONBin in background
  const name = document.getElementById("userName").value.trim();
  saveResponseRemote({ id: Date.now(), name, meal: opt.label, timestamp: new Date().toISOString() });
  updateBadge();
  showToast(`\uD83C\uDF89 Saved! ${name} \u2192 ${opt.label}`);

  // Lock the name field so it can't be changed after saving
  document.getElementById("userName").disabled = true;

  launchConfetti();
  setTimeout(() => {
    resetForm();
    showTab("responses");
  }, 3000);
}

/* ─────────────────────────────────────────
   RESET SPIN
───────────────────────────────────────── */
function resetSpin() {
  selectedIndex = -1;
  document.getElementById("spinResult").style.display = "none";
  clearErr("mealError");
  const btn = document.getElementById("spinBtn");
  btn.disabled = false;
  btn.classList.remove("spinning");
  document.getElementById("spinBtnText").textContent = "SPIN!";
}

/* ─────────────────────────────────────────
   CONFETTI
───────────────────────────────────────── */
function launchConfetti() {
  const colors = ["#1d4ed8","#fbbf24","#34d399","#f87171","#60a5fa","#f472b6"];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement("div");
    const sz = Math.random() * 10 + 5;
    el.style.cssText = `
      position:fixed; pointer-events:none; z-index:9998;
      top:${Math.random()*40+20}%;
      left:${Math.random()*100}%;
      width:${sz}px; height:${sz}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      border-radius:${Math.random()>.5?"50%":"2px"};
      opacity:1;
      transform:translateY(0) rotate(0deg);
      transition:transform ${(Math.random()*1.5+1).toFixed(2)}s ease-out,
                 opacity ${(Math.random()*1+1).toFixed(2)}s ease-out;
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translateY(${Math.random()*220+80}px) rotate(${Math.random()*720}deg)`;
      el.style.opacity   = "0";
    });
    setTimeout(() => el.remove(), 2600);
  }
}

/* ─────────────────────────────────────────
   TAB SWITCHING
───────────────────────────────────────── */
function showTab(tab) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));
  document.getElementById(tab + "Tab").classList.add("active");
  document.getElementById(tab + "TabBtn").classList.add("active");
  if (tab === "responses") {
    // Render from localStorage instantly, then sync from JSONBin in background
    renderResponses();
    updateBadge();
    syncFromBin().then(() => {
      renderResponses();
      updateBadge();
    });
  }
}

/* ─────────────────────────────────────────
   FORM SUBMIT (kept for internal reset use)
───────────────────────────────────────── */
function submitForm() {
  // No-op: saving is now done automatically in onSpinDone
}

/* ─────────────────────────────────────────
   JSONBIN.IO BACKEND
───────────────────────────────────────── */
const JSONBIN_BIN_ID  = "69f0fb38856a68218982e962";
const JSONBIN_API_KEY = "$2a$10$LH8doWOWM3rTXeAZH6B72.yrn6tsKHBtRi.jf0KX2wrM1iYDUCscO";
const JSONBIN_URL     = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

async function syncFromBin() {
  try {
    const res  = await fetch(`${JSONBIN_URL}/latest`, {
      headers: { "X-Access-Key": JSONBIN_API_KEY }
    });
    const data = await res.json();
    const responses = Array.isArray(data.record?.responses) ? data.record.responses : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(responses));
  } catch (err) {
    console.warn("Could not sync from JSONBin, using local cache.", err);
  }
}

async function saveToBin(responses) {
  try {
    await fetch(JSONBIN_URL, {
      method:  "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": JSONBIN_API_KEY
      },
      body: JSON.stringify({ responses })
    });
  } catch (err) {
    console.warn("Could not save to JSONBin, stored locally only.", err);
  }
}

async function saveResponseRemote(r) {
  // 1. Append to localStorage instantly
  const list = getResponses();
  list.push(r);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  // 2. Push directly to JSONBin — no GET needed
  saveToBin(list);
}

async function deleteResponseRemote(id) {
  const updated = getResponses().filter(r => Number(r.id) !== Number(id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  await saveToBin(updated);
}

async function clearAllRemote() {
  localStorage.removeItem(STORAGE_KEY);
  await saveToBin([]);
}

/* ─────────────────────────────────────────
   STORAGE
───────────────────────────────────────── */
function getResponses() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveResponse(r) {
  return saveResponseRemote(r);
}
function deleteResponse(id) {
  pendingDeleteId = Number(id);
  document.getElementById("adminPassword").value = "";
  document.getElementById("adminPassword").classList.remove("error");
  document.getElementById("adminError").classList.remove("visible");
  document.getElementById("adminModal").classList.add("open");
  setTimeout(() => document.getElementById("adminPassword").focus(), 100);
}

async function confirmAdminDelete() {
  const pw = document.getElementById("adminPassword").value;
  if (pw !== ADMIN_PASSWORD) {
    document.getElementById("adminError").classList.add("visible");
    document.getElementById("adminPassword").classList.add("error");
    document.getElementById("adminPassword").focus();
    return;
  }
  // Capture pendingDeleteId BEFORE closing modal (closeAdminModal nulls it)
  const targetId = pendingDeleteId;

  // Close modal
  document.getElementById("adminModal").classList.remove("open");
  document.getElementById("adminPassword").value = "";
  document.getElementById("adminPassword").classList.remove("error");
  document.getElementById("adminError").classList.remove("visible");
  pendingDeleteId = null;

  // Now perform the action
  if (targetId === "__CLEAR_ALL__") {
    await clearAllRemote();
    renderResponses();
    updateBadge();
    showToast("All responses cleared.");
  } else {
    await deleteResponseRemote(targetId);
    renderResponses();
    updateBadge();
    showToast("Response deleted.");
  }
}

function closeAdminModal(e) {
  if (!e || e.target === document.getElementById("adminModal")) {
    document.getElementById("adminModal").classList.remove("open");
    document.getElementById("adminPassword").value = "";
    document.getElementById("adminPassword").classList.remove("error");
    document.getElementById("adminError").classList.remove("visible");
    pendingDeleteId = null;
  }
}

function togglePasswordVisibility() {
  const input = document.getElementById("adminPassword");
  const icon  = document.getElementById("togglePwIcon");
  if (input.type === "password") {
    input.type  = "text";
    icon.className = "fa-solid fa-eye-slash";
  } else {
    input.type  = "password";
    icon.className = "fa-solid fa-eye";
  }
}
function clearResponses() {
  if (!getResponses().length) { showToast("No responses to clear."); return; }
  // Reuse admin modal for Clear All — store special sentinel
  pendingDeleteId = "__CLEAR_ALL__";
  document.getElementById("adminPassword").value = "";
  document.getElementById("adminError").classList.remove("visible");
  document.getElementById("adminModal").classList.add("open");
  setTimeout(() => document.getElementById("adminPassword").focus(), 100);
}

/* ─────────────────────────────────────────
   RENDER RESPONSES
───────────────────────────────────────── */
function getMeta(meal) {
  return ALL_SEGMENTS.find(o => o.label === meal) || { icon: "fa-utensils", cls: "dessert" };
}
function renderResponses() {
  const list    = getResponses();
  const tbody   = document.getElementById("responsesBody");
  const countEl = document.getElementById("responseCount");
  countEl.textContent = list.length
    ? `${list.length} response${list.length > 1 ? "s" : ""} collected.`
    : "No responses yet.";
  renderSummary(list);
  tbody.innerHTML = "";
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-inbox"></i><p>No responses yet. Share the form with your team!</p></td></tr>`;
    return;
  }
  [...list].reverse().forEach((r, i) => {
    const m   = getMeta(r.meal);
    const d   = new Date(r.timestamp);
    const fmt = d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
              + " \u00b7 " + d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
    const tr  = document.createElement("tr");
    tr.innerHTML = `
      <td>${list.length - i}</td>
      <td class="name-cell"><i class="fa-solid fa-user" style="color:#c4b5fd;margin-right:7px"></i>${esc(r.name)}</td>
      <td><span class="meal-pill ${m.cls}"><i class="fa-solid ${m.icon}"></i> ${esc(r.meal)}</span></td>
      <td class="time-cell">${fmt}</td>
      <td><button class="delete-row-btn" onclick="deleteResponse(${r.id})"><i class="fa-solid fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
  });
}
function renderSummary(list) {
  const grid = document.getElementById("summaryGrid");
  grid.innerHTML = "";
  if (!list.length) return;
  const counts = {};
  ALL_SEGMENTS.forEach(o => (counts[o.label] = 0));
  list.forEach(r => { if (counts[r.meal] !== undefined) counts[r.meal]++; });
  const total = list.length;
  const tc = document.createElement("div");
  tc.className = "summary-card";
  tc.innerHTML = `<span class="summary-label">Total Responses</span><span class="summary-count">${total}</span><span class="summary-name">All Options</span><div class="summary-bar-wrap"><div class="summary-bar" style="width:100%"></div></div>`;
  grid.appendChild(tc);
  ALL_SEGMENTS.forEach(opt => {
    const cnt   = counts[opt.label];
    const pct   = total ? Math.round((cnt/total)*100) : 0;
    const color = opt.cls==="veg"?"#16a34a":opt.cls==="nonveg"?"#dc2626":"#d97706";
    const c     = document.createElement("div");
    c.className = "summary-card";
    c.innerHTML = `<span class="summary-label">${pct}% of responses</span><span class="summary-count" style="color:${color}">${cnt}</span><span class="summary-name">${opt.label}</span><div class="summary-bar-wrap"><div class="summary-bar" style="width:${pct}%;background:${color}"></div></div>`;
    grid.appendChild(c);
  });
}

/* ─────────────────────────────────────────
   BADGE / RESET
───────────────────────────────────────── */
function updateBadge() {
  document.getElementById("responseBadge").textContent = getResponses().length;
}
function resetForm() {
    document.getElementById("userName").value    = "";
    document.getElementById("userName").disabled = false;
    resetSpin();
    hideDuplicateBanner();
    hideSpecialGuestBanner();
    hidePrefStep();
    clearErr("nameError");
    clearErr("prefError");
    clearErr("mealError");
  }

/* ─────────────────────────────────────────
   ERROR / TOAST
───────────────────────────────────────── */
function showErr(id)  { document.getElementById(id).classList.add("visible"); }
function clearErr(id) { document.getElementById(id).classList.remove("visible"); }
function showToast(msg) {
  const t = document.getElementById("toast");
  document.getElementById("toastMsg").textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3400);
}

/* ─────────────────────────────────────────
   SHARE MODAL
───────────────────────────────────────── */
function openShareModal() {
  document.getElementById("shareLink").value = window.location.href;
  document.getElementById("shareModal").classList.add("open");
}
function closeShareModal(e) {
  if (!e || e.target === document.getElementById("shareModal"))
    document.getElementById("shareModal").classList.remove("open");
}
function copyLink() {
  const inp = document.getElementById("shareLink"); inp.select();
  navigator.clipboard.writeText(inp.value)
    .then(() => showToast("Link copied!"))
    .catch(() => { document.execCommand("copy"); showToast("Link copied!"); });
}
function shareVia(p) {
  const u = encodeURIComponent(window.location.href);
  const t = encodeURIComponent("Hey! Fill in your Meal Preference here: ");
  const m = { whatsapp:`https://wa.me/?text=${t}${u}`, email:`mailto:?subject=Meal%20Preference&body=${t}${u}`, telegram:`https://t.me/share/url?url=${u}&text=${t}` };
  window.open(m[p], "_blank");
}

/* ─────────────────────────────────────────
   EXPORT CSV
───────────────────────────────────────── */
function exportCSV() {
  const list = getResponses();
  if (!list.length) { showToast("No responses to export."); return; }
  const rows = list.map((r,i) => [i+1,`"${r.name.replace(/"/g,'""')}"`,`"${r.meal.replace(/"/g,'""')}"`,`"${new Date(r.timestamp).toLocaleString()}"`]);
  const csv  = ["#,Name,Meal Option,Submitted At",...rows.map(r=>r.join(","))].join("\n");
  const a    = Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([csv],{type:"text/csv"})),download:"meal_preferences.csv"});
  a.click(); showToast("CSV exported!");
}

/* ─────────────────────────────────────────
   UTILITY
───────────────────────────────────────── */
function esc(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
