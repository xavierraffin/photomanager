const electron = require('electron');
const path = require('path');
const url = require('url');

const {app, BrowserWindow, Menu, ipcMain} = electron;

// SET ENV
process.env.NODE_ENV = 'production';

let mainWindow;
let settingsWindow;

app.on('ready', function(){

  mainWindow = new BrowserWindow({});

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'mainWindow.html'),
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

function settings() {
  settingsWindow = new BrowserWindow({
    width: 300,
    height:200,
    title: 'settings'
  });

  settingsWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'settingsWindow.html'),
    protocol: 'file:',
    slashes: true
  }));
  // Garbage collection
  settingsWindow.on('closed', function(){
    settingsWindow = null;
  });
}

// Catch folder:settings
ipcMain.on('folder:set', function (e, folder){
  mainWindow.webContents.send('folder:set', folder);
  settingsWindow.close();
})

// menu
const mainMenuTemplate = [
  {
    label: 'File',
    submenu:[
      {
        label: 'settings',
        click(){
          settings();
        }
      },
      {
        label: 'add nawak',
        click(){
          mainWindow.webContents.send('folder:set', 'nawak');
        }
      },
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

// If mac add empty object to Menu
if(process.platform == 'darwin') {
  mainMenuTemplate.unshift({});
}

// Add dev tools
if(process.env.NODE_ENV !== 'production'){
  mainMenuTemplate.push({
    label: 'Dev',
    submenu:[
      {
        label: 'Open dev tools',
        accelerator: process.platform == 'darwin' ? 'Command+I' : 'Ctrl+I',
        click(item, focusedWindow){
          focusedWindow.toggleDevTools();
        }
      },
      {
        role: 'reload',
        accelerator: 'F5'
      }
    ]
  })
}
