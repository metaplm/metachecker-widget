<template>
  <v-dialog :model-value="modelValue" max-width="860" persistent scrollable>
    <v-card v-if="form" class="mc-edit" rounded="lg">
      <!-- branded header -->
      <div class="mc-edit__head" :style="{ '--accent': accent }">
        <div class="mc-edit__icon"><v-icon size="22" color="white">{{ headIcon }}</v-icon></div>
        <div class="mc-edit__titles">
          <div class="mc-edit__title">{{ isNew ? $t('editor.titleNew') : (readonly ? $t('editor.titleView') : $t('editor.titleEdit')) }}</div>
          <div class="mc-edit__sub">
            <span class="mono">#{{ form.id }}</span><span class="dot">·</span>{{ displayName }}
          </div>
        </div>
        <v-spacer />
        <div class="mc-edit__chips">
          <span class="ec ec--agent">{{ agentLabel(form.agent) }}</span>
          <span class="ec ec--group">{{ groupLabel }}</span>
          <span class="ec" :class="'ec--' + editable">{{ editLabel }}</span>
        </div>
        <v-btn icon="mdi-close" variant="text" color="white" size="small" class="ml-2" @click="$emit('close')" />
      </div>

      <v-card-text class="mc-edit__body" style="max-height: 66vh">
        <v-alert v-if="readonly" type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-lock-outline">
          <strong>{{ $t('editor.readonlyStrong') }}</strong>{{ $t('editor.readonlyText') }}
        </v-alert>
        <v-alert v-else-if="editable === 'data_bound'" type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-database">
          <strong>{{ $t('editor.dataBoundStrong') }}</strong>{{ $t('editor.dataBoundText') }}
        </v-alert>

        <v-alert v-if="!readonly && relevantErrors.length" type="error" variant="tonal" density="compact" class="mb-3">
          <ul class="ma-0 pl-4"><li v-for="(e, i) in relevantErrors" :key="i">{{ e }}</li></ul>
        </v-alert>
        <v-alert v-else-if="!readonly && validated && valid" type="success" variant="tonal" density="compact" class="mb-3">
          {{ $t('editor.valid') }}
        </v-alert>

        <v-row dense class="compact-rows">
          <template v-for="(entry, i) in layout" :key="i">
            <v-col v-if="entry.__section" cols="12" class="sec-col">
              <div class="sec-head" :style="entry.accent ? { color: accent } : null">
                <span class="sec-bar" :style="{ background: entry.accent ? accent : '#90a4ae' }"></span>
                <v-icon size="15" class="mr-1">{{ entry.icon }}</v-icon>{{ entry.label }}
              </div>
            </v-col>

            <v-col v-else :cols="colsFor(entry)">
              <!-- scope: filtered by agent -->
              <v-select
                v-if="entry.key === 'scope'"
                v-model="form.scope"
                :items="scopeOptions"
                :label="labelFor(entry)"
                :hint="translateHelpText(entry.help)"
                :disabled="readonly"
                density="compact"
                variant="outlined"
              />

              <!-- drawing_types: multi-select (Part / Assembly · empty = both) -->
              <div v-else-if="entry.key === 'drawing_types'" class="boxed">
                <label class="boxed__label">{{ $t('editor.drawingTypes') }}</label>
                <div class="dt-wrap">
                  <button
                    v-for="o in drawOptions"
                    :key="o.label"
                    type="button"
                    class="dt-chip"
                    :class="{ sel: hasDraw(o.value) }"
                    :disabled="readonly"
                    @click="toggleDraw(o.value)"
                  >
                    <v-icon size="14" class="mr-1">{{ o.icon }}</v-icon>{{ o.label }}
                  </button>
                </div>
                <div class="text-caption text-medium-emphasis mt-1">
                  {{ drawAppliesAll ? $t('editor.appliesAll') : $t('editor.appliesSel') }}
                </div>
              </div>

              <!-- plm_query → registry lookup -->
              <v-select
                v-else-if="isRegistrySelect(entry)"
                v-model="form[entry.key]"
                :items="registryItemsFor(entry)"
                :label="labelFor(entry)"
                :hint="translateHelpText(entry.help) || $t('editor.pickHint')"
                :disabled="readonly"
                clearable
                density="compact"
                variant="outlined"
                prepend-inner-icon="mdi-database-search"
              />

              <!-- cross_query builder -->
              <div v-else-if="isCrossBuilder(entry)" class="boxed">
                <label class="boxed__label">{{ labelFor(entry) }}</label>
                <div class="d-flex align-center" style="gap: 8px">
                  <v-select v-model="crossExpr.a" :items="crossFieldItems" :label="$t('editor.operandA')" density="compact" variant="outlined" hide-details :disabled="readonly" @update:model-value="syncCross" />
                  <v-select v-model="crossExpr.op" :items="crossOps" :label="$t('editor.op')" density="compact" variant="outlined" hide-details style="max-width: 88px" :disabled="readonly" @update:model-value="syncCross" />
                  <v-select v-model="crossExpr.b" :items="crossFieldItems" :label="$t('editor.operandB')" density="compact" variant="outlined" hide-details :disabled="readonly" @update:model-value="syncCross" />
                </div>
                <div class="text-caption text-medium-emphasis mt-1">{{ $t('editor.result') }} <code>{{ form[entry.key] || '—' }}</code></div>
              </div>

              <!-- data-bound field but registry not yet available → show warning instead of free text (§4.4) -->
              <div v-else-if="isDataBoundMissing(entry)" class="boxed boxed--warn">
                <label class="boxed__label">{{ labelFor(entry) }}</label>
                <div class="db-warn">
                  <v-icon size="15" color="warning" class="mr-1">mdi-alert-outline</v-icon>
                  {{ $t('editor.dataMissing') }}
                </div>
                <div v-if="form[entry.key]" class="text-caption text-medium-emphasis mt-1">
                  {{ $t('editor.current') }} <code>{{ form[entry.key] }}</code>
                </div>
              </div>

              <!-- plm pass_condition → small condition builder (filled / == 'X' / in [...]) (§4.4) -->
              <div v-else-if="isPassCondition(entry)" class="boxed">
                <label class="boxed__label">{{ labelFor(entry) }}</label>
                <div class="d-flex align-center" style="gap: 8px; flex-wrap: wrap">
                  <v-select v-model="passCond.mode" :items="passModes" :label="$t('editor.pass.condition')" density="compact" variant="outlined" hide-details style="max-width: 170px" :disabled="readonly" @update:model-value="syncPass" />
                  <v-text-field v-if="passCond.mode === 'eq'" v-model="passCond.value" :label="$t('editor.pass.equalsValue')" density="compact" variant="outlined" hide-details style="min-width: 180px" :disabled="readonly" @update:model-value="syncPass" />
                  <v-combobox v-else-if="passCond.mode === 'in'" v-model="passCond.list" :label="$t('editor.pass.inHint')" multiple chips closable-chips density="compact" variant="outlined" hide-details style="min-width: 220px" :disabled="readonly" @update:model-value="syncPass" />
                </div>
                <div class="text-caption text-medium-emphasis mt-1">{{ $t('editor.result') }} <code>{{ form[entry.key] || $t('editor.pass.filledResult') }}</code></div>
              </div>

              <v-text-field
                v-else-if="entry.type === 'string'"
                v-model="form[entry.key]"
                :label="labelFor(entry)"
                :hint="translateHelpText(entry.help)"
                :disabled="readonly"
                density="compact"
                variant="outlined"
              />
              <v-textarea
                v-else-if="entry.type === 'text'"
                v-model="form[entry.key]"
                :label="labelFor(entry)"
                :hint="translateHelpText(entry.help)"
                :disabled="readonly"
                auto-grow
                rows="2"
                density="compact"
                variant="outlined"
              />
              <v-select
                v-else-if="entry.type === 'enum'"
                v-model="form[entry.key]"
                :items="optionsFor(entry)"
                :item-title="translateOptionTitle"
                :label="labelFor(entry)"
                :hint="translateHelpText(entry.help)"
                :disabled="readonly"
                clearable
                density="compact"
                variant="outlined"
              />
              <div v-else-if="entry.type === 'bool'" class="bool-box" :class="{ on: !!form[entry.key] }">
                <v-switch v-model="form[entry.key]" :label="labelFor(entry)" :disabled="readonly" color="primary" inset density="compact" hide-details />
              </div>
              <v-combobox
                v-else-if="entry.type === 'list'"
                v-model="form[entry.key]"
                :items="optionsFor(entry)"
                :item-title="translateOptionTitle"
                :label="labelFor(entry)"
                :hint="translateHelpText(entry.help) || $t('editor.listHint')"
                :disabled="readonly"
                multiple
                chips
                closable-chips
                clearable
                density="compact"
                variant="outlined"
              />
              <div v-else-if="entry.type === 'object'" class="boxed">
                <label class="boxed__label">{{ labelFor(entry) }}</label>
                <div v-for="(row, idx) in kvRows[entry.key] || []" :key="idx" class="d-flex align-center mb-2">
                  <v-text-field v-model="row.k" :label="$t('editor.key')" density="compact" variant="outlined" hide-details class="mr-2" :disabled="readonly" @update:model-value="syncObject(entry.key)" />
                  <v-text-field v-model="row.v" :label="$t('editor.value')" density="compact" variant="outlined" hide-details class="mr-2" :disabled="readonly" @update:model-value="syncObject(entry.key)" />
                  <v-btn v-if="!readonly" icon="mdi-close" size="small" variant="text" @click="removeKv(entry.key, idx)" />
                </div>
                <v-btn v-if="!readonly" size="small" variant="tonal" prepend-icon="mdi-plus" @click="addKv(entry.key)">{{ $t('editor.addRow') }}</v-btn>
              </div>
              <v-text-field
                v-else
                v-model="form[entry.key]"
                :label="labelFor(entry) + ' (' + entry.type + ')'"
                :disabled="readonly"
                density="compact"
                variant="outlined"
              />
            </v-col>
          </template>
        </v-row>
      </v-card-text>

      <v-divider />
      <v-card-actions class="mc-edit__foot">
        <v-btn v-if="!isNew && !readonly" color="error" variant="text" prepend-icon="mdi-delete-outline" @click="$emit('delete', item)">{{ $t('editor.delete') }}</v-btn>
        <v-spacer />
        <span v-if="!readonly && !(validated && valid)" class="text-caption text-medium-emphasis mr-2">{{ $t('editor.validateFirst') }}</span>
        <v-btn variant="text" @click="$emit('close')">{{ readonly ? $t('common.close') : $t('common.cancel') }}</v-btn>
        <v-btn v-if="!readonly" variant="tonal" color="primary" prepend-icon="mdi-shield-check" :loading="validating" @click="runValidate">{{ $t('editor.validate') }}</v-btn>
        <v-btn v-if="!readonly" color="primary" variant="flat" class="px-6" prepend-icon="mdi-check" :disabled="!validated || !valid" @click="apply">
          {{ isNew ? $t('checklist.addRule') : $t('editor.apply') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, toRaw } from "vue";
import { useI18n } from "vue-i18n";
import MetaCheckerApi from "../js/MetaCheckerApi";
import { groupInfo, plmAttributes, crossFields, agentColor } from "../js/checklistRules";

const { t, te } = useI18n();
/** Group label display: translate if in catalog, otherwise show raw (backend) value. */
function groupDisplay(g) {
  const k = `groups.${g}`;
  return te(k) ? t(k) : g;
}
/** Agent label display: code + "Agent" suffix (chip CSS capitalizes first letter). */
function agentLabel(a) {
  return a ? `${a} ${t("common.agentSuffix")}` : a;
}
/** Field label translation: backend returns Turkish labels, translate to English */
const FIELD_LABEL_TRANSLATIONS = {
  // Exact field labels served by /schema (keep in sync with backend `fields[].label`)
  "Madde ID": "Item ID",
  "Ad (TR)": "Name (TR)",
  "Ad (EN)": "Name (EN)",
  "Aktif": "Active",
  "Çizim tipleri": "Drawing types",
  "Prompt (tam)": "Prompt (full)",
  "Batch sorusu (kısa)": "Batch question (short)",
  "Balon (bbox işaretle)": "Balloon (mark bbox)",
  "Özel toplama": "Custom aggregation",
  "Koşullu (özellik yoksa N/A)": "Conditional (N/A if attribute missing)",
  "PLM sorgusu": "PLM query",
  "Geçme koşulu": "Pass condition",
  "CATIA sorgusu": "CATIA query",
  "İzometrik vision prompt": "Isometric vision prompt",
  "Cross kuralı": "Cross rule",
  "Cross kaynakları": "Cross sources",
  "Çıkarılacak alanlar": "Fields to extract",
  "Sadece veri (puanlanmaz)": "Data only (not scored)",
  "Ad": "Name",
  "Kapsam": "Scope",
  "Önem": "Severity",
  "Açıklama": "Description",
  "Sorgu": "Query",
  "Koşul": "Condition",
  "Kategori": "Category",
  "Tip": "Type",
  "Değer": "Value",
  "Etkin": "Enabled",
  "Başlık": "Title",
  "İçerik": "Content",
  "Not": "Note",
  "Yorum": "Comment",
  "Durum": "Status",
  "Acı": "Pain",
  "Tarih": "Date",
  "Saat": "Time",
  "Sürüm": "Version",
  "Yazar": "Author",
  "Ajan": "Agent",
  "Rol": "Role",
  "Grup": "Group",
  "Çizim Tipleri": "Drawing Types",
  "Çoklu Seçim": "Multiple Selection",
  "Alan": "Field",
  "Eşleşme": "Match",
  "Boş": "Empty",
  "Dolu": "Filled",
  "İşlem": "Operation",
  "Koşullu": "Conditional",
  "Varsayılan": "Default",
  "Zorunlu": "Required",
  "İsteğe Bağlı": "Optional",
  "İçerik Analizi": "Content Analysis",
  "Veri Kaynağı": "Data Source",
  "Veritabanı": "Database",
  "API": "API",
  "Dosya": "File",
  "Kayıt": "Record",
  "Düzen": "Format",
  "JSON": "JSON",
  "XML": "XML",
  "CSV": "CSV",
  "Metin": "Text",
  "Sayı": "Number",
  "Boolean": "Boolean",
  "Tarih Saati": "DateTime",
  "Listele": "List",
  "Harita": "Map",
  "Nesne": "Object",
  "Dizi": "Array"
};

function translateFieldLabel(label) {
  if (!label) return label;
  return FIELD_LABEL_TRANSLATIONS[label] || label;
}

/** Help text translation: backend may return Turkish help text, translate to English */
const HELP_TEXT_TRANSLATIONS = {
  // Exact help strings served by /schema (keep in sync with backend `fields[].help`)
  "Benzersiz (ör. 2, 2b, antet)": "Unique (e.g. 2, 2b, title block)",
  "Boş = tüm tipler (part/assembly)": "Empty = all types (part/assembly)",
  "ör. vision.revision == plm.revision": "e.g. vision.revision == plm.revision",
  "Bu alanı doldurunuz": "Please fill in this field",
  "Bu alan zorunludur": "This field is required",
  "Lütfen geçerli bir değer girin": "Please enter a valid value",
  "Bu değer zaten kullanılıyor": "This value is already in use",
  "Başında ve sonunda boşluk olamaz": "Cannot have leading or trailing whitespace",
  "En az 3 karakter olmalıdır": "Must be at least 3 characters",
  "En fazla 255 karakter olabilir": "Can be at most 255 characters",
  "Sadece sayı girin": "Enter only numbers",
  "Sadece harf ve sayı girin": "Enter only letters and numbers",
  "Geçerli bir tarih girin": "Enter a valid date",
  "Geçerli bir saat girin": "Enter a valid time",
  "Seçim yapmalısınız": "You must make a selection"
};

function translateHelpText(text) {
  if (!text) return text;
  return HELP_TEXT_TRANSLATIONS[text] || text;
}

/** Option (enum/list choice) label translation: backend returns Turkish option titles. */
const OPTION_LABEL_TRANSLATIONS = {
  "Balon (bbox işaretle)": "Balloon (mark bbox)",
  "Koşullu (özellik yoksa N/A)": "Conditional (N/A if attribute missing)",
  "Dolu (herhangi bir değer)": "Filled (any value)",
  "Eşittir (== 'X')": "Equals (== 'X')",
  "Listede": "In list",
  "Koşul": "Condition",
  "Parça": "Part",
  "Montaj": "Assembly",
  "Çizgi (çiz)": "Line (draw)",
  "Bölge (alan işaretle)": "Region (mark area)",
  "Nokta (işaretle)": "Point (mark)",
  "Metin (yaz)": "Text (write)",
  "Yok (işaretleme)": "None (no marking)"
};

function translateOptionTitle(opt) {
  // Vuetify passes either the raw primitive item or the resolved object.
  if (opt && typeof opt === "object") {
    const t = opt.title ?? opt.text ?? opt.label ?? opt.value;
    return OPTION_LABEL_TRANSLATIONS[t] || t;
  }
  return OPTION_LABEL_TRANSLATIONS[opt] || opt;
}

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  schema: { type: Object, required: true },
  item: { type: Object, default: null },
  isNew: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  author: { type: String, default: "" }
});

