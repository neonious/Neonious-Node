"use strict";

const server = require('./server.js');
const settings = require('./settings.js');
const ui = require('./ui.js');
const menus = require('./menus.js');
const job = require('./job.js');

const { app, Menu } = require('electron')

if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
}

if (process.platform == 'win32')        // we do not have a code signing certificate for macOS yet
    require('update-electron-app')();

app.on('ready', async () => {
    Menu.setApplicationMenu(menus.build(ui));

    await settings.init(server);
    ui.init(settings, server, job);
    await job.init(ui, server);
    await server.init(ui, job);

    ui.createWindow();
});

app.on('activate', ui.createWindow);
app.on('second-instance', ui.createWindow);
