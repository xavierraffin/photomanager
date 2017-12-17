const electron = require('electron');
const path = require('path');
const url = require('url');
const Store = require('./utils/Store');
const { Logger, LOG_LEVEL } = require('./utils/Logger');
const { StorageInfo_IPC, Storage } = require('./model/Storage');
const { Importer } = require('./import/Importer');

var logger = new Logger(LOG_LEVEL.DEBUG);
// SET ENV
process.env.ELECTRON_ENABLE_STACK_DUMPING = 'true';
process.env.ELECTRON_ENABLE_LOGGING = 'true';
/*
 * This setting determines how many thread libuv will create for fs operations
 * From 4 to 128
 */
process.env.UV_THREADPOOL_SIZE = "16";
logger.log(LOG_LEVEL.INFO, "UV_THREADPOOL_SIZE=%s",  process.env.UV_THREADPOOL_SIZE);

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

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
const options = store.get("options");
var importer = new Importer(options, importUpdateProgress);
let storage;
let isStorageInfoLoaded = false;
let isLoadedEventWaited = false;

// Menu
const mainMenuTemplate = [
  {
    label: 'File',
    submenu:[
      {
        label: 'Quit',
        accelerator: process.platform == 'darwin' ? 'Command+Q' : 'Ctrl+Q',
        click(){
          app.quit();
        }
      }
    ]
  }
];

// Add dev tools
if(process.env.NODE_ENV !== 'production'){
  mainMenuTemplate.push({
    label: 'Dev',
    submenu:[
      {
        label: 'Open dev tools',
        accelerator: process.platform == 'darwin' ? 'Command+I' : 'Ctrl+I',
        click(item, focusedWindow){
          focusedWindow.webContents.toggleDevTools();
        }
      },
      {
        role: 'reload',
        accelerator: 'F5'
      }
    ]
  });
}

function createWindow() {
    const size = electron.screen.getPrimaryDisplay().workAreaSize;

    // Create the browser window.
    mainWindow = new BrowserWindow({
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      show: false
    });

    // and load the index.html of the app.
    const startUrl = process.env.ELECTRON_START_URL || url.format({
            pathname: path.join(__dirname, '/../build/index.html'),
            protocol: 'file:',
            slashes: true
        });
    mainWindow.loadURL(startUrl);

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        app.quit();
    });

    mainWindow.once('ready-to-show', function(){
      if(options.storageDir != "") {
        mainWindow.webContents.send('storage:selected', options.storageDir);
        loadStorage(options);
      }
      mainWindow.show();
    });

    const mainMenu = electron.Menu.buildFromTemplate(mainMenuTemplate);
    electron.Menu.setApplicationMenu(mainMenu);
}

function loadStorage(options) {
  logger.log(LOG_LEVEL.INFO, "loadStorage %s", options.storageDir);
  storage = new Storage(options); // TODO check if we memory leak with this line
  storage.load(storageLoaded);
}

function storageLoaded(storageInfo) {
  isStorageInfoLoaded = true;
  logger.log(LOG_LEVEL.INFO, "Storage is loaded, numberOfPhotos = %s", storageInfo.photosNbr);
  if(isLoadedEventWaited) {
    logger.log(LOG_LEVEL.DEBUG, "Storage was waited: send it");
    mainWindow.webContents.send('storage:loaded', storageInfo);
    isLoadedEventWaited = false;
  }
}

function importUpdateProgress(percent, itemsdone, totalitems) {
  logger.log(LOG_LEVEL.DEBUG, "Electron start task completion = %s%, (%s/%s)",
                              percent,
                              itemsdone,
                              totalitems);
  mainWindow.webContents.send('import:progress', percent);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
});


  electron.ipcMain.on('load:storage', function (){
    logger.log(LOG_LEVEL.DEBUG, "GUI ask to load storage");
    if(options.storageDir != "") {
      if(isStorageInfoLoaded) {
        logger.log(LOG_LEVEL.DEBUG, "Storage is ready: send it");
        mainWindow.webContents.send('storage:loaded', storage.getInfo_IPC());
      } else {
        logger.log(LOG_LEVEL.DEBUG, "Storage is not ready: wait for it");
        isLoadedEventWaited = true; // Then the event will be sent when ready
      }
    }
  });
  electron.ipcMain.on('set:storage', function (){
    logger.log(LOG_LEVEL.DEBUG, "Open storage selection dialog");
    electron.dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    }, function (folder){
      logger.log(LOG_LEVEL.DEBUG, "Set storage = %s", folder[0]);
      options.storageDir = folder[0];
      store.set('options', options);
      mainWindow.webContents.send('storage:selected', folder[0]);
      loadStorage(options);
    })
  });
  electron.ipcMain.on('set:import', function (){
    logger.log(LOG_LEVEL.DEBUG, "Open import folder selection dialog");
    electron.dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    }, function (folder){
      logger.log(LOG_LEVEL.DEBUG, "Import directory %s", folder[0]);
      mainWindow.webContents.send('import:selected', folder[0]);
      importer.importPhotos(folder[0], storage);
    })
  });