const emit = defineEmits(["close", "apply", "delete"]);

// Hidden fields that are NOT shown to users but their values are preserved
// id: managed by system · category: written by LLM · agent: comes from add context
// batch_question: handled by LLM backend · enabled: toggled from list
// extract_only: every rule is always scored (default false fixed) · aggregation/extract_fields:
//   internal data pipeline fields, meaningless to users → hide but preserve existing values
const HIDDEN = new Set([
  "id", "category", "agent", "batch_question", "enabled",
  "extract_only", "aggregation", "extract_fields"
]);

const form = ref(null);
const kvRows = reactive({});
const crossExpr = reactive({ a: "", op: "==", b: "" });
const crossOps = ["==", "!=", "~"];

const validating = ref(false);
const validated = ref(false);
const valid = ref(false);
const errors = ref([]);

const gInfo = computed(() => (form.value ? groupInfo(form.value.agent, props.schema) : { editable: "full", group: "" }));
const editable = computed(() => gInfo.value.editable);
const readonly = computed(() => editable.value === "readonly");
const groupLabel = computed(() => groupDisplay(gInfo.value.group || (form.value && form.value.agent) || ""));
const accent = computed(() => agentColor(form.value && form.value.agent));
const displayName = computed(() => (form.value && (form.value.name_en || form.value.name)) || t("common.unnamed"));
const headIcon = computed(() => (props.isNew ? "mdi-plus-box" : readonly.value ? "mdi-lock-outline" : "mdi-pencil-box"));
const editLabel = computed(() => {
  const k = `checklist.edit.${editable.value}`;
  return te(k) ? t(k) : editable.value;
});

