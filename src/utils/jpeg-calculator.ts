import { Logger, LOG_LEVEL } from "./Logger";
var logger: Logger = new Logger(LOG_LEVEL.WARNING);


export class JpegResult {
  public matchOptionsConditions: boolean;
  public haveExifDate: boolean = false;
  public isValidJpeg: boolean = false;
  public height: Number = 0;
  public width: Number = 0;
  public exifDate: string;
};

export function jpegDataExtractor (buffer: Buffer, options: any, fileName: string) : JpegResult {
  var result: JpegResult = new JpegResult();
  extractData(buffer, result, fileName);
  validateOptions(options, result, fileName);
  return result;
}

function validateOptions(options: any, result: string, fileName) : void {
  result.matchOptionsConditions = false;
  if(isValidJpeg)
    if((result.width > options.photoAcceptanceCriteria.minWidth)
       && (result.height > options.photoAcceptanceCriteria.minHeight)
      ){
          if(!options.photoAcceptanceCriteria.hasExifDate || result.haveExifDate) {
            result.matchOptionsConditions = true;
          } else {
            logger.log(LOG_LEVEL.DEBUG, "File %s has not the required exif date", fileName);
          }
      }
    } else {
      logger.log(LOG_LEVEL.DEBUG, "File %s size %sx%s is below limit", fileName, result.width, result.height);
    }
}

export let sizeIsOverLimits = (buffer: Buffer, minWidth: number, minHeight: number) : boolean => {
  try {
    var result: any = calculate(buffer);
    return ();
  } catch (e) {
    return false;
  }
}

function extractSize (buffer: Buffer, i: number, result: JpegResult) : any {
  result.height = buffer.readUInt16BE(i);
  result.width = buffer.readUInt16BE(i + 2);
}

function isJpegValid(buffer: Buffer, i: number, result: JpegResult, fileName: string) : boolean {
  // index should be within buffer limits
  if (i > buffer.length) {
    logger.log(LOG_LEVEL.WARNING, "File %s is not a corrupted JPG, exceeded buffer limits %s", fileName, i);
    return false;
  }
  // Every JPEG block must begin with a 0xFF
  if (buffer[i] !== 0xFF) {
    logger.log(LOG_LEVEL.WARNING, "File %s is not a valid JPG, marker table corrupted", fileName);
    return false;
  }
  return true;
}

/* Should be called after begining of EXIF section 0xFFE1
 * EXIF fill sign is: 0xFFE1..Exif..
 * (the first two .. are the total lenght of EXIF section before next block -maybe JPEG image see jump in calculate-)
 * Just after that start the directory (offset start from here)
 * The beggining is always MM or II (Intel/Motorola: Endianess)
 *
 * Then look for
 * 0x0132000200000014 in MM case
 * or
 * 0x3201020014000000 in II case
 *
 * The explanation is
 * <Date TAG TAG 2 bytes = 0x0132><type of elt 2=ASCI on 2 bytes><number of elt on 4bytes = always 20 = 0x14 for DATETIME>
 * see short explaination: https://www.codeproject.com/Articles/47486/Understanding-and-Reading-Exif-Data
 * see full explaination: http://gvsoft.no-ip.org/exif/exif-explanation.html
 * see full spec: http://www.cipa.jp/std/documents/e/DC-008-Translation-2016-E.pdf
 *
 * Just after this comes the offset on 8 bytes (number of bytes from beginning start to beginning of DATA)
 * So because of this nature, all directory entry can be read 12 bytes per 12 bytes
 */
function extractExifInfo (buffer: Buffer, i: number, result: JpegResult) : JpegResult {

  result.hasExifDate = true;
  result.exifDate = ...;

  if(("exif" in exifData) && ("ExifImageWidth" in exifData.exif) && ("ExifImageHeight" in exifData.exif)){
    if ((options.photoAcceptanceCriteria.minExifImageWidth > exifData.exif.ExifImageWidth)
        || (options.photoAcceptanceCriteria.minExifImageHeight > exifData.exif.ExifImageHeight)) {

          if(("exif" in exifData) && ("CreateDate" in exifData.exif)){
            const photoDate: Date = dateFromExif(exifData.exif.CreateDate);
            moveInStorage(photoDate, file, storage, true, imageSizeWasntChecked, imageSize, descriptor, rootfolder);
          } else if(("image" in exifData) && ("ModifyDate" in exifData.image)) {
            const photoDate: Date = dateFromExif(exifData.image.ModifyDate);
            moveInStorage(photoDate, file, storage, true, imageSizeWasntChecked, imageSize, descriptor, rootfolder);
          } else {
            if(!options.photoAcceptanceCriteria.hasExifDate) {


}

function extractData (buffer: Buffer, result: JpegResult, fileName: string) : void {

  // Skip 4 chars, they are for signature
  buffer = buffer.slice(4);

  var i: number, next;
  while (buffer.length) {
    // read length of the next block
    i = buffer.readUInt16BE(0); // Here we jump to next block reading the length of dir

    // ensure correct format
    if(!isJpegValid(buffer, i, result, fileName)) {
      return;
    }

    // 0xFFC0 is baseline standard(SOF)
    // 0xFFC1 is baseline optimized(SOF)
    // 0xFFC2 is progressive(SOF2)

    // 0xFFE1 is marker for EXIF
    next = buffer[i + 1];

    if (next === 0xE1) {
      extractExifInfo(buffer, result);
    }

    if (next === 0xC0 || next === 0xC1 || next === 0xC2) {
      extractSize(buffer, i + 5, result);
      result.isValidJpeg = true;
      return;
    }

    // move to the next block
    buffer = buffer.slice(i + 2);
  }

  logger.log(LOG_LEVEL.WARNING, 'File %s is invalid, no JPG size found', fileName);
}
