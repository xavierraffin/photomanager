import { formatDate } from "./DateTime";

export enum LOG_LEVEL {
  VERBOSE_DEBUG = 0,
  DEBUG = 1,
  INFO = 2,
  WARNING = 3,
  ERROR = 4,
  NO_LOG = 5
}

export class Logger {
  private logLevel: LOG_LEVEL;

  public constructor(level: LOG_LEVEL)
  {
    this.logLevel = level;
  }

  public log(...args: any []) : void {
    var level: LOG_LEVEL = args[0];
    if(level >= this.logLevel) {
      args[0] = formatDate(new Date()) + " [%s] - " + args[1];
      args[1] = LOG_LEVEL[level];
      console.log.apply(console, args);
    }
  }
}
