/*
    This file is part of Photomanager.

    Foobar is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Photomanager is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Foobar.  If not, see <http://www.gnu.org/licenses/>.

    Xavier Raffin - 2017
 */

var fs = require('graceful-fs');
const path = require('path');
const ExifImage = require('exif').ExifImage;
const md5 = require('md5');

import * as calculator from "./utils/jpeg-calculator";
import { StepLauncher } from "./utils/StepLauncher";
import { stepFunction } from "./utils/StepLauncher";
import { Logger, LOG_LEVEL } from "./utils/Logger";
import { formatDateSafe, dateFromExif } from "./utils/DateTime";

const myArgs = process.argv.slice(2);
const importedFolder: string = myArgs[0];
const storageFolder: string = myArgs[1];

const options = { "deleteOriginal" : false,
                  "tags" : {
                    "createFromDirName" : true,
                    "numberOfDirDepth" : 2
                  },
                  "photoAcceptanceCriteria" : {
                    "fileSizeInBytes" : "15000",
                    "minExifImageHeight" : "300",
                    "minExifImageWidth" : "300",
                    "hasExifDate" : false,
                  }
                }
var logger: Logger = new Logger(LOG_LEVEL.DEBUG);

if (options.deleteOriginal)
  logger.log(LOG_LEVEL.INFO, "Original files will be deleted after transfer.");
else
  logger.log(LOG_LEVEL.INFO, "Original files will stay in place.");

// Maximum buffer size, with a default of 200 megabytes.
var MaxBufferSize = 200*1024*1024;

class BaseStats {
  protected photos: number = 0;
  protected with_exif: number = 0;
  protected without_exif: number = 0;

  /*
   * These two functions are static because of the JSON loading who do not reload base class methods
   */
  protected static increment(instance: BaseStats, hasexif: boolean){
    if(hasexif) instance.with_exif++;
    else instance.without_exif++;
    instance.photos++;
  }
  protected static displayStats(instance: BaseStats) : string {
    return instance.photos + " (exif:" + instance.with_exif + " noexif:" + instance.without_exif + ")";
  }
}

var tags: { [tagName: string] : string[]; } = {};

class GlobalStats extends BaseStats {
  private byYear: { [year: number] : BaseStats; } = {};

  public increment(photoDate: Date, hasexif: boolean){
    // Increment base
    BaseStats.increment(this, hasexif);
    // Increment specific year
    var year: number = photoDate.getFullYear();
    if(typeof this.byYear[year] == 'undefined') {
      this.byYear[year] = new BaseStats();
    }
    BaseStats.increment(this.byYear[year], hasexif);
  }

  public displayStats(): void {
    console.log("TOTAL: %s", BaseStats.displayStats(this));
    for (var year in this.byYear) {
      // check if the property/key is defined in the object itself, not in parent
      if (this.byYear.hasOwnProperty(year)) {
        console.log(" - %s : %s ", year, BaseStats.displayStats(this.byYear[year]));
      }
    }
  }
}

class ImportStats extends GlobalStats {
  public duplicates: number = 0;
  public displayStats(): void {
    console.log("Duplicates photos: %s", this.duplicates);
    super.displayStats();
  }
}

class Metadata {
  public weakDateMd5: { [md5: string] : string; } = {};
  public global_stats: GlobalStats = new GlobalStats();
  [key: string]: any;
}

var metadata: Metadata = new Metadata();

var import_stats: ImportStats = new ImportStats();

function isPhoto(file: string) : boolean {
  const extension: string = path.extname(file);
  if((path.extname(file) == ".jpg") || (extension == ".jpeg") || (extension == ".JPG") || (extension == ".JPEG"))
  {
    return true;
  }
  return false;
}

var importedFiles: any = {};

function isFileAlreadyImported(newFile: string) : boolean {
  if(typeof importedFiles[newFile] == 'undefined') {
    importedFiles[newFile] = true;
    return false;
  } else {
    logger.log(LOG_LEVEL.INFO, "file %s already created by current import", newFile);
    return true;
  }
}

