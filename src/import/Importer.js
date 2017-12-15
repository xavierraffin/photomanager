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

const path = require('path');
const md5 = require('md5');
const fs = require('fs');

import { ImportStats } from "../model/Statistics";
import { JpegParser, JpegResult } from "../utils/JpegParser";
import { StepLauncher, stepFunction } from "../schedulers/StepLauncher";
import { TaskExecutor, Task } from "../schedulers/TaskExecutor";
import { Logger, LOG_LEVEL } from "../utils/Logger";
import { formatDateSafe, dateFromExif } from "../utils/DateTime";
import { isPhoto, createDirIfNotExist } from "../utils/FileSystem";

var logger: Logger = new Logger(LOG_LEVEL.VERBOSE_DEBUG);

export class Importer {

  private executor: TaskExecutor;
  private stepLauncher: StepLauncher;
  private importStats: ImportStats;
  private importedFiles: any;
  private options: any;
  private storageFolder: string;

  private currentImportFolder: string;

  constructor(options: any) {
    this.stepLauncher = new StepLauncher();
    this.executor = new TaskExecutor(20, this.stepLauncher);
    this.importStats = new ImportStats();
    this.importedFiles = {};
    this.options = options;
    this.storageFolder = options.storageDir;
  }

  public startExecutor(){
    this.executor.start();
  }

  public scan(){
//    this.scanDir(this.currentImportFolder);
  }

