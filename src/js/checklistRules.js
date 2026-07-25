/**
 * Client-tarafı yardımcı kurallar.
 *
 * NOT: Asıl validasyon backend'dedir. Buradaki kontrol yalnızca UX içindir:
 * bir madde `enabled:true` yapılmadan önce ajan-zorunlu alan eksikse kullanıcıyı
 * uyarmak ve kaydederken anlamsız bir 422 yemesini engellemek için.
 *
 * Kaynak: `/schema.agent_required`. Esnek şema desteklenir:
 *   - "plm": ["plm_query"]                    -> hepsi zorunlu
 *   - "iso": [["vision_prompt","catia_query"]] -> iç dizi = "biri yeterli"
 *   - "iso": ["vision_prompt|catia_query"]     -> '|' ile "biri yeterli"
 */

function isEmpty(v) {
    if (v === undefined || v === null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "object") return Object.keys(v).length === 0;
    return false;
}

/**
 * Bir maddenin ajan-zorunlu alanlarından eksik olanları döndürür.
 * @returns {string[]} eksik kuralların okunur açıklamaları (boşsa eksik yok)
 */
export function missingAgentRequired(item, schema) {
    const required = (schema && schema.agent_required) || {};
    const rules = required[item.agent];
    if (!rules) return [];

    const missing = [];
    rules.forEach(rule => {
        // "biri yeterli" grubu: dizi veya '|' içeren string
        let group = null;
        if (Array.isArray(rule)) group = rule;
        else if (typeof rule === "string" && rule.includes("|")) group = rule.split("|").map(s => s.trim());

        if (group) {
            const anyFilled = group.some(key => !isEmpty(item[key]));
            if (!anyFilled) missing.push(group.join(" veya "));
        } else if (typeof rule === "string") {
            if (isEmpty(item[rule])) missing.push(rule);
        }
    });
    return missing;
}

/* ===========================================================================
 * v2 — Rapor grubu + düzenlenebilirlik katmanı (/schema.agent_groups, registry)
 * agent_groups/registry yoksa GÜVENLİ DÜŞ: her ajan kendi grubu, editable "full".
 * =========================================================================== */

export const GROUP_ORDER = ["2D Görsel", "3D Görsel", "PLM Veri", "Otorite"];

/** Backend rapor-grubu modeli mevcut mu? */
export function hasGroupModel(schema) {
    return !!(schema && schema.agent_groups && Object.keys(schema.agent_groups).length);
}

/** Bir ajanın grup bilgisi: {group, role, editable} */
export function groupInfo(agent, schema) {
    const ag = schema && schema.agent_groups;
    if (ag && ag[agent]) return ag[agent];
    return { group: agent || "—", role: "main", editable: "full" };
}

/** Bir rapor grubundaki ajanlar */
export function agentsOfGroup(group, schema) {
    const ag = (schema && schema.agent_groups) || {};
    return Object.keys(ag).filter(a => ag[a].group === group);
}

/** Bir grubun "main" ajanı (yeni kayıt/ekleme yönlendirmesi için) */
export function mainAgentOfGroup(group, schema) {
    const ag = (schema && schema.agent_groups) || {};
    const agents = agentsOfGroup(group, schema);
    const main = agents.find(a => ag[a].role === "main");
    return main || agents[0] || null;
}

/** Bir grubun düzenlenebilirliği (main ajanından) */
export function groupEditable(group, schema) {
    const main = mainAgentOfGroup(group, schema);
    return main ? groupInfo(main, schema).editable : "full";
}

/** registry yardımcıları (yoksa null) */
export function plmAttributes(schema) {
    return (schema && schema.registry && schema.registry.plm_attributes) || null;
}
export function crossFields(schema) {
    return (schema && schema.registry && schema.registry.cross_fields) || null;
}

/** Kural adı, locale'e duyarlı: TR arayüzde Türkçe ad öncelikli, EN'de İngilizce.
 *  (Sabit `name_en || name` TR arayüzde kural adlarını İngilizce gösteriyordu.) */
export function ruleName(item, locale) {
    if (!item) return "";
    return (locale === "tr" ? item.name || item.name_en : item.name_en || item.name) || "";
}

/** ajan → marka rengi (chip / accent için) */
const AGENT_HEX = {
    vision: "#3949AB",
    extractor: "#00897B",
    iso: "#5E35B1",
    catia: "#546E7A",
    plm: "#2E7D32",
    cross: "#EF6C00"
};
export function agentColor(agent) {
    return AGENT_HEX[agent] || "#607D8B";
}

/** severity → tema rengi (severity noktası / chip için) — enum: major/minor/info (§5) */
export function severityColor(sev) {
    return (
        {
            major: "severity-major",
            minor: "severity-minor",
            info: "severity-info"
        }[sev] || "severity-info"
    );
}