function copyFile(newFile: string,
                  buffer: Buffer,
                  originalFile: string,
                  originalMd5: string,
                  storage: string,
                  dateCanBeTrusted: boolean,
                  photoDate: Date) : void {
  /*
   * We check if this file has already been imported in the current import operation (avoid IO race condition)
   */
  if(isFileAlreadyImported(newFile)) {
    import_stats.duplicates++;
    return;
  }
  createMissingDirIfNeeded(photoDate, storage);

  stepLauncher.takeMutex();
  fs.stat(newFile, function(err: any, stat: any) {
     if ((err != null) && err.code == 'ENOENT') { //File does not exist

       addGlobalStats(photoDate, dateCanBeTrusted);

       if(options.deleteOriginal) {
         stepLauncher.takeMutex();
         fs.rename(originalFile, newFile, function(err: any) {
            if (err) {
              logger.log(LOG_LEVEL.ERROR, "error renaming file: %s to %s: %s", originalFile, newFile, err);
            } else {
              logger.log(LOG_LEVEL.INFO, "file %s imported to %s", originalFile, newFile);
              import_stats.increment(photoDate, dateCanBeTrusted);
            }
            stepLauncher.releaseMutex();
         });
       } else { // keep original as is
         stepLauncher.takeMutex();
         fs.writeFile(newFile, buffer, "binary", function(error: any){
           if(!error) {
              logger.log(LOG_LEVEL.INFO, "file %s copied from %s",newFile, originalFile);
              import_stats.increment(photoDate, dateCanBeTrusted);
           } else {
              logger.log(LOG_LEVEL.ERROR, "error copying file %s to %s: %s", originalFile, newFile, error);
           }
           stepLauncher.releaseMutex();
         });
       }
   } else { // New file exit
     import_stats.duplicates++;
     if(options.deleteOriginal) {
       //TODO : optionnaly check md5 ?
       fs.unlinkSync(originalFile);
       logger.log(LOG_LEVEL.INFO, "delete duplicate file %s",originalFile);
     }
   }
   stepLauncher.releaseMutex();
  });
}

function createMissingDirIfNeeded(photoDate: Date, storage: string): void {
  var photoPath: string;
  var year: number = photoDate.getFullYear();
  var month: number = photoDate.getMonth() + 1;

  photoPath = path.join(storage, year.toString());
  createIfNotExist(photoPath);
  photoPath = path.join(photoPath, month.toString());
  createIfNotExist(photoPath);
}

function createIfNotExist(dirPath: string): void {
  var dirExist: boolean = false;
  try {
    fs.mkdirSync(dirPath);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
    else {
      dirExist = true;
    }
  }
  //if(!dirExist)
  //  logger.log(LOG_LEVEL.INFO, "Create directory %s ", dirPath);
}

function isNotAlreadyImported(md5: string, file: string, newFile: string ): boolean {
  if(options.photoAcceptanceCriteria.hasExifDate) {
    return false;
  }
  if(typeof metadata["weakDateMd5"][md5] == 'undefined') {
    logger.log(LOG_LEVEL.DEBUG, "This is a new Md5 add weakDateMd5[%s]=%s", md5, newFile);
    metadata["weakDateMd5"][md5] = newFile;
    return true;
  } else {
    logger.log(LOG_LEVEL.WARNING, "Duplicate Md5 %s between file %s and file %s", md5, file, newFile);
    return false;
  }
}

function fileNameInStorage(photoDate: Date, photoMD5: string, storage: string) {
  var photoPath: string;
  var year: number = photoDate.getFullYear();
  var month: number = photoDate.getMonth() + 1;

  photoPath = path.join(storage, year.toString());
  photoPath = path.join(photoPath, month.toString());

  const newFileName: string = formatDateSafe(photoDate)+ "_" + photoMD5 + ".jpg";
  return path.join(photoPath, newFileName);
}