/* fields applicable to agent (all, including hidden — for collect) */
const applicableFields = computed(() => {
  if (!form.value) return [];
  const fields = (props.schema && props.schema.fields) || [];
  const agent = form.value.agent;
  return fields.filter(f => {
    if (f.key === "enabled") return false;
    if (!f.agents || f.agents.length === 0) return true;
    if (!agent) return false;
    return f.agents.includes(agent);
  });
});
/* fields shown in form (excluding hidden) */
const renderFields = computed(() => applicableFields.value.filter(f => !HIDDEN.has(f.key)));

const totalAgents = computed(() => (props.schema.agents || []).length);
function isCommonField(f) {
  return !f.agents || f.agents.length === 0 || (totalAgents.value && f.agents.length >= totalAgents.value);
}
const commonFields = computed(() => renderFields.value.filter(isCommonField));
const specificFields = computed(() => renderFields.value.filter(f => !isCommonField(f)));

const layout = computed(() => {
  const out = [];
  if (commonFields.value.length) {
    out.push({ __section: true, label: t("editor.sectionGeneral"), icon: "mdi-card-text-outline" });
    out.push(...commonFields.value);
  }
  if (specificFields.value.length) {
    out.push({ __section: true, label: t("editor.sectionSpecifics", { group: groupLabel.value }), icon: "mdi-tune", accent: true });
    out.push(...specificFields.value);
  }
  return out;
});

