import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../../providers/electron.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  private electronService: ElectronService;

  constructor(electronService: ElectronService) {
    this.electronService = electronService;
  }

  ngOnInit() {
  }

  sendEvent(eventName: string) {
    this.electronService.ipcRenderer.send(eventName);
  }

}
