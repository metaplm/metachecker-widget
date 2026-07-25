const { merge } = require("webpack-merge");
const common = require("./webpack.config.common.js");
const webpack = require("webpack");

module.exports = merge(common, {
    mode: "production",
    plugins: [
        new webpack.DefinePlugin({
            // Prod bundle herkese açık yayınlanıyor (GitHub Pages) → 3DDashboard DIŞINDA
            // (standalone) çalışma KAPALI. Sayfayı bulan biri widget'ı uygulama gibi açamaz.
            // Lokal standalone testi için dev server kullan (npm start → true).
            __STANDALONE_ALLOWED__: JSON.stringify(false)
        })
    ],
    performance: {
        maxAssetSize: 1000000
    },
    module: {
        rules: [
            {
                enforce: "pre",
                test: /\.(js|vue)$/,
                exclude: [/node_modules/, /src\/static/],
                loader: "eslint-loader"
            }
        ]
    }
});