/* scope: 2D agents don't have PLM_ONLY; others have only PLM_ONLY */
const is2D = computed(() => {
  if (!form.value) return false;
  if (gInfo.value.group === "2D Görsel") return true;
  return ["vision", "extractor"].includes(form.value.agent);
});
const scopeOptions = computed(() => {
  const all = props.schema.scopes || [];
  return is2D.value ? all.filter(s => s !== "PLM_ONLY") : all.filter(s => s === "PLM_ONLY");
});

/* drawing_types multi-select — empty = all types (part + assembly) */
const drawOptions = computed(() => [
  { value: "part", label: t("checklist.part"), icon: "mdi-cube-outline" },
  { value: "assembly", label: t("checklist.assembly"), icon: "mdi-puzzle-outline" }
]);
const DRAW_ALL = ["part", "assembly"];
/* backend uses "single_part" as a synonym for "part" — collapse to "part" and dedupe */
function canonDrawTypes(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const v of arr) {
    const c = v === "single_part" ? "part" : v;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}
/* user can choose freely — selection is shown literally (both can be selected) */
function hasDraw(v) {
  return Array.isArray(form.value.drawing_types) && form.value.drawing_types.includes(v);
}
function toggleDraw(v) {
  if (readonly.value) return;
  const arr = Array.isArray(form.value.drawing_types) ? [...form.value.drawing_types] : [];
  const i = arr.indexOf(v);
  if (i === -1) arr.push(v);
  else {
    if (arr.length <= 1) return; // at least one type must remain selected (cannot select none)
    arr.splice(i, 1);
  }
  form.value.drawing_types = arr;
}
/* "all" = empty OR both selected (for description text only) */
const drawAppliesAll = computed(() => {
  const arr = form.value && form.value.drawing_types;
  if (!Array.isArray(arr) || arr.length === 0) return true;
  return DRAW_ALL.every(t => arr.includes(t));
});
/* backend compatibility: if both selected, send empty (empty = all types) */
function normalizeDrawingTypes(arr) {
  const canon = canonDrawTypes(arr);
  if (DRAW_ALL.every(t => canon.includes(t))) return [];
  return canon;
}

