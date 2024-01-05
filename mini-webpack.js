const { SyncHook } = require('tapable');
const path = require("path");
const fs = require("fs");
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const baseDir = __dirname;

// 找到存在的文件
const findFilePath = (filename, exts) => {
    if (fs.existsSync(filename)) {
        return filename;
    }
    const validExt = exts.find(ext => fs.existsSync(`${filename}${ext}`));
    if (validExt) {
        return `${filename}${validExt}`;
    }
    throw new Error(`${filename}不存在`);
}

const getAssetContent = (chunk) => {
    return `
        (() => {
            var modules = {
                ${chunk.relativeModules.map(m => `'${m.id}':(module) => { ${m.sourceCode} \n}`).join(',\n')}
            };
            var cache = {};
            // 重写require函数
            var require = (moduleId) => {
                if (cache[moduleId]) {
                    return cache[moduleId].exports;
                }
                cache[moduleId] = {
                    exports: {}
                };
                var module = cache[moduleId];
                modules[moduleId](module);
                return module.exports;
            };
            ${chunk.module.sourceCode}
        })()
    `;
}

class Compilation {
    constructor(webpackOptions) {
        this.options = webpackOptions;
        this.modules = []; // 存储已经编译的模块
        this.chunks = []; // 存储已经编译好的代码块
        this.assets = []; // 存储产物
        this.fileDependencies = []; // 存储依赖的文件路径
    }

    // 解析源码，获取依赖模块和替换后的源码
    codeParser(code, modulePath) {
        const dependencies = [];
        const ast = parse(code, {
            sourceType: 'module'
        });
        const that = this;
        traverse(ast, {
            CallExpression(nodePath) {
                const { node } = nodePath;
                // 找到require语句
                if (node.callee.name === 'require') {
                    const filePath = path.posix.join(path.posix.dirname(modulePath), node.arguments[0].value);
                    const fileWithExt = findFilePath(filePath, that.options.extensions ?? ['.js']);
                    node.arguments[0].value = path.posix.relative(baseDir, fileWithExt); // 用模块id来替换
                    // 依赖存储
                    dependencies.push(fileWithExt);
                }
            }
        });
        const { code: sourceCode } = generate(ast);
        return {
            dependencies,
            sourceCode
        }
    }

    loader(absoluteFilePath) {
        let sourceCode = fs.readFileSync(absoluteFilePath, 'utf8');
        const rules = this.options.module?.rules ?? [];
        const loaders = rules.find(rule => {
            const { test } = rule;
            return absoluteFilePath.match(test)
        }).use ?? [];
        sourceCode = loaders.reduceRight((code, loader) => {
            return loader(code);
        }, sourceCode);
        return sourceCode;
    }

    buildModule(entryName, absoluteFilePath) {
        const module = {
            id: path.posix.relative(baseDir, absoluteFilePath),
            names: [entryName],
            dependencies: [],
            sourceCode: ''
        }
        this.fileDependencies.push(absoluteFilePath);
        const codeAfterLoader = this.loader(absoluteFilePath);
        const { dependencies, sourceCode } = this.codeParser(codeAfterLoader, absoluteFilePath);
        module.dependencies.push(...dependencies);
        module.sourceCode = sourceCode;
        module.dependencies.forEach(depPath => {
            const depId = path.posix.relative(baseDir, depPath);
            const existModule = this.modules.find(m => m.id === depId);
            if (existModule) {
                existModule.names.push(entryName);
            } else {
                const depModule = this.buildModule(entryName, depPath);
                this.modules.push(depModule);
            }
        })
        return module;
    }

    createChunk(fileName, module) {
        return {
            name: fileName,
            module,
            relativeModules: this.modules.filter(m => m.names.includes(fileName))
        }
    }

    generateAsset() {
        const assets = this.chunks.map(chunk => {
            const assetContent = getAssetContent(chunk);
            const assetPath = path.posix.join(this.options.output.path, this.options.output.filename.replace('[name]', chunk.name));
            fs.writeFileSync(assetPath, assetContent, 'utf8');
            return {
                path: assetPath,
                content: assetContent
            }
        });
        this.assets.push(...assets);
    }

    build(callback) {
        let entry = {};
        if (typeof this.options.entry === 'string') {
            entry.main = this.options.entry; // 保持数据格式一致，便于处理
        } else {
            entry = this.options.entry;
        }
        for (let entryName in entry) {
            const module = this.buildModule(entryName, entry[entryName]);
            this.modules.push(module);
            const chunk = this.createChunk(entryName, module);
            this.chunks.push(chunk);
        }
        this.generateAsset();
        callback(null, {
            assets: this.assets,
            chunks: this.chunks,
            modules: this.modules,
            fileDependencies: this.fileDependencies
        })
    }
}

class Compiler {
    constructor(webpackOptions) {
        this.options = webpackOptions;
        this.hooks = {
            run: new SyncHook(),
            done: new SyncHook(),
        }
    }

    compile(callback) {
        const compilation = new Compilation(this.options); // 便于重复编译
        compilation.build(callback);
    }

    run(callback) {
        this.hooks.run.call();
        const compileDone = (err, stat) => {
            // 编译产物
            callback?.(err, {
                toJson: (opt) => {
                    return stat;
                }
            });
            stat?.fileDependencies.forEach(dep => {
                fs.watch(dep, () => this.compile(compileDone));
            })
            // 编译结束
            this.hooks.done.call();
        }
        this.compile(compileDone);
    }
}

const webpack = (webpackOptions) => {
    const compiler = new Compiler(webpackOptions);
    webpackOptions.plugins.forEach(plugin => {
        plugin.apply(compiler);
    })
    return compiler;
}

module.exports = {
    webpack
}
