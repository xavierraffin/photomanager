/*
    This file is part of PhotoManager.

    PhotoManager is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    PhotoManager is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Foobar.  If not, see <http://www.gnu.org/licenses/>.

    Xavier Raffin - 2017
 */

import * as path from 'path';
import * as md5 from 'md5';
import * as fs from 'fs';

import { PhotoInfo_IPC, getNameFromFileName, getIPCPhotoDate } from "./Photo";
import { GlobalStats } from "./Statistics";
import { JpegParser, JpegResult } from "../utils/JpegParser";
import { StepLauncher, stepFunction } from "../schedulers/StepLauncher";
import { TaskExecutor, Task } from "../schedulers/TaskExecutor";
import { Logger, LOG_LEVEL } from "../utils/Logger";
import { formatDateSafe, dateFromExif } from "../utils/DateTime";
import { isPhoto, createDirIfNotExist } from "../utils/FileSystem";

var logger: Logger = new Logger(LOG_LEVEL.VERBOSE_DEBUG);

// This super compact class is used to exchange data
// Between Electron main process and renderer process
export class StorageInfo_IPC {
  photosNbr: number = 0;
  years: number[] = [];
  tags: string[] = [];
  dir: string = "";
  chunck: PhotoInfo_IPC[] = [];
}

class Metadata {
  public weakDateMd5: { [md5: string] : string; } = {};
  public global_stats: GlobalStats = new GlobalStats();
  [key: string]: any;
}

export class Storage {
  private storageInfo: StorageInfo_IPC;
  private executor: TaskExecutor;
  private stepLauncher: StepLauncher;
  private metadata: Metadata;
  private tags: { [tagName: string] : string[]; };
  private options: any;
  private loadCallback: (StorageInfo_IPC) => void;

  constructor (options: any) {
    this.stepLauncher = new StepLauncher();
    this.executor = new TaskExecutor(20, this.stepLauncher);
    this.storageInfo = new StorageInfo_IPC();
    this.storageInfo.dir = options.storageDir;
    this.metadata = new Metadata();
    this.tags = {};
    this.options = options;
  }

  public getInfo_IPC(): StorageInfo_IPC {
    return this.storageInfo;
  }

  public load(callback: (StorageInfo_IPC) => void): void {
    this.loadCallback = callback;

    this.stepLauncher.addStep("loadMetadata", this);
    this.stepLauncher.addStep("startExecutor", this);
    this.stepLauncher.addStep("saveMetadata", this);
    this.stepLauncher.addStep("callLoadCallback", this);

    this.stepLauncher.start();
  }

  private callLoadCallback() {
    this.loadCallback(this.storageInfo);
  }

  public startExecutor(){
    this.executor.start();
  }

  private loadMetadata(): void {
    logger.log(LOG_LEVEL.DEBUG, "Loading metadata from %s", this.storageInfo.dir);
    this.loadTags("TAGS");
    var needRescanStats: boolean = this.loadObjectFromFile(".do-not-delete-stat.js", this.metadata["global_stats"]);
    var needRescanIPC: boolean = this.loadObjectFromFile(".do-not-delete-storageIPC.js", this.storageInfo);
    var needRescanMd5: boolean = false;
    if(!this.options.photoAcceptanceCriteria.hasExifDate) {
      needRescanMd5 = this.loadObjectFromFile(".do-not-delete-md5.js", this.metadata["global_stats"]);
    }
    if (needRescanStats || needRescanMd5 || needRescanIPC) {
      logger.log(LOG_LEVEL.WARNING, "Missing metadata recreate them by a scan (%s/%s/%s)", needRescanStats, needRescanMd5, needRescanIPC);
      this.scanStorageDir(this.storageInfo.dir, needRescanStats, needRescanMd5, needRescanIPC);
    }
  }

  private loadTags(tagfolder: string): void {
    if(this.options.tags.createFromDirName) {
      const tagfolderPath: string = path.join(this.storageInfo.dir, tagfolder);
      fs.exists(tagfolderPath, (function (exists: boolean) {
        if(!exists){
          logger.log(LOG_LEVEL.INFO, "Create tag folder %s", tagfolderPath);
          createDirIfNotExist(tagfolderPath);
        } else {
          this.scanTagDir(tagfolderPath);
        }
      }).bind(this));
    }
  }

