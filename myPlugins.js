class StartPlugin {
    apply(compiler) {
        compiler.hooks.run.tap('start', () => {
            console.log('编译开始啦！');
        })
    }
}

class EndPlugin {
    apply(compiler) {
        compiler.hooks.done.tap('end', () => {
            console.log('编译结束啦！');
        })
    }
}
module.exports = {
    StartPlugin,
    EndPlugin
}
