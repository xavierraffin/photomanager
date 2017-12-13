import { app, BrowserWindow, screen, ipcMain } from 'electron';
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

function createWindow() {

  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height
  });

  // and load the index.html of the app.
  win.loadURL('file://' + __dirname + '/index.html');

  // Open the DevTools.
  if (serve) {
    win.webContents.openDevTools();
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    app.quit();
  });
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
  logger.log(LOG_LEVEL.INFO,"Receive set:storage event");
    app.quit();
  });

} catch (e) {
  // Catch Error
  // throw e;
}
