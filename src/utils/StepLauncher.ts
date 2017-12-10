import { Logger, LOG_LEVEL } from "./Logger";
var logger: Logger = new Logger(LOG_LEVEL.INFO);

interface stepFunction { () : void };

class StepLauncher {
  private steps: stepFunction[] = [];
  private numberOfSteps = 0;
  private mutex = 0;

  public addStep(step: stepFunction) : void {
    this.steps.push(step);
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
      instance.steps[stepNumber]();
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

export { stepFunction };
export { StepLauncher };
