export let sizeIsOverLimits = (buffer: Buffer, minWidth: number, minHeight: number) : boolean => {
  try {
    var result: any = calculate(buffer);
    return ((result.width > minWidth) && (result.height > minHeight));
  } catch (e) {
    console.log("ERROR file size can't be read: %s", e);
    return false;
  }
}

function extractSize (buffer: Buffer, i: number) : any {
  return {
    'height' : buffer.readUInt16BE(i),
    'width' : buffer.readUInt16BE(i + 2)
  };
}

function validateBuffer (buffer: Buffer, i: number) : void {
  // index should be within buffer limits
  if (i > buffer.length) {
    throw new TypeError('Corrupt JPG, exceeded buffer limits ' + i);
  }
  // Every JPEG block must begin with a 0xFF
  if (buffer[i] !== 0xFF) {
    throw new TypeError('Invalid JPG, marker table corrupted');
  }
}

function calculate (buffer: Buffer) : any {

  // Skip 4 chars, they are for signature
  buffer = buffer.slice(4);

  var i: number, next;
  while (buffer.length) {
    // read length of the next block
    i = buffer.readUInt16BE(0);

    // ensure correct format
    validateBuffer(buffer, i);

    // 0xFFC0 is baseline standard(SOF)
    // 0xFFC1 is baseline optimized(SOF)
    // 0xFFC2 is progressive(SOF2)
    next = buffer[i + 1];
    if (next === 0xC0 || next === 0xC1 || next === 0xC2) {
      return extractSize(buffer, i + 5);
    }

    // move to the next block
    buffer = buffer.slice(i + 2);
  }

  throw new TypeError('Invalid JPG, no size found');
}