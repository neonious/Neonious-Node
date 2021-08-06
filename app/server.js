'use strict'

const { app } = require('electron');

const io = require("socket.io-client");

const path = require('path');
const fs = require('fs');

let sockets = [];
let connCount = 0;

let settingsData, ui, job, mine;

let logPath = path.join(app.getPath('userData'), 'wallet.json');

async function init(_ui, _job, _mine) {
    ui = _ui;
    job = _job;
    mine = _mine;

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
                ui.serverStatusChanged({
                    is_live: false,
                    status_msg: 'No Internet connection'
                });
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
        ui.serverStatusChanged(status);
        mine.setup(status.mine_method, status.mine_url);
    });
    socket.on('job', async (params, cb) => {
        const id = await job.run(params, settingsData, ui);
        if(id)
            cb({id});
        else
            cb({busy: true});
    });

    let logSaveNeeded = false, logSaving = false;
    async function saveLog() {
        if(logSaving)
            logSaveNeeded = true;
        else {
            logSaving = true;
            logSaveNeeded = false;
            try {
                await fs.promises.writeFile(logPath + '.tmp', JSON.stringify(module.exports.log, null, 2));
                try {
                    await fs.promises.unlink(logPath);
                } catch(e) {}
                await fs.promises.rename(logPath + '.tmp', logPath);
            } catch(e) {
                console.error(e);
            }
            logSaving = false;
            if(logSaveNeeded)
                saveLog();
        }
    }
    socket.on('log', (log) => {
        module.exports.log = log;
        ui.logChanged();
        saveLog();
    });
}

function settingsChanged(data, socket) {
    settingsData = data;

    const msg = {
        node_id: data.nodeID,
        wallet_address: data.walletAddr,
        live_mode: data.liveMode,
        email: data.email,
        system_stats: {
            cpu: 'na',
            gpu: 'na'
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