import { NotImplemented } from './Errors.js';

export default function Connector(connectorId, io, activity, executionMessage) {
  if (!(this instanceof Connector)) return new Connector(connectorId, io, activity, executionMessage);
  this.connectorId = connectorId;
  this.io = io;
  this.activity = activity;
  this.executionMessage = executionMessage;
}

Connector.prototype.execute = async function execute(...args) {
  const callback = args.pop();
  args.push(formatCallback);

  const activity = this.activity;
  const io = this.io;
  const environment = activity.environment;
  const connectorId = this.connectorId;
  const executionMessage = this.executionMessage;

  const serviceFunction = environment.services[connectorId];
  if (!serviceFunction) return callback(new NotImplemented(connectorId));

  try {
    const input = io && (await io.getInput(activity, executionMessage));
    await serviceFunction.call(activity, input, ...args);
  } catch (err) {
    return callback(err);
  }

  async function formatCallback(serviceErr, result) {
    if (serviceErr) return callback(serviceErr);
    if (!io?.output.length) return callback(null, result);

    try {
      const formattedResult = await io.getOutput(activity, { ...executionMessage, ...result });
      return callback(null, formattedResult);
    } catch (err) {
      return callback(err);
    }
  }
};
