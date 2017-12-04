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
const photoFolder = myArgs[0];
const storageFolder = myArgs[1];

var metadata = new Object();

// This array will contains Md5 for file with no EXIF data
metadata["weakDateMd5"] = new Object();
var mutexLocked = 0;
var mutexMetadata = 0;

var import_stats = {
  "new_photos" : 0,
  "new_with_exif" : 0,
  "new_without_exif" : 0,
  "duplicates" : 0,
  "byYear" : {}
}
metadata["global_stats"] = new Object();

const options = { "deleteOriginal" : true }

if (options.deleteOriginal)
  console.log("deleteOriginal = true");
else
  console.log("deleteOriginal = false");

function isPhoto(file){
  const extension = path.extname(file);
  if((path.extname(file) == ".jpg") || (extension == ".jpeg") || (extension == ".JPG") || (extension == ".JPEG"))
  {
    return true;
  }
  return false;
}

function dateFromExif(exifDate){
  var DateTime = exifDate.split(" ");
  var dateParts = DateTime[0].split(":");
  var timeParts = DateTime[1].split(":");
  return new Date(dateParts[0], (dateParts[1] - 1), dateParts[2], timeParts[0], timeParts[1], timeParts[2]);
}

function formatDate(photoDate){
  return photoDate.toISOString().substring(0, 19);
}

