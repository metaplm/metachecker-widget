<template>
  <!-- ════════ FLOATING ACTION BUTTON (sürüklenebilir) ════════ -->
  <button
    v-if="!open"
    ref="fabEl"
    class="hermes-fab"
    :class="{ 'hermes-fab--dragging': dragging }"
    :style="fabStyle"
    type="button"
    @pointerdown="onFabDown"
    aria-label="MetaChecker Bot"
  >
    <img class="hermes-fab__logo" :src="logoSrc" alt="MetaChecker Bot" draggable="false" />
    <span class="hermes-fab__pulse"></span>
  </button>

  <!-- ════════ CHAT PANEL ════════ -->
  <div v-else class="hermes-panel" :class="{ 'hermes-panel--min': minimized && !fullscreen, 'hermes-panel--full': fullscreen }" :style="panelStyle">
    <!-- header -->
    <div class="hermes-head">
      <div class="hermes-head__brand">
        <div class="hermes-head__avatar"><img class="hermes-head__logo" :src="logoSrc" alt="" /></div>
        <div>
          <div class="hermes-head__title">MetaChecker Bot</div>
          <div class="hermes-head__status">
            <span class="dot" :class="onlineClass"></span>{{ onlineLabel }}
          </div>
        </div>
      </div>
      <v-spacer />
      <v-btn icon variant="text" size="small" color="white" @click="newChat" :disabled="sending">
        <v-icon size="20">mdi-message-plus-outline</v-icon>
        <v-tooltip activator="parent" location="bottom">{{ $t('hermes.newChat') }}</v-tooltip>
      </v-btn>
      <v-btn icon variant="text" size="small" color="white" @click="toggleFullscreen">
        <v-icon size="20">{{ fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
        <v-tooltip activator="parent" location="bottom">{{ fullscreen ? $t('hermes.shrink') : $t('hermes.fullscreen') }}</v-tooltip>
      </v-btn>
      <v-btn v-if="!fullscreen" icon variant="text" size="small" color="white" @click="minimized = !minimized">
        <v-icon size="20">{{ minimized ? 'mdi-window-maximize' : 'mdi-window-minimize' }}</v-icon>
      </v-btn>
      <v-btn icon variant="text" size="small" color="white" @click="open = false">
        <v-icon size="20">mdi-close</v-icon>
      </v-btn>
    </div>

    <template v-if="!minimized || fullscreen">
      <!-- mesaj akışı -->
      <div ref="scrollEl" class="hermes-body">
        <div v-if="!hasKey" class="hermes-note hermes-note--warn">
          <v-icon size="16" color="warning" class="mr-1">mdi-key-alert-outline</v-icon>
          {{ $t('hermes.noKey') }}
        </div>

        <div v-if="!messages.length" class="hermes-empty">
          <img class="hermes-empty__logo" :src="logoSrc" alt="" />
          <div class="hermes-empty__t">{{ $t('hermes.askPrompt') }}</div>
          <div class="hermes-sugg">
            <button v-for="s in suggestions" :key="s" type="button" class="hermes-sugg__chip" @click="useSuggestion(s)">{{ s }}</button>
          </div>
        </div>

        <div v-for="(m, i) in messages" :key="i" class="hermes-msg" :class="'hermes-msg--' + m.role">
          <div class="hermes-bubble" :class="{ 'hermes-bubble--err': m.error }">
            <div v-if="m.role === 'assistant' && !m.error" class="hermes-md" v-html="render(m.content)"></div>
            <span v-else>{{ m.content }}</span>
          </div>
        </div>

        <div v-if="sending" class="hermes-msg hermes-msg--assistant">
          <div class="hermes-bubble hermes-typing">
            <em class="hermes-typing__label">{{ typingLabel }}</em>
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <!-- giriş -->
      <div class="hermes-input">
        <v-textarea
          v-model="draft"
          rows="1"
          auto-grow
          max-rows="5"
          hide-details
          density="compact"
          variant="solo"
          flat
          :disabled="sending"
          @keydown.enter="onEnter"
        />
        <v-btn v-if="sending" icon size="small" color="error" variant="flat" @click="cancelRun">
          <v-icon>mdi-stop</v-icon>
          <v-tooltip activator="parent" location="top">{{ $t('common.cancel') }}</v-tooltip>
        </v-btn>
        <v-btn v-else icon size="small" color="primary" variant="flat" :disabled="!canSend" @click="send">
          <v-icon>mdi-send</v-icon>
        </v-btn>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { Remarkable } from "remarkable";
import HermesApi from "../js/HermesApi";
import { getCurrentUser } from "../js/MetaCheckerApi";

const { t, tm, rt, locale } = useI18n();

const md = new Remarkable({ html: false, breaks: true, linkify: true, typographer: false });

const open = ref(false);
const minimized = ref(false);
const fullscreen = ref(false);
const messages = ref([]); // {role:'user'|'assistant', content, error?}
const draft = ref("");
const sending = ref(false);
const currentRunId = ref(""); // aktif run (iptal için)
let cancelled = false; // poll döngüsünü durdurur
const elapsed = ref(0); // gönderimden bu yana saniye
let elapsedTimer = null;
const online = ref(null); // null=bilinmiyor, true/false
const sessionId = ref("");
const sessionKey = ref("");
const scrollEl = ref(null);

/* ════════ Logo (3DDashboard public path) ════════ */
/* eslint-disable no-undef, camelcase */
const logoSrc = (() => {
  const base =
    typeof __webpack_public_path__ !== "undefined" && __webpack_public_path__ ? __webpack_public_path__ : "./";
  return `${base}static/images/LOGO_TEK.png`;
})();
/* eslint-enable no-undef, camelcase */

/* ════════ Sürüklenebilir FAB konumu ════════ */
const FAB_SIZE = 58;
const MARGIN = 16;
const PANEL_W = 390;
const PANEL_H = 560;
const POS_KEY = "metacheckerBotFabPos";

const fabEl = ref(null);
const fab = ref({ x: 0, y: 0 }); // FAB'ın sol-üst köşesi (px)
const dragging = ref(false);
let dragStart = null; // {px, py, ox, oy}
let dragMoved = false;

function clampFab(x, y) {
  const maxX = window.innerWidth - FAB_SIZE - MARGIN;
  const maxY = window.innerHeight - FAB_SIZE - MARGIN;
  return { x: Math.max(MARGIN, Math.min(x, maxX)), y: Math.max(MARGIN, Math.min(y, maxY)) };
}
function defaultPos() {
  return clampFab(window.innerWidth - FAB_SIZE - 22, window.innerHeight - FAB_SIZE - 22);
}
function loadPos() {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") return clampFab(saved.x, saved.y);
  } catch {
    /* yok say */
  }
  return defaultPos();
}

const fabStyle = computed(() => ({
  left: fab.value.x + "px",
  top: fab.value.y + "px",
  right: "auto",
  bottom: "auto"
}));

function toggleFullscreen() {
  fullscreen.value = !fullscreen.value;
  if (fullscreen.value) minimized.value = false;
  scrollToBottom();
}

// Panel, FAB'ın bulunduğu köşeye yapışık açılır; ekran dışına taşmaz.
// Tam ekranda inline konum verilmez → CSS sınıfı (.hermes-panel--full) devralır.
const panelStyle = computed(() => {
  if (fullscreen.value) return {};
  const f = fab.value;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(PANEL_W, vw - 2 * MARGIN);
  const h = Math.min(PANEL_H, vh - 2 * MARGIN);
  const fcx = f.x + FAB_SIZE / 2;
  const fcy = f.y + FAB_SIZE / 2;
  let left = fcx > vw / 2 ? f.x + FAB_SIZE - w : f.x; // sağ yarıda → sola aç
  let top = fcy > vh / 2 ? f.y + FAB_SIZE - h : f.y; // alt yarıda → yukarı aç
  left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
  top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
  return { left: left + "px", top: top + "px", right: "auto", bottom: "auto", width: w + "px" };
});

function onFabDown(e) {
  if (e.button != null && e.button !== 0) return; // yalnız sol tık / dokunma
  dragMoved = false;
  dragStart = { px: e.clientX, py: e.clientY, ox: fab.value.x, oy: fab.value.y };
  dragging.value = true;
  window.addEventListener("pointermove", onFabMove);
  window.addEventListener("pointerup", onFabUp);
}
function onFabMove(e) {
  if (!dragStart) return;
  const dx = e.clientX - dragStart.px;
  const dy = e.clientY - dragStart.py;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
  fab.value = clampFab(dragStart.ox + dx, dragStart.oy + dy);
}
function onFabUp() {
  window.removeEventListener("pointermove", onFabMove);
  window.removeEventListener("pointerup", onFabUp);
  dragging.value = false;
  dragStart = null;
  if (dragMoved) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(fab.value));
    } catch {
      /* yok say */
    }
  } else {
    openPanel(); // sürüklenmedi → tık → paneli aç
  }
}
function onResize() {
  fab.value = clampFab(fab.value.x, fab.value.y);
}

