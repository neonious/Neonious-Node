"use strict"

const fs = require('fs');

exports.writeFile = async function writeFile(path, data) {
    const tim = new Date().getTime();
    const path2 = path + '.' + tim;

    await fs.promises.writeFile(path2, data);
    try {
        await fs.promises.unlink(path);
    } catch(e) {}
    try {
        await fs.promises.rename(path2, path);
    } catch(e) {}
}