  private loadObjectFromFile(fileName: string, data: any) : boolean {
    const metadataFile = path.join(this.storageInfo.dir, fileName);
    try {
      var json_string: string = fs.readFileSync(metadataFile).toString();
      logger.log(LOG_LEVEL.INFO, "Load metadata file %s", metadataFile);
      try {
        (<any>Object).assign(data, JSON.parse(json_string));
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


  private saveMetadataFile(fileName: string, data: any): void {
    const metadataFile: string = path.join(this.storageInfo.dir, fileName);
    var json_string: string = JSON.stringify(data);
    this.stepLauncher.takeMutex();;
    fs.writeFile(metadataFile, json_string , (function(err: any){
      if(err) {
         logger.log(LOG_LEVEL.ERROR, "error saving metadata %s", metadataFile);
      } else {
         logger.log(LOG_LEVEL.INFO, "metadata %s saved", metadataFile);
      }
      this.stepLauncher.releaseMutex();;
    }).bind(this));
  }

  private saveTagFiles(tagFolder: string): void {
    const tagPath: string = path.join(this.storageInfo.dir, tagFolder);
    for (var tagName in this.tags) {
      this.stepLauncher.takeMutex();
      const tagFile: string = path.join(tagPath, tagName);
      var json_string: string = JSON.stringify(this.tags[tagName]);
      fs.writeFile(tagFile, json_string , (function(err: any){
        if(err) {
           logger.log(LOG_LEVEL.ERROR, "error saving tag file %s", tagFile);
        } else {
           logger.log(LOG_LEVEL.INFO, "tag file %s saved", tagFile);
        }
        this.stepLauncher.releaseMutex();;
      }).bind(this));
    }
  }

  private saveMetadata(): void {
    this.saveMetadataFile(".do-not-delete-stat.js", this.metadata["global_stats"]);
    this.saveMetadataFile(".do-not-delete-storageIPC.js", this.storageInfo);
    if(!this.options.photoAcceptanceCriteria.hasExifDate) {
      this.saveMetadataFile(".do-not-delete-md5.js", this.metadata["weakDateMd5"]);
    }
    if(this.options.tags.createFromDirName) {
      this.saveTagFiles("TAGS");
    }
  }


  private scanTagDir(folder: string): void {
    this.stepLauncher.takeMutex();
    fs.readdir(folder, (err: any, files: string[]) => {
      if (err) {
        logger.log(LOG_LEVEL.WARNING, "Unable to read TAG directory %s", folder);
        this.stepLauncher.releaseMutex();
        return;
      }
      logger.log(LOG_LEVEL.INFO, "Load TAGS from %s", folder);

      files.forEach(tagName => {
        var file: string = path.join(folder, tagName);
        this.stepLauncher.takeMutex();
        fs.lstat(file, (function (err: any, fileStat: any) {
          if(!err){
            if(fileStat.isFile()){
              this.stepLauncher.takeMutex();
              logger.log(LOG_LEVEL.INFO, "Load TAG %s",file);
              fs.readFile(file, (function(err: any, buf: string) {
                 if(err){
                   logger.log(LOG_LEVEL.ERROR, "Unable to read TAG file %s",file);
                   this.stepLauncher.releaseMutex();
                   return;
                 }
                 this.tags[tagName] = [];
                 (<any>Object).assign(this.tags[tagName], JSON.parse(buf));
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

  private scanStorageDir(folder: string, needRescanStats: boolean, needRescanMd5: boolean, needRescanIPC: boolean): void {
    this.stepLauncher.takeMutex();
    fs.readdir(folder, ((err: any, files: string[]) => {
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
           fs.lstat(file, ((err: any, fileStat: any) => {
           if(!err) {
             if(fileStat.isFile()){
               if(isPhoto(file)){
                 var imageSize: number = fileStat["size"];
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

  private scanFile(folder: string,
                   needRescanStats: boolean,
                   needRescanMd5: boolean,
                   needRescanIPC: boolean,
                   file: string,
                   fileSystemDate: Date,
                   imageSize: number
                 ) {
    logger.log(LOG_LEVEL.DEBUG, "Scan file %s", folder);
    this.executor.taskExecutionStart();
    this.stepLauncher.takeMutex();
    fs.readFile(file, (function(err: any, buffer: Buffer) {
       if(!err){
        var jpegParser: JpegParser = new JpegParser(this.options, file)
        var photoAttributes: JpegResult = jpegParser.parse(buffer);

        const photoDate: Date = photoAttributes.hasExifDate ? dateFromExif(photoAttributes.exifDate) : fileSystemDate;
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
          const photoMD5: string = md5(buffer);
          this.storeMd5(file, photoMD5);
        }
      } else {
         logger.log(LOG_LEVEL.ERROR, "Cannot read file %s", file);
      }
      this.executor.taskExecutionFinish();
      this.stepLauncher.releaseMutex();
    }).bind(this));
  }

  private addPhotoIPC(height: number, width: number, file: string, size: number){
    logger.log(LOG_LEVEL.DEBUG, "addPhotoIPC %s", file);
    var newPhoto: PhotoInfo_IPC = {
      "w": width,
      "h": height,
      "s": Math.floor(size/1000), // Convert in ko
      "n": getNameFromFileName(file),
      "t": []
    }
    this.storageInfo.photosNbr++;
    logger.log(LOG_LEVEL.DEBUG, "photosNbr=%s, n=%s", this.storageInfo.photosNbr, newPhoto.n);
    var year: number = getIPCPhotoDate(newPhoto.n).getFullYear();
    if( typeof this.storageInfo.years [year] == 'undefined' ) {
      logger.log(LOG_LEVEL.DEBUG, "Add year %s", year);
      this.storageInfo.years.push(year);
    }
    this.storageInfo.chunck.push(newPhoto);
  }

  private addGlobalStats(photoDate: Date, dateCanBeTrusted: boolean){
    this.metadata.global_stats.increment(photoDate, dateCanBeTrusted);
  }

  private storeMd5(file: string, photoMD5: string){
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
