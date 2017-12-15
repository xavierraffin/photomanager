import { datefromSafeFormat } from "../utils/DateTime";

// This super compact class is used to exchange data
// Between Electron main process and renderer process
export class PhotoInfo_IPC {
  w: number; // width px
  h: number; // height px
  s: number; // size ko
  n: string; // file name
  t: string[]; //tags
}

export function getIPCPhotoDate(IPCname: string): Date {
  return datefromSafeFormat(IPCname.substr(0, 18));
}

export function getIPCPhotoPath(IPCname: string): string {
  return "/" + IPCname.substr(0, 4) +
         "/" + IPCname.substr(5, 2).replace('-','/') +
         "/" + IPCname + ".jpg"
}

export function getNameFromFileName(fileName: string): string {
  return fileName.substr(0, fileName.length - 4); // delete .jpg
}
