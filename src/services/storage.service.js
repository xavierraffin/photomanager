//const ElectronService = require('./electron.service');
const { getIPCPhotoDate, getIPCPhotoPath } = require('../model/Photo');
const electron = window.require('electron');
const fs = electron.remote.require('fs');
const ipcRenderer  = electron.ipcRenderer;

class StorageService {

  static instance;

  constructor(app){
  console.log("StorageService constructor");
    if(!(typeof instance === "undefined")){
      /*global instance:true*/
      console.log("yooop");
      return instance;
    }

    this.instance = this;

    //this.electron = new ElectronService();
    this.app = app;
    this.count = 0;
    this.isStorageSelected = false;
    this.isStorageLoaded = false;
    this.storage = null;

    this.registerSyncEvents();

  }

  registerSyncEvents(){

    ipcRenderer.on('storage:loaded', (function(e, storageInfo){
      console.log("Received storage %s", storageInfo.dir)
      console.log("Received storage chunk = %s", storageInfo.chunck[0].w)
      this.isStorageLoaded = true;
      this.storage = storageInfo;
      this.count++;
      this.app.setState({ storage : storageInfo});
    }).bind(this));

    ipcRenderer.on('storage:selected', (function(e, storageInfo){
      this.isStorageSelected = true;
    }).bind(this));

    ipcRenderer.on('import:progress', (function(e, percent){
      this.app.setImportProgress(percent);
    }).bind(this));

    // We send this event to ask Electron to provide storageInfo
    ipcRenderer.send('load:storage');
    console.log("Listenner ok, ask for storage");
  }

  selectImportFolder() {
    ipcRenderer.send('set:import');
    console.log("Ask for import folder");
  }

  getPhotoDate(s) {
    return getIPCPhotoDate(s);
  }

  getPhotoPath(s) {
    return this.info.dir + getIPCPhotoPath(s);
  }
}

export default StorageService;
