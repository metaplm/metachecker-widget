const cfg = {
    urls: {
        // GitHub Pages yayın adresi (build çıktısının nihai konumu)
        local: "https://metaplm.github.io/metachecker-widget/",

        // Dışarıdan erişilen public adres
        public: "https://metaplm.github.io/metachecker-widget/"
    },
    backend: {
        // PLM arama — metachecker API'nin 3DX Cloud proxy'si
        executeQueryService: "https://metachecker.meta-plm.com/plm/search"
    },
    // Hermes ajan sohbeti (OpenAI-uyumlu).
    // apiKey build sırasında CI'da (GitHub Actions secret: HERMES_API_KEY) enjekte edilir;
    // placeholder kalırsa HermesApi anahtar göndermez (chat auth'suz çalışmaz).
    hermes: {
        baseUrl: "https://metachecker.meta-plm.com/hermes",
        model: "MetaChecker Hermes",
        apiKey: "PUT_API_SERVER_KEY_HERE"
    },
    dev: {
        devServer: {
            server: {
                type: "https",
                options: {
                    key: "/home/mirac/work/certificates/serverkey.key",
                    cert: "/home/mirac/work/certificates/servercert.crt"
                }
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
