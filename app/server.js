'use strict'

const io = require("socket.io-client");

let sockets = [];
let connCount = 0;

let settingsData, ui, job;

function init(_ui, _job) {
    ui = _ui;
    job = _job;

    for(let i = 0; i < 4; i++)
        runSocket("https://node" + i + ".neonious.org:6504/");
}

async function runSocket(url) {
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
    });
    socket.on('job', async (params, cb) => {
        const id = await job.run(params, settingsData, ui);
        if(id)
            cb({id});
        else
            cb({busy: true});
    });
    socket.on('job_result', (params) => {
        job.result(params);
    });
}

function settingsChanged(data, socket) {
    settingsData = data;

    const msg = {
        node_id: data.nodeID,
        wallet_address: data.walletAddr,
        live_mode: data.liveMode,
        invitation_code: data.invitationCode,
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

function depositPayOut() {
    for(let i = 0; i < sockets.length; i++)
        if(sockets[i].connected)
            sockets[i].emit('deposit_pay_out');
}

function initiateTest(test) {
    for(let i = 0; i < sockets.length; i++)
        if(sockets[i].connected)
            sockets[i].emit('initiate_test', test);
}

function emitAll(...args) {
    for(let i = 0; i < sockets.length; i++)
        if(sockets[i].connected)
            sockets[i].emit(...args);
}

module.exports = { init, settingsChanged, depositPayOut, initiateTest, emitAll };