  public importPhotos(importedFolder: string) {
    this.currentImportFolder = importedFolder;

    logger.log(LOG_LEVEL.INFO, "Start import %s into %s", importedFolder, this.storageFolder);

    if (this.options.deleteOriginal)
      logger.log(LOG_LEVEL.INFO, "Original files will be deleted after transfer.");
    else
      logger.log(LOG_LEVEL.INFO, "Original files will stay in place.");

    this.stepLauncher.addStep("loadMetadata", this);
    this.stepLauncher.addStep("startExecutor", this);
    this.stepLauncher.addStep("scan", this);
    this.stepLauncher.addStep("startExecutor", this);
    this.stepLauncher.addStep("saveMetadata", this);
    this.stepLauncher.addStep("printImportStats", this);

    this.stepLauncher.start();
  }


/*
  private isFileAlreadyImported(newFile: string) : boolean {
    if(typeof this.importedFiles[newFile] == 'undefined') {
      this.importedFiles[newFile] = true;
      return false;
    } else {
      logger.log(LOG_LEVEL.INFO, "file %s already created by current import", newFile);
      return true;
    }
  }

  private copyFile( newFile: string,
                    buffer: Buffer,
                    originalFile: string,
                    originalMd5: string,
                    dateCanBeTrusted: boolean,
                    photoDate: Date) : void {
    this.stepLauncher.takeMutex();
    logger.log(LOG_LEVEL.DEBUG, "Copy %s to %s", originalFile, newFile);
    fs.stat(newFile, (function(err: any, stat: any) {
       if ((err != null) && err.code == 'ENOENT') { //File does not exist

         this.createMissingDirIfNeeded(photoDate);
         this.addGlobalStats(photoDate, dateCanBeTrusted);

         if(this.options.deleteOriginal) {
           this.stepLauncher.takeMutex();
           fs.rename(originalFile, newFile, (function(err: any) {
              if (err) {
                logger.log(LOG_LEVEL.ERROR, "error renaming file: %s to %s: %s", originalFile, newFile, err);
              } else {
                logger.log(LOG_LEVEL.INFO, "file %s imported to %s", originalFile, newFile);
                this.importStats.increment(photoDate, dateCanBeTrusted);
              }
              this.stepLauncher.releaseMutex();
              this.executor.taskExecutionFinish();
           }).bind(this));
         } else { // keep original as is
           this.stepLauncher.takeMutex();
           fs.writeFile(newFile, buffer, {"mode":"binary"}, (function(error: any){
             if(!error) {
                logger.log(LOG_LEVEL.INFO, "file %s copied from %s",newFile, originalFile);
                this.importStats.increment(photoDate, dateCanBeTrusted);
             } else {
                logger.log(LOG_LEVEL.ERROR, "error copying file %s to %s: %s", originalFile, newFile, error);
             }
             this.stepLauncher.releaseMutex();
             this.executor.taskExecutionFinish();
           }).bind(this));
         }
     } else { // New file exit
       logger.log(LOG_LEVEL.DEBUG, "File %s already exist", newFile);
       this.importStats.duplicates++;
       if(this.options.deleteOriginal) {
         //TODO : optionnaly check md5 ?
         fs.unlinkSync(originalFile);
         logger.log(LOG_LEVEL.INFO, "delete duplicate file %s", originalFile);
       }
       this.executor.taskExecutionFinish();
     }
     this.stepLauncher.releaseMutex();
    }).bind(this));
  }

  private createMissingDirIfNeeded(photoDate: Date): void {
    var photoPath: string;
    var year: number = photoDate.getFullYear();
    var month: number = photoDate.getMonth() + 1;

    photoPath = path.join(this.storageFolder, year.toString());
    this.createIfNotExist(photoPath);
    photoPath = path.join(photoPath, month.toString());
    this.createIfNotExist(photoPath);
  }

  private isNotAlreadyImported(md5: string, file: string, newFile: string ): boolean {
    if(this.options.photoAcceptanceCriteria.hasExifDate) {
      return false;
    }
    if(typeof this.metadata["weakDateMd5"][md5] == 'undefined') {
      logger.log(LOG_LEVEL.DEBUG, "This is a new Md5 add weakDateMd5[%s]=%s", md5, newFile);
      this.metadata["weakDateMd5"][md5] = newFile;
      return true;
    } else {
      logger.log(LOG_LEVEL.WARNING, "Duplicate Md5 %s between file %s and file %s", md5, file, newFile);
      return false;
    }
  }

  // This function produce strings that should be transformed to obtain a path
  // This to avoid conflic between UNIX and Windows separators
  private tagPathFormatter(file : string): string {
    return path.relative(this.storageFolder, file).split(path.sep).join("|");
  }

  private fileNameInStorage(photoDate: Date, photoMD5: string) {
    var photoPath: string;
    var year: number = photoDate.getFullYear();
    var month: number = photoDate.getMonth() + 1;

    photoPath = path.join(this.storageFolder, year.toString());
    photoPath = path.join(photoPath, month.toString());

    const newFileName: string = formatDateSafe(photoDate)+ "_" + photoMD5 + ".jpg";
    return path.join(photoPath, newFileName);
  }

  private createTags(file: string, newFile: string) {

    var relativePath: string = path.relative(this.currentImportFolder, file);
    var pathSections: string[] = relativePath.split(path.sep);

    // Loop backward on path and create tags for file from
    // each folder encountered
    var tagDirDepth = 1;
    if(pathSections.length < 2) return;
    for(var i: number = pathSections.length - 2 ; i >= 0 ; i--) {
      if(this.options.tags.numberOfDirDepth < tagDirDepth ) break;
      tagDirDepth++;
      var folderName = pathSections[i];
      if(typeof this.tags[folderName] == 'undefined') {
        logger.log(LOG_LEVEL.INFO, "New tag found '%s'", folderName);
        this.tags[folderName] = [];
      }
      var relativeFileName: string = this.tagPathFormatter(newFile);
      if(this.tags[folderName].indexOf(relativeFileName) === -1) { // Do not insert twice
        this.tags[folderName].push(relativeFileName);
        logger.log(LOG_LEVEL.DEBUG, "add %s on tag %s", relativeFileName, folderName);
      }
    }

  }

  private moveInStorage( file: string,
                         fileSystemDate: Date): void {
    this.stepLauncher.takeMutex();
    this.executor.taskExecutionStart();
    fs.readFile(file, (function(err: any, buffer: Buffer) {
       if(!err){
         // Validate photo size, Exif, JPEG validity and extract Date
         var jpegParser: JpegParser = new JpegParser(this.options, file)
         var photoAttributes: JpegResult = jpegParser.parse(buffer);

         if(photoAttributes.matchOptionsConditions) {
           const photoMD5: string = md5(buffer);
           var photoDate: Date = photoAttributes.hasExifDate ? dateFromExif(photoAttributes.exifDate) : fileSystemDate;

           var newFile = this.fileNameInStorage(photoDate, photoMD5);

           if(this.options.tags.createFromDirName)
           {
              this.createTags(file, newFile);
           }

           if (!this.isFileAlreadyImported(newFile)
               && (photoAttributes.hasExifDate
                   || this.isNotAlreadyImported(photoMD5, file, newFile))
              ){
             this.copyFile(newFile,
                      buffer,
                      file,
                      photoMD5,
                      photoAttributes.hasExifDate,
                      photoDate);
           } else {
             this.importStats.duplicates++;
             if(this.options.deleteOriginal) {
               fs.unlinkSync(file);
               logger.log(LOG_LEVEL.WARNING, "Delete duplicate file %s", file);
             }
             this.executor.taskExecutionFinish();
           }
         }
       }
       this.stepLauncher.releaseMutex();
    }).bind(this));
  }


  private printImportStats(): void {
    console.log("\n========= Imported results =========\n");
    this.importStats.displayStats();
    console.log("\n========== Total Storage ==========\n");
    this.metadata.global_stats.displayStats();
  }

  private scanDir(folder: string): void {
    this.stepLauncher.takeMutex();
    logger.log(LOG_LEVEL.DEBUG, "Try to read directory %s", folder);
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
            fs.lstat(file, (function (err: any, fileStat: any) {
              if(!err){
                if(fileStat.isFile()){
                  if(isPhoto(file)){
                    var imageSize: number = fileStat["size"];
                    if(imageSize < Number(this.options.photoAcceptanceCriteria.fileSizeInBytes)) {
                      logger.log(LOG_LEVEL.INFO, "%s file size %s is smaller than %s : EXCLUDE PHOTO", file, fileStat["size"], this.options.photoAcceptanceCriteria.fileSizeInBytes);
                      this.stepLauncher.releaseMutex();
                      return;
                    }
                    this.executor.queueTask(this, "moveInStorage", file, fileStat.ctime);
                  }
                } else if(fileStat.isDirectory()) {
                  if(!fileStat.isSymbolicLink())
                    this.scanDir(file, this.currentImportFolder);
                }
              }
              this.stepLauncher.releaseMutex();
            }).bind(this));
          } catch(e){}
        });
      this.stepLauncher.releaseMutex();
    }).bind(this));
  }
*/
}
