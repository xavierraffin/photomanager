const path = require('path');
const url = require('url');

import {app, BrowserWindow, Menu, ipcMain} from 'electron';

// SET ENV
//process.env.NODE_ENV = 'production';
process.env.NODE_ENV = 'development';

let mainWindow: BrowserWindow;

app.on('ready', function(){

  mainWindow = new BrowserWindow({});
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../resources/view/mainWindow.html'),
    protocol: 'file:',
    slashes: true
  }));

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
