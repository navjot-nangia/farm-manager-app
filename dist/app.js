const STORAGE_KEY = "farm-manager-v2";
const SESSION_KEY = "farm-manager-demo-session";
const DEMO_USERNAME = "manager";
const DEMO_PASSWORD = "farm123";

const cropGuides = {
  cotton: {
    summary: "A simple scouting-first cotton timeline from emergence through harvest preparation.",
    milestones: [
      [7, "Check emergence and stand", "Walk representative areas, note skips or crusting, and record stand concerns."],
      [14, "Scout weeds and early pests", "Identify species and pressure before choosing any response. Verify thresholds locally."],
      [28, "Review water status", "Check soil moisture, rooting depth, forecast, and the field's irrigation plan."],
      [42, "Square-stage field check", "Record crop stage, vigor, pest observations, and unusual symptoms."],
      [63, "Flowering-stage review", "Reassess water demand, fruit retention, insects, and disease risk."],
      [105, "Prepare harvest plan", "Review maturity, harvest readiness, equipment, labor, and weather window."]
    ]
  },
  soybean: {
    summary: "A field-check timeline covering establishment, vegetative growth, flowering, pod fill, and harvest readiness.",
    milestones: [
      [7, "Check emergence and stand", "Document emergence uniformity, stand gaps, residue, and surface conditions."],
      [18, "Scout weeds and insects", "Identify field pressure and compare observations with local thresholds."],
      [35, "Vegetative-stage review", "Record canopy development, nodulation concerns, symptoms, and soil moisture."],
      [50, "Flowering-stage scouting", "Increase attention to insects, disease symptoms, and water stress."],
      [75, "Pod-fill review", "Track pod development, late-season stress, and harvest constraints."],
      [115, "Prepare harvest plan", "Assess maturity, lodging, equipment readiness, and the forecast."]
    ]
  },
  corn: {
    summary: "A practical corn timeline focused on stand establishment, scouting, water checks, and reproductive stages.",
    milestones: [
      [7, "Evaluate emergence", "Check uniformity, stand, residue interference, and early injury."],
      [18, "Early-season field scout", "Record weeds, insects, nutrient symptoms, and plant development."],
      [35, "Rapid-growth review", "Check soil moisture, root development, crop stage, and emerging stress."],
      [55, "Pre-tassel inspection", "Document crop uniformity, disease symptoms, insects, and water status."],
      [75, "Grain-set review", "Monitor pollination outcome, kernel set, disease pressure, and stress."],
      [120, "Prepare harvest plan", "Track maturity, stalk quality, equipment, storage, and weather."]
    ]
  },
  sorghum: {
    summary: "A stage-based sorghum timeline for establishment, scouting, boot stage, grain fill, and harvest.",
    milestones: [
      [8, "Check emergence and stand", "Record stand uniformity, skips, surface conditions, and early injury."],
      [21, "Scout field pressure", "Identify weeds, insects, and symptoms; confirm local action thresholds."],
      [40, "Review water and growth", "Check crop stage, rooting, soil moisture, and stress patterns."],
      [58, "Boot-stage inspection", "Increase scouting for insects, disease symptoms, and water stress."],
      [78, "Grain-fill review", "Track head condition, grain development, birds, insects, and lodging."],
      [110, "Prepare harvest plan", "Assess grain maturity, field losses, equipment, and weather."]
    ]
  },
  wheat: {
    summary: "A seasonal wheat timeline for establishment, tillering, jointing, heading, and harvest preparation.",
    milestones: [
      [10, "Check establishment", "Record emergence, stand uniformity, residue, moisture, and early damage."],
      [35, "Tillering-stage scout", "Check weeds, insects, disease symptoms, and crop vigor."],
      [70, "Seasonal field review", "Reconfirm growth stage, fertility plan, stand health, and moisture."],
      [115, "Jointing-stage check", "Protect the crop from avoidable traffic and record disease or insect pressure."],
      [145, "Heading-stage review", "Scout symptoms, insects, lodging risk, and water stress."],
      [185, "Prepare harvest plan", "Assess maturity, equipment readiness, storage, and weather."]
    ]
  }
};

const typeForTitle = (title) => {
  const value = title.toLowerCase();
  if (value.includes("water")) return "irrigation";
  if (value.includes("weed") || value.includes("pest") || value.includes("insect") || value.includes("disease")) return "scouting";
  if (value.includes("harvest")) return "harvest";
  return "field check";
};

const dateOnly = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + days); return next; };
const toISODate = (date) => date.toISOString().slice(0, 10);
const formatDate = (date, options = { month: "short", day: "numeric" }) => new Intl.DateTimeFormat("en-US", options).format(date);
const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

let state = loadState();
let currentFilter = "open";
let currentGuide = "cotton";
let deferredInstallPrompt;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.fields && saved?.completed) return saved;
  } catch (_) {}
  return {
    fields: [],
    completed: []
  };
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function tasksForField(field) {
  return cropGuides[field.crop].milestones.map(([offset, title, description]) => ({
    id: `${field.id}-${offset}`,
    fieldId: field.id,
    fieldName: field.name,
    crop: field.crop,
    title,
    description,
    type: typeForTitle(title),
    offset,
    due: addDays(field.planted, offset),
    done: state.completed.includes(`${field.id}-${offset}`)
  }));
}

