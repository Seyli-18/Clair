const translations = window.CLAIR_TRANSLATIONS || {};
const supportedLanguages = ["fr", "en", "ar", "it", "es", "de"];
const supabaseConfig = window.CLAIR_SUPABASE_CONFIG;
const supabaseLibrary = window.supabase;
const languageKey = "clair-language";
const rarityFallbackColors = {
  common: "#7edac0",
  rare: "#79b9ff",
  epic: "#d698ff",
  legendary: "#ffd27c",
};

const supabaseClient = supabaseConfig?.url && supabaseConfig?.anonKey && supabaseLibrary?.createClient
  ? supabaseLibrary.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

let language = "fr";
let currentUser = null;
let animeSeries = [];
let rarityLevels = [];
let characterCards = [];
let collection = [];
let packs = [];
let activePanel = "collection";
let activeAnimeFilter = "";
let accountInitialized = false;
let dataReady = false;
let dataError = "";
let isOwner = false;
let authMode = "signin";
let loadingPack = false;
let editingAnimeId = "";
let editingCardId = "";
let editingRarityId = "";
let toastTimer;

const authDialog = document.querySelector("#auth-dialog");
const revealDialog = document.querySelector("#reveal-dialog");
const openingDialog = document.querySelector("#opening-dialog");
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
        : t(authMode === "signup" ? "createAccount" : "signIn");
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

function safeColor(value, fallback = "#b496ff") {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

function cardArt(card) {
  const image = card.image_url
    ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.character_name)}" loading="lazy" referrerpolicy="no-referrer">`
    : "";
  const initials = card.character_name.trim().slice(0, 1).toLocaleUpperCase(language);
  return `<div class="character-art"><span class="card-art-glow"></span><span class="card-initial">${escapeHtml(initials || "✦")}</span>${image}<span class="card-art-symbol" aria-hidden="true">✦</span></div>`;
}

function cardMarkup(card, duplicateCount = 1, revealIndex = -1) {
  const copies = duplicateCount > 1
    ? `<span class="copy-count">×${duplicateCount}</span>`
    : "";
  const accent = safeColor(card.rarity_color, rarityFallbackColors[card.rarity] || "#b496ff");
  const details = [
    card.anime_name ? `<span>${escapeHtml(card.anime_name)}</span>` : "",
    card.manga_artist ? `<span>${escapeHtml(t("mangaka"))} · ${escapeHtml(card.manga_artist)}</span>` : "",
    card.description ? `<p>${escapeHtml(card.description)}</p>` : `<p>${escapeHtml(t("noCharacterNote"))}</p>`,
    `<span class="details-hint">${escapeHtml(t("tapCardDetails"))}</span>`,
  ].filter(Boolean).join("");
  return `<article class="character-card${revealIndex >= 0 ? " reveal-card" : ""}" style="--card-accent:${accent}" role="button" tabindex="0" aria-expanded="false" aria-label="${escapeHtml(t("cardFor", { name: card.character_name }))}"><div class="character-card-front" aria-hidden="false">${cardArt(card)}<div class="character-card-copy"><p class="character-anime">${escapeHtml(card.anime_name)}</p><h3>${escapeHtml(card.character_name)}</h3><span class="rarity-label">${escapeHtml(card.rarity_name || card.rarity || t("common"))}</span></div>${copies}</div><div class="character-card-details" aria-hidden="true"><strong>${escapeHtml(card.character_name)}</strong>${details}</div></article>`;
}

function attachImageFallbacks(container) {
  container.querySelectorAll(".character-art img, .anime-record-image img").forEach((image) => {
    image.addEventListener("error", () => image.remove(), { once: true });
  });
}

function toggleCardDetails(card) {
  if (!card) return;
  const expanded = card.classList.toggle("card-flipped");
  card.setAttribute("aria-expanded", String(expanded));
  card.querySelector(".character-card-front").setAttribute("aria-hidden", String(expanded));
  card.querySelector(".character-card-details").setAttribute("aria-hidden", String(!expanded));
}

