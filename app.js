const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const dialog = document.querySelector("#task-dialog");
const form = document.querySelector("#task-form");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#search-input");
const STORAGE_KEY = "clair-tasks";
const LANGUAGE_KEY = "clair-language";
const LANGUAGES = window.CLAIR_TRANSLATIONS || {};
const SUPABASE_CONFIG = window.CLAIR_SUPABASE_CONFIG;
const supabaseLibrary = window.supabase;
const supportedLanguages = ["fr", "en", "ar", "it", "es", "de"];
const requiredFeatureTranslations = ["featureNav", "mindmapTitle", "emptyMaps", "addBranch", "agendaTitle", "newEvent", "timetableTitle", "importPdf", "newSlot"];
const embeddedFrench = {};
document.querySelectorAll("[data-i18n]").forEach((element) => {
  const key = element.dataset.i18n;
  const value = element.textContent.trim();
  if (value && value !== key) embeddedFrench[key] = value;
});
document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
  embeddedFrench[element.dataset.i18nPlaceholder] = element.placeholder;
});
document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
  embeddedFrench[element.dataset.i18nAria] = element.getAttribute("aria-label");
});
document.querySelectorAll("[data-i18n-title]").forEach((element) => {
  embeddedFrench[element.dataset.i18nTitle] = element.title;
});
Object.assign(embeddedFrench, {
  progressCaption: "Chaque chose en son temps.",
  congratulations: "Bravo, tout est accompli !",
  taskTotal: "tâche au total",
  tasksTotal: "tâches au total",
  noSearchResults: "Aucun résultat pour cette recherche.",
  tryAnotherSearch: "Essayez un autre mot ou changez de filtre.",
  allDone: "Tout est accompli.",
  enjoyMoment: "Vous pouvez savourer ce moment, ou ajouter une nouvelle tâche.",
  firstIdea: "Tout commence par une idée.",
  firstTask: "Ajoutez une première tâche et donnez-lui vie.",
  deleteTitle: "Supprimer",
  deleteTask: "Supprimer la tâche",
  priorityLowShort: "Faible",
  priorityNormalShort: "Normale",
  priorityHighShort: "Élevée",
  markActive: "Marquer comme à faire",
  markCompleted: "Marquer comme terminée",
  today: "Aujourd’hui",
  badSavedData: "Impossible de lire les tâches enregistrées.",
  impossibleSave: "Impossible d’enregistrer vos tâches.",
  taskDeleted: "Tâche supprimée. Un peu plus de place pour l’essentiel.",
  taskAdded: "Votre tâche a été ajoutée. À vous de jouer !",
  taskAddedOffline: "Tâche enregistrée sur cet appareil uniquement.",
  accountCreated: "Compte créé ! Vérifiez votre e-mail pour confirmer l’inscription.",
  haveAccount: "Déjà un compte ?",
  signedIn: "Vous êtes connecté.",
  signedOut: "Vous êtes déconnecté.",
  googleUnavailable: "Configurez Supabase et Google OAuth avant d’utiliser cette option.",
  supabaseSetup: "La connexion en ligne n’est pas encore configurée. Vérifiez supabase-config.js.",
  missingTranslations: "Le fichier de traductions manque sur ce site. L’interface reste en français.",
  emailLinkSent: "Vérifiez votre e-mail pour le lien de connexion.",
  loadingAccount: "Connexion…",
  featureNav: "Espaces de travail",
  tasksView: "Tâches",
  mindmapView: "Cartes mentales",
  agendaView: "Agenda",
  timetableView: "Emploi du temps",
  mindmapEyebrow: "VOS IDÉES, CONNECTÉES",
  mindmapTitle: "Cartes mentales",
  newMindmap: "+ Nouvelle carte",
  chooseMap: "Carte",
  rename: "Renommer",
  deleteMap: "Supprimer la carte",
  ideaPlaceholder: "Ajouter une idée principale…",
  addIdea: "Ajouter une idée",
  emptyMaps: "Créez une carte pour commencer à relier vos idées.",
  rootIdea: "Idée centrale",
  addBranch: "Ajouter une branche",
  editIdea: "Modifier",
  deleteIdea: "Supprimer",
  newMindmapTitle: "Créer une carte mentale",
  mindmapName: "Nom de la carte",
  newMapName: "Nouvelle carte",
  ideaName: "Votre idée",
  save: "Enregistrer",
  agendaEyebrow: "VOTRE TEMPS, EN CLAIR",
  agendaTitle: "Agenda",
  newEvent: "+ Nouvel événement",
  fromDate: "À partir du",
  noEvents: "Aucun événement prévu à partir de cette date.",
  eventName: "Nom de l’événement",
  date: "Date",
  startTime: "Début",
  endTime: "Fin",
  notes: "Notes (facultatif)",
  saveEvent: "Enregistrer l’événement",
  editEvent: "Modifier",
  timetableEyebrow: "UNE SEMAINE BIEN PENSÉE",
  timetableTitle: "Emploi du temps",
  exportPdf: "Exporter en PDF",
  newSlot: "+ Ajouter un créneau",
  pdfImportHint: "Importez un PDF existant pour le consulter ici, ou créez un emploi du temps modifiable et exportez-le en PDF.",
  importPdf: "Importer un emploi du temps PDF",
  noSlots: "Aucun créneau cette semaine. Ajoutez votre premier cours ou activité.",
  slotName: "Cours ou activité",
  day: "Jour",
  location: "Lieu (facultatif)",
  saveSlot: "Enregistrer le créneau",
  noPdfs: "Aucun PDF importé.",
  openPdf: "Ouvrir le PDF",
  deletePdf: "Supprimer le PDF",
  pdfTooLarge: "Le PDF dépasse la limite de 10 Mo.",
  invalidPdf: "Choisissez un fichier PDF valide (10 Mo maximum).",
  pdfSignIn: "Connectez-vous pour stocker et consulter vos PDF en toute sécurité.",
  savedLocally: "Enregistré sur cet appareil. Connectez-vous pour synchroniser.",
  featureSaveError: "Impossible d’enregistrer. Vérifiez la connexion et la configuration Supabase.",
  confirmDelete: "Voulez-vous vraiment supprimer cet élément ?",
  printNotice: "Dans la fenêtre d’impression, choisissez « Enregistrer au format PDF ».",
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
  untitledMap: "Carte sans titre",
  endBeforeStart: "L’heure de fin doit être après l’heure de début.",
});
const translationsAvailable = supportedLanguages.every((code) =>
  LANGUAGES[code] && requiredFeatureTranslations.every((key) => LANGUAGES[code][key]),
);
if (!LANGUAGES.fr) LANGUAGES.fr = embeddedFrench;
else Object.assign(embeddedFrench, LANGUAGES.fr);
let supabaseClient = null;
if (SUPABASE_CONFIG?.url && SUPABASE_CONFIG?.anonKey && supabaseLibrary?.createClient) {
  supabaseClient = supabaseLibrary.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
}

