'use strict'

const child_process = require('child_process');

const path = require('path');
const fs = require('fs');

let gMethod, gURL;

let gEnableFlags = {}, gProcess, gKillingPromise;

let exe;
try {
    exe = path.join(__dirname, '../engine/ethminer/bin/neonmine.exe')
    fs.accessSync(exe, fs.constants.R_OK);
} catch(e) {
    exe = path.join(__dirname, '../engine/ethminer/bin/ethminer')
}

let ui;

exports.init = function init(_ui) {
    ui = _ui;
}

exports.setup = function setup(method, url) {
    if(gMethod != method || gURL != url) {
        exports.enable('URL_CHANGE', false);
        gMethod = method;
        gURL = url;
        exports.enable('URL_CHANGE', true);
    }
}

function enableInner() {
    let flag = true;

    if (gMethod != 'eth')
        flag = false;
    else
        for (let i in gEnableFlags)
            if (!gEnableFlags[i])
                flag = false;

    if (flag) {
        if (gProcess || gKillingPromise)
            return;

        try {
            gProcess = child_process.spawn(exe,
                ['-P', gURL], {
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
                detached: false,
            });
        } catch(e) {
            console.error(e);
            setTimeout(enableInner, 5000);
            return;
        }

        let running = false;
        let active = true;

        let stdoutTxt = '';
        gProcess.stdout.on('data', (txt) => {
            if(running || !active)
                return;

            stdoutTxt += txt;
            while(true) {
                let pos = stdoutTxt.indexOf('\n');
                if(pos < 0)
                    break;

                let txt = stdoutTxt.substr(0, pos);
                if(txt.indexOf('ethminer') == 0 || txt.indexOf('mine') == 0) {
                    stdoutTxt = null;
                    running = true;
                    break;
                }
                stdoutTxt = stdoutTxt.substr(pos + 1);
            }
        });
        let stderrTxt = '';
        gProcess.stderr.on('data', (txt) => {
            if(!active)
                return;

            stderrTxt += txt;
            while(true) {
                let pos = stderrTxt.indexOf('\n');
                if(pos < 0)
                    break;

                let txt = stderrTxt.substr(0, pos);
                txt = txt.split(' ');
                if(txt[6] * 1 && (txt[7] == 'h' || txt[7] == 'Kh' || txt[7] == 'Mh' || txt[7] == 'Gh')) {
                    let hashRate = txt[6] + ' ' + txt[7];
                    if(ui)
                        ui.mineStatus('LIVE', hashRate);
                }

                stderrTxt = stderrTxt.substr(pos + 1);
            }
        });

        function done(err) {
            if(!active)
                return;
            active = false;

            if(gKillingPromise)
                err = null;
            else if(!err)
                err = new Error('ethminer exited unexpectedly');

            gProcess = null;
            if(err) {
                console.error(err);
                if(!running && ui)
                    ui.mineStatus('FAIL_ANTIVIR');
                else if(ui)
                    ui.mineStatus('FAIL');
            } else if(ui)
                ui.mineStatus('OFF');

            setTimeout(enableInner, 5000);
        }
        gProcess.on('error', done);
        gProcess.on('close', (code) => {
            done(code ? new Error('ethminer exited with code ' + code) : null);
        });
    } else {
        if(!gProcess)
            return new Promise((resolve) => { resolve(); });
        if(gKillingPromise)
            return gKillingPromise;

        return gKillingPromise = new Promise((resolve) => {
            try {
                gProcess.kill('SIGTERM');
            } catch(e) {}

            let n = 0;
            let interval = setInterval(() => {
                if(!gProcess) {
                    clearInterval(interval);
                    gKillingPromise = null;
                    resolve();
                    return enableInner();
                }

                if(n == 5 || n == 10)
                    try {
                        gProcess.kill('SIGTERM');
                    } catch(e) {}
                else if(n == 15 || n >= 20)
                    try {
                        gProcess.kill('SIGKILL');
                    } catch(e) {}
                n++;
            }, 1000);
        });
    }
}

// key may be SERVER, CLIENT, JOB, URL_CHANGE or QUIT, only if no key exists which is false, we mine
// disabling mining returns a promise which is resolved when mining is clearly off
exports.enable = function enable(key, flag) {
    gEnableFlags[key] = flag;
    return enableInner();
}

// key may be SERVER, CLIENT or JOB
// only if no key exists which is false, we mine
exports.handleQuit = function handleQuit() {
    exports.enable('QUIT', false);
    if(gProcess)
        try {
            gProcess.kill('SIGKILL');
        } catch(e) {}
}