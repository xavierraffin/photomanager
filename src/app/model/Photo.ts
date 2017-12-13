import { datefromSafeFormat } from "../utils/DateTime";

export class PhotoInfo_IPC {
  w: number; // width px
  h: number; // height px
  s: number; // size ko
  n: string; // file name
}

export function getIPCPhotoDate(IPCname: string): Date {
  return datefromSafeFormat(IPCname.substr(0, 18));
}

export function getIPCPhotoPath(IPCname: string): string {
  return "/" + IPCname.substr(0, 4) +
         "/" + IPCname.substr(5, 2).replace('-','/') +
         "/" + IPCname + ".jpg"
}