function isRegistrySelect(field) {
  return field.key === "plm_query" && form.value.agent === "plm" && Array.isArray(plmAttributes(props.schema));
}
function registryItemsFor(field) {
  return field.key === "plm_query" ? plmAttributes(props.schema) || [] : [];
}
function isCrossBuilder(field) {
  return field.key === "cross_query" && form.value.agent === "cross" && Array.isArray(crossFields(props.schema));
}
const crossFieldItems = computed(() => crossFields(props.schema) || []);

/* data-bound field but registry missing → show warning instead of free text */
function isDataBoundMissing(field) {
  if (!form.value) return false;
  if (field.key === "plm_query" && form.value.agent === "plm") return !Array.isArray(plmAttributes(props.schema));
  if (field.key === "cross_query" && form.value.agent === "cross") return !Array.isArray(crossFields(props.schema));
  return false;
}

/* plm pass_condition mini condition builder: filled / == 'X' / in [...] */
const passModes = computed(() => [
  { title: t("editor.pass.filled"), value: "filled" },
  { title: t("editor.pass.eq"), value: "eq" },
  { title: t("editor.pass.in"), value: "in" }
]);
const passCond = reactive({ mode: "filled", value: "", list: [] });
function isPassCondition(field) {
  return field.key === "pass_condition" && form.value && form.value.agent === "plm";
}
function parsePass(v) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return { mode: "filled", value: "", list: [] };
  let m = s.match(/^==\s*'?([^']*)'?$/);
  if (m) return { mode: "eq", value: m[1].trim(), list: [] };
  m = s.match(/^in\s*\[(.*)\]$/i);
  if (m) {
    const list = m[1].split(",").map(x => x.trim().replace(/^'|'$/g, "")).filter(Boolean);
    return { mode: "in", value: "", list };
  }
  return { mode: "filled", value: "", list: [] };
}
function syncPass() {
  if (!form.value) return;
  if (passCond.mode === "eq") {
    form.value.pass_condition = passCond.value ? `== '${passCond.value}'` : "";
  } else if (passCond.mode === "in") {
    const arr = (passCond.list || []).filter(Boolean);
    form.value.pass_condition = arr.length ? `in [${arr.join(", ")}]` : "";
  } else {
    form.value.pass_condition = ""; // filled = any value
  }
}

