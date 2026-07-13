const path = require("path");
const webpack = require("webpack");
const VueLoaderPlugin = require("vue-loader/dist/plugin.js").default;
// VuetifyLoaderPlugin removed for Vue3 compatibility
const CopyPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
// const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

// Hermes ajan sohbeti config'i (widget-config.js → hermes); yoksa boş obje.
let hermesConfig = {};
try {
    hermesConfig = require("../widget-config.js").hermes || {};
} catch (e) {
    hermesConfig = {};
}

module.exports = {
    entry: ["babel-polyfill", "./src/lib/widget-starter.js"],
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "../dist")
    },
    resolve: {
        alias: { }
    },
    module: {
        rules: [
            {
                // webpack 5 native asset modülü — file-loader ile çakışıp font'u
                // 90 baytlık JS stub olarak yaymaması için file-loader KULLANILMIYOR
                test: /\.(svg|eot|woff|ttf|woff2)$/,
                type: "asset/resource",
                generator: {
                    filename: "static/fonts/[name][ext]"
                }
            },
            {
                test: /\.vue$/,
                loader: "vue-loader"
            },
            {
                test: /\.js$/,
                loader: "babel-loader",
                exclude: [/node_modules/, /src\/static/],
                options: {
                    presets: ["@babel/env"]
                }
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.s(c|a)ss$/,
                use: [
                    "vue-style-loader",
                    "css-loader",
                    {
                        loader: "sass-loader",
                        options: {
                            implementation: require("sass"),
                            sassOptions: {
                                indentedSyntax: true // optional
                            }
                        }
                    }
                ]
            },
            {
                test: /\.md$/i,
                use: "raw-loader"
            }
        ]
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyPlugin([
            { from: "./src/index.html", to: "./index.html" },
            { from: "./src/static", to: "static", ignore: ["*.md"] },
            { from: "./src/assets", to: "assets" }
        ]),
        new VueLoaderPlugin(),
        new webpack.DefinePlugin({
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
            __HERMES_CONFIG__: JSON.stringify(hermesConfig)
        })
        // new BundleAnalyzerPlugin({
        //     analyzerMode: "server",
        //     generateStatsFile: true,
        //     statsOptions: { source: false }
        //   })
    ]
};
