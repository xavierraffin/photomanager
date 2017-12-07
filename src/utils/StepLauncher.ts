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

  /*private static runStaticStep(stepNumber: number, instance: StepLauncher) : void {
    instance.runstep(stepNumber);
  }*/

  private static runstep(stepNumber: number, instance: StepLauncher) {
    if(stepNumber >= instance.numberOfSteps) return;
    if(instance.mutex == 0){
      console.log("============ START STEP %s ============", stepNumber);
      instance.steps[stepNumber]();
      StepLauncher.runstep(stepNumber + 1, instance);
    } else {
      console.log("Mutex = %s wait 400ms", instance.mutex);
      setTimeout(function () {StepLauncher.runstep(stepNumber, instance);}, 400);
    }
  }

  public start() : void {
    StepLauncher.runstep(0, this);
  }
}

export { stepFunction };
export { StepLauncher };
