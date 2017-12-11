import { Logger, LOG_LEVEL } from "./Logger";
var logger: Logger = new Logger(LOG_LEVEL.INFO);


export class JpegResult {
  public matchOptionsConditions: boolean;
  public hasExifDate: boolean = false;
  public isValidJpeg: boolean = false;
  public height: Number = 0;
  public width: Number = 0;
  public exifDate: string;
};

export function jpegDataExtractor (buffer: Buffer, options: any, fileName: string) : JpegResult {
  var result: JpegResult = new JpegResult();
  extractData(buffer, result, fileName);
  validateOptions(options, result, fileName);

  logger.log(LOG_LEVEL.DEBUG, "Result %s", JSON.stringify(result));
  return result;
}

function validateOptions(options: any, result: JpegResult, fileName: string) : void {
  result.matchOptionsConditions = false;
  if(result.isValidJpeg)
  {
    if((result.width > options.photoAcceptanceCriteria.minWidth)
       && (result.height > options.photoAcceptanceCriteria.minHeight)
      ){
          if(!options.photoAcceptanceCriteria.hasExifDate || result.hasExifDate) {
            logger.log(LOG_LEVEL.DEBUG, "File %s is Valid", fileName);
            result.matchOptionsConditions = true;
          } else {
            logger.log(LOG_LEVEL.DEBUG, "File %s has not the required exif date", fileName);
          }
      }
    } else {
      logger.log(LOG_LEVEL.DEBUG, "File %s size %sx%s is below limit", fileName, result.width, result.height);
    }
}

function extractSize (buffer: Buffer, i: number, result: JpegResult) : any {
  result.height = buffer.readUInt16BE(i);
  result.width = buffer.readUInt16BE(i + 2);
  logger.log(LOG_LEVEL.DEBUG, "File size is %sx%s", result.width, result.height);
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
function extractExifInfo (buffer: Buffer, i: number, result: JpegResult, fileName: string) : JpegResult {

  var exifLabel: string = "";
  for(var j: number = 0; j < 4 ; j++) {
     exifLabel += String.fromCharCode(buffer.readUInt8(i + j));
  }

  if(exifLabel != "Exif" ) {
    logger.log(LOG_LEVEL.DEBUG, "This is not Exif section (%s).", fileName, exifLabel);
    // Happends if Adobe XMP: http://blog.bfitz.us/?p=289
    return;
  }
  i += 6;
  var endiannessMarker: number = buffer.readUInt16BE(i);
  var isBigEndian: boolean;
  var offsetStart = i;

  if(endiannessMarker == 0x4D4D) { // MM = Motorola = big endian
    logger.log(LOG_LEVEL.VERBOSE_DEBUG, 'File endianess is MM');
    isBigEndian = true;
  } else if(endiannessMarker == 0x4949) { // II = Intel = little endian
    logger.log(LOG_LEVEL.VERBOSE_DEBUG, 'File endianess is II');
    isBigEndian = false;
  } else {
    logger.log(LOG_LEVEL.WARNING, 'File %s Exif endianess section is invalid', fileName);
    return;
  }
  i += 4;

  // Read IFD offest (usually 0x08)
  var IFDoffest: number = isBigEndian ? buffer.readUInt32BE(i) : buffer.readUInt32LE(i);
  logger.log(LOG_LEVEL.VERBOSE_DEBUG, 'IFDoffest = %s', IFDoffest);

  i = offsetStart + IFDoffest;

  //Number of field in IFD isDirectory
  var numberOfFields = isBigEndian ? buffer.readUInt16BE(i) : buffer.readUInt16LE(i);
  logger.log(LOG_LEVEL.VERBOSE_DEBUG, 'IFD contains %s fields', numberOfFields);

  i+=2;

  for(var j: number = 0; j < numberOfFields; j ++) {
    var tagNumber: number = isBigEndian ? buffer.readUInt16BE(i) : buffer.readUInt16LE(i);
    logger.log(LOG_LEVEL.VERBOSE_DEBUG, 'tagNumber = %s', tagNumber);

    if ((tagNumber === 306)||(tagNumber === 36867)||(tagNumber === 36868)) { // Tag for createDate IFD0 section see: https://sno.phy.queensu.ca/~phil/exiftool/TagNames/EXIF.html
      result.hasExifDate = true;

      var createDateDataOffset: number = isBigEndian ? buffer.readUInt32BE(i + 8) : buffer.readUInt32LE(i + 8);
      result.exifDate = "";
      i = offsetStart + createDateDataOffset;
      for(var j: number = 0; j < 19 ; j++) {
        result.exifDate += String.fromCharCode(buffer.readUInt8(i + j));
      }
      logger.log(LOG_LEVEL.VERBOSE_DEBUG, 'result.exifDate = %s', result.exifDate);
      break;
    }

    if (tagNumber === 34665) { // Tag for exif offset
      var exifIFDOffset: number = isBigEndian ? buffer.readUInt32BE(i + 8) : buffer.readUInt32LE(i + 8);
      i = offsetStart + exifIFDOffset;
      numberOfFields = isBigEndian ? buffer.readUInt16BE(i) : buffer.readUInt16LE(i);
      i += 2;
      j = 0;
      logger.log(LOG_LEVEL.VERBOSE_DEBUG, 'Jump to EXIF IFD numberOfFields = %s, offset = %s ', numberOfFields, exifIFDOffset);
      continue;
    }

    i += 12;
  }

  var NextIFDoffest: number = isBigEndian ? buffer.readUInt32BE(i) : buffer.readUInt32LE(i);
  logger.log(LOG_LEVEL.VERBOSE_DEBUG, 'NextIFDoffest = %s', NextIFDoffest);

}

function extractData (buffer: Buffer, result: JpegResult, fileName: string) : void {

  logger.log(LOG_LEVEL.DEBUG, "Start extract JPEG Data from %s", fileName);

  // Skip 2 chars, they are for JPEG signature
  buffer = buffer.slice(2);

  while (buffer.length) {

    var i: number = 0;

    // ensure correct format
    if(!isJpegValid(buffer, i, result, fileName)) {
      return;
    }
    logger.log(LOG_LEVEL.DEBUG, "Marker = 0x%s", buffer[1].toString(16));

    // 0xFFE1 is marker for EXIF
    if (buffer[1] === 0xE1) {
      logger.log(LOG_LEVEL.DEBUG, "Find EXIF section in %s", fileName);
      extractExifInfo(buffer, i + 4, result, fileName);
    }

    // 0xFFC0 is baseline standard(SOF)
    // 0xFFC1 is baseline optimized(SOF)
    // 0xFFC2 is progressive(SOF2)
    if (buffer[1] === 0xC0 || buffer[1] === 0xC1 || buffer[1] === 0xC2) {
      logger.log(LOG_LEVEL.DEBUG, "Find JPEG image section in %s", fileName);
      extractSize(buffer, i + 5, result);
      result.isValidJpeg = true;
      return;
    }

    // read length of the next block
    buffer = buffer.slice(buffer.readUInt16BE(2) + 2);
  }

  logger.log(LOG_LEVEL.WARNING, 'File %s is invalid, no JPG size found', fileName);
}
