import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';
import { getIPCPhotoDate, getIPCPhotoPath } from '../model/Photo';
import { StorageInfo_IPC } from '../model/Storage';

@Injectable()
export class StorageService {

  private electron: ElectronService;
  public isStorageSelected: boolean;
  public isStorageLoaded: boolean;
  public storageInfo: StorageInfo_IPC;

  // This copies are needed for usage in template
  //private getPhotoDate = getIPCPhotoDate;
  //private getPhotoPath = getIPCPhotoPath;

  constructor(electron: ElectronService) {
    this.electron = electron;
    this.isStorageSelected = false;
    this.isStorageLoaded = false;
    this.electron.ipcRenderer.on('storage:loaded', (function(e, storageInfo: StorageInfo_IPC){
      this.isStorageLoaded = true;
      this.storageInfo = storageInfo;
    }).bind(this));
    this.electron.ipcRenderer.on('storage:selected', (function(e, storageInfo: StorageInfo_IPC){
      this.isStorageSelected = true;
    }).bind(this));
    // We send this event to ask Electron to provide storageInfo
    this.electron.ipcRenderer.send('load:storage');
  }

  public getPhotoDate(s: string) {
    return getIPCPhotoDate(s);
  }

  public getPhotoPath(s: string) {
    return getIPCPhotoPath(s);
  }





}
