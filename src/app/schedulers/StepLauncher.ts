import { Logger, LOG_LEVEL } from "../utils/Logger";
var logger: Logger = new Logger(LOG_LEVEL.INFO);

export interface stepFunction {
  methodName: string;
  object: any;
};

export class StepLauncher {
  private steps: stepFunction[] = [];
  private numberOfSteps = 0;
  private mutex = 0;

  public addStep(step: string, object: any) : void {
    this.steps.push({ "methodName" : step, "object" : object});
    this.numberOfSteps++;
  }

  public takeMutex(){this.mutex++};
  public releaseMutex(){this.mutex--};

  private static runstep(stepNumber: number, instance: StepLauncher) {
    if(stepNumber >= instance.numberOfSteps) {
      return;
    }
    if(instance.mutex == 0){
      logger.log(LOG_LEVEL.INFO, "============ START STEP %s ============", stepNumber);
      instance.steps[stepNumber].object[instance.steps[stepNumber].methodName]();
      StepLauncher.runstep(stepNumber + 1, instance);
    } else {
      logger.log(LOG_LEVEL.DEBUG, "Mutex = %s wait 500ms", instance.mutex);
      setTimeout(function () {StepLauncher.runstep(stepNumber, instance);}, 500);
    }
  }

  public start() : void {
    StepLauncher.runstep(0, this);
  }
}
