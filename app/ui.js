"use strict";

const { app, BrowserWindow, Menu, screen, ipcMain, Tray, shell, dialog, clipboard } = require('electron')

const path = require('path');
const fs = require('fs');

const ethereum_address = require('ethereum-address');

let settings, server, serverStatus = {}, job, mine;

let tray, window, settingsWindow, depositWindow;

let quitting;

let mineStatus = {status: 'OFF'};

async function init(_settings, _server, _job, _mine) {
    settings = _settings;
    server = _server;
    job = _job;
    mine = _mine;

    let trayMenu = [
        { label: 'Open Main Window', click: createWindow },
        { type: 'separator' },
        { label: 'Wallet Deposit/Withdrawal Info...', click: createDeposit },
        { label: 'Settings...', click: createSettings }
    ];
    if (process.platform == 'darwin')
        app.dock.setMenu(Menu.buildFromTemplate(trayMenu));
    else {
        trayMenu.push(
            { type: 'separator' },
            { label: 'Quit', click: () => { app.quit(); } });

        tray = new Tray(path.join(__dirname, 'tray/icon_16x16.png'));
        tray.on('click', createWindow);
        tray.setContextMenu(Menu.buildFromTemplate(trayMenu));
    }

    app.on('window-all-closed', function () { });

    function beforeQuit() {
        quitting = true;

        mine.handleQuit();
        job.handleQuit();

        if (settingsWindow) {
            settingsWindow.closable = true;
            settingsWindow.close();
        }
        if (depositWindow) {
            depositWindow.closable = true;
            depositWindow.close();
        }
    }
    app.on('before-quit', beforeQuit);
    app.on('before-quit-for-update', beforeQuit);
}

ipcMain.on('onFrontend', async (e, event, param) => {
    if(event == 'openSettings')
        createSettings();
    if(event == 'openDeposit')
        createDeposit();
    if(event == 'liveMode') {
        settings.data.liveMode = param;
        await settings.set(settings.data);
        sendFrontend('settingsSet', settings.data);
    }
    if(event == 'openErrorFailAntivir')
        shell.openExternal('https://www.neonious.org/en/RunNode#AntiVirus');

    if(event == 'abortSim')
        job.abort();

    // Settings dialog
    if (event == 'settingsLoaded' && settingsWindow) {
        const width = settingsWindow.getSize()[0];
        settingsWindow.setContentSize(width, (param + 1) | 0);

        const height = settingsWindow.getSize()[1];
        settingsWindow.setMinimumSize(width, height);
        settingsWindow.setMaximumSize(1024, height);

        const workArea = screen.getPrimaryDisplay().workArea;
        settingsWindow.setPosition(
            workArea.x + ((workArea.width - width) / 2) | 0,
            workArea.y + ((workArea.height - height) / 2) | 0
        );

        settingsWindow.show();
    }
    if (event == 'settingsSet' && settingsWindow) {
        if(!ethereum_address.isAddress(param.data.walletAddr)) {
            settingsWindow.webContents.send('sendFrontend', 'walletAddrErr');
            param.err = true;
        }
        if(!param.err) {
            param.data.liveMode = settings.data.liveMode;
            param.data.hideDeposit = settings.data.hideDeposit;
            await settings.set(param.data);

            sendFrontend('settingsSet', param.data);

            settingsWindow.closable = true;
            settingsWindow.close();
        }
    }
    if (event == 'settingsClose' && settingsWindow) {
        settingsWindow.closable = true;
        settingsWindow.close();
    }
    if(event == 'hideDeposit') {
        settings.data.hideDeposit = true;
        await settings.set(settings.data);
    }

    if (event == 'depositLoaded' && depositWindow) {
        // Things change in-between. TODO: find better solution than sending twice
        depositWindow.webContents.send('sendFrontend', 'serverStatusChanged', serverStatus);

        const setHeight = ((param + 1) | 0) - 300;
        const width = depositWindow.getSize()[0];
        depositWindow.setContentSize(width, setHeight);

        const height = depositWindow.getSize()[1];
        depositWindow.setMinimumSize(width, height);
        depositWindow.setMaximumSize(1024, height);

        const workArea = screen.getPrimaryDisplay().workArea;
        depositWindow.setPosition(
            workArea.x + ((workArea.width - width) / 2) | 0,
            workArea.y + ((workArea.height - height) / 2) | 0
        );

        depositWindow.show();
    }
    if (event == 'depositClose' && depositWindow) {
        depositWindow.closable = true;
        depositWindow.close();
    }
    if(event == 'openTokenSale') {
        shell.openExternal('https://www.neonious.org/en/TradeMDSIM');
    }
    if(event == 'openNeoniousStats') {
        shell.openExternal('https://www.neonious.org/en/Statistics');
    }
    
    if(event == 'depositPayOut') {
        server.emitAll('deposit_pay_out');
    }
    if(event == 'copyDepositAddress') {
        clipboard.writeText(serverStatus.deposit_address);
    }
});
function sendFrontend(...args) {
    if (window)
        window.webContents.send('sendFrontend', ...args);
}

