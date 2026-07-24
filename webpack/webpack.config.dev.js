const { merge } = require("webpack-merge");
const common = require("./webpack.config.common.js");
const { dev, urls, dashboard } = require("../widget-config.js");
const webpack = require("webpack");

// Dashboard origin'i hedef ortama göre widget-config'ten gelir (onprem/oncloud preset).
const DASHBOARD_ORIGIN = (dashboard && dashboard.origin) || "https://3ddashboard25x.metaplm.com";

// use default public value ?
if (!urls.public) urls.public = urls.local;

let locUrl = new URL(urls.local);
let pubUrl = new URL(urls.public);
let port = locUrl.port;
if (!port) port = locUrl.protocol === "https:" ? 443 : 80;

module.exports = merge(
    common,
    {
        mode: "development",
        // devtool: "inline-source-map",
        devtool: "source-map",
        plugins: [
            new webpack.DefinePlugin({
                __VUE_OPTIONS_API__: true,
                __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
            })
        ],
        devServer: {
            static: "./dist",
            hot: true,
            compress: true,
            allowedHosts: "all",
            webSocketServer: "ws",
            headers: {
                "Access-Control-Allow-Origin": DASHBOARD_ORIGIN,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "X-Requested-With, Content-Type, Authorization",
                "Access-Control-Allow-Credentials": "true"
            },
            port: port,
            host: locUrl.hostname,
            devMiddleware: {
                publicPath: locUrl.pathname,
                writeToDisk: false
            },
            client: {
                webSocketURL: {
                    protocol: pubUrl.protocol === "https:" ? "wss" : "ws",
                    hostname: pubUrl.hostname,
                    port: pubUrl.port || (pubUrl.protocol === "https:" ? 443 : 80),
                    pathname: "/ws"
                },
                overlay: true,
                logging: "info"
            },
            proxy: {
                "/DS": {
                    target: DASHBOARD_ORIGIN,
                    changeOrigin: true,
                    secure: false,
                    logLevel: "debug"
                }
            }
        },
        output: {
            publicPath: locUrl.pathname
        }
        ,
        module: {
            rules: []
        }
    },
    dev
);
