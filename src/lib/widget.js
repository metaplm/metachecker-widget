/**
 * Mock the Widget Object normally provided by 3DDashboard
 */
const Widget = function() {
    const events = {};
    let title = "";

    const prefs = (() => {
        let prefsLocal = localStorage.getItem("_prefs_4_Widget_");
        if (prefsLocal) {
            try {
                prefsLocal = JSON.parse(prefsLocal);
            } catch {
                prefsLocal = {};
                localStorage.setItem("_prefs_4_Widget_", JSON.stringify(prefsLocal));
            }
        } else {
            prefsLocal = {};
            localStorage.setItem("_prefs_4_Widget_", JSON.stringify(prefsLocal));
        }
        return prefsLocal;
    })();

    const _savePrefsLocalStorage = () => {
        localStorage.setItem("_prefs_4_Widget_", JSON.stringify(prefs));
    };

    this.uwaUrl = "./";

    this.addEvent = (event, callback) => {
        events[event] = callback;
        if (event === "onLoad") {
            if (document.readyState === "loading") {
                window.addEventListener("DOMContentLoaded", callback);
            } else {
                callback();
            }
        }
    };

    this.addPreference = pref => {
        // console.log(`Preference added ${pref}`);
        pref.value = pref.defaultValue;
        prefs[pref.name] = pref;
        _savePrefsLocalStorage();
    };

    this.getPreference = prefName => {
        return prefs[prefName];
    };

    this.getValue = prefName => {
        return prefs[prefName] === undefined ? undefined : prefs[prefName].value;
    };

    this.setValue = (prefName, value) => {
        prefs[prefName].value = value;
        _savePrefsLocalStorage();
    };

    this.setTitle = t => {
        title = t;
        document.title = title;
    };
    this.dispatchEvent = (...args) => {
        // console.debug(`Event received ${args}`);
    };
};

/**
 * Mock the UWA Object normally provided by 3DDashboard
 */
const UWA = function() {
    this.log = args => {
        /* eslint no-console:off */
        console.log(args);
    };
};

/** Standalone (uygulama) modunda kullanıcı adının saklandığı localStorage anahtarı. */
const STANDALONE_USER_KEY = "metacheck_standalone_user";

/**
 * Uygulama (standalone) modunda mıyız? 3DDashboard içindeyken platform `UWA`/`widget`
 * nesnelerini kendisi enjekte eder; dışarıda bunları biz mock'larız.
 * initWidget() bunu set eder; UI/istemciler `isStandalone()` ile davranış ayarlayabilir.
 */
let _standalone = false;
export function isStandalone() {
    return _standalone;
}

/**
 * Mock the libraries provided by 3DDashboard
 */
const initRequireModules = function() {
    // Standalone modda 3DDashboard'un platform proxy'si YOK → WAFData'nın istek
    // fonksiyonlarını düz fetch'e çeviriyoruz (backend CORS'u açık: Allow-Origin *).
    // Hata sözleşmesi API istemcileriyle uyumlu tutulur:
    //   onFailure(error, {status, responseText}) / onTimeout(error)
    //   type "json" → parse edilmiş gövde, "text" → ham string.
    // NOT: bu define YALNIZCA standalone dalında çalışır (initWidget). 3DDashboard
    // içinde platformun gerçek WAFData'sı kullanılır — widget modu etkilenmez.
    const fetchAsWAFData = (url, options) => {
        const o = options || {};
        const type = o.type || "json";
        // Timeout: platform WAFData'sı onTimeout çağırır; fetch'te AbortController ile taklit.
        const ms = typeof o.timeout === "number" ? o.timeout : 120000;
        const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;

        fetch(url, {
            method: o.method || "GET",
            headers: o.headers || {},
            body: o.data,
            // Allow-Origin "*" ile cookie gönderilemez; standalone'da 3DX oturumu da yok.
            credentials: "omit",
            signal: ctrl ? ctrl.signal : undefined
        })
            .then(async res => {
                if (timer) clearTimeout(timer);
                const text = await res.text();
                if (!res.ok) {
                    if (o.onFailure) o.onFailure(res.statusText, { status: res.status, responseText: text });
                    return;
                }
                let body = text;
                if (type === "json") {
                    try {
                        body = text ? JSON.parse(text) : null;
                    } catch {
                        body = text;
                    }
                }
                if (o.onComplete) o.onComplete(body);
            })
            .catch(err => {
                if (timer) clearTimeout(timer);
                if (err && err.name === "AbortError") {
                    if (o.onTimeout) o.onTimeout(new Error(`Zaman aşımı (${ms}ms)`));
                    else if (o.onFailure) o.onFailure("timeout", { status: 0 });
                    return;
                }
                if (o.onFailure) o.onFailure((err && err.message) || "network error", { status: 0 });
            });
    };

    define("DS/WAFData/WAFData", [], () => ({
        // MetaChecker/Hermes/Lang istemcilerinin kullandığı yol.
        proxifiedRequest: fetchAsWAFData,
        // Platform3DSpace gibi 3DX servislerine giden yol. Standalone'da 3DX oturumu
        // OLMADIĞI için bu çağrılar kimlik doğrulamasız gider (3DX tarafı 302/401 döner) —
        // ama tanımsız fonksiyon hatasıyla ÇÖKMEZ, düzgün onFailure ile döner.
        authenticatedRequest: fetchAsWAFData
    }));
    define("DS/TagNavigatorProxy/TagNavigatorProxy", [], () => {
        const TagNavigatorProxy = function() {
            this.createProxy = () => {
                return {
                    addEvent: (name, event) => {},
                    setSubjectsTags: subject => {}
                };
            };
        };
        return new TagNavigatorProxy();
    });
    define("DS/PlatformAPI/PlatformAPI", [], () => {
        const PlatformAPI = function() {
            // Standalone'da 3DX oturumu yok → gerçek kullanıcı bilinemez.
            // ESKİDEN buraya Dassault örnek kullanıcısı ("RG0 / Rodrigo Sanchez") dönüyordu;
            // bu login checklist sürümlerinde `author` olarak KAYDEDİLİYOR → sahte atıf.
            // Artık localStorage'daki ada düşer, yoksa dürüstçe "standalone" der.
            // Kullanıcı adını ayarlamak için konsoldan: metacheckSetUser("ad.soyad")
            this.getUser = () => {
                let login = "";
                try {
                    login = (localStorage.getItem(STANDALONE_USER_KEY) || "").trim();
                } catch {
                    login = "";
                }
                return {
                    login: login || "standalone",
                    email: "",
                    firstname: "",
                    lastName: "",
                    language: "en",
                    enabled: true,
                    superUser: false,
                    properties: {}
                };
            };
            this.subscribe = (topic, callback) => {
                return { topic: topic, callback: callback };
            };
        };
        return new PlatformAPI();
    });
};

