# webpack loader
## 1. 什么是loader
webpack只能解析`js`和`json`，那它是如何解析`css`、`less`等非`js``json`的文件呢，实际上就是使用`loader`来完成转换的。所以说，`loader`实际上是一个`转换函数`，导出值是个函数，函数的输出可以作为下个loader的输入，它的形式如下所示：
```js
/**
 * @description loader
 * @param content: 要转换的内容
 * @param map：可以被https://github.com/mozilla/source-map 使用的 SourceMap 数据
 * @param meta：可以是任何内容
 */
function myLoader(content, map, meta) {
    // normal loader
    return content;
}
myLoader.pitch = function () {
    // pitching loader
}
module.exports = myLoader;
```
可以看到，一个Loader会导出两种函数，一个是默认导出的，称为`Normal Loader`，一个是挂载在默认导出中的，称为`Pitching Loader`。这两个导出函数会在不同时机被调用，下面会讲。

## 2. webpack中如何配置loader
1. 配置loader的绝对路径
```js
{
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: path.resolve(__dirname, './loaders/myLoader.js'),
                        options: {}
                    }
                ]
            }
        ]
    }
}
```
2. 配置loader的别名
```js
{
    resolveLoader: {
        alias: {
            myLoader: path.resolve(__dirname, './loaders/myLoader.js'), // 全都要枚举，费劲
        }
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: 'myLoader',
                        options: {}
                    }
                ]
            }
        ]
    }
}
```
3. 配置loader的查询路径
```js
{
    resolveLoader: {
        modules: ['loaders', 'node_modules'] // 查找loader的时候先查询loaders目录，再查询node_modules目录
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: 'myLoader',
                        options: {}
                    }
                ]
            }
        ]
    }
}
```
## 3. loader的类型
在`webpack`中配置loader时，同一个匹配规则可以配置好几个loader，那这些loader的执行顺序是怎么样的？

通常我们认为loader的执行顺序是`从右到左`，这是不准确的，准确的说法是：`同类型`loader的执行顺序是`从右到左`的。那么loader有哪些类型？

其实，loader本身是没有类型一说的，它的类型区分来源于`配置`，在进行loader配置时有个参数：`enforce`，它的使用示例如下：

```js
{
    resolveLoader: {
        modules: ['loaders', 'node_modules'] // 查找loader的时候先查询loaders目录，再查询node_modules目录
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: 'myLoader',
                        options: {},
                        enforce: 'normal' // 这里这里！
                    }
                ]
            }
        ]
    }
}
```
`enforce`的类型决定了loader的调用时机，`enforce`共有以下几种类型：
1. pre：前置
2. normal：普通
3. inline：行内
4. post：后置

默认值为`normal`

在调用`loader`时，分为两个阶段：
1. pitching 阶段
2. normal 阶段

### 3.1 pitching 阶段
`pitching阶段`执行的是loader的`pitch方法`，按照：`post`、`inline`、`normal`、`pre`的顺序执行。

举个例子，配置如下：
```js
{
    resolveLoader: {
        modules: ['loaders', 'node_modules'] // 查找loader的时候先查询loaders目录，再查询node_modules目录
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: 'myLoader1',
                        options: {},
                        enforce: 'normal'
                    },
                    {
                        loader: 'myLoader2',
                        options: {},
                        enforce: 'inline'
                    },
                    {
                        loader: 'myLoader3',
                        options: {},
                        enforce: 'pre'
                    },
                    {
                        loader: 'myLoader4',
                        options: {},
                        enforce: 'post'
                    },
                    {
                        loader: 'myLoader5',
                        options: {},
                        enforce: 'normal'
                    }
                ]
            }
        ]
    }
}
```
执行时，会先把loader按照`enforce`类型进行归类：
```js
const pre = ['myLoader3'];
const normal = ['myLoader1', 'myLoader5'];
const inline = ['myLoader2'];
const post = ['myLoader4'];
const loaders = [...post, ...inline, ...normal, ...pre];
```
然后按照`post`、`inline`、`normal`、`pre`的顺序调用每个loader的pitch方法，所以执行顺序为：
```js
myLoader4.pitch();
myLoader2.pitch();
myLoader5.pitch(); // 同类型从右到左
myLoader1.pitch();
myLoader3.pitch();
```
#### 3.1.1 pitch 参数解析
`pitch`函数其实是有参数的，`remainingRequest`、`precedingRequest`、`data`

`remainingRequest`：还未执行过 pitch 阶段的 loader

`precedingRequest`：已经执行过 pitch 阶段的 loader

`data`：normal阶段可读取的数据，可用于数据传递，normal可以通过`this.data`来获取传递的数据

```js
function myLoader(content, map, meta) {
    // normal loader
    console.log(this.data.value); // helloworld
    return content;
}
myLoader.pitch = function (remainingRequest, precedingRequest, data) {
    // pitching loader
    this.data.value = 'helloworld';
}
module.exports = myLoader;
```

### 3.2 normal 阶段
`pitching阶段`执行的是loader的`normal方法`，也就是默认导出的方法，按照：`pre`、`normal`、`inline`、`post`的顺序执行。

还是以上面的例子为例：

执行时同样会按照`enforce`类型进行归类，然后按顺序执行loader的默认导出方法，所以执行顺序为：
```js
myLoader3();
myLoader5();  // 同类型从右到左
myLoader1();
myLoader2();
myLoader4();
```
### 3.3 loader 类型执行顺序小结
根据上述分析，loader的加载顺序为：

------>Pitching

post --> inline --> normal --> pre

<------Normal

![img.png](loaderQueue.png)

#### 3.3.1 pitch 有返回值
> `pitch`阶段有返回值时，则会跳过后续的`pitch`阶段，回到上一个`loader`的`normal`阶段

![img.png](loaderPitchReturnQueue.png)

