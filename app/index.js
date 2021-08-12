"use strict";

const server = require('./server.js');
const settings = require('./settings.js');
const ui = require('./ui.js');
const menus = require('./menus.js');

const job = require('./job.js');
const mine = require('./mine.js');

let electron = require('electron');

const { app, Menu } = require('electron')

const autoUpdater = require('electron-updater').autoUpdater;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
setInterval(() => {
    autoUpdater.checkForUpdates();
}, 60 * 60 * 1000);
autoUpdater.checkForUpdates();

if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
}

app.on('ready', async () => {
    mine.init(ui);

    await settings.init(true, server, mine);
    await job.init(true, server, mine);
    await server.init(ui, job, mine);

    await ui.init(settings, server, job, mine);
    Menu.setApplicationMenu(menus.build(ui, autoUpdater));

    ui.createWindow();
});

app.on('activate', ui.createWindow);
app.on('second-instance', ui.createWindow);
