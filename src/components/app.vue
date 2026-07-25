<template>
  <v-app>
    <v-main>
      <v-container fluid class="pa-3 app-root d-flex flex-column">
        <!-- ════════ PREMIUM HEADER ════════ -->
        <header class="mc-header">
          <div class="mc-header__glow"></div>
          <div class="mc-header__grid"></div>
          <img class="mc-header__motif" :src="logoSrc" alt="" aria-hidden="true" />

          <div class="mc-header__content">
            <div class="mc-brand">
              <img class="mc-brand__logo" :src="logoSrc" alt="MetaPLM" />
              <div class="mc-brand__divider"></div>
              <div class="mc-brand__text">
                <div class="mc-brand__title">
                  Meta<span class="accent">Checker</span>
                </div>
                <div class="mc-brand__subtitle">{{ $t('app.subtitle') }}</div>
              </div>
            </div>

            <!-- canlı istatistikler (glass) -->
            <div class="mc-stats" v-if="schema">
              <div class="mc-stat">
                <div class="mc-stat__num">{{ items.length }}</div>
                <div class="mc-stat__lbl">{{ $t('app.stats.rules') }}</div>
              </div>
              <div class="mc-stat">
                <div class="mc-stat__num mc-stat__num--on">{{ enabledCount }}</div>
                <div class="mc-stat__lbl">{{ $t('app.stats.active') }}</div>
              </div>
              <div class="mc-stat" v-if="activeVersion">
                <div class="mc-stat__num">#{{ activeVersion.id }}</div>
                <div class="mc-stat__lbl">{{ $t('app.stats.version') }}</div>
              </div>
              <div class="mc-stat mc-stat--dirty" v-if="dirty">
                <div class="mc-stat__num"><v-icon size="18">mdi-pencil</v-icon></div>
                <div class="mc-stat__lbl">{{ $t('app.stats.unsaved') }}</div>
              </div>
            </div>
          </div>
          <div class="mc-header__accent"></div>
        </header>

        <div class="mt-3"></div>

        <!-- yükleme / hata -->
        <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4">
          {{ loadError }}
          <template #append>
            <v-btn size="small" variant="text" @click="bootstrap">{{ $t('common.retry') }}</v-btn>
          </template>
        </v-alert>

        <div v-if="loading" class="text-center py-12">
          <v-progress-circular indeterminate color="primary" size="48" />
          <div class="mt-3 text-medium-emphasis">{{ $t('app.loading') }}</div>
        </div>

        <!-- ════════ FULL-WIDTH RULE LIST ════════ -->
        <div v-else-if="schema" class="flex-grow-1" style="min-height: 0">
          <ChecklistList
            :items="items"
            :schema="schema"
            @add="onAdd"
            @edit="onEdit"
            @toggle="onToggle"
          >
            <template #actions>
              <v-btn icon variant="text" size="small" :loading="exporting" @click="exportYaml">
                <v-icon>mdi-download</v-icon>
                <v-tooltip activator="parent" location="bottom">{{ $t('app.export') }}</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="openHistory">
                <v-icon>mdi-history</v-icon>
                <v-tooltip activator="parent" location="bottom">{{ $t('app.history') }}</v-tooltip>
              </v-btn>
              <v-btn icon size="small" color="primary" variant="flat" :disabled="!dirty || loading" @click="openSave">
                <v-icon>mdi-content-save</v-icon>
                <v-tooltip activator="parent" location="bottom">{{ $t('app.saveNew') }}</v-tooltip>
              </v-btn>
            </template>
          </ChecklistList>

          <!-- aktif sürüm bilgisi: en altta -->
          <div v-if="activeVersion" class="text-caption text-medium-emphasis mt-2 px-1">
            <v-icon size="14" class="mr-1">mdi-source-branch</v-icon>
            {{ $t('app.activeVersionLabel') }} <strong>#{{ activeVersion.id }}</strong>
            · {{ activeVersion.author }}
            · {{ activeVersion.note || $t('common.noNote') }}
            · {{ formatDate(activeVersion.created_at) }}
          </div>
        </div>

        <!-- ════════ EDITOR MODAL ════════ -->
        <ItemEditor
          v-if="schema"
          :model-value="editorOpen"
          :schema="schema"
          :item="editTarget"
          :is-new="editIsNew"
          :items="items"
          :author="author"
          @close="editorOpen = false"
          @apply="onApply"
          @delete="onDelete"
        />

        <!-- ════════ HISTORY MODAL ════════ -->
        <v-dialog v-model="historyOpen" max-width="1100" scrollable>
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-history</v-icon>{{ $t('app.historyTitle') }}
              <v-spacer />
              <v-btn icon="mdi-close" variant="text" @click="historyOpen = false" />
            </v-card-title>
            <v-divider />
            <v-card-text>
              <VersionHistory
                ref="historyRef"
                :active-id="activeVersion ? activeVersion.id : null"
                :active-items="items"
                @rolled-back="onRolledBack"
                @error="e => notify(e.message || t('common.error'), 'error')"
              />
            </v-card-text>
          </v-card>
        </v-dialog>

        <!-- ════════ SAVE MODAL ════════ -->
        <v-dialog v-model="saveOpen" max-width="560" persistent>
          <v-card>
            <v-card-title>{{ $t('app.save.title') }}</v-card-title>
            <v-divider />
            <v-card-text>
              <p class="text-body-2 text-medium-emphasis mb-3">
                {{ $t('app.save.desc') }}
              </p>
              <v-textarea v-model="note" :label="$t('app.save.noteLabel')" rows="3" auto-grow variant="outlined" density="comfortable" autofocus />
              <div class="text-caption text-medium-emphasis">{{ $t('app.save.author', { author }) }}</div>

              <v-alert v-if="conflict" type="warning" variant="tonal" density="compact" class="mt-3">
                {{ $t('app.save.conflict') }}
                <div class="mt-2">
                  <v-btn size="small" color="warning" variant="flat" @click="reloadActive">{{ $t('app.save.reload') }}</v-btn>
                </div>
              </v-alert>

              <v-alert v-else-if="saveErrors.length" type="error" variant="tonal" density="compact" class="mt-3">
                <div class="font-weight-medium mb-1">{{ $t('app.save.cannotSave') }}</div>
                <ul class="ma-0 pl-4">
                  <li v-for="(e, i) in saveErrors" :key="i">{{ e }}</li>
                </ul>
              </v-alert>
            </v-card-text>
            <v-divider />
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" :disabled="saving" @click="saveOpen = false">{{ $t('common.cancel') }}</v-btn>
              <v-btn color="primary" variant="flat" :loading="saving" :disabled="!note.trim()" @click="doSave">{{ $t('common.save') }}</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="4500" location="bottom right">
          {{ snackbar.text }}
        </v-snackbar>

        <!-- ════════ HERMES AJAN SOHBETİ (ayrı özellik) ════════ -->
        <HermesChat />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { saveAs } from "file-saver";
