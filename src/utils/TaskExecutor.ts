import { Logger, LOG_LEVEL } from "./Logger";
var logger: Logger = new Logger(LOG_LEVEL.DEBUG);

class Task {
  private callback: any;
  private args: any [];

  public constructor(callback: any, args: any []) {
    this.callback = callback;
    this.args = args;
  }

  public execute(): void{
    this.callback(this.args);
  }
};

class TaskExecutor {

  private taskQueue: Task[];
  private numberOfrunningTasks: number;
  private maxNumberOfRunningTasks: number;
  private initialTaskNumber: number;
  private finishedTasks: number;

  public constructor(maxNumber: number) {
    this.taskQueue = [];
    this.numberOfrunningTasks = 0;
    this.maxNumberOfRunningTasks = maxNumber;
  }

  public queueTask(task: Task):void {
    this.taskQueue.push(task);
  }
  private popNextTask(): Task{
    return this.taskQueue.shift();
  }

  public taskExecutionStart():void {
    this.numberOfrunningTasks++;
    logger.log(LOG_LEVEL.DEBUG, "Task added: total = %s", this.numberOfrunningTasks);
  }
  public taskExecutionFinish():void {
    this.numberOfrunningTasks--;
    this.finishedTasks++;
    logger.log(LOG_LEVEL.DEBUG, "Task deleted: total = %s", this.numberOfrunningTasks);
  }

  public start():void {
    this.initialTaskNumber = this.taskQueue.length;
    this.finishedTasks = 0;
    logger.log(LOG_LEVEL.DEBUG, "TaskExecutor started");
    setImmediate(this.eventLoopInjection);
  }

  private eventLoopInjection():void {
    logger.log(LOG_LEVEL.DEBUG, "eventLoopInjection called");
    logger.log(LOG_LEVEL.INFO, "Task completion = %s%, (%s/%s)",
                                (this.finishedTasks/this.initialTaskNumber)*100,
                                this.finishedTasks,
                                this.initialTaskNumber);
    logger.log(LOG_LEVEL.DEBUG, "There is %s tasks running before", this.numberOfrunningTasks);
    while(this.numberOfrunningTasks < this.maxNumberOfRunningTasks)
    {
      this.popNextTask().execute();
    }
    logger.log(LOG_LEVEL.DEBUG, "There is %s tasks running after", this.numberOfrunningTasks);
    if(this.taskQueue.length != 0) {
      setImmediate(this.eventLoopInjection);
    } else {
      logger.log(LOG_LEVEL.INFO, "Task Queue is empty, stop execution");
    }
  }
}

export { Task };
export { TaskExecutor };
