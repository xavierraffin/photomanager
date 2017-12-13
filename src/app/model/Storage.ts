import { PhotoInfo_IPC } from "./Photo";

export class StorageInfo_IPC {
  photosNbr: number;
  years: number[];
  dir: string;
  chunck: PhotoInfo_IPC[];
}
