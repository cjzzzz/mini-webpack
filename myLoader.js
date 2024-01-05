const myLoader = (code) => {
    return `${code} // 自定义loader：增加注释\n`
}

module.exports = {
    myLoader
}
