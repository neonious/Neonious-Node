'use strict'

const child_process = require('child_process');
const path = require('path');

let gMethod, gURL;

let gEnableFlags = {}, gProcess, gKillingPromise;

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
            gProcess = child_process.spawn(path.join(__dirname, '../engine/ethminer/bin/ethminer'),
                ['-P', gURL], {
                stdio: 'ignore',
                windowsHide: true,
                detached: false,
            });
        } catch(e) {
            console.error(e);
            setTimeout(enableInner, 5000);
            return;
        }
        gProcess.on('close', (code) => {
            gProcess = null;
            if(code)
                console.error('ethminer exited with code ' + code);

            setTimeout(enableInner, 5000);
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