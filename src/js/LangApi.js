/**
 * Dil tercihi istemcisi — KÖK uç: GET https://metachecker.metaplm.com/lang
 *
 * MetaChecker checklist API'si /api/checklist altında, Hermes /hermes altında;
 * /lang ise KÖKTE. Bu yüzden o iki istemcinin BASE'ini baypas eden ayrı, küçük
 * bir fetcher. Transport: HermesApi/MetaCheckerApi ile aynı kalıp —
 * 3DDashboard WAFData.proxifiedRequest (iframe CSP/mixed-content aşar), yoksa fetch.
 *
 * Dönüş: { lang: "en"|"tr", available: ["en","tr"] }. Best-effort: çağıran taraf
 * hatayı yutup "en"e düşmeli; bu uç widget açılışını ASLA bloklamamalı.
 */

/* eslint-disable no-undef */
const BACKEND = (typeof __BACKEND_CONFIG__ !== "undefined" && __BACKEND_CONFIG__) || {};
/* eslint-enable no-undef */

// API kökü build sırasında gömülür (widget-config.js → backend.apiBase);
// yoksa üretim adresine düşer.
const LANG_URL = (BACKEND.apiBase || "https://metachecker.metaplm.com").replace(/\/+$/, "") + "/lang";

/** 3DDashboard WAFData modülü (varsa). */
function getWAFData() {
    return new Promise((resolve, reject) => {
        try {
            requirejs(["DS/WAFData/WAFData"], WAFData => resolve(WAFData), err => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Kullanıcının dil tercihini çeker.
 * @returns {Promise<{lang?:string, available?:string[]}>} başarısızsa throw eder.
 */
export async function getLang() {
    // 1) WAFData proxy (3DX içi tercih edilen yol)
    try {
        const WAFData = await getWAFData();
        return await new Promise((resolve, reject) => {
            WAFData.proxifiedRequest(encodeURI(LANG_URL), {
                method: "GET",
                type: "json",
                onComplete: body => resolve(body == null ? {} : body),
                onFailure: (error, backend) => reject(error || backend || new Error("lang failed")),
                onTimeout: () => reject(new Error("lang timeout"))
            });
        });
    } catch (proxyErr) {
        // WAFData yoksa (lokal/standalone) fetch'e düş.
    }

    // 2) fetch fallback
    const res = await fetch(LANG_URL, { method: "GET" });
    if (!res.ok) throw new Error("lang " + res.status);
    return res.json();
}
