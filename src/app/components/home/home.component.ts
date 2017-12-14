import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../../providers/electron.service';
import { StorageService } from '../../providers/storage.service';
import { StorageInfo_IPC } from '../../model/Storage';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  private electronService: ElectronService;
  private storageService: StorageService;

  constructor(electronService: ElectronService, storageService: StorageService) {
    this.electronService = electronService;
    this.storageService = storageService;
  }

  ngOnInit() {
  }

  sendEvent(eventName: string) {
    this.electronService.ipcRenderer.send(eventName);
  }

}
