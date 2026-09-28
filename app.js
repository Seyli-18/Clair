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

function t(key, values = {}) {
  const message = LANGUAGES[language]?.[key] || LANGUAGES.fr?.[key] || key;
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
  render();
  updateAccountButton();
}

function setLanguage(nextLanguage) {
  if (!LANGUAGES[nextLanguage]) return;
  language = nextLanguage;
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    showToast(t("impossibleSave"), true);
  }
  applyTranslations();
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
    updateAccountButton();
    applyTranslations();
    return;
  }

  try {
    await fetchCloudTasks();
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
  document.querySelector("#auth-notice").textContent = "";
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
  document.querySelector("#auth-notice").textContent = supabaseClient ? "" : t("supabaseSetup");
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

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    render();
  });
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
  }
});

try {
  language = LANGUAGES[localStorage.getItem(LANGUAGE_KEY)] ? localStorage.getItem(LANGUAGE_KEY) : "fr";
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
  } catch (error) {
    taskLoadFailed = true;
    showToast(error.message || t("badSavedData"), true);
    render();
  }
}
