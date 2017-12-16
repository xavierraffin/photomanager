const path = require('path');
const fs = require('fs');

const { Logger, LOG_LEVEL } = require("../utils/Logger");
var logger = new Logger(LOG_LEVEL.INFO);

exports.createDirIfNotExist = function (dirPath) {
  var dirExist = false;
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

exports.isPhoto = function(file)  {
  const extension = path.extname(file);
  if((extension == ".jpg") || (extension == ".jpeg") || (extension == ".JPG") || (extension == ".JPEG"))
  {
    return true;
  }
  return false;
}
