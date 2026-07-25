/**
 * Hermes ajan sohbeti — asenkron runs + polling HTTP istemcisi.
 *
 * Hermes, MetaChecker checklist'inden AYRI bir özelliktir; aynı domain, farklı uç (`/hermes/`).
 * Telegram'daki ajanla aynı beyin.
 *
 * NEDEN runs+polling (chat/completions değil): 3DDashboard'ın 25 sn istek timeout'u var
 * (değiştirilemez). Senkron tek-istek yavaş ajan turunda buna takılır. runs modelinde:
 *   POST /v1/runs → anında run_id (202) → GET /v1/runs/{id} ~2 sn'de bir poll → completed.
 * Hiçbir istek 25 sn'ye yaklaşmaz.
 *
 * Transport: MetaCheckerApi ile aynı sebeple WAFData.proxifiedRequest (3DDashboard iframe
 * CSP/mixed-content/cookie kısıtlarını proxy aşar). WAFData yoksa (lokal/standalone) fetch'e düşer.
 *
 * Auth: İSTEMCİDE ANAHTAR YOK. İstek MetaChecker API'sindeki /api/hermes proxy'sine gider,
 * `Authorization: Bearer <API_SERVER_KEY>` başlığını SUNUCU ekler. Bundle GitHub Pages'ta
 * herkese açık yayınlandığı için gömülü her sır indirilebilir durumdaydı (25 Tem 2026).
 */

/* eslint-disable no-undef */
const CFG = (typeof __HERMES_CONFIG__ !== "undefined" && __HERMES_CONFIG__) || {};
/* eslint-enable no-undef */

const BASE = CFG.baseUrl || "https://metachecker.meta-plm.com/api/hermes";
const MODEL = CFG.model || "MetaChecker Hermes";

