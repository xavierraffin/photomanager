const datetime = require('./DateTime');

var LOG_LEVEL = {
  VERBOSE_DEBUG : 0,
  DEBUG : 1,
  INFO : 2,
  WARNING : 3,
  ERROR : 4,
  NO_LOG : 5
};
let LOG_LEVEL_NAME = Object.keys(LOG_LEVEL);

exports.LOG_LEVEL = LOG_LEVEL;

exports.Logger = class Logger {
  constructor(level)
  {
    this.logLevel = level;
  }

  log(...args) {
    var level = args[0];
    if(level >= this.logLevel) {
      args[0] = datetime.formatDate(new Date()) + " [%s] - " + args[1];
      args[1] = LOG_LEVEL_NAME[level];
      console.log.apply(console, args);
    }
  }
}
