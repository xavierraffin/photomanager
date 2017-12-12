const electron = require('electron');
const path = require('path');
const fs = require('fs');

import { Logger, LOG_LEVEL } from "./Logger";
var logger: Logger = new Logger(LOG_LEVEL.DEBUG);

// From https://codeburst.io/how-to-store-user-data-in-electron-3ba6bf66bc1e

export class Store {
  private path: string;
  private data: any;

  constructor(defaults: any) {
    // Renderer process has to get `app` module via `remote`, whereas the main process can get it directly
    // app.getPath('userData') will return a string of the user's app data directory path.
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    this.path = path.join(userDataPath, 'photomanager.json');
    this.data = parseDataFile(this.path, defaults);
    logger.log(LOG_LEVEL.DEBUG, "Load settings from file %s", this.path);
  }

  get(key:string):any {
    return this.data[key];
  }

  set(key: string, val: any): void {
    this.data[key] = val;
    logger.log(LOG_LEVEL.DEBUG, "Save settings file %s", this.path);
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
}

function parseDataFile(filePath: string, defaults: any): any {
  try {
    logger.log(LOG_LEVEL.DEBUG, "Try to read app settings file %s", filePath);
    return JSON.parse(fs.readFileSync(filePath));
  } catch(error) {
    // if there was some kind of error, return the passed in defaults instead.
    logger.log(LOG_LEVEL.DEBUG, "Settings file %s does not exist, return", filePath);
    return defaults;
  }
}
