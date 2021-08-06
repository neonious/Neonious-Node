"use strict";

const { BrowserWindow, Menu, app, shell, dialog } = require('electron');

let autoUpdater;

exports.build = (ui, _autoUpdater) => {
	autoUpdater = _autoUpdater;
    let template = [process.platform == 'darwin' ? {
        label: 'File',
        submenu: [{
            label: 'Open Main Window',
            accelerator: 'CmdOrCtrl+O',
            click: ui.createWindow
        }, {
            type: 'separator'
        }, {
            label: 'Wallet Deposit/Withdrawal Info...', click: ui.createDeposit
        }, {
            type: 'separator'
        }, {
            label: 'Close',
            accelerator: 'CmdOrCtrl+W',
            role: 'close'
        }]
    } : {
        label: 'File',
        submenu: [{
            label: 'Open',
            accelerator: 'CmdOrCtrl+O',
            click: ui.createWindow
        }, {
            label: 'Settings...',
            click: ui.createSettings,
        }, {
            type: 'separator'
        }, {
            label: 'Wallet Deposit/Withdrawal Info...', click: ui.createDeposit
        }, {
            type: 'separator'
        }, {
            label: 'Close',
            accelerator: 'CmdOrCtrl+W',
            role: 'close'
        }]
    }, {
        label: 'Edit',
        submenu: [{
            label: 'Undo',
            accelerator: 'CmdOrCtrl+Z',
            role: 'undo'
        }, {
            label: 'Redo',
            accelerator: 'Shift+CmdOrCtrl+Z',
            role: 'redo'
        }, {
            type: 'separator'
        }, {
            label: 'Cut',
            accelerator: 'CmdOrCtrl+X',
            role: 'cut'
        }, {
            label: 'Copy',
            accelerator: 'CmdOrCtrl+C',
            role: 'copy'
        }, {
            label: 'Paste',
            accelerator: 'CmdOrCtrl+V',
            role: 'paste'
        }, {
            label: 'Clear',
            role: 'delete'
        }, {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            role: 'selectall'
        }]
    },
    {
        label: 'Help',
        role: 'help',
        submenu: [{
            label: 'Go to Neonious Website',
            click: () => {
                shell.openExternal('https://www.neonious.org/')
            }
        },
        {
            label: 'Trade MDSIMs',
            click: () => {
                shell.openExternal('https://www.neonious.org/en/TradeMDSIM')
            }
        }]
    }];

    if (process.env.DEBUG)
        template.push({
            label: 'Debug',
            submenu: [{
            label: 'Reload',
            accelerator: 'CmdOrCtrl+R',
            click: (item, focusedWindow) => {
                if (focusedWindow) {
                    // on reload, start fresh and close any old
                    // open secondary windows
                    if (focusedWindow.id === 1) {
                        BrowserWindow.getAllWindows().forEach(win => {
                            if (win.id > 1) win.close()
                        })
                    }
                    focusedWindow.reload()
                }
            }
        }, {
            label: 'Toggle Developer Tools',
            accelerator: (() => {
                if (process.platform === 'darwin') {
                    return 'Alt+Command+I'
                } else {
                    return 'Ctrl+Shift+I'
                }
            })(),
            click: (item, focusedWindow) => {
                if (focusedWindow) {
                    focusedWindow.toggleDevTools()
                }
            }
        }]});

    function addUpdateMenuItems(items, position) {
        if (process.mas) return

        const version = app.getVersion()
        let updateItems = [{
            label: 'Checking for Update',
            visible: false,
            enabled: false,
            id: 'checkingForUpdate'
        }, {
            label: 'Check for Update',
            visible: true,
            enabled: true,
            id: 'checkForUpdate',
            click: () => {
                autoUpdater.checkForUpdates()
            }
        }, {
            label: 'Restart and Install Update',
            enabled: true,
            visible: false,
            id: 'restartToUpdate',
            click: () => {
                autoUpdater.quitAndInstall()
            }
        }];
        if(process.platform === 'win32')
            updateItems.push({type: 'separator'});

        items.splice.apply(items, [position, 0].concat(updateItems));
    }

    if (process.platform === 'darwin') {
        const name = app.getName()
        template.unshift({
            label: name,
            submenu: [{
                label: `About ${name}`,
                role: 'about'
            }, {
                type: 'separator'
            }, {
                label: 'Settings...',
                click: ui.createSettings,
            }, {
                type: 'separator'
            }, {
                label: 'Services',
                role: 'services',
                submenu: []
            }, {
                type: 'separator'
            }, {
                label: `Hide ${name}`,
                accelerator: 'Command+H',
                role: 'hide'
            }, {
                label: 'Hide Others',
                accelerator: 'Command+Alt+H',
                role: 'hideothers'
            }, {
                label: 'Show All',
                role: 'unhide'
            }, {
                type: 'separator'
            }, {
                label: 'Quit',
                accelerator: 'Command+Q',
                click: () => {
                    app.quit()
                }
            }]
        })

        addUpdateMenuItems(template[0].submenu, 1);
    }

    if (process.platform === 'win32') {
        const helpMenu = template[template.length - (process.env.DEBUG ? 2 : 1)].submenu
        addUpdateMenuItems(helpMenu, 0);
    }

    let menu = Menu.buildFromTemplate(template);
    autoUpdater.on('checking-for-update', () => {
        Menu.getApplicationMenu().getMenuItemById('restartToUpdate').visible = false;
        Menu.getApplicationMenu().getMenuItemById('checkForUpdate').visible = false;
        Menu.getApplicationMenu().getMenuItemById('checkingForUpdate').visible = true;
        Menu.getApplicationMenu().getMenuItemById('checkingForUpdate').enabled = false;
    });
    autoUpdater.on('update-not-available', () => {
        Menu.getApplicationMenu().getMenuItemById('checkingForUpdate').visible = false;
        Menu.getApplicationMenu().getMenuItemById('restartToUpdate').visible = false;
        Menu.getApplicationMenu().getMenuItemById('checkForUpdate').visible = true;
        Menu.getApplicationMenu().getMenuItemById('checkForUpdate').enabled = true;
    });
    autoUpdater.on('update-downloaded', (info) => {
        let messageBoxOptions = {
            type: "question",
            buttons: [
                "Install",
                "Cancel"
            ],
            defaultId: 0,
            cancelId: 1,
            title: "Version " + info.version + " ready to install",
            message: "An update of the Neonious Node software was downloaded and is ready to be installed. Keeping the software up-to-date ensures that you can always accept paid simulations.\n\nDo you wish to restart to install the new version?"
           }
          
           Menu.getApplicationMenu().getMenuItemById('checkingForUpdate').visible = false;
           Menu.getApplicationMenu().getMenuItemById('checkForUpdate').visible = false;
           Menu.getApplicationMenu().getMenuItemById('restartToUpdate').visible = true;
           Menu.getApplicationMenu().getMenuItemById('restartToUpdate').enabled = true;

           dialog.showMessageBox(undefined, messageBoxOptions).then((params) => {
            if (params.response === messageBoxOptions.defaultId) {
             autoUpdater.quitAndInstall()
            }
        });
    });
    return menu;
}
