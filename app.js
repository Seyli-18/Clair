const translations = window.CLAIR_TRANSLATIONS || {};
const supportedLanguages = ["fr", "en", "ar", "it", "es", "de"];
const supabaseConfig = window.CLAIR_SUPABASE_CONFIG;
const supabaseLibrary = window.supabase;
const languageKey = "clair-language";
const rarityKeys = {
  common: "common",
  rare: "rare",
  epic: "epic",
  legendary: "legendary",
};

const supabaseClient = supabaseConfig?.url && supabaseConfig?.anonKey && supabaseLibrary?.createClient
  ? supabaseLibrary.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

let language = "fr";
let currentUser = null;
let catalog = [];
let collection = [];
let packs = [];
let activePanel = "collection";
let activeAnimeFilter = "";
let accountInitialized = false;
let dataReady = false;
let dataError = "";
let authMode = "signin";
let loadingPack = false;
let toastTimer;

const authDialog = document.querySelector("#auth-dialog");
const revealDialog = document.querySelector("#reveal-dialog");
const toast = document.querySelector("#toast");

function t(key, values = {}) {
  const message = translations[language]?.[key] || translations.fr?.[key] || key;
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    message,
  );
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function notify(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 4200);
}

function applyTranslations() {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = t("pageTitle");
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
  document.querySelector("#language-select").value = language;
  render();
}

function setLanguage(nextLanguage) {
  if (!supportedLanguages.includes(nextLanguage) || !translations[nextLanguage]) return;
  language = nextLanguage;
  try {
    localStorage.setItem(languageKey, language);
  } catch (error) {
    notify(error.message || t("languageSaveError"), true);
  }
  applyTranslations();
}

function cardArt(card) {
  const image = card.image_url
    ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.character_name)}" loading="lazy" referrerpolicy="no-referrer">`
    : "";
  const initials = card.character_name.trim().slice(0, 1).toLocaleUpperCase(language);
  return `<div class="character-art rarity-${escapeHtml(card.rarity)}"><span class="card-art-glow"></span><span class="card-initial">${escapeHtml(initials || "✦")}</span>${image}<span class="card-art-symbol" aria-hidden="true">✦</span></div>`;
}

function cardMarkup(card, duplicateCount = 1) {
  const copies = duplicateCount > 1
    ? `<span class="copy-count">×${duplicateCount}</span>`
    : "";
  return `<article class="character-card rarity-${escapeHtml(card.rarity)}">${cardArt(card)}<div class="character-card-copy"><p class="character-anime">${escapeHtml(card.anime_name)}</p><h3>${escapeHtml(card.character_name)}</h3><span class="rarity-label">${escapeHtml(t(rarityKeys[card.rarity] || "common"))}</span></div>${copies}</article>`;
}

function attachImageFallbacks(container) {
  container.querySelectorAll(".character-art img, .catalog-row-art img").forEach((image) => {
    image.addEventListener("error", () => image.remove(), { once: true });
  });
}

function uniqueAnimeNames() {
  return [...new Set(catalog.map((card) => card.anime_name))]
    .sort((first, second) => first.localeCompare(second, language));
}