function optionsFor(field) {
  if (Array.isArray(field.options) && field.options.length) return field.options;
  const map = { severity: props.schema.severities };
  return map[field.key] || [];
}
function labelFor(field) {
  return translateFieldLabel(field.label) + (field.required ? " *" : "");
}
function colsFor(field) {
  return field.type === "text" || field.type === "object" || field.type === "list" || field.key === "drawing_types" || isCrossBuilder(field) ? 12 : 6;
}

function cloneSafe(o) {
  try {
    return structuredClone(toRaw(o));
  } catch {
    return JSON.parse(JSON.stringify(o));
  }
}

function parseCross(v) {
  if (typeof v === "string" && v.trim()) {
    for (const op of crossOps) {
      const i = v.indexOf(op);
      if (i !== -1) return { a: v.slice(0, i).trim(), op, b: v.slice(i + op.length).trim() };
    }
  }
  return { a: "", op: "==", b: "" };
}
function syncCross() {
  if (!form.value) return;
  const { a, op, b } = crossExpr;
  form.value.cross_query = a && b ? `${a} ${op} ${b}` : "";
}

function addKv(key) {
  if (!kvRows[key]) kvRows[key] = [];
  kvRows[key].push({ k: "", v: "" });
  syncObject(key);
}
function removeKv(key, idx) {
  kvRows[key].splice(idx, 1);
  syncObject(key);
}
function syncObject(key) {
  const obj = {};
  (kvRows[key] || []).forEach(row => {
    if (row.k) obj[row.k] = row.v;
  });
  form.value[key] = obj;
}
function rebuildKvRows() {
  Object.keys(kvRows).forEach(k => delete kvRows[k]);
  if (!form.value) return;
  (props.schema.fields || []).forEach(f => {
    if (f.type === "object") {
      const obj = form.value[f.key] && typeof form.value[f.key] === "object" ? form.value[f.key] : {};
      kvRows[f.key] = Object.entries(obj).map(([k, v]) => ({ k, v }));
    }
  });
}