function copyFile(newFile, buf, originalFile, originalMd5, storage, dateCanBeTrusted, photoDate){

  mutexLocked ++;
  fs.stat(newFile, function(err, stat) {
     if ((err != null) && err.code == 'ENOENT') { //File does not exist

       addGlobalStats(photoDate, "", storage, dateCanBeTrusted);
       import_stats.new_photos++;
       if(dateCanBeTrusted)
         import_stats.new_with_exif++;
       else
         import_stats.new_without_exif++;

       if(options.deleteOriginal) {
         mutexLocked ++;
         fs.rename(originalFile, newFile, function(err) {
            if (err) console.log('ERROR renaming file: %s to %s: %s', originalFile, newFile, err);
            else console.log('file: %s imported to %s ', originalFile, newFile);
            mutexLocked --;
         });
       } else { // keep original as is
         mutexLocked ++;
         fs.writeFile(newFile, buf , function(error){
           if(!error) {
              console.log("File %s copied from",newFile, originalFile);
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

function createIfNotExist(dirPath){
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
    console.log("Create directory %s ", dirPath);
}

function isNotAlreadyImported(md5, file){
  if(typeof metadata["weakDateMd5"][md5] == 'undefined') {
    console.log("This is a new Md5 add weakDateMd5[%s]=%s", md5, file);
    metadata["weakDateMd5"][md5] = file;
    return true;
  } else {
    console.log("Duplicate Md5 %s from file %s", md5, file);
    return false;
  }
}

function moveInStorage(photoDate, file, storage, dateCanBeTrusted = true){
  mutexLocked ++;
  fs.readFile(file, function(err, buf) {
     if(!err){
       const photoMD5 = md5(buf);

       if (dateCanBeTrusted || isNotAlreadyImported(photoMD5, file)){
         var photoPath;

         year = photoDate.getFullYear();
         photoPath = path.join(storage, year.toString());
         createIfNotExist(photoPath);

         month = photoDate.getMonth() + 1;
         photoPath = path.join(photoPath, month.toString());
         createIfNotExist(photoPath);

         const newFileName = formatDate(photoDate)+ "_" + photoMD5 + ".jpg";
         var newFile = path.join(photoPath, newFileName);
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

function addGlobalStats(photoDate, file, storage, dateCanBeTrusted = true){

  var year = photoDate.getFullYear();

  if(typeof metadata.global_stats.byYear[year] == 'undefined') {
    metadata.global_stats.byYear[year] = {};
    metadata.global_stats.byYear[year].photos = 0;
    metadata.global_stats.byYear[year].with_exif = 0;
    metadata.global_stats.byYear[year].without_exif = 0;
  }

  metadata.global_stats.photos++;
  metadata.global_stats.byYear[year].photos++;

  if(dateCanBeTrusted) {
    metadata.global_stats.with_exif++;
    metadata.global_stats.byYear[year].with_exif++;
  } else {
    metadata.global_stats.without_exif++;
    metadata.global_stats.byYear[year].without_exif++;
  }
}

function addMd5IfNoExif(photoDate, file, storage, dateCanBeTrusted = true){
  if(dateCanBeTrusted)return;

  mutexLocked ++;
  fs.readFile(file, function(err, buf) {
    if(!err){
      const photoMD5 = md5(buf);
      if(typeof metadata["weakDateMd5"][photoMD5] == 'undefined') {
        metadata["weakDateMd5"][photoMD5] = file;
        console.log("New scan result weakDateMd5[%s] = %s", photoMD5, metadata["weakDateMd5"][photoMD5]);
      } else {
        console.log("Duplicate Md5 %s - remove %s in storage", photoMD5, file);
        fs.unlinkSync(file);
      }
    }
    mutexLocked --;
  });
}

function loadObjectFromFile(storage, fileName, dataObjName, addMethod) {
  const metadataFile = path.join(storage, fileName);
  try {
    var json_string = fs.readFileSync(metadataFile);
    console.log("Load metadata file %s", metadataFile);
    try {
      metadata[dataObjName] = JSON.parse(json_string);
    } catch(e) {
      console.log("File is corrupted delete it and recreate: error=%s", e);
      fs.unlinkSync(metadataFile);
      loadObjectFromFile(storage, fileName, dataObjName, addMethod);
    }
  } catch(e) {
    console.log("%s metadata does not exist: recreate it by a scan", metadataFile);
    scanDir(storage, "", addMethod);
    // This is a save to avoid rescan
    mutexMetadata++;
    saveMetadata(storage, fileName, dataObjName);
  }
}

function loadGlobalstat(storage) {
  metadata.global_stats.photos = 0;
  metadata.global_stats.with_exif = 0;
  metadata.global_stats.without_exif = 0;
  metadata.global_stats.byYear = {};
  loadObjectFromFile(storage, ".do-not-delete-stat.js", "global_stats", addGlobalStats);
}

function loadWeakDateMd5(storage) {
  loadObjectFromFile(storage, ".do-not-delete-md5.js", "weakDateMd5", addMd5IfNoExif);
}

function printImportStats() {
  if(mutexMetadata == 0){
    console.log("Imported photos", import_stats.new_photos);
    console.log("Duplicates photos", import_stats.duplicates);
    console.log("New total number of photos", metadata["global_stats"].photos);
  } else {
    //console.log("mutexMetadata = %s wait 500ms", mutexMetadata);
    setTimeout(function () {printImportStats();}, 500);
  }
}

function saveMetadata(storage, fileName, dataObjName) {
  if(mutexLocked == 0){
    const metadataFile = path.join(storage, fileName);
    var json_string = JSON.stringify(metadata[dataObjName]);
    fs.writeFile(metadataFile, json_string , function(err){
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

function saveGlobalstat(storage) {
  mutexMetadata++;
  saveMetadata(storage, ".do-not-delete-stat.js", "global_stats");
}

function saveWeakDateMd5(storage) {
  mutexMetadata++;
  saveMetadata(storage, ".do-not-delete-md5.js", "weakDateMd5");
}

function scanDir(folder, storage, operationOnPhotoFiles) {
  mutexLocked ++;
  fs.readdir(folder, (err, files) => {
    if (err) {
      console.log("Unable to read directory " + folder);
      mutexLocked --;
      return;
    }

    files.map(function (file) {
       return path.join(folder, file);
    }).forEach(file => {
       try{
         fs.lstat(file, (err, fileStat) => {
         if(!err){
         if(fileStat.isFile()){
           if(isPhoto(file)){
              new ExifImage({ image : file }, function (err, exifData) {
                if(!err){
                   if(("exif" in exifData) && ("CreateDate" in exifData.exif)){
                     const photoDate = dateFromExif(exifData.exif.CreateDate);
                     operationOnPhotoFiles(photoDate, file, storage);
                   } else if(("image" in exifData) && ("ModifyDate" in exifData.image)) {
                     const photoDate = dateFromExif(exifData.image.ModifyDate);
                     operationOnPhotoFiles(photoDate, file, storage);
                   } else {
                     operationOnPhotoFiles(fileStat.ctime, file, storage, false);
                   }
                } else {
                  operationOnPhotoFiles(fileStat.ctime, file, storage, false);
                }
              });
           }
         } else if(fileStat.isDirectory()) {
              if(!fileStat.isSymbolicLink())
                scanDir(file, storage, operationOnPhotoFiles);
         }
       }
       });
       } catch(e){}
    });
    mutexLocked --;
  });
}

loadGlobalstat(storageFolder);
loadWeakDateMd5(storageFolder);

scanDir(photoFolder, storageFolder, moveInStorage);

saveWeakDateMd5(storageFolder);
saveGlobalstat(storageFolder);

printImportStats();
