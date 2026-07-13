<template>
  <v-row>
    <!-- Version list -->
    <v-col cols="12" md="5">
      <div class="d-flex align-center mb-2">
        <span class="font-weight-medium">{{ $t('history.versions') }}</span>
        <v-spacer />
        <v-btn size="small" variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="load">
          {{ $t('common.refresh') }}
        </v-btn>
      </div>

      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-2">{{ error }}</v-alert>

      <v-list density="compact" lines="two" class="version-list">
        <v-list-item
          v-for="v in versions"
          :key="v.id"
          :active="selectedId === v.id"
          @click="select(v.id)"
        >
          <template #prepend>
            <v-chip size="small" :color="activeId === v.id ? 'success' : 'primary'" variant="tonal" class="mr-1">
              #{{ v.id }}
            </v-chip>
          </template>
          <v-list-item-title>
            {{ v.note || $t('common.noNote') }}
            <v-chip v-if="activeId === v.id" size="x-small" color="success" variant="flat" class="ml-1">{{ $t('history.activeChip') }}</v-chip>
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ v.author }} · {{ formatDate(v.created_at) }}
          </v-list-item-subtitle>
        </v-list-item>
        <v-list-item v-if="!versions.length && !loading">
          <v-list-item-title class="text-medium-emphasis">{{ $t('history.noVersions') }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-col>

    <!-- Preview -->
    <v-col cols="12" md="7">
      <div class="d-flex align-center mb-2">
        <span class="font-weight-medium">
          {{ selectedId ? $t('history.preview', { id: selectedId }) : $t('history.previewEmpty') }}
        </span>
        <v-spacer />
        <v-btn
          v-if="selectedId && selectedId !== activeId"
          size="small"
          color="warning"
          variant="flat"
          prepend-icon="mdi-restore"
          :loading="rollingBack"
          @click="doRollback"
        >
          {{ $t('history.restore') }}
        </v-btn>
      </div>

      <v-alert
        v-if="selectedId && selectedId === activeId"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-2"
      >{{ $t('history.alreadyActive') }}</v-alert>

      <v-card variant="outlined" v-if="selectedId">
        <v-card-text style="max-height: 60vh; overflow: auto">
          <v-progress-linear v-if="previewLoading" indeterminate color="primary" class="mb-2" />

          <!-- Aktife göre diff özeti -->
          <div v-if="!previewLoading && selectedId !== activeId" class="d-flex mb-2" style="gap: 6px">
            <v-chip size="x-small" color="success" variant="tonal">{{ $t('history.added', { n: diff.added.length }) }}</v-chip>
            <v-chip size="x-small" color="warning" variant="tonal">{{ $t('history.changed', { n: diff.changed.length }) }}</v-chip>
            <v-chip size="x-small" color="error" variant="tonal">{{ $t('history.removed', { n: diff.removed.length }) }}</v-chip>
          </div>

          <v-table v-if="previewItems.length" density="compact">
            <thead>
              <tr>
                <th style="width: 90px">{{ $t('history.col.diff') }}</th>
                <th>{{ $t('history.col.id') }}</th>
                <th>{{ $t('history.col.name') }}</th>
                <th>{{ $t('history.col.agent') }}</th>
                <th>{{ $t('history.col.active') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, i) in previewItems" :key="it.id || i">
                <td>
                  <v-chip v-if="rowStatus(it) !== 'same'" size="x-small" :color="diffColor(rowStatus(it))" variant="tonal">
                    {{ diffLabel(rowStatus(it)) }}
                  </v-chip>
                </td>
                <td class="text-mono">{{ it.id }}</td>
                <td>{{ it.name_en || it.name }}</td>
                <td>{{ agentLabel(it.agent) }}</td>
                <td>
                  <v-icon size="small" :color="it.enabled ? 'success' : 'grey'">
                    {{ it.enabled ? 'mdi-check-circle' : 'mdi-minus-circle' }}
                  </v-icon>
                </td>
              </tr>
              <!-- aktifte olup bu sürümde olmayanlar (çıkarılacaklar) -->
              <tr v-for="rid in diff.removed" :key="'rm-' + rid" class="removed-row">
                <td><v-chip size="x-small" color="error" variant="tonal">{{ $t('history.diff.removed') }}</v-chip></td>
                <td class="text-mono">{{ rid }}</td>
                <td colspan="3" class="text-medium-emphasis">{{ $t('history.missingNote') }}</td>
              </tr>
            </tbody>
          </v-table>
          <div v-else-if="!previewLoading" class="text-medium-emphasis">{{ $t('history.noRules') }}</div>
        </v-card-text>
      </v-card>
      <v-alert v-else type="info" variant="tonal" density="compact">
        {{ $t('history.selectHint') }}
      </v-alert>
    </v-col>
  </v-row>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import MetaCheckerApi, { getCurrentUser } from "../js/MetaCheckerApi";

const { t, locale } = useI18n();
/** Agent label display: code + "Agent" suffix. */
function agentLabel(a) {
  return a ? `${a} ${t("common.agentSuffix")}` : a;
}

const props = defineProps({
  // Şu an aktif sürümün id'si (yeşil rozet için)
  activeId: { type: [Number, String], default: null },
  // Aktif config maddeleri (seçili sürümle diff için)
  activeItems: { type: Array, default: () => [] }
});

const emit = defineEmits(["rolled-back", "error"]);

const versions = ref([]);
const loading = ref(false);
const error = ref("");

const selectedId = ref(null);
const previewItems = ref([]);
const previewLoading = ref(false);

const rollingBack = ref(false);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const res = await MetaCheckerApi.getVersions();
    versions.value = (res.versions || []).slice().sort((a, b) => b.id - a.id);
  } catch (e) {
    error.value = e.message || t("history.err.list");
  } finally {
    loading.value = false;
  }
}