let language = "fr";
let tasks = [];
let activeFilter = "all";
let toastTimer;
let currentUser = null;
let taskChannel = null;
let authMode = "signin";
let taskLoadFailed = false;
let deviceTasksToImport = [];
let accountInitialized = false;
let activeView = "tasks";
let mindMaps = [];
let selectedMindMapId = "";
let selectedIdeaId = "";
let calendarEvents = [];
let timetableSlots = [];
let timetablePdfs = [];
let editingEventId = "";
let selectedAgendaDate = localDateString(new Date());
let textAction = null;

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const FEATURE_STORAGE_KEYS = {
  mindMaps: "clair-mind-maps",
  events: "clair-calendar-events",
  slots: "clair-timetable-slots",
};

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function t(key, values = {}) {
  const message = LANGUAGES[language]?.[key] || LANGUAGES.fr?.[key] || embeddedFrench[key] || "—";
  return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, value), message);
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3000);
}

function localTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    const parsed = savedTasks ? JSON.parse(savedTasks) : [];
    if (!Array.isArray(parsed)) throw new Error(t("badSavedData"));
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(t("badSavedData"));
    throw error;
  }
}

async function saveTask(task) {
  if (currentUser && supabaseClient) {
    const { error } = await supabaseClient.from("tasks").upsert({
      id: task.id,
      user_id: currentUser.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      completed: task.completed,
      created_at: task.createdAt,
    });
    if (error) throw new Error(error.message);
    return;
  }
  try {
    const nextTasks = tasks.some((item) => item.id === task.id)
      ? tasks.map((item) => item.id === task.id ? task : item)
      : [task, ...tasks];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
  } catch {
    throw new Error(t("impossibleSave"));
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return t("today");
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(date);
}

function makeIcon(name) {
  const paths = {
    check: '<path d="m5 12 4 4L19 6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths[name];
  return svg;
}

function createTaskRow(task, index) {
  const row = document.createElement("article");
  row.className = `task-row${task.completed ? " is-completed" : ""}`;
  row.style.animationDelay = `${Math.min(index * 35, 210)}ms`;

  const check = document.createElement("button");
  check.className = `task-check${task.completed ? " checked" : ""}`;
  check.type = "button";
  check.setAttribute("aria-label", task.completed ? t("markActive") : t("markCompleted"));
  check.append(makeIcon("check"));
  check.addEventListener("click", () => updateTask(task.id, { completed: !task.completed }));

  const copy = document.createElement("div");
  copy.className = "task-copy";
  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;
  copy.append(title);
  if (task.description) {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    copy.append(description);
  }

  const priority = document.createElement("span");
  priority.className = `priority-badge priority-${task.priority}`;
  priority.textContent = {
    basse: t("priorityLowShort"),
    normale: t("priorityNormalShort"),
    haute: t("priorityHighShort"),
  }[task.priority] || t("priorityNormalShort");

  const date = document.createElement("time");
  date.className = "task-date";
  date.dateTime = task.createdAt;
  date.textContent = formatDate(task.createdAt);

  const remove = document.createElement("button");
  remove.className = "task-delete";
  remove.type = "button";
  remove.setAttribute("aria-label", `${t("deleteTitle")} ${task.title}`);
  remove.title = t("deleteTask");
  remove.append(makeIcon("trash"));
  remove.addEventListener("click", () => deleteTask(task.id));

  row.append(check, copy, priority, date, remove);
  return row;
}

function render() {
  const completedCount = tasks.filter((task) => task.completed).length;
  const remainingCount = tasks.length - completedCount;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  document.querySelector("#stat-remaining").textContent = remainingCount;
  document.querySelector("#stat-completed").textContent = completedCount;
  document.querySelector("#progress-percent").textContent = `${progress}%`;
  document.querySelector("#progress-fill").style.width = `${progress}%`;
  document.querySelector("#progress-caption").textContent =
    tasks.length && progress === 100 ? t("congratulations") : t("progressCaption");
  document.querySelector("#nav-total").textContent = tasks.length;
  document.querySelector("#nav-active").textContent = remainingCount;
  document.querySelector("#filter-all-count").textContent = tasks.length;
  document.querySelector("#footer-count").textContent =
    `${tasks.length} ${tasks.length === 1 ? t("taskTotal") : t("tasksTotal")}`;

  const query = searchInput.value.trim().toLocaleLowerCase(language);
  const visibleTasks = tasks.filter((task) => {
    const matchesFilter = activeFilter === "all"
      || (activeFilter === "active" && !task.completed)
      || (activeFilter === "completed" && task.completed);
    const matchesSearch = `${task.title} ${task.description}`.toLocaleLowerCase(language).includes(query);
    return matchesFilter && matchesSearch;
  });

  taskList.replaceChildren(...visibleTasks.map(createTaskRow));
  const showEmpty = visibleTasks.length === 0;
  emptyState.hidden = !showEmpty;
  taskList.hidden = showEmpty;
  document.querySelector("#list-footer").hidden = showEmpty;
  document.querySelector("#empty-title").textContent = taskLoadFailed
    ? t("badSavedData")
    : tasks.length ? query ? t("noSearchResults") : t("allDone") : t("firstIdea");
  document.querySelector("#empty-copy").textContent = taskLoadFailed
    ? t("badSavedData")
    : tasks.length ? query ? t("tryAnotherSearch") : t("enjoyMoment") : t("firstTask");
  document.querySelector("#empty-add").hidden = tasks.length > 0 || taskLoadFailed;

  document.querySelectorAll("[data-filter]").forEach((button) => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle("selected", selected);
    button.classList.toggle("active", button.classList.contains("nav-link") && selected);
    if (button.classList.contains("filter-tab")) button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelector("#breadcrumb-current").textContent = t({
    all: "overview",
    active: "active",
    completed: "completed",
  }[activeFilter]);
}

function applyTranslations() {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = `Clair — ${t("personalSpace")}`;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const translation = t(element.dataset.i18n);
    if (element.id === "auth-title") {
      element.textContent = currentUser
        ? currentUser.user_metadata?.username || currentUser.email
        : t(authMode === "signin" ? "signIn" : "createAccount");
    } else if (element.querySelector(".heading-period")) {
      const period = element.querySelector(".heading-period");
      element.replaceChildren(document.createTextNode(translation), period);
    } else {
      element.textContent = translation;
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  document.querySelectorAll(".nav-link[data-filter]").forEach((button) => {
    const label = button.querySelector("[data-i18n]");
    if (label) button.setAttribute("aria-label", label.textContent);
  });
  const date = new Intl.DateTimeFormat(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  document.querySelector("#today-date").textContent = date;
  document.querySelector("#language-select").value = language;
  document.querySelector("#language-select").disabled = !translationsAvailable;
  render();
  updateAccountButton();
  renderMindMaps();
  renderAgenda();
  renderTimetable();
  document.querySelectorAll("#slot-day option").forEach((option, index) => {
    option.textContent = t(WEEKDAYS[index]);
  });
}

function setLanguage(nextLanguage) {
  if (!translationsAvailable || !LANGUAGES[nextLanguage]) return;
  language = nextLanguage;
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    showToast(t("impossibleSave"), true);
  }
  applyTranslations();
  if (!translationsAvailable) {
    showToast("Le fichier translations.js manque sur le site publié. L’interface reste en français.", true);
  }
}

async function fetchCloudTasks() {
  if (!supabaseClient || !currentUser) return;
  const userId = currentUser.id;
  const { data, error } = await supabaseClient.from("tasks")
    .select("id,title,description,priority,completed,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (currentUser?.id !== userId) return;
  tasks = data.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    completed: task.completed,
    createdAt: task.created_at,
  }));
  taskLoadFailed = false;
  render();
}

async function setCurrentUser(user) {
  if (accountInitialized && currentUser?.id === user?.id) return;
  accountInitialized = true;
  currentUser = user;
  taskLoadFailed = false;
  if (taskChannel && supabaseClient) {
    await supabaseClient.removeChannel(taskChannel);
    taskChannel = null;
  }
  if (!user) {
    try {
      tasks = localTasks();
    } catch (error) {
      taskLoadFailed = true;
      tasks = [];
      showToast(error.message || t("badSavedData"), true);
    }
    await loadWorkspaceData();
    updateAccountButton();
    applyTranslations();
    return;
  }

  try {
    await fetchCloudTasks();
    try {
      await loadWorkspaceData();
    } catch (error) {
      mindMaps = [];
      calendarEvents = [];
      timetableSlots = [];
      timetablePdfs = [];
      renderMindMaps();
      renderAgenda();
      renderTimetable();
      showToast(error.message, true);
    }
    if (tasks.length === 0) {
      try {
        deviceTasksToImport = localTasks();
      } catch (error) {
        deviceTasksToImport = [];
        showToast(error.message || t("badSavedData"), true);
      }
    } else {
      deviceTasksToImport = [];
    }
    taskChannel = supabaseClient.channel(`tasks-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchCloudTasks().catch((error) => showToast(error.message, true)))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "mind_maps", filter: `user_id=eq.${user.id}`,
      }, () => loadWorkspaceData().catch((error) => showToast(error.message, true)))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "calendar_events", filter: `user_id=eq.${user.id}`,
      }, () => loadWorkspaceData().catch((error) => showToast(error.message, true)))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "timetable_slots", filter: `user_id=eq.${user.id}`,
      }, () => loadWorkspaceData().catch((error) => showToast(error.message, true)))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "timetable_pdfs", filter: `user_id=eq.${user.id}`,
      }, () => loadWorkspaceData().catch((error) => showToast(error.message, true)))
      .subscribe();
    updateAccountButton();
    applyTranslations();
  } catch (error) {
    taskLoadFailed = true;
    tasks = [];
    updateAccountButton();
    applyTranslations();
    showToast(error.message, true);
  }
}

function updateAccountButton() {
  const button = document.querySelector("#account-button");
  button.textContent = currentUser
    ? currentUser.user_metadata?.username || currentUser.email
    : t("signIn");
  document.querySelector("#profile-name").textContent = currentUser
    ? currentUser.user_metadata?.username || currentUser.email
    : t("personalSpace");
  document.querySelector("#profile-caption").textContent = currentUser?.email || t("personalOrg");
  document.querySelector("#profile-avatar").textContent =
    (currentUser?.user_metadata?.username || currentUser?.email || "C").slice(0, 1).toLocaleUpperCase(language);
}

function openAuth() {
  document.querySelector("#auth-notice").textContent = translationsAvailable
    ? ""
    : t("missingTranslations");
  document.querySelector("#auth-controls").hidden = Boolean(currentUser);
  document.querySelector("#signed-in-controls").hidden = !currentUser;
  document.querySelector("#import-local").hidden = !currentUser || deviceTasksToImport.length === 0;
  document.querySelector("#auth-title").textContent = currentUser
    ? currentUser.user_metadata?.username || currentUser.email
    : t(authMode === "signin" ? "signIn" : "createAccount");
  document.querySelector("#auth-password").autocomplete =
    authMode === "signup" ? "new-password" : "current-password";
  document.querySelector("#auth-username").required = authMode === "signup";
  document.querySelector("#username-field").hidden = authMode !== "signup";
  document.querySelector("#auth-switch").innerHTML =
    `<span data-i18n="${authMode === "signin" ? "noAccount" : "haveAccount"}">${t(authMode === "signin" ? "noAccount" : "haveAccount")}</span> <span data-i18n="${authMode === "signin" ? "createAccount" : "signIn"}">${t(authMode === "signin" ? "createAccount" : "signIn")}</span>`;
  document.querySelector("#auth-submit").textContent = t(authMode === "signin" ? "signIn" : "createAccount");
  document.querySelector("#auth-form").reset();
  if (!supabaseClient) document.querySelector("#auth-notice").textContent = t("supabaseSetup");
  document.querySelector("#auth-controls").querySelectorAll("input, button").forEach((control) => {
    control.disabled = !supabaseClient;
  });
  document.querySelector("#auth-dialog").showModal();
}

function requireSupabase() {
  if (!supabaseClient) {
    showToast(t("googleUnavailable"), true);
    return false;
  }
  return true;
}

function showView(view) {
  activeView = view;
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== activeView;
  });
  document.querySelectorAll(".feature-tab").forEach((button) => {
    const selected = button.dataset.view === activeView;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelector("#breadcrumb-current").textContent = t({
    tasks: "overview",
    mindmap: "mindmapTitle",
    agenda: "agendaTitle",
    timetable: "timetableTitle",
  }[activeView]);
  renderMindMaps();
  renderAgenda();
  renderTimetable();
}

function readFeatureStorage(key) {
  const saved = localStorage.getItem(key);
  const value = saved ? JSON.parse(saved) : [];
  if (!Array.isArray(value)) throw new Error(t("featureSaveError"));
  return value;
}

function saveLocalCollection(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    throw new Error(t("featureSaveError"));
  }
}

async function loadWorkspaceData() {
  if (currentUser && supabaseClient) {
    const userId = currentUser.id;
    const [mapsResult, eventsResult, slotsResult, pdfsResult] = await Promise.all([
      supabaseClient.from("mind_maps").select("id,title,nodes,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
      supabaseClient.from("calendar_events").select("id,title,event_date,start_time,end_time,notes").eq("user_id", userId).order("event_date").order("start_time"),
      supabaseClient.from("timetable_slots").select("id,title,weekday,start_time,end_time,location").eq("user_id", userId).order("weekday").order("start_time"),
      supabaseClient.from("timetable_pdfs").select("id,file_name,storage_path,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    for (const result of [mapsResult, eventsResult, slotsResult, pdfsResult]) {
      if (result.error) throw new Error(result.error.message);
    }
    if (currentUser?.id !== userId) return;
    mindMaps = mapsResult.data.map((map) => ({ ...map, nodes: Array.isArray(map.nodes) ? map.nodes : [] }));
    calendarEvents = eventsResult.data;
    timetableSlots = slotsResult.data;
    timetablePdfs = pdfsResult.data;
  } else {
    try {
      mindMaps = readFeatureStorage(FEATURE_STORAGE_KEYS.mindMaps);
      calendarEvents = readFeatureStorage(FEATURE_STORAGE_KEYS.events);
      timetableSlots = readFeatureStorage(FEATURE_STORAGE_KEYS.slots);
    } catch (error) {
      showToast(error.message, true);
      mindMaps = [];
      calendarEvents = [];
      timetableSlots = [];
    }
    timetablePdfs = [];
  }
  if (!mindMaps.some((map) => map.id === selectedMindMapId)) {
    selectedMindMapId = mindMaps[0]?.id || "";
  }
  renderMindMaps();
  renderAgenda();
  renderTimetable();
}

async function saveMindMap(map) {
  if (currentUser && supabaseClient) {
    const { error } = await supabaseClient.from("mind_maps").upsert({
      id: map.id,
      user_id: currentUser.id,
      title: map.title,
      nodes: map.nodes,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  } else {
    saveLocalCollection(FEATURE_STORAGE_KEYS.mindMaps, mindMaps);
  }
  renderMindMaps();
}

function createMindMapNode(node, mapId) {
  const wrapper = document.createElement("li");
  wrapper.className = "mindmap-branch";
  const card = document.createElement("div");
  card.className = `mindmap-node${selectedIdeaId === node.id ? " selected" : ""}`;
  const label = document.createElement("button");
  label.className = "mindmap-node-label";
  label.type = "button";
  label.textContent = node.label;
  label.addEventListener("click", () => {
    selectedIdeaId = node.id;
    renderMindMaps();
  });
  const actions = document.createElement("div");
  actions.className = "mindmap-node-actions";
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = "+";
  add.title = t("addBranch");
  add.setAttribute("aria-label", t("addBranch"));
  add.addEventListener("click", () => openTextDialog(
    { type: "add-node", mapId, parentId: node.id },
    "ideaName",
  ));
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "✎";
  edit.title = t("editIdea");
  edit.setAttribute("aria-label", t("editIdea"));
  edit.addEventListener("click", () => openTextDialog(
    { type: "edit-node", mapId, nodeId: node.id },
    "ideaName",
    node.label,
  ));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.title = t("deleteIdea");
  remove.setAttribute("aria-label", t("deleteIdea"));
  remove.addEventListener("click", async () => {
    if (!window.confirm(t("confirmDelete"))) return;
    const map = mindMaps.find((item) => item.id === mapId);
    if (!map) return;
    const removedIds = new Set([node.id]);
    let added = true;
    while (added) {
      added = false;
      map.nodes.forEach((item) => {
        if (removedIds.has(item.parentId) && !removedIds.has(item.id)) {
          removedIds.add(item.id);
          added = true;
        }
      });
    }
    map.nodes = map.nodes.filter((item) => !removedIds.has(item.id));
    if (removedIds.has(selectedIdeaId)) selectedIdeaId = "";
    try {
      await saveMindMap(map);
    } catch (error) {
      showToast(error.message, true);
    }
  });
  actions.append(add, edit, remove);
  card.append(label, actions);
  wrapper.append(card);
  const children = document.createElement("ul");
  children.className = "mindmap-children";
  mapNodesForParent(mapId, node.id).forEach((child) => children.append(createTasklessBranch(child, mapId)));
  if (children.childElementCount) wrapper.append(children);
  return wrapper;
}

function mapNodesForParent(mapId, parentId) {
  const map = mindMaps.find((item) => item.id === mapId);
  return map?.nodes.filter((node) => (node.parentId || "") === parentId) || [];
}

function createTasklessBranch(node, mapId) {
  return createMindMapNode(node, mapId);
}

function renderMindMaps() {
  const select = document.querySelector("#mindmap-select");
  if (!select) return;
  const previous = selectedMindMapId;
  select.replaceChildren();
  mindMaps.forEach((map) => {
    const option = document.createElement("option");
    option.value = map.id;
    option.textContent = map.title;
    select.append(option);
  });
  if (mindMaps.some((map) => map.id === previous)) selectedMindMapId = previous;
  else selectedMindMapId = mindMaps[0]?.id || "";
  select.value = selectedMindMapId;
  const map = mindMaps.find((item) => item.id === selectedMindMapId);
  document.querySelector("#rename-mindmap").disabled = !map;
  document.querySelector("#delete-mindmap").disabled = !map;
  document.querySelector("#mindmap-idea").disabled = !map;
  document.querySelector("#add-mindmap-idea").disabled = !map;
  const canvas = document.querySelector("#mindmap-canvas");
  canvas.replaceChildren();
  if (!map) {
    const empty = document.createElement("p");
    empty.className = "feature-empty";
    empty.textContent = t("emptyMaps");
    canvas.append(empty);
    return;
  }
  const rootNodes = map.nodes.filter((node) => !node.parentId);
  if (rootNodes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "feature-empty";
    empty.textContent = t("emptyMaps");
    canvas.append(empty);
    return;
  }
  const tree = document.createElement("ul");
  tree.className = "mindmap-tree";
  rootNodes.forEach((node) => tree.append(createMindMapNode(node, map.id)));
  canvas.append(tree);
}

function openTextDialog(action, labelKey, initialValue = "") {
  textAction = action;
  document.querySelector("#text-dialog-title").textContent =
    t(action.type === "new-map" ? "newMindmapTitle" : action.type === "rename-map" ? "rename" : "ideaName");
  document.querySelector("#text-label").textContent = t(labelKey);
  const input = document.querySelector("#text-value");
  input.value = initialValue;
  input.placeholder = t(labelKey);
  document.querySelector("#text-error").hidden = true;
  document.querySelector("#text-dialog").showModal();
  input.focus();
}

async function submitTextAction(value) {
  if (!textAction) return;
  const nextValue = value.trim();
  if (!nextValue) return;
  if (textAction.type === "new-map") {
    const map = { id: crypto.randomUUID(), title: nextValue, nodes: [] };
    mindMaps = [map, ...mindMaps];
    selectedMindMapId = map.id;
    await saveMindMap(map);
  } else {
    const map = mindMaps.find((item) => item.id === textAction.mapId);
    if (!map) throw new Error(t("featureSaveError"));
    if (textAction.type === "rename-map") {
      map.title = nextValue;
    } else if (textAction.type === "add-node") {
      map.nodes.push({ id: crypto.randomUUID(), label: nextValue, parentId: textAction.parentId });
      selectedIdeaId = textAction.parentId;
    } else if (textAction.type === "edit-node") {
      const node = map.nodes.find((item) => item.id === textAction.nodeId);
      if (!node) throw new Error(t("featureSaveError"));
      node.label = nextValue;
    }
    await saveMindMap(map);
  }
  document.querySelector("#text-dialog").close();
  textAction = null;
}

function openEventDialog(eventItem = null) {
  editingEventId = eventItem?.id || "";
  document.querySelector("#event-form").reset();
  document.querySelector("#event-error").hidden = true;
  document.querySelector("#event-title").value = eventItem?.title || "";
  document.querySelector("#event-date").value = eventItem?.event_date || selectedAgendaDate;
  document.querySelector("#event-start").value = eventItem?.start_time?.slice(0, 5) || "09:00";
  document.querySelector("#event-end").value = eventItem?.end_time?.slice(0, 5) || "10:00";
  document.querySelector("#event-notes").value = eventItem?.notes || "";
  document.querySelector("#event-dialog").showModal();
}

function renderAgenda() {
  const list = document.querySelector("#agenda-list");
  if (!list) return;
  const dateFilter = document.querySelector("#agenda-date").value || selectedAgendaDate;
  const visible = calendarEvents.filter((item) => item.event_date >= dateFilter)
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.start_time.localeCompare(b.start_time));
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "feature-empty";
    empty.textContent = t("noEvents");
    list.append(empty);
    return;
  }
  visible.forEach((item) => {
    const card = document.createElement("article");
    card.className = "agenda-event";
    const date = document.createElement("time");
    date.className = "agenda-event-date";
    date.dateTime = `${item.event_date}T${item.start_time}`;
    date.textContent = new Intl.DateTimeFormat(language, {
      weekday: "short", day: "numeric", month: "short",
    }).format(new Date(`${item.event_date}T12:00:00`));
    const copy = document.createElement("div");
    copy.className = "agenda-event-copy";
    const title = document.createElement("h3");
    title.textContent = item.title;
    const time = document.createElement("p");
    time.textContent = `${item.start_time.slice(0, 5)} – ${item.end_time.slice(0, 5)}`;
    copy.append(title, time);
    if (item.notes) {
      const notes = document.createElement("p");
      notes.className = "agenda-event-notes";
      notes.textContent = item.notes;
      copy.append(notes);
    }
    const actions = document.createElement("div");
    actions.className = "feature-card-actions";
    const edit = document.createElement("button");
    edit.className = "secondary-button";
    edit.type = "button";
    edit.textContent = t("editEvent");
    edit.addEventListener("click", () => openEventDialog(item));
    const remove = document.createElement("button");
    remove.className = "secondary-button danger-button";
    remove.type = "button";
    remove.textContent = t("deleteIdea");
    remove.addEventListener("click", () => deleteCalendarEvent(item.id));
    actions.append(edit, remove);
    card.append(date, copy, actions);
    list.append(card);
  });
}

async function deleteCalendarEvent(id) {
  if (!window.confirm(t("confirmDelete"))) return;
  try {
    if (currentUser && supabaseClient) {
      const { error } = await supabaseClient.from("calendar_events").delete().eq("id", id).eq("user_id", currentUser.id);
      if (error) throw new Error(error.message);
    }
    calendarEvents = calendarEvents.filter((item) => item.id !== id);
    if (!currentUser) saveLocalCollection(FEATURE_STORAGE_KEYS.events, calendarEvents);
    renderAgenda();
  } catch (error) {
    showToast(error.message || t("featureSaveError"), true);
  }
}

function openSlotDialog() {
  document.querySelector("#slot-form").reset();
  document.querySelector("#slot-error").hidden = true;
  const daySelect = document.querySelector("#slot-day");
  daySelect.replaceChildren(...WEEKDAYS.map((key, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = t(key);
    return option;
  }));
  document.querySelector("#slot-start").value = "09:00";
  document.querySelector("#slot-end").value = "10:00";
  document.querySelector("#slot-dialog").showModal();
}

function renderTimetable() {
  const grid = document.querySelector("#timetable-grid");
  if (!grid) return;
  grid.replaceChildren();
  WEEKDAYS.forEach((day, index) => {
    const column = document.createElement("section");
    column.className = "timetable-day";
    const heading = document.createElement("h3");
    heading.textContent = t(day);
    column.append(heading);
    const slots = timetableSlots.filter((slot) => Number(slot.weekday) === index)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    slots.forEach((slot) => {
      const card = document.createElement("article");
      card.className = "timetable-slot";
      const title = document.createElement("strong");
      title.textContent = slot.title;
      const time = document.createElement("time");
      time.textContent = `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`;
      card.append(title, time);
      if (slot.location) {
        const location = document.createElement("span");
        location.textContent = slot.location;
        card.append(location);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.title = t("deleteIdea");
      remove.setAttribute("aria-label", `${t("deleteIdea")}: ${slot.title}`);
      remove.addEventListener("click", () => deleteTimetableSlot(slot.id));
      card.append(remove);
      column.append(card);
    });
    grid.append(column);
  });
  renderPdfList();
}

function renderPdfList() {
  const list = document.querySelector("#pdf-list");
  if (!list) return;
  list.replaceChildren();
  if (!timetablePdfs.length) {
    const empty = document.createElement("span");
    empty.className = "pdf-empty";
    empty.textContent = t("noPdfs");
    list.append(empty);
    return;
  }
  timetablePdfs.forEach((file) => {
    const row = document.createElement("div");
    row.className = "pdf-item";
    const name = document.createElement("span");
    name.textContent = file.file_name;
    const open = document.createElement("button");
    open.className = "secondary-button";
    open.type = "button";
    open.textContent = t("openPdf");
    open.addEventListener("click", () => openTimetablePdf(file));
    const remove = document.createElement("button");
    remove.className = "secondary-button danger-button";
    remove.type = "button";
    remove.textContent = t("deletePdf");
    remove.addEventListener("click", () => deleteTimetablePdf(file));
    row.append(name, open, remove);
    list.append(row);
  });
}

async function saveCalendarEvent(item) {
  if (currentUser && supabaseClient) {
    const { error } = await supabaseClient.from("calendar_events").upsert({
      id: item.id, user_id: currentUser.id, title: item.title, event_date: item.event_date,
      start_time: item.start_time, end_time: item.end_time, notes: item.notes,
    });
    if (error) throw new Error(error.message);
  }
  calendarEvents = [item, ...calendarEvents.filter((eventItem) => eventItem.id !== item.id)];
  if (!currentUser) saveLocalCollection(FEATURE_STORAGE_KEYS.events, calendarEvents);
  renderAgenda();
}

async function saveTimetableSlot(slot) {
  if (currentUser && supabaseClient) {
    const { error } = await supabaseClient.from("timetable_slots").upsert({
      id: slot.id, user_id: currentUser.id, title: slot.title, weekday: slot.weekday,
      start_time: slot.start_time, end_time: slot.end_time, location: slot.location,
    });
    if (error) throw new Error(error.message);
  }
  timetableSlots = [...timetableSlots.filter((item) => item.id !== slot.id), slot];
  if (!currentUser) saveLocalCollection(FEATURE_STORAGE_KEYS.slots, timetableSlots);
  renderTimetable();
}

async function deleteTimetableSlot(id) {
  if (!window.confirm(t("confirmDelete"))) return;
  try {
    if (currentUser && supabaseClient) {
      const { error } = await supabaseClient.from("timetable_slots").delete().eq("id", id).eq("user_id", currentUser.id);
      if (error) throw new Error(error.message);
    }
    timetableSlots = timetableSlots.filter((slot) => slot.id !== id);
    if (!currentUser) saveLocalCollection(FEATURE_STORAGE_KEYS.slots, timetableSlots);
    renderTimetable();
  } catch (error) {
    showToast(error.message || t("featureSaveError"), true);
  }
}

async function openTimetablePdf(file) {
  if (!supabaseClient || !currentUser) {
    showToast(t("pdfSignIn"), true);
    return;
  }
  try {
    const { data, error } = await supabaseClient.storage.from("clair-timetable-pdfs")
      .createSignedUrl(file.storage_path, 60);
    if (error) throw new Error(error.message);
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteTimetablePdf(file) {
  if (!window.confirm(t("confirmDelete"))) return;
  try {
    const { error: storageError } = await supabaseClient.storage.from("clair-timetable-pdfs").remove([file.storage_path]);
    if (storageError) throw new Error(storageError.message);
    const { error } = await supabaseClient.from("timetable_pdfs").delete().eq("id", file.id).eq("user_id", currentUser.id);
    if (error) throw new Error(error.message);
    timetablePdfs = timetablePdfs.filter((item) => item.id !== file.id);
    renderPdfList();
  } catch (error) {
    showToast(error.message, true);
  }
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    render();
  });
});

document.querySelectorAll(".feature-tab").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelector("#mindmap-select").addEventListener("change", (event) => {
  selectedMindMapId = event.target.value;
  selectedIdeaId = "";
  renderMindMaps();
});
document.querySelector("#new-mindmap").addEventListener("click", () => {
  openTextDialog({ type: "new-map" }, "mindmapName", t("newMapName"));
});
document.querySelector("#rename-mindmap").addEventListener("click", () => {
    const map = mindMaps.find((item) => item.id === selectedMindMapId);
    if (!map) return;
    openTextDialog({ type: "rename-map", mapId: map.id }, "mindmapName", map.title);
});
document.querySelector("#delete-mindmap").addEventListener("click", async () => {
    const map = mindMaps.find((item) => item.id === selectedMindMapId);
    if (!map || !window.confirm(t("confirmDelete"))) return;
    try {
      if (currentUser && supabaseClient) {
        const { error } = await supabaseClient.from("mind_maps").delete().eq("id", map.id).eq("user_id", currentUser.id);
        if (error) throw new Error(error.message);
      }
      mindMaps = mindMaps.filter((item) => item.id !== map.id);
      if (!currentUser) saveLocalCollection(FEATURE_STORAGE_KEYS.mindMaps, mindMaps);
      selectedMindMapId = mindMaps[0]?.id || "";
      renderMindMaps();
    } catch (error) {
      showToast(error.message || t("featureSaveError"), true);
    }
});
document.querySelector("#add-mindmap-idea").addEventListener("click", async () => {
    const map = mindMaps.find((item) => item.id === selectedMindMapId);
    const input = document.querySelector("#mindmap-idea");
    const label = input.value.trim();
    if (!map || !label) return;
    const parentId = map.nodes.some((node) => node.id === selectedIdeaId) ? selectedIdeaId : null;
    map.nodes.push({ id: crypto.randomUUID(), label, parentId });
    input.value = "";
    try {
      await saveMindMap(map);
    } catch (error) {
      showToast(error.message, true);
    }
});
document.querySelector("#close-text").addEventListener("click", () => document.querySelector("#text-dialog").close());
document.querySelector("#text-dialog").addEventListener("close", () => {
  textAction = null;
});
document.querySelector("#text-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.querySelector("#text-error");
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await submitTextAction(document.querySelector("#text-value").value);
    } catch (saveError) {
      error.textContent = saveError.message || t("featureSaveError");
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
});

document.querySelector("#new-event").addEventListener("click", () => openEventDialog());
document.querySelector("#agenda-date").value = selectedAgendaDate;
document.querySelector("#agenda-date").addEventListener("change", (event) => {
    selectedAgendaDate = event.target.value;
    renderAgenda();
});
document.querySelector("#agenda-today").addEventListener("click", () => {
    selectedAgendaDate = localDateString(new Date());
    document.querySelector("#agenda-date").value = selectedAgendaDate;
    renderAgenda();
});
document.querySelector("#close-event").addEventListener("click", () => document.querySelector("#event-dialog").close());
document.querySelector("#event-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.querySelector("#event-title").value.trim();
    const date = document.querySelector("#event-date").value;
    const start = document.querySelector("#event-start").value;
    const end = document.querySelector("#event-end").value;
    const error = document.querySelector("#event-error");
    if (end <= start) {
      error.textContent = t("endBeforeStart");
      error.hidden = false;
      return;
    }
    const item = {
      id: editingEventId || crypto.randomUUID(), title, event_date: date,
      start_time: start, end_time: end, notes: document.querySelector("#event-notes").value.trim(),
    };
    try {
      await saveCalendarEvent(item);
      document.querySelector("#event-dialog").close();
    } catch (saveError) {
      error.textContent = saveError.message || t("featureSaveError");
      error.hidden = false;
    }
});

document.querySelector("#new-slot").addEventListener("click", openSlotDialog);
document.querySelector("#close-slot").addEventListener("click", () => document.querySelector("#slot-dialog").close());
document.querySelector("#slot-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const start = document.querySelector("#slot-start").value;
    const end = document.querySelector("#slot-end").value;
    const error = document.querySelector("#slot-error");
    if (end <= start) {
      error.textContent = t("endBeforeStart");
      error.hidden = false;
      return;
    }
    const slot = {
      id: crypto.randomUUID(),
      title: document.querySelector("#slot-title").value.trim(),
      weekday: Number(document.querySelector("#slot-day").value),
      start_time: start,
      end_time: end,
      location: document.querySelector("#slot-location").value.trim(),
    };
    try {
      await saveTimetableSlot(slot);
      document.querySelector("#slot-dialog").close();
    } catch (saveError) {
      error.textContent = saveError.message || t("featureSaveError");
      error.hidden = false;
    }
});
document.querySelector("#print-timetable").addEventListener("click", () => {
    showView("timetable");
    showToast(t("printNotice"));
    window.setTimeout(() => window.print(), 300);
});
document.querySelector("#pdf-upload").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" || !file.name.toLocaleLowerCase().endsWith(".pdf")) {
      showToast(t("invalidPdf"), true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(t("pdfTooLarge"), true);
      return;
    }
    if (!currentUser || !supabaseClient) {
      showToast(t("pdfSignIn"), true);
      return;
    }
    const id = crypto.randomUUID();
    const storagePath = `${currentUser.id}/${id}.pdf`;
    try {
      const { error: uploadError } = await supabaseClient.storage.from("clair-timetable-pdfs")
        .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data, error } = await supabaseClient.from("timetable_pdfs").insert({
        id, user_id: currentUser.id, storage_path: storagePath, file_name: file.name,
      }).select("id,file_name,storage_path,created_at").single();
      if (error) {
        await supabaseClient.storage.from("clair-timetable-pdfs").remove([storagePath]);
        throw new Error(error.message);
      }
      timetablePdfs.unshift(data);
      renderPdfList();
    } catch (error) {
      showToast(error.message, true);
    }
});

document.querySelector("#open-form").addEventListener("click", openForm);
document.querySelector("#empty-add").addEventListener("click", openForm);
document.querySelector("#close-form").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
searchInput.addEventListener("input", render);

function openForm() {
  document.querySelector("#form-error").hidden = true;
  form.reset();
  dialog.showModal();
  document.querySelector("#task-title").focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const submitButton = form.querySelector(".submit-button");
  submitButton.disabled = true;
  try {
    const title = String(formData.get("title") || "").trim();
    if (!title) throw new Error(t("taskQuestion"));
    const task = {
      id: crypto.randomUUID(),
      title,
      description: String(formData.get("description") || "").trim(),
      priority: String(formData.get("priority") || "normale"),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    await saveTask(task);
    tasks = [task, ...tasks.filter((item) => item.id !== task.id)];
    activeFilter = "all";
    searchInput.value = "";
    render();
    dialog.close();
    showToast(currentUser ? t("taskAdded") : t("taskAddedOffline"));
  } catch (error) {
    const formError = document.querySelector("#form-error");
    formError.textContent = error.message;
    formError.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});

async function updateTask(id, changes) {
  try {
    const updatedTask = { ...tasks.find((task) => task.id === id), ...changes };
    await saveTask(updatedTask);
    tasks = tasks.map((task) => task.id === id ? updatedTask : task);
    render();
  } catch (error) {
    showToast(error.message || t("impossibleSave"), true);
  }
}

async function deleteTask(id) {
  try {
    if (currentUser && supabaseClient) {
      const { error } = await supabaseClient.from("tasks")
        .delete().eq("id", id).eq("user_id", currentUser.id);
      if (error) throw new Error(error.message);
      tasks = tasks.filter((task) => task.id !== id);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.filter((task) => task.id !== id)));
      tasks = tasks.filter((task) => task.id !== id);
    }
    render();
    showToast(t("taskDeleted"));
  } catch (error) {
    showToast(error.message || t("impossibleSave"), true);
  }
}

document.querySelector("#theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("theme-dark");
  try {
    localStorage.setItem("clair-theme", document.body.classList.contains("theme-dark") ? "dark" : "light");
  } catch {
    showToast(t("impossibleSave"), true);
  }
});

document.querySelector("#language-select").addEventListener("change", (event) => setLanguage(event.target.value));
document.querySelector("#account-button").addEventListener("click", openAuth);
document.querySelector("#close-auth").addEventListener("click", () => document.querySelector("#auth-dialog").close());
document.querySelector("#auth-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.querySelector("#auth-switch").addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  openAuth();
});

document.querySelector("#google-sign-in").addEventListener("click", async () => {
  if (!requireSupabase()) return;
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href.split("#")[0] },
    });
    if (error) showToast(error.message, true);
  } catch (error) {
    showToast(error.message, true);
  }
});

document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireSupabase()) return;
  const submit = document.querySelector("#auth-submit");
  const notice = document.querySelector("#auth-notice");
  submit.disabled = true;
  notice.textContent = t("loadingAccount");
  try {
    const email = document.querySelector("#auth-email").value.trim();
    const password = document.querySelector("#auth-password").value;
    let result;
    if (authMode === "signup") {
      const username = document.querySelector("#auth-username").value.trim();
      result = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { username }, emailRedirectTo: window.location.href.split("#")[0] },
      });
      if (!result.error) {
        notice.textContent = t("accountCreated");
        document.querySelector("#auth-form").reset();
        return;
      }
    } else {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
    }
    if (result.error) throw result.error;
    notice.textContent = t(authMode === "signup" ? "accountCreated" : "signedIn");
    if (result.data.session) {
      authMode = "signin";
      document.querySelector("#auth-dialog").close();
    } else if (authMode === "signin") {
      showToast(t("emailLinkSent"));
    }
  } catch (error) {
    notice.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    document.querySelector("#auth-dialog").close();
    showToast(t("signedOut"));
  } catch (error) {
    showToast(error.message, true);
  }
});

document.querySelector("#import-local").addEventListener("click", async () => {
  if (!supabaseClient || !currentUser || deviceTasksToImport.length === 0) return;
  const button = document.querySelector("#import-local");
  button.disabled = true;
  try {
    const rows = deviceTasksToImport.map((task) => ({
      id: task.id,
      user_id: currentUser.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      completed: task.completed,
      created_at: task.createdAt,
    }));
    const { error } = await supabaseClient.from("tasks").insert(rows);
    if (error) throw new Error(error.message);
    deviceTasksToImport = [];
    await fetchCloudTasks();
    button.hidden = true;
    showToast(t("taskAdded"));
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && dialog.open) dialog.close();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && currentUser) {
    fetchCloudTasks().catch((error) => showToast(error.message, true));
    loadWorkspaceData().catch((error) => showToast(error.message, true));
  }
});

try {
  const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
  language = translationsAvailable && LANGUAGES[savedLanguage] ? savedLanguage : "fr";
  if (localStorage.getItem("clair-theme") === "dark") document.body.classList.add("theme-dark");
} catch {
  language = "fr";
}
applyTranslations();

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
    window.setTimeout(() => setCurrentUser(session?.user || null), 0);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) showToast(error.message, true);
    setCurrentUser(data.session?.user || null);
  });
} else {
  try {
    tasks = localTasks();
    render();
    loadWorkspaceData();
  } catch (error) {
    taskLoadFailed = true;
    showToast(error.message || t("badSavedData"), true);
    render();
  }
}
