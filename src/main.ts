const path = require('path');
const url = require('url');

import {app, BrowserWindow, Menu, ipcMain} from 'electron';
import {Store} from './utils/Store';
import { Logger, LOG_LEVEL } from "./utils/Logger";

// SET ENV
//process.env.NODE_ENV = 'production';
process.env.NODE_ENV = 'development';
var logger: Logger = new Logger(LOG_LEVEL.DEBUG);

const store = new Store(
  {
    // 800x600 is the default size of our window
    'windowBounds': { 'width': 1024, 'height': 600 },
    'storageDir': '/nodefs'
  }
);

let mainWindow: BrowserWindow;

app.on('ready', function(){

  let { width, height  } = store.get('windowBounds');
  logger.log(LOG_LEVEL.DEBUG, "Create window of %sx%s", width, height);
  mainWindow = new BrowserWindow({width, height, 'show': false});

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../resources/view/mainWindow.html'),
    protocol: 'file:',
    slashes: true
  }));


  mainWindow.once('ready-to-show', function(){
    mainWindow.webContents.send('folder:set', store.get('storageDir'));
    logger.log(LOG_LEVEL.INFO, store.get('storageDir'));
    mainWindow.show();
  });

  // Quit on cross
  mainWindow.on('closed', function(){
    app.quit();
  });

  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  Menu.setApplicationMenu(mainMenu);
});

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
