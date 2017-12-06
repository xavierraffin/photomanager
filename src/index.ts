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

const fs = require('fs');
const path = require('path');
const ExifImage = require('exif').ExifImage;
const md5 = require('md5');

const myArgs = process.argv.slice(2);
const importedFolder: string = myArgs[0];
const storageFolder: string = myArgs[1];

const options = { "deleteOriginal" : false,
                  "photoAcceptanceCriteria" : {
                    "fileSizeInBytes" : "15000",
                    "minExifImageHeight" : "300",
                    "minExifImageWidth" : "300",
                    "hasExifDate" : true,
                  }
                }

if (options.deleteOriginal)
  console.log("Original files will be deleted after transfer.");
else
  console.log("Original files will stay in place.");

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

// This array will contains Md5 for file with no EXIF data
var mutexLocked: number = 0;
var mutexMetadata: number = 0;

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
    console.log('file: %s already created by current import', newFile);
    return true;
  }
}

function copyFile(newFile: string,
                  buf: string,
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
  mutexLocked ++;

  createMissingDirIfNeeded(photoDate, storage);
  fs.stat(newFile, function(err: any, stat: any) {
     if ((err != null) && err.code == 'ENOENT') { //File does not exist

       addGlobalStats(photoDate, "", storage, dateCanBeTrusted);

       if(options.deleteOriginal) {
         mutexLocked ++;
         fs.rename(originalFile, newFile, function(err: any) {
            if (err) {
              console.log('ERROR renaming file: %s to %s: %s', originalFile, newFile, err);
            } else {
              console.log('file: %s imported to %s ', originalFile, newFile);
              import_stats.increment(photoDate, dateCanBeTrusted);
            }
            mutexLocked --;
         });
       } else { // keep original as is
         mutexLocked ++;
         fs.writeFile(newFile, buf , function(error: any){
           if(!error) {
              console.log("File %s copied from",newFile, originalFile);
              import_stats.increment(photoDate, dateCanBeTrusted);
           } else {
              console.log("ERROR copying file %s to %s: %s", originalFile, newFile, error);
           }
           mutexLocked --;
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
   mutexLocked --;
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

function moveInStorage(photoDate: Date, file: string, storage: string, dateCanBeTrusted: boolean = true): void {
  mutexLocked ++;
  fs.readFile(file, function(err: any, buf: string) {
     if(!err){
       const photoMD5: string = md5(buf);

       var newFile = fileNameInStorage(photoDate, photoMD5, storage);

       if (dateCanBeTrusted || isNotAlreadyImported(photoMD5, file, newFile)){
         copyFile(newFile, buf, file, photoMD5, storage, dateCanBeTrusted, photoDate);
       } else {
         import_stats.duplicates++;
         if(options.deleteOriginal) {
           fs.unlinkSync(file);
           console.log("Delete duplicate file %s", file);
         }
       }
     }
     mutexLocked --;
  });
}

function addGlobalStats(photoDate: Date, file: string, storage: string, dateCanBeTrusted: boolean = true){
  metadata.global_stats.increment(photoDate, dateCanBeTrusted);
}

function addMd5IfNoExif(photoDate: Date, file: string, storage: string, dateCanBeTrusted: boolean = true){
  if(dateCanBeTrusted)return;

  mutexLocked ++;
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
    mutexLocked --;
  });
}

interface addCallback { (photoDate: Date, file: string, storage: string, dateCanBeTrusted?: boolean) : void };

function loadObjectFromFile(storage: string, fileName: string, dataObjName: string, addMethod: addCallback) {
  const metadataFile = path.join(storage, fileName);
  try {
    var json_string: string = fs.readFileSync(metadataFile);
    console.log("Load metadata file %s", metadataFile);
    try {
      Object.assign(metadata[dataObjName], JSON.parse(json_string));
    } catch(e) {
      console.log("File is corrupted delete it and recreate: error=%s", e);
      fs.unlinkSync(metadataFile);
      loadObjectFromFile(storage, fileName, dataObjName, addMethod);
    }
  } catch(e) {
    console.log("%s metadata does not exist: recreate it by a scan", metadataFile);
    scanDir(storage, "", addMethod, true);
  }
}

function loadGlobalstat(storage: string): void {
  loadObjectFromFile(storage, ".do-not-delete-stat.js", "global_stats", addGlobalStats);
}

function loadWeakDateMd5(storage: string): void {
  loadObjectFromFile(storage, ".do-not-delete-md5.js", "weakDateMd5", addMd5IfNoExif);
}

function printImportStats(): void {
  if(mutexMetadata == 0){
    console.log("========= Imported results =========");
    import_stats.displayStats();
    console.log("========== Total Storage ==========");
    metadata.global_stats.displayStats();
  } else {
    //console.log("mutexMetadata = %s wait 500ms", mutexMetadata);
    setTimeout(function () {printImportStats();}, 500);
  }
}

function saveMetadata(storage: string, fileName: string, dataObjName: string): void {
  if(mutexLocked == 0){
    const metadataFile: string = path.join(storage, fileName);
    var json_string: string = JSON.stringify(metadata[dataObjName]);
    fs.writeFile(metadataFile, json_string , function(err: any){
      if(err) {
         console.log("Error saving metadata %s", metadataFile);
      } else {
         console.log("metadata %s saved", metadataFile);
      }
      mutexMetadata--;
    });
  } else {
    //console.log("Mutex = %s wait 500ms", mutexLocked);
    setTimeout(function () {saveMetadata(storage, fileName, dataObjName);}, 500);
  }
}

function saveGlobalstat(storage: string): void {
  mutexMetadata++;
  saveMetadata(storage, ".do-not-delete-stat.js", "global_stats");
}

function saveWeakDateMd5(storage: string): void {
  mutexMetadata++;
  saveMetadata(storage, ".do-not-delete-md5.js", "weakDateMd5");
}

interface operationCallback { (photoDate: Date, file: string, storage: string, dateCanBeTrusted?: boolean) : void };

function scanDir(folder: string, storage: string, operationOnPhotoFiles: operationCallback, isStatScan: boolean): void {
  mutexLocked ++;
  fs.readdir(folder, (err: any, files: string[]) => {
    if (err) {
      console.log("Unable to read directory " + folder);
      mutexLocked --;
      return;
    }

    files.map(function (file) {
       return path.join(folder, file);
    }).forEach(file => {
       try{
         fs.lstat(file, (err: any, fileStat: any) => {
         if(!err){
         if(fileStat.isFile()){
           if(isPhoto(file)){
              if(!isStatScan && (fileStat["size"] < options.photoAcceptanceCriteria.fileSizeInBytes)) {
                console.log("%s file size %s is smaller than %s : EXCLUDE PHOTO", file, fileStat["size"], options.photoAcceptanceCriteria.fileSizeInBytes);
                return;
              }
              new ExifImage({ image : file }, function (err: any, exifData: any) {
                if(!err){
                   //console.log("------------------------------------ %s", file);
                   //console.log(exifData);
                   if(("exif" in exifData) && ("ExifImageWidth" in exifData.exif) && ("ExifImageHeight" in exifData.exif)){
                     if (!isStatScan &&
                            ((options.photoAcceptanceCriteria.minExifImageWidth > exifData.exif.ExifImageWidth) ||
                             (options.photoAcceptanceCriteria.minExifImageHeight > exifData.exif.ExifImageHeight))) {
                           console.log("file %s is smaller than %s x %s : EXCLUDE PHOTO",
                                        file,
                                        options.photoAcceptanceCriteria.minExifImageWidth,
                                        options.photoAcceptanceCriteria.minExifImageHeight);
                           return;
                         }
                   }
                   if(("exif" in exifData) && ("CreateDate" in exifData.exif)){
                     const photoDate: Date = dateFromExif(exifData.exif.CreateDate);
                     operationOnPhotoFiles(photoDate, file, storage);
                   } else if(("image" in exifData) && ("ModifyDate" in exifData.image)) {
                     const photoDate: Date = dateFromExif(exifData.image.ModifyDate);
                     operationOnPhotoFiles(photoDate, file, storage);
                   } else {
                     if(isStatScan || !options.photoAcceptanceCriteria.hasExifDate) {
                       operationOnPhotoFiles(fileStat.ctime, file, storage, false);
                     } else {
                       console.log("file %s has no EXIF date : EXCLUDE PHOTO", file);
                     }
                   }
                } else {
                  if(isStatScan || !options.photoAcceptanceCriteria.hasExifDate) {
                    operationOnPhotoFiles(fileStat.ctime, file, storage, false);
                  } else {
                    console.log("file %s has no EXIF data : EXCLUDE PHOTO", file);
                  }
                }
              });
           }
         } else if(fileStat.isDirectory()) {
              if(!fileStat.isSymbolicLink())
                scanDir(file, storage, operationOnPhotoFiles, isStatScan);
         }
       }
       });
       } catch(e){}
    });
    mutexLocked --;
  });
}

loadGlobalstat(storageFolder);
if(!options.photoAcceptanceCriteria.hasExifDate) {
  loadWeakDateMd5(storageFolder);
}

scanDir(importedFolder, storageFolder, moveInStorage, false);

if(!options.photoAcceptanceCriteria.hasExifDate) {
  saveWeakDateMd5(storageFolder);
}
saveGlobalstat(storageFolder);

printImportStats();