/* collect all applicable fields (including hidden — id/category preserved) */
function collect() {
  const out = {};
  out.enabled = !!form.value.enabled;
  applicableFields.value.forEach(f => {
    out[f.key] = cloneSafe(form.value[f.key]);
  });
  // if both selected, send empty to backend (empty = all types)
  if ("drawing_types" in out) out.drawing_types = normalizeDrawingTypes(out.drawing_types);
  return out;
}
function prospectiveItems() {
  const candidate = collect();
  return props.isNew ? [...props.items, candidate] : props.items.map(i => (i === props.item ? candidate : i));
}

/* Manual validation — called only from "Validate" button (no auto/timed) */
async function runValidate() {
  validating.value = true;
  try {
    const res = await MetaCheckerApi.validate({ items: prospectiveItems(), author: props.author, note: "" });
    valid.value = !!res.valid;
    errors.value = Array.isArray(res.errors) ? res.errors : [];
  } catch (e) {
    errors.value = e && e.errors && e.errors.length ? e.errors : [e.message || t("editor.err.validate")];
    valid.value = false;
  } finally {
    validating.value = false;
    validated.value = true;
  }
}

const relevantErrors = computed(() => {
  const id = (form.value && form.value.id ? form.value.id : "").toString().trim();
  if (!id) return errors.value;
  const tagged = errors.value.filter(e => e && e.includes(`'${id}'`));
  return tagged.length ? tagged : errors.value;
});

