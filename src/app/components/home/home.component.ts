import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../../providers/electron.service';
import { StorageInfo_IPC } from '../../model/Storage';
import { getIPCPhotoDate, getIPCPhotoPath } from '../../model/Photo';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  private electronService: ElectronService;
  private isStorageSelected: boolean;
  private storageInfo: StorageInfo_IPC;

  // This copies are needed for usage in template
  private getPhotoDate = getIPCPhotoDate;
  private getPhotoPath = getIPCPhotoPath;

  constructor(electronService: ElectronService) {
    this.electronService = electronService;
    this.isStorageSelected = false;
  }

  ngOnInit() {
    this.electronService.ipcRenderer.on('storage:valueset', (function(e, folder: string){
      this.isStorageSelected = true;
    }).bind(this));
    this.electronService.ipcRenderer.on('storage:loaded', (function(e, storageInfo: StorageInfo_IPC){
      this.storageInfo = storageInfo;
    }).bind(this));
    this.electronService.ipcRenderer.send('load:storage');
  }

  sendEvent(eventName: string) {
    this.electronService.ipcRenderer.send(eventName);
  }

}