function createWindow() {
    if (!settings)
        return;
    if (window) {
        window.show();
        return;
    }

    let bounds, workArea;

    workArea = screen.getPrimaryDisplay().workArea;
    bounds = {
        x: workArea.x,
        y: workArea.y
    };

    bounds.width = workArea.width * 0.8;
    bounds.height = workArea.height * 0.8;
    // Limit aspect ratio
    if (bounds.width > bounds.height * 1.25)
        bounds.width = bounds.height * 1.25;
    if (bounds.height > bounds.width * 1.25)
        bounds.height = bounds.width * 1.25;
    // Limit bounds on right and bottom
    if (bounds.width > workArea.x + workArea.width - bounds.x)
        bounds.width = workArea.x + workArea.width - bounds.x;
    if (bounds.height > workArea.y + workArea.height - bounds.y)
        bounds.height = workArea.y + workArea.height - bounds.y;

    // Create the browser window.
    window = new BrowserWindow({
        title: "Neonous Node",
        x: bounds.x | 0,
        y: bounds.y | 0,
        width: bounds.width | 0,
        height: bounds.height | 0,
        minWidth: 300,
        minHeight: 300,
        show: false,
        //        icon: path.join(__dirname, 'tray/icon_16x16.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    window.loadFile('../frontend/index.html', {
        search: encodeURIComponent(JSON.stringify({
            settingsData: settings.data,
            serverStatus,
            log: server.log,
            mineStatus
        }))
    });

    window.once('ready-to-show', () => {
        // Things change in-between. TODO: find better solution then inserting twice
        sendFrontend('logChanged', server.log);
        sendFrontend('serverStatusChanged', serverStatus);
        sendFrontend('settingsSet', settings.data);
    
        window.show();
    });
    window.on('closed', () => {
        window = null;

        if (!quitting && ((settings.data && settings.data.liveMode) || process.platform == 'darwin')) {
            if (tray)
                tray.displayBalloon({
                    iconType: 'info',
                    title: 'Neonious Node is running in the background',
                    content: 'The software is still ready to take on simulations. You can reopen the user interface by double clicking the icon here.',
                    noSound: true
                });
        } else
            app.quit();
    });
}

function createSettings() {
    if (!settings)
        return;
    if (settingsWindow) {
        settingsWindow.show();
        return;
    }

    settingsWindow = new BrowserWindow({
        title: "Settings",
        width: 600,
        height: 800,
        maximizable: false,
        useContentSize: true,
        show: false,
        closable: false,
        parent: window ? window : undefined,
        modal: true,
        autoHideMenuBar: true,
        //        icon: path.join(__dirname, 'tray/icon_16x16.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    settingsWindow.loadFile('../frontend/settings.html', {
        search: encodeURIComponent(JSON.stringify({
            data: settings.data
        }))
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function createDeposit() {
    if (depositWindow) {
        depositWindow.show();
        return;
    }
    if(!settings.data.walletAddr) {
        dialog.showErrorBox('Not set up', 'The deposit transfer information dialog cannot be opened yet. Please enter the settings first.');
        return;
    }

    depositWindow = new BrowserWindow({
        title: "Wallet Deposit/Withdrawal Info",
        width: 900,
        height: 800,
        maximizable: false,
        useContentSize: true,
        show: false,
        closable: true,
        parent: window ? window : undefined,
        modal: true,
        autoHideMenuBar: true,
        //        icon: path.join(__dirname, 'tray/icon_16x16.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    depositWindow.loadFile('../frontend/deposit.html', {
        search: encodeURIComponent(JSON.stringify({
            serverStatus
        }))
    });

    depositWindow.on('closed', () => {
        depositWindow = null;
    });
}

function logChanged() {
    sendFrontend('logChanged', server.log);
}
function serverStatusChanged(status) {
    serverStatus = status;
    sendFrontend('serverStatusChanged', serverStatus);
    if(depositWindow)
        depositWindow.webContents.send('sendFrontend', 'serverStatusChanged', serverStatus);
}

// status can be OFF, FAIL_ANTIVIR, FAIL or LIVE
function mineStatusChanged(status, hashRate) {
    mineStatus.status = status;
    mineStatus.hashRate = hashRate;
    sendFrontend('mineStatusChanged', mineStatus);
}

module.exports = { init, createWindow, createSettings, createDeposit, logChanged, serverStatusChanged, mineStatus: mineStatusChanged };