function apply() {
  emit("apply", collect());
}

function buildForm() {
  form.value = props.item ? cloneSafe(props.item) : {};
  if (form.value.enabled === undefined) form.value.enabled = false;
  // empty drawing_types (= all types) shown as both selected in UI; cannot select none
  if (!Array.isArray(form.value.drawing_types) || form.value.drawing_types.length === 0) {
    form.value.drawing_types = [...DRAW_ALL];
  } else {
    // "single_part" is the same as "part" — collapse so it maps onto the Part toggle
    form.value.drawing_types = canonDrawTypes(form.value.drawing_types);
  }
  rebuildKvRows();
  Object.assign(crossExpr, parseCross(form.value.cross_query));
  Object.assign(passCond, parsePass(form.value.pass_condition));
  validated.value = false;
  valid.value = false;
  errors.value = [];
}

watch(
  () => props.modelValue,
  open => {
    if (open) buildForm();
  },
  { immediate: true }
);
// form change invalidates prior validation → Apply locked again, user must re-validate
watch(
  form,
  () => {
    if (validated.value || valid.value || errors.value.length) {
      validated.value = false;
      valid.value = false;
      errors.value = [];
    }
  },
  { deep: true }
);
</script>

<style scoped>
.mc-edit { overflow: hidden; }

.mc-edit__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  color: #fff;
  background:
    radial-gradient(120% 160% at 0% 0%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 50%),
    linear-gradient(120deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.38) 100%),
    var(--accent, #015686);
}
.mc-edit__icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.25);
}
.mc-edit__titles { min-width: 0; }
.mc-edit__title { font-size: 1.08rem; font-weight: 700; line-height: 1.1; }
.mc-edit__sub {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.82);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}
.mc-edit__sub .mono { font-family: "Courier New", monospace; font-weight: 700; }
.mc-edit__sub .dot { margin: 0 6px; opacity: 0.6; }
.mc-edit__chips { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.ec {
  font-size: 0.64rem;
  font-weight: 700;
  text-transform: capitalize;
  padding: 3px 8px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
  white-space: nowrap;
}
.ec--group { background: rgba(255, 255, 255, 0.1); text-transform: none; }
.ec--data_bound { background: rgba(255, 255, 255, 0.22); }

.mc-edit__body { padding-top: 16px !important; }
.compact-rows :deep(.v-input) { margin-bottom: 2px; }

.sec-col { padding-top: 6px; padding-bottom: 0; }
.sec-head {
  display: flex;
  align-items: center;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #607d8b;
  margin: 4px 0 0;
}
.sec-bar { width: 3px; height: 13px; border-radius: 2px; margin-right: 8px; }

.boxed {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 10px 12px;
  background: #fafbfc;
}
.boxed__label { font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 6px; }
.boxed--warn { border-color: rgba(245, 124, 0, 0.4); background: rgba(255, 167, 38, 0.08); }
.db-warn { display: flex; align-items: center; font-size: 0.8rem; color: #b26a00; }
.bool-box {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 3px 12px;
  background: #fafbfc;
  transition: all 0.15s;
}
.bool-box.on { border-color: rgba(1, 86, 134, 0.4); background: rgba(31, 147, 206, 0.06); }

/* drawing types chips */
.dt-wrap { display: flex; gap: 8px; flex-wrap: wrap; }
.dt-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #546e7a;
  background: #fff;
  border: 1.5px solid #cfd8dc;
  cursor: pointer;
  transition: all 0.12s;
}
.dt-chip:hover:not(:disabled) { border-color: #90a4ae; }
.dt-chip.sel {
  color: #015686;
  background: rgba(31, 147, 206, 0.12);
  border-color: #1F93CE;
}
.dt-chip:disabled { opacity: 0.5; cursor: not-allowed; }

code { background: #eef3f6; padding: 1px 5px; border-radius: 4px; }
.mc-edit__foot { padding: 10px 16px; }
</style>
