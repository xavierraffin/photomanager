import { StepLauncher } from "./StepLauncher";
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
    this.callback(...this.args);
  }
};

class TaskExecutor {

  private taskQueue: Task[];
  private numberOfrunningTasks: number;
  private maxNumberOfRunningTasks: number;
  private initialTaskNumber: number;
  private finishedTasks: number;
  private stepLauncher: StepLauncher;

  public constructor(maxNumber: number) {
    logger.log(LOG_LEVEL.DEBUG, "Executor created, max parrallel tasks = %s", maxNumber);
    this.taskQueue = [];
    this.numberOfrunningTasks = 0;
    this.maxNumberOfRunningTasks = maxNumber;
  }

  public queueTask(...args: any []):void {
    var callback: any = args[0];
    args.shift();
    var task: Task = new Task(callback, args);
    this.taskQueue.push(task);
  }
  private popNextTask(): Task{
    return this.taskQueue.shift();
  }

  public taskExecutionStart():void {
    this.numberOfrunningTasks++;
    logger.log(LOG_LEVEL.DEBUG, "New running task: total = %s", this.numberOfrunningTasks);
  }
  public taskExecutionFinish():void {
    this.numberOfrunningTasks--;
    this.finishedTasks++;
    logger.log(LOG_LEVEL.DEBUG, "Running task finished: total = %s", this.numberOfrunningTasks);
  }

  public start(stepLauncher: StepLauncher):void {
    this.stepLauncher = stepLauncher;
    this.stepLauncher.takeMutex();
    this.initialTaskNumber = this.taskQueue.length;
    this.finishedTasks = 0;
    if(this.initialTaskNumber != 0) {
      logger.log(LOG_LEVEL.DEBUG, "TaskExecutor started, number of pending tasks = %s", this.initialTaskNumber);
      setImmediate(TaskExecutor.eventLoopInjection, this);
    } else {
      logger.log(LOG_LEVEL.DEBUG, "TaskExecutor is empty, abort launch");
      this.stepLauncher.releaseMutex();
    }
  }

  private static eventLoopInjection(instance: TaskExecutor):void {
    logger.log(LOG_LEVEL.DEBUG, "eventLoopInjection called");
    logger.log(LOG_LEVEL.INFO, "Task completion = %s%, (%s/%s)",
                                (instance.finishedTasks/instance.initialTaskNumber)*100,
                                instance.finishedTasks,
                                instance.initialTaskNumber);
    logger.log(LOG_LEVEL.DEBUG, "There is %s tasks running before", instance.numberOfrunningTasks);
    while(instance.numberOfrunningTasks < instance.maxNumberOfRunningTasks)
    {
      if(instance.taskQueue.length == 0) {
        break;
      }
      instance.popNextTask().execute();
    }
    logger.log(LOG_LEVEL.DEBUG, "There is %s tasks running after", instance.numberOfrunningTasks);
    if(instance.taskQueue.length != 0) {
      setImmediate(TaskExecutor.eventLoopInjection, instance);
    } else {
      instance.stepLauncher.releaseMutex();
      logger.log(LOG_LEVEL.INFO, "Task Queue is empty, stop execution");
    }
  }
}

export { Task };
export { TaskExecutor };