function activeAnimesForPacks() {
  const availableIds = new Set(characterCards
    .filter((card) => card.is_active && card.rarity?.is_active)
    .map((card) => card.anime_id));
  return animeSeries.filter((anime) => anime.is_active && availableIds.has(anime.id));
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
    const searchable = [card.character_name, card.anime_name, card.manga_artist, card.rarity_name]
      .join(" ").toLocaleLowerCase(language);
    return matchesAnime && (!search || searchable.includes(search));
  });
  const duplicates = new Map();
  collection.forEach((entry) => {
    const key = `${entry.card_data.anime_name}\u0000${entry.card_data.character_name}`;
    duplicates.set(key, (duplicates.get(key) || 0) + 1);
  });
  const grid = document.querySelector("#collection-grid");
  grid.innerHTML = filtered.map((entry, index) => {
    const key = `${entry.card_data.anime_name}\u0000${entry.card_data.character_name}`;
    return cardMarkup(entry.card_data, duplicates.get(key), index);
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

function fillSelect(select, items, placeholder, selectedValue = "") {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) => (
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
  )).join("")}`;
  if (items.some((item) => item.id === selectedValue)) select.value = selectedValue;
}

function renderAnimePicker() {
  const animeSelect = document.querySelector("#anime-select");
  const previous = animeSelect.value;
  const items = activeAnimesForPacks().map((anime) => ({ id: anime.name, name: anime.name }));
  fillSelect(animeSelect, items, t("noAnime"));
  if (items.some((anime) => anime.id === previous)) animeSelect.value = previous;
  const ownerAnimeOptions = animeSeries.map((anime) => ({
    id: anime.id,
    name: `${anime.name}${anime.is_active ? "" : ` · ${t("inactive")}`}`,
  }));
  fillSelect(document.querySelector("#owner-card-anime"), ownerAnimeOptions, t("selectAnime"));
  const ownerAnimeFilter = document.querySelector("#owner-anime-filter");
  const selectedAnimeId = ownerAnimeFilter.value;
  ownerAnimeFilter.innerHTML = `<option value="">${escapeHtml(t("allAnime"))}</option>${animeSeries.map((anime) => (
    `<option value="${escapeHtml(anime.id)}">${escapeHtml(anime.name)}</option>`
  )).join("")}`;
  if (animeSeries.some((anime) => anime.id === selectedAnimeId)) ownerAnimeFilter.value = selectedAnimeId;
}

function renderOwnerLists() {
  document.querySelector("#anime-count").textContent = animeSeries.length.toLocaleString(language);
  document.querySelector("#anime-list").innerHTML = animeSeries.map((anime) => `
    <article class="owner-record">
      <div class="anime-record-image">${anime.image_url ? `<img src="${escapeHtml(anime.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${escapeHtml(anime.name.slice(0, 1).toLocaleUpperCase(language))}</span>`}</div>
      <div class="owner-record-copy"><strong>${escapeHtml(anime.name)}</strong><span>${escapeHtml(anime.description || t("noAnimeDescription"))}</span><em class="${anime.is_active ? "record-live" : "record-paused"}">${escapeHtml(anime.is_active ? t("active") : t("inactive"))}</em></div>
      <button class="secondary-button compact-button edit-anime" type="button" data-anime-id="${escapeHtml(anime.id)}">${escapeHtml(t("edit"))}</button>
    </article>`).join("");
  attachImageFallbacks(document.querySelector("#anime-list"));

  const filterId = document.querySelector("#owner-anime-filter").value;
  const visibleCards = characterCards.filter((card) => !filterId || card.anime_id === filterId);
  document.querySelector("#owner-card-count").textContent = visibleCards.length.toLocaleString(language);
  document.querySelector("#owner-card-list").innerHTML = visibleCards.map((card) => `
    <article class="owner-record character-owner-record">
      <div class="catalog-row-art" style="--card-accent:${safeColor(card.rarity.color_hex, "#b496ff")}">${card.image_url ? `<img src="${escapeHtml(card.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${escapeHtml(card.character_name.slice(0, 1).toLocaleUpperCase(language))}</span>`}</div>
      <div class="owner-record-copy"><strong>${escapeHtml(card.character_name)}</strong><span>${escapeHtml(card.anime?.name || t("unknownAnime"))}${card.manga_artist ? ` · ${escapeHtml(card.manga_artist)}` : ""}</span><em class="${card.is_active ? "record-live" : "record-paused"}">${escapeHtml(card.is_active ? t("active") : t("inactive"))} · ${escapeHtml(card.rarity.name)}</em></div>
      <button class="secondary-button compact-button edit-character" type="button" data-card-id="${escapeHtml(card.id)}">${escapeHtml(t("edit"))}</button>
    </article>`).join("");
  renderRarityList();
  attachImageFallbacks(document.querySelector("#owner-card-list"));
}

function renderRarityList() {
  document.querySelector("#rarity-list").innerHTML = rarityLevels.map((rarity) => `
    <button class="rarity-entry" type="button" data-rarity-id="${escapeHtml(rarity.id)}">
      <span class="rarity-swatch" style="--rarity-color:${safeColor(rarity.color_hex)}"></span>
      <span class="rarity-entry-name">${escapeHtml(rarity.name)}<small>${escapeHtml(rarity.slug)}</small></span>
      <span class="rarity-entry-weight">${escapeHtml(String(rarity.draw_weight))}×</span>
      <span class="${rarity.is_active ? "record-live" : "record-paused"}">${escapeHtml(rarity.is_active ? t("active") : t("inactive"))}</span>
    </button>`).join("");
}

function renderOwner() {
  const ownerNavigation = document.querySelector("#owner-nav");
  ownerNavigation.hidden = !isOwner;
  if (activePanel === "owner" && !isOwner) activePanel = "collection";
  if (!isOwner) return;
  document.querySelector("#anime-form-title").textContent = t(editingAnimeId ? "editAnime" : "createAnime");
  document.querySelector("#anime-submit").textContent = t(editingAnimeId ? "saveChanges" : "createAnime");
  document.querySelector("#anime-cancel").hidden = !editingAnimeId;
  document.querySelector("#owner-card-form-title").textContent = t(editingCardId ? "editCharacter" : "createCharacter");
  document.querySelector("#owner-card-submit").textContent = t(editingCardId ? "saveChanges" : "createCharacter");
  document.querySelector("#owner-card-cancel").hidden = !editingCardId;
  document.querySelector("#rarity-form-title").textContent = t(editingRarityId ? "editRarity" : "createRarity");
  document.querySelector("#rarity-submit").textContent = t(editingRarityId ? "saveChanges" : "createRarity");
  document.querySelector("#rarity-cancel").hidden = !editingRarityId;
  renderAnimePicker();
  const currentRarity = document.querySelector("#owner-card-rarity").value;
  fillSelect(document.querySelector("#owner-card-rarity"), rarityLevels
    .filter((rarity) => rarity.is_active || (editingCardId && characterCards.find((card) => card.id === editingCardId)?.rarity_id === rarity.id))
    .map((rarity) => ({ id: rarity.id, name: rarity.name })), t("selectRarity"), currentRarity);
  renderOwnerLists();
}

function utcDayStart(date = new Date()) {
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
  const todayStart = utcDayStart();
  const todayPacks = packs.filter((pack) => new Date(pack.opened_at).getTime() >= todayStart && pack.pack_type === "daily").length;
  const dailyRemaining = Math.max(0, 2 - todayPacks);
  const latestSpecial = packs
    .filter((pack) => pack.pack_type === "anime")
    .map((pack) => new Date(pack.opened_at).getTime())
    .sort((first, second) => second - first)[0];
  const specialAvailableAt = latestSpecial ? latestSpecial + 72 * 60 * 60 * 1000 : 0;
  const specialRemaining = Math.max(0, specialAvailableAt - now);
  const catalogAvailable = dataReady && activeAnimesForPacks().length > 0;

  document.querySelector("#daily-packs-remaining").textContent = `${dailyRemaining} / 2`;
  document.querySelector("#daily-progress-fill").style.width = `${(dailyRemaining / 2) * 100}%`;
  document.querySelector("#daily-reset-label").textContent = t("dailyReset");
  document.querySelector("#daily-pack-button").disabled = loadingPack || dailyRemaining === 0 || !catalogAvailable;
  document.querySelector("#special-reset-label").textContent = specialRemaining
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
  renderAnimePicker();
  renderPackStatus();
  renderOwner();
}

async function loadAccountData() {
  if (!supabaseClient || !currentUser) return;
  const userId = currentUser.id;
  dataReady = false;
  dataError = "";
  const [ownerResult, animeResult, rarityResult, cardsResult, collectionResult, packsResult] = await Promise.all([
    supabaseClient.rpc("is_site_owner"),
    supabaseClient.from("anime_series")
      .select("id,name,description,image_url,is_active,created_at,updated_at")
      .order("name", { ascending: true }),
    supabaseClient.from("rarity_levels")
      .select("id,name,slug,color_hex,draw_weight,is_active,sort_order")
      .order("sort_order", { ascending: true })
      .order("draw_weight", { ascending: false }),
    supabaseClient.from("character_cards")
      .select("id,anime_id,character_name,manga_artist,description,image_url,rarity_id,is_active,created_at,updated_at"),
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
  const failed = [ownerResult, animeResult, rarityResult, cardsResult, collectionResult, packsResult]
    .find((result) => result.error);
  if (failed) throw new Error(failed.error.message);
  isOwner = ownerResult.data === true;
  animeSeries = animeResult.data || [];
  rarityLevels = rarityResult.data || [];
  const animeById = new Map(animeSeries.map((anime) => [anime.id, anime]));
  const rarityById = new Map(rarityLevels.map((rarity) => [rarity.id, rarity]));
  characterCards = (cardsResult.data || []).map((card) => ({
    ...card,
    anime: animeById.get(card.anime_id),
    rarity: rarityById.get(card.rarity_id) || {
      id: card.rarity_id,
      name: t("unknownRarity"),
      slug: "unknown",
      color_hex: "#b496ff",
      draw_weight: 1,
      is_active: false,
    },
  })).filter((card) => card.anime);
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
  animeSeries = [];
  rarityLevels = [];
  characterCards = [];
  collection = [];
  packs = [];
  isOwner = false;
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

function setOpeningState(isOpening) {
  const graphic = document.querySelector("#opening-graphic");
  const message = document.querySelector("#opening-message");
  if (isOpening) {
    message.textContent = t("packOpening");
    graphic.classList.remove("is-opening");
    void graphic.offsetWidth;
    graphic.classList.add("is-opening");
    if (!openingDialog.open) openingDialog.showModal();
  } else if (openingDialog.open) {
    openingDialog.close();
    graphic.classList.remove("is-opening");
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function openPack(packType, animeName = "") {
  if (!currentUser) {
    showAuth();
    return;
  }
  if (!supabaseClient || !dataReady || loadingPack) return;
  loadingPack = true;
  renderPackStatus();
  setOpeningState(true);
  const animation = wait(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1500);
  try {
    const [response] = await Promise.all([
      supabaseClient.rpc("open_card_pack", {
        p_pack_type: packType,
        p_anime_name: packType === "anime" ? animeName : null,
      }),
      animation,
    ]);
    if (response.error) throw response.error;
    const pack = response.data?.pack || response.data;
    const openedCards = Array.isArray(pack?.cards) ? pack.cards : [];
    if (openedCards.length !== (packType === "daily" ? 5 : 8)) {
      throw new Error(t("unexpectedPack"));
    }
    setOpeningState(false);
    showReveal(pack, openedCards);
    try {
      await loadAccountData();
    } catch (error) {
      dataError = t("dataLoadError", { error: error.message });
      render();
      notify(t("collectionRefreshError", { error: error.message }), true);
    }
  } catch (error) {
    setOpeningState(false);
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
  grid.innerHTML = cards.map((card, index) => cardMarkup(card, 1, index)).join("");
  attachImageFallbacks(grid);
  revealDialog.showModal();
}

function setFormError(id, error) {
  const output = document.querySelector(`#${id}`);
  output.textContent = error;
  output.hidden = false;
}