/**
 * Initialize the widget object
 * In Standalone mode :
 *      - Create the widget object with some (to be completed) API
 *      - Create the UWA object with some (to be completed) API
 *      - Load the requirejs library
 *      - Mock some 3DDashboard API (to be completed)
 * In case of 3DDashboard :
 *      - wait for the widget object to be inserted by the 3DDashboard
 */
export function initWidget(cbOk, cbError) {
    const waitFor = function(whatToWait, maxTry, then) {
        if (typeof window[whatToWait] !== "undefined") {
            then();
        // If maxTry is -1 then wait indefinetly
        } else if (maxTry !== -1 && maxTry === 0) {
            document.body.innerHTML = "Error while trying to load widget. See console for details";
            throw new Error(whatToWait + " didn't load");
        } else {
            setTimeout(waitFor, 200, whatToWait, --maxTry, then);
        }
    };
    const loadRequire = () => {
        return new Promise((resolve, reject) => {
            const oReq = new XMLHttpRequest();
            oReq.addEventListener("load", resp => {
                const script = document.createElement("script"); // Make a script DOM node
                script.innerHTML = resp.target.response; // Set it's src to the provided URL
                document.head.appendChild(script);
                resolve();
            });
            try {
                oReq.open("GET", "static/lib/require.js");
                oReq.send();
            } catch (err) {
                reject(err);
            }
        });
    };
    const updatePublicPath = () => {
        __webpack_public_path__ = widget.uwaUrl.substring(0, widget.uwaUrl.lastIndexOf("/") + 1);
    };

    if (window.widget) {
        updatePublicPath();
        cbOk(widget);
    } else if (!window.UWA) {
        // 3DDashboard DIŞINDA → uygulama (standalone) modu.
        // Platform proxy'si yerine fetch tabanlı WAFData shim'i devreye girer.
        _standalone = true;
        window.widget = new Widget();
        window.UWA = new UWA();
        // Standalone'da `author` için kullanıcı adı ayarlama kolaylığı (konsoldan).
        window.metacheckSetUser = name => {
            const v = String(name || "").trim();
            if (v) localStorage.setItem(STANDALONE_USER_KEY, v);
            else localStorage.removeItem(STANDALONE_USER_KEY);
            return v || "standalone";
        };
        // requirejs YÜKLENDİKTEN ve modüller TANIMLANDIKTAN sonra devam et; aksi halde
        // uygulama DS/WAFData'yı dosya olarak indirmeye çalışır (404) — yarış durumu.
        loadRequire()
            .then(() => {
                initRequireModules();
                cbOk(window.widget);
            })
            .catch(err => {
                console.error(err);
                if (cbError) cbError(err);
            });
    } else {
        // in 3DDashboard
        try {
            // 3DDashboard often takes a very long time to inject the
            // UWA widget element.  Need to wait until it is loaded in order
            // to load our VUE instance
            waitFor(
                "widget",
                -1,
                // finally, ...starts
                () => {
                    updatePublicPath();
                    cbOk(widget);
                }
            );
        } catch (error) {
            console.error(error);
            cbError(error);
        }
    }
}

/**
 * Toolbox for 3DDashboard
 */
function Utils() {
    // List of path of the css files to deactivate with the following function
    const widgetDefaultStyleSheets = ["UWA/assets/css/iframe.css"];
    this.disableCSS = bDeactivate => {
        // Activate or deactivate widgets default css
        // To re-activate the Default CSS files pass a false boolean, if no parameters are passed it's considered as true
        let disableOptions = true;
        if (typeof bDeactivate === "boolean" && bDeactivate === false) {
            disableOptions = false;
        }
        const styleSheets = document.styleSheets;
        for (let i = 0; i < styleSheets.length; i++) {
            const sheet = styleSheets.item(i);
            for (const partialUrlToTest of widgetDefaultStyleSheets) {
                if (sheet.href && sheet.href.indexOf(partialUrlToTest) !== -1) {
                    sheet.disabled = disableOptions;
                }
            }
        }
    };
}

export const x3DDashboardUtils = new Utils();
