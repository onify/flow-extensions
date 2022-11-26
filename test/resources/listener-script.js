/* global next,environment,listener */

setResult();

function setResult() {
  return new Promise((resolve) => {
    environment.output.output = {
      task: environment.output.result,
      success: listener.fields.success,
    };
    delete environment.output.result;
    next();
    resolve();
  });
}
