// const fs = require("fs");

const cfg = {
    urls: {
        // URL to serve from webpack (local)
        local: "http://localhost:8081/widget/"

        // URL to access this server (public), default is same as local
        //   you can define different public URL if you serve behind reverse proxy
        //      but public path and local path must be the same (webpack limitation)
        // public: "https://public.host:443/widget/"
    },
    dev: {
        // in this section you can override webpack dev options (base configuration from webpack.config.dev.js)
        // please refer to https://webpack.js.org/configuration/ for global webpack configuration
        // please refer to https://webpack.js.org/configuration/dev-server/ for devServer

        devServer: {
            // TODO uncomment these lines if you want to serve https
            // https: {
            //     key: fs.readFileSync("path/to/mkcert/files/localhost+3-key.pem"),
            //     cert: fs.readFileSync("path/to/mkcert/files/localhost+3.pem")
            // }
        }
    },
    // Hermes agent chat (OpenAI-compatible). apiKey is embedded into the bundle at build time.
    hermes: {
        baseUrl: "https://metachecker.metaplm.com/hermes",
        model: "MetaChecker Hermes",
        apiKey: "PUT_API_SERVER_KEY_HERE"
    }
};

module.exports = cfg;
