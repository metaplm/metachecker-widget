/**
 * MetaChecker Checklist API istemcisi
 *
 * 3DDashboard iframe kuralları:
 *  - Düz fetch/XHR yerine 3DDashboard'un WAFData.proxifiedRequest'i kullanılır.
 *    (iframe CSP / mixed-content / cookie kısıtlarını proxy aşar, CORS açık olsa bile
 *     platform-içi tutarlı davranış için tercih edilir.)
 *  - Tüm POST gövdeleri JSON; Content-Type: application/json gönderilir.
 *  - JSON yanıt body olarak resolve edilir; text yanıt (export.yaml) ham string döner.
 *
 * Tüm iş mantığı + validasyon backend'de. Bu istemci sadece taşıyıcıdır;
 * hiçbir alan/kural hardcode etmez (form /schema ile sürülür).
 */

/* eslint-disable no-undef */
const BACKEND = (typeof __BACKEND_CONFIG__ !== "undefined" && __BACKEND_CONFIG__) || {};
/* eslint-enable no-undef */

// API kökü build sırasında gömülür (widget-config.js → backend.apiBase);
// yoksa üretim adresine düşer.
const BASE = (BACKEND.apiBase || "https://metachecker.meta-plm.com").replace(/\/+$/, "") + "/api/checklist";

/**
 * 3DDashboard tarafından sağlanan WAFData modülünü yükler.
 * Standalone (mock) modda require.js base/lib/widget.js içinde kurulur.
 */
function getWAFData() {
    return new Promise((resolve, reject) => {
        try {
            requirejs(
                ["DS/WAFData/WAFData"],
                WAFData => resolve(WAFData),
                err => reject(err)
            );
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Backend'in yapısal hatasını (özellikle 422 {detail:{message,errors[]}})
 * elden geldiğince çözer. errors[] varsa ApiError.errors üzerinden taşınır.
 */
function normalizeError(error, backend) {
    const apiErr = new Error();
    apiErr.errors = [];

    let payload = backend;

    // Olası body taşıyıcılarını sırayla dene
    const candidates = [];
    if (backend) {
        candidates.push(backend.detail);
        candidates.push(backend.responseJSON && backend.responseJSON.detail);
        candidates.push(backend.responseJSON);
        candidates.push(backend.body && backend.body.detail);
        candidates.push(backend.body);
        if (typeof backend.responseText === "string") {
            try {
                const parsed = JSON.parse(backend.responseText);
                candidates.push(parsed.detail);
                candidates.push(parsed);
            } catch {
                /* metin gövdesi JSON değil, yoksay */
            }
        }
    }

    for (const c of candidates) {
        if (c && (Array.isArray(c.errors) || typeof c.message === "string")) {
            payload = c;
            break;
        }
    }

    if (payload && Array.isArray(payload.errors)) {
        apiErr.errors = payload.errors;
    }

    apiErr.message =
        (payload && payload.message) ||
        (backend && backend.errorMessage) ||
        (backend && backend.message) ||
        (typeof error === "string" ? error : "") ||
        (error && error.message) ||
        "İstek başarısız oldu";

    if (backend && typeof backend.status === "number") {
        apiErr.status = backend.status;
    }
    return apiErr;
}

/**
 * Tek nokta istek fonksiyonu.
 * @returns JSON için parse edilmiş gövde; "text" için ham string.
 */
async function request({ method = "GET", path, query, data, type = "json" }) {
    const WAFData = await getWAFData();

    let url = BASE + path;
    if (query && Object.keys(query).length) {
        const qs = Object.entries(query)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&");
        if (qs) url += (url.includes("?") ? "&" : "?") + qs;
    }

    const headers = {};
    let payload;
    if (data !== undefined) {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(data);
    }

    return new Promise((resolve, reject) => {
        try {
            WAFData.proxifiedRequest(encodeURI(url), {
                method,
                headers,
                data: payload,
                type,
                onComplete: body => {
                    if (type === "json") {
                        resolve(body == null ? {} : body);
                    } else {
                        resolve(body);
                    }
                },
                onFailure: (error, backend) => reject(normalizeError(error, backend)),
                onTimeout: error => reject(normalizeError("Zaman aşımı", error))
            });
        } catch (err) {
            reject(normalizeError(err));
        }
    });
}

const MetaCheckerApi = {
    /** Form meta: enumlar + alan tanımları */
    getSchema() {
        return request({ method: "GET", path: "/schema" });
    },

    /** Aktif config: {version, items[]} */
    getActive() {
        return request({ method: "GET", path: "/active" });
    },

    /** Sürüm geçmişi özeti: {versions[]} */
    getVersions() {
        return request({ method: "GET", path: "/versions" });
    },

    /** Bir sürümün maddeleri: {version_id, items[]} */
    getVersion(id) {
        return request({ method: "GET", path: `/versions/${encodeURIComponent(id)}` });
    },

    /** Kaydetmeden doğrula: {valid, errors[]} */
    validate({ items, author, note }) {
        return request({ method: "POST", path: "/validate", data: { items, author, note } });
    },

    /**
     * Yeni sürüm kaydet (tam liste, append-only).
     * Başarı: {version_id, item_count}. Hata (422): ApiError.errors[] dolu gelir.
     */
    save({ items, author, note }) {
        return request({ method: "POST", path: "/", data: { items, author, note } });
    },

    /** Eski sürümü yeni sürüm olarak geri yükle */
    rollback({ id, author }) {
        return request({ method: "POST", path: `/rollback/${encodeURIComponent(id)}`, query: { author } });
    },

    /** YAML dışa aktar (ham metin) */
    exportYaml() {
        return request({ method: "GET", path: "/export.yaml", type: "text" });
    }
};

/**
 * Giriş yapmış widget kullanıcısı (author alanı için).
 * 3DDashboard PlatformAPI.getUser() → login. Bulunamazsa "unknown".
 */
export function getCurrentUser() {
    return new Promise(resolve => {
        try {
            requirejs(
                ["DS/PlatformAPI/PlatformAPI"],
                PlatformAPI => {
                    try {
                        const user = PlatformAPI.getUser();
                        resolve((user && (user.login || user.email)) || "unknown");
                    } catch {
                        resolve("unknown");
                    }
                },
                () => resolve("unknown")
            );
        } catch {
            resolve("unknown");
        }
    });
}

export default MetaCheckerApi;
