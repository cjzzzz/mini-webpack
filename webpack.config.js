const path = require('path');
const {StartPlugin, EndPlugin} = require("./myPlugins");
const {myLoader} = require("./myLoader");

module.exports = {
    mode: 'development', // 防止被压缩
    entry: path.join(__dirname, '/src/index.js'),
    output: {
        path: path.join(__dirname, 'dist'),
        filename: '[name].js',
    },
    devtool: "source-map", //防止干扰源文件
    plugins: [
        new StartPlugin(),
        new EndPlugin(),
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [myLoader]
            }
        ]
    }
}
