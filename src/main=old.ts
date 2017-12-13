const electron = require('electron');
const path = require('path');
const url = require('url');

import {app, BrowserWindow, Menu, ipcMain} from 'electron';
import {Store} from './utils/Store';
import { Logger, LOG_LEVEL } from "./utils/Logger";
import { Importer } from "./importer/Importer";

var logger: Logger = new Logger(LOG_LEVEL.DEBUG);

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
   "window": { "width": 800, "height": 600 },
   "storageDir": ""
 }
});

let mainWindow: BrowserWindow;
const dialog = electron.dialog;
const options: any = store.get("options");

function createWindow(){

  mainWindow = new BrowserWindow({
    "width" : options.window.width,
    "height" : options.window.height,
    "show" : false
  });

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../resources/view/mainWindow.html'),
    protocol: 'file:',
    slashes: true
  }));


  mainWindow.once('ready-to-show', function(){
    mainWindow.webContents.send('storage:init', options.storageDir);
    logger.log(LOG_LEVEL.INFO, options.storageDir);
    mainWindow.show();
  });

  // Quit on cross
  mainWindow.on('closed', function(){
    app.quit();
  });

  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  Menu.setApplicationMenu(mainMenu);
}

app.on('ready', createWindow);

// menu
const mainMenuTemplate: Electron.MenuItemConstructorOptions[] = [
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

// Catch events from window
ipcMain.on('storage:set', function (){
  logger.log(LOG_LEVEL.DEBUG, "Open storage selection dialog");
  dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  }, function (folder: any){
    logger.log(LOG_LEVEL.DEBUG, "Set storage = %s", folder[0]);
    options.storageDir = folder[0];
    store.set('options', options);
    mainWindow.webContents.send('storage:init', folder[0]);
  })
})
ipcMain.on('import:set', function (){
  logger.log(LOG_LEVEL.DEBUG, "Open import folder selection dialog");
  dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  }, function (folder: any){
    logger.log(LOG_LEVEL.DEBUG, "Import directory %s", folder[0]);
    mainWindow.webContents.send('import:init', folder[0]);
    var importer: Importer = new Importer(options);
    importer.importPhotos(folder[0]);
  })
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// Add dev tools
if(process.env.NODE_ENV !== 'production'){
  mainMenuTemplate.push({
    label: 'Dev',
    submenu:[
      {
        label: 'Open dev tools',
        accelerator: process.platform == 'darwin' ? 'Command+I' : 'Ctrl+I',
        click(item: any, focusedWindow: BrowserWindow){
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
