'use strict'

const io = require("socket.io-client");

const path = require('path');
const fs = require('fs');

const process = require('process');
const os = require('os');

const util = require('./util');

let sockets = [];
let connCount = 0;

let logPath, settingsData, ui, job, mine;
let gStatus;

async function init(_ui, _job, _mine) {
    ui = _ui;
    job = _job;
    mine = _mine;

	logPath = ui ? path.join(require('electron').app.getPath('userData'), 'wallet.json') : path.join(__dirname, '../wallet.json');

    try {
        module.exports.log = JSON.parse(await fs.promises.readFile(logPath, 'utf8'));
    } catch(e) {
        module.exports.log = [];
    }

    for(let i = 0; i < 4; i++)
        runSocket("https://node" + i + ".neonious.org:6505/");
}

function runSocket(url) {
    let socket = io(url);
    let pushed, isConn = false;

    socket.on('connect', () => {
        if(!isConn) {
            connCount++;
            if(connCount == 1 && ui)
                ui.serverStatusChanged({
                    is_live: true
                });
            isConn = true;
        }

        if(!pushed) {
            sockets.push(socket);
            pushed = true;
        }
        if(settingsData)
            settingsChanged(settingsData, socket);
    });

    function connError() {
        if(isConn) {
            connCount--;
            isConn = false;

            if(connCount == 0) {
		        if(ui)
	                ui.serverStatusChanged({
	                    is_live: false,
	                    status_msg: 'No Internet connection'
	                });
                mine.enable('SERVER', false);
            }
        }
    }
    socket.on('connect_error', () => {
        connError();
    });
    socket.on("disconnect", (reason) => {
        connError();
        if(reason === "io server disconnect")
            setTimeout(() => {
                socket.connect();
            }, 3000);
    });

    socket.on('status', (status) => {
        gStatus = status;

	    if(ui)
	        ui.serverStatusChanged(status);
        if(settingsData)
            mine.setup(status.mine_method, status.mine_url, settingsData.engine);
        mine.enable('SERVER', status.is_live);
    });
    socket.on('job', async (params, cb) => {
        const id = await job.run(params, settingsData, ui);
        if(id)
            cb({id});
        else
            cb({busy: true});
    });

    socket.on('log', (log) => {
        module.exports.log = log;
    	if(ui)
	        ui.logChanged();
        util.writeFile(logPath, JSON.stringify(module.exports.log, null, 2));
    });
}

function settingsChanged(data, socket) {
    settingsData = data;
    if(gStatus)
        mine.setup(gStatus.mine_method, gStatus.mine_url, data.engine);

    const msg = {
        version: 2,
        node_id: data.nodeID,
        wallet_address: data.walletAddr,
        live_mode: data.liveMode,
        node_title: data.nodeTitle,
        email: data.email,
        system_stats: {
            cpu: os.cpus(),
            versions: process.versions,
            os_version: os.version(),
            mem: os.totalmem()
        }
    };

    if(socket)
        socket.emit('config', msg);
    else
        for(let i = 0; i < sockets.length; i++)
            if(sockets[i].connected)
                sockets[i].emit('config', msg);
}

function emitAll(...args) {
    for(let i = 0; i < sockets.length; i++)
        if(sockets[i].connected)
            sockets[i].emit(...args);
}

module.exports = { init, settingsChanged, emitAll };