function allTasks() { return state.fields.flatMap(tasksForField).sort((a, b) => a.due - b.due); }

function render() {
  renderToday();
  renderFields();
  renderGuide();
}

function renderToday() {
  const now = dateOnly(new Date());
  const horizon = new Date(now); horizon.setDate(horizon.getDate() + 3);
  const upcomingHorizon = new Date(now); upcomingHorizon.setDate(upcomingHorizon.getDate() + 14);
  const tasks = allTasks();
  const attention = tasks.filter((task) => task.due <= horizon && (currentFilter === "all" || !task.done));
  const taskList = document.querySelector("#taskList");

  taskList.innerHTML = attention.length ? attention.map((task) => {
    const days = Math.round((dateOnly(task.due) - now) / 86400000);
    const timing = days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due ${formatDate(task.due)}`;
    return `<article class="task-card ${days < 0 && !task.done ? "overdue" : ""} ${task.done ? "done" : ""}">
      <button class="task-check" data-complete="${task.id}" aria-label="${task.done ? "Mark open" : "Mark complete"}">${task.done ? "✓" : ""}</button>
      <div><h3 class="task-title">${escapeHTML(task.title)}</h3><p class="task-meta">${escapeHTML(task.fieldName)} · ${timing}</p></div>
      <div class="task-menu"><span class="task-type">${task.type}</span><button class="small-button" data-calendar="${task.id}">Calendar</button></div>
    </article>`;
  }).join("") : `<div class="empty-state"><h3>${state.fields.length ? "You’re caught up" : "Add your first field"}</h3><p>${state.fields.length ? "No open field tasks need attention in the next three days." : "A field creates a crop timeline and turns it into a clear daily plan."}</p><button class="primary-button" data-add-field>${state.fields.length ? "View all tasks" : "Add a field"}</button></div>`;

  const upcoming = tasks.filter((task) => !task.done && task.due > horizon && task.due <= upcomingHorizon).slice(0, 5);
  document.querySelector("#upcomingList").innerHTML = upcoming.length ? upcoming.map((task) => `<article class="timeline-item"><span class="timeline-date">${formatDate(task.due, { weekday: "short", month: "short", day: "numeric" })}</span><h3>${escapeHTML(task.title)}</h3><p>${escapeHTML(task.fieldName)} · ${escapeHTML(task.crop)}</p></article>`).join("") : `<p class="task-meta">No additional milestones in the next 14 days.</p>`;
}

function renderFields() {
  const grid = document.querySelector("#fieldGrid");
  if (!state.fields.length) {
    grid.innerHTML = `<div class="empty-state"><h3>No fields yet</h3><p>Add a planted field to create its management timeline.</p><button class="primary-button" data-add-field>Add a field</button></div>`;
    return;
  }
  grid.innerHTML = state.fields.map((field) => {
    const age = Math.max(0, Math.floor((dateOnly(new Date()) - dateOnly(new Date(`${field.planted}T12:00:00`))) / 86400000));
    const tasks = tasksForField(field);
    const done = tasks.filter((task) => task.done).length;
    return `<article class="field-card" data-crop="${field.crop}">
      <div class="field-card-top"><span class="crop-label">${escapeHTML(field.crop)}</span><button class="delete-field" data-delete-field="${field.id}" aria-label="Delete ${escapeHTML(field.name)}">•••</button></div>
      <h3>${escapeHTML(field.name)}</h3><p>${escapeHTML(field.variety || "Variety not recorded")} · ${escapeHTML(field.location || "Location not recorded")}</p>
      <div class="field-stats"><div class="field-stat"><strong>${escapeHTML(field.acres)}</strong><span>acres</span></div><div class="field-stat"><strong>${age}</strong><span>days planted</span></div><div class="field-stat"><strong>${done}/${tasks.length}</strong><span>tasks done</span></div></div>
    </article>`;
  }).join("");
}

function renderGuide() {
  document.querySelector("#cropTabs").innerHTML = Object.keys(cropGuides).map((crop) => `<button class="crop-tab ${crop === currentGuide ? "active" : ""}" data-crop-tab="${crop}">${crop[0].toUpperCase() + crop.slice(1)}</button>`).join("");
  const guide = cropGuides[currentGuide];
  document.querySelector("#guideCard").innerHTML = `<div class="guide-summary"><h3>${currentGuide}</h3><p>${guide.summary}</p></div><div><div class="milestone-list">${guide.milestones.map(([day, title, description]) => `<div class="milestone"><span class="milestone-day">Day ${day}</span><div><h4>${title}</h4><p>${description}</p></div></div>`).join("")}</div><p class="source-note"><strong>Planning note:</strong> Dates are prompts for observation, not automatic treatment instructions. Crop stage, weather, soil, variety, pest thresholds, product labels, and local guidance always take priority. Future versions will connect each plan to verified Extension sources and let managers customize every milestone.</p></div>`;
}

function setView(view) {
  document.querySelectorAll(".view").forEach((node) => node.classList.toggle("active", node.id === `${view}View`));
  document.querySelectorAll("[data-view]").forEach((node) => node.classList.toggle("active", node.dataset.view === view));
  document.querySelector("#pageTitle").textContent = view === "today" ? greeting() : view === "fields" ? "Fields" : "Crop guide";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function openFieldDialog() {
  const form = document.querySelector("#fieldForm");
  form.reset();
  form.elements.location.value = "Texas";
  form.elements.planted.value = toISODate(new Date());
  document.querySelector("#fieldDialog").showModal();
}

function createField() {
  const form = document.querySelector("#fieldForm");
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  state.fields.push({
    id: crypto.randomUUID(),
    name: data.get("name").trim(), crop: data.get("crop"), acres: Number(data.get("acres")),
    variety: data.get("variety").trim(), planted: data.get("planted"), location: data.get("location").trim()
  });
  saveState();
  render();
  document.querySelector("#fieldDialog").close();
  setView("fields");
  showToast("Field timeline created");
}

function toggleTask(id) {
  state.completed = state.completed.includes(id) ? state.completed.filter((item) => item !== id) : [...state.completed, id];
  saveState(); renderToday(); renderFields();
}

function deleteField(id) {
  const field = state.fields.find((item) => item.id === id);
  if (!field || !confirm(`Remove ${field.name} and its task history from this device?`)) return;
  state.fields = state.fields.filter((item) => item.id !== id);
  state.completed = state.completed.filter((item) => !item.startsWith(`${id}-`));
  saveState(); render(); showToast("Field removed");
}

function exportCalendar(id) {
  const task = allTasks().find((item) => item.id === id);
  if (!task) return;
  const start = toISODate(task.due).replaceAll("-", "");
  const endDate = new Date(task.due); endDate.setDate(endDate.getDate() + 1);
  const end = toISODate(endDate).replaceAll("-", "");
  const clean = (value) => value.replace(/[\\;,]/g, " ");
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Farm Manager//EN\r\nBEGIN:VEVENT\r\nUID:${task.id}@farm-manager\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nSUMMARY:${clean(task.title)} — ${clean(task.fieldName)}\r\nDESCRIPTION:${clean(task.description)} Verify with local Extension guidance and product labels.\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  link.download = `${task.crop}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Calendar reminder downloaded");
}

async function enableNotifications() {
  if (!("Notification" in window)) return showToast("Notifications are not supported here");
  const permission = await Notification.requestPermission();
  document.querySelector("#enableNotifications").classList.toggle("enabled", permission === "granted");
  showToast(permission === "granted" ? "Reminders enabled on this device" : "Notification permission was not enabled");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function showApp() {
  document.querySelector("#loginScreen").hidden = true;
  document.querySelector("#appShell").hidden = false;
  document.querySelector("#mobileNav").hidden = false;
}

function showLogin() {
  document.querySelector("#appShell").hidden = true;
  document.querySelector("#mobileNav").hidden = true;
  document.querySelector("#loginScreen").hidden = false;
  document.querySelector("#loginError").hidden = true;
  document.querySelector("#loginForm").elements.username.focus();
}

function logOut() {
  localStorage.removeItem(SESSION_KEY);
  showLogin();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, [data-view]");
  if (!target) return;
  if (target.dataset.view) setView(target.dataset.view);
  if (target.matches("#openAddField, [data-add-field]")) openFieldDialog();
  if (target.dataset.complete) toggleTask(target.dataset.complete);
  if (target.dataset.calendar) exportCalendar(target.dataset.calendar);
  if (target.dataset.deleteField) deleteField(target.dataset.deleteField);
  if (target.dataset.cropTab) { currentGuide = target.dataset.cropTab; renderGuide(); }
  if (target.dataset.filter) {
    currentFilter = target.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((node) => node.classList.toggle("active", node.dataset.filter === currentFilter));
    renderToday();
  }
});

document.querySelector("#saveField").addEventListener("click", (event) => { event.preventDefault(); createField(); });
document.querySelector("#enableNotifications").addEventListener("click", enableNotifications);
document.querySelector("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const valid = data.get("username").trim().toLowerCase() === DEMO_USERNAME && data.get("password") === DEMO_PASSWORD;
  document.querySelector("#loginError").hidden = valid;
  if (!valid) return;
  localStorage.setItem(SESSION_KEY, "active");
  showApp();
});
document.querySelector("#logoutApp").addEventListener("click", logOut);
document.querySelector("#mobileLogout").addEventListener("click", logOut);
document.querySelector("#todayDate").textContent = formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" });
document.querySelector("#pageTitle").textContent = greeting();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault(); deferredInstallPrompt = event;
  document.querySelector("#installApp").hidden = false;
});
document.querySelector("#installApp").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null; document.querySelector("#installApp").hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.register("service-worker.js").catch(() => null);
    if (!registration) return;
    registration.update().catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
render();
if (localStorage.getItem(SESSION_KEY) === "active") showApp(); else showLogin();