function renderCollection() {
  const search = document.querySelector("#collection-search").value.trim().toLocaleLowerCase(language);
  const animeNames = [...new Set(collection.map((entry) => entry.card_data.anime_name))]
    .sort((first, second) => first.localeCompare(second, language));
  if (activeAnimeFilter && !animeNames.includes(activeAnimeFilter)) activeAnimeFilter = "";
  const filters = document.querySelector("#collection-filters");
  filters.innerHTML = [
    `<button type="button" class="filter-chip${activeAnimeFilter ? "" : " selected"}" data-anime-filter="">${escapeHtml(t("allAnime"))}<span>${collection.length}</span></button>`,
    ...animeNames.map((anime) => {
      const count = collection.filter((entry) => entry.card_data.anime_name === anime).length;
      return `<button type="button" class="filter-chip${activeAnimeFilter === anime ? " selected" : ""}" data-anime-filter="${escapeHtml(anime)}">${escapeHtml(anime)}<span>${count}</span></button>`;
    }),
  ].join("");

  const filtered = collection.filter((entry) => {
    const card = entry.card_data;
    const matchesAnime = !activeAnimeFilter || card.anime_name === activeAnimeFilter;
    const matchesSearch = !search
      || card.character_name.toLocaleLowerCase(language).includes(search)
      || card.anime_name.toLocaleLowerCase(language).includes(search);
    return matchesAnime && matchesSearch;
  });
  const duplicates = new Map();
  collection.forEach((entry) => {
    const key = `${entry.card_data.anime_name}\u0000${entry.card_data.character_name}`;
    duplicates.set(key, (duplicates.get(key) || 0) + 1);
  });
  const grid = document.querySelector("#collection-grid");
  grid.innerHTML = filtered.map((entry) => {
    const key = `${entry.card_data.anime_name}\u0000${entry.card_data.character_name}`;
    return cardMarkup(entry.card_data, duplicates.get(key));
  }).join("");
  attachImageFallbacks(grid);
  document.querySelector("#collection-count").textContent = collection.length.toLocaleString(language);
  document.querySelector("#collection-subcount").textContent = t("showingCards", {
    shown: filtered.length,
    total: collection.length,
  });
  document.querySelector("#collection-empty").hidden = collection.length > 0;
  grid.hidden = collection.length === 0;
  if (collection.length > 0 && filtered.length === 0) {
    grid.innerHTML = `<div class="search-empty">${escapeHtml(t("noMatchingCards"))}</div>`;
    grid.hidden = false;
  }
}

