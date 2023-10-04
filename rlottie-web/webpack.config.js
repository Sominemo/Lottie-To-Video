const path = require("path");

const { ProvidePlugin } = require("webpack");

module.exports = (_env, { mode = "production" }) => {
    return [
        {
            mode,
            entry: "./src/RLottie.ts",
            target: "web",

            output: {
                filename: "[name].js",
                chunkFilename: "[id].js",
                assetModuleFilename: "[name].[contenthash][ext]",
                path: path.resolve(__dirname, "..", "dist", "rlottie-dist"),
                clean: true,
            },

            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        use: "ts-loader",
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.wasm$/,
                        type: "asset/resource",
                        generator: {
                            filename: "[name][ext]",
                        },
                    },
                ],
            },

            resolve: {
                extensions: [".js", ".ts", ".tsx"],
            },

            plugins: [
                new ProvidePlugin({
                    Buffer: ["buffer", "Buffer"],
                }),
            ],
        },
        {
            mode,
            entry: "./src/jszip.js",
            target: "web",

            output: {
                filename: "[name].js",
                chunkFilename: "[id].js",
                assetModuleFilename: "[name].[contenthash][ext]",
                path: path.resolve(__dirname, "..", "dist", "jszip-dist"),
                clean: true,
            },
        }
    ];
};
