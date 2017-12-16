const datefromSafeFormat = require("../utils/DateTime");

exports.PhotoInfo_IPC = class PhotoInfo_IPC {
  constructor(width, height, size, name, tags) {
    this.w = width;
    this.h = height;
    this.s = size;
    this.n = name;
    this.t = tags;
  }
}

exports.getIPCPhotoDate = function(IPCname) {
  return datefromSafeFormat(IPCname.substr(0, 18));
}

exports.getIPCPhotoPath = function(IPCname) {
  return "/" + IPCname.substr(0, 4) +
         "/" + IPCname.substr(5, 2).replace('-','/') +
         "/" + IPCname + ".jpg"
}

exports.getNameFromFileName = function(fileName) {
  return fileName.substr(0, fileName.length - 4); // delete .jpg
}