function createTags(file: string, newFile: string, rootFolder: string) {

  var relativePath: string = path.relative(rootFolder, file);
  var pathSections: string[] = relativePath.split(path.sep);

  // Loop backward on path and create tags for file from
  // each folder encountered
  var tagDirDepth = 1;
  if(pathSections.length < 2) return;
  for(var i: number = pathSections.length - 2 ; i >= 0 ; i--) {
    if(options.tags.numberOfDirDepth < tagDirDepth ) break;
    tagDirDepth++;
    var folderName = pathSections[i];
    if(typeof tags[folderName] == 'undefined') {
      logger.log(LOG_LEVEL.INFO, "New tag found '%s'", folderName);
      tags[folderName] = [];
    }
    if(tags[folderName].indexOf(newFile) === -1) { // Do not insert twice
      tags[folderName].push(newFile);
      logger.log(LOG_LEVEL.DEBUG, "add %s on tag %s", newFile, folderName);
    }
  }

}

function moveInStorage(photoDate: Date,
                       file: string,
                       storage: string,
                       dateCanBeTrusted: boolean,
                       needToFilterOnSize: boolean,
                       fileSize: number,
                       descriptor: number,
                       rootFolder: string): void {
  stepLauncher.takeMutex();

  var bufferSize = Math.min(fileSize, MaxBufferSize);
  var buffer = new Buffer(bufferSize);

  fs.read(descriptor, buffer, 0, bufferSize, 0, function(err: any, fileBytesSize: string, buffer: Buffer) {
     fs.close(descriptor, function (err: any) {});
     if(!err){
       const photoMD5: string = md5(buffer);

       var newFile = fileNameInStorage(photoDate, photoMD5, storage);

       if(needToFilterOnSize) {
         logger.log(LOG_LEVEL.DEBUG, "We need to calculate size from file %s", file);
         // If size was not in exif, we must filter file acceptance based on JPEG 'real' size
         if( !calculator.sizeIsOverLimits(buffer,
                               Number(options.photoAcceptanceCriteria.minExifImageWidth),
                               Number(options.photoAcceptanceCriteria.minExifImageHeight))) {
           stepLauncher.releaseMutex();
           buffer = null;
           logger.log(LOG_LEVEL.DEBUG, "file %s is to small", file);
           // File is not taking account into our statistics because it is not a valid photo
           return;
         }
       }

       if(options.tags.createFromDirName)
       {
          createTags(file, newFile, rootFolder);
       }

       if (dateCanBeTrusted || isNotAlreadyImported(photoMD5, file, newFile)){
         copyFile(newFile, buffer, file, photoMD5, storage, dateCanBeTrusted, photoDate);
       } else {
         import_stats.duplicates++;
         if(options.deleteOriginal) {
           fs.unlinkSync(file);
           logger.log(LOG_LEVEL.WARNING, "Delete duplicate file %s", file);
         }
       }
     }
     stepLauncher.releaseMutex();
     buffer = null;
  });
}

function addGlobalStats(photoDate: Date, dateCanBeTrusted: boolean){
  metadata.global_stats.increment(photoDate, dateCanBeTrusted);
}

function storeMd5(file: string){
  stepLauncher.takeMutex();
  fs.readFile(file, function(err: any, buf: string) {
    if(!err){
      const photoMD5: string = md5(buf);
      if(typeof metadata["weakDateMd5"][photoMD5] == 'undefined') {
        metadata["weakDateMd5"][photoMD5] = file;
        logger.log(LOG_LEVEL.DEBUG, "New scan result weakDateMd5[%s] = %s", photoMD5, metadata["weakDateMd5"][photoMD5]);
      } else {
        if(options.deleteOriginal) {
          logger.log(LOG_LEVEL.WARNING, "Duplicate Md5 %s - remove %s in storage", photoMD5, file);
          fs.unlinkSync(file);
        }
      }
    }
    stepLauncher.releaseMutex();
  });
}

