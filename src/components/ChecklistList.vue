<template>
  <div class="d-flex flex-column" style="height: 100%">
    <!-- toolbar -->
    <div class="d-flex align-center mb-3" style="gap: 8px; flex-wrap: wrap">
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        :placeholder="$t('checklist.searchPh')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        style="max-width: 320px"
      />
      <v-select v-model="fGroup" :items="groupFilterOptions" :label="$t('checklist.group')" density="compact" variant="outlined" hide-details clearable style="max-width: 170px" />
      <v-select v-model="fSeverity" :items="severityOptions" :label="$t('checklist.severity')" density="compact" variant="outlined" hide-details clearable style="max-width: 150px" />
      <v-select v-model="fEnabled" :items="enabledOptions" :label="$t('checklist.status')" density="compact" variant="outlined" hide-details clearable style="max-width: 140px" />
      <v-spacer />
      <span class="text-caption text-medium-emphasis mr-2">{{ $t('checklist.counts', { filtered: filtered.length, total: items.length, active: enabledCount }) }}</span>
      <div class="d-flex align-center" style="gap: 4px">
        <slot name="actions" />
      </div>
    </div>

    <!-- full-width table -->
    <div class="list-scroll flex-grow-1">
      <table class="rule-table">
        <colgroup>
          <col style="width: 52px" />
          <col />
          <col style="width: 92px" />
          <col style="width: 104px" />
          <col style="width: 72px" />
        </colgroup>
        <tbody>
          <template v-for="sec in sections" :key="sec.group">
            <!-- soft, collapsible group header -->
            <tr class="grp-row">
              <td colspan="5">
                <div class="grp" @click="toggleGroup(sec.group)">
                  <v-icon size="small" class="grp__chev" :class="{ collapsed: isCollapsed(sec.group) }">mdi-chevron-down</v-icon>
                  <span class="grp__bar" :style="{ background: groupColor(sec.group) }"></span>
                  <span class="grp__name">{{ groupLabel(sec.group) }}</span>
                  <span class="grp__count">{{ sec.mainItems.length + sec.helperItems.length }}</span>
                  <span class="grp__pill" :class="'pill--' + sec.editable">{{ editLabel(sec.editable) }}</span>
                  <span v-if="sec.editable === 'readonly'" class="grp__note">
                    <v-icon size="x-small">mdi-information-outline</v-icon>
                    {{ $t('checklist.readonlyNote') }}
                  </span>
                  <v-spacer />
                  <v-btn
                    v-if="sec.editable !== 'readonly' && sec.addAgent"
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-plus"
                    @click.stop="$emit('add', sec.addAgent)"
                  >{{ sec.editable === 'data_bound' ? $t('checklist.addRule') : $t('checklist.add') }}</v-btn>
                </div>
              </td>
            </tr>

            <template v-if="!isCollapsed(sec.group)">
            <!-- main rows -->
            <tr
              v-for="item in sec.mainItems"
              :key="rowKey(item)"
              class="rule-row"
              :class="{ off: !item.enabled }"
              @click="$emit('edit', item)"
            >
              <td class="c-id">{{ item.id || '—' }}</td>
              <td class="c-name">
                <span class="nm">{{ displayName(item) }}</span>
                <span v-for="dt in drawingChips(item)" :key="dt.key" class="type-chip" :style="dt.style">
                  <v-icon size="11" class="mr-1">{{ dt.icon }}</v-icon>{{ dt.label }}
                </span>
                <span v-if="item.extract_only" class="badge badge--extract">{{ $t('checklist.extract') }}</span>
                <span v-if="sec.editable === 'readonly'" class="badge badge--lock"><v-icon size="11">mdi-lock</v-icon></span>
              </td>
              <td class="c-sev">
                <span class="sev-chip" :style="sevStyle(item.severity)">{{ sevLabel(item.severity) }}</span>
              </td>
              <td class="c-agent">
                <span class="agent-chip" :style="agentStyle(item.agent)">{{ agentLabel(item.agent) }}</span>
              </td>
              <td class="c-act" @click.stop>
                <v-switch :model-value="!!item.enabled" color="primary" density="compact" hide-details inset @update:model-value="$emit('toggle', item)" />
              </td>
            </tr>

            <!-- helper agent sub-group (e.g. CATIA) -->
            <template v-if="sec.helperItems.length">
              <tr class="sub-row"><td colspan="5"><v-icon size="x-small" class="mr-1">mdi-robot</v-icon>{{ sec.helperLabel }}</td></tr>
              <tr
                v-for="item in sec.helperItems"
                :key="rowKey(item)"
                class="rule-row helper"
                :class="{ off: !item.enabled }"
                @click="$emit('edit', item)"
              >
                <td class="c-id">{{ item.id || '—' }}</td>
                <td class="c-name">
                  <span class="nm">{{ displayName(item) }}</span>
                  <span v-for="dt in drawingChips(item)" :key="dt.key" class="type-chip" :style="dt.style">
                    <v-icon size="11" class="mr-1">{{ dt.icon }}</v-icon>{{ dt.label }}
                  </span>
                  <span class="badge badge--lock"><v-icon size="11">mdi-lock</v-icon></span>
                </td>
                <td class="c-sev"><span class="sev-chip" :style="sevStyle(item.severity)">{{ sevLabel(item.severity) }}</span></td>
                <td class="c-agent"><span class="agent-chip" :style="agentStyle(item.agent)">{{ agentLabel(item.agent) }}</span></td>
                <td class="c-act" @click.stop>
                  <v-switch :model-value="!!item.enabled" color="primary" density="compact" hide-details inset @update:model-value="$emit('toggle', item)" />
                </td>
              </tr>
            </template>
            </template>
          </template>
        </tbody>
      </table>

      <div v-if="!filtered.length" class="text-center text-medium-emphasis py-10">{{ $t('checklist.empty') }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from "vue";
import { useI18n } from "vue-i18n";
import { severityColor, groupInfo, GROUP_ORDER, mainAgentOfGroup, groupEditable, ruleName } from "../js/checklistRules";

const { t, te, locale } = useI18n();
/** Group label display: translate if in catalog, otherwise show raw (backend) value. */
function groupLabel(g) {
  const k = `groups.${g}`;
  return te(k) ? t(k) : g;
}
/** Agent label display: code + "Agent" suffix (chip CSS capitalizes first letter). */
function agentLabel(a) {
  return a ? `${a} ${t("common.agentSuffix")}` : a;
}

const props = defineProps({
  items: { type: Array, default: () => [] },
  schema: { type: Object, default: () => ({}) }
});

defineEmits(["edit", "toggle", "add"]);

const search = ref("");
const fGroup = ref(null);
const fSeverity = ref(null);
const fEnabled = ref(null);

const severityOptions = computed(() => (props.schema.severities || []).map(v => ({ title: sevLabel(v), value: v })));
/** Severity label: localized (Majör/Minör/Bilgi), falls back to the raw enum code. */
function sevLabel(s) {
  if (!s) return "—";
  const k = `severity.${s}`;
  return te(k) ? t(k) : s;
}
const enabledOptions = computed(() => [
  { title: t("checklist.statusActive"), value: "on" },
  { title: t("checklist.statusInactive"), value: "off" }
]);
const enabledCount = computed(() => props.items.filter(i => i.enabled).length);

/* collapsible groups */
const collapsed = reactive({});
function toggleGroup(g) {
  collapsed[g] = !collapsed[g];
}
function isCollapsed(g) {
  return !!collapsed[g];
}

let keyCounter = 0;
function rowKey(item) {
  if (!item.__k) item.__k = ++keyCounter;
  return item.id || item.__k;
}
function displayName(item) {
  return ruleName(item, locale.value) || t("common.unnamed");
}

/* drawing_types → Part / Assembly chips (empty = all types) */
const DRAW_TYPES = {
  assembly: { labelKey: "checklist.assembly", icon: "mdi-puzzle-outline", color: "#5E35B1" },
  part: { labelKey: "checklist.part", icon: "mdi-cube-outline", color: "#00897B" }
};
function drawingChips(item) {
  // backend uses "single_part" as a synonym for "part" — collapse and dedupe
  const seen = [];
  const arr = (Array.isArray(item.drawing_types) ? item.drawing_types : [])
    .map(v => (v === "single_part" ? "part" : v))
    .filter(v => (seen.includes(v) ? false : seen.push(v)));
  if (!arr.length) {
    // empty = applies to all drawing types
    const c = "#90A4AE";
    return [{ key: "all", label: t("checklist.allTypes"), icon: "mdi-shape-outline", style: { color: c, borderColor: c + "66", background: c + "14" } }];
  }
  return arr.map(v => {
    const d = DRAW_TYPES[v] || { labelKey: null, icon: "mdi-file-outline", color: "#607D8B" };
    return {
      key: v,
      label: d.labelKey ? t(d.labelKey) : v,
      icon: d.icon,
      style: { color: d.color, borderColor: d.color + "55", background: d.color + "14" }
    };
  });
}

const filtered = computed(() => {
  const q = (search.value || "").toLowerCase().trim();
  return props.items.filter(i => {
    if (fGroup.value && groupInfo(i.agent, props.schema).group !== fGroup.value) return false;
    if (fSeverity.value && i.severity !== fSeverity.value) return false;
    if (fEnabled.value === "on" && !i.enabled) return false;
    if (fEnabled.value === "off" && i.enabled) return false;
    if (q) {
      const hay = [i.id, i.name, i.name_en, i.category].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

const byCat = (a, b) => String(a.category).localeCompare(String(b.category));

const sections = computed(() => {
  const byGroup = new Map();
  filtered.value.forEach(item => {
    rowKey(item);
    const gi = groupInfo(item.agent, props.schema);
    if (!byGroup.has(gi.group)) byGroup.set(gi.group, []);
    byGroup.get(gi.group).push({ item, gi });
  });
  const order = [...GROUP_ORDER, ...[...byGroup.keys()].filter(g => !GROUP_ORDER.includes(g))];
  const out = [];
  order.forEach(group => {
    if (!byGroup.has(group)) return;
    const rows = byGroup.get(group);
    out.push({
      group,
      editable: groupEditable(group, props.schema),
      addAgent: mainAgentOfGroup(group, props.schema),
      mainItems: rows.filter(r => r.gi.role !== "helper").map(r => r.item).sort(byCat),
      helperItems: rows.filter(r => r.gi.role === "helper").map(r => r.item).sort(byCat),
      helperLabel: rows.find(r => r.gi.role === "helper")?.gi.helper_label || t("checklist.helperFallback")
    });
  });
  return out;
});

const groupFilterOptions = computed(() => sections.value.map(s => ({ title: groupLabel(s.group), value: s.group })));

/* ---- renkler ---- */
const SEV_HEX = {
  "severity-major": "#EF6C00",
  "severity-minor": "#1F93CE",
  "severity-info": "#757575"
};
function sevStyle(sev) {
  const c = SEV_HEX[severityColor(sev)] || "#9E9E9E";
  return { color: c, borderColor: c, background: c + "1A" };
}

const AGENT_HEX = {
  vision: "#3949AB",
  extractor: "#00897B",
  iso: "#5E35B1",
  catia: "#546E7A",
  plm: "#2E7D32",
  cross: "#EF6C00"
};
function agentHex(agent) {
  return AGENT_HEX[agent] || "#607D8B";
}
function agentStyle(agent) {
  const c = agentHex(agent);
  return { color: c, borderColor: c + "66", background: c + "14" };
}
function groupColor(group) {
  const a = mainAgentOfGroup(group, props.schema);
  return agentHex(a);
}

function editLabel(e) {
  const k = `checklist.edit.${e}`;
  return te(k) ? t(k) : e;
}
</script>

<style scoped>
.list-scroll {
  overflow-y: auto;
  min-height: 0;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
}
.rule-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

/* group header (soft) */
.grp-row td {
  padding: 0;
}
.grp {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: #f6f8fa;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  user-select: none;
}
.grp:hover {
  background: #eef2f5;
}
.grp__chev {
  transition: transform 0.18s ease;
  color: #607d8b;
}
.grp__chev.collapsed {
  transform: rotate(-90deg);
}
.grp__count {
  font-size: 0.7rem;
  font-weight: 600;
  color: #607d8b;
  background: #e7edf1;
  border-radius: 9px;
  padding: 1px 8px;
}
.grp__bar {
  width: 4px;
  height: 18px;
  border-radius: 2px;
}
.grp__name {
  font-weight: 700;
  color: #1b3a4b;
  font-size: 0.92rem;
}
.grp__pill {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.pill--full { background: #e3f2fd; color: #015686; }
.pill--data_bound { background: #e1f5fe; color: #0277bd; }
.pill--readonly { background: #eceff1; color: #607d8b; }
.grp__note {
  font-size: 0.7rem;
  color: #78909c;
}

.sub-row td {
  padding: 4px 12px 2px 28px;
  font-size: 0.72rem;
  font-style: italic;
  color: #90a4ae;
}

/* satırlar */
.rule-row {
  cursor: pointer;
  transition: background 0.1s;
}
.rule-row:hover {
  background: rgba(31, 147, 206, 0.07);
}
.rule-row td {
  padding: 7px 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rule-row.off {
  opacity: 0.5;
}
.rule-row.helper td:first-child {
  padding-left: 28px;
}

.c-id { width: 56px; font-family: "Courier New", monospace; font-size: 0.8rem; color: #455a64; }
.c-name { }
.c-sev { width: 92px; }
.c-agent { width: 104px; text-align: right; }
.c-act { text-align: right; padding-right: 8px !important; padding-left: 0 !important; }
.c-act :deep(.v-switch) {
  justify-content: flex-end;
  transform: scale(0.78);
  transform-origin: right center;
}
.c-act :deep(.v-switch .v-selection-control) { min-height: 20px; }
.c-act :deep(.v-selection-control__wrapper) { margin-right: 0; }

.sev-chip,
.agent-chip {
  display: inline-block;
  padding: 1px 9px;
  border-radius: 11px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid;
  text-transform: capitalize;
}
.nm { vertical-align: middle; }
.badge {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 0 6px;
  height: 16px;
  border-radius: 8px;
  font-size: 0.62rem;
  font-weight: 700;
  vertical-align: middle;
}
.badge--extract { background: #ede7f6; color: #5e35b1; }
.badge--lock { background: #eceff1; color: #78909c; padding: 0 4px; }

.type-chip {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 0 8px;
  height: 17px;
  border-radius: 9px;
  font-size: 0.64rem;
  font-weight: 700;
  border: 1px solid;
  vertical-align: middle;
}
</style>