import MetaCheckerApi, { getCurrentUser } from "../js/MetaCheckerApi";
import { getLang } from "../js/LangApi";
import { setLocale } from "../i18n";
import { missingAgentRequired } from "../js/checklistRules";
import ChecklistList from "./ChecklistList.vue";
import ItemEditor from "./ItemEditor.vue";
import VersionHistory from "./VersionHistory.vue";
import HermesChat from "./HermesChat.vue";

const { t, locale } = useI18n();

const loading = ref(true);
const loadError = ref("");
const schema = ref(null);
const activeVersion = ref(null);
const items = ref([]);
const author = ref("");
const dirty = ref(false);

const editorOpen = ref(false);
const editTarget = ref(null);
const editIsNew = ref(false);

const historyOpen = ref(false);
const historyRef = ref(null);

const saveOpen = ref(false);
const note = ref("");
const saving = ref(false);
const saveErrors = ref([]);
const conflict = ref(false);

const exporting = ref(false);

const snackbar = ref({ show: false, text: "", color: "success" });
function notify(text, color = "success") {
  snackbar.value = { show: true, text, color };
}

const enabledCount = computed(() => items.value.filter(i => i.enabled).length);

/* logo yolu (3DDashboard public path) */
const logoSrc = computed(() => {
  const base =
    typeof __webpack_public_path__ !== "undefined" && __webpack_public_path__ ? __webpack_public_path__ : "./";
  return `${base}static/images/metaplm_logo_white.png`;
});