function clearFormError(id) {
  const output = document.querySelector(`#${id}`);
  output.textContent = "";
  output.hidden = true;
}

function normalizeOptionalUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const url = new URL(trimmed);
  if (url.protocol !== "https:") throw new Error(t("httpsImageRequired"));
  return trimmed;
}

async function ownerImageUrl(urlSelector, fileSelector, folder) {
  const fileInput = document.querySelector(fileSelector);
  const file = fileInput.files[0];
  if (!file) return normalizeOptionalUrl(document.querySelector(urlSelector).value);
  const extensions = {
    "image/avif": "avif",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (!extensions[file.type] || file.size > 5 * 1024 * 1024) {
    throw new Error(t("invalidImageUpload"));
  }
  if (!currentUser || !supabaseClient) throw new Error(t("supabaseSetup"));
  const path = `${currentUser.id}/${folder}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const { error } = await supabaseClient.storage.from("clair-card-art")
    .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
  if (error) throw error;
  return supabaseClient.storage.from("clair-card-art").getPublicUrl(path).data.publicUrl;
}

function cancelAnimeEdit() {
  editingAnimeId = "";
  document.querySelector("#anime-form").reset();
  document.querySelector("#owner-anime-active").checked = true;
  document.querySelector("#owner-anime-image-file").value = "";
  document.querySelector("#anime-form-title").textContent = t("createAnime");
  document.querySelector("#anime-submit").textContent = t("createAnime");
  document.querySelector("#anime-cancel").hidden = true;
  clearFormError("anime-error");
}

function cancelCardEdit() {
  editingCardId = "";
  document.querySelector("#owner-card-form").reset();
  document.querySelector("#owner-card-active").checked = true;
  document.querySelector("#owner-card-image-file").value = "";
  document.querySelector("#owner-card-form-title").textContent = t("createCharacter");
  document.querySelector("#owner-card-submit").textContent = t("createCharacter");
  document.querySelector("#owner-card-cancel").hidden = true;
  clearFormError("owner-card-error");
  renderOwner();
}

function cancelRarityEdit() {
  editingRarityId = "";
  document.querySelector("#rarity-form").reset();
  document.querySelector("#owner-rarity-color").value = "#b496ff";
  document.querySelector("#owner-rarity-weight").value = "10";
  document.querySelector("#owner-rarity-active").checked = true;
  document.querySelector("#rarity-form-title").textContent = t("createRarity");
  document.querySelector("#rarity-submit").textContent = t("createRarity");
  document.querySelector("#rarity-cancel").hidden = true;
  clearFormError("rarity-error");
}

document.querySelector("#language-select").addEventListener("change", (event) => setLanguage(event.target.value));
document.querySelector("#account-button").addEventListener("click", showAuth);
document.querySelector("#gate-sign-in").addEventListener("click", showAuth);
document.querySelector("#close-auth").addEventListener("click", () => authDialog.close());
document.querySelector("#close-reveal").addEventListener("click", () => revealDialog.close());
document.querySelector("#close-opening").addEventListener("click", () => setOpeningState(false));
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
  toggleCardDetails(card);
});
document.querySelector("#collection-grid").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".character-card")) {
    event.preventDefault();
    toggleCardDetails(event.target);
  }
});
document.querySelector("#reveal-grid").addEventListener("click", (event) => {
  const card = event.target.closest(".character-card");
  toggleCardDetails(card);
});
document.querySelector("#reveal-grid").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".character-card")) {
    event.preventDefault();
    toggleCardDetails(event.target);
  }
});
document.querySelectorAll("[data-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    activePanel = button.dataset.panel === "owner" && !isOwner ? "collection" : button.dataset.panel;
    renderPanels();
  });
});
document.querySelectorAll("[data-go-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    activePanel = button.dataset.goPanel;
    renderPanels();
  });
});

document.querySelector("#anime-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isOwner || !supabaseClient) return;
  clearFormError("anime-error");
  const submit = document.querySelector("#anime-submit");
  submit.disabled = true;
  try {
    const wasEditing = Boolean(editingAnimeId);
    const record = {
      name: document.querySelector("#owner-anime-name").value.trim(),
      description: document.querySelector("#owner-anime-description").value.trim(),
      image_url: await ownerImageUrl("#owner-anime-image", "#owner-anime-image-file", "anime"),
      is_active: document.querySelector("#owner-anime-active").checked,
      updated_at: new Date().toISOString(),
    };
    const request = editingAnimeId
      ? supabaseClient.from("anime_series").update(record).eq("id", editingAnimeId)
      : supabaseClient.from("anime_series").insert(record);
    const { error } = await request;
    if (error) throw error;
    cancelAnimeEdit();
    await loadAccountData();
    notify(t(wasEditing ? "animeUpdated" : "animeCreated"));
  } catch (error) {
    setFormError("anime-error", error.message || t("ownerSaveError"));
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#anime-list").addEventListener("click", (event) => {
  const button = event.target.closest(".edit-anime");
  if (!button || !isOwner) return;
  const anime = animeSeries.find((entry) => entry.id === button.dataset.animeId);
  if (!anime) return;
  editingAnimeId = anime.id;
  document.querySelector("#owner-anime-name").value = anime.name;
  document.querySelector("#owner-anime-description").value = anime.description;
  document.querySelector("#owner-anime-image").value = anime.image_url || "";
  document.querySelector("#owner-anime-image-file").value = "";
  document.querySelector("#owner-anime-active").checked = anime.is_active;
  document.querySelector("#anime-form-title").textContent = t("editAnime");
  document.querySelector("#anime-submit").textContent = t("saveChanges");
  document.querySelector("#anime-cancel").hidden = false;
  document.querySelector("#owner-anime-name").focus();
});
document.querySelector("#anime-cancel").addEventListener("click", cancelAnimeEdit);

document.querySelector("#owner-card-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isOwner || !supabaseClient) return;
  clearFormError("owner-card-error");
  const submit = document.querySelector("#owner-card-submit");
  submit.disabled = true;
  try {
    const wasEditing = Boolean(editingCardId);
    const record = {
      anime_id: document.querySelector("#owner-card-anime").value,
      character_name: document.querySelector("#owner-card-name").value.trim(),
      manga_artist: document.querySelector("#owner-card-mangaka").value.trim(),
      description: document.querySelector("#owner-card-description").value.trim(),
      image_url: await ownerImageUrl("#owner-card-image", "#owner-card-image-file", "characters"),
      rarity_id: document.querySelector("#owner-card-rarity").value,
      is_active: document.querySelector("#owner-card-active").checked,
      updated_at: new Date().toISOString(),
    };
    const request = editingCardId
      ? supabaseClient.from("character_cards").update(record).eq("id", editingCardId)
      : supabaseClient.from("character_cards").insert(record);
    const { error } = await request;
    if (error) throw error;
    cancelCardEdit();
    await loadAccountData();
    notify(t(wasEditing ? "characterUpdated" : "characterCreated"));
  } catch (error) {
    setFormError("owner-card-error", error.message || t("ownerSaveError"));
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#owner-card-list").addEventListener("click", (event) => {
  const button = event.target.closest(".edit-character");
  if (!button || !isOwner) return;
  const card = characterCards.find((entry) => entry.id === button.dataset.cardId);
  if (!card) return;
  editingCardId = card.id;
  renderOwner();
  document.querySelector("#owner-card-anime").value = card.anime_id;
  document.querySelector("#owner-card-name").value = card.character_name;
  document.querySelector("#owner-card-mangaka").value = card.manga_artist;
  document.querySelector("#owner-card-description").value = card.description;
  document.querySelector("#owner-card-image").value = card.image_url || "";
  document.querySelector("#owner-card-image-file").value = "";
  document.querySelector("#owner-card-rarity").value = card.rarity_id;
  document.querySelector("#owner-card-active").checked = card.is_active;
  document.querySelector("#owner-card-form-title").textContent = t("editCharacter");
  document.querySelector("#owner-card-submit").textContent = t("saveChanges");
  document.querySelector("#owner-card-cancel").hidden = false;
  document.querySelector("#owner-card-name").focus();
});
document.querySelector("#owner-card-cancel").addEventListener("click", cancelCardEdit);
document.querySelector("#owner-anime-filter").addEventListener("change", renderOwnerLists);

document.querySelector("#rarity-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isOwner || !supabaseClient) return;
  clearFormError("rarity-error");
  const submit = document.querySelector("#rarity-submit");
  submit.disabled = true;
  try {
    const wasEditing = Boolean(editingRarityId);
    const existingRarity = rarityLevels.find((rarity) => rarity.id === editingRarityId);
    const record = {
      name: document.querySelector("#owner-rarity-name").value.trim(),
      slug: document.querySelector("#owner-rarity-slug").value.trim().toLowerCase(),
      color_hex: safeColor(document.querySelector("#owner-rarity-color").value),
      draw_weight: Number(document.querySelector("#owner-rarity-weight").value),
      is_active: document.querySelector("#owner-rarity-active").checked,
      sort_order: existingRarity?.sort_order
        ?? Math.max(0, ...rarityLevels.map((rarity) => rarity.sort_order)) + 1,
    };
    const request = editingRarityId
      ? supabaseClient.from("rarity_levels").update(record).eq("id", editingRarityId)
      : supabaseClient.from("rarity_levels").insert(record);
    const { error } = await request;
    if (error) throw error;
    cancelRarityEdit();
    await loadAccountData();
    notify(t(wasEditing ? "rarityUpdated" : "rarityCreated"));
  } catch (error) {
    setFormError("rarity-error", error.message || t("ownerSaveError"));
  } finally {
    submit.disabled = false;
  }
});
document.querySelector("#rarity-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-rarity-id]");
  if (!button || !isOwner) return;
  const rarity = rarityLevels.find((entry) => entry.id === button.dataset.rarityId);
  if (!rarity) return;
  editingRarityId = rarity.id;
  document.querySelector("#owner-rarity-name").value = rarity.name;
  document.querySelector("#owner-rarity-slug").value = rarity.slug;
  document.querySelector("#owner-rarity-color").value = safeColor(rarity.color_hex);
  document.querySelector("#owner-rarity-weight").value = rarity.draw_weight;
  document.querySelector("#owner-rarity-active").checked = rarity.is_active;
  document.querySelector("#rarity-form-title").textContent = t("editRarity");
  document.querySelector("#rarity-submit").textContent = t("saveChanges");
  document.querySelector("#rarity-cancel").hidden = false;
  document.querySelector("#owner-rarity-name").focus();
});
document.querySelector("#rarity-cancel").addEventListener("click", cancelRarityEdit);
document.querySelector("#owner-rarity-name").addEventListener("input", (event) => {
  if (editingRarityId) return;
  const slug = event.target.value.trim().toLocaleLowerCase("en")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  document.querySelector("#owner-rarity-slug").value = slug.slice(0, 24);
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
