/*
    This file is part of PhotoManager.

    PhotoManager is free software: you can redistribute it and/or modify
    it under the terms of the GNU General License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    PhotoManager is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General License for more details.

    You should have received a copy of the GNU General License
    along with Foobar.  If not, see <http://www.gnu.org/licenses/>.

    Xavier Raffin - 2017
 */

const path = require('path');
const md5 = require('md5');
const fs = require('fs');

const { PhotoInfo_IPC, getNameFromFileName } = require("./Photo");
const { GlobalStats } = require("./Statistics");
const { JpegParser, JpegResult } = require("../utils/JpegParser");
const { StepLauncher, stepFunction } = require("../schedulers/StepLauncher");
const { TaskExecutor, Task } = require("../schedulers/TaskExecutor");
const { Logger, LOG_LEVEL } = require('../utils/Logger');
const { dateFromExif, getIPCPhotoDate } = require("../utils/DateTime");
const { isPhoto, createDirIfNotExist } = require("../utils/FileSystem");

var logger = new Logger(LOG_LEVEL.VERBOSE_DEBUG);

// This super compact class is used to exchange data
// Between Electron main process and renderer process
class StorageInfo_IPC {
  constructor() {
    this.photosNbr = 0;
    this.years = [];
    this.tags = [];
    this.dir = "";
    this.chunck = [];
  }
}
exports.StorageInfo_IPC = StorageInfo_IPC;

class Metadata {
  constructor() {
    this.weakDateMd5 = {};
    this.global_stats = new GlobalStats();
  }
}

