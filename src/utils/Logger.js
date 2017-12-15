const datetime = require('./DateTime');

LEVEL = {
  VERBOSE_DEBUG : 0,
  DEBUG : 1,
  INFO : 2,
  WARNING : 3,
  ERROR : 4,
  NO_LOG : 5
};
LOG_LEVEL = Object.keys(LEVEL);

exports.LEVEL = LEVEL;

exports.Logger = class Logger {
  constructor(level)
  {
    this.logLevel = level;
  }

  log(...args) {
    var level = args[0];
    if(level >= this.logLevel) {
      args[0] = datetime.formatDate(new Date()) + " [%s] - " + args[1];
      args[1] = LOG_LEVEL[level];
      console.log.apply(console, args);
    }
  }
}
