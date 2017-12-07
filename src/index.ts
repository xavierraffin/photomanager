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

if (options.deleteOriginal)
  console.log("Original files will be deleted after transfer.");
else
  console.log("Original files will stay in place.");

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

function dateFromExif(exifDate: string) : Date {
  var DateTime: string[] = exifDate.split(" ");
  var dateParts: string[] = DateTime[0].split(":");
  var timeParts: string[] = DateTime[1].split(":");
  return new Date( Number(dateParts[0]),
                   Number(dateParts[1]) - 1,
                   Number(dateParts[2]),
                   Number(timeParts[0]),
                   Number(timeParts[1]),
                   Number(timeParts[2]));
}

function formatDate(photoDate: Date) : string {
  return photoDate.toISOString().substring(0, 19);
}

var importedFiles: any = {};

function isFileAlreadyImported(newFile: string) : boolean {
  if(typeof importedFiles[newFile] == 'undefined') {
    importedFiles[newFile] = true;
    return false;
  } else {
    //console.log('file: %s already created by current import', newFile);
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
              console.log('ERROR renaming file: %s to %s: %s', originalFile, newFile, err);
            } else {
              console.log('file: %s imported to %s ', originalFile, newFile);
              import_stats.increment(photoDate, dateCanBeTrusted);
            }
            stepLauncher.releaseMutex();
         });
       } else { // keep original as is
         stepLauncher.takeMutex();
         fs.writeFile(newFile, buffer, "binary", function(error: any){
           if(!error) {
              console.log("File %s copied from",newFile, originalFile);
              import_stats.increment(photoDate, dateCanBeTrusted);
           } else {
              console.log("ERROR copying file %s to %s: %s", originalFile, newFile, error);
           }
           stepLauncher.releaseMutex();
         });
       }
   } else { // New file exit
     import_stats.duplicates++;
     if(options.deleteOriginal) {
       //TODO : optionnaly check md5 ?
       fs.unlinkSync(originalFile);
       console.log("Delete duplicate file %s",originalFile);
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
  if(!dirExist)
    console.log("Create directory %s ", dirPath);
}

function isNotAlreadyImported(md5: string, file: string, newFile: string ): boolean {
  if(options.photoAcceptanceCriteria.hasExifDate) {
    return false;
  }
  if(typeof metadata["weakDateMd5"][md5] == 'undefined') {
    console.log("This is a new Md5 add weakDateMd5[%s]=%s", md5, newFile);
    metadata["weakDateMd5"][md5] = newFile;
    return true;
  } else {
    console.log("Duplicate Md5 %s between file %s and file %s", md5, file, newFile);
    return false;
  }
}

function fileNameInStorage(photoDate: Date, photoMD5: string, storage: string) {
  var photoPath: string;
  var year: number = photoDate.getFullYear();
  var month: number = photoDate.getMonth() + 1;

  photoPath = path.join(storage, year.toString());
  photoPath = path.join(photoPath, month.toString());

  const newFileName: string = formatDate(photoDate)+ "_" + photoMD5 + ".jpg";
  return path.join(photoPath, newFileName);
}

function moveInStorage(photoDate: Date, file: string, storage: string, dateCanBeTrusted: boolean, needToFilterOnSize: boolean, fileSize: number, descriptor: number): void {
  stepLauncher.takeMutex();

  var bufferSize = Math.min(fileSize, MaxBufferSize);
  var buffer = new Buffer(bufferSize);

  fs.read(descriptor, buffer, 0, bufferSize, 0, function(err: any, fileBytesSize: string, buffer: Buffer) {
     fs.close(descriptor, function (err: any) {});
     if(!err){
       const photoMD5: string = md5(buffer);

       var newFile = fileNameInStorage(photoDate, photoMD5, storage);

       if(needToFilterOnSize) {
         console.log("We need to calculate size from file %s", file);
         // If size was not in exif, we must filter file acceptance based on JPEG 'real' size
         if( !calculator.sizeIsOverLimits(buffer,
                               Number(options.photoAcceptanceCriteria.minExifImageWidth),
                               Number(options.photoAcceptanceCriteria.minExifImageHeight))) {
           stepLauncher.releaseMutex();
           buffer = null;
           console.log("file %s is to small", file);
           // File is not taking account into our statistics because it is not a valid photo
           return;
         }
       }

       if (dateCanBeTrusted || isNotAlreadyImported(photoMD5, file, newFile)){
         copyFile(newFile, buffer, file, photoMD5, storage, dateCanBeTrusted, photoDate);
       } else {
         import_stats.duplicates++;
         if(options.deleteOriginal) {
           fs.unlinkSync(file);
           console.log("Delete duplicate file %s", file);
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
        console.log("New scan result weakDateMd5[%s] = %s", photoMD5, metadata["weakDateMd5"][photoMD5]);
      } else {
        if(options.deleteOriginal) {
          console.log("Duplicate Md5 %s - remove %s in storage", photoMD5, file);
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
    console.log("Load metadata file %s", metadataFile);
    try {
      Object.assign(metadata[dataObjName], JSON.parse(json_string));
    } catch(e) {
      console.log("Metadata file %s is corrupted delete it and recreate: error=%s", fileName, e);
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
      console.log("Unable to read TAG directory " + folder);
      stepLauncher.releaseMutex();
      return;
    }

    files.map(function (file) {
      return path.join(folder, file);
    }).forEach(file => {
      stepLauncher.takeMutex();
      fs.readFile(file, function(err: any, buf: string) {
         if(err){
           console.log("Unable to read TAG file " + file);
           stepLauncher.releaseMutex();
           return;
         }
         Object.assign(tags[file], JSON.parse(buf));
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
        console.log("Create tag folder %s", tagfolderPath);
        try {
          fs.mkdirSync(tagfolderPath);
        } catch (err) {
          console.log("Cannot create folder %s: ERROR %s", tagfolderPath, err);
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
    console.log("Missing metadata recreate them by a scan");
    scanStorageDir(storage, needRescanStats, needRescanMd5);
  }
}

function printImportStats(): void {
  console.log("========= Imported results =========");
  import_stats.displayStats();
  console.log("========== Total Storage ==========");
  metadata.global_stats.displayStats();
}

function saveMetadataFile(storage: string, fileName: string, dataObjName: string): void {
  const metadataFile: string = path.join(storage, fileName);
  var json_string: string = JSON.stringify(metadata[dataObjName]);
  stepLauncher.takeMutex();;
  fs.writeFile(metadataFile, json_string , function(err: any){
    if(err) {
       console.log("Error saving metadata %s", metadataFile);
    } else {
       console.log("metadata %s saved", metadataFile);
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
         console.log("Error saving tag file %s", tagFile);
      } else {
         console.log("Tag file %s saved", tagFile);
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
      console.log("Unable to read directory " + folder);
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

function scanDir(folder: string, storage: string): void {
  stepLauncher.takeMutex();
  fs.readdir(folder, (err: any, files: string[]) => {
    if (err) {
      console.log("Unable to read directory " + folder);
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
                  console.log("%s file size %s is smaller than %s : EXCLUDE PHOTO", file, fileStat["size"], options.photoAcceptanceCriteria.fileSizeInBytes);
                  stepLauncher.releaseMutex();
                  return;
                }
                stepLauncher.takeMutex();
                new ExifImage({ image : file }, function (err: any, exifData: any) {
                  var imageSizeWasntChecked: boolean = true;
                  if(!err) {
                     //console.log("------------------------------------ %s", file);
                     //console.log(exifData);
                     if(("exif" in exifData) && ("ExifImageWidth" in exifData.exif) && ("ExifImageHeight" in exifData.exif)){
                       if ((options.photoAcceptanceCriteria.minExifImageWidth > exifData.exif.ExifImageWidth)
                           || (options.photoAcceptanceCriteria.minExifImageHeight > exifData.exif.ExifImageHeight)) {
                         console.log("file %s is smaller than %s x %s : EXCLUDE PHOTO",
                                      file,
                                      options.photoAcceptanceCriteria.minExifImageWidth,
                                      options.photoAcceptanceCriteria.minExifImageHeight);
                         stepLauncher.releaseMutex();
                         return;
                       } else {
                         imageSizeWasntChecked = false;
                       }
                     }
                     stepLauncher.takeMutex();
                     fs.open(file, 'r', function (err: any, descriptor: number) {
                       if (err) {
                         console.log("Cannot open file %s : %s", file , err);
                         stepLauncher.releaseMutex();
                         return;
                       }
                       if(("exif" in exifData) && ("CreateDate" in exifData.exif)){
                         const photoDate: Date = dateFromExif(exifData.exif.CreateDate);
                         moveInStorage(photoDate, file, storage, true, imageSizeWasntChecked, imageSize, descriptor);
                       } else if(("image" in exifData) && ("ModifyDate" in exifData.image)) {
                         const photoDate: Date = dateFromExif(exifData.image.ModifyDate);
                         moveInStorage(photoDate, file, storage, true, imageSizeWasntChecked, imageSize, descriptor);
                       } else {
                         if(!options.photoAcceptanceCriteria.hasExifDate) {
                           moveInStorage(fileStat.ctime, file, storage, false, imageSizeWasntChecked, imageSize, descriptor);
                         } else {
                           console.log("file %s has no EXIF date : EXCLUDE PHOTO", file);
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
                          console.log("Cannot open file %s : %s", file , err);
                          stepLauncher.releaseMutex();
                          return;
                        }
                        moveInStorage(fileStat.ctime, file, storage, false, imageSizeWasntChecked, imageSize, descriptor);
                        stepLauncher.releaseMutex();
                      });
                    } else {
                      console.log("file %s has no EXIF data : EXCLUDE PHOTO", file);;
                    }
                  }
                  stepLauncher.releaseMutex();
                });
              }
              } else if(fileStat.isDirectory()) {
                if(!fileStat.isSymbolicLink())
                  scanDir(file, storage);
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
  scanDir(importedFolder, storageFolder);
});

stepLauncher.addStep(function () {
  saveMetadata(storageFolder);
});

stepLauncher.addStep(function () {
  printImportStats();
});

stepLauncher.start();
