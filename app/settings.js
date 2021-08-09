"use strict";

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let settingsPath;
let uiMode, server, mine;

exports.init = async function(_uiMode, _server, _mine) {
	uiMode = _uiMode;
    server = _server;
    mine = _mine;

	settingsPath = uiMode ? path.join(require('electron').app.getPath('userData'), 'settings.json') : path.join(__dirname, '../settings.json');
//    try { await fs.promises.unlink(settingsPath); } catch(e) {}

    try {
        exports.data = JSON.parse(await fs.promises.readFile(settingsPath, 'utf8'));
        server.settingsChanged(exports.data);
    } catch(e) {
        exports.data = {nodeID: crypto.randomBytes(16).toString('hex').toUpperCase(), liveMode: true};
	    await fs.promises.writeFile(settingsPath, JSON.stringify(exports.data, null, 2));
    }
    mine.enable('CLIENT', exports.data.liveMode);
}

exports.set = async function(data) {
    if(uiMode && data.systemStart != exports.data.systemStart) {
	const AutoLaunch = require('auto-launch');
	const { dialog } = require('electron');

        try {
            const autoLauncher = new AutoLaunch({name: 'Neonious Node'});
            if(data.systemStart)
                await autoLauncher.enable();
            else
                await autoLauncher.disable();
        } catch(e) {
            dialog.showErrorBox("Launch on system start setup failed", e.message);
            data.systemStart = exports.data.systemStart;
        }
    }
    data.nodeID = exports.data.nodeID;

    exports.data = data;
    await fs.promises.writeFile(settingsPath, JSON.stringify(data, null, 2));

    server.settingsChanged(data);
    mine.enable('CLIENT', data.liveMode);
}
