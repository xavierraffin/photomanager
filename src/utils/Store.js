const electron = require('electron');
const path = require('path');
const fs = require('fs');

const LOG = require('./Logger');
var logger = new LOG.Logger(LOG.LEVEL.DEBUG);

// From https://codeburst.io/how-to-store-user-data-in-electron-3ba6bf66bc1e

module.exports = class Store {
  constructor(defaults) {
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    this.path = path.join(userDataPath, 'photomanager.json');
    this.data = parseDataFile(this.path, defaults);
    logger.log(LOG.LEVEL.DEBUG, "Load settings from file %s", this.path);
  }

  get(key) {
    return this.data[key];
  }

  set(key, val) {
    this.data[key] = val;
    logger.log(LOG.LEVEL.DEBUG, "Save settings file %s", this.path);
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
}

function parseDataFile(filePath, defaults) {
  try {
    logger.log(LOG.LEVEL.DEBUG, "Try to read app settings file %s", filePath);
    return JSON.parse(fs.readFileSync(filePath));
  } catch(error) {
    // if there was some kind of error, return the passed in defaults instead.
    logger.log(LOG.LEVEL.DEBUG, "Settings file %s does not exist, return", filePath);
    return defaults;
  }
}