async function bootstrap() {
  loading.value = true;
  loadError.value = "";
  // Dil best-effort: kritik yüklemenin DIŞINDA, hata/timeout widget'ı bloklamasın.
  // Locale reaktif olduğu için sonuç bir tick sonra gelse de tüm $t bağları güncellenir.
  getLang()
    .then(r => setLocale(r && r.lang))
    .catch(() => setLocale("en"));
  try {
    const [sch, act, user] = await Promise.all([
      MetaCheckerApi.getSchema(),
      MetaCheckerApi.getActive(),
      getCurrentUser()
    ]);
    schema.value = sch;
    author.value = user;
    applyActive(act);
  } catch (e) {
    loadError.value = e.message || t("app.err.load");
  } finally {
    loading.value = false;
  }
}

function applyActive(act) {
  activeVersion.value = act.version || null;
  items.value = JSON.parse(JSON.stringify(act.items || []));
  dirty.value = false;
}

/* madde id'sini sistem yönetir: en büyük sayısal id + 1 (benzersiz) */
function generateId() {
  const ids = items.value.map(i => String(i.id));
  const nums = ids.map(x => parseInt(x, 10)).filter(x => !isNaN(x));
  let max = nums.length ? Math.max(...nums) : 0;
  let cand = String(max + 1);
  while (ids.includes(cand)) cand = String(++max + 1);
  return cand;
}

/* yeni madde için boş şablon (schema'dan) */
function buildBlank(agent) {
  const fields = (schema.value && schema.value.fields) || [];
  const blank = { agent: agent || (schema.value.agents && schema.value.agents[0]) || "" };
  fields.forEach(f => {
    if (f.key === "agent") return;
    const isCommon = !f.agents || f.agents.length === 0;
    if (!isCommon && !f.agents.includes(blank.agent)) return;
    blank[f.key] = f.default !== undefined ? f.default : f.type === "bool" ? false : f.type === "list" ? [] : f.type === "object" ? {} : "";
  });
  blank.id = generateId(); // id'yi kullanıcı girmez, sistem atar
  blank.category = blank.category || "general"; // kategori LLM tarafında zenginleştirilir
  blank.enabled = false;
  return blank;
}

/* ---- liste olayları ---- */
function onAdd(agent) {
  editTarget.value = buildBlank(agent);
  editIsNew.value = true;
  editorOpen.value = true;
}
function onEdit(item) {
  editTarget.value = item;
  editIsNew.value = false;
  editorOpen.value = true;
}
function onApply(draft) {
  if (editIsNew.value) {
    items.value.push(draft);
  } else {
    const idx = items.value.indexOf(editTarget.value);
    if (idx !== -1) items.value.splice(idx, 1, draft);
  }
  dirty.value = true;
  editorOpen.value = false;
}
function onDelete(item) {
  const idx = items.value.indexOf(item);
  if (idx !== -1) {
    items.value.splice(idx, 1);
    dirty.value = true;
  }
  editorOpen.value = false;
}
function onToggle(item) {
  if (!item.enabled) {
    const missing = missingAgentRequired(item, schema.value);
    if (missing.length) {
      notify(t("app.err.cannotEnable", { id: item.id || "rule", fields: missing.join(", ") }), "warning");
      return;
    }
  }
  item.enabled = !item.enabled;
  dirty.value = true;
}

/* ---- geçmiş ---- */
function openHistory() {
  historyOpen.value = true;
}

/* ---- kaydet ---- */
function openSave() {
  saveErrors.value = [];
  conflict.value = false;
  note.value = "";
  saveOpen.value = true;
}
function isConflict(e) {
  return e && (e.status === 409 || /\b409\b/.test(String(e.message || "")));
}
/** Kaydetmeden önce UI-içi alanları at. `__k` liste satır anahtarıdır (ChecklistList.rowKey);
 *  ItemEditor.collect() yalnız DÜZENLENEN maddeden siliyordu, tam liste POST'unda diğerlerinin
 *  `__k`'sı config'e yazılıyordu (canlı config'in 34 maddesinin 33'ünde birikmişti). */
function forPersist(list) {
  return (list || []).map(({ __k, ...rest }) => rest);
}