exports.Storage = function (options) {

  this.stepLauncher = new StepLauncher();
  this.executor = new TaskExecutor(20, this.stepLauncher, function (a,b,c){});
  this.storageInfo = new StorageInfo_IPC();
  this.storageInfo.dir = options.storageDir;
  this.metadata = new Metadata();
  this.tags = {};
  this.options = options;
  this.loadCallback = null;

  this.getInfo_IPC = function() {
    return this.storageInfo;
  }

  this.load = function(callback) {
    this.loadCallback = callback;

    this.stepLauncher.addStep("loadMetadata", this);
    this.stepLauncher.addStep("startExecutor", this);
    this.stepLauncher.addStep("saveMetadata", this);
    this.stepLauncher.addStep("callLoadCallback", this);

    this.stepLauncher.start();
  }

  this.startExecutor = function() {
    this.executor.start();
  }

  /********** 'private' methods ************/

  this.callLoadCallback = function() {
    this.loadCallback(this.storageInfo);
  }

  this.loadMetadata = function() {
    logger.log(LOG_LEVEL.DEBUG, "Loading metadata from %s", this.storageInfo.dir);
    this.loadTags("TAGS");
    var needRescanStats = this.loadObjectFromFile(".do-not-delete-stat.js", this.metadata["global_stats"]);
    var needRescanIPC = this.loadObjectFromFile(".do-not-delete-storageIPC.js", this.storageInfo);
    var needRescanMd5 = false;
    if(!this.options.photoAcceptanceCriteria.hasExifDate) {
      needRescanMd5 = this.loadObjectFromFile(".do-not-delete-md5.js", this.metadata["global_stats"]);
    }
    if (needRescanStats || needRescanMd5 || needRescanIPC) {
      logger.log(LOG_LEVEL.WARNING, "Missing metadata recreate them by a scan (%s/%s/%s)", needRescanStats, needRescanMd5, needRescanIPC);
      this.scanStorageDir(this.storageInfo.dir, needRescanStats, needRescanMd5, needRescanIPC);
    }
  }

  this.loadTags = function(tagfolder) {
    if(this.options.tags.createFromDirName) {
      const tagfolderPath = path.join(this.storageInfo.dir, tagfolder);
      fs.exists(tagfolderPath, (function (exists) {
        if(!exists){
          logger.log(LOG_LEVEL.INFO, "Create tag folder %s", tagfolderPath);
          createDirIfNotExist(tagfolderPath);
        } else {
          this.scanTagDir(tagfolderPath);
        }
      }).bind(this));
    }
  }

  this.loadObjectFromFile = function(fileName, data)  {
    const metadataFile = path.join(this.storageInfo.dir, fileName);
    try {
      var json_string = fs.readFileSync(metadataFile).toString();
      logger.log(LOG_LEVEL.INFO, "Load metadata file %s", metadataFile);
      try {
        Object.assign(data, JSON.parse(json_string));
      } catch(e) {
        logger.log(LOG_LEVEL.WARNING, "Metadata file %s is corrupted delete it and recreate: error=%s", fileName, e);
        fs.unlinkSync(metadataFile);
        return true;
      }
    } catch(e) {
      return true;
    }
    return false;
  }


  this.saveMetadataFile = function(fileName, data) {
    const metadataFile = path.join(this.storageInfo.dir, fileName);
    var json_string = JSON.stringify(data);
    this.stepLauncher.takeMutex();
    fs.writeFile(metadataFile, json_string , (function(err){
      if(err) {
         logger.log(LOG_LEVEL.ERROR, "error saving metadata %s", metadataFile);
      } else {
         logger.log(LOG_LEVEL.INFO, "metadata %s saved", metadataFile);
      }
      this.stepLauncher.releaseMutex();;
    }).bind(this));
  }

  this.saveTagFiles = function(tagFolder) {
    const tagPath = path.join(this.storageInfo.dir, tagFolder);
    for (var tagName in this.tags) {
      this.stepLauncher.takeMutex();
      const tagFile = path.join(tagPath, tagName);
      var json_string = JSON.stringify(this.tags[tagName]);
      fs.writeFile(tagFile, json_string , (function(err){
        if(err) {
           logger.log(LOG_LEVEL.ERROR, "error saving tag file %s", tagFile);
        } else {
           logger.log(LOG_LEVEL.INFO, "tag file %s saved", tagFile);
        }
        this.stepLauncher.releaseMutex();
      }).bind(this));
    }
  }

  this.saveMetadata = function() {
    this.saveMetadataFile(".do-not-delete-stat.js", this.metadata["global_stats"]);
    this.saveMetadataFile(".do-not-delete-storageIPC.js", this.storageInfo);
    if(!this.options.photoAcceptanceCriteria.hasExifDate) {
      this.saveMetadataFile(".do-not-delete-md5.js", this.metadata["weakDateMd5"]);
    }
    if(this.options.tags.createFromDirName) {
      this.saveTagFiles("TAGS");
    }
  }


  this.scanTagDir = function(folder) {
    this.stepLauncher.takeMutex();
    fs.readdir(folder, (err, files) => {
      if (err) {
        logger.log(LOG_LEVEL.WARNING, "Unable to read TAG directory %s", folder);
        this.stepLauncher.releaseMutex();
        return;
      }
      logger.log(LOG_LEVEL.INFO, "Load TAGS from %s", folder);

      files.forEach(tagName => {
        var file = path.join(folder, tagName);
        this.stepLauncher.takeMutex();
        fs.lstat(file, (function (err, fileStat) {
          if(!err){
            if(fileStat.isFile()){
              this.stepLauncher.takeMutex();
              logger.log(LOG_LEVEL.INFO, "Load TAG %s",file);
              fs.readFile(file, (function(err, buf) {
                 if(err){
                   logger.log(LOG_LEVEL.ERROR, "Unable to read TAG file %s",file);
                   this.stepLauncher.releaseMutex();
                   return;
                 }
                 //this.tags[tagName] = [];
                 //Object.assign(this.tags[tagName], JSON.parse(buf));
                 this.tags[tagName] = JSON.parse(buf);

                 this.stepLauncher.releaseMutex();
               }).bind(this));
             }
           }
           this.stepLauncher.releaseMutex();
         }).bind(this));
      });
      this.stepLauncher.releaseMutex();
    });
  }

  this.scanStorageDir = function(folder, needRescanStats, needRescanMd5, needRescanIPC) {
    this.stepLauncher.takeMutex();
    fs.readdir(folder, ((err, files) => {
      if (err) {
        logger.log(LOG_LEVEL.ERROR, "Unable to read directory %s", folder);
        this.stepLauncher.releaseMutex();
        return;
      }

      files.map(function (file) {
         return path.join(folder, file);
      }).forEach(file => {
         try{
           this.stepLauncher.takeMutex();
           fs.lstat(file, ((err, fileStat) => {
           if(!err) {
             if(fileStat.isFile()){
               if(isPhoto(file)){
                 var imageSize = fileStat["size"];
                 this.executor.queueTask(this,
                                         "scanFile",
                                         folder,
                                         needRescanStats,
                                         needRescanMd5,
                                         needRescanIPC,
                                         file,
                                         fileStat.ctime,
                                         imageSize
                                       );
               }
             } else if(fileStat.isDirectory()) {
                  if(!fileStat.isSymbolicLink())
                    this.scanStorageDir(file, needRescanStats, needRescanMd5, needRescanIPC);
             }
           }
           this.stepLauncher.releaseMutex();
         }).bind(this));
         } catch(e){}
      });
      this.stepLauncher.releaseMutex();
    }).bind(this));
  }

  this.scanFile = function(folder,
                           needRescanStats,
                           needRescanMd5,
                           needRescanIPC,
                           file,
                           fileSystemDate,
                           imageSize
                         ) {
    logger.log(LOG_LEVEL.DEBUG, "Scan file %s", folder);
    this.executor.taskExecutionStart();
    this.stepLauncher.takeMutex();
    fs.readFile(file, (function(err, buffer) {
       if(!err){
        var jpegParser = new JpegParser(this.options, file)
        var photoAttributes = jpegParser.parse(buffer);

        const photoDate = photoAttributes.hasExifDate ? dateFromExif(photoAttributes.exifDate) : fileSystemDate;
        if(needRescanStats) {
          this.addGlobalStats(photoDate, photoAttributes.hasExifDate);
        }
        if(needRescanIPC) {
          this.addPhotoIPC(photoAttributes.height,
                           photoAttributes.width,
                           path.basename(file),
                           imageSize);
        }
        if(!photoAttributes.hasExifDate && needRescanMd5) {
          const photoMD5 = md5(buffer);
          this.storeMd5(file, photoMD5);
        }
      } else {
         logger.log(LOG_LEVEL.ERROR, "Cannot read file %s", file);
      }
      this.executor.taskExecutionFinish();
      this.stepLauncher.releaseMutex();
    }).bind(this));
  }

  this.addPhotoIPC = function(height, width, file, size){
    logger.log(LOG_LEVEL.DEBUG, "addPhotoIPC %s", file);
    var newPhoto = new PhotoInfo_IPC(
      width,
      height,
      Math.floor(size/1000), // Convert in ko
      getNameFromFileName(file),
      []
    );
    this.storageInfo.photosNbr++;
    logger.log(LOG_LEVEL.DEBUG, "photosNbr=%s, n=%s", this.storageInfo.photosNbr, newPhoto.n);
    var year = getIPCPhotoDate(newPhoto.n).getFullYear();
    if( typeof this.storageInfo.years [year] == 'undefined' ) {
      logger.log(LOG_LEVEL.DEBUG, "Add year %s", year);
      this.storageInfo.years.push(year);
    }
    this.storageInfo.chunck.push(newPhoto);
  }

  this.addGlobalStats = function(photoDate, dateCanBeTrusted){
    this.metadata.global_stats.increment(photoDate, dateCanBeTrusted);
  }

  this.storeMd5 = function(file, photoMD5){
    if(typeof this.metadata["weakDateMd5"][photoMD5] == 'undefined') {
      this.metadata["weakDateMd5"][photoMD5] = file;
      logger.log(LOG_LEVEL.DEBUG, "New scan result weakDateMd5[%s] = %s",
                 photoMD5,
                 this.metadata["weakDateMd5"][photoMD5]);
    } else {
      if(this.options.deleteOriginal) {
        logger.log(LOG_LEVEL.WARNING, "Duplicate Md5 %s - remove %s in storage", photoMD5, file);
        fs.unlinkSync(file);
      }
    }
  }
}
