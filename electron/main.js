const { app, BrowserWindow } = require('electron');
const path = require('path');
const { getConfig } = require('../config');
const config = getConfig();
require('../server');
function createWindow() {
    const porta = config.porta || 3000;
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false
        }
    });
    win.loadURL(`http://localhost:${porta}`);
}
app.whenReady().then(() => {
    createWindow();
});