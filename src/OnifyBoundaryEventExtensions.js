import { OnifyElementExtensions } from './OnifyElementExtensions.js';

export class OnifyBoundaryEventExtensions extends OnifyElementExtensions {
  constructor(activity, context) {
    super(activity, context);
  }
  activate(message) {
    const activity = this.activity;
    const broker = activity.broker;
    const formatQ = activity.broker.getQueue('format-run-q');
    const executionListeners = this.extensions.listeners;

    if (message.fields.redelivered && message.fields.routingKey === 'run.start') {
      activity.on('start', (elementApi) => {
        this._syncFormatOnEnter(broker, elementApi);
      }, { consumerTag: '_onify-extension-on-enter' });
    } else {
      activity.on('enter', (elementApi) => {
        this._syncFormatOnEnter(broker, elementApi);
      }, { consumerTag: '_onify-extension-on-enter' });
    }

    activity.on('activity.execution.completed', (elementApi) => {
      return this._onExecutionCompleted(elementApi, formatQ);
    }, { consumerTag: '_onify-extension-on-executed' });

    if (executionListeners?.onStart) {
      activity.on('start', async (elementApi) => {
        try {
          await executionListeners.execute('start', elementApi);
        } catch (err) {
          return activity.logger.error(`<${activity.id}> execution listener error`, err);
        }
      }, { consumerTag: '_onify-extension-on-listenerstart' });
    }
    if (executionListeners?.onEnd) {
      activity.on('end', async (elementApi) => {
        formatQ.queueMessage({routingKey: 'run.listener.end'}, { endRoutingKey: 'run.listener.end.complete' }, { persistent: false });

        try {
          var format = await executionListeners.execute('end', elementApi);
        } catch (err) {
          return broker.publish('format', 'run.listener.end.error', { error: err }, {persistent: false});
        }

        broker.publish('format', 'run.listener.end.complete', { ...format }, {persistent: false});
      }, { consumerTag: '_onify-extension-on-listenerend' });
    }
  }
  _syncFormatOnEnter(broker, elementApi) {
    try {
      var format = this._onSyncEnter(elementApi);
    } catch (err) {
      return broker.publish('format', 'run.enter.error', { error: err }, { persistent: false });
    }

    broker.publish('format', 'run.enter.complete', format, { persistent: false });
  }
  _onSyncEnter(elementApi) {
    const {format, properties, io} = this.extensions;

    const result = {};
    Object.assign(result, format.resolve(elementApi));
    Object.assign(elementApi.content, result);

    if (properties) {
      Object.assign(result, { properties: properties.resolve(elementApi) });
      Object.assign(elementApi.content, result);
    }

    if (io?.output?.length) {
      result.assignToOutput = true;
    }

    return result;
  }
}