function loadObjectFromFile(storage: string, fileName: string, dataObjName: string) : boolean {
  const metadataFile = path.join(storage, fileName);
  try {
    var json_string: string = fs.readFileSync(metadataFile);
    logger.log(LOG_LEVEL.INFO, "Load metadata file %s", metadataFile);
    try {
      Object.assign(metadata[dataObjName], JSON.parse(json_string));
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

function scanTagDir(folder: string): void {
  stepLauncher.takeMutex();
  fs.readdir(folder, (err: any, files: string[]) => {
    if (err) {
      logger.log(LOG_LEVEL.WARNING, "Unable to read TAG directory %s", folder);
      stepLauncher.releaseMutex();
      return;
    }
    logger.log(LOG_LEVEL.INFO, "Load TAGS from %s", folder);

    files.forEach(tagName => {
      var file: string = path.join(folder, tagName);
      stepLauncher.takeMutex();
      fs.lstat(file, function (err: any, fileStat: any) {
        if(!err){
          if(fileStat.isFile()){
            stepLauncher.takeMutex();
            logger.log(LOG_LEVEL.INFO, "Load TAG %s",file);
            fs.readFile(file, function(err: any, buf: string) {
               if(err){
                 logger.log(LOG_LEVEL.ERROR, "Unable to read TAG file %s",file);
                 stepLauncher.releaseMutex();
                 return;
               }
               tags[tagName] = [];
               Object.assign(tags[tagName], JSON.parse(buf));
               stepLauncher.releaseMutex();
             });
           }
         }
         stepLauncher.releaseMutex();
       });
    });
    stepLauncher.releaseMutex();
  });
}

function loadTags(storage: string, tagfolder: string): void {
  if(options.tags.createFromDirName) {
    const tagfolderPath: string = path.join(storage, tagfolder);
    fs.exists(tagfolderPath, function (exists: boolean) {
      if(!exists){
        logger.log(LOG_LEVEL.INFO, "Create tag folder %s", tagfolderPath);
        try {
          fs.mkdirSync(tagfolderPath);
        } catch (err) {
          logger.log(LOG_LEVEL.ERROR, "Cannot create folder %s: %s", tagfolderPath, err);
          throw err;
        }
      } else {
        scanTagDir(tagfolderPath);
      }
    });
  }
}

function loadMetadata(storage: string): void {
  loadTags(storage, "TAGS");
  var needRescanStats: boolean = loadObjectFromFile(storage, ".do-not-delete-stat.js", "global_stats");
  var needRescanMd5: boolean = false;
  if(!options.photoAcceptanceCriteria.hasExifDate) {
    needRescanMd5 = loadObjectFromFile(storage, ".do-not-delete-md5.js", "weakDateMd5");
  }
  if (needRescanStats || needRescanMd5) {
    logger.log(LOG_LEVEL.WARNING, "Missing metadata recreate them by a scan");
    scanStorageDir(storage, needRescanStats, needRescanMd5);
  }
}

function printImportStats(): void {
  console.log("\n========= Imported results =========\n");
  import_stats.displayStats();
  console.log("\n========== Total Storage ==========\n");
  metadata.global_stats.displayStats();
}

function saveMetadataFile(storage: string, fileName: string, dataObjName: string): void {
  const metadataFile: string = path.join(storage, fileName);
  var json_string: string = JSON.stringify(metadata[dataObjName]);
  stepLauncher.takeMutex();;
  fs.writeFile(metadataFile, json_string , function(err: any){
    if(err) {
       logger.log(LOG_LEVEL.ERROR, "error saving metadata %s", metadataFile);
    } else {
       logger.log(LOG_LEVEL.INFO, "metadata %s saved", metadataFile);
    }
    stepLauncher.releaseMutex();;
  });
}

function saveTagFiles(storage: string, tagFolder: string): void {
  const tagPath: string = path.join(storage, tagFolder);
  for (var tagName in tags) {
    stepLauncher.takeMutex();;
    const tagFile: string = path.join(tagPath, tagName);
    var json_string: string = JSON.stringify(tags[tagName]);
    fs.writeFile(tagFile, json_string , function(err: any){
      if(err) {
         logger.log(LOG_LEVEL.ERROR, "error saving tag file %s", tagFile);
      } else {
         logger.log(LOG_LEVEL.INFO, "tag file %s saved", tagFile);
      }
      stepLauncher.releaseMutex();;
    });
  }
}

function saveMetadata(storage: string): void {
  saveMetadataFile(storage, ".do-not-delete-stat.js", "global_stats");
  if(!options.photoAcceptanceCriteria.hasExifDate) {
    saveMetadataFile(storage, ".do-not-delete-md5.js", "weakDateMd5");
  }
  if(options.tags.createFromDirName) {
    saveTagFiles(storage, "TAGS");
  }
}

function scanStorageDir(folder: string, needRescanStats: boolean, needRescanMd5: boolean): void {
  stepLauncher.takeMutex();
  fs.readdir(folder, (err: any, files: string[]) => {
    if (err) {
      logger.log(LOG_LEVEL.ERROR, "Unable to read directory %s", folder);
      stepLauncher.releaseMutex();
      return;
    }

    files.map(function (file) {
       return path.join(folder, file);
    }).forEach(file => {
       try{
         stepLauncher.takeMutex();
         fs.lstat(file, (err: any, fileStat: any) => {
         if(!err) {
           if(fileStat.isFile()){
             if(isPhoto(file)){
                logger.log(LOG_LEVEL.DEBUG, "Scan file %s", folder);
                stepLauncher.takeMutex();
                new ExifImage({ image : file }, function (err: any, exifData: any) {
                  if(!err){
                     if(("exif" in exifData) && ("CreateDate" in exifData.exif)){
                       if(needRescanStats) {
                         const photoDate: Date = dateFromExif(exifData.exif.CreateDate);
                         addGlobalStats(photoDate, true);
                       }
                     } else if(("image" in exifData) && ("ModifyDate" in exifData.image)) {
                       if(needRescanStats) {
                         const photoDate: Date = dateFromExif(exifData.image.ModifyDate);
                         addGlobalStats(photoDate, true);
                       }
                     } else {
                       if(needRescanStats) addGlobalStats(fileStat.ctime, false);
                       if(needRescanMd5) storeMd5(file);
                     }
                  } else {
                    if(needRescanStats) addGlobalStats(fileStat.ctime, false);
                    if(needRescanMd5) storeMd5(file);
                  }
                  stepLauncher.releaseMutex();
                });
             }
           } else if(fileStat.isDirectory()) {
                if(!fileStat.isSymbolicLink())
                  scanStorageDir(file, needRescanStats, needRescanMd5);
           }
         }
         stepLauncher.releaseMutex();
       });
       } catch(e){}
    });
    stepLauncher.releaseMutex();
  });
}

function scanDir(folder: string, storage: string, rootfolder: string): void {
  stepLauncher.takeMutex();
  fs.readdir(folder, (err: any, files: string[]) => {
    if (err) {
      logger.log(LOG_LEVEL.ERROR, "Unable to read directory %s", folder);
      stepLauncher.releaseMutex();
      return;
    }

    files.map(function (file) {
       return path.join(folder, file);
    }).forEach(file => {
       try{
          stepLauncher.takeMutex();
          fs.lstat(file, function (err: any, fileStat: any) {
            if(!err){
              if(fileStat.isFile()){
                if(isPhoto(file)){
                var imageSize: number = fileStat["size"];
                if(imageSize < Number(options.photoAcceptanceCriteria.fileSizeInBytes)) {
                  logger.log(LOG_LEVEL.INFO, "%s file size %s is smaller than %s : EXCLUDE PHOTO", file, fileStat["size"], options.photoAcceptanceCriteria.fileSizeInBytes);
                  stepLauncher.releaseMutex();
                  return;
                }
                stepLauncher.takeMutex();
                new ExifImage({ image : file }, function (err: any, exifData: any) {
                  var imageSizeWasntChecked: boolean = true;
                  if(!err) {
                     logger.log(LOG_LEVEL.VERBOSE_DEBUG, "------------------------------------ %s", file);
                     logger.log(LOG_LEVEL.VERBOSE_DEBUG, JSON.stringify(exifData));
                     if(("exif" in exifData) && ("ExifImageWidth" in exifData.exif) && ("ExifImageHeight" in exifData.exif)){
                       if ((options.photoAcceptanceCriteria.minExifImageWidth > exifData.exif.ExifImageWidth)
                           || (options.photoAcceptanceCriteria.minExifImageHeight > exifData.exif.ExifImageHeight)) {
                         /*logger.log(LOG_LEVEL.INFO, "file %s is smaller than %s x %s : EXCLUDE PHOTO",
                                      file,
                                      options.photoAcceptanceCriteria.minExifImageWidth,
                                      options.photoAcceptanceCriteria.minExifImageHeight);*/
                         stepLauncher.releaseMutex();
                         return;
                       } else {
                         imageSizeWasntChecked = false;
                       }
                     }
                     logger.log(LOG_LEVEL.DEBUG, "Read file %s", file);
                     stepLauncher.takeMutex();
                     fs.open(file, 'r', function (err: any, descriptor: number) {
                       if (err) {
                         logger.log(LOG_LEVEL.ERROR, "Cannot open file %s : %s", file , err);
                         stepLauncher.releaseMutex();
                         return;
                       }
                       if(("exif" in exifData) && ("CreateDate" in exifData.exif)){
                         const photoDate: Date = dateFromExif(exifData.exif.CreateDate);
                         moveInStorage(photoDate, file, storage, true, imageSizeWasntChecked, imageSize, descriptor, rootfolder);
                       } else if(("image" in exifData) && ("ModifyDate" in exifData.image)) {
                         const photoDate: Date = dateFromExif(exifData.image.ModifyDate);
                         moveInStorage(photoDate, file, storage, true, imageSizeWasntChecked, imageSize, descriptor, rootfolder);
                       } else {
                         if(!options.photoAcceptanceCriteria.hasExifDate) {
                           moveInStorage(fileStat.ctime, file, storage, false, imageSizeWasntChecked, imageSize, descriptor, rootfolder);
                         } else {
                           logger.log(LOG_LEVEL.INFO, "file %s has no EXIF date : EXCLUDE PHOTO", file);
                           fs.close(descriptor, function (err: any) {});
                         }
                       }
                       stepLauncher.releaseMutex();
                   });
                  } else {
                    if(!options.photoAcceptanceCriteria.hasExifDate) {
                      stepLauncher.takeMutex();
                      fs.open(file, 'r', function (err: any, descriptor: number) {
                        if (err) {
                          logger.log(LOG_LEVEL.ERROR, "Cannot open file %s : %s", file , err);
                          stepLauncher.releaseMutex();
                          return;
                        }
                        moveInStorage(fileStat.ctime, file, storage, false, imageSizeWasntChecked, imageSize, descriptor, rootfolder);
                        stepLauncher.releaseMutex();
                      });
                    } else {
                      logger.log(LOG_LEVEL.INFO, "file %s has no EXIF data : EXCLUDE PHOTO", file);;
                    }
                  }
                  stepLauncher.releaseMutex();
                });
              }
              } else if(fileStat.isDirectory()) {
                if(!fileStat.isSymbolicLink())
                  scanDir(file, storage, rootfolder);
              }
            }
            stepLauncher.releaseMutex();
          });
        } catch(e){}
      });
    stepLauncher.releaseMutex();
  });
}

var stepLauncher: StepLauncher = new StepLauncher();

stepLauncher.addStep(function () {
  loadMetadata(storageFolder);
});

stepLauncher.addStep(function () {
  scanDir(importedFolder, storageFolder, importedFolder);
});

stepLauncher.addStep(function () {
  saveMetadata(storageFolder);
});

stepLauncher.addStep(function () {
  printImportStats();
});

stepLauncher.start();