async function doSave() {
  saving.value = true;
  saveErrors.value = [];
  conflict.value = false;
  try {
    const payload = forPersist(items.value);
    const v = await MetaCheckerApi.validate({ items: payload, author: author.value, note: note.value });
    if (v && v.valid === false) {
      saveErrors.value = v.errors && v.errors.length ? v.errors : [t("app.err.validateFailed")];
      return;
    }
    const res = await MetaCheckerApi.save({ items: payload, author: author.value, note: note.value.trim() });
    saveOpen.value = false;
    notify(t("app.msg.saved", { id: res.version_id, count: res.item_count }));
    // §3.1 — backend bazı maddelerde alan (category/prompt/batch_question) otomatik düzeltmiş olabilir
    if (Array.isArray(res.refined) && res.refined.length) {
      notify(t("app.msg.refined", { list: res.refined.join(", ") }), "info");
    }
    const act = await MetaCheckerApi.getActive();
    applyActive(act);
    if (historyRef.value) historyRef.value.load();
  } catch (e) {
    if (isConflict(e)) conflict.value = true;
    else saveErrors.value = e.errors && e.errors.length ? e.errors : [e.message || t("app.err.save")];
  } finally {
    saving.value = false;
  }
}
async function reloadActive() {
  try {
    const act = await MetaCheckerApi.getActive();
    applyActive(act);
    saveOpen.value = false;
    conflict.value = false;
    notify(t("app.msg.reloaded"));
  } catch (e) {
    notify(e.message || t("app.err.reload"), "error");
  }
}

async function onRolledBack(res) {
  notify(t("app.msg.restored", { from: res.restored_from, id: res.version_id }));
  try {
    const act = await MetaCheckerApi.getActive();
    applyActive(act);
  } catch (e) {
    notify(e.message || t("app.err.refresh"), "error");
  }
}

async function exportYaml() {
  exporting.value = true;
  try {
    const yaml = await MetaCheckerApi.exportYaml();
    saveAs(new Blob([yaml], { type: "text/plain;charset=utf-8" }), "checklist.yaml");
  } catch (e) {
    notify(e.message || t("app.err.export"), "error");
  } finally {
    exporting.value = false;
  }
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleString(locale.value === "tr" ? "tr-TR" : "en-GB");
}

bootstrap();
</script>

<style>
@import "vuetify/styles";
@import "@mdi/font/css/materialdesignicons.css";

html,
body {
  overflow-y: auto !important;
  height: 100%;
}
</style>

<style scoped>
.app-root {
  height: 100%;
}

/* ════════ HEADER ════════ */
.mc-header {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  padding: 20px 26px;
  background:
    radial-gradient(120% 140% at 0% 0%, #0a6aa1 0%, rgba(10, 106, 161, 0) 55%),
    linear-gradient(125deg, #012f4d 0%, #015686 52%, #1F93CE 130%);
  box-shadow: 0 10px 30px rgba(1, 47, 77, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12);
}
.mc-header__glow {
  position: absolute;
  top: -60%;
  right: -10%;
  width: 480px;
  height: 480px;
  background: radial-gradient(circle, rgba(31, 147, 206, 0.55) 0%, rgba(31, 147, 206, 0) 70%);
  filter: blur(10px);
  pointer-events: none;
}
.mc-header__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: linear-gradient(120deg, rgba(0, 0, 0, 0.5), transparent 60%);
  pointer-events: none;
}
.mc-header__motif {
  position: absolute;
  right: -28px;
  bottom: -70px;
  height: 230px;
  opacity: 0.07;
  transform: rotate(-8deg);
  pointer-events: none;
  user-select: none;
}
.mc-header__accent {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: linear-gradient(90deg, #1F93CE, #5ec8ff, #1F93CE, transparent);
}
.mc-header__content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}

.mc-brand {
  display: flex;
  align-items: center;
  gap: 16px;
}
.mc-brand__logo {
  height: 50px;
  width: auto;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35));
}
.mc-brand__divider {
  width: 1px;
  height: 42px;
  background: linear-gradient(rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0));
}
.mc-brand__title {
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #fff;
  line-height: 1.1;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}
.mc-brand__title .accent {
  color: #8fd6ff;
}
.mc-brand__subtitle {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.78);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-top: 2px;
}

.mc-stats {
  display: flex;
  gap: 10px;
  margin-left: auto;
}
.mc-stat {
  min-width: 64px;
  padding: 8px 14px;
  border-radius: 12px;
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(6px);
}
.mc-stat--dirty {
  background: rgba(239, 108, 0, 0.22);
  border-color: rgba(255, 167, 38, 0.5);
}
.mc-stat__num {
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
.mc-stat__num--on {
  color: #7CFFB2;
}
.mc-stat__lbl {
  font-size: 0.62rem;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 3px;
}

@media (max-width: 720px) {
  .mc-stats { order: 3; margin-left: 0; width: 100%; }
  .mc-actions { order: 2; margin-left: auto; }
}
</style>
