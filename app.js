const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const dialog = document.querySelector("#task-dialog");
const form = document.querySelector("#task-form");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#search-input");
const STORAGE_KEY = "clair-tasks";

let tasks = [];
let activeFilter = "all";
let toastTimer;

const filterLabels = {
  all: "Vue d’ensemble",
  active: "À faire",
  completed: "Terminées",
};

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3000);
}

function saveTasks(nextTasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
  } catch {
    throw new Error("Impossible d’enregistrer vos tâches dans ce navigateur.");
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? "Aujourd’hui"
    : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
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
  check.setAttribute("aria-label", task.completed ? "Marquer comme à faire" : "Marquer comme terminée");
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
  priority.textContent = { basse: "Faible", normale: "Normale", haute: "Élevée" }[task.priority] || "Normale";

  const date = document.createElement("time");
  date.className = "task-date";
  date.dateTime = task.createdAt;
  date.textContent = formatDate(task.createdAt);

  const remove = document.createElement("button");
  remove.className = "task-delete";
  remove.type = "button";
  remove.setAttribute("aria-label", `Supprimer ${task.title}`);
  remove.title = "Supprimer la tâche";
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
    tasks.length && progress === 100 ? "Bravo, tout est accompli !" : "Chaque chose en son temps.";
  document.querySelector("#nav-total").textContent = tasks.length;
  document.querySelector("#nav-active").textContent = remainingCount;
  document.querySelector("#filter-all-count").textContent = tasks.length;
  document.querySelector("#footer-count").textContent = `${tasks.length} ${tasks.length > 1 ? "tâches" : "tâche"} au total`;

  const query = searchInput.value.trim().toLocaleLowerCase("fr");
  const visibleTasks = tasks.filter((task) => {
    const matchesFilter = activeFilter === "all"
      || (activeFilter === "active" && !task.completed)
      || (activeFilter === "completed" && task.completed);
    const matchesSearch = `${task.title} ${task.description}`.toLocaleLowerCase("fr").includes(query);
    return matchesFilter && matchesSearch;
  });

  taskList.replaceChildren(...visibleTasks.map(createTaskRow));
  const showEmpty = visibleTasks.length === 0;
  emptyState.hidden = !showEmpty;
  taskList.hidden = showEmpty;
  document.querySelector("#list-footer").hidden = showEmpty;
  document.querySelector("#empty-title").textContent = tasks.length
    ? query ? "Aucun résultat pour cette recherche." : "Tout est accompli."
    : "Tout commence par une idée.";
  document.querySelector("#empty-copy").textContent = tasks.length
    ? query ? "Essayez un autre mot ou changez de filtre." : "Vous pouvez savourer ce moment, ou ajouter une nouvelle tâche."
    : "Ajoutez une première tâche et donnez-lui vie.";
  document.querySelector("#empty-add").hidden = tasks.length > 0;

  document.querySelectorAll("[data-filter]").forEach((button) => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle("selected", selected);
    button.classList.toggle("active", button.classList.contains("nav-link") && selected);
    if (button.classList.contains("filter-tab")) {
      button.setAttribute("aria-pressed", String(selected));
    }
  });
  document.querySelector("#breadcrumb-current").textContent = filterLabels[activeFilter];
}

function loadTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    tasks = savedTasks ? JSON.parse(savedTasks) : [];
    if (!Array.isArray(tasks)) throw new Error("Les données enregistrées ne sont pas une liste.");
    render();
  } catch (error) {
    showToast(error.message || "Impossible de lire les tâches enregistrées.", true);
    emptyState.hidden = false;
    taskList.hidden = true;
    document.querySelector("#empty-title").textContent = "Impossible de charger vos tâches.";
    document.querySelector("#empty-copy").textContent = "Les données enregistrées dans ce navigateur sont illisibles.";
    document.querySelector("#empty-add").hidden = true;
    document.querySelector("#list-footer").hidden = true;
  }
}

function updateTask(id, changes) {
  try {
    const nextTasks = tasks.map((task) => task.id === id ? { ...task, ...changes } : task);
    saveTasks(nextTasks);
    tasks = nextTasks;
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function deleteTask(id) {
  try {
    const nextTasks = tasks.filter((task) => task.id !== id);
    saveTasks(nextTasks);
    tasks = nextTasks;
    render();
    showToast("Tâche supprimée. Un peu plus de place pour l’essentiel.");
  } catch (error) {
    showToast(error.message, true);
  }
}

function openForm() {
  document.querySelector("#form-error").hidden = true;
  form.reset();
  dialog.showModal();
  document.querySelector("#task-title").focus();
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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const submitButton = form.querySelector(".submit-button");
  submitButton.disabled = true;
  try {
    const title = String(formData.get("title") || "").trim();
    const newTask = {
      id: crypto.randomUUID(),
      title,
      description: String(formData.get("description") || "").trim(),
      priority: String(formData.get("priority") || "normale"),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const nextTasks = [newTask, ...tasks];
    saveTasks(nextTasks);
    tasks = nextTasks;
    activeFilter = "all";
    searchInput.value = "";
    render();
    dialog.close();
    showToast("Votre tâche a été ajoutée. À vous de jouer !");
  } catch (error) {
    const formError = document.querySelector("#form-error");
    formError.textContent = error.message;
    formError.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("theme-dark");
  try {
    localStorage.setItem("clair-theme", document.body.classList.contains("theme-dark") ? "dark" : "light");
  } catch {
    showToast("Le thème ne peut pas être mémorisé dans ce navigateur.", true);
  }
});
try {
  if (localStorage.getItem("clair-theme") === "dark") document.body.classList.add("theme-dark");
} catch {
  showToast("Le thème enregistré ne peut pas être lu dans ce navigateur.", true);
}

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && dialog.open) dialog.close();
});

document.querySelector("#today-date").textContent = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

loadTasks();
