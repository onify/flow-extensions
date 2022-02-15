export default function ServiceExpression(activity) {
  if (!(this instanceof ServiceExpression)) return new ServiceExpression(activity);
  this.activity = activity;
  this.type = `${activity.type}:expression`;
  this.expression = activity.behaviour.expression;
}

ServiceExpression.prototype.execute = function execute(executionMessage, callback) {
  const serviceFn = this.activity.environment.resolveExpression(this.expression, executionMessage);
  serviceFn.call(this.activity, executionMessage, (err, result) => {
    callback(err, result);
  });
};