/** 3DDashboard WAFData modülü (varsa) */
function getWAFData() {
    return new Promise((resolve, reject) => {
        try {
            requirejs(["DS/WAFData/WAFData"], WAFData => resolve(WAFData), err => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

/** Basit bekleme (poll aralığı). */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function authHeaders(extra) {
    // Authorization YOK — proxy ekliyor (bkz. dosya başı).
    return Object.assign({ "Content-Type": "application/json" }, extra || {});
}

/**
 * HTTP durumunu DİLDEN BAĞIMSIZ bir hata koduna çevir.
 * Çeviri UI katmanında (HermesChat) `t("hermes.err." + code)` ile yapılır.
 * @returns {"auth"|"offline"|"server"|"session"|"http"}
 */
function statusCode(status) {
    if (status === 401 || status === 403) return "auth";
    if (status === 502 || status === 503 || status === 504) return "offline";
    if (status >= 500) return "server";
    if (status === 404) return "session";
    return "http";
}

/** Kod + status taşıyan Error üret (mesaj boş; UI çevirir). */
function codedError(code, status) {
    const err = new Error(code);
    err.code = code;
    if (typeof status === "number") err.status = status;
    return err;
}

/**
 * Tek nokta istek. proxifiedRequest → başarısızsa fetch.
 * @returns {Promise<any>} JSON gövde (type="json") ya da ham metin.
 */
async function request({ method = "GET", path, headers, data, type = "json" }) {
    const url = BASE + path;
    const hdrs = authHeaders(headers);
    const payload = data !== undefined ? JSON.stringify(data) : undefined;

    // 1) WAFData.proxifiedRequest (3DX içi tercih edilen yol)
    try {
        const WAFData = await getWAFData();
        return await new Promise((resolve, reject) => {
            WAFData.proxifiedRequest(encodeURI(url), {
                method,
                headers: hdrs,
                data: payload,
                type,
                onComplete: body => resolve(type === "json" ? (body == null ? {} : body) : body),
                onFailure: (error, backend) => {
                    const status = backend && typeof backend.status === "number" ? backend.status : 0;
                    reject(codedError(status ? statusCode(status) : "generic", status));
                },
                onTimeout: () => reject(codedError("timeout", 0))
            });
        });
    } catch (proxyErr) {
        // WAFData yüklenemedi (lokal/standalone) → fetch fallback. Gerçek HTTP hatası ise yukarı fırlat.
        if (proxyErr && typeof proxyErr.status === "number") throw proxyErr;
    }

    // 2) fetch fallback
    const res = await fetch(url, { method, headers: hdrs, body: payload });
    if (!res.ok) throw codedError(statusCode(res.status), res.status);
    return type === "json" ? res.json() : res.text();
}

const HermesApi = {
    /** Kullanılacak model adı (capabilities/models'tan değil, gömülü default). */
    modelName: MODEL,

    /** Geriye-uyum: anahtar artık sunucuda; istemci tarafında eksik anahtar durumu yok.
     *  (HermesChat bunu "anahtar yok" uyarısı için çağırıyor.) */
    hasKey() {
        return true;
    },

    /** Sağlık: 200 → true. Hata → false (atmaz). */
    async health() {
        try {
            await request({ method: "GET", path: "/health" });
            return true;
        } catch {
            return false;
        }
    },

    /** Desteklenen yetenekler (UI için, opsiyonel). */
    capabilities() {
        return request({ method: "GET", path: "/v1/capabilities" });
    },

    /** Model listesi (opsiyonel). */
    models() {
        return request({ method: "GET", path: "/v1/models" });
    },

    /**
     * Run başlat. Anında döner (202): { run_id, status:"started" }.
     * `input`: tek string ya da OpenAI mesaj dizisi. Geçmişi Hermes tutar → yalnız yeni mesaj yeter.
     */
    async startRun({ sessionId, sessionKey, message, messages, lang }) {
        const headers = {};
        if (sessionId) headers["X-Hermes-Session-Id"] = sessionId;
        if (sessionKey) headers["X-Hermes-Session-Key"] = sessionKey;
        if (lang) headers["X-Hermes-Lang"] = lang; // ajan bu dilde yanıtlasın (backend kullanır)
        const body = { input: messages || message };
        return request({ method: "POST", path: "/v1/runs", headers, data: body });
    },

    /** Run durumu/sonucu (poll). { status, output, usage, ... } */
    getRun(runId) {
        return request({ method: "GET", path: `/v1/runs/${encodeURIComponent(runId)}` });
    },

    /** Run iptal. Hata yutulur (best-effort). */
    stopRun(runId) {
        return request({ method: "POST", path: `/v1/runs/${encodeURIComponent(runId)}/stop` }).catch(() => {});
    },

    /**
     * Asenkron sohbet: run başlat → ~2 sn aralıkla poll → completed olunca output döndür.
     * 25 sn 3DDashboard timeout'una takılmaz (her istek ~ms).
     *
     * @param {object} o
     * @param {string} [o.message] tek mesaj
     * @param {Array}  [o.messages] OpenAI mesaj dizisi (alternatif)
     * @param {string} [o.sessionId] X-Hermes-Session-Id
     * @param {string} [o.sessionKey] X-Hermes-Session-Key
     * @param {(runId:string)=>void} [o.onStart] run_id geldiğinde (iptal için sakla)
     * @param {()=>boolean} [o.isCancelled] true dönerse poll durur, run stop edilir
     * @param {string} [o.lang] "tr"|"en" → X-Hermes-Lang (ajan yanıt dili)
     * @param {number} [o.pollMs=2000] kararlı poll aralığı (ramp sonrası)
     * @param {number} [o.timeoutMs=90000] güvenlik sınırı (~45 poll)
     * @returns {Promise<string>} asistan yanıtı (Markdown). Boş ise "" döner (UI çevirir).
     * Hata: err.code (UI çevirir), err.cancelled, err.status taşır.
     */
    async run({ sessionId, sessionKey, message, messages, onStart, isCancelled, lang, pollMs = 2000, timeoutMs = 90000 }) {
        const started = await this.startRun({ sessionId, sessionKey, message, messages, lang });
        const runId = started && started.run_id;
        if (!runId) throw codedError("notStarted");
        if (onStart) onStart(runId);

        // Adaptif poll: kısa cevaplar anında gelsin diye ilk poll'lar hızlı, sonra 2 sn'ye ramp.
        const SCHEDULE = [500, 800, 1200, 1600];
        const deadline = Date.now() + timeoutMs;
        let attempt = 0;
        for (;;) {
            if (isCancelled && isCancelled()) {
                this.stopRun(runId);
                throw Object.assign(new Error("cancelled"), { cancelled: true });
            }
            await delay(attempt < SCHEDULE.length ? SCHEDULE[attempt] : pollMs);
            attempt++;
            if (isCancelled && isCancelled()) {
                this.stopRun(runId);
                throw Object.assign(new Error("cancelled"), { cancelled: true });
            }

            const r = await this.getRun(runId);
            const status = r && r.status;
            if (status === "completed") {
                return typeof r.output === "string" ? r.output : "";
            }
            if (status === "failed") {
                // Sunucu anlamlı bir mesaj verdiyse onu taşı; yoksa UI "failed" kodunu çevirir.
                const err = codedError("failed");
                if (r && (r.error || r.message)) err.serverMessage = r.error || r.message;
                throw err;
            }
            // started | running → poll devam
            if (Date.now() > deadline) {
                this.stopRun(runId);
                throw codedError("late");
            }
        }
    }
};

export default HermesApi;
