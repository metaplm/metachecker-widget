/**
 * Widget hedef ortam konfigürasyonu — TEK ANAHTAR: `target`.
 *
 *   onprem  → her şey LAN'da: on-prem 3DX platformu (*.metaplm.local, 192.168.1.210),
 *             backend lokal yığın (metachecker.metaplm.local), tarayıcıların güvendiği
 *             kök META PLM Root CA.
 *   oncloud → her şey buluta çıkar: 3DX Cloud tenant'ının kendi dashboard'u (3ds.com),
 *             backend GCE (metachecker.metaplm.com). Proxified istekler DASSAULT
 *             bulutundan çıkar → backend internetten erişilebilir ve public-güvenilen
 *             sertifikalı olmalı (META CA yetmez!).
 *
 * Seçim: WIDGET_TARGET ortam değişkeni > buradaki default.
 * Değerler build sırasında gömülür (__BACKEND_CONFIG__/__HERMES_CONFIG__) →
 * target değişince webpack/dev-server RESTART gerekir.
 */

// Hedef seçimi: WIDGET_TARGET açıkça verilirse o; verilmezse CI'da (GitHub Actions →
// Pages) "oncloud" (public GCE backend + 3DX Cloud dashboard), lokal geliştirmede
// "onprem" (LAN). Böylece deploy.yml'a dokunmadan Pages doğru hedefle build eder.
const target = process.env.WIDGET_TARGET || (process.env.CI ? "oncloud" : "onprem");

const CERT_DIR = "/home/mirac/work/certificates";

const presets = {
    onprem: {
        // Dev-server yayını — dev.metaplm.local bu makinede 127.0.0.1'e çözülür.
        widgetUrl: "https://dev.metaplm.local:8875/metachecker-widget/",
        // Lokal yığın nginx'i (SNI ile *.metaplm.local sertifikalı blok). PORTSUZ (443):
        // 3DDashboard'ın WAFData proxified isteği hedefe portu taşımıyor → :1443 verilirse
        // platform proxy'si 443'e gider ve 25 sn'de timeout olur (yaşandı, 22 Tem).
        // enovia_dev-nginx ile 443 çakışır — aynı anda ikisi açılamaz.
        // İlgili makinelerde (tarayıcı + platform 192.168.1.210) 192.168.1.101'e çözülmeli.
        apiBase: "https://metachecker.metaplm.local",
        // On-prem R2025x dashboard — CORS origin'i ve /DS proxy hedefi buradan türetilir.
        dashboardOrigin: "https://3ddashboard.metaplm.local",
        // META PLM Root CA imzalı wildcard — istemcilerin güvendiği kök bu.
        tls: {
            key: `${CERT_DIR}/wildcard.metaplm.local.key`,
            cert: `${CERT_DIR}/wildcard.metaplm.local.crt`
        }
    },
    oncloud: {
        // Dev yayını .com wildcard'ıyla — DİKKAT: META CA tarayıcılarda güvenilir değil;
        // bulut modda gerçek kullanım için widget prod build'i public sertifikalı bir
        // hosttan (örn. GCE nginx /metachecker-widget/) servis edilmeli.
        widgetUrl: "https://dev.metaplm.com:8875/metachecker-widget/",
        // GCE üretim backend'i. Bulut dashboard'un platform proxy'si Dassault tarafında
        // koştuğu için bu adres internetten erişilebilir + public CA sertifikalı olmalı.
        apiBase: "https://metachecker.meta-plm.com",
        // Tenant'ın bulut dashboard'u (PASSPORT_URL kalıbından türetildi — kayıttan önce
        // gerçek adresi tarayıcıdan doğrula!).
        dashboardOrigin: "https://r1132101868454-eu1-3ddashboard.3dexperience.3ds.com",
        tls: {
            key: `${CERT_DIR}/serverkey.key`,
            cert: `${CERT_DIR}/servercert.crt`
        }
    }
};

if (!presets[target]) {
    throw new Error(`widget-config: bilinmeyen WIDGET_TARGET "${target}" (onprem | oncloud)`);
}
const p = presets[target];

const cfg = {
    // Aktif hedef (log/teşhis için).
    target,

    urls: {
        // Webpack dev-server'ın yayınladığı adres (HTTPS, port 8875)
        local: p.widgetUrl,
        // Dışarıdan erişilen public adres (HMR websocket'i de buradan türetilir)
        public: p.widgetUrl
    },

    backend: {
        // MetaChecker API kökü — /api/checklist ve /lang bu tabana eklenir.
        // Build sırasında __BACKEND_CONFIG__ ile bundle'a gömülür.
        // ⚠ 3DDashboard İÇİNDE istekler platform proxy'sinden çıkar → bu host O
        //   proxy'nin koştuğu yerden çözülebilir/erişilebilir olmalı, yoksa UI'da 504.
        apiBase: p.apiBase,

        // Execute Query Service - Ayarlanabilir backend adresi
        executeQueryService: "https://3dsearch25x.metaplm.com/federated/search?xrequestedwith=xmlhttprequest"
    },

    // Dashboard origin'i — webpack dev CORS başlığı + /DS proxy hedefi bunu kullanır.
    dashboard: {
        origin: p.dashboardOrigin
    },

    // Hermes ajan sohbeti (OpenAI-uyumlu). apiKey build sırasında bundle'a gömülür.
    // GERÇEK anahtar repoya GİRMEZ: CI'da (GitHub Actions secret: HERMES_API_KEY)
    // PUT_API_SERVER_KEY_HERE placeholder'ı ile değiştirilir. Placeholder kalırsa
    // HermesApi anahtar göndermez (chat auth'suz kalır). Taban backend ile aynı hosttan.
    hermes: {
        baseUrl: `${p.apiBase}/hermes`,
        model: "MetaChecker Hermes",
        apiKey: "PUT_API_SERVER_KEY_HERE"
    },

    dev: {
        devServer: {
            server: {
                type: "https",
                options: p.tls
            },
            // Container içindeki tüm arayüzlerde, 8875/HTTPS dinle
            host: "0.0.0.0",
            port: 8875,
            devMiddleware: {
                publicPath: "/metachecker-widget/"
            }
        }
    }
};

module.exports = cfg;
