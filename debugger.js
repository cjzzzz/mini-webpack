// 对 mini-webpack 进行debug
const { webpack } = require('./mini-webpack');
const webpackOptions = require('./webpack.config');
const compiler = webpack(webpackOptions);
compiler.run((err, stat) => {
    console.log('err', err);
    console.log('stat', stat.toJson({}));
})
