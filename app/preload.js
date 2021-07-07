"use strict";

let { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sendBackend', (...args) => {
    ipcRenderer.send('onFrontend', ...args);
});

let onBackend;
contextBridge.exposeInMainWorld('onBackend', (cb) => {
    onBackend = cb;
});

ipcRenderer.on('sendFrontend', (event, ...args) => {
    if(onBackend)
        onBackend(...args);
});