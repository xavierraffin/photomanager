const electron = require('electron');
const Store = require('./utils/Store');
const LOG = require('./utils/Logger');

var logger = new LOG.Logger(LOG.LEVEL.DEBUG);
// SET ENV
process.env.ELECTRON_ENABLE_STACK_DUMPING = 'true';
process.env.ELECTRON_ENABLE_LOGGING = 'true';
/*
 * This setting determines how many thread libuv will create for fs operations
 * From 4 to 128
 */
process.env.UV_THREADPOOL_SIZE = "16";
logger.log(LOG.LEVEL.INFO, "UV_THREADPOOL_SIZE=%s",  process.env.UV_THREADPOOL_SIZE);

const store = new Store({
  "options" : {
   "deleteOriginal" : false,
   "tags" : {
     "createFromDirName" : true,
     "numberOfDirDepth" : 2
   },
   "photoAcceptanceCriteria" : {
     "fileSizeInBytes" : "15000",
     "minHeight" : "300",
     "minWidth" : "300",
     "hasExifDate" : false,
   },
   "storageDir": ""
 }
});

// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({width: 800, height: 600});

    // and load the index.html of the app.
    const startUrl = process.env.ELECTRON_START_URL || url.format({
            pathname: path.join(__dirname, '/../build/index.html'),
            protocol: 'file:',
            slashes: true
        });
    mainWindow.loadURL(startUrl);
    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
