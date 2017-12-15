import * as path from 'path';
import * as fs from 'fs';

import { Logger, LOG_LEVEL } from "../utils/Logger";

var logger: Logger = new Logger(LOG_LEVEL.INFO);

export function createDirIfNotExist(dirPath: string): void {
  var dirExist: boolean = false;
  try {
    fs.mkdirSync(dirPath);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
    else {
      dirExist = true;
    }
  }
  if(!dirExist)
    logger.log(LOG_LEVEL.INFO, "Create directory %s ", dirPath);
}

export function isPhoto(file: string) : boolean {
  const extension: string = path.extname(file);
  if((extension == ".jpg") || (extension == ".jpeg") || (extension == ".JPG") || (extension == ".JPEG"))
  {
    return true;
  }
  return false;
}