const hasKey = HermesApi.hasKey();
// Öneriler ve bekleme havuzu katalogdan (locale değişince reaktif güncellenir).
const suggestions = computed(() => tm("hermes.suggestions").map(rt));
const THINKING_POOL = computed(() => tm("hermes.thinkingPool").map(rt));

const canSend = computed(() => !!draft.value.trim() && !sending.value);
// İlk iki aşama sabit; sonrası havuzdan rastgele dönen mesajlar (gerçek stream yok, algılanan akıcılık).
const randomBase = ref("");
const typingLabel = computed(() => {
  const s = elapsed.value;
  if (s < 4) return t("hermes.typing.thinking");
  if (s < 9) return `${t("hermes.typing.tools")} ${s}s`;
  return `${randomBase.value || t("hermes.typing.thinkingBase")}… ${s}s`;
});
const onlineClass = computed(() => (online.value === true ? "on" : online.value === false ? "off" : "unknown"));
const onlineLabel = computed(() =>
  online.value === true ? t("hermes.online.on") : online.value === false ? t("hermes.online.off") : t("hermes.online.connecting")
);

function render(text) {
  try {
    // Linkler iframe'i kaçırmasın → yeni sekmede aç (rapor indirme linkleri dahil).
    return md.render(text || "").replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
  } catch {
    return (text || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
}

function newSession() {
  try {
    sessionId.value = crypto.randomUUID();
  } catch {
    sessionId.value = "sess-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
  }
}

async function openPanel() {
  open.value = true;
  minimized.value = false;
  if (!sessionId.value) newSession();
  // bağlantıyı tazele (engellemez)
  online.value = null;
  HermesApi.health().then(ok => (online.value = ok));
}

function newChat() {
  messages.value = [];
  draft.value = "";
  newSession();
  online.value = null;
  HermesApi.health().then(ok => (online.value = ok));
}

function useSuggestion(s) {
  draft.value = s;
  send();
}

function onEnter(e) {
  if (e.shiftKey) return; // satır ekle
  e.preventDefault();
  if (canSend.value) send();
}

async function scrollToBottom() {
  await nextTick();
  const el = scrollEl.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function send() {
  const text = draft.value.trim();
  if (!text || sending.value) return;
  messages.value.push({ role: "user", content: text });
  draft.value = "";
  sending.value = true;
  cancelled = false;
  currentRunId.value = "";
  elapsed.value = 0;
  randomBase.value = "";
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => {
    elapsed.value += 1;
    // 9. sn'den sonra her ~4 sn'de havuzdan rastgele bir mesaj seç.
    if (elapsed.value >= 9 && (elapsed.value - 9) % 4 === 0) {
      const pool = THINKING_POOL.value;
      randomBase.value = pool[Math.floor(Math.random() * pool.length)];
    }
  }, 1000);
  scrollToBottom();
  // Ajan seçilen dilde yanıtlasın: HER turda system dil talimatı + X-Hermes-Lang header.
  // (İlk-turda-bir-kez yetmiyor; ajan ilerleyen turlarda dili kaybediyor.)
  const lang = locale.value;
  try {
    // Asenkron: run başlat → ~2 sn'de bir poll → completed olunca output (25 sn cap'e takılmaz).
    const reply = await HermesApi.run({
      sessionId: sessionId.value,
      sessionKey: sessionKey.value || undefined,
      lang,
      messages: [{ role: "system", content: t("hermes.systemLang") }, { role: "user", content: text }],
      onStart: id => (currentRunId.value = id),
      isCancelled: () => cancelled
    });
    online.value = true;
    messages.value.push({ role: "assistant", content: reply || t("hermes.err.empty") });
  } catch (e) {
    if (e && e.cancelled) {
      messages.value.push({ role: "assistant", content: t("hermes.cancelled"), error: true });
    } else {
      if (e && (e.status === 502 || e.status === 503 || e.status === 504)) online.value = false;
      // Sunucudan anlamlı mesaj geldiyse onu göster; yoksa kodu çevir.
      const msg = (e && e.serverMessage) || t("hermes.err." + ((e && e.code) || "generic"));
      messages.value.push({ role: "assistant", content: msg, error: true });
    }
  } finally {
    sending.value = false;
    currentRunId.value = "";
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
    scrollToBottom();
  }
}

// Aktif run'ı iptal et (poll'u durdur + sunucuya stop).
function cancelRun() {
  if (!sending.value) return;
  cancelled = true;
  if (currentRunId.value) HermesApi.stopRun(currentRunId.value);
}

onMounted(async () => {
  newSession();
  fab.value = loadPos();
  window.addEventListener("resize", onResize);
  // uzun-dönem hafıza kapsamı için kullanıcı kimliği (opsiyonel)
  try {
    sessionKey.value = await getCurrentUser();
  } catch {
    sessionKey.value = "";
  }
});

onUnmounted(() => {
  window.removeEventListener("resize", onResize);
  window.removeEventListener("pointermove", onFabMove);
  window.removeEventListener("pointerup", onFabUp);
  if (elapsedTimer) clearInterval(elapsedTimer);
});
</script>

<style scoped>
/* ════════ FAB ════════ */
.hermes-fab {
  position: fixed;
  right: 22px;
  bottom: 22px;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  z-index: 2147483000;
  display: grid;
  place-items: center;
  background: #fff;
  border: 1px solid rgba(1, 47, 77, 0.12);
  box-shadow: 0 8px 22px rgba(1, 47, 77, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  cursor: grab;
  touch-action: none; /* pointer sürüklemede sayfa kaymasın */
  user-select: none;
}
.hermes-fab:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 12px 28px rgba(1, 47, 77, 0.55);
}
.hermes-fab--dragging {
  cursor: grabbing;
  transform: scale(1.06);
  transition: none;
  box-shadow: 0 14px 32px rgba(1, 47, 77, 0.6);
}
.hermes-fab--dragging .hermes-fab__pulse { display: none; }
.hermes-fab__logo {
  width: 34px;
  height: 34px;
  object-fit: contain;
  border-radius: 8px;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}
.hermes-fab__pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(31, 147, 206, 0.6);
  animation: hermes-pulse 2.2s ease-out infinite;
  pointer-events: none;
}
@keyframes hermes-pulse {
  0% { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(1.6); opacity: 0; }
}

/* ════════ PANEL ════════ */
.hermes-panel {
  position: fixed;
  right: 22px;
  bottom: 22px;
  width: 390px;
  max-width: calc(100vw - 32px);
  height: 560px;
  max-height: calc(100vh - 44px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  z-index: 2147483000;
  box-shadow: 0 18px 50px rgba(1, 47, 77, 0.4);
  border: 1px solid rgba(1, 47, 77, 0.1);
}
.hermes-panel--min {
  height: auto;
}
.hermes-panel--full {
  inset: 0 !important;
  left: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  border-radius: 0;
  border: none;
}

.hermes-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 8px 10px 14px;
  color: #fff;
  background: linear-gradient(120deg, #012f4d 0%, #015686 55%, #1F93CE 130%);
}
.hermes-head__brand { display: flex; align-items: center; gap: 10px; }
.hermes-head__avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: #fff;
  border: 1px solid rgba(255, 255, 255, 0.5);
  overflow: hidden;
}
.hermes-head__logo { width: 26px; height: 26px; object-fit: contain; }
.hermes-head__title { font-weight: 700; font-size: 1rem; line-height: 1.1; }
.hermes-head__status { font-size: 0.72rem; color: rgba(255, 255, 255, 0.8); display: flex; align-items: center; }
.hermes-head__status .dot { width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; }
.dot.on { background: #7CFFB2; box-shadow: 0 0 6px #7CFFB2; }
.dot.off { background: #ff7676; }
.dot.unknown { background: #ffd54f; }

/* ════════ BODY ════════ */
.hermes-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  background: #f4f7f9;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hermes-note { font-size: 0.76rem; padding: 6px 10px; border-radius: 8px; display: flex; align-items: center; }
.hermes-note--warn { background: rgba(255, 167, 38, 0.14); color: #b26a00; }

.hermes-empty { text-align: center; margin: auto; color: #607d8b; padding: 10px; }
.hermes-empty__logo { width: 52px; height: 52px; object-fit: contain; opacity: 0.9; }
.hermes-empty__t { font-weight: 700; margin-top: 6px; color: #455a64; }
.hermes-empty__s { font-size: 0.78rem; margin-top: 2px; }
.hermes-sugg { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.hermes-sugg__chip {
  font-size: 0.78rem;
  padding: 7px 12px;
  border-radius: 12px;
  border: 1px solid #cfd8dc;
  background: #fff;
  color: #37474f;
  cursor: pointer;
  transition: all 0.12s;
}
.hermes-sugg__chip:hover { border-color: #1F93CE; background: rgba(31, 147, 206, 0.08); }

/* ════════ MESSAGES ════════ */
.hermes-msg { display: flex; }
.hermes-msg--user { justify-content: flex-end; }
.hermes-msg--assistant { justify-content: flex-start; }
.hermes-bubble {
  max-width: 84%;
  padding: 9px 13px;
  border-radius: 14px;
  font-size: 0.86rem;
  line-height: 1.45;
  word-wrap: break-word;
  white-space: pre-wrap;
}
.hermes-msg--user .hermes-bubble {
  background: linear-gradient(135deg, #015686, #1F93CE);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.hermes-msg--assistant .hermes-bubble {
  background: #fff;
  color: #263238;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-bottom-left-radius: 4px;
}
.hermes-bubble--err { background: #fdecea !important; color: #b71c1c !important; border-color: #f5c6cb !important; }

/* markdown render */
.hermes-md { white-space: normal; }
.hermes-md :deep(p) { margin: 0 0 6px; }
.hermes-md :deep(p:last-child) { margin-bottom: 0; }
.hermes-md :deep(pre) { background: #eef3f6; padding: 8px 10px; border-radius: 8px; overflow-x: auto; font-size: 0.8rem; }
.hermes-md :deep(code) { background: #eef3f6; padding: 1px 5px; border-radius: 4px; font-size: 0.82rem; }
.hermes-md :deep(pre code) { background: none; padding: 0; }
.hermes-md :deep(table) { border-collapse: collapse; font-size: 0.8rem; margin: 4px 0; }
.hermes-md :deep(th), .hermes-md :deep(td) { border: 1px solid #cfd8dc; padding: 3px 8px; }
.hermes-md :deep(th) { background: #eceff1; }
.hermes-md :deep(ul), .hermes-md :deep(ol) { margin: 4px 0; padding-left: 20px; }
.hermes-md :deep(a) { color: #015686; font-weight: 600; text-decoration: none; }
.hermes-md :deep(a):hover { text-decoration: underline; }
.hermes-md :deep(a)::before { content: "🔗 "; }

/* typing */
.hermes-typing { display: flex; gap: 4px; align-items: center; }
.hermes-typing__label { margin-right: 4px; font-size: 0.8rem; font-style: normal; color: #455a64; }
.hermes-typing span {
  width: 7px; height: 7px; border-radius: 50%; background: #b0bec5;
  animation: hermes-blink 1.2s infinite both;
}
.hermes-typing span:nth-child(2) { animation-delay: 0.2s; }
.hermes-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes hermes-blink { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }

/* ════════ INPUT ════════ */
.hermes-input {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 12px 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  background: #fff;
}
.hermes-input :deep(.v-textarea) { flex: 1 1 auto; }
.hermes-input :deep(.v-field) {
  border-radius: 14px;
  background: #f4f7f9;
  border: 1px solid #e1e8ec;
}
.hermes-input :deep(.v-field--focused) { border-color: #1F93CE; background: #fff; }
.hermes-input :deep(.v-field__input) {
  min-height: 46px;
  padding-top: 11px;
  padding-bottom: 11px;
  font-size: 0.9rem;
  line-height: 1.45;
}
.hermes-input :deep(textarea) { margin: 0; }
.hermes-input .v-btn {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  flex: 0 0 auto;
}
</style>