async function select(id) {
  selectedId.value = id;
  previewLoading.value = true;
  previewItems.value = [];
  try {
    const res = await MetaCheckerApi.getVersion(id);
    previewItems.value = res.items || [];
  } catch (e) {
    error.value = e.message || t("history.err.load");
  } finally {
    previewLoading.value = false;
  }
}

async function doRollback() {
  rollingBack.value = true;
  try {
    const author = await getCurrentUser();
    const res = await MetaCheckerApi.rollback({ id: selectedId.value, author });
    emit("rolled-back", res);
    await load();
  } catch (e) {
    emit("error", e);
    error.value = e.message || t("history.err.rollback");
  } finally {
    rollingBack.value = false;
  }
}

/* ---- Aktif config ile diff ---- */
const activeMap = computed(() => {
  const m = new Map();
  (props.activeItems || []).forEach(it => m.set(it.id, it));
  return m;
});

function rowStatus(it) {
  if (selectedId.value === props.activeId) return "same";
  const base = activeMap.value.get(it.id);
  if (!base) return "added";
  return JSON.stringify(base) === JSON.stringify(it) ? "same" : "changed";
}

const diff = computed(() => {
  const added = [];
  const changed = [];
  if (selectedId.value !== props.activeId) {
    previewItems.value.forEach(it => {
      const s = rowStatus(it);
      if (s === "added") added.push(it.id);
      else if (s === "changed") changed.push(it.id);
    });
  }
  const previewIds = new Set(previewItems.value.map(it => it.id));
  const removed = (props.activeItems || [])
    .map(it => it.id)
    .filter(id => !previewIds.has(id));
  return { added, changed, removed };
});

function diffColor(s) {
  return { added: "success", changed: "warning", removed: "error" }[s] || "grey";
}
function diffLabel(s) {
  return s ? t("history.diff." + s) : "";
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleString(locale.value === "tr" ? "tr-TR" : "en-GB");
}

defineExpose({ load });
onMounted(load);
</script>

<style scoped>
.version-list {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  max-height: 60vh;
  overflow: auto;
}
.text-mono {
  font-family: "Courier New", monospace;
  font-size: 0.85rem;
}
.removed-row {
  background: rgba(198, 40, 40, 0.05);
}
</style>