function renderCatalog() {
  const grid = document.querySelector("#catalog-list");
  const countLabel = document.querySelector("#catalog-count");
  countLabel.textContent = catalog.length.toLocaleString(language);
  grid.innerHTML = catalog.map((card) => `
    <article class="catalog-row">
      <div class="catalog-row-art rarity-${escapeHtml(card.rarity)}">
        ${card.image_url ? `<img src="${escapeHtml(card.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${escapeHtml(card.character_name.slice(0, 1).toLocaleUpperCase(language))}</span>`}
      </div>
      <div class="catalog-row-copy"><strong>${escapeHtml(card.character_name)}</strong><span>${escapeHtml(card.anime_name)}</span></div>
      <span class="rarity-label">${escapeHtml(t(rarityKeys[card.rarity] || "common"))}</span>
      <button class="icon-action delete-catalog-card" type="button" data-card-id="${escapeHtml(card.id)}" aria-label="${escapeHtml(t("removeCharacter", { name: card.character_name }))}" title="${escapeHtml(t("removeCharacter", { name: card.character_name }))}">×</button>
    </article>`).join("");
  attachImageFallbacks(grid);
  document.querySelector("#catalog-empty").hidden = catalog.length > 0;
  grid.hidden = catalog.length === 0;

  const animeSelect = document.querySelector("#anime-select");
  const previous = animeSelect.value;
  const animeNames = uniqueAnimeNames();
  animeSelect.innerHTML = animeNames.length
    ? animeNames.map((anime) => `<option value="${escapeHtml(anime)}">${escapeHtml(anime)}</option>`).join("")
    : `<option value="" disabled>${escapeHtml(t("noAnime"))}</option>`;
  if (animeNames.includes(previous)) animeSelect.value = previous;
}

function startOfUtcDay(date = new Date()) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function shortDuration(milliseconds) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  if (days > 0) return t("timeDaysHours", { days, hours: hours % 24 });
  if (hours > 0) return t("timeHoursMinutes", { hours, minutes });
  return t("timeMinutes", { minutes: Math.max(1, minutes) });
}

function renderPackStatus() {
  const now = Date.now();
  const todayStart = startOfUtcDay();
  const todayPacks = packs.filter((pack) => new Date(pack.opened_at).getTime() >= todayStart && pack.pack_type === "daily").length;
  const dailyRemaining = Math.max(0, 2 - todayPacks);
  const latestSpecial = packs
    .filter((pack) => pack.pack_type === "anime")
    .map((pack) => new Date(pack.opened_at).getTime())
    .sort((first, second) => second - first)[0];
  const specialAvailableAt = latestSpecial ? latestSpecial + 72 * 60 * 60 * 1000 : 0;
  const specialRemaining = Math.max(0, specialAvailableAt - now);
  const catalogAvailable = dataReady && catalog.length > 0;

  document.querySelector("#daily-packs-remaining").textContent = `${dailyRemaining} / 2`;
  document.querySelector("#daily-progress-fill").style.width = `${(dailyRemaining / 2) * 100}%`;
  document.querySelector("#daily-reset-label").textContent = t("dailyReset");
  document.querySelector("#daily-pack-button").disabled = loadingPack || dailyRemaining === 0 || !catalogAvailable;
  const specialLabel = document.querySelector("#special-reset-label");
  specialLabel.textContent = specialRemaining
    ? t("specialReset", { time: shortDuration(specialRemaining) })
    : t("specialReady");
  document.querySelector("#anime-pack-button").disabled = loadingPack
    || specialRemaining > 0
    || !document.querySelector("#anime-select").value
    || !catalogAvailable;
}

function renderPanels() {
  document.querySelectorAll("[data-panel-content]").forEach((panel) => {
    const selected = panel.dataset.panelContent === activePanel;
    panel.hidden = !selected;
    panel.classList.toggle("active", selected);
  });
  document.querySelectorAll("[data-panel]").forEach((button) => {
    const selected = button.dataset.panel === activePanel;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-current", selected ? "page" : "false");
  });
}

function render() {
  const signedIn = Boolean(currentUser);
  document.querySelector("#auth-gate").hidden = signedIn;
  document.querySelector("#game-content").hidden = !signedIn;
  document.querySelector("#account-button").textContent = signedIn
    ? currentUser.user_metadata?.username || currentUser.email || t("myAccount")
    : t("signIn");
  document.querySelector("#collection-count").textContent = collection.length.toLocaleString(language);
  document.querySelector("#data-error").hidden = !dataError;
  document.querySelector("#data-error").textContent = dataError;
  renderPanels();
  if (!signedIn) return;
  renderCollection();
  renderCatalog();
  renderPackStatus();
}

async function loadAccountData() {
  if (!supabaseClient || !currentUser) return;
  const userId = currentUser.id;
  dataReady = false;
  dataError = "";
  renderPackStatus();
  const [catalogResult, collectionResult, packsResult] = await Promise.all([
    supabaseClient.from("card_catalog")
      .select("id,anime_name,character_name,image_url,rarity,created_at")
      .eq("user_id", userId)
      .order("anime_name", { ascending: true })
      .order("character_name", { ascending: true }),
    supabaseClient.from("user_collection")
      .select("id,card_data,pack_id,acquired_at")
      .eq("user_id", userId)
      .order("acquired_at", { ascending: false }),
    supabaseClient.from("card_packs")
      .select("id,pack_type,anime_name,cards,opened_at")
      .eq("user_id", userId)
      .order("opened_at", { ascending: false }),
  ]);
  if (currentUser?.id !== userId) return;
  const failed = [catalogResult, collectionResult, packsResult].find((result) => result.error);
  if (failed) throw new Error(failed.error.message);
  catalog = catalogResult.data || [];
  collection = collectionResult.data || [];
  packs = packsResult.data || [];
  dataReady = true;
  dataError = "";
  render();
}

async function setCurrentUser(user) {
  if (accountInitialized && currentUser?.id === user?.id) return;
  accountInitialized = true;
  currentUser = user;
  catalog = [];
  collection = [];
  packs = [];
  dataReady = false;
  dataError = "";
  if (user && supabaseClient) {
    try {
      await loadAccountData();
    } catch (error) {
      dataError = t("dataLoadError", { error: error.message });
      notify(dataError, true);
    }
  }
  render();
}

function showAuth() {
  authMode = currentUser ? "account" : "signin";
  document.querySelector("#auth-controls").hidden = Boolean(currentUser);
  document.querySelector("#signed-in-controls").hidden = !currentUser;
  document.querySelector("#auth-notice").textContent = supabaseClient ? "" : t("supabaseSetup");
  document.querySelector("#auth-user").textContent = currentUser?.email || "";
  document.querySelector("#username-field").hidden = authMode !== "signup";
  document.querySelector("#auth-switch").hidden = authMode === "account";
  applyTranslations();
  authDialog.showModal();
}

function redirectUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}

async function signInWithProvider(provider) {
  if (!supabaseClient) {
    notify(t("supabaseSetup"), true);
    return;
  }
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectUrl() },
    });
    if (error) throw error;
  } catch (error) {
    notify(error.message || t("signInError"), true);
  }
}

async function openPack(packType, animeName = "") {
  if (!currentUser) {
    showAuth();
    return;
  }
  if (!supabaseClient || !dataReady || loadingPack) return;
  loadingPack = true;
  renderPackStatus();
  try {
    const { data, error } = await supabaseClient.rpc("open_card_pack", {
      p_pack_type: packType,
      p_anime_name: packType === "anime" ? animeName : null,
    });
    if (error) throw error;
    await loadAccountData();
    const pack = data?.pack || data;
    const openedCards = Array.isArray(pack?.cards) ? pack.cards : [];
    if (openedCards.length !== (packType === "daily" ? 5 : 8)) {
      throw new Error(t("unexpectedPack"));
    }
    showReveal(pack, openedCards);
  } catch (error) {
    notify(error.message || t("packError"), true);
  } finally {
    loadingPack = false;
    renderPackStatus();
  }
}

function showReveal(pack, cards) {
  const title = pack.pack_type === "anime"
    ? t("animeRevealTitle", { anime: pack.anime_name })
    : t("dailyRevealTitle");
  document.querySelector("#reveal-subtitle").textContent = t("cardsAdded", { count: cards.length });
  document.querySelector("#reveal-title").textContent = title;
  const grid = document.querySelector("#reveal-grid");
  grid.innerHTML = cards.map((card) => cardMarkup(card)).join("");
  attachImageFallbacks(grid);
  revealDialog.showModal();
}

document.querySelector("#language-select").addEventListener("change", (event) => setLanguage(event.target.value));
document.querySelector("#account-button").addEventListener("click", showAuth);
document.querySelector("#gate-sign-in").addEventListener("click", showAuth);
document.querySelector("#close-auth").addEventListener("click", () => authDialog.close());
document.querySelector("#close-reveal").addEventListener("click", () => revealDialog.close());
document.querySelector("#reveal-done").addEventListener("click", () => {
  revealDialog.close();
  activePanel = "collection";
  renderPanels();
});
document.querySelector("#auth-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) authDialog.close();
});
document.querySelector("#reveal-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) revealDialog.close();
});
document.querySelector("#auth-switch").addEventListener("click", () => {
  authMode = authMode === "signup" ? "signin" : "signup";
  document.querySelector("#username-field").hidden = authMode !== "signup";
  document.querySelector("#auth-password").autocomplete = authMode === "signup" ? "new-password" : "current-password";
  applyTranslations();
});
document.querySelector("#google-sign-in").addEventListener("click", () => signInWithProvider("google"));
document.querySelector("#discord-sign-in").addEventListener("click", () => signInWithProvider("discord"));
document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    document.querySelector("#auth-notice").textContent = t("supabaseSetup");
    return;
  }
  const submit = document.querySelector("#auth-submit");
  const notice = document.querySelector("#auth-notice");
  submit.disabled = true;
  notice.textContent = t("loadingAccount");
  try {
    const email = document.querySelector("#auth-email").value.trim();
    const password = document.querySelector("#auth-password").value;
    const response = authMode === "signup"
      ? await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { username: document.querySelector("#auth-username").value.trim() },
          emailRedirectTo: redirectUrl(),
        },
      })
      : await supabaseClient.auth.signInWithPassword({ email, password });
    if (response.error) throw response.error;
    if (authMode === "signup" && !response.data.session) {
      notice.textContent = t("accountCreated");
      document.querySelector("#auth-form").reset();
      return;
    }
    if (response.data.session) {
      authDialog.close();
      await setCurrentUser(response.data.session.user);
      notify(t("signedIn"));
    } else {
      notice.textContent = t("emailLinkSent");
    }
  } catch (error) {
    notice.textContent = error.message || t("signInError");
  } finally {
    submit.disabled = false;
  }
});
document.querySelector("#sign-out").addEventListener("click", async () => {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    authDialog.close();
    await setCurrentUser(null);
    notify(t("signedOut"));
  } catch (error) {
    notify(error.message || t("signOutError"), true);
  }
});

document.querySelector("#catalog-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorOutput = document.querySelector("#catalog-error");
  errorOutput.hidden = true;
  if (!currentUser || !supabaseClient) {
    showAuth();
    return;
  }
  const imageValue = document.querySelector("#image-url").value.trim();
  if (imageValue) {
    try {
      if (new URL(imageValue).protocol !== "https:") throw new Error(t("httpsImageRequired"));
    } catch (error) {
      errorOutput.textContent = error.message || t("httpsImageRequired");
      errorOutput.hidden = false;
      return;
    }
  }
  const submit = document.querySelector("#catalog-submit");
  submit.disabled = true;
  const newCard = {
    user_id: currentUser.id,
    anime_name: document.querySelector("#anime-name").value.trim(),
    character_name: document.querySelector("#character-name").value.trim(),
    image_url: imageValue || null,
    rarity: document.querySelector("#character-rarity").value,
  };
  try {
    const { error } = await supabaseClient.from("card_catalog").insert(newCard);
    if (error) throw error;
    document.querySelector("#catalog-form").reset();
    await loadAccountData();
    notify(t("characterAdded"));
  } catch (error) {
    errorOutput.textContent = error.message || t("catalogSaveError");
    errorOutput.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#catalog-list").addEventListener("click", async (event) => {
  const button = event.target.closest(".delete-catalog-card");
  if (!button || !currentUser || !supabaseClient) return;
  const card = catalog.find((entry) => entry.id === button.dataset.cardId);
  if (!card || !window.confirm(t("confirmRemoveCharacter", { name: card.character_name }))) return;
  button.disabled = true;
  try {
    const { error } = await supabaseClient.from("card_catalog")
      .delete().eq("id", card.id).eq("user_id", currentUser.id);
    if (error) throw error;
    await loadAccountData();
    notify(t("characterRemoved"));
  } catch (error) {
    button.disabled = false;
    notify(error.message || t("catalogSaveError"), true);
  }
});

document.querySelector("#daily-pack-button").addEventListener("click", () => openPack("daily"));
document.querySelector("#anime-pack-button").addEventListener("click", () => {
  const animeName = document.querySelector("#anime-select").value;
  if (animeName) openPack("anime", animeName);
});
document.querySelector("#anime-select").addEventListener("change", renderPackStatus);
document.querySelector("#collection-search").addEventListener("input", renderCollection);
document.querySelector("#collection-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-anime-filter]");
  if (!button) return;
  activeAnimeFilter = button.dataset.animeFilter;
  renderCollection();
});
document.querySelector("#collection-grid").addEventListener("click", (event) => {
  const card = event.target.closest(".character-card");
  if (!card) return;
  card.classList.toggle("card-flipped");
});
document.querySelector("#reveal-grid").addEventListener("click", (event) => {
  const card = event.target.closest(".character-card");
  if (!card) return;
  card.classList.toggle("card-flipped");
});
document.querySelectorAll("[data-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    activePanel = button.dataset.panel;
    renderPanels();
  });
});
document.querySelectorAll("[data-go-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    activePanel = button.dataset.goPanel;
    renderPanels();
  });
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && currentUser && supabaseClient) {
    loadAccountData().catch((error) => {
      dataError = t("dataLoadError", { error: error.message });
      render();
      notify(dataError, true);
    });
  }
});

try {
  const savedLanguage = localStorage.getItem(languageKey);
  if (supportedLanguages.includes(savedLanguage) && translations[savedLanguage]) language = savedLanguage;
} catch (error) {
  notify(error.message || t("languageSaveError"), true);
}
document.querySelector("#auth-password").autocomplete = "current-password";
applyTranslations();
window.setInterval(renderPackStatus, 60000);

if (!supabaseClient) {
  render();
} else {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
    window.setTimeout(() => {
      setCurrentUser(session?.user || null).catch((error) => {
        dataError = t("dataLoadError", { error: error.message });
        render();
        notify(dataError, true);
      });
    }, 0);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      notify(error.message, true);
      return;
    }
    setCurrentUser(data.session?.user || null).catch((loadError) => {
      dataError = t("dataLoadError", { error: loadError.message });
      render();
      notify(dataError, true);
    });
  });
}
