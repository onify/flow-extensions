import { NotImplemented } from './Errors.js';

export default function ServiceExpression(activity) {
  if (!(this instanceof ServiceExpression)) return new ServiceExpression(activity);
  this.activity = activity;
  this.type = `${activity.type}:expression`;
  this.expression = activity.behaviour.expression;
}

ServiceExpression.prototype.execute = function execute(executionMessage, callback) {
  try {
    const expression = this.expression;
    var serviceFn = this.activity.environment.resolveExpression(expression, executionMessage);
    if (typeof serviceFn !== 'function') throw new NotImplemented(`expression "${expression}"`);
  } catch (err) {
    return callback(err);
  }

  serviceFn.call(this.activity, executionMessage, (err, result) => {
    callback(err, result);
  });
};
