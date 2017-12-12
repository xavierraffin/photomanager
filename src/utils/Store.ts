const electron = require('electron');
const path = require('path');
const fs = require('fs');

import { Logger, LOG_LEVEL } from "./Logger";
var logger: Logger = new Logger(LOG_LEVEL.DEBUG);

// From https://codeburst.io/how-to-store-user-data-in-electron-3ba6bf66bc1e

class Store {
  private path: string;
  private data: any;

  constructor(defaults: any) {
    // Renderer process has to get `app` module via `remote`, whereas the main process can get it directly
    // app.getPath('userData') will return a string of the user's app data directory path.
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    // We'll use the `configName` property to set the file name and path.join to bring it all together as a string
    this.path = path.join(userDataPath, 'photomanager.json');
    this.data = parseDataFile(this.path, defaults);
  }

  // This will just return the property on the `data` object
  get(key:string):any {
    return this.data[key];
  }

  // ...and this will set it
  set(key: string, val: any): void {
    this.data[key] = val;
    // Wait, I thought using the node.js' synchronous APIs was bad form?
    // We're not writing a server so there's not nearly the same IO demand on the process
    // Also if we used an async API and our app was quit before the asynchronous write had a chance to complete,
    // we might lose that data. Note that in a real app, we would try/catch this.
    logger.log(LOG_LEVEL.DEBUG, "Save settings file %s", this.path);
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
}

function parseDataFile(filePath: string, defaults: any): any {
  // We'll try/catch it in case the file doesn't exist yet, which will be the case on the first application run.
  // `fs.readFileSync` will return a JSON string which we then parse into a Javascript object
  try {
    logger.log(LOG_LEVEL.DEBUG, "Try to read app settings file %s", filePath);
    return JSON.parse(fs.readFileSync(filePath));
  } catch(error) {
    // if there was some kind of error, return the passed in defaults instead.
    logger.log(LOG_LEVEL.DEBUG, "Settings file %s does not exist, return", filePath);
    return defaults;
  }
}


export { Store };
