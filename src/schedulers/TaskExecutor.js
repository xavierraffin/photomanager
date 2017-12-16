const StepLauncher = require("./StepLauncher");
const { Logger, LOG_LEVEL } = require('../utils/Logger');
var logger = new Logger(LOG_LEVEL.INFO);

class Task {
  constructor(callbackObj, callbackName, args) {
    this.callbackName = callbackName;
    this.callbackObj = callbackObj;
    this.args = args;
  }

  execute(){
    this.callbackObj[this.callbackName](...this.args);
  }
};

exports = class TaskExecutor {

  constructor(maxNumber, stepLauncher) {
    logger.log(LOG_LEVEL.DEBUG, "Executor created, max parrallel tasks = %s", maxNumber);
    this.taskQueue = [];
    this.numberOfrunningTasks = 0;
    this.maxNumberOfRunningTasks = maxNumber;
    this.stepLauncher = stepLauncher;
    this.finishedTasks = 0;
    this.initialTaskNumber = 0;
  }

  queueTask(...args) {
    var callbackObj = args[0];
    var callbackName = args[1];
    args.shift();
    args.shift();
    var task = new Task(callbackObj, callbackName, args);
    this.taskQueue.push(task);
  }
  popNextTask() {
    return this.taskQueue.shift();
  }

  taskExecutionStart() {
    this.numberOfrunningTasks++;
    logger.log(LOG_LEVEL.DEBUG, "New running task: total = %s", this.numberOfrunningTasks);
  }
  taskExecutionFinish() {
    this.numberOfrunningTasks--;
    this.finishedTasks++;
    logger.log(LOG_LEVEL.DEBUG, "Running task finished: total = %s", this.numberOfrunningTasks);
  }

  start() {
    this.stepLauncher.takeMutex();
    this.initialTaskNumber = this.taskQueue.length;
    this.finishedTasks = 0;
    if(this.initialTaskNumber != 0) {
      logger.log(LOG_LEVEL.INFO, "TaskExecutor started, number of pending tasks = %s", this.initialTaskNumber);
      setImmediate(this.eventLoopInjection.bind(this));
    } else {
      logger.log(LOG_LEVEL.DEBUG, "TaskExecutor is empty, abort launch");
      this.stepLauncher.releaseMutex();
    }
  }

  eventLoopInjection() {
    logger.log(LOG_LEVEL.DEBUG, "eventLoopInjection called");
    logger.log(LOG_LEVEL.INFO, "Task completion = %s%, (%s/%s), running tasks = %s",
                                (this.finishedTasks/this.initialTaskNumber)*100,
                                this.finishedTasks,
                                this.initialTaskNumber,
                                this.numberOfrunningTasks);
    while(this.numberOfrunningTasks < this.maxNumberOfRunningTasks)
    {
      if(this.taskQueue.length == 0) {
        break;
      }
      this.popNextTask().execute();
    }
    logger.log(LOG_LEVEL.DEBUG, "There is %s tasks running after", this.numberOfrunningTasks);
    if(this.taskQueue.length != 0) {
      setImmediate(this.eventLoopInjection.bind(this));
    } else {
      this.stepLauncher.releaseMutex();
      logger.log(LOG_LEVEL.INFO, "Task Queue is empty, stop execution");
    }
  }
}
