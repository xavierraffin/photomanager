const { Logger, LOG_LEVEL } = require('../utils/Logger');
var logger = new Logger(LOG_LEVEL.INFO);

// Steps must be like this (Typescript syntax)
// interface stepFunction {
//    methodName: string;
//    object: any;
// };

exports.StepLauncher = function() {
   this.steps= [];
   this.numberOfSteps = 0;
   this.mutex = 0;

  this.addStep = function(step, object) {
    this.steps.push({ "methodName" : step, "object" : object});
    this.numberOfSteps++;
  }

  this.takeMutex = function(){this.mutex++};
  this.releaseMutex = function(){this.mutex--};

  this.runstep = function(stepNumber) {
    if(stepNumber >= this.numberOfSteps) {
      return;
    }
    if(this.mutex == 0){
      logger.log(LOG_LEVEL.INFO, "============ START STEP %s ============", stepNumber);
      this.steps[stepNumber].object[this.steps[stepNumber].methodName]();
      this.runstep(stepNumber + 1, this);
    } else {
      logger.log(LOG_LEVEL.DEBUG, "Mutex = %s wait 500ms", this.mutex);
      setTimeout(this.runstep.bind(this, stepNumber), 500);
    }
  }

  this.start = function() {
    this.runstep(0);
  }
}
