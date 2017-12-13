import { app, BrowserWindow, screen, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import {Store} from './src/app/utils/Store';
import { Logger, LOG_LEVEL } from "./src/app/utils/Logger";
import { Importer } from "./src/app/import/Importer";

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
   "storageDir": ""
 }
});

let win, serve;
const args = process.argv.slice(1);
serve = args.some(val => val === '--serve');
const options: any = store.get("options");

if (serve) {
  require('electron-reload')(__dirname, {
  });
}

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

// Add dev tools
if(process.env.NODE_ENV !== 'production'){
  mainMenuTemplate.push({
    label: 'Dev',
    submenu:[
      {
        label: 'Open dev tools',
        accelerator: process.platform == 'darwin' ? 'Command+I' : 'Ctrl+I',
        click(item: any, focusedWindow: Electron.BrowserWindow){
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

  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    show: false
  });

  // and load the index.html of the app.
  win.loadURL('file://' + __dirname + '/index.html');

  // Emitted when the window is closed.
  win.on('closed', () => {
    app.quit();
  });

  win.once('ready-to-show', function(){
    if(options.storageDir != "") {
      win.webContents.send('storage:valueset', options.storageDir);
      logger.log(LOG_LEVEL.INFO, options.storageDir);
    }
    win.show();
  });

  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  Menu.setApplicationMenu(mainMenu);
}

try {

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createWindow);

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });

  ipcMain.on('set:storage', function (){
    logger.log(LOG_LEVEL.DEBUG, "Open storage selection dialog");
    dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    }, function (folder: any){
      logger.log(LOG_LEVEL.DEBUG, "Set storage = %s", folder[0]);
      options.storageDir = folder[0];
      store.set('options', options);
      win.webContents.send('storage:valueset', folder[0]);
    })
  });
  ipcMain.on('set:import', function (){
    logger.log(LOG_LEVEL.DEBUG, "Open import folder selection dialog");
    dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    }, function (folder: any){
      logger.log(LOG_LEVEL.DEBUG, "Import directory %s", folder[0]);
      win.webContents.send('import:valueset', folder[0]);
      var importer: Importer = new Importer(options);
      importer.importPhotos(folder[0]);
    })
  });

} catch (e) {
  // Catch Error
  // throw e;
}
